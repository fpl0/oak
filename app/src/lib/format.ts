// Small display formatters shared by pages. Dates are shown in the learner's locale; music values follow
// Oak's display conventions (♭/♯ glyphs, "D major").
import type { KeySpec } from "@oak/api";

const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export function formatDate(iso: string | null | undefined, short = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (short ? shortFmt : dateFmt).format(d);
}

export function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return yyyyMm;
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

/** "Bb" → "B♭", "F#" → "F♯". */
export function accidentals(name: string): string {
  return name.replace(/([A-Ga-g])b/g, "$1♭").replace(/#/g, "♯");
}

export function formatKey(key: KeySpec | null | undefined): string {
  if (!key) return "";
  const mode = key.mode === "major" ? "major" : key.mode === "minor" ? "minor" : key.mode;
  return `${accidentals(key.tonic)} ${mode}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function pct(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  return `${Math.round(x * 100)}%`;
}

/** A style's name, as Settings, onboarding and the song style cards say it (song/surfaces-model.ts `SONG_STYLES`). */
export const FLAVOUR_LABEL: Record<string, string> = {
  "flavour.pop": "Pop",
  "flavour.indie": "Indie",
  "flavour.jazz-soul": "Jazz-soul",
  "flavour.funk": "Funk",
  "flavour.electronic": "Electronic",
};
