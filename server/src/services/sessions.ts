// Sessions: start (START unlocks, capstone state), heartbeat, end (minutes, keep-alive qualification,
// session telemetry, the Coda summary). Today's plan itself comes from the SRS engineer's planner.
import type { NextSession, Session, SessionDay, SessionSummary, SessionTelemetry } from "@oak/api";
import { STREAK } from "@oak/srs";
import { tx } from "../db/index.ts";
import { badRequest, conflict, notFound } from "../errors.ts";
import { addDays } from "../lib/days.ts";
import type { CapstoneSessionsService } from "./capstone-sessions.ts";
import { LearnerTime, newId, type ServiceContext } from "./context.ts";
import type { CourseService } from "./course.ts";
import type { GatesService } from "./gates.ts";
import type { StreakService } from "./streak.ts";
import { type TrackPlanService, trackOf } from "./track-plan.ts";
import type { TracksService } from "./tracks.ts";
import type { UnlocksService } from "./unlocks.ts";
import type { VoiceService } from "./voice.ts";

export interface SessionsDeps {
  gates: GatesService;
  unlocks: UnlocksService;
  streak: StreakService;
  course: CourseService;
  voice: VoiceService;
  /** Wave 4: a capstone session remembers the Oak session it was started in. */
  capstoneSessions?: CapstoneSessionsService;
  /** Whether the tutor is switched off in Settings (then the Coda never offers a listening note). */
  tutorOff: () => boolean;
  /** Wave 5 (c10): what a gym day's Coda shows (`GymService.summary`); absent: no gym card. */
  gymSummary?: (sessionId: string) => SessionSummary["gym"];
  /** Wave 6: the gates a session's Coda announces and the end of the core (wave6.md §5.3, §5.5). */
  tracks?: TracksService;
  /** Wave 7: the learner's focus between the tracks (wave7.md §5.2). */
  trackPlan?: TrackPlanService;
  /**
   * Wave 7 (carry f6; wave7.md §5.7): the New block the planner will put on the next learner day, given everything
   * the session just changed; `null` when nothing is planned.
   */
  nextSession?: () => NextSession | null;
}

/** Stored as `sessions.plan_json` at start: the planned warm-up and all review due then. */
export interface SessionStartRecord {
  warmupPlannedSec: number;
  dueSec: number;
  warmupItems: number;
}

/** How long after its start a session that crossed the rollover stays the open one (sessions run 15–25 min). */
const ROLLOVER_CARRY_MS = 3 * 60 * 60 * 1000;

export class SessionsService {
  readonly time: LearnerTime;
  constructor(
    private readonly ctx: ServiceContext,
    private readonly d: SessionsDeps,
  ) {
    this.time = new LearnerTime(ctx);
  }

  get(id: string): Session {
    const s = this.ctx.repos.sessions.get(id);
    if (s === null) throw notFound(`session ${id}`);
    return s;
  }

  /**
   * Every session open now, oldest first (d21: one per tab): today's, and one started on the previous learner day
   * that crossed the 04:00 rollover a short while ago (a 03:40 start reloaded at 04:10 resumes, wave5 gate; the
   * carry applies per session). A session left open yesterday and not touched for hours does not hold the new day.
   */
  openSessions(): Session[] {
    const day = this.time.day();
    const now = this.time.now().getTime();
    const carried = this.ctx.repos.sessions.openAllOn(addDays(day, -1)).filter((prev) => {
      const age = now - Date.parse(prev.startedAt);
      return age >= 0 && age <= ROLLOVER_CARRY_MS;
    });
    return [...carried, ...this.ctx.repos.sessions.openAllOn(day)];
  }

  /**
   * The session open now. With `tab` (d21, `SessionStart.tabId`, `session.day?tab=`): that tab's own open session,
   * `null` when the tab has none even if another tab has one; `null` names the anonymous tab (an older client, a
   * request made by hand). Without it: the newest open session (`bootstrap.openSession` for older clients). A tab's
   * session of today comes before one it carried over the rollover.
   */
  openToday(tab?: string | null): Session | null {
    const day = this.time.day();
    const mine = this.openSessions().filter((s) => tab === undefined || (s.tabId ?? null) === tab);
    return mine.findLast((s) => s.day === day) ?? mine.at(-1) ?? null;
  }

  /**
   * `GET /session/day` (wave3.md §5.1): the session open today and those ended today, so Today's done state
   * lives on the server. A session counts for the day its end falls on (one that crossed the 04:00 rollover
   * belongs to the new day, as the app shows it). Done for today: a planned session (any kind but Studio) ended.
   * Wave 6 (d21): `open` is the calling tab's with `tab`; `openSessions` lists every tab's; the rest is the
   * learner day's, shared by all tabs.
   */
  dayState(tab?: string): SessionDay {
    const day = this.time.day();
    const endedOn = (s: Session) =>
      s.endedAt === null ? null : s.day === day ? day : this.time.day(new Date(s.endedAt));
    const ended = this.ctx.repos.sessions
      .since(addDays(day, -1))
      .filter((s) => endedOn(s) === day)
      .sort((a, b) => (a.endedAt ?? "").localeCompare(b.endedAt ?? ""));
    const planned = ended.filter((s) => s.kind !== "studio");
    return {
      day,
      open: this.openToday(tab),
      openSessions: this.openSessions(),
      ended,
      doneForToday: planned.length > 0 || this.onboardedOn(day),
      summarySessionId: planned.at(-1)?.id ?? null,
    };
  }

  /**
   * Onboarding is the first day's session (ux §8: its Coda says "Done for today"). It runs outside
   * `session.start` (it is U00.L01, completed by `PUT /onboarding { finished: true }`), so the day it finished
   * on counts as done here; its Coda lives in the onboarding flow, so there is no `summarySessionId` for it.
   */
  onboardedOn(day: string): boolean {
    const at = this.ctx.repos.onboarding.get().finishedAt;
    return at !== null && this.time.day(new Date(at)) === day;
  }

  /** The session kind a map item is worked in (d7): a lesson, a checkpoint, a gym slot, a capstone session. */
  kindOf(mapItemId: string): Session["kind"] | null {
    if (/^GYM\.\d{2}$/.test(mapItemId)) return "gym";
    if (this.ctx.content.lessonSite(mapItemId) !== null) return "lesson";
    if (this.ctx.content.checkpointMeta(mapItemId) !== null) return "checkpoint";
    const m = /^(.+)\.S\d+$/.exec(mapItemId);
    if (m !== null && this.ctx.content.capstoneMeta(m[1] as string) !== null) return "capstone";
    return null;
  }

  start(
    body: {
      kind: Session["kind"];
      mapItemId: Session["mapItemId"];
      targetMinutes: Session["targetMinutes"];
      /** d21: the browser tab's own id; absent: the anonymous tab. */
      tabId?: string | undefined;
    },
    /** What the planner had for today when the session started (session telemetry, contracts §9.7). */
    plan: SessionStartRecord | null = null,
  ): Session {
    // d7: a kind that does not fit its map item is refused, naming the kind the item needs (a lesson started as a
    // gym session ran the wrong screen and recorded the wrong telemetry).
    if (body.mapItemId !== null) {
      const needs = this.kindOf(body.mapItemId);
      if (needs !== null && needs !== body.kind)
        throw badRequest(
          `${body.mapItemId} is a ${needs} session: start it with kind "${needs}", not "${body.kind}"`,
        );
    }
    const tab = body.tabId ?? null;
    return tx(this.ctx.repos.db, () => {
      // One open session per TAB and learner day (d21, reversing decision 28): the same tab's second start (a
      // reload, a retry, a double click) gets its open session back, whatever it names; another tab or browser
      // starts a session of its own. A session ended today does not block a new one.
      const open = this.openToday(tab);
      if (open !== null) return open;
      const id = body.mapItemId;
      if (id !== null && !this.d.gates.sessionOpen(id) && !this.d.gates.sessionDone(id))
        throw conflict(`${id} is not open yet`);
      const session: Session = {
        id: newId("ses"),
        day: this.time.day(),
        kind: body.kind,
        targetMinutes: body.targetMinutes,
        mapItemId: id,
        contentVersion: this.ctx.content.contentVersion,
        startedAt: this.time.iso(),
        endedAt: null,
        activeMinutes: 0,
        phase: "idle",
        tabId: tab,
      };
      this.ctx.repos.sessions.create(session, plan);
      // Wave 7 (wave7.md §5.2): after the core, the track the learner picks (an offer) is recorded as the focus.
      const track = id === null ? null : trackOf(id);
      if (track !== null && this.d.trackPlan !== undefined && this.d.tracks?.coreStage() === "complete")
        this.d.trackPlan.setFocus(track);
      if (id !== null) {
        this.d.unlocks.onStart(id);
        // A checkpoint started from the map was offered too (decision 29: it holds the ladder until passed).
        this.d.voice.recordOffer(id, session.day);
        const m = /^(.+)\.S\d+$/.exec(id);
        const capstone = m === null ? null : this.ctx.content.capstoneMeta(m[1] as string);
        if (capstone !== null) {
          const row = this.ctx.repos.capstones.get(capstone.id);
          const now = session.startedAt;
          this.ctx.repos.capstones.save({
            capstoneId: capstone.id,
            status: row?.status === "released" ? "released" : "in_progress",
            sessions: row?.sessions ?? [],
            sketchId: row?.sketchId ?? null,
            trackId: row?.trackId ?? null,
            flavour: row?.flavour ?? null,
            lastResult: row?.lastResult ?? null,
            startedAt: row?.startedAt ?? now,
            releasedAt: row?.releasedAt ?? null,
            updatedAt: now,
          });
          this.d.capstoneSessions?.onSessionStart(id, session.id);
        }
      }
      return session;
    });
  }

  heartbeat(id: string, body: { phase: Session["phase"]; activeMs: number; stepId: string | null }): void {
    const s = this.get(id);
    if (s.endedAt !== null) throw conflict("this session has ended");
    this.ctx.repos.sessions.heartbeat(id, body.phase, body.activeMs / 60_000);
  }

  end(
    id: string,
    body: { wrappedEarly: boolean; phaseMs: { warmup: number; main: number; make: number; coda: number } },
    measured: { dueSecAfter: number; deferredCards: number } | null = null,
    /** Dev seeds: leave `next` out (the seeder fills it for the last session it ends, `refreshNext`). */
    opts: { skipNext?: boolean } = {},
  ): SessionSummary {
    const s = this.get(id);
    if (s.endedAt !== null) {
      const stored = this.ctx.repos.sessions.summary(id) as SessionSummary | null;
      if (stored !== null) return stored;
    }
    return tx(this.ctx.repos.db, () => {
      const now = this.time.iso();
      const totalMs = body.phaseMs.warmup + body.phaseMs.main + body.phaseMs.make + body.phaseMs.coda;
      const minutes = Math.max(s.activeMinutes, totalMs / 60_000);
      // Keep-alive qualifies the day at the 2-minute mark or when its set ended (contracts §7.8 c).
      const drills = this.ctx.repos.db
        .query(
          "SELECT COUNT(*) AS n, SUM(trials_total) AS trials FROM drill_sessions WHERE session_id = ? AND finished_at IS NOT NULL",
        )
        .get(id) as { n: number; trials: number | null };
      if (s.kind === "keepalive" && (minutes * 60 >= STREAK.keepAliveSec || drills.n > 0))
        this.d.streak.qualify("keepalive", { day: s.day });
      this.d.streak.addMinutes(minutes, s.day);
      const ended: Session = { ...s, endedAt: now, phase: "done", activeMinutes: minutes };

      const telemetry: SessionTelemetry = {
        sessionId: id,
        day: s.day,
        targetMinutes: s.targetMinutes,
        kind: s.kind,
        warmupMs: body.phaseMs.warmup,
        newMs: body.phaseMs.main,
        makeMs: body.phaseMs.make,
        codaMs: body.phaseMs.coda,
        totalActiveMs: totalMs,
        warmupSets: drills.n,
        warmupPlannedSec: 0,
        dueSecBefore: 0,
        dueSecAfter: measured?.dueSecAfter ?? 0,
        deferredCards: measured?.deferredCards ?? 0,
        overflowSec: 0,
        wrappedEarly: body.wrappedEarly,
        split: this.ctx.repos.lessons.progress(s.mapItemId ?? "")?.splitPart === "A",
      };
      const plan = this.ctx.repos.db.query("SELECT plan_json FROM sessions WHERE id = ?").get(id) as {
        plan_json: string | null;
      };
      if (plan?.plan_json) {
        try {
          const p = JSON.parse(plan.plan_json) as Partial<SessionStartRecord> & {
            warmup?: { plannedSec?: number };
          };
          telemetry.warmupPlannedSec = p.warmupPlannedSec ?? p.warmup?.plannedSec ?? 0;
          telemetry.dueSecBefore = p.dueSec ?? 0;
          // Warm-up overflow (§7.4, §9.7): due review left beyond what the warm-up planned. Invisible to the learner.
          telemetry.overflowSec = Math.max(0, telemetry.dueSecBefore - telemetry.warmupPlannedSec);
        } catch {
          /* a plan that does not parse is left out */
        }
      }
      this.ctx.repos.ops.saveSessionTelemetry(telemetry);

      // Claude's listening notes are gone (owner, 2026-11-22: "useless"): the Coda never offers or asks for one.
      const listening: SessionSummary["listeningNote"] = "off";
      const next = this.d.gates.nextMapItem();
      const teaser =
        this.ctx.repos.settings.get("teaserOptIn") && next !== null
          ? { mapItemId: next, title: this.#title(next) }
          : null;
      // The sing-tolerance ladder moves only between sessions and is announced once, here (contracts §8.2).
      this.d.voice.evaluate();
      const toleranceChange = this.d.voice.announce();
      // Wave 6: a track gate met in this session is announced here, once (wave6.md §5.3), and the session whose
      // end finds the core complete carries the moment, once (§5.5); every other summary has `coreComplete: null`.
      const gatesOpened = this.d.tracks?.announceGates(id) ?? [];
      const base: SessionSummary = {
        session: ended,
        streak: this.d.streak.summary(),
        sketchesSaved: this.ctx.repos.sketches.savedSince(s.startedAt),
        canDo: this.ctx.repos.cando.since(s.startedAt),
        unlocks: this.ctx.repos.unlocks.since(s.startedAt),
        toleranceChange,
        listeningNote: listening,
        teaser,
        ...(s.kind === "gym" && this.d.gymSummary !== undefined ? { gym: this.d.gymSummary(id) } : {}),
        ...(gatesOpened.length > 0 ? { gatesOpened } : {}),
      };
      // The session is ended first, so the moments' stats count it (`ended_at` set): the session that completes the
      // core or the course reads "259 sessions on 259 days", not one short (wave 7 closer; sessions-moment test).
      this.ctx.repos.sessions.end(id, now, minutes, base);
      const coreComplete = this.d.tracks?.announceCore(id) ?? null;
      // Wave 7: the whole course's moment (once), and the planner's real next session (carry f6).
      const courseComplete = this.d.tracks?.announceWhole(id) ?? null;
      const summary: SessionSummary = {
        ...base,
        ...(this.d.tracks === undefined ? {} : { coreComplete, courseComplete }),
      };
      this.ctx.repos.sessions.end(id, now, minutes, summary);
      // The planner reads this session as ended (a reviews-only day counts towards the gym slot, d19).
      const coming = opts.skipNext === true ? undefined : this.d.nextSession?.();
      if (coming === undefined) return summary;
      const withNext: SessionSummary = { ...summary, next: coming };
      this.ctx.repos.sessions.end(id, now, minutes, withNext);
      return withNext;
    });
  }

  /**
   * Wave 7 (dev seeds): recomputes an ended session's `next` from the learner as they stand now (a seed that sets
   * the focus after its last session). The rest of the summary is kept.
   */
  refreshNext(id: string): void {
    const s = this.get(id);
    const stored = this.ctx.repos.sessions.summary(id) as SessionSummary | null;
    const coming = this.d.nextSession?.();
    if (s.endedAt === null || stored === null || coming === undefined) return;
    this.ctx.repos.sessions.end(id, s.endedAt, s.activeMinutes, { ...stored, next: coming });
  }

  /** The Coda after a reload (wave2 §4 `session.summary`): the summary `end` stored. */
  summary(id: string): SessionSummary {
    const s = this.get(id);
    if (s.endedAt === null) throw conflict("this session has not ended yet");
    const stored = this.ctx.repos.sessions.summary(id) as SessionSummary | null;
    if (stored === null) throw notFound(`summary of session ${id}`);
    return stored;
  }

  #title(id: string): string {
    return (
      this.ctx.content.lessonDef(id)?.title ??
      this.ctx.content.lessonSite(id)?.meta.title ??
      this.ctx.content.checkpointMeta(id)?.title ??
      this.ctx.content.capstoneMeta(id.replace(/\.S\d+$/, ""))?.title ??
      id
    );
  }
}
