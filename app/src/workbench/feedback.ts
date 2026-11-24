// FeedbackPanel logic (ux §3.5–§3.7): the hint-ladder UI state, what each rung unlocks in the panel
// (A/B from rung 2, ghost notes from rung 3), and the mapping of a redacted `GradeView` onto the views
// (issue rings on events, editor marks on code ranges, row text "Bar 2, beat 3"). The server owns the
// rung itself (`steps.hint`); this is only the UI's mirror of it. Pure.
import type { CodeRange, GradeView, Hint, HintLadder, HintRung, IssueView, NEvent } from "@oak/content-kit";
import { RUNG_RULES } from "@oak/content-kit";
import type { IssueMark } from "./highlight-bus.ts";

export interface LadderState {
  rung: HintRung;
  /** True while a hint request is in flight (the button is busy). */
  pending: boolean;
}

export type LadderAction =
  | { type: "request" }
  | { type: "granted"; rung: HintRung }
  | { type: "failed" }
  | { type: "reset" };

export function ladderReducer(state: LadderState, action: LadderAction): LadderState {
  switch (action.type) {
    case "request":
      return state.rung >= 4 || state.pending ? state : { ...state, pending: true };
    case "granted":
      // The rung never goes down within a series.
      return { rung: Math.max(state.rung, action.rung) as HintRung, pending: false };
    case "failed":
      return { ...state, pending: false };
    case "reset":
      return { rung: 0, pending: false };
  }
}

export function rungName(rung: HintRung): string {
  return RUNG_RULES[rung].name;
}

/** The hint text shown at each rung reached so far (rung 1 = nudge … rung 4 = reveal). */
export function visibleHints(
  ladder: HintLadder | null | undefined,
  rung: HintRung,
): { rung: HintRung; hint: Hint | "auto" }[] {
  if (!ladder) return [];
  const out: { rung: HintRung; hint: Hint | "auto" }[] = [];
  for (let r = 1; r <= rung; r++) {
    const h = ladder[r - 1];
    if (h !== undefined) out.push({ rung: r as HintRung, hint: h });
  }
  return out;
}

/** What the panel may offer at a rung: A/B from rung 2 (`fromHint2`) or always; ghosts from rung 3. */
export function unlocks(
  rung: HintRung,
  opts: { abAudible?: "always" | "fromHint2" | "never"; passed?: boolean } = {},
): { ab: boolean; ghosts: boolean; nextLabel: string | null } {
  const level = opts.passed ? 4 : rung;
  const audible = opts.abAudible ?? "fromHint2";
  const ab = audible === "always" || (audible === "fromHint2" && level >= 2);
  const ghosts = level >= 3;
  const nextLabel = rung >= 4 ? null : (["Nudge", "Pointer", "Partial", "Reveal"][rung] ?? null);
  return { ab, ghosts, nextLabel };
}

/**
 * Triplet places ("2-trip", "2-let") said in plain words beside the count, so a hit that lands on a triplet before
 * triplets are taught (U13.L05) still says where it is (clarity pass, 2026-11-22).
 */
export function plainBeats(text: string): string {
  return text
    .replace(/\b(\d+)-trip\b(?! \()/g, (_m, n: string) => `${n}-trip (a third of the way through beat ${n})`)
    .replace(
      /\b(\d+)-let\b(?! \()/g,
      (_m, n: string) => `${n}-let (two thirds of the way through beat ${n})`,
    );
}

/** "Bar 2, beat 3" (rung 0 always says where); "" for a finding with no place in the music. */
export function whereText(issue: Pick<IssueView, "where">): string {
  const w = issue.where;
  const parts: string[] = [];
  if (w.track) parts.push(w.track);
  if (w.bar !== undefined) parts.push(`Bar ${w.bar}`);
  if (w.beatLabel) parts.push(plainBeats(`beat ${w.beatLabel}`));
  else if (w.beat !== undefined) parts.push(`beat ${w.beat}`);
  if (w.rule) parts.push(w.rule);
  // Never "Somewhere in the piece": it told the learner nothing, and the finding's own words follow.
  return parts.join(", ");
}

/** Rung-0 summary: "2 notes differ: bars 2 and 4." Never "Wrong!", no exclamation marks. */
export function summaryText(view: GradeView): string {
  if (view.status === "pass") return "That's it.";
  if (view.status === "error") return "Code didn't run.";
  if (view.status === "ungraded") return "Not graded.";
  const n = view.counts.missing + view.counts.extra + view.counts.wrong;
  const bars = [
    ...new Set(view.issues.map((i) => i.where.bar).filter((b): b is number => b !== undefined)),
  ].sort((a, b) => a - b);
  const what =
    n === 0
      ? `${view.issues.length} thing${view.issues.length === 1 ? "" : "s"} to look at`
      : n === 1
        ? "1 note differs"
        : `${n} notes differ`;
  if (bars.length === 0) return `${what}.`;
  const list =
    bars.length === 1
      ? `bar ${bars[0]}`
      : `bars ${bars.slice(0, -1).join(", ")} and ${bars[bars.length - 1]}`;
  return `${what}: ${list}.`;
}

export interface ViewMarks {
  /** Event ID → severity, for roll rings and `.oak-issue` staff notes. */
  issues: Map<string, IssueMark>;
  /** Editor marks. */
  code: { range: CodeRange; kind: "error" | "hint" }[];
  /** Bars (1-based) that carry an issue without note IDs: the roll rings the bar/beat instead. */
  barMarks: { bar: number; beat: number | null; severity: IssueMark }[];
}

function markOf(sev: IssueView["severity"]): IssueMark | null {
  if (sev === "error") return "error";
  if (sev === "warn") return "warn";
  if (sev === "info") return "info";
  return null;
}

/** Projects the issues of a redacted view onto the roll, the staff and the editor. */
export function marksOf(view: GradeView | null): ViewMarks {
  const issues = new Map<string, IssueMark>();
  const code: ViewMarks["code"] = [];
  const barMarks: ViewMarks["barMarks"] = [];
  if (!view) return { issues, code, barMarks };
  for (const issue of view.issues) {
    const sev = markOf(issue.severity);
    if (!sev) continue;
    const ids = issue.where.noteIds ?? [];
    for (const id of ids) if (!issues.has(id) || sev === "error") issues.set(id, sev);
    for (const range of issue.where.code ?? [])
      code.push({ range, kind: sev === "error" ? "error" : "hint" });
    if (ids.length === 0 && issue.where.bar !== undefined) {
      barMarks.push({ bar: issue.where.bar, beat: issue.where.beat ?? null, severity: sev });
    }
  }
  return { issues, code, barMarks };
}

/** Ghost notes as roll events: dashed outlines in the target's degree colour (rung ≥ 3 only). */
export function ghostEvents(
  view: GradeView | null,
): { id: string; onset: number; end: number; midi: number | null; track: string; s?: string }[] {
  if (!view) return [];
  return view.ghosts.map((e: NEvent) => {
    const onset = e.onset[0] / e.onset[1];
    const out: { id: string; onset: number; end: number; midi: number | null; track: string; s?: string } = {
      id: `ghost:${e.id}`,
      onset,
      end: onset + e.dur[0] / e.dur[1],
      midi: e.midi,
      track: e.track,
    };
    if (e.s !== undefined) out.s = e.s;
    return out;
  });
}
