import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown } from './runtime'
import type { DocumentNode, MathInlineNode, MarkdownParserExtension, RenderDocument } from './types'

const position = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 1, line: 1, column: 2 },
}

function documentWith(node: MathInlineNode): DocumentNode {
  return {
    id: 'document',
    type: 'document',
    position,
    children: [node],
  }
}

function mathNode(value = 'x'): MathInlineNode {
  return {
    id: 'math-inline',
    type: 'mathInline',
    position,
    value,
  }
}

describe('@markvia/core extension contracts', () => {
  it('registers parser extensions and maps custom nodes with source positions', () => {
    const extension: MarkdownParserExtension = {
      name: 'test-extension',
      mapNode(node, context) {
        if (
          typeof node !== 'object' ||
          node === null ||
          !('type' in node) ||
          node.type !== 'code' ||
          !('lang' in node) ||
          node.lang !== 'test'
        ) {
          return undefined
        }

        const range = context.range(node)
        return [
          context.createNode<MathInlineNode>('mathInline', range.start, range.end, {
            value: 'mapped',
          }),
        ]
      },
    }
    const runtime = createMarkdown({
      plugins: [{ name: 'test-plugin', setup: (context) => context.addParserExtension(extension) }],
    })

    const document = runtime.parse('```test\nvalue\n```')
    expect(document.children).toMatchObject([{ type: 'mathInline', value: 'mapped' }])
    expect(document.children[0]?.position.start.offset).toBe(0)
  })

  it('renders a structured provider fragment without exposing fragment children to components', () => {
    const runtime = createMarkdown({
      plugins: [
        {
          name: 'provider',
          setup: (context) =>
            context.addNodeRenderer('mathInline', {
              render: (node) => ({
                kind: 'element',
                tag: 'span',
                props: { class: 'math', 'data-markvia-node-id': 'provider-value' },
                children: [{ kind: 'text', value: node.value }],
              }),
            }),
        },
      ],
    })

    const ir = runtime.toIR(documentWith(mathNode()))
    const root = ir.children[0]

    expect(root).toMatchObject({
      kind: 'element',
      sourceType: 'mathInline',
      tag: 'span',
      props: { class: 'math', 'data-markvia-node-id': 'math-inline' },
      children: [{ kind: 'text', sourceType: 'fragment', value: 'x' }],
    })
  })

  it('falls back for missing, throwing, and unsafe providers', () => {
    const missing = createMarkdown()
    const throwing = createMarkdown({
      plugins: [
        {
          name: 'throwing-provider',
          setup: (context) =>
            context.addNodeRenderer('mathInline', {
              render: () => {
                throw new Error('provider failure')
              },
            }),
        },
      ],
    })
    const unsafe = createMarkdown({
      plugins: [
        {
          name: 'unsafe-provider',
          setup: (context) =>
            context.addNodeRenderer('mathInline', {
              render: () => ({
                kind: 'element',
                tag: 'script',
                children: [],
              }),
            }),
        },
      ],
    })

    const unsafeAttributes = createMarkdown({
      plugins: [
        {
          name: 'unsafe-attributes-provider',
          setup: (context) =>
            context.addNodeRenderer('mathInline', {
              render: () => ({
                kind: 'element',
                tag: 'a',
                props: {
                  onclick: 'alert(1)',
                  href: 'javascript:alert(1)',
                },
                children: [],
              }),
            }),
        },
      ],
    })

    for (const runtime of [missing, throwing, unsafe, unsafeAttributes]) {
      const node = runtime.toIR(documentWith(mathNode())).children[0]
      expect(node).toMatchObject({
        kind: 'element',
        tag: 'code',
        props: { 'data-markvia-fallback': 'math-inline' },
      })
    }
  })

  it('supports async providers, sync-path errors, and fallback IR', async () => {
    const runtime = createMarkdown({
      plugins: [
        {
          name: 'async-provider',
          setup: (context) =>
            context.addNodeRenderer('mathInline', {
              isAsync: true,
              render: async (node) => ({
                kind: 'element',
                tag: 'span',
                children: [{ kind: 'text', value: node.value }],
              }),
            }),
        },
      ],
    })
    const document = documentWith(mathNode())

    expect(runtime.requiresAsyncIR).toBe(true)
    expect(() => runtime.toIR(document)).toThrow('renderAsync')
    expect(runtime.toIRFallback(document).children[0]).toMatchObject({ tag: 'code' })

    const ir = await runtime.toIRAsync(document)
    expect(ir.children[0]).toMatchObject({ tag: 'span', sourceType: 'mathInline' })
  })

  it('rejects a provider declared async on the synchronous path', () => {
    const runtime = createMarkdown({
      plugins: [
        {
          name: 'declared-async-provider',
          setup: (context) =>
            context.addNodeRenderer('mathInline', {
              isAsync: true,
              render: () => ({ kind: 'text', value: 'sync result' }),
            }),
        },
      ],
    })

    expect(() => runtime.toIR(documentWith(mathNode()))).toThrow('renderAsync')
  })

  it('keeps IR transforms active for fallback rendering', () => {
    const runtime = createMarkdown({
      plugins: [
        {
          name: 'fallback-transform',
          transformIR: (ir): RenderDocument => ({ ...ir, id: 'fallback-ir' }),
        },
      ],
    })

    expect(runtime.toIRFallback(documentWith(mathNode())).id).toBe('fallback-ir')
  })
})
