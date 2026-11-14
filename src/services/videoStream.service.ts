import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { settingsRepository } from "@/repositories/settings.repository";
import { videoRepository } from "@/repositories/video.repository";
import { fileScannerService } from "./fileScanner.service";

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
};

export const videoStreamService = {
  resolveSafeVideoPath(videoId: string): {
    fullPath: string;
    fileSize: number;
    contentType: string;
  } {
    const rootDir = settingsRepository.getVideoRootDirectory();
    if (!rootDir) {
      throw new Error(
        "Aucun répertoire vidéo racine n'est configuré (Mode Admin)."
      );
    }

    const videoRecord = videoRepository.findRawMetaById(videoId);
    if (!videoRecord) {
      throw new Error("Vidéo introuvable dans la base de données.");
    }

    const resolvedRoot = path.resolve(rootDir);
    let resolvedFile = path.resolve(resolvedRoot, videoRecord.relativePath);

    // Protection stricte contre toute traversée de répertoire (Path Traversal)
    const verifyInsideRoot = (candidatePath: string) => {
      const relativeCheck = path.relative(resolvedRoot, candidatePath);
      if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
        throw new Error(
          "Accès refusé : chemin en dehors du répertoire autorisé."
        );
      }
    };

    verifyInsideRoot(resolvedFile);

    // Auto-réparation (Self-Healing) si le fichier a été déplacé ou renommé !
    if (!fs.existsSync(resolvedFile)) {
      const healedPath = fileScannerService.trySelfHealVideoById(videoId);
      if (!healedPath) {
        videoRepository.markMissingIds([videoId]);
        throw new Error(
          "Le fichier vidéo a été déplacé hors du répertoire racine ou supprimé."
        );
      }
      verifyInsideRoot(healedPath);
      resolvedFile = healedPath;
    }

    const stat = fs.statSync(resolvedFile);
    const ext = path.extname(resolvedFile).toLowerCase();
    const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

    return {
      fullPath: resolvedFile,
      fileSize: stat.size,
      contentType,
    };
  },

  createStreamResponse(videoId: string, rangeHeader: string | null): Response {
    const { fullPath, fileSize, contentType } =
      this.resolveSafeVideoPath(videoId);

    if (!rangeHeader) {
      const nodeStream = fs.createReadStream(fullPath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      return new Response(webStream, {
        status: 200,
        headers: {
          "Content-Length": String(fileSize),
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Parsing du header HTTP Range: bytes=start-end pour saut instantané au timestamp
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      return new Response("Plage invalide", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2 Mo par segment
    const start = match[1] ? Number.parseInt(match[1], 10) : 0;
    const requestedEnd = match[2]
      ? Number.parseInt(match[2], 10)
      : Math.min(start + DEFAULT_CHUNK_SIZE - 1, fileSize - 1);
    const end = Math.min(requestedEnd, fileSize - 1);

    if (start >= fileSize || start > end) {
      return new Response("Plage hors limites", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const nodeStream = fs.createReadStream(fullPath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  },
};
