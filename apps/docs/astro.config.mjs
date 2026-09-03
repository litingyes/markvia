import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import vue from '@astrojs/vue'

const sourcePath = (path) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  integrations: [
    react(),
    vue(),
    starlight({
      title: 'Markvia',
      description: 'Universal Markdown Runtime for static, streaming and interactive content.',
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        'zh-cn': {
          label: '简体中文',
          lang: 'zh-CN',
        },
      },
      sidebar: [
        {
          slug: 'playground',
          label: 'Playground',
          translations: { 'zh-CN': 'Playground' },
        },
        {
          label: 'Get started',
          translations: { 'zh-CN': '开始使用' },
          items: ['index', 'getting-started', 'renderers'],
        },
        {
          label: 'Runtime capabilities',
          translations: { 'zh-CN': '运行时能力' },
          items: ['streaming', 'plugins', 'highlighting'],
        },
        {
          label: 'Reference',
          translations: { 'zh-CN': '参考' },
          items: [{ autogenerate: { directory: 'reference' } }],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
  vite: {
    resolve: {
      alias: {
        '@markvia/core': sourcePath('../../packages/core/src/index.ts'),
        '@markvia/html': sourcePath('../../packages/html/src/index.ts'),
        '@markvia/react': sourcePath('../../packages/react/src/index.tsx'),
        '@markvia/vue': sourcePath('../../packages/vue/src/index.ts'),
        '@markvia/shiki': sourcePath('../../packages/shiki/src/index.ts'),
      },
    },
  },
})
