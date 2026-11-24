// Sing steps (contracts §8, ux §4.3; wave3.md §10): sung degree patterns, echo and sight-singing. The targets
// are shown with their labels (numbers, or syllables with the number kept), "Hear it" plays the reference, the
// take hears what sets home and the count-in first (an echo hears the target; a sight-sing never does before
// the take, and Oak plays it after), and after the take each target says how it went, in words. In Quiet mode
// (server state) or without a mic the step is its fallback: "hear it in your head, then press Space", or an
// identify equivalent. Singing never gates anything: Continue is always open here.
import type { Degree, SingEx } from "@oak/api";
import { Ear, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnswerEnvProvider } from "../answers/env.tsx";
import type { AnswerSpecOf, AnswerValue, SungSummary } from "../answers/types.ts";
import { useHotkeys } from "../ui/keys/KeymapProvider.tsx";
import { Button } from "../ui/kit/Button.tsx";
import { Chip, Kbd } from "../ui/kit/basics.tsx";
import { RecheckHint } from "../voice/panels.tsx";
import { type Playing, playStimulus } from "./audio.ts";
import { CheckButton, quietIn, StepFeedback, useCheck } from "./check.tsx";
import { answerFeedback } from "./feedback.ts";
import { StepLayout, useStepHost } from "./frame.tsx";
import {
  AnswerWidgetHost,
  type InputRuntime,
  inputResponse,
  StimulusView,
  useAnswerEnvFor,
} from "./inputs.tsx";
import { ResultRow } from "./result-row.tsx";
import {
  fallbackCorrect,
  type SingLabels,
  singFallback,
  singLabelsFor,
  targetLabel,
  targetMarks,
  tonicPc,
} from "./rules.ts";
import type { ExerciseRendererProps } from "./types.ts";
import { guideToneFallback, singHowText } from "./wave6.ts";

const WORD: Record<"on" | "close" | "off" | "missed", string> = {
  on: "on the note",
  close: "close",
  off: "another note",
  missed: "not heard",
};

/** The degrees a step sings, in order (`[]` for a target read from music). */
function degreesOf(ex: SingEx): Degree[] {
  return ex.target.from === "degrees" ? ex.target.degrees : [];
}

/** The targets as a row of labelled chips; after a take, each says how it went. */
function Targets({
  ex,
  labels,
  credits,
}: {
  ex: SingEx;
  labels: SingLabels;
  credits: readonly (number | null)[] | null;
}) {
  const degrees = degreesOf(ex);
  if (degrees.length === 0) return null;
  const shown = degrees.map((d) => targetLabel(d, labels));
  const marks = credits
    ? targetMarks(
        shown.map((l) => l.main),
        credits,
      )
    : null;
  return (
    <ol className="flex flex-wrap gap-2" aria-label="What to sing" data-testid="sing-targets">
      {shown.map((l, i) => {
        const m = marks?.[i];
        return (
          <li
            key={i}
            className={
              m
                ? `flex min-w-14 flex-col items-center rounded-control border px-2 py-1 ${
                    m.word === "on" ? "border-accent bg-lane-in" : "border-border"
                  }`
                : "flex min-w-14 flex-col items-center rounded-control border border-border px-2 py-1"
            }
            data-target={i + 1}
            data-mark={m?.word ?? "open"}
          >
            <span className="font-display text-lg font-semibold leading-tight">{l.main}</span>
            {l.sub && <span className="text-xs text-text-3">{l.sub}</span>}
            {m && <span className="text-xs text-text-2">{WORD[m.word]}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** "Hear it": the reference (what sets home, then the target). A sight-sing offers it only after a take. */
function HearIt({ ex, runtime, label = "Hear it" }: { ex: SingEx; runtime: InputRuntime; label?: string }) {
  const h = useStepHost();
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => playing?.stop(), [playing]);
  if (ex.stimulus.src !== "code") return null;
  const stim = ex.stimulus;
  const play = async () => {
    if (playing) {
      playing.stop();
      setPlaying(null);
      return;
    }
    setFailed(false);
    try {
      const p = await playStimulus({
        code: stim.code,
        bars: stim.bars,
        meter: ex.meter ?? h.env.meter,
        key: ex.key ?? h.env.key,
        context: ex.cue.context,
      });
      runtime.plays += 1;
      setPlaying(p);
      void p.done.then(() => setPlaying((cur) => (cur === p ? null : cur)));
    } catch {
      setFailed(true);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        icon={<Ear aria-hidden className="size-4" />}
        onClick={() => void play()}
        data-testid="hear-it"
        data-playing={playing ? "1" : "0"}
      >
        {playing ? "Stop" : label}
      </Button>
      {failed && (
        <span className="text-sm text-text-2">The sound did not start. Press any key, then try again.</span>
      )}
    </div>
  );
}

/** Quiet mode, "hear it in your head": play it, imagine it, press Space. Nothing is recorded or waited on. */
function InnerFallback({ ex, runtime }: { ex: SingEx; runtime: InputRuntime }) {
  const h = useStepHost();
  const [heard, setHeard] = useState(false);
  const done = () => {
    setHeard(true);
    h.markDone();
  };
  const ref = useRef(done);
  ref.current = done;
  useHotkeys([
    {
      id: "lesson-heard-it",
      keys: "Space",
      scope: "global",
      group: "Lesson",
      description: "Heard it in my head (Quiet mode)",
      when: (k) => !k.inEditable && !k.onControl,
      run: () => ref.current(),
    },
  ]);
  return (
    <div
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3"
      data-testid="sing-quiet"
    >
      <p className="text-sm text-text-2">
        Play it once. Then hear it again in your head, on {singLabelsFor(ex, h.lesson.id)}, one note at a
        time.
      </p>
      <HearIt ex={ex} runtime={runtime} />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={heard ? "secondary" : "primary"} onClick={done} data-testid="heard-it">
          I heard it in my head <Kbd tone={heard ? "default" : "inverse"}>Space</Kbd>
        </Button>
        {heard && (
          <span role="status" className="text-sm text-text-2" data-testid="heard-it-done">
            Noted. Quiet mode records nothing here, and nothing waits on it.
          </span>
        )}
      </div>
    </div>
  );
}

/** Quiet mode, the identify equivalent: hear the pattern, then name its degrees in order. Never evidence. */
function IdentifyFallback({
  ex,
  degrees,
  set,
  runtime,
}: {
  ex: SingEx;
  degrees: Degree[];
  set: Degree[];
  runtime: InputRuntime;
}) {
  const h = useStepHost();
  const labels = singLabelsFor(ex, h.lesson.id);
  const spec: AnswerSpecOf<"degree-pad"> = {
    ui: "degree-pad",
    set,
    sequenceLen: degrees.length,
    syllables: labels === "syllables",
  };
  const [value, setValue] = useState<Degree[]>([]);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  // Each verdict has its own identity, so the row moves the focus to it (docs/design/retry.md §2.4).
  const [verdictNo, setVerdictNo] = useState(0);
  const check = () => {
    if (value.length !== degrees.length || verdict !== null) return;
    setVerdict(fallbackCorrect(degrees, value));
    setVerdictNo((n) => n + 1);
    h.markDone();
  };
  const padId = `l-${h.step.id.toLowerCase()}-quiet`;
  return (
    <div className="flex flex-col gap-3" data-testid="sing-quiet-identify">
      <p className="text-sm text-text-2">Quiet mode: hear the pattern, then name its degrees in order.</p>
      <HearIt ex={ex} runtime={runtime} />
      <AnswerWidgetHost
        spec={spec}
        value={value as AnswerValue}
        onChange={(v) => setValue(v as Degree[])}
        feedback={verdict === null ? { state: "idle" } : verdict ? { state: "correct" } : { state: "wrong" }}
        disabled={verdict !== null}
        onSubmit={check}
        rung={0}
        idBase={padId}
        label="The degrees you heard, in order"
      />
      {verdict !== null && (
        <p role="status" className="text-sm" data-testid="quiet-verdict">
          {verdict
            ? "That's the pattern."
            : `It goes ${degrees.map((d) => targetLabel(d, labels).main).join(" ")}. Hear it once more.`}
        </p>
      )}
      {/* A local verdict (never posted, contracts §8.5) with the same row as every other answer: Check, then
          Try again. The step's own footer has no result here, so this row is the one Alt+R reaches. */}
      <ResultRow
        testId="quiet-actions"
        resultKey={verdict === null ? null : verdictNo}
        onRetry={verdict === null ? null : () => setVerdict(null)}
        retryFocus={() =>
          document.querySelector<HTMLElement>(
            `[data-testid="sing-quiet-identify"] [data-answer] :is([tabindex="0"], button:not(:disabled))`,
          )
        }
        onContinue={null}
        continueLabel=""
        continueTestId="quiet-continue"
        action={
          verdict === null ? (
            <Button onClick={check} disabled={value.length !== degrees.length} data-testid="quiet-check">
              Check
            </Button>
          ) : null
        }
      />
    </div>
  );
}

export function SingRenderer(props: ExerciseRendererProps) {
  const h = useStepHost();
  const ex = h.exercise as SingEx;
  const rt = useRef<InputRuntime>({ tapStart: null, plays: 0 }).current;
  const [value, setValue] = useState<SungSummary[]>([]);
  const env = useAnswerEnvFor(ex, rt, h.trial, null);
  const labels = singLabelsFor(ex, h.lesson.id);
  const quiet = h.voice.quiet;
  const ready = value.length > 0;
  const { check } = useCheck(props, () => (ready ? inputResponse(ex, value, rt) : null), rt);
  // A sight-sing: Oak plays the target once after the take is checked, so the learner hears how it went.
  const checkedOnce = useRef(false);
  useEffect(() => {
    if (h.mode === "checkpoint") return;
    if (ex.mode !== "sight" || !h.result || checkedOnce.current || ex.stimulus.src !== "code") return;
    checkedOnce.current = true;
    const stim = ex.stimulus;
    void playStimulus({
      code: stim.code,
      bars: stim.bars,
      meter: ex.meter ?? h.env.meter,
      key: ex.key ?? h.env.key,
    }).catch(() => null);
  }, [h.result, ex, h.env.meter, h.env.key, h.mode]);
  // Any finished take (or a self-check after a blocked mic) completes the step; Continue never waits on a voice.
  useEffect(() => {
    if (value.length > 0) h.markDone();
  }, [value.length, h.markDone]);

  // A guide-tone line read from music has no degrees of its own: in Quiet mode they are read from its notes.
  const key = ex.key ?? h.env.key;
  const read =
    quiet && ex.mode === "guide-tones" && ex.fallback === "identify" && ex.target.from !== "degrees"
      ? guideToneFallback(env.sing?.notes ?? [], key, tonicPc(key.tonic))
      : null;
  const fallback: ReturnType<typeof singFallback> = read ? { kind: "identify", ...read } : singFallback(ex);
  const chip = quiet ? (
    <Chip tone="neutral" className="self-start" data-testid="quiet-chip">
      <MicOff aria-hidden className="mr-1 inline size-3.5" />
      Quiet mode
    </Chip>
  ) : null;

  if (quiet)
    return (
      <StepLayout
        answer={
          <>
            {chip}
            <StimulusView ex={ex} />
            <Targets ex={ex} labels={labels} credits={null} />
            {fallback.kind === "identify" ? (
              <IdentifyFallback ex={ex} degrees={fallback.degrees} set={fallback.set} runtime={rt} />
            ) : (
              <InnerFallback ex={ex} runtime={rt} />
            )}
          </>
        }
      />
    );

  const feedback =
    quietIn(h.mode, h.checking) ??
    answerFeedback({
      result: h.result,
      checking: h.checking,
      rung: h.rung,
      spec: { ui: "mic" },
      reveal: null,
    });
  const credits = value.length > 0 ? value.map((v) => (v.midi === null ? null : v.credit)) : null;
  const sight = ex.mode === "sight";
  return (
    <StepLayout
      answer={
        <>
          <StimulusView ex={ex} />
          {/* Sight-singing reads the staff: the degrees come back only after the take, with how each went
              (written out before it, they were the answer). Its widget says what Sing does. */}
          {sight && credits === null ? null : <Targets ex={ex} labels={labels} credits={credits} />}
          {sight ? null : (
            <p className="text-sm text-text-2" data-testid="sing-how">
              {singHowText({ mode: ex.mode, countIn: ex.cue.countInBars > 0, labels })}
            </p>
          )}
          {/* The targets come back here after a take, each with how it went in words. */}
          <AnswerEnvProvider value={env}>
            <AnswerWidgetHost
              spec={{ ui: "mic" }}
              value={value}
              onChange={(v) => setValue(v as SungSummary[])}
              feedback={feedback}
              disabled={h.checking}
              locked={h.locked}
              retake={h.retake}
              onSubmit={() => void check()}
              rung={h.rung}
              idBase={`l-${h.step.id.toLowerCase()}-${h.seriesNo}-sing`}
              label={`Your singing: ${ex.prompt.replace(/[`*]/g, "")}`}
            />
          </AnswerEnvProvider>
          <StepFeedback detail />
          {/* A take with no voice, or mostly noise, leaves the voice's calm "re-run the quiet check". */}
          {h.mode === "lesson" && <RecheckHint />}
        </>
      }
      actions={<CheckButton onClick={() => void check()} disabled={!ready || h.checking} />}
    />
  );
}
