// Every authored test of every authored track lesson (Wave 7: J1–J5, R1–R3, A1.L05–L07, A2) and every authored
// track checkpoint, sent through the player's own grading path (`gradeStep`: wire shape → grader shape, params,
// the tools unlocked at that lesson, its swing and pickup), must come out as its author pinned it — the same path a
// learner's answer takes in the app. Picked up from content/advanced as the authors land them; the seven Foundation
// exemplars must be there.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import type { AttemptResponse, Exercise, LessonDef, SessionId, TestCase } from "@oak/api";
import type { CheckpointDef } from "@oak/content-kit";
import { evaluateForGrading, gradeExercise, initRealm } from "@oak/grader";
import { courseGraph } from "../../../content/index.ts";
import { unlockedAt } from "../../../content/lib/course.ts";
import { toolbox } from "../../../content/toolbox.ts";
import { CP_BPM, CP_KEY, itemKey } from "./checkpoint/model.ts";
import { type GradeEnv, type GraderDeps, gradeStep, NEUTRAL_PROFILE } from "./grading.ts";
import { partsOf } from "./model.ts";

setDefaultTimeout(60_000);

const ROOT = new URL("../../../content/advanced/", import.meta.url).pathname;

/** The exemplars written in Foundation (wave7.md §1). */
const EXEMPLARS = ["J1.L01", "J2.L01", "J3.L01", "J5.L01", "R1.L01", "R3.L01", "A2.L01"];
/** The sound side lessons are Wave 5's (grading.test.ts runs them). */
const SIDE = /^A1\.L0[1-4]$/;

const lessonIds = readdirSync(ROOT, { withFileTypes: true })
  .filter((u) => u.isDirectory())
  .flatMap((u) =>
    readdirSync(`${ROOT}${u.name}`, { withFileTypes: true })
      .filter((l) => l.isDirectory() && /^L\d\d$/.test(l.name))
      .map((l) => `${u.name}.${l.name}`),
  )
  .filter((id) => !SIDE.test(id))
  .sort();

const LESSONS: LessonDef[] = await Promise.all(
  lessonIds.map(async (id) => {
    const [unit, lesson] = id.split(".") as [string, string];
    return ((await import(`${ROOT}${unit}/${lesson}/lesson.ts`)) as { default: LessonDef }).default;
  }),
);

/** Track checkpoint files (author:CP's folders), found by the ID they define. */
function checkpointFiles(dir = ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? checkpointFiles(`${dir}${e.name}/`)
      : e.name === "checkpoint.ts"
        ? [`${dir}${e.name}`]
        : [],
  );
}
const CHECKPOINTS: CheckpointDef[] = (
  await Promise.all(
    checkpointFiles()
      .filter((f) => /id: "[JRA]\.CP\d?"/.test(readFileSync(f, "utf8")))
      .map(async (f) => Object.values((await import(f)) as Record<string, unknown>)),
  )
)
  .flat()
  .filter(
    (v): v is CheckpointDef =>
      !!v && typeof v === "object" && /^[JRA]\.CP\d?$/.test(String((v as { id?: unknown }).id)),
  )
  // A checkpoint file exports its definition both by name and as default: each is graded once.
  .filter((v, i, all) => all.findIndex((x) => x.id === v.id) === i);

const deps: GraderDeps = {
  grade: (req) => gradeExercise(req),
  evaluate: (code, bars, meter) => evaluateForGrading(code, { mode: "lesson", bars, lint: null, meter }),
};

beforeAll(async () => {
  await initRealm({ toolbox: [...toolbox], lockdown: false });
});

/** A content test's response in the wire shape the player stores. */
function wire(t: TestCase): AttemptResponse | null {
  const r = t.response;
  if ("pitchFixture" in r) return null;
  return r as AttemptResponse;
}

/**
 * Registers one test per authored test. `envOf` is the environment the player grades that exercise in: a lesson's
 * own for each of its steps; for a checkpoint item, its own key (else the Make's), its own meter and the Make's
 * tempo, exactly as CheckpointPlayer builds it.
 */
function cases(envOf: (ex: Exercise) => GradeEnv, exercises: readonly { label: string; ex: Exercise }[]) {
  for (const { label, ex } of exercises)
    for (const part of partsOf(ex))
      for (const t of [...(ex.kind === "all" && part === ex.parts[0] ? ex.tests : []), ...part.tests]) {
        const response = wire(t);
        if (!response) continue;
        const target = ex.kind === "all" && ex.tests.includes(t) ? ex : part;
        test(`${label} ${target === ex ? ex.id : part.id}: ${t.name} → ${t.expect}`, async () => {
          const r = await gradeStep(deps, envOf(ex), target as Exercise, response, {
            params: t.params ?? {},
            attemptNo: 1,
            rung: 0,
            extraReplays: 0,
          });
          if (t.expect === "pass") expect(r.status).toBe("pass");
          else if (t.expect === "fail") expect(r.status).not.toBe("pass");
          else expect(r.status).toBe("error");
          for (const code of t.feedback ?? []) expect(r.diagnostics.map((d) => d.id)).toContain(code);
        });
      }
}

describe("Wave 7: the authored track lessons are here", () => {
  test("the seven Foundation exemplars, and every lesson file loads", () => {
    const ids = LESSONS.map((d) => d.id as string);
    for (const id of EXEMPLARS) expect(ids).toContain(id);
    expect(ids).toEqual(lessonIds);
  });
  // Oak 2.0 W2 adds J3.L05, R1.L06 and A2.L08 here; A2.L07 and A2.L09 make A 12 when they land (decision 113).
  test("all 49 track lessons (J 23, R 16, A1.L05–L07 and A2 7) and the four track checkpoints are graded here", () => {
    const by = (re: RegExp) => lessonIds.filter((id) => re.test(id)).length;
    expect([by(/^J/), by(/^R/), by(/^A/)]).toEqual([23, 16, 10]);
    expect(CHECKPOINTS.map((c) => c.id as string).sort()).toEqual(["A.CP", "J.CP1", "J.CP2", "R.CP"]);
  });
  test("every graded step of every track lesson pins at least one pass and one mistake", () => {
    const missing: string[] = [];
    for (const def of LESSONS)
      for (const s of def.steps) {
        const ex = s.exercise;
        if (!ex || !s.graded) continue;
        for (const part of partsOf(ex)) {
          const all = [...(ex.kind === "all" ? ex.tests : []), ...part.tests];
          const pass = all.some((t) => t.expect === "pass");
          const fail = all.some((t) => t.expect === "fail");
          if (!(pass && fail) && part.stimulus?.src !== "generator" && !("sung" in (all[0]?.response ?? {})))
            missing.push(`${def.id} ${s.id} ${part.id}`);
        }
      }
    expect(missing).toEqual([]);
  });
});

for (const def of LESSONS) {
  describe(`${def.id} authored tests through the player's grading path`, () => {
    const env: GradeEnv = {
      ownerId: def.id,
      key: def.key,
      meter: def.meter,
      bpm: def.bpm,
      ...(def.swing ? { swing: def.swing } : {}),
      ...(def.pickup ? { pickup: def.pickup } : {}),
      unlocked: unlockedAt(courseGraph(), toolbox, def.id as SessionId),
      allowPreview: false,
      profile: NEUTRAL_PROFILE,
    };
    cases(
      () => env,
      def.steps.flatMap((s) => (s.exercise ? [{ label: s.id, ex: s.exercise }] : [])),
    );
  });
}

for (const cp of CHECKPOINTS) {
  describe(`${cp.id} authored items and Make through the player's grading path`, () => {
    const unlocked = unlockedAt(courseGraph(), toolbox, cp.id as SessionId);
    const cpKey = cp.make.key ?? CP_KEY;
    const cpBpm = typeof cp.make.bpm === "number" ? cp.make.bpm : CP_BPM;
    cases(
      (ex) => ({
        ownerId: cp.id,
        key: itemKey(ex, null, cpKey),
        meter: ex.meter ?? "4/4",
        bpm: cpBpm,
        unlocked,
        allowPreview: false,
        profile: NEUTRAL_PROFILE,
      }),
      [...cp.authored, cp.make].map((ex) => ({ label: cp.id, ex: ex as Exercise })),
    );
  });
}
