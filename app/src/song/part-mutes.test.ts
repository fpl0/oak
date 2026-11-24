// Mute and solo per part on the song page (spec 2026-11-24 §5.5) and the takes the composer plays: which tracks a
// part's controls reach (an older take of a replayed lesson plays as `…#<n>`), a `drums:` line shared by several
// parts muted hit by hit, and every take's saved labels carried to the composer.
import { describe, expect, test } from "bun:test";
import type { UnitSongSnapshot } from "@oak/api";
import { songBandOf } from "./model.ts";
import { partMutes, partTracks, snapshotBand } from "./surfaces-model.ts";
import { TEST_SONG, testDetail, testTake } from "./test-song.ts";

const LINE = "band.take.U01.L01.drums";
/** The first take of U01.L01: one `drums:` line playing the kick and the snare of the verse. */
const DRUMS = testTake(1, "U01.L01", 'drums: s("bd sd bd sd")', ["kick@verse", "snare@verse"], {
  labels: { drums: null },
});
const LOADED = ["band.oak.kick", "band.oak.snare", "band.oak.hats", "band.oak.bass", "band.oak.mel", LINE];

describe("two takes of one lesson", () => {
  test("a part's controls reach the older take's numbered track", () => {
    // The replay took only the kick of the verse: the first take still holds the snare there, on `…drums#1`.
    const replay = testTake(2, "U01.L01", 'kick: s("bd*4")', ["kick@verse"], { labels: { kick: "kick" } });
    const detail = testDetail([DRUMS, replay]);
    expect(partTracks(TEST_SONG, detail, "snare")).toEqual(["band.oak.snare", `${LINE}#1`]);
    expect(partTracks(TEST_SONG, detail, "kick")).toEqual(["band.oak.kick", "band.take.U01.L01.kick"]);
    // Muting the snare reaches the older take's line, hit by hit (its kick hits were taken over: not its to mute).
    const m = partMutes(TEST_SONG, detail, { muted: new Set(["snare"]), solo: null }, LOADED);
    expect([...m.muted]).toEqual(["band.oak.snare"]);
    expect(m.hits?.get(`${LINE}#1`)?.("sd")).toBe(true);
  });
});

describe("a drums: line that plays the kick and the snare", () => {
  const detail = testDetail([DRUMS]);
  const hitMuted = (m: ReturnType<typeof partMutes>, sound: string) =>
    m.muted.has(LINE) || (m.hits?.get(LINE)?.(sound) ?? false);

  test("Mute Kick silences its bd hits only", () => {
    const m = partMutes(TEST_SONG, detail, { muted: new Set(["kick"]), solo: null }, LOADED);
    expect([...m.muted]).toEqual(["band.oak.kick"]);
    expect(hitMuted(m, "bd")).toBe(true);
    expect(hitMuted(m, "bd:2")).toBe(true);
    expect(hitMuted(m, "sd")).toBe(false);
  });

  test("Mute Snare silences its sd hits only", () => {
    const m = partMutes(TEST_SONG, detail, { muted: new Set(["snare"]), solo: null }, LOADED);
    expect(hitMuted(m, "sd")).toBe(true);
    expect(hitMuted(m, "bd")).toBe(false);
  });

  test("Play Kick alone keeps its bd hits and silences its sd hits", () => {
    const m = partMutes(TEST_SONG, detail, { muted: new Set(), solo: "kick" }, LOADED);
    expect(m.muted.has("band.oak.kick")).toBe(false);
    expect(m.muted.has("band.oak.snare")).toBe(true);
    expect(hitMuted(m, "bd")).toBe(false);
    expect(hitMuted(m, "sd")).toBe(true);
  });

  test("Play Bass alone silences the whole line; muting both its parts silences every hit", () => {
    const solo = partMutes(TEST_SONG, detail, { muted: new Set(), solo: "bass" }, LOADED);
    expect(solo.muted.has(LINE)).toBe(true);
    const both = partMutes(TEST_SONG, detail, { muted: new Set(["kick", "snare"]), solo: null }, LOADED);
    expect(hitMuted(both, "bd")).toBe(true);
    expect(hitMuted(both, "sd")).toBe(true);
  });

  test("a line of one part, and no control, mute whole tracks only", () => {
    const kick = testTake(3, "U01.L01", 'kick: s("bd*4")', ["kick@verse"], { labels: { kick: "kick" } });
    const m = partMutes(TEST_SONG, testDetail([kick]), { muted: new Set(["kick"]), solo: null }, LOADED);
    expect([...m.muted]).toEqual(["band.oak.kick", "band.take.U01.L01.kick"]);
    expect(m.hits).toBeUndefined();
    expect(partMutes(TEST_SONG, detail, { muted: new Set(), solo: null }, LOADED)).toEqual({
      muted: new Set(),
      solo: null,
    });
  });
});

describe("the composer gets every take's saved labels", () => {
  test("songBandOf and a release snapshot pass each take's labels as its source's", () => {
    const band = songBandOf(TEST_SONG, testDetail([DRUMS]), { flavour: "flavour.pop" });
    expect(band.sources).toEqual([
      { sourceId: "1", lessonId: "U01.L01", code: DRUMS.code, labels: { drums: null } },
    ]);
    const snapshot = {
      id: 1,
      unitId: "U01",
      albumTrackId: null,
      albumVersion: null,
      songId: "usong.U01",
      songVersion: 1,
      flavour: "flavour.pop",
      bpm: 100,
      def: TEST_SONG,
      oakCode: TEST_SONG.code["flavour.pop"],
      reviewBeforeRun: false,
      takes: [
        {
          takeId: 4,
          lessonId: "U01.L01",
          sketchId: "sk_4",
          sketchVersion: 1,
          code: '$: note("c2*4")',
          cells: ["bass@verse"],
          labels: { $0: "bass" },
          bpm: 100,
        },
      ],
    } as unknown as UnitSongSnapshot;
    expect(snapshotBand(snapshot).sources[0]?.labels).toEqual({ $0: "bass" });
  });
});
