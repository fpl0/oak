// The clarity pass (2026-11-22): the "How" line, the tap pad's counting by what is taught, and where "back" goes.
import { describe, expect, test } from "bun:test";
import { loadLessons } from "../../../content/lib/load.bun.ts";
import { returnLabelOf } from "../lib/nav.ts";
import { howTo, padStepsFor } from "./how-to.ts";

const lessons = (await loadLessons()).lessons.map((l) => l.def).filter((d) => !d.id.startsWith("U99"));

describe("howTo", () => {
  test("every interactive exercise in the course gets a How line; tap says the count-in, the bars and the key", () => {
    let taps = 0;
    for (const l of lessons)
      for (const s of l.steps) {
        const ex = s.exercise;
        if (!ex || ex.kind === "listen" || ex.kind === "all" || ex.kind === "compose-brief") continue;
        const how = howTo(ex);
        expect(how, `${l.id} ${s.id} (${ex.kind})`).not.toBeNull();
        if (ex.kind === "tap") {
          taps++;
          expect(how).toContain("Start tapping");
          if (ex.mode === "along") expect(how).toContain(`${ex.bars} bar`);
          expect(how).toMatch(/Space|F\*\* for the first lane/);
        }
      }
    expect(taps).toBeGreaterThan(10);
  });
  test("a 1-bar count-in in 4/4 is four clicks", () => {
    const tap = lessons.find((l) => l.id === "U01.L02")?.steps.find((s) => s.id === "S2")?.exercise;
    expect(howTo(tap)).toContain("4 count-in clicks");
    expect(howTo(tap)).toContain("4 bars");
  });
});

describe("padStepsFor", () => {
  test("beats only before eighths, eighths before sixteenths, the pad's default after", () => {
    expect(padStepsFor("U01.L02", "4/4")).toBe(1);
    expect(padStepsFor("U01.L04", "4/4")).toBe(2);
    expect(padStepsFor("U01.L05", "4/4")).toBe(2);
    expect(padStepsFor("U01.L06", "4/4")).toBeNull();
    expect(padStepsFor("U13.L04", "6/8")).toBeNull();
    expect(padStepsFor("R1.L01", "4/4")).toBeNull();
  });
});

describe("returnLabelOf", () => {
  test("names the page back returns to", () => {
    expect(returnLabelOf("/")).toBe("Today");
    expect(returnLabelOf("/toolbox/stack")).toBe("Toolbox");
    expect(returnLabelOf("/oak")).toBe("The Oak");
    expect(returnLabelOf("/somewhere")).toBe("Today");
  });
});
