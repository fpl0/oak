import { describe, expect, test } from "bun:test";
import { LABEL_ROLES } from "./schema/common.ts";
import {
  COMMIT_LINKS,
  chainLinks,
  constDecls,
  labelledLines,
  lineAt,
  PLAIN_SOUNDS,
  roleOfLabel,
  SOUND_LINKS,
  STUDIO_ROLES,
  scrapCode,
  soundSettingsOf,
  tempoLineOf,
} from "./studio-code.ts";

const SKETCH = [
  "setcpm(90/4)",
  'const changes = "<C Am F G>"',
  "",
  'drums: s("bd hh sd hh")',
  '  .bank("oak909") // the kit',
  "  .gain(0.8)",
  "",
  "chords: chord(changes)",
  "  .voicing()",
  '_bass: note("c2 a1 f1 g1").s("ebass")',
].join("\n");

describe("labelledLines", () => {
  test("a statement continues over `.` lines and stops before the trailing comment", () => {
    const lines = labelledLines(SKETCH);
    expect(lines.map((l) => l.label)).toEqual(["drums", "chords", "_bass"]);
    const drums = lines[0];
    expect(drums?.text).toBe('drums: s("bd hh sd hh")\n  .bank("oak909") // the kit\n  .gain(0.8)');
    expect(SKETCH.slice(drums?.from, drums?.to)).toBe(drums?.text as string);
    expect(lines[1]?.text).toBe("chords: chord(changes)\n  .voicing()");
  });

  test("mute marks: `_x` and `x_` are muted, `x` is not", () => {
    const lines = labelledLines('_a: s("bd")\nb_: s("sd")\nc: s("hh")');
    expect(lines.map((l) => [l.label, l.muted])).toEqual([
      ["_a", true],
      ["b_", true],
      ["c", false],
    ]);
  });

  test("a label inside a string or a comment is not a label", () => {
    const code = [
      "drums: s(`bd",
      "bass: sd`)",
      '// mel: note("c4")',
      "/* chords:",
      "pad: x */",
      'tune: note("c4")',
    ].join("\n");
    expect(labelledLines(code).map((l) => l.label)).toEqual(["drums", "tune"]);
    expect(labelledLines(code)[0]?.text).toBe("drums: s(`bd\nbass: sd`)");
  });

  test("any line while a bracket is open continues the statement", () => {
    const code = 'drums: stack(\n  s("bd*4"),\n  s("hh*8")\n)\nbass: note("c2")';
    const lines = labelledLines(code);
    expect(lines.map((l) => l.label)).toEqual(["drums", "bass"]);
    expect(lines[0]?.text).toBe('drums: stack(\n  s("bd*4"),\n  s("hh*8")\n)');
  });

  test("`$:` twice gives two lines; `::` and an object key are not labels", () => {
    const code = '$: s("bd*4")\n$: s("hh*8")\nfoo::bar\n{ a: 1 }';
    const lines = labelledLines(code);
    expect(lines.map((l) => l.text)).toEqual(['$: s("bd*4")', '$: s("hh*8")']);
  });

  test("a comment line between continuations keeps the chain; a blank line does not end a `.` chain", () => {
    const code = 'mel: note("c4 e4")\n  // brighter\n\n  .s("sine")\nbass: note("c2")';
    const lines = labelledLines(code);
    expect(lines[0]?.text).toBe('mel: note("c4 e4")\n  // brighter\n\n  .s("sine")');
    expect(lines[1]?.label).toBe("bass");
  });
});

describe("lineAt", () => {
  const code = 'setcpm(90/4)\n\ndrums: s("bd hh")\n  .gain(0.8)\n\nbass: note("c2")';
  const drumsStart = code.indexOf("drums");
  const gainEnd = code.indexOf("(0.8)") + 5;

  test("start, middle and end of a multi-line statement", () => {
    expect(lineAt(code, drumsStart)?.label).toBe("drums");
    expect(lineAt(code, code.indexOf("hh"))?.label).toBe("drums");
    expect(lineAt(code, code.indexOf(".gain") - 1)?.label).toBe("drums"); // in the indent
    expect(lineAt(code, gainEnd)?.label).toBe("drums"); // cursor after the last character
    expect(lineAt(code, code.length)?.label).toBe("bass");
  });

  test("a blank line and an unlabelled statement are null", () => {
    expect(lineAt(code, drumsStart - 1)).toBeNull();
    expect(lineAt(code, gainEnd + 1)).toBeNull();
    expect(lineAt(code, 3)).toBeNull();
  });
});

describe("constDecls and scrapCode", () => {
  test("constDecls reads top-level consts only", () => {
    const code = 'const a = "0 2"\nmel: n(a).layer(() => { const b = 1; return x })\nconst c = a';
    expect(constDecls(code).map((d) => [d.name, d.text])).toEqual([
      ["a", 'const a = "0 2"'],
      ["c", "const c = a"],
    ]);
  });

  test("scrapCode brings every const the line uses, transitively, in source order", () => {
    const code = [
      'const a = "0 2"',
      "const unused = 3",
      "const b = a",
      'drums: s("bd")',
      'mel: n(b).scale("C:major")',
    ].join("\n");
    expect(scrapCode(code, "mel")).toBe('const a = "0 2"\nconst b = a\nmel: n(b).scale("C:major")');
  });

  test("an unused const is left out, and a const named like the label is not a use", () => {
    const code = 'const chords = "x"\nconst other = 1\nchords: chord("<C F>").voicing()';
    expect(scrapCode(code, "chords")).toBe('chords: chord("<C F>").voicing()');
  });

  test("a chord(changes) line brings its const; names in strings and after `.` are not uses", () => {
    const code = 'const changes = "<C Am>"\nconst s = 1\nconst gain = 2\nchords: chord(changes).s("gain")';
    expect(scrapCode(code, "chords")).toBe('const changes = "<C Am>"\nchords: chord(changes).s("gain")');
  });

  test("a const used inside a template expression counts", () => {
    const code = `const r = 3\nmel: note(\`c\${r} e\${r}\`)`;
    expect(scrapCode(code, "mel")).toBe(code);
    expect(scrapCode(`${code}\nconst q = 1`, "mel")).toBe(code);
  });

  test("a missing label gives null", () => {
    expect(scrapCode(SKETCH, "tune")).toBeNull();
  });

  test("a CodeLine means that statement: the second of two `$:` lines", () => {
    const code = 'const k = "bd"\n$: s("hh*8")\n$: s(k)';
    const second = labelledLines(code)[1];
    expect(second).toBeDefined();
    expect(scrapCode(code, second as NonNullable<typeof second>)).toBe('const k = "bd"\n$: s(k)');
    expect(scrapCode(code, "$")).toBe('$: s("hh*8")');
  });

  test("a self-referencing or cyclic const does not loop", () => {
    const code = "const a = b\nconst b = a\nmel: n(a)";
    expect(scrapCode(code, "mel")).toBe("const a = b\nconst b = a\nmel: n(a)");
  });
});

test("tempoLineOf finds the first top-level tempo call", () => {
  expect(tempoLineOf(SKETCH)).toBe("setcpm(90/4)");
  expect(tempoLineOf('// setcpm(60/4)\ndrums: s("bd")\nsetcps(0.5)')).toBe("setcps(0.5)");
  expect(tempoLineOf('drums: s("bd")')).toBeNull();
});

describe("chainLinks and soundSettingsOf", () => {
  test("a plain chain", () => {
    expect(chainLinks('note("c2").s("ebass").lpf(600)')).toEqual([
      { name: "note", args: '"c2"' },
      { name: "s", args: '"ebass"' },
      { name: "lpf", args: "600" },
    ]);
  });

  test("nested args split only top-level links, over lines and comments", () => {
    expect(chainLinks('s("bd").struct("<x ~> x")\n  // more\n  .add(n("<0 2>")).fast(2);')).toEqual([
      { name: "s", args: '"bd"' },
      { name: "struct", args: '"<x ~> x"' },
      { name: "add", args: 'n("<0 2>")' },
      { name: "fast", args: "2" },
    ]);
    expect(chainLinks('s(")").gain(1)')).toEqual([
      { name: "s", args: '")"' },
      { name: "gain", args: "1" },
    ]);
  });

  test("anything that is not a call chain is null", () => {
    expect(chainLinks('"c3 e3".note()')).toBeNull();
    expect(chainLinks("pat.fast(2)")).toBeNull();
    expect(chainLinks('bass: note("c2")')).toBeNull();
    expect(chainLinks('note("c2").layer')).toBeNull();
    expect(chainLinks('note("c2") + 1')).toBeNull();
    expect(chainLinks('note("c2"')).toBeNull();
    expect(chainLinks("")).toBeNull();
  });

  test("soundSettingsOf keeps sound links after the pattern, in written order", () => {
    expect(soundSettingsOf('bass: note("c2 e2").s("ebass").lpf(600)')).toBe('.s("ebass").lpf(600)');
    expect(soundSettingsOf('drums: s("bd hh").bank("oak909").fast(2).room(0.3)')).toBe(
      '.bank("oak909").room(0.3)',
    );
    expect(soundSettingsOf('chords: chord("<C F>").voicing().gain(0.5)')).toBe(".voicing().gain(0.5)");
    expect(soundSettingsOf('note("c4").fast(2)')).toBe("");
    expect(soundSettingsOf('mel: "c4".note()')).toBe("");
    expect(SOUND_LINKS.has("lpf")).toBe(true);
    expect(SOUND_LINKS.has("fast")).toBe(false);
  });

  test("COMMIT_LINKS is SOUND_LINKS without the mix (gain, velocity, postgain, pan): committing a sound leaves the mix open (W5 F3)", () => {
    for (const mix of ["gain", "velocity", "postgain", "pan"]) {
      expect(SOUND_LINKS.has(mix)).toBe(true);
      expect(COMMIT_LINKS.has(mix)).toBe(false);
    }
    expect([...COMMIT_LINKS]).toEqual(
      [...SOUND_LINKS].filter((l) => !["gain", "velocity", "postgain", "pan"].includes(l)),
    );
    const line = 'chords: chord("<C F>").voicing().gain(0.5).pan(0.3).lpf(900)';
    // The default reads every sound link, as "Make this my Blank" and templates do.
    expect(soundSettingsOf(line)).toBe(".voicing().gain(0.5).pan(0.3).lpf(900)");
    expect(soundSettingsOf(line, SOUND_LINKS)).toBe(soundSettingsOf(line));
    expect(soundSettingsOf(line, COMMIT_LINKS)).toBe(".voicing().lpf(900)");
    expect(soundSettingsOf('pad: note("c3").gain(0.5)', COMMIT_LINKS)).toBe("");
  });
});

describe("roles", () => {
  test("STUDIO_ROLES is the scrap role list", () => {
    expect([...STUDIO_ROLES]).toEqual(["drums", "bass", "chords", "tune", "other"]);
  });

  test("roleOfLabel maps LABEL_ROLES without mute marks", () => {
    expect(roleOfLabel("_bass")).toBe("bass");
    expect(roleOfLabel("bass_")).toBe("bass");
    expect(roleOfLabel("kick")).toBe("drums");
    expect(roleOfLabel("pad")).toBe("chords");
    expect(roleOfLabel("mel")).toBe("tune");
    expect(roleOfLabel("vox")).toBe("tune");
    expect(roleOfLabel("bass2")).toBe("bass");
    expect(roleOfLabel("riff")).toBe("other");
    expect(roleOfLabel("$")).toBe("other");
    expect(roleOfLabel("_")).toBe("other");
    expect(roleOfLabel("constructor")).toBe("other");
    for (const label of Object.keys(LABEL_ROLES)) expect(roleOfLabel(label)).not.toBe("other");
  });

  test("PLAIN_SOUNDS names one sound per pitched role", () => {
    expect(Object.keys(PLAIN_SOUNDS).sort()).toEqual(["bass", "chords", "tune"]);
  });
});
