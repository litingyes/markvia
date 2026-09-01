# Contributing

## Development Branches

`release` is the production branch. Create feature branches from the latest `release` branch and merge changes through Pull Requests.

```bash
git switch release
git pull --ff-only origin release
git switch -c feat/your-feature
```

## Submitting a Code PR

Changes that affect a public package's API, functionality, or behavior require a changeset:

```bash
pnpm changeset
```

Select the public packages that are actually affected and choose the appropriate bump type. All five public packages are versioned together. Changesets are not required for documentation-only, test-only, or CI-only changes.

Run the following checks before committing:

```bash
pnpm fmt
pnpm fmt:check
pnpm lint
pnpm check
pnpm test -- --run
pnpm build
pnpm docs:build
```

```bash
git add packages .changeset
git commit -m "feat(core): describe the change"
git push -u origin feat/your-feature
```

Set `release` as the base branch for the Pull Request. After the code PR is merged, GitHub Actions automatically creates or updates the `chore(release): version packages` Release PR.

## Releasing a Version

After reviewing the version numbers and changelogs in the Release PR, maintainers should merge it using Squash and merge. The Release workflow then automatically:

1. Runs the quality checks again.
2. Publishes all five public packages to npm using npm Trusted Publishing.
3. Creates Git tags and a GitHub Release.

Do not manually edit package versions or changelogs, or run `npm publish` locally.

If a temporary error occurs during publishing, re-run the original workflow in GitHub Actions. If a code fix is required, apply the fix first, then use the manual retry option in the Release workflow and confirm the publish.

## First Release

npm Trusted Publishers can only be configured for packages that already exist on npm. For the first release, maintainers must manually publish the selected version once using an npm account with 2FA enabled. Once all five packages exist, immediately configure Trusted Publishing for each package; all subsequent releases use the automated workflow.
