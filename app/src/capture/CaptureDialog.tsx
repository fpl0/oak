// Oak 2.0 W1 (S1): capture an idea from anywhere. Hum it (the transcriber's live hum, over a click), tap a rhythm on
// Space over a count-in, or bring a voice memo and tap its beat. The result is one plain Strudel line that always
// lands in scraps first; "to: sketch" then makes a new sketch from it. Key, tempo, meter and part are fields the
// learner sees and can change before starting (filled from the last capture, else Oak's C major, 90, 4/4), so a
// capture never hides a default. An unsaved result is kept for the tab (`oak.capture.pending`) until it is saved or
// discarded. Nothing here rates the idea.
import type { KeySpec, MeterId, ScrapCreate } from "@oak/api";
import { barSeconds, METERS } from "@oak/theory";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Mic, Play, Square } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { errorWords } from "../lib/error-words.ts";
import { getOak } from "../lib/oak.ts";
import { useSketchCreate } from "../lib/queries.ts";
import { currentSessionId } from "../session/store.ts";
import { MODES, TONICS } from "../studio/model.ts";
import { sketchFromScraps } from "../studio/scraps/model.ts";
import { useScrapCreate } from "../studio/scraps/queries.ts";
import { HumDialog } from "../transcribe/HumDialog.tsx";
import { draftNotes, HUM_TRACK, type HumTarget } from "../transcribe/hum.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Callout, SegmentedControl } from "../ui/kit/Controls.tsx";
import { Dialog } from "../ui/kit/Dialog.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { useVoice } from "../voice/use-voice.ts";
import { captureEngines } from "./engines.ts";
import {
  CAPTURE_METERS,
  type CaptureSettings,
  captureSketchTitle,
  humScrapBody,
  monoOf,
  type PendingCapture,
  readLastCapture,
  readPendingCapture,
  type TapDrum,
  tapGridOf,
  tapScrapBody,
  tempoOfTaps,
  writeLastCapture,
  writePendingCapture,
} from "./model.ts";
import type { CaptureMode, CaptureRequest } from "./store.ts";

const local = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};
const session = (): Storage | null => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const TAP_DRUMS: readonly { value: TapDrum; label: string }[] = [
  { value: "bd", label: "Kick" },
  { value: "sd", label: "Snare" },
  { value: "hh", label: "Hats" },
];
/** How many bars a tap take lasts: Oak's choices, the learner picks; two bars at first (Oak's call). */
const TAP_BARS = [1, 2, 4] as const;
type TapBars = (typeof TAP_BARS)[number];

type Phase =
  | { kind: "idle" }
  | { kind: "counting" }
  | { kind: "tapping"; bar: number; bars: number }
  | { kind: "listening"; taps: number }
  | { kind: "drafting" }
  | { kind: "result"; body: ScrapCreate; notes: string[] }
  | { kind: "error"; message: string };

const MODE_WORDS: Record<CaptureMode, string> = { hum: "Hum", tap: "Tap", memo: "Voice memo" };

export function CaptureDialog({ request, onClose }: { request: CaptureRequest; onClose(): void }) {
  const engines = useMemo(() => captureEngines(), []);
  const modes: CaptureMode[] = engines ? ["hum", "tap", "memo"] : ["hum"];
  const [mode, setMode] = useState<CaptureMode>(
    request.mode && modes.includes(request.mode) ? request.mode : "hum",
  );
  const [settings, setSettings] = useState<CaptureSettings>(() => readLastCapture(local()));
  const [pending] = useState<PendingCapture | null>(() => readPendingCapture(session()));
  const to = pending?.to ?? request.to;
  const [phase, setPhase] = useState<Phase>(() =>
    pending ? { kind: "result", body: pending.body, notes: [] } : { kind: "idle" },
  );
  const [humming, setHumming] = useState(false);
  const [drum, setDrum] = useState<TapDrum | null>(null);
  const [tapBars, setTapBars] = useState<TapBars>(2);
  const [memo, setMemo] = useState<{ name: string; buffer: AudioBuffer } | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const voice = useVoice();
  const quiet = voice.quiet.quiet;
  const createScrap = useScrapCreate();
  const createSketch = useSketchCreate();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const mounted = useRef(true);
  // Set on mount too: StrictMode (dev) runs this effect's cleanup once before mounting again.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopRef.current?.();
    };
  }, []);

  const busy =
    phase.kind === "counting" ||
    phase.kind === "tapping" ||
    phase.kind === "listening" ||
    phase.kind === "drafting";

  const close = () => {
    stopRef.current?.();
    onClose();
  };

  const showResult = (body: ScrapCreate, notes: string[] = []) => {
    writePendingCapture(session(), { body, to });
    setPhase({ kind: "result", body, notes });
  };

  const save = async (body: ScrapCreate) => {
    writePendingCapture(session(), { body, to });
    setSaving(true);
    try {
      const saved = await createScrap.mutateAsync({ body });
      writePendingCapture(session(), null);
      writeLastCapture(local(), settings);
      if (to === "sketch") {
        try {
          const sketch = await createSketch.mutateAsync({
            body: sketchFromScraps([saved], captureSketchTitle(body), currentSessionId()),
          });
          void qc.invalidateQueries({ queryKey: ["api", "scraps.list"] });
          onClose();
          void navigate({ to: "/studio/$sketchId", params: { sketchId: sketch.sketch.id } });
        } catch (e) {
          // The scrap is kept: the sketch can be made from Studio › Scraps.
          onClose();
          toast.error("Saved to scraps; the sketch wasn't made", errorWords(e));
        }
      } else {
        onClose();
        toast.success("Saved to scraps", "Studio › Scraps has it.");
      }
    } catch (e) {
      setPhase({ kind: "result", body, notes: [] });
      toast.error("The idea wasn't saved", `${errorWords(e)} It stays here until you save or discard it.`);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    writePendingCapture(session(), null);
    setPhase({ kind: "idle" });
  };

  /** Space while tapping: taken before the shell's keymap and the focused button see it. */
  const listenForSpace = (onTap: () => void): (() => void) => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) onTap();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  };

  const startTap = async () => {
    if (!engines || !drum) return;
    const { bpm, meter } = settings;
    const bars = tapBars;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let click: { stop(): void } | null = null;
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    stopRef.current = () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      click?.stop();
      unlisten?.();
      stopRef.current = null;
    };
    try {
      const oak = await getOak();
      await oak.unlock();
      const { clickPlan } = await import("@oak/drills");
      const barSec = barSeconds(bpm, meter);
      const units = METERS[meter].unitsPerBar;
      // One bar to count in, then the click keeps going under the taps.
      const handle = oak.playEvents(clickPlan(bars + 1, 1 / barSec, units), { exclusive: true });
      click = handle;
      const downbeat = handle.startTime + barSec;
      const taps: number[] = [];
      unlisten = listenForSpace(() => taps.push(oak.ctx.currentTime - downbeat));
      const now = oak.ctx.currentTime;
      const ms = (t: number) => Math.max(0, (t - now) * 1000);
      setPhase({ kind: "counting" });
      for (let b = 1; b <= bars; b++)
        timers.push(
          setTimeout(() => setPhase({ kind: "tapping", bar: b, bars }), ms(handle.startTime + b * barSec)),
        );
      await new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms(downbeat + bars * barSec + 0.3)));
      });
      if (cancelled) return;
      // The take is over: stop the click and the Space listener (without cancelling this run).
      for (const t of timers) clearTimeout(t);
      click.stop();
      unlisten();
      unlisten = null;
      stopRef.current = null;
      if (!mounted.current) return;
      // Taps up to one bar early are a pickup (the engine writes that bar first); anything earlier is dropped.
      const played = taps.filter((t) => t >= -barSec);
      if (played.length === 0) {
        setPhase({
          kind: "error",
          message: "No taps came through. Press Space on each hit, after the count-in.",
        });
        return;
      }
      const { beatsPerBar, grid } = tapGridOf(meter);
      const r = engines.tapsToMini(played, bpm, { grid, bars, beatsPerBar });
      const notes: string[] = [];
      if (r.dropped > 0)
        notes.push(
          `${r.dropped} ${r.dropped === 1 ? "tap" : "taps"} fell on a step already taken or after the last bar, so ${r.dropped === 1 ? "it was" : "they were"} left out.`,
        );
      if (r.pickup) notes.push("You started before bar 1: that bar is written first.");
      showResult(tapScrapBody(r, { drum, bpm, meter }), notes);
    } catch (e) {
      const wasCancelled = cancelled;
      stopRef.current?.();
      if (!wasCancelled && mounted.current)
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "Sound did not start." });
    }
  };

  const loadMemo = async (file: File) => {
    try {
      setPhase({ kind: "drafting" });
      const oak = await getOak();
      const buffer = await oak.ctx.decodeAudioData(await file.arrayBuffer());
      setMemo({ name: file.name, buffer });
      setPhase({ kind: "idle" });
    } catch {
      setMemo(null);
      setPhase({
        kind: "error",
        message: "That file didn't open as audio. Try a WAV, MP3, M4A or OGG recording.",
      });
    }
  };

  const startMemo = async () => {
    if (!engines || !memo) return;
    const { key, meter } = settings;
    const target = settings.target;
    // Filled in as playback starts; `stop` ends the listening early ("That's the beat") or on close.
    const run: {
      source: AudioBufferSourceNode | null;
      unlisten: (() => void) | null;
      finish: (() => void) | null;
      stopped: boolean;
    } = { source: null, unlisten: null, finish: null, stopped: false };
    stopRef.current = () => {
      run.stopped = true;
      run.unlisten?.();
      try {
        run.source?.stop();
      } catch {
        // Already stopped.
      }
      run.finish?.();
      stopRef.current = null;
    };
    try {
      const oak = await getOak();
      await oak.unlock();
      const ctx = oak.ctx;
      const src = ctx.createBufferSource();
      run.source = src;
      src.buffer = memo.buffer;
      src.connect(ctx.destination);
      const t0 = ctx.currentTime + 0.1;
      const taps: number[] = [];
      run.unlisten = listenForSpace(() => {
        taps.push(ctx.currentTime - t0);
        setPhase({ kind: "listening", taps: taps.length });
      });
      setPhase({ kind: "listening", taps: 0 });
      // Ends when the memo ends or the learner presses "That's the beat".
      const done = new Promise<void>((resolve) => {
        run.finish = resolve;
        src.onended = () => resolve();
      });
      src.start(t0);
      await done;
      run.unlisten?.();
      run.unlisten = null;
      try {
        src.stop();
      } catch {
        // Already ended.
      }
      stopRef.current = null;
      if (!mounted.current) return;
      if (run.stopped && taps.length === 0) {
        setPhase({ kind: "idle" });
        return;
      }
      const beat = tempoOfTaps(taps);
      if (!beat) {
        setPhase({
          kind: "error",
          message:
            "Oak didn't hear a steady beat in the taps. Play it again and tap Space on every beat, four or more times.",
        });
        return;
      }
      setPhase({ kind: "drafting" });
      // Let the "Working…" line paint before the tracker runs.
      await new Promise((r) => setTimeout(r, 0));
      const track = HUM_TRACK[target];
      const r = engines.humFromPcm(monoOf(memo.buffer), memo.buffer.sampleRate, {
        key,
        bpm: beat.bpm,
        meter,
        downbeat: beat.downbeat,
        maxBars: 8,
        label: track.label,
        tonicOctave: track.octave,
      });
      const { sung: _sung, degrees: _degrees, ...draft } = r;
      if (draft.notes.length === 0) {
        setPhase({ kind: "error", message: draftNotes(draft)[0] ?? "No clear notes came through." });
        return;
      }
      showResult(humScrapBody(draft, target, { sourceKind: "memo", meter, key }), draftNotes(draft));
    } catch (e) {
      stopRef.current?.();
      if (mounted.current)
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "The memo didn't play." });
    }
  };

  const result = phase.kind === "result" ? phase : null;
  const saveLabel = to === "sketch" ? "Save and open as a sketch" : "Save to scraps";
  // Four bars to sing, as the transcriber offers for the learner's own audio (Oak's call).
  const humPlan = {
    key: settings.key,
    bpm: settings.bpm,
    meter: settings.meter,
    bars: 4,
    target: settings.target,
  };

  let footer: ReactNode;
  if (result) {
    footer = (
      <>
        <Button variant="ghost" onClick={discard} disabled={saving} data-testid="capture-discard">
          Discard
        </Button>
        <Button
          variant="primary"
          loading={saving}
          onClick={() => void save(result.body)}
          data-testid="capture-save"
        >
          {saveLabel}
        </Button>
      </>
    );
  } else if (mode === "hum") {
    footer = (
      <>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<Mic aria-hidden className="size-4" />}
          disabled={quiet}
          onClick={() => setHumming(true)}
          data-testid="capture-hum-start"
        >
          Start humming
        </Button>
      </>
    );
  } else if (mode === "tap") {
    footer = (
      <>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={drum === null}
          loading={busy}
          onClick={() => void startTap()}
          data-testid="capture-tap-start"
        >
          {phase.kind === "error" ? "Try again" : "Count in and tap"}
        </Button>
      </>
    );
  } else {
    footer =
      phase.kind === "listening" ? (
        <Button
          variant="primary"
          icon={<Square aria-hidden className="size-4" />}
          onClick={() => stopRef.current?.()}
          data-testid="capture-memo-done"
        >
          That's the beat
        </Button>
      ) : (
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<Play aria-hidden className="size-4" />}
            disabled={memo === null}
            loading={busy}
            onClick={() => void startMemo()}
            data-testid="capture-memo-start"
          >
            Play it and tap the beat
          </Button>
        </>
      );
  }

  return (
    <>
      <Dialog
        open={!humming}
        onClose={close}
        title="Capture an idea"
        description={
          to === "sketch"
            ? "Hum, tap or bring a voice memo. It goes to your scraps, then opens as a new sketch."
            : "Hum, tap or bring a voice memo. It goes to your scraps as one line of code."
        }
        footer={footer}
      >
        <div className="flex flex-col gap-3" data-testid="capture-dialog" aria-live="polite">
          {result ? (
            <ResultView body={result.body} notes={result.notes} />
          ) : (
            <>
              {modes.length > 1 ? (
                <SegmentedControl<CaptureMode>
                  label="How"
                  value={mode}
                  onChange={(m) => {
                    if (busy) return;
                    setMode(m);
                    setPhase({ kind: "idle" });
                  }}
                  options={modes.map((m) => ({ value: m, label: MODE_WORDS[m], disabled: busy }))}
                />
              ) : null}
              <SettingsFields settings={settings} onChange={setSettings} mode={mode} disabled={busy} />
              {mode === "hum" && quiet ? (
                <p className="text-sm text-text-2">
                  Quiet mode is on, so the mic stays closed. Tapping a rhythm or bringing a voice memo still
                  works.
                </p>
              ) : null}
              {mode === "tap" ? (
                <TapFields drum={drum} onDrum={setDrum} bars={tapBars} onBars={setTapBars} disabled={busy} />
              ) : null}
              {mode === "memo" ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Voice memo</span>
                  <input
                    type="file"
                    accept="audio/*"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void loadMemo(f);
                    }}
                    data-testid="capture-memo-file"
                  />
                  {memo ? (
                    <span className="text-text-2">
                      {memo.name} · {Math.round(memo.buffer.duration)} s. Play it, then tap Space on each
                      beat.
                    </span>
                  ) : null}
                </label>
              ) : null}
              <PhaseLine phase={phase} />
            </>
          )}
        </div>
      </Dialog>
      {humming ? (
        <HumDialog
          open
          onClose={() => setHumming(false)}
          plan={humPlan}
          quiet={quiet}
          code=""
          useLabel={to === "sketch" ? "Save and open as a sketch" : "Save to scraps"}
          onUse={(_code, draft) => {
            void save(
              humScrapBody(draft, settings.target, {
                sourceKind: "hum",
                meter: settings.meter,
                key: settings.key,
              }),
            );
          }}
        />
      ) : null}
    </>
  );
}

function PhaseLine({ phase }: { phase: Phase }) {
  switch (phase.kind) {
    case "counting":
      return <p className="text-h3">Count in…</p>;
    case "tapping":
      return (
        <p className="text-h3" data-testid="capture-tapping">
          Tap Space · bar {phase.bar} of {phase.bars}
        </p>
      );
    case "listening":
      return (
        <p className="text-h3" data-testid="capture-listening">
          Tap Space on the beat · {phase.taps} {phase.taps === 1 ? "tap" : "taps"}
        </p>
      );
    case "drafting":
      return <p className="text-sm text-text-2">Working…</p>;
    case "error":
      return (
        <Callout tone="issue" title="Nothing to keep yet">
          {phase.message}
        </Callout>
      );
    default:
      return null;
  }
}

function ResultView({ body, notes }: { body: ScrapCreate; notes: string[] }) {
  return (
    <div className="flex flex-col gap-2" data-testid="capture-result">
      <p className="text-sm text-text-2">
        Oak wrote this line from your{" "}
        {body.sourceKind === "tap" ? "taps" : body.sourceKind === "memo" ? "memo" : "humming"}. It is a
        starting point: change anything in the editor later.
      </p>
      <pre className="whitespace-pre-wrap break-all rounded-control bg-surface-2 p-2 font-mono text-sm">
        {body.code}
      </pre>
      {notes.map((n) => (
        <p key={n} className="text-sm text-text-2">
          {n}
        </p>
      ))}
    </div>
  );
}

function SettingsFields({
  settings,
  onChange,
  mode,
  disabled,
}: {
  settings: CaptureSettings;
  onChange(s: CaptureSettings): void;
  mode: CaptureMode;
  disabled: boolean;
}) {
  const set = (patch: Partial<CaptureSettings>) => onChange({ ...settings, ...patch });
  const pitched = mode !== "tap";
  const [bpmText, setBpmText] = useState(String(settings.bpm));
  return (
    <fieldset className="grid grid-cols-2 gap-3 text-sm" disabled={disabled}>
      <legend className="sr-only">Key, tempo, meter and part</legend>
      {pitched ? (
        <div className="flex flex-col gap-1">
          <span className="font-medium">Key</span>
          <span className="flex gap-1">
            <select
              aria-label="Key note"
              value={settings.key.tonic}
              onChange={(e) => set({ key: { ...settings.key, tonic: e.target.value } })}
              className="h-8 rounded-control border border-control-border bg-control px-2"
              data-testid="capture-tonic"
            >
              {TONICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              aria-label="Major or minor"
              value={settings.key.mode}
              onChange={(e) => set({ key: { ...settings.key, mode: e.target.value as KeySpec["mode"] } })}
              className="h-8 rounded-control border border-control-border bg-control px-2"
              data-testid="capture-mode"
            >
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </span>
        </div>
      ) : null}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Tempo (BPM)</span>
        <input
          type="number"
          min={40}
          max={240}
          value={bpmText}
          onChange={(e) => {
            // The field keeps what is typed ("1", "12"…); the tempo follows once it is one Oak plays (40–240).
            setBpmText(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(v) && v >= 40 && v <= 240)
              set({ bpm: Math.round(v) });
          }}
          onBlur={() => setBpmText(String(settings.bpm))}
          className="h-8 w-24 rounded-control border border-control-border bg-control px-2"
          data-testid="capture-bpm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Meter</span>
        <select
          value={settings.meter}
          onChange={(e) => set({ meter: e.target.value as MeterId })}
          className="h-8 w-24 rounded-control border border-control-border bg-control px-2"
          data-testid="capture-meter"
        >
          {CAPTURE_METERS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      {pitched ? (
        <div className="flex flex-col gap-1">
          <span className="font-medium">Part</span>
          <SegmentedControl<HumTarget>
            label="Part"
            size="sm"
            value={settings.target}
            onChange={(target) => set({ target })}
            options={[
              { value: "melody", label: "Tune" },
              { value: "bass", label: "Bass" },
            ]}
          />
        </div>
      ) : null}
    </fieldset>
  );
}

function TapFields({
  drum,
  onDrum,
  bars,
  onBars,
  disabled,
}: {
  drum: TapDrum | null;
  onDrum(d: TapDrum): void;
  bars: TapBars;
  onBars(b: TapBars): void;
  disabled: boolean;
}) {
  return (
    <fieldset className="flex flex-wrap items-end gap-4 text-sm" disabled={disabled}>
      <legend className="sr-only">Drum and length</legend>
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Drum">
        <span className="font-medium">Drum</span>
        <span className="flex gap-1">
          {TAP_DRUMS.map((d) => (
            <label
              key={d.value}
              className="flex h-8 cursor-pointer items-center gap-1 rounded-control border border-control-border px-2 has-[:checked]:border-accent has-[:checked]:bg-lane-in"
            >
              <input
                type="radio"
                name="capture-drum"
                value={d.value}
                checked={drum === d.value}
                onChange={() => onDrum(d.value)}
              />
              {d.label}
            </label>
          ))}
        </span>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Bars</span>
        <select
          value={bars}
          onChange={(e) => onBars(Number(e.target.value) as TapBars)}
          className="h-8 w-20 rounded-control border border-control-border bg-control px-2"
          data-testid="capture-bars"
        >
          {TAP_BARS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <p className="basis-full text-text-2">
        One bar of clicks to count in, then tap Space on each hit while the click keeps going.
      </p>
    </fieldset>
  );
}
