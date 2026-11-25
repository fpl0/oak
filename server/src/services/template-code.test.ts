import { describe, expect, test } from "bun:test";
import { labelledLines } from "@oak/content-kit";
import { evalHeadless } from "@oak/grader/testing";
import { templateOfCode } from "./template-code.ts";

const cases: { name: string; input: string; code: string; dropped?: string[] }[] = [
  {
    name: "T1 tempo and drums",
    input: 'setcpm(96/4)\n\ndrums: s("bd hh sd hh")',
    code: 'setcpm(96/4)\n\ndrums: s("~")\n',
  },
  {
    name: "T2 drum bank and gain",
    input: 'drums: s("bd ~ sd ~").bank("oak909").gain(.8)',
    code: 'drums: s("~").bank("oak909").gain(.8)\n',
  },
  {
    name: "T3 bass sound and filter",
    input: 'bass: note("c2 ~ g1 ~").s("ebass").lpf(600)',
    code: 'bass: note("~").s("ebass").lpf(600)\n',
  },
  {
    name: "T4 scale removed",
    input: 'mel: n("<0 2 4>").scale("C4:major").s("piano").room(.3)',
    code: 'mel: n("~").s("piano").room(.3)\n',
  },
  {
    name: "T5 voicing kept and structure removed",
    input: 'chords: chord("<C G Am F>").voicing().struct("x ~ x ~").s("rhodes")',
    code: 'chords: chord("~").voicing().s("rhodes")\n',
  },
  {
    name: "T6 constant content emptied",
    input: 'const changes = "<C F>"\nchords: chord(changes).dict("lefthand").voicing().s("piano")',
    code: 'chords: chord("~").dict("lefthand").voicing().s("piano")\n',
  },
  {
    name: "T7 nested pitch addition removed",
    input: 'bass: note("c2").add(note("<0 7>")).s("ebass")',
    code: 'bass: note("~").s("ebass")\n',
  },
  {
    name: "T8 first arrangement section",
    input:
      'const drumsA = s("bd ~ sd ~").bank("oak808")\nconst drumsB = s("bd*4").bank("oak808")\ndrums: arrange([4, drumsA], [4, drumsB]).gain(.9)',
    code: 'drums: s("~").bank("oak808").gain(.9)\n',
  },
  {
    name: "T9 sound head with note content",
    input: 'keys: s("piano").note("c3 e3 g3").lpf(900)',
    code: 'keys: s("piano").note("~").lpf(900)\n',
  },
  {
    name: "T10 muted part dropped",
    input: '_hats: s("hh*8")\ndrums: s("bd")',
    code: 'drums: s("~")\n',
    dropped: ["_hats"],
  },
  {
    name: "T11 unsupported head dropped",
    input: 'pad: stack(note("c3"), note("e3")).s("pad")',
    code: "",
    dropped: ["pad"],
  },
  {
    name: "T11 tempo survives a dropped part",
    input: 'setcpm(80/4)\npad: stack(note("c3"), note("e3")).s("pad")',
    code: "setcpm(80/4)\n",
    dropped: ["pad"],
  },
  {
    name: "T12 timing and chance removed",
    input: 'mel: n("0 2").scale("C4:major").s("piano").sometimesBy(.3, x => x.fast(2)).swingBy(1/3, 4)',
    code: 'mel: n("~").s("piano")\n',
  },
  {
    name: "T13 comments removed and anonymous label kept",
    input: '// my groove\ndrums: s("bd") // kick\n\n$: s("hh*4")',
    code: 'drums: s("~")\n$: s("~")\n',
  },
  {
    name: "T14 setcps kept verbatim",
    input: 'setcps(0.5)\nbass: note("c2").s("ebass")',
    code: 'setcps(0.5)\n\nbass: note("~").s("ebass")\n',
  },
];

describe("templateOfCode", () => {
  for (const c of cases) {
    test(c.name, () => {
      expect(templateOfCode(c.input)).toEqual({ code: c.code, dropped: c.dropped ?? [] });
    });
  }

  test("T15 a template plays no note", async () => {
    for (const c of cases) {
      const out = templateOfCode(c.input).code;
      if (out !== "")
        expect({ name: c.name, events: (await evalHeadless(out, 2)).events }).toEqual({
          name: c.name,
          events: [],
        });
    }
  });

  test("T16 kept labels stay in source order", () => {
    for (const c of cases) {
      const out = templateOfCode(c.input);
      expect(labelledLines(out.code).map((l) => l.label)).toEqual(
        labelledLines(c.input)
          .filter((l) => !l.muted && !out.dropped.includes(l.label))
          .map((l) => l.label),
      );
    }
  });

  test("T17 extraction is pure and repeatable", () => {
    for (const c of cases) expect(templateOfCode(c.input)).toEqual(templateOfCode(c.input));
    // Throwing expressions prove that even retained argument text is never executed by extraction.
    expect(
      templateOfCode(
        "setcpm((() => { throw 1 })())\nmel: note((() => { throw 2 })()).gain((() => { throw 3 })())",
      ).code,
    ).toBe('setcpm((() => { throw 1 })())\n\nmel: note("~").gain((() => { throw 3 })())\n');
  });

  test("empty input, comments and declarations yield no code", () => {
    for (const input of ["", "// no parts", 'const notes = "c4"']) {
      expect(templateOfCode(input)).toEqual({ code: "", dropped: [] });
    }
  });

  test("only the first tempo statement survives", () => {
    expect(templateOfCode('setcpm( 96 / 4 );\nsetcps(.5)\ndrums: s("bd")').code).toBe(
      'setcpm( 96 / 4 );\n\ndrums: s("~")\n',
    );
  });

  test("sound alias, multiple content arguments and only the first content link", () => {
    expect(templateOfCode('keys: sound("piano").n(notes, more).note("c4").gain(.7)').code).toBe(
      'keys: sound("piano").n("~").gain(.7)\n',
    );
    expect(templateOfCode('keys: note(notes, more).sound("piano")').code).toBe(
      'keys: note("~").sound("piano")\n',
    );
    expect(templateOfCode('drums: sound("bd sd")').code).toBe('drums: sound("~")\n');
  });

  test("arrange selects the first referenced const, not declaration order or quoted names", () => {
    const code =
      'const second = s("sd").bank("oak909")\nconst first = s("bd").bank("oak808")\ndrums: arrange([4, "second"], /* second */ [4, first], [4, second]).gain(.5)';
    expect(templateOfCode(code).code).toBe('drums: s("~").bank("oak808").gain(.5)\n');
  });

  test("unsupported expressions and unresolved arrangements are dropped", () => {
    const code =
      'const section = stack(s("bd"), s("sd"))\na: "c3".note()\nb: cat(s("bd"))\nc: note("c3").gain\nd: arrange([4, missing])\ne: arrange([4, section])\nf_: s("hh")';
    expect(templateOfCode(code)).toEqual({ code: "", dropped: ["a", "b", "c", "d", "e", "f_"] });
  });

  test("multiline chains keep sound argument text and drop musical transformations", () => {
    expect(
      templateOfCode('bass: note("c2")\n  .fast(2)\n  .lpf(sine.range(400, 900)) // filter\n  .gain(.6)')
        .code,
    ).toBe('bass: note("~").lpf(sine.range(400, 900)).gain(.6)\n');
  });
});
