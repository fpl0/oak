// RC1 16th-Note Funk (contracts §6.6 RC1, content/specs/R3.md "RC1 16th-Note Funk"): the brief of content/capstones.ts
// graded through the real grader in capstone mode, the way the capstone workspace grades a save.
//   - The rubric: the five required lines of §6.6, each read from what is heard, and the spec's suggestions.
//   - The starter fails the off-grid bass and the stabs and meets the other three (the spec pins it).
//   - One passing piece per shipped flavour on the real `horns` at RC1.S2, the minimal piece and one beyond the brief
//     (sections, a displaced horn figure, Dorian for a learner who has it).
//   - Each wrong piece fails ONE required line and says why, the right-function wrong answers among them.
//   - The lint: `horns` before RC1.S2, Dorian before U14.L03, `.nudge()`.
//   - The music the pieces' comments claim, read from the evaluated events.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { ComposeBriefEx, GradeResult, KeySpec, SessionId, UnlockableId } from "@oak/content-kit";
import { stripMarkers } from "@oak/content-kit";
import * as grader from "@oak/grader";
import { CAPSTONE_LINER_PROMPTS, CAPSTONE_LINER_SEEDS, capstoneById } from "../../../capstones.ts";
import { toolbox } from "../../../toolbox.ts";
import { evaluate, lint, unlockedFor } from "../../../validate/harness.ts";
import {
  CLAV_STRUCT,
  POCKET_BASS,
  RC1_STARTER,
  RC1_STARTER_CODE,
  rc1,
  rc1BriefTests,
  rc1Dorian,
  rc1Pieces,
  rc1Wrong,
} from "./pieces.ts";

setDefaultTimeout(120_000);

const rc1Def = capstoneById.get("RC1");
const brief = rc1Def?.brief as ComposeBriefEx;
const CM: KeySpec = { tonic: "C", mode: "minor" };
const S2 = unlockedFor("RC1.S2" as SessionId);

/** Graded as the workspace grades a save: capstone mode, the brief's rubric, the unlocks of the session. */
const grade = (code: string, unlocked: Set<UnlockableId> = S2, key: KeySpec = CM) =>
  grader.gradeExercise({
    exercise: brief,
    response: { code },
    ctx: {
      exerciseGlobalId: "RC1/brief",
      mode: "capstone",
      key,
      meter: "4/4",
      bpm: 100,
      params: {},
      attemptNo: 1,
      firstAttempt: true,
      rung: 0,
      tutorHints: 0,
      extraReplays: 0,
      lint: { profile: "graded", unlocked, allowPreview: false, meter: "4/4", key: null },
    },
  });
const required = new Set(["ghosts", "syncopated-bass", "one-bass", "one-kick", "horns"]);
const requiredFailing = (r: GradeResult) =>
  (r.rubric ?? []).filter((x) => !x.ok && required.has(x.ruleId)).map((x) => x.ruleId);
const detail = (r: GradeResult, id: string): string =>
  String((r.rubric ?? []).find((x) => x.ruleId === id)?.diag?.params.detail ?? "");

beforeAll(async () => {
  await grader.initRealm({ toolbox: [...toolbox], lockdown: false });
});

describe("RC1's brief", () => {
  test("five required lines as contracts §6.6 writes them, each read from what is heard, then four suggestions", () => {
    expect(brief.rubric.map((r) => [r.id, r.rule, r.required])).toEqual([
      ["ghosts", "velocity-ghosts", true],
      ["syncopated-bass", "velocity-ghosts", true],
      ["one-bass", "onsets", true],
      ["one-kick", "onsets", true],
      ["horns", "custom", true],
      ["tempo", "tempo-bpm", false],
      ["parts", "tracks", false],
      ["clav", "sounds", false],
      ["displaced", "custom", false],
    ]);
    const [ghosts, bass, , , horns] = brief.rubric;
    expect(ghosts).toMatchObject({
      track: "@drums",
      drum: "hatClosed",
      min: 4,
      on: "16th-offbeat",
      accents: 2,
    });
    expect(bass).toMatchObject({ track: "@bass", min: 3, on: "16th-offbeat" });
    expect(horns).toMatchObject({ fn: "stabs", params: { track: "horns", min: 2, perBars: 2 } });
    expect(brief.flavours).toEqual(["flavour.pop", "flavour.jazz-soul", "flavour.indie", "flavour.funk"]);
  });
  test("S1 works on the pocket; S2 adds the stabs and the clav, reviews and releases", () => {
    const ids = new Set(brief.rubric.map((r) => r.id));
    const [s1, s2] = rc1Def?.sessionDefs ?? [];
    expect(s1?.focusRules).toEqual(["ghosts", "syncopated-bass", "one-bass", "one-kick", "tempo"]);
    expect(new Set(s2?.focusRules)).toEqual(ids);
    expect(rc1Def?.sessionDefs.map((s) => [!!s.review, !!s.release])).toEqual([
      [false, false],
      [true, true],
    ]);
    expect(brief.code.starter).toBe(RC1_STARTER);
    expect(stripMarkers(RC1_STARTER).code).toBe(RC1_STARTER_CODE);
  });
  test("no Band is added: the rubric names drums, bass and chords as the learner's (bandTracksFor)", () => {
    // app/src/capstone/content.ts `bandTracksFor`: the roles a rubric asks the learner to write get no Band part.
    const asked = new Set<string>();
    for (const r of brief.rubric) {
      if (r.rule === "tracks") for (const role of r.roles ?? []) asked.add(role);
      if ("track" in r && typeof r.track === "string" && r.track.startsWith("@")) asked.add(r.track.slice(1));
    }
    expect(["drums", "bass", "chords"].filter((t) => !asked.has(t))).toEqual([]);
  });
  test("the release asks about the groove and offers three first lines in Oak's voice", () => {
    expect(CAPSTONE_LINER_PROMPTS.RC1).toBe("What keeps your groove moving when the chord never changes?");
    expect(CAPSTONE_LINER_SEEDS.RC1?.length).toBe(3);
    for (const t of CAPSTONE_LINER_SEEDS.RC1 ?? [])
      expect([t, /!|amazing|awesome|easy|simply|just /i.test(t)]).toEqual([t, false]);
  });
  test("the brief's tests are the pieces of this folder, the stabs on a synth (linted at RC1.S1)", () => {
    expect(brief.tests).toEqual(rc1BriefTests());
    expect(brief.tests.filter((t) => t.expect === "pass").length).toBe(6);
    expect(brief.tests.filter((t) => t.expect === "fail").length).toBe(10);
  });
});

describe("RC1 on the real grader (capstone mode, RC1.S2, the real horns)", () => {
  const P = rc1Pieces("horns");
  const W = rc1Wrong("horns");
  test("the starter: the pocket holds, the bass sits on the eighth grid and there are no horns", async () => {
    const r = await grade(RC1_STARTER_CODE);
    expect(r.status).toBe("fail");
    expect(requiredFailing(r)).toEqual(["syncopated-bass", "horns"]);
    expect(detail(r, "horns")).toMatch(/^nothing plays in `horns` that you can hear/);
  });
  for (const name of ["funk", "jazzSoul", "pop", "indie", "minimal", "arranged"] as const)
    test(`passes: ${name}`, async () => {
      const r = await grade(P[name]);
      expect([r.status, requiredFailing(r)]).toEqual(["pass", []]);
    });
  test("the funk piece meets the clav and parts suggestions; the arranged one also the displaced figure", async () => {
    const funk = await grade(P.funk);
    const ok = (r: GradeResult, id: string) => (r.rubric ?? []).find((x) => x.ruleId === id)?.ok;
    expect([ok(funk, "clav"), ok(funk, "parts"), ok(funk, "tempo"), ok(funk, "displaced")]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    const arranged = await grade(P.arranged);
    expect(ok(arranged, "displaced")).toBe(true);
  });
  const wrong: [keyof typeof W, string, RegExp][] = [
    ["ghostsSilent", "ghosts", /0 ghost notes on 16th off-beats/],
    ["hatsAllQuiet", "ghosts", /every hi-hat hit is quiet/],
    ["ghostsOnBeats", "ghosts", /on the eighth-note grid/],
    ["bassLateEighth", "syncopated-bass", /^0 notes on `bass` on the 16ths between the eighths; at least 3$/],
    ["bassMissesOne", "one-bass", /^right in 48 of 64 bars; /],
    ["kickMissesOne", "one-kick", /^right in 48 of 64 bars; /],
    ["hornsHeld", "horns", /holds a note; a stab is short/],
    ["hornsSilent", "horns", /^nothing plays in `horns` that you can hear/],
    ["hornsSparse", "horns", /^bars 1–2: 1 stab; at least 2 every 2 bars$/],
  ];
  for (const [name, rule, why] of wrong)
    test(`fails on ${rule} only: ${name}`, async () => {
      const r = await grade(W[name]);
      expect([r.status, requiredFailing(r)]).toEqual(["fail", [rule]]);
      expect(detail(r, rule)).toMatch(why);
    });
  test("the right function, the wrong result: the starter's bass `.late(1/8)` still meets the one", async () => {
    const r = await grade(W.bassLateEighth);
    expect((r.rubric ?? []).find((x) => x.ruleId === "one-bass")?.ok).toBe(true);
  });
  test("the e and the a at velocity .6, as loud as the and, are no ghost notes", async () => {
    const r = await grade(rc1({ hats: 'hats: s("hh*16").velocity("[1 .6 .6 .6]*4")' }));
    expect(requiredFailing(r)).toEqual(["ghosts"]);
  });
});

describe("Dorian and the lint", () => {
  const dorian = rc1Dorian("horns");
  test("beyond the brief: the arranged piece in C Dorian passes for a learner who has U14.L03", async () => {
    const withDorian = new Set([...S2, ...unlockedFor("U14.L03" as SessionId)]);
    const r = await grade(dorian, withDorian);
    expect([r.status, requiredFailing(r)]).toEqual(["pass", []]);
  });
  test("the Dorian bass plays C Dorian's raised 6 (A) and ♭7 (B♭)", async () => {
    const r = await evaluate(dorian, 1);
    const pcs = new Set(r.events.filter((e) => e.track === "bass").map((e) => (e.midi as number) % 12));
    expect([...pcs].sort((a, b) => a - b)).toEqual([0, 3, 5, 9, 10]);
  });
  test("Dorian before U14.L03 is locked (no legal route guarantees it at RC1)", () => {
    const ids = lint(dorian, {
      session: "RC1.S2" as SessionId,
      meter: "4/4",
      profile: "graded",
    }).diagnostics.map((d) => d.id);
    expect(ids).toContain("code.locked-scale");
  });
  test("`horns` before RC1.S2 is locked when U15.L05 has not opened it; at RC1.S2 it is the learner's", () => {
    const code = rc1Pieces("horns").funk;
    const at = (s: string) =>
      lint(code, { session: s as SessionId, meter: "4/4", profile: "graded" })
        .diagnostics.filter((d) => d.severity === "error")
        .map((d) => d.id);
    expect(at("RC1.S1")).toEqual(["code.locked-sound"]);
    expect(at("RC1.S2")).toEqual([]);
  });
  test("`.nudge()` is Studio's: `code.nudge-studio-only`", () => {
    const code = rc1({ horns: null }).replace(
      '.velocity("[1 .3 .6 .3]*4")',
      '.velocity("[1 .3 .6 .3]*4").nudge(.01)',
    );
    const ids = lint(code, {
      session: "RC1.S2" as SessionId,
      meter: "4/4",
      profile: "graded",
    }).diagnostics.map((d) => d.id);
    expect(ids).toContain("code.nudge-studio-only");
  });
  test("every brief piece lints clean at RC1.S1 with the synth stabs, and at RC1.S2 with the horns", () => {
    for (const [session, sound] of [
      ["RC1.S1", "sawtooth"],
      ["RC1.S2", "horns"],
    ] as const)
      for (const [name, code] of Object.entries({ ...rc1Pieces(sound), ...rc1Wrong(sound) }))
        expect([
          session,
          name,
          lint(code, { session: session as SessionId, meter: "4/4", profile: "graded" })
            .diagnostics.filter((d) => d.severity === "error")
            .map((d) => d.id),
        ]).toEqual([session, name, []]);
  });
});

/** Onsets of one track in sixteenths of the bar (0–15), from bar 0 of the evaluated piece. */
const frac = (s: string | number): number => {
  if (typeof s === "number") return s;
  const [a, b] = s.split("/").map(Number);
  return b ? (a as number) / b : (a as number);
};
describe("the music the pieces claim, read from the evaluated events", () => {
  test("the pocket bass: steps 0 3 6 9 11 13 14, four on an e or an a, the one with the kick", async () => {
    const r = await evaluate(rc1Pieces("horns").funk, 1);
    const steps = (track: string) =>
      r.events.filter((e) => e.track === track).map((e) => Math.round(frac(e.onset) * 16));
    expect(steps("bass")).toEqual([0, 3, 6, 9, 11, 13, 14]);
    expect(steps("bass").filter((s) => s % 2 === 1)).toEqual([3, 9, 11, 13]);
    expect(steps("kick")).toEqual([0, 7, 10]);
    // The clav interlocks: none of its places is a bass place.
    expect([...new Set(steps("keys"))]).toEqual([2, 4, 7, 10, 12]);
    expect([...new Set(steps("keys"))].filter((s) => steps("bass").includes(s))).toEqual([]);
    // Two stabs a bar, each a sixteenth long.
    const horns = r.events.filter((e) => e.track === "horns");
    expect([...new Set(horns.map((e) => Math.round(frac(e.onset) * 16)))]).toEqual([6, 15]);
    for (const e of horns) expect(frac(e.end) - frac(e.begin)).toBeLessThanOrEqual(1 / 8);
    expect(POCKET_BASS.split(" ").length).toBe(16);
    expect(CLAV_STRUCT.split(" ").length).toBe(16);
  });
  test("every flavour's bass stays on the minor pentatonic of its home note", async () => {
    const P = rc1Pieces("horns");
    const homes: [string, number][] = [
      [P.funk, 0],
      [P.jazzSoul, 5],
      [P.pop, 9],
      [P.indie, 4],
    ];
    for (const [code, home] of homes) {
      const r = await evaluate(code, 1);
      const pcs = new Set(
        r.events.filter((e) => e.track === "bass").map((e) => ((((e.midi as number) - home) % 12) + 12) % 12),
      );
      expect([home, [...pcs].sort((a, b) => a - b)]).toEqual([home, [0, 3, 5, 7, 10]]);
    }
  });
  test("the hats: an accent on each beat, two ghost notes (.3) on its e and a", async () => {
    const r = await evaluate(rc1Pieces("horns").funk, 1);
    const hats = r.events.filter((e) => e.track === "hats");
    expect(hats.length).toBe(16);
    const level = (e: (typeof hats)[number]) =>
      Number((e as { value?: { velocity?: number } }).value?.velocity ?? 1);
    expect(hats.map(level)).toEqual(Array.from({ length: 4 }, () => [1, 0.3, 0.6, 0.3]).flat());
  });
});
