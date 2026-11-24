// Studio's pure model (ux §2.3 "Studio / Sketchbook"; contracts §3.1 rule 4, §5.10, §11.3): starters and
// templates, the Band layer of a sketch, what the toolbox-aware lint says about locked tools (hints, never a
// block), the strict check an imported version must pass before it runs, liner flags, version labels, the
// tree-ring cover and the export file. No DOM, no network: tested in model.test.ts.

import type { Sketch, SketchVersion, SketchVersionCreate, TrackLensId } from "@oak/api";
import type {
  BandDef,
  FlavourId,
  KeySpec,
  LintContext,
  LintResult,
  MeterId,
  ToolEntry,
} from "@oak/content-kit";
import type { BandSetup, MuteMap } from "@oak/strudel";
import { bandCodeAt } from "../../../content/bands/index.ts";
import { toolName } from "../lib/tool-label.ts";

// --- starters -------------------------------------------------------------------------------------

/** Tempo line, one labelled part, only tools from the first lessons (contracts §3.2: U00.L01, U01.L01). */
export const BLANK_CODE = 'setcpm(90/4)\n\ndrums: s("bd hh sd hh")\n';
/** Over a Band: a light part of the learner's own on top of the backing. */
export const OVER_BAND_CODE = 'setcpm(90/4)\n\nhats: s("hh*8")\n';

/** The flavour kits that ship in Wave 2 (contracts §5.10 table: pop and jazz-soul). */
export const STUDIO_FLAVOURS: readonly { id: FlavourId; label: string }[] = [
  { id: "flavour.pop", label: "Pop" },
  { id: "flavour.jazz-soul", label: "Jazz-soul" },
];
export const DEFAULT_FLAVOUR: FlavourId = "flavour.pop";

export function studioFlavour(f: string | null | undefined): FlavourId {
  return STUDIO_FLAVOURS.some((x) => x.id === f) ? (f as FlavourId) : DEFAULT_FLAVOUR;
}

export const DEFAULT_KEY: KeySpec = { tonic: "C", mode: "major" };
export const STUDIO_METERS: readonly MeterId[] = ["4/4", "3/4", "2/4", "6/8"];
export const TONICS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
export const MODES = ["major", "minor"] as const;
// Wave 5: 12 and 24 for one and two choruses of a 12-bar blues (U11.L05, C5).
export const LENGTHS = [1, 2, 4, 8, 12, 16, 24, 32, 64] as const;

/** "Sketch 007": one more than the highest number already used (never a duplicate after a delete). */
export function nextSketchTitle(existing: readonly { title: string }[]): string {
  let max = 0;
  for (const s of existing) {
    const m = /^Sketch (\d+)$/.exec(s.title.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Sketch ${String(max + 1).padStart(3, "0")}`;
}

// --- the Band layer -------------------------------------------------------------------------------

export interface SketchBand {
  bandId: BandDef["id"];
  flavour: FlavourId;
  mutes: ("drums" | "bass" | "chords")[];
}

/** A Band's scale argument for a key: `C4:major`, `F#4:minor` (Band code is written as degrees). */
export function bandKeyArg(key: KeySpec | null): string {
  const k = key ?? DEFAULT_KEY;
  return `${k.tonic}4:${k.mode.trim().replace(/\s+/g, ":")}`;
}

/**
 * Whether the learner has reached a lesson, for the Band's stages (contracts §5.10: jazz-soul plays four-note
 * chords and swings once U03 has begun, funk adds four-note chords from U06). A lesson counts once it is
 * started or done; until the course progress loads nothing is reached, so the first stage plays.
 */
export function bandReached(
  progress: { lessons: readonly { lessonId: string; status: string }[] } | null | undefined,
): (from: string) => boolean {
  const reached = new Set(
    (progress?.lessons ?? [])
      .filter((l) => l.status === "in_progress" || l.status === "completed")
      .map((l) => l.lessonId),
  );
  return (from) => reached.has(from);
}

/** The adapter's BandSetup for a sketch's Band: code for the flavour in the sketch's key; the tempo is the sketch's. */
export function bandSetupFor(
  band: SketchBand | null,
  bands: readonly BandDef[],
  key: KeySpec | null,
  /** Whether the learner has reached a lesson (contracts §5.10 Band stages); absent: the first stage. */
  reached: (from: string) => boolean = () => false,
): BandSetup | null {
  if (!band) return null;
  const def = bands.find((b) => b.id === band.bandId);
  const code = def ? bandCodeAt(def, band.flavour, reached) || undefined : undefined;
  if (!def || !code) return null;
  return {
    band: def.id,
    flavour: band.flavour,
    code: code.replaceAll("{{key}}", bandKeyArg(key)),
    followsLearnerKey: false,
    tracks: [...def.roles],
  };
}

/** Bands that fit a meter (a 3/4 sketch takes the waltz vamp only; contracts §5.10 and BAND_METERS). */
export function bandsForMeter(
  bands: readonly BandDef[],
  meter: MeterId,
  meterOf: (id: string) => MeterId,
): BandDef[] {
  return bands.filter((b) => meterOf(b.id) === meter);
}

/** A Roman-numeral run in a Band's title ("I–IV", "i–♭II", "I–II over home"), not a word that starts with i. */
const NUMERALS = /(^|[\s(])[♭♯#]?(?:VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(?:°|7)?(?=–|$|[\s,)])/;

/**
 * A Band's name as the learner reads it. Before Roman numerals are taught (tb.feature.rn, U06.L02) the numerals
 * in brackets are dropped ("Two-chord vamp (I–IV)" reads "Two-chord vamp"; "Waltz vamp (I–IV, 3/4)" reads
 * "Waltz vamp (3/4)"); after, the name is as written.
 */
export function bandLabel(title: string, numerals: boolean): string {
  if (numerals) return title;
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(title);
  if (!m) return title;
  const kept = (m[2] as string).split(/,\s*/).filter((part) => !NUMERALS.test(part));
  return kept.length > 0 ? `${m[1]} (${kept.join(", ")})` : (m[1] as string);
}

/**
 * The first lesson, in course order, whose steps play each Band (read from the lessons' sources; ux-review.test.ts
 * checks it against them, so a lesson that starts using a Band fails the test until this is updated). The built
 * lesson outlines the app loads do not carry the steps' Band, hence the table. A Band no lesson plays is absent.
 */
export const BAND_FIRST_LESSON: Readonly<Record<string, string>> = {
  "band.two-chord-vamp": "U01.L01",
  "band.waltz-vamp": "U01.L08",
  "band.phrase-8bar": "U03.L11",
  "band.axis-4bar": "U05.L01",
  "band.aeolian-4bar": "U16.L04",
  "band.two-five-one": "J1.L01",
  "band.blues-12bar": "J4.L02",
  "band.soul-68": "R2.L03",
  "band.son-montuno": "R3.L01",
};

/**
 * The Bands a learner has met: those whose first lesson they have reached (started or done). The Band select lists
 * these first ("Your bands") and the rest under "Later in the course".
 */
export function bandsMet(reached: (lessonId: string) => boolean): Set<string> {
  return new Set(
    Object.entries(BAND_FIRST_LESSON).flatMap(([band, lesson]) => (reached(lesson) ? [band] : [])),
  );
}

/** The Band tracks muted in the workbench, as a sketch stores them (`band.drums` → `drums`; solo is not kept). */
export function bandMutesOf(mutes: MuteMap): SketchBand["mutes"] {
  return (["drums", "bass", "chords"] as const).filter((role) => mutes.muted.has(`band.${role}`));
}

/** The workbench's starting mutes for a sketch's stored Band mutes. */
export function muteMapOf(band: SketchBand | null): MuteMap {
  return { muted: new Set((band?.mutes ?? []).map((m) => `band.${m}`)), solo: null };
}

// --- lint: locked tools are hints; imported code is checked strictly ---------------------------------

export function studioLint(
  unlocked: LintContext["unlocked"],
  meter: MeterId,
  key: KeySpec | null,
): LintContext {
  return { profile: "studio", unlocked, allowPreview: false, meter, key };
}

/**
 * The strict profile for code the learner did not type on this machine (contracts §11.3): the Band profile
 * is strict and allows every tool, so only safety and syntax decide. Labels outside the Band's three are
 * not a safety matter and are ignored.
 */
export function strictLint(meter: MeterId, key: KeySpec | null): LintContext {
  return { profile: "band", unlocked: new Set(), allowPreview: true, meter, key };
}

export interface StrictVerdict {
  safe: boolean;
  /** What stops it from running: safety and syntax findings only. */
  problems: { line: number; message: string; id: string }[];
}

/** Safety and syntax errors (`lint.base.*`, `lint.strict.*`, `eval.*`) block; nothing else does. */
export function strictVerdict(result: LintResult): StrictVerdict {
  const problems = result.diagnostics
    .filter((d) => d.severity === "error" && /^(lint|eval)\./.test(d.id))
    .map((d) => ({ line: d.line, message: d.message, id: d.id }));
  return { safe: problems.length === 0, problems };
}

export function needsReview(v: Pick<SketchVersion, "flags"> | null | undefined): boolean {
  return v?.flags.reviewBeforeRun === true;
}

export interface LockedHint {
  id: string;
  /** The code form from the toolbox (`.gain(x)`). */
  code: string;
  kind: ToolEntry["kind"];
  /** The session(s) that unlock it (`U01.L02`, `U10.L09 or A1.L04`): data, never shown. */
  at: string;
  /** Those sessions by title, quoted ("“Rests and accents”", "“Echoes” or “Space”"); null if one is untitled. */
  atTitle: string | null;
  /** 1-based lines where it is used. */
  lines: number[];
}

/** One hint per locked tool the code uses, in order of first use: "unlocks at …" (never a block). */
export function lockedHints(
  result: LintResult | null,
  toolbox: readonly ToolEntry[],
  titles: ReadonlyMap<string, string>,
): LockedHint[] {
  if (!result) return [];
  const byId = new Map(toolbox.map((t) => [t.id as string, t]));
  const hints = new Map<string, LockedHint>();
  for (const d of result.diagnostics) {
    if (!/^code\.locked-/.test(d.id)) continue;
    const id = String(d.params.id ?? "");
    const entry = byId.get(id);
    if (!entry) continue;
    const at = String(d.params.at ?? siteOf(entry));
    const prev = hints.get(id);
    if (prev) {
      if (!prev.lines.includes(d.line)) prev.lines.push(d.line);
      continue;
    }
    hints.set(id, {
      id,
      code: entry.code,
      kind: entry.kind,
      at,
      atTitle: sitesTitle(at, titles),
      lines: [d.line],
    });
  }
  return [...hints.values()];
}

/** "U10.L09 or A1.L04" by title; a capstone's session ("C1.S1") by its capstone's title. */
function sitesTitle(at: string, titles: ReadonlyMap<string, string>): string | null {
  const named = at.split(" or ").map((s) => titles.get(s) ?? titles.get(s.replace(/\.S\d+$/, "")));
  return named.every((t) => t !== undefined) ? named.map((t) => `“${t}”`).join(" or ") : null;
}

function siteOf(t: Pick<ToolEntry, "unlock">): string {
  const at = t.unlock.at;
  return Array.isArray(at) ? (at[0] ?? "") : at;
}

// --- versions -----------------------------------------------------------------------------------------

export interface VersionDraft {
  code: string;
  bpm: number | null;
  meter: MeterId;
  key: KeySpec | null;
  band: SketchBand | null;
  lockedTools: string[];
  note: string | null;
  ranOk: boolean;
  sessionId: string | null;
}

export function versionBody(d: VersionDraft): SketchVersionCreate {
  return {
    sessionId: d.sessionId,
    code: d.code,
    bpm: d.bpm,
    meter: d.meter,
    key: d.key,
    analysis: null,
    note: d.note,
    tutorAssisted: false,
    band: d.band,
    flags: { lockedTools: [...d.lockedTools], previewTools: [] },
    ranOk: d.ranOk,
  };
}

const sameKey = (a: KeySpec | null, b: KeySpec | null) =>
  (a === null && b === null) || (a !== null && b !== null && a.tonic === b.tonic && a.mode === b.mode);
const sameBand = (a: SketchBand | null, b: SketchBand | null) =>
  (a === null && b === null) ||
  (a !== null &&
    b !== null &&
    a.bandId === b.bandId &&
    a.flavour === b.flavour &&
    [...a.mutes].sort().join() === [...b.mutes].sort().join());

/** Whether the workbench differs from the latest saved version (code, key, meter or Band). */
export function differsFrom(
  latest: Pick<SketchVersion, "code" | "key" | "meter" | "band"> | null,
  now: { code: string; key: KeySpec | null; meter: MeterId; band: SketchBand | null },
): boolean {
  if (!latest) return true;
  return (
    latest.code !== now.code ||
    !sameKey(latest.key, now.key) ||
    (latest.meter ?? "4/4") !== now.meter ||
    !sameBand(latest.band as SketchBand | null, now.band)
  );
}

/** "v7 · Chorus idea", "v3". */
export function versionLabel(v: Pick<SketchVersion, "version" | "note">): string {
  return v.note ? `v${v.version} · ${v.note}` : `v${v.version}`;
}

/** Named versions are the ones saved with Mod+S (they carry a note). */
export function isNamed(v: Pick<SketchVersion, "note">): boolean {
  return typeof v.note === "string" && v.note.trim() !== "";
}

/** "just now", "4 min ago", "3 h ago", then the date. */
export function sinceText(iso: string, now: number, formatDate: (iso: string) => string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return formatDate(iso);
}

// --- liner flags, export ----------------------------------------------------------------------------

/** Liner-note lines a version carries (contracts §3.1 rule 4, §5.10 rule 5, §11.3). */
export function linerFlags(
  v: Pick<SketchVersion, "flags" | "band" | "tutorAssisted"> | null,
  toolbox: readonly ToolEntry[],
  flavourLabel: (id: string) => string,
): string[] {
  if (!v) return [];
  const out: string[] = [];
  // A tool by the name a learner reads (`toolName`), never the registry's raw code column with its editorial notes.
  const codeOf = new Map(toolbox.map((t) => [t.id as string, toolName(t).text]));
  if (v.flags.lockedTools.length > 0)
    out.push(
      `Uses tools not yet unlocked: ${v.flags.lockedTools.map((id) => codeOf.get(id) ?? id).join(", ")}`,
    );
  if (v.band) out.push(`Band: Oak (${flavourLabel(v.band.flavour)} style)`);
  if (v.tutorAssisted) out.push("Tutor-assisted version");
  if (v.flags.reviewBeforeRun) out.push("Imported: review before running");
  return out;
}

/** A file name for the export: `sketch-007-v4.js`. */
export function exportFileName(title: string, version: number): string {
  const slug =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "sketch";
  return `${slug}-v${version}.js`;
}

/** The exported text: a comment header (title, version, date, liner flags), then the code as it is. */
export function exportText(
  sketch: Pick<Sketch, "title">,
  v: Pick<SketchVersion, "version" | "createdAt" | "code" | "key" | "meter" | "bpm">,
  flags: readonly string[],
): string {
  const facts = [
    v.key ? `${v.key.tonic} ${v.key.mode}` : null,
    v.meter,
    v.bpm ? `${Math.round(v.bpm)} BPM` : null,
  ].filter(Boolean);
  const header = [
    `// ${sketch.title} (v${v.version}, ${v.createdAt.slice(0, 10)})`,
    ...(facts.length > 0 ? [`// ${facts.join(" · ")}`] : []),
    ...flags.map((f) => `// ${f}`),
    "// Made in Oak with Strudel (strudel.cc).",
  ];
  return `${header.join("\n")}\n\n${v.code.replace(/\s+$/, "")}\n`;
}

// --- the tree-ring cover ------------------------------------------------------------------------------

/** FNV-1a: a stable seed from a sketch ID. */
export function hashOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Ring {
  r: number;
  width: number;
  /** 0–2: which of the cover's three tones. */
  tone: number;
  /** Small offset of the ring's centre: tree rings are never quite concentric. */
  dx: number;
  dy: number;
}

/**
 * One ring per version (a sketch grows a ring each time it is saved), at most 12, inside a cover of `size`
 * units. Widths vary with the seed; the outermost ring is the current version.
 */
export function ringsOf(seed: string, versions: number, size = 64): Ring[] {
  const n = Math.max(1, Math.min(12, Math.floor(versions)));
  let h = hashOf(seed);
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    return (h % 1000) / 1000;
  };
  // Between the heartwood (r 5) and the bark (r 29 of 64).
  const maxR = size / 2 - 6;
  const minR = 7;
  const rings: Ring[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    rings.push({
      r: minR + (maxR - minR) * (n === 1 ? 0.55 : 0.15 + 0.85 * t),
      width: 1 + next() * 2.2,
      tone: Math.floor(next() * 3) % 3,
      dx: (next() - 0.5) * 2.4 * t,
      dy: (next() - 0.5) * 2.4 * t,
    });
  }
  return rings;
}

/** A harmony view the sketch could use but the learner has not unlocked yet (Wave 4: hint, never block). */
export interface HarmonyViewHint {
  id: string;
  what: string;
  at: string;
}

/**
 * The harmony views still locked for a sketch that plays chords: chord names (U05.L09), Roman
 * numerals (U06.L02), function bands, chord tones and the lead sheet. Nothing when the sketch has no chords.
 */
export function harmonyViewHints(
  hasChords: boolean,
  unlocked: ReadonlySet<string>,
  sites: (id: string) => string | null,
): HarmonyViewHint[] {
  if (!hasChords) return [];
  const rows: [string, string][] = [
    // Wave 5 (c14): the chord-symbol lens opens with its own row (U05.L09 since contracts 1.6), no longer `tb.arp`.
    ["tb.feature.chord-symbols", "Chord names on the roll and the staff"],
    ["tb.feature.rn", "Roman numerals"],
    ["tb.lens.function", "Function bands"],
    ["tb.lens.chord-tones", "Chord tones in the melody"],
    ["tb.feature.leadsheet", "The lead sheet"],
  ];
  return rows.flatMap(([id, what]) => {
    if (unlocked.has(id)) return [];
    const at = sites(id);
    return at ? [{ id, what, at }] : [];
  });
}

/** What a sketch does that the Wave 5 views can show (read from its analysed model and its code). */
export interface SketchSoundFacts {
  /** It plays its tracks through `arrange()` (sections). */
  sections: boolean;
  /** Its code asks for Oak's scope (`.scope()` / `.fscope()`). */
  scope: boolean;
  /** It sets a filter, an envelope or a delay (the probes). */
  filter: boolean;
  envelope: boolean;
}

/** The facts of a code, without running it: sections from the model, the sound controls from the text. */
export function soundFactsOf(code: string, hasSections: boolean): SketchSoundFacts {
  return {
    sections: hasSections,
    scope: /\.f?scope\(\s*\)/.test(code),
    filter: /\.(lpf|hpf|bpf|cutoff|hcutoff|bandf)\(/.test(code),
    envelope: /\.(attack|decay|sustain|release)\(/.test(code),
  };
}

/**
 * Wave 5: the form and sound views a sketch could use, still locked — the section ribbon and the form map
 * (tb.lens.form), Oak's scope (tb.scope), the filter curve (tb.lpf) and the envelope's shape (tb.adsr). A hint
 * with the session that opens each, never a block (the sketch plays as it is).
 */
export function formSoundHints(
  facts: SketchSoundFacts,
  unlocked: ReadonlySet<string>,
  sites: (id: string) => string | null,
): HarmonyViewHint[] {
  const rows: [boolean, string, string][] = [
    [facts.sections, "tb.lens.form", "The section ribbon and the form map"],
    [facts.scope, "tb.scope", "Oak's scope panel"],
    [facts.filter, "tb.lpf", "The filter's curve"],
    [facts.envelope, "tb.adsr", "The envelope's shape"],
  ];
  return rows.flatMap(([wanted, id, what]) => {
    if (!wanted || unlocked.has(id)) return [];
    const at = sites(id);
    return at ? [{ id, what, at }] : [];
  });
}

/** Wave 5: one line saying how to reach a view the sketch can already use (unlocked, not obvious). */
export function formSoundTips(facts: SketchSoundFacts, unlocked: ReadonlySet<string>): string[] {
  const out: string[] = [];
  if (facts.sections && unlocked.has("tb.lens.form"))
    out.push("Click a section on the ribbon to loop it; Shift+E opens the form map and its energy curve.");
  if ((facts.filter || facts.envelope) && unlocked.has("tb.scope") && !facts.scope)
    out.push("Shift+W opens the scope: it draws the wave and the curve of your filter or envelope.");
  return out;
}

// --- Wave 6: sevenths, rhythm II, modes and key changes in the Studio (hint, never block) ----------------------

/** The modes a sketch's key can be set to: major and minor always, each colour mode once its scale is unlocked. */
const MODE_ROWS: readonly [KeySpec["mode"], string | null][] = [
  ["major", null],
  ["minor", null],
  ["mixolydian", "scale.mixolydian"],
  ["dorian", "scale.dorian"],
  ["lydian", "scale.lydian"],
  ["phrygian", "scale.phrygian"],
];
export function studioModes(
  unlocked: ReadonlySet<string>,
  current?: KeySpec["mode"] | null,
): KeySpec["mode"][] {
  const out = MODE_ROWS.filter(([m, tool]) => tool === null || unlocked.has(tool) || m === current).map(
    ([m]) => m,
  );
  // A key the sketch already has (a harmonic minor from a Make) stays selectable.
  return current && !out.includes(current) ? [...out, current] : out;
}

/** The odd meters `tb.meter.odd` opens (R2.L01: 5/4 written, 7/8 heard; R2.L02: 7/8 and 9/8 as 2+2+2+3). */
export const ODD_METERS: readonly MeterId[] = ["5/4", "5/8", "7/8", "9/8i"];

/**
 * The meters a sketch can be set to: 12/8 joins 6/8 once the compound meters are taught (U13.L04), the odd meters
 * once R2.L01 opens their tempo lines (`tb.meter.odd`). A meter the sketch already has stays selectable.
 */
export function studioMeters(unlocked: ReadonlySet<string>, current?: MeterId | null): MeterId[] {
  const out: MeterId[] = [...STUDIO_METERS];
  if (unlocked.has("tb.meter.compound") || current === "12/8") out.push("12/8");
  if (unlocked.has("tb.meter.odd")) out.push(...ODD_METERS);
  return current && !out.includes(current) ? [...out, current] : out;
}

/** How the meter menu names a meter: an odd meter with its grouping ("7/8 (2+2+3)", "9/8 (2+2+2+3)"). */
export function meterLabel(m: MeterId): string {
  const groups: Partial<Record<MeterId, string>> = {
    "5/4": "5/4 (3+2)",
    "5/8": "5/8 (2+3)",
    "7/8": "7/8 (2+2+3)",
    "9/8i": "9/8 (2+2+2+3)",
  };
  return groups[m] ?? m;
}

/** What a sketch does that the Wave 6 lenses can show (read from its analysed model). */
export interface SketchMusicFacts {
  /** It plays a seventh chord. */
  sevenths: boolean;
  /** It changes key (a patterned `.scale()`). */
  keyChange: boolean;
  /** It is in a compound meter, or plays triplets. */
  beatGrid: boolean;
  /** A line comes in ahead of the beat (`.early()`). */
  pushes: boolean;
}

/** The facts of an analysed sketch (`WorkbenchModel.colour`). */
export function musicFactsOf(
  colour:
    | {
        harmony: { chords: readonly { seventh: unknown }[] } | null;
        keys: readonly unknown[];
        rhythm: { grid: unknown; pushes: { size: number } } | null;
      }
    | null
    | undefined,
): SketchMusicFacts {
  return {
    sevenths: (colour?.harmony?.chords ?? []).some((c) => c.seventh !== null),
    keyChange: (colour?.keys.length ?? 0) > 1,
    beatGrid: (colour?.rhythm?.grid ?? null) !== null,
    pushes: (colour?.rhythm?.pushes.size ?? 0) > 0,
  };
}

/**
 * Wave 6: the lenses a sketch could use, still locked: guide tones (with the seventh chords, U12.L01) and the beat
 * grid (compound meters at U13.L04, triplets at U13.L05, pushes at U13.L01). A hint with the session that opens
 * each, never a block: the sketch plays as it is, and its sevenths are written as triads until then.
 */
export function musicLensHints(
  facts: SketchMusicFacts,
  unlocked: ReadonlySet<string>,
  sites: (id: string) => string | null,
): HarmonyViewHint[] {
  const has = (ids: readonly string[]) => ids.some((id) => unlocked.has(id));
  const rows: [boolean, readonly string[], string][] = [
    [facts.sevenths, ["chord.seventh"], "Guide tones: the 3rd and 7th of each chord, and their line"],
    [facts.pushes, ["tb.early", "tb.late"], "Pushes drawn against the beat"],
    [facts.beatGrid, ["tb.meter.compound", "tb.ply"], "The beat grid: counts in 6/8, triplets in thirds"],
  ];
  return rows.flatMap(([wanted, ids, what]) => {
    if (!wanted || has(ids)) return [];
    const id = ids[0] as string;
    const at = sites(id);
    return at ? [{ id, what, at }] : [];
  });
}

/** Wave 6: one line saying how to reach a lens the sketch can already use. */
export function musicLensTips(facts: SketchMusicFacts, unlocked: ReadonlySet<string>): string[] {
  const out: string[] = [];
  if (facts.sevenths && unlocked.has("chord.seventh"))
    out.push("Shift+I shows the guide tones: each chord's 3rd and 7th, joined across the changes.");
  if (facts.keyChange && unlocked.has("tb.scale.patterned"))
    out.push("The ribbon over the roll names the key bar by bar; Shift+J hides it.");
  if (
    (facts.beatGrid && (unlocked.has("tb.meter.compound") || unlocked.has("tb.ply"))) ||
    (facts.pushes && (unlocked.has("tb.early") || unlocked.has("tb.late")))
  )
    out.push("Shift+V shows the beat grid: the counts over the roll, and each push against its beat.");
  return out;
}

// --- Wave 7: the advanced tracks' lenses (docs/design/wave7.md §4.2) -------------------------------------------

/** What a sketch does that each Wave 7 lens can show (read from its analysed model's `track`). */
export type SketchTrackFacts = Record<TrackLensId, boolean>;

export const NO_TRACK_FACTS: SketchTrackFacts = {
  tensions: false,
  voicings: false,
  chordScales: false,
  clave: false,
  polyLanes: false,
  microtiming: false,
  registers: false,
  density: false,
};

/** The facts of an analysed sketch (`WorkbenchModel.track` and its chords). */
export function trackFactsOf(
  track:
    | {
        tensions: { size: number };
        voicings: readonly unknown[];
        regions: readonly { scale: string | null; jazz: string }[];
        clave: unknown;
        poly: unknown;
        micro: { marks: { size: number } };
        registers: { parts: readonly unknown[]; clashes: readonly unknown[] } | null;
        density: readonly unknown[] | null;
      }
    | null
    | undefined,
): SketchTrackFacts {
  if (!track) return NO_TRACK_FACTS;
  return {
    tensions: track.tensions.size > 0,
    voicings: track.voicings.length > 0,
    // Changes to read scales over: two chords or more, each with a scale.
    chordScales:
      track.regions.some((r) => r.scale !== null) && new Set(track.regions.map((r) => r.jazz)).size >= 2,
    clave: track.clave !== null,
    polyLanes: track.poly !== null,
    microtiming: track.micro.marks.size > 0,
    // Worth a look when parts crowd each other low down.
    registers: (track.registers?.parts.length ?? 0) >= 2 && (track.registers?.clashes.length ?? 0) > 0,
    density: track.density !== null,
  };
}

export const sameTrackFacts = (a: SketchTrackFacts, b: SketchTrackFacts): boolean =>
  (Object.keys(a) as TrackLensId[]).every((k) => a[k] === b[k]);

/** What each lens would show, as a hint says it before its lesson. */
const TRACK_LENS_WHAT: Readonly<Record<TrackLensId, string>> = {
  tensions: "Tensions: the 9, 11 and 13 your tune plays over each chord",
  voicings: "Voicings: shell, rootless or drop-2 over each chord you voice by hand",
  chordScales: "Chord-scales: a common scale for each chord",
  clave: "The clave's two-bar grid behind the roll, its direction named",
  polyLanes: "Pulse lanes for the cross-rhythm",
  microtiming: "Microtiming: how far each note sits from the grid, in milliseconds",
  registers: "Register bands and each part's range on the spectrum",
  density: "The density of each section",
};

/** How to reach a lens the sketch can already use. */
const TRACK_LENS_TIP: Readonly<Record<TrackLensId, string>> = {
  tensions: "Shift+X names the tensions of your tune over each chord.",
  voicings: "The Voicings switch labels each chord you voice by hand: shell, rootless A or B, drop-2.",
  chordScales: "Shift+Q writes a common chord-scale under each chord.",
  clave: "The Clave switch draws the clave's grid behind the roll.",
  polyLanes: "The Pulse lanes switch draws a lane for each pulse.",
  microtiming: "The Microtiming switch shows how far each note sits from the grid, in milliseconds.",
  registers: "With the spectrum open (Shift+Y), the Registers switch shows where each part sits.",
  density: "Shift+D shows how busy each section is.",
};

/**
 * Wave 7: the lenses a sketch could use, not open yet: a hint with the lesson that opens each (hint, never a block;
 * the sketch plays as it is). Opened lenses give a one-line tip instead (`trackLensTips`).
 */
export function trackLensHints(
  facts: SketchTrackFacts,
  open: Readonly<Record<TrackLensId, boolean>>,
  lessonOf: (id: TrackLensId) => string | null,
): HarmonyViewHint[] {
  return (Object.keys(facts) as TrackLensId[]).flatMap((id) => {
    if (!facts[id] || open[id]) return [];
    const at = lessonOf(id);
    return at ? [{ id: `lens.${id}`, what: TRACK_LENS_WHAT[id], at }] : [];
  });
}

/**
 * Whether the learner has started the side track a lesson belongs to ("J2.L03" is the jazz track "J"): a lesson of
 * that track in progress or done. A track lens's hint waits for this, so a learner who never opened a track is not
 * told about its jargon on every sketch.
 */
export function trackStarted(
  progress: { lessons: readonly { lessonId: string; status: string }[] } | null | undefined,
): (lessonId: string) => boolean {
  const trackOf = (id: string) => /^([A-Z]+)[\d.]/.exec(id)?.[1] ?? null;
  const started = new Set(
    (progress?.lessons ?? [])
      .filter((l) => l.status === "in_progress" || l.status === "completed")
      .map((l) => trackOf(l.lessonId))
      .filter((t): t is string => t !== null),
  );
  return (lessonId) => {
    const t = trackOf(lessonId);
    return t !== null && started.has(t);
  };
}

export function trackLensTips(
  facts: SketchTrackFacts,
  open: Readonly<Record<TrackLensId, boolean>>,
): string[] {
  return (Object.keys(facts) as TrackLensId[]).flatMap((id) =>
    facts[id] && open[id] ? [TRACK_LENS_TIP[id]] : [],
  );
}
