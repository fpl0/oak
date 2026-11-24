// Local timing telemetry (contracts §9.7; shown on Progress › Your sessions, never sent anywhere else).
//
//  - `ActivityClock`: the one way to measure active time. Time counts while the tab is visible and the learner
//    did something in the last 60 s; a longer idle gap counts as 60 s at most.
//  - `logStep(row)`: one `step_telemetry` row per step left (passed, skipped or wrapped). Rows are batched and
//    posted with `telemetry.steps` (at most 200 per call), on a timer, when the tab is hidden, and on `flush()`.
//  - `logBlock(beat)`: the session's per-phase active time, sent as `session.heartbeat` (throttled to one call
//    per 30 s per session, and at once when the phase or the step changes). The server derives
//    `session_telemetry` from the heartbeats and `session.end`.
import type { EndpointInput, StepTelemetry } from "@oak/api";
import { callApi } from "./api.ts";

export const IDLE_MS = 60_000;
export const HEARTBEAT_MS = 30_000;
export const FLUSH_MS = 15_000;
export const MAX_BATCH = 200;

type Heartbeat = EndpointInput<"session.heartbeat">["body"];

/** Active time with idle gaps cut at `idleMs` (pure; the clock is injected). */
export class ActivityClock {
  #last: number | null = null;
  #acc = 0;
  #visible = true;
  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly idleMs = IDLE_MS,
  ) {}

  /** The learner did something (key, pointer, audio playing). */
  activity(): void {
    const t = this.now();
    if (this.#visible && this.#last !== null) this.#acc += Math.min(t - this.#last, this.idleMs);
    this.#last = t;
  }

  /** Tab shown or hidden: hidden time is never active. */
  setVisible(visible: boolean): void {
    if (visible === this.#visible) return;
    if (!visible) this.activity();
    this.#visible = visible;
    this.#last = visible ? this.now() : null;
  }

  /** Active ms so far, counting up to now (as if the learner acted now, within the idle cut). */
  peek(): number {
    if (!this.#visible || this.#last === null) return this.#acc;
    return this.#acc + Math.min(this.now() - this.#last, this.idleMs);
  }

  /** Active ms since the last `take()`, and restart the count. */
  take(): number {
    const ms = this.peek();
    this.#acc = 0;
    this.#last = this.#visible ? this.now() : null;
    return ms;
  }
}

export interface TelemetryDeps {
  sendSteps(steps: StepTelemetry[]): Promise<unknown>;
  sendHeartbeat(sessionId: string, beat: Heartbeat): Promise<unknown>;
  now(): number;
}

export interface Telemetry {
  logStep(row: StepTelemetry): void;
  logBlock(beat: { sessionId: string } & Heartbeat): void;
  /** Sends what is queued now (call when a session ends). */
  flush(): Promise<void>;
  /** Rows waiting to be sent (tests, /dev). */
  pending(): number;
}

export function createTelemetry(deps: TelemetryDeps): Telemetry {
  let queue: StepTelemetry[] = [];
  let sending: Promise<void> = Promise.resolve();
  const lastBeat = new Map<string, { at: number; phase: string; stepId: string | null }>();

  const flush = (): Promise<void> => {
    sending = sending.then(async () => {
      while (queue.length > 0) {
        const batch = queue.slice(0, MAX_BATCH);
        try {
          await deps.sendSteps(batch);
          queue = queue.slice(batch.length);
        } catch {
          // Keep the rows for the next flush; telemetry never interrupts the learner.
          return;
        }
      }
    });
    return sending;
  };

  return {
    logStep(row) {
      queue.push(row);
      if (queue.length >= MAX_BATCH) void flush();
    },
    logBlock({ sessionId, ...beat }) {
      const prev = lastBeat.get(sessionId);
      const t = deps.now();
      const changed = prev === undefined || prev.phase !== beat.phase || prev.stepId !== beat.stepId;
      if (!changed && t - prev.at < HEARTBEAT_MS) return;
      lastBeat.set(sessionId, { at: t, phase: beat.phase, stepId: beat.stepId });
      deps.sendHeartbeat(sessionId, beat).catch(() => {});
    },
    flush,
    pending: () => queue.length,
  };
}

/** The app's telemetry client over the API (one per page). */
export const telemetry: Telemetry = createTelemetry({
  sendSteps: (steps) => callApi("telemetry.steps", { body: { steps } }),
  sendHeartbeat: (id, body) => callApi("session.heartbeat", { params: { id }, body }),
  now: () => Date.now(),
});

export const logStep = (row: StepTelemetry) => telemetry.logStep(row);
export const logBlock = (beat: { sessionId: string } & Heartbeat) => telemetry.logBlock(beat);

if (typeof window !== "undefined" && typeof document !== "undefined") {
  setInterval(() => void telemetry.flush(), FLUSH_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void telemetry.flush();
  });
}
