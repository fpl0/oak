// Wave 6 sound (the build:sound task; docs/design/wave6.md §1): the seventh chords of U12 on the electric piano,
// the organ, the guitars and the pad (each quality told from its neighbour, every voicing balanced), ghost notes
// and accents with `.velocity()` on every kit and comping sound, every tool U12–U17 unlock heard in its lesson's own
// loop, the sounds U12–U17 unlock in tune where the lessons play them, the Bands of the compound meters, the modes
// and the chromatic units as mixes, a Band that follows the lift without a click at the change, the early-jazz
// backing of the three CF-T standards, and a two-minute CF-A single with a bridge and a lift that plays without a
// dropout and with CPU headroom. Offline renders run through the production prebake on the locked pack (port
// 5192). Results are written to packages/strudel/sound-wave6.json (committed).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { bandCodeAt } from "../../../content/bands/index.ts";
import { METERS } from "../../theory/src/index.ts";
import { W6_LESSON_CASES } from "../src/audibility/cases.ts";
import { bandCodeFor } from "../src/band.ts";
import { earlyJazzBacking } from "../src/early-jazz.ts";
import { openPage } from "./helpers.ts";
import { FLAVOURS, WAVE6_BANDS } from "./wave6-bands.ts";
import {
  BACKBEAT_AT,
  bankOf,
  CFA_BARS,
  CFA_BPM,
  CFA_FIRST_IN,
  CFT_BPM,
  CFT_CHANGES,
  cfaArrangement,
  cfaStart,
  GHOST_AT,
  GHOST_CPS,
  ghostGroove,
  HALF_STEP_PAIRS,
  KITS,
  SEVENTH_SOUNDS,
  SEVENTH_SUFFIXES,
  SEVENTH_VOICINGS,
  VELOCITY_SOUNDS,
  W6_TUNING,
} from "./wave6-fixtures.ts";

// biome-ignore lint/suspicious/noExplicitAny: the test API is driven untyped from page.evaluate
type W = Window & { __oak: any };

const RESULTS = resolve(import.meta.dirname, "../sound-wave6.json");
/** Each test writes its own section of sound-wave6.json (tests run one at a time, workers: 1). */
function record(section: string, value: unknown): void {
  let table: Record<string, unknown> = {};
  try {
    table = JSON.parse(readFileSync(RESULTS, "utf8")) as Record<string, unknown>;
  } catch {
    table = {};
  }
  table.generatedBy = "packages/strudel/e2e/wave6.pw.ts";
  table[section] = value;
  const ordered = Object.fromEntries(
    Object.entries(table).sort(([a], [b]) =>
      a === "generatedBy" ? -1 : b === "generatedBy" ? 1 : a.localeCompare(b),
    ),
  );
  writeFileSync(RESULTS, `${JSON.stringify(ordered, null, 2)}\n`);
}

/** Blocks Vite's HMR socket: another engineer's edit must not reload the page under a spec (wave5.md §9). */
async function open(page: Page, errors: string[] = []): Promise<string[]> {
  await page.routeWebSocket(/.*/, () => {});
  return openPage(page, errors);
}

/** A labelled line's body (`drums: s(…)` → `s(…)`), for the render frame, which takes one expression. */
const bodyOf = (line: string) => line.replace(/^[A-Za-z_$][\w$]*:\s*/, "");
/** Labelled code as one stackable expression: its consts first, then `stack(<every track>)`. */
function asExpression(code: string, only?: readonly string[]): string {
  const lines = code.split("\n").filter((l) => !/^setcp[ms]\(/.test(l));
  const consts = lines.filter((l) => l.startsWith("const "));
  const tracks = lines
    .filter((l) => !l.startsWith("const ") && /^[A-Za-z_$][\w$]*:/.test(l))
    .filter((l) => !only || only.includes(l.slice(0, l.indexOf(":"))))
    .map(bodyOf);
  return `${consts.join("\n")}${consts.length ? "\n" : ""}stack(${tracks.join(",\n")})`;
}

/** Tolerances as the earlier sound specs: ±10 c tuning; parts of a mix within 10 LU. */
const MAX_CENTS = 10;
const MAX_PART_SPREAD_LU = 10;

test("U12 sevenths: each quality is told from its neighbour on every comping sound, in every voicing, at one loudness", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page);
  const cases = SEVENTH_SOUNDS.flatMap((sound) =>
    SEVENTH_VOICINGS.map((v) => ({
      sound,
      voicing: v.id,
      codes: SEVENTH_SUFFIXES.map((q) => `${v.code(q)}.s("${sound}")`),
      // The five qualities struck in turn, half a second each: the phrase the loudness is matched on.
      phrase: `seq(${SEVENTH_SUFFIXES.map((q) => v.code(q)).join(", ")}).s("${sound}")`,
    })),
  );
  const r = await page.evaluate(
    async ([cases, suffixes, pairs]) => {
      const w = (window as unknown as W).__oak;
      const q = w.quality;
      const a = w.analysis;
      type St = { left: Float32Array; right: Float32Array };
      const energy = (x: St) => {
        let s = 0;
        for (let i = 0; i < x.left.length; i++) s += (x.left[i] as number) ** 2 + (x.right[i] as number) ** 2;
        return s;
      };
      const diff = (x: St, y: St) => {
        let s = 0;
        for (let i = 0; i < x.left.length; i++)
          s +=
            ((x.left[i] as number) - (y.left[i] as number)) ** 2 +
            ((x.right[i] as number) - (y.right[i] as number)) ** 2;
        return s;
      };
      const out = [];
      for (const c of cases) {
        // One chord held for a second, as a comping hit rings.
        const renders: St[] = [];
        for (const code of c.codes) renders.push(await q.render(code, 1, 1));
        const lufs = renders.map((x) => a.round(a.loudness(x, 44100), 1));
        const peak = renders.map((x) => a.round(a.peakDb(x), 1));
        const pairDb: Record<string, number> = {};
        const pairLu: Record<string, number> = {};
        for (const [p, n] of pairs) {
          const [i, j] = [suffixes.indexOf(p), suffixes.indexOf(n)];
          const [x, y] = [renders[i] as St, renders[j] as St];
          // The changed voice against the whole chord: what is left when one quality is taken from its neighbour.
          pairDb[`${p}|${n}`] = a.round(10 * Math.log10(diff(x, y) / Math.max(energy(x), energy(y))), 1);
          pairLu[`${p}|${n}`] = a.round(Math.abs((lufs[i] as number) - (lufs[j] as number)), 1);
        }
        // The phrase: five chords of half a second (cps 0.4 over five slots).
        const phrase = await q.phraseLoudness(c.phrase, 0.4);
        out.push({
          sound: c.sound,
          voicing: c.voicing,
          lufs,
          peak,
          pairDb,
          pairLu,
          phraseLufs: phrase.lufs,
          phrasePeak: phrase.peakDb,
        });
      }
      return out;
    },
    [cases, SEVENTH_SUFFIXES, HALF_STEP_PAIRS] as const,
  );
  record("sevenths", {
    rule: "per sound and voicing (default dictionary, close stack from C3, left hand): two qualities a half step apart in one voice differ by more than −12 dB of the chord and sit within 3 LU of each other (an ear step compares them by their notes, not their level); the five qualities struck in turn (half a second each) within ±3 LU of the piano's phrase in the same voicing (±5 LU for the close stack from C3, low in every instrument's range); no peak at 0 dBFS. (A chord held alone for a second is not matched across sounds: the piano's E4–G4 samples decay 4–6 LU under its C4, so a held piano chord reads quieter than its phrase.)",
    qualities: SEVENTH_SUFFIXES,
    rows: r,
  });
  const problems: string[] = [];
  for (const row of r) {
    for (const [pair, d] of Object.entries(row.pairDb))
      if (!((d as number) > -12)) problems.push(`${row.sound} ${row.voicing} ${pair}: ${d} dB`);
    for (const [pair, lu] of Object.entries(row.pairLu))
      if ((lu as number) > 3) problems.push(`${row.sound} ${row.voicing} ${pair}: ${lu} LU apart`);
    if (Math.max(...row.peak, row.phrasePeak) >= 0) problems.push(`${row.sound} ${row.voicing} clips`);
    const piano = r.find((x) => x.sound === "piano" && x.voicing === row.voicing);
    // The close stack from C3 sits low, where the Rhodes is soft and the jazz guitar full (a single C3 measures
    // −30 and −28 LUFS against the piano's −28): matched to 5 LU there, to 3 in the voicings U12 comps with.
    const within = row.voicing === "close" ? 5 : 3;
    if (piano && Math.abs(row.phraseLufs - piano.phraseLufs) > within)
      problems.push(`${row.sound} ${row.voicing}: ${row.phraseLufs} LUFS vs piano ${piano.phraseLufs}`);
  }
  expect(problems).toEqual([]);
});

test("U13 ghost notes: .velocity() is one mapping on every kit and comping sound; a ghost is heard in the groove and stays soft", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page);
  const drums = KITS.flatMap((k) =>
    ["sd", "hh", "bd"].map((role) => ({ id: `${k.id} ${role}`, code: `s("${role}")${bankOf(k.bank)}` })),
  );
  const pitched = VELOCITY_SOUNDS.map((s) => ({
    id: s,
    code: `note("${["ebass", "fingerbass", "upright"].includes(s) ? "c2" : "c4"}").s("${s}")`,
  }));
  const grooves = KITS.map((k) => ({
    kit: k.id,
    without: ghostGroove(k.bank, 0),
    ghost3: ghostGroove(k.bank, 0.3),
    ghost4: ghostGroove(k.bank, 0.4),
  }));
  const r = await page.evaluate(
    async ([sources, grooves, cps, ghostAt, backbeatAt]) => {
      const w = (window as unknown as W).__oak;
      const q = w.quality;
      const a = w.analysis;
      type St = { left: Float32Array; right: Float32Array };
      const fs = 44100;
      const energy = (x: St, from = 0, to = Number.POSITIVE_INFINITY) => {
        let s = 0;
        const end = Math.min(x.left.length, Math.floor(to * fs));
        for (let i = Math.max(0, Math.floor(from * fs)); i < end; i++)
          s += (x.left[i] as number) ** 2 + (x.right[i] as number) ** 2;
        return s;
      };
      const sub = (x: St, y: St): St => ({
        left: x.left.map((v, i) => v - (y.left[i] as number)),
        right: x.right.map((v, i) => v - (y.right[i] as number)),
      });
      const mapping = [];
      for (const s of sources) {
        const full = await q.render(s.code, 1, 2);
        const row: Record<string, unknown> = { id: s.id };
        for (const v of [0.4, 0.3]) {
          const soft = await q.render(`${s.code}.velocity(${v})`, 1, 2);
          row[`v${v}`] = a.round(10 * Math.log10(energy(soft) / energy(full)), 2);
        }
        mapping.push(row);
      }
      const inGroove = [];
      const step = 1 / cps / 16;
      const win = 0.06;
      for (const g of grooves) {
        const base: St = await q.render(g.without, 1, cps);
        const row: Record<string, unknown> = { kit: g.kit };
        for (const [name, code] of [
          ["0.3", g.ghost3],
          ["0.4", g.ghost4],
        ] as const) {
          const withGhost: St = await q.render(code, 1, cps);
          // What the ghost notes add, alone: the groove with them minus the groove without.
          const ghosts = sub(withGhost, base);
          // Each ghost against everything else sounding in its own 60 ms (hats, kick, bass, Rhodes).
          const overMix = ghostAt.map((k: number) =>
            a.round(
              10 *
                Math.log10(energy(ghosts, k * step, k * step + win) / energy(base, k * step, k * step + win)),
              1,
            ),
          );
          // Each ghost against the backbeat snare (the accent), by the snare's own energy in the same window length.
          const snare = await q.render(code.split("\n")[1]?.replace(/,$/, "") ?? "silence", 1, cps);
          const accent = Math.max(...backbeatAt.map((k: number) => energy(snare, k * step, k * step + win)));
          const underAccent = ghostAt.map((k: number) =>
            a.round(10 * Math.log10(energy(ghosts, k * step, k * step + win) / accent), 1),
          );
          row[name] = {
            diffDb: a.round(10 * Math.log10(energy(ghosts) / energy(base)), 1),
            overMixDb: overMix,
            underAccentDb: underAccent,
            peakDb: a.round(a.peakDb(withGhost), 1),
          };
        }
        inGroove.push(row);
      }
      return { mapping, inGroove };
    },
    [[...drums, ...pitched], grooves, GHOST_CPS, GHOST_AT, BACKBEAT_AT] as const,
  );
  record("velocity", {
    rule: "velocity is linear gain on every sound: .4 is −7.96 dB and .3 is −10.46 dB within ±0.3 dB; in U13.L02's hook (96 BPM: kick, snare, accented hats, finger bass, Rhodes; ghosts on the 'a' of 2, the 'e' of 3 and the 'a' of 4) each ghost note at .3 and at .4 carries more than −20 dB of everything else in its 60 ms and sits 6 dB or more under the backbeat",
    ...r,
  });
  const problems: string[] = [];
  for (const m of r.mapping as Record<string, number | string>[]) {
    if (Math.abs((m["v0.4"] as number) - 20 * Math.log10(0.4)) > 0.3)
      problems.push(`${m.id} at .4: ${m["v0.4"]} dB`);
    if (Math.abs((m["v0.3"] as number) - 20 * Math.log10(0.3)) > 0.3)
      problems.push(`${m.id} at .3: ${m["v0.3"]} dB`);
  }
  for (const g of r.inGroove as Record<string, unknown>[])
    for (const v of ["0.3", "0.4"]) {
      const row = g[v] as { overMixDb: number[]; underAccentDb: number[]; diffDb: number };
      if (!(Math.min(...row.overMixDb) > -20))
        problems.push(`${g.kit} ghost ${v}: ${Math.min(...row.overMixDb)} dB against the mix`);
      if (!(Math.max(...row.underAccentDb) <= -6))
        problems.push(`${g.kit} ghost ${v}: ${Math.max(...row.underAccentDb)} dB under the accent`);
    }
  expect(problems).toEqual([]);
});

test("audibility: every tool, chord and scale U12–U17 unlock, heard in its lesson's own loop; the U12–U17 sounds in tune where the lessons play them", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page);
  const r = await page.evaluate(
    async ([lessons, tuning]) => {
      const w = (window as unknown as W).__oak;
      const rows = [];
      for (const c of lessons) {
        const row = await w.lessonHarness.audible(c.control, c.value, c.base, c.id || undefined, c.withCode, {
          cycles: c.cycles,
          cps: c.cps,
        });
        rows.push({ lesson: c.lesson, claim: c.claim, ...row });
      }
      const tuned: Record<string, unknown[]> = {};
      for (const [sound, midis] of tuning) {
        tuned[sound] = [];
        for (const m of midis) tuned[sound].push(await w.quality.tuning(sound, m));
      }
      return { lessons: rows, tuning: tuned };
    },
    [W6_LESSON_CASES, Object.entries(W6_TUNING)] as const,
  );
  const fix = (x: unknown) =>
    typeof x === "number" && !Number.isFinite(x) ? (x > 0 ? "Infinity" : "-Infinity") : x;
  const out = (row: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, fix(v)]));
  record("audibility", {
    rule: "as packages/strudel/audibility.json, each tool in its lesson's loop (content/specs/U12.ts … U17.ts) at the lesson's tempo; tuning: the first partial within ±10 c in the asked-for octave at the pitches the U12–U17 lessons play each new sound",
    lessons: r.lessons.map(out),
    tuning: r.tuning,
  });
  const problems = r.lessons
    .filter((x: { audible: boolean; error?: string }) => x.error || !x.audible)
    .map(
      (x: { lesson: string; claim: string; diffDb: number; spectralDb: number; error?: string }) =>
        `${x.lesson} ${x.claim}: ${x.error ?? `${x.diffDb} dB (spectrum ${x.spectralDb} dB)`}`,
    );
  for (const [sound, rows] of Object.entries(r.tuning))
    for (const t of rows as { midi: number; cents: number | null; octave: number | null }[])
      if (t.cents === null || Math.abs(t.cents) > MAX_CENTS || t.octave !== 0)
        problems.push(`${sound} ${t.midi}: ${t.cents} c, octave ${t.octave}`);
  expect(problems).toEqual([]);
});

test("the Wave 6 Bands (6/8, 12/8, the funk push, four modes, applied and borrowed) are balanced mixes in all four flavours", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page);
  const mixes = WAVE6_BANDS.flatMap((b) =>
    FLAVOURS.map((f) => {
      const code = bandCodeFor(
        { band: b.id as never, flavour: f as never, code: b.code[f], followsLearnerKey: false, tracks: [] },
        { key: { tonic: "C", mode: b.mode } as never, defaultBpm: 96, learnerCode: "" },
      );
      const units = METERS[b.meter].unitsPerBar;
      // Compound Bands at U13.L04's 60 to the dotted quarter; the rest at 96 to the quarter (contracts §6.9).
      const bpm = units === 2 || b.meter === "12/8" ? 60 : 96;
      return {
        band: b.id,
        flavour: f,
        cps: bpm / 60 / units,
        drums: asExpression(code, ["drums"]),
        bass: asExpression(code, ["bass"]),
        chords: asExpression(code, ["chords"]),
        all: asExpression(code),
      };
    }),
  );
  const r = await page.evaluate(
    async ([mixes]) => {
      const q = (window as unknown as W).__oak.quality;
      const out = [];
      for (const m of mixes) {
        const lufs = async (code: string) =>
          (await q.phraseLoudness(code, m.cps)) as { lufs: number; peakDb: number };
        out.push({
          band: m.band,
          flavour: m.flavour,
          drums: (await lufs(m.drums)).lufs,
          bass: (await lufs(m.bass)).lufs,
          chords: (await lufs(m.chords)).lufs,
          mix: await lufs(m.all),
        });
      }
      return out;
    },
    [mixes] as const,
  );
  const problems: string[] = [];
  for (const m of r) {
    const parts = [m.drums, m.bass, m.chords];
    const spread = Math.round((Math.max(...parts) - Math.min(...parts)) * 10) / 10;
    if (spread > MAX_PART_SPREAD_LU)
      problems.push(`${m.flavour} parts ${spread} LU apart (${m.band}: ${parts.join(" ")})`);
    if (!(m.mix.lufs < -14 && m.mix.lufs > -32))
      problems.push(`${m.flavour} mix ${m.mix.lufs} LUFS (${m.band})`);
    if (m.mix.peakDb >= 0) problems.push(`${m.flavour} clips at ${m.mix.peakDb} dBFS (${m.band})`);
  }
  record("bands", {
    rule: "one bar of each proposed Wave 6 Band (packages/strudel/e2e/wave6-bands.ts) in C (its own mode), compound Bands at 60 to the dotted quarter and the rest at 96: parts within 10 LU of each other; the mix between −32 and −14 LUFS, peak under 0 dBFS (offline, before the master limiter)",
    mixes: r,
  });
  expect(problems).toEqual([]);
});

test("a Band follows the lift (U17.L02, C7, CF-A) without a click at the change, in every flavour", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page);
  // Two bars, the second a whole step up: the learner's key plan after arrange(), the Band following it.
  const learner = (plan: string) =>
    `const melVerse = n("[4 ~ 2 4]")\nmel: arrange([2, melVerse]).scale("${plan}").s("piano")`;
  const renders = FLAVOURS.flatMap((f) =>
    (["<C4:major D4:major>", "C4:major"] as const).map((plan) => {
      const band = bandCodeFor(
        {
          band: "band.axis-4bar" as never,
          flavour: f as never,
          code: bandCodeAt("band.axis-4bar", f as never, () => true),
          followsLearnerKey: true,
          tracks: ["bass", "chords"],
        },
        { key: { tonic: "C", mode: "major" } as never, defaultBpm: 96, learnerCode: learner(plan) },
      );
      // The pitched parts only: a drum hit at the bar line is an attack, not the click this looks for.
      return { flavour: f, lift: plan !== "C4:major", code: asExpression(band, ["bass", "chords"]) };
    }),
  );
  const r = await page.evaluate(
    async ([renders]) => {
      const w = (window as unknown as W).__oak;
      const a = w.analysis;
      const h = w.createHarness({ frameUrl: "/render.html", seconds: 5.5 });
      const cps = 96 / 240;
      const bar = 1 / cps;
      const out = [];
      for (const x of renders) {
        const st = await h.renderInFrame(x.code, 2, cps);
        const mono = st.left.map((v: number, i: number) => (v + (st.right[i] as number)) / 2);
        // The worst high-frequency jump in the 150 ms after the change (bar 2), against the same window at bar 1.
        const atChange = a.scanClicks(mono, 44100, bar - 0.04, bar + 0.15);
        const atStart = a.scanClicks(mono, 44100, 0.12, 0.15 + 0.12);
        // No gap: the level in each 50 ms across the change.
        const levels: number[] = [];
        for (let t = bar - 0.2; t < bar + 0.3; t += 0.05) {
          let s = 0;
          const [i0, i1] = [Math.floor(t * 44100), Math.floor((t + 0.05) * 44100)];
          for (let i = i0; i < i1; i++) s += (mono[i] as number) ** 2;
          levels.push(a.round(10 * Math.log10(s / (i1 - i0) + 1e-12), 1));
        }
        out.push({
          flavour: x.flavour,
          lift: x.lift,
          changeDb: a.round(atChange.worstDb, 1),
          startDb: a.round(atStart.worstDb, 1),
          levelsDb: levels,
          peakDb: a.round(a.peakDb(st), 1),
        });
      }
      return out;
    },
    [renders] as const,
  );
  record("lift", {
    rule: "band.axis-4bar under a learner tune whose key plan rises a whole step at bar 2, bass and chords only, at 96 BPM: the worst high-frequency jump in the 150 ms after the change is no more than 3 dB over the same Band in one key at the same bar line; no 50 ms around the change falls 20 dB under the bar before it; no clipping",
    rows: r,
  });
  const problems: string[] = [];
  for (const f of FLAVOURS) {
    const [lift, flat] = [
      r.find((x) => x.flavour === f && x.lift),
      r.find((x) => x.flavour === f && !x.lift),
    ];
    if (!lift || !flat) throw new Error(`missing ${f}`);
    if (lift.changeDb > flat.changeDb + 3)
      problems.push(`${f}: ${lift.changeDb} dB at the lift vs ${flat.changeDb}`);
    const before = Math.max(...lift.levelsDb.slice(0, 4));
    if (Math.min(...lift.levelsDb) < before - 20)
      problems.push(`${f}: a gap at the change (${lift.levelsDb})`);
    if (lift.peakDb >= 0) problems.push(`${f}: clips`);
  }
  expect(problems).toEqual([]);
});

test("CF-T backing: the three standards in an early-jazz two-beat are balanced mixes, the bass clear under the piano", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page);
  const songs = Object.entries(CFT_CHANGES).map(([title, changes]) => {
    const l = earlyJazzBacking(changes.slice(0, 4));
    return {
      title,
      drums: l.drums,
      bass: l.bass,
      chords: l.chords,
      all: `stack(${l.drums}, ${l.bass}, ${l.chords})`,
    };
  });
  const r = await page.evaluate(
    async ([songs, cps]) => {
      const w = (window as unknown as W).__oak;
      const a = w.analysis;
      const h = w.createHarness({ frameUrl: "/render.html", seconds: 4 / cps + 0.5 });
      const out = [];
      for (const s of songs) {
        const row: Record<string, unknown> = { title: s.title };
        for (const k of ["drums", "bass", "chords", "all"] as const) {
          const x = await h.renderInFrame(s[k], 4, cps);
          row[k] = { lufs: a.round(a.loudness(x, 44100), 1), peakDb: a.round(a.peakDb(x), 1), haps: x.haps };
        }
        out.push(row);
      }
      return out;
    },
    [songs, CFT_BPM / 240] as const,
  );
  record("earlyJazz", {
    rule: "the first four bars of each CF-T standard's backing (src/early-jazz.ts) at 132 BPM, R0: brushes, two-beat upright and the right hand on 2 and 4 within 10 LU of each other, the bass no more than 6 LU under the piano; the mix between −32 and −14 LUFS; no peak at 0 dBFS",
    songs: r,
  });
  const problems: string[] = [];
  type L = { lufs: number; peakDb: number; haps: number };
  for (const s of r as Record<string, L & string>[]) {
    const [d, b, c, all] = [s.drums, s.bass, s.chords, s.all] as unknown as L[];
    const parts = [d, b, c].map((x) => (x as L).lufs);
    if (Math.max(...parts) - Math.min(...parts) > MAX_PART_SPREAD_LU)
      problems.push(`${s.title}: parts ${parts}`);
    if ((c as L).lufs - (b as L).lufs > 6)
      problems.push(`${s.title}: bass ${(b as L).lufs} under piano ${(c as L).lufs}`);
    if (!((all as L).lufs < -14 && (all as L).lufs > -32))
      problems.push(`${s.title}: mix ${(all as L).lufs}`);
    if ((all as L).peakDb >= 0) problems.push(`${s.title}: clips ${(all as L).peakDb}`);
    if ((b as L).haps !== 8) problems.push(`${s.title}: ${(b as L).haps} bass notes in four bars`);
  }
  expect(problems).toEqual([]);
});

/** Audio files only (not the JSON maps): each waits `ms`, as a slow first visit would. */
async function slowSounds(page: Page, ms: number): Promise<void> {
  await page.context().route("**/sounds/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.endsWith(".json")) await new Promise((x) => setTimeout(x, ms));
    return route.continue();
  });
}

test("CF-A: a two-minute single with a bridge and a lift plays to the end without a dropout, its new sounds warmed ahead, with CPU headroom", async ({
  page,
}) => {
  // Real time: 34 s of the whole song at four times its tempo, then 8 s of the lifted chorus at its own.
  test.setTimeout(120_000);
  const external: string[] = [];
  await page.context().route(/^(?!http:\/\/127\.0\.0\.1)/, (route) => {
    external.push(route.request().url());
    return route.abort();
  });
  await slowSounds(page, 700);
  const requests: { url: string; at: number; done?: number }[] = [];
  page.on("request", (q) => {
    if (q.url().includes("/sounds/")) requests.push({ url: q.url(), at: Date.now() });
  });
  page.on("requestfinished", (q) => {
    const row = requests.find((x) => x.url === q.url() && x.done === undefined);
    if (row) row.done = Date.now();
  });
  await open(page);
  const fastBpm = CFA_BPM * 4;
  const fastBarMs = (4 * 60_000) / fastBpm;
  const lift = cfaStart("chorus2");
  const r = await page.evaluate(
    async ([whole, chorus, bars, barMs, liftCode]) => {
      const w = (window as unknown as W).__oak;
      const ctx = w.oak.ctx as AudioContext & { playbackStats?: { underrunEvents?: number } };
      type Capacity = EventTarget & { start(o: { updateInterval: number }): void; stop(): void };
      const capacity = (ctx as unknown as { renderCapacity?: Capacity }).renderCapacity;
      const longTasks: number[] = [];
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(Math.round(entry.duration));
      });
      try {
        obs.observe({ type: "longtask", buffered: false });
      } catch {
        // not supported
      }
      const live = async (id: string, code: string, ms: number) => {
        const before = w.logs.length;
        const stats0 = ctx.playbackStats ? { ...ctx.playbackStats } : null;
        const loads: { average: number; peak: number }[] = [];
        const onLoad = (ev: Event) => {
          const u = ev as Event & { averageLoad: number; peakLoad: number };
          loads.push({
            average: Math.round(u.averageLoad * 1000) / 1000,
            peak: Math.round(u.peakLoad * 1000) / 1000,
          });
        };
        if (capacity) {
          capacity.addEventListener("update", onLoad);
          capacity.start({ updateInterval: 1 });
        }
        longTasks.length = 0;
        const e = w.mountImperative(id, code);
        const t0 = Date.now();
        const played = await e.play();
        const started = Date.now();
        // The master level every 50 ms: a dropout is a stretch the song should sound and does not.
        const levels: number[] = [];
        while (Date.now() < started + ms) {
          const l = w.oak.master.level();
          levels.push(Math.round(l.rms * 10000) / 10000);
          await new Promise((x) => setTimeout(x, 50));
        }
        w.oak.stopAll();
        await new Promise((x) => setTimeout(x, 200));
        const stats1 = ctx.playbackStats ? { ...ctx.playbackStats } : null;
        if (capacity) {
          capacity.stop();
          capacity.removeEventListener("update", onLoad);
        }
        const logs = w.logs.slice(before);
        e.dispose();
        return {
          ok: played.ok,
          startMs: started - t0,
          t0,
          started,
          levels,
          loads,
          longTasks: [...longTasks],
          late: logs.filter((l: { message: string }) => /late|behind/i.test(l.message)).length,
          skips: logs
            .filter((l: { skippedSound?: string }) => l.skippedSound)
            .map((l: { skippedSound?: string }) => l.skippedSound),
          notFound: logs.filter((l: { message: string }) => /not found/.test(l.message)).length,
          underruns: stats0 && stats1 ? (stats1.underrunEvents ?? 0) - (stats0.underrunEvents ?? 0) : null,
        };
      };
      // 1. The whole song at four times its tempo, on a cold pack that answers every file 700 ms late: four times
      //    the notes a second of the real song, and every sound the bridge and the last chorus bring must be
      //    fetched and decoded before its first bar.
      const fast = await live("oak_cfa_0_", whole, bars * barMs - 300);
      // 2. The densest eight bars (the lifted chorus, horns and crash added) at the song's own tempo.
      const own = await live("oak_cfa_1_", chorus, 8000);
      // 3. Offline: the same eight bars through the production prebake, faster than real time.
      const h = w.createHarness({ frameUrl: "/render.html", seconds: 8 * 2.4 + 1, timeoutMs: 60_000 });
      const t = performance.now();
      const out = await h.renderInFrame(liftCode, 8, 100 / 240);
      const renderMs = performance.now() - t;
      obs.disconnect();
      return {
        fast,
        own,
        offline: {
          audioSec: out.left.length / 44100,
          renderMs: Math.round(renderMs),
          timings: out.timings,
          haps: out.haps,
        },
        playbackStats: ctx.playbackStats !== undefined,
      };
    },
    [
      cfaArrangement(fastBpm),
      cfaArrangement(CFA_BPM, lift),
      CFA_BARS,
      fastBarMs,
      asExpression(cfaArrangement(CFA_BPM, lift)),
    ] as const,
  );
  // Where each section's new sounds were fetched, against the moment its first bar played (fast run).
  // Pack v4: `strings` plays Oak's sampled strings (src/strings/), no longer the 0480 soundfont; the kits name
  // their files `<role>_<variant>_<layer>`.
  const firstFiles: Record<string, RegExp[]> = {
    strings: [/0480_/, /\/src\/strings\//],
    horns: [/0610_/],
    cr: [/\/cr\//, /\/cr_\d/],
  };
  const warmed = Object.entries(CFA_FIRST_IN).flatMap(([section, sounds]) => {
    const at = r.fast.started + cfaStart(section) * fastBarMs;
    return sounds.flatMap((s) =>
      requests
        .filter((q) => q.at < r.fast.started + CFA_BARS * fastBarMs)
        .filter((q) => (firstFiles[s] ?? []).some((re) => re.test(decodeURIComponent(q.url))))
        .map((q) => ({
          section,
          sound: s,
          file: decodeURIComponent(new URL(q.url).pathname).replace(/^.*\/sounds\//, ""),
          doneBeforeMs: q.done === undefined ? null : Math.round(at - q.done),
        })),
    );
  });
  /** Longest stretch (ms) of 50-ms readings under −50 dBFS after the first 300 ms. */
  const longestGap = (levels: number[]) => {
    let worst = 0;
    let run = 0;
    for (const l of levels.slice(6)) {
      run = l < 0.00316 ? run + 50 : 0;
      worst = Math.max(worst, run);
    }
    return worst;
  };
  const gpuless = (x: typeof r.fast) => ({ ...x, levels: undefined, t0: undefined, started: undefined });
  const graphMs = r.offline.timings?.renderMs ?? r.offline.renderMs;
  record("cfa", {
    rule: "the CF-A single (wave6-fixtures.ts cfaArrangement: 56 bars, 134.4 s at 100 BPM, a bridge with an applied dominant and a borrowed iv, the last chorus a whole step up) played live in the editor: the whole song at 4× its tempo on a pack that answers every audio file 700 ms late, then the lifted chorus for 8 s at its own tempo. No audio underrun (AudioContext.playbackStats), no skipped or missing sound, no main-thread stall over 200 ms, no stretch of 300 ms under −50 dBFS while the song plays, an audio-thread peak load under 0.7 where Chrome reports renderCapacity; every sound the bridge and the last chorus bring decoded before its first bar; the lifted chorus offline faster than real time (the CPU headroom)",
    bars: CFA_BARS,
    seconds: (CFA_BARS * 240) / CFA_BPM,
    fast: { ...gpuless(r.fast), longestGapMs: longestGap(r.fast.levels) },
    own: { ...gpuless(r.own), longestGapMs: longestGap(r.own.levels) },
    warmed,
    offline: { ...r.offline, realtimeFactor: Math.round((r.offline.audioSec / (graphMs / 1000)) * 10) / 10 },
  });
  for (const [k, l] of [
    ["fast", r.fast],
    ["own", r.own],
  ] as const) {
    expect(l.ok, k).toBe(true);
    expect(l.skips, k).toEqual([]);
    expect(l.notFound, k).toBe(0);
    expect(l.late, k).toBe(0);
    expect(longestGap(l.levels), k).toBeLessThan(300);
    expect(Math.max(0, ...l.longTasks), k).toBeLessThan(200);
    if (l.underruns !== null) expect(l.underruns, k).toBe(0);
    for (const load of l.loads) expect(load.peak, k).toBeLessThan(0.7);
  }
  expect(warmed.map((x) => x.sound).sort()).toEqual(expect.arrayContaining(["cr", "horns", "strings"]));
  for (const x of warmed) expect(x.doneBeforeMs, `${x.sound} ${x.file}`).toBeGreaterThan(0);
  expect(r.offline.audioSec).toBeGreaterThan(19);
  expect(r.offline.audioSec / (graphMs / 1000)).toBeGreaterThan(1);
  expect(external).toEqual([]);
});
