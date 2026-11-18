import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CatalogCommandEntry, ProjectCatalog } from '@preptex/core';
import { CatalogDialog } from './CatalogDialog';

const HI_COMMAND: CatalogCommandEntry = {
  name: 'hi',
  category: 'introduced-used',
  signature: {
    optionalArgs: 0,
    mandatoryArgs: 1,
    allowStar: true,
    source: 'inferred-definition',
  },
  definitions: [
    {
      id: 'def-hi',
      name: 'hi',
      form: 'newcommand',
      starred: false,
      numArgs: 1,
      defaultArg: null,
      bodySource: 'Hello #1',
      nameRange: { line: 1, start: 13, end: 14 },
      arguments: [],
      bodyRange: { line: 1, start: 19, end: 26 },
      location: {
        snapshotId: 'snap-1',
        occurrenceId: 'occ-1',
        path: 'main.tex',
        range: { line: 1, start: 0, end: 27 },
      },
    },
  ],
  occurrences: [
    {
      location: {
        snapshotId: 'snap-1',
        occurrenceId: 'occ-1',
        path: 'main.tex',
        range: { line: 6, start: 100, end: 109 },
      },
      commandTokenRange: { line: 6, start: 100, end: 102 },
      fullRange: { line: 6, start: 100, end: 109 },
      selection: null,
      starred: false,
      argumentRanges: [],
      inDefinitionBody: false,
      inOpaqueArgument: false,
    },
  ],
  canRenameGlobally: true,
};

const UNDEF_COMMAND: CatalogCommandEntry = {
  name: 'undefcmd',
  category: 'used-undefined',
  signature: {
    optionalArgs: 0,
    mandatoryArgs: 0,
    allowStar: true,
    source: 'none',
  },
  definitions: [],
  occurrences: [
    {
      location: {
        snapshotId: 'snap-1',
        occurrenceId: 'occ-1',
        path: 'main.tex',
        range: { line: 6, start: 111, end: 125 },
      },
      commandTokenRange: { line: 6, start: 111, end: 119 },
      fullRange: { line: 6, start: 111, end: 125 },
      selection: null,
      starred: false,
      argumentRanges: [],
      inDefinitionBody: false,
      inOpaqueArgument: false,
    },
  ],
  canRenameGlobally: true,
};

const MOCK_CATALOG: ProjectCatalog = {
  kind: 'catalog',
  snapshotId: 'snap-1',
  viewId: 'view-1',
  resultId: 'cat-1',
  commands: [HI_COMMAND, UNDEF_COMMAND],
  introducedCommands: [HI_COMMAND],
  usedCommands: [HI_COMMAND, UNDEF_COMMAND],
  usedUndefinedCommands: [UNDEF_COMMAND],
  environments: [
    {
      name: 'boxenv',
      category: 'introduced-used',
      definitions: [],
      occurrences: [
        {
          location: {
            snapshotId: 'snap-1',
            occurrenceId: 'occ-1',
            path: 'main.tex',
            range: { line: 8, start: 140, end: 170 },
          },
          selection: null,
          environmentSelection: null,
          openingNameRange: { line: 8, start: 147, end: 152 },
          closingNameRange: { line: 8, start: 164, end: 169 },
          hasArguments: false,
          status: 'matched',
        },
      ],
      canRenameGlobally: true,
    },
  ],
  introducedEnvironments: [],
  usedEnvironments: [],
  conditions: [],
  introducedConditions: [],
  usedConditions: [],
  labels: [
    {
      key: 'sec:intro',
      category: 'introduced-used',
      declarations: [],
      occurrences: [],
      canRenameGlobally: true,
    },
  ],
  introducedLabels: [],
  usedLabels: [],
  usedUndefinedLabels: [],
  citations: [
    {
      key: 'k1',
      category: 'introduced-used',
      definitions: [],
      occurrences: [],
      canRenameGlobally: true,
    },
  ],
  introducedCitations: [],
  usedCitations: [],
};

describe('CatalogDialog', () => {
  it('displays commands, filters to undefined commands, sets custom arguments, and jumps to occurrences', () => {
    const onUpsert = jest.fn();
    const onSelectLocation = jest.fn();
    const onRefactorSymbol = jest.fn();

    render(
      <CatalogDialog
        isOpen
        onClose={jest.fn()}
        catalog={MOCK_CATALOG}
        customCommands={[]}
        onUpsertCustomCommand={onUpsert}
        onRemoveCustomCommand={jest.fn()}
        onRefactorSymbol={onRefactorSymbol}
        onSelectLocation={onSelectLocation}
      />,
    );

    expect(screen.getByText('\\hi')).toBeInTheDocument();
    expect(screen.getByText('\\undefcmd')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Used Undefined' }));
    expect(screen.queryByText('\\hi')).not.toBeInTheDocument();
    expect(screen.getByText('\\undefcmd')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Optional arguments for \\undefcmd'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Mandatory arguments for \\undefcmd'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Set Args & Reparse/i }));
    expect(onUpsert).toHaveBeenCalledWith({
      name: 'undefcmd',
      optionalArgs: 1,
      mandatoryArgs: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: /1 uses/i }));
    fireEvent.click(screen.getByRole('button', { name: /main\.tex:6/i }));
    expect(onSelectLocation).toHaveBeenCalledTimes(1);
  });

  it('switches tabs to environments, conditions, labels, and citations and triggers global rename', () => {
    const onRefactorSymbol = jest.fn();

    render(
      <CatalogDialog
        isOpen
        onClose={jest.fn()}
        catalog={MOCK_CATALOG}
        customCommands={[]}
        onUpsertCustomCommand={jest.fn()}
        onRemoveCustomCommand={jest.fn()}
        onRefactorSymbol={onRefactorSymbol}
        onSelectLocation={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Environments/i }));
    expect(screen.getByText('boxenv')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New name for environment boxenv'), {
      target: { value: 'callout' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rename All environment boxenv' }));
    expect(onRefactorSymbol).toHaveBeenCalledWith({
      kind: 'rename-environment-globally',
      oldName: 'boxenv',
      newName: 'callout',
    });

    fireEvent.click(screen.getByRole('tab', { name: /Labels & Refs/i }));
    expect(screen.getByText('sec:intro')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Citations/i }));
    expect(screen.getByText('k1')).toBeInTheDocument();
  });
});
