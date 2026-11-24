// The generated ladder L1–L4 in Transcribe (contracts §2.9, §6.12; wave4.md §5.4): what the learner is given,
// the code they start from, L3's stages (bass first), and a check's result as per-bar lines. Pure.
import type { LadderItem, LadderState } from "@oak/api";
import type { GradeResult, KeySpec, MeterId } from "@oak/content-kit";
import { R } from "@oak/content-kit";
import { scaleName } from "@oak/pitch";
import { type Degree, syllableOf, tempoLine } from "@oak/theory";
import { formatKey } from "../lib/format.ts";

/**
 * L1–L4 are generated; L5 (folk, per phrase) and L6 (blues, staged) are songs (song.ts); L8 is a standard in four
 * stages (standard.ts). L7 is the learner's own audio: a project, never a level items are drawn at.
 */
export type LadderLevel = 1 | 2 | 3 | 4 | 5 | 6 | 8;
export type LadderStage = "bass" | "quality" | "rn";

/** Pass mark of every ladder level (contracts §6.12; `LADDER_PASS` of @oak/grader). */
export const LADDER_PASS = 0.85;

export const LEVEL_TITLE: Record<LadderLevel, string> = {
  1: "Drum loops",
  2: "Bass lines",
  3: "Four-chord loops",
  4: "Short melodies",
  5: "Public-domain folk",
  6: "Blues",
  8: "Standards, a full arrangement",
};
export const LEVEL_TASK: Record<LadderLevel, string> = {
  1: "Write the drum loop you hear: kick, snare and hats.",
  2: "Write the bass line you hear as scale degrees.",
  3: "Write the bass line first, then the chords above it.",
  4: "Write the melody you hear as scale degrees.",
  5: "Write the tune phrase by phrase, as scale degrees.",
  6: "Write the bass, then the changes, then the melody.",
  8: "Map the form, then write the bass, the changes and the melody, section by section.",
};
export const STAGE_LABEL: Record<LadderStage, string> = {
  bass: "Bass",
  quality: "Chord qualities",
  rn: "Roman numerals",
};
/** The stage as a noun inside a sentence ("Check the Roman numerals"). */
export const STAGE_NOUN: Record<LadderStage, string> = {
  bass: "bass",
  quality: "chord qualities",
  rn: "Roman numerals",
};
export const STAGE_TASK: Record<LadderStage, string> = {
  bass: "Get the bass line right first: it names each chord's root.",
  quality: "Now the chords: is each one major or minor?",
  rn: "Last, the numerals: which degree is each chord built on?",
};
/** How real an item sounds, in words (the realism level's number is never shown alone). */
export const REALISM_WORDS: Record<number, string> = {
  0: "clean and on the grid",
  1: "humanised timing",
  2: "swing and room",
  3: "a dense mix, the part a little buried",
  4: "a sung lead, slightly detuned",
};
/** The realism line under a ladder item or the ladder card. */
export const REALISM_TEXT: Record<number, string> = Object.fromEntries(
  Object.entries(REALISM_WORDS).map(([k, v]) => [k, `Sound: ${v}`]),
);

/**
 * The part a level's realism layers treat as the learner's target (`@oak/drills` `generateLadderPiece`'s
 * `performance.target`): never swung at R2, 6 dB down at R3, the lead sound at R4. The stimulus carries no
 * performance hints, so the level names it.
 */
export const REALISM_TARGET: Record<LadderLevel, string> = {
  1: "kick",
  2: "bass",
  3: "chords",
  4: "mel",
  5: "mel",
  6: "bass",
  8: "mel",
};

export interface Given {
  bpm: number;
  meter: MeterId;
  /** `null` when the item did not say (older generated projects): the starter writes C major then. */
  key: KeySpec | null;
  pickupBeats: number | null;
  bars: number;
}

export function givenOf(item: Pick<LadderItem, "given">): Given {
  const g = item.given;
  return {
    bpm: g.bpm,
    meter: g.meter,
    key: g.key,
    pickupBeats: g.pickup ? R.toNum(g.pickup.units) : null,
    bars: g.bars,
  };
}

/** The given facts as short chips (contracts §6.12: tempo, meter, key and pickup are given). */
export function givenChips(g: Given): string[] {
  const out = [
    `${Math.round(g.bpm)} BPM`,
    g.meter,
    formatKey(g.key),
    `${g.bars} ${g.bars === 1 ? "bar" : "bars"}`,
  ];
  if (g.pickupBeats !== null && g.pickupBeats > 0)
    out.push(`pickup of ${g.pickupBeats} ${g.pickupBeats === 1 ? "beat" : "beats"}`);
  return out;
}

const repeat = (cell: string, bars: number) =>
  bars <= 1 ? cell : `<${Array.from({ length: bars }, () => cell).join(" ")}>`;

/**
 * The code a ladder item opens with: the given tempo, the item's tracks named as the grader reads them
 * (`@bass`, `@melody`, drum roles by sound) and one placeholder per bar. Degrees are `n()` values, "degree − 1".
 */
export function starterCode(level: LadderLevel, g: Given): string {
  const tempo = tempoLine(Math.round(g.bpm), g.meter);
  const key: KeySpec = g.key ?? { tonic: "C", mode: "major" };
  const head = `${tempo}\n// ${LEVEL_TITLE[level]} · ${g.bars} bars${g.key ? ` · ${formatKey(g.key)}` : ""}`;
  if (level === 1)
    return `${head}\n\nkick: s("${repeat("[bd ~ ~ ~]", g.bars)}")\nsnare: s("${repeat("[~ ~ ~ ~]", g.bars)}")\nhats: s("${repeat("[~ ~ ~ ~]", g.bars)}")\n`;
  const bass = `bass: n("${repeat("0", g.bars)}").scale("${scaleName(key, 2)}").s("ebass")`;
  if (level === 2) return `${head}\n\n${bass}\n`;
  if (level === 3)
    return `${head}\n\n${bass}\nchords: n("${repeat("[0,2,4]", g.bars)}").scale("${scaleName(key, 3)}").s("piano")\n`;
  return `${head}\n\nmelody: n("${repeat("[0 ~ ~ ~]", g.bars)}").scale("${scaleName(key, 4)}").s("piano")\n`;
}

// --- L3 stages ---------------------------------------------------------------------------------------

export type StageMarks = Partial<Record<LadderStage, "passed" | "revealed">>;

/** The stage to answer now: the first one not passed or revealed (`null` when all are done). */
export function currentStage(stages: readonly LadderStage[] | null, marks: StageMarks): LadderStage | null {
  if (!stages) return null;
  return stages.find((s) => marks[s] === undefined) ?? null;
}

/** Each stage opens only after the one before passed or was revealed (wave4.md §5.1). */
export function stageStatus(
  stages: readonly LadderStage[],
  marks: StageMarks,
): { stage: LadderStage; status: "passed" | "revealed" | "open" | "locked" }[] {
  const cur = currentStage(stages, marks);
  return stages.map((stage) => ({
    stage,
    status: marks[stage] ?? (stage === cur ? "open" : "locked"),
  }));
}

// --- a check as lines --------------------------------------------------------------------------------

export interface CheckLine {
  bar: number | null;
  /** The grader's beat label ("2", "2&"), when the line is about one beat. */
  beat: string | null;
  text: string;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The result's messages as "Bar 1, beat 2: missing hit (kick)." lines, in bar order; general lines last. The
 * grader's text already starts with its place ("Bar 1, 2: …"); the place is said once, with the word "beat".
 */
export function checkLines(result: GradeResult): CheckLine[] {
  const lines: CheckLine[] = [];
  const seen = new Set<string>();
  for (const m of result.messages) {
    const bar = m.where?.bar ?? null;
    const beat = m.where?.beatLabel ?? null;
    let text = m.text.trim();
    // The grader's "5 more" tail after its top three.
    const more = /^(\d+) more\.?$/.exec(text);
    if (more && bar === null) text = `…and ${more[1]} more.`;
    if (bar !== null) text = text.replace(new RegExp(`^bar\\s+${bar}\\s*[:,·-]\\s*`, "i"), "");
    // A harmony slot's number ("Chord 4: IV, expected V7.") counts chord changes, not bars: with the bar said, it
    // only misleads (bar 9 is the fourth change of a blues).
    if (bar !== null) text = text.replace(/^chord\s+\d+\s*:\s*/i, "");
    let onBeat: string | null = null;
    if (beat !== null && new RegExp(`^${esc(beat)}\\s*:\\s*`).test(text)) {
      text = text.replace(new RegExp(`^${esc(beat)}\\s*:\\s*`), "");
      onBeat = beat;
    }
    // A missing degree reads as the lines beside it do ("you have 1 (do)"): "6 (la) missing", not "note 6 missing".
    text = text.replace(/^note ([#b♯♭]?[1-7]) missing\b/, (_, d: string) => {
      const syl = syllableOf(d.replace("♭", "b").replace("♯", "#") as Degree);
      return syl === "?" ? `${d} missing` : `${d} (${syl}) missing`;
    });
    const key = `${bar}|${onBeat}|${text}`;
    if (!text || seen.has(key)) continue;
    seen.add(key);
    lines.push({
      bar,
      beat: bar === null ? null : onBeat,
      // After "Bar 9:" a sentence goes on in lower case; a numeral, a chord or a note name keeps its case ("IV").
      text:
        bar === null
          ? cap(text)
          : /^(?:[A-Z][a-z]|A\s)/.test(text)
            ? text.charAt(0).toLowerCase() + text.slice(1)
            : text,
    });
  }
  return lines.sort((a, b) => (a.bar ?? 1e9) - (b.bar ?? 1e9));
}

/**
 * d12 (ladder L5 and every later level): an answer in another key than the recording fails, and the result names
 * both keys (`melody.wrong-key`, `harmony.key-mismatch`; before Wave 6 the passing note `melody.transposed`). The
 * grader's message is the sentence; this finds it so a verdict can lead with it.
 */
export function keyMismatchText(result: GradeResult): string | null {
  const hit = result.messages.find(
    (m) => typeof m.id === "string" && /\.(transposed|wrong-key|key-mismatch)(\.|$)/.test(m.id),
  );
  return hit ? hit.text.trim() : null;
}

export const lineText = (l: CheckLine): string =>
  l.bar === null ? l.text : `Bar ${l.bar}${l.beat ? `, beat ${l.beat}` : ""}: ${l.text}`;

/** One calm sentence for a check (ux §7.11: no exclamation marks on failure). */
export function verdictText(r: { passed: boolean; result: GradeResult }, stage: LadderStage | null): string {
  const pct = Math.round(r.result.score * 100);
  if (r.result.status === "error") return "That code didn't run, so nothing was checked.";
  if (r.passed)
    return stage && stage !== "rn"
      ? `${STAGE_LABEL[stage]}: that's it (${pct}%). On to the next stage.`
      : `That's it: ${pct}%. You wrote what you heard.`;
  const lines = checkLines(r.result);
  const bars = [...new Set(lines.map((l) => l.bar).filter((b): b is number => b !== null))];
  const where =
    bars.length === 0
      ? ""
      : bars.length === 1
        ? ` Bar ${bars[0]} differs.`
        : ` Bars ${bars.slice(0, -1).join(", ")} and ${bars.at(-1)} differ.`;
  return `Not quite: ${pct}% right; ${Math.round(LADDER_PASS * 100)}% passes.${where} Loop it and listen again.`;
}

// --- the learner's place on the ladder -----------------------------------------------------------------

export function ladderSummary(s: LadderState): string {
  const passes = s.gradedPasses[String(s.level)] ?? 0;
  return `Level ${s.level} · ${LEVEL_TITLE[s.level as LadderLevel] ?? "Your own audio"} · ${passes} graded ${passes === 1 ? "pass" : "passes"} at this level`;
}
