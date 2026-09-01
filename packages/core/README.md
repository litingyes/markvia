# @markvia/core

Framework-agnostic Markdown runtime for parsing Markdown into a semantic AST and Render IR.

```bash
pnpm add @markvia/core
```

```ts
import { createMarkdown } from '@markvia/core'

const runtime = createMarkdown()
const document = runtime.parse('# Hello')
const ir = runtime.toIR(document)
```

See the [Markvia documentation](https://github.com/litingyes/markvia/tree/release/apps/docs) for the full API.
