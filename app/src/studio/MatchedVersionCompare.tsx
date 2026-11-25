// Oak 2.0 W4 F5: Studio's version compare (slot `matched-compare`, place `aside`). When the history's Compare picks a
// version, the draft now and that version are rendered offline, each with its own Band and key as SketchEditor builds
// them, and played A/B at matched loudness: louder often sounds better, so Oak takes that out of the comparison.
// Hidden while Jam is on (Jam waits on every compare, W1 fidelity rule 2).
import { bands } from "../../../content/bands/index.ts";
import { useCourseProgress } from "../lib/queries.ts";
import { appWorkbenchServices } from "../lib/workbench-services.ts";
import { MatchedCompare } from "../listen/MatchedCompare.tsx";
import { MATCHED_COMPARE_LINE } from "../listen/matched.ts";
import { ServicesGate } from "../workbench/ServicesGate.tsx";
import type { EditorSlotProps } from "./editor-slots.ts";
import { bandReached, bandSetupFor, type SketchBand } from "./model.ts";

export function MatchedVersionCompare({ compareWith, liveCode, version, keySpec, jam }: EditorSlotProps) {
  const progress = useCourseProgress();
  if (jam || !compareWith) return null;
  const reached = bandReached(progress.data);
  const setupOf = (band: unknown, key: typeof keySpec) =>
    bandSetupFor((band as SketchBand | null) ?? null, bands, key, reached);
  return (
    <section
      aria-label="Compare with an earlier version"
      className="flex flex-col gap-1.5 rounded-card border border-border bg-surface px-3 py-2.5 text-sm"
      data-testid="matched-version-compare"
    >
      {/* The aside sits outside the editor's ServicesGate; the compare renders through the adapter. */}
      <ServicesGate load={appWorkbenchServices} auto>
        <MatchedCompare
          testId="versions-compare"
          sides={[
            { id: "now", label: "now", code: liveCode, band: setupOf(version.band, keySpec), key: keySpec },
            {
              id: `v${compareWith.version}`,
              label: `version ${compareWith.version}`,
              code: compareWith.code,
              band: setupOf(compareWith.band, compareWith.key),
              key: compareWith.key,
            },
          ]}
        />
      </ServicesGate>
      <p className="text-text-3">{MATCHED_COMPARE_LINE}</p>
    </section>
  );
}
