<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createMarkdown, type MarkdownDocument } from '@markvia/core'
import { Markdown } from '@markvia/vue'
import { demoCopy, type DemoLocale } from './demoCopy'

const props = withDefaults(defineProps<{ locale?: DemoLocale }>(), {
  locale: 'en',
})
const copy = demoCopy[props.locale]

const runtime = createMarkdown()
const document = ref<MarkdownDocument>(runtime.parse(''))
const status = ref(copy.waitingForStream)
let timer: ReturnType<typeof setInterval> | undefined
let unsubscribe: (() => void) | undefined

onMounted(() => {
  const stream = runtime.createStream()
  let chunkIndex = 0

  document.value = stream.getDocument()
  unsubscribe = stream.subscribe((update) => {
    document.value = update.document
    status.value = copy.streamUpdate(update.version, update.changes.added.length)
  })

  timer = window.setInterval(() => {
    const chunk = copy.streamChunks[chunkIndex]
    if (chunk === undefined) {
      if (timer !== undefined) window.clearInterval(timer)
      stream.finish()
      status.value = copy.streamFinished
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
    <div class="markvia-demo__label">{{ copy.vueStreaming }}</div>
    <p class="markvia-demo__status">{{ status }}</p>
    <div class="markvia-demo__output">
      <Markdown :document="document" />
    </div>
  </div>
</template>
