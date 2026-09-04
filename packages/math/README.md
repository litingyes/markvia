# @markvia/math

Optional math syntax plugin for Markvia.

```bash
pnpm add @markvia/math
```

```ts
import { createMarkdown } from '@markvia/core'
import { createMathPlugin } from '@markvia/math'

const runtime = createMarkdown({
  plugins: [createMathPlugin({ provider: mathProvider })],
})
```

The plugin enables `$...$`, `$$...$$`, and ` ```math` syntax. It does not connect a math rendering
engine to the provider contract; providers return structured Markvia render fragments. Install
KaTeX, MathJax, or another engine separately and adapt its result to a provider when needed.
