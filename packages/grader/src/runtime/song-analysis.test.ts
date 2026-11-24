// The Workbench analysis of a unit song (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.2): the grader
// realm composes the song with the adapter's own composer (`@oak/strudel/song-compose`), so the roll, the chord band
// and the staff show what plays. Also the Band's label filter (`bandTracks`), which replaces the Workbench's old line
// filter. In-process realm, no lockdown (as runtime.test.ts).
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { resolveGrid, type TakeStep, type UnitSongDef } from "@oak/content-kit";
import { type SongBand, songBandToWire } from "@oak/strudel/song-compose";
import type { EvalSuccess, OakEvent } from "../types.ts";
import { evaluateForGrading } from "./analyze.ts";
import { initRealm } from "./realm.ts";

setDefaultTimeout(30_000);

beforeAll(async () => {
  await initRealm({ toolbox: [], lockdown: false });
});

const part = (id: string, label: string, role: string, sounds?: string[]) => ({
  id,
  label,
  role,
  ...(sounds ? { sounds } : {}),
  name: id,
  plainName: id,
});
const OAK = ['kick: s("bd*4")', 'snare: s("~ sd ~ sd")', 'hats: s("hh*4")'].join("\n");
const DEF = {
  id: "usong.U01",
  unit: "U01",
  version: 1,
  title: "Test song",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 100,
  sections: [
    { id: "intro", type: "intro", bars: 4 },
    { id: "verse", type: "verse", bars: 8 },
  ],
  parts: [
    part("kick", "kick", "drums", ["bd"]),
    part("snare", "snare", "drums", ["sd"]),
    part("hats", "hats", "drums", ["hh", "oh"]),
  ],
  code: { "flavour.pop": OAK, "flavour.indie": OAK, "flavour.jazz-soul": OAK, "flavour.funk": OAK },
  plan: [],
  releaseAfter: "U01.CP",
} as unknown as UnitSongDef;

const STEP = {
  lesson: "U01.L03",
  kind: "take",
  sections: ["verse"],
  parts: ["hats"],
  startFrom: "oak",
  today: "Your hats play in the second part.",
} as unknown as TakeStep;

function ok(r: Awaited<ReturnType<typeof evaluateForGrading>>): EvalSuccess {
  if (!r.ok) throw new Error(`${r.error.kind}: ${r.error.message}`);
  return r;
}
const barsOf = (events: readonly OakEvent[], track: string): number[] =>
  [...new Set(events.filter((e) => e.track === track).map((e) => Math.floor(e.beginF)))].sort(
    (a, b) => a - b,
  );
const range = (from: number, to: number): number[] => Array.from({ length: to - from }, (_, i) => from + i);

describe("a unit song in the analysis", () => {
  test("Oak, a saved take and the live Make are composed as they play", async () => {
    const band: SongBand = {
      def: DEF,
      flavour: "flavour.pop",
      bpm: 100,
      sources: [{ sourceId: "t1", lessonId: "U01.L01", code: 'setcpm(200/4)\ndrums: s("bd*2")' }],
      live: { sourceId: "live", sections: ["verse"], step: STEP },
      grid: resolveGrid(DEF, [{ sourceId: "t1", cells: ["kick@verse"] }]),
    };
    const r = ok(
      await evaluateForGrading('hats: s("hh*8")', {
        mode: "lesson",
        bars: 12,
        lint: null,
        song: JSON.parse(JSON.stringify(songBandToWire(band))),
      }),
    );
    // The take's own setcpm never sets the tempo; the learner set none, so the song's applies.
    expect(r.cps).toBeCloseTo(100 / 60 / 4, 10);
    expect(r.tracks).toEqual([
      "hats",
      "band.oak.kick",
      "band.oak.snare",
      "band.oak.hats",
      "band.take.U01.L01.drums",
    ]);
    // The live hats play only in the verse, where Oak's hats rest; the take's kick plays in the verse.
    expect(barsOf(r.events, "hats")).toEqual(range(4, 12));
    expect(barsOf(r.events, "band.oak.hats")).toEqual(range(0, 4));
    expect(barsOf(r.events, "band.oak.kick")).toEqual(range(0, 4));
    expect(barsOf(r.events, "band.oak.snare")).toEqual(range(0, 12));
    expect(barsOf(r.events, "band.take.U01.L01.drums")).toEqual(range(4, 12));
    // Song haps carry no locations into the learner's code.
    expect(r.events.filter((e) => e.track.startsWith("band.")).every((e) => e.locations.length === 0)).toBe(
      true,
    );
  });

  test("the learner's own setcpm still wins over the song's tempo", async () => {
    const band: SongBand = {
      def: DEF,
      flavour: "flavour.pop",
      bpm: 100,
      sources: [],
      grid: resolveGrid(DEF, []),
    };
    const r = ok(
      await evaluateForGrading('setcpm(120/4)\nhats: s("hh*8")', {
        mode: "lesson",
        bars: 4,
        lint: null,
        song: songBandToWire(band),
      }),
    );
    expect(r.cps).toBeCloseTo(0.5, 10);
  });
});

describe("the Band's label filter", () => {
  test("keeps the labels asked for, by the label each track registers, across a broken line", async () => {
    const band = ['drums: s("bd sd")', 'chords: note("[c3,e3,g3]")', '  .s("piano")'].join("\n");
    const r = ok(
      await evaluateForGrading('mel: note("c4")', {
        mode: "lesson",
        bars: 1,
        lint: null,
        band,
        bandTracks: ["drums"],
      }),
    );
    expect(r.tracks).toEqual(["mel", "band.drums"]);
    // A line filter glued the orphan `.s("piano")` onto the drums; the label filter never sees lines.
    expect(r.events.filter((e) => e.track === "band.drums").map((e) => e.s)).toEqual(["bd", "sd"]);
  });
});
