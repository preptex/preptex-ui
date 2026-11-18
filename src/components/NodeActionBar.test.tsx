import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeActionBar } from './NodeActionBar';
import type { ConfiguredNode } from '@preptex/core';

describe('NodeActionBar', () => {
  const mockEnvNode: ConfiguredNode = {
    kind: 'environment',
    name: 'itemize',
    viewId: 'view-1',
    occurrenceKey: 'env-1',
    projectedRange: { line: 1, start: 0, end: 50 },
    origins: [],
    location: {
      kind: 'single',
      primary: {
        snapshotId: 'snap-1',
        occurrenceId: 'occ-1',
        path: 'main.tex',
        version: 1,
        range: { line: 5, start: 25, end: 75 },
      },
      spans: [
        {
          snapshotId: 'snap-1',
          occurrenceId: 'occ-1',
          path: 'main.tex',
          version: 1,
          range: { line: 5, start: 25, end: 75 },
        },
      ],
    },
    syntax: {
      opening: null,
      closing: null,
      body: null,
      hasArguments: false,
    },
    arguments: [],
    children: [],
  };

  it('renders nothing when no node is selected', () => {
    render(
      <NodeActionBar
        selectedNode={null}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={jest.fn()}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole('region', { name: /selected node actions/i }),
    ).not.toBeInTheDocument();
  });

  it('displays selected environment info and action controls', () => {
    render(
      <NodeActionBar
        selectedNode={mockEnvNode}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={jest.fn()}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );

    expect(screen.getByText(/selected environment/i)).toBeInTheDocument();
    expect(screen.getByText(/itemize/i)).toBeInTheDocument();
    expect(screen.getByText(/line 5/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove node/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wrap/i })).toBeInTheDocument();
  });

  it('triggers onRemoveNode on remove click', () => {
    const onRemove = jest.fn();
    render(
      <NodeActionBar
        selectedNode={mockEnvNode}
        onRemoveNode={onRemove}
        onRenameEnvironment={jest.fn()}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /remove node/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('triggers onRenameEnvironment with entered name', () => {
    const onRename = jest.fn();
    render(
      <NodeActionBar
        selectedNode={mockEnvNode}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={onRename}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(/new name/i);
    fireEvent.change(input, { target: { value: 'enumerate' } });
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    expect(onRename).toHaveBeenCalledWith('enumerate');
  });

  it('triggers onWrapNode with entered wrapper name', () => {
    const onWrap = jest.fn();
    render(
      <NodeActionBar
        selectedNode={mockEnvNode}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={jest.fn()}
        onWrapNode={onWrap}
        onClearSelection={jest.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(/wrapper name/i);
    fireEvent.change(input, { target: { value: 'center' } });
    fireEvent.click(screen.getByRole('button', { name: /wrap/i }));
    expect(onWrap).toHaveBeenCalledWith('center');
  });

  it('supports renaming commands, sections, unwrapping, global env rename, and setting custom args', () => {
    const cmdNode: ConfiguredNode = {
      kind: 'command',
      name: 'mycmd',
      starred: false,
      viewId: 'view-1',
      occurrenceKey: 'cmd-1',
      projectedRange: { line: 2, start: 16, end: 32 },
      origins: [],
      location: mockEnvNode.location,
      arguments: [],
      children: [],
    };
    const secNode: ConfiguredNode = {
      kind: 'section',
      level: 1,
      starred: false,
      name: 'Intro',
      viewId: 'view-1',
      occurrenceKey: 'sec-1',
      projectedRange: { line: 1, start: 0, end: 15 },
      origins: [],
      location: mockEnvNode.location,
      arguments: [],
      children: [],
    };
    const envNode: ConfiguredNode = {
      ...mockEnvNode,
      name: 'enumerate',
    };

    const onRenameCmd = jest.fn();
    const onRenameCmdGlobal = jest.fn();
    const onUpsert = jest.fn();
    const onUnwrap = jest.fn();
    const onRenameSec = jest.fn();
    const onRenameEnvGlobal = jest.fn();

    const { rerender } = render(
      <NodeActionBar
        selectedNode={cmdNode}
        customCommands={[{ name: 'mycmd', optionalArgs: 1, mandatoryArgs: 1 }]}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={jest.fn()}
        onRenameCommand={onRenameCmd}
        onRenameCommandGlobally={onRenameCmdGlobal}
        onUpsertCustomCommand={onUpsert}
        onUnwrapNode={onUnwrap}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('New command name'), { target: { value: 'othercmd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(onRenameCmd).toHaveBeenCalledWith('othercmd');

    fireEvent.change(screen.getByLabelText('Mandatory arguments'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reparse args' }));
    expect(onUpsert).toHaveBeenCalledWith({
      name: 'mycmd',
      optionalArgs: 1,
      mandatoryArgs: 2,
    });

    rerender(
      <NodeActionBar
        selectedNode={secNode}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={jest.fn()}
        onRenameSection={onRenameSec}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Section level'), { target: { value: 'subsection' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update level' }));
    expect(onRenameSec).toHaveBeenCalledWith('subsection', false);

    rerender(
      <NodeActionBar
        selectedNode={envNode}
        onRemoveNode={jest.fn()}
        onRenameEnvironment={jest.fn()}
        onRenameEnvironmentGlobally={onRenameEnvGlobal}
        onUnwrapNode={onUnwrap}
        onWrapNode={jest.fn()}
        onClearSelection={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('New environment name'), { target: { value: 'itemize' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename all' }));
    expect(onRenameEnvGlobal).toHaveBeenCalledWith('enumerate', 'itemize');

    fireEvent.click(screen.getByRole('button', { name: 'Unwrap' }));
    expect(onUnwrap).toHaveBeenCalledTimes(1);
  });
});
