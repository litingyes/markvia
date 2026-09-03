import { describe, expect, it } from 'vite-plus/test'
import { escapeHtml, isSafeUrl } from './security'

describe('@markvia/core security', () => {
  it('escapes every HTML-sensitive character', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })

  it('preserves the fallback character branch for a replace-like input', () => {
    const replaceLike = {
      replace(_pattern: RegExp, callback: (value: string) => string) {
        return callback('safe')
      },
    }

    expect(escapeHtml(replaceLike as unknown as string)).toBe('safe')
  })

  it('accepts safe absolute and relative destinations', () => {
    expect(isSafeUrl(' https://example.com ')).toBe(true)
    expect(isSafeUrl('http://example.com')).toBe(true)
    expect(isSafeUrl('mailto:user@example.com')).toBe(true)
    expect(isSafeUrl('/docs')).toBe(true)
    expect(isSafeUrl('#section')).toBe(true)
    expect(isSafeUrl('\u0000https://example.com')).toBe(true)
  })

  it('rejects empty, protocol-relative, unsupported, and control-only URLs', () => {
    expect(isSafeUrl('')).toBe(false)
    expect(isSafeUrl(' \t\n')).toBe(false)
    expect(isSafeUrl('//example.com')).toBe(false)
    expect(isSafeUrl('ftp://example.com')).toBe(false)
    expect(isSafeUrl('java\nscript:alert(1)')).toBe(false)
    expect(isSafeUrl('\u007fjavascript:alert(1)')).toBe(false)
  })
})
