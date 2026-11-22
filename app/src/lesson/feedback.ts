// From a GradeResult to what the learner sees, redacted to the server's rung (contracts §10.5 through
// `toIssueView`): the answer widgets' per-part marks, the summary line, the catalog copy of each issue (with
// the exercise's own `feedbackText` overrides) and the value a reveal shows. Pure: `bun test`.
import {
  type Diagnostic,
  type Exercise,
  type GradeResult,
  type GradeView,
  type HintRung,
  type Trial,
  toIssueView,
} from "@oak/api";
import { signatureOf } from "@oak/theory";
import { takeProblem } from "../answers/sing.ts";
import type { AnswerFeedback, AnswerSpec, AnswerValue, PartMark } from "../answers/types.ts";
import { plainBeats, summaryText, whereText } from "../workbench/feedback.ts";

/** Catalog text with the exercise's overrides; the result's own message, then the ID, as fallbacks. */
export function renderer(
  catalog: ((d: Diagnostic, overrides?: Exercise["feedbackText"]) => string) | null,
  result: GradeResult | null,
  ex: Exercise | undefined,
  /** The code form of a toolbox ID (`tb.mini.alt` → `< >`), for locked-tool copy. */
  toolCode?: (id: string) => string | null,
): (d: Diagnostic) => string {
  return (raw) => {
    const d = lockedParams(raw, toolCode);
    if (catalog) {
      try {
        const t = catalog(d, ex?.feedbackText);
        if (t && t !== d.id) return plainBeats(degreeSigns(t));
      } catch {
        // fall through
      }
    }
    return plainBeats(
      degreeSigns(
        result?.messages.find((m) => m.id === d.id && m.where?.slot === d.where?.slot)?.text ??
          result?.messages.find((m) => m.id === d.id)?.text ??
          d.id,
      ),
    );
  };
}

/**
 * Chromatic degrees as the course prints them (U15.L01 on): `#4` → `♯4`, `b7` → `♭7`. Only an accidental that
 * stands in front of a degree number on its own: a chord name (`Bb7`, `F#7`), a Strudel step (`3#`, `6b`) and
 * code inside backticks keep their spelling.
 */
export function degreeSigns(text: string): string {
  return text
    .split(/(`[^`]*`)/)
    .map((seg) =>
      seg.startsWith("`")
        ? seg
        : seg.replace(
            /(^|[^\w♯♭#])([#b])(?=[1-7](?![\w#]))/g,
            (_m, pre: string, acc: string) => `${pre}${acc === "#" ? "♯" : "♭"}`,
          ),
    )
    .join("");
}

/**
 * The lint reports a locked tool as `{ name, id, at }` while the catalog template reads `{tool}` and `{lesson}`:
 * fill the template's slots from the lint's, so the copy says which tool and which lesson.
 */
export function lockedParams(d: Diagnostic, toolCode?: (id: string) => string | null): Diagnostic {
  if (!d.id.startsWith("code.locked") || d.params.tool !== undefined) return d;
  const id = typeof d.params.id === "string" ? d.params.id : "";
  const name = (id && toolCode?.(id)) || (typeof d.params.name === "string" ? d.params.name : id);
  const lesson = typeof d.params.at === "string" ? d.params.at : "a later lesson";
  return { ...d, params: { ...d.params, tool: name, lesson, alt: "what you have so far" } };
}

/**
 * What a finding is, in words, before the hint ladder gives its fix (rung 2: "the kind, never the answer", contracts
 * §10.5). The default reads the bare code, so a chord with the wrong note at the bottom said only "bass" (Wave 7
 * review: J3.L01's rootless A voicing answered as the B). The keyboard's findings are said as sentences here.
 */
const KIND_WORDS: Readonly<Record<string, string>> = {
  "kb.bass": "The lowest note is not the one this chord stands on.",
  "kb.missing-note": "A note of the chord is missing.",
  "kb.extra-note": "A note that does not belong is in the chord.",
  "kb.wrong-note": "A note is not the one asked for.",
  "kb.octave": "The right note, in another octave.",
  "kb.order": "The right notes, in another order.",
  "kb.voicing": "The notes are right; the shape of the voicing is not the one asked for.",
};

export function describeIssue(d: Diagnostic): string | undefined {
  return KIND_WORDS[d.id as string];
}

export function viewFor(
  result: GradeResult,
  rung: HintRung,
  passed: boolean,
  render: (d: Diagnostic) => string,
): GradeView {
  return toIssueView(result, rung, {
    passed,
    render,
    describe: (d) => describeIssue(d) ?? defaultKind(d),
  });
}

/** content-kit's default description: the code's words and, when given, the direction ("wrong degree (up)"). */
function defaultKind(d: Diagnostic): string {
  const code = (d.id as string).split(".").slice(1).join(".") || (d.id as string);
  const kind = code.replace(/[.-]/g, " ");
  const dir = d.params.dir ?? d.params.shiftLabel;
  return dir === undefined ? kind : `${kind} (${dir})`;
}

/**
 * One calm line: "That's it." / "2 notes differ: bars 2 and 4." / "Code didn't run." A sung or tapped answer
 * that could not be graded is not code: it says what Oak did not hear (the grader's error for no voice, mic
 * bleed or no taps), never "Code didn't run."
 */
/**
 * What a step's answer is, for its wording: code in the editor (notes and bars), an answer picked or typed
 * (`answer`; `questions` when an investigate asks several; `listen` when it answers a sound), or a sung take.
 */
export interface AnswerShape {
  /** `notes`: notes written on a staff, each answer slot a note. */
  /** `tapped` (Wave 5): taps along with a groove; each finding names its own note, so no "Answer n" in front. */
  kind: "code" | "notes" | "answer" | "questions" | "sung" | "tapped";
  listen?: boolean;
  /** An answer of several slots (a numeral or a function per bar): one wrong slot is named, not "this one". */
  slotted?: boolean;
  /**
   * What a slot is called: "bar" for the RN palette, one numeral a bar in a lesson or a checkpoint, whose slots
   * read "bar 1" … (review:journey: the verdict said "Answer 3" under a slot labelled "bar 3"); else "answer".
   */
  slotNoun?: "bar" | "section" | "part";
}

/** The answer kinds an `all` step checks together and names by part (grading.ts `isAnswerAll`). */
const ANSWER_PARTS = new Set(["identify", "fact", "staff-read", "keyboard"]);

export function shapeOf(ex: Exercise | undefined): AnswerShape {
  if (!ex) return { kind: "code" };
  if (ex.kind === "sing" || (ex.kind === "all" && ex.parts.every((p) => p.kind === "sing")))
    return { kind: "sung" };
  if (ex.kind === "tap") return { kind: "tapped", listen: true };
  if (ex.kind === "run-investigate")
    return ex.questions.length > 1 ? { kind: "questions" } : { kind: "answer" };
  if (ex.kind === "staff-write" && ex.answer.ui === "staff-input" && ex.answer.mode !== "key-signature")
    return { kind: "notes" };
  const code = ["code-modify", "error-hunt", "code-make", "compose-brief", "transcribe-step", "code-fill"];
  if (code.includes(ex.kind) || (ex.kind === "dictation" && ex.byEar)) return { kind: "code" };
  // Several answers checked together (four chords by ear): each part is named ("Part 2 is not right yet").
  if (ex.kind === "all" && ex.parts.length > 1 && ex.parts.every((p) => ANSWER_PARTS.has(p.kind))) {
    const heard = ex.parts.some((p) => "stimulus" in p && p.stimulus !== undefined);
    return { kind: "answer", listen: heard, slotted: true, slotNoun: "part" };
  }
  if (ex.kind === "all") return { kind: "code" };
  // A sound to answer (an ear step, a dictation, cards to play); a question to reason out (a drawn spelling or
  // circle question has a stimulus too, but nothing to hear) reads "Look again".
  const stim = "stimulus" in ex ? ex.stimulus : undefined;
  const ui = "answer" in ex && ex.answer && typeof ex.answer === "object" ? ex.answer.ui : null;
  const heard =
    ex.kind === "dictation" ||
    stim?.src === "code" ||
    (stim?.src === "generator" && ui !== "text" && ui !== "number");
  const slots =
    "answer" in ex && ex.answer && typeof ex.answer === "object" && "slots" in ex.answer
      ? ex.answer.slots
      : 1;
  // Wave 5: a chart answers bar by bar, a form section by section; their slots are named so ("Bar 10").
  if (ui === "bar-grid") return { kind: "answer", listen: heard, slotted: true, slotNoun: "bar" };
  if (ui === "form") return { kind: "answer", listen: heard, slotted: true, slotNoun: "section" };
  return {
    kind: "answer",
    listen: heard,
    ...(typeof slots === "number" && slots > 1 ? { slotted: true } : {}),
    ...(ui === "rn-palette" && typeof slots === "number" && slots > 1 ? { slotNoun: "bar" as const } : {}),
  };
}

/** "answers 2 and 3", "question 1". */
function slotList(noun: string, slots: readonly number[]): string {
  if (slots.length === 1) return `${noun} ${slots[0]}`;
  return `${noun}s ${slots.slice(0, -1).join(", ")} and ${slots[slots.length - 1]}`;
}

/** The answer slots (1-based) the issues point at, in order. */
function wrongSlots(view: GradeView): number[] {
  return [
    ...new Set(
      view.issues
        .filter((i) => i.severity === "error" || i.severity === "warn")
        .map((i) => i.where.slot)
        .filter((s): s is number => s !== undefined),
    ),
  ].sort((a, b) => a - b);
}

export function summaryOf(
  view: GradeView,
  result?: Pick<GradeResult, "status" | "diagnostics"> & { dims?: GradeResult["dims"] },
  shape: AnswerShape = { kind: "code" },
): string {
  if (result?.status === "error") {
    const ids = result.diagnostics.map((d) => d.id as string);
    // No voice, too noisy, only short blips: each says why and what to do next.
    const problem = takeProblem(result.diagnostics as { id: string; params?: Record<string, unknown> }[]);
    if (problem && problem.kind !== "clipped") return problem.text;
    if (ids.includes("sing.bleed"))
      return "The microphone hears the playback. Wired headphones fix that; then try again.";
    if (ids.some((id) => id.startsWith("sing.")))
      return "Oak couldn't follow that take. Try it again, one steady note at a time.";
    if (ids.some((id) => id.startsWith("tap.")))
      return "Oak didn't catch your taps. Tap with Space on each beat, then try again.";
  }
  // A key signature is not "notes": it says which part of the signature is off, never the answer.
  const ids = (result?.diagnostics ?? []).map((d) => d.id as string);
  if (view.status === "fail" && ids.some((id) => id.startsWith("keysig."))) {
    if (ids.includes("keysig.type")) return "Not this signature: this key is written with the other kind.";
    if (ids.includes("keysig.count")) return "Not this signature: count the key's sharps or flats again.";
    if (ids.includes("keysig.order"))
      return "The right accidentals, out of order. They are always written in one fixed order.";
    return "Not this signature yet.";
  }
  // A fail with nothing itemised (a sung take the grader scored without diagnostics) never reads "0 things to
  // look at": it points at the marks the step already shows.
  if (view.status === "fail" && view.issues.length === 0) {
    const sung = result?.dims?.pitch !== undefined;
    return sung
      ? "Not there yet. Each note's mark above says how it went; hum home, then try again."
      : "Not there yet. Compare yours with the target, then try again.";
  }
  // An answer picked or typed is not "notes that differ": it says which answer (or question) to look at again.
  if (view.status === "fail" && shape.kind !== "code" && shape.kind !== "notes") {
    if (shape.kind === "sung") {
      // Notes, not lines: a take-wide finding (the input clipped) is not a note to sing again.
      const notes = view.issues.filter((i) => i.severity !== "praise" && i.where.slot !== undefined).length;
      const n = notes > 0 ? notes : view.issues.filter((i) => i.severity !== "praise").length;
      return `Not there yet: ${n} ${n === 1 ? "note" : "notes"} to sing again.`;
    }
    if (shape.kind === "tapped") {
      // A named rhythm finding (a push on the beat, an uneven triplet, a 6/8 bar in quarters) is about the
      // rhythm, not one tap: it is said in its own line, and only the taps left over are counted.
      const n = view.issues.filter(
        (i) =>
          (i.severity === "error" || i.severity === "warn") &&
          !/^tap\.(push-|triplet-|grouping|clave-|lane)/.test((i.id as string | undefined) ?? ""),
      ).length;
      return n > 0
        ? `Not in time yet: ${n} ${n === 1 ? "tap" : "taps"} to look at. Listen, then tap along again.`
        : "Not in time yet. Listen, then tap along again.";
    }
    const slots = wrongSlots(view);
    const noun = shape.kind === "questions" ? "question" : (shape.slotNoun ?? "answer");
    if (slots.length > 1 || (slots.length === 1 && (shape.kind === "questions" || shape.slotted))) {
      const list = slotList(noun, slots);
      return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${slots.length === 1 ? "is" : "are"} not right yet.`;
    }
    return shape.listen
      ? "Not this one yet. Listen again, then try once more."
      : "Not this one yet. Look again, then try once more.";
  }
  // A code step whose one finding is about the code, not the notes ("Nothing changed yet. Edit the highlighted
  // part…", a locked tool, an edit outside the region) says that finding in the step's verdict: "1 thing to look
  // at." alone sent the learner hunting for the Workbench's list. The Workbench list says it too, at every rung.
  if (view.status !== "pass" && shape.kind === "code") {
    // A tool that is not open yet comes first (contracts §3.3: an error in a graded step): "8 notes differ" or
    // "Code didn't run" would send the learner to the notes when the fix is to use the tools they have.
    const locked = view.issues.find((i) => (i.id as string | undefined)?.startsWith("code.locked") && i.what);
    if (locked?.what) return locked.what;
  }
  if (view.status === "fail" && shape.kind === "code") {
    const notes = view.counts.missing + view.counts.extra + view.counts.wrong;
    const said = view.issues.filter((i) => i.severity !== "praise" && i.what);
    const only = said.length === 1 && view.issues.length === 1 ? said[0] : null;
    if (notes === 0 && only?.what) return only.what;
  }
  return summaryText(view);
}

/** A place without its track name. */
function withoutTrack(w: GradeView["issues"][number]["where"]): GradeView["issues"][number]["where"] {
  const { track: _track, ...rest } = w;
  return rest;
}

export function issueLines(
  view: GradeView,
  shape: AnswerShape = { kind: "code" },
): { key: string; where: string; what: string | null; fix: string | null }[] {
  // A passed check says "That's it." once: a praise line ("Exactly right.") would only repeat it. A line
  // with no place in the music (a key signature, a sung take) has no "where" — never "Somewhere in the piece".
  // A sung note names itself ("Note 2: …"), so it carries no "Answer n" in front, and the notes come in order.
  // An answer slot with nothing to say yet (rung 0 hides the words) is already named by the summary.
  const sung = shape.kind === "sung" || shape.kind === "tapped";
  // `chord()` itself locked says it once: a line per chord name it was given would only repeat it.
  const chordLocked = view.issues.some((i) => i.id === "code.locked-tool" && /\bchord\b/.test(i.what ?? ""));
  const issues = view.issues.filter(
    (i) =>
      !(view.status === "pass" && i.severity === "praise") && !(chordLocked && i.id === "code.locked-chord"),
  );
  const ordered = sung ? [...issues].sort((a, b) => (a.where.slot ?? 0) - (b.where.slot ?? 0)) : issues;
  const lines = ordered
    .filter(
      (i) =>
        !(
          shape.kind !== "code" &&
          shape.kind !== "notes" &&
          !sung &&
          i.where.slot !== undefined &&
          !i.what &&
          !i.fix
        ),
    )
    .map((i, n) => {
      const w = i.where;
      const placed = Object.values(w).some((v) => v !== undefined);
      const slotOnly = w.slot !== undefined && w.bar === undefined;
      const where = slotOnly
        ? sung
          ? ""
          : `${shape.kind === "questions" ? "Question" : shape.kind === "notes" ? "Note" : shape.slotNoun === "bar" ? "Bar" : shape.slotNoun === "section" ? "Section" : shape.slotNoun === "part" ? "Part" : "Answer"} ${w.slot}`
        : placed && !(sung && w.bar === undefined)
          ? // Notes on a staff have one voice, which the grader calls "main": the place is the bar and beat
            // ("main, Bar 1, beat 1" read as a raw label to the learner; Wave 6 review).
            whereText(shape.kind === "notes" ? { where: withoutTrack(w) } : i)
          : "";
      return {
        key: `${n}-${w.bar ?? ""}-${w.slot ?? ""}-${i.id ?? ""}`,
        where,
        what: i.what ?? null,
        fix: i.fix ?? null,
      };
    });
  return collapseRepeats(lines, shape.kind === "tapped" ? "taps" : "times");
}

/**
 * The same finding said once with how often it happened: 24 taps between the kicks read as one line "(24 taps)",
 * not 24 identical lines. Lines that name their own place (a bar, a note) stay apart.
 */
export function collapseRepeats<L extends { where: string; what: string | null; fix: string | null }>(
  lines: readonly L[],
  noun: string,
): L[] {
  const out: { line: L; n: number }[] = [];
  for (const l of lines) {
    const same = out.find((o) => o.line.where === l.where && o.line.what === l.what && o.line.fix === l.fix);
    if (same && l.where === "") same.n += 1;
    else out.push({ line: l, n: 1 });
  }
  return out.map(({ line, n }) =>
    n > 1 && line.what ? { ...line, what: `${line.what} (${n} ${noun})` } : line,
  );
}

/** Per-part marks: a slot, blank or choice with a finding is wrong; rung 0 may say where (contracts §10.5). */
export function partMarks(result: GradeResult | null, spec: AnswerSpec | null): PartMark[] {
  if (!result || result.status === "ungraded") return [];
  const marks: PartMark[] = [];
  const wrongSlots = new Set<number>();
  const wrongBlanks = new Set<string>();
  for (const d of result.diagnostics) {
    if (d.severity !== "error" && d.severity !== "warn") continue;
    if (d.where?.slot !== undefined) wrongSlots.add(d.where.slot - 1);
    if (d.where?.blank !== undefined) wrongBlanks.add(d.where.blank);
  }
  if (spec?.ui === "blanks") {
    for (const b of spec.blanks)
      marks.push({ part: b.id, ok: !wrongBlanks.has(b.id) && result.status === "pass" });
    return marks;
  }
  for (const s of wrongSlots) marks.push({ part: s, ok: false });
  return marks;
}

/** What a reveal (rung 4) shows next to the learner's answer, when the exercise says it plainly. */
export function revealValue(ex: Exercise, spec: AnswerSpec | null, trial: Trial | null): AnswerValue | null {
  if (!spec) return null;
  const correct =
    ex.kind === "identify"
      ? (trial?.expected ?? ex.correct)
      : ex.kind === "fact" || ex.kind === "staff-read"
        ? ex.correct
        : null;
  switch (spec.ui) {
    case "choice":
      if (ex.kind === "predict" && Array.isArray(ex.correct)) return ex.correct;
      return correct?.choice ?? null;
    case "degree-pad":
      return correct?.degrees ?? null;
    case "quality-pad":
      return correct?.qualities ?? null;
    case "rn-palette":
      return correct?.rn ?? null;
    case "number":
      if (ex.kind === "predict" && typeof ex.correct === "number") return ex.correct;
      return correct?.number ?? null;
    // Wave 7: an odd-meter bar's grouping (R2.L01–L02) and a Euclidean rhythm's numbers (R3.L01–L03).
    case "grouping":
      return correct?.grouping ?? null;
    case "euclid":
      return correct?.euclid ?? null;
    case "bar-buttons":
      // "Which bar?" (U09.L01 S6, U09.L05 S6, U11.L08 S5): the bar the answer names.
      return typeof correct?.number === "number" ? [correct.number] : null;
    case "text":
      // A several-part answer (a scale spelled letter by letter) is revealed whole, not its first letter.
      return correct?.text && correct.text.length > 0 ? correct.text.join(" ") : null;
    case "keyboard":
      return ex.kind === "keyboard"
        ? (ex.expect.midi ?? ex.expect.sequence ?? null)
        : (correct?.midi ?? null);
    case "order":
      return ex.kind === "parsons" ? (ex.accept.orders?.[0] ?? null) : null;
    case "staff-input":
      if (ex.kind === "staff-write" && ex.expect.e === "key-signature") {
        const sig = signatureOf(ex.expect.key);
        return [...sig.sharps, ...sig.flats].join(" ");
      }
      return ex.kind === "staff-write" && ex.expect.e === "pitches" ? ex.expect.spelled.join(" ") : null;
    default:
      return null;
  }
}

/** The feedback an answer widget shows for the latest result at the current rung. */
export function answerFeedback(o: {
  result: GradeResult | null;
  checking: boolean;
  rung: HintRung;
  spec: AnswerSpec | null;
  reveal: AnswerValue | null;
  message?: string;
}): AnswerFeedback {
  if (o.checking) return { state: "pending" };
  const r = o.result;
  if (o.rung >= 4 && o.reveal !== null)
    return { state: "revealed", correct: o.reveal, marks: partMarks(r, o.spec) };
  if (!r || r.status === "error" || r.status === "ungraded") return { state: "idle" };
  if (r.status === "pass") return { state: "correct" };
  return {
    state: "wrong",
    marks: partMarks(r, o.spec),
    ...(o.message !== undefined ? { message: o.message } : {}),
  };
}
