# Make inventory, core U07–U12, for the "each unit is one song" redesign

Read for this report: every `content/core/U07…U12/Lxx/lesson.ts` and `lesson.mdx` (the Make step of each, plus each
file's header comment), the four checkpoints `content/core/{U07,U09,U10,U11}/CP/checkpoint.ts`, the unit specs
`content/specs/U07.md … U12.md` ("The one idea" of each lesson), `content/capstones.ts` (C2, X1, C3, C4, C5, X2),
`content/bands/index.ts`, `content/checkpoints.ts`, `content/syllabus.ts` (unit rows, `defaultOrder`),
`content/AUTHORING.md` §8 and §19.9, `docs/design/contracts.md` §5.8–§5.10, and the app/grader code that plays,
grades and saves a Make. Every lesson value below (key, meter, bpm, band, starter, rubric) was read by importing the
lesson modules with Bun, not by eye, so it is exact for the current tree (HEAD `dec85d2`).

Verdict legend for "one song per unit": **FITS** (the Make can happen inside the unit song as is, give or take the
tempo), **FITS-WITH-CHANGE** (it can, if the named thing changes), **SIDE** (it cannot sensibly be part of the unit
song; it stays a side sketch or the lesson changes its Make).

---

## 0. How a Make works today (the parts the song rework touches)

**Lesson shape.** `LessonDef` (docs/design/contracts.md:1427-1438): `key`, `meter`, `bpm`, optional `swing`,
`pickup`, `flavours` (per-flavour starter-sound swaps, e.g. `{"flavour.jazz-soul":{"sounds":{"snd.piano":"snd.rhodes"}}}`),
`steps` (the last is `kind: "make"`), `wrapAt`. Every U07–U12 Make has `minutes: 2.75` (expert; CI scales ×1.4).

**The Make exercise.** `CodeMakeEx` (packages/content-kit/src/schema/exercise.ts:695-711):

```ts
export interface CodeMakeEx extends ExBase<"code-make"> {
  code: CodeSpec;                 // { starter, toolbox?, autoCheckOnRun? }
  bars: [min: number, max: number];
  rubric: RubricRule[];           // exactly ONE rule with required: true (contracts.md:1536)
  saveAs: "sketch";
  fromSketch?: LessonId;          // open the learner's latest sketch of that lesson
}
```

A Make exercise may also carry its own `key` (U10.L02, U10.L09, U11.L02, U11.L03, U11.L06, U12.L03) and `pickup`
(U07.L08, U10.L09). Starter rule (content/AUTHORING.md:232): the starter never passes as it came (`code.unchanged` /
`make.unchanged` / `rubric.unmet`). Editable regions in starters use `⟪ ⟫` markers + the `edit-only-regions`
constraint (used in modify steps, not in these Makes).

**Rubric scoping already exists.** Every rule takes `section?: SectionRef` = `{ section, nth? } | { bars: [a,b] } |
"last"` (packages/content-kit/src/schema/rubric.ts:21-38, Wave 5 feature `rubric.section`), resolved through
`sectionsFromAst` (packages/grader/src/lint/ast.ts:626) from `<role><Section>` consts + one `arrange()` per track
(content/STYLE.md §10, line 382). A section rule on a piece with no `arrange()` fails with `form.no-sections`.
This is the main enabler for grading one lesson's part inside a whole song.

**The Band.** `StepUi.band: BandRef = { band, followsLearnerKey?, tracks? }` (contracts.md:1418). `BandDef`
(contracts.md:1462-1470) holds one code string per flavour; definitions at content/bands/index.ts:1047-1246;
later-stage code per course point via `bandCodeAt` (content/bands/index.ts:7-11: jazz-soul plays four-note chords
and swings from U03, funk four-note chords from U06, so **all U07–U12 Bands are already in their "late" stage**).
The app resolves it with `bandSetupOf` (app/src/lesson/band.ts:14-36) and plays only `tracks`. The Band shares the
session tempo; its key is the step key unless `followsLearnerKey` (only U03 lessons use that). AUTHORING.md §8 rule 4:
"The Band supplies the roles the learner is not writing" — the song model generalises exactly this.

**Sectioned Oak backing already exists.** `band.sections` (content/bands/index.ts:552-639; def at 1146) is written as
section consts with one `arrange()` per track, and packages/strudel/src/band-form.ts:1-12 rewrites its `arrange()` to
the learner's sections ("a Band chorus always lands under the learner's chorus"; an unknown section type such as
intro or bridge falls back to the verse).

**Grading does not see the Band (key constraint).** The lesson Make is graded on the learner's code only:
app/src/lesson/LessonPlayer.tsx:417-425 calls `gradeStep(browserGrader, env, s.exercise, { code }, …)`; nothing in
app/src/lesson/grading.ts adds a Band. The grader itself can evaluate one (`band?: string`, "Band-layer code,
evaluated separately; its tracks are collected as `band.<label>`", packages/grader/src/types.ts:161-162; a rule may
name `band.chords`, and Band tracks never match `*` or a role, types.ts:206-207), but no caller passes it. The U07
spec (content/specs/U07.md, Conventions) states the consequence: "The grader is not given the Band's code, so a rule
that reads harmony reads a `chords:` line in the learner's code". That is why many Makes put Oak's chords (and bass)
**inside the learner's starter** with "Keep the chords as they are" and play the Band on drums only. In the song
model those given lines are Oak's parts; ~9 required rules below read them (marked **[reads chords from code]**).

**Saving.** A Make saves a sketch (app/src/lesson/server.ts:67-79): `{ title, originKind: "lesson-make", originId,
code, bpm, meter, key, band: { bandId, flavour, mutes } }`; `mutes` = the Band roles the step left out
(app/src/lesson/band.ts:42-44). `fromSketch` (AUTHORING.md:791-793) opens the latest saved sketch of an earlier
lesson with a "Start from Oak's copy" button; used in this range by U10.L06 (← U10.L05) and U11.L07 (← U11.L06).
It must not be used where the learner's own sketch already meets the required rule (U12.L01 starts from Oak's copy
for that reason, content/specs/U12.md:110).

**Unlocks that matter for a song in code.** `const` unlocks at U08.L04, `arrange()` + section consts at U09.L02,
`.mask()` at U09.L05. Before U09 the learner's code cannot hold sections, so a U07/U08 unit song's structure has to
live outside the learner's code (Band-like, where locked tools are allowed), and the learner's line has to be
placed into a section by the app.

**Default order interleaves units** (content/syllabus.ts:663-670): `… U07.L10, U08.L01, GYM.03, U07.CP, C2.S1, C2.S2,
X1.S1–S3, U08.L02 … U09.L05, U10.L01, U09.CP, C3.S1–S4, … U10.L09, GYM.08, U11.L01, U10.CP, C4.S1–S2, … U11.L08,
U12.L01, GYM.11, U11.CP, C5.S1–S2, X2.S1–S2, U12.L02 …`. A checkpoint sits after the next unit's L01, so **the next
unit's first lesson always comes before this unit's release**: two songs are open at once in those windows.

---

## 1. Inventory

Columns: lesson (Make step and file lines), one idea (from the unit spec), meter/key/bpm, starter (short), what the
learner writes, Band (`band` + `tracks` played; what that Band plays), required rule (id, rule, label), fromSketch,
fit. A "given" line is an Oak part inside the learner's starter.

### U07 Melody (10 lessons; C major except L09; 76–104 BPM)

| Lesson | One idea | Meter, key, BPM | Learner writes | Band (tracks) | Required rule | Fit |
|---|---|---|---|---|---|---|
| U07.L01 Shape | mostly steps, one high point placed late, home | 4/4 C maj 92 | melody, 8 bars | phrase-8bar (drums bass chords) | `mostly-steps` step-ratio ≥0.6 on @melody | FITS |
| U07.L02 Motif & Variation | a motif that comes back: repeat, sequence, retrograde | 4/4 C maj 96 | melody, 4 bars | axis-4bar (all) | `motif-comes-back` motif-reuse ≥0.5 either | FITS |
| U07.L03 Landing on Chord Tones | chord tones on beats 1 and 3 | 4/4 C maj 92 | melody (chords given) | axis-4bar (drums bass) | `chord-tones` chord-tones-strong ≥0.6 vs `chords` [reads chords from code] | FITS-WITH-CHANGE |
| U07.L04 Passing & Neighbour | passing/neighbour tones on weak beats | 4/4 C maj 88 | melody decoration (chords given) | two-chord-vamp (drums bass) | `decorated` non-chord-tones passing/neighbour ≥2 vs `chords` [reads chords from code] | FITS-WITH-CHANGE |
| U07.L05 Leaning & Holding | appoggiatura / suspension, then a step down | 4/4 C maj 76 | melody (chords given) | axis-4bar (drums) | `a-lean` non-chord-tones appoggiatura/suspension ≥1 vs `chords` [reads chords from code] | FITS-WITH-CHANGE |
| U07.L06 Question & Answer | open question, closed answer: an 8-bar period | 4/4 C maj 92 | melody bars 5–8 | phrase-8bar (all) | `comes-home` ends-on-degree 1 on @melody | FITS-WITH-CHANGE |
| U07.L07 Call & Response | a second part answers in the gaps | 4/4 C maj 96 | a new `vox:` line (call `mel:` given) | axis-4bar (all) | `two-parts` custom `call-response` {a:mel, b:vox} | FITS-WITH-CHANGE |
| U07.L08 Pickups | the tune leads in from bar 0 | 4/4 C maj 84, exercise pickup `[1,1]` | melody bar 0 pickup (chords given, rest in bar 0) | axis-4bar (drums) | `a-pickup` pickup leadsIn on @melody | FITS-WITH-CHANGE |
| U07.L09 Reading Lead Sheets | a song on one page: tune + symbols | **3/4 F maj 80** | a `chords:` line (+ tune rework) | waltz-vamp (drums) | `tune-and-chords` tracks ≥2 roles chords+melody | SIDE |
| U07.L10 Hook Lab | a short hook that comes back; controlled chance | 4/4 C maj 104 | melody, 2–8 bars | axis-4bar (all) | `comes-back` motif-reuse ≥0.25 (loopRepeats 4) | FITS-WITH-CHANGE |
| U07.CP Make "A hook" | hook over I V vi IV | 4/4 C maj 88 | melody | axis-4bar (all; content/checkpoints.ts:82) | `hook` motif-reuse | FITS |

Details (file lines are the Make step in lesson.ts / its prose in lesson.mdx):

- **U07.L01** — content/core/U07/L01/lesson.ts:485 (rubric 502-531), lesson.mdx:55. Starter (MAKE_STARTER, :68-69):
  `mel: n("<[0 2 4 7] [3 5 7 10] [0 2 4 7] [4 6 8 11] [0 2 4 7] [3 5 7 10] [4 6 8 11] [7 ~ ~ ~]>").scale("C4:major").s("piano")`
  — every bar an arpeggio, so every move is a leap. Band `band.phrase-8bar` plays I IV I V | I IV V I under it.
  bars [8,8]. Suggestions: `span` range ≤17, `home` ends on 1. fromSketch: none.
  Fit: **FITS** as the unit song's verse melody (the phrase-8bar harmony is a natural 8-bar verse). Rule is
  harmony-free.
- **U07.L02** — U07/L02/lesson.ts:357 (req :379), mdx:49. Starter `mel: n("<[4 ~ 2 0] [1 2 4 ~] [5 ~ ~ 2] [3 5 ~ 0]>")`
  (four bars that fit their chords but share no shape) over I V vi IV. bars [4,8]. Suggestion: `uses`
  `.scaleTranspose()`/`.rev()`. Fit: **FITS** as chorus melody bars 1–4 over I V vi IV (96 → song tempo).
- **U07.L03** — U07/L03/lesson.ts:488 (req :507), mdx:51. Starter: `chords: n("<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>").scale("C3:major").s("piano").gain(.6)`
  (I V vi IV, given) + `mel: n("<[1 ~ 5 ~] [5 ~ 2 ~] [6 ~ 1 ~] [4 ~ 1 ~]>")` (strong beats a step off the chord).
  Band plays drums+bass only because the chords are in code. Fit: **FITS-WITH-CHANGE** — musically it is the
  chorus melody (bars 5–8), but the required rule reads `harmony: "chords"` from the learner's code; inside a song
  Oak's chords must either be in the graded code (locked) or passed to the grader as `band` and the rule pointed at
  `band.chords`. Also: if the learner already owns the chorus tune from L02, their tune may already pass (L02's
  sequence of a chord arpeggio lands on chord tones) — give L03 a fresh slot (chorus bars 5–8, Oak's off-chord line).
- **U07.L04** — U07/L04/lesson.ts:352 (req :372), mdx:47. Starter: `chords: n("<[0,2,4] [3,5,7]>")` (I–IV, given) +
  `mel: n("<[0 ~ 2 ~] [5 ~ 3 ~] [0 ~ 4 ~] [7 ~ 5 ~]>")` (chord tones on 1 and 3, empty weak beats). Band
  `band.two-chord-vamp` drums+bass. Fit: **FITS-WITH-CHANGE** — natural home is an intro/vamp section on I–IV
  (Oak's skeleton lead line, learner decorates). Two blockers: [reads chords from code]; and if it decorates the
  learner's own L01 verse, the required ≥2 passing/neighbour tones is very likely already met (a mostly-stepwise
  tune is full of passing tones), so it needs an Oak-owned line that leaps between chord tones.
- **U07.L05** — U07/L05/lesson.ts:394 (req :417), mdx:51. Starter: `chords: n("<[0,2,4] [3,5,7] [4,6,8] [0,2,4]>")`
  (I IV V I, given) + `mel: n("<[4@2 2@2] [3@2 5@2] [4@2 6@2] [7@4]>")` (all chord tones, never leans). Band drums
  only. 76 BPM (slow on purpose). Fit: **FITS-WITH-CHANGE** — a 4-bar I IV V I is the second half of the verse phrase
  or an outro; tempo 76 → song tempo (a 4–3 still reads at ~92); [reads chords from code].
- **U07.L06** — U07/L06/lesson.ts:389 (req :413), mdx:49. Starter: the 4-bar question twice,
  `mel: n("<[4 ~ 2 4] [5 ~ 3 5] [4 ~ 2 ~] [1 ~ ~ ~] [4 ~ 2 4] [5 ~ 3 5] [4 ~ 2 ~] [1 ~ ~ ~]>")` (ends on 2). Band
  phrase-8bar, all tracks. bars [8,16]. Suggestion `starts-alike` motif-reuse 2-bar units ≥0.25. The header
  (:15-17) notes the chord-tone suggestion was dropped because the grader reads no Band chords. Fit:
  **FITS-WITH-CHANGE** — it is exactly the verse's harmony, but the verse melody is the learner's since L01 and
  L01 already suggests "ends on 1": the required `ends-on-degree 1` may already be met. Swap the required rule to the
  answer starting like the question (today's suggestion), or hand over verse 2 as the answer.
- **U07.L07** — U07/L07/lesson.ts:448 (req :470), mdx:51. Starter `mel: n("<[0 2 4 ~] ~ [2 4 5 ~] ~>")` (a call with
  bars 2 and 4 empty); learner adds `vox:` on Rhodes/organ/piano. Band axis-4bar all. Suggestion `home` ends-on-1 on
  `vox`. Fit: **FITS-WITH-CHANGE** — a new part (`vox`) answering a call; the song needs a section whose lead leaves
  gaps (an instrumental intro/post-chorus on I V vi IV), or the learner's own chorus must leave room.
- **U07.L08** — U07/L08/lesson.ts:378 (req :401), mdx:49. Exercise `pickup: { units: [1, 1] }`. Starter:
  `chords: n("<~ [0,2,4] [3,5,7] [4,6,8] [0,2,4]>")` (bar 0 silent, then I IV V I, given) +
  `mel: n("<[-3 ~ ~ ~] [0 ~ 2 ~] [3 ~ 5 ~] [4 ~ 1 ~] [0@4]>")` (bar 0's note on beat 1). Band drums only, because "A
  Band never starts late" (U07 spec conventions). bars [5,9]. Fit: **FITS-WITH-CHANGE** — in a song the pickup lives
  in the last bar of the section before (intro → verse) with Oak's chords still sounding; the `pickup` rule and
  bar-0 numbering assume the piece starts with the pickup, so it needs a section-boundary reading.
- **U07.L09** — U07/L09/lesson.ts:504 (req :530), mdx:57. `setcpm(80/3)`, starter
  `mel: n("<[0@2 2] [4@2 2] [3@2 1] [0@2 ~]>").scale("F4:major")` (no chords); learner adds a `chords:` line. Lesson
  body is Amazing Grace (song.amazing-grace) in 3/4 F, lead-sheet panels. Band `band.waltz-vamp` drums. Fit: **SIDE**
  as written (3/4, F major, repertoire). Possible FITS-WITH-CHANGE of the Make alone: "write the `chords:` line for
  one section of your song so its lead sheet shows names" (the `tracks` rule is harmony-free) — that would be the
  learner's first chords takeover, but the lesson's waltz material stays a side trip.
- **U07.L10** — U07/L10/lesson.ts:502 (req :523), mdx:51. Starter `mel: n("<[2 0 4 1] [6 8 4 5] [5 2 7 9] [3 5 0 5]>")`
  (never repeats). 104 BPM. Band axis-4bar all. bars [2,8]. Suggestions: chance tools (`?`, `.degradeBy()`,
  `.sometimesBy()`), range ≤12. Fit: **FITS-WITH-CHANGE** — the hook belongs to the chorus, but if the learner owns
  the chorus since L02 (required motif-reuse ≥0.5), L10's motif-reuse ≥0.25 is already met. Give L10 a fresh
  Oak-owned slot (an instrumental hook line in intro/post-chorus) or a different required rule; tempo 104 → song.
- **U07.CP** — content/core/U07/CP/checkpoint.ts:325. 88 BPM, starter
  `mel: n("<[0 1 2 4] [6 5 4 ~] [5 7 9 ~] [3 2 1 0]>")`, Band axis-4bar all (content/checkpoints.ts:82). Required
  `hook` motif-reuse; suggestions `vox` second line, `.scaleTranspose()`. Fit: **FITS** (a hook over I V vi IV).

### U08 Bass Lines (5 lessons; all 4/4 C major, 92–100 BPM; no CP, no capstone; U09.CP covers U08+U09)

| Lesson | One idea | Meter, key, BPM | Learner writes | Band (tracks) | Required rule | Fit |
|---|---|---|---|---|---|---|
| U08.L01 Roots Down Low | the root on each chord's downbeat | 4/4 C maj 92 | bass (chords given I V vi IV) | axis-4bar (drums) | `roots-on-the-one` matches, harmony matcher level `bass` vs fixed reference [reads chords from code] | FITS-WITH-CHANGE |
| U08.L02 Root–Five–Octave | root, 5th, octave as a cell `.add()`-ed to roots | 4/4 C maj 100 | bass (chords given I V vi IV) | axis-4bar (drums) | `three-notes` bass-line members root/5th/octave ≥0.9 vs `chords` [reads chords from code] | FITS-WITH-CHANGE |
| U08.L03 Walking Up to It | approach tones into the next root | 4/4 C maj 92 | bass approach tones (chords given I IV I V) | axis-4bar (drums) | `approaches` bass-line approach min 5 vs `chords` [reads chords from code] | FITS-WITH-CHANGE |
| U08.L04 Lock with the Kick | kick and bass share one `const` rhythm | 4/4 C maj 96 | kick + bass rhythm (+snare, hats) | axis-4bar (**chords only**) | `bass-with-the-kick` groove-lock kick/bass ≥0.75 | FITS-WITH-CHANGE |
| U08.L05 Bass Dictation & Tone | bass by ear; bass tone | 4/4 C maj 96 | bass (fix + decorate + sound; chords given vi IV I V) | axis-4bar (drums) | `roots-on-the-one` matches harmony level `bass` vs fixed reference [reads chords from code] | FITS-WITH-CHANGE |

- **U08.L01** — U08/L01/lesson.ts:356 (req :375), mdx:49. Starter: `chords: n("[0,2,4]").add(n("<0 4 5 3>")).scale("C3:major").s("piano")`
  + `bass: n("0").scale("C2:major").s("ebass").lpf(600)` (a C pedal under every chord). bars [4,8]. Suggestions:
  `low-down` range C1–C3, `a-tune` melody track. The required rule is a `matches` against one fixed reference
  solution (chords + root bass of this loop). mdx: "Ahead: the Melody checkpoint, and after it your four-chord song
  can have a floor like this one" — the course already imagines this bass going under the C2 song.
- **U08.L02** — U08/L02/lesson.ts:388 (req :407), mdx:49. Starter: same chords + `bass: n("[0 ~ 2 ~]").add(n("<0 4 5 3>")).scale("C2:major")`
  (root then 3rd). Suggestions: 5ths/octaves ≥0.25, a tune.
- **U08.L03** — U08/L03/lesson.ts:422 (req :441), mdx:41. Starter: `chords: n("[0,2,4]").add(n("<0 3 0 4>"))` (I IV I V,
  "a soul vamp") + `bass: note("<[c2 ~ c2 ~] [f1 ~ f1 ~] [c2 ~ c2 ~] [g1 ~ g1 ~]>")` (note names: the chromatic
  approach has no `n` degree until U15). Header (:17-25): the loop was chosen because its roots never move by a step
  or a 3rd (so a roots-only bass scores 0), and `min: 5` is calibrated on the 4-bar loop graded over 16 bars. In a
  song both facts change (section length, harmony), so the threshold must be re-derived per section.
- **U08.L04** — U08/L04/lesson.ts:345 (req :364), mdx:49. Starter: `kick: s("bd ~ bd ~")` +
  `bass: n("<0 4 5 3>").struct("x x x x").scale("C2:major")…`. The Band plays only its chords (I V vi IV). Suggestions:
  `uses tb.const`, kick syncopation. In a song this is a partial-drums takeover: Oak's drums would have to be split
  so the kick alone is handed over (today a Band has one `drums:` track).
- **U08.L05** — U08/L05/lesson.ts:367 (req :386), mdx:43. Starter: chords `<5 3 0 4>` (vi IV I V) +
  `bass: n("<4 5 3 0>")` (a bar late). `flavours` swap ebass→fingerbass (funk), upright (jazz-soul). Suggestions:
  fingerbass/sawtooth tone, 5ths/octaves ≥0.2. Needs a section on vi IV I V (a bridge or a rotated chorus).

### U09 Form (5 lessons; 4/4 C major, 100–112 BPM; U09.CP covers U08+U09; C3 after)

| Lesson | One idea | Meter, key, BPM | Learner writes | Band (tracks) | Required rule | Fit |
|---|---|---|---|---|---|---|
| U09.L01 Phrases Make Sections | 4-bar phrases, 8-bar section; crash on phrase starts | 4/4 C maj 100 | melody answer (4→8 bars) + crash `perc` | phrase-8bar (all) | `starts-alike` motif-reuse 2-bar units ≥0.25 either | FITS-WITH-CHANGE |
| U09.L02 Verse & Chorus | contrasting sections; one `arrange()` per track | 4/4 C maj 100 | `arrange()` of chords + bass V C V C; chorus tune | axis-4bar (drums) | `verse-chorus` matches harmony rn ≥0.85 vs VCVC reference [reads chords from code] | FITS-WITH-CHANGE |
| U09.L03 AABA & Strophic | AABA / strophic forms | 4/4 C maj 112 | bridge chords + bridge tune; `arrange()` A A B A | axis-4bar (drums) | `aaba` form pattern "AABA" | FITS-WITH-CHANGE |
| U09.L04 The Energy Curve | energy per section; a build drawn with a signal | 4/4 C maj 112 | build section + chorus energy (hats, gain, a new line) | axis-4bar (drums) | `chorus-lands` contrast chorus vs verse, axis energy | FITS-WITH-CHANGE |
| U09.L05 Arranging in Code | parts enter/exit by bar with `.mask()` | 4/4 C maj 104 | an intro section with masked entries | axis-4bar (drums) | `mask-twice` custom `parts-enter` {min 2, alsoUses tb.mask} | FITS |
| U09.CP Make "Verse and chorus" | chorus lifts | 4/4 C maj 100 | drumsChorus / bassChorus | sections (chords; content/checkpoints.ts:85) | `lift` contrast | FITS |

- **U09.L01** — U09/L01/lesson.ts:390 (req :409), mdx:49. Starter: the 4-bar question
  `mel: n("<[4 ~ 2 4] [5 ~ 3 5] [4 ~ 2 ~] [1 ~ ~ ~]>")`; learner adds a 4-bar answer and `s("<cr ~ ~ ~>")`-style crash.
  bars [8,16]. Suggestions: crash on bars 1 and 5 (`onsets perc`), ends on 1. Fit: rule is harmony-free; the song's
  verse would be I vi IV V (band.sections) rather than the phrase-8bar — change of harmony, plus a partial-drums
  (crash) takeover.
- **U09.L02** — U09/L02/lesson.ts:379 (req :398), mdx:41. Starter: section consts `chordsVerse = chord("<C Am F G>")`,
  `chordsChorus = chord("<F G C C>")`, `bassVerse = n("<0 5 3 4>")`, `bassChorus = n("<3 4 0 0>")`,
  `melVerse = melChorus` (same tune); tracks play the verse consts only (no `arrange()` yet). bars [16,32].
  Suggestions: `arrange()` ×3, four tracks. This is **band.sections' harmony exactly** (verse I vi IV V, chorus IV V I I).
  Fit: the song already has a verse and chorus played by Oak, so a rule that reads "the chords play V C V C" is met
  by Oak unless only learner code counts and Oak's chorus is withheld. Change the takeover to "you arrange Oak's
  chords and bass" (Oak's parts arrive unarranged) or change the required rule to the learner's chorus lifting
  (contrast on the learner's tune).
- **U09.L03** — U09/L03/lesson.ts:395 (req :414), mdx:51. Starter: `chordsA = chord("<C Am F G>")`, `melA`,
  `chordsB = chord("<F F G G>")`, `melB` plain; tracks play A only. Suggestions: HC at bar 12 (`cadence`), `arrange()`
  ×2. Fit: a verse–chorus song is not AABA. The Make fits as "write the song's bridge" (B: start away from home, end
  on V); the required rule must move from `form "AABA"` to a bridge rule (the existing HC suggestion, scoped with
  `section`). AABA/strophic stay as lesson-body knowledge.
- **U09.L04** — U09/L04/lesson.ts:517 (req :536), mdx:49. Starter: verse/chorus consts for chords, bass, hats
  (`hatsChorus` = `hatsVerse`), `arrange([4, …Verse], [4, …Chorus])` on chords/bass/hats. bars [12,32]. Suggestions:
  `uses tb.signal`, form "verse build chorus". Fit: the build section and the chorus energy are natural song moves,
  but band.sections' own chorus already lifts on three counts (snare, doubled hats, driving bass); the `contrast`
  rule must measure learner tracks only (contracts.md §5.10 rule 5: "Evidence is taken from the learner's tracks
  only") and the learner must own the chorus parts that lift.
- **U09.L05** — U09/L05/lesson.ts:480 (req :500), mdx:49. Starter: verse/chorus consts for chords, bass, mel (melChorus
  already higher), `arrange()` V C on each. bars [12,32]. Suggestions: 4 tracks, ≥16 bars. Header: the rule is
  content-independent "so a learner who brings their own U09.L02 song passes the same way". Fit: **FITS** (the song's
  intro), provided the parts being masked are the learner's (or Oak's parts honour the learner's masks).
- **U09.CP** — content/core/U09/CP/checkpoint.ts:371. Starter: `drumsVerse = drumsChorus = s("bd ~ sd ~, hh*8")`,
  bassVerse/bassChorus, arranged V C V C; Band `band.sections` chords only. Required `lift` contrast; suggestions
  groove-lock, form VCVC.

### U10 Minor (9 lessons; 4/4; C minor → A minor; 76–100 BPM; U10.CP; C4 after)

| Lesson | One idea | Meter, key, BPM | Learner writes | Band (tracks) | Required rule | Fit |
|---|---|---|---|---|---|---|
| U10.L01 The Dark Twin | natural minor: ♭3 ♭6 ♭7, one word in `.scale()` | 4/4 **C min** 84 | melody (chords, bass given) | axis-4bar (drums) | `me-and-le` degree-set contains ♭3 ♭6 on @melody | FITS-WITH-CHANGE |
| U10.L02 Relative & Parallel | two minor twins of a major key | 4/4 C maj 88; exercise key **A minor** | move chords, bass, tune to A minor | axis-4bar (drums) | `home-on-a` ends-on-degree 1 (in A minor) on @melody | FITS-WITH-CHANGE (weak) |
| U10.L03 Hearing Minor | me, le, te by ear | 4/4 A min 92 | melody (chords i iv VI v, bass given) | axis-4bar (drums) | `me-le-te` degree-set contains ♭3 ♭6 ♭7 | FITS-WITH-CHANGE |
| U10.L04 Minor-Key Chords | III VI VII are minor's major chords (the lift) | 4/4 A min 90 | chords (i iv v i → ≥2 of III VI VII) + bass | axis-4bar (drums) | `two-major-chords` contains-rn III/VI/VII ≥2 in bars 1–4 | FITS |
| U10.L05 The Aeolian Loop | i–VI–III–VII | 4/4 A min 96 | chords (Am Dm → Am F C G) + bass roots + tune | axis-4bar (drums) | `the-aeolian-loop` progression schema.aeolian, no rotation | FITS |
| U10.L06 Raise the Seventh | harmonic minor's major V lands | 4/4 A min 84 | chords (add E → Am) + tune | axis-4bar (drums) | `v-goes-home` contains-rn V mustResolve | FITS |
| U10.L07 The Andalusian Cadence | i–VII–VI–V over a falling bass | 4/4 A min 100 | chords over a given bass A G F E | axis-4bar (drums) | `the-descent` progression schema.andalusian | FITS |
| U10.L08 Melodic Minor | raised 6 and 7 on the climb home | 4/4 A min 88 | melody end (chords Am Dm E Am given) | axis-4bar (drums) | `raised-6-and-7` degree-set contains 6, 7 | FITS |
| U10.L09 Minor Melodies | Go Down Moses: transcribe, sing, arrange | 4/4 A harm. min 76, pickup | the spiritual's line + arrangement | axis-4bar (drums) | `the-spiritual` matches melody key-relative ≥0.9 | SIDE |
| U10.CP Make "A minor loop" | Aeolian loop + a turn with V | 4/4 A min 84 | chords (+bass, tune) | aeolian-4bar (drums; content/checkpoints.ts:87) | `aeolian` progression bars 1–4 | FITS |

- **U10.L01** — U10/L01/lesson.ts:350 (req :369), mdx:49. Starter: `chords: n("[0,2,4]").add(n("<0 4 5 3>")).scale("C3:minor").s("rhodes")`
  (i v VI iv: Cm Gm A♭ Fm), `bass: n("<0 4 5 3>").scale("C2:minor")`, `mel: n("0 ~ 0 ~").scale("C4:minor")`.
  Suggestions: ends on 1, range ≤12. Fit: key C minor → the song's A minor (the "one word" demo can flip a tune
  written over `A3:major` to `A3:minor`; the rule is judged in the lesson key).
- **U10.L02** — U10/L02/lesson.ts:436 (req :456), mdx:51. Lesson key C major, exercise key A minor. Starter: the C-major
  axis loop (chords, bass, `mel` ending on C). Suggestions: ♭3 in A minor, chord tones. The Make's whole point is
  moving key (C major → A minor; the tip invites a key plan `<C4:major!4 A3:minor!4>`). Fit (weak): a song in one key
  can host it only as a section in the relative major (C) whose line turns home to A; or treat as SIDE.
- **U10.L03** — U10/L03/lesson.ts:312 (req :331), mdx:43. Starter: `chords: n("[0,2,4]").add(n("<0 3 5 4>")).scale("A2:minor")`
  (i iv VI v), `bass: n("[0 ~ 0 7]").add(…).scale("A1:minor").s("fingerbass")`, `mel` on 1 and 5 only. Fit: a verse or
  counter-melody in the song; risk: if the learner's L01 tune already has ♭3 ♭6 ♭7, the rule is already met — use a
  fresh line or require te specifically. Note: te (G) must not sit over V (E major, G♯) in the chorus.
- **U10.L04** — U10/L04/lesson.ts:343 (req :362), mdx:47. Starter: `chords: n("[0,2,4]").add(n("<0 3 4 0>")).scale("A2:minor")`
  (i iv v i, no bass). Suggestions: bass on roots, tune on chord tones. Fit: a chords takeover; the learner's answer
  is often the Aeolian loop itself, which would pre-empt L05 if both take the same section — put L04 on a lift
  section (pre-chorus) and L05 on the verse.
- **U10.L05** — U10/L05/lesson.ts:374 (req :393), mdx:49. Starter: `chords: chord("<Am Dm Am Dm>").voicing().s("rhodes")`,
  `bass: n("[0 0 0 0 0 0 0 7]").add(n("<0 3 0 3>")).scale("A1:minor")`, `mel` 2 bars. Suggestions: ends on A, bass
  roots, 3 parts. Fit: **FITS** as the song's verse chords (the C4 verse rule is the same schema).
- **U10.L06** — U10/L06/lesson.ts:400 (req :422), mdx:49, **fromSketch "U10.L05"** (:417). Starter:
  `const changes = "<Am F C G>"`, chords/bass from it, `mel`. Fit: **FITS** as the chorus cadence (V–i); in the song
  model fromSketch becomes unnecessary (the learner's verse persists).
- **U10.L07** — U10/L07/lesson.ts:331 (req :350), mdx:49. Starter: `chords: chord("<Am Am Am Am>").s("acgtr")` over a
  given `bass: note("<a1 g1 f1 e1>")`. Fit: **FITS** as an intro or the chorus's first half (Oak keeps the falling
  bass, the learner builds the chords — exactly the starter's split). 100 BPM → song tempo.
- **U10.L08** — U10/L08/lesson.ts:402 (req :421), mdx:49. Starter: `chord("<Am Dm E Am>")` chords + bass given,
  `mel: n("<[0 2 4 ~] [3 ~ 2 1] [4 ~ ~ ~] [7 ~ ~ ~]>").scale("A3:minor")` (leaps home). Fit: **FITS** as the chorus
  tune's last bars over V → i.
- **U10.L09** — U10/L09/lesson.ts:372 (req :396), mdx:35. Exercise key A harmonic minor, pickup `[1,1]`, 76 BPM.
  Starter: `pad` strings (`<~ 0 5 4 0>`: i VI V i), `bass` upright, `mel` on home in the spiritual's rhythm. Required
  rule matches the spiritual's whole line (repertoire song.go-down-moses). Fit: **SIDE** (a repertoire setting). A
  FITS-WITH-CHANGE is possible (key, harmony and feel match an A-minor ballad, so it could be a quoted outro), but
  that is a content decision.
- **U10.CP** — content/core/U10/CP/checkpoint.ts:253. Starter `chords: chord("<Am Am Dm Dm Am Am Dm Am>")`, bass;
  Band `band.aeolian-4bar` drums. Required Aeolian loop bars 1–4; suggestions major V → i, me and le.

### U11 Pentatonic & Blues (8 lessons; 4/4; C major → A min pent → C blues → G blues; 90–112 BPM; U11.CP; C5, X2 after)

| Lesson | One idea | Meter, key, BPM | Learner writes | Band (tracks) | Required rule | Fit |
|---|---|---|---|---|---|---|
| U11.L01 Five Notes, No Wrong Ones | major pentatonic: nothing clashes over the loop | 4/4 C maj 96 | melody (scale change; bass given) | axis-4bar (drums chords) | `pentatonic-tune` in-key C major pentatonic, all notes, track `mel` | FITS-WITH-CHANGE (weak) |
| U11.L02 The Minor Pentatonic Riff | minor pentatonic; a riff | 4/4 **A minor pent** 100 (exercise key A minor) | riff `gtr` (only line) | axis-4bar (drums) | `pentatonic-riff` in-key A minor pentatonic on `gtr` | FITS-WITH-CHANGE |
| U11.L03 Blue Notes | ♭3 ♭5 ♭7 over major; the blues scale | 4/4 C blues 92 (exercise key C major pent) | riff `gtr` (chords C–F, bass given) | axis-4bar (drums) | `a-blue-note` degree-set anyOf ♭3 ♭5 ♭7 ≥1 on `gtr` | FITS |
| U11.L04 The Dominant Seventh | C7: restless, wants to move | 4/4 C blues 90 | chords (C F → C7 F7) + riff | axis-4bar (drums) | `two-dominant-sevenths` chord-qualities anyOf 7, min 2, depth seventh | FITS |
| U11.L05 Twelve Bars | the 12-bar form in one `const` | 4/4 C blues 100 | chords (`<C7!12>` → 12-bar) + riff | axis-4bar (drums) | `twelve-bar-changes` matches harmony rn ≥0.9 vs standard 12-bar | FITS-WITH-CHANGE |
| U11.L06 Quick Change & Turnaround | IV in bar 2; bars 11–12 turn round | 4/4 **G blues** 104 | chords (`changes`) | axis-4bar (drums) | `quick-change-blues` blues-form variant quick-change | FITS-WITH-CHANGE |
| U11.L07 Shuffle | swung eighths, `.swingBy(1/3, 4)` | 4/4 C blues 112 | hats swing (+ riff swing, tempo) | **none** (`band: false`) | `hats-swing` swing on [hats, @drums] ratio 1.45–2.4 | FITS |
| U11.L08 Riffs & Response | a two-bar riff and its answer, three times | 4/4 C blues 108, swing 1/3 | `mel` riff + `vox` answers | **none** (`band: false`) | `call-comes-back` motif-reuse 2-bar units ≥0.3 on @melody | FITS |
| U11.CP Make "Twelve bars" | riff that returns over a blues | 4/4 C blues 104 | 12 bars: riff mel + vox, chords, bass, hats | blues-12bar (drums; content/checkpoints.ts:89) | `riff` motif-reuse | FITS |

- **U11.L01** — U11/L01/lesson.ts:470 (req :489), mdx:47. Starter: `bass: chord("<C G Am F>").rootNotes(2)` (given) +
  `mel: n("<[4 [3 2] 1 ~] [1 2 1 ~] [4 5 [6 5] 4] [2 1 0 ~]>").scale("C4:major")` (F and B rub). Band plays drums and
  the I V vi IV chords. Note: in the default order U11.L01 comes before U10.CP and C4. Fit (weak): the lesson's
  promise ("no wrong notes over this loop") is about I V vi IV; over a blues F7 (E♭) the pentatonic's E rubs. It fits
  only an intro vamp on I in the U11 song; otherwise treat as SIDE.
- **U11.L02** — U11/L02/lesson.ts:457 (req :478), mdx:49. Starter: `gtr: n("<[0 ~ 1 2 3 ~ 5 4] [3 2 1 ~ 0 ~ ~ ~]>").scale("A2:minor").s("acgtr")`.
  Suggestions: a bass beside it, motif reuse. Fit: the riff idea fits the blues song, but in C: `C3:minor:pentatonic`
  (the `in-key` key changes; the "A minor pent = C major pent from A" link leaves the Make).
- **U11.L03** — U11/L03/lesson.ts:430 (req :451), mdx:47. Starter: `chords: chord("<C F>").voicing().s("organ")`,
  `bass: chord("<C F>").rootNotes(2)`, `gtr: n("<[0 1 2 3] [4 ~ 3 2]>").scale("C3:major:pentatonic")`. Suggestions:
  `crunch` sound, both ♭3 and 3. Fit: **FITS** (I–IV is the blues' first line; Oak's chords still triads).
- **U11.L04** — U11/L04/lesson.ts:392 (req :411), mdx:47. Starter: `const changes = "<C F>"`, chords + bass from it,
  `gtr …scale("C3:blues").s("crunch")`. Fit: **FITS** as the learner taking over Oak's chords (triads → sevenths).
  Watch: if this takeover hands over a 12-bar chord line, L05's required rule is already met.
- **U11.L05** — U11/L05/lesson.ts:329 (req :348), mdx:49. Starter: `const changes = "<C7!12>"` (twelve bars of I),
  chords + bass from it, riff. bars [12,24]. Suggestions: a melody track, ♭3 in `gtr`. Fit: the song can only "become"
  a blues here if Oak's song before L05 is not yet a 12-bar (a vamp song, or a one-chord boogie), i.e. the song's
  form grows at L05; required `matches` against the standard form must be section-scoped.
- **U11.L06** — U11/L06/lesson.ts:389 (req :409), mdx:49. Exercise key G blues. Starter:
  `const changes = "<G7!4 C7!2 G7!2 D7 C7 G7 D7>"`, riff in `G2:blues`. Suggestions: V in bar 12, ♭3 (B♭ in G). Fit:
  key G → C (the Make moved key on purpose to practise numerals); `blues-form` itself is key-agnostic.
- **U11.L07** — U11/L07/lesson.ts:460 (req :482), mdx:51, **fromSketch "U11.L06"** (:477), `band: false` (header
  :21-24: band.axis-4bar's straight hats would flam against swung ones; "A 12-bar Band whose drums leave the hats to
  the learner is requested", which now exists: `band.blues-12bar`, content/bands/index.ts:502-550, drums are kick
  and snare only). Starter: quick-change + turnaround changes in C, `hats: s("hh*8")`, `drums: s("bd ~ sd ~")`, bass,
  chords, `gtr` riff. Suggestions: riff swings, tempo 80–140. Fit: **FITS** — the learner takes over Oak's hats.
  The tempo choice becomes a song-wide decision (Oak's parts follow the session tempo).
- **U11.L08** — U11/L08/lesson.ts:415 (req :437), mdx:49, `band: false`. Lesson `swing: { subdivision: 8, amount: 1/3 }`.
  Starter: standard changes, swung hats, drums, bass, chords, `mel:` a new figure in every line, `vox:` organ answers.
  Suggestions: two melody tracks, ♭3 in `mel`. Fit: **FITS** (second chorus: riff and response).
- **U11.CP** — content/core/U11/CP/checkpoint.ts:356. 104 BPM, Band `band.blues-12bar` drums. Required riff
  motif-reuse; suggestions blues form, sevenths, swing.

### U12 Seventh Chords (6 lessons; 4/4; C major and A minor; 76–112 BPM; no CP of its own — U13.CP covers U12+U13; no capstone)

| Lesson | One idea | Meter, key, BPM | Learner writes | Band (tracks) | Required rule | Fit |
|---|---|---|---|---|---|---|
| U12.L01 Major 7 & Minor 7 | maj7 and m7 by name | 4/4 C maj 84 | chords F Em Dm C → sevenths | axis-4bar (drums) | `major-and-minor-sevenths` chord-qualities contains maj7, m7 (seventh depth) on `chords` | FITS |
| U12.L02 Dominant vs Major 7 | one half step: rest or lean | 4/4 C maj 88 | chords C C F G → maj7 + 7 (+ tune) | axis-4bar (drums) | `rest-and-lean` chord-qualities contains maj7, 7 | FITS |
| U12.L03 Half-Diminished & Diminished 7 | m7♭5 and °7 lead somewhere | 4/4 **A min** 76 (exercise key A harm. min) | chords: one dark seventh (+ tune) | axis-4bar (drums) | `one-dark-seventh` chord-qualities anyOf m7b5, dim7 ≥1 | FITS-WITH-CHANGE |
| U12.L04 Diatonic Sevenths in Major | Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7 | 4/4 C maj 92 | chords: a staircase loop | axis-4bar (drums) | `three-kinds` chord-qualities contains maj7, m7, 7 | FITS-WITH-CHANGE |
| U12.L05 Sevenths in Minor & Guide Tones | 3rds and 7ths are the thread | 4/4 **A min** 96 | melody on guide tones (8-bar cycle given) | axis-4bar (drums) | `starts-on-guide-tones` guide-tones `mel` vs `chords`, at bar, ratio 1, fixed changes [reads chords from code] | FITS-WITH-CHANGE |
| U12.L06 Seventh Ear Lab & Left-Hand Voicings | `.dict("lefthand")` | 4/4 C maj 112 | chord voicing + comp rhythm | axis-4bar (drums) | `voiced-for-the-left-hand` custom `voiced-with` {track chords, dict lefthand} | FITS |

- **U12.L01** — U12/L01/lesson.ts:395 (req :415), mdx:47. Starter: `const changes = "<F Em Dm C>"`, chords Rhodes,
  bass upright, `mel: n("<[5 ~ 7 5] [4 ~ 6 4] [3 ~ 5 3] [2 ~ ~ ~]>")`. Deliberately not `fromSketch: U06.L10`
  (content/specs/U12.md:110). Note: in the default order U12.L01 comes before U11.CP, C5 and X2.
- **U12.L02** — U12/L02/lesson.ts:437 (req :460), mdx:49. Starter: `const changes = "<C C F G>"`, chords, bass,
  `mel: note("<[e4 g4 b4@2] [e4 g4 a4@2] [c4 e4 a4@2] [d4 g4 b4@2]>")`. Suggestions: C7 → F, bass on roots.
- **U12.L03** — U12/L03/lesson.ts:441 (req :462), mdx:47. Starter: `const changes = "<Am7 F^7 Dm7 E7>"`
  (`.struct("x x x x")` piano), upright bass, `mel …scale("A3:harmonic:minor").s("strings")`. 76 BPM "torch song".
  Fit: an A-minor section (bridge) inside a C-major song: needs a section key (the rule set judges degrees and
  numerals in the exercise key) and `section` scoping; tempo 76 → song.
- **U12.L04** — U12/L04/lesson.ts:364 (req :384), mdx:47. Starter: `const changes = "<C^7 C^7 C^7 C^7>"`, chords,
  bass, mel. Suggestions: all in C, V7 → I, tune on chord tones. Fit: if L01 and L02 already put maj7, m7 and 7 into
  the learner's chords track (in other sections), `contains maj7 m7 7` on the whole track is already met — needs
  `section` scoping to the section L04 hands over (intro/outro staircase).
- **U12.L05** — U12/L05/lesson.ts:371 (req :390), mdx:47. Starter: `const changes = "<Dm7 G7 C^7 F^7 Bm7b5 E7 Am7 Am7>"`,
  chords, bass, `mel: note("a4")`. bars [8,8]. The rule lists the eight `changes` explicitly and reads `harmony:
  "chords"`. Fit: the song's bridge melody (the cycle starts in C and lands on Am); same harmony-in-code issue;
  section key A minor.
- **U12.L06** — U12/L06/lesson.ts:482 (req :506), mdx:47. Starter: `const changes = "<C^7 Am7 Dm7 G7>"`, chords
  `.voicing()`, bass `.struct("x x x x")`, `mel …scale("C5:major")`. Suggestions: bass on roots, `jazzgtr`, guide tones
  on `mel`. Fit: **FITS** (verse comping); tempo 112 → song.

### fromSketch in range

Only U10.L06 (← U10.L05, "your Aeolian loop") and U11.L07 (← U11.L06, "your blues"). Both become unnecessary in
the song model (the learner's part is already in the song), and both are cases where the song model is strictly
better than today's.

---

## 2. Per-unit songs: natural shape, takeover sequence, release

Shared principle forced by AUTHORING.md:232 (a starter never already meets the required rule): **the part a lesson
hands over must, at hand-over time, lack that lesson's idea.** Either Oak's whole song is written "plain" from the
start (arpeggio tune, root bass, triads, straight hats …) and each lesson replaces one plain part, or Oak strips a
part back to the lesson's starter at hand-over. Re-using a part the learner already owns is the main trap: several
pairs below would pass instantly (flagged "collision").

### U07 song (melody) — released by C2

- **Natural shape:** 4/4, C major, ~92 BPM (lessons 76–104; CP 88; C2 70–140, reference 96). Harmony from the three
  Bands U07 already uses: intro on the two-chord vamp I–IV (L04), verse = band.phrase-8bar I IV I V | I IV V I (L01,
  L06), chorus = C2's "loop then land" I V vi IV | I V V I (axis-4bar; C2_TEMPLATE content/capstones.ts:283-290),
  outro I IV V I (L05). Form: Intro 4 | Verse 8 | Chorus 8 | Verse | Chorus | Outro 4.
- **Oak at start:** drums, bass, chords everywhere (Bands), plus plain lead lines in every slot (arpeggios / chord
  tones only), because a melody unit hands over melody slots.
- **Takeover sequence (proposal):**
  1. L01 → verse melody (8 bars; Oak's arpeggio line).
  2. L02 → chorus melody bars 1–4 (motif).
  3. L03 → chorus melody bars 5–8 (Oak's off-chord line), landing on chord tones.
  4. L04 → intro lead over I–IV (Oak's leaping chord-tone skeleton), decorated. (Not the learner's verse: collision
     with L01, whose stepwise tune already has passing tones.)
  5. L05 → outro (I IV V I) lead: lean into V / onto the last I. Tempo 76 → 92.
  6. L06 → verse bars 5–8 become the answer (revise own verse; required rule should be "starts like the question",
     since ends-on-1 may already hold — collision with L01's `home` suggestion).
  7. L07 → new `vox:` answer line in a section where Oak's lead leaves gaps (intro/post-chorus).
  8. L08 → pickup into the verse, in the intro's last bar (section-boundary pickup).
  9. L09 → SIDE (3/4 Amazing Grace). Optional: its Make becomes "write the chords line of one section so the lead
     sheet names them" (first chords takeover).
  10. L10 → a hook: needs a fresh slot (an instrumental hook line in intro/post-chorus) — collision with L02 if the
      hook is the learner's chorus (motif-reuse 0.5 already ⊇ 0.25).
- **U07.CP:** hook over I V vi IV — fits the chorus; may stay a stand-alone check.
- **Release: C2** (content/capstones.ts:1893-2108). FITS-WITH-CHANGE: its rubric is written for an 8-bar piece —
  `bars` min=max=8, `progression schema.axis bars [1,6]`, `cadence at last`, `tracks` roles chords+melody (learner
  owns chords). In the song: C2.S1 "Chords" = the learner takes over Oak's chorus chords ("loop, then land"), C2.S2
  "Melody" = polish and release; every rule needs `section: { section: "chorus" }`; `bars` must go.
- **X1** (content/capstones.ts:2109-2127): transcription of Aura Lee / Red River Valley — SIDE (its own album track).
- **Interleave:** U08.L01 is played before U07.CP and C2 (content/syllabus.ts:664).

### U08 song (bass) — no capstone, no CP

- **Natural shape:** the U07 song itself. Every U08 progression is a U07 one: I V vi IV (L01, L02, L04), I IV I V (L03
  — exactly the U07 verse's first four bars, and chosen because its roots never move by a step or a 3rd), vi IV I V
  (L05). The course already says so: U08.L01 lesson.mdx:56 "after it your four-chord song can have a floor like this one";
  C3's brief "paste your C2 in as the verse" (content/capstones.ts:2136).
- **Takeover sequence (proposal, Oak's bass handed over section by section):**
  1. L01 → chorus bass, roots on the one (Oak strips the bass to a C pedal, the lesson starter).
  2. L02 → verse bass, root–5th–octave cell.
  3. L03 → approach tones into the verse changes (I IV I V); `min: 5` re-derived for an 8-bar verse.
  4. L04 → the kick (Oak's drums split: kick handed over, snare/hats stay Oak's) + the bass rhythm via `const`.
  5. L05 → a new section on vi IV I V (bridge, or the chorus rotated as C2's indie reference does) + bass tone.
- **Release:** none exists. Options: re-release the U07 song as version 2 ("with your bass"), or treat U07–U09 as one
  growing song (v1 = C2, v2 = U08 bass, v3 = C3). U09.CP covers U08+U09.
- All five required rules read Oak's chords from the learner's code (L01/L05 via a fixed `matches` reference; L02/L03
  via `bass-line harmony: "chords"`); L04's needs a learner-owned kick. `const` unlocks only at L04, so before it the
  learner's bass must be placed into sections by the app.

### U09 song (form) — released by C3

- **Natural shape:** 4/4, C major, 100 BPM (lessons 100–112, CP 100, C3 70–140, reference 100). Harmony =
  `band.sections`: verse I vi IV V (C Am F G), chorus IV V I I (F G C C) — the harmony of L02, L04, L05, U09.CP and C3.
  Form grows across the unit: Verse 8 | Chorus 8 | Verse | Chorus → + Bridge (L03) → + Build (L04) → + Intro (L05).
- **Takeover sequence (proposal):**
  1. L01 → verse melody as an 8-bar question + answer, and the crash on phrase starts (perc voice of Oak's drums).
     Verse harmony becomes I vi IV V instead of phrase-8bar (rule is harmony-free).
  2. L02 → the arrangement: Oak's chords and bass arrive as section consts the learner arranges V C V C (today's
     starter), plus the chorus tune. Or keep Oak's arrangement and make the required rule the learner's chorus tune
     lifting (contrast on pitch/register).
  3. L03 → the bridge: chords + tune, start away from home, end on V; required rule moves from `form "AABA"` to the
     HC-at-bridge-end rule scoped with `section`.
  4. L04 → the build (signal riser) + the chorus's drums/hats energy; `contrast energy` on learner tracks only, and
     Oak's chorus must not already lift (band.sections' chorus lifts on three counts).
  5. L05 → the intro with masked entries.
- **U09.CP:** fits as is (band.sections chords, learner drums/bass VCVC).
- **Release: C3** (content/capstones.ts:2128-2379, 4 sessions). FITS-WITH-CHANGE: `form` must be exactly "verse
  chorus verse chorus", so an intro (L05) or a bridge (L03) fails it — content/specs/U09.md:561: "Allowing an
  optional intro and outro would need a contracts change (reported)". Other rules (contrast ≥2 axes, ≥90 s,
  groove-lock ≥0.5, lead sheet exact) fit a song.
- **Interleave:** U10.L01 is played before U09.CP and C3.

### U10 song (minor) — released by C4

- **Natural shape:** 4/4, **A minor**, ~84 BPM (C4 requires 60–95; lessons 76–100; CP 84). Verse = Aeolian loop
  i VI III VII (Am F C G) ×2; chorus with the major V going home, C4's reference iv VII V i (Dm G E Am) or the
  Andalusian i VII VI V | … E Am; intro on the Andalusian descent (L07); outro landing on 1 over i (C4's `ends-on-1`
  `over: "i"`). Oak backing: `band.aeolian-4bar` exists for the verse (content/bands/index.ts:418-470, def 1120); no
  existing Band has a minor chorus with V, so a sectioned minor Band (like band.sections) is new work.
- **Takeover sequence (proposal):**
  1. L01 → verse tune with me and le (key C minor → A minor).
  2. L02 → weak: a section in the relative major (C) whose line turns home to A; or SIDE.
  3. L03 → a tune that sings me, le, te (verse counter-line or intro) — collision risk with L01's tune.
  4. L04 → pre-chorus chords: lift with III, VI, VII (Oak's plain i iv v i).
  5. L05 → verse chords = the Aeolian loop + bass roots (L04 must not have taken the verse, or L05 passes at once).
  6. L06 → chorus cadence: major V → i (fromSketch dropped).
  7. L07 → intro (or chorus first half): chords over Oak's falling bass A G F E.
  8. L08 → chorus tune's climb home through F♯ G♯ over E.
  9. L09 → SIDE (Go Down Moses); optional quoted outro.
- **U10.CP:** fits (Aeolian loop + turn with V over band.aeolian-4bar drums).
- **Release: C4** (content/capstones.ts:2380-2598). **FITS** with the fewest changes of any capstone: it is already
  sectioned (C4_TEMPLATE :498-517), its verse rule is `section: { section: "verse" }`, it has no `form`/`bars` rule,
  so an intro/outro is allowed; the song tempo must sit in 60–95.
- **Interleave:** U11.L01 (major pentatonic over the four-chord loop) is played before U10.CP and C4.

### U11 song (blues) — released by C5 (X2 is a side transcription)

- **Natural shape:** 4/4, C blues, ~104–108 BPM (lessons 90–112, CP 104, C5 80–140, reference 112). Form: intro 4
  (vamp on I) | 12-bar chorus | 12-bar chorus (riff and response) | ending. `band.blues-12bar` / `-qc` exist
  (content/bands/index.ts:502-550, defs 1129/1137): drums are kick and snare only, so the learner can own the hats.
- **The song has to grow into a blues:** if Oak plays a full 12-bar blues in dominant sevenths from day one, L04
  (sevenths) and L05 (12-bar form) are pre-empted. Proposal: Oak's song starts as an I–IV groove (triads) with an
  intro; the learner turns it into a blues.
  1. L01 → intro tune on C major pentatonic over a vamp on I (the "no wrong notes" claim only holds there); else SIDE.
  2. L02 → the riff, on C minor pentatonic (key A → C).
  3. L03 → a blue note in the riff over Oak's I–IV.
  4. L04 → Oak's chords handed over: triads → dominant sevenths (keep the I–IV vamp).
  5. L05 → the learner writes the 12-bar changes (Oak's section played `<C7!12>` or the vamp); the song becomes a blues.
  6. L06 → quick change + turnaround (key G → C).
  7. L07 → Oak's hats handed over: swing (fromSketch and `band: false` both become unnecessary); tempo choice is
     song-wide.
  8. L08 → second chorus: riff on `mel`, answers on `vox`.
- **Feel conflict:** jazz-soul Bands swing from U03 on (all flavours of band.blues-12bar swing the bass or comp), while
  L05/L06 are "straight" blues and L07 is where swing is introduced.
- **U11.CP:** fits (band.blues-12bar drums).
- **Release: C5** (content/capstones.ts:2599-2813). FITS-WITH-CHANGE: `turnaround` reads `section: { bars: [12, 12] }`
  (absolute bar 12) and `blues-form` counts choruses from the top, so an intro shifts the numbering; scope them to
  the chorus sections. Two choruses, sevenths, swing, blue notes and riff fit.
- **X2** (content/capstones.ts:2814-2833): blues by ear — SIDE.
- **Interleave:** U12.L01 is played before U11.CP, C5 and X2.

### U12 song (seventh chords) — no CP, no capstone

- **Natural shape:** 4/4, C major with an A-minor bridge, ~92 BPM (lessons 76–112). Sections taken from the
  lessons' own loops: verse I vi ii V (C^7 Am7 Dm7 G7, L06) or C C F G (L02); chorus F Em Dm C (L01's descent); bridge
  = L05's cycle Dm7 G7 C^7 F^7 Bm7b5 E7 Am7 Am7 (lands on A minor), with L03's dark turn; intro/outro staircase (L04).
  Many U12 Makes are chords takeovers of different sections, which suits section consts (`chordsVerse`,
  `chordsChorus`, `chordsBridge`) — U12 learners have `const`/`arrange()`.
- **Takeover sequence (proposal):** L01 chorus chords → sevenths; L02 verse chords (maj7 + 7); L03 bridge dark seventh
  (A minor section); L04 intro/outro staircase (must be `section`-scoped, or the union of L01+L02 already contains
  maj7, m7, 7); L05 bridge melody on guide tones (A minor; [reads chords from code]); L06 verse chords voiced
  `lefthand` + comp rhythm.
- **Release:** none in the syllabus (U13.CP covers U12+U13; next composed capstone is C6 after U14.CP). A release
  vehicle has to be invented, or the song is released at U12.L06.

---

## 3. What makes the song rework easy, and what makes it hard

**Easy (already in the code):**
1. Rubric `section` scoping on every rule (packages/content-kit/src/schema/rubric.ts:21-38) and AST section reading
   (packages/grader/src/lint/ast.ts:626).
2. Sectioned Oak backing that follows the learner's form: `band.sections` + packages/strudel/src/band-form.ts.
3. Per-flavour, per-stage Oak code (`BandDef.code` per flavour + `bandCodeAt`), and `BandRef.tracks` to drop the roles
   the learner owns ("The Band supplies the roles the learner is not writing", AUTHORING.md §8.4).
4. Unused Bands that match the would-be unit songs: `band.aeolian-4bar` (U10), `band.blues-12bar(-qc)` with hats left
   to the learner (U11), `band.two-five-one` (U12-ish). AUTHORING.md §8's table already recommends aeolian-4bar for
   "minor Makes (U10.L03 on)" and blues-12bar for "U11.L05 on", but the lessons still use `band.axis-4bar` drums
   (U11.L06's header still says "No 12-bar Band exists yet") — doc/content drift.
5. Most U09–U12 starters already are "Oak's parts in the learner's code" (chords, bass, tune given; "keep the chords
   as they are"); U09–U12 code already uses `const changes` / section consts.
6. C4 is song-ready (sectioned, section-scoped rules, no form/bars rule); C3/C5 templates are sectioned.
7. Sketch save keeps `{ bandId, flavour, mutes }` (app/src/lesson/server.ts:78) — a song save can extend this shape;
   `fromSketch` proves the "carry my part forward" UX.

**Hard:**
1. **Grader never sees Oak's parts** (LessonPlayer.tsx:417-425 passes only `{ code }`). Required rules that read
   chords from the learner's code: U07.L03, L04, L05; U08.L01, L02, L03, L05; U09.L02; U12.L05 (plus U07.L09's
   chords+melody `tracks`). Either Oak's parts go into the graded code (locked) or the app passes them as `band`
   (supported by the grader, types.ts:161-162) and the rules name `band.chords`.
2. **Section code arrives late:** `const` at U08.L04, `arrange()` at U09.L02, `.mask()` at U09.L05. In U07–U08 the
   learner's code cannot express "my line plays in the verse"; the app must place it.
3. **Starter-must-fail vs persistence** (AUTHORING.md:232): collisions where the learner's earlier part already meets
   the next required rule — U07.L04 vs L01, U07.L06 vs L01, U07.L10 vs L02, U07.L03 vs L02, U10.L03 vs L01, U10.L05 vs
   L04, U11.L05 vs L04, U12.L04 vs L01+L02. Needs fresh Oak-owned slots, section scoping, or strip-on-handover.
4. **Key/meter outliers:** U07.L09 (3/4, F major, Amazing Grace), U10.L01 (C minor), U10.L02 (key change is the
   point), U11.L01 (pentatonic over the four-chord loop), U11.L02 (A minor pentatonic), U11.L06 (G), U12.L03/L05
   (A minor inside a C-major unit), repertoire Makes U07.L09 and U10.L09.
5. **One tempo per song** vs per-lesson tempos: U07 76–104, U08 92–100, U09 100–112, U10 76–100 (C4 ≤95), U11 90–112
   (L07 asks the learner to pick 80–140), U12 76–112. The Band shares the session tempo.
6. **Interleaved default order:** next unit's L01 before this unit's CP + capstone (U08.L01, U10.L01, U11.L01,
   U12.L01) → two open songs.
7. **Capstone rubrics assume a stand-alone piece:** C2 exactly 8 bars; C3 form exactly V C V C (no intro/bridge);
   C5 bar 12 absolute. X1 and X2 are transcriptions (not unit songs).
8. **No release vehicle for U08 and U12.**
9. **Partial-drums takeovers** (U08.L04 kick, U09.L01 crash, U09.L04 hats/energy, U11.L07 hats): today's Bands have a
   single `drums:` track; Oak's drums must split per voice.
10. **Feel per flavour:** jazz-soul Bands swing from U03 (and blues Bands swing their bass in pop/indie/funk), against
    the straight U11.L05/L06 and the swing-introducing U11.L07; `band: false` in U11.L07/L08 exists because Oak's hats
    flammed with the learner's.
11. **Pickups at section boundaries:** "A Band never starts late" (U07 spec), so the pickup lessons (U07.L08, U07.L09,
    U10.L09) use drums only; in a song Oak's chords keep sounding under a pickup, and the `pickup` rule's bar-0
    numbering has to read a section start.
12. **Small Make budget:** every U07–U12 Make is 2.75 expert minutes (×1.4 scaled); a takeover must stay that small,
    and today's Make `bars` are 2–32.
