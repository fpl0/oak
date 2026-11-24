// The drill runner's pure core: which answer surface a generated trial needs, how a widget value becomes a
// `TrialResponse`, the wire record of a trial, set planning with an easy first trial, what the set summary says,
// and the Practice hub's grouping and states. No DOM, no audio, no API: everything here is unit-tested.
import type {
  Answer,
  AnswerUi,
  ChordQuality,
  Degree,
  DrillFinish,
  DrillSession,
  DrillTrialRecord,
  FamilyDef,
  FamilyId,
  FamilyState,
  KeySpec,
  LearnerProfile,
  SingTolCents,
  SrsCard,
  SrsReviewResult,
  SungResolution,
  SyllabusDef,
  Trial,
  TrialResult,
} from "@oak/api";
import {
  type DrillFamilyRuntime,
  type DrillTrialResult,
  FAMILIES,
  generateSet,
  gradeTrial,
  isCompositeGenerator,
  isPendingGenerator,
  planSet,
  type SetPlan,
  type SetSummary,
  summarizeSet,
  type TrialResponse,
  type TrialSpec,
} from "@oak/drills";
import { gradeFor } from "@oak/srs";
import { degreeSemitones, syllableOf } from "@oak/theory";
import { qualityLabel, rnDisplay } from "../answers/keys.ts";
import type { AnswerSpec, AnswerValue, SungSummary } from "../answers/types.ts";
import { isBassTrial } from "./harmony.ts";
import { isResting, RESTING_LINE } from "./resting.ts";
import { staffSpecOf } from "./staff.ts";
import {
  bassLineTrialOf,
  formAnswer,
  formIdLetters,
  formModeOf,
  gradeBassLine,
  gradeSections,
  graduationNews,
  honestLevel,
  stageECategoryLabel,
  stageEOptionLabel,
} from "./wave5.ts";
import {
  categoryDegree,
  chromaticPadSet,
  clickCellAnswer,
  clickCellsOf,
  padAnswer,
  stageFCategoryLabel,
  stageFOptionLabel,
} from "./wave6.ts";
import {
  laneTaps,
  lessonWithTrack,
  stageGCategoryLabel,
  stageGOptionLabel,
  stageGOptionsOf,
  tapLanesOf,
} from "./wave7.ts";

/**
 * A trial's response as the runner hands it to the grader: `@oak/drills`' own, plus (Wave 7) the voice of each tap of
 * a two-lane take (0: F, 1: J; `@oak/audio`'s `TapEvent.voice`), so each hand is graded against its own pulse.
 */
export type DrillResponse = TrialResponse & { tapVoices?: (0 | 1)[] };

// --- answer surfaces -----------------------------------------------------------------------------

/** How a trial is answered: the tap pad, the microphone, or an answers widget (app/src/answers). */
export type Surface =
  | { kind: "tap"; twoVoices: boolean }
  | { kind: "sing" }
  | { kind: "widget"; spec: AnswerSpec };

const MAJOR_DEGREES: Degree[] = ["1", "2", "3", "4", "5", "6", "7"];
const MINOR_DEGREES: Degree[] = ["1", "2", "b3", "4", "5", "b6", "b7"];
const DEGREE_RE = /^(?:deg\.)?([#b]?[1-7])$/;

/** Learner-facing labels of category and option IDs that are not self-explanatory. */
const OPTION_LABELS: Record<string, string> = {
  higher: "Higher",
  lower: "Lower",
  same: "Same",
  up: "Goes up",
  down: "Goes down",
  arch: "Up, then down",
  valley: "Down, then up",
  straight: "Straight",
  swung: "Swung",
  triplets: "Triplets",
  half: "Half step",
  whole: "Whole step",
  PAC: "Perfect authentic (V–I)",
  IAC: "Imperfect authentic",
  HC: "Half cadence (ends on V)",
  plagal: "Plagal (IV–I)",
  deceptive: "Deceptive (V–vi)",
  axis: "I–V–vi–IV",
  "three-chord": "I–IV–V",
  "axis-vi": "vi–IV–I–V",
  "doo-wop": "I–vi–IV–V",
  aeolian: "Aeolian loop (i–VI–III–VII)",
  andalusian: "Andalusian (i–VII–VI–V)",
  blues12: "12-bar blues",
  first: "First inversion",
  second: "Second inversion",
  third: "Third inversion",
  root: "Root position",
  maj: "Major",
  min: "Minor",
  dim: "Diminished",
  aug: "Augmented",
  PC: "Plagal (IV–I)",
  DC: "Deceptive (V–vi)",
  "bVII-I": "♭VII–I",
  "minor-PAC": "Perfect authentic, minor",
  "minor-HC": "Half cadence, minor",
  mixolydian: "I–♭VII–IV–I",
  "dorian-vamp": "i–IV vamp",
  "ii-V-I": "ii–V–I",
};

/**
 * The function family's answers. Kept apart from OPTION_LABELS because "D" is also a note name: a "Find home" trial
 * in D major offers the note D, which must never read as "Dominant".
 */
const FUNCTION_LABELS: Record<string, string> = { PD: "Predominant", T: "Tonic", D: "Dominant" };
const FUNCTION_GENERATOR = "harmony-function";
/** A bare note name ("D", "Bb", "F#"): printed as the learner reads it, never looked up as an option ID. */
const NOTE_NAME_RE = /^([A-G])([b#]?)$/;

/**
 * Category names that are levels of material rather than answers (shown in the level picker and in "what a level
 * adds"): never used as choice labels, where the same ID may mean something else ("minor" the mode).
 */
const CATEGORY_WORDS: Record<string, string> = {
  "schema-roots": "loop roots",
  "diatonic-roots": "any diatonic roots",
  inversions: "inverted chords",
  "two-per-bar": "two chords a bar",
  diatonic: "diatonic triads",
  cadential: "eight chords to a cadence",
  sevenths: "seventh chords",
  spot: "the inverted chord in a loop",
  stepwise: "stepwise tunes",
  sixths: "tunes up to a sixth",
  leaps: "leaps, rhythm by ear",
  "two-bars": "two bars",
  nct: "non-chord tones",
};

/** A category as the level picker and the level news name it. */
export function categoryLabel(id: string, generator?: string): string {
  const stageE = generator
    ? (stageECategoryLabel(generator, id) ??
      stageFCategoryLabel(generator, id) ??
      stageGCategoryLabel(generator, id))
    : null;
  if (stageE) return stageE.charAt(0).toUpperCase() + stageE.slice(1);
  const own = CATEGORY_WORDS[id];
  if (own) return own.charAt(0).toUpperCase() + own.slice(1);
  return optionLabel(id, generator);
}

export function optionLabel(id: string, generator?: string, options: readonly string[] = []): string {
  const own = generator
    ? (stageEOptionLabel(generator, id, options) ??
      stageFOptionLabel(generator, id) ??
      stageGOptionLabel(generator, id))
    : null;
  if (own) return own;
  if (generator === FUNCTION_GENERATOR && FUNCTION_LABELS[id]) return FUNCTION_LABELS[id];
  const note = NOTE_NAME_RE.exec(id);
  if (note) return `${note[1]}${note[2] === "b" ? "♭" : note[2] === "#" ? "♯" : ""}`;
  // Degree categories ("deg.5", "deg.b6", "deg.s4") read as the learner's word for them, never as an ID.
  const deg = /^deg\./.test(id) ? categoryDegree(id) : null;
  if (deg) return `Degree ${deg.replace("b", "♭").replace("#", "♯")}`;
  return OPTION_LABELS[id] ?? id.replace(/b(?=\d)/g, "♭").replace(/#(?=\d)/g, "♯");
}

function keyOf(trial: Trial<unknown>): KeySpec | null {
  const k = trial.params.key as KeySpec | undefined;
  return k && typeof k.tonic === "string" ? k : null;
}

/** The degree pad's contrast set: the level's own degree categories, else the key's diatonic degrees. */
export function degreeSetOf(trial: Trial<unknown>, def: FamilyDef): Degree[] {
  const level = def.levels[Math.max(0, Math.min(def.levels.length, trial.level) - 1)];
  const cats = (level?.categories ?? []).map((c) => DEGREE_RE.exec(c)?.[1] ?? categoryDegree(c));
  const expected = ((trial.expected as Answer).degrees ?? []) as Degree[];
  if (cats.length > 0 && cats.every((c) => c !== null)) {
    const set = [...new Set([...(cats as Degree[]), ...expected])];
    // Chromatic degrees (Wave 6): one pad key per pitch, so the pad never shows which spelling was asked.
    if (def.id === "fam.deg.fet-chromatic") return chromaticPadSet(set);
    return set.sort((a, b) => degreeSemitones(a) - degreeSemitones(b));
  }
  const key = keyOf(trial);
  const base = key && /minor|aeolian|dorian|phrygian/.test(key.mode) ? MINOR_DEGREES : MAJOR_DEGREES;
  const extra = expected.filter((d) => !base.includes(d));
  return [...base, ...extra].sort((a, b) => degreeSemitones(a) - degreeSemitones(b));
}

function levelCategories(trial: Trial<unknown>, def: FamilyDef): string[] {
  return [...(def.levels[Math.max(0, Math.min(def.levels.length, trial.level) - 1)]?.categories ?? [])];
}

/** Choice options: the trial's own `options`, else the categories of the level it was played at. */
export function choiceOptionsOf(trial: Trial<unknown>, def: FamilyDef): string[] {
  // Wave 7: an odd-grouping trial answers with the grouping alone, so its options are groupings of its meter.
  const grouped = stageGOptionsOf(trial, def);
  if (grouped) return grouped;
  const own = trial.params.options;
  if (Array.isArray(own) && own.every((o) => typeof o === "string")) return own as string[];
  const expected = (trial.expected as Answer).choice ?? [];
  const cats = levelCategories(trial, def);
  for (const e of expected) if (!cats.includes(e)) cats.push(e);
  return cats;
}

/** Strudel audition code of each option, when the generator offers it (`choiceAudio`). */
function choiceAudioOf(trial: Trial<unknown>): Map<string, string> {
  const raw = trial.params.choiceAudio;
  const out = new Map<string, string>();
  if (Array.isArray(raw))
    for (const r of raw)
      if (r && typeof r === "object" && typeof r.id === "string" && typeof r.audio === "string")
        out.set(r.id, r.audio);
  return out;
}

/** The answer surface of a trial (`params.mode` and `params.ui` as the generators set them). */
export function surfaceOf(
  trial: Trial<unknown>,
  def: FamilyDef,
  opts: { solfege?: "numbers" | "syllables" } = {},
): Surface {
  const p = trial.params;
  const expected = trial.expected as Answer;
  // Wave 7: a two-lane take (one hand per pulse) taps with F and J.
  if (p.mode === "tap") return { kind: "tap", twoVoices: p.twoVoices === true || tapLanesOf(trial) !== null };
  if (p.mode === "sing") return { kind: "sing" };
  const ui = typeof p.ui === "string" ? p.ui : null;
  // Form by ear (Wave 5): the sections labelled one by one on the form widget.
  const form = formModeOf(trial);
  if (form) return { kind: "widget", spec: form.spec };
  // Written on the staff (dictation's top levels): the answers registry's staff widget; graded as code.
  if (ui === "staff-input") return { kind: "widget", spec: staffSpecOf(trial) };
  if (p.mode === "code" || ui === "code")
    return { kind: "widget", spec: { ui: "code", starter: codeStarterOf(trial) } };
  if (ui === "bar-buttons") {
    const bars = Math.max(1, Number(p.bars ?? 4));
    const multi = (expected.choice?.length ?? 0) > 1 || p.multi === true;
    // The generator names its own options (some bars only, or "No key change"), or several bars are asked
    // (where each phrase starts): buttons labelled by bar, one or more picks.
    if (Array.isArray(p.options) || multi) {
      const labels =
        p.optionLabels && typeof p.optionLabels === "object"
          ? (p.optionLabels as Record<string, unknown>)
          : {};
      const ids = Array.isArray(p.options)
        ? (p.options as unknown[]).map(String)
        : Array.from({ length: bars }, (_, i) => String(i + 1));
      const options = ids.map((id) => ({
        id,
        label: typeof labels[id] === "string" ? (labels[id] as string) : `Bar ${id}`,
      }));
      return {
        kind: "widget",
        spec: { ui: "choice", options, layout: "buttons", ...(multi ? { multi: true } : {}) },
      };
    }
    return { kind: "widget", spec: { ui: "bar-buttons", bars } };
  }
  // Find the push (Wave 6): the loop's cells on the rhythm grid, grouped by the beat.
  const cells = clickCellsOf(trial);
  if (cells) return { kind: "widget", spec: cells.spec };
  if (ui === "grid") {
    const steps = Number(p.stepsPerBar ?? 8);
    // 6 and 24 steps (Wave 6): a bar of 6/8, and sixteenth-note triplets.
    const stepsPerBar = ([6, 12, 16, 24].includes(steps) ? steps : 8) as 6 | 8 | 12 | 16 | 24;
    return {
      kind: "widget",
      spec: { ui: "grid", rows: ["hit"], stepsPerBar, bars: Number(p.gridBars ?? p.bars ?? 1) },
    };
  }
  if (ui === "text" || expected.text) {
    const kind = String(p.textKind ?? "free");
    const normalize = (["note", "chord", "rn", "interval", "key"].includes(kind) ? kind : "free") as Extract<
      AnswerUi,
      { ui: "text" }
    >["normalize"];
    return { kind: "widget", spec: { ui: "text", normalize } };
  }
  if (ui === "number" || expected.number !== undefined) return { kind: "widget", spec: { ui: "number" } };
  if (ui === "rn-palette" || expected.rn)
    return {
      kind: "widget",
      spec: {
        ui: "rn-palette",
        slots: Math.max(1, typeof p.slots === "number" ? p.slots : (expected.rn?.length ?? 1)),
        allow: rnAllowOf(p.rnAllow),
      },
    };
  if (expected.degrees) {
    const len = Number(p.sequenceLen ?? expected.degrees.length);
    return {
      kind: "widget",
      spec: {
        ui: "degree-pad",
        set: degreeSetOf(trial, def),
        ...(len > 1 ? { sequenceLen: len } : {}),
        syllables: opts.solfege === "syllables",
      },
    };
  }
  if (expected.qualities) {
    const set = [...new Set([...levelCategories(trial, def), ...expected.qualities])] as ChordQuality[];
    return { kind: "widget", spec: { ui: "quality-pad", set } };
  }
  if (ui === "click-cell") {
    // One pick among the cells of the loop, labelled by count ("2 &").
    const per = Number(p.stepsPerBar ?? 16);
    const bars = Number(p.bars ?? 1);
    const names = per === 16 ? ["", "e", "&", "a"] : per === 8 ? ["", "&"] : [""];
    const sub = Math.max(1, names.length);
    const options = Array.from({ length: per * bars }, (_, i) => {
      const inBar = i % per;
      const beat = Math.floor(inBar / sub) + 1;
      const part = names[inBar % sub] ?? "";
      const bar = Math.floor(i / per) + 1;
      return { id: `c${i}`, label: `${bars > 1 ? `bar ${bar} · ` : ""}${beat}${part ? ` ${part}` : ""}` };
    });
    return { kind: "widget", spec: { ui: "choice", options, layout: "buttons" } };
  }
  const audio = choiceAudioOf(trial);
  // Generators that answer in code strings or named forms give readable labels (`params.optionLabels`).
  const labels =
    p.optionLabels && typeof p.optionLabels === "object" ? (p.optionLabels as Record<string, unknown>) : {};
  const ids = choiceOptionsOf(trial, def);
  const options = ids.map((id) => ({
    id,
    label: typeof labels[id] === "string" ? (labels[id] as string) : optionLabel(id, def.generator, ids),
    ...(audio.has(id) ? { audio: audio.get(id) as string } : {}),
  }));
  return {
    kind: "widget",
    spec: {
      ui: "choice",
      options,
      layout: audio.size > 0 ? "audio-cards" : "buttons",
      ...(p.multi === true ? { multi: true } : {}),
    },
  };
}

// --- melodic dictation: degrees, code or the staff ----------------------------------------------------

/** How a written dictation trial may be answered (level 4 and beyond: the tune as degrees, in code, on the staff). */
export type DictationMode = "degrees" | "code" | "staff";
export const DICTATION_MODE_LABELS: Readonly<Record<DictationMode, string>> = {
  degrees: "Degrees",
  code: "Code",
  staff: "Staff",
};

/**
 * The answer modes a melodic dictation trial offers: from the code levels on (level 4, what X1 needs) the
 * learner may write the tune as degrees, as code, or on the staff; earlier levels keep their one surface.
 */
export function dictationModesOf(trial: Trial<unknown>, def: Pick<FamilyDef, "generator">): DictationMode[] {
  // Bass-line dictation (Wave 5): the roots on the degree pad, or the line written as code or on the bass staff.
  if (isBassTrial(trial) && bassLineTrialOf(trial as Trial) !== null) return ["degrees", "code", "staff"];
  if (def.generator !== "melody-dictation") return [];
  const ui = trial.params.ui;
  if (trial.params.mode !== "code" || (ui !== "code" && ui !== "staff-input")) return [];
  if (!Array.isArray((trial.expected as Answer).degrees))
    return ui === "code" ? ["code", "staff"] : ["staff", "code"];
  return ui === "staff-input" ? ["staff", "code", "degrees"] : ["code", "staff", "degrees"];
}

/** The surface of a dictation trial in the chosen mode (the trial's own one when the mode is not offered). */
export function dictationSurface(
  trial: Trial<unknown>,
  def: FamilyDef,
  mode: DictationMode,
  opts: { solfege?: "numbers" | "syllables" } = {},
): Surface {
  const modes = dictationModesOf(trial, def);
  if (!modes.includes(mode)) return surfaceOf(trial, def, opts);
  const line = isBassTrial(trial) ? bassLineTrialOf(trial as Trial) : null;
  if (line) {
    if (mode === "degrees") return surfaceOf(trial, def, opts);
    if (mode === "staff") return { kind: "widget", spec: staffSpecOf(line) };
    return { kind: "widget", spec: { ui: "code", starter: codeStarterOf(line) } };
  }
  if (mode === "staff") return { kind: "widget", spec: staffSpecOf(trial) };
  if (mode === "code") return { kind: "widget", spec: { ui: "code", starter: codeStarterOf(trial) } };
  const degrees = ((trial.expected as Answer).degrees ?? []) as Degree[];
  return {
    kind: "widget",
    spec: {
      ui: "degree-pad",
      set: degreeSetOf(trial, def),
      sequenceLen: degrees.length,
      syllables: opts.solfege === "syllables",
    },
  };
}

/**
 * Grades a trial with its family (`@oak/drills`), with one Wave 4 addition: a written dictation trial answered
 * as degrees (the tune's pitches in its own rhythm) is graded on the degrees, slot by slot, like the degree-pad
 * levels, since the code grader reads only code.
 */
export function gradeDrillTrial(
  family: DrillFamilyRuntime,
  trial: Trial,
  response: DrillResponse,
  profile: LearnerProfile,
): DrillTrialResult {
  // Wave 7: a two-lane take. The taps are split by hand (F, J) in the order of the trial's own `params.tapLanes` and
  // graded by the family together (`response.lanes`: @oak/pitch `gradeLaneTaps`), which forgives only the offset both
  // hands share; a hand that leans against the other is never forgiven (grading each lane alone would forgive it).
  const lanes = response.taps && !response.skipped ? tapLanesOf(trial) : null;
  if (lanes && response.taps) {
    const taps = response.taps;
    return gradeTrial(
      family,
      trial,
      {
        taps,
        lanes: lanes.map((l) => laneTaps(taps, response.tapVoices, l.voice)),
        rtMs: response.rtMs,
        replays: response.replays,
      },
      profile,
    ) as DrillTrialResult;
  }
  // Wave 5: a bass line written as code or on the staff (octave-free), and section labels (form by ear).
  const text = response.answer?.text?.[0];
  const line = text !== undefined && isBassTrial(trial) ? bassLineTrialOf(trial) : null;
  if (line && text !== undefined) {
    if (response.skipped) return skippedResult(response.rtMs, response.replays);
    return gradeBassLine(line, text, response.rtMs, response.replays);
  }
  if (Array.isArray((trial.expected as Answer).sections) && response.answer?.sections)
    return gradeSections(trial, response.answer, response.rtMs, response.replays);
  const degreesAnswer =
    trial.params.mode === "code" &&
    Array.isArray(response.answer?.degrees) &&
    Array.isArray((trial.expected as Answer).degrees);
  if (degreesAnswer) {
    const asPad = { ...trial, params: { ...trial.params, mode: "choice", ui: "degree-pad" } } as Trial;
    return gradeTrial(family, asPad, response, profile) as DrillTrialResult;
  }
  return gradeTrial(family, trial, response, profile) as DrillTrialResult;
}

/**
 * The editor's starting text of a code trial: the generator's own `starter`, else (melodic dictation in code)
 * an empty `n("")` already in the trial's key and octave, so the learner writes only the steps (degree − 1).
 */
export function codeStarterOf(trial: Trial<unknown>): string {
  const p = trial.params;
  if (typeof p.starter === "string") return p.starter;
  const ak = p.answerKey as { key?: KeySpec; octave?: number } | undefined;
  if (ak?.key && typeof ak.key.tonic === "string" && typeof ak.octave === "number")
    return `n("").scale("${ak.key.tonic}${ak.octave}:${ak.key.mode.replace(/ /g, ":")}").s("piano")`;
  return "";
}

const RN_ALLOW = ["triads", "sevenths", "inversions", "secondary", "borrowed"] as const;
type RnAllow = (typeof RN_ALLOW)[number];
/** The Roman-numeral palette a generator asks for (`params.rnAllow`), triads when it says nothing. */
function rnAllowOf(raw: unknown): RnAllow[] {
  const ok = Array.isArray(raw) ? raw.filter((x): x is RnAllow => RN_ALLOW.includes(x as RnAllow)) : [];
  return ok.length > 0 ? ok : ["triads"];
}

/**
 * The grader `Answer` of a widget value (code goes out as text: `@oak/drills` parses it with the mini model).
 * A typed answer with several parts ("Spell B major": B D♯ F♯) is split on spaces and commas when the trial
 * expects more than one part (`textParts`), since the grader compares parts by position.
 */
export function answerOf(
  spec: AnswerSpec,
  value: AnswerValue,
  textParts = 1,
  expected: Answer | null = null,
): Answer | null {
  switch (spec.ui) {
    case "choice":
      return { choice: value as string[] };
    case "bar-buttons": {
      // A bar is asked either as a number (which bar holds the inversion) or as a choice ID ("3").
      const bars = value as number[];
      if (bars.length === 0) return null;
      return expected?.number !== undefined ? { number: bars[0] as number } : { choice: bars.map(String) };
    }
    case "degree-pad":
      return { degrees: value as Degree[] };
    case "quality-pad":
      return { qualities: value as ChordQuality[] };
    case "rn-palette":
      return { rn: value as string[] };
    case "text": {
      const typed = (value as string).trim();
      return { text: textParts > 1 ? typed.split(/[\s,]+/).filter(Boolean) : [typed] };
    }
    case "code":
      return { text: [(value as string).trim()] };
    case "number":
      return value === null ? null : { number: value as number };
    case "keyboard":
      return { midi: value as number[] };
    case "form":
      return { sections: value as string[] };
    case "grid": {
      const rows = value as boolean[][];
      const one = rows.length === 1;
      return {
        choice: rows.flatMap((row, r) =>
          row.flatMap((on, c) => (on ? [one ? String(c) : `${spec.rows[r] ?? r}:${c}`] : [])),
        ),
      };
    }
    default:
      return null;
  }
}

/**
 * The grader answer of a trial's widget value: section labels of a form-by-ear trial become the family's own form
 * (`formAnswer`), every other value goes through `answerOf`. The runner and the tests share this one path.
 */
export function trialAnswerOf(trial: Trial<unknown>, spec: AnswerSpec, value: AnswerValue): Answer | null {
  const form = spec.ui === "form" ? formModeOf(trial) : null;
  if (form) return formAnswer(form, value as string[]);
  const expected = trial.expected as Answer;
  const answer = answerOf(spec, value, expected.text?.length ?? 1, expected);
  // Find the push: the grid's marked steps are the family's own cells ("c14").
  if (spec.ui === "grid" && clickCellsOf(trial)) return clickCellAnswer(answer?.choice ?? []);
  // A chromatic degree picked on its pad key is read as the asked spelling of that pitch (♭6 for ♯5).
  if (
    spec.ui === "degree-pad" &&
    trial.family === "fam.deg.fet-chromatic" &&
    answer?.degrees &&
    expected.degrees
  )
    return { degrees: padAnswer(answer.degrees, expected.degrees) };
  return answer;
}

/** The expected answer in the widget's value shape, for the "it was …" side of the feedback. */
export function expectedValueOf(spec: AnswerSpec, expected: Answer): AnswerValue | null {
  switch (spec.ui) {
    case "choice":
      return expected.choice ?? null;
    case "bar-buttons":
      return expected.number !== undefined
        ? [expected.number]
        : expected.choice
          ? expected.choice.map(Number).filter(Number.isFinite)
          : null;
    case "degree-pad": {
      if (!expected.degrees) return null;
      // The pad key of each expected degree: its own, or the key of the same pitch (♭6 where ♯5 was asked).
      return expected.degrees.map(
        (d) =>
          spec.set.find((k) => k === d) ??
          spec.set.find((k) => (degreeSemitones(k) - degreeSemitones(d)) % 12 === 0) ??
          d,
      );
    }
    case "quality-pad":
      return expected.qualities ?? null;
    case "rn-palette":
      return expected.rn ?? null;
    case "form": {
      if (expected.sections) return expected.sections;
      const letters = expected.choice?.[0] ? formIdLetters(expected.choice[0]) : null;
      return letters ? letters.split("") : null;
    }
    case "text":
      return expected.text ? expected.text.join(" ") : null;
    case "number":
      return expected.number ?? null;
    case "grid": {
      const cells = new Set((expected.choice ?? []).map((c) => c.replace(/^c/, "")));
      const n = spec.stepsPerBar * spec.bars;
      return [Array.from({ length: n }, (_, i) => cells.has(String(i)))];
    }
    default:
      return null;
  }
}

/**
 * The learner's own parts of a wrong answer, marked against the expected value, so the pick they made reads
 * "not this one" next to the outlined answer (ux §4.2 step 4). Degree pads mark by slot; choices by option ID.
 * Other widgets mark nothing (their revealed answer speaks for itself).
 */
export function wrongMarks(
  spec: AnswerSpec,
  value: AnswerValue | null,
  expected: AnswerValue | null,
): { part: number | string; ok: boolean }[] {
  if (!Array.isArray(value) || !Array.isArray(expected)) return [];
  if (spec.ui === "degree-pad") {
    return (value as unknown[]).map((v, i) => ({ part: i, ok: v === (expected as unknown[])[i] }));
  }
  if (spec.ui === "form") {
    return (value as unknown[]).map((v, i) => ({ part: i, ok: v === (expected as unknown[])[i] }));
  }
  if (spec.ui === "choice") {
    const want = new Set((expected as unknown[]).map(String));
    return (value as unknown[]).map((v) => ({ part: String(v), ok: want.has(String(v)) }));
  }
  return [];
}

/**
 * A short spoken form of the expected answer ("3 · mi", "Lower", "B D♯ F♯", "Dominant"). `generator` names a choice
 * by the family's own word when no answer spec gives its label (harmony function: "D" reads "Dominant").
 */
export function expectedText(
  spec: AnswerSpec | null,
  expected: Answer,
  solfege = false,
  generator?: string,
): string | null {
  if (spec?.ui === "bar-buttons") {
    const bars = expectedValueOf(spec, expected) as number[] | null;
    return bars && bars.length > 0 ? `bar ${bars.join(", ")}` : null;
  }
  if (spec?.ui === "form") {
    const letters = expectedValueOf(spec, expected) as string[] | null;
    return letters && letters.length > 0 ? letters.join(" ") : null;
  }
  if (expected.degrees)
    return expected.degrees
      .map((d) => (solfege ? `${optionLabel(d)} · ${syllableOf(d)}` : optionLabel(d)))
      .join(solfege ? ", " : " ");
  if (expected.choice && spec?.ui === "choice")
    return expected.choice
      .map((id) => spec.options.find((o) => o.id === id)?.label ?? optionLabel(id, generator))
      .join(", ");
  if (expected.choice) return expected.choice.map((id) => optionLabel(id, generator)).join(", ");
  if (expected.qualities) return expected.qualities.map((q) => qualityLabel(q).long).join(", ");
  if (expected.rn) return expected.rn.map(rnDisplay).join(" ");
  if (expected.text) return expected.text.map((t) => t.replace(/b/g, "♭").replace(/#/g, "♯")).join(" ");
  if (expected.number !== undefined) return String(expected.number);
  return null;
}

// --- results and wire records --------------------------------------------------------------------

export interface TrialOutcome {
  index: number;
  familyId: FamilyId;
  result: DrillTrialResult;
  /** The learner chose "Show me" before answering: credit 0, and the set counts as revealed (Again). */
  revealed: boolean;
  /** Sung part of the trial (a sing trial, or the sung resolution of an FET trial), never audio. */
  sung: SungSummary[] | null;
  /** Credit of a sung resolution; feeds `fam.deg.resolve`, never the identification credit. */
  resolutionCredit: number | null;
  /** The FET resolution as asked and taken (sung, skipped or, in Quiet mode, heard), or null when none was asked. */
  sungResolution?: SungResolution | null;
}

/** How a trial was taken (wave3.md §5.3): a sung part heard in Quiet mode is `quiet` (no voice evidence). */
export type Modality = NonNullable<DrillTrialRecord["modality"]>;

/** One `drill_trials` row (contracts §7.1: the trial is regenerable from seed and params). */
export function trialRecord(
  trial: Trial<unknown>,
  index: number,
  outcome: { result: TrialResult & { centsError?: number | null; skipped?: boolean }; answer: Answer | null },
  extra: {
    taps?: number[] | null;
    sung?: SungSummary[] | null;
    at: string;
    revealed?: boolean;
    modality?: Modality;
    sungResolution?: SungResolution | null;
  },
): DrillTrialRecord {
  const r = outcome.result;
  return {
    idx: index,
    familyId: trial.family,
    seed: trial.seed,
    level: trial.level,
    category: trial.category,
    params: JSON.parse(JSON.stringify(trial.params)) as Record<string, unknown>,
    response: {
      answer: outcome.answer,
      taps: extra.taps ?? null,
      sung: extra.sung ?? null,
      skipped: r.skipped === true,
    },
    credit: Math.max(0, Math.min(1, Number.isFinite(r.credit) ? r.credit : 0)),
    correct: r.correct,
    rtMs: Math.max(0, Math.round(r.rtMs)),
    replays: Math.max(0, Math.round(r.replays)),
    confusion: r.confusion ? [r.confusion[0], r.confusion[1]] : null,
    centsError: typeof r.centsError === "number" && Number.isFinite(r.centsError) ? r.centsError : null,
    at: extra.at,
    revealed: extra.revealed === true,
    modality: extra.modality ?? "normal",
    sungResolution: extra.sungResolution ?? null,
  };
}

/** One finished trial as the tutor reads it at the set summary (`debriefDrill`, tutor/context.ts). */
export interface DebriefTrial {
  n: number;
  asked?: string;
  answered: string;
  ok: boolean;
}

/**
 * The finished set for the tutor's debrief (contracts §10.4: the tutor opens only at the summary, so each trial may
 * now be named with its answer). `asked` is the answer the trial wanted; `answered` what the learner gave, or how
 * the trial was taken when nothing was picked (skipped, shown, sung, tapped).
 */
export function debriefTrials(
  trials: readonly (Trial<unknown> | undefined)[],
  records: readonly DrillTrialRecord[],
): DebriefTrial[] {
  return records.map((r) => {
    const trial = trials[r.idx];
    const gen = trial ? FAMILIES.find((f) => f.id === trial.family)?.generator : undefined;
    const want = trial ? expectedText(null, trial.expected as Answer, false, gen) : null;
    const given = r.response.answer ? expectedText(null, r.response.answer, false, gen) : null;
    const answered = r.revealed
      ? "nothing yet (I asked to be shown)"
      : r.response.skipped
        ? "nothing (skipped)"
        : given
          ? given
          : r.response.sung
            ? `by singing (${pctText(r.credit)} in tune)`
            : r.response.taps
              ? `by tapping (${pctText(r.credit)} on time)`
              : "nothing";
    return { n: r.idx + 1, ...(want ? { asked: `answer ${want}` } : {}), answered, ok: r.correct };
  });
}

/** The nearest rung of the tolerance ladder (contracts §8.2) for a tolerance in cents. */
export function ladderCents(cents: number): SingTolCents {
  const rungs: SingTolCents[] = [70, 50, 35, 25];
  return rungs.reduce((best, r) => (Math.abs(r - cents) < Math.abs(best - cents) ? r : best), 70);
}

/**
 * The wire form of an FET trial's resolution (`SungResolutionSchema`): sung (graded notes), skipped
 * (`Shift+S`), or heard in Quiet mode (self-report, no notes, no voice evidence). It never touches the
 * identification credit.
 */
export function sungResolutionOf(
  path: readonly Degree[],
  playFirst: boolean,
  taken:
    | { kind: "sung"; notes: SungSummary[]; credit: number; passed: boolean }
    | { kind: "skipped" }
    | { kind: "quiet" },
  tolCents: number,
): SungResolution | null {
  if (path.length === 0) return null;
  const base = {
    path: path.slice(0, 8) as Degree[],
    order: playFirst ? ("play-first" as const) : ("sing-first" as const),
    tolCents: ladderCents(tolCents),
  };
  if (taken.kind === "sung")
    return {
      ...base,
      notes: taken.notes.map((n) => ({ midi: n.midi, cents: n.cents, credit: n.credit })),
      credit: Math.max(0, Math.min(1, Number.isFinite(taken.credit) ? taken.credit : 0)),
      passed: taken.passed,
      skipped: false,
      quiet: false,
    };
  return {
    ...base,
    notes: [],
    credit: 0,
    passed: false,
    skipped: taken.kind === "skipped",
    quiet: taken.kind === "quiet",
  };
}

/** A revealed trial: no credit, never skipped (contracts §7.2: revealed → Again). */
export function revealedResult(rtMs: number, replays: number): DrillTrialResult {
  return { credit: 0, correct: false, rtMs, replays, diagnostics: [] };
}

/** A skipped sung part (`Shift+S`): logged, no evidence, no penalty. */
export function skippedResult(rtMs: number, replays: number): DrillTrialResult {
  return { credit: 0, correct: false, rtMs, replays, diagnostics: [], skipped: true };
}

// --- set planning ---------------------------------------------------------------------------------

export interface PlannedTrial {
  spec: TrialSpec;
  trial: Trial;
}

/**
 * The trials of one server-started set, generated in the browser from the session's seed material (same
 * setId → same trials, so a reload resumes the very same set). With `easyFirst` a trial one level down moves to
 * the front: the warm-up opens with an easy win.
 */
export function planDrillSet(
  family: DrillFamilyRuntime,
  session: Pick<DrillSession, "setId" | "levels" | "openCategories" | "trialsPlanned">,
  state: Pick<FamilyState, "categoryStats" | "blockedRemaining" | "sungStats"> | null,
  profile: LearnerProfile,
  opts: { easyFirst?: boolean; sungResolutions?: number; trials?: number } = {},
): { plan: SetPlan; trials: PlannedTrial[] } {
  const id = family.def.id;
  const open = session.openCategories[id] ?? [];
  // An FET set keeps its 2–3 resolutions in Quiet mode: they are heard instead of sung (contracts §8.5,
  // "sung resolutions: replaced by listening to the resolution"). FET trials themselves need no mic.
  const fet = family.def.generator === "degree-id";
  const plan = planSet(family, {
    family: id,
    setId: session.setId,
    level: session.levels[id] ?? 1,
    openCategories: open,
    categoryStats: state?.categoryStats ?? {},
    blockedRemaining: state?.blockedRemaining ?? 0,
    trials: opts.trials ?? session.trialsPlanned,
    sungResolutions: opts.sungResolutions ?? 2,
    // The trials that sing their way home cover the weakest sung degrees first (contracts §8.3): the server's
    // per-degree record of sung resolutions (wave4.md §5.6), else the identification stats.
    ...(state?.sungStats ? { sungStats: state.sungStats } : {}),
    quiet: profile.quiet && !fet,
  });
  if (opts.easyFirst) {
    const easy = plan.trials.findIndex((t) => t.level < plan.level);
    if (easy > 0) {
      const [t] = plan.trials.splice(easy, 1);
      plan.trials.unshift(t as TrialSpec);
    }
  }
  const trials = generateSet(family, plan, profile, open);
  return { plan, trials: plan.trials.map((spec, i) => ({ spec, trial: trials[i] as Trial })) };
}

// --- set summary ----------------------------------------------------------------------------------

export function pctText(x: number): string {
  return `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
}

/** The set's word for how it went: never a raw rating, never shaming (ux §4.1). */
export function setWord(meanCredit: number): string {
  if (meanCredit >= 0.9) return "strong";
  if (meanCredit >= 0.75) return "steady";
  if (meanCredit >= 0.6) return "getting there";
  return "worth another listen";
}

/** "Next review in about 3 days": relative words, never a count of cards. */
export function nextDueText(dueAt: string, now: Date = new Date()): string {
  const ms = new Date(dueAt).getTime() - now.getTime();
  const days = ms / 86_400_000;
  if (days < 0.5) return "Comes back later today";
  if (days < 1.5) return "Comes back tomorrow";
  if (days < 13.5) return `Comes back in about ${Math.round(days)} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `Comes back in about ${weeks} weeks`;
  return `Comes back in about ${Math.round(days / 30)} months`;
}

/** Calm level-change copy (ux §7.11: no blame, no hype). With the family, it says what the new level asks. */
export function levelChangeText(
  change: "promoted" | "demoted" | null,
  level: number,
  of: number,
  def?: Pick<FamilyDef, "levels"> & Partial<Pick<FamilyDef, "generator">>,
): string | null {
  const news = def ? levelNews(def, level) : null;
  if (change === "promoted")
    return news
      ? `Level ${level} of ${of} opens next time: ${news}.`
      : `Level ${level} of ${of} opens next time: a little more to tell apart.`;
  if (change === "demoted")
    return `Next time starts at level ${level} of ${of}. The ear settles faster there, then climbs again.`;
  return null;
}

/** Level knobs worth naming to the learner, in plain words. */
const LEVEL_KNOBS: readonly [string, string][] = [
  ["inversions", "chords in any inversion"],
  ["arpeggiate", "some chords broken into single notes"],
  ["full", "a full band with drums"],
  ["heard", "the chords heard in a loop"],
  ["minor", "minor keys too"],
  ["sevenths", "seventh chords"],
];

/** "Diminished" → "diminished"; numerals and symbols ("I–vi–IV–V", "PAC") keep their case. */
const lowerWord = (label: string): string =>
  /^[A-Z][a-z]/.test(label) ? label[0]?.toLowerCase() + label.slice(1) : label;

/** What a level adds over the one below ("Diminished joins the others"), or null when it adds nothing nameable. */
export function levelNews(
  def: Pick<FamilyDef, "levels"> & Partial<Pick<FamilyDef, "generator">>,
  level: number,
): string | null {
  const cur = def.levels[level - 1];
  if (!cur) return null;
  const prev = level > 1 ? def.levels[level - 2] : undefined;
  const added = cur.categories.filter((c) => !c.startsWith("ctx.") && !(prev?.categories ?? []).includes(c));
  const parts: string[] = [];
  if (added.length > 0)
    parts.push(
      `${added
        .map(
          (c) =>
            (def.generator
              ? (stageECategoryLabel(def.generator, c) ?? stageFCategoryLabel(def.generator, c))
              : null) ??
            CATEGORY_WORDS[c] ??
            lowerWord(optionLabel(c, def.generator, cur.categories)),
        )
        .join(", ")} join${added.length === 1 ? "s" : ""} in`,
    );
  for (const [knob, words] of LEVEL_KNOBS) if (cur[knob] === true && prev?.[knob] !== true) parts.push(words);
  return parts.length > 0 ? parts.join("; ") : null;
}

export interface SummaryView {
  title: string;
  accuracy: string;
  word: string;
  /** What moved: level, categories that improved, the confusion worth a listen. */
  moved: string[];
  /** When this family comes back (SRS), or the free-practice note. */
  next: string | null;
  /** The rating the grade map gives (shown only as a word), for tests and the dev tooltip. */
  rating: "Again" | "Hard" | "Good" | "Easy" | null;
}

const RATING_NAMES = ["Again", "Hard", "Good", "Easy"] as const;

/** Everything the set summary shows, from the local summary and the server's finish. */
export function summaryView(input: {
  def: FamilyDef;
  summary: SetSummary;
  outcomes: readonly TrialOutcome[];
  finish: DrillFinish | null;
  purpose: DrillSession["purpose"];
  cardLevel: number;
  before: Pick<FamilyState, "categoryStats"> | null;
  profile: Pick<LearnerProfile, "singTolCents">;
  now?: Date;
  /** The title of the composite a graduating family joins ("Mixed pitch"). */
  compositeTitle?: string;
}): SummaryView {
  const { def, summary, finish } = input;
  const answered = input.outcomes.filter((o) => o.result.skipped !== true);
  const hits = answered.filter((o) => o.result.correct).length;
  const revealed = input.outcomes.some((o) => o.revealed);
  const review: SrsReviewResult | undefined = finish?.reviews.find((r) => r.cardId === def.id);
  const moved: string[] = [];
  const level = review?.familyState?.level ?? input.cardLevel;
  const change = levelChangeText(review?.levelChange ?? null, level, def.levels.length, def);
  if (change) moved.push(change);
  // Categories that went up against their running accuracy.
  for (const [cat, s] of Object.entries(summary.perCategory)) {
    const prev = input.before?.categoryStats[cat];
    if (!prev || prev.n < 2 || s.n < 2) continue;
    const was = prev.hits / prev.n;
    const now = s.hits / s.n;
    if (now - was >= 0.15)
      moved.push(`${optionLabel(cat, def.generator)}: ${pctText(now)} today, up from ${pctText(was)}.`);
  }
  const top = Object.entries(summary.confusions).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const [expected, got] = top[0].split("|");
    const tip = def.confusionTips?.[top[0]];
    const ids = [expected ?? "", got ?? ""];
    moved.push(
      `${optionLabel(got ?? "", def.generator, ids)} when it was ${optionLabel(expected ?? "", def.generator, ids)}: ${top[1] === 1 ? "once" : `${top[1]} times`}${tip ? `. ${tip}` : "."}`,
    );
  }
  // Graduation into the composite is progress (contracts §7.4): said as such, never as a card that went away.
  if (review?.graduated && (review.familyState?.restingSince ?? null) === null)
    moved.unshift(graduationNews(def.title, input.compositeTitle ?? "mixed practice"));
  let next: string | null = null;
  if (review?.graduated) next = `Next heard in ${input.compositeTitle ?? "mixed practice"}.`;
  else if (review) next = nextDueText(review.dueAt, input.now);
  else if (input.purpose === "practice") next = "Free practice: your schedule stays as it is.";
  else if (input.purpose === "anchor") next = "A warm-up anchor: it counts as practice, not as a review.";
  const local = gradeFor({
    meanCredit: summary.meanCredit,
    medianRtMs: summary.medianRtMs,
    fastRtMs: def.fastRtMs,
    extraReplays: summary.extraReplays,
    hintRung: 0,
    revealed,
    atOrAboveLevel: summary.playedLevel >= input.cardLevel,
    ...(def.kind === "production" && def.mic === true && summary.meanAbsCents !== null
      ? { meanAbsCents: summary.meanAbsCents, tolCents: input.profile.singTolCents }
      : {}),
  });
  const rating = review?.rating ?? (answered.length > 0 ? RATING_NAMES[local - 1] : null) ?? null;
  return {
    title: def.title,
    accuracy: answered.length === 0 ? "No answers" : `${hits} of ${answered.length}`,
    word: answered.length === 0 ? "skipped" : setWord(summary.meanCredit),
    moved,
    next,
    rating,
  };
}

/** Summarizes the outcomes of a single-family set. */
export function summarize(
  plan: SetPlan,
  trials: readonly Trial<unknown>[],
  outcomes: readonly TrialOutcome[],
): SetSummary {
  return summarizeSet(
    plan,
    trials,
    outcomes.map((o) => o.result),
  );
}

// --- Practice hub ----------------------------------------------------------------------------------

/**
 * `resting`: a family that left its own card for mixed practice before its mastery level (decision 27: the
 * first-review bound makes room by letting the most stable family rest in its composite). It is still practised
 * there, keeps its level and comes back to its own card where it left off — never "mastered", never lost.
 */
export type FamilyStatus = "pending" | "locked" | "unlocked" | "resting" | "mastered";

/** The lesson unit of a lesson ID ("U04.L01" → "U04"). */
export const unitOf = (lessonId: string): string => lessonId.split(".")[0] ?? lessonId;

export { isResting, RESTING_LINE };

export function familyStatus(
  def: FamilyDef,
  state: FamilyState | undefined,
  completed: ReadonlySet<string>,
): FamilyStatus {
  if (isPendingGenerator(def.generator)) return "pending";
  if (!completed.has(def.unlock.lesson) && !state) return "locked";
  if (state && state.level >= def.masteryLevel) return "mastered";
  if (state && isResting(def, state)) return "resting";
  // Graduated below its mastery level (a gated ladder at its highest open level, contracts §7.4): it is in mixed
  // practice and comes back to its own sets when its next level opens — not mastered.
  if (state && state.graduatedAt !== null) return "resting";
  return "unlocked";
}

/**
 * Where a graduated or resting family is practised now (contracts §7.4: two trials whenever its composite is
 * drawn, recalled to its own sets below 0.65), with how many families share that mixed review. Null for a family
 * still on its own card.
 */
export function compositeLine(
  state: FamilyState | undefined,
  states: ReadonlyMap<string, FamilyState>,
  defs: ReadonlyMap<string, Pick<FamilyDef, "title">>,
): string | null {
  if (!state || state.graduatedAt === null || !state.compositeId) return null;
  const title = defs.get(state.compositeId)?.title ?? "mixed practice";
  const members = [...states.values()].filter(
    (s) => s.compositeId === state.compositeId && s.graduatedAt !== null,
  ).length;
  const others = Math.max(0, members - 1);
  const company = others === 0 ? "" : ` with ${others} other ${others === 1 ? "family" : "families"}`;
  return `In ${title}${company}: two trials whenever it comes up, and its own sets come back if it needs them.`;
}

export interface CompositeProgress {
  id: string;
  title: string;
  /** Titles of the families that graduated into it, in catalog order. */
  members: string[];
  line: string;
}

const listWords = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * Mixed practice as progress (contracts §7.4): each composite with the families that have graduated into it. A
 * family that moves there has not gone away; the composite has grown. Composites with no member yet are left out.
 */
export function compositesProgress(
  defs: readonly FamilyDef[],
  states: ReadonlyMap<string, FamilyState>,
): CompositeProgress[] {
  return defs
    .filter((d) => isCompositeGenerator(d.generator))
    .map((c) => {
      const members = defs
        .filter((d) => {
          const st = states.get(d.id);
          return st !== undefined && st.compositeId === c.id && st.graduatedAt !== null;
        })
        .map((d) => d.title);
      const n = members.length;
      // A long list names its first four and counts the rest: the card says how much it holds, not every title.
      const list = n > 5 ? `${members.slice(0, 4).join(", ")} and ${n - 4} more` : listWords(members);
      return {
        id: c.id,
        title: c.title,
        members,
        // A title that ends the list with its own "?" or "!" ends the sentence too: never "Higher or lower?.".
        line: `${n === 1 ? "One family lives" : `${n} families live`} here now: ${list}${
          /[.?!]$/.test(list) ? "" : "."
        } Each comes up two trials at a time, at the level you reached.`,
      };
    })
    .filter((c) => c.members.length > 0);
}

/** Composite reviews are not practised by hand: they appear only through the warm-up. */
export const isCompositeFamily = (def: FamilyDef): boolean => isCompositeGenerator(def.generator);

export type StageKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
export const STAGE_TITLES: Record<StageKey | "concepts", { title: string; sub: string }> = {
  A: {
    title: "Stage A · Pulse and pitch",
    sub: "Feel the beat, match a note, hear higher and lower, find home.",
  },
  B: {
    title: "Stage B · Degrees in major",
    sub: "Hear each note's pull against the key, then sing it home.",
  },
  C: { title: "Stage C · Intervals and melody", sub: "Two notes in a key, short tunes by ear and voice." },
  D: {
    title: "Stage D · Chords and progressions",
    sub: "Chord colours, bass lines, cadences and common loops.",
  },
  E: {
    title: "Stage E · Minor, sevenths and the blues",
    sub: "Degrees in minor, which minor, bass lines, sevenths, sections and the twelve bars.",
  },
  F: {
    title: "Stage F · Chromatic colour",
    sub: "Notes and chords from outside the key, and the moment home itself moves.",
  },
  G: { title: "Stage G · Jazz harmony", sub: "ii–V–I, guide tones, extensions, substitutions." },
  H: {
    title: "Stage H · Groove and feel",
    sub: "Pushes, triplets and the beat in three, swing, clave and odd groupings.",
  },
  concepts: { title: "Reading and facts", sub: "Counting, reading rhythm and notes, spelling, keys." },
};

export interface StageGroup {
  key: StageKey | "concepts";
  title: string;
  sub: string;
  families: FamilyDef[];
}

/**
 * Ear families the stage table of contracts §7.3 does not list but that are heard with their stage: chord
 * dictation and "home, away, tension" with the stage D chord work, non-chord tones with melody (stage C).
 * They follow the stage's own families.
 */
export const HUB_STAGE_EXTRAS: Readonly<Record<string, StageKey>> = {
  "fam.har.function": "D",
  "fam.har.progression": "D",
  "fam.mel.nct": "C",
  // Wave 5: form by ear and the bass locked with the kick are heard with stage E (wave5.md §11).
  "fam.frm.sections": "E",
  "fam.rhy.groove-lock": "E",
  // Wave 6: intervals by name arrive with the sevenths (U12.L06); the hats' division is heard with the groove.
  "fam.int.isolated": "E",
  "fam.rhy.subdivision": "H",
};

/** Families grouped by ear-training stage (contracts §7.3), concept families after them. */
export function groupByStage(
  defs: readonly FamilyDef[],
  stages: Readonly<Record<StageKey, readonly string[]>>,
): StageGroup[] {
  const stageOf = new Map<string, StageKey>();
  for (const [k, ids] of Object.entries(stages) as [StageKey, readonly string[]][])
    for (const id of ids) stageOf.set(id, k);
  for (const [id, k] of Object.entries(HUB_STAGE_EXTRAS)) if (!stageOf.has(id)) stageOf.set(id, k);
  const groups = new Map<StageKey | "concepts", FamilyDef[]>();
  for (const d of defs) {
    if (isCompositeFamily(d)) continue;
    const k = stageOf.get(d.id) ?? "concepts";
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  const order: (StageKey | "concepts")[] = ["A", "B", "C", "D", "E", "F", "G", "H", "concepts"];
  return order
    .filter((k) => (groups.get(k)?.length ?? 0) > 0)
    .map((k) => {
      const fams = groups.get(k) as FamilyDef[];
      const ids = k === "concepts" ? [] : (stages[k] ?? []);
      // The stage's own families in the table's order, then the extras.
      const rank = (id: string) => (ids.includes(id) ? ids.indexOf(id) : ids.length + 1);
      fams.sort((a, b) => rank(a.id) - rank(b.id));
      return { key: k, ...STAGE_TITLES[k], families: fams };
    });
}

/** "Recall 92%" for a card, or null when the family has no card yet. */
export function recallOf(card: SrsCard | undefined): number | null {
  return card ? card.retrievability : null;
}

/** Overall running accuracy of a family's categories (hits are credits). */
export function familyAccuracy(state: FamilyState | undefined): { n: number; acc: number | null } {
  const stats = Object.values(state?.categoryStats ?? {});
  const n = stats.reduce((a, s) => a + s.n, 0);
  const hits = stats.reduce((a, s) => a + s.hits, 0);
  return { n, acc: n === 0 ? null : hits / n };
}

const titleMaps = new WeakMap<object, { lessons: Map<string, string>; units: Map<string, string> }>();
/** Lesson and unit titles of the loaded content (by ID), built once per content bundle. */
export function titlesOf(data: { content: { syllabus: SyllabusDef | null } }): {
  lessons: ReadonlyMap<string, string>;
  units: ReadonlyMap<string, string>;
} {
  const own = titleMaps.get(data.content);
  if (own) return own;
  const lessons = new Map<string, string>();
  const units = new Map<string, string>();
  for (const u of data.content.syllabus?.units ?? []) {
    units.set(u.id, u.title);
    for (const l of u.lessons) lessons.set(l.id, l.title);
  }
  const made = { lessons, units };
  titleMaps.set(data.content, made);
  return made;
}

/**
 * A unit as the learner reads it: "unit 3, Major Scale & Degrees" for a core unit (a comma, as titles carry their
 * own parentheses: "Intervals (compressed)"), else its title. `titles` maps unit ID to
 * title (the syllabus); an ID with no title is said as "this unit", never as the ID.
 */
export function unitPhrase(id: string, titles: ReadonlyMap<string, string>): string {
  const title = titles.get(id);
  const core = /^U(\d+)$/.exec(id);
  if (core) return title ? `unit ${Number(core[1])}, ${title}` : `unit ${Number(core[1])}`;
  return title ?? "this unit";
}

/**
 * A lesson as the learner reads it: its title in quotes ("“Degrees in Code”"), with its track when it belongs to
 * an advanced one. Without a title (content still loading) the ID stands in.
 */
export function lessonPhrase(id: string, titles?: ReadonlyMap<string, string>): string {
  const title = titles?.get(id);
  if (!title) return lessonWithTrack(id);
  const track = lessonWithTrack(id).slice(id.length);
  return `“${title}”${track}`;
}

/**
 * A family's level, honestly: where it is, of how many, and how far the lessons done so far let it go
 * ("Level 2 of 7 · up to level 3 for now"). Never a count of due cards.
 */
export function levelLine(
  def: FamilyDef,
  state: FamilyState | undefined,
  titles?: ReadonlyMap<string, string>,
): string {
  const total = def.levels.length;
  // Never above the highest level the lessons have opened (a graduated family can carry a level its gate has
  // not opened yet: it is shown at the open one, with the lesson that opens the next).
  const level = honestLevel(state, total);
  const open = Math.max(level, Math.min(total, state?.maxOpenLevel ?? 1));
  const head = `Level ${level} of ${total}`;
  if (total === 1 || level >= total) return head;
  // Every level is open (a graduated family can sit below them in mixed practice): say so, never "for now".
  if (open >= total) return `${head} · every level open`;
  if (open > level) return `${head} · up to level ${open} for now`;
  // At the highest open level: say which lesson opens the next one.
  const lesson = nextLevelLesson(def, open + 1);
  // A level that opens with a lesson of an advanced track says which track (Wave 7): "R1.L02 (Advanced Rhythm)".
  return lesson
    ? `${head} · level ${open + 1} opens with ${lessonPhrase(lesson, titles)}`
    : `${head} · up to level ${open} for now`;
}

/** The lesson that opens level `n`: its gate, else the latest lesson among the categories it adds. */
export function nextLevelLesson(def: FamilyDef, n: number): string | null {
  const gate = def.unlock.levelGates?.[n];
  if (gate) return Array.isArray(gate) ? (gate[0] ?? null) : gate;
  const cur = def.levels[n - 1]?.categories ?? [];
  const prev = def.levels[n - 2]?.categories ?? [];
  const lessons = cur
    .filter((c) => !prev.includes(c))
    .map((c) => def.categories.find((x) => x.id === c)?.unlockAt)
    .filter((l): l is NonNullable<typeof l> => typeof l === "string")
    .sort();
  const last = lessons.at(-1);
  return last && last !== def.unlock.lesson ? last : null;
}

/** The status line of a pending family: honest about when its drills arrive. */
export function pendingText(def: FamilyDef, completed: ReadonlySet<string>): string {
  const unit = unitOf(def.unlock.lesson);
  return completed.has(def.unlock.lesson)
    ? "Its drills are not built yet; the lessons keep teaching it."
    : `Arrives with ${unit}`;
}

// --- tap display ------------------------------------------------------------------------------------

/**
 * A plain account of a tap take for the pad (display only; the grade comes from `@oak/pitch` `gradeTaps`):
 * each target matched to the nearest unused tap within 150 ms, and the mean signed offset of the matches.
 */
export function tapReport(
  taps: readonly number[],
  targets: readonly number[],
): { matched: number; meanOffsetMs: number | null; text: string } {
  const used = new Set<number>();
  const offsets: number[] = [];
  for (const t of targets) {
    let best = -1;
    let bestD = 0.15;
    taps.forEach((tap, i) => {
      const d = Math.abs(tap - t);
      if (!used.has(i) && d <= bestD) {
        best = i;
        bestD = d;
      }
    });
    if (best >= 0) {
      used.add(best);
      offsets.push(((taps[best] as number) - t) * 1000);
    }
  }
  const mean = offsets.length === 0 ? null : offsets.reduce((a, b) => a + b, 0) / offsets.length;
  const extra = taps.length - used.size;
  let text =
    taps.length === 0 ? "No taps reached the pad." : `${offsets.length} of ${targets.length} hits matched`;
  if (taps.length > 0 && mean !== null && Math.abs(mean) >= 15)
    text += `, about ${Math.round(Math.abs(mean))} ms ${mean > 0 ? "late" : "early"} on average`;
  if (taps.length > 0 && extra > 0) text += `, ${extra} extra ${extra === 1 ? "tap" : "taps"}`;
  return { matched: offsets.length, meanOffsetMs: mean, text: taps.length > 0 ? `${text}.` : text };
}
