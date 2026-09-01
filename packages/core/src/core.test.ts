import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown, isSafeUrl } from './index'
import { markdownFixtures, requiredMarkdownFeatures } from '../test/markdown-fixtures'
import { projectDocument, walkNodes } from '../test/markdown-test-utils'

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

  it('maps token and block styles into the shared render IR', () => {
    const runtime = createMarkdown({
      highlighter: {
        highlight: (code) => ({
          tokens: [{ content: code, style: { color: '#fff', fontWeight: 'bold' } }],
          blockStyle: { backgroundColor: '#111' },
        }),
      },
    })
    const ir = runtime.toIR(runtime.parse('```ts\nconst x = 1\n```'))
    const pre = ir.children[0]

    expect(pre?.kind).toBe('element')
    if (pre?.kind === 'element') {
      expect(pre.props.style).toEqual({ backgroundColor: '#111' })
      const code = pre.children[0]
      expect(code?.kind).toBe('element')
      if (code?.kind === 'element') {
        expect(code.children[0]?.kind).toBe('element')
        if (code.children[0]?.kind === 'element') {
          expect(code.children[0].props.style).toEqual({ color: '#fff', fontWeight: 'bold' })
        }
      }
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

  it('reconciles blocks when chunks split fences, lists, tables, tasks, and delimiters', () => {
    const cases = [
      { chunks: ['```ts\nvalue', '\n```'], type: 'code' },
      { chunks: ['- [x] first\n', '- second'], type: 'list' },
      { chunks: ['| a | b |\n| --- | --- |', '\n| c | d |'], type: 'table' },
      { chunks: ['- [', ' ] todo'], type: 'list' },
      { chunks: ['**par', 'tial**'], type: 'paragraph' },
    ] as const

    for (const { chunks, type } of cases) {
      const stream = createMarkdown().createStream()
      stream.write(chunks[0])
      const first = stream.document.children[0]
      expect(first?.type).toBe(type)
      const firstId = first?.id

      stream.write(chunks[1])
      const final = stream.document.children[0]
      expect(final?.type).toBe(type)
      expect(final?.id).toBe(firstId)
    }

    const taskStream = createMarkdown().createStream()
    taskStream.write('- [')
    taskStream.write(' ] todo')
    const task = taskStream.document.children[0]
    expect(task?.type).toBe('list')
    if (task?.type === 'list') {
      expect(task.children[0]?.checked).toBe(false)
    }

    const looseStream = createMarkdown().createStream()
    const looseUpdates: Array<{ changes: { updated: string[] } }> = []
    looseStream.subscribe((update) => looseUpdates.push(update))
    looseStream.write('- one')
    const tightId = looseStream.document.children[0]?.id
    looseStream.write('\n\n- two')
    expect(looseStream.document.children[0]?.id).toBe(tightId)
    expect(looseStream.document.children[0]?.type).toBe('list')
    expect(looseUpdates[1]?.changes.updated).toContain(tightId)
  })

  it('does not throw for malformed, deeply nested, Unicode, or long-delimiter input', () => {
    const runtime = createMarkdown()
    const inputs = [
      '\u0000\ud800\udfff 你好 🌍',
      '*'.repeat(2_000) + 'text' + '*'.repeat(2_000),
      '> '.repeat(100) + 'deep quote',
      '- '.repeat(100) + '[x] item',
      '['.repeat(2_000) + '(' + '\\'.repeat(2_000),
      '```\n' + 'x\r'.repeat(500),
    ]

    for (const input of inputs) {
      expect(() => {
        const document = runtime.parse(input)
        runtime.toIR(document)
      }).not.toThrow()
    }
  }, 15_000)

  it('keeps the hand-written fixture matrix complete', () => {
    const covered = new Set(markdownFixtures.flatMap((fixture) => fixture.features))

    expect(covered).toEqual(new Set(requiredMarkdownFeatures))
  })

  it.each(markdownFixtures)('parses fixture $id without losing node semantics', (fixture) => {
    const runtime = createMarkdown()
    const document = runtime.parse(fixture.source)
    const nodes = walkNodes(document)

    expect(document.children.map((node) => node.type)).toEqual(fixture.expectedAst)
    expect(projectDocument(document)).toBeDefined()
    expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length)
    expect(() => runtime.toIR(document)).not.toThrow()
  })

  it('maps table, task-list, code metadata, and references into the AST contract', () => {
    const source =
      '~~~ts extra\nconst x = 1\n~~~\n\n- [x] done\n\n| a | b |\n| :-- | :-: |\n| c | d |\n\n[docs][guide]\n\n[guide]: /docs "Guide"'
    const document = createMarkdown().parse(source)

    expect(projectDocument(document)).toEqual([
      {
        type: 'code',
        language: 'ts',
        meta: 'extra',
        value: 'const x = 1',
        incomplete: false,
      },
      {
        type: 'list',
        ordered: false,
        start: null,
        spread: false,
        children: [
          {
            type: 'listItem',
            checked: true,
            spread: false,
            children: [{ type: 'paragraph', children: [{ type: 'text', value: 'done' }] }],
          },
        ],
      },
      {
        type: 'table',
        alignments: ['left', 'center'],
        children: [
          {
            type: 'tableRow',
            children: [
              { type: 'tableCell', children: [{ type: 'text', value: 'a' }] },
              { type: 'tableCell', children: [{ type: 'text', value: 'b' }] },
            ],
          },
          {
            type: 'tableRow',
            children: [
              { type: 'tableCell', children: [{ type: 'text', value: 'c' }] },
              { type: 'tableCell', children: [{ type: 'text', value: 'd' }] },
            ],
          },
        ],
      },
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: '/docs',
            title: 'Guide',
            children: [{ type: 'text', value: 'docs' }],
          },
        ],
      },
      {
        type: 'definition',
        identifier: 'guide',
        label: 'guide',
        url: '/docs',
        title: 'Guide',
      },
    ])
  })

  it('uses the first definition when reference labels are duplicated', () => {
    const document = createMarkdown().parse('[docs][]\n\n[docs]: /first\n[docs]: /second')
    const paragraph = document.children[0]

    expect(paragraph?.type).toBe('paragraph')
    if (paragraph?.type === 'paragraph') {
      expect(paragraph.children[0]?.type).toBe('link')
      if (paragraph.children[0]?.type === 'link') {
        expect(paragraph.children[0].url).toBe('/first')
      }
    }
  })

  it('tracks CRLF, CR, Unicode, and source positions in original offsets', () => {
    const source = '# 你好\r\n\r\n- [x] done'
    const document = createMarkdown().parse(source)
    const heading = document.children[0]
    const list = document.children[1]

    expect(heading?.position.start).toEqual({ offset: 0, line: 1, column: 1 })
    expect(heading?.position.end.line).toBe(1)
    expect(list?.position.start).toEqual({ offset: 8, line: 3, column: 1 })

    const crDocument = createMarkdown().parse('# title\r\rbody')
    expect(crDocument.children[1]?.position.start.line).toBe(3)
  })
})
