// The scripted fake tutor backend for Wave 2 UI work and e2e (docs/design/wave2.md §5). It implements the
// tutor's `TutorBackend` interface (server/src/tutor, read-only) and never calls a model: it streams canned,
// realistic events with small delays so streaming UI, cards, tool calls, reviews, errors and Stop are all
// exercised. It exists only when `OAK_DEV=1` and `OAK_TUTOR_FAKE=1` (config.ts `tutorFake`); production can
// never select it.
//
// What it answers is chosen by the request kind and by markers in the learner's text (`FAKE_TUTOR_MARKERS`).
// Everything else (threads, rung advance, redaction, card lint and validation, review validation, the SSE
// framing, `meta`/`done`/`error`) is the real tutor service: only the model is replaced.
import {
  type BackendTurn,
  callUsage,
  type Emit,
  errorInfo,
  type StructuredTurn,
  TUTOR_ERROR_KINDS,
  type TurnOutcome,
  type TutorBackend,
  TutorError,
  type TutorErrorKind,
  type UsageSummary,
} from "../tutor/index.ts";

/** Markers a learner message may contain (case-insensitive). Several may be combined. */
export const FAKE_TUTOR_MARKERS = {
  "#card": "adds a propose_code card (a 4-bar C-major idea; Oak lints and runs it, then decides Apply)",
  "#tool": "calls get_learner_progress first (tool_start + tool_result events)",
  "#think": "streams thinking deltas before the answer",
  "#slow": "streams one word every 250 ms for about 20 s: use it to test Stop / cancel",
  "#error": "ends in an error event of kind rate_limit; `#error:<kind>` picks any TutorErrorKind",
  "#reveal": "answers with one sentence and the [[reveal]] token (the Reveal (hint 4) button)",
  "#long": "a long markdown answer using every music token kind",
  "#empty": "an answer with no text at all (only done)",
  "#sections":
    "an answer that names the piece's sections (verse, chorus) and a bar range, so e2e can see section chips stream on a subject with arrange() sections",
  "#echo":
    "a worst-case model: calls get_lesson_context for the step on screen and repeats everything it was given (the oak_context and the tool result) in its answer, so a test can prove what the model could ever say at each rung",
} as const;
export type FakeTutorMarker = keyof typeof FAKE_TUTOR_MARKERS;

export interface FakeTutorOptions {
  /** Milliseconds between streamed chunks (default 40). Tests pass 0. */
  delayMs?: number;
  /** Milliseconds between words of a `#slow` stream (default 250). */
  slowDelayMs?: number;
  /** Words of a `#slow` stream (default 80). */
  slowWords?: number;
}

/**
 * A four-bar idea in Oak's dialect (STYLE: labelled parts, bass before melody, a tempo line), checked with headless
 * Strudel: the bass walks C2 F2 G2 C2 (1 4 5 1) and the melody outlines each chord — C E G E, F A C A, G B D B —
 * then falls C5 G4 E4 C4 home.
 */
export const FAKE_CARD_CODE = [
  "setcpm(90/4)",
  "",
  'bass: note("<c2 f2 g2 c2>").s("ebass")',
  'mel: n("<[0 2 4 2] [3 5 7 5] [4 6 8 6] [7 4 2 0]>").scale("C4:major").s("piano")',
].join("\n");

export const FAKE_REVIEW_ANSWER =
  "Loop bars 1 to 4 and then the last bar, and listen for which one feels more settled when the loop comes round.";

const WIRE = {
  input_tokens: 120,
  output_tokens: 60,
  cache_read_input_tokens: 1_200,
  cache_creation_input_tokens: 0,
};

/** Which markers a text carries. */
export function markersIn(text: string): Set<FakeTutorMarker> {
  const lower = text.toLowerCase();
  const out = new Set<FakeTutorMarker>();
  for (const m of Object.keys(FAKE_TUTOR_MARKERS) as FakeTutorMarker[]) if (lower.includes(m)) out.add(m);
  return out;
}

/** `#error:overloaded` → `overloaded`; plain `#error` → `rate_limit`. */
export function errorKindIn(text: string): TutorErrorKind {
  const m = /#error:([a-z_]+)/i.exec(text);
  const kind = m?.[1]?.toLowerCase();
  return (TUTOR_ERROR_KINDS as readonly string[]).includes(kind ?? "")
    ? (kind as TutorErrorKind)
    : "rate_limit";
}

/** The rung the context block carries (`hint_rung: 2 of 4`), or null when the subject has no graded step. */
export function rungIn(oakContext: string): number | null {
  const m = /hint_rung:\s*(\d)/.exec(oakContext);
  return m ? Number(m[1]) : null;
}

/** The subject of a conversation ID `<subjectKind>:<subjectId>:<day>:<lane>`. */
export function subjectOf(conversationId: string): { kind: string; id: string } {
  const [kind = "general", id = "general"] = conversationId.split(":");
  return { kind, id };
}

/** Canned replies by request kind; music tokens follow contracts §10.7. */
export function replyFor(turn: Pick<BackendTurn, "kind" | "user">, markers: Set<FakeTutorMarker>): string {
  if (markers.has("#empty")) return "";
  if (markers.has("#reveal"))
    return "I can't give that away while the step is open, but you can take the last hint. [[reveal]]";
  if (markers.has("#sections"))
    return [
      "The verse and the chorus differ on two axes: the chorus melody sits higher, and the hats double up.",
      "Loop the verse, then the chorus, and listen for the lift where they meet ([[bars:8-9]]).",
      "If the chorus still feels flat, give its bass more notes than the verse's.",
    ].join(" ");
  if (markers.has("#long"))
    return [
      "Here is the whole picture, one layer at a time.",
      "",
      "- **Bass**: it sits on [[deg:1]] for [[bars:1-2]], then moves to [[deg:4]] and [[deg:5]].",
      "- **Chords**: [[chord:C]] → [[chord:F]] → [[chord:G7]], which reads [[rn:I]] → [[rn:IV]] → [[rn:V7]].",
      "- **Melody**: it starts on [[note:E4]] and leans on [[deg:7]] before it lands.",
      "",
      "The [[term:cadence]] at the end is what makes it feel finished. You used [[tool:tb.scale]] for the melody;",
      "the voicing helper ([[tool:tb.voicing]]) comes later.",
      "",
      "Next: play bars 3–4 alone and listen for the step from 7 to 1.",
    ].join("\n");
  const rung = rungIn(turn.user.oakContext);
  switch (turn.kind) {
    case "hint":
      if (rung === null || rung <= 1)
        return "Listen to the first two bars again. Which beat feels empty to you, the second or the third?";
      if (rung === 2)
        return "Look at [[bars:2]], beat 3: the drum hits there, but the loop wants a rest. What does `~` do in the mini-notation?";
      return "Here is the shape of the fix for bar 2 only: put `~` where the third hit is, and keep the other hits. Run it and compare with the target.";
    case "explain":
      return "Oak's checker stopped at the bracket in your second line: a `[` opened a group that never closed. Add the `]` after the last note of the group and run it again.";
    case "listening":
      return "The bass holds [[deg:1]] for two bars and then steps up to [[deg:4]] in [[bars:3]], which gives the loop a lift halfway. The melody ends on [[deg:5]], so it sounds open rather than finished. What happens if the last note is [[deg:1]] instead?";
    default:
      return 'Good question. In Oak a degree is a position in the scale: [[deg:1]] is home, and `n("0")` plays it because `n` counts from zero, so `n` = degree − 1. Try `n("0 2 4")` with `.scale("C4:major")` and listen for 1, 3 and 5.';
  }
}

/** Split text into stream-sized chunks that keep `[[tokens]]` whole. */
export function chunksOf(text: string, size = 3): string[] {
  const parts = text.match(/\[\[[^\]]*\]\]|\S+\s*|\s+/g) ?? [];
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += size) out.push(parts.slice(i, i + size).join(""));
  return out;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });

/**
 * Wave 6 (d2): the try-it code in the piece's key. Oak's context names it (`try_code_key: A minor` or
 * `try_code_key: C major, then D major`); the snippet uses degrees on that key's `.scale()`, so it is the same music
 * moved home. Absent: the C major card code.
 */
export function fakeTryCode(oakContext: string | null | undefined): string {
  const m = /^try_code_key: ([A-G][#b]?) ([a-z]+)/m.exec(oakContext ?? "");
  if (m === null) return FAKE_CARD_CODE;
  const [, tonic, mode] = m as unknown as [string, string, string];
  return [
    "setcpm(90/4)",
    "",
    `bass: n("<0 3 4 0>").scale("${tonic}2:${mode}").s("ebass")`,
    `mel: n("<[0 2 4 2] [3 5 7 5] [4 6 8 6] [7 4 2 0]>").scale("${tonic}4:${mode}").s("piano")`,
  ].join("\n");
}

/**
 * Wave 7 (AC1): the labels of the versions a review must tell apart, read from Oak's context line
 * `versions: a "Version one" · b "Version two" · the review compares them…`; empty for a one-version capstone.
 */
export function fakeVersionLabels(oakContext: string | null | undefined): string[] {
  const line = /^versions: (.*)$/m.exec(oakContext ?? "")?.[1] ?? "";
  return [...line.matchAll(/(?:^|· )[ab] "([^"]+)"/g)].map((m) => m[1] as string);
}

/**
 * A capstone review that satisfies contracts §10.6 for a piece of `bars` bars with `revisions` revisions. With two
 * versions (AC1), each strength and revision names the version it is about, alternating between them.
 */
export function fakeCapstoneReview(
  revisions: number,
  bars: number,
  tryCode: string = FAKE_CARD_CODE,
  strengths: 2 | 3 = 2,
  versions: readonly string[] = [],
  answer?: string | null,
) {
  const span = (a: number, b: number): [number, number] => [Math.min(a, bars), Math.min(b, bars)];
  const about = (i: number, text: string) =>
    versions.length > 1
      ? `In ${versions[i % versions.length]}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`
      : text;
  const rev = (i: number) => ({
    title: i === 0 ? "Land the last phrase on 1" : "Thin the chords in bar 2",
    bars: span(i === 0 ? 3 : 2, i === 0 ? 4 : 2),
    why: about(
      i,
      "The melody ends on 5, so the loop sounds open. Ending on 1 over the tonic chord closes the phrase.",
    ),
    tryCode,
    skills: [],
  });
  return {
    strengths: [
      {
        text: about(0, "The bass and kick lock together on beat 1, so the groove feels steady."),
        bars: span(1, 2),
      },
      {
        text: about(1, "The melody outlines each chord above the bass, so every bar sounds settled."),
        bars: span(1, 1),
      },
      // CF-A (strengths_wanted: up to 3): a third, anchored to the piece's last bars.
      ...(strengths === 3
        ? [
            {
              text: about(
                2,
                "The last phrase comes home to 1 under the home chord, so the song ends settled.",
              ),
              bars: span(bars, bars),
            },
          ]
        : []),
    ],
    revisions: Array.from({ length: revisions }, (_, i) => rev(i)),
    listeningQuestion: "Does the last bar sound finished or open when the loop comes round?",
    linerNote:
      "A steady four-bar groove in C major whose melody outlines each chord before it turns for home.",
    ...(answer === undefined ? {} : { answer }),
  };
}

/** A transcription review that satisfies contracts §10.6. */
export function fakeTranscriptionReview(revisions: number, bars: number) {
  const span = (a: number, b: number): [number, number] => [Math.min(a, bars), Math.min(b, bars)];
  return {
    strengths: [
      {
        text: "The bass follows the roots of the chords and changes on the downbeats.",
        bars: span(1, 2),
        layer: "bass",
      },
      { text: "The kick and snare pattern matches a steady backbeat.", bars: span(1, 1), layer: "drums" },
    ],
    revisions: Array.from({ length: revisions }, (_, i) => ({
      title: i === 0 ? "Check the chord in bar 3" : "Listen to the melody's last note",
      bars: span(3, 3),
      layer: i === 0 ? ("chords" as const) : ("melody" as const),
      why: "The bass note under this chord is not one of its tones, so one of the two is probably off.",
      listenFor: "Loop bar 3 at half speed and hum the lowest note you hear.",
    })),
    plausibilityFlags: [{ bars: span(3, 3), issue: "bass and chord disagree in this bar" }],
    listeningQuestion: "Which layer moves first when the section changes?",
    linerNote: "A careful transcription that gets the groove and bass right and leaves one chord to recheck.",
  };
}

/**
 * The fake backend. `id` is `claude-cli` so usage reads "included in your Claude plan" (no dollar figures
 * from a fake); `auto` selects it because nothing else is wired.
 */
export class FakeTutorBackend implements TutorBackend {
  readonly id = "claude-cli" as const;
  readonly #delay: number;
  readonly #slowDelay: number;
  readonly #slowWords: number;
  /** Requests seen, newest last (tests). */
  readonly seen: { kind: string; text: string; conversationId: string; oakContext?: string }[] = [];

  constructor(o: FakeTutorOptions = {}) {
    this.#delay = o.delayMs ?? 40;
    this.#slowDelay = o.slowDelayMs ?? 250;
    this.#slowWords = o.slowWords ?? 80;
  }

  async available(): Promise<{ ok: boolean; reason?: string }> {
    return { ok: true };
  }

  #usage(requests: number): { usage: UsageSummary; calls: UsageSummary[] } {
    const call = callUsage(this.id, WIRE, "claude-opus-5-5");
    const calls = Array.from({ length: requests }, () => call);
    const usage = callUsage(
      this.id,
      {
        input_tokens: WIRE.input_tokens * requests,
        output_tokens: WIRE.output_tokens * requests,
        cache_read_input_tokens: WIRE.cache_read_input_tokens * requests,
        cache_creation_input_tokens: 0,
      },
      "claude-opus-5-5",
      requests,
    );
    return { usage, calls };
  }

  async runTurn(input: BackendTurn, emit: Emit, signal: AbortSignal): Promise<TurnOutcome> {
    const text = input.user.text;
    this.seen.push({
      kind: input.kind,
      text,
      conversationId: input.conversationId,
      oakContext: input.user.oakContext,
    });
    const markers = markersIn(text);
    let iterations = 1;
    const aborted = (): TurnOutcome => ({
      status: "failed",
      error: errorInfo("aborted"),
      iterations,
      ...this.#usage(iterations),
    });

    emit({ type: "status", data: { phase: "thinking", label: "Thinking…" } });
    if (markers.has("#think") || input.kind === "chat") {
      for (const part of chunksOf(
        "The learner asks about the loop. Check the context, then answer in one idea.",
        4,
      )) {
        if (signal.aborted) return aborted();
        emit({ type: "thinking", data: { delta: part } });
        await sleep(this.#delay, signal);
      }
    }

    if (markers.has("#tool")) {
      if (signal.aborted) return aborted();
      emit({ type: "status", data: { phase: "tool", label: "Looking at your progress…" } });
      await input.executeTool(
        { id: `fake_tool_${Date.now()}`, name: "get_learner_progress", input: {} },
        signal,
      );
      iterations++;
      await sleep(this.#delay, signal);
    }

    if (markers.has("#error")) {
      await sleep(this.#delay, signal);
      return {
        status: "failed",
        error: errorInfo(errorKindIn(text), 20),
        iterations,
        ...this.#usage(iterations),
      };
    }

    let echo = "";
    if (markers.has("#echo")) {
      // Everything a model would have: the redacted context block and, for a lesson step, the redacted
      // step context at this turn's rung (the tool executor applies the rung, never the backend).
      const screen = /screen: lesson (\S+)[^\n]*?· step (S\d+)/.exec(input.user.oakContext);
      let tool = "";
      if (screen !== null) {
        const r = await input.executeTool(
          {
            id: `fake_echo_${Date.now()}`,
            name: "get_lesson_context",
            input: { lesson_id: screen[1], step_id: `${screen[1]}/${screen[2]}` },
          },
          signal,
        );
        iterations++;
        tool = r.content;
      }
      echo = `Everything I was given:\n\n${input.user.oakContext}\n\n${tool}`;
    }

    emit({ type: "status", data: { phase: "writing", label: "Writing…" } });
    if (echo !== "") {
      for (const part of chunksOf(echo)) {
        if (signal.aborted) return aborted();
        emit({ type: "text", data: { delta: part } });
      }
    } else if (markers.has("#slow")) {
      for (let i = 0; i < this.#slowWords; i++) {
        if (signal.aborted) return aborted();
        emit({
          type: "text",
          data: { delta: `${i === 0 ? "Slowly" : "word"} ${i + 1}${i % 12 === 11 ? ".\n\n" : " "}` },
        });
        await sleep(this.#slowDelay, signal);
      }
    } else {
      for (const part of chunksOf(replyFor(input, markers))) {
        if (signal.aborted) return aborted();
        emit({ type: "text", data: { delta: part } });
        await sleep(this.#delay, signal);
      }
    }

    if (markers.has("#card")) {
      if (signal.aborted) return aborted();
      emit({ type: "status", data: { phase: "tool", label: "Writing a code card…" } });
      await input.executeTool(
        {
          id: `fake_card_${Date.now()}`,
          name: "propose_code",
          input: {
            kind: input.kind === "hint" ? "hint" : "example",
            title: "Four bars in C major",
            code: FAKE_CARD_CODE,
            explanation:
              "The bass walks 1, 4, 5, 1 and the melody plays the notes of each chord above it, then falls home to 1.",
            bars: 4,
          },
        },
        signal,
      );
      iterations++;
    }

    if (signal.aborted) return aborted();
    await input.continuity.commit([{ fake: true, kind: input.kind, markers: [...markers] }]);
    return { status: "completed", stopReason: "end_turn", iterations, ...this.#usage(iterations) };
  }

  async runStructured<T>(
    input: StructuredTurn<T>,
    signal: AbortSignal,
  ): Promise<{ value: T; usage: UsageSummary; calls?: UsageSummary[] }> {
    this.seen.push({ kind: input.kind, text: input.user.text, conversationId: input.conversationId });
    const subject = subjectOf(input.conversationId);
    const capstone = input.kind === "review-capstone";
    let revisions = capstone ? (/^(?:C[0-4]|X1)$/.test(subject.id) ? 1 : 2) : 1;
    let bars = 4;
    // CF-A asks for up to three real strengths; accept the current and legacy context forms.
    let strengths: 2 | 3 = /^strengths_wanted: (?:up to )?3\b/m.test(input.user.oakContext ?? "") ? 3 : 2;
    let n = 0;
    // Like a model that reads Oak's problems and resubmits: the count of revisions and the piece's length
    // are only known to the validator.
    for (let attempt = 0; attempt <= input.maxResubmits; attempt++) {
      if (signal.aborted) throw new TutorError("aborted");
      await sleep(this.#delay * 4, signal);
      n++;
      const raw = capstone
        ? fakeCapstoneReview(
            revisions,
            bars,
            fakeTryCode(input.user.oakContext),
            strengths,
            fakeVersionLabels(input.user.oakContext),
            /^learner_question:/m.test(input.user.oakContext) ? FAKE_REVIEW_ANSWER : undefined,
          )
        : fakeTranscriptionReview(revisions, bars);
      const check = await input.validate(raw, signal);
      if (check.ok) return { value: check.value, ...this.#usage(n) };
      for (const p of check.problems) {
        const need = /^revisions: need exactly (\d+)/.exec(p);
        if (need) revisions = Number(need[1]);
        const want = /^strengths: need exactly (\d+)/.exec(p);
        if (want) strengths = Number(want[1]) === 3 ? 3 : 2;
        const end = /past the end \((\d+) bars\)/.exec(p);
        if (end) bars = Math.max(1, Number(end[1]));
      }
    }
    // The service turns this into its own error event and the deterministic liner-note fallback.
    throw new TutorError("iteration_limit");
  }
}
