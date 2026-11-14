import { db } from "./db";

const VIDEO_ROOT_KEY = "VIDEO_ROOT_DIRECTORY";

export const settingsRepository = {
  getVideoRootDirectory(): string | null {
    const stmt = db.prepare("SELECT value FROM app_settings WHERE key = ?");
    const row = stmt.get(VIDEO_ROOT_KEY) as { value: string } | undefined;
    return row?.value ?? null;
  },

  setVideoRootDirectory(directoryPath: string): string {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);
    stmt.run(VIDEO_ROOT_KEY, directoryPath, now);
    return directoryPath;
  },
};
