// The tutor subject store and the imperative tutor API (docs/design/wave2.md §3.4).
//
// Every surface tells the tutor what the learner is looking at with `setSubject` (and `patchSubject` as the code,
// result or rung change), and clears it on unmount with `clearSubject`. The panel (tutor-ui) renders the subject's
// context chips and timeline from this store, and runs the asks other surfaces queue with `askHint()`,
// `askExplain()`, `askListeningNote()`, `askReview()` and `askChat()`.
//
// The tutor is optional (contracts §10.1): when no backend is ready, or the subject has the tutor closed
// (a checkpoint, a drill trial), every ask is a no-op that returns `{ ok: false }` and sets a visible notice
// ("The tutor is off …") instead of failing silently. Nothing here calls the network: the panel streams.
import {
  countIssues,
  type GradeResult,
  type GradeSnapshot,
  type Health,
  type HintRung,
  type RawIssue,
  type SubjectRef,
  type ThreadKind,
  type TutorTurnRequest,
} from "@oak/api";
import { type KeySpec, keyOf } from "@oak/theory";
import { create } from "zustand";
import type { FormViewSection, SectionLoop } from "../lib/form-view.ts";
import type { ChordAt, KeySpanAt } from "./harmony-chips.ts";
import { displayBars, formLetters, sectionRequest, sectionsFromCode, sectionsLine } from "./sections.ts";
import type { TrackMarks } from "./track-chips.ts";

/** One context chip: exactly what the next turn will carry (contracts §10.2, ux §6.2). */
export interface ContextChip {
  id:
    | "step"
    | "code"
    | "answer"
    | "result"
    | "hints"
    | "selection"
    | "sketch"
    | "capstone"
    | "track"
    | "transcription"
    | "key"
    | "labels"
    | "form"
    | "song";
  label: string;
}

/** Which note labels are on screen (the lenses of docs/design/wave3.md §4.3, or a lesson step's own labels). */
export interface LabelState {
  degrees: boolean;
  solfege: boolean;
  noteNames: boolean;
}

/**
 * The learner's answer on a step that is not code (Wave 3), in a form the tutor can read. It carries only what
 * the learner did and what they were shown — never the expected answer: the server redacts the grade by its own
 * rung, and this goes to the model as written.
 *
 * - `staff`: the note list they placed (`"F#4:4 r:4 G4:2"`, the staff-input value), or for a key-signature
 *   question the accidentals in the order placed (`mode: "key-signature"`, `notes: "F# C#"`);
 * - `sung`: per sung note, the label the learner saw for its target (a degree or syllable they were shown; omit
 *   it in echo mode, where the target is the question) and the measured cents from that target (`null`: no voice
 *   heard), plus the tolerance they were graded at;
 * - `by-ear`: the code they wrote by ear (`subject.code` may hold it instead) and the playback rate they used;
 * - `text`: any other answer as the learner gave it (a typed name, the option they picked).
 */
export type TutorAnswer =
  | {
      kind: "staff";
      notes: string;
      mode?: "notes" | "key-signature";
      clef?: "treble" | "bass" | "grand";
      key?: KeySpec | null;
    }
  | {
      kind: "sung";
      notes: { target?: string; cents: number | null }[];
      tolCents?: number;
      /** Quiet mode or no mic: the step was done by its fallback, nothing was sung. */
      quiet?: boolean;
    }
  | { kind: "by-ear"; code: string; rate?: number }
  | { kind: "text"; prompt?: string; value: string }
  // --- Wave 4 ---
  /** Chords the learner named, built or picked (quality pad, chord symbols, a staff of chords), bar by bar. */
  | { kind: "chords"; chords: { bar?: number; symbol: string }[]; key?: KeySpec | null; prompt?: string }
  /** Numerals the learner placed (rn palette), bar by bar, and the key they are read in. */
  | { kind: "numerals"; numerals: { bar?: number; rn: string }[]; key?: KeySpec | null; prompt?: string }
  /** A strip of per-slot choices (function per chord, cadence per phrase, chord tone or not), as labels. */
  | { kind: "slots"; prompt?: string; slots: { label: string; value: string | null }[] }
  /**
   * Chord dictation stage by stage (bass first): what the learner answered at each stage so far. `stage` is the
   * one being worked on.
   */
  | {
      kind: "stages";
      stage: "bass" | "quality" | "rn";
      answers: { stage: "bass" | "quality" | "rn"; values: string[]; passed?: boolean }[];
    }
  /** A hand voicing (U05.L07–L08): the code and, when known, the notes of each chord as voiced. */
  | { kind: "voicing"; code: string; chords?: string[][] }
  /**
   * A transcription: the learner's code and Oak's per-bar comparison. Only the learner's side and the verdict per
   * bar: the hidden source is never part of this type, so it cannot be sent before the reveal rung.
   */
  | {
      kind: "transcription";
      code: string;
      layer?: string;
      diff: { bar: number; status: "match" | "differs" | "missing" | "extra" | "unchecked"; note?: string }[];
      /** The learner has taken the reveal for this piece (then the tutor may discuss the source). */
      revealed?: boolean;
    }
  /** A finished drill set (the tutor opens at its summary): each trial as asked, answered and checked. */
  | {
      kind: "drill-set";
      family: string;
      trials: { n: number; asked?: string; answered: string; ok: boolean }[];
    };

/** What the learner is looking at. Set by the surface that owns the screen. */
export interface TutorSubject {
  thread: SubjectRef;
  /** Learner-facing name of the subject ("U01.L02 · Count to four", "Sketch 012"). */
  title: string;
  /** False during a checkpoint and during drill trials (contracts §10.4): asks are refused with a notice. */
  tutorOpen: boolean;
  /**
   * Oak 2.0 W1: the refusal's words while `tutorOpen` is false, when the surface has its own reason (Studio's jam:
   * `JAM_TUTOR_NOTICE`). Absent: the checkpoint copy.
   */
  closedNotice?: string;
  lessonId?: string;
  /** Local step ID (`S5`). */
  stepId?: string;
  /** Whether the current step is graded (hints and Reveal apply only then). */
  graded?: boolean;
  passed?: boolean;
  /** The editor's code now (clean, markers stripped). */
  code?: string | null;
  /** The latest check of this step, if any. */
  lastResult?: GradeResult | null;
  /** The server-side rung as last read (`StepState.rung`); the server stays authoritative. */
  rung?: HintRung;
  /** Selected code (Mod+I "Ask Claude about selection"). */
  selection?: string | null;
  sketchId?: string;
  capstoneId?: string;
  /** The key the learner is in. Absent: read from the code's first `.scale()`, else none (C major for sound). */
  key?: KeySpec | null;
  /** The learner's answer on a step that is not code (staff, sung, by ear); see `TutorAnswer`. */
  answer?: TutorAnswer | null;
  /**
   * The labels a lesson step itself shows (content's `ui.staffLabels`/`ui.rollLabels` win inside a step, wave3
   * §4.3). Absent: the learner's lenses.
   */
  labels?: LabelState | null;
  /** A capstone after its first release (revision mode): review `tryCode` may be applied (contracts §10.7). */
  released?: boolean;
  /**
   * Wave 4: the chords of the music on screen, bar by bar, from the surface's analysis (`harmonyView` in the
   * Workbench). Chord and numeral chips light the bars they sound in. Absent: read from the code's `chord("…")`.
   */
  harmony?: ChordAt[];
  /** Wave 4: the album version a capstone or track subject shows (a review requested here is about it). */
  albumTrackId?: string;
  albumVersion?: number;
  /** Wave 4: the transcription project version on screen (a review requested here is about it). */
  transcriptionVersion?: number;
  /**
   * Wave 5: the sections of the music on screen as the form view draws them (`model.lines.sections`; kept in step by
   * `useSubjectHarmony`). Section names in tutor text become chips that select them. Absent: read from the code's
   * `arrange()`.
   */
  sections?: FormViewSection[];
  /** Wave 5: the music on screen has a pickup: bar 0 is the pickup and section bars count from the first full bar. */
  pickup?: boolean;
  /**
   * Wave 6: the key plan of the music on screen (`keyPlanView` spans in display bars; kept in step by
   * `useSubjectHarmony`). Key and mode chips light the bars a key is in force; numerals are read in that key.
   * Absent: read from the code's patterned `.scale()`.
   */
  keyPlan?: KeySpanAt[];
  /**
   * Wave 7: what the Workbench's track lenses found (voicing types, tensions, the clave, register clashes, by bar;
   * kept in step by `useSubjectHarmony`). Voicing, tension, clave and register chips light their bars. Absent: those
   * chips switch their lens on without bars.
   */
  track?: TrackMarks | null;
  /**
   * Unit songs (contracts §5.11 rule 19): the song the lesson builds, set by the lesson page from `SessionPlan.song`
   * or `songs.get`. Only its chip comes from here: the server adds the song (style, the learner's cells, today's line)
   * to the lesson context itself.
   */
  song?: { title: string } | null;
}

export interface TutorAsk {
  id: number;
  kind: ThreadKind;
  request: TutorTurnRequest;
  /** What the panel shows as the learner's message ("Give me a nudge"). */
  label: string;
  at: number;
  /** The subject the ask is about, when it carries its own (a listening note, a review). */
  subject?: TutorSubject;
}

export type TutorAvailability = "unknown" | "ready" | "off";

export interface TutorNotice {
  kind: "off" | "closed" | "no-subject";
  message: string;
}

export type AskResult = { ok: true; ask: TutorAsk } | { ok: false; notice: TutorNotice };

export type ChipId = ContextChip["id"];

/**
 * Chips the learner may switch off for the next turns (ux §6.2 "click toggles inclusion"). Identity chips (the
 * step, the sketch, the capstone, the track, the transcription) name the thread itself and stay; the hint rung is
 * the server's own state and is not sent by the browser at all. A listening note is about the code, so its code
 * chip stays too.
 */
export const REMOVABLE_CHIPS: ReadonlySet<ChipId> = new Set<ChipId>([
  "code",
  "answer",
  "result",
  "selection",
]);

export function chipRemovable(id: ChipId, kind: ThreadKind = "chat"): boolean {
  if (!REMOVABLE_CHIPS.has(id)) return false;
  if (kind === "listening" && id === "code") return false;
  return true;
}

/**
 * What the surface that owns the subject lets the panel do (registered with `registerTutorHost`). Every member is
 * optional: without `applyCode` there is no in-editor Apply (Apply to new sketch still works), without
 * `showBars` a bar reference dispatches `TUTOR_BARS_EVENT` on `window`, without `reveal` the panel records hint 4
 * through `steps.hint` itself.
 */
export interface TutorHost {
  thread: SubjectRef;
  /** Applies a card's code in the editor as one undoable change (contracts §10.7). */
  applyCode?(code: string, card: { cardId: string; title: string }): void;
  /** Loops or highlights bars `from`–`to` (1-based, inclusive) in the active Workbench. */
  showBars?(from: number, to: number): void;
  /** Takes hint 4 (Reveal) through the surface's own ladder, so reveals are always recorded the same way. */
  reveal?(): void | Promise<void>;
  /** The sketch an in-editor Apply lands in (`tutor.cardApplied` body), when the surface has one. */
  sketchId?: string | null;
  /**
   * Wave 5: selects and loops a section in the form view (what a click on the section ribbon does). Without it a
   * section chip dispatches `TUTOR_SECTION_EVENT` and loops the section's bars through `showBars`.
   */
  selectSection?(loop: SectionLoop): void;
}

/** `window` event a section chip fires when no host handles it: `detail = SectionLoop` (0-based cycles). */
export const TUTOR_SECTION_EVENT = "oak:tutor-section";

/** `window` event a bar reference fires when no host handles it: `detail = { from, to }`. */
export const TUTOR_BARS_EVENT = "oak:tutor-bars";

/**
 * What a tutor reference points at in the music on screen (Wave 3): bars (`[[bars:3-4]]`, a review's bar chip)
 * or a note (`[[note:F#4]]`). The Workbench lights it on the roll and the staff for `HIGHLIGHT_MS` (it reads
 * `useTutorHighlight` or listens for `TUTOR_HIGHLIGHT_EVENT`, `detail = TutorHighlight`); the loop is set by the
 * bars event as before. `seq` changes with every reference, so the same one clicked twice lights again.
 */
export type TutorHighlight =
  | { kind: "bars"; thread: SubjectRef; from: number; to: number; seq: number; at: number }
  | { kind: "note"; thread: SubjectRef; midi: number; seq: number; at: number };

export const TUTOR_HIGHLIGHT_EVENT = "oak:tutor-highlight";
export const HIGHLIGHT_MS = 2400;

export const useTutorHighlight = create<{ current: TutorHighlight | null }>(() => ({ current: null }));
let highlightSeq = 0;

type HighlightInput =
  | { kind: "bars"; thread: SubjectRef; from: number; to: number }
  | { kind: "note"; thread: SubjectRef; midi: number };

/** Publishes a reference for the Workbench on screen to light (store and window event). */
export function highlightReference(ref: HighlightInput): TutorHighlight {
  const h = { ...ref, seq: ++highlightSeq, at: Date.now() } as TutorHighlight;
  useTutorHighlight.setState({ current: h });
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(TUTOR_HIGHLIGHT_EVENT, { detail: h }));
  return h;
}

/**
 * Bar numbers (inclusive) to the half-open cycle span the Workbench uses: bars 3–4 → [2, 4). With a declared
 * pickup (contracts §6.11) the pickup is bar 0 in cycle 0 and bar N is cycle N: bars 0–1 → [0, 2).
 */
export function barsToCycles(from: number, to: number, pickup = false): [number, number] {
  const first = pickup ? 0 : 1;
  const a = Math.max(first, Math.min(from, to));
  const b = Math.max(a, Math.max(from, to));
  return pickup ? [a, b + 1] : [a - 1, b];
}

interface TutorContextState {
  subject: TutorSubject | null;
  availability: TutorAvailability;
  /** The `Health.tutor` value behind `off` (`missing_key`, …), for the copy. */
  offReason: Health["tutor"] | null;
  /** Asks queued for the panel, oldest first. The panel takes them with `takeAsk()`. */
  queue: TutorAsk[];
  /** The latest refusal, shown in the panel until dismissed (and announced once as a toast by the panel). */
  notice: TutorNotice | null;
  /** Bumped by `openTutor()`; the shell opens the docked panel or the drawer when it changes. */
  openRequests: number;
  /** Chips the learner switched off; cleared when the subject's thread changes. */
  excluded: ChipId[];
  /** Bumped when a host registers or leaves, so the panel re-reads `tutorHostFor`. */
  hosts: number;
  /** Bumped by `focusTutor()` (Mod+I): the panel moves focus to its composer. */
  focusRequests: number;
  /** The learner's shown lenses (synced by `useTutorBridge`); null until known. */
  lenses: LabelState | null;
}

export const useTutorContext = create<TutorContextState>(() => ({
  subject: null,
  availability: "unknown",
  offReason: null,
  queue: [],
  notice: null,
  openRequests: 0,
  excluded: [],
  hosts: 0,
  focusRequests: 0,
  lenses: null,
}));

/** The shell keeps the shown lenses here, so a turn built outside React knows them (`useTutorBridge`). */
export function setLensState(lenses: LabelState | null): void {
  const cur = useTutorContext.getState().lenses;
  if (
    cur === lenses ||
    (cur &&
      lenses &&
      cur.degrees === lenses.degrees &&
      cur.solfege === lenses.solfege &&
      cur.noteNames === lenses.noteNames)
  )
    return;
  useTutorContext.setState({ lenses });
}

// --- subject --------------------------------------------------------------------------------------

export function setSubject(subject: TutorSubject): void {
  const cur = useTutorContext.getState().subject;
  const same = cur !== null && sameThread(cur.thread, subject.thread);
  useTutorContext.setState(same ? { subject, notice: null } : { subject, notice: null, excluded: [] });
}

/** Updates the current subject only if it is still `thread` (a late update from a page left behind is dropped). */
export function patchSubject(thread: SubjectRef, patch: Partial<Omit<TutorSubject, "thread">>): void {
  const cur = useTutorContext.getState().subject;
  if (!cur || !sameThread(cur.thread, thread)) return;
  useTutorContext.setState({ subject: { ...cur, ...patch } });
}

/** Clears the subject; with `thread`, only if it is still that one (unmount of an old page). */
export function clearSubject(thread?: SubjectRef): void {
  const cur = useTutorContext.getState().subject;
  if (thread && cur && !sameThread(cur.thread, thread)) return;
  useTutorContext.setState({ subject: null, excluded: [] });
}

/** Switches a chip off or on for the next turns. Chips that are not removable are left alone. */
export function toggleChip(id: ChipId): void {
  if (!REMOVABLE_CHIPS.has(id)) return;
  useTutorContext.setState((s) => ({
    excluded: s.excluded.includes(id) ? s.excluded.filter((x) => x !== id) : [...s.excluded, id],
  }));
}

// --- hosts ----------------------------------------------------------------------------------------

const hosts = new Map<string, TutorHost>();
const threadKey = (t: SubjectRef) => `${t.subjectKind}:${t.subjectId}`;

/** A surface offers Apply, bar highlighting and Reveal for its thread. Returns the unregister function. */
export function registerTutorHost(host: TutorHost): () => void {
  const key = threadKey(host.thread);
  hosts.set(key, host);
  useTutorContext.setState((s) => ({ hosts: s.hosts + 1 }));
  return () => {
    if (hosts.get(key) !== host) return;
    hosts.delete(key);
    useTutorContext.setState((s) => ({ hosts: s.hosts + 1 }));
  };
}

export function tutorHostFor(thread: SubjectRef): TutorHost | null {
  return hosts.get(threadKey(thread)) ?? null;
}

/** Loops bars in the active Workbench: through the host if there is one, else as a window event. */
export function showBars(thread: SubjectRef, from: number, to: number): void {
  highlightReference({ kind: "bars", thread, from, to });
  const host = tutorHostFor(thread);
  if (host?.showBars) host.showBars(from, to);
  else if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(TUTOR_BARS_EVENT, { detail: { from, to } }));
}

/**
 * A section chip: lights the section's bars and selects it in the form view (the host's `selectSection`, else the
 * section event and a loop of its bars). The highlight takes display bars (pickup-aware, c4); the loop takes the
 * Workbench's own bar numbering, so the region is the section's cycles exactly and the ribbon shows it selected.
 */
export function showSection(thread: SubjectRef, section: FormViewSection, pickup = false): void {
  const shown = displayBars(section, pickup);
  highlightReference({ kind: "bars", thread, from: shown.from, to: shown.to });
  const { loop } = sectionRequest(section);
  const host = tutorHostFor(thread);
  if (host?.selectSection) {
    host.selectSection(loop);
    return;
  }
  // The Workbench that follows the tutor selects the section itself (exactly its cycles, the ribbon lit). A host
  // with its own transport (X1, Transcribe) loops the bars as it does for any bar reference: display bars, which
  // it maps past a pickup (c4). The window bars event is never used for a section: its numbering is display bars.
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(TUTOR_SECTION_EVENT, { detail: loop }));
  if (host?.showBars) host.showBars(shown.from, shown.to);
}

/** The sections of a subject: the surface's form view, else the code's `arrange()`. */
export function subjectSections(s: Pick<TutorSubject, "sections" | "code" | "answer">): FormViewSection[] {
  if (s.sections) return s.sections;
  return sectionsFromCode(s.code ?? (s.answer?.kind === "transcription" ? s.answer.code : null));
}

export function sameThread(a: SubjectRef, b: SubjectRef): boolean {
  return a.subjectKind === b.subjectKind && a.subjectId === b.subjectId;
}

/** The subject the panel uses when no surface set one: the general thread. */
export const GENERAL_SUBJECT: TutorSubject = {
  thread: { subjectKind: "general", subjectId: "general" },
  title: "General",
  tutorOpen: true,
};

/** The chips of a subject, in display order. `lenses` are the learner's shown lenses (`state.lenses`). */
export function chipsOf(s: TutorSubject, lenses: LabelState | null = null): ContextChip[] {
  const chips: ContextChip[] = [];
  if (s.lessonId && s.stepId) chips.push({ id: "step", label: `${s.lessonId} · ${s.stepId}` });
  if (s.lessonId && s.song) chips.push({ id: "song", label: `Song · ${s.song.title}` });
  if (s.sketchId) chips.push({ id: "sketch", label: s.title });
  if (s.capstoneId) chips.push({ id: "capstone", label: `Capstone ${s.capstoneId}` });
  if (s.thread.subjectKind === "track") chips.push({ id: "track", label: s.title });
  if (s.thread.subjectKind === "transcription") chips.push({ id: "transcription", label: s.title });
  const key = subjectKey(s);
  if (key) chips.push({ id: "key", label: `Key · ${keyLabel(key)}` });
  const sections = subjectSections(s);
  if (sections.length > 0) {
    const types = [...new Set(sections.map((x) => x.text.replace(/\s+\d+$/, "")))];
    chips.push({ id: "form", label: `Form · ${formLetters(sections)} · ${types.join(", ")}` });
  }
  const labels = labelsLine(s.labels ?? lenses);
  if (labels && (s.code || s.answer || s.lessonId || s.sketchId || s.capstoneId))
    chips.push({ id: "labels", label: `Labels · ${labels}` });
  const answer = s.answer ? answerChip(s.answer) : null;
  // A step answered on the staff, by voice, in words or by ear has one chip for that answer (code written by ear
  // included): a second "Your code" chip would list the same lines twice.
  if (s.code && !s.answer) chips.push({ id: "code", label: `Your code · ${lineCount(s.code)} lines` });
  if (answer) chips.push({ id: "answer", label: answer });
  if (s.lastResult) chips.push({ id: "result", label: resultLabel(s.lastResult) });
  if (s.graded && !s.passed) chips.push({ id: "hints", label: `Hints ${s.rung ?? 0}/4` });
  if (s.selection) chips.push({ id: "selection", label: `Selection · ${lineCount(s.selection)} lines` });
  return chips;
}

const lineCount = (code: string) => code.replace(/\s+$/, "").split("\n").length;

const ACC = (s: string) => s.replace(/#/g, "♯").replace(/b/g, "♭");

/** "G major", "E♭ minor". */
export function keyLabel(key: KeySpec): string {
  return `${key.tonic.charAt(0).toUpperCase()}${ACC(key.tonic.slice(1))} ${key.mode}`;
}

/**
 * The key of the music on screen: the subject's own, else the code's first `.scale("…")` (a patterned
 * `.scale("<C4:major D4:major>")` gives its first key), else none.
 */
export function subjectKey(s: Pick<TutorSubject, "key" | "code" | "answer">): KeySpec | null {
  if (s.key) return s.key;
  if (s.answer?.kind === "staff" && s.answer.key) return s.answer.key;
  const code = s.code ?? (s.answer?.kind === "by-ear" ? s.answer.code : null);
  return code ? keyFromCode(code) : null;
}

/** The key of a piece's first `.scale()` call, or null. */
export function keyFromCode(code: string): KeySpec | null {
  const m = /\.scale\(\s*["'`]([^"'`]{1,40})["'`]/.exec(code);
  if (!m) return null;
  const first =
    (m[1] as string)
      .replace(/[<>[\]]/g, " ")
      .trim()
      .split(/\s+/)[0] ?? "";
  if (!first) return null;
  try {
    const k = keyOf(first);
    return k;
  } catch {
    return null;
  }
}

/** "degrees, solfège", "note names", "none". */
export function labelsLine(l: LabelState | null | undefined): string | null {
  if (!l) return null;
  const on = [l.degrees && "degrees", l.solfege && "solfège", l.noteNames && "note names"].filter(Boolean);
  return on.length > 0 ? on.join(", ") : "none";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function answerChip(a: TutorAnswer): string {
  switch (a.kind) {
    case "staff": {
      const n = a.notes.trim()
        ? a.notes
            .trim()
            .split(/\s+/)
            .filter((t) => t !== "|")
        : [];
      if (a.mode === "key-signature")
        return `Your signature · ${plural(n.length, "accidental", "accidentals")}`;
      const notes = n.filter((t) => !/^r:/.test(t)).length;
      return `Your staff · ${plural(notes, "note", "notes")}`;
    }
    case "sung":
      return a.quiet
        ? "Quiet mode · nothing sung"
        : `Your singing · ${plural(a.notes.length, "note", "notes")}`;
    case "by-ear":
      return `Your code by ear · ${lineCount(a.code)} lines`;
    case "text":
      return "Your answer";
    case "chords":
      return `Your chords · ${plural(a.chords.length, "chord", "chords")}`;
    case "numerals":
      return `Your numerals · ${plural(a.numerals.length, "numeral", "numerals")}`;
    case "slots":
      return `Your answers · ${a.slots.filter((s) => s.value !== null).length} of ${a.slots.length}`;
    case "stages":
      return `Your ${a.stage === "rn" ? "numerals" : a.stage === "quality" ? "chord qualities" : "bass"} stage`;
    case "voicing":
      return `Your voicing · ${lineCount(a.code)} lines`;
    case "transcription": {
      const off = a.diff.filter((d) => d.status !== "match" && d.status !== "unchecked").length;
      return `Your transcription · ${plural(a.diff.length, "bar", "bars")}${off > 0 ? `, ${off} to recheck` : ""}`;
    }
    case "drill-set":
      return `Your set · ${a.trials.filter((t) => t.ok).length} of ${a.trials.length}`;
  }
}

const bar = (b: number | undefined) => (b === undefined ? "" : `bar ${b}: `);
const STAGE_NAME = { bass: "bass notes", quality: "chord qualities", rn: "Roman numerals" } as const;

const signedCents = (c: number) => `${c > 0 ? "+" : c < 0 ? "−" : "±"}${Math.abs(Math.round(c))}¢`;

/**
 * The learner's answer as text the tutor reads (sent as the turn's `learnerCode`). Only what the learner did and
 * saw: placed notes, measured cents, the code they wrote. Pure.
 */
export function answerText(a: TutorAnswer): string {
  switch (a.kind) {
    case "staff": {
      const where = [a.clef ? `${a.clef} clef` : null, a.key ? `key signature of ${keyLabel(a.key)}` : null]
        .filter(Boolean)
        .join(", ");
      if (a.mode === "key-signature")
        return `Accidentals I placed on the staff, in the order I placed them${where ? ` (${where})` : ""}:\n${a.notes.trim() || "(none yet)"}`;
      return `Notes I placed on the staff${where ? ` (${where})` : ""}, as a note list (pitch:duration, 4 = quarter, r = rest, | = bar line):\n${a.notes.trim() || "(none yet)"}`;
    }
    case "sung": {
      if (a.quiet) return "Quiet mode: I did this step without singing (its listening fallback).";
      const tol = a.tolCents ? ` I was graded within ±${a.tolCents}¢.` : "";
      const rows = a.notes.map((n, i) => {
        const what = n.target ? `note ${i + 1} (target ${n.target})` : `note ${i + 1}`;
        return `${what}: ${n.cents === null ? "no voice heard" : `${signedCents(n.cents)} ${n.cents > 0 ? "sharp" : n.cents < 0 ? "flat" : "on pitch"}`}`;
      });
      return `What Oak's pitch tracker heard when I sang, in cents from each target (100¢ = a half step).${tol}\n${rows.join("\n")}`;
    }
    case "by-ear":
      return a.rate && a.rate !== 1 ? `// written by ear, listening at ${a.rate}× speed\n${a.code}` : a.code;
    case "text":
      return a.prompt ? `${a.prompt}\nMy answer: ${a.value}` : `My answer: ${a.value}`;
    case "chords": {
      const head = `${a.prompt ? `${a.prompt}\n` : ""}Chords I wrote${a.key ? ` (in ${keyLabel(a.key)})` : ""}:`;
      return `${head}\n${a.chords.map((c) => `${bar(c.bar)}${c.symbol}`).join("\n") || "(none yet)"}`;
    }
    case "numerals": {
      const head = `${a.prompt ? `${a.prompt}\n` : ""}Numerals I placed${a.key ? ` (in ${keyLabel(a.key)})` : ""}:`;
      return `${head}\n${a.numerals.map((n) => `${bar(n.bar)}${n.rn}`).join("\n") || "(none yet)"}`;
    }
    case "slots":
      return `${a.prompt ? `${a.prompt}\n` : ""}My answers, slot by slot:\n${a.slots
        .map((s, i) => `${i + 1}. ${s.label}: ${s.value ?? "(not answered)"}`)
        .join("\n")}`;
    case "stages":
      return [
        `Chord dictation, bass first. I am on the ${STAGE_NAME[a.stage]}.`,
        ...a.answers.map(
          (s) =>
            `${STAGE_NAME[s.stage]}: ${s.values.join(" ") || "(none yet)"}${s.passed === true ? " (passed)" : ""}`,
        ),
      ].join("\n");
    case "voicing":
      return a.chords && a.chords.length > 0
        ? `${a.code}\n// as voiced, chord by chord: ${a.chords.map((c) => c.join(" ")).join(" | ")}`
        : a.code;
    case "transcription": {
      const rows = a.diff.map(
        (d) =>
          `bar ${d.bar}: ${d.status === "unchecked" ? "not checked yet" : d.status}${d.note ? ` (${d.note})` : ""}`,
      );
      return [
        a.code,
        "",
        `// Oak's check of my transcription${a.layer ? ` (${a.layer})` : ""}, bar by bar:`,
        ...rows.map((r) => `// ${r}`),
      ].join("\n");
    }
    case "drill-set":
      return [
        `The drill set I just finished (${a.family}), trial by trial:`,
        ...a.trials.map(
          (t) =>
            `${t.n}. ${t.asked ? `${t.asked}: ` : ""}I answered ${t.answered}, ${t.ok ? "right" : "not right"}`,
        ),
      ].join("\n");
  }
}

/** The line the key and label chips add under the learner's words ("On screen: …"); null when neither applies. */
export function onScreenLine(s: TutorSubject, lenses: LabelState | null): string | null {
  const chips = chipsOf(s, lenses);
  const parts: string[] = [];
  const key = chips.find((c) => c.id === "key");
  const labels = chips.find((c) => c.id === "labels");
  if (key) parts.push(`key ${key.label.replace(/^Key · /, "")}`);
  if (labels) parts.push(`labels shown: ${labels.label.replace(/^Labels · /, "")}`);
  // Wave 5: the sections as the ribbon names them, with their bars (from the first full bar after a pickup).
  if (chips.some((c) => c.id === "form")) {
    const line = sectionsLine(subjectSections(s), s.pickup === true);
    if (line) parts.push(`sections ${line}`);
  }
  return parts.length > 0 ? `${ON_SCREEN}${parts.join("; ")}.` : null;
}

export const ON_SCREEN = "On screen: ";
const SELECTED = "\n\nSelected code:\n";

/** A sent message split back into the learner's words, the "On screen" line and the selection (for display). */
export function splitUserText(text: string): {
  own: string;
  onScreen: string | null;
  selection: string | null;
} {
  const [head, sel] = text.split(SELECTED) as [string, string | undefined];
  const at = head.lastIndexOf(`\n\n${ON_SCREEN}`);
  if (at < 0) return { own: head, onScreen: null, selection: sel ?? null };
  return {
    own: head.slice(0, at),
    onScreen: head.slice(at + 2 + ON_SCREEN.length),
    selection: sel ?? null,
  };
}

function resultLabel(r: GradeResult): string {
  if (r.status === "pass") return "Last check: passed";
  if (r.status === "error") return "Last run: an error";
  if (r.status === "ungraded") return "Last run";
  return `Last check: ${Math.round(r.score * 100)}%`;
}

// --- availability ----------------------------------------------------------------------------------

/** Called from the shell with every `/api/health` answer (`useTutorAvailabilitySync`). */
export function setAvailability(health: Pick<Health, "tutor" | "tutorBackend"> | null): void {
  if (health === null) {
    useTutorContext.setState({ availability: "unknown", offReason: null });
    return;
  }
  const ready = health.tutor === "ready" && health.tutorBackend !== null;
  useTutorContext.setState({
    availability: ready ? "ready" : "off",
    offReason: ready ? null : health.tutor,
  });
}

const OFF_COPY: Record<Health["tutor"], string> = {
  ready: "The tutor is off. Turn it on in Settings › Tutor.",
  missing_key: "The tutor is off: no API key and no Claude login found. Settings › Tutor explains both.",
  invalid_key: "The tutor is off: the API key was refused. Check it in Settings › Tutor.",
  unreachable: "The tutor can't be reached right now. Oak works fully without it.",
};

// --- the imperative API -------------------------------------------------------------------------------

let nextAskId = 1;

/** Opens the panel (docked at L, drawer at M). Works when the tutor is off too: the panel then explains why. */
export function openTutor(): void {
  useTutorContext.setState((s) => ({ openRequests: s.openRequests + 1 }));
}

/** The panel takes the oldest queued ask. */
export function takeAsk(): TutorAsk | null {
  const [first, ...rest] = useTutorContext.getState().queue;
  if (!first) return null;
  useTutorContext.setState({ queue: rest });
  return first;
}

export function dismissNotice(): void {
  useTutorContext.setState({ notice: null });
}

/** Focuses the panel's composer (opening the panel first). */
export function focusTutor(): void {
  openTutor();
  useTutorContext.setState((s) => ({ focusRequests: s.focusRequests + 1 }));
}

/**
 * Builds the request body of a turn from a subject (pure). `exclude` drops the chips the learner switched off.
 * A selection has no field of its own in the request, so it travels inside the learner's message, after their
 * words, exactly as the Selection chip says.
 */
export function buildTurnRequest(
  subject: TutorSubject,
  kind: ThreadKind,
  userText: string,
  exclude: readonly ChipId[] = [],
  lenses: LabelState | null = null,
): TutorTurnRequest {
  const off = (id: ChipId) => exclude.includes(id) && chipRemovable(id, kind);
  const selection = subject.selection?.trim() && !off("selection") ? subject.selection.trim() : null;
  const screen = onScreenLine(subject, lenses);
  let text = screen ? `${userText}\n\n${screen}` : userText;
  if (selection) text = `${text}${SELECTED}\`\`\`\n${selection}\n\`\`\``;
  const req: TutorTurnRequest = { thread: subject.thread, kind, userText: text };
  // A step answered on the staff, by voice, in words or by ear sends that answer (its chip left out: nothing);
  // otherwise the code.
  const a = subject.answer ?? null;
  if (a) {
    if (!off("answer")) req.learnerCode = answerText(a);
  } else if (subject.code && !off("code")) req.learnerCode = subject.code;
  if (subject.lastResult && !off("result")) req.graderResult = gradeSnapshotOf(subject.lastResult);
  if (subject.lessonId) req.lessonId = subject.lessonId;
  if (subject.stepId) req.stepId = subject.stepId;
  // Wave 4: a review names the version it is about.
  if (
    kind === "review-capstone" &&
    subject.albumTrackId !== undefined &&
    subject.albumVersion !== undefined
  ) {
    req.albumTrackId = subject.albumTrackId;
    req.albumVersion = subject.albumVersion;
  }
  if (kind === "review-transcription" && subject.transcriptionVersion !== undefined)
    req.transcriptionVersion = subject.transcriptionVersion;
  return req;
}

// --- review requests (c9) ------------------------------------------------------------------------------

/**
 * Where the last review request of a thread stands, as this browser knows it (Wave 5, carry-over c9): `pending`
 * from the moment it is asked until the turn ends; `failed-early` when it ended before reaching the server (no
 * `meta` came back: nothing is on the server's timeline to wait for, so "pending" clears at once); `failed` when
 * the server answered with an error; `answered` when the review arrived. The panel's "Request review" and the
 * capstone Brief read it together with the timeline.
 */
export type ReviewRequestPhase = "pending" | "failed-early" | "failed" | "answered";
export interface ReviewRequest {
  phase: ReviewRequestPhase;
  /** Local clock of the last change. */
  at: number;
  /** The error shown when it failed. */
  message?: string;
}

export const useReviewRequests = create<{ byThread: Record<string, ReviewRequest> }>(() => ({
  byThread: {},
}));

export function reviewRequestOf(thread: SubjectRef): ReviewRequest | null {
  return useReviewRequests.getState().byThread[threadKey(thread)] ?? null;
}

export function useReviewRequest(thread: SubjectRef | null): ReviewRequest | null {
  return useReviewRequests((s) => (thread ? (s.byThread[threadKey(thread)] ?? null) : null));
}

/** Records a change in a thread's review request (the panel calls this as the turn runs). */
export function setReviewRequest(thread: SubjectRef, phase: ReviewRequestPhase, message?: string): void {
  const next: ReviewRequest = { phase, at: Date.now(), ...(message ? { message } : {}) };
  useReviewRequests.setState((s) => ({ byThread: { ...s.byThread, [threadKey(thread)]: next } }));
}

/** A review lane's request kinds. */
export const isReviewKind = (k: ThreadKind | string): boolean =>
  k === "review-capstone" || k === "review-transcription";

function refuse(notice: TutorNotice): AskResult {
  useTutorContext.setState({ notice });
  openTutor();
  return { ok: false, notice };
}

function ask(kind: ThreadKind, userText: string, label: string, subject?: TutorSubject): AskResult {
  const st = useTutorContext.getState();
  const subj = subject ?? st.subject ?? GENERAL_SUBJECT;
  if (st.availability === "off") return refuse({ kind: "off", message: OFF_COPY[st.offReason ?? "ready"] });
  if (!subj.tutorOpen)
    return refuse({
      kind: "closed",
      message:
        subj.closedNotice ??
        "The tutor is closed here: checkpoints and drill trials are yours alone. It opens again after.",
    });
  const a: TutorAsk = {
    id: nextAskId++,
    kind,
    request: buildTurnRequest(
      subj,
      kind,
      userText,
      st.subject && sameThread(st.subject.thread, subj.thread) ? st.excluded : [],
      st.lenses,
    ),
    label,
    at: Date.now(),
    ...(subject ? { subject } : {}),
  };
  useTutorContext.setState((s) => ({ queue: [...s.queue, a], notice: null }));
  if (isReviewKind(kind)) setReviewRequest(subj.thread, "pending");
  openTutor();
  return { ok: true, ask: a };
}

/** "Give me a nudge" on a graded step: the server advances the rung by one, up to 3 (contracts §10.4). */
export function askHint(text = "Give me a nudge."): AskResult {
  const s = useTutorContext.getState().subject;
  if (!s?.graded || s.passed)
    return refuse({ kind: "no-subject", message: "Hints are for a step that is being checked." });
  return ask("hint", text, "Give me a nudge");
}

/** "Explain my mistake" after a run or check failed. It is a hint-lane request: it climbs the rung like a nudge. */
export function askExplain(text = "Explain my mistake."): AskResult {
  const s = useTutorContext.getState().subject;
  if (!s?.stepId || s.passed)
    return refuse({
      kind: "no-subject",
      message: "Explain my mistake works on a lesson step that is being checked.",
    });
  return ask("explain", text, "Explain my mistake");
}

/** A free question on the current subject, or on `subject` (the panel passes the thread it shows). */
export function askChat(text: string, subject?: TutorSubject): AskResult {
  return ask("chat", text, text, subject);
}

/** "Ask Claude to listen": a 2–3 sentence note on a saved sketch (contracts §10.10). */
export function askListeningNote(sketch: { sketchId: string; title: string; code: string }): AskResult {
  return ask("listening", "Please listen to this sketch.", "Ask Claude to listen", {
    thread: { subjectKind: "sketch", subjectId: sketch.sketchId },
    title: sketch.title,
    tutorOpen: true,
    sketchId: sketch.sketchId,
    code: sketch.code,
  });
}

/** "Request review" on a capstone draft (high effort; one structured review, contracts §10.6). */
export function askReview(capstone: {
  capstoneId: string;
  title: string;
  code: string;
  note?: string;
  /** Wave 4: review one album version (the accepted review is attached to it). Both or neither. */
  albumTrackId?: string;
  albumVersion?: number;
  /** After the first release (revision mode): the review's try-it code may be applied (contracts §10.7). */
  released?: boolean;
}): AskResult {
  const subject: TutorSubject = {
    thread: { subjectKind: "capstone", subjectId: capstone.capstoneId },
    title: capstone.title,
    tutorOpen: true,
    capstoneId: capstone.capstoneId,
    code: capstone.code,
    ...(capstone.released ? { released: true } : {}),
  };
  if (capstone.albumTrackId !== undefined && capstone.albumVersion !== undefined) {
    subject.albumTrackId = capstone.albumTrackId;
    subject.albumVersion = capstone.albumVersion;
  }
  return ask("review-capstone", capstone.note ?? "Please review my draft.", "Request review", subject);
}

/**
 * "Request review" on a transcription (Wave 4, contracts §10.6): the server sends the code, the checklist and Oak's
 * analysis; never audio, and the source only once a ladder piece has passed.
 */
export function askTranscriptionReview(project: {
  projectId: string;
  title: string;
  code: string;
  version?: number;
  note?: string;
}): AskResult {
  const subject: TutorSubject = {
    thread: { subjectKind: "transcription", subjectId: project.projectId },
    title: project.title,
    tutorOpen: true,
    code: project.code,
  };
  if (project.version !== undefined) subject.transcriptionVersion = project.version;
  return ask(
    "review-transcription",
    project.note ?? "Please review my transcription.",
    "Request review",
    subject,
  );
}

/**
 * After a drill set (the summary screen): the tutor opens again and the subject carries what happened in the
 * set, now that no trial is in progress (contracts §10.4). Drills call this from their summary.
 */
export function debriefDrill(
  thread: SubjectRef,
  set: { family: string; trials: { n: number; asked?: string; answered: string; ok: boolean }[] },
): void {
  patchSubject(thread, {
    tutorOpen: true,
    answer: { kind: "drill-set", family: set.family, trials: set.trials },
  });
}

// --- grade snapshot ---------------------------------------------------------------------------------

/**
 * `GradeResult` → the snapshot a turn may carry (`GradeSnapshotSchema`). The server redacts it by its own rung
 * before any model sees it, so sending everything here is safe. `render` turns a diagnostic into text
 * (`renderFeedback` from `@oak/grader`); without it the feedback ID is used.
 */
export function gradeSnapshotOf(
  result: GradeResult,
  render: (d: GradeResult["diagnostics"][number]) => string = (d) => d.id,
): GradeSnapshot {
  const dims: Record<string, number> = {};
  for (const [k, v] of Object.entries(result.dims)) if (v !== undefined) dims[k] = v.score;
  const str = (v: unknown) => (v === undefined || v === null ? null : String(v));
  const issues: RawIssue[] = result.diagnostics.map((d) => {
    const p = d.params;
    const code = d.where?.code?.[0];
    return {
      where: {
        track: d.where?.track ?? null,
        bar: d.where?.bar ?? null,
        beat: d.where?.beat ?? null,
        code: code === undefined ? null : { from: code.from, to: code.to },
      },
      severity: d.severity === "error" || d.severity === "warn" ? d.severity : "info",
      feedback: d.id,
      direction: str(p.direction),
      concept: str(p.concept),
      what: render(d),
      fix: str(p.fix),
      expected: str(p.expected ?? p.exp),
      got: str(p.got),
    };
  });
  return {
    status: result.status,
    score: result.score,
    dims,
    counts: countIssues(result.diagnostics),
    issues,
    warnings: result.diagnostics
      .filter((d) => d.id.startsWith("code.") && d.severity !== "error")
      .map((d) => d.id),
  };
}
