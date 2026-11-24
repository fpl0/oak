// A Band that follows the learner's song form (Wave 5, U09 on; contracts §6.3 and §5.10). Band code written in
// sections keeps one `arrange()` per labelled track, exactly as the learner's code does (STYLE §10):
//
//   const drumsVerse = s("bd ~ sd ~, hh*8")
//   const drumsChorus = s("bd ~ sd ~, oh*4, ~ tb ~ tb")
//   drums: arrange([4, drumsVerse], [4, drumsChorus])
//
// The code is valid Strudel on its own (content CI evaluates and lints it as written, and a learner with no
// sections hears the Band's own form). When the learner's code has sections, every Band `arrange()` is rewritten
// to the learner's section list: the same order and the same bar counts, each section played by the Band's
// section of the same type (`chorus2` is a chorus), so a Band chorus always lands under the learner's chorus.
// Reading is static (no evaluation) and mirrors the grader's `sectionsFromAst` convention: section names come
// from `<role><Section>` identifiers, `silence` rests, and the tracks must agree or the Band keeps its own form.
import { stripComments } from "./comments.ts";

export interface ArrangeSection {
  /** The identifier in the code (`melChorus2`), or `silence`. */
  ident: string;
  /** The section type (`chorus`), or null for `silence`. */
  type: string | null;
  bars: number;
}

/** `melChorus2` → `chorus`; `verse` → `verse`; `silence` → null (contracts §6.3 item 2). */
export function sectionTypeOf(ident: string): string | null {
  if (ident === "silence") return null;
  const m = /^[a-z][a-z0-9]*([A-Z].*)$/.exec(ident);
  const name = (m ? (m[1] as string) : ident).replace(/\d+$/, "");
  return name.length > 0 ? name.toLowerCase() : null;
}

export interface ArrangeCall {
  /** Offsets of `arrange` and of the closing parenthesis (exclusive). */
  start: number;
  end: number;
  sections: ArrangeSection[] | null;
}

const NUMBER = /^\d+(?:\.\d+)?$/;
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** The index just past the bracket that closes the one at `open`, skipping strings; -1 if none. */
function closeOf(text: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i] as string;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Splits a bracket's inside at top-level commas. */
function topLevelItems(inner: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i] as string;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      out.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  out.push(inner.slice(start));
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Every `arrange(…)` call in comment-stripped code, with its sections when each is `[bars, identifier]`. */
export function arrangeCalls(text: string): ArrangeCall[] {
  const out: ArrangeCall[] = [];
  const re = /(^|[^A-Za-z0-9_$.])arrange\s*\(/g;
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + (m[1] as string).length;
    const open = text.indexOf("(", start);
    const end = closeOf(text, open);
    if (end < 0) continue;
    let sections: ArrangeSection[] | null = [];
    for (const item of topLevelItems(text.slice(open + 1, end - 1))) {
      const inner = /^\[(.*)\]$/s.exec(item);
      const parts = inner ? topLevelItems(inner[1] as string) : [];
      const [bars, ident] = parts;
      if (
        parts.length !== 2 ||
        !bars ||
        !ident ||
        !NUMBER.test(bars) ||
        !IDENT.test(ident) ||
        Number(bars) <= 0
      ) {
        sections = null;
        break;
      }
      sections.push({ ident, type: sectionTypeOf(ident), bars: Number(bars) });
    }
    out.push({ start, end, sections: sections && sections.length > 0 ? sections : null });
  }
  return out;
}

/**
 * The learner's sections: one entry per section, its type from the first track that plays it (a track may rest
 * with `silence`), its identifier a numbered variant's when any track has one. Null when the code has no
 * `arrange()`, when one cannot be read statically, or when two arranged tracks disagree about the number or lengths
 * of the sections (`form.inconsistent-arrange`).
 */
export function learnerSectionsOf(code: string): ArrangeSection[] | null {
  const calls = arrangeCalls(stripComments(code));
  if (calls.length === 0) return null;
  const lists = calls.map((c) => c.sections);
  if (lists.some((l) => l === null)) return null;
  const first = lists[0] as ArrangeSection[];
  for (const l of lists as ArrangeSection[][]) {
    if (l.length !== first.length || l.some((s, i) => s.bars !== first[i]?.bars)) return null;
  }
  return first.map((s, i) => {
    const at = (lists as ArrangeSection[][]).map((l) => l[i] as ArrangeSection);
    const typed = at.find((x) => x.type !== null);
    if (!typed) return { ...s };
    // A numbered variant (`melChorus2`) on any track names the section, as the grader's `sectionsFromAst` keeps it:
    // a drum track repeating its plain `drumsChorus` does not hide the melody's second chorus.
    const numbered = at.find((x) => x.type === typed.type && /\d$/.test(x.ident));
    return { ...(numbered ?? typed) };
  });
}

/** Section types that stand in for each other when the Band has no section of the learner's type. */
const KIN: Readonly<Record<string, readonly string[]>> = {
  chorus: ["hook", "refrain", "drop"],
  hook: ["chorus", "refrain"],
  refrain: ["chorus", "hook"],
  drop: ["chorus", "hook"],
  prechorus: ["build", "bridge", "verse"],
  build: ["prechorus", "bridge"],
  bridge: ["middle", "breakdown", "verse"],
  breakdown: ["bridge", "intro", "verse"],
  intro: ["verse"],
  outro: ["verse", "intro"],
  solo: ["chorus", "verse"],
};

/** The Band identifier that plays a learner section of `type`: same type, then a kin type, then its first. */
function bandIdentFor(type: string | null, band: readonly ArrangeSection[]): string {
  const playing = band.filter((s) => s.type !== null);
  const pool = playing.length > 0 ? playing : band;
  const fallback = (pool[0] as ArrangeSection).ident;
  if (type === null) return fallback;
  const exact = pool.find((s) => s.type === type);
  if (exact) return exact.ident;
  for (const kin of KIN[type] ?? []) {
    const k = pool.find((s) => s.type === kin);
    if (k) return k.ident;
  }
  return fallback;
}

/**
 * Band code with every readable `arrange()` following the learner's sections (see the file comment). The Band's
 * own form stays when the learner has no sections, or when the Band code has none.
 */
export function followLearnerForm(bandCode: string, learnerCode: string): string {
  const learner = learnerSectionsOf(learnerCode);
  if (!learner) return bandCode;
  const stripped = stripComments(bandCode);
  const calls = arrangeCalls(stripped).filter((c) => c.sections !== null);
  if (calls.length === 0) return bandCode;
  let out = "";
  let at = 0;
  for (const call of calls) {
    const band = call.sections as ArrangeSection[];
    const args = learner.map((s) => `[${s.bars}, ${bandIdentFor(s.type, band)}]`).join(", ");
    out += `${bandCode.slice(at, call.start)}arrange(${args})`;
    at = call.end;
  }
  return out + bandCode.slice(at);
}

/** Total bars of the learner's form, or null without sections (the preloader's horizon). */
export function formBarsOf(code: string): number | null {
  const s = learnerSectionsOf(code);
  return s ? s.reduce((n, x) => n + x.bars, 0) : null;
}
