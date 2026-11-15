"use client";

import { useEffect } from "react";
import { BookmarkPlus, Pause, Play, RotateCcw } from "lucide-react";
import { formatTimecode } from "@/lib/timecode";
import { captureVideoElementFrame } from "@/lib/frameCapture";
import { useVideoTimecode } from "@/hooks/useVideoTimecode";
import { RomanianEmblem } from "@/components/ui/RomanianFolkMotif";
import type { TimestampTagDTO, VideoDTO } from "@/types/cinema.types";

export interface LiveFrameGetter {
  getCurrentSnapshot: () => {
    currentTime: number;
    frameDataUrl: string | null;
  };
}

interface CinematicPlayerProps {
  video: VideoDTO | null;
  seekRequest?: { timestampSec: number; nonce: number } | null;
  autoPlayOnSeek?: boolean;
  onCaptureCurrentTime?: (
    seconds: number,
    frameDataUrl: string | null
  ) => void;
  onRegisterFrameGetter?: (getter: LiveFrameGetter | null) => void;
  onDurationDetected?: (videoId: string, durationSec: number) => void;
}

export function CinematicPlayer({
  video,
  seekRequest = null,
  autoPlayOnSeek = true,
  onCaptureCurrentTime,
  onRegisterFrameGetter,
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

  useEffect(() => {
    if (!onRegisterFrameGetter) return;
    if (!video) {
      onRegisterFrameGetter(null);
      return;
    }

    onRegisterFrameGetter({
      getCurrentSnapshot: () => ({
        currentTime: videoRef.current?.currentTime ?? 0,
        frameDataUrl: captureVideoElementFrame(videoRef.current),
      }),
    });

    return () => onRegisterFrameGetter(null);
  }, [video, onRegisterFrameGetter, videoRef]);

  if (!video) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <RomanianEmblem className="mb-3 h-9 w-9 opacity-80" />
        <p className="font-display text-sm font-bold tracking-[0.16em] text-crimson uppercase">
          Scène prête pour la projection
        </p>
        <p className="mt-1.5 max-w-md text-sm text-muted">
          Cliquez sur une danse ou sur une figure horodatée à gauche pour lancer
          la vidéo au pas exact.
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
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_45px_-18px_rgba(55,32,20,0.16)]">
      {/* Bandeau supérieur façon tissu brodé */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-elevated/80 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold tracking-wide text-ink">
            {video.title}
          </p>
          <p className="truncate font-mono text-[11px] text-muted">
            {video.folderPath} — {video.relativePath}
            {video.contentHash && (
              <span className="ml-2 text-cobalt">
                [SHA {video.contentHash.slice(0, 8)}]
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="rounded-md border border-crimson/25 bg-surface px-2.5 py-1 font-semibold text-crimson">
            TC {formatTimecode(currentTime)}
          </span>
          {effectiveDuration > 0 && (
            <span className="text-muted">
              / {formatTimecode(effectiveDuration)}
            </span>
          )}
        </div>
      </div>

      {/* Zone vidéo interne sombre pour respecter le contraste naturel de l'image */}
      <div className="relative aspect-video w-full bg-stage">
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

      {/* Timeline enrichie avec repères brodés des figures taguées */}
      <div className="space-y-3 border-t border-line bg-surface px-4 py-3.5">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Position temporelle avec marqueurs de figures"
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
            if (e.key === "ArrowLeft")
              seekTo(Math.max(0, currentTime - 5), false);
          }}
          className="relative h-3 w-full cursor-pointer rounded-full bg-elevated ring-1 ring-line focus-visible:ring-2 focus-visible:ring-crimson focus-visible:outline-none"
        >
          {/* Progression courante */}
          <div
            style={{ transform: `scaleX(${progressPercent / 100})` }}
            className="h-full w-full origin-left rounded-full bg-crimson/25"
          />

          {/* Épingles des timestamps tagués avec aperçu miniature au survol */}
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
                  <span className="block h-3.5 w-1.5 rounded-full bg-crimson shadow-sm transition-transform duration-150 group-hover:scale-150" />

                  <span className="pointer-events-none absolute bottom-6 left-1/2 z-30 hidden w-36 -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-line-strong bg-surface p-1.5 shadow-lg group-hover:flex">
                    {marker.thumbnailUrl && (
                      <img
                        src={marker.thumbnailUrl}
                        alt=""
                        className="aspect-video w-full rounded object-cover"
                      />
                    )}
                    <span className="mt-1 truncate px-0.5 font-mono text-[10px] font-semibold text-crimson">
                      #{marker.tagName} • {formatTimecode(marker.timestampSec)}
                    </span>
                  </span>
                </button>
              );
            })}
        </div>

        {/* Contrôles rapides + capture du timestamp courant (Mode Configure) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-crimson/55 hover:text-crimson focus-visible:ring-2 focus-visible:ring-crimson focus-visible:outline-none"
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-crimson focus-visible:outline-none"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>-5s</span>
            </button>
          </div>

          {onCaptureCurrentTime && (
            <button
              type="button"
              onClick={() =>
                onCaptureCurrentTime(
                  currentTime,
                  captureVideoElementFrame(videoRef.current)
                )
              }
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-crimson px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-crimson-hover focus-visible:ring-2 focus-visible:ring-crimson focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Capturer ce pas ({formatTimecode(currentTime)})
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
