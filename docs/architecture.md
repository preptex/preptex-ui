# `@preptex/ui` Architecture

This document records the architecture, state ownership, and package boundaries of `@preptex/ui@0.1.0`.

## Mission and Boundaries

`@preptex/ui` provides the shared React workspace shell, structural LaTeX inspector/editor views, pure UI state hooks, browser utilities, ZIP builder, and CSS design tokens for PrepTeX web applications:

- **Zero `@preptex/core` runtime logic:** `@preptex/ui` imports `@preptex/core` strictly via `import type` for TypeScript data contracts. None of the compiled JavaScript modules in `dist/` import or execute `@preptex/core`.
- **Full-stack / server-backed apps** run `@preptex/core` on the backend server and pass JSON-serialized model data (`WorkspaceModelData`) and API callbacks (`WorkspaceActionHandlers`) into `<PrepTeXWorkspace>`.
- **Standalone client-only apps (`website/`)** run `@preptex/core` in the browser and pass their local model/operation state into `<PrepTeXWorkspace>`.

### Package Boundary Rules

- `src/index.ts` (`@preptex/ui`) is the single JS/TS public module entry point. Deep imports into `@preptex/ui/dist/*` are blocked by `package.json` `exports`.
- `@preptex/ui/tokens.css` exports the `:root` CSS custom properties and base element resets.
- `@preptex/ui/styles.css` exports the concatenated stylesheet bundle (`tokens.css` + `PrepTeXWorkspace.css` + all component stylesheets) for bundlers that do not import `.css` files from ESM modules in `node_modules`.
- `react`, `react-dom`, `@preptex/core`, `@codemirror/state`, and `@codemirror/view` are `peerDependencies` and are never bundled into `dist/`, preventing duplicate React or CodeMirror instances in consuming applications.

## Components and Layers

| Layer / Component | Source Location | Responsibility |
| --- | --- | --- |
| `PrepTeXWorkspace` | `src/components/PrepTeXWorkspace.tsx` | Top-level workspace shell and `WorkspaceSessionContext` provider (`usePrepTeXWorkspace`). Coordinates file buffers, configuration, `@preptex/core` model, operations, view routing, `Split Code Companion`, and extension slots. |
| `WorkspaceHeader` | `src/components/WorkspaceHeader.tsx` | Top menubar (`File`, `Edit`, optional `extraMenus`, `View` drawer), keyboard roving/menu navigation, right-side alert pills (`pendingDiffCount`, `diagnosticCount`), optional `rightSlot`, and readiness status pill. |
| `WelcomeEmptyState` | `src/components/WelcomeEmptyState.tsx` | Empty-workspace dropzone supporting file/folder uploads, demo loading, and optional `extraActions`. |
| `Filetree` | `src/components/Filetree.tsx` | Collapsible file explorer with nested folders, path filtering, file/folder creation, entry selection, drag-and-drop directory ingestion, download, and deletion. |
| `Codeview` | `src/components/Codeview.tsx` | Read-only CodeMirror 6 viewer with UTF-16 range selection and 1-based line jumping. |
| `ASTview` & `TreeNode` | `src/components/astview/` | `Coarse`, `Structure` (`ConfiguredNode`), and `Source` (`SourceToken`) tree inspector with `Command` vs `Recursive` `\input` toggle, inline Phase 0 condition configuration, node filtering, and `Split` companion toggle. |
| `NodeActionBar` | `src/components/NodeActionBar.tsx` | Contextual action bar above `ASTview` for renaming, wrapping, unwrapping, removing, or reparsing selected AST nodes, plus optional `extraActions`. |
| `OperationsDialog` & `ControlPanel` | `src/components/OperationsDialog.tsx`, `src/components/ControlPanel.tsx` | Transformations view for `Realize Conditions`, `Suppress Comments`, `Remove Environments`, and `Expand / Flatten \input`, unified In-Place Diff Review vs New File(s) output, artifact downloads, and optional `extraContent`. |
| `CatalogDialog` | `src/components/CatalogDialog.tsx` | Symbol & construct catalog (commands, environments, conditions, labels, citations) with occurrence jumping, global refactoring, inline definition editing, and custom command arity overrides. |
| `MetadataDialog` | `src/components/MetadataDialog.tsx` | Document metadata (title, authors, date, abstract, documentclass, packages, bibliography, statistics) with diff-staged inline editing. |
| `LogDialog` & `LogPanel` | `src/components/LogDialog.tsx`, `src/components/LogPanel.tsx` | Diagnostics and analysis findings (`Check References`, `Check Commands`, plus optional `extraHeaderActions`) with source jump links. |
| `EditPreviewDialog` | `src/components/EditPreviewDialog.tsx` | Diff Review view for both `@preptex/core` transformations and external `stageEditPlan` proposals, supporting custom titles/subtitles, staleness alerts, and atomic application. |
| `ProjectSetupDialog` & `ConfigurationSummary` | `src/components/ProjectSetupDialog.tsx`, `src/components/ConfigurationSummary.tsx` | Project settings view for entry path, `\input` mode, traversal, condition policy, split companion toggle, and custom command signatures. |

## State Hooks and Services

| Hook / Module | Location | Responsibility |
| --- | --- | --- |
| `useFiles` | `src/model/useFiles.ts` | Atomic reducer owning `FilesMap`, monotonic `sourceRevision`, per-file `fileVersions`, `selectedFile`, and bounded `past`/`future` undo/redo stacks. |
| `useProjectConfiguration` | `src/model/useProjectConfiguration.ts` | Owns `entryPath`, `traversal`, `inputs`, `conditionPolicy`, `customCommands`, `coarseTreeOptions`, and `recommendEntry()`. |
| `useWorkspaceLayout` | `src/model/useWorkspaceLayout.ts` | Manages `activeView`, `previousView` (`returnFromDiff`), `splitEnabled`, `sidebarCollapsed`, and `openMenu`. |
| `useControl` | `src/model/useControl.ts` | Owns `CoreOptionsUI` form state for transformations/exports. |
| `src/services/zip.ts` | `src/services/zip.ts` | Zero-dependency PKZIP 2.0 archive writer and reader (`createZipArchive`, `readZipFileNames`). |
