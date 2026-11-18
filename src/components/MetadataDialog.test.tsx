import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ProjectMetadata } from '@preptex/core';
import { MetadataDialog } from './MetadataDialog';

const MOCK_LOC = {
  snapshotId: 'snap-1',
  occurrenceId: 'occ-1',
  path: 'main.tex',
  range: { line: 3, start: 30, end: 60 },
} as const;

const MOCK_METADATA: ProjectMetadata = {
  kind: 'metadata',
  snapshotId: 'snap-1',
  viewId: 'view-1',
  resultId: 'meta-1',
  title: {
    text: 'Full Paper Title',
    rawSource: 'Full Paper Title',
    shortText: 'Short',
    location: MOCK_LOC,
    contentLocation: MOCK_LOC,
    nodeKey: 'title-1',
  },
  authors: [
    {
      name: 'Alice',
      rawSource: 'Alice',
      notes: [],
      location: MOCK_LOC,
    },
    {
      name: 'Bob',
      rawSource: 'Bob\\thanks{MIT}',
      notes: ['MIT'],
      location: MOCK_LOC,
    },
  ],
  rawAuthorField: {
    text: 'Alice and Bob',
    rawSource: 'Alice \\and Bob\\thanks{MIT}',
    shortText: null,
    location: MOCK_LOC,
    contentLocation: MOCK_LOC,
    nodeKey: 'author-1',
  },
  date: {
    text: 'November 2026',
    rawSource: 'November 2026',
    shortText: null,
    location: MOCK_LOC,
    contentLocation: MOCK_LOC,
    nodeKey: 'date-1',
  },
  abstract: {
    text: 'Paper abstract text.',
    rawSource: 'Paper abstract text.',
    shortText: null,
    location: MOCK_LOC,
    contentLocation: MOCK_LOC,
    nodeKey: 'abs-1',
  },
  documentClass: {
    name: 'article',
    options: ['11pt'],
    location: MOCK_LOC,
  },
  packages: [
    {
      names: ['amsmath'],
      options: [],
      location: MOCK_LOC,
    },
  ],
  bibliography: {
    style: null,
    resources: [],
    locations: [],
  },
  keywords: [],
  stats: {
    totalFiles: 1,
    reachedFiles: 1,
    sectionCount: 1,
    environmentCount: 1,
    commandUseCount: 5,
    introducedCommandCount: 0,
    undefinedCommandCount: 0,
    mathCount: 1,
    figureCount: 0,
    tableCount: 0,
    citationCount: 0,
    labelCount: 0,
    referenceCount: 0,
  },
};

describe('MetadataDialog', () => {
  it('displays metadata fields and statistics and submits direct title edit', () => {
    const onEditMetadata = jest.fn();

    render(
      <MetadataDialog
        isOpen
        onClose={jest.fn()}
        metadata={MOCK_METADATA}
        onEditMetadata={onEditMetadata}
        onSelectLocation={jest.fn()}
      />,
    );

    expect(screen.getByText('Full Paper Title')).toBeInTheDocument();
    expect(screen.getByText('Paper abstract text.')).toBeInTheDocument();
    expect(screen.getByText(/Parsed Authors \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('amsmath')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Title' }));
    fireEvent.change(screen.getByLabelText('Title value'), {
      target: { value: 'Revised Title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview Title Edit' }));

    expect(onEditMetadata).toHaveBeenCalledWith({
      kind: 'edit-metadata',
      field: 'title',
      newValue: 'Revised Title',
      shortValue: 'Short',
    });
  });
});
