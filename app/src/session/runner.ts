// The session runner: the one live session in this tab. It starts the session on the server, binds the store
// (store.ts) to the machine (machine.ts), measures active time (ActivityClock: keys, pointer, audio playing;
// a hidden tab and idle gaps over 60 s are not counted, contracts §9.7), sends heartbeats (logBlock), saves the
// state for a reload (persist.ts) and navigates when the block changes: /session for every block, /session/coda
// for the Coda. It outlives route changes (module scope), so a block played on its own route — the lesson on
// /learn when the player is not mountable — still advances the session when it reports.
import type { Session, SessionPlan, SessionSummary, SkillMap } from "@oak/api";
import { type Actor, createActor, fromPromise } from "xstate";
import { create } from "zustand";
import { ActivityClock } from "../lib/telemetry.ts";
import { type EndInput, isPausedValue, type RunnerStatus, sessionMachine, statusOf } from "./machine.ts";
import {
  type Baseline,
  clearActive,
  EMPTY_BASELINE,
  type EndedRecord,
  type KeyValue,
  loadActive,
  saveActive,
  saveEnded,
} from "./persist.ts";
import { phaseOf, restoreSession, sessionEndBody, useSession } from "./store.ts";
import type { SessionBlock } from "./types.ts";

export type SessionPath = "/session" | "/session/coda" | "/";

export interface RunnerDeps {
  startSession(body: {
    kind: Session["kind"];
    mapItemId: Session["mapItemId"];
    targetMinutes: Session["targetMinutes"];
  }): Promise<Session>;
  endSession(input: EndInput): Promise<SessionSummary>;
  /** Snapshot for the Coda's "what moved": map levels and can-do statuses before the session. */
  baseline(): Promise<Baseline>;
  heartbeat(beat: {
    sessionId: string;
    phase: Session["phase"];
    activeMs: number;
    stepId: string | null;
  }): void;
  /** The lesson step on screen, for heartbeats. */
  stepId(): string | null;
  /** True while audio plays (counts as activity). */
  playing(): boolean;
  /** Where the learner is (the clock counts only on session surfaces). */
  path(): string;
  storage: KeyValue | null;
  now(): number;
  /** Event source for activity and visibility (window/document in the app; a stub in tests). */
  listen?(onActivity: () => void, onVisible: (visible: boolean) => void): () => void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface RunnerView {
  status: RunnerStatus;
  paused: boolean;
  starting: boolean;
  startError: string | null;
  summary: SessionSummary | null;
  endError: string | null;
  baseline: Baseline;
  /** The 30-second recap after a break has been shown (contracts §7.9). */
  recapDone: boolean;
  /** The session that just ended (for the Coda after the store was reset). */
  ended: EndedRecord | null;
}

export const INITIAL_VIEW: RunnerView = {
  status: "idle",
  paused: false,
  starting: false,
  startError: null,
  summary: null,
  endError: null,
  baseline: EMPTY_BASELINE,
  recapDone: false,
  ended: null,
};

/**
 * Routes on which session time counts: the host, the Coda, the routes a block may be played on, and the unit song's
 * page (`/song/…`, opened from the lesson card or the Coda mid-session).
 */
export function isSessionSurface(path: string): boolean {
  return (
    path === "/session" ||
    path === "/session/" ||
    path === "/session/coda" ||
    /^\/(learn|checkpoint|capstone|transcribe|practice|studio|song)(\/|$)/.test(path)
  );
}

export type SessionRunner = ReturnType<typeof createRunner>;

export function createRunner(deps: RunnerDeps) {
  const view = create<RunnerView>(() => INITIAL_VIEW);
  let navigate: ((to: SessionPath) => void) | null = null;
  let actor: Actor<typeof sessionMachine> | null = null;
  let unsubStore: (() => void) | null = null;
  let unlisten: (() => void) | null = null;
  let timer: unknown = null;
  let clock = new ActivityClock(deps.now);
  let lastSaved = 0;

  const go = (to: SessionPath) => navigate?.(to);

  const persist = (force = false) => {
    const s = useSession.getState();
    if (s.session === null || s.plan === null) return;
    const t = deps.now();
    if (!force && t - lastSaved < 2_000) return;
    lastSaved = t;
    const { baseline, recapDone } = view.getState();
    saveActive(deps.storage, {
      v: 1,
      state: {
        plan: s.plan,
        session: s.session,
        block: s.block,
        warmupIndex: s.warmupIndex,
        reports: s.reports,
        activeMs: s.activeMs,
        phaseMs: s.phaseMs,
        wrap: s.wrap,
        wrappedEarly: s.wrappedEarly,
        paused: false,
      },
      baseline,
      recapDone,
    });
  };

  const beat = () => {
    const s = useSession.getState();
    // The Coda ends the session on the server (session.end carries the final times): no heartbeat after that.
    if (s.session === null || s.block === null || s.block === "coda") return;
    deps.heartbeat({
      sessionId: s.session.id,
      phase: s.block === null ? "done" : phaseOf(s.block),
      activeMs: Math.round(s.activeMs),
      stepId: deps.stepId(),
    });
  };

  const tick = () => {
    if (deps.playing()) clock.activity();
    const ms = clock.take();
    if (!isSessionSurface(deps.path())) return;
    useSession.getState().tick(ms);
    beat();
    persist();
  };

  const stopLoop = () => {
    if (timer !== null) deps.clearInterval(timer);
    timer = null;
    unlisten?.();
    unlisten = null;
  };

  const teardown = () => {
    stopLoop();
    unsubStore?.();
    unsubStore = null;
    actor?.stop();
    actor = null;
  };

  const syncView = () => {
    if (!actor) return;
    const snap = actor.getSnapshot();
    const status = statusOf(snap.value);
    view.setState({
      status,
      paused: isPausedValue(snap.value),
      summary: snap.context.summary,
      endError: snap.context.endError,
    });
  };

  const onEnded = (summary: SessionSummary) => {
    const s = useSession.getState();
    if (!s.session) return;
    const rec: EndedRecord = {
      v: 1,
      sessionId: s.session.id,
      day: s.session.day,
      summary,
      reports: s.reports,
      wrappedEarly: s.wrappedEarly,
      baseline: view.getState().baseline,
      mapItemId: s.plan?.mapItemId ?? null,
      title: s.plan?.title ?? "",
    };
    saveEnded(deps.storage, rec);
    clearActive(deps.storage);
    view.setState({ ended: rec });
  };

  const launch = (summary: SessionSummary | null = null) => {
    teardown();
    clock = new ActivityClock(deps.now);
    const machine = sessionMachine.provide({
      actors: {
        endSession: fromPromise<SessionSummary, EndInput>(({ input }) => deps.endSession(input)),
      },
      actions: {
        onBlock: (_, params) => {
          beat();
          persist(true);
          // A lesson or checkpoint played on its own route does its Make there too: stay.
          const last = useSession.getState().reports.at(-1);
          const staysOnRoute =
            params.block === "make" &&
            /^\/(learn|checkpoint)\//.test(deps.path()) &&
            last?.block === "new" &&
            last.completed;
          if (!staysOnRoute) go(params.block === "coda" ? "/session/coda" : "/session");
        },
        onDone: () => {
          clearActive(deps.storage);
        },
      },
    });
    actor = createActor(machine, { input: { summary } });
    let codaSaved = false;
    actor.subscribe((snap) => {
      syncView();
      if (!codaSaved && statusOf(snap.value) === "coda" && snap.context.summary) {
        codaSaved = true;
        onEnded(snap.context.summary);
      }
      if (snap.status === "done") stopLoop();
    });
    actor.start();
    const s = useSession.getState();
    if (s.plan && s.session && s.block)
      actor.send({ type: "BEGIN", plan: s.plan, session: s.session, block: s.block });
    let prev: SessionBlock | null = s.block;
    unsubStore = useSession.subscribe((next) => {
      if (next.block !== prev) {
        prev = next.block;
        actor?.send({ type: "SYNC", block: next.block, endBody: sessionEndBody(next) });
      }
    });
    unlisten =
      deps.listen?.(
        () => clock.activity(),
        (v) => clock.setVisible(v),
      ) ?? null;
    clock.activity();
    timer = deps.setInterval(tick, 1_000);
  };

  const baselineSafely = async (): Promise<Baseline> => {
    try {
      return await deps.baseline();
    } catch {
      return EMPTY_BASELINE;
    }
  };

  return {
    view,
    setNavigator(fn: ((to: SessionPath) => void) | null) {
      navigate = fn;
    },
    /** "Start session" on Today. Resolves once the session is running (or throws with the server's message). */
    async start(plan: SessionPlan): Promise<void> {
      if (view.getState().starting) return;
      view.setState({ ...INITIAL_VIEW, starting: true });
      try {
        const [session, baseline] = await Promise.all([
          deps.startSession({
            kind: plan.kind,
            mapItemId: plan.mapItemId,
            targetMinutes: plan.targetMinutes,
          }),
          baselineSafely(),
        ]);
        // One open session per learner day (wave3.md §5.1): when another tab already opened today's session the
        // server answers with that one. Join it: at the block this browser saved for it, else from the top of
        // the plan with the open session's own kind and item.
        const saved = loadActive(deps.storage, session.id);
        if (saved) {
          view.setState({ baseline: saved.baseline, starting: false, recapDone: saved.recapDone });
          restoreSession(saved.state);
          launch();
          return;
        }
        view.setState({ baseline, starting: false, recapDone: plan.returning?.recap == null });
        useSession.getState().begin(joinedPlan(plan, session), session);
        launch();
      } catch (e) {
        view.setState({ starting: false, startError: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    },
    /**
     * Resume a session left open today (after a reload or a visit elsewhere). Restores the saved block when this
     * browser has it; otherwise starts the open session from the top of today's plan.
     */
    async resume(open: Session, plan: SessionPlan): Promise<void> {
      const cur = useSession.getState();
      if (actor && cur.session?.id === open.id) {
        if (view.getState().paused) this.resumeClock();
        go(cur.block === "coda" ? "/session/coda" : "/session");
        return;
      }
      const saved = loadActive(deps.storage, open.id);
      if (saved) {
        view.setState({ ...INITIAL_VIEW, baseline: saved.baseline, recapDone: saved.recapDone });
        restoreSession(saved.state);
      } else {
        view.setState({
          ...INITIAL_VIEW,
          baseline: await baselineSafely(),
          recapDone: plan.returning?.recap == null,
        });
        useSession.getState().begin(joinedPlan(plan, open), open);
      }
      launch();
    },
    pause() {
      useSession.getState().pause();
      actor?.send({ type: "PAUSE" });
      persist(true);
    },
    resumeClock() {
      clock.activity();
      useSession.getState().resume();
      actor?.send({ type: "RESUME" });
    },
    wrapUp() {
      useSession.getState().wrapUp();
    },
    keepGoing() {
      useSession.getState().keepGoing();
    },
    /** Go straight to the Coda (a Keep-alive after its 2 minutes, "Skip the riff"). */
    toCoda() {
      useSession.getState().enter("coda");
    },
    recapShown() {
      view.setState({ recapDone: true });
      persist(true);
    },
    retryEnd() {
      actor?.send({ type: "RETRY_END" });
    },
    /** "Done for today": the store's coda report, the machine's FINISH, and back to Today (or `to`, or stay). */
    finish(to: SessionPath | null = "/") {
      const s = useSession.getState();
      if (s.block === "coda") s.reportBlockDone({ block: "coda", source: "coda" });
      actor?.send({ type: "FINISH" });
      teardown();
      useSession.getState().reset();
      view.setState({ status: "done" });
      if (to) go(to);
    },
    /** Whether a session is live in this tab. */
    active(): boolean {
      return actor !== null && useSession.getState().session !== null;
    },
    /** Tests: stop everything and forget. */
    dispose() {
      teardown();
      useSession.getState().reset();
      view.setState(INITIAL_VIEW);
    },
  };
}

/**
 * The plan a joined session runs: today's plan when it is the same session kind and item, else the plan
 * re-labelled with the open session's kind and item (a Keep-alive tab joining a lesson session runs the
 * lesson; a lesson tab joining a Keep-alive runs the Keep-alive's one set).
 */
export function joinedPlan(plan: SessionPlan, open: Pick<Session, "kind" | "mapItemId">): SessionPlan {
  if (plan.kind === open.kind && plan.mapItemId === open.mapItemId) return plan;
  if (open.kind === "keepalive") {
    const first = plan.warmup.items[0];
    return {
      ...plan,
      kind: "keepalive",
      mapItemId: null,
      title: "Keep-alive",
      main: null,
      returning: null,
      warmup: {
        ...plan.warmup,
        items: first ? [first] : [],
        plannedSec: first?.estSec ?? 0,
        moreAvailable: false,
      },
    };
  }
  return { ...plan, kind: open.kind, mapItemId: open.mapItemId };
}

/** The skill-map levels and can-do statuses now, from the server (the Coda's baseline). */
export function baselineOf(
  map: SkillMap | null,
  canDo: { candoId: string; status: string; at: string }[],
): Baseline {
  const latest = new Map<string, { status: string; at: string }>();
  for (const e of canDo) {
    const cur = latest.get(e.candoId);
    if (!cur || cur.at <= e.at) latest.set(e.candoId, e);
  }
  return {
    levels: (map?.nodes ?? []).map((n) => [n.skillId, n.level]),
    canDo: [...latest].map(([id, e]) => [id, e.status as Baseline["canDo"][number][1]]),
  };
}
