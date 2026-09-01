<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createMarkdown, type MarkdownDocument } from '@markvia/core'
import { Markdown } from '@markvia/vue'

const chunks = [
  '# Streaming Markdown',
  '\n\nThe document arrives in small chunks.',
  '\n\nThe last block can remain incomplete until the stream finishes.',
]

const runtime = createMarkdown()
const document = ref<MarkdownDocument>(runtime.parse(''))
const status = ref('等待流式输入…')
let timer: ReturnType<typeof setInterval> | undefined
let unsubscribe: (() => void) | undefined

onMounted(() => {
  const stream = runtime.createStream()
  let chunkIndex = 0

  document.value = stream.getDocument()
  unsubscribe = stream.subscribe((update) => {
    document.value = update.document
    status.value = `version ${update.version} · added ${update.changes.added.length} block(s)`
  })

  timer = window.setInterval(() => {
    const chunk = chunks[chunkIndex]
    if (chunk === undefined) {
      if (timer !== undefined) window.clearInterval(timer)
      stream.finish()
      status.value = 'stream finished'
      return
    }

    stream.write(chunk)
    chunkIndex += 1
  }, 650)
})

onBeforeUnmount(() => {
  if (timer !== undefined) window.clearInterval(timer)
  unsubscribe?.()
})
</script>

<template>
  <div class="markvia-demo">
    <div class="markvia-demo__label">Vue streaming</div>
    <p class="markvia-demo__status">{{ status }}</p>
    <div class="markvia-demo__output">
      <Markdown :document="document" />
    </div>
  </div>
</template>
