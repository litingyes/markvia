# Markvia

Universal Markdown Runtime for static, streaming and interactive content.

Markvia 将 Markdown 解析为统一的 Semantic AST 和 Render IR，再适配到 HTML、React 和 Vue。解析基线固定为 CommonMark 0.29 + 正式 GFM 0.29。

## 当前能力

- CommonMark 0.29 的区块、容器和行内语法
- GFM 0.29 的表格、任务列表、删除线和扩展自动链接
- 引用链接/图片、HTML block、raw HTML、硬换行和 fenced code 元数据
- 稳定节点 ID 与块级增量 Markdown stream
- 默认安全的 HTML、React、Vue renderer
- 可插拔 AST/IR transform 与代码高亮 hook
- Node.js `>=24`

HTML renderer 可通过 `createHTMLRenderer({ allowRawHtml: true })` 开启兼容模式；默认会转义 raw HTML，React/Vue 始终按文本安全输出。基线不包含脚注、Alerts、MDX、frontmatter、issue/PR 引用或 emoji 等 GitHub 产品层扩展，也暂不包含 Shiki、Math、Mermaid、Component Markdown 或 CLI。

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

文档站基于 Astro 和 Starlight，支持在同一篇文档中展示 HTML、React 和 Vue 示例：

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

`pnpm build` 会按 workspace 依赖顺序使用各包的 `vp pack` 生成 ESM、CJS、source map 和声明文件。
