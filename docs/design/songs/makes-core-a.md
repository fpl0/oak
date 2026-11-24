# Make inventory, core U01–U06 (for the "each unit is one song" redesign)

Read-only survey of every lesson Make in `content/core/U01`–`U06`, each unit's checkpoint Make, the unit specs
(`content/specs/U0x.md`), the Band registry and the capstones. Every value below was read from the lesson
modules themselves: I imported each `lesson.ts` with bun and dumped its last step. The full dump has every
Make's prompt, starter, complete rubric, hint ladder and tests, as JSON:
`/private/tmp/claude-501/-Users-fpl0-Code-Oak/4fb6682d-c484-494a-8850-13e101b1acf3/scratchpad/understand/core-a-work/makes-u01-u06.json`.

Fit verdicts mean the following. **FITS**: the Make can happen as-is inside one 4/4 song shared by the unit,
with the learner taking over (replacing) a part, or part of a part, of Oak's arrangement. **FITS-WITH-CHANGE**:
it can, but something in the content, the Band or the grader has to change (the note says what). **SIDE**: it
cannot live in the unit song.

---

## 0. Headline numbers

- **53 lesson Makes** (U01 9, U02 8, U03 11, U04 4, U05 9, U06 12) plus 6 checkpoint Makes.
- **Meter:** 52 of 53 are 4/4. The only exception is **U01.L08 "Three to a Bar"** (3/4, `setcpm(108/3)`, `band.waltz-vamp`).
- **Key:** every Make is in C major except U03.L06 (G), U03.L07 (F), U03.L05 (two keys by design) and U06.L02
  (the exercise declares key G; the lesson key is C).
- **Harmony:** only three harmonic beds are used in U01–U06.
  - `band.two-chord-vamp`, I–IV, two bars: U01–U04 (U01 with bass and chords only).
  - `band.phrase-8bar`, I IV I V | I IV V I: U03.L11 and U03.CP.
  - `band.axis-4bar`, I V vi IV: U05–U06. Oak usually plays only its drums there, because the learner writes the harmony.
- **Tempo per lesson:** U01 88–100 in 4/4 (108 for the waltz), U02 80–96, U03 80–96, U04 84–96, U05 80–92,
  U06 76–100. No required rule depends on tempo (U01.L01 has an optional 70–140 check).
- **What the learner writes:**
  - U01: drums only.
  - U02, U03: the melody line (`mel:`).
  - U04: a second voice or dyads.
  - U05: chords, plus the bass in L06.
  - U06: chords, plus the bass in L05 and L11 and a comping rhythm in L12.
- **fromSketch:** used once in U01–U06, by U06.L10 (`fromSketch: "U05.L01"`).
- **Capstones:** only U01 (C0) and U02 (C1) have one, and they run after the next unit has started.
  **U03, U04, U05 and U06 have no capstone** and so nothing to release. C2 opens after U07.CP.

---

## 1. How a Make is wired today (the seams the song rework touches)

| Piece | Where | What matters for the song |
|---|---|---|
| `CodeMakeEx` | `packages/content-kit/src/schema/exercise.ts:696-711` | `code.starter`, `bars: [min,max]`, `rubric` (exactly one `required`, contracts §6.5, `docs/design/contracts.md:1534`), `saveAs: "sketch"`, `fromSketch?: LessonId` (:710). |
| `StepUi.band` | `packages/content-kit/src/schema/lesson.ts:66` | `band?: BandRef \| false`. Every Make from U01 declares one (§5.10 rule 6). |
| `BandRef` | `lesson.ts:144-149` | `{ band, followsLearnerKey?, tracks?: ("drums"\|"bass"\|"chords")[] }`. **`tracks` lists the parts Oak still plays.** It is today's only "takeover" switch, and it works per role. |
| Band registry | `content/bands/index.ts` | `bands` :1064. In scope here: `two-chord-vamp` :1065, `axis-4bar` :1074, `phrase-8bar` :1084, `waltz-vamp` :1111. `BAND_METERS` :1433, `BAND_STAGES` :1314 (jazz-soul gets sevenths and swing from `U03.L01`; funk gets four-note chords from `U06.L01`), `bandCodeAt` :1408. |
| Band code shape | `content/bands/index.ts:150-159` (`layers()`) | Exactly three labelled tracks: `drums:` (the whole kit **and** hats in one `s("bd sd [~ bd] sd, hh*8")`), `bass:`, `chords:`. **There is no melody or lead track in any Band.** `FlavourKit.lead` (content/flavours.ts) only swaps starter sounds. |
| Band evaluation | `packages/strudel/src/band.ts:201` `bandCodeFor` | Fills `{{key}}`. With `followsLearnerKey` it takes the learner's first `.scale()`, a patterned key plan included, so it changes key with a tune (U03.L05). Through `followLearnerForm` (`band-form.ts:176`) a sectioned Band follows the learner's own `arrange()`, which is the reverse of what a song needs. `BandSetup`: `packages/strudel/src/types.ts:79`. |
| Band rules | `docs/design/contracts.md:1460-1500` | Rule 1: Band code is never learner code; it is collected as `band.<label>`. Rule 3 (:1492): "A learner's own track with the same role replaces nothing: both play unless the learner mutes the Band track". Rule 5: a sketch stores `{bandId, flavour, mutes}`. §6.2.5: a rule can name a Band track (`harmony: 'band.chords'`). §6.3: form means one `arrange()` per track. |
| Checkpoint Bands | `content/checkpoints.ts:71-90` `CHECKPOINT_MAKE_BANDS` | U01.CP two-chord-vamp [bass, chords]; U02.CP and U04.CP two-chord-vamp, all tracks; U03.CP phrase-8bar, all tracks; U05.CP and U06.CP axis-4bar [drums]. |
| Opening with an earlier sketch | `app/src/lesson/make-start.ts` | `fromSketch` opens the Make with the newest version of the learner's sketch from the named lesson. "Start from Oak's copy" brings the starter back. This is the closest existing primitive to a song that persists. |
| Storage | `server/src/db/migrations/0001_init.sql:325-351`, `:353` | `sketches` / `sketch_versions` (code, bpm, meter, key, `band_json`). `album_tracks` has a nullable `capstone_id` **or** a `sketch_id`, and side `A`/`B`/`Bside`, so a sketch can be an album track without a capstone. |
| Capstones | `content/capstones.ts` | C0 :1637 (`opensAfter U01.CP`), C1 :1778 (`U02.CP`), C2 :1893 (`U07.CP`). The last session of a capstone has `review: true, release: true` (:57-70). |
| Default order | `content/syllabus.ts:655-672` | Each unit's CP comes **after the next unit's L01**. C0.S1 follows U01.CP, which comes after U02.L01. C1.S1 follows U02.CP, which comes after U03.L01. U05.L09 is taught between U05.L04 and U05.L05. |
| Unlocks that limit learner code | `content/toolbox.ts` | `~` U01.L02, `[ ]` U01.L04, `< >` U01.L07 (:272), `.slow/.fast` U01.L09, `note()` U02.L01, `.transpose` U02.L05, `.room` U02.L08, `n()`/`.scale()` U03.L02 (:315), patterned `.scale` U03.L05, `acgtr` U03.L11, `,` stack U04.L03 (:278), `.arp` U05.L04, `upright` U05.L06, `chord()`/`.voicing()`/`rhodes`/`organ` U05.L08 (gated), `.add(n())` U06.L01, `pad` U06.L06, `.struct` U06.L12, `ebass`/`.lpf` at C1.S1 (fallback U03.L03), **`arrange()` only at U09.L02** (:288). Band code may use any tool, because the Band is a preview context (§5.10 rule 4). |

---

## 2. Inventory: U01 Pulse & Rhythm I (`content/specs/U01.md`)

In every U01 Make the learner writes **drums only**. Oak's Band plays **bass and chords** (`tracks: ["bass","chords"]`),
in C, so U01 is already "the learner takes over Oak's drums".

| Lesson (Make at) | Idea | Meter · key · bpm | Starter (after `setcpm`) | Learner writes | Band [Oak plays] | Required rule | Fit |
|---|---|---|---|---|---|---|---|
| U01.L01 Heartbeat (`L01/lesson.ts:371`) | pulse; tempo with `setcpm(bpm/4)`; one cycle is one bar | 4/4 · C · 96 (starter `setcpm(100/4)`) | `drums: s("bd")` | one `drums:` line (the whole kit); learner picks the tempo | two-chord-vamp [bass, chords] | `every-beat` "A drum sound starts on each of the four beats, in every bar" (`onsets` @drums ⊇ 0,¼,½,¾, perBar) | FITS: the verse pulse; the learner sets the song tempo |
| U01.L02 Count to Four (:369) | beat 1; rests `~` | 4/4 · C · 96 | `drums: s("bd sd bd sd")`; `hats: s("hh*8").gain(.6)` | drums and hats lines | [bass, chords] | `a-rest` "One whole beat where every line is silent, hats included" (custom `silent-beat`, alsoUses `tb.mini.rest`) | FITS-WITH-CHANGE: becomes the song's stop (the beat of air before a chorus). Decide whether Oak's parts stop too; the rule reads learner lines only |
| U01.L03 Backbeat (:380) | kick on 1 and 3, snare on 2 and 4, one labelled line per drum | 4/4 · C · 100 | `kick: s("bd ~ bd ~")`; `hats: s("hh*8").gain(.6)` (the snare line is added) | `kick:` `snare:` `hats:` | [bass, chords] | `backbeat` "In every bar, the snare plays on beats 2 and 4 and not on beats 1 or 3" (`onsets` snare ⊇ ¼,¾, excludes 0,½, perBar) | FITS: the verse kit |
| U01.L04 Two per Beat (:371) | eighths with `[ ]` | 4/4 · C · 100 | kick `bd ~ bd ~`, snare `~ sd ~ sd`, hats `hh hh hh hh` | kick, snare, hats | [bass, chords] | `brackets` "At least one beat split in two on any line, with `[ ]`" (custom `split-beat`) | FITS: the chorus groove (busier hats, a kick on an "and") |
| U01.L05 Seeing Rhythm (:308) | note values on the percussion staff; hold with `@`/`_` | 4/4 · C · 88 | `drums: s("cr bd sd sd")`; `hats: s("hh*8").gain(.5)` | drums, hats (perc staff shown) | [bass, chords] | `held` "One sound held with `@` or `_`: two beats or more, or twice another sound on its line" (custom `held`) | FITS: intro and ending hits (a crash that rings) |
| U01.L06 Sixteenths & 1-e-&-a (:314) | four per beat | 4/4 · C · 92 | kick, snare, `hats: s("hh*8")` | kick, snare, hats (+ toms) | [bass, chords] | `beat-one-in-four` "Beat 1 of every bar has a drum sound on 1, e, & and a" (`onsets` ⊇ 0, 1/16, ⅛, 3/16, perBar) | FITS: pre-chorus build, or chorus hats in sixteenths |
| U01.L07 Four-Bar Phrases & Fills (:311) | `< >` bar variation; a fill in bar 4 | 4/4 · C · 100; bars [4,8] | kick, snare, hats (one bar) | kick, snare, hats over 4 bars | [bass, chords] | `alt` "One line plays at least two different bars, using `< >`" (custom `bars-differ` min 2) | FITS: the fills that end each section, a 4-bar phrase with a fill into the next section |
| U01.L08 Three to a Bar (:302) | meter 3/4, `setcpm(bpm/3)` | **3/4** · C · 108; bars [1,4] | `setcpm(108/3)`; `drums: s("bd ~ sd")` | drums in three | **waltz-vamp** [bass, chords] | `three-beats` "A drum sound starts on each of the three beats, in every bar" | **SIDE**: `setcpm(bpm/3)` changes the cycle length for the whole program, so a 3/4 section cannot sit in a 4/4 song. Keep it as a side sketch |
| U01.L09 Copy That Groove (:347) | copy by ear; half and double time | 4/4 · C · 96; bars [1,4] | kick `bd ~ [~ bd] ~`, snare, hats, all `.bank("LinnDrum")` | kick, snare, hats (+ shaker, cowbell) | [bass, chords] | `slow-or-fast` "At least one line that plays changes speed with `.slow()` or `.fast()`" (custom `speed-change`) | FITS: a half-time bridge or a double-time outro (`.slow(2)` stretches a 1-bar groove over 2 bars) |

**U01.CP** (`U01/CP/checkpoint.ts:152`): "checkpoint-groove", bars [2,4]. Starter kick, snare, `hats*8` at 96.
Required `backbeat` (snare ⊇ ¼,¾ per bar). Band two-chord-vamp [bass, chords]. FITS: any section's groove.

**Optional rules worth knowing:**
- L01 has `tempo` 70–140, `two-lines`, and `star` (uses `*`).
- L02 has `beat-one` and `accent` (`.gain`).
- L03 has `three-lines` and `machine` (`.bank`).
- L07 has `four-bars`, `toms`, and `backbeat` in bars 1–3. That backbeat check is **absolute** (`perBar:false`, positions [1,4]…[11,4]).

---

## 3. Inventory: U02 Pitch, Keyboard & Treble Staff (`content/specs/U02.md`)

Every Make is in C over `band.two-chord-vamp` with **all three tracks** (Oak plays drums, bass and chords). The learner
writes **the `mel:` line** (in L06 also `vox:`). U02 conventions say: no "key, scale, degree" words, `c` is the only
letter before L02, no accidentals before L03, and "bass notes stay in the Band". AUTHORING:347 warns that over C then F,
nothing may be held a half step above a chord tone. Transpose by 5 or 7 so a copy fits the F chord.

| Lesson (Make at) | Idea | Meter · key · bpm | Starter | Learner writes | Band | Required rule | Fit |
|---|---|---|---|---|---|---|---|
| U02.L01 High & Low (:286) | higher and lower; octaves | 4/4 · C · 92 | `mel: note("c3 ~ c4 ~").s("piano")` | mel (only `c`) | two-chord-vamp, all | `three-heights` "Three or more different pitches on the `mel:` line" (`distinct-pitches` @melody ≥ 3) | FITS: the intro riff (octave jumps on c) |
| U02.L02 The White Keys (:338) | letters a–g, octave numbers, c4 = 60 | 4/4 · C · 96 | `mel: note("c4 e4 ~ c4")` | mel | all | `four-notes` "Four or more different notes on the `mel:` line" (`distinct-pitches` ≥ 4) | FITS: the verse riff |
| U02.L03 Half & Whole Steps (:350) | semitone and tone; sharps and flats | 4/4 · C · 88 | `mel: note("c4 e4 g4 a4")` | mel | all | `black-key` "At least one note lands on a black key, written with `#` or `b`" (custom `black-keys`) | FITS: one blue note in the verse riff (the clash rule applies: f#4 over F clashes) |
| U02.L04 The Treble Staff (:295) | read and write c4–f5 | 4/4 · C · 80 | `mel: note("c4 e4 g4 c5")` | mel (treble staff and keyboard) | all | `on-the-staff` "Every note from `e4` to `f5`, both included: no ledger lines" (`range` within e4–f5) | FITS: the chorus melody, readable on the staff |
| U02.L05 Moving Melodies (:446) | MIDI numbers; `.transpose()` | 4/4 · C · 96 | `mel: note("c4 e4 g4 e4")` | mel plus a moved copy (second line or `< >` bar) | all | `moved-copy` "A copy of the riff, every note moved up or down with `.transpose()`" (custom `transposed-copy` rhythm any) | FITS: the chorus answer (+5 onto the F bar) or an octave lift |
| U02.L06 Tones & Timbres (:340) | same line on other sounds | 4/4 · C · 96 | `mel: note("<[c4 e4 g4 e4] [f4 a4 g4 e4]>").s("piano").gain(.5)` | adds a `vox:` double | all | `two-parts` "In every bar, a second line plays the same notes at the same time on another sound, at the same height or one or two octaves away" (custom `transposed-copy` together, semis 0/±12/±24, otherSound, minRatio 1) | FITS: the learner takes over the doubling layer of the chorus. If `mel` is Oak's, the rule must compare against Oak's lead |
| U02.L07 Sing It Back (:332) | pitch matching; echoes | 4/4 · C · 80 | `mel: note("<[c4 d4 e4 ~] [~ ~ ~ ~]>")` | mel (a call, then a bar of rest for the sung echo) | all | `fits-your-voice` "Every note inside your voice's range, as Oak measured it" (`range` within `learner-voice`) | FITS: a call-and-response section where the learner sings the answer |
| U02.L08 Playing from the Page (:298) | read a tune off the staff; `.room()` | 4/4 · C · 96; bars [2,8] | Ode to Joy: `mel: note("<[e4 e4 f4 g4] [g4 f4 e4 d4] [c4 c4 d4 e4] [e4 d4 d4@2]>")` | mel (sound, `.clip`, `.room`) | all | `in-a-room` "At least half of the tune's notes play with `.room()` above 0" (custom `control-set` room > .02, share .5) | FITS-WITH-CHANGE: becomes "mix the lead": the rule works on any melody. The repertoire tune (Ode to Joy / When the Saints) can be a quoted interlude or dropped |

**U02.CP** (`:135`): "checkpoint-line", bars [2,4]. Starter `mel: note("<[c4 e4 g4 e4] [c4 e4 g4 ~]>")`. Required
`five-notes` (`distinct-pitches` ≥ 5). Band two-chord-vamp, all tracks. FITS.

---

## 4. Inventory: U03 Major Scale & Degrees (`content/specs/U03.md`)

The learner writes **the melody** (`mel:`). It is written in note names in L01, L06 and L07, and in `n()` + `.scale()`
everywhere else. The Band is two-chord-vamp with all tracks, except L11 (phrase-8bar). The Band follows the learner's
key (`followsLearnerKey`) in L02, L03, L04, L05, L08, L09, L10 and L11, but not in L01, L06 or L07, where the key is
declared. Jazz-soul Bands swing and play sixths and sevenths from U03.L01 on (`BAND_STAGES`). Spec rule: over the
vamp's bar 1 (C), degree 4 is never held for a beat.

| Lesson (Make at) | Idea | Meter · key · bpm | Starter | Learner writes | Band | Required rule | Fit |
|---|---|---|---|---|---|---|---|
| U03.L01 Home & the Major Scale (:393) | home by ear; spelling the major scale | 4/4 · C · 84 | `mel: note("<[c4 eb4 g4 e4] [f4 a4 g4 ~]>")` | mel (note names): fix the one out-of-key note, end on c | two-chord-vamp, all | `in-c` "Every note of the line is in C major: white keys only" (`in-key` C, minRatio 1) | FITS: "Oak's verse line has a wrong note; fix it and land home" |
| U03.L02 Degrees in Code (:425) | `n()` + `.scale()`; a key in one word | 4/4 · C · 84 | `mel: n("<[0 1 0 ~] [4 [5 4] 1 ~]>").scale("C4:major")` | mel in degrees | all, follows key | `one-three-five` "The line plays degrees 1, 3 and 5 (`n` 0, 2 and 4), each at least once" (`degree-set`) | FITS: the verse line rewritten in degrees (from here on the song's key is one word) |
| U03.L03 Restless Neighbours (:404) | 2 and 4 lean home; `n` < 0 or > 6 | 4/4 · C · 84 | `mel: n("<[0 2 4 2] [3 1 0 ~]>")` | mel | all, follows | `reach` "At least one `n` below 0 or above 6" (uses `tb.n.range`) | FITS: the verse line reaches under home or past 7 |
| U03.L04 Leading Tone & Six (:288) | degrees 6 and 7; 7 pulls to 1; `..` | 4/4 · C · 88 | `mel: n("<[0 1 2 4] [3 2 1 ~]>")` | mel | all, follows | `six-seven` "The line plays degree 6 and degree 7, each at least once" (`degree-set` 6, 7) | FITS: phrase endings (7 into 1) |
| U03.L05 Same Song, Any Key (:364) | key as a parameter; patterned `.scale("< >")` | 4/4 · C · 92; bars [1,8] | `mel: n("<[0 2 1 4] [3 2 0 ~]>").scale("C4:major")` | mel with a key plan | all, follows the **patterned** key (`band.ts` key plan) | `two-keys` "The tune plays in at least two different keys, set by a pattern in `.scale("< >")`" (custom `distinct-keys`) | FITS-WITH-CHANGE: gives the song its key change (e.g. verse 2 in F). The song's other learner parts must use the same plan; Oak's parts already follow |
| U03.L06 Sharp Keys (:361) | key signatures G, D, A; reading in G | 4/4 · **G** · 88 | `mel: note("<[d5 b4 a4 f4] [g4 a4 b4 g4]>")` | mel in note names, every F is f# | all, key G declared (does not follow) | `in-g` "Every note of the line is in G major…" (`in-key` G) | FITS-WITH-CHANGE: the song, or one section, goes to G. Learner parts written in degrees move with one word; this Make's part stays in note names |
| U03.L07 Flat Keys & the Circle (:335) | flats F, B♭, E♭; the circle | 4/4 · **F** · 88 | `mel: note("<[f4 a4 c5 [b4 a4]] [g4 a4 f4 ~]>")` | mel in note names, b becomes bb | all, key F declared | `in-f` "Every note of the line is in F major…" (`in-key` F) | FITS-WITH-CHANGE: same as L06, in F. Otherwise SIDE |
| U03.L08 Solfège (:310) | movable do; singing | 4/4 · C · 80 | `mel: n("<[0 4 7 9] [7 4 2 0]>")` | mel | all, follows | `within-a-sixth` "From its lowest note to its highest, the line spans at most 9 half steps: do up to la" (`range` maxSpan 9) | FITS: the sing-along chorus hook |
| U03.L09 Tunes by Number (:332) | steps and leaps; `.legato()` | 4/4 · C · 92; bars [2,8] | `mel: n("<[0 2 4 7] [5 3 5 7] [4 2 0 2] [5 3 5 ~]>")` | mel (4 bars) | all, follows | `mostly-steps` "At least 6 in 10 moves to a new note are steps…" (`step-ratio` .6) | FITS: the verse melody rewritten stepwise |
| U03.L10 By-Ear Transcription I (:323) | find home and the first note; write degrees | 4/4 · C · 84; bars [4,4] | `mel: n("<[0 0 0 2] [1 0 1 2] ~ ~>")` (Auld Lang Syne, bars 1–2) | bars 3–4 of mel | all, follows | `same-shape` "Bars 3 and 4 copy bars 1 and 2, every note moved up or down by the same amount" (custom `transposed-copy` unitBars 2, pairs [[1,3]]) | FITS-WITH-CHANGE: Oak's own phrase from the song replaces Auld Lang Syne as the call; the learner writes the answer as a sequence. The `pairs` bar numbers are relative to the learner's part |
| U03.L11 Melody Workshop (:406) | an 8-bar melody that pauses, then lands on 1 | 4/4 · C · 96; bars [8,16] | `mel: n("<[0 2 4 ~] [3 ~ 2 ~] [4 ~ ~ ~] [4 ~ ~ ~] [0 2 4 ~] [3 ~ 2 ~] [1 ~ ~ ~] [1 ~ ~ ~]>")` | 8-bar mel | **phrase-8bar**, all, follows | `home` "The melody's last note is degree 1, home" (`ends-on-degree` 1) | FITS-WITH-CHANGE: needs the song to have an 8-bar I IV I V \| I IV V I chorus from the start (today the harmony switches Band in this lesson). `ends-on-degree` must read the learner's chorus part, not the song's last note |

**U03.CP** (`:200`): "Eight bars home", key C, bpm 96, bars [8,8], Band phrase-8bar (all tracks). Starter is an 8-bar
`n()` tune ending on 2. Required `home-on-1`. FITS: it is the chorus.

---

## 5. Inventory: U04 Intervals (compressed) (`content/specs/U04.md`)

Every Make is in C over two-chord-vamp with all tracks; the Band does not follow the learner's key. The learner writes
**a second voice** or **dyads**. Spec conventions:
- The second line is labelled `vox`.
- `,` arrives at L03.
- `.transpose()` goes only after note names.
- No held note a half step above a chord note over the C bar; "the tritone hook of U04.L03 plays without the Band" (the hook only: the Make has a Band).

| Lesson (Make at) | Idea | Meter · key · bpm | Starter | Learner writes | Band | Required rule | Fit |
|---|---|---|---|---|---|---|---|
| U04.L01 Steps Apart (:269) | count an interval in degrees; a voice a 3rd above | 4/4 · C · 92 | `mel: n("<[0 2 4 2] [3 2 1 ~]>").scale("C4:major")` | adds `vox` (n+2 or n+5) | two-chord-vamp, all | `two-voices` "Two labelled lines that play notes, such as `mel` and `vox`" (`tracks` melody ≥ 2) | FITS-WITH-CHANGE: if `mel` is Oak's lead (or the learner's U03 tune), the rule counts **learner** lines only. Count Oak's lead, or the learner keeps both lines |
| U04.L02 Major, Minor, Perfect (:288) | quality by half steps; `.transpose("3M")` | 4/4 · C · 92 | `mel: note("<[c4 g4 c4 ~] [f4 g4 f4 ~]>")`; `vox: note(same).transpose(7).s("piano").gain(.6)` | the `vox` line's interval | all | `named` "A second line plays every note of the riff at the same time, moved by an interval name in `.transpose()` (not an octave)" (custom `transposed-copy` together, minRatio 1, alsoUses `tb.transpose.interval`) | FITS-WITH-CHANGE: as L01. The rule compares two learner lines, and the riff uses only 1, 4 and 5 so a fixed interval stays in C |
| U04.L03 Together Now (:348) | `,` for notes together; consonance and the tritone | 4/4 · C · 84 | `keys: note("<[c4 e4 c4 g4] [c4 a4 b3 f4]>")` | `keys` dyads (B–F resolving to C–E) | all | `together` "`,` used in a pattern, so notes play at once" (uses `tb.mini.stack`) | FITS: a keys or guitar dyad part (turnaround stabs) |
| U04.L04 Interval Ear Lab (:240) | name distances up, down and together | 4/4 · C · 96 | `mel: note("<[c4 e4 g4 e4] ~>")` | bar 2 = bar 1 moved | all | `same-shape` "Bar 2 plays bar 1's notes, all moved up or down by the same number of half steps" (custom `transposed-copy` pairs [[1,2]], alone) | FITS: the riff's answer bar (a 4th up onto IV) |

**U04.CP** (`:247`): "Two voices", C, 96, bars [2,4], Band two-chord-vamp (all tracks). Starter `mel` + `vox` (a 3rd
above). Required `together` (uses `,`). FITS.

---

## 6. Inventory: U05 Triads (`content/specs/U05.md`)

The Band is `band.axis-4bar` (I V vi IV, Oak's bass 1 5 6 4, one note a bar). From the spec: Oak plays
`["drums","bass"]` when the learner stacks chords on Oak's roots (L01, L04, L07); `["drums"]` when the learner
**picks** the chords (L02, L03, L05, L08, L09); `["drums","chords"]` when the learner writes the bass (L06).
"A learner's chords never sound together with the Band's chords." Rows are in **teaching order** (U05.L09 comes
before L05).

| Lesson (Make at) | Idea | Meter · key · bpm | Starter | Learner writes | Band [Oak plays] | Required rule | Fit |
|---|---|---|---|---|---|---|---|
| U05.L01 Stacking Thirds (:358) | triads `n("[0,2,4]")` | 4/4 · C · 88; bars [4,8] | `chords: n("<[0,2,4] ~ ~ ~>").scale("C3:major").s("piano")` | chords on Oak's bass | axis-4bar [drums, bass] | `triads-on-the-bass` "The `chords` line plays triads on 1, 5, 6 and 4, in that order" (`progression` I V vi IV, track chords) | FITS: the learner takes over Oak's verse chords as block triads |
| U05.L02 Major & Minor (:335) | quality by its 3rds and by ear | 4/4 · C · 88 | `chords: n("<[0,2,4] [3,5,7] [4,6,8] [0,2,4]>")` (I IV V I) | chords (their own loop) | [drums] | `a-minor-triad` "At least one minor triad: a stack on degree 2, 3 or 6" (`contains-rn` ii/iii/vi ≥ 1) | FITS-WITH-CHANGE: the harmony becomes the learner's. Oak's bass and lead must follow it or sit out (today the Band plays drums only) |
| U05.L03 Diminished & Augmented (:355) | restless triads | 4/4 · C · 84 | I V vi IV stacks | chords (with a dim or aug chord) | [drums] | `a-restless-triad` "At least one diminished or augmented triad" (`chord-qualities` dim/aug ≥ 1) | FITS-WITH-CHANGE: a passing chord in a turnaround (B° to C, or C+ to F). C+ needs note names; Oak's pitched parts must avoid the bar |
| U05.L04 Arpeggios (:241) | `.arp()` | 4/4 · C · 92 | I V vi IV stacks | the chords, broken | [drums, bass] | `broken-with-arp` "The `chords` line plays its stacks one note at a time, with `.arp()`" (custom `broken-chord`) | FITS: verse texture over Oak's bass |
| U05.L09 Chord Names (:301) | read and say C, Cm, C°, C+ | 4/4 · C · 92 | `chords: n("<[0,2,4] [3,5,7] ⟪[0] [0]⟫>")` (C F, then two to choose) | chords bars 3–4 | [drums] | `a-minor-name` "At least one minor chord in `chords`: a name with an m" (`chord-qualities` contains min) | FITS-WITH-CHANGE: the learner charts the bridge. Oak's bass and lead must follow or sit out |
| U05.L05 Inversions (:361) | slash chords; the bass steps | 4/4 · C · 84 | I V vi IV stacks | chords (one inverted) | [drums] | `an-inversion` "At least one chord with its 3rd or 5th at the bottom, not its root" (`chord-inversions` ≥ 1) | FITS-WITH-CHANGE: Oak's root bass would hide or contradict the inversion, so it must sit out or follow the lowest note |
| U05.L06 Bass Clef & Grand Staff (:336) | reading low notes | 4/4 · C · 88; bars [2,8] | `bass: note("<[c3 ~ g3 ~] [g3 ~ d3 ~] [a3 ~ e3 ~] [f3 ~ c3 ~]>").s("upright").lpf(800)` | **bass** | axis-4bar **[drums, chords]** | `low` "Every note of `bass` between `c1` and `c3`" (`range`) | FITS: a clean part takeover of Oak's bass. In the song it sits under whichever chords that section has (the rule ignores chords) |
| U05.L07 Voice Leading by Hand (:428) | common tones; small moves | 4/4 · C · 80 | `chords: note("<[c4,e4,g4] [g3,b3,d4] [a3,c4,e4] [f3,a3,c4]>")` | chords, voiced by hand | [drums, bass] | `smooth` "Every note of `chords` stays or moves by a step, two half steps at most, into the next chord and from the last back to the first" (`voice-leading` max 2, `loop: true`) | FITS: re-voice the verse chords. The wrap from the last chord to the first is loop-relative |
| U05.L08 Let Strudel Voice It (:520) | `chord()` + `.voicing()` | 4/4 · C · 92 | the L07 voice-led loop (fixed text, **not** `fromSketch`, though the prose says "your hand-led loop") | chords by name (Rhodes or organ) | [drums] | `voiced-by-strudel` "`.voicing()` used to place the chords" (uses `tb.voicing`) | FITS: the chorus or verse chords by name |

**U05.CP** (`:266`): "Chords that glide", 80, bars [4,8], Band axis-4bar [drums]. Starter: Oak's `bass` (a1 f2 c2 g2)
and root-position chords Am F C G, i.e. **vi IV I V**, a rotation. Required `glide` (`voice-leading` max 3, loop). FITS.

---

## 7. Inventory: U06 Diatonic Harmony (`content/specs/U06.md`)

The Band is `band.axis-4bar`, with `["drums"]` in nearly every Make. The learner writes **chords** with
`n("[0,2,4]").add(n("<…>"))`, symbols or stacks. They also write the bass in L05 and L11, where Oak's chords sit **in
the starter as learner code**, and a comping rhythm in L12. The `progression` rule judges the **declared** key: the
grader does not read the learner's `.scale()` (spec conventions). Jazz-soul and funk swap `snd.piano` for
`snd.rhodes` in L01, L03, L04, L07, L08 and L09; funk Bands play four-note chords from U06.L01.

| Lesson (Make at) | Idea | Meter · key · bpm | Starter | Learner writes | Band | Required rule | Fit |
|---|---|---|---|---|---|---|---|
| U06.L01 The Seven Chords (:338) | a triad on every degree; `.add(n())` | 4/4 · C · 92 | `chords: n("[0,2,4]").add(n("<0 4 5 3>")).scale("C3:major")` | chords | axis-4bar [drums] | `a-new-chord` "At least one chord on degree 2, 3 or 7" (`contains-rn` ii/iii/viio) | FITS-WITH-CHANGE: a new colour chord in, e.g., the pre-chorus. Oak's bass and lead must follow |
| U06.L02 Roman Numerals (:361) | I ii iii IV V vi vii° | 4/4 · **G** (exercise `key`) · 90 | `chords: n("<[5,7,9] ~ ~ ~>").scale("G3:major")` | chords vi IV I V in G | [drums] | `vi-iv-i-v` "The `chords` line plays vi IV I V in G, in that order" (`progression`) | FITS-WITH-CHANGE: the song (or its intro) in G, so "numerals travel". Otherwise SIDE |
| U06.L03 Home, Away, Tension (:335) | tonic, predominant, dominant | 4/4 · C · 84 | `….add(n("<0 3 0 3>"))` (I IV I IV) | chords | [drums] | `tension-goes-home` "V followed straight away by I" (`contains-rn` V, mustResolve) | FITS: the pre-chorus landing on V into the chorus I |
| U06.L04 Endings (:375) | half cadence and authentic cadence | 4/4 · C · 88; bars [8,8] | `….add(n("<0 3 0 4 0 3 0 4>"))` | chords, 8 bars | axis-4bar [drums] (S6 uses phrase-8bar [drums, bass]) | `bar-8-home` "Bars 7 and 8 go V to I" (`cadence` PAC/IAC, at last, before V) | FITS: the chorus, 8 bars: waits on V in bar 4, lands in 8 |
| U06.L05 Hear the Bass First (:277) | bass-degree dictation | 4/4 · C · 88 | `bass: n("[0 ~ ~ 0 ~ ~ 0 ~]").scale("C2:major")…`; `chords: chord("<C G Am F>").voicing().s("piano").gain(.5)` | **bass** (chords given) | [drums] | `chord-note-on-one` "On beat 1 of every bar, `bass` plays a note of that bar's chord" (`chord-tones-strong` melody bass, harmony **chords**, downbeat, cover) | FITS: the verse bass. **Drift:** the spec says Band [drums, chords] and `harmony: "band.chords"`; the shipped lesson puts Oak's chords in the learner starter instead |
| U06.L06 The Four-Chord Schema (:348) | the I V vi IV schema; rotations | 4/4 · C · 96 | `….add(n("<0 4>")).s("pad")` | chords on the pad | [drums] | `the-four-chord-loop` "`chords` plays I V vi IV in order, started on any of its four chords" (`progression` schema.axis, allowRotation) | FITS: the verse loop |
| U06.L07 Doo-Wop & Three-Chord Rock (:355) | I vi IV V; I IV V; plagal | 4/4 · C · **76** | `chords: chord("<C G Am F>").voicing()` | chords reordered, `.arp()` | axis-4bar [drums] (not `band.doo-wop`) | `doo-wop` "`chords` plays I vi IV V in order, started on any of its four chords" (`progression` schema.doo-wop, allowRotation) | FITS-WITH-CHANGE: a doo-wop bridge at the song's tempo |
| U06.L08 Harmonic Rhythm (:352) | one or two chords a bar | 4/4 · C · 100 | `chords: n("<0 5 1 4>").add(n("[0,2,4]"))` (I vi ii V) | chords | [drums] | `some-bars-twice` "At least one bar with one chord and one with two, never more than two" (custom `chords-per-bar`) | FITS: the pre-chorus hurries into V, or the chorus ending |
| U06.L09 Chord Dictation Workshop (:282) | bass, then quality, then numeral | 4/4 · C · 84 | `chords: n("<[0,2,4] ~ ~ ~>")` | chords I V vi iii | [drums] | `i-v-vi-iii` "`chords` plays I V vi iii in C, in that order" (`progression`) | FITS-WITH-CHANGE: Oak's dictation loop becomes the song's intro or outro |
| U06.L10 Seventh Colour (preview) (:372) | one more 3rd: `[0,2,4,6]` | 4/4 · C · **80** | `chords` (rhodes) + `bass` (upright) + `mel` (piano), I V vi IV | chords (bass and tune given) | [drums] | `two-sevenths` "At least two chords with a 7th on top: four notes stacked in 3rds" (`chord-qualities` maj7/7/m7/m7b5 ≥ 2) | FITS: colours the verse. **`fromSketch: "U05.L01"`**, already the "carry your loop forward" pattern |
| U06.L11 Slash Chords & Walking Down (:450) | the bass walks down; pedal; line cliché | 4/4 · C · **76** | `chords: chord("<C G Am F>").voicing()`; `bass: note("<c3 g2 a2 f2>").s("ebass").lpf(600)` | **bass** (C B A …) | [drums] | `one-inversion` "At least one chord with its 3rd or 5th as the lowest note" (`chord-inversions`, track chords) | FITS: the bridge or verse-2 bass walk-down (grand staff) |
| U06.L12 Comping Patterns (:372) | `.struct()` locked to the drums | 4/4 · C · 100 | `chords: n("[0,2,4]").add(n("<0 4 5 3>")).scale("C4:major")` | chord rhythm | axis-4bar **[drums, bass]** | `struct` "`.struct()` sets the rhythm of the chords" (uses `tb.struct`) | FITS: the final comping rhythm across the song, over Oak's drums and bass |

**U06.CP** (`:269`): "The loop, your way", 88, bars [4,8], Band axis-4bar [drums]. Starter: doo-wop chords + Oak's root
bass. Required `the-four-chord-loop` (`schema.axis`, rotation allowed). FITS.

---

## 8. Proposed unit songs and takeover sequences

The common shape I'd use is **Intro / Verse / (Pre-chorus) / Chorus / Bridge / Outro**, all in 4/4. Oak plays
every part: drums split into kick, snare, hats and perc; bass; chords; and a lead. The lead is new: no Band has one
today. The learner's code holds only their parts, written as loops. Oak places each loop into the sections it
belongs to, because `arrange()` is locked until U09.L02. That keeps every rubric loop-local and unchanged (see §9).

### U01: "the groove song" (drums handover)

- **Meter, key, tempo:** 4/4, C, one tempo of about 96–100 that the learner chooses in L01. The U01 convention allows
  84–124 BPM; the rubric checks 70–140.
- **Harmony:** Oak's only, because the learner never touches pitch. Reuse two-chord-vamp I–IV for the verse and
  axis-4bar I V vi IV for the chorus.
- **Form:** Intro 4 · Verse 8 · Stop (1 beat or bar) · Chorus 8 · Bridge 4 (half-time) · Chorus 8 · Outro 4.
- **Takeover sequence:**
  1. **L01:** the verse pulse. One `drums:` line replaces Oak's verse kick and snare (Oak keeps the hats); the learner's `setcpm` becomes the song's tempo.
  2. **L02:** the stop, a beat of air before the chorus.
  3. **L03:** the whole verse kit, `kick:` `snare:` `hats:`.
  4. **L04:** the chorus groove (eighths, a kick on an "and").
  5. **L05:** intro and ending hits (a held crash; perc staff).
  6. **L06:** the pre-chorus build, or sixteenth hats in the chorus.
  7. **L07:** the fill at the end of every 4-bar phrase.
  8. **L08:** SIDE (waltz sketch).
  9. **L09:** the half-time bridge, or a double-time outro.
  10. **U01.CP:** a 2-bar backbeat groove, in any section.
- **Ends with C0 Intro** (`content/capstones.ts:1637`). Today it is a 4–8 bar **drum-only** intro with these required
  rules: 4–8 bars, at least two drum lines, backbeat in bars 1–3 (absolute positions), closed hats on every eighth of
  bar 1, the last bar a fill (`bars-differ` last), tempo 70–140. Two ways to use it as the song's release:
  - grade the intro section's drums with C0's rubric, and release the whole song with Oak's parts (§5.10 rule 5 already records the Band on the album unless muted); or
  - make C0 the moment the learner owns every drum line.

  C0.S1 is scheduled after U01.CP, which comes after U02.L01, so the release lands one lesson into U02.

### U02: "the riff song" (lead handover)

- **Meter, key, tempo:** 4/4, C, about 92–96. The lessons run 80–96; L04 and L07 are slower for reading and singing.
- **Harmony:** two-chord-vamp I–IV throughout, as every U02 Make was tuned to C then F. Sections differ by
  arrangement, not chords.
- **Oak's parts:** drums, bass, chords, and a lead riff (new).
- **Takeover sequence:**
  1. **L01:** the intro riff (only `c`, three heights).
  2. **L02:** the verse riff (four white keys).
  3. **L03:** one blue note in the verse riff.
  4. **L04:** the chorus melody (e4–f5, on the staff).
  5. **L05:** the chorus answer bar, a transposed copy (+5 onto F, or an octave up).
  6. **L06:** the chorus doubling on a second sound.
  7. **L07:** call and response in the bridge (the learner sings the echo).
  8. **L08:** mix the lead (`.s`, `.clip`, `.room`), with an optional Ode to Joy interlude.
  9. **U02.CP:** a lead line with five or more notes.
- **Ends with C1 First Loop** (`capstones.ts:1778`). Its required rules: drums, bass and melody; exactly 4 bars;
  backbeat in every bar; bass within c1–c3 with at least 3 notes; riff span ≤ 15; tempo 70–140.
  - This is where the learner also takes over **the bass**. No U02 Make writes a bass, and `ebass` unlocks at C1.S1.
  - The drums can come back from the U01 song.
  - "Exactly 4 bars" has to mean "the core loop" if the release is a whole song.
  - C1.S1 runs after U03.L01.

### U03: "the melody song" (the lead, now in degrees)

- **Meter, key, tempo:** 4/4, C (`followsLearnerKey`), about 88–92.
- **Harmony:** the verse is the I–IV vamp; the **chorus is the 8-bar phrase I IV I V | I IV V I** (`phrase-8bar`).
  The chorus must be in Oak's song from day one, so that L11 and the CP happen in it. There is an optional key-change
  section (L05).
- **Takeover sequence:**
  1. **L01:** fix the out-of-key note in Oak's verse line (note names) and land on c.
  2. **L02:** rewrite the verse line in degrees 1, 3 and 5.
  3. **L03:** the verse line reaches past home.
  4. **L04:** phrase endings 6 and 7 into 1.
  5. **L05:** the key change (e.g. verse 2 in F).
  6. **L06:** the song, or its bridge, in G (note names with f#).
  7. **L07:** in F (bb).
  8. **L08:** the chorus hook within do–la, sung.
  9. **L09:** the verse melody rewritten mostly by step.
  10. **L10:** answer Oak's chorus phrase with a sequence.
  11. **L11:** the full 8-bar chorus (pause on 5 at bar 4, home at bar 8).
  12. **U03.CP:** "Eight bars home", which is the chorus.
- **Ends with:** **no capstone.** U03.CP is the nearest release moment. A release here needs a new album slot; the
  `album_tracks.sketch_id` path exists.

### U04: "harmony vocals" (second voice)

- **Meter, key, tempo:** 4/4, C, about 92. Harmony: the I–IV vamp.
- Only four lessons, all about adding a voice to a tune. **Option A (recommended):** U04 reopens the U03 song and the
  learner's own melody gets a second voice. **Option B:** a new short riff song.
- **Takeover sequence:**
  1. **L01:** the verse's second voice, a 3rd or 6th above (`vox`, n+2 or n+5).
  2. **L02:** the chorus harmony by a named interval (`"3M"`, `"6M"`, `"5P"`).
  3. **L03:** a keys or guitar dyad part (B–F resolving to C–E in the turnaround).
  4. **L04:** the riff's answer bar, moved by one interval (a P4 onto IV).
  5. **U04.CP:** both voices stacked with `,`.
- **Ends with:** **no capstone.**

### U05: "the chord song" (chords, then bass)

- **Meter, key, tempo:** 4/4, C, about 88.
- **Harmony:** I V vi IV (`axis-4bar`) for the verse. The chorus and bridge harmony becomes the learner's.
- **Takeover sequence** (teaching order):
  1. **L01:** verse chords as block triads on Oak's bass.
  2. **L02:** a minor substitution in the chorus or bridge.
  3. **L03:** a dim or aug passing chord in the turnaround.
  4. **L04:** the verse chords broken with `.arp()`.
  5. **L09:** the bridge chart (C F + two of Dm, Em, G, Am).
  6. **L05:** inversions so the floor walks (bridge).
  7. **L06:** the learner takes over **Oak's bass** (≤ c3).
  8. **L07:** the verse chords voice-led by hand.
  9. **L08:** the chorus chords by name with `.voicing()` on Rhodes or organ.
  10. **U05.CP:** a gliding vi IV I V.
- **The engine problem:** wherever the learner changes the harmony (L02, L03, L05, L09), Oak's bass and lead would
  clash. Today these Makes avoid it with Band `tracks: ["drums"]`. A cheap rule: put each harmony-changing Make in a
  section where Oak's pitched parts drop out (a breakdown or bridge), or build parts that follow the learner's chords.
- **Ends with:** **no capstone.**

### U06: "the progression song"

- **Meter, key, tempo:** 4/4, C, about 88–92. L07 and L11 were written at 76 and L10 at 80, for a ballad feel; no
  rule checks tempo.
- **Form:** Intro (I V vi iii) · Verse (I V vi IV on the pad) · Pre-chorus (away, then V, with faster chord changes) ·
  Chorus (8 bars: half cadence at bar 4, authentic cadence at bars 7–8) · Bridge (doo-wop I vi IV V, or the walk-down
  C G/B Am) · Last chorus · Outro (plagal IV–I, sevenths).
- **Takeover sequence:**
  1. **L01:** a new diatonic chord in the pre-chorus.
  2. **L02:** the intro as vi IV I V. In G, or SIDE.
  3. **L03:** the pre-chorus road home (away, then V into I).
  4. **L04:** the chorus phrase.
  5. **L05:** the verse bass.
  6. **L06:** the verse loop on the pad, any rotation.
  7. **L07:** the doo-wop bridge with `.arp()`.
  8. **L08:** the pre-chorus harmonic rhythm.
  9. **L09:** the intro loop, taken down by ear.
  10. **L10:** sevenths colour the verse (fromSketch).
  11. **L11:** the bridge bass walks down.
  12. **L12:** `.struct()` comping across the song, over Oak's drums and bass.
  13. **U06.CP:** the four-chord loop "your way".
- **Ends with:** **no capstone in U06.** **C2 Four-Chord Song** (`capstones.ts:1893`, opens after U07.CP) is the
  natural release of a **U06 chords + U07 melody** song. Its required rules: 8 bars in C, I V vi IV (any rotation) in
  bars 1–6, a cadence in bars 7–8, chord tones on strong beats, range ≤ 19, and the bar-1 motif back in half the bars.
  Its template `C2_TEMPLATE` (`capstones.ts:283`) already gives drums, root bass and chords and leaves the melody.

---

## 9. What makes the song rework easy or hard

### Easy

1. **One meter and almost one key.** 52 of 53 Makes are 4/4. U02–U06 are in C except four Makes (U03.L05, L06, L07 and U06.L02).
2. **Few harmonic beds:** I–IV, the 8-bar phrase and I V vi IV, already written as Bands with all four flavours and their staged versions.
3. **Takeover is already a content field.** `BandRef.tracks` lists the parts Oak keeps:
   - U01: [bass, chords], so the learner owns the drums.
   - U05.L06: [drums, chords], so the learner owns the bass.
   - U05 and U06: [drums] or [drums, bass].

   A song's "owned by you / owned by Oak" view is a per-section generalisation of that one field.
4. **Rubrics are loop-local.** They read the learner's own tracks with bar 1 as the start of the learner's pattern (`onsets` perBar, `transposed-copy` pairs, `progression`, `cadence at last`, `ends-on-degree`, `voice-leading loop`). If the learner writes a loop for one part of one section and Oak places it, the rubrics and their tests need no change. They break only if the grader reads the whole assembled song.
5. **Key following exists, including patterned key plans** (`bandCodeFor`, `packages/strudel/src/band.ts:201`), so U03.L05's key change and re-keying a song already work for Oak's parts.
6. **Persistence exists in miniature.** `fromSketch` plus `make-start.ts` ("open with your earlier sketch / Start from Oak's copy"), `sketch_versions.band_json`, and `album_tracks.sketch_id` (album tracks without a capstone). The prose already tells a continuing-loop story in U05.L03, U05.L08, U06.L07 and U06.L10 ("your loop from Stacking Thirds"), though only U06.L10 uses `fromSketch`.
7. **Each lesson has a sound-first hook** (S1 listen, e.g. `HOOK` in `U06/L03/lesson.ts:40`, `U06/L04/lesson.ts:39`) that could become "the song, with today's idea played by Oak".

### Hard

1. **No Band has a melody or lead part.** Roles are only drums, bass and chords (`lesson.ts:148`; `layers()` in `bands/index.ts:150`). "Oak plays every part" in U02–U04, where the learner takes over the *lead*, needs a new Band role. `FlavourKit.lead` sounds exist (pop piano, jazz-soul vibes, indie acgtr, funk organ) but no Band uses them.
2. **Band drums are one track** (kit and hats stacked with `,`). U01's partial takeovers (pulse, then hats, then fills) need Oak's drums split into kick, snare, hats and perc tracks, so that Oak can drop exactly the line the learner now owns.
3. **No form in U01–U08 Bands.** The only sectioned Band is `band.sections` (U09+, 16 bars), and it *follows the learner's* `arrange()` (`band-form.ts:176`). Learners cannot write `arrange()` until U09.L02. So in U01–U06 Oak must own the arrangement and place the learner's loops: the reverse of today's direction.
4. **Harmony-changing Makes clash with Oak's pitched parts.** These are U05.L02, L03, L05, L09 and U06.L01, L02, L07, L08, L09. Today they mute Oak's bass and chords (`tracks: ["drums"]`). Nothing makes Oak follow the learner's chords: there is `followsLearnerKey` but no "follows learner chords".
5. **Oak's parts are sometimes learner code.** Several starters put Oak's material in the learner's editor because a rule must read it:
   - U04.L02 (`mel`);
   - U06.L05 (`chords`, read by `chord-tones-strong harmony: "chords"`);
   - U06.L10 (`bass`, `mel`);
   - U06.L11 (`chords`, `bass`);
   - U05.CP (`bass`) and U06.CP (`bass`).

   Rules can name `band.<label>` tracks (contracts §6.2.5), but U06.L05's spec planned `harmony: "band.chords"` and the shipped lesson does not use it. U02.L06, U04.L01 and U04.L02 compare *two learner lines* (`transposed-copy`, `tracks min 2`). If Oak owns one of them, the rules must read Oak's track.
6. **Key and meter outliers.**
   - U01.L08 is 3/4. `setcpm(bpm/3)` is global, so a waltz section cannot exist inside a 4/4 song.
   - U03.L06 is in G and U03.L07 in F. Both declare the key, and the Band does not follow the learner there.
   - U06.L02 is in G, and the `progression` grader judges the declared key, not the learner's `.scale()`.
7. **Tempo is per lesson** (`LessonDef.bpm`, and every starter's `setcpm`). A song has one tempo, so the declared bpm becomes a hint or the song's own.
8. **Every Make starter begins with `setcpm(...)`.** If the learner's code is only "their part", the tempo line moves to the song, except in U01.L01, whose idea is setting the tempo.
9. **Releases.**
   - Only C0 (U01) and C1 (U02) exist among U01–U06, and both are loop or intro briefs, not songs: C0 is drums-only, 4–8 bars; C1 is *exactly* 4 bars.
   - C0 adds no new parts. C1 adds the learner's bass, which no U02 lesson teaches.
   - U03–U06 need new release sessions or album slots.
   - In the default order each CP and capstone runs after the next unit's L01, so "release the old song" overlaps "open the new song".
10. **Minor inconsistencies seen on the way:**
    - U05.L08's flavour swap key is `"piano"` while U06 and U09 use `"snd.piano"` (`U05/L08/lesson.ts` vs `U06/L01/lesson.ts:72`).
    - U01.L01's Make starter tempo (100) differs from the lesson's (96).
    - U06.L05 drifts from its spec on its Band and rule (above).

---

## 10. Quick lookup: Make step and rubric line numbers

`content/core/<unit>/<lesson>/lesson.ts`, as `kind: "make"` line / `rubric:` line:

| Lesson | make / rubric |
|---|---|
| U01.L01–L09 | L01 371/391 · L02 369/387 · L03 380/395 · L04 371/386 · L05 308/326 · L06 314/329 · L07 311/329 · L08 302/317 · L09 347/365 |
| U02.L01–L08 | L01 286/301 · L02 338/356 · L03 350/368 · L04 295/310 · L05 446/461 · L06 340/355 · L07 332/350 · L08 298/313 |
| U03.L01–L11 | L01 393/408 · L02 425/442 · L03 404/419 · L04 288/303 · L05 364/379 · L06 361/381 · L07 335/353 · L08 310/328 · L09 332/349 · L10 323/342 · L11 406/423 |
| U04.L01–L04 | L01 269/286 · L02 288/303 · L03 348/365 · L04 240/255 |
| U05.L01–L09 | L01 358/376 · L02 335/353 · L03 355/371 · L04 241/259 · L05 361/379 · L06 336/351 · L07 428/444 · L08 520/539 · L09 301/319 |
| U06.L01–L12 | L01 338/356 · L02 361/380 · L03 335/350 · L04 375/393 · L05 277/298 · L06 348/363 · L07 355/373 · L08 352/367 · L09 282/297 · L10 372/393 · L11 450/468 · L12 372/387 |
| Checkpoint Makes (`<unit>/CP/checkpoint.ts`, `make:` line) | U01 152 · U02 135 · U03 200 · U04 247 · U05 266 · U06 269 |
