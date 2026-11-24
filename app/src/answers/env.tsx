// What some answer widgets need beyond `AnswerWidgetProps` (which stays the one contract for every kind): the
// learner's calibration for taps and singing, the music a click question points into, the notes to sing, the
// take's timing. A host wraps the widget in `<AnswerEnvProvider value={…}>`; every field is optional and a
// widget that lacks what it needs says so in words instead of showing a dead control.
import type {
  Choice,
  KeySpec,
  LearnerProfile,
  MeterSpec,
  SingMode,
  SingTolerance,
  SwingSpec,
  VoicingShape,
} from "@oak/content-kit";
import type { PitchFrame, SungResult } from "@oak/pitch";
import { createContext, type ReactNode, useContext } from "react";
import type { WorkbenchModel } from "../workbench/model.ts";
import type { ChordStyle } from "./jazz.ts";
import type { Hit, LaneSetup } from "./rhythm7.ts";
import type { SingNote } from "./sing.ts";

/** Sound for the widgets: the app's one adapter by default (`app/src/lib/oak.ts`). */
export interface AnswerAudio {
  /** The shared AudioContext (created on the first gesture). */
  context(): Promise<AudioContext>;
  /** One note or a chord now: piano keys, degree pads. */
  playNote(midi: number | readonly number[], o?: { sound?: string; dur?: number }): void;
  /** A metronome click at an AudioContext time (`accent` on the downbeat). */
  click(at: number, accent?: boolean): void;
  /**
   * A singing reference (`@oak/strudel/reference`): home, or the chords that set it, the same sound every sung
   * trial hears. Optional: a host without it gets the piano through `playNote`.
   */
  reference?(kind: "tonic" | "cadence", tonicMidi: number, mode?: "major" | "minor"): void;
  /**
   * Wave 7: a short pattern of drum hits now (seconds from now), for the widgets that play what the learner set:
   * the swing and lay-back sliders, a grouping's accents, a Euclidean ring, a clave. Optional: a host without it
   * gets clicks through `click`.
   */
  hits?(hits: readonly Hit[]): void;
}

/** A tap take (contracts §8.4, ux §4.4). Targets are drawn only after an attempt (feedback not idle). */
export interface TapEnv {
  bars: number;
  bpm: number;
  /** Default 4. */
  beatsPerBar?: number;
  /**
   * Grid lines per beat on the pad: 2 = eighths, 4 = sixteenths (default 4; 3 in a compound meter). Wave 6: 3 in a
   * simple meter draws triplets, counted "1 trip let".
   */
  stepsPerBeat?: number;
  /**
   * Wave 6 (U13.L04, contracts §6.9): the meter of the take. In a compound meter (6/8, 9/8, 12/8) the beat is the
   * dotted quarter: `bpm` counts that beat, the count-in clicks it, and the pad draws each beat in three, counted
   * "1 la li". Wins over `beatsPerBar`.
   */
  meter?: MeterSpec;
  /** What a target is called in the report: "beat" (default), or "hit" for a rhythm with notes off the beat. */
  targetWord?: "beat" | "hit";
  /** Count-in bars before bar 1 (default 1). Ignored when `start` is given. */
  countInBars?: 0 | 1 | 2;
  /** F/J two-voice taps (kick/snare) instead of Space. */
  twoVoices?: boolean;
  /** Target onsets in bars from the take's start (shown after the attempt; `tapReport` grades against them). */
  targets?: readonly number[];
  /**
   * The host plays the stimulus and the count-in and resolves with the AudioContext time of bar 1. Without it
   * the widget plays a count-in click itself.
   */
  start?: () => Promise<number>;
  /** Showing a stored take (`value` holds its taps): the clock time of its bar 1. */
  startAt?: number;
  /** Every finished take, with the clock time of bar 1, so the host can grade it (`tapReport`). */
  onTake?: (take: TapTake) => void;
  /**
   * Wave 7 (feature `tap.lanes`, R2.L04's 3 against 2): two lanes at once, one per hand, F taps the first and J
   * the second (the tap input listens to those two keys; a lane's own `key` is shown, not bound). Each lane is
   * drawn on its own row with its own targets after an attempt. The value stays one list of tap times; which
   * lane each tap is on comes with the take (`TapTake.voices`: 0 = F, 1 = J), and the host splits and grades them
   * with `splitLanes` and `lanesReport` (rhythm7.ts), whose marks are `lane:index`. Only the first two lanes are
   * drawn. Wins over `twoVoices` and `targets`.
   */
  lanes?: readonly LaneSetup[];
  /** Showing a stored two-lane take (`value` holds its taps): the lane of each tap, 0 for F and 1 for J. */
  voices?: readonly (0 | 1)[];
}

/** The take a host grades: tap times and the clock time of bar 1 (`tapReport(taps, targetSeconds(…))`). */
export interface TapTake {
  startAt: number;
  cps: number;
  taps: number[];
  voices: (0 | 1)[];
}

/** A finished sing take: the result of `gradeSung` (the same call the grader makes) and its start time. */
export interface SingTake {
  result: SungResult;
  startAt: number;
  frames: number;
  /** The take's pitch frames, for a host that checks the room (`reportTake` in app/src/voice/recheck.ts). */
  pitchFrames?: readonly PitchFrame[];
}

/** A sing take (contracts §8.1, ux §4.3). */
export interface SingEnv {
  /** Notes relative to the take's start; the widget fits them into the learner's comfort range. */
  notes: readonly SingNote[];
  mode: SingMode;
  /** Default: the learner's rung, per-note folding (`DEFAULT_SING_TOL`). */
  tol?: SingTolerance;
  /** ux §4.3: the trace while singing, only afterwards, or never (default "live"). */
  showTrace?: "live" | "after" | "never";
  /** Seconds between pressing Sing and the first note's window (default 1). */
  leadIn?: number;
  /** Plays the reference (tonic, target) before the take; resolves when it has finished. */
  playCue?: () => Promise<void>;
  /**
   * Wave 3: what the lane prints under each target (contracts §8.3, `VoiceState.labels`): numbers until U03.L08,
   * then number and syllable. Default numbers.
   */
  labels?: "numbers" | "syllables";
  /** Wave 3: the tolerance the server's ladder holds (`VoiceState.ladder.cents`); wins over the profile's. */
  tolCents?: LearnerProfile["singTolCents"];
  /** Wave 3: a count-in before the first target, clicked and shown as numerals (replaces `leadIn`). */
  countIn?: { beats: number; bpm: number };
  /**
   * Wave 3: the reference the learner can ask for before singing: home (the tonic, MIDI) and, with `chords`, a
   * few chords that set it (I IV V I). The take's notes are in this key.
   */
  reference?: { tonic: number; mode?: "major" | "minor"; chords?: boolean };
  /** "Quiet mode": listen and self-check instead (contracts §8.5). */
  onQuietEvidence?: (evidence: QuietEvidence) => void;
  /** Plays the target notes for the Quiet-mode self-check. */
  playTarget?: () => void;
  /** Every finished take (the widget's value is its per-note summary). */
  onTake?: (take: SingTake) => void;
}

/**
 * What a Quiet-mode self-check reports: no voice evidence, no penalty (contracts §8.5). `quiet` when Quiet mode is
 * on (`AnswerEnv.quiet`, from `voice.get`); `fallback` when the mic was blocked or missing, or the learner chose
 * "Can't sing now". Never mic evidence: the widget's value stays empty.
 */
export interface QuietEvidence {
  modality: "quiet" | "fallback";
  /** The learner's own report after hearing it in their head. */
  selfCheck: "heard-it" | "not-sure";
  at: number;
}

/**
 * What the chord widgets need beyond the spec (Wave 4): the step's key (numerals sound and print their symbol in
 * it; the builder spells in it), the slot grid, playback, and whether the chord builder names what was built.
 */
export interface HarmonyEnv {
  /** The step's key (else the lesson's). Without it the RN palette plays nothing and prints no symbols. */
  key?: KeySpec;
  /** RN palette and slot strips: one slot per bar (default) or per half bar. */
  slotsPerBar?: 1 | 2;
  /** Default 4. */
  beatsPerBar?: number;
  /** Progression playback tempo (default 90). */
  bpm?: number;
  /** Default "piano". */
  sound?: string;
  /**
   * The chord builder (staff with `palette.chords`, keyboard in `chord` mode) names the chord and its inversion:
   * `live` while building (a step that teaches naming), `after` once checked (default), `never`.
   */
  nameChords?: "live" | "after" | "never";
  /** Plays the numerals in the host's own sound (the Band); without it the widget plays a piano voicing. */
  playProgression?: (rns: readonly string[]) => void;
  /**
   * Staged dictation (ux §4.5): the bass degree under each slot, known from the bass stage. The RN palette lights
   * the numerals whose chord contains the target slot's bass and dims the rest (they stay pickable).
   */
  bassDegrees?: readonly string[];
  /**
   * Wave 6 (U12): the chord-name picker shows its seventh-chord row from the start (a step about sevenths).
   * Without it the row opens on request or when the typed chord is a seventh.
   */
  sevenths?: boolean;
  /** Wave 6 (U12.L06): the interval pad offers "+ an octave" (9ths to 14ths) from the start. */
  compoundIntervals?: boolean;
  /**
   * Wave 6 (U12.L05), the guide-tone pick: a `keyboard` answer in `chord` mode that asks for the 3rd and the 7th of
   * this chord (code spelling, `"G7"`). Once the answer is checked (or live, as `nameChords` says) each picked key
   * is named by its place in the chord ("B, the 3rd · F, the 7th"); nothing is named before.
   */
  guideChord?: string;
  /**
   * Wave 7 (features `keyboard.voicing`, `staff-expect.voicing`; J1.L05, J3.L01–L02): the chord a voicing is
   * built for (`symbol`, code or lead-sheet spelling; one per written chord on a staff) and the shapes the step
   * asks for. The keyboard and the staff say what was built ("D3 F3 C4: root, 3rd, 7th. A shell voicing of
   * Dm7."): live with the VOICINGS lens on (`lenses.voicings`), else once the answer is checked.
   */
  voicing?: { symbol: string | readonly string[]; shape?: VoicingShape | readonly VoicingShape[] };
  /**
   * Wave 7 (`tb.feature.jazz-glyphs`, J1.L02): how chord symbols are printed back: lead sheet (default) or jazz
   * glyphs (∆ – ø °). The jazz chord entry shows the other style beside it either way.
   */
  chordStyle?: ChordStyle;
  /**
   * Wave 7 (J2–J5): the numeral palette offers the jazz row (II7 VI7 III7, the tritone sub ♭II7, the backdoor
   * iv7 ♭VII7, iiø7) and draws ii–V brackets over the learner's numerals.
   */
  jazz?: boolean;
}

/**
 * Wave 6 (U17; `fam.har.modulation`): a "where does the key change" answer (`bar-buttons`, or a `choice` whose
 * options are bars and "none") is drawn as a bar timeline. With `from`, the bars before the chosen one are labelled
 * with that key; `to` is printed over the bars after it once the answer is checked right or revealed, with the
 * distance in words ("up a whole step"). A `choice` of chords with both keys names the chosen chord in each
 * ("vi in C major, ii in G major": the pivot). Nothing here is graded: the host grades the answer as before.
 */
export interface KeyChangeEnv {
  from?: KeySpec;
  to?: KeySpec | null;
  /** Plays the music from one bar (1-based): `P` on the focused bar. */
  play?: (bar: number) => void;
}

/**
 * Wave 7: "what is this note over the chord" (J2.L03): the chord and the held melody note the tension pick is
 * about, drawn above the options; `play` sounds them (the host's; else the widget plays a piano voicing).
 */
export interface TensionEnv {
  chord: string;
  note: string;
  play?: () => void;
}

/** Wave 7: an A/B sound pick ("which is brighter"): the two cards' code (played through `audition`) or a player. */
export interface CompareEnv {
  a?: string;
  b?: string;
  play?: (card: "A" | "B") => void;
}

/**
 * Wave 7: what a slider plays. `swing` and `layback` sliders play a two-bar groove at `bpm` by themselves; a
 * `control` slider ("match the cutoff by ear") plays through the host: `play(value)` the learner's setting and
 * `playTarget()` the sound to match.
 */
export interface SliderEnv {
  bpm?: number;
  play?: (value: number) => void;
  playTarget?: () => void;
}

export interface AnswerEnv {
  profile?: LearnerProfile;
  /** Quiet mode for today, or no usable microphone. */
  quiet?: boolean;
  audio?: AnswerAudio;
  tap?: TapEnv;
  sing?: SingEnv;
  /** Hum-to-predict: how long the hum window lasts (default 2 bars at the given tempo, or 6 s). */
  hum?: { seconds?: number; play?: () => void };
  /**
   * Rhythm grid playback tempo and meter. Wave 6: `meter` groups the steps as the meter does (6 steps in 6/8 are
   * 3 + 3, counted "1 la li 2 la li"; `bpm` then counts the dotted quarter) and wins over `beatsPerBar`;
   * `triplets` counts a simple meter's three-to-a-beat grid "1 trip let" (12 or 24 steps in 4/4).
   */
  grid?: { bpm?: number; beatsPerBar?: number; meter?: MeterSpec; triplets?: boolean };
  /** Click-code: the clean code the learner points into. */
  code?: string;
  /** Click-staff and click-roll: the analysed music (the workbench's `onModel`). */
  music?: WorkbenchModel | null;
  /**
   * Choice layouts `roll-thumbs` and `staff-thumbs`: draws a choice's thumbnail (a host with the analysed music
   * renders its mini roll or staff here). Without it the card shows the label and the audition only.
   */
  choiceThumb?: (choice: Choice) => ReactNode;
  /** Keyboard pick: the typing-row octave and the sound. */
  keyboard?: { octave?: number; sound?: string };
  /**
   * Staff input: the meter the answer is written in (default 4/4) and the sound of a placed note. Wave 6:
   * `rhythmOnly` writes every note on one pitch (default the middle line; or a pitch such as `"B4"`), for rhythm
   * dictation: letters, clicks and the `N` key all place that note, and the pitch keys are off. `swing` prints
   * "Swing 8ths" over a staff whose answer is written straight (contracts §6.10 item 3; d5).
   */
  staff?: { meter?: MeterSpec; sound?: string; rhythmOnly?: boolean | string; swing?: SwingSpec };
  /**
   * The note-label lenses the learner has on (wave3.md §4.3: the host passes `useLenses().shown`). Widgets only
   * read them: a degree pad shows syllables when the solfège lens is on. Absent: no lens.
   */
  lenses?: {
    degrees: boolean;
    solfege: boolean;
    noteNames: boolean;
    /**
     * Wave 4 chord lenses (`useLenses().chords.shown`, wave4.md §4.3): the RN palette prints each numeral's
     * chord symbol in the key ("IV · F") only with `chordSymbols` on. Absent: on.
     */
    chordSymbols?: boolean;
    romanNumerals?: boolean;
    /**
     * Wave 7 track lenses (`useLenses().track.shown`, wave7.md §4.2) the answers read: VOICINGS names a keyboard
     * or staff voicing while it is built; TENSIONS names each picked note's role over the chord; CLAVE draws
     * the two-bar grid on a clave pick. Absent: off (each opens with its lesson).
     */
    voicings?: boolean;
    tensions?: boolean;
    clave?: boolean;
  };
  /** Wave 4: chords, numerals and slot strips. */
  harmony?: HarmonyEnv;
  /** Wave 4: a slot strip (`slot-choice`) can play the music under one slot ("Hear bar 2"). */
  slots?: { play?: (slot: number) => void };
  /** Wave 6: the key change a bar timeline or a pivot-chord pick is about. */
  keyChange?: KeyChangeEnv;
  /** Wave 7: the chord and melody note of a tension pick. */
  tension?: TensionEnv;
  /** Wave 7: the A and B cards of a sound comparison. */
  compare?: CompareEnv;
  /** Wave 7: what a swing, lay-back or control slider plays. */
  slider?: SliderEnv;
  /**
   * Wave 7: grouping, Euclid and clave playback: the tempo in the meter's own counting unit (an eighth in 7/8, a
   * quarter in 4/4; default 120), and the sound of a Euclidean ring (default "rim").
   */
  rhythm?: { bpm?: number; sound?: string };
  /**
   * Wave 6: after a check, a "which mode" pick says the one changed note of the mode picked (or, revealed, of the
   * answer): "Mixolydian is major with one note changed: 7 becomes ♭7. From G: F♯ becomes F." (the tonic from
   * `harmony.key`), and a scale builder with `from` names the scale built. Off by default: a host that already
   * says so in its own feedback (the drill runner's fact line) leaves it off.
   */
  facts?: boolean;
  /**
   * What Enter does to the answer, as a verb for the key hints: "check" (default), or "save" in a checkpoint,
   * which stores the answer without grading it.
   */
  submitVerb?: "check" | "save";
  /**
   * The host grades a complete pick at once (a drill's single-choice pad, `AUTO_SUBMIT_KINDS`): there is no
   * Check step, so the key hints say a digit answers and leave out the Enter hint.
   */
  autoSubmit?: boolean;
}

const EnvContext = createContext<AnswerEnv>({});

export function AnswerEnvProvider({ value, children }: { value: AnswerEnv; children: ReactNode }) {
  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>;
}

export function useAnswerEnv(): AnswerEnv {
  return useContext(EnvContext);
}

/** The verb of the Enter key hint ("check", or "save" in a checkpoint). */
export function useSubmitVerb(): "check" | "save" {
  return useContext(EnvContext).submitVerb ?? "check";
}

/** A neutral profile (comfortable range around A3–E4, uncalibrated) for hosts without one. */
export const NEUTRAL_PROFILE: LearnerProfile = {
  rangeLow: 48,
  rangeHigh: 72,
  comfLow: 52,
  comfHigh: 67,
  tapLatencyMs: 0,
  tapJitterMs: 10,
  singLatencyMs: 0,
  singTolCents: 70,
  singTolMode: "auto",
  noiseFloorDb: -60,
  outputKind: "unknown",
  inputKind: "builtin",
  quiet: false,
};

/** The app's adapter as `AnswerAudio`. Loaded lazily: Strudel is heavy and starts on a gesture. */
export const appAudio: AnswerAudio = {
  async context() {
    const { getOak } = await import("../lib/oak.ts");
    return (await getOak()).ctx;
  },
  playNote(midi, o = {}) {
    void import("../lib/oak.ts").then(async ({ getOak }) => {
      const oak = await getOak();
      const notes = typeof midi === "number" ? midi : [...midi];
      oak.playNote({ s: o.sound ?? "piano", note: notes, dur: o.dur ?? 0.6 });
    });
  },
  hits(hits) {
    void import("../lib/oak.ts").then(async ({ getOak }) => {
      const oak = await getOak();
      const end = hits.reduce((m, h) => Math.max(m, h.at), 0) + 0.3;
      oak.playEvents(
        {
          events: hits.map((h) => ({ at: h.at, dur: 0.1, value: { s: h.s, gain: h.gain } })),
          durationSec: end,
          preload: [...new Set(hits.map((h) => h.s))],
        },
        { exclusive: false },
      );
    });
  },
  click(at, accent = false) {
    void import("../lib/oak.ts").then(async ({ getOak }) => {
      const oak = await getOak();
      oak.playEvents(
        {
          events: [{ at: 0, dur: 0.05, value: { s: "rim", gain: accent ? 0.9 : 0.55 } }],
          durationSec: 0.1,
          preload: ["rim"],
        },
        { at, exclusive: false },
      );
    });
  },
  reference(kind, tonicMidi, mode = "major") {
    void Promise.all([import("../lib/oak.ts"), import("@oak/strudel/reference")]).then(
      async ([{ getOak }, ref]) => {
        const oak = await getOak();
        const plan = kind === "tonic" ? ref.tonicPlan(tonicMidi) : ref.cadencePlan(tonicMidi, { mode });
        oak.playEvents(plan, { exclusive: false });
      },
    );
  },
};
