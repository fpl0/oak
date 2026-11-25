import { describe, expect, test } from "bun:test";
import { type CardCheck, isDescriptive, STUDIO_CARD_KINDS } from "@oak/content-kit";
import { units } from "../syllabus.ts";
import { toolboxById } from "../toolbox.ts";
import { STUDIO_CARDS } from "./cards.ts";

describe("Studio deck", () => {
  test("AC1 exact ordered deck, kinds, unlocks, sources and checks", () => {
    const rows: [string, string, string, string, CardCheck | null][] = [
      ["one-part-today", "focus", "U00.L01", "One Part at a Time", { kind: "parts" }],
      ["short-loop", "constraint", "U00.L01", "Arbitrary Constraints", null],
      ["new-tempo", "tempo", "U01.L01", "Choosing a Tempo", { kind: "tempo" }],
      ["drums-last", "constraint", "U01.L03", "Arbitrary Constraints", { kind: "parts" }],
      ["no-kick-on-one", "avoid", "U01.L03", "Arbitrary Constraints", null],
      [
        "no-hats",
        "avoid",
        "U01.L04",
        "Arbitrary Constraints",
        { kind: "sounds", sounds: ["hh", "oh"], role: "drums" },
      ],
      ["three-notes", "constraint", "U02.L02", "Arbitrary Constraints", { kind: "range", role: "tune" }],
      ["low-tune", "constraint", "U02.L02", "Arbitrary Constraints", { kind: "range", role: "tune" }],
      ["one-sound", "constraint", "U02.L06", "Arbitrary Constraints", { kind: "sounds", sounds: [] }],
      [
        "no-reverb",
        "avoid",
        "U02.L08",
        "Arbitrary Constraints",
        { kind: "tools", tools: [{ id: "tb.room", label: ".room()" }] },
      ],
      ["no-chords", "constraint", "U05.L01", "Arbitrary Constraints", { kind: "parts" }],
      ["minor", "constraint", "U05.L02", "Arbitrary Constraints", null],
      ["no-four-chord", "avoid", "U06.L02", "Arbitrary Constraints", { kind: "numerals" }],
      ["wrong-tool", "constraint", "U07.L02", "Misusing Rhythmic Tools", null],
      ["ending-first", "constraint", "U09.L05", "Arbitrary Constraints", null],
    ];
    expect(STUDIO_CARDS.map((card) => card.id)).toEqual(rows.map(([slug]) => `card.${slug}`));
    expect(new Set(STUDIO_CARDS.map((card) => card.id)).size).toBe(15);
    for (const [i, card] of STUDIO_CARDS.entries()) {
      const row = rows[i];
      expect(row).toBeDefined();
      if (!row) throw new Error("Deck row absent");
      expect(card.id).toMatch(/^card\.[a-z0-9-]+$/);
      expect(STUDIO_CARD_KINDS).toContain(card.kind);
      expect([card.kind, card.unlock, card.source, card.check ?? null]).toEqual(row.slice(1));
      expect("check" in card).toBe(row[4] !== null);
    }
  });

  // W5 S10: the book's Avoidance List comes from the learner's own repeats (p. 20), so it names only the habits
  // mirror's `habit.*` cards; a ban Oak draws at random is an Arbitrary Constraint (p. 34).
  test("no preset card claims the Avoidance List", () => {
    expect(STUDIO_CARDS.filter((card) => card.source === "Avoidance List").map((card) => card.id)).toEqual(
      [],
    );
  });

  test("AC2 unlocks exist, including a nonexistent-lesson pin", () => {
    const lessons = new Set<string>(units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)));
    for (const card of STUDIO_CARDS) expect(lessons.has(card.unlock)).toBe(true);
    expect(lessons.has("U99.L99")).toBe(false);
  });

  test("AC3 descriptive copy and avoidance alternatives, including a verdict pin", () => {
    for (const card of STUDIO_CARDS) {
      if (card.kind === "avoid") expect(card.instead?.startsWith("Instead, try")).toBe(true);
      else expect("instead" in card).toBe(false);
      for (const text of [card.text, card.instead, card.source]) {
        if (text === undefined) continue;
        expect(isDescriptive(text)).toBe(true);
        expect(text).not.toMatch(/\b(?:must|should)\b/i);
        expect(text).not.toMatch(/[%✓✗]/);
      }
    }
    expect(isDescriptive("You should add hats.")).toBe(false);
  });

  test("AC4 tool ids exist, including a nonexistent-tool pin", () => {
    for (const card of STUDIO_CARDS) {
      if (card.check?.kind === "tools") {
        for (const tool of card.check.tools) expect(toolboxById.has(tool.id)).toBe(true);
      }
    }
    expect(toolboxById.has("tb.nope")).toBe(false);
  });
});
