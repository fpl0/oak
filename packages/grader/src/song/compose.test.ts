// The unit-song composer in the grader package (@oak/grader/song; spec 2026-11-24 §5.2): headless and pure, the one
// composer both realms use (the adapter re-exports it as @oak/strudel/song-compose, whose own tests,
// packages/strudel/src/song-compose.test.ts, run it through the adapter's evaluation). These tests build patterns with
// @strudel/core directly: no evaluation, no adapter.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveGrid, type UnitSongDef } from "@oak/content-kit";
import * as core from "@strudel/core";
import {
  composeSongPatterns,
  labelsOf,
  learnerSectionsOf,
  playedPartsOfTracks,
  songBandFromWire,
  songBandToWire,
  songLengthBars,
  sourceSectionsOf,
  stripComments,
  trackFacts,
} from "./index.ts";

type Pattern = Strudel.Pattern;

const part = (id: string, label: string, role: string, sounds?: string[]) => ({
  id,
  label,
  role,
  ...(sounds ? { sounds } : {}),
  name: id,
  plainName: id,
});
/** The parts every unit song has (content/unit-songs), drums first. */
const SONG = {
  id: "usong.U01",
  unit: "U01",
  version: 1,
  title: "Test song",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 100,
  sections: [
    { id: "intro", type: "intro", bars: 4 },
    { id: "verse", type: "verse", bars: 4 },
  ],
  parts: [
    part("kick", "kick", "drums", ["bd"]),
    part("snare", "snare", "drums", ["sd", "rim", "cp"]),
    part("hats", "hats", "drums", ["hh", "oh"]),
    part("perc", "perc", "drums", ["cr", "rd", "lt", "mt", "ht", "sh", "cb", "tb"]),
    part("bass", "bass", "bass"),
    part("chords", "chords", "chords"),
    part("lead", "mel", "melody"),
  ],
  code: {},
  plan: [],
  releaseAfter: "U01.CP",
} as unknown as UnitSongDef;

/** One bar of hits, as `s("a b c d")` plays them: a sequence of `{ s }` values. */
const hits = (...sounds: string[]): Pattern =>
  (core.sequence as (...v: unknown[]) => Pattern)(...sounds.map((s) => ({ s })));

/** The sounds that start in bars [from, to), in order. */
const soundsIn = (pattern: Pattern, from: number, to: number): string[] =>
  pattern
    .queryArc(from, to)
    .filter((h) => h.hasOnset())
    .sort((a, b) => Number(a.whole?.begin.valueOf()) - Number(b.whole?.begin.valueOf()))
    .map((h) => (h.value as { s: string }).s);

const composeDrums = (pattern: Pattern, cells: string[]) => {
  const grid = resolveGrid(SONG, [{ sourceId: "t1", cells: cells as never }]);
  return composeSongPatterns({
    def: SONG,
    lengthBars: songLengthBars(SONG),
    oak: [],
    sources: [
      {
        sourceId: "t1",
        lessonId: "U01.L01",
        tracks: [{ label: "drums", role: "drums", pattern }],
        sections: null,
      },
    ],
    grid,
  });
};

describe("the composer lives in the grader, headless", () => {
  test("song/ imports only @oak/content-kit, @strudel/core and its own files", () => {
    const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g;
    for (const file of ["compose.ts", "band-form.ts", "comments.ts", "index.ts"]) {
      const text = readFileSync(join(import.meta.dir, file), "utf8");
      for (const m of text.matchAll(IMPORT))
        expect([file, m[1]]).toEqual([
          file,
          expect.stringMatching(/^(@oak\/content-kit|@strudel\/core|\.\/(band-form|comments|compose)\.ts)$/),
        ]);
    }
  });

  test("@oak/strudel/song-compose, band-form.ts and comments.ts re-export this module unchanged", async () => {
    const here = await import("./index.ts");
    const adapter = await import("@oak/strudel/song-compose");
    for (const [name, value] of Object.entries(adapter))
      expect([name, value === (here as Record<string, unknown>)[name]]).toEqual([name, true]);
    expect(Object.keys(adapter).sort()).toEqual(Object.keys(here).sort());
  });
});

describe("static readers", () => {
  test("comments are stripped with offsets kept; sections and labels are read statically", () => {
    expect(stripComments('a // x\n"//not"')).toBe('a     \n"//not"');
    const code = [
      'const drumsVerse = s("bd*4")',
      'const drumsChorus2 = s("bd*8")',
      '// mel: note("c4")',
      "drums: arrange([4, drumsVerse], [8, drumsChorus2])",
      '_hats: s("hh*8")',
    ].join("\n");
    expect(learnerSectionsOf(code)?.map((s) => [s.ident, s.type, s.bars])).toEqual([
      ["drumsVerse", "verse", 4],
      ["drumsChorus2", "chorus", 8],
    ]);
    expect(sourceSectionsOf(code)).toEqual([
      { type: "verse", startBar: 0, bars: 4 },
      { type: "chorus", startBar: 4, bars: 8, variant: 2 },
    ]);
    expect(labelsOf(code)).toEqual(["drums"]);
    expect(songLengthBars(SONG)).toBe(8);
  });

  test("a song band survives the JSON wire", () => {
    const band = {
      def: SONG,
      flavour: "flavour.pop" as const,
      bpm: 100,
      sources: [],
      grid: resolveGrid(SONG, [{ sourceId: "t1", cells: ["kick@verse"] }]),
    };
    const back = songBandFromWire(JSON.parse(JSON.stringify(songBandToWire(band))));
    expect([...back.grid]).toEqual([...band.grid]);
  });
});

describe("sound pack v4 hits in a song (contracts §5.11 rules 9–10)", () => {
  test("a break plays where its source owns any drum part, and claims every drum part", () => {
    const brk = hits("brkhouse", "brkhouse:1", "brkhouse:2", "brkhouse:3");
    const all = ["kick", "snare", "hats", "perc"].map((p) => `${p}@verse`);
    // It owns the verse's kit: the break plays in the verse only.
    const out = composeDrums(brk, all);
    expect(out.map((t) => t.track)).toEqual(["band.take.U01.L01.drums"]);
    expect(soundsIn(out[0]?.pattern as Pattern, 0, 4)).toEqual([]);
    expect(soundsIn(out[0]?.pattern as Pattern, 4, 5)).toEqual([
      "brkhouse",
      "brkhouse:1",
      "brkhouse:2",
      "brkhouse:3",
    ]);
    // A later take took the kick: one sample cannot be split, so the break still plays on the parts it keeps.
    const kickTaken = composeDrums(brk, all.slice(1));
    expect(soundsIn(kickTaken[0]?.pattern as Pattern, 4, 5)).toHaveLength(4);
    // What it plays: every drum part.
    const facts = trackFacts(brk, 1);
    expect([...playedPartsOfTracks(SONG, [{ label: "drums", role: "drums", facts }]).parts]).toEqual([
      "kick",
      "snare",
      "hats",
      "perc",
    ]);
  });

  test("conga, bongo and clave hits are the percussion part's: filtered with it, claimed as it", () => {
    const line = hits("bd", "conga", "bongo:2", "clave");
    // The source owns only the verse's kick: its kick plays, its hand percussion does not.
    const kickOnly = composeDrums(line, ["kick@verse"]);
    expect(soundsIn(kickOnly[0]?.pattern as Pattern, 4, 5)).toEqual(["bd"]);
    // It owns kick and perc: all of it plays.
    const both = composeDrums(line, ["kick@verse", "perc@verse"]);
    expect(soundsIn(both[0]?.pattern as Pattern, 4, 5)).toEqual(["bd", "conga", "bongo:2", "clave"]);
    const facts = trackFacts(line, 1);
    expect([...playedPartsOfTracks(SONG, [{ label: "drums", role: "drums", facts }]).parts]).toEqual([
      "kick",
      "perc",
    ]);
  });

  test("old kit names are filtered exactly as before; a bed belongs to no part", () => {
    const line = hits("bd", "sd", "hh", "cb", "oak909_bd", "vinyl");
    const out = composeDrums(line, ["snare@verse"]);
    // The snare is its own; `vinyl` maps to no part and the `drums:` label to none, so it plays wherever the
    // source owns a cell (going past the brief, rule 10).
    expect(soundsIn(out[0]?.pattern as Pattern, 4, 5)).toEqual(["sd", "vinyl"]);
  });
});
