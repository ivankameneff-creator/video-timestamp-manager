"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Film, FolderCog, Search, Tag, Play } from "lucide-react";
import { useHeroAnimation } from "@/hooks/useHeroAnimation";

interface HeroSectionProps {
  /** Chemin de la vidéo d'ambiance plein écran (MP4/WebM optimisé) */
  videoSrc?: string;
  /** Image optimisée de secours (mobile, lazy fallback & reduced-motion) */
  posterSrc?: string;
}

export function HeroSection({
  videoSrc = "/media/hero-reel.mp4",
  posterSrc = "/media/hero-poster.svg",
}: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldRenderVideo, setShouldRenderVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Hook GSAP isolé (masque de texte, zoom lent & parallaxe ScrollTrigger)
  useHeroAnimation(sectionRef);

  // Détection cliente : dégradation élégante sur mobile (< 768px) ou reduced-motion
  useEffect(() => {
    const mediaDesktop = window.matchMedia("(min-width: 768px)");
    const mediaNoReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: no-preference)"
    );

    const evaluateDeviceCapability = () => {
      setShouldRenderVideo(
        mediaDesktop.matches && mediaNoReducedMotion.matches
      );
    };

    evaluateDeviceCapability();
    mediaDesktop.addEventListener("change", evaluateDeviceCapability);
    mediaNoReducedMotion.addEventListener("change", evaluateDeviceCapability);

    return () => {
      mediaDesktop.removeEventListener("change", evaluateDeviceCapability);
      mediaNoReducedMotion.removeEventListener(
        "change",
        evaluateDeviceCapability
      );
    };
  }, []);

  // Lazy-play & mise en pause automatique hors viewport pour préserver les 60 FPS
  useEffect(() => {
    if (!shouldRenderVideo || !sectionRef.current || !videoRef.current) return;

    const videoEl = videoRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoEl.play().catch(() => {
            // Autoplay bloqué par le navigateur : le poster reste affiché proprement
          });
        } else {
          videoEl.pause();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [shouldRenderVideo]);

  return (
    <section
      ref={sectionRef}
      aria-label="Accueil Chronoframe — Recherche vidéo par timestamp"
      className="camera-shot flex flex-col justify-between bg-void px-6 py-8 md:px-12 md:py-10"
    >
      {/* CALQUE MÉDIA ARRIÈRE-PLAN (100dvh, GPU transform uniquement) */}
      <div
        data-hero-media
        className="pointer-events-none absolute inset-0 z-0 will-change-transform"
      >
        {/* Image optimisée / Fallback mobile & chargement initial sans CLS */}
        <div
          aria-hidden="true"
          style={{ backgroundImage: `url(${posterSrc})` }}
          className="absolute inset-0 bg-surface bg-cover bg-center opacity-55"
        />

        {/* Lueur atmosphérique salle de montage au cas où aucun média local n'est encore présent */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_68%_32%,rgba(229,169,60,0.14),transparent_52%),radial-gradient(circle_at_22%_75%,rgba(225,29,72,0.09),transparent_48%)]"
        />

        {/* Vidéo HTML5 chargée uniquement sur Desktop sans reduced-motion */}
        {shouldRenderVideo && (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="metadata"
            poster={posterSrc}
            onCanPlay={() => setVideoReady(true)}
            className={`h-full w-full object-cover transition-opacity duration-700 ${
              videoReady ? "opacity-45" : "opacity-0"
            }`}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        )}

        {/* Vignettage cinématique anamorphique garantissant un contraste WCAG AAA */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-void/85 via-void/45 to-void"
        />
      </div>

      {/* BARRE SUPÉRIEURE HUD — TIMECODE & NAVIGATION DES 3 MODES */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div data-hero-hud className="flex items-center gap-3">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rec shadow-[0_0_12px_rgba(225,29,72,0.9)]" />
          <span className="font-display text-sm font-bold tracking-[0.22em] uppercase">
            CHRONOFRAME
          </span>
          <span className="hidden font-mono text-xs text-muted sm:inline">
            // TC 01:14:08:22
          </span>
        </div>

        <nav
          data-hero-hud
          aria-label="Modes de l'application"
          className="flex items-center gap-2 sm:gap-3"
        >
          <Link
            href="#search"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-amber-cue/40 bg-amber-cue/10 px-3.5 py-1.5 font-mono text-xs text-amber-cue transition-colors duration-200 hover:bg-amber-cue hover:text-void focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Utilisation</span>
          </Link>
          <Link
            href="/configure"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-mono text-xs text-ink/90 transition-colors duration-200 hover:border-white/35 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none"
          >
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Configure</span>
          </Link>
          <Link
            href="/admin"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-mono text-xs text-ink/90 transition-colors duration-200 hover:border-white/35 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none"
          >
            <FolderCog className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Admin</span>
          </Link>
        </nav>
      </header>

      {/* CONTENU CENTRAL — TITRE À RÉVÉLATION PAR MASQUE & ACCÈS RECHERCHE */}
      <div
        data-hero-content
        className="relative z-10 mx-auto my-auto flex w-full max-w-6xl flex-col justify-center py-12 will-change-transform"
      >
        <p
          data-hero-fade
          className="mb-5 font-mono text-xs tracking-[0.28em] text-amber-cue uppercase"
        >
          PLAN 01 — MOTEUR D&apos;INDEXATION VIDÉO TEMPORELLE
        </p>

        <h1 className="font-display text-4xl leading-[0.98] font-extrabold tracking-tight uppercase sm:text-6xl lg:text-8xl">
          <span className="block overflow-hidden pb-2">
            <span data-hero-line className="block will-change-transform">
              CHAQUE MOT-CLÉ
            </span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span
              data-hero-line
              className="block text-ink/90 will-change-transform"
            >
              VOUS PROJETTE À
            </span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span
              data-hero-line
              className="block text-amber-cue will-change-transform"
            >
              LA SECONDE EXACTE.
            </span>
          </span>
        </h1>

        <p
          data-hero-fade
          className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg"
        >
          Explorez votre arborescence vidéo locale, annotez vos séquences à la
          seconde près et lancez instantanément la lecture au timecode recherché.
        </p>

        {/* Actions principales */}
        <div
          data-hero-fade
          className="mt-9 flex flex-wrap items-center gap-4"
        >
          <a
            href="#search"
            className="group inline-flex cursor-pointer items-center gap-3 rounded-full bg-amber-cue px-6 py-3.5 text-sm font-semibold text-void transition-transform duration-200 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            <span>Rechercher une séquence</span>
          </a>

          <Link
            href="/configure"
            className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-white/20 bg-surface/80 px-6 py-3.5 text-sm font-medium text-ink backdrop-blur-md transition-colors duration-200 hover:border-amber-cue/60 hover:text-amber-cue focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none"
          >
            <Film className="h-4 w-4" aria-hidden="true" />
            <span>Taguer des timestamps</span>
          </Link>
        </div>
      </div>

      {/* PIED DE CADRE CAMÉRA — MÉTADONNÉES TECHNIQUES & INDICATEUR DE SCROLL */}
      <footer className="relative z-10 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-5 font-mono text-xs text-muted">
        <div data-hero-fade className="flex flex-wrap items-center gap-6">
          <span>STREAMING HTTP 206 RANGE</span>
          <span className="hidden sm:inline">BASE SQLITE NATIVE (WAL)</span>
          <span className="hidden md:inline">ARBORESCENCE LOCALE</span>
        </div>

        <a
          data-hero-fade
          href="#search"
          className="cursor-pointer tracking-[0.2em] text-ink/80 uppercase transition-colors hover:text-amber-cue focus-visible:outline-none"
        >
          Défiler vers la recherche ↓
        </a>
      </footer>
    </section>
  );
}
