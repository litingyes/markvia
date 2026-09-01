# Markvia

Universal Markdown Runtime for static, streaming and interactive content.

Markvia 将 Markdown 解析为统一的 Semantic AST 和 Render IR，再适配到 HTML、React 和 Vue。首版使用自研 parser，优先建立框架无关的运行时契约。

## 当前能力

- 标题、段落、强调、加粗、删除线、行内代码
- 链接、图片、有序/无序列表、引用和 fenced code
- 稳定节点 ID 与块级增量 Markdown stream
- 安全 HTML renderer、React renderer、Vue renderer
- 可插拔 AST/IR transform 与代码高亮 hook
- Node.js `>=24`

首版暂不承诺完整 CommonMark/GFM，也暂不包含 Shiki、Math、Mermaid、Component Markdown 或 CLI。

## 使用

```ts
import { createMarkdown } from '@markvia/core'
import { htmlRenderer } from '@markvia/html'

const runtime = createMarkdown()
const html = runtime.render('# Hello\n\nMarkvia', htmlRenderer)
```

React：

```tsx
import { Markdown } from '@markvia/react'

export function Article({ content }: { content: string }) {
  return <Markdown content={content} />
}
```

Vue：

```vue
<Markdown :content="content" />
```

流式输入：

```ts
const stream = runtime.createStream()
stream.subscribe(({ document, changes }) => {
  console.log(document, changes)
})
stream.write('# Hello')
stream.write('\n\nworld')
stream.finish()
```

## 开发

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

格式化和静态检查由 Vite+ 提供：

```bash
vp fmt
vp lint
vp check
```

`pnpm build` 会按 workspace 依赖顺序使用各包的 `vp pack` 生成 ESM、CJS、source map 和声明文件。
