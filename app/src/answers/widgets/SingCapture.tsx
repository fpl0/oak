// Sing capture (contracts §8, ux §4.3 PitchLane): the mic through `app/src/lib/mic.ts` only, a live trace of the
// tracked pitch folded onto the target lane, a ribbon per target at ±tolerance, a needle in words (never red or
// green), and the per-note credit from `gradeSungLive` while singing and `gradeSung` at the end: the fill, the tick
// and the grade come from the one rule. Wave 3: degree patterns and sight-singing — targets labelled with numbers or
// syllables (`SingEnv.labels`), the tolerance from the server's ladder (`tolCents`), a count-in with numerals, the
// reference (home, and a few chords that set it), "Hear it" (after the take in sight mode) and "Hear my singing" (the
// tracked pitches played back; never audio). Quiet mode or no usable mic: "listen and self-check" (contracts §8.5),
// which reports quiet evidence and records nothing. Wave 4: the live trace wears the degree colour of the target it is
// in band of (neutral out of band), each coloured run labelled with its degree.
import type { MicSession } from "@oak/audio";
import type { KeySpec, LearnerProfile } from "@oak/content-kit";
import type { PitchFrame, SungResult } from "@oak/pitch";
import { clsx } from "clsx";
import { Check, Ear, Home, Mic, Music2, Play, RotateCcw, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, dbToLevel, MicLevelMeter } from "../../ui/kit/index.ts";
import { degreeStyle, type ThemeName } from "../../ui/theme/palette.ts";
import { useThemeName } from "../../ui/theme/use-theme-name.ts";
import { appAudio, NEUTRAL_PROFILE, type QuietEvidence, useAnswerEnv } from "../env.tsx";
import {
  cadenceChords,
  centsText,
  DEFAULT_SING_TOL,
  fitNotes,
  gradeLive,
  gradeTake,
  needleWords,
  noteMarkText,
  type SingNote,
  summarize,
  type TracePoint,
  takeNotes,
  takeSeconds,
  targetLabel,
  targetSpoken,
  traceKey,
  traceOf,
  traceSegments,
} from "../sing.ts";
import type { AnswerWidgetProps } from "../types.ts";
import {
  AnswerFrame,
  KeyHint,
  SubmitHint,
  TAKE_RETRY_PROPS,
  TakeRetryLabel,
  useTakeRetryKey,
} from "../ui.tsx";

type Phase = "idle" | "cue" | "opening" | "singing" | "done" | "quiet";

const LANE_H = 220;

function cssVar(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

function drawLane(
  canvas: HTMLCanvasElement,
  notes: readonly SingNote[],
  trace: readonly TracePoint[],
  graded: readonly { cents: number | null; credit: number }[] | null,
  tolCents: number,
  span: number,
  now: number | null,
  showTrace: boolean,
  key: KeySpec | null,
  theme: ThemeName,
) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = LANE_H;
  if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
  if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
  const g = canvas.getContext("2d");
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const c = {
    surface: cssVar(canvas, "--oak-surface-2", "#efe9de"),
    border: cssVar(canvas, "--oak-border", "#ddd3c3"),
    text: cssVar(canvas, "--oak-text", "#1f1a14"),
    text3: cssVar(canvas, "--oak-text-3", "#6e6457"),
    accent: cssVar(canvas, "--oak-accent", "#2f6b45"),
    amber: cssVar(canvas, "--oak-accent-2", "#b7791f"),
    lane: cssVar(canvas, "--oak-lane-in", "rgba(47,107,69,.06)"),
  };
  g.fillStyle = c.surface;
  g.fillRect(0, 0, w, h);
  const midis = notes.map((n) => n.midi);
  const lo = Math.min(...midis) - 2.5;
  const hi = Math.max(...midis) + 2.5;
  const y = (m: number) => h - 14 - ((m - lo) / (hi - lo)) * (h - 28);
  const x = (t: number) => 8 + (Math.max(0, Math.min(span, t)) / span) * (w - 16);
  // Semitone lines.
  g.strokeStyle = c.border;
  g.lineWidth = 1;
  for (let m = Math.ceil(lo); m <= hi; m++) {
    g.beginPath();
    g.moveTo(0, Math.round(y(m)) + 0.5);
    g.lineTo(w, Math.round(y(m)) + 0.5);
    g.stroke();
  }
  // Ribbons: ±tolerance; filled by credit once graded (opacity ∝ accuracy), with a tick at the mean error.
  notes.forEach((n, i) => {
    const top = y(n.midi + tolCents / 100);
    const bottom = y(n.midi - tolCents / 100);
    const x0 = x(n.at);
    const x1 = x(n.at + n.dur);
    const nr = graded?.[i];
    g.fillStyle = c.lane;
    g.fillRect(x0, top, x1 - x0, bottom - top);
    if (nr && nr.cents !== null) {
      g.globalAlpha = 0.15 + 0.45 * nr.credit;
      g.fillStyle = c.accent;
      g.fillRect(x0, top, x1 - x0, bottom - top);
      g.globalAlpha = 1;
      const ty = y(n.midi + Math.max(-100, Math.min(100, nr.cents)) / 100);
      g.strokeStyle = c.text;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x1 - 14, ty);
      g.lineTo(x1 - 2, ty);
      g.stroke();
    }
    g.strokeStyle = c.accent;
    g.lineWidth = 1.5;
    g.strokeRect(x0 + 0.5, top + 0.5, x1 - x0 - 1, bottom - top - 1);
    g.fillStyle = c.text;
    g.font = "600 12px Inter Variable, system-ui, sans-serif";
    g.fillText(n.label ?? "", x0 + 4, top - 4);
  });
  // The live trace (ux §4.3): 3 px, in the degree colour while the voice is in a target's band, `--text-3` out of
  // it, gaps for unvoiced frames. A thin ink underlay keeps the light colours (3 on Paper) on their edge, and each
  // coloured run ends in its degree label: a degree colour never appears without its number.
  if (showTrace) {
    const segs = traceSegments(trace, notes, tolCents, key);
    const path = (pts: readonly { t: number; midi: number }[]) => {
      g.beginPath();
      let pen = false;
      for (const pt of pts) {
        if (pt.t < 0 || pt.t > span) {
          pen = false;
          continue;
        }
        const px = x(pt.t);
        const py = y(Math.max(lo, Math.min(hi, pt.midi)));
        if (pen) g.lineTo(px, py);
        else g.moveTo(px, py);
        pen = true;
      }
    };
    g.lineJoin = "round";
    g.lineCap = "round";
    for (const seg of segs) {
      const st = seg.degree ? degreeStyle(seg.degree, theme) : null;
      if (st) {
        path(seg.points);
        g.strokeStyle = c.text;
        g.globalAlpha = 0.55;
        g.lineWidth = 5;
        g.stroke();
        g.globalAlpha = 1;
      }
      path(seg.points);
      g.strokeStyle = st ? st.fill : c.text3;
      g.lineWidth = 3;
      g.stroke();
    }
    // The degrees drawn in colour, in order, for tests and for the text alternative's consistency.
    canvas.dataset.traceDegrees = [
      ...new Set(segs.filter((x) => x.degree && x.points.length > 1).map((x) => x.degree)),
    ].join(" ");
    g.font = "600 11px Inter Variable, system-ui, sans-serif";
    for (const seg of segs) {
      const end = seg.points[seg.points.length - 1];
      const start = seg.points[0];
      if (!seg.degree || !end || !start || end.t - start.t < 0.2 || end.t > span) continue;
      const st = degreeStyle(seg.degree, theme);
      const label = st.text;
      const w = g.measureText(label).width + 8;
      const lx = Math.min(x(end.t) + 4, canvas.clientWidth - w - 2);
      const ly = y(Math.max(lo, Math.min(hi, end.midi))) - 8;
      g.fillStyle = st.fill;
      g.fillRect(lx, ly, w, 16);
      g.strokeStyle = st.outline ?? c.text;
      g.lineWidth = 1;
      g.strokeRect(lx + 0.5, ly + 0.5, w - 1, 15);
      g.fillStyle = st.label;
      g.fillText(label, lx + 4, ly + 12);
    }
  }
  if (now !== null && now >= 0) {
    g.strokeStyle = c.amber;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x(now), 0);
    g.lineTo(x(now), h);
    g.stroke();
  }
}

export function SingCaptureAnswer(p: AnswerWidgetProps<"mic">) {
  const { value, onChange, disabled, feedback } = p;
  const env = useAnswerEnv();
  const setup = env.sing;
  const baseProfile = env.profile ?? NEUTRAL_PROFILE;
  // The server's ladder decides the tolerance (wave3.md §5.3): it reaches the grade through the profile.
  const profile: LearnerProfile =
    setup?.tolCents !== undefined
      ? { ...baseProfile, singTolCents: setup.tolCents as LearnerProfile["singTolCents"] }
      : baseProfile;
  const audio = env.audio ?? appAudio;
  const tol = setup?.tol ?? DEFAULT_SING_TOL;
  const tolCents = tol.cents === "learner" ? profile.singTolCents : tol.cents;
  const showTrace = setup?.showTrace ?? "live";
  const labels = setup?.labels ?? "numbers";
  const beat = setup?.countIn ? 60 / setup.countIn.bpm : 0;
  const leadIn = setup?.countIn ? setup.countIn.beats * beat : (setup?.leadIn ?? 1);
  const fitted = setup ? fitNotes(setup.notes, profile) : { notes: [], shift: 0 };
  const notes = fitted.notes.map((n) => ({ ...n, at: n.at + leadIn, label: targetLabel(n, labels) }));
  const span = takeSeconds(notes) + 0.4;
  const sight = setup?.mode === "sight";
  const ref = setup?.reference;
  const refTonic = ref ? ref.tonic + fitted.shift : null;
  // The key the trace is coloured in: the reference's home (moved with the notes), else read from a target.
  const laneKey = traceKey(
    notes,
    ref && refTonic !== null ? { tonic: refTonic, mode: ref.mode ?? "major" } : null,
  );

  const [phase, setPhase] = useState<Phase>(env.quiet ? "quiet" : value.length > 0 ? "done" : "idle");
  // Why the self-check is showing: Quiet mode (server state), the learner's choice, or the mic.
  const [quietBy, setQuietBy] = useState<"mode" | "choice" | "mic">(env.quiet ? "mode" : "choice");
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<SungResult | null>(null);
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [selfCheck, setSelfCheck] = useState<QuietEvidence["selfCheck"] | null>(null);
  const [srLine, setSrLine] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<MicSession | null>(null);
  const frames = useRef<PitchFrame[]>([]);
  const startAt = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (env.quiet) {
      setPhase("quiet");
      setQuietBy("mode");
    } else if (quietBy === "mode" && phase === "quiet") {
      // Quiet mode switched off (here or in another tab): the mic is offered again. A self-check the learner
      // chose ("Can't sing now") stays as it is.
      setPhase(value.length > 0 ? "done" : "idle");
      setQuietBy("choice");
    }
  }, [env.quiet]);
  // Playback (the target, the reference, the take): timers cleared on unmount and on every new playback.
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);
  const playSeq = (seq: readonly { midi: number | readonly number[]; at: number; dur: number }[]) => {
    clearTimers();
    const t0 = seq[0]?.at ?? 0;
    for (const n of seq)
      timers.current.push(
        window.setTimeout(() => audio.playNote(n.midi, { dur: n.dur }), Math.max(0, n.at - t0) * 1000),
      );
  };
  const playTarget = () => {
    if (setup?.playTarget) setup.playTarget();
    else playSeq(notes);
  };
  // Home and the chords that set it are the shared singing reference (@oak/strudel/reference) when the host
  // has it, so every sung step and trial hears the same home; else the piano.
  const playHome = () => {
    if (refTonic === null) return;
    clearTimers();
    if (audio.reference) audio.reference("tonic", refTonic);
    else audio.playNote(refTonic, { dur: 1.2 });
  };
  const playChords = () => {
    if (refTonic === null) return;
    if (audio.reference) {
      clearTimers();
      audio.reference("cadence", refTonic, ref?.mode ?? "major");
      return;
    }
    playSeq(
      cadenceChords(refTonic, ref?.mode ?? "major").map((c, i) => ({ midi: c, at: i * 0.75, dur: 0.7 })),
    );
  };
  const playTake = () => playSeq(takeNotes(value, notes));
  useEffect(() => {
    if (p.autoFocus) btn.current?.focus();
  }, [p.autoFocus]);
  // The host's "Try again" (docs/design/retry.md §2.5): a new take starts at once, no second press.
  const retakes = useRef(p.retake ?? 0);
  useEffect(() => {
    const n = p.retake ?? 0;
    if (n <= retakes.current) return;
    retakes.current = n;
    if (phase !== "quiet" && phase !== "singing" && phase !== "opening" && phase !== "cue") void sing();
  }, [p.retake]);
  const locked = p.locked === true;
  useEffect(() => () => session.current?.close(), []);

  // What the lane and the chips show: the live or final result, else a stored take's summary (`value`).
  const graded: readonly { cents: number | null; credit: number }[] | null =
    result?.notes ?? (value.length > 0 ? value : null);
  // Redraw on every change (cheap: a few hundred points), a theme switch included: the canvas reads the
  // theme's tokens when it draws, and a Paper lane stayed on a Bark page after the theme changed.
  const theme = useThemeName();
  useEffect(() => {
    void theme;
    const el = canvas.current;
    if (!el || notes.length === 0) return;
    drawLane(
      el,
      notes,
      trace,
      graded,
      tolCents,
      span,
      phase === "singing" ? now : null,
      showTrace === "live" || (showTrace === "after" && phase === "done"),
      laneKey,
      theme,
    );
  });

  // The take: frames in, live grade and trace out (10 per second); the end closes the mic and grades.
  const lastSr = useRef(0);
  const tick = useRef<() => void>(() => {});
  tick.current = () => {
    const s = session.current;
    const ctx = ctxRef.current;
    if (!ctx || !s) return;
    const t = ctx.currentTime - startAt.current;
    setNow(t);
    setLevel(dbToLevel(s.levelDb()));
    const fs = frames.current;
    const tr = traceOf(fs, notes, startAt.current, profile, tol.octave);
    setTrace(tr);
    setResult(gradeLive(fs, notes, startAt.current, tol, setup?.mode ?? "pitch", profile, ctx.currentTime));
    if (performance.now() - lastSr.current > 1500) {
      lastSr.current = performance.now();
      const active = notes.findIndex((n) => t >= n.at && t <= n.at + n.dur);
      const last = [...tr].reverse().find((pt) => pt.midi !== null);
      if (active >= 0 && last && last.midi !== null) {
        const cents = (last.midi - (notes[active] as SingNote).midi) * 100;
        const n = needleWords(cents, tolCents);
        const target = notes[active] as SingNote;
        setSrLine(
          `Target ${target.degree ? targetSpoken(target, labels) : (target.label ?? active + 1)}. You're ${n.words}, ${centsText(cents)}.`,
        );
      }
    }
    if (t >= span) stop(true);
  };
  useEffect(() => {
    if (phase !== "singing") return;
    const id = window.setInterval(() => tick.current(), 100);
    return () => window.clearInterval(id);
  }, [phase]);

  const stop = (grade: boolean) => {
    const s = session.current;
    session.current = null;
    s?.close();
    setNow(null);
    setLevel(0);
    if (!grade) {
      setPhase("idle");
      return;
    }
    const final = gradeTake(frames.current, notes, startAt.current, tol, setup?.mode ?? "pitch", profile);
    setResult(final);
    setTrace(traceOf(frames.current, notes, startAt.current, profile, tol.octave));
    setPhase("done");
    onChange(summarize(final));
    setup?.onTake?.({
      result: final,
      startAt: startAt.current,
      frames: frames.current.length,
      pitchFrames: frames.current,
    });
  };

  const sing = async () => {
    if (disabled || !setup) return;
    setProblem(null);
    setResult(null);
    setTrace([]);
    onChange([]);
    try {
      if (setup.playCue) {
        setPhase("cue");
        await setup.playCue();
      }
      setPhase("opening");
      const [{ openMic }, ctx] = await Promise.all([import("../../lib/mic.ts"), audio.context()]);
      const s = await openMic();
      session.current = s;
      frames.current = [];
      s.onFrame((f) => frames.current.push(f));
      ctxRef.current = ctx;
      startAt.current = ctx.currentTime;
      if (setup.countIn)
        for (let i = 0; i < setup.countIn.beats; i++) audio.click(startAt.current + 0.05 + i * beat, i === 0);
      setPhase("singing");
    } catch (e) {
      const reason = (e as { reason?: string }).reason;
      session.current?.close();
      session.current = null;
      if (reason === "denied" || reason === "no-device") {
        setProblem(
          reason === "denied"
            ? "The microphone is blocked for Oak. You can listen and self-check instead."
            : "No microphone was found. You can listen and self-check instead.",
        );
        setQuietBy("mic");
        setPhase("quiet");
      } else {
        setProblem(
          e instanceof Error ? `The microphone did not open: ${e.message}` : "The microphone did not open.",
        );
        setPhase("idle");
      }
    }
  };

  // The take's own Try again (before a verdict): Alt+R as the button, the same key as the host's row after one.
  useTakeRetryKey(phase === "done" && !locked && !disabled && !!setup, () => void sing());

  const report = (check: QuietEvidence["selfCheck"]) => {
    setSelfCheck(check);
    setup?.onQuietEvidence?.({
      modality: quietBy === "mode" ? "quiet" : "fallback",
      selfCheck: check,
      at: Date.now(),
    });
  };

  if (!setup)
    return (
      <AnswerFrame kind="mic" idBase={p.idBase} label={p.label} feedback={feedback} onSubmit={p.onSubmit}>
        <p className="text-sm text-text-2">This step has no notes to sing yet.</p>
      </AnswerFrame>
    );

  const quiet = phase === "quiet";
  const lastCents = (() => {
    if (phase !== "singing" || now === null) return null;
    const active = notes.find((n) => now >= n.at && now <= n.at + n.dur);
    const last = trace.at(-1);
    if (!active || !last || last.midi === null) return null;
    return { cents: (last.midi - active.midi) * 100, folded: last.folded };
  })();
  const needle = needleWords(lastCents?.cents ?? null, tolCents);

  const countNum =
    phase === "singing" && setup.countIn && now !== null && now >= 0 && now < (notes[0]?.at ?? 0)
      ? Math.min(setup.countIn.beats, Math.floor(now / beat) + 1)
      : null;
  const targets = (
    <ol className="flex min-h-7 flex-wrap items-start gap-2 text-sm" aria-label="Notes">
      {notes.map((n, i) => {
        const r = graded?.[i];
        const settled = (phase === "done" || (phase !== "singing" && value.length > 0)) && r;
        const ok = settled ? r.credit >= 1 : null;
        return (
          <li
            key={i}
            aria-label={`${n.degree ? targetSpoken(n, labels) : (n.label ?? `note ${i + 1}`)}${settled ? (r.cents === null ? ", not heard" : `, ${noteMarkText(r.cents)}, ${ok ? "in tune" : "outside the band"}`) : ""}`}
            className={clsx(
              "inline-flex items-center gap-1 rounded-control border px-2 py-0.5",
              settled ? (ok ? "border-accent" : "border-issue") : "border-border",
            )}
          >
            {settled ? (
              ok ? (
                <Check aria-hidden className="size-3.5 text-accent" />
              ) : (
                <X aria-hidden className="size-3.5 text-issue" />
              )
            ) : null}
            <span className="font-semibold">{n.label || i + 1}</span>
            {quiet ? null : (
              <span className="text-text-2 tabular-nums">{settled ? noteMarkText(r.cents) : "·"}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
  const refButtons =
    refTonic !== null ? (
      <>
        <Button
          size="sm"
          variant="ghost"
          data-enter="native"
          icon={<Home aria-hidden className="size-4" />}
          onClick={playHome}
          disabled={disabled || phase === "singing" || phase === "opening"}
        >
          Home
        </Button>
        {ref?.chords ? (
          <Button
            size="sm"
            variant="ghost"
            data-enter="native"
            icon={<Music2 aria-hidden className="size-4" />}
            onClick={playChords}
            disabled={disabled || phase === "singing" || phase === "opening"}
          >
            Chords
          </Button>
        ) : null}
      </>
    ) : null;

  return (
    <AnswerFrame
      kind="mic"
      idBase={p.idBase}
      label={p.label}
      feedback={feedback}
      disabled={disabled}
      onSubmit={p.onSubmit}
      keys={
        <>
          {quiet ? null : <KeyHint keys={["⌘/Ctrl ⇧ M"]}>close the mic</KeyHint>}
          <SubmitHint />
        </>
      }
    >
      {quiet ? (
        <div
          className="flex max-w-[40rem] flex-col gap-3 rounded-card border border-border bg-surface p-3"
          data-testid="sing-quiet"
          data-quiet-by={quietBy}
        >
          <p className="flex items-center gap-2 font-medium">
            <Ear aria-hidden className="size-4 text-text-2" />
            Listen and self-check
          </p>
          <p className="text-sm text-text-2">
            {/* "Quiet mode" only when it is on; a blocked or missing mic says why below instead. */}
            {quietBy === "mode" ? "Quiet mode: play it" : "Play it"}, then sing it in your head or aloud and
            say how it went. Nothing is recorded, and there is no penalty.
          </p>
          {problem ? <p className="text-sm text-text-2">{problem}</p> : null}
          {notes.length > 1 || notes[0]?.degree ? targets : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              data-enter="native"
              icon={<Play aria-hidden className="size-4" />}
              onClick={playTarget}
              disabled={disabled}
            >
              Play it
            </Button>
            {refButtons}
            <Button
              data-enter="native"
              variant={selfCheck === "heard-it" ? "primary" : "secondary"}
              aria-pressed={selfCheck === "heard-it"}
              onClick={() => report("heard-it")}
              disabled={disabled}
            >
              I heard it
            </Button>
            <Button
              data-enter="native"
              variant={selfCheck === "not-sure" ? "primary" : "secondary"}
              aria-pressed={selfCheck === "not-sure"}
              onClick={() => report("not-sure")}
              disabled={disabled}
            >
              Not sure yet
            </Button>
          </div>
          <p className="min-h-5 text-sm text-text-2" aria-live="polite">
            {selfCheck === "heard-it"
              ? "Noted. Singing it later turns this into voice practice."
              : selfCheck === "not-sure"
                ? "Noted. Play it again as often as you like."
                : ""}
          </p>
          {quietBy !== "mode" ? (
            <Button
              size="sm"
              variant="ghost"
              className="w-fit"
              data-enter="native"
              icon={<Mic aria-hidden className="size-4" />}
              onClick={() => {
                setSelfCheck(null);
                setProblem(null);
                setPhase(value.length > 0 ? "done" : "idle");
              }}
              disabled={disabled}
            >
              Sing it after all
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex min-h-10 flex-wrap items-center gap-2">
            {phase === "singing" ? (
              <Button
                data-enter="native"
                icon={<Square aria-hidden className="size-4" />}
                onClick={() => stop(false)}
              >
                Stop
              </Button>
            ) : locked && (phase === "done" || phase === "idle") ? null : (
              <Button
                ref={btn}
                data-enter="native"
                {...(phase === "done" ? TAKE_RETRY_PROPS : {})}
                variant={phase === "done" ? "secondary" : "primary"}
                icon={
                  phase === "done" ? (
                    <RotateCcw aria-hidden className="size-4" />
                  ) : (
                    <Mic aria-hidden className="size-4" />
                  )
                }
                onClick={() => void sing()}
                disabled={disabled || phase === "cue" || phase === "opening"}
                loading={phase === "opening"}
              >
                {phase === "done" ? <TakeRetryLabel /> : phase === "cue" ? "Listen…" : "Sing"}
              </Button>
            )}
            {refButtons}
            {!sight || phase === "done" ? (
              <Button
                size="sm"
                variant="ghost"
                data-enter="native"
                icon={<Play aria-hidden className="size-4" />}
                onClick={playTarget}
                disabled={disabled || phase === "singing" || phase === "opening"}
              >
                Hear it
              </Button>
            ) : null}
            {phase === "done" && value.some((n) => n.cents !== null) ? (
              <Button
                size="sm"
                variant="ghost"
                data-enter="native"
                icon={<Ear aria-hidden className="size-4" />}
                onClick={playTake}
                disabled={disabled}
              >
                Hear my singing
              </Button>
            ) : null}
            {phase !== "singing" && !locked ? (
              <Button
                variant="ghost"
                size="sm"
                data-enter="native"
                onClick={() => {
                  setQuietBy("choice");
                  setPhase("quiet");
                }}
                disabled={disabled}
              >
                Can't sing now
              </Button>
            ) : null}
          </div>
          <p className="min-h-5 text-sm text-text-2" aria-live="polite" data-testid="sing-phase">
            {phase === "idle"
              ? `${notes.length === 1 ? "One note" : `${notes.length} notes`}, within ±${tolCents}¢.${sight ? " Press Sing, wait for the count-in, then sing the notes on the staff: Oak plays them after." : ""} Your voice is analysed live on this computer. Nothing is recorded or sent.`
              : phase === "cue"
                ? "Listen first."
                : phase === "opening"
                  ? "Opening the microphone…"
                  : phase === "singing"
                    ? (now ?? 0) < (notes[0]?.at ?? 0)
                      ? countNum !== null
                        ? `Count-in: ${countNum}`
                        : "Get ready…"
                      : "Sing now."
                    : `Done: ${value.filter((n) => n.credit >= 1).length} of ${value.length} in tune.`}
          </p>
          {problem ? <p className="text-sm text-issue">{problem}</p> : null}
          <div className="relative">
            <canvas
              ref={canvas}
              role="img"
              aria-label={`Pitch lane: ${notes.map((n) => n.label ?? "").join(", ")}; band ±${tolCents}¢`}
              className="block w-full rounded-card border border-border"
              style={{ height: LANE_H }}
            />
            {countNum !== null ? (
              <span
                aria-hidden
                data-testid="sing-count"
                className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-[4rem] leading-none text-text-3"
              >
                {countNum}
              </span>
            ) : null}
            <div className="pointer-events-none absolute top-2 right-2 flex flex-col items-end gap-1 text-sm">
              <span
                className={clsx(
                  "rounded-control bg-surface/90 px-2 py-0.5 font-medium tabular-nums",
                  phase !== "singing" && "invisible",
                )}
                data-testid="sing-needle"
              >
                {needle.arrow ? <span aria-hidden>{needle.arrow} </span> : null}
                {needle.words}
                {lastCents ? ` ${centsText(lastCents.cents)}` : ""}
              </span>
              {lastCents && lastCents.folded !== 0 ? (
                <span className="rounded-control bg-surface/90 px-1.5 text-[0.75rem] text-text-2">
                  {lastCents.folded > 0 ? "8vb" : "8va"}
                </span>
              ) : null}
            </div>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            {targets}
            <MicLevelMeter level={level} live={phase === "singing"} segments={16} />
          </div>
          <p className="sr-only" aria-live="polite">
            {srLine}
          </p>
        </div>
      )}
    </AnswerFrame>
  );
}
