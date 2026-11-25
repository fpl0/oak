// A2.L09 applies U09.L07's fuzzy boundary and unique event to the A2 loop.
// W0's anticipation is Oak's call: all drums leave the first half beat empty; X14 round 2 adds that the fill
// peaks in the bar's second half, the downbeat is usually played, and a hesitating fill runs on after the downbeat.
// Its fill rules compare drum-hit counts; the labels expose those exact checks.
// S6 starts without a fill so an earlier one-time fill cannot satisfy its rule.
import {
  defineLesson,
  type HintLadder,
  type RubricRule,
  type SkillWeight,
  type TestCase,
} from "@oak/content-kit";

const ladder = (nudge: string, pointer: string, partial: string): HintLadder => [
  { text: nudge },
  { text: pointer },
  { text: partial },
  "auto",
];
const NONE = { roll: false, staff: false, keyboard: false } as const;
const ROLL = { roll: true, staff: false, keyboard: false } as const;
const BAND = { band: "band.aeolian-4bar", tracks: ["chords"] } as const;
const SKILLS: SkillWeight[] = [
  { skill: "F06", w: 0.7 },
  { skill: "D09", w: 0.3 },
];

// These are A2.L03's actual bass, chords and tune, including their registers and controls.
const BASS = 'note("<a1 f1 c2 g1>")';
const CHORDS = 'n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>")';
const TUNE = 'n("<[4 ~ 2 0] [2 ~ 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")';
const BACKBEAT = "~ sd ~ sd";
const verseFill = (fill: string) => `s("<[${BACKBEAT}] [${BACKBEAT}] [${BACKBEAT}] [${fill}]>")`;
const chorusFill = (fill: string) => `s("<[${fill}] [${BACKBEAT}] [${BACKBEAT}] [${BACKBEAT}]>")`;

type Part = "kick" | "snare" | "hats" | "perc" | "bass" | "chords" | "mel";
type Section = "Verse" | "Chorus" | "Verse2" | "Chorus2";
type Changes = Partial<Record<`${Part}${Section}`, string>>;
const PARTS: Part[] = ["kick", "snare", "hats", "perc", "bass", "chords", "mel"];
const SECTIONS: Section[] = ["Verse", "Chorus", "Verse2", "Chorus2"];
const BASE: Record<Part, [string, string]> = {
  kick: ['s("bd ~ bd ~")', 's("bd*4")'],
  snare: [`s("${BACKBEAT}")`, `s("${BACKBEAT}")`],
  hats: ['s("hh*8")', 's("hh*16")'],
  perc: ["silence", 's("<~ [cr ~ ~ ~] ~ ~>")'],
  bass: [BASS, BASS],
  chords: [CHORDS, CHORDS],
  mel: [TUNE, TUNE],
};
const TAIL: Record<Part, string> = {
  kick: "",
  snare: "",
  hats: ".gain(.5)",
  perc: ".gain(.5)",
  bass: '.s("sawtooth").lpf(400)',
  chords: '.scale("A3:minor").s("piano").gain(.5)',
  mel: '.scale("A4:minor").s("square").lpf(2000).gain(.5)',
};
function song(changes: Changes = {}, drumsOnly = false, selected?: Part[]): string {
  const parts = selected ?? (drumsOnly ? PARTS.filter((p) => !["bass", "chords", "mel"].includes(p)) : PARTS);
  const defs = parts.flatMap((p) =>
    SECTIONS.map((s, i) => `const ${p}${s} = ${changes[`${p}${s}`] ?? BASE[p][i % 2]}`),
  );
  const tracks = parts.map(
    (p) =>
      `${p}: arrange(${SECTIONS.map((s) => `[4, ${p}${s}]`).join(", ")})${TAIL[p] ? `\n  ${TAIL[p]}` : ""}`,
  );
  return `setcpm(90/4)\n\n${defs.join("\n")}\n\n${tracks.join("\n")}`;
}
const GAP: Changes = {
  kickChorus: 's("<[~ bd bd bd] bd*4 bd*4 bd*4>")',
  hatsChorus: 's("<[~ hh*4 hh*4 hh*4] hh*16 hh*16 hh*16>")',
};
const ANTICIPATE = { ...GAP, snareVerse: verseFill("sd*4 sd*4 sd*4 ~") };
const HESITATE = {
  snareVerse: verseFill("~ sd sd*4 sd*4"),
  snareChorus: chorusFill("sd*4 sd ~ sd"),
};
const EARLY_HATS = { hatsVerse: 's("<hh*8 hh*8 hh*8 [hh*4 ~]>")' };
const PLAIN = song();
const EARLY = song(ANTICIPATE);
// The S3 example (and S1's second item): the book's anticipation (Fuzzy Boundaries) brings the drums back on beat 2
// of the new section with a crash, so the crash lands with the drums' return in bar 5 (W5, owner item 13; it was in
// bar 6). S4's reference stays EARLY: the learner is not asked to move the crash.
const GAP_AND_CRASH = song({ ...ANTICIPATE, percChorus: 's("<[~ cr ~ ~] ~ ~ ~>")' });
const LATE = song(HESITATE);
const UNIQUE = song().replace(".lpf(2000)", '.lpf("<2000!9 400 2000!6>")');
const MAKE_STARTER = song({}, true);
const MAKE_REFERENCE = song(EARLY_HATS, true);
const TOM_EARLY = song({ ...GAP, snareVerse: verseFill("lt*4 mt*4 ht*4 ~") });
const TOM_LATE = song({ snareVerse: verseFill("~ sd lt*4 mt*4"), snareChorus: chorusFill("ht*4 sd ~ sd") });
const REPEATED_EFFECT = song().replace(".lpf(2000)", '.lpf("<2000 400 2000!6 2000 400 2000!6>")');
const WRONG_QUOTES = (code: string) => code.replace('s("bd ~ bd ~")', "s('bd ~ bd ~')");
// Every part drops its last beat together; a written fill alone is not enough for anticipation.
const ALL_STOP = `setcpm(90/4)

const drumsVerse = s("<[bd sd bd sd] [bd sd bd sd] [bd sd bd sd] [bd sd*4 sd*4 ~]>")
const drumsChorus = s("bd*4")
const bassVerse = note("<[a1 a1 a1 a1] [a1 a1 a1 a1] [a1 a1 a1 a1] [a1 a1 a1 ~]>")
const bassChorus = note("c2*4")

drums: arrange([4, drumsVerse], [4, drumsChorus], [4, drumsVerse], [4, drumsChorus])
bass: arrange([4, bassVerse], [4, bassChorus], [4, bassVerse], [4, bassChorus])
  .s("sawtooth").lpf(400)`;
const BASS_HOLD =
  MAKE_STARTER.replace(
    "\n\nkick:",
    `
const bassVerse = note("a1*4")
const bassChorus = note("<[a1@2 c2 c2] c2*4 c2*4 c2*4>")

kick:`,
  ) +
  `
bass: arrange([4, bassVerse], [4, bassChorus], [4, bassVerse], [4, bassChorus])
  .s("sawtooth").lpf(400)`;
const OFF_GRID = song({ melVerse2: 'n("<[4 ~ 2 0] [2 [~ 0 ~ ~] 0 ~] [4 2 4 ~] [1 ~ 6 ~]>")' });

const boundary = (fill?: "anticipate" | "hesitate", wholeBars = false): RubricRule => ({
  id: fill ?? "fuzzy-seam",
  label:
    fill === "anticipate"
      ? "A drum fill toward the end of a section's last bar (more hits than its earlier bars); no drum in the next section's first half beat, where one usually plays"
      : fill === "hesitate"
        ? "A drum fill toward the end of a section's last bar (more hits than its earlier bars) that runs on: more drum hits just after the next section's downbeat than in its later first beats"
        : "Some parts change a beat or more off the bar line at a seam, without every changing part moving together",
  required: true,
  skills: ["F06", "D09"],
  rule: "custom",
  fn: "staggered-boundary",
  // `wholeBars` (W5): in the Make a part may stay, rest or arrive a whole bar off the seam (Fuzzy Boundaries).
  params: { min: 1, ...(fill ? { fill } : {}), ...(wholeBars ? { wholeBars } : {}) },
});
const unique = (required = true): RubricRule => ({
  id: "heard-once",
  label: "A part changes or stops for one bar only, inside a verse or chorus that returns",
  required,
  skills: ["F06", "D09"],
  rule: "custom",
  fn: "unique-event",
  params: { min: 1, controls: true },
});
// Failure codes below were copied from content:check --verbose.
const test = (
  name: string,
  code: string,
  expect: "pass" | "fail",
  feedback: NonNullable<TestCase["feedback"]> = [],
): TestCase => ({ name, response: { code }, expect, feedback });
const feedback = {
  "rubric.unmet": "{label}: not yet. Compare the last verse bar and the first chorus bar on the roll.",
};

export default defineLesson({
  id: "A2.L09",
  version: 2,
  title: "Seams and Surprises",
  objective: "Fills that anticipate or hesitate across a seam; an effect switched on once.",
  key: { tonic: "A", mode: "minor" },
  meter: "4/4",
  bpm: 90,
  introduces: [],
  practises: ["F06", "D09"],
  terms: [],
  canDo: ["cd.compose.seams"],
  wrapAt: "S4",
  steps: [
    {
      id: "S1",
      kind: "listen",
      title: "Three ways across",
      // Three items of six bars (the verse's four, the chorus's first two: the seam and the crash after it) play
      // 48 s; a listen step's items fill at most 85 % of its minutes (wave7-learner.test.ts), so 1 minute.
      minutes: 1,
      ui: { panels: ROLL },
      exercise: {
        kind: "listen",
        id: "three-seams",
        version: 1,
        role: "practice",
        prompt:
          "Listen for where the drums stop against the chorus's first beat at bar 5 in each version. In the second version, listen for the gap before the drums return.",
        skills: SKILLS,
        hints: null,
        tests: [],
        items: [
          { code: PLAIN, bars: 6, caption: "Follow the drums into the chorus." },
          { code: GAP_AND_CRASH, bars: 6, caption: "Listen for space around the chorus's first beat." },
          { code: LATE, bars: 6, caption: "Follow the busy snare beyond the bar line." },
        ],
      },
    },
    {
      id: "S2",
      kind: "predict",
      title: "Where it ends",
      minutes: 0.5,
      ui: { panels: NONE },
      exercise: {
        kind: "predict",
        id: "fill-ending",
        version: 1,
        role: "practice",
        prompt:
          "Predict where the busy snare fill in the code ends relative to the chorus at bar 5. Pick one answer, then listen.",
        skills: SKILLS,
        hints: null,
        tests: [],
        code: LATE,
        bars: 8,
        mode: "choose",
        choices: [
          { id: "before", label: "Inside the verse" },
          { id: "after", label: "After the chorus has started" },
          { id: "end", label: "At the end of the chorus" },
        ],
        correct: ["after"],
      },
    },
    {
      id: "S3",
      kind: "investigate",
      title: "Find the crash",
      minutes: 1,
      ui: { panels: ROLL, initialPanels: ["form"] },
      example: { id: "gap-and-crash", code: GAP_AND_CRASH, bars: 8 },
      exercise: {
        kind: "run-investigate",
        id: "crash-place",
        // 2 (W5, owner item 13): the crash moved to bar 5, beat 2, with the drums' return; so did the answer.
        version: 2,
        role: "practice",
        prompt:
          "Find where the crash on the perc line lands relative to the fill and the drum gap at bar 5. Pick its bar and beat below.",
        skills: SKILLS,
        code: { starter: GAP_AND_CRASH },
        mustPlayLoops: 1,
        feedbackText: {
          "investigate.wrong":
            "Not quite. Follow the perc line into the chorus and count the rests before its crash in the chorus's first bar.",
        },
        hints: ladder(
          "Follow the splashy cymbal after the fill. Does it land with the first returning drums or later?",
          "Read the chorus pattern in percChorus. Each item between angle brackets takes one bar.",
          "The chorus begins at bar 5, the first item of percChorus. Count the rests before `cr` inside it: each one is a beat.",
        ),
        questions: [
          {
            q: "choice",
            prompt: "Where is the first crash?",
            options: [
              { id: "five", label: "Bar 5, beat 1: at the start of the drum gap" },
              { id: "return", label: "Bar 5, beat 2: with the drums' return" },
              { id: "six", label: "Bar 6, beat 1: a bar after the drums' return" },
              { id: "four", label: "Bar 4, beat 4: before the chorus" },
            ],
            correct: ["return"],
          },
        ],
        tests: [
          {
            name: "crash with the drums' return",
            response: { answer: { choice: ["return"] } },
            expect: "pass",
          },
          {
            name: "crash placed on the gap",
            response: { answer: { choice: ["five"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
          {
            name: "crash a bar later, where it was before W5",
            response: { answer: { choice: ["six"] } },
            expect: "fail",
            feedback: ["investigate.wrong"],
          },
        ],
      },
    },
    {
      id: "S4",
      kind: "modify",
      title: "Leave a gap",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, initialPanels: ["form"] },
      exercise: {
        kind: "code-modify",
        id: "anticipating-fill",
        version: 1,
        role: "check",
        prompt:
          "Add a snare fill at the end of bar 4, then silence every drum for the first half of bar 5's first beat and bring the groove back later in that bar. Keep bass, chords and tune unchanged. Done when bar 4 ends with extra drum hits and no drum plays in the first half of bar 5's first beat.",
        skills: SKILLS,
        code: { starter: PLAIN },
        reference: { solutions: [EARLY], bars: 16 },
        matcher: { m: "rubric", rules: [boundary("anticipate")] },
        target: { audible: true, showRoll: false },
        feedbackText: feedback,
        hints: ladder(
          "Compare the end of the first verse with the start of the chorus. Every drum line needs to leave room there.",
          "kickChorus and hatsChorus each repeat one bar. Use angle brackets for one pattern per bar if only bar 5 should rest, or put rests at the start of every chorus bar. Check snare and perc too.",
          "Make the end of the verse busier, then put rests at the start of the chorus drum patterns. Leave their later hits available to restart the groove.",
        ),
        tests: [
          test("reference", EARLY, "pass"),
          test("tom fill", TOM_EARLY, "pass"),
          test("shorter snare fill", song({ ...GAP, snareVerse: verseFill("~ sd*4 sd*4 ~") }), "pass"),
          test(
            "fill spread as triplets",
            song({ ...GAP, snareVerse: verseFill("sd*3 sd*3 sd*3 ~") }),
            "pass",
          ),
          test("unchanged", PLAIN, "fail", ["code.unchanged"]),
          test("all parts stop early together but return on the downbeat", ALL_STOP, "fail", [
            "rubric.unmet",
          ]),
          test(
            "fill written but kick and hats keep the downbeat",
            song({ snareVerse: ANTICIPATE.snareVerse }),
            "fail",
            ["rubric.unmet"],
          ),
          test("single quotes while editing the kick", WRONG_QUOTES(EARLY), "fail", [
            "code.single-quoted-pattern",
          ]),
        ],
      },
    },
    {
      id: "S5",
      kind: "modify",
      title: "Cross the seam",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, initialPanels: ["form"] },
      exercise: {
        kind: "code-modify",
        id: "hesitating-fill",
        version: 1,
        role: "check",
        prompt:
          "Extend the snare fill from bar 4 into the first beat or two of bar 5 only. Keep the other parts unchanged and the plain backbeat in bars 6 to 8. Done when bar 5's first beat has extra snare hits after the downbeat and bars 6 to 8 start as before.",
        skills: SKILLS,
        code: { starter: song({ snareVerse: HESITATE.snareVerse }) },
        reference: { solutions: [LATE], bars: 16 },
        matcher: { m: "rubric", rules: [boundary("hesitate")] },
        target: { audible: true, showRoll: false },
        feedbackText: feedback,
        hints: ladder(
          "Follow the snare across the bar line. Its extra hits need to continue after the chorus begins.",
          "snareChorus repeats one bar. Give it one pattern per bar with angle brackets, as snareVerse has; put the spill in the first bar and keep the later backbeats.",
          "Keep a small group of quick snare hits at the front of the chorus pattern, then return to the regular backbeat within that bar.",
        ),
        tests: [
          test("reference", LATE, "pass"),
          test("tom fill carries over", TOM_LATE, "pass"),
          test("triplets carry over", song({ ...HESITATE, snareChorus: chorusFill("sd*3 sd ~ sd") }), "pass"),
          test(
            "fill continues for two beats",
            song({ ...HESITATE, snareChorus: chorusFill("sd*4 sd*4 ~ sd") }),
            "pass",
          ),
          test("unchanged", song({ snareVerse: HESITATE.snareVerse }), "fail", ["code.unchanged"]),
          test(
            "fill added only before the seam",
            song({ snareVerse: verseFill("sd*4 sd*4 sd*4 sd*4") }),
            "fail",
            ["rubric.unmet"],
          ),
          test(
            "the crash moved onto bar 5's downbeat: it marks the seam",
            song({ snareVerse: HESITATE.snareVerse, percChorus: 's("<[cr ~ ~ ~] ~ ~ ~>")' }),
            "fail",
            ["rubric.unmet"],
          ),
          test(
            "fill on beat 1 of every chorus bar",
            song({ ...HESITATE, snareChorus: 's("sd*4 sd ~ sd")' }),
            "fail",
            ["rubric.unmet"],
          ),
          test("single quotes while editing the kick", WRONG_QUOTES(LATE), "fail", [
            "code.single-quoted-pattern",
          ]),
        ],
      },
    },
    {
      id: "S6",
      kind: "modify",
      title: "Heard only once",
      minutes: 1.25,
      graded: true,
      ui: { panels: ROLL, initialPanels: ["form"] },
      exercise: {
        kind: "code-modify",
        id: "one-bar-effect",
        version: 1,
        role: "check",
        prompt:
          "Change the tune's filter for one bar of the second verse, then return it to its usual sound. Done when that changed sound is heard in one bar and nowhere else in the sixteen bars.",
        skills: SKILLS,
        code: { starter: PLAIN },
        reference: { solutions: [UNIQUE], bars: 16 },
        matcher: { m: "rubric", rules: [unique()] },
        target: { audible: true, showRoll: false },
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Compare the changed bar with both verses and both choruses; keep the change in one bar of a section that returns.",
        },
        hints: ladder(
          "Follow the tune through both verses. A change repeated in each verse is familiar by the second time.",
          "Put the control pattern after arrange so it runs across all sixteen bars. The second verse starts at bar 9.",
          "Use angle brackets for one control value per bar: usual values around a different value, followed by the usual sound again.",
        ),
        tests: [
          test("reference", UNIQUE, "pass"),
          test(
            "room for one bar instead",
            song().replace(".gain(.5)", '.gain(.5).room("<0!9 .8 0!6>")'),
            "pass",
          ),
          test(
            "filter in the chorus instead",
            song().replace(".lpf(2000)", '.lpf("<2000!5 500 2000!10>")'),
            "pass",
          ),
          test("one off-grid note instead", OFF_GRID, "pass"),
          test("unchanged", PLAIN, "fail", ["code.unchanged"]),
          test("same effect in both verses", REPEATED_EFFECT, "fail", ["rubric.unmet"]),
          test(
            "same effect in a different bar of each verse: heard twice",
            song().replace(".lpf(2000)", '.lpf("<2000 400 2000!8 400 2000!5>")'),
            "fail",
            ["rubric.unmet"],
          ),
          test("filter changed for the whole song", song().replace(".lpf(2000)", ".lpf(400)"), "fail", [
            "rubric.unmet",
          ]),
          test("single quotes while editing the kick", WRONG_QUOTES(UNIQUE), "fail", [
            "code.single-quoted-pattern",
          ]),
        ],
      },
    },
    {
      id: "S7",
      kind: "make",
      title: "Your blurred seam",
      minutes: 2.75,
      ui: { panels: ROLL, band: BAND, initialPanels: ["form"] },
      exercise: {
        kind: "code-make",
        id: "seams-and-surprises",
        version: 2,
        role: "practice",
        prompt:
          "Write your verse, chorus, verse, chorus over the Band's A minor chords, four bars each. Blur a seam by letting a part leave early, stay late or enter late. Done when some parts change off the bar line while others keep the seam in place. Try adding a sound heard once.",
        skills: SKILLS,
        code: { starter: MAKE_STARTER },
        bars: [16, 16],
        saveAs: "sketch",
        rubric: [boundary(undefined, true), unique(false)],
        feedbackText: {
          "rubric.unmet":
            "{label}: not yet. Compare the parts around each section change and the bars that return.",
        },
        hints: ladder(
          "Choose a verse-to-chorus change and follow one part through it. Let that part leave or arrive at a different time from the rest.",
          "The last verse bar and first chorus bar are the places to edit. Keep another changing part on the bar line.",
          "Try removing the last few hits from a busy part, or carrying its verse pattern into part of the first chorus bar.",
        ),
        tests: [
          test("reference: hats leave early", MAKE_REFERENCE, "pass"),
          test("minimal: kick and hats only", song(EARLY_HATS, true, ["kick", "hats"]), "pass"),
          test("bass holds into chorus", BASS_HOLD, "pass"),
          test(
            "beyond: snare fill and a one-time room change",
            song(HESITATE, true).replace(".gain(.5)", '.gain(.5).room("<0!9 .8 0!6>")'),
            "pass",
          ),
          test("unchanged", MAKE_STARTER, "fail", ["rubric.unmet"]),
          // The three drum lines all leave one beat early together: that only moves the seam. `perc`, silent on
          // both sides of the bar line, does not mark it (X14 round 2: the rule once read it as changing there).
          test(
            "verse drums leave one beat early together",
            song(
              {
                kickVerse: 's("<bd*8 bd*8 bd*8 [bd bd bd bd bd bd ~ ~]>")',
                snareVerse: 's("<sd*8 sd*8 sd*8 [sd sd sd sd sd sd ~ ~]>")',
                hatsVerse: 's("<hh*8 hh*8 hh*8 [hh hh hh hh hh hh ~ ~]>")',
              },
              true,
            ),
            "fail",
            ["rubric.unmet"],
          ),
          test(
            "only a louder chorus",
            MAKE_STARTER.replace('hatsChorus = s("hh*16")', 'hatsChorus = s("hh*16").gain(.8)'),
            "fail",
            ["rubric.unmet"],
          ),
          test("single quotes while editing the kick", WRONG_QUOTES(MAKE_REFERENCE), "fail", [
            "code.single-quoted-pattern",
          ]),
        ],
      },
    },
  ],
});
