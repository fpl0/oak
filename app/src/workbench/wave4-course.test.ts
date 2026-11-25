// Wave 4 review: every U05–U07 shown example, reference solution and Make starter (lessons and checkpoints) walked
// through the Workbench as the lesson player shows it (the step's key, meter, pickup and the Band parts it hears),
// with the chord lenses on. For each one, independently of the code under test:
// - the chord band: every region is the chord @oak/theory reads from the pitch classes sounding at its start (the
//   lowest heard note as the bass), and its numeral is theory's numeral of that chord in the key;
// - the staff: what abcjs parses back from every page sounds exactly the learner's notes (chord noteheads and
//   accidentals included), and every chord symbol (above) and numeral (below) stands at the onset its chord starts
//   on, in the bar it belongs to (the pickup bar engraved short);
// - the lead sheet (the learner's switch, U07.L09): the melody alone, with the same labels at the same onsets.
// Then every example written with `.scale()` is played again in every key the three units use (twelve tonics,
// seven flats and seven sharps included) and walked the same way.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { KeySpec, LessonDef, MeterId, PickupSpec } from "@oak/content-kit";
import { flattenExercise, R, stripMarkers } from "@oak/content-kit";
import { evaluateForGrading, initRealm } from "@oak/grader";
import { chordSymbolDisplay, numeralDisplay } from "@oak/notation";
import { chordOfRoman, displayRN, METERS, parseRN, readChord, romanText, toLeadSheet } from "@oak/theory";
import { loadCheckpointFiles, loadLessons } from "../../../content/lib/load.bun.ts";
import { checkAbc, readBack } from "../../../packages/notation/corpus/harness.ts";
import { bandCodeFor } from "../../../packages/strudel/src/band.ts";
import { bandSetupOf } from "../lesson/band.ts";
import {
  buildModel,
  leadEvents,
  type StaffSource,
  staffPage,
  staffPageCount,
  type WorkbenchModel,
} from "./model.ts";

setDefaultTimeout(120_000);

interface Shown {
  where: string;
  code: string;
  bars: number;
  key: KeySpec;
  meter: MeterId;
  pickup: PickupSpec | null;
  band: { code: string; heard: ("drums" | "bass" | "chords")[] } | null;
}

let SHOWN: Shown[] = [];

beforeAll(async () => {
  await initRealm({ toolbox: [], lockdown: false });
  const { lessons } = await loadLessons();
  const wave4 = lessons.filter((l) => /^U0[5-7]\./.test(l.def.id));
  SHOWN = wave4.flatMap((l) => shownOf(l.def));
  const { defs } = await loadCheckpointFiles();
  for (const cp of defs.filter((d) => /^U0[5-7]\.CP$/.test(d.id))) {
    const items = [...cp.authored, cp.make];
    SHOWN.push(
      ...shownOf({
        id: cp.id,
        key: { tonic: "C", mode: "major" },
        meter: "4/4",
        bpm: 90,
        steps: items.map((e, i) => ({ id: `I${i + 1}`, ui: {}, exercise: e })),
      } as unknown as LessonDef),
    );
  }
});

function shownOf(def: LessonDef): Shown[] {
  const out: Shown[] = [];
  for (const s of def.steps) {
    const exs = s.exercise ? flattenExercise(s.exercise) : [];
    const first = exs[0];
    const key = (first && "key" in first && first.key) || def.key;
    const meter = (first && "meter" in first && first.meter) || def.meter;
    const pickup = (first && "pickup" in first && first.pickup) || def.pickup || null;
    const setup = bandSetupOf(s.ui.band, { flavour: "flavour.pop", key, bpm: def.bpm, at: def.id });
    const bandFor = (code: string): Shown["band"] =>
      setup
        ? {
            code: bandCodeFor(setup, { learnerCode: code, key, defaultBpm: def.bpm }),
            heard: setup.tracks as ("drums" | "bass" | "chords")[],
          }
        : null;
    const push = (where: string, code: string, bars: number) =>
      out.push({ where: `${def.id} ${s.id} ${where}`, code, bars, key, meter, pickup, band: bandFor(code) });
    if (s.example) push(s.example.id, s.example.code, s.example.bars);
    for (const e of exs) {
      const bars = "reference" in e && e.reference && "bars" in e.reference ? Number(e.reference.bars) : 4;
      if ("reference" in e && e.reference?.solutions)
        for (const [i, sol] of e.reference.solutions.entries()) push(`${e.id}:ref${i}`, sol, bars || 4);
      if (e.kind === "code-make") push(`${e.id}:starter`, stripMarkers(e.code.starter).code, 4);
    }
  }
  return out;
}

async function modelOf(s: Shown): Promise<WorkbenchModel | null> {
  const result = await evaluateForGrading(s.code, {
    mode: "lesson",
    bars: s.bars,
    lint: null,
    ...(s.band ? { band: s.band.code } : {}),
  });
  const out = buildModel(s.code, result, {
    meter: s.meter,
    key: s.key,
    staff: "auto",
    annotations: { degree: false, solfege: false, noteName: false },
    ...(s.pickup ? { pickup: s.pickup } : {}),
    bandHeard: s.band ? s.band.heard : null,
  });
  return out.ok ? out.model : null;
}

/** Theory's reading of every region, from the heard pitches sounding at its start. */
function regionProblems(s: Shown, m: WorkbenchModel): string[] {
  const h = m.harmony;
  if (!h) return [];
  const out: string[] = [];
  const heard = new Set((s.band?.heard ?? []).map((t) => `band.${t}`));
  const voices = m.events.filter(
    (e) =>
      e.midi !== null &&
      (!e.band || heard.has(e.track)) &&
      // The analysis reads chords from the harmony tracks (the melody's notes are not chord members).
      (h.source === "band" ? e.band : true),
  );
  const melodyIds = new Set(h.melody.keys());
  for (const r of h.regions) {
    const at = r.from + 1e-6;
    const sounding = voices.filter((e) => e.onset <= at && e.end > at && !melodyIds.has(e.id));
    if (sounding.length < 3) continue;
    const midis = sounding.map((e) => Math.round(e.midi as number));
    const bass = Math.min(...midis);
    const reading = readChord(
      midis.map((x) => ((x % 12) + 12) % 12),
      ((bass % 12) + 12) % 12,
    );
    if (!reading) continue;
    // An augmented triad divides the octave in three: any of its notes over the bass names the same sound, and
    // the band keeps the root the code spelled (`chord("Caug").voicing()` puts E lowest: C+/E, not E+).
    const aug = reading.quality === "aug" && /\+/.test(r.symbol);
    const k = m.key ?? s.key;
    const rnRaw = romanText(reading.chord, k);
    // Spelled in the key: the chord its numeral names there (C♯m in A major, never D♭m).
    const inKeyChord = rnRaw.includes("/") ? null : chordOfRoman(rnRaw, k);
    const symbol = inKeyChord ? toLeadSheet(inKeyChord) : reading.leadSheet;
    if (symbol !== r.symbol && !aug)
      out.push(`${s.where} @${r.from}: band shows ${r.symbol}, theory reads ${symbol}`);
    const parsed = parseRN(rnRaw, k);
    const rn = parsed && !rnRaw.includes("/") ? displayRN(parsed) : rnRaw.replace(/o/g, "°");
    if (r.rn !== null && r.rn !== rn && !aug)
      out.push(`${s.where} @${r.from}: numeral ${r.rn}, theory ${rn}`);
  }
  return out;
}

/** One spelling for comparing label texts: the staff prints ♭ ♯ ° where the ASCII form has b # o. */
const glyphs = (t: string) =>
  t
    .replace(/(?<=[A-G])b/g, "♭")
    .replace(/#/g, "♯")
    .replace(/(?<=[A-G][♯♭]?|[IViv])o/g, "°");

/**
 * Drawn pitches equal the notes the staff is given (the learner's, or the lead sheet's melody), and every label
 * stands at its chord's onset.
 */
function staffProblems(s: Shown, m: WorkbenchModel, lead = false): string[] {
  const src0 = m.staffSource;
  const h = m.harmony;
  if (!src0) return [];
  const melody = lead ? leadEvents(m) : null;
  if (lead && (!h || !melody?.length)) return [];
  const { trackKeySpans: _own, ...single } = src0;
  const src: StaffSource = melody ? { ...single, events: melody, staff: "lead", split: "register" } : src0;
  // A lead sheet engraves no `chord()` notes: their chord is the symbol over the staff.
  const shown = new Set(src.events.filter((e) => !(lead && e.chordSymbol)).map((e) => e.id));
  const out: string[] = [];
  const meter = METERS[s.meter];
  const W = meter.num / meter.den;
  const pickupLen = s.pickup ? R.toNum(s.pickup.units) / meter.unitsPerBar : 0;
  const withLabels = { ...src, chordSet: { symbols: true, romans: true } };
  for (let p = 0; p < staffPageCount(src); p++) {
    const page = staffPage(withLabels, p);
    if (!page.abc) {
      out.push(`${s.where} page ${p}: ${page.error}`);
      continue;
    }
    const drawn = readBack(page.abc.abc)
      .staves.filter((st) => !st.perc)
      .flatMap((st) => st.voices.flatMap((v) => v.flatMap((n) => n.midis)))
      .sort((a, b) => a - b);
    const inPage = m.events.filter(
      (e) =>
        shown.has(e.id) && e.midi !== null && e.onset >= page.startBar && e.onset < page.startBar + page.bars,
    );
    const sounding = inPage.map((e) => Math.round(e.midi as number)).sort((a, b) => a - b);
    // U07.L11 (Oak 2.0 W2) writes a motif and its copy on two tracks; where they meet in unison (the same pitch at
    // the same onset: the mirror's axis note, a copy not yet moved) the staff may draw one notehead for both. Only
    // such a unison may be drawn once; every other sounding note is drawn.
    const unisons = new Map<number, number>();
    if (s.where.startsWith("U07.L11")) {
      const seen = new Map<string, number>();
      for (const e of inPage) {
        const k = `${e.onset}|${Math.round(e.midi as number)}`;
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
      for (const [k, c] of seen) {
        const midi = Number(k.split("|")[1]);
        if (c > 1) unisons.set(midi, (unisons.get(midi) ?? 0) + c - 1);
      }
    }
    const left = new Map<number, number>();
    for (const x of sounding) left.set(x, (left.get(x) ?? 0) + 1);
    for (const x of drawn) left.set(x, (left.get(x) ?? 0) - 1);
    const mergedOnly =
      unisons.size > 0 && [...left].every(([midi, c]) => c >= 0 && c <= (unisons.get(midi) ?? 0));
    if (drawn.join() !== sounding.join() && !mergedOnly)
      out.push(`${s.where}${lead ? " lead" : ""} page ${p}: drew ${drawn} for ${sounding}`);
    if (!h) continue;
    const check = checkAbc(page.abc.abc);
    // A pickup is engraved short only when bar 0 is silent before it (a starter that sounds on beat 1 of bar 0
    // keeps the bar whole, and the Score says so).
    const firstBar = check.barTotals[0]?.[0]?.[0] ?? W;
    const engravedPickup = !!s.pickup && page.startBar === 0 && firstBar < W - 1e-9;
    const at = (cycle: number) => {
      const rel = cycle - page.startBar;
      if (!engravedPickup) return rel * W;
      return rel < 1 ? pickupLen * W - (1 - rel) * W : pickupLen * W + (rel - 1) * W;
    };
    const want = h.labels
      .filter((l) => l.bar >= page.startBar && l.bar < page.startBar + page.bars)
      .flatMap((l) => {
        const cycle = l.bar + (l.beat - 1) / meter.unitsPerBar;
        const onset = Math.round(at(cycle) * 1e6) / 1e6;
        return [
          `^${onset} ${glyphs(chordSymbolDisplay(l.symbol))}`,
          ...(l.rn ? [`_${onset} ${glyphs(numeralDisplay(l.rn))}`] : []),
        ];
      })
      .sort();
    const got = [
      ...new Set(
        check.labels.map(
          (l) => `${l.position === "below" ? "_" : "^"}${Math.round(l.onset * 1e6) / 1e6} ${glyphs(l.text)}`,
        ),
      ),
    ].sort();
    if (got.join("|") !== want.join("|"))
      out.push(
        `${s.where}${lead ? " lead" : ""} page ${p}: labels ${JSON.stringify(got)} want ${JSON.stringify(want)}`,
      );
  }
  return out;
}

/** Every tonic and mode the units' scales name, as `.scale()` arguments (octave kept from the example). */
const TONICS = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
const SCALE_ARG = /\.scale\("([A-G][#b]?)(-?\d):(major|minor)"\)/g;

/** The example with every `.scale()` moved to `tonic` (only examples in one key: a key plan is left alone). */
function inKey(s: Shown, tonic: string): Shown | null {
  const found = new Set([...s.code.matchAll(SCALE_ARG)].map((m) => `${m[1]}:${m[3]}`));
  if (found.size !== 1 || s.band) return null;
  const mode = [...found][0]?.split(":")[1] as "major" | "minor";
  const code = s.code.replace(
    SCALE_ARG,
    (_a, _t, oct: string, md: string) => `.scale("${tonic}${oct}:${md}")`,
  );
  return { ...s, where: `${s.where} in ${tonic} ${mode}`, code, key: { tonic, mode } as KeySpec };
}

async function walk(list: readonly Shown[]) {
  const problems: string[] = [];
  let regions = 0;
  let pages = 0;
  let skipped = 0;
  for (const s of list) {
    const m = await modelOf(s);
    if (!m) {
      skipped++;
      continue;
    }
    regions += m.harmony?.regions.length ?? 0;
    pages += m.staffSource ? staffPageCount(m.staffSource) : 0;
    problems.push(...regionProblems(s, m), ...staffProblems(s, m), ...staffProblems(s, m, true));
  }
  return { problems, regions, pages, skipped };
}

describe("U05–U07 on the Workbench: what is drawn is what sounds, labelled as theory reads it", () => {
  test("the course has its examples (sanity)", () => {
    expect(SHOWN.length).toBeGreaterThan(150);
    expect(SHOWN.some((s) => s.where.startsWith("U06.CP"))).toBe(true);
    expect(SHOWN.some((s) => s.pickup)).toBe(true);
    expect(SHOWN.some((s) => s.meter === "3/4")).toBe(true);
  });

  test("every example, reference and starter, in its own key", async () => {
    const r = await walk(SHOWN);
    expect(r.skipped).toBe(0);
    expect(r.regions).toBeGreaterThan(300);
    expect(r.pages).toBeGreaterThan(150);
    expect(r.problems).toEqual([]);
  });

  test("every example in one key, moved to all fifteen major and minor keys", async () => {
    const moved = SHOWN.flatMap((s) => TONICS.flatMap((t) => inKey(s, t) ?? []));
    expect(moved.length).toBeGreaterThan(500);
    const r = await walk(moved);
    expect(r.skipped).toBe(0);
    expect(r.problems).toEqual([]);
  }, 600_000);
});
