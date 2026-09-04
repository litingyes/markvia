import { mathFromMarkdown, type InlineMath, type Math as MathFlow } from 'mdast-util-math'
import type {
  ExtensionProvider,
  MathBlockNode,
  MathInlineNode,
  MarkdownParserContext,
  MarkdownParserExtension,
  MarkdownPlugin,
} from '@markvia/core'
import { math } from './micromark.js'

export type MathProvider = ExtensionProvider<MathInlineNode | MathBlockNode>

export interface MathPluginOptions {
  provider?: MathProvider
}

function isInlineMath(node: unknown): node is InlineMath {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'inlineMath' &&
    'value' in node &&
    typeof node.value === 'string'
  )
}

function isMathFlow(node: unknown): node is MathFlow {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'math' &&
    'value' in node &&
    typeof node.value === 'string'
  )
}

function isCodeNode(node: unknown): node is {
  type: 'code'
  lang?: string | null
  meta?: string | null
  value: string
} {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'code' &&
    'value' in node &&
    typeof node.value === 'string'
  )
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

  return !lines
    .slice(1)
    .map(stripBlockquotePrefix)
    .some((line) => closing.test(line))
}

function mapMathNode(node: unknown, context: MarkdownParserContext) {
  const range = context.range(node)

  if (isInlineMath(node)) {
    return [
      context.createNode<MathInlineNode>('mathInline', range.start, range.end, {
        value: node.value,
      }),
    ]
  }

  if (isMathFlow(node)) {
    return [
      context.createNode<MathBlockNode>('mathBlock', range.start, range.end, {
        meta: node.meta ?? null,
        value: node.value,
        incomplete: !isClosedMathFlow(context.source, range),
      }),
    ]
  }

  if (isCodeNode(node) && node.lang?.trim().toLowerCase() === 'math') {
    return [
      context.createNode<MathBlockNode>('mathBlock', range.start, range.end, {
        meta: node.meta ?? null,
        value: node.value,
        incomplete: isIncompleteFence(context.source, range),
      }),
    ]
  }

  return undefined
}

function isClosedMathFlow(source: string, range: { start: number; end: number }): boolean {
  const raw = source.slice(range.start, range.end)
  const lines = raw.split(/\r\n|\r|\n/)
  const opening = lines[0]?.match(/^ {0,3}(\${2,})(?:[^\r\n]*)?$/)

  if (!opening) {
    return true
  }

  const marker = opening[1]!
  const closing = new RegExp(`^ {0,3}${'\\$'}{${marker.length},}[ \\t]*$`)
  return lines
    .slice(1)
    .map(stripBlockquotePrefix)
    .some((line) => closing.test(line))
}

function stripBlockquotePrefix(line: string): string {
  return line.replace(/^(?: {0,3}> ?)+/, '')
}

function parserExtension(): MarkdownParserExtension {
  return {
    name: 'markvia-math',
    syntax: math(),
    mdast: mathFromMarkdown(),
    mapNode: mapMathNode,
  }
}

export function createMathPlugin(options: MathPluginOptions = {}): MarkdownPlugin {
  return {
    name: '@markvia/math',
    setup(context) {
      context.addParserExtension(parserExtension())
      if (options.provider) {
        context.addNodeRenderer('mathInline', options.provider)
        context.addNodeRenderer('mathBlock', options.provider)
      }
    },
  }
}
