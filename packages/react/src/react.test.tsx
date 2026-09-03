// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { act, Component, createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createMarkdown } from '@markvia/core'
import { markdownFixtures } from '../../core/test/markdown-fixtures'
import { canonicalHtml } from '../../core/test/markdown-test-utils'
import { createReactRenderer, Markdown, renderReact } from './index'

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: undefined as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  render() {
    return this.state.error ? createElement('p', null, 'render error') : this.props.children
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('@markvia/react', () => {
  it('renders the same IR semantics as HTML', () => {
    const runtime = createMarkdown()
    const markup = renderToStaticMarkup(
      renderReact(runtime.toIR(runtime.parse('# Hello\n\nworld'))),
    )

    expect(markup).toMatch(/<h1[^>]*>Hello<\/h1><p[^>]*>world<\/p>/)
  })

  it.each(markdownFixtures)('renders the safe fixture contract for $id', (fixture) => {
    const runtime = createMarkdown()
    const markup = renderToStaticMarkup(renderReact(runtime.toIR(runtime.parse(fixture.source))))

    expect(canonicalHtml(markup)).toBe(canonicalHtml(fixture.html))
  })

  it('renders highlighted style objects and async fallbacks', () => {
    const runtime = createMarkdown({
      highlighter: {
        highlight: (code) => ({
          tokens: [{ content: code, style: { color: '#fff' } }],
          blockStyle: { backgroundColor: '#111' },
        }),
      },
    })
    const markup = renderToStaticMarkup(
      renderReact(runtime.toIR(runtime.parse('```ts\nconst x = 1\n```'))),
    )
    expect(markup).toContain('background-color:#111')
    expect(markup).toContain('color:#fff')

    const asyncMarkup = renderToStaticMarkup(
      <Markdown
        content={'```ts\nconst x = 1\n```'}
        highlighter={{
          isAsync: true,
          highlight: async (code) => ({ tokens: [{ content: code }] }),
        }}
      />,
    )
    expect(asyncMarkup).toContain('const x = 1')
  })

  it('supports custom components, void nodes, raw nodes, and the renderer factory', () => {
    const runtime = createMarkdown()
    const ir = runtime.toIR(runtime.parse('text\n\n![alt](/image.svg)\n\n<div>raw</div>'))
    const Custom = (props: { children?: ReactNode }) =>
      createElement('section', null, props.children)

    const customMarkup = renderToStaticMarkup(
      renderReact(ir, { components: { paragraph: Custom, image: Custom } }),
    )
    const factoryMarkup = renderToStaticMarkup(createReactRenderer().render(ir))

    expect(customMarkup).toContain('<section>text</section>')
    expect(factoryMarkup).toContain('&lt;div&gt;raw&lt;/div&gt;')
  })

  it('accepts document and stream inputs and rejects multiple inputs', async () => {
    const runtime = createMarkdown()
    const parsedDocument = runtime.parse('document')
    const stream = runtime.createStream()
    stream.write('stream')

    expect(() => Markdown({ content: 'content', document: parsedDocument })).toThrow('only one')
    expect(renderToStaticMarkup(<Markdown document={parsedDocument} />)).toContain('document')
    expect(renderToStaticMarkup(<Markdown stream={stream} />)).toContain('stream')

    const fallbackStream = {
      getDocument: vi
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValue(runtime.parse('fallback stream')),
      subscribe: vi.fn(() => () => undefined),
    }
    expect(renderToStaticMarkup(<Markdown stream={fallbackStream as never} />)).toContain(
      'fallback stream',
    )

    const container = globalThis.document.createElement('div')
    const root = createRoot(container)
    await act(async () => {
      root.render(<Markdown content="client" />)
    })
    expect(container.innerHTML).toContain('client')
    root.unmount()
  })

  it('subscribes to stream updates and cleans up the subscription', async () => {
    const stream = createMarkdown().createStream()
    const container = globalThis.document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(<Markdown stream={stream} />)
    })
    await act(async () => {
      stream.write('streamed')
    })
    expect(container.innerHTML).toContain('streamed')
    root.unmount()

    stream.write('after unmount')
    expect(container.innerHTML).toBe('')
  })

  it('updates async highlights, ignores stale results, and renders async errors through a boundary', async () => {
    const first = deferred<{ tokens: Array<{ content: string }> }>()
    const second = deferred<{ tokens: Array<{ content: string }> }>()
    const staleRejected = deferred<{ tokens: Array<{ content: string }> }>()
    const firstSource = '```ts\nfirst\n```'
    const secondSource = '```ts\nsecond\n```'
    const highlighter = {
      isAsync: true,
      highlight: (code: string) =>
        code === 'first'
          ? first.promise
          : code === 'stale-error'
            ? staleRejected.promise
            : second.promise,
    }
    const container = document.createElement('div')
    const root = createRoot(container)

    act(() => {
      root.render(<Markdown content={firstSource} highlighter={highlighter} />)
    })
    act(() => {
      root.render(<Markdown content={secondSource} highlighter={highlighter} />)
    })
    first.resolve({ tokens: [{ content: 'stale' }] })
    await act(async () => {
      await first.promise
    })
    expect(container.innerHTML).toContain('second')
    second.resolve({ tokens: [{ content: 'fresh' }] })
    await act(async () => {
      await second.promise
    })
    expect(container.innerHTML).toContain('fresh')

    act(() => {
      root.render(<Markdown content={'```ts\nstale-error\n```'} highlighter={highlighter} />)
    })
    act(() => {
      root.render(<Markdown content={secondSource} highlighter={highlighter} />)
    })
    staleRejected.reject(new Error('stale highlight error'))
    await act(async () => {
      await staleRejected.promise.catch(() => undefined)
    })
    root.unmount()

    const rejected = deferred<{ tokens: Array<{ content: string }> }>()
    const errorContainer = globalThis.document.createElement('div')
    const errorRoot = createRoot(errorContainer)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    act(() => {
      errorRoot.render(
        <ErrorBoundary>
          <Markdown
            content={'```ts\nerror\n```'}
            plugins={[{ name: 'plugin' }]}
            highlighter={{ isAsync: true, highlight: () => rejected.promise }}
          />
        </ErrorBoundary>,
      )
    })
    rejected.reject(new Error('highlight error'))
    await act(async () => {
      await rejected.promise.catch(() => undefined)
    })
    expect(errorContainer.innerHTML).toContain('render error')
    consoleError.mockRestore()
    errorRoot.unmount()
  })
})
