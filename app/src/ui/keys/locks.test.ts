import { describe, expect, test } from "bun:test";
import type { SyllabusDef, ToolEntry } from "@oak/content-kit";
import { syllabus } from "../../../../content/syllabus.ts";
import { toolbox } from "../../../../content/toolbox.ts";
import { TRACK_LENS_GATES } from "../../lib/lenses.ts";
import { WORKBENCH_LENS_SHORTCUTS } from "../../workbench/shortcuts.ts";
import { TRACK_LENS_OF_KEY } from "../shell/track-lenses.ts";
import { opensWith, rowLock, WORKBENCH_KEY_ANY_UNLOCKS, WORKBENCH_KEY_UNLOCKS } from "./locks.ts";

const S = syllabus as unknown as SyllabusDef;
const T = toolbox as unknown as ToolEntry[];
const ids = new Set(T.map((t) => t.id as string));

describe("locked rows in the shortcut sheet", () => {
  test("every Workbench lens and panel key that needs a tool names a real toolbox row", () => {
    for (const [keys] of WORKBENCH_LENS_SHORTCUTS) {
      const need = WORKBENCH_KEY_UNLOCKS[keys];
      if (need) expect({ keys, known: ids.has(need) }).toEqual({ keys, known: true });
    }
    // The Wave 5 keys are all covered.
    for (const k of ["Shift+O", "Shift+E", "Shift+B", "Shift+U", "Shift+W", "Shift+Y", "Shift+P"])
      expect(WORKBENCH_KEY_UNLOCKS[k]).toBeDefined();
  });

  test("Wave 6: the music-lens keys are listed by the Workbench and each names real toolbox rows", () => {
    const listed = new Set(WORKBENCH_LENS_SHORTCUTS.map(([k]) => k));
    for (const [keys, needs] of Object.entries(WORKBENCH_KEY_ANY_UNLOCKS)) {
      expect({ keys, listed: listed.has(keys) }).toEqual({ keys, listed: true });
      expect(needs.length).toBeGreaterThan(0);
      for (const n of needs) expect({ keys, n, known: ids.has(n) }).toEqual({ keys, n, known: true });
      // A key is in one table only.
      expect(WORKBENCH_KEY_UNLOCKS[keys]).toBeUndefined();
    }
    expect(Object.keys(WORKBENCH_KEY_ANY_UNLOCKS).sort()).toEqual(["Shift+I", "Shift+J", "Shift+V"]);
  });

  test("Wave 6: a music lens opens with any one of its tools, and a locked one names the first", () => {
    const none = new Set<string>();
    expect(rowLock("workbench", "Shift+I", none, true, T, S)).toEqual({
      locked: true,
      note: "Opens with unit 12, Seventh Chords.",
    });
    expect(rowLock("workbench", "Shift+I", new Set(["chord.seventh"]), true, T, S)).toBeNull();
    // The beat grid: compound meter (U13.L04) or .ply() (U13.L05); either one opens it.
    expect(rowLock("workbench", "Shift+V", none, true, T, S)?.note).toBe("Opens with unit 13, Rhythm II.");
    expect(rowLock("workbench", "Shift+V", new Set(["tb.ply"]), true, T, S)).toBeNull();
    expect(rowLock("workbench", "Shift+V", new Set(["tb.meter.compound"]), true, T, S)).toBeNull();
    // The key ribbon's tool is the patterned .scale() of U03: locked only before it.
    expect(rowLock("workbench", "Shift+J", none, true, T, S)?.note).toMatch(/^Opens with unit 3, /);
    expect(rowLock("workbench", "Shift+J", new Set(["tb.scale.patterned"]), true, T, S)).toBeNull();
    expect(rowLock("workbench", "Shift+J", none, false, T, S)).toBeNull();
  });

  test("where a row opens, in the course's words, never by an id alone", () => {
    expect(opensWith("tb.lens.form", T, S)).toBe("unit 9, Form");
    expect(opensWith("scale.blues", T, S)).toBe("unit 11, Pentatonic & Blues");
    expect(opensWith("tb.scope", T, S)).toMatch(/^the side lesson “.+”$/);
    expect(opensWith("tb.nothing", T, S)).toBeNull();
  });

  test("a locked key says when it opens; an unlocked one, another section or an unloaded list is not marked", () => {
    const none = new Set<string>();
    expect(rowLock("workbench", "Shift+O", none, true, T, S)).toEqual({
      locked: true,
      note: "Opens with unit 9, Form.",
    });
    expect(rowLock("workbench", "Shift+O", new Set(["tb.lens.form"]), true, T, S)).toBeNull();
    expect(rowLock("workbench", "Shift+O", none, false, T, S)).toBeNull();
    expect(rowLock("editor", "Mod+Enter", none, true, T, S)).toBeNull();
    expect(rowLock("workbench", "L", none, true, T, S)).toBeNull();
    expect(rowLock("workbench", "Shift+W", none, true, T, S)?.note).toMatch(
      /^Opens with the side lesson “.+”\.$/,
    );
  });

  test("Wave 7: a track lens key opens with its tool or its lesson; nothing is marked before the progress loads", () => {
    const none = new Set<string>();
    // Every track lens key the Workbench lists has a gate, and the gates' tools are real toolbox rows.
    const listed = new Set(WORKBENCH_LENS_SHORTCUTS.map(([k]) => k));
    for (const [keys, lens] of Object.entries(TRACK_LENS_OF_KEY)) {
      expect({ keys, listed: listed.has(keys) }).toEqual({ keys, listed: true });
      for (const t of TRACK_LENS_GATES[lens].tools)
        expect({ t, known: ids.has(t) }).toEqual({ t, known: true });
    }
    expect(rowLock("workbench", "Shift+X", none, true, T, S, null)).toBeNull();
    expect(rowLock("workbench", "Shift+X", none, true, T, S, new Set())).toEqual({
      locked: true,
      note: "Opens with the lesson “Extensions”.",
    });
    expect(rowLock("workbench", "Shift+D", none, true, T, S, new Set())?.note).toMatch(
      /^Opens with the lesson “.+”\.$/,
    );
    // The lesson opens it; so does the tool, wherever it unlocks.
    expect(rowLock("workbench", "Shift+X", none, true, T, S, new Set(["J2.L03"]))).toBeNull();
    expect(rowLock("workbench", "Shift+X", new Set(["chord.ext"]), true, T, S, new Set())).toBeNull();
    expect(rowLock("workbench", "Shift+Q", new Set(["scale.altered"]), true, T, S, new Set())).toBeNull();
    // Density has no tool: only its lesson opens it.
    expect(
      rowLock("workbench", "Shift+D", new Set(T.map((t) => t.id as string)), true, T, S, new Set())?.locked,
    ).toBe(true);
  });
});
