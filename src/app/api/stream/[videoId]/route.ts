import { type NextRequest, NextResponse } from "next/server";
import { videoStreamService } from "@/services/videoStream.service";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await context.params;
    const rangeHeader = request.headers.get("range");
    return videoStreamService.createStreamResponse(videoId, rangeHeader);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur de lecture du flux vidéo.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
