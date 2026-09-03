import { describe, expect, it } from 'vite-plus/test'
import { createMarkdown } from './runtime'

const renderer = {
  name: 'id-renderer',
  render: (ir: { id: string }) => ir.id,
}

describe('@markvia/core runtime', () => {
  it('renders both source strings and pre-parsed documents', () => {
    const runtime = createMarkdown()
    const document = runtime.parse('document')

    expect(runtime.render('source', renderer)).toMatch(/^mv-document-/)
    expect(runtime.render(document, renderer)).toBe(document.id)
  })

  it('renders asynchronously from both source strings and documents', async () => {
    const runtime = createMarkdown()
    const document = runtime.parse('document')

    await expect(runtime.renderAsync('source', renderer)).resolves.toMatch(/^mv-document-/)
    await expect(runtime.renderAsync(document, renderer)).resolves.toBe(document.id)
  })

  it('creates a stream from the runtime', () => {
    const stream = createMarkdown().createStream()

    expect(stream.document.children).toEqual([])
    expect(stream.getDocument()).toBe(stream.document)
  })
})
