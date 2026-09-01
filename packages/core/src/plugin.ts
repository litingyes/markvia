import type {
  DocumentTransform,
  IRTransform,
  MarkdownDocument,
  MarkdownPlugin,
  PluginContext,
  RenderDocument,
} from './types'

export class PluginPipeline {
  private readonly documentTransforms: DocumentTransform[] = []
  private readonly irTransforms: IRTransform[] = []

  constructor(plugins: MarkdownPlugin[] = []) {
    const context: PluginContext = {
      addDocumentTransform: (transform) => this.documentTransforms.push(transform),
      addIRTransform: (transform) => this.irTransforms.push(transform),
    }

    for (const plugin of plugins) {
      plugin.setup?.(context)
      if (plugin.transformDocument) {
        this.documentTransforms.push((document) => plugin.transformDocument?.(document) ?? document)
      }
      if (plugin.transformIR) {
        this.irTransforms.push((ir) => plugin.transformIR?.(ir) ?? ir)
      }
    }
  }

  add(plugin: MarkdownPlugin): void {
    const context: PluginContext = {
      addDocumentTransform: (transform) => this.documentTransforms.push(transform),
      addIRTransform: (transform) => this.irTransforms.push(transform),
    }
    plugin.setup?.(context)
    if (plugin.transformDocument) {
      this.documentTransforms.push((document) => plugin.transformDocument?.(document) ?? document)
    }
    if (plugin.transformIR) {
      this.irTransforms.push((ir) => plugin.transformIR?.(ir) ?? ir)
    }
  }

  document(document: MarkdownDocument): MarkdownDocument {
    return this.documentTransforms.reduce((current, transform) => transform(current), document)
  }

  ir(ir: RenderDocument): RenderDocument {
    return this.irTransforms.reduce((current, transform) => transform(current), ir)
  }
}
