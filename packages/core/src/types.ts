import type { Extension as MdastExtension } from 'mdast-util-from-markdown'
import type { Extension as MicromarkExtension } from 'micromark-util-types'

export type NodeType =
  | 'document'
  | 'heading'
  | 'paragraph'
  | 'text'
  | 'emphasis'
  | 'strong'
  | 'delete'
  | 'inlineCode'
  | 'link'
  | 'image'
  | 'list'
  | 'listItem'
  | 'blockquote'
  | 'code'
  | 'thematicBreak'
  | 'break'
  | 'html'
  | 'definition'
  | 'table'
  | 'tableRow'
  | 'tableCell'
  | 'mathInline'
  | 'mathBlock'
  | 'diagram'

export interface Point {
  offset: number
  line: number
  column: number
}

export interface SourcePosition {
  start: Point
  end: Point
}

export interface BaseNode {
  id: string
  type: NodeType
  position: SourcePosition
}

export interface DocumentNode extends BaseNode {
  type: 'document'
  children: MarkdownNode[]
}

export interface HeadingNode extends BaseNode {
  type: 'heading'
  level: number
  children: MarkdownNode[]
}

export interface ParagraphNode extends BaseNode {
  type: 'paragraph'
  children: MarkdownNode[]
}

export interface TextNode extends BaseNode {
  type: 'text'
  value: string
}

export interface EmphasisNode extends BaseNode {
  type: 'emphasis'
  children: MarkdownNode[]
}

export interface StrongNode extends BaseNode {
  type: 'strong'
  children: MarkdownNode[]
}

export interface DeleteNode extends BaseNode {
  type: 'delete'
  children: MarkdownNode[]
}

export interface InlineCodeNode extends BaseNode {
  type: 'inlineCode'
  value: string
}

export interface LinkNode extends BaseNode {
  type: 'link'
  url: string
  title: string | null
  children: MarkdownNode[]
}

export interface ImageNode extends BaseNode {
  type: 'image'
  url: string
  alt: string
  title: string | null
}

export interface ListNode extends BaseNode {
  type: 'list'
  ordered: boolean
  start: number | null
  spread: boolean
  children: ListItemNode[]
}

export interface ListItemNode extends BaseNode {
  type: 'listItem'
  checked: boolean | null
  spread: boolean
  children: MarkdownNode[]
}

export interface BlockquoteNode extends BaseNode {
  type: 'blockquote'
  children: MarkdownNode[]
}

export interface CodeNode extends BaseNode {
  type: 'code'
  language: string | null
  meta: string | null
  value: string
  incomplete: boolean
}

export interface ThematicBreakNode extends BaseNode {
  type: 'thematicBreak'
}

export interface BreakNode extends BaseNode {
  type: 'break'
}

export interface HtmlNode extends BaseNode {
  type: 'html'
  value: string
  block: boolean
}

export interface DefinitionNode extends BaseNode {
  type: 'definition'
  identifier: string
  label: string
  url: string
  title: string | null
}

export type TableAlignment = 'left' | 'center' | 'right' | null

export interface TableNode extends BaseNode {
  type: 'table'
  alignments: TableAlignment[]
  children: TableRowNode[]
}

export interface TableRowNode extends BaseNode {
  type: 'tableRow'
  children: TableCellNode[]
}

export interface TableCellNode extends BaseNode {
  type: 'tableCell'
  children: MarkdownNode[]
}

export interface MathInlineNode extends BaseNode {
  type: 'mathInline'
  value: string
}

export interface MathBlockNode extends BaseNode {
  type: 'mathBlock'
  value: string
  meta: string | null
  incomplete: boolean
}

export interface DiagramNode extends BaseNode {
  type: 'diagram'
  language: 'mermaid'
  meta: string | null
  value: string
  incomplete: boolean
}

export type MarkdownNode =
  | HeadingNode
  | ParagraphNode
  | TextNode
  | EmphasisNode
  | StrongNode
  | DeleteNode
  | InlineCodeNode
  | LinkNode
  | ImageNode
  | ListNode
  | ListItemNode
  | BlockquoteNode
  | CodeNode
  | ThematicBreakNode
  | BreakNode
  | HtmlNode
  | DefinitionNode
  | TableNode
  | TableRowNode
  | TableCellNode
  | MathInlineNode
  | MathBlockNode
  | DiagramNode

export type MarkdownDocument = DocumentNode

export interface RenderTextNode {
  kind: 'text'
  id: string
  sourceType: RenderSourceType
  position: SourcePosition
  value: string
}

export interface RenderElementNode {
  kind: 'element'
  id: string
  sourceType: RenderSourceType
  position: SourcePosition
  tag: string
  props: Record<string, RenderPropValue>
  children: RenderNode[]
}

export interface RenderRawNode {
  kind: 'raw'
  id: string
  sourceType: 'html'
  position: SourcePosition
  value: string
}

export type RenderSourceType = NodeType | 'fragment'

export type RenderNode = RenderTextNode | RenderElementNode | RenderRawNode

export interface RenderDocument {
  kind: 'root'
  id: string
  children: RenderNode[]
}

export interface RenderStyle {
  [property: string]: string | number
}

export type RenderPropValue = string | number | boolean | RenderStyle

export interface RenderFragmentText {
  kind: 'text'
  value: string
}

export interface RenderFragmentElement {
  kind: 'element'
  tag: string
  props?: Record<string, RenderPropValue>
  children: RenderFragment[]
}

export type RenderFragment = RenderFragmentText | RenderFragmentElement

export interface HighlightToken {
  content: string
  className?: string
  style?: RenderStyle
}

export interface HighlightResult {
  tokens: HighlightToken[]
  blockStyle?: RenderStyle
}

export type HighlightOutput = HighlightToken[] | HighlightResult

export interface CodeHighlighter {
  isAsync?: boolean
  highlight(code: string, language: string | null): HighlightOutput | Promise<HighlightOutput>
}

export type ExtensionNode = MathInlineNode | MathBlockNode | DiagramNode

export interface ExtensionProvider<TNode extends ExtensionNode = ExtensionNode> {
  isAsync?: boolean
  render(node: TNode): RenderFragment | Promise<RenderFragment>
}

export interface MarkdownParserContext {
  source: string
  blockContext: boolean
  range(node: unknown): { start: number; end: number }
  createNode<T extends MarkdownNode>(
    type: T['type'],
    start: number,
    end: number,
    fields: Omit<T, 'id' | 'type' | 'position'>,
  ): T
  mapChildren(nodes: readonly unknown[], blockContext?: boolean): MarkdownNode[]
}

export interface MarkdownParserExtension {
  name: string
  syntax?: MicromarkExtension
  mdast?: MdastExtension
  mapNode?(node: unknown, context: MarkdownParserContext): MarkdownNode[] | undefined
}

export type DocumentTransform = (document: MarkdownDocument) => MarkdownDocument
export type IRTransform = (ir: RenderDocument) => RenderDocument

export interface PluginContext {
  addParserExtension(extension: MarkdownParserExtension): void
  addNodeRenderer<TNode extends ExtensionNode>(
    type: TNode['type'],
    renderer: ExtensionProvider<TNode>,
  ): void
  addDocumentTransform(transform: DocumentTransform): void
  addIRTransform(transform: IRTransform): void
}

export interface MarkdownPlugin {
  name: string
  setup?(context: PluginContext): void
  transformDocument?(document: MarkdownDocument): MarkdownDocument
  transformIR?(ir: RenderDocument): RenderDocument
}

export interface CreateMarkdownOptions {
  plugins?: MarkdownPlugin[]
  highlighter?: CodeHighlighter
}

export interface Renderer<T> {
  readonly name: string
  render(ir: RenderDocument): T
}

export interface StreamChanges {
  added: string[]
  updated: string[]
  removed: string[]
}

export interface StreamUpdate {
  version: number
  document: MarkdownDocument
  changes: StreamChanges
}

export interface MarkdownStream {
  readonly document: MarkdownDocument
  readonly finished: boolean
  write(chunk: string): void
  finish(): void
  getDocument(): MarkdownDocument
  subscribe(listener: (update: StreamUpdate) => void): () => void
  [Symbol.asyncIterator](): AsyncIterator<StreamUpdate>
}

export interface MarkdownRuntime {
  readonly requiresAsyncIR: boolean
  parse(source: string): MarkdownDocument
  toIR(document: MarkdownDocument): RenderDocument
  toIRAsync(document: MarkdownDocument): Promise<RenderDocument>
  toIRFallback(document: MarkdownDocument): RenderDocument
  render<T>(source: string | MarkdownDocument, renderer: Renderer<T>): T
  renderAsync<T>(source: string | MarkdownDocument, renderer: Renderer<T>): Promise<T>
  createStream(): MarkdownStream
  use(plugin: MarkdownPlugin): this
}
