"use client";

import { BookmarkPlus, Pause, Play, RotateCcw } from "lucide-react";
import { formatTimecode } from "@/lib/timecode";
import { useVideoTimecode } from "@/hooks/useVideoTimecode";
import type { TimestampTagDTO, VideoDTO } from "@/types/cinema.types";

interface CinematicPlayerProps {
  video: VideoDTO | null;
  seekRequest?: { timestampSec: number; nonce: number } | null;
  autoPlayOnSeek?: boolean;
  onCaptureCurrentTime?: (seconds: number) => void;
  onDurationDetected?: (videoId: string, durationSec: number) => void;
}

export function CinematicPlayer({
  video,
  seekRequest = null,
  autoPlayOnSeek = true,
  onCaptureCurrentTime,
  onDurationDetected,
}: CinematicPlayerProps) {
  const {
    videoRef,
    currentTime,
    duration,
    isPlaying,
    seekTo,
    togglePlay,
    videoEvents,
  } = useVideoTimecode({
    videoId: video?.id ?? null,
    initialSeekSec: seekRequest?.timestampSec ?? null,
    seekNonce: seekRequest?.nonce ?? 0,
    autoPlayOnSeek,
    onDurationDetected,
  });

  if (!video) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-surface p-8 text-center">
        <p className="font-mono text-xs tracking-[0.2em] text-amber-cue uppercase">
          MONITEUR EN VEILLE
        </p>
        <p className="mt-2 max-w-md text-sm text-muted">
          Sélectionnez une séquence horodatée ou une vidéo pour lancer la
          projection.
        </p>
      </div>
    );
  }

  const effectiveDuration = duration || video.durationSec || 0;
  const progressPercent =
    effectiveDuration > 0
      ? Math.min(100, (currentTime / effectiveDuration) * 100)
      : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)]">
      {/* Bandeau supérieur du moniteur de contrôle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-elevated/70 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {video.title}
          </p>
          <p className="truncate font-mono text-[11px] text-muted">
            {video.folderPath} — {video.relativePath}
            {video.contentHash && (
              <span className="ml-2 text-amber-cue/75">
                [SHA {video.contentHash.slice(0, 8)}]
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="rounded bg-void px-2.5 py-1 text-amber-cue">
            TC {formatTimecode(currentTime)}
          </span>
          {effectiveDuration > 0 && (
            <span className="text-muted">
              / {formatTimecode(effectiveDuration)}
            </span>
          )}
        </div>
      </div>

      {/* Zone de projection vidéo HTML5 (HTTP 206 Byte-Range Stream) */}
      <div className="relative aspect-video w-full bg-black">
        <video
          key={video.id}
          ref={videoRef}
          src={`/api/stream/${video.id}`}
          controls
          playsInline
          preload="metadata"
          {...videoEvents}
          className="h-full w-full object-contain"
        />
      </div>

      {/* Timeline cinématique enrichie avec marqueurs visuels de timestamps tagués */}
      <div className="space-y-3 border-t border-white/10 bg-surface px-4 py-3.5">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Position temporelle avec marqueurs de mots-clés"
          aria-valuemin={0}
          aria-valuemax={Math.round(effectiveDuration)}
          aria-valuenow={Math.round(currentTime)}
          onClick={(e) => {
            if (effectiveDuration <= 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(
              0,
              Math.min(1, (e.clientX - rect.left) / rect.width)
            );
            seekTo(ratio * effectiveDuration, true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seekTo(currentTime + 5, false);
            if (e.key === "ArrowLeft") seekTo(Math.max(0, currentTime - 5), false);
          }}
          className="relative h-3 w-full cursor-pointer rounded-full bg-void/90 ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none"
        >
          {/* Barre de progression courante */}
          <div
            style={{ transform: `scaleX(${progressPercent / 100})` }}
            className="h-full w-full origin-left rounded-full bg-amber-cue/40"
          />

          {/* Épingles des timestamps tagués sur la timeline */}
          {effectiveDuration > 0 &&
            video.timestampTags.map((marker: TimestampTagDTO) => {
              const leftPct = Math.min(
                99.5,
                Math.max(0.5, (marker.timestampSec / effectiveDuration) * 100)
              );
              return (
                <button
                  key={marker.id}
                  type="button"
                  title={`#${marker.tagName} (${formatTimecode(marker.timestampSec)})`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    seekTo(marker.timestampSec, true);
                  }}
                  style={{ left: `${leftPct}%` }}
                  className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer p-1 focus-visible:outline-none"
                >
                  <span className="block h-3.5 w-1.5 rounded-full bg-amber-cue shadow-[0_0_8px_rgba(229,169,60,0.95)] transition-transform duration-150 group-hover:scale-150" />
                </button>
              );
            })}
        </div>

        {/* Contrôles studio rapides + capture du timestamp courant (Mode Configure) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-elevated px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-amber-cue/60 hover:text-amber-cue focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Lecture</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => seekTo(Math.max(0, currentTime - 5), isPlaying)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-void px-2.5 py-1.5 font-mono text-xs text-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>-5s</span>
            </button>
          </div>

          {onCaptureCurrentTime && (
            <button
              type="button"
              onClick={() => onCaptureCurrentTime(currentTime)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-rec px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_20px_rgba(225,29,72,0.35)] transition-transform duration-150 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Capturer ce timestamp ({formatTimecode(currentTime)})
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
