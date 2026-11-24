// The unlock table and the function catalog (contracts §3, architecture §3.7 items 3, 6, 10): every row
// is well-formed, every demo and catalog example evaluates headlessly, is not silent, and uses only tools
// usable at its own unlock site(s) in every legal order; the special rows (voicing gate, START rows with
// a fallback, alternative sites) are exactly as §3.2 says.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { MeterId, SessionId, ToolEntry } from "@oak/content-kit";
import { catalog, fnsOfTool } from "../catalog/index.ts";
import { courseGraph } from "../index.ts";
import { usableAt } from "../lib/course.ts";
import { matchIndex } from "../lib/scan.ts";
import { SILENT_CONTROLS, toolbox, toolboxById, unlockSites } from "../toolbox.ts";
import { BAD_LOG, evaluate, lint } from "./harness.ts";

setDefaultTimeout(60_000);
const g = courseGraph();
const sitesOf = (t: ToolEntry) => (Array.isArray(t.unlock.at) ? t.unlock.at : [t.unlock.at]);
const METER_OF: Record<string, MeterId> = {
  "2": "2/4",
  "3": "3/4",
  "4": "4/4",
  "5": "5/4",
  "7": "7/8",
  "9": "9/8i",
};
const meterAt = (code: string): MeterId => METER_OF[/setcpm\([^)]*\/(\d+)\)/.exec(code)?.[1] ?? "4"] ?? "4/4";

describe("rows", () => {
  test("234 rows (contracts §3.2's 212, tb.feature.chord-symbols (c14) and sound pack v4's 21); every site is a real session", () => {
    expect(toolbox.length).toBe(234);
    for (const t of toolbox)
      for (const s of unlockSites(t)) expect([t.id, g.nodes.has(s)]).toEqual([t.id, true]);
  });
  test("the voicing gate rows (rule 6)", () => {
    const gated = toolbox
      .filter((t) => t.unlock.condition)
      .map((t) => t.id)
      .sort();
    expect(gated).toEqual([
      "chord.triad",
      "snd.organ",
      "snd.rhodes",
      "tb.anchor",
      "tb.chord",
      "tb.dict.triads",
      "tb.mode.below",
      "tb.voicing",
    ]);
    for (const id of gated) {
      const t = toolboxById.get(id) as ToolEntry;
      expect(t.unlock.at).toBe("U05.L08");
      expect(t.unlock.condition).toEqual({
        exercise: "U05.L07/hand-voiced-cadence",
        minScore: 0.9,
        unrevealed: true,
        variants: ["U05.L08/hand-voiced-cadence-again"],
      });
    }
  });
  test("START rows and the C1 fallback (rule 12)", () => {
    const start = toolbox
      .filter((t) => t.unlock.when === "start")
      .map((t) => t.id)
      .sort();
    expect(start).toEqual(["snd.choir", "snd.ebass", "tb.feature.album", "tb.lpf"]);
    for (const id of ["snd.ebass", "tb.lpf"]) {
      const t = toolboxById.get(id) as ToolEntry;
      expect(t.unlock.fallbackAt).toBe("U03.L03");
      expect(usableAt(g, t, "U03.L03")).toBe(false);
      expect(usableAt(g, t, "U03.L04")).toBe(true);
      expect(usableAt(g, t, "C1.S1")).toBe(true);
    }
  });
  test("alternative sites (rule 11)", () => {
    const alt = Object.fromEntries(
      toolbox.filter((t) => Array.isArray(t.unlock.at)).map((t) => [t.id, t.unlock.at]),
    );
    expect(alt).toEqual({
      "snd.horns": ["U15.L05", "RC1.S2"],
      "tb.lpf": ["C1.S1", "A1.L02"],
      "tb.delay": ["U10.L09", "A1.L04"],
      "tb.distort": ["U11.L03", "A1.L05"],
      "tb.pan": ["U14.L06", "A2.L05"],
    });
    const horns = toolboxById.get("snd.horns") as ToolEntry;
    expect(usableAt(g, horns, "RC1.S2")).toBe(true);
    expect(usableAt(g, horns, "RC1.S1")).toBe(false);
    expect(usableAt(g, toolboxById.get("tb.delay") as ToolEntry, "A1.L04")).toBe(true);
    expect(usableAt(g, toolboxById.get("tb.delay") as ToolEntry, "A1.L03")).toBe(false);
  });
  test("known-silent controls never unlock; nudge never unlocks (rules 7, 8)", () => {
    const names = new Set([...matchIndex(toolbox).keys()]);
    for (const c of SILENT_CONTROLS) expect(names.has(c)).toBe(false);
    expect(names.has("nudge")).toBe(false);
  });
  test("every group-H row says how the S3 harness proves it audible", () => {
    for (const t of toolbox.filter((x) => x.group === "H"))
      expect([t.id, Boolean(t.audibility)]).toEqual([t.id, true]);
  });
  test("each lint match maps to one row", () => {
    const dup = [...matchIndex(toolbox)].filter(([, ids]) => ids.length > 1);
    expect(dup).toEqual([]);
  });
});

describe("catalog (architecture §3.4)", () => {
  test("every tb.* tool row has a catalog entry, and every catalog entry names a real row", () => {
    const fnTools = toolbox
      .filter(
        (t) =>
          t.kind === "tool" ||
          (t.kind === "template" &&
            !t.id.includes("four-chord") &&
            !/template\.(12-bar|dorian|jazz)/.test(t.id)),
      )
      .map((t) => t.id);
    expect(fnTools.filter((id) => fnsOfTool(id).length === 0)).toEqual([]);
    expect(catalog.filter((f) => !toolboxById.has(f.tool)).map((f) => f.name)).toEqual([]);
  });
  test("catalog names are unique", () => {
    const names = catalog.map((f) => f.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });
  test("every identifier a catalog entry teaches is mapped by the toolbox", () => {
    const index = matchIndex(toolbox);
    const bad = catalog
      .flatMap((f) =>
        [f.name, ...(f.aliases ?? [])].filter((n) => /^[A-Za-z]\w*$/.test(n)).map((n) => [f, n] as const),
      )
      .filter(([f, n]) => f.kind !== "syntax" && f.kind !== "argument" && !index.has(`fn:${n}`))
      .map(([f, n]) => `${f.tool}:${n}`);
    expect(bad).toEqual([]);
  });
});

/** The one row whose demo must show a dialect error: muting a line in code (contracts §3.2 B). */
const EXPECTED: Record<string, string[]> = { "tb.label.mute": ["code.muted-label"] };

async function checkSample(where: string, code: string, sites: SessionId[], bars = 2, tool = "") {
  const r = await evaluate(code, bars);
  expect([where, r.ok, r.error ?? ""]).toEqual([where, true, ""]);
  expect([where, r.events.length > 0]).toEqual([where, true]);
  expect([where, r.cpsSet]).toEqual([where, true]);
  expect([where, r.logs.filter((l) => BAD_LOG.test(l))]).toEqual([where, []]);
  for (const s of sites) {
    // The U00.L01 onboarding loop is a preview context (contracts §3.1 rule 5a).
    const res = lint(code, { session: s, meter: meterAt(code), allowPreview: s === "U00.L01" });
    expect([
      where,
      s,
      res.diagnostics
        .filter((d) => d.severity === "error" && !(EXPECTED[tool] ?? []).includes(d.id))
        .map((d) => `${d.id} ${d.message}`),
    ]).toEqual([where, s, []]);
  }
}

describe("demos and examples evaluate and use only what is unlocked at their site", () => {
  for (const t of toolbox.filter((x) => x.catalog.demo !== ""))
    test(`demo ${t.id}`, async () => checkSample(`demo ${t.id}`, t.catalog.demo, sitesOf(t), 2, t.id));
  for (const f of catalog) {
    const t = toolboxById.get(f.tool);
    if (t)
      test(`catalog ${f.name}`, async () =>
        checkSample(`catalog ${f.name}`, f.example, sitesOf(t), 2, f.tool));
  }
});
