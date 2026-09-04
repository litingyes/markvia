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
      '@markvia/math': workspacePath('./packages/math/src/index.ts'),
      '@markvia/mermaid': workspacePath('./packages/mermaid/src/index.ts'),
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
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx', 'apps/docs/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
  pack: {
    dts: true,
    format: ['esm', 'cjs'],
    sourcemap: true,
  },
})
