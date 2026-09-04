import {
  Fragment,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  watch,
  type Component,
  type PropType,
  type VNode,
} from 'vue'
import {
  createMarkdown,
  type CodeHighlighter,
  type MarkdownDocument,
  type MarkdownNode,
  type MarkdownPlugin,
  type MarkdownStream,
  type RenderDocument,
  type RenderNode,
} from '@markvia/core'

export type VueMarkdownComponent = Component

export interface VueRendererOptions {
  components?: Partial<Record<MarkdownNode['type'] | 'document', VueMarkdownComponent>>
}

function renderNode(
  node: RenderNode,
  components: VueRendererOptions['components'] = {},
): VNode | string {
  if (node.kind === 'text') {
    return node.value
  }

  if (node.kind === 'raw') {
    return node.value
  }

  const children = node.children.map((child) => renderNode(child, components))
  const component = node.sourceType === 'fragment' ? undefined : components[node.sourceType]
  return component
    ? h(component, { ...node.props, key: node.id, node }, { default: () => children })
    : h(node.tag, { ...node.props, key: node.id }, children)
}

export function renderVue(ir: RenderDocument, options: VueRendererOptions = {}): VNode {
  return h(
    Fragment,
    null,
    ir.children.map((node) => renderNode(node, options.components)),
  )
}

export interface MarkdownProps extends VueRendererOptions {
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

export const Markdown = defineComponent({
  name: 'MarkviaMarkdown',
  props: {
    content: String,
    document: Object as PropType<MarkdownDocument>,
    stream: Object as PropType<MarkdownStream>,
    plugins: Array as PropType<MarkdownPlugin[]>,
    highlighter: Object as PropType<CodeHighlighter>,
    components: Object as PropType<VueRendererOptions['components']>,
  },
  setup(props) {
    const inputCount = [
      props.content !== undefined,
      props.document !== undefined,
      props.stream !== undefined,
    ].filter(Boolean).length
    if (inputCount > 1) {
      throw new Error('Markdown accepts only one of content, document, or stream.')
    }

    const runtime = createMarkdown({
      ...(props.plugins ? { plugins: props.plugins } : {}),
      ...(props.highlighter ? { highlighter: props.highlighter } : {}),
    })
    const currentDocument = ref<MarkdownDocument>(
      props.document ?? runtime.parse(props.content ?? ''),
    )
    const asyncRender = ref<AsyncRenderState | null>(null)
    let asyncRequest = 0
    let unsubscribe: (() => void) | undefined

    const attachStream = (stream: MarkdownStream | undefined) => {
      unsubscribe?.()
      unsubscribe = undefined
      if (stream) {
        currentDocument.value = stream.getDocument()
        unsubscribe = stream.subscribe((update) => {
          currentDocument.value = update.document
        })
      }
    }

    watch(
      () => props.content,
      (content) => {
        if (props.stream === undefined && props.document === undefined && content !== undefined) {
          currentDocument.value = runtime.parse(content)
        }
      },
    )
    watch(
      () => props.document,
      (document) => {
        if (props.stream === undefined && document !== undefined) {
          currentDocument.value = document
        }
      },
    )
    watch(() => props.stream, attachStream, { immediate: true })
    const renderAsyncDocument = (document: MarkdownDocument) => {
      if (!runtime.requiresAsyncIR) {
        asyncRender.value = null
        return
      }

      const request = ++asyncRequest
      asyncRender.value = { document }
      void runtime.toIRAsync(document).then(
        (ir) => {
          if (request === asyncRequest) {
            asyncRender.value = { document, ir }
          }
        },
        (error: unknown) => {
          if (request === asyncRequest) {
            asyncRender.value = { document, error }
          }
        },
      )
    }

    watch(() => currentDocument.value, renderAsyncDocument, { immediate: true })
    onBeforeUnmount(() => {
      asyncRequest += 1
      unsubscribe?.()
    })

    return () => {
      const document = currentDocument.value
      if (runtime.requiresAsyncIR) {
        if (asyncRender.value?.document === document && 'error' in asyncRender.value) {
          throw asyncRender.value.error
        }

        const ir =
          asyncRender.value?.document === document && asyncRender.value.ir
            ? asyncRender.value.ir
            : runtime.toIRFallback(document)
        return renderVue(ir, props.components ? { components: props.components } : {})
      }

      const ir = runtime.toIR(document)
      return renderVue(ir, props.components ? { components: props.components } : {})
    }
  },
})
