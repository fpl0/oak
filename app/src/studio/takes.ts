// Oak 2.0 W1 (PLAN §4 S3 jam then edit): a jam's Runs are takes (`takeState` open, kept or cut; cut = hidden, never
// deleted). The edit view lists them and builds a new version from picked lines: per label one take's line, with every
// const that line uses (studio-code `scrapCode`), so a combined sketch drops no part and still runs (Review Focus 1).
import type { SketchVersion } from "@oak/api";
import { constDecls, labelledLines, scrapCode, tempoLineOf } from "@oak/content-kit";

/** The takes among a sketch's versions: `open` and `kept`, plus `cut` when `showCut`; newest first. */
export function takesOf(versions: readonly SketchVersion[], o: { showCut: boolean }): SketchVersion[] {
  return versions
    .filter((v) => v.takeState === "open" || v.takeState === "kept" || (o.showCut && v.takeState === "cut"))
    .sort((a, b) => b.version - a.version);
}

/** Learner-facing words of the takes panel (each checked by `isDescriptive`). */
export const TAKES_WORDS = {
  title: "Takes",
  intro: "Each Run in a jam is a take. Keep the ones you like; cut hides a take and never deletes it.",
  play: "Play",
  playing: "Playing",
  keep: "Keep",
  kept: "Kept",
  cut: "Cut",
  bringBack: "Bring back",
  hideCut: "Hide cut takes",
  saveLine: "Save line to scraps",
  savedLine: "Saved to scraps",
  build: "Build a version",
  buildIntro:
    "Pick a take for each line you want. A new version is saved from them; the takes stay as they are.",
  leaveOut: "Leave out",
  buildButton: "Build",
  buildNothing: "Pick at least one line to build from.",
  built: "Built a new version from your takes",
  takesChip: "Take",
  playTitle: "Sets this take as B of the A/B switch, to hear it against what you have now.",
  imported: "imported",
  changeError: "Couldn't change the take",
  saveError: "Couldn't save the line",
} as const;

/** "Show cut takes (n)". */
export function showCutWords(n: number): string {
  return `Show cut takes (${n})`;
}

/** The built version's note: "Built from takes 3, 5" (the picked takes, ascending). */
export function builtNote(picks: Readonly<Record<string, number>>): string {
  const vs = [...new Set(Object.values(picks))].sort((a, b) => a - b);
  return `Built from takes ${vs.join(", ")}`;
}

// --- building -------------------------------------------------------------------------------------

const LABEL_PREFIX = /^\s*[A-Za-z_$][\w$]*\s*:(?!:)/;
const CONST_NAME = /^const\s+([A-Za-z_$][\w$]*)/;

/**
 * `text` with the identifier `from` renamed to `to` wherever it is code: not inside a string, a template or a
 * comment, not after a `.` (a property), and not a label (`groove: …` keeps its label).
 */
function renameIdent(text: string, from: string, to: string): string {
  const label = LABEL_PREFIX.exec(text)?.[0].length ?? 0;
  let out = text.slice(0, label);
  let i = label;
  const n = text.length;
  const isId = (c: string | undefined) => c !== undefined && /[\w$]/.test(c);
  while (i < n) {
    const c = text[i] as string;
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && text[i + 1] === "/") {
      const j = text.indexOf("\n", i);
      const end = j < 0 ? n : j;
      out += text.slice(i, end);
      i = end;
    } else if (c === "/" && text[i + 1] === "*") {
      const j = text.indexOf("*/", i + 2);
      const end = j < 0 ? n : j + 2;
      out += text.slice(i, end);
      i = end;
    } else if (/[A-Za-z_$]/.test(c) && !isId(text[i - 1])) {
      let j = i + 1;
      while (isId(text[j])) j++;
      const word = text.slice(i, j);
      let k = i - 1;
      while (k >= 0 && /\s/.test(text[k] as string)) k--;
      const property = text[k] === "." && text[k - 1] !== ".";
      out += word === from && !property ? to : word;
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** A scrap's parts: its consts (source order) and its line, cut from `scrapCode`'s `\n`-joined text. */
function scrapParts(code: string, label: string): { consts: string[]; line: string } | null {
  const scrap = scrapCode(code, label);
  if (scrap === null) return null;
  const line = labelledLines(code).find((l) => l.label === label)?.text ?? "";
  const head = scrap.slice(0, Math.max(0, scrap.length - line.length - 1));
  // `scrapCode` joins whole const statements of `code` in source order: read them back from the head in that order.
  const consts: string[] = [];
  let pos = 0;
  for (const d of constDecls(code)) {
    const end = pos + d.text.length;
    if (head.startsWith(d.text, pos) && (end === head.length || head[end] === "\n")) {
      consts.push(d.text);
      pos = end + 1;
    }
  }
  return { consts, line };
}

/**
 * A new version's code from picked takes: per label (`picks[label]` = the take's version), that take's line with
 * every const it uses, transitively, in source order. Labels are written in the order they first appear across the
 * takes (oldest take first); a const written by an earlier pick is not repeated; a different const of the same name
 * is renamed (`p` → `p2`) in the later line and its consts. The tempo line is the newest picked take's (or the
 * newest picked take that has one). A pick whose take lacks the label is left out; "leave out" is a missing key.
 */
export function buildFromTakes(
  takes: readonly Pick<SketchVersion, "version" | "code">[],
  picks: Readonly<Record<string, number>>,
): string {
  const byVersion = new Map(takes.map((t) => [t.version, t]));
  const order: string[] = [];
  for (const t of [...takes].sort((a, b) => a.version - b.version))
    for (const l of labelledLines(t.code)) if (!order.includes(l.label)) order.push(l.label);
  const labels = Object.keys(picks).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? Number.MAX_SAFE_INTEGER : ia) - (ib < 0 ? Number.MAX_SAFE_INTEGER : ib);
  });

  const emitted = new Map<string, string>();
  const body: string[] = [];
  const used: number[] = [];
  for (const label of labels) {
    const take = byVersion.get(picks[label] as number);
    if (!take) continue;
    const parts = scrapParts(take.code, label);
    if (parts === null) continue;
    used.push(take.version);
    const renames: [string, string][] = [];
    const applyRenames = (s: string) => renames.reduce((acc, [a, b]) => renameIdent(acc, a, b), s);
    for (const raw of parts.consts) {
      let text = applyRenames(raw);
      const name = CONST_NAME.exec(text)?.[1] as string;
      const prior = emitted.get(name);
      if (prior === text) continue;
      if (prior !== undefined) {
        let k = 2;
        while (emitted.has(`${name}${k}`)) k++;
        const fresh = `${name}${k}`;
        renames.push([name, fresh]);
        text = renameIdent(text, name, fresh);
        emitted.set(fresh, text);
      } else emitted.set(name, text);
      body.push(text);
    }
    body.push(applyRenames(parts.line));
  }
  if (body.length === 0) return "";

  let tempo: string | null = null;
  for (const v of [...new Set(used)].sort((a, b) => b - a)) {
    tempo = tempoLineOf((byVersion.get(v) as { code: string }).code);
    if (tempo !== null) break;
  }
  return tempo === null ? body.join("\n") : [tempo, "", ...body].join("\n");
}
