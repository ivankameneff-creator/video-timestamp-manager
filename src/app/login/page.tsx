"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  RomanianEmblem,
  RomanianStitchFrieze,
} from "@/components/ui/RomanianFolkMotif";

function sanitizeRedirect(nextParam: string | null): string {
  if (!nextParam || !nextParam.startsWith("/") || nextParam.startsWith("//")) {
    return "/configure";
  }
  return nextParam;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeRedirect(searchParams.get("next"));

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Connexion refusée.");
        setSubmitting(false);
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-crimson/25 bg-crimson/8">
          <RomanianEmblem className="h-7 w-7 text-crimson" />
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
          Accès Administrateur
        </span>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-wide text-ink">
          JOCURI • TIMECODE
        </h1>
        <p className="mt-2 text-sm text-muted">
          Saisissez le mot de passe pour accéder à l&apos;atelier d&apos;annotation et au répertoire racine.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="admin-password"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted"
          >
            Mot de passe
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="admin-password"
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-line bg-elevated/60 py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted/60 focus:border-crimson focus:bg-surface focus:outline-none focus:ring-2 focus:ring-crimson/15"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-crimson/30 bg-crimson/8 px-3.5 py-2.5 text-xs font-medium text-crimson">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-crimson px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldCheck className="h-4 w-4" />
          {submitting ? "Vérification…" : "Déverrouiller l'administration"}
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-4 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-crimson"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour à la recherche publique
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-void">
      <div className="tricolor-thread" />
      <RomanianStitchFrieze patternId="login-frieze" />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense
          fallback={
            <div className="h-80 w-full max-w-md animate-pulse rounded-2xl border border-line bg-surface" />
          }
        >
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
