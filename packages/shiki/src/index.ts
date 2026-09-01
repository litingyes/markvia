import {
  bundledLanguages,
  bundledLanguagesAlias,
  createHighlighter,
  type BundledLanguage,
  type BundledTheme,
  type ThemedToken,
} from 'shiki'
import type {
  CodeHighlighter,
  HighlightOutput,
  HighlightResult,
  HighlightToken,
  RenderStyle,
} from '@markvia/core'

const defaultTheme: BundledTheme = 'vitesse-dark'

const bundledLanguageIds = new Set([
  ...Object.keys(bundledLanguages),
  ...Object.keys(bundledLanguagesAlias),
])

export interface ShikiHighlighterOptions {
  theme?: BundledTheme
}

function normalizeLanguage(language: string | null): string | null {
  const normalized = language?.trim().toLowerCase() ?? ''
  return normalized !== '' && bundledLanguageIds.has(normalized) ? normalized : null
}

function tokenStyle(token: ThemedToken): RenderStyle | undefined {
  const style: RenderStyle = {}
  if (token.color) {
    style.color = token.color
  }
  if (token.bgColor) {
    style.backgroundColor = token.bgColor
  }

  const fontStyle = Math.max(token.fontStyle ?? 0, 0)
  if ((fontStyle & 1) !== 0) {
    style.fontStyle = 'italic'
  }
  if ((fontStyle & 2) !== 0) {
    style.fontWeight = 'bold'
  }

  const decorations: string[] = []
  if ((fontStyle & 4) !== 0) {
    decorations.push('underline')
  }
  if ((fontStyle & 8) !== 0) {
    decorations.push('line-through')
  }
  if (decorations.length > 0) {
    style.textDecoration = decorations.join(' ')
  }

  return Object.keys(style).length > 0 ? style : undefined
}

function tokenToHighlightToken(token: ThemedToken): HighlightToken {
  const style = tokenStyle(token)
  return style ? { content: token.content, style } : { content: token.content }
}

function flattenTokens(lines: ThemedToken[][]): HighlightToken[] {
  const tokens: HighlightToken[] = []
  lines.forEach((line, lineIndex) => {
    tokens.push(...line.map(tokenToHighlightToken))
    if (lineIndex < lines.length - 1) {
      tokens.push({ content: '\n' })
    }
  })
  return tokens
}

function blockStyle(
  foreground: string | undefined,
  background: string | undefined,
): RenderStyle | undefined {
  const style: RenderStyle = {}
  if (foreground) {
    style.color = foreground
  }
  if (background) {
    style.backgroundColor = background
  }
  return Object.keys(style).length > 0 ? style : undefined
}

function withBlockStyle(
  tokens: HighlightToken[],
  foreground: string | undefined,
  background: string | undefined,
): HighlightOutput {
  const style = blockStyle(foreground, background)
  const result: HighlightResult = { tokens }
  if (style) {
    result.blockStyle = style
  }
  return result
}

export async function createShikiHighlighter(
  options: ShikiHighlighterOptions = {},
): Promise<CodeHighlighter> {
  const theme = options.theme ?? defaultTheme
  const highlighter = await createHighlighter({ themes: [theme], langs: [] })
  const languageLoads = new Map<string, Promise<void>>()

  const ensureLanguage = (language: string): Promise<void> => {
    const existing = languageLoads.get(language)
    if (existing) {
      return existing
    }

    const loading = highlighter
      .loadLanguage(language as BundledLanguage)
      .catch((error: unknown) => {
        languageLoads.delete(language)
        throw error
      })
    languageLoads.set(language, loading)
    return loading
  }

  return {
    isAsync: true,
    async highlight(code, language) {
      const resolvedLanguage = normalizeLanguage(language)
      if (!resolvedLanguage) {
        const plain = highlighter.codeToTokens(code, { lang: 'text', theme })
        return withBlockStyle([{ content: code }], plain.fg, plain.bg)
      }

      await ensureLanguage(resolvedLanguage)
      const highlighted = highlighter.codeToTokens(code, {
        lang: resolvedLanguage as BundledLanguage,
        theme,
      })
      return withBlockStyle(flattenTokens(highlighted.tokens), highlighted.fg, highlighted.bg)
    },
  }
}
