// Tutor markdown → a small, closed AST (contracts §10.7). Pure, no DOM.
//
// Safety comes from the shape of the output, not from sanitising strings: the AST has no node that can carry
// HTML, an image, an iframe or an attribute. `<script>` in the text stays the eight characters `<script>`, and
// the renderer (Markdown.tsx) only ever puts strings into React text children, which escapes them. Links survive
// only when they point inside the app (`/oak`, `/toolbox/tb.scale`); anything else (`javascript:`, `//host`,
// `https://…`, `data:`) loses its link and keeps its words. Fenced code renders as plain, non-playable text: code
// the learner may run only ever arrives as a `propose_code` card.
//
// Music tokens (`[[deg:5]]`, `[[rn:V7]]`, …) are parsed with `parseTutorText` from @oak/api, so the panel and the
// server's markup guard agree on what a token is. Inside inline code a token is just text. A value written with
// Unicode accidentals or as a movable-do syllable is first put in the grammar's own spelling (`canonicalTokenRaw`).
// Oak 2.0 W1: `[[later]]` (exactly that, no value) is the tutor's offer to park the question on the Later list; the
// renderer decides whether it becomes a button (chat, hint and explain threads) or nothing.
import { type MusicToken, parseTutorText } from "@oak/api";
import { canonicalTokenRaw } from "./music-tokens.ts";

export type Inline =
  | { t: "text"; text: string }
  | { t: "strong"; children: Inline[] }
  | { t: "em"; children: Inline[] }
  | { t: "code"; text: string }
  | { t: "link"; href: string; children: Inline[] }
  | { t: "token"; token: TutorToken; raw: string }
  | { t: "br" };

/** A music token, `[[reveal]]`, or (Oak 2.0 W1) `[[later]]`. */
export type TutorToken = MusicToken | { kind: "later" };
export const LATER_TOKEN = "[[later]]";

export type Block =
  | { t: "p"; children: Inline[] }
  | { t: "h"; level: 1 | 2 | 3; children: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; start: number; items: Inline[][] }
  | { t: "quote"; children: Block[] }
  | { t: "pre"; lang: string; text: string }
  | { t: "hr" };

/** Longest input parsed as markdown; anything past it is cut (a review or a chat answer is far shorter). */
export const MAX_MARKDOWN_CHARS = 40_000;
const MAX_DEPTH = 4;
/**
 * Farthest a link label or an emphasis may reach for its closing mark. Without a bound, text with many unclosed
 * `[` or `_` (hostile or just odd model output) scans to the end once per mark: quadratic, a second of main-thread
 * work at 40 000 characters, and the panel re-parses on every streamed chunk.
 */
const MAX_SPAN = 1_000;

/** In-app routes only: one leading slash, no scheme, no protocol-relative `//`, no backslash, no spaces. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (!/^\/(?![/\\])[A-Za-z0-9\-._~/?#=&%+:$,;@!*'()]*$/.test(h)) return null;
  if (/[\\]/.test(h)) return null;
  return h;
}

// --- inline ---------------------------------------------------------------------------------------

const PUNCT = /[\\`*_[\]()#+\-.!{}<>~|"']/;

function pushText(out: Inline[], text: string): void {
  if (!text) return;
  const prev = out[out.length - 1];
  if (prev?.t === "text") prev.text += text;
  else out.push({ t: "text", text });
}

/** Index of the closing `]` that matches the `[` at `open`, or -1. */
function matchBracket(s: string, open: number): number {
  let depth = 0;
  const end = Math.min(s.length, open + MAX_SPAN);
  for (let i = open; i < end; i++) {
    const c = s[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function parseInline(src: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  if (depth > MAX_DEPTH) {
    pushText(out, src);
    return out;
  }
  let i = 0;
  let buf = "";
  const flush = () => {
    pushText(out, buf);
    buf = "";
  };
  while (i < src.length) {
    const c = src[i] as string;
    const rest = src.slice(i);

    // Backslash escape of punctuation.
    if (c === "\\" && i + 1 < src.length && PUNCT.test(src[i + 1] as string)) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    // Hard break: two spaces or a backslash before a newline.
    if (c === "\n") {
      if (/ {2,}$/.test(buf)) {
        buf = buf.replace(/ +$/, "");
        flush();
        out.push({ t: "br" });
      } else buf = `${buf.replace(/ +$/, "")} `;
      i++;
      while (src[i] === " ") i++;
      continue;
    }

    // Code span: a run of backticks closed by the same run.
    if (c === "`") {
      const run = /^`+/.exec(rest)?.[0] as string;
      const close = src.indexOf(run, i + run.length);
      if (close > 0) {
        flush();
        let text = src.slice(i + run.length, close).replace(/\n/g, " ");
        if (/^ .* $/.test(text) && text.trim()) text = text.slice(1, -1);
        out.push({ t: "code", text });
        i = close + run.length;
        continue;
      }
      buf += run;
      i += run.length;
      continue;
    }

    // The Later offer: exactly `[[later]]`; `[[later:x]]` is plain text.
    if (rest.startsWith(LATER_TOKEN)) {
      flush();
      out.push({ t: "token", token: { kind: "later" }, raw: LATER_TOKEN });
      i += LATER_TOKEN.length;
      continue;
    }

    // Music token.
    if (rest.startsWith("[[")) {
      const end = src.indexOf("]]", i + 2);
      if (end > 0 && end - i <= 80) {
        const raw = src.slice(i, end + 2);
        // `[[deg:♭3]]` and `[[deg:me]]` are read as `[[deg:b3]]` (music-tokens.ts); the raw text is kept.
        const canonical = canonicalTokenRaw(raw);
        const parts = parseTutorText(canonical);
        const only = parts.length === 1 ? parts[0] : undefined;
        if (only?.type === "token") {
          flush();
          out.push({ t: "token", token: only.token, raw });
          i = end + 2;
          continue;
        }
        // A token canonicalTokenRaw reads as plain text (a slash chord): its text, without the brackets.
        if (!canonical.startsWith("[[")) {
          buf += canonical;
          i = end + 2;
          continue;
        }
      }
      buf += "[[";
      i += 2;
      continue;
    }

    // Link: [label](href). Only in-app hrefs become links; the rest keep their label as text.
    if (c === "[") {
      const close = matchBracket(src, i);
      if (close > 0 && src[close + 1] === "(") {
        const end = src.indexOf(")", close + 2);
        if (end > 0) {
          const label = src.slice(i + 1, close);
          const href = src.slice(close + 2, end).replace(/\s+"[^"]*"$/, "");
          const safe = safeHref(href);
          flush();
          const children = parseInline(label, depth + 1);
          if (safe) out.push({ t: "link", href: safe, children });
          else for (const n of children) n.t === "text" ? pushText(out, n.text) : out.push(n);
          i = end + 1;
          continue;
        }
      }
      buf += c;
      i++;
      continue;
    }

    // Strong: ** or __.
    if (rest.startsWith("**") || (rest.startsWith("__") && !/\w/.test(src[i - 1] ?? ""))) {
      const mark = rest.slice(0, 2);
      const close = src.indexOf(mark, i + 2);
      if (close > i + 2 && !/\s/.test(src[i + 2] as string)) {
        flush();
        out.push({ t: "strong", children: parseInline(src.slice(i + 2, close), depth + 1) });
        i = close + 2;
        continue;
      }
      buf += mark;
      i += 2;
      continue;
    }

    // Emphasis: * or _ (an underscore only at a word boundary, so snake_case stays text).
    if ((c === "*" || c === "_") && !(c === "_" && /\w/.test(src[i - 1] ?? ""))) {
      let close = i + 1;
      for (;;) {
        close = src.indexOf(c, close);
        if (close < 0 || close - i > MAX_SPAN) {
          close = -1;
          break;
        }
        if (src[close + 1] === c) {
          close += 2;
          continue;
        }
        if (c === "_" && /\w/.test(src[close + 1] ?? "")) {
          close++;
          continue;
        }
        break;
      }
      if (close > i + 1 && !/\s/.test(src[i + 1] as string) && !/\s/.test(src[close - 1] as string)) {
        flush();
        out.push({ t: "em", children: parseInline(src.slice(i + 1, close), depth + 1) });
        i = close + 1;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    buf += c;
    i++;
  }
  flush();
  // Trailing soft-break space.
  const last = out[out.length - 1];
  if (last?.t === "text") last.text = last.text.replace(/ $/, "");
  return out.filter((n) => n.t !== "text" || n.text !== "");
}

// --- blocks ---------------------------------------------------------------------------------------

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w-]*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^ {0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/;
const UL = /^ {0,3}[-*+]\s+(.*)$/;
const OL = /^ {0,3}(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^ {0,3}>\s?(.*)$/;

function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    HR.test(line) ||
    UL.test(line) ||
    OL.test(line) ||
    QUOTE.test(line)
  );
}

function parseLines(lines: string[], depth: number): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1] as string;
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] as string).trim().startsWith(marker))
        body.push(lines[i++] as string);
      i++; // the closing fence (or past the end)
      blocks.push({ t: "pre", lang: fence[2] ?? "", text: body.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const level = Math.min(3, (heading[1] as string).length) as 1 | 2 | 3;
      blocks.push({ t: "h", level, children: parseInline(heading[2] ?? "") });
      i++;
      continue;
    }
    if (HR.test(line)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i] as string))
        body.push((QUOTE.exec(lines[i++] as string) as RegExpExecArray)[1] as string);
      blocks.push({
        t: "quote",
        children:
          depth >= MAX_DEPTH
            ? [{ t: "p", children: [{ t: "text", text: body.join(" ") }] }]
            : parseLines(body, depth + 1),
      });
      continue;
    }
    const ul = UL.exec(line);
    const ol = OL.exec(line);
    if (ul || ol) {
      const ordered = !ul;
      const items: string[] = [];
      const re = ordered ? OL : UL;
      while (i < lines.length) {
        const l = lines[i] as string;
        const m = re.exec(l);
        if (m) {
          items.push((ordered ? m[2] : m[1]) ?? "");
          i++;
          continue;
        }
        // A continuation line: indented, not blank, not the start of another block.
        if (l.trim() && /^\s{2,}/.test(l) && !startsBlock(l.trimStart()) && items.length) {
          items[items.length - 1] += `\n${l.trim()}`;
          i++;
          continue;
        }
        break;
      }
      const parsed = items.map((it) => parseInline(it));
      blocks.push(
        ordered
          ? { t: "ol", start: Number((ol as RegExpExecArray)[1]) || 1, items: parsed }
          : { t: "ul", items: parsed },
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] as string).trim() &&
      (para.length === 0 || !startsBlock(lines[i] as string))
    )
      para.push(lines[i++] as string);
    blocks.push({ t: "p", children: parseInline(para.join("\n")) });
  }
  return blocks;
}

/** Parses tutor markdown. Never throws; any input gives a (possibly plain-text) AST. */
export function parseMarkdown(src: string): Block[] {
  const text = src.slice(0, MAX_MARKDOWN_CHARS).replace(/\r\n?/g, "\n").replace(/\t/g, "  ");
  return parseLines(text.split("\n"), 0);
}

/** Every token in a parsed document, in order (tests and the "reveal" check). */
export function tokensIn(blocks: Block[]): TutorToken[] {
  const out: TutorToken[] = [];
  const walk = (nodes: Inline[]) => {
    for (const n of nodes) {
      if (n.t === "token") out.push(n.token);
      else if (n.t === "strong" || n.t === "em" || n.t === "link") walk(n.children);
    }
  };
  const visit = (bs: Block[]) => {
    for (const b of bs) {
      if (b.t === "p" || b.t === "h") walk(b.children);
      else if (b.t === "ul" || b.t === "ol") for (const it of b.items) walk(it);
      else if (b.t === "quote") visit(b.children);
    }
  };
  visit(blocks);
  return out;
}

/** The plain text of a document (for aria-live announcements and the copy of a message). */
export function plainText(blocks: Block[]): string {
  const inl = (nodes: Inline[]): string =>
    nodes
      .map((n) => {
        switch (n.t) {
          case "text":
          case "code":
            return n.text;
          case "br":
            return "\n";
          case "token":
            return n.token.kind === "reveal" || n.token.kind === "later" ? "" : n.token.value;
          default:
            return inl(n.children);
        }
      })
      .join("");
  return blocks
    .map((b) => {
      switch (b.t) {
        case "p":
        case "h":
          return inl(b.children);
        case "ul":
        case "ol":
          return b.items.map(inl).join("\n");
        case "quote":
          return plainText(b.children);
        case "pre":
          return b.text;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
