"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookmarkPlus,
  Camera,
  Clock,
  Film,
  FolderCog,
  ImagePlus,
  Plus,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import { formatTimecode, parseTimecode } from "@/lib/timecode";
import { captureFrameAtSecond } from "@/lib/frameCapture";
import {
  CinematicPlayer,
  type LiveFrameGetter,
} from "@/components/ui/CinematicPlayer";
import { FolderTreeView } from "@/components/ui/FolderTreeView";
import { TagChip } from "@/components/ui/TagChip";
import { TimecodeBadge } from "@/components/ui/TimecodeBadge";
import { TimestampThumbnail } from "@/components/ui/TimestampThumbnail";
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
  const [submittingTs, setSubmittingTs] = useState(false);
  const [generatingMissing, setGeneratingMissing] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const frameGetterRef = useRef<LiveFrameGetter | null>(null);

  // Formulaire Tag Global
  const [globalTagInput, setGlobalTagInput] = useState("");

  // Formulaire Tag Timestamp + Miniature capturée
  const [timecodeInput, setTimecodeInput] = useState("00:00.0");
  const [timestampTagInput, setTimestampTagInput] = useState("");
  const [timestampLabelInput, setTimestampLabelInput] = useState("");
  const [capturedPreview, setCapturedPreview] = useState<{
    sec: number;
    dataUrl: string;
  } | null>(null);
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

  const handleRegisterFrameGetter = useCallback(
    (getter: LiveFrameGetter | null) => {
      frameGetterRef.current = getter;
    },
    []
  );

  const handleCaptureTimecode = (
    seconds: number,
    frameDataUrl: string | null
  ) => {
    setTimecodeInput(formatTimecode(seconds));
    if (frameDataUrl) {
      setCapturedPreview({ sec: seconds, dataUrl: frameDataUrl });
    }
    timestampTagInputRef.current?.focus();
    setFeedback({
      type: "ok",
      text: `Pas capturé à ${formatTimecode(seconds)} avec sa miniature.`,
    });
  };

  const handleDurationDetected = useCallback(
    async (videoId: string, durationSec: number) => {
      const target = videos.find((v) => v.id === videoId);
      if (
        target &&
        target.durationSec &&
        Math.abs(target.durationSec - durationSec) < 1
      ) {
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

    let posterDataUrl: string | null = null;
    if (!selectedVideo.posterUrl) {
      posterDataUrl =
        frameGetterRef.current?.getCurrentSnapshot().frameDataUrl ??
        (await captureFrameAtSecond(`/api/stream/${selectedVideo.id}`, 1.5));
    }

    const res = await fetch(`/api/videos/${selectedVideo.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "global",
        tagName: globalTagInput,
        thumbnailDataUrl: posterDataUrl,
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
    setFeedback({
      type: "ok",
      text: "Tag(s) global(aux) enregistré(s).",
    });
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
        text: "Veuillez saisir au moins un mot-clé pour cette figure.",
      });
      return;
    }

    setSubmittingTs(true);
    try {
      let thumbnailDataUrl: string | null = null;
      if (
        capturedPreview &&
        Math.abs(capturedPreview.sec - parsedSec) <= 0.45
      ) {
        thumbnailDataUrl = capturedPreview.dataUrl;
      } else {
        const liveSnap = frameGetterRef.current?.getCurrentSnapshot();
        if (
          liveSnap?.frameDataUrl &&
          Math.abs(liveSnap.currentTime - parsedSec) <= 0.45
        ) {
          thumbnailDataUrl = liveSnap.frameDataUrl;
        } else {
          thumbnailDataUrl = await captureFrameAtSecond(
            `/api/stream/${selectedVideo.id}`,
            parsedSec
          );
        }
      }

      const res = await fetch(`/api/videos/${selectedVideo.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "timestamp",
          tagName: timestampTagInput,
          timestampSec: parsedSec,
          label: timestampLabelInput,
          thumbnailDataUrl,
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
      setCapturedPreview(null);
      setFeedback({
        type: "ok",
        text: `Figure et miniature enregistrées à ${formatTimecode(parsedSec)}.`,
      });
    } finally {
      setSubmittingTs(false);
    }
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

  const missingThumbsCount = selectedVideo
    ? selectedVideo.timestampTags.filter((t) => !t.thumbnailUrl).length
    : 0;

  const handleGenerateMissingThumbnails = async () => {
    if (!selectedVideo || missingThumbsCount === 0) return;
    setGeneratingMissing(true);
    setFeedback({
      type: "ok",
      text: "Extraction des miniatures manquantes en cours...",
    });

    try {
      const updates: { timestampTagId: string; thumbnailDataUrl: string }[] =
        [];
      const streamSrc = `/api/stream/${selectedVideo.id}`;

      for (const ts of selectedVideo.timestampTags) {
        if (ts.thumbnailUrl) continue;
        const dataUrl = await captureFrameAtSecond(streamSrc, ts.timestampSec);
        if (dataUrl) {
          updates.push({
            timestampTagId: ts.id,
            thumbnailDataUrl: dataUrl,
          });
        }
      }

      if (updates.length > 0) {
        const res = await fetch(`/api/videos/${selectedVideo.id}/tags`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timestampThumbnails: updates }),
        });
        const json = (await res.json()) as { video?: VideoDTO };
        if (res.ok && json.video) {
          updateSingleVideoInState(json.video);
          setFeedback({
            type: "ok",
            text: `${updates.length} miniature(s) générée(s) et sauvegardée(s).`,
          });
        }
      }
    } finally {
      setGeneratingMissing(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8 md:px-12 md:py-10">
      <datalist id="existing-tags-list">
        {knownTags.map((t) => (
          <option key={t.name} value={t.name} />
        ))}
      </datalist>

      <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wide text-ink uppercase sm:text-2xl">
            Annotation des Danses &amp; Figures
          </h1>
          <p className="font-serif text-sm italic text-muted">
            Associez régions, styles et figures chorégraphiques à la seconde
            près.
          </p>
        </div>

        {feedback && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-2 font-mono text-xs font-medium ${
              feedback.type === "ok"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-crimson/40 bg-crimson/10 text-crimson"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      {!loading && videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-12 text-center shadow-xs">
          <FolderCog className="mx-auto h-10 w-10 text-crimson" />
          <h2 className="mt-4 font-display text-lg font-bold text-ink uppercase">
            Aucun répertoire vidéo indexé
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Rendez-vous dans Répertoire Admin pour sélectionner le dossier
            racine de vos vidéos avant d&apos;y associer des figures et
            timestamps.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-crimson px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-crimson-hover"
          >
            Configurer le répertoire dans Admin
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* BARRE LATÉRALE GAUCHE : ARBORESCENCE + SÉLECTION DE VIDÉO */}
          <aside className="space-y-6 rounded-2xl border border-line bg-surface p-5 shadow-xs lg:col-span-4">
            <div>
              <h2 className="mb-3 font-display text-xs font-bold tracking-[0.14em] text-crimson uppercase">
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

            <div className="border-t border-line pt-5">
              <h2 className="mb-3 font-display text-xs font-bold tracking-[0.14em] text-crimson uppercase">
                2. Vidéos ({filteredVideos.length})
              </h2>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={videoFilter}
                  onChange={(e) => setVideoFilter(e.target.value)}
                  placeholder="Filtrer par titre..."
                  className="w-full rounded-lg border border-line bg-void py-2 pr-3 pl-9 text-xs text-ink placeholder:text-muted focus:border-crimson focus:outline-none"
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
                          setCapturedPreview(null);
                        }}
                        className={`flex w-full cursor-pointer items-start justify-between gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-crimson focus-visible:outline-none ${
                          active
                            ? "border-crimson bg-crimson/8 shadow-2xs"
                            : "border-line bg-void/65 hover:border-line-strong hover:bg-elevated/60"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-ink">
                            <Film className="h-3.5 w-3.5 shrink-0 text-crimson" />
                            <span className="truncate">{v.title}</span>
                            {v.isMissing && (
                              <span className="shrink-0 rounded bg-crimson/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-crimson uppercase">
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
                            className="rounded border border-line bg-surface px-1.5 py-0.5 text-ink/80"
                          >
                            {v.globalTags.length}G
                          </span>
                          <span
                            title="Figures horodatées"
                            className="rounded bg-crimson/12 px-1.5 py-0.5 font-semibold text-crimson"
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
              onRegisterFrameGetter={handleRegisterFrameGetter}
              onDurationDetected={handleDurationDetected}
            />

            {selectedVideo && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {/* PANNEAU A : TAGS GLOBAUX DE LA VIDÉO */}
                <div className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-xs">
                  <div>
                    <h3 className="inline-flex items-center gap-2 font-display text-sm font-bold text-ink uppercase">
                      <Tag className="h-4 w-4 text-crimson" />
                      <span>Tags Globaux de la Danse</span>
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Région, style ou rythme général de la vidéo (séparez par
                      une virgule pour en ajouter plusieurs).
                    </p>
                  </div>

                  <form onSubmit={handleAddGlobalTag} className="flex gap-2">
                    <input
                      type="text"
                      list="existing-tags-list"
                      value={globalTagInput}
                      onChange={(e) => setGlobalTagInput(e.target.value)}
                      placeholder="ex: olténie, hora, maramureș, rapide"
                      className="min-w-0 flex-1 rounded-xl border border-line bg-void px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-crimson focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-crimson px-4 py-2.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-crimson-hover"
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

                {/* PANNEAU B : AJOUT D'UN TAG À UN TIMESTAMP PRÉCIS + MINIATURE */}
                <div className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="inline-flex items-center gap-2 font-display text-sm font-bold text-ink uppercase">
                        <BookmarkPlus className="h-4 w-4 text-crimson" />
                        <span>Taguer un Pas / Timestamp</span>
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        Une miniature de la figure est automatiquement créée
                        pour illustrer la liste des timestamps.
                      </p>
                    </div>

                    {capturedPreview && (
                      <div className="shrink-0 text-right">
                        <img
                          src={capturedPreview.dataUrl}
                          alt="Aperçu miniature capturée"
                          className="aspect-video w-24 rounded-lg border border-crimson/45 object-cover shadow-xs"
                        />
                        <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-crimson">
                          <Camera className="h-2.5 w-2.5" />
                          Image prête
                        </span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleAddTimestampTag} className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label
                          htmlFor="ts-timecode"
                          className="mb-1 block font-mono text-[11px] font-medium text-muted"
                        >
                          Timestamp
                        </label>
                        <input
                          id="ts-timecode"
                          type="text"
                          value={timecodeInput}
                          onChange={(e) => setTimecodeInput(e.target.value)}
                          placeholder="01:24.5"
                          className="w-full rounded-xl border border-crimson/35 bg-void px-3 py-2 font-mono text-sm font-semibold text-crimson focus:border-crimson focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <label
                          htmlFor="ts-keyword"
                          className="mb-1 block font-mono text-[11px] font-medium text-muted"
                        >
                          Figure / Mot(s)-clé(s) *
                        </label>
                        <input
                          id="ts-keyword"
                          ref={timestampTagInputRef}
                          type="text"
                          list="existing-tags-list"
                          value={timestampTagInput}
                          onChange={(e) => setTimestampTagInput(e.target.value)}
                          placeholder="ex: sârba, pas croisé, tour"
                          className="w-full rounded-xl border border-line bg-void px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-crimson focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="ts-note"
                        className="mb-1 block font-mono text-[11px] font-medium text-muted"
                        >
                        Note chorégraphique (optionnel)
                      </label>
                      <input
                        id="ts-note"
                        type="text"
                        value={timestampLabelInput}
                        onChange={(e) => setTimestampLabelInput(e.target.value)}
                        placeholder="ex: Changement de sens sur le cri (strigătură)"
                        className="w-full rounded-xl border border-line bg-void px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-crimson focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingTs}
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-crimson px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" />
                      <span>
                        {submittingTs
                          ? "Capture de l'image & sauvegarde..."
                          : "Enregistrer la figure & sa miniature"}
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* LISTE STORYBOARD CHRONOLOGIQUE DES TIMESTAMPS TAGUÉS */}
            {selectedVideo && (
              <div className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="inline-flex items-center gap-2 font-display text-xs font-bold tracking-[0.14em] text-crimson uppercase">
                    <Clock className="h-4 w-4" />
                    <span>
                      Figures enregistrées ({selectedVideo.timestampTags.length})
                    </span>
                  </h3>

                  {missingThumbsCount > 0 && (
                    <button
                      type="button"
                      disabled={generatingMissing}
                      onClick={handleGenerateMissingThumbnails}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-crimson/35 bg-crimson/8 px-3 py-1.5 font-mono text-xs font-semibold text-crimson transition-colors hover:bg-crimson hover:text-white disabled:opacity-50"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      <span>
                        {generatingMissing
                          ? "Extraction en cours..."
                          : `Générer ${missingThumbsCount} miniature(s) manquante(s)`}
                      </span>
                    </button>
                  )}
                </div>

                {selectedVideo.timestampTags.length === 0 ? (
                  <p className="text-sm text-muted">
                    Aucune figure horodatée sur cette vidéo pour l&apos;instant.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {selectedVideo.timestampTags.map((ts) => (
                      <li
                        key={ts.id}
                        className="group flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3.5">
                          <button
                            type="button"
                            onClick={() =>
                              setSeekRequest((prev) => ({
                                timestampSec: ts.timestampSec,
                                nonce: (prev?.nonce ?? 0) + 1,
                              }))
                            }
                            className="cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-crimson focus-visible:outline-none"
                          >
                            <TimestampThumbnail
                              src={ts.thumbnailUrl}
                              alt={`#${ts.tagName} à ${formatTimecode(ts.timestampSec)}`}
                              size="sm"
                            />
                          </button>

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <TimecodeBadge
                                seconds={ts.timestampSec}
                                onClick={() =>
                                  setSeekRequest((prev) => ({
                                    timestampSec: ts.timestampSec,
                                    nonce: (prev?.nonce ?? 0) + 1,
                                  }))
                                }
                              />
                              <span className="rounded-full border border-line bg-elevated px-3 py-0.5 font-mono text-xs font-semibold text-ink">
                                #{ts.tagName}
                              </span>
                            </div>

                            {ts.label && (
                              <p className="truncate text-xs text-muted">
                                {ts.label}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveTimestampTag(ts.id)}
                          aria-label={`Supprimer le tag ${ts.tagName} à ${formatTimecode(ts.timestampSec)}`}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-crimson/12 hover:text-crimson"
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
