// The Studio's UI review fixes: Band names before Roman numerals are taught, the Bands a learner has met, and
// whether a side track is started (a track lens's hint waits for it).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { bands } from "../../../content/bands/index.ts";
import { syllabus, trackOrder } from "../../../content/syllabus.ts";
import { BAND_FIRST_LESSON, bandLabel, bandsMet, trackStarted } from "./model.ts";

describe("Band names", () => {
  test("before Roman numerals: the numerals in brackets are dropped, the rest kept", () => {
    expect(bandLabel("Two-chord vamp (I–IV)", false)).toBe("Two-chord vamp");
    expect(bandLabel("Phrygian vamp (i–♭II)", false)).toBe("Phrygian vamp");
    expect(bandLabel("Waltz vamp (I–IV, 3/4)", false)).toBe("Waltz vamp (3/4)");
    expect(bandLabel("Doo-wop (I–vi–IV–V, in threes)", false)).toBe("Doo-wop (in threes)");
    expect(bandLabel("Lydian vamp (I–II over home)", false)).toBe("Lydian vamp");
    expect(bandLabel("12-bar shuffle (standard)", false)).toBe("12-bar shuffle (standard)");
    expect(bandLabel("Rhythm changes (32 bars, A A B A, walking bass)", false)).toBe(
      "Rhythm changes (32 bars, A A B A, walking bass)",
    );
  });
  test("after Roman numerals: the name as written", () => {
    expect(bandLabel("Two-chord vamp (I–IV)", true)).toBe("Two-chord vamp (I–IV)");
  });
  test("no Band's bracket keeps a numeral before they are taught", () => {
    for (const b of bands)
      expect(bandLabel(b.title, false), b.id).not.toMatch(/\((?:[^)]*[–\s(])?[♭]?(?:I|V|i|v)+–/);
  });
});

describe("Bands met", () => {
  test("a Band counts once its first lesson is reached", () => {
    expect([...bandsMet((id) => id === "U01.L01")]).toEqual(["band.two-chord-vamp"]);
    expect(bandsMet(() => false).size).toBe(0);
  });
  test("each Band's first lesson is the first lesson, in course order, whose source plays it", () => {
    const root = new URL("../../../content/", import.meta.url).pathname;
    const files = [
      ...new Bun.Glob("core/U*/L*/lesson.ts").scanSync(root),
      ...new Bun.Glob("advanced/*/L*/lesson.ts").scanSync(root),
    ];
    const order = [...syllabus.defaultOrder, ...Object.values(trackOrder).flat()] as string[];
    const first = new Map<string, string>();
    for (const f of files) {
      const m = /^(?:core|advanced)\/([A-Z0-9]+)\/(L\d+)\//.exec(f);
      if (!m) continue;
      const lesson = `${m[1]}.${m[2]}`;
      const text = readFileSync(`${root}${f}`, "utf8");
      for (const b of bands) {
        if (!text.includes(`"${b.id}"`)) continue;
        const was = first.get(b.id);
        if (!was || order.indexOf(lesson) < order.indexOf(was)) first.set(b.id, lesson);
      }
    }
    expect(BAND_FIRST_LESSON).toEqual(Object.fromEntries(first));
  });
});

describe("side tracks started", () => {
  const progress = {
    lessons: [
      { lessonId: "J1.L01", status: "completed" },
      { lessonId: "R1.L01", status: "not_started" },
      { lessonId: "U05.L01", status: "in_progress" },
    ],
  };
  test("a lesson of the track in progress or done starts it", () => {
    const started = trackStarted(progress);
    expect(started("J2.L04")).toBe(true);
    expect(started("R3.L02")).toBe(false);
    expect(started("A2.L01")).toBe(false);
    expect(trackStarted(null)("J2.L04")).toBe(false);
  });
});
