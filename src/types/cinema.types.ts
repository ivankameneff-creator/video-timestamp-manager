export interface TagDTO {
  id: string;
  name: string;
}

export interface TimestampTagDTO {
  id: string;
  videoId: string;
  tagId: string;
  tagName: string;
  timestampSec: number;
  label: string | null;
  createdAt: string;
}

export interface VideoDTO {
  id: string;
  title: string;
  relativePath: string;
  folderPath: string;
  durationSec: number | null;
  fileSizeBytes: number | null;
  contentHash: string | null;
  isMissing: boolean;
  posterUrl: string | null;
  globalTags: TagDTO[];
  timestampTags: TimestampTagDTO[];
}

export interface TimestampSearchHit {
  id: string;
  timestampSec: number;
  tagName: string;
  label: string | null;
  video: {
    id: string;
    title: string;
    relativePath: string;
    folderPath: string;
    globalTags: string[];
  };
}

export interface SearchResponseDTO {
  query: string;
  timestampHits: TimestampSearchHit[];
  videoHits: VideoDTO[];
  availableTags: { name: string; count: number }[];
}

export interface FolderTreeNode {
  name: string;
  path: string;
  videoCount: number;
  children: FolderTreeNode[];
}

export interface CatalogFileStatusDTO {
  exists: boolean;
  filePath: string | null;
  updatedAt: string | null;
  sizeBytes: number | null;
}

export interface AdminConfigDTO {
  rootDirectory: string | null;
  directoryExists: boolean;
  totalVideos: number;
  missingVideos: number;
  totalTags: number;
  totalTimestampTags: number;
  catalogFile: CatalogFileStatusDTO;
  folderTree: FolderTreeNode[];
}

export interface ScanResultDTO {
  rootDirectory: string;
  scannedFiles: number;
  addedCount: number;
  relocatedCount: number;
  updatedCount: number;
  duplicatesSkippedCount: number;
  missingCount: number;
  removedCount: number;
  restoredFromCatalog: boolean;
  restoredVideosCount: number;
  restoredTimestampsCount: number;
  catalogSavedPath: string | null;
  folderTree: FolderTreeNode[];
}
