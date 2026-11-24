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
  type BuiltSong,
  composeSongPatterns,
  type FactEvent,
  finishSong,
  labelsOf,
  learnerSectionsOf,
  makeClaims,
  makeClaimsOfEvents,
  makeReading,
  olderTakeNumbers,
  playedPartsOfTracks,
  songBandFromWire,
  songBandToWire,
  songBandTracks,
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

describe("two takes of one lesson (a replayed lesson)", () => {
  // Take 1 played a crash, so it still owns perc@verse; the replay (take 2) took the rest of the verse's kit.
  const sources = [
    { sourceId: "11", lessonId: "U01.L03", code: 'drums: s("cr")' },
    { sourceId: "12", lessonId: "U01.L03", code: 'drums: s("bd sd")' },
  ];
  const grid = resolveGrid(SONG, [
    { sourceId: "11", cells: ["kick@verse", "snare@verse", "hats@verse", "perc@verse"] as never },
    { sourceId: "12", cells: ["kick@verse", "snare@verse", "hats@verse"] as never },
  ]);
  const band = { def: SONG, flavour: "flavour.pop" as const, bpm: 100, sources: sources as never, grid };

  test("each plays on its own track: the older take is numbered, the newest keeps the plain name", () => {
    expect([...olderTakeNumbers(sources)]).toEqual([["11", 1]]);
    const built: BuiltSong = {
      band,
      oak: [],
      sources: [
        {
          sourceId: "11",
          lessonId: "U01.L03",
          tracks: [{ label: "drums", pattern: hits("cr") }],
          sections: null,
        },
        {
          sourceId: "12",
          lessonId: "U01.L03",
          tracks: [{ label: "drums", pattern: hits("bd", "sd") }],
          sections: null,
        },
      ],
      dropped: [],
    };
    const out = finishSong(built, null).tracks;
    expect(out.map((t) => t.track)).toEqual(["band.take.U01.L03.drums#1", "band.take.U01.L03.drums"]);
    expect(soundsIn(out[0]?.pattern as Pattern, 4, 5)).toEqual(["cr"]);
    expect(soundsIn(out[1]?.pattern as Pattern, 4, 5)).toEqual(["bd", "sd"]);
    // The static list (the Workbench's heard Band parts) names both as well.
    expect(songBandTracks(band).filter((t) => t.startsWith("take."))).toEqual([
      "take.U01.L03.drums#1",
      "take.U01.L03.drums",
    ]);
  });
});

describe("what a Make claims: one reading for the live Make and its saved take", () => {
  const step = (sections: string[], parts: string[]) =>
    ({ lesson: "U01.L03", kind: "take", sections, parts, startFrom: "oak", today: "" }) as never;
  /** The grader's events of some tracks over `bars` bars, as the app gets them from an evaluation. */
  const eventsOf = (tracks: { label: string; pattern: Pattern }[], bars: number): FactEvent[] =>
    tracks.flatMap(({ label, pattern }) =>
      pattern
        .queryArc(0, bars)
        .filter((h) => h.hasOnset())
        .map((h) => {
          const v = h.value as { s?: string; note?: string | number };
          return {
            track: label,
            beginF: Number(h.whole?.begin.valueOf()),
            s: v.s ?? null,
            note: v.note ?? null,
          };
        }),
    );
  const both = (def: UnitSongDef, st: never, code: string, tracks: { label: string; pattern: Pattern }[]) => {
    const reading = makeReading(def, (st as { sections: string[] }).sections as never, st, code);
    const fromPatterns = makeClaims(
      def,
      reading,
      tracks.map((t) => ({ label: t.label, facts: trackFacts(t.pattern, reading.spans) })),
    );
    const fromEvents = makeClaimsOfEvents(def, reading, eventsOf(tracks, reading.bars));
    expect(fromEvents).toEqual(fromPatterns);
    return { reading, cells: fromEvents.cells, played: fromEvents.played };
  };
  const notes = (...n: (string | string[])[]): Pattern =>
    (core.sequence as (...v: unknown[]) => Pattern)(
      ...n.map((x) =>
        Array.isArray(x)
          ? (core.stack as (...v: unknown[]) => Pattern)(...x.map((note) => ({ note })))
          : { note: x },
      ),
    );

  test("a `mel:` tune in thirds is a tune: it claims the lead only, not Oak's chords and bass", () => {
    const thirds = notes(["e4", "g4"], ["d4", "f4"], ["c4", "e4"], ["d4", "f4"]);
    const { cells, played } = both(SONG, step(["verse"], ["lead"]), 'mel: note("[e4,g4] [d4,f4]")', [
      { label: "mel", pattern: thirds },
    ]);
    expect(played.playsChords).toBe(false);
    expect(cells).toEqual(["lead@verse"]);
  });

  test("a loop is read over the whole section it fills: a crash on bar 8 of an 8-bar verse claims the perc", () => {
    const def = { ...SONG, sections: [{ id: "verse", type: "verse", bars: 8 }] } as unknown as UnitSongDef;
    const bar = hits("bd", "hh", "sd", "hh");
    const lastBar = hits("bd", "hh", "sd", "cr");
    const drums = (core.slowcat as (...v: unknown[]) => Pattern)(bar, bar, bar, bar, bar, bar, bar, lastBar);
    const { reading, cells } = both(def, step(["verse"], ["kick", "snare", "hats"]), 'drums: s("...")', [
      { label: "drums", pattern: drums },
    ]);
    expect(reading.bars).toBe(8);
    expect(cells).toEqual(["kick@verse", "snare@verse", "hats@verse", "perc@verse"]);
  });

  test("a code with its own arrange() is read in the sections the step takes only", () => {
    const code = [
      'const bassIntro = note("c2*4")',
      "const bassVerse = silence",
      'const drumsIntro = s("bd*4")',
      'const drumsVerse = s("bd sd bd sd")',
      "bass: arrange([4, bassIntro], [4, bassVerse])",
      "drums: arrange([4, drumsIntro], [4, drumsVerse])",
    ].join("\n");
    const arr = (a: Pattern, b: Pattern) => (core.arrange as (...v: unknown[]) => Pattern)([4, a], [4, b]);
    const tracks = [
      { label: "bass", pattern: arr(notes("c2", "c2", "c2", "c2"), core.silence as Pattern) },
      { label: "drums", pattern: arr(hits("bd", "bd", "bd", "bd"), hits("bd", "sd", "bd", "sd")) },
    ];
    // Only the verse is today's: the bass, which plays in the intro only, is not claimed.
    const { reading, cells } = both(SONG, step(["verse"], ["kick"]), code, tracks);
    expect(reading.spans).toEqual([[4, 8]]);
    expect(reading.bars).toBe(8);
    expect(cells).toEqual(["kick@verse", "snare@verse"]);
  });
});
