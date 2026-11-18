import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ConfiguredNode, NodeLocation, ProjectEditPlan } from '@preptex/core';
import {
  PrepTeXWorkspace,
  type CustomWorkspaceViewDescriptor,
  type PrepTeXWorkspaceContextValue,
} from './PrepTeXWorkspace';

const ORIGIN_SEC = {
  snapshotId: 'snap-1',
  occurrenceId: 'occ-1',
  path: 'main.tex',
  version: 1,
  range: { line: 3, start: 40, end: 55 },
} as const;

const LOC_SEC: NodeLocation = {
  kind: 'single',
  primary: ORIGIN_SEC,
  spans: [ORIGIN_SEC],
};

const ORIGIN_ROOT = {
  snapshotId: 'snap-1',
  occurrenceId: 'occ-1',
  path: 'main.tex',
  version: 1,
  range: { line: 1, start: 0, end: 70 },
} as const;

const LOC_ROOT: NodeLocation = {
  kind: 'single',
  primary: ORIGIN_ROOT,
  spans: [ORIGIN_ROOT],
};

const MOCK_SECTION_NODE: ConfiguredNode = {
  kind: 'section',
  level: 1,
  starred: false,
  name: 'Intro',
  viewId: 'view-1',
  occurrenceKey: 'sec-1',
  projectedRange: { line: 3, start: 40, end: 55 },
  origins: [],
  location: LOC_SEC,
  arguments: [],
  children: [],
};

const MOCK_CONFIGURED_ROOT: ConfiguredNode = {
  kind: 'root',
  viewId: 'view-1',
  occurrenceKey: 'root-1',
  projectedRange: { line: 1, start: 0, end: 70 },
  origins: [],
  location: LOC_ROOT,
  children: [MOCK_SECTION_NODE],
};

describe('PrepTeXWorkspace extensibility (pure UI, no core runtime)', () => {
  it('supports custom views, menubar drawers, header/node/diagnostics slots, and external edit staging', async () => {
    const onFilesChange = jest.fn();

    const customView: CustomWorkspaceViewDescriptor = {
      id: 'venue-studio',
      label: 'Venue Studio',
      shortLabel: 'Venue',
      description: 'Convert paper to target venue',
      icon: '🏛',
      render: (ctx: PrepTeXWorkspaceContextValue) => (
        <section className="WorkspaceViewPane" aria-label="Venue Studio">
          <h2>Venue Studio</h2>
          <p>Entry: {ctx.effectiveEntry}</p>
          <button
            type="button"
            onClick={() => {
              const plan: ProjectEditPlan = {
                kind: 'edits',
                provenance: {
                  snapshotId: 'snap-1',
                  viewId: null,
                  request: {
                    operation: 'refactor-symbols',
                    options: { target: 'source', actions: [] },
                  },
                  operationVersion: 1,
                },
                edits: [
                  {
                    kind: 'replace',
                    path: 'main.tex',
                    range: { line: 1, start: 0, end: 22 },
                    expected: '\\documentclass{article}',
                    replacement: '\\documentclass{icml2026}',
                  },
                ],
              };
              ctx.stageEditPlan(plan, {
                title: 'Diff Review — Venue Studio',
                subtitle: 'Apply ICML template',
                historyLabel: 'Convert to ICML',
              });
            }}
          >
            Stage Venue Plan
          </button>
        </section>
      ),
    };

    render(
      <PrepTeXWorkspace
        brandLabel="PrepTeX Studio"
        initialFiles={{
          'main.tex': '\\documentclass{article}\n\\begin{document}\n\\section{Intro}\nHello\n\\end{document}\n',
        }}
        model={{
          viewStatus: 'ready',
          viewId: 'view-1',
          configuredRoot: MOCK_CONFIGURED_ROOT,
          coarseTree: {
            kind: 'coarse-tree',
            snapshotId: 'snap-1',
            viewId: 'view-1',
            resultId: 'coarse-1',
            nodeCount: 2,
            options: {
              includeSections: true,
              includeEnvironments: true,
              environmentFilter: null,
              includeCustomAndUndefinedCommands: true,
              includeInputs: true,
              includeBuiltinCommands: false,
              commandFilter: null,
              includeArguments: true,
              includeMath: false,
              includeDisplayMath: false,
              includeGroups: false,
              includeTextBlocks: false,
              maxPreviewLength: 80,
            },
            root: {
              kind: 'root',
              id: 'coarse-root',
              occurrenceKey: 'root-1',
              selection: null,
              name: 'Document',
              previewText: '',
              editableName: false,
              location: LOC_ROOT,
              projectedRange: { line: 1, start: 0, end: 70 },
              children: [
                {
                  kind: 'section',
                  id: 'coarse-sec-1',
                  occurrenceKey: 'sec-1',
                  selection: null,
                  name: 'Intro',
                  previewText: 'Intro',
                  sectionLevel: 1,
                  starred: false,
                  editableName: true,
                  location: LOC_SEC,
                  projectedRange: { line: 3, start: 40, end: 55 },
                  children: [],
                },
              ],
            },
          },
        }}
        extraViews={[customView]}
        getExtraMenus={(ctx) => [
          {
            id: 'ai',
            label: 'AI',
            hasDotIndicator: true,
            items: [
              {
                id: 'open-venue',
                label: 'Venue Studio…',
                hint: 'Convert template',
                onSelect: () => ctx.layout.selectView('venue-studio'),
              },
            ],
          },
        ]}
        getExtraFileMenuItems={() => [
          {
            id: 'sync-cloud',
            label: 'Sync with server',
            hint: 'Saved',
            onSelect: () => {},
          },
        ]}
        getExtraEditMenuItems={(ctx) => [
          {
            id: 'ai-split',
            label: 'AI Short/Long…',
            onSelect: () => ctx.layout.selectView('venue-studio'),
          },
        ]}
        renderHeaderRightSlot={() => <span data-testid="custom-header-slot">Synced</span>}
        renderAstNodeActions={(node) => (
          <button type="button" className="action-btn">
            AI Split ({node.kind})
          </button>
        )}
        renderDiagnosticsActions={() => (
          <button type="button" className="LogDialogBtn LogDialogBtn--secondary">
            Check Venue Rules
          </button>
        )}
        renderOperationsExtraContent={() => <div>Custom Transform Card</div>}
        onFilesChange={onFilesChange}
      />,
    );

    expect(screen.getByText('PrepTeX Studio')).toBeInTheDocument();
    expect(screen.getByTestId('custom-header-slot')).toHaveTextContent('Synced');
    expect(onFilesChange).toHaveBeenCalled();

    // Custom File and Edit items exist
    fireEvent.click(screen.getByRole('menuitem', { name: /^File$/i }));
    expect(within(screen.getByRole('menu', { name: 'File menu' })).getByRole('menuitem', { name: /sync with server/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /^Edit$/i }));
    expect(within(screen.getByRole('menu', { name: 'Edit menu' })).getByRole('menuitem', { name: /ai short\/long/i })).toBeInTheDocument();

    // Custom AI top-level menu navigates to custom view
    fireEvent.click(screen.getByRole('menuitem', { name: /^AI$/i }));
    const aiMenu = screen.getByRole('menu', { name: 'AI menu' });
    fireEvent.click(within(aiMenu).getByRole('menuitem', { name: /venue studio/i }));

    const venueRegion = await screen.findByRole('region', { name: 'Venue Studio' });
    expect(within(venueRegion).getByText('Entry: main.tex')).toBeInTheDocument();

    // Custom view stages an external ProjectEditPlan into Diff Review and records custom undo label
    fireEvent.click(within(venueRegion).getByRole('button', { name: 'Stage Venue Plan' }));
    const diffRegion = await screen.findByRole('region', { name: 'Diff Review' });
    expect(within(diffRegion).getByText('Diff Review — Venue Studio')).toBeInTheDocument();
    expect(within(diffRegion).getByText('Apply ICML template')).toBeInTheDocument();

    fireEvent.click(within(diffRegion).getAllByRole('button', { name: /apply edits to sources/i })[0]!);
    await waitFor(() => {
      expect(screen.getByText(/\\documentclass\{icml2026\}/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: /^Edit$/i }));
    expect(within(screen.getByRole('menu', { name: 'Edit menu' })).getByRole('menuitem', { name: /undo: convert to icml/i })).toBeInTheDocument();

    // Custom Diagnostics header button
    fireEvent.click(screen.getByRole('menuitem', { name: /^View/i }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Views drawer' })).getByRole('menuitemradio', { name: /diagnostics/i }));
    expect(await screen.findByRole('button', { name: 'Check Venue Rules' })).toBeInTheDocument();

    // Custom Transformations extra content
    fireEvent.click(screen.getByRole('menuitem', { name: /^View/i }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Views drawer' })).getByRole('menuitemradio', { name: /transformations/i }));
    expect(await screen.findByText('Custom Transform Card')).toBeInTheDocument();

    // Custom AST node action appears when selecting an AST node
    fireEvent.click(screen.getByRole('menuitem', { name: /^View/i }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Views drawer' })).getByRole('menuitemradio', { name: /^AST\b/i }));
    const sectionBtn = await screen.findByRole('button', { name: /Intro/i });
    fireEvent.click(sectionBtn);
    expect(await screen.findByRole('button', { name: /AI Split \(section\)/i })).toBeInTheDocument();
  });

  it('supports extra actions in WelcomeEmptyState', () => {
    render(
      <PrepTeXWorkspace
        renderEmptyStateActions={() => (
          <button type="button" className="WelcomeBtn">
            Open Saved Project
          </button>
        )}
      />,
    );
    expect(screen.getByRole('button', { name: 'Open Saved Project' })).toBeInTheDocument();
  });
});
