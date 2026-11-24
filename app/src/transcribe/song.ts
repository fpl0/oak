// Song items of the ladder (contracts §2.8–§2.9, §6.6 X2, §6.12; wave5.md §5.3): L5 public-domain folk worked
// phrase by phrase, and L6 blues worked in three stages — the bass, then the changes, then the melody. What the
// learner is given (tempo, meter, key and home note, the pickup, the form, the feel), the phrase map and the stage
// strip, the bar timeline's section, chorus and line marks, "bass only" and "without melody" listening, the starter
// code, the chord chart written into the code, and a check's verdict. Pure, so every rule is unit-tested; the X2
// workspace (capstone) uses the same pieces.
import type { LadderItem, LadderSong, LadderSubmitResult } from "@oak/api";
import type { GradeResult, KeySpec, MeterId, Rat } from "@oak/content-kit";
import { R } from "@oak/content-kit";
import { scaleName } from "@oak/pitch";
import { METERS, tempoLine, tonicDisplay } from "@oak/theory";
import { formatKey } from "../lib/format.ts";
import { checkLines, keyMismatchText } from "./ladder.ts";

export type SongLevel = 5 | 6;
export const SONG_STAGES = ["bass", "changes", "melody"] as const;
export type SongStage = (typeof SONG_STAGES)[number];

export const isSongLevel = (level: number | null | undefined): level is SongLevel =>
  level === 5 || level === 6;

/** Pass marks (contracts §6.6 X2, `SONG_LADDER_PASS` of @oak/grader): L5 per phrase; L6 per stage. */
export const SONG_PASS: { readonly 5: number; readonly 6: Readonly<Record<SongStage, number>> } = {
  5: 0.85,
  6: { bass: 0.9, changes: 0.85, melody: 0.85 },
};
export const passMarkOf = (level: SongLevel, stage: SongStage | null): number =>
  level === 5 ? SONG_PASS[5] : SONG_PASS[6][stage ?? "bass"];

export const SONG_STAGE_LABEL: Record<SongStage, string> = {
  bass: "Bass",
  changes: "Changes",
  melody: "Melody",
};
export const SONG_STAGE_TASK: Record<SongStage, string> = {
  bass: "The root of each bar, home first. Write it on the bass: line.",
  changes: "Each bar's chord over the bass you found: fill the chart, or write the chords: line.",
  melody: "The tune, one 4-bar line at a time, as scale degrees on the melody: line.",
};

/** One-bar facts for an L6 strain: a bar length a line is cut into (contracts §6.6 X2 "per 4-bar line"). */
export const LINE_BARS = 4;
/** A blues chorus (one time through the form). */
export const BLUES_CHORUS_BARS = 12;

// --- what is given ------------------------------------------------------------------------------------

export interface SongGiven {
  songId: string | null;
  title: string;
  year: number | "trad" | null;
  bpm: number;
  meter: MeterId;
  key: KeySpec | null;
  /** Beats of the pickup in bar 0; `null` when the song starts on beat 1 of bar 1. */
  pickupBeats: number | null;
  /** Full bars (the pickup bar not counted). */
  bars: number;
  /** Phrases (L5) or lines (L6), 1-based inclusive bars as the lead sheet numbers them. */
  phrases: [number, number][];
  /** "Swing 8ths": the feel is stated; grading straightens the reference, so straight eighths still match. */
  swing: boolean;
  /** "one 12-bar strain", "a 16-bar verse"; `null` for L5. */
  form: string | null;
}

/** The parts of a project this file reads (a `TranscriptionDetail`, or a fake in tests). */
export interface SongProjectLike {
  id: string;
  title: string;
  songId: string | null;
  key: KeySpec | null;
  bpm: number | null;
  meter: string | null;
  ladderLevel: number | null;
  stimulus: { events: readonly { track: string; onset: Rat }[]; bars: number; cps: number } | null;
  /**
   * Requested of the server (apiNotes): the item's givens on the project itself, so a song project opened later
   * (from the list, in another tab) still knows its pickup and feel. Read when present.
   */
  given?:
    | {
        pickup?: { units: Rat } | null | undefined;
        swing?: { subdivision: 8 | 16; amount: number } | null | undefined;
        form?: string | null | undefined;
      }
    | null
    | undefined;
}

const unitsPerBar = (meter: MeterId) => METERS[meter]?.unitsPerBar ?? 4;

/**
 * The pickup in beats, read from what the reference plays in its first cycle (contracts §6.11: the tune enters
 * after leading rests while bass and chords rest; drums may count in). `null` when bar 0 is a full bar.
 */
export function pickupFromEvents(
  events: readonly { track: string; onset: Rat }[],
  meter: MeterId,
): number | null {
  const firsts = events
    .filter((e) => R.toNum(e.onset) < 1 && layerOfTrack(e.track) === "melody")
    .map((e) => R.toNum(e.onset));
  if (firsts.length === 0) return null;
  const first = Math.min(...firsts);
  if (first <= 0) return null;
  const harmonyBefore = events.some((e) => {
    const l = layerOfTrack(e.track);
    return (l === "bass" || l === "chords") && R.toNum(e.onset) < first;
  });
  if (harmonyBefore) return null;
  const beats = Math.round((1 - first) * unitsPerBar(meter) * 4) / 4;
  return beats > 0 && beats < unitsPerBar(meter) ? beats : null;
}

/** 4-bar lines over `bars` full bars (the last line may be shorter). */
export function lineSpans(bars: number, size = LINE_BARS): [number, number][] {
  const out: [number, number][] = [];
  for (let b = 1; b <= bars; b += size) out.push([b, Math.min(bars, b + size - 1)]);
  return out;
}

const FORM_TEXT = (bars: number) =>
  bars === 12
    ? "one 12-bar strain"
    : bars % 12 === 0
      ? `${bars / 12} choruses of 12 bars`
      : `a ${bars}-bar verse`;

/**
 * Everything the learner is given about a song item (contracts §6.12: tempo, meter, key and pickup are given; L6
 * adds the form and the feel). Sources, best first: the item `ladder.next` returned, the project's own givens, the
 * song from `ladder.songs`, then what the reference plays (bars and the pickup).
 */
export function songGivenOf(
  p: SongProjectLike,
  item: Pick<LadderItem, "given" | "song" | "phrases"> | null,
  song: Pick<LadderSong, "songId" | "title" | "year" | "phrases"> | null,
): SongGiven {
  const level = p.ladderLevel ?? 5;
  const meter = (item?.given.meter ?? p.meter ?? "4/4") as MeterId;
  const listed = item?.phrases ?? song?.phrases ?? null;
  const lastBar = listed && listed.length > 0 ? Math.max(...listed.map((ph) => ph[1])) : null;
  let pickupBeats: number | null = null;
  const pick = item ? item.given.pickup : p.given?.pickup;
  if (pick !== undefined && pick !== null) pickupBeats = R.toNum(pick.units);
  else if (pick === undefined && p.stimulus) pickupBeats = pickupFromEvents(p.stimulus.events, meter);
  const cycles = p.stimulus?.bars ?? null;
  const bars =
    lastBar ??
    item?.given.bars ??
    (cycles !== null ? Math.max(1, cycles - (pickupBeats !== null ? 1 : 0)) : 4);
  const swingGiven = p.given?.swing;
  // L6 is blues: the shuffle is the song's own feel at every realism level (U11 spec), stated as given.
  const swing = swingGiven !== undefined ? swingGiven !== null : level === 6;
  const phrases: [number, number][] =
    level === 6
      ? lineSpans(bars)
      : listed && listed.length > 0
        ? listed.map((ph) => [ph[0], ph[1]] as [number, number])
        : lineSpans(bars);
  return {
    songId: item?.song?.songId ?? song?.songId ?? p.songId,
    title: item?.song?.title ?? song?.title ?? p.title,
    year: item?.song?.year ?? song?.year ?? null,
    bpm: item?.given.bpm ?? p.bpm ?? Math.round((p.stimulus?.cps ?? 0.25) * 60 * unitsPerBar(meter)),
    meter,
    key: item?.given.key ?? p.key,
    pickupBeats: pickupBeats !== null && pickupBeats > 0 ? pickupBeats : null,
    bars,
    phrases,
    swing,
    form: level === 6 ? (p.given?.form ?? FORM_TEXT(bars)) : null,
  };
}

const beatsText = (n: number) => `${n} ${n === 1 ? "beat" : "beats"}`;

/** "Starts on beat 4 of the pickup bar" / "Starts on beat 1 of bar 1". */
export function pickupText(g: Pick<SongGiven, "pickupBeats" | "meter">): string {
  if (g.pickupBeats === null) return "Starts on beat 1 of bar 1";
  const start = unitsPerBar(g.meter) - g.pickupBeats + 1;
  return `Starts on beat ${Number.isInteger(start) ? start : start.toFixed(1)} of the pickup bar (${beatsText(g.pickupBeats)} before bar 1)`;
}

/** "G major, home is G". */
export function keyText(key: KeySpec | null): string {
  if (!key) return "Key not given";
  return `${formatKey(key)}, home is ${tonicDisplay(key.tonic)}`;
}

/** The pickup as a chip: "Pickup: 1 beat, from beat 4" / "No pickup". */
export function pickupChip(g: Pick<SongGiven, "pickupBeats" | "meter">): string {
  if (g.pickupBeats === null) return "No pickup";
  const start = unitsPerBar(g.meter) - g.pickupBeats + 1;
  return `Pickup: ${beatsText(g.pickupBeats)}, from beat ${Number.isInteger(start) ? start : start.toFixed(1)}`;
}

/** The givens as short chips, in the order a learner needs them. */
export function songGivenChips(g: SongGiven): string[] {
  return [
    `${Math.round(g.bpm)} BPM`,
    g.meter,
    keyText(g.key),
    pickupChip(g),
    ...(g.form ? [g.form] : []),
    ...(g.swing ? ["Swing 8ths"] : []),
    ...(g.form ? ["One chord a bar"] : []),
  ];
}

export function songTitleText(g: Pick<SongGiven, "title" | "year">): string {
  return g.year === null ? g.title : `${g.title} (${g.year === "trad" ? "trad." : g.year})`;
}

// --- bars and cycles ------------------------------------------------------------------------------------

/** Timeline cycle of a 1-based bar: with a pickup, cycle 0 is the pickup bar and bar n is cycle n. */
export const cycleOfBar = (bar: number, pickup: boolean): number => (pickup ? bar : bar - 1);
/** 1-based bar of a timeline cycle (0 = the pickup bar when there is one). */
export const barOfCycle = (cycle: number, pickup: boolean): number => (pickup ? cycle : cycle + 1);

/**
 * The loop (in timeline cycles) of a phrase or line: its bars, and in a song with a pickup the bar before it too,
 * since each phrase starts on its own pickup notes at the end of that bar (the grader's phrase window starts there:
 * `phraseWindow`). Phrase 1's bar before is the pickup bar. `lead: false` loops the bars alone.
 */
export function spanLoop(
  span: readonly [number, number],
  pickup: boolean,
  lead = pickup,
): { fromBar: number; bars: number } {
  const from = cycleOfBar(span[0], pickup);
  const to = cycleOfBar(span[1], pickup);
  const before = lead && pickup && from > 0 ? 1 : 0;
  return { fromBar: from - before, bars: to - from + 1 + before };
}

/** The span (phrase or line) that holds 1-based `bar`; the pickup bar belongs to the first. */
export function spanAt(spans: readonly (readonly [number, number])[], bar: number): number {
  if (bar < 1) return spans.length > 0 ? 0 : -1;
  return spans.findIndex((s) => bar >= s[0] && bar <= s[1]);
}

/** Choruses of a blues strain: 12-bar blocks over the full bars (one block when the form is not 12-bar). */
export function chorusSpans(bars: number, chorus = BLUES_CHORUS_BARS): [number, number][] {
  if (bars % chorus !== 0) return [[1, bars]];
  const out: [number, number][] = [];
  for (let b = 1; b <= bars; b += chorus) out.push([b, b + chorus - 1]);
  return out;
}

export interface TimelineMark {
  /** Timeline cycle the mark starts at. */
  cycle: number;
  text: string;
  /** `section`: a phrase or a chorus (a strong line); `line`: a 4-bar line (a light one). */
  kind: "section" | "line";
}

/**
 * The marks over a song's bar timeline: L5 names each phrase; L6 names each chorus (a 12-bar strain is one) and
 * each 4-bar line. Bar numbers count from the first full bar after a pickup (c4).
 */
export function timelineMarks(
  level: SongLevel,
  g: Pick<SongGiven, "phrases" | "bars" | "pickupBeats">,
): TimelineMark[] {
  const pickup = g.pickupBeats !== null;
  if (level === 5)
    return g.phrases.map((ph, i) => ({
      cycle: cycleOfBar(ph[0], pickup),
      text: `Phrase ${i + 1}`,
      kind: "section",
    }));
  const out: TimelineMark[] = [];
  const choruses = chorusSpans(g.bars);
  for (const [i, c] of choruses.entries())
    out.push({
      cycle: cycleOfBar(c[0], pickup),
      text:
        choruses.length > 1 ? `Chorus ${i + 1}` : g.bars === BLUES_CHORUS_BARS ? "12-bar strain" : "Verse",
      kind: "section",
    });
  for (const [i, l] of lineSpans(g.bars).entries())
    if (!choruses.some((c) => c[0] === l[0]))
      out.push({ cycle: cycleOfBar(l[0], pickup), text: `Line ${i + 1}`, kind: "line" });
  return out.sort((a, b) => a.cycle - b.cycle);
}

// --- phrases (L5) and stages (L6) ------------------------------------------------------------------------

export type SpanStatus = "passed" | "revealed" | "open" | "locked";

/**
 * Each phrase's state, worked in order (U11 spec: "a song is worked phrase by phrase, in order"): passed ones
 * (the server's graded passes and this browser's), the first one left open, the rest waiting.
 */
export function phraseStates(
  count: number,
  passed: readonly number[],
  revealed: readonly number[] = [],
): { n: number; status: SpanStatus }[] {
  const done = (n: number) => passed.includes(n) || revealed.includes(n);
  const open = Array.from({ length: count }, (_, i) => i + 1).find((n) => !done(n)) ?? null;
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      n,
      status: passed.includes(n)
        ? "passed"
        : revealed.includes(n)
          ? "revealed"
          : n === open
            ? "open"
            : "locked",
    };
  });
}

/** The phrase to answer now (1-based), `null` once every phrase is passed or shown. */
export function currentPhrase(
  count: number,
  passed: readonly number[],
  revealed: readonly number[] = [],
): number | null {
  return phraseStates(count, passed, revealed).find((s) => s.status === "open")?.n ?? null;
}

export type StageMarks = Partial<Record<SongStage, "passed" | "revealed">>;

/** Each stage opens after the one before passed or was shown (X2's order: bass → changes → melody). */
export function songStageStates(marks: StageMarks): { stage: SongStage; status: SpanStatus }[] {
  const cur = SONG_STAGES.find((s) => marks[s] === undefined) ?? null;
  return SONG_STAGES.map((stage) => ({ stage, status: marks[stage] ?? (stage === cur ? "open" : "locked") }));
}
export const currentSongStage = (marks: StageMarks): SongStage | null =>
  SONG_STAGES.find((s) => marks[s] === undefined) ?? null;

/** The server's passed stages (`LadderSong.passedStages`) merged with this browser's marks. */
export function mergeStageMarks(passed: readonly SongStage[], local: StageMarks): StageMarks {
  const out: StageMarks = { ...local };
  for (const s of passed) out[s] = "passed";
  return out;
}

// --- listening: bass only, without melody (L6, X2) ---------------------------------------------------------

export type SongLayer = "melody" | "bass" | "chords" | "drums" | "other";

/** Which layer a reference track is, by its label (`mel`, `bass`, `chords`, `drums`, `kick` …). */
export function layerOfTrack(track: string): SongLayer {
  const t = track.toLowerCase().replace(/^ref_/, "");
  if (/^(mel|melody|lead|tune|vox|voice|horn)/.test(t)) return "melody";
  if (/^(bass|ebass|upright)/.test(t)) return "bass";
  if (/^(chord|chords|comp|keys|piano|rhodes|organ|guitar)/.test(t)) return "chords";
  if (/^(drum|drums|kick|snare|hat|hats|hh|ride|perc|shaker|tamb|clap|rim)/.test(t)) return "drums";
  return "other";
}

export const LISTEN_MODES = ["full", "bass", "no-melody"] as const;
export type ListenMode = (typeof LISTEN_MODES)[number];
export const LISTEN_LABEL: Record<ListenMode, string> = {
  full: "Everything",
  bass: "Bass only",
  "no-melody": "Without melody",
};

/**
 * Hearing one layer alone is a help, not the exercise: allowed while the realism keeps the parts clear (R0–R2).
 * From R3 the dense mix is part of what is practised (contracts §6.12), so the source plays whole.
 */
export const listenAllowed = (realism: number | null | undefined): boolean => (realism ?? 0) <= 2;

/** Reference tracks to mute for a listening mode. */
export function listenMutes(mode: ListenMode, tracks: readonly string[]): string[] {
  if (mode === "full") return [];
  if (mode === "bass") return tracks.filter((t) => layerOfTrack(t) !== "bass");
  return tracks.filter((t) => layerOfTrack(t) === "melody");
}

/** The listening mode a stage starts in: the bass forward for the bass, no melody for the changes. */
export const stageListenMode = (stage: SongStage | null): ListenMode =>
  stage === "bass" ? "bass" : stage === "changes" ? "no-melody" : "full";

// --- starter code -------------------------------------------------------------------------------------

/** One mini-notation cell per bar: the pickup bar's rests then `cell` on its beats, then `cell` per full bar. */
function perBar(cell: string, g: Pick<SongGiven, "bars" | "pickupBeats" | "meter">, rest = "~"): string {
  const cells: string[] = [];
  if (g.pickupBeats !== null) {
    const units = unitsPerBar(g.meter);
    const lead = Math.max(0, Math.round(units - g.pickupBeats));
    const tail = Math.max(1, Math.round(g.pickupBeats));
    cells.push(
      cell === rest ? rest : `[${[...Array(lead).fill(rest), ...Array(tail).fill(cell)].join(" ")}]`,
    );
  }
  for (let b = 0; b < g.bars; b++) cells.push(cell);
  return cells.length === 1 ? (cells[0] as string) : `<${cells.join(" ")}>`;
}

/**
 * The code a song item opens with: the given tempo, a comment with the givens, and one placeholder per bar on
 * the lines the grader reads (`melody:`; L6 also `bass:` and an empty `chords:`). Degrees are `n()` values,
 * "degree − 1".
 */
export function songStarter(level: SongLevel, g: SongGiven): string {
  const key: KeySpec = g.key ?? { tonic: "C", mode: "major" };
  const head = [
    tempoLine(Math.round(g.bpm), g.meter),
    `// ${songTitleText(g)} · ${keyText(g.key)} · ${g.meter}`,
    `// ${pickupText(g)}.${g.swing ? " Swing 8ths: write straight eighths; the check straightens the swing." : ""}`,
  ].join("\n");
  const melody = `melody: n("${perBar("0", g)}").scale("${scaleName(key, 4)}").s("piano")`;
  if (level === 5) return `${head}\n\n${melody}\n`;
  const bass = `bass: n("${perBar("0", g)}").scale("${scaleName(key, 2)}").s("ebass")`;
  const chords = `chords: note("${perBar("~", g)}")`;
  const tune = `melody: n("${perBar("~", g)}").scale("${scaleName(key, 4)}").s("piano")`;
  return `${head}\n\n${bass}\n${chords}\n${tune}\n`;
}

// --- the chord chart and the code (L6 changes) -----------------------------------------------------------

const CHORDS_LINE = /^(\s*chords\s*:\s*)(.*)$/m;

/**
 * The chart in the code: the symbols of a `chords: chord("<…>")` line, one per full bar (the pickup bar left out),
 * `""` for a rest; `null` when the line is not a plain one-chord-a-bar `chord()` line (the learner wrote it some
 * other way, and the chart then stays the learner's own).
 */
export function changesOfCode(code: string, bars: number, pickup: boolean): string[] | null {
  const m = CHORDS_LINE.exec(code);
  if (!m) return null;
  const body = m[2] as string;
  const c = /^chord\(\s*"<?\s*([^">]*?)\s*>?"\s*\)/.exec(body);
  if (!c) return /^note\(\s*"<?[\s~]*>?"\s*\)/.test(body) ? Array(bars).fill("") : null;
  const cells = (c[1] as string).split(/\s+/).filter(Boolean);
  if (cells.some((x) => /[[\]{}(),*/@!_]/.test(x))) return null;
  const full = pickup ? cells.slice(1) : cells;
  return Array.from({ length: bars }, (_, i) => {
    const s = full[i] ?? "";
    return s === "~" ? "" : s;
  });
}

/** The code with its `chords:` line written from the chart (an empty bar rests); the line is added if missing. */
export function withChanges(code: string, chart: readonly string[], pickup: boolean): string {
  const cells = [...(pickup ? ["~"] : []), ...chart.map((s) => s.trim() || "~")];
  const line = cells.every((c) => c === "~")
    ? `note("<${cells.join(" ")}>")`
    : `chord("<${cells.join(" ")}>").voicing().s("piano").gain(.6)`;
  if (CHORDS_LINE.test(code)) return code.replace(CHORDS_LINE, (_, head: string) => `${head}${line}`);
  const bass = /^(\s*bass\s*:.*)$/m.exec(code);
  if (bass) return code.replace(bass[0], `${bass[0]}\nchords: ${line}`);
  return `${code.replace(/\s*$/, "")}\nchords: ${line}\n`;
}

// --- a check ------------------------------------------------------------------------------------------

export interface SongCheckTarget {
  level: SongLevel;
  /** L5: the phrase; L6 melody: the line. 1-based. */
  span: number | null;
  stage: SongStage | null;
}

const pct = (x: number) => Math.round(x * 100);

/** What a check answered, in words: "Phrase 2", "The bass", "Melody, line 3". */
export function targetText(t: SongCheckTarget): string {
  if (t.level === 5) return `Phrase ${t.span ?? 1}`;
  const stage = t.stage ?? "bass";
  if (stage === "melody" && t.span !== null) return `Melody, line ${t.span}`;
  return `The ${stage === "changes" ? "changes" : stage}`;
}

/**
 * One calm sentence for a song check (ux §7.11): what it answered, the score against its mark, and where it
 * differs. The per-bar lines follow it (`checkLines`).
 */
export function songVerdict(r: Pick<LadderSubmitResult, "passed" | "result">, t: SongCheckTarget): string {
  const what = targetText(t);
  if (r.result.status === "error") return `${what}: that code didn't run, so nothing was checked.`;
  const mark = passMarkOf(t.level, t.stage);
  if (r.passed) return `${what}: that's it (${pct(r.result.score)}%).`;
  // d12: a song is written in the recording's key. An answer in another key says both keys, before any bar.
  const key = keyMismatchText(r.result);
  if (key) return `${what}: not yet. ${key} Write it in the recording's key.`;
  const bars = [...new Set(checkLines(r.result).flatMap((l) => (l.bar === null ? [] : [l.bar])))];
  const where =
    bars.length === 0
      ? ""
      : bars.length === 1
        ? ` Bar ${bars[0]} differs.`
        : ` Bars ${bars.slice(0, -1).join(", ")} and ${bars.at(-1)} differ.`;
  return `${what}: not yet, ${pct(r.result.score)}% right; ${pct(mark)}% passes.${where} Loop it and listen again.`;
}

export type BarMark = "ok" | "issue";

/**
 * Feedback per bar on the timeline: the checked span's bars, those the grader named marked "issue", the rest "ok".
 * Keys are timeline cycles.
 */
export function barMarks(
  result: GradeResult,
  span: readonly [number, number],
  pickup: boolean,
): Map<number, BarMark> {
  const out = new Map<number, BarMark>();
  if (result.status === "error") return out;
  const named = new Set(checkLines(result).flatMap((l) => (l.bar === null ? [] : [l.bar])));
  for (let b = span[0]; b <= span[1]; b++) out.set(cycleOfBar(b, pickup), named.has(b) ? "issue" : "ok");
  return out;
}

// --- the item the server returned ---------------------------------------------------------------------

const ITEM_KEY = (id: string) => `oak.transcribe.song-item.${id}`;
const items = new Map<string, Pick<LadderItem, "given" | "song" | "phrases" | "stages">>();

/**
 * Keeps what `ladder.next` said about a song item (its givens, song and phrases) for the project page, which reads
 * the project alone. A convenience: without it the page derives the givens from the project and the song list.
 */
export function rememberItem(item: LadderItem): void {
  const kept = {
    given: item.given,
    song: item.song ?? null,
    phrases: item.phrases ?? null,
    stages: item.stages,
  };
  items.set(item.itemId, kept);
  try {
    sessionStorage.setItem(ITEM_KEY(item.itemId), JSON.stringify(kept));
  } catch {
    // storage blocked: the page derives the givens
  }
}

export function rememberedItem(id: string): Pick<LadderItem, "given" | "song" | "phrases" | "stages"> | null {
  const hit = items.get(id);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(ITEM_KEY(id));
    if (raw) return JSON.parse(raw) as Pick<LadderItem, "given" | "song" | "phrases" | "stages">;
  } catch {
    // storage blocked
  }
  return null;
}
