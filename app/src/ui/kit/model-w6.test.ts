import { describe, expect, test } from "bun:test";
import { levelText } from "@oak/audio/master-meter";
import type { KeySpec } from "@oak/content-kit";
import { keyDistance } from "@oak/theory";
import {
  barsListText,
  branchNote,
  branchState,
  branchSummary,
  dbFraction,
  dbText,
  deviceCount,
  type KeySegment,
  keyChangeWords,
  keyPlanSentence,
  keySegmentAt,
  keySegmentName,
  keySegments,
  keyStripKey,
  keyStripSpan,
  listWords,
  loudnessSentence,
  nowPlayingText,
  playerKey,
  playFraction,
  reductionText,
  shortChange,
  shortKeyName,
} from "./model-w6.ts";

describe("key strip", () => {
  // C7's shape: 32 bars in C, the last chorus lifted a whole step for 8 bars (the grader's 1-based spans).
  const spans = [
    { fromBar: 1, toBar: 32, text: "C major" },
    { fromBar: 33, toBar: 40, text: "D major", change: "+2: up a whole step" },
  ];

  test("1-based inclusive spans become 0-based segments, each running to the next", () => {
    expect(keySegments(spans)).toEqual([
      { id: "k1", text: "C major", startBar: 0, bars: 32, change: null, sounding: null },
      { id: "k33", text: "D major", startBar: 32, bars: 8, change: "+2: up a whole step", sounding: null },
    ]);
  });

  test("an event-based span that stops early still holds its key to the change, and the last to the end", () => {
    const segs = keySegments(
      [
        { fromBar: 1, toBar: 14, text: "F major" },
        { fromBar: 17, toBar: 20, text: "G major", change: "+2: up a whole step" },
      ],
      { totalBars: 24 },
    );
    expect(segs.map((s) => [s.startBar, s.bars])).toEqual([
      [0, 16],
      [16, 8],
    ]);
    expect(keyStripSpan(segs)).toBe(24);
  });

  test("with a pickup the pickup bar is index 0 and bar 1 is index 1", () => {
    const segs = keySegments(
      [
        { fromBar: 0, toBar: 8, text: "G major" },
        { fromBar: 9, toBar: 16, text: "E minor", change: "the relative key" },
      ],
      { pickup: true },
    );
    expect(segs.map((s) => [s.startBar, s.bars])).toEqual([
      [0, 9],
      [9, 8],
    ]);
    expect(keySegmentName(segs[0] as KeySegment, true)).toBe("G major, the pickup and bars 1–8");
    expect(keySegmentName(segs[1] as KeySegment, true)).toBe("E minor, bars 9–16, the relative key");
    expect(keyPlanSentence(segs, true)).toBe("G major, then E minor from bar 9 (the relative key)");
  });

  test("spans given out of order come out in bar order; the first never carries a change", () => {
    const segs = keySegments([
      { fromBar: 9, toBar: 16, text: "D major", change: "+2: up a whole step" },
      { fromBar: 1, toBar: 8, text: "C major", change: "ignored" },
    ]);
    expect(segs.map((s) => s.text)).toEqual(["C major", "D major"]);
    expect(segs[0]?.change).toBeNull();
  });

  test("names, the plan sentence and the segment in force", () => {
    const segs = keySegments(spans);
    expect(keySegmentName(segs[1] as KeySegment, false, true)).toBe(
      "D major, bars 33–40, +2: up a whole step, playing now",
    );
    expect(keySegmentName({ ...(segs[1] as KeySegment), sounding: "E major" })).toBe(
      "D major, bars 33–40, +2: up a whole step, sounding E major",
    );
    expect(keyPlanSentence(segs)).toBe("C major, then D major from bar 33 (+2: up a whole step)");
    expect(keyPlanSentence(segs.slice(0, 1))).toBe("C major throughout");
    expect(keyPlanSentence([])).toBe("");
    expect(keySegmentAt(segs, 31)).toBe(0);
    expect(keySegmentAt(segs, 32)).toBe(1);
    expect(keySegmentAt(segs, 40)).toBe(-1);
    expect(keySegmentAt(segs, null)).toBe(-1);
  });

  test("three keys: a bridge away and back", () => {
    const segs = keySegments([
      { fromBar: 1, toBar: 16, text: "C major" },
      { fromBar: 17, toBar: 24, text: "G major", change: "a fifth up" },
      { fromBar: 25, toBar: 32, text: "C major", change: "a fifth down" },
    ]);
    expect(keyPlanSentence(segs)).toBe(
      "C major, then G major from bar 17 (a fifth up), then C major from bar 25 (a fifth down)",
    );
  });

  test("a change in words, from the distance @oak/theory measures", () => {
    const d = (from: [string, "major" | "minor"], to: [string, "major" | "minor"]) =>
      keyChangeWords(
        keyDistance({ tonic: from[0], mode: from[1] } as KeySpec, { tonic: to[0], mode: to[1] } as KeySpec),
      );
    expect(d(["C", "major"], ["D", "major"])).toBe("+2: up a whole step");
    expect(d(["C", "major"], ["Db", "major"])).toBe("+1: up a half step");
    expect(d(["D", "major"], ["C", "major"])).toBe("−2: down a whole step");
    expect(d(["C", "major"], ["G", "major"])).toBe("a fifth up");
    expect(d(["C", "major"], ["F", "major"])).toBe("a fourth up");
    expect(d(["C", "major"], ["A", "minor"])).toBe("the relative key");
    expect(d(["C", "major"], ["C", "minor"])).toBe("same home, other mode");
    expect(d(["C", "major"], ["Eb", "major"])).toBe("+3 half steps");
    expect(d(["C", "major"], ["Ab", "major"])).toBe("−4 half steps");
    // A move down is never printed as a large move up.
    expect(keyChangeWords({ semitones: 10, relation: "other" })).toBe("−2 half steps");
  });

  test("a narrow segment prints the key short and the change as its figure", () => {
    expect(shortKeyName("D major")).toBe("D");
    expect(shortKeyName("E minor")).toBe("Em");
    expect(shortKeyName("D♭ major")).toBe("D♭");
    expect(shortKeyName("G Mixolydian")).toBe("G Mix");
    expect(shortKeyName("D Dorian")).toBe("D Dor");
    expect(shortKeyName("C")).toBe("C");
    expect(shortChange("+2: up a whole step")).toBe("+2");
    expect(shortChange("−2: down a whole step")).toBe("−2");
    expect(shortChange("the relative key")).toBe("the relative key");
    expect(shortChange("a fifth up")).toBe("a fifth up");
  });

  test("keys: arrows move and clamp, Home and End, Enter and Space pick, modified keys are not the strip's", () => {
    expect(keyStripKey({ key: "ArrowRight" }, 0, 3)).toEqual({ kind: "move", index: 1 });
    expect(keyStripKey({ key: "ArrowRight" }, 2, 3)).toEqual({ kind: "move", index: 2 });
    expect(keyStripKey({ key: "ArrowLeft" }, 0, 3)).toEqual({ kind: "move", index: 0 });
    expect(keyStripKey({ key: "End" }, 0, 3)).toEqual({ kind: "move", index: 2 });
    expect(keyStripKey({ key: "Home" }, 2, 3)).toEqual({ kind: "move", index: 0 });
    expect(keyStripKey({ key: "Enter" }, 1, 3)).toEqual({ kind: "pick", index: 1 });
    expect(keyStripKey({ key: " " }, 1, 3)).toEqual({ kind: "pick", index: 1 });
    expect(keyStripKey({ key: "ArrowRight", metaKey: true }, 0, 3)).toBeNull();
    expect(keyStripKey({ key: "x" }, 0, 3)).toBeNull();
    expect(keyStripKey({ key: "Enter" }, 0, 0)).toBeNull();
  });
});

describe("device counter", () => {
  const rows = (n: number, total = 6) => Array.from({ length: total }, (_, i) => ({ found: i < n }));

  test("short of the need: the count names the need; met: it does not", () => {
    expect(deviceCount(rows(3), 4)).toMatchObject({
      found: 3,
      total: 6,
      need: 4,
      met: false,
      text: "3 of 6 · 4 needed",
      spoken: "3 of 6 found, 4 needed",
    });
    expect(deviceCount(rows(4), 4)).toMatchObject({ met: true, text: "4 of 6" });
    expect(deviceCount(rows(6), 4).spoken).toBe("6 of 6 found, 4 needed: met");
  });

  test("without a need it only counts; a need above the total is the total", () => {
    expect(deviceCount(rows(2, 3))).toMatchObject({
      need: null,
      met: true,
      text: "2 of 3",
      spoken: "2 of 3 found",
    });
    expect(deviceCount(rows(2, 3), 9)).toMatchObject({ need: 3, met: false, text: "2 of 3 · 3 needed" });
    expect(deviceCount([], 4)).toMatchObject({ found: 0, total: 0, need: 0, met: true, text: "0 of 0" });
  });

  test("where a device is: one bar, two, and many", () => {
    expect(barsListText([])).toBe("");
    expect(barsListText([11])).toBe("bar 11");
    expect(barsListText([27, 11])).toBe("bars 11 and 27");
    expect(barsListText([4, 8, 12])).toBe("bars 4, 8 and 12");
    expect(barsListText([4, 8, 12, 16, 20, 24])).toBe("bars 4, 8, 12 and 3 more");
    expect(barsListText([4, 4, 8])).toBe("bars 4 and 8");
  });
});

describe("loudness read-out", () => {
  test("levels print exactly as @oak/audio's master meter prints them", () => {
    for (const db of [-14.24, -4, -0.04, 0, 0.5, -70, Number.NEGATIVE_INFINITY])
      expect(dbText(db)).toBe(levelText(db));
    expect(dbText(-14.24)).toBe("−14.2 dB");
    expect(dbText(Number.NEGATIVE_INFINITY)).toBe("silent");
    expect(dbText(null)).toBe("—");
    expect(dbText(Number.NaN)).toBe("—");
  });

  test("a reduction is an amount, never signed", () => {
    expect(reductionText(0)).toBe("0.0 dB");
    expect(reductionText(2.44)).toBe("2.4 dB");
    expect(reductionText(-2.44)).toBe("2.4 dB");
    expect(reductionText(null)).toBe("—");
  });

  test("the scale: floor is empty, full scale is full, silence is empty, over full scale stays full", () => {
    expect(dbFraction(-48)).toBe(0);
    expect(dbFraction(0)).toBe(1);
    expect(dbFraction(-24)).toBe(0.5);
    expect(dbFraction(-3)).toBeCloseTo(0.9375, 6);
    expect(dbFraction(3)).toBe(1);
    expect(dbFraction(-90)).toBe(0);
    expect(dbFraction(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(dbFraction(null)).toBe(0);
    expect(dbFraction(-6, -12, 0)).toBe(0.5);
  });

  test("the sentence says what was measured and what the limiter did, without judgment", () => {
    expect(loudnessSentence({ peakDb: null })).toBe("Nothing measured yet");
    expect(loudnessSentence({ peakDb: Number.NEGATIVE_INFINITY })).toBe("Nothing measured yet");
    expect(loudnessSentence({ peakDb: -4.2 })).toBe("Loudest moment −4.2 dB before the limiter.");
    expect(loudnessSentence({ peakDb: -4.2, reductionDb: 0, limiter: "resting" })).toBe(
      "Loudest moment −4.2 dB before the limiter; limiter resting.",
    );
    expect(loudnessSentence({ peakDb: -1.1, reductionDb: 1.8, limiter: "touching" })).toBe(
      "Loudest moment −1.1 dB before the limiter; limiter catching the loudest hits, up to 1.8 dB off.",
    );
    expect(loudnessSentence({ peakDb: 2, reductionDb: 5.26, limiter: "working" })).toBe(
      "Loudest moment +2.0 dB before the limiter; limiter working most of the time, up to 5.3 dB off.",
    );
  });
});

describe("album player bar", () => {
  test("now playing reads as the ending's spec has it", () => {
    expect(
      nowPlayingText({ index: 3, total: 12, title: "Four-Chord Song", elapsedS: 42.7, durationS: 96 }),
    ).toBe("3 of 12 · Four-Chord Song · 0:42 / 1:36");
    expect(nowPlayingText({ index: 1, total: 12, title: "Intro", elapsedS: 5, durationS: null })).toBe(
      "1 of 12 · Intro · 0:05",
    );
    expect(nowPlayingText({ index: null, total: 12, title: null, elapsedS: 0, durationS: null })).toBe("");
  });

  test("progress is clamped and zero without a length", () => {
    expect(playFraction(48, 96)).toBe(0.5);
    expect(playFraction(120, 96)).toBe(1);
    expect(playFraction(-1, 96)).toBe(0);
    expect(playFraction(10, null)).toBe(0);
    expect(playFraction(10, 0)).toBe(0);
  });

  test("keys on the bar: Space toggles, arrows change track, Escape stops only while playing", () => {
    expect(playerKey({ key: " " }, false)).toBe("toggle");
    expect(playerKey({ key: "ArrowRight" }, true)).toBe("next");
    expect(playerKey({ key: "ArrowLeft" }, true)).toBe("prev");
    expect(playerKey({ key: "Escape" }, true)).toBe("stop");
    expect(playerKey({ key: "Escape" }, false)).toBeNull();
    expect(playerKey({ key: " ", shiftKey: true }, false)).toBeNull();
    expect(playerKey({ key: "ArrowRight", metaKey: true }, true)).toBeNull();
    expect(playerKey({ key: "Enter" }, true)).toBeNull();
  });
});

describe("branch card", () => {
  test("a track is ready only when it has a lesson to start", () => {
    expect(branchState({ status: "locked", next: null })).toBe("locked");
    expect(branchState({ status: "open", next: null })).toBe("open");
    expect(branchState({ status: "open", next: "J1.L01" })).toBe("ready");
    // A locked track never reads as ready, whatever else it carries.
    expect(branchState({ status: "locked", next: "J1.L01" })).toBe("locked");
  });

  test("the summary is the title, the state in words and the server's note", () => {
    expect(branchSummary("Jazz Harmony", "open", "Its first lessons are still being written.")).toBe(
      "Jazz Harmony: open. Its first lessons are still being written.",
    );
    expect(branchSummary("Advanced Rhythm", "locked", "Opens with the unit 13 checkpoint.")).toBe(
      "Advanced Rhythm: not open yet. Opens with the unit 13 checkpoint.",
    );
    expect(branchSummary("Jazz Harmony", "ready", "")).toBe("Jazz Harmony: open.");
  });

  test("the note drops the state word the chip already says", () => {
    expect(branchNote("open", "Open. Its first lessons are still being written.")).toBe(
      "Its first lessons are still being written.",
    );
    expect(branchNote("ready", "Next: J1.L01 Swing Feel & the Ride.")).toBe(
      "Next: J1.L01 Swing Feel & the Ride.",
    );
    expect(branchNote("locked", "Opens with the unit 13 checkpoint.")).toBe(
      "Opens with the unit 13 checkpoint.",
    );
    expect(branchSummary("Jazz Harmony", "open", "Open. Its first lessons are still being written.")).toBe(
      "Jazz Harmony: open. Its first lessons are still being written.",
    );
  });

  test("lists read as words", () => {
    expect(listWords([])).toBe("");
    expect(listWords(["Jazz Harmony"])).toBe("Jazz Harmony");
    expect(listWords(["Jazz Harmony", "Advanced Rhythm"])).toBe("Jazz Harmony and Advanced Rhythm");
    expect(listWords(["A", "B", "C"])).toBe("A, B and C");
  });
});
