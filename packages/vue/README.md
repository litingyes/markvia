# @markvia/vue

Vue renderer and Markdown component for Markvia.

```bash
pnpm add @markvia/core @markvia/vue vue
```

```vue
<script setup lang="ts">
import { Markdown } from '@markvia/vue'

defineProps<{ content: string }>()
</script>

<template>
  <Markdown :content="content" />
</template>
```

See the [Markvia documentation](https://github.com/litingyes/markvia/tree/release/apps/docs) for the full API.
