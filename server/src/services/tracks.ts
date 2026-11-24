// Wave 6 (docs/design/wave6.md §5.3, §5.5; contracts §2.5, §2.6, §4.3; content/specs/END.ts "The server's part"):
// the advanced tracks' lesson gates, recorded the moment each is met and announced once, and the end of the core —
// its stage, the instant it was reached, what the learner can now do and what stays open after it.
import {
  ALBUM_SIDES,
  COURSE_SESSIONS,
  type CoreCompletion,
  type SessionPlan,
  TRACK_GATES,
  TRACK_IDS,
  TRACK_TITLES,
  type TrackGateState,
  type TrackState,
  type WholeCourse,
} from "@oak/api";
import { LearnerTime, type ServiceContext } from "./context.ts";
import { checkpointName, type GatesService } from "./gates.ts";
import { TRACK_ORDER, type TrackPlanService } from "./track-plan.ts";
import { CANDO_AREAS_ORDER } from "./tracks-order.ts";

type TrackId = (typeof TRACK_IDS)[number];
type CoreStage = CoreCompletion["stage"];

/** The gate whose meeting opens each track (contracts §4.3; `TrackState.status`). */
const MAIN_GATE: Record<TrackId, string> = { J: "J.main", R: "R.main", A: "A.side" };
/** The track's name inside a sentence ("The Jazz and Rhythm tracks are open"). */
/** A checkpoint in the learner's words: "U13.CP" reads "the unit 13 checkpoint" (an ID never stands alone). */
export function checkpointWords(ref: string): string {
  const unit = /^U(\d+)\.CP/.exec(ref);
  return unit ? `the unit ${Number(unit[1])} checkpoint` : "its checkpoint";
}

const TRACK_SHORT: Record<TrackId, string> = { J: "Jazz", R: "Rhythm", A: "Arrangement" };
/** The core-complete milestone (content/milestones.ts; ux §5.5 M7). */
export const CORE_MILESTONE = "ms.07";
/** A marker for a gate or a completion found already met at start-up: it was never a Coda's news. */
const NOT_ANNOUNCED = "-";

export interface TracksDeps {
  gates: GatesService;
  /** The next unfinished side lesson (`SideLessonsService.list().next`) with its title, or `null`. */
  sideLesson: () => { lessonId: string; title: string } | null;
  /** Review items due by the end of the next learner day. */
  dueTomorrow: () => number;
  /** The next L8 standard the ladder would draw (ladder at 8, one left), or `null`. */
  nextStandard: () => string | null;
  /** Wave 7: what each track lets the learner start, the focus, the whole course (wave7.md §5). */
  plan?: TrackPlanService;
}

export class TracksService {
  readonly time: LearnerTime;
  constructor(
    private readonly ctx: ServiceContext,
    private readonly d: TracksDeps,
  ) {
    this.time = new LearnerTime(ctx);
  }

  get #content() {
    return this.ctx.content;
  }
  get #repos() {
    return this.ctx.repos;
  }

  // --- gates --------------------------------------------------------------------------------------

  #requirement(ref: string): TrackGateState["requires"][number] {
    const cp = this.#content.checkpointMeta(ref);
    if (cp !== null)
      return {
        ref,
        kind: "checkpoint",
        label: `${checkpointName(cp.title)} passed`,
        met: this.d.gates.checkpointPassed(ref),
      };
    return {
      ref,
      kind: "lesson",
      label: `${ref} completed`,
      met: this.d.gates.lessonCompleted(ref),
    };
  }

  /** The lessons a gate opens: every lesson of a unit it names, or the lessons it names (`A1.L01–L04`). */
  #lessonsBehind(gate: (typeof TRACK_GATES)[number]): string[] {
    const spec = this.#content.source.syllabus.trackGates.find((g) => {
      const need = [...(g.gate.checkpoints ?? []), ...(g.gate.lessonsCompleted ?? [])] as string[];
      return (
        need.length === gate.requires.length &&
        gate.requires.every((r) => need.includes(r)) &&
        (g.opens as string[]).some((o) => (gate.units as readonly string[]).some((u) => o.startsWith(u)))
      );
    });
    const opens = (spec?.opens ?? []) as string[];
    const out: string[] = [];
    for (const o of opens) {
      if (!(gate.units as readonly string[]).some((u) => o.startsWith(u))) continue;
      if (this.#content.lessonSite(o) !== null) out.push(o);
      else for (const s of this.#content.allLessons()) if (s.unit.id === o) out.push(s.meta.id as string);
    }
    return out;
  }

  gateState(gate: (typeof TRACK_GATES)[number]): TrackGateState {
    const row = this.#repos.trackGates.get(gate.gateId);
    const requires = gate.requires.map((r) => this.#requirement(r));
    const lessons = this.#lessonsBehind(gate);
    return {
      gateId: gate.gateId,
      trackId: gate.trackId,
      opens: gate.opens,
      requires,
      open: row !== null || requires.every((r) => r.met),
      openedAt: row?.openedAt ?? null,
      lessonsAuthored: lessons.filter((l) => this.#content.lessonDef(l) !== null).length,
      lessonsTotal: lessons.length,
    };
  }

  gateStates(): TrackGateState[] {
    return TRACK_GATES.map((g) => this.gateState(g));
  }

  /**
   * Records every gate that is met and not recorded yet. `sourceId` is the checkpoint or lesson that met it (the
   * gate is then news for that outcome and that session's Coda); `null` at start-up, for a learner already past
   * it: recorded with its instant, never announced.
   */
  recordGates(sourceId: string | null): TrackGateState[] {
    const opened: TrackGateState[] = [];
    const now = this.time.iso();
    for (const gate of TRACK_GATES) {
      if (this.#repos.trackGates.get(gate.gateId) !== null) continue;
      if (!gate.requires.every((r) => this.#requirement(r).met)) continue;
      if (!this.#repos.trackGates.record(gate.gateId, now, sourceId)) continue;
      // The A gates are listed for completeness (wave6.md §5.3): A.side is Wave 5's side-lesson gate, announced by
      // its own surfaces, and no lesson stands behind the other two yet. They are recorded, never a Coda's news.
      if (sourceId === null || gate.trackId === "A") {
        this.#repos.trackGates.announce(gate.gateId, NOT_ANNOUNCED);
        continue;
      }
      opened.push(this.gateState(gate));
    }
    return opened;
  }

  /** The gates a session's Coda announces (once): recorded with a source and not announced yet. */
  announceGates(sessionId: string): TrackGateState[] {
    const out: TrackGateState[] = [];
    for (const row of this.#repos.trackGates.all()) {
      if (row.announcedSession !== null || row.sourceId === null) continue;
      this.#repos.trackGates.announce(row.gateId, sessionId);
      const gate = TRACK_GATES.find((g) => g.gateId === row.gateId);
      if (gate !== undefined) out.push(this.gateState(gate));
    }
    return out;
  }

  // --- tracks -------------------------------------------------------------------------------------

  #trackLessons(trackId: TrackId): string[] {
    return this.#content.trackLessons(trackId) as string[];
  }

  /** The next lesson of a track the learner may start now: authored, open, not completed, not a side lesson. */
  #nextOf(trackId: TrackId): string | null {
    for (const id of this.#trackLessons(trackId)) {
      const site = this.#content.lessonSite(id);
      if (site === null || site.meta.side === true) continue;
      if (this.#content.lessonDef(id) === null) continue;
      if (this.d.gates.lessonCompleted(id) || !this.d.gates.lessonOpen(id)) continue;
      return id;
    }
    return null;
  }

  trackState(trackId: TrackId): TrackState {
    const gates = TRACK_GATES.filter((g) => g.trackId === trackId).map((g) => this.gateState(g));
    const main = gates.find((g) => g.gateId === MAIN_GATE[trackId]);
    const open = main?.open ?? false;
    const def = this.#content.source.syllabus.tracks.find((t) => t.id === trackId);
    const lessons = this.#trackLessons(trackId);
    const cps = (def?.checkpoints ?? []) as string[];
    const caps = (def?.capstones ?? []) as string[];
    const capSessions = caps.flatMap((c) => this.#content.capstoneSessionIds(c));
    const sessionsDone =
      lessons.filter((l) => this.d.gates.lessonCompleted(l)).length +
      cps.filter((c) => this.d.gates.checkpointPassed(c)).length +
      capSessions.filter((s) => this.d.gates.sessionDone(s)).length;
    const next = open ? this.#nextOf(trackId) : null;
    const authored = lessons.filter((l) => this.#content.lessonDef(l) !== null);
    // Wave 7 (wave7.md §5.1): the next session of any kind, the learner's focus, the checkpoints and capstones.
    const plan = this.d.plan;
    const target = this.#repos.profile.get().targetMinutes;
    const nextSession = plan === undefined ? undefined : open ? plan.nextSessionState(trackId, target) : null;
    let note: string;
    const sessionsTotal = lessons.length + cps.length + capSessions.length;
    if (open && sessionsTotal > 0 && sessionsDone >= sessionsTotal)
      // Every session of the track is done (wave 7 closer): say so, never "still being written".
      note = `All ${sessionsTotal} sessions done. Its lessons stay open to replay.`;
    else if (!open) {
      const first = main?.requires.find((r) => !r.met) ?? main?.requires[0];
      note =
        first === undefined
          ? "Not open yet."
          : first.kind === "checkpoint"
            ? `Opens with ${checkpointWords(first.ref)}.`
            : `Opens with the lesson “${this.#content.lessonTitle(first.ref)}”.`;
    } else if (nextSession !== null && nextSession !== undefined && nextSession.kind !== "lesson")
      note = `Next: ${nextSession.mapItemId} ${nextSession.title}.`;
    else if (next !== null) note = `Next: ${next} ${this.#content.lessonTitle(next)}.`;
    else if (authored.length === 0) note = "Open. Its first lessons are still being written.";
    else if (authored.every((l) => this.d.gates.lessonCompleted(l)))
      note = "Open. Its next lessons are still being written.";
    else if (authored.every((l) => this.#content.lessonSite(l)?.meta.side === true))
      note = "Its side lessons are open. The rest is still being written.";
    else note = "Open.";
    return {
      trackId,
      title: TRACK_TITLES[trackId],
      status: open ? "open" : "locked",
      openedAt: open ? (main?.openedAt ?? null) : null,
      gates,
      sessionsDone,
      sessionsTotal,
      next: next as TrackState["next"],
      note,
      ...(plan === undefined
        ? {}
        : {
            nextSession: nextSession ?? null,
            focus: plan.focus().focus === trackId,
            checkpoints: plan.checkpointsOf(trackId),
            capstones: plan.capstonesOf(trackId),
          }),
    };
  }

  list(): TrackState[] {
    return TRACK_IDS.map((t) => this.trackState(t));
  }

  /**
   * `SessionPlan.tracks` (wave6.md §5.3): the open tracks that have no lesson to start, in one honest line; `null`
   * before any such gate is met and once a track lesson can be planned.
   */
  planTracks(): SessionPlan["tracks"] {
    const states = this.list();
    if (states.some((s) => s.next !== null)) return null;
    // A track whose only authored lessons are side lessons (A) has its own row and offer; the line names the others.
    const open = states.filter(
      (s) =>
        s.status === "open" &&
        this.#trackLessons(s.trackId).every((l) => this.#content.lessonDef(l) === null),
    );
    if (open.length === 0) return null;
    const names = open.map((s) => TRACK_SHORT[s.trackId]);
    const note =
      names.length === 1
        ? `The ${names[0]} track is open. Its first lessons are still being written.`
        : `The ${names.slice(0, -1).join(", ")} and ${names.at(-1)} tracks are open. Their first lessons are still being written.`;
    return { open: open.map((s) => s.trackId), lessonsAuthored: false, note };
  }

  // --- the end of the core ------------------------------------------------------------------------

  /** The core's capstones (C0–C7, X1, X2, CF-A, CF-T): every capstone that is not an advanced track's. */
  coreCapstones(): string[] {
    const track = new Set(this.#content.source.syllabus.tracks.flatMap((t) => t.capstones as string[]));
    return this.#content
      .capstones()
      .map((c) => c.id as string)
      .filter((c) => !track.has(c));
  }

  coreStage(): CoreStage {
    const g = this.d.gates;
    if (this.#content.coreLessons.length === 0) return "in-progress";
    if (!this.#content.coreLessons.every((l) => g.lessonCompleted(l))) return "in-progress";
    const cps = this.#content.coreUnits.flatMap((u) => (u.checkpoint === undefined ? [] : [u.checkpoint]));
    if (!cps.every((c) => g.checkpointPassed(c))) return "in-progress";
    return this.coreCapstones().every((c) => g.capstoneReleased(c)) ? "complete" : "lessons-done";
  }

  /**
   * Records the completion of the core the first time the stage is `complete`. `sessionId` is the session the last
   * piece landed in; `null` at start-up (a learner already past it: recorded, never a Coda's news).
   */
  syncCore(sessionId: string | null, startup = false): boolean {
    if (this.#repos.coreState.get() !== null) return false;
    if (this.coreStage() !== "complete") return false;
    const made = this.#repos.coreState.record(this.time.iso(), sessionId);
    if (made && startup) this.#repos.coreState.announce(NOT_ANNOUNCED);
    return made;
  }

  /** The session's Coda carries the moment once: the first session to end after the core was completed. */
  announceCore(sessionId: string): CoreCompletion | null {
    this.syncCore(sessionId);
    const row = this.#repos.coreState.get();
    if (row === null || row.announcedSession !== null) return null;
    this.#repos.coreState.announce(sessionId);
    return this.completion();
  }

  /** When ms.07 was reached: the instant the core was completed, and not before (END.ts). */
  coreCompletedAt(): string | null {
    return this.#repos.coreState.get()?.completedAt ?? null;
  }

  #titleOf(id: string): string {
    return (
      this.#content.lessonDef(id)?.title ??
      this.#content.lessonSite(id)?.meta.title ??
      this.#content.checkpointMeta(id)?.title ??
      this.#content.capstoneMeta(id)?.title ??
      id
    );
  }

  /** `GET /course/completion`. */
  completion(): CoreCompletion {
    const g = this.d.gates;
    const order = this.#content.defaultOrder();
    const stage = this.coreStage();
    const row = this.#repos.coreState.get();
    const gymSlots = order.filter((id) => id.startsWith("GYM.")).length;
    const gymDone = Math.min(gymSlots, this.#repos.gym.list().length);
    const sessionsDone = order.filter((id) => !id.startsWith("GYM.") && g.sessionDone(id)).length + gymDone;

    const remaining: CoreCompletion["remaining"] = [];
    const seenCap = new Set<string>();
    for (const id of order) {
      if (remaining.length >= 12) break;
      if (id.startsWith("GYM.") || g.sessionDone(id)) continue;
      if (this.#content.lessonSite(id) !== null)
        remaining.push({ kind: "lesson", id, title: this.#titleOf(id) });
      else if (this.#content.checkpointMeta(id) !== null)
        remaining.push({ kind: "checkpoint", id, title: this.#titleOf(id) });
      else {
        const cap = id.replace(/\.S\d+$/, "");
        if (seenCap.has(cap) || g.capstoneReleased(cap)) continue;
        seenCap.add(cap);
        remaining.push({ kind: "capstone", id: cap, title: this.#titleOf(cap) });
      }
    }

    const ms = this.#content.source.milestones.find((m) => m.id === CORE_MILESTONE) ?? null;
    const sessions = this.#repos.db
      .query(
        "SELECT COUNT(*) AS n, COUNT(DISTINCT day) AS days, COALESCE(SUM(active_minutes), 0) AS minutes FROM sessions WHERE ended_at IS NOT NULL",
      )
      .get() as { n: number; days: number; minutes: number };
    const core = new Set(this.coreCapstones());
    const sideA = this.#repos.album.tracks().filter((t) => t.capstoneId !== null && core.has(t.capstoneId));
    const transcribeCaps = this.#content
      .capstones()
      .filter((c) => c.kind === "transcribe" && core.has(c.id) && g.capstoneReleased(c.id)).length;
    const ladderSongs = this.#repos.transcriptions
      .list()
      .filter((t) => t.sourceKind === "pd-song" && t.gradedPass === true).length;
    const anySession = this.#repos.sessions.first();
    const stats: CoreCompletion["stats"] = {
      firstDay: anySession === null ? null : this.time.firstDay(),
      days: sessions.days,
      sessions: sessions.n,
      activeMinutes: Math.round(sessions.minutes * 10) / 10,
      lessons: this.#content.coreLessons.filter((l) => g.lessonCompleted(l)).length,
      tracksReleased: sideA.length,
      transcriptions: transcribeCaps + ladderSongs,
      sketches: this.#repos.sketches.list({}).length,
    };

    const latest = [...sideA].sort((a, b) => {
      const ra = this.#repos.capstones.get(a.capstoneId as string)?.releasedAt ?? a.createdAt;
      const rb = this.#repos.capstones.get(b.capstoneId as string)?.releasedAt ?? b.createdAt;
      return ra.localeCompare(rb);
    });

    return {
      stage,
      completedAt: stage === "complete" ? (row?.completedAt ?? null) : null,
      sessionId:
        stage === "complete" && row !== null && row.announcedSession !== NOT_ANNOUNCED
          ? (row.announcedSession ?? row.sessionId)
          : null,
      sessionsDone,
      sessionsTotal: Math.max(1, order.length),
      remaining,
      milestone:
        ms === null
          ? null
          : {
              id: ms.id,
              title: ms.title,
              description: ms.description,
              reachedAt: stage === "complete" ? (row?.completedAt ?? null) : null,
            },
      stats,
      canDo: this.canDo(),
      album: {
        released: sideA.length,
        total: Math.max(1, core.size),
        latestTrackId: latest.at(-1)?.id ?? null,
      },
      open: this.open(stage),
    };
  }

  /**
   * What the learner can now do (END.ts "The server's part"): at most seven statements, one per area in the order
   * compose, transcribe, hear, write, read, code, sing; only `solid` or `strong`; inside an area a statement whose
   * source is a capstone first, then `strong` before `solid`, then the one whose source comes latest in the order.
   */
  canDo(): CoreCompletion["canDo"] {
    const order = this.#content.defaultOrder();
    const lastIndex = (source: string): number => {
      let at = -1;
      order.forEach((id, i) => {
        if (id === source || id.startsWith(`${source}.S`)) at = i;
      });
      return at;
    };
    const current = new Map(this.#repos.cando.current().map((c) => [c.candoId as string, c.status]));
    const out: CoreCompletion["canDo"] = [];
    for (const area of CANDO_AREAS_ORDER) {
      const held = this.#content.source.canDos
        .filter((c) => c.area === area)
        .map((c) => ({ def: c, status: current.get(c.id) }))
        .filter(
          (c): c is { def: typeof c.def; status: "solid" | "strong" } =>
            c.status === "solid" || c.status === "strong",
        );
      held.sort((a, b) => {
        const capA = this.#content.capstoneMeta(a.def.source) !== null ? 0 : 1;
        const capB = this.#content.capstoneMeta(b.def.source) !== null ? 0 : 1;
        if (capA !== capB) return capA - capB;
        if (a.status !== b.status) return a.status === "strong" ? -1 : 1;
        return lastIndex(b.def.source) - lastIndex(a.def.source);
      });
      const best = held[0];
      if (best !== undefined)
        out.push({ candoId: best.def.id, text: best.def.statement, status: best.status });
    }
    return out.slice(0, 7);
  }

  /** What stays open, in the order Today offers it (END.ts; wave6.md §5.5). */
  open(stage: CoreStage = this.coreStage()): CoreCompletion["open"] {
    const g = this.d.gates;
    const out: CoreCompletion["open"] = [];
    // Tracks of the record left to release (only before `complete`).
    if (stage !== "complete")
      for (const id of this.coreCapstones()) {
        const st = g.capstoneStatus(id);
        if (st.status === "released") continue;
        const title = this.#titleOf(id);
        out.push({
          kind: "capstone",
          id,
          title,
          note:
            st.status === "locked"
              ? (st.lockedReason ?? "Not open yet.")
              : st.status === "in_progress"
                ? `Session ${Math.min(st.sessionsDone + 1, st.sessionsTotal)} of ${st.sessionsTotal} is next.`
                : `Open: ${st.sessionsTotal} ${st.sessionsTotal === 1 ? "session" : "sessions"}.`,
          available: st.status !== "locked",
        });
      }
    const tracks = this.list();
    // A track with a next lesson the learner may start: its row carries the lesson id.
    for (const t of tracks)
      if (t.next !== null)
        out.push({ kind: "track", id: t.next, title: t.title, note: t.note, available: true });
    const due = this.d.dueTomorrow();
    out.push({
      kind: "review",
      id: null,
      title: "Reviews",
      note:
        due > 0
          ? `${due} due. They keep the Oak green.`
          : "Nothing is due tomorrow. They come back when they are needed.",
      available: true,
    });
    const gymOpen = g.lessonCompleted("U07.L01");
    const standard = this.d.nextStandard();
    out.push({
      kind: "gym",
      id: null,
      title: "Transcription Gym",
      note: !gymOpen
        ? `Opens with the lesson “${this.#content.lessonTitle("U07.L01")}”.`
        : standard !== null
          ? `Ladder level 8: ${standard}, form to tune. Every fifth session, or any day from Today.`
          : "Your own audio, a full arrangement at a time. Every fifth session, or any day from Today.",
      available: gymOpen,
    });
    out.push({
      kind: "studio",
      id: null,
      title: "Studio",
      note: "Your sketchbook. Start the next song.",
      available: true,
    });
    const side = this.d.sideLesson();
    if (side !== null)
      out.push({
        kind: "side-lesson",
        id: side.lessonId,
        title: "Side lessons: sound",
        note: `${side.title} is next, about 15 minutes.`,
        available: true,
      });
    for (const t of tracks)
      if (t.next === null)
        out.push({ kind: "track", id: t.trackId, title: t.title, note: t.note, available: false });
    return out;
  }

  // --- the whole course (wave7.md §5.8) -------------------------------------------------------------

  /** `complete` once the core is complete and every track lesson, checkpoint and capstone is done or released. */
  courseStage(): "in-progress" | "complete" {
    const plan = this.d.plan;
    if (plan === undefined || this.coreStage() !== "complete") return "in-progress";
    return plan.tracksComplete() ? "complete" : "in-progress";
  }

  /** Records the end of the whole course the first time it is complete (as `syncCore`). */
  syncWhole(sessionId: string | null, startup = false): boolean {
    if (this.#repos.courseState.get() !== null) return false;
    if (this.courseStage() !== "complete") return false;
    const made = this.#repos.courseState.record(this.time.iso(), sessionId);
    if (made && startup) this.#repos.courseState.announce(NOT_ANNOUNCED);
    return made;
  }

  /** The session's Coda carries the whole course's moment once: the first session to end after it was complete. */
  announceWhole(sessionId: string): WholeCourse | null {
    this.syncWhole(sessionId);
    const row = this.#repos.courseState.get();
    if (row === null || row.announcedSession !== null) return null;
    this.#repos.courseState.announce(sessionId);
    return this.whole();
  }

  /** `GET /course/whole`. */
  whole(): WholeCourse {
    const g = this.d.gates;
    const stage = this.courseStage();
    const row = this.#repos.courseState.get();
    const core = this.completion();
    const tracks = this.list();
    const trackDone = this.d.plan?.tracksSessionsDone() ?? 0;
    const sideB = new Set(ALBUM_SIDES.find((s) => s.side === "B")?.capstones ?? []);
    const course = new Set([...this.coreCapstones(), ...sideB]);
    const released = this.#repos.album
      .tracks()
      .filter((t) => t.capstoneId !== null && course.has(t.capstoneId));
    const latest = [...released].sort((a, b) => {
      const ra = this.#repos.capstones.get(a.capstoneId as string)?.releasedAt ?? a.createdAt;
      const rb = this.#repos.capstones.get(b.capstoneId as string)?.releasedAt ?? b.createdAt;
      return ra.localeCompare(rb);
    });
    const trackLessons = TRACK_IDS.flatMap((t) => TRACK_ORDER[t]).filter(
      (id) => this.#content.lessonSite(id) !== null,
    );
    const stats: WholeCourse["stats"] = {
      ...core.stats,
      lessons: core.stats.lessons + trackLessons.filter((l) => g.lessonCompleted(l)).length,
      tracksReleased: released.length,
    };
    return {
      stage,
      completedAt: stage === "complete" ? (row?.completedAt ?? null) : null,
      sessionId:
        stage === "complete" && row !== null && row.announcedSession !== NOT_ANNOUNCED
          ? (row.announcedSession ?? row.sessionId)
          : null,
      sessionsDone: Math.min(COURSE_SESSIONS.total, core.sessionsDone + trackDone),
      sessionsTotal: COURSE_SESSIONS.total,
      core: core.stage,
      tracks,
      album: {
        released: released.length,
        total: Math.max(1, course.size),
        latestTrackId: latest.at(-1)?.id ?? null,
      },
      stats,
      canDo: this.wholeCanDo(),
      open: this.open(core.stage).filter((o) => stage !== "complete" || o.kind !== "capstone"),
    };
  }

  /**
   * What the learner can now do across the whole course: the core's statements (one per area) and then one of each
   * track's own (a can-do whose source is a track lesson, checkpoint or capstone), at most ten.
   */
  wholeCanDo(): WholeCourse["canDo"] {
    const out = [...this.canDo()];
    const current = new Map(this.#repos.cando.current().map((c) => [c.candoId as string, c.status]));
    for (const t of TRACK_IDS) {
      const sources = new Set<string>([
        ...TRACK_ORDER[t],
        ...TRACK_ORDER[t].map((id) => id.replace(/\.S\d+$/, "")),
      ]);
      const held = this.#content.source.canDos
        .filter((c) => sources.has(c.source) && !out.some((o) => o.candoId === c.id))
        .map((c) => ({ c, status: current.get(c.id) }))
        .filter((x) => x.status === "solid" || x.status === "strong");
      const best = held.find((x) => x.status === "strong") ?? held.at(-1);
      if (best !== undefined)
        out.push({
          candoId: best.c.id,
          text: best.c.statement,
          status: best.status as "solid" | "strong",
        });
    }
    return out.slice(0, 10);
  }

  /** Start-up: a learner already past a gate, or past the end of the core, gets the rows without any announcement. */
  backfill(): void {
    this.recordGates(null);
    this.syncCore(null, true);
    this.syncWhole(null, true);
  }
}
