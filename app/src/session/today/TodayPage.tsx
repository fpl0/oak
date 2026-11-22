// Today (ux §1.4): one decision — start the session — with enough around it to make returning worthwhile: the
// setlist from the server's plan, the weekly rhythm (rests, ties, goal weeks), the next unlock, the Oak and the
// album at a glance, the last sketch and Claude's one-line note. States: first run, a session open, done for
// today, a paused week, a free rest day, welcome back (3+ days), a light session (10+), checkpoint, capstone,
// gym and review days (today-model.ts). Wave 4: a capstone day names its session ("session 2 of 2: Melody",
// capstone-day.ts); a gym day explains the transcription slot (gym-day.ts); "Two more gym sets open X1" while X1
// waits on melodic dictation; an extra gym session and an open capstone start from "Other ways today".
import { OakApiError, type SessionPlan } from "@oak/api";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Ear, Leaf, Play } from "lucide-react";
import { useContent } from "../../lib/content.ts";
import { lessonTitles } from "../../lib/content-model.ts";
import { usePageTitle } from "../../lib/nav.ts";
import {
  useBootstrap,
  useCourseProgress,
  useOnboarding,
  useProfileUpdate,
  useSessionDay,
  useSetTrackFocus,
  useSideLessons,
  useStreak,
  useTodayPlan,
  useTutorWarm,
  useVoiceLadder,
  useVoiceState,
} from "../../lib/queries.ts";
import { routeOfItem } from "../../lib/session-route.ts";
import { ownOpenSession } from "../../lib/tab-session.ts";
import { useHotkeys } from "../../ui/keys/KeymapProvider.tsx";
import { Button, buttonClass } from "../../ui/kit/Button.tsx";
import { Card, Chip, Page, Skeleton } from "../../ui/kit/basics.tsx";
import { Callout } from "../../ui/kit/Controls.tsx";
import { ErrorState, LoadingState } from "../../ui/kit/QueryState.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { capstoneDayTitle, keepCapstone } from "../capstone-day.ts";
import { afterCourse } from "../course-end.ts";
import {
  useAfterCore,
  useCapstoneDay,
  useCapstoneInProgress,
  useCftDay,
  useGymDay,
  useGymOpen,
  useWaitingLine,
  useWholeCourseWhen,
  useX1Gate,
} from "../day-hooks.ts";
import { type CourseEdge, courseEdge, edgeShort } from "../edge.ts";
import { alternativePlan, extraGym, type GymDay, x1Line } from "../gym-day.ts";
import { useLastEnded, useRunnerNavigator, useRunnerView } from "../hooks.ts";
import { sessionRunner } from "../live.ts";
import { sideLessonPlan } from "../side-lessons.ts";
import { daysLine, goalLine, repairLine, restsLine, streakLine } from "../streak-model.ts";
import { itemTitle as titleOf } from "../titles.ts";
import {
  keepAlivePlan,
  learnerObjective,
  looserTolerance,
  type SetlistRow,
  type TodayView,
  todayView,
} from "../today-model.ts";
import { type OfferRow, offerPlan, offersFromTracks, trackDay } from "../tracks-day.ts";
import { AlbumStrip, LastSketchCard, NextUnlockCard, OakGlanceCard } from "./Glance.tsx";
import { InlineCodeText, SideOfferLine } from "./SideOffer.tsx";
import { CftStrip, FirstDayLine, OpenToYou, OtherTabLine, TracksLine } from "./TodayWave6.tsx";
import { CourseFirstDayLine, KeepPlayingLine, TrackOffers, TrackSessionLine } from "./TodayWave7.tsx";
import { WeeklyRhythm } from "./WeeklyRhythm.tsx";

function amountOf(r: SetlistRow): string {
  return r.unit === "s" ? `${r.amount} s` : `${r.amount} min`;
}

function Setlist({ rows }: { rows: SetlistRow[] }) {
  return (
    <ol className="flex flex-col divide-y divide-border" data-testid="setlist">
      {rows.map((r, i) => (
        <li key={r.key} className="flex gap-4 py-3" data-row={r.key}>
          <span aria-hidden className="w-5 shrink-0 text-right font-display text-h3 leading-6 text-text-3">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {r.label} <span className="font-normal text-text-2">· {amountOf(r)}</span>
            </p>
            <p className="text-text-2">{r.detail}</p>
            {r.sub && (
              <p className="text-sm text-text-3" data-testid="setlist-sub">
                <InlineCodeText text={r.sub} />
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A transcription slot, explained plainly (contracts §2.5, §6.12): what you will hear and how it is judged. */
function GymExplain({ gym }: { gym: GymDay }) {
  return (
    <div
      className="mt-1 flex gap-3 rounded-control border border-border bg-surface-2 px-3 py-2.5 text-sm"
      data-testid="gym-explain"
      data-kind={gym.kind}
    >
      <Ear aria-hidden className="mt-0.5 size-4 shrink-0 text-text-3" />
      <ul className="flex flex-col gap-1 text-text-2">
        {gym.explain.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function Header({ boot }: { boot: ReturnType<typeof useBootstrap> }) {
  const streak = useStreak(2);
  const b = boot.data;
  const lastClosed = streak.data?.weeks.filter((w) => w.status !== "open").at(-1) ?? null;
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-h1">
          {b
            ? new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(`${b.day}T12:00:00`))
            : "Today"}
        </h1>
        <p className="text-sm text-text-2">{b ? daysLine(b.streak) : " "}</p>
      </div>
      {b ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <WeeklyRhythm streak={b.streak} today={b.day} />
          <div className="flex flex-col">
            <span className="text-sm text-text-2" data-testid="goal-line">
              {goalLine(b.streak)}
            </span>
            {restsLine(b.streak) && <span className="text-sm text-text-3">{restsLine(b.streak)}</span>}
          </div>
          <Chip tone="accent" title="Weeks in a row that met your weekly goal" data-testid="streak-chip">
            {streakLine(b.streak, lastClosed)}
          </Chip>
        </div>
      ) : (
        <Skeleton className="h-8 w-72" />
      )}
    </header>
  );
}

function PrimaryAction({
  view,
  plan,
  onStart,
  onResume,
  starting,
}: {
  view: TodayView;
  plan: SessionPlan;
  onStart(p: SessionPlan): void;
  onResume(): void;
  starting: boolean;
}) {
  const onboarding = useOnboarding();
  if (!view.primary) return null;
  if (view.primary.action === "onboarding")
    return (
      <Link
        to="/onboarding/$step"
        params={{ step: onboarding.data?.step ?? "welcome" }}
        className={buttonClass("primary", "lg")}
        data-testid="begin-onboarding"
      >
        {view.primary.label} <ArrowRight aria-hidden className="size-4" />
      </Link>
    );
  const resume = view.primary.action === "resume";
  return (
    <Button
      variant="primary"
      size="lg"
      loading={starting}
      onClick={() => (resume ? onResume() : onStart(plan))}
      icon={<Play aria-hidden className="size-4" />}
      data-testid="start-session"
    >
      {view.primary.label} <kbd className="ml-1 font-mono text-[0.75rem] opacity-70">⏎</kbd>
    </Button>
  );
}

function DoneCard({
  plan,
  titles,
  edge,
  hasCoda,
  onStart,
  extraGym,
  side,
  objective,
}: {
  plan: SessionPlan;
  titles: Map<string, string>;
  edge: CourseEdge | null;
  /** "One more, if you like": the side lesson offered after the core (wave5.md §5.1). */
  side: React.ReactNode;
  /** What the next lesson is for (its objective), so tomorrow reads as worth opening. */
  objective: string | null;
  /** Today's Coda can be shown (a session ended today has a summary; onboarding's Coda was its own). */
  hasCoda: boolean;
  onStart(): void;
  /** Starts an extra gym session (from U07.L01), or null. */
  extraGym: (() => void) | null;
}) {
  const next = plan.mapItemId
    ? titleOf(plan.mapItemId, titles)
    : plan.kind === "review"
      ? edge
        ? `a review day. ${edgeShort(edge)}.`
        : "a review day"
      : null;
  return (
    <div className="flex flex-col gap-4" data-testid="today-done">
      {next && (
        <p>
          <span className="text-text-2">Next time: </span>
          <span className="font-medium">
            {next}
            {plan.main?.resumeStep ? `, from step ${plan.main.resumeStep.replace(/^S/, "")}` : ""}
          </span>
          {objective && (
            <span className="block text-sm text-text-2" data-testid="today-next-what">
              <InlineCodeText text={objective} />
            </span>
          )}
        </p>
      )}
      {side}
      <div className="flex flex-wrap items-center gap-2">
        {hasCoda && (
          <Link to="/session/coda" className={buttonClass("secondary", "md")} data-testid="see-coda">
            Today's Coda
          </Link>
        )}
        <Link to="/studio" className={buttonClass("secondary", "md")}>
          Keep playing in Studio
        </Link>
        <Link to="/practice" className={buttonClass("secondary", "md")}>
          Free practice
        </Link>
        {extraGym && (
          <Button variant="secondary" onClick={extraGym} data-testid="extra-gym">
            An extra gym session
          </Button>
        )}
        <Button variant="ghost" onClick={onStart}>
          Start another session
        </Button>
      </div>
    </div>
  );
}

export function TodayPage() {
  usePageTitle("Today");
  useRunnerNavigator();
  const boot = useBootstrap();
  const plan = useTodayPlan();
  const content = useContent();
  const warm = useTutorWarm();
  const profile = useProfileUpdate();
  const setLadder = useVoiceLadder();
  const sessionDay = useSessionDay();
  const voice = useVoiceState();
  const progress = useCourseProgress();
  const sideLessons = useSideLessons();
  const ended = useLastEnded();
  // Where a learner who left onboarding half-way stands ("Carry on setting up · Step 8 of 13").
  const onboarding = useOnboarding();
  const starting = useRunnerView((v) => v.starting);
  const qc = useQueryClient();
  const titles = lessonTitles(content.data?.syllabus ?? null);
  const stepsOf = (id: string) => content.data?.lessons.find((l) => l.id === id)?.steps.length ?? null;
  const objectiveOf = (id: string) =>
    learnerObjective(
      id,
      content.data?.syllabus?.units.flatMap((u) => u.lessons).find((l) => l.id === id)?.objective ?? null,
    );
  // A capstone in progress is never interrupted by a gym slot (contracts §2.5): the plan Today runs keeps it.
  const inProgress = useCapstoneInProgress();
  const planData = plan.data ? keepCapstone(plan.data, inProgress, (id) => titleOf(id, titles)) : undefined;
  const capstone = useCapstoneDay(planData ?? null);
  const gym = useGymDay(planData ?? null);
  const gymOpen = useGymOpen(planData ?? null);
  // Wave 6: the standard in the transcription slot, and what is open once the lessons of the core are done.
  const cft = useCftDay(planData ?? null);
  const waiting = useWaitingLine(planData ?? null);
  const { after } = useAfterCore(planData ?? null, boot.data);
  const x1 = x1Line(useX1Gate());
  // Wave 7: the open tracks beside the day's session, the focus switch, and the days after the whole course.
  const setFocus = useSetTrackFocus();
  // A server whose plan has no `trackOffers` yet (Wave 6): the open tracks' own next lessons are offered instead.
  const tday = planData
    ? trackDay(
        planData.trackOffers === undefined
          ? {
              ...planData,
              trackOffers: offersFromTracks(progress.data?.tracks, {
                titleOf: (id) => titleOf(id, titles),
                objectiveOf,
                minutes: planData.targetMinutes,
              }),
            }
          : planData,
        (id) => titleOf(id, titles),
      )
    : null;
  const whole = useWholeCourseWhen(planData ?? null);
  const courseAfter =
    planData && boot.data
      ? afterCourse(planData, whole.data, {
          day: boot.data.day,
          timezone: boot.data.profile.timezone,
          rolloverHour: boot.data.profile.rolloverHour,
        })
      : null;
  const edge = courseEdge(
    progress.data,
    content.data?.syllabus ?? null,
    new Set((content.data?.lessons ?? []).map((l) => l.id as string)),
    planData ?? null,
  );
  const ladder = voice.data?.ladder ?? null;
  const lastEnded = ended ? { ...ended, endedAt: ended.summary?.session.endedAt ?? null } : null;

  const view =
    planData && boot.data
      ? todayView({
          plan: planData,
          boot: boot.data,
          lastEnded,
          // The server's record of today (wave3.md §5.1); while it loads (or offline) the bootstrap and this
          // browser's last ended session decide, as in Wave 2.
          server: sessionDay.data ?? null,
          titleOf: (id) => titleOf(id, titles),
          stepsOf,
          objectiveOf,
          sideLessons: sideLessons.data ?? null,
          edge,
          ladder: ladder ? { cents: ladder.cents, offerLoosen: ladder.offerLoosen } : null,
          capstone,
          gym,
          gymOpen,
          cft,
          waiting,
          after,
          onboarding: onboarding.data ?? null,
        })
      : null;
  const extra = planData ? extraGym(planData) : null;
  // The A track's own offer (Wave 7) and the Wave 5 side-lesson line would name the same lesson twice: the offer wins.
  const side = view?.side && !tday?.offers.some((o) => o.trackId === "A") ? view.side : null;
  // A compose capstone that waits behind today's CF-T session stays one click away (cft-day.ts): the plan's own
  // alternative when the server lists it, else the capstone's next session.
  const alternatives = planData
    ? cft && inProgress && !planData.alternatives.some((a) => a.mapItemId === inProgress.nextSession)
      ? [
          {
            kind: "capstone" as const,
            mapItemId: inProgress.nextSession as SessionPlan["mapItemId"],
            title: titleOf(inProgress.capstoneId, titles),
          },
          ...planData.alternatives,
        ]
      : planData.alternatives
    : [];
  // Today's Coda exists when a session with a summary ended today: the server's record, or this browser's.
  const hasCoda =
    !!sessionDay.data?.summarySessionId ||
    (!!ended?.summary &&
      !!boot.data &&
      (ended.day === boot.data.day || ended.summary.session.day === boot.data.day));

  const onStart = async (p: SessionPlan) => {
    try {
      await sessionRunner.start(p);
      // The open session is now on the server: a Back to Today (or Today in another tab) must offer to resume
      // it, not to start a second one, so the bootstrap's `openSession` and today's sessions are read again.
      void qc.invalidateQueries({ queryKey: ["api", "bootstrap"] });
      void qc.invalidateQueries({ queryKey: ["api", "session.day"] });
      // Warms the tutor's prompt cache in the background; the tutor is optional, so failures are ignored.
      warm.mutate(undefined as never, { onError: () => {} });
    } catch (e) {
      toast.error("The session didn't start", e instanceof Error ? e.message : undefined);
    }
  };
  const onResume = async () => {
    // d21: this tab resumes its own session, never one another tab left open.
    const open = ownOpenSession(sessionDay.data);
    if (!open || !planData) return;
    try {
      await sessionRunner.resume(open, planData);
    } catch (e) {
      toast.error("The session didn't resume", e instanceof Error ? e.message : undefined);
    }
  };
  // An offer starts in place of the New block. After the core a pick is also remembered as the focus, so tomorrow
  // plans the same track; it is never locked in (the switch changes it any day).
  const onOffer = async (row: OfferRow) => {
    if (!planData) return;
    if (tday?.rememberPick && row.trackId !== "core" && row.trackId !== planData.focus) {
      try {
        await setFocus.mutateAsync({ body: { focus: row.trackId } });
      } catch {
        // The pick still starts today; only the memory of it failed.
      }
    }
    await onStart(offerPlan(planData, row));
  };
  const onFocus = (focus: NonNullable<typeof tday>["focus"]) => {
    setFocus.mutate(
      { body: { focus } },
      { onError: (e) => toast.error("That didn't save", e instanceof Error ? e.message : undefined) },
    );
  };
  const loosenFrom = ladder?.cents ?? boot.data?.profile.singToleranceCents ?? 70;
  const loosen = async () => {
    if (loosenFrom >= 70) return;
    try {
      // The ladder is the only writer of the tolerance in Auto (wave3.md §5.3): the one-tap loosen goes to
      // `PUT /voice/ladder { mode: "loosen" }`, and the answer says where the ladder now stands. Only a server
      // without the voice endpoints (501) gets the Wave 2 profile write.
      let to: number;
      try {
        const state = await setLadder.mutateAsync({ body: { mode: "loosen" } });
        to = state.ladder.cents;
      } catch (e) {
        if (!(e instanceof OakApiError && e.code === "not_implemented")) throw e;
        to = looserTolerance(loosenFrom);
        await profile.mutateAsync({ body: { singToleranceCents: to as 35 | 50 | 70 } });
      }
      toast.success(`Singing is checked at ±${to}¢ now.`);
    } catch (e) {
      toast.error("That didn't save", e instanceof Error ? e.message : undefined);
    }
  };

  useHotkeys([
    {
      id: "today-start",
      keys: "Enter",
      scope: "global",
      group: "Today",
      description: "Start or resume the session",
      when: (ctx) =>
        !ctx.onControl &&
        !ctx.inEditable &&
        !!view?.primary &&
        view.primary.action !== "onboarding" &&
        !starting,
      run: () => {
        if (!view?.primary || !planData) return;
        if (view.primary.action === "resume") void onResume();
        else void onStart(planData);
      },
    },
  ]);

  if (boot.isError && plan.isError)
    return (
      <Page>
        <ErrorState error={boot.error} onRetry={() => void boot.refetch()} />
      </Page>
    );

  const b = boot.data;
  return (
    <Page>
      <Header boot={boot} />
      {courseAfter?.firstDay && view?.state !== "done" && <CourseFirstDayLine />}
      {view?.after?.firstDay && !courseAfter && view.state !== "done" && <FirstDayLine />}
      <div className="grid gap-6 lg:grid-cols-12">
        <section aria-labelledby="setlist-h" className="flex flex-col gap-4 lg:col-span-8">
          <Card className="p-5" data-testid="today-card" data-state={view?.state}>
            {plan.isError ? (
              <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />
            ) : !view || !planData ? (
              <LoadingState rows={4} label="Planning today" />
            ) : (
              <>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <h2 id="setlist-h" className="text-h2">
                    {view.heading}
                  </h2>
                  {view.state !== "done" && view.state !== "first-run" && (
                    <span className="shrink-0 text-sm text-text-3">{view.length}</span>
                  )}
                </div>
                {tday?.trackLine && view.state !== "done" && view.state !== "in-session" && (
                  <TrackSessionLine line={tday.trackLine} />
                )}
                {view.lead && <p className="mb-2 max-w-[62ch] text-text-2">{view.lead}</p>}
                {view.state === "done" ? (
                  <DoneCard
                    plan={planData}
                    titles={titles}
                    edge={edge}
                    hasCoda={hasCoda}
                    onStart={() => void onStart(planData)}
                    extraGym={
                      extra ? () => void onStart(alternativePlan(planData, { kind: "gym", ...extra })) : null
                    }
                    objective={planData.mapItemId ? objectiveOf(planData.mapItemId) : null}
                    side={
                      side && (
                        <SideOfferLine
                          offer={side}
                          disabled={starting}
                          onStart={() => void onStart(sideLessonPlan(planData, side))}
                        />
                      )
                    }
                  />
                ) : view.state === "first-run" ? (
                  <div className="mt-4">
                    <PrimaryAction
                      view={view}
                      plan={planData}
                      onStart={onStart}
                      onResume={onResume}
                      starting={starting}
                    />
                  </div>
                ) : (
                  <>
                    {view.state !== "in-session" && <Setlist rows={view.rows} />}
                    {view.state === "gym" && gym && <GymExplain gym={gym} />}
                    {view.cft && <CftStrip cft={view.cft} waiting={view.waiting} />}
                    {view.state === "capstone" && capstone?.checksLine && (
                      <p className="text-sm text-text-2" data-testid="capstone-checks">
                        So far: {capstone.checksLine}.
                      </p>
                    )}
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <PrimaryAction
                        view={view}
                        plan={planData}
                        onStart={(p) => void onStart(p)}
                        onResume={() => void onResume()}
                        starting={starting}
                      />
                      {view.state !== "in-session" && <OtherTabLine count={view.otherTabs} />}
                      {view.keepAlive && (
                        <button
                          type="button"
                          className="text-sm text-link underline-offset-2 hover:underline"
                          onClick={() => void onStart(keepAlivePlan(planData))}
                          data-testid="keep-alive"
                        >
                          Short on time? A Keep-alive: one easy set, about 2 minutes
                        </button>
                      )}
                      {side && view.state !== "in-session" && (
                        <div className="mt-2 w-full">
                          <SideOfferLine
                            offer={side}
                            disabled={starting}
                            onStart={() => void onStart(sideLessonPlan(planData, side))}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </Card>
          {tday &&
            planData &&
            view &&
            view.state !== "first-run" &&
            view.state !== "in-session" &&
            view.state !== "done" && (
              <TrackOffers
                day={tday}
                disabled={starting}
                saving={setFocus.isPending}
                onStart={(row) => void onOffer(row)}
                onFocus={onFocus}
              />
            )}
          {view?.restDay && (
            <Callout tone="success" title="This week's goal is met">
              Today is a free rest. Playing is welcome, and nothing is lost by resting.
            </Callout>
          )}
          {b?.streak.repair && view?.state !== "first-run" && (
            <Callout tone="attention" title="An open tie on last week">
              {repairLine(b.streak.repair, b.profile.timezone)}
            </Callout>
          )}
          {view?.offerLoosen && b && (
            <Callout
              tone="info"
              title="Ease into singing again?"
              actions={
                <Button
                  size="sm"
                  onClick={() => void loosen()}
                  loading={profile.isPending || setLadder.isPending}
                  data-testid="loosen"
                >
                  Check singing at ±{looserTolerance(loosenFrom as 25 | 35 | 50 | 70)}¢
                </Button>
              }
            >
              One step looser for now. It tightens again as your voice settles; nothing changes unless you
              choose it.
            </Callout>
          )}
          {x1 && view && view.state !== "first-run" && (
            <div data-testid="x1-gate">
              <Callout tone="info" title={x1.title}>
                {x1.body}
              </Callout>
            </div>
          )}
          {/* Once the lessons of the core are done: what is open, under the planned session (END.md). */}
          {planData && (courseAfter || view?.after) && view && view.state !== "in-session" && (
            <OpenToYou
              after={
                courseAfter
                  ? {
                      stage: "complete",
                      firstDay: courseAfter.firstDay,
                      left: null,
                      open: courseAfter.open,
                      waiting: [],
                    }
                  : (view.after as NonNullable<typeof view.after>)
              }
              disabled={starting}
              skipSideLesson={view.side !== null}
              skipTracks={tday !== null}
              tracksLine={tday || courseAfter ? null : view.tracksLine}
              footer={courseAfter ? <KeepPlayingLine /> : undefined}
              onGym={extra ? () => void onStart(alternativePlan(planData, { kind: "gym", ...extra })) : null}
            />
          )}
          {view?.tracksLine && !tday && !view.after && view.state !== "in-session" && (
            <TracksLine line={view.tracksLine} />
          )}
          {/* The done card carries its own ways on (Studio, free practice): never twice. */}
          {planData &&
            view &&
            !view.after &&
            view.state !== "first-run" &&
            view.state !== "in-session" &&
            view.state !== "done" && (
              <nav
                aria-label="Other ways today"
                className="flex flex-wrap items-center gap-2"
                data-testid="other-ways"
              >
                <span className="text-sm text-text-2">Other ways today:</span>
                {alternatives
                  // The main item itself is not "another way" (a capstone day listed its own capstone again).
                  .filter((a) => !(a.mapItemId !== null && a.mapItemId === planData.mapItemId))
                  // The side lesson has its own calm line in the card (wave5.md §5.1): never a second button.
                  .filter((a) => !(view.side && a.mapItemId === view.side.lessonId))
                  .map((a) =>
                    // An extra gym session or an open capstone is a session of its own: it starts here, with
                    // today's warm-up, and takes the next GYM.nn (contracts §2.5).
                    a.kind === "gym" || a.kind === "capstone" ? (
                      <Button
                        key={`${a.kind}:${a.mapItemId ?? ""}`}
                        variant="secondary"
                        size="sm"
                        disabled={starting}
                        onClick={() => void onStart(alternativePlan(planData, a))}
                        data-testid={a.kind === "gym" ? "extra-gym" : "alt-capstone"}
                      >
                        {a.kind === "gym" ? "An extra gym session" : `Continue ${capstoneDayTitle(a.title)}`}
                      </Button>
                    ) : (
                      <Link
                        key={`${a.kind}:${a.mapItemId ?? ""}`}
                        {...(a.kind === "studio" ? { to: "/studio" as const } : routeOfItem(a.mapItemId))}
                        className={buttonClass("secondary", "sm")}
                      >
                        {a.title}
                      </Link>
                    ),
                  )}
                <Link to="/practice" className={buttonClass("ghost", "sm")}>
                  Practice
                </Link>
                {/* A review day's plan names Studio itself (the server's alternative); never twice. */}
                {!planData.alternatives.some((a) => a.kind === "studio") && (
                  <Link to="/studio" className={buttonClass("ghost", "sm")}>
                    Studio
                  </Link>
                )}
              </nav>
            )}
        </section>

        <aside className="flex flex-col gap-4 lg:col-span-4" aria-label="At a glance">
          <NextUnlockCard />
          <OakGlanceCard />
          <AlbumStrip />
          <LastSketchCard />
          {!b && <Skeleton className="h-24 w-full" />}
          <p className="flex items-center gap-1.5 text-sm text-text-3">
            <Leaf aria-hidden className="size-3.5" /> Spacing beats cramming: a little most days grows the
            Oak.
          </p>
        </aside>
      </div>
    </Page>
  );
}
