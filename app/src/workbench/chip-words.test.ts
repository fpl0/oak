import { describe, expect, test } from "bun:test";
import { chipName, defaultTrackLabel } from "./chip-words.ts";

describe("chip words", () => {
  test("every chip starts with a capital; Oak's accompaniment says (Oak)", () => {
    expect(defaultTrackLabel("band.bass")).toBe("Bass (Oak)");
    expect(defaultTrackLabel("band.chords")).toBe("Chords (Oak)");
    expect(defaultTrackLabel("drums")).toBe("Drums");
    expect(defaultTrackLabel("mel")).toBe("Mel");
    expect(chipName("")).toBe("");
  });
});
