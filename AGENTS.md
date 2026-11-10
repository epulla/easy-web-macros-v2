# Project instructions

## Commands
- `pnpm dev`: run extension in Chrome.
- `pnpm compile`, `pnpm test`, `pnpm build`: validate.
- `pnpm zip`: package Chrome Web Store build.

## Layout
- `entrypoints/`: WXT background, content, popup, options, onboarding shells.
- `src/core/`, `src/bg/`, `src/ui/`: macro logic, background logic, UI.
- `tests/`: Vitest tests; `public/icon/`: extension icons.
- `docs/`: project documentation and plans; `assets/`: styles.

## Domain rules
- Easy Web Macros records and replays web actions. Keep macro behavior scoped to user-initiated recording/replay.
- Persist extension data in `chrome.storage.local`; do not send it elsewhere.
- Manifest permissions: `storage` by default; add `tabs` or `scripting` only when a feature truly needs it, and list every new permission in the PR (existing users get a re-approve prompt). Content script matches only HTTP(S).
- Target Chrome only for now.

## UI copy
- Write for non-technical users. Use short, clear labels and explain consequences.
- Avoid browser/API jargon and unexplained errors.

## Git
- Use feature branches and pull requests; do not commit directly to `main` except initial scaffold setup.
- Use Conventional Commits with a scope, e.g. `feat(recorder): ...`, `docs(project): ...`.
