// Oak 2.0 W1 (S1): scraps, the pure part. A scrap is one labelled line with the consts it needs (`scrapCode`): an
// index scrap is a line of a sketch's current version, a saved scrap a line the learner kept (from a lesson, a
// sketch or a capture). "New sketch from scraps" puts 1–4 of them together as plain Strudel the learner can read:
// a second `bass` becomes `bass2` and a second `const groove` becomes `groove2`, so no part is lost when lines are
// combined (the transcriber's `withDraft` replaces a line of the same label, so it is not used here).
import {
  constDecls,
  type KeySpec,
  labelledLines,
  type MeterId,
  roleOfLabel,
  type Scrap,
  type ScrapCreate,
  type ScrapRole,
  type SketchCreate,
  scrapCode,
  tempoLineOf,
} from "@oak/api";
import { tempoLine } from "@oak/theory";

/** PLAN S1's own range: a sketch starts from one to four lines. */
export const MAX_SCRAPS_PER_SKETCH = 4;

/**
 * The tempo and meter a scrap plays at when it has none (a line saved without a tempo). The same values Oak's
 * Blank fills in (`OAK_DEFAULTS` in `../model.ts` lists them); Oak's call, never shown as a target.
 */
const FALLBACK_BPM = 90;
const FALLBACK_METER: MeterId = "4/4";

// --- identifiers outside strings and comments ------------------------------------------------------

/** `code` with string, template and comment text blanked (same length), so names are found only in code. */
function codeOnly(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i] as string;
    const next = code[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && code[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      while (i < stop) {
        out += code[i] === "\n" ? "\n" : " ";
        i++;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      out += " ";
      i++;
      while (i < n && code[i] !== c && (c === "`" || code[i] !== "\n")) {
        if (code[i] === "\\" && i + 1 < n) {
          out += " ";
          i++;
        }
        out += code[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n && code[i] === c) {
        out += " ";
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Renames identifiers read as values (not inside strings or comments, not property names after `.`). */
function renameIdentifiers(code: string, renames: ReadonlyMap<string, string>): string {
  if (renames.size === 0) return code;
  const mask = codeOnly(code);
  const hits: { at: number; name: string }[] = [];
  for (const m of mask.matchAll(/(?<![\w$])[A-Za-z_$][\w$]*(?![\w$])/g)) {
    const to = renames.get(m[0]);
    if (to === undefined) continue;
    let j = m.index - 1;
    while (j >= 0 && /\s/.test(mask[j] as string)) j--;
    if (mask[j] === "." && mask[j - 1] !== ".") continue;
    // A label (`groove: …`) is not a use of `const groove`.
    let k = m.index + m[0].length;
    while (k < mask.length && (mask[k] === " " || mask[k] === "\t")) k++;
    const lineStart = mask.lastIndexOf("\n", m.index - 1) + 1;
    if (mask[k] === ":" && mask[k + 1] !== ":" && mask.slice(lineStart, m.index).trim() === "") continue;
    hits.push({ at: m.index, name: m[0] });
  }
  let out = code;
  for (const h of hits.reverse()) {
    out = out.slice(0, h.at) + (renames.get(h.name) as string) + out.slice(h.at + h.name.length);
  }
  return out;
}

/** `bass` → `bass2`, `bass3`… (the first free one); a name that already ends in a number counts on from its stem. */
function freeName(name: string, used: ReadonlySet<string>): string {
  if (!used.has(name)) return name;
  const stem = name.replace(/(?<=[A-Za-z_$])\d+$/, "");
  for (let n = 2; ; n++) {
    const candidate = `${stem}${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** A label without its mute marks (`_bass`, `bass_` → `bass`). `$` stays `$`. */
function coreOf(label: string): { core: string; lead: string; trail: string } {
  const m = /^(_*)(.*?)(_*)$/.exec(label);
  const core = m?.[2] ?? "";
  if (!m || core === "") return { core: label, lead: "", trail: "" };
  return { core, lead: m[1] ?? "", trail: m[3] ?? "" };
}

/** Removes top-level tempo statements: the combined sketch has one, from the first pick. */
function withoutTempo(code: string): string {
  let out = code;
  for (let guard = 0; guard < 8; guard++) {
    const t = tempoLineOf(out);
    if (t === null) break;
    const at = out.indexOf(t);
    if (at < 0) break;
    out = (out.slice(0, at) + out.slice(at + t.length)).replace(/^\s*\n/, "");
  }
  return out.trim();
}

/**
 * One pick's code with its const names and labels made unique against what earlier picks used; `usedConsts` and
 * `usedLabels` gain this pick's names.
 */
function uniqueCode(code: string, usedConsts: Set<string>, usedLabels: Set<string>): string {
  let out = withoutTempo(code);
  const renames = new Map<string, string>();
  const decls = constDecls(out);
  for (const d of decls) {
    if (renames.has(d.name)) continue;
    // Free against the earlier picks, this pick's other consts and the names already given here (W5 S3: `p` → `p2`
    // must not land on this pick's own `p2`).
    const avoid = new Set(usedConsts);
    for (const o of decls) if (o.name !== d.name) avoid.add(o.name);
    for (const to of renames.values()) avoid.add(to);
    renames.set(d.name, freeName(d.name, avoid));
  }
  for (const to of renames.values()) usedConsts.add(to);
  out = renameIdentifiers(out, new Map([...renames].filter(([from, to]) => from !== to)));
  // Labels, right to left so earlier offsets stay valid.
  const lines = labelledLines(out);
  const newLabels: { from: number; label: string; to: string }[] = [];
  for (const line of lines) {
    if (line.label === "$") continue;
    const { core, lead, trail } = coreOf(line.label);
    const to = freeName(core, usedLabels);
    usedLabels.add(to);
    if (to !== core) newLabels.push({ from: line.from, label: line.label, to: `${lead}${to}${trail}` });
  }
  for (const l of newLabels.reverse()) {
    out = out.slice(0, l.from) + l.to + out.slice(l.from + l.label.length);
  }
  return out;
}

// --- sketches from scraps ------------------------------------------------------------------------

/**
 * A new sketch from 1–4 scraps, in pick order: the tempo line and meter of the first pick (90 bpm in 4/4 only when
 * it has none), the first key any pick has, then each pick's consts and line. A label already used becomes
 * `label2`, `label3`; a const name already used gets the same treatment everywhere in its scrap. A pick that must be
 * reviewed before running makes a sketch that must be reviewed. Throws `RangeError` for 0 or more than 4 picks.
 */
export function sketchFromScraps(
  scraps: readonly Scrap[],
  title: string,
  sessionId: string | null,
): SketchCreate {
  if (scraps.length === 0 || scraps.length > MAX_SCRAPS_PER_SKETCH)
    throw new RangeError(`a sketch starts from 1 to ${MAX_SCRAPS_PER_SKETCH} scraps, not ${scraps.length}`);
  const first = scraps[0] as Scrap;
  const bpm = first.bpm ?? FALLBACK_BPM;
  const meter = first.meter ?? FALLBACK_METER;
  const key: KeySpec | null = scraps.find((s) => s.key !== null)?.key ?? null;
  const usedConsts = new Set<string>();
  const usedLabels = new Set<string>();
  const parts = scraps.map((s) => uniqueCode(s.code, usedConsts, usedLabels)).filter((p) => p !== "");
  const code = `${tempoLine(bpm, meter)}\n\n${parts.join("\n\n")}\n`;
  const review = scraps.some((s) => s.reviewBeforeRun === true);
  return {
    title,
    originKind: "free",
    originId: null,
    sessionId,
    code,
    bpm,
    meter,
    key,
    analysis: null,
    note: "From scraps",
    tutorAssisted: false,
    band: null,
    flags: review
      ? { lockedTools: [], previewTools: [], reviewBeforeRun: true }
      : { lockedTools: [], previewTools: [] },
    ranOk: false,
  };
}

/** What Play runs for one scrap: its tempo line (90 bpm in 4/4 when it has none), then its code. */
export function scrapPlayCode(s: Pick<Scrap, "code" | "bpm" | "meter">): string {
  return `${tempoLine(s.bpm ?? FALLBACK_BPM, s.meter ?? FALLBACK_METER)}\n${s.code}`;
}

/** The scraps of one role ("all": every one), newest first. A scrap with no role counts as "other". */
export function scrapsOfRole(list: readonly Scrap[], role: ScrapRole | "all"): Scrap[] {
  return list
    .filter((s) => role === "all" || (s.role ?? "other") === role)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The body that saves one labelled line of `code` as a scrap: the line with the consts it uses, its label as
 * written and the role the label names. `null` when the label is not in the code.
 */
export function lineScrapBody(o: {
  code: string;
  label: string;
  sourceKind: "lesson" | "sketch";
  sourceRef: string;
  bpm: number | null;
  meter: MeterId | null;
  key: KeySpec | null;
}): ScrapCreate | null {
  const code = scrapCode(o.code, o.label);
  if (code === null) return null;
  return {
    role: roleOfLabel(o.label),
    label: o.label,
    code,
    bpm: o.bpm,
    meter: o.meter,
    key: o.key,
    sourceKind: o.sourceKind,
    sourceRef: o.sourceRef,
  };
}

// --- words ---------------------------------------------------------------------------------------

export const ROLE_FILTERS: readonly { value: ScrapRole | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "drums", label: "Drums" },
  { value: "bass", label: "Bass" },
  { value: "chords", label: "Chords" },
  { value: "tune", label: "Tune" },
  { value: "other", label: "Other" },
];

export const ROLE_WORDS: Readonly<Record<ScrapRole, string>> = {
  drums: "Drums",
  bass: "Bass",
  chords: "Chords",
  tune: "Tune",
  other: "Other",
};

/**
 * Where a scrap came from, in words: "from your sketch “Groove” v3", "from a lesson", "hummed", "tapped", "from a
 * voice memo". `sketchTitle` is the sketch's title when the panel knows it.
 */
export function scrapSourceText(
  s: Pick<Scrap, "sourceKind" | "sketchVersion">,
  sketchTitle: string | null = null,
): string {
  switch (s.sourceKind) {
    case "sketch": {
      const v = s.sketchVersion !== null ? ` v${s.sketchVersion}` : "";
      return sketchTitle ? `from your sketch “${sketchTitle}”${v}` : `from one of your sketches${v}`;
    }
    case "lesson":
      return "from a lesson";
    case "hum":
      return "hummed";
    case "tap":
      return "tapped";
    case "memo":
      return "from a voice memo";
  }
}

/** What an index scrap says where a saved one has Delete. */
export const INDEX_SCRAP_NOTE = "Goes with its sketch line";
/** What a scrap to review says instead of Play. */
export const REVIEW_SCRAP_NOTE = "Review before running";
