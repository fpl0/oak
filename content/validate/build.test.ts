// The content pipeline (architecture §3.6, interfaces §9): the build is deterministic and complete, the ID
// ledger update rule holds, and `content:new` scaffolds a lesson that loads and lints in its session.
import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LessonDef } from "@oak/content-kit";
import { generate, idsModule, updateLock } from "../../scripts/content/generate.ts";
import { scaffold } from "../../scripts/content/new.ts";
import { CONTENT_ROOT } from "../lib/load.bun.ts";
import { checkLint, checkSchema } from "./checks.ts";

setDefaultTimeout(60_000);
const tmp = mkdtempSync(join(tmpdir(), "oak-content-build-"));
const scaffoldRoot = join(CONTENT_ROOT, `.scaffold-test-${process.pid}`);
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
  rmSync(scaffoldRoot, { recursive: true, force: true });
});

describe("build", () => {
  test("two runs over the same sources are byte-identical", async () => {
    const a = await generate({ outDir: join(tmp, "a"), writeLock: false });
    const b = await generate({ outDir: join(tmp, "b"), writeLock: false });
    expect(a.errors).toEqual([]);
    expect(a.files).toEqual(b.files);
    expect(a.contentVersion).toBe(b.contentVersion);
    for (const f of a.files)
      expect([f, readFileSync(join(tmp, "a", f), "utf8")]).toEqual([
        f,
        readFileSync(join(tmp, "b", f), "utf8"),
      ]);
  });
  test("writes every output the app, the server and the tutor read", () => {
    for (const f of [
      "ids.ts",
      "index.json",
      "course-index.json",
      "skill-graph.json",
      "toolbox.json",
      "catalog.json",
      "lessons.json",
      "examples.json",
      "sounds-used.json",
      "tutor/syllabus.md",
      "tutor/catalog.md",
      "lesson-text/U00.L00.json",
    ])
      expect([f, existsSync(join(tmp, "a", f))]).toEqual([f, true]);
    const course = JSON.parse(readFileSync(join(tmp, "a", "course-index.json"), "utf8")) as {
      sessions: { id: string; defaultOrder: number | null; earStages?: string[] }[];
    };
    expect(course.sessions.length).toBe(270);
    expect(course.sessions.filter((s) => s.defaultOrder !== null).length).toBe(191);
    expect(course.sessions.find((s) => s.id === "U03.L02")?.earStages).toEqual(["B"]);
    const graph = JSON.parse(readFileSync(join(tmp, "a", "skill-graph.json"), "utf8")) as {
      nodes: unknown[];
      edges: unknown[];
    };
    expect(graph.nodes.length).toBe(143);
    expect(JSON.parse(readFileSync(join(tmp, "a", "toolbox.json"), "utf8")).length).toBe(234);
    expect(readFileSync(join(tmp, "a", "tutor", "catalog.md"), "utf8")).toContain("## `scale`");
  });
  test("ids.ts is valid TypeScript with one union per kind", async () => {
    const src = idsModule({ lesson: ["U01.L01", "U01.L02"], skill: ["R01"] });
    const file = join(tmp, "ids-check.ts");
    writeFileSync(file, src);
    const mod = (await import(file)) as Record<string, unknown>;
    expect(mod.LESSON_IDS).toEqual(["U01.L01", "U01.L02"]);
    expect((mod.isLessonId as (x: unknown) => boolean)("U01.L02")).toBe(true);
    expect((mod.isSkillId as (x: unknown) => boolean)("R02")).toBe(false);
  });
});

describe("parallel builds (five authors run content:build and content:check at once)", () => {
  test("concurrent builds into one directory leave it complete, identical and free of temporaries", async () => {
    const out = join(tmp, "parallel");
    const reference = await generate({ outDir: join(tmp, "single"), writeLock: false });
    // An old file the build no longer produces, and a stale copy of one it does.
    mkdirSync(join(out, "lesson-text"), { recursive: true });
    writeFileSync(join(out, "lesson-text", "U99.L99.json"), "{}");
    writeFileSync(join(out, "index.json"), "stale");
    const runs = Array.from({ length: 4 }, () =>
      Bun.spawn(["bun", join(import.meta.dir, "../../scripts/content/build.ts"), "--out", out, "--no-lock"], {
        stdout: "pipe",
        stderr: "pipe",
      }),
    );
    expect(await Promise.all(runs.map((r) => r.exited))).toEqual([0, 0, 0, 0]);
    for (const f of reference.files)
      expect([f, readFileSync(join(out, f), "utf8")]).toEqual([
        f,
        readFileSync(join(tmp, "single", f), "utf8"),
      ]);
    expect(existsSync(join(out, "lesson-text", "U99.L99.json"))).toBe(false);
    const leftovers = new Bun.Glob("**/.*.tmp-*").scanSync({ cwd: out, dot: true });
    expect([...leftovers]).toEqual([]);
  });
});

describe("ID ledger (contracts §1.1 rule 4)", () => {
  test("new IDs are added; a vanished ID fails unless it is retired", () => {
    const { lock, errors } = updateLock(
      [
        { id: "U01.L01", kind: "lesson" },
        { id: "CF", kind: "capstone", retiredAt: "v1" },
      ],
      { lesson: ["U01.L01", "U01.L02"] },
    );
    expect(errors).toEqual([]);
    expect(lock.map((e) => e.id)).toEqual(["CF", "U01.L01", "U01.L02"]);
    expect(updateLock([{ id: "U01.L09", kind: "lesson" }], { lesson: ["U01.L01"] }).errors.length).toBe(1);
  });
  test("step, exercise and example IDs are ledgered once their unit is released", () => {
    const { lock } = updateLock([], {
      // Every unit of the course is released since Wave 7 (the tracks); "K1" stands for a unit still being written,
      // whose IDs stay free until it is released.
      exercise: ["U01.L02/silence-beat-3", "K1.L01/draft-name", "J1.L01/draft-name", "A1.L02/released-side"],
      step: ["U02.L01/S5", "K1.L01/S1", "J1.L01/S1", "A1.L02/S1"],
    });
    expect(lock.map((e) => e.id)).toEqual([
      "A1.L02/released-side",
      "J1.L01/draft-name",
      "U01.L02/silence-beat-3",
      "A1.L02/S1",
      "J1.L01/S1",
      "U02.L01/S5",
    ]);
    const renamed = updateLock([{ id: "U01.L02/silence-beat-3", kind: "exercise" }], {
      exercise: ["U01.L02/beat-3"],
    });
    expect(renamed.errors.length).toBe(1);
  });
  test("the committed ledger knows every current ID", async () => {
    const r = await generate({ outDir: join(tmp, "c"), writeLock: false });
    const committed = JSON.parse(readFileSync(join(CONTENT_ROOT, "ids.lock.json"), "utf8")) as {
      ids: { id: string }[];
    };
    const known = new Set(committed.ids.map((e) => e.id));
    expect(r.lock.filter((e) => !known.has(e.id)).map((e) => e.id)).toEqual([]);
  });
});

describe("content:new", () => {
  for (const id of ["U01.L01", "U02.L03", "U03.L04", "J1.L03"] as const)
    test(`${id}: the scaffold loads, matches its folder and lints clean in its session`, async () => {
      const s = scaffold(id, scaffoldRoot);
      mkdirSync(s.dir, { recursive: true });
      writeFileSync(join(s.dir, "lesson.ts"), s.lessonTs);
      writeFileSync(join(s.dir, "lesson.mdx"), s.lessonMdx);
      const def = ((await import(join(s.dir, "lesson.ts"))) as { default: LessonDef }).default;
      expect(def.id).toBe(id);
      const loaded = {
        folderId: id,
        dir: s.dir,
        file: join(s.dir, "lesson.ts"),
        mdx: join(s.dir, "lesson.mdx"),
        sample: false,
        def,
        mdxSource: s.lessonMdx,
      };
      expect(checkSchema(loaded).issues).toEqual([]);
      expect(checkLint(loaded).issues).toEqual([]);
    });
});
