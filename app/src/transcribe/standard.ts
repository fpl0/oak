// Ladder L8 and CF-T (contracts §2.9, §6.6 CF-T; content/specs/CF.md; wave6.md §5.4): a full arrangement of a
// public-domain standard, taken down in four stages that open in order — the form map (correct), the bass (0.90),
// the changes (0.85 of the bars, at seventh depth), the melody (0.90) — the three code stages one section at a
// time. What the learner is given (never the form), the stage strip, each section's state, the draft skeleton
// written from a passed form map (one const per distinct section and track, one arrange() per track), the chord
// chart of one section in that code, and a check's verdict. Pure, so every rule is unit-tested; the capstone's
// CF-T workspace uses the same pieces.
import type { LadderSubmitResult } from "@oak/api";
import type { KeySpec } from "@oak/content-kit";
import { scaleName } from "@oak/pitch";
import { METERS, tempoLine } from "@oak/theory";
import { type FormMap, type FormSection, formComment, normalizeFormMap, sectionsOf } from "./form-map.ts";
import { checkLines, keyMismatchText } from "./ladder.ts";
import { keyText, pickupChip, pickupText, type SongGiven, type SpanStatus, songTitleText } from "./song.ts";

export const STANDARD_STAGES = ["form", "bass", "changes", "melody"] as const;
export type StandardStage = (typeof STANDARD_STAGES)[number];
export type StandardCodeStage = Exclude<StandardStage, "form">;
export const STANDARD_CODE_STAGES: readonly StandardCodeStage[] = ["bass", "changes", "melody"];

export const isStandardLevel = (level: number | null | undefined): level is 8 => level === 8;

/** Pass marks (contracts §6.6 CF-T; `STANDARD_LADDER_PASS` of @oak/grader, pinned equal in the test). */
export const STANDARD_PASS: Readonly<Record<StandardStage, number>> = {
  form: 1,
  bass: 0.9,
  changes: 0.85,
  melody: 0.9,
};

export const STANDARD_STAGE_LABEL: Record<StandardStage, string> = {
  form: "Form",
  bass: "Bass",
  changes: "Changes",
  melody: "Melody",
};
export const STANDARD_STAGE_TASK: Record<StandardStage, string> = {
  form: "Hear the whole tune. Cut the bars where a new section starts and name each section: the same letter for music that comes back.",
  bass: "The bass of one section at a time: two notes a bar, the root first. Write each different section once.",
  changes:
    "Each bar's chord over the bass you found, with its quality: a plain triad where the song plays a seventh chord does not count. Listen for a dominant 7th that leans on the next chord.",
  melody: "The tune, one section at a time, as scale degrees. Ties, dots and triplets are all allowed.",
};
/** The mark as a learner reads it: the form is right or not; the others are a share. */
export const passMarkText = (stage: StandardStage): string =>
  stage === "form" ? "every section right" : `≥ ${Math.round(STANDARD_PASS[stage] * 100)}%`;

// --- stages and sections ---------------------------------------------------------------------------------

export type StandardStageMarks = Partial<Record<StandardStage, "passed" | "revealed">>;

export interface SectionProgress {
  /** 1-based sections with a pass. */
  passed: number[];
  /** 1-based sections shown on request (no graded pass). */
  revealed: number[];
}

export interface StandardMarks {
  stages: StandardStageMarks;
  sections: Record<StandardCodeStage, SectionProgress>;
  /** The form map that passed (or was shown): the sections every later stage is worked in. */
  form: FormMap | null;
}
export const EMPTY_STANDARD_MARKS: StandardMarks = {
  stages: {},
  sections: {
    bass: { passed: [], revealed: [] },
    changes: { passed: [], revealed: [] },
    melody: { passed: [], revealed: [] },
  },
  form: null,
};

/** Each stage opens after the one before passed or was shown: form → bass → changes → melody. */
export function standardStageStates(
  marks: StandardStageMarks,
): { stage: StandardStage; status: SpanStatus }[] {
  const cur = currentStandardStage(marks);
  return STANDARD_STAGES.map((stage) => ({
    stage,
    status: marks[stage] ?? (stage === cur ? "open" : "locked"),
  }));
}
export const currentStandardStage = (marks: StandardStageMarks): StandardStage | null =>
  STANDARD_STAGES.find((s) => marks[s] === undefined) ?? null;

/** The server's passed stages (`LadderSong.passedStages`) merged with this browser's marks. */
export function mergeStandardStages(
  passed: readonly string[],
  local: StandardStageMarks,
): StandardStageMarks {
  const out: StandardStageMarks = { ...local };
  for (const s of passed)
    if ((STANDARD_STAGES as readonly string[]).includes(s)) out[s as StandardStage] = "passed";
  return out;
}

const uniq = (xs: readonly number[]) => [...new Set(xs)].sort((a, b) => a - b);

/** A section of a code stage passed (or was shown); the stage is done once every section is. */
export function markSection(
  marks: StandardMarks,
  stage: StandardCodeStage,
  section: number,
  how: "passed" | "revealed",
  count: number,
): StandardMarks {
  const cur = marks.sections[stage];
  const next: SectionProgress =
    how === "passed"
      ? { passed: uniq([...cur.passed, section]), revealed: cur.revealed.filter((n) => n !== section) }
      : { passed: cur.passed, revealed: uniq([...cur.revealed, section]) };
  const all = Array.from({ length: count }, (_, i) => i + 1).every(
    (n) => next.passed.includes(n) || next.revealed.includes(n),
  );
  const stageMark: "passed" | "revealed" | undefined = all
    ? next.revealed.length > 0
      ? "revealed"
      : "passed"
    : undefined;
  return {
    ...marks,
    sections: { ...marks.sections, [stage]: next },
    stages: stageMark ? { ...marks.stages, [stage]: stageMark } : marks.stages,
  };
}

/** A song is a graded pass when all four stages passed and nothing was shown (CF.md "Level-up"). */
export const standardGraded = (marks: StandardStageMarks): boolean =>
  STANDARD_STAGES.every((s) => marks[s] === "passed");

/**
 * The sections the code stages are worked in: the learner's own map once it passed; when the form was shown, or
 * passed on another device, the song's phrases as the server lists them (named by number until a map is known).
 */
export function workSections(
  form: FormMap | null,
  phrases: readonly (readonly [number, number])[] | null,
  bars: number,
): FormSection[] {
  if (form) return sectionsOf(form);
  const spans =
    phrases && phrases.length > 0
      ? phrases
      : Array.from(
          { length: Math.ceil(bars / 8) },
          (_, i) => [i * 8 + 1, Math.min(bars, i * 8 + 8)] as const,
        );
  return spans.map((p, index) => ({
    index,
    label: "",
    from: p[0],
    to: p[1],
    bars: p[1] - p[0] + 1,
  }));
}

/** A pool song's progress in words: phrases at L5, three stages at L6, four at L8 with the one that is next. */
export function songProgress(song: {
  level: number;
  passedPhrases: readonly number[];
  phrases: readonly unknown[];
  passedStages: readonly string[];
}): string {
  if (song.level === 5) return `${song.passedPhrases.length} of ${song.phrases.length} phrases`;
  if (song.level === 8) {
    const done = STANDARD_STAGES.filter((s) => song.passedStages.includes(s));
    const next = STANDARD_STAGES.find((s) => !song.passedStages.includes(s));
    return `${done.length} of 4 stages${next && done.length > 0 ? ` · next: the ${STANDARD_STAGE_LABEL[next].toLowerCase()}` : ""}`;
  }
  return `${song.passedStages.filter((s) => s !== "form").length} of 3 stages`;
}

/**
 * A map from the server's phrases (1-based inclusive bars) and, when the form is known as letters ("AABA", one per
 * phrase), its names: what the strip shows after a form that was shown, or passed on another device. `null`
 * without phrases.
 */
export function formMapOfPhrases(
  phrases: readonly (readonly [number, number])[] | null,
  bars: number,
  letters: string | null,
): FormMap | null {
  if (!phrases || phrases.length === 0) return null;
  const named = letters && /^[A-H]+$/.test(letters) && letters.length === phrases.length ? letters : null;
  return normalizeFormMap({
    bars,
    cuts: phrases.map((p) => Math.max(1, p[0])),
    labels: phrases.map((_, i) => named?.[i] ?? ""),
  });
}

// --- what is given ------------------------------------------------------------------------------------

/** The givens of a standard as chips: tempo, meter, key and home, pickup, feel, length. Never the form. */
export function standardGivenChips(g: SongGiven): string[] {
  return [
    `${Math.round(g.bpm)} BPM`,
    g.meter,
    keyText(g.key),
    pickupChip(g),
    ...(g.swing ? ["Swing 8ths"] : []),
    `One chorus, ${g.bars} bars`,
  ];
}

// --- the code ---------------------------------------------------------------------------------------------

/** The labels of STYLE §2 (`mel` is the lead line), which are also the roles the section consts are named for. */
const TRACKS = ["bass", "chords", "mel"] as const;
type StandardTrack = (typeof TRACKS)[number];
const TRACK_OF_STAGE: Record<StandardCodeStage, StandardTrack> = {
  bass: "bass",
  changes: "chords",
  melody: "mel",
};

const head = (g: SongGiven): string =>
  [
    tempoLine(Math.round(g.bpm), g.meter),
    `// ${songTitleText(g)} · ${keyText(g.key)} · ${g.meter}`,
    `// ${pickupText(g)}.${g.swing ? " Swing 8ths: write straight eighths; the check straightens the swing." : ""}`,
  ].join("\n");

/** The code a standard opens with: the givens and nothing to fill in yet (the draft is written from the map). */
export function standardStarter(g: SongGiven): string {
  return `${head(g)}\n// First the form: cut the bar strip above into sections and name them.\n// When the map is right, Oak writes one line per section here.\n`;
}

/**
 * Code with nothing in it yet: only the tempo line and comments (the starter, whatever its header says). A passed
 * map writes the skeleton over such a draft, and never over anything the learner wrote.
 */
export function isBareDraft(code: string): boolean {
  return code
    .split("\n")
    .map((l) => l.trim())
    .every((l) => l === "" || l.startsWith("//") || /^setcp[ms]\(.*\)$/.test(l));
}

/**
 * The const suffix of a section label (STYLE §10: `<role><Section>`): a letter keeps its capital (`A`, `A2`), a
 * word is capitalised (`Bridge`, `Chorus2`); anything else falls back to `S<n>`.
 */
export function sectionSuffix(label: string, index: number): string {
  const t = label.trim();
  if (/^[A-Za-z]\d?$/.test(t)) return t.toUpperCase();
  const word = t.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/^[a-z][a-z]*\d?$/.test(word)) return word.charAt(0).toUpperCase() + word.slice(1);
  return `S${index + 1}`;
}
export const sectionConst = (stage: StandardCodeStage, label: string, index: number): string =>
  `${TRACK_OF_STAGE[stage]}${sectionSuffix(label, index)}`;

const angle = (cells: readonly string[]) =>
  cells.length === 1 ? (cells[0] as string) : `<${cells.join(" ")}>`;

/**
 * The draft skeleton of a mapped tune (CF.md "When it passes"): one const per distinct section and track, and one
 * `arrange()` per track with the sections in order, so a section that comes back is written once. A pickup bar is
 * its own one-bar section (`melPickup`; bass and chords rest in it).
 */
export function skeletonOfForm(g: SongGiven, m: FormMap): string {
  const key: KeySpec = g.key ?? { tonic: "C", mode: "major" };
  const sections = sectionsOf(m);
  const distinct = new Map<string, FormSection>();
  for (const s of sections) {
    const k = sectionSuffix(s.label, s.index);
    if (!distinct.has(k)) distinct.set(k, s);
  }
  const consts: string[] = [];
  for (const [suffix, s] of distinct) {
    const bars = Array.from({ length: s.bars }, () => "0");
    const rests = Array.from({ length: s.bars }, () => "~");
    consts.push(
      `// ${suffix}: ${s.bars} bars (first heard at bar ${s.from})`,
      `const bass${suffix} = n("${angle(bars)}").scale("${scaleName(key, 2)}").s("ebass")`,
      `const chords${suffix} = note("${angle(rests)}")`,
      `const mel${suffix} = n("${angle(rests)}").scale("${scaleName(key, 4)}").s("piano")`,
      "",
    );
  }
  const pickup = g.pickupBeats !== null;
  if (pickup) {
    const units = METERS[g.meter]?.unitsPerBar ?? 4;
    const lead = Math.max(0, Math.round(units - (g.pickupBeats ?? 0)));
    const tail = Math.max(1, Math.round(g.pickupBeats ?? 1));
    const cell = `[${[...Array(lead).fill("~"), ...Array(tail).fill("0")].join(" ")}]`;
    consts.push(
      "// The pickup: the notes before bar 1",
      `const melPickup = n("${cell}").scale("${scaleName(key, 4)}").s("piano")`,
      "",
    );
  }
  const arrange = (track: StandardTrack) => {
    const parts = sections.map((s) => `[${s.bars}, ${track}${sectionSuffix(s.label, s.index)}]`);
    if (pickup) parts.unshift(`[1, ${track === "mel" ? "melPickup" : "silence"}]`);
    return `${track}: arrange(${parts.join(", ")})`;
  };
  return `${head(g)}\n${formComment(m)}\n\n${consts.join("\n")}\n${TRACKS.map(arrange).join("\n")}\n`;
}

/** Whether the code already has the skeleton's lines for this map (so a passed map never overwrites work). */
export function hasSkeleton(code: string, m: FormMap): boolean {
  const s = sectionsOf(m)[0];
  if (!s) return false;
  return new RegExp(`^\\s*const\\s+bass${sectionSuffix(s.label, s.index)}\\s*=`, "m").test(code);
}

const constLine = (name: string) => new RegExp(`^(\\s*const\\s+${name}\\s*=\\s*)(.*)$`, "m");

/**
 * One section's chart in the code: the symbols of `const chordsA = chord("<…>")`, one entry per bar (`""` a rest,
 * two chords in a bar as `"C7 F7"` from `[C7 F7]`); `null` when the const is missing or is not a plain chord line.
 */
export function changesOfSection(code: string, name: string, bars: number): string[] | null {
  const m = constLine(name).exec(code);
  if (!m) return null;
  const body = m[2] as string;
  const c = /^chord\(\s*"<?\s*([^">]*?)\s*>?"\s*\)/.exec(body);
  // The skeleton's empty line (`note("<~ ~ …>")`) is an empty chart.
  if (!c) return /^note\(\s*"<?[\s~]*>?"\s*\)/.test(body) ? Array(bars).fill("") : null;
  const cells = (c[1] as string).match(/\[[^\]]*\]|\S+/g) ?? [];
  if (cells.some((x) => /[{}(),*/@!_<>]/.test(x))) return null;
  return Array.from({ length: bars }, (_, i) => {
    const cell = cells[i] ?? "";
    const inner = cell.replace(/^\[|\]$/g, "").trim();
    return inner === "~"
      ? ""
      : inner
          .split(/\s+/)
          .filter((x) => x !== "~")
          .join(" ");
  });
}

/** The code with one section's chords const written from its chart; a bar with two symbols becomes `[C7 F7]`. */
export function withSectionChanges(code: string, name: string, chart: readonly string[]): string {
  const cells = chart.map((raw) => {
    const syms = raw.trim().split(/\s+/).filter(Boolean);
    return syms.length === 0 ? "~" : syms.length === 1 ? (syms[0] as string) : `[${syms.join(" ")}]`;
  });
  const line = cells.every((c) => c === "~")
    ? `note("${angle(cells)}")`
    : `chord("${angle(cells)}").voicing().s("piano").gain(.6)`;
  const re = constLine(name);
  if (re.test(code)) return code.replace(re, (_, lead: string) => `${lead}${line}`);
  return `const ${name} = ${line}\n${code}`;
}

/**
 * Gives section `index` its own copy of every track (a repeat that ends differently): `A` becomes `A2` (the next
 * free digit), its consts are copies of the originals placed after them, and the section's entry in each
 * `arrange()` points at the copy. Returns the new map and code; unchanged when the section is the only one with
 * its name.
 */
export function splitSection(code: string, m: FormMap, index: number): { code: string; map: FormMap } {
  const sections = sectionsOf(m);
  const s = sections[index];
  if (!s) return { code, map: m };
  const suffix = sectionSuffix(s.label, s.index);
  const same = sections.filter((x) => sectionSuffix(x.label, x.index) === suffix);
  if (same.length < 2) return { code, map: m };
  const base = suffix.replace(/\d+$/, "");
  const used = new Set(sections.map((x) => sectionSuffix(x.label, x.index)));
  let k = 2;
  while (used.has(`${base}${k}`)) k++;
  const next = `${base}${k}`;
  let out = code;
  for (const track of TRACKS) {
    const re = constLine(`${track}${suffix}`);
    const hit = re.exec(out);
    if (hit) out = out.replace(re, `${hit[0]}\nconst ${track}${next} = ${hit[2]}`);
    // The section's own entry in this track's arrange(): the (occurrence)-th `[n, trackSuffix]`.
    const occurrence = same.findIndex((x) => x.index === index);
    let seen = -1;
    out = out.replace(new RegExp(`(\\[\\s*\\d+\\s*,\\s*)${track}${suffix}(\\s*\\])`, "g"), (all, a, b) => {
      seen++;
      return seen === occurrence ? `${a}${track}${next}${b}` : all;
    });
  }
  const label = /^[A-Z]\d?$/.test(suffix) ? next : next.toLowerCase();
  return { code: out, map: { ...m, labels: m.labels.map((l, i) => (i === index ? label : l)) } };
}

// --- a check ------------------------------------------------------------------------------------------

export interface StandardCheckTarget {
  stage: StandardStage;
  /** Code stages: the 1-based section checked. */
  section: number | null;
  /** The section's label, when the learner's map is known ("A", "bridge"). */
  label: string | null;
}

const pct = (x: number) => Math.round(x * 100);

/** What a check answered, in words: "The form", "Bass, section 2 (A)", "Melody, section 3 (B)". */
export function standardTargetText(t: StandardCheckTarget): string {
  if (t.stage === "form") return "The form";
  const what = STANDARD_STAGE_LABEL[t.stage];
  if (t.section === null) return `The ${what.toLowerCase()}`;
  return `${what}, section ${t.section}${t.label ? ` (${t.label})` : ""}`;
}

/**
 * One calm sentence for a code-stage check (ux §7.11): what it answered, the score against its mark, and where it
 * differs. The per-bar lines follow it (`checkLines`).
 */
export function standardVerdict(
  r: Pick<LadderSubmitResult, "passed" | "result">,
  t: StandardCheckTarget,
): string {
  const what = standardTargetText(t);
  if (r.result.status === "error") return `${what}: that code didn't run, so nothing was checked.`;
  if (r.passed) return `${what}: that's it (${pct(r.result.score)}%).`;
  const key = keyMismatchText(r.result);
  if (key) return `${what}: not yet. ${key} Write it in the recording's key.`;
  const bars = [...new Set(checkLines(r.result).flatMap((l) => (l.bar === null ? [] : [l.bar])))];
  const where =
    bars.length === 0
      ? ""
      : bars.length === 1
        ? ` Bar ${bars[0]} differs.`
        : ` Bars ${bars.slice(0, -1).join(", ")} and ${bars.at(-1)} differ.`;
  return `${what}: not yet, ${pct(r.result.score)}% right; ${pct(STANDARD_PASS[t.stage])}% passes.${where} Loop the section and listen again.`;
}

// --- kept between visits --------------------------------------------------------------------------------

const KEY = (id: string) => `oak.transcribe.standard.${id}`;
export function readStandardMarks(id: string): StandardMarks {
  try {
    const raw = localStorage.getItem(KEY(id));
    if (raw) {
      const m = JSON.parse(raw) as Partial<StandardMarks>;
      return {
        stages: m.stages ?? {},
        sections: { ...EMPTY_STANDARD_MARKS.sections, ...(m.sections ?? {}) },
        form: m.form ?? null,
      };
    }
  } catch {
    // storage blocked: the server's passed stages still show
  }
  return EMPTY_STANDARD_MARKS;
}
export function writeStandardMarks(id: string, m: StandardMarks): void {
  try {
    localStorage.setItem(KEY(id), JSON.stringify(m));
  } catch {
    // a convenience; the server keeps the graded versions and the passed stages
  }
}
