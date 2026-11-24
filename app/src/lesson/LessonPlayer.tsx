// The Lesson Player (ux §3, contracts §5.8, §9): a lesson's steps as the New and Make blocks of a session. It
// loads the typed lesson and its prose, the learner's progress and step states, drives the lesson machine, and
// hosts each step's renderer: prose, the exercise, the hint ladder, feedback, Ask Claude, Continue, the Make
// with the Band, Wrap up and the 15-minute split, completion. It publishes the step for the session and the
// tutor, logs step telemetry and reports its blocks to the session.
import {
  type AttemptResponse,
  type Exercise,
  type FlavourId,
  type GradeResult,
  type LearnerProfile,
  type LessonDef,
  type LessonProgress,
  OakApiError,
  type SessionId,
  SIDE_LESSON_IDS,
  type StepDef,
  type StepState,
  type SubjectRef,
  type TargetMinutes,
  toLearnerProfile,
  type UnlockableId,
} from "@oak/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useActorRef, useSelector } from "@xstate/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type ActorRefFrom, waitFor } from "xstate";
import { courseGraph } from "../../../content/index.ts";
import { unlockedAt } from "../../../content/lib/course.ts";
import { callApi } from "../lib/api.ts";
import { useContent } from "../lib/content.ts";
import type { ContentBundle } from "../lib/content-model.ts";
import { applyToEditor } from "../lib/editors.ts";
import { usePageTitle } from "../lib/nav.ts";
import { initialPanelsOf } from "../lib/panels.ts";
import { useCourseProgress, useHealth, useProfile, useUnlocks, useVoiceState } from "../lib/queries.ts";
import { retryLine } from "../lib/retry.ts";
import { ActivityClock, logStep } from "../lib/telemetry.ts";
import { currentSessionId, reportBlockDone, useSession } from "../session/store.ts";
import {
  type NewSongGate,
  type SongMakeState,
  useNewSongGate,
  useSongMake,
  useSongOfLesson,
} from "../song/hooks.ts";
import { NewSong } from "../song/NewSong.tsx";
import { SongCard } from "../song/SongCard.tsx";
import {
  askChat,
  askExplain,
  askHint,
  clearSubject,
  registerTutorHost,
  setSubject,
  useTutorContext,
} from "../tutor/context.ts";
import { useSubjectHarmony } from "../tutor/use-subject-harmony.ts";
import { useHotkeys } from "../ui/keys/KeymapProvider.tsx";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { EmptyState, Page } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { ErrorState, LoadingState } from "../ui/kit/QueryState.tsx";
import { useFocusHeaderContent } from "../ui/shell/focus-header.ts";
import { useVoiceSync } from "../voice/sync.ts";
import { ServicesGate } from "../workbench/ServicesGate.tsx";
import "../workbench/workbench.css";
import { lessonWidgetFor } from "./answers.tsx";
import { bandMutesOf, bandSetupOf } from "./band.ts";
import { checkReasonId } from "./check.tsx";
import { type LoadedLesson, useLessonContent } from "./content.ts";
import { clearStepDrafts } from "./drafts.ts";
import { FeatureMoment, useFeatureSwitch } from "./feature-moment.tsx";
import { renderer as feedbackRenderer } from "./feedback.ts";
import { InlineMd, type StepHost, StepHostContext, StepLayout, useStepHost } from "./frame.tsx";
import { continueNote, gatedIds, gateNeedsFreshTry, withoutGated } from "./gate.ts";
import { CONTENT_GATE, gateBoxFor, lessonHasGate, useGateState } from "./gate-ui.tsx";
import {
  drawnTapTargets,
  type GradeEnv,
  gradedLint,
  gradeStep,
  NEUTRAL_PROFILE,
  openCategories,
  stimulusTrial,
} from "./grading.ts";
import { devSingTargets, isCodeInput, lessonTakes, starterOf } from "./inputs.tsx";
import { codeOf, type LessonDeps, latestCode, lessonMachine, progressOf, snapshotOf } from "./machine.ts";
import { lessonMdxComponents, MdxStepProvider } from "./mdx.tsx";
import {
  canContinue,
  continueLabel,
  globalExerciseId,
  initialTabOf,
  isCheckable,
  ladderOf,
  partsOf,
  railOf,
  resultOnScreen,
  splitPartFor,
  stepParams,
  viewsOf,
  withParams,
} from "./model.ts";
import {
  clearLesson,
  lessonSubject,
  publishLesson,
  publishStepAnswer,
  setLessonSink,
  stepLabels,
  tutorAnswerOf,
  useStepAnswer,
} from "./public.ts";
import { MakeRenderer, rendererFor } from "./renderers.tsx";
import { answerFocus } from "./result-row.tsx";
import {
  featureMoment,
  featuresUnlockedAt,
  labelsBefore,
  staffLabelsOf,
  workbenchStaffLabels,
} from "./rules.ts";
import { StepFooter } from "./StepFooter.tsx";
import { CompleteScreen, QuickSketch, ReportDialog } from "./screens.tsx";
import { isNotImplemented, previewDeps, serverDeps } from "./server.ts";
import { browserGrader, catalogText, lessonServices } from "./services.ts";
import {
  isSideLesson,
  type LessonOrigin,
  nextSideLesson,
  originLink,
  reportsToSession,
  type SideInfo,
  sideInfo,
  sideMinutes,
} from "./side.ts";
import { LockedLine } from "./track-ui.tsx";
import { answerMissing, registryHas, stepScopePanel } from "./wave5.ts";
import { stepMusicLenses } from "./wave6.ts";

/** U00.L01 and U00.L02 run on the onboarding loop, a preview context (contracts §3.1 rule 5a). */
const ONBOARDING_PREVIEW = new Set(["U00.L01", "U00.L02"]);
/** The gate sample is checked as if it were taught here (content/validate/harness.ts SAMPLE_CONTEXT). */
const SAMPLE_CONTEXT = "U03.L05";

export interface LessonPlayerProps {
  lessonId: string;
  step?: string | undefined;
  /** Dev only: play a locked lesson locally without saving. */
  preview?: boolean | undefined;
  /** Where the lesson was opened from: its end and "Leave for now" return there (Wave 5, side lessons). */
  from?: LessonOrigin | undefined;
}

export function LessonPlayer({ lessonId, step, preview, from }: LessonPlayerProps) {
  const loaded = useLessonContent(lessonId);
  const bundle = useContent();
  const progress = useCourseProgress();
  const profile = useProfile();
  const unlocks = useUnlocks();
  const health = useHealth();
  // Quiet mode and singing labels are server state (wave3.md §5.3); until voice.get answers, the profile's flag.
  const voice = useVoiceState();
  // Quiet mode switched in another tab reaches this step at once (no Sing, no mic).
  useVoiceSync();
  // Unit songs (spec §5.5): a take lesson of a song not started opens with the New song moment (`newSongMoment`).
  const songGate = useNewSongGate(lessonId, { enabled: preview !== true });
  const meta = bundle.data?.syllabus?.units.flatMap((u) => u.lessons).find((l) => l.id === lessonId) ?? null;
  const title = loaded.data?.def.title ?? meta?.title ?? lessonId;
  usePageTitle(title);

  // The learner's profile and voice state feed the drawn trials (range, tolerance, Quiet mode): the step waits for
  // them, or a trial heard on the neutral profile would be redrawn under the learner when they arrive (a failed
  // read falls back to the neutral profile, as before).
  if (
    loaded.isPending ||
    bundle.isPending ||
    (progress.isPending && !loaded.data?.sample) ||
    profile.isPending ||
    voice.isPending
  )
    return (
      <Page width="narrow">
        <LoadingState label="Opening the lesson" />
      </Page>
    );
  if (loaded.isError)
    return (
      <Page width="narrow">
        <ErrorState error={loaded.error} onRetry={() => void loaded.refetch()} />
      </Page>
    );
  if (!loaded.data)
    return (
      <Page width="narrow">
        <EmptyState
          title={meta ? meta.title : "No such lesson"}
          action={
            <Link to="/oak" search={{ view: "course" }} className={buttonClass("primary")}>
              See the course
            </Link>
          }
        >
          {meta
            ? "This lesson is planned but not written yet. The course map shows what is ready."
            : `${lessonId} is not in the course.`}
        </EmptyState>
      </Page>
    );
  const lp = progress.data?.lessons.find((l) => l.lessonId === lessonId) ?? null;
  const sample = loaded.data.sample;
  const locked = !sample && (lp === null || lp.status === "locked");
  const dev = health.data?.dev === true || import.meta.env.DEV;
  if (locked && !(preview && dev))
    return (
      <Page width="narrow">
        <EmptyState
          title="This lesson isn't open yet"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/" className={buttonClass("primary")}>
                Back to Today
              </Link>
              {dev && (
                <Link
                  to="/learn/$lessonId"
                  params={{ lessonId }}
                  search={{ preview: true }}
                  className={buttonClass("secondary")}
                >
                  Preview it (nothing is saved)
                </Link>
              )}
            </div>
          }
        >
          <LockedLine
            lessonId={lessonId}
            title={loaded.data.def.title}
            syllabus={bundle.data?.syllabus ?? null}
          />
        </EmptyState>
      </Page>
    );
  if (songGate.pending && !locked)
    return (
      <Page width="narrow">
        <LoadingState label="Opening the lesson" />
      </Page>
    );
  const moment = songGate.show && !locked ? newSongMoment(songGate) : null;
  if (moment) return <Page>{moment}</Page>;
  return (
    <ServicesGate load={lessonServices} auto>
      <PlayerCore
        key={lessonId}
        loaded={loaded.data}
        lp={lp}
        preview={sample || locked}
        profile={
          // The tolerance the server's ladder holds (wave3.md §5.3) wins over the profile's copy.
          profile.data
            ? {
                ...toLearnerProfile(profile.data),
                ...(voice.data ? { singTolCents: voice.data.ladder.cents, quiet: voice.data.quiet } : {}),
              }
            : NEUTRAL_PROFILE
        }
        voice={{
          quiet: voice.data?.quiet ?? profile.data?.quiet ?? false,
          labels: voice.data?.labels ?? null,
        }}
        flavour={profile.data?.flavour ?? "flavour.pop"}
        profileTarget={profile.data?.targetMinutes ?? 20}
        serverUnlocked={(unlocks.data?.items ?? []).map((u) => u.itemId as UnlockableId)}
        completed={
          new Set(
            (progress.data?.lessons ?? []).filter((l) => l.status === "completed").map((l) => l.lessonId),
          )
        }
        bundle={bundle.data ?? null}
        searchStep={step}
        side={isSideLesson(lessonId, meta) ? sideInfo(lessonId, meta, sideMinutes(loaded.data.def)) : null}
        from={from}
      />
    </ServicesGate>
  );
}

/**
 * Unit songs (spec §5.5): what a take lesson shows before its first step while the learner has not started the unit's
 * song: the New song moment (app/src/song/NewSong.tsx). It posts `songs.start` with the picked style, then
 * `gate.onStarted()` opens the lesson. Without a unit (no song) the lesson opens at once.
 */
function newSongMoment(gate: NewSongGate): ReactNode {
  if (!gate.unitId) return null;
  return <NewSong unitId={gate.unitId} onStarted={gate.onStarted} />;
}

/** The next side lesson of the track (its ID and title), for a side lesson's complete screen. */
function nextSideOf(id: string, bundle: ContentBundle | null): { id: string; title: string } | null {
  const metas = bundle?.syllabus?.units.flatMap((u) => u.lessons) ?? [];
  const sideIds = metas.filter((l) => isSideLesson(l.id, l)).map((l) => l.id);
  const next = nextSideLesson(id, sideIds.length > 0 ? sideIds : SIDE_LESSON_IDS);
  if (!next) return null;
  return { id: next, title: metas.find((l) => l.id === next)?.title ?? next };
}

/** A take Make's codes that count as unchanged (spec §5.3: `make.unchanged` against what the Make opened with). */
function unchangedOf(take: { unchangedFrom: string[] } | null): { unchangedFrom?: readonly string[] } {
  return take && take.unchangedFrom.length > 0 ? { unchangedFrom: take.unchangedFrom } : {};
}

/** Every step's server state: `lessons.steps`, or one `steps.state` per step until that endpoint exists. */
function useStepStates(def: LessonDef, enabled: boolean) {
  return useQuery({
    queryKey: ["api", "lessons.steps", { params: { id: def.id } }, "lesson-player"],
    enabled,
    staleTime: 0,
    queryFn: async (): Promise<StepState[]> => {
      try {
        return (await callApi("lessons.steps", { params: { id: def.id } })).steps;
      } catch (e) {
        if (!isNotImplemented(e)) throw e;
        const withEx = def.steps.filter((s) => s.exercise);
        const all = await Promise.all(
          withEx.map((s) =>
            callApi("steps.state", { params: { id: def.id, stepId: s.id } }).catch((err: unknown) => {
              if (err instanceof OakApiError && err.status === 404) return null;
              throw err;
            }),
          ),
        );
        return all.filter((x): x is StepState => x !== null);
      }
    },
  });
}

interface CoreProps {
  loaded: LoadedLesson;
  voice: { quiet: boolean; labels: "numbers" | "syllables" | null };
  lp: LessonProgress | null;
  preview: boolean;
  profile: LearnerProfile;
  flavour: FlavourId;
  profileTarget: TargetMinutes;
  serverUnlocked: UnlockableId[];
  completed: ReadonlySet<string>;
  bundle: ContentBundle | null;
  searchStep: string | undefined;
  /** A side lesson's framing (optional, what it makes better), or `null` for a core lesson. */
  side: SideInfo | null;
  from: LessonOrigin | undefined;
}

function PlayerCore(props: CoreProps) {
  const { loaded, lp, preview, profile, bundle } = props;
  const def = loaded.def;
  const qc = useQueryClient();
  const plan = useSession((s) => s.plan);
  const inSession = useSession((s) => s.session !== null && reportsToSession(def.id, s.plan));
  // Only the session's own lesson reports to it and saves under its ID (a side lesson opened from the Toolbox
  // during a core session leaves the session's New block alone).
  const sessionIdHere = () =>
    reportsToSession(def.id, useSession.getState().plan) ? currentSessionId() : null;
  const target: TargetMinutes = (inSession ? plan?.targetMinutes : undefined) ?? props.profileTarget;
  const splitPart = preview ? null : splitPartFor(def, target, lp);
  const states = useStepStates(def, !preview);
  const tutorAvailable = useTutorContext((s) => s.availability) !== "off";
  // The voicing gate (contracts §3.1 rule 6), for U05.L07 and U05.L08 only.
  const hasGate = lessonHasGate(def, loaded.gate);
  const secondChance = def.steps.some((s) => s.gateCheck === true);
  const gateQ = useGateState(hasGate, preview, loaded.gate ?? null);
  const [gateOpenHere, setGateOpenHere] = useState(false);
  const gateOpen = gateQ.data?.passed === true || gateOpenHere;

  // --- the step clock (telemetry and attempt activeMs) ------------------------------------------------
  const clock = useRef(new ActivityClock());
  const stepStarted = useRef(new Date().toISOString());
  useEffect(() => {
    const act = () => clock.current.activity();
    const vis = () => clock.current.setVisible(document.visibilityState === "visible");
    window.addEventListener("keydown", act, true);
    window.addEventListener("pointerdown", act, true);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", act, true);
      window.removeEventListener("pointerdown", act, true);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const attemptIds = useRef(new Map<string, number>());
  const lastResponse = useRef(new Map<string, AttemptResponse>());
  const ref = useRef({ splitPart, profile, flavour: props.flavour });
  ref.current = { splitPart, profile, flavour: props.flavour };

  const held = new Set<UnlockableId>([
    ...props.serverUnlocked,
    ...unlockedAt(
      courseGraph(),
      bundle?.toolbox ?? [],
      (loaded.context ?? (loaded.sample ? SAMPLE_CONTEXT : def.id)) as never,
    ),
    ...((loaded.extraUnlocks ?? []) as UnlockableId[]),
  ]);
  // Inside U05.L08 the gated tools are usable only once the gate is met (rule 2 does not apply before that).
  const unlocked = secondChance ? withoutGated(held, gatedIds(bundle?.toolbox ?? []), gateOpen) : held;
  const env: GradeEnv = {
    ownerId: def.id,
    key: def.key,
    meter: def.meter,
    bpm: def.bpm,
    ...(def.swing ? { swing: def.swing } : {}),
    ...(def.pickup ? { pickup: def.pickup } : {}),
    unlocked,
    allowPreview: ONBOARDING_PREVIEW.has(def.id),
    profile,
  };
  const envRef = useRef(env);
  envRef.current = env;

  const bandOf = (step: StepDef | undefined) =>
    bandSetupOf(step?.ui.band, {
      flavour: props.flavour,
      key: def.key,
      bpm: def.bpm,
      at: def.id as SessionId,
    });
  // Unit songs (spec §5.3): the Make of a take step plays inside its song, recomputed from the song every time the
  // lesson opens; a side step's Make stays a sketch of its own.
  const songMake = useSongMake(def, { flavour: props.flavour });
  const songRef = useRef<SongMakeState>(songMake);
  songRef.current = songMake;
  const songTakeOf = () => (songRef.current.kind === "take" ? songRef.current : null);

  const actorRef = useRef<ActorRefFrom<typeof lessonMachine> | null>(null);
  const deps = useRef<LessonDeps>(
    preview
      ? previewDeps(def)
      : serverDeps({
          qc,
          lesson: def,
          sessionId: sessionIdHere,
          splitPart: () => ref.current.splitPart,
          contentHash: `${def.id}@${def.version}:${bundle?.version ?? "source"}`,
          activeMs: () => clock.current.peek(),
          band: (stepId) => {
            const step = def.steps.find((s) => s.id === stepId);
            const b = bandOf(step);
            if (!b) return null;
            // The parts the step leaves out stay muted in the sketch (Studio plays what the lesson played).
            const take = step?.kind === "make" ? songTakeOf() : null;
            return {
              bandId: b.band,
              flavour: b.flavour,
              mutes: bandMutesOf(b),
              ...(take ? { song: { unitId: take.unitId, takeIds: take.takeIds.slice(-256) } } : {}),
            };
          },
          ranOk: (stepId) => actorRef.current?.getSnapshot().context.done[stepId] === true,
          gradeMake: async (code) => {
            const s = def.steps.find((x) => x.kind === "make");
            if (!s?.exercise) return null;
            return gradeStep(
              browserGrader,
              envRef.current,
              s.exercise,
              { code },
              {
                params: {},
                attemptNo: 1,
                rung: 0,
                extraReplays: 0,
                ...unchangedOf(songTakeOf()),
              },
            ).catch(() => null);
          },
          songTake: () => {
            const take = songTakeOf();
            const make = def.steps.find((x) => x.kind === "make")?.exercise;
            if (!take) return null;
            return {
              def: take.def,
              step: take.step,
              unitId: take.unitId,
              meter: make?.meter ?? def.meter,
              bars: make?.kind === "code-make" ? make.bars[1] : 4,
              songBpm: take.bpm,
              backfilled: (take.detail?.takes ?? []).filter((t) => t.backfilled),
            };
          },
          evaluate: browserGrader.evaluate,
          onAttempt: (stepId, id) => attemptIds.current.set(stepId, id),
        }),
  ).current;
  deps.stepLeft = (stepId) => {
    const c = actorRef.current?.getSnapshot().context;
    const step = def.steps.find((s) => s.id === stepId);
    const sessionId = sessionIdHere();
    const activeMs = clock.current.take();
    const startedAt = stepStarted.current;
    stepStarted.current = new Date().toISOString();
    if (!c || !step || !sessionId || preview) return;
    const p = progressOf(c, stepId);
    logStep({
      sessionId,
      lessonId: def.id,
      lessonVersion: def.version,
      stepId,
      stepKind: step.kind,
      targetMinutes: target,
      authoredMinutes: step.minutes,
      scaledMinutes: Math.round(step.minutes * 1.4 * 100) / 100,
      startedAt,
      endedAt: new Date().toISOString(),
      activeMs,
      attempts: p.state?.attempts ?? 0,
      maxHintRung: p.state?.rung ?? 0,
      tutorMessages: 0,
      passed: p.state?.passed === true || p.result?.status === "pass",
      skipped: !(p.done || p.disputed || p.state?.passed || p.result?.status === "pass"),
      testedOut: c.testedOut.includes(stepId),
      splitPart: c.splitPart,
    });
  };

  const actor = useActorRef(lessonMachine, {
    input: { lessonId: def.id, target, sessionId: sessionIdHere(), deps },
  });
  actorRef.current = actor;

  // Load once the step states are in (or at once in a preview).
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (loadedOnce.current) return;
    if (!preview && !states.isSuccess) return;
    // A lesson that holds the gate waits for it (an error reads as unmet: the server still guards completion).
    if (hasGate && gateQ.isPending) return;
    loadedOnce.current = true;
    const steps = def.steps.filter((s) => target === 25 || !s.optional);
    const reached = lp?.status === "completed" ? (steps.at(-1)?.id ?? null) : (lp?.currentStep ?? null);
    actor.send({
      type: "LOADED",
      lesson: def,
      resumeStep: props.searchStep ?? lp?.currentStep ?? null,
      splitPart,
      reachedStep: reached,
      gate: hasGate ? (gateQ.data ?? { rule: loaded.gate ?? CONTENT_GATE, passed: false }) : null,
    });
    for (const st of states.data ?? []) actor.send({ type: "STATE", state: st });
  }, [
    preview,
    states.isSuccess,
    states.data,
    actor,
    def,
    lp,
    props.searchStep,
    splitPart,
    target,
    hasGate,
    gateQ.isPending,
    gateQ.data,
  ]);
  // The server's word that the gate is met (a refetch after a pass) reaches the machine.
  useEffect(() => {
    if (gateQ.data?.passed) actor.send({ type: "GATE", passed: true });
  }, [gateQ.data?.passed, actor]);

  // Publish the step for the session and the tutor; clear on leave.
  const snap = useSelector(
    actor,
    (s) => snapshotOf(s),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  // The tutor also reads the key, the step's own labels and the last answer that is not code (wave3.md §4.3), and
  // the song the lesson builds (contracts §5.11 rule 19: its chip; the server adds the song itself).
  const stepAnswer = useStepAnswer();
  const lessonSong = useSongOfLesson(def.id);
  const songTitle = lessonSong.song ? (lessonSong.detail?.title ?? lessonSong.song.title) : null;
  useEffect(() => {
    if (!snap) return;
    publishLesson(snap);
    const stepDef = def.steps.find((s) => s.id === snap.stepId);
    const ex = stepDef?.exercise;
    const exKey = ex && "key" in ex && ex.key ? ex.key : null;
    setSubject(
      lessonSubject(snap, {
        key: exKey ?? def.key,
        labels: stepDef ? stepLabels(stepDef) : null,
        answer: stepAnswer.stepId === snap.stepId ? stepAnswer.answer : null,
        song: songTitle === null ? null : { title: songTitle },
      }),
    );
  }, [snap, def, stepAnswer, songTitle]);
  useEffect(
    () => () => {
      clearLesson(def.id);
      clearSubject({ subjectKind: "lesson", subjectId: def.id });
    },
    [def.id],
  );
  useEffect(() => {
    setLessonSink((ev) => actor.send(ev));
    // The tutor panel's Apply and Reveal go through the lesson's own machine (contracts §10.7): an applied card
    // marks the step tutor-assisted, a reveal is recorded on the lesson's hint ladder like the footer's.
    const unregister = registerTutorHost({
      thread: { subjectKind: "lesson", subjectId: def.id },
      applyCode: (code, card) => {
        // Into the step's own editor (its onChange updates the step), then marked tutor-assisted.
        const stepId = snapshotOf(actor.getSnapshot())?.stepId;
        if (stepId) applyToEditor(`l-${stepId.toLowerCase()}`, code);
        actor.send({ type: "APPLY_CARD", code, cardId: card.cardId });
      },
      reveal: () => {
        actor.send({ type: "HINT", reveal: true });
      },
    });
    return () => {
      setLessonSink(null);
      unregister();
    };
  }, [actor, def.id]);

  const ctx = useSelector(actor, (s) => s.context);
  // A gate pass in this visit opens the gated tools at once (the server grants them with the attempt).
  const gatePassedHere = ctx.gate?.passed === true;
  useEffect(() => {
    if (gatePassedHere) setGateOpenHere(true);
  }, [gatePassedHere]);
  const status = useSelector(actor, (s) =>
    s.matches("error")
      ? "error"
      : s.matches("complete")
        ? "complete"
        : s.matches("wrapping")
          ? "wrapping"
          : s.matches("finishing")
            ? "finishing"
            : s.matches("loading")
              ? "loading"
              : "active",
  );
  const hintBusy = useSelector(
    actor,
    (s) => s.matches({ active: "hinting" }) || s.matches({ active: "series" }),
  );
  const checking = useSelector(
    actor,
    (s) => s.matches({ active: "grading" }) || s.matches({ active: "posting" }) || s.matches("finishing"),
  );
  const quickSaving = useSelector(actor, (s) => s.matches({ wrapping: "saving" }));

  const step = ctx.steps[ctx.index] ?? null;
  // The verdicts counted when this step came on screen: one that appears later moves the focus to the result row
  // (docs/design/retry.md §2.4); coming back to a step that already shows one leaves the focus on its title.
  const visit = useRef<{ stepId: string | null; resultNo: number }>({ stepId: null, resultNo: 0 });
  if (visit.current.stepId !== (step?.id ?? null))
    visit.current = { stepId: step?.id ?? null, resultNo: ctx.resultNo };
  // A feature tool this lesson unlocks (degree labels at U03.L02 …) switches on in the Workbench at the first
  // step that shows it, unless the learner already holds it (a replay, a lesson done before).
  const fresh =
    lp?.status === "completed" || loaded.sample
      ? []
      : featuresUnlockedAt(bundle?.toolbox ?? [], def.id).filter(
          (id) => !props.serverUnlocked.includes(id as UnlockableId),
        );
  const moment = step ? featureMoment(ctx.steps, ctx.index, fresh) : [];
  const featureSwitch = useFeatureSwitch(step?.id ?? "", moment.length > 0);
  const rail = step ? railOf(ctx.steps, ctx.index, (id) => progressOf(ctx, id)) : null;
  useFocusHeaderContent(
    def.title,
    rail ? rail.map((r) => ({ id: r.id, label: r.label, state: r.state })) : null,
  );

  // The session: the New block ends at the Make; the Make ends with its sketch (wave2 §3.3).
  const reportedNew = useRef(false);
  useEffect(() => {
    if (preview || !inSession || reportedNew.current || step?.kind !== "make") return;
    reportedNew.current = true;
    reportBlockDone({ block: "new", source: "lesson", itemId: def.id, completed: true });
  }, [step?.kind, preview, inSession, def.id]);
  const reportedEnd = useRef(false);
  useEffect(() => {
    if (preview || !inSession || reportedEnd.current || status !== "complete" || !ctx.sketchId) return;
    reportedEnd.current = true;
    if (ctx.wrapReason) {
      reportBlockDone({
        block: "new",
        source: "lesson",
        itemId: def.id,
        completed: false,
        resumeStep: lp?.currentStep ?? null,
      });
      reportBlockDone({ block: "make", source: "quick-sketch", sketchId: ctx.sketchId });
    } else reportBlockDone({ block: "make", source: "lesson", sketchId: ctx.sketchId });
  }, [status, ctx.sketchId, ctx.wrapReason, preview, inSession, def.id, lp?.currentStep]);

  // d4: an unchecked answer is kept per step on this device; leaving the step (or ending the lesson) forgets it.
  const draftStep = useRef<string | null>(null);
  const stepIdNow = status === "active" ? (step?.id ?? null) : null;
  useEffect(() => {
    const before = draftStep.current;
    if (before !== null && before !== stepIdNow) clearStepDrafts(def.id, before);
    draftStep.current = stepIdNow;
  }, [stepIdNow, def.id]);

  // The step this visit opened at (a resumed side lesson says it is optional there, not only on step 1).
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  useEffect(() => {
    if (openedAt === null && status === "active") setOpenedAt(ctx.index);
  }, [openedAt, status, ctx.index]);

  // Wave 5: a step whose answer the app cannot draw yet (a kind without a widget) never strands the learner.
  useEffect(() => {
    if (step && answerMissing(step.exercise, registryHas(lessonWidgetFor)))
      actor.send({ type: "UNAVAILABLE", stepId: step.id });
  }, [step, actor]);

  // The session's own "Wrap up" (the non-modal line) reaches the lesson here.
  const sessionWrap = useSession((s) => s.wrap);
  useEffect(() => {
    if (sessionWrap === "wrapping" && inSession && status === "active") actor.send({ type: "WRAP_UP" });
  }, [sessionWrap, inSession, status, actor]);

  // --- keys --------------------------------------------------------------------------------------------
  const check = useRef<(() => void) | null>(null);
  const inPad = (chain: readonly string[]) =>
    chain.some((s) =>
      [
        "editor",
        "workbench",
        "answer-pad",
        "chromatic-pad",
        "tap-pad",
        "staff-input",
        "tutor-composer",
      ].includes(s),
    );
  useHotkeys([
    {
      id: "lesson-check",
      keys: "Mod+Shift+Enter",
      scope: "global",
      group: "Lesson",
      description: "Check the step",
      allowInInput: true,
      when: () => check.current !== null,
      run: () => check.current?.(),
    },
    {
      id: "lesson-hint",
      keys: "H",
      scope: "global",
      group: "Lesson",
      description: "Next hint",
      when: (k) => !inPad(k.chain) && !k.inEditable,
      run: () => actor.send({ type: "HINT", reveal: false }),
    },
    {
      id: "lesson-continue",
      keys: "Enter",
      scope: "global",
      group: "Lesson",
      description: "Continue",
      when: (k) => !inPad(k.chain) && !k.inEditable && !k.onControl,
      run: () => actor.send({ type: "CONTINUE" }),
    },
    {
      id: "lesson-back",
      keys: "Alt+ArrowLeft",
      scope: "global",
      group: "Lesson",
      description: "Previous step (replay)",
      when: (k) => !k.inEditable,
      run: () => actor.send({ type: "BACK" }),
    },
    {
      id: "lesson-forward",
      keys: "Alt+ArrowRight",
      scope: "global",
      group: "Lesson",
      description: "Next completed step",
      when: (k) => !k.inEditable,
      run: () => actor.send({ type: "FORWARD" }),
    },
  ]);

  // Dev and e2e: set the editor, read the drawn trial, or submit a response through the same grading path
  // (tap and sing need real timing and a voice otherwise). Never in a production build.
  const dev = useRef<{
    submit(r: AttemptResponse): Promise<GradeResult | null>;
    trial(): unknown;
    trials(): unknown;
    tapTargets(): number[] | null;
  } | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (globalThis as { __oakLesson?: unknown }).__oakLesson = {
      setCode: (code: string) => actor.send({ type: "CODE", code }),
      snapshot: () => snapshotOf(actor.getSnapshot()),
      submit: (r: AttemptResponse) => dev.current?.submit(r),
      trial: () => dev.current?.trial(),
      trials: () => dev.current?.trials(),
      tapTargets: () => dev.current?.tapTargets() ?? null,
      singTargets: () => Object.fromEntries(devSingTargets),
    };
    return () => {
      delete (globalThis as { __oakLesson?: unknown }).__oakLesson;
    };
  }, [actor]);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  // The tutor's chord map and sections follow what the step's Workbench analysed (tutor apiNote 5): section
  // names in tutor text then select the sections the form ribbon draws, and chord chips light their real bars.
  const onModel = useSubjectHarmony({ subjectKind: "lesson", subjectId: def.id } as SubjectRef);

  // --- screens -----------------------------------------------------------------------------------------
  if (status === "loading" || !step)
    return states.isError ? (
      <Page width="narrow">
        <ErrorState error={states.error} onRetry={() => void states.refetch()} />
      </Page>
    ) : (
      <Page width="narrow">
        <LoadingState label="Opening the lesson" />
      </Page>
    );
  if (status === "error")
    return (
      <Page width="narrow">
        <EmptyState
          title="The lesson stopped"
          action={<Button onClick={() => actor.send({ type: "RETRY" })}>Try again</Button>}
        >
          {ctx.error}
        </EmptyState>
      </Page>
    );
  const stepLenses = (s: StepDef) =>
    stepMusicLenses({ lessonId: def.id, meter: s.exercise?.meter ?? def.meter });
  const workbenchBase = (s: StepDef) => {
    const ex = s.exercise;
    const refBars =
      ex && "reference" in ex && ex.reference && "bars" in ex.reference
        ? (ex.reference.bars as number)
        : null;
    // A Make's own length (`bars: [min, max]`): U00.L02's four-bar loop was shown and run as one bar, so the
    // last bar, where the tune has to land on home, was never on screen.
    const makeBars = ex && ex.kind === "code-make" ? ex.bars[1] : null;
    const staff = s.ui.panels.staff;
    const band = bandOf(s);
    // Code with long lines (the onboarding loop is ~90 characters wide) gets the full width, with the music
    // under it: side by side, the editor cut the lines off, and the highlighted number with them.
    const shown = s.example?.code ?? (ex ? starterOf(ex).code : "");
    const wide = Math.max(0, ...shown.split("\n").map((l) => l.length)) > 56;
    const rollLabels = s.ui.rollLabels ?? "none";
    const staffLabels = staffLabelsOf(s, def.id);
    return {
      ...(wide ? { variant: "compact" as const } : {}),
      // A step in its own key or meter (a 3/4 tune in a 4/4 lesson) is read, labelled and linted in it, as
      // it is graded (grading.ts) and as content CI lints it.
      lessonCtx: {
        key: ex?.key ?? def.key,
        meter: ex?.meter ?? def.meter,
        defaultBpm: def.bpm,
        loopBars: s.ui.loopBars ?? s.example?.bars ?? refBars ?? makeBars ?? (band ? 2 : 1),
      },
      lint: gradedLint({ ...env, key: ex?.key ?? env.key, meter: ex?.meter ?? env.meter }),
      ...((ex?.pickup ?? def.pickup) ? { pickup: ex?.pickup ?? def.pickup } : {}),
      views: viewsOf(s),
      onModel,
      // A step that asks for the roll and the bass clef or grand staff wants both read ("watch the bass on the
      // lower staff"): when the Workbench has to tab them (the height rule), it opens on Both, not the roll alone.
      ...(initialTabOf(s) === "both" ? { initialTab: "both" as const } : {}),
      // Wave 4: a step may open Workbench panels (the key panel, the chord band …); its choice wins.
      ...(initialPanelsOf(s.ui) ? { initialPanels: initialPanelsOf(s.ui) ?? {} } : {}),
      // Wave 5: the scope / spectrum panel and a visual probe the step asks for (A1); the code's own .scope()
      // opens the same panel inside the Workbench.
      ...(stepScopePanel(s.ui) ? { scopePanel: stepScopePanel(s.ui) } : {}),
      unit: def.id,
      // Wave 6: the lesson's own steps already show what it teaches (U15.L02 writes "V7/V", U16.L01 "iv"), and
      // the lens a step is about is shown whatever the learner's switch says (the beat grid in 6/8, the key ribbon
      // through U17).
      lessonId: loaded.context ?? def.id,
      ...(Object.keys(stepLenses(s)).length > 0 ? { musicLenses: stepLenses(s) } : {}),
      band,
      roll: {
        labels: moment.length > 0 && !featureSwitch.on ? labelsBefore(rollLabels, moment) : rollLabels,
        color: "part" as const,
      },
      ...(staff
        ? {
            staff: {
              kind: staff === "perc" ? ("percussion" as const) : staff,
              labels: workbenchStaffLabels(
                moment.length > 0 && !featureSwitch.on ? labelsBefore(staffLabels, moment) : staffLabels,
              ),
            },
          }
        : {}),
    };
  };
  if (status === "complete")
    return (
      <CompleteScreen
        lesson={def}
        completion={ctx.completion}
        sketchId={ctx.sketchId}
        wrapped={ctx.wrapReason === "wrap-up"}
        partA={ctx.wrapReason === "split"}
        preview={preview}
        inSession={inSession}
        content={bundle}
        side={props.side}
        origin={originLink(props.from)}
        nextSide={nextSideOf(def.id, bundle)}
      />
    );
  if (status === "wrapping")
    return (
      <QuickSketch
        code={latestCode(ctx)}
        partA={ctx.wrapReason === "split"}
        canCancel={ctx.wrapReason === "wrap-up"}
        busy={quickSaving}
        notice={ctx.notice}
        workbench={{ ...workbenchBase(step), views: ["roll"] }}
        defaultTitle={`${def.title} (quick sketch)`}
        onSave={(code, title) => actor.send({ type: "SAVE_QUICK", code, title })}
        onCancel={() => actor.send({ type: "CANCEL_WRAP" })}
      />
    );

  // --- the step on screen ------------------------------------------------------------------------------
  const st = ctx.states[step.id] ?? null;
  const p = progressOf(ctx, step.id);
  const seriesNo = st?.seriesNo ?? 0;
  const rawEx = step.exercise;
  const params = rawEx ? stepParams(def.id, rawEx, seriesNo) : {};
  const ex: Exercise | undefined = rawEx ? withParams(rawEx, params) : undefined;
  const trials = ex
    ? partsOf(ex).map((part) =>
        "stimulus" in part && part.stimulus?.src === "generator"
          ? stimulusTrial(
              part,
              def.id,
              seriesNo,
              profile,
              openCategories(part.stimulus.family, def.id, (l) => props.completed.has(l)),
            )
          : null,
      )
    : [];
  const generator = trials.some((t) => t !== null);
  const trial = ex && ex.kind !== "all" ? (trials[0] ?? null) : null;
  const rung = st?.rung ?? 0;
  // A revealed voicing-gate check never opens the gate: offer a fresh series (rung 0) to write it again.
  const freshGateTry = gateNeedsFreshTry(ctx.gate, ex ? globalExerciseId(def.id, ex) : null, rung);
  const passed = st?.passed === true || p.result?.status === "pass";
  // Looking back at a step, or any step of a completed lesson: it works as practice (the server stores it so).
  const review = ctx.index < ctx.furthest && (passed || p.done);
  // A verdict on screen locks the answer until "Try again" (docs/design/retry.md §2.5).
  const retried = ctx.retried[step.id] ?? 0;
  const shown = resultOnScreen(step, p, retried);
  // A verdict being saved has its own identity: the row moves the focus once it is saved (Continue opens then).
  const resultKey = shown
    ? `${step.id}:${seriesNo}:${ctx.resultNo}:${retried}:${checking ? "saving" : "saved"}`
    : null;
  const codeStep = ex !== undefined && partsOf(ex).some((x) => isCodeInput(x));
  const quietSing = ex?.kind === "sing" && props.voice.quiet;
  const practiceLine =
    ex && isCheckable(ex) && step.kind !== "make" && !quietSing
      ? retryLine({
          surface: ex.kind === "predict" ? "predict" : "lesson-step",
          counted: st?.practiceNext === true,
          revealed: rung >= 4 && !passed,
        })
      : null;
  const render = feedbackRenderer(
    catalogText,
    p.result,
    ex,
    (id) => bundle?.toolbox.find((t) => t.id === id)?.code ?? null,
  );

  const grade = async (response: AttemptResponse, override?: Exercise): Promise<GradeResult | null> => {
    const target = override ?? ex;
    if (!target) return null;
    actor.send({ type: "CHECK" });
    lastResponse.current.set(step.id, response);
    publishStepAnswer(
      step.id,
      tutorAnswerOf(target, response, { key: env.key, tolCents: profile.singTolCents }),
    );
    try {
      return await gradeStep(browserGrader, env, target, response, {
        params,
        attemptNo: (st?.attempts ?? 0) + 1,
        rung,
        extraReplays: 0,
        trial,
        trials,
        takeOf: lessonTakes,
        ...(step.kind === "make" ? unchangedOf(songTakeOf()) : {}),
      });
    } catch (e) {
      actor.send({ type: "CHECK_FAILED", message: e instanceof Error ? e.message : String(e) });
      return null;
    }
  };
  const gradeQuiet = async (response: AttemptResponse, override?: Exercise) => {
    const target = override ?? ex;
    if (!target) return null;
    // A stage checked on its own (a staged chord dictation) is what the learner has answered so far: the tutor
    // reads it as such. A Make's live check (code) is not an answer.
    if ("answer" in response)
      publishStepAnswer(
        step.id,
        tutorAnswerOf(target, response, { key: env.key, tolCents: profile.singTolCents }),
      );
    return gradeStep(browserGrader, env, target, response, {
      params,
      attemptNo: 1,
      rung,
      extraReplays: 0,
      trial,
      trials,
      ...(step.kind === "make" ? unchangedOf(songTakeOf()) : {}),
    });
  };

  /** Idempotent: renderers may call it from effects on every render. */
  const markDone = () => {
    if (actor.getSnapshot().context.done[step.id] !== true) actor.send({ type: "DONE", stepId: step.id });
  };
  dev.current = {
    trial: () => trials.find((t) => t !== null)?.expected ?? null,
    trials: () => trials.map((t) => t?.expected ?? null),
    // A drawn tap trial's targets in seconds from the stimulus start (what the pad's taps are graded against).
    tapTargets: () => {
      const t = trials.find((x) => x !== null);
      return t ? drawnTapTargets(t) : null;
    },
    submit: async (response) => {
      const result = await grade(response);
      if (result && ex) {
        const event = {
          type: "SUBMIT",
          response,
          result,
          extraReplays: 0,
          exercise: ex,
          seriesNo,
          params,
        } as const;
        // A SUBMIT while the previous attempt is still being posted is dropped by the machine: the hook waits for
        // a state that takes it (beside other suites a second answer sent right after a first one was lost).
        await waitFor(actor, (s) => s.can(event), { timeout: 30_000 });
        actor.send(event);
      }
      return result;
    },
  };
  const ladder = ladderOf(ex);
  const failed = p.result?.status === "fail";
  const graded = step.graded === true;
  const sendReport = async (note: string) => {
    setReportBusy(true);
    try {
      if (!preview)
        await callApi("qa.report", {
          body: {
            kind: "lesson-step",
            lessonId: def.id,
            stepId: step.id,
            exerciseId: ex?.id ?? null,
            exerciseVersion: ex?.version ?? null,
            familyId: trial?.family ?? null,
            trialSeed: trial?.seed ?? null,
            params: Object.keys(params).length > 0 ? params : null,
            response: lastResponse.current.get(step.id) ?? null,
            gradeResult: p.result,
            hintRung: rung,
            note: note || null,
            attemptId: attemptIds.current.get(step.id) ?? null,
          },
        });
      actor.send({ type: "DISPUTED", stepId: step.id });
      setReportOpen(false);
    } catch {
      actor.send({ type: "FAILED", message: "The report could not be saved." });
    } finally {
      setReportBusy(false);
    }
  };
  const refreshState = (delays: number[]) => {
    if (preview) return;
    for (const ms of delays)
      window.setTimeout(() => {
        void callApi("steps.state", { params: { id: def.id, stepId: step.id } })
          .then((s) => actor.send({ type: "STATE", state: s }))
          .catch(() => null);
      }, ms);
  };

  const testOutTarget = ctx.steps.find((s) => s.testOut?.skips.includes(step.id));
  const gateBox = gateBoxFor({
    ownerId: def.id,
    step,
    exercise: ex,
    gate: ctx.gate,
    result: p.result,
    code: codeOf(ctx, step),
  });
  // A side lesson's framing (Wave 5): on the step the visit opened at.
  const sideHere =
    props.side !== undefined && props.side !== null && ctx.index === (openedAt ?? ctx.range[0]);
  const sideText = props.side ? `${props.side.offer} ${props.side.note}` : "";
  const sideLeave = !inSession ? (
    <Link to={originLink(props.from).to} className={buttonClass("ghost", "sm")} data-testid="side-leave">
      Leave for now
    </Link>
  ) : undefined;
  const sideBox =
    sideHere && props.side ? (
      <div data-testid="side-lesson-note" className="mt-3">
        <Callout tone="info" title={props.side.heading} actions={sideLeave}>
          {sideText}
        </Callout>
      </div>
    ) : null;
  const banner: ReactNode = (
    <>
      {gateBox}
      {moment.length > 0 && (
        <FeatureMoment
          tools={moment}
          entries={bundle?.toolbox ?? []}
          on={featureSwitch.on}
          onReplay={featureSwitch.replay}
        />
      )}
      {/* Unit songs (spec §5.5 "Lesson"): the song card above the first step of today's part, not above a step
          the visit resumed at. A resumed step goes straight back to work: the card is about 250 px tall and above
          a mid-lesson step (U03.L09 S5's sight-sing) it pushed the step's own action (Sing) below the fold at
          1280×720. The song stays one click away (Today's hero, the Make's song strip). */}
      {/* A side lesson in a song says it is optional inside the song card (one box, so the first step's task
          stays on the first screen at 1280×800); with no card, its own box. */}
      {ctx.index === ctx.range[0] ? (
        <SongCard
          lessonId={def.id}
          side={
            sideHere && props.side ? { heading: props.side.heading, text: sideText, action: sideLeave } : null
          }
          orElse={sideBox}
        />
      ) : (
        sideBox
      )}
      {preview && ctx.index === ctx.range[0] && (
        <Callout tone="info" title="Preview" className="mt-3">
          {loaded.note ??
            (loadedSample(loaded)
              ? "The gate sample lesson: every exercise kind in one place. Nothing here is saved to your progress."
              : "This lesson isn't open in your course yet. Nothing here is saved.")}
        </Callout>
      )}
      {splitPart === "B" && ctx.index === ctx.range[0] && (
        <Callout tone="info" title="Part B" className="mt-3">
          Last time you got as far as “{ctx.steps[ctx.range[0] - 1]?.title ?? def.title}”. {def.objective}
        </Callout>
      )}
      {ctx.index < ctx.furthest && (
        <Callout
          tone="info"
          title="Looking back"
          className="mt-3"
          actions={
            <Button
              size="sm"
              onClick={() => actor.send({ type: "GOTO", stepId: ctx.steps[ctx.furthest]?.id ?? step.id })}
            >
              Back to step {ctx.furthest + 1}
            </Button>
          }
        />
      )}
      {testOutTarget && !p.done && (
        <Callout
          tone="info"
          title="Know this already?"
          className="mt-3"
          actions={
            <Button size="sm" onClick={() => actor.send({ type: "TEST_OUT", stepId: testOutTarget.id })}>
              Try the check
            </Button>
          }
        >
          Pass “{testOutTarget.title}” first time, without hints, and the steps before it are done.
        </Callout>
      )}
    </>
  );

  const host: StepHost = {
    mode: "lesson",
    lesson: def,
    step,
    exercise: ex,
    index: ctx.index,
    total: ctx.steps.length,
    params,
    seriesNo,
    state: st,
    result: p.result,
    rung,
    passed: passed || rung >= 4,
    checking,
    review,
    locked: shown,
    retake: retried,
    env,
    voice: props.voice,
    workbench: workbenchBase(step),
    song: step.kind === "make" && songMake.kind !== "none" ? songMake : null,
    trial,
    trials,
    code: ctx.code[step.id] ?? null,
    setCode: (code) => actor.send({ type: "CODE", code }),
    grade,
    gradeQuiet,
    preview: (result) => actor.send({ type: "LOCAL_RESULT", stepId: step.id, result }),
    setCheck: (fn) => {
      check.current = fn;
    },
    markDone,
    save: (code, title) => actor.send({ type: "SAVE_MAKE", code, title }),
    render,
    prose: loaded.Mdx ? (
      <MdxStepProvider
        value={{
          lesson: def,
          step,
          passed: passed || rung >= 4,
          content: bundle,
          markDone,
        }}
      >
        <loaded.Mdx components={lessonMdxComponents} />
      </MdxStepProvider>
    ) : null,
    banner,
    renderFooter: (actions) => (
      <StepFooter
        step={step}
        exercise={ex}
        ladder={ladder}
        rung={rung}
        revealAvailable={st?.revealAvailable === true}
        attempts={st?.attempts ?? 0}
        failed={failed}
        passed={passed}
        busy={checking}
        hintBusy={hintBusy}
        notice={ctx.notice}
        canContinue={canContinue(step, p)}
        resultKey={resultKey}
        onRetry={shown ? () => actor.send({ type: "TRY_AGAIN" }) : null}
        retryFocus={() => answerFocus(codeStep)}
        focusOnResult={ctx.resultNo > visit.current.resultNo}
        line={practiceLine}
        reasonId={checkReasonId("lesson", step.id)}
        continueLabel={
          ctx.splitPart === "A" && ctx.index >= ctx.range[1] ? "Finish part A" : continueLabel(step, p)
        }
        actions={actions}
        tutorAvailable={tutorAvailable}
        onHint={(reveal) => actor.send({ type: "HINT", reveal })}
        onContinue={() => actor.send({ type: "CONTINUE" })}
        onAsk={() => {
          const r = p.result?.status === "error" ? askExplain() : askChat("I'm stuck on this step.");
          if (r.ok) refreshState([4000]);
        }}
        onNudge={
          graded && !passed && ladder
            ? () => {
                const r = askHint();
                if (r.ok) refreshState([1500, 6000]);
              }
            : null
        }
        onReport={
          p.result && p.result.status !== "ungraded" && p.result.status !== "pass" && !p.disputed
            ? () => setReportOpen(true)
            : null
        }
        onNewSeries={
          (Object.keys(params).length > 0 || generator || freshGateTry) && !checking
            ? () => actor.send({ type: "NEW_SERIES" })
            : null
        }
        {...(freshGateTry ? { newSeriesLabel: "Start a fresh try" } : {})}
        continueNote={continueNote(step, ctx.gate)}
        onWrapUp={step.kind !== "make" && !preview ? () => actor.send({ type: "WRAP_UP" }) : null}
        // The lesson's own resting place (`wrapAt`), said once by the app rather than in every lesson's prose.
        // A 15-minute day already ends part A there, so the line is for the longer days only.
        stopPoint={
          !preview && step.id === def.wrapAt && passed && ctx.splitPart !== "A" && step.kind !== "make"
        }
        onDismissNotice={() => actor.send({ type: "DISMISS_NOTICE" })}
      />
    ),
  };

  const Renderer =
    step.kind === "make" && ex
      ? MakeRenderer
      : ex
        ? (rendererFor(ex.kind) as unknown as (p: Record<string, unknown>) => ReactNode)
        : ProseStep;
  const rendererProps = {
    lesson: def,
    step,
    index: ctx.index,
    total: ctx.steps.length,
    state: st,
    params,
    target,
    sessionId: sessionIdHere(),
    review,
    exercise: ex,
    lastResult: p.result,
    checking,
    answerWidgetFor: lessonWidgetFor,
    onCheck: (input: { response: AttemptResponse; result: GradeResult; extraReplays: number }) =>
      ex &&
      actor.send({
        type: "SUBMIT",
        response: input.response,
        result: input.result,
        extraReplays: input.extraReplays,
        exercise: ex,
        seriesNo,
        params,
      }),
    onHint: (reveal: boolean) => actor.send({ type: "HINT", reveal }),
    onNewSeries: () => actor.send({ type: "NEW_SERIES" }),
    onContinue: () => actor.send({ type: "CONTINUE" }),
    onCode: (code: string) => actor.send({ type: "CODE", code }),
  };
  return (
    <StepHostContext value={host}>
      <Renderer key={`${step.id}:${seriesNo}`} {...rendererProps} />
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSend={(n) => void sendReport(n)}
        busy={reportBusy}
      />
    </StepHostContext>
  );
}

const loadedSample = (l: LoadedLesson) => l.sample;

/** Steps without an exercise (`see`, `concept`, `reflect`): prose, and for reflect a can-do self-rating. */
function ProseStep() {
  const h = useStepHost();
  const [rating, setRating] = useState<string | null>(null);
  useEffect(() => {
    if (h.step.kind !== "reflect") h.markDone();
  }, [h.step.kind, h.markDone]);
  if (h.step.kind !== "reflect") return <StepLayout />;
  return (
    <StepLayout
      answer={
        <div role="radiogroup" aria-label="How sure are you?" className="flex flex-wrap gap-2">
          {["Not yet", "Getting there", "Yes"].map((r) => (
            <Button
              key={r}
              role="radio"
              aria-checked={rating === r}
              variant={rating === r ? "primary" : "secondary"}
              onClick={() => {
                setRating(r);
                h.markDone();
              }}
            >
              <InlineMd text={r} />
            </Button>
          ))}
        </div>
      }
    />
  );
}
