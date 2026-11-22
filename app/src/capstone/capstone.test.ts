// The capstone's pure logic against the real grader and headless Strudel: the piece's length and analysis,
// bar anchors for unmet rules, the living checklist, going past the brief, liner notes and theory tags.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { anchorFor, anchorsOf, anchorText, spanOf } from "./anchors.ts";
import { beyondBrief, checklistOf, labelRuns, readiness } from "./checklist.ts";
import { clock, composeLinerNotes, hasPitches, theoryTags } from "./piece.ts";
import { analysePiece, capstone, gradePiece, testPiece } from "./test-support.ts";

setDefaultTimeout(60_000);

const FOUR_BAR_FILL = "four bars, tom fill in bar 4";
const EIGHT_BAR = "eight bars, sixteenth hats, crash and fill";

describe("the analysed piece", () => {
  test("a C0 intro is as long as its period, not the 64 bars capstone mode queries", async () => {
    const four = await analysePiece("C0", testPiece("C0", FOUR_BAR_FILL));
    expect(four.bars).toBe(4);
    expect(four.analysis.bars).toBe(4);
    // 4 bars of 4/4 at 100 BPM: 16 beats = 9.6 s, computed from the AST/period, never played.
    expect(four.analysis.durationSec).toBeCloseTo(9.6, 1);
    const eight = await analysePiece("C0", testPiece("C0", EIGHT_BAR));
    expect(eight.bars).toBe(8);
    expect(eight.n.all.every((e) => e.onset[0] / e.onset[1] < 8)).toBe(true);
  });

  test("a drum piece has no key; a C1 loop is read in C", async () => {
    const drums = await analysePiece("C0", testPiece("C0", FOUR_BAR_FILL));
    expect(hasPitches(drums.n)).toBe(false);
    expect(drums.analysis.key).toEqual([]);
    const loop = await analysePiece("C1", testPiece("C1", "four bars, riff answers itself"));
    expect(loop.bars).toBe(4);
    expect(loop.analysis.key[0]?.key).toEqual({ tonic: "C", mode: "major" });
    expect(loop.analysis.roles).toMatchObject({ bass: "bass", melody: "mel" });
  });
});

describe("bar anchors", () => {
  test("a missing backbeat is anchored to bars 1–3, where the brief asks for it", async () => {
    const code = testPiece("C0", "no backbeat");
    const result = await gradePiece("C0", code);
    const { n, bars } = await analysePiece("C0", code);
    const rule = capstone("C0").brief?.rubric.find((r) => r.id === "snare-backbeat");
    expect(result.rubric?.find((r) => r.ruleId === "snare-backbeat")?.ok).toBe(false);
    if (!rule) throw new Error("rule");
    const a = anchorFor(rule, n, bars);
    expect(a).toEqual({ from: 1, to: 3 });
    expect(anchorText(a as NonNullable<typeof a>)).toBe("Bars 1–3");
  });

  test("a one-bar starter is anchored to the bars it still needs", async () => {
    const c0 = capstone("C0");
    const code = c0.brief?.code.starter as string;
    const result = await gradePiece("C0", code);
    const { n, bars } = await analysePiece("C0", code);
    const unmet = new Set((result.rubric ?? []).filter((r) => !r.ok).map((r) => r.ruleId));
    expect([...unmet].sort()).toEqual(["fill", "meter"]);
    const anchors = anchorsOf(c0.brief?.rubric ?? [], unmet, n, bars);
    expect(anchors.meter).toEqual({ from: 2, to: 4 });
    // A tool the piece must use is about the whole piece: no bar to point at.
    expect(anchors.fill).toBeNull();
    expect(anchors.tempo).toBeNull();
  });

  test("a bass above C3 is anchored to the bars that hold the high notes", async () => {
    const code = testPiece("C1", "bass too high");
    const { n, bars } = await analysePiece("C1", code);
    const rule = capstone("C1").brief?.rubric.find((r) => r.id === "bass-range");
    if (!rule) throw new Error("rule");
    // note("<c3 e3 g3 e3>"): e3 sits in bars 2 and 4, g3 in bar 3; c3 is the top of the range and passes.
    expect(anchorFor(rule, n, bars)).toEqual({ from: 2, to: 4 });
  });

  test("spanOf", () => {
    expect(spanOf([])).toBeNull();
    expect(spanOf([3, 1, 2])).toEqual({ from: 1, to: 3 });
    expect(anchorText({ from: 4, to: 4 })).toBe("Bar 4");
  });
});

describe("the living checklist", () => {
  test("rows follow the rubric; open rows carry the rubric's detail and the anchor", async () => {
    const c0 = capstone("C0");
    const rules = c0.brief?.rubric ?? [];
    const code = testPiece("C0", "no backbeat");
    const result = await gradePiece("C0", code);
    const rows = checklistOf(rules, result, { "snare-backbeat": { from: 1, to: 3 } }, ["fill"]);
    expect(rows.map((r) => r.id)).toEqual(rules.map((r) => r.id));
    const snare = rows.find((r) => r.id === "snare-backbeat");
    expect(snare).toMatchObject({ state: "open", required: true, anchor: { from: 1, to: 3 } });
    expect(snare?.detail).toBe("the hits are not where this asks yet");
    expect(rows.find((r) => r.id === "tempo")).toMatchObject({ state: "met", anchor: null, detail: null });
    expect(rows.find((r) => r.id === "fill")?.focus).toBe(true);
    expect(readiness(rows)).toEqual({ ready: false, met: 5, required: 6 });
  });

  test("before a check every row is unchecked; an evaluation error checks nothing", () => {
    const rules = capstone("C0").brief?.rubric ?? [];
    expect(checklistOf(rules, null).every((r) => r.state === "unchecked")).toBe(true);
    expect(readiness(checklistOf(rules, null)).ready).toBe(false);
  });

  test("a passing piece is ready; going past the brief is a note, never a failure", async () => {
    const rules = capstone("C0").brief?.rubric ?? [];
    const code = testPiece("C0", EIGHT_BAR);
    const result = await gradePiece("C0", code);
    expect(result.status).toBe("pass");
    expect(readiness(checklistOf(rules, result)).ready).toBe(true);
    const notes = beyondBrief(rules, result, { bars: 8, tracks: 4, bpm: 124 });
    expect(notes).toEqual(["The full 8 bars the brief allows.", "4 parts, where the brief asks for 2."]);
    expect(
      beyondBrief(rules, await gradePiece("C0", testPiece("C0", "no backbeat")), {
        bars: 4,
        tracks: 3,
        bpm: 100,
      }),
    ).toEqual([]);
  });

  test("labels keep their inline code", () => {
    expect(labelRuns("A fill: written with `< >`")).toEqual([
      { code: false, text: "A fill: written with " },
      { code: true, text: "< >" },
    ]);
  });
});

describe("liner notes and theory tags", () => {
  test("the notes list the piece, the rules met and the can-do; no key for a drum intro", async () => {
    const code = testPiece("C0", FOUR_BAR_FILL);
    const result = await gradePiece("C0", code);
    const { analysis } = await analysePiece("C0", code);
    const notes = composeLinerNotes({
      analysis,
      result,
      learnerLine: "A straight intro that turns over in bar 4.",
      canDos: ["I can write a drum intro with a fill."],
    });
    expect(notes.split("\n")[0]).toBe("A straight intro that turns over in bar 4.");
    expect(notes).toContain("4 bars at 100 BPM (0:10).");
    expect(notes).not.toContain("major");
    expect(notes).toContain("Snare on beats 2 and 4 in bars 1 to 3");
    expect(notes).toContain("- I can write a drum intro with a fill.");
  });

  test("tags name the skills behind the met rules, without repeats", async () => {
    const c0 = capstone("C0");
    const code = testPiece("C0", FOUR_BAR_FILL);
    const result = await gradePiece("C0", code);
    const names: Record<string, string> = {
      R02: "Tempo / BPM",
      R03: "Meter 4/4",
      R04: "Backbeat",
      R05: "Eighths",
      R07: "Sixteenths",
    };
    const tags = theoryTags(c0.brief?.rubric ?? [], result, null, (id) => names[id] ?? null);
    expect(tags).toEqual(["Meter 4/4", "Backbeat", "Eighths", "Sixteenths", "Tempo / BPM"]);
  });

  test("a schema is tagged by its title, never by its ID", () => {
    const analysis = { schemas: [{ schema: "schema.axis" }], devices: [] } as never;
    const tags = theoryTags([], { rubric: [] } as never, analysis, () => null);
    expect(tags).toEqual(["Four-chord (I–V–vi–IV)"]);
  });

  test("clock", () => {
    expect(clock(9.6)).toBe("0:10");
    expect(clock(125)).toBe("2:05");
  });
});

describe("the Band layer", () => {
  test("the Band plays only what the brief leaves to the learner", async () => {
    const { bandTracksFor, bandSetupFor } = await import("./content.ts");
    const { bands } = await import("../../../content/bands/index.ts");
    expect(bandTracksFor(capstone("C0"))).toEqual(["bass", "chords"]);
    expect(bandTracksFor(capstone("C1"))).toEqual(["chords"]);
    const setup = bandSetupFor(capstone("C1"), "flavour.jazz-soul", bands, { tonic: "C", mode: "major" });
    expect(setup).toMatchObject({ band: "band.axis-4bar", flavour: "flavour.jazz-soul", tracks: ["chords"] });
    expect(setup?.code).toContain('.scale("C4:major")');
    expect(setup?.code).not.toContain("{{key}}");
  });
});
