// @oak/audio: the microphone graph and its pitch worklet, the calibration wizard's measurements, tap
// input, the transcription player and Transcribe's pattern-source hook. Browser only. The AudioContext is
// the adapter's (`OakStrudel.ctx`): this package never creates one. The waveform view is a separate entry,
// `@oak/audio/waveview`, so wavesurfer loads only where it is shown.
//
// The worklet is loaded with `?worker&url` (spike S5: an ES module in dev, a self-contained IIFE asset in
// build), never `new URL(..., import.meta.url)`, which ships the raw TypeScript as a data URL in build.

import { createMicGraphWith, type MicGraphOptions } from "./mic.ts";
import type { MicGraph } from "./types.ts";
import pitchWorkletUrl from "./worklets/pitch.worklet.ts?worker&url";

export {
  AB_LEAD_SEC,
  AB_PASS_AHEAD_SEC,
  AB_PRE_ROLL_SEC,
  type AbSwitchDeps,
  createAbSwitchWith,
  mineRateFor,
  sideGains,
} from "./ab-switch.ts";
// The headphone-leak check: does Oak's own playback reach the mic (the set-up's speaker check)?
export {
  goertzelAmp2,
  gradeGateDb,
  LEAK_CHECK,
  type LeakCheck,
  type LeakToneReading,
  leakCheck,
  leakProbe,
  type MicBlock,
  type ProbeTone,
} from "./bleed.ts";
export {
  CALIBRATION,
  type CalibrationExtras,
  createCalibration,
  playPannedTone,
  QUIET_VOICE_SEC,
  quietCheckOf,
  waitUntil,
} from "./calibration.ts";
export {
  classifyDeviceLabel,
  cleanDeviceLabel,
  type DeviceClass,
  decideDevices,
  detectDevices,
  inputKindOf,
  outputKindOf,
} from "./devices.ts";
// Wave 6 (CF-A "Master"): the loudness read-out of a play-through and the reference listen at matched loudness.
export {
  type BufferLike,
  blockReductionDb,
  createMasterMeter,
  createMasterMeterWith,
  createReferenceAb,
  dbToGain,
  gainFactor,
  LIMITER_LOOKAHEAD_SEC,
  LIMITER_THRESHOLD_DB,
  LIMITER_WORKING_DB,
  LIMITER_WORKING_SHARE,
  type LimiterState,
  LOUDEST_WINDOW_SEC,
  type LoudnessMatch,
  levelAdvice,
  levelOfBuffer,
  levelText,
  limiterState,
  limiterWords,
  loudestSpan,
  loudnessWords,
  MASTER_METER_PROCESSOR,
  MASTER_METER_SOURCE,
  MATCH_MAX_CUT_DB,
  MATCH_SAME_DB,
  type MasterMeter,
  type MasterMeterDeps,
  type MasterReading,
  METER_BLOCK_FRAMES,
  METER_SILENCE_DB,
  type MeterBlock,
  type MeterLive,
  type MeterWorkletNodeLike,
  matchLoudness,
  QUIET_PEAK_DB,
  type ReferenceAb,
  type ReferenceAbDeps,
  type ReferenceAbState,
  type ReferenceSide,
  readingLines,
  summarizeMeter,
  TARGET_PEAK_DB,
} from "./master-meter.ts";
export {
  createMasterRecorderWith,
  type ExactRecording,
  encodeWavSlice,
  type MasterRecorderDeps,
  type MediaRecorderLike,
  RECORDER_PRE_ROLL_SEC,
  RECORDER_START_OFFSET_SEC,
  RECORDER_TAIL_SEC,
} from "./master-recorder.ts";
export {
  bindMicShortcut,
  createMicGraphWith,
  type MicGraphOptions,
  micConstraints,
  PITCH_PROCESSOR,
} from "./mic.ts";
// Wave 7 (A2.L01, A2.L05, AC1, AC2): meters for mixing — a level per part, its register from the spectrum, shared
// registers and a compressor's gain reduction, read from the offline renders of each part.
export {
  averagedSpectrum,
  type CompressorSettings,
  compressionCurveDb,
  type GainReductionReading,
  gainReductionLine,
  HEARD_WITHIN_DB,
  LOWEST_WITHIN_DB,
  levelLine,
  MIX_BLOCK_FRAMES,
  MIX_SILENCE_DB,
  type MixReading,
  makeupGainDb,
  measureGainReduction,
  measureMix,
  NEUTRAL_COMPRESSOR,
  type PartLevel,
  type PartPcm,
  type PartReading,
  parseCompressor,
  partLevel,
  partRegister,
  type RegisterOverlap,
  type RegisterReading,
  readMix,
  registerLine,
  registerOfSpectrum,
  registerOverlaps,
  registerRole,
  type SoloRender,
  SPECTRUM_FFT,
  SPECTRUM_MIN_HZ,
  SUPERDOUGH_COMPRESSOR_DEFAULTS,
  staticGainReductionDb,
} from "./mix-meter.ts";
export {
  audioSource,
  createPatternSource,
  loopToBars,
  type PatternPlayerLike,
  type PatternSourceOptions,
  type TranscribeSource,
  type TranscribeSourceState,
} from "./pattern-source.ts";
// Wave 5: the long-take recorder (a C3 demo of 90 s and more, sample-exact, memory bounded).
export {
  createPcmRecorder,
  createPcmRecorderWith,
  PCM_RECORDER_PROCESSOR,
  PCM_RECORDER_SOURCE,
  PCM_TAIL_SEC,
  type PcmRecorder,
  type PcmRecorderDeps,
  type PcmRecorderStats,
  type PcmRecording,
  type PcmWorkletNodeLike,
  wavHeader,
} from "./pcm-recorder.ts";
// Wave 5 seam (docs/design/wave5.md §3.4): the scope and spectrum panel's analysis.
export { harmonicLevels, type SpectrumBand, spectrumBands, steadyWave, triggerIndex } from "./scope.ts";
// Wave 5: the analyser taps behind the panel (master bus and per track, side branches on the shared context).
export {
  type AnalyserLike,
  createScopeTaps,
  createScopeTapsWith,
  type ScopeTapSource,
  type ScopeTaps,
  type ScopeTapsDeps,
  type ScopeTapsOptions,
  type TapSourceNode,
} from "./scope-taps.ts";
// Wave 4 seam (docs/design/wave4.md §3.4): the Transcribe engine, the A/B switch and the master recorder.
export {
  AB_DRIFT_GATE_BARS,
  AB_DRIFT_GATE_MS,
  AB_DRIFT_GATE_RATE,
  type AbSide,
  type AbState,
  type AbSwitch,
  AudioNotBuiltError,
  abDriftMs,
  clampCents,
  clampSemitones,
  clampStretchRate,
  createAbSwitch,
  createMasterRecorder,
  createStretchPlayer,
  fakeMasterRecorder,
  fakeStretchPlayer,
  type LoopSpan,
  type MasterRecorder,
  type MasterRecording,
  type PatternSideLike,
  type SourceGrid,
  STRETCH_CENTS_RANGE,
  STRETCH_RATE_RANGE,
  STRETCH_SEMITONE_RANGE,
  type StretchClock,
  type StretchPlayer,
  type StretchPlayerDeps,
  type StretchPlayerState,
  sourceBarTimes,
  TRANSCRIBE_RATE_RANGE,
} from "./stretch.ts";
export {
  createStretchEngine,
  ctxTimeAt,
  positionAt,
  STRETCH_LEAD_SEC,
  STRETCH_MIN_LOOP_SEC,
  type StretchEngineDeps,
} from "./stretch-player.ts";
export {
  createTapInput,
  eventTimeToContextTime,
  laneKeyCode,
  type TapInputExtras,
  tapsToOnsets,
} from "./tap.ts";
export {
  computePeaks,
  createTranscriptionPlayer,
  FINE_TUNE_RANGE,
  POSITION_INTERVAL,
  RATE_RANGE,
  SEMITONE_RANGE,
  type TranscriptionPlayerDeps,
} from "./transcription.ts";
export * from "./types.ts";

/** The URL Vite gives the pitch worklet (dev: `/…/pitch.worklet.ts?worker_file&type=module`; build: an asset). */
export const PITCH_WORKLET_URL: string = pitchWorkletUrl;

/**
 * The microphone path on the shared context. `workletUrl` defaults to the `?worker&url` asset; pass a Blob
 * URL of the prebuilt IIFE (`scripts/build-worklet.bun.ts`) to use the spare loader.
 */
export function createMicGraph(
  ctx: AudioContext,
  opts: { workletUrl?: string; lowVoice?: boolean } & Omit<Partial<MicGraphOptions>, "workletUrl"> = {},
): MicGraph & { readonly lowVoice: boolean; readonly outputs: 0 | 1 } {
  return createMicGraphWith(ctx, { ...opts, workletUrl: opts.workletUrl ?? pitchWorkletUrl });
}
