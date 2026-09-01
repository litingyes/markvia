import { documentToIR, documentToIRAsync } from './ir'
import { parseMarkdown } from './parser'
import { PluginPipeline } from './plugin'
import { MarkdownStream } from './stream'
import type {
  CreateMarkdownOptions,
  MarkdownDocument,
  MarkdownPlugin,
  MarkdownRuntime,
  MarkdownStream as MarkdownStreamContract,
  Renderer,
  CodeHighlighter,
} from './types'

class MarkdownRuntimeImpl implements MarkdownRuntime {
  private readonly pipeline: PluginPipeline
  private readonly highlighter: CodeHighlighter | undefined

  constructor(options: CreateMarkdownOptions = {}) {
    this.pipeline = new PluginPipeline(options.plugins)
    this.highlighter = options.highlighter
  }

  parse(source: string): MarkdownDocument {
    return this.pipeline.document(parseMarkdown(source))
  }

  toIR(document: MarkdownDocument) {
    const options = this.highlighter ? { highlighter: this.highlighter } : {}
    return this.pipeline.ir(documentToIR(document, options))
  }

  async toIRAsync(document: MarkdownDocument) {
    const options = this.highlighter ? { highlighter: this.highlighter } : {}
    return this.pipeline.ir(await documentToIRAsync(document, options))
  }

  render<T>(source: string | MarkdownDocument, renderer: Renderer<T>): T {
    const document = typeof source === 'string' ? this.parse(source) : source
    return renderer.render(this.toIR(document))
  }

  async renderAsync<T>(source: string | MarkdownDocument, renderer: Renderer<T>): Promise<T> {
    const document = typeof source === 'string' ? this.parse(source) : source
    return renderer.render(await this.toIRAsync(document))
  }

  createStream(): MarkdownStreamContract {
    return new MarkdownStream(this)
  }

  use(plugin: MarkdownPlugin): this {
    this.pipeline.add(plugin)
    return this
  }
}

export function createMarkdown(options: CreateMarkdownOptions = {}): MarkdownRuntime {
  return new MarkdownRuntimeImpl(options)
}
