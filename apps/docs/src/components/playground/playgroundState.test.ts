import { describe, expect, it } from 'vite-plus/test'
import {
  createShareUrl,
  decodePlaygroundHash,
  decodePlaygroundState,
  decodeStoredPlaygroundState,
  encodePlaygroundHash,
  encodePlaygroundState,
  resolvePlaygroundState,
  serializeStoredPlaygroundState,
  type PlaygroundState,
} from './playgroundState'

const state: PlaygroundState = {
  content: '# 标题 🌿\n\n行尾没有换行',
  renderer: 'vue',
  panel: 'ast',
}

describe('playground state', () => {
  it('round trips Unicode Markdown and view settings through a URL-safe payload', () => {
    const encoded = encodePlaygroundState(state)

    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
    expect(decodePlaygroundState(encoded)).toEqual(state)
    expect(decodePlaygroundHash(encodePlaygroundHash(state))).toEqual(state)
  })

  it('serializes and validates local drafts', () => {
    expect(decodeStoredPlaygroundState(serializeStoredPlaygroundState(state))).toEqual(state)
    expect(decodeStoredPlaygroundState('{"content":"draft"}')).toBeNull()
    expect(decodeStoredPlaygroundState('not json')).toBeNull()
  })

  it('prefers a valid share state over a local draft and default state', () => {
    const localState: PlaygroundState = { ...state, renderer: 'html', panel: 'preview' }
    const resolved = resolvePlaygroundState('default', {
      hash: encodePlaygroundHash(state),
      storedValue: serializeStoredPlaygroundState(localState),
    })

    expect(resolved).toEqual({ state, source: 'share', invalidShare: false })
  })

  it('falls back when the share hash is invalid', () => {
    const localState: PlaygroundState = { ...state, renderer: 'react', panel: 'html' }
    const resolved = resolvePlaygroundState('default', {
      hash: '#playground=invalid',
      storedValue: serializeStoredPlaygroundState(localState),
    })

    expect(resolved).toEqual({ state: localState, source: 'local', invalidShare: true })
  })

  it('builds a share URL without changing the path', () => {
    const url = createShareUrl(state, 'https://docs.example.test/zh-cn/playground/?mode=demo')

    expect(url).toMatch(
      /^https:\/\/docs\.example\.test\/zh-cn\/playground\/\?mode=demo#playground=/,
    )
    expect(url ? decodePlaygroundHash(new URL(url).hash) : null).toEqual(state)
  })

  it('rejects share URLs that exceed the safe browser length budget', () => {
    const url = createShareUrl(
      { ...state, content: 'x'.repeat(20_000) },
      'https://docs.example.test/playground/',
    )

    expect(url).toBeNull()
  })
})
