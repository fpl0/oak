// Oak 2.0 W4 F2 "Is it better, or just different?" (Diminishing Returns): when the learner's last edits only change
// numbers, or come back to an earlier draft, Oak offers a blind A/B of the newest earlier draft that passed its check
// against the draft now, at the same loudness, and asks "Which is better? If you can't tell, it may be done." The
// learner judges; Oak never says which is better and stores nothing about the choice (PLAN §2 rule 3).
//
// The trigger is the KIND of the recent edits (X18's `classifyRecentEdits`, passed in as `classify`), never a count of
// versions (PLAN §10 call 5). Pure: the card (`BetterOrDifferent.tsx`) feeds it the check history and the draft.
import type { CapstoneCheckHistoryEntry, SketchVersion } from "@oak/api";
import type { EditKind, EditVersion } from "./edit-kind.ts";

/** X18's types (`edit-kind.ts`): what the recent edits did, and one draft of the window its classifier reads. */
export type { EditKind, EditVersion };

/** 32-bit FNV-1a of a string (UTF-16 code units). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Which side is "1" in the blind A/B: an even FNV-1a hash of the seed puts the earlier draft first. */
export function blindOrder(seed: string): readonly ["earlier", "current"] | readonly ["current", "earlier"] {
  return fnv1a(seed) % 2 === 0 ? (["earlier", "current"] as const) : (["current", "earlier"] as const);
}

export interface Nudge {
  kind: "tweaks" | "swing-back";
  /** The newest earlier draft that passed its check. */
  earlier: { version: number; code: string };
  /** The draft now: the newest saved version, or `version: null` for live code ahead of it. */
  current: { version: number | null; code: string };
  /** `<capstoneId>:<earlier.version>:<current.version ?? "live">`: fixes which side is "1". */
  seed: string;
}

/**
 * Code with comments and whitespace removed (a space kept between two words), strings untouched: "the same draft, whitespace and
 * comments aside". (X18's `normCode` does the same for the classifier; this one only decides equality here.)
 */
export function sameDraftText(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;
  let space = false;
  // A space survives only between two word characters (`const a`): `note("c2")\n  .s(…)` reads as `note("c2").s(…)`.
  const word = /[\w$]/;
  const push = (s: string) => {
    if (space && out !== "" && word.test(out.at(-1) as string) && word.test(s[0] as string)) out += " ";
    space = false;
    out += s;
  };
  while (i < n) {
    const c = code[i] as string;
    const next = code[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && code[i] !== "\n") i++;
      space = true;
    } else if (c === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      i = end < 0 ? n : end + 2;
      space = true;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && code[j] !== c) j += code[j] === "\\" ? 2 : 1;
      push(code.slice(i, Math.min(n, j + 1)));
      i = j + 1;
    } else if (/\s/.test(c)) {
      space = true;
      i++;
    } else {
      push(c);
      i++;
    }
  }
  return out;
}

const sameDraft = (a: string, b: string): boolean => sameDraftText(a) === sameDraftText(b);

export interface NudgeInput {
  capstoneId: string;
  /** `capstones.checkHistory`, oldest first. */
  history: readonly CapstoneCheckHistoryEntry[];
  /** The draft sketch, once saved. */
  sketchId: string | null;
  versions: readonly Pick<SketchVersion, "version" | "code" | "analysis">[];
  liveCode: string;
  /** Passing versions the learner said "Not now" to (`sessionStorage` `oak.nudge.<capstoneId>`). */
  dismissed: ReadonlySet<number>;
}

/**
 * The nudge, or `null`. `earlier` is the newest passing check of this draft at a version below its newest one whose
 * code differs from the live code; the window the classifier reads runs from it to the newest version, plus the live
 * code when it is ahead. A "Not now" for a passing version holds until a newer passing check (a version above every
 * dismissed one). `classify` of `tweaks` or `swing-back` gives a nudge of that kind; `changes` gives none.
 */
export function nudgeOf(i: NudgeInput, classify: (v: readonly EditVersion[]) => EditKind): Nudge | null {
  if (i.sketchId === null || i.versions.length === 0) return null;
  const sorted = [...i.versions].sort((a, b) => a.version - b.version);
  const newest = sorted.at(-1) as (typeof sorted)[number];
  const codeOf = new Map(sorted.map((v) => [v.version, v.code] as const));
  let earlier: { version: number; code: string } | null = null;
  for (let k = i.history.length - 1; k >= 0; k--) {
    const e = i.history[k] as CapstoneCheckHistoryEntry;
    if (!e.passed || e.sketchId !== i.sketchId || e.sketchVersion >= newest.version) continue;
    const code = codeOf.get(e.sketchVersion);
    if (code === undefined || sameDraft(code, i.liveCode)) continue;
    earlier = { version: e.sketchVersion, code };
    break;
  }
  if (earlier === null) return null;
  const at = earlier.version;
  // "Not now" waits for a passing check newer than the one dismissed: an older draft never comes back in its place.
  if ([...i.dismissed].some((d) => d >= at)) return null;
  const live = !sameDraft(i.liveCode, newest.code);
  const window: EditVersion[] = sorted
    .filter((v) => v.version >= at)
    .map((v) => ({ version: v.version, code: v.code, analysis: v.analysis ?? null }));
  if (live) window.push({ version: null, code: i.liveCode, analysis: null });
  const kind = classify(window);
  if (kind === "changes") return null;
  const current = live ? { version: null, code: i.liveCode } : { version: newest.version, code: newest.code };
  return { kind, earlier, current, seed: `${i.capstoneId}:${at}:${current.version ?? "live"}` };
}

/** Every learner-facing string of the nudge card (checked with `isDescriptive` in `nudge.test.ts`). */
export const NUDGE_COPY = {
  title: "Is it better, or just different?",
  tweaks: "Your last edits only change numbers.",
  "swing-back": "Your last edits come back to an earlier draft.",
  ask: "Listen to both at the same loudness without knowing which is which. Which is better? If you can't tell, it may be done.",
  one: "1 is better",
  two: "2 is better",
  cantTell: "I can't tell",
  notNow: "Not now",
  keep: "Keep my draft",
  keepIt: "Then keep it.",
  maybeDone: "Then it may be done. You can release it, or keep going.",
  goBack: (n: number) => `Go back to version ${n}`,
  /** "1 was version 2, the draft you checked; 2 is your draft now." in blind order. */
  reveal: (order: ReturnType<typeof blindOrder>, earlierVersion: number): string => {
    const earlier = `was version ${earlierVersion}, the draft you checked`;
    const current = "is your draft now";
    return order[0] === "earlier" ? `1 ${earlier}; 2 ${current}.` : `1 ${current}; 2 ${earlier}.`;
  },
} as const;

/** The `sessionStorage` key of the passing versions dismissed with "Not now". */
export const nudgeDismissKey = (capstoneId: string): string => `oak.nudge.${capstoneId}`;

/** The dismissed versions (an empty set when storage is unavailable or holds something else). */
export function readDismissed(capstoneId: string): Set<number> {
  try {
    const raw = globalThis.sessionStorage?.getItem(nudgeDismissKey(capstoneId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is number => Number.isInteger(x)) : []);
  } catch {
    return new Set();
  }
}

/** Adds one passing version to the dismissed set; returns the new set. */
export function writeDismissed(capstoneId: string, version: number): Set<number> {
  const next = readDismissed(capstoneId);
  next.add(version);
  try {
    globalThis.sessionStorage?.setItem(nudgeDismissKey(capstoneId), JSON.stringify([...next]));
  } catch {
    /* private mode: the dismissal lasts this render only */
  }
  return next;
}
