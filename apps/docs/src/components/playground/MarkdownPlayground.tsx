import { useEffect, useMemo, useState } from 'react'
import { createMarkdown, type MarkdownDocument, type RenderDocument } from '@markvia/core'
import { htmlRenderer } from '@markvia/html'
import { renderReact } from '@markvia/react'
import { type DemoLocale } from '../demos/demoCopy'
import {
  createShareUrl,
  encodePlaygroundHash,
  PLAYGROUND_STORAGE_KEY,
  resolvePlaygroundState,
  serializeStoredPlaygroundState,
  type PlaygroundPanel,
  type PlaygroundState,
  type RendererTarget,
} from './playgroundState'
import { getPlaygroundCopy } from './playgroundCopy'
import VuePreview from './VuePreview'

interface Props {
  locale?: DemoLocale
  initialContent?: string
}

interface RenderState {
  document?: MarkdownDocument
  ir?: RenderDocument
  html?: string
  error?: unknown
}

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const input = document.createElement('textarea')
  input.value = value
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.append(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Clipboard is unavailable')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function MarkdownPlayground({ locale = 'en', initialContent }: Props) {
  const copy = getPlaygroundCopy(locale)
  const defaultContent = initialContent ?? copy.defaultContent
  const defaultState = useMemo<PlaygroundState>(
    () => ({ content: defaultContent, renderer: 'html', panel: 'preview' }),
    [defaultContent],
  )
  const [state, setState] = useState<PlaygroundState>(defaultState)
  const [isHydrated, setIsHydrated] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const loadState = () => {
      let storedValue: string | null = null
      try {
        storedValue = window.localStorage.getItem(PLAYGROUND_STORAGE_KEY)
      } catch {
        // Private browsing modes can disable localStorage. The playground still works.
      }

      const resolved = resolvePlaygroundState(defaultContent, {
        hash: window.location.hash,
        storedValue,
      })
      setState(resolved.state)
      if (resolved.invalidShare) setFeedback(copy.invalidShare)
      setIsHydrated(true)
    }

    loadState()
    window.addEventListener('hashchange', loadState)
    return () => window.removeEventListener('hashchange', loadState)
  }, [copy.invalidShare, defaultContent])

  useEffect(() => {
    if (!isHydrated) return

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(PLAYGROUND_STORAGE_KEY, serializeStoredPlaygroundState(state))
      } catch {
        // The editor remains usable when browser storage is unavailable or full.
      }
    }, 200)

    return () => window.clearTimeout(timer)
  }, [isHydrated, state])

  const runtime = useMemo(() => createMarkdown(), [])
  const renderState = useMemo<RenderState>(() => {
    try {
      const document = runtime.parse(state.content)
      const ir = runtime.toIR(document)
      return { document, ir, html: htmlRenderer.render(ir) }
    } catch (error) {
      return { error }
    }
  }, [runtime, state.content])

  const selectedPreset = copy.presets.find((preset) => preset.content === state.content)?.id ?? ''
  const snapshot =
    renderState.document && renderState.ir
      ? JSON.stringify({ document: renderState.document, ir: renderState.ir }, null, 2)
      : ''

  const setRenderer = (renderer: RendererTarget) => {
    setState((current) => ({ ...current, renderer }))
    setFeedback('')
  }

  const setPanel = (panel: PlaygroundPanel) => {
    setState((current) => ({ ...current, panel }))
    setFeedback('')
  }

  const handlePreset = (id: string) => {
    const preset = copy.presets.find((item) => item.id === id)
    if (!preset) return
    setState((current) => ({ ...current, content: preset.content, panel: 'preview' }))
    setFeedback('')
  }

  const handleReset = () => {
    setState(defaultState)
    setFeedback('')
  }

  const handleCopySource = () => {
    void copyToClipboard(state.content).then(
      () => setFeedback(copy.copiedSource),
      () => setFeedback(copy.shareFailed),
    )
  }

  const handleShare = () => {
    const url = createShareUrl(state, window.location.href)
    if (!url) {
      setFeedback(copy.shareTooLong)
      return
    }

    void copyToClipboard(url).then(
      () => setFeedback(copy.copiedShare),
      () => {
        setFeedback(`${copy.shareFailed} ${encodePlaygroundHash(state)}`)
      },
    )
  }

  const renderPreview = () => {
    if (!renderState.ir || !renderState.html) return null

    if (state.renderer === 'react') {
      return renderReact(renderState.ir)
    }

    if (state.renderer === 'vue') {
      return (
        <VuePreview
          ir={renderState.ir}
          loadingLabel={copy.loadingVue}
          errorLabel={copy.vueFailed}
        />
      )
    }

    return <div dangerouslySetInnerHTML={{ __html: renderState.html }} />
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mx-auto mb-8 max-w-4xl text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-markvia-accent">
          {copy.eyebrow}
        </p>
        <h2 className="m-0 text-3xl font-bold tracking-tight text-markvia-white md:text-5xl">
          {copy.title}
        </h2>
        <p className="mx-auto mt-3 mb-0 max-w-3xl text-[1.05rem] leading-7 text-markvia-muted">
          {copy.description}
        </p>
      </header>

      <section
        className="overflow-hidden rounded-xl border border-markvia-border bg-markvia-bg shadow-xl"
        aria-label={copy.title}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-markvia-border bg-markvia-surface px-4 py-3 max-sm:items-stretch">
          <label className="grid min-w-60 gap-1 text-[0.7rem] font-bold uppercase tracking-wider text-markvia-muted max-sm:w-full">
            <span>{copy.presetLabel}</span>
            <select
              className="min-h-9 rounded-lg border border-markvia-border bg-markvia-black px-3 py-2 font-[inherit] text-markvia-white outline-none focus-visible:outline-2 focus-visible:outline-markvia-accent focus-visible:outline-offset-2"
              aria-label={copy.presetLabel}
              value={selectedPreset}
              onChange={(event) => handlePreset(event.currentTarget.value)}
            >
              <option value="">{copy.customPreset}</option>
              {copy.presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          <div
            className="ml-auto flex flex-wrap items-center justify-end gap-1 border-l border-markvia-border pl-3 max-sm:ml-0 max-sm:w-full max-sm:justify-start max-sm:border-l-0 max-sm:pl-0"
            role="group"
            aria-label={copy.actionsLabel}
          >
            <button
              type="button"
              className="min-h-9 cursor-pointer rounded-md border border-transparent bg-transparent px-3 py-2 font-[inherit] text-sm leading-tight text-markvia-muted outline-none transition-colors hover:bg-markvia-hover focus-visible:outline-2 focus-visible:outline-markvia-accent focus-visible:outline-offset-2"
              onClick={handleReset}
            >
              {copy.reset}
            </button>
            <button
              type="button"
              className="min-h-9 cursor-pointer rounded-md border border-markvia-border bg-transparent px-3 py-2 font-[inherit] text-sm leading-tight text-markvia-muted outline-none transition-colors hover:border-markvia-accent hover:bg-markvia-hover hover:text-markvia-white focus-visible:outline-2 focus-visible:outline-markvia-accent focus-visible:outline-offset-2"
              onClick={handleCopySource}
            >
              {copy.copySource}
            </button>
            <button
              type="button"
              className="min-h-9 cursor-pointer rounded-md border border-markvia-accent bg-markvia-accent px-3 py-2 font-[inherit] text-sm font-bold leading-tight text-markvia-black outline-none transition-colors hover:border-markvia-accent focus-visible:outline-2 focus-visible:outline-markvia-accent focus-visible:outline-offset-2"
              onClick={handleShare}
            >
              {copy.share}
            </button>
          </div>
        </div>

        <div className="grid gap-px bg-markvia-border md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="min-w-0 bg-markvia-bg p-4 lg:p-5">
            <div className="mb-3 flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-wider text-markvia-white">
              <label htmlFor="markvia-playground-editor">{copy.editorLabel}</label>
              <span className="text-xs font-medium normal-case tracking-normal text-markvia-subtle">
                {copy.characterCount(state.content.length)}
              </span>
            </div>
            <textarea
              id="markvia-playground-editor"
              className="block min-h-96 w-full resize-y rounded-lg border border-markvia-border bg-markvia-black p-4 font-mono text-sm leading-[1.65] text-markvia-white outline-none focus-visible:outline-2 focus-visible:outline-markvia-accent focus-visible:outline-offset-2"
              value={state.content}
              aria-label={copy.editorLabel}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => {
                const content = event.currentTarget.value
                setState((current) => ({ ...current, content }))
                setFeedback('')
              }}
            />
          </div>

          <div className="flex min-h-[28rem] min-w-0 flex-col bg-markvia-bg p-4 lg:p-5">
            <div className="mb-3 flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-wider text-markvia-white">
              <span>{copy.previewLabel}</span>
              <span className="text-xs font-medium normal-case tracking-normal text-markvia-subtle">
                {copy.renderers[state.renderer]}
              </span>
            </div>

            <div
              className="mb-3 flex flex-wrap items-center gap-0.5 rounded-lg border border-markvia-border bg-markvia-black p-1"
              role="tablist"
              aria-label={copy.rendererLabel}
            >
              {(Object.keys(copy.renderers) as RendererTarget[]).map((renderer) => (
                <button
                  key={renderer}
                  type="button"
                  className="min-h-8 cursor-pointer rounded border-0 bg-transparent px-3 py-1 font-[inherit] text-xs text-markvia-subtle outline-none hover:bg-markvia-hover hover:text-markvia-white aria-selected:bg-markvia-hover aria-selected:text-markvia-white aria-selected:shadow-sm focus-visible:outline-2 focus-visible:outline-markvia-accent focus-visible:outline-offset-2"
                  role="tab"
                  aria-selected={state.renderer === renderer}
                  aria-controls={`markvia-${renderer}-preview`}
                  onClick={() => setRenderer(renderer)}
                >
                  {copy.renderers[renderer]}
                </button>
              ))}
            </div>

            <div
              id={`markvia-${state.renderer}-preview`}
              className="m-0 min-h-[19rem] min-w-0 flex-1 overflow-auto rounded-xl border border-markvia-border bg-markvia-bg p-5 text-markvia-text [&>div>*:first-child]:mt-0 [&>div>*:last-child]:mb-0"
            >
              {renderState.error ? (
                <p className="m-0 text-markvia-error" role="alert">
                  {errorMessage(renderState.error)}
                </p>
              ) : (
                renderPreview()
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 border-t border-markvia-border bg-markvia-bg p-4 lg:p-5">
          <div className="flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-wider text-markvia-white max-sm:items-start max-sm:flex-col">
            <span>{copy.panelLabel}</span>
            <div
              className="flex flex-wrap items-center gap-0.5 rounded-lg border border-markvia-border bg-markvia-black p-1"
              role="tablist"
              aria-label={copy.panelLabel}
            >
              {(Object.keys(copy.panels) as PlaygroundPanel[]).map((panel) => (
                <button
                  key={panel}
                  type="button"
                  className="min-h-8 cursor-pointer rounded border-0 bg-transparent px-3 py-1 font-[inherit] text-xs text-markvia-subtle outline-none hover:bg-markvia-hover hover:text-markvia-white aria-selected:bg-markvia-hover aria-selected:text-markvia-white aria-selected:shadow-sm focus-visible:outline-2 focus-visible:outline-markvia-accent focus-visible:outline-offset-2"
                  role="tab"
                  aria-selected={state.panel === panel}
                  onClick={() => setPanel(panel)}
                >
                  {copy.panels[panel]}
                </button>
              ))}
            </div>
          </div>

          {state.panel === 'preview' && (
            <p className="mt-4 mb-0 text-markvia-subtle">
              {copy.renderers[state.renderer]} renderer ·{' '}
              {copy.characterCount(state.content.length)}
            </p>
          )}
          {state.panel === 'html' && (
            <pre
              className="mt-4 max-h-96 overflow-auto rounded-xl border border-markvia-border bg-markvia-black p-4 text-[0.8rem] leading-[1.6] whitespace-pre text-markvia-muted"
              tabIndex={0}
            >
              <code>{renderState.html ?? ''}</code>
            </pre>
          )}
          {state.panel === 'ast' && (
            <pre
              className="mt-4 max-h-96 overflow-auto rounded-xl border border-markvia-border bg-markvia-black p-4 text-[0.8rem] leading-[1.6] whitespace-pre text-markvia-muted"
              tabIndex={0}
            >
              <code>{snapshot}</code>
            </pre>
          )}
        </div>

        <p
          className="m-0 min-h-[1.4rem] px-4 pb-4 text-xs text-markvia-subtle"
          role="status"
          aria-live="polite"
        >
          {feedback}
        </p>
      </section>
    </div>
  )
}
