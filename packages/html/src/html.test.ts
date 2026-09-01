import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown } from '@markvia/core'
import { markdownFixtures } from '../../core/test/markdown-fixtures'
import { canonicalHtml } from '../../core/test/markdown-test-utils'
import { createHTMLRenderer, htmlRenderer } from './index'

function withoutNodeIds(value: string): string {
  return value.replace(/ data-markvia-node-id="[^"]*"/g, '')
}

describe('@markvia/html', () => {
  it('renders the shared IR as deterministic escaped HTML', () => {
    const html = createMarkdown().render(
      '# Hello\n\n**world** & <script>alert(1)</script>',
      htmlRenderer,
    )

    expect(withoutNodeIds(html)).toBe(
      '<h1>Hello</h1><p><strong>world</strong> &amp; &lt;script&gt;alert(1)&lt;/script&gt;</p>',
    )
  })

  it('omits unsafe link destinations instead of executing them', () => {
    const html = createMarkdown().render('[run](javascript:alert(1))', htmlRenderer)

    expect(html).not.toContain('href=')
    expect(html).toContain('data-markvia-unsafe-url="true"')
    expect(html).toContain('run')
  })

  it.each(markdownFixtures)('matches the safe HTML contract for $id', (fixture) => {
    const html = createMarkdown().render(fixture.source, htmlRenderer)

    expect(canonicalHtml(html)).toBe(canonicalHtml(fixture.html))
  })

  it('supports an explicit raw HTML compatibility mode with GFM tag filtering', () => {
    const renderer = createHTMLRenderer({ allowRawHtml: true })
    const html = createMarkdown().render(
      '<strong>ok</strong> <xmp>blocked</xmp> <script>alert(1)</script>',
      renderer,
    )

    expect(canonicalHtml(html)).toBe(
      canonicalHtml(
        '<p><strong>ok</strong> &lt;xmp>blocked&lt;/xmp> &lt;script>alert(1)&lt;/script></p>',
      ),
    )
  })
})
