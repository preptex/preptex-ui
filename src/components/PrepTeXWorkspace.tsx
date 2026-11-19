import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AnalysisFinding,
  CoarseTree,
  ConditionDecision,
  ConfiguredNode,
  GeneratedArtifact,
  ProjectCatalog,
  ProjectEdit,
  ProjectEditPlan,
  ProjectFilePath,
  ProjectIssue,
  ProjectMetadata,
  SourceLocation,
  SourceToken,
  SymbolRefactorAction,
} from '@preptex/core';
import './PrepTeXWorkspace.css';
import ASTview, { type AstStructureMode } from './astview/ASTview';
import { TreeLayoutBuilder } from './astview/treebuilder';
import CatalogDialog from './CatalogDialog';
import Codeview from './Codeview';
import type { UnifiedTransformRequest } from './ControlPanel';
import { EditPreviewDialog } from './EditPreviewDialog';
import Filetree from './Filetree';
import LogDialog from './LogDialog';
import MetadataDialog from './MetadataDialog';
import { NodeActionBar, type SectionCommandName } from './NodeActionBar';
import OperationsDialog from './OperationsDialog';
import { ProjectSetupDialog } from './ProjectSetupDialog';
import WelcomeEmptyState from './WelcomeEmptyState';
import WorkspaceHeader, {
  type WorkspaceCustomMenuDescriptor,
  type WorkspaceMenuItemDescriptor,
  type WorkspaceViewDescriptor,
} from './WorkspaceHeader';
import { useControl } from '../model/useControl';
import { useFiles } from '../model/useFiles';
import { recommendEntry, useProjectConfiguration } from '../model/useProjectConfiguration';
import { useWorkspaceLayout, type WorkspaceViewId } from '../model/useWorkspaceLayout';
import { downloadBlob, downloadZipArchive } from '../services/zip';
import type { ProcessingError } from '../types/errors';
import type { FilesMap } from '../types/files';
import type { LayoutNode } from '../types/LayoutNode';

export const DEFAULT_DEMO_PROJECT_FILES: FilesMap = {
  'main.tex': `\\documentclass[11pt]{article}
\\usepackage{amsmath}
\\newcommand{\\highlight}[1]{\\textbf{#1}}
\\newenvironment{notebox}{\\begin{quote}}{\\end{quote}}
\\newif\\ifdraft
\\drafttrue
\\title[PrepTeX Demo]{PrepTeX Phase 3 Workspace Demo}
\\author{Narek Bojikian \\and Alex Researcher\\thanks{PrepTeX Lab}}
\\date{November 2026}
\\begin{document}
\\maketitle
\\begin{abstract}
A concise summary of the structural TeX workspace.
\\end{abstract}

% Main section
\\section{Introduction}\\label{sec:intro}
This is a \\highlight{sample} document demonstrating PrepTeX processing.
Undefined call with arguments: \\badge[new]{ready}.
See Section~\\ref{sec:methods} and work~\\cite{knuth84}.

\\input{intro/history.tex}

\\begin{notebox}
Editable custom environment content.
\\end{notebox}

\\ifdraft
% Draft notes:
Draft notice: work in progress.
\\else
Final published version.
\\fi

\\begin{comment}
Internal development comment to remove.
\\end{comment}

\\section{Methods}\\label{sec:methods}
Reference to \\ref{sec:missing}.
\\begin{enumerate}
\\item First item
\\item Second item
\\end{enumerate}
\\begin{thebibliography}{9}
\\bibitem{knuth84} Donald Knuth, The TeXbook.
\\end{thebibliography}
\\end{document}
`,
  'intro/history.tex': `% Historical note in subfolder
\\subsection{Background}
Since 1984, \\highlight{TeX} has enabled structured mathematical typesetting across nested project files.
`,
};

export interface StagedEditMetadata {
  readonly title?: string;
  readonly subtitle?: string;
  readonly historyLabel?: string;
  readonly artifacts?: readonly GeneratedArtifact[];
  readonly issues?: readonly ProjectIssue[];
}

export function applyProjectEditsToFilesMap(
  filesByName: FilesMap,
  edits: readonly ProjectEdit[],
): FilesMap {
  const editsByPath = new Map<string, ProjectEdit[]>();
  for (const edit of edits) {
    const existing = editsByPath.get(edit.path) ?? [];
    existing.push(edit);
    editsByPath.set(edit.path, existing);
  }

  const nextFiles: Record<string, string> = { ...filesByName };
  editsByPath.forEach((fileEdits, filePath) => {
    const source = filesByName[filePath];
    if (source === undefined || fileEdits.length === 0) return;
    let pos = 0;
    const chunks: string[] = [];
    for (const edit of fileEdits) {
      const start = edit.kind === 'replace' ? edit.range.start : edit.offset;
      const end = edit.kind === 'replace' ? edit.range.end + 1 : edit.offset;
      const text = edit.kind === 'replace' ? edit.replacement : edit.text;
      chunks.push(source.slice(pos, start), text);
      pos = end;
    }
    chunks.push(source.slice(pos));
    nextFiles[filePath] = chunks.join('');
  });

  return nextFiles;
}

function normalizeOutputName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const hasExt = /\.[^./\\]+$/.test(trimmed);
  return hasExt ? trimmed : `${trimmed}.processed.tex`;
}

export function getOperationHistoryLabel(
  operation: string | undefined,
  customLabels?: Readonly<Record<string, string>>,
): string {
  if (operation && customLabels && customLabels[operation]) {
    return customLabels[operation]!;
  }
  switch (operation) {
    case 'realize-conditions':
      return 'Condition realization';
    case 'refactor-symbols':
      return 'Symbol refactor';
    case 'suppress-comments':
      return 'Comment suppression';
    case 'remove-environments':
      return 'Remove environments';
    case 'expand-inputs':
      return 'Expand / flatten inputs';
    case 'compose-transformations':
      return 'Composed pipeline';
    case 'edit-nodes':
      return 'Node edit';
    default:
      return 'Transformation';
  }
}

function findConfiguredNodeByKey(
  root: ConfiguredNode | null | undefined,
  occurrenceKey: string,
): ConfiguredNode | null {
  if (!root) return null;
  const stack: ConfiguredNode[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.occurrenceKey === occurrenceKey) return current;
    if (current.kind !== 'token') {
      for (let i = current.children.length - 1; i >= 0; i -= 1) {
        const child = current.children[i];
        if (child) stack.push(child);
      }
    }
  }
  return null;
}

export interface WorkspaceModelData {
  readonly viewStatus?: 'ready' | 'incomplete' | 'blocked' | null;
  readonly viewId?: string | null;
  readonly viewIssue?: ProjectIssue | null;
  readonly hasConditionals?: boolean;
  readonly detectedConditions?: readonly string[];
  readonly conditionDecisions?: readonly ConditionDecision[];
  readonly coarseTree?: CoarseTree | null;
  readonly configuredRoot?: ConfiguredNode | null;
  readonly sourceTokensByFile?: Readonly<Record<ProjectFilePath, readonly SourceToken[]>>;
  readonly catalog?: ProjectCatalog | null;
  readonly metadata?: ProjectMetadata | null;
  readonly diagnostics?: readonly ProjectIssue[];
  readonly findings?: readonly AnalysisFinding[];
  readonly isFindingsStale?: boolean;
  readonly isAnalyzing?: boolean;
  readonly error?: ProcessingError | null;
  readonly pendingEditPlan?: ProjectEditPlan | null;
  readonly pendingEditMetadata?: StagedEditMetadata | null;
  readonly isEditPlanStale?: boolean;
  readonly artifacts?: readonly GeneratedArtifact[];
  readonly canRunSourceTransformations?: boolean;
  readonly canRealizeConditions?: boolean;
  readonly realizeConditionsReason?: string;
  readonly canRunViewTransformations?: boolean;
  readonly viewTransformationReason?: string;
  readonly canRunReferences?: boolean;
  readonly referencesReason?: string;
  readonly canRunCommandUsage?: boolean;
  readonly commandUsageReason?: string;
}

export interface WorkspaceActionHandlers {
  readonly onApplyTransformations?: (request: UnifiedTransformRequest) => void;
  readonly onRefactorSymbol?: (action: SymbolRefactorAction) => void;
  readonly onRunReferences?: () => void;
  readonly onRunCommandUsage?: () => void;
  readonly onRemoveNode?: (node: ConfiguredNode) => void;
  readonly onRenameEnvironment?: (node: ConfiguredNode, newName: string) => void;
  readonly onRenameCommand?: (node: ConfiguredNode, newName: string) => void;
  readonly onRenameSection?: (
    node: ConfiguredNode,
    sectionCommand: SectionCommandName,
    starred: boolean,
  ) => void;
  readonly onUnwrapNode?: (node: ConfiguredNode) => void;
  readonly onWrapNode?: (node: ConfiguredNode, wrapperName: string) => void;
  readonly onStageEditPlan?: (plan: ProjectEditPlan, metadata?: StagedEditMetadata) => void;
  readonly onApplyPendingEdits?: (options: {
    readonly switchToConditionFree: boolean;
    readonly historyLabel: string;
  }) => boolean | void | Promise<boolean | void>;
  readonly onDiscardPendingEdits?: () => void;
}

export interface PrepTeXWorkspaceContextValue {
  readonly filesByName: FilesMap;
  readonly fileNames: readonly ProjectFilePath[];
  readonly fileVersions: Readonly<Record<ProjectFilePath, number>>;
  readonly sourceRevision: number;
  readonly selectedFile: ProjectFilePath;
  readonly selectFile: (path: ProjectFilePath) => void;
  readonly upsertTextFiles: ReturnType<typeof useFiles>['upsertTextFiles'];
  readonly removeFile: ReturnType<typeof useFiles>['removeFile'];
  readonly resetFiles: ReturnType<typeof useFiles>['resetFiles'];
  readonly projectConfig: ReturnType<typeof useProjectConfiguration>;
  readonly layout: ReturnType<typeof useWorkspaceLayout>;
  readonly control: ReturnType<typeof useControl>;
  readonly model: WorkspaceModelData;
  readonly effectiveEntry: ProjectFilePath;
  readonly selectedNode: ConfiguredNode | null;
  readonly setSelectedNode: (node: ConfiguredNode | null) => void;
  readonly selectedArtifact: GeneratedArtifact | null;
  readonly setSelectedArtifact: (artifact: GeneratedArtifact | null) => void;
  readonly jumpToLocation: (location: SourceLocation) => void;
  readonly stageEditPlan: (
    plan: ProjectEditPlan,
    metadata?: StagedEditMetadata & { readonly switchToDiff?: boolean },
  ) => void;
  readonly loadDemo: () => void;
}

const WorkspaceSessionContext = createContext<PrepTeXWorkspaceContextValue | null>(null);

export function usePrepTeXWorkspace(): PrepTeXWorkspaceContextValue {
  const ctx = useContext(WorkspaceSessionContext);
  if (!ctx) {
    throw new Error('usePrepTeXWorkspace must be used inside a PrepTeXWorkspace.');
  }
  return ctx;
}

export interface CustomWorkspaceViewDescriptor extends WorkspaceViewDescriptor {
  readonly render: (context: PrepTeXWorkspaceContextValue) => ReactNode;
}

export interface PrepTeXWorkspaceProps {
  readonly files?: ReturnType<typeof useFiles>;
  readonly projectConfig?: ReturnType<typeof useProjectConfiguration>;
  readonly layout?: ReturnType<typeof useWorkspaceLayout>;
  readonly control?: ReturnType<typeof useControl>;
  readonly model?: WorkspaceModelData;
  readonly actions?: WorkspaceActionHandlers;
  readonly initialFiles?: FilesMap;
  readonly demoFiles?: FilesMap;
  readonly brandLabel?: string;
  readonly initialView?: WorkspaceViewId;
  readonly enableDemoQueryParams?: boolean;
  readonly extraViews?: readonly CustomWorkspaceViewDescriptor[];
  readonly getExtraViews?: (
    context: PrepTeXWorkspaceContextValue,
  ) => readonly CustomWorkspaceViewDescriptor[];
  readonly getExtraMenus?: (
    context: PrepTeXWorkspaceContextValue,
  ) => readonly WorkspaceCustomMenuDescriptor[];
  readonly getExtraFileMenuItems?: (
    context: PrepTeXWorkspaceContextValue,
  ) => readonly WorkspaceMenuItemDescriptor[];
  readonly getExtraEditMenuItems?: (
    context: PrepTeXWorkspaceContextValue,
  ) => readonly WorkspaceMenuItemDescriptor[];
  readonly renderHeaderRightSlot?: (context: PrepTeXWorkspaceContextValue) => ReactNode;
  readonly renderAstNodeActions?: (
    node: ConfiguredNode,
    context: PrepTeXWorkspaceContextValue,
  ) => ReactNode;
  readonly renderDiagnosticsActions?: (context: PrepTeXWorkspaceContextValue) => ReactNode;
  readonly renderOperationsExtraContent?: (context: PrepTeXWorkspaceContextValue) => ReactNode;
  readonly renderEmptyStateActions?: (context: PrepTeXWorkspaceContextValue) => ReactNode;
  readonly customOperationLabels?: Readonly<Record<string, string>>;
  readonly onFilesChange?: (
    files: FilesMap,
    sourceRevision: number,
    fileVersions: Readonly<Record<ProjectFilePath, number>>,
  ) => void;
}

const EMPTY_MODEL: WorkspaceModelData = {};
const EMPTY_DIAGNOSTICS: readonly ProjectIssue[] = [];
const EMPTY_FINDINGS: readonly AnalysisFinding[] = [];
const EMPTY_ARTIFACTS: readonly GeneratedArtifact[] = [];

export function PrepTeXWorkspace({
  files: externalFiles,
  projectConfig: externalProjectConfig,
  layout: externalLayout,
  control: externalControl,
  model = EMPTY_MODEL,
  actions,
  initialFiles,
  demoFiles = DEFAULT_DEMO_PROJECT_FILES,
  brandLabel,
  initialView = 'code',
  enableDemoQueryParams = true,
  extraViews,
  getExtraViews,
  getExtraMenus,
  getExtraFileMenuItems,
  getExtraEditMenuItems,
  renderHeaderRightSlot,
  renderAstNodeActions,
  renderDiagnosticsActions,
  renderOperationsExtraContent,
  renderEmptyStateActions,
  customOperationLabels,
  onFilesChange,
}: PrepTeXWorkspaceProps) {
  const [jumpToLine, setJumpToLine] = useState<number | undefined>(undefined);
  const [jumpRange, setJumpRange] = useState<{ start: number; end: number } | undefined>(undefined);
  const [jumpToken, setJumpToken] = useState(0);
  const [structureMode, setStructureMode] = useState<AstStructureMode>('coarse');
  const hasAutoRecommendedEntryRef = useRef(false);

  const [uploadFilesTrigger, setUploadFilesTrigger] = useState(0);
  const [uploadFolderTrigger, setUploadFolderTrigger] = useState(0);
  const [newFileTrigger, setNewFileTrigger] = useState(0);

  const [selectedNode, setSelectedNode] = useState<ConfiguredNode | null>(null);
  const [switchToConditionFree, setSwitchToConditionFree] = useState(true);
  const [selectedArtifact, setSelectedArtifact] = useState<GeneratedArtifact | null>(null);

  const [localPendingPlan, setLocalPendingPlan] = useState<ProjectEditPlan | null>(null);
  const [localPendingMeta, setLocalPendingMeta] = useState<StagedEditMetadata | null>(null);

  const internalFiles = useFiles(initialFiles);
  const filesState = externalFiles ?? internalFiles;
  const {
    filesByName,
    fileNames,
    fileVersions,
    selectedFile,
    selectFile,
    uploadError,
    uploadNotice,
    clearUploadNotice,
    upsertFiles,
    upsertFileItems,
    upsertTextFiles,
    removeFile,
    resetFiles,
    sourceRevision,
    canGoBack,
    canGoForward,
    backLabel,
    forwardLabel,
    goBack,
    goForward,
  } = filesState;

  const internalProjectConfig = useProjectConfiguration(filesByName, {
    entryPath: selectedFile || null,
    conditionPolicy: { mode: 'ignore' },
  });
  const projectConfig = externalProjectConfig ?? internalProjectConfig;

  const internalLayout = useWorkspaceLayout(initialView);
  const layout = externalLayout ?? internalLayout;

  const internalControl = useControl();
  const control = externalControl ?? internalControl;
  const { options, setOptions } = control;

  useEffect(() => {
    onFilesChange?.(filesByName, sourceRevision, fileVersions);
  }, [filesByName, sourceRevision, fileVersions, onFilesChange]);

  const loadDemoProject = useCallback(() => {
    hasAutoRecommendedEntryRef.current = true;
    upsertTextFiles(demoFiles);
    const recommended = recommendEntry(demoFiles) ?? Object.keys(demoFiles)[0] ?? '';
    if (recommended) {
      selectFile(recommended);
    }
    projectConfig.commitConfiguration({
      entryPath: recommended || null,
      traversal: 'project',
      inputs: 'command',
      conditionPolicy: { mode: 'ignore' },
    });
    setSelectedArtifact(null);
    setSelectedNode(null);
  }, [demoFiles, projectConfig, selectFile, upsertTextFiles]);

  // Auto-recommend an entry file quietly (without modal popup) when files enter an empty workspace
  useEffect(() => {
    if (fileNames.length === 0) {
      hasAutoRecommendedEntryRef.current = false;
      return;
    }
    if (!hasAutoRecommendedEntryRef.current) {
      hasAutoRecommendedEntryRef.current = true;
      if (!projectConfig.entryPath) {
        const recommended = recommendEntry(filesByName);
        if (recommended) {
          projectConfig.setEntryPath(recommended);
          selectFile(recommended);
        }
      }
    }
  }, [fileNames.length, filesByName, projectConfig, selectFile]);

  // Demo / State URL parameter support
  useEffect(() => {
    if (!enableDemoQueryParams || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const demo = params.get('demo');
    if (demo === 'sample' && fileNames.length === 0) {
      loadDemoProject();
      const state = params.get('state');
      if (state === 'operations' || state === 'transformations') {
        layout.selectView('transformations');
      } else if (state === 'ast') {
        layout.selectView('ast');
      } else if (state === 'catalog') {
        layout.selectView('catalog');
      } else if (state === 'metadata') {
        layout.selectView('metadata');
      } else if (state === 'settings') {
        layout.selectView('settings');
      } else if (state === 'log' || state === 'bottom-log' || state === 'diagnostics') {
        layout.selectView('diagnostics');
        setTimeout(() => {
          actions?.onRunReferences?.();
        }, 100);
      } else if (state && extraViews?.some((view) => view.id === state)) {
        layout.selectView(state);
      }
    }
  }, [actions, enableDemoQueryParams, extraViews, fileNames.length, layout, loadDemoProject]);

  const code = filesByName[selectedFile] ?? '';
  const displayedFilename = selectedArtifact ? selectedArtifact.path : selectedFile;
  const displayedCode = selectedArtifact ? selectedArtifact.source : code;
  const effectiveEntry = projectConfig.entryPath || selectedFile;

  const rootNode: LayoutNode | null = useMemo(() => {
    if (structureMode === 'coarse') {
      if (model.coarseTree) {
        return new TreeLayoutBuilder().buildCoarse(model.coarseTree);
      }
      return null;
    }

    if (structureMode === 'configured') {
      if (model.viewStatus === 'ready' && model.configuredRoot) {
        return new TreeLayoutBuilder().buildConfigured(model.configuredRoot);
      }
      return null;
    }

    const tokens = model.sourceTokensByFile?.[selectedFile];
    if (tokens && tokens.length > 0) {
      return new TreeLayoutBuilder().buildSourceTokens(selectedFile, tokens);
    }
    return null;
  }, [
    structureMode,
    model.coarseTree,
    model.viewStatus,
    model.configuredRoot,
    model.sourceTokensByFile,
    selectedFile,
  ]);

  const jumpToAnalysisLocation = useCallback(
    (location: SourceLocation) => {
      if (filesByName[location.path]) {
        setSelectedArtifact(null);
        selectFile(location.path);
      }
      setJumpRange(location.range);
      setJumpToLine(location.range.line);
      setJumpToken((val) => val + 1);
      if (!layout.splitEnabled) {
        layout.selectView('code');
      }
    },
    [filesByName, layout, selectFile],
  );

  const stageEditPlan = useCallback(
    (
      plan: ProjectEditPlan,
      metadata?: StagedEditMetadata & { readonly switchToDiff?: boolean },
    ) => {
      if (actions?.onStageEditPlan) {
        actions.onStageEditPlan(plan, metadata);
      } else {
        setLocalPendingPlan(plan);
        setLocalPendingMeta(metadata ?? null);
      }
      if (metadata?.switchToDiff ?? true) {
        layout.selectView('diff');
      }
    },
    [actions, layout],
  );

  const effectivePendingPlan = model.pendingEditPlan ?? localPendingPlan;
  const effectivePendingMeta = model.pendingEditMetadata ?? localPendingMeta;
  const effectiveArtifacts = model.artifacts ?? localPendingMeta?.artifacts ?? EMPTY_ARTIFACTS;
  const effectiveDiagnostics = model.diagnostics ?? EMPTY_DIAGNOSTICS;
  const effectiveFindings = model.findings ?? EMPTY_FINDINGS;

  const workspaceContext: PrepTeXWorkspaceContextValue = useMemo(
    () => ({
      filesByName,
      fileNames,
      fileVersions,
      sourceRevision,
      selectedFile,
      selectFile,
      upsertTextFiles,
      removeFile,
      resetFiles,
      projectConfig,
      layout,
      control,
      model,
      effectiveEntry,
      selectedNode,
      setSelectedNode,
      selectedArtifact,
      setSelectedArtifact,
      jumpToLocation: jumpToAnalysisLocation,
      stageEditPlan,
      loadDemo: loadDemoProject,
    }),
    [
      control,
      effectiveEntry,
      fileNames,
      fileVersions,
      filesByName,
      jumpToAnalysisLocation,
      layout,
      loadDemoProject,
      model,
      projectConfig,
      removeFile,
      resetFiles,
      selectFile,
      selectedArtifact,
      selectedFile,
      selectedNode,
      sourceRevision,
      stageEditPlan,
      upsertTextFiles,
    ],
  );

  const resolvedExtraViews = useMemo(
    () => (getExtraViews ? getExtraViews(workspaceContext) : extraViews ?? []),
    [extraViews, getExtraViews, workspaceContext],
  );

  const resolvedExtraMenus = useMemo(
    () => (getExtraMenus ? getExtraMenus(workspaceContext) : []),
    [getExtraMenus, workspaceContext],
  );

  const resolvedExtraFileMenuItems = useMemo(
    () => (getExtraFileMenuItems ? getExtraFileMenuItems(workspaceContext) : []),
    [getExtraFileMenuItems, workspaceContext],
  );

  const resolvedExtraEditMenuItems = useMemo(
    () => (getExtraEditMenuItems ? getExtraEditMenuItems(workspaceContext) : []),
    [getExtraEditMenuItems, workspaceContext],
  );

  const onDownload = (name: string) => {
    const text = filesByName[name] ?? '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, name);
  };

  const onSelectFile = (name: string) => {
    setSelectedArtifact(null);
    setJumpToLine(undefined);
    setJumpRange(undefined);
    selectFile(name);
    if (layout.activeView === 'diff' || layout.activeView === 'settings') {
      return;
    }
  };

  const handleCreateFile = (path: string) => {
    const existed = Object.prototype.hasOwnProperty.call(filesByName, path);
    if (!existed) {
      upsertTextFiles(
        { [path]: '% New TeX file\n' },
        { recordHistory: true, label: `Create ${path}` },
      );
    }
    selectFile(path);
    if (!layout.splitEnabled) {
      layout.selectView('code');
    }
  };

  const inputWarnings = useMemo(
    () => effectiveDiagnostics.filter((issue) => issue.code === 'missing-input'),
    [effectiveDiagnostics],
  );

  const totalDiagnosticCount =
    effectiveDiagnostics.length +
    effectiveFindings.length +
    (model.error ? 1 : 0);

  const handleSelectAstNode = useCallback(
    (node: LayoutNode) => {
      if (node.path && node.path !== selectedFile && filesByName[node.path]) {
        setSelectedArtifact(null);
        selectFile(node.path);
      }
      if (node.range) {
        setJumpRange(node.range);
      }
      if (typeof node.line === 'number' && Number.isFinite(node.line)) {
        setJumpToLine(node.line);
        setJumpToken((value) => value + 1);
      }
      if (model.viewStatus === 'ready' && node.occurrenceKey && model.configuredRoot) {
        const found = findConfiguredNodeByKey(model.configuredRoot, node.occurrenceKey);
        setSelectedNode(found);
      } else {
        setSelectedNode(null);
      }
    },
    [filesByName, model.configuredRoot, model.viewStatus, selectFile, selectedFile],
  );

  const discardPending = useCallback(() => {
    setLocalPendingPlan(null);
    setLocalPendingMeta(null);
    actions?.onDiscardPendingEdits?.();
  }, [actions]);

  const renderAstView = (isSplitCompanion = false) => (
    <div className="AstPaneComposite">
      <NodeActionBar
        selectedNode={selectedNode}
        catalog={model.catalog ?? null}
        customCommands={projectConfig.customCommands}
        onRemoveNode={() => {
          if (selectedNode) {
            actions?.onRemoveNode?.(selectedNode);
          }
        }}
        onRenameEnvironment={(newName) => {
          if (selectedNode) {
            actions?.onRenameEnvironment?.(selectedNode, newName);
          }
        }}
        onRenameEnvironmentGlobally={(oldName, newName) => {
          actions?.onRefactorSymbol?.({
            kind: 'rename-environment-globally',
            oldName,
            newName,
          });
        }}
        onRenameCommand={(newName) => {
          if (selectedNode) {
            actions?.onRenameCommand?.(selectedNode, newName);
          }
        }}
        onRenameCommandGlobally={(oldName, newName) => {
          actions?.onRefactorSymbol?.({
            kind: 'rename-command-globally',
            oldName,
            newName,
          });
        }}
        onRenameSection={(sectionCommand, starred) => {
          if (selectedNode) {
            actions?.onRenameSection?.(selectedNode, sectionCommand, starred);
          }
        }}
        onUnwrapNode={() => {
          if (selectedNode) {
            actions?.onUnwrapNode?.(selectedNode);
          }
        }}
        onUpsertCustomCommand={projectConfig.upsertCustomCommand}
        onWrapNode={(wrapperName) => {
          if (selectedNode) {
            actions?.onWrapNode?.(selectedNode, wrapperName);
          }
        }}
        extraActions={
          selectedNode && renderAstNodeActions
            ? renderAstNodeActions(selectedNode, workspaceContext)
            : undefined
        }
        onClearSelection={() => setSelectedNode(null)}
      />
      <ASTview
        key={`${selectedFile}:${model.viewId ?? ''}:${isSplitCompanion ? 'split' : 'main'}`}
        root={rootNode}
        selectedNodeKey={selectedNode?.occurrenceKey ?? null}
        isSidePanel={false}
        structureMode={structureMode}
        onChangeStructureMode={setStructureMode}
        isConfiguredAvailable={model.viewStatus === 'ready'}
        viewIssue={model.viewIssue ?? null}
        inputMode={projectConfig.inputs}
        onChangeInputMode={projectConfig.setInputMode}
        inputWarnings={inputWarnings}
        coarseOptions={projectConfig.coarseTreeOptions}
        onChangeCoarseOptions={projectConfig.setCoarseTreeOptions}
        hasConditionals={Boolean(model.hasConditionals)}
        conditionPolicy={projectConfig.conditionPolicy}
        detectedConditions={model.detectedConditions ?? []}
        onConfigureConditions={projectConfig.setConditionPolicy}
        splitEnabled={layout.splitEnabled}
        onToggleSplit={isSplitCompanion ? undefined : layout.toggleSplit}
        onSelectNode={handleSelectAstNode}
      />
    </div>
  );

  const renderPrimaryView = () => {
    if (fileNames.length === 0) {
      return (
        <WelcomeEmptyState
          onUploadFiles={() => setUploadFilesTrigger((c) => c + 1)}
          onUploadFolder={() => setUploadFolderTrigger((c) => c + 1)}
          onLoadDemo={loadDemoProject}
          onDropFiles={(items) => {
            void upsertFileItems(items);
          }}
          extraActions={renderEmptyStateActions?.(workspaceContext)}
        />
      );
    }

    const customView = resolvedExtraViews.find((view) => view.id === layout.activeView);
    if (customView) {
      return customView.render(workspaceContext);
    }

    switch (layout.activeView) {
      case 'code':
      default:
        return (
          <>
            {selectedArtifact ? (
              <div className="ArtifactBanner">
                <span>
                  Viewing generated artifact: <code>{selectedArtifact.path}</code>
                </span>
                <button
                  type="button"
                  className="ArtifactBannerBtn"
                  onClick={() => setSelectedArtifact(null)}
                >
                  Return to source
                </button>
              </div>
            ) : null}
            <Codeview
              filename={displayedFilename}
              code={displayedCode}
              jumpToLine={jumpToLine}
              jumpRange={jumpRange}
              jumpToken={jumpToken}
            />
          </>
        );

      case 'ast':
        return renderAstView(false);

      case 'transformations':
        return (
          <OperationsDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.selectView('code')}
            options={options}
            onChange={setOptions}
            entryFile={effectiveEntry}
            conditionPolicy={projectConfig.conditionPolicy}
            hasConditionals={Boolean(model.hasConditionals)}
            detectedConditions={model.detectedConditions ?? []}
            onConfigureConditions={projectConfig.setConditionPolicy}
            defaultTransformTarget={
              projectConfig.conditionPolicy.mode === 'ignore' ? 'source' : 'selected'
            }
            canRunSourceTransformations={Boolean(model.canRunSourceTransformations)}
            canRealizeConditions={Boolean(model.canRealizeConditions)}
            realizeConditionsReason={model.realizeConditionsReason}
            conditionDecisions={model.conditionDecisions ?? []}
            canRunViewTransformations={Boolean(model.canRunViewTransformations)}
            viewTransformationReason={model.viewTransformationReason}
            onApplyTransformations={actions?.onApplyTransformations}
            artifacts={effectiveArtifacts}
            onDownloadZip={() => {
              if (effectiveArtifacts.length > 0) {
                downloadZipArchive(
                  effectiveArtifacts.map((a) => ({ path: a.path, content: a.source })),
                  'preptex-export.zip',
                );
              }
            }}
            onDownloadArtifact={(art) => {
              const overrideName =
                effectiveArtifacts.length === 1 ? normalizeOutputName(options.outputName) : '';
              const blob = new Blob([art.source], { type: 'text/plain;charset=utf-8' });
              downloadBlob(blob, overrideName || art.path);
            }}
            onSelectArtifact={(art) => {
              setSelectedArtifact(art);
              layout.selectView('code');
            }}
            extraContent={renderOperationsExtraContent?.(workspaceContext)}
          />
        );

      case 'catalog':
        return (
          <CatalogDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.selectView('code')}
            catalog={model.catalog ?? null}
            customCommands={projectConfig.customCommands}
            onUpsertCustomCommand={projectConfig.upsertCustomCommand}
            onRemoveCustomCommand={projectConfig.removeCustomCommand}
            onRefactorSymbol={(action) => actions?.onRefactorSymbol?.(action)}
            onSelectLocation={jumpToAnalysisLocation}
          />
        );

      case 'metadata':
        return (
          <MetadataDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.selectView('code')}
            metadata={model.metadata ?? null}
            onEditMetadata={(action) => actions?.onRefactorSymbol?.(action)}
            onSelectLocation={jumpToAnalysisLocation}
          />
        );

      case 'diagnostics':
        return (
          <LogDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.selectView('code')}
            diagnostics={effectiveDiagnostics}
            error={model.error ?? null}
            findings={effectiveFindings}
            isStale={Boolean(model.isFindingsStale)}
            onRunReferences={actions?.onRunReferences}
            canRunReferences={Boolean(model.canRunReferences)}
            referencesReason={model.referencesReason}
            onRunCommandUsage={actions?.onRunCommandUsage}
            canRunCommandUsage={Boolean(model.canRunCommandUsage)}
            commandUsageReason={model.commandUsageReason}
            isAnalyzing={Boolean(model.isAnalyzing)}
            onSelectLocation={jumpToAnalysisLocation}
            extraHeaderActions={renderDiagnosticsActions?.(workspaceContext)}
          />
        );

      case 'diff':
        return (
          <EditPreviewDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.returnFromDiff('code')}
            editPlan={effectivePendingPlan}
            isStale={Boolean(model.isEditPlanStale)}
            error={model.error ?? null}
            switchToConditionFree={switchToConditionFree}
            onToggleSwitchToConditionFree={setSwitchToConditionFree}
            customTitle={effectivePendingMeta?.title}
            customSubtitle={effectivePendingMeta?.subtitle}
            onSelectLocation={(path, line) => {
              if (filesByName[path]) {
                setSelectedArtifact(null);
                selectFile(path);
              }
              setJumpRange(undefined);
              setJumpToLine(line);
              setJumpToken((val) => val + 1);
              if (!layout.splitEnabled) {
                layout.selectView('code');
              }
            }}
            onDiscard={() => {
              discardPending();
              layout.returnFromDiff('code');
            }}
            onApply={() => {
              const plan = effectivePendingPlan;
              if (!plan) return;
              const isConditionRealization =
                plan.provenance.request.operation === 'realize-conditions';
              const historyLabel =
                effectivePendingMeta?.historyLabel ??
                getOperationHistoryLabel(
                  plan.provenance.request.operation,
                  customOperationLabels,
                );

              if (actions?.onApplyPendingEdits) {
                const applyResult = actions.onApplyPendingEdits({
                  switchToConditionFree,
                  historyLabel,
                });
                const clearIfApplied = (applied: boolean | void) => {
                  if (applied !== false) {
                    setSelectedNode(null);
                    setSelectedArtifact(null);
                  }
                };
                if (typeof applyResult === 'boolean' || applyResult === undefined) {
                  clearIfApplied(applyResult);
                } else {
                  void applyResult.then(clearIfApplied);
                }
                return;
              }

              const updatedFiles = applyProjectEditsToFilesMap(filesByName, plan.edits);
              upsertTextFiles(updatedFiles, { recordHistory: true, label: historyLabel });
              setLocalPendingPlan(null);
              setLocalPendingMeta(null);
              setSelectedNode(null);
              setSelectedArtifact(null);
              if (isConditionRealization && switchToConditionFree) {
                projectConfig.setConditionPolicy({ mode: 'none' });
              }
              layout.selectView('code');
            }}
          />
        );

      case 'settings':
        return (
          <ProjectSetupDialog
            variant="view"
            isOpen={true}
            onClose={() => layout.selectView('code')}
            files={filesByName}
            configuration={projectConfig}
            onApply={(draft) => {
              projectConfig.commitConfiguration(draft);
              layout.selectView('code');
            }}
            detectedConditions={model.detectedConditions ?? []}
            customCommands={projectConfig.customCommands}
            onRemoveCustomCommand={projectConfig.removeCustomCommand}
            splitEnabled={layout.splitEnabled}
            onToggleSplit={layout.toggleSplit}
          />
        );
    }
  };

  return (
    <WorkspaceSessionContext.Provider value={workspaceContext}>
      <div className="AppShell">
        <WorkspaceHeader
          brandLabel={brandLabel}
          activeView={layout.activeView}
          splitEnabled={layout.splitEnabled}
          sidebarCollapsed={layout.sidebarCollapsed}
          openMenu={layout.openMenu}
          onSelectView={layout.selectView}
          onToggleSplit={layout.toggleSplit}
          onToggleSidebar={layout.toggleSidebar}
          onToggleMenu={layout.toggleMenu}
          onCloseMenu={() => layout.setOpenMenu(null)}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          backLabel={backLabel}
          forwardLabel={forwardLabel}
          onGoBack={() => {
            discardPending();
            setSelectedNode(null);
            setSelectedArtifact(null);
            goBack();
          }}
          onGoForward={() => {
            discardPending();
            setSelectedNode(null);
            setSelectedArtifact(null);
            goForward();
          }}
          entryPath={projectConfig.entryPath}
          selectedFile={selectedFile}
          fileCount={fileNames.length}
          conditionPolicy={projectConfig.conditionPolicy}
          hasConditionals={Boolean(model.hasConditionals)}
          viewStatus={model.viewStatus ?? null}
          pendingDiffCount={effectivePendingPlan?.edits.length ?? 0}
          diagnosticCount={totalDiagnosticCount}
          artifactCount={effectiveArtifacts.length}
          onTriggerUploadFiles={() => setUploadFilesTrigger((c) => c + 1)}
          onTriggerUploadFolder={() => setUploadFolderTrigger((c) => c + 1)}
          onRequestNewFile={() => {
            layout.setSidebarCollapsed(false);
            setNewFileTrigger((c) => c + 1);
          }}
          onLoadDemo={loadDemoProject}
          onDownloadProjectZip={() => {
            const entries = Object.entries(filesByName).map(([path, content]) => ({
              path,
              content,
            }));
            if (entries.length > 0) {
              downloadZipArchive(entries, 'preptex-project.zip');
            }
          }}
          onDownloadActiveFile={() => {
            if (selectedFile) {
              onDownload(selectedFile);
            }
          }}
          onResetWorkspace={() => {
            resetFiles();
            discardPending();
            setSelectedNode(null);
            setSelectedArtifact(null);
            layout.selectView('code');
          }}
          extraViews={resolvedExtraViews}
          extraMenus={resolvedExtraMenus}
          extraFileMenuItems={resolvedExtraFileMenuItems}
          extraEditMenuItems={resolvedExtraEditMenuItems}
          rightSlot={renderHeaderRightSlot?.(workspaceContext)}
        />

        <div className="WorkspaceMainRow">
          {layout.sidebarCollapsed ? (
            <div className="WorkspaceCollapsedRail">
              <button
                type="button"
                className="WorkspaceCollapsedRailBtn"
                onClick={layout.toggleSidebar}
                aria-label="Show file explorer"
                title="Show file explorer"
              >
                »
              </button>
            </div>
          ) : null}
          <aside
            className={`WorkspaceSidebar${layout.sidebarCollapsed ? ' is-collapsed' : ''}`}
            aria-hidden={layout.sidebarCollapsed}
          >
            <Filetree
              files={fileNames}
              selected={selectedFile}
              entryPath={projectConfig.entryPath}
              onSelect={onSelectFile}
              onSetEntry={(path) => projectConfig.setEntryPath(path)}
              onCreateFile={handleCreateFile}
              onDownload={onDownload}
              onRemove={(name) => removeFile(name)}
              onUploadFiles={(fl) => {
                void upsertFiles(fl, { filterExtensions: true });
              }}
              onUploadFolder={(fl) => {
                void upsertFiles(fl, { filterExtensions: true });
              }}
              onDropFiles={(items) => {
                void upsertFileItems(items);
              }}
              uploadError={uploadError}
              uploadNotice={uploadNotice}
              onDismissUploadNotice={clearUploadNotice}
              uploadFilesTrigger={uploadFilesTrigger}
              uploadFolderTrigger={uploadFolderTrigger}
              newFileTrigger={newFileTrigger}
              onCollapseSidebar={layout.toggleSidebar}
            />
          </aside>

          <main className="WorkspaceViewport">
            <div className="WorkspacePrimaryPane">{renderPrimaryView()}</div>

            {layout.splitEnabled && fileNames.length > 0 ? (
              <div className="WorkspaceSplitPane" aria-label="Split companion view">
                {layout.activeView === 'code' ? (
                  renderAstView(true)
                ) : (
                  <>
                    <div className="SplitPaneHeader">
                      <span>Code Companion</span>
                      <button
                        type="button"
                        className="AstPhase0ToggleBtn"
                        onClick={() => layout.setSplitEnabled(false)}
                      >
                        Close Split
                      </button>
                    </div>
                    <Codeview
                      filename={displayedFilename}
                      code={displayedCode}
                      jumpToLine={jumpToLine}
                      jumpRange={jumpRange}
                      jumpToken={jumpToken}
                    />
                  </>
                )}
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </WorkspaceSessionContext.Provider>
  );
}

export default PrepTeXWorkspace;
