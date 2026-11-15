"use client";

import Link from "next/link";
import { FolderCog, Search, Tag } from "lucide-react";
import {
  RomanianEmblem,
  RomanianStitchFrieze,
} from "@/components/ui/RomanianFolkMotif";

interface TopModeNavProps {
  activeMode: "use" | "configure" | "admin";
  subtitle?: string;
}

export function TopModeNav({ activeMode, subtitle }: TopModeNavProps) {
  const navItems = [
    {
      id: "use" as const,
      label: "Danses & Recherche",
      href: "/",
      icon: Search,
    },
    {
      id: "configure" as const,
      label: "Annoter Figures",
      href: "/configure",
      icon: Tag,
    },
    {
      id: "admin" as const,
      label: "Répertoire Admin",
      href: "/admin",
      icon: FolderCog,
    },
  ];

  return (
    <div className="sticky top-0 z-30 shadow-[0_4px_20px_rgba(60,35,20,0.06)]">
      {/* Filet tricolore discret Bleu Voroneț • Or • Rouge Roumain */}
      <div className="tricolor-thread h-1 w-full" aria-hidden="true" />

      <header className="flex flex-wrap items-center justify-between gap-4 bg-void/95 px-6 py-3.5 backdrop-blur-md md:px-12">
        <div className="flex items-center gap-3.5">
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-crimson focus-visible:outline-none"
          >
            <RomanianEmblem className="h-8 w-8 shrink-0" />
            <div className="leading-tight">
              <span className="block font-display text-base font-bold tracking-[0.14em] text-ink uppercase">
                JOCURI • TIMECODE
              </span>
              <span className="block font-serif text-xs italic text-crimson">
                Archives &amp; Figures de Danse Roumaine
              </span>
            </div>
          </Link>

          {subtitle && (
            <span className="hidden border-l border-line pl-3.5 font-mono text-xs text-muted lg:inline">
              {subtitle}
            </span>
          )}
        </div>

        <nav
          aria-label="Modes de l'application"
          className="flex flex-wrap items-center gap-2 sm:gap-2.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMode === item.id;

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-crimson focus-visible:outline-none ${
                  isActive
                    ? "border-crimson bg-crimson text-white shadow-sm"
                    : "border-line bg-surface text-ink hover:border-crimson/50 hover:text-crimson"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <RomanianStitchFrieze patternId={`frieze-${activeMode}`} />
    </div>
  );
}
