import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const shikiMock = vi.hoisted(() => ({
  createHighlighter: vi.fn(),
  loadLanguage: vi.fn(),
  codeToTokens: vi.fn(),
}))

vi.mock('shiki', () => ({
  bundledLanguages: { typescript: {} },
  bundledLanguagesAlias: { ts: 'typescript' },
  createHighlighter: shikiMock.createHighlighter,
}))

import { createShikiHighlighter } from './index'

describe('@markvia/shiki branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps token colors, backgrounds, font styles, decorations, and newlines', async () => {
    shikiMock.loadLanguage.mockResolvedValue(undefined)
    shikiMock.codeToTokens.mockImplementation((_code: string, options: { lang: string }) =>
      options.lang === 'text'
        ? { tokens: [], fg: undefined, bg: undefined }
        : {
            tokens: [
              [
                {
                  content: 'styled',
                  color: '#fff',
                  bgColor: '#111',
                  fontStyle: 1 | 2 | 4 | 8,
                },
              ],
              [{ content: 'plain', fontStyle: 0 }],
            ],
            fg: '#222',
            bg: '#eee',
          },
    )
    shikiMock.createHighlighter.mockResolvedValue({
      loadLanguage: shikiMock.loadLanguage,
      codeToTokens: shikiMock.codeToTokens,
    })

    const highlighter = await createShikiHighlighter({ theme: 'github-light' })
    const output = await highlighter.highlight('styled\nplain', ' TS ')

    expect(output).toEqual({
      tokens: [
        {
          content: 'styled',
          style: {
            color: '#fff',
            backgroundColor: '#111',
            fontStyle: 'italic',
            fontWeight: 'bold',
            textDecoration: 'underline line-through',
          },
        },
        { content: '\n' },
        { content: 'plain' },
      ],
      blockStyle: { color: '#222', backgroundColor: '#eee' },
    })
  })

  it('falls back without a block style for empty or invalid language metadata', async () => {
    shikiMock.loadLanguage.mockResolvedValue(undefined)
    shikiMock.codeToTokens.mockReturnValue({ tokens: [], fg: undefined, bg: undefined })
    shikiMock.createHighlighter.mockResolvedValue({
      loadLanguage: shikiMock.loadLanguage,
      codeToTokens: shikiMock.codeToTokens,
    })

    const highlighter = await createShikiHighlighter()

    await expect(highlighter.highlight('plain', null)).resolves.toEqual({
      tokens: [{ content: 'plain' }],
    })
    await expect(highlighter.highlight('plain', 'unknown')).resolves.toEqual({
      tokens: [{ content: 'plain' }],
    })
  })

  it('retries a language load after a rejected load and deduplicates pending loads', async () => {
    const firstFailure = Promise.reject(new Error('load failed'))
    shikiMock.loadLanguage.mockReturnValueOnce(firstFailure).mockResolvedValueOnce(undefined)
    shikiMock.codeToTokens.mockReturnValue({
      tokens: [[{ content: 'code' }]],
      fg: undefined,
      bg: undefined,
    })
    shikiMock.createHighlighter.mockResolvedValue({
      loadLanguage: shikiMock.loadLanguage,
      codeToTokens: shikiMock.codeToTokens,
    })

    const highlighter = await createShikiHighlighter()
    await expect(highlighter.highlight('code', 'ts')).rejects.toThrow('load failed')
    await expect(highlighter.highlight('code', 'ts')).resolves.toEqual({
      tokens: [{ content: 'code' }],
    })
    expect(shikiMock.loadLanguage).toHaveBeenCalledTimes(2)
  })
})
