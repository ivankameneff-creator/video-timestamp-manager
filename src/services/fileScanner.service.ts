import fs from "node:fs";
import path from "node:path";
import { db } from "@/repositories/db";
import { settingsRepository } from "@/repositories/settings.repository";
import {
  videoRepository,
  type RawSyncVideoRow,
} from "@/repositories/video.repository";
import { tagRepository } from "@/repositories/tag.repository";
import { computeSparseFileHash } from "./fileFingerprint.service";
import { catalogSyncService } from "./catalogSync.service";
import type {
  AdminConfigDTO,
  FolderTreeNode,
  ScanResultDTO,
} from "@/types/cinema.types";

const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".mkv",
  ".m4v",
  ".ogg",
  ".avi",
]);

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  "$RECYCLE.BIN",
  "System Volume Information",
]);

interface DiscoveredFileStat {
  fullPath: string;
  title: string;
  relativePath: string;
  folderPath: string;
  fileSizeBytes: number;
  mtimeMs: number;
}

function extractMp4DurationSec(filePath: string): number | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".mp4" && ext !== ".mov" && ext !== ".m4v") return null;

  try {
    const fd = fs.openSync(filePath, "r");
    try {
      const stat = fs.fstatSync(fd);
      const maxBytes = Math.min(stat.size, 4 * 1024 * 1024);
      const headBuf = Buffer.alloc(maxBytes);
      fs.readSync(fd, headBuf, 0, maxBytes, 0);

      let buf = headBuf;
      let idx = buf.indexOf(Buffer.from("mvhd"));

      if (idx < 0 && stat.size > maxBytes) {
        const tailSize = Math.min(stat.size, 4 * 1024 * 1024);
        const tailBuf = Buffer.alloc(tailSize);
        fs.readSync(fd, tailBuf, 0, tailSize, stat.size - tailSize);
        buf = tailBuf;
        idx = buf.indexOf(Buffer.from("mvhd"));
      }

      if (idx < 0 || idx + 32 > buf.length) return null;
      const version = buf[idx + 4];
      const timescale =
        version === 1
          ? buf.readUInt32BE(idx + 20)
          : buf.readUInt32BE(idx + 16);
      const durationUnits =
        version === 1
          ? Number(buf.readBigUInt64BE(idx + 24))
          : buf.readUInt32BE(idx + 20);

      if (!timescale || !Number.isFinite(durationUnits)) return null;
      return Number((durationUnits / timescale).toFixed(1));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

function toPosixPath(p: string): string {
  return p.split(path.sep).join("/");
}

function areSameDirectories(dirA: string, dirB: string): boolean {
  const normA = path.resolve(dirA);
  const normB = path.resolve(dirB);
  return process.platform === "win32"
    ? normA.toLowerCase() === normB.toLowerCase()
    : normA === normB;
}

function walkVideoDirectory(
  rootDir: string,
  currentDir: string,
  results: DiscoveredFileStat[]
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      walkVideoDirectory(rootDir, fullPath, results);
      continue;
    }

    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_VIDEO_EXTENSIONS.has(ext)) continue;

      try {
        const stat = fs.statSync(fullPath);
        const rel = toPosixPath(path.relative(rootDir, fullPath));
        const rawDir = toPosixPath(path.dirname(rel));
        const folderPath = rawDir === "." ? "/" : `/${rawDir}`;
        const title = path.basename(entry.name, ext);

        results.push({
          fullPath,
          title,
          relativePath: rel,
          folderPath,
          fileSizeBytes: stat.size,
          mtimeMs: Math.trunc(stat.mtimeMs),
        });
      } catch {
        // Ignore un fichier verrouillé
      }
    }
  }
}

export function buildFolderTree(folderPaths: string[]): FolderTreeNode[] {
  interface MutableNode {
    name: string;
    path: string;
    videoCount: number;
    childrenMap: Map<string, MutableNode>;
  }

  const root: MutableNode = {
    name: "Racine",
    path: "/",
    videoCount: 0,
    childrenMap: new Map(),
  };

  for (const fp of folderPaths) {
    root.videoCount += 1;
    if (fp === "/" || !fp) continue;

    const segments = fp.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";

    for (const seg of segments) {
      currentPath += `/${seg}`;
      let child = current.childrenMap.get(seg);
      if (!child) {
        child = {
          name: seg,
          path: currentPath,
          videoCount: 0,
          childrenMap: new Map(),
        };
        current.childrenMap.set(seg, child);
      }
      child.videoCount += 1;
      current = child;
    }
  }

  function serialize(node: MutableNode): FolderTreeNode {
    const children = Array.from(node.childrenMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(serialize);
    return {
      name: node.name,
      path: node.path,
      videoCount: node.videoCount,
      children,
    };
  }

  return [serialize(root)];
}

export const fileScannerService = {
  getAdminStatus(): AdminConfigDTO {
    const rootDirectory = settingsRepository.getVideoRootDirectory();
    let directoryExists = false;

    if (rootDirectory) {
      try {
        directoryExists = fs.statSync(rootDirectory).isDirectory();
      } catch {
        directoryExists = false;
      }
    }

    const videos = videoRepository.findAll({ includeMissing: false });
    const { totalVideos, missingVideos } = videoRepository.countStats();
    const { totalTags, totalTimestampTags } = tagRepository.countStats();
    const catalogFile = catalogSyncService.getCatalogFileStatus(rootDirectory);
    const folderTree = buildFolderTree(videos.map((v) => v.folderPath));

    return {
      rootDirectory,
      directoryExists,
      totalVideos,
      missingVideos,
      totalTags,
      totalTimestampTags,
      catalogFile,
      folderTree,
    };
  },

  configureAndScan(
    rawDirectoryPath: string,
    pruneMissing = false
  ): ScanResultDTO {
    const trimmed = rawDirectoryPath.trim();
    if (!trimmed) {
      throw new Error("Veuillez saisir le chemin d'un répertoire valide.");
    }

    const resolvedRoot = path.resolve(trimmed);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolvedRoot);
    } catch {
      throw new Error(
        `Le répertoire "${resolvedRoot}" est introuvable ou inaccessible.`
      );
    }

    if (!stat.isDirectory()) {
      throw new Error(`Le chemin "${resolvedRoot}" n'est pas un dossier.`);
    }

    const previousRoot = settingsRepository.getVideoRootDirectory();
    const isSwitchingRoot =
      previousRoot !== null && !areSameDirectories(previousRoot, resolvedRoot);

    let restoredFromCatalog = false;
    let restoredVideosCount = 0;
    let restoredTimestampsCount = 0;

    if (isSwitchingRoot) {
      // 1. Sauvegarde finale de sécurité dans l'ancien répertoire avant de basculer
      if (videoRepository.countStats().totalVideos > 0) {
        catalogSyncService.exportCatalogToRoot(previousRoot);
      }

      // 2. Nettoyage du cache SQLite actif puis lecture du fichier chronoframe.catalog.json du nouveau dossier
      videoRepository.clearAllCatalogData();
      const imported = catalogSyncService.importCatalogFromRoot(resolvedRoot);
      restoredFromCatalog = imported.restored;
      restoredVideosCount = imported.videosCount;
      restoredTimestampsCount = imported.timestampsCount;
    } else if (videoRepository.countStats().totalVideos === 0) {
      // Base SQLite locale vierge (ex: premier lancement sur un autre PC) : restaure si chronoframe.catalog.json existe
      const imported = catalogSyncService.importCatalogFromRoot(resolvedRoot);
      restoredFromCatalog = imported.restored;
      restoredVideosCount = imported.videosCount;
      restoredTimestampsCount = imported.timestampsCount;
    }

    settingsRepository.setVideoRootDirectory(resolvedRoot);

    const discovered: DiscoveredFileStat[] = [];
    walkVideoDirectory(resolvedRoot, resolvedRoot, discovered);

    const existingRows = videoRepository.findAllRawForSync();
    const existingByPath = new Map<string, RawSyncVideoRow>();
    for (const row of existingRows) {
      existingByPath.set(row.relativePath, row);
    }

    const matchedExistingIds = new Set<string>();
    const activeContentHashes = new Set<string>();
    const unmatchedFiles: (DiscoveredFileStat & { contentHash: string })[] = [];

    let addedCount = 0;
    let relocatedCount = 0;
    let updatedCount = 0;
    let duplicatesSkippedCount = 0;

    // ÉTAPE 1 : Vérification des fichiers situés à un chemin déjà connu
    for (const file of discovered) {
      const samePathRow = existingByPath.get(file.relativePath);

      if (samePathRow) {
        // Fast-path O(1) : même chemin, même taille, même mtime et hash déjà connu
        if (
          samePathRow.contentHash &&
          samePathRow.fileSizeBytes === file.fileSizeBytes &&
          samePathRow.mtimeMs === file.mtimeMs
        ) {
          matchedExistingIds.add(samePathRow.id);
          activeContentHashes.add(samePathRow.contentHash);
          if (samePathRow.isMissing) {
            videoRepository.markPresent(samePathRow.id);
          }
          updatedCount++;
          continue;
        }

        // Calcul de l'empreinte Sparse SHA-256 (192 Ko max)
        const computedHash = computeSparseFileHash(
          file.fullPath,
          file.fileSizeBytes
        );

        // Même fichier mis à jour ou migration initiale de content_hash (était null)
        if (
          !samePathRow.contentHash ||
          samePathRow.contentHash === computedHash
        ) {
          matchedExistingIds.add(samePathRow.id);
          activeContentHashes.add(computedHash);
          videoRepository.relinkOrUpdateVideo(samePathRow.id, {
            title: file.title,
            relativePath: file.relativePath,
            folderPath: file.folderPath,
            fileSizeBytes: file.fileSizeBytes,
            mtimeMs: file.mtimeMs,
            contentHash: computedHash,
            durationSec:
              samePathRow.durationSec ?? extractMp4DurationSec(file.fullPath),
          });
          updatedCount++;
          continue;
        }
        // Sinon : un fichier différent a pris ce nom (ex: échange de noms entre 2 vidéos)
      }

      const computedHash = computeSparseFileHash(
        file.fullPath,
        file.fileSizeBytes
      );
      unmatchedFiles.push({ ...file, contentHash: computedHash });
    }

    // ÉTAPE 2 : Pool des vidéos BDD orphelines (candidates à un déplacement ou renommage)
    const orphanPool = existingRows.filter(
      (r) => !matchedExistingIds.has(r.id)
    );

    db.exec("BEGIN;");
    try {
      // Détache temporairement les chemins des orphelins dont le chemin est réutilisé par un autre fichier
      const incomingPaths = new Set(unmatchedFiles.map((f) => f.relativePath));
      for (const orphan of orphanPool) {
        if (incomingPaths.has(orphan.relativePath)) {
          videoRepository.detachTemporaryPath(orphan.id);
        }
      }

      // ÉTAPE 3 : Réconciliation par empreinte binaire (Sparse SHA-256)
      for (const file of unmatchedFiles) {
        // 3a. Recherche prioritaire par content_hash exact parmi les orphelins
        let orphanIndex = orphanPool.findIndex(
          (o) => o.contentHash !== null && o.contentHash === file.contentHash
        );

        // 3b. Fallback si une ancienne entrée n'avait pas encore de content_hash : taille exacte unique
        if (orphanIndex < 0) {
          const legacyCandidates = orphanPool.filter(
            (o) =>
              o.contentHash === null && o.fileSizeBytes === file.fileSizeBytes
          );
          if (legacyCandidates.length === 1) {
            orphanIndex = orphanPool.indexOf(legacyCandidates[0]);
          }
        }

        if (orphanIndex >= 0) {
          const [matchedOrphan] = orphanPool.splice(orphanIndex, 1);
          videoRepository.relinkOrUpdateVideo(matchedOrphan.id, {
            title: file.title,
            relativePath: file.relativePath,
            folderPath: file.folderPath,
            fileSizeBytes: file.fileSizeBytes,
            mtimeMs: file.mtimeMs,
            contentHash: file.contentHash,
            durationSec:
              matchedOrphan.durationSec ?? extractMp4DurationSec(file.fullPath),
          });
          activeContentHashes.add(file.contentHash);
          relocatedCount++;
          continue;
        }

        // 3c. Si le hash correspond déjà à une vidéo active présente ailleurs -> doublon ignoré
        if (activeContentHashes.has(file.contentHash)) {
          duplicatesSkippedCount++;
          continue;
        }

        // 3d. Nouvelle vidéo légitime
        videoRepository.insertNewVideo({
          title: file.title,
          relativePath: file.relativePath,
          folderPath: file.folderPath,
          fileSizeBytes: file.fileSizeBytes,
          mtimeMs: file.mtimeMs,
          contentHash: file.contentHash,
          durationSec: extractMp4DurationSec(file.fullPath),
        });
        activeContentHashes.add(file.contentHash);
        addedCount++;
      }

      // ÉTAPE 4 : Traitement des orphelins restants (absents du répertoire racine)
      const remainingOrphanIds = orphanPool.map((o) => o.id);
      let removedCount = 0;
      let missingCount = 0;

      if (pruneMissing) {
        removedCount = videoRepository.deleteByIds(remainingOrphanIds);
      } else {
        missingCount = videoRepository.markMissingIds(remainingOrphanIds);
      }

      db.exec("COMMIT;");

      // Persiste systématiquement le catalogue complet à jour dans <resolvedRoot>/chronoframe.catalog.json
      const catalogSavedPath =
        catalogSyncService.exportCatalogToRoot(resolvedRoot);

      const activeVideos = videoRepository.findAll({ includeMissing: false });

      return {
        rootDirectory: resolvedRoot,
        scannedFiles: discovered.length,
        addedCount,
        relocatedCount,
        updatedCount,
        duplicatesSkippedCount,
        missingCount,
        removedCount,
        restoredFromCatalog,
        restoredVideosCount,
        restoredTimestampsCount,
        catalogSavedPath,
        folderTree: buildFolderTree(activeVideos.map((v) => v.folderPath)),
      };
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  },

  /**
   * Auto-réparation à la volée (Self-Healing) appelée par le lecteur vidéo
   * lorsqu'un fichier a été déplacé ou renommé sans relancer de scan Admin.
   */
  trySelfHealVideoById(videoId: string): string | null {
    const rootDir = settingsRepository.getVideoRootDirectory();
    if (!rootDir || !fs.existsSync(rootDir)) return null;

    const target = videoRepository.findRawMetaById(videoId);
    if (!target || target.fileSizeBytes === null) return null;

    const resolvedRoot = path.resolve(rootDir);
    const discovered: DiscoveredFileStat[] = [];
    walkVideoDirectory(resolvedRoot, resolvedRoot, discovered);

    // Filtre instantané O(N) sur la taille exacte au byte près avant tout calcul de hash
    const sameSizeCandidates = discovered.filter(
      (f) => f.fileSizeBytes === target.fileSizeBytes
    );
    if (sameSizeCandidates.length === 0) return null;

    let winner: (DiscoveredFileStat & { hash: string }) | null = null;

    if (target.contentHash) {
      for (const candidate of sameSizeCandidates) {
        const hash = computeSparseFileHash(
          candidate.fullPath,
          candidate.fileSizeBytes
        );
        if (hash === target.contentHash) {
          winner = { ...candidate, hash };
          break;
        }
      }
    } else if (sameSizeCandidates.length === 1) {
      // Fallback sécurisé si la vidéo n'avait pas encore d'empreinte enregistrée
      const sole = sameSizeCandidates[0];
      winner = {
        ...sole,
        hash: computeSparseFileHash(sole.fullPath, sole.fileSizeBytes),
      };
    }

    if (!winner) return null;

    // Évite tout conflit si une ligne obsolète occupait déjà ce chemin
    const allRows = videoRepository.findAllRawForSync();
    const conflict = allRows.find(
      (r) => r.relativePath === winner.relativePath && r.id !== videoId
    );
    if (conflict) return null;

    videoRepository.relinkOrUpdateVideo(videoId, {
      title: winner.title,
      relativePath: winner.relativePath,
      folderPath: winner.folderPath,
      fileSizeBytes: winner.fileSizeBytes,
      mtimeMs: winner.mtimeMs,
      contentHash: winner.hash,
      durationSec: target.durationSec ?? extractMp4DurationSec(winner.fullPath),
    });

    catalogSyncService.exportCatalogToRoot(resolvedRoot);

    return winner.fullPath;
  },

  browseDirectory(targetPath?: string): {
    currentPath: string;
    parentPath: string | null;
    directories: { name: string; fullPath: string }[];
  } {
    const fallback =
      settingsRepository.getVideoRootDirectory() || process.cwd();
    const resolved = path.resolve(targetPath?.trim() || fallback);

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Dossier introuvable : ${resolved}`);
    }

    const parent = path.dirname(resolved);
    const parentPath = parent !== resolved ? parent : null;

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const directories = entries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith(".") &&
          !IGNORED_DIRECTORIES.has(e.name)
      )
      .map((e) => ({
        name: e.name,
        fullPath: path.join(resolved, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      currentPath: resolved,
      parentPath,
      directories,
    };
  },
};
