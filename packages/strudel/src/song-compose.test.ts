// The unit-song composer (song-compose.ts) and its evaluation (evaluation.ts), against real headless Strudel 1.2.6:
// Oak's tracks masked bar by bar to the cells nobody took, learner loops placed per section with arrange()'s restart,
// drum hits filtered to the parts a source still owns, a learner arrange() mapped by section type, a source's tempo
// neutralised, the live Make owning today's cells, and the static helpers the app builds on (spec §5.2).
import { beforeAll, describe, expect, test } from "bun:test";
import {
  type CellKey,
  type LintContext,
  resolveGrid,
  type TakeStep,
  type UnitSongDef,
} from "@oak/content-kit";
import { lintOak } from "@oak/grader";
import * as core from "@strudel/core";
import * as mini from "@strudel/mini";
import * as tonal from "@strudel/tonal";
import { transpiler } from "@strudel/transpiler";
import { prepareBandFor } from "./band.ts";
import {
  collectTracks,
  type EvalSession,
  evaluateSongBand,
  finalizePattern,
  installTrackWrapper,
  newSession,
} from "./evaluation.ts";
import { TRACK_KEY } from "./haps.ts";
import { PieceRenderError } from "./offline/errors.ts";
import { validateRequest } from "./offline/request.ts";
import {
  composeSongPatterns,
  roleOfTrack,
  type SongBand,
  type SongCheck,
  songBandFromWire,
  songBandToWire,
  songBandTracks,
  songFormView,
  songLengthBars,
  songLintContext,
  sourceSectionsOf,
  trackFacts,
} from "./song-compose.ts";
import type { BandSetup, MuteMap } from "./types.ts";

type Pattern = Strudel.Pattern;

beforeAll(async () => {
  await core.evalScope(core, mini, tonal);
});

const part = (id: string, label: string, role: string, sounds?: string[]) => ({
  id,
  label,
  role,
  ...(sounds ? { sounds } : {}),
  name: id,
  plainName: id,
});
const PARTS = [
  part("kick", "kick", "drums", ["bd"]),
  part("snare", "snare", "drums", ["sd", "cp"]),
  part("hats", "hats", "drums", ["hh", "oh"]),
  part("bass", "bass", "bass"),
  part("chords", "chords", "chords"),
  part("lead", "mel", "melody"),
];

/** A song for the composer: not run through `defineUnitSong`, so a test may use a 3-bar section. */
function songOf(sections: [id: string, type: string, bars: number][], code = ""): UnitSongDef {
  return {
    id: "usong.U01",
    unit: "U01",
    version: 1,
    title: "Test song",
    meter: "4/4",
    key: { tonic: "C", mode: "major" },
    bpm: 100,
    sections: sections.map(([id, type, bars]) => ({ id, type, bars })),
    parts: PARTS,
    code: {
      "flavour.pop": code,
      "flavour.indie": code,
      "flavour.jazz-soul": code,
      "flavour.funk": code,
      "flavour.electronic": code,
    },
    plan: [],
    releaseAfter: "U01.CP",
  } as unknown as UnitSongDef;
}

const takeStep = (sections: string[] | "all", parts: string[], oakKeeps?: string[]): TakeStep =>
  ({
    lesson: "U01.L05",
    kind: "take",
    sections,
    parts,
    ...(oakKeeps ? { oakKeeps } : {}),
    startFrom: "oak",
    today: "Your groove plays here.",
  }) as unknown as TakeStep;

interface Onset {
  bar: number;
  at: number;
  track: string;
  value: Record<string, unknown>;
}
/** Onset haps of a pattern in [from, to) cycles, sorted by time. */
function onsets(pattern: Pattern, from: number, to: number, track = ""): Onset[] {
  return pattern
    .queryArc(from, to)
    .filter((h) => h.hasOnset())
    .map((h) => {
      const at = Number(h.whole?.begin.valueOf());
      const tagged = h.context[TRACK_KEY];
      return {
        bar: Math.floor(at),
        at,
        track: typeof tagged === "string" ? tagged : track,
        value: h.value as Record<string, unknown>,
      };
    })
    .sort((a, b) => a.at - b.at);
}
const barsOf = (list: readonly Onset[]): number[] =>
  [...new Set(list.map((o) => o.bar))].sort((a, b) => a - b);
const range = (from: number, to: number): number[] => Array.from({ length: to - from }, (_, i) => from + i);

function trackOf(tracks: readonly { track: string; pattern: Pattern }[], name: string): Pattern {
  const found = tracks.find((t) => t.track === name);
  if (!found) throw new Error(`no track ${name} in ${tracks.map((t) => t.track).join(", ")}`);
  return found.pattern;
}

describe("composeSongPatterns", () => {
  test("oak plays every unclaimed cell and nothing in claimed ones", async () => {
    const def = songOf([
      ["intro", "intro", 4],
      ["verse", "verse", 8],
    ]);
    const oak = await collectTracks('kick: s("bd*4")\nsnare: s("~ sd ~ sd")');
    const drums = await collectTracks('drums: s("bd*2")');
    const grid = resolveGrid(def, [{ sourceId: "t1", cells: ["kick@verse"] }]);
    const out = composeSongPatterns({
      def,
      lengthBars: songLengthBars(def),
      oak,
      sources: [
        {
          sourceId: "t1",
          lessonId: "U01.L01",
          tracks: drums.map((t) => ({ ...t, role: "drums" as const })),
          sections: null,
        },
      ],
      grid,
    });
    expect(out.map((t) => t.track)).toEqual(["band.oak.kick", "band.oak.snare", "band.take.U01.L01.drums"]);
    // Bars 0–3 are the intro (Oak's kick), 4–11 the verse (the take's); the song loops at bar 12.
    expect(barsOf(onsets(trackOf(out, "band.oak.kick"), 0, 24))).toEqual([...range(0, 4), ...range(12, 16)]);
    expect(barsOf(onsets(trackOf(out, "band.oak.snare"), 0, 12))).toEqual(range(0, 12));
    const take = onsets(trackOf(out, "band.take.U01.L01.drums"), 0, 24);
    expect(barsOf(take)).toEqual([...range(4, 12), ...range(16, 24)]);
    expect(take.filter((o) => o.bar === 4).map((o) => o.value.s)).toEqual(["bd", "bd"]);
  });

  test("a one-bar loop restarts at each owned section", async () => {
    // A 3-bar intro, then a 4-bar loop owned in the verse: a plain shift would start the verse on its 4th bar.
    const def = songOf([
      ["intro", "intro", 3],
      ["verse", "verse", 4],
    ]);
    const mel = await collectTracks('mel: note("<c4 d4 e4 f4>")');
    const out = composeSongPatterns({
      def,
      lengthBars: 7,
      oak: [],
      sources: [
        {
          sourceId: "t2",
          lessonId: "U02.L02",
          tracks: mel.map((t) => ({ ...t, role: "melody" as const })),
          sections: null,
        },
      ],
      grid: resolveGrid(def, [{ sourceId: "t2", cells: ["lead@verse"] }]),
    });
    const notes = onsets(trackOf(out, "band.take.U02.L02.mel"), 0, 14);
    expect(notes.map((o) => `${o.bar}:${o.value.note}`)).toEqual([
      "3:c4",
      "4:d4",
      "5:e4",
      "6:f4",
      "10:c4",
      "11:d4",
      "12:e4",
      "13:f4",
    ]);
  });

  test("drum hits are filtered to the parts a source still owns", async () => {
    const def = songOf([["verse", "verse", 4]]);
    const first = await collectTracks('drums: s("bd sd")');
    const later = await collectTracks('kick: s("bd*4")');
    // The first take took kick and snare; a later take took the kick back over.
    const grid = resolveGrid(def, [
      { sourceId: "a", cells: ["kick@verse", "snare@verse"] },
      { sourceId: "b", cells: ["kick@verse"] },
    ]);
    const out = composeSongPatterns({
      def,
      lengthBars: 4,
      oak: [],
      sources: [
        {
          sourceId: "a",
          lessonId: "U01.L01",
          tracks: first.map((t) => ({ ...t, role: "drums" as const })),
          sections: null,
        },
        {
          sourceId: "b",
          lessonId: "U01.L03",
          tracks: later.map((t) => ({ ...t, role: "drums" as const })),
          sections: null,
        },
      ],
      grid,
    });
    expect(onsets(trackOf(out, "band.take.U01.L01.drums"), 0, 1).map((o) => o.value.s)).toEqual(["sd"]);
    expect(onsets(trackOf(out, "band.take.U01.L03.kick"), 0, 1).map((o) => o.value.s)).toEqual([
      "bd",
      "bd",
      "bd",
      "bd",
    ]);
  });

  test("a learner arrange() maps by section type", async () => {
    const def = songOf([
      ["intro", "intro", 4],
      ["verse", "verse", 4],
      ["chorus", "chorus", 4],
    ]);
    const code = [
      'const melVerse = note("<c4 d4>")',
      'const melChorus = note("<g4 a4>")',
      "mel: arrange([2, melVerse], [2, melChorus])",
    ].join("\n");
    const sections = sourceSectionsOf(code);
    expect(sections).toEqual([
      { type: "verse", startBar: 0, bars: 2 },
      { type: "chorus", startBar: 2, bars: 2 },
    ]);
    const oak = await collectTracks('mel: note("c5*2")');
    const learner = await collectTracks(code);
    const out = composeSongPatterns({
      def,
      lengthBars: 12,
      oak,
      sources: [
        {
          sourceId: "t9",
          lessonId: "U09.L02",
          tracks: learner.map((t) => ({ ...t, role: "melody" as const })),
          sections,
        },
      ],
      grid: resolveGrid(def, [{ sourceId: "t9", cells: ["lead@verse", "lead@chorus"] }]),
    });
    const take = onsets(trackOf(out, "band.take.U09.L02.mel"), 0, 12);
    // The song's verse plays the learner's verse twice, its chorus the learner's chorus twice.
    expect(take.map((o) => `${o.bar}:${o.value.note}`)).toEqual([
      "4:c4",
      "5:d4",
      "6:c4",
      "7:d4",
      "8:g4",
      "9:a4",
      "10:g4",
      "11:a4",
    ]);
    // The intro stays Oak's.
    expect(barsOf(onsets(trackOf(out, "band.oak.mel"), 0, 12))).toEqual(range(0, 4));
  });

  test("a numbered learner section fills the matching occurrence; the first fills the others", async () => {
    const def = songOf([
      ["chorus1", "chorus", 2],
      ["chorus2", "chorus", 2],
      ["chorus3", "chorus", 2],
    ]);
    const code = [
      'const melChorus = note("c4")',
      'const melChorus2 = note("e4")',
      "mel: arrange([1, melChorus], [1, melChorus2])",
    ].join("\n");
    const learner = await collectTracks(code);
    const out = composeSongPatterns({
      def,
      lengthBars: 6,
      oak: [],
      sources: [
        {
          sourceId: "t",
          lessonId: "U09.L03",
          tracks: learner.map((t) => ({ ...t, role: "melody" as const })),
          sections: sourceSectionsOf(code),
        },
      ],
      grid: resolveGrid(def, [{ sourceId: "t", cells: ["lead@chorus1", "lead@chorus2", "lead@chorus3"] }]),
    });
    expect(
      onsets(trackOf(out, "band.take.U09.L03.mel"), 0, 6).map((o) => `${o.bar}:${o.value.note}`),
    ).toEqual(["0:c4", "1:c4", "2:e4", "3:e4", "4:c4", "5:c4"]);
  });
});

describe("review s1a: what a source plays", () => {
  test("a numbered variant on one track survives another track repeating the plain section", async () => {
    const def = songOf([
      ["chorus1", "chorus", 4],
      ["chorus2", "chorus", 4],
    ]);
    const code = [
      'const drumsChorus = s("bd*4")',
      'const melChorus = note("c4")',
      'const melChorus2 = note("e4")',
      "drums: arrange([4, drumsChorus], [4, drumsChorus])",
      "mel: arrange([4, melChorus], [4, melChorus2])",
    ].join("\n");
    expect(sourceSectionsOf(code)).toEqual([
      { type: "chorus", startBar: 0, bars: 4 },
      { type: "chorus", startBar: 4, bars: 4, variant: 2 },
    ]);
    const learner = await collectTracks(code);
    const out = composeSongPatterns({
      def,
      lengthBars: 8,
      oak: [],
      sources: [
        {
          sourceId: "t",
          lessonId: "U09.L03",
          tracks: learner.map((t) => ({
            ...t,
            role: t.label === "drums" ? ("drums" as const) : ("melody" as const),
          })),
          sections: sourceSectionsOf(code),
        },
      ],
      grid: resolveGrid(def, [{ sourceId: "t", cells: ["lead@chorus1", "lead@chorus2"] }]),
    });
    const notes = onsets(trackOf(out, "band.take.U09.L03.mel"), 0, 8).map((o) => `${o.bar}:${o.value.note}`);
    expect(notes).toEqual(["0:c4", "1:c4", "2:c4", "3:c4", "4:e4", "5:e4", "6:e4", "7:e4"]);
  });

  test("a phrase with one two-note chord among single notes is a tune, not chords", async () => {
    const [keys] = await collectTracks('keys: note("[c4,e4] d4 e4 f4 g4 a4")');
    if (!keys) throw new Error("no track");
    const facts = trackFacts(keys.pattern, 1);
    expect(facts.chordShare).toBeCloseTo(1 / 6, 10);
    expect(roleOfTrack("keys", facts)).toBe("melody");
  });
});

// --- evaluation: the adapter's song path, in a headless repl like the editor's ----------------------------------

interface Harness {
  evaluate(code: string, band: SongBand | null, check?: SongCheck): Promise<Pattern>;
  session: EvalSession;
  cps(): number;
  setCps(cps: number): void;
  mutes: MuteMap;
}

function harness(): Harness {
  let pending: { band: SongBand; check?: SongCheck; code: string } | null = null;
  const h: Harness = {
    session: newSession(),
    mutes: { muted: new Set(), solo: null },
    async evaluate(code, band, check) {
      h.session = newSession();
      pending = band ? { band, code, ...(check ? { check } : {}) } : null;
      await repl.evaluate(code, false);
      if (h.session.error) throw h.session.error;
      return repl.state.pattern as Pattern;
    },
    cps: () => repl.scheduler.cps as number,
    setCps: (cps) => repl.setCps(cps),
  };
  const repl = core.repl({
    defaultOutput: () => {},
    getTime: () => 0,
    transpiler,
    beforeEval: async () => {
      installTrackWrapper(h.session, () => h.mutes);
      if (pending) {
        repl.setCps(pending.band.bpm / 60 / 4);
        const check = pending.check;
        await evaluateSongBand(h.session, pending.band, {
          liveCode: pending.code,
          ...(check ? { check } : {}),
        });
      }
    },
    editPattern: (pat: Pattern) => finalizePattern(pat, { session: h.session, mutes: () => h.mutes }),
    onEvalError: (err: unknown) => {
      h.session.error = err;
    },
  });
  return h;
}

const OAK_DRUMS = ['kick: s("bd*4")', 'snare: s("~ sd ~ sd")', 'hats: s("hh*4")'].join("\n");
const OAK_FULL = [OAK_DRUMS, 'bass: note("c2*2")', 'chords: note("[c3,e3,g3]")', 'mel: note("e4 g4")'].join(
  "\n",
);

function bandOf(def: UnitSongDef, over: Partial<SongBand> = {}): SongBand {
  return {
    def,
    flavour: "flavour.pop",
    bpm: 100,
    sources: [],
    grid: resolveGrid(def, []),
    ...over,
  } as SongBand;
}

describe("evaluateSongBand", () => {
  test("a source's setcpm does not change the tempo", async () => {
    const def = songOf([["verse", "verse", 4]], OAK_DRUMS);
    const h = harness();
    h.setCps(0.9);
    const band = bandOf(def, {
      sources: [{ sourceId: "t1", lessonId: "U01.L01", code: 'setcpm(200/4)\nsnare: s("sd*2")' }],
      grid: resolveGrid(def, [{ sourceId: "t1", cells: ["snare@verse"] }]),
    });
    const pattern = await h.evaluate('hats2: s("oh")', band);
    expect(h.cps()).toBeCloseTo(100 / 60 / 4, 10);
    // The source still plays its part.
    expect(onsets(pattern, 0, 1).filter((o) => o.track === "band.take.U01.L01.snare").length).toBe(2);
    // The learner's own setcpm still works after a song was evaluated.
    await h.evaluate('setcpm(120/4)\nhats2: s("oh")', band);
    expect(h.cps()).toBeCloseTo(0.5, 10);
  });

  test("the live Make plays in today's sections and takes what it plays from Oak", async () => {
    const def = songOf(
      [
        ["intro", "intro", 4],
        ["verse", "verse", 8],
      ],
      OAK_DRUMS,
    );
    const h = harness();
    const band = bandOf(def, {
      live: { sourceId: "live", sections: ["verse"], step: takeStep(["verse"], ["kick"]) },
    });
    const pattern = await h.evaluate('kick: s("bd*2")\nhats: s("hh*8")', band);
    const all = onsets(pattern, 0, 12);
    const at = (track: string) => barsOf(all.filter((o) => o.track === track));
    // The learner's kick and hats sound only in the verse (bars 4–11), restarting there.
    expect(at("kick")).toEqual(range(4, 12));
    expect(at("hats")).toEqual(range(4, 12));
    // Oak's kick (declared) and hats (played beyond the brief) are silent in the verse; its snare plays on.
    expect(at("band.oak.kick")).toEqual(range(0, 4));
    expect(at("band.oak.hats")).toEqual(range(0, 4));
    expect(at("band.oak.snare")).toEqual(range(0, 12));
    expect(h.session.band.map((b) => b.track)).toEqual(["band.oak.kick", "band.oak.snare", "band.oak.hats"]);
  });

  test("a take that plays chords takes Oak's pitched parts, except oakKeeps", async () => {
    const def = songOf([["verse", "verse", 4]], OAK_FULL);
    const h = harness();
    const band = bandOf(def, {
      live: { sourceId: "live", sections: "all", step: takeStep("all", ["chords"], ["lead"]) },
    });
    const pattern = await h.evaluate('keys: note("[c3,e3,g3] [f3,a3,c4]")', band);
    const tracks = new Set(onsets(pattern, 0, 4).map((o) => o.track));
    expect([...tracks].sort()).toEqual(
      ["band.oak.hats", "band.oak.kick", "band.oak.mel", "band.oak.snare", "keys"].sort(),
    );
  });

  test("a source that fails its check falls back to Oak", async () => {
    const def = songOf([["verse", "verse", 4]], OAK_DRUMS);
    const h = harness();
    const band = bandOf(def, {
      sources: [{ sourceId: "bad", lessonId: "U01.L01", code: 'kick: s("bd")' }],
      grid: resolveGrid(def, [{ sourceId: "bad", cells: ["kick@verse"] }]),
    });
    const pattern = await h.evaluate('hats2: s("oh")', band, (code) => !code.includes('s("bd")'));
    const tracks = new Set(onsets(pattern, 0, 4).map((o) => o.track));
    expect(tracks.has("band.oak.kick")).toBe(true);
    expect([...tracks].some((t) => t.startsWith("band.take."))).toBe(false);
  });

  test("a saved take is checked as the learner's own code, Oak's code as authored Band code", async () => {
    const ctx: LintContext = {
      profile: "content",
      unlocked: new Set(),
      allowPreview: false,
      meter: "4/4",
      key: null,
    };
    const check: SongCheck = (code, who) => lintOak(code, songLintContext(ctx, who), []).ok;
    // `$:` is the learner's to use; authored code names its tracks.
    const take = 'setcpm(100/4)\n$: s("bd*2")';
    expect(check(take, "oak")).toBe(false);
    expect(check(take, "source")).toBe(true);
    const def = songOf([["verse", "verse", 4]], OAK_DRUMS);
    const h = harness();
    const band = bandOf(def, {
      sources: [{ sourceId: "t1", lessonId: "U01.L01", code: take }],
      grid: resolveGrid(def, [{ sourceId: "t1", cells: ["kick@verse"] }]),
    });
    const pattern = await h.evaluate('hats2: s("oh")', band, check);
    const tracks = new Set(onsets(pattern, 0, 4).map((o) => o.track));
    expect(tracks.has("band.take.U01.L01.$0")).toBe(true);
    expect(tracks.has("band.oak.kick")).toBe(false);
  });

  test("a part the live Make brings in after a long intro is still its own", async () => {
    const def = songOf(
      [
        ["intro", "intro", 16],
        ["chorus", "chorus", 4],
      ],
      OAK_FULL,
    );
    const h = harness();
    const band = bandOf(def, {
      live: { sourceId: "live", sections: "all", step: takeStep("all", ["kick"]) },
    });
    const code = [
      'const kickIntro = s("bd*4")',
      'const kickChorus = s("bd*4")',
      'const melChorus = note("c5 e5")',
      "kick: arrange([16, kickIntro], [4, kickChorus])",
      "mel: arrange([16, silence], [4, melChorus])",
    ].join("\n");
    const pattern = await h.evaluate(code, band);
    const chorus = onsets(pattern, 16, 20);
    expect(chorus.some((o) => o.track === "mel")).toBe(true);
    // The learner's tune plays the chorus: Oak's does not play over it.
    expect(chorus.some((o) => o.track === "band.oak.mel")).toBe(false);
  });

  test("a label written twice plays only its last pattern, and claims only what that plays", async () => {
    const def = songOf([["verse", "verse", 4]], OAK_DRUMS);
    const h = harness();
    const band = bandOf(def, {
      live: { sourceId: "live", sections: ["verse"], step: takeStep(["verse"], ["snare"]) },
    });
    const pattern = await h.evaluate('drums: s("bd")\ndrums: s("~ sd")', band);
    const all = onsets(pattern, 0, 4);
    // Strudel replaces the first `drums:` with the second: only the snare plays, so Oak keeps its kick.
    expect(all.filter((o) => o.track === "band.oak.kick").length).toBeGreaterThan(0);
    expect(all.some((o) => o.track === "band.oak.snare")).toBe(false);
  });

  test("a source whose code does not run falls back to Oak", async () => {
    const def = songOf([["verse", "verse", 4]], OAK_DRUMS);
    const h = harness();
    const band = bandOf(def, {
      sources: [{ sourceId: "broken", lessonId: "U01.L01", code: "kick: s(" }],
      grid: resolveGrid(def, [{ sourceId: "broken", cells: ["kick@verse"] }]),
    });
    const pattern = await h.evaluate('hats2: s("oh")', band);
    expect(onsets(pattern, 0, 1).some((o) => o.track === "band.oak.kick")).toBe(true);
  });
});

describe("song helpers", () => {
  test("songFormView lists the sections with bars and the term-free labels it is given", () => {
    const def = songOf([
      ["intro", "intro", 4],
      ["verse", "verse", 8],
      ["stop", "break", 1],
      ["chorus1", "chorus", 8],
      ["chorus2", "chorus", 8],
    ]);
    expect(songLengthBars(def)).toBe(29);
    expect(
      songFormView(def, { intro: "Opening", verse: "A", stop: "Stop", chorus1: "B", chorus2: "B" }),
    ).toEqual([
      { label: "Opening", bars: 4 },
      { label: "A", bars: 8 },
      { label: "Stop", bars: 1 },
      { label: "B", bars: 8 },
      { label: "B", bars: 8 },
    ]);
    // Without a label, a section is the letter of its type's first appearance.
    expect(songFormView(def, {}).map((s) => s.label)).toEqual(["A", "B", "C", "D", "D"]);
  });

  test("songBandTracks names Oak's parts and the labels of every source that still owns a cell", () => {
    const def = songOf([["verse", "verse", 4]], OAK_DRUMS);
    const band = bandOf(def, {
      sources: [
        { sourceId: "a", lessonId: "U01.L01", code: '// my groove\ndrums: s("bd sd")\n$: s("hh*8")' },
        { sourceId: "gone", lessonId: "U01.L02", code: 'kick: s("bd")' },
      ],
      grid: resolveGrid(def, [
        { sourceId: "gone", cells: ["kick@verse"] },
        { sourceId: "a", cells: ["kick@verse", "snare@verse"] },
      ]),
    });
    expect(songBandTracks(band)).toEqual([
      "oak.hats",
      "oak.bass",
      "oak.chords",
      "oak.mel",
      "take.U01.L01.drums",
      "take.U01.L01.$0",
    ]);
  });

  test("a song band survives the JSON wire", () => {
    const def = songOf([["verse", "verse", 4]], OAK_DRUMS);
    const band = bandOf(def, { grid: resolveGrid(def, [{ sourceId: "a", cells: ["kick@verse"] }]) });
    const back = songBandFromWire(JSON.parse(JSON.stringify(songBandToWire(band))));
    expect([...back.grid]).toEqual([...band.grid] as [CellKey, string][]);
    expect(back.def.sections).toEqual(def.sections);
  });

  test("every path plays a song as a song and a plain Band through bandCodeFor", () => {
    const def = songOf([["verse", "verse", 4]], OAK_DRUMS);
    const setup: BandSetup = {
      band: "band.two-chord-vamp" as BandSetup["band"],
      flavour: "flavour.pop",
      code: 'drums: s("bd sd")\nbass: n("0").scale("{{key}}")',
      followsLearnerKey: false,
      tracks: ["drums"],
    };
    const ctx = { key: null, defaultBpm: 100, learnerCode: 'kick: s("bd")' };
    expect(prepareBandFor(setup, ctx)).toEqual({
      kind: "code",
      code: 'drums: s("bd sd")\nbass: n("0").scale("C4:major")',
      roles: ["drums"],
    });
    const song = bandOf(def);
    expect(prepareBandFor({ ...setup, song }, ctx)).toEqual({
      kind: "song",
      song,
      liveCode: 'kick: s("bd")',
    });
  });

  test("an export takes a song with any track labels, alone when it has no code of its own", () => {
    const def = songOf([["verse", "verse", 4]], OAK_DRUMS);
    const song = bandOf(def, { grid: resolveGrid(def, [{ sourceId: "a", cells: ["kick@verse"] }]) });
    const band: BandSetup = {
      band: "band.two-chord-vamp" as BandSetup["band"],
      flavour: "flavour.pop",
      code: "",
      followsLearnerKey: false,
      tracks: ["oak.kick", "take.U01.L01.drums"],
      song,
    };
    const request = validateRequest({ code: "", band });
    expect(request.code).toBe("silence");
    expect(request.band?.tracks).toEqual(["oak.kick", "take.U01.L01.drums"]);
    expect([...(request.band?.song?.grid ?? [])]).toEqual([...song.grid]);
    expect(request.band?.song?.grid).not.toBe(song.grid);
    expect(() =>
      validateRequest({ code: "", band: { ...band, song: undefined } as unknown as BandSetup }),
    ).toThrow(PieceRenderError);
    expect(() =>
      validateRequest({ code: "x", band: { ...band, song: { ...song, grid: [] } as unknown as SongBand } }),
    ).toThrow(PieceRenderError);
  });
});
