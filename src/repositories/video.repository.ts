import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { TagDTO, TimestampTagDTO, VideoDTO } from "@/types/cinema.types";

interface VideoRow {
  id: string;
  title: string;
  relative_path: string;
  folder_path: string;
  duration_sec: number | null;
  file_size_bytes: number | null;
  mtime_ms: number | null;
  content_hash: string | null;
  is_missing: number;
  poster_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PortableCatalogVideoEntry {
  id: string;
  title: string;
  relativePath: string;
  folderPath: string;
  durationSec: number | null;
  fileSizeBytes: number | null;
  mtimeMs: number | null;
  contentHash: string | null;
  isMissing: boolean;
  posterUrl: string | null;
  createdAt: string;
  updatedAt: string;
  globalTags: string[];
  timestampTags: {
    id: string;
    tagName: string;
    timestampSec: number;
    label: string | null;
    createdAt: string;
  }[];
}

export interface RawSyncVideoRow {
  id: string;
  title: string;
  relativePath: string;
  folderPath: string;
  durationSec: number | null;
  fileSizeBytes: number | null;
  mtimeMs: number | null;
  contentHash: string | null;
  isMissing: boolean;
}

interface GlobalTagRow {
  video_id: string;
  tag_id: string;
  tag_name: string;
}

interface TimestampTagRow {
  id: string;
  video_id: string;
  tag_id: string;
  tag_name: string;
  timestamp_sec: number;
  label: string | null;
  created_at: string;
}

function hydrateVideos(videoRows: VideoRow[]): VideoDTO[] {
  if (videoRows.length === 0) return [];

  const allGlobalTags = db
    .prepare(
      `SELECT vt.video_id, t.id AS tag_id, t.name AS tag_name
       FROM video_tags vt
       JOIN tags t ON t.id = vt.tag_id
       ORDER BY vt.created_at ASC`
    )
    .all() as unknown as GlobalTagRow[];

  const allTimestampTags = db
    .prepare(
      `SELECT tt.id, tt.video_id, tt.tag_id, t.name AS tag_name,
              tt.timestamp_sec, tt.label, tt.created_at
       FROM timestamp_tags tt
       JOIN tags t ON t.id = tt.tag_id
       ORDER BY tt.timestamp_sec ASC`
    )
    .all() as unknown as TimestampTagRow[];

  const globalMap = new Map<string, TagDTO[]>();
  for (const row of allGlobalTags) {
    const list = globalMap.get(row.video_id) ?? [];
    list.push({ id: row.tag_id, name: row.tag_name });
    globalMap.set(row.video_id, list);
  }

  const tsMap = new Map<string, TimestampTagDTO[]>();
  for (const row of allTimestampTags) {
    const list = tsMap.get(row.video_id) ?? [];
    list.push({
      id: row.id,
      videoId: row.video_id,
      tagId: row.tag_id,
      tagName: row.tag_name,
      timestampSec: row.timestamp_sec,
      label: row.label,
      createdAt: row.created_at,
    });
    tsMap.set(row.video_id, list);
  }

  return videoRows.map((v) => ({
    id: v.id,
    title: v.title,
    relativePath: v.relative_path,
    folderPath: v.folder_path,
    durationSec: v.duration_sec,
    fileSizeBytes: v.file_size_bytes,
    contentHash: v.content_hash,
    isMissing: Boolean(v.is_missing),
    posterUrl: v.poster_url,
    globalTags: globalMap.get(v.id) ?? [],
    timestampTags: tsMap.get(v.id) ?? [],
  }));
}

export const videoRepository = {
  findAll(options?: { includeMissing?: boolean }): VideoDTO[] {
    const includeMissing = options?.includeMissing ?? true;
    const whereClause = includeMissing ? "" : "WHERE is_missing = 0";
    const rows = db
      .prepare(
        `SELECT id, title, relative_path, folder_path, duration_sec,
                file_size_bytes, mtime_ms, content_hash, is_missing, poster_url
         FROM videos
         ${whereClause}
         ORDER BY is_missing ASC, folder_path ASC, title ASC`
      )
      .all() as unknown as VideoRow[];
    return hydrateVideos(rows);
  },

  findById(id: string): VideoDTO | null {
    const row = db
      .prepare(
        `SELECT id, title, relative_path, folder_path, duration_sec,
                file_size_bytes, mtime_ms, content_hash, is_missing, poster_url
         FROM videos
         WHERE id = ?`
      )
      .get(id) as VideoRow | undefined;

    if (!row) return null;
    return hydrateVideos([row])[0] ?? null;
  },

  findRawMetaById(id: string): RawSyncVideoRow | null {
    const row = db
      .prepare(
        `SELECT id, title, relative_path, folder_path, duration_sec,
                file_size_bytes, mtime_ms, content_hash, is_missing
         FROM videos
         WHERE id = ?`
      )
      .get(id) as VideoRow | undefined;

    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      relativePath: row.relative_path,
      folderPath: row.folder_path,
      durationSec: row.duration_sec,
      fileSizeBytes: row.file_size_bytes,
      mtimeMs: row.mtime_ms,
      contentHash: row.content_hash,
      isMissing: Boolean(row.is_missing),
    };
  },

  findAllRawForSync(): RawSyncVideoRow[] {
    const rows = db
      .prepare(
        `SELECT id, title, relative_path, folder_path, duration_sec,
                file_size_bytes, mtime_ms, content_hash, is_missing
         FROM videos`
      )
      .all() as unknown as VideoRow[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      relativePath: row.relative_path,
      folderPath: row.folder_path,
      durationSec: row.duration_sec,
      fileSizeBytes: row.file_size_bytes,
      mtimeMs: row.mtime_ms,
      contentHash: row.content_hash,
      isMissing: Boolean(row.is_missing),
    }));
  },

  updateDuration(id: string, durationSec: number): void {
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE videos SET duration_sec = ?, updated_at = ? WHERE id = ?"
    ).run(durationSec, now, id);
  },

  insertNewVideo(data: {
    title: string;
    relativePath: string;
    folderPath: string;
    fileSizeBytes: number;
    mtimeMs: number;
    contentHash: string;
    durationSec: number | null;
  }): string {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO videos (
         id, title, relative_path, folder_path, duration_sec,
         file_size_bytes, mtime_ms, content_hash, is_missing, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      id,
      data.title,
      data.relativePath,
      data.folderPath,
      data.durationSec,
      data.fileSizeBytes,
      data.mtimeMs,
      data.contentHash,
      now,
      now
    );
    return id;
  },

  /**
   * Relie une vidéo existante (déplacée ou renommée) à son nouveau chemin
   * sur le MÊME identifiant BDD afin de conserver tous ses tags et timestamps.
   */
  relinkOrUpdateVideo(
    id: string,
    data: {
      title: string;
      relativePath: string;
      folderPath: string;
      fileSizeBytes: number;
      mtimeMs: number;
      contentHash: string;
      durationSec?: number | null;
    }
  ): void {
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE videos
       SET title = ?,
           relative_path = ?,
           folder_path = ?,
           file_size_bytes = ?,
           mtime_ms = ?,
           content_hash = ?,
           duration_sec = COALESCE(?, duration_sec),
           is_missing = 0,
           updated_at = ?
       WHERE id = ?`
    ).run(
      data.title,
      data.relativePath,
      data.folderPath,
      data.fileSizeBytes,
      data.mtimeMs,
      data.contentHash,
      data.durationSec ?? null,
      now,
      id
    );
  },

  detachTemporaryPath(id: string): void {
    db.prepare("UPDATE videos SET relative_path = ? WHERE id = ?").run(
      `__pending_relink__:${id}:${randomUUID()}`,
      id
    );
  },

  markPresent(id: string): void {
    db.prepare("UPDATE videos SET is_missing = 0 WHERE id = ? AND is_missing != 0").run(id);
  },

  markMissingIds(ids: string[]): number {
    if (ids.length === 0) return 0;
    const now = new Date().toISOString();
    const stmt = db.prepare(
      "UPDATE videos SET is_missing = 1, updated_at = ? WHERE id = ?"
    );
    for (const id of ids) {
      stmt.run(now, id);
    }
    return ids.length;
  },

  deleteByIds(ids: string[]): number {
    if (ids.length === 0) return 0;
    const stmt = db.prepare("DELETE FROM videos WHERE id = ?");
    for (const id of ids) {
      stmt.run(id);
    }
    return ids.length;
  },

  countStats(): { totalVideos: number; missingVideos: number } {
    const totalRow = db
      .prepare("SELECT COUNT(*) AS cnt FROM videos")
      .get() as { cnt: number };
    const missingRow = db
      .prepare("SELECT COUNT(*) AS cnt FROM videos WHERE is_missing = 1")
      .get() as { cnt: number };

    return {
      totalVideos: totalRow.cnt,
      missingVideos: missingRow.cnt,
    };
  },

  clearAllCatalogData(): void {
    db.exec(`
      DELETE FROM timestamp_tags;
      DELETE FROM video_tags;
      DELETE FROM tags;
      DELETE FROM videos;
    `);
  },

  exportAllForCatalog(): PortableCatalogVideoEntry[] {
    const videoRows = db
      .prepare(
        `SELECT id, title, relative_path, folder_path, duration_sec,
                file_size_bytes, mtime_ms, content_hash, is_missing,
                poster_url, created_at, updated_at
         FROM videos
         ORDER BY relative_path ASC`
      )
      .all() as unknown as VideoRow[];

    if (videoRows.length === 0) return [];

    const hydrated = hydrateVideos(videoRows);
    const metaById = new Map(videoRows.map((r) => [r.id, r]));

    return hydrated.map((v) => {
      const raw = metaById.get(v.id);
      const fallbackNow = new Date().toISOString();
      return {
        id: v.id,
        title: v.title,
        relativePath: v.relativePath,
        folderPath: v.folderPath,
        durationSec: v.durationSec,
        fileSizeBytes: v.fileSizeBytes,
        mtimeMs: raw?.mtime_ms ?? null,
        contentHash: v.contentHash,
        isMissing: v.isMissing,
        posterUrl: v.posterUrl,
        createdAt: raw?.created_at ?? fallbackNow,
        updatedAt: raw?.updated_at ?? fallbackNow,
        globalTags: v.globalTags.map((g) => g.name),
        timestampTags: v.timestampTags.map((ts) => ({
          id: ts.id,
          tagName: ts.tagName,
          timestampSec: ts.timestampSec,
          label: ts.label,
          createdAt: ts.createdAt,
        })),
      };
    });
  },
};
