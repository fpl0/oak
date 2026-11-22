// J.CP2 Jazz checkpoint 2 (contracts §7.6; AUTHORING §10), the second checkpoint of the Jazz Harmony track. It
// covers J2.L04, J3, J4 and J5.L01–L04 (`CHECKPOINT_LESSON_EXCEPTIONS`: J5.L05 is enrichment, in no checkpoint)
// and, passed or soft-passed, opens JC3 "Rhythm-Changes Contrafact" and JC4 "Reharmonize a Standard"; it gates
// nothing else (track checkpoints gate only their track's capstones, §7.6 rule 5). Its file sits in the folder of
// the last unit it covers, as U09.CP and U13.CP do.
//
// The generated items come from the families that give evidence for a gated skill: which scale fits this chord in
// this key (J03, `fam.jzz.chord-scale`), rootless and drop-2 voicings by ear (J09, `fam.jzz.voicing` levels 2–3) and
// V7, ♭II7 or the backdoor by ear (J13, `fam.jzz.subs`). J10, J11, J12 and B05 have no family (`deck.jzz.forms` is a
// deck, and a deck gives no checkpoint item), so the authored items measure them, each in a key or a place no
// lesson step used:
// - rhythm-changes-from-numerals: the bridge of rhythm changes in B♭ written by name from its numerals, two bars a
//   chord, and the A section's last two bars turned into the turnaround back to the top (J12, J10);
// - walk-the-blues: bars 5–8 of a jazz blues in F, B♭7 B°7 F7 D7, walked by hand (B05, J11);
// - two-devices-under-the-tune: the last A of rhythm changes in B♭ under a tune on the muted trumpet, reharmonized
//   with two different devices while the tune stays as it is (J13, J14).
// The Make is eight bars of the learner's own over the A section of rhythm changes in B♭: one jazz device placed
// where they hear room for it is the one required rule (J14); a walking bass and a top line are suggestions.
// Spec: content/specs/J5.md, "J.CP2 Jazz checkpoint 2".
//
// The corrections-pass standard (AUTHORING §20.2), on every item and the Make:
// - every required rule checks what is HEARD: the chords' pitch classes and lowest note at every onset (`pcset`
//   with the bass) over sixteen bars; a walk read note by note against the changes (`walking-bass`: an attack on
//   every beat, roots on 1, chord tones on 3, a step into the next bar); the devices counted among the chords that
//   SOUND and differ from the starter's, with the tune kept note for note (`reharmonize` with `devices`); the
//   Make's device read from the chords that sound;
// - each item pins a WRONG answer that uses the right function: the bridge one bar a chord, `D^7` for `D7`, four
//   notes crowded into beat 1 of each bar, a walk whose beat 4 lands on the next root, one device written twice,
//   a tune bent to fit, the right substitute on a muted chords line;
// - each code item passes three other right answers besides its reference.
// Feedback never names the answer: every override describes the sound and the place.
//
// Every bass under a device is written by hand: the grader reads a `rootNotes()` line's chord symbols as harmony
// (the J5 spec's gap 1), so a device written by name on a muted chords line would still count over it.
//
// No sung or tapped item (contracts §7.6, §8): a learner in Quiet mode passes the same checkpoint. J.CP2 follows
// J5.L04, so the whole core is behind the learner (J5 opens after U17.CP): every tool and word here is theirs.
import { type CheckpointDef, defineCheckpoint, type KeySpec, type RubricRule } from "@oak/content-kit";

const BPM = 160;
const tempo = (bpm: number) => `setcpm(${bpm}/4)\n\n`;
const at = (bpm: number, ...lines: string[]) => `${tempo(bpm)}${lines.join("\n")}`;
const plain = (starter: string) => starter.replace(/[⟪⟫]/g, "");

const B_FLAT: KeySpec = { tonic: "Bb", mode: "major" };
const SWING = ".swingBy(1/3, 4)";
/** J1.L01's swing pocket: the ride pattern and the hi-hat on 2 and 4, on the jazz kit. */
const RIDE = `drums: s("rd [rd rd] rd [rd rd]")${SWING}.bank("jazzkit")`;
const HATS = 'hats: s("~ hh ~ hh").bank("jazzkit")';

// --- rhythm-changes-from-numerals ---------------------------------------------------------------------------

// The Rhodes comps on beats 1, 3 and 4: every chord of a two-chord bar, and the second of a pair on beat 4, sounds
// (a Charleston, 1 and the "and" of 2, would leave the second half of each bar's harmony to the bass alone).

/** Rhythm changes' A section in B♭, bars 1–6 (theory `schema.rhythm-a`): I vi ii V twice, I I7 IV iv. */
const A_HEAD = "[Bb^7 Gm7] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7]";
const formLines = [
  'chords: arrange([8, chord(changesA).voicing()], [8, chord(changesB).voicing()]).struct("x ~ x x").s("rhodes")',
  'bass: arrange([8, chord(changesA).rootNotes(2)], [8, chord(changesB).rootNotes(2)]).struct("x x x x").s("upright")',
];
const form = (end: string, bridge: string) =>
  at(
    BPM,
    `const changesA = "<${A_HEAD} ${end}>"`,
    `const changesB = "<${bridge}>"`,
    "",
    RIDE,
    HATS,
    ...formLines,
  );
const FORM_STARTER = at(
  BPM,
  `const changesA = "<${A_HEAD} ⟪Bb^7 F7 Bb^7⟫>"`,
  'const changesB = "<⟪Bb^7⟫>"',
  "",
  RIDE,
  HATS,
  ...formLines,
);
const TURNAROUND = "[Bb^7 Gm7] [Cm7 F7]";
const BRIDGE = "D7 D7 G7 G7 C7 C7 F7 F7";
const FORM_SOLUTION = form(TURNAROUND, BRIDGE);

// --- walk-the-blues -----------------------------------------------------------------------------------------

const WALK_BPM = 132;
/** Bars 5–8 of the jazz blues in F: IV7, the diminished chord on its raised root, I7, and VI7 leaning into bar 9. */
const BLUES_5_8 = ["Bb7", "Bo7", "F7", "D7"];
const walkPiece = (bassLine: string) =>
  at(
    WALK_BPM,
    `const changes = "<${BLUES_5_8.join(" ")}>"`,
    "",
    RIDE,
    HATS,
    'chords: chord(changes).dict("lefthand").voicing().struct("~ x ~ [~ x]").swingBy(1/3, 4).s("piano")',
    bassLine,
  );
const walk = (notes: string, tail = "") => `bass: note("<${notes}>")${tail}.s("upright")`;
const WALK_STARTER = walkPiece('bass: note("<⟪bb1 b1 f1 d2⟫>").s("upright")');
/**
 * Root, 3rd, 5th, then a step into the next bar: B♭ D F A | B D F G♭ | F A C E♭ | D A F♯ C, back to B♭. Every beat 4
 * is a whole or a half step from the next bar's first note; every beat 3 is a chord tone.
 */
const WALK = "[bb1 d2 f2 a1] [b1 d2 f2 gb2] [f2 a2 c3 eb3] [d3 a2 f#2 c2]";
const WALK_SOLUTION = walkPiece(walk(WALK));
const WALK_RULE: RubricRule = {
  id: "walks",
  label:
    "In every bar: a bass note on every beat, the root on beat 1, a chord tone on beat 3, and beat 4 a step or less from the next bar's first note",
  required: true,
  skills: ["B05", "J11"],
  rule: "custom",
  fn: "walking-bass",
  params: {
    bass: "bass",
    changes: BLUES_5_8,
    // Every bar, as the prompt asks (review: at 0.75 and 0.5 a 5th leap back to bar 1 passed).
    rootOnOne: 1,
    chordToneOnThree: 1,
    approachOnFour: 1,
    maxSemis: 2,
  },
};

// --- two-devices-under-the-tune -----------------------------------------------------------------------------

const DEVICES = ["tritone sub", "secondary ii–V", "backdoor", "diminished passing"] as const;
/**
 * Oak's own eight-bar tune for the last A, on the muted trumpet. Its long notes agree with the plain chords and with
 * the devices that fit under them: the D of bar 1 is the root of D–7 and the 5th of G7, its F the 7th of G7; the
 * E♭ of bar 7 is the 7th of F7 and the 3rd of B7 (D♯).
 */
const LAST_A_TUNE =
  "[d5@3 f5] [eb5@2 c5 a4] [bb4@2 d5 ~] [c5 ~ eb5 ~] [d5 ~ ab4 ~] [g4 ~ gb4 ~] [d5 ~ eb5 ~] d5";
const tune = (pattern = LAST_A_TUNE) => `mel: note("<${pattern}>")${SWING}.s("mutetpt")`;
/** The bass by hand, a root on each half bar (B♭ G | C F …), so only the chords line names the harmony. */
const LAST_A_BASS =
  'bass: note("<[bb1 g1] [c2 f1] [bb1 g1] [c2 f1] [bb1 bb1] [eb2 eb2] [bb1 f1] bb1>").s("upright")';
const lastA = (changes: string, mel = tune(), tail = "") =>
  at(
    BPM,
    `const changes = "<${changes}>"`,
    "",
    RIDE,
    HATS,
    `chords: chord(changes).dict("lefthand").anchor("bb4").voicing().struct("x ~ x x").s("rhodes")${tail}`,
    LAST_A_BASS,
    mel,
  );
const LAST_A_PLAIN = `${A_HEAD} [Bb^7 F7] Bb^7`;
const REHARM_STARTER = at(
  BPM,
  `const changes = "<⟪${LAST_A_PLAIN}⟫>"`,
  "",
  RIDE,
  HATS,
  `chords: chord(changes).dict("lefthand").anchor("bb4").voicing().struct("x ~ x x").s("rhodes")`,
  LAST_A_BASS,
  tune(),
);
/** Bar 1 aims a ii–V at bar 2's C–7; bar 7's F7 becomes its tritone substitute, B7, sliding into B♭. */
const REHARM_SOLUTION = lastA(
  "[Bb^7 [Dm7 G7]] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 B7] Bb^7",
);
/**
 * Two different devices: a tritone substitute, and one of the other three. `reharmonize` with `devices` would read
 * this in one rule, but the grader resolves a rule's reference only for a Make or a brief, not inside a modify's
 * matcher, so the item asks for one of each kind with `device-count`, and the tune, which the learner may edit,
 * is compared note for note with the starter's.
 */
const DEVICE_RULES: RubricRule[] = [
  {
    id: "tritone-sub",
    label: "At least one dominant is replaced by its tritone substitute",
    required: true,
    skills: ["J13"],
    rule: "device-count",
    devices: ["tritone sub"],
    min: 1,
  },
  {
    id: "another-device",
    label:
      "A second device of another kind: a ii–V aimed at a chord, the backdoor, or a passing diminished chord",
    required: true,
    skills: ["J14"],
    rule: "device-count",
    devices: ["secondary ii–V", "backdoor", "diminished passing"],
    min: 1,
  },
];

// --- the Make -----------------------------------------------------------------------------------------------

/** The A section's comping and a bass by hand (B♭ G | C F …), the Rhodes in the left hand's voicings. */
const aSection = (changes: string, ...more: string[]) =>
  at(
    BPM,
    `const changes = "<${changes}>"`,
    "",
    `chords: chord(changes).dict("lefthand").voicing().struct("x ~ x x").s("rhodes")`,
    LAST_A_BASS,
    ...more,
  );
const MAKE_STARTER = aSection(LAST_A_PLAIN);
const MAKE_MINIMAL = aSection(
  "[Bb^7 Gm7] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 B7] Bb^7",
);
/**
 * Beyond the brief: a walk of quarter notes, the backdoor (E♭–7 A♭7) in bar 6 going home to B♭, the tritone sub in
 * bar 4 and the head on the vibes.
 */
const MAKE_RICH = at(
  BPM,
  'const changes = "<[Bb^7 Gm7] [Cm7 F7] [Bb^7 Gm7] [Cm7 B7] [Bb^7 Bb7] [Ebm7 Ab7] [Bb^7 F7] Bb^7>"',
  "",
  `chords: chord(changes).dict("lefthand").voicing().struct("x ~ x x").s("rhodes")`,
  'bass: note("<[bb1 d2 g1 a1] [c2 eb2 f1 a1] [bb1 d2 g1 a1] [c2 g1 b1 a1] [bb1 d2 ab1 a1] [eb2 gb2 ab1 a1] [bb1 d2 f1 a1] [bb1 f1 d2 a1]>").s("upright")',
  tune(),
);
const ONE_DEVICE: RubricRule = {
  id: "one-device",
  label:
    "Your changes hold at least one device: a tritone substitute, a secondary ii–V, the backdoor or a passing diminished chord",
  required: true,
  skills: ["J14"],
  rule: "device-count",
  devices: [...DEVICES],
  min: 1,
};

export const checkpoint: CheckpointDef = defineCheckpoint({
  id: "J.CP2",
  title: "Jazz checkpoint 2",
  covers: ["J2", "J3", "J4", "J5"],
  gated: ["J03", "J09", "J10", "J11", "J12", "J13", "J14", "B05"],
  levelSetting: [],
  version: 2,
  authored: [
    {
      kind: "code-modify",
      id: "rhythm-changes-from-numerals",
      version: 1,
      role: "checkpoint",
      key: B_FLAT,
      prompt:
        "Rhythm changes in B♭, sixteen bars: the A section, then the bridge. First, write the bridge by name from its numerals, V7/vi V7/ii V7/V V7, two bars each. Second, rewrite bars 7–8 of the A section as the turnaround back to the top: I vi in bar 7, ii V in bar 8.",
      skills: [
        { skill: "J12", w: 0.6 },
        { skill: "J10", w: 0.4 },
      ],
      hints: null,
      code: { starter: FORM_STARTER },
      reference: { solutions: [FORM_SOLUTION], bars: 16 },
      matcher: { m: "pcset", perOnset: true, bass: true, tracks: ["chords"], durations: true },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      feedbackText: {
        "harmony.pcset":
          "Not yet: some bars do not sound like the target. In the bridge each dominant lasts two bars and leans a 5th down into the next; the last two bars of the A section move twice a bar.",
        "harmony.shifted":
          "Not yet: the right chords arrive at other times than the target's. Count two bars for each chord of the bridge.",
      },
      tests: [
        { name: "reference", response: { code: FORM_SOLUTION }, expect: "pass" },
        {
          name: "the bridge with `!2`",
          response: { code: form(TURNAROUND, "D7!2 G7!2 C7!2 F7!2") },
          expect: "pass",
        },
        {
          name: "half the bridge with `!2`",
          response: { code: form(TURNAROUND, "D7 D7 G7!2 C7!2 F7 F7") },
          expect: "pass",
        },
        {
          name: "the turnaround's halves written apart",
          response: { code: form("[Bb^7 Gm7] [Cm7 F7]", "D7 D7 G7 G7 C7!2 F7!2") },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: plain(FORM_STARTER) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the right dominants, one bar each, then again",
          response: { code: form(TURNAROUND, "D7 G7 C7 F7 D7 G7 C7 F7") },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
        {
          name: "D∆7 for D7: no dominant to lean on",
          response: { code: form(TURNAROUND, "D^7 D^7 G7 G7 C7 C7 F7 F7") },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
        {
          name: "the bridge as ii–Vs",
          response: { code: form(TURNAROUND, "Am7 D7 Dm7 G7 Gm7 C7 Cm7 F7") },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
        {
          name: "the A section left to end plainly",
          response: { code: form("Bb^7 F7 Bb^7", BRIDGE) },
          expect: "fail",
          feedback: ["harmony.pcset"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "walk-the-blues",
      version: 1,
      role: "checkpoint",
      key: { tonic: "F", mode: "major" },
      prompt:
        "Bars 5–8 of a jazz blues in F: B♭7, B°7, F7, D7. Rewrite the bass, now one note a bar, as a walk. Every bar: a note on every beat, the chord's root on beat 1, a note of the chord on beat 3, and beat 4 a step or a half step from the next bar's first note.",
      skills: [
        { skill: "B05", w: 0.7 },
        { skill: "J11", w: 0.3 },
      ],
      hints: null,
      code: { starter: WALK_STARTER },
      // Two passes of the loop, so the last bar's way back into bar 1 is heard (review: a 5th leap there passed).
      reference: { solutions: [WALK_SOLUTION], bars: 8 },
      matcher: { m: "rubric", rules: [WALK_RULE] },
      constraints: [{ c: "edit-only-regions", feedback: "code.edit-outside" }],
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      feedbackText: {
        "rubric.unmet":
          "{label}: not yet. In the target the bass moves on every beat, each bar starting on its chord's root and ending one step away from where the next bar begins.",
      },
      tests: [
        { name: "reference", response: { code: WALK_SOLUTION }, expect: "pass" },
        {
          name: "climbing through each chord, a half step into the next",
          response: { code: walkPiece(walk("[bb1 d2 f2 a1] [b1 d2 f2 e2] [f2 a2 c3 c#3] [d3 c3 a2 b1]")) },
          expect: "pass",
        },
        {
          name: "an octave higher, chromatic into bars 6 and 8",
          response: { code: walkPiece(walk("[bb2 d3 f3 c3] [b2 ab2 f2 e2] [f2 a2 c3 c#3] [d3 f#3 a2 a2]")) },
          expect: "pass",
        },
        {
          name: "down from the root in bar 7, up a half step into bar 8",
          response: { code: walkPiece(walk("[bb1 d2 f2 a1] [b1 d2 f2 gb2] [f2 eb2 c2 c#2] [d2 f#2 a2 c2]")) },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: plain(WALK_STARTER) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the right notes crowded into beat 1",
          response: {
            code: walkPiece(
              walk(
                "[[bb1 d2 f2 a1] ~ ~ ~] [[b1 d2 f2 gb2] ~ ~ ~] [[f2 a2 c3 eb3] ~ ~ ~] [[d3 a2 f#2 c2] ~ ~ ~]",
              ),
            ),
          },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "every beat 4 already on the next bar's root",
          response: { code: walkPiece(walk("[bb1 d2 f2 b1] [b1 d2 ab2 f2] [f2 a2 c3 d3] [d3 f#2 a2 bb1]")) },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "the way back to bar 1 a leap of a 5th: F to B♭",
          response: { code: walkPiece(walk("[bb1 c2 f2 a1] [b1 c2 f2 e2] [f2 g2 a2 c#2] [d2 e2 a2 f2]")) },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "four notes a bar that never start on the root",
          response: { code: walkPiece(walk("[d2 f2 ab2 a1] [d2 f2 ab2 gb2] [a2 c3 eb3 e3] [f#2 a2 c3 c2]")) },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
      ],
    },
    {
      kind: "code-modify",
      id: "two-devices-under-the-tune",
      version: 1,
      role: "checkpoint",
      key: B_FLAT,
      prompt:
        "Reharmonize the last A of rhythm changes in B♭ in `changes`, under the muted trumpet tune. Use two different devices: a tritone substitute, and one of a ii–V aimed at a chord, the backdoor or a passing diminished chord. Put each where the tune's long notes agree with it. Do not change the tune.",
      skills: [
        { skill: "J13", w: 0.5 },
        { skill: "J14", w: 0.5 },
      ],
      hints: null,
      code: { starter: REHARM_STARTER },
      reference: { solutions: [REHARM_SOLUTION], bars: 8 },
      matcher: {
        m: "all",
        of: [
          { m: "events", pitch: "absolute", rhythm: "onsets+durations", durations: true, tracks: ["mel"] },
          { m: "rubric", rules: DEVICE_RULES },
        ],
      },
      target: { audible: true, showRoll: false, revealRollAfter: 1 },
      feedbackText: {
        "rubric.unmet":
          "{label}: not yet. In the target the trumpet plays the same eight bars, and under it two places in the changes take a new colour, each of a different kind.",
        "melody.wrong-degree":
          "Not yet: in bar {bar} the trumpet plays another note than the tune. The tune stays as it is; only the chords under it move.",
      },
      tests: [
        { name: "reference", response: { code: REHARM_SOLUTION }, expect: "pass" },
        {
          name: "the ii–V in bar 3, the substitute in bar 4",
          response: {
            code: lastA("[Bb^7 Gm7] [Cm7 F7] [Bb^7 [Dm7 G7]] [Cm7 B7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 F7] Bb^7"),
          },
          expect: "pass",
        },
        {
          name: "three places, two kinds",
          response: {
            code: lastA("[Bb^7 [Dm7 G7]] [Cm7 F7] [Bb^7 Gm7] [Cm7 B7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 B7] Bb^7"),
          },
          expect: "pass",
        },
        {
          name: "on the piano, the ii–V in bar 3",
          response: {
            code: lastA(
              "[Bb^7 Gm7] [Cm7 F7] [Bb^7 [Dm7 G7]] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 B7] Bb^7",
              tune(),
              '.s("piano")',
            ),
          },
          expect: "pass",
        },
        {
          name: "unchanged",
          response: { code: plain(REHARM_STARTER) },
          expect: "fail",
          feedback: ["code.unchanged"],
        },
        {
          name: "the right device twice: two tritone substitutes",
          response: {
            code: lastA("[Bb^7 Gm7] [Cm7 F7] [Bb^7 Gm7] [Cm7 B7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 B7] Bb^7"),
          },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
        {
          name: "two devices, the tune bent to fit them",
          response: {
            code: lastA(
              "[Bb^7 [Dm7 G7]] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 B7] Bb^7",
              tune(LAST_A_TUNE.replace("[d5 ~ eb5 ~] d5", "[d5 ~ f#5 ~] d5")),
            ),
          },
          expect: "fail",
          feedback: ["melody.wrong-degree"],
        },
        {
          name: "the right two devices on a muted chords line",
          response: {
            code: lastA(
              "[Bb^7 [Dm7 G7]] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 B7] Bb^7",
              tune(),
              ".gain(0)",
            ),
          },
          expect: "fail",
          feedback: ["rubric.unmet"],
        },
      ],
    },
  ],
  recipe: {
    items: [12, 16],
    perSkillMin: 2,
    families: {
      J03: ["fam.jzz.chord-scale"],
      J09: ["fam.jzz.voicing"],
      J13: ["fam.jzz.subs"],
    },
  },
  make: {
    kind: "code-make",
    id: "checkpoint-room-for-a-device",
    version: 1,
    role: "checkpoint",
    title: "Room for a device",
    prompt:
      "Play the A section of rhythm changes in B♭ over the band's drums, eight bars. Required: put at least one device in `changes` where you hear room for it: a tritone substitute, a ii–V aimed at a chord, the backdoor or a passing diminished chord. Also on the checklist: a walking bass, and a tune on top.",
    skills: [{ skill: "J14", w: 1 }],
    hints: null,
    key: B_FLAT,
    bpm: BPM,
    code: { starter: MAKE_STARTER },
    bars: [8, 16],
    saveAs: "sketch",
    rubric: [
      ONE_DEVICE,
      {
        id: "walks",
        label:
          "The bass walks: a note on every beat, the root on beat 1 and a step into the next bar in at least half the bars",
        required: false,
        skills: ["B05"],
        rule: "custom",
        fn: "walking-bass",
        params: { bass: "bass", harmony: "chords", rootOnOne: 0.5, approachOnFour: 0.5 },
      },
      {
        id: "a-tune",
        label: "A third line plays over the chords and bass, such as a tune",
        required: false,
        skills: ["J14"],
        rule: "tracks",
        min: 3,
        roles: ["chords", "bass", "melody"],
      },
    ],
    feedbackText: { "rubric.unmet": "{label}: not yet." },
    tests: [
      {
        name: "the starter: the A section as written",
        response: { code: MAKE_STARTER },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      { name: "minimal: one tritone substitute", response: { code: MAKE_MINIMAL }, expect: "pass" },
      {
        name: "beyond the brief: a walk, the backdoor and a tune",
        response: { code: MAKE_RICH },
        expect: "pass",
      },
      {
        name: "a ii–V aimed at bar 2's C–7",
        response: {
          code: aSection(
            "[Bb^7 [Dm7 G7]] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 F7] Bb^7",
          ),
        },
        expect: "pass",
      },
      {
        name: "a passing diminished chord climbing from B♭ to C–7",
        response: {
          code: aSection("[Bb^7 Bo7] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 F7] Bb^7"),
        },
        expect: "pass",
      },
      {
        name: "the right substitute on a muted chords line",
        response: {
          code: at(
            BPM,
            'const changes = "<[Bb^7 Gm7] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 B7] Bb^7>"',
            "",
            `chords: chord(changes).dict("lefthand").voicing().struct("x ~ x x").s("rhodes").gain(0)`,
            LAST_A_BASS,
          ),
        },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
      {
        name: "the substitute's chord going nowhere: B7 climbs into C–7 instead of falling into B♭",
        response: {
          code: aSection("[Bb^7 B7] [Cm7 F7] [Bb^7 Gm7] [Cm7 F7] [Bb^7 Bb7] [Eb^7 Ebm7] [Bb^7 F7] Bb^7"),
        },
        expect: "fail",
        feedback: ["rubric.unmet"],
      },
    ],
  },
});
export default checkpoint;
