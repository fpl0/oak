// Stage G (jazz), the rest of stage H (swing ratio, clave, odd groupings, polyrhythm) and the sound families in the
// drill runner (contracts §7.3; docs/design/wave7.md §11), pure and unit-tested: the learner's words for every
// option and level, the questions the runner asks its own way, the one sentence that says what the thing was, the
// second question for the ear ("which key did it land in?"), the two-lane tap (one hand per pulse), the rhythm drawn
// as lanes after the answer, and what the learner can hear after every answer — the thing alone, in context, and
// against its near miss. Music comes from the trial's own events, `@oak/theory` and the content-kit fixtures
// (`CLAVE_OPTIONS`, `SWING_FEELS`, `METER_GROUPINGS`), never from a local table of notes.
import type { Answer, FamilyDef, KeySpec, MeterId, NEvent, Trial } from "@oak/api";
import { CLAVE_OPTIONS, METER_GROUPINGS, SWING_FEELS } from "@oak/content-kit";
import type { AudioPlan, SuperdoughValue } from "@oak/drills";
import {
  type ChordId,
  chordOf,
  chordPcs,
  claveOf,
  euclidIdentity,
  guideToneLine,
  guideTones,
  identifyChord,
  keyDisplay,
  meterGroups,
  polyrhythm,
  romanText,
  toLeadSheet,
  tonicDisplay,
  tritoneSub,
} from "@oak/theory";
import { rnDisplay } from "../answers/keys.ts";
import { type ChordSlot, chordSlotsOf, tonicPc } from "./harmony.ts";
import { sequence } from "./plans.ts";
import type { FollowUp, Listen } from "./wave6.ts";

const mod = (n: number, m: number): number => ((n % m) + m) % m;
const onsetOf = (e: Pick<NEvent, "onset">): number => e.onset[0] / e.onset[1];
const durOf = (e: Pick<NEvent, "dur">): number => e.dur[0] / e.dur[1];
const barsOf = (trial: Trial<unknown>): number => Math.max(1, Number(trial.params.bars ?? 1));
const keyOf = (trial: Trial<unknown>): KeySpec | null => {
  const k = trial.params.key as KeySpec | undefined;
  return k && typeof k.tonic === "string" && typeof k.mode === "string" ? k : null;
};
const expectedChoice = (trial: Trial<unknown>): string | null =>
  ((trial.expected as Answer).choice ?? [])[0] ?? null;
const PC_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const show = (name: string): string => name.replace(/b/g, "♭").replace(/#/g, "♯");

/** The families this module speaks for. */
export const STAGE_G_FAMILIES = [
  "fam.jzz.ii-v",
  "fam.jzz.guide",
  "fam.jzz.voicing",
  "fam.jzz.extension",
  "fam.jzz.chord-scale",
  "fam.jzz.subs",
] as const;
export const TRACK_RHYTHM_FAMILIES = ["fam.rhy.clave", "fam.rhy.odd-grouping", "fam.rhy.polyrhythm"] as const;
export const SOUND_FAMILIES = ["fam.snd.params", "fam.snd.roles"] as const;
const WAVE7_LISTEN = new Set<string>([
  ...STAGE_G_FAMILIES,
  ...TRACK_RHYTHM_FAMILIES,
  ...SOUND_FAMILIES,
  "fam.rhy.swing",
]);
/** Whether a trial is one of the Wave 7 families heard after its answer (alone, in context, near miss). */
export const isWave7Listen = (trial: Trial<unknown>): boolean =>
  WAVE7_LISTEN.has(trial.family) && trial.events.length > 0;

// --- the tracks ----------------------------------------------------------------------------------------------

export type TrackKey = "J" | "R" | "A";
export const TRACK_TITLES: Readonly<Record<TrackKey, string>> = {
  J: "Jazz Harmony",
  R: "Advanced Rhythm",
  A: "Arrangement & Sound",
};
/** What each track's ear training holds (the Practice hub's group line). */
export const TRACK_EAR_LINES: Readonly<Record<TrackKey, string>> = {
  J: "Stage G: the ii–V–I as one gesture, guide tones, extensions, voicings, chord-scales and substitutions.",
  R: "Stage H, continued: clave and its direction, odd groupings, polyrhythm, and how hard it swings.",
  A: "Sound by ear: which control changed, brighter or darker, and which part plays which role.",
};

/** The advanced track a lesson belongs to: J and R lessons, and every A lesson (A1.L01–L04 are its side lessons). */
export function trackOfLesson(lessonId: string | null | undefined): TrackKey | null {
  if (!lessonId) return null;
  const m = /^(J|R|A)\d\.L\d\d$/.exec(lessonId) ?? /^(J|R|A)\.CP\d?$/.exec(lessonId);
  return m ? (m[1] as TrackKey) : null;
}

/** The track a family belongs to: the track of the lesson that opens it (null for a core family). */
export const trackOfFamily = (def: Pick<FamilyDef, "unlock">): TrackKey | null =>
  trackOfLesson(def.unlock.lesson);

/** "R1.L02 (Advanced Rhythm)" for a track lesson; the lesson id alone for a core one. */
export function lessonWithTrack(lessonId: string): string {
  const t = trackOfLesson(lessonId);
  return t ? `${lessonId} (${TRACK_TITLES[t]})` : lessonId;
}

// --- words --------------------------------------------------------------------------------------------------

const CLAVE_WORDS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(CLAVE_OPTIONS.map((o) => [o.id.replace(" ", "-"), o.label])),
  tresillo: "Tresillo",
  cinquillo: "Cinquillo",
  straight: "Straight: four even beats",
};
const II_V_WORDS: Readonly<Record<string, string>> = {
  "ii-V-I": "ii–V–I",
  "I-IV-V": "I–IV–V–I",
  "major-ii-V": "Major: ii7–V7–Imaj7",
  "minor-ii-V": "Minor: iiø7–V7–i",
};
const II_V_CATEGORY: Readonly<Record<string, string>> = {
  ...II_V_WORDS,
  locate: "where a ii–V–I begins in eight bars",
  chain: "a chain of ii–V–Is: the key each lands in",
};
const GUIDE_CATEGORY: Readonly<Record<string, string>> = {
  "v7-i-voice": "which guide tone moves",
  "sing-3-7": "sing the guide-tone line",
  "random-keys": "guide-tone lines in any key",
  turnarounds: "guide tones through a turnaround",
};
const EXTENSION_CATEGORY: Readonly<Record<string, string>> = {
  "7-9-13": "7, 9 or 13",
  "9-b9-s9": "9, ♭9 or ♯9",
  "maj7-s11-69": "maj7, maj7♯11 or 6/9",
  "m7-m9-m11": "m7, m9 or m11",
  "alt-13-b13": "altered, 13 or ♭13",
};
const SUBS_CATEGORY: Readonly<Record<string, string>> = {
  tritone: "V7 or its tritone substitute",
  backdoor: "the backdoor (iv7–♭VII7–I)",
  "in-standard": "the substitute inside eight bars",
};
const VOICING_CATEGORY: Readonly<Record<string, string>> = {
  shell: "shell voicings",
  rootless: "rootless A and B voicings",
  drop2: "drop-2 voicings",
};
const CHORD_SCALE_CATEGORY: Readonly<Record<string, string>> = {
  basic: "the scales of ii, V and I",
  "half-dim-dim": "half-diminished and diminished chords",
  "altered-lydian": "altered and Lydian colours",
  "avoid-notes": "avoid notes",
};
const POLY_CATEGORY: Readonly<Record<string, string>> = {
  "tap-3-over-2": "tap 3 against 2, one hand each",
  "3-vs-4-polymeter": "polymeter or polyrhythm",
  straight: "straight: 4 against 2",
};
const SOUND_CATEGORY: Readonly<Record<string, string>> = {
  cutoff: "brighter or darker: the filter",
  resonance: "a ringing peak: resonance",
  "attack-release": "attack and release",
  "room-delay": "room and echo",
  "two-changes": "two changes at once",
  roles: "which part plays which role",
  masking: "which part muddies the bass",
};
const SWING_CATEGORY: Readonly<Record<string, string>> = {
  straight: "straight",
  swung: "swung",
  light: "light swing",
  hard: "hard swing",
};
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "2+2+3" → "2 + 2 + 3"; "7/8:2+2+3" → "7/8 as 2 + 2 + 3". */
function groupingWords(id: string): string | null {
  const m = /^(?:(\d+\/\d+i?):)?(\d(?:\+\d)+)$/.exec(id);
  if (!m) return null;
  const groups = (m[2] as string).split("+").join(" + ");
  return m[1] ? `${m[1]} as ${groups}` : groups;
}

/** The learner's word for a choice of a Wave 7 family, or null when another table names it. */
export function stageGOptionLabel(generator: string, id: string): string | null {
  switch (generator) {
    case "jazz-ii-v":
      return II_V_WORDS[id] ?? null;
    case "rhythm-clave":
      return CLAVE_WORDS[id] ?? null;
    case "rhythm-odd-grouping":
      return groupingWords(id);
    default:
      return null;
  }
}

/** A level's category in plain words for a Wave 7 family (the level picker, "what a level adds"), or null. */
export function stageGCategoryLabel(generator: string, id: string): string | null {
  switch (generator) {
    case "jazz-ii-v":
      return II_V_CATEGORY[id] ?? null;
    case "jazz-guide":
      return GUIDE_CATEGORY[id] ?? null;
    case "jazz-extension":
      return EXTENSION_CATEGORY[id] ?? null;
    case "jazz-subs":
      return SUBS_CATEGORY[id] ?? null;
    case "jazz-voicing":
      return VOICING_CATEGORY[id] ?? null;
    case "jazz-chord-scale":
      return CHORD_SCALE_CATEGORY[id] ?? null;
    case "rhythm-clave":
      return CLAVE_WORDS[id]?.toLowerCase() ?? null;
    case "rhythm-odd-grouping":
      return groupingWords(id);
    case "rhythm-polyrhythm":
      return POLY_CATEGORY[id] ?? (/^\d+:\d+$/.test(id) ? id.replace(":", " against ") : null);
    case "rhythm-swing":
      return SWING_CATEGORY[id] ?? null;
    case "sound-params":
    case "sound-roles":
      return SOUND_CATEGORY[id] ?? null;
    default:
      return null;
  }
}

/**
 * The options of a Wave 7 trial where the runner must name them itself, or null. An odd-grouping trial answers with
 * the grouping alone ("2+2+3"), so its options are its level's groupings of the same meter — never the category ids
 * ("7/8:2+2+3"), which would show the right answer twice and the category forms could never be right.
 */
export function stageGOptionsOf(
  trial: Trial<unknown>,
  def: Pick<FamilyDef, "levels" | "generator">,
): string[] | null {
  if (def.generator !== "rhythm-odd-grouping") return null;
  if (Array.isArray(trial.params.options)) return null;
  const meter = String(trial.params.meter ?? "");
  const level = def.levels[Math.max(0, Math.min(def.levels.length, trial.level) - 1)];
  const out: string[] = [];
  for (const c of [...(level?.categories ?? []), trial.category]) {
    const [m, g] = c.split(":");
    if (m === meter && g && !out.includes(g)) out.push(g);
  }
  const expected = expectedChoice(trial);
  if (expected && !out.includes(expected)) out.push(expected);
  // Fewer than two from the level (a forced draw): the meter's declarable groupings (content-kit's fixture).
  if (out.length < 2)
    for (const g of METER_GROUPINGS[meter as MeterId] ?? []) {
      const id = g.join("+");
      if (!out.includes(id)) out.push(id);
    }
  return out;
}

/** The question a Wave 7 trial asks where the generator writes none (or writes one the runner says better). */
export function stageGPrompt(trial: Trial<unknown>, def: Pick<FamilyDef, "generator">): string | null {
  const p = trial.params;
  if (typeof p.prompt === "string" && p.prompt.trim() !== "") return null;
  switch (def.generator) {
    case "jazz-ii-v": {
      if (trial.category === "locate")
        return (trial.expected as Answer).choice && ((trial.expected as Answer).choice?.length ?? 0) > 1
          ? "Mark every bar where a ii–V–I begins."
          : "Mark the bar where a ii–V–I begins.";
      if (trial.category === "major-ii-V" || trial.category === "minor-ii-V")
        return "A ii–V–I in major, or in minor?";
      return "Which progression: a ii–V–I, or I–IV–V–I?";
    }
    case "rhythm-clave":
      return /^(son|rumba)-/.test(trial.category)
        ? "Which clave, and which way round: three first, or two first?"
        : "Which rhythm is it?";
    case "rhythm-odd-grouping": {
      const meter = String(p.meter ?? "");
      const g = meter ? meterGroups(meter as MeterId) : null;
      const beats = g ? g.groups.reduce((a, b) => a + b, 0) : null;
      return beats
        ? `A bar of ${beats} eighths: how is it grouped? Listen for the three.`
        : "How is the bar grouped?";
    }
    default:
      return null;
  }
}

// --- the thing alone, in context, against its near miss --------------------------------------------------------

type Hit = { at: number; dur: number; value: SuperdoughValue };

/** A plan from hits placed in cycles at the trial's tempo. */
function hitsPlan(hits: readonly Hit[], cps: number, bars: number): AudioPlan | null {
  if (hits.length === 0) return null;
  const events = hits
    .map((h) => ({ at: h.at / cps, dur: h.dur / cps, value: h.value }))
    .sort((a, b) => a.at - b.at);
  // The preload key superdough uses: a drum in a bank is `RolandTR909_bd` (as `eventsToAudioPlan` names it).
  const preload = new Set<string>();
  for (const h of hits)
    preload.add(h.value.note === undefined && h.value.bank ? `${h.value.bank}_${h.value.s}` : h.value.s);
  return {
    events,
    durationSec: Math.max(bars / cps, ...events.map((e) => e.at + e.dur)),
    preload: [...preload].sort(),
  };
}

/** The value an event plays with (its sound, bank, gain and pitch). */
function playValue(e: NEvent, gain = 1): SuperdoughValue {
  const v: SuperdoughValue = { s: e.s ?? "piano", gain: Math.round(e.gain * gain * 1000) / 1000 };
  if (e.midi !== null) v.note = e.midi;
  if (e.bank) v.bank = e.bank;
  if (e.sampleN !== undefined) v.n = e.sampleN;
  return v;
}

/** Some events of a trial as a plan, in their own time (from bar 0). */
function eventsPlan(trial: Trial<unknown>, keep: (e: NEvent) => boolean, transpose = 0): AudioPlan | null {
  const hits = trial.events.filter(keep).map((e) => {
    const v = playValue(e);
    if (typeof v.note === "number") v.note += transpose;
    return { at: onsetOf(e), dur: durOf(e), value: v };
  });
  return hitsPlan(hits, trial.cps, barsOf(trial));
}
const trackIs =
  (...tracks: string[]) =>
  (e: NEvent): boolean =>
    tracks.includes(e.track);

/** Chords one per `barsEach` bars (a bass root under a close upper voicing), on the trial's sounds. */
function chordsPlan(
  chords: readonly ChordId[],
  cps: number,
  sounds: { chords: string; bass: string | null },
  barsEach = 1,
): AudioPlan | null {
  const hits: Hit[] = [];
  let centre = 60;
  chords.forEach((c, i) => {
    const at = i * barsEach;
    const pcs = chordPcs(c);
    const upperPcs = pcs.length >= 4 ? pcs.filter((p) => p !== c.rootPc) : pcs;
    // Close position nearest the last chord's centre (smooth, like the generators' own comping).
    let best: number[] = [];
    let bestD = Number.POSITIVE_INFINITY;
    for (let base = centre - 8; base <= centre + 2; base++) {
      const v = upperPcs.map((pc) => base + mod(pc - base, 12)).sort((a, b) => a - b);
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      if (Math.abs(mean - centre) < bestD) {
        bestD = Math.abs(mean - centre);
        best = v;
      }
    }
    centre = best.reduce((a, b) => a + b, 0) / Math.max(1, best.length);
    for (const note of best)
      hits.push({ at, dur: barsEach * 0.95, value: { s: sounds.chords, note, gain: 0.5 } });
    if (sounds.bass)
      hits.push({ at, dur: barsEach * 0.9, value: { s: sounds.bass, note: 36 + c.rootPc, gain: 0.75 } });
  });
  return hitsPlan(hits, cps, chords.length * barsEach);
}

// --- jazz: the chords a trial plays ---------------------------------------------------------------------------

/** The chords of a jazz trial as read from its notes, one per slot. */
function chordsOf(trial: Trial<unknown>): { slots: ChordSlot[]; chords: (ChordId | null)[] } {
  const slots = chordSlotsOf(trial);
  return { slots, chords: slots.map((s) => s.reading?.chord ?? jazzReading(s)) };
}
/**
 * A jazz chord the triad-and-seventh reader leaves unnamed (an altered dominant, a ninth): `@oak/theory`'s
 * `identifyChord` over the slot's notes, kept only when its root is the bass (the bass plays the root here).
 */
function jazzReading(slot: ChordSlot): ChordId | null {
  const best = identifyChord([...slot.midis], { bassPc: mod(slot.bass, 12) as never })[0];
  return best && best.rootPc === mod(slot.bass, 12) ? best : null;
}
const soundsOf = (trial: Trial<unknown>): { chords: string; bass: string | null } =>
  chordSlotsOf(trial)[0]?.sounds ?? { chords: "piano", bass: null };

/** A chord as the lenses allow it: the lead-sheet symbol, the numeral, both, or neither. */
export function chordWords(
  chord: ChordId,
  key: KeySpec | null,
  shown: { chordSymbols: boolean; romanNumerals: boolean },
  next?: ChordId,
): string | null {
  const parts = [
    shown.chordSymbols ? toLeadSheet(chord) : null,
    shown.romanNumerals && key ? rnDisplay(romanText(chord, key, next)) : null,
  ].filter((x): x is string => x !== null);
  if (parts.length === 2) return `${parts[0]} (${parts[1]})`;
  return parts[0] ?? null;
}

/** The tonic a ii–V trial lands on, read from its own chords (the last slot), with the trial's mode. */
export function landingKeyOf(trial: Trial<unknown>): KeySpec | null {
  const key = keyOf(trial);
  if (!key) return null;
  const { chords } = chordsOf(trial);
  const last = chords.filter((c): c is ChordId => c !== null).at(-1);
  if (!last) return key;
  return { tonic: last.root, mode: key.mode };
}

/** The 3rds and 7ths of a progression's chords as they sound in its voicing (the guide tones, one line each). */
function guideNotesPlan(trial: Trial<unknown>): AudioPlan | null {
  const { slots, chords } = chordsOf(trial);
  const hits: Hit[] = [];
  const sound = soundsOf(trial).chords;
  slots.forEach((s, i) => {
    const c = chords[i];
    if (!c) return;
    const g = guideTones(c);
    const pcs = [g.third?.pc, g.seventh?.pc].filter((p): p is NonNullable<typeof p> => p !== undefined);
    for (const m of s.midis.slice(1))
      if (pcs.includes(mod(m, 12) as never))
        hits.push({ at: s.at, dur: s.dur * 0.95, value: { s: sound, note: m, gain: 0.6 } });
  });
  return hitsPlan(hits, trial.cps, barsOf(trial));
}

/** The four bars of a ii–V family's progression on a tonic, as the generator plays them (one chord a bar). */
function progressionOf(category: string, key: KeySpec): ChordId[] | null {
  const t = key.tonic;
  const pc = tonicPc(key);
  const at = (semis: number) => PC_FLAT[mod(pc + semis, 12)] as string;
  switch (category) {
    case "I-IV-V":
      return [chordOf(t, "maj7"), chordOf(at(5), "maj7"), chordOf(at(7), "7"), chordOf(t, "maj7")];
    case "ii-V-I":
    case "major-ii-V":
      return [chordOf(at(2), "m7"), chordOf(at(7), "7"), chordOf(t, "maj7"), chordOf(t, "maj7")];
    case "minor-ii-V":
      return [chordOf(at(2), "m7b5"), chordOf(at(7), "7"), chordOf(t, "min"), chordOf(t, "min")];
    default:
      return null;
  }
}

function iiVNear(trial: Trial<unknown>, got: Answer | null): Listen | null {
  const key = keyOf(trial);
  if (!key) return null;
  const asked = expectedChoice(trial);
  const pick = got?.choice?.[0];
  // The learner's own wrong pick, else the other side of the question.
  const other =
    pick && pick !== asked
      ? pick
      : asked === "ii-V-I"
        ? "I-IV-V"
        : asked === "I-IV-V"
          ? "ii-V-I"
          : asked === "major-ii-V"
            ? "minor-ii-V"
            : asked === "minor-ii-V"
              ? "major-ii-V"
              : null;
  if (!other) return null;
  // A minor ii–V–i sits on the same tonic in minor; the major one on the same tonic in major.
  const nearKey: KeySpec = { tonic: key.tonic, mode: other === "minor-ii-V" ? "minor" : "major" };
  const chords = progressionOf(other, nearKey);
  const plan = chords ? chordsPlan(chords, trial.cps, soundsOf(trial)) : null;
  if (!plan) return null;
  const NEAR_WORDS: Readonly<Record<string, string>> = {
    "ii-V-I": "the ii–V–I",
    "I-IV-V": "I–IV–V–I",
    "major-ii-V": "the major ii–V–I",
    "minor-ii-V": "the minor ii–V–i",
  };
  const word = NEAR_WORDS[other] ?? other;
  return { label: other === pick ? `Yours: ${word}` : `Against ${word}`, plan };
}

/** Which key did the ii–V–I land in (a second question for the ear after "major or minor"). */
export function iiVFollowUp(trial: Trial<unknown>): FollowUp | null {
  if (trial.family !== "fam.jzz.ii-v") return null;
  if (!["ii-V-I", "major-ii-V", "minor-ii-V"].includes(trial.category)) return null;
  if (expectedChoice(trial) !== trial.category) return null;
  const land = landingKeyOf(trial);
  if (!land) return null;
  const pc = tonicPc(land);
  // The near misses an ear reaches for: the key of the first chord (ii), of the dominant (V), and a fourth up.
  const distract = [2, 7, 5].map((s) => PC_FLAT[mod(pc + s, 12)] as string);
  const ids = [land.tonic, ...distract];
  const order = mod(trial.seed, 4);
  const options = ids
    .map((tonic) => ({ id: tonic, label: keyDisplay({ tonic, mode: land.mode }) }))
    .map((o, i, all) => all[(i + order) % all.length] as typeof o);
  return {
    prompt: "Which key did it land in?",
    options,
    correct: land.tonic,
    answer: `It lands on ${tonicDisplay(land.tonic)}: the ii–V–I of ${keyDisplay(land)}. Home is the last chord, not the first.`,
  };
}

// --- jazz: guide tones ------------------------------------------------------------------------------------------

/** The guide-tone line a sung trial asks for (its targets), played one note a bar at the trial's tempo. */
function sungLinePlan(trial: Trial<unknown>, withChords: boolean): AudioPlan | null {
  const targets = (trial.params.singTargets as { midi: number; on: number; off: number }[] | undefined) ?? [];
  if (targets.length === 0) return null;
  const count = Number(trial.cue.countInBars ?? 0);
  const line: AudioPlan = {
    events: targets.map((t) => ({
      at: t.on,
      dur: Math.max(0.2, (t.off - t.on) * 0.9),
      value: { s: "piano", note: t.midi, gain: 0.75 },
    })),
    durationSec: Math.max(...targets.map((t) => t.off)),
    preload: ["piano"],
  };
  if (!withChords) return line;
  // The chords start after the count-in bar; the targets are timed from the response window (the chords' start).
  const chords = eventsPlan(trial, (e) => onsetOf(e) >= count - 1e-9);
  if (!chords) return line;
  const shift = count / trial.cps;
  return {
    events: [...chords.events.map((e) => ({ ...e, at: e.at - shift })), ...line.events].sort(
      (a, b) => a.at - b.at,
    ),
    durationSec: Math.max(line.durationSec, chords.durationSec - shift),
    preload: [...new Set([...chords.preload, ...line.preload])].sort(),
  };
}

/** The other guide-tone line through the same chords (from the 7th where the trial starts on the 3rd). */
function otherLinePlan(trial: Trial<unknown>): AudioPlan | null {
  const chords = chordsOf(trial).chords.filter((c): c is ChordId => c !== null);
  const targets = (trial.params.singTargets as { midi: number; on: number; off: number }[] | undefined) ?? [];
  if (chords.length === 0 || targets.length !== chords.length) return null;
  const start = trial.params.startsOn === "7th" ? "third" : "seventh";
  const around = targets[0]?.midi ?? 64;
  const line = guideToneLine(chords, { start, around });
  if (line.some((s) => s === null)) return null;
  return {
    events: line.map((s, i) => ({
      at: targets[i]?.on ?? 0,
      dur: Math.max(0.2, ((targets[i]?.off ?? 1) - (targets[i]?.on ?? 0)) * 0.9),
      value: { s: "piano", note: (s as { midi: number }).midi, gain: 0.75 },
    })),
    durationSec: Math.max(...targets.map((t) => t.off)),
    preload: ["piano"],
  };
}

/** The two voices of a "which voice moves" trial, each as a line of two notes. */
function guideVoices(trial: Trial<unknown>): { top: number[]; bottom: number[] } | null {
  const slots = chordSlotsOf(trial);
  if (slots.length !== 2) return null;
  const uppers = slots.map((s) => s.midis.filter((m) => m !== s.bass).slice(-2));
  if (uppers.some((u) => u.length !== 2)) return null;
  return {
    top: uppers.map((u) => u[1] as number),
    bottom: uppers.map((u) => u[0] as number),
  };
}

function voicePlan(trial: Trial<unknown>, which: "top" | "bottom"): AudioPlan | null {
  const v = guideVoices(trial);
  if (!v) return null;
  const sound = soundsOf(trial).chords;
  return hitsPlan(
    v[which].map((note, i) => ({ at: i, dur: 0.95, value: { s: sound, note, gain: 0.7 } })),
    trial.cps,
    2,
  );
}

// --- jazz: extensions, substitutions, voicings ------------------------------------------------------------------

const COLOUR_WORDS: Readonly<Record<number, string>> = {
  1: "♭9",
  2: "9th",
  3: "♯9",
  5: "11th",
  6: "♯11",
  8: "♭13",
  9: "13th",
  10: "7th",
  11: "major 7th",
  7: "5th",
  4: "3rd",
};
const QUALITY_WORDS: Readonly<Record<string, string>> = {
  "7": "a dominant seventh",
  "9": "a dominant ninth",
  "13": "a dominant thirteenth",
  "7b9": "a dominant seventh with a ♭9",
  "7#9": "a dominant seventh with a ♯9",
  maj7: "a major seventh",
  "maj7#11": "a major seventh with a ♯11",
  "69": "a 6/9 chord",
  m7: "a minor seventh",
  m9: "a minor ninth",
  m11: "a minor eleventh",
  "7alt": "an altered dominant",
  "7b13": "a dominant seventh with a ♭13",
};

/** A lone extension chord's top note (its colour) and its size above the root. */
function colourOf(trial: Trial<unknown>): { midi: number; semis: number; rootPc: number } | null {
  const midis = trial.params.midis;
  const rootPc = trial.params.rootPc;
  if (!Array.isArray(midis) || typeof rootPc !== "number" || midis.length < 3) return null;
  const top = Math.max(...(midis as number[]));
  return { midi: top, semis: mod(top - rootPc, 12), rootPc };
}

function extensionNear(trial: Trial<unknown>, got: Answer | null): Listen | null {
  const c = colourOf(trial);
  const asked = expectedChoice(trial);
  if (!c || !asked) return null;
  const options = (trial.params.options as string[] | undefined) ?? [];
  const pick = got?.choice?.[0];
  // The learner's wrong pick, else the plainest chord of the set (the 7 under a 9, the 9 under its alterations).
  const near = pick && pick !== asked ? pick : (options.find((o) => o !== asked) ?? null);
  if (!near) return null;
  const root = PC_FLAT[c.rootPc] as string;
  let chord: ChordId;
  try {
    chord = chordOf(root, near as never);
  } catch {
    return null;
  }
  const sounds = soundsOf(trial);
  const pcs = chordPcs(chord).filter((p) => p !== c.rootPc);
  // The same register as the trial's own voicing: the guide tones low, the colour on top.
  const midis = (trial.params.midis as number[]).slice().sort((a, b) => a - b);
  const low = (midis[1] ?? 52) - 1;
  const upper = pcs.map((pc) => low + 1 + mod(pc - (low + 1), 12)).sort((a, b) => a - b);
  const plan = hitsPlan(
    [
      { at: 0, dur: 0.95, value: { s: sounds.bass ?? sounds.chords, note: midis[0] as number, gain: 0.75 } },
      ...upper.map((note) => ({ at: 0, dur: 0.95, value: { s: sounds.chords, note, gain: 0.5 } })),
    ],
    trial.cps,
    1,
  );
  if (!plan) return null;
  const label = trial.params.optionLabels as Record<string, string> | undefined;
  const word = label?.[near] ?? near;
  return { label: near === pick ? `Yours: ${show(word)}` : `Against ${show(word)}`, plan };
}

/** The cadence chords of a substitution trial with one slot replaced. */
function subsNear(trial: Trial<unknown>, got: Answer | null): Listen | null {
  const key = keyOf(trial);
  const { chords } = chordsOf(trial);
  if (!key || chords.some((c) => c === null)) return null;
  const list = chords as ChordId[];
  const sounds = soundsOf(trial);
  if (trial.category === "in-standard") {
    const bar = Number(expectedChoice(trial) ?? 0);
    const sub = list[bar - 1];
    if (!sub) return null;
    const back = list.map((c, i) => (i === bar - 1 ? tritoneSub(c) : c));
    const plan = chordsPlan(back, trial.cps, sounds);
    return plan ? { label: `Bar ${bar} with its V7 back`, plan } : null;
  }
  const asked = expectedChoice(trial);
  const pick = got?.choice?.[0];
  const other = pick && pick !== asked ? pick : asked === "V7-I" ? "bII7-I" : "V7-I";
  const pc = tonicPc(key);
  const at = (s: number) => PC_FLAT[mod(pc + s, 12)] as string;
  const way: Readonly<Record<string, [ChordId, ChordId]>> = {
    "V7-I": [chordOf(at(2), "m7"), chordOf(at(7), "7")],
    "bII7-I": [chordOf(at(2), "m7"), chordOf(at(1), "7")],
    backdoor: [chordOf(at(5), "m7"), chordOf(at(10), "7")],
  };
  const pair = way[other];
  if (!pair) return null;
  // The two chords before home are the way in (the generator may open with a bar of home first).
  if (list.length < 3) return null;
  const plan = chordsPlan(
    [...list.slice(0, -3), pair[0], pair[1], list.at(-1) as ChordId],
    trial.cps,
    sounds,
  );
  const words: Readonly<Record<string, string>> = {
    "V7-I": "the plain V7",
    "bII7-I": "the tritone substitute",
    backdoor: "the backdoor",
  };
  return plan ? { label: other === pick ? `Yours: ${words[other]}` : `Against ${words[other]}`, plan } : null;
}

/** A voicing trial's answer (notes written as names, "C3 E3 B3"), played as one chord. */
function namesPlan(names: string): AudioPlan | null {
  const midis = names
    .split(/\s+/)
    .map((n) => noteMidi(n))
    .filter((m): m is number => m !== null);
  if (midis.length < 2) return null;
  return {
    events: midis.map((note) => ({ at: 0, dur: 1.6, value: { s: "piano", note, gain: 0.55 } })),
    durationSec: 1.8,
    preload: ["piano"],
  };
}
const LETTER: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteMidi(name: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]{0,2})(-?\d)$/.exec(name.trim());
  if (!m) return null;
  const alt = [...(m[2] as string)].reduce((a, ch) => a + (ch === "#" || ch === "♯" ? 1 : -1), 0);
  return 12 * (Number(m[3]) + 1) + (LETTER[(m[1] as string).toUpperCase()] as number) + alt;
}

// --- rhythm: clave, groupings, polyrhythm, swing -----------------------------------------------------------------

/** The strokes of a clave trial as eighth steps over its first two bars (16 steps), and the sound they use. */
export function claveStepsOf(trial: Trial<unknown>): { steps: number[]; hit: NEvent } | null {
  const perc = trial.events.filter((e) => e.track === "perc" && onsetOf(e) < 2 - 1e-9);
  const first = perc[0];
  if (!first) return null;
  return {
    steps: [...new Set(perc.map((e) => Math.round(onsetOf(e) * 8)))].sort((a, b) => a - b),
    hit: first,
  };
}

/** Where a stroke sits, counted in eighths: "1", "the & of 2". */
export function eighthCount(step: number): string {
  const inBar = mod(step, 8);
  const beat = Math.floor(inBar / 2) + 1;
  return inBar % 2 === 0 ? String(beat) : `the & of ${beat}`;
}

const listWords = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

/** The clave in one sentence, read from its strokes. */
export function claveLine(trial: Trial<unknown>): string | null {
  const c = claveStepsOf(trial);
  if (!c) return null;
  const which = claveOf(c.steps);
  if (which) {
    const bar1 = c.steps.filter((s) => s < 8);
    const bar2 = c.steps.filter((s) => s >= 8);
    // The name is in the feedback already: the sentence says where the strokes fall and why that is the direction.
    const side = (xs: number[]) =>
      `${xs.length === 3 ? "three strokes" : "two strokes"} (${listWords(xs.map(eighthCount))})`;
    const order = which.direction === "3-2" ? "Three first, so 3-2." : "Two first, so 2-3.";
    const rumba =
      which.type === "rumba"
        ? " The rumba's last stroke of the three waits for the & of 4, where the son's falls on 4."
        : "";
    return `Bar 1 has ${side(bar1)}, bar 2 ${side(bar2)}. ${order}${rumba}`;
  }
  const bar = c.steps.filter((s) => s < 8);
  const e = euclidIdentity(bar, 8);
  const gaps = bar.map((s, i) => (bar[i + 1] ?? 8) - s);
  if (e && e.pulses === 3)
    return `Tresillo: three hits in a bar of eight eighths, spaced ${gaps.join(" + ")}. As a Euclidean rhythm it is (3,8).`;
  if (e && e.pulses === 5)
    return `Cinquillo: five hits in a bar of eight eighths, spaced ${gaps.join(" + ")}. As a Euclidean rhythm it is (5,8).`;
  if (e && e.pulses === 4) return "Straight: four even beats, one on every quarter note.";
  return null;
}

/** The clave a trial is taken for: the other way round, son against rumba, or the learner's own pick. */
function claveNear(trial: Trial<unknown>, got: Answer | null): Listen | null {
  const c = claveStepsOf(trial);
  if (!c) return null;
  const asked = expectedChoice(trial) ?? trial.category;
  const pick = got?.choice?.[0];
  const swap = (id: string) =>
    id.endsWith("3-2") ? id.replace("3-2", "2-3") : id.endsWith("2-3") ? id.replace("2-3", "3-2") : id;
  const other =
    pick && pick !== asked
      ? pick
      : /^(son|rumba)-/.test(asked)
        ? swap(asked)
        : asked === "tresillo"
          ? "cinquillo"
          : "tresillo";
  const steps = stepsOfClave(other);
  if (!steps) return null;
  const hits = steps.map((s) => ({ at: s / 8, dur: 1 / 16, value: playValue(c.hit) }));
  const plan = hitsPlan(hits, trial.cps, 2);
  if (!plan) return null;
  const word = CLAVE_WORDS[other] ?? other;
  return { label: other === pick ? `Yours: ${word}` : `Against ${word.replace(/:.*$/, "")}`, plan };
}
/** Eighth steps over two bars of a clave category (content-kit's `CLAVE_GRIDS` through @oak/theory). */
function stepsOfClave(id: string): number[] | null {
  const m = /^(son|rumba)-(3-2|2-3)$/.exec(id);
  if (m) {
    const option = CLAVE_OPTIONS.find((o) => o.id === `${m[1]} ${m[2]}`);
    if (!option) return null;
    const three = m[1] === "son" ? [0, 3, 6] : [0, 3, 7];
    const two = [2, 4];
    return m[2] === "3-2" ? [...three, ...two.map((s) => s + 8)] : [...two, ...three.map((s) => s + 8)];
  }
  const one: Readonly<Record<string, number[]>> = {
    tresillo: [0, 3, 6],
    cinquillo: [0, 2, 3, 5, 6],
    straight: [0, 2, 4, 6],
  };
  const bar = one[id];
  return bar ? [...bar, ...bar.map((s) => s + 8)] : null;
}

/** The clave over a quarter-note pulse: the thing in time. */
function claveInTime(trial: Trial<unknown>): AudioPlan | null {
  const c = claveStepsOf(trial);
  if (!c) return null;
  const hits: Hit[] = c.steps.map((s) => ({ at: s / 8, dur: 1 / 16, value: playValue(c.hit) }));
  for (let q = 0; q < 8; q++)
    hits.push({
      at: q / 4,
      dur: 1 / 16,
      value: { s: "bd", gain: q % 4 === 0 ? 0.6 : 0.35, ...(c.hit.bank ? { bank: c.hit.bank } : {}) },
    });
  return hitsPlan(hits, trial.cps, 2);
}

/** The groups of an odd-meter trial (from its answer), with the bar's length in eighths. */
export function groupingOf(trial: Trial<unknown>): { meter: string; groups: number[]; total: number } | null {
  if (trial.family !== "fam.rhy.odd-grouping") return null;
  const id = expectedChoice(trial);
  const meter = String(trial.params.meter ?? "");
  if (!id || !/^\d(\+\d)+$/.test(id)) return null;
  const groups = id.split("+").map(Number);
  return { meter, groups, total: groups.reduce((a, b) => a + b, 0) };
}

/** "7/8 as 2 + 2 + 3: counted 1 2 | 1 2 | 1 2 3. The three comes last." */
export function groupingLine(trial: Trial<unknown>): string | null {
  const g = groupingOf(trial);
  if (!g) return null;
  const count = g.groups.map((n) => Array.from({ length: n }, (_, i) => String(i + 1)).join(" ")).join(" | ");
  const threes = g.groups.map((n, i) => (n === 3 ? i : -1)).filter((i) => i >= 0);
  const where =
    threes.length !== 1
      ? ""
      : threes[0] === 0
        ? " The three comes first."
        : threes[0] === g.groups.length - 1
          ? " The three comes last."
          : " The three is in the middle.";
  return `${g.meter} as ${g.groups.join(" + ")}: counted ${count}.${where}`;
}

function groupedPlan(trial: Trial<unknown>, groups: readonly number[]): AudioPlan | null {
  const total = groups.reduce((a, b) => a + b, 0);
  const starts: number[] = [];
  let at = 0;
  for (const g of groups) {
    starts.push(at);
    at += g;
  }
  const hat = trial.events.find((e) => e.track === "hats" || e.track === "mel");
  const kick = trial.events.find((e) => e.s === "bd");
  const snare = trial.events.find((e) => e.s === "sd");
  if (!hat) return null;
  const hits: Hit[] = [];
  for (let bar = 0; bar < 2; bar++)
    for (let i = 0; i < total; i++) {
      const t = bar + i / total;
      const accent = starts.includes(i);
      hits.push({ at: t, dur: 1 / total, value: { ...playValue(hat), gain: accent ? 1 : 0.5 } });
      if (i === 0 && kick) hits.push({ at: t, dur: 1 / total, value: playValue(kick) });
      else if (accent && snare) hits.push({ at: t, dur: 1 / total, value: playValue(snare) });
    }
  return hitsPlan(hits, trial.cps, 2);
}

function groupingNear(
  trial: Trial<unknown>,
  def: Pick<FamilyDef, "levels" | "generator"> | null,
  got: Answer | null,
): Listen | null {
  const g = groupingOf(trial);
  if (!g) return null;
  const asked = g.groups.join("+");
  const pick = got?.choice?.[0];
  const own = Array.isArray(trial.params.options) ? (trial.params.options as unknown[]).map(String) : null;
  const pool = own ?? (def ? (stageGOptionsOf(trial, def) ?? []) : []);
  // The learner's pick, else the same groups turned once (the three moves): the near miss of a grouping.
  const turned = [...g.groups.slice(1), g.groups[0] as number].join("+");
  const other =
    pick && pick !== asked
      ? pick
      : pool.includes(turned) && turned !== asked
        ? turned
        : (pool.find((p) => p !== asked) ?? null);
  if (!other) return null;
  const plan = groupedPlan(trial, other.split("+").map(Number));
  return plan
    ? {
        label:
          other === pick
            ? `Yours: ${other.split("+").join(" + ")}`
            : `Grouped ${other.split("+").join(" + ")}`,
        plan,
      }
    : null;
}

/** The two pulses of a polyrhythm trial ([high, low] a bar), from its own events. */
export function pulsesOf(trial: Trial<unknown>): { high: number; low: number } | null {
  if (trial.family !== "fam.rhy.polyrhythm") return null;
  const count = (track: string) =>
    trial.events.filter((e) => e.track === track && onsetOf(e) < 1 - 1e-9).length;
  const high = count("high");
  const low = count("low");
  return high > 0 && low > 0 ? { high, low } : null;
}

/** "4 against 3: four even high beats in the time of three low ones. They meet only on the one." */
export function polyLine(trial: Trial<unknown>): string | null {
  if (trial.params.mode === "tap") return null;
  const p = pulsesOf(trial);
  if (!p) return null;
  const words = ["", "one", "two", "three", "four", "five", "six"];
  const together = polyrhythm(p.high, p.low).together.length;
  const meet = together === 1 ? "They meet only on the one." : `They meet ${together} times a bar.`;
  return `${p.high} against ${p.low}: ${words[p.high] ?? p.high} even high beats in the time of ${words[p.low] ?? p.low} low ones. ${meet}`;
}

function pulsePlan(trial: Trial<unknown>, high: number, low: number): AudioPlan | null {
  const hi = trial.events.find((e) => e.track === "high");
  const lo = trial.events.find((e) => e.track === "low");
  if (!hi || !lo) return null;
  const hits: Hit[] = [];
  for (let bar = 0; bar < 2; bar++) {
    for (let i = 0; i < high; i++) hits.push({ at: bar + i / high, dur: 1 / 16, value: playValue(hi) });
    for (let i = 0; i < low; i++) hits.push({ at: bar + i / low, dur: 1 / 16, value: playValue(lo) });
  }
  return hitsPlan(hits, trial.cps, 2);
}

function polyNear(trial: Trial<unknown>, got: Answer | null): Listen | null {
  const p = pulsesOf(trial);
  if (!p) return null;
  const asked = expectedChoice(trial);
  const pick = got?.choice?.[0];
  const parse = (id: string): [number, number] | null => {
    if (id === "straight") return [4, 2];
    const m = /^(\d+):(\d+)$/.exec(id);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const other = pick && pick !== asked ? parse(pick) : [p.low, p.high];
  if (!other || (other[0] === p.high && other[1] === p.low)) return null;
  const plan = pulsePlan(trial, other[0] as number, other[1] as number);
  const word = `${other[0]} high against ${other[1]} low`;
  return plan ? { label: pick && pick !== asked ? `Yours: ${word}` : `Against ${word}`, plan } : null;
}

/** The long:short ratio a swing trial's hats play (1 when straight), measured from their off-beats. */
export function swingOf(trial: Trial<unknown>): { ratio: number; per: 4 | 8 } | null {
  if (trial.family !== "fam.rhy.swing") return null;
  const hats = trial.events.filter((e) => e.track === "hats");
  if (hats.length === 0) return null;
  // The generator says which line swings (`subdivision` 16: the sixteenths, R1.L02); else count the hats a bar.
  const perCycle = hats.filter((e) => onsetOf(e) < 1 - 1e-9).length;
  const sub = trial.params.subdivision;
  const per: 4 | 8 = sub === 16 ? 8 : sub === 8 ? 4 : perCycle > 8 ? 8 : 4;
  const slot = 1 / per;
  let off = 0.5;
  for (const e of hats) {
    const f = mod(onsetOf(e), slot) / slot;
    if (f > 1e-6) {
      off = f;
      break;
    }
  }
  return { ratio: off / (1 - off), per };
}

/** The nearest named feel of content-kit's `SWING_FEELS`, and the ratio in small numbers ("7:5"). */
function ratioWords(ratio: number): string {
  let best = { p: 1, q: 1, d: Number.POSITIVE_INFINITY };
  for (let q = 1; q <= 5; q++) {
    const p = Math.round(ratio * q);
    const d = Math.abs(p / q - ratio);
    if (d < best.d - 1e-9) best = { p, q, d };
  }
  return `${best.p}:${best.q}`;
}
export function swingLine(trial: Trial<unknown>): string | null {
  const s = swingOf(trial);
  if (!s) return null;
  const unit = s.per === 8 ? "sixteenths" : "eighths";
  if (s.ratio < 1.05) return `Straight ${unit}: each pair splits its beat evenly (1:1).`;
  const feel = SWING_FEELS.reduce((a, b) =>
    Math.abs(b.ratio - s.ratio) < Math.abs(a.ratio - s.ratio) ? b : a,
  );
  const how =
    s.ratio >= 2.5 ? "much longer than" : s.ratio >= 1.8 ? "twice as long as" : "a little longer than";
  const name = feel.id === "triplet" ? "Swung (the triplet feel)" : feel.label.replace(/ \(.*\)$/, "");
  return `${name} on the ${unit}: the long note is ${how} the short one, about ${ratioWords(s.ratio)}.`;
}

/** The hats swung by `amount` at `per` slots a bar (Strudel's `swingBy(amount, per)`), straightened first. */
function reswingPlan(trial: Trial<unknown>, amount: number, per: 4 | 8): AudioPlan | null {
  const s = swingOf(trial);
  if (!s) return null;
  const from = s.per;
  const hits: Hit[] = trial.events.map((e) => {
    let t = onsetOf(e);
    const slot = 1 / from;
    const f = mod(t, slot) / slot;
    // Straighten: an off-beat at its swung place goes back to the middle of its slot.
    if (f > 1e-6) t = t - f * slot + 0.5 * slot;
    // Swing again: the second half of each new slot moves later by amount/2 of it.
    const slot2 = 1 / per;
    const f2 = mod(t, slot2) / slot2;
    if (f2 >= 0.5 - 1e-9) t += (amount / 2) * slot2;
    return { at: t, dur: durOf(e), value: playValue(e) };
  });
  return hitsPlan(hits, trial.cps, barsOf(trial));
}

function swingNear(trial: Trial<unknown>): Listen | null {
  const s = swingOf(trial);
  if (!s || s.ratio < 1.05) return null;
  const amount = (s.ratio - 1) / (s.ratio + 1);
  // Sixteenth swing against the same swing on the eighths (contracts §7.3 H, level 4).
  if (s.per === 8) {
    const plan = reswingPlan(trial, amount, 4);
    return plan ? { label: "The same swing on the eighths", plan } : null;
  }
  // Eighth swing: the named feel beside it (lighter when it is hard, harder when it is light).
  const order = [...SWING_FEELS].filter((f) => f.ratio > 1).sort((a, b) => a.ratio - b.ratio);
  const i = order.reduce(
    (bi, f, k) => (Math.abs(f.ratio - s.ratio) < Math.abs((order[bi] as typeof f).ratio - s.ratio) ? k : bi),
    0,
  );
  const near = order[i === order.length - 1 ? i - 1 : i + 1];
  if (!near) return null;
  const plan = reswingPlan(trial, near.amount, 4);
  return plan ? { label: `Against ${near.label.replace(/ \(.*\)$/, "").toLowerCase()}`, plan } : null;
}

// --- sound -----------------------------------------------------------------------------------------------------

const CONTROL_WORDS: Readonly<Record<string, { code: string; unit: string; scale: number }>> = {
  cutoff: { code: "lpf", unit: " Hz", scale: 1 },
  resonance: { code: "lpq", unit: "", scale: 1 },
  attack: { code: "attack", unit: " s", scale: 1 },
  release: { code: "release", unit: " s", scale: 1 },
  room: { code: "room", unit: "", scale: 1 },
  delay: { code: "delay", unit: "", scale: 1 },
};
const controlsOf = (trial: Trial<unknown>): Record<string, number>[] | null =>
  Array.isArray(trial.params.controlsByBar) ? (trial.params.controlsByBar as Record<string, number>[]) : null;

/** What changed between the bars of a sound trial, in the code's own names ("lpf went from 700 to 3200"). */
export function soundChangeLine(trial: Trial<unknown>): string | null {
  const bars = controlsOf(trial);
  if (!bars || bars.length < 2) return null;
  const [a, b] = bars as [Record<string, number>, Record<string, number>];
  const changes = Object.keys(CONTROL_WORDS).filter((k) => a[k] !== undefined && a[k] !== b[k]);
  if (changes.length === 0) return null;
  const fmt = (k: string, v: number) => `${Math.round(v * 1000) / 1000}${CONTROL_WORDS[k]?.unit ?? ""}`;
  const parts = changes.map(
    (k) => `${CONTROL_WORDS[k]?.code} went from ${fmt(k, a[k] as number)} to ${fmt(k, b[k] as number)}`,
  );
  const cutoff = changes.includes("cutoff")
    ? (b.cutoff as number) > (a.cutoff as number)
      ? " The filter opened, so bar 2 is brighter."
      : " The filter closed, so bar 2 is darker."
    : "";
  return `In bar 2, ${listWords(parts)}.${cutoff}`;
}

/** Bar 2 of a sound trial with bar 1's sound and bar 1 with bar 2's: the change run the other way. */
function soundReversed(trial: Trial<unknown>): AudioPlan | null {
  const bars = controlsOf(trial);
  if (!bars || bars.length < 2) return null;
  const hits: Hit[] = trial.events.map((e) => {
    const bar = Math.floor(onsetOf(e) + 1e-9);
    const v = { ...playValue(e), ...(bars[1 - Math.min(1, bar)] ?? {}) };
    return { at: onsetOf(e), dur: durOf(e), value: v };
  });
  return hitsPlan(hits, trial.cps, 2);
}
function soundBar(trial: Trial<unknown>, bar: 0 | 1, times = 1): AudioPlan | null {
  const bars = controlsOf(trial);
  if (!bars) return null;
  const hits: Hit[] = [];
  for (let k = 0; k < times; k++)
    for (const e of trial.events)
      if (Math.floor(onsetOf(e) + 1e-9) === 1)
        hits.push({
          at: onsetOf(e) - 1 + k,
          dur: durOf(e),
          value: { ...playValue(e), ...(bars[bar] ?? {}) },
        });
  return hitsPlan(hits, trial.cps, times);
}

const ROLE_TRACK: Readonly<Record<string, string>> = { bass: "bass", pad: "pad", lead: "mel" };
const ROLE_WORDS: Readonly<Record<string, string>> = {
  bass: "the bass (the low line)",
  pad: "the pad (the held chords)",
  lead: "the lead (the tune)",
};
type RolesAsk =
  | { kind: "masking"; muddy: "pad" | "lead" | "none" }
  | { kind: "dropped"; role: "bass" | "pad" | "lead" }
  | { kind: "who"; role: "bass" | "pad" | "lead" };
const isRole = (x: unknown): x is "bass" | "pad" | "lead" => x === "bass" || x === "pad" || x === "lead";
/** What a roles trial asks: which part crowds the bass (or none), which part dropped out, or who plays a role. */
function rolesAsk(trial: Trial<unknown>): RolesAsk | null {
  if (trial.family !== "fam.snd.roles") return null;
  const p = trial.params;
  const asked = expectedChoice(trial);
  if (trial.category === "masking") {
    const m = isRole(p.muddy) || p.muddy === "none" ? p.muddy : asked;
    return m === "pad" || m === "lead" || m === "none" ? { kind: "masking", muddy: m } : null;
  }
  if (isRole(p.dropped)) return { kind: "dropped", role: p.dropped };
  if (isRole(asked)) return { kind: "dropped", role: asked };
  return isRole(p.role) ? { kind: "who", role: p.role } : null;
}
const pitchedOf = (trial: Trial<unknown>, track: string): number[] =>
  trial.events.filter((e) => e.track === track && e.midi !== null).map((e) => e.midi as number);

/** Who plays what, and where: which part dropped out, or which part sits in the bass's range (read from the notes). */
export function rolesLine(trial: Trial<unknown>): string | null {
  const ask = rolesAsk(trial);
  if (!ask) return null;
  if (ask.kind === "dropped")
    return `${cap(ROLE_WORDS[ask.role] as string)} drops out in bars 3 and 4; the other two keep playing.`;
  if (ask.kind === "who") return `${cap(ROLE_WORDS[ask.role] as string)} is the part asked about.`;
  const bass = pitchedOf(trial, "bass");
  if (bass.length === 0) return null;
  const range = `${noteName(Math.min(...bass))} to ${noteName(Math.max(...bass))}`;
  if (ask.muddy === "none") {
    const pad = pitchedOf(trial, "pad");
    const mel = pitchedOf(trial, "mel");
    if (pad.length === 0 || mel.length === 0) return null;
    return `Neither: the chords stay at ${noteName(Math.min(...pad))} and above, the tune at ${noteName(Math.min(...mel))} and above, clear of the bass (${range}).`;
  }
  const notes = pitchedOf(trial, ROLE_TRACK[ask.muddy] as string);
  if (notes.length === 0) return null;
  const what = ask.muddy === "pad" ? "The chords play" : "The tune plays";
  return `${what} down to ${noteName(Math.min(...notes))}, inside the bass's range (${range}).`;
}

/** A roles trial's part moved by octaves until its lowest note clears (or reaches) the bass's top note. */
function movedPart(trial: Trial<unknown>, track: string, direction: "up" | "down"): AudioPlan | null {
  const bass = pitchedOf(trial, "bass");
  const part = pitchedOf(trial, track);
  if (bass.length === 0 || part.length === 0) return null;
  const top = Math.max(...bass);
  let shift = 0;
  if (direction === "up") while (Math.min(...part) + shift <= top + 4) shift += 12;
  else while (Math.min(...part) + shift > top) shift -= 12;
  if (shift === 0) return null;
  return hitsPlan(
    trial.events.map((e) => {
      const v = playValue(e);
      if (e.track === track && typeof v.note === "number") v.note += shift;
      return { at: onsetOf(e), dur: durOf(e), value: v };
    }),
    trial.cps,
    barsOf(trial),
  );
}
/** "a half step", "a whole step", "3 half steps". */
function stepWords(semis: number): string {
  const n = Math.abs(semis);
  return n === 1 ? "a half step" : n === 2 ? "a whole step" : `${n} half steps`;
}
function noteName(midi: number): string {
  return `${show(PC_FLAT[mod(midi, 12)] as string)}${Math.floor(midi / 12) - 1}`;
}

// --- the facts --------------------------------------------------------------------------------------------------

/**
 * What a Wave 7 trial was, in one sentence under the feedback, with the labels the lenses allow (chord symbols,
 * numerals, note names). Null for a trial with nothing to add.
 */
export function stageGFact(
  trial: Trial<unknown>,
  shown: { chordSymbols: boolean; romanNumerals: boolean; noteNames: boolean },
): string | null {
  const key = keyOf(trial);
  switch (trial.family) {
    case "fam.jzz.ii-v": {
      if (!key || trial.category === "chain" || trial.category === "locate") return null;
      const { chords } = chordsOf(trial);
      // A chord held over two bars is named once.
      const list = chords
        .filter((c): c is ChordId => c !== null)
        .filter(
          (c, i, all) => i === 0 || !(all[i - 1]?.rootPc === c.rootPc && all[i - 1]?.quality === c.quality),
        );
      const names = list.map((c, i) => chordWords(c, key, shown, list[i + 1])).filter(Boolean);
      const lead = `In ${keyDisplay(key)}`;
      return names.length === list.length && names.length > 0 ? `${lead}: ${names.join(", ")}.` : `${lead}.`;
    }
    case "fam.jzz.guide": {
      if (trial.params.mode === "sing") {
        const chords = chordsOf(trial).chords.filter((c): c is ChordId => c !== null);
        const start = trial.params.startsOn === "7th" ? "seventh" : "third";
        const line = guideToneLine(chords, { start });
        if (line.some((s) => s === null) || chords.length === 0) return null;
        const steps = line as NonNullable<(typeof line)[number]>[];
        const parts = steps.map((s, i) => {
          const role = s.role === "third" ? "the 3rd" : "the 7th";
          const of = shown.chordSymbols
            ? ` of ${toLeadSheet(s.chord)}`
            : i === 0
              ? " of the first chord"
              : "";
          return `${role}${of}${shown.noteNames ? ` (${show(s.name)})` : ""}`;
        });
        const moves = steps
          .slice(1)
          .map((s) => (s.move === 0 ? "holds" : `moves ${stepWords(s.move)} ${s.move < 0 ? "down" : "up"}`));
        return `The line: ${listWords(parts)}. It ${listWords(moves)}.`;
      }
      const v = guideVoices(trial);
      const top = v && v.top[0] !== v.top[1];
      if (!v) return null;
      const moving = top ? v.top : v.bottom;
      const step = (moving[1] as number) - (moving[0] as number);
      const size = stepWords(step);
      return `The ${top ? "top" : "bottom"} voice moves ${size} ${step < 0 ? "down" : "up"}${
        shown.noteNames ? ` (${noteName(moving[0] as number)} to ${noteName(moving[1] as number)})` : ""
      }; the other holds. A 7th falls to the next chord's 3rd.`;
    }
    case "fam.jzz.extension": {
      const c = colourOf(trial);
      const q = expectedChoice(trial);
      if (!c || !q) return null;
      const root = PC_FLAT[c.rootPc] as string;
      let name = QUALITY_WORDS[q] ?? q;
      if (shown.chordSymbols)
        try {
          name = toLeadSheet(chordOf(root, q as never));
        } catch {
          // keep the words
        }
      const colour = COLOUR_WORDS[c.semis] ?? "colour note";
      return `${cap(name)}: the top note is the ${colour}${shown.noteNames ? ` (${noteName(c.midi)})` : ""}.`;
    }
    case "fam.jzz.subs": {
      if (!key) return null;
      const { slots, chords } = chordsOf(trial);
      if (trial.category === "in-standard") {
        const bar = Number(expectedChoice(trial) ?? 0);
        const sub = chords[bar - 1];
        if (!sub) return null;
        const orig = tritoneSub(sub);
        const s = chordWords(sub, key, shown) ?? "the substitute";
        const o = chordWords(orig, key, shown) ?? "the dominant it replaces";
        return `Bar ${bar}: ${s} in place of ${o}. Its root is a tritone away; the 3rd and 7th are the same two notes.`;
      }
      // The way in is the chord just before home (the last chord).
      const n = chords.length;
      const way = chords[n - 2];
      const target = chords[n - 1];
      if (!way || !target || n < 3) return null;
      const w = chordWords(way, key, shown, target) ?? "the chord before home";
      const fall = mod((slots[n - 2]?.bass ?? 0) - (slots[n - 1]?.bass ?? 0), 12);
      const asked = expectedChoice(trial);
      if (asked === "bII7-I") return `${w}: the tritone substitute. The bass slides down a half step home.`;
      if (asked === "backdoor") return `${w}: the backdoor. Home is reached from a whole step below.`;
      return fall === 7
        ? `${w}: the plain dominant. The bass falls a fifth home.`
        : `${w}: the plain dominant, a fifth above home.`;
    }
    case "fam.rhy.clave":
      return claveLine(trial);
    case "fam.rhy.odd-grouping":
      return groupingLine(trial);
    case "fam.rhy.polyrhythm":
      return polyLine(trial);
    case "fam.rhy.swing":
      return trial.level >= 2 ? swingLine(trial) : null;
    case "fam.snd.params":
      return soundChangeLine(trial);
    case "fam.snd.roles":
      return rolesLine(trial);
    default:
      return null;
  }
}

// --- alone, context, near miss ---------------------------------------------------------------------------------

/** The thing alone, for a Wave 7 family (null: it keeps the runner's usual "alone", or has none). */
export function wave7Alone(trial: Trial<unknown>): Listen | null {
  const plan = (label: string, p: AudioPlan | null): Listen | null =>
    p && p.events.length > 0 ? { label, plan: p } : null;
  switch (trial.family) {
    case "fam.jzz.ii-v":
      return trial.category === "chain" ? null : plan("The 3rds and 7ths alone", guideNotesPlan(trial));
    case "fam.jzz.guide":
      return trial.params.mode === "sing"
        ? plan("The line alone", sungLinePlan(trial, false))
        : plan("Each voice alone", sequence([voicePlan(trial, "top"), voicePlan(trial, "bottom")], 0.4));
    case "fam.jzz.extension": {
      const c = colourOf(trial);
      if (!c) return null;
      const sound = soundsOf(trial).chords;
      return plan(
        "The top note, then the chord",
        sequence(
          [
            {
              events: [{ at: 0, dur: 0.9, value: { s: sound, note: c.midi, gain: 0.7 } }],
              durationSec: 1,
              preload: [sound],
            },
            // The asked chord by itself (its own notes, `params.midis`), not the whole passage.
            {
              events: (trial.params.midis as number[]).map((note, i) => ({
                at: 0,
                dur: 1.6,
                value: {
                  s: i === 0 ? (soundsOf(trial).bass ?? sound) : sound,
                  note,
                  gain: i === 0 ? 0.7 : 0.5,
                },
              })),
              durationSec: 1.8,
              preload: [...new Set([sound, soundsOf(trial).bass ?? sound])],
            },
          ],
          0.3,
        ),
      );
    }
    case "fam.jzz.subs":
      return plan("The bass line alone", eventsPlan(trial, trackIs("bass")));
    case "fam.jzz.voicing": {
      const right = expectedChoice(trial);
      return right ? plan("The voicing", namesPlan(right)) : null;
    }
    case "fam.rhy.clave":
      return trial.events.some((e) => e.track !== "perc")
        ? plan("The clave alone", eventsPlan(trial, trackIs("perc")))
        : null;
    case "fam.rhy.odd-grouping":
      return plan(
        "The accents alone",
        eventsPlan(trial, (e) => e.track === "kick" || (e.track === "mel" && e.gain >= 0.9)),
      );
    case "fam.rhy.polyrhythm":
      return plan("The high pulse alone", eventsPlan(trial, trackIs("high")));
    case "fam.snd.params":
      return plan("Bar 1, then bar 2, alone", sequence([soundBar(trial, 0), soundBar(trial, 1)], 0.5));
    case "fam.snd.roles": {
      const ask = rolesAsk(trial);
      if (!ask) return null;
      if (ask.kind === "masking")
        return ask.muddy === "none"
          ? plan("The bass alone", eventsPlan(trial, trackIs("bass")))
          : plan(
              ask.muddy === "pad" ? "The chords alone" : "The tune alone",
              eventsPlan(trial, trackIs(ROLE_TRACK[ask.muddy] as string)),
            );
      return plan(
        `${cap((ROLE_WORDS[ask.role] as string).replace(/ \(.*\)$/, ""))} alone`,
        eventsPlan(trial, trackIs(ROLE_TRACK[ask.role] as string)),
      );
    }
    default:
      return null;
  }
}

/** The thing in context, where a Wave 7 family has its own (null: the passage again from its cue). */
export function wave7Context(trial: Trial<unknown>): Listen | null {
  const plan = (label: string, p: AudioPlan | null): Listen | null =>
    p && p.events.length > 0 ? { label, plan: p } : null;
  switch (trial.family) {
    case "fam.jzz.guide":
      return trial.params.mode === "sing"
        ? plan("The line over the chords", sungLinePlan(trial, true))
        : null;
    case "fam.rhy.clave":
      return trial.events.every((e) => e.track === "perc")
        ? plan("With the beat under it", claveInTime(trial))
        : null;
    default:
      return null;
  }
}

/**
 * The thing against its near miss: the other progression (major against minor ii–V), the other guide-tone line,
 * the chord without its colour (or the learner's pick), V7 against its tritone substitute, the clave the other way
 * round, the bar grouped another way, the other polyrhythm, the next swing feel (or eighths against sixteenths), the
 * sound change run the other way, the muddy part lifted out of the bass. The learner's own wrong pick is the near
 * miss when there is one.
 */
export function wave7Near(
  trial: Trial<unknown>,
  def: Pick<FamilyDef, "categories" | "levels" | "generator"> | null,
  got: Answer | null,
): Listen | null {
  switch (trial.family) {
    case "fam.jzz.ii-v":
      return trial.category === "chain" || trial.category === "locate" ? null : iiVNear(trial, got);
    case "fam.jzz.guide": {
      if (trial.params.mode === "sing") {
        const p = otherLinePlan(trial);
        return p
          ? { label: `The line from the ${trial.params.startsOn === "7th" ? "3rd" : "7th"}`, plan: p }
          : null;
      }
      // Which voice moves: the same two guide tones with the other one on top (so the other voice moves).
      const v = guideVoices(trial);
      if (!v) return null;
      const sound = soundsOf(trial);
      const bass = chordSlotsOf(trial).map((x) => x.bass);
      const p = hitsPlan(
        [0, 1].flatMap((i) => [
          { at: i, dur: 0.95, value: { s: sound.bass ?? sound.chords, note: bass[i] as number, gain: 0.75 } },
          { at: i, dur: 0.95, value: { s: sound.chords, note: v.top[i] as number, gain: 0.55 } },
          { at: i, dur: 0.95, value: { s: sound.chords, note: (v.bottom[i] as number) + 12, gain: 0.55 } },
        ]),
        trial.cps,
        2,
      );
      return p ? { label: "With the other voice on top", plan: p } : null;
    }
    case "fam.jzz.extension":
      return extensionNear(trial, got);
    case "fam.jzz.subs":
      return subsNear(trial, got);
    case "fam.jzz.voicing": {
      const pick = got?.choice?.[0];
      const right = expectedChoice(trial);
      if (!pick || pick === right) return null;
      const p = namesPlan(pick);
      return p ? { label: "Yours", plan: p } : null;
    }
    case "fam.rhy.clave":
      return claveNear(trial, got);
    case "fam.rhy.odd-grouping":
      return groupingNear(trial, def, got);
    case "fam.rhy.polyrhythm":
      return trial.params.mode === "tap" ? null : polyNear(trial, got);
    case "fam.rhy.swing":
      return trial.level >= 2 ? swingNear(trial) : null;
    case "fam.snd.params": {
      const p = soundReversed(trial);
      return p ? { label: "The change the other way", plan: p } : null;
    }
    case "fam.snd.roles": {
      const ask = rolesAsk(trial);
      if (!ask) return null;
      if (ask.kind === "masking") {
        if (ask.muddy === "none") {
          const p = movedPart(trial, "pad", "down");
          return p ? { label: "With the chords down in the bass's range", plan: p } : null;
        }
        const p = movedPart(trial, ROLE_TRACK[ask.muddy] as string, "up");
        return p ? { label: "With that part lifted out of the bass", plan: p } : null;
      }
      // Which part dropped out: bars 1–2 without the learner's pick (or another part), then without the part that
      // did drop out — the same bars, so the only difference is which part is missing.
      const pick = got?.choice?.[0];
      const other =
        isRole(pick) && pick !== ask.role
          ? pick
          : (["bass", "pad", "lead"] as const).find((r) => r !== ask.role);
      if (!other) return null;
      const without = (role: string): AudioPlan | null =>
        hitsPlan(
          trial.events
            .filter((e) => onsetOf(e) < 2 - 1e-9 && e.track !== ROLE_TRACK[role])
            .map((e) => ({ at: onsetOf(e), dur: durOf(e), value: playValue(e) })),
          trial.cps,
          2,
        );
      const word = (r: string) => (ROLE_WORDS[r] as string).replace(/ \(.*\)$/, "");
      const p = sequence([without(other), without(ask.role)], 0.6);
      return p.events.length > 0
        ? {
            label: `${other === pick ? "Yours: without" : "Without"} ${word(other)}, then without ${word(ask.role)}`,
            plan: p,
          }
        : null;
    }
    default:
      return null;
  }
}

/** The second question for the ear after a Wave 7 trial, or null. */
export function wave7FollowUp(trial: Trial<unknown>): FollowUp | null {
  return iiVFollowUp(trial);
}

// --- the rhythm drawn as lanes ---------------------------------------------------------------------------------

export interface RhythmLane {
  label: string;
  /** Onsets as fractions of the whole span (0–1). */
  hits: number[];
  /** Hits drawn stronger (accents, group starts). */
  strong?: number[];
}
export interface RhythmLanes {
  /** How many bars the span holds, and the grid lines a bar (eighths, or the meter's eighths). */
  bars: number;
  grid: number;
  lanes: RhythmLane[];
  /** Brackets over the first bar: group starts and lengths in grid steps (odd groupings). */
  groups?: { start: number; length: number }[];
  /** Words under the lanes ("3-side", "2-side"), one per bar. */
  barLabels?: string[];
  /** The accessible name of the drawing. */
  label: string;
}

/** The answer drawn as lanes after a clave, odd-grouping or polyrhythm trial; null for anything else. */
export function rhythmLanesOf(trial: Trial<unknown>): RhythmLanes | null {
  if (trial.family === "fam.rhy.clave") {
    const c = claveStepsOf(trial);
    if (!c) return null;
    const which = claveOf(c.steps);
    const hits = c.steps.map((s) => s / 16);
    const sides = which
      ? which.direction === "3-2"
        ? ["3-side", "2-side"]
        : ["2-side", "3-side"]
      : undefined;
    return {
      bars: 2,
      grid: 8,
      lanes: [{ label: "Clave", hits }],
      ...(sides ? { barLabels: sides } : {}),
      label: claveLine(trial) ?? "The clave's strokes over two bars",
    };
  }
  const g = groupingOf(trial);
  if (g) {
    const starts: number[] = [];
    let at = 0;
    for (const n of g.groups) {
      starts.push(at);
      at += n;
    }
    return {
      bars: 1,
      grid: g.total,
      lanes: [
        {
          label: "Eighths",
          hits: Array.from({ length: g.total }, (_, i) => i / g.total),
          strong: starts.map((s) => s / g.total),
        },
      ],
      groups: g.groups.map((length, i) => ({ start: starts[i] as number, length })),
      label: groupingLine(trial) ?? "The bar's groups",
    };
  }
  const p = pulsesOf(trial);
  if (p && trial.params.mode !== "tap") {
    return {
      bars: 1,
      grid: 4,
      lanes: [
        { label: `High · ${p.high}`, hits: Array.from({ length: p.high }, (_, i) => i / p.high) },
        { label: `Low · ${p.low}`, hits: Array.from({ length: p.low }, (_, i) => i / p.low) },
      ],
      label: polyLine(trial) ?? "The two pulses",
    };
  }
  return null;
}

// --- two lanes of taps ------------------------------------------------------------------------------------------

export interface TapLaneSpec {
  /** The tap voice of `@oak/audio` (0: F, 1: J). */
  voice: 0 | 1;
  key: "F" | "J";
  label: string;
  /** Seconds from the start of the response window. */
  targets: number[];
}

/**
 * The two lanes of a two-hand tap trial (contracts §8.4: two-voice taps use F and J; wave7.md §11 `tap.lanes`), as
 * the generator writes them in `params.tapLanes` (`fam.rhy.polyrhythm` "tap-3-over-2": the 2 with the kick on F, the
 * 3 on J, from bar 2). The same lanes the engine grades (`@oak/drills` `tapLanesOfTrial`), in the same order. Null for
 * a one-lane tap.
 */
export function tapLanesOf(trial: Trial<unknown>): TapLaneSpec[] | null {
  if (trial.params.mode !== "tap") return null;
  const own = trial.params.tapLanes;
  if (!Array.isArray(own) || own.length !== 2) return null;
  const lanes = own.map((l, i) => {
    const lane = l as { label?: unknown; key?: unknown; targets?: unknown };
    const targets = Array.isArray(lane.targets)
      ? (lane.targets as unknown[]).filter((t): t is number => typeof t === "number")
      : [];
    const key = String(lane.key ?? (i === 0 ? "f" : "j")).toUpperCase() === "J" ? "J" : "F";
    return {
      voice: (key === "J" ? 1 : 0) as 0 | 1,
      key: key as "F" | "J",
      label: String(lane.label ?? `Lane ${i + 1}`),
      targets,
    };
  });
  return lanes[0]?.voice !== lanes[1]?.voice && lanes.every((l) => l.targets.length > 0) ? lanes : null;
}

/** The taps of one lane, from the captured taps and their voices. */
export function laneTaps(
  taps: readonly number[],
  voices: readonly number[] | null | undefined,
  voice: 0 | 1,
): number[] {
  if (!voices || voices.length !== taps.length) return voice === 0 ? [...taps] : [];
  return taps.filter((_, i) => voices[i] === voice);
}

/** A two-lane take in words: "F: 6 of 6 matched · J: 7 of 9 matched". */
export function lanesReport(
  lanes: readonly TapLaneSpec[],
  taps: readonly number[],
  voices: readonly number[] | null | undefined,
): string {
  return lanes
    .map((l) => {
      const mine = laneTaps(taps, voices, l.voice);
      const used = new Set<number>();
      const offsets: number[] = [];
      for (const t of l.targets) {
        const i = mine.findIndex((x, k) => !used.has(k) && Math.abs(x - t) <= 0.15);
        if (i >= 0) {
          used.add(i);
          offsets.push(((mine[i] as number) - t) * 1000);
        }
      }
      // As the one-lane pad says it (`tapReport`): a steady lean of 15 ms or more is named.
      const mean = offsets.length > 0 ? offsets.reduce((a, b) => a + b, 0) / offsets.length : 0;
      const lean =
        offsets.length > 0 && Math.abs(mean) >= 15
          ? `, about ${Math.round(Math.abs(mean))} ms ${mean > 0 ? "late" : "early"}`
          : "";
      return `${l.key}: ${offsets.length} of ${l.targets.length} matched${lean}`;
    })
    .join(" · ");
}

// --- Quiet mode: a sung trial heard in the head ------------------------------------------------------------------

/** What a sung trial asks the learner to hear in their head in Quiet mode. */
export function quietSingText(trial: Trial<unknown>): string {
  if (trial.family === "fam.jzz.guide")
    return `Quiet mode: sing the guide-tone line in your head while the chords play, from the ${
      trial.params.startsOn === "7th" ? "7th" : "3rd"
    } of the first chord.`;
  return "Quiet mode: sing it in your head while it plays.";
}

export const _test = { stepsOfClave, noteMidi, ratioWords, chordsPlan, progressionOf };

// --- the Practice hub: the tracks -------------------------------------------------------------------------------

/** One track's state as the hub reads it (`TrackState` of `tracks.list`, when the server has answered). */
export interface TrackLine {
  status: "locked" | "open";
  note: string;
}

/** Families split into the core's and each advanced track's (by the lesson that opens them), in catalog order. */
export function familiesByTrack<T extends Pick<FamilyDef, "unlock">>(
  defs: readonly T[],
): { core: T[]; tracks: Record<TrackKey, T[]> } {
  const tracks: Record<TrackKey, T[]> = { J: [], R: [], A: [] };
  const core: T[] = [];
  for (const d of defs) {
    const t = trackOfFamily(d);
    if (t) tracks[t].push(d);
    else core.push(d);
  }
  return { core, tracks };
}

/**
 * Where a locked track family opens, honestly: while its track is closed, the track's own line ("Opens with the
 * unit 13 checkpoint."); once the track is open, the lesson that opens the family, by its title ("Opens with the
 * lesson “Clave Direction”"), never by its ID alone.
 */
export function trackLockedText(
  def: Pick<FamilyDef, "unlock">,
  track: TrackLine | null,
  titles?: ReadonlyMap<string, string>,
): string {
  if (track && track.status === "locked") return track.note;
  const title = titles?.get(def.unlock.lesson);
  return title ? `Opens with the lesson “${title}”` : "Opens with a later lesson of its track";
}

/**
 * What free practice of a sung family does in Quiet mode: a family with a listening half (guide tones: "which voice
 * moves") runs, its sung trials heard in the head (`listening`); a family that is only sung waits (`waits`). Null
 * when the family needs no microphone or Quiet mode is off.
 */
export function quietPracticeOf(
  def: Pick<FamilyDef, "mic" | "alsoKind">,
  quiet: boolean,
): "listening" | "waits" | null {
  if (!quiet || def.mic !== true) return null;
  return def.alsoKind === "perceptual" ? "listening" : "waits";
}

// --- two lanes heard back ------------------------------------------------------------------------------------------

/** The sound of each lane: the trial's own low and high pulse (a kick, a bell or rim), with their kit. */
function laneSounds(trial: Trial<unknown>): Record<0 | 1, SuperdoughValue> {
  const low = trial.events.find((e) => e.track === "low");
  const high = trial.events.find((e) => e.track === "high");
  return {
    0: low ? playValue(low) : { s: "bd", gain: 0.9 },
    1: high ? playValue(high) : { s: "rim", gain: 0.8 },
  };
}
function laneClicks(
  trial: Trial<unknown>,
  taps: readonly number[],
  voices: readonly (0 | 1)[],
  from = 0,
): AudioPlan["events"] {
  const sound = laneSounds(trial);
  return taps.map((t, i) => ({ at: t - from, dur: 0.1, value: sound[voices[i] ?? 0] }));
}
const planOf = (events: AudioPlan["events"]): AudioPlan => {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  return {
    events: sorted,
    durationSec: Math.max(0, ...sorted.map((e) => e.at + e.dur)) + 0.2,
    preload: [
      ...new Set(
        sorted.map((e) =>
          e.value.note === undefined && e.value.bank ? `${e.value.bank}_${e.value.s}` : e.value.s,
        ),
      ),
    ].sort(),
  };
};

/** "Hear the answer" of a two-lane take: both pulses all the way through, each on its own sound. */
export function lanesAnswerPlan(trial: Trial<unknown>): AudioPlan | null {
  const lanes = tapLanesOf(trial);
  if (!lanes) return null;
  const responseAt = Number(trial.params.responseAt ?? 0);
  const first = Math.min(...lanes.flatMap((l) => l.targets));
  // Bar 1 as it played (both pulses), then each lane's targets on its own sound.
  const opening = trial.events
    .filter((e) => onsetOf(e) / trial.cps - responseAt < first - 1e-3)
    .map((e) => ({
      at: onsetOf(e) / trial.cps - responseAt,
      dur: durOf(e) / trial.cps,
      value: playValue(e),
    }));
  const sound = laneSounds(trial);
  const rest = lanes.flatMap((l) => l.targets.map((t) => ({ at: t, dur: 0.1, value: sound[l.voice] })));
  return planOf([...opening, ...rest].map((e) => ({ ...e, at: Math.max(0, e.at) })));
}

/** "Compare" of a two-lane take: your two hands (each on its lane's sound), then both pulses as they should be. */
export function lanesComparePlan(
  trial: Trial<unknown>,
  taps: readonly number[] | null,
  voices: readonly (0 | 1)[] | null | undefined,
): AudioPlan | null {
  const lanes = tapLanesOf(trial);
  if (!lanes || !taps || taps.length === 0) return null;
  const v = voices && voices.length === taps.length ? voices : taps.map(() => 0 as const);
  const first = Math.min(...lanes.flatMap((l) => l.targets));
  const mine = planOf(laneClicks(trial, taps, v, Math.min(first, ...taps)));
  const sound = laneSounds(trial);
  const its = planOf(
    lanes.flatMap((l) => l.targets.map((t) => ({ at: t - first, dur: 0.1, value: sound[l.voice] }))),
  );
  return sequence([mine, its], 0.8);
}
