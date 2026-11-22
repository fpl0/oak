// The drill runner (ux §4.1 TrialFrame): one set from the first trial to its summary. The machine
// (machine.ts) decides; runtime.ts plays, captures and talks to the server; this file draws the frame —
// header (family, level, trial n of N, results so far), the stimulus panel, the answer surface, the feedback
// line and the key-labelled controls. Keyboard-first: digits answer inside the pad, Space or R replays, C
// replays the cadence, Enter checks or moves on, A plays the answer, P compares, Shift+S skips a sung part.
import {
  type Answer,
  type ChordQuality,
  type Degree,
  type DrillFinish,
  type FamilyDef,
  type FamilyId,
  type KeySpec,
  OakApiError,
  type Trial,
} from "@oak/api";
import { formLetters } from "@oak/content-kit";
import { labelPitch } from "@oak/theory";
import { useMachine } from "@xstate/react";
import { clsx } from "clsx";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { AnswerEnvProvider } from "../answers/env.tsx";
import { rnDisplay } from "../answers/keys.ts";
import { emptyValue, isComplete } from "../answers/response.ts";
import { type AnswerFeedback, type AnswerValue, AUTO_SUBMIT_KINDS } from "../answers/types.ts";
import { useLenses } from "../lib/lenses.ts";
import { useDrillSession } from "../lib/queries.ts";
import { useRunnerView } from "../session/hooks.ts";
import { clearSubject, debriefDrill, patchSubject, setSubject } from "../tutor/context.ts";
import { keyScope, useHotkeys } from "../ui/keys/KeymapProvider.tsx";
import type { Binding } from "../ui/keys/keymap.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Card, Chip, Kbd } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { ErrorState, LoadingState } from "../ui/kit/QueryState.tsx";
import { ResultActions } from "../ui/kit/ResultActions.tsx";
import { RecheckHint } from "../voice/panels.tsx";
import { reportTake } from "../voice/recheck.ts";
import { useVoiceSync } from "../voice/sync.ts";
import { useVoice } from "../voice/use-voice.ts";
import { answerWidgetLabel } from "./answer-label.ts";
import { drillWidgetFor } from "./answer-widget.tsx";
import {
  BASS_LINE_PROMPTS,
  DICTATION_PROMPTS,
  LINE_STEP_PROMPTS,
  levelMoveText,
  promptOf,
  STEP_PROMPTS,
  stageText,
  stepRetryText,
} from "./copy.ts";
import { DictationTools, isDictation, mineOf } from "./DictationTools.tsx";
import { ChordStrip, QualityRow, StepsSoFar, StepTrack } from "./HarmonyPanels.tsx";
import {
  bassAloneWhileAnswering,
  bassSingTargets,
  type ChordStep,
  chordSlotsOf,
  contextKeyOf,
  gradeStep,
  isBassTrial,
  isHarmonyTrial,
  slotLabels,
  slotRn,
  slotSymbol,
  stagedKeyOf,
  stepSpecOf,
} from "./harmony.ts";
import { clearInflight, inflightKey, loadInflight, resumeFromServer } from "./inflight.ts";
import { hidesNoteLenses, LensSwitches } from "./LensSwitches.tsx";
import { aloneLabel as aloneLabelOf, alonePlan } from "./listen.ts";
import {
  type DrillPurpose,
  drillMachine,
  onInnerStep,
  type ResumeState,
  type StepsState,
  shownOutcome,
} from "./machine.ts";
import {
  DICTATION_MODE_LABELS,
  type DictationMode,
  debriefTrials,
  dictationModesOf,
  dictationSurface,
  expectedText,
  expectedValueOf,
  type Surface,
  surfaceOf,
  type TrialOutcome,
  trialAnswerOf,
  wrongMarks,
} from "./model.ts";
import {
  answerPlan,
  comparePlan,
  cuePlan,
  isFetTrial,
  keyOfTrial,
  minePlan,
  resolutionOf,
  stagingOf,
  targetMidisOf,
} from "./plans.ts";
import { type DrillRowState, drillLine, drillResultKey } from "./retry.ts";
import { auditionCode, drillDeps, drillImplementations } from "./runtime.ts";
import { SetSummary } from "./SetSummary.tsx";
import { SingPanel } from "./SingPanel.tsx";
import { BarChart, SectionsBar } from "./StageEPanels.tsx";
import { FollowUpCard, KeyRibbon } from "./StageFPanels.tsx";
import { LaneTapPanel, QuietSingCard, RhythmLanesView } from "./StageGPanels.tsx";
import {
  expectedStaffValue,
  isStaffTrial,
  meterOf,
  pitchedTrial,
  RHYTHM_PITCH,
  staffAnswer,
} from "./staff.ts";
import { TapPanel } from "./TapPanel.tsx";
import { KeyHighlight, TrialStaff } from "./TrialVisual.tsx";
import type { DrillData } from "./use-drill-data.ts";
import { usePlanPlayer } from "./use-plan-player.ts";
import {
  bassLineCodeOf,
  bassLineTrialOf,
  bluesChartOf,
  formModeOf,
  foundBassOf,
  isBassLineTrial,
  playedSwung,
  rootsOf,
  rootsSpecOf,
  scalePlan,
  sectionPlan,
  sectionsOf,
  wayHomeText,
  withoutSeventhPlan,
} from "./wave5.ts";
import {
  chromaticAskedOf,
  clickCellsOf,
  clickCellText,
  followUpOf,
  keyChangeLabels,
  keyChangeLine,
  keyChangeOf,
  leanLabels,
  leanText,
  meterLine,
  modeLine,
  nearMissOf,
  outsideChordOf,
  outsideLine,
  pushLine,
  seventhFactsOf,
  seventhLine,
  wave6Alone,
} from "./wave6.ts";
import {
  isWave7Listen,
  lanesComparePlan,
  rhythmLanesOf,
  stageGFact,
  tapLanesOf,
  wave7Alone,
  wave7FollowUp,
  wave7Near,
} from "./wave7.ts";

export interface SetResult {
  drillSessionId: string | null;
  meanCredit: number | null;
  finish: DrillFinish | null;
  outcomes: TrialOutcome[];
  /** The level of the set's last trial (free practice continues from there). */
  lastLevel: number | null;
}

export interface DrillRunnerProps {
  data: DrillData;
  purpose: DrillPurpose;
  familyIds: FamilyId[];
  /** Shown in the header: the family's title, or the composite's. */
  title: string;
  warmupItemId?: string | null;
  sessionId?: string | null;
  /** Free practice: the level the staircase starts at. */
  practiceLevel?: number | null;
  /** Warm-up: open with an easy trial. */
  easyFirst?: boolean;
  /** FET sets: sung resolutions in this set (3 in the first set of the day, else 2). */
  sungResolutions?: number;
  /** "Set 2 of 4" inside a warm-up. */
  position?: { index: number; total: number } | null;
  continueLabel: string;
  onContinue(result: SetResult): void;
  /** More summary actions (free practice: "Another set"). */
  extraActions?: (result: SetResult) => ReactNode;
  /** Invalidates server state after the set (families, due, map). */
  onFinished?(finish: DrillFinish): void;
}

const INSTRUMENT_DRUMS = new Set(["bd", "sd", "hh", "oh", "rim", "cp", "cr", "rd", "lt", "mt", "ht", "cb"]);

function instrumentsOf(trial: Trial<unknown>): string[] {
  const out = new Set<string>();
  for (const e of trial.events) if (e.midi !== null && e.s && !INSTRUMENT_DRUMS.has(e.s)) out.add(e.s);
  return [...out];
}

function keyText(trial: Trial<unknown>): string | null {
  const k = keyOfTrial(trial);
  if (!k) return null;
  return `${k.tonic.replace(/b$/, "♭").replace(/#$/, "♯")} ${k.mode}`;
}

/**
 * The runner, after it knows whether a set is in flight: this browser's pointer is read back from the server
 * (`drills.get`), which holds every trial answered so far, so a reload continues from the server's record.
 */
export function DrillRunner(props: DrillRunnerProps) {
  // Quiet mode switched in another tab reaches this set at once (the QUIET event below follows voice.get).
  useVoiceSync();
  const key = inflightKey({
    warmupItemId: props.warmupItemId ?? null,
    familyIds: props.familyIds,
    purpose: props.purpose,
  });
  const [local] = useState(() => loadInflight(key));
  const detail = useDrillSession(local?.session.id ?? null);
  // Decided once: later renders (a refetch of the family data) must never touch the set that runs by then.
  const [settled, setSettled] = useState<{ resume: ResumeState | null } | null>(() =>
    local ? null : { resume: null },
  );
  useEffect(() => {
    if (settled || !local || detail.isPending) return;
    const notFound = detail.error instanceof OakApiError && detail.error.status === 404;
    const resume = resumeFromServer(local, detail.data ?? (notFound ? null : undefined));
    if (!resume) clearInflight(key);
    setSettled({ resume });
  }, [settled, local, detail.isPending, detail.error, detail.data, key]);
  if (!settled)
    return (
      <Card className="p-6">
        <LoadingState rows={3} label="Picking up the set" />
      </Card>
    );
  return <RunnerCore {...props} inflight={key} resume={settled.resume} />;
}

function RunnerCore(props: DrillRunnerProps & { inflight: string; resume: ResumeState | null }) {
  const { data, purpose, familyIds } = props;
  const key = props.inflight;
  const [machine] = useState(() =>
    drillMachine.provide(
      drillImplementations({
        registry: data.registry,
        defs: data.defs,
        states: data.states,
        profile: data.profile,
        easyFirst: props.easyFirst ?? false,
        sungResolutions: props.sungResolutions ?? 2,
        practiceLevel: props.practiceLevel ?? null,
        inflightKey: key,
        ...(props.onFinished ? { onFinished: props.onFinished } : {}),
      }),
    ),
  );
  const [resume] = useState(() => props.resume);
  const [snap, send] = useMachine(machine, {
    input: {
      purpose,
      familyIds,
      warmupItemId: props.warmupItemId ?? null,
      sessionId: props.sessionId ?? null,
      quiet: data.profile.quiet,
      tolCents: data.profile.singTolCents,
      resume,
      deps: drillDeps({ registry: data.registry, profile: data.profile }),
    },
  });
  const ctx = snap.context;
  // Quiet mode can change mid-set (the mic chip, Settings): the machine follows, and the runner reads Quiet mode
  // from the machine so what is shown and what is listened for always agree.
  const liveQuiet = data.profile.quiet;
  useEffect(() => {
    send({ type: "QUIET", quiet: liveQuiet });
  }, [liveQuiet, send]);
  const thread = { subjectKind: "drill" as const, subjectId: familyIds.join("+") };
  const region = useRef<HTMLDivElement>(null);

  // The tutor never sees a trial in progress (contracts §10.4); it opens again at the summary.
  useEffect(() => {
    setSubject({ thread, title: props.title, tutorOpen: false });
    return () => clearSubject(thread);
  }, []);
  const atSummary = snap.matches("summary");
  // At the summary the tutor gets the finished set, trial by trial (tutor/context.ts `debriefDrill`).
  useEffect(() => {
    if (atSummary)
      debriefDrill(thread, { family: props.title, trials: debriefTrials(ctx.trials, ctx.records) });
    else patchSubject(thread, { tutorOpen: false });
  }, [atSummary]);

  if (snap.matches("loading"))
    return (
      <Card className="p-6">
        <LoadingState rows={3} label="Preparing the set" />
        <p className="mt-2 text-sm text-text-3">Loading sounds for this set…</p>
      </Card>
    );
  if (snap.matches("failed") || snap.matches("finishFailed"))
    return (
      <Card className="p-6">
        <ErrorState
          error={new Error(ctx.error ?? "The set could not continue.")}
          onRetry={() => send({ type: "RETRY" })}
        />
        {snap.matches("finishFailed") && (
          <p className="mt-2 text-center text-sm text-text-3">
            Your answers are kept; retrying sends them again.
          </p>
        )}
      </Card>
    );
  if (atSummary) {
    const def = data.defs.get(familyIds[0] as string) as FamilyDef;
    const result: SetResult = {
      drillSessionId: ctx.session?.id ?? null,
      meanCredit: ctx.finish?.meanCredit ?? null,
      finish: ctx.finish,
      outcomes: ctx.outcomes,
      lastLevel: ctx.trials[ctx.trials.length - 1]?.level ?? null,
    };
    return (
      <SetSummary
        data={data}
        def={def}
        title={props.title}
        familyIds={familyIds}
        context={ctx}
        purpose={purpose}
        primary={
          <Button variant="primary" size="lg" autoFocus onClick={() => props.onContinue(result)}>
            {props.continueLabel} <Kbd tone="inverse">Enter</Kbd>
          </Button>
        }
        extra={props.extraActions?.(result)}
      />
    );
  }
  if (!ctx.current) return <LoadingState rows={2} />;
  return (
    <div
      ref={region}
      tabIndex={-1}
      {...keyScope("answer-pad")}
      className="outline-none"
      data-testid="drill-runner"
    >
      {/* A practice take ("Try again") opens the same trial afresh: a new answer, nothing carried over. */}
      <TrialView key={`${ctx.index}:${ctx.retries}`} props={props} snap={snap} send={send} region={region} />
    </div>
  );
}

const DIALOG_SELECTOR = 'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]';
const DIALOG_GRACE_MS = 500;

/** A dialog is on screen (a modal, the shortcut sheet, a popover dialog): focus is its business. */
function openDialog(): boolean {
  for (const el of document.querySelectorAll(DIALOG_SELECTOR)) {
    if (el instanceof HTMLDialogElement && !el.open) continue;
    if (el instanceof HTMLElement && el.getClientRects().length > 0) return true;
  }
  return false;
}

type Snap = ReturnType<typeof useMachine<typeof drillMachine>>[0];
type Send = ReturnType<typeof useMachine<typeof drillMachine>>[1];

function TrialView({
  props,
  snap,
  send,
  region,
}: {
  props: DrillRunnerProps;
  snap: Snap;
  send: Send;
  region: React.RefObject<HTMLDivElement | null>;
}) {
  const { data } = props;
  const lenses = useLenses();
  const player = usePlanPlayer();
  const voice = useVoice();
  const ctx = snap.context;
  const quietNow = ctx.input.quiet;
  const trial = (ctx.current as NonNullable<typeof ctx.current>).trial;
  const def = data.defs.get(trial.family) as FamilyDef;
  // Pads show syllables when the solfège lens is shown (wave3.md §4.3); the degree number is always printed.
  const solfegeShown = lenses.shown.solfege;
  const solfege = solfegeShown ? ("syllables" as const) : ("numbers" as const);
  // The verdict on screen: a practice take's while one is shown, else the trial's first answer (retry.md §3.3).
  const outcome = shownOutcome(ctx);
  const inFeedback = snap.matches("feedback") || snap.matches("resolution");
  const presenting =
    snap.matches({ trial: "presenting" }) ||
    snap.matches({ trial: "cueing" }) ||
    snap.matches({ trial: "bassAlone" });
  const answering = snap.matches({ trial: "answering" });
  // A sung trial waits for Start (clarity pass, 2026-11-22): nothing plays and the mic stays closed until then.
  const ready = snap.matches({ trial: "ready" });
  const singingPart = snap.matches({ trial: "singingPart" });
  const auditioning = snap.matches({ feedback: "auditioning" });
  const resolving = snap.matches({ resolution: "running" });
  const imagining = snap.matches({ resolution: "imagining" });
  const fet = isFetTrial(trial);
  const harmony = isHarmonyTrial(trial);
  // Rhythm and form families label no pitch: the note lenses would switch nothing on screen, so they are not shown.
  const unlabelled = hidesNoteLenses(def);
  // Stage D chord dictation: bass → quality → numerals, one step open at a time (the last one is the answer).
  const steps = ctx.steps;
  const lastStep = steps ? steps.order.length - 1 : 0;
  // A bass-line dictation (Wave 5) is staged too: the roots under the chords first, then the whole line.
  const lineStaged = isBassLineTrial(trial);
  const anyStep = steps
    ? ((inFeedback ? steps.order[lastStep] : steps.order[Math.min(steps.at, lastStep)]) ?? null)
    : null;
  const step: ChordStep | null = !lineStaged && anyStep ? (anyStep as ChordStep) : null;
  const lineStep: "bass" | "line" | null = lineStaged && anyStep ? (anyStep as "bass" | "line") : null;
  const innerStep = !inFeedback && onInnerStep(steps);
  // Melodic dictation from level 4: written as degrees, in code or on the staff (the learner's choice); a bass-degree
  // trial's roots on the pad, or its line as code or on the bass staff (Wave 5).
  const dictModes = dictationModesOf(trial, def);
  const [dictMode, setDictMode] = useState<DictationMode>(() =>
    isBassTrial(trial) ? "degrees" : preferredDictationMode(dictModes),
  );
  const bassMode = isBassTrial(trial) && dictModes.length > 0;
  const lineTrial = bassMode && dictMode !== "degrees" ? bassLineTrialOf(trial) : null;
  // The trial a written answer is read against (the bass line of a bass trial, else the trial itself).
  const answerTrial = lineTrial ?? trial;
  const formMode = formModeOf(trial);
  const surface: Surface =
    lineStep === "bass"
      ? {
          kind: "widget",
          spec: rootsSpecOf(trial, solfegeShown) as NonNullable<ReturnType<typeof rootsSpecOf>>,
        }
      : lineStep === "line" && dictModes.length === 0
        ? surfaceOf(trial, def, { solfege })
        : steps && step
          ? {
              kind: "widget",
              spec: stepSpecOf(trial, step, { syllables: solfegeShown }) as NonNullable<
                ReturnType<typeof stepSpecOf>
              >,
            }
          : dictModes.length > 0
            ? dictationSurface(trial, def, dictMode, { solfege })
            : surfaceOf(trial, def, { solfege });
  const spec = surface.kind === "widget" ? surface.spec : null;
  // One value per step (or per dictation mode), so moving on keeps what was written.
  const slotKey =
    step ?? (lineStep === "bass" ? "bass" : null) ?? (dictModes.length > 0 ? dictMode : (lineStep ?? "main"));
  const [values, setValues] = useState<Record<string, AnswerValue>>({});
  const value: AnswerValue | null =
    values[slotKey] ?? (spec ? (emptyValue(spec as never) as AnswerValue) : null);
  const setValue = (v: AnswerValue) => setValues((prev) => ({ ...prev, [slotKey]: v }));
  const qualityCount = step === "quality" ? chordSlotsOf(trial).length : 0;
  const dictation =
    isDictation(trial, def.generator) ||
    lineTrial !== null ||
    (lineStaged && lineStep === "line" && spec?.ui !== "degree-pad");
  // A staff answer is graded (and played back as "mine") as the code it spells (staff.ts).
  const staffTrial = spec?.ui === "staff-input";
  const mine =
    dictation && !inFeedback
      ? mineOf(answerTrial, staffTrial ? staffAnswer(answerTrial, String(value ?? ""))?.text?.[0] : value)
      : null;
  // A full pad checks itself, except in dictation (the learner plays theirs back first) and in a staged trial
  // (each step is checked with Enter).
  const autoSubmit = spec !== null && AUTO_SUBMIT_KINDS.includes(spec.ui) && !dictation && !steps;
  const isSing = surface.kind === "sing";
  // Wave 7: a sung trial in Quiet mode is heard in the head while it plays (the mic never opens), then Space.
  const quietSing = isSing && quietNow;
  const isTap = surface.kind === "tap";
  // The microphone failed mid-trial: Try again (listen again) and Skip singing are the row's.
  const micRow = ctx.micError !== null && !inFeedback;
  const total = ctx.source?.total ?? 0;
  const hasCue = !isTap && !isSing && cuePlan(trial, data.profile) !== null;
  const cueLabel = Number(trial.params.cueBars ?? 0) > 0 || harmony ? "Cadence" : "Hear the key";
  // A sung part before the pick (the roots of a bass-degree trial): never in Quiet mode.
  const sungPartOffered = isBassTrial(trial) && !quietNow;
  // The bass line by itself before the answer (a bass trial, a staged bass step): counts as a replay.
  const bassAloneNow =
    answering && bassAloneWhileAnswering(trial, steps ? (steps.order[steps.at] ?? null) : null);
  const sungPart = ctx.sungPart;
  // A trial read from the page (playFirst: false) is not played before the answer: its sound is the reveal.
  const staged = stagingOf(trial, data.profile);
  // A chord trial's "answer" is the passage itself (Hear it again): its own listening is bass, broken, in its key.
  const audibleAnswer = !harmony && answerPlan(trial).events.length > 0;
  const canReplay = inFeedback
    ? !resolving && (staged.stimulus !== null || audibleAnswer)
    : answering && (isTap || isSing || staged.stimulus !== null);
  const compare = outcome
    ? (lanesComparePlan(trial, ctx.captured.taps, ctx.captured.voices) ??
      comparePlan(trial, ctx.captured, outcome.sung))
    : null;
  const prevLevel = ctx.index > 0 ? ctx.trials[ctx.index - 1]?.level : undefined;
  const levelMove =
    props.purpose === "practice" && prevLevel !== undefined ? levelMoveText(prevLevel, trial.level) : null;
  const setLevel = ctx.session?.levels[trial.family] ?? trial.level;
  const shownLevel = props.purpose === "practice" ? trial.level : setLevel;
  const replayLimit = trial.cue.replays;
  // Wave 5, stage E: after every answer, the thing alone and the thing in context (the passage again), and where
  // it helps the other version (the other feel, the chord without its seventh) or the scale it was in.
  const stageEFamily = STAGE_E_LISTEN.has(trial.family) || fet;
  // Wave 6: the families of stages E–F and H name their own "alone" (the 3rd and 7th, the chord and where it
  // goes, the two homes, the kick), and every one of them can be heard against its near miss.
  // Wave 7: stage G, the rest of H and the sound families name their own "alone" and near miss too.
  const wave7 = isWave7Listen(trial);
  const aloneOk =
    wave7Alone(trial) !== null ||
    wave6Alone(trial) !== null ||
    (!harmony && stageEFamily && alonePlan(trial) !== null);
  const aloneLabel = aloneLabelOf(trial);
  const near = inFeedback
    ? (wave7Near(trial, def, ctx.captured.answer) ?? nearMissOf(trial, def, ctx.captured.answer))
    : null;
  // Wave 7: a two-lane take (one hand per pulse), the rhythm drawn as lanes once answered (the clave grid and the
  // pulse lanes follow their track lenses; an odd bar's groups are the answer itself), a sung trial in Quiet mode.
  const tapLanes = tapLanesOf(trial);
  const lanesDrawing = inFeedback ? rhythmLanesOf(trial) : null;
  const lanesShown =
    lanesDrawing !== null &&
    (trial.family === "fam.rhy.clave"
      ? lenses.track.shown.clave
      : trial.family === "fam.rhy.polyrhythm"
        ? lenses.track.shown.polyLanes
        : true);
  const trackLensIds =
    trial.family === "fam.rhy.clave"
      ? (["clave"] as const)
      : trial.family === "fam.rhy.polyrhythm"
        ? (["polyLanes"] as const)
        : ([] as const);
  const lean = chromaticAskedOf(trial) !== null;
  const keyChange = inFeedback ? keyChangeOf(trial) : null;
  const follow =
    snap.matches("feedback") && outcome && !outcome.result.skipped
      ? (followUpOf(trial, def) ?? wave7FollowUp(trial))
      : null;
  const [followPick, setFollowPick] = useState<string | null>(null);
  // Wave 7: "which key did it land in?" is asked by ear, so the key and the chords stay unsaid until it is answered.
  const keyAsked = follow !== null && followPick === null && wave7FollowUp(trial) !== null;
  const otherLabel =
    trial.family === "fam.rhy.swing"
      ? playedSwung(trial)
        ? "Hear it straight"
        : "Hear it swung"
      : withoutSeventhPlan(trial) !== null
        ? "Without its seventh"
        : null;
  const scaleOk = def.generator === "key-mode" && scalePlan(trial) !== null;
  const contextOk = harmony || stageEFamily || wave7 || formMode !== null || isBarChartFamily(def.generator);
  const sections = formMode ? sectionsOf(trial) : [];
  // After a stage E answer the passage again is the thing in context (R, and K as for chords).
  const contextAgain = snap.matches("feedback") && !harmony && contextOk;
  const chart = bluesChartOf(trial, def);

  // Focus: the pad while answering (widgets focus themselves), the region otherwise so the keys keep working.
  // Dev only (tree-shaken from production): the trial on screen, for the browser suites' right answers.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (globalThis as { __oakDrillTrial?: Trial }).__oakDrillTrial = trial;
      // A staff trial's answer as the staff writes it (the browser suites type it into the typed alternative).
      (globalThis as { __oakDrillStaffAnswer?: string | null }).__oakDrillStaffAnswer = isStaffTrial(trial)
        ? expectedStaffValue(trial)
        : null;
      // A staged trial's three answers as @oak/theory reads them (bass degrees, qualities, numerals).
      (globalThis as { __oakDrillSteps?: unknown }).__oakDrillSteps = stagedKeyOf(trial);
      // Wave 6: the cells of a push trial as the grid counts them, and the second question's answer.
      (globalThis as { __oakDrillCells?: unknown }).__oakDrillCells = clickCellsOf(trial)?.expected ?? null;
      // The answer widget's spec as the trial opens (pad keys and choice labels, in the order the widget draws).
      (globalThis as { __oakDrillSpec?: unknown }).__oakDrillSpec =
        surfaceOf(trial, def).kind === "widget" ? (surfaceOf(trial, def) as { spec: unknown }).spec : null;
      (globalThis as { __oakDrillFollow?: unknown }).__oakDrillFollow =
        followUpOf(trial, def) ?? wave7FollowUp(trial);
      // Wave 7: a two-lane take's lanes (each hand's targets, in seconds from the response window).
      (globalThis as { __oakDrillLanes?: unknown }).__oakDrillLanes = tapLanesOf(trial);
      // Wave 5: a bass trial's roots and its line as the learner would write it in code.
      const line = isBassTrial(trial) ? bassLineTrialOf(trial) : null;
      const ak = line?.params.answerKey as { key: KeySpec; octave: number } | undefined;
      (globalThis as { __oakDrillBassLine?: unknown }).__oakDrillBassLine =
        line && ak && bassLineCodeOf(trial)
          ? {
              code: `${bassLineCodeOf(trial)}.scale("${ak.key.tonic}${ak.octave}:${ak.key.mode}")`,
              roots: rootsOf(trial),
              staged: isBassLineTrial(trial),
            }
          : null;
    }
  }, [trial, def]);

  // Focus that falls to the page (a button that goes away under it: "I heard it", "Quiet mode for today", a
  // disabled control) comes back to the region, so the drill's keys keep working without the mouse — with focus
  // on <body> the region's Enter, digits and R were dead.
  // Never from a dialog: one that closes hands focus back to its own trigger (often a moment after it unmounts),
  // and one that is open keeps it. Focus that was in a dialog in the last half second is the dialog's business.
  useEffect(() => {
    let dialogAt = Number.NEGATIVE_INFINITY;
    const inDialog = (t: EventTarget | null) => t instanceof Element && t.closest(DIALOG_SELECTOR) !== null;
    const onIn = (e: FocusEvent) => {
      if (inDialog(e.target)) dialogAt = performance.now();
    };
    const onOut = (e: FocusEvent) => {
      if (inDialog(e.target) || openDialog()) {
        dialogAt = performance.now();
        return;
      }
      setTimeout(() => {
        if (openDialog() || performance.now() - dialogAt < DIALOG_GRACE_MS) return;
        if (document.activeElement === document.body || document.activeElement === null)
          region.current?.focus({ preventScroll: true });
      }, 30);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, [region]);

  // After the quiet "I heard it" button goes, focus comes back to the region (Enter moves on).
  // Wave 7: a sung trial in Quiet mode keeps focus on its "I heard it" button until it is answered.
  useEffect(() => {
    if (imagining || (quietSing && !inFeedback)) return;
    if (inFeedback || isTap || isSing) region.current?.focus({ preventScroll: true });
  }, [inFeedback, isTap, isSing, region, imagining, resolving, quietSing]);

  // The session's Pause (Alt+P) puts the page under an overlay: a sung part listening then stops at once (it
  // counts as skipped, no penalty), so the mic is never live behind "Paused".
  const sessionPaused = useRunnerView((v) => v.paused);
  const listening = (isSing && !quietSing && (presenting || answering)) || resolving || singingPart;
  useEffect(() => {
    if (sessionPaused && listening) {
      player.stop();
      send({ type: "SKIP_SUNG" });
    }
  }, [sessionPaused, listening, send, player]);

  // A finished sung take that heard no voice (or mostly noise) leaves the "re-run the quiet check" suggestion
  // (app/src/voice/recheck.ts), shown under the feedback; once per trial.
  const reported = useRef(false);
  const footer = useRef<HTMLElement>(null);
  const verdictId = useId();
  useEffect(() => {
    if (!outcome || !isSing || reported.current || outcome.result.skipped) return;
    reported.current = true;
    const frames = ctx.captured.frames;
    if (frames)
      reportTake({
        diagnostics: outcome.result.diagnostics,
        frames,
        floorDb: data.profile.noiseFloorDb ?? null,
      });
  }, [outcome, isSing, ctx.captured.frames, data.profile.noiseFloorDb]);

  // The sung roots prefill the pad (up to the first one no steady note reached); the learner checks them.
  const prefilled = useRef<unknown>(null);
  useEffect(() => {
    if (!sungPart || sungPart.skipped || prefilled.current === sungPart) return;
    prefilled.current = sungPart;
    const heard: Degree[] = [];
    for (const d of sungPart.degrees) {
      if (d === null) break;
      heard.push(d);
    }
    if (heard.length > 0)
      setValues((prev) => ({ ...prev, [lineStaged ? "bass" : bassMode ? "degrees" : "main"]: heard }));
  }, [sungPart, bassMode, lineStaged]);

  const complete = (v: AnswerValue | null): boolean => {
    if (!spec || v === null) return false;
    if (step === "quality") {
      const qs = v as (ChordQuality | undefined)[];
      return qs.length === qualityCount && qs.every((q) => q !== undefined);
    }
    return isComplete(spec, v);
  };
  const submit = (v: AnswerValue | null = value) => {
    if (!spec || v === null) return;
    if (!complete(v)) return;
    player.stop();
    const answer =
      step === "quality"
        ? { qualities: v as ChordQuality[] }
        : spec.ui === "staff-input"
          ? staffAnswer(answerTrial, v as string)
          : trialAnswerOf(trial, spec, v);
    if (answer === null) return;
    // An inner step (bass, quality) is checked on its own; the last step is the trial's answer.
    send(innerStep ? { type: "STEP_CHECK", answer } : { type: "SUBMIT", answer });
  };
  const change = (v: AnswerValue) => {
    setValue(v);
    if (autoSubmit && spec && complete(v)) submit(v);
  };

  const bindings: Binding[] = [
    {
      id: "drill-replay",
      keys: "R",
      scope: "answer-pad",
      group: "Drills",
      description: "Hear it again",
      when: () => canReplay,
      run: () => (inFeedback ? send({ type: "AUDITION", what: "again" }) : send({ type: "REPLAY" })),
    },
    {
      id: "drill-replay-space",
      keys: "Space",
      scope: "answer-pad",
      group: "Drills",
      description: "Hear it again (when no button has focus)",
      when: (k) => !k.onControl && canReplay,
      run: () => (inFeedback ? send({ type: "AUDITION", what: "again" }) : send({ type: "REPLAY" })),
    },
    {
      id: "drill-cue",
      keys: "C",
      scope: "answer-pad",
      group: "Drills",
      description: "Cadence (or the key) again",
      when: () => hasCue && (answering || snap.matches({ feedback: "idle" })),
      run: () => (inFeedback ? send({ type: "AUDITION", what: "cue" }) : send({ type: "CUE" })),
    },
    {
      id: "drill-answer",
      keys: "A",
      scope: "answer-pad",
      group: "Drills",
      description: fet ? "Hear it resolve" : "Hear the answer",
      when: () => snap.matches("feedback") && audibleAnswer,
      run: () => send({ type: "AUDITION", what: "answer" }),
    },
    {
      id: "drill-compare",
      keys: "P",
      scope: "answer-pad",
      group: "Drills",
      description: "Compare: yours, then the answer",
      when: () => snap.matches("feedback") && compare !== null,
      run: () => send({ type: "AUDITION", what: "compare" }),
    },
    {
      id: "drill-play-mine",
      keys: "P",
      scope: "answer-pad",
      group: "Drills",
      description: "Play mine (dictation)",
      when: (k) => !k.inEditable && answering && mine !== null,
      run: () => {
        if (mine) player.play("mine", minePlan(trial, mine));
      },
    },
    {
      id: "drill-sing-part",
      keys: "V",
      scope: "answer-pad",
      group: "Drills",
      description: "Sing the roots before you pick them",
      when: (k) => !k.inEditable && answering && sungPartOffered,
      run: () => send({ type: "SING_PART" }),
    },
    {
      id: "drill-bass",
      keys: "B",
      scope: "answer-pad",
      group: "Drills",
      description: "Hear the bass alone",
      when: () => (snap.matches("feedback") && harmony) || bassAloneNow,
      run: () =>
        snap.matches("feedback") ? send({ type: "AUDITION", what: "bass" }) : send({ type: "BASS_ALONE" }),
    },
    {
      id: "drill-arpeggio",
      keys: "G",
      scope: "answer-pad",
      group: "Drills",
      description: "Hear the chords broken, note by note",
      when: () => snap.matches("feedback") && harmony,
      run: () => send({ type: "AUDITION", what: "arpeggio" }),
    },
    {
      id: "drill-context",
      keys: "K",
      scope: "answer-pad",
      group: "Drills",
      description: harmony ? "Hear it in its key" : "Hear it in context",
      when: () => snap.matches("feedback") && contextOk,
      run: () => send({ type: "AUDITION", what: harmony ? "context" : "again" }),
    },
    {
      id: "drill-alone",
      keys: "L",
      scope: "answer-pad",
      group: "Drills",
      description: `${aloneLabel}`,
      when: () => snap.matches("feedback") && aloneOk,
      run: () => send({ type: "AUDITION", what: "alone" }),
    },
    {
      id: "drill-other",
      keys: "O",
      scope: "answer-pad",
      group: "Drills",
      description: otherLabel ?? "The other version",
      when: () => snap.matches("feedback") && otherLabel !== null,
      run: () => send({ type: "AUDITION", what: "other" }),
    },
    {
      id: "drill-near",
      keys: "N",
      scope: "answer-pad",
      group: "Drills",
      description: near ? near.label : "Hear it against its near miss",
      when: () => snap.matches("feedback") && near !== null,
      run: () => send({ type: "AUDITION", what: "near" }),
    },
    ...(follow && followPick === null
      ? follow.options.map(
          (o, i): Binding => ({
            id: `drill-follow-${i + 1}`,
            keys: String(i + 1),
            scope: "answer-pad",
            group: "Drills",
            description: `One more for the ear: ${o.label}`,
            when: (k) => !k.inEditable && snap.matches("feedback"),
            run: () => setFollowPick(o.id),
          }),
        )
      : []),
    {
      id: "drill-scale",
      keys: "M",
      scope: "answer-pad",
      group: "Drills",
      description: "Hear the scale it was in",
      when: () => snap.matches("feedback") && scaleOk,
      run: () => send({ type: "AUDITION", what: "scale" }),
    },
    {
      id: "drill-heard",
      keys: "Space",
      scope: "answer-pad",
      group: "Drills",
      description: "Heard it in my head (Quiet mode)",
      when: () => imagining || (quietSing && (presenting || answering)),
      run: () => send({ type: "HEARD" }),
    },
    {
      id: "drill-next",
      keys: "Enter",
      scope: "answer-pad",
      group: "Drills",
      description: "Check, or next trial",
      when: (k) => !k.onControl && (inFeedback ? !resolving : answering && spec !== null),
      run: () => (imagining ? send({ type: "HEARD" }) : inFeedback ? send({ type: "NEXT" }) : submit()),
    },
    {
      id: "drill-skip-sung",
      keys: "Shift+S",
      scope: "answer-pad",
      group: "Drills",
      description: "Skip the sung part (no penalty)",
      when: () => (isSing && (ready || presenting || answering)) || resolving || imagining || singingPart,
      run: () => send({ type: "SKIP_SUNG" }),
    },
    {
      id: "drill-start",
      keys: "Enter",
      scope: "answer-pad",
      group: "Drills",
      description: "Start the sung trial",
      when: (k) => !k.onControl && ready,
      run: () => send({ type: "START" }),
    },
  ];
  // Only keys that work for this trial are registered, so the shortcut sheet lists exactly those.
  useHotkeys(
    bindings.filter(
      (b) =>
        (b.id !== "drill-cue" || hasCue) &&
        (b.id !== "drill-compare" || compare !== null) &&
        (b.id !== "drill-skip-sung" || isSing || trial.params.sungResolution === true || sungPartOffered) &&
        (b.id !== "drill-play-mine" || dictation) &&
        (b.id !== "drill-sing-part" || sungPartOffered) &&
        (!["drill-bass", "drill-arpeggio"].includes(b.id) || harmony) &&
        (b.id !== "drill-context" || contextOk) &&
        (b.id !== "drill-alone" || aloneOk) &&
        (b.id !== "drill-other" || otherLabel !== null) &&
        (b.id !== "drill-near" || near !== null) &&
        (b.id !== "drill-scale" || scaleOk) &&
        (b.id !== "drill-heard" || imagining),
    ),
  );

  const expected = trial.expected as Answer;
  const expectedValue = !spec
    ? null
    : spec.ui === "staff-input"
      ? expectedStaffValue(answerTrial)
      : formMode && spec.ui === "form"
        ? formMode.expected
        : expectedValueOf(spec, expected);
  const stepResult = steps && (step || lineStep) ? steps.results[(step ?? lineStep) as ChordStep] : undefined;
  const feedback: AnswerFeedback = innerStep
    ? stepResult && !stepResult.passed && stepResult.tries > 0
      ? { state: "wrong", marks: stepResult.marks.map((ok, part) => ({ part, ok })) }
      : { state: "idle" }
    : !outcome
      ? { state: "idle" }
      : outcome.result.correct
        ? { state: "correct" }
        : spec && expectedValue !== null
          ? {
              state: "revealed",
              correct: expectedValue as AnswerValue,
              ...(spec.ui === "staff-input" ? {} : { marks: wrongMarks(spec, value, expectedValue) }),
            }
          : { state: "wrong" };
  // The answers registry draws every widget; the form answer has a runner fallback until the registry has one.
  const Widget = spec ? drillWidgetFor(spec) : null;
  // After a key change every chord is read in the key in force at its bar, never in the first key.
  const chordLabels =
    harmony && inFeedback
      ? keyChange?.to
        ? keyChangeLabels(trial, lenses.chords.shown)
        : slotLabels(trial, lenses.chords.shown)
      : [];
  const stage = imagining
    ? "Hear it in your head, then press Space."
    : tapLanes && ctx.stage === "respond"
      ? "Your turn: F for the left hand, J for the right."
      : quietSing && ctx.stage === "listen"
        ? "Hear it in your head while it plays…"
        : stageText(ctx.stage, trial.params.mode);
  const auditionText =
    ctx.audition === "resolve"
      ? "Hear it walk home…"
      : ctx.audition === "compare"
        ? "Yours, then it…"
        : "Playing…";
  const showKey = typeof trial.params.showKey === "number" ? trial.params.showKey : null;
  // The result row (docs/design/retry.md §2.2, §3.3): which result is on screen, and the primary's words. Its
  // primary keeps the drill's own test id ("next-trial"), which the drill, session and review suites address.
  const rowState: DrillRowState = snap.matches("feedback")
    ? "trial"
    : snap.matches({ resolution: "done" })
      ? "resolution"
      : "running";
  const resultKey = drillResultKey({ index: ctx.index, retries: ctx.retries, state: rowState });
  const continueLabel =
    snap.matches("feedback") && trial.params.sungResolution === true && !ctx.outcomes[ctx.index]?.revealed
      ? lean
        ? quietNow
          ? "Hear it lean"
          : "Sing the lean"
        : quietNow
          ? "Hear it home"
          : "Sing it home"
      : ctx.index + 1 < total
        ? "Next trial"
        : "Finish set";
  const singTargets = resolving
    ? resolutionOf(trial).targets
    : singingPart
      ? bassSingTargets(trial, data.profile)
      : ((trial.params.singTargets as { midi: number; on: number; off: number }[] | undefined) ?? []);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text-2">
            {props.position ? `Set ${props.position.index + 1} of ${props.position.total} · ` : ""}
            {props.title}
          </p>
          <h2 className="text-h3" data-testid="trial-prompt">
            {bassMode
              ? BASS_LINE_PROMPTS[dictMode]
              : dictModes.length > 0
                ? DICTATION_PROMPTS[dictMode]
                : promptOf(trial, def)}
          </h2>
          {steps && step && !inFeedback && (
            <p className="mt-0.5 text-sm text-text-2" data-testid="step-prompt">
              {STEP_PROMPTS[step]}
            </p>
          )}
          {lineStep && !inFeedback && (
            <p className="mt-0.5 text-sm text-text-2" data-testid="step-prompt">
              {LINE_STEP_PROMPTS[lineStep]}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Chip title={props.purpose === "practice" ? "Free practice adapts the level as you go" : undefined}>
            Level {shownLevel} of {def.levels.length}
          </Chip>
          <span className="text-sm tabular-nums text-text-2" data-testid="trial-counter">
            Trial {Math.min(ctx.index + 1, total)} of {total}
          </span>
          <TrialDots outcomes={ctx.outcomes} total={total} index={ctx.index} />
        </div>
      </header>

      <Card
        className={clsx(
          "flex flex-col items-center justify-center gap-3 p-5 text-center",
          // Once answered, a panel with nothing to look at gives its height to the answer and the listening.
          inFeedback && !chart && !keyChange && sections.length === 0 && trial.params.showStaff !== true
            ? "min-h-24"
            : "min-h-36",
        )}
        data-testid="stimulus-panel"
      >
        <div className="flex items-center gap-2 text-text-2" aria-live="polite">
          {(presenting || resolving || (ctx.stage !== null && !inFeedback)) && (
            <span
              aria-hidden
              className="size-2.5 animate-pulse rounded-full bg-accent reduced:animate-none"
            />
          )}
          <span data-testid="stage-text">
            {stage ??
              (inFeedback
                ? auditioning
                  ? auditionText
                  : "Listen back, try again, or move on."
                : answering
                  ? quietSing
                    ? "Hear it in your head, then press Space."
                    : isTap || isSing
                      ? "Ready."
                      : "Your turn."
                  : snap.matches({ trial: "bassAlone" })
                    ? "The bass alone…"
                    : ready
                      ? "Press Start when you are ready: you hear the note, then sing it back."
                      : "Getting ready…")}
          </span>
        </div>
        {trial.params.showStaff === true && <TrialStaff trial={trial} />}
        {chart && (
          <BarChart
            chart={chart}
            revealed={inFeedback}
            onPlayBar={(bar) => send({ type: "AUDITION", what: "part", part: bar })}
          />
        )}
        {sections.length > 0 && inFeedback && (
          <SectionsBar
            sections={sections}
            revealed={inFeedback}
            yours={
              inFeedback && ctx.captured.answer?.sections
                ? formLetters(ctx.captured.answer.sections).split("")
                : null
            }
            playing={ctx.audition === "part" ? ctx.auditionPart : null}
            onPlay={(i) => send({ type: "AUDITION", what: "part", part: i })}
          />
        )}
        {keyChange && (
          <KeyRibbon
            change={keyChange}
            onPlayBar={(bar) => send({ type: "AUDITION", what: "part", part: bar })}
          />
        )}
        {showKey !== null && <KeyHighlight highlight={showKey} />}
        {lanesShown && lanesDrawing && <RhythmLanesView lanes={lanesDrawing} />}
        {inFeedback && (keyText(trial) || harmony || instrumentsOf(trial).length > 0) && (
          <p className="text-sm text-text-3" data-testid="trial-details">
            {[
              keyChange?.to || keyAsked
                ? null
                : keyText(trial)
                  ? `In ${keyText(trial)}`
                  : harmony && contextKeyOf(trial)
                    ? `Heard in ${keyName(contextKeyOf(trial) as KeySpec)}`
                    : null,
              harmony ? loneChordText(trial, lenses.chords.shown) : null,
              noteNamesText(trial, lenses.shown),
              instrumentsOf(trial).join(", ") || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {levelMove && <p className="text-sm text-text-2">{levelMove}</p>}
      </Card>

      <section
        aria-label="Your answer"
        className={clsx("flex flex-col gap-3", !(steps && inFeedback) && "min-h-28")}
      >
        {steps && (
          <div className="flex flex-col gap-2">
            <StepTrack
              steps={steps}
              done={inFeedback}
              lastRight={outcome?.result.correct ?? true}
              {...(lineStaged ? { titles: LINE_STEP_TITLES } : {})}
            />
            {!inFeedback && step !== "quality" && !lineStaged && <StepsSoFar trial={trial} steps={steps} />}
            {!inFeedback && lineStep === "line" && <RootsFound trial={trial} steps={steps} />}
          </div>
        )}
        {dictModes.length > 0 && !inFeedback && lineStep !== "bass" && (
          <DictationModeSwitch
            modes={dictModes}
            mode={dictMode}
            labels={bassMode ? BASS_MODE_LABELS : undefined}
            onChange={(m) => {
              setDictMode(m);
              if (!bassMode) rememberDictationMode(m);
            }}
          />
        )}
        {/* Its Try again and Skip singing are the result row's (docs/design/retry.md §5 #19). */}
        {micRow && (
          <Callout tone="attention" title={quietNow ? "Quiet mode is on" : "The microphone is not available"}>
            {ctx.micError}
          </Callout>
        )}
        {isTap && tapLanes && (
          <LaneTapPanel
            trial={trial}
            lanes={tapLanes}
            stage={ctx.stage}
            done={inFeedback}
            taps={inFeedback ? ctx.captured.taps : null}
            voices={inFeedback ? (ctx.captured.voices ?? null) : null}
          />
        )}
        {isTap && !tapLanes && (
          <TapPanel
            trial={trial}
            stage={ctx.stage}
            done={inFeedback}
            taps={inFeedback ? ctx.captured.taps : null}
          />
        )}
        {quietSing && (presenting || answering) && (
          <QuietSingCard trial={trial} onHeard={() => send({ type: "HEARD" })} />
        )}
        {imagining && (
          <Card className="flex flex-col items-center gap-3 p-5 text-center" data-testid="quiet-resolution">
            <p className="text-text">
              Quiet mode: hear {lean ? "the lean" : "the way home"} again in your head.
            </p>
            <p className="text-sm text-text-2">Nothing is recorded, and nothing counts against you.</p>
            <Button variant="primary" autoFocus onClick={() => send({ type: "HEARD" })}>
              I heard it <Kbd tone="inverse">Space</Kbd>
            </Button>
          </Card>
        )}
        {((isSing && !quietNow) || (resolving && !quietNow) || singingPart) && (
          <SingPanel
            trial={trial}
            targets={singTargets}
            tolCents={data.profile.singTolCents}
            labels={
              (resolving ? leanLabels(trial, data.solfege === "syllables") : null) ??
              singLabelsOf(trial, singTargets, data.solfege)
            }
            active={ctx.stage === "sing"}
            micOpen={
              (presenting || resolving || singingPart) &&
              !ctx.micError &&
              (ctx.stage === "sing" || ctx.stage === "listen" || ctx.stage === "resolution")
            }
            label={
              resolving
                ? lean
                  ? "Sing the note, then the note it leans to."
                  : "Sing the way home."
                : singingPart
                  ? "Sing each root while its chord plays:"
                  : "Sing the note."
            }
            blind={singingPart ? [data.profile.comfLow - 3, data.profile.comfHigh + 3] : undefined}
          />
        )}
        {sungPart && !inFeedback && !singingPart && (
          <p className="text-sm text-text-2" data-testid="sung-part-line">
            {sungPart.skipped
              ? "Singing skipped. Pick the roots on the pad."
              : sungPart.degrees.some((d) => d !== null)
                ? `You sang ${sungPart.degrees.map((d) => (d === null ? "–" : d.replace(/^b/, "♭").replace(/^#/, "♯"))).join(" ")}. Check them on the pad, then press Enter.`
                : "No steady note reached the mic. Pick the roots on the pad."}
          </p>
        )}
        {step === "quality" && spec?.ui === "quality-pad" && !inFeedback && (
          <QualityRow
            spec={spec}
            count={qualityCount}
            value={(Array.isArray(value) ? value : []) as (ChordQuality | undefined)[]}
            onChange={(v) => setValue(v as unknown as AnswerValue)}
            onSubmit={() => submit()}
            disabled={!(answering || presenting)}
            marks={feedback.state === "wrong" ? (stepResult?.marks ?? null) : null}
            captions={qualityCaptions(trial)}
            idBase={`drill-${ctx.index}-quality`}
            autoFocus
          />
        )}
        {innerStep && stepResult && !stepResult.passed && stepResult.tries > 0 && (step || lineStep) && (
          <p className="text-sm text-text-2" data-testid="step-retry" role="status">
            {stepRetryText(lineStep ? "bass" : (step as ChordStep), stepResult.marks)}
          </p>
        )}
        {spec &&
          !resolving &&
          !singingPart &&
          step !== "quality" &&
          // A staged trial, once answered, is read in the strip below (bar by bar, yours where it differs).
          !(steps && inFeedback) &&
          (Widget ? (
            <AnswerEnvProvider
              value={{
                lenses: {
                  degrees: lenses.shown.degrees,
                  solfege: lenses.shown.solfege,
                  noteNames: lenses.shown.noteNames,
                  chordSymbols: lenses.chords.shown.chordSymbols,
                  romanNumerals: lenses.chords.shown.romanNumerals,
                },
                ...(staffTrial
                  ? {
                      staff: {
                        meter: meterOf(answerTrial),
                        sound: "piano",
                        // A drum rhythm is written on one pitch: letters and clicks place it, pitch keys are off.
                        ...(pitchedTrial(answerTrial) ? {} : { rhythmOnly: RHYTHM_PITCH }),
                      },
                    }
                  : {}),
                // Form by ear: a section block plays that section (P, or a click); a replay of part of it.
                ...(formMode && sections.length > 0 && !inFeedback
                  ? {
                      slots: {
                        play: (i: number) => {
                          const plan = sectionPlan(trial, i);
                          if (!plan) return;
                          send({ type: "LISTENED" });
                          player.play(`section${i}`, plan);
                        },
                      },
                    }
                  : {}),
                ...(harmony && keyOfTrial(trial)
                  ? {
                      harmony: {
                        key: keyOfTrial(trial) as KeySpec,
                        bpm: Number(trial.params.bpm ?? 90),
                        // c8: in the numerals step, the numerals that fit the bass the learner found are lit
                        // (in minor too: ♭3 ♭6 ♭7 are degrees like any other).
                        ...(step === "rn" && steps
                          ? (() => {
                              const found = foundBassOf(steps.results.bass, stagedKeyOf(trial)?.bass ?? []);
                              return found ? { bassDegrees: found } : {};
                            })()
                          : {}),
                      },
                    }
                  : {}),
              }}
            >
              <Widget
                spec={spec as never}
                value={value as never}
                onChange={(v) => change(v as AnswerValue)}
                onSubmit={() => submit()}
                disabled={inFeedback || singingPart}
                feedback={feedback}
                autoFocus={!inFeedback}
                label={answerWidgetLabel(spec)}
                solfege={solfegeShown ? "syllables" : "numbers"}
                {...(spec.ui === "choice" && spec.options.some((o) => o.audio)
                  ? { audition: auditionCode }
                  : {})}
                idBase={`drill-${ctx.index}`}
              />
            </AnswerEnvProvider>
          ) : (
            <Callout tone="info" title="This answer type is not available yet">
              Choose Show me to hear the answer and move on.
            </Callout>
          ))}
      </section>

      {dictation && (answering || presenting) && (
        <DictationTools
          trial={answerTrial}
          mine={mine}
          player={player}
          onSourceHeard={() => send({ type: "LISTENED" })}
        />
      )}

      {/* One live region for the whole trial, filled by its verdict (docs/design/retry.md §2.3): a region added
          together with its content is not announced, so the verdict would go unheard before the focus reaches
          Next trial. It reads out what the feedback says, before the row in reading order. */}
      <div role="status" id={verdictId} data-testid="trial-live" className={outcome ? undefined : "sr-only"}>
        {outcome && (
          <FeedbackLine
            outcome={outcome}
            text={
              lineTrial && bassLineCodeOf(trial)
                ? `${bassLineCodeOf(trial)}, roots ${expectedText(null, expected) ?? ""}`
                : (clickCellText(trial) ?? expectedText(spec, expected, data.solfege === "syllables"))
            }
            def={def}
            trial={trial}
            resolving={resolving || imagining}
            lean={lean}
            quiet={quietNow}
            resolutionDone={snap.matches({ resolution: "done" })}
            answer={ctx.captured.answer}
            micError={ctx.micError}
            onQuietToday={() => void voice.setQuiet(true, "today")}
            heardInHead={(ctx.practice ? quietNow : ctx.records[ctx.index]?.modality === "quiet") && isSing}
            practice={ctx.practice !== null}
          />
        )}
      </div>
      {outcome && isSing && !quietSing && inFeedback && <RecheckHint />}
      {fet &&
        outcome &&
        !outcome.result.skipped &&
        inFeedback &&
        (lean || wayHomeText(trial, data.solfege === "syllables")) && (
          <p className="text-sm text-text-2" data-testid="way-home">
            {lean
              ? `${leanText(trial, data.solfege === "syllables")}.`
              : `The way home: ${wayHomeText(trial, data.solfege === "syllables")}`}
          </p>
        )}
      {outcome && !outcome.result.skipped && inFeedback && !keyAsked && (
        <FactLine
          trial={trial}
          shown={{
            chordSymbols: lenses.chords.shown.chordSymbols,
            romanNumerals: lenses.chords.shown.romanNumerals,
            noteNames: lenses.shown.noteNames,
            syllables: lenses.shown.solfege,
          }}
        />
      )}
      {follow && <FollowUpCard follow={follow} picked={followPick} onPick={setFollowPick} />}
      {chordLabels.length > 0 && (
        <ChordStrip
          labels={chordLabels}
          title="The answer in context"
          {...(steps ? { yours: yoursOf(trial, ctx.captured.answer) } : {})}
        />
      )}

      <footer
        className={clsx(
          "border-t border-border pt-3",
          // d23: the primary action stays in view however tall the feedback above it grows (a long answer in
          // context, a second question, a key ribbon): the footer holds the bottom of the window.
          "sticky bottom-0 z-10 -mx-2 bg-bg px-2 pb-3",
        )}
        data-testid="trial-footer"
        ref={footer}
      >
        {/* The result row (docs/design/retry.md §2): auditions and lenses at the left; Check before an answer;
            after any result Try again (⌥R, a practice take of this trial) then the primary, which has the focus so
            Enter moves on. Nothing moves on by itself. */}
        <ResultActions
          resultKey={micRow ? `mic:${ctx.index}:${ctx.replays}` : resultKey}
          onRetry={
            micRow
              ? quietNow
                ? null
                : () => send({ type: "REPLAY" })
              : resultKey !== null
                ? () => send({ type: "RETRY" })
                : null
          }
          // A tapped take ends on the learner's keys: a late Space must never land on Next trial, so the focus
          // stays in the runner (Enter still moves on, ⌥R tries again).
          focusOnResult={!isTap}
          retryFocus={() =>
            region.current && !region.current.contains(document.activeElement) ? region.current : null
          }
          onContinue={
            inFeedback ? () => send({ type: "NEXT" }) : micRow ? () => send({ type: "SKIP_SUNG" }) : null
          }
          continueDisabled={resolving || imagining}
          continueLabel={micRow ? "Skip singing" : continueLabel}
          continueTestId="next-trial"
          // The focused Next trial / Try again also describe the verdict, for a reader that drops the live region.
          describedBy={outcome ? verdictId : undefined}
          continueKeys={micRow ? "Shift+S" : "Enter"}
          line={micRow ? null : drillLine(rowState)}
          action={
            (answering || (presenting && steps !== null)) &&
            spec &&
            !autoSubmit && (
              <Button
                variant="primary"
                disabled={value === null || !complete(value)}
                onClick={() => submit()}
                data-testid="check-answer"
              >
                {innerStep && lineStep
                  ? "Check the roots"
                  : innerStep && step
                    ? `Check the ${step === "bass" ? "bass" : "qualities"}`
                    : "Check"}{" "}
                {spec.ui === "code" ? null : <Kbd tone="inverse">Enter</Kbd>}
              </Button>
            )
          }
        >
          {ready && (
            <Button
              variant="primary"
              autoFocus
              onClick={() => send({ type: "START" })}
              data-testid="drill-start"
            >
              Start <Kbd tone="inverse">Enter</Kbd>
            </Button>
          )}
          {canReplay && (
            <Button
              onClick={() =>
                inFeedback ? send({ type: "AUDITION", what: "again" }) : send({ type: "REPLAY" })
              }
              {...(contextAgain ? { "data-testid": "hear-in-context" } : {})}
            >
              {contextAgain
                ? "Hear it in context"
                : isTap || isSing
                  ? inFeedback
                    ? "Hear it again"
                    : "Once more"
                  : "Hear it again"}{" "}
              <Kbd>R</Kbd>
            </Button>
          )}
          {hasCue && (answering || snap.matches({ feedback: "idle" })) && (
            <Button
              onClick={() => (inFeedback ? send({ type: "AUDITION", what: "cue" }) : send({ type: "CUE" }))}
            >
              {cueLabel} <Kbd>C</Kbd>
            </Button>
          )}
          {snap.matches("feedback") && audibleAnswer && (
            <Button onClick={() => send({ type: "AUDITION", what: "answer" })}>
              {fet ? "Hear it resolve" : "Hear the answer"} <Kbd>A</Kbd>
            </Button>
          )}
          {snap.matches("feedback") && compare && (
            <Button onClick={() => send({ type: "AUDITION", what: "compare" })}>
              Compare <Kbd>P</Kbd>
            </Button>
          )}
          {snap.matches("feedback") && harmony && (
            <>
              {/* A lone seventh chord's bass is its root: the 3rd and 7th are what there is to hear alone. */}
              {trial.family !== "fam.chd.quality-7th" && (
                <Button onClick={() => send({ type: "AUDITION", what: "bass" })} data-testid="hear-bass">
                  Bass alone <Kbd>B</Kbd>
                </Button>
              )}
              <Button onClick={() => send({ type: "AUDITION", what: "arpeggio" })} data-testid="hear-broken">
                Broken chords <Kbd>G</Kbd>
              </Button>
              <Button onClick={() => send({ type: "AUDITION", what: "context" })} data-testid="hear-context">
                In its key <Kbd>K</Kbd>
              </Button>
            </>
          )}
          {snap.matches("feedback") && aloneOk && (
            <Button onClick={() => send({ type: "AUDITION", what: "alone" })} data-testid="hear-alone">
              {aloneLabel} <Kbd>L</Kbd>
            </Button>
          )}
          {snap.matches("feedback") && near && (
            <Button onClick={() => send({ type: "AUDITION", what: "near" })} data-testid="hear-near">
              {near.label} <Kbd>N</Kbd>
            </Button>
          )}
          {snap.matches("feedback") && otherLabel && (
            <Button onClick={() => send({ type: "AUDITION", what: "other" })} data-testid="hear-other">
              {otherLabel} <Kbd>O</Kbd>
            </Button>
          )}
          {snap.matches("feedback") && scaleOk && (
            <Button onClick={() => send({ type: "AUDITION", what: "scale" })} data-testid="hear-scale">
              The scale <Kbd>M</Kbd>
            </Button>
          )}
          {bassAloneNow && (
            <Button onClick={() => send({ type: "BASS_ALONE" })} data-testid="hear-bass-now">
              Bass alone <Kbd>B</Kbd>
            </Button>
          )}
          {answering && sungPartOffered && (
            <Button onClick={() => send({ type: "SING_PART" })} data-testid="sing-part">
              Sing the roots <Kbd>V</Kbd>
            </Button>
          )}
          {(answering || presenting) && innerStep && (step || lineStep) && (
            <Button variant="ghost" onClick={() => send({ type: "STEP_REVEAL" })} data-testid="show-step">
              Show the {lineStep ? "roots" : step === "bass" ? "bass" : "qualities"}
            </Button>
          )}
          {answering && spec && !innerStep && (
            <Button variant="ghost" onClick={() => send({ type: "REVEAL" })}>
              Show me
            </Button>
          )}
          {((isSing && !quietSing && !micRow && (ready || presenting || answering)) ||
            resolving ||
            imagining ||
            singingPart) && (
            <Button variant="ghost" onClick={() => send({ type: "SKIP_SUNG" })}>
              Skip singing <Kbd>⇧S</Kbd>
            </Button>
          )}
          {answering && replayLimit >= 0 && ctx.replays > 0 && !isTap && !isSing && (
            <span className="text-sm text-text-3">
              {ctx.replays <= replayLimit
                ? `Replays ${ctx.replays} of ${replayLimit}`
                : "Extra replays count as help; that's fine."}
            </span>
          )}
          {/* Wave 7: the jazz families' sentences name chords, so their chord lenses switch here too. */}
          {!unlabelled && (
            <LensSwitches lenses={lenses} chords={harmony || trial.family.startsWith("fam.jzz.")} />
          )}
          {unlabelled && trackLensIds.length > 0 && (
            <LensSwitches lenses={lenses} notes={false} track={trackLensIds} />
          )}
        </ResultActions>
      </footer>
    </div>
  );
}

function TrialDots({
  outcomes,
  total,
  index,
}: {
  outcomes: readonly TrialOutcome[];
  total: number;
  index: number;
}) {
  return (
    <ol className="flex items-center gap-1" aria-label="Trials">
      {Array.from({ length: total }, (_, i) => {
        const o = outcomes[i];
        const state = !o
          ? i === index
            ? "current"
            : "todo"
          : o.result.skipped
            ? "skipped"
            : o.result.correct
              ? "right"
              : "missed";
        return (
          <li key={i} aria-current={i === index ? "step" : undefined}>
            <span className="sr-only">
              Trial {i + 1}:{" "}
              {state === "right"
                ? "right"
                : state === "missed"
                  ? "not this time"
                  : state === "skipped"
                    ? "skipped"
                    : state === "current"
                      ? "current"
                      : "to do"}
            </span>
            <span
              aria-hidden
              className={clsx(
                "block size-2.5 rounded-full",
                state === "right" && "bg-accent",
                state === "missed" && "border-2 border-accent-2",
                state === "skipped" && "border border-dashed border-text-3",
                state === "current" && "ring-2 ring-accent ring-offset-1 ring-offset-bg",
                (state === "todo" || state === "current") && "bg-border",
              )}
            />
          </li>
        );
      })}
    </ol>
  );
}

function FeedbackLine({
  outcome,
  text,
  def,
  trial,
  resolving,
  lean,
  quiet,
  resolutionDone,
  answer,
  micError,
  onQuietToday,
  heardInHead = false,
  practice = false,
}: {
  outcome: TrialOutcome;
  /** The sung part is a chromatic degree's lean to the note beside it, not the walk home. */
  lean: boolean;
  text: string | null;
  def: FamilyDef;
  trial: Trial;
  resolving: boolean;
  quiet: boolean;
  resolutionDone: boolean;
  answer: Answer | null;
  micError: string | null;
  onQuietToday(): void;
  /** Wave 7: a sung trial heard in the head in Quiet mode (its record says `quiet`). */
  heardInHead?: boolean;
  /** The verdict of a practice take ("Try again"), not of the first answer (docs/design/retry.md §3.3). */
  practice?: boolean;
}) {
  const r = outcome.result;
  let line: string;
  const mode = trial.params.mode;
  if (r.skipped && heardInHead)
    line =
      "Heard in your head. Nothing is recorded for it, and nothing counts against you. Hear the line to check yours.";
  else if (r.skipped) line = "Skipped. No penalty, and nothing counted.";
  else if (outcome.revealed) line = text ? `It was ${text}. Hear it, then move on.` : "Here is the answer.";
  else if (mode === "tap")
    line = r.correct ? "In time." : "Not quite in time yet. Hear it again, or compare.";
  else if (mode === "sing")
    line = r.correct
      ? "In tune."
      : outcome.sung?.[0]?.midi === null
        ? "No steady note reached the mic. Hum a little louder next time."
        : "Close. Hear the target, then compare.";
  else if (r.correct) line = text ? `That's it: ${text}.` : "That's it.";
  else line = text ? `It was ${text}.` : "Not this time.";
  const got = answer?.choice?.[0] ?? answer?.degrees?.[0] ?? answer?.qualities?.[0];
  const exp = (trial.expected as Answer).choice?.[0] ?? (trial.expected as Answer).degrees?.[0];
  const tip = !r.correct && got && exp ? def.confusionTips?.[`${exp}|${got}`] : undefined;
  return (
    <div
      data-testid="trial-feedback"
      data-correct={r.correct ? "true" : "false"}
      data-practice={practice ? "true" : undefined}
      className={clsx(
        "rounded-control border px-4 py-3",
        r.correct ? "border-accent/40 bg-lane-in" : "border-border bg-surface-2",
      )}
    >
      <p className="font-medium">{line}</p>
      {tip && <p className="mt-1 text-sm text-text-2">{tip}</p>}
      {(resolving || resolutionDone) && (
        <p className="mt-1 text-sm text-text-2">
          {resolving
            ? quiet
              ? `Listen to ${lean ? "the lean" : "the way home"}. It does not change this answer.`
              : `Now sing ${lean ? "the lean: the note, then the note it leans to" : "the way home"}. It does not change this answer.`
            : outcome.sungResolution?.skipped && micError && !quiet
              ? `${micError.split(". ")[0]?.replace(/\.$/, "")}, so the way home was not sung. No penalty.`
              : outcome.sungResolution?.skipped
                ? "Singing skipped. No penalty."
                : outcome.sungResolution?.quiet
                  ? lean
                    ? "Heard the lean, in your head."
                    : "Heard home, in your head."
                  : outcome.resolutionCredit !== null
                    ? outcome.resolutionCredit >= 0.8
                      ? lean
                        ? "Sung, and it leaned where it should."
                        : "Sung home, in tune."
                      : outcome.resolutionCredit >= 0.3
                        ? "Sung home. The trace shows where it drifted."
                        : "Sung. The trace shows where it was against the way home."
                    : "Resolution heard."}
        </p>
      )}
      {resolutionDone && outcome.sungResolution?.skipped && micError && !quiet && (
        <div className="mt-2">
          <Button size="sm" onClick={onQuietToday} data-testid="quiet-today">
            Quiet mode for today
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Wave 6: what the thing was, in one sentence under the feedback (the two notes that make a seventh chord's
 * quality, the chord from outside the key and where it leans, the one note that makes a mode, where home moved,
 * where the push sits, how a compound bar counts). Null for a trial that has no such fact.
 */
function factOf(
  trial: Trial,
  shown: { chordSymbols: boolean; romanNumerals: boolean; noteNames: boolean; syllables: boolean },
): string | null {
  // Wave 7: the ii–V and its key, the guide-tone line, the colour note, the substitute, the clave, the groups, the
  // pulses, how hard it swings, the sound change, who plays which role.
  const w7 = stageGFact(trial, shown);
  if (w7) return w7;
  const key = keyOfTrial(trial);
  const seventh = trial.family === "fam.chd.quality-7th" ? seventhFactsOf(trial) : null;
  if (seventh) return seventhLine(seventh, shown);
  const outside = outsideChordOf(trial);
  if (outside && key) return outsideLine(outside, key, shown);
  const change = keyChangeOf(trial);
  if (change) return keyChangeLine(change);
  if (trial.family === "fam.key.mode") return modeLine(trial);
  return pushLine(trial) ?? meterLine(trial);
}

function FactLine(props: {
  trial: Trial;
  shown: { chordSymbols: boolean; romanNumerals: boolean; noteNames: boolean; syllables: boolean };
}) {
  const fact = factOf(props.trial, props.shown);
  if (!fact) return null;
  return (
    <p className="text-sm text-text-2" data-testid="trial-fact">
      {fact}
    </p>
  );
}

/** The note names of the asked notes, when the note-name lens is shown ("F♯4"). */
function noteNamesText(trial: Trial, shown: { noteNames: boolean }): string | null {
  if (!shown.noteNames) return null;
  const key = keyOfTrial(trial) as KeySpec | undefined;
  const midis = targetMidisOf(trial).slice(0, 8);
  if (!key || midis.length === 0) return null;
  return midis.map((m) => labelPitch(m, key).display).join(" ");
}

/** Ribbon labels of sung targets: the degree, with its syllable once syllables are the singing labels (§8.3). */
function singLabelsOf(
  trial: Trial,
  targets: readonly { midi: number }[],
  labels: "numbers" | "syllables",
): string[] | undefined {
  const key = keyOfTrial(trial) as KeySpec | undefined;
  if (!key) return undefined;
  return targets.map((t) => {
    const l = labelPitch(t.midi, key);
    return labels === "syllables" ? `${l.degreeDisplay} · ${l.syllable}` : l.degreeDisplay;
  });
}

/** "B♭ major". */
function keyName(k: KeySpec): string {
  return `${k.tonic.replace(/b$/, "♭").replace(/#$/, "♯")} ${k.mode}`;
}

/** A lone chord's name and its numeral in the key it was heard in, as the chord lenses allow ("Bm · vi"). */
function loneChordText(
  trial: Trial,
  shown: { chordSymbols: boolean; romanNumerals: boolean },
): string | null {
  const slots = chordSlotsOf(trial);
  const key = contextKeyOf(trial);
  if (slots.length !== 1 || !key) return null;
  const parts = [
    shown.chordSymbols ? slotSymbol(slots, 0, key) : null,
    shown.romanNumerals ? slotRn(slots, 0, key) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const DICTATION_MODE_KEY = "oak.drills.dictation-mode";

/** A bass trial's answer modes: the roots on the pad, or the line as code or on the bass staff. */
const BASS_MODE_LABELS: Readonly<Record<DictationMode, string>> = {
  degrees: "Roots",
  code: "Line as code",
  staff: "Line on the staff",
};

/** A bass-line dictation's steps. */
const LINE_STEP_TITLES: Readonly<Record<string, string>> = { bass: "Roots", line: "Line" };

/** The roots settled in step 1 of a bass-line dictation, shown while the line is written. */
function RootsFound({ trial, steps }: { trial: Trial; steps: StepsState }) {
  const r = steps.results.bass;
  const roots: string[] = r?.revealed ? rootsOf(trial) : (r?.answer?.degrees ?? rootsOf(trial));
  return (
    <p className="text-sm text-text-2" data-testid="roots-found">
      Roots: {roots.map((d) => String(d).replace(/^b/, "♭").replace(/^#/, "♯")).join(" · ")}. Now the line:
      the root on beat 1, then what moves it on.
    </p>
  );
}

/** Stage E families with their own after-answer listening (Wave 5). */
const STAGE_E_LISTEN = new Set([
  "fam.rhy.swing",
  "fam.rhy.groove-lock",
  "fam.key.mode",
  // Wave 6: the push and the hats' division are heard alone and in the groove.
  "fam.rhy.syncopation",
  "fam.rhy.subdivision",
]);
const isBarChartFamily = (generator: string): boolean => generator === "form-blues";

/** The learner's last dictation mode (a per-viewer convenience; storage may be unavailable). */
function preferredDictationMode(modes: readonly DictationMode[]): DictationMode {
  let saved: string | null = null;
  try {
    saved = typeof localStorage === "undefined" ? null : localStorage.getItem(DICTATION_MODE_KEY);
  } catch {
    saved = null;
  }
  return modes.includes(saved as DictationMode) ? (saved as DictationMode) : (modes[0] ?? "code");
}
function rememberDictationMode(mode: DictationMode): void {
  try {
    localStorage.setItem(DICTATION_MODE_KEY, mode);
  } catch {
    // Not remembered: the next trial starts on its own mode.
  }
}

/** Degrees, code or the staff: how a written dictation is answered (from level 4). */
function DictationModeSwitch({
  modes,
  mode,
  labels,
  onChange,
}: {
  modes: readonly DictationMode[];
  mode: DictationMode;
  labels?: Readonly<Record<DictationMode, string>> | undefined;
  onChange(m: DictationMode): void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled group of toggle buttons
    <div
      role="group"
      aria-label="Write it as"
      className="flex flex-wrap items-center gap-1.5"
      data-testid="dictation-mode"
    >
      <span aria-hidden className="text-sm text-text-2">
        Write it as
      </span>
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={m === mode}
          onClick={() => onChange(m)}
          data-mode={m}
          className={clsx(
            "h-7 rounded-control border px-2.5 text-sm font-medium transition-colors duration-150",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            m === mode
              ? "border-accent bg-lane-in text-text"
              : "border-border bg-surface text-text-2 hover:text-text",
          )}
        >
          {(labels ?? DICTATION_MODE_LABELS)[m]}
        </button>
      ))}
    </div>
  );
}

/** "Chord 1 · bass 1": the quality step builds on the bass that is settled. */
function qualityCaptions(trial: Trial): string[] {
  const bass = stagedKeyOf(trial)?.bass ?? [];
  return bass.map((d, i) => `Chord ${i + 1} · bass ${d.replace(/^b/, "♭").replace(/^#/, "♯")}`);
}

/** The learner's numerals where they differ from the chords (by degree, quality and inversion), for the strip. */
function yoursOf(trial: Trial, answer: Answer | null): (string | null)[] {
  const got = answer?.rn ?? [];
  const marks = gradeStep(trial, "rn", { rn: got }).marks;
  return marks.map((ok, i) => (ok ? null : got[i] ? rnDisplay(got[i] as string) : "—"));
}
