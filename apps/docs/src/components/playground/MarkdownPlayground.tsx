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
    <div className="markvia-playground">
      <header className="markvia-playground__intro">
        <p className="markvia-playground__eyebrow">{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </header>

      <section className="markvia-playground__workspace" aria-label={copy.title}>
        <div className="markvia-playground__toolbar">
          <label className="markvia-playground__select">
            <span>{copy.presetLabel}</span>
            <select
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
            className="markvia-playground__toolbar-actions"
            role="group"
            aria-label={copy.actionsLabel}
          >
            <button
              type="button"
              className="markvia-playground__toolbar-button markvia-playground__quiet-action"
              onClick={handleReset}
            >
              {copy.reset}
            </button>
            <button
              type="button"
              className="markvia-playground__toolbar-button markvia-playground__secondary-action"
              onClick={handleCopySource}
            >
              {copy.copySource}
            </button>
            <button
              type="button"
              className="markvia-playground__toolbar-button markvia-playground__primary-action"
              onClick={handleShare}
            >
              {copy.share}
            </button>
          </div>
        </div>

        <div className="markvia-playground__controls">
          <div className="markvia-playground__editor-pane">
            <div className="markvia-playground__section-heading">
              <label htmlFor="markvia-playground-editor">{copy.editorLabel}</label>
              <span>{copy.characterCount(state.content.length)}</span>
            </div>
            <textarea
              id="markvia-playground-editor"
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

          <div className="markvia-playground__preview-pane">
            <div className="markvia-playground__section-heading">
              <span>{copy.previewLabel}</span>
              <span>{copy.renderers[state.renderer]}</span>
            </div>

            <div
              className="markvia-playground__renderer-tabs"
              role="tablist"
              aria-label={copy.rendererLabel}
            >
              {(Object.keys(copy.renderers) as RendererTarget[]).map((renderer) => (
                <button
                  key={renderer}
                  type="button"
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
              className="markvia-playground__output markvia-playground__markdown"
            >
              {renderState.error ? (
                <p className="markvia-playground__error" role="alert">
                  {errorMessage(renderState.error)}
                </p>
              ) : (
                renderPreview()
              )}
            </div>
          </div>
        </div>

        <div className="markvia-playground__inspect">
          <div className="markvia-playground__inspect-heading">
            <span>{copy.panelLabel}</span>
            <div
              className="markvia-playground__panel-tabs"
              role="tablist"
              aria-label={copy.panelLabel}
            >
              {(Object.keys(copy.panels) as PlaygroundPanel[]).map((panel) => (
                <button
                  key={panel}
                  type="button"
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
            <p className="markvia-playground__inspect-hint">
              {copy.renderers[state.renderer]} renderer ·{' '}
              {copy.characterCount(state.content.length)}
            </p>
          )}
          {state.panel === 'html' && (
            <pre className="markvia-playground__code-output" tabIndex={0}>
              <code>{renderState.html ?? ''}</code>
            </pre>
          )}
          {state.panel === 'ast' && (
            <pre className="markvia-playground__code-output" tabIndex={0}>
              <code>{snapshot}</code>
            </pre>
          )}
        </div>

        <p className="markvia-playground__feedback" role="status" aria-live="polite">
          {feedback}
        </p>
      </section>
    </div>
  )
}
