import { useEffect, useRef, useState } from 'react'
import type { RenderDocument } from '@markvia/core'

interface Props {
  ir: RenderDocument
  loadingLabel: string
  errorLabel: string
}

export default function VuePreview({ ir, loadingLabel, errorLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let disposed = false
    let unmount: (() => void) | undefined

    setStatus('loading')
    void Promise.all([import('@markvia/vue'), import('vue')]).then(
      ([{ renderVue }, { render }]) => {
        const container = containerRef.current
        if (disposed || !container) return

        render(renderVue(ir), container)
        unmount = () => render(null, container)
        setStatus('ready')
      },
      () => {
        if (!disposed) setStatus('error')
      },
    )

    return () => {
      disposed = true
      unmount?.()
    }
  }, [ir])

  return (
    <div className="min-h-full">
      <div ref={containerRef} />
      {status === 'loading' && (
        <p className="m-0 text-markvia-subtle" role="status">
          {loadingLabel}
        </p>
      )}
      {status === 'error' && (
        <p className="m-0 text-markvia-error" role="alert">
          {errorLabel}
        </p>
      )}
    </div>
  )
}
