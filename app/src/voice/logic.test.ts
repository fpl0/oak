import { describe, expect, test } from "bun:test";
import type { MasterReading } from "@oak/audio/master-meter";
import type { PitchFrame } from "@oak/pitch";
import { firstSingPasses, midiToHz } from "@oak/pitch";
import {
  bleedResult,
  bleedVerdict,
  centsWords,
  FIRST_SING_MAX_SEC,
  FIRST_SING_TAIL_SEC,
  firstSingTake,
  firstSingTakeOver,
  firstSingTonic,
  foldedCents,
  ladderSummary,
  latencyResumeAt,
  latencyWords,
  liveMidi,
  matchTargets,
  matchVerdict,
  matchWords,
  micProblemOf,
  micResumeAt,
  noiseVerdict,
  noteReadout,
  offerRoomAnyway,
  outputChangeAdvice,
  outputChoiceOf,
  outputGuidance,
  phraseReadout,
  quietChosen,
  rangeOk,
  rangeSummary,
  rangeWords,
  singLatencyVerdict,
  takeWords,
  tapVerdict,
} from "./logic.ts";

const frames = (midi: number, n: number, t0 = 0, hop = 512 / 48000): PitchFrame[] =>
  Array.from({ length: n }, (_, i) => ({ t: t0 + i * hop, hz: midiToHz(midi), clarity: 0.97, rms: 0.1 }));

describe("verdicts", () => {
  test("noise floor: below −45 dBFS is quiet", () => {
    expect(noiseVerdict(-60).ok).toBe(true);
    expect(noiseVerdict(-40).ok).toBe(false);
    // Plain words first, the number second (docs/design/retry.md §6.2).
    expect(noiseVerdict(-60).title).toBe("Your room is quiet enough");
    expect(`${noiseVerdict(-40).title} ${noiseVerdict(-40).body}`).not.toContain("dBFS");
    expect(noiseVerdict(-40).detail).toBe("Room noise: -40 dBFS");
    expect(`${bleedVerdict(true).title} ${bleedVerdict(false).title}`).not.toMatch(/bleed/i);
  });
  test("bleed", () => {
    expect(bleedVerdict(false).ok).toBe(true);
    expect(bleedVerdict(true).ok).toBe(false);
    // Plain words: what the mic hears and what to do about it.
    expect(bleedVerdict(false).title).toBe("Your mic doesn't hear Oak. Good.");
    expect(bleedVerdict(true).title).toBe("Your mic hears Oak's sound");
    expect(bleedVerdict(true).body).toBe(
      "Use headphones, or turn the volume down, so Oak grades your voice and not its own.",
    );
  });
  test("the speaker check stores its verdict and what it measured, JSON-safe", () => {
    const tone = (heard: boolean) => ({
      hz: 880,
      blocks: 12,
      tonalDb: 30,
      aboveQuietDb: 30,
      aloneDb: 30,
      levelDb: heard ? -41.3 : Number.NEGATIVE_INFINITY,
      present: heard,
      heard,
    });
    const leak = {
      heard: true,
      byPitch: false,
      tones: {
        heard: true,
        lagSec: 0.123,
        floorDb: -61.8,
        gateDb: -45,
        leakDb: -41.3,
        tones: [tone(true), tone(true), tone(false)],
      },
    };
    expect(bleedResult(leak, "speakers")).toEqual({
      heard: true,
      outputKind: "speakers",
      byPitch: false,
      leakDb: -41.5,
      floorDb: -62,
      lagMs: 123,
      tonesHeard: 2,
    });
    const clean = bleedResult(
      { heard: false, byPitch: false, tones: { ...leak.tones, heard: false, lagSec: null, leakDb: null } },
      "wired",
    );
    expect(clean).toMatchObject({ heard: false, leakDb: null, lagMs: null });
    // A session that gave no raw samples: the pitch tracker's answer only.
    expect(bleedResult({ heard: true, byPitch: true, tones: null }, "wired")).toEqual({
      heard: true,
      outputKind: "wired",
      byPitch: true,
      leakDb: null,
      floorDb: null,
      lagMs: null,
      tonesHeard: null,
    });
    expect(JSON.stringify(clean)).not.toMatch(/Infinity|NaN/);
  });
  test("tap latency: too few taps, normal, Bluetooth-high", () => {
    expect(tapVerdict({ latencyMs: 30, jitterMs: 8, taps: 5 }).ok).toBe(false);
    expect(tapVerdict({ latencyMs: 34, jitterMs: 8, taps: 16 }).title).toBe(
      "Your taps land 34 ms after the click",
    );
    expect(tapVerdict({ latencyMs: 180, jitterMs: 8, taps: 16 }).body).toContain("Bluetooth");
    // Early taps say "before", never "-118 ms before".
    expect(tapVerdict({ latencyMs: -118, jitterMs: 8, taps: 16 }).title).toBe(
      "Your taps land 118 ms before the click",
    );
  });
  test("sing latency: implausible values are not stored", () => {
    expect(singLatencyVerdict(Number.NaN).ok).toBe(false);
    expect(singLatencyVerdict(900).ok).toBe(false);
    expect(singLatencyVerdict(85).ok).toBe(true);
    // A voice cannot answer a click before it: off-beat singing measured early is unclear, never saved.
    expect(singLatencyVerdict(-222).ok).toBe(false);
    expect(singLatencyVerdict(-31).ok).toBe(false);
    expect(singLatencyVerdict(-30).ok).toBe(true);
    expect(singLatencyVerdict(400).ok).toBe(true);
    expect(singLatencyVerdict(401).ok).toBe(false);
  });
  test("copy is calm: no exclamation marks anywhere", () => {
    const all = [
      noiseVerdict(-60),
      noiseVerdict(-30),
      bleedVerdict(true),
      bleedVerdict(false),
      tapVerdict({ latencyMs: 30, jitterMs: 8, taps: 2 }),
      singLatencyVerdict(9999),
      outputGuidance("bluetooth"),
      outputGuidance("speakers"),
      outputGuidance("wired"),
    ];
    for (const v of all) expect(`${v.title} ${v.body}`).not.toContain("!");
  });
});

describe("range in plain words", () => {
  test("size and place first, the note names in the details", () => {
    const w = rangeWords({ lowMidi: 45, highMidi: 64, comfortLowMidi: 48, comfortHighMidi: 60 });
    expect(w.title).toBe("Your comfortable range is about an octave, low to middle.");
    expect(w.title).not.toMatch(/[A-G][♭♯]?\d/);
    expect(w.detail).toBe("Comfortable notes C3–C4 · everything Oak heard A2–E4");
    expect(rangeWords({ lowMidi: 55, highMidi: 76, comfortLowMidi: 57, comfortHighMidi: 69 }).title).toBe(
      "Your comfortable range is about an octave, middle to high.",
    );
    expect(rangeWords({ lowMidi: 50, highMidi: 60, comfortLowMidi: 55, comfortHighMidi: 60 }).title).toBe(
      "Your comfortable range is a little less than an octave, middle.",
    );
  });
});

describe("the first sung note's take", () => {
  test("never ends on the pass itself: it waits for the voice to stop, at most 12 s", () => {
    // The pass arrives half a second into the note: the learner is still singing, so the take goes on.
    expect(firstSingTakeOver({ elapsed: 6.9, passed: true, silentFor: null })).toBe(false);
    expect(firstSingTakeOver({ elapsed: 8, passed: true, silentFor: 0.4 })).toBe(false);
    // One second after the voice stops, the result shows.
    expect(firstSingTakeOver({ elapsed: 9, passed: true, silentFor: FIRST_SING_TAIL_SEC })).toBe(true);
    // Silence without a pass keeps listening (the learner may come in late), until the window ends.
    expect(firstSingTakeOver({ elapsed: 5, passed: false, silentFor: 4 })).toBe(false);
    expect(firstSingTakeOver({ elapsed: FIRST_SING_MAX_SEC, passed: false, silentFor: null })).toBe(true);
    expect(firstSingTakeOver({ elapsed: FIRST_SING_MAX_SEC, passed: true, silentFor: null })).toBe(true);
  });
});

describe("what a retry counts for, and where a step resumes", () => {
  test("the first sung note: the first pass is saved once; every take after it is practice", () => {
    expect(firstSingTake(false, false)).toEqual({ practice: false, save: false });
    expect(firstSingTake(false, true)).toEqual({ practice: false, save: true });
    expect(firstSingTake(true, true)).toEqual({ practice: true, save: false });
    // A practice take that misses never undoes the pass.
    expect(firstSingTake(true, false)).toEqual({ practice: true, save: false });
    expect(takeWords({ passed: true, cents: -4 })).toBe("on the note, spot on");
    expect(takeWords({ passed: false, cents: 700 })).toBe("a steady note, but not this one");
    expect(takeWords({ passed: false, cents: null })).toBe("no steady note heard");
  });
  test("the mic resumes at its first unmeasured sub-step", () => {
    expect(micResumeAt({ noiseFloorDb: null, bleedMeasured: false })).toBe("ask");
    expect(micResumeAt({ noiseFloorDb: null, bleedMeasured: true })).toBe("ask");
    expect(micResumeAt({ noiseFloorDb: -70, bleedMeasured: false })).toBe("bleed");
    expect(micResumeAt({ noiseFloorDb: -70, bleedMeasured: true })).toBe("bleed-done");
  });
  test("timing resumes at singing once tapping is measured", () => {
    const both = { withTap: true, withSing: true };
    expect(latencyResumeAt({ ...both, tapSaved: false, singSaved: false })).toBe("tap");
    expect(latencyResumeAt({ ...both, tapSaved: true, singSaved: false })).toBe("sing");
    expect(latencyResumeAt({ ...both, tapSaved: true, singSaved: true })).toBe("tap");
    expect(latencyResumeAt({ withTap: true, withSing: false, tapSaved: true, singSaved: false })).toBe("tap");
    expect(latencyResumeAt({ withTap: false, withSing: true, tapSaved: false, singSaved: false })).toBe(
      "sing",
    );
  });
  test("a room that is never quiet: 'Use this room anyway' after two voiced checks", () => {
    expect(offerRoomAnyway(1)).toBe(false);
    expect(offerRoomAnyway(2)).toBe(true);
  });
});

describe("range", () => {
  test("the result card reads like ux §4.7", () => {
    expect(rangeSummary({ lowMidi: 45, highMidi: 64, comfortLowMidi: 48, comfortHighMidi: 60 })).toBe(
      "Your singing zone: A2–E4 (comfortable C3–C4). Oak will choose keys that sit there.",
    );
  });
  test("a one-note 'range' is not believable", () => {
    expect(rangeOk({ lowMidi: 57, highMidi: 57, comfortLowMidi: 57, comfortHighMidi: 57 })).toBe(false);
    expect(rangeOk({ lowMidi: 45, highMidi: 64, comfortLowMidi: 48, comfortHighMidi: 60 })).toBe(true);
  });
});

describe("first sing", () => {
  test("plays a C in the comfort zone, middle C without one", () => {
    expect(firstSingTonic({ comfortLowMidi: null, comfortHighMidi: null })).toBe(60);
    expect(firstSingTonic({ comfortLowMidi: 43, comfortHighMidi: 55 })).toBe(48);
    expect(firstSingTonic({ comfortLowMidi: 55, comfortHighMidi: 67 })).toBe(60);
    expect(firstSingTonic({ comfortLowMidi: 64, comfortHighMidi: 76 })).toBe(72);
  });
  test("is lenient: any octave within ±100¢ passes, a fifth away does not (the real @oak/pitch rule)", () => {
    const profile = {
      rangeLow: 48,
      rangeHigh: 72,
      comfLow: 50,
      comfHigh: 70,
      tapLatencyMs: 0,
      tapJitterMs: 0,
      singLatencyMs: 0,
      singTolCents: 70 as const,
      singTolMode: "auto" as const,
      noiseFloorDb: -60,
      outputKind: "wired" as const,
      inputKind: "builtin" as const,
      quiet: false,
    };
    expect(firstSingPasses(frames(48.8, 90), 60, profile)).toBe(true); // C3 + 80¢, an octave down
    expect(firstSingPasses(frames(72, 90), 60, profile)).toBe(true);
    expect(firstSingPasses(frames(67, 90), 60, profile)).toBe(false);
    expect(firstSingPasses(frames(60, 20), 60, profile)).toBe(false); // too short to count as sustained
    expect(foldedCents(48.8, 60)).toBeCloseTo(80, 6);
  });
});

describe("readouts", () => {
  test("live note from voiced frames only", () => {
    expect(liveMidi(frames(57, 10))).toBeCloseTo(57, 6);
    expect(liveMidi([])).toBeNull();
    expect(noteReadout(57.12)).toBe("A3 +12¢");
    expect(noteReadout(null)).toBe("—");
  });
  test("needle words", () => {
    expect(centsWords(-5)).toBe("spot on");
    expect(centsWords(-30)).toBe("a little low");
    expect(centsWords(80)).toBe("high");
  });
  test("ladder summary", () => {
    expect(ladderSummary({ singToleranceCents: 70, singTolMode: "auto" }).next).toContain("±50¢");
    expect(ladderSummary({ singToleranceCents: 25, singTolMode: "auto" }).next).toContain("finest");
    expect(ladderSummary({ singToleranceCents: 50, singTolMode: "fixed" }).current).toBe("±50¢ (fixed)");
  });
  test("output kind → choice", () => {
    expect(outputChoiceOf("bluetooth")).toBe("bluetooth");
    expect(outputChoiceOf("unknown")).toBe("wired");
  });
});

describe("the pitch match and the output-change advice", () => {
  test("three targets inside the comfort zone", () => {
    expect(matchTargets({ comfortLowMidi: 48, comfortHighMidi: 60 })).toEqual([54, 58, 49]);
    expect(matchTargets({ comfortLowMidi: 57, comfortHighMidi: 60 })).toEqual([59, 60, 57]);
    expect(matchTargets({ comfortLowMidi: null, comfortHighMidi: null })).toEqual([61, 65, 56]);
  });
  test("the verdict counts within ±50¢ and never shames", () => {
    const v = matchVerdict([
      { midi: 60, cents: 12 },
      { midi: 64, cents: -49 },
      { midi: 55, cents: 120 },
    ]);
    expect(v.within).toBe(2);
    expect(v.title).toBe("2 of 3 notes matched within ±50¢");
    const low = matchVerdict([
      { midi: 60, cents: 80 },
      { midi: 64, cents: null },
      { midi: 55, cents: -300 },
    ]);
    expect(low.within).toBe(0);
    expect(low.body).toMatch(/starts wide/);
    expect(low.body).not.toMatch(/fail|wrong|bad/i);
    expect(matchVerdict([{ midi: 60, cents: null }]).title).toMatch(/didn't hear/);
  });
  test("each trial in words and arrows", () => {
    expect(matchWords(1)).toBe("spot on (+1¢)");
    // Wave 4 (contracts §8.6): a trial the playback spoke over says so, whatever was measured.
    expect(matchWords(3, true)).toBe("the mic heard the playback");
    expect(matchWords(null, true)).toBe("the mic heard the playback");
    expect(matchWords(-32)).toBe("↓ a little low (−32¢)");
    expect(matchWords(-399)).toBe("↓ 4 semitones low");
    expect(matchWords(100)).toBe("↑ 1 semitone high");
    expect(matchWords(null)).toBe("no steady note heard");
  });
  test("output change: only when the class changed to or from Bluetooth", () => {
    expect(outputChangeAdvice("AirPods Pro", "bluetooth", "wired")?.title).toBe("Oak sees AirPods Pro");
    expect(outputChangeAdvice("External Headphones", "wired", "bluetooth")?.body).toMatch(/over Bluetooth/);
    expect(outputChangeAdvice("AirPods Pro", "bluetooth", "bluetooth")).toBeNull();
    expect(outputChangeAdvice(null, null, "wired")).toBeNull();
    expect(outputChangeAdvice("MacBook Pro Speakers", "speakers", "unknown")).toBeNull();
  });
});

describe("the test phrase's read-out", () => {
  const reading = (over: Partial<MasterReading> = {}): MasterReading => ({
    seconds: 3.2,
    levelDb: -21.4,
    preLevelDb: -21.4,
    peakDb: -8.7,
    outPeakDb: -8.7,
    loudest: null,
    limiter: { state: "resting", maxReductionDb: 0, workingShare: 0, firstAtSec: null },
    silentShare: 0.1,
    ...over,
  });
  test("the level, the loudest moment and the limiter, in dB below full scale", () => {
    expect(phraseReadout(reading())).toBe(
      "Measured over that phrase: average level −21.4 dB, loudest moment −8.7 dB before the limiter (0 dB is full scale). The limiter rested.",
    );
    expect(
      phraseReadout(
        reading({
          peakDb: 1.2,
          limiter: { state: "touching", maxReductionDb: 3.1, workingShare: 0.04, firstAtSec: 1.5 },
        }),
      ),
    ).toBe(
      "Measured over that phrase: average level −21.4 dB, loudest moment +1.2 dB before the limiter (0 dB is full scale). The limiter caught the loudest hits (up to 3.1 dB).",
    );
  });
  test("a muted output says so instead of printing minus infinity", () => {
    expect(phraseReadout(reading({ levelDb: Number.NEGATIVE_INFINITY }))).toBe(
      "Nothing reached the output while Oak was measuring.",
    );
  });
});

describe("Quiet mode as chosen, and a mic that fails mid-step", () => {
  test("Quiet for today chosen in Settings counts, though the profile's own flag is off", () => {
    const off = { quiet: false };
    expect(quietChosen({ quiet: true, quietReason: "today" }, off)).toBe(true);
    expect(quietChosen({ quiet: true, quietReason: "always" }, off)).toBe(true);
    // No mic set up yet is not a choice: onboarding's mic step is where it is set up.
    expect(quietChosen({ quiet: true, quietReason: "no-mic" }, off)).toBe(false);
    expect(quietChosen({ quiet: false, quietReason: null }, { quiet: true })).toBe(false);
    // Before GET /voice answers (or on an older server), the profile decides.
    expect(quietChosen(null, { quiet: true })).toBe(true);
    expect(quietChosen(undefined, off)).toBe(false);
  });
  test("an unplugged or refused mic is named; anything else keeps its own words", () => {
    const mic = (reason: string) => Object.assign(new Error("x"), { name: "MicError", reason });
    expect(micProblemOf(mic("no-device"))).toEqual({ problem: "no-device" });
    expect(micProblemOf(mic("denied"))).toEqual({ problem: "denied" });
    expect(micProblemOf(new DOMException("gone", "NotFoundError"))).toEqual({ problem: "no-device" });
    expect(micProblemOf(new DOMException("no", "NotAllowedError"))).toEqual({ problem: "denied" });
    expect(micProblemOf(mic("worklet"))).toEqual({ message: "x" });
    expect(micProblemOf("boom")).toEqual({ message: "boom" });
  });
  test("latencies in words: early, late, on the click", () => {
    expect(latencyWords(-136.4)).toBe("136 ms early");
    expect(latencyWords(91)).toBe("91 ms late");
    expect(latencyWords(0.3)).toBe("on the click");
  });
  test("a good speaker check reads as good news", () => {
    expect(bleedVerdict(false).body).toBe("You can sing along while Oak plays.");
  });
});
