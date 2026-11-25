// The step renderers (docs/design/wave2.md §3.2 `rendererFor`): one per exercise kind of contracts §5.4.
// Listen, predict, the Make and multi-part `all` steps have their own; every other kind (run, investigate,
// modify, fill, error hunt, order, quiz, ear, dictation, notation, sing, tap, transcription) is the single-input
// renderer over `PartInput`. Renderers grade in the browser through the host and report with `onCheck`.
import type { AllEx, Exercise, ExerciseKind, GradeResult } from "@oak/api";
import { Check, CircleDashed } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { AnswerSpec } from "../answers/types.ts";
import { useContent } from "../lib/content.ts";
import { useLessonSketch } from "../lib/queries.ts";
import { SaveLineButton } from "../studio/scraps/SaveLineButton.tsx";
import { IS_MAC } from "../ui/keys/KeymapProvider.tsx";
import { Button } from "../ui/kit/Button.tsx";
import { Kbd } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { LoadingState } from "../ui/kit/QueryState.tsx";
import type { LoopRegion } from "../workbench/loop-math.ts";
import { Workbench } from "../workbench/Workbench.tsx";
import { ByEarPanel } from "./byear.tsx";
import { CheckButton, quietIn, StepFeedback, useCheck } from "./check.tsx";
import { allCheckReason, checkReason } from "./check-reason.ts";
import { clearDraft, draftKey, keepsDraft, loadDraft, saveDraft } from "./drafts.ts";
import { EarAfter } from "./ear-after.tsx";
import { answerFeedback, revealValue } from "./feedback.ts";
import { InlineMd, StepLayout, useStepHost } from "./frame.tsx";
import {
  type InputRuntime,
  type InvestigateValue,
  initialInput,
  inputReady,
  inputResponse,
  isCodeInput,
  PartInput,
  StimulusView,
  starterOf,
} from "./inputs.tsx";
import { LeadSheetView, leadSheetOf } from "./lead-sheet.tsx";
import {
  fromSketchOf,
  type MakeSource,
  makeStart,
  makeStartNote,
  type OwnSketch,
  ownSketchOf,
  songStartNote,
  songTempoNote,
} from "./make-start.ts";
import { answerSpecOf, revealCode, withTrialOptions } from "./model.ts";
import { CodeMusic } from "./music.tsx";
import { PassiveListenRenderer } from "./passive.tsx";
import { failedChecks, isByEar, makeTitle, targetRollShown } from "./rules.ts";
import { SingRenderer } from "./sing.tsx";
import { holdsSongTempo, songSaveLine } from "./song-make.ts";
import {
  SideStepNote,
  type SongLoopNow,
  type SongMode,
  SongModeSwitch,
  SongPlayControls,
  SongStrip,
} from "./song-make-ui.tsx";
import { ByEarParts, StagedRenderer } from "./staged.tsx";
import { hasParts, isStaged } from "./stages.ts";
import { useTargetMarks } from "./target-marks.ts";
import type { ExerciseRenderer, ExerciseRendererProps, RendererFor } from "./types.ts";

type Part = Exclude<Exercise, AllEx>;

/** Rung 4 on a code step: the solution, with the lines that differ marked, and Apply. */
function RevealCard({ ex, current, apply }: { ex: Exercise; current: string; apply(code: string): void }) {
  const h = useStepHost();
  const code = revealCode(ex);
  if (h.rung < 4 || !code) return null;
  const mine = new Set(current.split("\n"));
  return (
    <section
      className="rounded-card border border-border bg-surface p-3"
      aria-label="The answer"
      data-testid="reveal"
    >
      <p className="text-sm font-medium">One way to write it</p>
      <pre className="mt-2 overflow-x-auto rounded-control bg-surface-2 p-2 font-mono text-sm leading-relaxed">
        {code.split("\n").map((line, i) => (
          <div key={`${i}-${line}`} className={mine.has(line) ? "" : "bg-accent/15"}>
            {line || " "}
          </div>
        ))}
      </pre>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={() => apply(code)} data-testid="apply-reveal">
          Use this code
        </Button>
        <span className="text-sm text-text-3">Highlighted lines differ from yours.</span>
      </div>
    </section>
  );
}

// --- unchecked answers kept over a reload (d4) ---------------------------------------------------------

interface DraftSlot {
  load(initial: unknown): unknown;
  save(value: unknown, initial: unknown): void;
  clear(): void;
}
const NO_DRAFT: DraftSlot = { load: () => null, save: () => {}, clear: () => {} };

function draftSlot(h: ReturnType<typeof useStepHost>, ex: Part, on: boolean): DraftSlot {
  const spec = answerSpecOf(ex);
  // Lesson steps only (a checkpoint keeps its own records), never a replayed step.
  if (!on || !spec || h.mode !== "lesson" || h.review || !keepsDraft(spec)) return NO_DRAFT;
  const key = draftKey({
    ownerId: h.lesson.id,
    stepId: h.step.id,
    seriesNo: h.seriesNo,
    exerciseId: ex.id,
  });
  return {
    load: (initial) => loadDraft(key, spec, initial),
    save: (value, initial) => saveDraft(key, value, initial),
    clear: () => clearDraft(key),
  };
}

function useDraft(ex: Part, on: boolean): DraftSlot {
  return draftSlot(useStepHost(), ex, on);
}

function useDrafts(parts: readonly Part[]): DraftSlot[] {
  const h = useStepHost();
  return parts.map((p) => draftSlot(h, p, true));
}

// --- the single-input renderer ----------------------------------------------------------------------

function SingleRenderer(props: ExerciseRendererProps) {
  const h = useStepHost();
  const ex = h.exercise as Part;
  const rt = useRef<InputRuntime>({ tapStart: null, plays: 0 }).current;
  const code = isCodeInput(ex);
  // d4: an unchecked form, scale, chart or line of numerals is kept on this device and comes back after a reload.
  const draft = useDraft(ex, !code);
  const [local, setLocal] = useState<unknown>(() => {
    const v = initialInput(ex, h.trial);
    if (ex.kind === "run-investigate" && h.code !== null) return { ...(v as InvestigateValue), code: h.code };
    return draft.load(v) ?? v;
  });
  const value = code ? (h.code ?? starterOf(ex).code) : local;
  const setValue = (v: unknown) => {
    if (code) h.setCode(v as string);
    else {
      setLocal(v);
      draft.save(v, initialInput(ex, h.trial));
      if (ex.kind === "run-investigate") h.setCode((v as InvestigateValue).code);
    }
  };
  // A by-ear step in parts opens its Check once every part passed (or the step is revealed).
  const [parts, setParts] = useState<{ ready: boolean; track: string | null }>(() => ({
    ready: !hasParts(ex),
    track: hasParts(ex) ? (ex.byEar.parts[0]?.track ?? null) : null,
  }));
  const onPartsState = useCallback((s: { ready: boolean; track: string | null }) => setParts(s), []);
  const ready = inputReady(ex, value, h.trial) && parts.ready;
  const isRun = ex.kind === "run-investigate" && ex.questions.length === 0;
  const { check, checked } = useCheck(
    props,
    () => {
      if (!ready) return null;
      // Checked: the answer is the server's now, the kept copy goes.
      draft.clear();
      return inputResponse(ex, value, rt, h.trial);
    },
    rt,
    // Code is fixed in the editor with the verdict in view: Run and Mod+Shift+Enter check again from there.
    { whileLocked: code },
  );
  const spec: AnswerSpec | null = withTrialOptions(answerSpecOf(ex), h.trial);
  const reason = code || ready ? null : checkReason(ex, value, initialInput(ex, h.trial), h.trial);
  const feedback =
    quietIn(h.mode, h.checking) ??
    answerFeedback({
      result: h.result,
      checking: h.checking,
      rung: h.rung,
      spec,
      reveal: revealValue(ex, spec, h.trial),
    });
  const autoCheck =
    "code" in ex && typeof ex.code === "object" && ex.code !== null && "autoCheckOnRun" in ex.code
      ? ex.code.autoCheckOnRun !== false
      : true;
  const common = {
    ex,
    value,
    onChange: setValue,
    wbId: `l-${h.step.id.toLowerCase()}-${h.seriesNo}`,
    feedback,
    result: h.result,
    rung: h.rung,
    disabled: h.checking,
    locked: h.locked,
    retake: h.retake,
    onSubmit: () => void check(),
    runtime: rt,
    trial: h.trial,
    passed: h.passed,
    workbenchFeedback: code && h.mode === "lesson",
    autoFocus: !code && ex.kind !== "run-investigate",
    onRun: () => {
      if (isRun || ex.kind === "run-investigate") h.markDone();
      // ux §3.5: after the first explicit Check, every successful Run checks again.
      if (code && checked && autoCheck && !h.passed) void check();
    },
  };
  const passedNow = h.passed;
  const showTarget = targetRollShown(ex, {
    failed: failedChecks(h.state, passedNow),
    passed: passedNow,
    rung: h.rung,
  });
  const reference = showTarget ? revealCode(ex) : null;
  const refBars = "reference" in ex && ex.reference && "bars" in ex.reference ? ex.reference.bars : 1;
  // A lead sheet beside the Workbench of a "play from the page" step (answer kinds show it with the stimulus).
  const lead = isCodeInput(ex) ? leadSheetOf(h.step, ex) : null;
  // A dictation from the page (not by ear), or a staff read back in code (U13.L05 S6): the music to write down
  // stays in view above the editor.
  const fromPage = !lead && ((ex.kind === "dictation" && !isByEar(ex)) || (code && ex.kind === "staff-read"));
  const stage = (
    <div className="flex flex-col gap-3">
      {lead ? <LeadSheetView spec={lead} /> : null}
      {fromPage ? <StimulusView ex={ex} /> : null}
      {reference ? (
        <div data-testid="target-roll">
          <p className="mb-1 text-sm font-medium">The target, on the roll</p>
          <CodeMusic code={reference} bars={refBars} view="roll" label="The target on the roll" />
        </div>
      ) : null}
      <PartInput {...common} slot="stage" />
    </div>
  );
  const hasStage = code || ex.kind === "code-fill" || ex.kind === "run-investigate";
  return (
    <StepLayout
      {...(hasStage ? { stage } : {})}
      answer={
        <>
          {isByEar(ex) ? <ByEarPanel ex={ex} track={parts.track} /> : null}
          {hasParts(ex) && typeof value === "string" ? (
            <ByEarParts code={value} onState={onPartsState} />
          ) : null}
          <PartInput {...common} slot="answer" />
          {isRun ? (
            <p className="text-sm text-text-2">
              Press <Kbd>{IS_MAC ? "⌘↵" : "Ctrl+Enter"}</Kbd> in the editor, or Play, and watch the roll.
            </p>
          ) : null}
          <StepFeedback detail={!code} />
          <EarAfter ex={ex} trial={h.trial} value={value} />
          {code || ex.kind === "code-fill" ? (
            <RevealCard ex={ex} current={typeof value === "string" ? value : ""} apply={(c) => setValue(c)} />
          ) : null}
        </>
      }
      actions={
        isRun ? null : (
          <CheckButton onClick={() => void check()} disabled={!ready || h.checking} reason={reason} />
        )
      }
    />
  );
}

// --- listen -------------------------------------------------------------------------------------------

function ListenRenderer() {
  const h = useStepHost();
  const ex = h.exercise as Extract<Exercise, { kind: "listen" }>;
  if (ex.passive) return <PassiveListenRenderer />;
  return <ListenItems />;
}

function ListenItems() {
  const h = useStepHost();
  const ex = h.exercise as Extract<Exercise, { kind: "listen" }>;
  const [i, setI] = useState(0);
  const item = ex.items[i] ?? ex.items[0];
  const timer = useRef<number | null>(null);
  // Loops heard through at least once. The step completes (and its pass text, the reveal of what to notice,
  // appears) only when every loop has been heard: with two loops to compare, the reveal after the first would
  // give the comparison away before the second had played.
  const heard = useRef<Set<number>>(new Set());
  const [heardCount, setHeardCount] = useState(0);
  // A loop chosen with its button starts playing at once (A/B listening), and its editor reports the run, so the
  // switch counts towards "heard"; the first loop waits for the learner's Play.
  const [switched, setSwitched] = useState(false);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const markDone = h.markDone;
  if (!item) return <StepLayout />;
  return (
    <StepLayout
      stage={
        <div className="flex flex-col gap-3">
          {ex.items.length > 1 && (
            <fieldset className="flex gap-2">
              <legend className="sr-only">Loops</legend>
              {ex.items.map((it, n) => (
                <Button
                  key={it.code}
                  size="sm"
                  variant={n === i ? "primary" : "secondary"}
                  aria-pressed={n === i}
                  onClick={() => {
                    if (timer.current !== null) window.clearTimeout(timer.current);
                    setI(n);
                    setSwitched(true);
                  }}
                >
                  Loop {n + 1}
                </Button>
              ))}
            </fieldset>
          )}
          <p className="text-sm text-text-2">
            <InlineMd text={item.caption} />
          </p>
          <Workbench
            {...h.workbench}
            id={`l-${h.step.id.toLowerCase()}-${i}`}
            code={item.code}
            readOnly
            autoPlay={switched}
            lessonCtx={{ ...h.workbench.lessonCtx, loopBars: item.bars }}
            onEvaluated={(o) => {
              if (!o.ok) return;
              // ux §3.2: a listen step is complete once one full loop has played; with several loops, once each
              // of them has.
              if (timer.current !== null) window.clearTimeout(timer.current);
              const loopMs = (item.bars / (o.cps ?? 0.5)) * 1000;
              const n = i;
              timer.current = window.setTimeout(() => {
                heard.current.add(n);
                setHeardCount(heard.current.size);
                if (heard.current.size >= ex.items.length) markDone();
              }, loopMs);
            }}
          />
        </div>
      }
      answer={
        <p className="text-sm text-text-2" data-testid="listen-progress">
          {ex.items.length > 1 ? (
            heardCount >= ex.items.length ? (
              ex.items.length === 2 ? (
                "Both heard. Play either one again to compare."
              ) : (
                "All heard. Play any of them again to compare."
              )
            ) : (
              <>
                Press Play (or <Kbd>Space</Kbd> on the workbench) and hear each loop all the way through.{" "}
                {heardCount > 0 ? `${heardCount} of ${ex.items.length} heard.` : null}
              </>
            )
          ) : (
            <>
              Press Play (or <Kbd>Space</Kbd> on the workbench) and listen to the whole loop.
            </>
          )}
        </p>
      }
    />
  );
}

// --- predict ------------------------------------------------------------------------------------------

function PredictRenderer(props: ExerciseRendererProps) {
  const h = useStepHost();
  const ex = h.exercise as Extract<Exercise, { kind: "predict" }>;
  const rt = useRef<InputRuntime>({ tapStart: null, plays: 0 }).current;
  const [value, setValue] = useState<unknown>(() => initialInput(ex));
  // The outcome is on screen once a guess is locked in (here, or before a reload) until "Try again" re-opens the
  // guess; a second guess is practice (the first gave the evidence, docs/design/retry.md §3.1).
  const answered = h.locked;
  const ready = inputReady(ex, value);
  const { check } = useCheck(props, () => (ready ? inputResponse(ex, value, rt) : null), rt);
  useEffect(() => {
    if (answered) h.markDone();
  }, [answered, h.markDone]);
  const right = h.result ? h.result.score >= 1 : null;
  return (
    <StepLayout
      stage={
        answered ? (
          <Workbench
            {...h.workbench}
            id={`l-${h.step.id.toLowerCase()}-run`}
            code={ex.code}
            readOnly
            lessonCtx={{ ...h.workbench.lessonCtx, loopBars: ex.bars }}
          />
        ) : (
          <figure className="rounded-card border border-border bg-surface p-3">
            <figcaption className="mb-2 text-sm text-text-2">
              The code. Read it, then make your guess.
            </figcaption>
            <pre className="overflow-x-auto font-mono text-sm leading-relaxed" data-testid="predict-code">
              {ex.code}
            </pre>
          </figure>
        )
      }
      answer={
        <>
          <PartInput
            ex={ex}
            value={value}
            onChange={setValue}
            slot="answer"
            wbId={`l-${h.step.id.toLowerCase()}`}
            feedback={{ state: "idle" }}
            result={null}
            rung={0}
            disabled={h.checking}
            locked={answered}
            retake={h.retake}
            onSubmit={() => void check()}
            runtime={rt}
            trial={null}
            autoFocus={!answered}
            label="Your guess"
          />
          {answered && (
            <p
              role="status"
              className="rounded-control border-l-2 border-accent bg-lane-in px-3 py-2"
              data-testid="predict-outcome"
            >
              {right === false
                ? "Now press Play and listen: it does something else. That gap is where the learning is."
                : right === true
                  ? "Now press Play and hear whether it does what you guessed."
                  : "Now press Play and compare it with what you expected."}
            </p>
          )}
        </>
      }
      actions={
        answered ? null : (
          <CheckButton onClick={() => void check()} disabled={!ready} label="Lock in my guess" />
        )
      }
    />
  );
}

// --- multi-part steps ---------------------------------------------------------------------------------

function AllRenderer(props: ExerciseRendererProps) {
  const h = useStepHost();
  const ex = h.exercise as AllEx;
  const parts = ex.parts;
  const runtimes = useRef<InputRuntime[]>(parts.map(() => ({ tapStart: null, plays: 0 }))).current;
  const anyCode = parts.some((p) => isCodeInput(p) || p.kind === "code-fill" || p.kind === "run-investigate");
  const drafts = useDrafts(parts);
  const [values, setValues] = useState<unknown[]>(() =>
    parts.map((p, i) => {
      const v = initialInput(p, h.trials[i] ?? null);
      return drafts[i]?.load(v) ?? v;
    }),
  );
  const ready = parts.every((p, i) => inputReady(p, values[i], h.trials[i] ?? null));
  const rt: InputRuntime = { tapStart: null, plays: runtimes.reduce((a, r) => a + r.plays, 0) };
  const { check } = useCheck(
    props,
    () =>
      ready
        ? (() => {
            for (const d of drafts) d.clear();
            return {
              parts: parts.map((p, i) =>
                inputResponse(p, values[i], runtimes[i] as InputRuntime, h.trials[i] ?? null),
              ),
            };
          })()
        : null,
    rt,
    { whileLocked: parts.some((p) => isCodeInput(p)) },
  );
  const reason = ready
    ? null
    : allCheckReason(
        parts,
        values,
        parts.map((p, i) => initialInput(p, h.trials[i] ?? null)),
        h.trials,
      );
  const fb =
    quietIn(h.mode, h.checking) ??
    answerFeedback({ result: h.result, checking: h.checking, rung: h.rung, spec: null, reveal: null });
  const cards: ReactNode = (
    <ol className="flex flex-col gap-4" aria-label="Parts">
      {parts.map((p, i) => {
        const set = (v: unknown) => {
          drafts[i]?.save(v, initialInput(p, h.trials[i] ?? null));
          setValues((vs) => {
            const next = [...vs];
            next[i] = v;
            return next;
          });
        };
        const partProps = {
          ex: p,
          value: values[i],
          onChange: set,
          wbId: `l-${h.step.id.toLowerCase()}-p${i + 1}-${h.seriesNo}`,
          feedback: partFeedback(fb, h.result, i),
          result: null as GradeResult | null,
          rung: h.rung,
          disabled: h.checking,
          locked: h.locked,
          retake: h.retake,
          onSubmit: () => void check(),
          runtime: runtimes[i] as InputRuntime,
          trial: h.trials[i] ?? null,
          variant: "compact" as const,
        };
        return (
          <li key={p.id} className="rounded-card border border-border bg-surface p-3" data-part={i + 1}>
            <p className="mb-2 text-sm font-medium">
              <span className="mr-2 text-text-3">{i + 1}.</span>
              <InlineMd text={p.prompt} />
            </p>
            <div className="flex flex-col gap-3">
              <PartInput {...partProps} slot="stage" />
              <PartInput {...partProps} slot="answer" />
              <EarAfter ex={p} trial={h.trials[i] ?? null} value={values[i]} />
            </div>
          </li>
        );
      })}
    </ol>
  );
  return (
    <StepLayout
      {...(anyCode ? { stage: cards } : {})}
      answer={
        <>
          {anyCode ? null : cards}
          <StepFeedback detail />
        </>
      }
      actions={
        <CheckButton
          onClick={() => void check()}
          disabled={!ready || h.checking}
          label="Check all"
          reason={reason}
        />
      }
    />
  );
}

/**
 * Parts of an `all` share the step's verdict; a pass marks them all correct. A fail marks the parts the grading
 * placed a finding on (grading.ts `withPartSlots`: several answers checked together) and leaves the others as they
 * are; with no part named (code parts), none is marked.
 */
export function partFeedback(fb: ReturnType<typeof answerFeedback>, r: GradeResult | null, part: number) {
  if (fb.state === "correct" || fb.state === "pending") return fb;
  if (r && r.status === "fail") {
    const off = r.diagnostics.some(
      (d) => (d.severity === "error" || d.severity === "warn") && d.where?.slot === part + 1,
    );
    return off && fb.state === "wrong" ? ({ state: "wrong" } as const) : ({ state: "idle" } as const);
  }
  return fb.state === "revealed" ? ({ state: "idle" } as const) : fb;
}

// --- the Make -----------------------------------------------------------------------------------------

function MakeRenderer() {
  const h = useStepHost();
  const ex = h.exercise as Extract<Exercise, { kind: "code-make" | "compose-brief" }>;
  const starter = starterOf(ex);
  // Unit songs (spec §5.3): a take step's Make plays inside its song and opens with Oak's copy at the song's tempo or
  // with the learner's take of the step's `startFrom` lesson; a side step stays a sketch of its own.
  const song = h.song?.kind === "take" ? h.song : null;
  const sideStep = h.song?.kind === "side" ? h.song : null;
  // d15: a Make that builds on an earlier lesson's sketch opens with the learner's own, when they saved one. Inside a
  // song the opening comes from `startFrom` instead (AUTHORING §23.9 rule 5).
  const from = song ? null : fromSketchOf(ex);
  const sketchQ = useLessonSketch(from);
  const content = useContent();
  const ownSketch = from !== null && sketchQ.isSuccess ? ownSketchOf(sketchQ.data) : null;
  const own: OwnSketch | null = song?.own
    ? { sketchId: song.own.lessonId, title: song.own.title, code: song.own.code }
    : ownSketch;
  const oakCode = song ? song.oakCopy : starter.code;
  // The editor waits for the answer only when it would otherwise open with Oak's copy and then change.
  const waiting =
    h.song?.kind === "pending" ||
    (from !== null && h.code === null && sketchQ.isPending && sketchQ.fetchStatus !== "idle");
  const start = makeStart({ starter: oakCode, own, current: h.code });
  const code = start.code;
  const [chosen, setChosen] = useState<MakeSource | null>(null);
  const side = chosen ?? start.source;
  // Each copy as the learner left it in this visit: switching back and forth never loses an edit.
  const kept = useRef<Record<MakeSource, string | null>>({ sketch: null, oak: null });
  const setCode = h.setCode;
  const opened = start.code;
  useEffect(() => {
    // The step holds what the editor opened with from the start (Wrap up, the tutor and the saved sketch read the
    // step's code): the learner's sketch or take, or Oak's copy at the song's tempo.
    if (!waiting && h.code === null && opened !== starter.code) setCode(opened);
  }, [waiting, opened, h.code, setCode, starter.code]);
  const switchTo = (to: MakeSource) => {
    if (!own || to === side) return;
    kept.current[side] = code;
    h.setCode(kept.current[to] ?? (to === "oak" ? oakCode : own.code));
    setChosen(to);
  };
  const fromTitle =
    content.data?.syllabus?.units.flatMap((u) => u.lessons).find((l) => l.id === from)?.title ?? null;
  const editorId = `l-${h.step.id.toLowerCase()}-make`;
  // The starter's marked spot (`⟪4⟫`: "change the highlighted number") gets the dashed target box until the
  // learner edits; the whole Make stays editable. Without it the prompt pointed at a highlight nobody could see.
  // (It looked the editor up by the Workbench's id, not the editor's `oak_…_0_` id, so the box never appeared.)
  useTargetMarks(editorId, song ? song.oakEditable : starter.editable, code === oakCode, h.result);
  // "In your song | Today's code": the song with today's code in it (looping where it plays), or the code alone over
  // the lesson's own Band, as Makes played before songs.
  const [mode, setMode] = useState<SongMode>("song");
  const inSong = song !== null && mode === "song";
  const [loopReq, setLoopReq] = useState<{ seq: number; region: LoopRegion | null; play?: boolean } | null>(
    null,
  );
  const [loopNow, setLoopNow] = useState<SongLoopNow | null>(null);
  const request = loopReq ?? { seq: 0, region: inSong ? (song?.loop ?? null) : null };
  const ask = (region: LoopRegion | null, play?: boolean) =>
    setLoopReq({ seq: request.seq + 1, region, ...(play === undefined ? {} : { play }) });
  const switchMode = (next: SongMode) => {
    if (next === mode || !song) return;
    setMode(next);
    ask(next === "song" ? song.loop : null);
  };
  const workbench = inSong
    ? {
        ...h.workbench,
        band: song.setup,
        // The Workbench reads, draws and loops the whole song; the editor's own tempo still wins when it sets one.
        lessonCtx: { ...h.workbench.lessonCtx, loopBars: song.lengthBars, defaultBpm: song.bpm },
        // One chip per part of the song (its earlier lessons' lines and Oak's track under it), today's lines first.
        trackChips: song.chips,
      }
    : h.workbench;
  const [title, setTitle] = useState(() => makeTitle(ex, h.lesson));
  // The learner has edited or played the code in this visit. The opening code is graded at once to tick the list,
  // and "Save anyway" before the learner did anything read as a verdict on Oak's own copy.
  const [tried, setTried] = useState(false);
  const seq = useRef(0);
  const r = h.result;
  const live = async (src: string) => {
    const my = ++seq.current;
    const result = await h.gradeQuiet({ code: src }).catch(() => null);
    if (my === seq.current) h.preview(result);
  };
  const rubric = ex.rubric;
  const okOf = (id: string) => r?.rubric?.find((x) => x.ruleId === id)?.ok;
  const required = rubric.find((x) => x.required);
  const requiredOk = required ? okOf(required.id) === true : true;
  const beyond = r?.diagnostics.some((d) => d.id === "make.beyond-brief") ?? false;
  const lockedDiag = r?.diagnostics.find((d) => d.id.startsWith("code.locked")) ?? null;
  const blocked = lockedDiag !== null;
  const save = () => h.save?.(code, title.trim() || makeTitle(ex, h.lesson));
  // The list follows the code as it changes (debounced), and every Run checks at once.
  const liveRef = useRef(live);
  liveRef.current = live;
  useEffect(() => {
    if (waiting) return;
    const t = window.setTimeout(() => void liveRef.current(code), 700);
    return () => window.clearTimeout(t);
  }, [code, waiting]);
  useEffect(() => {
    h.setCheck(() => void live(code));
    return () => h.setCheck(null);
  });
  // "The first line is set to your song's tempo" holds only while it does: a learner who sets another tempo makes it
  // the song's, and the note would contradict what plays.
  const tempoNoted = song?.tempoSet === true && holdsSongTempo(code, song.bpm);
  const startNote =
    own && song
      ? songStartNote(side, own.title, tempoNoted ? song.bpm : null)
      : own
        ? makeStartNote(side, own, fromTitle)
        : null;
  return (
    <StepLayout
      stage={
        waiting ? (
          <LoadingState
            label={song || h.song?.kind === "pending" ? "Opening your song" : "Looking for your sketch"}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-2">
            {song ? (
              <div className="flex min-w-0 flex-col gap-2" data-testid="song-make" data-mode={mode}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SongModeSwitch mode={mode} onChange={switchMode} />
                  {inSong ? (
                    <SongPlayControls
                      looping={loopNow?.on ?? request.region !== null}
                      hasToday={song.loop !== null}
                      onWhole={() => ask(null, true)}
                      onToday={() => ask(song.loop, true)}
                    />
                  ) : null}
                </div>
                {inSong ? (
                  <SongStrip
                    view={song.view}
                    loop={loopNow ?? (request.region ? { on: true, region: request.region } : null)}
                    onLoop={(s) => ask(s ? { from: s.startBar, bars: s.bars } : null, s !== null)}
                  />
                ) : (
                  <p className="text-sm text-text-2" data-testid="song-today-only">
                    {song.todays
                      ? "Today's code plays over the lesson's band, as you wrote it."
                      : "Today's code plays alone, as you wrote it."}
                  </p>
                )}
              </div>
            ) : null}
            <Workbench
              {...workbench}
              id={editorId}
              tutorBars
              code={code}
              toolbar={
                <SaveLineButton
                  code={code}
                  source={{ kind: "lesson", ref: `${h.lesson.id}/${h.step.id}` }}
                  bpm={workbench.lessonCtx.defaultBpm}
                  meter={workbench.lessonCtx.meter}
                  keySpec={workbench.lessonCtx.key}
                />
              }
              // Switching copies puts the other one into the editor even when its text equals the last prop.
              {...(own ? { codeKey: side } : {})}
              {...(song ? { loopRequest: request, onLoopChange: (l: SongLoopNow) => setLoopNow(l) } : {})}
              onChange={(c) => {
                setTried(true);
                h.setCode(c);
              }}
              onEvaluated={(o) => {
                setTried(true);
                // A refused run (a locked tool) is graded too, so the list says why in words.
                if (o.ok) h.markDone();
                void live(o.code);
              }}
            />
          </div>
        )
      }
      answer={
        <>
          {/* A song the learner has not started (a track whose first lesson is this side step) is not "your song"
              yet: the note would speak of something they have never seen. */}
          {sideStep?.started ? <SideStepNote reason={sideStep.reason} /> : null}
          {song && !own && tempoNoted ? (
            <p className="text-sm text-text-2" data-testid="make-start-note" data-source="oak">
              {songTempoNote(song.bpm)}
            </p>
          ) : null}
          {own && start.choice ? (
            <Callout
              tone="info"
              title={side === "sketch" ? (song ? "Your own code" : "Your own sketch") : "Oak's copy"}
              actions={
                side === "sketch" ? (
                  <Button size="sm" onClick={() => switchTo("oak")} data-testid="make-oak-copy">
                    Start from Oak's copy
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => switchTo("sketch")} data-testid="make-own-sketch">
                    {song ? "Use my code" : "Use my sketch"}
                  </Button>
                )
              }
            >
              <span data-testid="make-start-note" data-source={side}>
                {startNote}
              </span>
            </Callout>
          ) : null}
          <section aria-label="What the Make asks for" data-testid="make-checklist">
            <p className="text-sm text-text-2">
              {ex.kind === "code-make" ? `${ex.bars[0]} to ${ex.bars[1]} bars. ` : ""}Run it to tick the list.
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {rubric.map((rule) => {
                const ok = okOf(rule.id);
                return (
                  <li
                    key={rule.id}
                    className="flex items-start gap-2 text-sm"
                    data-rule={rule.id}
                    data-ok={ok ? "1" : "0"}
                  >
                    {ok ? (
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                    ) : (
                      <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0 text-text-3" />
                    )}
                    <span>
                      <InlineMd text={rule.label} />
                      {rule.required ? (
                        <span className="text-text-3"> (the one that counts today)</span>
                      ) : null}
                      <span className="sr-only">{ok ? ", done" : ", not yet"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          {beyond && (
            <p
              role="status"
              className="rounded-control border-l-2 border-accent bg-lane-in px-3 py-2 text-sm"
              data-testid="beyond-brief"
            >
              You went past today's brief. Nice.
            </p>
          )}
          {blocked && (
            <p
              role="status"
              className="rounded-control border-l-2 border-accent-2 px-3 py-2 text-sm"
              data-testid="locked-tool"
            >
              {lockedDiag ? h.render(lockedDiag) : null}
            </p>
          )}
          {r?.status === "error" && !blocked && (
            <p role="status" className="rounded-control border-l-2 border-accent-2 px-3 py-2 text-sm">
              The code did not run yet: {r.messages[0]?.text ?? "check the editor for the marked spot."}
            </p>
          )}
          {song ? (
            <p className="text-sm text-text" data-testid="make-save-line">
              {songSaveLine(song.view)} It is kept in Studio as a sketch too.
            </p>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-2">{song ? "Name in Studio" : "Sketch title"}</span>
            <input
              type="text"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-control border border-border bg-surface px-2"
              data-testid="sketch-title"
            />
          </label>
        </>
      }
      actions={
        <Button variant="primary" onClick={save} loading={h.checking} data-testid="save-sketch">
          {song
            ? r && !requiredOk && tried
              ? "Save into your song anyway"
              : "Save into your song"
            : r && !requiredOk && tried
              ? "Save anyway"
              : "Save sketch"}
        </Button>
      }
      answerFirst
    />
  );
}

// --- the registry -------------------------------------------------------------------------------------

/** A dictation: staged (bass, quality, numerals; Wave 4) or the single-input renderer. */
function DictationRenderer(props: ExerciseRendererProps) {
  const h = useStepHost();
  return isStaged(h.exercise) ? <StagedRenderer {...props} /> : <SingleRenderer {...props} />;
}

const RENDERERS: Partial<Record<ExerciseKind, ExerciseRenderer<never>>> = {
  dictation: DictationRenderer as unknown as ExerciseRenderer<never>,
  listen: ListenRenderer as unknown as ExerciseRenderer<never>,
  predict: PredictRenderer as unknown as ExerciseRenderer<never>,
  all: AllRenderer as unknown as ExerciseRenderer<never>,
  "code-make": MakeRenderer as unknown as ExerciseRenderer<never>,
  sing: SingRenderer as unknown as ExerciseRenderer<never>,
  "compose-brief": SingleRenderer as unknown as ExerciseRenderer<never>,
};

export const rendererFor: RendererFor = <K extends ExerciseKind>(kind: K) =>
  (RENDERERS[kind] ?? SingleRenderer) as unknown as ExerciseRenderer<K>;

/** The Make renderer for a compose-brief used as a step's Make (capstone-style lesson Makes). */
export { MakeRenderer };
