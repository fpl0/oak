// Wave 7 (docs/design/wave7.md §5.1–§5.3, §5.8; contracts §2.6, §4.3, §7.6 rules 4–5, §9.1): the advanced tracks as
// sessions. What each track lets the learner start now (a capstone already under way, then its checkpoint when due,
// then the first item of the track's fixed order that can be started: a lesson or a capstone session), the learner's
// choice between the core and the tracks (`tracks.focus`), Today's track offers, the track checkpoints and capstones
// with their status, and the end of the whole course (all 259 sessions). Read-only over the repositories apart from
// the focus and the whole course's row.
import {
  COURSE_SESSIONS,
  type NextSession,
  TRACK_CAPSTONE_GATES,
  TRACK_CHECKPOINTS,
  TRACK_IDS,
  TRACK_TITLES,
  type TrackFocus,
  type TrackFocusId,
  type TrackOffer,
  type TrackState,
} from "@oak/api";
import type { TrackId } from "@oak/content-kit";
import { dayIndex } from "../lib/days.ts";
import { LearnerTime, type ServiceContext } from "./context.ts";
import type { GatesService } from "./gates.ts";

type Track = (typeof TRACK_IDS)[number];

/**
 * The fixed order inside each track (contracts §2.6; content/syllabus.ts `trackOrder`, pinned by track-plan.test.ts):
 * lessons, the track checkpoints and the capstone sessions where the default order puts them.
 */
// biome-ignore format: one track to a block, as in content/syllabus.ts
export const TRACK_ORDER: Readonly<Record<Track, readonly string[]>> = {
  J: [
    "J1.L01", "J1.L02", "J1.L03", "J1.L04", "J1.L05", "J2.L01", "J2.L02", "J2.L03", "J2.L04", "J.CP1",
    "JC1.S1", "JC1.S2", "J3.L01", "J3.L05", "J3.L02", "J3.L03", "J3.L04", "J4.L01", "J4.L02", "J4.L03",
    "J4.L04", "JC2.S1", "JC2.S2", "J5.L01", "J5.L02", "J5.L03", "J5.L04", "J5.L05", "J.CP2", "JC3.S1",
    "JC3.S2", "JC3.S3", "JC4.S1", "JC4.S2", "JC4.S3",
  ],
  R: [
    "R1.L01", "R1.L02", "R1.L03", "R1.L04", "R1.L06", "R1.L05", "R2.L01", "R2.L02", "R2.L03", "R2.L04",
    "R2.L05", "R3.L01", "R3.L02", "R3.L03", "R3.L04", "R3.L05", "R.CP", "RC1.S1", "RC1.S2", "RC2.S1",
    "RC2.S2",
  ],
  A: [
    "A1.L01", "A1.L02", "A1.L03", "A1.L04", "A1.L05", "A1.L06", "A1.L07", "A2.L01", "A2.L02", "A2.L08",
    "A2.L09", "A2.L03", "A2.L07", "A2.L04", "A2.L05", "A2.L06", "A.CP", "AC1.S1", "AC1.S2", "AC1.S3",
    "AC2.S1", "AC2.S2", "AC2.S3",
  ],
};

/** The track a map item belongs to, or `null` for the core and the gym. */
export function trackOf(id: string): Track | null {
  for (const t of TRACK_IDS) if (TRACK_ORDER[t].includes(id)) return t;
  return null;
}

/** Contracts §9.1: the whole session in minutes, by kind and target (warm-up + main block + Coda). */
export const SESSION_TOTAL = {
  lesson: { 15: 15, 20: 20, 25: 25 },
  checkpoint: { 15: 20, 20: 20, 25: 20 },
  capstone: { 15: 15, 20: 19, 25: 24 },
  gym: { 15: 15, 20: 19, 25: 24 },
  review: { 15: 5, 20: 6, 25: 7 },
} as const;

/**
 * Capstones whose work is a written song (wave7.md §5.3): JC4 reharmonizes Georgia on My Mind or Body and Soul, so it
 * is offered once one of them has an answer key in content/repertoire (until then it is honestly not open to work).
 */
export const CAPSTONE_SONGS: Readonly<Record<string, readonly string[]>> = {
  JC4: ["song.georgia-on-my-mind", "song.body-and-soul"],
};

export interface TrackSession {
  kind: "lesson" | "checkpoint" | "capstone";
  id: string;
  trackId: Track;
  title: string;
}

export interface TrackPlanDeps {
  gates: GatesService;
}

export class TrackPlanService {
  readonly time: LearnerTime;
  constructor(
    private readonly ctx: ServiceContext,
    private readonly d: TrackPlanDeps,
  ) {
    this.time = new LearnerTime(ctx);
  }

  get #content() {
    return this.ctx.content;
  }
  get #repos() {
    return this.ctx.repos;
  }

  // --- the learner's focus --------------------------------------------------------------------------

  /** `GET /tracks/focus`: the learner's choice; never chosen = `core`. */
  focus(): TrackFocus {
    const row = this.#repos.trackFocus.get();
    return { focus: row?.focus ?? "core", chosenAt: row?.chosenAt ?? null };
  }
  /** `PUT /tracks/focus`, idempotent: the same choice again keeps its instant. */
  setFocus(focus: TrackFocusId): TrackFocus {
    const row = this.#repos.trackFocus.get();
    if (row?.focus !== focus) this.#repos.trackFocus.set(focus, this.time.iso());
    return this.focus();
  }

  // --- titles -----------------------------------------------------------------------------------------

  title(id: string): string {
    return (
      this.#content.lessonDef(id)?.title ??
      this.#content.lessonSite(id)?.meta.title ??
      this.#content.checkpointMeta(id)?.title ??
      this.#content.capstoneMeta(id.replace(/\.S\d+$/, ""))?.title ??
      id
    );
  }

  /** The content's objective for a session (a lesson's objective, a checkpoint's coverage, a capstone's goal). */
  goal(id: string): string {
    const site = this.#content.lessonSite(id);
    if (site !== null) return this.#content.lessonDef(id)?.objective ?? site.meta.objective;
    const cp = this.#content.checkpointMeta(id);
    if (cp !== null) {
      const track = TRACK_CHECKPOINTS.find((c) => c.cpId === id);
      return track !== undefined
        ? `A checkpoint over ${track.covers}.`
        : `A checkpoint over ${cp.covers.join(", ")}.`;
    }
    const m = /^(.+)\.S(\d+)$/.exec(id);
    if (m !== null) {
      const def = this.#content.capstoneDef(m[1] as string);
      const session = def?.sessionDefs.find((s) => s.id === id) as
        | { goal?: string; title?: string }
        | undefined;
      const meta = this.#content.capstoneMeta(m[1] as string);
      const total = meta?.sessions ?? 1;
      return session?.goal ?? session?.title ?? `${meta?.title ?? m[1]}: session ${m[2]} of ${total}.`;
    }
    return this.title(id);
  }

  // --- what each track lets the learner start -------------------------------------------------------

  /** Whether a capstone of the track can be offered: written, open, and (AC1) with a tune that is open. */
  #capstoneOffered(capstoneId: string): boolean {
    const meta = this.#content.capstoneMeta(capstoneId);
    if (meta === null || this.#content.capstoneDef(capstoneId) === null) return false;
    if (!this.d.gates.capstoneOpen(meta)) return false;
    if (this.#repos.capstones.get(capstoneId)?.status === "released") return false;
    const songs = CAPSTONE_SONGS[capstoneId];
    if (songs !== undefined && !songs.some((id) => this.#content.source.songs.some((x) => x.id === id)))
      return false;
    const tunes = this.tunes(capstoneId);
    return tunes === null || tunes.some((t) => t.open);
  }

  /**
   * AC1's tunes (`CapstoneGate.tunes`, wave7.md §5.3): each tune whose answer key is written, open once its own
   * requirement is met (Sweet Georgia Brown: U15.L05). `null` for a capstone without separate tunes.
   */
  tunes(
    capstoneId: string,
  ): { songId: string; title: string; open: boolean; reason: string | null }[] | null {
    const gate = TRACK_CAPSTONE_GATES.find((g) => g.capstoneId === capstoneId) as
      | { tunes?: readonly { songId: string; requires: readonly string[] }[] }
      | undefined;
    if (gate?.tunes === undefined) return null;
    const out: { songId: string; title: string; open: boolean; reason: string | null }[] = [];
    for (const t of gate.tunes) {
      const song = this.#content.source.songs.find((s) => s.id === t.songId);
      if (song === undefined) continue;
      const missing = t.requires.filter((r) =>
        this.#content.checkpointMeta(r) !== null
          ? !this.d.gates.checkpointPassed(r)
          : !this.d.gates.lessonCompleted(r),
      );
      out.push({
        songId: t.songId,
        title: song.title,
        open: missing.length === 0,
        reason: missing.length === 0 ? null : `Opens after ${missing.join(" and ")}.`,
      });
    }
    return out;
  }

  /** The capstone of the track already under way (started, not released) and its next session. */
  capstoneUnderWay(trackId: Track): string | null {
    for (const id of TRACK_ORDER[trackId]) {
      const m = /^(.+)\.S\d+$/.exec(id);
      if (m === null) continue;
      const row = this.#repos.capstones.get(m[1] as string);
      if (row === null || row.status === "released" || row.sessions.length === 0) continue;
      if (this.d.gates.sessionDone(id)) continue;
      return this.d.gates.sessionOpen(id) ? id : null;
    }
    return null;
  }

  /**
   * A track checkpoint is due (contracts §7.6: placed after any one intervening session, like the core's on a later
   * day): open, not passed, the last lesson it covers completed on an earlier learner day, and a failed attempt's
   * retake on a later day than that attempt.
   */
  checkpointDue(cpId: string, day = this.time.day()): boolean {
    if (!this.d.gates.checkpointOpen(cpId) || this.d.gates.checkpointPassed(cpId)) return false;
    let last: string | null = null;
    for (const l of this.#content.lessonsCovered(cpId)) {
      const at = this.#repos.lessons.progress(l)?.completedAt ?? null;
      if (at !== null && (last === null || at > last)) last = at;
    }
    const failed = this.#repos.checkpoints
      .attempts(cpId)
      .filter((a) => a.finishedAt !== null)
      .at(-1)?.finishedAt;
    if (failed !== undefined && failed !== null && (last === null || failed > last)) last = failed;
    if (last === null) return true;
    return dayIndex(day) > dayIndex(this.time.day(new Date(last)));
  }

  /**
   * What the learner may start now in a track (wave7.md §5.1): a capstone already under way; else the track's
   * checkpoint when due (it is scheduled, §7.6); else the first item of the track's order that is not done and can
   * be started — an open capstone's first session, then a written, open lesson (or a capstone's next session). J2.L04 is passed over while U14.CP is
   * not passed (optional) and comes back first once it is. `null` when nothing of the track can be started.
   */
  nextSession(trackId: Track, day = this.time.day()): TrackSession | null {
    const g = this.d.gates;
    const make = (kind: TrackSession["kind"], id: string): TrackSession => ({
      kind,
      id,
      trackId,
      title: this.title(id),
    });
    if (!this.trackOpen(trackId)) return null;
    const underWay = this.capstoneUnderWay(trackId);
    if (underWay !== null) return make("capstone", underWay);
    for (const cp of TRACK_CHECKPOINTS)
      if (cp.trackId === trackId && this.checkpointDue(cp.cpId, day)) return make("checkpoint", cp.cpId);
    // A capstone that has opened comes next (wave7.md §6: J.CP1 passed → JC1.S1, even with J2.L04 still to take).
    for (const id of TRACK_ORDER[trackId]) {
      const m = /^(.+)\.S1$/.exec(id);
      if (m === null || g.sessionDone(id) || !this.#capstoneOffered(m[1] as string)) continue;
      if (g.sessionOpen(id)) return make("capstone", id);
    }
    for (const id of TRACK_ORDER[trackId]) {
      if (g.sessionDone(id)) continue;
      if (this.#content.lessonSite(id) !== null) {
        if (this.#content.lessonDef(id) === null) continue;
        if (g.lessonOpen(id)) return make("lesson", id);
        continue;
      }
      const m = /^(.+)\.S\d+$/.exec(id);
      if (m === null) continue;
      if (!this.#capstoneOffered(m[1] as string)) continue;
      if (g.sessionOpen(id)) return make("capstone", id);
    }
    return null;
  }

  /**
   * The first written, open lesson of a track not done yet, or `null` (review:robustness). A track checkpoint gates
   * only its track's capstones (contracts §7.6 rule 5): while it is due, or after a failed attempt while its retake
   * is, this lesson stays open and Today offers it beside the checkpoint.
   */
  nextLesson(trackId: Track): TrackSession | null {
    if (!this.trackOpen(trackId)) return null;
    for (const id of TRACK_ORDER[trackId]) {
      if (this.d.gates.sessionDone(id) || this.#content.lessonSite(id) === null) continue;
      if (this.#content.lessonDef(id) === null || !this.d.gates.lessonOpen(id)) continue;
      return { kind: "lesson", id, trackId, title: this.title(id) };
    }
    return null;
  }

  /** A track is open once its first lesson gate is met (J and R: U13.CP; A: U03.L02). */
  trackOpen(trackId: Track): boolean {
    const first = TRACK_ORDER[trackId][0] as string;
    return this.#content.trackGatesFor(first, first.slice(0, 2)).every((gate) => this.d.gates.gateMet(gate));
  }

  sessionsDone(trackId: Track): number {
    return TRACK_ORDER[trackId].filter((id) => this.d.gates.sessionDone(id)).length;
  }
  sessionsTotal(trackId: Track): number {
    return TRACK_ORDER[trackId].length;
  }

  /** The track's checkpoints and capstones with their status (`TrackState.checkpoints`, `.capstones`). */
  checkpointsOf(trackId: Track): NonNullable<TrackState["checkpoints"]> {
    return TRACK_CHECKPOINTS.filter((c) => c.trackId === trackId).map((c) => ({
      cpId: c.cpId as NonNullable<TrackState["checkpoints"]>[number]["cpId"],
      status: this.d.gates.checkpointStatus(c.cpId).status,
    }));
  }
  capstonesOf(trackId: Track): NonNullable<TrackState["capstones"]> {
    return TRACK_CAPSTONE_GATES.filter((c) => c.trackId === trackId).map((c) => {
      const st = this.d.gates.capstoneStatus(c.capstoneId);
      return {
        capstoneId: c.capstoneId as NonNullable<TrackState["capstones"]>[number]["capstoneId"],
        status: st.status,
        lockedReason: st.lockedReason,
      };
    });
  }

  /** `TrackState.nextSession` as the API carries it. */
  nextSessionState(trackId: Track, target: 15 | 20 | 25): TrackState["nextSession"] {
    const n = this.nextSession(trackId);
    return n === null
      ? null
      : {
          kind: n.kind,
          mapItemId: n.id as NonNullable<TrackState["nextSession"]>["mapItemId"],
          title: n.title,
          estMinutes: SESSION_TOTAL[n.kind][target],
        };
  }

  /** A track session as a `NextSession` (Today's offers, the Coda's next line). */
  asNext(s: TrackSession, target: 15 | 20 | 25, day: NextSession["day"]): NextSession {
    return {
      kind: s.kind,
      mapItemId: s.id as NextSession["mapItemId"],
      title: s.title,
      goal: this.goal(s.id),
      estMinutes: SESSION_TOTAL[s.kind][target],
      trackId: s.trackId,
      slot: null,
      day,
    };
  }

  /**
   * `SessionPlan.trackOffers` (wave7.md §5.2): each open track with a session the learner may start now, in the order
   * J, R, A with the focused track first (the focused track's offer is the New block itself when it is planned).
   */
  offers(target: 15 | 20 | 25, opts: { day?: string; except?: string | null } = {}): TrackOffer[] {
    const focus = this.focus().focus;
    const order = [...TRACK_IDS].sort((a, b) => (a === focus ? -1 : b === focus ? 1 : 0));
    const out: TrackOffer[] = [];
    for (const t of order) {
      const n = this.nextSession(t, opts.day);
      if (n === null) continue;
      const next = this.asNext(n, target, "today");
      out.push({
        trackId: t,
        title: TRACK_TITLES[t],
        next,
        sessionsDone: this.sessionsDone(t),
        sessionsTotal: this.sessionsTotal(t),
        note: `${TRACK_TITLES[t]} · next: ${n.id} ${n.title} (about ${next.estMinutes} minutes)`,
      });
    }
    return out;
  }

  // --- the whole course (session 259) -----------------------------------------------------------------

  /** Every lesson and checkpoint of the three tracks done and their eight capstones released. */
  tracksComplete(): boolean {
    const g = this.d.gates;
    return TRACK_IDS.every((t) =>
      TRACK_ORDER[t].every((id) => {
        const m = /^(.+)\.S\d+$/.exec(id);
        return m === null ? g.sessionDone(id) : g.capstoneReleased(m[1] as string);
      }),
    );
  }

  /** Sessions done of the tracks (each track's order), for the whole course's count. */
  tracksSessionsDone(): number {
    return TRACK_IDS.reduce((n, t) => n + this.sessionsDone(t), 0);
  }

  static readonly TOTAL = COURSE_SESSIONS.total;
}

export type { TrackId };
