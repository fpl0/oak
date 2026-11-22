// RC2 Clave & Polyrhythm (contracts §6.6 RC2, content/specs/R3.md "RC2 Clave & Polyrhythm"): the brief of
// content/capstones.ts graded through the real grader in capstone mode, the way the capstone workspace grades a save.
//   - The rubric: §6.6's lines with the pre-flight's coverage and simultaneity fixes, the heard bell, two suggestions.
//   - The starter (two bars) and what it already meets.
//   - One passing piece per shipped flavour, the minimal piece and one beyond the brief, and other right answers.
//   - Each wrong piece fails ONE required line and says why: a 2-3 clave where 3-2 is asked (the same strokes in the
//     other order, and `.late(1)`, the right function), the two pulses one after the other instead of together, the
//     right call on the wrong grid, a layer that is not heard.
//   - The music the pieces' comments claim, read from the evaluated events.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { ComposeBriefEx, GradeResult, KeySpec, SessionId, UnlockableId } from "@oak/content-kit";
import * as grader from "@oak/grader";
import { CAPSTONE_LINER_PROMPTS, CAPSTONE_LINER_SEEDS, capstoneById } from "../../../capstones.ts";
import { toolbox } from "../../../toolbox.ts";
import { evaluate, lint, unlockedFor } from "../../../validate/harness.ts";
import {
  CLAVE_23,
  CLAVE_32,
  MONTUNO,
  PLAN_ROOTS,
  RC2_PIECES,
  RC2_STARTER,
  RC2_WRONG,
  rc2,
  rc2BriefTests,
} from "./pieces.ts";

setDefaultTimeout(120_000);

const rc2Def = capstoneById.get("RC2");
const brief = rc2Def?.brief as ComposeBriefEx;
const C: KeySpec = { tonic: "C", mode: "major" };
const S2 = unlockedFor("RC2.S2" as SessionId);

const grade = (code: string, unlocked: Set<UnlockableId> = S2) =>
  grader.gradeExercise({
    exercise: brief,
    response: { code },
    ctx: {
      exerciseGlobalId: "RC2/brief",
      mode: "capstone",
      key: C,
      meter: "4/4",
      bpm: 110,
      params: {},
      attemptNo: 1,
      firstAttempt: true,
      rung: 0,
      tutorHints: 0,
      extraReplays: 0,
      lint: { profile: "graded", unlocked, allowPreview: false, meter: "4/4", key: null },
    },
  });
const required = new Set(["clave", "bars", "tresillo", "poly", "euclid", "bell"]);
const requiredFailing = (r: GradeResult) =>
  (r.rubric ?? []).filter((x) => !x.ok && required.has(x.ruleId)).map((x) => x.ruleId);
const detail = (r: GradeResult, id: string): string =>
  String((r.rubric ?? []).find((x) => x.ruleId === id)?.diag?.params.detail ?? "");
const ok = (r: GradeResult, id: string) => (r.rubric ?? []).find((x) => x.ruleId === id)?.ok;

beforeAll(async () => {
  await grader.initRealm({ toolbox: [...toolbox], lockdown: false });
});

describe("RC2's brief", () => {
  test("six required lines (§6.6 with the coverage, simultaneity and heard-bell fixes), then two suggestions", () => {
    expect(brief.rubric.map((r) => [r.id, r.rule, r.required])).toEqual([
      ["clave", "clave", true],
      ["bars", "bars", true],
      ["tresillo", "onsets", true],
      ["poly", "polyrhythm", true],
      ["euclid", "uses", true],
      ["bell", "euclid", true],
      ["parts", "tracks", false],
      ["montuno", "custom", false],
    ]);
    const [clave, bars, tresillo, poly, , bell] = brief.rubric;
    expect(clave).toMatchObject({ track: "perc", type: "son", direction: "3-2", minBars: 8 });
    expect(bars).toMatchObject({ min: 8 });
    expect(tresillo).toMatchObject({
      contains: [
        [0, 1],
        [3, 8],
        [3, 4],
      ],
      perBar: true,
    });
    expect(poly).toMatchObject({ a: "perc2", b: "kick", ratio: [3, 2], minBars: 4 });
    expect(bell).toMatchObject({ track: "perc3", k: 5, n: 16, rotationFree: true });
  });
  test("S1 works on the clave and the bass; S2 adds the layers, reviews and releases", () => {
    const [s1, s2] = rc2Def?.sessionDefs ?? [];
    expect(s1?.focusRules).toEqual(["clave", "bars", "tresillo", "parts", "montuno"]);
    expect(new Set(s2?.focusRules)).toEqual(new Set(brief.rubric.map((r) => r.id)));
    expect(rc2Def?.sessionDefs.map((s) => [!!s.review, !!s.release])).toEqual([
      [false, false],
      [true, true],
    ]);
    expect(brief.code.starter).toBe(RC2_STARTER);
  });
  test("no Band is added under the son: the rubric names drums, bass and chords as the learner's", () => {
    const asked = new Set<string>();
    for (const r of brief.rubric) {
      if (r.rule === "tracks") for (const role of r.roles ?? []) asked.add(role);
      if ("track" in r && typeof r.track === "string" && r.track.startsWith("@")) asked.add(r.track.slice(1));
    }
    expect(["drums", "bass", "chords"].filter((t) => !asked.has(t))).toEqual([]);
  });
  test("the release asks about the layers and offers three first lines in Oak's voice", () => {
    expect(CAPSTONE_LINER_PROMPTS.RC2).toBe(
      "Which layer did you write last, and what did it add to the clave?",
    );
    expect(CAPSTONE_LINER_SEEDS.RC2?.length).toBe(3);
    for (const t of CAPSTONE_LINER_SEEDS.RC2 ?? [])
      expect([t, /!|amazing|awesome|easy|simply|just /i.test(t)]).toEqual([t, false]);
  });
  test("the brief's tests are the pieces of this folder", () => {
    expect(brief.tests).toEqual(rc2BriefTests());
  });
});

describe("RC2 on the real grader (capstone mode, RC2.S2)", () => {
  test("the starter: a two-bar loop; its clave and tresillo already hold, the length and the layers do not", async () => {
    const r = await grade(RC2_STARTER);
    expect(r.status).toBe("fail");
    expect(requiredFailing(r)).toEqual(["bars", "poly", "bell"]);
    expect(detail(r, "bars")).toBe("2 bars; the brief asks for at least 8");
    // `(3,8)` in the bass already meets "written with (k,n)".
    expect([ok(r, "clave"), ok(r, "tresillo"), ok(r, "euclid")]).toEqual([true, true, true]);
  });
  for (const name of Object.keys(RC2_PIECES) as (keyof typeof RC2_PIECES)[])
    test(`passes: ${name}`, async () => {
      const r = await grade(RC2_PIECES[name]);
      expect([r.status, requiredFailing(r)]).toEqual(["pass", []]);
    });
  test("the flavour pieces' montunos face the clave (the suggestion is ticked)", async () => {
    for (const name of ["pop", "funk", "jazzSoul", "indie", "arranged"] as const)
      expect([name, ok(await grade(RC2_PIECES[name]), "montuno")]).toEqual([name, true]);
  });
  const wrong: [keyof typeof RC2_WRONG, string, RegExp][] = [
    [
      "claveTwoBars",
      "clave",
      /^bars 3–4 do not hold the whole son clave 3-2 \(it holds for 2 bars from bar 1\)$/,
    ],
    ["claveTwoThree", "clave", /^bars 1–2 play the son clave 2-3; the brief asks for the son clave 3-2$/],
    ["claveLateOne", "clave", /^bars 1–2 play the son clave 2-3; the brief asks for the son clave 3-2$/],
    ["rumba", "clave", /^bars 1–2 play the rumba clave 3-2; the brief asks for the son clave 3-2$/],
    ["claveExtra", "clave", /plays more than the clave's five strokes$/],
    ["tresilloHalf", "tresillo", /^right in 32 of 64 bars; /],
    ["tumbao", "tresillo", /^right in 0 of 64 bars; /],
    ["polyAlternating", "poly", /never in the same bars: a polyrhythm is the two at once$/],
    ["polySilent", "poly", /^nothing plays in `perc2` that you can hear/],
    ["bellOnEight", "bell", /not spread as evenly as they can go over 16 steps/],
    ["noBell", "bell", /^nothing plays in `perc3` that you can hear/],
  ];
  for (const [name, rule, why] of wrong)
    test(`fails on ${rule} only: ${name}`, async () => {
      const r = await grade(RC2_WRONG[name]);
      expect([r.status, requiredFailing(r)]).toEqual(["fail", [rule]]);
      expect(detail(r, rule)).toMatch(why);
    });
  test("without a bell, the bass's `(3,8)` still meets `uses`: only the heard line fails", async () => {
    const r = await grade(RC2_WRONG.noBell);
    expect([ok(r, "euclid"), ok(r, "bell")]).toEqual([true, false]);
  });
  test("a three-layer far under the rest (28 dB below the rimshot) is not heard", async () => {
    const r = await grade(rc2({ perc2: 'perc2: s("mt*3").gain(.03)' }));
    expect(requiredFailing(r)).toEqual(["poly"]);
  });
  test("a crossed montuno (2-3 against the 3-2 clave) leaves the suggestion open, never the pass", async () => {
    const crossed = rc2({ keys: `keys: note("${MONTUNO}").late(1).s("piano").gain(.6)` });
    const r = await grade(crossed);
    expect([r.status, ok(r, "montuno")]).toEqual(["pass", false]);
  });
  test("every piece lints clean when RC2 opens (RC2.S1) and at RC2.S2", () => {
    for (const session of ["RC2.S1", "RC2.S2"])
      for (const [name, code] of Object.entries({ starter: RC2_STARTER, ...RC2_PIECES, ...RC2_WRONG }))
        expect([
          session,
          name,
          lint(code, { session: session as SessionId, meter: "4/4", profile: "graded" })
            .diagnostics.filter((d) => d.severity === "error")
            .map((d) => d.id),
        ]).toEqual([session, name, []]);
  });
});

const frac = (s: string | number): number => {
  if (typeof s === "number") return s;
  const [a, b] = s.split("/").map(Number);
  return b ? (a as number) / b : (a as number);
};
/** The onsets of a track in steps of `n` per bar, bar by bar. */
async function stepsOf(code: string, track: string, bars: number, n: number): Promise<number[][]> {
  const r = await evaluate(code, bars);
  return Array.from({ length: bars }, (_, b) =>
    r.events
      .filter((e) => e.track === track && Math.floor(frac(e.onset) + 1e-9) === b)
      .map((e) => Math.round((frac(e.onset) - b) * n)),
  );
}

describe("the music the pieces claim, read from the evaluated events", () => {
  test("son 3-2 is {0, 3, 6} then {2, 4} in eighths; 2-3 the other way round; `.late(1)` of 3-2 is 2-3", async () => {
    expect(await stepsOf(`setcpm(110/4)\n\nperc: s("${CLAVE_32}")`, "perc", 2, 8)).toEqual([
      [0, 3, 6],
      [2, 4],
    ]);
    const twoThree = await stepsOf(`setcpm(110/4)\n\nperc: s("${CLAVE_23}")`, "perc", 2, 8);
    expect(twoThree).toEqual([
      [2, 4],
      [0, 3, 6],
    ]);
    expect(await stepsOf(`setcpm(110/4)\n\nperc: s("${CLAVE_32}").late(1)`, "perc", 2, 8)).toEqual(twoThree);
    expect(await stepsOf(`setcpm(110/4)\n\nperc: s("${CLAVE_32}").late(2)`, "perc", 2, 8)).toEqual([
      [0, 3, 6],
      [2, 4],
    ]);
  });
  test("the tresillo is eighths 0, 3 and 6 of every bar; the bass plays the root of the bar's chord", async () => {
    const pop = RC2_PIECES.pop;
    expect(await stepsOf(pop, "bass", 8, 8)).toEqual(Array.from({ length: 8 }, () => [0, 3, 6]));
    const r = await evaluate(pop, 8);
    const rootOf = (b: number) =>
      (r.events.find((e) => e.track === "bass" && Math.floor(frac(e.onset)) === b)?.midi as number) % 12;
    // I V I V IV V I V in C: C G C G F G C G.
    expect(Array.from({ length: 8 }, (_, b) => rootOf(b))).toEqual([0, 7, 0, 7, 5, 7, 0, 7]);
    expect(PLAN_ROOTS.split(" ").length).toBe(8);
    // The montuno's thirds belong to the bar's chord (C E G over C, F A C over F, B D F over G7), except the G7 bar's
    // last eighth, which anticipates the next bar's chord.
    const chordOf = (b: number): number[] => (b === 4 ? [5, 9, 0] : b % 2 === 0 ? [0, 4, 7] : [7, 11, 2, 5]);
    for (let b = 0; b < 8; b++) {
      const keys = r.events.filter((e) => e.track === "keys" && Math.floor(frac(e.onset)) === b);
      const inBar = keys.filter((e) => frac(e.onset) - b < 7 / 8 - 1e-9).map((e) => (e.midi as number) % 12);
      const last = keys.filter((e) => frac(e.onset) - b >= 7 / 8 - 1e-9).map((e) => (e.midi as number) % 12);
      expect([b, inBar.every((p) => chordOf(b).includes(p))]).toEqual([b, true]);
      expect([b, last.every((p) => chordOf((b + 1) % 8).includes(p))]).toEqual([b, true]);
    }
  });
  test("three even hits against two meet only on the one; `cb(5,16,10)` is 3+3+4+3+3", async () => {
    const pop = RC2_PIECES.pop;
    expect(await stepsOf(pop, "perc2", 1, 12)).toEqual([[0, 4, 8]]);
    expect(await stepsOf(pop, "kick", 1, 12)).toEqual([[0, 6]]);
    const bell = (await stepsOf(pop, "perc3", 1, 16))[0] as number[];
    expect(bell).toEqual([0, 3, 6, 10, 13]);
    expect(bell.map((s, i) => (bell[i + 1] ?? 16) - s)).toEqual([3, 3, 4, 3, 3]);
  });
  test("the montuno faces the clave: more of its hits meet the clave as written than turned round", async () => {
    const montuno = await stepsOf(`setcpm(110/4)\n\nkeys: note("${MONTUNO}")`, "keys", 2, 8);
    const meet = (clave: number[][]) =>
      montuno.reduce((n, bar, b) => n + [...new Set(bar)].filter((s) => clave[b]?.includes(s)).length, 0);
    expect([
      meet([
        [0, 3, 6],
        [2, 4],
      ]),
      meet([
        [2, 4],
        [0, 3, 6],
      ]),
    ]).toEqual([5, 1]);
  });
});
