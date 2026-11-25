import { expect, setDefaultTimeout, test } from "bun:test";
import type { AnalysisSummary } from "@oak/api";
import { strudel } from "../../../packages/grader/src/analyze/__support__/fixtures.ts";
import { analysisOfNormalized } from "../studio/piece-read.ts";
import { analysisKey, classifyRecentEdits, codeShape, type EditVersion, normCode } from "./edit-kind.ts";

setDefaultTimeout(30_000);

function analysis(overrides: Partial<AnalysisSummary> = {}): AnalysisSummary {
  return {
    key: [],
    bpm: 96,
    bars: 4,
    durationSec: 10,
    roles: { bass: "bass", chords: "chords" },
    slots: [
      { bar: 1, beat: 1, symbol: "C", rn: "I" },
      { bar: 2, beat: 1, symbol: "G", rn: "V" },
      { bar: 3, beat: 1, symbol: "Am", rn: "vi" },
      { bar: 4, beat: 1, symbol: "F", rn: "IV" },
    ],
    schemas: [],
    cadences: [],
    form: "A",
    energy: [0.8],
    devices: [],
    deviceList: [],
    keyContexts: [],
    ...overrides,
  };
}

const k2 = (): AnalysisSummary =>
  analysis({
    slots: [
      { bar: 1, beat: 1, symbol: "C", rn: "I" },
      { bar: 2, beat: 1, symbol: "F", rn: "IV" },
      { bar: 3, beat: 1, symbol: "G", rn: "V" },
      { bar: 4, beat: 1, symbol: "C", rn: "I" },
    ],
  });

function versions(codes: string[]): EditVersion[] {
  return codes.map((code, index) => ({ version: index + 1, code, analysis: null }));
}

function entry(v: readonly EditVersion[], index: number): EditVersion {
  const found = v[index];
  if (!found) throw new Error(`Missing fixture version ${index}`);
  return found;
}

function changes(v: readonly EditVersion[]): void {
  const kind = classifyRecentEdits(v);
  expect(kind).toBe("changes");
  expect(kind).not.toBe("tweaks");
  expect(kind).not.toBe("swing-back");
}

test("T1 a filter value edit is a tweak", () => {
  expect(
    classifyRecentEdits(
      versions([
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(900)\ndrums: s("bd ~ sd ~")',
      ]),
    ),
  ).toBe("tweaks");
});

test("T2 successive gain edits are tweaks", () => {
  expect(
    classifyRecentEdits(
      versions([
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.8)',
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.7)',
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.75)',
      ]),
    ),
  ).toBe("tweaks");
});

test("T3 a tempo edit is a tweak", () => {
  expect(
    classifyRecentEdits(
      versions([
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
        'setcpm(100/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
      ]),
    ),
  ).toBe("tweaks");
});

test("T4 decimal spelling is a tweak", () => {
  expect(
    classifyRecentEdits(
      versions([
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(.8)',
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.8)',
      ]),
    ),
  ).toBe("tweaks");
});

test("T5 negative numeric values are tweaks", () => {
  expect(
    classifyRecentEdits(
      versions([
        'setcpm(96/4)\n\nbass: note("c2 e2").add(-1).s("ebass")',
        'setcpm(96/4)\n\nbass: note("c2 e2").add(-2).s("ebass")',
      ]),
    ),
  ).toBe("tweaks");
});

test("T6 comments and blank lines are tweaks", () => {
  expect(
    classifyRecentEdits(
      versions([
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
        'setcpm(96/4)\n\n// groove\n\n\nbass: /* old */ note("c2 e2").s("ebass").lpf(600) // low end\ndrums: s("bd ~ sd ~")',
      ]),
    ),
  ).toBe("tweaks");
});

test("T7 a note change is not a tweak", () => {
  changes(
    versions([
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
      'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
    ]),
  );
});

test("T8 a degree in mini-notation is a change", () => {
  changes(
    versions([
      'setcpm(96/4)\n\nmel: n("0 2 4").scale("C4:major").s("sine")',
      'setcpm(96/4)\n\nmel: n("0 2 5").scale("C4:major").s("sine")',
    ]),
  );
});

test("T9 another method is a change", () => {
  changes(
    versions([
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").hpf(600)\ndrums: s("bd ~ sd ~")',
    ]),
  );
});

test("T10 adding a labelled line is a change", () => {
  changes(
    versions([
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")\nchords: note("<[c3,e3,g3] [a2,c3,e3]>").s("piano")',
    ]),
  );
});

test("T11 returning to earlier notes is a swing-back", () => {
  expect(
    classifyRecentEdits(
      versions([
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
        'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
      ]),
    ),
  ).toBe("swing-back");
});

test("T12 returning to an earlier filter value is a swing-back", () => {
  expect(
    classifyRecentEdits(
      versions([
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(900)\ndrums: s("bd ~ sd ~")',
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
      ]),
    ),
  ).toBe("swing-back");
});

test("T13 repeating the previous changed code is not a swing-back", () => {
  changes(
    versions([
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
      'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
      'setcpm(96/4)\n\nbass:  note("c2 g2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")\n\n',
    ]),
  );
});

test("T14 returning to an earlier analysis is a swing-back", () => {
  const v = versions([
    'setcpm(96/4)\n\nchords: note("<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>").s("piano")',
    'setcpm(96/4)\n\nchords: note("<[c3,e3,g3] [f2,a2,c3] [g2,b2,d3] [c3,e3,g3]>").s("piano")',
    'setcpm(96/4)\n\nconst prog = "<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>"\n\nchords: note(prog).s("piano")',
  ]).map((v, i) => ({ ...v, analysis: i === 1 ? k2() : analysis() }));
  expect(new Set(v.map((v) => normCode(v.code))).size).toBe(3);
  expect(classifyRecentEdits(v)).toBe("swing-back");
});

test("T15 equal analyses do not hide successive structural changes", () => {
  changes(
    versions([
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass")',
      'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass")',
      'setcpm(96/4)\n\nbass: note("c2 a2").s("ebass")',
    ]).map((v) => ({ ...v, analysis: analysis() })),
  );
});

test("T16 one or no versions are changes", () => {
  changes(versions(['setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")']));
  changes([]);
});

test("T17 shuffled numbered versions keep their classification", () => {
  const tweaks = versions([
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.8)',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.7)',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.75)',
  ]);
  const back = versions([
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
    'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
  ]);
  expect(classifyRecentEdits([entry(tweaks, 2), entry(tweaks, 0), entry(tweaks, 1)])).toBe("tweaks");
  expect(classifyRecentEdits([entry(back, 1), entry(back, 2), entry(back, 0)])).toBe("swing-back");
});

test("T18 live code sorts after numbered versions", () => {
  const v = versions([
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
    'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
  ]).map((v, i) => ({ ...v, version: i === 2 ? null : i + 2 }));
  expect(classifyRecentEdits([entry(v, 2), entry(v, 1), entry(v, 0)])).toBe("swing-back");
});

test("T19 energy tempo and duration do not change the analysis key", () => {
  expect(analysisKey(analysis())).toBe(analysisKey(analysis({ energy: [0.5], bpm: 100, durationSec: 9.6 })));
});

test("T20 a missing analysis has a null key", () => {
  expect(analysisKey(null)).toBeNull();
});

test("E1 digits in identifiers are structural", () => {
  const v = versions([
    'setcpm(96/4)\n\nconst riff1 = "c2 e2"\n\nbass: note(riff1)',
    'setcpm(96/4)\n\nconst riff2 = "c2 e2"\n\nbass: note(riff2)',
  ]);
  changes(v);
  expect(codeShape(entry(v, 0).code)).not.toBe(codeShape(entry(v, 1).code));
});

test("E2 digits in a bank string are structural", () => {
  changes(
    versions([
      'setcpm(96/4)\n\ndrums: s("bd ~ sd ~").bank("oak909")',
      'setcpm(96/4)\n\ndrums: s("bd ~ sd ~").bank("oak808")',
    ]),
  );
});

test("E3 comment markers inside strings remain music", () => {
  changes(
    versions([
      'setcpm(96/4)\n\nbass: note("c2 // e2").s("ebass")',
      'setcpm(96/4)\n\nbass: note("c2 // g2").s("ebass")',
    ]),
  );
  expect(normCode('note("c2 // e2")')).toBe('note("c2 // e2")');
});

test("E4 template interpolation remains part of the string", () => {
  changes(
    versions([
      // biome-ignore lint/suspicious/noTemplateCurlyInString: The classifier must see literal template interpolation.
      'setcpm(96/4)\n\nbass: note(`c2 ${1} e2`).s("ebass")',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: The classifier must see literal template interpolation.
      'setcpm(96/4)\n\nbass: note(`c2 ${2} e2`).s("ebass")',
    ]),
  );
});

test("E5 escaped quotes do not end the string", () => {
  // This required tokenizer fixture is not valid Strudel mini-notation; R5 excludes only E5.
  changes(versions(['note("c2 \\"e2\\" 1")', 'note("c2 \\"e2\\" 2")']));
});

test("E6 another numeric chain link is a change", () => {
  changes(
    versions([
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)',
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600).lpf(900)',
    ]),
  );
});

test("E7 a note change after a tweak remains a change", () => {
  changes(
    versions([
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(900)\ndrums: s("bd ~ sd ~")',
      'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass").lpf(900)\ndrums: s("bd ~ sd ~")',
    ]),
  );
});

test("E8 a gain tweaked back takes swing-back precedence", () => {
  expect(
    classifyRecentEdits(
      versions([
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.8)',
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.7)',
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.8)',
      ]),
    ),
  ).toBe("swing-back");
});

test("E9 a new analysis is not a swing-back", () => {
  changes(
    versions([
      'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass")',
      'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass")',
      'setcpm(96/4)\n\nbass: note("c2 a2").s("ebass")',
    ]).map((v, i) => ({ ...v, analysis: i === 2 ? k2() : analysis() })),
  );
});

test("E10 identical drafts are tweaks", () => {
  expect(
    classifyRecentEdits(
      versions([
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
        'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
      ]),
    ),
  ).toBe("tweaks");
});

test("U1 comments are removed before whitespace collapses", () => {
  expect(normCode("a  // x\n\n  b /* y\nz */ c")).toBe("a b c");
});

test("U2 comment quotes are ignored and string whitespace is preserved", () => {
  expect(normCode('// it\'s\nnote("c2   e2")')).toBe('note("c2   e2")');
});

test("U3 numeric literal forms share a shape", () => {
  expect(codeShape("x.gain(0.75).lpf(.5).add(-12).n(1e3).y(0x1f)")).toBe(
    "x.gain(#).lpf(#).add(-#).n(#).y(#)",
  );
});

test("U4 only numbers outside mini-notation are replaced", () => {
  expect(codeShape('setcpm(96/4)\nmel: n("0 2 4")')).toBe('setcpm(#/#) mel: n("0 2 4")');
});

test("U5 string digits stay and comment digits disappear", () => {
  expect(codeShape('s("bd").bank("oak909") // 120')).toBe('s("bd").bank("oak909")');
});

test("U6 empty and unterminated input never throws", () => {
  for (const transform of [normCode, codeShape]) {
    expect(transform("")).toBe("");
    expect(transform('note("c2')).toBe('note("c2');
    expect(transform("a /* open")).toBe("a");
    expect(() => transform("")).not.toThrow();
    expect(() => transform('note("c2')).not.toThrow();
    expect(() => transform("a /* open")).not.toThrow();
  }
});

test("U7 role insertion order does not change the key", () => {
  expect(analysisKey(analysis({ roles: { bass: "bass", chords: "chords" } }))).toBe(
    analysisKey(analysis({ roles: { chords: "chords", bass: "bass" } })),
  );
});

test("U8 key contexts device details and schemas are excluded", () => {
  const changed = analysis({
    key: [{ key: { tonic: "G", mode: "major" }, r: 0.9 }],
    keyContexts: [
      {
        track: "bass",
        band: false,
        spans: [{ fromBar: 1, toBar: 4, key: { tonic: "G", mode: "major" }, source: "scale" }],
      },
    ],
    deviceList: [{ device: "sequence", bar: 1, bars: 4, text: "sequence" }],
    schemas: [{ schema: "schema.aeolian", bars: [1, 4] }],
  });
  expect(analysisKey(changed)).toBe(analysisKey(analysis()));
});

test("U9 form cadences and bars matter but device order does not", () => {
  const base = analysisKey(analysis());
  expect(analysisKey(analysis({ form: "AB" }))).not.toBe(base);
  expect(analysisKey(analysis({ cadences: [{ bar: 4, type: "IAC" }] }))).not.toBe(base);
  expect(analysisKey(analysis({ bars: 8 }))).not.toBe(base);
  expect(analysisKey(analysis({ devices: ["a", "b"] }))).toBe(analysisKey(analysis({ devices: ["b", "a"] })));
});

test("U10 the key contains exactly the stable musical fields", () => {
  const key = analysisKey(analysis({ cadences: [{ bar: 4, type: "IAC" }] }));
  expect(key).not.toBeNull();
  const parsed = JSON.parse(key ?? "null");
  expect(Object.keys(parsed)).toEqual(["bars", "cadences", "devices", "form", "roles", "slots"]);
  expect(Object.keys(parsed.roles)).toEqual(["bass", "chords"]);
  expect(parsed.slots).toEqual(["1:1:C", "2:1:G", "3:1:Am", "4:1:F"]);
  expect(parsed.cadences).toEqual(["4:IAC"]);
});

test("U11 frozen shuffled inputs remain unchanged", () => {
  const v = Object.freeze([
    Object.freeze({ version: 3, code: 'setcpm(96/4)\n\nbass: note("c2 e2").gain(0.75)', analysis: null }),
    Object.freeze({ version: 1, code: 'setcpm(96/4)\n\nbass: note("c2 e2").gain(0.8)', analysis: null }),
    Object.freeze({ version: 2, code: 'setcpm(96/4)\n\nbass: note("c2 e2").gain(0.7)', analysis: null }),
  ]);
  const before = [...v];
  expect(() => classifyRecentEdits(v)).not.toThrow();
  expect(classifyRecentEdits(v)).toBe("tweaks");
  expect(v.map((v) => v.version)).toEqual([3, 1, 2]);
  for (const [i, entry] of v.entries()) expect(entry).toBe(before[i]);
});

test("equal version numbers and several live entries preserve input order", () => {
  const v: EditVersion[] = [
    { version: null, code: 'bass: note("c2 g2")', analysis: null },
    { version: 2, code: 'bass: note("c2 e2")', analysis: null },
    { version: 1, code: 'bass: note("c2 a2")', analysis: null },
    { version: 2, code: 'bass: note("c2 g2")', analysis: null },
    { version: null, code: 'bass: note("c2 e2")', analysis: null },
  ];
  expect(classifyRecentEdits(v)).toBe("swing-back");
  expect(classifyRecentEdits(v.filter((v) => v.version !== null))).toBe("changes");
  expect(
    classifyRecentEdits([
      { version: 1, code: 'bass: note("c2 e2")', analysis: null },
      { version: 2, code: 'bass: note("c2 g2")', analysis: null },
      { version: 2, code: 'bass: note("c2 e2")', analysis: null },
    ]),
  ).toBe("swing-back");
});

test("comments join tokens without inserting spaces", () => {
  expect(normCode("a/* comment */b")).toBe("ab");
  expect(codeShape("riff/* comment */2 + 4")).toBe("riff2 + #");
  expect(normCode(" \t/* only */ // comments\n")).toBe("");
});

test("all quotes and escapes preserve their contents including unfinished whitespace", () => {
  for (const code of [
    "note('c2 1 // e2')",
    "note('c2 \\'e2 1')",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: The classifier must see literal template interpolation.
    "note(`c2 \\` 1 ${2}`)",
    'note("c2 /* 1 */ e2")',
    'note("c2  ',
    "note('c2\\",
  ]) {
    expect(normCode(code)).toBe(code);
    expect(codeShape(code)).toBe(code);
  }
  expect(normCode("a // quote ' ignored\rb")).toBe("a b");
});

test("numeric boundaries retain identifiers and signs", () => {
  expect(codeShape("oak909 riff2 x1 $0 _2 12 1.5 .5 1e3 1E-3 2e+4 0XAF -1 +2")).toBe(
    "oak909 riff2 x1 $0 _2 # # # # # # # -# +#",
  );
});

test("slot and cadence order matter while roman numerals do not", () => {
  const base = analysis();
  expect(analysisKey(analysis({ slots: [...base.slots].reverse() }))).not.toBe(analysisKey(base));
  expect(analysisKey(analysis({ slots: base.slots.map((s) => ({ ...s, rn: "other" })) }))).toBe(
    analysisKey(base),
  );
  const cadences: AnalysisSummary["cadences"] = [
    { bar: 2, type: "IAC" },
    { bar: 4, type: "PAC" },
  ];
  expect(analysisKey(analysis({ cadences }))).not.toBe(
    analysisKey(analysis({ cadences: [...cadences].reverse() })),
  );
  const devices = ["b", "a"];
  const a = analysis({ devices });
  Object.freeze(devices);
  expect(() => analysisKey(Object.freeze(a))).not.toThrow();
  expect(devices).toEqual(["b", "a"]);
});

async function realAnalysis(code: string): Promise<AnalysisSummary> {
  return analysisOfNormalized(await strudel(code, 4), { code, meter: "4/4", key: null, bars: 4 });
}

function observed(a: AnalysisSummary, slots: string[], cadences: string[] = []): void {
  expect(a.slots.map((s) => `${s.bar}:${s.beat}:${s.symbol}`)).toEqual(slots);
  expect(a.cadences.map((c) => `${c.bar}:${c.type}`)).toEqual(cadences);
  expect(a.form).toBe("A");
  expect(a.bars).toBe(4);
  expect(a.roles).toEqual({ bass: "bass", chords: "chords" });
}

test("R1 real tempo and gain edits preserve the musical analysis key", async () => {
  const rx =
    'setcpm(96/4)\n\nchords: note("<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>").s("piano").gain(0.8)\nbass: note("<c2 g1 a1 f1>").s("ebass").gain(0.9)';
  const rxt =
    'setcpm(100/4)\n\nchords: note("<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>").s("piano").gain(0.5)\nbass: note("<c2 g1 a1 f1>").s("ebass").gain(0.6)';
  const a = await realAnalysis(rx);
  const b = await realAnalysis(rxt);
  observed(a, ["1:1:C", "2:1:G", "3:1:Am", "4:1:F"]);
  observed(b, ["1:1:C", "2:1:G", "3:1:Am", "4:1:F"]);
  expect(a.bpm).toBe(96);
  expect(b.bpm).toBe(100);
  expect(a.durationSec).toBeCloseTo(10);
  expect(b.durationSec).toBeCloseTo(9.6);
  expect(a.bpm).not.toBe(b.bpm);
  expect(a.durationSec).not.toBe(b.durationSec);
  expect(analysisKey(a)).toBe(analysisKey(b));
});

test("R2 real music returning through a const is a swing-back", async () => {
  const rx =
    'setcpm(96/4)\n\nchords: note("<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>").s("piano").gain(0.8)\nbass: note("<c2 g1 a1 f1>").s("ebass").gain(0.9)';
  const ry =
    'setcpm(96/4)\n\nchords: note("<[c3,e3,g3] [f2,a2,c3] [g2,b2,d3] [c3,e3,g3]>").s("piano").gain(0.8)\nbass: note("<c2 f1 g1 c2>").s("ebass")';
  const rz =
    'setcpm(96/4)\n\nconst prog = "<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>"\nchords: note(prog).s("piano").gain(0.8)\nbass: note("<c2 g1 a1 f1>").s("ebass")';
  const a = await realAnalysis(rx);
  const b = await realAnalysis(ry);
  const c = await realAnalysis(rz);
  observed(a, ["1:1:C", "2:1:G", "3:1:Am", "4:1:F"]);
  observed(b, ["1:1:C", "2:1:F", "3:1:G", "4:1:C"], ["4:IAC"]);
  observed(c, ["1:1:C", "2:1:G", "3:1:Am", "4:1:F"]);
  expect(normCode(rz)).not.toBe(normCode(rx));
  expect(normCode(rz)).not.toBe(normCode(ry));
  expect(analysisKey(a)).not.toBe(analysisKey(b));
  expect(analysisKey(c)).toBe(analysisKey(a));
  expect(
    classifyRecentEdits([
      { version: 1, code: rx, analysis: a },
      { version: 2, code: ry, analysis: b },
      { version: 3, code: rz, analysis: c },
    ]),
  ).toBe("swing-back");
});

test("R3 real new chords are changes rather than a swing-back", async () => {
  const rx =
    'setcpm(96/4)\n\nchords: note("<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>").s("piano").gain(0.8)\nbass: note("<c2 g1 a1 f1>").s("ebass").gain(0.9)';
  const ry =
    'setcpm(96/4)\n\nchords: note("<[c3,e3,g3] [f2,a2,c3] [g2,b2,d3] [c3,e3,g3]>").s("piano").gain(0.8)\nbass: note("<c2 f1 g1 c2>").s("ebass")';
  const rw =
    'setcpm(96/4)\n\nchords: note("<[a2,c3,e3] [f2,a2,c3] [c3,e3,g3] [g2,b2,d3]>").s("piano").gain(0.8)\nbass: note("<a1 f1 c2 g1>").s("ebass")';
  const a = await realAnalysis(rx);
  const b = await realAnalysis(ry);
  const c = await realAnalysis(rw);
  observed(c, ["1:1:Am", "2:1:F", "3:1:C", "4:1:G"]);
  expect(analysisKey(c)).not.toBe(analysisKey(a));
  expect(analysisKey(c)).not.toBe(analysisKey(b));
  changes([
    { version: 1, code: rx, analysis: a },
    { version: 2, code: ry, analysis: b },
    { version: 3, code: rw, analysis: c },
  ]);
});

test("R4 real numeric edits classify as tweaks", async () => {
  const rx =
    'setcpm(96/4)\n\nchords: note("<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>").s("piano").gain(0.8)\nbass: note("<c2 g1 a1 f1>").s("ebass").gain(0.9)';
  const rxt =
    'setcpm(100/4)\n\nchords: note("<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>").s("piano").gain(0.5)\nbass: note("<c2 g1 a1 f1>").s("ebass").gain(0.6)';
  const a = await realAnalysis(rx);
  const b = await realAnalysis(rxt);
  expect(
    classifyRecentEdits([
      { version: 1, code: rx, analysis: a },
      { version: 2, code: rxt, analysis: b },
    ]),
  ).toBe("tweaks");
});

test("R5 programs evaluate except tokenizer-only E3 and E5 with invalid mini-notation", async () => {
  // E3 and E5 are tokenizer-only rows whose strings are not valid mini-notation, so R5 excludes both.
  // Full literals keep this proof independently runnable; duplicates across rows need only one evaluation.
  const codes = [
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(900)\ndrums: s("bd ~ sd ~")',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.8)',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.7)',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(0.75)',
    'setcpm(100/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").gain(.8)',
    'setcpm(96/4)\n\nbass: note("c2 e2").add(-1).s("ebass")',
    'setcpm(96/4)\n\nbass: note("c2 e2").add(-2).s("ebass")',
    'setcpm(96/4)\n\n// groove\n\n\nbass: /* old */ note("c2 e2").s("ebass").lpf(600) // low end\ndrums: s("bd ~ sd ~")',
    'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")',
    'setcpm(96/4)\n\nmel: n("0 2 4").scale("C4:major").s("sine")',
    'setcpm(96/4)\n\nmel: n("0 2 5").scale("C4:major").s("sine")',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").hpf(600)\ndrums: s("bd ~ sd ~")',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")\nchords: note("<[c3,e3,g3] [a2,c3,e3]>").s("piano")',
    'setcpm(96/4)\n\nbass:  note("c2 g2").s("ebass").lpf(600)\ndrums: s("bd ~ sd ~")\n\n',
    'setcpm(96/4)\n\nchords: note("<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>").s("piano")',
    'setcpm(96/4)\n\nchords: note("<[c3,e3,g3] [f2,a2,c3] [g2,b2,d3] [c3,e3,g3]>").s("piano")',
    'setcpm(96/4)\n\nconst prog = "<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>"\n\nchords: note(prog).s("piano")',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass")',
    'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass")',
    'setcpm(96/4)\n\nbass: note("c2 a2").s("ebass")',
    'setcpm(96/4)\n\nconst riff1 = "c2 e2"\n\nbass: note(riff1)',
    'setcpm(96/4)\n\nconst riff2 = "c2 e2"\n\nbass: note(riff2)',
    'setcpm(96/4)\n\ndrums: s("bd ~ sd ~").bank("oak909")',
    'setcpm(96/4)\n\ndrums: s("bd ~ sd ~").bank("oak808")',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Strudel evaluates this interpolation.
    'setcpm(96/4)\n\nbass: note(`c2 ${1} e2`).s("ebass")',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Strudel evaluates this interpolation.
    'setcpm(96/4)\n\nbass: note(`c2 ${2} e2`).s("ebass")',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600)',
    'setcpm(96/4)\n\nbass: note("c2 e2").s("ebass").lpf(600).lpf(900)',
    'setcpm(96/4)\n\nbass: note("c2 g2").s("ebass").lpf(900)\ndrums: s("bd ~ sd ~")',
  ];
  for (const code of codes) {
    const n = await strudel(code, 4).catch((cause: unknown) => {
      throw new Error(`Could not verify this R5 program:\n${code}`, { cause });
    });
    expect(n.all.length, code).toBeGreaterThan(0);
  }
});
