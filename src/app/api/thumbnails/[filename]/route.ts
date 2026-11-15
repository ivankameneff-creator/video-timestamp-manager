import fs from "node:fs";
import { type NextRequest, NextResponse } from "next/server";
import { thumbnailStorageService } from "@/services/thumbnailStorage.service";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const resolved = thumbnailStorageService.resolveSafeThumbnailPath(filename);

  if (!resolved) {
    return NextResponse.json(
      { error: "Miniature introuvable." },
      { status: 404 }
    );
  }

  try {
    const buffer = fs.readFileSync(resolved.fullPath);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": resolved.contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur de lecture de la miniature." },
      { status: 500 }
    );
  }
}
