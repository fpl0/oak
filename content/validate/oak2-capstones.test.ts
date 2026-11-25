// Oak 2.0 W4 F1 (docs/oak2/PLAN.md §2 fidelity rule 1, §6 F1; wave plan 2026-11-25-oak2-w4 Task 1): the book's
// arranging moves on the capstones. `ends-on-purpose` is required on CF-A only (taught in core U09.L06) and a
// suggestion on C6, C7, JC1–JC4, RC1, RC2; the seam, once-only and arc lines are suggestions on the capstones from C3
// on whose brief is written in sections. A suggestion carries no skill, so failing one never becomes mastery
// evidence, and it never blocks a pass. AC1 and AC2 keep their briefs.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { CapstoneDef, ComposeBriefEx, RubricRule } from "@oak/content-kit";
import * as grader from "@oak/grader";
import { capstoneById, capstones } from "../capstones.ts";
import { toolbox } from "../toolbox.ts";
import { unlockedFor } from "./harness.ts";

setDefaultTimeout(120_000);

const rules = (c: CapstoneDef): RubricRule[] => c.brief?.rubric ?? [];
const fnOf = (r: RubricRule): string | null => (r.rule === "custom" ? (r as { fn: string }).fn : null);
const withFn = (c: CapstoneDef, fn: string): RubricRule[] => rules(c).filter((r) => fnOf(r) === fn);
const BOOK_FNS = ["ends-on-purpose", "staggered-boundary", "unique-event", "arc"] as const;

describe("the book's moves on the capstones (F1)", () => {
  test("ends-on-purpose is required on CF-A only", () => {
    const optional = ["C6", "C7", "JC1", "JC2", "JC3", "JC4", "RC1", "RC2"];
    for (const c of capstones) {
      const got = withFn(c, "ends-on-purpose").map((r) => r.required);
      const want = c.id === "CF-A" ? [true] : optional.includes(c.id) ? [false] : [];
      expect([c.id, got]).toEqual([c.id, want]);
    }
  });

  test("the seam, once-only and arc suggestions sit on the sectioned capstones from C3 on", () => {
    for (const fn of ["staggered-boundary", "unique-event", "arc"]) {
      const on = capstones.filter((c) => withFn(c, fn).length > 0).map((c) => c.id);
      expect([fn, on]).toEqual([fn, ["C3", "C4", "C7", "CF-A", "JC3"]]);
      for (const c of capstones)
        for (const r of withFn(c, fn)) expect([c.id, fn, r.required]).toEqual([c.id, fn, false]);
    }
  });

  test("book suggestions never become evidence", () => {
    for (const c of capstones)
      for (const r of rules(c))
        if (!r.required && (BOOK_FNS as readonly string[]).includes(fnOf(r) ?? ""))
          expect([c.id, r.id, r.skills]).toEqual([c.id, r.id, []]);
  });

  test("versions", () => {
    const bumped = ["C3", "C4", "C6", "C7", "CF-A", "JC1", "JC2", "JC3", "JC4", "RC1", "RC2"];
    for (const c of capstones) {
      const want = bumped.includes(c.id) ? 2 : 1;
      expect([c.id, c.version]).toEqual([c.id, want]);
      if (c.brief) expect([c.id, c.brief.version]).toEqual([c.id, want]);
    }
  });

  test("AC1 and AC2 are unchanged", () => {
    // The values at the W4 base commit (71e1916), read from content/capstones.ts before W4 edited it.
    const shape = (id: string) => {
      const c = capstoneById.get(id as never) as CapstoneDef;
      return { version: c.version, rubric: rules(c).map((r) => [r.id, r.required]) };
    };
    expect(shape("AC1")).toEqual({
      version: 1,
      rubric: [
        ["melody", true],
        ["sound", true],
        ["differ", true],
        ["bars", true],
        ["tempo", true],
      ],
    });
    expect(shape("AC2")).toEqual({
      version: 1,
      rubric: [
        ["extensions", true],
        ["swing", true],
        ["voice-leading", true],
        ["rhodes", true],
        ["tempo", true],
        ["bars", true],
        ["tune", true],
        ["lean", false],
        ["tensions", false],
      ],
    });
  });
});

describe("an optional suggestion never blocks (real grader, capstone mode)", () => {
  beforeAll(async () => {
    await grader.initRealm({ toolbox: [...toolbox], lockdown: false });
  });

  test("C7's first passing brief piece passes, whatever its once-only line says", async () => {
    const c7 = capstoneById.get("C7") as CapstoneDef;
    const brief = c7.brief as ComposeBriefEx;
    const piece = brief.tests.find((t) => t.expect === "pass");
    expect(piece).toBeDefined();
    const r = await grader.gradeExercise({
      exercise: brief,
      response: { code: piece && "code" in piece.response ? piece.response.code : "" },
      ctx: {
        exerciseGlobalId: "C7/brief",
        mode: "capstone",
        key: { tonic: "C", mode: "major" },
        meter: "4/4",
        bpm: 100,
        params: {},
        attemptNo: 1,
        firstAttempt: true,
        rung: 0,
        tutorHints: 0,
        extraReplays: 0,
        lint: {
          profile: "graded",
          unlocked: unlockedFor("C7.S3"),
          allowPreview: false,
          meter: "4/4",
          key: null,
        },
      },
    });
    const once = (r.rubric ?? []).find((x) => x.ruleId === "once");
    expect(once).toBeDefined();
    expect(r.status).toBe("pass");
    if (once && !once.ok) expect(r.status).toBe("pass");
  });
});
