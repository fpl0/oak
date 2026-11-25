import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { strudel } from "../analyze/__support__/fixtures.ts";
import type { RubricContext } from "./context.ts";
import type { CorrectionEval } from "./corrections-rules.ts";
import { oak2PitchRules } from "./oak2-pitch.ts";
import { oak2RhythmRules } from "./oak2-rhythm.ts";
import { CUSTOM_DEPS, CUSTOM_RULES } from "./rules.ts";

setDefaultTimeout(30_000);
const rules = { ...oak2RhythmRules(CUSTOM_DEPS), ...oak2PitchRules(CUSTOM_DEPS) };
const codeOf = (body: string, meter = "4/4") => `setcpm(120/${meter === "3/4" ? 3 : 4})\n\n${body}`;
type Options = Partial<Pick<RubricContext, "meter" | "pickup">> & { bars?: number };
async function run(name: string, body: string, params: Record<string, unknown> = {}, opts: Options = {}) {
  const bars = opts.bars ?? 4;
  const code = codeOf(body, opts.meter);
  const n = await strudel(code, bars);
  const ctx: RubricContext = {
    code,
    meter: opts.meter ?? "4/4",
    params: {},
    bars,
    totalBars: bars,
    ...(opts.pickup ? { pickup: opts.pickup } : {}),
  };
  const r = rules[name]?.(n, ctx, params);
  if (!r) throw new Error(`Missing rule ${name}`);
  checkDetail(r);
  if (name === "bass-names-chord" && !r.ok) {
    // The pitch helper's stricter detail and location checks apply to every pitch failure.
    expect(r.detail).not.toMatch(/semitone|[.!?].*\S|\n/i);
    expect(r.where?.track).toBeTruthy();
    expect(r.where?.bar).toBeDefined();
  }
  return r;
}
function checkDetail(r: CorrectionEval) {
  if (r.ok) return;
  expect(r.detail).not.toMatch(/semitone|[\r\n]|[.!?]\s+[A-Z]/i);
  expect(r.detail.length).toBeGreaterThan(10);
}
function check(r: CorrectionEval, ok: boolean, detail?: RegExp) {
  if (r.ok !== ok) throw new Error(`Expected ${ok ? "pass" : "failure"}: ${r.detail}`);
  if (detail) expect(r.detail).toMatch(detail);
}
const kick = 'drums: s("bd*4")';
const held = `${kick}\nbass: note("[~ c2@3 ~ g2@2 ~]").s("sawtooth")`;
const bass = (notes: string, tail = "") => `${kick}\nbass: note("${notes}").s("sawtooth")${tail}`;
const harmony = (chords: string, low = "d2") =>
  `chords: note("${chords}").s("piano")\nbass: note("${low}").s("sawtooth")`;
const stacked = { quality: "m11", stack: [5, 4] };

describe("X23 rule acceptance", () => {
  test("AC1 held bass passes with clear attacks only when onsetsOnly is true", async () => {
    check(await run("kick-bass-composite", held, { minBassPerBar: 2, onsetsOnly: true }), true);
    check(await run("kick-bass-composite", held, { minBassPerBar: 2 }), false, /Shorten/);
  });
  test("AC2 onsetsOnly preserves collisions, stacked bass, empty bars and near collisions", async () => {
    for (const [code, detail] of [
      [bass("c2*4"), /take turns/],
      [bass("~ [c2,g2] ~ ~ ~ ~ ~ ~"), /another bass/],
      [bass("<[~ c2@7] ~ ~ ~>"), /more/],
      [bass("c2*4", ".late(1/64).clip(.5)"), /take turns/],
      [bass("[~ c2 g2 ~]*4", ".clip(1.5)"), /another bass/],
      [kick, /audible/],
      ['bass: note("c2").s("sawtooth")', /kick drum/],
    ] as const)
      check(await run("kick-bass-composite", code, { onsetsOnly: true, minBassPerBar: 1 }), false, detail);
  });
  test("AC3 explicit false is identical to the strict default", async () => {
    expect(await run("kick-bass-composite", held, { onsetsOnly: false, minBassPerBar: 2 })).toEqual(
      await run("kick-bass-composite", held, { minBassPerBar: 2 }),
    );
  });
  test("AC4 simple linear beat and partial grid pass; full grids and extra hits fail", async () => {
    for (const code of [
      'drums: s("bd ~ hh ~ sd ~ hh ~ bd ~ hh ~ sd ~ hh ~")',
      'drums: s("rd ~ rd ~ rd ~ rd ~ ~ bd ~ sd ~ bd ~ sd")',
    ])
      check(await run("linear-drums", code), true);
    for (const code of [
      'drums: s("hh bd hh ~ hh sd hh ~ hh bd hh ~ hh sd hh ~")',
      'drums: s("hh bd hh hh hh sd hh ~ hh bd hh hh hh sd hh ~")',
      'hats: s("hh*16")',
    ])
      check(await run("linear-drums", code), false, /evenly spaced/);
  });
  test("AC5 sparse even parts pass and the meter sets the complete grid", async () => {
    check(
      await run(
        "linear-drums",
        'drums: s("bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~")\nsnare: s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~")\nhats: s("~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~")',
      ),
      true,
    );
    check(await run("linear-drums", 'drums: s("rd bd ~ ~ rd sd ~ ~ rd bd ~ ~ rd sd ~ ~")'), true);
    const other = '\nkick: s("~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~")\nsnare: s("~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~")';
    for (const meter of ["3/4", "6/8"] as const) {
      check(
        await run("linear-drums", `hats: s("hh ~ hh ~ hh ~ hh ~ hh ~ hh ~")${other}`, {}, { meter }),
        false,
        /evenly spaced/,
      );
      check(
        await run("linear-drums", `hats: s("hh ~ hh ~ hh ~ hh ~ hh ~ ~ ~")${other}`, {}, { meter }),
        true,
      );
    }
    check(await run("linear-drums", 'drums: s("[bd,hh] hh sd hh hh bd hh sd")'), false, /first beat/);
    check(await run("linear-drums", 'drums: s("bd ~ ~ ~")'), false, /more drum/);
  });
  test("AC6 stack distinguishes thirds, fourths, So What and wrong bass", async () => {
    const thirds = harmony("[f3,a3,c4,e4,g4]");
    check(await run("bass-names-chord", thirds, { quality: "m11" }), true);
    const r = await run("bass-names-chord", thirds, stacked);
    check(r, false);
    expect(r.detail).toBe(
      "Stack the chord notes 5 or 4 half steps apart so the bass can make the requested m11 harmony",
    );
    expect(r.where).toMatchObject({ track: "chords", bar: 1 });
    check(await run("bass-names-chord", harmony("[d3,g3,c4,f4]"), stacked), true);
    check(await run("bass-names-chord", harmony("[e3,a3,d4,g4,b4]", "e2"), stacked), true);
    const wrongBass = await run("bass-names-chord", harmony("[d3,g3,c4,f4]", "g1"), stacked);
    check(wrongBass, false);
    expect(wrongBass.detail).toBe("Change the bass beneath the chords to make the requested m11 harmony");
    expect(wrongBass.where?.track).toBe("bass");
  });
  test("AC6 stack uses duration weighting and points to the first bad stack", async () => {
    const code = harmony("<[d3,g3,c4,f4] [f3,a3,c4,e4,g4]>");
    const r = await run("bass-names-chord", code, stacked);
    check(r, false);
    expect(r.value).toBe(0.5);
    expect(r.where).toMatchObject({ track: "chords", bar: 2 });
    check(await run("bass-names-chord", code, { ...stacked, min: 0.5 }), true);
  });
  test("AC6 invalid stack params fail with a chords location", async () => {
    for (const stack of [[], [5, "4"], [0], [-1], [4.5], "5", null]) {
      const r = await run("bass-names-chord", harmony("[d3,g3,c4,f4]"), { quality: "m11", stack });
      check(r, false, /Choose the gaps/);
      expect(r.where?.track).toBe("@chords");
    }
  });
});

// grouping-accents retains its existing multi-sentence detail contract; the Oak rhythm/pitch checks above
// do not apply to that legacy rule. Call CUSTOM_RULES directly as the Wave 7 tests do.
async function grouping(body: string, allowOthers?: boolean) {
  const code = codeOf(body);
  const n = await strudel(code, 4);
  const ctx: RubricContext = { code, meter: "4/4", params: {}, bars: 4, totalBars: 4 };
  const rule = CUSTOM_RULES["grouping-accents"];
  if (!rule) throw new Error("Missing grouping-accents");
  return rule(n, ctx, { groups: ["3", "3", "2"], ...(allowOthers === undefined ? {} : { allowOthers }) });
}
test("AC8 grouping allows other accents only with allowOthers and still requires each start", async () => {
  const extra = 'drums: s("bd ~ hh ~ sd ~ bd ~ hh ~ sd ~ bd ~ hh ~")';
  check(await grouping(extra), false);
  expect(await grouping(extra, false)).toEqual(await grouping(extra));
  check(await grouping(extra, true), true);
  const starts = 'drums: s("bd ~ hh ~ hh ~ bd ~ hh ~ hh ~ bd ~ hh ~")';
  check(await grouping(starts), true);
  check(await grouping(starts, true), true);
  const missing = await grouping('drums: s("bd ~ hh ~ sd ~ hh ~ bd ~ hh ~ sd ~ hh ~")', true);
  check(missing, false);
  expect(missing.detail).toEndWith(". In bar 1 a group starts without an accent");
  expect(missing.where?.bar).toBe(1);
});
