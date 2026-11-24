// Whole-course checks for the first playable (U00–U02, U01.CP, U02.CP, C0, C1). `content:check` judges one
// lesson at a time; these judge the lessons as one course read in the default order of contracts §2.5:
// nothing is missing, IDs are locked, terms and can-dos are introduced once by the lesson the registries
// name, no prose names a later lesson's term or tool, every exercise's skills and drill families are open
// in every legal order, budgets hold, and what plays over the Band does not grate against its chords.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  countTerms,
  type Exercise,
  flattenExercise,
  lessonBudget,
  type SessionId,
  stripMarkers,
} from "@oak/content-kit";
import { evalHeadless } from "@oak/grader/testing";
import { bandById, bandMeter } from "../bands/index.ts";
import { candos } from "../candos.ts";
import { capstones } from "../capstones.ts";
import { familyById } from "../families.ts";
import { courseGraph, registries } from "../index.ts";
import { atOrBefore } from "../lib/course.ts";
import { CONTENT_ROOT, type LoadedLesson, loadCheckpointFiles, loadLessons } from "../lib/load.bun.ts";
import { milestones } from "../milestones.ts";
import { termById } from "../terms.ts";
import { toolbox } from "../toolbox.ts";
import { exerciseTexts, lessonAuthoring, mdxSteps } from "./authoring.ts";
import { ONBOARDING_PREVIEW, unlockedFor } from "./harness.ts";

/** The first playable: every core session of the default order up to C1.S1 (sessions 1–24), less U03.L01. */
const ORDER = registries.syllabus.defaultOrder as readonly SessionId[];
const FIRST_PLAYABLE = ORDER.slice(0, ORDER.indexOf("C1.S1" as SessionId) + 1).filter(
  (s) => !s.startsWith("U03."),
);
const LESSONS = FIRST_PLAYABLE.filter((s) => /\.L\d{2}$/.test(s));

const { lessons: loaded, errors } = await loadLessons();
const byId = new Map(loaded.filter((l) => !l.sample).map((l) => [l.def.id as string, l]));
const course = LESSONS.map((id) => byId.get(id)).filter((l): l is LoadedLesson => Boolean(l));
/**
 * Every authored core lesson in the default order: the first playable plus the lessons written since (U03,
 * U04 in Wave 3). The cross-lesson scans (vocabulary, unlocks, skills, families, budgets, music over the
 * Band) read all of them; the completeness and ID-ledger tests keep to the released first playable.
 */
/**
 * Wave 5: the side lessons (A1.L01–L04, `LessonMeta.side`) sit outside the default order and are offered from
 * their gate on; they join every cross-lesson scan, each judged at the earliest point a learner can take it
 * (unlocks and skills in every legal order through the course graph; terms through `laterTerms`).
 */
const SIDE_LESSONS = registries.syllabus.units.flatMap((u) =>
  u.lessons.filter((l) => l.side).map((l) => l.id as SessionId),
);
/**
 * Wave 7: the advanced tracks' lessons, in the order of each track (contracts §2.6). Like the side lessons they sit
 * outside the default order; each is judged at the earliest point a learner can take it, which the course graph
 * gives (a track lesson may be reached with U14–U17 unfinished). Authored ones join every cross-lesson scan.
 */
const TRACK_LESSONS = registries.syllabus.tracks.flatMap((t) =>
  t.units.flatMap(
    (u) => registries.syllabus.units.find((x) => x.id === u)?.lessons.map((l) => l.id as SessionId) ?? [],
  ),
);
const authored = [
  ...new Set([...ORDER.filter((s) => /\.L\d{2}$/.test(s)), ...SIDE_LESSONS, ...TRACK_LESSONS]),
]
  .map((id) => byId.get(id))
  .filter((l): l is LoadedLesson => Boolean(l));
const g = courseGraph();
const exercisesOf = (l: LoadedLesson) =>
  l.def.steps.flatMap((s) => (s.exercise ? flattenExercise(s.exercise).map((e) => ({ s, e })) : []));

describe("the first playable is complete (contracts §2.3–§2.5)", () => {
  test("the default order starts U00.L01 … U02.CP, C1.S1 as §2.5 prints it", () => {
    expect(ORDER.slice(0, 24)).toEqual([
      ...["U00.L01", "U00.L02"],
      ...["U01.L01", "U01.L02", "U01.L03", "U01.L04", "U01.L05", "U01.L06", "U01.L07", "U01.L08", "U01.L09"],
      ...["U02.L01", "U01.CP", "C0.S1", "U02.L02", "U02.L03", "U02.L04", "U02.L05", "U02.L06", "U02.L07"],
      ...["U02.L08", "U03.L01", "U02.CP", "C1.S1"],
    ] as SessionId[]);
  });
  test("every lesson of U00–U02 is authored and loads", () => {
    expect(errors.filter((e) => e.folderId && LESSONS.includes(e.folderId as SessionId))).toEqual([]);
    expect(LESSONS.filter((id) => !byId.has(id))).toEqual([]);
    expect(LESSONS.length).toBe(19);
  });
  test("both checkpoints have their authored items, and C0 and C1 have tested briefs", async () => {
    const { defs } = await loadCheckpointFiles();
    expect(defs.map((d) => d.id as string).sort()).toEqual(expect.arrayContaining(["U01.CP", "U02.CP"]));
    for (const id of ["C0", "C1"]) {
      const c = capstones.find((x) => x.id === id);
      expect([id, Boolean(c), (c?.brief?.tests ?? []).length >= 4]).toEqual([id, true, true]);
    }
  });
});

describe("IDs (contracts §1.1, §11.7)", () => {
  const lock = new Set(
    (
      JSON.parse(readFileSync(join(CONTENT_ROOT, "ids.lock.json"), "utf8")) as { ids: { id: string }[] }
    ).ids.map((x) => x.id),
  );
  test("every lesson, step, example and exercise ID of the first playable is in ids.lock.json", () => {
    const missing: string[] = [];
    for (const l of course) {
      if (!lock.has(l.def.id)) missing.push(l.def.id);
      for (const s of l.def.steps) {
        if (!lock.has(`${l.def.id}/${s.id}`)) missing.push(`${l.def.id}/${s.id}`);
        if (s.example && !lock.has(`${l.def.id}@${s.example.id}`))
          missing.push(`${l.def.id}@${s.example.id}`);
      }
      for (const { e } of exercisesOf(l))
        if (!lock.has(`${l.def.id}/${e.id}`)) missing.push(`${l.def.id}/${e.id}`);
    }
    expect(missing).toEqual([]);
  });
  // §11.7 rule 1: a step inserted later takes the next free number and is never renumbered, so the array order may
  // differ from the numbers (A2.L04's S7 sits before its Make, S6); the numbers are still S1…Sn with none missing.
  test("exercise IDs are unique inside a lesson; step IDs are S1…Sn, each once", () => {
    for (const l of authored) {
      const ids = exercisesOf(l).map(({ e }) => e.id);
      expect([l.def.id, ids.length]).toEqual([l.def.id, new Set(ids).size]);
      const stepIds: string[] = l.def.steps.map((s) => s.id);
      const sorted = [...stepIds].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
      expect([l.def.id, ...sorted]).toEqual([l.def.id, ...stepIds.map((_, i) => `S${i + 1}`)]);
    }
  });
});

/** Wave 3's units, U03 and U04 with their checkpoints: sessions 25–41 of the default order, less U05.L01. */
const WAVE3 = ORDER.slice(
  ORDER.indexOf("U03.L02" as SessionId),
  ORDER.indexOf("U04.CP" as SessionId) + 1,
).filter((s) => !s.startsWith("U05."));
const W3_LESSONS = ["U03.L01", ...WAVE3.filter((s) => /\.L\d{2}$/.test(s))] as SessionId[];
const w3course = W3_LESSONS.map((id) => byId.get(id)).filter((l): l is LoadedLesson => Boolean(l));

describe("U03 and U04 are complete (contracts §2.3, §2.5)", () => {
  test("the default order runs U03.L02 … U04.CP as §2.5 prints it, with U05.L01 before U04.CP", () => {
    expect(ORDER.slice(24, 41)).toEqual([
      ...["U03.L02", "U03.L03", "U03.L04", "U03.L05", "U03.L06", "U03.L07", "U03.L08", "U03.L09", "U03.L10"],
      ...["U03.L11", "U04.L01", "U03.CP", "U04.L02", "U04.L03", "U04.L04", "U05.L01", "U04.CP"],
    ] as SessionId[]);
  });
  test("all 15 lessons of U03–U04 are authored and load", () => {
    expect(errors.filter((e) => e.folderId && W3_LESSONS.includes(e.folderId as SessionId))).toEqual([]);
    expect(W3_LESSONS.filter((id) => !byId.has(id))).toEqual([]);
    expect(W3_LESSONS.length).toBe(15);
  });
  test("U03.CP and U04.CP have authored items and a Make", async () => {
    const { defs } = await loadCheckpointFiles();
    for (const id of ["U03.CP", "U04.CP"]) {
      const d = defs.find((x) => x.id === id);
      expect([id, Boolean(d), (d?.authored.length ?? 0) >= 2, Boolean(d?.make)]).toEqual([
        id,
        true,
        true,
        true,
      ]);
    }
  });
  test("every lesson, step, example and exercise ID of U03–U04 is in ids.lock.json", () => {
    const lock = new Set(
      (
        JSON.parse(readFileSync(join(CONTENT_ROOT, "ids.lock.json"), "utf8")) as { ids: { id: string }[] }
      ).ids.map((x) => x.id),
    );
    const missing: string[] = [];
    for (const l of w3course) {
      const ids = [
        l.def.id,
        ...l.def.steps.flatMap((s) => [
          `${l.def.id}/${s.id}`,
          ...(s.example ? [`${l.def.id}@${s.example.id}`] : []),
        ]),
        ...exercisesOf(l).map(({ e }) => `${l.def.id}/${e.id}`),
      ];
      missing.push(...ids.filter((id) => !lock.has(id)));
    }
    expect(missing).toEqual([]);
  });
  test("each can-do of U03–U04 is awarded once, by the lesson the registry names", () => {
    const problems: string[] = [];
    for (const c of candos) {
      if (!W3_LESSONS.includes(c.source as SessionId)) continue;
      const by = w3course.filter((l) => (l.def.canDo as string[]).includes(c.id)).map((l) => l.def.id);
      if (by.join() !== c.source) problems.push(`${c.id}: source ${c.source}, awarded by [${by.join(" ")}]`);
    }
    expect(problems).toEqual([]);
  });
});

/** Wave 4's units, U05–U07 with their checkpoints, gym slots and C2/X1: sessions 42–83 of the default order. */
const WAVE4 = ORDER.slice(ORDER.indexOf("U05.L02" as SessionId), ORDER.indexOf("X1.S3" as SessionId) + 1);
const W4_LESSONS = ["U05.L01", ...WAVE4.filter((s) => /^U0[5-7]\.L\d{2}$/.test(s))] as SessionId[];
const w4course = W4_LESSONS.map((id) => byId.get(id)).filter((l): l is LoadedLesson => Boolean(l));

describe("U05–U07, C2 and X1 are complete (contracts §2.3–§2.5)", () => {
  test("the default order runs U05.L02 … X1.S3 as §2.5 prints it, gym slots and capstone sessions included", () => {
    // U05.L09 "Chord Names" follows U05.L04, the lesson it was split out of (contracts 1.6).
    expect(ORDER.slice(41, 83)).toEqual([
      ...["U05.L02", "U05.L03", "U05.L04", "U05.L09", "U05.L05", "U05.L06", "U05.L07", "U05.L08", "U06.L01"],
      "U05.CP",
      ...["U06.L02", "U06.L03", "U06.L04", "U06.L05", "U06.L06", "U06.L07", "U06.L08", "U06.L09", "U06.L10"],
      ...["U06.L11", "U06.L12", "U07.L01", "U06.CP", "U07.L02", "U07.L03", "GYM.01", "U07.L04", "U07.L05"],
      ...["U07.L06", "U07.L07", "GYM.02", "U07.L08", "U07.L09", "U07.L10", "U08.L01", "GYM.03", "U07.CP"],
      ...["C2.S1", "C2.S2", "X1.S1", "X1.S2", "X1.S3"],
    ] as SessionId[]);
  });
  test("all 31 lessons of U05–U07 are authored and load", () => {
    expect(errors.filter((e) => e.folderId && W4_LESSONS.includes(e.folderId as SessionId))).toEqual([]);
    expect(W4_LESSONS.filter((id) => !byId.has(id))).toEqual([]);
    expect(W4_LESSONS.length).toBe(31);
  });
  test("U05.CP, U06.CP and U07.CP have two or three authored items and a Make", async () => {
    const { defs } = await loadCheckpointFiles();
    for (const id of ["U05.CP", "U06.CP", "U07.CP"]) {
      const d = defs.find((x) => x.id === id);
      const n = d?.authored.length ?? 0;
      expect([id, Boolean(d), n >= 2 && n <= 3, Boolean(d?.make)]).toEqual([id, true, true, true]);
    }
  });
  test("C2 has a tested brief and two sessions; every X1 session has its phrase checks", () => {
    const c2 = capstones.find((x) => x.id === "C2");
    const x1 = capstones.find((x) => x.id === "X1");
    expect([(c2?.brief?.tests ?? []).length >= 8, c2?.sessionDefs.length]).toEqual([true, 2]);
    expect(x1?.sessionDefs.map((sd) => (sd.checks ?? []).length > 0)).toEqual([true, true, true]);
    for (const c of [c2, x1]) expect([c?.id, c?.sessionDefs.at(-1)?.release]).toEqual([c?.id, true]);
  });
  test("every lesson, step, example and exercise ID of U05–U07 is in ids.lock.json", () => {
    const lock = new Set(
      (
        JSON.parse(readFileSync(join(CONTENT_ROOT, "ids.lock.json"), "utf8")) as { ids: { id: string }[] }
      ).ids.map((x) => x.id),
    );
    const missing: string[] = [];
    for (const l of w4course) {
      const ids = [
        l.def.id,
        ...l.def.steps.flatMap((s) => [
          `${l.def.id}/${s.id}`,
          ...(s.example ? [`${l.def.id}@${s.example.id}`] : []),
        ]),
        ...exercisesOf(l).map(({ e }) => `${l.def.id}/${e.id}`),
      ];
      missing.push(...ids.filter((id) => !lock.has(id)));
    }
    expect(missing).toEqual([]);
  });
  test("each can-do of U05–U07 is awarded once, by the lesson the registry names", () => {
    const problems: string[] = [];
    for (const c of candos) {
      if (!W4_LESSONS.includes(c.source as SessionId)) continue;
      const by = w4course.filter((l) => (l.def.canDo as string[]).includes(c.id)).map((l) => l.def.id);
      if (by.join() !== c.source) problems.push(`${c.id}: source ${c.source}, awarded by [${by.join(" ")}]`);
    }
    expect(problems).toEqual([]);
  });
  test("no graded step before U05.L08 accepts chord() or voicing() (contracts §3.1 rule 6)", () => {
    const gated = /\bchord\(|\.voicing\(/;
    const before = w4course.filter((l) => ORDER.indexOf(l.def.id as SessionId) < ORDER.indexOf("U05.L08"));
    const found: string[] = [];
    for (const l of before)
      for (const { s, e } of exercisesOf(l))
        if (s.graded && "reference" in e)
          for (const sol of e.reference?.solutions ?? [])
            if (gated.test(sol)) found.push(`${l.def.id}/${e.id}`);
    expect(found).toEqual([]);
  });
});

// Wave 5: U08–U11 with A1.L01–L04, the checkpoints U09.CP–U11.CP and the capstones C3–C5 and X2 (sessions
// 76 and 84–131 of the default order). The cross-lesson scans below read them like every authored lesson.
const WAVE5 = ORDER.slice(ORDER.indexOf("U08.L02" as SessionId), ORDER.indexOf("X2.S2" as SessionId) + 1);
const W5_LESSONS = [
  "U08.L01",
  ...WAVE5.filter((s) => /^U(0[89]|1[01])\.L\d{2}$/.test(s)),
  ...SIDE_LESSONS,
] as SessionId[];
const w5course = W5_LESSONS.map((id) => byId.get(id)).filter((l): l is LoadedLesson => Boolean(l));

describe("U08–U11, A1, C3–C5 and X2 are complete (contracts §2.3–§2.6)", () => {
  test("the default order runs U08.L02 … X2.S2 as §2.5 prints it, gym slots and capstone sessions included", () => {
    expect(WAVE5).toEqual([
      ...["U08.L02", "U08.L03", "U08.L04", "U08.L05", "GYM.04", "U09.L01", "U09.L02", "U09.L03", "U09.L04"],
      ...["GYM.05", "U09.L05", "U10.L01", "U09.CP", "C3.S1", "C3.S2", "C3.S3", "C3.S4", "GYM.06"],
      ...["U10.L02", "U10.L03", "U10.L04", "U10.L05", "GYM.07", "U10.L06", "U10.L07", "U10.L08", "U10.L09"],
      "GYM.08",
      ...["U11.L01", "U10.CP", "C4.S1", "C4.S2", "GYM.09", "U11.L02", "U11.L03", "U11.L04", "U11.L05"],
      ...["GYM.10", "U11.L06", "U11.L07", "U11.L08", "U12.L01", "GYM.11", "U11.CP", "C5.S1", "C5.S2"],
      ...["X2.S1", "X2.S2"],
    ] as SessionId[]);
    expect([ORDER.indexOf("U08.L02" as SessionId) + 1, ORDER.indexOf("X2.S2" as SessionId) + 1]).toEqual([
      84, 131,
    ]);
  });
  test("all 31 lessons of U08–U11 and the four side lessons are authored and load", () => {
    expect(errors.filter((e) => e.folderId && W5_LESSONS.includes(e.folderId as SessionId))).toEqual([]);
    expect(W5_LESSONS.filter((id) => !byId.has(id))).toEqual([]);
    expect(W5_LESSONS.length).toBe(31);
  });
  test("U09.CP, U10.CP and U11.CP have two or three authored items and a Make", async () => {
    const { defs } = await loadCheckpointFiles();
    for (const id of ["U09.CP", "U10.CP", "U11.CP"]) {
      const d = defs.find((x) => x.id === id);
      const n = d?.authored.length ?? 0;
      expect([id, Boolean(d), n >= 2 && n <= 3, Boolean(d?.make)]).toEqual([id, true, true, true]);
    }
  });
  test("C3–C5 have tested briefs and their sessions; X2's checks open bass → changes → melody", () => {
    // C3 takes four sessions since contracts 1.6 (d13): the take and the release are its own session.
    const sessions: Record<string, number> = { C3: 4, C4: 2, C5: 2, X2: 2 };
    for (const [id, n] of Object.entries(sessions)) {
      const c = capstones.find((x) => x.id === id);
      expect([id, c?.sessionDefs.length, c?.sessionDefs.at(-1)?.release]).toEqual([id, n, true]);
      if (id !== "X2") expect([id, (c?.brief?.tests ?? []).length >= 8]).toEqual([id, true]);
    }
    const x2 = capstones.find((x) => x.id === "X2");
    const checks = (x2?.sessionDefs ?? []).flatMap((sd) => sd.checks ?? []);
    expect(checks.map((k) => [k.id, k.after ?? []])).toEqual([
      ["bass", []],
      ["changes", ["bass"]],
      ["melody-1", ["changes"]],
      ["melody-2", ["changes"]],
      ["melody-3", ["changes"]],
    ]);
  });
  test("every lesson, step, example and exercise ID of U08–U11 and A1 is in ids.lock.json", () => {
    const lock = new Set(
      (
        JSON.parse(readFileSync(join(CONTENT_ROOT, "ids.lock.json"), "utf8")) as { ids: { id: string }[] }
      ).ids.map((x) => x.id),
    );
    const missing: string[] = [];
    for (const l of w5course) {
      const ids = [
        l.def.id,
        ...l.def.steps.flatMap((s) => [
          `${l.def.id}/${s.id}`,
          ...(s.example ? [`${l.def.id}@${s.example.id}`] : []),
        ]),
        ...exercisesOf(l).map(({ e }) => `${l.def.id}/${e.id}`),
      ];
      missing.push(...ids.filter((id) => !lock.has(id)));
    }
    expect(missing).toEqual([]);
  });
  test("each can-do of U08–U11 and A1 is awarded once, by the lesson the registry names", () => {
    const problems: string[] = [];
    for (const c of candos) {
      if (!W5_LESSONS.includes(c.source as SessionId)) continue;
      const by = w5course.filter((l) => (l.def.canDo as string[]).includes(c.id)).map((l) => l.def.id);
      if (by.join() !== c.source) problems.push(`${c.id}: source ${c.source}, awarded by [${by.join(" ")}]`);
    }
    expect(problems).toEqual([]);
  });
  test("no learner-facing text names a lesson by its ID: lessons are named by their titles", () => {
    const found: string[] = [];
    const id = /\b(U\d{2}|A\d)\.(L\d{2}|CP)\b/;
    for (const l of w5course) {
      const mdx = mdxSteps(l.mdxSource ?? "");
      for (const s of l.def.steps) {
        const m = mdx.get(s.id);
        const texts = [
          ...(s.exercise ? exerciseTexts(s.exercise, s.id) : []),
          ...(m ? [{ where: `${s.id} prose`, text: `${m.prose}\n${m.onPass}` }] : []),
        ];
        // MDX comments ({/* … */}) are for authors.
        for (const t of texts)
          if (id.test(t.text.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")))
            found.push(`${l.def.id} ${t.where}: ${t.text.slice(0, 60)}`);
      }
    }
    expect(found).toEqual([]);
  });
});

// Wave 6, the end of the core: U12–U17 with U13.CP, U14.CP and U17.CP, the capstones C6 and C7 and the finale in
// two parts, CF-T in gym slots from U15.L01 and CF-A at the very end (sessions 125 and 132–185 of the default
// order). The cross-lesson scans below read them like every authored lesson; their music is
// u12-u17-music.test.ts.
const WAVE6 = ORDER.slice(ORDER.indexOf("U12.L02" as SessionId));
const W6_LESSONS = ["U12.L01", ...WAVE6.filter((s) => /^U1[2-7]\.L\d{2}$/.test(s))] as SessionId[];
const w6course = W6_LESSONS.map((id) => byId.get(id)).filter((l): l is LoadedLesson => Boolean(l));

describe("U12–U17, C6, C7 and the core finale are complete (contracts §2.3–§2.5)", () => {
  test("the default order runs U12.L02 … CF-A.S4 as §2.5 prints it, gym slots and capstone sessions included", () => {
    expect(WAVE6).toEqual([
      ...["U12.L02", "U12.L03", "U12.L04", "U12.L05", "GYM.12", "U12.L06", "U13.L01", "U13.L02", "U13.L03"],
      ...["GYM.13", "U13.L04", "U13.L05", "U13.L06", "U14.L01", "GYM.14", "U13.CP", "U14.L02", "U14.L03"],
      ...["U14.L04", "GYM.15", "U14.L05", "U14.L06", "U15.L01", "U14.CP", "CF-T.S1", "C6.S1", "C6.S2"],
      ...["U15.L02", "U15.L03", "CF-T.S2", "U15.L04", "U15.L05", "U15.L06", "U16.L01", "CF-T.S3", "U16.L02"],
      ...["U16.L03", "U16.L04", "U16.L05", "CF-T.S4", "U17.L01", "U17.L02", "U17.L03", "U17.L04", "GYM.16"],
      ...["U17.CP", "C7.S1", "C7.S2", "C7.S3", "GYM.17", "CF-A.S1", "CF-A.S2", "CF-A.S3", "CF-A.S4"],
    ] as SessionId[]);
    // U12.L01 sits among the Wave 5 sessions (125); the core ends on CF-A.S4, session 185.
    expect([ORDER.indexOf("U12.L01" as SessionId) + 1, ORDER.indexOf("U12.L02" as SessionId) + 1]).toEqual([
      125, 132,
    ]);
    expect([ORDER.length, ORDER.at(-1)]).toEqual([185, "CF-A.S4"]);
  });
  test("all 33 lessons of U12–U17 are authored and load", () => {
    expect(errors.filter((e) => e.folderId && W6_LESSONS.includes(e.folderId as SessionId))).toEqual([]);
    expect(W6_LESSONS.filter((id) => !byId.has(id))).toEqual([]);
    expect(W6_LESSONS.length).toBe(33);
  });
  test("U13.CP, U14.CP and U17.CP have two or three authored items and a Make", async () => {
    const { defs } = await loadCheckpointFiles();
    for (const id of ["U13.CP", "U14.CP", "U17.CP"]) {
      const d = defs.find((x) => x.id === id);
      const n = d?.authored.length ?? 0;
      expect([id, Boolean(d), n >= 2 && n <= 3, Boolean(d?.make)]).toEqual([id, true, true, true]);
    }
  });
  test("C6, C7 and CF-A have tested briefs and their sessions; CF-T maps the form, then bass → changes → melody", () => {
    const sessions: Record<string, number> = { C6: 2, C7: 3, "CF-A": 4, "CF-T": 4 };
    for (const [id, n] of Object.entries(sessions)) {
      const c = capstones.find((x) => x.id === id);
      expect([id, c?.sessionDefs.length, c?.sessionDefs.at(-1)?.release]).toEqual([id, n, true]);
      if (id !== "CF-T") expect([id, (c?.brief?.tests ?? []).length >= 8]).toEqual([id, true]);
    }
    const cft = capstones.find((x) => x.id === "CF-T");
    expect(
      cft?.sessionDefs.map((sd) => [sd.id, Boolean(sd.formMap), (sd.checks ?? []).length, !!sd.rubric]),
    ).toEqual([
      ["CF-T.S1", true, 4, false],
      ["CF-T.S2", false, 4, false],
      ["CF-T.S3", false, 4, false],
      ["CF-T.S4", false, 0, true],
    ]);
    // CF-T runs in gym slots (contracts §2.5): each of its sessions takes the place of a gym session.
    for (const s of cft?.sessionDefs ?? [])
      expect([s.id, ORDER.includes(s.id as SessionId)]).toEqual([s.id, true]);
  });
  test("every lesson, step, example and exercise ID of U12–U17 is in ids.lock.json", () => {
    const lock = new Set(
      (
        JSON.parse(readFileSync(join(CONTENT_ROOT, "ids.lock.json"), "utf8")) as { ids: { id: string }[] }
      ).ids.map((x) => x.id),
    );
    const missing: string[] = [];
    for (const l of w6course) {
      const ids = [
        l.def.id,
        ...l.def.steps.flatMap((s) => [
          `${l.def.id}/${s.id}`,
          ...(s.example ? [`${l.def.id}@${s.example.id}`] : []),
        ]),
        ...exercisesOf(l).map(({ e }) => `${l.def.id}/${e.id}`),
      ];
      missing.push(...ids.filter((id) => !lock.has(id)));
    }
    expect(missing).toEqual([]);
  });
  test("each can-do of U12–U17 is awarded once, by the lesson the registry names", () => {
    const problems: string[] = [];
    for (const c of candos) {
      if (!W6_LESSONS.includes(c.source as SessionId)) continue;
      const by = w6course.filter((l) => (l.def.canDo as string[]).includes(c.id)).map((l) => l.def.id);
      if (by.join() !== c.source) problems.push(`${c.id}: source ${c.source}, awarded by [${by.join(" ")}]`);
    }
    expect(problems).toEqual([]);
  });
  test("no learner-facing text names a lesson or a unit by its ID: lessons and units are named by their titles", () => {
    const found: string[] = [];
    // "A7" is a chord: a side lesson is caught by its full ID only.
    const id = /\b(U\d{2}(\.(L\d{2}|CP))?|A\d\.L\d{2})\b/;
    for (const l of w6course) {
      const mdx = mdxSteps(l.mdxSource ?? "");
      for (const s of l.def.steps) {
        const m = mdx.get(s.id);
        const texts = [
          ...(s.exercise ? exerciseTexts(s.exercise, s.id) : []),
          ...(m ? [{ where: `${s.id} prose`, text: `${m.prose}\n${m.onPass}` }] : []),
        ];
        for (const t of texts)
          if (id.test(t.text.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")))
            found.push(`${l.def.id} ${t.where}: ${t.text.slice(0, 60)}`);
      }
    }
    expect(found).toEqual([]);
  });
  test("every lesson that says what comes next names the session that comes next in the default order", () => {
    // A closing "Next: …" line keeps its promise (ux: RETURN): the lesson, checkpoint or capstone it names is the
    // next core session after this one, gym slots aside. Each line is matched by the title it promises.
    const PROMISES: Record<string, string> = {
      "U12.L02": "U12.L03",
      "U12.L03": "U12.L04",
      "U12.L04": "U12.L05",
      "U12.L05": "U12.L06",
      "U13.L06": "U14.L01",
      "U14.L02": "U14.L03",
      "U14.L03": "U14.L04",
      "U14.L04": "U14.L05",
      "U14.L05": "U14.L06",
      "U14.L06": "U15.L01",
      "U15.L06": "U16.L01",
      "U16.L01": "U16.L02",
      "U16.L02": "U16.L03",
      "U16.L03": "U16.L04",
      "U16.L04": "U16.L05",
      "U16.L05": "U17.L01",
      "U17.L01": "U17.L02",
      "U17.L03": "U17.L04",
      "U17.L04": "U17.CP",
    };
    const next = (from: string) =>
      ORDER.slice(ORDER.indexOf(from as SessionId) + 1).find(
        (s) => !s.startsWith("GYM.") && !s.startsWith("CF-T."),
      );
    for (const [from, to] of Object.entries(PROMISES)) {
      const l = byId.get(from);
      expect([from, /\bNext\b/.test(l?.mdxSource ?? ""), next(from)]).toEqual([from, true, to]);
    }
  });
});

describe("side lessons (contracts §2.6, §4.3)", () => {
  test("A1.L01–L04 are the side lessons: optional, outside the default order, open once U03.L02 is done", () => {
    expect(SIDE_LESSONS).toEqual(["A1.L01", "A1.L02", "A1.L03", "A1.L04"] as SessionId[]);
    for (const id of SIDE_LESSONS) {
      expect([id, ORDER.includes(id)]).toEqual([id, false]);
      const before = g.before(id);
      expect([id, before.has("U03.L02" as SessionId), before.has("U03.L03" as SessionId)]).toEqual([
        id,
        true,
        false,
      ]);
      // Nothing in the core waits for a side lesson.
      for (const core of ORDER) expect([core, g.before(core).has(id)]).toEqual([core, false]);
    }
  });
  // (Its glossary examples are linted at the side lesson itself in registries.test.ts "glossary examples".)
  test("a side lesson's skills need nothing past its gate", () => {
    const late: string[] = [];
    for (const id of SIDE_LESSONS) {
      const meta = registries.syllabus.units.flatMap((u) => u.lessons).find((l) => l.id === id);
      for (const sk of [...(meta?.introduces ?? []), ...(meta?.practises ?? [])]) {
        const node = registries.skills.find((x) => x.id === sk);
        for (const p of sk && meta?.introduces.includes(sk) ? (node?.prerequisites ?? []) : [sk]) {
          const pre = registries.skills.find((x) => x.id === p);
          if (pre && pre.introducedBy !== id && !atOrBefore(g, pre.introducedBy, id))
            late.push(`${id}: ${p} arrives in ${pre.introducedBy}`);
        }
      }
    }
    expect(late).toEqual([]);
  });
});

describe("prerequisite order (contracts §4)", () => {
  test("a lesson introduces the skills the graph says it does, after their prerequisites, in every legal order", () => {
    const problems: string[] = [];
    for (const l of authored)
      for (const sk of l.def.introduces) {
        const node = registries.skills.find((x) => x.id === sk);
        if (!node) {
          problems.push(`${l.def.id}: introduces unknown skill ${sk}`);
          continue;
        }
        if (node.introducedBy !== l.def.id)
          problems.push(`${l.def.id}: introduces ${sk}, which the graph gives to ${node.introducedBy}`);
        for (const p of node.prerequisites) {
          const pre = registries.skills.find((x) => x.id === p);
          if (pre && !atOrBefore(g, pre.introducedBy, l.def.id as SessionId))
            problems.push(`${l.def.id}: ${sk} needs ${p}, which arrives in ${pre.introducedBy}`);
        }
      }
    expect(problems).toEqual([]);
  });
});

describe("vocabulary across lesson boundaries (AUTHORING §7)", () => {
  test("every term of an authored lesson is declared once, by the lesson the glossary names, both halves of a pair", () => {
    const declaredBy = new Map<string, string[]>();
    for (const l of authored)
      for (const t of l.def.terms) declaredBy.set(t.id, [...(declaredBy.get(t.id) ?? []), l.def.id]);
    const problems: string[] = [];
    const authoredIds = new Set<string>(authored.map((l) => l.def.id));
    for (const t of registries.terms) {
      if (!authoredIds.has(t.introducedBy)) continue;
      const by = declaredBy.get(t.id) ?? [];
      if (by.length !== 1 || by[0] !== t.introducedBy)
        problems.push(`${t.id}: glossary says ${t.introducedBy}, declared by [${by.join(" ")}]`);
    }
    for (const [id, by] of declaredBy)
      if (termById.get(id)?.introducedBy !== by[0]) problems.push(`${id}: declared by ${by.join(" ")}`);
    expect(problems).toEqual([]);
  });
  test("no lesson introduces more than three terms, counting a pair once", () => {
    for (const l of authored)
      expect([l.def.id, countTerms(l.def.terms, registries.terms) <= 3]).toEqual([l.def.id, true]);
  });
  // A later lesson's term in an earlier lesson's text is advice in content:check (many are plain English).
  // Read as one course, each one is either reworded or listed here with the reason it stays.
  const ALLOWED_LATER_TERMS: Record<string, string> = {
    'U03.L10 S3 title "swing"': 'the song title "Swing Low, Sweet Chariot", not the U11.L07 term',
    'U03.L10 S3 pass text "swing"': 'the song title "Swing Low", not the U11.L07 term',
  };
  test("no lesson uses a later lesson's term unless it is listed with its reason", () => {
    const found: string[] = [];
    for (const l of authored)
      for (const w of lessonAuthoring(l.def, l.mdxSource).warnings) {
        const m = w.match(/^(\S+ [a-z ]+?\d*): "([^"]+)" is a term of/);
        if (m) found.push(`${l.def.id} ${m[1]} "${m[2]}"`);
      }
    expect(found.filter((f) => !(f in ALLOWED_LATER_TERMS))).toEqual([]);
    expect(Object.keys(ALLOWED_LATER_TERMS).filter((k) => !found.includes(k))).toEqual([]);
  });
});

describe("unlock-before-use across lesson boundaries (contracts §3.1)", () => {
  const byName = new Map<string, string[]>();
  for (const t of toolbox) for (const m of t.matches ?? []) byName.set(m, [...(byName.get(m) ?? []), t.id]);
  test("prose, prompts, hints and labels name only tools and sounds the learner has at that lesson", () => {
    const locked: string[] = [];
    for (const l of authored) {
      if (ONBOARDING_PREVIEW.has(l.def.id)) continue; // U00 is a preview context (§3.1 rule 5a)
      const open = unlockedFor(l.def.id as SessionId);
      const mdx = mdxSteps(l.mdxSource ?? "");
      for (const s of l.def.steps) {
        const texts = [
          { where: `${s.id} title`, text: s.title },
          ...(s.exercise ? exerciseTexts(s.exercise, s.id) : []),
          { where: `${s.id} prose`, text: `${mdx.get(s.id)?.prose ?? ""}\n${mdx.get(s.id)?.onPass ?? ""}` },
        ];
        for (const t of texts)
          for (const m of t.text.matchAll(/`([^`]+)`/g))
            for (const name of (m[1] as string).match(/[A-Za-z_]\w*/g) ?? []) {
              const ids = byName.get(name);
              if (ids && !ids.some((id) => open.has(id as never)))
                locked.push(`${l.def.id} ${t.where}: \`${m[1]}\` names ${ids.join("/")}`);
            }
      }
    }
    expect(locked).toEqual([]);
  });
  test("every exercise's skills are introduced at or before its lesson, in every legal order", () => {
    const late: string[] = [];
    for (const l of authored)
      for (const { s, e } of exercisesOf(l))
        for (const sk of e.skills) {
          const node = registries.skills.find((x) => x.id === sk.skill.split("/")[0]);
          if (node && !atOrBefore(g, node.introducedBy, l.def.id as SessionId))
            late.push(`${l.def.id}/${s.id}/${e.id}: ${sk.skill} arrives in ${node.introducedBy}`);
        }
    expect(late).toEqual([]);
  });
  test("every drill family a lesson seeds, reviews or draws a stimulus from is open there", () => {
    const late: string[] = [];
    for (const l of authored)
      for (const { s, e } of exercisesOf(l)) {
        const fams = [
          ...(e.srs ?? []).flatMap((x) => (x.family ? [{ id: x.family, level: 1 }] : [])),
          ...("stimulus" in e && e.stimulus?.src === "generator"
            ? [{ id: e.stimulus.family, level: e.stimulus.level }]
            : []),
        ];
        for (const f of fams) {
          const def = familyById.get(f.id);
          if (!def) continue;
          const gate = def.unlock.levelGates?.[f.level] ?? def.unlock.lesson;
          const gates = Array.isArray(gate) ? gate : [gate];
          if (!gates.some((x) => atOrBefore(g, x as SessionId, l.def.id as SessionId)))
            late.push(`${l.def.id}/${s.id}/${e.id}: ${f.id} level ${f.level} opens at ${gates.join("/")}`);
        }
      }
    expect(late).toEqual([]);
  });
});

describe("can-dos and milestones", () => {
  test("each can-do of U00–U02 is awarded once, by the lesson the registry names", () => {
    const problems: string[] = [];
    for (const c of candos) {
      if (!LESSONS.includes(c.source as SessionId)) continue;
      const by = course.filter((l) => (l.def.canDo as string[]).includes(c.id)).map((l) => l.def.id);
      if (by.join() !== c.source) problems.push(`${c.id}: source ${c.source}, awarded by [${by.join(" ")}]`);
    }
    expect(problems).toEqual([]);
  });
  test("every milestone condition names a real session, capstone or can-do", () => {
    const sessions = new Set<string>([
      ...ORDER,
      ...registries.syllabus.units.flatMap((u) => u.lessons.map((l) => l.id as string)),
      ...registries.syllabus.checkpoints.map((c) => c.id as string),
    ]);
    for (const m of milestones)
      for (const w of [m.when, ...(m.when.anyOf ?? [])]) {
        for (const s of [...(w.sessions ?? []), ...(w.ladder?.after ? [w.ladder.after] : [])])
          expect([m.id, s, sessions.has(s)]).toEqual([m.id, s, true]);
        for (const c of w.capstones ?? [])
          expect([m.id, c, capstones.some((x) => x.id === c)]).toEqual([m.id, c, true]);
        for (const c of w.canDos ?? [])
          expect([m.id, c, candos.some((x) => x.id === c)]).toEqual([m.id, c, true]);
      }
  });
  test("the nine milestones of ux §5.5 are all defined, then Wave 5's five, Wave 6's six and Wave 7's eight", () => {
    expect(milestones.map((m) => m.id)).toEqual(
      [
        ...["ms.01", "ms.02", "ms.03", "ms.04", "ms.05", "ms.06", "ms.07", "ms.08", "ms.09"],
        ...["ms.10", "ms.11", "ms.12", "ms.13", "ms.14"],
        ...["ms.15", "ms.16", "ms.17", "ms.18", "ms.19", "ms.20"],
        ...["ms.21", "ms.22", "ms.23", "ms.24", "ms.25", "ms.26", "ms.27", "ms.28"],
      ].map((x) => x as never),
    );
    // The end of the core (ux §5.5 "Core Finale") needs both parts of the finale: CF-T ends before U17.
    expect(milestones.find((m) => m.id === "ms.07")?.when).toEqual({ capstones: ["CF-A", "CF-T"] });
  });
});

describe("session budget and shape (contracts §9)", () => {
  test("each lesson fits the 20-minute target and splits cleanly at 15 minutes", () => {
    for (const l of authored) {
      const b = lessonBudget(l.def);
      expect([
        l.def.id,
        b.scaledMinutes <= 13,
        b.partAScaled <= 8.5,
        b.partBScaled <= 9.5,
        b.gradedChecks <= 3,
      ]).toEqual([l.def.id, true, true, true, true]);
    }
  });
  test("every graded step has a four-rung hint ladder", () => {
    for (const l of authored)
      for (const s of l.def.steps.filter((x) => x.graded && x.exercise))
        for (const e of flattenExercise(s.exercise as Exercise))
          expect([l.def.id, s.id, e.id, e.hints?.length ?? 0]).toEqual([l.def.id, s.id, e.id, 4]);
  });
  test("each Make's required rule practises the lesson's own idea", () => {
    for (const l of authored) {
      const make = l.def.steps.at(-1)?.exercise;
      const req = make && "rubric" in make ? make.rubric.find((r) => r.required) : undefined;
      const own = new Set<string>([...l.def.introduces, ...l.def.practises]);
      expect([l.def.id, (req?.skills ?? []).some((sk) => own.has(sk))]).toEqual([l.def.id, true]);
    }
  });
  test("every unit from U02 has a Play from the page step once it is authored: staff, no roll (§9.2 rule 8)", () => {
    for (const unit of registries.syllabus.units.filter((u) => u.track === "core" && u.id >= "U02")) {
      const lessons = authored.filter((l) => unit.lessons.some((m) => m.id === l.def.id));
      if (lessons.length < unit.lessons.length) continue; // still being written
      const pages = lessons.flatMap((l) =>
        l.def.steps
          .filter(
            (s) => (s.kind === "modify" || s.kind === "dictate") && s.ui.panels?.staff && !s.ui.panels?.roll,
          )
          .map((s) => `${l.def.id}/${s.id}`),
      );
      expect([unit.id, pages.length > 0]).toEqual([unit.id, true]);
    }
  });
});

// What plays over the Band. A learner note a half step above a Band note sounding at the same time, held for
// a beat or more, is the harshest clash there is (a minor ninth). Shown examples and reference solutions
// must not do it, except a passing note on the way somewhere, listed here with its reason.
const ALLOWED_CLASHES: Record<string, string> = {
  "U02.L03 hook f4@1":
    "the chromatic creep e f f# g passes through F on its way to G; the creep is the point",
  "U02.L08 hook f4@2": "Ode to Joy's own passing F in bar 1 (e e f g)",
  "U02.L08 your-arrangement:starter f4@2": "the Make starts from that same Ode to Joy opening",
};
describe("music over the Band", () => {
  test("no shown example or reference sounds a half step above the Band's chord for a beat", async () => {
    const found: string[] = [];
    for (const l of authored) {
      for (const s of l.def.steps) {
        // The Band plays only where the step declares it, with the tracks that step lists (`tracks:
        // ["drums"]` leaves no harmony to clash with), in the key of the step's exercise.
        const band = s.ui.band;
        const b = band ? bandById.get(band.band) : undefined;
        if (!band || !b || bandMeter(b.id) !== l.def.meter) continue;
        const beats = Number(l.def.meter.split("/")[0]);
        const exKey = s.exercise && "key" in s.exercise ? s.exercise.key : undefined;
        const k = exKey ?? l.def.key;
        const key = `${k.tonic}4:${k.mode}`;
        const plays = (t: string) => !band.tracks || band.tracks.includes(t as "bass" | "chords");
        const harmony = (b.code["flavour.pop"] ?? "")
          .replaceAll("{{key}}", key)
          .split("\n")
          .filter((ln) => /^(bass|chords):/.test(ln) && plays(ln.split(":")[0] as string))
          .map((ln) => `band_${ln}`)
          .join("\n");
        if (!harmony) continue;
        const shown: { id: string; code: string }[] = [];
        if (s.example) shown.push({ id: s.example.id, code: s.example.code });
        for (const e of s.exercise ? flattenExercise(s.exercise) : []) {
          if ("reference" in e && e.reference?.solutions?.[0])
            shown.push({ id: e.id, code: e.reference.solutions[0] });
          if (e.kind === "code-make")
            shown.push({ id: `${e.id}:starter`, code: stripMarkers(e.code.starter).code });
        }
        for (const c of shown) {
          const r = await evalHeadless(`${c.code}\n${harmony}`, Number(b.bars) * 2);
          const backing = r.events.filter((e) => e.track.startsWith("band_") && e.midi !== null);
          for (const n of r.events.filter((e) => !e.track.startsWith("band_") && e.midi !== null)) {
            const [b0, b1] = [frac(n.begin), frac(n.end)];
            if ((b1 - b0) * beats < 1) continue;
            const hit = backing.some(
              (x) =>
                frac(x.begin) < b1 &&
                frac(x.end) > b0 &&
                ((((n.midi as number) - (x.midi as number)) % 12) + 12) % 12 === 1,
            );
            if (hit) found.push(`${l.def.id} ${c.id} ${n.note}@${(b0 * beats) % (beats * Number(b.bars))}`);
          }
        }
      }
    }
    const unique = [...new Set(found)];
    expect(unique.filter((f) => !(f in ALLOWED_CLASHES))).toEqual([]);
    expect(Object.keys(ALLOWED_CLASHES).filter((k) => !unique.includes(k))).toEqual([]);
  }, 60_000);
});

function frac(s: string): number {
  const [a, b] = s.split("/").map(Number);
  return b ? (a as number) / b : (a as number);
}
