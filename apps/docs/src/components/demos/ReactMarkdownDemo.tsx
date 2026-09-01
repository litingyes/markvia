import { useState } from 'react'
import { Markdown } from '@markvia/react'

const initialContent =
  '# Hello, Markvia\n\nEdit this **Markdown** and the React renderer updates it.'

interface Props {
  initialContent?: string
}

export default function ReactMarkdownDemo({ initialContent: contentFromProps }: Props) {
  const [content, setContent] = useState(contentFromProps ?? initialContent)

  return (
    <div className="markvia-demo">
      <div className="markvia-demo__label">React renderer</div>
      <div className="markvia-demo__controls">
        <textarea
          aria-label="React Markdown input"
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
        />
        <div className="markvia-demo__output">
          <Markdown content={content} />
        </div>
      </div>
    </div>
  )
}
