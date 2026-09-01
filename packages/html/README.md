# @markvia/html

HTML renderer for Markvia.

```bash
pnpm add @markvia/core @markvia/html
```

```ts
import { createMarkdown } from '@markvia/core'
import { htmlRenderer } from '@markvia/html'

const html = createMarkdown().render('# Hello', htmlRenderer)
```

See the [Markvia documentation](https://github.com/litingyes/markvia/tree/release/apps/docs) for the full API.
