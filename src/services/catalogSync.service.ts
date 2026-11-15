import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/repositories/db";
import { settingsRepository } from "@/repositories/settings.repository";
import {
  videoRepository,
  type PortableCatalogVideoEntry,
} from "@/repositories/video.repository";
import { normalizeTagName } from "@/lib/timecode";
import type { CatalogFileStatusDTO } from "@/types/cinema.types";

export const CATALOG_FILENAME = "chronoframe.catalog.json";

interface PortableCatalogPayload {
  schemaVersion: 1;
  app: "chronoframe";
  exportedAt: string;
  videos: PortableCatalogVideoEntry[];
}

export const catalogSyncService = {
  getCatalogPath(rootDir: string): string {
    return path.join(path.resolve(rootDir), CATALOG_FILENAME);
  },

  getCatalogFileStatus(rootDir: string | null): CatalogFileStatusDTO {
    if (!rootDir) {
      return {
        exists: false,
        filePath: null,
        updatedAt: null,
        sizeBytes: null,
      };
    }

    const filePath = this.getCatalogPath(rootDir);
    try {
      if (!fs.existsSync(filePath)) {
        return {
          exists: false,
          filePath,
          updatedAt: null,
          sizeBytes: null,
        };
      }
      const stat = fs.statSync(filePath);
      return {
        exists: true,
        filePath,
        updatedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      };
    } catch {
      return {
        exists: false,
        filePath,
        updatedAt: null,
        sizeBytes: null,
      };
    }
  },

  /**
   * Sauvegarde atomiquement toute la base SQLite active dans
   * <rootDirectory>/chronoframe.catalog.json
   */
  exportCatalogToRoot(explicitRootDir?: string | null): string | null {
    const rawRoot =
      explicitRootDir ?? settingsRepository.getVideoRootDirectory();
    if (!rawRoot) return null;

    const resolvedRoot = path.resolve(rawRoot);
    try {
      if (
        !fs.existsSync(resolvedRoot) ||
        !fs.statSync(resolvedRoot).isDirectory()
      ) {
        return null;
      }
    } catch {
      return null;
    }

    const payload: PortableCatalogPayload = {
      schemaVersion: 1,
      app: "chronoframe",
      exportedAt: new Date().toISOString(),
      videos: videoRepository.exportAllForCatalog(),
    };

    const finalPath = path.join(resolvedRoot, CATALOG_FILENAME);
    const tempPath = path.join(resolvedRoot, `.${CATALOG_FILENAME}.tmp`);
    const jsonString = JSON.stringify(payload, null, 2);

    try {
      fs.writeFileSync(tempPath, jsonString, "utf-8");
      try {
        fs.renameSync(tempPath, finalPath);
      } catch {
        // Fallback Windows si un indexeur/antivirus lit brièvement finalPath
        fs.writeFileSync(finalPath, jsonString, "utf-8");
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
      return finalPath;
    } catch {
      return null;
    }
  },

  /**
   * Lit <rootDirectory>/chronoframe.catalog.json (s'il existe) et restaure
   * intégralement les vidéos, empreintes SHA-256, tags globaux et timestamps en SQLite.
   */
  importCatalogFromRoot(rootDir: string): {
    restored: boolean;
    videosCount: number;
    timestampsCount: number;
  } {
    const resolvedRoot = path.resolve(rootDir);
    const catalogPath = path.join(resolvedRoot, CATALOG_FILENAME);

    if (!fs.existsSync(catalogPath)) {
      return { restored: false, videosCount: 0, timestampsCount: 0 };
    }

    let parsed: Partial<PortableCatalogPayload>;
    try {
      const content = fs.readFileSync(catalogPath, "utf-8");
      parsed = JSON.parse(content) as Partial<PortableCatalogPayload>;
    } catch {
      return { restored: false, videosCount: 0, timestampsCount: 0 };
    }

    if (!Array.isArray(parsed.videos)) {
      return { restored: false, videosCount: 0, timestampsCount: 0 };
    }

    const insertVideoStmt = db.prepare(`
      INSERT INTO videos (
        id, title, relative_path, folder_path, duration_sec,
        file_size_bytes, mtime_ms, content_hash, is_missing,
        poster_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTagStmt = db.prepare(`
      INSERT INTO tags (id, name) VALUES (?, ?)
    `);

    const insertVideoTagStmt = db.prepare(`
      INSERT OR IGNORE INTO video_tags (video_id, tag_id, created_at)
      VALUES (?, ?, ?)
    `);

    const insertTimestampTagStmt = db.prepare(`
      INSERT INTO timestamp_tags (id, video_id, tag_id, timestamp_sec, label, thumbnail_file, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const tagIdByName = new Map<string, string>();
    const ensureTagId = (rawName: string): string | null => {
      const normalized = normalizeTagName(rawName);
      if (!normalized) return null;
      const existing = tagIdByName.get(normalized);
      if (existing) return existing;
      const id = randomUUID();
      insertTagStmt.run(id, normalized);
      tagIdByName.set(normalized, id);
      return id;
    };

    let videosCount = 0;
    let timestampsCount = 0;
    const now = new Date().toISOString();
    const seenPaths = new Set<string>();

    db.exec("BEGIN;");
    try {
      videoRepository.clearAllCatalogData();

      for (const v of parsed.videos) {
        if (!v || typeof v.relativePath !== "string" || !v.relativePath) {
          continue;
        }
        if (seenPaths.has(v.relativePath)) continue;
        seenPaths.add(v.relativePath);

        const videoId =
          typeof v.id === "string" && v.id ? v.id : randomUUID();

        insertVideoStmt.run(
          videoId,
          v.title || path.basename(v.relativePath, path.extname(v.relativePath)),
          v.relativePath,
          v.folderPath || "/",
          typeof v.durationSec === "number" ? v.durationSec : null,
          typeof v.fileSizeBytes === "number" ? v.fileSizeBytes : null,
          typeof v.mtimeMs === "number" ? v.mtimeMs : null,
          typeof v.contentHash === "string" ? v.contentHash : null,
          v.isMissing ? 1 : 0,
          typeof v.posterUrl === "string" ? v.posterUrl : null,
          typeof v.createdAt === "string" ? v.createdAt : now,
          typeof v.updatedAt === "string" ? v.updatedAt : now
        );
        videosCount++;

        if (Array.isArray(v.globalTags)) {
          for (const tagName of v.globalTags) {
            if (typeof tagName !== "string") continue;
            const tagId = ensureTagId(tagName);
            if (tagId) {
              insertVideoTagStmt.run(videoId, tagId, now);
            }
          }
        }

        if (Array.isArray(v.timestampTags)) {
          for (const ts of v.timestampTags) {
            if (
              !ts ||
              typeof ts.tagName !== "string" ||
              typeof ts.timestampSec !== "number"
            ) {
              continue;
            }
            const tagId = ensureTagId(ts.tagName);
            if (!tagId) continue;

            insertTimestampTagStmt.run(
              typeof ts.id === "string" && ts.id ? ts.id : randomUUID(),
              videoId,
              tagId,
              Math.max(0, Number(ts.timestampSec.toFixed(2))),
              typeof ts.label === "string" && ts.label.trim()
                ? ts.label.trim()
                : null,
              typeof ts.thumbnailFile === "string" && ts.thumbnailFile.trim()
                ? ts.thumbnailFile.trim()
                : null,
              typeof ts.createdAt === "string" ? ts.createdAt : now
            );
            timestampsCount++;
          }
        }
      }

      db.exec("COMMIT;");
      return { restored: true, videosCount, timestampsCount };
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  },
};
