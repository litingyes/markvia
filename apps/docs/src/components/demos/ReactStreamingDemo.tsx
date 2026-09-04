import { useEffect, useState } from 'react'
import { createMarkdown, type MarkdownDocument } from '@markvia/core'
import { Markdown } from '@markvia/react'
import { demoCopy, type DemoLocale } from './demoCopy'

interface Props {
  locale?: DemoLocale
}

export default function ReactStreamingDemo({ locale = 'en' }: Props) {
  const [document, setDocument] = useState<MarkdownDocument>(() => createMarkdown().parse(''))
  const copy = demoCopy[locale]
  const [status, setStatus] = useState(copy.waitingForStream)

  useEffect(() => {
    const stream = createMarkdown().createStream()
    let chunkIndex = 0

    setDocument(stream.getDocument())
    const unsubscribe = stream.subscribe((update) => {
      setDocument(update.document)
      setStatus(copy.streamUpdate(update.version, update.changes.added.length))
    })

    const timer = window.setInterval(() => {
      const chunk = copy.streamChunks[chunkIndex]
      if (chunk === undefined) {
        window.clearInterval(timer)
        stream.finish()
        setStatus(copy.streamFinished)
        return
      }

      stream.write(chunk)
      chunkIndex += 1
    }, 650)

    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [])

  return (
    <div className="my-4 rounded-xl border border-markvia-border bg-markvia-surface p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-markvia-muted">
        {copy.reactStreaming}
      </div>
      <p className="m-0 text-sm text-markvia-muted">{status}</p>
      <div className="mt-3 min-w-0 rounded-lg border border-markvia-border bg-markvia-bg p-4">
        <Markdown document={document} />
      </div>
    </div>
  )
}
