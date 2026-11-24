// The lesson on screen, as others see it (docs/design/wave2.md §3.2). The lesson machine publishes a
// `LessonSnapshot` on every change; the session runner reads the step for its heartbeat and the tutor bridge
// turns it into the tutor subject. Read-only for everyone but the lesson player.
import type { AttemptResponse } from "@oak/api";
import type { Exercise, KeySpec, StepDef } from "@oak/content-kit";
import { create } from "zustand";
import { noteName } from "../answers/harmony.ts";
import { qualityLabel } from "../answers/keys.ts";
import { answerText, type LabelState, type TutorAnswer, type TutorSubject } from "../tutor/context.ts";
import type { LessonEvent, LessonSnapshot } from "./types.ts";
import { wave7TutorText } from "./wave7.ts";

export const useLessonPublic = create<{ lesson: LessonSnapshot | null }>(() => ({ lesson: null }));

export function publishLesson(lesson: LessonSnapshot): void {
  useLessonPublic.setState({ lesson });
}

/** On unmount; with `lessonId`, only if that lesson is still the one published. */
export function clearLesson(lessonId?: string): void {
  const cur = useLessonPublic.getState().lesson;
  if (lessonId !== undefined && cur?.lessonId !== lessonId) return;
  useLessonPublic.setState({ lesson: null });
}

/** What the tutor reads besides the snapshot (Wave 3): the key, the step's own labels, the last non-code answer. */
export interface LessonSubjectExtra {
  key?: KeySpec | null;
  labels?: LabelState | null;
  answer?: TutorAnswer | null;
  /** Unit songs (contracts §5.11 rule 19): the song the lesson builds, for the tutor's song chip. */
  song?: { title: string } | null;
}

/** The tutor subject of a lesson snapshot (contracts §10.2: subject `lesson`, the context names the step). */
export function lessonSubject(l: LessonSnapshot, extra: LessonSubjectExtra = {}): TutorSubject {
  return {
    thread: { subjectKind: "lesson", subjectId: l.lessonId },
    title: `${l.lessonId} · ${l.title}`,
    tutorOpen: true,
    lessonId: l.lessonId,
    stepId: l.stepId,
    graded: l.graded,
    passed: l.passed,
    code: l.code,
    lastResult: l.lastResult,
    rung: l.rung,
    ...(extra.key !== undefined ? { key: extra.key } : {}),
    ...(extra.labels ? { labels: extra.labels } : {}),
    ...(extra.answer ? { answer: extra.answer } : {}),
    ...(extra.song ? { song: { title: extra.song.title } } : {}),
  };
}

/**
 * The labels a step shows itself (content's `ui.rollLabels` / `ui.staffLabels` win inside a step, wave3.md §4.3);
 * null when the step sets neither (the learner's lenses then speak for the screen).
 */
export function stepLabels(step: Pick<StepDef, "ui">): LabelState | null {
  const set: string[] = [];
  for (const l of [step.ui.rollLabels, step.ui.staffLabels]) if (typeof l === "string") set.push(l);
  if (set.length === 0) return null;
  return {
    degrees: set.some((l) => l.includes("degree")),
    solfege: set.some((l) => l.includes("solfege")),
    noteNames: set.includes("note"),
  };
}

/**
 * The learner's last answer on a step that is not written in code, in the form the tutor reads (`TutorAnswer`):
 * staff notes or a key signature, a sung take, a by-ear transcription, a typed answer. Never the expected
 * answer. Null for code steps (their code is the subject's `code`) and for answers the tutor has no words for.
 */
export function tutorAnswerOf(
  ex: Exercise,
  response: AttemptResponse,
  o: { key?: KeySpec | null; tolCents?: number } = {},
): TutorAnswer | null {
  if (ex.kind === "all") return allAnswer(ex, response, o);
  if (ex.kind === "sing") {
    const degrees = ex.target.from === "degrees" ? ex.target.degrees.map(String) : [];
    if ("skipped" in response) return { kind: "sung", notes: [], quiet: true };
    if (!("sung" in response)) return null;
    return {
      kind: "sung",
      notes: response.sung.map((n, i) => ({
        ...(degrees[i] !== undefined ? { target: degrees[i] } : {}),
        cents: n.midi === null ? null : n.cents,
      })),
      ...(o.tolCents !== undefined ? { tolCents: o.tolCents } : {}),
    };
  }
  if (ex.kind === "dictation" && ex.byEar && "code" in response)
    return { kind: "by-ear", code: response.code };
  const staff =
    (ex.kind === "staff-write" || ex.kind === "staff-read" || ex.kind === "dictation") && ex.answer;
  if (staff && staff.ui === "staff-input") {
    const key = staff.key ?? o.key ?? null;
    if ("staff" in response)
      return { kind: "staff", notes: response.staff, clef: staff.clef, key, mode: "notes" };
    if (staff.mode === "key-signature" && "answer" in response)
      return {
        kind: "staff",
        notes: (response.answer.text ?? []).join(" "),
        clef: staff.clef,
        key,
        mode: "key-signature",
      };
  }
  // Wave 7: a grouping, a Euclidean rhythm, two-lane taps, in words (never the step's `correct`).
  const w7 = wave7TutorText(ex, response);
  if (w7) return { kind: "text", prompt: ex.prompt, value: w7 };
  const w6 = "answer" in response ? wave6Answer(ex, response.answer as Wave6Answer) : null;
  if (w6) return w6;
  const w5 = "answer" in response ? wave5Answer(ex, response.answer as Wave5Answer, o.key ?? null) : null;
  if (w5) return w5;
  const w4 = "answer" in response ? wave4Answer(ex, response.answer as Wave4Answer, o.key ?? null) : null;
  if (w4) return w4;
  if ("answer" in response && response.answer.text && response.answer.text.length > 0)
    return { kind: "text", prompt: ex.prompt, value: response.answer.text.join(" ") };
  // An ear step's degrees, a picked option (by its label, never its ID: an ID can be code or the answer key's
  // own spelling), or a number: what the learner chose, in words.
  if ("answer" in response) {
    const a = response.answer;
    if (a.degrees && a.degrees.length > 0)
      return {
        kind: "text",
        prompt: ex.prompt,
        value: `${a.degrees.length === 1 ? "degree" : "degrees"} ${a.degrees.map(degreeWithSign).join(" ")}`,
      };
    if (a.choice && a.choice.length > 0 && "answer" in ex && ex.answer?.ui === "bar-buttons")
      // A drawn "which bar" trial answered on its own bars (U15.L06 S2, U17.L03 S4).
      return {
        kind: "text",
        prompt: ex.prompt,
        value: a.choice.map((c) => (c === "none" ? "no key change" : `bar ${c}`)).join(", "),
      };
    if (a.choice && a.choice.length > 0) {
      const options = "answer" in ex && ex.answer && "options" in ex.answer ? ex.answer.options : [];
      const labels = a.choice.map((id) => options.find((o) => o.id === id)?.label ?? id);
      return { kind: "text", prompt: ex.prompt, value: labels.join(", ") };
    }
    if (typeof a.number === "number") return { kind: "text", prompt: ex.prompt, value: String(a.number) };
  }
  return null;
}

/** A chromatic degree as the learner sees it on the pad: `#4` is ♯4, `b7` is ♭7 (U15 on). */
function degreeWithSign(d: string): string {
  return d.replace(/^#/, "♯").replace(/^b(?=\d)/, "♭");
}

interface Wave6Answer {
  choice?: string[];
}

/**
 * The Wave 6 answers the earlier shapes do not cover: the cells the learner switched on in a rhythm grid (U13's
 * 6/8 and 12/8 grids; the family's "find the push" cells `c14`), by step number and count. Never the answer.
 */
function wave6Answer(ex: Exercise, a: Wave6Answer): TutorAnswer | null {
  const spec = "answer" in ex && ex.answer && typeof ex.answer === "object" ? ex.answer : null;
  const ui = spec && "ui" in spec ? spec.ui : null;
  if (ui !== "grid" || !a.choice) return null;
  const steps =
    spec && "stepsPerBar" in spec && typeof spec.stepsPerBar === "number" ? spec.stepsPerBar : null;
  // Cells are step numbers from 0 ("4"), a family's "find the push" cells ("c14"), or "row:step" on a drum grid.
  const byRow = new Map<string, number[]>();
  for (const c of a.choice) {
    const m = /^(?:([^:]+):)?c?(\d+)$/.exec(c);
    if (!m) continue;
    const row = m[1] ?? "";
    byRow.set(row, [...(byRow.get(row) ?? []), Number(m[2]) + 1]);
  }
  const of = steps ? ` (of ${steps} in the bar)` : "";
  const rows = [...byRow].map(([row, ns]) => `${row ? `${row}: ` : ""}steps ${ns.join(", ")}`);
  return {
    kind: "text",
    prompt: ex.prompt,
    value: rows.length === 0 ? "no steps on yet" : `the steps I switched on${of}: ${rows.join("; ")}`,
  };
}

/** One part's answer as a short value for a slot ("Cmaj7", "bar 5", "degrees ♯4 5"); null if unanswered. */
function partValue(a: TutorAnswer | null): string | null {
  if (!a) return null;
  switch (a.kind) {
    case "text":
      return a.value;
    case "chords":
      return a.chords.map((c) => c.symbol).join(" ") || null;
    case "numerals":
      return a.numerals.map((n) => n.rn).join(" ") || null;
    case "staff":
      return a.notes.trim() || null;
    case "slots":
      return a.slots.map((x) => x.value ?? "(not answered)").join(", ");
    case "sung":
      return a.quiet
        ? "done without singing (Quiet mode)"
        : a.notes
            .map((n) => (n.cents === null ? "no voice" : `${n.cents > 0 ? "+" : ""}${n.cents}¢`))
            .join(" ");
    default:
      return answerText(a);
  }
}

/**
 * A step of several answers checked together (every Wave 6 ear step: four chord qualities, two bars, a mode per
 * clip): what the learner gave for each part, as slots ("Part 2: m7"). Only the learner's side.
 */
function allAnswer(
  ex: Extract<Exercise, { kind: "all" }>,
  response: AttemptResponse,
  o: { key?: KeySpec | null; tolCents?: number },
): TutorAnswer | null {
  const rs =
    "parts" in response && Array.isArray(response.parts) ? (response.parts as AttemptResponse[]) : null;
  if (!rs) return null;
  const slots = ex.parts.map((part, i) => {
    const r = rs[i];
    return { label: `Part ${i + 1}`, value: r ? partValue(tutorAnswerOf(part as Exercise, r, o)) : null };
  });
  if (slots.every((x) => x.value === null)) return null;
  return { kind: "slots", prompt: ex.prompt, slots };
}

interface Wave5Answer {
  sections?: string[];
  text?: string[];
  rn?: string[];
  midi?: number[];
  degrees?: string[];
  number?: number;
}

/**
 * The Wave 5 answers in the tutor's shapes (wave5.md §11): the form strip section by section with its bars, the
 * twelve-bar chart bar by bar (numerals or chord symbols), the scale built on the keyboard by note name or on the
 * pad by degree, the bar picked on the bar buttons. Only what the learner entered; never the step's `correct`.
 */
function wave5Answer(ex: Exercise, a: Wave5Answer, key: KeySpec | null): TutorAnswer | null {
  const spec = "answer" in ex && ex.answer && typeof ex.answer === "object" ? ex.answer : null;
  const ui = spec && "ui" in spec ? spec.ui : null;
  const exKey = ("key" in ex && ex.key) || key || null;
  if (ui === "form" && spec && "sections" in spec && a.sections) {
    const bars = "sectionBars" in spec && Array.isArray(spec.sectionBars) ? spec.sectionBars : null;
    let start = 1;
    return {
      kind: "slots",
      prompt: ex.prompt,
      slots: Array.from({ length: spec.sections }, (_, i) => {
        const n = bars?.[i];
        const label =
          n === undefined ? `Section ${i + 1}` : `Section ${i + 1} (bars ${start}–${start + n - 1})`;
        if (n !== undefined) start += n;
        const v = a.sections?.[i] ?? "";
        return { label, value: v === "" ? null : v };
      }),
    };
  }
  if (ui === "bar-grid" && a.rn)
    return {
      kind: "numerals",
      prompt: ex.prompt,
      key: exKey,
      numerals: a.rn.map((rn, i) => ({ bar: i + 1, rn: rn === "" ? "(empty)" : rn })),
    };
  if (ui === "bar-grid" && a.text)
    return {
      kind: "chords",
      prompt: ex.prompt,
      key: exKey,
      chords: a.text.map((symbol, i) => ({ bar: i + 1, symbol: symbol === "" ? "(empty)" : symbol })),
    };
  if (ui === "scale-builder" && spec && "tonic" in spec) {
    const from = `from ${spec.tonic}`;
    if (a.midi && a.midi.length > 0)
      return {
        kind: "text",
        prompt: ex.prompt,
        value: `the scale I built ${from}: ${a.midi.map((m) => noteName(m, exKey)).join(" ")}`,
      };
    if (a.degrees && a.degrees.length > 0)
      return {
        kind: "text",
        prompt: ex.prompt,
        value: `the scale I built ${from}: degrees ${a.degrees.join(" ")}`,
      };
  }
  if (ui === "bar-buttons" && typeof a.number === "number")
    return { kind: "text", prompt: ex.prompt, value: `bar ${a.number}` };
  return null;
}

interface Wave4Answer {
  text?: string[];
  choice?: string[];
  rn?: string[];
  qualities?: string[];
  midi?: number[];
  stages?: Partial<Record<"bass" | "quality" | "rn", string[]>>;
}

const STAGES = ["bass", "quality", "rn"] as const;

/**
 * The Wave 4 answers in the tutor's own shapes (wave4.md §5.6, app/src/tutor/context.ts): numerals placed, chords
 * named, built or given a quality, a strip of per-slot choices, a staged chord dictation so far. Only what the
 * learner entered, bar by bar; never the step's `correct`.
 */
function wave4Answer(ex: Exercise, a: Wave4Answer, key: KeySpec | null): TutorAnswer | null {
  const spec = "answer" in ex && ex.answer && typeof ex.answer === "object" ? ex.answer : null;
  const ui = spec && "ui" in spec ? spec.ui : null;
  const exKey = ("key" in ex && ex.key) || key;
  if (a.stages && Object.keys(a.stages).length > 0) {
    const answers = STAGES.filter((st) => (a.stages?.[st]?.length ?? 0) > 0).map((st) => ({
      stage: st,
      values: [...(a.stages?.[st] ?? [])],
    }));
    const stage = answers[answers.length - 1]?.stage ?? "bass";
    return { kind: "stages", stage, answers };
  }
  if (a.rn && a.rn.length > 0)
    return {
      kind: "numerals",
      prompt: ex.prompt,
      key: exKey || null,
      numerals: a.rn.map((rn, i) => ({ bar: i + 1, rn })),
    };
  if (a.qualities && a.qualities.length > 0)
    return {
      kind: "chords",
      prompt: ex.prompt,
      chords: a.qualities.map((q, i) => ({
        ...(a.qualities && a.qualities.length > 1 ? { bar: i + 1 } : {}),
        symbol: qualityLabel(q as never).long,
      })),
    };
  if (ui === "keyboard" && a.midi && a.midi.length > 0)
    return {
      kind: "text",
      prompt: ex.prompt,
      value: `notes ${a.midi.map((m) => noteName(m, exKey || null)).join(" ")}`,
    };
  if (
    ui === "text" &&
    spec &&
    "normalize" in spec &&
    spec.normalize === "chord" &&
    a.text &&
    a.text.length > 0
  )
    return {
      kind: "chords",
      prompt: ex.prompt,
      key: exKey || null,
      chords: a.text.map((symbol) => ({ symbol })),
    };
  if (ui === "slot-choice" && spec && "slots" in spec && a.choice) {
    const options = "options" in spec ? spec.options : [];
    const labels = "labels" in spec && spec.labels ? spec.labels : [];
    return {
      kind: "slots",
      prompt: ex.prompt,
      slots: Array.from({ length: spec.slots }, (_, i) => {
        const id = a.choice?.[i] ?? "";
        return {
          label: labels[i] ?? `Slot ${i + 1}`,
          value: id === "" ? null : (options.find((o) => o.id === id)?.label ?? id),
        };
      }),
    };
  }
  return null;
}

/** The last non-code answer per step of the lesson on screen (set by the player's grade; read for the tutor). */
export const useStepAnswer = create<{ stepId: string | null; answer: TutorAnswer | null }>(() => ({
  stepId: null,
  answer: null,
}));

export function publishStepAnswer(stepId: string, answer: TutorAnswer | null): void {
  useStepAnswer.setState({ stepId, answer });
}

// --- sending to the lesson on screen ---------------------------------------------------------------

let sink: ((ev: LessonEvent) => void) | null = null;

/** The mounted player registers itself here (one at a time). */
export function setLessonSink(next: ((ev: LessonEvent) => void) | null): void {
  sink = next;
}

/**
 * Sends one of the external `LessonEvent`s to the lesson on screen: the tutor panel applies a card
 * (`APPLY_CARD`), the session takes "Wrap up" (`WRAP_UP`), the panel's "Reveal (hint 4)" (`HINT` with
 * `reveal: true`). Returns false when no lesson is mounted.
 */
export function sendLessonEvent(ev: LessonEvent): boolean {
  if (!sink) return false;
  sink(ev);
  return true;
}
