import { useEffect, useState } from 'react'
import { createMarkdown, type MarkdownDocument } from '@markvia/core'
import { Markdown } from '@markvia/react'

const chunks = [
  '# Streaming Markdown',
  '\n\nThe document arrives in small chunks.',
  '\n\nThe last block can remain incomplete until the stream finishes.',
]

export default function ReactStreamingDemo() {
  const [document, setDocument] = useState<MarkdownDocument>(() => createMarkdown().parse(''))
  const [status, setStatus] = useState('等待流式输入…')

  useEffect(() => {
    const stream = createMarkdown().createStream()
    let chunkIndex = 0

    setDocument(stream.getDocument())
    const unsubscribe = stream.subscribe((update) => {
      setDocument(update.document)
      setStatus(`version ${update.version} · added ${update.changes.added.length} block(s)`)
    })

    const timer = window.setInterval(() => {
      const chunk = chunks[chunkIndex]
      if (chunk === undefined) {
        window.clearInterval(timer)
        stream.finish()
        setStatus('stream finished')
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
      <div className="markvia-demo__label">React streaming</div>
      <p className="markvia-demo__status">{status}</p>
      <div className="markvia-demo__output">
        <Markdown document={document} />
      </div>
    </div>
  )
}
