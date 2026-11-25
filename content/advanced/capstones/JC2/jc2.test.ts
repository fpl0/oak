// JC2 Jazz Blues in F (content/specs/JC2.md; contracts §2.6, §6.6): the brief of content/capstones.ts graded through
// the real grader in capstone mode, the way the capstone workspace grades a save.
//   - The rubric: §6.6's four lines with the spec's bodies (two choruses, the walk read against the comping's
//     chords), the spec's `head`, three suggestions that never gate.
//   - The sessions: S1 opens U11's blues and builds the band; S2 adds the head, reviews, releases.
//   - Each piece of pieces.ts fails exactly the required lines it should: the walk crowded into beat 1 and the
//     roots four to the bar (the right function, no walk), the swing on the bass (the right function, the wrong
//     line), the head at gain 0 (the right line, not heard).
//   - The musical claims of pieces.ts: the reference walk has a chord tone on beat 3 in every bar and approaches
//     every bar line by a step; the comping on 2 and 4 passes (the brief leaves the comping rhythm free).
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { ComposeBriefEx, GradeResult, SessionId } from "@oak/content-kit";
import { stripMarkers } from "@oak/content-kit";
import * as grader from "@oak/grader";
import { CAPSTONE_LINER_PROMPTS, CAPSTONE_LINER_SEEDS, capstoneById } from "../../../capstones.ts";
import { toolbox } from "../../../toolbox.ts";
import { evaluate, lint, unlockedFor } from "../../../validate/harness.ts";
import { JC2_PIECES, JC2_TEMPLATE, U11_BLUES } from "./pieces.ts";

setDefaultTimeout(120_000);

const jc2 = capstoneById.get("JC2");
const brief = jc2?.brief as ComposeBriefEx;

/** Graded as the workspace grades a save: capstone mode, the brief's rubric, the brief's key (F, read as a blues). */
const grade = (code: string, session = "JC2.S1") =>
  grader.gradeExercise({
    exercise: brief,
    response: { code },
    ctx: {
      exerciseGlobalId: "JC2/brief",
      mode: "capstone",
      key: { tonic: "F", mode: "blues" },
      meter: "4/4",
      bpm: 140,
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

describe("JC2's brief", () => {
  test("§6.6's four lines with the spec's bodies, the head, and three suggestions", () => {
    expect(brief.rubric.map((r) => [r.id, r.rule, r.required])).toEqual([
      ["form", "blues-form", true],
      ["walking", "custom", true],
      ["swing", "swing", true],
      ["one-pattern", "uses", true],
      ["head", "tracks", true],
      ["head-sound", "sounds", false],
      ["chord-tones", "chord-tones-strong", false],
      ["tempo", "tempo-bpm", false],
      // Oak 2.0 W4 F1: the book's ending as a suggestion (no skills, never blocks).
      ["ending", "custom", false],
    ]);
    const [form, walking, swing, onePattern, head] = brief.rubric;
    expect(form).toMatchObject({ variant: "jazz", choruses: 2 });
    expect(walking).toMatchObject({
      fn: "walking-bass",
      params: {
        bass: "@bass",
        harmony: "@chords",
        rootOnOne: 0.75,
        chordToneOnThree: 0.5,
        approachOnFour: 0.5,
        maxSemis: 2,
      },
    });
    // contracts §6.6: measured on the ride or the comping, never on the quarter-note bass.
    expect(swing).toMatchObject({
      track: ["hats", "@drums", "chords"],
      drums: ["hatClosed", "hatOpen", "ride"],
      subdivision: 8,
      ratio: [1.6, 2.4],
    });
    expect(onePattern).toMatchObject({ tool: ["tb.set", "tb.rootNotes"], min: 1 });
    expect(head).toMatchObject({ min: 4, roles: ["drums", "bass", "chords", "melody"] });
    expect(jc2?.opensAfter).toEqual({ lessonsCompleted: ["J4.L04"] });
    expect(jc2?.key).toEqual({ tonic: "F", mode: "blues" });
    expect(jc2?.bpm).toEqual([100, 180]);
  });

  test("S1 builds the band from the starter; S2 adds the head, reviews and releases", () => {
    const ids = new Set(brief.rubric.map((r) => r.id));
    expect(jc2?.sessionDefs.map((s) => [s.id, s.goal])).toEqual([
      ["JC2.S1", "Changes, shell comping and walking bass from one `chord()` pattern."],
      ["JC2.S2", "Original head over two choruses; release."],
    ]);
    expect(jc2?.sessionDefs.map((s) => s.focusRules)).toEqual([
      ["form", "walking", "swing", "one-pattern"],
      [...ids],
    ]);
    expect(jc2?.sessionDefs[0]?.starter).toBe(JC2_TEMPLATE);
    expect(brief.code.starter).toBe(JC2_TEMPLATE);
    expect(jc2?.sessionDefs.map((s) => [!!s.review, !!s.release])).toEqual([
      [false, false],
      [true, true],
    ]);
  });

  test("the brief fixes the form and leaves the music open, in plain words", () => {
    expect(brief.brief).toMatch(/two choruses, the second one changed/);
    expect(brief.brief).toMatch(/are yours/);
    expect(brief.brief.split(/\s+/).length).toBeLessThanOrEqual(60);
    for (const t of [brief.brief, ...(brief.hints ?? []).map((h) => (typeof h === "string" ? "" : h.text))])
      expect([t, /!|\bsimply\b|\bjust\b|\beasy\b/i.test(t)]).toEqual([t, false]);
  });

  test("the release asks about the second chorus and offers three first lines", () => {
    expect(CAPSTONE_LINER_PROMPTS.JC2).toBe("What changes in your second chorus, and why there?");
    const seeds = CAPSTONE_LINER_SEEDS.JC2 ?? [];
    expect(seeds.length).toBe(3);
    for (const t of seeds) expect([t, /!|amazing|awesome|easy|simply|just /i.test(t)]).toEqual([t, false]);
  });
});

describe("the starter", () => {
  test("plays U11's blues in two from one chord pattern, with the ride and the hi-hat, and lints at S1", async () => {
    const code = stripMarkers(JC2_TEMPLATE).code;
    expect(code).toContain(`const changes = "${U11_BLUES}"`);
    const ev = await evaluate(code, 12);
    expect(ev.ok).toBe(true);
    expect([...new Set(ev.tracks)].sort()).toEqual(["bass", "chords", "drums", "hats"]);
    expect(lint(code, { session: "JC2.S1" as SessionId, meter: "4/4", profile: "graded" }).ok).toBe(true);
  });
  test("fails on the chart, the walk and the head; it already swings and reads one pattern", async () => {
    const r = await grade(JC2_TEMPLATE);
    expect(requiredFailing(r)).toEqual(["form", "head", "walking"]);
  });
});

describe("passing pieces, one per shipped flavour and two more", () => {
  const passing: [string, string][] = [
    ["jazz-soul, the reference", JC2_PIECES.jazzSoul],
    ["pop, piano and electric bass", JC2_PIECES.pop],
    ["indie, Am7 D7 in bar 8", JC2_PIECES.indie],
    ["funk, rootless lefthand at A4", JC2_PIECES.funk],
    ["the head on the vibes at 160", JC2_PIECES.vibes160],
    ["the comping on 2 and 4 only", JC2_PIECES.twoAndFour],
  ];
  for (const [name, code] of passing)
    test(name, async () => {
      const r = await grade(code, "JC2.S2");
      expect(requiredFailing(r)).toEqual([]);
      expect((r.rubric ?? []).find((x) => x.ruleId === "form")?.value).toBe(2);
    });
});

describe("the reference walk, as pieces.ts describes it (evaluated)", () => {
  // The chart's chord at each beat 3 (the second chord of bars 4, 11 and 12 starts there) as pitch classes.
  const PCS: Record<string, number[]> = {
    F7: [5, 9, 0, 3],
    Bb7: [10, 2, 5, 8],
    Bo7: [11, 2, 5, 8],
    D7: [2, 6, 9, 0],
    Gm7: [7, 10, 2, 5],
    C7: [0, 4, 7, 10],
  };
  const BEAT3 = ["F7", "Bb7", "F7", "F7", "Bb7", "Bo7", "F7", "D7", "Gm7", "C7", "D7", "C7"];
  const ROOTS = [5, 10, 5, 0, 10, 11, 5, 2, 7, 0, 5, 7];
  test("one note on every beat, the root on 1, a chord tone on 3, a step into every bar line, the loop's included", async () => {
    const ev = await evaluate(JC2_PIECES.jazzSoul, 12);
    const bass = ev.events.filter((e) => e.track === "bass" && e.midi !== null);
    for (let bar = 0; bar < 12; bar++) {
      const beats = [0, 1, 2, 3].map((b) => bass.filter((e) => Math.abs(e.onset - (bar + b / 4)) < 1e-6));
      expect(beats.map((b) => b.length)).toEqual([1, 1, 1, 1]);
      const [one, , three, four] = beats.map((b) => b[0]?.midi as number);
      expect([bar + 1, (one as number) % 12]).toEqual([bar + 1, ROOTS[bar] as number]);
      expect([bar + 1, PCS[BEAT3[bar] as string]?.includes((three as number) % 12)]).toEqual([bar + 1, true]);
      const next = bass.find((e) => Math.abs(e.onset - ((bar + 1) % 12)) < 1e-6)?.midi as number;
      const step = Math.abs((four as number) - next);
      expect([bar + 1, step >= 1 && step <= 2]).toEqual([bar + 1, true]);
    }
  });
});

describe("wrong pieces fail exactly the line they break", () => {
  const failing: [string, string, string[], RegExp?][] = [
    ["the walk crowded into beat 1", JC2_PIECES.crowded, ["walking"], /does not walk there/],
    ["beat 4 repeats beat 3", JC2_PIECES.noApproach, ["walking"], /beat 4 leads into the next bar/],
    ["the roots four to the bar", JC2_PIECES.rootsFour, ["walking"], /beat 4 leads into the next bar/],
    ["the swing on the bass, ride and comping straight", JC2_PIECES.swingOnBass, ["swing"]],
    ["U11's blues", JC2_PIECES.u11, ["form"]],
    ["one chorus", JC2_PIECES.oneChorus, ["form"], /1 chorus \(12 bars\)/],
    ["comping and walk by hand", JC2_PIECES.byHand, ["one-pattern"]],
    ["no head", JC2_PIECES.noHead, ["form", "head"]],
    // Not heard, the head leaves the second chorus playing the first again note for note: `form` hears that too.
    ["the head at gain 0", JC2_PIECES.silentHead, ["head", "form"], /no melody part/],
  ];
  for (const [name, code, ids, text] of failing)
    test(name, async () => {
      const r = await grade(code, "JC2.S2");
      expect(requiredFailing(r)).toEqual([...ids].sort());
      if (text) expect(detail(r, ids[0] as string)).toMatch(text);
    });
});
