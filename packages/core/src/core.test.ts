import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown, isSafeUrl } from './index'

describe('@markvia/core', () => {
  it('parses the supported Markdown subset into semantic nodes with positions', () => {
    const runtime = createMarkdown()
    const document = runtime.parse(
      '# Hello\n\nThis is **bold** and *em*.\n\n- one\n- two\n\n> quote\n\n```ts\nconst x = 1\n```',
    )

    expect(document.children.map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'blockquote',
      'code',
    ])

    const heading = document.children[0]
    expect(heading?.type).toBe('heading')
    expect(heading?.position.start).toEqual({ offset: 0, line: 1, column: 1 })
    expect(heading?.position.end.line).toBe(1)

    const paragraph = document.children[1]
    expect(paragraph?.type).toBe('paragraph')
    if (paragraph?.type === 'paragraph') {
      expect(paragraph.children.map((node) => node.type)).toEqual([
        'text',
        'strong',
        'text',
        'emphasis',
        'text',
      ])
    }

    const code = document.children[4]
    expect(code?.type).toBe('code')
    if (code?.type === 'code') {
      expect(code.language).toBe('ts')
      expect(code.value).toBe('const x = 1')
      expect(code.incomplete).toBe(false)
    }
  })

  it('treats unfinished fenced blocks as safe incomplete code', () => {
    const document = createMarkdown().parse('```ts\nconst x = 1')
    const code = document.children[0]

    expect(code?.type).toBe('code')
    if (code?.type === 'code') {
      expect(code.incomplete).toBe(true)
      expect(code.value).toBe('const x = 1')
    }
  })

  it('rejects dangerous URL schemes', () => {
    expect(isSafeUrl('https://example.com')).toBe(true)
    expect(isSafeUrl('/docs')).toBe(true)
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('java\nscript:alert(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('runs document and IR plugin transforms in registration order', () => {
    const runtime = createMarkdown({
      plugins: [
        {
          name: 'document-transform',
          transformDocument: (document) => ({
            ...document,
            children: document.children.slice(0, 1),
          }),
        },
        {
          name: 'ir-transform',
          transformIR: (ir) => ({ ...ir, id: 'transformed-root' }),
        },
      ],
    })

    const document = runtime.parse('one\n\ntwo')
    const ir = runtime.toIR(document)

    expect(document.children).toHaveLength(1)
    expect(ir.id).toBe('transformed-root')
  })

  it('supports async highlighters only through the async IR path', async () => {
    const runtime = createMarkdown({
      highlighter: {
        highlight: async (code) => [{ content: code, className: 'token-code' }],
      },
    })
    const document = runtime.parse('```ts\nconst x = 1\n```')

    expect(() => runtime.toIR(document)).toThrow('renderAsync')
    const ir = await runtime.toIRAsync(document)
    const code = ir.children[0]

    expect(code?.kind).toBe('element')
    if (code?.kind === 'element') {
      expect(code.children[0]?.kind).toBe('element')
    }
  })

  it('keeps block node IDs stable while streaming append-only content', () => {
    const stream = createMarkdown().createStream()
    const updates: number[] = []
    stream.subscribe((update) => updates.push(update.version))

    stream.write('hello')
    const firstId = stream.document.children[0]?.id
    stream.write(' world\n\nsecond')

    expect(firstId).toBeDefined()
    expect(stream.document.children[0]?.id).toBe(firstId)
    expect(stream.document.children).toHaveLength(2)
    expect(updates).toEqual([1, 2])

    stream.finish()
    expect(stream.finished).toBe(true)
    expect(() => stream.write('!')).toThrow('finished')
  })
})
