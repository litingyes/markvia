<script setup lang="ts">
import { ref } from 'vue'
import { Markdown } from '@markvia/vue'

const props = defineProps<{ initialContent?: string }>()
const content = ref(
  props.initialContent ??
    '# Hello, Markvia\n\nEdit this **Markdown** and the Vue renderer updates it.',
)
</script>

<template>
  <div class="markvia-demo">
    <div class="markvia-demo__label">Vue renderer</div>
    <div class="markvia-demo__controls">
      <textarea v-model="content" aria-label="Vue Markdown input" />
      <div class="markvia-demo__output">
        <Markdown :content="content" />
      </div>
    </div>
  </div>
</template>
