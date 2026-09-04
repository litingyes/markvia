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
    <div className="my-4 rounded-xl border border-markvia-border bg-markvia-surface p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-markvia-muted">
        {copy.reactRenderer}
      </div>
      <div className="grid gap-3">
        <textarea
          className="min-h-32 w-full resize-y rounded-lg border border-markvia-border bg-markvia-black p-3 font-[inherit] text-sm leading-6 text-markvia-white outline-none focus-visible:outline-2 focus-visible:outline-markvia-accent focus-visible:outline-offset-2"
          aria-label={copy.reactMarkdownInput}
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
        />
        <div className="min-w-0 rounded-lg border border-markvia-border bg-markvia-bg p-4">
          <Markdown content={content} />
        </div>
      </div>
    </div>
  )
}
