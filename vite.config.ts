import { defineConfig } from 'vite-plus'
import { fileURLToPath } from 'node:url'

const workspacePath = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@markvia/core': workspacePath('./packages/core/src/index.ts'),
      '@markvia/html': workspacePath('./packages/html/src/index.ts'),
      '@markvia/react': workspacePath('./packages/react/src/index.tsx'),
      '@markvia/vue': workspacePath('./packages/vue/src/index.ts'),
      '@markvia/shiki': workspacePath('./packages/shiki/src/index.ts'),
    },
  },
  fmt: {
    singleQuote: true,
    semi: false,
  },
  lint: {
    ignorePatterns: ['**/dist/**', '**/coverage/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx'],
  },
  pack: {
    dts: true,
    format: ['esm', 'cjs'],
    sourcemap: true,
  },
})
