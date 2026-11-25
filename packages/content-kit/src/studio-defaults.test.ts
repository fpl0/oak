// Oak 2.0 W3 stage 0: Oak's defaults and the verdict-word check, moved here from the app (names and values
// unchanged). The habits mirror reads `OAK_DEFAULTS` as Oak's, never as the learner's (PLAN §2).
import { describe, expect, test } from "bun:test";
import {
  BLANK_CODE,
  DEFAULT_KEY,
  isDescriptive,
  OAK_DEFAULTS,
  OAK_START_NOTES,
  OVER_BAND_CODE,
  OVER_BAND_CODE_3_4,
  PLAIN_SOUNDS,
  START_LINES,
  STUDIO_CARD_KINDS,
  VERDICT_WORDS,
} from "./index.ts";

describe("OAK_DEFAULTS", () => {
  test("90 BPM, 4/4, C major", () => {
    expect(OAK_DEFAULTS.bpm).toBe(90);
    expect(OAK_DEFAULTS.meter).toBe("4/4");
    expect(OAK_DEFAULTS.key).toEqual({ tonic: "C", mode: "major" });
    expect(OAK_DEFAULTS.key).toBe(DEFAULT_KEY);
  });

  test("lines are every line Oak's starts write, trimmed, once each, in W1's order", () => {
    // Written with PLAIN_SOUNDS interpolated, never the sound names as literals (W2 swaps them).
    expect(OAK_DEFAULTS.lines).toEqual([
      "setcpm(90/4)",
      "// Your first part goes here: a name, a colon, then a pattern.",
      'hats: s("hh*8")',
      "setcpm(108/3)",
      'hats: s("hh*6")',
      "// Drums first, then a bass that fits them; the rest comes later.",
      "// Plain sounds on purpose: make the sounds yours later.",
      'drums: s("~")',
      `bass: note("~").s("${PLAIN_SOUNDS.bass}")`,
      `chords: note("~").s("${PLAIN_SOUNDS.chords}")`,
      `mel: note("~").s("${PLAIN_SOUNDS.tune}")`,
    ]);
  });

  test("built from the starts' code", () => {
    for (const code of [BLANK_CODE, OVER_BAND_CODE, OVER_BAND_CODE_3_4, ...Object.values(START_LINES)])
      for (const line of code.split("\n").map((l) => l.trim()))
        if (line) expect(OAK_DEFAULTS.lines).toContain(line);
  });
});

describe("OAK_START_NOTES", () => {
  test("a learning kit and a toolbox demo", () => {
    expect(OAK_START_NOTES).toEqual(["From the learning kit ", "From the toolbox: "]);
  });
});

describe("isDescriptive (moved from the app)", () => {
  test("describes, never judges", () => {
    expect(isDescriptive("hh plays in drums.")).toBe(true);
    expect(isDescriptive("You should add hats")).toBe(false);
    expect(isDescriptive("100% of your sketches")).toBe(false);
    expect(isDescriptive("✓ drums")).toBe(false);
    expect(VERDICT_WORDS.test("missing")).toBe(true);
  });
});

describe("Studio card kinds", () => {
  test("the five kinds, distinct from the SRS card kinds", () => {
    expect(STUDIO_CARD_KINDS).toEqual(["constraint", "avoid", "amateur", "tempo", "focus"]);
  });
});
