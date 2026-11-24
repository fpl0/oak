// The voicing() unlock moment (ux month 4: "`voicing()` ceremony after hand-voicing"): the learner's own hand
// voicing from U05.L07 beside Strudel's `.voicing()` of the same changes, each in a small read-only Workbench
// with its own Play, the chord band naming the chords. Strudel's side is built from the hand voicing's own
// analysed changes (wave4.md §3.2), so both play the same chords over the same bass and drums.
import type { UnlockableId } from "@oak/content-kit";
import { useState } from "react";
import { useContent } from "../lib/content.ts";
import { lessonTitles } from "../lib/content-model.ts";
import { useSketch, useSketches } from "../lib/queries.ts";
import { appWorkbenchServices } from "../lib/workbench-services.ts";
import { useUnlockedSet } from "../studio/queries.ts";
import "../workbench/index.ts";
import { changesAsChordPattern } from "../workbench/harmony.ts";
import { ServicesGate } from "../workbench/ServicesGate.tsx";
import { Workbench } from "../workbench/Workbench.tsx";
import { siteTitle } from "./model.ts";
import { gateExample, HAND_VOICING_LESSON, handVoicingSketch, strudelVersion } from "./voicing-compare.ts";

/** The hand-voicing lesson by its title ("“Voice Leading by Hand”"), never its ID (U05.L07). */
function useHandLesson(): string {
  const content = useContent();
  const title = siteTitle(HAND_VOICING_LESSON, lessonTitles(content.data?.syllabus ?? null));
  return title === HAND_VOICING_LESSON ? "your hand-voicing lesson" : `“${title}”`;
}

const BARS = 4;

export function VoicingCompare() {
  const sketches = useSketches("lesson-make");
  const mine = sketches.data ? handVoicingSketch(sketches.data.items) : null;
  const lesson = useHandLesson();
  return (
    <section
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
      aria-labelledby="voicing-compare-title"
      data-testid="voicing-compare"
    >
      <h3 id="voicing-compare-title" className="font-sans text-sm font-semibold text-text-2">
        Your voicing and Strudel's
      </h3>
      {sketches.isPending ? (
        <p className="text-sm text-text-3">Finding your hand-voiced chords…</p>
      ) : mine ? (
        <HandAndStrudel sketchId={mine.id} />
      ) : (
        <>
          <p className="text-sm text-text-2" data-testid="voicing-compare-missing">
            Your hand-voiced cadence from {lesson} is not in your sketchbook, so here is Strudel's voicing of
            the same I–IV–V–I in C.
          </p>
          <ServicesGate load={appWorkbenchServices} auto>
            <Side title="Strudel's .voicing()" code={gateExample()} id="vcstrudel" />
          </ServicesGate>
        </>
      )}
    </section>
  );
}

function HandAndStrudel({ sketchId }: { sketchId: string }) {
  const detail = useSketch(sketchId);
  const [changes, setChanges] = useState<string | null>(null);
  const lesson = useHandLesson();
  const version = detail.data?.versions.find((v) => v.version === detail.data?.currentVersion) ?? null;
  if (detail.isPending) return <p className="text-sm text-text-3">Opening your sketch from {lesson}…</p>;
  if (!version) return <p className="text-sm text-text-2">Your sketch from {lesson} could not be opened.</p>;
  return (
    <ServicesGate load={appWorkbenchServices} auto>
      <p className="text-sm text-text-2">
        The same chords twice: on the left the notes you chose by hand, on the right what{" "}
        <code>.voicing()</code> picks. Play each and listen to how little the inner voices move.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Side
          title={`Your hand voicing (${lesson})`}
          code={version.code}
          id="vchand"
          onChanges={(c) => setChanges((prev) => prev ?? c)}
        />
        {changes ? (
          <Side title="Strudel's .voicing()" code={strudelVersion(version.code, changes)} id="vcstrudel" />
        ) : (
          <p className="self-center text-sm text-text-3" data-testid="voicing-compare-reading">
            Reading your chords…
          </p>
        )}
      </div>
    </ServicesGate>
  );
}

function Side({
  title,
  code,
  id,
  onChanges,
}: {
  title: string;
  code: string;
  id: string;
  onChanges?: (changes: string) => void;
}) {
  const { unlocked } = useUnlockedSet();
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid={`voicing-side-${id}`}>
      <p className="text-sm font-semibold text-text">{title}</p>
      <Workbench
        id={id}
        code={code}
        variant="mini"
        readOnly
        lessonCtx={{ key: { tonic: "C", mode: "major" }, meter: "4/4", defaultBpm: 88, loopBars: BARS }}
        lint={{
          profile: "studio",
          unlocked: unlocked as ReadonlySet<UnlockableId>,
          allowPreview: true,
          meter: "4/4",
          key: { tonic: "C", mode: "major" },
        }}
        {...(onChanges
          ? {
              onModel: (m) => {
                const c = m.harmony ? changesAsChordPattern(m.harmony, BARS) : null;
                if (c) onChanges(c);
              },
            }
          : {})}
      />
    </div>
  );
}
