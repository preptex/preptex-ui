export * from './components';

export {
  useArtifacts,
  type UseArtifactsResult,
} from './model/useArtifacts';
export {
  DEFAULT_CORE_OPTIONS,
  isInputHandlingOption,
  useControl,
  type CoreOptionsUI,
  type InputHandlingOption,
} from './model/useControl';
export {
  normalizeUploadedBatch,
  useFiles,
  type FileHistoryEntry,
  type FilesState,
  type UpsertFilesOptions,
  type UpsertTextOptions,
} from './model/useFiles';
export {
  DEFAULT_CONFIGURATION,
  recommendEntry,
  useProjectConfiguration,
  type ProjectConfigurationState,
} from './model/useProjectConfiguration';
export {
  useWorkspaceLayout,
  type BuiltInWorkspaceMenuId,
  type BuiltInWorkspaceViewId,
  type WorkspaceLayoutState,
  type WorkspaceMenuId,
  type WorkspaceViewId,
} from './model/useWorkspaceLayout';

export * from './services/zip';

export type { UIArtifactItem } from './types/artifacts';
export type { ProcessingError } from './types/errors';
export type { FilesMap, ViewedItem } from './types/files';
export {
  isLayoutNodeKind,
  LAYOUT_NODE_KINDS,
  type LayoutNode,
  type LayoutNodeKind,
  type LayoutSectionLevel,
} from './types/LayoutNode';

export { extractDroppedFiles, type DroppedFileItem } from './utils/dropEntries';
export {
  filterUploadedBatch,
  IGNORED_FOLDER_SEGMENTS,
  isRelevantProjectFile,
  RELEVANT_TEX_EXTENSIONS,
  type FilteredUploadBatch,
  getFileExtension,
} from './utils/fileFilter';
export {
  buildNewFileOutputs,
  normalizeOutputFolder,
  type BuildNewFileOutputsArgs,
  type BuildNewFileOutputsResult,
} from './utils/transformOutput';
