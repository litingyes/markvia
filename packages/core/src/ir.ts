import { isSafeUrl } from './security'
import type {
  CodeHighlighter,
  CodeNode,
  DocumentNode,
  ImageNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MarkdownNode,
  RenderDocument,
  RenderElementNode,
  RenderNode,
  RenderRawNode,
  RenderTextNode,
  TableAlignment,
  TableCellNode,
  TableNode,
  TableRowNode,
} from './types'

export interface IROptions {
  highlighter?: CodeHighlighter
}

interface MapContext {
  listTight?: boolean
  tableHeader?: boolean
  tableAlignments?: TableAlignment[]
}

function linkProps(node: LinkNode): Record<string, string | number | boolean> {
  const props: Record<string, string | number | boolean> = isSafeUrl(node.url)
    ? { href: node.url }
    : { 'data-markvia-unsafe-url': 'true' }
  if (node.title !== null) {
    props.title = node.title
  }
  return props
}

function textNode(node: MarkdownNode, value: string, suffix = ''): RenderTextNode {
  return {
    kind: 'text',
    id: `${node.id}${suffix}`,
    sourceType: 'text',
    position: node.position,
    value,
  }
}

function rawNode(node: MarkdownNode): RenderRawNode {
  return {
    kind: 'raw',
    id: node.id,
    sourceType: 'html',
    position: node.position,
    value: node.type === 'html' ? node.value : '',
  }
}

function element(
  node: MarkdownNode,
  tag: string,
  children: RenderNode[],
  props: Record<string, string | number | boolean> = {},
  suffix = '',
): RenderElementNode {
  return {
    kind: 'element',
    id: `${node.id}${suffix}`,
    sourceType: node.type,
    position: node.position,
    tag,
    props: {
      'data-markvia-node-id': node.id,
      ...props,
    },
    children,
  }
}

function mapChildren(
  nodes: MarkdownNode[],
  options: IROptions,
  context: MapContext = {},
): RenderNode[] {
  return nodes.flatMap((node) => mapNode(node, options, context))
}

function mapCode(node: CodeNode, options: IROptions): RenderElementNode {
  const codeProps: Record<string, string | number | boolean> = {}
  if (node.language) {
    codeProps['data-language'] = node.language
  }
  if (node.incomplete) {
    codeProps['data-incomplete'] = 'true'
  }

  const highlighted = options.highlighter?.highlight(node.value, node.language)
  if (highlighted && highlighted instanceof Promise) {
    throw new Error('The configured code highlighter is asynchronous; use renderAsync instead.')
  }

  const codeChildren = highlighted
    ? highlighted.map((token, index) =>
        element(
          node,
          'span',
          [textNode(node, token.content, `:token:${index}`)],
          token.className ? { class: token.className } : {},
          `:token:${index}`,
        ),
      )
    : [textNode(node, node.value, ':value')]

  const code = element(node, 'code', codeChildren, codeProps, ':code')
  return element(node, 'pre', [code])
}

async function mapCodeAsync(node: CodeNode, options: IROptions): Promise<RenderElementNode> {
  const codeProps: Record<string, string | number | boolean> = {}
  if (node.language) {
    codeProps['data-language'] = node.language
  }
  if (node.incomplete) {
    codeProps['data-incomplete'] = 'true'
  }

  const highlighted = options.highlighter
    ? await options.highlighter.highlight(node.value, node.language)
    : null
  const codeChildren = highlighted
    ? highlighted.map((token, index) =>
        element(
          node,
          'span',
          [textNode(node, token.content, `:token:${index}`)],
          token.className ? { class: token.className } : {},
          `:token:${index}`,
        ),
      )
    : [textNode(node, node.value, ':value')]

  return element(node, 'pre', [element(node, 'code', codeChildren, codeProps, ':code')])
}

function mapListItem(
  node: ListItemNode,
  options: IROptions,
  context: MapContext,
): RenderElementNode {
  const children: RenderNode[] = []
  if (node.checked !== null) {
    children.push(
      element(
        node,
        'input',
        [],
        {
          type: 'checkbox',
          ...(node.checked ? { checked: true } : {}),
          disabled: true,
        },
        ':checkbox',
      ),
    )
    children.push(textNode(node, ' ', ':checkbox-space'))
  }

  for (const child of node.children) {
    if (context.listTight && child.type === 'paragraph') {
      children.push(...mapChildren(child.children, options))
    } else {
      children.push(...mapNode(child, options))
    }
  }

  return element(node, 'li', children)
}

function mapList(node: ListNode, options: IROptions): RenderElementNode {
  const tag = node.ordered ? 'ol' : 'ul'
  const props = node.ordered && node.start !== null && node.start !== 1 ? { start: node.start } : {}
  const context = { listTight: !node.spread }
  return element(
    node,
    tag,
    node.children.map((child) => mapListItem(child, options, context)),
    props,
  )
}

function mapTableCell(
  node: TableCellNode,
  options: IROptions,
  context: MapContext,
): RenderElementNode {
  const alignment = context.tableAlignments?.[0]
  const props = alignment ? { align: alignment } : {}
  return element(
    node,
    context.tableHeader ? 'th' : 'td',
    mapChildren(node.children, options),
    props,
  )
}

function mapTableRow(
  node: TableRowNode,
  options: IROptions,
  context: MapContext,
): RenderElementNode {
  return element(
    node,
    'tr',
    node.children.map((child, index) =>
      mapTableCell(child, options, {
        ...context,
        ...(context.tableAlignments
          ? { tableAlignments: [context.tableAlignments[index] ?? null] }
          : {}),
      }),
    ),
  )
}

function mapTable(node: TableNode, options: IROptions): RenderElementNode {
  const header = node.children[0]
  const body = node.children.slice(1)
  const groups: RenderNode[] = []

  if (header) {
    groups.push(
      element(
        node,
        'thead',
        [
          mapTableRow(header, options, {
            tableHeader: true,
            tableAlignments: node.alignments,
          }),
        ],
        {},
        ':head',
      ),
    )
  }

  if (body.length > 0) {
    groups.push(
      element(
        node,
        'tbody',
        body.map((row) =>
          mapTableRow(row, options, {
            tableAlignments: node.alignments,
          }),
        ),
        {},
        ':body',
      ),
    )
  }

  return element(node, 'table', groups)
}

function mapLink(node: LinkNode, options: IROptions): RenderElementNode {
  return element(node, 'a', mapChildren(node.children, options), linkProps(node))
}

function mapImage(node: ImageNode): RenderElementNode {
  const props: Record<string, string | number | boolean> = { alt: node.alt }
  if (isSafeUrl(node.url)) {
    props.src = node.url
  } else {
    props['data-markvia-unsafe-url'] = 'true'
  }
  if (node.title !== null) {
    props.title = node.title
  }
  return element(node, 'img', [], props)
}

function mapNode(node: MarkdownNode, options: IROptions, context: MapContext = {}): RenderNode[] {
  switch (node.type) {
    case 'text':
      return [textNode(node, node.value)]
    case 'heading':
      return [element(node, `h${node.level}`, mapChildren(node.children, options))]
    case 'paragraph':
      return [element(node, 'p', mapChildren(node.children, options))]
    case 'emphasis':
      return [element(node, 'em', mapChildren(node.children, options))]
    case 'strong':
      return [element(node, 'strong', mapChildren(node.children, options))]
    case 'delete':
      return [element(node, 'del', mapChildren(node.children, options))]
    case 'inlineCode':
      return [element(node, 'code', [textNode(node, node.value)])]
    case 'break':
      return [element(node, 'br', [])]
    case 'link':
      return [mapLink(node, options)]
    case 'image':
      return [mapImage(node)]
    case 'list':
      return [mapList(node, options)]
    case 'listItem':
      return [mapListItem(node, options, context)]
    case 'blockquote':
      return [element(node, 'blockquote', mapChildren(node.children, options))]
    case 'code':
      return [mapCode(node, options)]
    case 'thematicBreak':
      return [element(node, 'hr', [])]
    case 'html':
      return [rawNode(node)]
    case 'table':
      return [mapTable(node, options)]
    case 'tableRow':
      return [mapTableRow(node, options, context)]
    case 'tableCell':
      return [mapTableCell(node, options, context)]
    case 'definition':
      return []
  }
}

async function mapListItemAsync(
  node: ListItemNode,
  options: IROptions,
  context: MapContext,
): Promise<RenderElementNode> {
  const children: RenderNode[] = []
  if (node.checked !== null) {
    children.push(
      element(
        node,
        'input',
        [],
        {
          type: 'checkbox',
          ...(node.checked ? { checked: true } : {}),
          disabled: true,
        },
        ':checkbox',
      ),
    )
    children.push(textNode(node, ' ', ':checkbox-space'))
  }

  for (const child of node.children) {
    if (context.listTight && child.type === 'paragraph') {
      children.push(...(await mapChildrenAsync(child.children, options)))
    } else {
      children.push(...(await mapNodeAsync(child, options)))
    }
  }

  return element(node, 'li', children)
}

async function mapListAsync(node: ListNode, options: IROptions): Promise<RenderElementNode> {
  const tag = node.ordered ? 'ol' : 'ul'
  const props = node.ordered && node.start !== null && node.start !== 1 ? { start: node.start } : {}
  const context = { listTight: !node.spread }
  const children = await Promise.all(
    node.children.map((child) => mapListItemAsync(child, options, context)),
  )
  return element(node, tag, children, props)
}

async function mapTableCellAsync(
  node: TableCellNode,
  options: IROptions,
  context: MapContext,
): Promise<RenderElementNode> {
  const alignment = context.tableAlignments?.[0]
  const props = alignment ? { align: alignment } : {}
  return element(
    node,
    context.tableHeader ? 'th' : 'td',
    await mapChildrenAsync(node.children, options),
    props,
  )
}

async function mapTableRowAsync(
  node: TableRowNode,
  options: IROptions,
  context: MapContext,
): Promise<RenderElementNode> {
  const children = await Promise.all(
    node.children.map((child, index) =>
      mapTableCellAsync(child, options, {
        ...context,
        ...(context.tableAlignments
          ? { tableAlignments: [context.tableAlignments[index] ?? null] }
          : {}),
      }),
    ),
  )
  return element(node, 'tr', children)
}

async function mapTableAsync(node: TableNode, options: IROptions): Promise<RenderElementNode> {
  const header = node.children[0]
  const body = node.children.slice(1)
  const groups: RenderNode[] = []

  if (header) {
    groups.push(
      element(
        node,
        'thead',
        [
          await mapTableRowAsync(header, options, {
            tableHeader: true,
            tableAlignments: node.alignments,
          }),
        ],
        {},
        ':head',
      ),
    )
  }

  if (body.length > 0) {
    groups.push(
      element(
        node,
        'tbody',
        await Promise.all(
          body.map((row) =>
            mapTableRowAsync(row, options, {
              tableAlignments: node.alignments,
            }),
          ),
        ),
        {},
        ':body',
      ),
    )
  }

  return element(node, 'table', groups)
}

async function mapChildrenAsync(nodes: MarkdownNode[], options: IROptions): Promise<RenderNode[]> {
  return (await Promise.all(nodes.map((node) => mapNodeAsync(node, options)))).flat()
}

async function mapNodeAsync(node: MarkdownNode, options: IROptions): Promise<RenderNode[]> {
  switch (node.type) {
    case 'code':
      return [await mapCodeAsync(node, options)]
    case 'list':
      return [await mapListAsync(node, options)]
    case 'table':
      return [await mapTableAsync(node, options)]
    case 'listItem':
      return [await mapListItemAsync(node, options, {})]
    case 'tableRow':
      return [await mapTableRowAsync(node, options, {})]
    case 'tableCell':
      return [await mapTableCellAsync(node, options, {})]
    case 'heading':
      return [element(node, `h${node.level}`, await mapChildrenAsync(node.children, options))]
    case 'paragraph':
      return [element(node, 'p', await mapChildrenAsync(node.children, options))]
    case 'emphasis':
      return [element(node, 'em', await mapChildrenAsync(node.children, options))]
    case 'strong':
      return [element(node, 'strong', await mapChildrenAsync(node.children, options))]
    case 'delete':
      return [element(node, 'del', await mapChildrenAsync(node.children, options))]
    case 'link':
      return [element(node, 'a', await mapChildrenAsync(node.children, options), linkProps(node))]
    case 'blockquote':
      return [element(node, 'blockquote', await mapChildrenAsync(node.children, options))]
    default:
      return mapNode(node, options)
  }
}

export function documentToIR(document: DocumentNode, options: IROptions = {}): RenderDocument {
  return {
    kind: 'root',
    id: document.id,
    children: mapChildren(document.children, options),
  }
}

export async function documentToIRAsync(
  document: DocumentNode,
  options: IROptions = {},
): Promise<RenderDocument> {
  return {
    kind: 'root',
    id: document.id,
    children: (
      await Promise.all(document.children.map((node) => mapNodeAsync(node, options)))
    ).flat(),
  }
}
