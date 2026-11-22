// J3.L02 Drop-2 & Spread (spec: content/specs/J3.md). A close voicing packs four notes inside one octave; take
// its second note from the top down an octave and it becomes a drop-2 voicing: the same chord, wider and more
// open, with the top note free to carry a tune. Where a voicing sits matters as much: the same four notes two
// octaves lower turn to mud, so wide gaps go low and close ones high.
//
// Written for the learner at the gate (AUTHORING §20.1): J3 opens after U13.CP, J.CP1 and JC1 and may be taken
// with U14–U17 unfinished, so the lesson uses only what the core up to U13.CP, J1, J2.L01–L03 and J3.L01
// guarantee. Key C (the track's key rotation: no accidentals in the way of the one move). Drop-2 has no Strudel
// dictionary, so every voicing here is written by hand with `note("[…]")` (pre-flight B3).
//
// Evaluated (headless Strudel): the close voicings under the tune C5 B4 B4 E5 are D4 F4 A4 C5 | D4 F4 G4 B4 |
// C4 E4 G4 B4 | G4 B4 C5 E5, and their drops A3 D4 F4 C5 | G3 D4 F4 B4 | G3 C4 E4 B4 | C4 G4 B4 E5; each drop is
// `isDropTwo` (raise its lowest note an octave and the chord is close again, that note second from the top),
// and `voicing-shape` reads each as "drop-2" against Dm7 G7 C^7 C^7. Every tune note on a downbeat is a chord
// tone (C the 7th of Dm7, B the 3rd of G7 and the 7th of Cmaj7, E the 3rd of Cmaj7).
//
// The corrections-pass standard (AUTHORING §20.2): S3 and S4 read absolute pitch, because the drop of a given
// close voicing has exactly one answer; each pins the right move on the wrong voice (drop-3: the second note
// from the bottom dropped; the top note dropped, which pulls the tune off the top) as the wrong answer that uses
// the right function. The Make's one required rule is `voicing-shape` (drop-2 heard in the written octaves:
// close voicings, drop-3 and a `voicing()` line all fail), so the tune and the rhythm are the learner's. No
// feedback below rung 4 names the notes of the answer.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 112;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const code = (...lines: string[]) => `${TEMPO}${lines.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

const SWUNG = { subdivision: 8, amount: 1 / 3 } as const;

/** The rhythm section: the jazz kit's ride and hats, the upright in two under Dm7 G7 Cmaj7 Cmaj7. */
const RIDE = 'drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit")';
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';
const BASS = 'bass: note("<[d2 a1] [g1 d2] [c2 g1] [c2 e2]>").s("upright")';
/** The tune, one note a bar: C B B E. */
const MEL = 'mel: note("<c5 b4 b4 e5>").s("vibes")';

/** Close position under the tune: Dm7 D F A C, G7 D F G B, Cmaj7 C E G B, Cmaj7 G B C E. */
const CLOSE = "[d4,f4,a4,c5] [d4,f4,g4,b4] [c4,e4,g4,b4] [g4,b4,c5,e5]";
/** Drop-2: the second note from the top of each close chord an octave lower. */
const DROP2 = "[a3,d4,f4,c5] [g3,d4,f4,b4] [g3,c4,e4,b4] [c4,g4,b4,e5]";
/** The right move on the wrong voice: the second note from the BOTTOM dropped (drop-3). */
const DROP3 = "[f3,d4,a4,c5] [f3,d4,g4,b4] [e3,c4,g4,b4] [b3,g4,c5,e5]";
/** The top note dropped: the tune leaves the top of the chord. */
const TOP_DROPPED = "[c4,d4,f4,a4] [b3,d4,f4,g4] [b3,c4,e4,g4] [e4,g4,b4,c5]";

const rhodes = (stacks: string, tail = '.s("rhodes").gain(.7)') => `chords: note("<${stacks}>")${tail}`;
const trio = (stacks: string) => code(RIDE, HATS, BASS, rhodes(stacks), MEL);

const CLOSE_TRIO = trio(CLOSE);
const DROP2_TRIO = trio(DROP2);

/** S2: one Cmaj7 in close position, then its drop-2, held a bar each. */
const ONE_MOVE = code('chords: note("<[c4,e4,g4,b4] [g3,c4,e4,b4]>").s("rhodes")');

/** S4: the trio with the Rhodes in close position; the learner drops one note of each chord. */
const S4_STARTER = code(RIDE, BASS, `chords: note("<⟪${CLOSE}⟫>").s("rhodes").gain(.7)`, MEL);
const s4 = (stacks: string, tail?: string) => code(RIDE, BASS, rhodes(stacks, tail), MEL);
const S4_SOLUTION = s4(DROP2);
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

/** S5: where a voicing sits. Cmaj7 drop-2 in the middle, the same two octaves down, and spread. */
const SIT = (stack: string) => code(RIDE, `chords: note("${stack}").s("rhodes")`);
const MIDDLE = SIT("[g3,c4,e4,b4]");
const LOW = SIT("[g1,c2,e2,b2]");
const SPREAD = SIT("[c3,b3,e4,g4,d5]");

/** S6: the Band plays drums and bass; the learner's Rhodes and vibes start in close position. */
const MAKE_STARTER = code(rhodes(CLOSE), MEL);
const make = (...lines: string[]) => code(...lines);

/** Drop-2 voicings of the changes, heard in the written octaves (a `voicing()` line is not graded by shape). */
const DROP_TWO_HEARD: RubricRule = {
  id: "drop-2",
  label: "At least 3 of every 4 chords are drop-2 voicings of Dm7, G7, Cmaj7, Cmaj7",
  required: true,
  skills: ["J09"],
  rule: "custom",
  fn: "voicing-shape",
  params: { track: "chords", shape: ["drop-2"], changes: ["Dm7", "G7", "C^7", "C^7"], minRatio: 0.75 },
};

const ROLL = { roll: true, staff: false, keyboard: false } as const;
const KEYS = { roll: false, staff: false, keyboard: true } as const;
const NONE = { roll: false, staff: false, keyboard: false } as const;

export default defineLesson({
  id: "J3.L02",
  version: 3,
  title: "Drop-2 & Spread",
  objective: "I can open a close voicing into a drop-2 voicing and carry a tune on its top note.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  swing: SWUNG,
  introduces: [],
  practises: ["J09"],
  terms: [
    { id: "term.close-position", step: "S2" },
    { id: "term.drop-2", step: "S2" },
  ],
  canDo: ["cd.code.drop-2"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Packed, then opened",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "drop-2-trio", code: DROP2_TRIO, bars: 4 },
      exercise: {
        kind: "listen",
        id: "packed-then-opened",
        version: 1,
        role: "practice",
        prompt:
          "The tune, the bass and the drums do not change. Listen to the space between the Rhodes and the vibes in both takes. Notice which take sounds thicker and which one breathes.",
        skills: [{ skill: "J09", w: 1 }],
        hints: null,
        tests: [],
        items: [
          {
            code: CLOSE_TRIO,
            caption: "The vibes play C B B E; the Rhodes sits right under each note.",
            bars: 4,
          },
          {
            code: DROP2_TRIO,
            caption: "The same tune and the same chords. Listen under the vibes.",
            bars: 4,
          },
        ],
      },
    },
    {
      id: "S2",
      kind: "investigate",
      title: "One note moves",
      minutes: 0.75,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      example: { id: "one-move", code: ONE_MOVE, bars: 2 },
      exercise: {
        kind: "run-investigate",
        id: "one-note-moves",
        version: 1,
        role: "practice",
        prompt:
          "Run it: Cmaj7 held for a bar, then the same chord opened. Read the two bars on the roll and answer two questions: which note of the first chord moved, and how many half steps down it went.",
        skills: [{ skill: "J09", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Put the two chords side by side on the roll: three notes stay exactly where they were. Find the one that does not, and count the half steps between its two places.",
        },
        hints: ladder(
          "Put the two bars side by side on the roll and find the three notes that stay in the same place.",
          "Count the notes of bar 1 from the top down: first, second, third, fourth. The one that moved is one of the inner two.",
          "It is the second from the top. Count from where it was down to where it is now: the same letter, lower.",
        ),
        code: { starter: ONE_MOVE },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which note of the first chord moved?",
            options: [
              { id: "g", label: "G, the second note from the top" },
              { id: "e", label: "E, the second note from the bottom" },
              { id: "b", label: "B, the top note" },
            ],
            correct: ["g"],
          },
          {
            q: "number",
            prompt: "How many half steps did it move down?",
            correct: 12,
          },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["g"], number: 12 } }, expect: "pass" },
          {
            name: "E: the second from the bottom",
            response: { answer: { choice: ["e"], number: 12 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "seven: G down to C, read as the move",
            response: { answer: { choice: ["g"], number: 7 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S3",
      kind: "quiz",
      title: "Open Dm7",
      minutes: 1,
      graded: true,
      ui: { panels: KEYS, band: false },
      exercise: {
        kind: "keyboard",
        id: "drop-dm7",
        version: 1,
        role: "check",
        prompt:
          "Dm7 in close position is D4 F4 A4 C5. Play its drop-2 voicing on the keyboard, all four notes at once.",
        skills: [{ skill: "J09", w: 1 }],
        hints: ladder(
          "Count D4 F4 A4 C5 from the top down and find the second note.",
          "That note goes down an octave, to the same letter lower; the other three stay where they are.",
          "The top stays C5, and D4 and F4 stay too. The fourth note is now the lowest of the four.",
        ),
        answer: { ui: "keyboard", range: ["c3", "c5"], mode: "chord" },
        // The drop of a given close voicing has one answer, in its octaves (keyboard.voicing, planned, will
        // also take the drop-2 of Dm7 in any register).
        expect: { midi: [57, 62, 65, 72] },
        pitchMode: "absolute",
        srs: [{ family: "fam.jzz.voicing", mode: "review-if-due" }],
        feedbackText: {
          "kb.missing-note":
            "Not yet: one of the four notes is not where the drop puts it. Three notes stay exactly as they were in close position; one goes down an octave.",
          "kb.extra-note":
            "{got} is not in the drop-2. Keep the top note and the two lowest notes where they were, and move only the note second from the top.",
        },
        tests: [
          { name: "A3 D4 F4 C5", response: { answer: { midi: [57, 62, 65, 72] } }, expect: "pass" },
          { name: "pressed top down", response: { answer: { midi: [72, 65, 62, 57] } }, expect: "pass" },
          {
            name: "the dropped note last",
            response: { answer: { midi: [62, 65, 72, 57] } },
            expect: "pass",
          },
          {
            name: "the outer notes first",
            response: { answer: { midi: [57, 72, 62, 65] } },
            expect: "pass",
          },
          {
            name: "close position, unchanged",
            response: { answer: { midi: [62, 65, 69, 72] } },
            expect: "fail",
            feedback: ["kb.missing-note", "kb.extra-note"],
          },
          {
            name: "drop-3: the second note from the bottom dropped",
            response: { answer: { midi: [53, 62, 69, 72] } },
            expect: "fail",
            feedback: ["kb.missing-note", "kb.extra-note"],
          },
          {
            name: "the top note dropped: C under the chord",
            response: { answer: { midi: [60, 62, 65, 69] } },
            expect: "fail",
            feedback: ["kb.missing-note", "kb.extra-note"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Open the four chords",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "none", band: false },
      exercise: {
        kind: "code-modify",
        id: "open-the-chords",
        version: 1,
        role: "check",
        prompt:
          "The Rhodes harmonises the tune in close position. Turn each of its four chords into a drop-2 voicing: move the note second from the top down an octave. Keep the other three notes and the vibes line. Done when all four bars match the target.",
        skills: [{ skill: "J09", w: 1 }],
        swing: SWUNG,
        code: { starter: S4_STARTER },
        reference: { solutions: [S4_SOLUTION], bars: 4 },
        // The drop of a given close voicing has one answer: the chords' notes in their octaves, where they start.
        matcher: { m: "events", pitch: "absolute", rhythm: "onsets", durations: false, tracks: ["chords"] },
        target: { audible: true },
        feedbackText: {
          "melody.wrong-degree":
            "Bar {bar}: a note that should stay has moved, or the wrong one went down. In each chord only the note second from the top moves.",
          "melody.octave":
            "Bar {bar}: the right letters, but a note sits in the wrong octave. Three notes keep their place; one goes down exactly an octave.",
          "melody.missing-note":
            "Bar {bar}: a note of the chord is missing, or too quiet to hear under the vibes. A drop-2 keeps all four notes; only one changes octave.",
          "melody.extra-note":
            "Bar {bar}: a note too many. A drop-2 keeps the same four notes as the close chord.",
        },
        hints: ladder(
          "Count each chord from its top note down. The second note is the one that moves.",
          "That note moves down an octave, to the same letter lower. The top note stays, so the tune stays on top.",
          "Bar 1 becomes `[a3,d4,f4,c5]`: A came down from A4. Do the same to the other three bars.",
        ),
        tests: [
          { name: "reference", response: { code: S4_SOLUTION }, expect: "pass" },
          {
            name: "the notes in another order inside each chord",
            response: {
              code: s4("[d4,f4,c5,a3] [b4,f4,d4,g3] [c4,e4,b4,g3] [e5,b4,g4,c4]"),
            },
            expect: "pass",
          },
          {
            name: "the same chords on the piano",
            response: { code: s4(DROP2, '.s("piano").gain(.7)') },
            expect: "pass",
          },
          {
            name: "softer",
            response: { code: s4(DROP2, '.s("rhodes").gain(.5)') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: plain(S4_STARTER) },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "drop-3: the second note from the bottom dropped",
            response: { code: s4(DROP3) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the top note dropped: the tune leaves the top",
            response: { code: s4(TOP_DROPPED) },
            expect: "fail",
            feedback: ["melody.wrong-degree"],
          },
          {
            name: "the right notes, far under the vibes",
            response: { code: s4(DROP2, '.s("rhodes").gain(.03)') },
            expect: "fail",
            feedback: ["melody.missing-note"],
          },
          {
            name: "the whole close chord an octave down",
            response: { code: s4("[d3,f3,a3,c4] [d3,f3,g3,b3] [c3,e3,g3,b3] [g3,b3,c4,e4]") },
            expect: "fail",
            feedback: ["melody.octave"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "compare",
      title: "Where it sits",
      minutes: 0.75,
      ui: { panels: NONE, band: false },
      exercise: {
        kind: "identify",
        id: "where-it-sits",
        version: 1,
        role: "practice",
        prompt:
          "Three ways to play Cmaj7 under the ride. Two of them ring clearly. Pick the one that turns to mud.",
        skills: [{ skill: "J09", w: 1 }],
        hints: ladder(
          "Find the card that sounds lowest, and try to pick out its four notes.",
          "Low notes close together blur into one rumble; the same gaps higher up stay clear.",
          "One card is the drop-2 you just wrote, played two octaves lower.",
        ),
        stimulus: { src: "code", code: MIDDLE, bars: 2, showCode: false },
        cue: { context: "none", countInBars: 0, click: false, replays: -1 },
        answer: {
          ui: "choice",
          layout: "audio-cards",
          options: [
            { id: "middle", label: "Card A", audio: MIDDLE },
            { id: "low", label: "Card B", audio: LOW },
            { id: "spread", label: "Card C", audio: SPREAD },
          ],
        },
        correct: { choice: ["low"] },
        feedbackText: {
          "id.wrong":
            "Listen to card B again: four notes squeezed together two octaves down, where they smear into one thick sound. Cards A and C keep their close notes high.",
        },
        tests: [
          { name: "the low one", response: { answer: { choice: ["low"] } }, expect: "pass" },
          {
            name: "the spread one: wide, not muddy",
            response: { answer: { choice: ["spread"] } },
            expect: "fail",
            feedback: ["id.wrong"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "make",
      title: "Your tune on top",
      minutes: 2.75,
      ui: {
        panels: ROLL,
        rollLabels: "none",
        band: { band: "band.two-five-one", tracks: ["drums", "bass"] },
      },
      exercise: {
        kind: "code-make",
        id: "your-tune-on-top",
        version: 1,
        role: "practice",
        title: "Drop-2 ii–V–I",
        prompt:
          "Voice the Rhodes in drop-2 under the vibes, over Dm7 G7 Cmaj7 Cmaj7. Required: build each chord close under the tune's note, then drop its second note from the top an octave. Also on the checklist: the vibes tune plays, and a tempo of 100 to 160. Keep C B B E or write your own tune.",
        skills: [{ skill: "J09", w: 1 }],
        swing: SWUNG,
        code: { starter: MAKE_STARTER },
        bars: [4, 8],
        saveAs: "sketch",
        rubric: [
          DROP_TWO_HEARD,
          {
            id: "tune-on-top",
            label: "A vibes tune plays with the chords",
            required: false,
            skills: ["J09"],
            rule: "sounds",
            contains: ["snd.vibes"],
          },
          {
            id: "swing-tempo",
            label: "`setcpm` sets a tempo between 100 and 160 beats a minute",
            required: false,
            skills: ["R13"],
            rule: "tempo-bpm",
            min: 100,
            max: 160,
          },
        ],
        hints: ladder(
          "Work one bar at a time. Under the tune's note, stack the bar's chord inside one octave with the tune note on top.",
          "Build the chord close under the tune note first. Then take its second note from the top down an octave.",
          "Under C5 on Dm7 the close chord is D4 F4 A4 C5; the A goes down. Do the same under each note of your tune.",
        ),
        tests: [
          {
            name: "the starter as it is",
            response: { code: MAKE_STARTER },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "minimal: C B B E in drop-2",
            response: { code: make(rhodes(DROP2), MEL) },
            expect: "pass",
          },
          {
            name: "the same drop-2 chords on the piano, struck on 1 and 3",
            response: { code: make(rhodes(DROP2, '.struct("x ~ x ~").s("piano").gain(.6)'), MEL) },
            expect: "pass",
          },
          {
            name: "a tune of its own, two notes a bar, each harmonised",
            response: {
              code: make(
                rhodes(
                  "[[f3,c4,d4,a4] [a3,d4,f4,c5]] [[g3,d4,f4,b4] [b3,f4,g4,d5]] [[e3,b3,c4,g4] [g3,c4,e4,b4]] [c4,g4,b4,e5]",
                ),
                'mel: note("<[a4 c5] [b4 d5] [g4 b4] e5>").s("vibes")',
              ),
            },
            expect: "pass",
          },
          {
            name: "beyond the brief: the Charleston, the piano, faster, a softer tune",
            response: {
              code: make(
                rhodes(DROP2, '.struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("piano").gain(.7)'),
                'mel: note("<c5 b4 b4 e5>").struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4).s("vibes").gain(.8)',
              ).replace(`setcpm(${BPM}/4)`, "setcpm(150/4)"),
            },
            expect: "pass",
          },
          {
            name: "drop-3: the second note from the bottom dropped",
            response: { code: make(rhodes(DROP3), MEL) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "drop-2 written, but the Rhodes far under the vibes",
            response: { code: make(rhodes(DROP2, '.s("rhodes").gain(.03)'), MEL) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the dictionary's voicings",
            response: {
              code: make('chords: chord("<Dm7 G7 C^7 C^7>").voicing().s("rhodes").gain(.7)', MEL),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "every chord an octave down, still close",
            response: {
              code: make(rhodes("[d3,f3,a3,c4] [d3,f3,g3,b3] [c3,e3,g3,b3] [g3,b3,c4,e4]"), MEL),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
