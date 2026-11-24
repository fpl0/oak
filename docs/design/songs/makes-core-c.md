# Make inventory: core U13–U17, the core finale, and the advanced tracks

Scope: every lesson Make of `content/core/U13`–`U17` (27 lessons), the checkpoint Makes of U13.CP, U14.CP and U17.CP,
the capstones that close these units (C6, C7, CF-T, CF-A), and a lighter one-row-per-lesson inventory of
`content/advanced` (J1–J5, R1–R3, A1–A2: 50 lessons) with JC1–JC4, RC1–RC2, AC1–AC2.

Method: every lesson file was imported with bun (read-only scripts in the scratchpad:
`/private/tmp/claude-501/-Users-fpl0-Code-Oak/4fb6682d-c484-494a-8850-13e101b1acf3/scratchpad/understand/dump-makes.ts`,
`dump-exkeys.ts`, `dump-caps.ts`, `dump-cap-sessions.ts`; raw output in `core-dump.txt`, `adv-dump.txt`,
`caps-dump.txt` next to them), so every key, meter, bpm, Band, rule and starter below is the evaluated value, not a
reading of prose. Line numbers are in the lesson files as of `dec85d2`.

Verdict key used throughout:
- **FITS**: the Make can happen inside one unit song with only the changes every song Make needs (open the song
  instead of the starter, scope the required rule to the section the learner takes over with the existing
  `section` field, re-target the content tests at Oak's copy of the song). Rule, idea, key, meter and the part the
  learner writes stay.
- **FITS-WITH-CHANGE**: something specific to the lesson must change (key, mode, meter, tempo/feel, sound, rule kind,
  a static reference, a hard-coded chord list); the change is named.
- **SIDE**: the Make does not belong in the unit's song (other meter, a fixed tune, a different form); keep it as a
  side sketch.

---

## 1. What a Make is today (the facts the song design builds on)

### 1.1 Shape

- A Make is the last step of a lesson, `kind: "make"`, carrying a `CodeMakeEx`
  (`packages/content-kit/src/schema/exercise.ts:696-711`):

  ```ts
  export interface CodeMakeEx extends ExBase<"code-make"> {
    code: CodeSpec;                 // { starter, toolbox?, autoCheckOnRun? }
    bars: [min: number, max: number];
    rubric: RubricRule[];           // exactly one required: true
    saveAs: "sketch";
    fromSketch?: LessonId;          // d15: open the learner's sketch of an earlier lesson
  }
  ```
  Exercise-level `key`, `meter`, `bpm`, `swing` override the lesson's (`ExBase`); U14 and U17.L01/L03 and most of J4/J5
  use `key` on the Make (see the tables). The lesson grader context takes `part.key ?? ex.key ?? lesson.key`
  (`app/src/lesson/grading.ts:701-718`).
- The Band is on the step UI, not the exercise: `StepUi.band?: BandRef | false` with
  `BandRef { band; followsLearnerKey?; tracks?: ("drums"|"bass"|"chords")[] }`
  (`packages/content-kit/src/schema/lesson.ts:65-66, 144-149`). `tracks` lists the Band roles that play; the rest are
  muted because the learner writes them.
- Make starters carry no edit locks: `⟪…⟫` in a Make starter only draws a dashed "target" box until the learner edits;
  "the whole Make stays editable" (`app/src/lesson/renderers.tsx:567-600`, `useTargetMarks`). The
  `edit-only-regions` lock exists for other exercise kinds only (`docs/design/exercises.md:314`).
- Saving: `sketches.create` with `originKind: "lesson-make"`, `originId: lessonId`, the code, the lesson's `bpm`,
  `meter`, `key` (the lesson's, not the Make's `ex.key`) and `band: { bandId, flavour, mutes }`
  (`app/src/lesson/server.ts:62-83`).
- Persistence across lessons exists in one narrow form, `fromSketch` (decision d15): the Make opens with "the newest
  version of the newest sketch of that lesson", with a "Start from Oak's copy" switch
  (`app/src/lesson/make-start.ts:9-55`, `renderers.tsx:573-600`). In U13–U17 only U15.L06 uses it (from U12.L04);
  elsewhere U06.L10, U10.L06, U11.L07. The advanced tracks never use it.

### 1.2 Band layer

- Bands live in `content/bands/index.ts` (`bands`, lines 1064-1250). They are read-only code with labelled tracks
  `drums:` `bass:` `chords:`, one code per flavour, `{{key}}`-templated. `bandCodeAt` (line 1408) picks the stage of a
  flavour at a point in the course (`BAND_STAGES`).
- At play time `bandCodeFor` (`packages/strudel/src/band.ts:201-245`) makes a Band follow the learner's key
  (`followsLearnerKey`), the learner's key plan (`.scale("<C4:major!8 D4:major!4>")`, Wave 6), and the learner's
  `arrange()` sections (`followLearnerForm`, `packages/strudel/src/band-form.ts`; only `band.sections` is written in
  sections, `SECTION_BANDS`). **A Band never follows the learner's chord names**: its harmony is fixed per Band
  (`BAND_CHANGES`, `content/bands/index.ts:1279`). That is why every U14–U17 Make takes
  `tracks: ["drums"]`: the learner's chords leave the key and the Band's chords would fight them (U16 spec conventions,
  `content/specs/U16.ts` "The Band: every Make takes only the drums").
- **The grader is not given the Band.** AUTHORING §8 rule 5: "neither content:check nor the app passes `ctx.band`
  yet", so a rule that reads `band.chords` can only say "not yet". Confirmed: the lesson grading context has no
  `band` (`app/src/lesson/grading.ts:703-718`), while the grader already supports it (`GradeContext.band`,
  `packages/grader/src/types.ts:162, 262`; passed to evaluation at `packages/grader/src/grade/index.ts:241`, tracks
  come back as `band.<label>`).
- Band code is a preview context: it may use tools the learner has not unlocked. Learner code may not: a Make with a
  locked tool is blocked (`renderers.tsx`, `lockedDiag`/`blocked`).
- Flavours (`content/flavours.ts`) change Band code and starter sounds, never a rubric. **jazz-soul swings by default**
  (`swing: { subdivision: 8, amount: 1/3 }`), which is why U13 takes no Band at all.
- Validation pins Band choice per Make: `content/validate/specs.test.ts:49-71` (`NO_BAND`, each with a reason) and
  `:229-233` (the Make's Band must exist and `bandMeter(band) === lesson.meter`). These are frozen registries during
  the Build phase (`content/AUTHORING.md:375`: `content/specs/**`, `content/validate/**`, `flavours.ts`, `toolbox.ts`,
  `syllabus.ts` are frozen; `content/bands/` and `content/checkpoints.ts` belong to author:CP).

### 1.3 Rules can already be scoped to a section of a song

- Every rubric rule takes `section?: { section: "verse", nth? } | { bars: [a, b] } | "last"`
  (`packages/content-kit/src/schema/rubric.ts:20-37`). The grader applies it generically to every rule except
  `contrast` and `key-change` (which carry their own section references), custom rules included, and keeps the key in
  force per bar inside the section (`keyByBar`) (`packages/grader/src/rubric/rules.ts:1939-1946`). Sections are read
  from `<role><Section>` consts inside one `arrange()` per track (`sectionsFromAst`).
- Used today: U13.L06 (`section: { bars: [3, 4] }`), U15.L06 (`{ bars: [1, 8] }`), U17.L03's suggestion
  (`{ section: "bridge" }`), C5/C7/CF-A rubrics.
- Grading caps: lesson mode `maxBars: 64`, `timeoutMs: 1500`, `hapCap: 20_000`, `periodCap: 16`; capstone mode
  `maxBars: 128`, `timeoutMs: 5000`; tutor mode reads only `maxBars: 16` (`packages/grader/src/types.ts:137-139`).

### 1.4 The default order interleaves units and capstones

`content/syllabus.ts:668-676` (`defaultOrder`): a checkpoint sits after the next unit's L01 "so it falls on a later
day", and the capstone after that. For this range:

```
… U13.L06, U14.L01, GYM.14, U13.CP, U14.L02 … U14.L06, U15.L01, U14.CP, CF-T.S1, C6.S1, C6.S2, U15.L02, U15.L03,
CF-T.S2, U15.L04, U15.L05, U15.L06, U16.L01, CF-T.S3, U16.L02 … U16.L05, CF-T.S4, U17.L01 … U17.L04, GYM.16, U17.CP,
C7.S1, C7.S2, C7.S3, GYM.17, CF-A.S1 … CF-A.S4
```

So with one song per unit, **two songs are open at once**: the U14 song is released (C6) two sessions after the U15
song has started (U15.L01 precedes U14.CP and C6), and CF-T (a transcription) runs through U15 and U16.

### 1.5 Precedent: capstones already open a complete Oak song in sections

- `C7.S1`'s starter (`content/capstones.ts:3095`) is a 16-bar verse + chorus in C, one `arrange()` per track, drums,
  bass and chords all written by Oak, "the colours are yours to place".
- `CF-A.S1`'s starter (`content/capstones.ts:3358`, template `CF_A_TEMPLATE` at `:1018`) is a full 56-bar song:
  `intro 4, verse 8, chorus 8, verse 8, chorus 8, bridge 8, chorus 8, outro 4 = 56 bars, 2:14`, section consts
  (`kickVerse`, `chordsBridge`, `bassChorus` …) with `⟪⟫` marking what to make one's own. This is the existing artifact
  closest to "Oak opens a complete-sounding song; the learner takes over parts".
- U17.L02, U17.L03 and U17.CP Makes are already songs in sections (`arrange([4, chordsVerse], [4, chordsChorus], …)`).

---

## 2. Core inventory

Abbreviations: "axis drums" = `{ band: "band.axis-4bar", tracks: ["drums"] }`. "Starter" lists the labelled lines of
`code.starter`; the learner may edit all of it, the prompt names what must change.

### 2.1 U13 Rhythm II (unit spec `content/specs/U13.ts`; no capstone)

Unit conventions (`content/specs/U13.ts:126-140`): every lesson in C major; "the drums are the learner's: every step's
code carries its own `kick:`, `snare:` and `hats:` lines … no Make takes a Band"; harmony is U12's sevenths in one
`const changes` read by `chords:` and `bass:`; sounds default kit, `fingerbass` `.lpf(800)`, `rhodes`, `organ`,
`piano`, `cleangtr` (from L02). New tools: `.early/.late` (L01), `.velocity` (L02), compound tempo lines (L04),
`.ply` (L05) (`content/toolbox.ts:295-299`).

| Lesson (file: Make line / required-rule line) | Idea | Meter · key · bpm | Learner writes (starter → change) | Band | Required rule (id: label · rule) | fromSketch | Fit |
|---|---|---|---|---|---|---|---|
| **U13.L01** Pushes & Anticipations (`content/core/U13/L01/lesson.ts:540` / `:560`) | a chord arrives before its beat; `.early(1/8)` | 4/4 · C maj · 96 | kick, snare, hats, bass, chords on `"<C^7 Am7 F^7 G7>"` (starter `:130`) → add `.early()` to `chords:` | none (`band: false`) | `chords-off-the-beat`: "At least two chords on the `chords:` line start between beats and ring through the next beat" · `syncopation` track chords min 2 | – | FITS-WITH-CHANGE |
| **U13.L02** Sixteenth Grooves & Ghost Notes (`L02/lesson.ts:429` / `GHOSTS_RULE :77`) | strength per hit with `.velocity()`; ghost notes | 4/4 · C · 96 | 16-step kick and snare, `hh*16`, bass, chords on `"<Dm7 G7>"` → `.velocity()` on the snare (hats accents, `cleangtr` optional) | none | `snare-ghosts`: "At least three snare hits at .4 or less on an "e" or an "a", and at least two snare hits at full strength" · `velocity-ghosts` snare min 3 on 16th-offbeat accents 2 | – | FITS-WITH-CHANGE |
| **U13.L03** Ties Across the Beat (`L03/lesson.ts:495` / `:520`) | dots and ties with `@`; how a push looks on the page | 4/4 · C · 100 | L01's section **with the Rhodes already pushed** (`.early(1/8)`) + `mel:` piano tune → rewrite the tune's rhythm with `@`; lead-sheet staff panel | none | `tune-leans`: "At least two notes of the `mel:` line start between beats and ring through the next beat" · `syncopation` mel min 2 | – | FITS |
| **U13.L04** Compound Meter (`L04/lesson.ts:436` / `:455`) | 6/8, dotted-quarter beat | **6/8** · C · 60 (`setcpm(60/2)`) | kick, hats, bass, chords on `"<Am7 Dm7 F^7 G7>"` → add `snare:` on the 4th eighth | none ("No Band is written in 6/8", stale: `band.soul-68` now exists, `content/bands/index.ts:1045-1053`) | `snare-on-two`: "In every bar, a snare on the fourth eighth (beat 2) and none on the first three eighths" · `onsets` @drums snare contains [[1,2]] perBar | – | SIDE |
| **U13.L05** Triplets (`L05/lesson.ts:427` / `:446`) | three in the time of two; `.ply(3)` | 4/4 · C · **76** | kick, snare, hats, bass, piano `chords:` `struct("x*4")` on `"<C^7 Am7 Dm7 G7>"` → piano or hats in triplets every beat | none (doo-wop Band would double the triplets) | `triplets-every-bar`: "The piano (`chords:`) or the hats play three even notes on every beat of every bar" · custom `tuplets-every-bar` | – | FITS-WITH-CHANGE |
| **U13.L06** Rhythm Dictation II (`L06/lesson.ts:537` / `:560`) | write a rhythm down by ear; call and answer | 4/4 · C · 92 | kick bars 1–2 = the funk groove dictated in the lesson (the call), bars 3–4 plain; snare, hats, bass in degrees, chords `"<Dm7 G7 Dm7 G7>"` → rewrite kick bars 3–4 | none | `answer-off-the-beat`: "In bars 3–4, at least two kicks start between the beats, each with no kick on the beat after it" · `syncopation` kick min 2 `section: { bars: [3, 4] }` | – | FITS-WITH-CHANGE |
| U13.CP (`content/core/U13/CP/checkpoint.ts:267`) | checkpoint groove | 4/4 · C · 96 | a groove with sevenths | none (`content/checkpoints.ts:90`) | `pushed`: syncopation on chords (suggestions: sevenths, ghosts, a triplet) | – | keep separate (a checkpoint) |

Notes per lesson:
- **L01**: the push works inside one section, but `.early()` and `arrange()` do not compose at section boundaries:
  U17's conventions verify that "inside `arrange()` a section starts again from its own first bar each time it plays",
  and U13's conventions that an `.early()` line "has nothing to play at the very start". So `chordsVerse =
  chord(...).voicing().early(1/8)` leaves the verse's first beat unpushed and pushes the verse's own first chord (not
  the chorus's) into the bar line; `chords: arrange(...).early(1/8)` pushes every section. The song needs the push
  either on the whole track or an authored rule for boundaries. Second change: the song must stay straight in every
  flavour (the jazz-soul swing is why U13 has no Band; NO_BAND reason at `content/validate/specs.test.ts:54-55`).
- **L02**: the song needs a sixteenth-note section (the L02 starter is a `Dm7 G7` vamp with 16-step drums) and per-
  section drum consts (`snareChorus`) so the learner's ghosts live in one section.
- **L03**: the starter literally contains L01's result (the pushed Rhodes), the only U13 Make that already builds on
  an earlier one. In the song: the learner takes over the verse tune. The lead-sheet panel must show the section.
- **L04**: one meter per lesson/exercise is the model (`LessonDef.meter`, `ExBase.meter`); a 6/8 section inside a 4/4
  song is not expressible, and `meter.compound` is itself a PLANNED feature "until every host draws the dotted-quarter
  beat" (`L04/lesson.ts` header). A 12/8 bar at the song's cycle length is the 4/4 beat in triplets, but the rule's
  position `[1,2]` (half the bar) means beat 3 there, so the rule would have to change too. Keep as a side sketch (a
  6/8 B-side), or plan a mixed-meter feature.
- **L05**: a "slow dance" bridge in triplets fits a 96 BPM song musically (eighth-note triplets at 96 are fine), but the
  lesson's feel and its optional `tempo-bpm` 60–84 change; the custom rule needs `section`.
- **L06**: becomes the song's 4-bar drum break; the "call" must be the groove the lesson dictates, and the
  `section: { bars }` window moves to the break's bars.

### 2.2 U14 Modes (closes with U14.CP, then C6)

Unit conventions (`content/specs/U14.ts:77-…`): each mode taught in its own home, chosen so that "each parent key has
exactly one accidental and the mode cancels it" (G Mixolydian, D Dorian, F Lydian, E Phrygian, all on the white
keys); "Ear steps, the checkpoint and C6 use other home notes, so a colour is never learned as one key"; every Make
"take[s] the drums of `band.axis-4bar` and keep[s] every pitched part in the learner's code"; the lesson's `key` is
the scale the lesson starts from and the Make declares the mode on its exercise. Sounds by colour: Mixolydian
`crunch` + `organ` + pumping `ebass` (rock), Dorian `rhodes` + `fingerbass` (funk/soul), Lydian `pad` over a held bass
with a delayed piano (film), Phrygian `acgtr` 3+3+2 (flamenco). Scale words unlock one per lesson: `mixolydian`
U14.L01, `dorian` U14.L03, `lydian` U14.L04, `phrygian` U14.L05 (`content/toolbox.ts:350-353`); `.pan` and `.jux`
U14.L06.

| Lesson (Make / rule line) | Idea | Meter · key (lesson → Make `ex.key`) · bpm | Learner writes | Band | Required rule | fromSketch | Fit |
|---|---|---|---|---|---|---|---|
| **U14.L01** Modes as Colours (`content/core/U14/L01/lesson.ts:451` / `:471`) | a mode = a known scale with one note changed; Mixolydian ♭7 | 4/4 · G major → G Mixolydian · 104 | `gtr:` crunch riff in `G3:mixolydian` that never plays 7, `bass:` `n("0*8")` → riff plays F | axis drums | `the-colour-note`: "The `gtr:` line plays the ♭7 (F) at least once" · `degree-set` gtr contains b7 | – | FITS |
| **U14.L02** Mixolydian Rock (`L02:456` / `:476`) | ♭VII; I–♭VII–IV | 4/4 · G Mixolydian → G Mixolydian · 112 | `chords:` organ, `bass:` x*8, `gtr:` riff on `"<G G C G>"` → F chord into `changes` (riff plays te) | axis drums | `the-flat-seven-chord`: "An F chord, ♭VII, in the loop at least once" · `contains-rn` bVII | – | FITS |
| **U14.L03** Dorian ♮6 (`L03:435` / `:455`) | minor with raised 6; i–IV | 4/4 · D minor → D Dorian · 100 | rhodes `chords:` on `"<Dm7 Dm7>"`, fingerbass, `mel:` in `D4:dorian` → G/G7 into `changes` (mel plays B) | axis drums | `the-major-four`: "A G major chord, IV, in the loop at least once" · `contains-rn` IV | – | FITS-WITH-CHANGE |
| **U14.L04** Lydian Glow (`L04:424` / `:444`) | major with ♯4; I–II over a held home bass | 4/4 · F major → F Lydian · **84** | `pad:` on `"<F F F F>"`, `bass: note("f2")` held, `mel:` piano `.delay(.3)` → mel plays B (`n` 3); pad may move to G | axis drums | `the-raised-four`: "The `mel:` line plays the raised 4th (B) at least once" · `degree-set` mel contains #4 | – | FITS-WITH-CHANGE |
| **U14.L05** Phrygian Edge (`L05:388` / `:408`) | minor with ♭2; i–♭II | 4/4 · E minor → E Phrygian · 96 | acgtr `chords:` on `"<Em Em>"`, ebass, `gtr:` acgtr riff → riff plays F (`n` 1); chords may move to F | axis drums | `the-lowered-two`: "The `gtr:` line plays the lowered 2nd (F) at least once" · `degree-set` gtr contains b2 | – | FITS-WITH-CHANGE |
| **U14.L06** Mode Lab (`L06:400` / `:425`) | name the four colours by ear; a vamp that makes its mode heard | 4/4 · D Dorian → D Dorian · 96 | rhodes `chords:` `"<Dm7 Dm7>"` `.pan(.3)`, fingerbass, cleangtr `gtr:` `.jux(rev)` → pick a mode: scale word + chords + colour note on strong beats | axis drums | `one-mode`: "One mode on D: its colour note on beat 1 or 3 at least twice, and the D chord in at least 40% of the bars" · `mode` tonic declared, anyOf [dorian, mixolydian, lydian, phrygian], requireCharacteristic | – | FITS-WITH-CHANGE |
| U14.CP (`content/core/U14/CP/checkpoint.ts:336`) | checkpoint rock loop | 4/4 · **D Mixolydian** · 112 | `changes` `"<D D G D>"` + riff | axis drums | `flat-seven`: C chord, ♭VII · `contains-rn` | – | keep separate; note it uses home D on purpose |

Notes:
- The four lessons are taught on four home notes. One song needs one home (or a per-section key plan of modes). The
  rules are degree- and numeral-relative and read the Make's `ex.key`, so re-homing is cheap for grading, but every
  starter, test and hint text names concrete notes ("plays the ♭7 (F)", "the raised 6 (B)"), and the
  one-accidental convention breaks off the white keys (G Dorian 1♭, G Lydian 2♯, G Phrygian 3♭).
- `mode` (L06, C6) judges a whole piece; in a song with several colours it needs `section`.
- In a multi-mode song the chord band, key lens and analysis read one key per bar only through a key plan
  (`.scale("<G4:mixolydian!8 G4:dorian!8 …>")` after `arrange()`, the U17 mechanism; `ruleKeys`/`keyByBar` in the
  grader already follow it).
- Unlock-before-use bites here: a Lydian intro written with `.scale("G4:lydian")` cannot be in learner code before
  U14.L04; it must be in a preview context (Band) or appear when unlocked.

### 2.3 U15 Secondary Dominants (no checkpoint, no capstone of its own; CF-T.S1–S2 run alongside)

Unit conventions (`content/specs/U15.ts:95-…`): one `const changes` drives chords and bass; "the home of the unit is
the Rhodes over an upright bass with a piano tune (U15.L01–L03, L06: soul); U15.L04 moves to the organ for the gospel
walk-up; U15.L05 is a 1920s dance band: `jazzgtr` on the off-beats, the upright on 1 and 3, `horns` stabs and a
`trumpet` line" (`snd.horns`, `snd.trumpet` unlock at U15.L05, `content/toolbox.ts:409-410`); every Make takes axis
drums; chromatic steps `n("3#")` unlock at U15.L01 (`toolbox.ts:334`).

| Lesson (Make / rule line) | Idea | Meter · key · bpm | Learner writes | Band | Required rule | fromSketch | Fit |
|---|---|---|---|---|---|---|---|
| **U15.L01** Chromatic Degrees (`content/core/U15/L01/lesson.ts:404` / `:426`) | notes from outside the key, named by the degree they bend | 4/4 · C · 92 | rhodes/upright/piano on `"<C Am Dm G7>"` → bend two notes of `mel:` (`3#`, `4#`, `6b`) | axis drums | `two-bent-notes`: "At least two notes from outside the key in `mel`" · `degree-set` mel anyOf [#4,b7,#5,#1,b2,b3,b6] minCount 2 | – | FITS |
| **U15.L02** Five of Five (`L02:473` / `:492`) | V7/V | 4/4 · C · 92 | `"<C Am F G7 C Am Dm G7>"` (8 bars) + tune → D7 before G in `changes`, fix the tune note that rubs | axis drums | `five-of-five-goes-to-five`: "A V7 of V (D7, or D) at least a beat long, moving straight into V (G or G7)" · `contains-rn` V/V mustResolve | – | FITS |
| **U15.L03** Visiting Other Chords (`L03:447` / `:467`) | V7/vi, V7/ii, V7/IV | 4/4 · C · 88 | `"<C Em Am C F Am Dm G7>"` + tune → Em/C/Am become V7 of the next chord | axis drums | `a-visitor-that-lands`: "A V7 of vi, ii or IV (E7, A7 or C7) at least a beat long, moving straight into its target" · `contains-rn` [V/vi, V/ii, V/IV] mustResolve | – | FITS |
| **U15.L04** Tonicization (`L04:455` / `:475`) | applied vii°7 | 4/4 · C · 84 | organ `chords:`, upright, no tune, `"<C C Dm7 Dm7 G7 G7 Am7 G7>"` → a repeat becomes the next chord's leading-tone chord | axis drums | `leading-tone-chord-lands`: "A leading-tone chord (a diminished seventh) … moving straight into the chord whose root is a half step above its own" · `contains-rn` vii°/ii…vii°/vi mustResolve | – | FITS |
| **U15.L05** Dominant Chains (`L05:431` / `:450`) | III7–VI7–II7–V7 (Five Foot Two) | 4/4 · C · **120** | jazzgtr off-beats, upright 1 & 3, trumpet `mel:` on `"<C Em Am Am Dm G7 C G7>"` → A7 D7 G7 C chain; add a `horns:` line | axis drums | `three-in-a-row`: "Three dominant sevenths in a row, A7, D7 and G7, then C" · `contains-rn` [V7/ii, V7/V, V7, I] inOrder | – | FITS-WITH-CHANGE |
| **U15.L06** Hearing Secondaries (`L06:435` / `:456`) | find and name an applied dominant by ear | 4/4 · C · 84 | **the learner's U12.L04 staircase** when saved, else `"<C^7 Dm7 Em7 F^7 F^7 Em7 Dm7 C^7>"` + tune → two secondary dominants | axis drums | `two-doors-that-land`: "Within the 8 bars, two secondary dominants, each … moving straight into its target" · `contains-rn` kind secondary-dominant min 2 mustResolve `section: { bars: [1, 8] }` | **U12.L04** | FITS-WITH-CHANGE |

Notes:
- L02 and L03 prompts ask the learner to fix "the tune's note in that bar that now rubs against the new chord": they
  assume Oak's tune. If the learner took over the verse tune in L01, the prompt and hints must speak of the learner's
  tune (or the takeover order puts the tune last).
- L05: a 120 BPM 1920s band inside a ~90 BPM soul song changes the lesson's whole character; in a song it is a horn
  tag/turnaround at the song's tempo (the rule is tempo-free). `horns`/`trumpet` cannot appear in learner code before
  L05.
- L06: `fromSketch` reaches outside the unit (U12). In a U15 song the natural reading is "the section you have not
  touched yet" (or seed that section from the U12.L04 sketch, which would make the song import a past sketch).

### 2.4 U16 Borrowed Chords (no checkpoint, no capstone; CF-T.S3–S4 alongside)

Unit conventions (`content/specs/U16.ts:87-…`): borrowed chords are chord names in the one `const changes`; "no
melody note sits a half step above a chord note for a beat or more … A Make's starter tune keeps to those notes in
the bar the learner is invited to change"; every Make takes only the drums (`band.axis-4bar`, `band.aeolian-4bar` for
L04); "U16 is songs": L01 piano ballad, L02 an anthem's ending (organ, pumping eighth bass, overdriven guitar), L03 riff
rock and soul (organ stabs 3+3+2), L04 minor ballad (piano, upright, strings, acoustic guitar), L05 a folk tune as a
soul ballad (Rhodes, upright, tenor sax; `snd.tenor` unlocks at L05, `toolbox.ts:411`).

| Lesson (Make / rule line) | Idea | Meter · key · bpm | Learner writes | Band | Required rule | fromSketch | Fit |
|---|---|---|---|---|---|---|---|
| **U16.L01** The Sad IV (`content/core/U16/L01/lesson.ts:373` / `:392`) | iv in major | 4/4 · C · 80 | piano `struct("x x x x")`, ebass, cleangtr tune on `"<C Am F F>"` → F minor in a bar | axis drums | `the-sad-four`: "At least one bar plays F minor, the sad iv" · `contains-rn` iv | – | FITS |
| **U16.L02** ♭VI & ♭VII (`L02:389` / `:408`) | ♭VI–♭VII–I climb | 4/4 · C · 112 | organ, ebass x*8, crunch tune on `"<C G Am F C G F C>"` → bar 7 F becomes A♭ B♭ | axis drums | `the-climb`: "♭VI, then ♭VII, then I, in that order, somewhere in the piece" · `contains-rn` [bVI, bVII, I] inOrder | – | FITS |
| **U16.L03** ♭III & Minor Plagal (`L03:449` / `:468`) | ♭III and iv–I | 4/4 · C · 100 | organ stabs `struct("x ~ ~ x ~ ~ x ~")`, ebass, crunch riff on `"<C F C F>"` → a 4/8-bar loop with E♭ | axis drums | `flat-three`: "At least one bar plays E♭ major, ♭III" · `contains-rn` bIII | – | FITS |
| **U16.L04** Picardy & Dorian IV (`L04:464` / `:484`) | end a minor piece on major I; brighten iv to IV | 4/4 · **A minor** · 88 | piano, upright, strings `pad:`, acgtr `mel:` on `"<Am Dm F E Am Dm E Am>"` → last chord A major | **`band.aeolian-4bar`** drums | `major-home-at-the-end`: "The last chord that sounds is A major, the major home chord" · custom `last-chord` rn I | – | FITS-WITH-CHANGE |
| **U16.L05** Mixture Lab (`L05:333` / `:356`) | new chords under an unchanged tune | 4/4 · C · 84 | Aura Lee verse: rhodes, upright, tenor `mel:` on `"<C Dm G C C Dm G C>"`; lead-sheet staff → ≥2 outside chords, tune kept | axis drums | `same-tune-new-chords`: "The mel line unchanged, over at least two borrowed chords or secondary dominants" · `reharmonize` with a **static `reference.solutions`** (the starter itself), min 2 kinds | – | FITS-WITH-CHANGE |

Notes:
- L04: the song in C has no A minor; two clean options: (a) a coda in **C minor that ends on C major** (Picardy on the
  song's own home; the custom `last-chord` then reads the song's last chord, no scoping needed, but `ex.key` becomes
  C minor and the "bright IV" suggestion becomes F major); (b) a bridge in A minor ending on A major, which is V/ii in
  C, leading back into the chorus (needs `section` on the custom rule and a key plan for the bridge, U17 material
  ahead of time).
- L05: `reharmonize` compares the tune to static content. In a persistent song the reference must be "the song's own
  verse tune", which is only stable if the tune stays Oak's until L05 (or the rule gains a "same melody as section X"
  mode, like `key-change`'s `sameMelody`).
- Unit-wide: Oak's song tune must already obey the U16 no-half-step-clash rule under every borrowed chord the unit will
  invite in each section, because the learner adds the chords under it.

### 2.5 U17 Modulation (closes with U17.CP, then C7, then CF-A)

Unit conventions (`content/specs/U17.ts:96-…`): a key plan goes after `arrange()` on every line written in degrees
(inside a section const it never reaches its second key, `code.arranged-scale-pattern`); destinations: C→G through
Am (L01), C→D lift (L02), C→A minor through E7 (L03), D♭→D at a standard's bridge (L04, by ear); lessons in C except
L04 (F); every Make takes axis drums ("a Band's own chords would stay in the old key"); "the jazz-soul and funk kits
swing the drums, so starters keep chords and bass on the beats".

| Lesson (Make / rule line) | Idea | Meter · key · bpm | Learner writes | Band | Required rule | fromSketch | Fit |
|---|---|---|---|---|---|---|---|
| **U17.L01** Pivot Chords (`content/core/U17/L01/lesson.ts:456` / `:476`) | change key through a chord both keys own | 4/4 · C (ex C) · 96 | rhodes, upright, piano tune on `"<C Am F G C Am F G>"`; bars [8,16] → bar 6 pivot, bar 7 D7, bar 8 G; tune key plan 6 bars C + 2 bars G | axis drums; flavour sound swaps (pop/indie: rhodes→piano, upright→ebass) | `ends-in-g-through-a-pivot`: "The verse ends in G major, reached by a chord both C and G major own, then G's V, then G" · `modulation` to dominant via pivot | – | FITS-WITH-CHANGE |
| **U17.L02** Truck-Driver & Direct Modulation (`L02:508` / `:527`) | lift the last chorus; key plan after `arrange()` | 4/4 · C · 112 | **already a song**: `chordsVerse/Chorus/Chorus2`, `bassVerse/Chorus`, `melVerse/Chorus`, `arrange([4,…],[4,…],[4,…])` (12 bars) → key plans 8 C + 4 D on bass and tune, chord names of `chordsChorus2` up a step | axis drums; form lens | `last-chorus-in-d`: "Bars 9 to 12 are in D major, a whole step up, with the tune and the chords both lifted" · `key-change` at last semitones [2] minBarsAfter 4 | – | FITS |
| **U17.L03** Hearing Key Changes (`L03:438` / `:458`) | hear and locate a key change; bridge to the relative minor | 4/4 · C (ex C) · 92 | `arrange([4, verse], [4, bridge])` on chords, bass, tune → E7 before Am in the bridge; tune key plan 4 C + 4 A harmonic minor | axis drums; flavour sound swaps; chords + form lenses | `bridge-in-a-minor`: "The bridge ends in A minor, chords and tune: A minor's V (E or E7), then Am" · `modulation` to relative, cadence | – | FITS-WITH-CHANGE |
| **U17.L04** Transcribing Through a Key Change (`L04:461` / `:483`) | write a tune down through its key change; degrees once + key plan | 4/4 · **F** · 104 | piano `chords:` `"<F Dm Bb C G Em C D>"`, tune with `.scale("<F4:major!4 G4:major!4>")`, **no bass** → add a `bass:` in degrees with the key plan | axis drums | `roots-in-both-keys`: "The bass plays the chord's root on at least 3 of every 4 chord changes, across both keys" · `bass-line` roots on change .75 | – | FITS-WITH-CHANGE |
| U17.CP (`content/core/U17/CP/checkpoint.ts:301`) | checkpoint song | 4/4 · **G** · 112 | a song in sections (verse, chorus, chorus), 12–24 bars | axis drums | `last-chorus-in-a`: `key-change` +2 on the last section | – | keep separate (other key on purpose) |

Notes:
- L01 and L03: `modulation` reads where "the piece's key plan ends" (header comments `L01:14-16`, `L03:13-16`). In a
  song that returns home after the verse or the bridge, the rule must be scoped (`section: { section: "verse", nth: 2 }`
  / `{ section: "bridge" }`); `section` is generic (§1.3), but whether `modulation`'s "ends in" logic honours the
  scoped window needs a probe.
- L04: re-key to the song (C, lift to D) and the Make becomes "take over Oak's bass for the whole song". Its optional
  `still-the-song` is a `matches` against a static tune and has to go or point at the song.

### 2.6 Capstones that close these units

| Capstone (`content/capstones.ts` line) | Opens after | Sessions | Meter · key · bpm | Required rules | Starter | Relation to a unit song |
|---|---|---|---|---|---|---|
| **C6** Modal Vamp (`:2834`) | U14.CP | 2 (S1 own starter; S2 release) | 4/4 · any home · 80–130 | `mode` (Mixolydian or Dorian; colour note on 1 or 3 twice; home chord ≥40%; tonic declared), `bars` ≥16 | G Mixolydian vamp: `chord("<G F>")`, `mel: n("⟪0 2 4 6⟫")`, kick/snare/hats | Release of the U14 song: FITS-WITH-CHANGE (whole-piece `mode` fails a song with Lydian/Phrygian sections; scope it or rewrite the brief to "two colours heard") |
| **C7** Chromatic Colour (`:3095`) | U17.CP | 3 (S1 colour chords, S2 melody & sections, S3 lift & release) | 4/4 · C major · 70–140 | `secondary` (contains-rn kind secondary-dominant mustResolve), `mixture` (bVI bVII I inOrder), `lift` (`key-change` last, +1/+2, ≥8 bars, sameMelody), `bars` ≥32 | 16-bar verse + chorus in C, `arrange()` per track, Oak's drums, chords, bass | Release of the U17 song: FITS. The U17 song already has the lift (L02) and form; C7.S1 is exactly "bring in the U15 and U16 colours" |
| **CF-T** Standard Transcription (`:3506`) | U15.L01 completed | 4, interleaved through U15–U16 | 4/4 · song's | phrase checks against an answer key (Five Foot Two, Ain't She Sweet, Bye Bye Blackbird) | none (transcription) | SIDE: not a learner song; runs in parallel with the U15/U16 songs |
| **CF-A** Album Single (`:3358`) | C7 | 4 | 4/4 · any · 60–160, ≥120 s | `devices` ≥4 of [secondary dominant, borrowed chord, modulation, suspension, syncopated bass, modal colour], `form` contains bridge, `duration-sec` ≥120 | full 56-bar Oak song (§1.5) | Already the "Oak opens a complete song" model; its own song (album slot `single`), not a unit's |

U13, U15 and U16 end with no capstone. A unit song for them needs a release path that is not a capstone (or a new
album slot), because today album slots are only `brief.album.slot` of capstones.

---

## 3. Per-unit song proposals (core)

### U13 song: "the groove" (no capstone today)
- **Natural shape**: 4/4, C major, 96 BPM, **straight in every flavour** (jazz-soul must not swing this song).
  Harmony is U12's sevenths: verse `C^7 Am7 F^7 G7` (the L01 and L03 starters), a sixteenth-note chorus vamp
  `Dm7 G7` (L02, L06), a bridge `C^7 Am7 Dm7 G7` (L05). Sound: default kit, fingerbass, Rhodes, organ stabs, piano,
  clean guitar from L02.
- **Form**: Break 4 (drums + bass, the call) · Verse 8 · Chorus 8 (16ths) · Verse 8 · Bridge 8 (triplets) · Break 4 ·
  Chorus 8 (48 bars, 2:00 at 96).
- **Takeover sequence**: L01 Rhodes of the verse (push) → L02 snare and hats of the chorus (ghosts) → L03 verse tune
  (ties; starts from L01's pushed Rhodes, as the lesson already does) → L04 side sketch in 6/8 (or a planned 12/8
  outro) → L05 bridge piano or hats (triplets) → L06 kick of the second break, bars 3–4 (answer).
- **Hard parts**: Oak's song must use `.early`, `.velocity`, `.ply` before they unlock (L01, L02, L05) to sound
  complete; that is only legal in a preview/Band context. The `.early()` + `arrange()` boundary behaviour (L01 note).
  Meter change (L04).

### U14 song: "one home, four colours" → released as C6
- **Natural shape**: 4/4, home **G** (L01/L02 are already in G; U14.CP stays on D, preserving "the checkpoint and C6
  use other home notes"), ~100 BPM (lessons 84–112), modes as sections through a key plan of modes after `arrange()`.
- **Form and harmony**: Intro 4, G Lydian `G A/G` over a held G (pad, delayed piano) · Verse 8, G Mixolydian
  `G F C G` (crunch, organ, pumping bass) · Chorus 8, G Dorian `Gm7 C7` (Rhodes, fingerbass) · Verse · Chorus ·
  Bridge 8, G Phrygian `Gm A♭` (acoustic guitar) · Outro vamp 8 (the learner's colour).
- **Takeover sequence**: L01 verse riff (♭7) → L02 verse chords (♭VII) → L03 chorus chords (major IV) + chorus tune
  (♮6) → L04 intro tune (♯4) → L05 bridge riff (♭2) → L06 outro vamp (pick a colour, `mode` scoped to the outro).
- **Alternative with no re-keying**: a "white-key song" whose sections keep each lesson's home (verse G Mixolydian,
  chorus D Dorian, intro F Lydian, bridge E Phrygian): zero changes to keys, starters and tests, but home moves every
  section, which is musically weak and contradicts the U14 convention that "the same seven notes, another home" is an
  observation of U14.L06 S4, "never used as a recipe".
- **Release**: C6 (2 sessions), FITS-WITH-CHANGE (rubric scope). Order: C6 comes after U15.L01, so the U15 song is
  already open when the U14 song is released.

### U15 song: "soul song with visitors" (no capstone today; C7 later asks for one secondary dominant)
- **Natural shape**: 4/4, C major, ~90 BPM (lessons 84–92, L05 120), Rhodes + upright + piano tune; organ for the
  walk-up, horns + trumpet for the tag.
- **Form and harmony**: Verse 8 `C Am F G7 C Am Dm G7` (L02 starter) · Chorus 8 `C Em Am C F Am Dm G7` (L03 starter) ·
  Bridge 8 `C C Dm7 Dm7 G7 G7 Am7 G7` (L04, gospel organ) · Interlude 8 `C^7 Dm7 Em7 F^7 F^7 Em7 Dm7 C^7` (L06, the
  staircase) · Tag 8 `C Em Am Am Dm G7 C G7` (L05, horns).
- **Takeover sequence**: L01 verse tune (two bent notes) → L02 verse chords, bar 7 (V7/V; prompt must refer to the
  learner's tune) → L03 chorus chords (visitors) → L04 bridge chords (vii°7) → L05 tag chords + a new `horns:` line →
  L06 interlude chords (two doors; seeded from the learner's U12.L04 sketch or Oak's staircase).
- All six required rules are `degree-set`/`contains-rn`, key-relative and section-scopable: the most song-ready unit.

### U16 song: "anthem ballad with borrowed light" (no capstone today; C7 later asks for ♭VI–♭VII–I)
- **Natural shape**: 4/4, C major, ~96 BPM (80–112: a half-time verse feel and a driving chorus), piano → organ →
  overdriven guitar → strings → tenor.
- **Form and harmony**: Intro/riff 4 `C F C F` (L03, organ stabs) · Verse 8 `C Am F F …` (L01) · Chorus 8
  `C G Am F C G F C` (L02) · Verse 2 8 (same tune, new chords: L05) · Chorus · Coda 4–8 in C minor ending on C major
  (L04).
- **Takeover sequence**: L01 verse chords (iv) → L02 chorus ending, bar 7 (♭VI ♭VII) → L03 riff chords (♭III) →
  L04 coda's last chord (Picardy, re-keyed from A minor) → L05 verse-2 chords under Oak's unchanged tune
  (reharmonize).
- **Constraint**: the tune must stay Oak's through L05 (static `reharmonize` reference) and must be written clash-free
  for every borrowed chord the unit invites.

### U17 song: "the song that travels" → released as C7
- **Natural shape**: 4/4, C major, ~104 BPM (96–112), pop (piano/Rhodes, electric/upright bass by flavour).
- **Form and harmony**: Verse 8 `C Am F G …` · Chorus 8 `C G Am F` · Verse 2 8 (ends in G through Am–D7–G) · Chorus ·
  Bridge 8 (A minor through E7) · Last chorus 8 lifted to D (48 bars, ~1:50).
- **Takeover sequence**: L01 verse 2's last bars (pivot to G) → L02 the last chorus (lift, two key plans,
  `chordsChorus2` renamed) → L03 the bridge (E7 → Am, harmonic-minor key plan) → L04 the bass of the whole song in
  degrees with the key plan.
- **Release**: C7, FITS. The song already has ≥32 bars and the lift with the same tune (`key-change` +2,
  `sameMelody`); C7.S1 adds the secondary dominant and ♭VI–♭VII–I (the U15/U16 colours), S3 releases.
- CF-A stays its own song (album slot `single`, 4 sessions, a full Oak arrangement): it is the template for the
  whole idea rather than a unit's release.

---

## 4. Advanced tracks: light inventory (one row per lesson)

All Makes are `code-make`, one required rule, no `fromSketch`. "2-5-1" = `band.two-five-one`; tracks in brackets.
J lessons all declare `swing: { subdivision: 8, amount: 1/3 }` on the Make. File: `content/advanced/<T>/<L>/lesson.ts`,
Make line in brackets.

### J Jazz Harmony

| Lesson | Idea | Key · bpm | Learner writes | Band | Required rule | Fit |
|---|---|---|---|---|---|---|
| J1.L01 Swing Feel & the Ride (:443) | swing ride, hat on 2 & 4 | C · 132 | `drums:` ride, `hats:` | 2-5-1 [bass, chords] | `ride-swings` · `swing` ride 1.45–2.4 | FITS |
| J1.L02 Reading 7th-Chord Symbols (:460) | sixths, sus, chart symbols | F · 116 | `changes` (bass, chords) | 2-5-1 [drums] | `sixth-and-sus` · `chord-qualities` 6 + sus | FITS-WITH-CHANGE (key) |
| J1.L03 The Major ii–V–I (:428) | ii–V–I as one gesture | C · 132 | `changes`, 8 bars | 2-5-1 [drums] | `two-five-one` · custom `ii-v-chain` | FITS |
| J1.L04 Guide-Tone Lines (:447) | 3rds/7ths thread | B♭ · 120 | vibes `mel:` | 2-5-1 [drums] | `lands-on-the-thread` · `guide-tones` with **hard-coded** `changes: [Cm7, F7, Bb^7, Bb^7]` | FITS-WITH-CHANGE (key; chord list) |
| J1.L05 Shells (:391) | root-3-7 shells | C · 132 | `chords:` note names | 2-5-1 [drums, bass] | `shells` · custom `voicing-shape` with hard-coded changes | FITS-WITH-CHANGE (chord list) |
| J2.L01 All Twelve Keys (:412) | ii–V–I round the cycle | C → tour · 152 | chords, bass, mel with `tour` | 2-5-1 [drums] | `comping-tours` · custom `transposed-copy` +5 ×2 | FITS-WITH-CHANGE (a touring solo section) |
| J2.L02 Minor ii–V–i (:429) | iiø7–V7♭9–i | D minor · 112 | chords, bass, mel | 2-5-1 [drums] | `minor-ii-v-i` · `contains-rn` [iiø7, V7, i] inOrder | FITS-WITH-CHANGE (relative-minor section) |
| J2.L03 Extensions (:417) | 9, 11, 13; clashes | E♭ · 84 | vibes `mel:` | 2-5-1 [drums] | `colours-ring` · custom `tensions-used` 9/13 min 8 | FITS-WITH-CHANGE (key, ballad tempo) |
| J2.L04 Chord-Scales (:365) | a scale per chord | G→B♭ · 126 | `mel:` follows chords into B♭ | 2-5-1 [drums] | `line-fits` · custom `chord-scale-fit` .9 | FITS-WITH-CHANGE |
| J3.L01 Rootless A/B (:511) | rootless voicings | F · 120 | `chords:` | 2-5-1 [drums, bass] | `rootless-alternating` · `matches` against **two static solutions** in F | FITS-WITH-CHANGE (static reference) |
| J3.L02 Drop-2 & Spread (:405) | drop-2 under a tune | C · 112 | `chords:` + vibes | 2-5-1 [drums, bass] | `drop-2` · custom `voicing-shape` hard-coded changes | FITS-WITH-CHANGE (chord list) |
| J3.L03 Comping Rhythms (:519) | Charleston, pushes | B♭ · 144 | `chords:` rhythm | 2-5-1 [drums, bass] | `off-the-beat` · `syncopation` chords min 3 | FITS |
| J3.L04 Walking Bass (:405) | four to the bar, approach tones | G · 132 | `bass:` | 2-5-1 [drums, chords] (AUTHORING §8 recommends `band.ii-v-i-comp` here) | `walks` · custom `walking-bass` hard-coded `[Am7, D7, G^7, G^7]` | FITS-WITH-CHANGE (chord list) |
| J4.L01 Turnarounds (:440) | I–vi–ii–V, iii–VI–ii–V | E♭ (ex) · 132 | `changes` 8 bars | 2-5-1 [drums] | `bright-turn` · `contains-rn` iii7 VI7 ii7 V7 inOrder | FITS-WITH-CHANGE (the blues' last bars) |
| J4.L02 Jazz Blues in F (:393) | the jazz 12-bar | F (ex) · 132 | `changes`, mutetpt tune | `band.blues-12bar` [drums] | `jazz-blues` · `blues-form` jazz | FITS (the J4 song) |
| J4.L03 Rhythm Changes (:372) | 32-bar AABA | B♭ · 176 | chords, bass in `arrange()` | 2-5-1 [drums] | `bridge` · `progression` III7…V7 bars 17–24 | SIDE (another form; seeds JC3) |
| J4.L04 Reading a Standard (:440) | head from a lead sheet | B♭ · 160 | `mel:` bars 3–8 from the page | 2-5-1 [drums] | `the-page` · `matches` static page | SIDE (fixed tune) |
| J5.L01 Tritone Substitution (:430) | ♭II7 for V7 | B♭ (ex) · 120 | `changes` turnaround | 2-5-1 [drums] | `tritone-sub` · `device-count` | FITS-WITH-CHANGE (key) |
| J5.L02 Backdoor (:393) | iv7–♭VII7–I | F (ex; lesson C) · 76 | `changes` | 2-5-1 [drums] | `backdoor` · `device-count` | FITS-WITH-CHANGE (key) |
| J5.L03 Secondary ii–Vs (:462) | aim a ii–V anywhere | G (ex) · 132 | `changes` + tune kept | 2-5-1 [drums] | `secondary-ii-v` · `device-count` | FITS-WITH-CHANGE (key) |
| J5.L04 Reharm Techniques (:407) | devices on a tune | C · 72 | `changes` under a fixed tenor tune (Aura Lee, as U16.L05) | 2-5-1 [drums] | `same-tune-two-devices` · `reharmonize` static reference | FITS-WITH-CHANGE (reference) |
| J5.L05 Coltrane Changes (:286) | enrichment | C · 144 | tenor line | 2-5-1 [drums] | `guide-tones-through` · hard-coded Coltrane changes | SIDE (enrichment, ungated) |

### R Advanced Rhythm

| Lesson | Idea | Meter · key · bpm | Learner writes | Band | Required rule | Fit |
|---|---|---|---|---|---|---|
| R1.L01 Metric Weight (:454) | syncopation hierarchy | 4/4 · E min · 96 | drums, `bass:` | aeolian [chords] | `bass-pulls` · `syncopation` bass min 4 | FITS |
| R1.L02 Swing Ratios (:441) | 16th swing amounts | 4/4 · A min · 88 | `hats:` 16th swing | aeolian [chords] | `sixteenths-lean` · `swing` 16 1.35–2.4 | FITS-WITH-CHANGE (swing in one section) |
| R1.L03 The One (:459) | 16th funk, ghosts | 4/4 · E min · 100 | snare ghosts | none | `snare-whispers` · `velocity-ghosts` | FITS |
| R1.L04 Interlock (:467) | bass/clav/guitar as one | 4/4 · C min · 100 | bass, keys, gtr | none | `parts-interlock` · custom `interlock` | FITS-WITH-CHANGE (key) |
| R1.L05 Displacement & Laid-Back (:398) | displaced figure, `.late()` | 4/4 · D min · 92 | a 2–4 hit figure | none | `figure-displaced` · custom `displaced-copy` | FITS-WITH-CHANGE (key) |
| R2.L01 Five & Seven (:452) | 5/4 grouped 3+2 | **5/4** · E min · 150 | `kick:` | none (NO_BAND says no 5/4 Band; `band.odd-54` now exists) | `kick-marks-three-two` · `onsets` | SIDE (meter) |
| R2.L02 Odd Grooves (:492) | 7/8 2+2+3 | **7/8** · A min · 240 | drum accents | none | `accents-two-two-three` · custom `grouping-accents` | SIDE |
| R2.L03 Hemiola (:440) | 6/8 ↔ 3/4 | **6/8** · A min · 60 | chords, bass | `band.soul-68` [drums] | `regrouped` · custom `regrouped` | SIDE |
| R2.L04 Polyrhythm (:464) | 3:2, 4:3 | 4/4 · C min · 80 | `perc:` cowbell vs kick | none | `three-against-two` · `polyrhythm` | FITS-WITH-CHANGE (with L05 a 4/4 R2 song) |
| R2.L05 Polymeter (:397) | `{ }%n` drift | 4/4 · D min · 100 | `kick:` cycle | none | `kick-cycle` · custom `polymeter-cycle` | FITS-WITH-CHANGE |
| R3.L01 Tresillo & Cinquillo (:475) | E(3,8), E(5,8) | 4/4 · C · 100 | `bass:` tresillo, `perc:` | son [drums, chords] | `bass-tresillo` · `onsets` @bass | FITS |
| R3.L02 Clave Direction (:470) | 3-2 / 2-3 | 4/4 · C · 104 | clave `perc:`, piano `mel:` | son [all] | `tune-faces-clave` · custom `clave-aligned` | FITS |
| R3.L03 Euclidean (:623) | `(k,n,r)` | 4/4 · C · 128 | `perc:` bell, `perc2:`, kick | son [bass, chords] | `bell-five-sixteen` · `euclid` 5/16 | FITS-WITH-CHANGE (tempo) |
| R3.L04 Montuno & Tumbao (:508) | clave-aligned piano and bass | 4/4 · C · 100 | `keys:` montuno, bass | son [drums] | `montuno-faces-the-clave` · custom `clave-aligned` | FITS |
| R3.L05 Rhythm Master Lab (:470) | displaced answer | 4/4 · C · 100 | `perc2:` cowbell | son [drums] | `bell-displaced` · custom `displaced-copy` | FITS |

### A Arrangement & Sound

| Lesson | Idea | Key · bpm | Learner writes | Band | Required rule | Fit |
|---|---|---|---|---|---|---|
| A1.L01 Waves & Harmonics (:395) | `.partials()` | C · 100 | bass/riff sound | two-chord-vamp [chords] | `harmonics-chosen` · custom `control-set` | FITS |
| A1.L02 Filters (:440) | `.lpf`, `.lpenv` | C · 100 | one part's filter | same | `filter-envelope` · `control-set` | FITS |
| A1.L03 Envelopes (:385) | ADSR | C · 100 | two shapes | same | `a-shape` · `control-set` envelope | FITS |
| A1.L04 Space (:454) | room, delay time | C · 100 | one part's space | same | `a-space-you-set` · `control-set` | FITS |
| A1.L05 Grit (:395) | distort, crush, coarse | C · 100 | one part's grit | same | `grit-you-can-hear` · `control-set` | FITS |
| A1.L06 Movement (:434) | vib, phaser, tremolo, sweep | C · 100 | pad or lead moves | same | `a-part-that-moves` · `control-set` | FITS |
| A1.L07 FM & Supersaw (:556) | `.fm()` | C · 100 | one FM part | same | `fm-you-can-hear` · `control-set` | FITS |
| A2.L01 Roles & Registers (:421) | register per role | A min · 90 | chords up, tune up | aeolian [drums] | `chords-off-the-bass` · `range` C3–C6 | FITS |
| A2.L02 Texture & Density (:456) | thin verse, full chorus | A min · 90 | chorus consts | aeolian [drums] | `verse-against-chorus` · `contrast` density | FITS |
| A2.L03 Counter-Melody (:477) | a second line | A min · 90 | `vox:` | aeolian [drums] | `answers-the-tune` · custom `counter-melody` | FITS |
| A2.L04 Sampling (:348) | chop the `brk` break | A min · 96 | `drums:` `.slice()` | aeolian [bass, chords] | `break-flipped` · custom `slices-reordered` | FITS |
| A2.L05 Mix & Dynamics (:426) | levels | A min · 90 | gains, pans | aeolian [drums] | `tune-on-top` · custom `level-balance` | FITS |
| A2.L06 Genre Translation (:436) | one tune, two idioms | A min · 90 | `ballad`/`drive` section consts | aeolian [chords] | `two-styles` · custom `same-tune-two-ways` | FITS |

A1.L01–L04 are `side(...)` lessons (`content/syllabus.ts`, unit A1) that open at U03.L02; A1.L05–L07 at U09.CP; A2 at
U10.CP (`trackGates`, `syllabus.ts:636-649`). The A1 loop (kick, snare, hats, bass, mel over the two-chord vamp, C,
100) is literally the same song in all seven lessons; each lesson shapes one part's sound.

### 4.1 Per-track song proposals and closing capstones

| Unit | Natural song | Takeovers | Capstone that ends it |
|---|---|---|---|
| J1 | swing trio tune in C, 132, ii–V–I changes | L01 drums (ride) → L02 head chart (6, sus) → L03 changes (two ii–V–Is) → L04 vibes tune on guide tones → L05 left-hand shells | none directly; **JC1** (`content/capstones.ts:3533`, after J.CP1 = J1+J2) |
| J2 | same tune, its solo choruses: a touring chorus, a minor bridge, a ballad tag | L01 touring chorus → L02 minor bridge → L03 tune colours (9, 13) → L04 solo line through B♭ | **JC1** ii–V ballad: 16 bars, 56–92 BPM, ii–Vs in ≥3 keys, guide-tone tune: FITS-WITH-CHANGE (tempo: the J1/J2 Makes run 112–152) |
| J3 | a ii–V–I trio in one key (F or G) | L01 rootless comping → L02 drop-2 under the tune → L03 comping rhythm → L04 walking bass | none; feeds **JC2** (walking bass + shells from one `chord()` pattern) |
| J4 | the jazz blues in F | L01 turnaround into bars 11–12 → L02 the blues changes + mutetpt head; L03 rhythm changes and L04 standard as side sketches | **JC2** Jazz Blues in F (`:3686`, after J4.L04): FITS; **JC3** rhythm-changes contrafact (`:3874`) grows from J4.L03 |
| J5 | Oak's arrangement of a public-domain ballad (Georgia on My Mind or Body and Soul, JC4's songs) | L01 tritone sub in its turnaround → L02 backdoor home → L03 secondary ii–V → L04 two devices under the kept tune; L05 side | **JC4** Reharmonize a Standard (`:4014`, after J.CP2): FITS-WITH-CHANGE (the J5 Makes are on Aura Lee-like and generic loops today; `song-melody-kept` reads the picked song) |
| R1 | a minor funk vamp, ~100 BPM | L01 bass pulls → L02 hats swing (one section) → L03 snare ghosts → L04 bass/clav/guitar interlock → L05 displaced figure | **RC1** 16th-Note Funk (`:4082`, after R.CP): FITS (one-chord minor-7 vamp, 90–115, ghosts, syncopated bass, horn stabs) |
| R2 | none: every lesson is its own meter (5/4, 7/8, 6/8); L04–L05 could share a 4/4 song | – | none (RC2's 3:2 layer draws on R2.L04) |
| R3 | a son in C, 100, I–V7 | L01 tresillo bass → L02 clave + tune → L03 bell section → L04 montuno → L05 displaced cowbell | **RC2** Clave & Polyrhythm (`:4191`): FITS-WITH-CHANGE (RC2 requires a tresillo bass "not a tumbao", while R3.L04 suggests a tumbao) |
| A1 | the C-major vamp loop, 100 | one part's sound per lesson | none; its `control-set` skills are AC1's `sound` rule |
| A2 | an A-minor song, 90, verse/chorus | L01 registers → L02 chorus density → L03 counter-melody → L04 break → L05 mix → L06 two styles | **AC1** One Tune, Two Genres (`:4289`) matches A2.L06's idea but requires St. Louis Blues or Sweet Georgia Brown note for note; **AC2** Neo-Soul Ballad (`:4433`) needs J3.L04 and R1.L05 too. Neither is the A2 song as written: FITS-WITH-CHANGE either way |

---

## 5. What makes the rework easy, what makes it hard

### Easy (already built)
1. **Section-scoped rules** on every rule kind, with per-bar keys (`rules.ts:1939-1946`). A Make's one required rule can
   be pointed at the section the learner took over without new grader work (probe `modulation` and custom rules).
2. **Songs in sections are the house style from U09**: one `arrange()` per labelled track with `<role><Section>`
   consts (STYLE §10), read by both the grader (`sectionsFromAst`) and the Band (`followLearnerForm`). U17.L02,
   U17.L03, U17.CP, C7 and CF-A starters are already songs.
3. **Key plans** follow `arrange()` (U17) and Bands follow them (`bandCodeFor`, `keyPlanAt`): modulating songs and
   (by extension) per-section modes have a code form.
4. **One `const changes` drives chords and bass** (U08.L04 on): in U14–U17 the learner's harmony takeover moves the
   bass with it, inside learner code where the rules read it.
5. **Persistence plumbing**: `fromSketch` + `makeStart` already open "the newest version of your sketch of lesson X"
   with an "Oak's copy" switch; the song is that, generalised to "the unit's song".
6. **U15 and U16 are nearly song-ready**: same key (C), similar tempos, every required rule key-relative
   (`degree-set`, `contains-rn`), every Make on axis drums with chords + bass + tune in learner code.
7. **C7 is the U17 song's natural release**, and CF-A's starter is a working example of "Oak plays a complete song".

### Hard (decisions the designer must make)
1. **Where Oak's parts live.** In learner code they are graded and visible, but subject to unlock-before-use (Oak could
   not write `.early` before U13.L01, `.velocity` before L02, `.ply` before L05, `mixolydian`/`dorian`/`lydian`/
   `phrygian` before U14.L01/L03/L04/L05, `horns`/`trumpet` before U15.L05, `tenor` before U16.L05) and the whole
   Make is editable (no read-only lines in a Make today). In a Band they may use locked tools and stay read-only, but
   **the grader does not receive the Band** (fix: pass `ctx.band` from `app/src/lesson/grading.ts` and content:check;
   the grader side exists), and **Bands play fixed harmony** (no Band follows learner chord names).
2. **Rules tied to Oak's part**: `chord-tones-strong` with `harmony: "chords"`, `groove-lock` with the kick,
   `bass-line` with `harmony: "chords"` all read tracks in learner code today. Under a song where Oak owns chords or
   drums, they need `band.*` tracks (point 1) or Oak's lines in learner code.
3. **Static references inside an evolving song**: `reharmonize` (U16.L05, J5.L04), `matches` (U17.L04 suggestion,
   J3.L01, J4.L04) and custom rules with hard-coded chord lists (`guide-tones`/`voicing-shape`/`walking-bass` in
   J1.L04, J1.L05, J3.L02, J3.L04, J5.L05). They assume Oak's exact material; if the learner already changed the tune
   or the chords, they misgrade. Either the referenced part stays Oak's until that lesson, or the rule reads the
   song's own section.
4. **Per-lesson key, mode, tempo and meter**: U14 (four homes), U16.L04 (A minor), U17.L04 (F), U15.L05 (120 BPM vs
   ~90), U13.L05 (76 vs 96), U13.L04 and R2 (other meters; one meter per lesson/exercise is the model).
5. **Flavour feel**: jazz-soul swings by default (`content/flavours.ts`); U13 (straight pushes) and R1 (varied swing)
   need a flavour rule that keeps the song straight.
6. **Content tests**: every Make has authored tests where "the starter as it is" must fail (`make.unchanged` or
   `rubric.unmet`), a minimal pass, a rich pass and a `rubric.unmet` fail (AUTHORING §9, check 12/14). With a song,
   each lesson needs **Oak's canonical song state before and after its takeover** to test against (the runtime opens
   the learner's state, CI tests Oak's chain).
7. **Prompts that assume Oak's material**: U15.L02/L03 ("change the tune's note in that bar"), U14 prompts naming
   notes ("plays the ♭7 (F)"), U16 starters crafted so the tune is clash-free in "the bar the learner is invited to
   change".
8. **Release without a capstone**: U13, U15, U16 (and J1, J3, R2, A1) end with no capstone; album slots exist only on
   capstones (`brief.album.slot`).
9. **Interleaving**: the default order releases the U14 song (C6) after the U15 song has started; CF-T runs through
   U15–U16; the Today screen has to show more than one open song.
10. **Frozen validation**: `NO_BAND`, the Band-meter check (`content/validate/specs.test.ts:49-71, 229-233`) and the
    unit specs (`content/specs/U13–U17.ts`, conventions that forbid Bands in U13) encode today's model and are frozen
    registries in the Build phase.
11. **Grading window**: lesson grading caps at 64 bars and 1.5 s, the tutor reads 16 bars; Makes declare
    `bars: [min, max]` of 2–24 (U17.L02 up to 24, J4.L03 64). A 48–56-bar song graded on every Run needs section
    windows (the rule `section` plus a smaller evaluation window) or the capstone budget.
12. **Stale comments worth fixing while there**: U13.L04 and R2.L01 say no 6/8 / 5/4 Band exists (`band.soul-68`,
    `band.odd-54` do, `content/bands/index.ts:1045-1053, 1242`); J3.L04 uses `band.two-five-one` where AUTHORING §8
    names `band.ii-v-i-comp`; sketches store the lesson key, not the Make's `ex.key` (U14 sketches say "G major" for a
    G Mixolydian Make, `app/src/lesson/server.ts:73`).

### Count (core, 27 lessons)
FITS 11 (U13.L03; U14.L01, L02; U15.L01–L04; U16.L01–L03; U17.L02), FITS-WITH-CHANGE 15, SIDE 1 (U13.L04).
Advanced (50): FITS 23 (J 4, R 6, A 13), FITS-WITH-CHANGE 21 (J 15, R 6), SIDE 6 (J4.L03, J4.L04, J5.L05, R2.L01,
R2.L02, R2.L03).
