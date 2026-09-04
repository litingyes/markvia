import {
  Fragment,
  createElement,
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
} from 'react'
import {
  createMarkdown,
  type CodeHighlighter,
  type MarkdownDocument,
  type MarkdownNode,
  type MarkdownPlugin,
  type MarkdownStream,
  type RenderDocument,
  type RenderNode,
  type Renderer,
} from '@markvia/core'

export type ReactMarkdownComponent = ElementType<Record<string, unknown>>

const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

export interface ReactRendererOptions {
  components?: Partial<Record<MarkdownNode['type'] | 'document', ReactMarkdownComponent>>
}

function renderNode(
  node: RenderNode,
  components: ReactRendererOptions['components'] = {},
): ReactNode {
  if (node.kind === 'text') {
    return node.value
  }

  if (node.kind === 'raw') {
    return node.value
  }

  const children = node.children.map((child) => renderNode(child, components))
  const component = node.sourceType === 'fragment' ? undefined : components[node.sourceType]
  if (component) {
    return voidTags.has(node.tag)
      ? createElement(component, { ...node.props, key: node.id, node })
      : createElement(component, { ...node.props, key: node.id, node }, children)
  }

  return voidTags.has(node.tag)
    ? createElement(node.tag, { ...node.props, key: node.id })
    : createElement(node.tag, { ...node.props, key: node.id }, children)
}

export function renderReact(ir: RenderDocument, options: ReactRendererOptions = {}): ReactNode {
  return ir.children.map((node) => renderNode(node, options.components))
}

export function createReactRenderer(options: ReactRendererOptions = {}): Renderer<ReactNode> {
  return {
    name: 'react',
    render: (ir) => renderReact(ir, options),
  }
}

export interface MarkdownProps extends ReactRendererOptions {
  content?: string
  document?: MarkdownDocument
  stream?: MarkdownStream
  plugins?: MarkdownPlugin[]
  highlighter?: CodeHighlighter
}

interface AsyncRenderState {
  document: MarkdownDocument
  ir?: RenderDocument
  error?: unknown
}

function runtimeOptions(props: MarkdownProps) {
  return {
    ...(props.plugins ? { plugins: props.plugins } : {}),
    ...(props.highlighter ? { highlighter: props.highlighter } : {}),
  }
}

function inputCount(props: MarkdownProps): number {
  return [
    props.content !== undefined,
    props.document !== undefined,
    props.stream !== undefined,
  ].filter(Boolean).length
}

export function Markdown(props: MarkdownProps): ReactNode {
  if (inputCount(props) > 1) {
    throw new Error('Markdown accepts only one of content, document, or stream.')
  }

  const runtime = useMemo(
    () => createMarkdown(runtimeOptions(props)),
    [props.plugins, props.highlighter],
  )
  const [streamDocument, setStreamDocument] = useState<MarkdownDocument | null>(
    () => props.stream?.getDocument() ?? null,
  )
  const [asyncRender, setAsyncRender] = useState<AsyncRenderState | null>(null)

  useEffect(() => {
    if (!props.stream) {
      setStreamDocument(null)
      return
    }

    setStreamDocument(props.stream.getDocument())
    return props.stream.subscribe((update) => setStreamDocument(update.document))
  }, [props.stream])

  const parsedDocument = useMemo(() => runtime.parse(props.content ?? ''), [runtime, props.content])
  const document = props.stream
    ? (streamDocument ?? props.stream.getDocument())
    : (props.document ?? parsedDocument)
  const requiresAsyncIR = runtime.requiresAsyncIR
  const fallbackIR = useMemo(
    () => (requiresAsyncIR ? runtime.toIRFallback(document) : null),
    [document, requiresAsyncIR, runtime],
  )

  useEffect(() => {
    if (!requiresAsyncIR) {
      setAsyncRender(null)
      return
    }

    let cancelled = false
    setAsyncRender({ document })
    void runtime.toIRAsync(document).then(
      (ir) => {
        if (!cancelled) {
          setAsyncRender({ document, ir })
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setAsyncRender({ document, error })
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [document, requiresAsyncIR, runtime])

  const syncIR = useMemo(
    () => (requiresAsyncIR ? null : runtime.toIR(document)),
    [document, requiresAsyncIR, runtime],
  )

  if (requiresAsyncIR) {
    if (asyncRender?.document === document && 'error' in asyncRender) {
      throw asyncRender.error
    }

    const ir = asyncRender?.document === document && asyncRender.ir ? asyncRender.ir : fallbackIR
    return createElement(Fragment, null, renderReact(ir!, props))
  }

  return createElement(Fragment, null, renderReact(syncIR!, props))
}
