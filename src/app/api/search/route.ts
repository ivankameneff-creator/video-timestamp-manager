import { type NextRequest, NextResponse } from "next/server";
import { tagSearchService } from "@/services/tagSearch.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const folder = searchParams.get("folder") ?? undefined;

    const results = tagSearchService.searchByKeyword(query, folder);
    return NextResponse.json(results);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors de la recherche.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
