// The sound pack's credits on the About page, rendered from `/sounds/<version>/credits.json` (written by
// scripts/sounds/mirror.ts from scripts/sounds/credits.ts). CC BY works first, with the attribution their
// authors ask for; then the CC0, Unlicense and MIT ones; then Oak's own renders.
import { useQuery } from "@tanstack/react-query";
import { Section } from "../../../ui/kit/Field.tsx";

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

interface CreditsFile {
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

/** CC BY first (attribution required), then the other licences, then Oak's own; by title within each. */
export function orderCredits(items: CreditsFile["credits"]): CreditsFile["credits"] {
  const rank = (c: SoundCredit) => (c.licence.startsWith("CC-BY") ? 0 : c.author === "Oak" ? 2 : 1);
  return [...items].sort(
    (a, b) => rank(a.entry) - rank(b.entry) || a.entry.title.localeCompare(b.entry.title),
  );
}

async function loadCredits(): Promise<CreditsFile | null> {
  const res = await fetch("/sounds/manifest.json", { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`the sound pack manifest answered ${res.status}`);
  const manifest = (await res.json()) as { packVersion: string; credits?: string };
  if (!manifest.credits) return null;
  const c = await fetch(manifest.credits, { headers: { Accept: "application/json" } });
  if (!c.ok) throw new Error(`the sound credits answered ${c.status}`);
  return (await c.json()) as CreditsFile;
}

const external = { target: "_blank", rel: "noreferrer" } as const;

export function SoundCredits() {
  const q = useQuery({
    queryKey: ["sound-credits"],
    queryFn: loadCredits,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return (
    <Section
      title="Sound credits"
      description="Where every sound in Oak's pack comes from, and its licence. Music you make with them is yours."
    >
      {q.isPending && <p className="py-3 text-text-2">Loading the credits…</p>}
      {q.isError && (
        <p className="py-3 text-text-2">The sound credits could not be loaded: {String(q.error)}</p>
      )}
      {q.data === null && <p className="py-3 text-text-2">This sound pack has no credits file.</p>}
      {q.data &&
        orderCredits(q.data.credits).map(({ id, entry }) => (
          <div key={id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <a className="font-medium underline-offset-2 hover:underline" href={entry.url} {...external}>
              {entry.title}
            </a>
            <span className="text-sm text-text-2">
              {entry.author} ·{" "}
              <a className="underline-offset-2 hover:underline" href={entry.licenceUrl} {...external}>
                {licenceName(entry.licence)}
              </a>
            </span>
            {entry.attribution && <span className="text-sm">{entry.attribution}</span>}
            <span className="text-sm text-text-2">Oak sounds: {entry.sounds.join(", ")}</span>
          </div>
        ))}
    </Section>
  );
}
