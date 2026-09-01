import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown } from '@markvia/core'
import { htmlRenderer } from './index'

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
})
