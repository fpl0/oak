// Oak 2.0 W3 (PLAN §4 S6, "Catalog of Attributes"): the learner listens to a reference and writes six plain lines
// about it (tempo, sound, harmony, melody, rhythm, form); "Hide it and write" starts a sketch whose code holds the
// lines as comments. The learner does the listening first (PLAN §2 rule 3): Oak's reading of a unit song is shown only
// once a part has been written from the lines (`revealed`), and then only beside the learner's own words. Oak reads
// chords and form from code, so a transcription or an audio file gets no reading at all. Pure: model.test.ts.
import {
  CATALOG_LINES,
  type Catalog,
  chainLinks,
  labelledLines,
  roleOfLabel,
  type SketchCreate,
} from "@oak/api";
import type { AnalysisSummary, KeySpec, MeterId, NEvent } from "@oak/content-kit";
import { spellMidi, tempoLine } from "@oak/theory";
import { tempoOfCode } from "../tempo-try.ts";

export type CatalogLine = (typeof CATALOG_LINES)[number];
export type CatalogLines = Catalog["lines"];
export type CatalogRefKind = Catalog["refKind"];

/** The longest line the server keeps (`CatalogCreateSchema`). */
export const CATALOG_LINE_MAX = 400;
/** The longest reference id (an "Outside your lane" `<style> — <track>`). */
export const CATALOG_REF_MAX = 200;

/** Six empty lines. */
export const emptyLines = (): CatalogLines =>
  Object.fromEntries(CATALOG_LINES.map((k) => [k, ""])) as CatalogLines;

/** A line as one comment line: newlines folded to spaces, trimmed, at most CATALOG_LINE_MAX characters. */
const oneLine = (s: string): string =>
  s
    .replace(/\s*[\r\n]+\s*/g, " ")
    .trim()
    .slice(0, CATALOG_LINE_MAX);

/** The lines as the server keeps them (each folded to one line). */
export function cleanLines(lines: CatalogLines): CatalogLines {
  return Object.fromEntries(CATALOG_LINES.map((k) => [k, oneLine(lines[k] ?? "")])) as CatalogLines;
}

/** "Hide it and write": the tempo line, a comment naming the reference, then the six lines as comments. */
export function catalogSketchCode(o: {
  lines: CatalogLines;
  refTitle: string;
  bpm: number;
  meter: MeterId;
}): string {
  const rows = CATALOG_LINES.map((k) => {
    const v = oneLine(o.lines[k] ?? "");
    return v === "" ? `// ${k}:` : `// ${k}: ${v}`;
  });
  return [
    tempoLine(o.bpm, o.meter),
    "",
    `// Written from my catalog of “${oneLine(o.refTitle)}”`,
    ...rows,
    "",
  ].join("\n");
}

/** The new sketch "Hide it and write" creates: a free sketch with the six lines as comments, no part yet. */
export function catalogSketchBody(o: {
  lines: CatalogLines;
  refTitle: string;
  title: string;
  sessionId: string | null;
  bpm: number;
  meter: MeterId;
}): SketchCreate {
  return {
    title: o.title,
    originKind: "free",
    originId: null,
    sessionId: o.sessionId,
    code: catalogSketchCode(o),
    bpm: o.bpm,
    meter: o.meter,
    key: null,
    band: null,
    analysis: null,
    note: CATALOG_WORDS.sketchNote,
    tutorAssisted: false,
    ranOk: false,
    flags: { lockedTools: [], previewTools: [] },
  };
}

/**
 * Oak's reading (and the reference) may show only once the learner has written from the lines (W5 S9; Catalog of
 * Attributes pp. 17–18): the catalog's sketch still exists and has a version after its first (v1 is the comment-only
 * start) with at least one unmuted labelled line.
 */
export function revealed(
  catalog: Pick<Catalog, "sketchId">,
  sketches: readonly { id: string; versions: readonly { version: number; code: string }[] }[],
): boolean {
  const sketch = catalog.sketchId === null ? undefined : sketches.find((s) => s.id === catalog.sketchId);
  if (!sketch || sketch.versions.length === 0) return false;
  const first = Math.min(...sketch.versions.map((v) => v.version));
  return sketch.versions.some((v) => v.version > first && labelledLines(v.code).some((l) => !l.muted));
}

/** The catalog of a sketch (the newest one naming it), or `null`. */
export function catalogOfSketch(catalogs: readonly Catalog[], sketchId: string): Catalog | null {
  return catalogs.find((c) => c.sketchId === sketchId) ?? null;
}

// --- Oak's reading of a unit song -----------------------------------------------------------------

const LABEL_RE = /^\s*[A-Za-z_$][\w$]*\s*:\s*/;
const STRING_RE = /^(["'`])([\s\S]*)\1$/;

/** The sound names of a statement's `.s()`/`.sound()`/`.bank()` links (never its first call, the pattern itself). */
function soundNamesOf(statement: string): string[] {
  const expr = statement.replace(LABEL_RE, "");
  const links = chainLinks(expr);
  if (!links) return [];
  const names: string[] = [];
  for (const l of links.slice(1)) {
    if (l.name !== "s" && l.name !== "sound" && l.name !== "bank") continue;
    const m = STRING_RE.exec(l.args.trim());
    if (!m) continue;
    for (const w of (m[2] ?? "").split(/[\s<>[\],|*!@:~?{}()]+/))
      if (w !== "" && !/^[\d.]+$/.test(w) && !names.includes(w)) names.push(w);
  }
  return names;
}

/** `kickIntro` on the line `kick` → `intro`; a name that does not start with the label stays as it is. */
function sectionName(name: string, label: string): string {
  if (name.length > label.length && name.startsWith(label) && /[A-Z0-9]/.test(name.charAt(label.length))) {
    const rest = name.slice(label.length);
    return rest.charAt(0).toLowerCase() + rest.slice(1);
  }
  return name;
}

/** The section names of the code's `arrange()`: the one with the fewest rests, its names in order. */
function arrangeSections(code: string): string[] | null {
  let best: string[] | null = null;
  let bestRests = Number.POSITIVE_INFINITY;
  for (const line of labelledLines(code)) {
    if (line.muted) continue;
    const at = line.text.indexOf("arrange(");
    if (at < 0) continue;
    const names = [...line.text.slice(at).matchAll(/\[\s*[\d./]+\s*,\s*([A-Za-z_$][\w$]*)\s*\]/g)].map(
      (m) => m[1] as string,
    );
    if (names.length === 0) continue;
    const rests = names.filter((n) => n === "silence").length;
    if (rests < bestRests) {
      best = names.map((n) => (n === "silence" ? "a rest" : sectionName(n, line.label)));
      bestRests = rests;
    }
  }
  return best;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** The lowest and highest pitched note of the tune parts (`mel`, `vox`…), or `null` when none plays. */
export function tuneRange(
  events: readonly Pick<NEvent, "track" | "midi">[],
): { low: number; high: number } | null {
  let low: number | null = null;
  let high: number | null = null;
  for (const e of events) {
    if (e.midi === null || e.track.startsWith("band.") || roleOfLabel(e.track) !== "tune") continue;
    low = low === null ? e.midi : Math.min(low, e.midi);
    high = high === null ? e.midi : Math.max(high, e.midi);
  }
  return low === null || high === null ? null : { low, high };
}

/**
 * Oak's words for a unit song, line by line, shown beside the learner's after the reveal. `tune` is the tune's range
 * from a read of the song (`tuneRange`); without one Oak says it has not read the tune.
 */
export function referenceReading(o: {
  code: string;
  bpm: number | null;
  analysis: AnalysisSummary | null;
  meter?: MeterId;
  key?: KeySpec | null;
  tune?: { low: number; high: number } | null;
}): Record<CatalogLine, string> {
  const bpm = o.bpm ?? tempoOfCode(o.code, o.meter ?? "4/4");
  const parts = labelledLines(o.code)
    .filter((l) => !l.muted)
    .map((l) => ({ label: l.label, names: soundNamesOf(l.text) }))
    .filter((p) => p.names.length > 0);
  const numerals: string[] = [];
  for (const s of o.analysis?.slots ?? []) if (s.rn !== "" && numerals.at(-1) !== s.rn) numerals.push(s.rn);
  const sections = arrangeSections(o.code);
  const name = (midi: number) => spellMidi(midi, { key: o.key ?? null }).name;
  const hasTune = labelledLines(o.code).some((l) => !l.muted && roleOfLabel(l.label) === "tune");
  return {
    tempo: bpm === null ? READING_WORDS.noTempo : `${round1(bpm)} BPM`,
    sound:
      parts.length === 0
        ? READING_WORDS.noSounds
        : parts.map((p) => `${p.label}: ${p.names.join(", ")}`).join("; "),
    harmony: numerals.length === 0 ? READING_WORDS.noChords : numerals.join("–"),
    melody: o.tune
      ? o.tune.low === o.tune.high
        ? `The tune stays on ${name(o.tune.low)}.`
        : `The tune goes from ${name(o.tune.low)} up to ${name(o.tune.high)}.`
      : hasTune
        ? READING_WORDS.tuneUnread
        : READING_WORDS.noTune,
    rhythm: READING_WORDS.rhythm,
    form: sections === null ? "one loop" : sections.join(", "),
  };
}

/** Oak's reading when there is nothing to name (descriptive: model.test.ts). */
export const READING_WORDS = {
  noTempo: "Oak reads no tempo line in it.",
  noSounds: "Oak reads no sound names in its code.",
  noChords: "Oak reads no chords in it.",
  noTune: "No tune part plays in it.",
  tuneUnread: "Oak has not read the tune yet; play it and listen for its lowest and highest note.",
  rhythm: "Oak does not put this one into words; listen again.",
} as const;

/** The six lines' names as the flow shows them. */
export const LINE_LABELS: Record<CatalogLine, string> = {
  tempo: "Tempo",
  sound: "Sound",
  harmony: "Harmony",
  melody: "Melody",
  rhythm: "Rhythm",
  form: "Form",
};

/** What each line asks the learner to listen for. */
export const LINE_PROMPTS: Record<CatalogLine, string> = {
  tempo: "How fast does it feel? Slow, walking, running…",
  sound: "Which sounds do you hear, and how do they feel?",
  harmony: "The chords: how many, and do they feel bright or dark?",
  melody: "The tune: high or low, smooth or jumpy?",
  rhythm: "Where do the drums and the bass land?",
  form: "One loop, or parts that change and come back?",
};

/** Every string of the catalog flow, the Catalogs tab and the lines in a sketch (descriptive: model.test.ts). */
export const CATALOG_WORDS = {
  tab: "Catalogs",
  intro:
    "Listen to a track, then write what you hear in six plain lines. Oak's reading of a unit song comes after you have written from your lines.",
  empty: "No catalogs yet. Pick a track you like and write what you hear in it.",
  start: "Catalog a reference",
  outsideStart: "Outside your lane",
  outsideIntro:
    "Pick a style you usually skip and a track its fans love. Listen, then write what they hear in it.",
  outsideLines: "Write each line as what its fans love about it.",
  outsideStyle: "The style",
  outsideTrack: "The track",
  pickHeading: "1. Pick a reference",
  listenHeading: "2. Listen, then write",
  writeHeading: "3. Write from your lines",
  kindSong: "A unit song",
  kindTranscription: "One of your transcriptions",
  kindAudio: "One of your audio files",
  noneOfKind: "Nothing here yet.",
  listenFirst: "Listen as often as you like. Oak shows nothing about it until you have written.",
  openPlayer: "Open it to listen",
  hideAndWrite: "Hide it and write",
  linesOnly: "Save the lines only",
  writeFromLines: "Write from these lines",
  saved: "Lines saved.",
  saveFailed: "The catalog did not save. Try again.",
  back: "Back",
  cancel: "Cancel",
  inSketch: "Your catalog",
  compare: "Compare with the reference",
  hideCompare: "Hide the reference",
  yours: "Your words",
  oaks: "Oak's reading",
  recordingOnly: "Oak reads chords and form from code only, so here it is just you and the recording.",
  outsideOnly: "Oak does not read this one; it is your listening and the fans' words.",
  reading: "Oak is reading the song…",
  sketchNote: "From my catalog",
  noLines: "(nothing written)",
  sketchTitle: (refTitle: string) => `Catalog of ${refTitle}`.slice(0, 120),
  refOf: (kind: CatalogRefKind) =>
    kind === "song"
      ? "Unit song"
      : kind === "transcription"
        ? "Transcription"
        : kind === "audio"
          ? "Audio file"
          : "Outside your lane",
} as const;

/**
 * The tempo of the sketch "Hide it and write" starts: a number of BPM the learner wrote in their tempo line (40 to
 * 240, the first one), else `null` (the caller uses Oak's default). Oak never puts its own reading of the reference
 * into that sketch.
 */
export function bpmFromLine(line: string): number | null {
  for (const m of line.matchAll(/\d+(?:\.\d+)?/g)) {
    const n = Number(m[0]);
    if (n >= 40 && n <= 240) return Math.round(n);
  }
  return null;
}

/**
 * The catalogs the Catalogs tab lists, newest first. Catalogs have no patch (W0 gap 4), so "Write from these lines"
 * saves a new catalog that names the sketch; the lines-only catalog it came from (same reference, same lines, older)
 * is then left out of the list.
 */
export function visibleCatalogs(catalogs: readonly Catalog[]): Catalog[] {
  const same = (a: Catalog, b: Catalog) =>
    a.refKind === b.refKind && a.refId === b.refId && CATALOG_LINES.every((k) => a.lines[k] === b.lines[k]);
  return catalogs.filter(
    (c, i) =>
      c.sketchId !== null ||
      !catalogs.some((d, j) => j !== i && d.sketchId !== null && same(c, d) && d.createdAt >= c.createdAt),
  );
}

/** `<style> — <track>`, at most CATALOG_REF_MAX characters; `null` while either is empty. */
export function outsideRefId(style: string, track: string): string | null {
  const s = oneLine(style);
  const t = oneLine(track);
  if (s === "" || t === "") return null;
  return `${s} — ${t}`.slice(0, CATALOG_REF_MAX);
}
