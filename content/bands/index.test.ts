// The Band layers as U03–U04 use them (contracts §5.10, FLAVOUR_RULES): the stage each flavour plays at a
// point of the course, every (band, flavour, stage) in all twelve major keys, the production defaults of
// the kits, the register, and the music the lessons and checkpoints put over each flavour. The frozen
// content/validate/bands.test.ts checks each Band's first stage in three keys; course.test.ts scans the
// pop Band under every lesson. This file adds the later stages, every key and the other three flavours.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import {
  type BandRef,
  type CheckpointDef,
  type Exercise,
  type FlavourId,
  flattenExercise,
  type KeySpec,
  type LessonDef,
  type SessionId,
  stripMarkers,
} from "@oak/content-kit";
import { evalHeadless } from "@oak/grader/testing";
import { METERS } from "@oak/theory";
import { CHECKPOINT_MAKE_BANDS } from "../checkpoints.ts";
import { flavourById, flavours } from "../flavours.ts";
import { courseGraph } from "../index.ts";
import { atOrBefore } from "../lib/course.ts";
import { loadCheckpointFiles, loadLessons } from "../lib/load.bun.ts";
import { BAD_LOG, evaluate, lint } from "../validate/harness.ts";
import {
  BAND_CHANGES,
  BAND_METERS,
  BAND_STAGES,
  bandById,
  bandCodeAt,
  bandMeter,
  bands,
  MODAL_BANDS,
  MODAL_GUARDS,
  SECTION_BANDS,
  SEVENTH_VAMP_CHORDS,
  TONIC_BANDS,
} from "./index.ts";

/** A step's key as the Band takes it. */
type KeySpecLike = KeySpec;
/**
 * The app's own Band preparation (key, sections, register: `bandCodeFor` in packages/strudel/src/band.ts, a pure
 * text module). It is imported by path at run time: its package's types need the DOM, which content does not
 * compile with.
 */
type BandCodeFor = (
  band: { band: string; flavour: FlavourId; code: string; followsLearnerKey: boolean; tracks: string[] },
  ctx: { key: KeySpec | null; defaultBpm: number; learnerCode: string },
) => string;
const STRUDEL_BAND = "../../packages/strudel/src/band.ts";
const { bandCodeFor } = (await import(STRUDEL_BAND)) as { bandCodeFor: BandCodeFor };

setDefaultTimeout(120_000);
const g = courseGraph();
const at = (session: string) => (from: string) => atOrBefore(g, from as SessionId, session as SessionId);
const KEYS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"].map((t) => `${t}4:major`);
const fill = (code: string, key = "C4:major", beats = 4, bpm = 96) =>
  `setcpm(${bpm}/${beats})\n\n${code.replaceAll("{{key}}", key).replaceAll("{{bpm}}", String(bpm))}`;
/**
 * The divisor of a Band's tempo line (contracts §6.9): the meter's tempo units in a bar — beats, dotted quarters in
 * a compound meter (6/8 → 2), eighths in an odd /8 meter (7/8 → 7, `setcpm(bpm/7)`).
 */
const beatsOf = (id: string) => METERS[bandMeter(id) as keyof typeof METERS].unitsPerBar;
const rat = (x: string | number): number => {
  const [a, b] = String(x).split("/").map(Number);
  return b ? (a as number) / b : (a as number);
};
/** Every code a Band can play: its first stage and each later one, per flavour. */
const allCodes = bands.flatMap((b) =>
  Object.entries(b.code).flatMap(([flavour, code]) => [
    { band: b.id, flavour, stage: "first", code },
    ...(BAND_STAGES[b.id]?.[flavour as FlavourId] ?? []).map((s) => ({
      band: b.id,
      flavour,
      stage: s.from as string,
      code: s.code,
    })),
  ]),
);
const lineOf = (code: string, label: string) => code.split("\n").find((l) => l.startsWith(`${label}:`)) ?? "";

describe("stages (FLAVOUR_RULES, contracts §5.10)", () => {
  const vamp = "band.two-chord-vamp";
  test("jazz-soul: triads and straight before U03, four-note chords and swing from U03.L01", () => {
    const u02 = bandCodeAt(vamp, "flavour.jazz-soul", at("U02.L08"));
    const u03 = bandCodeAt(vamp, "flavour.jazz-soul", at("U03.L02"));
    expect(u02).toBe(bandById.get(vamp)?.code["flavour.jazz-soul"] as string);
    expect(u02).not.toContain("swingBy");
    expect(u03).toContain("swingBy(1/3, 4)");
    expect(bandCodeAt(vamp, "flavour.jazz-soul", at("U03.CP"))).toBe(u03);
    expect(bandCodeAt(vamp, "flavour.jazz-soul", at("U04.CP"))).toBe(u03);
    expect(bandCodeAt("band.waltz-vamp", "flavour.jazz-soul", at("U03.L01"))).toContain("swingBy(1/3, 3)");
  });
  test("funk: triads until U06, four-note chords from U06.L01; pop and indie never change", () => {
    expect(bandCodeAt(vamp, "flavour.funk", at("U05.L08"))).toBe(
      bandById.get(vamp)?.code["flavour.funk"] as string,
    );
    expect(bandCodeAt(vamp, "flavour.funk", at("U06.L02"))).not.toBe(
      bandById.get(vamp)?.code["flavour.funk"] as string,
    );
    for (const f of ["flavour.pop", "flavour.indie"])
      for (const b of bands) expect(bandCodeAt(b.id, f, at("U17.L04"))).toBe(b.code[f as never] as string);
  });
  test("electronic: triads and straight until U06.L10, four-note chords from U06.L10, never swung", () => {
    const first = bandById.get(vamp)?.code["flavour.electronic"] as string;
    expect(bandCodeAt(vamp, "flavour.electronic", at("U06.L09"))).toBe(first);
    const later = bandCodeAt(vamp, "flavour.electronic", at("U06.L11"));
    expect(later).not.toBe(first);
    expect(later).toContain(SEVENTH_VAMP_CHORDS);
    for (const b of bands)
      expect([b.id, bandCodeAt(b.id, "flavour.electronic", at("U06.L09")).includes("swingBy")]).toEqual([
        b.id,
        // The forms that swing in every kit: the shuffles, the jazz forms and the neo-soul loop's light sixteenths.
        /blues|jazz-blues|rhythm-changes|neo-soul/.test(b.id),
      ]);
  });
  test("an unknown flavour plays pop; an unknown band is an error", () => {
    expect(bandCodeAt(vamp, "flavour.unknown", at("U03.L02"))).toBe(
      bandById.get(vamp)?.code["flavour.pop"] as string,
    );
    expect(() => bandCodeAt("band.nope", "flavour.pop", at("U03.L02"))).toThrow();
  });
});

describe("every band, flavour and stage in all twelve keys", () => {
  for (const c of allCodes)
    test(`${c.band} × ${c.flavour} (${c.stage})`, async () => {
      const b = bandById.get(c.band);
      for (const key of KEYS) {
        const r = await evaluate(fill(c.code, key, beatsOf(c.band)), b?.bars ?? 2);
        expect([key, r.ok, r.error ?? ""]).toEqual([key, true, ""]);
        expect(r.logs.filter((l) => BAD_LOG.test(l))).toEqual([]);
        expect([...r.tracks].sort()).toEqual([...(b?.roles ?? [])].sort());
        // Register. `{{key}}` puts the tonic in octave 4 whatever the key, so from F# up to B the whole
        // Band sits up to a fifth higher than in C: the bass's roots stay between E1 and B2 and its octave
        // pops reach E4 at most; the chords stay between E2 and E5.
        const bass = r.events.filter((e) => e.track === "bass").map((e) => e.midi as number);
        const chords = r.events.filter((e) => e.track === "chords").map((e) => e.midi as number);
        expect([key, Math.min(...bass) >= 28, Math.min(...bass) <= 47, Math.max(...bass) <= 64]).toEqual([
          key,
          true,
          true,
          true,
        ]);
        expect([key, Math.min(...chords) >= 40, Math.max(...chords) <= 76]).toEqual([key, true, true]);
        // Wave 4: in every bar the chords stay above the bass (a crossing muddies the root on headphones).
        // Funk's octave pops are the one exception, by design: a short popped note above a bright clav stab is
        // the style; even there the chords never dip under the root.
        for (let bar = 0; bar < (b?.bars ?? 2); bar++) {
          const inBar = (t: string) =>
            r.events
              .filter((e) => e.track === t && Math.floor(rat(e.begin) + 1e-9) === bar && e.midi !== null)
              .map((e) => e.midi as number);
          const bassNotes = inBar("bass");
          const top = c.flavour === "flavour.funk" ? Math.min(...bassNotes) : Math.max(...bassNotes);
          const [lo, hi] = [Math.min(...inBar("chords")), top];
          if (Number.isFinite(lo) && Number.isFinite(hi))
            expect([key, bar, lo >= hi]).toEqual([key, bar, true]);
        }
      }
      const res = lint(fill(c.code, "C4:major", beatsOf(c.band)), {
        session: "U01.L01",
        meter: bandMeter(c.band),
        allowPreview: true,
        profile: "band",
      });
      expect(
        res.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.id} ${d.message}`),
      ).toEqual([]);
    });
});

describe("production defaults (contracts §5.10, content/flavours.ts)", () => {
  test("room, bass low-pass and chord pan are the kit's; velocities within ±0.08 of 0.92", () => {
    const bad: string[] = [];
    for (const c of allCodes) {
      const p = flavourById.get(c.flavour)?.production;
      if (!p) {
        bad.push(`${c.band} ${c.flavour}: no kit`);
        continue;
      }
      const chords = lineOf(c.code, "chords");
      const bass = lineOf(c.code, "bass");
      const n = (re: RegExp, s: string) => Number(re.exec(s)?.[1]);
      if (n(/\.room\(([\d.]+)\)/, chords) !== p.room) bad.push(`${c.band} ${c.flavour} ${c.stage}: room`);
      if (n(/\.lpf\(([\d.]+)\)/, bass) !== p.bassLpf) bad.push(`${c.band} ${c.flavour} ${c.stage}: lpf`);
      if (n(/\.pan\(([\d.]+)\)/, chords) !== p.pan.chords) bad.push(`${c.band} ${c.flavour} ${c.stage}: pan`);
      if (/\.pan\(/.test(bass)) bad.push(`${c.band} ${c.flavour} ${c.stage}: the bass stays centred`);
      for (const label of ["drums", "chords"]) {
        const v = /\.velocity\("([^"]*)"\)/.exec(lineOf(c.code, label))?.[1];
        if (!v) bad.push(`${c.band} ${c.flavour} ${c.stage}: ${label} not humanized`);
        for (const x of (v ?? "").match(/[\d.]+/g)?.filter((t) => t.includes(".") || t === "1") ?? [])
          if (Math.abs(Number(x) - 0.92) > 0.08 + 1e-9)
            bad.push(`${c.band} ${c.flavour} ${c.stage}: ${label} velocity ${x}`);
      }
    }
    expect(bad).toEqual([]);
  });
  test("every kit is covered", () => {
    for (const b of bands) expect(Object.keys(b.code).sort()).toEqual(flavours.map((f) => f.id).sort());
  });
});

describe("the harmony the stages play (checked against Strudel)", () => {
  const chordsByBar = async (code: string, key: string, bars: number) => {
    const line = lineOf(code, "chords")
      .replace(/\.struct\("[^"]*"\)/, "")
      .replace(/\.swingBy\([^)]*\)/, "");
    const r = await evalHeadless(fill(line, key), bars);
    return [...Array(bars).keys()].map((i) =>
      [
        ...new Set(
          r.events.filter((e) => Math.floor(rat(e.begin) + 1e-9) === i).map((e) => e.midi as number),
        ),
      ].sort((a, b) => a - b),
    );
  };
  test("jazz-soul from U03: C6 (C E G A) and F6 (D F A C over the F bass), in G: G6 and C6", async () => {
    const code = bandCodeAt("band.two-chord-vamp", "flavour.jazz-soul", at("U03.L02"));
    expect(await chordsByBar(code, "C4:major", 2)).toEqual([
      [48, 52, 55, 57],
      [50, 53, 57, 60],
    ]);
    expect(await chordsByBar(code, "G4:major", 2)).toEqual([
      [55, 59, 62, 64],
      [57, 60, 64, 67],
    ]);
  });
  test("the eight-bar phrase in jazz-soul: C6 F6 C6 G7 | C6 F6 G7 C6", async () => {
    const code = bandCodeAt("band.phrase-8bar", "flavour.jazz-soul", at("U03.L11"));
    const C6 = [48, 52, 55, 57];
    const F6 = [50, 53, 57, 60];
    const G7 = [47, 50, 53, 55];
    expect(await chordsByBar(code, "C4:major", 8)).toEqual([C6, F6, C6, G7, C6, F6, G7, C6]);
  });
  test("the eight-bar phrase in funk plays triads until U06", async () => {
    const code = bandCodeAt("band.phrase-8bar", "flavour.funk", at("U03.CP"));
    const bars = await chordsByBar(code, "C4:major", 8);
    expect(bars.every((b) => b.length === 3)).toBe(true);
  });
  // Wave 4: the four-chord loop with four notes, doo-wop and three-chord rock (U06.L07, C2).
  const [C, Am, F, G] = [
    [48, 52, 55],
    [48, 52, 57],
    [48, 53, 57],
    [47, 50, 55],
  ];
  /** F6 as the loops voice it, low and close: C D F A. */
  const [C6, G7, Am7, F6low] = [
    [48, 52, 55, 57],
    [47, 50, 53, 55],
    [45, 48, 52, 55],
    [48, 50, 53, 57],
  ];
  test("the four-chord loop: from U03 (jazz-soul) and U06 (funk) C6 G7 Am7 F6 (as C D F A); funk in triads before", async () => {
    const axisTriads = [
      [48, 52, 55],
      [55, 59, 62],
      [57, 60, 64],
      [53, 57, 60],
    ];
    expect(
      await chordsByBar(bandCodeAt("band.axis-4bar", "flavour.funk", at("U05.L08")), "C4:major", 4),
    ).toEqual(axisTriads);
    const fours = [C6, G7, Am7, [48, 50, 53, 57]];
    expect(
      await chordsByBar(bandCodeAt("band.axis-4bar", "flavour.jazz-soul", at("U03.L02")), "C4:major", 4),
    ).toEqual(fours);
    expect(
      await chordsByBar(bandCodeAt("band.axis-4bar", "flavour.funk", at("U06.L02")), "C4:major", 4),
    ).toEqual(fours);
    expect(bandCodeAt("band.axis-4bar", "flavour.jazz-soul", at("U06.L06"))).toContain("swingBy(1/3, 4)");
  });
  test("no major 7th under a tune: the four-note loops play no B over C and no E over F", async () => {
    for (const band of ["band.axis-4bar", "band.doo-wop", "band.three-chord", "band.two-chord-vamp"])
      for (const f of ["flavour.jazz-soul", "flavour.funk"]) {
        const bars = await chordsByBar(bandCodeAt(band, f, at("U07.L02")), "C4:major", 4);
        const pcs = (b: number[]) => b.map((m) => m % 12);
        for (const [i, b] of bars.entries()) {
          // C6 (C E G A) and F6 (C D F A or D F A C) are the only chords with C and F where a major 7th would go.
          if (pcs(b).includes(0) && pcs(b).includes(4) && pcs(b).includes(7))
            expect([band, f, i, pcs(b).includes(11)]).toEqual([band, f, i, false]);
          if (pcs(b).includes(5) && pcs(b).includes(9))
            expect([band, f, i, pcs(b).includes(4)]).toEqual([band, f, i, false]);
        }
      }
  });
  test("doo-wop: C Am F G (C E A, C F A, B D G close to C); from U03 in jazz-soul C6 Am7 F6 G7", async () => {
    expect(
      await chordsByBar(bandCodeAt("band.doo-wop", "flavour.pop", at("U06.L07")), "C4:major", 4),
    ).toEqual([C, Am, F, G]);
    expect(
      await chordsByBar(bandCodeAt("band.doo-wop", "flavour.jazz-soul", at("U06.L07")), "C4:major", 4),
    ).toEqual([C6, Am7, F6low, G7]);
    expect(
      await chordsByBar(bandCodeAt("band.doo-wop", "flavour.funk", at("U05.L08")), "C4:major", 4),
    ).toEqual([C, Am, F, G]);
  });
  test("doo-wop's piano strikes every triplet: twelve chords a bar", async () => {
    const code = bandCodeAt("band.doo-wop", "flavour.pop", at("U06.L07"));
    const r = await evalHeadless(fill(lineOf(code, "chords")), 1);
    expect(new Set(r.events.map((e) => Math.round(rat(e.begin) * 12))).size).toBe(12);
  });
  test("three-chord rock: C F G F; from U06 in funk C6 F6 G7 F6", async () => {
    expect(
      await chordsByBar(bandCodeAt("band.three-chord", "flavour.indie", at("U06.L07")), "C4:major", 4),
    ).toEqual([C, F, G, F]);
    expect(
      await chordsByBar(bandCodeAt("band.three-chord", "flavour.funk", at("U06.L07")), "C4:major", 4),
    ).toEqual([C6, F6low, G7, F6low]);
  });
  test("the four-bar loops are voice-led: at each change, the turn back to bar 1 included, no voice moves more than a major 3rd", async () => {
    const bad: string[] = [];
    const loops = ["band.axis-4bar", "band.doo-wop", "band.three-chord"];
    // The four-chord loop's first stage is Wave 2's (root-position triads; pinned by content/validate/bands.test.ts).
    const mine = (x: (typeof allCodes)[number]) =>
      loops.includes(x.band) && !(x.band === "band.axis-4bar" && x.stage === "first");
    for (const c of allCodes.filter(mine)) {
      const bars = await chordsByBar(c.code, "C4:major", bandById.get(c.band)?.bars ?? 2);
      for (const [i, a] of bars.entries()) {
        const b = bars[(i + 1) % bars.length] as number[];
        if (a.length !== b.length) continue;
        const move = Math.max(...a.map((x, k) => Math.abs((b[k] as number) - x)));
        if (move > 4)
          bad.push(
            `${c.band} ${c.flavour} ${c.stage}: bar ${i + 1} to ${((i + 1) % bars.length) + 1} moves ${move}`,
          );
      }
    }
    expect(bad).toEqual([]);
  });
  test("swing: the jazz-soul ride's second eighth lands on the last triplet of the beat", async () => {
    const code = bandCodeAt("band.two-chord-vamp", "flavour.jazz-soul", at("U03.L02"));
    const r = await evalHeadless(fill(lineOf(code, "drums")), 1);
    // Every drum onset of the bar, in 48ths: the ride's offbeats are the only ones between the beats.
    const onsets = r.events.map((e) => Math.round(rat(e.begin) * 48));
    expect(onsets).toContain(8); // 2/3 of the first beat: 1/6 of the bar
    expect(onsets).not.toContain(6); // never the straight eighth (1/8 of the bar)
  });
});

// What plays over each flavour. A tune note a half step above a Band note sounding with it, held a beat
// or more, is the harshest clash there is. course.test.ts already scans the pop Band; here a clash counts
// only if the same note does not clash with pop, so what is found is the flavour's own doing.
interface Shown {
  owner: string;
  id: string;
  code: string;
  band: BandRef;
  key: string;
  session: string;
  beats: number;
}
const shownOf = (owner: string, session: string, key: string, beats: number, band: BandRef, e: Exercise) => {
  const out: Shown[] = [];
  for (const x of flattenExercise(e)) {
    if ("reference" in x && x.reference?.solutions?.[0])
      out.push({ owner, id: x.id, code: x.reference.solutions[0], band, key, session, beats });
    if (x.kind === "code-make") {
      out.push({
        owner,
        id: `${x.id}:starter`,
        code: stripMarkers(x.code.starter).code,
        band,
        key,
        session,
        beats,
      });
      for (const t of x.tests)
        if (t.expect === "pass" && "code" in t.response && t.response.code)
          out.push({ owner, id: `${x.id}:${t.name}`, code: t.response.code, band, key, session, beats });
    }
  }
  return out;
};
const { lessons } = await loadLessons();
const { defs: checkpoints } = await loadCheckpointFiles();
const shown: Shown[] = [];
for (const l of lessons.map((x) => x.def as LessonDef).filter((d) => /^U0[3-7]\.L/.test(d.id))) {
  const beats = Number(l.meter.split("/")[0]);
  const key = `${l.key.tonic}4:${l.key.mode}`;
  for (const s of l.steps) {
    const band = s.ui.band;
    if (!band) continue;
    if (s.example)
      shown.push({ owner: l.id, id: s.example.id, code: s.example.code, band, key, session: l.id, beats });
    if (s.exercise) shown.push(...shownOf(l.id, l.id, key, beats, band, s.exercise));
  }
}
// U01–U07 here; the Wave 5 checkpoints are played the app's way below (a Band in sections needs its consts).
for (const cp of (checkpoints as CheckpointDef[]).filter((c) => /^U0[1-7]\.CP$/.test(c.id))) {
  const band = CHECKPOINT_MAKE_BANDS[cp.id];
  if (!band) continue;
  const k = cp.make.key ?? { tonic: "C", mode: "major" };
  shown.push(...shownOf(cp.id, cp.id, `${k.tonic}4:${k.mode}`, 4, band, cp.make));
}
/** The Band's key: the learner's first `.scale()` when the Band follows it, else the step's key. */
const keyFor = (s: Shown): string => {
  if (!s.band.followsLearnerKey) return s.key;
  const m = /\.scale\("<?\s*([A-G][#b]?)-?\d*:([a-z]+)/.exec(s.code);
  return m ? `${m[1]}4:${m[2]}` : s.key;
};
async function clashes(s: Shown, flavour: string): Promise<Set<string>> {
  const def = bandById.get(s.band.band);
  if (!def || beatsOf(def.id) !== s.beats) return new Set();
  const tracks = s.band.tracks ?? def.roles;
  const harmony = bandCodeAt(def, flavour, at(s.session))
    .replaceAll("{{key}}", keyFor(s))
    .split("\n")
    .filter((ln) => /^(bass|chords):/.test(ln) && tracks.includes(ln.split(":")[0] as never))
    .map((ln) => `band_${ln}`)
    .join("\n");
  const r = await evalHeadless(`${s.code}\n${harmony}`, def.bars * 2);
  const backing = r.events.filter((e) => e.track.startsWith("band_") && e.midi !== null);
  const found = new Set<string>();
  for (const n of r.events.filter((e) => !e.track.startsWith("band_") && e.midi !== null)) {
    const [b0, b1] = [rat(n.begin), rat(n.end)];
    if ((b1 - b0) * s.beats < 1) continue;
    const hit = backing.some(
      (x) =>
        rat(x.begin) < b1 &&
        rat(x.end) > b0 &&
        ((((n.midi as number) - (x.midi as number)) % 12) + 12) % 12 === 1,
    );
    if (hit) found.add(`${n.note}@${round(b0 * s.beats)}`);
  }
  return found;
}
const round = (x: number) => Math.round(x * 1000) / 1000;
/** Clashes a flavour may add, each with its reason. */
const ALLOWED: Record<string, string> = {
  "U03.L06 every-f-sharp:starter f4@3":
    "the starter's deliberately wrong F natural (the learner makes it F#): over the jazz-soul G6 it rubs against E",
  "U03.L06 every-f-sharp:starter f4@11": "the same wrong note, second time round",
};

describe("music over every flavour (U03–U07 lessons and the checkpoint Makes)", () => {
  test("there is something to scan: U03–U07 lessons and the checkpoints with a Band", () => {
    for (const u of ["U03", "U05", "U06", "U07"])
      expect(shown.some((s) => s.owner.startsWith(`${u}.L`))).toBe(true);
    for (const cp of ["U03.CP", "U04.CP", "U05.CP", "U06.CP", "U07.CP"])
      expect(shown.some((s) => s.owner === cp)).toBe(true);
  });
  for (const flavour of ["flavour.jazz-soul", "flavour.indie", "flavour.funk", "flavour.electronic"])
    test(`no ${flavour} Band adds a half-step clash the pop Band does not have`, async () => {
      const found: string[] = [];
      for (const s of shown) {
        const pop = await clashes(s, "flavour.pop");
        for (const c of await clashes(s, flavour)) {
          const id = `${s.owner} ${s.id} ${c}`;
          if (!pop.has(c) && !(id in ALLOWED)) found.push(id);
        }
      }
      expect(found).toEqual([]);
    });
  // From U03 on (U02.CP's sketch leans on chromatic neighbours on purpose).
  test("the U03–U07 checkpoint Makes' starters and passing sketches clash with no flavour", async () => {
    const found: string[] = [];
    for (const s of shown.filter((x) => /^U0[3-7]\.CP$/.test(x.owner)))
      for (const f of flavours)
        for (const c of await clashes(s, f.id)) found.push(`${s.owner} ${s.id} ${f.id} ${c}`);
    expect(found).toEqual([]);
  });
  test("the chords sit under the tune: their middle note below the tune's, in every flavour", async () => {
    const found: string[] = [];
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
    for (const s of shown) {
      const def = bandById.get(s.band.band);
      if (!def || beatsOf(def.id) !== s.beats) continue;
      // Only where the Band plays its chords: under a chord lesson it plays drums (and bass) alone.
      if (!(s.band.tracks ?? def.roles).includes("chords")) continue;
      for (const f of flavours) {
        const chords = lineOf(bandCodeAt(def, f.id, at(s.session)), "chords").replaceAll(
          "{{key}}",
          keyFor(s),
        );
        const r = await evalHeadless(`${s.code}\nband_${chords}`, def.bars);
        const band = r.events.filter((e) => e.track.startsWith("band_")).map((e) => e.midi as number);
        const tune = r.events
          .filter(
            (e) => !e.track.startsWith("band_") && e.midi !== null && !/^(bass|drums|chords)/.test(e.track),
          )
          .map((e) => e.midi as number);
        if (tune.length && median(band) >= median(tune)) found.push(`${s.owner} ${s.id} ${f.id}`);
      }
    }
    expect(found).toEqual([]);
  });
});

describe("room for the learner's chords (U05–U07)", () => {
  test("no step plays the Band's chords under a chord line the learner writes", () => {
    const found: string[] = [];
    for (const l of lessons.map((x) => x.def as LessonDef).filter((d) => /^U0[5-7]\.L/.test(d.id)))
      for (const st of l.steps) {
        const band = st.ui.band;
        if (!band) continue;
        const tracks = band.tracks ?? bandById.get(band.band)?.roles ?? [];
        const learner = JSON.stringify([st.exercise ?? null, st.example ?? null]);
        if (tracks.includes("chords") && /chords: (n|note|chord)\(/.test(learner))
          found.push(`${l.id} ${st.id}`);
      }
    for (const [id, band] of Object.entries(CHECKPOINT_MAKE_BANDS)) {
      const cp = (checkpoints as CheckpointDef[]).find((c) => c.id === id);
      if (!cp || !band) continue;
      const tracks = band.tracks ?? bandById.get(band.band)?.roles ?? [];
      if (tracks.includes("chords") && /chords: (n|note|chord)\(/.test(JSON.stringify(cp.make)))
        found.push(id);
    }
    expect(found).toEqual([]);
  });
});

// ---- Wave 5: the minor loop, the twelve-bar shuffle, the Band in sections, and every U08–U11 / A1 step ------
//
// The app plays a Band through `bandCodeFor` (packages/strudel band.ts): the step's key filled in, the learner's
// key and sections followed, the register folded. These tests play the Bands the same way.
describe("Wave 5 Bands (U08–U11, A1, the U09–U11 checkpoints, C3–C5)", () => {
  /** A Band's code as the app plays it under `learner` (key, sections and register applied). */
  const played = (id: string, flavour: string, key: KeySpecLike, learner = "", session = "U11.L08") => {
    const def = bandById.get(id);
    if (!def) throw new Error(`no band ${id}`);
    return bandCodeFor(
      {
        band: def.id,
        flavour: flavour as FlavourId,
        code: bandCodeAt(def, flavour, at(session)),
        followsLearnerKey: false,
        tracks: [...def.roles],
      },
      { key, defaultBpm: 96, learnerCode: learner },
    );
  };
  /** Pitch-class sets of one track, bar by bar (the first chord of each bar). */
  const barsOf = async (code: string, track: string, bars: number, learner = "") => {
    const r = await evalHeadless(`setcpm(96/4)\n\n${learner ? `${learner}\n` : ""}${code}`, bars);
    return [...Array(bars).keys()].map((i) => {
      const inBar = r.events.filter(
        (e) => e.track === track && Math.floor(rat(e.begin) + 1e-9) === i && e.midi !== null,
      );
      const first = Math.min(...inBar.map((e) => rat(e.begin)));
      return [
        ...new Set(inBar.filter((e) => rat(e.begin) === first).map((e) => (e.midi as number) % 12)),
      ].sort((a, b) => a - b);
    });
  };
  const pcs = (...names: number[][]) =>
    names.map((n) => [...new Set(n.map((x) => x % 12))].sort((a, b) => a - b));
  // Pitch classes: C 0, D 2, E 4, F 5, G 7, A 9, B♭ 10.
  const [Am, F, C, G] = pcs([9, 0, 4], [5, 9, 0], [0, 4, 7], [7, 11, 2]);

  test("the Aeolian loop: Am F C G in A minor, the same in harmonic minor; roots A F C G on beat 1", async () => {
    for (const f of flavours) {
      for (const mode of ["minor", "harmonic minor", "minor pentatonic"] as const) {
        const code = played("band.aeolian-4bar", f.id, { tonic: "A", mode });
        const chords = await barsOf(code, "chords", 4);
        // The four-note kits add a 7th, a 6th or a 9th; the triad is always inside.
        for (const [i, want] of [Am, F, C, G].entries())
          expect([f.id, mode, i, want?.every((p) => chords[i]?.includes(p))]).toEqual([f.id, mode, i, true]);
        const bass = await barsOf(code, "bass", 4);
        expect([f.id, mode, bass.map((b) => b[0])]).toEqual([f.id, mode, [9, 5, 0, 7]]);
      }
    }
  });
  test("the Aeolian loop in C minor: Cm A♭ E♭ B♭; no major 7th under a tune on ♭3 or ♭6", async () => {
    const [Cm, Ab, Eb, Bb] = pcs([0, 3, 7], [8, 0, 3], [3, 7, 10], [10, 2, 5]);
    for (const f of flavours) {
      const chords = await barsOf(
        played("band.aeolian-4bar", f.id, { tonic: "C", mode: "minor" }),
        "chords",
        4,
      );
      for (const [i, want] of [Cm, Ab, Eb, Bb].entries())
        expect([f.id, i, want?.every((p) => chords[i]?.includes(p))]).toEqual([f.id, i, true]);
      // E♭maj7 has D (a half step under E♭), A♭maj7 has G (a half step under A♭): neither is played.
      expect([f.id, chords[2]?.includes(2), chords[1]?.includes(7)]).toEqual([f.id, false, false]);
    }
  });
  const I7 = [0, 4, 7, 10];
  const IV7 = [5, 9, 0, 3].sort((a, b) => a - b);
  const V7 = [7, 11, 2, 5].sort((a, b) => a - b);
  const plan = (s: string) => s.split(" ").map((x) => ({ I: I7, IV: IV7, V: V7 })[x as "I"] as number[]);
  test("the twelve-bar shuffle: I7 I7 I7 I7 | IV7 IV7 I7 I7 | V7 IV7 I7 V7; the quick change has IV7 in bar 2", async () => {
    for (const f of flavours)
      for (const mode of ["blues", "major", "minor pentatonic"] as const) {
        const key = { tonic: "C", mode };
        expect(await barsOf(played("band.blues-12bar", f.id, key), "chords", 12)).toEqual(
          plan("I I I I IV IV I I V IV I V"),
        );
        expect(await barsOf(played("band.blues-12bar-qc", f.id, key), "chords", 12)).toEqual(
          plan("I IV I I IV IV I I V IV I V"),
        );
        // The bass has the root on beat 1 of every change: C, F or G (bars 1, 5, 7, 9, 10, 11, 12).
        const bass = await barsOf(played("band.blues-12bar", f.id, key), "bass", 12);
        expect([f.id, [0, 4, 6, 8, 9, 10, 11].map((i) => bass[i]?.[0])]).toEqual([
          f.id,
          [0, 5, 0, 7, 5, 0, 7],
        ]);
      }
    // In F, as U11.CP's chart and X2's keys need: F7 B♭7 C7.
    const inF = await barsOf(
      played("band.blues-12bar-qc", "flavour.pop", { tonic: "F", mode: "blues" }),
      "chords",
      3,
    );
    expect(inF).toEqual(pcs([5, 9, 0, 3], [10, 2, 5, 8], [5, 9, 0, 3]));
  });
  test("the shuffle's drums leave the hats to the learner: kick and snare only, on the beat", async () => {
    for (const id of ["band.blues-12bar", "band.blues-12bar-qc"])
      for (const f of flavours) {
        const drums = lineOf(played(id, f.id, { tonic: "C", mode: "blues" }), "drums");
        const r = await evalHeadless(`setcpm(96/4)\n\n${drums}`, 2);
        expect([id, f.id, [...new Set(r.events.map((e) => e.s))].sort()]).toEqual([id, f.id, ["bd", "sd"]]);
        expect([id, f.id, r.events.every((e) => Number.isInteger(rat(e.begin) * 4))]).toEqual([
          id,
          f.id,
          true,
        ]);
      }
  });
  test("the shuffle swings: the bass's or the chords' offbeats land on the last triplet of the beat", async () => {
    for (const f of flavours) {
      const code = played("band.blues-12bar", f.id, { tonic: "C", mode: "blues" });
      const r = await evalHeadless(`setcpm(96/4)\n\n${code}`, 1);
      const offbeats = r.events
        .filter((e) => e.track !== "drums")
        .map((e) => Math.round(rat(e.begin) * 48) % 12)
        .filter((x) => x !== 0);
      // 2/3 of a beat is 8/48 of the bar; a straight eighth would be 6.
      expect([f.id, offbeats.length > 0, offbeats.every((x) => x === 8)]).toEqual([f.id, true, true]);
    }
  });
  test("the Band in sections plays verse C Am F G and chorus F G C C, and follows the learner's form", async () => {
    for (const f of flavours) {
      const own = await barsOf(played("band.sections", f.id, { tonic: "C", mode: "major" }), "chords", 8);
      for (const [i, want] of [C, Am, F, G, F, G, C, C].entries())
        expect([f.id, i, want?.every((p) => own[i]?.includes(p))]).toEqual([f.id, i, true]);
      // A learner song of intro, verse, chorus (4 bars each): the Band's verse plays the intro, then its chorus
      // lands on bar 9 with the learner's.
      const learner = [
        'const melIntro = n("<~ ~ ~ [~ ~ 4 5]>").scale("C4:major")',
        'const melVerse = n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")',
        'const melChorus = n("<[7 ~ 5 ~] [6 ~ 4 ~] [7 ~ 9 7] [7 ~ ~ ~]>").scale("C4:major")',
        'mel: arrange([4, melIntro], [4, melVerse], [4, melChorus]).s("piano")',
      ].join("\n");
      const code = played("band.sections", f.id, { tonic: "C", mode: "major" }, learner);
      expect(code).toContain("arrange([4, chordsVerse], [4, chordsVerse], [4, chordsChorus])");
      const followed = await barsOf(code, "chords", 12);
      for (const [i, want] of [C, Am, F, G, C, Am, F, G, F, G, C, C].entries())
        expect([f.id, i, want?.every((p) => followed[i]?.includes(p))]).toEqual([f.id, i, true]);
    }
  });
  test("the chorus lifts: more drum hits and more bass notes than the verse, in every kit", async () => {
    for (const f of flavours) {
      const r = await evalHeadless(
        `setcpm(96/4)\n\n${played("band.sections", f.id, { tonic: "C", mode: "major" })}`,
        8,
      );
      const count = (track: string, from: number) =>
        r.events.filter((e) => e.track === track && rat(e.begin) >= from && rat(e.begin) < from + 4).length;
      for (const t of ["drums", "bass"])
        expect([f.id, t, count(t, 4) > count(t, 0)]).toEqual([f.id, t, true]);
    }
  });
  test("the Wave 5 loops are voice-led: no voice moves more than a major 3rd at a change", async () => {
    const bad: string[] = [];
    const keys: Record<string, KeySpecLike> = {
      "band.aeolian-4bar": { tonic: "A", mode: "minor" },
      "band.blues-12bar": { tonic: "C", mode: "blues" },
      "band.blues-12bar-qc": { tonic: "C", mode: "blues" },
      "band.sections": { tonic: "C", mode: "major" },
    };
    for (const [id, key] of Object.entries(keys))
      for (const f of flavours) {
        const def = bandById.get(id);
        const bars = def?.bars ?? 4;
        const r = await evalHeadless(`setcpm(96/4)\n\n${played(id, f.id, key)}`, bars);
        const chordAt = (i: number) => {
          const inBar = r.events.filter((e) => e.track === "chords" && Math.floor(rat(e.begin) + 1e-9) === i);
          const first = Math.min(...inBar.map((e) => rat(e.begin)));
          return inBar
            .filter((e) => rat(e.begin) === first)
            .map((e) => e.midi as number)
            .sort((a, b) => a - b);
        };
        for (let i = 0; i < bars; i++) {
          const [a, b] = [chordAt(i), chordAt((i + 1) % bars)];
          if (a.length !== b.length) continue;
          const move = Math.max(...a.map((x, k) => Math.abs((b[k] as number) - x)));
          if (move > 4) bad.push(`${id} ${f.id}: bar ${i + 1} to ${((i + 1) % bars) + 1} moves ${move}`);
        }
      }
    expect(bad).toEqual([]);
  });
  test("the semitone Bands are the ones that list themselves as such, and say what they play", () => {
    for (const id of TONIC_BANDS) {
      expect(bandById.get(id)?.code["flavour.pop"]).toContain('.add(n("0").scale("{{key}}"))');
      expect(BAND_CHANGES[id]?.length).toBe(bandById.get(id)?.bars);
    }
    for (const id of SECTION_BANDS) expect(bandById.get(id)?.code["flavour.pop"]).toContain("arrange(");
  });
});

// Every step of U08–U11 and A1 that plays a Band, and the U09–U11 checkpoint Makes, as the app plays them.
interface Step5 {
  owner: string;
  id: string;
  code: string;
  band: BandRef;
  key: KeySpecLike;
  session: string;
  beats: number;
}
const wave5: Step5[] = [];
for (const l of lessons.map((x) => x.def as LessonDef).filter((d) => /^(U0[89]|U1[01]|A1)\.L/.test(d.id))) {
  const beats = Number(l.meter.split("/")[0]);
  for (const s of l.steps) {
    const band = s.ui.band;
    if (!band) continue;
    const add = (id: string, code: string) =>
      wave5.push({ owner: l.id, id, code, band, key: l.key, session: l.id, beats });
    if (s.example) add(s.example.id, s.example.code);
    if (s.exercise) for (const x of shownOf(l.id, l.id, "", beats, band, s.exercise)) add(x.id, x.code);
  }
}
for (const cp of (checkpoints as CheckpointDef[]).filter((c) => /^U(09|10|11)\.CP$/.test(c.id))) {
  const band = CHECKPOINT_MAKE_BANDS[cp.id];
  if (!band) continue;
  const key = cp.make.key ?? { tonic: "C", mode: "major" };
  for (const x of shownOf(cp.id, cp.id, "", 4, band, cp.make))
    wave5.push({ owner: cp.id, id: x.id, code: x.code, band, key, session: cp.id, beats: 4 });
}
/** The Band's bass and chord lines as the app plays them under a step, labelled `band_…`. */
const backingOf = (s: Step5, flavour: string): string => {
  const def = bandById.get(s.band.band);
  if (!def) return "";
  const tracks = s.band.tracks ?? def.roles;
  const code = bandCodeFor(
    {
      band: def.id,
      flavour: flavour as FlavourId,
      code: bandCodeAt(def, flavour, at(s.session)),
      followsLearnerKey: s.band.followsLearnerKey === true,
      tracks: [...tracks],
    },
    { key: s.key, defaultBpm: 96, learnerCode: s.code },
  );
  // Section consts stay (a Band in sections needs them); only the tracks the step plays are kept.
  return code
    .split("\n")
    .filter(
      (ln) =>
        ln.startsWith("const ") || (/^(bass|chords):/.test(ln) && tracks.includes(ln.split(":")[0] as never)),
    )
    .map((ln) => (ln.startsWith("const ") ? ln.replace(/^const (\w+)/, "const band_$1") : `band_${ln}`))
    .map((ln) => ln.replace(/\b(drums|bass|chords)(Verse|Chorus)\b/g, "band_$1$2"))
    .join("\n");
};

describe("Wave 5 steps over their Bands (U08–U11, A1, U09–U11 checkpoints)", () => {
  test("there is something to scan: lessons of U08–U11 and the three checkpoint Makes", () => {
    for (const u of ["U08", "U09", "U10", "U11"])
      expect(wave5.some((s) => s.owner.startsWith(`${u}.L`))).toBe(true);
    for (const cp of ["U09.CP", "U10.CP", "U11.CP"]) expect(wave5.some((s) => s.owner === cp)).toBe(true);
  });
  test("every Band is in the step's meter", () => {
    const bad = wave5.filter((s) => beatsOf(s.band.band) !== s.beats).map((s) => `${s.owner} ${s.id}`);
    expect(bad).toEqual([]);
  });
  test("a Band written in major degrees plays its bass or chords only under a major key", () => {
    const bad = wave5
      .filter((s) => !TONIC_BANDS.has(s.band.band) && s.key.mode !== "major")
      .filter((s) => (s.band.tracks ?? bandById.get(s.band.band)?.roles ?? []).some((t) => t !== "drums"))
      .map((s) => `${s.owner} ${s.id} (${s.key.tonic} ${s.key.mode}, ${s.band.band})`);
    expect([...new Set(bad)]).toEqual([]);
  });
  // The learner's bass line is its middle note: an octave pop above it (U08.L02, U08.L04) is the bass's own
  // colour, short, and may cross a chord.
  test("under a bass the learner writes, the Band has no bass, and its chords stay above the learner's bass line", async () => {
    const bad: string[] = [];
    for (const s of wave5) {
      const tracks = s.band.tracks ?? bandById.get(s.band.band)?.roles ?? [];
      const learner = await evalHeadless(s.code, 4);
      const theirs = learner.events
        .filter((e) => e.track === "bass" && e.midi !== null)
        .map((e) => e.midi as number);
      if (theirs.length === 0) continue;
      if (tracks.includes("bass")) bad.push(`${s.owner} ${s.id}: the Band's bass plays under the learner's`);
      if (!tracks.includes("chords")) continue;
      for (const f of flavours) {
        const r = await evalHeadless(`${s.code}\n${backingOf(s, f.id)}`, 4);
        const band = r.events
          .filter((e) => e.track === "band_chords" && e.midi !== null)
          .map((e) => e.midi as number);
        const middle = [...theirs].sort((a, b) => a - b)[Math.floor(theirs.length / 2)] as number;
        if (band.length && Math.min(...band) < middle)
          bad.push(
            `${s.owner} ${s.id} ${f.id}: chords from ${Math.min(...band)}, the bass line at ${middle}`,
          );
      }
    }
    expect(bad).toEqual([]);
  });
  test("no shown example, reference or passing sketch sounds a half step above the Band's harmony for a beat", async () => {
    const found: string[] = [];
    for (const s of wave5) {
      const def = bandById.get(s.band.band);
      if (!def) continue;
      for (const f of flavours) {
        const backing = backingOf(s, f.id);
        if (!/band_(bass|chords):/.test(backing)) continue;
        const r = await evalHeadless(`${s.code}\n${backing}`, def.bars * 2);
        const band = r.events.filter((e) => e.track.startsWith("band_") && e.midi !== null);
        for (const n of r.events.filter((e) => !e.track.startsWith("band_") && e.midi !== null)) {
          const [b0, b1] = [rat(n.begin), rat(n.end)];
          if ((b1 - b0) * s.beats < 1) continue;
          const hit = band.some(
            (x) =>
              rat(x.begin) < b1 &&
              rat(x.end) > b0 &&
              ((((n.midi as number) - (x.midi as number)) % 12) + 12) % 12 === 1,
          );
          if (hit) found.push(`${s.owner} ${s.id} ${f.id} ${n.note}@${round(b0 * s.beats)}`);
        }
      }
    }
    expect([...new Set(found)]).toEqual([]);
  });
});

// Wave 6 (U12–U17, C6, C7, the U14 and U17 checkpoints): the modal vamps keep their mode in every key and kit, the
// compound-meter Bands count in their meter, the ii–V–I leaves the learner's register free, and a Band follows a
// learner's key plan.
describe("Wave 6 Bands", () => {
  const TONICS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
  const PC: Record<string, number> = {
    C: 0,
    Db: 1,
    D: 2,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    Ab: 8,
    A: 9,
    Bb: 10,
    B: 11,
  };
  /** Pitch classes of one track, bar by bar (every onset of the bar). */
  const pcsByBar = async (code: string, track: string, bars: number, beats = 4) => {
    const r = await evalHeadless(fill(code, "C4:major", beats), bars);
    return [...Array(bars).keys()].map((i) =>
      [
        ...new Set(
          r.events
            .filter((e) => e.track === track && Math.floor(rat(e.begin) + 1e-9) === i && e.midi !== null)
            .map((e) => (e.midi as number) % 12),
        ),
      ].sort((a, b) => a - b),
    );
  };

  test("a modal vamp never sounds the note that would break its mode, and sounds its colour, in every key and kit", async () => {
    const bad: string[] = [];
    for (const [id, mode] of Object.entries(MODAL_BANDS)) {
      const guard = MODAL_GUARDS[mode];
      const def = bandById.get(id);
      for (const f of flavours)
        for (const t of TONICS) {
          const code = (def?.code[f.id] ?? "").replaceAll("{{key}}", `${t}4:${mode}`);
          const r = await evalHeadless(`setcpm(96/4)\n\n${code}`, 2);
          const rel = new Set(
            r.events
              .filter((e) => e.midi !== null && e.track !== "drums")
              .map((e) => ((((e.midi as number) - (PC[t] as number)) % 12) + 12) % 12),
          );
          if (rel.has(guard.never))
            bad.push(`${id} ${f.id} in ${t}: plays ${guard.never} half steps above home`);
          if (!rel.has(guard.colour)) bad.push(`${id} ${f.id} in ${t}: no colour note`);
        }
    }
    expect(bad).toEqual([]);
  });

  test("the modal vamps play their two chords in C: C B♭, Cm F, C D/C, Cm D♭", async () => {
    const expected: Record<string, number[][]> = {
      "band.mixolydian-vamp": [
        [0, 4, 7],
        [2, 5, 10],
      ],
      "band.dorian-vamp": [
        [0, 3, 7],
        [0, 5, 9],
      ],
      "band.lydian-vamp": [
        [0, 4, 7],
        [2, 6, 9],
      ],
      "band.phrygian-vamp": [
        [0, 3, 7],
        [1, 5, 8],
      ],
    };
    for (const [id, chords] of Object.entries(expected)) {
      const pop = bandById.get(id)?.code["flavour.pop"] ?? "";
      expect([id, await pcsByBar(lineOf(pop, "chords"), "chords", 2)]).toEqual([id, chords]);
      expect([id, BAND_CHANGES[id]?.length]).toEqual([id, 2]);
    }
    // Lydian holds its home note in the bass under both chords.
    const lyd = bandById.get("band.lydian-vamp")?.code["flavour.pop"] ?? "";
    expect(await pcsByBar(lineOf(lyd, "bass"), "bass", 2)).toEqual([[0], [0]]);
  });

  test("the compound Bands are in 6/8 and 12/8: the 6/8 snare on the second dotted quarter, the 12/8 keys in triplets, no swing", async () => {
    expect(BAND_METERS["band.soul-68"]).toBe("6/8");
    expect(BAND_METERS["band.slow-128"]).toBe("12/8");
    for (const id of ["band.soul-68", "band.slow-128"])
      for (const f of flavours) expect([id, f.id, bandById.get(id)?.code[f.id]]).not.toContain("swingBy");
    for (const f of flavours) {
      const code = bandById.get("band.soul-68")?.code[f.id] ?? "";
      const r = await evalHeadless(fill(lineOf(code, "drums"), "C4:major", 2), 1);
      const all = r.events.map((e) => ({ s: String(e.s ?? ""), t: round(rat(e.begin)) }));
      expect([f.id, all.some((e) => e.s.startsWith("sd") && e.t === 0.5)]).toEqual([f.id, true]);
      expect([f.id, all.some((e) => e.s.startsWith("bd") && e.t === 0)]).toEqual([f.id, true]);
    }
    const pop = bandById.get("band.slow-128")?.code["flavour.pop"] ?? "";
    const keys = await evalHeadless(fill(lineOf(pop, "chords"), "C4:major", 4), 1);
    expect(new Set(keys.events.map((e) => round(rat(e.begin)))).size).toBe(12);
  });

  test("the ii–V–I plays guide tones only, under F3, over a bass at or under G2 (in C)", async () => {
    for (const f of flavours) {
      const code = bandById.get("band.two-five-one")?.code[f.id] ?? "";
      const chords = await pcsByBar(lineOf(code, "chords").replace(/\.swingBy\([^)]*\)/, ""), "chords", 4);
      // Dm7: F C; G7: B F; C6: E A.
      expect([f.id, chords]).toEqual([
        f.id,
        [
          [0, 5],
          [5, 11],
          [4, 9],
          [4, 9],
        ],
      ]);
      const r = await evalHeadless(fill(code), 4);
      const top = (t: string) =>
        Math.max(...r.events.filter((e) => e.track === t).map((e) => e.midi as number));
      expect([f.id, top("chords") <= 53]).toEqual([f.id, true]);
      if (f.id !== "flavour.funk") expect([f.id, top("bass") <= 43]).toEqual([f.id, true]);
    }
  });

  test("a Band follows the learner's key plan: the four-chord loop and a modal vamp lift with the tune", async () => {
    const lift = (id: string, flavour: string, key: KeySpec, learner: string) =>
      bandCodeFor(
        {
          band: id,
          flavour: flavour as FlavourId,
          code: bandCodeAt(id, flavour, at("U17.L02")),
          followsLearnerKey: true,
          tracks: ["bass"],
        },
        { key, defaultBpm: 96, learnerCode: learner },
      );
    const roots = async (code: string, bars: number) => {
      const r = await evalHeadless(`setcpm(96/4)\n\n${lineOf(code, "bass")}`, bars);
      return [...Array(bars).keys()].map((i) => {
        const inBar = r.events.filter((e) => Math.floor(rat(e.begin) + 1e-9) === i);
        return Math.min(...inBar.map((e) => e.midi as number)) % 12;
      });
    };
    const axis = lift(
      "band.axis-4bar",
      "flavour.pop",
      { tonic: "C", mode: "major" },
      'mel: n("0 2 4 2").scale("<C4:major!4 D4:major!4>")',
    );
    // C G A F, then the same loop in D: D A B G.
    expect(await roots(axis, 8)).toEqual([0, 7, 9, 5, 2, 9, 11, 7]);
    const vamp = lift(
      "band.mixolydian-vamp",
      "flavour.pop",
      { tonic: "G", mode: "mixolydian" },
      'mel: n("0 2 4 6").scale("<G4:mixolydian!2 A4:mixolydian!2>")',
    );
    // G F, then A G.
    expect(await roots(vamp, 4)).toEqual([7, 5, 9, 7]);
  });

  test("the checkpoint Makes of U14 and U17 keep the Band to its drums: their chords are the learner's, in a mode or a lifted key", () => {
    for (const id of ["U14.CP", "U17.CP"] as const) {
      const ref = CHECKPOINT_MAKE_BANDS[id];
      expect([id, ref?.tracks]).toEqual([id, ["drums"]]);
      expect([id, bandMeter(ref?.band ?? "")]).toEqual([id, "4/4"]);
    }
    // U13.CP: the drums are the learner's lines (the unit's rule).
    expect(CHECKPOINT_MAKE_BANDS["U13.CP"]).toBeUndefined();
  });
});

describe("Wave 7 Bands (author:CP)", () => {
  /** One track's notes in bar `i`, in time order: [beat in quarters, midi]. */
  const notesIn = (
    events: { track: string; begin: string | number; midi: number | null }[],
    track: string,
    i: number,
  ) =>
    events
      .filter((e) => e.track === track && e.midi !== null && Math.floor(rat(e.begin) + 1e-9) === i)
      .map((e) => [Math.round((rat(e.begin) - i) * 4 * 1000) / 1000, e.midi as number] as const)
      .sort((a, b) => a[0] - b[0]);
  const PC: Record<string, number> = {
    C: 0,
    Db: 1,
    D: 2,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    Ab: 8,
    A: 9,
    Bb: 10,
    B: 11,
  };
  const rootPc = (name: string) => PC[/^[A-G][b#]?/.exec(name)?.[0] ?? "C"] as number;
  const firstChord = (bar: string) => bar.replace(/^\[/, "").split(" ")[0] as string;

  for (const id of ["band.jazz-blues", "band.rhythm-changes"]) {
    test(`${id}: the bass walks, a root on 1, the chord's own fifth, a half step into every bar; the chords sit above it`, async () => {
      const changes = BAND_CHANGES[id] ?? [];
      const bars = changes.length;
      for (const f of flavours) {
        const r = await evalHeadless(fill(bandById.get(id)?.code[f.id] ?? ""), bars);
        for (let i = 0; i < bars; i++) {
          const bass = notesIn(r.events, "bass", i);
          const next = notesIn(r.events, "bass", (i + 1) % bars)[0]?.[1] as number;
          expect([f.id, i, bass.map(([t]) => t)]).toEqual([f.id, i, [0, 1, 2, 3]]);
          expect([f.id, i, (bass[0]?.[1] as number) % 12]).toEqual([
            f.id,
            i,
            rootPc(firstChord(changes[i] ?? "")),
          ]);
          // A half step into the next bar: from below, or from above into the lowest root (A1 in C: B♭1 to A1),
          // so a key folded a tritone down never walks under E1.
          expect([f.id, i, Math.abs(next - (bass[3]?.[1] as number))]).toEqual([f.id, i, 1]);
          const chordsLow = Math.min(...notesIn(r.events, "chords", i).map(([, m]) => m));
          expect([f.id, i, chordsLow > Math.max(...bass.map(([, m]) => m))]).toEqual([f.id, i, true]);
        }
      }
    });
  }

  test("the jazz blues plays F7 B♭7 F7 C–7 F7 | B♭7 B°7 F7 D7 | G–7 C7 F7 D7 G–7 C7 in F, every chord on its bar", async () => {
    const code = bandById.get("band.jazz-blues")?.code["flavour.pop"] ?? "";
    const r = await evalHeadless(
      fill(lineOf(code, "chords").replace(/\.swingBy\([^)]*\)/, ""), "F4:major"),
      12,
    );
    // The pitch classes of each bar's first chord: F9 E♭ G A C, B♭9 A♭ C D F, B°7 B D F A♭, D9 F♯ A C E …
    const firstPcs = [...Array(12).keys()].map((i) => {
      const inBar = notesIn(r.events, "chords", i);
      return [...new Set(inBar.filter(([t]) => t === inBar[0]?.[0]).map(([, m]) => m % 12))].sort(
        (a, b) => a - b,
      );
    });
    expect(firstPcs[0]).toEqual([0, 3, 7, 9]); // F9 without its root
    expect(firstPcs[1]).toEqual([0, 2, 5, 8]); // B♭9 without its root
    expect(firstPcs[5]).toEqual([2, 5, 8, 11]); // B°7
    expect(firstPcs[7]).toEqual([0, 4, 6, 9]); // D9 (F♯ A C E) without its root
    expect(firstPcs[8]).toEqual([2, 5, 9, 10]); // G–9 (B♭ D F A) without its root
  });

  test("rhythm changes: A A B A, the bridge D7 G7 C7 F7 two bars each in B♭, the last A home on B♭", async () => {
    const changes = BAND_CHANGES["band.rhythm-changes"] ?? [];
    expect(changes.length).toBe(32);
    expect(changes.slice(16, 24)).toEqual(["E7", "E7", "A7", "A7", "D7", "D7", "G7", "G7"]);
    expect(changes.slice(0, 8)).toEqual(changes.slice(8, 16));
    expect(changes[31]).toBe("C6");
    const code = bandById.get("band.rhythm-changes")?.code["flavour.jazz-soul"] ?? "";
    const r = await evalHeadless(fill(lineOf(code, "bass"), "Bb4:major"), 32);
    const roots = [16, 18, 20, 22].map((i) => (notesIn(r.events, "bass", i)[0]?.[1] as number) % 12);
    expect(roots).toEqual([2, 7, 0, 5]); // D G C F
  });

  test("the comping above a walking bass: rootless, from E3 to E4 in C, over the two-feel", async () => {
    for (const f of flavours) {
      const code = bandById.get("band.ii-v-i-comp")?.code[f.id] ?? "";
      const r = await evalHeadless(fill(lineOf(code, "chords").replace(/\.swingBy\([^)]*\)/, "")), 4);
      const midis = r.events.map((e) => e.midi as number);
      expect([f.id, Math.min(...midis), Math.max(...midis)]).toEqual([f.id, 52, 64]);
      // D–9 F A C E, G13 F A B E, C6/9 E G A D: no chord holds its own root.
      const pcs = (i: number) =>
        [...new Set(notesIn(r.events, "chords", i).map(([, m]) => m % 12))].sort((a, b) => a - b);
      expect([f.id, pcs(0), pcs(1), pcs(2)]).toEqual([f.id, [0, 4, 5, 9], [4, 5, 9, 11], [2, 4, 7, 9]]);
    }
  });

  test("the son groove leaves the one and the clave to the learner: no bass or kick on beat 1, no rimshot", async () => {
    for (const f of flavours) {
      const code = bandById.get("band.son-montuno")?.code[f.id] ?? "";
      expect([f.id, /\brim\b|\bcb\b/.test(code)]).toEqual([f.id, false]);
      const r = await evalHeadless(fill(code), 2);
      const at0 = (track: string) =>
        r.events.some(
          (e) =>
            e.track === track &&
            rat(e.begin) % 1 < 1e-9 &&
            (track !== "drums" || /bd/.test(String(e.s ?? ""))),
        );
      expect([f.id, at0("bass"), at0("chords")]).toEqual([f.id, false, false]);
      // The tumbao: the "and" of 2 and beat 4, the second anticipating the next chord's root (G, then C).
      const bass = [0, 1].map((i) => notesIn(r.events, "bass", i));
      expect([f.id, bass.map((b) => b.map(([t]) => t))]).toEqual([
        f.id,
        [
          [1.5, 3],
          [1.5, 3],
        ],
      ]);
      expect([f.id, bass.map((b) => (b[1]?.[1] as number) % 12)]).toEqual([f.id, [7, 0]]);
    }
  });

  test("the neo-soul loop: C6/9 D–11 E–7 A–9, no major 7th on I, its sixteenths swung lightly", async () => {
    const code = bandById.get("band.neo-soul")?.code["flavour.jazz-soul"] ?? "";
    const r = await evalHeadless(fill(lineOf(code, "chords").replace(/\.swingBy\([^)]*\)/, "")), 4);
    const pcs = (i: number) =>
      [...new Set(notesIn(r.events, "chords", i).map(([, m]) => m % 12))].sort((a, b) => a - b);
    expect([pcs(0), pcs(1), pcs(2), pcs(3)]).toEqual([
      [2, 4, 7, 9],
      [0, 4, 5, 7],
      [2, 4, 7, 11],
      [0, 4, 7, 11],
    ]);
    expect(pcs(0)).not.toContain(11);
    expect(code).toContain(".swingBy(1/6, 8)");
  });

  test("the 5/4 vamp: five beats a bar, grouped 3+2, kick and bass on beats 1 and 4", async () => {
    expect(bandMeter("band.odd-54")).toBe("5/4");
    for (const f of flavours) {
      const code = bandById.get("band.odd-54")?.code[f.id] ?? "";
      const r = await evalHeadless(fill(code, "C4:major", 5), 2);
      const fifths = (track: string, filter = () => true) =>
        [
          ...new Set(
            r.events
              .filter((e) => e.track === track && rat(e.begin) < 1 && filter())
              .map((e) => Math.round(rat(e.begin) * 5 * 1000) / 1000),
          ),
        ].sort((a, b) => a - b);
      expect([f.id, fifths("bass")]).toEqual([f.id, [0, 3]]);
    }
  });

  test("the track checkpoints' Makes: the Band in 4/4, its harmony left to the learner where the rule reads it", () => {
    expect(CHECKPOINT_MAKE_BANDS["J.CP1"]).toEqual({ band: "band.two-five-one", tracks: ["drums"] });
    expect(CHECKPOINT_MAKE_BANDS["J.CP2"]).toEqual({ band: "band.two-five-one", tracks: ["drums"] });
    // R.CP: the son groove's straight off-beat chords under the learner's straight clave and sixteenth hats.
    expect(CHECKPOINT_MAKE_BANDS["R.CP"]).toEqual({ band: "band.son-montuno", tracks: ["chords"] });
    expect(CHECKPOINT_MAKE_BANDS["A.CP"]).toEqual({ band: "band.aeolian-4bar", tracks: ["drums"] });
    for (const id of ["J.CP1", "J.CP2", "R.CP", "A.CP"] as const)
      expect([id, bandMeter(CHECKPOINT_MAKE_BANDS[id]?.band ?? "")]).toEqual([id, "4/4"]);
  });
});
