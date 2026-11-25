// Oak 2.0 W1 (PLAN S7, commit sounds): the learner commits a line's sound as it was in a version; a later edit to
// that sound is noticed and asked about (CommitGuard), never blocked. Pure: reads code as text through the shared
// studio-code helpers. "The sound of a line" here is its `COMMIT_LINKS`: "Make this my Blank"'s `SOUND_LINKS` without
// the mix (`gain`, `velocity`, `postgain`, `pan`), so a committed sound leaves the mix open (W5 F3).
import { COMMIT_LINKS, chainLinks, labelledLines, soundSettingsOf } from "@oak/content-kit";

export interface CommittedRef {
  label: string;
  version: number;
}

/** The first statement with this exact label, or null. */
function statementOf(code: string, label: string): { from: number; to: number; text: string } | null {
  return labelledLines(code).find((l) => l.label === label) ?? null;
}

/**
 * The committed labels whose sound settings (`soundSettingsOf` over `COMMIT_LINKS`) differ now from the committed version's line. A label
 * missing from the code now or from the committed version (or a version whose code is gone) is not listed. A label
 * committed twice counts once, at its last entry.
 */
export function soundChanges(
  code: string,
  committed: readonly CommittedRef[],
  codeOf: (version: number) => string | null,
): CommittedRef[] {
  const last = new Map<string, number>();
  for (const c of committed) last.set(c.label, c.version);
  const out: CommittedRef[] = [];
  for (const [label, version] of last) {
    const now = statementOf(code, label);
    const thenCode = codeOf(version);
    const then = thenCode === null ? null : statementOf(thenCode, label);
    if (!now || !then) continue;
    if (soundSettingsOf(now.text, COMMIT_LINKS) !== soundSettingsOf(then.text, COMMIT_LINKS))
      out.push({ label, version });
  }
  return out;
}

const LABEL_PREFIX = /^\s*[A-Za-z_$][\w$]*\s*:(?!:)\s*/;

interface LinkSpan {
  name: string;
  args: string;
  /** Offsets into the statement text: `from` at the link's `.`, `to` after its `)`. */
  from: number;
  to: number;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The links after the first call of a labelled statement, with where each sits in the text, and where the first call
 * ends; null when the statement is not a plain call chain.
 */
function linkSpans(text: string): { headEnd: number; spans: LinkSpan[] } | null {
  const prefix = LABEL_PREFIX.exec(text);
  if (!prefix) return null;
  const links = chainLinks(text.slice(prefix[0].length));
  const first = links?.[0];
  if (!links || !first) return null;
  const head = new RegExp(`${escapeRe(first.name)}\\s*\\(\\s*${escapeRe(first.args)}\\s*\\)`, "y");
  head.lastIndex = prefix[0].length;
  if (!head.exec(text)) return null;
  const headEnd = head.lastIndex;
  const spans: LinkSpan[] = [];
  let at = headEnd;
  for (const link of links.slice(1)) {
    const re = new RegExp(`\\.\\s*${escapeRe(link.name)}\\s*\\(\\s*${escapeRe(link.args)}\\s*\\)`, "g");
    re.lastIndex = at;
    const m = re.exec(text);
    if (!m) return null;
    spans.push({ name: link.name, args: link.args, from: m.index, to: m.index + m[0].length });
    at = m.index + m[0].length;
  }
  return { headEnd, spans };
}

/** The statement text with its sound links replaced by `wanted` (`.name(args)` links, in order). */
function withSoundLinks(text: string, wanted: readonly { name: string; args: string }[]): string | null {
  const read = linkSpans(text);
  if (!read) return null;
  const sound = read.spans.filter((s) => COMMIT_LINKS.has(s.name));
  // The same links in the same order: change only their arguments, so the line keeps its layout.
  if (sound.length === wanted.length && sound.every((s, i) => s.name === wanted[i]?.name)) {
    let out = text;
    for (let i = sound.length - 1; i >= 0; i--) {
      const s = sound[i] as LinkSpan;
      const w = wanted[i] as { name: string; args: string };
      if (s.args !== w.args) out = `${out.slice(0, s.from)}.${s.name}(${w.args})${out.slice(s.to)}`;
    }
    return out;
  }
  // Otherwise every sound link goes (with the line break and indent before it, for a chain written one link per
  // line), and the committed links go where the first of them was, or after the last link.
  let out = text;
  let insertAt = read.spans[read.spans.length - 1]?.to ?? read.headEnd;
  for (let i = sound.length - 1; i >= 0; i--) {
    const s = sound[i] as LinkSpan;
    let from = s.from;
    while (from > 0 && /\s/.test(out[from - 1] as string)) from--;
    out = out.slice(0, from) + out.slice(s.to);
    insertAt = from;
  }
  const insert = wanted.map((w) => `.${w.name}(${w.args})`).join("");
  return out.slice(0, insertAt) + insert + out.slice(insertAt);
}

/**
 * Puts back the committed sound of `label`: its sound links (`COMMIT_LINKS`) become those of the same label in
 * `fromCode` (the committed version); its notes, rhythm, mix and every other line stay byte-identical. The code comes back unchanged when
 * the label is in neither, or a line is not a plain call chain.
 */
export function restoreSound(code: string, label: string, fromCode: string): string {
  const now = statementOf(code, label);
  const then = statementOf(fromCode, label);
  if (!now || !then) return code;
  const thenRead = linkSpans(then.text);
  if (!thenRead) return code;
  const wanted = thenRead.spans
    .filter((s) => COMMIT_LINKS.has(s.name))
    .map(({ name, args }) => ({ name, args }));
  const next = withSoundLinks(now.text, wanted);
  if (next === null) return code;
  return code.slice(0, now.from) + next + code.slice(now.to);
}

// --- CommitGuard and SoundTools copy (descriptive: never a verdict, W1 fidelity rule 1) ------------

/** The guard's sentence around the label (rendered as code): "You changed the sound of `bass`, which …". */
const changedParts = (version: number): readonly [string, string] => [
  "You changed the sound of ",
  `, which you committed in v${version}.`,
];

export const COMMIT_COPY = {
  changedParts,
  changed: (label: string, version: number) => {
    const [before, after] = changedParts(version);
    return `${before}${label}${after}`;
  },
  putBack: "Put it back",
  keep: "Keep the change",
  commit: (label: string) => `Commit sounds of ${label}`,
  committed: "Committed",
  uncommit: "Uncommit",
  plainOn: "Plain sounds: you hear one plain sound per part. Your code is unchanged.",
  plainSwitch: "Plain sounds",
  listenMenu: "Listen through…",
  listenOn: (mode: string) => `Listening through: ${mode}. Your code is unchanged.`,
  heardPrompt: "Write one thing you heard into your code.",
  heardAdd: "Add to code",
  notNow: "Not now",
  noLine: "Put the cursor on a labelled line to commit its sound.",
} as const;

export const LISTEN_LABELS = {
  muffled: "Muffled",
  "small-speaker": "Small speaker",
  quiet: "Very quiet",
} as const;

/** The comment "Add to code" writes after the tempo line (or first, when there is none). */
export function heardComment(mode: keyof typeof LISTEN_LABELS, text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return `// heard (${LISTEN_LABELS[mode].toLowerCase()}): ${one}`;
}

/** `code` with `line` inserted on its own line right after the first tempo statement, or at the top. */
export function insertAfterTempo(code: string, line: string, tempoLine: string | null): string {
  if (tempoLine !== null) {
    const at = code.indexOf(tempoLine);
    if (at >= 0) {
      const end = at + tempoLine.length;
      const eol = code.indexOf("\n", end);
      const cut = eol === -1 ? code.length : eol;
      return `${code.slice(0, cut)}\n${line}${code.slice(cut)}`;
    }
  }
  return `${line}\n${code}`;
}
