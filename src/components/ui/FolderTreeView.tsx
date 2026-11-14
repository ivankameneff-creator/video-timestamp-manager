"use client";

import { Folder, FolderOpen } from "lucide-react";
import type { FolderTreeNode } from "@/types/cinema.types";

interface FolderTreeViewProps {
  nodes: FolderTreeNode[];
  selectedPath: string;
  onSelectPath: (path: string) => void;
  depth?: number;
}

export function FolderTreeView({
  nodes,
  selectedPath,
  onSelectPath,
  depth = 0,
}: FolderTreeViewProps) {
  if (!nodes.length) return null;

  return (
    <ul className={depth === 0 ? "space-y-1" : "mt-1 space-y-1 border-l border-white/10 pl-3 ml-2.5"}>
      {nodes.map((node) => {
        const isSelected = selectedPath === node.path;
        const Icon = isSelected || node.children.length > 0 ? FolderOpen : Folder;

        return (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => onSelectPath(node.path)}
              className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-amber-cue focus-visible:outline-none ${
                isSelected
                  ? "bg-amber-cue/15 text-amber-cue font-medium"
                  : "text-ink/80 hover:bg-white/5 hover:text-ink"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Icon className="h-3.5 w-3.5 shrink-0 text-amber-cue/80" aria-hidden="true" />
                <span className="truncate">{node.name}</span>
              </span>
              <span className="ml-2 shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {node.videoCount}
              </span>
            </button>

            {node.children.length > 0 && (
              <FolderTreeView
                nodes={node.children}
                selectedPath={selectedPath}
                onSelectPath={onSelectPath}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
