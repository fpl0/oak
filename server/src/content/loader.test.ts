// The loader over the REAL content/ (sources plus content/.generated/): every registry once, the authored
// lessons (the sample, the exemplars and whatever the authors have written), checkpoints and capstones with
// briefs, the default order with its gym slots, and agreement with the generated course index.
import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_DIR } from "../testing/course.ts";
import { ContentIndex } from "./index.ts";
import { loadContent } from "./loader.ts";
import type { ContentSource } from "./types.ts";

let content: ContentSource;
let index: ContentIndex;
beforeAll(async () => {
  content = await loadContent({ contentDir: CONTENT_DIR });
  index = new ContentIndex(content);
});

const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);
const unique = (xs: readonly string[]) => new Set(xs).size === xs.length;

describe("the real content", () => {
  test("loads without problems other than lessons still being written", () => {
    expect(content.problems.filter((p) => p.message !== "lesson not authored yet")).toEqual([]);
    expect(content.contentVersion).toMatch(/^[0-9a-f]{64}$/);
    expect(content.tutorPrefix.syllabus.length).toBeGreaterThan(1000);
    expect(content.tutorPrefix.catalog.length).toBeGreaterThan(1000);
  });

  test("every registry row once (a module exporting its table twice used to double unlocks and can-dos)", () => {
    for (const [name, rows] of Object.entries({
      toolbox: content.toolbox,
      skills: content.skills,
      families: content.families,
      decks: content.decks,
      terms: content.terms,
      canDos: content.canDos,
      lessons: content.lessons,
      checkpoints: content.checkpoints,
      capstones: content.capstones,
    }))
      expect({ name, unique: unique(ids(rows as readonly { id: string }[])) }).toEqual({
        name,
        unique: true,
      });
    expect(content.skills).toHaveLength(143);
  });

  test("the sample, the exemplars and every authored U00–U02 lesson are served", () => {
    const authored = new Set(ids(content.lessons));
    for (const id of ["U00.L00", "U01.L01", "U02.L01"]) expect(authored.has(id)).toBe(true);
    // Each authored syllabus lesson is in the index with its exercises.
    for (const l of content.lessons) {
      if (l.id === "U00.L00") continue;
      expect(index.lessonSite(l.id)).not.toBeNull();
      for (const st of l.steps)
        if (st.exercise !== undefined)
          expect(index.exercise(`${l.id}/${st.exercise.id}`)?.stepId).toBe(st.id);
    }
  });

  test("capstone definitions with briefs and rubrics come from content/capstones.ts (C0 and C1 are gradeable)", () => {
    for (const id of ["C0", "C1"]) {
      const def = index.capstoneDef(id);
      expect(def?.brief?.kind).toBe("compose-brief");
      expect(((def?.brief ?? {}) as { rubric?: unknown[] }).rubric?.length).toBeGreaterThan(0);
      expect(index.exercise(`${id}/${def?.brief?.id}`)?.ownerKind).toBe("capstone");
    }
    expect(index.capstoneMeta("C0")?.opensAfter).toEqual({ checkpoints: ["U01.CP"] });
  });

  test("the default order of contracts §2.5 with its gym slots, as the generated course index has it", () => {
    const order = index.defaultOrder();
    expect(order.slice(0, 14)).toEqual([
      "U00.L01",
      "U00.L02",
      "U01.L01",
      "U01.L02",
      "U01.L03",
      "U01.L04",
      "U01.L05",
      "U01.L06",
      "U01.L07",
      "U01.L08",
      "U01.L09",
      "U02.L01",
      "U01.CP",
      "C0.S1",
    ]);
    expect(order.indexOf("U02.CP")).toBe(order.indexOf("U03.L01") + 1);
    expect(order[order.indexOf("U02.CP") + 1]).toBe("C1.S1");
    // GYM.01–GYM.18 in the core; the first at session 68, after U07.L11 (contracts 2.2, decision 103: Oak 2.0 W2's
    // U06.L13 and U07.L11 moved it from session 67 after U07.L03, which was 66 until contracts 1.6 added U05.L09).
    const gyms = order.filter((id) => id.startsWith("GYM."));
    expect(gyms).toEqual(Array.from({ length: 18 }, (_, i) => `GYM.${String(i + 1).padStart(2, "0")}`));
    expect(order.indexOf("GYM.01")).toBe(67);
    expect(order[66]).toBe("U07.L11");
    const generated = join(CONTENT_DIR, ".generated", "course-index.json");
    if (existsSync(generated)) {
      const sessions = (
        JSON.parse(readFileSync(generated, "utf8")) as { sessions: { id: string; defaultOrder?: number }[] }
      ).sessions
        .filter((s) => typeof s.defaultOrder === "number")
        .sort((a, b) => (a.defaultOrder as number) - (b.defaultOrder as number))
        .map((s) => s.id);
      expect(sessions.slice(0, order.length)).toEqual([...order].slice(0, sessions.length));
    }
  });

  test("checkpoint ranges and the most recent checkpoint before a unit (§7.6 rule 2)", () => {
    expect(index.lessonsCovered("U01.CP")).toHaveLength(9);
    expect(index.checkpointBefore("U02")).toBe("U01.CP");
    expect(index.checkpointBefore("U03")).toBe("U02.CP");
    expect(index.checkpointBefore("U01")).toBeNull();
  });
});
