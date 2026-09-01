import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vite-plus/test'
import { Markdown } from './index'
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
})
