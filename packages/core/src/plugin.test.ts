import { describe, expect, it } from 'vite-plus/test'
import { PluginPipeline } from './plugin'
import { createMarkdown } from './runtime'

describe('@markvia/core plugins', () => {
  it('runs setup registrations and falls back when transforms return undefined', () => {
    const runtime = createMarkdown({
      plugins: [
        {
          name: 'setup-plugin',
          setup: (context) => {
            context.addDocumentTransform((document) => ({ ...document, id: 'setup-document' }))
            context.addIRTransform((ir) => ({ ...ir, id: 'setup-ir' }))
          },
          transformDocument: () => undefined as never,
          transformIR: () => undefined as never,
        },
        { name: 'empty-plugin' },
      ],
    })

    expect(runtime.parse('content').id).toBe('setup-document')
    expect(runtime.toIR(runtime.parse('content')).id).toBe('setup-ir')
  })

  it('adds a plugin after construction and keeps the fluent runtime', () => {
    const runtime = createMarkdown()
    const result = runtime.use({
      name: 'late-plugin',
      setup: (context) => {
        context.addDocumentTransform((document) => ({ ...document, id: 'late-document' }))
        context.addIRTransform((ir) => ({ ...ir, id: 'late-setup-ir' }))
      },
      transformIR: (ir) => ({ ...ir, id: 'late-ir' }),
    })

    expect(result).toBe(runtime)
    expect(runtime.parse('content').id).toBe('late-document')
    expect(runtime.toIR(runtime.parse('content')).id).toBe('late-ir')
  })

  it('runs transforms registered through the pipeline add method', () => {
    const pipeline = new PluginPipeline()
    pipeline.add({
      name: 'added-plugin',
      transformDocument: (document) => ({ ...document, id: 'added-document' }),
      transformIR: (ir) => ({ ...ir, id: 'added-ir' }),
    })

    expect(
      pipeline.document({ id: 'document', type: 'document', position: {}, children: [] } as never)
        .id,
    ).toBe('added-document')
    expect(pipeline.ir({ id: 'ir', kind: 'root', children: [] })).toMatchObject({ id: 'added-ir' })

    pipeline.add({
      name: 'document-only-plugin',
      transformDocument: (document) => document,
    })
    pipeline.add({
      name: 'undefined-plugin',
      transformDocument: () => undefined as never,
      transformIR: () => undefined as never,
    })

    expect(
      pipeline.document({ id: 'document', type: 'document', position: {}, children: [] } as never)
        .id,
    ).toBe('added-document')
    expect(pipeline.ir({ id: 'ir', kind: 'root', children: [] })).toMatchObject({ id: 'added-ir' })
  })
})
