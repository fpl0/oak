// The sound pack's credits (`/sounds/<version>/credits.json`, written by scripts/sounds/mirror.ts from
// scripts/sounds/credits.ts), read once and shared by Settings → About → Sound credits and the Toolbox's sound
// pages. The file has one entry per source library; a kit built from several libraries, or a General MIDI name whose
// preset variants come from different fonts, sits under each. `soundIndex` turns that round into one answer per
// sound, so both surfaces say the same thing about the same sound.
import { OakApiError } from "@oak/api";
import { useQuery } from "@tanstack/react-query";

/** One credits.json entry (scripts/sounds/pack.config.ts `CreditEntry`). */
export interface SoundCredit {
  title: string;
  author: string;
  url: string;
  licence: string;
  licenceUrl: string;
  attribution?: string;
  modified: string;
  sounds: string[];
  origins?: string[];
}

export interface CreditsFile {
  packVersion: string;
  credits: { id: string; entry: SoundCredit }[];
}

const LICENCE_NAMES: Record<string, string> = {
  "CC0-1.0": "CC0 1.0 (public domain)",
  Unlicense: "Unlicense (public domain)",
  MIT: "MIT",
  "CC-BY-3.0": "CC BY 3.0",
  "CC-BY-4.0": "CC BY 4.0",
};

/** A licence's display name; anything off the list is shown as "licence not verified". */
export const licenceName = (id: string): string => LICENCE_NAMES[id] ?? "licence not verified";

/**
 * One file of the pack, failing as the API client does (`OakApiError`), so the surfaces word it with
 * `describeError`: no answer at all, or the dev proxy's 502 or 504, is "Oak's server isn't answering"; any other
 * failure says the credits could not be read, never a raw status line or the browser's TypeError.
 */
export async function fetchPackJson(url: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new OakApiError(url, 0, "network", "The Oak server could not be reached.");
  }
  if (!res.ok)
    throw new OakApiError(
      url,
      res.status,
      res.status === 502 || res.status === 504 ? "unavailable" : "internal",
      "The sound pack's credits could not be read.",
    );
  return res.json();
}

async function loadCredits(): Promise<CreditsFile | null> {
  const manifest = (await fetchPackJson("/sounds/manifest.json")) as {
    packVersion: string;
    credits?: string;
  };
  if (!manifest.credits) return null;
  return (await fetchPackJson(manifest.credits)) as CreditsFile;
}

export function useSoundCredits() {
  return useQuery({
    queryKey: ["sound-credits"],
    queryFn: loadCredits,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Where one sound comes from: its sources grouped by licence ("Big Rusty Drums, VCSL · CC0 1.0 (public domain)"). */
export interface SoundSource {
  sound: string;
  byLicence: { licence: string; sources: string[] }[];
}

/** Every sound the pack names, alphabetically, each with all of its sources grouped under their licences. */
export function soundIndex(credits: CreditsFile["credits"]): SoundSource[] {
  const bySound = new Map<string, Map<string, Set<string>>>();
  for (const { entry } of credits) {
    const licence = licenceName(entry.licence);
    for (const sound of entry.sounds) {
      const licences = bySound.get(sound) ?? new Map<string, Set<string>>();
      const sources = licences.get(licence) ?? new Set<string>();
      sources.add(entry.title);
      licences.set(licence, sources);
      bySound.set(sound, licences);
    }
  }
  return [...bySound]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sound, licences]) => ({
      sound,
      byLicence: [...licences]
        // A verified licence first, the unverified one last.
        .sort(([a], [b]) => Number(a === "licence not verified") - Number(b === "licence not verified"))
        .map(([licence, sources]) => ({ licence, sources: [...sources].sort((x, y) => x.localeCompare(y)) })),
    }));
}

/** "Big Rusty Drums, VCSL · CC0 1.0 (public domain)"; several licences joined with "; ". */
export function creditText(s: SoundSource): string {
  return s.byLicence.map((l) => `${l.sources.join(", ")} · ${l.licence}`).join("; ");
}

/** The pack's name for the sound a toolbox entry plays: the first quoted name of its code (`.s("ebass")` → ebass). */
export function packSoundOf(signature: string): string | null {
  return /["']([\w-]+)["']/.exec(signature)?.[1] ?? null;
}
