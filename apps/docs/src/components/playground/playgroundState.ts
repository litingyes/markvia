export type RendererTarget = 'html' | 'react' | 'vue'
export type PlaygroundPanel = 'preview' | 'html' | 'ast'

export interface PlaygroundState {
  content: string
  renderer: RendererTarget
  panel: PlaygroundPanel
}

export type PlaygroundStateSource = 'share' | 'local' | 'default'

export interface ResolvedPlaygroundState {
  state: PlaygroundState
  source: PlaygroundStateSource
  invalidShare: boolean
}

export const PLAYGROUND_STORAGE_KEY = 'markvia.playground.v1'
export const PLAYGROUND_HASH_PREFIX = '#playground='
export const MAX_SHARE_URL_LENGTH = 8_000

const renderers = new Set<RendererTarget>(['html', 'react', 'vue'])
const panels = new Set<PlaygroundPanel>(['preview', 'html', 'ast'])

function isRendererTarget(value: unknown): value is RendererTarget {
  return typeof value === 'string' && renderers.has(value as RendererTarget)
}

function isPlaygroundPanel(value: unknown): value is PlaygroundPanel {
  return typeof value === 'string' && panels.has(value as PlaygroundPanel)
}

function isPlaygroundState(value: unknown): value is PlaygroundState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>
  return (
    typeof state.content === 'string' &&
    isRendererTarget(state.renderer) &&
    isPlaygroundPanel(state.panel)
  )
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function encodePlaygroundState(state: PlaygroundState): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(state)))
}

export function decodePlaygroundState(value: string): PlaygroundState | null {
  if (!value || value.length > 32_000) return null

  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(value))
    const parsed: unknown = JSON.parse(decoded)
    return isPlaygroundState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function encodePlaygroundHash(state: PlaygroundState): string {
  return `${PLAYGROUND_HASH_PREFIX}${encodePlaygroundState(state)}`
}

export function decodePlaygroundHash(hash: string): PlaygroundState | null {
  if (!hash.startsWith(PLAYGROUND_HASH_PREFIX)) return null
  return decodePlaygroundState(hash.slice(PLAYGROUND_HASH_PREFIX.length))
}

export function serializeStoredPlaygroundState(state: PlaygroundState): string {
  return JSON.stringify(state)
}

export function decodeStoredPlaygroundState(value: string | null): PlaygroundState | null {
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)
    return isPlaygroundState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function createShareUrl(state: PlaygroundState, href: string): string | null {
  try {
    const url = new URL(href)
    url.hash = encodePlaygroundHash(state)
    const result = url.toString()
    return result.length <= MAX_SHARE_URL_LENGTH ? result : null
  } catch {
    return null
  }
}

export function resolvePlaygroundState(
  defaultContent: string,
  options: { hash?: string; storedValue?: string | null } = {},
): ResolvedPlaygroundState {
  const defaultState: PlaygroundState = {
    content: defaultContent,
    renderer: 'html',
    panel: 'preview',
  }
  const hasPlaygroundHash = options.hash?.startsWith(PLAYGROUND_HASH_PREFIX) ?? false
  const sharedState = options.hash ? decodePlaygroundHash(options.hash) : null
  if (sharedState) {
    return { state: sharedState, source: 'share', invalidShare: false }
  }

  const storedState = decodeStoredPlaygroundState(options.storedValue ?? null)
  if (storedState) {
    return { state: storedState, source: 'local', invalidShare: hasPlaygroundHash }
  }

  return { state: defaultState, source: 'default', invalidShare: hasPlaygroundHash }
}
