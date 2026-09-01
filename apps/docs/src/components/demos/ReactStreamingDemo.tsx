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
    <div className="markvia-demo">
      <div className="markvia-demo__label">{copy.reactStreaming}</div>
      <p className="markvia-demo__status">{status}</p>
      <div className="markvia-demo__output">
        <Markdown document={document} />
      </div>
    </div>
  )
}
