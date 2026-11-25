import { describe, expect, test } from "bun:test";
import type { Rung } from "./domain.ts";
import { encodeSse, type TutorEvent } from "./events.ts";
import { prepareTurn } from "./prepare.ts";
import { findLeaks, forbiddenKeys, leakMarkers } from "./redaction.ts";
import { runTurn } from "./run.ts";
import { runReview } from "./run-review.ts";
import { type FakePorts, makePorts, type Overrides, override } from "./testing/fakes.ts";
import {
  CAPSTONE_REVIEW,
  EXERCISE_REF,
  GRADE,
  LEARNER_CODE,
  LESSON_ID,
  REVIEW_SOURCE,
  SOLUTION_CODE,
  STEP,
  STEP_ID,
} from "./testing/fixtures.ts";
import { ScriptedBackend, type ScriptStep } from "./testing/scripted-backend.ts";
import type { BackendId, TurnRequest } from "./types.ts";

const never = new AbortController().signal;
const lesson = { subjectKind: "lesson", subjectId: LESSON_ID } as const;
const req = (over: Overrides<TurnRequest> = {}): TurnRequest =>
  override<TurnRequest>(
    {
      thread: lesson,
      kind: "chat",
      userText: "Just tell me the exact code that passes.",
      learnerCode: LEARNER_CODE,
      graderResult: GRADE,
      stepId: STEP_ID,
    },
    over,
  );

async function turn(
  ports: FakePorts,
  backend: ScriptedBackend,
  request: TurnRequest,
  signal: AbortSignal = never,
) {
  const events: TutorEvent[] = [];
  const prep = await prepareTurn(request, ports);
  const result = await runTurn(prep, backend, (e) => events.push(e), signal, ports);
  return { prep, result, events };
}

/** A "model" that asks every tool for everything it can. */
const GREEDY: ScriptStep[] = [
  { thinking: "Let me look." },
  { tool: { name: "get_lesson_context", input: { lesson_id: LESSON_ID, step_id: STEP_ID } } },
  {
    tool: {
      name: "compare_haps",
      input: {
        learner_code: null,
        target: { kind: "exercise", ref: EXERCISE_REF },
        from_bar: 1,
        bars: 1,
        mode: "auto",
      },
    },
  },
  { tool: { name: "get_learner_progress", input: {} } },
  {
    tool: { name: "evaluate_strudel", input: { code: LEARNER_CODE, from_bar: 1, bars: 1, key: "D dorian" } },
  },
  {
    tool: {
      name: "propose_code",
      input: {
        kind: "example",
        title: "Same shape in C",
        code: 'mel: n("0 2 4").scale("C4:major")',
        explanation: "Listen to the top.",
        bars: 4,
      },
    },
  },
  { text: "Look at beat 3 of bar 1. " },
  { text: "Which number is the octave?" },
];

describe("no solution or expected value reaches a backend below the allowed rung", () => {
  const BACKENDS: BackendId[] = ["anthropic-api", "claude-cli"];
  const cases = BACKENDS.flatMap((b) => ([0, 1, 2, 3] as Rung[]).map((r) => [b, r] as const));

  test.each(cases)("%s at rung %i, over three turns of chat and hints", async (backendId, rung) => {
    const ports = makePorts();
    ports.progress.set(STEP_ID, { rung, matchedMistakes: ["melody.degree-off-by-one"] });
    const backend = new ScriptedBackend(backendId, GREEDY);
    const wire: string[] = [];
    for (const kind of ["chat", "chat", "explain"] as const) {
      // A chat turn never moves the rung. The hint turn may, so the allowance is read after it.
      const { events } = await turn(ports, backend, req({ kind }));
      wire.push(events.map(encodeSse).join(""));
    }
    const level = (await ports.progress.stepState(LESSON_ID, STEP_ID)).rung;
    expect(level).toBe(Math.min(3, rung + 1) as Rung);
    const markers = leakMarkers(STEP, GRADE);

    // 1. Everything a backend was handed and could send upstream: prefix, user turns, transcript,
    //    its own records, and every tool result.
    const upstream = backend.upstreamText();
    expect(findLeaks(upstream, markers, level)).toEqual([]);
    // (The static prefix is left out of the key check: the tool list has an enum value "fix".)
    const dynamic = backend.upstreamText({ prefix: false });
    for (const key of forbiddenKeys(level)) expect(dynamic.includes(key)).toBe(false);
    expect(upstream).not.toContain(SOLUTION_CODE);
    // 2. Every SSE frame for the browser.
    expect(findLeaks(wire.join(""), markers, level)).toEqual([]);
    // 3. What was stored.
    const stored = JSON.stringify([
      await ports.conversations.timeline(lesson),
      ports.conversations.allBackendRecords(),
    ]);
    expect(findLeaks(stored, markers, level)).toEqual([]);

    // Not vacuous: the tools did run and returned what the rung allows.
    expect(backend.toolResults).toHaveLength(15);
    expect(upstream).toContain('"redacted_to_rung"');
    expect(upstream.includes("melody.wrong-degree")).toBe(level >= 2);
  });

  test("positive control: at rung 4 the solution does arrive", async () => {
    const ports = makePorts();
    ports.progress.set(STEP_ID, { rung: 4 });
    const backend = new ScriptedBackend("claude-cli", GREEDY);
    await turn(ports, backend, req());
    expect(findLeaks(backend.upstreamText(), leakMarkers(STEP, GRADE), 3).length).toBeGreaterThan(0);
    expect(backend.toolResults[0]?.result.content).toContain("0 2 4 7 4 2");
  });

  test("the grade the browser sent is cut by the server's rung before any backend sees it", async () => {
    const ports = makePorts();
    const backend = new ScriptedBackend("anthropic-api", [{ text: "ok" }]);
    await turn(ports, backend, req());
    const user = backend.turns[0]?.user.oakContext ?? "";
    expect(user).toContain("issue 1: mel bar 1 beat 3");
    expect(user).not.toContain("Change the fourth step");
    expect(user).not.toContain("degree 8 (D5)");
  });
});

describe("a turn, end to end", () => {
  test("events: meta first, done last; text guarded; one author per event type", async () => {
    const ports = makePorts();
    const backend = new ScriptedBackend("anthropic-api", [
      {
        emit: {
          type: "meta",
          data: {
            conversationId: "forged",
            kind: "chat",
            lane: "chat",
            backend: "claude-cli",
            model: "x",
            rung: 4,
            revealAllowed: true,
          },
        },
      },
      { emit: { type: "status", data: { phase: "thinking", label: "Thinking" } } },
      { thinking: "<b>hm</b>" },
      { text: "Bar 3 <scr" },
      { text: 'ipt>x</script> `note("<c3 e3>")`' },
      {
        emit: {
          type: "card",
          data: {
            cardId: "forged",
            toolUseId: "x",
            kind: "hint",
            title: "t",
            code: "fetch(1)",
            explanation: "",
            bars: 1,
            apply: "applicable",
            applyAllowed: true,
            lockedTools: [],
          },
        },
      },
      { emit: { type: "tool_input", data: { toolUseId: "tu", partialJson: '{"code":"fetch(' } } },
      {
        emit: {
          type: "done",
          data: { stopReason: "end_turn", backend: "claude-cli", iterations: 9, usage: {} as never },
        },
      },
    ]);
    const { events, result } = await turn(ports, backend, req());
    // The forged meta, card, draft and done are dropped; only the runner's own meta and done remain.
    expect([...new Set(events.map((e) => e.type))]).toEqual(["meta", "status", "thinking", "text", "done"]);
    expect(events.filter((e) => e.type === "meta" || e.type === "done")).toHaveLength(2);
    expect(events[0]).toEqual({
      type: "meta",
      data: {
        conversationId: "lesson:U03.L02:2026-11-11:chat",
        kind: "chat",
        lane: "chat",
        backend: "anthropic-api",
        model: "claude-opus-5-5",
        rung: 0,
        revealAllowed: true,
      },
    });
    const text = events
      .filter((e) => e.type === "text")
      .map((e) => (e.data as { delta: string }).delta)
      .join("");
    expect(text).toBe('Bar 3 &lt;script>x&lt;/script> `note("<c3 e3>")`');
    expect(events.find((e) => e.type === "thinking")?.data).toEqual({ delta: "&lt;b>hm&lt;/b>" });
    expect(result.text).toBe(text);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      data: { stopReason: "end_turn", backend: "anthropic-api", iterations: 1 },
    });
  });

  test("unlinted card drafts are forwarded only on request", async () => {
    const draft: ScriptStep = {
      emit: { type: "tool_input", data: { toolUseId: "tu", partialJson: '{"code":"n(' } },
    };
    const ports = makePorts();
    const events: TutorEvent[] = [];
    const prep = await prepareTurn(req(), ports);
    await runTurn(prep, new ScriptedBackend("anthropic-api", [draft]), (e) => events.push(e), never, ports, {
      cardDrafts: true,
    });
    expect(events.some((e) => e.type === "tool_input")).toBe(true);
  });

  test("text after a tool round starts a new paragraph, for either backend", async () => {
    const ports = makePorts();
    const backend = new ScriptedBackend("claude-cli", [
      { text: "Let me check." },
      { tool: { name: "get_learner_progress", input: {}, announce: true } },
      { text: "You are on U03." },
    ]);
    const { result, events } = await turn(ports, backend, req());
    expect(result.text).toBe("Let me check.\n\nYou are on U03.");
    expect(events.filter((e) => e.type === "tool_start")).toHaveLength(1);
  });

  test("the transcript is appended, with cards, usage rows and the backend's own records", async () => {
    const ports = makePorts();
    const backend = new ScriptedBackend("anthropic-api", GREEDY);
    const { result } = await turn(ports, backend, req());
    expect(result).toMatchObject({ ok: true, error: null, cardIds: ["card-1"], softMarkerPassed: false });
    const entries = await ports.conversations.entries("lesson:U03.L02:2026-11-11:chat");
    expect(entries.map((e) => [e.seq, e.role, e.excluded])).toEqual([
      [1, "user", false],
      [2, "assistant", false],
    ]);
    expect(entries[0]).toMatchObject({
      text: "Just tell me the exact code that passes.",
      learnerCode: LEARNER_CODE,
      stepId: STEP_ID,
      rung: 0,
    });
    expect(entries[1]).toMatchObject({
      text: "Look at beat 3 of bar 1. Which number is the octave?",
      cardIds: ["card-1"],
      backend: "anthropic-api",
      summary: null,
    });
    expect(ports.usage.rows).toHaveLength(6);
    expect(ports.usage.rows[0]).toMatchObject({
      day: "2026-11-11",
      conversationId: "lesson:U03.L02:2026-11-11:chat",
      kind: "chat",
      lane: "chat",
    });
    expect(
      await ports.conversations.backendRecords("lesson:U03.L02:2026-11-11:chat", "anthropic-api"),
    ).toHaveLength(1);

    // The second turn gets the first as transcript and its own records back; another backend gets none.
    await turn(ports, backend, req({ userText: "And then?" }));
    expect(backend.turns[1]?.transcript.map((e) => e.text)).toEqual([
      "Just tell me the exact code that passes.",
      "Look at beat 3 of bar 1. Which number is the octave?",
    ]);
    expect(backend.turns[1]?.continuity.records).toHaveLength(1);
    expect(backend.turns[1]?.isFirstTurn).toBe(false);
    const other = new ScriptedBackend("claude-cli", [{ text: "hi" }]);
    await turn(ports, other, req({ userText: "Switching backend." }));
    expect(other.turns[0]?.continuity.records).toEqual([]);
    expect(other.turns[0]?.transcript).toHaveLength(4);
  });

  test("what a backend is given: fixed model, effort and limits by thread kind, the frozen tool list", async () => {
    const ports = makePorts();
    const backend = new ScriptedBackend("anthropic-api", [{ text: "x" }]);
    await turn(ports, backend, req({ kind: "hint" }));
    await turn(ports, backend, req({ kind: "chat" }));
    const [hint, chat] = backend.turns;
    expect(hint).toMatchObject({
      model: "claude-opus-5-5",
      effort: "low",
      lane: "hint",
      limits: { maxTokens: 4_000, maxIterations: 3 },
    });
    expect(chat).toMatchObject({
      model: "claude-opus-5-5",
      effort: "medium",
      lane: "chat",
      limits: { maxTokens: 16_000, maxIterations: 6 },
    });
    expect(hint?.tools).toBe(chat?.tools as never);
    expect(hint?.prefixVersion).toBe(chat?.prefixVersion as never);
    expect(Object.keys(hint?.user ?? {})).toEqual(["oakContext", "learnerCode", "text"]);
  });
});

describe("the hint ladder across turns", () => {
  test("a hint request climbs before the model is called; chat does not; hand-offs reach chat", async () => {
    const ports = makePorts();
    const backend = new ScriptedBackend("anthropic-api", [{ text: "Where does it feel finished?" }]);
    const first = await turn(ports, backend, req({ kind: "hint", userText: "Give me a nudge" }));
    expect(first.events[0]?.data).toMatchObject({ lane: "hint", rung: 1 });
    expect(backend.turns[0]?.user.oakContext).toContain("hint_rung: 1 of 4");
    expect(backend.turns[0]?.user.oakContext).toContain(
      "hint_shown 1: Where does an arpeggio feel finished?",
    );

    await turn(ports, backend, req({ kind: "chat", userText: "why?" }));
    expect((await ports.progress.stepState(LESSON_ID, STEP_ID)).rung).toBe(1);
    expect(backend.turns[1]?.user.oakContext).toContain("handoff: hint at rung 1 on U03.L02/S5");

    await turn(ports, backend, req({ kind: "explain", userText: "Explain this error" }));
    await turn(ports, backend, req({ kind: "hint" }));
    await turn(ports, backend, req({ kind: "hint" }));
    expect((await ports.progress.stepState(LESSON_ID, STEP_ID)).rung).toBe(3);
    expect(ports.progress.advances.map((a) => a.to)).toEqual([1, 2, 3]);
    // The hand-off is told once: the next chat turn after it has nothing new from before.
    await turn(ports, backend, req({ kind: "chat" }));
    expect(backend.turns.at(-1)?.user.oakContext.match(/handoff:/g)).toHaveLength(3);
    await turn(ports, backend, req({ kind: "chat" }));
    expect(backend.turns.at(-1)?.user.oakContext).not.toContain("handoff:");
  });

  test("a hint that failed does not climb again on retry", async () => {
    const ports = makePorts();
    const failing = new ScriptedBackend("anthropic-api", [{ fail: "overloaded" }]);
    await turn(ports, failing, req({ kind: "hint" }));
    await turn(ports, failing, req({ kind: "hint" }));
    expect((await ports.progress.stepState(LESSON_ID, STEP_ID)).rung).toBe(1);
    await turn(ports, new ScriptedBackend("anthropic-api", [{ text: "ok" }]), req({ kind: "hint" }));
    expect((await ports.progress.stepState(LESSON_ID, STEP_ID)).rung).toBe(1);
    await turn(ports, new ScriptedBackend("anthropic-api", [{ text: "ok" }]), req({ kind: "hint" }));
    expect((await ports.progress.stepState(LESSON_ID, STEP_ID)).rung).toBe(2);
  });

  test("[[reveal]] is offered only on a hint or chat thread of a graded, unpassed, unrevealed step", async () => {
    const at = async (state: object, over: Overrides<TurnRequest> = {}) => {
      const ports = makePorts();
      ports.progress.set(STEP_ID, state);
      return (await prepareTurn(req(over), ports)).ctx.revealAllowed;
    };
    expect(await at({ rung: 0 })).toBe(true);
    expect(await at({ rung: 2 }, { kind: "hint" })).toBe(true);
    expect(await at({ rung: 4 })).toBe(false);
    expect(await at({ rung: 0, passed: true })).toBe(false);
    expect(await at({ rung: 0 }, { kind: "listening" })).toBe(false);
    expect(await at({ rung: 0 }, { stepId: undefined })).toBe(false);
  });
});

describe("failures", () => {
  test.each(["refusal", "max_tokens", "rate_limit", "iteration_limit"] as const)(
    "%s: an error event, and the tail is stored as excluded",
    async (kind) => {
      const ports = makePorts();
      const backend = new ScriptedBackend("anthropic-api", [{ text: "Partial " }, { fail: kind }]);
      const { events, result } = await turn(ports, backend, req());
      expect(events.at(-1)).toMatchObject({ type: "error", data: { kind } });
      expect(events.some((e) => e.type === "done")).toBe(false);
      expect(result).toMatchObject({ ok: false, error: { kind } });
      const id = "lesson:U03.L02:2026-11-11:chat";
      expect(await ports.conversations.entries(id)).toEqual([]);
      const all = await ports.conversations.entries(id, { includeExcluded: true });
      expect(all.map((e) => [e.role, e.excluded, e.errorKind])).toEqual([
        ["user", true, null],
        ["assistant", true, kind],
      ]);
      // Never replayed: the next turn starts from a clean transcript and clean records.
      const next = new ScriptedBackend("anthropic-api", [{ text: "ok" }]);
      await turn(ports, next, req());
      expect(next.turns[0]?.transcript).toEqual([]);
      expect(next.turns[0]?.continuity.records).toEqual([]);
      expect(next.turns[0]?.isFirstTurn).toBe(true);
    },
  );

  test("a backend that throws is classified; the learner gets fixed copy only", async () => {
    const ports = makePorts();
    const boom = Object.assign(new Error("401 invalid x-api-key sk-ant-api03-SECRETSECRET"), {
      name: "AuthenticationError",
      status: 401,
    });
    const { events } = await turn(ports, new ScriptedBackend("anthropic-api", [{ throws: boom }]), req());
    expect(events.at(-1)).toMatchObject({ type: "error", data: { kind: "auth" } });
    const everything = JSON.stringify([events, await ports.conversations.timeline(lesson), ports.usage.rows]);
    expect(everything).not.toContain("sk-ant");
  });

  test("Stop: the turn ends as aborted", async () => {
    const ports = makePorts();
    const ac = new AbortController();
    const backend = new ScriptedBackend("claude-cli", [{ text: "one " }, { text: "two" }]);
    const events: TutorEvent[] = [];
    const prep = await prepareTurn(req(), ports);
    const done = runTurn(
      prep,
      backend,
      (e) => {
        events.push(e);
        if (e.type === "text") ac.abort();
      },
      ac.signal,
      ports,
    );
    expect((await done).error?.kind).toBe("aborted");
    expect(events.at(-1)).toMatchObject({ type: "error", data: { kind: "aborted" } });
  });

  test("the tutor is off for a closed subject (a running checkpoint, a drill trial)", async () => {
    const ports = makePorts();
    ports.lessons.facts.set("checkpoint:U07.CP", {
      tutorOpen: false,
      closedReason: "checkpoint in progress",
      title: null,
      released: null,
      transcriptionSource: null,
    });
    const p = prepareTurn(
      req({ thread: { subjectKind: "checkpoint", subjectId: "U07.CP" }, stepId: undefined }),
      ports,
    );
    await expect(p).rejects.toMatchObject({ kind: "bad_request" });
    expect(await ports.conversations.timeline({ subjectKind: "checkpoint", subjectId: "U07.CP" })).toEqual(
      [],
    );
  });

  test("spend far past the soft marker never blocks a turn (there is no hard cap)", async () => {
    const ports = makePorts();
    ports.settings.value.softMonthlyUsd = 0.000001;
    const backend = new ScriptedBackend("anthropic-api", [{ text: "x" }]);
    await turn(ports, backend, req());
    const prep = await prepareTurn(req(), ports);
    expect(prep.budget.softPassed).toBe(true);
    await turn(ports, backend, req());
    await turn(ports, backend, req());
    expect(backend.turns).toHaveLength(3);
    // Subscription usage never counts towards the marker.
    const cliPorts = makePorts();
    cliPorts.settings.value.softMonthlyUsd = 0.000001;
    const cli = new ScriptedBackend("claude-cli", [{ text: "x" }]);
    await turn(cliPorts, cli, req());
    await turn(cliPorts, cli, req());
    expect(cli.turns).toHaveLength(2);
    expect(cliPorts.usage.rows[0]?.usage).toMatchObject({ costUsd: null, includedInPlan: true });
  });

  test("the soft marker is reported once, on the turn that crosses it", async () => {
    const ports = makePorts();
    ports.settings.value.softMonthlyUsd = 0.002;
    const backend = new ScriptedBackend("anthropic-api", [{ text: "x" }]);
    const flags = [];
    for (let i = 0; i < 4; i++) flags.push((await turn(ports, backend, req())).result.softMarkerPassed);
    expect(flags.filter(Boolean)).toHaveLength(1);
    expect(ports.settings.value.softWarnedMonth).toBe("2026-11");
  });
});

describe("listening notes and reviews", () => {
  test("a listening note becomes a tutor note, sanitized, and seeds later conversations", async () => {
    const ports = makePorts();
    const sketch = { subjectKind: "sketch", subjectId: "sk-7" } as const;
    const backend = new ScriptedBackend("claude-cli", [
      { text: "Bar 2 lands on [[deg:7]], which <i>leans</i> up." },
    ]);
    const { prep } = await turn(ports, backend, {
      thread: sketch,
      kind: "listening",
      userText: "",
      learnerCode: 'mel: n("0 6")',
    });
    expect(prep.ctx).toMatchObject({ lane: "note", effort: "low" });
    expect(prep.user.text).toBe("Please write a listening note for this sketch.");
    expect(ports.notes.notes).toEqual([
      {
        id: "note-1",
        day: "2026-11-11",
        subjectKind: "sketch",
        subjectId: "sk-7",
        source: "listening",
        text: "Bar 2 lands on [[deg:7]], which &lt;i>leans&lt;/i> up.",
        skillId: null,
        retractedAt: null,
      },
    ]);
    ports.clock.set("2026-11-12T10:00:00Z");
    const next = await prepareTurn({ thread: sketch, kind: "chat", userText: "What did you mean?" }, ports);
    expect(next.user.oakContext).toContain(
      "- 2026-11-11 · listening · sketch sk-7: Bar 2 lands on [[deg:7]]",
    );
  });

  test.each(["tool", "direct"] as const)(
    "a review through the %s channel: validated, emitted once, stored, noted",
    async (channel) => {
      const ports = makePorts();
      const capstone = { subjectKind: "capstone", subjectId: "C2" } as const;
      ports.lessons.reviews.set("capstone:C2", REVIEW_SOURCE);
      const backend = new ScriptedBackend(channel === "tool" ? "anthropic-api" : "claude-cli");
      backend.channel = channel;
      backend.deliveries = [
        { ...CAPSTONE_REVIEW, strengths: [...CAPSTONE_REVIEW.strengths, ...CAPSTONE_REVIEW.strengths] },
        CAPSTONE_REVIEW,
      ];
      const events: TutorEvent[] = [];
      const prep = await prepareTurn({ thread: capstone, kind: "review-capstone", userText: "" }, ports);
      const result = await runReview(prep, backend, (e) => events.push(e), never, ports);

      expect(result).toMatchObject({ ok: true, review: CAPSTONE_REVIEW });
      expect(events.filter((e) => e.type === "review")).toEqual([
        { type: "review", data: { reviewKind: "capstone", review: CAPSTONE_REVIEW } },
      ]);
      expect(events[0]?.type).toBe("meta");
      expect(events.at(-1)?.type).toBe("done");
      const entries = await ports.conversations.entries("capstone:C2:2026-11-11:review");
      expect(entries[1]).toMatchObject({
        role: "assistant",
        review: CAPSTONE_REVIEW,
        summary: "review of C2 submitted: revision 'Land the ending on the tonic'",
      });
      expect(ports.notes.notes[0]).toMatchObject({ source: "review", subjectId: "C2" });
      expect(ports.usage.rows.length).toBeGreaterThan(0);

      // The chat conversation of the capstone is told, once.
      const chat = await prepareTurn(
        { thread: capstone, kind: "chat", userText: "About that review" },
        ports,
      );
      expect(chat.user.oakContext).toContain(
        "handoff: review of C2 submitted: revision 'Land the ending on the tonic'",
      );
      // Review tryCode is preview-only before the first release.
      expect(prep.ctx.apply).toBe("preview_only");
    },
  );

  test("a review that never validates fails; nothing is invented and the caller falls back", async () => {
    const ports = makePorts();
    ports.lessons.reviews.set("capstone:C2", REVIEW_SOURCE);
    const backend = new ScriptedBackend("claude-cli");
    backend.channel = "direct";
    backend.deliveries = [
      {},
      { ...CAPSTONE_REVIEW, strengths: [...CAPSTONE_REVIEW.strengths, ...CAPSTONE_REVIEW.strengths] },
      CAPSTONE_REVIEW,
    ];
    const events: TutorEvent[] = [];
    const prep = await prepareTurn(
      { thread: { subjectKind: "capstone", subjectId: "C2" }, kind: "review-capstone", userText: "" },
      ports,
    );
    const result = await runReview(prep, backend, (e) => events.push(e), never, ports);
    expect(result).toMatchObject({ ok: false, review: null, error: { kind: "iteration_limit" } });
    expect(events.some((e) => e.type === "review")).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: "error", data: { kind: "iteration_limit" } });
    expect(ports.notes.notes).toEqual([]);
    expect(await ports.conversations.entries("capstone:C2:2026-11-11:review")).toEqual([]);
  });

  test("there must be something to review", async () => {
    const ports = makePorts();
    const p = prepareTurn(
      { thread: { subjectKind: "capstone", subjectId: "C9" }, kind: "review-capstone", userText: "" },
      ports,
    );
    await expect(p).rejects.toMatchObject({ kind: "bad_request" });
  });
});
