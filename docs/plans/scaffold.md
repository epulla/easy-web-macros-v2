# Scaffold plan

## Request

"let's go with PROJ-9, PROJ-4 and PROJ-61 ... The PROJ-61 we should create a private gh repo for it"

## Decisions

- Private fresh repository `epulla/easy-web-macros-v2`, MIT, WXT 0.21 / React 19 / Tailwind v4 / TypeScript / Vitest / fake-browser / web-ext.
- Version 2.0.0. Manifest permission only `storage`; content script matches HTTP(S). Reuse v1 icons.
- Firefox build and zip targets available from day one.

## Tasks

- [x] 1. Scaffold builds.
- [x] 2. Docs, agent instructions, and skills.
- [x] 3. CI green.
- [ ] 4. Load unpacked extension check by user.
