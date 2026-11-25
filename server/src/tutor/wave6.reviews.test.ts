// Recorded-response tests for the Wave 6 capstone reviews: C6 "Modal Vamp", C7 "Chromatic Colour", CF-A "Album
// Single" and CF-T "Standard Transcription", each replayed as an API cassette through the composed server over HTTP.
// They check what was sent (high effort; the analysed facts each review needs: mode and characteristic tone per
// section, applied and borrowed chords with their bars and resolutions, the key plan, the device list, form, length,
// per-stage transcription accuracy; the try-it key and form rules), what came back (two revisions each, no verdict;
// CF-A's three strengths with the strongest first and one listening question) and where it was stored.
// Then d2: a review whose try-it is in another key, whose arrange() joins inline patterns, or whose prose uses a
// term the learner has not met is refused with its problem and repaired once; a second defective one is not stored.
import { afterEach, describe, expect, test } from "bun:test";
import { terms as COURSE_TERMS } from "../../../content/terms.ts";
import { chunkJson, response, textBlock, toolUseBlock } from "./backends/api/cassettes/builders.ts";
import type { WireRequest } from "./backends/api/cassettes/fake-fetch.ts";
import { cassette } from "./backends/api/cassettes/scenarios.ts";
import type { ReviewSource } from "./domain.ts";
import {
  type CapstoneReview,
  reviewRulesOf,
  revisionCountFor,
  strengthsWantedFor,
  VERDICT,
  validateCapstoneReview,
} from "./reviews.ts";
import type { AcceptedReview } from "./service-types.ts";
import { CASSETTE_KEY, type Composed, startComposed } from "./testing/composed.ts";
import { type FakePorts, makePorts } from "./testing/fakes.ts";
import {
  C6_REVIEW,
  C6_SOURCE,
  C7_REVIEW,
  C7_SOURCE,
  CFA_REVIEW,
  CFA_SOURCE,
  CFT_REVIEW,
  CFT_SECRETS,
  CFT_SOURCE,
} from "./testing/wave6-fixtures.ts";

let c: Composed | undefined;
afterEach(() => {
  c?.stop();
  c = undefined;
});

const userText = (w: WireRequest | undefined) =>
  JSON.stringify(
    (w?.body.messages as { role: string }[] | undefined)?.filter((m) => m.role === "user") ?? [],
  );

/** Every term a learner at the end of the core has met (the core units' glossary, U00–U17). */
const CORE_TERMS = COURSE_TERMS.filter((t) => /^U\d\d\./.test(t.introducedBy)).map((t) => t.id as string);

interface Case {
  id: "C6" | "C7" | "CF-A" | "CF-T";
  source: ReviewSource;
  review: CapstoneReview;
  /** Context lines the review must have been given. */
  lines: string[];
  /** What the learner typed; empty: the review asks with the learner's own note. */
  userText?: string;
  /** Strings no request may carry. */
  never?: readonly string[];
}

const CASES: Case[] = [
  {
    id: "C6",
    source: C6_SOURCE,
    review: C6_REVIEW,
    lines: [
      "revisions_wanted: 2",
      "facts: key D dorian · meter 4/4 · 16 bars · pickup no",
      "mode Head (bars 1-8): D dorian · characteristic tone 6 (la) sounds 8 times, 6 on a strong beat · notes fit dorian · 0 notes outside the mode · home chord in 50% of bars",
      "mode Solo (bars 9-16): D dorian · characteristic tone 6 (la) sounds 8 times, 6 on a strong beat",
      "contrast Head vs Solo: pitch (1 of 7 axes)",
      "try_code_key: D dorian · every tryCode is written in this key",
      "try_code_form: this piece is in sections",
    ],
  },
  {
    id: "C7",
    source: C7_SOURCE,
    review: C7_REVIEW,
    lines: [
      "revisions_wanted: 2",
      "applied: D7 (V7/V) bars 3, 7 · leans into V · resolves there · read in C major",
      "borrowed: A♭ (bVI) bar 14 · goes to bVII · read in C major",
      "borrowed: B♭ (bVII) bar 15 · goes to I · read in C major",
      "key_plan: C major bars 1-16 · D major bars 17-24 · numerals above are read in the key in force at each bar",
      "key_change: bar 17 · C major to D major · up 2 half steps (a whole step)",
      "devices: 3 of the six core devices (secondary dominant, borrowed chord, modulation)",
      "try_code_key: C major, then D major · every tryCode is written in the key of the bars it is for",
    ],
  },
  {
    id: "CF-A",
    source: CFA_SOURCE,
    review: CFA_REVIEW,
    userText: "",
    lines: [
      "revisions_wanted: 2",
      "strengths_wanted: up to 3 · the first names what is strongest in this song, in the learner's own bars",
      "form: Verse Chorus Verse Chorus Bridge Chorus Chorus 2 (ABABCBB); section bars count from the first full bar",
      "length: 2:14 (134 s) · 56 bars",
      "devices: 5 of the six core devices (secondary dominant, borrowed chord, modulation, suspension, syncopated bass) · not found: modal colour",
      "applied: E7 (V7/vi) bars 11, 27, 43 · leans into vi · resolves there · read in C major",
      "borrowed: Fm (iv) bar 33 · goes to I · read in C major",
      "key_change: bar 49 · C major to D major · up 2 half steps (a whole step)",
    ],
  },
  {
    id: "CF-T",
    source: CFT_SOURCE,
    review: CFT_REVIEW,
    lines: [
      "revisions_wanted: 2",
      "form: A A B A (AABA)",
      "check form: form · the whole tune · best 100% · mark 100% · passed",
      "check bass-4: bass · phrase 4 · best 100% · mark 90% · passed",
      "check changes-3: chords · phrase 3 · best 75% · mark 85% · open",
      "check melody-1: melody · phrase 1 · not checked yet · mark 90% · locked until the checks before it pass",
    ],
    never: [...CFT_SECRETS, "reference:"],
  },
];

function capstonePorts(k: Pick<Case, "id" | "source">): FakePorts {
  const ports = makePorts();
  ports.lessons.reviews.set(`capstone:${k.id}`, k.source);
  ports.progress.terms = { count: CORE_TERMS.length, recent: CORE_TERMS.slice(-30), all: CORE_TERMS };
  return ports;
}

const rulesFor = (k: Pick<Case, "id" | "source">) =>
  reviewRulesOf(k.source, { count: CORE_TERMS.length, recent: [], all: CORE_TERMS }, k.id);

describe.each(CASES)("$id review", (k) => {
  test("high effort, the facts it needs in the context, two revisions, accepted and stored on the version", async () => {
    expect(revisionCountFor(k.id)).toBe(2);
    expect(validateCapstoneReview(k.review, rulesFor(k))).toEqual({ ok: true, value: k.review });
    const stored: AcceptedReview[] = [];
    const ports = capstonePorts(k);
    const tag = k.id.replace("-", "").toLowerCase();
    c = startComposed({
      apiKey: CASSETTE_KEY,
      ports,
      cassette: cassette(
        `${tag}-review`,
        response(
          `msg_${tag}1`,
          [toolUseBlock(0, `toolu_${tag}1`, "submit_capstone_review", chunkJson(k.review, 40))],
          "tool_use",
          { usage: { input: 1_400, cacheWrite1h: 6_000 }, output: 900 },
        ),
        response(`msg_${tag}2`, [textBlock(0, ["Done."])], "end_turn"),
      ),
      over: { onReview: (r) => void stored.push(r) },
    });
    const res = await c.sse("/api/tutor/reviews/capstone", {
      thread: { subjectKind: "capstone", subjectId: k.id },
      userText: k.userText ?? "What would make it better?",
      albumTrackId: `trk-${tag}`,
      albumVersion: 1,
    });
    expect(res.events.at(-1)).toBe("done");
    expect(c.wire[0]?.body.output_config).toEqual({ effort: "high" });
    const sent = userText(c.wire[0]);
    for (const line of k.lines) expect(sent).toContain(line);
    if (k.userText === "") expect(sent).toContain(k.source.learnerNote as string);
    // The rules every review is held to, said before it is written (d2).
    expect(sent).toContain("review_terms: prose uses only course terms the learner has met");
    for (const secret of k.never ?? []) {
      expect(JSON.stringify(c.wire.map((w) => w.body))).not.toContain(secret);
      expect(res.raw).not.toContain(secret);
    }

    expect(res.frames.find((f) => f.event === "review")?.data).toEqual({
      reviewKind: "capstone",
      review: k.review,
    });
    expect(k.review.revisions).toHaveLength(2);
    expect(VERDICT.test(JSON.stringify(k.review))).toBe(false);
    expect(stored[0]).toMatchObject({
      reviewKind: "capstone",
      target: { kind: "album", trackId: `trk-${tag}`, version: 1 },
    });
    expect(ports.notes.notes.map((n) => n.source)).toEqual(["review"]);
    expect(ports.usage.rows.map((r) => r.lane)).toEqual(["review"]);
  });
});

describe("CF-A: the longest review the tutor writes", () => {
  test("three strengths, the strongest first and anchored to the learner's own bars; one listening question", () => {
    expect(strengthsWantedFor("CF-A")).toBe(3);
    for (const id of ["C5", "C6", "C7", "CF-T", "X2"]) expect(strengthsWantedFor(id)).toBeUndefined();
    expect(CFA_REVIEW.strengths).toHaveLength(3);
    // The first strength is the bridge the learner's note asked about, anchored to its bars (Bridge: bars 33-40).
    expect(CFA_REVIEW.strengths[0]?.bars).toEqual([33, 40]);
    expect(CFA_REVIEW.strengths[0]?.text).toMatch(/strongest/);
    expect(CFA_REVIEW.listeningQuestion.match(/\?/g)).toHaveLength(1);
    const words = (r: CapstoneReview) => JSON.stringify(r).split(/\s+/).length;
    for (const other of [C6_REVIEW, C7_REVIEW, CFT_REVIEW])
      expect(words(CFA_REVIEW)).toBeGreaterThan(words(other));
  });

  test("a CF-A review with four strengths is refused with its problem and repaired once", async () => {
    const four = { ...CFA_REVIEW, strengths: [...CFA_REVIEW.strengths, CFA_REVIEW.strengths[0]] };
    expect(validateCapstoneReview(four, rulesFor({ id: "CF-A", source: CFA_SOURCE }))).toMatchObject({
      ok: false,
      problems: ["strengths: need 0 to 3, got 4"],
    });
    // A source without the field still asks for up to three, by the capstone's id.
    const { strengthsWanted: _drop, ...bare } = CFA_SOURCE;
    const ports = capstonePorts({ id: "CF-A", source: bare });
    c = startComposed({
      apiKey: CASSETTE_KEY,
      ports,
      cassette: cassette(
        "cfa-four-strengths",
        response(
          "msg_t1",
          [toolUseBlock(0, "toolu_t1", "submit_capstone_review", chunkJson(four, 40))],
          "tool_use",
        ),
        response(
          "msg_t2",
          [toolUseBlock(0, "toolu_t2", "submit_capstone_review", chunkJson(CFA_REVIEW, 40))],
          "tool_use",
        ),
        response("msg_t3", [textBlock(0, ["Delivered."])], "end_turn"),
      ),
    });
    const res = await c.sse("/api/tutor/reviews/capstone", {
      thread: { subjectKind: "capstone", subjectId: "CF-A" },
    });
    expect(userText(c.wire[0])).toContain("strengths_wanted: up to 3");
    expect(userText(c.wire[1])).toContain("strengths: need 0 to 3, got 4");
    expect(res.events.filter((e) => e === "review")).toHaveLength(1);
    expect(res.frames.find((f) => f.event === "review")?.data).toEqual({
      reviewKind: "capstone",
      review: CFA_REVIEW,
    });
  });
});

// --- d2: the review lint, recorded ---------------------------------------------------------------------------------

const withRevision = (r: CapstoneReview, i: number, over: Partial<CapstoneReview["revisions"][number]>) => ({
  ...r,
  revisions: r.revisions.map((rev, j) => (j === i ? { ...rev, ...over } : rev)),
});

const DEFECTS: { name: string; bad: CapstoneReview; problem: string }[] = [
  {
    name: "a try-it in F for a piece in C (the live C5 defect)",
    bad: withRevision(C7_REVIEW, 0, {
      tryCode: 'bass: n("<[3 ~ 3 4] [4 ~ 4 0]>").scale("F2:major").s("ebass")',
    }),
    problem:
      "revisions[0].tryCode: written in F major (its .scale()); the piece is in C major or D major: write the try-it in C major or D major",
  },
  {
    name: "a try-it in another key by its chords",
    bad: withRevision(C6_REVIEW, 1, { tryCode: 'chords: chord("<Bb F Gm C>").voicing().s("rhodes")' }),
    problem: "revisions[1].tryCode:",
  },
  {
    name: "arrange() over inline patterns",
    bad: withRevision(C7_REVIEW, 0, {
      tryCode: 'bass: arrange([8, n("<0 5 1 4>")], [8, n("<3 4 0 5>")]).scale("C2:major").s("ebass")',
    }),
    problem: "revisions[0].tryCode: arrange() joins section consts",
  },
  {
    name: 'prose with "perfect authentic cadence"',
    bad: withRevision(C7_REVIEW, 1, {
      why: "Bar 16 closes on a perfect authentic cadence, so bar 17 arrives with no warning. One beat of A7 would lean into D.",
    }),
    problem: "is not a term this course uses: say",
  },
];

describe.each(DEFECTS)("d2: $name", ({ bad, problem }) => {
  const id = bad === DEFECTS[1]?.bad ? "C6" : "C7";
  const source = id === "C6" ? C6_SOURCE : C7_SOURCE;
  const good = id === "C6" ? C6_REVIEW : C7_REVIEW;

  test("refused with the problem, repaired once, and only the repaired review is stored", async () => {
    const v = validateCapstoneReview(bad, rulesFor({ id, source }));
    expect(v.ok).toBe(false);
    expect(JSON.stringify(v)).toContain(problem);
    const stored: AcceptedReview[] = [];
    c = startComposed({
      apiKey: CASSETTE_KEY,
      ports: capstonePorts({ id, source }),
      cassette: cassette(
        "d2-repair",
        response(
          "msg_r1",
          [toolUseBlock(0, "toolu_r1", "submit_capstone_review", chunkJson(bad, 40))],
          "tool_use",
        ),
        response(
          "msg_r2",
          [toolUseBlock(0, "toolu_r2", "submit_capstone_review", chunkJson(good, 40))],
          "tool_use",
        ),
        response("msg_r3", [textBlock(0, ["Delivered."])], "end_turn"),
      ),
      over: { onReview: (r) => void stored.push(r) },
    });
    const res = await c.sse("/api/tutor/reviews/capstone", {
      thread: { subjectKind: "capstone", subjectId: id },
    });
    // The model reads the problem in the tool result of its first submission.
    expect(userText(c.wire[1])).toContain(problem);
    expect(res.events.filter((e) => e === "review")).toHaveLength(1);
    expect(res.frames.find((f) => f.event === "review")?.data).toEqual({
      reviewKind: "capstone",
      review: good,
    });
    expect(stored).toHaveLength(1);
  });

  test("asked once only: a second defective review is not accepted and nothing is stored", async () => {
    const stored: AcceptedReview[] = [];
    c = startComposed({
      apiKey: CASSETTE_KEY,
      ports: capstonePorts({ id, source }),
      cassette: cassette(
        "d2-twice",
        response(
          "msg_b1",
          [toolUseBlock(0, "toolu_b1", "submit_capstone_review", chunkJson(bad, 40))],
          "tool_use",
        ),
        response(
          "msg_b2",
          [toolUseBlock(0, "toolu_b2", "submit_capstone_review", chunkJson(bad, 40))],
          "tool_use",
        ),
        response("msg_b3", [textBlock(0, ["I could not fix it."])], "end_turn"),
      ),
      over: { onReview: (r) => void stored.push(r) },
    });
    const res = await c.sse("/api/tutor/reviews/capstone", {
      thread: { subjectKind: "capstone", subjectId: id },
    });
    expect(res.events).not.toContain("review");
    expect(stored).toEqual([]);
  });
});

describe("d2: the review context states the piece's key, the section-const form and the vocabulary rule", () => {
  test("C7 is told both keys of its plan; a piece without sections is told about labelled tracks", async () => {
    const plain = { ...C6_SOURCE, facts: C6_SOURCE.facts ? { ...C6_SOURCE.facts, form: null } : null };
    c = startComposed({
      apiKey: CASSETTE_KEY,
      ports: capstonePorts({ id: "C6", source: plain }),
      cassette: cassette(
        "d2-context",
        response(
          "msg_x1",
          [toolUseBlock(0, "toolu_x1", "submit_capstone_review", chunkJson(C6_REVIEW, 40))],
          "tool_use",
        ),
        response("msg_x2", [textBlock(0, ["Done."])], "end_turn"),
      ),
    });
    await c.sse("/api/tutor/reviews/capstone", { thread: { subjectKind: "capstone", subjectId: "C6" } });
    const sent = userText(c.wire[0]);
    expect(sent).toContain("try_code_key: D dorian");
    expect(sent).toContain("try_code_form: a tryCode is a few labelled tracks");
    // The persona (system prompt) carries the same three rules.
    const system = JSON.stringify(c.wire[0]?.body.system);
    expect(system).toContain("Every `tryCode` is written in the piece's key");
    expect(system).toContain("perfect authentic cadence");
  });
});
