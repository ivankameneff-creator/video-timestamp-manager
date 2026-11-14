"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Film,
  FolderCog,
  Search,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { useSectionReveal } from "@/hooks/useSectionReveal";
import { CinematicPlayer } from "@/components/ui/CinematicPlayer";
import { TimecodeBadge } from "@/components/ui/TimecodeBadge";
import { TagChip } from "@/components/ui/TagChip";
import type {
  SearchResponseDTO,
  TimestampSearchHit,
  VideoDTO,
} from "@/types/cinema.types";

export function SearchVaultSection() {
  const sectionRef = useRef<HTMLElement>(null);
  useSectionReveal(sectionRef);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SearchResponseDTO>({
    query: "",
    timestampHits: [],
    videoHits: [],
    availableTags: [],
  });

  const [activeVideo, setActiveVideo] = useState<VideoDTO | null>(null);
  const [seekRequest, setSeekRequest] = useState<{
    timestampSec: number;
    nonce: number;
  } | null>(null);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const json = (await res.json()) as SearchResponseDTO;
      setData(json);

      // Sélection initiale automatique de la première vidéo disponible sans auto-lecture forcée
      setActiveVideo((prev) => {
        if (prev) {
          const refreshed = json.videoHits.find((v) => v.id === prev.id);
          return refreshed ?? prev;
        }
        return json.videoHits[0] ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      runSearch(query);
    }, 180);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const handlePlayTimestampHit = (hit: TimestampSearchHit) => {
    const fullVideo =
      data.videoHits.find((v) => v.id === hit.video.id) ?? activeVideo;
    if (fullVideo) {
      setActiveVideo(fullVideo);
    }
    setActiveCueId(hit.id);
    setSeekRequest((prev) => ({
      timestampSec: hit.timestampSec,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  };

  const handlePlayVideoAt = (
    video: VideoDTO,
    seconds: number,
    cueId?: string
  ) => {
    setActiveVideo(video);
    setActiveCueId(cueId ?? null);
    setSeekRequest((prev) => ({
      timestampSec: seconds,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  };

  return (
    <section
      id="search"
      ref={sectionRef}
      aria-label="Recherche de vidéos par mot-clé et lecture au timestamp"
      className="camera-shot border-t border-white/10 bg-void px-6 py-16 md:px-12 md:py-20"
    >
      <div className="mx-auto max-w-7xl space-y-10">
        {/* EN-TÊTE DU PLAN 02 */}
        <div
          data-reveal
          className="flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-8"
        >
          <div>
            <p className="font-mono text-xs tracking-[0.28em] text-amber-cue uppercase">
              PLAN 02 — MODE UTILISATION // SALLE DE PROJECTION
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight uppercase sm:text-5xl">
              Recherche par Mot-Clé &amp; Timecode
            </h2>
          </div>

          <div className="flex items-center gap-4 font-mono text-xs text-muted">
            <span>{data.timestampHits.length} séquence(s) horodatée(s)</span>
            <span>•</span>
            <span>{data.videoHits.length} vidéo(s)</span>
          </div>
        </div>

        {/* BARRE DE RECHERCHE CINÉMATIQUE + NUAGE DE TAGS RAPIDES */}
        <div data-reveal className="space-y-4">
          <div className="relative">
            <label htmlFor="keyword-search" className="sr-only">
              Rechercher un mot-clé dans les vidéos et timestamps
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-amber-cue"
              aria-hidden="true"
            />
            <input
              id="keyword-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Saisissez un mot-clé (ex: interview, cascade, drone, refrain, tutoriel...)"
              className="w-full rounded-2xl border border-white/15 bg-surface py-4 pr-12 pl-14 text-base text-ink placeholder:text-muted/70 transition-colors focus:border-amber-cue focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
                className="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer rounded-full p-1.5 text-muted hover:bg-white/10 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {data.availableTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 inline-flex items-center gap-1.5 font-mono text-xs text-muted">
                <Sparkles className="h-3.5 w-3.5 text-amber-cue" aria-hidden="true" />
                Mots-clés indexés :
              </span>
              {data.availableTags.slice(0, 18).map((tag) => (
                <TagChip
                  key={tag.name}
                  label={tag.name}
                  count={tag.count}
                  active={query.trim().toLowerCase() === tag.name}
                  onClick={() =>
                    setQuery((prev) =>
                      prev.trim().toLowerCase() === tag.name ? "" : tag.name
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* GRILLE PRINCIPALE : RÉSULTATS À GAUCHE + MONITEUR DE LECTURE À DROITE */}
        <div
          data-reveal
          className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start"
        >
          {/* COLONNE GAUCHE : SÉQUENCES HORODATÉES & VIDÉOS */}
          <div className="space-y-8 lg:col-span-5">
            {/* État vide : aucune vidéo configurée */}
            {!loading &&
              data.videoHits.length === 0 &&
              !query.trim() && (
                <div className="rounded-2xl border border-dashed border-white/15 bg-surface/70 p-8 text-center">
                  <FolderCog
                    className="mx-auto h-9 w-9 text-amber-cue"
                    aria-hidden="true"
                  />
                  <h3 className="mt-4 font-display text-lg font-bold uppercase">
                    Aucune vidéo indexée
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    Configurez d&apos;abord le répertoire racine contenant votre
                    arborescence de vidéos dans le Mode Admin.
                  </p>
                  <Link
                    href="/admin"
                    className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-amber-cue px-5 py-2.5 text-xs font-semibold text-void transition-transform hover:scale-[1.02]"
                  >
                    <span>Ouvrir le Mode Admin</span>
                  </Link>
                </div>
              )}

            {/* 1. Séquences exactes trouvées par Timestamp */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-amber-cue uppercase">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Séquences au Timestamp ({data.timestampHits.length})</span>
                </h3>
                {data.videoHits.length > 0 && (
                  <Link
                    href="/configure"
                    className="font-mono text-xs text-muted underline-offset-4 hover:text-amber-cue hover:underline"
                  >
                    + Ajouter des tags
                  </Link>
                )}
              </div>

              {loading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-20 animate-pulse rounded-xl border border-white/5 bg-surface"
                    />
                  ))}
                </div>
              ) : data.timestampHits.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-surface/50 p-5 text-sm text-muted">
                  {query.trim()
                    ? `Aucun timestamp tagué ne correspond à « ${query} ».`
                    : "Aucun timestamp n'a encore été tagué. Utilisez le Mode Configure pour annoter des moments précis."}
                </div>
              ) : (
                <ul
                  data-lenis-prevent
                  className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1"
                >
                  {data.timestampHits.map((hit) => {
                    const isCurrent = activeCueId === hit.id;
                    return (
                      <li key={hit.id}>
                        <div
                          onClick={() => handlePlayTimestampHit(hit)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handlePlayTimestampHit(hit);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={`group flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none ${
                            isCurrent
                              ? "border-amber-cue bg-amber-cue/10"
                              : "border-white/10 bg-surface hover:border-amber-cue/45 hover:bg-elevated"
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-ink">
                                #{hit.tagName}
                              </span>
                              <span className="truncate text-sm font-medium text-ink/90">
                                {hit.video.title}
                              </span>
                            </div>

                            {hit.label && (
                              <p className="text-xs text-muted">{hit.label}</p>
                            )}

                            <p className="truncate font-mono text-[11px] text-muted/75">
                              Dossier : {hit.video.folderPath}
                            </p>
                          </div>

                          <div className="shrink-0">
                            <TimecodeBadge
                              seconds={hit.timestampSec}
                              active={isCurrent}
                              onClick={() => handlePlayTimestampHit(hit)}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 2. Vidéos correspondantes (Tags globaux & Titres) */}
            {data.videoHits.length > 0 && (
              <div className="space-y-3">
                <h3 className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-muted uppercase">
                  <Film className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Vidéos de la bibliothèque ({data.videoHits.length})</span>
                </h3>

                <ul
                  data-lenis-prevent
                  className="max-h-[320px] space-y-2.5 overflow-y-auto pr-1"
                >
                  {data.videoHits.map((video) => {
                    const isSelected = activeVideo?.id === video.id;
                    return (
                      <li
                        key={video.id}
                        className={`rounded-xl border p-3.5 transition-colors ${
                          isSelected
                            ? "border-white/30 bg-elevated"
                            : "border-white/10 bg-surface hover:border-white/25"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handlePlayVideoAt(video, 0)}
                            className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none"
                          >
                            <p className="truncate text-sm font-semibold text-ink">
                              {video.title}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted">
                              {video.folderPath}
                            </p>
                          </button>

                          <TimecodeBadge
                            seconds={0}
                            active={isSelected && activeCueId === null}
                            onClick={() => handlePlayVideoAt(video, 0)}
                          />
                        </div>

                        {video.globalTags.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {video.globalTags.map((gt) => (
                              <TagChip
                                key={gt.id}
                                label={gt.name}
                                onClick={() => setQuery(gt.name)}
                              />
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* COLONNE DROITE STICKY : LECTEUR CINÉMATIQUE & MARQUEURS DE LA VIDÉO ACTIVE */}
          <div className="space-y-5 lg:sticky lg:top-8 lg:col-span-7">
            <CinematicPlayer
              video={activeVideo}
              seekRequest={seekRequest}
              autoPlayOnSeek={seekRequest !== null}
            />

            {activeVideo && (
              <div className="rounded-2xl border border-white/10 bg-surface p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-muted uppercase">
                    <Tag className="h-3.5 w-3.5 text-amber-cue" aria-hidden="true" />
                    Index temporel de « {activeVideo.title} »
                  </span>
                  <Link
                    href={`/configure?videoId=${activeVideo.id}`}
                    className="font-mono text-xs text-amber-cue hover:underline"
                  >
                    Éditer les tags de cette vidéo →
                  </Link>
                </div>

                {activeVideo.timestampTags.length === 0 ? (
                  <p className="text-xs text-muted">
                    Aucun marqueur temporel enregistré sur cette vidéo.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeVideo.timestampTags.map((ts) => (
                      <div
                        key={ts.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-void/70 px-2.5 py-1.5"
                      >
                        <TimecodeBadge
                          seconds={ts.timestampSec}
                          active={activeCueId === ts.id}
                          onClick={() =>
                            handlePlayVideoAt(
                              activeVideo,
                              ts.timestampSec,
                              ts.id
                            )
                          }
                        />
                        <span className="text-xs font-medium text-ink">
                          #{ts.tagName}
                        </span>
                        {ts.label && (
                          <span className="text-xs text-muted">
                            — {ts.label}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
