// Practice hub (ux §2.3, contracts §7.3–7.4): today's review, then every drill family grouped by ear-training
// stage with its state — locked ("Unlocks in unit 4, Intervals (compressed)"), arriving later (its generator is not built yet), open with
// its level and recall, or mastered. Raw due counts are never shown (§7.4 Display). Wave 7: the families the
// advanced tracks open (stage G, the rest of stage H, the sound families) are grouped by track after the core's
// stages, each track with its own honest line (closed until its gate, or the lesson that opens each family).

import { EAR_STAGES } from "@content/families.ts";
import type { FamilyDef } from "@oak/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Check, Hourglass, Lock, Mic } from "lucide-react";
import {
  compositeLine,
  compositesProgress,
  type FamilyStatus,
  familyAccuracy,
  familyStatus,
  groupByStage,
  isCompositeFamily as isComposite,
  levelLine,
  pctText,
  pendingText,
  RESTING_LINE,
  recallOf,
  titlesOf,
  unitOf,
  unitPhrase,
} from "../../drills/model.ts";
import { nextSessionLine } from "../../drills/track-line.ts";
import { type DrillData, useDrillData } from "../../drills/use-drill-data.ts";
import { graduatedLine } from "../../drills/wave5.ts";
import {
  familiesByTrack,
  quietPracticeOf,
  TRACK_EAR_LINES,
  TRACK_TITLES,
  type TrackKey,
  type TrackLine,
  trackLockedText,
} from "../../drills/wave7.ts";
import { usePageTitle } from "../../lib/nav.ts";
import { useDue, useTracks } from "../../lib/queries.ts";
import { trackNote } from "../../session/tracks-model.ts";
import { buttonClass } from "../../ui/kit/Button.tsx";
import { Card, Chip, EmptyState, Page, PageHeader } from "../../ui/kit/basics.tsx";
import { ErrorState, LoadingState } from "../../ui/kit/QueryState.tsx";

export const Route = createFileRoute("/practice/")({ component: PracticeHub });

/**
 * "Unlocks in unit 3, Major Scale & Degrees", or the lesson itself once its unit has begun ("Unlocks with the lesson “Degrees
 * in Code”"): in words, never the IDs.
 */
function lockedText(def: FamilyDef, data: DrillData): string {
  const unit = unitOf(def.unlock.lesson);
  const begun = [...data.completed].some((l) => unitOf(l) === unit);
  const lesson = titlesOf(data).lessons.get(def.unlock.lesson);
  return begun && lesson
    ? `Unlocks with the lesson “${lesson}”`
    : `Unlocks in ${unitPhrase(unit, titlesOf(data).units)}`;
}

function recallTone(r: number | null): string {
  if (r === null) return "border border-text-3";
  if (r >= 0.9) return "bg-accent";
  if (r >= 0.75) return "bg-accent-2";
  return "bg-issue";
}

const STATUS_CHIP: Record<FamilyStatus, { label: string; tone: "neutral" | "accent" | "amber" }> = {
  pending: { label: "Later", tone: "neutral" },
  locked: { label: "Locked", tone: "neutral" },
  unlocked: { label: "Open", tone: "accent" },
  resting: { label: "In mixed practice", tone: "accent" },
  mastered: { label: "Mastered", tone: "amber" },
};

function FamilyCard({ def, data, track }: { def: FamilyDef; data: DrillData; track?: TrackLine | null }) {
  const state = data.states.get(def.id);
  const status = familyStatus(def, state, data.completed);
  const card = data.cards.get(def.id);
  const recall = recallOf(card);
  const { n, acc } = familyAccuracy(state);
  const playable = status === "unlocked" || status === "resting" || status === "mastered";
  // A sung family with a listening half still runs in Quiet mode (its sung trials heard in the head); one that is only
  // sung waits for the microphone.
  const quiet = quietPracticeOf(def, data.profile.quiet);
  const quietBlocked = playable && quiet === "waits";
  const chip = STATUS_CHIP[status];
  const compositeTitle = state?.compositeId ? (data.defs.get(state.compositeId)?.title ?? null) : null;
  const others = state?.compositeId
    ? [...data.states.values()].filter(
        (s) => s.compositeId === state.compositeId && s.graduatedAt !== null && s.familyId !== def.id,
      ).length
    : 0;
  // Graduated into its composite (contracts §7.4): progress, said as such.
  const graduated =
    status === "mastered" && compositeTitle ? graduatedLine(state, def, compositeTitle, others) : null;
  const mix = graduated ?? compositeLine(state, data.states, data.defs);
  return (
    <Card
      className={clsx("flex flex-col gap-2 p-4", !playable && "bg-surface-2/60")}
      data-testid="family-card"
      data-family={def.id}
      data-status={status}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={clsx("font-sans text-base font-semibold", !playable && "text-text-2")}>{def.title}</h3>
        <span className="flex shrink-0 items-center gap-2">
          {def.mic && <Mic aria-label="Uses the microphone" className="size-4 text-text-3" />}
          {playable && (
            <span
              className={clsx("size-2.5 rounded-full", recallTone(recall))}
              title={recall === null ? "Not scheduled yet" : `Recall ${pctText(recall)}`}
              aria-label={recall === null ? "Not scheduled yet" : `Recall ${pctText(recall)}`}
              role="img"
            />
          )}
          <Chip tone={chip.tone}>{chip.label}</Chip>
        </span>
      </div>
      {status === "locked" && (
        <p className="flex items-center gap-1.5 text-sm text-text-2">
          <Lock aria-hidden className="size-3.5" />{" "}
          {track !== undefined ? trackLockedText(def, track, titlesOf(data).lessons) : lockedText(def, data)}
        </p>
      )}
      {status === "pending" && (
        <p className="flex items-center gap-1.5 text-sm text-text-2">
          <Hourglass aria-hidden className="size-3.5" /> {pendingText(def, data.completed)}
        </p>
      )}
      {playable && (
        <>
          <p className="text-sm text-text-2">
            {status === "mastered" && <Check aria-hidden className="mr-1 inline size-3.5 text-accent" />}
            {levelLine(def, state, titlesOf(data).lessons)}
            {acc !== null
              ? ` · ${pctText(acc)} over ${n} ${n === 1 ? "trial" : "trials"}`
              : " · not practised yet"}
          </p>
          {status === "resting" && (
            <p className="text-sm text-text-2" data-testid="family-resting">
              {RESTING_LINE}
            </p>
          )}
          {mix && status !== "resting" && (
            <p
              className={clsx("text-sm", graduated ? "text-text-2" : "text-text-3")}
              data-testid={graduated ? "family-graduated" : "family-composite"}
            >
              {mix}
            </p>
          )}
          {playable && quiet === "listening" && (
            <p className="text-sm text-text-3" data-testid="family-quiet">
              Quiet mode is on: its sung lines are heard in your head, and its listening trials run as usual.
            </p>
          )}
          {quietBlocked ? (
            <p className="text-sm text-text-3">Quiet mode is on: this one waits for the microphone.</p>
          ) : (
            <Link
              to="/practice/$familyId"
              params={{ familyId: def.id }}
              className={buttonClass("secondary", "sm", "self-start")}
              aria-label={`Practise ${def.title}`}
            >
              Practise
            </Link>
          )}
        </>
      )}
    </Card>
  );
}

function PracticeHub() {
  usePageTitle("Practice");
  const due = useDue();
  const state = useDrillData();
  const hasReview = (due.data?.items.length ?? 0) > 0;

  return (
    <Page>
      <PageHeader
        title="Practice"
        sub={due.data ? due.data.label : due.isPending ? "\u00a0" : undefined}
        actions={
          hasReview ? (
            <Link to="/practice/review" className={buttonClass("primary", "lg")}>
              Start today's review
            </Link>
          ) : undefined
        }
      />
      <p className="mb-6 max-w-[70ch] text-sm text-text-2">
        Free practice adapts to keep you near 85% right. Extra practice doesn't change your schedule unless a
        family is nearly due.
      </p>
      {state.status === "loading" ? (
        <LoadingState rows={4} label="Loading families" />
      ) : state.status === "error" ? (
        <ErrorState error={state.error} onRetry={state.retry} />
      ) : (
        <Stages data={state.data} />
      )}
    </Page>
  );
}

function Stages({ data }: { data: DrillData }) {
  const split = familiesByTrack(data.content.families);
  const groups = groupByStage(split.core, EAR_STAGES);
  if (groups.length === 0)
    return <EmptyState title="No drill families yet">Families open as lessons introduce them.</EmptyState>;
  const anyOpen = groups.some((g) =>
    g.families.some((d) =>
      ["unlocked", "resting", "mastered"].includes(familyStatus(d, data.states.get(d.id), data.completed)),
    ),
  );
  const mixed = compositesProgress(data.content.families, data.states);
  return (
    <div className="flex flex-col gap-8">
      {mixed.length > 0 && (
        <section aria-labelledby="mixed-practice" data-testid="mixed-practice">
          <div className="mb-3">
            <h2 id="mixed-practice" className="text-h3">
              Mixed practice
            </h2>
            <p className="text-sm text-text-2">
              Families you have mastered move here. They keep their level, and your warm-ups keep them in the
              ear.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mixed.map((c) => (
              <Card key={c.id} className="flex flex-col gap-1 p-4" data-testid={`composite-${c.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{c.title}</h3>
                  <Chip tone="accent">
                    {c.members.length} {c.members.length === 1 ? "family" : "families"}
                  </Chip>
                </div>
                <p className="text-sm text-text-2">{c.line}</p>
              </Card>
            ))}
          </div>
        </section>
      )}
      {!anyOpen && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-text-2">
            Families open as lessons introduce them. The first ones arrive with the opening lessons.
          </p>
          <Link to="/" className={buttonClass("secondary")}>
            Go to Today
          </Link>
        </Card>
      )}
      {groups.map((g) => {
        const open = g.families.filter((d) =>
          ["unlocked", "resting", "mastered"].includes(
            familyStatus(d, data.states.get(d.id), data.completed),
          ),
        ).length;
        const mastered = g.families.filter(
          (d) => familyStatus(d, data.states.get(d.id), data.completed) === "mastered",
        ).length;
        return (
          <section key={g.key} aria-labelledby={`stage-${g.key}`} data-testid={`stage-${g.key}`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 id={`stage-${g.key}`} className="text-h3">
                  {g.title}
                </h2>
                <p className="text-sm text-text-2">{g.sub}</p>
              </div>
              <span className="text-sm text-text-3" data-testid={`stage-${g.key}-count`}>
                {open} of {g.families.length} open
                {mastered > 0 ? ` · ${mastered} mastered` : ""}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.families.map((d) => (
                <FamilyCard key={d.id} def={d} data={data} />
              ))}
            </div>
          </section>
        );
      })}
      <Tracks data={data} families={split.tracks} />
    </div>
  );
}

/** The advanced tracks' families, one group per track, each with the track's honest line. */
function Tracks({ data, families }: { data: DrillData; families: Record<TrackKey, FamilyDef[]> }) {
  const tracks = useTracks();
  const keys = (["J", "R", "A"] as const).filter((k) => families[k].some((d) => !isComposite(d)));
  if (keys.length === 0) return null;
  const lineOf = (k: TrackKey): TrackLine | null => {
    const t = tracks.data?.items.find((i) => i.trackId === k);
    if (!t) return null;
    // What the learner may start in the track now, as Today offers it (a side lesson, a lesson, its checkpoint or a
    // capstone session); the server's note names only the next track LESSON, which may not be the next thing.
    const n = t.nextSession;
    const note = n ? nextSessionLine(n) : trackNote(t);
    return { status: t.status, note };
  };
  return (
    <section aria-labelledby="tracks-heading" className="flex flex-col gap-6" data-testid="practice-tracks">
      <div className="border-t border-border pt-6">
        <h2 id="tracks-heading" className="text-h3">
          The advanced tracks
        </h2>
        <p className="max-w-[70ch] text-sm text-text-2">
          Optional, open from the unit 13 checkpoint, beside the core or after it. Each track's ear training
          opens lesson by lesson, like the core's.
        </p>
      </div>
      {keys.map((k) => {
        const fams = families[k].filter((d) => !isComposite(d));
        const status = (d: FamilyDef) => familyStatus(d, data.states.get(d.id), data.completed);
        const open = fams.filter((d) => ["unlocked", "resting", "mastered"].includes(status(d))).length;
        const mastered = fams.filter((d) => status(d) === "mastered").length;
        const line = lineOf(k);
        return (
          <section key={k} aria-labelledby={`track-${k}`} data-testid={`track-${k}`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 id={`track-${k}`} className="font-sans text-lg font-semibold">
                  {TRACK_TITLES[k]}
                </h3>
                <p className="text-sm text-text-2">{TRACK_EAR_LINES[k]}</p>
                {line && (
                  <p className="text-sm text-text-3" data-testid={`track-${k}-note`}>
                    {line.note}
                  </p>
                )}
              </div>
              <span className="text-sm text-text-3" data-testid={`track-${k}-count`}>
                {open} of {fams.length} open
                {mastered > 0 ? ` · ${mastered} mastered` : ""}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fams.map((d) => (
                <FamilyCard key={d.id} def={d} data={data} track={line} />
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}
