// The finale specs (content/specs/CF.ts, END.ts) against the registries and the real grader. The specs state
// some things as "verified": this file is that verification, kept to the facts that stay true when the grader
// engineer makes the changes the spec asks for (a passing single stays passing; the device rows it lists are
// found under both the present detector and the definitions of the spec). The reference single is in
// finale-reference.ts, for author:finale to start the pop golden test from.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { Exercise, KeySpec, RubricRule, SessionId } from "@oak/content-kit";
import { gradeFormMap } from "@oak/grader";
import { candoById } from "../candos.ts";
import { capstones } from "../capstones.ts";
import { ladder } from "../gym/ladder.ts";
import { milestones } from "../milestones.ts";
import { songById } from "../repertoire/index.ts";
import { termById } from "../terms.ts";
import { toolboxById } from "../toolbox.ts";
import { evaluate, grade, lint } from "../validate/harness.ts";
import { CF } from "./CF.ts";
import { END, SIDE_A_ORDER } from "./END.ts";
import { CF_A_REFERENCE_POP } from "./finale-reference.ts";

setDefaultTimeout(60_000);
const C: KeySpec = { tonic: "C", mode: "major" };

const cfa = capstones.find((c) => c.id === "CF-A");
const cft = capstones.find((c) => c.id === "CF-T");
/**
 * CF-A's brief with its `form` line written out for the reference's own form: `contains` (feature
 * `form.contains`) is planned, and the other two required rules already have analyzers.
 */
const briefWith = (rubric: RubricRule[]): Exercise => ({ ...(cfa?.brief as Exercise), rubric }) as Exercise;
// The spec's Wave 6 lines (devices, form, length and the suggestions). Oak 2.0 W4's required `ending` line is graded on
// its own below: the reference single stops at the end of its lifted chorus.
const allRules = (cfa?.brief?.rubric ?? []).map((r): RubricRule => {
  if (r.rule !== "form") return r;
  const { contains: _planned, ...rest } = r;
  return { ...rest, pattern: "verse chorus verse chorus bridge chorus chorus" };
});
const rules = allRules.filter((r) => r.id !== "ending");
const gradeSingle = (code: string) =>
  grade(
    briefWith(rules),
    { name: "probe", response: { code }, expect: "pass" },
    { id: "CF-A" as never, key: C, meter: "4/4", bpm: 100 },
    "CF-A.S1" as SessionId,
    "capstone",
  );

describe("CF: the finale spec against the registries", () => {
  test("both finales, four sessions each, goals word for word, one enjoyment, pace and return line each", () => {
    expect(CF.capstones.map((c) => c.id)).toEqual(["CF-A", "CF-T"]);
    for (const spec of CF.capstones) {
      const def = capstones.find((c) => c.id === spec.id);
      expect(def).toBeDefined();
      expect((spec.sessions ?? []).map((s) => [s.id, s.goal])).toEqual(
        (def?.sessionDefs ?? []).map((s) => [s.id as string, s.goal]),
      );
      for (const s of spec.sessions ?? [])
        for (const k of ["enjoyment", "pace", "return"] as const)
          expect([s.id, k, (s.epr?.[k] ?? "").trim().split(/\s+/).length >= 8]).toEqual([s.id, k, true]);
    }
  });
  test("every registry id the two specs name exists", () => {
    const text = JSON.stringify([CF, END]);
    const ids = (re: RegExp) => [...new Set(text.match(re) ?? [])];
    for (const id of ids(/\bterm\.[a-z0-9-]+/g)) expect([id, termById.has(id)]).toEqual([id, true]);
    for (const id of ids(/\bcd\.[a-z0-9.-]*[a-z0-9]/g)) expect([id, candoById.has(id)]).toEqual([id, true]);
    for (const id of ids(/\bms\.\d\d\b/g))
      expect([id, milestones.some((m) => m.id === id)]).toEqual([id, true]);
    for (const id of ids(/\b(?:tb|snd|chord|scale)\.[a-z][A-Za-z0-9.-]*[A-Za-z0-9]/g))
      expect([id, toolboxById.has(id)]).toEqual([id, true]);
    for (const id of cft?.song ?? []) expect([id, songById.has(id)]).toEqual([id, true]);
  });
  test("the ladder section is L7 and L8, as content/gym has them", () => {
    expect(CF.gym?.ladder.map((l) => l.level)).toEqual([7, 8]);
    expect(ladder.find((l) => l.level === 7)?.grading).toBe("self");
    expect(ladder.find((l) => l.level === 8)?.pool).toEqual(cft?.song);
  });
  test("the rubric the spec describes is the registry's", () => {
    expect(cfa?.brief?.rubric.filter((r) => r.required).map((r) => r.rule)).toEqual([
      "device-count",
      "form",
      "duration-sec",
      // Oak 2.0 W4 F1: it ends on purpose (`ends-on-purpose`, any of U09.L06's endings).
      "custom",
    ]);
    expect(cfa?.opensAfter).toEqual({ capstones: ["C7"] });
    expect(cft?.opensAfter).toEqual({ lessonsCompleted: ["U15.L01"] });
    expect(cft?.inGymSlots).toBe(true);
  });
});

describe("CF-A: what the spec calls verified", () => {
  test("the pop reference evaluates, is clean at CF-A.S1 and meets devices, form and length", async () => {
    const r = await evaluate(CF_A_REFERENCE_POP, 56);
    expect([r.ok, r.error ?? ""]).toEqual([true, ""]);
    expect(r.cps).toBeCloseTo(100 / 4 / 60, 6);
    const errors = lint(CF_A_REFERENCE_POP, { session: "CF-A.S1" as SessionId, meter: "4/4", key: C })
      .diagnostics.filter((d) => d.severity === "error")
      .map((d) => `${d.id} ${d.message}`);
    expect(errors).toEqual([]);
    const g = await gradeSingle(CF_A_REFERENCE_POP);
    expect([g.decided, g.passed, g.feedback]).toEqual([true, true, g.feedback]);
    // 56 bars at 100 BPM: 56 × 240 / 100 seconds.
    expect((56 * 240) / 100).toBeCloseTo(134.4, 6);
    // Oak 2.0 W4: the whole brief now asks for an ending on purpose, the one line the reference misses.
    const whole = await grade(
      briefWith(allRules),
      { name: "probe", response: { code: CF_A_REFERENCE_POP }, expect: "fail", feedback: ["rubric.unmet"] },
      { id: "CF-A" as never, key: C, meter: "4/4", bpm: 100 },
      "CF-A.S1" as SessionId,
      "capstone",
    );
    expect([whole.decided, whole.passed]).toEqual([true, false]);
    expect((whole.rubric ?? []).filter((x) => x.required && !x.ok).map((x) => x.ruleId)).toEqual(["ending"]);
  });
  test("without its devices the same plan fails on the device line alone", async () => {
    const plain = CF_A_REFERENCE_POP.replace("<F G E7 Am F G C C>", "<F G Em Am F G C C>")
      .replace("<Fm Fm C C Ab Bb G G>", "<Dm Dm C C F G G G>")
      .replace("<3 3 0 0 5b 6b 4 4>", "<1 1 0 0 3 4 4 4>")
      .replace('const chordsChorus2 = chord("<G A F#7 Bm G A D D>").voicing()\n', "")
      .replace("[8, chordsChorus2]", "[8, chordsChorus]")
      .replaceAll('struct("x ~ ~ x ~ x ~ ~")', 'struct("x ~ x ~")')
      .replace("<C2:major!48 D2:major!8>", "C2:major")
      .replace("<C4:major!48 D4:major!8>", "C4:major")
      .replace("[9 8 6 4#]", "[9 8 6 4]")
      .replace("[7@2 6@2]", "[6 ~ ~ ~]")
      .replace(
        "<[5b ~ 4 3] [5b ~ 4 ~] [4 ~ 2 0] ~ [7 ~ 5b 4] [8 ~ 6b 3]",
        "<[5 ~ 4 3] [5 ~ 4 ~] [4 ~ 2 0] ~ [7 ~ 5 3] [8 ~ 6 4]",
      );
    const g = await gradeSingle(plain);
    expect([g.decided, g.passed]).toEqual([true, false]);
  });
  test("a lifted chorus must keep the section's name; the sus symbol is locked in the core", () => {
    const lifted = CF_A_REFERENCE_POP.replaceAll("chordsChorus2", "chordsLift");
    const ids = (code: string) =>
      lint(code, { session: "CF-A.S4" as SessionId, meter: "4/4", key: C })
        .diagnostics.filter((d) => d.severity === "error")
        .map((d) => d.id);
    expect(ids(lifted)).toContain("form.inconsistent-arrange");
    expect(ids('setcpm(100/4)\n\nchords: chord("<Gsus G>").voicing().s("piano")')).toContain(
      "code.locked-chord",
    );
    expect(ids('setcpm(100/4)\n\nchords: n("<[4,7,8] [4,6,8]>").scale("C3:major").s("piano")')).toEqual([]);
  });
});

describe("CF-T: what the spec calls verified", () => {
  const key = (labels: string[]) =>
    ({
      answerKey: { sections: labels.map((label, i) => ({ label, bars: [i * 8 + 1, i * 8 + 8] })) },
    }) as never;
  const AABA = key(["A", "A", "B", "A"]);
  const map = (sections: string[], bars = [1, 9, 17, 25]) => gradeFormMap({ sections, bars }, AABA);
  test("the form map is graded by start bar and by shape, and only 1 is a pass", () => {
    expect(map(["A", "A", "B", "A"]).passed).toBe(true);
    expect(map(["verse", "verse", "bridge", "verse"]).passed).toBe(true);
    expect(map(["A", "A2", "B", "A3"]).passed).toBe(true);
    expect(map(["A", "B", "A", "B"]).score).toBeCloseTo(0.25, 6);
    expect(map(["A", "B"], [1, 17]).score).toBeCloseTo(0.5, 6);
    const extra = map(["A", "A", "B", "B", "A"], [1, 9, 17, 21, 25]);
    expect([extra.score, extra.passed, extra.extra]).toEqual([0.8, false, [21]]);
    const ABCA = key(["A", "B", "C", "A2"]);
    expect(gradeFormMap({ sections: ["A", "B", "C", "D"], bars: [1, 9, 17, 25] }, ABCA).score).toBeCloseTo(
      0.75,
      6,
    );
  });
  test("the chord vocabulary of the settings and an arrangement lint at CF-T's first and last session", async () => {
    const colours =
      'setcpm(120/4)\n\nchords: chord("<C C#o7 Dm7 G7 E7 A7 D7 F7 F^7 Gm7 Am7b5 Abo7>").voicing().s("rhodes")';
    const arrangement = `setcpm(132/4)

const changesA = "<C E7 A7 A7 D7 G7 C G7>"
const changesB = "<E7 E7 A7 A7 D7 D7 G7 G7>"
const chordsA = chord(changesA).voicing().struct("~ x ~ [~ x]")
const chordsB = chord(changesB).voicing().struct("~ x ~ [~ x]")
const bassA = chord(changesA).rootNotes(2).struct("x ~ x ~")
const bassB = chord(changesB).rootNotes(2).struct("x ~ x ~")
const melA = n("<[2 4 2 4] [2 ~ ~ ~]>")
const melB = n("<[4 ~ 4 ~] [4 ~ ~ ~]>")

hats: s("rd*8").swingBy(1/3, 4).gain(.4)
kick: s("bd ~ bd ~").gain(.8)
snare: s("~ sd ~ sd").velocity("1 .4 1 .4")
chords: arrange([8, chordsA], [8, chordsA], [8, chordsB], [8, chordsA]).s("rhodes").room(.3)
bass: arrange([8, bassA], [8, bassA], [8, bassB], [8, bassA]).s("upright")
mel: arrange([8, melA], [8, melA], [8, melB], [8, melA]).scale("C4:major").s("jazzgtr").pan(.6)`;
    for (const code of [colours, arrangement]) {
      const r = await evaluate(code, 12);
      expect([r.ok, r.error ?? "", r.logs.filter((x) => /unknown chord/i.test(x))]).toEqual([true, "", []]);
      for (const session of ["CF-T.S1", "CF-T.S4"] as SessionId[])
        expect(
          lint(code, { session, meter: "4/4", key: C })
            .diagnostics.filter((d) => d.severity === "error")
            .map((d) => d.id),
        ).toEqual([]);
    }
    // In the legal order where CF-T runs ahead of U15.L05, the horns are still locked.
    const locked = lint('setcpm(120/4)\n\nmel: n("0 2 4 2").scale("C4:major").s("trumpet")', {
      session: "CF-T.S4" as SessionId,
      meter: "4/4",
      key: C,
    }).diagnostics.map((d) => d.id);
    expect(locked).toContain("code.locked-sound");
  });
});

describe("END: the end of the core", () => {
  const e = END.ending;
  test("Side A runs to twelve tracks and closes on the single", () => {
    expect(SIDE_A_ORDER.length).toBe(12);
    expect(SIDE_A_ORDER.at(-1)).toBe("CF-A");
    expect(SIDE_A_ORDER.at(-2)).toBe("CF-T");
    expect(SIDE_A_ORDER.slice(0, 10)).toEqual(["C0", "C1", "C2", "X1", "C3", "C4", "C5", "X2", "C6", "C7"]);
    for (const id of SIDE_A_ORDER) expect([id, capstones.some((c) => c.id === id)]).toEqual([id, true]);
  });
  test("the heading is the milestone's own sentence", () => {
    const ms = milestones.find((m) => m.id === "ms.07");
    const coda = e?.surfaces.find((s) => s.id === "coda");
    expect(coda?.copy.find((c) => c.where === "Heading")?.text).toBe(ms?.title as string);
    expect(coda?.copy.find((c) => c.where === "Under the heading")?.text).toBe(ms?.description as string);
  });
  test("the four parts are there, in order, each with an owner, its data and its states", () => {
    expect(e?.surfaces.map((s) => s.id)).toEqual([
      "coda",
      "record",
      "can-do",
      "oak",
      "open",
      "today",
      "progress",
    ]);
    for (const s of e?.surfaces ?? []) {
      expect([s.id, ["session", "capstone", "server"].includes(s.owner)]).toEqual([s.id, true]);
      expect([s.id, s.sees.length > 0 && s.data.length > 0 && s.states.length > 0]).toEqual([s.id, true]);
    }
  });
  test("no line the learner reads shouts, congratulates or compares", () => {
    const copy = (e?.surfaces ?? []).flatMap((s) => s.copy.map((c) => c.text));
    expect(copy.length).toBeGreaterThan(20);
    for (const t of copy) {
      expect([t, t.includes("!")]).toEqual([t, false]);
      expect([t, /congratulat|well done|amazing|awesome|behind|on schedule|streak/i.test(t)]).toEqual([
        t,
        false,
      ]);
    }
  });
  test("enjoyment, pace and return are stated for the ending", () => {
    for (const k of ["enjoyment", "pace", "return"] as const)
      expect((e?.epr[k] ?? "").trim().split(/\s+/).length).toBeGreaterThanOrEqual(8);
  });
});
