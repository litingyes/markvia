import type {
  DiagramNode,
  ExtensionProvider,
  MarkdownParserContext,
  MarkdownParserExtension,
  MarkdownPlugin,
} from '@markvia/core'

export type MermaidProvider = ExtensionProvider<DiagramNode>

export interface MermaidPluginOptions {
  provider?: MermaidProvider
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

function stripBlockquotePrefix(line: string): string {
  return line.replace(/^(?: {0,3}> ?)+/, '')
}

function mapMermaidNode(node: unknown, context: MarkdownParserContext) {
  if (!isCodeNode(node) || node.lang?.trim().toLowerCase() !== 'mermaid') {
    return undefined
  }

  const range = context.range(node)
  return [
    context.createNode<DiagramNode>('diagram', range.start, range.end, {
      language: 'mermaid',
      meta: node.meta ?? null,
      value: node.value,
      incomplete: isIncompleteFence(context.source, range),
    }),
  ]
}

function parserExtension(): MarkdownParserExtension {
  return {
    name: 'markvia-mermaid',
    mapNode: mapMermaidNode,
  }
}

export function createMermaidPlugin(options: MermaidPluginOptions = {}): MarkdownPlugin {
  return {
    name: '@markvia/mermaid',
    setup(context) {
      context.addParserExtension(parserExtension())
      if (options.provider) {
        context.addNodeRenderer('diagram', options.provider)
      }
    },
  }
}
