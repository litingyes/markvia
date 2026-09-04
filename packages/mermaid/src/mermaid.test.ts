import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown } from '@markvia/core'
import { createMermaidPlugin } from './index'

const newline = String.fromCharCode(10)

describe('@markvia/mermaid', () => {
  it('is opt-in and keeps Mermaid fences as code by default', () => {
    const document = createMarkdown().parse(`\`\`\`mermaid${newline}graph TD${newline}\`\`\``)

    expect(document.children[0]).toMatchObject({ type: 'code', language: 'mermaid' })
  })

  it('maps Mermaid fences to a diagram node and preserves metadata', () => {
    const runtime = createMarkdown({ plugins: [createMermaidPlugin()] })
    const document = runtime.parse(
      `\`\`\`MERMAID extra${newline}graph TD${newline}A --> B${newline}\`\`\``,
    )

    expect(document.children[0]).toMatchObject({
      type: 'diagram',
      language: 'mermaid',
      meta: 'extra',
      value: `graph TD${newline}A --> B`,
      incomplete: false,
    })
  })

  it('marks an unfinished Mermaid fence and supports a provider', () => {
    const runtime = createMarkdown({
      plugins: [
        createMermaidPlugin({
          provider: {
            render: (node) => ({
              kind: 'element',
              tag: 'svg',
              props: { 'data-language': node.language },
              children: [{ kind: 'text', value: node.value }],
            }),
          },
        }),
      ],
    })
    const document = runtime.parse(`\`\`\`mermaid${newline}graph TD`)
    const ir = runtime.toIR(document)

    expect(document.children[0]).toMatchObject({ type: 'diagram', incomplete: true })
    expect(ir.children[0]).toMatchObject({
      kind: 'element',
      tag: 'svg',
      sourceType: 'diagram',
    })
  })

  it('leaves non-Mermaid code fences unchanged', () => {
    const runtime = createMarkdown({ plugins: [createMermaidPlugin()] })
    const document = runtime.parse(`\`\`\`graphviz${newline}digraph G {}${newline}\`\`\``)

    expect(document.children[0]).toMatchObject({ type: 'code', language: 'graphviz' })
  })

  it('handles nested fences and closure across streaming chunks', () => {
    const runtime = createMarkdown({ plugins: [createMermaidPlugin()] })
    const nested = runtime.parse(`> \`\`\`mermaid${newline}> graph TD${newline}> \`\`\``)

    expect(nested.children[0]).toMatchObject({
      type: 'blockquote',
      children: [{ type: 'diagram', incomplete: false }],
    })

    const stream = runtime.createStream()
    stream.write(`\`\`\`mermaid${newline}graph TD`)
    const incomplete = stream.document.children[0]
    stream.write(`${newline}\`\`\``)

    expect(incomplete).toMatchObject({ type: 'diagram', incomplete: true })
    expect(stream.document.children[0]).toMatchObject({ type: 'diagram', incomplete: false })
    expect(stream.document.children[0]?.id).toBe(incomplete?.id)
  })
})
