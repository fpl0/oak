// Oak 2.0 W3 (PLAN §4 S5 "Creating Variation"): siblings and generations. A sibling is a copy of one version that
// changes one dimension the learner picks; a generation is the next child in a chain, each changing one dimension
// against its parent. Runs in between are ordinary versions and never become parents: a kept generation names the
// chain's tip (`chainTip`), kept in this browser's session as a draft until the learner keeps or drops it.
// The sentences describe what changed and never judge it (PLAN §2: Studio describes, never scores).
import { SKETCH_DIMENSIONS, type SketchDimension, type SketchLineage, type SketchVersion } from "@oak/api";
import type { Dimension } from "@oak/grader";

export type VariationMode = "sibling" | "generation";
export interface VariationDraft {
  mode: VariationMode;
  /** The version the draft is a child of: the sibling's parent, or the chain's tip when the draft started. */
  parentVersion: number;
  dimension: SketchDimension;
}
/** What the Variation panel keeps per sketch in this browser's session (`oak.variation.<sketchId>`). */
export interface VariationState {
  draft: VariationDraft | null;
  /** The version the learner's chain of generations started from; `null` before the first generation. */
  chainStart: number | null;
  /** The version the learner's siblings are copies of; `null` before the first sibling. */
  siblingParent: number | null;
}

export const DIMENSION_WORDS: Readonly<Record<SketchDimension, string>> = {
  sound: "the sound",
  rhythm: "the rhythm",
  notes: "the notes",
  harmony: "the harmony",
  form: "the form",
};
/** The dimension as a button says it ("Rhythm"). */
export const DIMENSION_NAMES: Readonly<Record<SketchDimension, string>> = {
  sound: "Sound",
  rhythm: "Rhythm",
  notes: "Notes",
  harmony: "Harmony",
  form: "Form",
};

/** Every learner-facing string of the Variation panel (checked with `isDescriptive` in model.test.ts). */
export const VARIATION_WORDS = {
  title: "Variation",
  siblingsTab: "Siblings",
  generationsTab: "Generations",
  siblingsIntro:
    "Copies of one version, each changing one thing you pick. Oak plays them back to back and says what changed.",
  generationsIntro:
    "A chain of versions: each generation changes one thing you pick against the one before it.",
  addSibling: "Add a sibling",
  nextGeneration: "Next generation",
  pickDimension: "What will this one change?",
  changeIt: "Change it",
  notNow: "Not now",
  dropDraft: "Drop this one",
  keepSibling: "Keep this sibling",
  saveFirst: "The code in the editor is not a saved version yet. Run it to save it as a version first.",
  runToSave: "Run it",
  parentIs: "Parent",
  noSiblings: "No siblings of this version yet.",
  noChain: "No generations yet.",
  playSiblings: "Play them back to back",
  playChain: "Play the chain",
  chainPending: "The chain view arrives with this update.",
  chainUnread: "The chain could not be read just now.",
  reading: "Listening for what changed…",
  unreadable: "Oak could not play one of the two versions, so there is nothing to compare yet.",
  kept: "Kept",
  keepError: "Couldn't keep it",
  changeHint: "Edit the code and Run it as often as you like; keep it when you want it in the family.",
  start: "Start",
  imported: "That version came from a backup and waits for review; open it from the history first.",
  useCurrent: "Make the version in the editor the parent",
  newChain: "Start a new chain from the version in the editor",
  dimensionLegend: "Change one thing",
  keptSibling: "Sibling kept",
  keptGeneration: "Generation kept",
  keepGeneration: (n: number) => `Keep generation ${n}`,
  siblingNote: (d: SketchDimension) => `Sibling: ${d}`,
  generationNote: (n: number, d: SketchDimension) => `Generation ${n}: ${d}`,
  siblingRow: (i: number, d: SketchDimension) => `Sibling ${i}, picked ${DIMENSION_WORDS[d]}`,
  chainRow: (n: number, d: SketchDimension | null) =>
    d === null ? `Generation ${n}` : `Generation ${n}, changes ${DIMENSION_WORDS[d]}`,
  changing: (d: SketchDimension) => `Changing ${DIMENSION_WORDS[d]}.`,
  parentOf: (version: number) => `Parent: v${version}`,
  startOf: (version: number) => `Start: v${version}`,
} as const;

/** The fields a child of `parent` is saved with: generation 1 for a version outside any chain, else parent's + 1. */
export function childFields(
  parent: Pick<SketchVersion, "version" | "generation">,
  dimension: SketchDimension,
): { parentVersion: number; generation: number; dimension: SketchDimension } {
  return { parentVersion: parent.version, generation: (parent.generation ?? 0) + 1, dimension };
}

/** The fields to keep the draft with. Throws `RangeError` when the draft's parent is not in `versions`. */
export function keepFields(
  draft: VariationDraft,
  versions: readonly SketchVersion[],
): { parentVersion: number; generation: number; dimension: SketchDimension } {
  const parent = versions.find((v) => v.version === draft.parentVersion);
  if (!parent) throw new RangeError(`no version ${draft.parentVersion} in this sketch`);
  return childFields(parent, draft.dimension);
}

/** The children of `parentVersion` (a generation set), oldest first. */
export function childrenOf(versions: readonly SketchVersion[], parentVersion: number): SketchVersion[] {
  return versions
    .filter((v) => v.parentVersion === parentVersion && v.generation != null)
    .sort((a, b) => a.version - b.version);
}

const SIBLING_NOTE = "Sibling: ";
/** A version kept as a sibling (its note is `VARIATION_WORDS.siblingNote`). */
export const isSibling = (v: Pick<SketchVersion, "note">): boolean => (v.note ?? "").startsWith(SIBLING_NOTE);
/** The siblings of `parentVersion`, oldest first. */
export function siblingsOf(versions: readonly SketchVersion[], parentVersion: number): SketchVersion[] {
  return childrenOf(versions, parentVersion).filter(isSibling);
}
/** The versions a chain of generations can run through: every version except the kept siblings. */
export function generationsOnly(versions: readonly SketchVersion[]): SketchVersion[] {
  return versions.filter((v) => !isSibling(v));
}

/**
 * The newest version whose chain, followed by `parentVersion`, reaches `start`; `start` when none does. Ordinary Runs
 * name no parent, so they never become the tip.
 */
export function chainTip(versions: readonly SketchVersion[], start: number): number {
  const byVersion = new Map(versions.map((v) => [v.version, v]));
  const reaches = (v: SketchVersion): boolean => {
    const seen = new Set<number>();
    let at: SketchVersion | undefined = v;
    while (at && !seen.has(at.version)) {
      seen.add(at.version);
      if (at.parentVersion == null) return false;
      if (at.parentVersion === start) return true;
      at = byVersion.get(at.parentVersion);
    }
    return false;
  };
  let tip = start;
  for (const v of versions) if (v.version > tip && reaches(v)) tip = v.version;
  return tip;
}

const joinWords = (words: readonly string[]): string =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;

/** What changed against the parent, after the learner picked what to change. Never a verdict. */
export function describeChange(picked: SketchDimension, changed: readonly Dimension[]): string {
  if (changed.length === 0) return "Nothing has changed against its parent yet.";
  if (changed.length === 1 && changed[0] === picked) return `You changed ${DIMENSION_WORDS[picked]}.`;
  const ordered = SKETCH_DIMENSIONS.filter((d) => changed.includes(d));
  return `You picked ${DIMENSION_WORDS[picked]}. What changed: ${joinWords(ordered.map((d) => DIMENSION_WORDS[d]))}.`;
}

type LineageItem = SketchLineage["versions"][number];
/** "Generation 3 changes back what generation 2 changed." — a note, never a block; `null` when it does not apply. */
export function undoNote(item: LineageItem, parent: LineageItem | undefined): string | null {
  if (!item.undoesGrandparent || item.generation == null || parent?.generation == null) return null;
  return `Generation ${item.generation} changes back what generation ${parent.generation} changed.`;
}

// --- the draft, kept in this browser's session ------------------------------------------------------

const EMPTY: VariationState = { draft: null, chainStart: null, siblingParent: null };
const storageKey = (sketchId: string) => `oak.variation.${sketchId}`;
function storage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    const s = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    return s ?? null;
  } catch {
    return null;
  }
}
const isPositiveInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;
function draftOf(value: unknown): VariationDraft | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  if (d.mode !== "sibling" && d.mode !== "generation") return null;
  if (!isPositiveInt(d.parentVersion)) return null;
  if (!SKETCH_DIMENSIONS.includes(d.dimension as SketchDimension)) return null;
  return { mode: d.mode, parentVersion: d.parentVersion, dimension: d.dimension as SketchDimension };
}

/** The panel's state for this sketch; nothing kept (or anything unreadable) reads as no draft and no chain. */
export function readVariation(sketchId: string): VariationState {
  try {
    const raw = storage()?.getItem(storageKey(sketchId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const draft = draftOf(parsed.draft);
    const chainStart = isPositiveInt(parsed.chainStart) ? parsed.chainStart : null;
    const siblingParent = isPositiveInt(parsed.siblingParent) ? parsed.siblingParent : null;
    if (parsed.draft != null && draft === null) return EMPTY;
    return { draft, chainStart, siblingParent };
  } catch {
    return EMPTY;
  }
}

/** Keeps (or, when empty, clears) the panel's state for this sketch. Never throws. */
export function writeVariation(sketchId: string, state: VariationState): void {
  try {
    const s = storage();
    if (!s) return;
    if (state.draft === null && state.chainStart === null && state.siblingParent === null)
      s.removeItem(storageKey(sketchId));
    else s.setItem(storageKey(sketchId), JSON.stringify(state));
  } catch {
    // private mode or a full store: the draft lives in memory only
  }
}
