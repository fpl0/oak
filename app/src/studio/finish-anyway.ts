// Oak 2.0 W4 F6 "Finish it anyway" (DeSantis, Fail Better; Arranging as a Subtractive Process): a piece about to be
// abandoned is finished anyway. Fill it all (every part plays in every section), carve (take parts out of sections),
// then the Shelf. Every step writes plain Strudel the learner can read and undo: a part not in sections yet becomes a
// const and an `arrange()` over the sections the piece already has; a part taken out of a section is
// `silence /* <its const> */`, so ticking it again brings the const back. Pure: tested in finish-anyway.test.ts.
import { type CodeLine, constDecls, labelledLines } from "@oak/api";
import { sectionsFromAst } from "@oak/grader";

export type ArrangementState = "none" | "half" | "whole";

const ARRANGE = /\barrange\s*\(/;
const LABEL_HEAD = /^\s*[A-Za-z_$][\w$]*\s*:(?!:)\s*/;
const parts = (code: string): CodeLine[] => labelledLines(code).filter((l) => !l.muted);

/** Whether the unmuted parts are in sections: none of them, some of them, or all of them (no part: none). */
export function arrangementState(code: string): ArrangementState {
  const lines = parts(code);
  const arranged = lines.filter((l) => ARRANGE.test(l.text)).length;
  if (arranged === 0) return "none";
  return arranged === lines.length ? "whole" : "half";
}

/**
 * Whether the capstone workspace shows its "Finish it anyway" card: not released, half arranged, and not the
 * untouched starter (the owner's call, W5 item 7: the book's problem shows late, so a starter that comes half
 * arranged is no reason to offer it).
 */
export function showsCapstoneFinishCard(o: {
  liveCode: string;
  starter: string;
  released: boolean;
}): boolean {
  return !o.released && arrangementState(o.liveCode) === "half" && o.liveCode.trim() !== o.starter.trim();
}

// --- reading arrange() ---------------------------------------------------------------------------------------

interface Entry {
  bars: number;
  /** The entry's pattern, as written, with its offsets into the whole code. */
  expr: string;
  from: number;
  to: number;
}

/**
 * Where a skippable stretch at `i` ends: a string, a template or a comment (so their brackets and commas never
 * count), or `i` itself when there is none.
 */
function skipOpaque(t: string, i: number): number {
  const c = t[i];
  if (c === '"' || c === "'" || c === "`") {
    let j = i + 1;
    while (j < t.length && t[j] !== c) j += t[j] === "\\" ? 2 : 1;
    return j + 1;
  }
  if (c === "/" && t[i + 1] === "*") {
    const end = t.indexOf("*/", i + 2);
    return end < 0 ? t.length : end + 2;
  }
  if (c === "/" && t[i + 1] === "/") {
    const end = t.indexOf("\n", i);
    return end < 0 ? t.length : end;
  }
  return i;
}

/** The index of the bracket closing the one at `open`, or -1. */
function closing(t: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < t.length) {
    const skip = skipOpaque(t, i);
    if (skip !== i) {
      i = skip;
      continue;
    }
    const c = t[i] as string;
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** The first top-level comma in `t[from, to)`, or -1. */
function topComma(t: string, from: number, to: number): number {
  let depth = 0;
  let i = from;
  while (i < to) {
    const skip = skipOpaque(t, i);
    if (skip !== i) {
      i = skip;
      continue;
    }
    const c = t[i] as string;
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) return i;
    i++;
  }
  return -1;
}

/** The entries of a part's first `arrange(…)`, or `null` when it has none or one this reader cannot follow. */
function entriesOf(line: CodeLine): Entry[] | null {
  const m = ARRANGE.exec(line.text);
  if (!m) return null;
  const t = line.text;
  const open = m.index + m[0].length - 1;
  const close = closing(t, open);
  if (close < 0) return null;
  const out: Entry[] = [];
  let i = open + 1;
  while (i < close) {
    const c = t[i] as string;
    if (/\s|,/.test(c)) {
      i++;
      continue;
    }
    if (c !== "[") return null;
    const end = closing(t, i);
    if (end < 0 || end > close) return null;
    const comma = topComma(t, i + 1, end);
    if (comma < 0) return null;
    const bars = Number(t.slice(i + 1, comma).trim());
    if (!Number.isFinite(bars) || bars <= 0) return null;
    const raw = t.slice(comma + 1, end);
    const lead = raw.length - raw.trimStart().length;
    const expr = raw.trim();
    const from = line.from + comma + 1 + lead;
    out.push({ bars, expr, from, to: from + expr.length });
    i = end + 1;
  }
  return out.length > 0 ? out : null;
}

const SILENCE = /^silence\b/;
const CARVED = /^silence\s*\/\*\s*([\s\S]+?)\s*\*\/$/;

// --- the carve grid ------------------------------------------------------------------------------------------

/** `plays[part][section]`: whether the part plays in that section. */
export interface SectionGrid {
  parts: string[];
  sections: { bars: number }[];
  plays: boolean[][];
}

/** The parts × sections of a piece fully in sections with one bar list; `null` otherwise. */
export function sectionGrid(code: string): SectionGrid | null {
  if (arrangementState(code) !== "whole") return null;
  const lines = parts(code);
  const read = lines.map((l) => entriesOf(l));
  const first = read[0];
  if (!first || read.some((e) => e === null)) return null;
  const bars = first.map((e) => e.bars);
  for (const e of read as Entry[][])
    if (e.length !== bars.length || e.some((x, i) => x.bars !== bars[i])) return null;
  return {
    parts: lines.map((l) => l.label),
    sections: bars.map((b) => ({ bars: b })),
    plays: (read as Entry[][]).map((e) => e.map((x) => !SILENCE.test(x.expr))),
  };
}

/**
 * One cell of the grid as code. `plays: false` turns the entry's pattern into `silence /* <pattern> *\/`; `true`
 * brings the remembered pattern back. Every other byte is unchanged; an unknown part or section, a cell already as
 * asked, or a silence with nothing remembered leaves the code as it is.
 */
export function carveCell(code: string, part: string, section: number, plays: boolean): string {
  const line = parts(code).find((l) => l.label === part);
  const entry = line ? entriesOf(line)?.[section] : undefined;
  if (!entry) return code;
  const silent = SILENCE.test(entry.expr);
  let next: string;
  if (!plays) {
    if (silent || entry.expr.includes("*/")) return code;
    next = `silence /* ${entry.expr} */`;
  } else {
    const m = CARVED.exec(entry.expr);
    if (!m) return code;
    next = m[1] as string;
  }
  return `${code.slice(0, entry.from)}${next}${code.slice(entry.to)}`;
}

// --- fill the rest -------------------------------------------------------------------------------------------

/** `drumsChorus2` → `Chorus2`: the section part of a const name (STYLE §10 `<role><Section>`), as the grader reads it. */
const SECTION_SUFFIX = /^[a-z][a-z0-9]*?([A-Z][A-Za-z0-9]*)$/;
const suffixOf = (expr: string): string | null => {
  const name = CARVED.exec(expr)?.[1] ?? expr;
  return SECTION_SUFFIX.exec(name)?.[1] ?? null;
};

/**
 * Fill it all for a half-arranged piece: each unmuted part not in sections plays in every section, with the bar
 * list of the parts already in sections. Where the part was, it becomes one const per section name those parts use
 * (`<label><Section>`, as STYLE §10 names them, e.g. `bassA` and `bassB` beside `drumsA` and `drumsB`; a taken name
 * gets a number), each holding the part's pattern as written, so every section can then be changed on its own; the
 * consts it uses stay where they are. Then `label: arrange([b1, labelA], [b2, labelB], …)` at the end.
 *
 * The names follow the sections because the grader names a section after its consts: one `bassAll` beside
 * `drumsA`/`drumsB` reads as a section "all" in one part and "a" in another, an inconsistent `arrange()` that the
 * lint refuses to run (`form.inconsistent-arrange`). Where no part's const has a section name (`arrange([4, a], …)`),
 * the section takes the grader's own name for it (`a` → `bassA`); a section the grader names nothing gets `S<n>`.
 */
export function fillTheRest(
  code: string,
): { code: string } | { error: "no-sections" | "nothing-to-fill" | "mixed-sections" } {
  const state = arrangementState(code);
  if (state === "none") return { error: "no-sections" };
  if (state === "whole") return { error: "nothing-to-fill" };
  const lines = parts(code);
  const arranged = lines.filter((l) => ARRANGE.test(l.text)).map((l) => entriesOf(l));
  const first = arranged[0];
  if (!first || arranged.some((e) => e === null)) return { error: "mixed-sections" };
  const bars = first.map((e) => e.bars);
  for (const e of arranged as Entry[][])
    if (e.length !== bars.length || e.some((x, i) => x.bars !== bars[i])) return { error: "mixed-sections" };
  // No entry has a `<role><Section>` name (`arrange([4, a], [4, b])`): the section's name as the grader reads it
  // (`a` → `A`, so `bassA` reads as section "a" too); `S<n>` only when the grader names it nothing (W5 S7).
  const read = sectionsFromAst(code);
  const graderTags = read !== null && "sections" in read ? read.sections.map((x) => x.tag) : [];
  const graderSuffix = (i: number): string | null => {
    const tag = graderTags[i];
    if (tag === undefined || tag === "rest" || !/^[a-z][a-z0-9]*$/.test(tag)) return null;
    return `${tag[0]?.toUpperCase()}${tag.slice(1)}`;
  };
  const suffixes = bars.map(
    (_, i) =>
      (arranged as Entry[][]).map((e) => suffixOf((e[i] as Entry).expr)).find((x) => x !== null) ??
      graderSuffix(i) ??
      `S${i + 1}`,
  );

  const taken = new Set(constDecls(code).map((d) => d.name));
  const named = lines
    .filter((l) => !ARRANGE.test(l.text))
    .map((line) => {
      const base = line.label === "$" ? "part" : line.label;
      const names = new Map<string, string>();
      for (const suffix of suffixes) {
        if (names.has(suffix)) continue;
        let name = `${base}${suffix}`;
        for (let n = 2; taken.has(name); n++) name = `${base}${suffix}${n}`;
        taken.add(name);
        names.set(suffix, name);
      }
      return { line, names, expr: line.text.replace(LABEL_HEAD, "") };
    });
  let out = code;
  for (const { line, names, expr } of [...named].reverse()) {
    const consts = [...names.values()].map((name) => `const ${name} = ${expr}`).join("\n");
    out = `${out.slice(0, line.from)}${consts}${out.slice(line.to)}`;
  }
  const added = named.map(
    ({ line, names }) =>
      `${line.label}: arrange(${bars.map((b, i) => `[${b}, ${names.get(suffixes[i] as string)}]`).join(", ")})`,
  );
  return { code: `${out.trimEnd()}\n\n${added.join("\n")}\n` };
}

// --- words ---------------------------------------------------------------------------------------------------

/** Every sentence of Finish it anyway (each one passes `isDescriptive`). */
export const FINISH_COPY = {
  open: "Finish it anyway…",
  title: "Finish it anyway",
  reason: "Finishing is practised by finishing; a piece on the Shelf stays off the album.",
  askDelete: "Before you delete it: finish it anyway?",
  askArchive: "Before you archive it: finish it anyway?",
  finish: "Finish it anyway",
  goOnDelete: "Delete it",
  goOnArchive: "Archive it",
  shelfLine:
    "A piece on the Shelf counts as finished. It stays off the album, and its lines stay in your scraps.",
  fillStep: "1. Fill it all",
  fillNone: "Every part plays in every section. Pick how many sections.",
  fillHalf: "Some parts are in sections and some are not. Fill the rest: each part plays in every section.",
  fillWhole: "Every part is already in sections.",
  fill: "Fill it all",
  fillMixed: "The parts' sections have different lengths. Give every arrange() the same sections first.",
  filled: "Filled. Play it through.",
  play: "Play it through",
  carveStep: "2. Carve",
  carveLine: "Take parts out where you want the song to breathe, then play it again.",
  playsHere: "plays here",
  carveNone: "Put every part in the same sections first, then carve here.",
  shelfStep: "3. Then the Shelf",
  titleLabel: "Title on the Shelf",
  shelve: "Put it on the Shelf",
  shelving: "Putting it on the Shelf…",
  shelved: "On the Shelf: finished, and kept off the album.",
  shelveFailed: "It could not go on the Shelf. Try again.",
  shelfFillFirst: "Fill it all first, so every part plays in every section.",
  capstoneShelf: "When it's checked, release it with “Put it on the Shelf” ticked.",
  cardLine: "Some parts are in sections and some are not. Finish it anyway: fill every section, then carve.",
  close: "Close",
} as const satisfies Readonly<Record<string, string>>;
