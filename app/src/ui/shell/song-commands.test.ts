import { describe, expect, test } from "bun:test";
import { reachedUnits, songEntries } from "./song-commands.ts";

describe("the palette's unit songs", () => {
  const defs = [
    { unit: "U04", title: "Side by side" },
    { unit: "U05", title: "Climb the chord" },
    { unit: "U11", title: "Far ahead" },
  ];
  const titles: Record<string, string> = { U04: "Two voices", U05: "Triads" };
  const unitTitle = (id: string) => titles[id];

  test("units reached: a lesson started or done, and the next session's unit", () => {
    const reached = reachedUnits(
      [
        { lessonId: "U04.L03", status: "completed" },
        { lessonId: "U11.L01", status: "locked" },
        { lessonId: "C0.S1", status: "completed" },
      ],
      "U05.L01",
    );
    expect([...reached].sort()).toEqual(["U04", "U05"]);
  });

  test("started songs by the learner's title, reached ones by their own, never a unit still ahead", () => {
    const out = songEntries(
      defs,
      [{ unitId: "U04", title: "My duet", status: "released" }],
      new Set(["U04", "U05"]),
      unitTitle,
    );
    expect(out.map((s) => [s.unitId, s.title, s.hint])).toEqual([
      ["U04", "My duet", "On the album · Two voices"],
      ["U05", "Climb the chord", "Not started · Triads"],
    ]);
    // Renamed, it is still found by the name Oak gave it.
    expect(out[0]?.keywords).toContain("Side by side");
  });
});
