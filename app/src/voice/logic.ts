// Pure decisions of the voice and audio set-up (ux §4.7, contracts §8.2, §8.5, §8.6): verdicts and copy for each
// measurement, the note the first sing plays, the live note readout and the tolerance-ladder summary. No audio
// here; the parts in ./parts call these with what @oak/audio measured.
import type { Profile } from "@oak/api";
import type { BleedCheck } from "@oak/audio";
// The meter's own module: pure, so this file stays importable outside the browser.
import { levelText, limiterWords, type MasterReading } from "@oak/audio/master-meter";
import type { SingTolCents } from "@oak/content-kit";
import type { PitchFrame } from "@oak/pitch";
import { median } from "@oak/pitch";
import { formatNoteMidi } from "../lib/notes.ts";

/** ux §4.7 `mic.noise`: below −45 dBFS is quiet enough. */
export const NOISE_OK_DB = -45;
/** contracts §8.6: tap latency above 120 ms looks like Bluetooth; timing grades get more forgiving. */
export const HIGH_TAP_MS = 120;
/** Fewer matched taps than this out of 16 and the measurement is not worth keeping. */
export const MIN_TAPS = 8;
/** A sing latency outside this window is a mis-detection (an onset found on the wrong click), not a latency. */
export const SING_LATENCY_MAX_MS = 400;
/**
 * A voice cannot answer a click before it: a sung "da" measured more than 30 ms early was sung off the beat (or
 * found on the wrong click). Such a take is "unclear" and never saved (docs/design/retry.md §6.5 item 3).
 */
export const SING_LATENCY_MIN_MS = -30;

export type OutputChoice = "wired" | "bluetooth" | "speakers";

/**
 * The quiet check in plain words (docs/design/retry.md §6.2): the words first, the number second (`detail`, shown
 * small under the result).
 */
export function noiseVerdict(db: number): { ok: boolean; title: string; body: string; detail: string } {
  const detail = `Room noise: ${Math.round(db)} dBFS`;
  if (db < NOISE_OK_DB)
    return {
      ok: true,
      title: "Your room is quiet enough",
      body: "Oak can hear a soft voice clearly.",
      detail,
    };
  return {
    ok: false,
    title: "Your room is a little noisy",
    body: "A quieter spot helps Oak hear you. You can carry on and check again later.",
    detail,
  };
}

/** The speaker check ("bleed": the mic hearing Oak's own sound) in plain words. */
export function bleedVerdict(heard: boolean): { ok: boolean; title: string; body: string } {
  return heard
    ? {
        ok: false,
        title: "Your mic hears Oak's sound",
        body: "Use headphones, or turn the volume down, so Oak grades your voice and not its own.",
      }
    : {
        ok: true,
        title: "Your mic doesn't hear Oak. Good.",
        body: "You can sing along while Oak plays.",
      };
}

const rounded = (v: number | null | undefined, step = 1): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v / step) * step : null;

/**
 * What the speaker check stores (a calibration run, kind `bleed`): the verdict, the output in use, and what
 * was measured (the test tones' level in the mic and the room's, dBFS; the delay they arrived at, ms), so a
 * later look at the history can tell a loud leak from a borderline one. JSON-safe: no infinities.
 */
export function bleedResult(
  check: BleedCheck,
  outputKind: Profile["outputKind"],
): Record<string, string | number | boolean | null> {
  const t = check.tones;
  return {
    heard: check.heard,
    outputKind,
    byPitch: check.byPitch,
    leakDb: rounded(t?.leakDb, 0.5),
    floorDb: rounded(t?.floorDb, 0.5),
    lagMs: t?.lagSec === null || t === null ? null : rounded(t.lagSec * 1000),
    tonesHeard: t ? t.tones.filter((x) => x.heard).length : null,
  };
}

export interface TapVerdict {
  ok: boolean;
  title: string;
  body: string;
}

export function tapVerdict(r: { latencyMs: number; jitterMs: number; taps: number }): TapVerdict {
  if (r.taps < MIN_TAPS || !Number.isFinite(r.latencyMs))
    return {
      ok: false,
      title: "Not enough taps to measure",
      body: `Oak caught ${r.taps} of 16. Tap Space (or the pad) on each click, then try again.`,
    };
  const ms = Math.round(r.latencyMs);
  if (r.latencyMs > HIGH_TAP_MS)
    return {
      ok: true,
      title: `Your taps land ${ms} ms after the click`,
      body: "That looks like Bluetooth latency. Oak allows for it, and timing grades will be a little looser.",
    };
  return {
    ok: true,
    title: `Your taps land ${Math.abs(ms)} ms ${ms >= 0 ? "after" : "before"} the click`,
    body: `Oak subtracts that from every tap. Your taps vary by about ${Math.round(r.jitterMs)} ms.`,
  };
}

export function singLatencyVerdict(ms: number): { ok: boolean; title: string; body: string } {
  if (!Number.isFinite(ms) || ms > SING_LATENCY_MAX_MS || ms < SING_LATENCY_MIN_MS)
    return {
      ok: false,
      title: "Oak couldn't line your voice up with the clicks",
      body: "Sing a short 'da' right on each click, at a steady volume, and try again.",
    };
  return {
    ok: true,
    title: `Your voice lands ${Math.round(Math.abs(ms))} ms ${ms >= 0 ? "after" : "before"} the click`,
    body: "Oak allows for that when it times your singing.",
  };
}

export interface RangeLike {
  lowMidi: number;
  highMidi: number;
  comfortLowMidi: number;
  comfortHighMidi: number;
}

/** ux §4.7 result card: "Your singing zone: A2–E4 (comfortable C3–C4). Oak will choose keys that sit there." */
export function rangeSummary(r: RangeLike): string {
  const zone = `${formatNoteMidi(r.lowMidi)}–${formatNoteMidi(r.highMidi)}`;
  const comf = `${formatNoteMidi(r.comfortLowMidi)}–${formatNoteMidi(r.comfortHighMidi)}`;
  return `Your singing zone: ${zone} (comfortable ${comf}). Oak will choose keys that sit there.`;
}

/** Where a note sits for a voice, in words: below F3 low, above E4 high (no voice types, ever). */
function registerWord(midi: number): "low" | "middle" | "high" {
  if (midi < 53) return "low";
  if (midi > 64) return "high";
  return "middle";
}

/**
 * The range in plain words (docs/design/retry.md §6.2): "Your comfortable range is about an octave, low to
 * middle." The note names go in `detail`, shown small under it.
 */
export function rangeWords(r: RangeLike): { title: string; detail: string } {
  const span = r.comfortHighMidi - r.comfortLowMidi;
  const size =
    span < 10 ? "a little less than an octave" : span <= 14 ? "about an octave" : "more than an octave";
  const from = registerWord(r.comfortLowMidi);
  const to = registerWord(r.comfortHighMidi);
  const where = from === to ? from : `${from} to ${to}`;
  const comf = `${formatNoteMidi(r.comfortLowMidi)}–${formatNoteMidi(r.comfortHighMidi)}`;
  const zone = `${formatNoteMidi(r.lowMidi)}–${formatNoteMidi(r.highMidi)}`;
  return {
    title: `Your comfortable range is ${size}, ${where}.`,
    detail: `Comfortable notes ${comf} · everything Oak heard ${zone}`,
  };
}

/** A range is believable when it spans at least a few notes and sits inside the human voice (E1–C6). */
export function rangeOk(r: RangeLike): boolean {
  return r.highMidi - r.lowMidi >= 3 && r.lowMidi >= 28 && r.highMidi <= 84;
}

/**
 * The home note (C) the first sing plays: the C nearest the middle of the comfort zone, else middle C. Any
 * octave counts when it is graded (contracts §8.1 rule 8: folded per note), so this only picks a comfortable one.
 */
export function firstSingTonic(p: Pick<Profile, "comfortLowMidi" | "comfortHighMidi">): number {
  if (p.comfortLowMidi === null || p.comfortHighMidi === null) return 60;
  const mid = (p.comfortLowMidi + p.comfortHighMidi) / 2;
  const below = Math.floor(mid / 12) * 12;
  return mid - below <= 6 ? below : below + 12;
}

// --- the first sung note's take (docs/design/retry.md §2.5, §6.5 item 1) ------------------------------

/** The longest a first-sing take listens, in seconds. */
export const FIRST_SING_MAX_SEC = 12;
/** Once the note has been held long enough to pass, the take ends this long after the voice stops. */
export const FIRST_SING_TAIL_SEC = 1;

/**
 * Whether a first-sing take is over. It never ends the instant the live grade reaches a pass (that cut learners
 * off half a second into their note): it runs while the learner holds the note, ends `FIRST_SING_TAIL_SEC` after
 * the voice stops once a pass has been heard, and at most `FIRST_SING_MAX_SEC` after it began.
 */
export function firstSingTakeOver(s: {
  /** Seconds since the take began listening. */
  elapsed: number;
  /** The live grade has credited the note. */
  passed: boolean;
  /** Seconds since the last voiced frame, or null while the voice is on (or none was heard yet). */
  silentFor: number | null;
}): boolean {
  if (s.elapsed >= FIRST_SING_MAX_SEC) return true;
  return s.passed && s.silentFor !== null && s.silentFor >= FIRST_SING_TAIL_SEC;
}

/** What one first-sing take says in the list of takes, in words (the cents stay in the details). */
export function takeWords(t: { passed: boolean; cents: number | null }): string {
  if (t.passed) return t.cents === null ? "on the note" : `on the note, ${centsWords(t.cents)}`;
  if (t.cents !== null) return "a steady note, but not this one";
  return "no steady note heard";
}

/**
 * What a first-sing take is (docs/design/retry.md §3.4): once a take has passed, the step stays passed and every
 * later take is practice; only the first passing take is saved (`first: true`).
 */
export function firstSingTake(counted: boolean, passed: boolean): { practice: boolean; save: boolean } {
  return { practice: counted, save: !counted && passed };
}

// --- where a set-up step resumes after a reload or Back (docs/design/retry.md §6.4) --------------------------

/** The mic step's sub-step to open on: the first not yet measured, its result shown when all are. */
export function micResumeAt(s: {
  noiseFloorDb: number | null;
  bleedMeasured: boolean;
}): "ask" | "bleed" | "bleed-done" {
  if (s.noiseFloorDb === null) return "ask";
  return s.bleedMeasured ? "bleed-done" : "bleed";
}

/** The timing step's sub-step to open on: singing once tapping is measured and singing is not. */
export function latencyResumeAt(s: {
  withTap: boolean;
  withSing: boolean;
  tapSaved: boolean;
  singSaved: boolean;
}): "tap" | "sing" {
  if (!s.withTap) return "sing";
  return s.withSing && s.tapSaved && !s.singSaved ? "sing" : "tap";
}

// --- Quiet mode and a mic that fails mid-step (docs/design/retry.md §6.4: no dead ends) ----------------------

/**
 * Quiet mode as the learner chose it (contracts §8.5): "just for today" or "until I switch it off", from
 * `GET /voice` when the server answers it, else the profile's flag. "No microphone set up yet" is not a choice:
 * onboarding's own mic step is where that gets set up, so it does not count here.
 */
export function quietChosen(
  voice: { quiet: boolean; quietReason: string | null } | null | undefined,
  profile: Pick<Profile, "quiet">,
): boolean {
  if (!voice) return profile.quiet;
  return voice.quiet && voice.quietReason !== "no-mic";
}

/**
 * What a failed measurement tells the learner: the browser refused the mic, there is no mic (unplugged mid-step),
 * or the error's own words. Never nothing: a measurement that fails silently leaves the learner pressing Start.
 */
export function micProblemOf(e: unknown): { problem: "denied" | "no-device" } | { message: string } {
  const name = e instanceof Error ? e.name : "";
  const reason =
    typeof e === "object" && e !== null && "reason" in e ? (e as { reason: unknown }).reason : null;
  if ((name === "MicError" && reason === "denied") || name === "NotAllowedError")
    return { problem: "denied" };
  if ((name === "MicError" && reason === "no-device") || name === "NotFoundError")
    return { problem: "no-device" };
  return { message: e instanceof Error ? e.message : String(e) };
}

/** A latency in words for the result rows: "136 ms early", "91 ms late", "on the click". */
export function latencyWords(ms: number): string {
  const r = Math.round(ms);
  if (r === 0) return "on the click";
  return `${Math.abs(r)} ms ${r < 0 ? "early" : "late"}`;
}

/** Quiet checks that heard a voice before "Use this room anyway" is offered (a room that is never quiet). */
export const VOICED_CHECKS_BEFORE_ANYWAY = 2;
export const offerRoomAnyway = (voicedChecks: number) => voicedChecks >= VOICED_CHECKS_BEFORE_ANYWAY;

/** A frame is voiced at the pipeline's clarity gate (contracts §8.1 rule 1). */
export const voiced = (f: PitchFrame, clarity = 0.9) => f.clarity >= clarity && f.hz > 0;

export const midiOfHz = (hz: number) => 69 + 12 * Math.log2(hz / 440);

/** The live readout ("Hum anything"): the median MIDI of the last few voiced frames, or null. */
export function liveMidi(frames: readonly PitchFrame[], last = 5): number | null {
  const v = frames
    .slice(-last * 2)
    .filter((f) => voiced(f))
    .slice(-last);
  if (v.length < Math.min(3, last)) return null;
  return median(v.map((f) => midiOfHz(f.hz)));
}

export function noteReadout(midi: number | null): string {
  if (midi === null) return "—";
  const nearest = Math.round(midi);
  const cents = Math.round((midi - nearest) * 100);
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "±";
  return `${formatNoteMidi(nearest)} ${sign}${Math.abs(cents)}¢`;
}

/** ux §4.3 needle words: arrows and words only, never red/green. */
export function centsWords(cents: number): string {
  const a = Math.abs(cents);
  if (a <= 10) return "spot on";
  if (a <= 50) return cents < 0 ? "a little low" : "a little high";
  return cents < 0 ? "low" : "high";
}

/** Folds `midi` to the octave of `target` (error in (−600, 600] cents) and returns the signed error in cents. */
export function foldedCents(midi: number, target: number): number {
  let c = (midi - target) * 100;
  c = ((((c + 600) % 1200) + 1200) % 1200) - 600;
  return c === -600 ? 600 : c;
}

// --- the tolerance ladder (contracts §8.2) ---------------------------------------------------------

export const LADDER: readonly SingTolCents[] = [70, 50, 35, 25];
const NEXT_RULE: Readonly<Record<number, string>> = {
  70: "on 3 days within 21, each with at least 8 sung notes, your day's median miss is 35¢ or less",
  50: "on 3 days within 21, each with at least 8 sung notes, your day's median miss is 25¢ or less",
  35: "on 3 days within 21, each with at least 8 sung notes, your day's median miss is 20¢ or less",
};

export function ladderSummary(p: Pick<Profile, "singToleranceCents" | "singTolMode">): {
  current: string;
  next: string;
} {
  const t = p.singToleranceCents;
  const current = `±${t}¢ (${p.singTolMode === "auto" ? "Auto" : "fixed"})`;
  if (p.singTolMode === "fixed") return { current, next: "Fixed: it stays here until you choose Auto." };
  const rule = NEXT_RULE[t];
  if (!rule) return { current, next: "The finest step. It never loosens by itself." };
  const nxt = LADDER[LADDER.indexOf(t) + 1];
  return { current, next: `Tightens to ±${nxt}¢ when ${rule}. It never loosens by itself.` };
}

// --- the learner's own words for an output device ---------------------------------------------------

export function outputGuidance(kind: OutputChoice): {
  tone: "info" | "attention";
  title: string;
  body: string;
} {
  if (kind === "bluetooth")
    return {
      tone: "attention",
      title: "AirPods are fine for listening",
      body: "Oak will listen through your computer's own microphone, never the earbuds' (that would switch them to a low-quality call mode). Bluetooth adds delay, so Oak measures your timing in this set-up and tap grades are a little more forgiving.",
    };
  if (kind === "speakers")
    return {
      tone: "attention",
      title: "Speakers work for almost everything",
      body: "When you sing, the mic would also hear the speakers, so in singing steps Oak plays first and listens after. Wired headphones avoid this.",
    };
  return {
    tone: "info",
    title: "Wired headphones: the best set-up",
    body: "No delay, and the mic hears only you.",
  };
}

/** The output choice Oak guesses from the device label (the learner confirms it). */
export function outputChoiceOf(kind: Profile["outputKind"]): OutputChoice {
  return kind === "bluetooth" ? "bluetooth" : kind === "speakers" ? "speakers" : "wired";
}

// --- the three pitch-match trials (ux §4.7 `voice.match`, contracts §8.6) ---------------------------

/** The window a pitch-match trial is judged on: ±50¢ (ux §4.7), any octave. */
export const MATCH_CENTS = 50;
/** Seconds the learner has to sing each note back. */
export const MATCH_SING_SEC = 3;

/**
 * Three notes inside the comfort zone (ux §4.7): the middle, a major third above it and a fourth below it,
 * kept inside the zone; without a measured zone, around middle C.
 */
export function matchTargets(
  p: Pick<Profile, "comfortLowMidi" | "comfortHighMidi">,
): [number, number, number] {
  const lo = p.comfortLowMidi ?? 55;
  const hi = p.comfortHighMidi ?? 67;
  const mid = Math.round((lo + hi) / 2);
  const inside = (m: number) => Math.min(hi, Math.max(lo, m));
  return [mid, inside(mid + 4), inside(mid - 5)];
}

export interface MatchTrial {
  midi: number;
  /** Signed cents, folded to the nearest octave; null when no steady note was heard. */
  cents: number | null;
  /** Wave 4 (contracts §8.6): the mic heard the note being played, so the trial says nothing about the voice. */
  bleed?: true;
}

/** One trial in words and arrows (ux §4.3: no red or green): "spot on (+4¢)", "↓ a little low (−32¢)", "↑ 5 semitones high". */
export function matchWords(cents: number | null, bleed = false): string {
  if (bleed) return "the mic heard the playback";
  if (cents === null) return "no steady note heard";
  const arrow = cents > 0 ? "↑ " : "↓ ";
  if (Math.abs(cents) <= 10) return `spot on (${cents > 0 ? "+" : cents < 0 ? "−" : "±"}${Math.abs(cents)}¢)`;
  if (Math.abs(cents) < 100)
    return `${arrow}${centsWords(cents)} (${cents > 0 ? "+" : "−"}${Math.abs(cents)}¢)`;
  const semis = Math.round(Math.abs(cents) / 100);
  return `${arrow}${semis} semitone${semis === 1 ? "" : "s"} ${cents > 0 ? "high" : "low"}`;
}

export function matchVerdict(trials: readonly MatchTrial[]): {
  within: number;
  title: string;
  body: string;
} {
  const within = trials.filter((t) => t.cents !== null && Math.abs(t.cents) <= MATCH_CENTS).length;
  const heard = trials.filter((t) => t.cents !== null).length;
  if (heard === 0)
    return {
      within,
      title: "Oak didn't hear a steady note",
      body: "Sing a long 'ooh' right after each note, at a comfortable volume. You can try again now or later; nothing waits on it.",
    };
  if (within >= 2)
    return {
      within,
      title: `${within} of 3 notes matched within ±${MATCH_CENTS}¢`,
      body: "Your voice finds the notes. Oak starts every learner at ±70¢ and tightens it as your singing settles.",
    };
  return {
    within,
    title: `${within} of 3 notes matched within ±${MATCH_CENTS}¢`,
    body: "Matching a note you just heard is a skill, and the singing steps are where it grows. Oak starts wide, at ±70¢, and only tightens once your singing shows it is ready.",
  };
}

// --- headphones changed since the set-up (contracts §8.6: re-checked when the device changes) ----------

/**
 * What to say when the output the computer reports now differs from the one the timing was measured with.
 * `nowKind` is the class of the default output's label (Bluetooth earbuds, wired, speakers) or null when the
 * browser does not name it (no permission yet).
 */
export function outputChangeAdvice(
  nowLabel: string | null,
  nowKind: OutputChoice | null,
  measured: Profile["outputKind"],
): { title: string; body: string } | null {
  if (!nowLabel || !nowKind || measured === "unknown") return null;
  if (nowKind === "bluetooth" && measured !== "bluetooth")
    return {
      title: `Oak sees ${nowLabel}`,
      body: "AirPods are fine for listening; Oak listens through your computer's own microphone. Bluetooth adds delay, so measure the timing again with them on.",
    };
  if (nowKind !== "bluetooth" && measured === "bluetooth")
    return {
      title: `Oak sees ${nowLabel}`,
      body: "Your timing was measured over Bluetooth. Measure it again so taps and sung notes line up without the extra delay.",
    };
  return null;
}

/**
 * What the Master meter read over Settings › Audio's test phrase, in the words the single's Master card uses: the
 * average level and the loudest moment before the limiter, both in dB below full scale, and what the limiter did.
 */
export function phraseReadout(r: MasterReading): string {
  if (!Number.isFinite(r.levelDb)) return "Nothing reached the output while Oak was measuring.";
  return `Measured over that phrase: average level ${levelText(r.levelDb)}, loudest moment ${levelText(r.peakDb)} before the limiter (0 dB is full scale). ${limiterWords(r)}`;
}
