import fs from "node:fs";
import path from "node:path";
import { settingsRepository } from "@/repositories/settings.repository";

export const THUMBNAILS_DIRNAME = ".chronoframe-thumbnails";

const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024; // 2 Mo max par sécurité

const MIME_BY_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export function toThumbnailUrl(
  filename: string | null | undefined
): string | null {
  if (!filename || !SAFE_FILENAME_REGEX.test(filename)) return null;
  return `/api/thumbnails/${filename}`;
}

export const thumbnailStorageService = {
  getThumbnailsDirectory(explicitRootDir?: string | null): string | null {
    const rootDir =
      explicitRootDir ?? settingsRepository.getVideoRootDirectory();
    if (!rootDir) return null;

    const resolvedRoot = path.resolve(rootDir);
    if (!fs.existsSync(resolvedRoot)) return null;

    return path.join(resolvedRoot, THUMBNAILS_DIRNAME);
  },

  /**
   * Décode un DataURL ("data:image/webp;base64,...") et l'enregistre dans
   * <rootDirectory>/.chronoframe-thumbnails/<safeBaseId>.webp
   */
  saveDataUrlThumbnail(
    dataUrl: string | undefined | null,
    baseId: string
  ): string | null {
    if (!dataUrl || typeof dataUrl !== "string") return null;

    const match = /^data:image\/(webp|jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/.exec(
      dataUrl.trim()
    );
    if (!match) return null;

    const rawFormat = match[1].toLowerCase();
    const ext = rawFormat === "jpeg" ? "jpg" : rawFormat;
    const sanitizedBase = baseId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!sanitizedBase) return null;

    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0 || buffer.length > MAX_THUMBNAIL_BYTES) {
      return null;
    }

    const thumbsDir = this.getThumbnailsDirectory();
    if (!thumbsDir) return null;

    try {
      if (!fs.existsSync(thumbsDir)) {
        fs.mkdirSync(thumbsDir, { recursive: true });
      }
      const filename = `${sanitizedBase}.${ext}`;
      const fullPath = path.join(thumbsDir, filename);
      fs.writeFileSync(fullPath, buffer);
      return filename;
    } catch {
      return null;
    }
  },

  deleteThumbnailFile(filename: string | null | undefined): void {
    if (!filename || !SAFE_FILENAME_REGEX.test(filename)) return;
    const thumbsDir = this.getThumbnailsDirectory();
    if (!thumbsDir) return;

    const targetPath = path.join(thumbsDir, filename);
    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    } catch {
      // Ignore si déjà supprimé
    }
  },

  resolveSafeThumbnailPath(
    filename: string
  ): { fullPath: string; contentType: string } | null {
    if (!SAFE_FILENAME_REGEX.test(filename)) return null;

    const thumbsDir = this.getThumbnailsDirectory();
    if (!thumbsDir) return null;

    const resolvedDir = path.resolve(thumbsDir);
    const resolvedFile = path.resolve(resolvedDir, filename);

    const rel = path.relative(resolvedDir, resolvedFile);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;

    if (!fs.existsSync(resolvedFile)) return null;

    const ext = path.extname(resolvedFile).toLowerCase();
    return {
      fullPath: resolvedFile,
      contentType: MIME_BY_EXT[ext] ?? "image/webp",
    };
  },
};
