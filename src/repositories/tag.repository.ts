import { randomUUID } from "node:crypto";
import { db } from "./db";
import { normalizeTagName } from "@/lib/timecode";
import { toThumbnailUrl } from "@/services/thumbnailStorage.service";
import type { TagDTO, TimestampTagDTO } from "@/types/cinema.types";

export const tagRepository = {
  getOrCreateTag(rawName: string): TagDTO {
    const name = normalizeTagName(rawName);
    if (!name) {
      throw new Error("Le mot-clé ne peut pas être vide.");
    }

    const existing = db
      .prepare("SELECT id, name FROM tags WHERE name = ?")
      .get(name) as TagDTO | undefined;

    if (existing) {
      return existing;
    }

    const id = randomUUID();
    db.prepare("INSERT INTO tags (id, name) VALUES (?, ?)").run(id, name);
    return { id, name };
  },

  addGlobalTagToVideo(videoId: string, rawTagName: string): TagDTO {
    const tag = this.getOrCreateTag(rawTagName);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT OR IGNORE INTO video_tags (video_id, tag_id, created_at)
       VALUES (?, ?, ?)`
    ).run(videoId, tag.id, now);

    return tag;
  },

  removeGlobalTagFromVideo(videoId: string, tagId: string): void {
    db.prepare(
      "DELETE FROM video_tags WHERE video_id = ? AND tag_id = ?"
    ).run(videoId, tagId);
  },

  addTimestampTag(params: {
    id?: string;
    videoId: string;
    rawTagName: string;
    timestampSec: number;
    label?: string | null;
    thumbnailFile?: string | null;
  }): TimestampTagDTO {
    const tag = this.getOrCreateTag(params.rawTagName);
    const id = params.id ?? randomUUID();
    const now = new Date().toISOString();
    const timestampSec = Math.max(0, Number(params.timestampSec.toFixed(2)));
    const label = params.label?.trim() || null;
    const thumbnailFile = params.thumbnailFile ?? null;

    db.prepare(
      `INSERT INTO timestamp_tags (id, video_id, tag_id, timestamp_sec, label, thumbnail_file, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, params.videoId, tag.id, timestampSec, label, thumbnailFile, now);

    return {
      id,
      videoId: params.videoId,
      tagId: tag.id,
      tagName: tag.name,
      timestampSec,
      label,
      thumbnailUrl: toThumbnailUrl(thumbnailFile),
      createdAt: now,
    };
  },

  updateTimestampThumbnail(
    timestampTagId: string,
    videoId: string,
    thumbnailFile: string
  ): void {
    db.prepare(
      "UPDATE timestamp_tags SET thumbnail_file = ? WHERE id = ? AND video_id = ?"
    ).run(thumbnailFile, timestampTagId, videoId);
  },

  /**
   * Supprime le timestamp et retourne son thumbnail_file uniquement
   * si aucun autre timestamp ne partage ce fichier image.
   */
  removeTimestampTag(id: string): string | null {
    const existing = db
      .prepare("SELECT thumbnail_file FROM timestamp_tags WHERE id = ?")
      .get(id) as { thumbnail_file: string | null } | undefined;

    db.prepare("DELETE FROM timestamp_tags WHERE id = ?").run(id);

    const thumb = existing?.thumbnail_file ?? null;
    if (!thumb) return null;

    const remaining = db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM timestamp_tags WHERE thumbnail_file = ?"
      )
      .get(thumb) as { cnt: number };

    return remaining.cnt === 0 ? thumb : null;
  },

  listAllTagsWithCounts(): { name: string; count: number }[] {
    const rows = db
      .prepare(
        `SELECT t.name AS name,
                (SELECT COUNT(*) FROM video_tags vt WHERE vt.tag_id = t.id) +
                (SELECT COUNT(*) FROM timestamp_tags tt WHERE tt.tag_id = t.id) AS count
         FROM tags t`
      )
      .all() as unknown as { name: string; count: number }[];

    return rows
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  },

  countStats(): { totalTags: number; totalTimestampTags: number } {
    const tagsRow = db
      .prepare("SELECT COUNT(*) AS cnt FROM tags")
      .get() as { cnt: number };
    const tsRow = db
      .prepare("SELECT COUNT(*) AS cnt FROM timestamp_tags")
      .get() as { cnt: number };

    return {
      totalTags: tagsRow.cnt,
      totalTimestampTags: tsRow.cnt,
    };
  },
};
