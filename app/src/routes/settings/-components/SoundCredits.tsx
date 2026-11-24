// The sound pack's credits on the About page, rendered from `/sounds/<version>/credits.json` (written by
// scripts/sounds/mirror.ts from scripts/sounds/credits.ts). CC BY works first, with the attribution their
// authors ask for; then the CC0, Unlicense and MIT ones; then Oak's own renders; then one line per sound with all
// of its sources (toolbox/sound-credits.ts, which the Toolbox's sound pages read too).
import {
  type CreditsFile,
  creditText,
  licenceName,
  type SoundCredit,
  soundIndex,
  useSoundCredits,
} from "../../../toolbox/sound-credits.ts";
import { Chip } from "../../../ui/kit/basics.tsx";
import { Section } from "../../../ui/kit/Field.tsx";
import { ErrorState } from "../../../ui/kit/QueryState.tsx";

export { licenceName, type SoundCredit };

/** CC BY first (attribution required), then the other licences, then Oak's own; by title within each. */
export function orderCredits(items: CreditsFile["credits"]): CreditsFile["credits"] {
  const rank = (c: SoundCredit) => (c.licence.startsWith("CC-BY") ? 0 : c.author === "Oak" ? 2 : 1);
  return [...items].sort(
    (a, b) => rank(a.entry) - rank(b.entry) || a.entry.title.localeCompare(b.entry.title),
  );
}

const external = { target: "_blank", rel: "noreferrer" } as const;

/** A licence Oak has no name for: `licenceName` falls back to the same words for every unknown id. */
const unverified = (id: string) => licenceName(id) === licenceName("");

export function SoundCredits() {
  const q = useSoundCredits();
  return (
    <Section
      title="Sound credits"
      description="Where every sound in Oak's pack comes from, and its licence. Music you make with them is yours."
    >
      {q.isPending && <p className="py-3 text-text-2">Loading the credits…</p>}
      {/* The app's one wording for a failed load ("Oak's server isn't answering" while it is down), one Try again. */}
      {q.isError && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {q.data === null && <p className="py-3 text-text-2">This sound pack has no credits file.</p>}
      {q.data &&
        orderCredits(q.data.credits).map(({ id, entry }) => (
          <div key={id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <a className="font-medium underline-offset-2 hover:underline" href={entry.url} {...external}>
              {entry.title}
            </a>
            <span className="text-sm text-text-2">
              {entry.author} ·{" "}
              {unverified(entry.licence) ? (
                // A warning, not a licence: it must not read like the links of the checked licences beside it.
                <Chip tone="amber" data-testid="licence-unverified">
                  Licence not verified
                </Chip>
              ) : (
                <a className="underline-offset-2 hover:underline" href={entry.licenceUrl} {...external}>
                  {licenceName(entry.licence)}
                </a>
              )}
            </span>
            {entry.attribution && <span className="text-sm">{entry.attribution}</span>}
            <span className="text-sm text-text-2">Oak sounds: {entry.sounds.join(", ")}</span>
          </div>
        ))}
      {q.data ? (
        // One answer per sound: a kit mixed from several libraries, or a General MIDI name whose variants come
        // from different fonts, sits under each source above; here it is one line with every source and licence.
        <details className="py-3" data-testid="credits-by-sound">
          <summary className="cursor-pointer font-medium">Look up one sound</summary>
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            {soundIndex(q.data.credits).map((s) => (
              <div key={s.sound} className="contents" id={`sound-${s.sound}`}>
                <dt className="font-mono">{s.sound}</dt>
                <dd className="text-text-2">{creditText(s)}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </Section>
  );
}
