# `@preptex/ui` Repository Guide

This repository contains the pure React UI components, workspace shell (`PrepTeXWorkspace`), layout/file/configuration hooks, CSS design tokens, and browser utilities used by PrepTeX web applications.

## Boundaries

- **Pure React UI (zero `@preptex/core` runtime execution):** `@preptex/ui` must not call `@preptex/core` functions at runtime (`import type` from `@preptex/core` only). Whether `@preptex/core` runs on a backend server (in full-stack apps) or in the browser (in standalone `website/`), the consumer passes plain model data (`WorkspaceModelData`) and action callbacks (`WorkspaceActionHandlers`) into `<PrepTeXWorkspace>` or individual components.
- Keep `@preptex/ui` app-agnostic: extend `PrepTeXWorkspace` and `WorkspaceHeader` via generic descriptor/slot props (`extraViews`, `getExtraMenus`, `renderAstNodeActions`, `stageEditPlan`, etc.), never app-specific feature flags.
- Maintain strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`) compatible with TypeScript `4.9.5` consumers (`skipLibCheck: false`).
- Keep `react`, `react-dom`, `@preptex/core`, `@codemirror/state`, and `@codemirror/view` in `peerDependencies` (never bundle React into `dist/`).
- Do not introduce explicit `any`; `npm run lint` runs with `--max-warnings=0`.

## Local verification (mirrors `.github/workflows/ci.yml`)

```sh
npm run check
npm run pack:check
npm run consumer:check
```

`npm run check` runs `typecheck`, `lint`, `test:ci`, `type-test`, and `verify:package`. `npm run consumer:check` packs the release tarball and tests it in an isolated consumer with TypeScript 4.9.5 (`skipLibCheck: false`) and Node `exports` boundary verification.
