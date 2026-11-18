import type { ReactElement } from 'react';
import {
  ASTview,
  CatalogDialog,
  Codeview,
  ConfigurationSummary,
  ControlPanel,
  DEFAULT_CONFIGURATION,
  DEFAULT_CORE_OPTIONS,
  DEFAULT_DEMO_PROJECT_FILES,
  EditPreviewDialog,
  Filetree,
  LogDialog,
  LogPanel,
  MetadataDialog,
  NodeActionBar,
  OperationsDialog,
  PrepTeXWorkspace,
  ProjectSetupDialog,
  TreeLayoutBuilder,
  TreeNode,
  WelcomeEmptyState,
  WorkspaceHeader,
  applyProjectEditsToFilesMap,
  buildNewFileOutputs,
  createZipArchive,
  extractDroppedFiles,
  filterUploadedBatch,
  getFileExtension,
  getOperationHistoryLabel,
  IGNORED_FOLDER_SEGMENTS,
  isInputHandlingOption,
  isLayoutNodeKind,
  isRelevantProjectFile,
  LAYOUT_NODE_KINDS,
  normalizeOutputFolder,
  normalizeUploadedBatch,
  readZipFileNames,
  recommendEntry,
  RELEVANT_TEX_EXTENSIONS,
  useArtifacts,
  useControl,
  useFiles,
  usePrepTeXWorkspace,
  useProjectConfiguration,
  useWorkspaceLayout,
  type ASTviewProps,
  type AstStructureMode,
  type BuiltInWorkspaceMenuId,
  type BuiltInWorkspaceViewId,
  type CatalogDialogProps,
  type CodeviewProps,
  type ControlPanelProps,
  type CoreOptionsUI,
  type CustomWorkspaceViewDescriptor,
  type EditPreviewDialogProps,
  type FilesMap,
  type FiletreeProps,
  type LayoutNode,
  type LogDialogProps,
  type LogPanelProps,
  type MetadataDialogProps,
  type NodeActionBarProps,
  type OperationsDialogProps,
  type PrepTeXWorkspaceContextValue,
  type PrepTeXWorkspaceProps,
  type ProcessingError,
  type ProjectConfigurationState,
  type ProjectSetupDialogProps,
  type StagedEditMetadata,
  type UnifiedTransformRequest,
  type WelcomeEmptyStateProps,
  type WorkspaceActionHandlers,
  type WorkspaceCustomMenuDescriptor,
  type WorkspaceHeaderProps,
  type WorkspaceMenuId,
  type WorkspaceMenuItemDescriptor,
  type WorkspaceModelData,
  type WorkspaceViewDescriptor,
  type WorkspaceViewId,
} from '@preptex/ui';

const demoFiles: FilesMap = DEFAULT_DEMO_PROJECT_FILES;
const defaultOpts: CoreOptionsUI = DEFAULT_CORE_OPTIONS;
const defaultCfg: ProjectConfigurationState = DEFAULT_CONFIGURATION;

// @ts-expect-error FilesMap is readonly
demoFiles['main.tex'] = 'mutated';

// @ts-expect-error CoreOptionsUI properties are readonly
defaultOpts.suppressComments = true;

// @ts-expect-error ProjectConfigurationState properties are readonly
defaultCfg.entryPath = 'other.tex';

const customViewId: WorkspaceViewId = 'venue-studio';
const builtInViewId: BuiltInWorkspaceViewId = 'code';
const customMenuId: WorkspaceMenuId = 'ai-tools';
const builtInMenuId: BuiltInWorkspaceMenuId = 'edit';
void customViewId;
void builtInViewId;
void customMenuId;
void builtInMenuId;

const customView: CustomWorkspaceViewDescriptor = {
  id: 'venue-studio',
  label: 'Venue Studio',
  shortLabel: 'Venue',
  description: 'Convert paper to target venue',
  icon: '🏛',
  render: (ctx: PrepTeXWorkspaceContextValue) => {
    const entry: string = ctx.effectiveEntry;
    return <div>{entry}</div>;
  },
};

// @ts-expect-error CustomWorkspaceViewDescriptor properties are readonly
customView.id = 'mutated';

const modelData: WorkspaceModelData = {
  viewStatus: 'ready',
  hasConditionals: false,
  detectedConditions: ['draft'],
  canRunReferences: true,
};

const actionHandlers: WorkspaceActionHandlers = {
  onApplyTransformations: (req: UnifiedTransformRequest) => {
    void req.destination;
  },
  onRunReferences: () => {},
};

const workspaceElement: ReactElement = (
  <PrepTeXWorkspace
    demoFiles={demoFiles}
    model={modelData}
    actions={actionHandlers}
    extraViews={[customView]}
  />
);
void workspaceElement;

const layoutNode: LayoutNode = {
  id: 'node-1',
  kind: 'section',
  label: 'Intro',
  line: 1,
  icon: '§',
  x: 0,
  y: 0,
  strokeWidth: 1,
  children: [],
};

// @ts-expect-error LayoutNode children array is readonly
layoutNode.children.push(layoutNode);

const err: ProcessingError = {
  kind: 'unexpected',
  message: 'Network failure',
};
void err;

const edited: FilesMap = applyProjectEditsToFilesMap(demoFiles, []);
const label: string = getOperationHistoryLabel('suppress-comments', {
  'suppress-comments': 'Custom label',
});
void edited;
void label;
void ASTview;
void CatalogDialog;
void Codeview;
void ConfigurationSummary;
void ControlPanel;
void EditPreviewDialog;
void Filetree;
void LogDialog;
void LogPanel;
void MetadataDialog;
void NodeActionBar;
void OperationsDialog;
void ProjectSetupDialog;
void TreeLayoutBuilder;
void TreeNode;
void WelcomeEmptyState;
void WorkspaceHeader;
void buildNewFileOutputs;
void createZipArchive;
void extractDroppedFiles;
void filterUploadedBatch;
void getFileExtension;
void IGNORED_FOLDER_SEGMENTS;
void isInputHandlingOption;
void isLayoutNodeKind;
void isRelevantProjectFile;
void LAYOUT_NODE_KINDS;
void normalizeOutputFolder;
void normalizeUploadedBatch;
void readZipFileNames;
void recommendEntry;
void RELEVANT_TEX_EXTENSIONS;
void useArtifacts;
void useControl;
void useFiles;
void usePrepTeXWorkspace;
void useProjectConfiguration;
void useWorkspaceLayout;
export type CheckedProps =
  | ASTviewProps
  | AstStructureMode
  | CatalogDialogProps
  | CodeviewProps
  | ControlPanelProps
  | EditPreviewDialogProps
  | FiletreeProps
  | LogDialogProps
  | LogPanelProps
  | MetadataDialogProps
  | NodeActionBarProps
  | OperationsDialogProps
  | PrepTeXWorkspaceProps
  | ProjectSetupDialogProps
  | StagedEditMetadata
  | WelcomeEmptyStateProps
  | WorkspaceCustomMenuDescriptor
  | WorkspaceHeaderProps
  | WorkspaceMenuItemDescriptor
  | WorkspaceViewDescriptor;
