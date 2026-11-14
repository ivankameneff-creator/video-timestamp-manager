"use client";

import Link from "next/link";
import { FolderCog, Search, Tag } from "lucide-react";

interface TopModeNavProps {
  activeMode: "use" | "configure" | "admin";
  subtitle?: string;
}

export function TopModeNav({ activeMode, subtitle }: TopModeNavProps) {
  const navItems = [
    {
      id: "use" as const,
      label: "Utilisation",
      href: "/#search",
      icon: Search,
    },
    {
      id: "configure" as const,
      label: "Configure",
      href: "/configure",
      icon: Tag,
    },
    {
      id: "admin" as const,
      label: "Admin",
      href: "/admin",
      icon: FolderCog,
    },
  ];

  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-void/85 px-6 py-5 backdrop-blur-md md:px-12">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex cursor-pointer items-center gap-3 focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none"
        >
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rec shadow-[0_0_12px_rgba(225,29,72,0.9)]" />
          <span className="font-display text-sm font-bold tracking-[0.22em] text-ink uppercase">
            CHRONOFRAME
          </span>
        </Link>
        {subtitle && (
          <span className="hidden font-mono text-xs text-muted sm:inline">
            // {subtitle}
          </span>
        )}
      </div>

      <nav
        aria-label="Modes de l'application"
        className="flex items-center gap-2 sm:gap-3"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMode === item.id;

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-xs transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-amber-cue focus-visible:outline-none ${
                isActive
                  ? "border-amber-cue bg-amber-cue text-void font-semibold"
                  : "border-white/15 bg-white/5 text-ink/85 hover:border-white/35 hover:bg-white/10"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
