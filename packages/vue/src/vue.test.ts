// @vitest-environment happy-dom

import { createApp, createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vite-plus/test'
import { Markdown, renderVue } from './index'
import { createMarkdown, type MathInlineNode, type MarkdownParserExtension } from '@markvia/core'
import { markdownFixtures } from '../../core/test/markdown-fixtures'
import { canonicalHtml } from '../../core/test/markdown-test-utils'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function flushVue() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

const extensionParser: MarkdownParserExtension = {
  name: 'renderer-test-extension',
  mapNode(node, context) {
    if (
      typeof node !== 'object' ||
      node === null ||
      !('type' in node) ||
      node.type !== 'code' ||
      !('lang' in node) ||
      node.lang !== 'test' ||
      !('value' in node) ||
      typeof node.value !== 'string'
    ) {
      return undefined
    }

    const range = context.range(node)
    return [
      context.createNode<MathInlineNode>('mathInline', range.start, range.end, {
        value: node.value,
      }),
    ]
  },
}

describe('@markvia/vue', () => {
  it('renders Markdown through the shared runtime', async () => {
    const app = createSSRApp(Markdown, { content: '# Hello\n\nworld' })
    const markup = await renderToString(app)

    expect(markup).toMatch(/<h1[^>]*>Hello<\/h1><p[^>]*>world<\/p>/)
  })

  it.each(markdownFixtures)('renders the safe fixture contract for $id', async (fixture) => {
    const app = createSSRApp(Markdown, { content: fixture.source })
    const markup = await renderToString(app)

    expect(canonicalHtml(markup)).toBe(canonicalHtml(fixture.html))
  })

  it('renders highlighted styles and async fallbacks', async () => {
    const runtime = createMarkdown({
      highlighter: {
        highlight: (code) => ({
          tokens: [{ content: code, style: { color: '#fff' } }],
          blockStyle: { backgroundColor: '#111' },
        }),
      },
    })
    const styledMarkup = await renderToString(
      createSSRApp({
        render: () => renderVue(runtime.toIR(runtime.parse('```ts\nconst x = 1\n```'))),
      }),
    )
    expect(styledMarkup).toContain('background-color:#111')
    expect(styledMarkup).toContain('color:#fff')

    const asyncMarkup = await renderToString(
      createSSRApp(Markdown, {
        content: 'component\n\n```ts\nconst x = 1\n```',
        components: {
          paragraph: defineComponent({
            setup:
              (_, { slots }) =>
              () =>
                h('section', null, slots.default?.()),
          }),
        },
        highlighter: {
          isAsync: true,
          highlight: async (code: string) => ({ tokens: [{ content: code }] }),
        },
      }),
    )
    expect(asyncMarkup).toContain('const x = 1')
    expect(asyncMarkup).toContain('<section')
  })

  it('supports custom components and all supported Markdown inputs', async () => {
    const runtime = createMarkdown()
    const ir = runtime.toIR(runtime.parse('text\n\n![alt](/image.svg)\n\n<div>raw</div>'))
    const Custom = defineComponent({
      setup(_, { slots }) {
        return () => h('section', slots.default?.())
      },
    })
    const customMarkup = await renderToString(
      createSSRApp({
        render: () => renderVue(ir, { components: { paragraph: Custom, image: Custom } }),
      }),
    )

    const document = runtime.parse('document')
    const stream = runtime.createStream()
    stream.write('stream')
    const documentMarkup = await renderToString(createSSRApp(Markdown, { document }))
    const streamMarkup = await renderToString(createSSRApp(Markdown, { stream }))
    const componentMarkup = await renderToString(
      createSSRApp(Markdown, { content: 'component', components: { paragraph: Custom } }),
    )

    expect(customMarkup).toMatch(/<section[^>]*>text<\/section>/)
    expect(documentMarkup).toContain('document')
    expect(streamMarkup).toContain('stream')
    expect(componentMarkup).toMatch(/<section[^>]*>component<\/section>/)
  })

  it('renders extension providers through the same IR and component contract', async () => {
    const runtime = createMarkdown({
      plugins: [
        {
          name: 'renderer-test-plugin',
          setup: (context) => {
            context.addParserExtension(extensionParser)
            context.addNodeRenderer('mathInline', {
              render: (node) => ({
                kind: 'element',
                tag: 'span',
                props: { 'data-value': node.value },
                children: [{ kind: 'text', value: node.value }],
              }),
            })
          },
        },
      ],
    })
    const CustomMath = defineComponent({
      setup(_, { slots }) {
        return () => h('em', null, slots.default?.())
      },
    })
    const source = '```test\nx\n```'
    const providerMarkup = await renderToString(
      createSSRApp({
        render: () => renderVue(runtime.toIR(runtime.parse(source))),
      }),
    )
    const markup = await renderToString(
      createSSRApp({
        render: () =>
          renderVue(runtime.toIR(runtime.parse(source)), {
            components: { mathInline: CustomMath },
          }),
      }),
    )

    expect(providerMarkup).toMatch(/<span[^>]*data-value="x"[^>]*>x<\/span>/)
    expect(markup).toContain('>x</em>')
  })

  it('updates content and document props and detaches stream listeners', async () => {
    const content = ref('one')
    const contentApp = createApp(
      defineComponent({
        setup: () => () => h(Markdown, { content: content.value }),
      }),
    )
    const contentContainer = globalThis.document.createElement('div')
    contentApp.mount(contentContainer)
    content.value = 'two'
    await flushVue()
    expect(contentContainer.innerHTML).toContain('two')
    ;(content as { value: string | undefined }).value = undefined
    await flushVue()
    contentApp.unmount()

    const runtime = createMarkdown()
    const selectedDocument = ref(runtime.parse('first'))
    const documentApp = createApp(
      defineComponent({
        setup: () => () => h(Markdown, { document: selectedDocument.value }),
      }),
    )
    const documentContainer = globalThis.document.createElement('div')
    documentApp.mount(documentContainer)
    selectedDocument.value = runtime.parse('second')
    await flushVue()
    expect(documentContainer.innerHTML).toContain('second')
    ;(selectedDocument as { value: ReturnType<typeof runtime.parse> | undefined }).value = undefined
    await flushVue()
    documentApp.unmount()

    const first = runtime.createStream()
    const second = runtime.createStream()
    first.write('first stream')
    second.write('second stream')
    const selectedStream = ref(first)
    const streamApp = createApp(
      defineComponent({
        setup: () => () => h(Markdown, { stream: selectedStream.value }),
      }),
    )
    const streamContainer = globalThis.document.createElement('div')
    streamApp.mount(streamContainer)
    selectedStream.value = second
    await flushVue()
    first.write(' old listener')
    second.write(' active listener')
    await nextTick()
    expect(streamContainer.innerHTML).toContain('active listener')
    streamApp.unmount()
    second.write(' after unmount')
  })

  it('handles async highlight success, stale results, and errors', async () => {
    type HighlightResult = { tokens: Array<{ content: string }> }
    const requests = new Map<string, ReturnType<typeof deferred<HighlightResult>>>()
    const getRequest = (code: string) => {
      const current = requests.get(code)
      if (current) return current
      const created = deferred<HighlightResult>()
      requests.set(code, created)
      return created
    }
    const source = (value: string) => `~~~ts\n${value}\n~~~`
    const value = ref('first')
    const highlighter = {
      isAsync: true,
      highlight: (code: string) => getRequest(code).promise,
    }
    const app = createApp(
      defineComponent({
        setup: () => () => h(Markdown, { content: source(value.value), highlighter }),
      }),
    )
    const container = globalThis.document.createElement('div')
    app.mount(container)
    await flushVue()
    value.value = 'second'
    await flushVue()
    getRequest('first').resolve({ tokens: [{ content: 'stale' }] })
    await flushVue()
    expect(container.innerHTML).toContain('second')
    getRequest('second').resolve({ tokens: [{ content: 'fresh' }] })
    await flushVue()
    await flushVue()
    expect(container.innerHTML).toContain('fresh')

    value.value = 'stale-error'
    await flushVue()
    value.value = 'second'
    await flushVue()
    getRequest('stale-error').reject(new Error('stale highlight error'))
    await getRequest('stale-error').promise.catch(() => undefined)
    await flushVue()
    app.unmount()

    const rejected = deferred<{ tokens: Array<{ content: string }> }>()
    const errors: unknown[] = []
    const errorApp = createApp(
      defineComponent({
        setup: () => () =>
          h(Markdown, {
            content: source('error'),
            plugins: [{ name: 'plugin' }],
            highlighter: { isAsync: true, highlight: () => rejected.promise },
          }),
      }),
    )
    errorApp.config.errorHandler = (error) => errors.push(error)
    errorApp.mount(globalThis.document.createElement('div'))
    await flushVue()
    rejected.reject(new Error('highlight error'))
    await rejected.promise.catch(() => undefined)
    await flushVue()
    expect(errors.length).toBeGreaterThan(0)
    errorApp.unmount()
  })

  it('rejects multiple Markdown inputs', async () => {
    const document = createMarkdown().parse('document')

    await expect(
      renderToString(createSSRApp(Markdown, { content: 'content', document })),
    ).rejects.toThrow('only one')
  })
})
