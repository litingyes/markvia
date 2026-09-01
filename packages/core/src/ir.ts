import { isSafeUrl } from './security'
import type {
  CodeHighlighter,
  CodeNode,
  DocumentNode,
  ImageNode,
  LinkNode,
  ListNode,
  MarkdownNode,
  RenderDocument,
  RenderElementNode,
  RenderNode,
  RenderTextNode,
} from './types'

export interface IROptions {
  highlighter?: CodeHighlighter
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

function mapChildren(nodes: MarkdownNode[], options: IROptions): RenderNode[] {
  return nodes.flatMap((node) => mapNode(node, options))
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

function mapList(node: ListNode, options: IROptions): RenderElementNode {
  const tag = node.ordered ? 'ol' : 'ul'
  const props = node.ordered && node.start !== null && node.start !== 1 ? { start: node.start } : {}
  return element(node, tag, mapChildren(node.children, options), props)
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

function mapNode(node: MarkdownNode, options: IROptions): RenderNode[] {
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
    case 'link':
      return [mapLink(node, options)]
    case 'image':
      return [mapImage(node)]
    case 'list':
      return [mapList(node, options)]
    case 'listItem':
      return [element(node, 'li', mapChildren(node.children, options))]
    case 'blockquote':
      return [element(node, 'blockquote', mapChildren(node.children, options))]
    case 'code':
      return [mapCode(node, options)]
  }
}

async function mapNodeAsync(node: MarkdownNode, options: IROptions): Promise<RenderNode[]> {
  if (node.type === 'code') {
    return [await mapCodeAsync(node, options)]
  }

  if ('children' in node) {
    const children = (
      await Promise.all(node.children.map((child) => mapNodeAsync(child, options)))
    ).flat()
    switch (node.type) {
      case 'heading':
        return [element(node, `h${node.level}`, children)]
      case 'paragraph':
        return [element(node, 'p', children)]
      case 'emphasis':
        return [element(node, 'em', children)]
      case 'strong':
        return [element(node, 'strong', children)]
      case 'delete':
        return [element(node, 'del', children)]
      case 'link':
        return [element(node, 'a', children, linkProps(node))]
      case 'list':
        return [
          element(
            node,
            node.ordered ? 'ol' : 'ul',
            children,
            node.ordered && node.start !== null && node.start !== 1 ? { start: node.start } : {},
          ),
        ]
      case 'listItem':
        return [element(node, 'li', children)]
      case 'blockquote':
        return [element(node, 'blockquote', children)]
    }
  }

  return mapNode(node, {})
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
