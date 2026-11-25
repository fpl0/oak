// Oak 2.0 fidelity pins (docs/oak2/PLAN.md §2 rule 4): for every graded step W2 adds, a piece that keeps the surface
// but misses the book's point must fail, and a piece that gets the point another way must pass. Each lesson's pins
// live in `pins/<lesson id>.ts`; every pin is graded as content:check grades it (the real realm, production
// normalize, the step's own exercise and its lesson), the way corrections-gate.test.ts grades its pins. The grading
// is copied from that file's `target()` and test body, not imported, so the gate file stays untouched.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Exercise } from "@oak/content-kit";
import { flattenExercise } from "@oak/content-kit";
import { grade } from "./harness.ts";
import { W2_GRADED } from "./pins/index.ts";
import type { Oak2Pin } from "./pins/types.ts";

setDefaultTimeout(600_000);

const PINS_DIR = join(import.meta.dir, "pins");
const LESSON_ID = /^(U\d\d|[JRA]\d)\.(L\d\d)$/;
const PIN_FILE = /^((?:U\d\d|[JRA]\d)\.L\d\d)\.ts$/;

/** A lesson's file: content/core/<UNIT>/Lnn for the core, content/advanced/<UNIT>/Lnn for the tracks. */
const lessonFile = (id: string): string | null => {
  const m = LESSON_ID.exec(id);
  if (!m) return null;
  const unit = m[1] as string;
  return join(
    import.meta.dir,
    "..",
    unit.startsWith("U") ? "core" : "advanced",
    unit,
    m[2] as string,
    "lesson.ts",
  );
};

interface LoadedStep {
  id: string;
  kind: string;
  graded?: boolean;
  exercise?: Exercise;
}
interface LoadedLessonDef {
  id: string;
  steps: LoadedStep[];
}
const loadLesson = async (id: string): Promise<LoadedLessonDef | null> => {
  const file = lessonFile(id);
  if (!file || !existsSync(file)) return null;
  return (await import(file)).default as LoadedLessonDef;
};

/** Every pins file, in name order, with the pins it exports (default export, or `PINS`). */
const files = readdirSync(PINS_DIR)
  .filter((f) => PIN_FILE.test(f))
  .sort();
const byFile: { file: string; owner: string; pins: Oak2Pin[] }[] = [];
for (const file of files) {
  const mod = (await import(join(PINS_DIR, file))) as { default?: Oak2Pin[]; PINS?: Oak2Pin[] };
  byFile.push({ file, owner: PIN_FILE.exec(file)?.[1] as string, pins: mod.default ?? mod.PINS ?? [] });
}
const PINS = byFile.flatMap((f) => f.pins);

/** The exercise a pin grades and the lesson it is graded in (corrections-gate.test.ts `target()`, lessons only). */
async function target(p: Oak2Pin): Promise<{ ex: Exercise | undefined; lesson: never; session: string }> {
  const def = await loadLesson(p.owner);
  if (!def) throw new Error(`no lesson ${p.owner}`);
  const step = def.steps.find((s) => s.id === p.at);
  const all = def.steps.flatMap((s) => (s.exercise ? flattenExercise(s.exercise) : []));
  const ex = step?.exercise
    ? (flattenExercise(step.exercise).find((x) => x.kind !== "all") ?? step.exercise)
    : all.find((e) => e.id === p.at);
  return { ex, lesson: def as never, session: def.id };
}

describe("Oak 2.0 pins files", () => {
  test("every pin sits in its owner's file and says which kind it is", () => {
    const bad: string[] = [];
    for (const f of byFile)
      for (const p of f.pins) {
        if (p.owner !== f.owner) bad.push(`${f.file}: ${p.name} names ${p.owner}`);
        if (p.kind === "book-miss" && p.expect !== "fail")
          bad.push(`${f.file}: book-miss "${p.name}" must fail`);
        if (p.kind === "book-other-way" && p.expect !== "pass")
          bad.push(`${f.file}: book-other-way "${p.name}" must pass`);
      }
    expect(bad).toEqual([]);
  });
});

describe("Oak 2.0 pins: misses of the book's point fail, other ways to the point pass", () => {
  for (const p of PINS)
    test(`${p.owner} ${p.at}: ${p.name} (${p.kind}, ${p.expect})`, async () => {
      const t = await target(p);
      expect(t.ex).toBeDefined();
      const tempo = /setcp[ms]\(/.test(p.code) ? "" : "setcpm(96/4)\n\n";
      const r = await grade(
        t.ex as Exercise,
        { name: p.name, response: { code: tempo + p.code }, expect: p.expect } as never,
        t.lesson,
        t.session as never,
        "lesson",
      );
      expect(r.passed).toBe(p.expect === "pass");
      if (p.says) expect((r.messages ?? []).join("\n")).toContain(p.says);
    });
});

describe("Oak 2.0 pins: coverage", () => {
  test("every graded W2 step its lesson already grades has a book-miss that fails and a book-other-way that passes", async () => {
    const missing: string[] = [];
    for (const { owner, at } of W2_GRADED) {
      const def = await loadLesson(owner);
      const step = def?.steps.find((s) => s.id === at);
      // Not written yet (no lesson, no such step, or the step is not graded yet): nothing to cover.
      if (!step || !(step.graded || step.kind === "make")) continue;
      const mine = PINS.filter((p) => p.owner === owner && p.at === at);
      if (!mine.some((p) => p.kind === "book-miss" && p.expect === "fail"))
        missing.push(`${owner} ${at}: book-miss`);
      if (!mine.some((p) => p.kind === "book-other-way" && p.expect === "pass"))
        missing.push(`${owner} ${at}: book-other-way`);
    }
    expect(missing).toEqual([]);
  });
});
