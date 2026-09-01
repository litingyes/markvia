export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return character
    }
  })
}

export function isSafeUrl(value: string): boolean {
  let url = ''
  for (const character of value.trim()) {
    const code = character.codePointAt(0) ?? 0
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      continue
    }
    url += character
  }

  if (url === '') {
    return false
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(url)) {
    return /^(?:https?|mailto):/i.test(url)
  }

  return !url.startsWith('//')
}
