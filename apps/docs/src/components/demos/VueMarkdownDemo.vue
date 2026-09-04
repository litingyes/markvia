<script setup lang="ts">
import { ref } from 'vue'
import { Markdown } from '@markvia/vue'
import { demoCopy, type DemoLocale } from './demoCopy'

const props = withDefaults(defineProps<{ initialContent?: string; locale?: DemoLocale }>(), {
  locale: 'en',
})
const copy = demoCopy[props.locale]
const content = ref(
  props.initialContent ??
    '# Hello, Markvia\n\nEdit this **Markdown** and the Vue renderer updates it.',
)
</script>

<template>
  <div class="my-4 rounded-xl border border-markvia-border bg-markvia-surface p-4">
    <div class="mb-3 text-xs font-bold uppercase tracking-wider text-markvia-muted">
      {{ copy.vueRenderer }}
    </div>
    <div class="grid gap-3">
      <textarea
        v-model="content"
        class="min-h-32 w-full resize-y rounded-lg border border-markvia-border bg-markvia-black p-3 font-[inherit] text-sm leading-6 text-markvia-white outline-none focus-visible:outline-2 focus-visible:outline-markvia-accent focus-visible:outline-offset-2"
        :aria-label="copy.vueMarkdownInput"
      />
      <div class="min-w-0 rounded-lg border border-markvia-border bg-markvia-bg p-4">
        <Markdown :content="content" />
      </div>
    </div>
  </div>
</template>
