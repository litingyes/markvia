# @markvia/react

React renderer and Markdown component for Markvia.

```bash
pnpm add @markvia/core @markvia/react react
```

```tsx
import { Markdown } from '@markvia/react'

export function Article({ content }: { content: string }) {
  return <Markdown content={content} />
}
```

See the [Markvia documentation](https://github.com/litingyes/markvia/tree/release/apps/docs) for the full API.
