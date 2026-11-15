import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { tagRepository } from "@/repositories/tag.repository";
import { videoRepository } from "@/repositories/video.repository";
import { catalogSyncService } from "@/services/catalogSync.service";
import { thumbnailStorageService } from "@/services/thumbnailStorage.service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await context.params;
    const video = videoRepository.findById(videoId);
    if (!video) {
      return NextResponse.json(
        { error: "Vidéo introuvable." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      mode: "global" | "timestamp";
      tagName?: string;
      timestampSec?: number;
      label?: string;
      thumbnailDataUrl?: string | null;
    };

    if (!body.tagName?.trim()) {
      return NextResponse.json(
        { error: "Veuillez saisir au moins un mot-clé." },
        { status: 400 }
      );
    }

    // Permet de saisir plusieurs tags séparés par des virgules ("cascade, ralenti")
    const rawTags = body.tagName
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (body.mode === "global") {
      for (const t of rawTags) {
        tagRepository.addGlobalTagToVideo(videoId, t);
      }

      if (body.thumbnailDataUrl && !video.posterUrl) {
        const posterFile = thumbnailStorageService.saveDataUrlThumbnail(
          body.thumbnailDataUrl,
          `poster_${videoId}`
        );
        if (posterFile) {
          videoRepository.updatePosterIfEmpty(videoId, posterFile);
        }
      }
    } else if (body.mode === "timestamp") {
      const sec = Number(body.timestampSec ?? 0);
      if (!Number.isFinite(sec) || sec < 0) {
        return NextResponse.json(
          { error: "Timestamp invalide." },
          { status: 400 }
        );
      }

      for (const t of rawTags) {
        const tsId = randomUUID();
        const savedThumbFile = body.thumbnailDataUrl
          ? thumbnailStorageService.saveDataUrlThumbnail(
              body.thumbnailDataUrl,
              `ts_${tsId}`
            )
          : null;

        tagRepository.addTimestampTag({
          id: tsId,
          videoId,
          rawTagName: t,
          timestampSec: sec,
          label: body.label,
          thumbnailFile: savedThumbFile,
        });

        if (savedThumbFile && !video.posterUrl) {
          videoRepository.updatePosterIfEmpty(videoId, savedThumbFile);
        }
      }
    } else {
      return NextResponse.json(
        { error: "Mode d'ajout inconnu." },
        { status: 400 }
      );
    }

    catalogSyncService.exportCatalogToRoot();

    const updatedVideo = videoRepository.findById(videoId);
    return NextResponse.json({ video: updatedVideo });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur d'enregistrement du tag.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await context.params;
    const body = (await request.json()) as {
      durationSec?: number;
      timestampThumbnails?: {
        timestampTagId: string;
        thumbnailDataUrl: string;
      }[];
    };

    let mutated = false;

    if (
      typeof body.durationSec === "number" &&
      Number.isFinite(body.durationSec) &&
      body.durationSec > 0
    ) {
      videoRepository.updateDuration(videoId, body.durationSec);
      mutated = true;
    }

    if (Array.isArray(body.timestampThumbnails)) {
      for (const item of body.timestampThumbnails) {
        if (!item?.timestampTagId || !item?.thumbnailDataUrl) continue;
        const savedFile = thumbnailStorageService.saveDataUrlThumbnail(
          item.thumbnailDataUrl,
          `ts_${item.timestampTagId}`
        );
        if (savedFile) {
          tagRepository.updateTimestampThumbnail(
            item.timestampTagId,
            videoId,
            savedFile
          );
          videoRepository.updatePosterIfEmpty(videoId, savedFile);
          mutated = true;
        }
      }
    }

    if (mutated) {
      catalogSyncService.exportCatalogToRoot();
    }

    const updatedVideo = videoRepository.findById(videoId);
    return NextResponse.json({ video: updatedVideo });
  } catch {
    return NextResponse.json(
      { error: "Mise à jour impossible." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await context.params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const targetId = searchParams.get("id");

    if (!mode || !targetId) {
      return NextResponse.json(
        { error: "Paramètres de suppression manquants." },
        { status: 400 }
      );
    }

    if (mode === "global") {
      tagRepository.removeGlobalTagFromVideo(videoId, targetId);
    } else if (mode === "timestamp") {
      const orphanThumb = tagRepository.removeTimestampTag(targetId);
      if (orphanThumb) {
        thumbnailStorageService.deleteThumbnailFile(orphanThumb);
      }
    }

    catalogSyncService.exportCatalogToRoot();

    const updatedVideo = videoRepository.findById(videoId);
    return NextResponse.json({ video: updatedVideo });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur de suppression.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
