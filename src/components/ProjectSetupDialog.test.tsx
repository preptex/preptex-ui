import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ProjectView } from '@preptex/core';
import { ProjectSetupDialog } from './ProjectSetupDialog';
import { ConfigurationSummary } from './ConfigurationSummary';
import { DEFAULT_CONFIGURATION } from '../model/useProjectConfiguration';

describe('ProjectSetupDialog & ConfigurationSummary', () => {
  const defaultFiles = {
    'main.tex': '\\newif\\ifdraft\\drafttrue',
    'part.tex': 'Part',
  };

  it('does not render when isOpen is false', () => {
    render(
      <ProjectSetupDialog
        isOpen={false}
        onClose={() => {}}
        files={defaultFiles}
        configuration={DEFAULT_CONFIGURATION}
        onApply={() => {}}
        detectedConditions={['draft']}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders modal dialog and detected conditions when open', () => {
    render(
      <ProjectSetupDialog
        isOpen={true}
        onClose={() => {}}
        files={defaultFiles}
        configuration={{
          ...DEFAULT_CONFIGURATION,
          conditionPolicy: { mode: 'source-with-overrides', overrides: {} },
        }}
        onApply={() => {}}
        detectedConditions={['draft']}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('\\ifdraft')).toBeInTheDocument();
  });

  it('commits draft configuration including condition-free mode none when Apply is clicked', () => {
    const handleApply = jest.fn();
    const handleClose = jest.fn();

    render(
      <ProjectSetupDialog
        isOpen={true}
        onClose={handleClose}
        files={defaultFiles}
        configuration={DEFAULT_CONFIGURATION}
        onApply={handleApply}
        detectedConditions={['draft']}
      />,
    );

    const select = screen.getByLabelText(/Project Entry File/i);
    fireEvent.change(select, { target: { value: 'main.tex' } });

    const policySelect = screen.getByLabelText(/Condition Evaluation Policy/i);
    fireEvent.change(policySelect, { target: { value: 'none' } });

    expect(handleApply).not.toHaveBeenCalled();

    const applyButton = screen.getByText(/Apply Configuration/i);
    fireEvent.click(applyButton);

    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({
        entryPath: 'main.tex',
        conditionPolicy: { mode: 'none' },
      }),
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it('closes dialog without applying when Continue inspecting sources is clicked', () => {
    const handleApply = jest.fn();
    const handleClose = jest.fn();

    render(
      <ProjectSetupDialog
        isOpen={true}
        onClose={handleClose}
        files={defaultFiles}
        configuration={DEFAULT_CONFIGURATION}
        onApply={handleApply}
        detectedConditions={['draft']}
      />,
    );

    const closeBtn = screen.getByText(/Continue inspecting sources/i);
    fireEvent.click(closeBtn);

    expect(handleApply).not.toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders ConfigurationSummary with Ready and Blocked unrealized-condition status', () => {
    const origin = {
      snapshotId: 'snap-1',
      occurrenceId: 'occ-1',
      path: 'main.tex',
      version: 1,
      range: { line: 1, start: 0, end: 4 },
    } as const;

    const readyView: ProjectView = {
      id: 'view-ready',
      kind: 'view',
      status: 'ready',
      snapshotId: 'snap-1',
      snapshot: {
        id: 'snap-1',
        kind: 'snapshot',
        coreVersion: '0.6.2',
        schemaVersion: 1,
        scanOptions: { verbatimEnvironments: [], maxNesting: 64 },
        files: [],
      },
      configuration: {
        entryPath: 'main.tex',
        traversal: 'project',
        inputs: 'command',
        conditions: { mode: 'source' },
        profile: 'direct-latex-v1',
        inferDefinedCommands: true,
        customCommands: [],
        limits: {
          maxInputDepth: 64,
          maxOccurrences: 10000,
          maxNesting: 256,
          maxSelectedCodeUnits: 10000000,
        },
      },
      decisions: [],
      occurrences: [],
      reachedFacts: [],
      selectedTokens: [],
      coverage: {
        status: 'complete',
        profile: 'direct-latex-v1',
        assumptions: [],
        issues: [],
      },
      root: {
        kind: 'root',
        viewId: 'view-ready',
        occurrenceKey: 'root-1',
        projectedRange: { line: 1, start: 0, end: 4 },
        origins: [],
        location: {
          kind: 'single',
          primary: origin,
          spans: [origin],
        },
        children: [],
      },
    };

    const { rerender } = render(
      <ConfigurationSummary
        configuration={{ ...DEFAULT_CONFIGURATION, entryPath: 'main.tex' }}
        view={readyView}
        onOpenSettings={() => {}}
      />,
    );

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('main.tex')).toBeInTheDocument();

    const blockedView: ProjectView = {
      id: 'view-blocked',
      kind: 'view',
      status: 'blocked',
      snapshotId: 'snap-1',
      snapshot: readyView.snapshot,
      configuration: {
        ...readyView.configuration,
        conditions: { mode: 'none' },
      },
      decisions: [],
      occurrences: [],
      reachedFacts: [],
      selectedTokens: [],
      coverage: {
        status: 'partial',
        profile: 'direct-latex-v1',
        assumptions: [],
        issues: [],
      },
      root: null,
      reason: {
        code: 'unrealized-condition',
        severity: 'error',
        message: 'Unrealized condition in source.',
        location: null,
        inputChain: [],
      },
    };

    rerender(
      <ConfigurationSummary
        configuration={{
          ...DEFAULT_CONFIGURATION,
          entryPath: 'main.tex',
          conditionPolicy: { mode: 'none' },
        }}
        view={blockedView}
        onOpenSettings={() => {}}
      />,
    );

    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('unrealized-condition')).toBeInTheDocument();
    expect(screen.getByText('Condition-free (none)')).toBeInTheDocument();
  });
});
