import { describe, expect, it } from 'vite-plus/test'
import { createShikiHighlighter } from './index'
import type { HighlightOutput } from '@markvia/core'

function tokens(output: HighlightOutput) {
  return Array.isArray(output) ? output : output.tokens
}

describe('@markvia/shiki', () => {
  it('dynamically loads languages, preserves newlines, and maps theme styles', async () => {
    const highlighter = await createShikiHighlighter()
    const source = 'const x = 1\nconsole.log(x)'
    const output = await highlighter.highlight(source, 'ts')
    const highlightedTokens = tokens(output)

    expect(highlighter.isAsync).toBe(true)
    expect(highlightedTokens.map((token) => token.content).join('')).toBe(source)
    expect(highlightedTokens.some((token) => token.style?.color)).toBe(true)
    expect(Array.isArray(output) ? undefined : output.blockStyle).toEqual({
      color: '#dbd7caee',
      backgroundColor: '#121212',
    })
  })

  it('maps Shiki font styles and supports custom themes', async () => {
    const highlighter = await createShikiHighlighter({ theme: 'github-light' })
    const output = await highlighter.highlight('# heading', 'md')
    const highlightedTokens = tokens(output)

    expect(highlightedTokens.some((token) => token.style?.fontWeight === 'bold')).toBe(true)
    expect(Array.isArray(output) ? undefined : output.blockStyle?.backgroundColor).toBe('#fff')
  })

  it('falls back to plain text for missing and unknown languages', async () => {
    const highlighter = await createShikiHighlighter()

    for (const language of [null, 'not-a-real-language']) {
      const output = await highlighter.highlight('<plain & safe>', language)
      expect(tokens(output)).toEqual([{ content: '<plain & safe>' }])
    }
  })

  it('deduplicates concurrent language loads', async () => {
    const highlighter = await createShikiHighlighter()
    const outputs = await Promise.all([
      highlighter.highlight('const a = 1', 'js'),
      highlighter.highlight('const b = 2', 'js'),
      highlighter.highlight('const c = 3', 'js'),
    ])

    expect(
      outputs.map((output) =>
        tokens(output)
          .map((token) => token.content)
          .join(''),
      ),
    ).toEqual(['const a = 1', 'const b = 2', 'const c = 3'])
  })
})
