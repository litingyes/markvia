import { createMarkdown } from '@markvia/core'

const stream = createMarkdown().createStream()

stream.subscribe((update) => {
  console.log(`version ${update.version}`, update.changes)
})

stream.write('# Streaming Markdown')
stream.write('\n\nThe last block can still be incomplete.')
stream.finish()
