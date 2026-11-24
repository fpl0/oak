import { describe, expect, test } from "bun:test";
import type { Exercise, GradeResult } from "@oak/api";
import type { AnswerSpec } from "../answers/types.ts";
import { collapseRepeats, issueLines, revealValue, summaryOf, viewFor } from "./feedback.ts";

const result = (status: GradeResult["status"], ids: string[]): GradeResult =>
  ({
    status,
    score: 0,
    dims: {},
    diagnostics: ids.map((id) => ({ id, severity: "error", params: {} })),
    messages: [],
  }) as unknown as GradeResult;

describe("summaryOf", () => {
  const render = () => "";
  test("a locked tool in a code step leads the verdict, before the notes that differ", () => {
    const r = {
      ...result("fail", ["code.locked-tool", "melody.wrong-degree"]),
      overlay: undefined,
    } as GradeResult;
    const said = (d: { id: string }) =>
      d.id === "code.locked-tool" ? "`.voicing()` opens in U05.L08." : "x";
    const line = summaryOf(viewFor(r, 0, false, said as never), r, { kind: "code" });
    expect(line).toBe("`.voicing()` opens in U05.L08.");
    // Also when the locked tool stopped the code from running.
    const e = result("error", ["code.locked-tool", "eval.runtime"]);
    expect(summaryOf(viewFor(e, 0, false, said as never), e, { kind: "code" })).toBe(
      "`.voicing()` opens in U05.L08.",
    );
  });
  test("one wrong slot of a slotted answer is named (a function strip, numerals per bar)", () => {
    const r = {
      ...result("fail", []),
      diagnostics: [{ id: "id.wrong", severity: "error", params: {}, where: { slot: 3 } }],
    } as unknown as GradeResult;
    const line = summaryOf(
      viewFor(r, 0, false, () => ""),
      r,
      { kind: "answer", listen: true, slotted: true },
    );
    expect(line).toBe("Answer 3 is not right yet.");
    // Numerals a bar (the RN palette): the slot is named as its label reads, "bar 3" (review:journey).
    expect(
      summaryOf(
        viewFor(r, 0, false, () => ""),
        r,
        {
          kind: "answer",
          listen: false,
          slotted: true,
          slotNoun: "bar",
        },
      ),
    ).toBe("Bar 3 is not right yet.");
  });
  test("chord() locked is said once, not once per chord name", () => {
    const r = result("error", ["code.locked-tool", "code.locked-chord", "code.locked-chord"]);
    const said = (d: { id: string }) =>
      d.id === "code.locked-tool" ? "`chord` unlocks in the lesson “Let Strudel Voice It”." : "C";
    const lines = issueLines(viewFor(r, 0, false, said as never), { kind: "code" });
    expect(lines.map((l) => l.what)).toEqual(["`chord` unlocks in the lesson “Let Strudel Voice It”."]);
  });
  test("a sung take with no voice says so, not 'Code didn't run.'", () => {
    const r = result("error", ["sing.no-voice"]);
    const line = summaryOf(viewFor(r, 0, false, render), r);
    expect(line).toContain("didn't hear a voice");
    expect(line).not.toContain("Code");
  });
  test("a sung attempt Oak could not follow says 'your singing', never 'take'", () => {
    const r = result("error", ["sing.pitch-lost"]);
    const line = summaryOf(viewFor(r, 0, false, render), r);
    expect(line).toBe("Oak couldn't follow your singing. Sing it again, one steady note at a time.");
  });
  test("mic bleed and missed taps get their own lines", () => {
    const b = result("error", ["sing.bleed"]);
    expect(summaryOf(viewFor(b, 0, false, render), b)).toContain("headphones");
    const t = result("error", ["tap.missed"]);
    expect(summaryOf(viewFor(t, 0, false, render), t)).toContain("taps");
  });
  test("a failed sung take without diagnostics never reads '0 things to look at'", () => {
    const r = { ...result("fail", []), dims: { pitch: { score: 0.2, weight: 1, n: 5 } } } as GradeResult;
    const line = summaryOf(viewFor(r, 0, false, render), r);
    expect(line).not.toMatch(/0 things/);
    expect(line).toContain("mark");
  });
  test("a key signature in the wrong order is not '1 note differs'", () => {
    const r = result("fail", ["keysig.order"]);
    const line = summaryOf(viewFor(r, 0, false, render), r);
    expect(line).not.toMatch(/note/);
    expect(line).toContain("order");
  });
  test("a code step's one non-note finding is said in the verdict, not '1 thing to look at.'", () => {
    const unchanged = (d: { id: string }) =>
      d.id === "code.unchanged" ? "Nothing changed yet. Edit the highlighted part and Check again." : "";
    const r = result("fail", ["code.unchanged"]);
    const line = summaryOf(viewFor(r, 0, false, unchanged), r);
    expect(line).toBe("Nothing changed yet. Edit the highlighted part and Check again.");
    expect(line).not.toMatch(/thing to look at/);
    // Notes that differ keep the count and the bars.
    const notes = {
      ...result("fail", []),
      diagnostics: [
        { id: "melody.wrong-degree", severity: "error", params: {}, where: { bar: 1 }, events: ["e1"] },
      ],
    } as unknown as GradeResult;
    expect(
      summaryOf(
        viewFor(notes, 0, false, () => "Not this degree."),
        notes,
      ),
    ).not.toBe("Not this degree.");
  });
  test("a code error keeps the code line", () => {
    const r = result("error", ["eval.syntax"]);
    expect(summaryOf(viewFor(r, 0, false, render), r)).toBe("Code didn't run.");
  });
});

describe("answers picked, typed and sung are not 'notes that differ'", () => {
  const render = (d: { id: string }) => (d.id === "sing.wrong-degree" ? "Note 2: you sang 1." : "");
  const slotted = (slots: number[], id = "id.wrong") =>
    ({
      status: "fail",
      score: 0,
      dims: {},
      diagnostics: slots.map((slot) => ({ id, severity: "error", params: {}, where: { slot } })),
      messages: [],
    }) as unknown as GradeResult;
  test("one wrong pick of a sound: listen again", () => {
    const r = slotted([1]);
    const line = summaryOf(viewFor(r, 0, false, render), r, { kind: "answer", listen: true });
    expect(line).toBe("Not this one yet. Listen again, then try once more.");
    expect(issueLines(viewFor(r, 0, false, render), { kind: "answer", listen: true })).toEqual([]);
  });
  test("several slots are named, questions as questions", () => {
    const r = slotted([2, 3]);
    expect(summaryOf(viewFor(r, 0, false, render), r, { kind: "answer" })).toBe(
      "Answers 2 and 3 are not right yet.",
    );
    const q = slotted([1]);
    expect(summaryOf(viewFor(q, 0, false, render), q, { kind: "questions" })).toBe(
      "Question 1 is not right yet.",
    );
  });
  test("a sung pattern counts notes and its lines carry no 'Answer n'", () => {
    const r = slotted([3, 2], "sing.wrong-degree");
    const view = viewFor(r, 0, false, render);
    expect(summaryOf(view, r, { kind: "sung" })).toBe("Not there yet: 2 notes to sing again.");
    for (const l of issueLines(view, { kind: "sung" })) expect(l.where).toBe("");
  });
  test("code keeps the notes-and-bars summary", () => {
    const r = slotted([1]);
    expect(summaryOf(viewFor(r, 0, false, render), r)).not.toMatch(/Listen again/);
  });
});

describe("Wave 3 reveals", () => {
  test("a key signature reveals its accidentals in written order", () => {
    const ex = {
      kind: "staff-write",
      answer: { ui: "staff-input", clef: "treble", bars: 1, palette: {}, mode: "key-signature" },
      expect: { e: "key-signature", key: { tonic: "Eb", mode: "major" }, order: "sequence" },
    } as unknown as Exercise;
    expect(revealValue(ex, (ex as { answer: AnswerSpec }).answer, null)).toBe("Bb Eb Ab");
    const d = { ...ex, expect: { e: "key-signature", key: { tonic: "D", mode: "major" } } } as Exercise;
    expect(revealValue(d, (ex as { answer: AnswerSpec }).answer, null)).toBe("F# C#");
  });
});

describe("the same finding said once (Wave 5 taps)", () => {
  test("24 taps between the kicks read as one line with the count; placed lines stay apart", () => {
    const tap = { where: "", what: "A tap landed between the kicks.", fix: null };
    const lines = [
      ...Array.from({ length: 24 }, (_, i) => ({ ...tap, key: `t${i}` })),
      { key: "b2", where: "Bar 2", what: "Late.", fix: null },
      { key: "b3", where: "Bar 3", what: "Late.", fix: null },
    ];
    const out = collapseRepeats(lines, "taps");
    expect(out.map((l) => l.what)).toEqual(["A tap landed between the kicks. (24 taps)", "Late.", "Late."]);
  });
});
