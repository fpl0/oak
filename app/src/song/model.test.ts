// The song view model (spec 2026-11-24 §4.3, §5.5): names gated by terms, who owns each cell, today's cells while a
// Make is open, and the band the composer plays.
import { describe, expect, test } from "bun:test";
import type { TakeStep } from "@oak/api";
import { oakRestsOf, partNameOf, sectionLabels, songBandOf, songBpmOf, songViewOf } from "./model.ts";
import { TEST_SONG, testDetail, testTake } from "./test-song.ts";

const KICK_SNARE = 'setcpm(96/4)\n\ndrums: s("bd sd bd sd")';
const L01 = testTake(1, "U01.L01", KICK_SNARE, ["kick@verse", "snare@verse"], { bpm: 96 });
const L02_STEP = TEST_SONG.plan[1] as TakeStep;

describe("songViewOf", () => {
  test("letters until the verse term is introduced, names after", () => {
    const before = songViewOf(TEST_SONG, testDetail([L01]), new Set());
    expect(before.sections.map((s) => s.label)).toEqual(["A", "B", "C", "D", "D"]);
    expect(before.sections.map((s) => s.letter)).toEqual(["A", "B", "C", "D", "D"]);
    expect(before.parts.find((p) => p.id === "lead")?.name).toBe("Tune");

    const verse = songViewOf(TEST_SONG, testDetail([L01]), new Set(["term.verse", "term.chorus"]));
    expect(verse.sections.map((s) => s.label)).toEqual(["A", "Verse", "C", "Chorus", "Chorus"]);
    // The kinds with no term of their own wait for the idea of a song's sections (`term.form`).
    const form = songViewOf(TEST_SONG, null, new Set(["term.verse", "term.chorus", "term.form"]));
    expect(form.sections.map((s) => s.label)).toEqual(["Intro", "Verse", "Break", "Chorus", "Chorus"]);
    // A part is named once its own term is met; a part with no term has its name from the start.
    expect(partNameOf(TEST_SONG.parts[4] as never, new Set(["term.counter-melody"]))).toBe("Counter-melody");
    expect(form.parts.find((p) => p.id === "kick")?.name).toBe("Kick");
    expect(sectionLabels(TEST_SONG, new Set(["term.bridge"])).verse).toBe("B");
  });

  test("cells mark today's sections while a Make is open", () => {
    const view = songViewOf(TEST_SONG, testDetail([L01]), new Set(), { live: L02_STEP });
    expect(view.today).toEqual(["chorus1", "chorus2"]);
    expect(view.sections.filter((s) => s.today).map((s) => s.id)).toEqual(["chorus1", "chorus2"]);
    const at = (part: string, section: string) =>
      view.cells.find((c) => c.part === part && c.section === section);
    // Today's declared parts in today's sections; the earlier take keeps the verse; Oak keeps the rest.
    expect(at("hats", "chorus1")?.owner).toBe("today");
    expect(at("kick", "chorus2")?.owner).toBe("today");
    expect(at("bass", "chorus1")?.owner).toBe("oak");
    expect(at("kick", "verse")).toMatchObject({ owner: "yours", lessonId: "U01.L01", takeId: 1 });
    expect(at("hats", "verse")?.owner).toBe("oak");
    // What the code plays beyond the brief is today's too, once it has run.
    const played = songViewOf(TEST_SONG, testDetail([L01]), new Set(), {
      live: L02_STEP,
      played: { parts: new Set(["bass"]), playsChords: false },
    });
    expect(played.cells.find((c) => c.part === "bass" && c.section === "chorus1")?.owner).toBe("today");
    // Without a Make open nothing is today's.
    const plain = songViewOf(TEST_SONG, testDetail([L01]), new Set());
    expect(plain.today).toEqual([]);
    expect(plain.cells.some((c) => c.owner === "today")).toBe(false);
    expect(plain.cells).toHaveLength(TEST_SONG.sections.length * TEST_SONG.parts.length);
    expect(plain).toMatchObject({ title: "My groove", takesCount: 1, lessonsInSong: 3, lengthBars: 29 });
  });

  test("Oak's rests are read from its arrange()", () => {
    const rests = oakRestsOf(TEST_SONG, "flavour.pop");
    expect(rests.has("snare@intro")).toBe(true);
    expect(rests.has("lead@verse")).toBe(true);
    expect(rests.has("kick@intro")).toBe(false);
    const view = songViewOf(TEST_SONG, null, new Set());
    expect(view.cells.find((c) => c.part === "lead" && c.section === "chorus1")?.rests).toBe(false);
    expect(view.status).toBe("new");
  });
});

describe("songBandOf", () => {
  test("plays the saved takes in order at the newest take's tempo, and today's step live", () => {
    const later = testTake(2, "U01.L02", 'setcpm(104/4)\n\nkick: s("bd*4")', ["kick@chorus1"], { bpm: 104 });
    const band = songBandOf(TEST_SONG, testDetail([L01, later]), {
      flavour: "flavour.pop",
      live: L02_STEP,
    });
    expect(band.flavour).toBe("flavour.indie");
    expect(band.bpm).toBe(104);
    expect(band.sources.map((s) => [s.sourceId, s.lessonId])).toEqual([
      ["1", "U01.L01"],
      ["2", "U01.L02"],
    ]);
    expect(band.grid.get("kick@verse")).toBe("1");
    expect(band.grid.get("kick@chorus1")).toBe("2");
    expect(band.grid.get("bass@verse")).toBe("oak");
    expect(band.live).toEqual({ sourceId: "live", sections: ["chorus1", "chorus2"], step: L02_STEP });
    // No song yet: Oak's song in the profile's style at Oak's tempo.
    const fresh = songBandOf(TEST_SONG, null, { flavour: "flavour.funk" });
    expect(fresh).toMatchObject({ flavour: "flavour.funk", bpm: 100, sources: [] });
    expect(fresh.live).toBeUndefined();
    expect(songBpmOf(TEST_SONG, [])).toBe(100);
  });

  test("an imported take that fails the strict lint leaves its cells to Oak", () => {
    const risky = testTake(3, "U01.L01", 'fetch("http://x")\ndrums: s("bd")', ["kick@verse"], {
      reviewBeforeRun: true,
    });
    const band = songBandOf(TEST_SONG, testDetail([risky]), { flavour: "flavour.pop" });
    expect(band.sources).toEqual([]);
    expect(band.grid.get("kick@verse")).toBe("oak");
  });
});
