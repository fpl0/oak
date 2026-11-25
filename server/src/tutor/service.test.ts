import { describe, expect, test } from "bun:test";
import { findLeaks, leakMarkers } from "./redaction.ts";
import { createTutorService, SOFT_MARKER_COPY } from "./service.ts";
import type { ServiceEvent, TutorLogEntry } from "./service-types.ts";
import { type FakePorts, makePorts } from "./testing/fakes.ts";
import {
  CAPSTONE_REVIEW,
  GRADE,
  LEARNER_CODE,
  LESSON_ID,
  REVIEW_SOURCE,
  SOLUTION_CODE,
  STEP,
  STEP_ID,
} from "./testing/fixtures.ts";
import { ScriptedBackend } from "./testing/scripted-backend.ts";
import { type TurnRequest, type TutorBackend, UNAVAILABLE } from "./types.ts";

const never = new AbortController().signal;
const lesson = { subjectKind: "lesson", subjectId: LESSON_ID } as const;
const capstone = { subjectKind: "capstone", subjectId: "C2" } as const;
const hint: TurnRequest = {
  thread: lesson,
  kind: "hint",
  userText: "",
  learnerCode: LEARNER_CODE,
  graderResult: GRADE,
  stepId: STEP_ID,
};
const chat: TurnRequest = {
  thread: lesson,
  kind: "chat",
  userText: "Why does my arpeggio sound unfinished?",
};

function setup(backends: TutorBackend[], ports: FakePorts = makePorts()) {
  const logs: TutorLogEntry[] = [];
  const service = createTutorService({ ports, backends, log: (e) => logs.push(e) });
  const run = async (request: TurnRequest, signal: AbortSignal = never) => {
    const events: ServiceEvent[] = [];
    const summary = await service.turn(request, (e) => events.push(e), signal);
    return { events, summary, types: events.map((e) => e.type) };
  };
  return { ports, service, logs, run };
}

describe("a turn", () => {
  test("runs on the selected backend and ends with exactly one done", async () => {
    const backend = new ScriptedBackend("anthropic-api", [{ thinking: "hm" }, { text: "Listen to bar 1." }]);
    const { run, ports } = setup([backend]);
    const { types, summary, events } = await run(chat);
    expect(types).toEqual(["meta", "thinking", "text", "done"]);
    expect(summary).toEqual({ ok: true, errorKind: null, backend: "anthropic-api", softMarkerPassed: false });
    expect(events[0]).toMatchObject({ type: "meta", data: { backend: "anthropic-api", lane: "chat" } });
    expect(ports.usage.rows).toHaveLength(1);
    const stored = await ports.conversations.entries(`lesson:${LESSON_ID}:2026-11-11:chat`);
    expect(stored.map((e) => [e.role, e.text])).toEqual([
      ["user", chat.userText],
      ["assistant", "Listen to bar 1."],
    ]);
  });

  test("a hint advances the server's rung once, before the model, and the model sees only that rung", async () => {
    const backend = new ScriptedBackend("claude-cli", [
      { tool: { name: "get_lesson_context", input: { lesson_id: LESSON_ID, step_id: STEP_ID } } },
      { text: "Where does it feel finished?" },
    ]);
    const { run, ports } = setup([backend]);
    const first = await run(hint);
    expect(first.events[0]).toMatchObject({ type: "meta", data: { rung: 1, lane: "hint" } });
    expect(ports.progress.advances).toEqual([{ stepId: STEP_ID, from: 0, to: 1 }]);
    // The button's words stand in for the missing message, in the transcript and for the model.
    expect(backend.turns[0]?.user.text).toBe("Give me a nudge.");
    // Nothing above rung 1 reached the backend: not in the context, not in a tool result.
    const upstream = backend.upstreamText();
    expect(findLeaks(upstream, leakMarkers(STEP, GRADE), 1)).toEqual([]);
    expect(upstream).not.toContain(SOLUTION_CODE);

    await run({ ...hint, kind: "explain" });
    expect(backend.turns[1]?.user.text).toBe("Explain this error.");
    expect(ports.progress.advances.map((a) => a.to)).toEqual([1, 2]);
  });

  test("a hint for a step the content port withholds is refused before any model call", async () => {
    const backend = new ScriptedBackend("anthropic-api", [{ text: "x" }]);
    const { run, ports, logs } = setup([backend]);
    // What the port answers for a checkpoint item or the current drill trial.
    ports.lessons.step = async () => null;
    for (const kind of ["hint", "explain"] as const) {
      const { events } = await run({ ...hint, kind });
      expect(events).toEqual([{ type: "error", data: expect.objectContaining({ kind: "bad_request" }) }]);
    }
    expect(backend.turns).toEqual([]);
    expect(ports.progress.advances).toEqual([]);
    expect(await ports.conversations.timeline(lesson)).toEqual([]);
    expect(logs.some((l) => l.detail?.includes("without a resolvable step"))).toBe(true);
    // A chat message on the same subject is still answered; it just has no step to talk about.
    expect((await run({ ...chat, stepId: STEP_ID })).types.at(-1)).toBe("done");
  });

  test("the request cannot carry a rung: a chat turn never moves the ladder", async () => {
    const backend = new ScriptedBackend("anthropic-api", [{ text: "ok" }]);
    const { run, ports } = setup([backend]);
    await run({ ...chat, stepId: STEP_ID, learnerCode: LEARNER_CODE, graderResult: GRADE });
    expect(ports.progress.advances).toEqual([]);
    expect(findLeaks(backend.upstreamText(), leakMarkers(STEP, GRADE), 0)).toEqual([]);
  });

  test("tutor off: one error event with set-up guidance, nothing stored, no rung spent", async () => {
    const api = new ScriptedBackend("anthropic-api");
    const cli = new ScriptedBackend("claude-cli");
    api.isAvailable = { ok: false, reason: UNAVAILABLE.missingKey };
    cli.isAvailable = { ok: false, reason: UNAVAILABLE.notInstalled };
    const { run, ports } = setup([api, cli]);
    const { events, summary } = await run(hint);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error", data: { kind: "auth" } });
    const message = (events[0] as { data: { message: string } }).data.message;
    expect(message).toContain("Add an Anthropic API key in Settings");
    expect(message).toContain("sign in to Claude Code");
    expect(message).toContain("hints use the authored ladder");
    expect(summary).toMatchObject({ ok: false, errorKind: "auth", backend: null });
    expect(ports.progress.advances).toEqual([]);
    expect(await ports.conversations.timeline(lesson)).toEqual([]);

    ports.settings.value.backend = "off";
    const off = await run(chat);
    expect((off.events[0] as { data: { message: string } }).data.message).toContain("turned off");
  });

  test("the soft marker is one notice before done and never blocks, however far past it", async () => {
    const backend = new ScriptedBackend("anthropic-api", [{ text: "ok" }]);
    const { run, ports } = setup([backend]);
    ports.settings.value.softMonthlyUsd = 0.001;
    const crossing = await run(chat);
    expect(crossing.types).toEqual(["meta", "text", "notice", "done"]);
    expect(crossing.events[2]).toEqual({
      type: "notice",
      data: { kind: "budget_soft_marker", message: SOFT_MARKER_COPY },
    });
    expect(crossing.summary.softMarkerPassed).toBe(true);
    // Once per month.
    expect((await run(chat)).types).toEqual(["meta", "text", "done"]);

    // Far past the marker (there is no hard cap): every lane still runs to done.
    for (let i = 0; i < 3; i++) expect((await run(chat)).types).toEqual(["meta", "text", "done"]);
    const heavy = await run(hint);
    expect(heavy.events.at(-1)?.type).toBe("done");
    expect(heavy.events.some((e) => e.type === "error")).toBe(false);
    expect(backend.turns).toHaveLength(6);
  });

  test("a closed subject and a thrown port error both end in one error event", async () => {
    const backend = new ScriptedBackend("anthropic-api", [{ text: "ok" }]);
    const { run, ports, logs } = setup([backend]);
    ports.lessons.facts.set("checkpoint:U03.CP", {
      tutorOpen: false,
      closedReason: "checkpoint in progress",
      title: null,
      released: null,
      transcriptionSource: null,
    });
    const closed = await run({
      thread: { subjectKind: "checkpoint", subjectId: "U03.CP" },
      kind: "chat",
      userText: "?",
    });
    expect(closed.events).toEqual([
      { type: "error", data: expect.objectContaining({ kind: "bad_request" }) },
    ]);

    ports.lessons.prefixSources = async () => {
      throw new Error("disk gone, key sk-ant-api03-SECRETSECRET");
    };
    const broken = await run(chat);
    expect(broken.events).toEqual([{ type: "error", data: expect.objectContaining({ kind: "internal" }) }]);
    expect(JSON.stringify(broken.events)).not.toContain("disk gone");
    const logged = logs.find((l) => l.level === "error");
    expect(logged?.detail).toContain("disk gone");
    expect(logged?.detail).not.toContain("SECRETSECRET");
  });

  test("a backend failure is stored as an excluded tail and reported once", async () => {
    const backend = new ScriptedBackend("anthropic-api", [{ text: "partial" }, { fail: "overloaded" }]);
    const { run, ports } = setup([backend]);
    const { types, summary } = await run(chat);
    expect(types).toEqual(["meta", "text", "error"]);
    expect(summary).toMatchObject({ ok: false, errorKind: "overloaded" });
    expect(await ports.conversations.entries(`lesson:${LESSON_ID}:2026-11-11:chat`)).toEqual([]);
    expect(await ports.conversations.timeline(lesson)).toHaveLength(2);
  });
});

describe("reviews", () => {
  const request: TurnRequest = { thread: capstone, kind: "review-capstone", userText: "" };

  test.each(["tool", "direct"] as const)(
    "an invalid review is sent back once and the valid resubmission is delivered (%s channel)",
    async (channel) => {
      const backend = new ScriptedBackend(channel === "tool" ? "anthropic-api" : "claude-cli");
      backend.channel = channel;
      backend.deliveries = [
        { ...CAPSTONE_REVIEW, strengths: [...CAPSTONE_REVIEW.strengths, ...CAPSTONE_REVIEW.strengths] },
        CAPSTONE_REVIEW,
      ];
      const { run, ports } = setup([backend]);
      ports.lessons.reviews.set("capstone:C2", REVIEW_SOURCE);
      const { events, types } = await run(request);
      expect(types.filter((t) => t === "review")).toHaveLength(1);
      expect(types.at(-1)).toBe("done");
      expect(events.find((e) => e.type === "review")).toEqual({
        type: "review",
        data: { reviewKind: "capstone", review: CAPSTONE_REVIEW },
      });
      expect(ports.notes.notes).toHaveLength(1);
      // The review read the code the server holds, at high effort.
      expect(backend.turns[0]).toMatchObject({ effort: "high", lane: "review" });
      expect(backend.turns[0]?.user.learnerCode).toBe(REVIEW_SOURCE.code);
    },
  );

  test("the retry is bounded: two invalid objects end in an error and no review is invented", async () => {
    const backend = new ScriptedBackend("anthropic-api");
    const bad = { ...CAPSTONE_REVIEW, linerNote: "You did well." };
    backend.deliveries = [bad, bad, CAPSTONE_REVIEW];
    const { run, ports } = setup([backend]);
    ports.lessons.reviews.set("capstone:C2", REVIEW_SOURCE);
    const { types, events } = await run(request);
    expect(types).toEqual(["meta", "tool_start", "tool_result", "tool_start", "tool_result", "error"]);
    expect(events.at(-1)).toMatchObject({ type: "error", data: { kind: "iteration_limit" } });
    expect(ports.notes.notes).toEqual([]);
  });

  test("nothing to review is an error event, not a model call", async () => {
    const backend = new ScriptedBackend("anthropic-api");
    const { run } = setup([backend]);
    const { events } = await run(request);
    expect(events).toEqual([{ type: "error", data: expect.objectContaining({ kind: "bad_request" }) }]);
    expect(backend.turns).toEqual([]);
  });
});

describe("listening note", () => {
  test("low effort, no cards, and the note is kept as a tutor note", async () => {
    const backend = new ScriptedBackend("anthropic-api", [
      { text: "In bar 2 the bass leaves the root and the groove opens up. What happens if it stays?" },
    ]);
    const { run, ports } = setup([backend]);
    const sketch = { subjectKind: "sketch", subjectId: "sk-1" } as const;
    const { types } = await run({
      thread: sketch,
      kind: "listening",
      userText: "",
      learnerCode: 's("bd sd")',
    });
    expect(types).toEqual(["meta", "text", "done"]);
    expect(backend.turns[0]).toMatchObject({ effort: "low", lane: "note" });
    expect(ports.notes.notes).toMatchObject([
      { source: "listening", subjectKind: "sketch", subjectId: "sk-1" },
    ]);
  });
});
