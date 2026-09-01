import type {
  BlockquoteNode,
  CodeNode,
  DeleteNode,
  DocumentNode,
  EmphasisNode,
  HeadingNode,
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
  TextNode,
} from './types'

interface SourceLine {
  text: string
  start: number
  end: number
  nextStart: number
  contentStart: number
}

interface InlineInput {
  text: string
  offsets: number[]
}

class SourceLocator {
  private readonly lineStarts: number[] = [0]

  constructor(private readonly source: string) {
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] === '\n') {
        this.lineStarts.push(index + 1)
      }
    }
  }

  point(offset: number): Point {
    let low = 0
    let high = this.lineStarts.length - 1

    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const start = this.lineStarts[middle] ?? 0

      if (start <= offset) {
        low = middle + 1
      } else {
        high = middle - 1
      }
    }

    const lineIndex = Math.max(0, high)
    const lineStart = this.lineStarts[lineIndex] ?? 0

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

  position(start: number, end: number): SourcePosition {
    return this.locator.position(start, end)
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

function splitLines(source: string): SourceLine[] {
  if (source.length === 0) {
    return []
  }

  const lines: SourceLine[] = []
  let start = 0

  while (start < source.length) {
    const rawEnd = source.indexOf('\n', start)
    const hasNewline = rawEnd >= 0
    const lineEnd = hasNewline ? rawEnd : source.length
    const textEnd = lineEnd > start && source[lineEnd - 1] === '\r' ? lineEnd - 1 : lineEnd

    lines.push({
      text: source.slice(start, textEnd),
      start,
      end: textEnd,
      nextStart: hasNewline ? lineEnd + 1 : lineEnd,
      contentStart: start,
    })

    if (!hasNewline) {
      break
    }

    start = lineEnd + 1
  }

  return lines
}

function makeInlineInput(lines: SourceLine[]): InlineInput {
  const textParts: string[] = []
  const offsets: number[] = []

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      textParts.push('\n')
      offsets.push(line.start - 1)
    }

    textParts.push(line.text)
    for (let index = 0; index < line.text.length; index += 1) {
      offsets.push(line.contentStart + index)
    }
  })

  return { text: textParts.join(''), offsets }
}

function actualRange(
  offsets: number[],
  start: number,
  end: number,
  fallback: number,
): { start: number; end: number } {
  const actualStart = offsets[start] ?? fallback
  const last = offsets[Math.max(start, end - 1)] ?? actualStart

  return {
    start: actualStart,
    end: Math.max(actualStart, last + 1),
  }
}

function findClosing(text: string, marker: string, start: number): number {
  return text.indexOf(marker, start)
}

function parseInline(input: InlineInput, factory: NodeFactory): MarkdownNode[] {
  const nodes: MarkdownNode[] = []
  const { text, offsets } = input
  let index = 0
  let textStart = 0

  const flushText = (end: number) => {
    if (end <= textStart) {
      return
    }

    const range = actualRange(offsets, textStart, end, offsets[0] ?? 0)
    const value = text.slice(textStart, end)
    nodes.push(factory.node<TextNode>('text', range.start, range.end, { value }))
  }

  const beginNode = () => {
    flushText(index)
    textStart = index
  }

  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length) {
      beginNode()
      const range = actualRange(offsets, index, index + 2, offsets[0] ?? 0)
      nodes.push(
        factory.node<TextNode>('text', range.start, range.end, { value: text[index + 1] ?? '' }),
      )
      index += 2
      textStart = index
      continue
    }

    if (text[index] === '`') {
      const close = findClosing(text, '`', index + 1)
      if (close > index + 1) {
        beginNode()
        const range = actualRange(offsets, index, close + 1, offsets[0] ?? 0)
        const value = text
          .slice(index + 1, close)
          .replace(/\s+/g, ' ')
          .trim()
        nodes.push(factory.node<InlineCodeNode>('inlineCode', range.start, range.end, { value }))
        index = close + 1
        textStart = index
        continue
      }
    }

    const imageMatch = text.slice(index).match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imageMatch) {
      beginNode()
      const raw = imageMatch[0]
      const range = actualRange(offsets, index, index + raw.length, offsets[0] ?? 0)
      const target = parseLinkTarget(imageMatch[2] ?? '')
      nodes.push(
        factory.node<ImageNode>('image', range.start, range.end, {
          url: target.url,
          alt: imageMatch[1] ?? '',
          title: target.title,
        }),
      )
      index += raw.length
      textStart = index
      continue
    }

    const linkMatch = text.slice(index).match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      beginNode()
      const raw = linkMatch[0]
      const range = actualRange(offsets, index, index + raw.length, offsets[0] ?? 0)
      const labelStart = index + 1
      const labelEnd = labelStart + (linkMatch[1]?.length ?? 0)
      const labelRange = actualRange(offsets, labelStart, labelEnd, range.start)
      const target = parseLinkTarget(linkMatch[2] ?? '')
      nodes.push(
        factory.node<LinkNode>('link', range.start, range.end, {
          url: target.url,
          title: target.title,
          children: parseInline(
            {
              text: linkMatch[1] ?? '',
              offsets: offsets.slice(labelStart, labelEnd),
            },
            factory,
          ),
        }),
      )
      if (labelRange.start === labelRange.end) {
        nodes[nodes.length - 1] = factory.node<LinkNode>('link', range.start, range.end, {
          url: target.url,
          title: target.title,
          children: [],
        })
      }
      index += raw.length
      textStart = index
      continue
    }

    const marker = text.slice(index, index + 2)
    if (marker === '**' || marker === '__' || marker === '~~') {
      const close = findClosing(text, marker, index + 2)
      if (close > index + 2) {
        beginNode()
        const range = actualRange(offsets, index, close + 2, offsets[0] ?? 0)
        const inner = parseInline(
          {
            text: text.slice(index + 2, close),
            offsets: offsets.slice(index + 2, close),
          },
          factory,
        )
        const type = marker === '**' || marker === '__' ? 'strong' : 'delete'
        nodes.push(
          type === 'strong'
            ? factory.node<StrongNode>('strong', range.start, range.end, { children: inner })
            : factory.node<DeleteNode>('delete', range.start, range.end, { children: inner }),
        )
        index = close + 2
        textStart = index
        continue
      }
    }

    if (text[index] === '*' || text[index] === '_') {
      const marker = text[index]
      const close = findClosing(text, marker ?? '', index + 1)
      if (close > index + 1) {
        beginNode()
        const range = actualRange(offsets, index, close + 1, offsets[0] ?? 0)
        const inner = parseInline(
          {
            text: text.slice(index + 1, close),
            offsets: offsets.slice(index + 1, close),
          },
          factory,
        )
        nodes.push(
          factory.node<EmphasisNode>('emphasis', range.start, range.end, { children: inner }),
        )
        index = close + 1
        textStart = index
        continue
      }
    }

    index += 1
  }

  flushText(text.length)
  return nodes
}

function parseLinkTarget(value: string): { url: string; title: string | null } {
  const target = value.trim()
  const match = target.match(/^(\S+?)(?:\s+["'](.*)["'])?$/)

  return {
    url: match?.[1] ?? target,
    title: match?.[2] ?? null,
  }
}

function lineIsBlank(line: SourceLine): boolean {
  return line.text.trim() === ''
}

function headingMatch(line: SourceLine): RegExpMatchArray | null {
  return line.text.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?)\s*|[ \t]*)$/)
}

function fenceMatch(line: SourceLine): RegExpMatchArray | null {
  return line.text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
}

function listMatch(line: SourceLine): RegExpMatchArray | null {
  return line.text.match(/^([ ]*)([-+*]|\d+[.)])(?:[ \t]+(.*)|[ \t]*)$/)
}

function isBlockStarter(line: SourceLine): boolean {
  return Boolean(
    headingMatch(line) || fenceMatch(line) || line.text.match(/^ {0,3}>/) || listMatch(line),
  )
}

function contentLine(line: SourceLine, remove: number): SourceLine {
  return {
    ...line,
    text: line.text.slice(remove),
    contentStart: line.contentStart + remove,
  }
}

function parseHeading(
  line: SourceLine,
  match: RegExpMatchArray,
  factory: NodeFactory,
): HeadingNode {
  const marker = match[1] ?? '#'
  const sourceText = match[2] ?? ''
  const headingText = sourceText.replace(/[ \t]+#+[ \t]*$/, '')
  const textOffset =
    sourceText.length === 0 ? line.end : line.text.indexOf(sourceText, marker.length)
  const inlineLine: SourceLine = {
    ...line,
    text: headingText,
    contentStart: textOffset >= 0 ? line.contentStart + textOffset : line.end,
  }

  return factory.node<HeadingNode>('heading', line.start, line.end, {
    level: marker.length,
    children: parseInline(makeInlineInput([inlineLine]), factory),
  })
}

function parseFence(
  lines: SourceLine[],
  index: number,
  match: RegExpMatchArray,
  factory: NodeFactory,
): { node: CodeNode; nextIndex: number } {
  const opening = match[1] ?? '```'
  const info = (match[2] ?? '').trim()
  const marker = opening[0] ?? '`'
  const closingPattern = new RegExp(`^ {0,3}${marker}{${opening.length},}[ \\t]*$`)
  let closeIndex = -1

  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (closingPattern.test(lines[cursor]?.text ?? '')) {
      closeIndex = cursor
      break
    }
  }

  const contentLines = lines.slice(index + 1, closeIndex >= 0 ? closeIndex : lines.length)
  const value = contentLines.map((line) => line.text).join('\n')
  const end =
    closeIndex >= 0 ? (lines[closeIndex]?.end ?? lines[index]?.end ?? 0) : (lines.at(-1)?.end ?? 0)

  return {
    node: factory.node<CodeNode>('code', lines[index]?.start ?? 0, end, {
      language: info.split(/[ \t]+/)[0] || null,
      value,
      incomplete: closeIndex < 0,
    }),
    nextIndex: closeIndex >= 0 ? closeIndex + 1 : lines.length,
  }
}

function parseQuote(
  lines: SourceLine[],
  index: number,
  factory: NodeFactory,
): { node: BlockquoteNode; nextIndex: number } {
  const quoteLines: SourceLine[] = []
  let cursor = index

  while (cursor < lines.length) {
    const line = lines[cursor]
    if (!line) {
      break
    }

    const match = line.text.match(/^ {0,3}>[ \t]?/)
    if (!match) {
      break
    }

    quoteLines.push(contentLine(line, match[0].length))
    cursor += 1
  }

  const start = lines[index]?.start ?? 0
  const end = quoteLines.at(-1)?.end ?? start

  return {
    node: factory.node<BlockquoteNode>('blockquote', start, end, {
      children: parseBlocks(quoteLines, factory),
    }),
    nextIndex: cursor,
  }
}

function parseList(
  lines: SourceLine[],
  index: number,
  factory: NodeFactory,
): { node: ListNode; nextIndex: number } {
  const firstLine = lines[index]
  const firstMatch = firstLine ? listMatch(firstLine) : null
  const baseIndent = firstMatch?.[1]?.length ?? 0
  const ordered = /^\d/.test(firstMatch?.[2] ?? '')
  const startNumber = ordered ? Number.parseInt(firstMatch?.[2] ?? '1', 10) || 1 : null
  const items: ListItemNode[] = []
  let cursor = index

  while (cursor < lines.length) {
    const line = lines[cursor]
    const match = line ? listMatch(line) : null
    if (
      !line ||
      !match ||
      (match[1]?.length ?? 0) !== baseIndent ||
      /^\d/.test(match[2] ?? '') !== ordered
    ) {
      break
    }

    const markerEnd = match[0]?.indexOf(match[3] ?? '') ?? -1
    const content = match[3] ?? ''
    const contentStart =
      content.length > 0 && markerEnd >= 0 ? line.contentStart + markerEnd : line.end
    const itemLines: SourceLine[] = [
      {
        ...line,
        text: content,
        contentStart,
      },
    ]
    const itemStart = line.start
    let itemEnd = line.end
    cursor += 1

    while (cursor < lines.length) {
      const continuation = lines[cursor]
      if (!continuation || lineIsBlank(continuation)) {
        break
      }

      const continuationMatch = listMatch(continuation)
      if (
        continuationMatch &&
        (continuationMatch[1]?.length ?? 0) === baseIndent &&
        /^\d/.test(continuationMatch[2] ?? '') === ordered
      ) {
        break
      }

      const leading = continuation.text.match(/^ */)?.[0]?.length ?? 0
      if (leading <= baseIndent) {
        break
      }

      const remove = Math.min(continuation.text.length, baseIndent + 2)
      itemLines.push(contentLine(continuation, remove))
      itemEnd = continuation.end
      cursor += 1
    }

    items.push(
      factory.node<ListItemNode>('listItem', itemStart, itemEnd, {
        children: parseBlocks(itemLines, factory),
      }),
    )
  }

  const end = items.at(-1)?.position.end.offset ?? firstLine?.end ?? 0

  return {
    node: factory.node<ListNode>('list', firstLine?.start ?? 0, end, {
      ordered,
      start: startNumber,
      children: items,
    }),
    nextIndex: cursor,
  }
}

function parseBlocks(lines: SourceLine[], factory: NodeFactory): MarkdownNode[] {
  const nodes: MarkdownNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line) {
      break
    }

    if (lineIsBlank(line)) {
      index += 1
      continue
    }

    const heading = headingMatch(line)
    if (heading) {
      nodes.push(parseHeading(line, heading, factory))
      index += 1
      continue
    }

    const fence = fenceMatch(line)
    if (fence) {
      const parsed = parseFence(lines, index, fence, factory)
      nodes.push(parsed.node)
      index = parsed.nextIndex
      continue
    }

    if (/^ {0,3}>/.test(line.text)) {
      const parsed = parseQuote(lines, index, factory)
      nodes.push(parsed.node)
      index = parsed.nextIndex
      continue
    }

    if (listMatch(line)) {
      const parsed = parseList(lines, index, factory)
      nodes.push(parsed.node)
      index = parsed.nextIndex
      continue
    }

    const paragraphLines: SourceLine[] = [line]
    index += 1
    while (index < lines.length) {
      const next = lines[index]
      if (!next || lineIsBlank(next) || isBlockStarter(next)) {
        break
      }

      paragraphLines.push(next)
      index += 1
    }

    const start = paragraphLines[0]?.start ?? line.start
    const end = paragraphLines.at(-1)?.end ?? line.end
    nodes.push(
      factory.node<ParagraphNode>('paragraph', start, end, {
        children: parseInline(makeInlineInput(paragraphLines), factory),
      }),
    )
  }

  return nodes
}

export function parseMarkdown(source: string): DocumentNode {
  const factory = new NodeFactory(source)

  return factory.node<DocumentNode>('document', 0, source.length, {
    children: parseBlocks(splitLines(source), factory),
  })
}
