import { describe, expect, test } from "bun:test";
import type { Rung } from "../domain.ts";
import type { TutorEvent } from "../events.ts";
import { prepareTurn } from "../prepare.ts";
import { findLeaks, forbiddenKeys, leakMarkers } from "../redaction.ts";
import { type FakePorts, makePorts, type Overrides, override } from "../testing/fakes.ts";
import {
  CAPSTONE_REVIEW,
  EXERCISE_REF,
  GRADE,
  LEARNER_CODE,
  LESSON_ID,
  MAKE_STEP_ID,
  REVIEW_SOURCE,
  SOLUTION_CODE,
  STEP,
  STEP_ID,
  TRANSCRIPTION_REVIEW,
} from "../testing/fixtures.ts";
import type { SubjectKind, TurnRequest } from "../types.ts";
import { createToolSession } from "./execute.ts";
import { applyCard, applyPolicyFor, applyStateFor } from "./propose.ts";

const RUNGS: Rung[] = [0, 1, 2, 3, 4];
const never = new AbortController().signal;

async function harness(
  opts: {
    rung?: Rung;
    passed?: boolean;
    request?: Overrides<TurnRequest>;
    setup?: (p: FakePorts) => void;
  } = {},
) {
  const ports = makePorts();
  ports.progress.set(STEP_ID, {
    rung: opts.rung ?? 0,
    passed: opts.passed ?? false,
    matchedMistakes: ["melody.degree-off-by-one"],
  });
  opts.setup?.(ports);
  const base: TurnRequest = {
    thread: { subjectKind: "lesson", subjectId: LESSON_ID },
    kind: "chat",
    userText: "help",
    learnerCode: LEARNER_CODE,
    stepId: STEP_ID,
  };
  const prep = await prepareTurn(override(base, opts.request ?? {}), ports);
  const events: TutorEvent[] = [];
  const session = createToolSession({ ctx: prep.ctx, ports, emit: (e) => events.push(e) });
  let n = 0;
  const call = async (name: string, input: unknown, signal: AbortSignal = never) => {
    const res = await session.execute({ id: `tu_${++n}`, name, input }, signal);
    // biome-ignore lint/suspicious/noExplicitAny: tool results are probed loosely in these tests
    return { ...res, json: JSON.parse(res.content) as Record<string, any> };
  };
  return { ports, prep, session, events, call };
}

const card = (code: string, over: object = {}) => ({
  kind: "example",
  title: "Try this",
  code,
  explanation: "Listen to the top note.",
  bars: 4,
  ...over,
});
const GOOD = 'mel: n("0 2 4").scale("C4:major")';

describe("dispatch", () => {
  test("every call emits tool_start then tool_result, with a summary that carries no content", async () => {
    const h = await harness();
    await h.call("get_learner_progress", {});
    expect(h.events).toEqual([
      { type: "tool_start", data: { toolUseId: "tu_1", name: "get_learner_progress" } },
      {
        type: "tool_result",
        data: { toolUseId: "tu_1", name: "get_learner_progress", ok: true, summary: "progress" },
      },
    ]);
  });

  test("a backend that announced the call itself does not get a second tool_start", async () => {
    const h = await harness();
    h.session.markStarted("tu_1");
    await h.call("get_learner_progress", {});
    expect(h.events.map((e) => e.type)).toEqual(["tool_result"]);
  });

  test("an unknown tool is an error result, not a crash", async () => {
    const h = await harness();
    const r = await h.call("read_file", { path: "/etc/hosts" });
    expect(r.isError).toBe(true);
    expect(r.json).toEqual({ error: "UNKNOWN_TOOL" });
  });

  test.each([
    [
      "missing field (a truncated eager input)",
      "propose_code",
      { kind: "hint", title: "t", code: GOOD, explanation: "e" },
    ],
    ["extra field", "evaluate_strudel", { code: GOOD, from_bar: 1, bars: 4, key: null, rung: 4 }],
    ["wrong type", "evaluate_strudel", { code: GOOD, from_bar: "1", bars: 4, key: null }],
    ["non-integer bars", "evaluate_strudel", { code: GOOD, from_bar: 1, bars: 2.5, key: null }],
    ["empty code", "evaluate_strudel", { code: "", from_bar: 1, bars: 4, key: null }],
    ["oversized code", "evaluate_strudel", { code: "x".repeat(8_001), from_bar: 1, bars: 4, key: null }],
    [
      "bad enum",
      "compare_haps",
      { learner_code: null, target: { kind: "solution", ref: "x" }, from_bar: 1, bars: 1, mode: "auto" },
    ],
    ["not an object", "get_lesson_context", "U03.L02"],
    ["null", "get_learner_progress", null],
    ["arguments for a tool without any", "get_learner_progress", { verbose: true }],
  ])("invalid input: %s", async (_name, tool, input) => {
    const h = await harness();
    const r = await h.call(tool, input);
    expect(r.isError).toBe(true);
    expect(r.json.error).toBe("INVALID_JSON");
    expect(r.json.issues.length).toBeGreaterThan(0);
    expect(h.ports.grader.evaluated).toEqual([]);
    expect(h.events.at(-1)).toMatchObject({
      type: "tool_result",
      data: { ok: false, summary: "invalid input" },
    });
  });

  test("a port that throws becomes TOOL_FAILED without its message", async () => {
    const h = await harness();
    h.ports.progress.snapshot = async () => {
      throw new Error("SQLITE_BUSY: secret path /Users/x/.oak/oak.db");
    };
    const r = await h.call("get_learner_progress", {});
    expect(r.isError).toBe(true);
    expect(r.content).toBe('{"error":"TOOL_FAILED"}');
  });

  test("an aborted turn runs nothing", async () => {
    const h = await harness();
    const ac = new AbortController();
    ac.abort();
    const r = await h.call("evaluate_strudel", { code: GOOD, from_bar: 1, bars: 4, key: null }, ac.signal);
    expect(r.json).toEqual({ error: "ABORTED" });
    expect(h.ports.grader.evaluated).toEqual([]);
  });
});

describe("evaluate_strudel", () => {
  test("returns the contract's shape and clamps the window", async () => {
    const h = await harness();
    const r = await h.call("evaluate_strudel", { code: GOOD, from_bar: -3, bars: 99, key: "C major" });
    expect(r.isError).toBe(false);
    expect(h.ports.grader.evaluated).toEqual([
      { code: GOOD, fromBar: 1, bars: 16, key: "C major", origin: "tutor" },
    ]);
    expect(Object.keys(r.json)).toEqual(["ok", "error", "tempo", "tracks", "warnings", "locked_tools"]);
    expect(r.json.tracks[0]).toMatchObject({ label: "mel", total_events: 48 });
    expect(r.json.tracks[0].events[0]).toEqual({
      bar: 1,
      beat: 1,
      dur_beats: 4 / 3,
      pitch: "C4",
      degree: "1",
      sound: null,
      chord: null,
    });
  });

  test("at most 64 events per track, with the true total", async () => {
    const h = await harness();
    const r = await h.call("evaluate_strudel", {
      code: 'd: s("hh*8 hh hh hh hh hh hh hh")',
      from_bar: 1,
      bars: 16,
      key: null,
    });
    expect(r.json.tracks[0].events).toHaveLength(64);
    expect(r.json.tracks[0].total_events).toBe(128);
  });

  test("code that fails the strict lint is data (ok: false) and is never evaluated", async () => {
    const h = await harness();
    const r = await h.call("evaluate_strudel", {
      code: '(() => 0).constructor("return process")()',
      from_bar: 1,
      bars: 1,
      key: null,
    });
    expect(r.isError).toBe(false);
    expect(r.json.ok).toBe(false);
    expect(r.json.error.kind).toBe("lint");
    expect(r.json.warnings).toContain("lint.base.member");
    expect(h.ports.grader.evaluated).toEqual([]);
  });

  test("an evaluation failure is data too", async () => {
    const h = await harness();
    const r = await h.call("evaluate_strudel", { code: "nonsense()", from_bar: 1, bars: 1, key: null });
    expect(r.isError).toBe(false);
    expect(r.json).toMatchObject({ ok: false, error: { kind: "eval" } });
  });
});

describe("get_learner_progress", () => {
  test("returns the contract's shape with its size caps", async () => {
    const h = await harness({
      setup: (p) => {
        p.progress.progress = {
          ...p.progress.progress,
          unlocked: { recent: Array.from({ length: 30 }, (_, i) => `tb.t${i}`), count: 30 },
          weakSkills: Array.from({ length: 9 }, (_, i) => ({ id: `S0${i}`, name: "n", strength: 0.1 })),
          recentFeedback: Array.from({ length: 14 }, (_, i) => ({ code: `melody.c${i}`, count: 1 })),
          families: Array.from({ length: 7 }, (_, i) => ({ id: `fam.deg.f${i}`, level: 1, confusions: [] })),
        };
      },
    });
    const { json } = await h.call("get_learner_progress", {});
    expect(Object.keys(json)).toEqual([
      "current",
      "unlocked",
      "weak_skills",
      "debts",
      "recent_feedback",
      "families",
      "streak_weeks",
      "sing_tolerance",
      "quiet",
    ]);
    expect(json.unlocked.recent).toHaveLength(20);
    expect(json.unlocked.count).toBe(30);
    expect(json.weak_skills).toHaveLength(5);
    expect(json.recent_feedback).toHaveLength(10);
    expect(json.families).toHaveLength(5);
  });
});

describe("get_lesson_context and compare_haps: redacted by the server's rung", () => {
  test.each(RUNGS)("rung %i: nothing above the row's allowance in any tool result", async (rung) => {
    const h = await harness({ rung });
    const results = [
      await h.call("get_lesson_context", { lesson_id: LESSON_ID, step_id: STEP_ID }),
      await h.call("compare_haps", {
        learner_code: null,
        target: { kind: "exercise", ref: EXERCISE_REF },
        from_bar: 1,
        bars: 1,
        mode: "auto",
      }),
      await h.call("get_learner_progress", {}),
    ];
    const all = results.map((r) => r.content).join("\n");
    expect(findLeaks(all, leakMarkers(STEP, GRADE), rung)).toEqual([]);
    for (const key of forbiddenKeys(rung)) expect(all).not.toContain(key);
    const [ctx, cmp] = results;
    if (!ctx || !cmp) throw new Error("missing results");
    // Positive controls: what the rung does allow is there.
    expect(ctx.json.step.rung).toBe(rung);
    expect(ctx.json.step.solution).toBe(rung >= 4 ? SOLUTION_CODE : null);
    expect(ctx.json.step.hints_seen).toHaveLength(rung);
    expect(cmp.json).toMatchObject({
      ok: true,
      status: "fail",
      score: 0.67,
      counts: { missing: 0, extra: 0, wrong: 2 },
      redacted_to_rung: rung,
    });
    expect("what" in cmp.json.issues[0]).toBe(rung >= 2);
    expect("expected" in cmp.json.issues[0]).toBe(rung >= 3);
    expect("expected" in cmp.json.issues[1]).toBe(rung >= 4);
  });

  test("the level is read from the server at call time, not from the model's input", async () => {
    const h = await harness({ rung: 0 });
    // The model cannot pass a rung at all: strict input, unknown key refused.
    const sneaky = await h.call("get_lesson_context", { lesson_id: LESSON_ID, step_id: STEP_ID, rung: 4 });
    expect(sneaky.json.error).toBe("INVALID_JSON");
    // When the learner takes hint 4 in the UI mid-turn, the next call sees it.
    h.ports.progress.set(STEP_ID, { rung: 4 });
    const after = await h.call("get_lesson_context", { lesson_id: LESSON_ID, step_id: STEP_ID });
    expect(after.json.step.solution).toBe(SOLUTION_CODE);
  });

  test("a passed step is open", async () => {
    const h = await harness({ rung: 0, passed: true });
    const ctx = await h.call("get_lesson_context", { lesson_id: LESSON_ID, step_id: STEP_ID });
    expect(ctx.json.step.solution).toBe(SOLUTION_CODE);
  });

  test("the lesson alone, an unknown lesson, an unknown step", async () => {
    const h = await harness();
    expect((await h.call("get_lesson_context", { lesson_id: LESSON_ID, step_id: null })).json).toEqual({
      lesson: {
        id: LESSON_ID,
        title: "Scale degrees in code",
        objective: "Play an arpeggio that climbs to the octave and comes back.",
        key: "D dorian",
        meter: "4/4",
        bpm: 90,
      },
      step: null,
    });
    expect((await h.call("get_lesson_context", { lesson_id: "U99.L99", step_id: null })).json).toEqual({
      error: "UNKNOWN_LESSON",
    });
    expect(
      (await h.call("get_lesson_context", { lesson_id: LESSON_ID, step_id: "U03.L02/S77" })).json,
    ).toEqual({ error: "UNKNOWN_STEP" });
  });

  test("compare against code (the learner's or the tutor's own) is never redacted", async () => {
    const h = await harness({ rung: 0 });
    const r = await h.call("compare_haps", {
      learner_code: null,
      target: { kind: "code", ref: 'mel: n("0 2 4 5 4 1").scale("D4:dorian")' },
      from_bar: 1,
      bars: 1,
      mode: "melody",
    });
    expect(r.json.ok).toBe(true);
    expect(r.json.issues[0]).toMatchObject({ expected: "B4", got: "C5" });
    expect(r.json.redacted_to_rung).toBe(4);
  });

  test("the editor's code is the learner's; code from the model gets the strict lint", async () => {
    const h = await harness({
      request: { learnerCode: 'let x = 1\nmel: n("0 2 4 6 4 1").scale("D4:dorian")' },
    });
    const target = { kind: "exercise", ref: EXERCISE_REF };
    await h.call("compare_haps", { learner_code: null, target, from_bar: 1, bars: 1, mode: "auto" });
    expect(h.ports.grader.compared.at(-1)).toMatchObject({ learnerOrigin: "learner" });
    // Passed back verbatim it is still the learner's typing.
    await h.call("compare_haps", {
      learner_code: h.prep.ctx.learnerCode,
      target,
      from_bar: 1,
      bars: 1,
      mode: "auto",
    });
    expect(h.ports.grader.compared).toHaveLength(2);
    // Anything else is the model's code.
    const r = await h.call("compare_haps", {
      learner_code: "let y = fetch",
      target,
      from_bar: 1,
      bars: 1,
      mode: "auto",
    });
    expect(r.json).toMatchObject({ ok: false, error: { kind: "lint" } });
    const t = await h.call("compare_haps", {
      learner_code: null,
      target: { kind: "code", ref: "this.x" },
      from_bar: 1,
      bars: 1,
      mode: "auto",
    });
    expect(t.json).toMatchObject({ ok: false, error: { kind: "lint" } });
    expect(h.ports.grader.compared).toHaveLength(2);
  });

  test("no code in the editor, unknown exercise", async () => {
    const h = await harness({ request: { learnerCode: undefined } });
    const target = { kind: "exercise", ref: EXERCISE_REF };
    expect(
      (await h.call("compare_haps", { learner_code: null, target, from_bar: 1, bars: 1, mode: "auto" })).json
        .error.kind,
    ).toBe("no-code");
    const r = await h.call("compare_haps", {
      learner_code: GOOD,
      target: { kind: "exercise", ref: "U03.L02/nope" },
      from_bar: 1,
      bars: 1,
      mode: "auto",
    });
    expect(r.json.error.kind).toBe("unknown-exercise");
  });
});

describe("propose_code", () => {
  test("lint, then evaluate, then show: a valid card", async () => {
    const h = await harness({
      request: { thread: { subjectKind: "general", subjectId: "general" }, stepId: undefined },
    });
    const r = await h.call("propose_code", card(GOOD, { bars: 40 }));
    expect(r.json).toEqual({
      card_id: "card-1",
      shown: true,
      apply: "applicable",
      errors: [],
      locked_tools: [],
    });
    expect(h.ports.grader.evaluated).toEqual([
      { code: GOOD, fromBar: 1, bars: 4, key: null, origin: "tutor" },
    ]);
    const shown = h.events.find((e) => e.type === "card");
    expect(shown?.data).toEqual({
      cardId: "card-1",
      toolUseId: "tu_1",
      kind: "example",
      title: "Try this",
      code: GOOD,
      explanation: "Listen to the top note.",
      bars: 16,
      apply: "applicable",
      applyAllowed: true,
      lockedTools: [],
    });
    expect(h.session.cardIds).toEqual(["card-1"]);
    expect(h.events.map((e) => e.type)).toEqual(["tool_start", "card", "tool_result"]);
  });

  test.each([
    ["constructor escape", '(() => 0).constructor("return process")()'],
    ["computed access", 'mel: n("0")[k]'],
    ["fetch", 'fetch("/api/settings/anthropic-key")'],
    ["dynamic import", 'import("node:fs")'],
    ["does not parse", 'mel: n("0 2'],
  ])("a card that fails the strict lint is never evaluated and never shown: %s", async (_n, code) => {
    const h = await harness();
    const r = await h.call("propose_code", card(code));
    expect(r.isError).toBe(false);
    expect(r.json).toMatchObject({ card_id: null, shown: false });
    expect(r.json.errors.length).toBeGreaterThan(0);
    expect(h.ports.grader.evaluated).toEqual([]);
    expect(h.events.some((e) => e.type === "card")).toBe(false);
    expect(h.session.cardIds).toEqual([]);
  });

  test("a card that does not run, or is silent for 4 bars, is not shown; the model gets the errors", async () => {
    const h = await harness();
    const bad = await h.call("propose_code", card("nonsense()"));
    expect(bad.json).toMatchObject({ shown: false, errors: ["fake grader: no pattern it understands"] });
    const silent = await h.call("propose_code", card('mel: n("~ ~ ~ ~")'));
    expect(silent.json).toMatchObject({ shown: false, errors: ["the card is silent in its first 4 bars"] });
    expect(h.events.some((e) => e.type === "card")).toBe(false);
  });

  test.each([0, 1, 2, 3] as Rung[])("graded step at rung %i: preview only", async (rung) => {
    const h = await harness({ rung });
    const r = await h.call("propose_code", card(GOOD));
    expect(r.json).toMatchObject({ shown: true, apply: "preview_only" });
    expect(h.events.find((e) => e.type === "card")?.data).toMatchObject({
      apply: "preview_only",
      applyAllowed: false,
    });
  });

  test("graded step after hint 4, or once passed: applicable", async () => {
    expect((await (await harness({ rung: 4 })).call("propose_code", card(GOOD))).json.apply).toBe(
      "applicable",
    );
    expect(
      (await (await harness({ rung: 0, passed: true })).call("propose_code", card(GOOD))).json.apply,
    ).toBe("applicable");
  });

  test("a Make step is preview-only at every rung", async () => {
    for (const rung of RUNGS) {
      const h = await harness({
        request: { stepId: MAKE_STEP_ID },
        setup: (p) => p.progress.set(MAKE_STEP_ID, { rung }),
      });
      expect((await h.call("propose_code", card(GOOD))).json.apply).toBe("preview_only");
    }
  });

  test("a capstone is preview-only until the track's first release", async () => {
    const at = async (released: boolean) => {
      const h = await harness({
        request: { thread: { subjectKind: "capstone", subjectId: "C2" }, stepId: undefined },
        setup: (p) =>
          p.lessons.facts.set("capstone:C2", {
            tutorOpen: true,
            closedReason: null,
            title: "C2",
            released,
            transcriptionSource: null,
          }),
      });
      return (await h.call("propose_code", card(GOOD))).json.apply;
    };
    expect(await at(false)).toBe("preview_only");
    expect(await at(true)).toBe("applicable");
  });

  test("a locked tool: badged, and never Apply in a graded context", async () => {
    const locked = 'chords: n("0 2 4").scale("C4:major").voicing()';
    const graded = await harness({ rung: 4 });
    const g = await graded.call("propose_code", card(locked));
    expect(g.json).toMatchObject({ shown: true, apply: "preview_only", locked_tools: ["tb.voicing"] });
    expect(graded.events.find((e) => e.type === "card")?.data).toMatchObject({
      applyAllowed: false,
      lockedTools: ["tb.voicing"],
    });
    // In Studio the same card can be applied; the badge stays.
    const studio = await harness({
      request: { thread: { subjectKind: "sketch", subjectId: "sk-1" }, stepId: undefined },
    });
    const s = await studio.call("propose_code", card(locked));
    expect(s.json).toMatchObject({ shown: true, apply: "applicable", locked_tools: ["tb.voicing"] });
  });

  test("the model cannot ask for Apply: the input has no such field", async () => {
    const h = await harness({ rung: 0 });
    for (const extra of [
      { apply: "applicable" },
      { applyAllowed: true },
      { apply: "offer_replace_editor" },
    ]) {
      expect((await h.call("propose_code", { ...card(GOOD), ...extra })).json.error).toBe("INVALID_JSON");
    }
    expect(h.events.some((e) => e.type === "card")).toBe(false);
  });

  test("a hint shows at most one card; a listening note shows none", async () => {
    const hint = await harness({ request: { kind: "hint" } });
    expect((await hint.call("propose_code", card(GOOD))).json.shown).toBe(true);
    const second = await hint.call("propose_code", card(GOOD));
    expect(second.json).toMatchObject({
      shown: false,
      errors: ["this thread shows at most 1 card(s) per reply"],
    });
    expect(hint.events.filter((e) => e.type === "card")).toHaveLength(1);
    const note = await harness({ request: { kind: "listening" } });
    expect((await note.call("propose_code", card(GOOD))).json).toMatchObject({
      shown: false,
      errors: ["this thread shows no cards"],
    });
  });

  test("title and explanation cannot carry HTML", async () => {
    const h = await harness();
    await h.call(
      "propose_code",
      card(GOOD, {
        title: "Try <img src=x onerror=1>\nthis",
        explanation: "<script>x</script> and ![p](http://e/x.png)",
      }),
    );
    const data = h.events.find((e) => e.type === "card")?.data as { title: string; explanation: string };
    expect(data.title).toBe("Try &lt;img src=x onerror=1> this");
    expect(data.explanation).toBe("&lt;script>x&lt;/script> and p");
  });

  test("applying is checked on the server too", async () => {
    const h = await harness({ rung: 0 });
    await h.call("propose_code", card(GOOD));
    expect(await applyCard(h.ports.conversations, "card-1")).toBe("refused");
    expect((await h.ports.conversations.card("card-1"))?.applied).toBe(false);
    expect(await applyCard(h.ports.conversations, "card-404")).toBe("unknown");
    const open = await harness({ rung: 4 });
    await open.call("propose_code", card(GOOD));
    expect(await applyCard(open.ports.conversations, "card-1")).toBe("applied");
    expect((await open.ports.conversations.card("card-1"))?.applied).toBe(true);
  });
});

describe("apply policy: the table of contracts §10.7", () => {
  const facts = { released: null, transcriptionSource: null } as const;
  const policy = (subjectKind: SubjectKind, over: object = {}) =>
    applyPolicyFor({ subjectKind, facts, step: null, disclosure: 0, ...over });

  test("where a card appears decides its state", () => {
    expect(policy("general")).toEqual({ apply: "applicable", gradedContext: false });
    expect(policy("sketch")).toEqual({ apply: "applicable", gradedContext: false });
    expect(policy("lesson", { step: { grading: "graded" }, disclosure: 3 })).toEqual({
      apply: "preview_only",
      gradedContext: true,
    });
    expect(policy("lesson", { step: { grading: "graded" }, disclosure: 4 })).toEqual({
      apply: "applicable",
      gradedContext: true,
    });
    expect(policy("lesson", { step: { grading: "make" }, disclosure: 4 })).toEqual({
      apply: "preview_only",
      gradedContext: true,
    });
    expect(policy("lesson", { step: { grading: "ungraded" } })).toEqual({
      apply: "applicable",
      gradedContext: true,
    });
    expect(policy("lesson")).toEqual({ apply: "preview_only", gradedContext: true });
    expect(policy("capstone")).toEqual({ apply: "preview_only", gradedContext: true });
    expect(policy("capstone", { facts: { ...facts, released: true } })).toEqual({
      apply: "applicable",
      gradedContext: true,
    });
    expect(policy("track", { facts: { ...facts, released: true } }).apply).toBe("applicable");
    expect(policy("transcription", { facts: { ...facts, transcriptionSource: "own-audio" } })).toEqual({
      apply: "applicable",
      gradedContext: false,
    });
    expect(policy("transcription", { facts: { ...facts, transcriptionSource: "ladder" } }).apply).toBe(
      "preview_only",
    );
    expect(policy("checkpoint").apply).toBe("preview_only");
    expect(policy("drill").apply).toBe("preview_only");
  });

  test("locked tools take Apply away only in a graded context", () => {
    expect(applyStateFor({ apply: "applicable", gradedContext: true }, ["tb.voicing"])).toBe("preview_only");
    expect(applyStateFor({ apply: "applicable", gradedContext: false }, ["tb.voicing"])).toBe("applicable");
    expect(applyStateFor({ apply: "applicable", gradedContext: true }, [])).toBe("applicable");
    expect(applyStateFor({ apply: "preview_only", gradedContext: false }, [])).toBe("preview_only");
  });
});

describe("submit_*_review", () => {
  const review = (kind: "review-capstone" | "review-transcription" = "review-capstone") =>
    harness({
      request: {
        thread: { subjectKind: "capstone", subjectId: "C2" },
        kind,
        stepId: undefined,
        userText: "",
      },
      setup: (p) => p.lessons.reviews.set("capstone:C2", REVIEW_SOURCE),
    });

  test("outside a review conversation: accepted false", async () => {
    const h = await harness();
    const r = await h.call("submit_capstone_review", CAPSTONE_REVIEW);
    expect(r.isError).toBe(false);
    expect(r.json).toEqual({
      accepted: false,
      problems: ["reviews can only be submitted in a review conversation"],
    });
    expect(h.session.review).toBeUndefined();
  });

  test("a valid review is accepted once and emitted as a `review` event", async () => {
    const h = await review();
    const r = await h.call("submit_capstone_review", CAPSTONE_REVIEW);
    expect(r.json).toEqual({ accepted: true, problems: [] });
    expect(h.session.review).toEqual(CAPSTONE_REVIEW);
    expect(h.events.find((e) => e.type === "review")?.data).toEqual({
      reviewKind: "capstone",
      review: CAPSTONE_REVIEW,
    });
    // tryCode was run like a card.
    expect(h.ports.grader.evaluated.at(-1)).toMatchObject({ bars: 4, origin: "tutor" });
    expect((await h.call("submit_capstone_review", CAPSTONE_REVIEW)).json.problems).toEqual([
      "a review has already been accepted",
    ]);
  });

  test("the wrong review tool for the conversation", async () => {
    const h = await review("review-capstone");
    const r = await h.call("submit_transcription_review", TRANSCRIPTION_REVIEW);
    expect(r.json).toEqual({
      accepted: false,
      problems: ["this is a capstone review: use submit_capstone_review"],
    });
  });

  test("violations come back as problems; one resubmission, then no more", async () => {
    const h = await review();
    const tooLong = { ...CAPSTONE_REVIEW, linerNote: Array.from({ length: 61 }, () => "w").join(" ") };
    const first = await h.call("submit_capstone_review", tooLong);
    expect(first.json).toEqual({ accepted: false, problems: ["linerNote: 61 words, the limit is 60"] });
    const second = await h.call("submit_capstone_review", {
      ...CAPSTONE_REVIEW,
      strengths: [...CAPSTONE_REVIEW.strengths, ...CAPSTONE_REVIEW.strengths],
    });
    expect(second.json.accepted).toBe(false);
    const third = await h.call("submit_capstone_review", CAPSTONE_REVIEW);
    expect(third.json).toEqual({ accepted: false, problems: ["no resubmissions left"] });
    expect(h.session.review).toBeUndefined();
    expect(h.session.reviewSubmits).toBe(2);
    expect(h.events.some((e) => e.type === "review")).toBe(false);
  });

  test("tryCode that fails the lint is never run; tryCode that does not sound is refused", async () => {
    const h = await review();
    const rev = CAPSTONE_REVIEW.revisions[0];
    if (!rev) throw new Error("fixture");
    const evil = await h.call("submit_capstone_review", {
      ...CAPSTONE_REVIEW,
      revisions: [{ ...rev, tryCode: "globalThis.x" }],
    });
    expect(evil.json.accepted).toBe(false);
    expect(evil.json.problems[0]).toContain("lint.base.identifier");
    expect(h.ports.grader.evaluated).toEqual([]);
    const silent = await h.call("submit_capstone_review", {
      ...CAPSTONE_REVIEW,
      revisions: [{ ...rev, tryCode: 'mel: n("~ ~")' }],
    });
    expect(silent.json.problems).toEqual(["revisions[0].tryCode: silent in its first 4 bars"]);
  });

  test("the revision count comes from the server's review source", async () => {
    const h = await harness({
      request: {
        thread: { subjectKind: "capstone", subjectId: "C5" },
        kind: "review-capstone",
        stepId: undefined,
        userText: "",
      },
      setup: (p) => p.lessons.reviews.set("capstone:C5", { ...REVIEW_SOURCE, revisions: 2 }),
    });
    expect((await h.call("submit_capstone_review", CAPSTONE_REVIEW)).json.problems).toEqual([
      "revisions: need exactly 2, got 1",
    ]);
  });

  test("prose fields are sanitized on acceptance", async () => {
    const h = await review();
    await h.call("submit_capstone_review", {
      ...CAPSTONE_REVIEW,
      linerNote: "A groove <b>in</b> D dorian with a steady pulse.",
    });
    expect((h.session.review as typeof CAPSTONE_REVIEW).linerNote).toBe(
      "A groove &lt;b>in&lt;/b> D dorian with a steady pulse.",
    );
  });
});
