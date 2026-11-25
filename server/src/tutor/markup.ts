// Tutor output markup (contracts §10.7): markdown plus `[[kind:value]]` tokens, `[[reveal]]` and (Oak 2.0 W1)
// `[[later]]`, the tutor's offer to park a question on the learner's Later list.
// `parseMarkup` turns a tutor message into a typed segment list for the panel; `sanitizeMarkdown`
// is the same text made safe to store and to hand to a markdown renderer.
//
// Guarantees of the output:
//  - no raw HTML (markup-guard.ts), no images, no links except to in-app routes;
//  - code is never markdown: inline code and fenced blocks are their own segments, to be rendered
//    as text nodes. A fenced block is plain, non-playable text; playable code only ever arrives
//    as a `card` event from propose_code;
//  - an unknown or malformed token stays plain text.
// Pure; the browser uses this file as it is.
import { type Piece, serializePiece, splitMarkdown } from "./markup-guard.ts";
import type { ThreadKind } from "./types.ts";

export { escapeTags, HtmlGuard } from "./markup-guard.ts";

export type TokenKind = "deg" | "rn" | "note" | "chord" | "bars" | "tool" | "term";

export interface TokenSegment {
  type: "token";
  kind: TokenKind;
  /** Normalized value: `b3`, `V7/vi`, `F#4`, `C^7`, `3-4`, `tb.voicing`, `term.cadence`. */
  value: string;
  raw: string;
  /** chord: the lead-sheet form, e.g. `Cmaj7` for `C^7`. */
  display?: string;
  /** bars: inclusive range to loop. */
  bars?: [number, number];
  /** term: not in the learner's introduced list, so the UI badges it "preview". */
  preview?: boolean;
  /** tool: not unlocked, so the UI shows a lock. */
  locked?: boolean;
}

export type Segment =
  | { type: "text"; md: string }
  | { type: "code_inline"; code: string }
  | { type: "code_block"; lang: string | null; code: string; playable: false }
  | TokenSegment
  | { type: "reveal"; raw: string }
  | { type: "later"; raw: string };

/** Oak 2.0 W1: the threads where `[[later]]` is an offer ("Park it for later"); elsewhere it stays plain text. */
export const LATER_THREADS: ReadonlySet<ThreadKind> = new Set<ThreadKind>(["chat", "hint", "explain"]);

export interface MarkupOptions {
  /** Whether `[[reveal]]` is valid here: a hint or chat thread on a graded, unpassed step. */
  revealAllowed?: boolean;
  /** Term IDs the learner has been introduced to. Omit to leave `preview` unset. */
  introducedTerms?: ReadonlySet<string>;
  /** Tool IDs the learner has unlocked. Omit to leave `locked` unset. */
  unlockedTools?: ReadonlySet<string>;
  /**
   * Oak 2.0 W1: the thread kind of the message. `[[later]]` is kept (once) only in `chat`, `hint` and `explain`;
   * in `listening`, the reviews, or with no thread given, it stays plain text.
   */
  thread?: ThreadKind;
}

const NUMERAL = "(?:VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)";
const RN = new RegExp(
  `^[b#]?${NUMERAL}(?:°|o|ø|\\+)?(?:maj7|\\^7|m7b5|7|6|64|65|43|42|9|11|13)?(?:/[b#]?${NUMERAL})?$`,
);
/** The nine core symbols of STYLE §5 plus the extended families the toolbox can unlock. */
const CHORD =
  /^([A-G][#b]?)(m7b5|m7|m6|m9|m11|m|o7|o|aug|\^7#11|\^7|\^9|7sus|7alt|7b9|7#9|7#11|7b13|7|69|6|9|11|13|sus)?$/;
const LEAD_SHEET: Record<string, string> = {
  "^7": "maj7",
  "^9": "maj9",
  "^7#11": "maj7♯11",
  o: "°",
  o7: "°7",
  aug: "+",
  m7b5: "m7♭5",
};

function accidentals(s: string): string {
  return s.replace(/#/g, "♯").replace(/b/g, "♭");
}

function token(kind: TokenKind, value: string, raw: string, opts: MarkupOptions): TokenSegment | null {
  switch (kind) {
    case "deg":
      return /^[b#]?[1-7]$/.test(value) ? { type: "token", kind, value, raw } : null;
    case "rn":
      return RN.test(value) ? { type: "token", kind, value, raw } : null;
    case "note": {
      const m = /^([A-Ga-g])([#b]?)([0-8])$/.exec(value);
      return m
        ? { type: "token", kind, value: `${(m[1] as string).toUpperCase()}${m[2]}${m[3]}`, raw }
        : null;
    }
    case "chord": {
      const m = CHORD.exec(value);
      if (!m) return null;
      const root = m[1] as string;
      const quality = m[2] ?? "";
      const shown = LEAD_SHEET[quality] ?? quality.replace(/b(?=\d)/g, "♭").replace(/#(?=\d)/g, "♯");
      return {
        type: "token",
        kind,
        value,
        raw,
        display: `${root.charAt(0)}${accidentals(root.slice(1))}${shown}`,
      };
    }
    case "bars": {
      const m = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(value);
      if (!m) return null;
      const from = Number(m[1]);
      const to = m[2] === undefined ? from : Number(m[2]);
      return from >= 1 && to >= from ? { type: "token", kind, value, raw, bars: [from, to] } : null;
    }
    case "tool": {
      if (!/^tb\.[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)*$/.test(value)) return null;
      const seg: TokenSegment = { type: "token", kind, value, raw };
      if (opts.unlockedTools) seg.locked = !opts.unlockedTools.has(value);
      return seg;
    }
    case "term": {
      // Both `[[term:cadence]]` and the full ID `[[term:term.cadence]]` are accepted.
      const id = value.startsWith("term.") ? value : `term.${value}`;
      if (!/^term\.[a-z0-9-]+$/.test(id)) return null;
      const seg: TokenSegment = { type: "token", kind, value: id, raw };
      if (opts.introducedTerms) seg.preview = !opts.introducedTerms.has(id);
      return seg;
    }
  }
}

// A label may hold one level of brackets, so `[[x]](http://...)` is still seen as a link.
const LABEL = String.raw`\[((?:[^\[\]\n]|\[[^\[\]\n]*\])*)\]`;
// CommonMark allows whitespace (one line break included) around a destination, a destination in
// angle brackets (the guard has already turned its `<` into `&lt;`), and a title in three quote styles.
const DEST = String.raw`\(\s*((?:&lt;|<)[^>\n]*>|[^)\s]*)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)`;
const IMAGE = new RegExp(`!${LABEL}${DEST}`, "g");
const LINK = new RegExp(`${LABEL}${DEST}`, "g");
const IN_APP = /^\/(?![/\\])[^\\]*$/;

/**
 * Links survive only when they point into the app; images never do. A plain reference definition
 * is dropped; any other `]:` becomes `]\:`, which renders the same and defines nothing, wherever
 * a definition hides (after a quote marker, in a list, with its URL on the next line).
 */
export function rewriteLinks(md: string): string {
  return md
    .replace(/^ {0,3}\[[^\]\n]+\]:[ \t]*\S.*$/gm, "")
    .replace(IMAGE, "$1")
    .replace(LINK, (all, label: string, href: string) => (IN_APP.test(href) ? all : label))
    .replace(/\]:/g, "]\\:");
}

const TOKEN = /\[\[(reveal|later|(deg|rn|note|chord|bars|tool|term):([^\]\s]{1,64}))\]\]/g;

function proseSegments(
  md: string,
  opts: MarkupOptions,
  seen: { reveal: boolean; later: boolean },
): Segment[] {
  const out: Segment[] = [];
  const text = (s: string) => {
    const safe = rewriteLinks(s);
    if (safe.length > 0) out.push({ type: "text", md: safe });
  };
  let last = 0;
  for (const m of md.matchAll(TOKEN)) {
    const raw = m[0];
    let seg: Segment | null = null;
    if (m[1] === "reveal") {
      // One button per message, and only where the contract allows a reveal at all.
      if (opts.revealAllowed === true && !seen.reveal) {
        seen.reveal = true;
        seg = { type: "reveal", raw };
      }
    } else if (m[1] === "later") {
      // One offer per message, in the threads where a detour can come up.
      if (opts.thread !== undefined && LATER_THREADS.has(opts.thread) && !seen.later) {
        seen.later = true;
        seg = { type: "later", raw };
      }
    } else {
      seg = token(m[2] as TokenKind, m[3] as string, raw, opts);
    }
    if (seg === null) continue; // stays in the surrounding text
    text(md.slice(last, m.index));
    out.push(seg);
    last = m.index + raw.length;
  }
  text(md.slice(last));
  return out;
}

export function parseMarkup(input: string, opts: MarkupOptions = {}): Segment[] {
  const out: Segment[] = [];
  const seen = { reveal: false, later: false };
  const pieces = splitMarkdown(input);
  let prose = "";
  const flushProse = () => {
    if (prose.length > 0) out.push(...proseSegments(prose, opts, seen));
    prose = "";
  };
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i] as Piece;
    if (p.k === "text") {
      prose += p.s;
    } else if (p.k === "code") {
      flushProse();
      out.push({ type: "code_inline", code: p.s });
    } else if (p.k === "fence_open") {
      flushProse();
      const lang =
        p.s
          .replace(/^ {0,3}(?:`+|~+)/, "")
          .trim()
          .split(/\s+/)[0] ?? "";
      let code = "";
      while (i + 1 < pieces.length && (pieces[i + 1] as Piece).k === "fence_body")
        code += (pieces[++i] as Piece).s;
      if (i + 1 < pieces.length && (pieces[i + 1] as Piece).k === "fence_close") i++;
      out.push({
        type: "code_block",
        lang: lang === "" ? null : lang,
        code: code.replace(/\n$/, ""),
        playable: false,
      });
    }
  }
  flushProse();
  return out;
}

/** Tutor markdown made safe to store and render: no raw HTML, no images, in-app links only. */
export function sanitizeMarkdown(input: string): string {
  let out = "";
  let prose = "";
  for (const p of splitMarkdown(input)) {
    if (p.k === "text") {
      prose += p.s;
      continue;
    }
    out += rewriteLinks(prose) + serializePiece(p);
    prose = "";
  }
  return out + rewriteLinks(prose);
}

export interface TermUsage {
  /** Introduced terms the message names. */
  introduced: string[];
  /** Terms outside the introduced list: each is shown with the "preview" badge. */
  preview: string[];
  /** Preview terms written more than once; the persona asks for exactly once. */
  repeatedPreview: string[];
}

/** For the introduced-terms rule (contracts §10.8): which `[[term:...]]` tokens does a message use? */
export function termUsage(text: string, introducedTerms: ReadonlySet<string>): TermUsage {
  const counts = new Map<string, number>();
  for (const seg of parseMarkup(text, { introducedTerms })) {
    if (seg.type === "token" && seg.kind === "term") counts.set(seg.value, (counts.get(seg.value) ?? 0) + 1);
  }
  const ids = [...counts.keys()];
  const preview = ids.filter((id) => !introducedTerms.has(id));
  return {
    introduced: ids.filter((id) => introducedTerms.has(id)),
    preview,
    repeatedPreview: preview.filter((id) => (counts.get(id) ?? 0) > 1),
  };
}

export function countWords(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}
