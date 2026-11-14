import fs from "node:fs";
import { createHash } from "node:crypto";

const CHUNK_SIZE = 64 * 1024; // 64 Ko par fenêtre (max 192 Ko lus par vidéo)

/**
 * Calcule une empreinte binaire rapide (Sparse SHA-256) combinant la taille exacte
 * du fichier et jusqu'à 3 échantillons de 64 Ko (début, milieu, fin).
 * Temps d'exécution O(1) (< 1 ms sur SSD), même sur des vidéos de plusieurs Go.
 */
export function computeSparseFileHash(
  filePath: string,
  knownFileSize?: number
): string {
  const fd = fs.openSync(filePath, "r");
  try {
    const size = knownFileSize ?? fs.fstatSync(fd).size;
    const hash = createHash("sha256");

    // Intègre la taille exacte au byte près dans la signature
    hash.update(`size:${size};`);

    if (size === 0) {
      return hash.digest("hex");
    }

    // Si le fichier fait <= 192 Ko, lecture complète en un seul appel
    if (size <= CHUNK_SIZE * 3) {
      const fullBuffer = Buffer.allocUnsafe(size);
      const bytesRead = fs.readSync(fd, fullBuffer, 0, size, 0);
      hash.update(fullBuffer.subarray(0, bytesRead));
      return hash.digest("hex");
    }

    // Sinon lecture de 3 fenêtres fixes : tête, milieu, queue
    const offsets = [
      0,
      Math.floor(size / 2) - Math.floor(CHUNK_SIZE / 2),
      size - CHUNK_SIZE,
    ];

    const buffer = Buffer.allocUnsafe(CHUNK_SIZE);
    for (const offset of offsets) {
      const bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, offset);
      hash.update(buffer.subarray(0, bytesRead));
    }

    return hash.digest("hex");
  } finally {
    fs.closeSync(fd);
  }
}
