// The Coda (contracts §9.3, ux §1.5): only cards whose state changed today — the sketch saved, what you can now
// do, tools unlocked (with "Try it" in Studio), skills that moved on the Oak, a tolerance change, the weekly
// rhythm — then Claude's listening note (on demand; automatic in the first week and after a capstone session,
// contracts §10.10), what's next, and "Done for today".
import { CF_T_GATE, type SessionSummary } from "@oak/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { ArrowRight, Ear } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { unitSongs } from "../../../../content/unit-songs/index.ts";
import { useContent } from "../../lib/content.ts";
import { lessonTitles } from "../../lib/content-model.ts";
import { usePageTitle } from "../../lib/nav.ts";
import {
  apiQuery,
  useBootstrap,
  useCanDo,
  useCourseProgress,
  useGymPlan,
  useProgressReport,
  useSessionDay,
  useSessionSummary,
  useSideLessons,
  useSkillMap,
  useTodayPlan,
  useUnlocks,
} from "../../lib/queries.ts";
import { ownOpenSession } from "../../lib/tab-session.ts";
import { useUnitSongs } from "../../song/hooks.ts";
import { SongGrew, SongRelease, songReleasedBy } from "../../song/SongGrew.tsx";
import { askListeningNote, useTutorContext } from "../../tutor/context.ts";
import { useHotkeys } from "../../ui/keys/KeymapProvider.tsx";
import { Button, buttonClass } from "../../ui/kit/Button.tsx";
import { Card, Chip, Page, Skeleton } from "../../ui/kit/basics.tsx";
import { Callout } from "../../ui/kit/Controls.tsx";
import { LoadingState } from "../../ui/kit/QueryState.tsx";
import { useFocusHeaderContent } from "../../ui/shell/focus-header.ts";
import { capstoneDay } from "../capstone-day.ts";
import { cftAfterLine, cftNextLabel, cftOpenedBy } from "../cft-day.ts";
import {
  autoListen,
  canDoBelow,
  canDoChanges,
  canNowLines,
  goalGradient,
  gymNextLabel,
  LEVEL_LABEL,
  skillMoves,
  TOLERANCE_LINE,
  todayLines,
  tomorrowLine,
  toolCards,
} from "../coda-model.ts";
import { isCourseEnding } from "../course-end.ts";
import { useCapstoneDef, useCompletionWhen } from "../day-hooks.ts";
import { courseEdge, edgeShort, mapNextId } from "../edge.ts";
import { isEnding, leftToRelease, openList } from "../finale-model.ts";
import { useLastEnded, useRunnerNavigator, useRunnerView } from "../hooks.ts";
import { sessionRunner } from "../live.ts";
import type { EndedRecord } from "../persist.ts";
import { milestonesReached, statusesBefore } from "../progress-model.ts";
import { sideLessonPlan, sideOffer } from "../side-lessons.ts";
import { useSession } from "../store.ts";
import { goalLine, streakLine } from "../streak-model.ts";
import { itemTitle as titleOf } from "../titles.ts";
import { useNextUnlockList } from "../today/Glance.tsx";
import { InlineCodeText, SideOfferLine } from "../today/SideOffer.tsx";
import { WeeklyRhythm } from "../today/WeeklyRhythm.tsx";
import { toolName as toolLabel } from "../tool-name.ts";
import { nextLine } from "../tracks-day.ts";
import { CodaUnlock } from "./CodaUnlock.tsx";
import { LadderCard, OwnAudioCard, ReleaseCard } from "./CodaWave4.tsx";
import { CanNow, CftOpenedCard, Finale, GatesOpenedCard } from "./CodaWave6.tsx";
import { CodaCourseFinale, PlannerNext } from "./CodaWave7.tsx";

/** Server reads that a finished session changes. */
const SESSION_ENDED_KEYS = [
  "bootstrap",
  "session.today",
  "session.day",
  "voice.get",
  "skills.map",
  "streak.get",
  "lessons.progress",
  "progress.get",
  "sketches.list",
  "unlocks.list",
  "unlocks.next",
  "cando.list",
  // Wave 6: a checkpoint or a lesson may meet a track gate; a release may complete the core.
  "tracks.list",
  "course.completion",
  // Wave 7: the whole course, the track focus and offers move with every track session.
  "course.whole",
  "tracks.focus",
  // Wave 4: a release fills an album slot; a gym session moves the ladder and the slot rule.
  "album.get",
  "album.track",
  "capstones.get",
  "capstones.sessions",
  "capstones.gate",
  "gym.plan",
  "ladder.get",
  // Unit songs: a take lesson adds a take; a checkpoint may make a song releasable.
  "songs.get",
  "songs.list",
];

const STATUS_TONE = { emerging: "amber", solid: "accent", strong: "accent", fading: "neutral" } as const;

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <Card className="p-4 animate-fade-in" data-testid={testId}>
      <h2 className="mb-2 text-h3">{title}</h2>
      {children}
    </Card>
  );
}

function SketchCard({ sketchId }: { sketchId: string }) {
  const sketch = useQuery(apiQuery("sketches.get", { params: { id: sketchId } }));
  return (
    <Section title="Sketch saved" testId="coda-sketch">
      {sketch.data ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{sketch.data.title}</span>
          <Link
            to="/studio/$sketchId"
            params={{ sketchId }}
            className="text-sm text-link underline-offset-2 hover:underline"
          >
            Open in Studio
          </Link>
        </p>
      ) : (
        <p className="text-text-2">Saved to your sketchbook.</p>
      )}
    </Section>
  );
}

function ListeningNote({ summary, sketchId }: { summary: SessionSummary; sketchId: string | null }) {
  const sketch = useQuery({
    ...apiQuery("sketches.get", { params: { id: sketchId ?? "" } }),
    enabled: !!sketchId,
  });
  const availability = useTutorContext((s) => s.availability);
  const asked = useRef(false);
  const code = sketch.data?.versions.find((v) => v.version === sketch.data?.currentVersion)?.code ?? null;
  const ask = () => {
    if (!sketchId || !code || !sketch.data) return;
    asked.current = true;
    askListeningNote({ sketchId, title: sketch.data.title, code });
  };
  // Automatic only in the first 7 days and after a capstone session (contracts §10.10); it never blocks.
  useEffect(() => {
    if (asked.current || availability !== "ready" || !code) return;
    if (autoListen(summary.listeningNote, sketchId)) ask();
  });
  if (summary.listeningNote === "off" || !sketchId) return null;
  return (
    <Section title="Claude's listening note" testId="coda-listen">
      <div className="flex flex-wrap items-center gap-3">
        {summary.listeningNote === "auto" ? (
          <p className="text-text-2">
            Claude is listening to your sketch; the note appears in the tutor panel.
          </p>
        ) : (
          <Button
            variant="secondary"
            onClick={ask}
            disabled={!code}
            icon={<Ear aria-hidden className="size-4" />}
            data-testid="ask-listen"
          >
            Ask Claude to listen
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-text-3">Claude reads your code and score, never your audio.</p>
    </Section>
  );
}

function CodaBody({ summary, ended }: { summary: SessionSummary; ended: EndedRecord | null }) {
  const content = useContent();
  const map = useSkillMap();
  const course = useCourseProgress();
  const next = useNextUnlockList();
  const titles = lessonTitles(content.data?.syllabus ?? null);
  const name = (id: string) => content.data?.skills.nodes.find((n) => n.id === id)?.name ?? id;
  // This browser's record of the session (its baseline and block reports) belongs to it only when the ids
  // agree; a Coda opened elsewhere (another browser, after "Done for today") reads the server alone: the can-do
  // statuses before the session come from the ledger's history, and the skill moves (no history) are left out.
  const own = ended && ended.sessionId === summary.session.id ? ended : null;
  const ledger = useCanDo();
  const reports = own?.reports ?? [];
  const lines = todayLines(reports, (id) => titleOf(id, titles), summary.sketchesSaved.length);
  const before = own
    ? new Map(own.baseline.canDo)
    : statusesBefore(ledger.data?.items ?? [], summary.session.startedAt);
  const candoAll = canDoChanges(summary.canDo, before, content.data?.candos ?? []);
  const tools = toolCards(summary.unlocks, content.data?.toolbox ?? []);
  const moves = map.data && own ? skillMoves(new Map(own.baseline.levels), map.data.nodes, name) : [];
  const report = useProgressReport();
  // The day the core is completed (END.md): the finale section says the milestone ms.07 itself, once, in place of
  // the day's banner, can-do card, tree card and teaser.
  // Wave 7: the day the WHOLE course is completed (wave7.md §5.8) is its own ending; it takes the place of the core's
  // when one session finished both (the core done last).
  const courseEnd = isCourseEnding(summary);
  const ending = isEnding(summary) && !courseEnd;
  const finale = ending || courseEnd;
  const endingMilestone = summary.coreComplete?.milestone?.id ?? null;
  const reached = (
    report.data ? milestonesReached(report.data.milestones, summary.session.startedAt) : []
  ).filter((m) => !(ending && m.id === endingMilestone) && !(courseEnd && m.id === "ms.28"));
  // What the learner can now do, said first (U12–U17 specs): the statements of the lesson finished today, or of
  // the capstone released today. `completed` is this browser's own report, else the server's course progress.
  const mainId = summary.session.mapItemId;
  const mainReport = reports.find((r) => r.block === "new");
  const capOfMain = mainId ? (/^(.+)\.S(\d+)$/.exec(mainId) ?? null) : null;
  const capStatus = capOfMain ? course.data?.capstones.find((c) => c.capstoneId === capOfMain[1]) : undefined;
  const mainCompleted = capOfMain
    ? capStatus?.status === "released" && Number(capOfMain[2]) >= (capStatus?.sessionsTotal ?? 99)
    : mainReport && mainReport.block === "new"
      ? mainReport.completed
      : course.data?.lessons.find((l) => l.lessonId === mainId)?.status === "completed";
  const canNow =
    summary.session.kind === "lesson" || summary.session.kind === "capstone"
      ? canNowLines({ id: mainId, completed: mainCompleted === true }, content.data?.candos ?? [])
      : [];
  const cando = canDoBelow(candoAll, canNow);
  const cftOpened = cftOpenedBy(
    summary.session,
    mainCompleted === true,
    course.data?.capstones.find((c) => c.capstoneId === "CF-T"),
    CF_T_GATE,
  );
  // The next map item, never a lesson nobody has written yet: past the written course the next day is a review
  // day, and the Coda says so (edge.ts).
  const plan = useTodayPlan();
  const authored = new Set((content.data?.lessons ?? []).map((l) => l.id as string));
  const nextId = mapNextId(
    course.data?.next ?? null,
    plan.data?.mapItemId ?? null,
    authored,
    content.data?.syllabus?.defaultOrder,
  );
  const edge = courseEdge(course.data, content.data?.syllabus ?? null, authored, plan.data ?? null);
  // A capstone session reads with its place and goal ("C4 Minor Indie Ballad · session 2 of 2: Chorus
  // cadence"), and a transcription slot due first is named before the lesson it delays.
  // The planner's own next session first (Wave 7), else the map's next item.
  const capstoneOf = (id: string | null | undefined) =>
    id && !id.startsWith("GYM.") ? (/^(.+)\.S\d+$/.exec(id)?.[1] ?? null) : null;
  const nextCapstone =
    (summary.next?.kind === "capstone" ? capstoneOf(summary.next.mapItemId) : null) ?? capstoneOf(nextId);
  const nextCapDef = useCapstoneDef(nextCapstone);
  const gymPlan = useGymPlan();
  const cftDef = useCapstoneDef(gymPlan.data?.cfT?.takesSlot ? "CF-T" : null);
  // Once the lessons of the core are done: what is left, or (complete) what is open next.
  const core = plan.data?.core ?? course.data?.core;
  const completion = useCompletionWhen(ending ? null : core);
  const coreLeft = leftToRelease(completion.data);
  const nextTitle = nextId
    ? ((nextCapDef
        ? capstoneDay({ kind: "capstone", mapItemId: nextId as never, title: "" }, nextCapDef, null, null)
            ?.detail
        : null) ?? titleOf(nextId, titles))
    : null;
  // A transcription slot due first: CF-T's next session while the standard is open, else the gym.
  const slotLabel =
    cftNextLabel(gymPlan.data, (id) => cftDef?.sessionDefs.find((d) => d.id === id)?.title ?? null) ??
    gymNextLabel(gymPlan.data, nextId);
  const afterCoreNext =
    core === "complete" && completion.data
      ? (openList(completion.data.open).tomorrow?.replace(/^Tomorrow:/, "Next time:") ?? null)
      : null;
  // Carry f6: the planner's real next session when the server sends it (Wave 7); `null` means nothing is planned (the
  // whole course complete, nothing due) and the Coda shows no next line. An older server: the Wave 6 line below.
  const planned =
    summary.next === undefined
      ? undefined
      : nextLine(
          summary.next,
          (id) => titleOf(id, titles),
          (id) =>
            nextCapDef && capstoneOf(id) === nextCapDef.id
              ? (capstoneDay({ kind: "capstone", mapItemId: id as never, title: "" }, nextCapDef, null, null)
                  ?.detail ?? null)
              : null,
        );
  const composed =
    edge && !summary.teaser
      ? `Next time: a review day. ${edgeShort(edge)}.`
      : (tomorrowLine(summary, nextId && nextTitle ? { id: nextId, title: nextTitle } : null, slotLabel) ??
        afterCoreNext);
  const tomorrow = planned === undefined ? composed : summary.teaser ? composed : null;
  // After one of the standard's first three sessions: when it comes back, and what it asks then.
  const cftAfter = cftAfterLine(
    summary.session.kind === "capstone" ? summary.session.mapItemId : null,
    course.data?.capstones.find((c) => c.capstoneId === "CF-T")?.status === "released",
  );
  const nextObjective =
    !edge && nextId
      ? (content.data?.syllabus?.units.flatMap((u) => u.lessons).find((l) => l.id === nextId)?.objective ??
        null)
      : null;
  // "One more, if you like" (wave5.md §5.1): the optional side lesson, once today's planned session has ended.
  const sideLessons = useSideLessons();
  const side =
    plan.data && !wrappedEarly(own, reports)
      ? sideOffer(plan.data, sideLessons.data ?? null, {
          done: true,
          titleOf: (id) => titleOf(id, titles),
        })
      : null;
  const starting = useRunnerView((v) => v.starting);
  const gradient = next.items?.[0];
  const gradientTool = gradient ? content.data?.toolbox.find((t) => t.id === gradient.itemId) : undefined;
  const wrapped = wrappedEarly(own, reports);

  // The unlock ceremony (ux §5.1) plays here once for the tools not seen yet, judged by the live unlock list so a
  // reload does not replay it; the moment marks them seen (they stay replayable from the Toolbox).
  const unlocks = useUnlocks();
  const [moment, setMoment] = useState<readonly string[] | null>(null);
  const refetched = useRef(false);
  useEffect(() => {
    if (moment !== null || !unlocks.data || unlocks.isFetching) return;
    const listed = new Map(unlocks.data.items.map((u) => [u.itemId as string, u.seen]));
    // A list from before the session ended does not know today's unlocks yet: read it again first.
    if (!refetched.current && summary.unlocks.some((u) => !listed.has(u.itemId))) {
      refetched.current = true;
      void unlocks.refetch();
      return;
    }
    setMoment(summary.unlocks.filter((u) => listed.get(u.itemId) === false).map((u) => u.itemId));
  }, [moment, unlocks, summary.unlocks]);
  const ceremony = moment !== null && moment.length > 0;
  const releaseUnit = songReleasedBy(summary.session.mapItemId, unitSongs);
  // "Next unlock: … → Album" is not said once the album already holds (or is offered today) a song: the learner just
  // put a track on it, and the line would read as though the album were still locked.
  const songs = useUnitSongs();
  const songOnAlbum = releaseUnit !== null || (songs.data?.items ?? []).some((s) => s.releases.length > 0);
  const nextUnlock = gradient && !(gradient.itemId === ALBUM_TOOL && songOnAlbum) ? gradient : undefined;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-h1" data-testid="coda-title">
          {wrapped ? "A good place to stop." : "Session complete."}
        </h1>
        {lines.length > 0 && (
          <p className="mt-1 text-text-2" data-testid="coda-today">
            Today you: {lines.join(" · ")}
          </p>
        )}
        {!finale && <CanNow lines={canNow} />}
      </header>

      {/* The Coda of session 259 shows what the learner made and can now do before anything else (wave7.md §10
          item 23; review:journey: it sat under the release card and the sketch, below the fold at 1280×800). */}
      {courseEnd && summary.courseComplete && <CodaCourseFinale snapshot={summary.courseComplete} />}

      <ReleaseCard session={summary.session} />

      {/* Unit songs (spec 2026-11-24 §5.5 "Coda"): a take lesson's Make grew the unit's song; any other sketch is a
          sketch. The day that completes a song's release point (a checkpoint) offers the release. */}
      {summary.sketchesSaved[0] &&
        (summary.session.kind === "lesson" && summary.session.mapItemId ? (
          // SongGrew shows the release point's Release card itself, under the song or the sketch card.
          <SongGrew
            lessonId={summary.session.mapItemId}
            sketchIds={summary.sketchesSaved}
            release={releaseUnit}
            fallback={<SketchCard sketchId={summary.sketchesSaved[0]} />}
            // The card's room while the song is read after the save, so the sketch card does not show and then
            // swap for the song under the learner's eyes (the lesson recap holds the same room).
            pending={<Skeleton className="h-[28rem] w-full rounded-card" />}
          />
        ) : (
          <SketchCard sketchId={summary.sketchesSaved[0]} />
        ))}
      {releaseUnit &&
        !(summary.session.kind === "lesson" && summary.session.mapItemId && summary.sketchesSaved[0]) && (
          <SongRelease unitId={releaseUnit} />
        )}

      <LadderCard session={summary.session} gym={summary.gym} />
      <OwnAudioCard session={summary.session} gym={summary.gym} />

      {ending && summary.coreComplete && (
        <Finale completion={summary.coreComplete} since={summary.session.startedAt} />
      )}
      {cando.length > 0 && !finale && (
        <Section title="What you can do now" testId="coda-cando">
          <ul className="flex flex-col gap-2">
            {cando.map((c) => (
              <li key={c.candoId} className="flex flex-wrap items-center justify-between gap-2">
                <span>{c.statement}</span>
                <span className="flex items-center gap-1.5 text-sm">
                  {c.from && (
                    <>
                      <Chip tone={STATUS_TONE[c.from]}>{c.from}</Chip>
                      <ArrowRight aria-label="now" className="size-3.5 text-text-3" />
                    </>
                  )}
                  <Chip tone={STATUS_TONE[c.to]}>{c.to}</Chip>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {reached.map((m) => (
        <section
          key={m.id}
          aria-label="Milestone"
          className="rounded-card border border-accent/50 bg-lane-in px-5 py-4 animate-fade-in"
          data-testid="coda-milestone"
        >
          <p className="text-sm text-text-2">Milestone</p>
          <p className="font-display text-h2">{m.title}</p>
          <p className="mt-1 text-text-2">{m.description}</p>
          <Link
            to="/progress"
            className="mt-2 inline-block text-sm text-link underline-offset-2 hover:underline"
          >
            See it on your progress
          </Link>
        </section>
      ))}

      {ceremony && (
        <CodaUnlock
          toolIds={moment}
          onDone={() => {
            setMoment([]);
            // The moment is over: the next action is the Coda's own.
            requestAnimationFrame(() =>
              document.querySelector<HTMLButtonElement>('[data-testid="done-for-today"]')?.focus(),
            );
          }}
        />
      )}

      {tools.length > 0 && !ceremony && (
        <Section title="New in your toolbox" testId="coda-tools">
          <ul className="flex flex-col gap-3">
            {tools.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  {toolLabel(t).mono ? (
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">{toolLabel(t).text}</code>
                  ) : (
                    <span className="font-medium">{toolLabel(t).text}</span>
                  )}
                  {t.concept && <p className="mt-1 text-sm text-text-2">{t.concept}</p>}
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <Link to="/studio" search={{ try: t.id }} className={buttonClass("secondary", "sm")}>
                    Try it
                  </Link>
                  <Link
                    to="/toolbox/$toolId"
                    params={{ toolId: t.id }}
                    className={buttonClass("ghost", "sm")}
                  >
                    About it
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!finale && <GatesOpenedCard gates={summary.gatesOpened} />}
      {cftOpened && !ceremony && <CftOpenedCard />}

      {moves.length > 0 && !finale && (
        <Section title="On the Oak" testId="coda-oak">
          <ul className="flex flex-col gap-1.5">
            {moves.slice(0, 6).map((m) => (
              <li key={m.skillId} className="flex flex-wrap items-center justify-between gap-2">
                <span>{m.name}</span>
                <span className="text-sm text-text-2">
                  {LEVEL_LABEL[m.from]} → <span className="text-text">{LEVEL_LABEL[m.to]}</span>
                </span>
              </li>
            ))}
          </ul>
          {moves.length > 6 && <p className="mt-1 text-sm text-text-3">and {moves.length - 6} more</p>}
          <Link
            to="/oak"
            search={{ view: "tree" }}
            className="mt-2 inline-block text-sm text-link underline-offset-2 hover:underline"
          >
            Open the Oak
          </Link>
        </Section>
      )}

      {summary.toleranceChange && <Callout tone="success" title={TOLERANCE_LINE(summary.toleranceChange)} />}

      <ListeningNote summary={summary} sketchId={summary.sketchesSaved[0] ?? null} />

      <Section title="This week" testId="coda-week">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <WeeklyRhythm streak={summary.streak} today={summary.session.day} size="lg" />
          <span className="text-text-2">
            {goalLine(summary.streak)} · {streakLine(summary.streak)}
          </span>
        </div>
      </Section>

      {(tomorrow || planned || nextUnlock || coreLeft || cftAfter) && !finale && (
        <Section title="Next" testId="coda-next">
          {planned && !tomorrow && <PlannerNext next={planned} />}
          {tomorrow && <p data-testid="coda-tomorrow">{tomorrow}</p>}
          {cftAfter && (
            <p className="text-sm text-text-2" data-testid="coda-cft-after">
              {cftAfter}
            </p>
          )}
          {coreLeft && (
            <p className="text-sm text-text-2" data-testid="coda-core-left">
              {coreLeft}
            </p>
          )}
          {tomorrow && nextObjective && !summary.teaser && planned === undefined && (
            <p className="text-sm text-text-2" data-testid="coda-tomorrow-what">
              <InlineCodeText text={nextObjective} />
            </p>
          )}
          {nextUnlock && (
            <p className="text-sm text-text-2" data-testid="coda-next-unlock">
              <span className="text-text-3">Next unlock: </span>
              {goalGradient(nextUnlock, "")}
              {gradientTool && !toolLabel(gradientTool).mono ? (
                <span className="font-medium text-text">{toolLabel(gradientTool).text}</span>
              ) : (
                <code className="font-mono">
                  {gradientTool ? toolLabel(gradientTool).text : nextUnlock.itemId}
                </code>
              )}
            </p>
          )}
          {side && (
            <div className="mt-3">
              <SideOfferLine
                offer={side}
                disabled={starting}
                onStart={() => {
                  if (!plan.data) return;
                  const p = sideLessonPlan(plan.data, side);
                  sessionRunner.finish(null);
                  void sessionRunner.start(p).catch(() => {});
                }}
              />
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

/** The session stopped before its New block was complete (Save & wrap, or left part-way). */
function wrappedEarly(own: EndedRecord | null, reports: EndedRecord["reports"]): boolean {
  return own?.wrappedEarly === true || reports.some((r) => r.block === "new" && !r.completed);
}

/** A record from an earlier day is not today's Coda. */
function endedToday(e: EndedRecord, today: string): boolean {
  return e.day === today || (e.summary?.session.day ?? e.day) === today;
}

/** The Album's toolbox item (content/toolbox.ts): its unlock line steps aside once a song is on the album. */
const ALBUM_TOOL = "tb.feature.album";

export function CodaPage() {
  usePageTitle("Coda");
  useFocusHeaderContent("Coda");
  useRunnerNavigator();
  const navigate = useNavigate();
  const boot = useBootstrap();
  const today = useTodayPlan();
  const status = useRunnerView((v) => v.status);
  const liveSummary = useRunnerView((v) => v.summary);
  const endError = useRunnerView((v) => v.endError);
  const ended = useLastEnded();
  const inSession = useSession((s) => s.session !== null);
  // Another browser, or this one after its record was cleared: the server's last planned session today.
  const day = useSessionDay();
  // This browser's record is today's Coda when it ended today — or when the server says that session is
  // today's last (one begun before the 04:00 rollover and ended after it belongs to the new day).
  const localSummary =
    ended?.summary &&
    (!boot.data || endedToday(ended, boot.data.day) || day.data?.summarySessionId === ended.sessionId)
      ? ended.summary
      : null;
  const serverId = !liveSummary && !localSummary && !inSession ? (day.data?.summarySessionId ?? null) : null;
  const fromServer = useSessionSummary(serverId);
  const summary = liveSummary ?? localSummary ?? fromServer.data ?? null;
  const doneRef = useRef<HTMLButtonElement>(null);

  // A reload with nothing saved here: resume the open session (it reaches the Coda again), or go home.
  const waitingForServer = day.isPending || (serverId !== null && fromServer.isPending);
  useEffect(() => {
    if (summary || inSession || sessionRunner.active() || !boot.data || !today.data) return;
    if (waitingForServer && !day.isError) return;
    // d21: the session this tab left open, never another tab's.
    const open = ownOpenSession(day.data);
    if (open && open.day === boot.data.day) void sessionRunner.resume(open, today.data).catch(() => {});
    else void navigate({ to: "/", replace: true });
  }, [summary, inSession, boot.data, today.data, navigate, waitingForServer, day.data, day.isError]);

  // The session is over on the server: what Today, the map and Progress show has changed.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!summary) return;
    // Focus the next action without scrolling to it: the Coda is read from the top (the ending is three screens long;
    // its heading and the record come first). Enter is "Done for today" wherever the page stands.
    doneRef.current?.focus({ preventScroll: true });
    for (const key of SESSION_ENDED_KEYS) void queryClient.invalidateQueries({ queryKey: ["api", key] });
  }, [summary, queryClient]);

  const done = () => sessionRunner.finish();
  useHotkeys([
    {
      id: "coda-done",
      keys: "Enter",
      scope: "global",
      group: "Coda",
      description: "Done for today",
      when: (c) => !c.onControl && !c.inEditable && summary !== null,
      run: done,
    },
  ]);

  return (
    <Page width="narrow">
      {summary ? (
        <>
          <CodaBody summary={summary} ended={ended} />
          <div className={clsx("mt-6 flex flex-wrap items-center gap-2")}>
            <Button ref={doneRef} variant="primary" size="lg" onClick={done} data-testid="done-for-today">
              Done for today <kbd className="ml-1 font-mono text-[0.75rem] opacity-70">⏎</kbd>
            </Button>
            <Link
              to="/studio"
              className={buttonClass("secondary", "lg")}
              onClick={() => sessionRunner.finish(null)}
            >
              Keep playing in Studio
            </Link>
          </div>
          <p className="mt-3 text-sm text-text-3">Stopping here is good practice: spacing beats cramming.</p>
        </>
      ) : status === "end-failed" ? (
        <Callout
          tone="issue"
          title="The session didn't close"
          actions={
            <Button size="sm" variant="primary" onClick={() => sessionRunner.retryEnd()}>
              Try again
            </Button>
          }
        >
          {endError ?? "The server didn't answer."} Everything you did is saved.
        </Callout>
      ) : (
        <LoadingState rows={4} label="Closing the session" />
      )}
    </Page>
  );
}
