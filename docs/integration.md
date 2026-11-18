# `@preptex/ui` Integration Guide

This guide explains how to consume `@preptex/ui` in both standalone client-only applications and full-stack applications with backend AI or transformation services.

## 1. Installation & Peer Dependencies

Install `@preptex/ui` alongside its peer dependencies:

```sh
npm install @preptex/ui @preptex/core @codemirror/state @codemirror/view react react-dom
```

Import the design tokens in your application entry point (`src/index.tsx` or `src/main.tsx`):

```tsx
import '@preptex/ui/tokens.css';
// If your bundler does not automatically process CSS imports inside node_modules ESM:
// import '@preptex/ui/styles.css';
```

## 2. Standalone Usage

```tsx
import { DEFAULT_DEMO_PROJECT_FILES, PrepTeXWorkspace } from '@preptex/ui';

export default function App() {
  return <PrepTeXWorkspace demoFiles={DEFAULT_DEMO_PROJECT_FILES} />;
}
```

## 3. Extending `<PrepTeXWorkspace>` with Custom Views, Menus, and Slots

Full-stack applications can inject new views (such as a Venue Adapter or AI Short/Long Builder), custom top-level menus, AST node actions, and header status indicators:

```tsx
import {
  PrepTeXWorkspace,
  usePrepTeXWorkspace,
  type CustomWorkspaceViewDescriptor,
} from '@preptex/ui';

function VenueStudioPane() {
  const { effectiveEntry, projectModel, stageEditPlan } = usePrepTeXWorkspace();
  // Read projectModel.snapshot, projectModel.metadata, projectModel.coarseTree
  // Call backend API and stage returned ProjectEditPlan into Diff Review:
  return (
    <section className="WorkspaceViewPane" aria-label="Venue Studio">
      <div className="WorkspaceViewCard">
        <div className="WorkspaceViewBody">
          <h2>Venue Studio ({effectiveEntry})</h2>
        </div>
      </div>
    </section>
  );
}

const EXTRA_VIEWS: readonly CustomWorkspaceViewDescriptor[] = [
  {
    id: 'venue-studio',
    label: 'Venue Adapter',
    shortLabel: 'Venue',
    description: 'Convert template, preamble, and short/long profile for a target venue',
    icon: '🏛',
    render: () => <VenueStudioPane />,
  },
];

export function FullStackApp() {
  return (
    <PrepTeXWorkspace
      brandLabel="PrepTeX Studio"
      extraViews={EXTRA_VIEWS}
      getExtraMenus={(ctx) => [
        {
          id: 'ai',
          label: 'AI Tools',
          items: [
            {
              id: 'open-venue',
              label: 'Venue Adapter…',
              hint: 'Convert template',
              onSelect: () => ctx.layout.selectView('venue-studio'),
            },
          ],
        },
      ]}
      renderAstNodeActions={(node, ctx) => (
        <button
          type="button"
          className="action-btn"
          onClick={() => ctx.layout.selectView('venue-studio')}
        >
          AI Split ({node.kind})
        </button>
      )}
    />
  );
}
```

## 4. Staging External / Backend `ProjectEditPlan` Proposals

When an external backend or AI service proposes source changes:

1. Construct a `@preptex/core` `ProjectEditPlan` against `snapshot.id` (`viewId: null` for source-scoped edits), using inclusive UTF-16 `SourceRange` offsets (`{ line, start, end }`) and exact `expected` substrings.
2. Call `ctx.stageEditPlan(plan, { title, subtitle, historyLabel })` (or `operations.stageExternalEditPlan(plan, metadata)`).
3. `PrepTeXWorkspace` switches to `EditPreviewDialog` (`Diff Review`), checks snapshot staleness if files changed while the request was in flight, validates non-overlapping UTF-16 ranges and `expected` contents via `applyExternalProjectEditPlanAdapter`, applies edits atomically across `useFiles`, and records `historyLabel` in the Undo/Redo stack.
