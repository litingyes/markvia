# @markvia/shiki

Optional Shiki code-highlighting adapter for Markvia.

```bash
pnpm add @markvia/core @markvia/html @markvia/shiki
```

````ts
import { createMarkdown } from '@markvia/core'
import { htmlRenderer } from '@markvia/html'
import { createShikiHighlighter } from '@markvia/shiki'

const highlighter = await createShikiHighlighter()
const html = await createMarkdown({ highlighter }).renderAsync(
  '```ts\nconst answer = 42\n```',
  htmlRenderer,
)
````

See the [Markvia documentation](https://github.com/litingyes/markvia/tree/release/apps/docs) for the full API.
