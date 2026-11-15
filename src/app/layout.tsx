import type { Metadata } from "next";
import { SmoothScrollProvider } from "@/providers/SmoothScrollProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "JOCURI & TIMECODES — Répertoire Vidéo de Danse Roumaine",
  description:
    "Indexation vidéo par mots-clés et timestamps précis pour retrouver instantanément chaque danse, figure et pas.",
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
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-void text-ink antialiased selection:bg-crimson selection:text-white">
        {/* Trame subtile de toile de lin tissée (blouse traditionnelle Ia) */}
        <div className="linen-weave" aria-hidden="true" />

        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
