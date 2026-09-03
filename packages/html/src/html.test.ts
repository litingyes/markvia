import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown } from '@markvia/core'
import { markdownFixtures } from '../../core/test/markdown-fixtures'
import { canonicalHtml } from '../../core/test/markdown-test-utils'
import { createHTMLRenderer, htmlRenderer } from './index'
import { renderHTML } from './index'
import type { RenderDocument, RenderNode } from '@markvia/core'

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

  it('serializes style objects from highlighted code safely', () => {
    const runtime = createMarkdown({
      highlighter: {
        highlight: (code) => ({
          tokens: [{ content: code, style: { color: '#fff', backgroundColor: '#222' } }],
          blockStyle: { backgroundColor: '#111', color: '#eee' },
        }),
      },
    })
    const html = runtime.render('```ts\nconst x = 1\n```', htmlRenderer)

    expect(html).toContain('style="background-color:#111;color:#eee"')
    expect(html).toContain('style="color:#fff;background-color:#222"')
  })

  it('filters unsafe attributes and serializes every supported attribute shape', () => {
    const document = {
      kind: 'root',
      id: 'root',
      children: [
        {
          kind: 'element',
          id: 'element',
          sourceType: 'paragraph',
          position: {
            start: { offset: 0, line: 1, column: 1 },
            end: { offset: 1, line: 1, column: 2 },
          },
          tag: 'div',
          props: {
            hidden: true,
            disabled: false,
            title: null,
            'data-label': 'a&"',
            onclick: 'alert(1)',
            'bad name': 'ignored',
            style: {
              backgroundColor: '#111',
              '--custom-color': 'red',
              'bad property': 'ignored',
            },
            payload: { ignored: 'object' },
          },
          children: [],
        },
      ],
    } as unknown as RenderDocument

    const html = renderHTML(document)

    expect(html).toBe(
      '<div hidden data-label="a&amp;&quot;" style="background-color:#111;--custom-color:red"></div>',
    )
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('bad name')
    expect(html).not.toContain('payload')
  })

  it('handles raw HTML, void tags, and unsafe element names', () => {
    const raw = {
      kind: 'raw',
      id: 'raw',
      sourceType: 'html',
      position: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 1, line: 1, column: 2 },
      },
      value: '<script>x</script><iframe>x</iframe><strong>ok</strong>',
    } as unknown as RenderNode
    const document = {
      kind: 'root',
      id: 'root',
      children: [
        raw,
        {
          kind: 'element',
          id: 'img',
          sourceType: 'image',
          position: raw.position,
          tag: 'img',
          props: { alt: 'image' },
          children: [],
        },
        {
          kind: 'element',
          id: 'unsafe-tag',
          sourceType: 'html',
          position: raw.position,
          tag: 'bad.tag',
          props: {},
          children: [
            {
              kind: 'text',
              id: 'child',
              sourceType: 'text',
              position: raw.position,
              value: '<safe>',
            },
          ],
        },
      ],
    } as unknown as RenderDocument

    expect(renderHTML(document)).toContain('&lt;script&gt;')
    expect(renderHTML(document, { allowRawHtml: true })).toContain(
      '&lt;script>x&lt;/script>&lt;iframe>x&lt;/iframe><strong>ok</strong>',
    )
    expect(renderHTML(document)).toContain('<img alt="image">')
    expect(renderHTML(document)).toContain('&lt;safe&gt;')
  })
})
