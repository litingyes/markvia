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
  <div class="my-4 rounded-xl border border-markvia-border bg-markvia-surface p-4">
    <div class="mb-3 text-xs font-bold uppercase tracking-wider text-markvia-muted">
      {{ copy.vueStreaming }}
    </div>
    <p class="m-0 text-sm text-markvia-muted">{{ status }}</p>
    <div class="mt-3 min-w-0 rounded-lg border border-markvia-border bg-markvia-bg p-4">
      <Markdown :document="document" />
    </div>
  </div>
</template>
