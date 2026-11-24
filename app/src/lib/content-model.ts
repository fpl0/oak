// The app's view of the course content, and the pure functions that build it. Two sources feed it:
// `content/.generated/*.json` written by `bun run content:build` (preferred, carries `contentVersion`), and the
// isomorphic registries in `content/index.ts` when the generated files are absent (fresh checkout, content
// builder still at work). No DOM, no Vite: tested with `bun test`.
import type {
  CanDoDef,
  CapstoneMeta,
  CheckpointMeta,
  FactDeck,
  FamilyDef,
  GymTemplate,
  SkillDef,
  SkillRegion,
  SyllabusDef,
  TermEntry,
  ToolEntry,
} from "@oak/api";
import type { NamedToolEntry, UnlockSiteName } from "@oak/grader";

export interface SkillNode {
  id: string;
  name: string;
  region: SkillRegion | "other";
  category: string;
  kind: string;
  prerequisites: string[];
  introducedBy: string | null;
}

export interface SkillGraph {
  nodes: SkillNode[];
  /** `[from, to]`: `from` is a prerequisite of `to`. Only edges between known nodes. */
  edges: [string, string][];
}

/** One lesson's step outline (`content/.generated/lessons.json`), for the step rail and resume. */
export interface LessonOutline {
  id: string;
  version: number;
  steps: { id: string; kind: string; minutes: number; graded: boolean; optional: boolean }[];
}

export function normalizeLessons(raw: unknown): LessonOutline[] {
  if (!Array.isArray(raw)) return [];
  const out: LessonOutline[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || o.sample === true) continue;
    const steps = Array.isArray(o.steps) ? o.steps : [];
    out.push({
      id: o.id,
      version: typeof o.version === "number" ? o.version : 1,
      steps: steps
        .filter(
          (st): st is Record<string, unknown> =>
            !!st && typeof st === "object" && typeof (st as { id?: unknown }).id === "string",
        )
        .map((st) => ({
          id: st.id as string,
          kind: asString(st.kind),
          minutes: typeof st.minutes === "number" ? st.minutes : 0,
          graded: st.graded === true,
          optional: st.optional === true,
        })),
    });
  }
  return out;
}

export interface ContentBundle {
  /** `contentVersion` from `index.json`, or `null` when built from the registries. */
  version: string | null;
  source: "generated" | "registries";
  toolbox: ToolEntry[];
  skills: SkillGraph;
  /** Authored lessons with their steps (empty until content:build has run). */
  lessons: LessonOutline[];
  syllabus: SyllabusDef | null;
  families: FamilyDef[];
  decks: FactDeck[];
  terms: TermEntry[];
  candos: CanDoDef[];
  capstones: CapstoneMeta[];
  checkpoints: CheckpointMeta[];
  templates: GymTemplate[];
}

/** Map rendering order (contracts §4: Groove → Pitch & Staff → Keys & Scales → Chords & Harmony → Melody & Form → Ears & Voice → Jazz / Sound). */
export const REGION_ORDER: readonly (SkillRegion | "other")[] = [
  "groove",
  "pitch-staff",
  "keys-scales",
  "chords-harmony",
  "melody-form",
  "ears-voice",
  "jazz",
  "sound",
  "other",
];

export const REGION_LABEL: Record<SkillRegion | "other", string> = {
  groove: "Groove",
  "pitch-staff": "Pitch & Staff",
  "keys-scales": "Keys & Scales",
  "chords-harmony": "Chords & Harmony",
  "melody-form": "Melody & Form",
  "ears-voice": "Ears & Voice",
  jazz: "Jazz",
  sound: "Sound",
  other: "Other",
};

const asString = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function toNode(raw: unknown): SkillNode | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = asString(r.id);
  if (!id) return null;
  if (r.retired) return null;
  const region = asString(r.region, "other");
  return {
    id,
    name: asString(r.name ?? r.title, id),
    region: (REGION_ORDER as readonly string[]).includes(region) ? (region as SkillNode["region"]) : "other",
    category: asString(r.category),
    kind: asString(r.kind),
    prerequisites: asStrings(r.prerequisites ?? r.prereqs ?? r.requires),
    introducedBy: typeof r.introducedBy === "string" ? r.introducedBy : null,
  };
}

/**
 * Accepts the generated `skill-graph.json` in any of the shapes a builder might reasonably write (an array of
 * nodes, or `{ nodes, edges? }`) or the `SkillDef[]` registry, and returns one normalized graph.
 */
export function normalizeSkillGraph(raw: unknown): SkillGraph {
  const rawNodes: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { nodes?: unknown }).nodes)
      ? ((raw as { nodes: unknown[] }).nodes as unknown[])
      : [];
  const nodes = rawNodes.map(toNode).filter((n): n is SkillNode => n !== null);
  const known = new Set(nodes.map((n) => n.id));
  const edges = new Map<string, [string, string]>();
  for (const n of nodes)
    for (const p of n.prerequisites) if (known.has(p) && p !== n.id) edges.set(`${p}>${n.id}`, [p, n.id]);
  const rawEdges =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { edges?: unknown }).edges : null;
  if (Array.isArray(rawEdges))
    for (const e of rawEdges) {
      const pair = Array.isArray(e)
        ? [e[0], e[1]]
        : e && typeof e === "object"
          ? [(e as Record<string, unknown>).from, (e as Record<string, unknown>).to]
          : [];
      const [a, b] = pair;
      if (typeof a === "string" && typeof b === "string" && known.has(a) && known.has(b) && a !== b)
        edges.set(`${a}>${b}`, [a, b]);
    }
  return { nodes, edges: [...edges.values()] };
}

export function skillGraphFromDefs(defs: readonly SkillDef[]): SkillGraph {
  return normalizeSkillGraph(defs);
}

export interface PlacedNode extends SkillNode {
  /** Longest prerequisite chain below this node (0 = no prerequisites). */
  depth: number;
  x: number;
  y: number;
}

export interface GraphLayout {
  nodes: PlacedNode[];
  edges: [string, string][];
  width: number;
  height: number;
  /** Band per region, for labels: top y and height. */
  bands: { region: SkillNode["region"]; y: number; height: number }[];
}

/**
 * Layered layout for the interim skill map: columns by prerequisite depth (every prerequisite sits strictly to
 * the left of what needs it), horizontal bands by region in map order, rows by course order inside a band.
 * Cycles (which content CI forbids) are broken rather than looped on.
 */
export function layoutSkillGraph(
  graph: SkillGraph,
  opts: { colWidth?: number; rowHeight?: number; bandGap?: number; padding?: number } = {},
): GraphLayout {
  const colWidth = opts.colWidth ?? 150;
  const rowHeight = opts.rowHeight ?? 34;
  const bandGap = opts.bandGap ?? 26;
  const padding = opts.padding ?? 24;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const preds = new Map<string, string[]>();
  for (const n of graph.nodes) preds.set(n.id, []);
  for (const [a, b] of graph.edges) preds.get(b)?.push(a);
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    for (const p of preds.get(id) ?? []) if (byId.has(p)) d = Math.max(d, depthOf(p) + 1);
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const n of graph.nodes) depthOf(n.id);

  const bands: GraphLayout["bands"] = [];
  const placed: PlacedNode[] = [];
  let y = padding;
  let maxDepth = 0;
  for (const region of REGION_ORDER) {
    const members = graph.nodes.filter((n) => n.region === region);
    if (members.length === 0) continue;
    // Rows: greedy per column, so nodes in the same column of a band stack.
    const rowsByCol = new Map<number, number>();
    let bandRows = 0;
    const sorted = [...members].sort(
      (a, b) =>
        (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0) ||
        (a.introducedBy ?? "").localeCompare(b.introducedBy ?? "") ||
        a.id.localeCompare(b.id),
    );
    for (const n of sorted) {
      const d = depth.get(n.id) ?? 0;
      maxDepth = Math.max(maxDepth, d);
      const row = rowsByCol.get(d) ?? 0;
      rowsByCol.set(d, row + 1);
      bandRows = Math.max(bandRows, row + 1);
      placed.push({ ...n, depth: d, x: padding + d * colWidth, y: y + row * rowHeight });
    }
    const height = bandRows * rowHeight;
    bands.push({ region, y, height });
    y += height + bandGap;
  }
  return {
    nodes: placed,
    edges: graph.edges.filter(([a, b]) => byId.has(a) && byId.has(b)),
    width: padding * 2 + (maxDepth + 1) * colWidth,
    height: Math.max(y - bandGap + padding, padding * 2),
    bands,
  };
}

/** Raw parts as read from disk or the registries; anything missing becomes empty. */
export interface ContentParts {
  index?: unknown;
  toolbox?: unknown;
  skillGraph?: unknown;
  lessons?: unknown;
  registries?: {
    syllabus?: SyllabusDef;
    skills?: readonly SkillDef[];
    toolbox?: readonly ToolEntry[];
    families?: readonly FamilyDef[];
    decks?: readonly FactDeck[];
    terms?: readonly TermEntry[];
    candos?: readonly CanDoDef[];
    capstones?: readonly CapstoneMeta[];
    checkpoints?: readonly CheckpointMeta[];
    templates?: readonly GymTemplate[];
  };
}

export function buildBundle(parts: ContentParts): ContentBundle {
  const reg = parts.registries ?? {};
  const generated = parts.toolbox !== undefined || parts.skillGraph !== undefined;
  const version =
    parts.index &&
    typeof parts.index === "object" &&
    typeof (parts.index as { contentVersion?: unknown }).contentVersion === "string"
      ? (parts.index as { contentVersion: string }).contentVersion
      : null;
  const syllabus = reg.syllabus ?? null;
  const capstones = [...(reg.capstones ?? reg.syllabus?.capstones ?? [])];
  const checkpoints = [...(reg.checkpoints ?? reg.syllabus?.checkpoints ?? [])];
  // Every lint and grader host is started from this toolbox, so naming the unlock sites here is what makes a
  // lock message say "`n` unlocks in the lesson “Scale Degrees in Code”" everywhere, never "in U03.L02".
  const toolbox = withUnlockNames(
    Array.isArray(parts.toolbox) ? (parts.toolbox as ToolEntry[]) : [...(reg.toolbox ?? [])],
    unlockSiteNamer(syllabus, checkpoints, capstones),
  );
  const skills =
    parts.skillGraph !== undefined
      ? normalizeSkillGraph(parts.skillGraph)
      : skillGraphFromDefs(reg.skills ?? []);
  return {
    version,
    source: generated ? "generated" : "registries",
    toolbox,
    skills,
    lessons: normalizeLessons(parts.lessons),
    syllabus,
    families: [...(reg.families ?? [])],
    decks: [...(reg.decks ?? [])],
    terms: [...(reg.terms ?? [])],
    candos: [...(reg.candos ?? [])],
    capstones,
    checkpoints,
    templates: [...(reg.templates ?? [])],
  };
}

/**
 * How the learner knows each session that can unlock a tool: a lesson (core or track) by its title, a checkpoint
 * by its title ("Interval checkpoint"), a capstone session by its capstone's title ("C1 First Loop").
 */
export function unlockSiteNamer(
  syllabus: SyllabusDef | null,
  checkpoints: readonly CheckpointMeta[],
  capstones: readonly CapstoneMeta[],
): (site: string) => UnlockSiteName | undefined {
  const names = new Map<string, UnlockSiteName>();
  for (const u of syllabus?.units ?? [])
    for (const l of u.lessons) names.set(l.id, { kind: "lesson", title: l.title });
  for (const c of [...(syllabus?.checkpoints ?? []), ...checkpoints])
    names.set(c.id, { kind: "checkpoint", title: c.title });
  for (const c of [...(syllabus?.capstones ?? []), ...capstones])
    names.set(c.id, { kind: "capstone", title: c.title });
  return (site) => names.get(site) ?? names.get(site.replace(/\.S\d+$/, ""));
}

/**
 * Toolbox rows with the learner's words for their unlock sites (`NamedToolEntry` in @oak/grader, whose lint reads
 * them). Done here rather than with the grader's own `nameUnlockSites` so this module stays free of the grader's
 * runtime; a row with any unknown site is left as it was.
 */
export function withUnlockNames(
  toolbox: readonly ToolEntry[],
  name: (site: string) => UnlockSiteName | undefined,
): NamedToolEntry[] {
  return toolbox.map((entry) => {
    const sites = Array.isArray(entry.unlock.at) ? entry.unlock.at : [entry.unlock.at];
    const names = sites.map((s) => name(s as string));
    return names.every((n): n is UnlockSiteName => n !== undefined)
      ? { ...entry, unlockNames: names }
      : entry;
  });
}

/** Lesson title lookup over the syllabus (`U01.L02` → "Four on the floor"). */
export function lessonTitles(syllabus: SyllabusDef | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const u of syllabus?.units ?? []) for (const l of u.lessons) m.set(l.id, l.title);
  for (const c of syllabus?.capstones ?? []) m.set(c.id, c.title);
  for (const c of syllabus?.checkpoints ?? []) m.set(c.id, c.title);
  return m;
}

/** Human title for a map item ID, falling back to the ID itself. */
export function titleOf(id: string | null | undefined, titles: Map<string, string>): string {
  if (!id) return "";
  const own = titles.get(id);
  if (own) return own;
  // A capstone session (`C0.S1`, `X1.S2`, `CF-T.S1`) reads as its capstone, with the session number past the first.
  const m = /^([A-Z][A-Z0-9-]*?)\.S(\d+)$/.exec(id);
  const cap = m ? titles.get(m[1] as string) : undefined;
  if (m && cap) return m[2] === "1" ? cap : `${cap} · session ${m[2]}`;
  return id;
}

export const TOOL_KIND_LABEL: Record<string, string> = {
  tool: "Code",
  sound: "Sounds",
  scale: "Scales",
  chord: "Chords",
  feature: "Features",
  template: "Templates",
  lens: "Lenses",
};

/** The (first) session that unlocks a tool. */
export function unlockSite(t: Pick<ToolEntry, "unlock">): string {
  const at = t.unlock.at;
  return Array.isArray(at) ? (at[0] ?? "") : at;
}
