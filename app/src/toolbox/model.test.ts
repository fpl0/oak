// The Toolbox's pure model against the real unlock table (content/toolbox.ts) and the real lint.
import { describe, expect, test } from "bun:test";
import { lintOak } from "@oak/grader";
import { evalHeadless } from "@oak/grader/testing";
import { toolbox } from "../../../content/toolbox.ts";
import {
  courseSort,
  demoBars,
  demoKey,
  demoMeter,
  groupTools,
  KIND_ORDER,
  lessonOfRef,
  sitesOf,
  siteText,
  siteTitle,
  tryTitle,
  unlockArpeggio,
  unlockText,
  usageFrom,
  usedInGroups,
  usedOf,
} from "./model.ts";

const titles = new Map([
  ["U01.L01", "Heartbeat"],
  ["U01.L02", "Rests"],
  ["U03.L03", "Scales"],
  ["C1", "First Loop"],
]);
const unlocked = new Set(toolbox.filter((t) => t.unlock.at === "U01.L01").map((t) => t.id as string));

describe("grouping", () => {
  test("every entry of the unlock table appears once, grouped by kind in page order", () => {
    const sections = groupTools(toolbox, unlocked);
    expect(sections.map((s) => s.kind)).toEqual(KIND_ORDER.filter((k) => toolbox.some((t) => t.kind === k)));
    const ids = sections.flatMap((s) => s.tools.map((t) => t.id));
    expect(ids).toHaveLength(toolbox.length);
    expect(new Set(ids).size).toBe(toolbox.length);
  });

  test("unlocked tools come first in their section and are counted", () => {
    const code = groupTools(toolbox, unlocked).find((s) => s.kind === "tool");
    expect(code?.unlocked).toBe(toolbox.filter((t) => t.kind === "tool" && unlocked.has(t.id)).length);
    const firstLocked = code?.tools.findIndex((t) => !unlocked.has(t.id)) ?? -1;
    expect(code?.tools.slice(firstLocked).every((t) => !unlocked.has(t.id))).toBe(true);
  });

  test("filters: one kind, unlocked only, and a search over code, concept and meaning", () => {
    expect(groupTools(toolbox, unlocked, { kind: "sound" }).map((s) => s.kind)).toEqual(["sound"]);
    const only = groupTools(toolbox, unlocked, { showLocked: false }).flatMap((s) => s.tools);
    expect(only.every((t) => unlocked.has(t.id))).toBe(true);
    const gain = groupTools(toolbox, unlocked, { query: "gain" }).flatMap((s) => s.tools.map((t) => t.id));
    expect(gain).toContain("tb.gain");
  });
});

describe("unlock conditions", () => {
  test("a lesson row, a START row with its fallback, the voicing gate", () => {
    const gain = toolbox.find((t) => t.id === "tb.gain");
    expect(unlockText(gain as never, titles)).toBe("Unlocks when you complete “Rests”.");
    const ebass = toolbox.find((t) => t.id === "snd.ebass");
    expect(unlockText(ebass as never, titles)).toBe(
      "Unlocks when you start “First Loop”, or when you complete “Scales” if that comes first.",
    );
    const voicing = toolbox.find((t) => t.id === "tb.voicing");
    expect(unlockText(voicing as never, titles)).toContain("scores 90% or more without the answer revealed");
    // The gate's exercise is named by its lesson's title, never by its internal ref.
    const gated = toolbox.find((t) => t.unlock.condition);
    const withTitle = new Map([
      ...titles,
      ["U05.L07", "Voice Leading by Hand"],
      ["U05.L08", "Let Strudel Voice It"],
    ]);
    const text = unlockText(gated as never, withTitle);
    expect(text).toContain("the hand-voiced cadence check in Voice Leading by Hand scores 90%");
    expect(text).not.toContain("/");
    expect(text).toContain("Unlocks when you complete “Let Strudel Voice It”, once");
    // No lesson is named by its course id.
    expect(text).not.toMatch(/U\d{2}\.L\d{2}/);
    const lpf = toolbox.find((t) => t.id === "tb.lpf");
    expect(sitesOf(lpf as never)).toEqual(["C1.S1", "A1.L02"]);
  });
});

describe("lesson names", () => {
  test("a capstone session reads as its title alone; a lesson keeps its id before the title", () => {
    const t = new Map([...titles, ["C2", "C2 Four-Chord Song"]]);
    expect(siteText("C2.S2", t)).toBe("C2 Four-Chord Song");
    expect(siteText("U01.L02", t)).toBe("U01.L02 · Rests");
    expect(siteTitle("U01.L02", t)).toBe("Rests");
    expect(siteTitle("X9.L01", t)).toBe("X9.L01");
  });
  test("course order: the core first, then the side tracks, each in syllabus order", () => {
    const t = new Map([
      ["U00.L01", "Hello"],
      ["U01.L01", "Heartbeat"],
      ["C1", "First Loop"],
      ["J1.L01", "Swing"],
      ["A2.L01", "Registers"],
      ["R3.L01", "Clave"],
    ]);
    // The core's own order puts a capstone session where it is taken.
    expect(courseSort(["U01.L01", "C1.S1", "U00.L01"], t, ["U00.L01", "C1.S1", "U01.L01"])).toEqual([
      "U00.L01",
      "C1.S1",
      "U01.L01",
    ]);
    expect(courseSort(["R3.L01", "A2.L01", "U01.L01", "J1.L01", "U00.L01", "C1.S1"], t)).toEqual([
      "U00.L01",
      "U01.L01",
      "C1.S1",
      "J1.L01",
      "A2.L01",
      "R3.L01",
    ]);
  });
});

describe("usage from authored examples", () => {
  test("refs map to their lesson", () => {
    expect(lessonOfRef("U01.L01@groove")).toBe("U01.L01");
    expect(lessonOfRef("U02.L01/high-low#item:0")).toBe("U02.L01");
    expect(lessonOfRef("U01.CP/item-3")).toBe("U01.CP");
    expect(lessonOfRef("nonsense")).toBeNull();
  });

  test("the lint's `used` credits each lesson once, in course order", () => {
    const ctx = {
      profile: "studio",
      unlocked: new Set(),
      allowPreview: true,
      meter: "4/4",
      key: null,
    } as never;
    const rows = [
      { ref: "U02.L01@a", code: 'setcpm(84/4)\n\nmel: note("c4 e4").s("piano")' },
      { ref: "U01.L01@b", code: 'setcpm(96/4)\n\ndrums: s("bd hh sd hh")' },
      { ref: "U01.L01/x#item:0", code: 'setcpm(96/4)\n\ndrums: s("bd*2 hh")' },
    ].map((r) => ({ ref: r.ref, used: usedOf(lintOak(r.code, ctx, toolbox)) }));
    const usage = usageFrom(rows);
    expect(usage.get("tb.setcpm")).toEqual(["U01.L01", "U02.L01"]);
    expect(usage.get("tb.note")).toEqual(["U02.L01"]);
    expect(usage.get("snd.drum.bd")).toEqual(["U01.L01"]);
  });
});

describe("demos", () => {
  test("meter and key are read from the demo's own code", () => {
    expect(demoMeter('setcpm(108/3)\n\ndrums: s("bd hh hh")')).toBe("3/4");
    expect(demoMeter('setcpm(96/4)\n\ndrums: s("bd")')).toBe("4/4");
    expect(demoKey('n("0 2 4").scale("D4:major")')).toEqual({ tonic: "D", mode: "major" });
    expect(demoKey('n("0 2").scale("A3:harmonic:minor")')).toEqual({ tonic: "A", mode: "harmonic minor" });
    expect(demoKey('s("bd")')).toBeNull();
    expect(tryTitle({ code: ".gain(x)" })).toBe("Trying .gain(x)");
  });

  test("the demos of the U01–U02 tools play in headless Strudel", async () => {
    const early = toolbox.filter(
      (t) => /^U0[0-2]\./.test(String(t.unlock.at)) && t.catalog.demo.trim() !== "",
    );
    expect(early.length).toBeGreaterThan(20);
    for (const t of early) {
      const { events } = await evalHeadless(t.catalog.demo, 2);
      expect(events.length).toBeGreaterThan(0);
    }
  });

  test("the unlock arpeggio is I–IV–V–I in C (C E G, F A C, G B D, C)", () => {
    const notes = unlockArpeggio().map((n) => n.midi);
    expect(notes).toEqual([60, 64, 67, 65, 69, 72, 67, 71, 74, 72]);
    const at = unlockArpeggio().map((n) => n.at);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(at.at(-1)).toBeLessThan(1);
  });
});

describe("demoBars", () => {
  test("the longest alternation, between 2 and 8 bars", () => {
    expect(demoBars('chords: n("<[0,2,4] [5,7,9] [3,5,7] [4,6,8]>").scale("C3:major")')).toBe(4);
    expect(demoBars('chords: chord("<C Am F G>").voicing()')).toBe(4);
    expect(demoBars('x: n("<0!3 1>")')).toBe(4);
    expect(demoBars('mel: n("0 2 4")')).toBe(2);
    expect(demoBars('mel: n("<0 1 2 3 4 5 6 7 8 9>")')).toBe(8);
  });
});

describe("also used in", () => {
  test("the five most recent done lessons, the earlier ones behind a count; the next three, the rest behind a count", () => {
    const lessons = Array.from({ length: 40 }, (_, i) => `U${String(i + 1).padStart(2, "0")}.L01`);
    const done = new Set(lessons.slice(0, 35));
    const g = usedInGroups(lessons, done);
    expect(g.recent).toEqual(lessons.slice(30, 35));
    expect(g.earlier).toHaveLength(30);
    expect(g.earlier[0]).toBe("U01.L01");
    expect(g.next).toEqual(lessons.slice(35, 38));
    expect(g.later).toEqual(lessons.slice(38));
    // Few done: all shown, nothing behind "earlier".
    const few = usedInGroups(lessons.slice(0, 4), new Set(lessons.slice(0, 2)));
    expect(few).toEqual({ earlier: [], recent: lessons.slice(0, 2), next: lessons.slice(2, 4), later: [] });
  });
});
