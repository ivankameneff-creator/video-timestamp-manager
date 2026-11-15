"use client";

/**
 * Capture l'image exacte actuellement affichée dans un élément <video>
 * sous forme de DataURL WebP léger (~10-18 Ko en largeur 320px).
 */
export function captureVideoElementFrame(
  videoEl: HTMLVideoElement | null,
  maxWidth = 320
): string | null {
  if (
    !videoEl ||
    videoEl.readyState < 2 ||
    videoEl.videoWidth <= 0 ||
    videoEl.videoHeight <= 0
  ) {
    return null;
  }

  try {
    const scale = Math.min(1, maxWidth / videoEl.videoWidth);
    const width = Math.max(1, Math.round(videoEl.videoWidth * scale));
    const height = Math.max(1, Math.round(videoEl.videoHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(videoEl, 0, 0, width, height);

    const webp = canvas.toDataURL("image/webp", 0.82);
    if (webp.startsWith("data:image/webp")) {
      return webp;
    }
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

/**
 * Extrait une miniature à une seconde précise d'une vidéo locale
 * (utilisé en cas de saisie manuelle de timecode ou génération groupée).
 */
export function captureFrameAtSecond(
  videoSrc: string,
  targetSec: number,
  maxWidth = 320
): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let settled = false;
    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };

    const timeoutId = setTimeout(() => finish(null), 6000);

    video.addEventListener("error", () => finish(null), { once: true });

    video.addEventListener(
      "loadedmetadata",
      () => {
        const dur = Number.isFinite(video.duration) ? video.duration : targetSec + 1;
        const clamped = Math.max(
          0.05,
          Math.min(targetSec, Math.max(0.05, dur - 0.1))
        );

        video.addEventListener(
          "seeked",
          () => {
            finish(captureVideoElementFrame(video, maxWidth));
          },
          { once: true }
        );

        try {
          video.currentTime = clamped;
        } catch {
          finish(null);
        }
      },
      { once: true }
    );

    video.src = videoSrc;
  });
}
