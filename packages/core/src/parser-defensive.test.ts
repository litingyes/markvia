import { describe, expect, it, vi } from 'vite-plus/test'
import type { Root } from 'mdast'

const { fromMarkdown } = vi.hoisted(() => ({ fromMarkdown: vi.fn() }))

vi.mock('mdast-util-from-markdown', () => ({ fromMarkdown }))

import { parseMarkdown } from './parser'

function position(start: number, end: number) {
  return {
    start: { offset: start, line: 1, column: start + 1 },
    end: { offset: end, line: 1, column: end + 1 },
  }
}

describe('@markvia/core parser defensive paths', () => {
  it('returns a readable fallback when the upstream tokenizer throws', () => {
    fromMarkdown.mockImplementationOnce(() => {
      throw new Error('tokenizer failure')
    })

    const document = parseMarkdown('**unavailable**')

    expect(document.children).toHaveLength(1)
    expect(document.children[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: '**unavailable**' }],
    })
  })

  it('returns a readable fallback when mapping the parsed root throws', () => {
    fromMarkdown.mockReturnValueOnce({ children: null } as unknown as Root)

    const document = parseMarkdown('unavailable')

    expect(document.children[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'unavailable' }],
    })
  })

  it('maps unknown nodes to text and resolves normalized references', () => {
    fromMarkdown.mockReturnValueOnce({
      children: [
        {
          type: 'container',
          children: [
            {
              type: 'definition',
              identifier: 'Guide  Link',
              label: 'Guide  Link',
              url: '/docs',
              title: null,
              position: position(0, 1),
            },
          ],
          position: position(0, 1),
        },
        {
          type: 'linkReference',
          identifier: ' guide   link ',
          label: 'guide link',
          referenceType: 'full',
          children: [{ type: 'text', value: 'docs', position: position(1, 2) }],
          position: position(1, 2),
        },
        {
          type: 'imageReference',
          identifier: 'missing',
          label: 'missing',
          referenceType: 'full',
          alt: 'missing',
          position: position(2, 3),
        },
        {
          type: 'linkReference',
          identifier: 'missing',
          label: 'missing',
          referenceType: 'full',
          children: [{ type: 'text', value: 'missing', position: position(3, 4) }],
          position: position(3, 4),
        },
        {
          type: 'custom',
          position: position(4, 5),
        },
      ],
    } as unknown as Root)

    const document = parseMarkdown('01234')

    expect(document.children.map((node) => node.type)).toEqual([
      'text',
      'link',
      'text',
      'text',
      'text',
    ])
    expect(document.children[1]).toMatchObject({ type: 'link', url: '/docs' })
    expect(document.children[2]).toMatchObject({ type: 'text', value: '2' })
  })

  it('maps a resolved image reference and handles duplicate definitions', () => {
    fromMarkdown.mockReturnValueOnce({
      children: [
        {
          type: 'definition',
          identifier: 'image',
          label: 'image',
          url: '/first.svg',
          title: 'First',
          position: position(0, 1),
        },
        {
          type: 'definition',
          identifier: 'IMAGE',
          label: 'IMAGE',
          url: '/second.svg',
          title: 'Second',
          position: position(1, 2),
        },
        {
          type: 'imageReference',
          identifier: ' image ',
          label: 'image',
          referenceType: 'full',
          alt: undefined,
          position: position(2, 3),
        },
      ],
    } as unknown as Root)

    const document = parseMarkdown('abc')

    expect(document.children[2]).toMatchObject({
      type: 'image',
      url: '/first.svg',
      alt: '',
      title: 'First',
    })
  })

  it('supports nodes without positions through the defensive range fallback', () => {
    fromMarkdown.mockReturnValueOnce({
      children: [{ type: 'custom' }],
    } as unknown as Root)

    const document = parseMarkdown('source')

    expect(document.children[0]).toMatchObject({
      type: 'text',
      value: '',
      position: { start: { offset: 0 }, end: { offset: 0 } },
    })
  })

  it('fills optional mdast fields with the contract defaults', () => {
    fromMarkdown.mockReturnValueOnce({
      children: [
        {
          type: 'list',
          ordered: true,
          children: [{ type: 'listItem', children: [] }],
        },
        {
          type: 'list',
          children: [],
        },
        {
          type: 'definition',
          identifier: 'fallback',
          url: '/fallback',
        },
        {
          type: 'image',
          url: '/image.svg',
        },
        {
          type: 'table',
          children: [],
        },
      ],
    } as unknown as Root)

    const document = parseMarkdown('source')

    expect(document.children).toHaveLength(5)
    expect(document.children[0]).toMatchObject({
      type: 'list',
      ordered: true,
      start: 1,
      spread: false,
      children: [{ type: 'listItem', checked: null, spread: false }],
    })
    expect(document.children[1]).toMatchObject({
      type: 'list',
      ordered: false,
      start: null,
      spread: false,
      children: [],
    })
    expect(document.children[2]).toMatchObject({ label: 'fallback', title: null })
    expect(document.children[3]).toMatchObject({ alt: '', title: null })
    expect(document.children[4]).toMatchObject({ type: 'table', alignments: [] })
  })

  it('supports an empty fallback document', () => {
    fromMarkdown.mockImplementationOnce(() => {
      throw new Error('tokenizer failure')
    })

    expect(parseMarkdown('').children).toEqual([])
  })
})
