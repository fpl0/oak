// Oak 2.0 W1 starting points (starts.ts): Oak's Blank writes no part, every line an Oak start writes is listed in
// OAK_DEFAULTS.lines (so the habits mirror never reads Oak's defaults as the learner's), each start plays, plain
// start names one plain sound per role, fill it all puts every part in every section, a template to review starts
// a sketch to review, and every detail line describes.
import { describe, expect, test } from "bun:test";
import {
  chainLinks,
  labelledLines,
  PLAIN_SOUNDS,
  tempoLineOf,
  type UnlockableId,
  type UserTemplate,
} from "@oak/api";
import { lintOak } from "@oak/grader";
import { evalHeadless } from "@oak/grader/testing";
import { toolbox } from "../../../content/toolbox.ts";
import { isDescriptive } from "./descriptive.ts";
import {
  BLANK_CODE,
  OAK_DEFAULTS,
  OVER_BAND_CODE,
  OVER_BAND_CODE_3_4,
  overBandStart,
  studioLint,
} from "./model.ts";
import {
  blankStartBody,
  drumsAndBassCode,
  FILL_LENGTH_LINE,
  FILL_REFUSALS,
  FILL_SECTIONS,
  FILL_SONG_BARS,
  fillItAllCode,
  fillSectionBars,
  plainStartCode,
  START_DETAILS,
  START_HEADINGS,
  TEMPLATE_COPY,
  templateStartBody,
  templateStartDetail,
} from "./starts.ts";

const ALL_TOOLS = new Set(toolbox.map((t) => t.id as UnlockableId));

const template = (over: Partial<UserTemplate> = {}): UserTemplate => ({
  id: "tpl_1",
  name: "Lo-fi kit",
  code: 'setcpm(84/4)\n\ndrums: s("~").bank("oak909")\nbass: note("~").s("ebass").lpf(600)\n',
  bpm: 84,
  meter: "4/4",
  isBlank: false,
  createdAt: "2026-11-25T10:00:00.000Z",
  updatedAt: "2026-11-25T10:00:00.000Z",
  ...over,
});

const OAK_STARTS: readonly [string, string][] = [
  ["Oak's Blank", BLANK_CODE],
  ["Drums and bass first", drumsAndBassCode(90, "4/4")],
  ["Plain start", plainStartCode(90, "4/4")],
  ["Over a Band", OVER_BAND_CODE],
  ["Over a Band in 3/4", OVER_BAND_CODE_3_4],
];

/** The string arguments of a chain's first call (`s("~")` → `["\"~\""]`). */
function headStrings(statement: string): string[] {
  const expr = statement.replace(/^\s*[A-Za-z_$][\w$]*\s*:/, "");
  const head = chainLinks(expr)?.[0];
  return head ? (head.args.match(/"[^"]*"|'[^']*'/g) ?? []) : [];
}

const FILL_SOURCE =
  'drums: s("bd ~ sd ~")\nbass: note("c2 ~ g1 ~").s("ebass")\nconst riff = "0 2 4"\nmel: n(riff).scale("C4:major").s("piano")';

describe("Oak's starts write no habit of Oak's", () => {
  test("the built-in Blank writes a tempo line and no part", () => {
    expect(labelledLines(BLANK_CODE)).toEqual([]);
    expect(tempoLineOf(BLANK_CODE)).toBe("setcpm(90/4)");
  });

  test("no start writes pattern content outside OAK_DEFAULTS.lines", () => {
    const listed = new Set(OAK_DEFAULTS.lines);
    for (const [name, code] of OAK_STARTS) {
      for (const raw of code.split("\n")) {
        const line = raw.trim();
        if (line === "" || line.startsWith("//")) continue;
        if (/^setcpm\(/.test(line)) continue;
        expect({ name, line, listed: listed.has(line) }).toEqual({ name, line, listed: true });
      }
      for (const l of labelledLines(code)) {
        if (l.text === 'hats: s("hh*8")' || l.text === 'hats: s("hh*6")') {
          expect(listed.has(l.text)).toBe(true);
          continue;
        }
        expect({ name, line: l.text, args: headStrings(l.text) }).toEqual({
          name,
          line: l.text,
          args: ['"~"'],
        });
      }
    }
  });

  test("Oak's defaults are 90 BPM in 4/4, C major; the starts with a tempo write the chosen one", () => {
    expect(OAK_DEFAULTS).toMatchObject({ bpm: 90, meter: "4/4", key: { tonic: "C", mode: "major" } });
    expect(tempoLineOf(drumsAndBassCode(72, "4/4"))).toBe("setcpm(72/4)");
    expect(tempoLineOf(plainStartCode(108, "3/4"))).toBe("setcpm(108/3)");
    expect(tempoLineOf(drumsAndBassCode(60, "6/8"))).toBe("setcpm(60/2)");
    expect(overBandStart("3/4")).toEqual({ code: OVER_BAND_CODE_3_4, bpm: 108 });
    expect(overBandStart("4/4")).toEqual({ code: OVER_BAND_CODE, bpm: 90 });
  });
});

describe("each start plays", () => {
  test("Oak's starts and fill it all evaluate without error", async () => {
    for (const [name, code] of OAK_STARTS) {
      const r = await evalHeadless(code, 1).then(
        () => "ok",
        (e: unknown) => `${name}: ${String(e)}`,
      );
      expect(r).toBe("ok");
    }
    const filled = fillItAllCode(FILL_SOURCE, { sections: 4, loopBars: 2 });
    if (!("code" in filled)) throw new Error("fill it all refused the source");
    const r = await evalHeadless(filled.code, 8);
    expect(r.events.length).toBeGreaterThan(0);
  });

  test("drums and bass first: a drum line and a bass line, both rests, and a comment", () => {
    const code = drumsAndBassCode(90, "4/4");
    expect(labelledLines(code).map((l) => l.label)).toEqual(["drums", "bass"]);
    expect(code).toContain("// Drums first, then a bass that fits them; the rest comes later.");
    const bass = chainLinks(labelledLines(code)[1]?.text.replace(/^bass:\s*/, "") ?? "");
    expect(bass?.find((l) => l.name === "s")?.args).toBe(`"${PLAIN_SOUNDS.bass}"`);
  });

  test("plain start uses one plain sound per role", () => {
    const code = plainStartCode(90, "4/4");
    const lines = labelledLines(code);
    expect(lines.map((l) => l.label)).toEqual(["drums", "bass", "chords", "mel"]);
    expect(code).toContain("// Plain sounds on purpose: make the sounds yours later.");
    const soundOf = (label: string) => {
      const l = lines.find((x) => x.label === label);
      const links = chainLinks(l?.text.replace(/^[A-Za-z_$][\w$]*\s*:\s*/, "") ?? "") ?? [];
      return links.slice(1).find((x) => x.name === "s")?.args ?? null;
    };
    expect(soundOf("bass")).toBe(`"${PLAIN_SOUNDS.bass}"`);
    expect(soundOf("chords")).toBe(`"${PLAIN_SOUNDS.chords}"`);
    expect(soundOf("mel")).toBe(`"${PLAIN_SOUNDS.tune}"`);
    const drums = chainLinks(lines[0]?.text.replace(/^drums:\s*/, "") ?? "") ?? [];
    expect(drums.map((l) => [l.name, l.args])).toEqual([["s", '"~"']]);
  });
});

describe("fill it all", () => {
  test("fill it all: every part plays in every section", async () => {
    const r = fillItAllCode(FILL_SOURCE, { sections: 4, loopBars: 2 });
    if (!("code" in r)) throw new Error(`refused: ${r.error}`);
    const { code } = r;
    const arranges = code.match(/\barrange\(/g) ?? [];
    expect(arranges.length).toBe(3);
    for (const l of labelledLines(code)) {
      expect(l.text).toMatch(/^\w+: arrange\(/);
      expect(chainLinks(l.text.replace(/^\w+:\s*/, ""))?.[0]?.args.match(/\[16, \w+A\]/g)?.length).toBe(4);
    }
    expect(code.match(/const riff\b/g)?.length).toBe(1);
    const { events } = await evalHeadless(code, 64);
    for (const track of ["drums", "bass", "mel"]) {
      for (let block = 0; block < 4; block++) {
        const inBlock = events.filter(
          (e) => e.track === track && e.onset >= block * 16 && e.onset < block * 16 + 16,
        );
        expect({ track, block, heard: inBlock.length > 0 }).toEqual({ track, block, heard: true });
      }
    }
    const lint = lintOak(code, studioLint(ALL_TOOLS, "4/4", null), toolbox);
    expect(lint.diagnostics.filter((d) => d.id.startsWith("form."))).toEqual([]);
  });

  test("the form check above is live: a 3-bar idea in 32-bar sections is named", () => {
    const r = fillItAllCode('mel: n("<0 2 4>").scale("C4:major").s("piano")', { sections: 2, loopBars: 3 });
    if (!("code" in r)) throw new Error(`refused: ${r.error}`);
    const lint = lintOak(r.code, studioLint(ALL_TOOLS, "4/4", null), toolbox);
    expect(lint.diagnostics.map((d) => d.id)).toContain("form.section-period");
  });

  test("keeps the tempo line, comments and a muted part as they are", () => {
    const src = 'setcpm(100/4)\n\n// my groove\ndrums: s("bd sd")\n_bass: note("c2").s("ebass")\n';
    const r = fillItAllCode(src, { sections: 2, loopBars: 1 });
    if (!("code" in r)) throw new Error(`refused: ${r.error}`);
    expect(r.code).toContain("setcpm(100/4)");
    expect(r.code).toContain("// my groove");
    expect(r.code).toContain('_bass: note("c2").s("ebass")');
    expect(r.code).toContain('const drumsA = s("bd sd")');
    expect(r.code).toContain("drums: arrange([32, drumsA], [32, drumsA])");
  });

  test("names never clash: a const already called drumsA, and two $ parts", async () => {
    const src =
      'const drumsA = "bd sd"\ndrums: s(drumsA)\n$: note("c3 e3").s("piano")\n$: note("g3").s("piano")\n';
    const r = fillItAllCode(src, { sections: 2, loopBars: 1 });
    if (!("code" in r)) throw new Error(`refused: ${r.error}`);
    const names = [...r.code.matchAll(/^const (\w+)/gm)].map((m) => m[1]);
    expect(new Set(names).size).toBe(names.length);
    expect(r.code.match(/\barrange\(/g)?.length).toBe(3);
    const { events } = await evalHeadless(r.code, 2);
    expect(events.length).toBeGreaterThan(0);
  });

  test("fill it all refuses a piece already in sections", () => {
    const src = 'const drumsA = s("bd")\ndrums: arrange([4, drumsA], [4, drumsA])\n';
    expect(fillItAllCode(src, { sections: 4, loopBars: 4 })).toEqual({ error: "has-sections" });
  });

  test("a piece with no part", () => {
    expect(fillItAllCode(BLANK_CODE, { sections: 4, loopBars: 4 })).toEqual({ error: "no-parts" });
    expect(fillItAllCode('setcpm(90/4)\n_drums: s("bd")\n', { sections: 4, loopBars: 4 })).toEqual({
      error: "no-parts",
    });
  });

  test("the section counts are the learner's pick; 4 is preselected", () => {
    expect(FILL_SECTIONS.choices).toEqual([2, 3, 4, 6, 8]);
    expect(FILL_SECTIONS.preselected).toBe(4);
  });
});

describe("the learner's templates and Blank", () => {
  test("a template to review starts a sketch to review", () => {
    const flagged = templateStartBody(template({ reviewBeforeRun: true }), {
      title: "Sketch 004",
      sessionId: null,
    });
    expect(flagged.flags.reviewBeforeRun).toBe(true);
    const plain = templateStartBody(template(), { title: "Sketch 004", sessionId: "ses_1" });
    expect("reviewBeforeRun" in plain.flags).toBe(false);
    expect(plain).toMatchObject({
      title: "Sketch 004",
      sessionId: "ses_1",
      originKind: "free",
      code: template().code,
      bpm: 84,
      meter: "4/4",
      band: null,
    });
  });

  test("your Blank wins over Oak's", () => {
    const t = template({ isBlank: true, code: 'setcpm(84/4)\n\ndrums: s("~").bank("oak909")', bpm: 84 });
    const mine = blankStartBody(t, { title: "Sketch 002", sessionId: null, bpm: 72, meter: "4/4" });
    expect(mine.code).toBe(t.code);
    expect(mine.bpm).toBe(84);
    const oaks = blankStartBody(null, { title: "Sketch 002", sessionId: null, bpm: 72, meter: "4/4" });
    expect(tempoLineOf(oaks.code)).toBe("setcpm(72/4)");
    expect(oaks.code).toBe(BLANK_CODE.replace("setcpm(90/4)", "setcpm(72/4)"));
    expect(oaks.bpm).toBe(72);
    expect("reviewBeforeRun" in oaks.flags).toBe(false);
    const flagged = blankStartBody(
      { ...t, reviewBeforeRun: true },
      { title: "x", sessionId: null, bpm: 90, meter: "4/4" },
    );
    expect(flagged.flags.reviewBeforeRun).toBe(true);
  });

  test("a template's detail names its tempo, meter and parts", () => {
    expect(templateStartDetail(template())).toBe("84 BPM, 4/4; parts: drums, bass");
    expect(templateStartDetail(template({ code: "setcpm(84/4)\n", bpm: null, meter: null }))).toBe(
      "No parts yet",
    );
  });
});

describe("Studio never scores", () => {
  test("every option's detail line is descriptive", () => {
    const texts = [
      ...Object.values(START_DETAILS),
      ...Object.values(START_HEADINGS),
      ...Object.values(FILL_REFUSALS),
      ...Object.values(TEMPLATE_COPY).map((t) => (typeof t === "function" ? t("Lo-fi kit") : t)),
      templateStartDetail(template()),
      templateStartDetail(template({ code: "setcpm(84/4)\n" })),
    ];
    expect(texts.length).toBeGreaterThan(20);
    for (const text of texts)
      expect({ text, descriptive: isDescriptive(text) }).toEqual({ text, descriptive: true });
  });
});

describe("Fill it all song length (X25)", () => {
  test("the song length is 64 bars", () => {
    expect(FILL_SONG_BARS).toBe(64);
  });

  test("section splits preserve whole loops when possible, with the remainder first", () => {
    const cases: [number, number, number[]][] = [
      [2, 4, [32, 32]],
      [3, 4, [24, 20, 20]],
      [4, 4, [16, 16, 16, 16]],
      [6, 4, [12, 12, 12, 12, 8, 8]],
      [8, 4, [8, 8, 8, 8, 8, 8, 8, 8]],
      [3, 2, [22, 22, 20]],
      [6, 2, [12, 12, 10, 10, 10, 10]],
      [3, 1, [22, 21, 21]],
      [6, 1, [11, 11, 11, 11, 10, 10]],
      [3, 3, [22, 21, 21]],
      [4, 12, [16, 16, 16, 16]],
      [3, 16, [32, 16, 16]],
      [8, 16, [8, 8, 8, 8, 8, 8, 8, 8]],
      [2, 64, [32, 32]],
    ];
    for (const [sections, loopBars, expected] of cases) {
      expect(fillSectionBars(sections, loopBars)).toEqual(expected);
    }
  });

  test("every section choice and loop length 1 through 16 preserves the split invariants", () => {
    for (const sections of FILL_SECTIONS.choices) {
      for (let loopBars = 1; loopBars <= 16; loopBars++) {
        const bars = fillSectionBars(sections, loopBars);
        expect(bars).toHaveLength(sections);
        expect(bars.every((b) => Number.isInteger(b) && b > 0)).toBe(true);
        expect(bars.reduce((sum, b) => sum + b, 0)).toBe(64);
        expect(bars.every((b, i) => i === 0 || b <= (bars[i - 1] as number))).toBe(true);
        const wholeLoops = 64 % loopBars === 0 && 64 / loopBars >= sections;
        if (wholeLoops) expect(bars.every((b) => b % loopBars === 0)).toBe(true);
        expect(Math.max(...bars) - Math.min(...bars)).toBeLessThanOrEqual(wholeLoops ? loopBars : 1);
      }
    }
  });

  test("rounds counts, clamps excess sections and supports a different total", () => {
    expect(fillSectionBars(3.2, 3.7)).toEqual([24, 20, 20]);
    expect(fillSectionBars(0, 0)).toEqual([64]);
    expect(fillSectionBars(8, 4, 3)).toEqual([1, 1, 1]);
    expect(fillSectionBars(3, 4, 20)).toEqual([8, 8, 4]);
  });

  test("three sections fill 64 bars, sound every part in every section and have no form lint", async () => {
    const { sectionsFromAst } = await import("@oak/grader");
    const r = fillItAllCode(FILL_SOURCE, { sections: 3, loopBars: 4 });
    if (!("code" in r)) throw new Error(`refused: ${r.error}`);
    for (const track of ["drums", "bass", "mel"]) {
      expect(r.code).toContain(`${track}: arrange([24, ${track}A], [20, ${track}A], [20, ${track}A])`);
    }
    const read = sectionsFromAst(r.code);
    if (!read || !("sections" in read)) throw new Error("filled sections could not be read");
    expect(read.totalBars).toBe(64);
    expect(read.sections.map((s) => s.bars)).toEqual([24, 20, 20]);
    const { events } = await evalHeadless(r.code, 64);
    for (const track of ["drums", "bass", "mel"]) {
      for (const [from, to] of [
        [0, 24],
        [24, 44],
        [44, 64],
      ] as const) {
        expect(events.some((e) => e.track === track && e.onset >= from && e.onset < to)).toBe(true);
      }
    }
    const lint = lintOak(r.code, studioLint(ALL_TOOLS, "4/4", null), toolbox);
    expect(lint.diagnostics.filter((d) => d.id.startsWith("form."))).toEqual([]);
    expect(r.code.match(/const riff\b/g)?.length).toBe(1);
  });

  test("whole-loop sections avoid the live period warning that an even whole-bar split raises", () => {
    const r = fillItAllCode('drums: s("<bd sd hh cp>")\n', { sections: 3, loopBars: 4 });
    if (!("code" in r)) throw new Error(`refused: ${r.error}`);
    const ids = (code: string) =>
      lintOak(code, studioLint(ALL_TOOLS, "4/4", null), toolbox).diagnostics.map((d) => d.id);
    expect(ids(r.code)).not.toContain("form.section-period");
    const control =
      'const drumsA = s("<bd sd hh cp>")\n\ndrums: arrange([22, drumsA], [21, drumsA], [21, drumsA])\n';
    expect(ids(control)).toContain("form.section-period");
  });

  test("the length line describes the total without scoring", () => {
    expect(FILL_LENGTH_LINE).toBe("Sections, 64 bars in all");
    expect(isDescriptive(FILL_LENGTH_LINE)).toBe(true);
  });
});
