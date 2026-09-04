# @markvia/mermaid

Optional Mermaid diagram plugin for Markvia.

```bash
pnpm add @markvia/mermaid
```

```ts
import { createMarkdown } from '@markvia/core'
import { createMermaidPlugin } from '@markvia/mermaid'

const runtime = createMarkdown({
  plugins: [createMermaidPlugin({ provider: mermaidProvider })],
})
```

The plugin maps ` ```mermaid` fences to a semantic diagram node. It does not bundle the Mermaid
engine; providers return structured Markvia render fragments.
