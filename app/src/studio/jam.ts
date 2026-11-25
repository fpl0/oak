// Oak 2.0 W1 (PLAN §4 S3 jam then edit, S4 focus one part). Jam is for making: while it is on, Studio hides every
// critique (the tutor waits, no hint or tip callout, no A/B compare, only lint errors in the editor) and every Run
// that saves is a take. The rough-pass row and the timebox only describe; focus mutes the other lines. Studio never
// scores (W1 fidelity rule 1): every string here passes `isDescriptive` (jam.test.ts).
import { labelledLines, roleOfLabel, type StudioRole } from "@oak/content-kit";
import type { MuteMap } from "@oak/strudel";

/** What the sketch editor shows around the code. */
export interface StudioChrome {
  /** The tutor answers (`TutorSubject.tutorOpen`). */
  tutorOpen: boolean;
  /** The "coming in a later lesson" hint callouts. */
  hints: boolean;
  /** The "this view is open for you" tip lines. */
  tips: boolean;
  /** The A/B compare with an earlier version. */
  compare: boolean;
  /** Which lint findings the editor shows (`EditorHandle.setLintFloor`). */
  lintFloor: "info" | "error";
}

const JAM_CHROME: StudioChrome = {
  tutorOpen: false,
  hints: false,
  tips: false,
  compare: false,
  lintFloor: "error",
};
const EDIT_CHROME: StudioChrome = {
  tutorOpen: true,
  hints: true,
  tips: true,
  compare: true,
  lintFloor: "info",
};

/** Jam hides every hint, tip and compare and floors lint at errors; editing shows them all (W1 fidelity rule 2). */
export function studioChrome(o: { jam: boolean }): StudioChrome {
  return { ...(o.jam ? JAM_CHROME : EDIT_CHROME) };
}

/** The tutor's refusal while Jam is on (not the checkpoint copy). */
export const JAM_TUTOR_NOTICE = "Jam is on: the tutor waits until you switch to editing.";

/** Learner-facing words of the jam bar, the timebox and focus (each checked by `isDescriptive`). */
export const JAM_WORDS = {
  jam: "Jam",
  jamTitle:
    "Play freely: every Run is kept as a take. The tutor, hints and compare wait until you switch to editing.",
  jamOn: "Jam is on. Every Run is kept as a take; the tutor, hints and compare wait.",
  switchToEditing: "Switch to editing",
  timebox: "Timebox",
  timeboxTask: "What is this jam for?",
  timeboxTaskPlaceholder: "a groove, a bass line…",
  timeboxLength: "How long",
  timeboxStart: "Start the clock",
  timeboxStop: "Stop the clock",
  timeboxLeft: "left",
  roughPass: "What's in this take",
  roughPassTitle: "A plain line about the parts in your last Run.",
  roughPassListen: "Listen past the sounds and the mix: how are the notes?",
  roughPassEmpty: "Run the code to see what this take has.",
  focus: "Focus one part",
  focusTitle: "Solo the line under the cursor and lock the others while you work on it.",
  focusNoLine: "Put the cursor on a labelled line, like bass: …, then focus.",
  focusEnd: "End focus",
  focusOthersMuted: "Muted while you focus:",
  yes: "Yes",
  notYet: "Not yet",
} as const;

/** Focus's self-check: the learner does the listening (W1 fidelity rule 6); the answer is never stored. */
export const FOCUS_ASK = "Could this part be released on its own?";
export const FOCUS_YES = "Then it can meet the others.";
export const FOCUS_NOT_YET = "Stay with it a little longer.";

/** The words for focusing on one line. */
export function focusLine(label: string): string {
  return `Focusing on “${label}”. The other lines are muted and locked until you end focus.`;
}

// --- rough pass -----------------------------------------------------------------------------------

const ROLE_ORDER: readonly Exclude<StudioRole, "other">[] = ["drums", "bass", "chords", "tune"];

const listOf = (words: readonly string[]): string =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;

/**
 * One plain line about the parts a Run's code has: from its unmuted labelled lines by `roleOfLabel`, in the fixed
 * order drums, bass, chords, tune. `other` labels are not named. It describes only: no tick, no count, no verdict.
 */
export function roughPassLine(code: string): string {
  const present = new Set<StudioRole>();
  for (const l of labelledLines(code)) if (!l.muted) present.add(roleOfLabel(l.label));
  const has = ROLE_ORDER.filter((r) => present.has(r));
  if (has.length === 0) return "This take has no part yet.";
  const hasWords = listOf(has.map((r) => (r === "tune" ? "a tune" : r)));
  return `This take has ${hasWords}.`;
}

// --- timebox --------------------------------------------------------------------------------------

/** Oak's call: a few loose lengths to pick from; none is preselected or shown as a target (W1 fidelity rule 5). */
export const TIMEBOX_MINUTES = [5, 10, 15, 20, 25] as const;

export interface Timebox {
  task: string;
  minutes: number;
  /** `Date.now()` when the clock started. */
  startedAt: number;
}

/** Time left on the clock, never negative; `up` once it reaches zero (Oak never stops the playback). */
export function timeboxLeft(t: Timebox, now: number): { leftMs: number; up: boolean } {
  const leftMs = Math.max(0, t.startedAt + t.minutes * 60_000 - now);
  return { leftMs, up: leftMs === 0 };
}

/** The stop-and-break line when the clock runs out; playback stays with the learner. */
export function timeUpLine(task: string): string {
  return `Time's up for “${task}”. Stop here and take a short break.`;
}

/** `m:ss` for the quiet clock. */
export function clockText(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// --- focus one part -------------------------------------------------------------------------------

/** The mutes that leave only `focus` sounding among the learner's lines; `null` → no learner mutes. */
export function focusMutes(labels: readonly string[], focus: string | null): MuteMap {
  if (focus === null) return { muted: new Set(), solo: null };
  return { muted: new Set(labels.filter((l) => l !== focus)), solo: null };
}
