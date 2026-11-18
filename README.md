# `@preptex/ui`

Pure React workspace shell, structural LaTeX UI components, UI state hooks, browser utilities, and CSS design tokens shared across PrepTeX web applications.

`@preptex/ui` contains **zero runtime `@preptex/core` execution logic** (`import type` only), so it works identically whether `@preptex/core` runs on a backend server or in the browser.

## Usage

```tsx
import '@preptex/ui/tokens.css';
import { DEFAULT_DEMO_PROJECT_FILES, PrepTeXWorkspace } from '@preptex/ui';

export function App() {
  return (
    <PrepTeXWorkspace
      demoFiles={DEFAULT_DEMO_PROJECT_FILES}
      model={{
        viewStatus: 'ready',
        // Pass server-returned or client-computed CoarseTree, Catalog, Metadata, Diagnostics, PendingEditPlan
      }}
      actions={{
        // Connect UI actions to your backend API or local @preptex/core controller
      }}
    />
  );
}
```

If your bundler does not resolve component-local CSS imports from `node_modules`, also import `@preptex/ui/styles.css`.

## Extension Slots

`<PrepTeXWorkspace>` accepts optional extension hooks and slots:

- `extraViews` / `getExtraViews` — register additional views in the `View` drawer and primary viewport (automatically compatible with `Split Code Companion`).
- `getExtraMenus`, `getExtraFileMenuItems`, `getExtraEditMenuItems` — inject custom top-level menus or File/Edit items.
- `renderHeaderRightSlot` — render status or action pills in `WorkspaceHeader`.
- `renderAstNodeActions` — inject contextual actions into `NodeActionBar` when an AST node is selected.
- `renderDiagnosticsActions` — add actions to the `Diagnostics` header bar.
- `renderOperationsExtraContent` — append cards/panels to `Transformations`.
- `renderEmptyStateActions` — add secondary entry points on `WelcomeEmptyState`.
- `stageEditPlan(plan, metadata)` (via context) — stage backend or local `ProjectEditPlan` proposals into `Diff Review` with custom headings and undo history labels.

## Verification & Publishing Scripts

```sh
npm run typecheck
npm run lint
npm run test:ci
npm run type-test
npm run build
npm run pack:check
npm run consumer:check
npm run check
```
