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
      sidebar: [
        {
          label: '开始使用',
          items: ['index', 'getting-started', 'renderers'],
        },
        {
          label: '运行时能力',
          items: ['streaming', 'plugins', 'highlighting'],
        },
        {
          label: '参考',
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
      },
    },
  },
})
