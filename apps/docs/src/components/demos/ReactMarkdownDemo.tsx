import { useState } from 'react'
import { Markdown } from '@markvia/react'
import { demoCopy, type DemoLocale } from './demoCopy'

const initialContent =
  '# Hello, Markvia\n\nEdit this **Markdown** and the React renderer updates it.'

interface Props {
  initialContent?: string
  locale?: DemoLocale
}

export default function ReactMarkdownDemo({
  initialContent: contentFromProps,
  locale = 'en',
}: Props) {
  const [content, setContent] = useState(contentFromProps ?? initialContent)
  const copy = demoCopy[locale]

  return (
    <div className="markvia-demo">
      <div className="markvia-demo__label">{copy.reactRenderer}</div>
      <div className="markvia-demo__controls">
        <textarea
          aria-label={copy.reactMarkdownInput}
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
