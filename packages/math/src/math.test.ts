import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown } from '@markvia/core'
import { createMathPlugin } from './index'

const newline = String.fromCharCode(10)

describe('@markvia/math', () => {
  it('is opt-in and leaves math syntax as normal Markdown by default', () => {
    const document = createMarkdown().parse(
      `before $x$${newline}${newline}$$${newline}y${newline}$$`,
    )

    expect(document.children.map((node) => node.type)).toEqual(['paragraph', 'paragraph'])
    expect(document.children[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'before $x$' }],
    })
  })

  it('parses inline, flow, and fenced math nodes', () => {
    const runtime = createMarkdown({ plugins: [createMathPlugin()] })
    const source =
      `before $x^2$ after${newline}${newline}` +
      `$$${newline}y = mx${newline}$$${newline}${newline}` +
      '```math' +
      `${newline}z${newline}` +
      '```'
    const document = runtime.parse(source)
    const paragraph = document.children[0]

    expect(paragraph).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'before ' },
        { type: 'mathInline', value: 'x^2' },
        { type: 'text', value: ' after' },
      ],
    })
    expect(document.children.slice(1)).toMatchObject([
      { type: 'mathBlock', value: 'y = mx', meta: null, incomplete: false },
      { type: 'mathBlock', value: 'z', meta: null, incomplete: false },
    ])
  })

  it('keeps escaped dollars literal and marks incomplete flow/fenced math', () => {
    const runtime = createMarkdown({ plugins: [createMathPlugin()] })
    const document = runtime.parse(`escaped \\$x\\$${newline}${newline}$$${newline}unfinished`)
    const fenced = runtime.parse('```math' + `${newline}also unfinished`)

    expect(document.children[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'escaped $x$' }],
    })
    expect(document.children[1]).toMatchObject({
      type: 'mathBlock',
      value: 'unfinished',
      incomplete: true,
    })
    expect(fenced.children[0]).toMatchObject({
      type: 'mathBlock',
      value: 'also unfinished',
      incomplete: true,
    })
  })

  it('registers a provider for both math node forms', () => {
    const runtime = createMarkdown({
      plugins: [
        createMathPlugin({
          provider: {
            render: (node) => ({
              kind: 'element',
              tag: node.type === 'mathInline' ? 'span' : 'div',
              props: { 'data-form': node.type },
              children: [{ kind: 'text', value: node.value }],
            }),
          },
        }),
      ],
    })
    const document = runtime.parse(`$x$${newline}${newline}$$${newline}y${newline}$$`)
    const ir = runtime.toIR(document)

    expect(ir.children[0]).toMatchObject({
      kind: 'element',
      tag: 'p',
      children: [{ tag: 'span', sourceType: 'mathInline' }],
    })
    expect(ir.children[1]).toMatchObject({ tag: 'div', sourceType: 'mathBlock' })
  })

  it('handles blockquotes and closure across streaming chunks', () => {
    const runtime = createMarkdown({ plugins: [createMathPlugin()] })
    const nested = runtime.parse(`> $$${newline}> x${newline}> $$`)

    expect(nested.children[0]).toMatchObject({
      type: 'blockquote',
      children: [{ type: 'mathBlock', incomplete: false }],
    })

    const stream = runtime.createStream()
    stream.write(`$$${newline}x`)
    const incomplete = stream.document.children[0]
    stream.write(`${newline}$$`)

    expect(incomplete).toMatchObject({ type: 'mathBlock', incomplete: true })
    expect(stream.document.children[0]).toMatchObject({ type: 'mathBlock', incomplete: false })
    expect(stream.document.children[0]?.id).toBe(incomplete?.id)
  })
})
