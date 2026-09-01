import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown } from '@markvia/core'
import { renderReact } from './index'

describe('@markvia/react', () => {
  it('renders the same IR semantics as HTML', () => {
    const runtime = createMarkdown()
    const markup = renderToStaticMarkup(
      renderReact(runtime.toIR(runtime.parse('# Hello\n\nworld'))),
    )

    expect(markup).toMatch(/<h1[^>]*>Hello<\/h1><p[^>]*>world<\/p>/)
  })
})
