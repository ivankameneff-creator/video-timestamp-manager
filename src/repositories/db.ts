import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as {
  chronoDb: DatabaseSync | undefined;
};

function ensureVideoColumns(db: DatabaseSync): void {
  const columns = db
    .prepare("PRAGMA table_info(videos)")
    .all() as unknown as { name: string }[];

  const existingNames = new Set(columns.map((c) => c.name));

  if (!existingNames.has("content_hash")) {
    db.exec("ALTER TABLE videos ADD COLUMN content_hash TEXT;");
  }
  if (!existingNames.has("mtime_ms")) {
    db.exec("ALTER TABLE videos ADD COLUMN mtime_ms INTEGER;");
  }
  if (!existingNames.has("is_missing")) {
    db.exec("ALTER TABLE videos ADD COLUMN is_missing INTEGER NOT NULL DEFAULT 0;");
  }

  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_videos_content_hash ON videos(content_hash);"
  );

  const tsColumns = db
    .prepare("PRAGMA table_info(timestamp_tags)")
    .all() as unknown as { name: string }[];
  const existingTsNames = new Set(tsColumns.map((c) => c.name));

  if (!existingTsNames.has("thumbnail_file")) {
    db.exec("ALTER TABLE timestamp_tags ADD COLUMN thumbnail_file TEXT;");
  }
}

function createDatabase(): DatabaseSync {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "chronoframe.sqlite");
  const db = new DatabaseSync(dbPath);

  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      relative_path TEXT NOT NULL UNIQUE,
      folder_path TEXT NOT NULL,
      duration_sec REAL,
      file_size_bytes INTEGER,
      mtime_ms INTEGER,
      content_hash TEXT,
      is_missing INTEGER NOT NULL DEFAULT 0,
      poster_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_videos_folder ON videos(folder_path);
    CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title);

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

    CREATE TABLE IF NOT EXISTS video_tags (
      video_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (video_id, tag_id),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timestamp_tags (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      timestamp_sec REAL NOT NULL,
      label TEXT,
      thumbnail_file TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ts_video_sec ON timestamp_tags(video_id, timestamp_sec);
    CREATE INDEX IF NOT EXISTS idx_ts_tag ON timestamp_tags(tag_id);
  `);

  ensureVideoColumns(db);

  return db;
}

export const db: DatabaseSync = globalForDb.chronoDb ?? createDatabase();

// Garantit aussi la migration si l'instance globale existait déjà en dev HMR
ensureVideoColumns(db);

if (process.env.NODE_ENV !== "production") {
  globalForDb.chronoDb = db;
}
