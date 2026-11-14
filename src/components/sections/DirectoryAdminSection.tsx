"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CornerLeftUp,
  Database,
  FileJson,
  Fingerprint,
  Folder,
  FolderOpen,
  FolderSearch,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { FolderTreeView } from "@/components/ui/FolderTreeView";
import type { AdminConfigDTO, ScanResultDTO } from "@/types/cinema.types";

interface DirectoryBrowserListing {
  currentPath: string;
  parentPath: string | null;
  directories: { name: string; fullPath: string }[];
}

export function DirectoryAdminSection() {
  const [status, setStatus] = useState<AdminConfigDTO | null>(null);
  const [directoryInput, setDirectoryInput] = useState("");
  const [pruneMissing, setPruneMissing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanReport, setScanReport] = useState<ScanResultDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Explorateur visuel de dossiers serveur
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserListing, setBrowserListing] =
    useState<DirectoryBrowserListing | null>(null);
  const [selectedTreePath, setSelectedTreePath] = useState("/");

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/admin/scan");
    if (!res.ok) return;
    const json = (await res.json()) as AdminConfigDTO;
    setStatus(json);
    if (json.rootDirectory) {
      setDirectoryInput((prev) => prev || json.rootDirectory || "");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const browseServerFolder = async (targetPath?: string) => {
    setError(null);
    const param = targetPath ? encodeURIComponent(targetPath) : "";
    const res = await fetch(`/api/admin/scan?browse=${param}`);
    const json = (await res.json()) as DirectoryBrowserListing & {
      error?: string;
    };
    if (!res.ok) {
      setError(json.error ?? "Impossible de parcourir ce dossier.");
      return;
    }
    setBrowserListing(json);
    setShowBrowser(true);
  };

  const handleConfigureAndScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setScanReport(null);
    setScanning(true);

    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootDirectory: directoryInput,
          pruneMissing,
        }),
      });

      const json = (await res.json()) as {
        report?: ScanResultDTO;
        status?: AdminConfigDTO;
        error?: string;
      };

      if (!res.ok || !json.report || !json.status) {
        setError(json.error ?? "Échec de l'indexation.");
        return;
      }

      setScanReport(json.report);
      setStatus(json.status);
      setDirectoryInput(json.report.rootDirectory);
    } finally {
      setScanning(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-10 px-6 py-10 md:px-12">
      {/* EN-TÊTE MODE ADMIN */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p className="font-mono text-xs tracking-[0.28em] text-amber-cue uppercase">
            MODE ADMIN // SYSTÈME DE FICHIERS &amp; EMPREINTE SHA-256
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase sm:text-4xl">
            Configuration du Répertoire Vidéo
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Chaque vidéo reçoit une empreinte binaire échantillonnée (Sparse
            SHA-256 sur 192 Ko + taille). Si vous déplacez ou renommez un
            fichier, ses tags et timestamps sont automatiquement reliés.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-amber-cue/30 bg-amber-cue/10 px-3.5 py-1.5 font-mono text-xs text-amber-cue">
          <Fingerprint className="h-4 w-4" aria-hidden="true" />
          <span>Suivi anti-déplacement actif</span>
        </div>
      </div>

      {/* CARTES KPI DE LA BASE DE DONNÉES */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <p className="font-mono text-xs text-muted uppercase">
            Vidéos indexées
          </p>
          <p className="mt-2 font-display text-3xl font-extrabold text-ink">
            {status?.totalVideos ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <p className="font-mono text-xs text-muted uppercase">
            Mots-clés uniques
          </p>
          <p className="mt-2 font-display text-3xl font-extrabold text-amber-cue">
            {status?.totalTags ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <p className="font-mono text-xs text-muted uppercase">
            Timestamps tagués
          </p>
          <p className="mt-2 font-display text-3xl font-extrabold text-ink">
            {status?.totalTimestampTags ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <p className="font-mono text-xs text-muted uppercase">
            Hors-ligne (protégées)
          </p>
          <p
            className={`mt-2 font-display text-3xl font-extrabold ${
              (status?.missingVideos ?? 0) > 0 ? "text-rec" : "text-muted"
            }`}
          >
            {status?.missingVideos ?? 0}
          </p>
        </div>
      </div>

      {/* FORMULAIRE DE CONFIGURATION DU RÉPERTOIRE RACINE */}
      <div className="rounded-2xl border border-white/10 bg-surface p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-amber-cue" />
            <h2 className="font-display text-lg font-bold uppercase">
              Répertoire Racine des Vidéos
            </h2>
          </div>

          <button
            type="button"
            onClick={() => browseServerFolder(directoryInput || undefined)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-elevated px-4 py-2 font-mono text-xs text-ink transition-colors hover:border-amber-cue/60 hover:text-amber-cue"
          >
            <FolderSearch className="h-4 w-4" />
            <span>Parcourir les dossiers du disque</span>
          </button>
        </div>

        <form onSubmit={handleConfigureAndScan} className="space-y-4">
          <div>
            <label
              htmlFor="root-dir-input"
              className="mb-2 block font-mono text-xs text-muted"
            >
              Chemin absolu du dossier racine (formats supportés : .mp4, .webm,
              .mov, .mkv, .m4v, .avi)
            </label>
            <input
              id="root-dir-input"
              type="text"
              value={directoryInput}
              onChange={(e) => setDirectoryInput(e.target.value)}
              placeholder="Ex: D:\Videos\Catalogue ou C:\Users\...\Videos"
              className="w-full rounded-xl border border-white/15 bg-void px-4 py-3.5 font-mono text-sm text-ink placeholder:text-muted/60 focus:border-amber-cue focus:outline-none"
            />
          </div>

          {/* ÉTAT DU FICHIER PORTABLE chronoframe.catalog.json */}
          {status?.catalogFile?.filePath && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-void/70 px-4 py-3 font-mono text-xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileJson
                  className="h-4 w-4 shrink-0 text-amber-cue"
                  aria-hidden="true"
                />
                <span className="truncate text-ink/90">
                  {status.catalogFile.filePath}
                </span>
              </div>
              <span
                className={
                  status.catalogFile.exists ? "text-emerald-300" : "text-muted"
                }
              >
                {status.catalogFile.exists
                  ? `Synchronisé (${((status.catalogFile.sizeBytes ?? 0) / 1024).toFixed(1)} Ko)`
                  : "Sera créé au prochain scan"}
              </span>
            </div>
          )}

          <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={pruneMissing}
              onChange={(e) => setPruneMissing(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 accent-rec"
            />
            <span>
              Purger définitivement de la BDD les fichiers introuvables hors de
              l&apos;arborescence (laissez décoché pour conserver leurs tags en
              sécurité)
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={scanning}
              className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-amber-cue px-6 py-3 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`}
              />
              <span>
                {scanning
                  ? "Analyse & calcul d'empreintes..."
                  : "Enregistrer & Scanner l'arborescence"}
              </span>
            </button>

            {status && status.totalVideos > 0 && (
              <Link
                href="/configure"
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm text-ink transition-colors hover:border-amber-cue hover:text-amber-cue"
              >
                <span>Passer au Mode Configure →</span>
              </Link>
            )}
          </div>
        </form>

        {/* EXPLORATEUR INTERACTIF DE DOSSIERS SERVEUR */}
        {showBrowser && browserListing && (
          <div className="rounded-xl border border-amber-cue/30 bg-void/90 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-amber-cue uppercase">
                  Explorateur de répertoires locaux
                </p>
                <p className="truncate font-mono text-xs text-ink">
                  {browserListing.currentPath}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {browserListing.parentPath && (
                  <button
                    type="button"
                    onClick={() =>
                      browseServerFolder(browserListing.parentPath ?? undefined)
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 font-mono text-xs text-muted hover:text-ink"
                  >
                    <CornerLeftUp className="h-3.5 w-3.5" />
                    <span>Dossier parent</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setDirectoryInput(browserListing.currentPath);
                    setShowBrowser(false);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-cue px-3.5 py-1.5 font-mono text-xs font-semibold text-void"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>Choisir ce dossier</span>
                </button>
              </div>
            </div>

            {browserListing.directories.length === 0 ? (
              <p className="font-mono text-xs text-muted">
                Aucun sous-répertoire dans ce dossier.
              </p>
            ) : (
              <div
                data-lenis-prevent
                className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 md:grid-cols-3"
              >
                {browserListing.directories.map((dir) => (
                  <button
                    key={dir.fullPath}
                    type="button"
                    onClick={() => browseServerFolder(dir.fullPath)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 py-2 text-left text-xs text-ink transition-colors hover:border-amber-cue/50 hover:text-amber-cue"
                  >
                    <Folder className="h-4 w-4 shrink-0 text-amber-cue/80" />
                    <span className="truncate">{dir.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MESSAGES D'ERREUR OU RAPPORT DE SCAN */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rec/50 bg-rec/10 p-4 font-mono text-xs text-rose-300"
          >
            {error}
          </div>
        )}

        {scanReport && (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-2"
          >
            <p className="inline-flex items-center gap-2 font-semibold text-emerald-300 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Synchronisation &amp; sauvegarde du catalogue terminées</span>
            </p>
            {scanReport.restoredFromCatalog && (
              <p className="font-mono text-xs text-amber-cue">
                ↺ Catalogue existant restauré depuis chronoframe.catalog.json (
                {scanReport.restoredVideosCount} vidéo(s),{" "}
                {scanReport.restoredTimestampsCount} timestamp(s) récupéré(s))
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-emerald-200/90">
              <span>{scanReport.scannedFiles} scannée(s)</span>
              <span>• {scanReport.addedCount} nouvelle(s)</span>
              <span className="font-semibold text-amber-cue">
                • {scanReport.relocatedCount} déplacée(s)/reliée(s)
              </span>
              <span>• {scanReport.updatedCount} vérifiée(s)</span>
              {scanReport.duplicatesSkippedCount > 0 && (
                <span>
                  • {scanReport.duplicatesSkippedCount} doublon(s) ignoré(s)
                </span>
              )}
              {scanReport.missingCount > 0 && (
                <span className="text-rose-300">
                  • {scanReport.missingCount} marquée(s) hors-ligne (tags
                  conservés)
                </span>
              )}
              {scanReport.removedCount > 0 && (
                <span className="text-rose-300">
                  • {scanReport.removedCount} purgée(s)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* APERÇU DE L'ARBORESCENCE INDEXÉE EN BDD */}
      {status && status.totalVideos > 0 && (
        <div className="rounded-2xl border border-white/10 bg-surface p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-amber-cue" />
            <h2 className="font-display text-base font-bold uppercase">
              Arborescence de Répertoires Active en BDD
            </h2>
          </div>

          <div className="max-w-xl">
            <FolderTreeView
              nodes={status.folderTree}
              selectedPath={selectedTreePath}
              onSelectPath={setSelectedTreePath}
            />
          </div>
        </div>
      )}
    </section>
  );
}
