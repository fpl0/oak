// The Toolbox's pure model (ux §5.1; contracts §3): every entry of content/toolbox.ts grouped by kind, what is
// unlocked, the condition that unlocks the rest (the session, START rows, the voicing gate, alternative
// sites), which lessons use a tool (read from the generated examples by the one lint), and the small things
// the tool page needs (the demo's meter and tempo). No DOM: tested in model.test.ts.
import type { LintResult, MeterId, ToolEntry, UnlockableId } from "@oak/content-kit";

/** Kind order on the page: code first, then what it plays, then the app's own features. */
export const KIND_ORDER: readonly ToolEntry["kind"][] = [
  "tool",
  "sound",
  "scale",
  "chord",
  "feature",
  "lens",
  "template",
];

export const KIND_LABEL: Record<ToolEntry["kind"], string> = {
  tool: "Code",
  sound: "Sounds",
  scale: "Scales",
  chord: "Chords",
  feature: "Features",
  lens: "Lenses",
  template: "Templates",
};

export interface ToolSection {
  kind: ToolEntry["kind"];
  label: string;
  tools: ToolEntry[];
  unlocked: number;
}

/** Sections in kind order; inside a section, unlocked first (in course order), then locked in course order. */
export function groupTools(
  toolbox: readonly ToolEntry[],
  unlocked: ReadonlySet<string>,
  opts: { kind?: ToolEntry["kind"] | "all"; showLocked?: boolean; query?: string } = {},
): ToolSection[] {
  const needle = (opts.query ?? "").trim().toLowerCase();
  const order = new Map(toolbox.map((t, i) => [t.id as string, i]));
  const sections: ToolSection[] = [];
  for (const kind of KIND_ORDER) {
    if (opts.kind && opts.kind !== "all" && opts.kind !== kind) continue;
    const all = toolbox.filter((t) => t.kind === kind);
    const tools = all
      .filter((t) => opts.showLocked !== false || unlocked.has(t.id))
      .filter(
        (t) =>
          !needle ||
          t.code.toLowerCase().includes(needle) ||
          t.concept.toLowerCase().includes(needle) ||
          t.catalog.meaning.toLowerCase().includes(needle) ||
          t.id.toLowerCase().includes(needle),
      )
      .sort(
        (a, b) =>
          Number(unlocked.has(b.id)) - Number(unlocked.has(a.id)) ||
          (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      );
    if (tools.length === 0) continue;
    sections.push({
      kind,
      label: KIND_LABEL[kind],
      tools,
      unlocked: all.filter((t) => unlocked.has(t.id)).length,
    });
  }
  return sections;
}

/** Every session that can unlock an entry (one, or alternatives such as "U10.L09 or A1.L04"). */
export function sitesOf(t: Pick<ToolEntry, "unlock">): string[] {
  const at = t.unlock.at;
  return Array.isArray(at) ? [...at] : [at];
}

/** A site's title from the syllabus (a capstone's session "C2.S2" by its capstone, "C2"); undefined if untitled. */
function titleOfSite(site: string, titles: ReadonlyMap<string, string>): string | undefined {
  return titles.get(site) ?? titles.get(site.replace(/\.S\d+$/, ""));
}

/**
 * "U01.L02 · Rests and accents" (or the bare ID when the syllabus has no title for it). A capstone's title already
 * starts with its code ("C2 Four-Chord Song"), so its session reads as the title alone, not "C2.S2 · C2 Four-…".
 */
export function siteText(site: string, titles: ReadonlyMap<string, string>): string {
  const title = titleOfSite(site, titles);
  if (!title) return site;
  const code = site.replace(/\.S\d+$/, "");
  return title.startsWith(`${code} `) ? title : `${site} · ${title}`;
}

/** The lesson's title alone ("Count to Four"), for a learner line that names a lesson; the bare ID if untitled. */
export function siteTitle(site: string, titles: ReadonlyMap<string, string>): string {
  return titleOfSite(site, titles) ?? site;
}

/**
 * Lesson IDs in course order: the core first, in the default order of the course (`coreOrder`, the syllabus's
 * `defaultOrder`, where a capstone session sits where it is taken), then the side tracks in syllabus order
 * (`titles` is built in that order). An ID neither knows goes last.
 */
export function courseSort(
  ids: readonly string[],
  titles: ReadonlyMap<string, string>,
  coreOrder: readonly string[] = [],
): string[] {
  const core = new Map(coreOrder.map((id, i) => [id, i]));
  const order = new Map([...titles.keys()].map((id, i) => [id, i]));
  const rank = (id: string): readonly [number, number] => {
    const c = core.get(id);
    if (c !== undefined) return [0, c];
    const at = order.get(id) ?? order.get(id.replace(/\.S\d+$/, "")) ?? Number.MAX_SAFE_INTEGER;
    return [/^(U\d|C\d)/.test(id) ? 0 : 1, at];
  };
  return [...ids].sort((a, b) => {
    const [ca, ia] = rank(a);
    const [cb, ib] = rank(b);
    return ca - cb || ia - ib || a.localeCompare(b);
  });
}

/**
 * "Also used in", split for the tool page (lessons in course order): the five most recent done lessons shown, the
 * earlier done ones behind "and N earlier lessons", the next three still to come shown, the rest behind "and N
 * more lessons". Every done lesson listed made 35 links for `.gain` after U04's checkpoint and 100 or more later.
 */
export function usedInGroups(
  lessons: readonly string[],
  done: ReadonlySet<string>,
  shown: { recent: number; next: number } = { recent: 5, next: 3 },
): { earlier: string[]; recent: string[]; next: string[]; later: string[] } {
  const finished = lessons.filter((l) => done.has(l));
  const ahead = lessons.filter((l) => !done.has(l));
  const cut = Math.max(0, finished.length - shown.recent);
  return {
    earlier: finished.slice(0, cut),
    recent: finished.slice(cut),
    next: ahead.slice(0, shown.next),
    later: ahead.slice(shown.next),
  };
}

/** A lesson named in a sentence: its title in quotes (“Let Strudel Voice It”), the bare ID only when untitled. */
export function siteQuoted(site: string, titles: ReadonlyMap<string, string>): string {
  const title = titleOfSite(site, titles);
  return title ? `“${title}”` : site;
}

/**
 * The learner-facing unlock condition (contracts §3.1 rules 2, 6, 11, 12). Lessons are named by their titles in
 * quotes, never by their course ids (“Unlocks when you complete “Let Strudel Voice It””): the id read as a code.
 */
export function unlockText(t: Pick<ToolEntry, "unlock">, titles: ReadonlyMap<string, string>): string {
  const sites = sitesOf(t).map((s) => siteQuoted(s, titles));
  const where = sites.join(" or ");
  const start = t.unlock.when === "start";
  let text = start ? `Unlocks when you start ${where}` : `Unlocks when you complete ${where}`;
  const fallback = t.unlock.fallbackAt;
  if (fallback) text += `, or when you complete ${siteQuoted(fallback, titles)} if that comes first`;
  if (t.unlock.condition) {
    const pct = Math.round(t.unlock.condition.minScore * 100);
    // The exercise is named by its lesson's title, never by its internal ref ("U05.L07/hand-voiced-cadence").
    const lesson = lessonOfRef(t.unlock.condition.exercise);
    const where = lesson ? ` in ${siteTitle(lesson, titles)}` : "";
    text += `, once the hand-voiced cadence check${where} scores ${pct}% or more without the answer revealed`;
  }
  return `${text}.`;
}

/** "U01.L01" from an example ref ("U01.L01@groove", "U01.L01/find-the-beat#item:0"). */
export function lessonOfRef(ref: string): string | null {
  const m = /^((?:U\d{2}|[A-Z]{1,2}\d?)\.(?:L\d{2}|CP\d?|S\d+)|C\d+|U\d{2}\.CP)/.exec(ref);
  return m ? (m[1] as string) : null;
}

export interface ExampleRow {
  ref: string;
  code: string;
  meter?: MeterId;
}

/**
 * Which lessons use which entry: each authored code snippet is linted (any profile reports `used`), and its
 * lesson is credited for every catalogued thing it uses. Lessons come out in course order.
 */
export function usageFrom(rows: readonly { ref: string; used: readonly string[] }[]): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  for (const r of rows) {
    const lesson = lessonOfRef(r.ref);
    if (!lesson) continue;
    for (const id of r.used) {
      const set = out.get(id) ?? new Set<string>();
      set.add(lesson);
      out.set(id, set);
    }
  }
  return new Map([...out].map(([id, set]) => [id, [...set].sort()]));
}

export function usedOf(result: LintResult): string[] {
  return [...new Set(result.used as readonly UnlockableId[] as readonly string[])];
}

/** The demo's meter, read from its tempo line (`setcpm(108/3)` is 3/4; STYLE §8). */
export function demoMeter(code: string): MeterId {
  const m = /setcpm\(\s*[\d.]+\s*\/\s*(\d+)\s*\)/.exec(code);
  if (m?.[1] === "3") return "3/4";
  if (m?.[1] === "2") return /6\/8|dotted/.test(code) ? "6/8" : "2/4";
  return "4/4";
}

/**
 * How many bars the demo's loop takes: the longest `<…>` alternation (one entry per bar, `x!n` counting n),
 * 2 at least (the two-bar examples of ux §5.1), 8 at most.
 */
export function demoBars(code: string): number {
  let most = 1;
  for (const m of code.matchAll(/"([^"]*)"/g)) {
    const text = m[1] as string;
    let depth = 0;
    let angle = -1;
    let count = 0;
    let token = "";
    const flush = () => {
      if (token.trim()) {
        const rep = /!(\d+)$/.exec(token.trim());
        count += rep ? Number(rep[1]) : 1;
      }
      token = "";
    };
    for (const ch of text) {
      if (ch === "<" || ch === "[" || ch === "{" || ch === "(") {
        if (ch === "<" && angle < 0) {
          angle = depth;
          count = 0;
        }
        depth++;
        if (angle >= 0 && depth - 1 > angle) token += ch;
        continue;
      }
      if (ch === ">" || ch === "]" || ch === "}" || ch === ")") {
        depth--;
        if (ch === ">" && depth === angle) {
          flush();
          most = Math.max(most, count);
          angle = -1;
          continue;
        }
        if (angle >= 0) token += ch;
        continue;
      }
      if (angle >= 0 && depth === angle + 1 && /\s/.test(ch)) flush();
      else if (angle >= 0) token += ch;
    }
  }
  return Math.max(2, Math.min(8, most));
}

/** The demo's own key from its first `.scale("D4:major")`, for degree labels. */
export function demoKey(code: string): { tonic: string; mode: string } | null {
  const m = /\.scale\(\s*"([A-G][#b]?)-?\d?:([a-z:]+)/.exec(code);
  if (!m) return null;
  return { tonic: m[1] as string, mode: (m[2] as string).replace(/:/g, " ") };
}

/** A title for a sketch started from a tool page. */
export function tryTitle(t: Pick<ToolEntry, "code">): string {
  const name = t.code.length > 40 ? `${t.code.slice(0, 39)}…` : t.code;
  return `Trying ${name}`;
}

/** The I–IV–V–I arpeggio of the unlock moment (ux §7.7), in C, as MIDI notes with start offsets in seconds. */
export function unlockArpeggio(tonic = 60): { midi: number; at: number; dur: number }[] {
  const chords = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12]];
  const out: { midi: number; at: number; dur: number }[] = [];
  let at = 0;
  for (const c of chords) {
    for (const iv of c) {
      out.push({ midi: tonic + iv, at, dur: 0.18 });
      at += 0.07;
    }
    at += 0.06;
  }
  return out;
}

/** The body of `sketches.create` for "Try it in Studio": a free sketch starting from the tool's demo (or an edit of it). */
export function toolSketchBody(tool: Pick<ToolEntry, "code">, code: string, meter?: MeterId) {
  return {
    title: tryTitle(tool),
    originKind: "free" as const,
    originId: null,
    sessionId: null,
    code,
    bpm: null,
    meter: meter ?? demoMeter(code),
    key: demoKey(code) as { tonic: string; mode: "major" } | null,
    analysis: null,
    note: `From the toolbox: ${tool.code}`,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: false,
  };
}
