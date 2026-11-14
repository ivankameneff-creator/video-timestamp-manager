import { NextResponse } from "next/server";
import { videoRepository } from "@/repositories/video.repository";
import { tagRepository } from "@/repositories/tag.repository";
import { buildFolderTree } from "@/services/fileScanner.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const videos = videoRepository.findAll();
    const folderTree = buildFolderTree(videos.map((v) => v.folderPath));
    const availableTags = tagRepository.listAllTagsWithCounts();

    return NextResponse.json({
      videos,
      folderTree,
      availableTags,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les vidéos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
