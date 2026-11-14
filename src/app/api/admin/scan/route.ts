import { type NextRequest, NextResponse } from "next/server";
import { fileScannerService } from "@/services/fileScanner.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const browseTarget = searchParams.get("browse");

    if (browseTarget !== null) {
      const listing = fileScannerService.browseDirectory(
        browseTarget || undefined
      );
      return NextResponse.json(listing);
    }

    const status = fileScannerService.getAdminStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de lire la configuration Admin.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      rootDirectory?: string;
      pruneMissing?: boolean;
    };

    if (!body.rootDirectory?.trim()) {
      return NextResponse.json(
        { error: "Le chemin du répertoire vidéo est obligatoire." },
        { status: 400 }
      );
    }

    const report = fileScannerService.configureAndScan(
      body.rootDirectory,
      body.pruneMissing ?? false
    );
    const status = fileScannerService.getAdminStatus();

    return NextResponse.json({ report, status });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Échec de l'indexation du répertoire.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
