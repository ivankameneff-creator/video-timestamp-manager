import { NextRequest, NextResponse } from "next/server";
import {
  getAuthSecret,
  isAuthEnabled,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth";

export async function middleware(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Autoriser la lecture publique des tags (GET/HEAD) sur /api/videos/[videoId]/tags
  if (
    pathname.startsWith("/api/videos/") &&
    pathname.endsWith("/tags") &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await verifySessionToken(token, getAuthSecret());

  if (valid) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentification administrateur requise." },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/configure/:path*",
    "/api/admin/:path*",
    "/api/videos/:path*/tags",
  ],
};
