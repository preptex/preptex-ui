import { fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import * as PublicUi from './index';

describe('@preptex/ui public API & edge cases', () => {
  it('exports all documented components, hooks, constants, and pure utilities from the public entry', () => {
    expect(typeof PublicUi.PrepTeXWorkspace).toBe('function');
    expect(typeof PublicUi.usePrepTeXWorkspace).toBe('function');
    expect(typeof PublicUi.WorkspaceHeader).toBe('function');
    expect(typeof PublicUi.WelcomeEmptyState).toBe('function');
    expect(typeof PublicUi.Filetree).toBe('function');
    expect(typeof PublicUi.Codeview).toBe('function');
    expect(typeof PublicUi.ASTview).toBe('function');
    expect(typeof PublicUi.TreeNode).toBe('function');
    expect(typeof PublicUi.TreeLayoutBuilder).toBe('function');
    expect(typeof PublicUi.NodeActionBar).toBe('function');
    expect(typeof PublicUi.ControlPanel).toBe('function');
    expect(typeof PublicUi.OperationsDialog).toBe('function');
    expect(typeof PublicUi.CatalogDialog).toBe('function');
    expect(typeof PublicUi.MetadataDialog).toBe('function');
    expect(typeof PublicUi.LogDialog).toBe('function');
    expect(typeof PublicUi.LogPanel).toBe('function');
    expect(typeof PublicUi.EditPreviewDialog).toBe('function');
    expect(typeof PublicUi.ProjectSetupDialog).toBe('function');
    expect(typeof PublicUi.ConfigurationSummary).toBe('function');

    expect(typeof PublicUi.useFiles).toBe('function');
    expect(typeof PublicUi.useProjectConfiguration).toBe('function');
    expect(typeof PublicUi.useWorkspaceLayout).toBe('function');
    expect(typeof PublicUi.useControl).toBe('function');
    expect(typeof PublicUi.useArtifacts).toBe('function');

    expect(typeof PublicUi.applyProjectEditsToFilesMap).toBe('function');
    expect(typeof PublicUi.getOperationHistoryLabel).toBe('function');
    expect(typeof PublicUi.recommendEntry).toBe('function');
    expect(typeof PublicUi.createZipArchive).toBe('function');
    expect(typeof PublicUi.readZipFileNames).toBe('function');
    expect(typeof PublicUi.filterUploadedBatch).toBe('function');
    expect(typeof PublicUi.buildNewFileOutputs).toBe('function');
    expect(PublicUi.DEFAULT_DEMO_PROJECT_FILES['main.tex']).toContain('\\documentclass');

    // Ensure core runtime adapters are NOT exported by @preptex/ui
    expect('createProjectSnapshotAdapter' in PublicUi).toBe(false);
    expect('useProjectModel' in PublicUi).toBe(false);
    expect('useOperations' in PublicUi).toBe(false);
  });

  it('applies replacement and insertion ProjectEdits across multiple files via applyProjectEditsToFilesMap', () => {
    const initial = {
      'main.tex': 'Hello World',
      'sub.tex': 'Alpha Beta',
    };
    const updated = PublicUi.applyProjectEditsToFilesMap(initial, [
      {
        kind: 'replace',
        path: 'main.tex',
        range: { line: 1, start: 6, end: 10 },
        expected: 'World',
        replacement: 'PrepTeX',
      },
      {
        kind: 'insert',
        path: 'sub.tex',
        offset: 5,
        text: ' &',
      },
    ]);

    expect(updated['main.tex']).toBe('Hello PrepTeX');
    expect(updated['sub.tex']).toBe('Alpha & Beta');
  });

  it('resolves custom and default operation history labels', () => {
    expect(PublicUi.getOperationHistoryLabel('realize-conditions')).toBe('Condition realization');
    expect(
      PublicUi.getOperationHistoryLabel('venue-convert', {
        'venue-convert': 'Convert to NeurIPS',
      }),
    ).toBe('Convert to NeurIPS');
    expect(PublicUi.getOperationHistoryLabel(undefined)).toBe('Transformation');
  });

  it('throws a clear error when usePrepTeXWorkspace is called outside PrepTeXWorkspace', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => PublicUi.usePrepTeXWorkspace())).toThrow(
      /usePrepTeXWorkspace must be used inside a PrepTeXWorkspace/i,
    );
    spy.mockRestore();
  });

  it('supports keyboard navigation across built-in and custom menus in WorkspaceHeader', () => {
    render(
      <PublicUi.PrepTeXWorkspace
        initialFiles={{ 'main.tex': 'Hello' }}
        getExtraMenus={() => [
          {
            id: 'ai',
            label: 'AI',
            items: [
              { id: 'short-long', label: 'Short/Long Split', onSelect: () => {} },
              { id: 'venue', label: 'Venue Adapter', onSelect: () => {} },
            ],
          },
        ]}
      />,
    );

    const fileTrigger = screen.getByRole('menuitem', { name: /^File$/i });
    fireEvent.click(fileTrigger);
    const fileMenu = screen.getByRole('menu', { name: 'File menu' });
    expect(fileMenu).toBeInTheDocument();

    // ArrowRight moves from File -> Edit -> AI -> View
    fireEvent.keyDown(fileMenu, { key: 'ArrowRight' });
    expect(screen.getByRole('menu', { name: 'Edit menu' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('menu', { name: 'Edit menu' }), { key: 'ArrowRight' });
    const aiMenu = screen.getByRole('menu', { name: 'AI menu' });
    expect(aiMenu).toBeInTheDocument();

    // ArrowDown / ArrowUp / Home / End navigate items inside AI menu
    fireEvent.keyDown(aiMenu, { key: 'ArrowDown' });
    expect(within(aiMenu).getByRole('menuitem', { name: /Short\/Long Split/i })).toHaveFocus();
    fireEvent.keyDown(aiMenu, { key: 'End' });
    expect(within(aiMenu).getByRole('menuitem', { name: /Venue Adapter/i })).toHaveFocus();
    fireEvent.keyDown(aiMenu, { key: 'Home' });
    expect(within(aiMenu).getByRole('menuitem', { name: /Short\/Long Split/i })).toHaveFocus();

    // Escape closes the open menu
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'AI menu' })).toBeNull();
  });
});
