#!/usr/bin/env tsx

import { execSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

import { versionBump } from 'bumpp'

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function ensureCleanWorkingTree(): void {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim()
  if (status) {
    console.error('Working tree is not clean. Commit or stash your changes before releasing.')
    process.exit(1)
  }
}

function addReleaseDate(version: string): void {
  const date = new Date().toLocaleDateString('en-CA')
  const changelog = readFileSync('CHANGELOG.md', 'utf-8')
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headingPattern = new RegExp(`^## v${escapedVersion}$`, 'm')
  const datedHeading = `## v${version} (${date})`
  const updatedChangelog = changelog.replace(headingPattern, datedHeading)

  if (updatedChangelog === changelog) {
    throw new Error(`Could not find the generated changelog heading for v${version}.`)
  }

  writeFileSync('CHANGELOG.md', updatedChangelog)
}

async function main(): Promise<void> {
  ensureCleanWorkingTree()

  run('pnpm', ['fmt:check'])
  run('pnpm', ['lint'])
  run('pnpm', ['check'])
  run('pnpm', ['test', '--', '--run'])
  run('pnpm', ['build'])
  run('pnpm', ['docs:build'])

  await versionBump({
    files: ['package.json', 'packages/*/package.json'],
    commit: 'chore(release): v%s',
    tag: 'v%s',
    push: true,
    all: true,
    confirm: true,
    execute: async (operation) => {
      const version = operation.state.newVersion
      run('pnpm', ['exec', 'changelogen', '--output', 'CHANGELOG.md', '-r', version])
      addReleaseDate(version)
      run('pnpm', ['fmt', 'CHANGELOG.md'])
    },
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
