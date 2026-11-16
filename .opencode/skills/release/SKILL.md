---
name: release
description: Cut an Easy Web Macros release - bump version, build the Chrome zip with pnpm, tag, and publish a GitHub release with gh. Use only when asked to release, publish, tag, or ship a new Easy Web Macros version.
---

# Release

Use pnpm only. Releases are cut from `main`.

## Check state

- `git switch main && git pull --ff-only`
- `git status --short` must be empty; stop otherwise.
- `gh auth status` must be logged in.
- Check last release with `git describe --tags --abbrev=0`.

## Pick version

- Read commits since last tag. With no commits, stop.
- Choose SemVer from Conventional Commits: breaking change -> major, `feat` -> minor, fixes -> patch.
- Confirm version with user.
- Set `package.json` version; WXT uses it for manifest and archive names.
- Commit `chore(release): vX.Y.Z`, then push.

## Verify and build

```sh
pnpm compile && pnpm test
pnpm zip
ls .output/*.zip
```

Expect `easy-web-macros-X.Y.Z-chrome.zip`. Stop if it is absent or the version differs.

## Publish

Write plain-language release notes grouped under `## New`, `## Fixed`, `## Changed` (omit empty groups). Include Chrome install instructions (`chrome://extensions`) and link the store notes in `docs/store/release-notes.md`. Publish with `gh release create vX.Y.Z --target main --title "vX.Y.Z" --notes "<notes>"` and attach the Chrome zip.

## Report

Give release URL and attached file. Store submissions remain manual.

## After store publish

Once the store publishes the version (ask the user if unsure):

- README store badge shows the new version.
- Store page assets (screenshots, description) are current.
- An install of the previous version updates cleanly to the new one.
