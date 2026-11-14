"use client";

import { X } from "lucide-react";

interface TagChipProps {
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export function TagChip({
  label,
  count,
  active = false,
  onClick,
  onRemove,
}: TagChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border text-xs transition-colors duration-150 ${
        active
          ? "border-amber-cue bg-amber-cue text-void font-semibold"
          : "border-white/15 bg-surface text-ink/90 hover:border-amber-cue/50"
      }`}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex cursor-pointer items-center gap-1.5 px-3 py-1 focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none"
        >
          <span>#{label}</span>
          {typeof count === "number" && (
            <span
              className={`font-mono text-[10px] ${
                active ? "text-void/80" : "text-muted"
              }`}
            >
              {count}
            </span>
          )}
        </button>
      ) : (
        <span className="px-3 py-1">#{label}</span>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Supprimer le tag ${label}`}
          className="mr-1.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-rec/20 hover:text-rec focus-visible:ring-1 focus-visible:ring-rec focus-visible:outline-none"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
