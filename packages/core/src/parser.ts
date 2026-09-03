import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal'
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table'
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item'
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { gfmTable } from 'micromark-extension-gfm-table'
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item'
import type { Content, Definition, ImageReference, LinkReference, Root } from 'mdast'
import type {
  BlockquoteNode,
  BreakNode,
  CodeNode,
  DefinitionNode,
  DeleteNode,
  DocumentNode,
  EmphasisNode,
  HeadingNode,
  HtmlNode,
  ImageNode,
  InlineCodeNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MarkdownNode,
  ParagraphNode,
  Point,
  SourcePosition,
  StrongNode,
  TableCellNode,
  TableNode,
  TableRowNode,
  TextNode,
  ThematicBreakNode,
} from './types'

const markdownExtensions = [gfmAutolinkLiteral(), gfmStrikethrough(), gfmTable(), gfmTaskListItem()]

const mdastExtensions = [
  gfmAutolinkLiteralFromMarkdown(),
  gfmStrikethroughFromMarkdown(),
  gfmTableFromMarkdown(),
  gfmTaskListItemFromMarkdown(),
]

class SourceLocator {
  private readonly lineStarts: number[] = [0]

  constructor(private readonly source: string) {
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] === '\n' || source[index] === '\r') {
        if (source[index] === '\r' && source[index + 1] === '\n') {
          continue
        }
        this.lineStarts.push(index + 1)
      }
    }
  }

  point(offset: number): Point {
    let low = 0
    let high = this.lineStarts.length - 1

    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const start = this.lineStarts[middle]!

      if (start <= offset) {
        low = middle + 1
      } else {
        high = middle - 1
      }
    }

    const lineIndex = Math.max(0, high)
    const lineStart = this.lineStarts[lineIndex]!

    return {
      offset,
      line: lineIndex + 1,
      column: offset - lineStart + 1,
    }
  }

  position(start: number, end: number): SourcePosition {
    return {
      start: this.point(Math.max(0, start)),
      end: this.point(Math.max(start, end)),
    }
  }
}

class NodeFactory {
  private readonly locator: SourceLocator

  constructor(private readonly source: string) {
    this.locator = new SourceLocator(source)
  }

  node<T extends MarkdownNode | DocumentNode>(
    type: T['type'],
    start: number,
    end: number,
    fields: Omit<T, 'id' | 'type' | 'position'>,
  ): T {
    const boundedStart = Math.max(0, Math.min(start, this.source.length))
    const boundedEnd = Math.max(boundedStart, Math.min(end, this.source.length))
    const raw = this.source.slice(boundedStart, boundedEnd)
    const id = `mv-${type}-${hash(`${type}:${boundedStart}:${boundedEnd}:${raw}`)}`

    return {
      id,
      type,
      position: this.locator.position(boundedStart, boundedEnd),
      ...fields,
    } as T
  }
}

function hash(value: string): string {
  let result = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }

  return (result >>> 0).toString(36)
}

function nodeRange(node: Content, fallback = 0): { start: number; end: number } {
  const start = node.position?.start.offset ?? fallback
  const end = node.position?.end.offset ?? start

  return { start, end: Math.max(start, end) }
}

function definitionKey(identifier: string): string {
  return identifier.trim().toLowerCase().replace(/\s+/g, ' ')
}

function collectDefinitions(node: Content, definitions: Map<string, Definition>): void {
  if (node.type === 'definition') {
    const key = definitionKey(node.identifier)
    if (!definitions.has(key)) {
      definitions.set(key, node)
    }
  }

  if ('children' in node) {
    for (const child of node.children) {
      collectDefinitions(child, definitions)
    }
  }
}

function isIncompleteFence(source: string, range: { start: number; end: number }): boolean {
  const raw = source.slice(range.start, range.end)
  const firstLine = raw.split(/\r\n|\r|\n/)[0]!
  const opening = firstLine.match(/^ {0,3}(`{3,}|~{3,})/)

  if (!opening) {
    return false
  }

  const marker = opening[1]![0]!
  const length = opening[1]!.length
  const closing = new RegExp(`^ {0,3}${marker}{${length},}[ \\t]*$`)
  const lines = raw.split(/\r\n|\r|\n/)

  return !lines.slice(1).some((line) => closing.test(line))
}

function textNode(
  factory: NodeFactory,
  value: string,
  range: { start: number; end: number },
): TextNode {
  return factory.node<TextNode>('text', range.start, range.end, { value })
}

function literalReference(
  source: string,
  factory: NodeFactory,
  node: LinkReference | ImageReference,
): TextNode {
  const range = nodeRange(node)
  return textNode(factory, source.slice(range.start, range.end), range)
}

function fallbackDocument(source: string, factory: NodeFactory): DocumentNode {
  return factory.node<DocumentNode>('document', 0, source.length, {
    children:
      source.length > 0
        ? [
            factory.node<ParagraphNode>('paragraph', 0, source.length, {
              children: [textNode(factory, source, { start: 0, end: source.length })],
            }),
          ]
        : [],
  })
}

function mapNode(
  source: string,
  factory: NodeFactory,
  node: Content,
  definitions: Map<string, Definition>,
  blockContext: boolean,
): MarkdownNode[] {
  const range = nodeRange(node)

  switch (node.type) {
    case 'text':
      return [textNode(factory, node.value, range)]
    case 'heading':
      return [
        factory.node<HeadingNode>('heading', range.start, range.end, {
          level: node.depth,
          children: mapChildren(source, factory, node.children, definitions, false),
        }),
      ]
    case 'paragraph':
      return [
        factory.node<ParagraphNode>('paragraph', range.start, range.end, {
          children: mapChildren(source, factory, node.children, definitions, false),
        }),
      ]
    case 'emphasis':
      return [
        factory.node<EmphasisNode>('emphasis', range.start, range.end, {
          children: mapChildren(source, factory, node.children, definitions, false),
        }),
      ]
    case 'strong':
      return [
        factory.node<StrongNode>('strong', range.start, range.end, {
          children: mapChildren(source, factory, node.children, definitions, false),
        }),
      ]
    case 'delete':
      return [
        factory.node<DeleteNode>('delete', range.start, range.end, {
          children: mapChildren(source, factory, node.children, definitions, false),
        }),
      ]
    case 'inlineCode':
      return [
        factory.node<InlineCodeNode>('inlineCode', range.start, range.end, {
          value: node.value,
        }),
      ]
    case 'break':
      return [factory.node<BreakNode>('break', range.start, range.end, {})]
    case 'link':
      return [
        factory.node<LinkNode>('link', range.start, range.end, {
          url: node.url,
          title: node.title ?? null,
          children: mapChildren(source, factory, node.children, definitions, false),
        }),
      ]
    case 'linkReference': {
      const definition = definitions.get(definitionKey(node.identifier))
      if (!definition) {
        return [literalReference(source, factory, node)]
      }

      return [
        factory.node<LinkNode>('link', range.start, range.end, {
          url: definition.url,
          title: definition.title ?? null,
          children: mapChildren(source, factory, node.children, definitions, false),
        }),
      ]
    }
    case 'image':
      return [
        factory.node<ImageNode>('image', range.start, range.end, {
          url: node.url,
          alt: node.alt ?? '',
          title: node.title ?? null,
        }),
      ]
    case 'imageReference': {
      const definition = definitions.get(definitionKey(node.identifier))
      if (!definition) {
        return [literalReference(source, factory, node)]
      }

      return [
        factory.node<ImageNode>('image', range.start, range.end, {
          url: definition.url,
          alt: node.alt ?? '',
          title: definition.title ?? null,
        }),
      ]
    }
    case 'code':
      return [
        factory.node<CodeNode>('code', range.start, range.end, {
          language: node.lang ?? null,
          meta: node.meta ?? null,
          value: node.value,
          incomplete: isIncompleteFence(source, range),
        }),
      ]
    case 'thematicBreak':
      return [factory.node<ThematicBreakNode>('thematicBreak', range.start, range.end, {})]
    case 'blockquote':
      return [
        factory.node<BlockquoteNode>('blockquote', range.start, range.end, {
          children: mapChildren(source, factory, node.children, definitions, true),
        }),
      ]
    case 'list':
      return [
        factory.node<ListNode>('list', range.start, range.end, {
          ordered: node.ordered ?? false,
          start: node.ordered ? (node.start ?? 1) : null,
          spread: node.spread ?? false,
          children: node.children.flatMap((child) =>
            mapNode(source, factory, child, definitions, true),
          ) as ListItemNode[],
        }),
      ]
    case 'listItem':
      return [
        factory.node<ListItemNode>('listItem', range.start, range.end, {
          checked: node.checked ?? null,
          spread: node.spread ?? false,
          children: mapChildren(source, factory, node.children, definitions, true),
        }),
      ]
    case 'html':
      return [
        factory.node<HtmlNode>('html', range.start, range.end, {
          value: node.value,
          block: blockContext,
        }),
      ]
    case 'definition':
      return [
        factory.node<DefinitionNode>('definition', range.start, range.end, {
          identifier: node.identifier,
          label: node.label ?? node.identifier,
          url: node.url,
          title: node.title ?? null,
        }),
      ]
    case 'table':
      return [
        factory.node<TableNode>('table', range.start, range.end, {
          alignments: (node.align ?? []).map((alignment) => alignment ?? null),
          children: node.children.flatMap((child) =>
            mapNode(source, factory, child, definitions, true),
          ) as TableRowNode[],
        }),
      ]
    case 'tableRow':
      return [
        factory.node<TableRowNode>('tableRow', range.start, range.end, {
          children: node.children.flatMap((child) =>
            mapNode(source, factory, child, definitions, false),
          ) as TableCellNode[],
        }),
      ]
    case 'tableCell':
      return [
        factory.node<TableCellNode>('tableCell', range.start, range.end, {
          children: mapChildren(source, factory, node.children, definitions, false),
        }),
      ]
    default:
      return [textNode(factory, source.slice(range.start, range.end), range)]
  }
}

function mapChildren(
  source: string,
  factory: NodeFactory,
  nodes: readonly Content[],
  definitions: Map<string, Definition>,
  blockContext: boolean,
): MarkdownNode[] {
  return nodes.flatMap((node) => mapNode(source, factory, node, definitions, blockContext))
}

export function parseMarkdown(source: string): DocumentNode {
  const factory = new NodeFactory(source)
  let parsed: Root

  try {
    parsed = fromMarkdown(source, {
      extensions: markdownExtensions,
      mdastExtensions,
    })
  } catch {
    // Keep hostile or pathological delimiter input renderable even if the
    // upstream tokenizer exhausts the call stack while resolving constructs.
    return fallbackDocument(source, factory)
  }

  try {
    const definitions = new Map<string, Definition>()

    for (const child of parsed.children) {
      collectDefinitions(child, definitions)
    }

    return factory.node<DocumentNode>('document', 0, source.length, {
      children: mapChildren(source, factory, parsed.children, definitions, true),
    })
  } catch {
    return fallbackDocument(source, factory)
  }
}
