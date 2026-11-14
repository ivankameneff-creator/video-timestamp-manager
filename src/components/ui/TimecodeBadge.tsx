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
      <span className="inline-flex items-center gap-1.5 rounded bg-amber-cue/15 px-2.5 py-1 font-mono text-xs font-medium text-amber-cue">
        {formatted}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none ${
        active
          ? "border-amber-cue bg-amber-cue text-void"
          : "border-amber-cue/35 bg-amber-cue/10 text-amber-cue hover:bg-amber-cue hover:text-void"
      }`}
    >
      <Play className="h-3 w-3 fill-current" aria-hidden="true" />
      <span>{formatted}</span>
    </button>
  );
}
