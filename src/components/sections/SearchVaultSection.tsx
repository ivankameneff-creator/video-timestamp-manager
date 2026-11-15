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
import { formatTimecode } from "@/lib/timecode";
import { useSectionReveal } from "@/hooks/useSectionReveal";
import { CinematicPlayer } from "@/components/ui/CinematicPlayer";
import { TimecodeBadge } from "@/components/ui/TimecodeBadge";
import { TagChip } from "@/components/ui/TagChip";
import { TimestampThumbnail } from "@/components/ui/TimestampThumbnail";
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
      aria-label="Recherche de vidéos et figures par mot-clé et timestamp"
      className="px-6 py-8 md:px-12 md:py-10"
    >
      <div className="mx-auto max-w-7xl space-y-7">
        {/* EN-TÊTE COMPACT SANS GRAND TEXTE D'ACCUEIL */}
        <div
          data-reveal
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-xl font-bold tracking-wide text-ink uppercase sm:text-2xl">
              Répertoire des Danses &amp; Figures Horodatées
            </h1>
            <p className="font-serif text-sm italic text-muted">
              Retrouvez une figure, un rythme ou un pas à la seconde exacte.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-1.5 font-mono text-xs text-muted shadow-2xs">
            <span className="font-semibold text-crimson">
              {data.timestampHits.length} figure(s)
            </span>
            <span>•</span>
            <span>{data.videoHits.length} vidéo(s)</span>
          </div>
        </div>

        {/* BARRE DE RECHERCHE LUMINEUSE + NUAGE DE MOTS-CLÉS */}
        <div data-reveal className="space-y-3.5">
          <div className="relative">
            <label htmlFor="keyword-search" className="sr-only">
              Rechercher un mot-clé dans les danses et timestamps
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-crimson"
              aria-hidden="true"
            />
            <input
              id="keyword-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une danse, une région ou un pas (ex: hora, sârba, brâul, învârtita, călușarii, pas croisé...)"
              className="w-full rounded-2xl border border-line bg-surface py-3.5 pr-12 pl-12 text-sm text-ink shadow-xs placeholder:text-muted/75 transition-colors focus:border-crimson focus:outline-none sm:text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
                className="absolute top-1/2 right-3.5 -translate-y-1/2 cursor-pointer rounded-full p-1.5 text-muted hover:bg-elevated hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {data.availableTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 inline-flex items-center gap-1.5 font-mono text-xs font-medium text-muted">
                <Sparkles
                  className="h-3.5 w-3.5 text-crimson"
                  aria-hidden="true"
                />
                Tags disponibles :
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

        {/* GRILLE PRINCIPALE : STORYBOARD À GAUCHE + MONITEUR À DROITE */}
        <div
          data-reveal
          className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start"
        >
          {/* COLONNE GAUCHE : SÉQUENCES HORODATÉES & VIDÉOS */}
          <div className="space-y-7 lg:col-span-5">
            {!loading && data.videoHits.length === 0 && !query.trim() && (
              <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center shadow-xs">
                <FolderCog
                  className="mx-auto h-9 w-9 text-crimson"
                  aria-hidden="true"
                />
                <h2 className="mt-3 font-display text-base font-bold text-ink uppercase">
                  Aucune vidéo indexée
                </h2>
                <p className="mt-1.5 text-sm text-muted">
                  Configurez le dossier contenant vos vidéos de danse dans
                  l&apos;onglet Répertoire Admin.
                </p>
                <Link
                  href="/admin"
                  className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-crimson px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-crimson-hover"
                >
                  <span>Ouvrir Répertoire Admin</span>
                </Link>
              </div>
            )}

            {/* 1. Figures & Séquences au Timestamp */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 font-display text-xs font-bold tracking-[0.14em] text-crimson uppercase">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    Figures au Timestamp ({data.timestampHits.length})
                  </span>
                </h2>
                {data.videoHits.length > 0 && (
                  <Link
                    href="/configure"
                    className="font-mono text-xs font-medium text-cobalt underline-offset-4 hover:underline"
                  >
                    + Annoter un pas
                  </Link>
                )}
              </div>

              {loading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-24 animate-pulse rounded-xl border border-line bg-surface"
                    />
                  ))}
                </div>
              ) : data.timestampHits.length === 0 ? (
                <div className="rounded-xl border border-line bg-surface p-5 text-sm text-muted shadow-2xs">
                  {query.trim()
                    ? `Aucun timestamp tagué ne correspond à « ${query} ».`
                    : "Aucun timestamp n'a encore été tagué. Utilisez « Annoter Figures » pour marquer vos pas de danse."}
                </div>
              ) : (
                <ul
                  data-lenis-prevent
                  className="max-h-[480px] space-y-2.5 overflow-y-auto pr-1"
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
                          className={`group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border p-3 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-crimson focus-visible:outline-none ${
                            isCurrent
                              ? "border-crimson bg-crimson/8 shadow-xs"
                              : "border-line bg-surface hover:border-crimson/50 hover:bg-elevated/55"
                          }`}
                        >
                          <TimestampThumbnail
                            src={hit.thumbnailUrl}
                            alt={`#${hit.tagName} dans ${hit.video.title} à ${formatTimecode(hit.timestampSec)}`}
                            size="md"
                          />

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="rounded-full border border-line bg-elevated px-2.5 py-0.5 font-mono text-xs font-semibold text-ink">
                                #{hit.tagName}
                              </span>
                              <TimecodeBadge
                                seconds={hit.timestampSec}
                                active={isCurrent}
                                onClick={() => handlePlayTimestampHit(hit)}
                              />
                            </div>

                            <p className="truncate text-sm font-semibold text-ink">
                              {hit.video.title}
                            </p>

                            {hit.label && (
                              <p className="truncate text-xs text-muted">
                                {hit.label}
                              </p>
                            )}

                            <p className="truncate font-mono text-[10px] text-muted/85">
                              {hit.video.folderPath}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 2. Vidéos correspondantes */}
            {data.videoHits.length > 0 && (
              <div className="space-y-3">
                <h2 className="inline-flex items-center gap-2 font-display text-xs font-bold tracking-[0.14em] text-ink/80 uppercase">
                  <Film className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
                  <span>
                    Vidéos de la bibliothèque ({data.videoHits.length})
                  </span>
                </h2>

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
                            ? "border-crimson/55 bg-elevated/70 shadow-2xs"
                            : "border-line bg-surface hover:border-line-strong"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handlePlayVideoAt(video, 0)}
                            className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:outline-none"
                          >
                            {video.posterUrl && (
                              <TimestampThumbnail
                                src={video.posterUrl}
                                alt={video.title}
                                size="sm"
                                showPlayOverlay={false}
                              />
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink">
                                {video.title}
                              </p>
                              <p className="truncate font-mono text-[11px] text-muted">
                                {video.folderPath}
                              </p>
                            </div>
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

          {/* COLONNE DROITE STICKY : LECTEUR & STORYBOARD DE LA VIDÉO ACTIVE */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:col-span-7">
            <CinematicPlayer
              video={activeVideo}
              seekRequest={seekRequest}
              autoPlayOnSeek={seekRequest !== null}
            />

            {activeVideo && (
              <div className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-display text-xs font-bold tracking-[0.1em] text-ink uppercase">
                    <Tag
                      className="h-3.5 w-3.5 text-crimson"
                      aria-hidden="true"
                    />
                    Figures enregistrées dans « {activeVideo.title} »
                  </span>
                  <Link
                    href={`/configure?videoId=${activeVideo.id}`}
                    className="font-mono text-xs font-semibold text-crimson hover:underline"
                  >
                    Annoter cette danse →
                  </Link>
                </div>

                {activeVideo.timestampTags.length === 0 ? (
                  <p className="text-xs text-muted">
                    Aucune figure horodatée sur cette vidéo pour le moment.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {activeVideo.timestampTags.map((ts) => {
                      const isCueActive = activeCueId === ts.id;
                      return (
                        <button
                          key={ts.id}
                          type="button"
                          onClick={() =>
                            handlePlayVideoAt(
                              activeVideo,
                              ts.timestampSec,
                              ts.id
                            )
                          }
                          className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl border p-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-crimson focus-visible:outline-none ${
                            isCueActive
                              ? "border-crimson bg-crimson/8 shadow-2xs"
                              : "border-line bg-elevated/45 hover:border-crimson/45 hover:bg-surface"
                          }`}
                        >
                          <TimestampThumbnail
                            src={ts.thumbnailUrl}
                            alt={`#${ts.tagName} à ${formatTimecode(ts.timestampSec)}`}
                            size="lg"
                          />
                          <div className="mt-2 flex w-full items-center justify-between gap-2 px-0.5">
                            <span className="truncate font-mono text-xs font-semibold text-ink">
                              #{ts.tagName}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] font-semibold text-crimson">
                              {formatTimecode(ts.timestampSec)}
                            </span>
                          </div>
                          {ts.label && (
                            <p className="mt-0.5 line-clamp-1 px-0.5 text-[11px] text-muted">
                              {ts.label}
                            </p>
                          )}
                        </button>
                      );
                    })}
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
