export type DemoLocale = 'en' | 'zh-CN'

export interface DemoCopy {
  htmlRenderer: string
  safeHtmlOutput: string
  reactRenderer: string
  vueRenderer: string
  reactStreaming: string
  vueStreaming: string
  reactMarkdownInput: string
  vueMarkdownInput: string
  astLabel: string
  astSummary: string
  waitingForStream: string
  streamFinished: string
  streamChunks: string[]
  streamUpdate: (version: number, added: number) => string
}

export const demoCopy: Record<DemoLocale, DemoCopy> = {
  en: {
    htmlRenderer: 'HTML renderer',
    safeHtmlOutput: 'Safe HTML output',
    reactRenderer: 'React renderer',
    vueRenderer: 'Vue renderer',
    reactStreaming: 'React streaming',
    vueStreaming: 'Vue streaming',
    reactMarkdownInput: 'React Markdown input',
    vueMarkdownInput: 'Vue Markdown input',
    astLabel: 'Semantic AST + Render IR',
    astSummary: 'Inspect the structured result for this Markdown',
    waitingForStream: 'Waiting for stream input…',
    streamFinished: 'Stream finished',
    streamChunks: [
      '# Streaming Markdown',
      '\n\nThe document arrives in small chunks.',
      '\n\nThe last block can remain incomplete until the stream finishes.',
    ],
    streamUpdate: (version, added) =>
      `Version ${version} · added ${added} block${added === 1 ? '' : 's'}`,
  },
  'zh-CN': {
    htmlRenderer: 'HTML renderer',
    safeHtmlOutput: '安全 HTML 输出',
    reactRenderer: 'React renderer',
    vueRenderer: 'Vue renderer',
    reactStreaming: 'React 流式渲染',
    vueStreaming: 'Vue 流式渲染',
    reactMarkdownInput: 'React Markdown 输入',
    vueMarkdownInput: 'Vue Markdown 输入',
    astLabel: 'Semantic AST + Render IR',
    astSummary: '查看当前 Markdown 的结构化结果',
    waitingForStream: '等待流式输入…',
    streamFinished: '流式输入完成',
    streamChunks: [
      '# Streaming Markdown',
      '\n\n文档会以小块的形式到达。',
      '\n\n在 stream 结束前，最后一个块可以保持未完成状态。',
    ],
    streamUpdate: (version, added) => `版本 ${version} · 新增 ${added} 个块`,
  },
}
