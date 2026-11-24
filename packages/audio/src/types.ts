// Public types of @oak/audio: microphone, calibration, tap input and the transcription player.
// Browser only. Audio never leaves the machine.
import type { LearnerProfile } from "@oak/content-kit";
import type { PitchFrame } from "@oak/pitch";

export type OutputKind = LearnerProfile["outputKind"];
export type InputKind = LearnerProfile["inputKind"];

export interface DeviceReport {
  outputKind: OutputKind;
  outputLabel: string | null;
  inputKind: InputKind;
  /** The input Oak will open. With Bluetooth earbuds as output this is the built-in microphone, never the earbuds' own. */
  inputDeviceId: string | null;
  inputLabel: string | null;
  /** Bluetooth earbuds are the output: tap floor rises to 70 ms, latencies are calibrated in this configuration. */
  bluetoothOutput: boolean;
  /** `ctx.outputLatency + ctx.baseLatency`, ms. */
  outputLatencyMs: number;
  permission: "granted" | "denied" | "prompt";
}

export type MicState = "closed" | "opening" | "live" | "denied" | "unavailable";
export interface MicSession {
  /** Frames from the worklet, about 94 per second at 48 kHz. Returns an unsubscribe function. */
  onFrame(cb: (frame: PitchFrame) => void): () => void;
  /** Every frame since the session opened. */
  frames(): PitchFrame[];
  /** Current input level, dBFS. */
  levelDb(): number;
  readonly deviceId: string | null;
  readonly sampleRate: number;
  /** Stops the tracks and disconnects the source. The worklet node stays for the next session. */
  close(): void;
  /**
   * Wave 4 (contracts §8.6): when the graph listens to Oak's output too (`MicGraphOptions.playback`), every frame
   * carries `playing` and this is the live bleed check over the whole session: voiced frames on what the output
   * played, in spans where it played. `null` when the graph does not listen to the output.
   */
  bleed?(): import("@oak/pitch").BleedReport | null;
  /** Called once, the moment the session's bleed check trips. Returns the remover. */
  onBleed?(cb: (report: import("@oak/pitch").BleedReport) => void): () => void;
  /**
   * Marks the spans in which the learner is asked to sing (AudioContext seconds): the live bleed check skips
   * them, so singing along with the playback is never called bleed. Optional: a host that never plays while
   * the learner sings need not call it.
   */
  singing?(window: { on: number; off: number }): void;
  /**
   * Connects the mic's source to `node` too (an AnalyserNode for the headphone-leak check), never to the output.
   * Returns the remover. Optional: a fake session need not have it.
   */
  tap?(node: AudioNode): () => void;
}
/**
 * The microphone path. The AudioWorkletNode is created ONCE (at audio unlock or calibration: its
 * constructor costs 6 to 12 ms on the render thread); a sing step only opens and closes the MediaStream
 * and its source node. The mic is never connected to the destination or to any orbit.
 */
export interface MicGraph {
  /** Loads the worklet module and creates the node. Call after the context is running. */
  prepare(): Promise<void>;
  /** Constraints: echoCancellation, noiseSuppression and autoGainControl off, mono. Rejects with a `MicError`. */
  open(opts?: { deviceId?: string | null }): Promise<MicSession>;
  readonly state: MicState;
  /** Drives the always-visible "Mic live" indicator. */
  subscribe(cb: (state: MicState) => void): () => void;
  /** `Cmd/Ctrl+Shift+M`: closes any open session. */
  closeAll(): void;
  dispose(): void;
}
export class MicError extends Error {
  readonly reason: "denied" | "no-device" | "worklet" | "context";
  constructor(reason: MicError["reason"], message: string) {
    super(message);
    this.name = "MicError";
    this.reason = reason;
  }
}

// --- calibration (contracts §8.6) ---------------------------------------------------------------

export interface CalibrationDeps {
  ctx: AudioContext;
  mic: MicGraph;
  /** Plays a click or a tone at a context time (wired to `OakStrudel.playEvents` by the app). */
  playClick(at: number): void;
  playTone(midi: number, at: number, durSec: number): void;
}
export interface TapLatencyResult {
  /** Median of (tap − click). */
  latencyMs: number;
  /** MAD of the calibration taps. */
  jitterMs: number;
  taps: number;
  /** Above 120 ms the card says timing grades will be more forgiving. */
  high: boolean;
}
export interface RangeResult {
  lowMidi: number;
  highMidi: number;
  comfortLowMidi: number;
  comfortHighMidi: number;
}
/** The steps of the set-up wizard (U00.L02 and `/settings/voice/setup`). Each returns what the profile stores. */
export interface QuietCheck {
  /** Median frame level, dBFS. */
  floorDb: number;
  /** Seconds of voiced frames heard during the check. */
  voicedSec: number;
  /** A voice spoilt the check: hum or talk heard for ≥ 0.3 s (or ≥ 15 % of the frames). */
  voiced: boolean;
}

/** The headphone-leak check: does Oak's own playback reach the mic? */
export interface BleedCheck {
  /** Playback reaches the mic (either way of hearing it below). */
  heard: boolean;
  /** The pitch tracker heard the test tones as notes (what grading would see). */
  byPitch: boolean;
  /** The tones found in the raw mic samples (`leakCheck`), or null when the session gives no samples. */
  tones: import("./bleed.ts").LeakCheck | null;
}

export interface Calibration {
  /** Left and right test tones; the learner confirms what they heard. */
  outputCheck(): Promise<void>;
  devices(): Promise<DeviceReport>;
  /** Median input level over `seconds` of silence, dBFS. */
  noiseFloor(seconds?: number): Promise<number>;
  /** The quiet check: the noise floor and whether a voice was heard during it (then measure again). */
  noiseCheck(seconds?: number): Promise<QuietCheck>;
  /** Plays 880, 1175 and 1568 Hz with the mic open: true when the mic hears the speakers. */
  bleedTest(): Promise<boolean>;
  /** The same check with what it measured (bleed.ts): what the set-up stores. */
  bleedCheck(): Promise<BleedCheck>;
  /**
   * 16 clicks; the learner taps along. `onClick` reports progress. `signal` (the learner's Stop) ends the take
   * early: the result is measured from the taps so far.
   */
  tapLatency(
    taps: AsyncIterable<number>,
    onClick?: (i: number) => void,
    signal?: AbortSignal,
  ): Promise<TapLatencyResult>;
  /** 8 clicks; the learner sings "da" on each. `signal` ends the take early (measured from what was heard). */
  singLatency(onClick?: (i: number) => void, signal?: AbortSignal): Promise<number>;
  /** Lowest and highest comfortable notes. `signal` ends the sweep early (estimated from what was heard). */
  rangeSweep(onFrame?: (frame: PitchFrame) => void, signal?: AbortSignal): Promise<RangeResult>;
  /** Three pitch-match trials inside the measured range; cents error of each. */
  pitchMatch(targets: number[]): Promise<number[]>;
}

// --- taps (contracts §8.4) ----------------------------------------------------------------------

export interface TapEvent {
  /** AudioContext time of the tap, already minus the calibrated tap latency. */
  time: number;
  /** Which voice: 0 for Space or F, 1 for J. */
  voice: 0 | 1;
}
/**
 * Maps `KeyboardEvent.timeStamp` to AudioContext time through `getOutputTimestamp()` pairs. `Space` (and
 * `F` / `J` for two voices) are captured only while armed; otherwise they keep their usual meaning.
 */
export interface TapInput {
  /**
   * `twoVoices`: two lanes at once, one key each (F and J, voices 0 and 1). Wave 7: `keys` names the two lanes' keys
   * (`TapLane.key`: "f", "j", or a `KeyboardEvent.code`); two different keys other than Space, else F and J.
   */
  arm(opts?: { twoVoices?: boolean; keys?: readonly [string, string] }): void;
  disarm(): void;
  readonly armed: boolean;
  onTap(cb: (tap: TapEvent) => void): () => void;
  /** Taps since the last `arm()`. */
  taps(): TapEvent[];
  setLatency(ms: number): void;
  dispose(): void;
}

// --- transcription player (own audio) -----------------------------------------------------------

export interface TranscriptionPlayerState {
  loaded: boolean;
  playing: boolean;
  /** Position in the file, seconds. */
  time: number;
  durationS: number;
  /** 0.25 to 1. */
  rate: number;
  /** −12 to 12. */
  semitones: number;
  /** −50 to 50. */
  fineTuneCents: number;
  loop: { startS: number; endS: number } | null;
}
/**
 * Plays the learner's own audio through signalsmith-stretch into `MasterBus.input`. Display (waveform,
 * regions, spectrogram) is wavesurfer's job in the app; this is the audio path only.
 */
export interface TranscriptionPlayer {
  load(audio: ArrayBuffer): Promise<{ durationS: number; sampleRate: number; channels: number }>;
  /** `at`: AudioContext time to start at (for A/B in sync with Strudel's downbeat). */
  play(opts?: { at?: number; fromS?: number }): Promise<void>;
  pause(): void;
  seek(timeS: number): void;
  setRate(rate: number): void;
  setSemitones(semitones: number): void;
  setFineTuneCents(cents: number): void;
  setLoop(loop: { startS: number; endS: number } | null): void;
  /** Balance against the Strudel level, 0 to 1. */
  setGain(gain: number): void;
  readonly state: TranscriptionPlayerState;
  subscribe(cb: (state: TranscriptionPlayerState) => void): () => void;
  /** Min/max peaks for the waveform, computed once and stored with `PUT /api/audio/:id/peaks`. */
  peaks(pointsPerSecond?: number): Float32Array;
  dispose(): void;
}
