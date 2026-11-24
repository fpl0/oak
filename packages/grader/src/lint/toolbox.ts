// The toolbox as the lint reads it: every row of content/toolbox.ts (passed in as data) indexed by the
// names code uses to reach it. Keys are namespaced: `fn:scale`, `mini:repeat`, `snd:bd`, `bank:RolandTR909`,
// `scale:major`, `dict:triads`, `mode:root`, `chord.triad` (a chord family is its own ID).
//
// A row's `matches` wins; without it the names are derived from the ID and the code form, so a table
// written straight from contracts §3.2 works without annotations.
import type { ToolEntry, UnlockableId } from "@oak/content-kit";
import { MINI_OP_SYMBOLS, MINI_OPS, type MiniOp } from "./mini.ts";

export interface ToolIndex {
  readonly size: number;
  byKey: Map<string, ToolEntry>;
  byId: Map<string, ToolEntry>;
  lookup(key: string): ToolEntry | undefined;
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SYMBOL_TO_OP = new Map<string, MiniOp>();
for (const op of MINI_OPS)
  for (const s of MINI_OP_SYMBOLS[op]) if (!SYMBOL_TO_OP.has(s)) SYMBOL_TO_OP.set(s, op);

/** Names of the calls in a code form: `.attack() .decay()` → attack, decay; `` `sine` `saw` `` → sine, saw. */
function calledNames(code: string): string[] {
  const out = new Set<string>();
  for (const m of code.matchAll(/\.?([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) out.add(m[1] as string);
  for (const m of code.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)) out.add(m[1] as string);
  return [...out];
}

function keysFor(entry: ToolEntry): string[] {
  const id = entry.id as string;
  const parts = id.split(".");
  const last = parts[parts.length - 1] as string;
  const keys: string[] = [];
  if (entry.matches?.length) {
    for (const m of entry.matches) {
      switch (entry.kind) {
        case "sound":
          keys.push(id.startsWith("snd.bank.") || /\bbank\(/.test(entry.code) ? `bank:${m}` : `snd:${m}`);
          break;
        case "scale":
          keys.push(`scale:${m}`);
          break;
        case "chord":
          keys.push(`chordsym:${m}`);
          break;
        default: {
          const op = SYMBOL_TO_OP.get(m);
          if (id.startsWith("tb.mini.") && op) keys.push(`mini:${op}`);
          else if (IDENT.test(m)) keys.push(`fn:${m}`);
          else if (op) keys.push(`mini:${op}`);
        }
      }
    }
    return keys;
  }
  switch (entry.kind) {
    case "sound":
      if (id.startsWith("snd.bank.") || /\bbank\(/.test(entry.code))
        keys.push(`bank:${id.startsWith("snd.bank.") ? parts.slice(2).join(".") : last}`);
      else keys.push(`snd:${last}`);
      break;
    case "scale":
      for (const m of entry.code.matchAll(/X\d?:([a-z]+(?::[a-z]+)*)/g)) keys.push(`scale:${m[1]}`);
      if (keys.length === 0) keys.push(`scale:${parts.slice(1).join(".")}`);
      break;
    case "chord":
      break; // chord families are matched by ID through the theory table
    case "tool":
      if (id.startsWith("tb.mini.")) {
        const op = parts.slice(2).join(".");
        if ((MINI_OPS as readonly string[]).includes(op)) keys.push(`mini:${op}`);
      } else if (id.startsWith("tb.dict.")) keys.push(`dict:${parts.slice(2).join(".")}`);
      else if (id.startsWith("tb.mode.")) keys.push(`mode:${parts.slice(2).join(".")}`);
      else if (parts.length === 2) {
        keys.push(`fn:${last}`);
        for (const n of calledNames(entry.code)) keys.push(`fn:${n}`);
      }
      break;
    default:
      break; // features, templates and lenses are not reached through code
  }
  return keys;
}

/** Aliases Strudel accepts for a catalogued name. */
const FN_ALIASES: Readonly<Record<string, string>> = { sound: "s", oct: "octave" };

export function indexToolbox(toolbox: readonly ToolEntry[]): ToolIndex {
  const byKey = new Map<string, ToolEntry>();
  const byId = new Map<string, ToolEntry>();
  // Priority: explicit `matches`, then `tb.<name>` rows (the name is the ID), then names from code forms.
  const explicit = toolbox.filter((e) => e.matches?.length);
  const implicit = toolbox.filter((e) => !e.matches?.length);
  for (const e of toolbox) byId.set(e.id, e);
  for (const e of explicit) for (const k of keysFor(e)) if (!byKey.has(k)) byKey.set(k, e);
  for (const e of implicit) {
    const own = `fn:${(e.id as string).split(".").slice(1).join(".")}`;
    if (e.kind === "tool" && keysFor(e).includes(own) && !byKey.has(own)) byKey.set(own, e);
  }
  for (const e of implicit) for (const k of keysFor(e)) if (!byKey.has(k)) byKey.set(k, e);
  return {
    get size() {
      return byId.size;
    },
    byKey,
    byId,
    lookup(key: string) {
      const hit = byKey.get(key);
      if (hit) return hit;
      if (key.startsWith("fn:")) {
        const alias = FN_ALIASES[key.slice(3)];
        if (alias) return byKey.get(`fn:${alias}`);
      }
      return undefined;
    },
  };
}

/** How the learner knows a session that unlocks something: its kind and its title from the syllabus. */
export interface UnlockSiteName {
  kind: "lesson" | "checkpoint" | "capstone";
  title: string;
}

/**
 * A toolbox row that also carries the learner's words for its unlock sites, one per `unlock.at` entry in the same
 * order. The grader is pure and has no syllabus, so whoever starts a host passes rows named by `nameUnlockSites`;
 * a row without them (tests, the content linter) still says the bare session ID.
 */
export type NamedToolEntry = ToolEntry & { readonly unlockNames?: readonly UnlockSiteName[] };

/** Rows with `unlockNames` filled from `name`; a row with any site `name` does not know is left as it was. */
export function nameUnlockSites(
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

/**
 * The session(s) that unlock an entry, for messages: "the lesson “Degrees in Code”", "the lesson “A” or
 * “B”", "the Interval checkpoint", "the capstone “C1 First Loop”". Learner copy never names a lesson by its bare
 * ID (U03.L02), so the ID is said only when the row carries no names.
 */
export function unlockText(entry: ToolEntry | undefined): string {
  if (!entry) return "a later lesson";
  const names = (entry as NamedToolEntry).unlockNames;
  if (names && names.length > 0) {
    if (names.every((n) => n.kind === "lesson"))
      return `the lesson ${names.map((n) => `“${n.title}”`).join(" or ")}`;
    return names
      .map((n) =>
        n.kind === "lesson"
          ? `the lesson “${n.title}”`
          : n.kind === "checkpoint"
            ? `the ${n.title}` // its title already says "checkpoint": "the Interval checkpoint"
            : `the capstone “${n.title}”`,
      )
      .join(" or ");
  }
  return unlockIds(entry);
}

/** The session ID(s) that unlock an entry ("U10.L09 or A1.L04"): data for the app (`params.at`), not learner copy. */
export function unlockIds(entry: ToolEntry | undefined): string {
  if (!entry) return "a later lesson";
  const at = entry.unlock.at;
  return Array.isArray(at) ? at.join(" or ") : at;
}

export type UsedId = UnlockableId;
