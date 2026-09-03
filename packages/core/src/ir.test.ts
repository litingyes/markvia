import { describe, expect, it } from 'vite-plus/test'
import { documentToIR, documentToIRAsync } from './ir'
import type { CodeHighlighter, DocumentNode, MarkdownNode, NodeType } from './types'

const position = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 1, line: 1, column: 2 },
}

let nextId = 0

function node(type: NodeType, fields: Record<string, unknown> = {}): MarkdownNode {
  nextId += 1
  return { id: `${type}-${nextId}`, type, position, ...fields } as MarkdownNode
}

function sampleDocument(): DocumentNode {
  const inlineText = node('text', { value: 'text' })
  const paragraph = node('paragraph', {
    children: [
      inlineText,
      node('emphasis', { children: [node('text', { value: 'em' })] }),
      node('strong', { children: [node('text', { value: 'strong' })] }),
      node('delete', { children: [node('text', { value: 'delete' })] }),
      node('inlineCode', { value: 'inline' }),
      node('break'),
      node('link', {
        url: '/safe',
        title: 'safe title',
        children: [node('text', { value: 'safe' })],
      }),
      node('link', {
        url: 'javascript:alert(1)',
        title: null,
        children: [node('text', { value: 'unsafe' })],
      }),
      node('image', { url: '/image.svg', alt: 'safe image', title: 'image title' }),
      node('image', { url: 'javascript:alert(1)', alt: 'unsafe image', title: null }),
      node('html', { value: '<span>raw</span>', block: false }),
    ],
  })

  const tightList = node('list', {
    ordered: false,
    start: null,
    spread: false,
    children: [
      node('listItem', {
        checked: true,
        spread: false,
        children: [node('paragraph', { children: [node('text', { value: 'checked' })] })],
      }),
      node('listItem', {
        checked: false,
        spread: false,
        children: [node('paragraph', { children: [node('text', { value: 'unchecked' })] })],
      }),
    ],
  })
  const looseList = node('list', {
    ordered: true,
    start: 3,
    spread: true,
    children: [
      node('listItem', {
        checked: null,
        spread: true,
        children: [node('paragraph', { children: [node('text', { value: 'loose' })] })],
      }),
    ],
  })

  const header = node('tableRow', {
    children: [
      node('tableCell', { children: [node('text', { value: 'left' })] }),
      node('tableCell', { children: [node('text', { value: 'none' })] }),
    ],
  })
  const body = node('tableRow', {
    children: [
      node('tableCell', { children: [node('text', { value: 'body' })] }),
      node('tableCell', { children: [node('text', { value: 'missing' })] }),
    ],
  })

  return {
    id: 'document',
    type: 'document',
    position,
    children: [
      node('heading', { level: 2, children: [node('text', { value: 'heading' })] }),
      paragraph,
      tightList,
      looseList,
      node('blockquote', {
        children: [node('paragraph', { children: [node('text', { value: 'quote' })] })],
      }),
      node('code', { language: null, meta: null, value: 'plain', incomplete: false }),
      node('code', { language: 'ts', meta: 'meta', value: 'const x = 1', incomplete: true }),
      node('thematicBreak'),
      node('html', { value: '<div>block</div>', block: true }),
      node('definition', { identifier: 'docs', label: 'docs', url: '/docs', title: null }),
      node('table', { alignments: ['left', null], children: [header, body] }),
      node('table', { alignments: [], children: [] }),
      node('listItem', {
        checked: null,
        spread: false,
        children: [],
      }),
      node('tableCell', { children: [] }),
      node('tableRow', {
        children: [node('tableCell', { children: [node('text', { value: 'row' })] })],
      }),
    ],
  }
}

describe('@markvia/core IR', () => {
  it('maps every Markdown node type and context into synchronous IR', () => {
    const document = sampleDocument()
    const ir = documentToIR(document)
    const serialized = JSON.stringify(ir)

    expect(ir.id).toBe(document.id)
    expect(serialized).toContain('data-markvia-unsafe-url')
    expect(serialized).toContain('data-incomplete')
    expect(serialized).toContain('thead')
    expect(serialized).toContain('tbody')
    expect(serialized).toContain('raw')

    const orderedList = ir.children.find((child) => child.kind === 'element' && child.tag === 'ol')
    expect(orderedList).toMatchObject({ kind: 'element', props: { start: 3 } })
  })

  it('normalizes array and object highlighter results and preserves token props', () => {
    const document = sampleDocument()
    const highlighter: CodeHighlighter = {
      highlight: (code, language) =>
        language === 'ts'
          ? {
              tokens: [
                { content: code, className: 'token', style: { color: '#fff' } },
                { content: 'plain token' },
              ],
              blockStyle: { backgroundColor: '#111' },
            }
          : [{ content: code }],
    }
    const ir = documentToIR(document, { highlighter })
    const codeBlocks = ir.children.filter(
      (child) => child.kind === 'element' && child.tag === 'pre',
    )

    expect(codeBlocks).toHaveLength(2)
    expect(JSON.stringify(codeBlocks)).toContain('token')
    expect(JSON.stringify(codeBlocks)).toContain('backgroundColor')
  })

  it('rejects a Promise from the synchronous highlighter path', () => {
    const code = node('code', { language: 'ts', meta: null, value: 'code', incomplete: false })
    const highlighter: CodeHighlighter = {
      highlight: async () => [{ content: 'code' }],
    }

    expect(() =>
      documentToIR({ id: 'doc', type: 'document', position, children: [code] }, { highlighter }),
    ).toThrow('renderAsync')
  })

  it('maps asynchronous code, list, table, and fallback node paths', async () => {
    const document = sampleDocument()
    const highlighter: CodeHighlighter = {
      isAsync: true,
      highlight: async (code, language) =>
        language === 'ts'
          ? {
              tokens: [{ content: code, style: { color: '#fff' } }],
              blockStyle: { color: '#eee' },
            }
          : [{ content: code }],
    }

    const ir = await documentToIRAsync(document, { highlighter })
    const withoutHighlighter = await documentToIRAsync(document)

    expect(ir.children).toHaveLength(document.children.length - 1)
    expect(withoutHighlighter.children).toHaveLength(document.children.length - 1)
    expect(JSON.stringify(ir)).toContain('tbody')
  })
})
