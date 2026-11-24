// What the shell says about the course beyond the core (Wave 6; docs/design/wave6.md §5.3, §5.5, §10 items 14 and
// 17). Two honest facts reach the NavRail and the command palette:
//
//   1. The advanced tracks. Jazz Harmony and Advanced Rhythm open with the U13 checkpoint, long before their lessons
//      are written. The shell names them as open and still being written, and never offers a way into a lesson that
//      does not exist: a track or an unwritten lesson picked in the palette goes to the Oak's course view, where the
//      track is drawn, not to an empty lesson page.
//   2. The end of the core. Once the core is complete nothing in the navigation may read as finished: the rail keeps
//      every destination, the Oak's label names what is open, and the palette lists what stays open.
//
// Pure (tested in course-state.test.ts). The server's `TrackState` is the source when it is there
// (`CourseProgress.tracks`); from a server that does not send it yet, the same gates (`TRACK_GATES`) are read from
// the course progress the shell has anyway, so the shell never claims more than it knows.
import {
  type CoreCompletion,
  type CourseProgress,
  TRACK_GATES,
  TRACK_IDS,
  TRACK_TITLES,
  type TrackState,
} from "@oak/api";
import type { SyllabusDef } from "@oak/content-kit";
import { opensWithCheckpoint } from "../kit/lock-notes.ts";
import { type BranchState, branchNote, branchState, listWords } from "../kit/model-w6.ts";
import { type TrackCardState, trackCardState, trackNext, trackWaitingFor } from "../kit/model-w7.ts";

type TrackId = (typeof TRACK_IDS)[number];

export interface ShellTrack {
  trackId: TrackId;
  title: string;
  state: BranchState;
  /** The one honest line (the server's note, or the same sentence built from the gates). */
  note: string;
  /** The lesson that can be started now, or `null`. */
  next: string | null;
  /**
   * Wave 7: the next thing of the track the learner may start now — a lesson, the track checkpoint or a capstone
   * session (`TrackState.nextSession`, else the next lesson) — or `null`.
   */
  session: { kind: "lesson" | "checkpoint" | "capstone"; id: string; title: string | null } | null;
  /** Wave 7: the track card's state (open, in progress, waiting, complete). */
  card: TrackCardState;
  /** Wave 7: the gate that holds a waiting track, as the server words it ("U14 checkpoint passed"), or `null`. */
  waitingFor: string | null;
  /** Wave 7: a gate beyond the side lessons is open (Arrangement & Sound's own lessons, from U09.CP). */
  pastSideLessons: boolean;
}

/** The gate that opens each track (contracts §4.3): J and R with the U13 checkpoint, A's side lessons after U03.L02. */
const MAIN_GATE: Readonly<Record<TrackId, string>> = { J: "J.main", R: "R.main", A: "A.side" };

const UNWRITTEN = "Open. Its first lessons are still being written.";

type ProgressLike = Pick<CourseProgress, "lessons" | "checkpoints" | "tracks" | "core"> | null | undefined;

function requirementMet(ref: string, progress: NonNullable<ProgressLike>): boolean {
  if (ref.endsWith(".CP")) {
    const cp = progress.checkpoints.find((c) => c.cpId === ref);
    return cp?.status === "passed" || cp?.status === "soft-passed";
  }
  return progress.lessons.some((l) => l.lessonId === ref && l.status === "completed");
}

function requirementWords(ref: string, syllabus: SyllabusDef | null): string {
  // In words, as the server's track note says it ("U13.CP" reads "the unit 13 checkpoint"): the kit's one wording.
  if (ref.endsWith(".CP")) return opensWithCheckpoint(ref);
  const title = syllabus?.units.flatMap((u) => u.lessons).find((l) => l.id === ref)?.title;
  return title ? `Opens after ${title}.` : `Opens after ${ref}.`;
}

/**
 * The three advanced tracks as the shell names them, in the order J, R, A; `[]` while the course progress has not
 * loaded (nothing is claimed before it is known, as with the rail's locks).
 */
export function shellTracks(progress: ProgressLike, syllabus: SyllabusDef | null = null): ShellTrack[] {
  if (!progress) return [];
  return TRACK_IDS.map((trackId): ShellTrack => {
    const title = TRACK_TITLES[trackId];
    const fromServer = progress.tracks?.find((t) => t.trackId === trackId);
    if (fromServer) return fromTrackState(fromServer);
    const gate = TRACK_GATES.find((g) => g.gateId === MAIN_GATE[trackId]);
    const refs: readonly string[] = gate?.requires ?? [];
    const open = refs.length > 0 && refs.every((r) => requirementMet(r, progress));
    if (!open)
      return {
        trackId,
        title,
        state: "locked",
        note: refs[0] ? requirementWords(refs[0], syllabus) : "Not open yet.",
        next: null,
        session: null,
        card: "waiting",
        waitingFor: null,
        pastSideLessons: false,
      };
    return {
      trackId,
      title,
      state: "open",
      note: trackId === "A" ? "Its side lessons are open. The rest is still being written." : UNWRITTEN,
      next: null,
      session: null,
      card: "waiting",
      waitingFor: null,
      pastSideLessons: false,
    };
  });
}

export function fromTrackState(t: TrackState): ShellTrack {
  const next = trackNext(t);
  return {
    trackId: t.trackId,
    title: t.title || TRACK_TITLES[t.trackId],
    // Wave 7: a track whose next session is its checkpoint or a capstone session is ready too.
    state: next && t.status === "open" ? "ready" : branchState(t),
    note: t.note,
    next: t.next,
    session: next ? { kind: next.kind, id: next.id, title: next.title } : null,
    card: trackCardState(t),
    waitingFor: trackWaitingFor(t),
    pastSideLessons: t.gates.some((g) => g.open && g.gateId !== "A.side"),
  };
}

/** Where a track's next session is: the lesson, the checkpoint, the capstone; `null` when nothing can start. */
export function trackSessionTarget(
  t: Pick<ShellTrack, "session">,
):
  | { kind: "lesson"; lessonId: string }
  | { kind: "checkpoint"; unitId: string }
  | { kind: "capstone"; capstoneId: string }
  | null {
  const s = t.session;
  if (!s) return null;
  if (s.kind === "checkpoint") return { kind: "checkpoint", unitId: s.id };
  if (s.kind === "capstone") return { kind: "capstone", capstoneId: s.id.replace(/\.S\d+$/, "") };
  return { kind: "lesson", lessonId: s.id };
}

/**
 * What the Oak's rail item says once a track is open: "The Oak: Jazz Harmony and Advanced Rhythm are open, their
 * first lessons still being written". Only J and R are named here: Arrangement & Sound's side lessons are optional
 * lessons of their own (the palette's "Optional side lesson" rows) and never a reason to mark the rail. A track
 * with a lesson to start is named with it ("Jazz Harmony: next J1.L01"). `null`: nothing to add to the label.
 */
export function oakTracksNote(tracks: readonly ShellTrack[]): string | null {
  // Wave 7: Arrangement & Sound is named once its own lessons are open (U09.CP), not for the side lessons; a
  // complete track is not named (nothing to say about it in a rail label, and nothing reads as finished there).
  const named = tracks.filter(
    (t) => (t.trackId !== "A" || t.pastSideLessons) && t.state !== "locked" && t.card !== "complete",
  );
  if (named.length === 0) return null;
  const ready = named.filter((t) => t.state === "ready" && (t.session?.id ?? t.next));
  if (ready.length > 0) return ready.map((t) => `${t.title}: next ${t.session?.id ?? t.next}`).join("; ");
  const held = named.filter((t) => t.waitingFor);
  if (held.length > 0) return held.map((t) => `${t.title} waits for: ${t.waitingFor}`).join("; ");
  const titles = listWords(named.map((t) => t.title));
  return named.length === 1
    ? `${titles} is open, its first lessons still being written`
    : `${titles} are open, their first lessons still being written`;
}

/** The rail label of the Oak: its own name, and what is open on it. */
export function oakNavLabel(base: string, tracks: readonly ShellTrack[]): string {
  const note = oakTracksNote(tracks);
  return note ? `${base}: ${note}` : base;
}

/** The palette hint of a track: "Advanced track · Its first lessons are still being written." */
export function trackHint(t: ShellTrack): string {
  const note = branchNote(t.state, t.note).replace(/\.$/, "");
  if (t.state === "locked") return `Advanced track · ${lowerFirst(note)}`;
  // Wave 7: where the learner stands, then the honest line (a gate by name, never a count of what is missing). A
  // note that only says "Open." adds nothing after "open".
  const rest = /^open$/i.test(note.trim()) || note.trim() === "" ? "" : ` · ${lowerFirst(note)}`;
  if (t.card === "complete") return "Advanced track · complete · every lesson stays open to replay";
  if (t.card === "waiting" && t.waitingFor) return `Advanced track · open · waits for: ${t.waitingFor}`;
  if (t.card === "in-progress") return `Advanced track · in progress${rest}`;
  return `Advanced track · open${rest}`;
}

const lowerFirst = (s: string): string =>
  /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;

/** Which track a lesson belongs to (`J1.L01` → J), or `null` for a core lesson. */
export function trackOfLesson(lessonId: string): TrackId | null {
  const m = /^([JRA])\d+\./.exec(lessonId);
  return m ? (m[1] as TrackId) : null;
}

/**
 * A lesson with a lesson file. An empty set means the bundle carries no lesson files at all (built from the
 * registries): nothing is judged unwritten then (the rule of app/src/session/edge.ts `isWritten`).
 */
export function lessonWritten(lessonId: string, authored: ReadonlySet<string>): boolean {
  return authored.size === 0 || authored.has(lessonId);
}

/**
 * The palette hint of a lesson that is not written yet: "Jazz Harmony · still being written" for a track's lesson,
 * "Still being written" for a core lesson; `null` for a written one.
 */
export function unwrittenHint(lessonId: string, authored: ReadonlySet<string>): string | null {
  if (lessonWritten(lessonId, authored)) return null;
  const track = trackOfLesson(lessonId);
  return track ? `${TRACK_TITLES[track]} · still being written` : "Still being written";
}

// --- after the core --------------------------------------------------------------------------------

export type OpenEntry = CoreCompletion["open"][number];

export interface OpenCommand {
  id: string;
  title: string;
  hint: string;
  /** Where it leads; `null`: it cannot be started (a track with no lesson), so it leads to the Oak's course view. */
  to:
    | { kind: "lesson"; lessonId: string }
    | { kind: "capstone"; capstoneId: string }
    | { kind: "path"; path: "/" | "/studio" | "/practice/review" | "/transcribe" | "/oak" };
}

/**
 * What stays open after the core as palette commands, in the server's order (`course.completion.open`). An entry
 * that cannot be started keeps its honest note and leads to the Oak, never to a lesson. Reviews and the gym start
 * from their own pages; a capstone left to release opens its workspace.
 */
export function openCommands(open: readonly OpenEntry[]): OpenCommand[] {
  return open.map((e, i): OpenCommand => {
    const id = `open:${e.kind}:${e.id ?? i}`;
    // "Open to you" is said only of what can be started; a track with no lesson yet is open with nothing to start.
    const hint = e.available
      ? `Open to you · ${e.note}`
      : `Open, nothing to start yet · ${lowerFirst(branchNote("open", e.note))}`;
    const base = { id, title: e.title, hint };
    if (!e.available) return { ...base, to: { kind: "path", path: "/oak" } };
    switch (e.kind) {
      case "review":
        return { ...base, to: { kind: "path", path: "/practice/review" } };
      case "gym":
        return { ...base, to: { kind: "path", path: "/transcribe" } };
      case "studio":
        return { ...base, to: { kind: "path", path: "/studio" } };
      case "side-lesson":
        return e.id && /\.L\d+$/.test(e.id)
          ? { ...base, to: { kind: "lesson", lessonId: e.id } }
          : { ...base, to: { kind: "path", path: "/" } };
      case "capstone":
        return e.id
          ? { ...base, to: { kind: "capstone", capstoneId: e.id } }
          : { ...base, to: { kind: "path", path: "/" } };
      case "track":
        return e.id && /\.L\d+$/.test(e.id)
          ? { ...base, to: { kind: "lesson", lessonId: e.id } }
          : { ...base, to: { kind: "path", path: "/oak" } };
    }
    // A kind a newer server sends that this shell does not know: the Oak draws it.
    return { ...base, to: { kind: "path", path: "/oak" } };
  });
}

/**
 * The tracks `course.completion.open` already lists — by their letter (nothing to start) or by the lesson they lead
 * to (Wave 7: an open track's entry carries its next lesson): the palette then shows each once.
 */
export function tracksListedOpen(open: readonly OpenEntry[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const e of open) {
    if (e.kind !== "track" || e.id === null) continue;
    if (/^[JRA]$/.test(e.id)) out.add(e.id);
    else {
      const t = trackOfLesson(e.id);
      if (t) out.add(t);
    }
  }
  return out;
}

/**
 * Words the navigation must never use about the course, whatever its stage (docs/design/wave6.md §10 item 17,
 * content/specs/END.md "Never"): the rail, the palette's own commands and the shortcut sheet are checked against
 * them in course-state.test.ts and in the browser.
 */
export const FINISHED_WORDS =
  /\b(finished|course complete|all done|nothing left|you're done|completed the course)\b/i;
