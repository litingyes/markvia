import type { DemoLocale } from '../demos/demoCopy'
import type { PlaygroundPanel, RendererTarget } from './playgroundState'

export interface PlaygroundPreset {
  id: string
  label: string
  content: string
}

export interface PlaygroundCopy {
  eyebrow: string
  title: string
  description: string
  editorLabel: string
  previewLabel: string
  presetLabel: string
  customPreset: string
  rendererLabel: string
  panelLabel: string
  renderers: Record<RendererTarget, string>
  panels: Record<PlaygroundPanel, string>
  reset: string
  copySource: string
  share: string
  actionsLabel: string
  copiedSource: string
  copiedShare: string
  shareTooLong: string
  shareFailed: string
  invalidShare: string
  loadingVue: string
  vueFailed: string
  characterCount: (count: number) => string
  presets: PlaygroundPreset[]
  defaultContent: string
}

const englishPresets: PlaygroundPreset[] = [
  {
    id: 'basics',
    label: 'Basic Markdown',
    content:
      '# Markvia Playground\n\nWrite Markdown once, then inspect the same document through multiple renderers.\n\n- Fast to edit\n- Safe by default\n- Shared AST and Render IR',
  },
  {
    id: 'gfm',
    label: 'GFM features',
    content:
      '# GFM features\n\n- [x] Task lists\n- [ ] Tables\n- [x] ~~Strikethrough~~\n\n| Renderer | Output |\n| --- | --- |\n| HTML | Static markup |\n| React | Components |\n| Vue | Components |',
  },
  {
    id: 'code',
    label: 'Code block',
    content:
      '## A small code sample\n\n```ts\nconst runtime = createMarkdown()\nconst html = runtime.render(source, htmlRenderer)\n```\n\nUse the HTML panel to inspect the generated output.',
  },
  {
    id: 'security',
    label: 'Security checks',
    content:
      '# Security checks\n\n[Unsafe URL](javascript:alert(1))\n\n<script>alert(1)</script>\n\nThe default HTML renderer escapes raw HTML and rejects unsafe URLs.',
  },
  {
    id: 'blocks',
    label: 'Blocks and emphasis',
    content:
      '> A blockquote can contain **strong emphasis** and `inline code`.\n\n1. Parse the source\n2. Build the shared IR\n3. Render the result\n\n---\n\n[Read the renderer guide](../renderers/)',
  },
]

const chinesePresets: PlaygroundPreset[] = [
  {
    id: 'basics',
    label: '基础 Markdown',
    content:
      '# Markvia Playground\n\n只需编写一次 Markdown，即可通过多个 renderer 查看同一份文档。\n\n- 编辑快速\n- 默认安全\n- 共用 AST 和 Render IR',
  },
  {
    id: 'gfm',
    label: 'GFM 能力',
    content:
      '# GFM 能力\n\n- [x] 任务列表\n- [ ] 表格\n- [x] ~~删除线~~\n\n| Renderer | 输出 |\n| --- | --- |\n| HTML | 静态标记 |\n| React | 组件 |\n| Vue | 组件 |',
  },
  {
    id: 'code',
    label: '代码块',
    content:
      '## 一个简单的代码示例\n\n```ts\nconst runtime = createMarkdown()\nconst html = runtime.render(source, htmlRenderer)\n```\n\n切换到 HTML 面板查看生成结果。',
  },
  {
    id: 'security',
    label: '安全性测试',
    content:
      '# 安全性测试\n\n[不安全 URL](javascript:alert(1))\n\n<script>alert(1)</script>\n\n默认 HTML renderer 会转义 raw HTML，并拒绝不安全 URL。',
  },
  {
    id: 'blocks',
    label: '区块与强调',
    content:
      '> Blockquote 可以包含**加粗文字**和 `inline code`。\n\n1. 解析源码\n2. 生成共享 IR\n3. 输出渲染结果\n\n---\n\n[阅读 renderer 指南](../renderers/)',
  },
]

const copyByLocale: Record<DemoLocale, PlaygroundCopy> = {
  en: {
    eyebrow: 'Interactive Markdown lab',
    title: 'Try the runtime in your browser',
    description:
      'Edit Markdown, compare renderer output, and inspect the shared Semantic AST and Render IR without setting up a project.',
    editorLabel: 'Markdown source',
    previewLabel: 'Rendered output',
    presetLabel: 'Example',
    customPreset: 'Custom content',
    rendererLabel: 'Renderer',
    panelLabel: 'Inspect',
    renderers: { html: 'HTML', react: 'React', vue: 'Vue' },
    panels: { preview: 'Preview', html: 'HTML', ast: 'AST / IR' },
    reset: 'Reset',
    copySource: 'Copy source',
    share: 'Copy share link',
    actionsLabel: 'Workspace actions',
    copiedSource: 'Markdown copied',
    copiedShare: 'Share link copied',
    shareTooLong: 'This document is too long for a share link. The local draft is still saved.',
    shareFailed: 'Could not copy the share link. Copy it from the browser address bar instead.',
    invalidShare: 'The share link was invalid, so the saved draft or default example was loaded.',
    loadingVue: 'Loading Vue renderer…',
    vueFailed: 'Vue renderer could not be loaded. Try another renderer.',
    characterCount: (count) => `${count.toLocaleString()} characters`,
    presets: englishPresets,
    defaultContent: englishPresets[0].content,
  },
  'zh-CN': {
    eyebrow: '交互式 Markdown 实验台',
    title: '在浏览器中体验 Markvia',
    description:
      '编辑 Markdown、比较不同 renderer 的输出，并查看共享的 Semantic AST 与 Render IR，无需创建项目。',
    editorLabel: 'Markdown 源码',
    previewLabel: '渲染结果',
    presetLabel: '示例',
    customPreset: '自定义内容',
    rendererLabel: 'Renderer',
    panelLabel: '查看',
    renderers: { html: 'HTML', react: 'React', vue: 'Vue' },
    panels: { preview: '预览', html: 'HTML', ast: 'AST / IR' },
    reset: '重置',
    copySource: '复制源码',
    share: '复制分享链接',
    actionsLabel: '工作区操作',
    copiedSource: 'Markdown 已复制',
    copiedShare: '分享链接已复制',
    shareTooLong: '当前内容过长，无法生成适合分享的链接；本地草稿仍会保存。',
    shareFailed: '无法复制分享链接，请直接从浏览器地址栏复制。',
    invalidShare: '分享链接无效，已加载本地草稿或默认示例。',
    loadingVue: '正在加载 Vue renderer…',
    vueFailed: 'Vue renderer 加载失败，请切换到其他 renderer。',
    characterCount: (count) => `${count.toLocaleString()} 个字符`,
    presets: chinesePresets,
    defaultContent: chinesePresets[0].content,
  },
}

export function getPlaygroundCopy(locale: DemoLocale): PlaygroundCopy {
  return copyByLocale[locale]
}
