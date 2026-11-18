import type {
  CoarseTree,
  ConfiguredContainerNode,
  ConfiguredNode,
  NodeLocation,
  SourceToken,
} from '@preptex/core';
import { TreeLayoutBuilder } from './treebuilder';
import type { LayoutNode } from '../../types/LayoutNode';

function flatten(node: LayoutNode): readonly LayoutNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

const ORIGIN_1 = {
  snapshotId: 'snap-1',
  occurrenceId: 'occ-1',
  path: 'main.tex',
  version: 1,
  range: { line: 1, start: 0, end: 16 },
} as const;

const MOCK_LOC: NodeLocation = {
  kind: 'single',
  primary: ORIGIN_1,
  spans: [ORIGIN_1],
};

function makeLocation(line: number, start: number, end: number): NodeLocation {
  const origin = {
    snapshotId: 'snap-1',
    occurrenceId: 'occ-1',
    path: 'main.tex',
    version: 1,
    range: { line, start, end },
  } as const;
  return { kind: 'single', primary: origin, spans: [origin] };
}

test('buildConfigured converts starred sections, command tokens, environments, and math delimiters', () => {
  const root: ConfiguredContainerNode & { readonly kind: 'root' } = Object.freeze({
    kind: 'root',
    viewId: 'view-1',
    occurrenceKey: 'root-1',
    projectedRange: { line: 1, start: 0, end: 60 },
    origins: [],
    location: MOCK_LOC,
    children: Object.freeze<ConfiguredNode[]>([
      {
        kind: 'section',
        level: 1,
        starred: true,
        name: 'Title',
        viewId: 'view-1',
        occurrenceKey: 'sec-1',
        projectedRange: { line: 1, start: 0, end: 16 },
        origins: [],
        location: MOCK_LOC,
        arguments: [],
        children: [
          {
            kind: 'command',
            name: 'custom',
            starred: false,
            viewId: 'view-1',
            occurrenceKey: 'cmd-1',
            projectedRange: { line: 2, start: 18, end: 30 },
            origins: [],
            location: makeLocation(2, 18, 30),
            arguments: [],
            children: [],
          },
          {
            kind: 'math',
            delimiter: '$',
            viewId: 'view-1',
            occurrenceKey: 'math-1',
            projectedRange: { line: 2, start: 32, end: 34 },
            origins: [],
            location: MOCK_LOC,
            children: [],
          },
          {
            kind: 'environment',
            name: 'itemize',
            viewId: 'view-1',
            occurrenceKey: 'env-1',
            projectedRange: { line: 3, start: 36, end: 60 },
            origins: [],
            location: makeLocation(3, 36, 60),
            syntax: { opening: null, closing: null, body: null, hasArguments: false },
            arguments: [],
            children: [],
          },
        ],
      },
    ]),
  });

  const before = JSON.stringify(root);
  const layout = new TreeLayoutBuilder().buildConfigured(root);
  const nodes = flatten(layout);

  expect(layout.kind).toBe('root');
  expect(nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'section', isStarred: true, data: 'Title', line: 1 }),
      expect.objectContaining({ kind: 'command', data: 'custom', line: 2 }),
      expect.objectContaining({ kind: 'math', data: '$' }),
      expect.objectContaining({ kind: 'environment', data: 'itemize', path: 'main.tex', line: 3 }),
    ]),
  );
  expect(nodes[0]?.occurrenceKey).toBeDefined();
  expect(JSON.stringify(root)).toBe(before);
  expect(Object.isFrozen(root.children)).toBe(true);
});

test('buildSourceTokens creates layout hierarchy for raw source tokens', () => {
  const tokens: readonly SourceToken[] = [
    { index: 0, kind: 'text', value: 'Hello ', name: '', range: { line: 1, start: 0, end: 5 } },
    { index: 1, kind: 'command', value: '\\emph', name: 'emph', range: { line: 1, start: 6, end: 10 } },
    { index: 2, kind: 'open', value: '{', name: '', range: { line: 1, start: 11, end: 11 } },
    { index: 3, kind: 'text', value: 'world', name: '', range: { line: 1, start: 12, end: 16 } },
    { index: 4, kind: 'close', value: '}', name: '', range: { line: 1, start: 17, end: 17 } },
    { index: 5, kind: 'comment', value: '% note', name: '', range: { line: 1, start: 19, end: 24 } },
  ];

  const layout = new TreeLayoutBuilder().buildSourceTokens('main.tex', tokens);
  expect(layout.kind).toBe('root');
  expect(layout.path).toBe('main.tex');
  expect(layout.children.length).toBeGreaterThan(0);
  expect(layout.children[0]?.path).toBe('main.tex');
  expect(layout.children.some((c) => c.kind === 'command' && c.data === 'emph')).toBe(true);
  expect(layout.children.some((c) => c.kind === 'comment')).toBe(true);
});

test('buildCoarse maps coarse tree sections, environments, commands, and argument child nodes', () => {
  const coarse: CoarseTree = {
    kind: 'coarse-tree',
    snapshotId: 'snap-1',
    viewId: 'view-1',
    resultId: 'coarse-1',
    nodeCount: 6,
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
      id: 'root-1',
      occurrenceKey: 'root-1',
      selection: null,
      name: 'Document',
      previewText: '',
      editableName: false,
      location: MOCK_LOC,
      projectedRange: { line: 1, start: 0, end: 60 },
      children: [
        {
          kind: 'section',
          id: 'sec-1',
          occurrenceKey: 'sec-1',
          selection: null,
          name: 'Intro',
          previewText: 'Intro',
          sectionLevel: 1,
          starred: false,
          editableName: true,
          location: MOCK_LOC,
          projectedRange: { line: 1, start: 0, end: 60 },
          children: [
            {
              kind: 'command',
              id: 'cmd-1',
              occurrenceKey: 'cmd-1',
              selection: null,
              name: 'custom',
              previewText: '[opt]{Hello}',
              editableName: true,
              location: MOCK_LOC,
              projectedRange: { line: 2, start: 18, end: 36 },
              children: [
                {
                  kind: 'argument',
                  id: 'arg-1',
                  occurrenceKey: 'arg-1',
                  selection: null,
                  name: '[#1]',
                  previewText: 'opt',
                  argumentInfo: {
                    argKind: 'optional',
                    slot: 0,
                    delimiter: 'bracket',
                    opaque: false,
                  },
                  editableName: false,
                  location: MOCK_LOC,
                  projectedRange: { line: 2, start: 25, end: 29 },
                  children: [],
                },
                {
                  kind: 'argument',
                  id: 'arg-2',
                  occurrenceKey: 'arg-2',
                  selection: null,
                  name: '{#2}',
                  previewText: 'Hello',
                  argumentInfo: {
                    argKind: 'mandatory',
                    slot: 1,
                    delimiter: 'braced',
                    opaque: false,
                  },
                  editableName: false,
                  location: MOCK_LOC,
                  projectedRange: { line: 2, start: 30, end: 36 },
                  children: [],
                },
              ],
            },
            {
              kind: 'environment',
              id: 'env-1',
              occurrenceKey: 'env-1',
              selection: null,
              name: 'itemize',
              previewText: 'One',
              editableName: true,
              location: MOCK_LOC,
              projectedRange: { line: 3, start: 38, end: 60 },
              children: [],
            },
          ],
        },
      ],
    },
  };

  const layout = new TreeLayoutBuilder().buildCoarse(coarse);
  const nodes = flatten(layout);

  expect(nodes.some((n) => n.kind === 'section' && n.data === 'Intro')).toBe(true);
  expect(nodes.some((n) => n.kind === 'command' && n.data === 'custom')).toBe(true);
  expect(nodes.some((n) => n.kind === 'argument' && n.sublabel === '[#1]')).toBe(true);
  expect(nodes.some((n) => n.kind === 'argument' && n.sublabel === '{#2}')).toBe(true);
  expect(nodes.some((n) => n.kind === 'environment' && n.data === 'itemize')).toBe(true);
  expect(nodes.some((n) => n.kind === 'command' && n.data === 'textbf')).toBe(false);
});
