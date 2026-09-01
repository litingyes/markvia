import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown } from '@markvia/core'
import { markdownFixtures } from '../../core/test/markdown-fixtures'
import { canonicalHtml } from '../../core/test/markdown-test-utils'
import { renderReact } from './index'

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
})
