// The toolbox-aware lint (contracts §3.3, §11.3; STYLE §12). Golden expectations: each case states the
// finding the dialect spec asks for, then asserts it.
import { describe, expect, test } from "bun:test";
import type { Diagnostic, LintContext, LintProfile } from "@oak/content-kit";
import { renderFeedback } from "../feedback/catalog.ts";
import { sectionsFromAst } from "./ast.ts";
import { miniErrorDetail } from "./mini.ts";
import { lintBase, lintOak, lintStrict, toolsUsed } from "./oak.ts";
import { ALL_UNLOCKED, TOOLBOX, unlockedAt } from "./toolbox.test-data.ts";

const ctx = (profile: LintProfile, o: Partial<LintContext> = {}): LintContext => ({
  profile,
  unlocked: ALL_UNLOCKED,
  allowPreview: false,
  meter: "4/4",
  key: null,
  ...o,
});
const lint = (code: string, profile: LintProfile = "graded", o: Partial<LintContext> = {}) =>
  lintOak(code, ctx(profile, o), TOOLBOX);
/** id → severity of every finding (first one per id). */
const found = (code: string, profile: LintProfile = "graded", o: Partial<LintContext> = {}) => {
  const out: Record<string, string> = {};
  for (const d of lint(code, profile, o).diagnostics) out[d.id] ??= d.severity;
  return out;
};
const T = "setcpm(120/4)\n\n";

describe("authored examples pass every profile", () => {
  const examples = [
    `setcpm(92/4)\n\ndrums: s("bd ~ sd ~, hh*8").bank("RolandTR808").gain(.8)\nbass: note("<c2 a1 f1 g1>").s("ebass").lpf(800)\nchords: chord("<C Am F G>").voicing().s("rhodes").gain(.5)\nmel: n("<[4 ~ 2 4] [0 ~ ~ 2] [5 ~ 3 5] [4 ~ ~ ~]>").scale("C4:major").s("piano")`,
    `setcpm(112/4)\n\nconst changes = "<C7 C7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7>"\n\nhats: s("hh*8").swingBy(1/3, 4).gain(.5)\ndrums: s("bd ~ sd ~").bank("RolandTR909")\nbass: chord(changes).rootNotes(2).struct("x*4").s("ebass").lpf(700)\nchords: chord(changes).dict("lefthand").voicing().struct("~ x ~ x").s("organ").gain(.5)\nmel: n("<[0 1 2 3] [4 ~ 1 0]>").scale("C4:blues").swingBy(1/3, 4).s("piano")`,
    `setcpm(104/4)\n\nconst drumsVerse = s("bd ~ sd ~")\nconst drumsChorus = s("bd bd sd ~")\nconst melVerse = n("<[0 2 4 2] [4 2 1 ~] [0 2 4 5] [4 ~ ~ ~]>").scale("C4:major").s("piano")\nconst melChorus = n("<[7 6 4 2] [4 ~ 2 ~] [7 6 4 2] [0 ~ ~ ~]>").scale("C4:major").s("piano")\n\ndrums: arrange([8, drumsVerse], [8, drumsChorus])\nmel: arrange([8, melVerse], [8, melChorus])`,
    `setcpm(100/4)\n\nconst melVerse = n("<[0 2 4 2] [4 2 1 ~]>")\nconst melChorus = n("<[7 6 4 2] [4 ~ 2 ~]>")\n\nmel: arrange([4, melVerse], [4, melChorus], [4, melChorus]).scale("<C4:major!8 D4:major!4>").s("piano")`,
    `setcpm(84/4)\n\nmel: n("0 1 2 4").scale("C4:major").off(1/8, x => x.scaleTranspose(2)).s("piano")`,
    `setcpm(120/4)\n\nconst changes = "<Dm7 G7 C^7 C^7>"\n\nchords: chord(changes).dict("lefthand").voicing().s("rhodes").gain(.5)\nbass: chord(changes).rootNotes(2).s("upright")\nmel: n("0 1 2 3").chord(changes).voicing().s("vibes")`,
    `setcpm(96/3)\n\nmel: n("<[~ ~ 4] [7 ~ 6] [4 ~ 2] [0 ~ ~]>").scale("G4:major").s("piano")`,
    `setcpm(96/4)\n\nsnare: s("~ sd ~ sd").late(1/32)\nhats: s("hh*16").gain(.7)`,
  ];
  for (const [i, code] of examples.entries()) {
    test(`example ${i + 1}`, () => {
      const meter = code.includes("/3)") ? "3/4" : "4/4";
      for (const profile of ["content", "graded", "studio", "tutor-card", "band"] as const) {
        const r = lintOak(code, ctx(profile, { meter }), TOOLBOX);
        expect([profile, r.diagnostics.map((d) => `${d.id}: ${d.message}`)]).toEqual([profile, []]);
        expect(r.ok).toBe(true);
      }
    });
  }
});

describe("STYLE §12: forbidden constructs, authored vs graded", () => {
  const cases: [string, string, string, string][] = [
    // code, finding, authored severity, graded severity
    [`${T}$: s("bd*2")`, "code.dollar-label", "error", "info"],
    [`${T}Snare: s("~ sd ~ sd")`, "code.label-solo-prefix", "error", "error"],
    [`${T}_drums: s("bd")\nhats: s("hh*8")`, "code.muted-label", "error", "info"],
    [`${T}guitarz: s("bd")`, "code.label-unknown", "error", "warn"],
    [`${T}drums: s("bd")\ndrums: s("sd")`, "code.label-duplicate", "error", "warn"],
    [`${T}drums: s("bd")\nnote("c4")`, "code.unlabelled-line", "error", "warn"],
    [`${T}mel: note('c4 e4')`, "code.single-quoted-pattern", "error", "error"],
    [`${T}mel: note("c e g")`, "code.octave-default", "error", "info"],
    [`${T}mel: note("cs4 ef4")`, "code.letter-accidental", "error", "info"],
    [`${T}mel: n("0 2 4").scale("C:major")`, "code.scale-no-octave", "error", "warn"],
    [`${T}mel: n("0 2 4").scale("C4 major")`, "code.scale-spaces", "error", "error"],
    [`${T}mel: n("0 2 4").s("piano")`, "code.n-without-scale", "error", "error"],
    [`${T}chords: chord("<Cmaj7 F>").voicing()`, "code.unknown-chord", "error", "error"],
    [`${T}chords: chord("<cm7 F>").voicing()`, "code.lowercase-chord-root", "error", "error"],
    [`${T}chords: chord("<C- F>").voicing()`, "code.unknown-chord", "error", "info"],
    [`${T}chords: chord("<C Am F G7>").dict("triads").voicing()`, "code.chord-not-in-dict", "error", "error"],
    [`${T}chords: chord("<C Caug>").dict("triads").voicing()`, "code.chord-not-in-dict", "error", "error"],
    [`${T}chords: chord("<Dm G C>").dict("lefthand").voicing()`, "code.chord-not-in-dict", "error", "error"],
    [`${T}chords: chord("<C C/E F G>").voicing()`, "code.slash-chord", "error", "error"],
    [`${T}chords: chord("<C+ F>").voicing()`, "code.unknown-chord", "error", "error"],
    [`${T}chords: chord("<C F>").mode("above").voicing()`, "code.mode-above", "error", "error"],
    [`${T}chords: chord("<C F>").voicings()`, "code.mode-above", "error", "error"],
    [`${T}chords: n("[0,2,4]").add("<0 3 4>").scale("C3:major")`, "code.add-on-control", "error", "error"],
    [`${T}chords: n("[0,2,4]").add(3).scale("C3:major")`, "code.add-on-control", "error", "error"],
    [`${T}mel: n("3 7b 5").scale("C4:major")`, "code.chromatic-step", "error", "warn"],
    [`${T}mel: n("0..7").scale("C4:major")`, "code.range-spacing", "error", "error"],
    [`${T}hats: s("hh*6").swingBy(1/3, 3)`, "code.swing-convention", "error", "warn"],
    [`${T}hats: s("hh*8").swingBy("<0 1/3>", 4)`, "code.swing-fraction-string", "error", "error"],
    [`${T}snare: s("~ sd").late("1/16")`, "code.time-fraction-string", "error", "error"],
    [`${T}mel: note("c4").off("1/8", x => x.add(note(12)))`, "code.time-fraction-string", "error", "error"],
    [`drums: s("bd")`, "code.setcpm-missing", "error", "warn"],
    [`setcps(0.5)\ndrums: s("bd")`, "code.setcpm-missing", "error", "warn"],
    [`${T}drums: s("bd").cpm(60)`, "code.setcpm-missing", "error", "warn"],
    [`setcpm(23)\ndrums: s("bd")`, "code.setcpm-form", "error", "info"],
    [`setcpm("90")\ndrums: s("bd")`, "code.setcpm-form", "error", "error"],
    [`${T}mel: n("0 2").scale("C4:major").transpose(2)`, "code.transpose-after-scale", "error", "warn"],
    [`${T}snare: s("~ sd").nudge(.01)`, "code.nudge-studio-only", "error", "error"],
    [`${T}drums: s("bd").leslie(1)`, "code.uncatalogued", "error", "info"],
    [`${T}mel: note("c4").piano()`, "code.uncatalogued", "error", "info"],
    [`${T}mel: note("c4").s("gm_piano")`, "code.uncatalogued", "error", "info"],
    [`${T}drums: s("bd").ply(2)`, "code.uncatalogued", "error", "warn"],
    [`${T}drums: s("bd").bank("tr909")`, "code.locked-sound", "error", "error"],
    [`${T}mel: note("c4").pianoroll()`, "code.uncatalogued", "error", "-"],
  ];
  for (const [code, id, authored, graded] of cases) {
    test(`${id}: ${code.replace(T, "").split("\n").pop()}`, () => {
      expect(found(code, "content")[id]).toBe(authored);
      expect(found(code, "graded")[id] ?? "-").toBe(graded);
      // Studio never blocks for the dialect.
      const studio = found(code, "studio")[id];
      expect(studio === undefined || studio === "info").toBe(true);
    });
  }

  test("diagnostics carry the code range, the line and a rendered message", () => {
    const code = `${T}chords: chord("<C Am F G7>").dict("triads").voicing()`;
    const d = lint(code).diagnostics.find((x) => x.id === "code.chord-not-in-dict");
    expect(d && code.slice(d.range.from, d.range.to)).toBe("G7");
    expect(d?.line).toBe(3);
    expect(d?.message).toBe(
      '"G7" is silent in the "triads" dictionary. Use .dict("ireal") or .dict("ireal-ext") or .dict("lefthand") or .dict("guidetones"), or voice it by hand.',
    );
    const aug = lint(`${T}chords: chord("Caug").dict("triads").voicing()`).diagnostics.find(
      (x) => x.id === "code.chord-not-in-dict",
    );
    expect(aug?.message).toContain("is voiced with the wrong notes");
  });

  test("the dict() of the chain decides, also for a const progression and for set(chord(…))", () => {
    expect(
      found(`${T}const changes = "<C Dm7>"\nchords: chord(changes).dict("triads").voicing()`)[
        "code.chord-not-in-dict"
      ],
    ).toBe("error");
    expect(
      found(`${T}const changes = "<C Dm7>"\nchords: chord(changes).voicing()`)["code.chord-not-in-dict"],
    ).toBeUndefined();
    expect(
      found(`${T}mel: n("0 1").set(chord("<C F>")).dict("lefthand").voicing()`)["code.chord-not-in-dict"],
    ).toBe("error");
  });

  test("n() with a drum sound is a sample index, not a missing scale; a section const may defer its scale", () => {
    expect(found(`${T}drums: n("0 1").s("bd")`)["code.n-without-scale"]).toBeUndefined();
    // Sound pack v4's hand percussion, one-shots, beds and breaks pick a sample with `n` too.
    for (const s of [
      "clave",
      "conga",
      "bongo",
      "foley",
      "snap",
      "impact",
      "swoosh",
      "scratch",
      "drone",
      "vinyl",
    ])
      expect([s, found(`${T}perc: n("0 1").s("${s}")`)["code.n-without-scale"]]).toEqual([s, undefined]);
    for (const s of ["tape", "brkfunk", "brkboombap", "brkjungle", "brkhouse", "brkjazz", "brklofi"])
      expect([s, found(`${T}drums: n("0 1").s("${s}")`)["code.n-without-scale"]]).toEqual([s, undefined]);
    // A pitched sound still needs its scale.
    expect(found(`${T}mel: n("0 1").s("marimba")`)["code.n-without-scale"]).toBe("error");
    expect(
      found(`${T}const melA = n("0 2")\nmel: arrange([2, melA]).scale("C4:major")`)["code.n-without-scale"],
    ).toBeUndefined();
  });

  test("a tempo line that divides by the wrong beats per bar is flagged for the meter", () => {
    expect(found('setcpm(90/4)\ndrums: s("bd")', "graded", { meter: "3/4" })["code.setcpm-form"]).toBe(
      "warn",
    );
    expect(
      found('setcpm(90/3)\ndrums: s("bd")', "graded", { meter: "3/4" })["code.setcpm-form"],
    ).toBeUndefined();
  });

  test("a mini-notation string that does not parse is an error before evaluation", () => {
    const r = lint(`${T}mel: note("c4 [e4")`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.map((d) => d.id)).toContain("eval.mini-parse");
  });

  test("the mini-parse detail is one calm clause, never the raw parser dump", () => {
    const detail = (code: string) =>
      String(lint(`${T}${code}`).diagnostics.find((d) => d.id === "eval.mini-parse")?.params.detail);
    expect(detail('note("c e [g")')).toBe('a "[" is never closed: add a "]"');
    expect(detail('note("c e g]")')).toBe('there is a "]" with no "[" before it');
    expect(detail('note("<c e]>")')).toBe('the "<" is closed with "]"; it needs ">"');
    for (const code of ['note("c e [g")', 'note("c (3,8")', 'note("c e g]")']) {
      expect(detail(code)).not.toMatch(/Expected|\[mini\]|parse error/);
    }
  });

  test("miniErrorDetail without the string still hides the Peggy dump", () => {
    const raw = '[mini] parse error at line 1: Expected "!", "(", "*", "[", or whitespace but "]" found.';
    expect(miniErrorDetail(raw)).toBe('there is a typo near "]"; check its brackets and symbols');
    expect(miniErrorDetail('[mini] parse error at line 1: Expected "]" but "\\"" found.')).toBe(
      "it ends before a bracket or group is closed",
    );
  });

  test("a JS syntax error is one diagnostic with its line", () => {
    const r = lint(`${T}mel: note("c4"`);
    expect(r).toMatchObject({ ok: false, used: [], locked: [] });
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0]).toMatchObject({ id: "eval.syntax", severity: "error", line: 3 });
  });
});

describe("form", () => {
  const verse =
    'const drumsVerse = s("bd sd")\nconst drumsChorus = s("bd*2 sd")\nconst bassVerse = note("c2")\nconst bassChorus = note("f2")';
  test("sectionsFromAst: sections, tags and start bars from one arrange() per track", () => {
    const code = `${T}${verse}\nconst melChorus2 = n("0").scale("C4:major")\ndrums: arrange([8, drumsVerse], [8, drumsChorus], [4, drumsChorus])\nbass: arrange([8, bassVerse], [8, bassChorus], [4, silence])\nmel: arrange([8, silence], [8, silence], [4, melChorus2])`;
    expect(sectionsFromAst(code)).toEqual({
      sections: [
        { label: "verse", tag: "verse", bars: 8, startBar: 0 },
        { label: "chorus", tag: "chorus", bars: 8, startBar: 8 },
        { label: "chorus", tag: "chorus2", bars: 4, startBar: 16 },
      ],
      totalBars: 20,
    });
    expect(sectionsFromAst(`${T}drums: s("bd")`)).toBeNull();
    expect(sectionsFromAst("not code (")).toBeNull();
  });
  test("tracks that disagree are reported, and the lint names the disagreement", () => {
    const code = `${T}${verse}\ndrums: arrange([8, drumsVerse], [8, drumsChorus])\nbass: arrange([8, bassVerse], [4, bassChorus])`;
    expect(sectionsFromAst(code)).toEqual({
      inconsistent: { track: "bass", detail: "section 2 is 4 bars in bass and 8 bars in drums" },
    });
    expect(found(code, "content")["form.inconsistent-arrange"]).toBe("error");
    expect(found(code, "graded")["form.inconsistent-arrange"]).toBe("warn");
    const names = `${T}${verse}\ndrums: arrange([8, drumsVerse], [8, drumsChorus])\nbass: arrange([8, bassChorus], [8, bassVerse])`;
    expect(sectionsFromAst(names)).toMatchObject({ inconsistent: { track: "bass" } });
  });
  test("a patterned scale inside a section const, a stacked section, and a cut-off period are flagged", () => {
    const scale = `${T}const melVerse = n("0 2").scale("<C4:major D4:major>")\nmel: arrange([4, melVerse])`;
    expect(found(scale, "graded")["code.arranged-scale-pattern"]).toBe("warn");
    const stacked = `${T}song: arrange([8, stack(s("bd"), note("c2"))])`;
    expect(found(stacked, "content")["form.inconsistent-arrange"]).toBe("error");
    const cut = `${T}const melVerse = n("<0 2 4>").scale("C4:major")\nmel: arrange([4, melVerse])`;
    expect(lint(cut).diagnostics.find((d) => d.id === "form.section-period")?.message).toBe(
      "`melVerse` repeats every 3 bars, so a 4-bar section cuts it off.",
    );
    expect(
      found(`${T}const melVerse = n("<0 2>").scale("C4:major")\nmel: arrange([4, melVerse])`)[
        "form.section-period"
      ],
    ).toBeUndefined();
  });
});

describe("toolbox", () => {
  test("toolsUsed maps calls, methods, sounds, banks, scales, chord families and mini operators", () => {
    const code = `${T}drums: s("bd*2 [~ sd]").bank("RolandTR909")\nchords: chord("<C G7 Dm7>").voicing().s("rhodes")\nmel: n("<0 2 -1> 3#").scale("A3:minor").s("piano").late(1/8)\nlead: note("c#4 e4").gain(sine.range(.4, .8))`;
    const ids = new Set(toolsUsed(code, TOOLBOX).map((u) => u.id));
    for (const id of [
      "tb.setcpm",
      "tb.label",
      "tb.s",
      "snd.drum.bd",
      "snd.drum.sd",
      "tb.mini.repeat",
      "tb.mini.seq",
      "tb.mini.sub",
      "tb.mini.rest",
      "tb.bank",
      "snd.bank.RolandTR909",
      "tb.chord",
      "tb.mini.alt",
      "chord.triad",
      "chord.dom7",
      "chord.seventh",
      "tb.voicing",
      "tb.s.pitched",
      "snd.rhodes",
      "tb.n",
      "tb.n.range",
      "tb.n.chromatic",
      "tb.scale",
      "scale.minor",
      "snd.piano",
      "tb.late",
      "tb.note",
      "tb.note.names",
      "tb.note.accidentals",
      "tb.gain",
      "tb.signal",
      "tb.range",
    ]) {
      expect([id, ids.has(id)]).toEqual([id, true]);
    }
    const piano = toolsUsed(code, TOOLBOX).find((u) => u.id === "snd.piano");
    expect(piano && code.slice(piano.range.from, piano.range.to)).toBe("piano");
  });

  test("locked tools: error in a graded step, info in Studio, preview context, Band allowed", () => {
    const code = `${T}chords: chord("<C F>").voicing().s("rhodes")`;
    const unlocked = unlockedAt("U00.L01", "U01.L01", "U01.L07", "U02.L01");
    const graded = lintOak(code, ctx("graded", { unlocked }), TOOLBOX);
    expect(graded.ok).toBe(false);
    expect(graded.locked.sort()).toEqual(["chord.triad", "snd.rhodes", "tb.chord", "tb.voicing"]);
    expect(graded.lockedTools.sort()).toEqual(["tb.chord", "tb.voicing"]);
    const sev = (r: ReturnType<typeof lintOak>) =>
      Object.fromEntries(r.diagnostics.map((d) => [d.id, d.severity]));
    expect(sev(graded)).toEqual({
      "code.locked-tool": "error",
      "code.locked-chord": "error",
      "code.locked-sound": "error",
    });
    const chordMsg = graded.diagnostics.find((d) => d.id === "code.locked-tool");
    expect(chordMsg?.message).toBe("`chord` unlocks in U05.L08.");
    // The catalog template's slots are filled from the lint's own params (no empty `` in the copy).
    expect(renderFeedback(chordMsg as Diagnostic)).toBe(
      "`chord` unlocks in U05.L08. For now, use the tools you have.",
    );
    expect(sev(lintOak(code, ctx("studio", { unlocked }), TOOLBOX))).toEqual({
      "code.locked-tool": "info",
      "code.locked-chord": "info",
      "code.locked-sound": "info",
    });
    expect(lintOak(code, ctx("studio", { unlocked }), TOOLBOX).ok).toBe(true);
    expect(sev(lintOak(code, ctx("content", { unlocked, allowPreview: true }), TOOLBOX))).toEqual({
      "code.preview-tool": "info",
    });
    const band = lintOak(code, ctx("band", { unlocked }), TOOLBOX);
    expect(band.diagnostics).toEqual([]);
    expect(band.lockedTools.sort()).toEqual(["tb.chord", "tb.voicing"]);
    const card = lintOak(code, ctx("tutor-card", { unlocked }), TOOLBOX);
    expect(card.ok).toBe(true);
    expect(card.lockedTools.length).toBe(2);
  });

  test("a locked mini operator and a locked scale", () => {
    const unlocked = unlockedAt("U00.L01", "U01.L01", "U03.L02", "U02.L01");
    const r = lintOak(`${T}mel: n("0 2 4 <5 7>").scale("A3:minor")`, ctx("graded", { unlocked }), TOOLBOX);
    expect(r.diagnostics.map((d) => [d.id, d.params.name])).toEqual(
      expect.arrayContaining([
        ["code.locked-mini", "alt"],
        ["code.locked-scale", "minor"],
        ["code.locked-tool", "7"],
      ]),
    );
  });

  test("matches in a row win over the derived names", () => {
    const toolbox = [
      ...TOOLBOX,
      { ...(TOOLBOX[0] as (typeof TOOLBOX)[number]), id: "tb.ply" as const, code: "x", matches: ["ply"] },
    ];
    expect(toolsUsed(`${T}drums: s("bd").ply(2)`, toolbox).map((u) => u.id)).toContain("tb.ply");
  });

  test("an empty toolbox means no toolbox data: no locked or uncatalogued findings", () => {
    const r = lintOak(`${T}drums: s("bd").ply(2)`, ctx("graded"), []);
    expect(r.diagnostics).toEqual([]);
    expect(r.used).toEqual([]);
  });
});

describe("safety: base profile (all code)", () => {
  test("lesson code passes", () => {
    expect(
      lintBase(
        `${T}drums: s("bd*4").bank("RolandTR909")\nmel: n("0 2").scale("C4:major").off(1/8, x => x.add(n(2)))`,
      ),
    ).toEqual([]);
  });
  test("import, with, host identifiers, constructor access and remote samples are rejected", () => {
    const ids = (code: string) => lintBase(code).map((d) => d.id);
    expect(ids("const fs = await import('node:fs')\ns('bd')")).toEqual(["lint.base.import"]);
    expect(ids("with (Math) { s('bd') }\ns('bd')")).toEqual(["lint.base.with"]);
    for (const name of [
      "globalThis",
      "self",
      "window",
      "document",
      "process",
      "Bun",
      "require",
      "module",
      "fetch",
      "XMLHttpRequest",
      "WebSocket",
      "EventSource",
      "Worker",
      "SharedWorker",
      "eval",
      "Function",
      "importScripts",
      "navigator",
      "postMessage",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "caches",
    ]) {
      expect([name, ids(`const x = ${name}\ns('bd')`)]).toEqual([name, ["lint.base.identifier"]]);
    }
    expect(ids("s('bd').constructor")).toEqual(["lint.base.member"]);
    expect(ids("x.__proto__\ns('bd')")).toEqual(["lint.base.member"]);
    expect(ids("note.prototype\ns('bd')")).toEqual(["lint.base.member"]);
    expect(ids("samples('github:tidalcycles/dirt-samples')\ns('bd')")).toEqual(["lint.base.remote-samples"]);
    expect(ids("samples('https://example.com/x.json')\ns('bd')")).toEqual(["lint.base.remote-samples"]);
    // a property merely named like a host global is fine
    expect(ids("const o = { fetch: 1 }\ns('bd').fetch")).toEqual([]);
  });
  test("base findings block every profile, Studio included", () => {
    expect(lintOak("const x = process\ns('bd')", ctx("studio"), TOOLBOX).ok).toBe(false);
  });
});

describe("safety: strict profile (code the learner did not type)", () => {
  const ids = (code: string) => [...new Set(lintStrict(code).map((d) => d.id))];
  test("lesson-shaped code passes", () => {
    for (const code of [
      'setcpm(120/4)\ndrums: s("bd*4, [~ sd]*2, hh*8").bank("RolandTR909")\nchords: chord("<C Am F G>").voicing().s("piano")\nmel: n("0 2 4 <6 7>").scale("C4:major")',
      'const prog = "<C^7 Am7 Dm7 G7>"\nbass: chord(prog).rootNotes(2)\nkeys: chord(prog).dict("lefthand").voicing()',
      'note("c4 e4 g4").off(1/8, x => x.add(note(12))).jux(rev).every(4, x => x.fast(2))',
      "const xs = [0, 2, 4]\nn(xs[0]).scale('C:major')",
      'arrange([4, s("bd*4")], [4, s("hh*8")])',
      "mel: note(`c4 e4\n g4 b4`)",
    ]) {
      expect([code, lintStrict(code)]).toEqual([code, []]);
    }
  });
  test("every escape ingredient of spike S1 is rejected", () => {
    const table: [string, string][] = [
      ["Bun.file('/etc/passwd')", "lint.base.identifier"],
      ["process.env", "lint.base.identifier"],
      ["require('fs')", "lint.base.identifier"],
      ["globalThis.fetch", "lint.base.identifier"],
      ["new WebSocket('ws://x')", "lint.strict.construct"],
      ["await import('node:fs')", "lint.base.import"],
      ["import.meta.url", "eval.syntax"],
      ["this", "lint.strict.this"],
      ["(function(){ return this })()", "lint.strict.this"],
      ["(()=>{}).constructor('x')", "lint.base.member"],
      ["(()=>{})['constructor']('x')", "lint.strict.computed-member"],
      ["(()=>{})['con'+'structor']", "lint.strict.computed-member"],
      ["const k = 'constructor'; s('bd')", "lint.strict.reserved-string"],
      ["s('con\\x73tructor')", "lint.strict.reserved-string"],
      ["const {constructor: c} = s; c", "lint.strict.reserved-string"],
      ["const {['a']: c} = s; c", "lint.strict.computed-member"],
      ["x.__proto__", "lint.base.member"],
      ["x.__lookupGetter__('a')", "lint.strict.construct"],
      ["x.prototype", "lint.base.member"],
      ["x[y]", "lint.strict.computed-member"],
      ["x[`a`]", "lint.strict.computed-member"],
      ["({[k]: 1})", "lint.strict.computed-member"],
      ["Reflect.get(f, k)", "lint.strict.construct"],
      ["Object.getOwnPropertyDescriptors(f)", "lint.strict.construct"],
      ["Symbol.iterator", "lint.strict.construct"],
      ["new Proxy({}, {})", "lint.strict.construct"],
      ["eval('1')", "lint.base.identifier"],
      ["new Function('x')", "lint.base.identifier"],
      ["setTimeout(() => 1, 0)", "lint.strict.construct"],
      ["evaluate('1')", "lint.strict.construct"],
      ["register('note', () => silence)", "lint.strict.construct"],
      ["note = 5", "lint.strict.construct"],
      ["note++", "lint.strict.construct"],
      ["let m = 1\nm", "lint.strict.construct"],
      ["class A {}\ns('bd')", "lint.strict.construct"],
      ["String.raw`x`", "lint.strict.construct"],
      ["/a/.exec('a')", "lint.strict.construct"],
      ["s(`$" + "{1}`)", "lint.strict.construct"],
      ["for (;;) {}\ns('bd')", "lint.strict.construct"],
      ["s('bd').fmap(x => { return x })", "lint.strict.construct"],
      ["s('bd').fmap(function (x) { return x })", "lint.strict.construct"],
      ["try { s('bd') } catch {}\ns('bd')", "lint.strict.construct"],
      ["s(...xs)", "lint.strict.construct"],
      ["({ get a() { return 1 } })", "lint.strict.construct"],
    ];
    for (const [code, id] of table) {
      expect([code, ids(code)]).toEqual([code, expect.arrayContaining([id])]);
    }
  });
  test("numeric index access is allowed; diagnostics carry source offsets", () => {
    expect(lintStrict("const xs = [1, 2]\nn(xs[1])")).toEqual([]);
    const d = lintStrict("s('bd')\nfetch('x')");
    expect(d.map((x) => [x.id, x.range, x.line])).toEqual([["lint.base.identifier", { from: 8, to: 13 }, 2]]);
  });
  test("Band code needs no tempo line (it shares the session tempo); learner code does", () => {
    const ctx = (profile: LintContext["profile"]): LintContext => ({
      profile,
      unlocked: new Set(),
      allowPreview: true,
      meter: "4/4",
      key: null,
    });
    const band = 'drums: s("bd ~ sd ~")';
    expect(lintOak(band, ctx("band"), []).diagnostics.map((d) => d.id)).not.toContain("code.setcpm-missing");
    expect(lintOak(band, ctx("content"), []).diagnostics.map((d) => d.id)).toContain("code.setcpm-missing");
  });

  test("the strict profile is part of lintOak for content, tutor cards and Band code", () => {
    for (const profile of ["content", "tutor-card", "band"] as const) {
      expect(lintOak(`${T}drums: s("bd").fmap(x => { return x })`, ctx(profile), TOOLBOX).ok).toBe(false);
    }
    expect(lintOak(`${T}drums: s("bd").fmap(x => { return x })`, ctx("graded"), TOOLBOX).ok).toBe(true);
  });
});
