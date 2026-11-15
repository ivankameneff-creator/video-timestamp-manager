"use client";

import { Play } from "lucide-react";
import { formatTimecode } from "@/lib/timecode";

interface TimecodeBadgeProps {
  seconds: number;
  onClick?: () => void;
  active?: boolean;
}

export function TimecodeBadge({
  seconds,
  onClick,
  active = false,
}: TimecodeBadgeProps) {
  const formatted = formatTimecode(seconds);

  if (!onClick) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-crimson/25 bg-crimson/10 px-2.5 py-1 font-mono text-xs font-semibold text-crimson">
        {formatted}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-crimson focus-visible:outline-none ${
        active
          ? "border-crimson bg-crimson text-white shadow-sm"
          : "border-crimson/30 bg-crimson/10 text-crimson hover:bg-crimson hover:text-white"
      }`}
    >
      <Play className="h-3 w-3 fill-current" aria-hidden="true" />
      <span>{formatted}</span>
    </button>
  );
}
