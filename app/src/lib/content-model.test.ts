import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { registries } from "@content/index.ts";
import type { NamedToolEntry } from "@oak/grader";
import {
  buildBundle,
  layoutSkillGraph,
  lessonTitles,
  normalizeLessons,
  normalizeSkillGraph,
  REGION_ORDER,
  skillGraphFromDefs,
  titleOf,
  unlockSite,
} from "./content-model.ts";

const GENERATED = join(import.meta.dir, "../../../content/.generated");

describe("normalizeSkillGraph", () => {
  test("accepts { nodes, edges: [{from, to}] } and node prerequisites, dropping unknown and retired nodes", () => {
    const g = normalizeSkillGraph({
      nodes: [
        { id: "R01", name: "Pulse", region: "groove" },
        { id: "R02", name: "Tempo", region: "groove", prerequisites: ["R01", "ZZ9"] },
        { id: "P01", name: "Pitch", region: "nowhere" },
        { id: "E12", name: "Old", region: "ears-voice", retired: { supersededBy: [] } },
      ],
      edges: [{ from: "R01", to: "P01" }, ["R02", "R02"], { from: "E12", to: "R01" }],
    });
    expect(g.nodes.map((n) => n.id)).toEqual(["R01", "R02", "P01"]);
    expect(g.nodes[2]?.region).toBe("other");
    expect(g.edges.sort()).toEqual([
      ["R01", "P01"],
      ["R01", "R02"],
    ]);
  });

  test("accepts a bare array (the SkillDef registry)", () => {
    const g = skillGraphFromDefs(registries.skills);
    expect(g.nodes.length).toBeGreaterThan(100);
    for (const [a, b] of g.edges) {
      expect(g.nodes.some((n) => n.id === a)).toBe(true);
      expect(g.nodes.some((n) => n.id === b)).toBe(true);
    }
  });

  test.if(existsSync(join(GENERATED, "skill-graph.json")))("reads the generated skill-graph.json", () => {
    const raw = JSON.parse(readFileSync(join(GENERATED, "skill-graph.json"), "utf8"));
    const g = normalizeSkillGraph(raw);
    expect(g.nodes.length).toBe(raw.nodes.length);
    expect(g.edges.length).toBeGreaterThan(0);
  });
});

describe("layoutSkillGraph", () => {
  const layout = layoutSkillGraph(skillGraphFromDefs(registries.skills));
  const pos = new Map(layout.nodes.map((n) => [n.id, n]));

  test("every prerequisite sits strictly left of the skill that needs it", () => {
    for (const [a, b] of layout.edges) expect(pos.get(a)?.x ?? 0).toBeLessThan(pos.get(b)?.x ?? 0);
  });

  test("regions are stacked in map order and nodes never overlap", () => {
    const regions = layout.bands.map((b) => b.region);
    const order = regions.map((r) => REGION_ORDER.indexOf(r));
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    const seen = new Set<string>();
    for (const n of layout.nodes) {
      const key = `${n.x},${n.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  test("cycles do not hang the layout", () => {
    const l = layoutSkillGraph({
      nodes: [
        {
          id: "A",
          name: "A",
          region: "groove",
          category: "",
          kind: "",
          prerequisites: [],
          introducedBy: null,
        },
        {
          id: "B",
          name: "B",
          region: "groove",
          category: "",
          kind: "",
          prerequisites: [],
          introducedBy: null,
        },
      ],
      edges: [
        ["A", "B"],
        ["B", "A"],
      ],
    });
    expect(l.nodes).toHaveLength(2);
  });
});

describe("buildBundle", () => {
  test("falls back to the registries when nothing was generated", () => {
    const b = buildBundle({
      registries: { syllabus: registries.syllabus, skills: registries.skills, toolbox: registries.toolbox },
    });
    expect(b.source).toBe("registries");
    expect(b.version).toBeNull();
    expect(b.toolbox.length).toBe(registries.toolbox.length);
    expect(b.capstones.length).toBe(registries.syllabus.capstones.length);
    expect(b.lessons).toEqual([]);
  });

  test("names every tool's unlock sites, so a lock message says a title and never a bare lesson ID", async () => {
    const b = buildBundle({
      registries: { syllabus: registries.syllabus, skills: registries.skills, toolbox: registries.toolbox },
    });
    const { lintOak } = await import("@oak/grader");
    const named = (id: string) => b.toolbox.find((t) => t.id === id) as NamedToolEntry;
    expect(named("tb.n").unlockNames).toEqual([{ kind: "lesson", title: "Degrees in Code" }]);
    expect(named("tb.lpf").unlockNames?.map((n) => n.kind)).toEqual(["capstone", "lesson"]);
    expect(b.toolbox.every((t) => (t as NamedToolEntry).unlockNames !== undefined)).toBe(true);
    const r = lintOak(
      'setcpm(30)\nmel: n("0 2").scale("C4:major")',
      { profile: "graded", unlocked: new Set(), allowPreview: false, meter: "4/4", key: null },
      b.toolbox,
    );
    const n = r.diagnostics.find((d) => d.id === "code.locked-tool" && d.params.name === "n");
    expect(n?.message).toBe("`n` unlocks in the lesson “Degrees in Code”.");
    for (const d of r.diagnostics) expect(d.message).not.toMatch(/\b[A-Z]+\d*\.(L|S|CP)\d*\b/);
  });

  test("prefers generated files and reads contentVersion", () => {
    const b = buildBundle({
      index: { contentVersion: "abc" },
      toolbox: [],
      skillGraph: { nodes: [] },
      lessons: [],
    });
    expect(b.source).toBe("generated");
    expect(b.version).toBe("abc");
  });

  test("lesson outlines skip samples and malformed rows", () => {
    const l = normalizeLessons([
      { id: "U00.L00", sample: true, steps: [] },
      {
        id: "U01.L01",
        version: 2,
        steps: [{ id: "S1", kind: "listen", minutes: 1, graded: false }, { nope: 1 }],
      },
      "junk",
    ]);
    expect(l).toEqual([
      {
        id: "U01.L01",
        version: 2,
        steps: [{ id: "S1", kind: "listen", minutes: 1, graded: false, optional: false }],
      },
    ]);
  });

  test("lesson titles and unlock sites", () => {
    const titles = lessonTitles(registries.syllabus);
    expect(titles.get("U01.L01")).toBeTruthy();
    const voicing = registries.toolbox.find((t) => t.code.includes(".voicing("));
    // contracts §3.1 rule 6: .voicing() unlocks at U05.L08 behind the hand-voicing gate.
    if (voicing) expect(unlockSite(voicing)).toBe("U05.L08");
  });
});

describe("titles of map items", () => {
  test("a capstone session reads as its capstone", () => {
    const titles = new Map([
      ["C0", "C0 Intro"],
      ["U01.L01", "Heartbeat"],
    ]);
    expect(titleOf("U01.L01", titles)).toBe("Heartbeat");
    expect(titleOf("C0.S1", titles)).toBe("C0 Intro");
    expect(titleOf("C0.S2", titles)).toBe("C0 Intro · session 2");
    expect(titleOf("C9.S1", titles)).toBe("C9.S1");
  });

  test("a transcription capstone's session reads the same way (X1.S2, CF-T.S1)", () => {
    const titles = new Map([
      ["X1", "X1 Folk Transcription"],
      ["CF-T", "CF-T Transcribe a Song"],
    ]);
    expect(titleOf("X1.S1", titles)).toBe("X1 Folk Transcription");
    expect(titleOf("X1.S2", titles)).toBe("X1 Folk Transcription · session 2");
    expect(titleOf("CF-T.S1", titles)).toBe("CF-T Transcribe a Song");
    expect(titleOf("GYM.01", titles)).toBe("GYM.01");
  });
});
