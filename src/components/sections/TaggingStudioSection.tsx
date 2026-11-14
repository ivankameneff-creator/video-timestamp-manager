"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookmarkPlus,
  Clock,
  Film,
  FolderCog,
  Plus,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import { formatTimecode, parseTimecode } from "@/lib/timecode";
import { CinematicPlayer } from "@/components/ui/CinematicPlayer";
import { FolderTreeView } from "@/components/ui/FolderTreeView";
import { TagChip } from "@/components/ui/TagChip";
import { TimecodeBadge } from "@/components/ui/TimecodeBadge";
import type { FolderTreeNode, VideoDTO } from "@/types/cinema.types";

interface TaggingStudioSectionProps {
  initialVideoId?: string;
}

export function TaggingStudioSection({
  initialVideoId,
}: TaggingStudioSectionProps) {
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [knownTags, setKnownTags] = useState<{ name: string; count: number }[]>(
    []
  );
  const [selectedFolder, setSelectedFolder] = useState("/");
  const [videoFilter, setVideoFilter] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(
    initialVideoId ?? null
  );
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Formulaire Tag Global
  const [globalTagInput, setGlobalTagInput] = useState("");

  // Formulaire Tag Timestamp
  const [timecodeInput, setTimecodeInput] = useState("00:00.0");
  const [timestampTagInput, setTimestampTagInput] = useState("");
  const [timestampLabelInput, setTimestampLabelInput] = useState("");
  const timestampTagInputRef = useRef<HTMLInputElement>(null);

  // Demande de saut temporel au lecteur
  const [seekRequest, setSeekRequest] = useState<{
    timestampSec: number;
    nonce: number;
  } | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/videos");
      if (!res.ok) return;
      const json = (await res.json()) as {
        videos: VideoDTO[];
        folderTree: FolderTreeNode[];
        availableTags: { name: string; count: number }[];
      };
      setVideos(json.videos);
      setFolderTree(json.folderTree);
      setKnownTags(json.availableTags);

      setSelectedVideoId((prev) => {
        if (prev && json.videos.some((v) => v.id === prev)) return prev;
        if (
          initialVideoId &&
          json.videos.some((v) => v.id === initialVideoId)
        ) {
          return initialVideoId;
        }
        return json.videos[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [initialVideoId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const selectedVideo =
    videos.find((v) => v.id === selectedVideoId) ?? null;

  const filteredVideos = videos.filter((v) => {
    const matchesFolder =
      selectedFolder === "/" ||
      v.folderPath === selectedFolder ||
      v.folderPath.startsWith(`${selectedFolder}/`);
    const matchesText =
      !videoFilter.trim() ||
      v.title.toLowerCase().includes(videoFilter.trim().toLowerCase()) ||
      v.relativePath.toLowerCase().includes(videoFilter.trim().toLowerCase());
    return matchesFolder && matchesText;
  });

  const updateSingleVideoInState = (updated: VideoDTO) => {
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  };

  const handleCaptureTimecode = (seconds: number) => {
    setTimecodeInput(formatTimecode(seconds));
    timestampTagInputRef.current?.focus();
    setFeedback({
      type: "ok",
      text: `Timestamp ${formatTimecode(seconds)} capturé depuis le lecteur.`,
    });
  };

  const handleDurationDetected = useCallback(
    async (videoId: string, durationSec: number) => {
      const target = videos.find((v) => v.id === videoId);
      if (target && target.durationSec && Math.abs(target.durationSec - durationSec) < 1) {
        return;
      }
      const res = await fetch(`/api/videos/${videoId}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSec }),
      });
      if (res.ok) {
        const json = (await res.json()) as { video: VideoDTO };
        if (json.video) updateSingleVideoInState(json.video);
      }
    },
    [videos]
  );

  const handleAddGlobalTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideo || !globalTagInput.trim()) return;

    const res = await fetch(`/api/videos/${selectedVideo.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "global",
        tagName: globalTagInput,
      }),
    });

    const json = (await res.json()) as { video?: VideoDTO; error?: string };
    if (!res.ok || !json.video) {
      setFeedback({
        type: "err",
        text: json.error ?? "Impossible d'ajouter le tag global.",
      });
      return;
    }

    updateSingleVideoInState(json.video);
    setGlobalTagInput("");
    setFeedback({ type: "ok", text: "Tag(s) global(aux) enregistré(s) en BDD." });
  };

  const handleRemoveGlobalTag = async (tagId: string) => {
    if (!selectedVideo) return;
    const res = await fetch(
      `/api/videos/${selectedVideo.id}/tags?mode=global&id=${encodeURIComponent(tagId)}`,
      { method: "DELETE" }
    );
    const json = (await res.json()) as { video?: VideoDTO };
    if (res.ok && json.video) {
      updateSingleVideoInState(json.video);
    }
  };

  const handleAddTimestampTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideo) return;

    const parsedSec = parseTimecode(timecodeInput);
    if (parsedSec === null) {
      setFeedback({
        type: "err",
        text: "Format de timestamp invalide (ex: 01:24.5 ou 84.5).",
      });
      return;
    }

    if (!timestampTagInput.trim()) {
      setFeedback({
        type: "err",
        text: "Veuillez saisir au moins un mot-clé pour ce timestamp.",
      });
      return;
    }

    const res = await fetch(`/api/videos/${selectedVideo.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "timestamp",
        tagName: timestampTagInput,
        timestampSec: parsedSec,
        label: timestampLabelInput,
      }),
    });

    const json = (await res.json()) as { video?: VideoDTO; error?: string };
    if (!res.ok || !json.video) {
      setFeedback({
        type: "err",
        text: json.error ?? "Impossible d'enregistrer le tag au timestamp.",
      });
      return;
    }

    updateSingleVideoInState(json.video);
    setTimestampTagInput("");
    setTimestampLabelInput("");
    setFeedback({
      type: "ok",
      text: `Tag enregistré à ${formatTimecode(parsedSec)} dans SQLite.`,
    });
  };

  const handleRemoveTimestampTag = async (timestampTagId: string) => {
    if (!selectedVideo) return;
    const res = await fetch(
      `/api/videos/${selectedVideo.id}/tags?mode=timestamp&id=${encodeURIComponent(timestampTagId)}`,
      { method: "DELETE" }
    );
    const json = (await res.json()) as { video?: VideoDTO };
    if (res.ok && json.video) {
      updateSingleVideoInState(json.video);
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-10 md:px-12">
      {/* Datalist d'autocomplétion des mots-clés existants */}
      <datalist id="existing-tags-list">
        {knownTags.map((t) => (
          <option key={t.name} value={t.name} />
        ))}
      </datalist>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p className="font-mono text-xs tracking-[0.28em] text-amber-cue uppercase">
            MODE CONFIGURE // TABLE D&apos;INDEXATION &amp; TIMECODES
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase sm:text-4xl">
            Annoter les Vidéos &amp; Séquences
          </h1>
        </div>

        {feedback && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-2 font-mono text-xs ${
              feedback.type === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-rec/50 bg-rec/10 text-rose-300"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      {!loading && videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-surface p-12 text-center">
          <FolderCog className="mx-auto h-10 w-10 text-amber-cue" />
          <h2 className="mt-4 font-display text-xl font-bold uppercase">
            Aucun répertoire vidéo indexé
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Rendez-vous dans le Mode Admin pour sélectionner le dossier racine de
            vos vidéos avant d&apos;y associer des mots-clés et timestamps.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-amber-cue px-6 py-3 text-sm font-semibold text-void"
          >
            Configurer le répertoire en Mode Admin
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* BARRE LATÉRALE GAUCHE : ARBORESCENCE + SÉLECTION DE VIDÉO */}
          <aside className="space-y-6 rounded-2xl border border-white/10 bg-surface p-5 lg:col-span-4">
            <div>
              <h2 className="mb-3 font-mono text-xs tracking-[0.2em] text-amber-cue uppercase">
                1. Arborescence des Dossiers
              </h2>
              <div
                data-lenis-prevent
                className="max-h-52 overflow-y-auto pr-1"
              >
                <FolderTreeView
                  nodes={folderTree}
                  selectedPath={selectedFolder}
                  onSelectPath={setSelectedFolder}
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <h2 className="mb-3 font-mono text-xs tracking-[0.2em] text-amber-cue uppercase">
                2. Vidéos ({filteredVideos.length})
              </h2>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={videoFilter}
                  onChange={(e) => setVideoFilter(e.target.value)}
                  placeholder="Filtrer par titre..."
                  className="w-full rounded-lg border border-white/10 bg-void py-2 pr-3 pl-9 text-xs text-ink placeholder:text-muted focus:border-amber-cue focus:outline-none"
                />
              </div>

              <ul
                data-lenis-prevent
                className="max-h-[420px] space-y-2 overflow-y-auto pr-1"
              >
                {filteredVideos.map((v) => {
                  const active = v.id === selectedVideoId;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVideoId(v.id);
                          setSeekRequest(null);
                        }}
                        className={`flex w-full cursor-pointer items-start justify-between gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none ${
                          active
                            ? "border-amber-cue bg-amber-cue/10"
                            : "border-white/10 bg-void/60 hover:border-white/25"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-ink">
                            <Film className="h-3.5 w-3.5 shrink-0 text-amber-cue" />
                            <span className="truncate">{v.title}</span>
                            {v.isMissing && (
                              <span className="shrink-0 rounded bg-rec/20 px-1.5 py-0.5 font-mono text-[9px] text-rose-300 uppercase">
                                Hors-ligne
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                            {v.folderPath}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 font-mono text-[10px]">
                          <span
                            title="Tags globaux"
                            className="rounded bg-white/10 px-1.5 py-0.5 text-ink/80"
                          >
                            {v.globalTags.length}G
                          </span>
                          <span
                            title="Tags timestamps"
                            className="rounded bg-amber-cue/20 px-1.5 py-0.5 text-amber-cue"
                          >
                            {v.timestampTags.length}T
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* ZONE D'ÉDITION PRINCIPALE : LECTEUR + TAGS GLOBAUX + TAGS TIMESTAMPS */}
          <div className="space-y-6 lg:col-span-8">
            <CinematicPlayer
              video={selectedVideo}
              seekRequest={seekRequest}
              autoPlayOnSeek={false}
              onCaptureCurrentTime={handleCaptureTimecode}
              onDurationDetected={handleDurationDetected}
            />

            {selectedVideo && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {/* PANNEAU A : TAGS GLOBAUX DE LA VIDÉO */}
                <div className="rounded-2xl border border-white/10 bg-surface p-6 space-y-5">
                  <div>
                    <h3 className="inline-flex items-center gap-2 font-display text-base font-bold uppercase">
                      <Tag className="h-4 w-4 text-amber-cue" />
                      <span>Tags Globaux de la Vidéo</span>
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Mots-clés associés à l&apos;ensemble du fichier vidéo
                      (séparez par une virgule pour en ajouter plusieurs).
                    </p>
                  </div>

                  <form onSubmit={handleAddGlobalTag} className="flex gap-2">
                    <input
                      type="text"
                      list="existing-tags-list"
                      value={globalTagInput}
                      onChange={(e) => setGlobalTagInput(e.target.value)}
                      placeholder="ex: documentaire, montagne, 4k"
                      className="min-w-0 flex-1 rounded-xl border border-white/15 bg-void px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-amber-cue focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-amber-cue px-4 py-2.5 text-xs font-semibold text-void transition-transform hover:scale-[1.02]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Ajouter</span>
                    </button>
                  </form>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedVideo.globalTags.length === 0 ? (
                      <p className="text-xs text-muted">
                        Aucun tag global sur cette vidéo.
                      </p>
                    ) : (
                      selectedVideo.globalTags.map((tag) => (
                        <TagChip
                          key={tag.id}
                          label={tag.name}
                          onRemove={() => handleRemoveGlobalTag(tag.id)}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* PANNEAU B : AJOUT D'UN TAG À UN TIMESTAMP PRÉCIS */}
                <div className="rounded-2xl border border-white/10 bg-surface p-6 space-y-5">
                  <div>
                    <h3 className="inline-flex items-center gap-2 font-display text-base font-bold uppercase">
                      <BookmarkPlus className="h-4 w-4 text-rec" />
                      <span>Taguer un Timestamp précis</span>
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Cliquez sur « Capturer ce timestamp » sous la vidéo ou
                      saisissez un timecode (`MM:SS.d`).
                    </p>
                  </div>

                  <form onSubmit={handleAddTimestampTag} className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label
                          htmlFor="ts-timecode"
                          className="mb-1 block font-mono text-[11px] text-muted"
                        >
                          Timestamp
                        </label>
                        <input
                          id="ts-timecode"
                          type="text"
                          value={timecodeInput}
                          onChange={(e) => setTimecodeInput(e.target.value)}
                          placeholder="01:24.5"
                          className="w-full rounded-xl border border-amber-cue/40 bg-void px-3 py-2 font-mono text-sm text-amber-cue focus:border-amber-cue focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <label
                          htmlFor="ts-keyword"
                          className="mb-1 block font-mono text-[11px] text-muted"
                        >
                          Mot(s)-clé(s) *
                        </label>
                        <input
                          id="ts-keyword"
                          ref={timestampTagInputRef}
                          type="text"
                          list="existing-tags-list"
                          value={timestampTagInput}
                          onChange={(e) => setTimestampTagInput(e.target.value)}
                          placeholder="ex: cascade, drone"
                          className="w-full rounded-xl border border-white/15 bg-void px-3.5 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-amber-cue focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="ts-note"
                        className="mb-1 block font-mono text-[11px] text-muted"
                      >
                        Note de scène (optionnel)
                      </label>
                      <input
                        id="ts-note"
                        type="text"
                        value={timestampLabelInput}
                        onChange={(e) => setTimestampLabelInput(e.target.value)}
                        placeholder="ex: Plan large travelling avant au lever du soleil"
                        className="w-full rounded-xl border border-white/15 bg-void px-3.5 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-amber-cue focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-cue px-4 py-2.5 text-xs font-semibold text-void transition-transform hover:scale-[1.01]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Enregistrer le tag au timestamp</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* LISTE CHRONOLOGIQUE DES TIMESTAMPS TAGUÉS DE LA VIDÉO SÉLECTIONNÉE */}
            {selectedVideo && (
              <div className="rounded-2xl border border-white/10 bg-surface p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-amber-cue uppercase">
                    <Clock className="h-4 w-4" />
                    <span>
                      Timestamps enregistrés ({selectedVideo.timestampTags.length})
                    </span>
                  </h3>
                  <span className="font-mono text-xs text-muted">
                    Cliquez sur un timecode pour vérifier le point d&apos;entrée
                  </span>
                </div>

                {selectedVideo.timestampTags.length === 0 ? (
                  <p className="text-sm text-muted">
                    Aucun timestamp tagué pour cette vidéo pour l&apos;instant.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {selectedVideo.timestampTags.map((ts) => (
                      <li
                        key={ts.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <TimecodeBadge
                            seconds={ts.timestampSec}
                            onClick={() =>
                              setSeekRequest((prev) => ({
                                timestampSec: ts.timestampSec,
                                nonce: (prev?.nonce ?? 0) + 1,
                              }))
                            }
                          />
                          <span className="rounded-full border border-white/15 bg-void px-3 py-0.5 font-mono text-xs font-semibold text-ink">
                            #{ts.tagName}
                          </span>
                          {ts.label && (
                            <span className="text-xs text-muted">
                              {ts.label}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveTimestampTag(ts.id)}
                          aria-label={`Supprimer le tag ${ts.tagName} à ${formatTimecode(ts.timestampSec)}`}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-muted transition-colors hover:bg-rec/15 hover:text-rec"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Supprimer</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
