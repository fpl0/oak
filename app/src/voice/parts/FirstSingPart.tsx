// The first sung note (contracts §2.3 U00.L02, §8.1 rule 8; ux §8 `onb.firstSing`; docs/design/retry.md §6.5 item
// 1): Oak plays the home note, the learner sings it back, and any sustained pitch within ±100¢ of it in any octave
// passes — the schema's lenient tolerance (`SingTolerance.lenient`), graded by the one rule for a sung note
// (`gradeSungLive` while listening, `gradeSung` at the end of the take), the one exception to the ladder.
//
// Every take can be sung again, after any result: the take listens while the learner holds the note and ends a
// second after the voice stops (never at the instant the live grade passes), at most 12 s; the result shows what
// Oak heard each time, and the learner moves on only with Continue. After a pass the step stays passed whatever a
// later take does: later takes are practice, and only the first passing take is saved (`first: true`).
// In Quiet mode (no mic) it is a listening step: hear the note, and learn its name.
import { toLearnerProfile } from "@oak/api";
import type { MicSession } from "@oak/audio";
import type { SingTolerance } from "@oak/content-kit";
import { gradeSung, gradeSungLive, type PitchFrame, type SungTarget } from "@oak/pitch";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatNoteMidi } from "../../lib/notes.ts";
import { useCalibrations } from "../../lib/queries.ts";
import { PRACTICE_LINE } from "../../lib/retry.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Callout } from "../../ui/kit/Controls.tsx";
import {
  centsWords,
  firstSingTake,
  firstSingTakeOver,
  firstSingTonic,
  liveMidi,
  takeWords,
  voiced,
} from "../logic.ts";
import { PitchTrace } from "../PitchTrace.tsx";
import { RecheckHint } from "../panels.tsx";
import { clearRecheck, reportTake } from "../recheck.ts";
import { closeInput, openInput, playAt, voiceAudio } from "../services.ts";
import { useQuietChosen } from "../use-voice.ts";
import { PartActions, PartFrame, type PartProps, StatusSlot, useSaveRun } from "./common.tsx";

const NOTE_SEC = 1.6;
/** U00.L02's first sing, as content declares it (`tol.lenient`; `cents` is ignored by the lenient rule). */
export const FIRST_SING_TOL: SingTolerance = {
  cents: "learner",
  octave: "per-note",
  driftCompCents: 0,
  minCoverage: 0.4,
  passHitRate: 1,
  lenient: true,
};

type Phase = "ready" | "playing" | "listening" | "result";

/** One take as the learner sees it in the list: what Oak heard. */
export interface FirstSingTake {
  n: number;
  passed: boolean;
  /** Folded error of the steady part, when one was heard. */
  cents: number | null;
  /** Taken after the step had passed: it changes nothing. */
  practice: boolean;
}

/** The first sung take that passed, as saved: its centsError (null when none is saved). */
function savedPass(rows: readonly { result: Record<string, unknown> }[] | undefined): number | null | false {
  const row = rows?.find((r) => r.result.first === true && r.result.passed === true);
  if (!row) return false;
  const c = row.result.centsError;
  return typeof c === "number" ? c : null;
}

export function FirstSingPart(props: PartProps) {
  // Quiet mode switched on anywhere (Settings › Voice "just for today", another tab) turns the step into its
  // listening version at once; a take in progress ends and the mic closes as the sung version unmounts.
  const quiet = useQuietChosen(props.profile);
  if (quiet || props.profile.inputKind === "none") return <FirstListen {...props} />;
  return <FirstSing {...props} />;
}

function playNoteNow(tonic: number) {
  return voiceAudio().then(async ({ oak }) => {
    await oak.unlock();
    playAt(oak, { s: "piano", note: tonic, gain: 0.7 }, oak.ctx.currentTime + 0.05, NOTE_SEC);
  });
}

/** Quiet mode: the note is heard and named, never sung (contracts §8.5: singing steps become listening steps). */
function FirstListen({ profile, onDone, context, back }: PartProps) {
  const tonic = firstSingTonic(profile);
  const [heard, setHeard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hear = () => {
    setError(null);
    playNoteNow(tonic).then(
      () => setHeard(true),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  };
  return (
    <PartFrame
      testId="part-first-sing"
      context={context}
      title="Your first note"
      instruction="Listen to the note Oak plays."
      lead="Quiet mode is on, so this one is for your ears only. You can sing it later from Settings › Voice."
    >
      <StatusSlot>
        {heard && (
          <Callout tone="success" title="That note is 1: home.">
            <span data-testid="first-sing-heard">Everything in Oak is measured from here.</span>
          </Callout>
        )}
        {error && (
          <Callout tone="issue" title="Sound didn't start">
            {error}
          </Callout>
        )}
      </StatusSlot>
      <PartActions
        context={context}
        back={back}
        resultKey={heard ? "heard" : null}
        onRetry={null}
        onContinue={heard ? onDone : null}
        extra={
          heard ? (
            <Button variant="ghost" onClick={hear} data-testid="first-sing-hear">
              Hear it again
            </Button>
          ) : null
        }
        action={
          heard ? null : (
            <Button
              variant="primary"
              onClick={hear}
              icon={<Play aria-hidden className="size-4" />}
              data-testid="first-sing-start"
              autoFocus
            >
              Start the note
            </Button>
          )
        }
      />
    </PartFrame>
  );
}

function FirstSing({ profile, onDone, onSkip, context, back }: PartProps) {
  const tonic = firstSingTonic(profile);
  const [phase, setPhase] = useState<Phase>("ready");
  const [takes, setTakes] = useState<FirstSingTake[]>([]);
  /** The step passed (this visit, or a pass saved before: a reload, Back): later takes are practice. */
  const [counted, setCounted] = useState(false);
  const [savedCents, setSavedCents] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frames = useRef<PitchFrame[]>([]);
  const session = useRef<MicSession | null>(null);
  const stopRequested = useRef(false);
  /** A take is under way: a second start (a double press, Try again pressed twice at once) is ignored. */
  const taking = useRef(false);
  const alive = useRef(true);
  const countedRef = useRef(false);
  const run = useSaveRun();
  const saved = useCalibrations("pitch-match");
  const learner = toLearnerProfile(profile);

  // A pass saved earlier (a reload or Back in the middle of the step): open in the result state.
  const savedFirst = context === "onboarding" ? savedPass(saved.data?.items) : false;
  // Deliberately keyed on the saved rows only
  useEffect(() => {
    if (savedFirst === false || countedRef.current) return;
    countedRef.current = true;
    setCounted(true);
    setSavedCents(savedFirst);
    setPhase((p) => (p === "ready" ? "result" : p));
  }, [savedFirst]);

  const close = () => {
    session.current?.close();
    session.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      close();
      closeInput();
    };
  }, []);

  const attempt = async () => {
    if (taking.current) return;
    taking.current = true;
    try {
      await take();
    } finally {
      taking.current = false;
    }
  };

  const take = async () => {
    setError(null);
    frames.current = [];
    stopRequested.current = false;
    setNow(null);
    setPhase("playing");
    try {
      await playNoteNow(tonic);
      await new Promise((r) => setTimeout(r, NOTE_SEC * 1000 + 200));
      if (!alive.current) return;
      const s = await openInput();
      session.current = s;
      setPhase("listening");
      const off = s.onFrame((f) => frames.current.push(f));
      const { oak } = await voiceAudio();
      const startAt = oak.ctx.currentTime;
      const target: SungTarget = { midi: tonic, on: startAt, off: startAt + 12 };
      await new Promise<void>((resolve) => {
        let livePass = false;
        const iv = setInterval(() => {
          if (!alive.current || session.current !== s) {
            clearInterval(iv);
            resolve();
            return;
          }
          const fs = frames.current;
          setNow(liveMidi(fs));
          const t = oak.ctx.currentTime;
          if (!livePass) {
            const live = gradeSungLive(fs, [target], FIRST_SING_TOL, "pitch", learner, t);
            livePass = live.notes[0]?.credit === 1;
          }
          let lastVoiced: number | null = null;
          for (let i = fs.length - 1; i >= 0; i--) {
            const f = fs[i] as PitchFrame;
            if (voiced(f)) {
              lastVoiced = f.t;
              break;
            }
          }
          const over =
            stopRequested.current ||
            firstSingTakeOver({
              elapsed: t - startAt,
              passed: livePass,
              silentFor: lastVoiced === null ? null : Math.max(0, t - lastVoiced),
            });
          if (over) {
            clearInterval(iv);
            resolve();
          }
        }, 200);
      });
      off();
      close();
      if (!alive.current) return;
      const final = gradeSung(frames.current, [target], FIRST_SING_TOL, "pitch", learner);
      const note = final.notes[0];
      const passed = note?.credit === 1;
      const cents =
        note && note.cents !== null && note.coverage >= FIRST_SING_TOL.minCoverage ? note.cents : null;
      const { practice, save } = firstSingTake(countedRef.current, passed);
      setTakes((ts) => [
        ...ts,
        { n: ts.length + 1, passed, cents: cents === null ? null : Math.round(cents), practice },
      ]);
      setPhase("result");
      if (!passed) {
        // A take the learner stopped early says nothing about the room or the mic.
        if (!stopRequested.current)
          reportTake({
            diagnostics: final.diagnostics,
            frames: frames.current,
            floorDb: profile.noiseFloorDb,
          });
        return;
      }
      clearRecheck();
      // The resolution: the home chord under the learner's note, softly.
      const at = oak.ctx.currentTime + 0.1;
      for (const n of [tonic - 12, tonic - 5, tonic + 4, tonic])
        playAt(oak, { s: "piano", note: n, gain: n === tonic ? 0.6 : 0.4 }, at, 2.4);
      // Only the first passing take is the step's result (docs/design/retry.md §3.4).
      if (!save) return;
      countedRef.current = true;
      setCounted(true);
      await run.save({
        kind: "pitch-match",
        result: { first: true, passed: true, tonicMidi: tonic, centsError: Math.round(cents ?? 0) },
        patch: {},
      });
    } catch (e) {
      close();
      if (!alive.current) return;
      setPhase(takes.length > 0 || countedRef.current ? "result" : "ready");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const listening = phase === "listening";
  const running = phase === "playing" || listening;
  const last = takes.at(-1) ?? null;
  const shown = phase === "result";
  const lastPassed = last?.passed ?? (counted && last === null);
  const resultKey = shown ? (last ? `take-${last.n}` : "saved") : null;

  return (
    <PartFrame
      testId="part-first-sing"
      context={context}
      title="Your first note"
      instruction="Listen to the note, then sing it back and hold it."
      lead="Sing on 'ooh' or hum, in whatever octave is comfortable. Any octave counts."
    >
      <PitchTrace
        frames={() => frames.current}
        live={listening}
        lowMidi={tonic - 14}
        highMidi={tonic + 14}
        target={shown && lastPassed ? { midi: tonic, cents: 100, hit: true } : null}
        label="Live pitch trace of your voice"
        height={180}
      />
      <div aria-live="polite" className="text-text-2 empty:hidden" data-testid="first-sing-status">
        {phase === "playing" && "Listen…"}
        {listening && (now === null ? "Now sing it back." : "Hold it steady…")}
      </div>
      {takes.length > 0 && (
        <ol className="flex flex-col rounded-card border border-border px-3" data-testid="first-sing-takes">
          {takes.map((t) => (
            <li
              key={t.n}
              className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0"
            >
              <span className="text-text-2">
                Try {t.n}
                {t.practice ? " · practice" : ""}
              </span>
              <span className="font-medium">{takeWords(t)}</span>
            </li>
          ))}
        </ol>
      )}
      <StatusSlot>
        {shown && lastPassed && (
          <Callout tone="success" title="That note is 1: home.">
            <span data-testid="first-sing-result" data-passed="1">
              Everything in Oak is measured from here.
              {last?.passed && last.cents !== null
                ? ` You were ${centsWords(last.cents)}.`
                : last === null && savedCents !== null
                  ? ` You were ${centsWords(savedCents)}.`
                  : ""}
            </span>
            <span className="mt-1 block text-text-3">
              Oak played {formatNoteMidi(tonic)}
              {last?.passed && last.cents !== null
                ? `; you were ${last.cents > 0 ? "+" : ""}${last.cents} cents from it, counting any octave.`
                : "."}
            </span>
          </Callout>
        )}
        {shown && last && !last.passed && (
          <Callout tone="attention" title={counted ? "No steady note this time" : "No steady note yet"}>
            <span data-testid="first-sing-result" data-passed="0">
              {counted
                ? "Your earlier note still counts. Sing a long 'ooh' to try once more, or go on."
                : "Listen once more and sing a long 'ooh'. Any octave counts."}
            </span>
          </Callout>
        )}
        {shown && last && !last.passed && <RecheckHint />}
        {error && (
          <Callout tone="issue" title="The microphone didn't open">
            {error}
          </Callout>
        )}
      </StatusSlot>
      <PartActions
        context={context}
        back={back}
        // Singing never gates: "Set up later" is there until the note has counted, then Continue is the way on.
        onSkip={counted ? null : onSkip}
        running={
          running
            ? {
                label: "Listening…",
                onStop: listening
                  ? () => {
                      stopRequested.current = true;
                    }
                  : null,
              }
            : null
        }
        resultKey={resultKey}
        onRetry={shown ? () => void attempt() : null}
        onContinue={shown || counted ? onDone : null}
        continueDisabled={!counted || running}
        // A practice take after the pass holds Continue only until it ends: the note already counts, and says so.
        continueNote={
          counted
            ? "Your note already counts. Continue opens when you finish singing."
            : "Sing the note back to go on, or set it up later."
        }
        // Said under a take that was practice: never under the take that counted (it read as "your note didn't
        // count"), nor before any take.
        line={shown && last?.practice ? PRACTICE_LINE : null}
        extra={
          shown ? (
            <Button variant="ghost" onClick={() => void playNoteNow(tonic)} data-testid="first-sing-hear">
              Hear it again
            </Button>
          ) : null
        }
        action={
          phase === "ready" ? (
            <Button
              variant="primary"
              onClick={() => void attempt()}
              icon={<Play aria-hidden className="size-4" />}
              data-testid="first-sing-start"
              autoFocus
            >
              Start the note
            </Button>
          ) : null
        }
      />
    </PartFrame>
  );
}
