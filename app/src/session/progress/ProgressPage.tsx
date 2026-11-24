// Progress (ux §2.3, §5.5): the can-do ledger by area, the course by unit, time practised, the weekly rhythm over
// the year and milestones. Honest numbers only: what the server stored, nothing projected except the pace
// estimate, which is shown as a month (contracts §9.6), never as sessions behind.

import type { CanDoEntry } from "@oak/api";
import { COURSE_SESSIONS } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { milestoneById } from "../../../../content/milestones.ts";
import { useContent } from "../../lib/content.ts";
import { lessonTitles } from "../../lib/content-model.ts";
import { formatDate, formatMonth } from "../../lib/format.ts";
import { usePageTitle } from "../../lib/nav.ts";
import {
  useAlbum,
  useBootstrap,
  useCourseProgress,
  useGymPlan,
  useLadder,
  useProgressReport,
  useSideLessons,
  useStreak,
  useTodayPlan,
  useVoiceState,
} from "../../lib/queries.ts";
import {
  Card,
  Chip,
  type ChipTone,
  EmptyState,
  Page,
  PageHeader,
  Progress,
  Skeleton,
} from "../../ui/kit/basics.tsx";
import { ErrorState, LoadingState } from "../../ui/kit/QueryState.tsx";
import { courseEndEntry, coursePaceLine } from "../course-end.ts";
import { useCompletionWhen, useGymOpen, useWholeCourseWhen } from "../day-hooks.ts";
import { courseEdge, edgeLead, mapNextId } from "../edge.ts";
import { leftToRelease, progressEnding } from "../finale-model.ts";
import { REALISM_LINES } from "../gym-day.ts";
import {
  doneItems,
  evidenceLine,
  formatMinutes,
  ladderRungs,
  ledger,
  ledgerCounts,
  ledgerNow,
  type MilestoneRow,
  milestoneEvidence,
  milestoneTimeline,
  practiceTime,
  sourceUnit,
  unitProgress,
} from "../progress-model.ts";
import { sideLessonsLine } from "../side-lessons.ts";
import { restsLine, streakLine, weekStatusLabel } from "../streak-model.ts";
import { itemTitle } from "../titles.ts";
import { EndingEntry } from "./ProgressWave6.tsx";
import { CourseEndCard, TracksProgressCard } from "./ProgressWave7.tsx";

const AREAS = ["hear", "read", "write", "compose", "transcribe", "sing", "code"] as const;
const AREA_LABEL: Record<(typeof AREAS)[number], string> = {
  hear: "Hear",
  read: "Read",
  write: "Write",
  compose: "Compose",
  transcribe: "Transcribe",
  sing: "Sing",
  code: "Code",
};
const STATUS_TONE: Record<CanDoEntry["status"] | "not-yet", ChipTone> = {
  "not-yet": "neutral",
  emerging: "amber",
  solid: "accent",
  strong: "accent",
  fading: "neutral",
};
const CP_LABEL = {
  locked: "checkpoint ahead",
  open: "checkpoint open",
  passed: "checkpoint passed",
  "soft-passed": "checkpoint passed",
  failed: "checkpoint: retake open",
} as const;

function CourseCard() {
  const content = useContent();
  const course = useCourseProgress();
  const plan = useTodayPlan();
  const gymOpen = useGymOpen(plan.data ?? null);
  const side = useSideLessons();
  if (course.isError) return <ErrorState error={course.error} onRetry={() => void course.refetch()} />;
  if (!course.data || !content.data?.syllabus) return <LoadingState rows={3} label="Loading the course" />;
  const units = unitProgress(content.data.syllabus, course.data);
  // Track A (contracts §9.6): the side lessons taken, from the course count or, before it, the side-lesson list.
  const sideCount =
    course.data.sideLessons ??
    (side.data
      ? {
          done: side.data.items.filter((i) => i.status === "done").length,
          total: side.data.items.length,
        }
      : null);
  const sideLine = sideLessonsLine(sideCount, side.data?.open ?? null);
  const shown = units.filter((u, i) => u.done > 0 || u.inProgress || i < 3);
  const edge = courseEdge(
    course.data,
    content.data.syllabus,
    new Set(content.data.lessons.map((l) => l.id as string)),
    plan.data ?? null,
  );
  return (
    <Card className="p-4" data-testid="progress-course">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-h3">The course</h2>
        <span className="text-sm text-text-2">
          {course.data.mapDone} of {course.data.mapTotal} sessions on the map
        </span>
      </div>
      {edge && (
        <div
          className="mb-3 rounded-control border border-accent/40 bg-lane-in px-3 py-2"
          data-testid="progress-edge"
        >
          <p className="font-medium">You have reached the edge of what's written.</p>
          <p className="text-sm text-text-2">
            {edgeLead(edge, { gym: gymOpen })}{" "}
            <Link to="/practice" className="text-link underline-offset-2 hover:underline">
              Practice
            </Link>{" "}
            and{" "}
            <Link to="/studio" className="text-link underline-offset-2 hover:underline">
              Studio
            </Link>{" "}
            are open any time.
          </p>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {shown.map((u) => (
          <li key={u.unitId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
            <span className="truncate">
              <span className="text-text-3">{u.unitId}</span> {u.title}
            </span>
            <span className="text-sm text-text-2">
              {u.done} of {u.total} lessons
              {edge?.nextUnit?.id === u.unitId
                ? " · being written"
                : u.checkpoint
                  ? ` · ${CP_LABEL[u.checkpoint.status]}`
                  : ""}
            </span>
            <Progress
              value={u.done}
              max={u.total}
              label={`${u.unitId}: ${u.done} of ${u.total} lessons`}
              className="col-span-2"
            />
          </li>
        ))}
      </ul>
      {sideLine && (
        <p className="mt-3 text-sm text-text-2" data-testid="progress-side-lessons">
          {sideLine}{" "}
          <span className="text-text-3">They count in the sound-design track, never in the core map.</span>
        </p>
      )}
      {shown.length < units.length && (
        <Link
          to="/oak"
          search={{ view: "course" }}
          className="mt-3 inline-block text-sm text-link underline-offset-2 hover:underline"
        >
          The whole course map
        </Link>
      )}
    </Card>
  );
}

function Ledger() {
  const content = useContent();
  const report = useProgressReport();
  const voice = useVoiceState();
  const course = useCourseProgress();
  const plan = useTodayPlan();
  const quiet = voice.data?.quiet === true;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  if (content.isPending || report.isPending) return <LoadingState rows={5} label="Loading the ledger" />;
  const rows = ledger(report.data.canDo);
  const order = (content.data?.syllabus?.defaultOrder ?? []) as readonly string[];
  const done = course.data ? doneItems(course.data) : new Set<string>();
  const authored = new Set((content.data?.lessons ?? []).map((l) => l.id as string));
  const next = mapNextId(course.data?.next ?? null, plan.data?.mapItemId ?? null, authored, order);
  const unitTitle = new Map(
    (content.data?.syllabus?.units ?? []).map((u) => [u.id as string, u.title] as const),
  );
  const capTitle = new Map((content.data?.capstones ?? []).map((c) => [c.id as string, c.title] as const));
  const titles = lessonTitles(content.data?.syllabus ?? null);
  const placeOf = (source: string) => {
    const unit = sourceUnit(source);
    return capTitle.get(source) ?? (unitTitle.has(unit) ? `${unit} ${unitTitle.get(unit)}` : unit);
  };
  return (
    <>
      {rows.size === 0 && (
        <Card>
          <EmptyState title="Nothing in the ledger yet">
            Each lesson adds a plain "I can…" here once you have shown it. Your first comes with your first
            loop.
          </EmptyState>
        </Card>
      )}
      {AREAS.map((area) => {
        const defs = content.data?.candos.filter((c) => c.area === area) ?? [];
        if (defs.length === 0) return null;
        const counts = ledgerCounts(defs, rows);
        // Statements from later in the course wait under "Later" (course progress decides; while it loads,
        // everything is in view).
        const split = course.data
          ? ledgerNow(defs, new Set(rows.keys()), order, done, next)
          : { now: defs.map((d) => d.id), later: [] };
        const byId = new Map(defs.map((d) => [d.id as string, d]));
        const item = (id: string) => {
          const d = byId.get(id);
          if (!d) return null;
          const e = rows.get(d.id);
          const status = e?.latest.status ?? "not-yet";
          return (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2" data-cando={d.id}>
              <span className="min-w-0">
                <span className={clsx("block", !e && "text-text-2")}>{d.statement}</span>
                <span className="block text-sm text-text-3">
                  {e
                    ? `since ${formatDate(e.firstAt, true)} · latest from ${evidenceLine(e.latest, (x) => itemTitle(x, titles))}`
                    : placeOf(d.source)}
                </span>
              </span>
              <Chip tone={STATUS_TONE[status]} className="shrink-0">
                {status === "not-yet" ? (area === "sing" && quiet ? "waits for the mic" : "not yet") : status}
              </Chip>
            </li>
          );
        };
        return (
          <Card key={area} className="p-4" data-testid={`ledger-${area}`}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 className="text-h3">{AREA_LABEL[area]}</h2>
              <span className="text-sm text-text-3" data-testid={`ledger-${area}-counts`}>
                {counts.shown} of {counts.total} shown
                {counts.shown > 0 ? ` · ${counts.solid} solid or strong` : ""}
              </span>
            </div>
            {area === "sing" && quiet && (
              <p className="mb-1 text-sm text-text-2" data-testid="ledger-sing-quiet">
                Quiet mode is on: these wait for the microphone. Nothing else does.
              </p>
            )}
            {split.now.length > 0 ? (
              <ul className="divide-y divide-border">{split.now.map(item)}</ul>
            ) : (
              <p className="text-sm text-text-2">The first of these comes later in the course.</p>
            )}
            {split.later.length > 0 && (
              <details className="mt-1 text-sm" data-testid={`ledger-${area}-later`}>
                <summary className="cursor-pointer py-1 text-text-2">
                  Later in the course ({split.later.length})
                </summary>
                <ul className="divide-y divide-border text-base">{split.later.map(item)}</ul>
              </details>
            )}
          </Card>
        );
      })}
    </>
  );
}

/** The album track behind a reached capstone milestone ("You can now compose a song." → the C2 track). */
function useMilestoneTrack(id: string): { id: string; title: string } | null {
  const album = useAlbum();
  const caps = milestoneById.get(id)?.when.capstones ?? [];
  const track = album.data?.tracks.find((t) => t.capstoneId !== null && caps.includes(t.capstoneId));
  return track ? { id: track.id, title: track.title } : null;
}

/** A milestone that a transcription ladder pass reaches counts graded passes only (wave4.md §5.4). */
function gradedOnly(id: string): boolean {
  const when = milestoneById.get(id)?.when;
  return !!when && (!!when.ladder || (when.anyOf ?? []).some((c) => !!c.ladder));
}

/** What backs a milestone (progress-model `milestoneEvidence`): each condition, met or still ahead. */
function useEvidence(id: string) {
  const content = useContent();
  const course = useCourseProgress();
  const ladder = useLadder();
  const when = milestoneById.get(id)?.when;
  if (!when || !course.data) return [];
  const titles = lessonTitles(content.data?.syllabus ?? null);
  return milestoneEvidence(when, {
    course: course.data,
    gradedPasses: ladder.data?.gradedPasses ?? null,
    titleOf: (x) => itemTitle(x, titles),
  });
}

function MilestoneItem({ m, tone }: { m: MilestoneRow; tone: "reached" | "next" | "ahead" }) {
  const track = useMilestoneTrack(m.id);
  const graded = gradedOnly(m.id);
  const evidence = useEvidence(m.id);
  return (
    <li
      className={clsx(
        "flex flex-col gap-0.5",
        tone === "next" && "rounded-control border border-accent/50 bg-lane-in px-3 py-2",
      )}
      data-milestone={m.id}
      data-state={tone}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className={clsx(tone === "ahead" ? "text-text-3" : "font-medium")}>{m.title}</span>
        <span className="shrink-0 text-sm text-text-3">
          {m.reachedAt ? formatDate(m.reachedAt, true) : tone === "next" ? "next" : ""}
        </span>
      </span>
      {tone !== "ahead" && <span className="text-sm text-text-2">{m.description}</span>}
      {tone !== "ahead" && evidence.length > 0 && (
        <ul
          className="mt-0.5 flex flex-col gap-0.5 text-sm"
          aria-label="What shows it"
          data-testid="milestone-evidence"
        >
          {evidence.map((e) => (
            <li key={e.id} className="flex items-baseline gap-1.5" data-met={e.met}>
              <span aria-hidden className={clsx("shrink-0", e.met ? "text-accent" : "text-text-3")}>
                {e.met ? "✓" : "○"}
              </span>
              <span className={clsx("min-w-0", e.met ? "text-text-2" : "text-text-3")}>
                {e.label}: {e.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
      {(graded || (track && m.reachedAt)) && tone !== "ahead" && (
        <span className="flex flex-wrap items-center gap-2 text-sm">
          {graded && (
            <Chip
              tone="neutral"
              title="Only a graded ladder pass counts: 85% or better, with nothing revealed."
              data-testid="graded-pass-flag"
            >
              Graded pass
            </Chip>
          )}
          {track && m.reachedAt && (
            <Link
              to="/album/$trackId"
              params={{ trackId: track.id }}
              className="text-link underline-offset-2 hover:underline"
            >
              On your album: {track.title}
            </Link>
          )}
        </span>
      )}
    </li>
  );
}

function Milestones({ milestones }: { milestones: readonly MilestoneRow[] }) {
  const t = milestoneTimeline(milestones);
  return (
    <div className="flex flex-col gap-3">
      {t.reached.length === 0 && t.next && (
        <p className="text-sm text-text-2">None reached yet. The first comes with your first album track.</p>
      )}
      {t.reached.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label="Reached">
          {t.reached.map((m) => (
            <MilestoneItem key={m.id} m={m} tone="reached" />
          ))}
        </ol>
      )}
      {t.next && (
        <ol aria-label="Next">
          <MilestoneItem m={t.next} tone="next" />
        </ol>
      )}
      {t.ahead.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-text-2">Later ({t.ahead.length})</summary>
          <ol className="mt-2 flex flex-col gap-1.5">
            {t.ahead.map((m) => (
              <MilestoneItem key={m.id} m={m} tone="ahead" />
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

/**
 * The transcription ladder (contracts §2.9): where the learner stands, and what each rung lets them say. Shown once
 * the gym is open (U07.L01); a rung is reached by a graded pass only.
 */
function LadderCard() {
  const ladder = useLadder();
  const gym = useGymPlan();
  if (!ladder.data) return null;
  const passes = Object.values(ladder.data.gradedPasses).some((n) => n > 0);
  if (!gym.data?.active && ladder.data.history.length === 0 && !passes) return null;
  const rungs = ladderRungs(ladder.data);
  const r = ladder.data.realism as 0 | 1 | 2 | 3 | 4;
  return (
    <Card className="p-4" data-testid="progress-ladder">
      <h2 className="mb-1 text-h3">Transcription ladder</h2>
      <p className="mb-3 text-sm text-text-2">
        Level {ladder.data.level} at R{r}: {REALISM_LINES[r]}.
      </p>
      <ol className="flex flex-col gap-2">
        {rungs.map((g) => (
          <li
            key={g.level}
            className={clsx(
              "flex flex-col gap-0.5",
              g.current && "rounded-control border border-accent/50 bg-lane-in px-3 py-2",
            )}
            data-rung={g.level}
            data-state={g.reached ? "reached" : g.current ? "current" : "ahead"}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className={clsx(g.reached || g.current ? "font-medium" : "text-text-3")}>
                L{g.level} · {g.name}
              </span>
              <span className="shrink-0 text-sm text-text-3">
                {g.passes > 0
                  ? `${g.passes} graded ${g.passes === 1 ? "pass" : "passes"}`
                  : g.current
                    ? "your level"
                    : ""}
              </span>
            </span>
            {g.reached && (
              <span className="flex flex-wrap items-center gap-2 text-sm text-text-2">
                {g.claim}
                <Chip tone="accent" data-testid="graded-pass-flag">
                  Graded pass
                </Chip>
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-text-3">
        Only a graded pass counts: 85% or better with nothing revealed. Your own recordings are self-assessed
        and sit in Transcribe.
      </p>
    </Card>
  );
}

function TimeCard({ days, today }: { days: Parameters<typeof practiceTime>[0]; today: string }) {
  const t = practiceTime(days, today);
  const stats = [
    { label: "This week", value: formatMinutes(t.last7) },
    { label: "Last 4 weeks", value: formatMinutes(t.last28) },
    { label: "This year", value: formatMinutes(t.totalMinutes) },
    { label: "Days practised", value: String(t.daysPractised) },
  ];
  return (
    <Card className="p-4" data-testid="progress-time">
      <h2 className="mb-2 text-h3">Time practised</h2>
      <dl className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-sm text-text-2">{s.label}</dt>
            <dd className="font-display text-h3 tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-text-3">Active time only: a pause or an idle minute is not counted.</p>
      <Link
        to="/progress/sessions"
        className="mt-2 inline-block text-sm text-link underline-offset-2 hover:underline"
        data-testid="progress-sessions-link"
      >
        Your sessions: time taken against the plan
      </Link>
    </Card>
  );
}

export function ProgressPage() {
  usePageTitle("Progress");
  const report = useProgressReport();
  const streak = useStreak(52);
  const lastClosed = streak.data?.weeks.filter((w) => w.status !== "open").at(-1) ?? null;
  const boot = useBootstrap();
  const today = boot.data?.day ?? null;
  // Wave 6: where the core stands (`CourseProgress.core`). Once its lessons are done there is no map left to
  // estimate: the pace line gives way to what is left to release, then to nothing (END.md `progress`).
  const course = useCourseProgress();
  const core = course.data?.core ?? "in-progress";
  const completion = useCompletionWhen(core);
  const ending = progressEnding(completion.data);
  const left = leftToRelease(completion.data);
  // Wave 7: once the core is complete, the whole course (the tracks) is what a pace can still estimate. The count
  // is the core's 185 and each track's own (`TrackState.sessionsDone`); `course.whole` is read once it is complete.
  const whole = useWholeCourseWhen({ course: course.data?.course });
  const courseEnd = courseEndEntry(whole.data);
  const coursePace =
    core === "complete"
      ? coursePaceLine(
          whole.data ?? {
            stage: course.data?.course ?? "in-progress",
            sessionsDone:
              COURSE_SESSIONS.core + (course.data?.tracks ?? []).reduce((n, t) => n + t.sessionsDone, 0),
            sessionsTotal: COURSE_SESSIONS.total,
          },
          report.data?.paceEstimate?.sessionsPerWeek ?? null,
          today,
          formatMonth,
        )
      : null;
  return (
    <Page>
      <PageHeader
        title="Progress"
        sub={
          core === "lessons-done"
            ? (left ?? "The lessons of the core are done.")
            : core === "complete" && coursePace
              ? coursePace
              : core !== "complete" && report.data?.paceEstimate
                ? `At ${report.data.paceEstimate.sessionsPerWeek} sessions a week you'll finish the core around ${formatMonth(report.data.paceEstimate.coreDoneBy)}.`
                : "What you can do now, in plain words."
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-label="Course and can-do ledger" className="flex flex-col gap-4 lg:col-span-2">
          {courseEnd && <CourseEndCard entry={courseEnd} />}
          {ending && <EndingEntry ending={ending} />}
          <CourseCard />
          <TracksProgressCard />
          <span id="ledger" className="-mt-4" />
          <Ledger />
        </section>
        <aside className="flex flex-col gap-4" aria-label="Time, rhythm and milestones">
          {streak.data && today ? (
            <TimeCard days={streak.data.days} today={today} />
          ) : streak.isError ? null : (
            <Skeleton className="h-32 w-full" />
          )}
          <Card className="p-4" data-testid="progress-rhythm">
            <h2 className="mb-2 text-h3">Weekly rhythm</h2>
            {streak.data ? (
              <>
                <p className="mb-2 text-sm text-text-2">
                  {streakLine(streak.data.summary, lastClosed)} · longest {streak.data.summary.longestWeeks}
                  {restsLine(streak.data.summary) ? ` · ${restsLine(streak.data.summary)}` : ""}
                </p>
                {streak.data.weeks.length === 0 ? (
                  <p className="text-sm text-text-3">Your first week fills in as you practise.</p>
                ) : (
                  <ol aria-label="Weeks, oldest first" className="flex flex-wrap gap-1">
                    {streak.data.weeks.map((w) => (
                      <li
                        key={w.weekStart}
                        title={`Week of ${w.weekStart}: ${w.qualifyingDays} of ${w.goal} days, ${weekStatusLabel(w)}`}
                        className={clsx(
                          "size-3.5 rounded-sm",
                          w.status.startsWith("met")
                            ? "bg-accent"
                            : w.status === "paused"
                              ? "bg-surface-2"
                              : w.status === "open" || w.status === "tie-open"
                                ? "border border-accent/60"
                                : "bg-border",
                        )}
                      >
                        <span className="sr-only">
                          Week of {w.weekStart}: {weekStatusLabel(w)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : streak.isError ? (
              <ErrorState error={streak.error} onRetry={() => void streak.refetch()} />
            ) : (
              <Skeleton className="h-16 w-full" />
            )}
          </Card>
          <LadderCard />
          <Card className="p-4" data-testid="progress-milestones">
            <h2 className="mb-2 text-h3">Milestones</h2>
            {report.data ? (
              report.data.milestones.length === 0 ? (
                <p className="text-sm text-text-2">The course defines no milestones yet.</p>
              ) : (
                <Milestones milestones={report.data.milestones} />
              )
            ) : report.isError ? (
              <ErrorState error={report.error} onRetry={() => void report.refetch()} />
            ) : (
              <Skeleton className="h-20 w-full" />
            )}
          </Card>
        </aside>
      </div>
    </Page>
  );
}
