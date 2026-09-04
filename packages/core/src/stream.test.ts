import { describe, expect, it } from 'vite-plus/test'
import { MarkdownStream } from './stream'
import type { MarkdownDocument, MarkdownNode, MarkdownRuntime, NodeType } from './types'

const position = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 1, line: 1, column: 2 },
}

let nextId = 0

function node(type: NodeType, fields: Record<string, unknown> = {}): MarkdownNode {
  nextId += 1
  return { id: `${type}-${nextId}`, type, position, ...fields } as MarkdownNode
}

function document(children: MarkdownNode[], id = 'document'): MarkdownDocument {
  return { id, type: 'document', position, children }
}

function runtimeFor(snapshots: Record<string, MarkdownDocument>): MarkdownRuntime {
  return {
    requiresAsyncIR: false,
    parse: (source) => snapshots[source] ?? document([]),
    toIR: () => ({ kind: 'root', id: 'ir', children: [] }),
    toIRAsync: async () => ({ kind: 'root', id: 'ir', children: [] }),
    toIRFallback: () => ({ kind: 'root', id: 'ir', children: [] }),
    render: () => undefined,
    renderAsync: async () => undefined,
    createStream: () => {
      throw new Error('not used')
    },
    use: () => runtimeFor(snapshots),
  } as MarkdownRuntime
}

function richDocument(value: string): MarkdownDocument {
  const anchor = node('text', { value: 'anchor' })
  const paragraph = node('paragraph', {
    children: [
      anchor,
      node('inlineCode', { value: `inline-${value}` }),
      node('emphasis', { children: [node('text', { value: `em-${value}` })] }),
      node('strong', { children: [node('text', { value: `strong-${value}` })] }),
      node('delete', { children: [node('text', { value: `delete-${value}` })] }),
      node('link', {
        url: `/link-${value}`,
        title: null,
        children: [node('text', { value: 'link' })],
      }),
      node('image', { url: `/image-${value}`, alt: 'image', title: null }),
      node('break'),
    ],
  })
  const listItem = node('listItem', {
    checked: null,
    spread: false,
    children: [node('paragraph', { children: [node('text', { value: `item-${value}` })] })],
  })
  const list = node('list', {
    ordered: false,
    start: null,
    spread: false,
    children: [listItem],
  })
  const tableCell = node('tableCell', { children: [node('text', { value: `cell-${value}` })] })
  const tableRow = node('tableRow', { children: [tableCell] })
  const table = node('table', { alignments: [null], children: [tableRow] })

  return document([
    node('heading', { level: 1, children: [node('text', { value: 'heading' })] }),
    paragraph,
    list,
    node('blockquote', {
      children: [node('paragraph', { children: [node('text', { value: 'quote' })] })],
    }),
    node('code', { language: null, meta: null, value: `code-${value}`, incomplete: false }),
    node('thematicBreak'),
    node('html', { value: `<b>${value}</b>`, block: true }),
    node('definition', { identifier: 'ref', label: 'ref', url: '/ref', title: null }),
    table,
  ])
}

describe('@markvia/core stream', () => {
  it('reconciles rich nodes and reports added, updated, and removed blocks', () => {
    const first = richDocument('first')
    const removed = node('paragraph', { children: [node('text', { value: 'removed' })] })
    first.children.push(removed)
    const replacement = richDocument('second')
    const snapshots = { '': document([]), first, firstsecond: replacement }
    const stream = new MarkdownStream(runtimeFor(snapshots))
    const updates: Array<{ changes: { added: string[]; updated: string[]; removed: string[] } }> =
      []
    stream.subscribe((update) => updates.push(update))

    stream.write('first')
    stream.write('second')

    expect(updates[0]?.changes.added).toHaveLength(first.children.length)
    expect(updates[1]?.changes.updated.length).toBeGreaterThan(0)
    expect(updates[1]?.changes.removed).toContain(removed.id)
    expect(stream.document.id).toBe(first.id)
    expect(stream.document.children[1]?.id).toBe(first.children[1]?.id)
  })

  it('handles positional matches, unmatched children, and subscription removal', () => {
    const oldParagraph = node('paragraph', { children: [node('text', { value: 'old' })] })
    const newParagraph = {
      ...oldParagraph,
      children: [node('text', { value: 'new' })],
    } as MarkdownNode
    const snapshots = {
      '': document([]),
      old: document([oldParagraph]),
      oldnew: document([newParagraph, node('paragraph', { children: [] })]),
    }
    const stream = new MarkdownStream(runtimeFor(snapshots))
    let calls = 0
    const unsubscribe = stream.subscribe(() => {
      calls += 1
    })

    stream.write('old')
    unsubscribe()
    stream.write('new')
    expect(calls).toBe(1)
    expect(stream.document.children).toHaveLength(2)
  })

  it('matches ordered list blocks by their ordered signature', () => {
    const first = document([
      node('list', {
        ordered: true,
        start: 1,
        spread: false,
        children: [],
      }),
    ])
    const second = document([
      node('list', {
        ordered: true,
        start: 1,
        spread: false,
        children: [],
      }),
    ])
    const stream = new MarkdownStream(
      runtimeFor({ '': document([]), first: first, firstsecond: second }),
    )

    stream.write('first')
    stream.write('second')

    expect(stream.document.children[0]?.type).toBe('list')
  })

  it('ignores empty chunks and makes finish idempotent', () => {
    const stream = new MarkdownStream(runtimeFor({ '': document([]), value: document([]) }))

    stream.write('')
    expect(stream.document.children).toEqual([])
    stream.finish()
    stream.finish()
    expect(stream.finished).toBe(true)
    expect(() => stream.write('value')).toThrow('finished')
  })

  it('delivers queued and pending async iterator updates', async () => {
    const snapshots = { '': document([]), one: document([node('paragraph', { children: [] })]) }
    const stream = new MarkdownStream(runtimeFor(snapshots))
    const iterator = stream[Symbol.asyncIterator]()
    const pending = iterator.next()
    stream.write('one')
    await expect(pending).resolves.toMatchObject({ done: false, value: { version: 1 } })

    stream.write('one')
    await expect(iterator.next()).resolves.toMatchObject({ done: false, value: { version: 2 } })
    stream.finish()
    await expect(iterator.next()).resolves.toEqual({ done: true, value: undefined })
  })

  it('resolves pending iterators when the stream finishes', async () => {
    const stream = new MarkdownStream(runtimeFor({ '': document([]) }))
    const pending = stream[Symbol.asyncIterator]().next()

    stream.finish()

    await expect(pending).resolves.toEqual({ done: true, value: undefined })
  })
})
