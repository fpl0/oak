// Wave 6 context (wave6.md §11; contracts §10.8): the vocabulary of U12–U17 as the learner meets it (seventh
// qualities and symbols, guide tones, pushes, ghost notes, ties, compound meter, triplets, the modes by their
// characteristic tone, chromatic degrees and syllables, applied and borrowed chords, pivots and key changes), always
// inside the introduced-terms list with everything beyond it marked as a preview; and the step's key, mode AND key
// plan in the lesson context.
import { describe, expect, test } from "bun:test";
import { prepareTurn } from "./prepare.ts";
import { PERSONA } from "./prompt/persona.ts";
import { lessonContextView } from "./redaction.ts";
import { makePorts } from "./testing/fakes.ts";
import {
  CHROMATIC_STEP,
  KEY_PLAN_STEP,
  MODE_SCALE_STEP,
  MODE_STEP,
  W6_LEARNER,
  W6_LESSON,
  w6GradeFor,
} from "./testing/wave6-fixtures.ts";
import type { TurnRequest } from "./types.ts";
import {
  CHROMATIC_LEANS,
  keyMoveText,
  keyPlanLine,
  keyScaleLine,
  MODE_COLOUR,
  SEVENTH_FORMS,
  type Vocabulary,
  vocabularyOf,
  W5_TERMS,
  W6_TERMS,
  w6VocabularyLines,
  w6VocabularyOf,
} from "./vocabulary.ts";

const EARLY = [
  "term.solfege",
  "term.triad",
  "term.major-triad",
  "term.chord-symbol",
  "term.slash-chord",
  "term.roman-numeral",
];
const terms = (ids: string[]) => ({ count: ids.length, recent: [...ids].reverse(), all: ids });
const vocab = (ids: string[]): Vocabulary => vocabularyOf(terms(ids));
const lines = (ids: string[], o: Parameters<typeof w6VocabularyLines>[2] = {}) =>
  w6VocabularyLines(w6VocabularyOf(terms(ids)), vocab(ids), o);

describe("the U12–U17 vocabulary, as it is met", () => {
  test("a learner who has met none of it, in a major key: no line at all (earlier contexts are unchanged)", () => {
    expect(lines(EARLY)).toEqual([]);
    expect(lines(EARLY, { key: "C major" })).toEqual([]);
    expect(lines(EARLY, { key: "A minor" })).toEqual([]);
  });

  test("after U12.L01: maj7 and m7 by symbol and numeral; the other qualities and everything later as previews", () => {
    const [met, forms] = lines([...EARLY, W6_TERMS.majorSeventh], { dominantSeventh: true });
    expect(met).toMatch(
      /^vocabulary_later: major and minor sevenths yes · half-diminished and diminished sevenths no/,
    );
    expect(forms).toContain(
      "seventh chords as code writes them: [[chord:C^7]] (1-3-5-7), [[chord:C7]] (1-3-5-b7), [[chord:Cm7]] (1-b3-5-b7); numerals [[rn:Imaj7]] [[rn:V7]] [[rn:ii7]]; the other seventh qualities only as a preview",
    );
    for (const preview of [
      "guide tones only as a preview: say 'the 3rd and the 7th of the chord'",
      "pushes and syncopation only as a preview",
      "ghost notes only as a preview",
      "ties and dotted notes only as a preview",
      "compound meter only as a preview",
      "triplets only as a preview",
      "modes only as a preview: describe the one note that differs from major or minor, by degree",
      "chromatic syllables (fi, si, di) only as a preview",
      "secondary dominants only as a preview: say 'the V chord of the next chord'",
      "borrowed chords only as a preview: say 'the IV chord with its third lowered'",
      "key changes only as a preview: say 'the home note moves'",
    ])
      expect(forms).toContain(preview);
  });

  test("each unit switches its own forms on, and only its own", () => {
    const at = (...ids: string[]) => lines([...EARLY, ...ids])[1] as string;
    expect(at(W6_TERMS.halfDiminished)).toContain(
      "[[chord:Cm7b5]] (1-b3-b5-b7), [[chord:Co7]] (1-b3-b5-bb7)",
    );
    expect(at(W6_TERMS.guideTones)).toContain("guide tones: the 3rd and 7th of each chord");
    expect(at(W6_TERMS.syncopation)).toContain(".early(1/8), .late(1/8)");
    expect(at(W6_TERMS.ghostNote)).toContain(".velocity() with one value per step");
    expect(at(W6_TERMS.tie)).toContain("a dotted quarter is @3 of eighths");
    expect(at(W6_TERMS.compoundMeter)).toContain("counted 1 la li 2 la li; tempo setcpm(bpm/2)");
    expect(at(W6_TERMS.triplet)).toContain("three equal notes in one beat");
    // U14.L01 brings the word "mode" and Mixolydian; the other three modes wait for their own lessons.
    expect(at(W6_TERMS.mode)).toContain(
      "Mixolydian = major with b7 (I bVII); Lydian only as a preview; Dorian only as a preview; Phrygian only as a preview",
    );
    expect(at(W6_TERMS.mode, W6_TERMS.dorian)).toContain("Dorian = minor with 6 (i IV)");
    expect(at(W6_TERMS.chromaticDegree)).toContain(
      "sung #4 fi, b7 te, #5 si, #1 di, b2 ra, b3 me, b6 le; raised notes lean up (#4 to 5), lowered notes lean down (b7 to 6)",
    );
    expect(at(W6_TERMS.chromaticDegree)).toContain('("3#" is #4)');
    expect(at(W6_TERMS.secondaryDominant)).toContain(
      'secondary dominants as [[rn:V7/V]], said "five of five": name the chord it leans into and whether it resolves there; applied vii° only as a preview',
    );
    expect(at(W6_TERMS.secondaryDominant, W6_TERMS.tonicization)).toContain("[[rn:viio7/ii]]");
    expect(at(W6_TERMS.borrowed)).toContain(
      "borrowed chords as [[rn:iv]] [[rn:bVI]] [[rn:bVII]] [[rn:bIII]]",
    );
    expect(at(W6_TERMS.borrowed)).not.toContain("Picardy");
    expect(at(W6_TERMS.borrowed, W6_TERMS.picardy)).toContain("Picardy third");
    expect(at(W6_TERMS.modulation)).toContain(
      'a pivot chord by its numeral in both keys ("vi in C, ii in G"); direct modulation only as a preview',
    );
    expect(at(W6_TERMS.modulation, W6_TERMS.directModulation)).toContain("by how far it moves in half steps");
  });

  test("before solfège and symbols the same things are said by degree", () => {
    const [, forms] = lines([W6_TERMS.majorSeventh, W6_TERMS.chromaticDegree]);
    expect(forms).toContain("maj7 as 1-3-5-7");
    expect(forms).not.toContain("[[chord:C^7]]");
    expect(forms).not.toContain("sung #4 fi");
  });

  test("the tables: five seventh forms, four colour modes, seven chromatic degrees", () => {
    expect(SEVENTH_FORMS.map((s) => s.quality)).toEqual(["maj7", "7", "m7", "m7b5", "dim7"]);
    expect(Object.keys(MODE_COLOUR).sort()).toEqual(["dorian", "lydian", "mixolydian", "phrygian"]);
    expect(CHROMATIC_LEANS.map((c) => c.degree)).toEqual(["#4", "b7", "#5", "#1", "b2", "b3", "b6"]);
  });
});

describe("the step's key, mode and key plan", () => {
  test("a colour mode's scale line names the one note changed against its parent", () => {
    expect(keyScaleLine("G mixolydian", vocab(EARLY))).toBe(
      "scale: mixolydian · degrees 1 2 3 4 5 6 b7 · sung do re mi fa sol la te (do-based: 1 is do) · major with 7 changed to b7: the characteristic tone is b7 (te); its colour chord is bVII (the vamp I bVII)",
    );
    expect(keyScaleLine("D4:dorian", vocab([]))).toBe(
      "scale: dorian · degrees 1 2 b3 4 5 6 b7 · minor with b6 changed to 6: the characteristic tone is 6",
    );
    expect(keyScaleLine("F lydian", vocab(EARLY))).toContain("the characteristic tone is #4 (fi)");
    expect(keyScaleLine("E phrygian", vocab(EARLY))).toContain("its colour chord is bII (the vamp i bII)");
    // Dorian and Phrygian do not borrow the minor key's list of numerals.
    expect(keyScaleLine("D dorian", vocab(EARLY))).not.toContain("ii° III");
  });

  test("a key plan: each key with its first bar and how far the home note moved", () => {
    expect(keyPlanLine(KEY_PLAN_STEP.keyPlan)).toBe(
      "key_plan: C major from bar 1 · D major from bar 5 (up 2 half steps (a whole step)) · read degrees and numerals in the key in force at each bar",
    );
    expect(keyPlanLine([{ bar: 1, key: "C major" }])).toBeNull();
    expect(keyPlanLine(null)).toBeNull();
    expect(
      keyPlanLine([
        { bar: 17, key: "D major" },
        { bar: 1, key: "Db major" },
        { bar: 21, key: "C major" },
        { bar: 25, key: "Db major" },
      ]),
    ).toContain(
      "Db major from bar 1 · D major from bar 17 (up 1 half step (a half step)) · C major from bar 21 (down 2 half steps (a whole step)) · Db major from bar 25 (up 1 half step (a half step))",
    );
    expect(keyMoveText("C major", "G major")).toBe("down 5 half steps");
    expect(keyMoveText("C major", "F major")).toBe("up 5 half steps");
    expect(keyMoveText("A minor", "A major")).toBe("same home note, another mode");
  });

  const request = (s: typeof MODE_STEP, text: string): TurnRequest => ({
    thread: { subjectKind: "lesson", subjectId: s.lessonId },
    kind: "chat",
    userText: text,
    learnerCode: W6_LEARNER[s.id] as string,
    graderResult: w6GradeFor(s),
    stepId: s.id,
  });
  const portsFor = (s: typeof MODE_STEP, lesson = {}) => {
    const ports = makePorts();
    ports.lessons.lessons.set(s.lessonId, { ...W6_LESSON, id: s.lessonId, key: s.key ?? null, ...lesson });
    ports.lessons.steps.set(s.id, s);
    return ports;
  };

  test("a step that changes key: the plan is its answer while the learner is finding the key, shown after the reveal", async () => {
    const ports = portsFor(KEY_PLAN_STEP);
    for (const rung of [0, 3] as const) {
      ports.progress.set(KEY_PLAN_STEP.id, { rung });
      const ctx = (await prepareTurn(request(KEY_PLAN_STEP, "Which key?"), ports)).user.oakContext;
      expect(ctx).toContain("key: C major · meter: 4/4");
      expect(ctx).toContain(
        "key_plan: this step changes key; where and to which key is its answer: withheld until the reveal",
      );
      expect(ctx).not.toContain("D major");
      expect(ctx).toContain("answer_kind: key plan");
      // The lines say key changes are a preview for this learner, without naming the key.
      expect(ctx).toMatch(/^forms_later: .*key changes only as a preview/m);
    }
    ports.progress.set(KEY_PLAN_STEP.id, { rung: 4 });
    const open = (await prepareTurn(request(KEY_PLAN_STEP, "Which key?"), ports)).user.oakContext;
    expect(open).toContain(
      "key_plan: C major from bar 1 · D major from bar 5 (up 2 half steps (a whole step))",
    );
    // The tool view follows the same rule.
    const lesson = { ...W6_LESSON, id: KEY_PLAN_STEP.lessonId };
    expect(lessonContextView(lesson, KEY_PLAN_STEP, null, 2).step?.key_plan).toBe("withheld");
    expect(lessonContextView(lesson, KEY_PLAN_STEP, null, 4).step?.key_plan).toContain("D major from bar 5");
  });

  test("a step whose key plan the prompt already shows keeps it in the context", async () => {
    const shown = {
      ...KEY_PLAN_STEP,
      id: "U17.L02/S6",
      prompt: "The tune is in C major for four bars, then in D major. Move the .scale() after arrange().",
    };
    const ports = portsFor(shown);
    const ctx = (await prepareTurn(request(shown, "Where does it go?"), ports)).user.oakContext;
    expect(ctx).toContain("key_plan: C major from bar 1 · D major from bar 5");
  });

  test("a modal step: the lesson starts from the parent scale, the step's own key is the mode", async () => {
    const dorian = {
      ...MODE_STEP,
      id: "U14.L03/S5",
      lessonId: "U14.L03",
      key: "D dorian",
      solutions: [],
      grading: "ungraded" as const,
    };
    const ports = portsFor(dorian, { key: "D minor" });
    const ids = [...EARLY, W5_TERMS.naturalMinor, W6_TERMS.mode, W6_TERMS.dorian];
    ports.progress.terms = terms(ids);
    const ctx = (await prepareTurn(request(dorian, "Why does it sound lifted?"), ports)).user.oakContext;
    expect(ctx).toContain("key: D dorian · meter: 4/4");
    expect(ctx).toMatch(/^scale: dorian · degrees 1 2 b3 4 5 6 b7 · sung do re me fa sol la te/m);
    expect(ctx).toContain(
      "minor with b6 changed to 6: the characteristic tone is 6 (la); its colour chord is IV (the vamp i IV)",
    );
    expect(ctx).toMatch(/^vocabulary_later: .*Dorian yes · Lydian no/m);
  });

  test("a step in its own meter: 6/8 inside a 4/4 lesson", async () => {
    const six = {
      ...CHROMATIC_STEP,
      id: "U13.L06/S6",
      lessonId: "U13.L06",
      meter: "6/8",
      solutions: [],
      grading: "ungraded" as const,
    };
    const ports = portsFor(six);
    ports.progress.terms = terms([...EARLY, W6_TERMS.compoundMeter]);
    const ctx = (await prepareTurn(request(six, "How do I count this?"), ports)).user.oakContext;
    expect(ctx).toContain("key: C major · meter: 6/8");
    expect(ctx).toMatch(
      /^forms_later: .*compound meter: 6\/8 is two beats of three eighths, counted 1 la li 2 la li/m,
    );
  });

  test("on a scale-builder step in a colour mode the scale line stays withheld", async () => {
    const lydian = { ...MODE_SCALE_STEP, key: "F lydian" };
    const ports = portsFor(lydian);
    ports.progress.set(lydian.id, { rung: 2 });
    const ctx = (await prepareTurn(request(lydian, "Which note?"), ports)).user.oakContext;
    expect(ctx).toContain("scale: lydian · its degrees are this step's answer: withheld until the reveal");
    expect(ctx).not.toContain("#4");
  });
});

describe("the persona carries the Wave 6 rules", () => {
  test("teaching, withholding, vocabulary and review rules name the new things", () => {
    for (const text of [
      "`C^7` (major seventh), `Cm7`, `C7`, `Cm7b5` (half-diminished), `Co7` (diminished seventh)",
      "A mode is a scale the learner already knows with one note changed",
      'raised degree is written on the step below it (`"3#"` is #4)',
      'said "five of five"',
      "When `key_plan` is in the context the music changes key",
      'counted "1 la li 2 la li"',
      "a mode to name (neither its name nor its changed note)",
      "a key to find (not the key, not how far the home note moves)",
      "`vocabulary_later`",
      '"only as a preview" the learner has not met',
      "Every `tryCode` is written in the piece's key, which `try_code_key` gives",
      "never over inline patterns",
      'such as "perfect authentic cadence"',
      "When `strengths_wanted` is up to 3",
    ])
      expect(PERSONA).toContain(text);
    // Still a constant, and still no semitones.
    expect(PERSONA).not.toMatch(/\$\{|undefined/);
    expect(PERSONA).toContain('never "semitones"');
  });
});
