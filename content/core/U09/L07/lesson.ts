// U09.L07 Carve It (Oak 2.0 W2; DeSantis, *Making Music*, "Arranging as a Subtractive Process", "The Power of
// Erasing", "Fuzzy Boundaries", "Unique Events"). Start from one loop where every part plays in every section, then
// only delete: whole parts with `silence` or `.mask()`, or notes inside a part, until the sections differ. Then blur
// one seam (a part stops a beat or two before the others change) and let one bar happen only once. What the learner
// has: sections with one `arrange()` per track and `silence` (U09.L02), the build and the energy curve (U09.L04),
// `.mask()` by bar (U09.L05), endings (U09.L06). Not yet: `.early` and `.late` (U13.L01). Spec: content/specs/U09.md.
//
// How it is graded (PLAN §5; W0 rules, docs/design/oak2/W0.md "W0 close"): S4 `carved` (the fullest section holds
// every part, every other section's bars are bars of it with parts or notes taken out, at least two different
// line-ups of parts); S5 `staggered-boundary` (at a seam some parts, not all, change a beat or more off the bar line;
// a whole-bar move or every part moving by the same amount does not count); S6 `unique-event` (one bar of a part heard
// once in the piece, inside a section that comes back, never a whole new section). The Make's one required rule is
// `carved`; the seam, the once-only bar and the arc are suggestions (PLAN §2 rule 1). The Make carves the chords, the
// bass and the tune over Oak's drums (`band.axis-4bar`, drums only), as every U09 Make does; S1, S5 and S6 carry
// drums in their own code, because what they move is a drum part. Fidelity pins: content/validate/pins/U09.L07.ts.
import { defineLesson, type HintLadder, type RubricRule } from "@oak/content-kit";

const BPM = 100;
const TEMPO = `setcpm(${BPM}/4)\n\n`;
const song = (consts: string[], tracks: string[]) => `${TEMPO}${consts.join("\n")}\n\n${tracks.join("\n")}`;

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];

// ---- One loop, every part: the doo-wop loop of Arranging in Code -----------------------------------------------

const LOOP = 'chord("<C Am F G>").voicing()';
/** Roots on beats 1, 3 and 4. */
const ROOTS = 'n("<[0 ~ 0 0] [5 ~ 5 5] [3 ~ 3 3] [4 ~ 4 4]>").scale("C2:major")';
const TUNE = 'n("<[7 ~ 4 2] [0 ~ 2 ~] [3 ~ 5 3] [4 ~ ~ ~]>").scale("C4:major")';
const SECTIONS = ["Intro", "Verse", "Chorus", "Outro"] as const;
type Section = (typeof SECTIONS)[number];
type Carve = Partial<Record<Section, string | null>>;

/**
 * Chords, bass and tune over four four-bar sections. Each part's section is the loop (`undefined`), `null` for
 * `silence`, or the given code. With `drums`, a drum line of the same shape comes first.
 */
function carved(
  o: { chords?: Carve; bass?: Carve; mel?: Carve; drums?: Carve; hats?: Carve },
  extra: string[] = [],
): string {
  const full: Record<string, string> = {
    chords: LOOP,
    bass: ROOTS,
    mel: TUNE,
    drums: 's("bd ~ sd ~ bd ~ sd ~").gain(.8)',
    hats: 's("hh*8").gain(.4)',
  };
  const tails: Record<string, string> = {
    chords: '.s("piano")',
    bass: '.s("ebass").lpf(600)',
    mel: '.s("piano")',
    drums: "",
    hats: "",
  };
  const labels = (["drums", "hats", "chords", "bass", "mel"] as const).filter(
    (l) => l === "chords" || l === "bass" || l === "mel" || o[l] !== undefined,
  );
  const consts: string[] = [];
  const tracks: string[] = [];
  for (const label of labels) {
    const by = o[label] ?? {};
    const entries = SECTIONS.map((sec) => {
      const v = by[sec];
      if (v === null) return "[4, silence]";
      consts.push(`const ${label}${sec} = ${v ?? full[label]}`);
      return `[4, ${label}${sec}]`;
    });
    tracks.push(`${label}: arrange(${entries.join(", ")})${tails[label]}`);
  }
  return song([...consts, ...extra], tracks);
}

/** Everything everywhere: every part in every section. */
const FULL = carved({});
/** The carve: chords alone in the intro, chords and bass in the verse, everything in the chorus, chords and tune out. */
const CARVE = {
  bass: { Intro: null, Outro: null },
  mel: { Intro: null, Verse: null },
} satisfies Parameters<typeof carved>[0];
const CARVED = carved(CARVE);
/** The hook's carve, with drums in its own code: the drums wait for the verse and leave for the outro. */
const HOOK_FULL = carved({ drums: {} });
const HOOK = carved({ ...CARVE, drums: { Intro: null, Outro: null } });

/** S4: every section of the starter names its own const, all the loop: the places to carve. */
const S4_STARTER = FULL;

// ---- S5: a seam. The carve above with hats of its own, a steady kick and snare through the song ------------------

const HATS_CHORUS = 's("[hh oh]*4").gain(.4)';
const seam = (hatsVerse: string, more: Carve = {}) =>
  carved({
    ...CARVE,
    hats: { Intro: null, Verse: hatsVerse, Chorus: HATS_CHORUS, Outro: null, ...more },
  }).replace(/\n\nhats:/, '\n\ndrums: s("bd ~ sd ~ bd ~ sd ~").gain(.8)\nhats:');
/** The hats stop for the last two beats before the chorus. */
const HATS_EARLY = 's("<hh*8 hh*8 hh*8 [hh*4 ~]>").gain(.4)';
const SEAM = seam(HATS_EARLY);
const S5_STARTER = seam('⟪s("hh*8")⟫.gain(.4)');

// ---- S6: verse, chorus, verse, chorus, with drums; one bar of the second verse happens once ---------------------

const VC_CONSTS = [
  'const chordsVerse = chord("<C Am F G>").voicing()',
  'const chordsChorus = chord("<F G C C>").voicing()',
  'const bassVerse = n("<0 5 3 4>").scale("C2:major")',
  'const bassChorus = n("<[3 3 3 3] [4 4 4 4] [0 0 0 0] [0 0 0 0]>").scale("C2:major")',
  `const melVerse = ${TUNE}`,
  'const melChorus = n("<[7 ~ 5 ~] [6 ~ 4 ~] [7 ~ 9 7] [7 ~ ~ ~]>").scale("C4:major")',
  'const drumsVerse = s("bd hh sd hh bd hh sd hh").gain(".8 .4 .8 .4 .8 .4 .8 .4")',
  'const drumsChorus = s("bd hh sd oh bd hh sd oh").gain(".8 .4 .8 .4 .8 .4 .8 .4")',
];
const vc = (verse2: string, more: string[] = [], chorus2 = "drumsChorus") =>
  song(
    [...VC_CONSTS, ...more],
    [
      `drums: arrange([4, drumsVerse], [4, drumsChorus], [4, ${verse2}], [4, ${chorus2}])`,
      'chords: arrange([4, chordsVerse], [4, chordsChorus], [4, chordsVerse], [4, chordsChorus]).s("piano")',
      'bass: arrange([4, bassVerse], [4, bassChorus], [4, bassVerse], [4, bassChorus]).s("ebass").lpf(600)',
      'mel: arrange([4, melVerse], [4, melChorus], [4, melVerse], [4, melChorus]).s("piano")',
    ],
  );
/** The second verse's drums: the verse three times, then a fill on the snare in the second half of its last bar. */
const FILL_BAR = "[bd hh sd hh sd sd sd sd]";
const DRUMS_VERSE2 = `const drumsVerse2 = s("<[bd hh sd hh bd hh sd hh]!3 ${FILL_BAR}>").gain(.8)`;
const ONCE = vc("drumsVerse2", [DRUMS_VERSE2]);
const S6_STARTER = vc("⟪drumsVerse⟫");

const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
/** Oak's drums under the Make: the chords, bass and tune are the learner's. */
const BAND = { band: "band.axis-4bar", tracks: ["drums"] } as const;

const rule = (id: string, fn: string, label: string, required: boolean, params = {}): RubricRule => ({
  id,
  label,
  required,
  skills: ["F06"],
  rule: "custom",
  fn,
  params,
});
const CARVED_RULE = (required: boolean) =>
  rule(
    "carved",
    "carved",
    "The fullest section has every part, every other section plays only what it plays with parts or notes taken out, and the sections play at least two different sets of parts",
    required,
    { minDiffer: 2 },
  );

export default defineLesson({
  id: "U09.L07",
  version: 1,
  title: "Carve It",
  objective:
    "I can arrange by taking parts away from a loop where everything plays, blur one seam and let one moment happen once.",
  key: { tonic: "C", mode: "major" },
  meter: "4/4",
  bpm: BPM,
  introduces: [],
  practises: ["F06", "F05"],
  terms: [
    { id: "term.fuzzy-boundary", step: "S5" },
    { id: "term.unique-event", step: "S6" },
  ],
  canDo: ["cd.compose.carve"],
  flavours: { "flavour.jazz-soul": { sounds: { "snd.piano": "snd.rhodes", "snd.ebass": "snd.upright" } } },
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Everything, then less",
      minutes: 0.5,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"] },
      example: { id: "hook", code: HOOK, bars: 16 },
      exercise: {
        kind: "listen",
        id: "everything-then-less",
        version: 1,
        role: "practice",
        prompt:
          "Listen to both versions of the same four sections. In the second, listen for which parts sit out of the opening, the second section and the end.",
        skills: [{ skill: "F06", w: 1 }],
        hints: null,
        tests: [],
        items: [
          { code: HOOK_FULL, caption: "Every part plays in every section.", bars: 16 },
          { code: HOOK, caption: "The same loop with parts taken out of three sections.", bars: 16 },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Who is left",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "who-is-left",
        version: 1,
        role: "practice",
        prompt:
          "Read the second version's code. Predict how many parts play in the verse, bars 5 to 8, then enter the number. A part that rests in a section has `silence` there.",
        skills: [{ skill: "F06", w: 1 }],
        hints: null,
        tests: [],
        code: HOOK,
        bars: 16,
        mode: "count",
        correct: 3,
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Where the bass rests",
      minutes: 1,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"] },
      example: { id: "where-the-bass-rests", code: HOOK, bars: 16 },
      exercise: {
        kind: "run-investigate",
        id: "where-the-bass-rests",
        version: 1,
        role: "practice",
        prompt:
          "Run the song with the form map open. Answer both questions below: which section plays every part, and in how many of the four sections the bass is silent.",
        skills: [{ skill: "F06", w: 1 }],
        feedbackText: {
          "investigate.wrong":
            "Not quite. Read the bass's `arrange()`: one entry per section, `silence` where it rests. Then find the section where no part says `silence`.",
        },
        hints: ladder(
          "Click each section on the form map and look at which lines have notes on the roll.",
          "In the code, each `arrange()` lists the four sections in order. Count the `silence` entries in the bass's.",
          "The bass rests where the tune also leaves the song. Only one section has no `silence` anywhere.",
        ),
        code: { starter: HOOK },
        mustPlayLoops: 1,
        questions: [
          {
            q: "choice",
            prompt: "Which section plays every part?",
            options: [
              { id: "chorus", label: "The chorus" },
              { id: "verse", label: "The verse" },
              { id: "intro", label: "The intro" },
            ],
            correct: ["chorus"],
          },
          { q: "number", prompt: "In how many of the four sections is the bass silent?", correct: 2 },
        ],
        tests: [
          { name: "both right", response: { answer: { choice: ["chorus"], number: 2 } }, expect: "pass" },
          {
            name: "the verse",
            response: { answer: { choice: ["verse"], number: 2 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "the sections where the tune is silent",
            response: { answer: { choice: ["chorus"], number: 1 } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Take parts away",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"] },
      exercise: {
        kind: "code-modify",
        id: "take-parts-away",
        version: 1,
        role: "check",
        prompt:
          "Every part plays in every section. Carve the song by deleting only: put `silence` in place of a part in a section, or mask some of its bars. Keep the chorus whole and add no notes. Done when the sections play at least two different sets of parts.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: S4_STARTER },
        reference: { solutions: [CARVED], bars: 16 },
        matcher: { m: "rubric", rules: [CARVED_RULE(true)] },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "Pick a section and a part to take out of it. The chorus stays as it is.",
          "In a track's `arrange()`, `[4, silence]` rests that part for the whole section. Its const for that section is then not needed.",
          "Rest the bass and the tune in the intro: `[4, silence]` in the first entry of both `arrange()`s.",
        ),
        tests: [
          { name: "reference", response: { code: CARVED }, expect: "pass" },
          {
            name: "masks in place of silence",
            response: {
              code: carved({
                bass: { Intro: `${ROOTS}.mask("0")`, Outro: `${ROOTS}.mask("0")` },
                mel: { Intro: `${TUNE}.mask("0")`, Verse: `${TUNE}.mask("0")` },
              }),
            },
            expect: "pass",
          },
          {
            name: "two sets: chords and bass outside the chorus",
            response: { code: carved({ mel: { Intro: null, Verse: null, Outro: null } }) },
            expect: "pass",
          },
          {
            name: "notes thinned inside parts as well: the verse's bass on beat 1 only",
            response: {
              code: carved({
                ...CARVE,
                bass: {
                  Intro: null,
                  Verse: 'n("<[0 ~ ~ ~] [5 ~ ~ ~] [3 ~ ~ ~] [4 ~ ~ ~]>").scale("C2:major")',
                  Outro: null,
                },
              }),
            },
            expect: "pass",
          },
          { name: "unchanged", response: { code: FULL }, expect: "fail", feedback: ["code.unchanged"] },
          {
            name: "silence everywhere for the tune: every section carved the same",
            response: { code: carved({ mel: { Intro: null, Verse: null, Chorus: null, Outro: null } }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a new bass line in the verse that the chorus never plays",
            response: {
              code: carved({
                ...CARVE,
                bass: {
                  Intro: null,
                  Verse: 'n("<[0 2 4 2] [5 4 2 0] [3 5 3 1] [4 ~ 6 4]>").scale("C2:major")',
                  Outro: null,
                },
              }),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "a section left out of one part's arrange()",
            response: {
              code: CARVED.replace(
                /bass: arrange\(\[4, silence\], \[4, bassVerse\], \[4, bassChorus\], \[4, silence\]\)/,
                "bass: arrange([4, silence], [4, bassVerse], [4, bassChorus])",
              ),
            },
            expect: "fail",
            feedback: ["form.inconsistent-arrange"],
          },
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Blur a seam",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"] },
      exercise: {
        kind: "code-modify",
        id: "blur-a-seam",
        version: 1,
        role: "check",
        prompt:
          "Every part changes right on the bar line where the chorus starts. Rewrite the highlighted hats of the verse so they stop for the last two beats of bar 8, while the other parts play on to the bar line.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: S5_STARTER },
        reference: { solutions: [SEAM], bars: 16 },
        matcher: {
          m: "rubric",
          rules: [
            rule(
              "seam",
              "staggered-boundary",
              "At one change of section, some parts but not all change a beat or more off the bar line",
              true,
              { min: 1 },
            ),
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "Only the verse's last bar changes, and only its second half.",
          "Give the verse's hats one item per bar with `< >`: three bars as they are, then a bar whose second half is a rest.",
          "In the last bar, `[hh*4 ~]` plays four hats in the first half of the bar and rests for the second.",
        ),
        tests: [
          { name: "reference", response: { code: SEAM }, expect: "pass" },
          {
            name: "the rest written as two beats",
            response: { code: seam('s("<hh*8 hh*8 hh*8 [hh hh hh hh ~ ~ ~ ~]>").gain(.4)') },
            expect: "pass",
          },
          {
            name: "the last bar with !",
            response: { code: seam('s("<[hh*8]!3 [hh*4 ~]>").gain(.4)') },
            expect: "pass",
          },
          {
            name: "stopping one beat early",
            response: { code: seam('s("<hh*8 hh*8 hh*8 [hh hh hh hh hh hh ~ ~]>").gain(.4)') },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: seam('s("hh*8").gain(.4)') },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the hats silent for the whole last bar: a move on the bar line",
            response: { code: seam('s("<hh*8 hh*8 hh*8 ~>").gain(.4)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the first half of the bar silenced instead",
            response: { code: seam('s("<hh*8 hh*8 hh*8 [~ hh*4]>").gain(.4)') },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Once only",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"] },
      exercise: {
        kind: "code-modify",
        id: "once-only",
        version: 1,
        role: "check",
        prompt:
          "Verse, chorus, verse, chorus: the second verse plays the first one's drums. Write a `drumsVerse2` const and put it in the highlighted place, so the last bar of the second verse, bar 12, plays a drum fill or a stop. Done when that bar is heard once in the whole song.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: S6_STARTER },
        reference: { solutions: [ONCE], bars: 16 },
        matcher: {
          m: "rubric",
          rules: [
            rule(
              "once",
              "unique-event",
              "One bar of one part is heard only once, inside a section that comes back",
              true,
              { min: 1 },
            ),
          ],
        },
        target: { audible: true, showRoll: false, revealRollAfter: 1 },
        hints: ladder(
          "The second verse needs drums of its own, the same as the first verse's except in its last bar.",
          "Copy `drumsVerse` into a new const, `drumsVerse2`, give it one item per bar with `< >`, and name it in the third entry of the drums' `arrange()`.",
          "Three bars of the verse's beat with `!3`, then a fourth bar of your own: snare hits filling its second half, or one kick and a crash and three beats of rest.",
        ),
        tests: [
          { name: "reference", response: { code: ONCE }, expect: "pass" },
          {
            name: "a stop: one kick and crash, then three beats of rest",
            response: {
              code: vc("drumsVerse2", [
                'const drumsVerse2 = s("<[bd hh sd hh bd hh sd hh]!3 [[bd,cr] ~ ~ ~]>").gain(.8)',
              ]),
            },
            expect: "pass",
          },
          {
            name: "a fill on the toms",
            response: {
              code: vc("drumsVerse2", [
                'const drumsVerse2 = s("<[bd hh sd hh bd hh sd hh]!3 [bd hh sd hh ht mt lt lt]>").gain(.8)',
              ]),
            },
            expect: "pass",
          },
          {
            name: "the fill in bar 10 instead of bar 12",
            response: {
              code: vc("drumsVerse2", [
                `const drumsVerse2 = s("<[bd hh sd hh bd hh sd hh] ${FILL_BAR} [bd hh sd hh bd hh sd hh]!2>").gain(.8)`,
              ]),
            },
            expect: "pass",
          },
          {
            name: "unchanged",
            response: { code: vc("drumsVerse") },
            expect: "fail",
            feedback: ["code.unchanged"],
          },
          {
            name: "the fill written into drumsVerse: heard in both verses",
            response: {
              code: vc("drumsVerse").replace(
                'const drumsVerse = s("bd hh sd hh bd hh sd hh").gain(".8 .4 .8 .4 .8 .4 .8 .4")',
                `const drumsVerse = s("<[bd hh sd hh bd hh sd hh]!3 ${FILL_BAR}>").gain(.8)`,
              ),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "drumsVerse2 written but left out of the arrange()",
            response: { code: vc("drumsVerse", [DRUMS_VERSE2]) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Carve your song",
      minutes: 2.75,
      ui: { panels: ROLL, rollLabels: "degree", initialPanels: ["form"], band: BAND },
      exercise: {
        kind: "code-make",
        id: "carve-your-song",
        version: 1,
        role: "practice",
        prompt:
          "Every part of your song plays in every section, over Oak's drums. Carve it by deleting only: rest parts with `silence`, mask bars, or take notes out of a part, and keep one section whole. Done when the sections play at least two different sets of parts.",
        skills: [{ skill: "F06", w: 1 }],
        code: { starter: FULL },
        bars: [16, 32],
        saveAs: "sketch",
        rubric: [
          CARVED_RULE(true),
          rule(
            "seam",
            "staggered-boundary",
            "At one change of section, a part stops, carries on or comes in a beat or more off the bar line",
            false,
            { min: 1 },
          ),
          rule("once", "unique-event", "One bar heard only once, inside a section you play twice", false, {
            min: 1,
          }),
          rule("arc", "arc", "The fullest section has a thinner section before it and after it", false),
        ],
        // The override serves every rule of the rubric, suggestions included, so it stays neutral.
        feedbackText: { "rubric.unmet": "{label}: not yet." },
        hints: ladder(
          "Choose the section that keeps every part. Each of the others loses something.",
          "Write `[4, silence]` for a part in a section, or `.mask()` on its const there. Thinning notes is fine too, as long as you add none.",
          "Try the tune only in the chorus and the outro, and the bass out of the intro and the outro.",
        ),
        tests: [
          {
            name: "minimal: the tune only in the chorus",
            response: { code: carved({ mel: { Intro: null, Verse: null, Outro: null } }) },
            expect: "pass",
          },
          { name: "the lesson's carve", response: { code: CARVED }, expect: "pass" },
          {
            name: "beyond the brief: thinned notes, a verse and chorus twice, a bar heard once",
            response: {
              code: song(
                [
                  `const chordsIntro = ${LOOP}.mask("<0 1 1 1>")`,
                  `const chordsVerse = ${LOOP}`,
                  `const chordsChorus = ${LOOP}`,
                  `const chordsVerse2 = ${LOOP}.mask("<1 1 1 0>")`,
                  'const bassVerse = n("<[0 ~ ~ ~] [5 ~ ~ ~] [3 ~ ~ ~] [4 ~ ~ ~]>").scale("C2:major")',
                  `const bassChorus = ${ROOTS}`,
                  'const bassVerse2 = n("<[0 ~ 0 0] [5 ~ 5 5] [3 ~ 3 3] [4 ~ 4 ~]>").scale("C2:major")',
                  `const melChorus = ${TUNE}`,
                ],
                [
                  'chords: arrange([4, chordsIntro], [4, chordsVerse], [4, chordsChorus], [4, chordsVerse2], [4, chordsChorus]).s("piano")',
                  'bass: arrange([4, silence], [4, bassVerse], [4, bassChorus], [4, bassVerse2], [4, bassChorus]).s("ebass").lpf(600)',
                  'mel: arrange([4, silence], [4, silence], [4, melChorus], [4, silence], [4, melChorus]).s("piano")',
                ],
              ),
            },
            expect: "pass",
          },
          {
            name: "the starter as it is",
            response: { code: FULL },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "the tune taken out of every section: all four still the same",
            response: { code: carved({ mel: { Intro: null, Verse: null, Chorus: null, Outro: null } }) },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
          {
            name: "an intro with a new tune the chorus never plays",
            response: {
              code: carved({
                bass: { Intro: null },
                mel: { Intro: 'n("<[9 ~ 7 ~] [7 ~ 5 ~] [8 ~ 6 ~] [6 ~ ~ ~]>").scale("C4:major")' },
              }),
            },
            expect: "fail",
            feedback: ["rubric.unmet"],
          },
        ],
      },
    },
  ],
});
