// The song loudness and balance harness (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md, contracts
// §5.11): every unit song in content/unit-songs/index.ts in every flavour, played as Oak plays it (Oak's whole song,
// no take; songs-render.ts composes it with song-compose.ts through the export's own path), rendered offline before
// the master limiter and measured as the Bands are measured (BS.1770 integrated loudness and sample peak, quality.ts):
//
//  - the whole song: integrated loudness, peak, each section's loudness (the loud parts are louder than the quiet
//    ones), and the share of energy under 120 Hz (a muddy or a missing bass);
//  - each take step with its lesson's reference answer as the live Make in its sections: the learner's tracks alone
//    against Oak's tracks alone there, in every flavour (the learner's part sits on top or level, never buried).
//
// Targets (sound-songs.json `targets`, calibrated on the Bands: the calibration test below measures every Band in every
// flavour on this sound pack exactly as wave5.pw.ts does): each song × flavour within ±2 LU of its flavour's Band median
// and never louder than that flavour's loudest Band; no peak at or over −1 dBFS; the flavours of one song within 3 LU of
// each other; the learner's part at most 3 LU under Oak's. The measured numbers are the checked budget
// (packages/strudel/sound-songs.json, `songs`): a later run more than BUDGET_LU away from them fails. A song with no
// budget yet (a new song) is recorded on its first run and held to the targets; `SONGS_RECORD=1` re-records every
// song run, `SONGS_CALIBRATE=1` re-measures the Bands.
//
// Run alone (ports 5600–5699 with a shift; never the standard ones while other stacks run):
//   OAK_E2E_SHIFT=500 bunx playwright test -c packages/strudel/e2e/playwright.config.ts \
//     packages/strudel/e2e/songs.pw.ts --project autoplay        [-g "usong.U03"] [SONGS_PAGES=4]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FlavourId, UnitSongDef } from "@oak/content-kit";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { bandCodeAt, bands } from "../../../content/bands/index.ts";
import { bandCodeFor } from "../src/band.ts";
import {
  FLAVOURS,
  LOUD_TYPES,
  layoutOf,
  QUIET_TYPES,
  SONGS,
  type SongWire,
  songBars,
  songWire,
  takesOf,
} from "./songs-fixtures.ts";
import type { Measured, RenderInput, WindowsResult } from "./songs-host.ts";

const RESULTS = resolve(import.meta.dirname, "../sound-songs.json");
const RECORD = process.env.SONGS_RECORD === "1";
const CALIBRATE = process.env.SONGS_CALIBRATE === "1";
/** Pages rendering side by side (each its own renderer process): offline rendering is CPU-bound. */
const PAGES = Math.max(1, Number(process.env.SONGS_PAGES ?? 4));
/** The whole song at the app's rate (peaks need it); takes at half (loudness reads within 0.1 LU of 44.1 kHz). */
const SONG_RATE = 44100;
const TAKE_RATE = 22050;

// --- the rule -------------------------------------------------------------------------------------------------
/** The aim: each song × flavour within this many LU of its flavour's Band median (reported as `aim`). */
const AIM_LU = 2;
/**
 * The rule: never louder than the aim's top or the flavour's loudest Band, never more than FLOOR_LU under its quietest
 * Band. The Bands play drums, bass and chords only; a song carries a tune and leaves room for the learner's, so where
 * the learner rule needs it a song sits under the Bands (and the 808 Bands read loud: songs-render.ts's note).
 */
const FLOOR_LU = 2;
/** Sample peak before the limiter stays under this (dBFS). */
const MAX_PEAK_DB = -1;
/** The flavours of one song within this many LU of each other. */
const FLAVOUR_SPREAD_LU = 3;
/** The learner's tracks at most this many LU under Oak's, in the take's sections. */
const LEARNER_UNDER_LU = 3;
/** The loud parts (chorus, lift, drive) at least this many LU over the quiet parts (intro, verse, bridge…) on average. */
const CONTRAST_LU = 1;
/**
 * Energy under 120 Hz against the flavour's Bands' median share: a song carries a tune the Bands do not, so its share
 * sits under theirs; under a third of it the bass is missing, over 1.15 times it the low end is mud.
 */
const LOW_SHARE = { min: 1 / 3, max: 1.15 } as const;
/** A later run against the recorded budget: loudness and takes within BUDGET_LU, peaks within BUDGET_PEAK_DB. */
const BUDGET_LU = 1;
const BUDGET_PEAK_DB = 1.5;

const RULE =
  "each unit song × flavour, Oak's whole song with no take, offline before the master limiter: integrated loudness never over min(its flavour's Band median + 2 LU, that flavour's loudest Band) and never more than 2 LU under that flavour's quietest Band (the Bands measured on this pack by the calibration test as sound-wave5.json measures them: one bar at 96 BPM; the aim, ±2 LU of the median, is reported per song); sample peak under −1 dBFS; the song's flavours within 3 LU of each other; the loud parts (chorus, lift, drive) at least 1 LU over the quiet parts (intro, verse, bridge, vamp, of 4 bars or more) on average; energy under 120 Hz between a third of and 1.15 times the flavour's Bands' median share; each take step's reference answer, as the live Make in its sections: the learner's tracks alone at most 3 LU under Oak's tracks alone there, in every flavour. Budget: later runs within 1 LU (loudness, takes) and 1.5 dB (peaks) of the numbers recorded here.";

// --- the budget file ------------------------------------------------------------------------------------------
interface FlavourRow extends Measured {
  sections: Record<string, number>;
  /** Loud parts' mean loudness minus the quiet parts' (intro, verse, bridge…, of 4 bars or more). */
  contrastLu: number;
  /** Within the aim (±2 LU of the flavour's Band median). */
  aim?: boolean;
}
interface TakeRow {
  sections: string[];
  parts: string[];
  /** The learner's tracks alone in the take's sections. */
  learner: number | null;
  /** Oak's tracks alone there, per flavour. */
  oak: Record<string, number | null>;
  /** learner − oak, per flavour. */
  diff: Record<string, number | null>;
}
interface SongRow {
  title: string;
  bars: number;
  flavours: Record<string, FlavourRow>;
  spreadLu: number;
  takes: Record<string, TakeRow>;
}
interface BandStats {
  median: number;
  min: number;
  max: number;
  n: number;
  lowPctMedian: number;
}
interface Targets {
  /** The rule's window (LUFS). */
  floor: number;
  ceiling: number;
  /** The aim: ±2 LU of the Band median. */
  aimLow: number;
  aimHigh: number;
  /** Energy under 120 Hz, percent. */
  lowPct: { min: number; max: number };
}
function targetsOf(stats: BandStats): Targets {
  return {
    floor: r1(stats.min - FLOOR_LU),
    ceiling: r1(Math.min(stats.median + AIM_LU, stats.max)),
    aimLow: r1(stats.median - AIM_LU),
    aimHigh: r1(Math.min(stats.median + AIM_LU, stats.max)),
    lowPct: { min: r1(stats.lowPctMedian * LOW_SHARE.min), max: r1(stats.lowPctMedian * LOW_SHARE.max) },
  };
}
interface Budget {
  generatedBy: string;
  rule: string;
  bands?: { rule: string; perFlavour: Record<string, BandStats>; mixes: unknown[] };
  targets?: Record<string, Targets>;
  songs: Record<string, SongRow>;
}

function readBudget(): Budget {
  try {
    return JSON.parse(readFileSync(RESULTS, "utf8")) as Budget;
  } catch {
    return { generatedBy: "packages/strudel/e2e/songs.pw.ts", rule: RULE, songs: {} };
  }
}
function writeBudget(update: (b: Budget) => void): void {
  const b = readBudget();
  update(b);
  if (b.bands)
    b.targets = Object.fromEntries(Object.entries(b.bands.perFlavour).map(([f, x]) => [f, targetsOf(x)]));
  b.generatedBy = "packages/strudel/e2e/songs.pw.ts";
  b.rule = RULE;
  const songs = Object.fromEntries(Object.entries(b.songs).sort(([x], [y]) => x.localeCompare(y)));
  const ordered = {
    generatedBy: b.generatedBy,
    rule: b.rule,
    ...(b.targets ? { targets: b.targets } : {}),
    songs,
    ...(b.bands ? { bands: b.bands } : {}),
  };
  writeFileSync(RESULTS, `${JSON.stringify(ordered, null, 2)}\n`);
}

// --- pages ----------------------------------------------------------------------------------------------------
async function open(page: Page): Promise<Page> {
  await page.routeWebSocket(/.*/, () => {});
  await page.goto("/songs.html");
  await page.waitForFunction(() => window.__songs?.ready === true);
  return page;
}

/** Runs jobs on a pool of pages, at most one at a time per page, results in job order. */
async function onPool<T>(
  page: Page,
  context: BrowserContext,
  jobs: readonly ((p: Page) => Promise<T>)[],
): Promise<T[]> {
  const extra = await Promise.all(
    Array.from({ length: Math.min(PAGES, jobs.length) - 1 }, async () => open(await context.newPage())),
  );
  const pool = [await open(page), ...extra];
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    pool.map(async (p) => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await (jobs[i] as (p: Page) => Promise<T>)(p);
      }
    }),
  );
  await Promise.all(extra.map((p) => p.close()));
  return out;
}

function renderWindows(
  p: Page,
  input: RenderInput,
  wins: readonly (readonly [number, number])[],
  spans: Record<string, readonly [number, number]> = {},
): Promise<WindowsResult> {
  return p.evaluate(([input, wins, spans]) => window.__songs.windows(input, wins, spans), [
    input,
    wins,
    spans,
  ] as const);
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const finite = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);
const orNull = (x: number): number | null => (Number.isFinite(x) ? x : null);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};

// --- calibration: the Bands on this pack ------------------------------------------------------------------------
/** The key a Band is heard in (wave5.pw.ts): a minor Band in A minor, the rest in C major. */
const keyOfBand = (id: string) =>
  /aeolian|minor|andalusian|ballad/.test(id) ? { tonic: "A", mode: "minor" } : { tonic: "C", mode: "major" };
const bodyOf = (line: string) => line.replace(/^[A-Za-z_$][\w$]*:\s*/, "");

test("calibration: every Band in every flavour on this sound pack, one bar at 96 BPM as sound-wave5.json reads them", async ({
  page,
  context,
}) => {
  test.skip(
    !CALIBRATE && readBudget().bands !== undefined,
    "calibrated: SONGS_CALIBRATE=1 re-measures the Bands",
  );
  test.setTimeout(900_000);
  const mixes = bands.flatMap((b) =>
    FLAVOURS.map((f) => {
      const key = keyOfBand(b.id);
      const raw = bandCodeAt(b, f as never, () => true).replaceAll("{{key}}", `${key.tonic}4:${key.mode}`);
      const code = bandCodeFor(
        { band: b.id, flavour: f, code: raw, followsLearnerKey: false, tracks: ["drums", "bass", "chords"] },
        { key: key as never, defaultBpm: 96, learnerCode: "" },
      );
      const consts = code.split("\n").filter((l) => /^const /.test(l));
      const lines = code.split("\n").filter((l) => /^(drums|bass|chords):/.test(l));
      const pre = consts.length > 0 ? `${consts.join("\n")}\n` : "";
      return {
        band: b.id,
        flavour: f,
        meter: b.id === "band.waltz-vamp" ? 3 : 4,
        all: `${pre}stack(${lines.map(bodyOf).join(", ")})`,
      };
    }),
  );
  const measured = await onPool(
    page,
    context,
    mixes.map(
      (m) => (p: Page) =>
        p.evaluate(([code, cps]) => window.__songs.phrase(code, cps), [m.all, 96 / 60 / m.meter] as const),
    ),
  );
  const rows = mixes.map((m, i) => ({ band: m.band, flavour: m.flavour, ...(measured[i] as Measured) }));
  const perFlavour: Record<string, BandStats> = {};
  const targets: NonNullable<Budget["targets"]> = {};
  for (const f of FLAVOURS) {
    const of = rows.filter((r) => r.flavour === f && finite(r.lufs));
    const l = of.map((r) => r.lufs);
    const stats = {
      median: r1(median(l)),
      min: Math.min(...l),
      max: Math.max(...l),
      n: l.length,
      lowPctMedian: r1(median(of.map((r) => r.lowPct))),
    };
    perFlavour[f] = stats;
    targets[f] = targetsOf(stats);
  }
  writeBudget((b) => {
    b.bands = {
      rule: "every Band (content/bands) in every flavour, every stage unlocked, in C major (a minor Band in A minor): one bar at 96 BPM (a waltz in 3), rendered offline through render.html before the master limiter, as wave5.pw.ts measures sound-wave5.json's Bands; mix loudness (LUFS), peak (dBFS) and energy under 120 Hz (%)",
      perFlavour,
      mixes: rows,
    };
    b.targets = targets;
  });
  console.log("[songs bands]", JSON.stringify(perFlavour));
  expect(rows.filter((r) => !finite(r.lufs))).toEqual([]);
});

// --- the songs ------------------------------------------------------------------------------------------------
async function measureSong(page: Page, context: BrowserContext, def: UnitSongDef): Promise<SongRow> {
  const layout = layoutOf(def);
  const bars = songBars(def);
  const spans = Object.fromEntries(layout.map((s) => [s.id, [s.fromBar, s.toBar] as const]));
  const takes = (await takesOf(def)).filter((t) => t.code !== null);
  type Job = (p: Page) => Promise<WindowsResult>;
  const base = (
    flavour: FlavourId,
    live?: (typeof takes)[number],
  ): Omit<RenderInput, "raw" | "sampleRate"> => ({
    song: songWire(def, flavour, live?.step) as SongWire as never,
    code: live?.code ?? "",
    muted: [],
    leadBars: 1,
  });
  const songJobs: Job[] = FLAVOURS.map(
    (f) => (p) => renderWindows(p, { ...base(f), raw: true, sampleRate: SONG_RATE }, [[0, bars]], spans),
  );
  const learnerJobs: Job[] = takes.map(
    (t) => (p) =>
      renderWindows(
        p,
        { ...base(FLAVOURS[0] as FlavourId, t), mute: "oak", raw: true, sampleRate: TAKE_RATE },
        t.windows,
      ),
  );
  const oakJobs: Job[] = takes.flatMap((t) =>
    FLAVOURS.map(
      (f) => (p: Page) =>
        renderWindows(p, { ...base(f, t), mute: "learner", raw: true, sampleRate: TAKE_RATE }, t.windows),
    ),
  );
  const all = await onPool(page, context, [...songJobs, ...learnerJobs, ...oakJobs]);
  const songs = all.slice(0, songJobs.length);
  const learners = all.slice(songJobs.length, songJobs.length + learnerJobs.length);
  const oaks = all.slice(songJobs.length + learnerJobs.length);

  const flavours: Record<string, FlavourRow> = {};
  FLAVOURS.forEach((f, i) => {
    const r = songs[i] as WindowsResult;
    const sections = Object.fromEntries(layout.map((s) => [s.id, r.spans[s.id]?.lufs ?? Number.NaN]));
    const loud = layout.filter((s) => LOUD_TYPES.has(s.type)).map((s) => sections[s.id] as number);
    const quiet = layout
      .filter((s) => QUIET_TYPES.has(s.type) && s.toBar - s.fromBar >= 4)
      .map((s) => sections[s.id] as number)
      .filter(finite);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    flavours[f] = {
      lufs: r.lufs,
      peakDb: r.peakDb,
      lowPct: r.lowPct,
      ungated: r.ungated,
      seconds: r.seconds,
      sections,
      contrastLu: loud.length && quiet.length ? r1(mean(loud) - mean(quiet)) : Number.NaN,
    };
    if (r.missing.length) throw new Error(`${def.id} ${f}: sounds not found: ${r.missing.join(", ")}`);
  });
  const levels = Object.values(flavours).map((x) => x.lufs);
  const out: SongRow = {
    title: def.title,
    bars,
    flavours,
    spreadLu: r1(Math.max(...levels) - Math.min(...levels)),
    takes: {},
  };
  takes.forEach((t, i) => {
    const learner = orNull((learners[i] as WindowsResult).lufs);
    const oak: Record<string, number | null> = {};
    const diff: Record<string, number | null> = {};
    FLAVOURS.forEach((f, j) => {
      const o = orNull((oaks[i * FLAVOURS.length + j] as WindowsResult).lufs);
      oak[f] = o;
      diff[f] = learner !== null && o !== null ? r1(learner - o) : null;
    });
    out.takes[t.lesson] = {
      sections: t.step.sections === "all" ? ["all"] : [...t.step.sections],
      parts: [...t.step.parts],
      learner,
      oak,
      diff,
    };
  });
  return out;
}

/** What breaks the rule (targets) and what moved from the budget. */
function problemsOf(id: string, row: SongRow, budget: Budget): string[] {
  const out: string[] = [];
  for (const [f, x] of Object.entries(row.flavours)) {
    const stats = budget.bands?.perFlavour[f];
    const t = stats ? targetsOf(stats) : null;
    const at = `${id} ${f.replace("flavour.", "")}`;
    if (t && !(x.lufs >= t.floor && x.lufs <= t.ceiling))
      out.push(`${at}: ${x.lufs} LUFS, rule ${t.floor} to ${t.ceiling}`);
    if (!(x.peakDb < MAX_PEAK_DB)) out.push(`${at}: peak ${x.peakDb} dBFS (under ${MAX_PEAK_DB})`);
    if (Number.isFinite(x.contrastLu) && x.contrastLu < CONTRAST_LU)
      out.push(`${at}: loud parts ${x.contrastLu} LU over the rest (≥ ${CONTRAST_LU})`);
    if (t && !(x.lowPct >= t.lowPct.min && x.lowPct <= t.lowPct.max))
      out.push(`${at}: ${x.lowPct} % of the energy under 120 Hz (${t.lowPct.min}–${t.lowPct.max})`);
  }
  if (!(row.spreadLu <= FLAVOUR_SPREAD_LU))
    out.push(`${id}: flavours ${row.spreadLu} LU apart (≤ ${FLAVOUR_SPREAD_LU})`);
  for (const [lesson, t] of Object.entries(row.takes))
    for (const [f, d] of Object.entries(t.diff))
      if (d === null || d < -LEARNER_UNDER_LU)
        out.push(
          `${id} ${lesson} ${f.replace("flavour.", "")}: the learner's part ${d} LU against Oak's (≥ −${LEARNER_UNDER_LU})`,
        );
  // The budget: a song recorded before is held to its numbers.
  const was = budget.songs[id];
  if (was && !RECORD) {
    for (const [f, x] of Object.entries(row.flavours)) {
      const w = was.flavours[f];
      if (!w) continue;
      if (Math.abs(x.lufs - w.lufs) > BUDGET_LU)
        out.push(`${id} ${f}: ${x.lufs} LUFS, budget ${w.lufs} ± ${BUDGET_LU}`);
      if (x.peakDb > w.peakDb + BUDGET_PEAK_DB)
        out.push(`${id} ${f}: peak ${x.peakDb}, budget ${w.peakDb} + ${BUDGET_PEAK_DB}`);
    }
    for (const [lesson, t] of Object.entries(row.takes))
      for (const [f, d] of Object.entries(t.diff)) {
        const w = was.takes[lesson]?.diff[f];
        if (finite(w) && finite(d) && Math.abs(d - w) > BUDGET_LU)
          out.push(`${id} ${lesson} ${f}: learner ${d} LU against Oak, budget ${w} ± ${BUDGET_LU}`);
      }
  }
  return out;
}

for (const def of SONGS) {
  test(`${def.id} "${def.title}": as loud as its flavours' Bands, no clipping, loud parts louder, the learner's part on top`, async ({
    page,
    context,
  }) => {
    test.setTimeout(900_000);
    const budget = readBudget();
    expect(budget.bands, "no Band calibration: run with SONGS_CALIBRATE=1").toBeDefined();
    const row = await measureSong(page, context, def);
    for (const [f, x] of Object.entries(row.flavours)) {
      const stats = budget.bands?.perFlavour[f];
      if (stats) x.aim = x.lufs >= targetsOf(stats).aimLow && x.lufs <= targetsOf(stats).aimHigh;
    }
    console.log(`[songs ${def.id}]`, JSON.stringify({ spread: row.spreadLu, flavours: row.flavours }));
    console.log(`[songs ${def.id} takes]`, JSON.stringify(row.takes));
    const problems = problemsOf(def.id, row, budget);
    if (RECORD || !budget.songs[def.id])
      writeBudget((b) => {
        b.songs[def.id] = row;
      });
    expect(problems).toEqual([]);
  });
}

// --- a diagnostic, not a check: each of Oak's parts alone, per section (SONGS_PARTS=1) --------------------------
// Prints, per song and flavour, each part's loudness alone over the whole song and in each section: what a gain
// change moves. `SONGS_ONLY=U01,U02` limits it; `SONGS_PARTS_OUT=<file>` also writes the table there as JSON.
test("diagnostic: each of Oak's parts alone, per song, flavour and section (SONGS_PARTS=1)", async ({
  page,
  context,
}) => {
  test.skip(process.env.SONGS_PARTS !== "1", "a diagnostic: SONGS_PARTS=1 runs it");
  test.setTimeout(3_600_000);
  const only = process.env.SONGS_ONLY?.split(",");
  type PartRow = {
    all: number;
    allU: number;
    sections: Record<string, number>;
    sectionsU: Record<string, number>;
  };
  const out: Record<string, Record<string, Record<string, PartRow>>> = {};
  for (const def of SONGS) {
    if (only && !only.includes(def.unit)) continue;
    const bars = songBars(def);
    const spans = Object.fromEntries(layoutOf(def).map((s) => [s.id, [s.fromBar, s.toBar] as const]));
    const labels = def.parts.map((p) => p.label);
    const jobs = FLAVOURS.flatMap((f) =>
      labels.map(
        (label) => (p: Page) =>
          renderWindows(
            p,
            {
              song: songWire(def, f) as never,
              code: "",
              muted: labels.filter((l) => l !== label).map((l) => `band.oak.${l}`),
              leadBars: 1,
              raw: true,
              sampleRate: TAKE_RATE,
            },
            [[0, bars]],
            spans,
          ),
      ),
    );
    const r = await onPool(page, context, jobs);
    const table: Record<string, Record<string, PartRow>> = {};
    FLAVOURS.forEach((f, i) => {
      table[f] = Object.fromEntries(
        labels.map((l, j) => {
          const x = r[i * labels.length + j] as WindowsResult;
          return [
            l,
            {
              all: x.lufs,
              allU: x.ungated,
              sections: Object.fromEntries(Object.entries(x.spans).map(([k, v]) => [k, v.lufs])),
              sectionsU: Object.fromEntries(Object.entries(x.spans).map(([k, v]) => [k, v.ungated])),
            },
          ];
        }),
      );
    });
    out[def.id] = table;
    console.log(
      `[songs parts ${def.id}]`,
      JSON.stringify(
        Object.fromEntries(
          Object.entries(table).map(([f, t]) => [
            f,
            Object.fromEntries(Object.entries(t).map(([l, v]) => [l, v.all])),
          ]),
        ),
      ),
    );
  }
  if (process.env.SONGS_PARTS_OUT)
    writeFileSync(process.env.SONGS_PARTS_OUT, `${JSON.stringify(out, null, 1)}\n`);
});
