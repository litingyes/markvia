import type {
  DocumentTransform,
  ExtensionNode,
  IRTransform,
  MarkdownDocument,
  MarkdownPlugin,
  MarkdownParserExtension,
  ExtensionProvider,
  PluginContext,
  RenderDocument,
} from './types'

export class PluginPipeline {
  private readonly parserExtensions: MarkdownParserExtension[] = []
  private readonly documentTransforms: DocumentTransform[] = []
  private readonly irTransforms: IRTransform[] = []
  private readonly nodeRenderers = new Map<
    ExtensionNode['type'],
    ExtensionProvider<ExtensionNode>
  >()

  private context(): PluginContext {
    return {
      addParserExtension: (extension) => this.parserExtensions.push(extension),
      addNodeRenderer: (type, renderer) => {
        this.nodeRenderers.set(type, renderer as ExtensionProvider<ExtensionNode>)
      },
      addDocumentTransform: (transform) => this.documentTransforms.push(transform),
      addIRTransform: (transform) => this.irTransforms.push(transform),
    }
  }

  constructor(plugins: MarkdownPlugin[] = []) {
    for (const plugin of plugins) {
      plugin.setup?.(this.context())
      if (plugin.transformDocument) {
        this.documentTransforms.push((document) => plugin.transformDocument?.(document) ?? document)
      }
      if (plugin.transformIR) {
        this.irTransforms.push((ir) => plugin.transformIR?.(ir) ?? ir)
      }
    }
  }

  add(plugin: MarkdownPlugin): void {
    plugin.setup?.(this.context())
    if (plugin.transformDocument) {
      this.documentTransforms.push((document) => plugin.transformDocument?.(document) ?? document)
    }
    if (plugin.transformIR) {
      this.irTransforms.push((ir) => plugin.transformIR?.(ir) ?? ir)
    }
  }

  getParserExtensions(): readonly MarkdownParserExtension[] {
    return this.parserExtensions
  }

  getNodeRenderers(): ReadonlyMap<ExtensionNode['type'], ExtensionProvider<ExtensionNode>> {
    return this.nodeRenderers
  }

  get requiresAsyncIR(): boolean {
    return [...this.nodeRenderers.values()].some((renderer) => renderer.isAsync === true)
  }

  document(document: MarkdownDocument): MarkdownDocument {
    return this.documentTransforms.reduce((current, transform) => transform(current), document)
  }

  ir(ir: RenderDocument): RenderDocument {
    return this.irTransforms.reduce((current, transform) => transform(current), ir)
  }
}
