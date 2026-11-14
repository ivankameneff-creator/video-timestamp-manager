import type { Metadata } from "next";
import { SmoothScrollProvider } from "@/providers/SmoothScrollProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHRONOFRAME — Indexation Vidéo & Recherche par Timecode",
  description:
    "Plateforme cinématique de recherche vidéo instantanée par mots-clés et timestamps précis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-void text-ink antialiased selection:bg-amber-cue selection:text-void">
        {/* Superposition de grain photographique 35mm */}
        <div className="film-grain" aria-hidden="true" />

        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
