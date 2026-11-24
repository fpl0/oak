// The checkpoint player's rules: the local score agrees with the server's (gating vs level-setting, skips,
// "Continue anyway"), family items get an answer surface their trial can be answered with and graded by the
// drill engine, and the result copy never shames.
import { describe, expect, test } from "bun:test";
import type { CheckpointItemSpec } from "@oak/api";
import { createRegistry, DECKS, FAMILIES, generateTrial, gradeTrial } from "@oak/drills";
import { NEUTRAL_PROFILE } from "../grading.ts";
import {
  authoredTitle,
  familyAnswerSpec,
  familyResponse,
  hasSavedRecords,
  isSungTrial,
  progressLine,
  quietNote,
  resultCopy,
  reviewTitle,
  scoreLocal,
  skillLine,
  statusWord,
  sungItemScore,
  sungTargetsOf,
} from "./model.ts";

const item = (idx: number, skillId: string, role: CheckpointItemSpec["role"]): CheckpointItemSpec =>
  ({
    idx,
    skillId,
    role,
    source: { kind: "authored", exerciseId: `U01.CP/x${idx}` },
    debt: false,
  }) as CheckpointItemSpec;

const ITEMS = [
  item(0, "R02", "gating"),
  item(1, "R02", "gating"),
  item(2, "R03", "gating"),
  item(3, "R03", "gating"),
  item(4, "E01", "level-setting"),
  item(5, "E01", "level-setting"),
];
const rec = (scores: number[], skipped: number[] = []) =>
  new Map(scores.map((s, i) => [i, { score: s, skipped: skipped.includes(i) }]));

describe("the local score (contracts §7.6)", () => {
  test("pass needs 0.85 on gating items and every gated skill at 0.70; level-setting never blocks", () => {
    const r = scoreLocal(ITEMS, rec([1, 1, 1, 1, 0, 0]), 1);
    expect(r.passed).toBe(true);
    expect(r.score).toBe(1);
    expect(r.perSkill.find((p) => p.skillId === "E01")?.ok).toBe(false);
  });

  test("one weak gated skill fails even with a high mean", () => {
    // R02 = 1, R03 = 0.6 → mean 0.8 < 0.85 and R03 < 0.70.
    const r = scoreLocal(ITEMS, rec([1, 1, 0.6, 0.6, 1, 1]), 1);
    expect(r.passed).toBe(false);
    expect(r.softPassOffered).toBe(false);
  });

  test("a skipped level-setting item is left out; a skipped gating item scores 0", () => {
    const left = scoreLocal(ITEMS, rec([1, 1, 1, 1, 0, 0], [4, 5]), 1);
    expect(left.perSkill.find((p) => p.skillId === "E01")).toBeUndefined();
    const zero = scoreLocal(ITEMS, rec([1, 1, 1, 1, 1, 1], [0]), 1);
    expect(zero.score).toBe(0.75);
    expect(zero.passed).toBe(false);
  });

  test("Continue anyway: a retake at 0.75 or more, or any third attempt", () => {
    const s = rec([1, 1, 1, 0, 1, 1]); // gating 0.75, R03 0.5
    expect(scoreLocal(ITEMS, s, 1).softPassOffered).toBe(false);
    expect(scoreLocal(ITEMS, s, 2).softPassOffered).toBe(true);
    expect(scoreLocal(ITEMS, rec([0, 0, 0, 0, 0, 0]), 3).softPassOffered).toBe(true);
  });
});

describe("family items", () => {
  const reg = createRegistry(FAMILIES, DECKS);
  const draw = (id: string, seed = 11) => {
    const fam = reg.family(id as never);
    const cats = fam.def.categories.map((c) => c.id);
    return {
      fam,
      cats,
      trial: generateTrial(
        fam,
        { index: 0, family: fam.def.id, level: 1, category: cats[0] as string, seed },
        NEUTRAL_PROFILE,
        cats,
      ),
    };
  };

  test("a choice family offers the trial's own options, and its expected answer is one of them", () => {
    for (const id of ["fam.rhy.count", "fam.rhy.meter", "fam.pit.compare"]) {
      const { fam, cats, trial } = draw(id);
      const spec = familyAnswerSpec(fam.def.answer, trial, cats);
      expect(spec?.ui).toBe("choice");
      const ids = spec?.ui === "choice" ? spec.options.map((o) => o.id) : [];
      expect(ids).toContain(trial.expected.choice?.[0] as string);
    }
  });

  test("the expected answer earns full credit from the drill engine; another answer does not", () => {
    const { fam, cats, trial } = draw("fam.rhy.count", 5);
    const spec = familyAnswerSpec(fam.def.answer, trial, cats);
    const right = trial.expected.choice?.[0] as string;
    const wrong = (spec?.ui === "choice" ? spec.options.map((o) => o.id) : []).find(
      (o) => o !== right,
    ) as string;
    const ok = gradeTrial(
      fam,
      trial,
      familyResponse({ answer: { choice: [right] } }, 1500, 1),
      NEUTRAL_PROFILE,
    );
    const no = gradeTrial(
      fam,
      trial,
      familyResponse({ answer: { choice: [wrong] } }, 1500, 1),
      NEUTRAL_PROFILE,
    );
    expect(ok.credit).toBe(1);
    expect(no.credit).toBeLessThan(1);
  });

  test("grid, number, text and degree families get their surfaces", () => {
    const grid = draw("fam.rhy.dictation");
    expect(familyAnswerSpec(grid.fam.def.answer, grid.trial, grid.cats)).toMatchObject({
      ui: "grid",
      rows: ["hit"],
    });
    const idx = draw("fam.deg.index");
    expect(familyAnswerSpec(idx.fam.def.answer, idx.trial, idx.cats)?.ui).toBe("number");
    const kb = draw("fam.pit.keyboard");
    expect(familyAnswerSpec(kb.fam.def.answer, kb.trial, kb.cats)?.ui).toBe("text");
    const fet = draw("fam.deg.fet-major");
    expect(familyAnswerSpec(fet.fam.def.answer, fet.trial, fet.cats)).toMatchObject({ ui: "degree-pad" });
  });

  test("intervals in a key (U04.CP): a pad with the keys of the answer, two degrees long", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { fam, cats, trial } = draw("fam.int.in-key", seed);
      const spec = familyAnswerSpec(fam.def.answer, trial, cats, fam.def);
      expect(spec?.ui).toBe("degree-pad");
      if (spec?.ui !== "degree-pad") continue;
      const want = trial.expected.degrees ?? [];
      expect(want.length).toBe(2);
      expect(spec.sequenceLen).toBe(2);
      for (const d of want) expect(spec.set).toContain(d);
    }
  });
});

describe("result copy", () => {
  test("calm in every case: no exclamation marks, never 'failed'", () => {
    for (const o of [
      { passed: true, softPass: false },
      { passed: false, softPass: true },
      { passed: false, softPass: false },
    ]) {
      const c = resultCopy(o);
      expect(`${c.title} ${c.body}`).not.toMatch(/!|fail/i);
    }
    expect(
      skillLine({ skillId: "E01" as never, role: "level-setting", mean: 0.2, items: 2, ok: false }).tone,
    ).toBe("level");
    expect(
      skillLine({ skillId: "R02" as never, role: "gating", mean: 0.5, items: 2, ok: false }).text,
    ).toContain("worth another look");
  });
});

describe("tap items", () => {
  test("an echo's taps are read from its response window; the trial's own targets earn credit", () => {
    const reg = createRegistry(FAMILIES, DECKS);
    for (const id of ["fam.rhy.read", "fam.rhy.echo"]) {
      const fam = reg.family(id as never);
      const cats = fam.def.categories.map((c) => c.id);
      const trial = generateTrial(
        fam,
        { index: 0, family: fam.def.id, level: 1, category: cats[0] as string, seed: 9 },
        NEUTRAL_PROFILE,
        cats,
      );
      const p = trial.params as { tapTargets: number[]; responseAt: number };
      const taps = p.tapTargets.map((t) => t + p.responseAt);
      const r = gradeTrial(fam, trial, familyResponse({ taps }, 1500, 1, p.responseAt), NEUTRAL_PROFILE);
      expect(r.credit).toBeGreaterThan(0.9);
    }
  });
});

describe("Wave 3 checkpoint items (U03.CP, U04.CP)", () => {
  const reg = createRegistry(FAMILIES, DECKS);
  const draw = (id: string, level = 1, seed = 11) => {
    const fam = reg.family(id as never);
    const cats = fam.def.categories.map((c) => c.id);
    return {
      fam,
      cats,
      trial: generateTrial(
        fam,
        { index: 0, family: fam.def.id, level, category: cats[0] as string, seed },
        NEUTRAL_PROFILE,
        cats,
      ),
    };
  };

  test("reading the staff into code (fam.not.read, gated N03) gets the code surface, not 'unavailable'", () => {
    const { fam, cats, trial } = draw("fam.not.read");
    expect(familyAnswerSpec(fam.def.answer, trial, cats)).toBeNull();
    expect(familyAnswerSpec(fam.def.answer, trial, cats, fam.def)?.ui).toBe("code");
  });

  test("a typed answer of several parts is split as the trial expects (spell a scale)", () => {
    const { fam, trial } = draw("fam.key.scale-spell");
    const typed = (trial.expected.text ?? []).join(" ");
    const ok = gradeTrial(
      fam,
      trial,
      familyResponse({ answer: { text: [typed] } }, 2000, 1, 0, trial.expected),
      NEUTRAL_PROFILE,
    );
    expect(ok.credit).toBe(1);
  });

  test("a code answer goes to the drill engine as text", () => {
    expect(familyResponse({ code: '  n("0 1")  ' }, 10, 1)).toEqual({
      answer: { text: ['n("0 1")'] },
      rtMs: 10,
      replays: 1,
    });
  });

  test("sung families are sing items with their own targets; a take on the targets scores 1", () => {
    for (const id of ["fam.deg.sing", "fam.mel.echo", "fam.deg.resolve"]) {
      const { trial } = draw(id);
      expect(isSungTrial(trial)).toBe(true);
      const targets = sungTargetsOf(trial);
      expect(targets.length).toBeGreaterThan(0);
      const right = sungItemScore(
        targets.map((t) => ({ midi: t.midi, cents: 5, credit: 1 })),
        trial,
        50,
      );
      expect(right).toEqual({ score: 1, noVoice: false });
      const silent = sungItemScore([{ midi: null, cents: null, credit: 0 }], trial, 50);
      expect(silent.noVoice).toBe(true);
    }
    expect(isSungTrial(draw("fam.deg.fet-major").trial)).toBe(false);
  });

  test("sung items set aside in Quiet mode never count: level-setting skips are left out of the score", () => {
    const items = [
      { idx: 0, skillId: "N03", role: "gating" },
      { idx: 1, skillId: "V02", role: "level-setting" },
    ] as unknown as CheckpointItemSpec[];
    const local = scoreLocal(items, new Map([[0, { score: 1, skipped: false }]]), 1);
    expect(local.passed).toBe(true);
    expect(local.perSkill.map((p) => p.skillId)).toEqual(["N03"]);
    expect(quietNote(0)).toBeNull();
    expect(quietNote(2)).toContain("2 sung items were set aside");
    expect(quietNote(1)?.toLowerCase()).not.toMatch(/fail|miss|lost/);
  });

  test("a retake at 0.75 offers Continue anyway; the copy says 'worth another look', never 'failed'", () => {
    const items = [0, 1, 2, 3].map((idx) => ({ idx, skillId: idx < 2 ? "S01" : "S02", role: "gating" }));
    const recs = new Map(items.map((it) => [it.idx, { score: it.idx === 0 ? 0 : 1, skipped: false }]));
    const second = scoreLocal(items as unknown as CheckpointItemSpec[], recs, 2);
    expect(second.score).toBe(0.75);
    expect(second.passed).toBe(false);
    expect(second.softPassOffered).toBe(true);
    expect(scoreLocal(items as unknown as CheckpointItemSpec[], recs, 1).softPassOffered).toBe(false);
    const debt = skillLine({ skillId: "S01" as never, role: "gating", mean: 0.5, items: 2, ok: false });
    expect(debt.text).toContain("worth another look");
    for (const c of [
      resultCopy({ passed: false, softPass: false }),
      resultCopy({ passed: false, softPass: true }),
    ])
      expect(`${c.title} ${c.body}`.toLowerCase()).not.toMatch(/fail|debt|wrong/);
  });
});

describe("intro wording", () => {
  test("the status chip says a word, never the raw status", () => {
    expect(statusWord("open")).toBe("Ready");
    expect(statusWord("failed")).toBe("Not yet");
    expect(statusWord("soft-passed")).toBe("Passed");
    expect(statusWord(undefined)).toBe("Locked");
  });
  test("a pending attempt resumes only with answers saved in this browser", () => {
    const store = new Map<string, string>();
    const fake = {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    const was = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    try {
      expect(hasSavedRecords("U04.CP")).toBe(false);
      store.set("oak.checkpoint.U04.CP.2", "[]");
      expect(hasSavedRecords("U04.CP")).toBe(false);
      store.set("oak.checkpoint.U04.CP.2", JSON.stringify([{ idx: 0, skipped: true }]));
      expect(hasSavedRecords("U04.CP")).toBe(true);
      expect(hasSavedRecords("U05.CP")).toBe(false);
    } finally {
      if (was) Object.defineProperty(globalThis, "localStorage", was);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe("progress and review wording", () => {
  test("a skipped item is not counted as answered", () => {
    const skipped = Array.from({ length: 25 }, () => ({ skipped: true }));
    expect(progressLine(skipped, 26)).toBe("0 of 26 answered, 25 skipped");
    expect(progressLine([{ skipped: false }, { skipped: true }], 26)).toBe("1 of 26 answered, 1 skipped");
    expect(progressLine([{ skipped: false }], 26)).toBe("1 of 26 answered");
    expect(reviewTitle([...skipped, { skipped: false }], 26)).toBe("1 of 26 items answered, 25 skipped");
    expect(
      reviewTitle(
        Array.from({ length: 26 }, () => ({ skipped: false })),
        26,
      ),
    ).toBe("All 26 items answered");
  });
});

describe("authoredTitle", () => {
  test("an untitled item is named by its skill, never a generic line (UX review P14)", () => {
    const listen = { kind: "fact", stimulus: { src: "code", code: "n(0)", bars: 1 } } as never;
    const plain = { kind: "fact" } as never;
    expect(authoredTitle(listen, "Intervals in a key")).toBe("Intervals in a key, by ear");
    expect(authoredTitle(plain, "Degrees")).toBe("Degrees");
    // Without a skill name it falls back to what the learner does.
    expect(authoredTitle(listen)).toBe("Listen and answer");
  });
});
