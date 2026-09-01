import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown } from '@markvia/core'
import { markdownFixtures } from '../../core/test/markdown-fixtures'
import { canonicalHtml } from '../../core/test/markdown-test-utils'
import { Markdown, renderReact } from './index'

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
})
