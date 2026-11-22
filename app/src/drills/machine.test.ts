import { describe, expect, test } from "bun:test";
import type { DrillFinish, DrillSession, DrillTrialRecord, FamilyDef, Trial } from "@oak/api";
import { createRegistry, DEFAULT_PROFILE, gradeTrial, type TrialResponse } from "@oak/drills";
import { createActor, fromCallback, fromPromise, waitFor } from "xstate";
import { families } from "../../../content/families.ts";
import { resumeFromServer } from "./inflight.ts";
import {
  type DrillDeps,
  type DrillInput,
  drillMachine,
  type ResumeState,
  shownOutcome,
  type TrialSource,
} from "./machine.ts";
import { answerOf, expectedValueOf, planDrillSet, surfaceOf } from "./model.ts";

const registry = createRegistry(families, []);
const def = (id: string) => families.find((f) => f.id === id) as FamilyDef;

function session(familyId: string, trials: number, level = 1): DrillSession {
  const d = def(familyId);
  return {
    id: `drl_${familyId}`,
    sessionId: null,
    purpose: "srs",
    familyIds: [familyId as DrillSession["familyIds"][number]],
    setId: `set_${familyId}`,
    levels: { [familyId]: level },
    openCategories: { [familyId]: d.levels[level - 1]?.categories ?? [] },
    focus: {},
    trialsPlanned: trials,
    startedAt: "2026-11-11T10:00:00.000Z",
    finishedAt: null,
  };
}

function sourceFor(s: DrillSession): TrialSource {
  const familyId = s.familyIds[0] as string;
  const { trials } = planDrillSet(registry.family(familyId as never), s, null, DEFAULT_PROFILE);
  return { total: trials.length, at: (i) => trials[i] as (typeof trials)[number] };
}

let clock = 1_000;
/** The credit the fake resolution grader gives (a practice take of the way home can be graded differently). */
let resolutionCredit = 0.75;
const deps: DrillDeps = {
  grade: (trial, response: TrialResponse) =>
    gradeTrial(registry.family(trial.family), trial, response, DEFAULT_PROFILE),
  gradeResolution: () => ({
    credit: resolutionCredit,
    passed: resolutionCredit >= 0.8,
    sung: [{ midi: 64, cents: resolutionCredit >= 0.8 ? 4 : 40, credit: resolutionCredit }],
  }),
  sungOf: () => [{ midi: 61, cents: 30, credit: 1 }],
  now: () => clock,
  iso: () => "2026-11-11T10:01:00.000Z",
};

interface Spy {
  persisted: number[];
  /** What the runtime would save for a reload, as the last persist left it (runtime.ts `persist`). */
  saved: Omit<ResumeState, "session"> | null;
  sent: number[];
  /** Every record sent, in order (the runner re-sends a trial's record after a practice take). */
  sentRecords: DrillTrialRecord[];
  finished: number[] | null;
  done: number;
}

function run(
  s: DrillSession,
  opts: { resume?: ResumeState | null; source?: TrialSource; failStart?: number; quiet?: boolean } = {},
) {
  const spy: Spy = { persisted: [], saved: null, sent: [], sentRecords: [], finished: null, done: 0 };
  let starts = 0;
  const machine = drillMachine.provide({
    actors: {
      start: fromPromise(async () => {
        starts++;
        if (opts.failStart && starts <= opts.failStart) throw new Error("server is offline");
        return { session: s, source: opts.source ?? sourceFor(s) };
      }),
      present: fromCallback(() => () => {}),
      audition: fromCallback(({ sendBack }) => {
        sendBack({ type: "AUDITION_DONE" });
        return () => {};
      }),
      resolve: fromCallback(() => () => {}),
      finish: fromPromise(async ({ input }) => {
        spy.finished = input.records.map((r) => r.idx);
        return {
          session: { ...s, finishedAt: "2026-11-11T10:02:00.000Z" },
          meanCredit: 1,
          medianRtMs: 800,
          reviews: [],
          evidence: [],
          streak: {} as DrillFinish["streak"],
        } as DrillFinish;
      }),
    },
    actions: {
      persist: (_, p) => {
        spy.persisted.push(p.ctx.index);
        spy.saved = {
          outcomes: p.ctx.outcomes.slice(0, p.ctx.index),
          records: p.ctx.records.slice(0, p.ctx.index),
        };
      },
      send: (_, p) => {
        spy.sent.push(p.record.idx);
        spy.sentRecords.push(p.record);
      },
      done: () => {
        spy.done++;
      },
    },
  });
  const input: DrillInput = {
    purpose: "srs",
    familyIds: s.familyIds,
    warmupItemId: null,
    sessionId: null,
    quiet: opts.quiet ?? false,
    tolCents: 50,
    resume: opts.resume ?? null,
    deps,
  };
  const actor = createActor(machine, { input });
  actor.start();
  return { actor, spy };
}

/** Answers the current choice trial with the expected answer (or a wrong one). */
function answer(actor: ReturnType<typeof run>["actor"], right: boolean) {
  const ctx = actor.getSnapshot().context;
  const trial = ctx.current?.trial as Trial;
  const surface = surfaceOf(trial, def(trial.family));
  if (surface.kind !== "widget") throw new Error("not a widget trial");
  const expected = expectedValueOf(surface.spec, trial.expected) as string[];
  const value = right
    ? expected
    : [
        ((surface.spec as { options: { id: string }[] }).options.find((o) => o.id !== expected[0])?.id ??
          "x") as string,
      ];
  actor.send({ type: "SUBMIT", answer: answerOf(surface.spec, value) });
}

/** Answers the current FET trial with its degree (or a wrong one). */
function answerDegree(actor: ReturnType<typeof run>["actor"], right: boolean) {
  const trial = actor.getSnapshot().context.current?.trial as Trial;
  const want = (trial.expected as { degrees: string[] }).degrees;
  const got = right ? want : [want[0] === "1" ? "5" : "1"];
  actor.send({ type: "SUBMIT", answer: { degrees: got as never } });
}

describe("drill machine", () => {
  test("plays a set of real pitch-compare trials to the summary and records each one", async () => {
    const s = session("fam.pit.compare", 4);
    const { actor, spy } = run(s);
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    for (let i = 0; i < 4; i++) {
      expect(actor.getSnapshot().context.index).toBe(i);
      actor.send({ type: "PRESENTED" });
      expect(actor.getSnapshot().matches({ trial: "answering" })).toBe(true);
      clock += 900;
      answer(actor, i !== 2);
      const snap = actor.getSnapshot();
      expect(snap.matches("feedback")).toBe(true);
      expect(snap.context.outcomes[i]?.result.correct).toBe(i !== 2);
      expect(snap.context.records[i]?.rtMs).toBe(900);
      if (i === 2) expect(snap.context.records[i]?.confusion).not.toBeNull();
      actor.send({ type: "NEXT" });
    }
    await waitFor(actor, (st) => st.matches("summary"));
    expect(spy.finished).toEqual([0, 1, 2, 3]);
    expect(spy.sent).toEqual([0, 1, 2, 3]);
    expect(spy.done).toBe(1);
    // Persisted at each trial start and after each answer, always pointing at the next trial to run.
    expect(spy.persisted).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });

  test("an answer given while the stimulus still plays is accepted with a zero response time", async () => {
    const { actor } = run(session("fam.pit.compare", 2));
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    answer(actor, true);
    expect(actor.getSnapshot().context.records[0]?.rtMs).toBe(0);
  });

  test("replays are counted per trial; Show me reveals with no credit; the cue replays the cadence", async () => {
    const { actor } = run(session("fam.pit.compare", 2));
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "REPLAY" });
    expect(actor.getSnapshot().matches({ trial: "presenting" })).toBe(true);
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "REPLAY" });
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "CUE" });
    expect(actor.getSnapshot().matches({ trial: "cueing" })).toBe(true);
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "REVEAL" });
    const ctx = actor.getSnapshot().context;
    expect(ctx.outcomes[0]?.revealed).toBe(true);
    expect(ctx.records[0]).toMatchObject({ credit: 0, correct: false, replays: 2 });
    expect(ctx.records[0]?.response.skipped).toBe(false);
    // Feedback auditions come back to idle.
    actor.send({ type: "AUDITION", what: "answer" });
    expect(actor.getSnapshot().matches({ feedback: "idle" })).toBe(true);
    actor.send({ type: "NEXT" });
    expect(actor.getSnapshot().context.replays).toBe(0);
  });

  test("tap trials are graded from the captured taps (perfect taps pass the pulse)", async () => {
    const s = session("fam.rhy.pulse", 1);
    const { actor } = run(s);
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    // A widget answer is refused for a tap trial.
    actor.send({ type: "SUBMIT", answer: { choice: ["x"] } });
    expect(actor.getSnapshot().matches({ trial: "presenting" })).toBe(true);
    const trial = actor.getSnapshot().context.current?.trial as Trial;
    const taps = trial.params.tapTargets as number[];
    actor.send({ type: "CAPTURED", taps: taps.map((t) => t + 0.01) });
    const ctx = actor.getSnapshot().context;
    expect(ctx.outcomes[0]?.result.correct).toBe(true);
    expect(ctx.records[0]?.response.taps).toHaveLength(taps.length);
    actor.send({ type: "NEXT" });
    await waitFor(actor, (st) => st.matches("summary"));
  });

  test("a sung trial waits for Start: nothing plays and the mic stays closed until the learner presses it", async () => {
    const { actor } = run(session("fam.pit.match", 2));
    await waitFor(actor, (st) => st.matches({ trial: "ready" }));
    await new Promise((r) => setTimeout(r, 30));
    expect(actor.getSnapshot().matches({ trial: "ready" })).toBe(true);
    actor.send({ type: "START" });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    // Skip singing works before Start too.
    const other = run(session("fam.pit.match", 2));
    await waitFor(other.actor, (st) => st.matches({ trial: "ready" }));
    other.actor.send({ type: "SKIP_SUNG" });
    expect(other.actor.getSnapshot().context.records[0]?.response.skipped).toBe(true);
  });

  test("a sung part can be skipped with Shift+S: logged, no evidence, no penalty", async () => {
    const { actor } = run(session("fam.pit.match", 2));
    await waitFor(actor, (st) => st.matches({ trial: "ready" }));
    actor.send({ type: "START" });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "MIC_ERROR", message: "Microphone access was blocked." });
    expect(actor.getSnapshot().context.micError).toContain("blocked");
    actor.send({ type: "SKIP_SUNG" });
    const rec = actor.getSnapshot().context.records[0];
    expect(rec?.response.skipped).toBe(true);
    actor.send({ type: "NEXT" });
    await waitFor(actor, (st) => st.matches({ trial: "ready" }));
    actor.send({ type: "START" });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "CAPTURED", frames: [] });
    expect(actor.getSnapshot().context.outcomes[1]?.sung).toEqual([{ midi: 61, cents: 30, credit: 1 }]);
  });

  test("a sung resolution follows an FET trial that asks for one and never changes its credit", async () => {
    const base = sourceFor(session("fam.pit.compare", 2));
    const source: TrialSource = {
      total: 2,
      at: (i) => {
        const p = base.at(i, []);
        return i === 0
          ? { ...p, trial: { ...p.trial, params: { ...p.trial.params, sungResolution: true } } }
          : p;
      },
    };
    const { actor } = run(session("fam.pit.compare", 2), { source });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "PRESENTED" });
    answer(actor, true);
    actor.send({ type: "NEXT" });
    expect(actor.getSnapshot().matches({ resolution: "running" })).toBe(true);
    actor.send({ type: "CAPTURED", frames: [] });
    const ctx = actor.getSnapshot().context;
    expect(ctx.outcomes[0]?.resolutionCredit).toBe(0.75);
    expect(ctx.outcomes[0]?.result.credit).toBe(1);
    expect(ctx.records[0]?.response.sung).toHaveLength(1);
    actor.send({ type: "NEXT" });
    expect(actor.getSnapshot().context.index).toBe(1);
    // The second trial has no resolution.
    actor.send({ type: "PRESENTED" });
    answer(actor, true);
    actor.send({ type: "NEXT" });
    await waitFor(actor, (st) => st.matches("summary"));
  });

  test("a resumed set starts at its next trial and finishes with every record", async () => {
    const s = session("fam.pit.compare", 3);
    // Play two trials, keep what was persisted, then resume in a fresh actor.
    const first = run(s);
    await waitFor(first.actor, (st) => st.matches({ trial: "presenting" }));
    for (let i = 0; i < 2; i++) {
      first.actor.send({ type: "PRESENTED" });
      answer(first.actor, true);
      first.actor.send({ type: "NEXT" });
    }
    const ctx = first.actor.getSnapshot().context;
    const before = ctx.current?.trial.seed;
    first.actor.stop();
    const resume: ResumeState = {
      session: s,
      outcomes: ctx.outcomes.slice(0, 2),
      records: ctx.records.slice(0, 2),
    };
    const second = run(s, { resume });
    await waitFor(second.actor, (st) => st.matches({ trial: "presenting" }));
    const snap = second.actor.getSnapshot().context;
    expect(snap.index).toBe(2);
    expect(snap.current?.trial.seed).toBe(before);
    expect(snap.trials).toHaveLength(3);
    second.actor.send({ type: "PRESENTED" });
    answer(second.actor, true);
    second.actor.send({ type: "NEXT" });
    await waitFor(second.actor, (st) => st.matches("summary"));
    expect(second.spy.finished).toEqual([0, 1, 2]);
  });

  test("resume reads the server's record: its trials win, unsent answers follow, a finished set is not resumed", async () => {
    const s = session("fam.pit.compare", 4);
    const first = run(s);
    await waitFor(first.actor, (st) => st.matches({ trial: "presenting" }));
    for (let i = 0; i < 3; i++) {
      first.actor.send({ type: "PRESENTED" });
      answer(first.actor, i !== 1);
      first.actor.send({ type: "NEXT" });
    }
    const ctx = first.actor.getSnapshot().context;
    first.actor.stop();
    // This browser lost its copy of trial 3 (an old pointer: 1 trial); the server stored three.
    const local: ResumeState = {
      session: s,
      outcomes: ctx.outcomes.slice(0, 1),
      records: ctx.records.slice(0, 1),
    };
    const server = { session: s, trials: ctx.records.slice(0, 3) };
    const merged = resumeFromServer(local, server);
    expect(merged?.records.map((r) => r.idx)).toEqual([0, 1, 2]);
    expect(merged?.outcomes.map((o) => o.result.correct)).toEqual([true, false, true]);
    expect(merged?.outcomes[1]?.revealed).toBe(false);
    // The server is behind (an upsert failed): this tab's unsent answers follow its record.
    const behind = resumeFromServer(
      { session: s, outcomes: ctx.outcomes.slice(0, 3), records: ctx.records.slice(0, 3) },
      { session: s, trials: ctx.records.slice(0, 1) },
    );
    expect(behind?.records).toHaveLength(3);
    // Offline: this browser's copy stands in; gone (404) or finished: a fresh set.
    expect(resumeFromServer(local, undefined)).toBe(local);
    expect(resumeFromServer(local, null)).toBeNull();
    expect(
      resumeFromServer(local, { session: { ...s, finishedAt: "2026-11-12T10:00:00.000Z" }, trials: [] }),
    ).toBeNull();
    // The merged state resumes the runner at trial 4.
    const second = run(s, { resume: merged });
    await waitFor(second.actor, (st) => st.matches({ trial: "presenting" }));
    expect(second.actor.getSnapshot().context.index).toBe(3);
    second.actor.stop();
  });

  test("a set resumed after its last answer goes straight to finishing", async () => {
    const s = session("fam.pit.compare", 1);
    const first = run(s);
    await waitFor(first.actor, (st) => st.matches({ trial: "presenting" }));
    first.actor.send({ type: "PRESENTED" });
    answer(first.actor, true);
    const ctx = first.actor.getSnapshot().context;
    first.actor.stop();
    const second = run(s, { resume: { session: s, outcomes: ctx.outcomes, records: ctx.records } });
    await waitFor(second.actor, (st) => st.matches("summary"));
    expect(second.spy.finished).toEqual([0]);
  });

  test("a failed start can be retried", async () => {
    const { actor } = run(session("fam.pit.compare", 1), { failStart: 1 });
    await waitFor(actor, (st) => st.matches("failed"));
    expect(actor.getSnapshot().context.error).toBe("server is offline");
    actor.send({ type: "RETRY" });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
  });

  // --- Wave 3: functional ear training --------------------------------------------------------------

  /** Answers the current FET trial on the degree pad, right or with a wrong degree of its set. */
  test("an FET answer is followed by hearing it resolve (right) or yours vs it (wrong)", async () => {
    const s = session("fam.deg.fet-major", 8);
    const { actor } = run(s, {
      // No sung resolutions here: every trial shows the automatic listen-back.
      source: (() => {
        const base = sourceFor(s);
        return {
          total: 2,
          at: (i: number) => {
            const p = base.at(i, []);
            const params = { ...p.trial.params, sungResolution: false };
            return { ...p, trial: { ...p.trial, params } };
          },
        };
      })(),
    });
    const audits: string[] = [];
    actor.subscribe((st) => {
      if (st.context.audition) audits.push(st.context.audition);
    });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "PRESENTED" });
    answerDegree(actor, true);
    expect(audits.at(-1)).toBe("resolve");
    expect(actor.getSnapshot().matches({ feedback: "idle" })).toBe(true);
    actor.send({ type: "NEXT" });
    actor.send({ type: "PRESENTED" });
    answerDegree(actor, false);
    expect(audits.at(-1)).toBe("compare");
    const rec = actor.getSnapshot().context.records[1];
    expect(rec).toMatchObject({ revealed: false, modality: "normal", sungResolution: null });
  });

  test("a trial that sings its resolution next is not given the path first; the sung take is recorded", async () => {
    const s = session("fam.deg.fet-major", 8);
    const { actor } = run(s);
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    let sungSeen = 0;
    for (let i = 0; i < 8; i++) {
      const trial = actor.getSnapshot().context.current?.trial as Trial;
      actor.send({ type: "PRESENTED" });
      answerDegree(actor, true);
      if (trial.params.sungResolution === true) {
        sungSeen++;
        // No automatic listen-back: from level 3 the learner sings before hearing the path.
        expect(actor.getSnapshot().context.audition).toBeNull();
        actor.send({ type: "NEXT" });
        expect(actor.getSnapshot().matches({ resolution: "running" })).toBe(true);
        actor.send({ type: "CAPTURED", frames: [] });
        const ctx = actor.getSnapshot().context;
        const sr = ctx.records[i]?.sungResolution;
        expect(sr).toMatchObject({
          order: "play-first",
          credit: 0.75,
          passed: false,
          skipped: false,
          quiet: false,
        });
        expect(sr?.tolCents).toBe(50);
        expect(sr?.path.at(-1)).toBe("1");
        expect(sr?.notes).toHaveLength(1);
        // The identification credit is untouched.
        expect(ctx.records[i]?.credit).toBe(1);
      }
      actor.send({ type: "NEXT" });
    }
    // Two or three per set, never all (contracts §8.3).
    expect(sungSeen).toBeGreaterThanOrEqual(2);
    expect(sungSeen).toBeLessThanOrEqual(3);
    await waitFor(actor, (st) => st.matches("summary"));
  });

  test("Quiet mode: the resolution is heard, then imagined (Space), recorded as quiet with no notes", async () => {
    const s = session("fam.deg.fet-major", 8);
    const { actor } = run(s, { quiet: true });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    let quietSeen = 0;
    for (let i = 0; i < 8; i++) {
      const trial = actor.getSnapshot().context.current?.trial as Trial;
      actor.send({ type: "PRESENTED" });
      answerDegree(actor, i % 2 === 0);
      if (trial.params.sungResolution === true) {
        quietSeen++;
        actor.send({ type: "NEXT" });
        // The way home plays (the actor reports PRESENTED when it has), then the learner hears it inside.
        actor.send({ type: "PRESENTED" });
        expect(actor.getSnapshot().matches({ resolution: "imagining" })).toBe(true);
        actor.send({ type: "HEARD" });
        const rec = actor.getSnapshot().context.records[i];
        expect(rec?.modality).toBe("quiet");
        expect(rec?.sungResolution).toMatchObject({ quiet: true, skipped: false, notes: [], credit: 0 });
        expect(rec?.response.sung).toBeNull();
      }
      actor.send({ type: "NEXT" });
    }
    // The planner keeps the resolutions in Quiet mode: they are listened to, not dropped.
    expect(quietSeen).toBeGreaterThanOrEqual(2);
    await waitFor(actor, (st) => st.matches("summary"));
  });

  test("Quiet mode switched on mid-set: a way home being sung stops at once; later ones are heard inside", async () => {
    const s = session("fam.deg.fet-major", 8);
    const { actor } = run(s, { quiet: false });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    let phase: "sing" | "quiet" = "sing";
    let quietSeen = 0;
    for (let i = 0; i < 8; i++) {
      const trial = actor.getSnapshot().context.current?.trial as Trial;
      actor.send({ type: "PRESENTED" });
      answerDegree(actor, true);
      if (trial.params.sungResolution === true) {
        actor.send({ type: "NEXT" });
        if (phase === "sing") {
          expect(actor.getSnapshot().matches({ resolution: "running" })).toBe(true);
          // The learner switches Quiet mode on while the mic listens: the take stops, skipped, no penalty.
          actor.send({ type: "QUIET", quiet: true });
          const ctx = actor.getSnapshot().context;
          expect(actor.getSnapshot().matches({ resolution: "done" })).toBe(true);
          expect(ctx.input.quiet).toBe(true);
          expect(ctx.records[i]?.modality).toBe("quiet");
          expect(ctx.records[i]?.sungResolution).toMatchObject({ skipped: true });
          expect(ctx.records[i]?.credit).toBe(1);
          phase = "quiet";
        } else {
          quietSeen++;
          actor.send({ type: "PRESENTED" });
          expect(actor.getSnapshot().matches({ resolution: "imagining" })).toBe(true);
          actor.send({ type: "HEARD" });
          expect(actor.getSnapshot().context.records[i]?.sungResolution).toMatchObject({ quiet: true });
        }
      }
      actor.send({ type: "NEXT" });
    }
    expect(phase).toBe("quiet");
    expect(quietSeen).toBeGreaterThanOrEqual(1);
    await waitFor(actor, (st) => st.matches("summary"));
  });

  test("Shift+S on a resolution records it as skipped; Show me records the reveal", async () => {
    const s = session("fam.deg.fet-major", 8);
    const { actor } = run(s);
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    let skipped = false;
    for (let i = 0; i < 8 && !skipped; i++) {
      const trial = actor.getSnapshot().context.current?.trial as Trial;
      actor.send({ type: "PRESENTED" });
      if (trial.params.sungResolution === true) {
        answerDegree(actor, true);
        actor.send({ type: "NEXT" });
        actor.send({ type: "SKIP_SUNG" });
        expect(actor.getSnapshot().context.records[i]?.sungResolution).toMatchObject({ skipped: true });
        skipped = true;
      } else {
        actor.send({ type: "REVEAL" });
        expect(actor.getSnapshot().context.records[i]).toMatchObject({ revealed: true, credit: 0 });
        // A revealed trial still hears its way home.
        expect(actor.getSnapshot().context.audition).toBe("resolve");
      }
      actor.send({ type: "NEXT" });
    }
    expect(skipped).toBe(true);
  });

  test("A/B listening while answering counts as a replay", async () => {
    const { actor } = run(session("fam.pit.compare", 1));
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "LISTENED" });
    actor.send({ type: "LISTENED" });
    expect(actor.getSnapshot().context.replays).toBe(2);
    expect(actor.getSnapshot().matches({ trial: "answering" })).toBe(true);
  });
});

// docs/design/retry.md §3.3: "Try again" after any result re-opens the same trial (or its sung resolution) as a
// practice take. The first answer stays the record (it grades the card, contracts §7.2); nothing moves on by itself.
describe("drill machine: Try again", () => {
  async function toFeedback(actor: ReturnType<typeof run>["actor"], right: boolean) {
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "PRESENTED" });
    clock += 700;
    answer(actor, right);
    expect(actor.getSnapshot().matches("feedback")).toBe(true);
  }

  test("a right trial and a wrong trial are each retried: the first answers stay the records", async () => {
    const s = session("fam.pit.compare", 3);
    const { actor, spy } = run(s);
    // Trial 1: right, then a WRONG practice take (a retry never punishes).
    await toFeedback(actor, true);
    const seed = actor.getSnapshot().context.current?.trial.seed;
    const first = actor.getSnapshot().context.records[0];
    expect(first?.credit).toBe(1);
    actor.send({ type: "RETRY" });
    let snap = actor.getSnapshot();
    expect(snap.matches({ trial: "presenting" })).toBe(true);
    // The same trial (not a new one), at the same index, with the answer open again.
    expect(snap.context.index).toBe(0);
    expect(snap.context.current?.trial.seed).toBe(seed);
    expect(snap.context.practice).toEqual({ of: "trial", outcome: null });
    expect(shownOutcome(snap.context)).toBeUndefined();
    expect(snap.context.replays).toBe(0);
    actor.send({ type: "PRESENTED" });
    answer(actor, false);
    snap = actor.getSnapshot();
    expect(snap.matches("feedback")).toBe(true);
    // The practice take is shown…
    expect(shownOutcome(snap.context)?.result.correct).toBe(false);
    // …and never recorded: the record keeps the first answer and counts the take.
    expect(snap.context.outcomes[0]?.result.correct).toBe(true);
    expect(snap.context.records[0]).toEqual({ ...(first as DrillTrialRecord), retries: 1 });
    // Nothing moves on by itself: still on trial 1 until NEXT.
    expect(snap.context.index).toBe(0);
    actor.send({ type: "NEXT" });
    // Trial 2: wrong, then a RIGHT practice take, twice.
    await toFeedback(actor, false);
    expect(actor.getSnapshot().context.practice).toBeNull();
    for (let take = 1; take <= 2; take++) {
      actor.send({ type: "RETRY" });
      actor.send({ type: "PRESENTED" });
      answer(actor, true);
      expect(shownOutcome(actor.getSnapshot().context)?.result.correct).toBe(true);
    }
    snap = actor.getSnapshot();
    expect(snap.context.records[1]).toMatchObject({ credit: 0, correct: false, retries: 2 });
    expect(snap.context.outcomes[1]?.result.correct).toBe(false);
    actor.send({ type: "NEXT" });
    // Trial 3: no retry; its record has no practice count.
    await toFeedback(actor, true);
    expect(actor.getSnapshot().context.records[2]?.retries).toBeUndefined();
    actor.send({ type: "NEXT" });
    await waitFor(actor, (st) => st.matches("summary"));
    // Every re-send carries the first answer (the server keeps the first stored answer anyway).
    expect(spy.sentRecords.map((r) => [r.idx, r.credit, r.retries ?? 0])).toEqual([
      [0, 1, 0],
      [0, 1, 1],
      [1, 0, 0],
      [1, 0, 1],
      [1, 0, 2],
      [2, 1, 0],
    ]);
    expect(spy.finished).toEqual([0, 1, 2]);
  });

  test("a revealed trial and a skipped sung trial can be tried again; the reveal stays the record", async () => {
    const { actor } = run(session("fam.pit.compare", 1));
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "REVEAL" });
    actor.send({ type: "RETRY" });
    actor.send({ type: "PRESENTED" });
    answer(actor, true);
    const ctx = actor.getSnapshot().context;
    expect(shownOutcome(ctx)?.result.correct).toBe(true);
    expect(ctx.records[0]).toMatchObject({ credit: 0, revealed: true, retries: 1 });

    const sung = run(session("fam.pit.match", 1));
    await waitFor(sung.actor, (st) => st.matches({ trial: "ready" }));
    sung.actor.send({ type: "START" });
    await waitFor(sung.actor, (st) => st.matches({ trial: "presenting" }));
    sung.actor.send({ type: "SKIP_SUNG" });
    sung.actor.send({ type: "RETRY" });
    expect(sung.actor.getSnapshot().matches({ trial: "ready" })).toBe(true);
    sung.actor.send({ type: "START" });
    sung.actor.send({ type: "CAPTURED", frames: [] });
    const c2 = sung.actor.getSnapshot().context;
    expect(shownOutcome(c2)?.result.skipped).toBeFalsy();
    expect(c2.records[0]?.response.skipped).toBe(true);
    expect(c2.records[0]?.retries).toBe(1);
  });

  test("a tapped trial is tapped again as practice; the first taps stay the record", async () => {
    const { actor } = run(session("fam.rhy.pulse", 1));
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    const trial = actor.getSnapshot().context.current?.trial as Trial;
    const taps = trial.params.tapTargets as number[];
    actor.send({ type: "CAPTURED", taps: taps.map((t) => t + 0.01) });
    expect(actor.getSnapshot().context.records[0]?.correct).toBe(true);
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().matches({ trial: "presenting" })).toBe(true);
    // A late, sparse take: graded and shown, not recorded.
    actor.send({ type: "CAPTURED", taps: [taps[0] as number] });
    const ctx = actor.getSnapshot().context;
    expect(shownOutcome(ctx)?.result.correct).toBe(false);
    expect(ctx.captured.taps).toEqual([taps[0] as number]);
    expect(ctx.records[0]?.correct).toBe(true);
    expect(ctx.records[0]?.response.taps).toHaveLength(taps.length);
    expect(ctx.records[0]?.retries).toBe(1);
  });

  test("Quiet mode: a sung trial heard in the head is heard again as practice; the mic never opens", async () => {
    const s = session("fam.pit.match", 2);
    const presented: { quiet: boolean }[] = [];
    const machine = drillMachine.provide({
      actors: {
        start: fromPromise(async () => ({ session: s, source: sourceFor(s) })),
        present: fromCallback(({ input }) => {
          presented.push(input as { quiet: boolean });
          return () => {};
        }),
      },
      actions: { persist: () => {}, send: () => {}, done: () => {} },
    });
    const actor = createActor(machine, {
      input: {
        purpose: "srs",
        familyIds: s.familyIds,
        warmupItemId: null,
        sessionId: null,
        quiet: true,
        tolCents: 50,
        resume: null,
        deps,
      },
    });
    actor.start();
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "HEARD" });
    expect(actor.getSnapshot().context.records[0]).toMatchObject({ modality: "quiet", credit: 0 });
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().matches({ trial: "presenting" })).toBe(true);
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "HEARD" });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().matches("feedback")).toBe(true);
    expect(shownOutcome(ctx)?.result.skipped).toBe(true);
    expect(ctx.records[0]).toMatchObject({ modality: "quiet", retries: 1 });
    // Both takes were presented in Quiet mode: the present actor never opens the mic then.
    expect(presented.map((p) => p.quiet)).toEqual([true, true]);
    actor.send({ type: "NEXT" });
    expect(actor.getSnapshot().context.index).toBe(1);
    expect(actor.getSnapshot().context.practice).toBeNull();
    actor.stop();
  });

  test("a reload during a practice take resumes at the next trial with the first answer kept", async () => {
    const s = session("fam.pit.compare", 3);
    const first = run(s);
    await toFeedback(first.actor, false);
    first.actor.send({ type: "RETRY" });
    // Persisted on entering the practice take: pointing past the trial (its first answer is saved).
    expect(first.spy.persisted.at(-1)).toBe(1);
    first.actor.send({ type: "PRESENTED" });
    answer(first.actor, true);
    const saved = first.spy.saved as NonNullable<Spy["saved"]>;
    first.actor.stop();
    expect(saved.records.map((r) => [r.idx, r.credit, r.retries])).toEqual([[0, 0, 1]]);
    const second = run(s, { resume: { session: s, ...saved } });
    await waitFor(second.actor, (st) => st.matches({ trial: "presenting" }));
    const ctx = second.actor.getSnapshot().context;
    expect(ctx.index).toBe(1);
    expect(ctx.practice).toBeNull();
    expect(ctx.outcomes[0]?.result.correct).toBe(false);
    second.actor.stop();
  });

  test("the sung way home is sung again as practice: the first take stays the sung resolution", async () => {
    const base = sourceFor(session("fam.deg.fet-major", 2));
    const source: TrialSource = {
      total: 2,
      at: (i) => {
        const p = base.at(i, []);
        return i === 0
          ? { ...p, trial: { ...p.trial, params: { ...p.trial.params, sungResolution: true } } }
          : p;
      },
    };
    const { actor, spy } = run(session("fam.deg.fet-major", 2), { source });
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "PRESENTED" });
    answerDegree(actor, true);
    // A practice take of the trial before the resolution: the resolution still follows, and still counts.
    actor.send({ type: "RETRY" });
    actor.send({ type: "PRESENTED" });
    answerDegree(actor, false);
    expect(shownOutcome(actor.getSnapshot().context)?.result.correct).toBe(false);
    actor.send({ type: "NEXT" });
    expect(actor.getSnapshot().matches({ resolution: "running" })).toBe(true);
    resolutionCredit = 0.5;
    actor.send({ type: "CAPTURED", frames: [] });
    expect(actor.getSnapshot().matches({ resolution: "done" })).toBe(true);
    const counted = actor.getSnapshot().context.records[0]?.sungResolution;
    expect(counted?.credit).toBe(0.5);
    // Try again after the way home: running again, the first take shown until the new one is in.
    actor.send({ type: "RETRY" });
    let snap = actor.getSnapshot();
    expect(snap.matches({ resolution: "running" })).toBe(true);
    expect(shownOutcome(snap.context)?.resolutionCredit).toBe(0.5);
    resolutionCredit = 1;
    actor.send({ type: "CAPTURED", frames: [] });
    snap = actor.getSnapshot();
    expect(snap.matches({ resolution: "done" })).toBe(true);
    expect(shownOutcome(snap.context)?.resolutionCredit).toBe(1);
    // Recorded: the first take and the identification credit of the first answer; two practice takes counted.
    expect(snap.context.records[0]?.sungResolution).toEqual(counted);
    expect(snap.context.outcomes[0]?.resolutionCredit).toBe(0.5);
    expect(snap.context.records[0]).toMatchObject({ credit: 1, retries: 2 });
    expect(spy.sentRecords.at(-1)?.sungResolution).toEqual(counted);
    resolutionCredit = 0.75;
    actor.send({ type: "NEXT" });
    expect(actor.getSnapshot().context.index).toBe(1);
    expect(actor.getSnapshot().context.retries).toBe(0);
    actor.stop();
  });

  test("Quiet mode: the way home heard in the head can be heard again; nothing is sent for it", async () => {
    // imagining → done → Try again → imagining → done.
    const base = sourceFor(session("fam.deg.fet-major", 1));
    const source: TrialSource = {
      total: 1,
      at: (i) => {
        const p = base.at(i, []);
        return { ...p, trial: { ...p.trial, params: { ...p.trial.params, sungResolution: true } } };
      },
    };
    const q = run(session("fam.deg.fet-major", 1), { source, quiet: true });
    await waitFor(q.actor, (st) => st.matches({ trial: "presenting" }));
    q.actor.send({ type: "PRESENTED" });
    answerDegree(q.actor, true);
    q.actor.send({ type: "NEXT" });
    q.actor.send({ type: "PRESENTED" });
    expect(q.actor.getSnapshot().matches({ resolution: "imagining" })).toBe(true);
    q.actor.send({ type: "HEARD" });
    const counted = q.actor.getSnapshot().context.records[0]?.sungResolution;
    expect(counted).toMatchObject({ quiet: true });
    q.actor.send({ type: "RETRY" });
    q.actor.send({ type: "PRESENTED" });
    expect(q.actor.getSnapshot().matches({ resolution: "imagining" })).toBe(true);
    q.actor.send({ type: "HEARD" });
    const ctx = q.actor.getSnapshot().context;
    expect(ctx.records[0]?.sungResolution).toEqual(counted);
    expect(ctx.records[0]?.retries).toBe(1);
    q.actor.send({ type: "NEXT" });
    await waitFor(q.actor, (st) => st.matches("summary"));
  });

  test("RETRY means nothing while a trial is being answered", async () => {
    const { actor } = run(session("fam.pit.compare", 1));
    await waitFor(actor, (st) => st.matches({ trial: "presenting" }));
    actor.send({ type: "PRESENTED" });
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().matches({ trial: "answering" })).toBe(true);
    expect(actor.getSnapshot().context.retries).toBe(0);
  });
});
