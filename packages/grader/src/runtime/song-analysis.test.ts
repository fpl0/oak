// The Workbench analysis of a unit song (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.2): the grader
// realm composes the song with the one composer (song/compose.ts, which the adapter re-exports), so the roll, the
// chord band and the staff show what plays. Also the Band's label filter (`bandTracks`), which replaces the
// Workbench's old line filter. In-process realm, no lockdown (as runtime.test.ts).
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { join } from "node:path";
import {
  type LessonDef,
  type LessonId,
  resolveGrid,
  type TakeStep,
  type UnitSongDef,
} from "@oak/content-kit";
import { U11_SONG } from "../../../../content/unit-songs/U11.ts";
import { type SongBand, songBandToWire, songLengthBars } from "../song/compose.ts";
import type { EvalSuccess, OakEvent } from "../types.ts";
import { evaluateForGrading, SONG_FUEL_PER_BAR } from "./analyze.ts";
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
  code: {
    "flavour.pop": OAK,
    "flavour.indie": OAK,
    "flavour.jazz-soul": OAK,
    "flavour.funk": OAK,
    "flavour.electronic": OAK,
  },
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

  test("a whole real song with every reference take fits the lesson work budget (U11, jazz-soul)", async () => {
    // F1 review: the lesson budget (1M fuel) was the learner's alone; U11 jazz-soul with its takes needs about 2.6M.
    const def = U11_SONG;
    const takes = def.plan.filter((s): s is TakeStep => s.kind === "take");
    const refs: { lesson: LessonId; code: string }[] = [];
    for (const step of takes) {
      const [unit, l] = step.lesson.split(".") as [string, string];
      const file = join(import.meta.dir, "../../../../content/core", unit, l, "lesson.ts");
      const lesson = ((await import(file)) as { default: LessonDef }).default;
      const exercise = lesson.steps.at(-1)?.exercise as
        | { tests?: { expect: string; response?: { code?: unknown } }[] }
        | undefined;
      const pass = exercise?.tests?.find((t) => t.expect === "pass" && typeof t.response?.code === "string");
      if (pass) refs.push({ lesson: step.lesson, code: pass.response?.code as string });
    }
    expect(refs.length).toBeGreaterThan(4);
    const saved = refs.slice(0, -1);
    const stepOf = (lesson: LessonId) => takes.find((s) => s.lesson === lesson) as TakeStep;
    const sectionsOf = (step: TakeStep) =>
      step.sections === "all" ? def.sections.map((x) => x.id) : [...step.sections];
    const grid = resolveGrid(
      def,
      saved.map((ref, i) => {
        const step = stepOf(ref.lesson);
        return {
          sourceId: String(i + 1),
          cells: sectionsOf(step).flatMap((sec) => step.parts.map((p) => `${p}@${sec}` as const)),
        };
      }),
    );
    const last = refs.at(-1) as { lesson: LessonId; code: string };
    const liveStep = stepOf(last.lesson);
    const band: SongBand = {
      def,
      flavour: "flavour.jazz-soul",
      bpm: def.bpm,
      sources: saved.map((ref, i) => ({ sourceId: String(i + 1), lessonId: ref.lesson, code: ref.code })),
      grid,
      live: { sourceId: "live", sections: sectionsOf(liveStep), step: liveStep },
    };
    const r = ok(
      await evaluateForGrading(last.code, {
        mode: "lesson",
        bars: songLengthBars(def),
        lint: null,
        meter: def.meter,
        song: songBandToWire(band),
      }),
    );
    expect(r.fuelUsed).toBeGreaterThan(1_000_000);
    expect(r.tracks.some((t) => t.startsWith("band.take.U11."))).toBe(true);
  });

  test("the song's allowance is per bar of its length, and a runaway pattern still runs out", async () => {
    const band: SongBand = {
      def: DEF,
      flavour: "flavour.pop",
      bpm: 100,
      sources: [],
      grid: resolveGrid(DEF, []),
    };
    const r = await evaluateForGrading('hats: s("hh*1000000")', {
      mode: "lesson",
      bars: 12,
      lint: null,
      song: songBandToWire(band),
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("too-much-work");
    // The lesson's 1M plus 60k for each of the song's 12 bars.
    expect(r.error.message).toContain(String(1_000_000 + SONG_FUEL_PER_BAR * 12));
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
