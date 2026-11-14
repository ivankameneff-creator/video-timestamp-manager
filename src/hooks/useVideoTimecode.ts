"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVideoTimecodeOptions {
  videoId: string | null;
  initialSeekSec?: number | null;
  seekNonce?: number;
  autoPlayOnSeek?: boolean;
  onDurationDetected?: (videoId: string, durationSec: number) => void;
}

export function useVideoTimecode({
  videoId,
  initialSeekSec = null,
  seekNonce = 0,
  autoPlayOnSeek = true,
  onDurationDetected,
}: UseVideoTimecodeOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingSeekRef = useRef<{ sec: number; play: boolean } | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const seekTo = useCallback(
    (seconds: number, shouldPlay = autoPlayOnSeek) => {
      const clamped = Math.max(0, seconds);
      const el = videoRef.current;

      if (!el || el.readyState < 1) {
        pendingSeekRef.current = { sec: clamped, play: shouldPlay };
        setCurrentTime(clamped);
        return;
      }

      el.currentTime = clamped;
      setCurrentTime(clamped);

      if (shouldPlay) {
        el.play().catch(() => {});
      }
    },
    [autoPlayOnSeek]
  );

  // Réinitialise ou prépare un saut temporel lors d'un changement de vidéo ou de timestamp cible
  useEffect(() => {
    if (!videoId) {
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      pendingSeekRef.current = null;
      return;
    }

    if (initialSeekSec !== null && initialSeekSec >= 0) {
      seekTo(initialSeekSec, autoPlayOnSeek);
    } else {
      setCurrentTime(0);
    }
  }, [videoId, initialSeekSec, seekNonce, autoPlayOnSeek, seekTo]);

  const handleLoadedMetadata = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;

    const detected = Number.isFinite(el.duration) ? el.duration : 0;
    setDuration(detected);

    if (videoId && detected > 0 && onDurationDetected) {
      onDurationDetected(videoId, detected);
    }

    if (pendingSeekRef.current) {
      const { sec, play } = pendingSeekRef.current;
      pendingSeekRef.current = null;
      el.currentTime = Math.min(sec, detected || sec);
      setCurrentTime(el.currentTime);
      if (play) {
        el.play().catch(() => {});
      }
    }
  }, [videoId, onDurationDetected]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  return {
    videoRef,
    currentTime,
    duration,
    isPlaying,
    seekTo,
    togglePlay,
    videoEvents: {
      onLoadedMetadata: handleLoadedMetadata,
      onTimeUpdate: () => {
        if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
        }
      },
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
    },
  };
}
