// JC1 ii–V Ballad (content/specs/J2.md "JC1 ii–V Ballad"; contracts §2.6, §6.6): the brief of content/capstones.ts
// graded through the real grader in capstone mode, the way the capstone workspace grades a save.
//   - The rubric: the four required lines of §6.6 as contracts 1.8 settled them, and one suggestion that keeps the
//     workspace from adding a Band under a piece that carries its own drums.
//   - The sessions: S1 opens the starter and works on the bars and the keys; S2 adds the tune, reviews, releases.
//   - Each piece of pieces.ts fails exactly the required lines it should, the wrong pieces that use the right
//     function (one key, a muted tune, muted comping, a guide tone reached by a leap) included.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { ComposeBriefEx, GradeResult, SessionId } from "@oak/content-kit";
import { stripMarkers } from "@oak/content-kit";
import * as grader from "@oak/grader";
import { CAPSTONE_LINER_PROMPTS, CAPSTONE_LINER_SEEDS, capstoneById } from "../../../capstones.ts";
import { toolbox } from "../../../toolbox.ts";
import { evaluate, lint, unlockedFor } from "../../../validate/harness.ts";
import { JC1_PIECES, JC1_TEMPLATE } from "./pieces.ts";

setDefaultTimeout(120_000);

const jc1 = capstoneById.get("JC1");
const brief = jc1?.brief as ComposeBriefEx;

/**
 * Graded as the workspace grades a save of a brief without a key: capstone mode, the brief's rubric, and the
 * workspace's fallback key (no rule of JC1 reads the key: the keys are the ones the ii–Vs aim at).
 */
const grade = (code: string, session = "JC1.S1") =>
  grader.gradeExercise({
    exercise: brief,
    response: { code },
    ctx: {
      exerciseGlobalId: "JC1/brief",
      mode: "capstone",
      key: { tonic: "C", mode: "major" },
      meter: "4/4",
      bpm: 74,
      swing: { subdivision: 8, amount: 1 / 3 },
      params: {},
      attemptNo: 1,
      firstAttempt: true,
      rung: 0,
      tutorHints: 0,
      extraReplays: 0,
      lint: {
        profile: "graded",
        unlocked: unlockedFor(session as SessionId),
        allowPreview: false,
        meter: "4/4",
        key: null,
      },
    },
  });
const requiredFailing = (r: GradeResult) =>
  (r.rubric ?? [])
    .filter((x) => x.required && !x.ok)
    .map((x) => x.ruleId)
    .sort();
const detail = (r: GradeResult, id: string): string =>
  String((r.rubric ?? []).find((x) => x.ruleId === id)?.diag?.params.detail ?? "");

beforeAll(async () => {
  await grader.initRealm({ toolbox: [...toolbox], lockdown: false });
});

describe("JC1's brief", () => {
  test("four required lines, exactly as contracts §6.6 and 1.8 write them, and one suggestion", () => {
    expect(brief.rubric.map((r) => [r.id, r.rule, r.required])).toEqual([
      ["bars", "bars", true],
      ["ii-v", "custom", true],
      ["guide-tones", "guide-tones", true],
      ["tempo", "tempo-bpm", true],
      ["parts", "tracks", false],
      // Oak 2.0 W4 F1: the book's ending as a suggestion (no skills, never blocks).
      ["ending", "custom", false],
    ]);
    const [bars, iiV, guide, tempo, parts] = brief.rubric;
    expect(bars).toMatchObject({ min: 16, max: 16 });
    expect(iiV).toMatchObject({ fn: "ii-v-chain", params: { minKeys: 3 } });
    expect(guide).toMatchObject({
      track: "@melody",
      harmony: "@chords",
      minRatio: 0.7,
      at: "change",
      maxMoveSemis: 2,
    });
    expect(tempo).toMatchObject({ min: 56, max: 92 });
    // The four parts are the learner's: the workspace's Band would double the chords and the bass.
    expect(parts).toMatchObject({ min: 4, roles: ["drums", "bass", "chords", "melody"] });
    expect(jc1?.opensAfter).toEqual({ checkpoints: ["J.CP1"] });
    expect(jc1?.bpm).toEqual([56, 92]);
    expect(jc1?.key).toBeUndefined();
  });

  test("S1 opens the starter and works on the bars and the keys; only S2 reviews and releases", () => {
    const ids = new Set(brief.rubric.map((r) => r.id));
    expect(jc1?.sessionDefs.map((s) => [s.id, s.goal])).toEqual([
      ["JC1.S1", "16 bars over chained ii–Vs in at least 3 keys."],
      ["JC1.S2", "Guide-tone melody; release."],
    ]);
    expect(jc1?.sessionDefs.map((s) => s.focusRules)).toEqual([["bars", "ii-v"], [...ids]]);
    expect(jc1?.sessionDefs[0]?.starter).toBe(JC1_TEMPLATE);
    expect(brief.code.starter).toBe(JC1_TEMPLATE);
    expect(jc1?.sessionDefs.map((s) => [!!s.review, !!s.release])).toEqual([
      [false, false],
      [true, true],
    ]);
    expect(jc1?.reviewRevisions).toBe(2);
  });

  test("the brief leaves the choices open and says so, in plain words", () => {
    expect(brief.brief).toMatch(/at least three keys/);
    expect(brief.brief).toMatch(/are yours/);
    expect(brief.brief.split(/\s+/).length).toBeLessThanOrEqual(60);
    for (const t of [brief.brief, ...(brief.hints ?? []).map((h) => (typeof h === "string" ? "" : h.text))])
      expect([t, /!|\bsimply\b|\bjust\b|\beasy\b/i.test(t)]).toEqual([t, false]);
  });

  test("the release asks about the learner's keys and offers three first lines", () => {
    expect(CAPSTONE_LINER_PROMPTS.JC1).toBe("Which keys did you choose, and why in that order?");
    const seeds = CAPSTONE_LINER_SEEDS.JC1 ?? [];
    expect(seeds.length).toBe(3);
    for (const t of seeds) expect([t, /!|amazing|awesome|easy|simply|just /i.test(t)]).toEqual([t, false]);
  });
});

describe("the starter", () => {
  test("plays eight bars with drums, comping and bass, every pitched line read from `changes`, and lints at S1", async () => {
    const code = stripMarkers(JC1_TEMPLATE).code;
    const ev = await evaluate(code, 8);
    expect(ev.ok).toBe(true);
    expect([...new Set(ev.tracks)].sort()).toEqual(["bass", "chords", "drums", "hats"]);
    expect(ev.events.length).toBeGreaterThan(0);
    expect(code.match(/chord\(changes\)/g)?.length).toBe(2);
    expect(lint(code, { session: "JC1.S1" as SessionId, meter: "4/4", profile: "graded" }).ok).toBe(true);
  });
  test("fails on the bars, the keys and the tune, and says how many keys it reaches", async () => {
    const r = await grade(JC1_TEMPLATE);
    expect(requiredFailing(r)).toEqual(["bars", "guide-tones", "ii-v"]);
    expect(detail(r, "bars")).toMatch(/^8 bars/);
    expect(detail(r, "ii-v")).toMatch(/2 keys \(C major, E♭ major\)/);
  });
});

describe("passing pieces, one per shipped flavour and two more", () => {
  // [name, code, the keys its ii–Vs aim at]: C F B♭ E♭; D C B♭ and D minor; D C B♭ A♭ G F E♭ D♭.
  const passing: [string, string, number][] = [
    ["jazz-soul, round the cycle", JC1_PIECES.jazzSoul, 4],
    ["pop, hand shells, home in D minor", JC1_PIECES.pop, 4],
    ["indie, the thread as whole notes", JC1_PIECES.indie, 4],
    ["funk, a chain that never lands", JC1_PIECES.funk, 8],
    ["minimal at 56", JC1_PIECES.minimal, 4],
    ["decorated at 92", JC1_PIECES.decorated, 4],
  ];
  const value = (r: GradeResult, id: string) => (r.rubric ?? []).find((x) => x.ruleId === id)?.value;
  for (const [name, code, keys] of passing)
    test(name, async () => {
      const r = await grade(code, "JC1.S2");
      expect(requiredFailing(r)).toEqual([]);
      expect(value(r, "ii-v")).toBe(keys);
      // Every change of the piece met by a guide tone, a step or less from the last.
      expect(value(r, "guide-tones")).toBe(1);
    });
});

describe("wrong pieces fail exactly the line they break", () => {
  const failing: [string, string, string[], RegExp?][] = [
    ["one key, the right function: four ii–V–Is into C", JC1_PIECES.oneKey, ["ii-v"], /1 key \(C major\)/],
    ["two keys over sixteen bars", JC1_PIECES.twoKeys, ["ii-v"], /2 keys/],
    ["a guide tone reached by a tritone", JC1_PIECES.leap, ["guide-tones"], /moves 6 half steps/],
    ["roots at the changes", JC1_PIECES.roots, ["guide-tones"], /the root/],
    ["the tune at gain 0", JC1_PIECES.silentMel, ["guide-tones"], /the line rests/],
    ["the comping at gain 0", JC1_PIECES.mutedChords, ["guide-tones", "ii-v"]],
    ["no tune", JC1_PIECES.noMelody, ["guide-tones"]],
    ["100 BPM", JC1_PIECES.fast, ["tempo"]],
    ["fifteen bars", JC1_PIECES.bars15, ["bars"]],
    ["seventeen bars", JC1_PIECES.bars17, ["bars"]],
  ];
  for (const [name, code, ids, text] of failing)
    test(name, async () => {
      const r = await grade(code, "JC1.S2");
      expect(requiredFailing(r)).toEqual([...ids].sort());
      if (text) expect(detail(r, ids[0] as string)).toMatch(text);
    });
  test("the muted comping leaves no ii–V: a chord heard only as its root in the bass is not that chord", async () => {
    const r = await grade(JC1_PIECES.mutedChords, "JC1.S2");
    expect(detail(r, "ii-v")).toMatch(/no ii–V yet/);
  });
});
