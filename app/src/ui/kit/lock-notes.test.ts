// One wording for every lock note (shared decision 5): where something opens, in words, never an id alone.
import { describe, expect, test } from "bun:test";
import {
  checkpointWords,
  lessonWords,
  opensWithCheckpoint,
  opensWithNote,
  requirementWords,
  unitWords,
  waitsForNote,
} from "./lock-notes.ts";

describe("lock notes", () => {
  test("a lesson by its title; without one, its place in a core unit, else a later lesson", () => {
    expect(opensWithNote(lessonWords("J2.L03", "Extensions"))).toBe("Opens with the lesson “Extensions”.");
    expect(lessonWords("U03.L02", null)).toBe("lesson 2 of unit 3");
    expect(lessonWords("J2.L03", null)).toBe("a later lesson");
  });
  test("a core unit by its number and title", () => {
    expect(opensWithNote(unitWords("U09", "Form"))).toBe("Opens with unit 9, Form.");
    expect(unitWords("U09")).toBe("unit 9");
    expect(unitWords("J2", "Extended Harmony")).toBe("the unit “Extended Harmony”");
  });
  test("a checkpoint: a core one by its unit, a track's by its title", () => {
    expect(opensWithCheckpoint("U13.CP")).toBe("Opens with the unit 13 checkpoint.");
    expect(checkpointWords("J.CP1", "Jazz checkpoint 1")).toBe("Jazz checkpoint 1");
    expect(checkpointWords("J.CP1")).toBe("its checkpoint");
  });
  test("what a waiting track waits for, from the gate's requirement", () => {
    expect(waitsForNote({ ref: "U13.CP", kind: "checkpoint" })).toBe("Waits for the unit 13 checkpoint.");
    expect(waitsForNote({ ref: "U03.L02", kind: "lesson" })).toBe("Waits for lesson 2 of unit 3.");
    expect(requirementWords({ ref: "U15.L06", kind: "lesson" }, "Tritone Substitution")).toBe(
      "the lesson “Tritone Substitution”",
    );
  });
  test("no id ever stands in the words", () => {
    const all = [
      lessonWords("J2.L03", null),
      lessonWords("U03.L02", null),
      unitWords("U09", "Form"),
      checkpointWords("U13.CP"),
      waitsForNote({ ref: "U14.CP", kind: "checkpoint" }),
    ];
    for (const s of all) expect(s).not.toMatch(/\b[A-Z]{1,2}\d+\.(L|CP|S)\d*\b|\bU\d+\b/);
  });
});
