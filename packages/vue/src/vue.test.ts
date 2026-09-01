import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vite-plus/test'
import { Markdown } from './index'

describe('@markvia/vue', () => {
  it('renders Markdown through the shared runtime', async () => {
    const app = createSSRApp(Markdown, { content: '# Hello\n\nworld' })
    const markup = await renderToString(app)

    expect(markup).toMatch(/<h1[^>]*>Hello<\/h1><p[^>]*>world<\/p>/)
  })
})
