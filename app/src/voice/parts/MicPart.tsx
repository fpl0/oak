// `mic.permission`, `mic.noise`, `mic.bleed` (ux §4.7, contracts §8.5–§8.6). Why Oak wants the mic and what it
// does with it, then three sub-steps with one footer each (docs/design/retry.md §6.3): "1 of 3: permission" (the
// browser's permission and a live level: "Hum anything"), "2 of 3: a quiet moment" (three seconds of silence) and
// "3 of 3: speaker check" (does the mic hear Oak's own sound). Every result can be measured again; "Set up later"
// (Quiet mode, said on screen) is in every sub-step, so no room, refusal or missing device is a dead end: a room
// that keeps hearing a voice offers "Use this room anyway" after two checks. In onboarding a reload or Back resumes
// at the first sub-step not yet measured. The mic is open only while a sub-step needs it.
import type { InputKind, MicSession } from "@oak/audio";
import { MicError } from "@oak/audio";
import type { PitchFrame } from "@oak/pitch";
import { Mic, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCalibrations } from "../../lib/queries.ts";
import { MEASURE_LINE } from "../../lib/retry.ts";
import { useUpdateProfile } from "../../lib/settings.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Progress } from "../../ui/kit/basics.tsx";
import { Callout } from "../../ui/kit/Controls.tsx";
import { Select } from "../../ui/kit/Field.tsx";
import { dbToLevel, MicLevelMeter } from "../../ui/kit/Meters.tsx";
import {
  bleedResult,
  bleedVerdict,
  liveMidi,
  micProblemOf,
  micResumeAt,
  noiseVerdict,
  noteReadout,
  offerRoomAnyway,
} from "../logic.ts";
import {
  closeInput,
  inputDevice,
  listInputs,
  micPermission,
  openInput,
  setInputDevice,
  voiceAudio,
} from "../services.ts";
import { useQuietChosen } from "../use-voice.ts";
import { PartActions, PartFrame, type PartProps, ResultRow, StatusSlot, useSaveRun } from "./common.tsx";

export const PRIVACY_LINE = "Your voice is analysed live on this computer. Nothing is recorded or sent.";
/** What "Set up later" does on the mic step, said where it is offered. */
export const QUIET_LINE = "Set up later switches on Quiet mode: singing steps become listening steps.";

type Phase =
  | "ask"
  | "opening"
  | "denied"
  | "no-device"
  | "hear"
  | "noise"
  | "noise-measuring"
  | "noise-done"
  | "bleed"
  | "bleed-measuring"
  | "bleed-done";

type Sub = 1 | 2 | 3;
const subOf = (p: Phase): Sub => (p.startsWith("noise") ? 2 : p.startsWith("bleed") ? 3 : 1);
/** The sub-step names, as the progress in the header shows them. */
export const MIC_SUBS: Readonly<Record<Sub, string>> = {
  1: "1 of 3: permission",
  2: "2 of 3: a quiet moment",
  3: "3 of 3: speaker check",
};
const SUB_NAMES: Readonly<Record<Sub, string>> = { 1: "Permission", 2: "A quiet moment", 3: "Speaker check" };

export interface MicPartProps extends PartProps {
  /** Quiet mode chosen (no mic, or the browser refused): the caller records it and moves on. */
  onQuiet?: () => void;
  /**
   * Run one measurement only (Settings, a lesson's `<Setup part="noise" />`). `"mic"`: open the mic and hear the
   * learner, then stop; a lesson's `<Setup part="mic" />` is followed by its own noise and bleed parts.
   */
  only?: "mic" | "noise" | "bleed";
}

const SIGNAL_DB = -50;
/** After this long with the mic open and nothing heard, the screen says what to check. */
const SILENT_HINT_MS = 8000;

export function MicPart({ profile, onDone, onQuiet, onSkip, only, context, back, onSub }: MicPartProps) {
  const [phase, setPhase] = useState<Phase>(only === "noise" || only === "bleed" ? only : "ask");
  const [level, setLevel] = useState(0);
  const [note, setNote] = useState<number | null>(null);
  const [heard, setHeard] = useState(false);
  const [silentLong, setSilentLong] = useState(false);
  const [inputs, setInputs] = useState<{ deviceId: string; label: string }[]>([]);
  const [device, setDevice] = useState<string | null>(inputDevice() ?? profile.inputDeviceId);
  const [inputKind, setInputKind] = useState<InputKind>(
    profile.inputKind === "none" ? "builtin" : profile.inputKind,
  );
  const [floorDb, setFloorDb] = useState<number | null>(profile.noiseFloorDb);
  const [bleed, setBleed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voicedChecks, setVoicedChecks] = useState(0);
  const [lastVoicedDb, setLastVoicedDb] = useState<number | null>(null);
  const [takes, setTakes] = useState(0);
  const [progress, setProgress] = useState(0);
  const [denials, setDenials] = useState(0);
  const session = useRef<MicSession | null>(null);
  const resumed = useRef(false);
  const run = useSaveRun();
  const profileUpdate = useUpdateProfile();
  const bleedRuns = useCalibrations("bleed");
  // In Quiet mode (chosen anywhere, "just for today" included) the step reopens on the permission: allowing the mic
  // is how Quiet mode ends here, never a speaker check that opens the mic unasked.
  const quiet = useQuietChosen(profile);

  // Onboarding: a reload or Back resumes at the first sub-step not yet measured, with what was measured shown.
  const bleedSaved = bleedRuns.data?.items[0]?.result.heard;
  // Deliberately once, when the saved runs arrive
  useEffect(() => {
    if (resumed.current || only || context !== "onboarding" || bleedRuns.isPending) return;
    resumed.current = true;
    const at = micResumeAt({
      noiseFloorDb: quiet ? null : profile.noiseFloorDb,
      bleedMeasured: typeof bleedSaved === "boolean",
    });
    if (at === "ask") return;
    if (typeof bleedSaved === "boolean") setBleed(bleedSaved);
    setPhase((p) => (p === "ask" ? at : p));
  }, [bleedRuns.isPending]);

  const sub = subOf(phase);
  useEffect(() => {
    onSub?.(only ? null : MIC_SUBS[sub]);
    return () => onSub?.(null);
  }, [sub, only, onSub]);

  const stopLive = () => {
    session.current?.close();
    session.current = null;
  };
  // Leaving the screen closes the mic, whatever phase it was in.
  useEffect(
    () => () => {
      stopLive();
      closeInput();
    },
    [],
  );

  const startLive = async (id: string | null) => {
    stopLive();
    setError(null);
    setHeard(false);
    setSilentLong(false);
    setPhase("opening");
    try {
      const { calibration } = await voiceAudio();
      // AirPods mode: with Bluetooth output Oak listens on the built-in mic (contracts §8.6).
      const report = await calibration.devices().catch(() => null);
      let chosen = id;
      if (report?.bluetoothOutput && report.inputDeviceId && id === null) chosen = report.inputDeviceId;
      setInputDevice(chosen);
      const s = await openInput();
      session.current = s;
      setDevice(s.deviceId ?? chosen);
      const after = await calibration.devices().catch(() => null);
      if (after) setInputKind(after.inputKind === "none" ? "builtin" : after.inputKind);
      setInputs(await listInputs());
      setPhase("hear");
    } catch (e) {
      // Some refusals arrive as "no device": the browser's own permission state tells them apart.
      const refused =
        (e instanceof MicError && e.reason === "denied") || (await micPermission()) === "denied";
      setDenials((n) => n + 1);
      if (refused) setPhase("denied");
      else if (e instanceof MicError && e.reason === "no-device") setPhase("no-device");
      else {
        setPhase("ask");
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  // The live meter and note while the "hear" phase has a stream; a hint after 8 s of silence.
  useEffect(() => {
    if (phase !== "hear") return;
    let raf = 0;
    let loudSince: number | null = null;
    const opened = performance.now();
    let heardAny = false;
    const tick = () => {
      const s = session.current;
      if (s) {
        const db = s.levelDb();
        setLevel(dbToLevel(db));
        const frames: PitchFrame[] = s.frames();
        setNote(liveMidi(frames));
        const now = performance.now();
        if (db > SIGNAL_DB) {
          loudSince ??= now;
          if (now - loudSince > 300) {
            heardAny = true;
            setHeard(true);
            setSilentLong(false);
          }
        } else loudSince = null;
        if (!heardAny && now - opened > SILENT_HINT_MS) setSilentLong(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const measure = async (seconds: number, body: () => Promise<void>) => {
    setError(null);
    setProgress(0);
    const t0 = performance.now();
    const iv = setInterval(() => setProgress(Math.min(1, (performance.now() - t0) / (seconds * 1000))), 100);
    try {
      await body();
    } finally {
      clearInterval(iv);
      setProgress(1);
      setTakes((n) => n + 1);
    }
  };

  /**
   * A measurement failed: the browser refused the mic, or the mic went away (unplugged mid-step), says so with its
   * own screen (Try again, Set up later); anything else stays on the sub-step with the error's words. Never silent.
   */
  const failed = (e: unknown, back: Phase) => {
    const p = micProblemOf(e);
    if ("problem" in p) {
      setDenials((n) => n + 1);
      setPhase(p.problem);
    } else {
      setPhase(back);
      setError(p.message);
    }
  };

  const saveFloor = async (db: number, voiced: boolean) =>
    run.save({
      kind: "noise",
      result: { floorDb: db, ok: noiseVerdict(db).ok, deviceId: device, ...(voiced ? { voiced: true } : {}) },
      patch: { noiseFloorDb: Math.round(db * 10) / 10, inputKind, inputDeviceId: device, quiet: false },
    });

  const noise = async () => {
    stopLive();
    setPhase("noise-measuring");
    await measure(3.2, async () => {
      try {
        const { calibration } = await voiceAudio();
        const check = await calibration.noiseCheck();
        // Someone humming or talking through the check would set the floor at their own voice and later
        // takes would hear "no voice": say so and measure again rather than storing it.
        if (check.voiced) {
          setVoicedChecks((n) => n + 1);
          setLastVoicedDb(check.floorDb);
          setPhase("noise-done");
          return;
        }
        setVoicedChecks(0);
        setLastVoicedDb(null);
        const db = check.floorDb;
        const saved = await saveFloor(db, false);
        if (saved) setFloorDb(db);
        setPhase("noise-done");
      } catch (e) {
        failed(e, "noise");
      }
    });
  };

  /** Two checks heard a voice: keep the room as measured (flagged), and go on. */
  const keepRoomAsIs = async () => {
    if (lastVoicedDb === null) return;
    const saved = await saveFloor(lastVoicedDb, true);
    if (!saved) return;
    setFloorDb(lastVoicedDb);
    setVoicedChecks(0);
    setLastVoicedDb(null);
    afterNoise();
  };

  const bleedTest = async () => {
    setPhase("bleed-measuring");
    await measure(2.8, async () => {
      try {
        const { oak, calibration } = await voiceAudio();
        await oak.unlock();
        const check = await calibration.bleedCheck();
        const got = check.heard;
        const saved = await run.save({
          kind: "bleed",
          result: bleedResult(check, profile.outputKind),
          patch: {},
        });
        if (saved) setBleed(got);
        setPhase(saved ? "bleed-done" : bleed === null ? "bleed" : "bleed-done");
      } catch (e) {
        failed(e, bleed === null ? "bleed" : "bleed-done");
      }
    });
  };

  const goQuiet = () => {
    stopLive();
    closeInput();
    profileUpdate.set({
      quiet: true,
      ...(phase === "no-device" || phase === "denied" || phase === "ask"
        ? { inputKind: "none" as const }
        : {}),
    });
    onQuiet?.();
  };
  /** "Set up later": Quiet mode where the host offers it (onboarding, Settings' wizard), else the step's skip. */
  const later = onQuiet ? goQuiet : (onSkip ?? null);

  const afterHear = () => {
    stopLive();
    if (only === "mic") onDone();
    else setPhase("noise");
  };
  const afterNoise = () => {
    if (only === "noise") onDone();
    else setPhase(bleed === null ? "bleed" : "bleed-done");
  };

  const nv = floorDb === null ? null : noiseVerdict(floorDb);
  const bv = bleed === null ? null : bleedVerdict(bleed);
  const voiceInQuiet = phase === "noise-done" && lastVoicedDb !== null;
  const anyway = voiceInQuiet && offerRoomAnyway(voicedChecks);

  // Back inside the step goes to the previous sub-step; from the first, to the previous onboarding step.
  const backNow =
    !only && sub > 1
      ? {
          label: SUB_NAMES[(sub - 1) as Sub],
          onBack: () => {
            setError(null);
            setPhase(sub === 3 ? (floorDb === null ? "noise" : "noise-done") : "ask");
          },
        }
      : back;

  const title = only === "noise" ? "Quiet check" : only === "bleed" ? "Speaker check" : "Microphone";
  const instruction: Record<Sub, string> = {
    1: "Allow the microphone, then hum or say a few words.",
    2: "Stay quiet for three seconds while Oak listens to the room.",
    3: "Stay quiet while Oak plays three short tones and listens for them.",
  };

  const actions = (() => {
    const common = {
      context,
      back: backNow,
      onSkip: later,
      skipTestId: onQuiet ? "mic-quiet" : "part-skip",
    } as const;
    switch (phase) {
      case "ask":
        return (
          <PartActions
            {...common}
            resultKey={null}
            onRetry={null}
            onContinue={null}
            action={
              <Button
                variant="primary"
                onClick={() => void startLive(device)}
                icon={<Mic aria-hidden className="size-4" />}
                data-testid="mic-allow"
                autoFocus
              >
                Allow the microphone
              </Button>
            }
          />
        );
      case "opening":
        return (
          <PartActions
            {...common}
            running={{ label: "Asking…" }}
            resultKey={null}
            onRetry={null}
            onContinue={null}
          />
        );
      case "denied":
      case "no-device":
        // The way on is the primary: Quiet mode (said in the callout). Try again asks the browser once more.
        return (
          <PartActions
            {...common}
            onSkip={null}
            resultKey={`${phase}-${denials}`}
            onRetry={() => void startLive(phase === "no-device" ? null : device)}
            onContinue={later}
            continueLabel="Set up later"
            testId="mic-problem-actions"
          />
        );
      case "hear":
        return (
          <PartActions
            {...common}
            // Oak hears the learner: Continue is the way on ("Set up later" here would switch the working mic off).
            onSkip={heard ? null : later}
            resultKey={heard ? "heard" : null}
            onRetry={heard ? () => void startLive(device) : null}
            onContinue={afterHear}
            continueDisabled={!heard}
            continueNote="Hum or say a few words so Oak can hear you."
          />
        );
      case "noise":
      case "noise-measuring":
      case "noise-done": {
        const done = phase === "noise-done";
        return (
          <PartActions
            {...common}
            onSkip={done && !voiceInQuiet && nv?.ok ? null : later}
            running={phase === "noise-measuring" ? { label: "Measuring…" } : null}
            resultKey={done ? `noise-${takes}` : null}
            onRetry={done ? () => void noise() : null}
            onContinue={done ? (anyway ? () => void keepRoomAsIs() : afterNoise) : null}
            continueDisabled={done && voiceInQuiet && !anyway && floorDb === null}
            continueLabel={anyway ? "Use this room anyway" : "Continue"}
            continueNote="Stay silent for three seconds and try again, or set it up later."
            line={done && !voiceInQuiet && floorDb !== null ? MEASURE_LINE : null}
            action={
              phase === "noise" ? (
                <Button variant="primary" onClick={() => void noise()} data-testid="noise-start" autoFocus>
                  Start the quiet check
                </Button>
              ) : null
            }
          />
        );
      }
      default: {
        const done = phase === "bleed-done";
        return (
          <PartActions
            {...common}
            onSkip={done ? null : later}
            running={phase === "bleed-measuring" ? { label: "Measuring…" } : null}
            resultKey={done ? `bleed-${takes}` : null}
            onRetry={done ? () => void bleedTest() : null}
            onContinue={done ? onDone : null}
            line={done ? MEASURE_LINE : null}
            action={
              phase === "bleed" ? (
                <Button
                  variant="primary"
                  onClick={() => void bleedTest()}
                  icon={<Volume2 aria-hidden className="size-4" />}
                  data-testid="bleed-start"
                  autoFocus
                >
                  Start the speaker check
                </Button>
              ) : null
            }
          />
        );
      }
    }
  })();

  return (
    <PartFrame
      testId="part-mic"
      context={context}
      title={title}
      instruction={instruction[sub]}
      lead={
        // In a lesson a single measurement (noise, bleed) sits under the mic part that already said this;
        // repeating it made U00.L02's step 2 three copies of the same two paragraphs.
        (context === "lesson" && (only === "noise" || only === "bleed")) || sub > 1 ? null : (
          <>
            <p>
              Oak listens only when you sing a note back or hum an idea. A red dot in the top bar shows
              whenever the mic is open.
            </p>
            <p className="mt-2 font-medium text-text" data-testid="privacy-line">
              {PRIVACY_LINE}
            </p>
          </>
        )
      }
    >
      {sub === 1 && (
        <div className="flex flex-col gap-3">
          {(phase === "ask" || phase === "opening") && later && (
            <Callout tone="info" title="No mic, or not today?">
              Quiet mode is a full way through Oak: singing steps become listening steps, and nothing is
              locked. Choose Set up later; you can switch the mic on any time in Settings › Voice.
            </Callout>
          )}
          {phase === "opening" && (
            <p className="text-text-2" aria-live="polite">
              Asking the browser for the microphone…
            </p>
          )}
          {phase === "hear" && (
            <div className="flex flex-col gap-4" data-testid="mic-live">
              {inputs.length > 1 && (
                <div className="flex flex-col gap-1.5 text-sm">
                  <label htmlFor="mic-device" className="font-medium">
                    Microphone
                  </label>
                  <Select<string>
                    id="mic-device"
                    value={device ?? inputs[0]?.deviceId ?? ""}
                    options={inputs.map((d) => ({ value: d.deviceId, label: d.label }))}
                    onChange={(id) => void startLive(id)}
                  />
                </div>
              )}
              <MicLevelMeter level={level} live label="Microphone level" />
              <p className="text-sm text-text-3">
                Oak hears:{" "}
                <span className="tabular-nums" data-testid="mic-note">
                  {noteReadout(note)}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {sub === 2 && (
        <div
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
          data-testid="mic-noise"
        >
          <h2 className="text-h3">A quiet moment</h2>
          <p className="text-sm text-text-2">
            Oak measures the room so it can tell your voice from the hum around you.
          </p>
          {phase === "noise-measuring" && <Progress value={progress} label="Measuring the room" />}
        </div>
      )}

      {sub === 3 && (
        <div
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
          data-testid="mic-bleed"
        >
          <h2 className="text-h3">Does the mic hear Oak's sound?</h2>
          <p className="text-sm text-text-2">
            Three short high tones at practice volume. With headphones the mic should hear nothing.
          </p>
          {phase === "bleed-measuring" && <Progress value={progress} label="Playing the test tones" />}
        </div>
      )}

      <StatusSlot>
        {phase === "denied" && (
          <div data-testid="mic-denied">
            <Callout tone="attention" title="The browser said no to the microphone">
              That's fine. To allow it, click the icon left of the address bar, set Microphone to Allow, then
              try again. Or set it up later: Oak switches to Quiet mode, and nothing in the course needs the
              mic.
            </Callout>
          </div>
        )}
        {phase === "no-device" && (
          <div data-testid="mic-none">
            <Callout tone="attention" title="No microphone found">
              Plug one in and try again, or set it up later: Oak switches to Quiet mode until you do.
            </Callout>
          </div>
        )}
        {phase === "hear" &&
          (heard ? (
            <Callout tone="success" title="Oak can hear you." />
          ) : silentLong ? (
            <Callout tone="attention" title="Oak hears nothing yet">
              <span data-testid="mic-silent">
                Hum a little louder, check the microphone chosen above, or set it up later.
              </span>
            </Callout>
          ) : (
            <p className="text-sm text-text-3">Waiting for a sound. Hum, or say a few words.</p>
          ))}
        {phase === "noise-done" && voiceInQuiet && (
          <Callout tone="attention" title="Oak heard a voice during the quiet moment">
            <span data-testid="noise-voice">
              {anyway
                ? "Someone may be talking nearby. Try once more in silence, or use this room as it is: Oak will listen a little less closely."
                : "Humming or talking would be measured as the room, and Oak would then miss your singing. Stay silent for three seconds and try again."}
            </span>
          </Callout>
        )}
        {phase === "noise-done" && !voiceInQuiet && nv && (
          <Callout tone={nv.ok ? "success" : "attention"} title={nv.title}>
            <span data-testid="noise-result">{nv.body}</span>
            <span className="mt-1 block text-text-3">{nv.detail}</span>
          </Callout>
        )}
        {phase === "bleed-done" && bv && (
          <Callout tone={bv.ok ? "success" : "attention"} title={bv.title}>
            <span data-testid="bleed-result">{bv.body}</span>
          </Callout>
        )}
        {phase === "bleed-done" && floorDb !== null && !only && (
          <div className="rounded-card border border-border px-3">
            <ResultRow label="Room noise" value={`${Math.round(floorDb)} dBFS`} />
            <ResultRow label="Oak's sound in the mic" value={bleed ? "Heard" : "None"} />
          </div>
        )}
        {error && (
          <Callout tone="issue" title="That didn't work">
            {error}
          </Callout>
        )}
      </StatusSlot>

      {actions}
    </PartFrame>
  );
}
