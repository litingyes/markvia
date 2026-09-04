# Markvia

Universal Markdown runtime for static, streaming, and interactive content.

Markvia parses Markdown into a shared Semantic AST and Render IR, then lets HTML, React, and Vue renderers consume the same document model. Parse once, keep node identity stable, and choose the output target that fits your application.

## Highlights

- CommonMark 0.29 with formal GFM 0.29 support
- Tables, task lists, strikethrough, extended autolinks, reference links and images
- HTML blocks, raw HTML, hard line breaks, and fenced-code metadata
- Stable node IDs and block-level incremental Markdown streaming
- Safe HTML, React, and Vue renderers by default
- Extensible document transforms, IR transforms, and code-highlighting hooks
- Node.js `>=24`

## Packages

| Package            | Purpose                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `@markvia/core`    | Markdown parsing, Semantic AST, Render IR, plugins, and streaming |
| `@markvia/html`    | HTML rendering with optional raw HTML compatibility mode          |
| `@markvia/react`   | React renderer and `Markdown` component                           |
| `@markvia/vue`     | Vue renderer and `Markdown` component                             |
| `@markvia/shiki`   | Optional Shiki adapter with dynamic language loading              |
| `@markvia/math`    | Optional math syntax plugin and provider contract                 |
| `@markvia/mermaid` | Optional Mermaid diagram syntax plugin and provider contract      |

## Quick start

### HTML

```bash
pnpm add @markvia/core @markvia/html
```

```ts
import { createMarkdown } from '@markvia/core'
import { htmlRenderer } from '@markvia/html'

const runtime = createMarkdown()
const html = runtime.render('# Hello, Markvia', htmlRenderer)
```

### React

```bash
pnpm add @markvia/core @markvia/react react
```

```tsx
import { Markdown } from '@markvia/react'

export function Article({ content }: { content: string }) {
  return <Markdown content={content} />
}
```

### Vue

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

### Shiki highlighting

```bash
pnpm add @markvia/core @markvia/html @markvia/shiki
```

````ts
import { createMarkdown } from '@markvia/core'
import { htmlRenderer } from '@markvia/html'
import { createShikiHighlighter } from '@markvia/shiki'

const highlighter = await createShikiHighlighter()
const runtime = createMarkdown({ highlighter })
const html = await runtime.renderAsync('```ts\nconst answer = 42\n```', htmlRenderer)
````

### Streaming input

```ts
const stream = runtime.createStream()

stream.subscribe(({ document, changes }) => {
  console.log(document, changes)
})

stream.write('# Hello')
stream.write('\n\nworld')
stream.finish()
```

Pass each update’s `document` to the React or Vue `Markdown` component to render live input.

### Optional math and Mermaid syntax

Math and Mermaid support are maintained as optional packages and are not installed with
`@markvia/core`:

```bash
pnpm add @markvia/math @markvia/mermaid
```

```ts
import { createMathPlugin } from '@markvia/math'
import { createMermaidPlugin } from '@markvia/mermaid'

const runtime = createMarkdown({
  plugins: [
    createMathPlugin({ provider: mathProvider }),
    createMermaidPlugin({ provider: mermaidProvider }),
  ],
})
```

If math is not used, do not install `@markvia/math`; its parser dependencies are then not
installed either. Neither optional package installs a rendering engine. Install and connect your
own provider only when the application needs rendered MathML or SVG output.

## Security

HTML output escapes text and raw HTML by default, filters event attributes, and rejects unsafe URLs such as `javascript:` and `data:`. Unsafe links retain their text and receive `data-markvia-unsafe-url="true"`.

If compatibility with trusted raw HTML is required, enable it explicitly for the HTML renderer:

```ts
import { createHTMLRenderer } from '@markvia/html'

const renderer = createHTMLRenderer({ allowRawHtml: true })
const html = runtime.render(source, renderer)
```

React and Vue always output raw HTML as safe text. Do not pass unvalidated user input directly to a DOM injection API such as Astro’s `set:html`.

## Compatibility and non-goals

Markvia’s baseline is CommonMark 0.29 plus formal GFM 0.29. `createMarkdown()` enables GFM by default; there is no separate strict CommonMark mode.

The following are intentionally outside the current scope:

- GitHub product-layer extensions such as footnotes, Alerts, MDX, frontmatter, issue/PR references, and emoji
- Component Markdown and CLI

## Documentation

The documentation site lives in [`apps/docs/`](apps/docs/), is built with Astro and Starlight, and defaults to English. Simplified Chinese is available under the `/zh-cn/` locale when the site is running.

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

## Development

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

Formatting and static checks are provided by Vite+:

```bash
pnpm fmt:check
pnpm lint
```

## License

MIT. See [`LICENSE`](LICENSE).
