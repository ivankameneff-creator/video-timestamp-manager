/**
 * Formate un nombre de secondes au format cinématique HH:MM:SS.d ou MM:SS.d
 */
export function formatTimecode(seconds: number, includeTenths = true): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return includeTenths ? "00:00.0" : "00:00";
  }

  const totalTenths = Math.round(seconds * 10);
  const tenths = totalTenths % 10;
  const totalWholeSeconds = Math.floor(totalTenths / 10);

  const hrs = Math.floor(totalWholeSeconds / 3600);
  const mins = Math.floor((totalWholeSeconds % 3600) / 60);
  const secs = totalWholeSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  const base =
    hrs > 0
      ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
      : `${pad(mins)}:${pad(secs)}`;

  return includeTenths ? `${base}.${tenths}` : base;
}

/**
 * Convertit une saisie humaine ("01:24.5", "1:02:15", "84.5") en secondes
 */
export function parseTimecode(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const val = Number.parseFloat(trimmed);
    return Number.isFinite(val) && val >= 0 ? val : null;
  }

  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) return null;

  const nums = parts.map((p) => Number.parseFloat(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;

  if (nums.length === 2) {
    return nums[0] * 60 + nums[1];
  }
  return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

/**
 * Normalise un mot-clé pour éviter les doublons (" Cascade  " -> "cascade")
 */
export function normalizeTagName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
