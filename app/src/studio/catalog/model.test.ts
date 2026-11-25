// Oak 2.0 W3 catalog of attributes (PLAN §4 S6): the sketch written from the six lines, Oak's reading of a unit song
// and when it may show (the learner listens and writes first: W3 Review Focus 4).
import { describe, expect, test } from "bun:test";
import { type AnalysisSummary, CATALOG_LINES, labelledLines } from "@oak/api";
import { isDescriptive } from "../descriptive.ts";
import {
  bpmFromLine,
  CATALOG_WORDS,
  type CatalogLines,
  catalogOfSketch,
  catalogSketchBody,
  cleanLines,
  emptyLines,
  LINE_LABELS,
  LINE_PROMPTS,
  outsideRefId,
  READING_WORDS,
  referenceReading,
  revealed,
  tuneRange,
  visibleCatalogs,
} from "./model.ts";

const LINES: CatalogLines = {
  tempo: "slow, 70s",
  sound: "",
  harmony: "two dark chords",
  melody: "a high tune\nthat falls",
  rhythm: "",
  form: "one loop",
};

/** An analysis with only the fields the reading uses filled in. */
const analysisWith = (rns: string[]): AnalysisSummary => ({
  key: [],
  bpm: 96,
  bars: rns.length,
  durationSec: 10,
  roles: {},
  slots: rns.map((rn, i) => ({ bar: i + 1, beat: 1, symbol: "", rn })),
  schemas: [],
  cadences: [],
  form: "",
  energy: [],
  devices: [],
});

describe("Hide it and write", () => {
  test("the code: the tempo line, the reference, then the six lines in order, and no labelled line", () => {
    const body = catalogSketchBody({
      lines: LINES,
      refTitle: "Rain Song",
      title: "Catalog of Rain Song",
      sessionId: null,
      bpm: 72,
      meter: "4/4",
    });
    expect(body.code.startsWith("setcpm(72/4)")).toBe(true);
    const order = [
      "// Written from my catalog of “Rain Song”",
      "// tempo: slow, 70s",
      "// sound:",
      "// harmony: two dark chords",
      "// melody: a high tune that falls",
      "// rhythm:",
      "// form: one loop",
    ];
    const rows = body.code.split("\n");
    let at = -1;
    for (const line of order) {
      const i = rows.indexOf(line);
      expect({ line, found: i > at }).toEqual({ line, found: true });
      at = i;
    }
    expect(labelledLines(body.code)).toEqual([]);
    expect(body).toMatchObject({
      originKind: "free",
      note: "From my catalog",
      bpm: 72,
      meter: "4/4",
      key: null,
      band: null,
      analysis: null,
    });
  });

  test("lines are folded to one line each and kept to 400 characters", () => {
    const clean = cleanLines({ ...emptyLines(), melody: "a\n  b", form: "x".repeat(450) });
    expect(clean.melody).toBe("a b");
    expect(clean.form.length).toBe(400);
    expect(Object.keys(clean)).toEqual([...CATALOG_LINES]);
  });
});

describe("Oak's reading is hidden until the sketch is written", () => {
  // W5 S9 (Catalog of Attributes pp. 17–18): Oak's reading and the reference wait until the learner has written a
  // part from the lines, not just until the comment-only sketch exists.
  test("revealed only once the sketch has a version after its first with an unmuted part", () => {
    const start = { version: 1, code: "// Tempo: slow\n// Drums: four on the floor" };
    const sk = (...versions: { version: number; code: string }[]) => [{ id: "sk_1", versions }];
    expect(revealed({ sketchId: "sk_1" }, sk(start))).toBe(false);
    expect(
      revealed({ sketchId: "sk_1" }, sk(start, { version: 2, code: '// still thinking\n_drums: s("bd*4")' })),
    ).toBe(false);
    expect(revealed({ sketchId: "sk_1" }, sk(start, { version: 2, code: 'drums: s("bd*4")' }))).toBe(true);
    expect(revealed({ sketchId: "sk_gone" }, [])).toBe(false);
    expect(revealed({ sketchId: null }, sk(start, { version: 2, code: 'drums: s("bd*4")' }))).toBe(false);
  });

  test("catalogOfSketch finds the catalog that names the sketch", () => {
    const base = {
      refKind: "song" as const,
      refId: "usong.U01",
      lines: LINES,
      createdAt: "2026-11-25T10:00:00.000Z",
    };
    const cats = [
      { ...base, id: "cat_2", sketchId: "sk_2" },
      { ...base, id: "cat_1", sketchId: null },
    ];
    expect(catalogOfSketch(cats, "sk_2")?.id).toBe("cat_2");
    expect(catalogOfSketch(cats, "sk_9")).toBeNull();
  });
});

describe("referenceReading", () => {
  const CODE = 'setcpm(96/4)\ndrums: s("bd ~ sd ~").bank("oak909")\nbass: note("a1 ~ e2 ~").s("ebass")';

  test("tempo, sound, harmony and form of a loop", () => {
    const r = referenceReading({ code: CODE, bpm: 96, analysis: analysisWith(["i", "VI", "III", "VII"]) });
    expect(r.tempo).toBe("96 BPM");
    expect(r.sound).toBe("drums: oak909; bass: ebass");
    expect(r.harmony).toBe("i–VI–III–VII");
    expect(r.form).toBe("one loop");
    expect(r.rhythm).toBe("Oak does not put this one into words; listen again.");
    expect(r.melody).toBe(READING_WORDS.noTune);
  });

  test("the tempo comes from the code when no BPM is given; repeated numerals are read once", () => {
    const r = referenceReading({
      code: CODE,
      bpm: null,
      analysis: analysisWith(["i", "i", "VI", "VI", "i"]),
    });
    expect(r.tempo).toBe("96 BPM");
    expect(r.harmony).toBe("i–VI–i");
    const none = referenceReading({ code: 'drums: s("bd")', bpm: null, analysis: null });
    expect(none.tempo).toBe(READING_WORDS.noTempo);
    expect(none.harmony).toBe(READING_WORDS.noChords);
    expect(none.sound).toBe(READING_WORDS.noSounds);
  });

  test("form: the arrange() section names in order, the label prefix dropped", () => {
    const code = [
      'const kickIntro = s("bd ~")',
      'const kickVerse = s("bd bd")',
      'const melVerse = n("0 2").scale("C4:major")',
      "kick: arrange([4, kickIntro], [8, kickVerse], [4, kickIntro]).gain(.5)",
      'mel: arrange([4, silence], [8, melVerse], [4, silence]).s("piano")',
    ].join("\n");
    const r = referenceReading({ code, bpm: 100, analysis: null });
    expect(r.form).toBe("intro, verse, intro");
    expect(r.sound).toBe("mel: piano");
    expect(r.melody).toBe(READING_WORDS.tuneUnread);
  });

  test("melody: the tune's lowest and highest note from a read", () => {
    const events = [
      { track: "mel", midi: 64 },
      { track: "mel", midi: 72 },
      { track: "bass", midi: 36 },
      { track: "band.mel", midi: 90 },
      { track: "drums", midi: null },
    ];
    const tune = tuneRange(events);
    expect(tune).toEqual({ low: 64, high: 72 });
    expect(referenceReading({ code: CODE, bpm: 96, analysis: null, tune }).melody).toBe(
      "The tune goes from E4 up to C5.",
    );
    expect(
      referenceReading({ code: CODE, bpm: 96, analysis: null, tune: { low: 60, high: 60 } }).melody,
    ).toBe("The tune stays on C4.");
    expect(tuneRange([{ track: "bass", midi: 40 }])).toBeNull();
  });

  test("every value only describes", () => {
    const r = referenceReading({ code: CODE, bpm: 96, analysis: analysisWith(["i", "VI", "III", "VII"]) });
    for (const v of Object.values(r)) expect({ v, ok: isDescriptive(v) }).toEqual({ v, ok: true });
  });
});

describe("writing from the lines", () => {
  test("bpmFromLine takes the learner's own number of BPM, 40 to 240, else null", () => {
    expect(bpmFromLine("slow, about 72")).toBe(72);
    expect(bpmFromLine("slow, 70s")).toBe(70);
    expect(bpmFromLine("about 2 times 60")).toBe(60);
    expect(bpmFromLine("fast")).toBeNull();
    expect(bpmFromLine("300 or so")).toBeNull();
  });

  test("a lines-only catalog written from later is left out of the list; others stay", () => {
    const base = { refKind: "song" as const, refId: "usong.U01", lines: LINES };
    const linesOnly = { ...base, id: "cat_1", sketchId: null, createdAt: "2026-11-25T10:00:00.000Z" };
    const written = { ...base, id: "cat_2", sketchId: "sk_1", createdAt: "2026-11-25T11:00:00.000Z" };
    const other = {
      ...base,
      id: "cat_3",
      sketchId: null,
      lines: { ...LINES, tempo: "fast" },
      createdAt: "2026-11-25T09:00:00.000Z",
    };
    expect(visibleCatalogs([written, linesOnly, other]).map((c) => c.id)).toEqual(["cat_2", "cat_3"]);
    expect(visibleCatalogs([linesOnly, other]).map((c) => c.id)).toEqual(["cat_1", "cat_3"]);
  });
});

describe("Outside your lane and words", () => {
  test("the reference is '<style> — <track>', null while either is empty, at most 200 characters", () => {
    expect(outsideRefId(" Reggaeton ", "a track")).toBe("Reggaeton — a track");
    expect(outsideRefId("", "a track")).toBeNull();
    expect(outsideRefId("Cumbia", "  ")).toBeNull();
    expect(outsideRefId("x".repeat(150), "y".repeat(150))?.length).toBe(200);
  });

  test("every string only describes", () => {
    const all: string[] = [
      ...Object.values(READING_WORDS),
      ...Object.values(LINE_LABELS),
      ...Object.values(LINE_PROMPTS),
      ...Object.values(CATALOG_WORDS).flatMap((v) =>
        typeof v === "function"
          ? (["song", "transcription", "audio", "outside"] as const).map((k) =>
              (v as (a: string) => string)(k),
            )
          : [v],
      ),
    ];
    for (const s of all) expect({ s, ok: isDescriptive(s) }).toEqual({ s, ok: true });
    expect(CATALOG_WORDS.outsideIntro).toBe(
      "Pick a style you would never play for yourself and a track its fans love. Listen, then write what they hear in it.",
    );
    expect(CATALOG_WORDS.recordingOnly).toBe(
      "Oak reads chords and form from code only, so here it is just you and the recording.",
    );
  });
});

test("X24 AC24: Outside your lane asks what the learner could use", () => {
  expect(CATALOG_WORDS.outsideUse).toBe("Anything here you could use?");
  for (const value of Object.values(CATALOG_WORDS)) {
    if (typeof value === "string") expect(value).not.toContain("usually skip");
  }
});
