// Passive listening (contracts U04.L04, AUTHORING §16.5): a short guided stream of generated examples from a
// drill family, each named as it plays (`reveal: "with"`) or just after (`"after"`), with nothing to answer, no
// evidence and no SRS. Pure: the stream is planned here (deterministic for a seed), PassiveListen.tsx plays it.
//
// The key is held for a run of four examples and set by the family's own context (the cadence) at the start of
// each run, so the ear hears degrees against one home before the key moves on; later examples of a run are
// transposed into the run's key (a transposition keeps every degree and interval).
import type { Answer, Degree, FamilyId, KeySpec, LearnerProfile, Trial } from "@oak/api";
import {
  type AudioPlan,
  type DrillFamilyRuntime,
  eventsToAudioPlan,
  FAMILIES,
  generateTrial,
  openCategoriesOf,
  passiveSequence,
  trialAudio,
} from "@oak/drills";
import { syllableOf } from "@oak/theory";
import { optionLabel } from "./model.ts";
import { keyOfTrial } from "./plans.ts";

/** The block as content declares it (`ListenEx.passive`), minus the family's runtime. */
export interface PassiveSpec {
  family: FamilyId;
  level: number;
  items: number;
  reveal: "with" | "after";
  gapBeats: number;
}

export interface PassiveItem {
  index: number;
  /** "1 → 3", "do → mi", "4 · fa". */
  caption: string;
  /** "a 3rd", "harmonic", or null. */
  sub: string | null;
  /** The key-setting context before this example (the first of a run), else null. */
  cue: AudioPlan | null;
  /** The example itself, in the run's key. */
  example: AudioPlan;
  /** Silence after the example (the `gapBeats`, in seconds). */
  gapSec: number;
  /** "D major", for the stimulus panel. */
  keyName: string | null;
}

const RUN = 4;
const GENERIC: Record<string, string> = {
  i2: "a 2nd",
  i3: "a 3rd",
  i4: "a 4th",
  i5: "a 5th",
  i6: "a 6th",
  i7: "a 7th",
  i8: "an octave",
};

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function pcOf(tonic: string): number {
  const base = PC[tonic[0]?.toUpperCase() ?? "C"] ?? 0;
  const acc = tonic.slice(1);
  const alt = [...acc].reduce((a, c) => a + (c === "#" ? 1 : c === "b" ? -1 : 0), 0);
  return (((base + alt) % 12) + 12) % 12;
}
/** Semitones from `from` to `to`, the nearest way (−5…6). */
function shiftBetween(from: KeySpec, to: KeySpec): number {
  const d = (((pcOf(to.tonic) - pcOf(from.tonic)) % 12) + 12) % 12;
  return d > 6 ? d - 12 : d;
}

export function keyName(key: KeySpec | undefined | null): string | null {
  if (!key) return null;
  return `${key.tonic.replace(/b$/, "♭").replace(/#$/, "♯")} ${key.mode}`;
}

const deg = (d: Degree, solfege: boolean): string =>
  solfege ? syllableOf(d) : d.replace(/b/g, "♭").replace(/#/g, "♯");

/** What an example is called: its degrees (with syllables when the solfège lens is on) and its category. */
export function passiveCaption(
  trial: Trial<unknown>,
  solfege: boolean,
): { caption: string; sub: string | null } {
  const expected = trial.expected as Answer;
  const harmonic = trial.params.shape === "harmonic" || /harmonic/.test(String(trial.params.direction ?? ""));
  if (expected.degrees && expected.degrees.length > 0) {
    const ds = expected.degrees as Degree[];
    if (ds.length === 1) {
      const d = ds[0] as Degree;
      return { caption: `${deg(d, false)} · ${syllableOf(d)}`, sub: null };
    }
    const caption = ds.map((d) => deg(d, solfege)).join(harmonic ? " + " : " → ");
    const generic = GENERIC[trial.category] ?? null;
    return { caption, sub: [generic, harmonic ? "together" : null].filter(Boolean).join(", ") || null };
  }
  const gen = FAMILIES.find((f) => f.id === trial.family)?.generator;
  if (expected.choice && expected.choice.length > 0) {
    const ids = expected.choice;
    return { caption: ids.map((id) => optionLabel(id, gen, ids)).join(", "), sub: null };
  }
  return { caption: optionLabel(trial.category, gen), sub: null };
}

/**
 * The stream: `items` examples at `level`, in the engine's balanced order (`passiveSequence`: shuffled rounds of
 * the level's open categories — all of the level's when none is open yet — never the same one twice in a row),
 * the key held for runs of four.
 */
export function passiveItems(
  family: DrillFamilyRuntime,
  spec: Pick<PassiveSpec, "level" | "items" | "gapBeats">,
  opts: { seed: number; openCategories: readonly string[]; profile: LearnerProfile; solfege: boolean },
): PassiveItem[] {
  const def = family.def;
  const level = Math.max(1, Math.min(def.levels.length, spec.level));
  const params = def.levels[level - 1];
  if (!params) return [];
  const open = openCategoriesOf(params, opts.openCategories);
  const cats = open.length > 0 ? open : [...params.categories];
  if (cats.length === 0) return [];
  const items = Math.max(1, Math.min(40, spec.items));
  const order = passiveSequence(family, level, items, opts.seed, cats);
  const out: PassiveItem[] = [];
  let runKey: KeySpec | undefined;
  let previous: Trial | undefined;
  for (const [i, s] of order.entries()) {
    let trial: Trial;
    try {
      trial = generateTrial(
        family,
        { index: i, family: def.id, level, category: s.category, seed: s.seed },
        opts.profile,
        cats,
        previous,
      ) as Trial;
    } catch {
      continue;
    }
    previous = trial;
    const key = keyOfTrial(trial);
    const newRun = i % RUN === 0 || !runKey;
    if (newRun) runKey = key;
    const shift = key && runKey && !newRun ? shiftBetween(key, runKey) : 0;
    const cueBars = Number(trial.params.cueBars ?? 0);
    const audio = trialAudio(trial, key);
    const example = eventsToAudioPlan(trial.events, trial.cps, { fromBar: cueBars, transpose: shift });
    if (example.events.length === 0) continue;
    const { caption, sub } = passiveCaption(trial, opts.solfege);
    const beatSec = 1 / trial.cps / 4;
    out.push({
      index: out.length,
      caption,
      sub,
      cue: newRun ? audio.cue : null,
      example,
      gapSec: Math.max(0.3, spec.gapBeats * beatSec),
      // Major and minor on one tonic (Wave 5): the run shares the tonic, never one mode's name.
      keyName:
        def.generator === "key-mode" && runKey
          ? `On ${runKey.tonic.replace(/b$/, "♭").replace(/#$/, "♯")}`
          : keyName(runKey),
    });
  }
  return out;
}

/** Seconds the stream lasts (for the "about a minute" line). */
export function passiveSeconds(items: readonly PassiveItem[]): number {
  return items.reduce((s, it) => s + (it.cue?.durationSec ?? 0) + it.example.durationSec + it.gapSec, 0);
}

/** Families with a guided listening block before practice: named in-key pairs and degrees. */
export const PASSIVE_GENERATORS: readonly string[] = [
  "interval-in-key",
  "degree-id",
  // Wave 5: major and minor (and later modes) on one tonic, and straight against swung, labelled as they play.
  "key-mode",
  "rhythm-swing",
];
