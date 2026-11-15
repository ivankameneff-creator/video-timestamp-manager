"use client";

import { Film, Play } from "lucide-react";

interface TimestampThumbnailProps {
  src: string | null | undefined;
  alt: string;
  size?: "sm" | "md" | "lg";
  showPlayOverlay?: boolean;
}

const SIZE_CLASSES: Record<
  NonNullable<TimestampThumbnailProps["size"]>,
  string
> = {
  sm: "w-24",
  md: "w-28 sm:w-32",
  lg: "w-full",
};

export function TimestampThumbnail({
  src,
  alt,
  size = "md",
  showPlayOverlay = true,
}: TimestampThumbnailProps) {
  return (
    <div
      className={`relative aspect-video shrink-0 overflow-hidden rounded-lg border border-line bg-elevated ${SIZE_CLASSES[size]}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 will-change-transform group-hover:scale-105"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgba(184,29,36,0.12),transparent_70%)] text-crimson/55"
        >
          <Film className="h-4 w-4" />
        </div>
      )}

      {showPlayOverlay && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-crimson text-white shadow-md">
            <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
          </span>
        </div>
      )}
    </div>
  );
}
