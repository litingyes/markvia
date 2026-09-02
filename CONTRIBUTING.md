# Contributing

## Development Branches

`release` is the production branch. Create feature branches from the latest `release` branch and merge changes through Pull Requests.

```bash
git switch release
git pull --ff-only origin release
git switch -c feat/your-feature
```

## Submitting a Code PR

Use Conventional Commits for changes that affect the project:

```bash
git commit -m "feat(core): describe the change"
```

Release notes are generated from the commit history. All five public packages are versioned together, so changesets are not required.

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
git add .
git commit -m "feat(core): describe the change"
git push -u origin feat/your-feature
```

Set `release` as the base branch for the Pull Request. After the code PR is merged, maintainers can create a release from the updated `release` branch.

## Releasing a Version

From a clean `release` branch, run:

```bash
pnpm release
```

The script runs the quality checks, interactively selects the next version, updates the root package and all five public packages, generates `CHANGELOG.md`, commits the release, creates a `vX.Y.Z` tag, and pushes both the commit and tag. The tag-triggered Release workflow then:

1. Runs the quality checks again.
2. Publishes all five public packages to npm using npm Trusted Publishing.
3. Creates or updates the matching GitHub Release from `CHANGELOG.md`.

Do not manually edit package versions or changelogs, or publish packages locally.

If a temporary error occurs during publishing, re-run the tag workflow after resolving the cause. If a code fix is required, apply the fix before creating a new release tag.

## First Release

npm Trusted Publishers can only be configured for packages that already exist on npm. For the first release, maintainers must manually publish the selected version once using an npm account with 2FA enabled. Once all five packages exist, configure Trusted Publishing for each package against `.github/workflows/release.yml` and the `npm-release` environment; subsequent releases use `pnpm release` and the automated workflow.
