import { describe, expect, test } from "bun:test";
import {
  cftNext,
  type GymContext,
  type GymLogEntry,
  gymChoices,
  gymSources,
  gymStageLabel,
  localDay,
  NO_REPEAT_DAYS,
  nextGymSource,
  servedRecently,
} from "./gym-after-core.ts";
import { gymItemOf } from "./gym-items.ts";

const base: GymContext = {
  coreComplete: true,
  completed: new Set(),
  ladderLevel: 8,
  ownAudio: [{ id: "tr_1", title: "Night drive" }],
  songs: [
    { songId: "song.aura-lee", title: "Aura Lee", level: 5, status: "done" },
    { songId: "song.careless-love", title: "Careless Love", level: 6, status: "open" },
    { songId: "song.five-foot-two", title: "Five Foot Two", level: 8, status: "done" },
    { songId: "song.bye-bye-blackbird", title: "Bye Bye Blackbird", level: 8, status: "open" },
    { songId: "song.drunken-sailor", title: "Drunken Sailor", level: 5, status: "locked" },
  ],
  cfTReleased: true,
  analysable: new Set(["song.five-foot-two", "song.bye-bye-blackbird"]),
};

describe("what the gym can serve after the core", () => {
  test("every unlocked stage: own audio, L1–L4, the songs, the standards and their analysis", () => {
    const s = gymSources(base);
    const kinds = new Set(s.map((x) => x.kind));
    expect([...kinds].sort()).toEqual(["analysis", "ladder", "own-audio", "song", "standard"]);
    expect(s.filter((x) => x.kind === "ladder").map((x) => x.stage)).toEqual(["L1", "L2", "L3", "L4"]);
    // A locked song is never offered; the standards are L8.
    expect(s.some((x) => x.id === "song:song.drunken-sailor")).toBe(false);
    expect(s.find((x) => x.id === "song:song.bye-bye-blackbird")?.stage).toBe("L8");
  });

  test("jazz and rhythm items open with the track lessons that teach them, never before", () => {
    expect(gymSources(base).some((x) => x.kind === "jazz" || x.kind === "rhythm")).toBe(false);
    const s = gymSources({ ...base, completed: new Set(["J1.L03", "R3.L02"]) });
    const jazz = s.filter((x) => x.kind === "jazz");
    expect(jazz).toHaveLength(12);
    expect(jazz.every((x) => x.id.startsWith("jazz:ii-V-I:"))).toBe(true);
    expect(s.filter((x) => x.kind === "rhythm").map((x) => x.id)).toEqual([
      "rhythm:clave-son",
      "rhythm:clave-rumba",
    ]);
    // Every source the gym names can be built.
    for (const x of s) if (x.open.via === "item") expect(gymItemOf(x.open.itemId)).not.toBeNull();
  });

  test("before CF-T is released no standard is analysed (its changes are still a transcription task)", () => {
    expect(gymSources({ ...base, cfTReleased: false }).some((x) => x.kind === "analysis")).toBe(false);
  });
});

describe("no source twice inside two weeks", () => {
  const ctx = { ...base, completed: new Set(["J1.L03", "J4.L02", "R1.L02", "R3.L02"]) };
  const sources = gymSources(ctx);

  test("a source served 13 days ago is not served; at 14 days it may be", () => {
    const log: GymLogEntry[] = [{ sourceId: "rhythm:swing-16", day: "2026-11-01" }];
    expect(servedRecently(log, "rhythm:swing-16", "2026-11-14")).toBe(true);
    expect(servedRecently(log, "rhythm:swing-16", "2026-11-15")).toBe(false);
    expect(NO_REPEAT_DAYS).toBe(14);
  });

  test("the kinds take turns, and four weeks of daily gym sessions never repeat a source within 14 days", () => {
    const log: GymLogEntry[] = [];
    const start = Date.parse("2026-11-01T12:00:00Z");
    const kinds: string[] = [];
    for (let d = 0; d < 28; d++) {
      const day = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
      const next = nextGymSource(sources, log, day);
      expect(next).not.toBeNull();
      if (!next) break;
      expect(servedRecently(log, next.id, day)).toBe(false);
      log.push({ sourceId: next.id, day });
      kinds.push(next.kind);
    }
    // No kind twice in a row while others are fresh.
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
    expect(new Set(kinds)).toEqual(
      new Set(["own-audio", "ladder", "song", "standard", "analysis", "jazz", "rhythm"]),
    );
  });

  test("when every source was served recently there is nothing to serve; the choices are fresh and of other kinds", () => {
    const today = "2026-11-15";
    const all = sources.map((s) => ({ sourceId: s.id, day: today }));
    expect(nextGymSource(sources, all, today)).toBeNull();
    expect(gymChoices(sources, all, today)).toEqual([]);
    const choices = gymChoices(sources, [], today, 4);
    expect(choices).toHaveLength(4);
    expect(new Set(choices.map((c) => c.kind)).size).toBe(4);
  });

  test("localDay writes the calendar day", () => {
    expect(localDay(new Date(2026, 10, 5, 23, 30))).toBe("2026-11-05");
  });
});

describe("gymStageLabel", () => {
  test("a gym choice's chip says the level or track in words, never its code", () => {
    expect(gymStageLabel("L3")).toBe("Level 3");
    expect(gymStageLabel("L8")).toBe("Level 8");
    expect(gymStageLabel("G")).toBe("Jazz");
    expect(gymStageLabel("H")).toBe("Rhythm");
  });
});

// UX review practice-8b: the gym's CF-T line named the next session by its ID ("next: CF-T.S2").
test("cftNext: the Standard Transcription's next session in words, never its ID", () => {
  expect(cftNext("CF-T.S2")).toBe(" (next: session 2)");
  expect(cftNext(null)).toBe("");
  expect(cftNext("CF-T")).toBe("");
});
