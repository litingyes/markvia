import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vite-plus/test'
import { Markdown, renderVue } from './index'
import { createMarkdown } from '@markvia/core'
import { markdownFixtures } from '../../core/test/markdown-fixtures'
import { canonicalHtml } from '../../core/test/markdown-test-utils'

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
        content: '```ts\nconst x = 1\n```',
        highlighter: {
          isAsync: true,
          highlight: async (code: string) => ({ tokens: [{ content: code }] }),
        },
      }),
    )
    expect(asyncMarkup).toContain('const x = 1')
  })
})
