# Oak binding contracts (v1)

**Status: binding.** Every implementation agent and every content agent works to this document. It expands the 14 "Binding resolutions" in `docs/PLAN.md` and settles every issue in `docs/design/critiques.md` (see the ledger in §12).

**Precedence.** `docs/PLAN.md` binding resolutions → this document → `content/STYLE.md` and `content/AUTHORING.md` → the four design docs (`curriculum.md`, `exercises.md`, `ux.md`, `architecture.md`). Where a design doc disagrees with this document, the design doc is wrong. Sections of the design docs that this document deletes are listed in §5.9.

**Changing a contract.** Edit this file in the same commit as the code or content that needs the change, bump `CONTRACTS_VERSION` in `packages/content-kit/src/version.ts`, and add a line to the change log at the bottom. Nothing else may redefine a schema, an ID scheme, a threshold or an unlock.

**How the facts were checked.** Every Strudel behaviour stated here or in `content/STYLE.md` was executed headlessly on 2026-11-11 against the pinned packages (`@strudel/core`, `mini`, `tonal`, `transpiler` 1.2.6 under Bun 1.4.4, with a `.p` collector copied from `repl.mjs`). The course map, session counts, default session order, skill-graph ordering and unlock table were generated from data and machine-checked (no duplicate IDs, every unlock points at a real session, every skill's prerequisites are introduced no later than the skill itself). Audio behaviour (audibility of controls, sound aliases) cannot be checked headlessly and stays conditional on spike S3; such rows are marked †.

A second, adversarial pass on the same day re-ran every Strudel claim from scratch (scripts and raw output in `spikes/contracts-check/`), re-derived the music theory, and re-checked the course map, the skill order, the unlock table and the checkpoint map by script. What it changed is in §0.13–§0.26 and in the change log.

## 0. Corrections to the source documents

These are facts that the plan or the design docs state loosely or wrongly. The corrected form is binding.

| # | Source statement | Verified fact | Binding form |
|---|---|---|---|
| 0.1 | "Chord spellings must resolve in every voicing dictionary: `C Cm Co Caug C^7 C7 Cm7 Cm7b5 Co7`" | No spelling resolves in every dictionary. `triads` holds only triads; `lefthand` and `guidetones` hold only sevenths and sixths. `C Cm Co` resolve in `ireal`, `ireal-ext`, `triads`, `legacy`; `Caug` resolves correctly only in `ireal` and `ireal-ext` (row 0.13). `C^7 C7 Cm7 Cm7b5 Co7` resolve in `ireal`, `ireal-ext`, `lefthand`, `guidetones`, `legacy`. | The nine canonical spellings are the only spellings for their qualities, and each resolves in **every dictionary that carries its chord family**. The lint checks each symbol against the `dict()` in the same chain (STYLE §5). |
| 0.2 | Curriculum §7.11 and exercises §3.9 make `C+`, `C-`, `C-7`, `Ch7` canonical | `chord("C+")` is a mini-notation **parse error** (`+` is not a legal token). `C-`, `C-7`, `Ch7`, `CM7`, `C-^7` resolve only in `ireal`/`ireal-ext`. | Forbidden in content: `C+ C- C-7 Ch7 CM CM7`. |
| 0.3 | Slash chords "`C/E`" in code (curriculum U06.L11, C04) | `chord("C/E")` throws `Invalid argument`: `/` is the mini-notation slow operator. | Slash chords are never written inside `chord("…")`. The inversion is set by the lowest sounding note: a `bass:` track, or a hand-voiced note list. `C/E` exists only as a display string. |
| 0.4 | `.add()` for "stacking thirds on any degree" (curriculum U06.L01), UX demo `n("0 1 2 3").add("<0 [0,2]>")` | `n("[0,2,4]").add("<0 3 4>")` logs `Can't do arithmetic on control pattern` and changes nothing. `n("[0,2,4]").add(n("<0 3 4>")).scale("C4:major")` gives C–E–G, F–A–C, G–B–D. After `.scale()`, `.add(n(…))` no longer changes pitch. | Degree arithmetic is `.add(n("…"))`, placed before `.scale()`. After `.scale()` use `.scaleTranspose()`. |
| 0.5 | "`n("3#")` = ♯4, `n("6b")` = ♭7, `n("2b")` = ♭3" | Confirmed in C major: `3#`→F♯, `6b`→B♭, `2b`→E♭, `5b`→A♭, `1b`→D♭, `4#`→G♯, `0#`→C♯; `7b`→B♮ (the trap). The raw strings are misspelled (`Gb4`, `A#4`): never display them. | As planned. |
| 0.6 | `..` range (curriculum U03.L03) | `n("0 .. 7")` works; `n("0..7")` is an error (`invalid scale step "0..7"`). | Ranges are written with spaces. |
| 0.7 | Patterned swing `.swingBy("<0 .1 .2 .33>",4)` | Works with decimals. A fraction inside the string (`"1/3"`) is parsed as a slow-down and silently gives no swing. | Literal amount: the JS expression `1/3`. Patterned amount: decimals only. |
| 0.8 | Bank short names `tr909`, `linn` | `.bank("tr909")` puts `bank:"tr909"` on the hap; it only sounds if `aliasBank` maps it at the audio layer. | Full names only (`RolandTR909`), as planned. |
| 0.9 | "Any label starting with capital S solos" | Confirmed in `repl.mjs` 1.2.6: a label longer than one character that starts with `S` solos. | Labels come from the fixed lowercase set (STYLE §2). |
| 0.10 | Session counts: "about 250", U07 = 15, U15–U17 = 16, gym "about 15" | Applying every decision in the plan gives 124 core lessons, 13 checkpoints, 29 core capstone sessions (4 of them CF-T in gym slots) and 17 gym sessions: **183 core sessions**, plus **74 advanced**, **257 in total**. The plan's row for U07 forgot one of {pickup lesson, third X1 session}; its U15–U17 row left out C7; C0 was not counted. Version 1.6 adds one lesson (U05.L09) and one capstone session (C3.S4): 125 lessons, 30 capstone sessions, **185 core sessions**, **259 in total**. | The counts in §2.7. |
| 0.11 | `docs/design/exercises.md` | The saved file is truncated: it starts in the middle of §2.2 (`…ange[] }`). §0–§2.2 (foundations, the exercise catalog, `ExBase`, `Hint`, `Stimulus`, `Cue`, `AnswerUi`, `CodeSpec`, `Reference`, `Matcher`, `AstConstraint`, tolerances, the first six kinds) were recovered from the designer's transcript. | §5 below reproduces every kept type in full, so this document does not depend on the truncated file. |
| 0.12 | Skill graph "139 nodes" | The re-edging adds E12a, E12b (E12 retired), N09, M10, C10. | 143 live nodes, 1 retired ID (§4). |
| 0.13 | `Caug` "resolves" in `triads` (first version of this document) | It sounds, but wrongly. `voicings.mjs` 1.2.6 defines `aug: ['1P 3m 5A', …]` (a minor third) in `triads` and `legacy`, so `chord("Caug").dict("triads").voicing()` plays E♭4 A♭4 C5: the pitch classes of an **A♭ major** triad. `ireal` and `ireal-ext` play C E G♯. | `Caug` with `.dict("triads")` is the lint error `code.chord-not-in-dict`. Augmented triads are voiced with the default dictionary or by hand (`note("[c4,e4,g#4]")`). |
| 0.14 | `C69` "resolves" in `lefthand` | `lefthand` defines `69: ['3M 5P 6A 9M']` (an augmented sixth), so `C69` plays E G B♭ D: it sounds as C9, a dominant. `ireal` and `guidetones` are right. | `C69` with `.dict("lefthand")` is `code.chord-not-in-dict`. |
| 0.15 | Toolbox row "`.voicing()` then `.n("0 1 2")` to pick voices" | `chord("<C Am>").voicing().n("0 1 2")` still plays all five notes (`n` is set after the notes exist). `chord("<C Am>").n("0 1 2 3").voicing()` plays one note per chord. `n("0 1 2 3").chord("<C Am>").voicing()` plays E3 C4 E4 G4: the single voices. `n("0 1 2 3").set(chord("<Dm7 G7>")).voicing()` does the same. | Single voices of a voicing are written **`n("…")` first**: `n("0 1 2 3").chord(changes).voicing()` (STYLE §5.3). |
| 0.16 | Time amounts (plan: "microtiming uses `.late()`") | `.late(1/32)` moves the events by 1/32 of a bar. `.late("1/16")` and `.off("1/8", …)` do **not** shift: inside a pattern string `1/16` is "the value 1, slowed 16 times", the same trap as patterned swing (0.7). `.late("<0 .02>")` with decimals works. | Time arguments of `late`, `early`, `off` and `swingBy` are JS expressions (`1/16`); a patterned amount uses decimals. A fraction inside such a string is the lint error `code.time-fraction-string` (`code.swing-fraction-string` for swing). |
| 0.17 | STYLE example `s("hh*16").velocity("1 .35 .6 .35")` as a per-16th accent pattern | A control pattern takes its rhythm from the pattern on its left. The four values are spread over the bar: the 16 hats get 1 1 1 1 .35 .35 .35 .35 .6 … (one value per beat). `"[1 .35 .6 .35]*4"` gives 1 .35 .6 .35 on every beat. | Per-step accent, ghost-note and gain patterns repeat their cell (`"[1 .35 .6 .35]*4"`) or list one value per step (STYLE §11). |
| 0.18 | "Key changes use a patterned `.scale()`" together with "one `arrange()` per track" | Inside `arrange()`, each section plays from its own cycle 0. A section const that carries `.scale("<C4:major!8 D4:major!8>")` therefore stays in C on every appearance. Placed **after** `arrange()`, the same pattern changes key at the right bar and keeps the key context (`arrange([8, a], [8, b], [8, b]).scale("<C4:major!16 D4:major!8>")`: bars 17–24 are in D and say `D4 major`). | The key plan of an arranged piece is one patterned `.scale()` after `arrange()` on each pitched track, or a lifted section const with its own `.scale()` (§6.3, §6.8, STYLE §9). |
| 0.19 | `.add("…")` is a no-op (0.4) | So is a bare number: `n("[0,2,4]").add(3)` logs the same warning and changes nothing. `.add(n(3))` works. | The argument of `.add` on an `n()` pattern is always wrapped in `n(…)`. |
| 0.20 | `tb.clip` and `tb.legato` as two controls | `.legato(.5)` and `.clip(.5)` both put `clip: 0.5` on the event: one control, two names. | Both names stay in the toolbox (short notes in U02.L08, phrasing in U03.L09); the grader and `NEvent.clipDur` read `clip`. |
| 0.21 | `mode("root:g2")` "root near that note" | The bass is the highest root **at or below** the note: with `root:g2`, C → C2, A → A1, F → F2, G → G2. | Described that way in STYLE §5.3; still graded on pitch-class set and bass pitch class only. |
| 0.22 | "`"C4 major"` is an error in Strudel" | No exception is thrown. Strudel logs `[tonal] error: Scale name C4 is incomplete…` and most notes vanish (`n("0 2 4").scale("C4 major")` plays a single G3). | The lint error `code.scale-spaces` is the only safety net; the eval log line is surfaced as `eval` feedback. |
| 0.23 | Plan resolution 1: `lesson.ts` holds "code, exercises, grading, unlocks"; resolution 2: "one unlock table, `content/toolbox.ts`" | The two cannot both own unlocks. | `content/toolbox.ts` is the only place an unlock is declared (§3.1 rule 1); `lesson.ts` is checked against it. |
| 0.24 | Plan resolution 10: "one thread per (subject, day)" and "effort never changes inside a conversation" | Hints (low), chat (medium) and reviews (high) on one subject on one day cannot share one API conversation without changing effort. | One **visible** thread per (subject, day); up to four API conversations behind it, one per thread kind (§10.2). |
| 0.25 | "Voicings are graded on pitch-class set plus bass only" read as "the chord can be recognised from its voicing" | It cannot always. `lefthand` voicings are rootless with a 9th or 13th (`C7` → B♭ D E A); `ireal-ext` adds notes to plain symbols (`C` → C E A, `Co` → C E♭ G♭ A); `guidetones` has two notes. | Chord **identity** (root, quality, Roman numeral) comes from the chord symbol carried by the `_oakChord` shim, never from the sounding notes of a `voicing()` (§6.7). The pitch-class comparison is for "same voicing as the reference" and for hand voicings. |
| 0.26 | `swingBy` and note lengths | `swingBy` delays the off-beat event and keeps every event's length: `s("hh*8").swingBy(1/3, 4)` gives 0–1/8, 1/6–7/24, 1/4–3/8, … 11/12–25/24. The on-beat note is not lengthened; the off-beat note overlaps the next beat (the last one crosses the bar line). | The straightening step of §6.10 moves onsets only. |

## 1. ID registry

### 1.1 Rules

1. One registry. Sources of truth: `content/syllabus.ts` (units, lessons, checkpoints, capstones, gym), `content/skills.ts`, `content/families.ts`, `content/toolbox.ts`, `content/candos.ts`, `content/repertoire/*/song.ts`, `content/flavours.ts`, `packages/grader/src/feedback/catalog.ts`.
2. `bun run content:build` generates `content/.generated/ids.ts`: one `as const` array and one string-literal union type per kind (`LessonId`, `SkillId`, `FamilyId`, `ToolId`, `SoundId`, …), plus `isLessonId()`-style guards. Hand-written code imports ID types from there; no package declares `type LessonId = string`.
3. IDs are case-sensitive and globally unique. The prefix or shape decides the kind, so no two kinds can collide.
4. **An ID is never reused and never renamed.** A retired ID stays in `content/ids.lock.json` (committed) with `{id, kind, retiredAt, supersededBy?}`. `content:build` fails if an ID that is in the lock disappears from the sources without being marked retired.
5. Content CI (`bun run content:check`) rejects: an unknown ID anywhere (lesson files, MDX props, tests, rubric rules, tutor syllabus), a duplicate ID, an ID that does not match its grammar, a folder whose name does not match its lesson ID.
6. Display strings never appear in IDs and IDs never appear in learner-facing copy, except lesson codes in the Course list ("U06.L04").

### 1.2 Grammar

| Kind | Grammar (regex) | Examples | Notes |
|---|---|---|---|
| Unit | `U\d{2}` · `J[1-5]` · `R[1-3]` · `A[1-2]` | `U07`, `J2` | Core U00–U17. Track IDs are `J`, `R`, `A`. |
| Lesson | `U\d{2}\.L\d{2}` · `[JRA]\d\.L\d{2}` | `U03.L02`, `J1.L05` | |
| Checkpoint | `U\d{2}\.CP` · `J\.CP[12]` · `R\.CP` · `A\.CP` | `U07.CP`, `J.CP1` | 13 core + 4 advanced. |
| Capstone | `C[0-7]` · `X[12]` · `CF-A` · `CF-T` · `JC[1-4]` · `RC[12]` · `AC[12]` | `C2`, `CF-T`, `JC1` | The old `CF` is retired. |
| Capstone session | `<capstone>\.S\d` | `X1.S3`, `CF-A.S4` | |
| Gym session | `GYM\.\d{2}` | `GYM.07` | The n-th scheduled gym slot the learner reaches (§2.5). |
| Step | `<lesson>/S\d{1,2}` | `U03.L02/S5` | Stable within a lesson; never renumbered after release (§11.7). |
| Exercise | `<lesson-or-capstone>/[a-z0-9-]+` | `U05.L07/hand-voiced-cadence` | Global ID = owner + `/` + slug. |
| Example | `<lesson>@[a-z0-9-]+` | `U03.L02@degrees-in-code` | Read-only code samples. |
| Skill node | `[RPNSICHBMFEVJD]\d{2}[ab]?` | `S02`, `E12a` | §4. |
| Skill category | `<skill>/[a-z0-9.-]+` | `E05/deg.6`, `R05/code.mini.sub` | The exercises doc's fine-grained skills (`deg.major.6`, `code.scale-index`) live here, as children of a node. Evidence on a category rolls up to its node. |
| Drill family | `fam\.[a-z]+\.[a-z0-9-]+` | `fam.deg.fet-major` | `fam.` + the exercises-doc ID. Composite cards: `fam.mix.pitch`, `fam.mix.harmony`, `fam.mix.rhythm`. |
| Fact deck | `deck\.[a-z]+\.[a-z0-9-]+` | `deck.key.signature` | |
| Fact card | `fact\.[a-z0-9-]+(\.[A-Za-z0-9#-]+)*` | `fact.keysig.Eb-major`, `fact.staff.treble.F5` | Later segments may carry note and key names, so capitals and `#` are allowed there. |
| Tool | `tb\.[A-Za-z0-9]+(\.[A-Za-z0-9-]+)*` | `tb.scale`, `tb.mini.rest`, `tb.feature.band`, `tb.dict.triads` | Functions use the Strudel name with its capitalisation (`tb.swingBy`). Sub-kinds: `tb.mini.*` operators, `tb.feature.*` app features, `tb.lens.*`, `tb.template.*`, `tb.meter.*` tempo-line conventions, `tb.dict.*`, `tb.mode.*`. |
| Sound | `snd\.[A-Za-z0-9]+(\.[A-Za-z0-9]+)?` | `snd.rhodes`, `snd.drum.bd`, `snd.bank.RolandTR909`, `snd.wave.sawtooth` | |
| Scale name | `scale\.[a-z-]+` | `scale.harmonic-minor` | The lint maps `"A3:harmonic:minor"` to it. |
| Chord family | `chord\.[a-z0-9-]+` | `chord.triad`, `chord.dom7`, `chord.seventh`, `chord.seventh-dim`, `chord.sixth-sus`, `chord.alt`, `chord.ext` | The lint maps each symbol in `chord("…")` to a family. |
| Schema | `schema\.[a-z0-9-]+` | `schema.axis`, `schema.doo-wop`, `schema.blues12` | The exercises §3.5 library. |
| Can-do | `cd\.[a-z]+\.[a-z0-9.-]+` | `cd.compose.fourchord` | Areas: hear, read, write, compose, transcribe, sing, code. |
| Milestone | `ms\.\d{2}` | `ms.03` | |
| Glossary term | `term\.[a-z0-9-]+` | `term.cadence` | |
| Song | `song\.[a-z0-9-]+` | `song.aura-lee` | |
| Flavour | `flavour\.(pop\|indie\|jazz-soul\|funk\|electronic)` | `flavour.jazz-soul` | |
| Band layer | `band\.[a-z0-9.-]+` | `band.axis-8bar` | |
| Unit song | `usong\.<unit>` | `usong.U01`, `usong.J1` | One per unit (§5.11). Its section and part ids are plain strings, frozen once shipped (takes are keyed by them). |
| Feedback code | `[a-z]+(\.[a-z0-9-]+){1,2}` with a registered area | `rhythm.missing`, `code.locked-tool`, `lint.strict.this` | §5.7. |
| Tutor thread | `<subjectKind>:<subjectId>:<yyyy-mm-dd>:<threadKind>` | `lesson:U06.L04:2026-12-02:hint` | §10.1. Runtime, not content. |

Retired at v1: `CF` (→ `CF-A`, `CF-T`), `E12` (→ `E12a`, `E12b`), every ID form used only in the design docs (`u03.04`, `u03.l02`, `c.pitch.*`, `ear.degree.major.6`, `fn.*`, `tool.*`, `cando.*`, `deg.fet-major` without the `fam.` prefix, `F1–F3`/`J1–J4` as capstone names).

## 2. The revised course map

This replaces curriculum §1. `content/syllabus.ts` is written from these tables; the tables in the curriculum doc, the UX doc and the architecture doc are obsolete.

### 2.1 What changed against curriculum §1

| Change | Where |
|---|---|
| U00 re-scoped to two lessons: an ~8-minute wow loop with in-app key paste and Sketch 001, then set-up and calibration with a lenient first sing. The UX doc's U0.2 and U0.3 are dropped; the Studio tour is folded into U01.L01's wrap. | U00.L01, U00.L02 |
| Named lowercase labels from day one; `stack()` is Investigate-only; one labelled line per drum in U01. | U00.L01, U01.L03 |
| Swing-feel preview (a listen-and-compare step; `swingBy` stays locked). | U01.L09 |
| C0 Intro added as the first album track. | after U01.CP |
| Adult trad/PD repertoire replaces nursery tunes in U02–U03 (§2.7). | U02.L08, U03.L09–L10 |
| U03.L01 split: L01 "Home & the Major Scale", L02 "Degrees in Code"; later lessons renumbered +1. Singing is on numbers until U03.L08 introduces syllables. | U03 |
| U04 compressed to 4 lessons + CP. Interval inversion and compound intervals move to U12.L06; the isolated-interval deck unlocks there too. | U04, U12.L06 |
| `ebass` and `.lpf()` unlock at the start of C1; `voicing()`, `rhodes`, `organ` at U05.L08 behind the U05.L07 gate check. | C1.S1, U05.L08 |
| U06.L04 and L05 (cadences) merged; plagal and deceptive cadences are met inside the schema lessons; a seventh-colour preview lesson added. | U06.L04, L06, L07, L10 |
| Pickup (anacrusis) lesson added before lead sheets. | U07.L08 |
| X1 is 3 sessions on Aura Lee or Red River Valley (no Amazing Grace), gated on melodic dictation level 4. | X1 |
| Scheduled Transcription Gym from U07, every 5th session. | GYM.nn (§2.5) |
| "House of the Rising Sun" dropped (the familiar melody is a 1964 arrangement). | U10.L09 |
| M08 moves to U11.L08; U17.L02 teaches the key lift with a patterned `.scale()`. | U11, U17 |
| Core Finale split into CF-A (4 sessions) and CF-T (4 sessions in gym slots during U15–U17). | CF-A, CF-T |
| Jazz track reordered so music comes first; JC1 is a ii–V Ballad; chord-scales gated on U14.CP. | J1–J3, JC1 |
| R2.L05 teaches metric modulation only as implied regrouping; R1.L05 uses `.late()`; RC2 uses the 2-bar 8th-grid clave. | R1, R2, RC2 |
| A1.L01–L04 open as optional side lessons once U03.L02 is done. | A1 |
| U05.L04 split (1.6): `.arp()` stays in U05.L04 "Arpeggios"; chord-symbol names are U05.L09 "Chord Names", taught directly after it. No lesson ID changed; a learner who completed U05.L04 before the split is recorded as having completed U05.L09. | U05.L04, U05.L09 |
| C3 takes four sessions (1.6): C3.S3 arranges and writes the lead sheet; C3.S4 records the take, reviews and releases. | C3.S3, C3.S4 |
| Oak 2.0 W2 (2.2): ten lessons from *Making Music* (DeSantis 2015) go inside the existing units, each placed by array position after the lesson it follows; no lesson ID changes. Five core lessons add five sessions, and the slot rule (§2.5) then places one more gym slot (GYM.18). | U06.L13, U07.L11, U08.L06, U09.L06, U09.L07, R1.L06, J3.L05, A2.L07–L09 |

### 2.2 Reading the tables

- **Introduces** lists the skill nodes whose first lesson this is, in teaching order. **Practises** lists nodes that get evidence here but were introduced earlier.
- Unlocks are not repeated here: §3 is the only unlock table.
- Every lesson ends with a Make step and a saved sketch. Every checkpoint session and every gym session also ends with a saved artefact (§9.6).

### 2.3 Core units

**U00 Onboarding** — 2 lessons = 2 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U00.L01 | Hello, Loop | ~8 min. Start sound, hear a four-layer loop build up, change one number and hear it land, paste the API key in the app (skippable), meet the tutor, save Sketch 001. | D01 | — |
| U00.L02 | Set Up & First Sing | ~12 min. Headphones (with AirPods guidance), mic, noise and bleed, vocal range, tap and sing latency; a lenient first sung tonic (the tonic plays first; any sustained pitch within ±100¢ after octave folding passes). | V01 | — |

**U01 Pulse & Rhythm I** — 9 lessons + CP = 10 sessions (4/4 unless stated)

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U01.L01 | Heartbeat | Feel pulse and beat, set a tempo with `setcpm(bpm/4)`, learn that 1 cycle = 1 bar, write a one-line beat. | R01 R02 R03 E01 | — |
| U01.L02 | Count to Four | Find the downbeat, count 1-2-3-4, use rests as rhythm. | R06 | R03 |
| U01.L03 | Backbeat | Kick on 1 and 3, snare on 2 and 4; layer parts as one labelled line per drum (`kick:` `snare:` `hats:`). | R04 | — |
| U01.L04 | Two per Beat | Eighth-note subdivision and hat patterns with `[ ]`. | R05 | — |
| U01.L05 | Seeing Rhythm | Whole, half, quarter and eighth notes and rests on the percussion staff; lengths with `@` and `_`. | N01 | R06 |
| U01.L06 | Sixteenths & 1-e-&-a | Four per beat, spoken counting, tom fills. | R07 | — |
| U01.L07 | Four-Bar Phrases & Fills | Bar-level variation with `< >`; a fill in bar 4. | — | R04 R07 |
| U01.L08 | Three to a Bar | 3/4 waltz feel with `setcpm(bpm/3)`; meter as "beats per bar", with a 2/4 march (`setcpm(bpm/2)`) heard once as the contrast. | R08 | — |
| U01.L09 | Copy That Groove | Transcribe generated drum loops (ladder L1); half-time vs double-time with `.slow()`/`.fast()`; hear straight vs swung hats as a feel preview (swing stays locked). | — | E01 R05 |
| U01.CP | Rhythm I checkpoint | Checkpoint over U01. | — | — |

**U02 Pitch, Keyboard & Treble Staff** — 8 lessons + CP = 9 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U02.L01 | High & Low | Pitch and octaves; `note("c3 c4 c5").s("piano")` (the letters are explained in L02); higher/lower by ear. | P01 E02 | — |
| U02.L02 | The White Keys | Letter names, octave numbers, C4 = 60. | P02 P05 | — |
| U02.L03 | Half & Whole Steps | Semitone and tone, sharps and flats, enharmonics. | P03 P04 | — |
| U02.L04 | The Treble Staff | Lines, spaces, ledger lines; staff ↔ code ↔ keys. | N02 | — |
| U02.L05 | Moving Melodies | MIDI numbers, transposing by semitones, the chromatic scale. | P06 | P05 |
| U02.L06 | Tones & Timbres | The same tune on different sounds. | — | D01 |
| U02.L07 | Sing It Back | Pitch matching, higher/lower, 2–3-note echoes. | — | V01 E02 |
| U02.L08 | Playing from the Page | Staff → code on adult trad/PD tunes (Ode to Joy theme; When the Saints); a first room reverb. | D05 | N02 N01 |
| U02.CP | Pitch checkpoint | Checkpoint over U02. | — | — |

**U03 Major Scale & Degrees** — 11 lessons + CP = 12 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U03.L01 | Home & the Major Scale | Tonic as home, W-W-H-W-W-W-H, spelling a scale with each letter once, the scale on the staff; note names only, no `n()` yet. | S01 E03 | — |
| U03.L02 | Degrees in Code | `n` = degree − 1 with `.scale("C4:major")`; key as one parameter; first FET drill (1 vs 5, then 1-3-5); sing on numbers. | S02 E04 V02 | — |
| U03.L03 | Restless Neighbours | Degrees 2 and 4 and their pull home; negative and ≥7 `n` to reach below and above the tonic. | E05 V03 | S02 |
| U03.L04 | Leading Tone & Six | Degrees 6 and 7, the 7→1 pull; the `..` range. | — | E05 |
| U03.L05 | Same Song, Any Key | Key as a parameter; patterned `.scale("<…>")`. | S03 | — |
| U03.L06 | Sharp Keys | G D A E B F♯ and the order of sharps; key signatures on the staff. | S04 N03 | — |
| U03.L07 | Flat Keys & the Circle | F B♭ E♭ A♭ D♭ and the circle of fifths. | — | S04 N03 |
| U03.L08 | Solfège | Movable do; sing degree patterns on syllables. | — | V03 |
| U03.L09 | Tunes by Number | Write trad tunes as degrees and sight-sing them; phrasing with `.legato()`. | M01 V04 | — |
| U03.L10 | By-Ear Transcription I | Fragments, then adult trad/PD tunes by ear (Auld Lang Syne, Swing Low, Michael Row the Boat Ashore). | E07 | — |
| U03.L11 | Melody Workshop | An 8-bar melody that cadences on 1. | — | M01 S03 |
| U03.CP | Major-scale checkpoint | Checkpoint over U03. | — | — |

**U04 Intervals (compressed)** — 4 lessons + CP = 5 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U04.L01 | Steps Apart | Intervals inside a key: distance between degrees (2nd, 3rd … octave); two-voice riffs over the Band. | I01 E06 | — |
| U04.L02 | Major, Minor, Perfect | Interval quality from semitones; interval strings in `.transpose("3M")`. | I02 | — |
| U04.L03 | Together Now | Harmonic intervals, consonance and dissonance, the tritone; `,` inside mini-notation. | I05 I03 | — |
| U04.L04 | Interval Ear Lab | In-key pairs ascending, descending and harmonic, with passive-listen blocks. | — | E06 |
| U04.CP | Interval checkpoint | Checkpoint over U04. | — | — |

**U05 Triads** — 9 lessons + CP = 10 sessions (U05.L09 is taught directly after U05.L04: the rows are in teaching order)

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U05.L01 | Stacking Thirds | `n("[0,2,4]")`: root, 3rd, 5th. | C01 | — |
| U05.L02 | Major & Minor | Triad quality by intervals and by ear. | C02 E08 | — |
| U05.L03 | Diminished & Augmented | The two unstable triads; augmented and diminished interval names. | C03 | E08 I03 |
| U05.L04 | Arpeggios | `.arp()` on hand-stacked triads: a chord played one note at a time. | — | C01 |
| U05.L09 | Chord Names | Lead-sheet symbols C Cm C° C+ and their code spellings `C Cm Co Caug`, read and typed as answers and seen in read-only `preview` examples (`chord()` stays locked until L08). | N05 | — |
| U05.L05 | Inversions | First and second inversion; slash-chord names; the lowest note decides. | C04 | — |
| U05.L06 | Bass Clef & Grand Staff | Reading the low register. | N04 | — |
| U05.L07 | Voice Leading by Hand | Voice I–IV–V–I with note lists: common tones, nearest motion. Holds the gate check for `voicing()`. | C05 | — |
| U05.L08 | Let Strudel Voice It | Compare `chord().voicing()` with your hand voicing (unlocks only once the U05.L07 gate check is passed at ≥0.9). | — | C05 N05 |
| U05.CP | Triads checkpoint | Checkpoint over U05. | — | — |

**U06 Diatonic Harmony** — 13 lessons + CP = 14 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U06.L01 | The Seven Chords | Diatonic triads by stacking degrees on every step. | H01 | — |
| U06.L02 | Roman Numerals | I ii iii IV V vi vii° and the quality pattern. | N06 | H01 |
| U06.L03 | Home, Away, Tension | Tonic, predominant, dominant and the phrase model. | H02 | — |
| U06.L04 | Endings | Cadences: authentic (perfect and imperfect) and half. (Former L04 and L05 merged.) | H03 | — |
| U06.L05 | Hear the Bass First | Bass-degree dictation; sing the roots. | E09 V05 | — |
| U06.L06 | The Four-Chord Schema | I–V–vi–IV and its rotations; the deceptive move V→vi. | H04 | H03 |
| U06.L07 | Doo-Wop & Three-Chord Rock | I–vi–IV–V and I–IV–V; the plagal ending IV→I. | H05 | H03 |
| U06.L08 | Harmonic Rhythm | One vs two chords per bar. | H06 | — |
| U06.L09 | Chord Dictation Workshop | Bass → quality → Roman numeral on loops. | — | E09 |
| U06.L10 | Seventh Colour (preview) | Stack one more third, `n("[0,2,4,6]")`: an Imaj7–vi7–ii7–V7 neo-soul loop. Formal seventh-chord theory waits for U12. | C10 | — |
| U06.L11 | Slash Chords & Walking Down | The descending bass I–V⁶–vi (C–G/B–Am), line cliché, pedal; the bass track decides the inversion. | H15 | C04 |
| U06.L12 | Comping Patterns | Chord rhythms locked to the drums with `.struct()`. | — | H06 |
| U06.L13 | Parallel Chords | One chord shape moved by half steps: the deep-house colour that leaves the key on purpose. | — | H01 H06 |
| U06.CP | Diatonic checkpoint | Checkpoint over U06. | — | — |

**U07 Melody** — 11 lessons + CP = 12 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U07.L01 | Shape | Contour, range, steps vs leaps. | — | M01 |
| U07.L02 | Motif & Variation | Repetition, sequence, retrograde. | M02 | — |
| U07.L11 | Turn It Around | Transform a motif: upside down, backwards with its rhythm kept, rotated, moved in time. | — | M02 |
| U07.L03 | Landing on Chord Tones | Chord tones on strong beats. | M03 | — |
| U07.L04 | Passing & Neighbour Tones | Stepwise non-chord tones between and around chord tones. | M04 | — |
| U07.L05 | Leaning & Holding | Appoggiatura; 4–3 and 9–8 suspensions. | M05 | — |
| U07.L06 | Question & Answer | Antecedent and consequent phrases. | M06 F01 | — |
| U07.L07 | Call & Response | Echoes and answers between parts. | M07 | — |
| U07.L08 | Pickups | Anacrusis: leading rests in bar 0, `pickup` metadata, the pickup bar in notation. | M10 | — |
| U07.L09 | Reading Lead Sheets | Amazing Grace (New Britain): play and sing from a lead sheet in 3/4 with a pickup. | N07 | V04 M10 |
| U07.L10 | Hook Lab | Hooks and controlled chance. | M09 | — |
| U07.CP | Melody checkpoint | Checkpoint over U07. | — | — |

**U08 Bass Lines** — 6 lessons = 6 sessions (no checkpoint of its own; covered by U09.CP)

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U08.L01 | Roots Down Low | Root bass lines from the chords. | B01 | — |
| U08.L02 | Root–Five–Octave | The three-note bass vocabulary. | B02 | — |
| U08.L03 | Walking Up to It | Diatonic and chromatic approach tones. | B03 | — |
| U08.L04 | Lock with the Kick | Shared rhythm and syncopated bass; `const` pattern variables. | B04 | — |
| U08.L06 | Kick and Bass, One Line | The bass plays between the kicks, so kick and bass sound as one line. | — | B04 B01 |
| U08.L05 | Bass Dictation & Tone | Transcribe bass lines; shape the bass sound. | — | B01 V05 E09 |

**U09 Form** — 7 lessons + CP = 8 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U09.L01 | Phrases Make Sections | 4- and 8-bar units, hypermeter. | — | F01 |
| U09.L02 | Verse & Chorus | Contrast between sections; one `arrange()` per labelled track. | F02 | — |
| U09.L03 | AABA & Strophic | Two more song forms. | F03 | — |
| U09.L04 | The Energy Curve | Builds and drops with signals. | F05 | — |
| U09.L05 | Arranging in Code | Layer entries and exits with `.mask()`. | F06 | — |
| U09.L06 | Endings | End on purpose: parts leave in turn, a loop shrinks, a fade, a final hit or a cadence. | — | F06 F05 |
| U09.L07 | Carve It | Start from everything everywhere and only delete; leave a seam and one moment heard once. | — | F06 F05 |
| U09.CP | Bass & form checkpoint | Checkpoint over U08–U09. | — | — |

**U10 Minor** — 9 lessons + CP = 10 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U10.L01 | The Dark Twin | Natural minor, ♭3 ♭6 ♭7, do-based minor solfège. | S05 | — |
| U10.L02 | Relative & Parallel | Two ways a major key has a minor twin. | S06 | — |
| U10.L03 | Hearing Minor | Minor-degree drills. | E10 | — |
| U10.L04 | Minor-Key Chords | i ii° III iv v VI VII. | H07 | — |
| U10.L05 | The Aeolian Loop | i–VI–III–VII vs vi–IV–I–V. | H08 | — |
| U10.L06 | Raise the Seventh | Harmonic minor and the major V. | S07 H09 | — |
| U10.L07 | The Andalusian Cadence | i–VII–VI–V. | — | H09 |
| U10.L08 | Melodic Minor | Raised 6 and 7 on the way up. | S08 | — |
| U10.L09 | Minor Melodies | Wayfaring Stranger (trad) and Go Down Moses (spiritual): transcribe and sight-sing. | — | E07 V04 |
| U10.CP | Minor checkpoint | Checkpoint over U10. | — | — |

**U11 Pentatonic & Blues** — 8 lessons + CP = 9 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U11.L01 | Five Notes, No Wrong Ones | Major pentatonic. | S09 | — |
| U11.L02 | The Minor Pentatonic Riff | Minor pentatonic and a first riff. | S10 | — |
| U11.L03 | Blue Notes | The blues scale. | S11 | — |
| U11.L04 | The Dominant Seventh | The `C7` sound and symbol. | C06 | — |
| U11.L05 | Twelve Bars | The 12-bar form. | H10 F04 | — |
| U11.L06 | Quick Change & Turnaround | Two standard variations. | — | H10 |
| U11.L07 | Shuffle | Swung eighths, `swingBy(1/3, 4)`, swing notation. | R13 | — |
| U11.L08 | Riffs & Response | Riff writing and answering; a St. Louis Blues (1914) fragment. | M08 | M07 |
| U11.CP | Blues checkpoint | Checkpoint over U11. | — | — |

**U12 Seventh Chords** — 6 lessons = 6 sessions (no checkpoint of its own; covered by U13.CP)

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U12.L01 | Major 7 & Minor 7 | `C^7` and `Cm7`. | C07 | — |
| U12.L02 | Dominant vs Major 7 | Hear the difference a half step makes. | E11 | — |
| U12.L03 | Half-Diminished & Diminished 7 | `Cm7b5` and `Co7`. | — | C07 |
| U12.L04 | Diatonic Sevenths in Major | Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7. | C08 | — |
| U12.L05 | Sevenths in Minor & Guide-Tone Preview | Minor-key sevenths; 3rds and 7ths as the thread. | — | C08 |
| U12.L06 | Seventh Ear Lab & Left-Hand Voicings | Quality by ear; `dict("lefthand")`; interval inversion and compound intervals (moved here from U04). | I04 | E11 |

**U13 Rhythm II** — 6 lessons + CP = 7 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U13.L01 | Pushes & Anticipations | Syncopation by arriving early; `.early()` and `.late()`. | R10 | — |
| U13.L02 | Sixteenth Grooves & Ghost Notes | Dynamics inside the groove with `.velocity()`. | — | R10 |
| U13.L03 | Ties Across the Beat | Ties and dotted rhythms; notating syncopation. | R09 N08 | — |
| U13.L04 | Compound Meter | 6/8 and 12/8 with the dotted-quarter beat. | R11 | — |
| U13.L05 | Triplets | Tuplets in simple meter; `.ply()`. | R12 N09 | — |
| U13.L06 | Rhythm Dictation II | Syncopated, swung and compound rhythms by ear. | E14 | — |
| U13.CP | Sevenths & rhythm checkpoint | Checkpoint over U12–U13; opens the J and R tracks. | — | — |

**U14 Modes** — 6 lessons + CP = 7 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U14.L01 | Modes as Colours | The characteristic tone; Mixolydian ♭7. | S12 | — |
| U14.L02 | Mixolydian Rock | I–♭VII–IV; Old Joe Clark. | H11 | — |
| U14.L03 | Dorian ♮6 | i–IV; Drunken Sailor. | — | S12 H11 |
| U14.L04 | Lydian Glow | ♯4 and I–II. | S13 | — |
| U14.L05 | Phrygian Edge | ♭2 and i–♭II. | — | S13 |
| U14.L06 | Mode Lab | Mode identification and a modal vamp. | — | E10 |
| U14.CP | Modes checkpoint | Checkpoint over U14. | — | — |

**U15 Secondary Dominants** — 6 lessons = 6 sessions (no checkpoint of its own; covered by U17.CP)

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U15.L01 | Chromatic Degrees | ♯4 ♭7 ♯5 ♯1 ♭2 ♭3 ♭6 by ear and in code (`n("3#")` = ♯4, `n("6b")` = ♭7); chromatic solfège. | E12a | P06 |
| U15.L02 | Five of Five | V/V and V7/V. | H12 | — |
| U15.L03 | Visiting Other Chords | V/vi, V/ii, V7/IV. | — | H12 |
| U15.L04 | Tonicization | Applied vii°. | — | H12 |
| U15.L05 | Dominant Chains | III7–VI7–II7–V7 (Five Foot Two, Sweet Georgia Brown). | — | H12 |
| U15.L06 | Hearing Secondaries | Locate and name applied dominants by ear. | — | H12 E12a |

**U16 Borrowed Chords** — 5 lessons = 5 sessions (no checkpoint of its own; covered by U17.CP)

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U16.L01 | The Sad IV | iv in major. | H13 | — |
| U16.L02 | ♭VI & ♭VII | ♭VI–♭VII–I. | — | H13 |
| U16.L03 | ♭III & Minor Plagal | More colours from the parallel minor. | — | H13 |
| U16.L04 | Picardy & Dorian IV | Borrowing in minor keys. | — | H13 |
| U16.L05 | Mixture Lab | Reharmonize a folk tune; name secondary and borrowed chords by ear. | E12b | — |

**U17 Modulation** — 4 lessons + CP = 5 sessions

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| U17.L01 | Pivot Chords | Changing key through a shared chord. | H14 | — |
| U17.L02 | Truck-Driver & Direct Modulation | A key lift with a patterned `.scale("<C4:major!8 D4:major!8>")` on the track, placed after `arrange()` when the piece has sections (never `.transpose()`). | — | H14 |
| U17.L03 | Hearing Key Changes | Detect and locate modulations. | E13 | — |
| U17.L04 | Transcribing Through a Key Change | Generated pop; Body and Soul A→bridge. | — | E13 |
| U17.CP | Chromatic checkpoint | Checkpoint over U15–U17. | — | — |


### 2.4 Core capstones

A capstone opens when the checkpoint named in "Opens after" is passed or soft-passed (§7.6). Opening rules that add a condition are spelled out in the row; a capstone named there ("C2", "C5", "C7") means that capstone is released. `ebass` and `.lpf()` unlock when C1.S1 **starts** (§3.1 rule 12 covers a learner who puts C1 off). **A capstone never gates a lesson or a checkpoint** (§7.6): a learner may leave one open and carry on, and X1 in particular may stay closed for a while without holding anything else back.

| Session | Capstone | Opens after | Objective |
|---|---|---|---|
| C0.S1 | C0 Intro | U01.CP | A 4–8 bar drum intro: backbeat, 8th or 16th hats, a fill; first album track. |
| C1.S1 | C1 First Loop | U02.CP | A 4-bar loop: groove, note-name bass (ebass unlocks at the start), 2-bar riff. |
| C2.S1 | C2 Four-Chord Song | U07.CP | Chords: schema loop in bars 1–6, cadence in bars 7–8 ("loop, then land"). |
| C2.S2 | C2 Four-Chord Song | U07.CP | Melody over the changes; vary the bar-1 idea; release. |
| X1.S1 | X1 Folk Transcription | C2 + `fam.mel.dictation` level ≥ 4 | Phrases 1–2 of Aura Lee or Red River Valley, by ear, checked per phrase. |
| X1.S2 | X1 Folk Transcription | C2 + `fam.mel.dictation` level ≥ 4 | Phrases 3–4. |
| X1.S3 | X1 Folk Transcription | C2 + `fam.mel.dictation` level ≥ 4 | Chords bass-first, arrange, review, release. |
| C3.S1 | C3 Verse–Chorus Demo | U09.CP | Groove and changes for verse and chorus. |
| C3.S2 | C3 Verse–Chorus Demo | U09.CP | Melodies and section contrast. |
| C3.S3 | C3 Verse–Chorus Demo | U09.CP | Arrange V C V C; lead sheet. |
| C3.S4 | C3 Verse–Chorus Demo | U09.CP | Record the full take, review, release. |
| C4.S1 | C4 Minor Indie Ballad | U10.CP | Aeolian verse i–VI–III–VII. |
| C4.S2 | C4 Minor Indie Ballad | U10.CP | Chorus cadence with the major V; release. |
| C5.S1 | C5 12-Bar Shuffle | U11.CP | Changes, shuffle feel and riff. |
| C5.S2 | C5 12-Bar Shuffle | U11.CP | Second chorus, turnaround, call and response; release. |
| X2.S1 | X2 Blues Transcription | C5 | A pre-1930 12-bar blues from the repertoire (Careless Love; St. Louis Blues (1914) once a verified answer key exists): bass, then changes. |
| X2.S2 | X2 Blues Transcription | C5 | Melody, review, release. |
| C6.S1 | C6 Modal Vamp | U14.CP | Mixolydian or Dorian vamp and characteristic tone. |
| C6.S2 | C6 Modal Vamp | U14.CP | Melody, groove, release. |
| C7.S1 | C7 Chromatic Colour | U17.CP | Colour chords: a secondary dominant and ♭VI–♭VII–I. |
| C7.S2 | C7 Chromatic Colour | U17.CP | Melody and sections. |
| C7.S3 | C7 Chromatic Colour | U17.CP | Final-chorus key lift (≥8 bars), arrange, release. |
| CF-A.S1 | CF-A Core Finale: Album Single | C7 | Plan the form (verse, chorus, bridge) and groove. |
| CF-A.S2 | CF-A Core Finale: Album Single | C7 | Harmony with ≥4 devices. |
| CF-A.S3 | CF-A Core Finale: Album Single | C7 | Melody and bridge. |
| CF-A.S4 | CF-A Core Finale: Album Single | C7 | Arrange to ≥2:00, master, release. |
| CF-T.S1 | CF-T Core Finale: Standard Transcription | U15.L01 reached; runs in gym slots | Form map and bass of a public-domain standard (Five Foot Two, Ain't She Sweet or Bye Bye Blackbird). |
| CF-T.S2 | CF-T Core Finale: Standard Transcription | U15.L01 reached; runs in gym slots | Changes. |
| CF-T.S3 | CF-T Core Finale: Standard Transcription | U15.L01 reached; runs in gym slots | Melody. |
| CF-T.S4 | CF-T Core Finale: Standard Transcription | U15.L01 reached; runs in gym slots | Arrange, review, release. |


Repertoire limits for capstones: X1 uses Aura Lee (1861) or Red River Valley (trad). X2 uses the St. Louis Blues (1914) 12-bar strain or Careless Love (trad). CF-T is limited to three verified standards at v1: Five Foot Two (1925), Ain't She Sweet (1927), Bye Bye Blackbird (1926).

### 2.5 Transcription Gym (GYM.nn) and default order

**Slot rule.** From U07.L01 on, the planner counts completed core sessions since the last transcription session (a gym session, an `X#.S#` session or a `CF-T.S#` session). When the count reaches 4, the next session's New block is a transcription slot, with two exceptions: a capstone already in progress is never interrupted (the slot waits until its last session), and an `X#` session that is next anyway takes the slot. This is "every 5th session".

**What fills a slot.** If CF-T is open (U15.L01 reached) and unfinished, the slot is the next CF-T session. Otherwise it is a gym session, and it receives the next free ID `GYM.nn` when it starts. Odd-numbered gym sessions are **graded ladder** sessions at the learner's current ladder level and realism level (§6.12). Even-numbered gym sessions are **own-audio** sessions (self-assessed, "hum it, Oak drafts it" available); if the learner has no audio project, an even slot is a ladder session one realism level up.

**Counting.** A gym session is a full session in the plan and in the pace estimate (§9.6). In the default order the core has GYM.01–GYM.18. Gym IDs are ordinals of the learner's own history: a learner who takes an optional extra gym session from Today uses the next number, and later numbers shift for that learner only. In the advanced tracks the slot rule does not run; Today offers the gym once a week as an alternative chip, and those sessions also take the next `GYM.nn`.

**Default linear order of the core** (session number : ID). A checkpoint is placed after the next unit's L01 so it always falls on a later day than the unit's last lesson; the last checkpoint (U17.CP) follows a gym slot for the same reason. The planner follows this order unless the learner chooses otherwise.

```
1:U00.L01 2:U00.L02 3:U01.L01 4:U01.L02 5:U01.L03 6:U01.L04 7:U01.L05 8:U01.L06 9:U01.L07 10:U01.L08
11:U01.L09 12:U02.L01 13:U01.CP 14:C0.S1 15:U02.L02 16:U02.L03 17:U02.L04 18:U02.L05 19:U02.L06 20:U02.L07
21:U02.L08 22:U03.L01 23:U02.CP 24:C1.S1 25:U03.L02 26:U03.L03 27:U03.L04 28:U03.L05 29:U03.L06 30:U03.L07
31:U03.L08 32:U03.L09 33:U03.L10 34:U03.L11 35:U04.L01 36:U03.CP 37:U04.L02 38:U04.L03 39:U04.L04 40:U05.L01
41:U04.CP 42:U05.L02 43:U05.L03 44:U05.L04 45:U05.L09 46:U05.L05 47:U05.L06 48:U05.L07 49:U05.L08 50:U06.L01
51:U05.CP 52:U06.L02 53:U06.L03 54:U06.L04 55:U06.L05 56:U06.L06 57:U06.L07 58:U06.L08 59:U06.L09 60:U06.L10
61:U06.L11 62:U06.L12 63:U06.L13 64:U07.L01 65:U06.CP 66:U07.L02 67:U07.L11 68:GYM.01 69:U07.L03 70:U07.L04
71:U07.L05 72:U07.L06 73:GYM.02 74:U07.L07 75:U07.L08 76:U07.L09 77:U07.L10 78:GYM.03 79:U08.L01 80:U07.CP
81:C2.S1 82:C2.S2 83:X1.S1 84:X1.S2 85:X1.S3 86:U08.L02 87:U08.L03 88:U08.L04 89:U08.L06 90:GYM.04
91:U08.L05 92:U09.L01 93:U09.L02 94:U09.L03 95:GYM.05 96:U09.L04 97:U09.L05 98:U09.L06 99:U09.L07 100:GYM.06
101:U10.L01 102:U09.CP 103:C3.S1 104:C3.S2 105:C3.S3 106:C3.S4 107:GYM.07 108:U10.L02 109:U10.L03 110:U10.L04
111:U10.L05 112:GYM.08 113:U10.L06 114:U10.L07 115:U10.L08 116:U10.L09 117:GYM.09 118:U11.L01 119:U10.CP 120:C4.S1
121:C4.S2 122:GYM.10 123:U11.L02 124:U11.L03 125:U11.L04 126:U11.L05 127:GYM.11 128:U11.L06 129:U11.L07 130:U11.L08
131:U12.L01 132:GYM.12 133:U11.CP 134:C5.S1 135:C5.S2 136:X2.S1 137:X2.S2 138:U12.L02 139:U12.L03 140:U12.L04
141:U12.L05 142:GYM.13 143:U12.L06 144:U13.L01 145:U13.L02 146:U13.L03 147:GYM.14 148:U13.L04 149:U13.L05 150:U13.L06
151:U14.L01 152:GYM.15 153:U13.CP 154:U14.L02 155:U14.L03 156:U14.L04 157:GYM.16 158:U14.L05 159:U14.L06 160:U15.L01
161:U14.CP 162:CF-T.S1 163:C6.S1 164:C6.S2 165:U15.L02 166:U15.L03 167:CF-T.S2 168:U15.L04 169:U15.L05 170:U15.L06
171:U16.L01 172:CF-T.S3 173:U16.L02 174:U16.L03 175:U16.L04 176:U16.L05 177:CF-T.S4 178:U17.L01 179:U17.L02 180:U17.L03
181:U17.L04 182:GYM.17 183:U17.CP 184:C7.S1 185:C7.S2 186:C7.S3 187:GYM.18 188:CF-A.S1 189:CF-A.S2 190:CF-A.S3
191:CF-A.S4
```

Landmarks: first album track (C0) at session 14; first chords in the learner's own code (U05.L01) at session 40; first composed song (C2) released at session 82; J and R tracks open at session 153; core complete at session 191.

### 2.6 Advanced tracks

Each track opens at its gate and can interleave with U14–U17. Order inside a track is fixed (J2.L04 is the one lesson that can be passed over, §7.6); order between tracks is the learner's choice. Track checkpoints gate only the track capstones.

**Jazz Harmony** — 35 sessions. Gate: J1–J3 open after U13.CP; J2.L04 also needs U14.CP; J4 needs U15.L06; J5 needs U17.CP.

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| J1.L01 | Swing Feel & the Ride | The ride pattern and swung eighths on a jazz kit; feel first. | — | R13 |
| J1.L02 | Reading 7th-Chord Symbols | iReal ↔ lead-sheet ↔ jazz glyphs for seventh chords, sixths and sus (∆ – ø °). | J01 C09 | — |
| J1.L03 | The Major ii–V–I | ii7–V7–Imaj7 as one gesture. | J04 | — |
| J1.L04 | Guide-Tone Lines | Sing and write the 3rds and 7ths; `dict("guidetones")`. | J07 V06 | — |
| J1.L05 | Shells | Shell voicings; one chord pattern drives comping, bass and melody; you comp your own swinging ii–V–I. | J08 | — |
| J2.L01 | All Twelve Keys | ii–V–I around the cycle of fourths. | J05 | — |
| J2.L02 | Minor ii–V–i | iiø7–V7alt–i; ♭9, ♯9 and alt introduced in context. | J02 J06 | — |
| J2.L03 | Extensions | 9, 11, 13 and avoid notes. | — | J02 I04 |
| J2.L04 | Chord-Scales | Dorian, Mixolydian, Ionian, Lydian per chord (gated on U14.CP). | J03 | — |
| J.CP1 | Jazz checkpoint 1 | Checkpoint over J1 and J2.L01–L03. J2.L04 and its node J03 belong to J.CP2, so this checkpoint never waits for U14.CP. | — | — |
| JC1.S1 | Capstone: ii–V Ballad (1/2) | 16 bars over chained ii–Vs in at least 3 keys. | — | — |
| JC1.S2 | Capstone: ii–V Ballad (2/2) | Guide-tone melody; release. | — | — |
| J3.L01 | Rootless A/B Voicings | `mode("duck")` and `.offset()`. | J09 | — |
| J3.L05 | Fourths | Quartal voicings, and the bass decides the chord's name. | — | J09 |
| J3.L02 | Drop-2 & Spread | Wider voicings and where they sit. | — | J09 |
| J3.L03 | Comping Rhythms | Charleston and pushes. | — | H06 R10 |
| J3.L04 | Walking Bass | Four to the bar with approach tones. | B05 | — |
| J4.L01 | Turnarounds | I–vi–ii–V and iii–VI–ii–V. | J10 | — |
| J4.L02 | Jazz Blues in F | The jazz 12-bar. | J11 | — |
| J4.L03 | Rhythm Changes | The 32-bar AABA on I Got Rhythm. | J12 | — |
| J4.L04 | Reading a Standard | A public-domain head plus changes. | — | N07 J12 |
| JC2.S1 | Capstone: Jazz Blues in F (1/2) | Changes, shell comping and walking bass from one `chord()` pattern. | — | — |
| JC2.S2 | Capstone: Jazz Blues in F (2/2) | Original head over two choruses; release. | — | — |
| J5.L01 | Tritone Substitution | ♭II7 for V7. | J13 | — |
| J5.L02 | Backdoor | iv–♭VII7–I. | — | J13 |
| J5.L03 | Secondary ii–Vs & Diminished Passing Chords | Two reharmonization devices. | J14 | — |
| J5.L04 | Reharm Techniques | Putting the devices to work on a tune. | — | J14 |
| J5.L05 | Coltrane Changes | Enrichment; not gated and not in any checkpoint. | — | J14 |
| J.CP2 | Jazz checkpoint 2 | Checkpoint over J2.L04 and J3–J5. | — | — |
| JC3.S1 | Capstone: Rhythm-Changes Contrafact (1/3) | A sections in B♭. | — | — |
| JC3.S2 | Capstone: Rhythm-Changes Contrafact (2/3) | Bridge D7 G7 C7 F7. | — | — |
| JC3.S3 | Capstone: Rhythm-Changes Contrafact (3/3) | Arrange and release. | — | — |
| JC4.S1 | Capstone: Reharmonize a Standard (1/3) | Analyse Georgia on My Mind or Body and Soul (both 1930). | — | — |
| JC4.S2 | Capstone: Reharmonize a Standard (2/3) | Reharmonize with ≥3 devices; melody untouched. | — | — |
| JC4.S3 | Capstone: Reharmonize a Standard (3/3) | Voice-lead and release. | — | — |

**Advanced Rhythm** — 21 sessions. Gate: opens after U13.CP.

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| R1.L01 | Metric Weight | The syncopation hierarchy. | — | R10 |
| R1.L02 | Swing Ratios | 8th vs 16th swing; patterned swing amount. | — | R13 |
| R1.L03 | The One | 16th funk drums and ghost notes. | R14 | — |
| R1.L04 | Interlock | Bass, clav and guitar as one machine. | — | R14 B04 |
| R1.L06 | One Drummer, One Line | Linear drumming: no two drums at once, grouped 3+3+2. | — | R14 R10 |
| R1.L05 | Displacement & Laid-Back Feel | Shifted figures; microtiming with `.late()` (never `nudge`). | R15 | — |
| R2.L01 | Five & Seven | 5/4 and 7/8 groupings; odd-meter tempo lines. | R16 | — |
| R2.L02 | Odd Grooves | 7/8 and 9/8 (2+2+2+3). | — | R16 |
| R2.L03 | Hemiola | 6/8 ↔ 3/4. | R17 | — |
| R2.L04 | Polyrhythm 3:2, 4:3 | Two pulses at once. | — | R17 |
| R2.L05 | Polymeter & Implied Metric Modulation | `{ }%n`; metric modulation only as implied regrouping at a constant cycle (no tempo change). | — | R17 |
| R3.L01 | Tresillo & Cinquillo | E(3,8) and E(5,8) with `(k,n)`. | R18 | — |
| R3.L02 | Clave Direction | Son and rumba, 3-2 and 2-3, on the 2-bar 8th grid. | — | R18 |
| R3.L03 | Euclidean Rhythms & Rotation | `(k,n,r)`, `.euclid()`, `.euclidRot()`. | — | R18 |
| R3.L04 | Montuno & Tumbao Layering | Clave-aligned piano and bass. | — | R18 B04 |
| R3.L05 | Rhythm Master Lab | Mixed rhythm dictation. | — | E14 |
| R.CP | Rhythm checkpoint | Checkpoint over R1–R3. | — | — |
| RC1.S1 | Capstone: 16th-Note Funk (1/2) | Drums and bass pocket on a one-chord minor-seventh vamp (minor pentatonic; Dorian only once U14.L03 has unlocked it). | — | — |
| RC1.S2 | Capstone: 16th-Note Funk (2/2) | Clav and horn stabs on a `horns:` track (the `horns` sound unlocks at the start of this session if U15.L05 has not unlocked it yet); release. | — | — |
| RC2.S1 | Capstone: Clave & Polyrhythm (1/2) | Son clave 3-2 on the 2-bar 8th grid with tresillo bass. | — | — |
| RC2.S2 | Capstone: Clave & Polyrhythm (2/2) | A 3:2 layer and Euclidean percussion; release. | — | — |

**Arrangement & Sound** — 23 sessions. Gate: A1.L01–L04 open as optional side lessons once U03.L02 is done; A1.L05–L07 after U09.CP; A2 after U10.CP; AC1 after A.CP + U11.CP (its tunes need dominant sevenths and the 12-bar form; Sweet Georgia Brown is offered only once U15.L05 is done); AC2 after A.CP + J3.L04 + R1.L05.

| ID | Title | Objective | Introduces | Practises |
|---|---|---|---|---|
| A1.L01 | Waves & Harmonics | The harmonic series; see a wave in Oak's scope panel. | D02 | — |
| A1.L02 | Filters & Filter Envelopes | Cutoff, resonance and movement. | D03 | — |
| A1.L03 | Envelopes | Attack, decay, sustain, release. | D04 | — |
| A1.L04 | Space | Reverb size, delay time and feedback, orbits. | — | D05 |
| A1.L05 | Grit | Saturation and bit reduction. | D06 | — |
| A1.L06 | Movement | Vibrato, phaser and other modulation. | D07 | — |
| A1.L07 | FM & Supersaw | Two richer synth sources. | — | D07 |
| A2.L01 | Roles & Registers | Frequency space and why low thirds turn to mud; Oak's spectrum panel. | D08 | — |
| A2.L02 | Texture & Density | Thin vs thick. | D09 | F05 |
| A2.L08 | Peak First | Write the fullest section first, then make every other section by taking parts away. | — | D09 F05 F06 |
| A2.L09 | Seams and Surprises | Fills that anticipate or hesitate across a seam; an effect switched on once. | — | F06 D09 |
| A2.L03 | Counter-Melody & Re-Voicing per Section | A second line and section-specific voicings. | — | D09 M07 |
| A2.L07 | Hocket | One line split across two sounds, note by note. | — | D09 M07 |
| A2.L04 | Sampling | Chop Oak's CC0 `brk` break loop. | D11 | — |
| A2.L05 | Mix & Dynamics | Levels, compression, room for each part. | D10 | — |
| A2.L06 | Genre Translation | One idea in two idioms. | — | D09 F06 |
| A.CP | Sound & arrangement checkpoint | Checkpoint over A1–A2. | — | — |
| AC1.S1 | Capstone: One Tune, Two Genres (1/3) | St. Louis Blues (1914) or Sweet Georgia Brown (1925), version one. | — | — |
| AC1.S2 | Capstone: One Tune, Two Genres (2/3) | Version two in the other flavour. | — | — |
| AC1.S3 | Capstone: One Tune, Two Genres (3/3) | Compare, polish, release. | — | — |
| AC2.S1 | Capstone: Neo-Soul Ballad (1/3) | maj9/m11 changes and voicings (choir unlocks at the start). | — | — |
| AC2.S2 | Capstone: Neo-Soul Ballad (2/3) | Swung-16th groove with `.late()` feel; melody. | — | — |
| AC2.S3 | Capstone: Neo-Soul Ballad (3/3) | Mix and release. | — | — |


### 2.7 Session counts

| Unit | Lessons | CP | Capstone sessions | Sessions |
|---|---|---|---|---|
| U00 Onboarding | 2 | 0 | — | 2 |
| U01 Pulse & Rhythm I | 9 | 1 | C0 (1) | 11 |
| U02 Pitch, Keyboard & Treble Staff | 8 | 1 | C1 (1) | 10 |
| U03 Major Scale & Degrees | 11 | 1 | — | 12 |
| U04 Intervals (compressed) | 4 | 1 | — | 5 |
| U05 Triads | 9 | 1 | — | 10 |
| U06 Diatonic Harmony | 13 | 1 | — | 14 |
| U07 Melody | 11 | 1 | C2 (2), X1 (3) | 17 |
| U08 Bass Lines | 6 | 0 | — | 6 |
| U09 Form | 7 | 1 | C3 (4) | 12 |
| U10 Minor | 9 | 1 | C4 (2) | 12 |
| U11 Pentatonic & Blues | 8 | 1 | C5 (2), X2 (2) | 13 |
| U12 Seventh Chords | 6 | 0 | — | 6 |
| U13 Rhythm II | 6 | 1 | — | 7 |
| U14 Modes | 6 | 1 | C6 (2) | 9 |
| U15 Secondary Dominants | 6 | 0 | — | 6 |
| U16 Borrowed Chords | 5 | 0 | — | 5 |
| U17 Modulation | 4 | 1 | C7 (3), CF-A (4) | 12 |
| Transcription Gym (GYM.01–GYM.18) | — | — | — | 18 |
| CF-T in gym slots | — | — | CF-T (4) | 4 |
| **Core total** | **130** | **13** | **30** | **191** |
| Jazz Harmony | 23 | 2 | 10 | 35 |
| Advanced Rhythm | 16 | 1 | 4 | 21 |
| Arrangement & Sound | 16 | 1 | 6 | 23 |
| **Advanced total** | | | | **79** |
| **Grand total** | | | | **270** |

At 5 sessions a week the core takes about 38 weeks and the whole course about 54. The pace estimate on `/progress` is computed from measured session data, never from these numbers.

### 2.8 Repertoire by stage

Every song lives in `content/repertoire/<song-id>/song.ts` and must carry `{ title, year | 'trad', status: 'US-PD' | 'trad', provenance: { source, year, pages? }, verifiedBy, key, meter, pickup?, form, answerKey }`. `provenance.source` cites a score or collection published in 1930 or earlier; `verifiedBy` names the human who checked the answer key against it. Content CI rejects a song without both. Oak ships only its own Strudel renditions and lead sheets, never a recording and never lyrics of a non-PD text.

| Stage | Pool |
|---|---|
| U02–U03 reading, tunes by number, first by-ear work | Ode to Joy theme (1824), When the Saints Go Marching In (trad), Auld Lang Syne (trad), Swing Low, Sweet Chariot (spiritual), Michael, Row the Boat Ashore (trad), Down by the Riverside (trad), plus Oak-original hooks over four-chord Band backings. No nursery tunes. Before U13 a tune is used only in a fragment or setting that needs no ties or dots, and before U07.L08 only in one that needs no pickup (start at the first full bar; Auld Lang Syne and Michael, Row the Boat Ashore both begin with one). |
| Ladder L5 (PD folk), U07, X1 | Aura Lee (1861), Red River Valley (trad), Shenandoah (trad), Drunken Sailor (trad, Dorian; from U14), Amazing Grace (New Britain; U07.L09 reading only, never X1), Simple Gifts (1848), Oh! Susanna (1848) |
| U10 minor | Wayfaring Stranger (trad), Go Down Moses (spiritual), Joshua Fit the Battle (spiritual), Greensleeves (trad) |
| Ladder L6, U11, X2, U14, AC1 | St. Louis Blues (1914), Memphis Blues (1912), Careless Love (trad), Frankie and Johnny (trad), Old Joe Clark (trad, Mixolydian), The Entertainer A-strain (1902), Sweet Georgia Brown (1925) |
| U15–U17, CF-T, J track | Five Foot Two (1925), Ain't She Sweet (1927), Bye Bye Blackbird (1926) for CF-T; Body and Soul (1930), Georgia on My Mind (1930), I Got Rhythm (1930) for U17.L04, JC3, JC4; further standards (Blue Skies 1926, Ain't Misbehavin' 1929, Honeysuckle Rose 1929, On the Sunny Side of the Street 1930, Tea for Two 1924, Lady Be Good 1924) only when verified |

Never shipped: any composition first published after 1930, any modern arrangement of a trad tune (The Animals, Simon & Garfunkel), any recording. The learner's own audio stays in `~/.oak/audio` on the server side of the same machine; only code, events and the title the learner typed go to the tutor.

### 2.9 Ear-training stages and the transcription ladder

Ear stages A–H from the plan map onto drill families in §7.3. The transcription ladder is:

| Level | Material | Grading | First available |
|---|---|---|---|
| L1 | generated drum loops | onset F1, auto | U01.L09 (in-lesson), gym from GYM.01 |
| L2 | generated bass lines | auto | gym |
| L3 | generated four-chord loops, bass first | staged, auto | gym |
| L4 | generated short melodies | auto | gym |
| L5 | PD folk (pool above) | auto, per phrase | X1, gym |
| L6 | blues and standards ≤1930 | auto | X2, gym |
| L7 | the learner's own audio | self-assessed checklist | even gym slots |
| L8 | a full arrangement | auto on a PD standard (CF-T); self-assessed on own audio | CF-T |

L1–L4 are generated by code, never authored by hand. Ladder stimuli play through the Transcribe "pattern source" (hidden code in a hidden adapter instance), because v1 has no offline renderer.

## 3. The single unlock table (`content/toolbox.ts`)

### 3.1 Rules

1. `content/toolbox.ts` is the only place an unlock is declared. Each entry is `{ id, kind, code, unlock: { at: SessionId, when: 'complete' | 'start', condition? }, concept, preview?: string[], audible?: boolean, catalog: { signature, meaning, demo, strudelCc } }`. `lesson.ts` files do not declare unlocks; they are checked against this table. The UX Toolbox page, autocomplete, the lint, the tutor's catalog block and the architecture's sound catalog are all generated from it.
2. **When an unlock takes effect.** Inside the session that teaches a tool, the tool is usable from that session's first step: the lint context for a lesson is `unlocked ∪ unlocksOf(currentSession)`, so a Modify step can require the operator the lesson has just shown. The tool is **granted permanently** (autocomplete everywhere, Toolbox card, Studio without a hint, Coda ceremony) when the session is **completed** (the Make is saved). Rows marked "START" are granted permanently when the session starts.
3. **Unlocked** means: the tool is in autocomplete, has a Toolbox card with a demo, is accepted by the lint in graded steps, and the tutor may teach it and use it in cards.
4. **Locked** means: absent from autocomplete, shown as a silhouette in the Toolbox with its unlock condition, and
   - in a **graded step** (any exercise with a grader, Make steps and capstones included) its use is a lint **error** (`code.locked-tool`, `code.locked-sound`, `code.locked-scale`, `code.locked-chord`, `code.locked-mini`) and the check does not run. "Save anyway" still saves the sketch;
   - in **Studio** it is an **info hint** that never blocks; the code runs. A sketch saved with locked tools stores `flags.lockedTools: ToolId[]`, may still be promoted to a B-side, and its liner notes carry the line "Uses tools not yet unlocked: …";
   - in a **tutor card** the card is badged "preview" and is Preview-only (§10.7).
5. **Preview** is a context, not a per-tool state. A locked tool may appear only in: (a) the U00.L01 onboarding loop, (b) Band-layer code, including Oak's unit-song code (§5.11) and a learner's earlier takes replayed inside a song, (c) a lesson example flagged `preview: true`, which is always read-only and never the target of a graded step, (d) a tutor Preview card. The "Preview before unlock" column lists the planned previews. The learner can mute a preview line, never edit it (the one editable number in U00.L01 is the exception and is an `n` value, not a tool).
6. **The voicing gate (rows marked `*`).** `tb.chord`, `tb.voicing`, `tb.anchor`, `tb.mode.below`, `tb.dict.triads`, `chord.triad`, `snd.rhodes` and `snd.organ` unlock on completing U05.L08 **and** only if the exercise `U05.L07/hand-voiced-cadence` has a graded attempt with `score ≥ 0.9` and `assist.revealed = false`. Hint rungs 1–3 are allowed; retries are unlimited. The evidence is the learner's code only: no ear, singing or tapping result can affect it. If the condition is not yet met when U05.L08 starts, its first step is a regenerated variant of the gate check in another key, and U05.L08 cannot be completed until that passes at ≥0.9. Inside U05.L08 the gated tools become usable only once the condition is met (rule 2 does not apply before that). This is the only place a lesson step is a hard gate. No graded step before U05.L08 accepts `voicing()`.
7. **Audibility.** A row in group H (and every sound alias) may ship only if the S3 audibility harness marks it `audible: true`: render with and without the control through an `OfflineAudioContext`, assert an RMS or spectral difference. Rows marked † were flagged as unverified by the critique; if one fails, the row is deleted from `toolbox.ts` and its lesson teaches the remaining rows. Controls that are known silent no-ops in superdough are never taught and never unlock: `leslie`, `lrate`, `lsize`, `amp`, `squiz`, `triode`, `ring`.
8. `.nudge()` never unlocks. It leaves hap onsets unchanged (verified), so the grader cannot see it. It is accepted in Studio with the info hint `code.nudge-studio-only`, and it is a lint error in graded steps. Microtiming is taught with `.late()` (U13.L01, R1.L05, AC2), which moves onsets.
9. `.scope()` and `.fscope()` never draw on Strudel's canvas. The adapter routes both to Oak's scope/spectrum panel, fed by an analyser on the master bus; the grader stubs them to identity. Every other visual method (`pianoroll`, `punchcard`, `spiral`, `pitchwheel`, `_scope`, …) is stubbed to identity everywhere and is a lint error in authored content (STYLE §11).
10. Content CI proves, for every lesson, capstone and gym template: each tool, sound, scale name, chord family and mini operator used in a starter, solution, example or required rule is unlocked at or before that session **in every legal order** (§7.6 defines them; the default order alone is not enough for track lessons and side lessons), unless the example is `preview: true`. It also proves each ID has exactly one row and every session named in `unlock.at` exists.
11. **Alternative unlock sites.** A row may name two sessions ("U10.L09 or A1.L04") when a core lesson and a side or track lesson both need the tool. The tool is granted at whichever is completed first (started first, for a START site); the other session then teaches it without a ceremony. `unlock.at` is `SessionId | SessionId[]`. A session S may use a tool when one of the tool's sites is S itself or is guaranteed to precede S in every legal order.
12. **START rows and a capstone that is put off.** `snd.ebass` and `tb.lpf` are granted when C1.S1 starts. Because a capstone never gates a lesson (§7.6), a learner who has not started C1 when U03.L03 is completed is granted both at that moment, silently; C1 still shows the ceremony when it starts. So lessons up to U03.L03 never use them in learner code, and from U03.L04 on they are available in every legal order. `tb.feature.album` is granted when the learner's first capstone session of any capstone starts (C0.S1 in the default order). `snd.choir`, the `tb.template.*` rows and the `tb.feature.transcribe.*` modes are needed by no lesson and have no fallback. The three Transcribe modes are project templates for the learner's own audio; ladder levels, X1, X2 and CF-T always present the layers their stage needs, whatever is unlocked.

### 3.2 The table

**A. App features, panels and lenses**

| ID | Code form | Unlocks at | Justifying concept | Preview before unlock | Notes |
|---|---|---|---|---|---|
| `tb.feature.transport` | Play / Stop / Run (`Ctrl/Cmd+Enter`, `Ctrl/Cmd+.`) | U00.L01 | making sound | — |  |
| `tb.feature.roll` | Piano roll and drum lanes | U00.L01 | seeing the loop | — |  |
| `tb.feature.studio` | Studio (sketchbook, free play) | U00.L01 | Sketch 001 | — |  |
| `tb.feature.tutor` | Tutor panel | U00.L01 | ask about what you hear | — |  |
| `tb.feature.band` | Band layer (read-only backing; mute only) | U00.L01 | your part inside a song | — |  |
| `tb.feature.tuner` | Sing panel (PitchLane) | U00.L02 | first sung tonic | — |  |
| `tb.feature.staff` | Staff panel (percussion staff from U01.L05, treble from U02.L04) | U01.L05 | rhythm values on paper | — |  |
| `tb.feature.album` | Album | C0.S1 | first track | — | START of the first capstone session the learner begins (rule 12) |
| `tb.feature.degree-labels` | 1-based degree labels and colours on roll and staff | U03.L02 | scale degrees | — |  |
| `tb.feature.keysig` | Key-signature panel | U03.L06 | sharp keys | — |  |
| `tb.feature.circle` | Circle-of-fifths widget | U03.L07 | flat keys and the circle | — |  |
| `tb.feature.solfege` | Solfège label toggle | U03.L08 | movable do | — |  |
| `tb.feature.grand-staff` | Bass clef and grand staff | U05.L06 | low register on paper | — |  |
| `tb.feature.rn` | Roman-numeral overlay (chord band, RN under staff) | U06.L02 | Roman numerals | — |  |
| `tb.lens.function` | Lens: function bands (T / PD / D) | U06.L03 | harmonic function | — |  |
| `tb.lens.range` | Lens: range | U07.L01 | melodic range | — |  |
| `tb.lens.chord-tones` | Lens: chord-tone % | U07.L03 | chord tones on strong beats | — |  |
| `tb.feature.transcribe` | Transcribe (ladder pattern-source, melody mode, own audio, ±50¢ fine-tune, "hum it, Oak drafts it") | U07.L01 | transcription gym starts | — |  |
| `tb.feature.leadsheet` | Lead-sheet view and export | U07.L09 | reading lead sheets | — |  |
| `tb.lens.form` | Lens: form map | U09.L02 | sections | — |  |
| `tb.feature.transcribe.chords` | Transcribe: chords mode | C4.S1 | chords by ear in your own songs | — |  |
| `tb.feature.transcribe.bass` | Transcribe: bass mode | X2.S1 | bass first | — |  |
| `tb.feature.transcribe.full` | Transcribe: full-arrangement mode | CF-T.S1 | whole-song transcription | — |  |
| `tb.feature.jazz-glyphs` | Jazz-glyph chord display toggle (∆ – ø °) | J1.L02 | reading jazz charts | — |  |
| `tb.template.four-chord-pop` | Studio template "Four-chord pop" | C2.S2 | released C2 | — |  |
| `tb.template.12-bar-shuffle` | Studio template "12-bar shuffle" | C5.S2 | released C5 | — |  |
| `tb.template.dorian-funk-vamp` | Studio template "Dorian funk vamp" | C6.S2 | released C6 | — |  |
| `tb.template.jazz-blues-f` | Studio template "Jazz blues in F" | JC2.S2 | released JC2 | — |  |

**B. Core syntax, rhythm functions and mini-notation operators**

| ID | Code form | Unlocks at | Justifying concept | Preview before unlock | Notes |
|---|---|---|---|---|---|
| `tb.label` | lowercase track labels `name:` (label set in STYLE §2) | U00.L01 | each line is a musician | — |  |
| `tb.s` | `s("…")` / `sound("…")` | U01.L01 | pulse | U00.L01 |  |
| `tb.setcpm` | `setcpm(bpm/4)` | U01.L01 | tempo; 1 cycle = 1 bar | U00.L01 |  |
| `tb.mini.seq` | space-separated sequence | U01.L01 | equal slices of the bar | U00.L01 |  |
| `tb.mini.repeat` | `x*n` | U01.L01 | repeating inside a slot | U00.L01 |  |
| `tb.mini.rest` | `~` | U01.L02 | rests | U00.L01 |  |
| `tb.gain` | `.gain(x)` | U01.L02 | accenting the downbeat | U00.L01 |  |
| `tb.stack` | `stack(a, b)` | U01.L03 | layering | — | Investigate-only: shown once, never required; content layers with one labelled line per part |
| `tb.bank` | `.bank("RolandTR909")` | U01.L03 | drum-machine timbres | U00.L01 |  |
| `tb.mini.sub` | `[a b]` | U01.L04 | subdivision | U00.L01 |  |
| `tb.mini.elongate` | `x@n` | U01.L05 | note lengths | — |  |
| `tb.mini.hold` | `_` | U01.L05 | note lengths | — |  |
| `tb.mini.replicate` | `x!n` | U01.L06 | repeated cells | — |  |
| `tb.mini.alt` | `<a b>` | U01.L07 | bar-level variation, fills | U00.L01 |  |
| `tb.label.mute` | `_name:` (mute a line in code) | U01.L07 | trying a groove without a part | — | Studio convenience; in graded steps lint says "muted in code: the checker cannot hear it" (`code.muted-label`). The UI mute button never rewrites code |
| `tb.meter.3-4` | tempo line `setcpm(bpm/3)` | U01.L08 | 3/4 | — |  |
| `tb.meter.2-4` | tempo line `setcpm(bpm/2)` with `meter: '2/4'` | U01.L08 | meter as beats per bar | — | heard as a contrast in U01.L08; used by trad repertoire later |
| `tb.slow` | `.slow(n)` | U01.L09 | half-time feel | — |  |
| `tb.fast` | `.fast(n)` | U01.L09 | double-time feel | — |  |
| `tb.mini.stack` | `a, b` inside mini-notation (`"[c4,e4]"`, `"bd*2, hh*8"`) | U04.L03 | harmonic intervals, then chords | U00.L01 |  |
| `tb.struct` | `.struct("x ~ x x")` | U06.L12 | comping rhythm | — |  |
| `tb.lastOf` | `.lastOf(n, fn)` | U07.L06 | phrase-level answers | — |  |
| `tb.firstOf` | `.firstOf(n, fn)` | U07.L06 | phrase-level answers | — |  |
| `tb.off` | `.off(t, fn)` | U07.L07 | echoes, call and response | — |  |
| `tb.superimpose` | `.superimpose(fn)` | U07.L07 | doubling a line | — |  |
| `tb.mini.maybe` | `x?` | U07.L10 | controlled chance in hooks | — |  |
| `tb.degradeBy` | `.degradeBy(p)` | U07.L10 | controlled chance | — |  |
| `tb.sometimesBy` | `.sometimesBy(p, fn)` | U07.L10 | controlled chance | — |  |
| `tb.const` | `const name = pattern` | U08.L04 | bass and kick share one rhythm | — |  |
| `tb.arrange` | `arrange([bars, pat], …)`, one per labelled track | U09.L02 | sections and form | — |  |
| `tb.signal` | `sine` `saw` `perlin` | U09.L04 | energy curves | — |  |
| `tb.range` | `.range(lo, hi)` | U09.L04 | energy curves | — |  |
| `tb.segment` | `.segment(n)` | U09.L04 | stepping a curve | — |  |
| `tb.mask` | `.mask("<1 0>")` | U09.L05 | layer entries and exits | — |  |
| `tb.swingBy` | `.swingBy(1/3, beatsPerBar)` | U11.L07 | shuffle and swing | U01.L09 listen step; jazz-soul and funk Band from U03 |  |
| `tb.swing` | `.swing(beatsPerBar)` (= `swingBy(1/3, n)`) | U11.L07 | shuffle | — |  |
| `tb.early` | `.early(t)` | U13.L01 | anticipations | — |  |
| `tb.late` | `.late(t)` | U13.L01 | pushes; later, laid-back microtiming (R1.L05) | — |  |
| `tb.velocity` | `.velocity("1 .4")` | U13.L02 | ghost notes | — |  |
| `tb.meter.compound` | tempo lines `setcpm(bpm/2)` (6/8), `setcpm(bpm/3)` (9/8), `setcpm(bpm/4)` (12/8) | U13.L04 | compound meter | — |  |
| `tb.ply` | `.ply(n)` | U13.L05 | rolls, triplet repeats | — |  |
| `tb.swing.patterned` | patterned swing amount `.swingBy("<0 .1 .2 .33>", 4)` | R1.L02 | swing ratios | — |  |
| `tb.meter.odd` | tempo lines for 5/4, 5/8, 7/8, irregular 9/8 (STYLE §8) | R2.L01 | odd meters | — |  |
| `tb.mini.polymeter` | `{a b c}%n` | R2.L05 | polymeter | — |  |
| `tb.mini.euclid` | `x(k,n)` | R3.L01 | tresillo, cinquillo | — |  |
| `tb.mini.euclid-rot` | `x(k,n,r)` | R3.L03 | rotation | — |  |
| `tb.euclid` | `.euclid(k, n)` | R3.L03 | Euclidean rhythms | — |  |
| `tb.euclidRot` | `.euclidRot(k, n, r)` | R3.L03 | rotation | — |  |

**C. Pitch, scales and harmony functions**

| ID | Code form | Unlocks at | Justifying concept | Preview before unlock | Notes |
|---|---|---|---|---|---|
| `tb.note` | `note("…")` | U02.L01 | pitch | U00.L01 |  |
| `tb.note.names` | note names with octave (`c4 e4`) | U02.L01 | a pitch is written as a letter plus an octave number | — | U02.L01 uses C in several octaves; U02.L02 explains the seven letters and C4 = 60 |
| `tb.note.accidentals` | `#` and `b` in note names | U02.L03 | accidentals | — |  |
| `tb.transpose` | `.transpose(semitones)` | U02.L05 | semitone distance | — |  |
| `tb.note.midi` | numeric `note(60)` | U02.L05 | MIDI numbers | — |  |
| `tb.s.pitched` | `.s("…")` on pitched patterns | U02.L01 | an instrument plays the pitch (`.s("piano")`) | U00.L01 | choosing between instruments is U02.L06, where the synth waves unlock |
| `tb.n` | `n("…")` as scale index | U03.L02 | degrees: n = degree − 1 | U00.L01 (the one editable number) |  |
| `tb.scale` | `.scale("C4:major")` | U03.L02 | key as one parameter | U00.L01 |  |
| `tb.n.range` | negative and ≥7 `n` | U03.L03 | below and above the tonic | — |  |
| `tb.mini.range` | `a .. b` (with spaces) | U03.L04 | a run of the scale | — |  |
| `tb.scale.patterned` | patterned `.scale("<C4:major G4:major>")` | U03.L05 | key as a parameter; later, key changes (U17.L02) | — |  |
| `tb.legato` | `.legato(x)` | U03.L09 | phrasing | — | the same control as `.clip(x)` under its phrasing name (§0.20) |
| `tb.transpose.interval` | interval strings `.transpose("3M")` | U04.L02 | interval names | — |  |
| `tb.arp` | `.arp("0 1 2 1")` | U05.L04 | chord tones in time | — |  |
| `tb.feature.chord-symbols` | Chord-symbol labels (chord band and staff) | U05.L09 | chord names | — |  |
| `tb.chord` | `chord("<C Am F G>")` | U05.L08* | chord symbols as code | U00.L01; Band from U01 |  |
| `tb.voicing` | `.voicing()` | U05.L08* | automatic voice leading, after doing it by hand | U00.L01; Band from U01 |  |
| `tb.anchor` | `.anchor("c5")` | U05.L08* | where a voicing sits | — |  |
| `tb.mode.below` | `.mode("below")` (the default) | U05.L08* | top note at or below the anchor | — |  |
| `tb.dict.triads` | `.dict("triads")` | U05.L08* | three-note voicings | — | `C Cm Co` only: this dictionary voices `Caug` wrongly (§0.13) |
| `tb.add` | `.add(n("…"))` before `.scale()` | U06.L01 | stacking thirds on any degree | — |  |
| `tb.mode.root` | `.mode("root:g2")` | U06.L11 | root-position voicings with the root at or below a chosen note | — | §0.21 |
| `tb.rev` | `.rev()` | U07.L02 | retrograde | — |  |
| `tb.scaleTranspose` | `.scaleTranspose(steps)` after `.scale()` | U07.L02 | sequence | — |  |
| `tb.rootNotes` | `.rootNotes(2)` | U08.L01 | root bass lines from chords | — |  |
| `tb.dict.lefthand` | `.dict("lefthand")` | U12.L06 | left-hand piano voicings | — | rootless, with a 9th or 13th; `C69` is wrong in it (§0.14) |
| `tb.n.chromatic` | chromatic steps `n("3#")` `n("6b")` `n("2b")` `n("5b")` `n("1b")` | U15.L01 | chromatic degrees | — |  |
| `tb.dict.guidetones` | `.dict("guidetones")` | J1.L04 | 3rds and 7ths | — |  |
| `tb.set` | `.set(pattern)`, as in `n("0 1 2 3").set(chord(changes)).voicing()` | J1.L05 | one chord pattern drives every part | — |  |
| `tb.voicing.n` | `n("0 1 2 3").chord(changes).voicing()`: `n` first, to play single voices of the voicing | J1.L05 | shells and arpeggiated voicings | — | `.n()` after `.voicing()` does nothing (§0.15) |
| `tb.dict.ireal-ext` | `.dict("ireal-ext")` | J2.L03 | extended voicings | — |  |
| `tb.mode.duck` | `.mode("duck")` | J3.L01 | rootless voicings | — |  |
| `tb.offset` | `.offset(n)` | J3.L01 | A/B voicing positions | — |  |

**D. Scale names (the string argument of `.scale()`)**

| ID | Code form | Unlocks at | Justifying concept | Preview before unlock | Notes |
|---|---|---|---|---|---|
| `scale.major` | `X4:major` | U03.L02 | major scale | U00.L01 |  |
| `scale.minor` | `X4:minor` (alias `X4:aeolian`) | U10.L01 | natural minor | — |  |
| `scale.harmonic-minor` | `X4:harmonic:minor` | U10.L06 | raised 7 | — |  |
| `scale.melodic-minor` | `X4:melodic:minor` | U10.L08 | raised 6 and 7 | — |  |
| `scale.major-pentatonic` | `X4:major:pentatonic` | U11.L01 | five notes | — |  |
| `scale.minor-pentatonic` | `X4:minor:pentatonic` | U11.L02 | riffs | — |  |
| `scale.blues` | `X4:blues` | U11.L03 | blue notes | — |  |
| `scale.mixolydian` | `X4:mixolydian` | U14.L01 | ♭7 colour | — |  |
| `scale.dorian` | `X4:dorian` | U14.L03 | ♮6 colour | — |  |
| `scale.lydian` | `X4:lydian` | U14.L04 | ♯4 colour | — |  |
| `scale.phrygian` | `X4:phrygian` | U14.L05 | ♭2 colour | — |  |
| `scale.locrian` | `X4:locrian` | J2.L04 | chord-scale for m7♭5 | — |  |
| `scale.altered` | `X4:altered` | J2.L04 | chord-scale for 7alt | — |  |
| `scale.lydian-dominant` | `X4:lydian:dominant` | J2.L04 | chord-scale for 7♯11 | — |  |
| `scale.bebop` | `X4:bebop`, `X4:bebop:major` | J2.L04 | passing-tone scales | — |  |

**E. Chord-symbol families (tokens inside `chord("…")`)**

| ID | Code form | Unlocks at | Justifying concept | Preview before unlock | Notes |
|---|---|---|---|---|---|
| `chord.triad` | `C Cm Co Caug` | U05.L08* | triads | U00.L01; Band from U01 | dicts: ireal, ireal-ext, triads (`Caug`: ireal and ireal-ext only) |
| `chord.dom7` | `C7` | U11.L04 | dominant seventh | jazz-soul Band from U03 | dicts: ireal, ireal-ext, lefthand, guidetones |
| `chord.seventh` | `C^7 Cm7` | U12.L01 | major and minor sevenths | jazz-soul Band from U03 | same dicts as dom7 |
| `chord.seventh-dim` | `Cm7b5 Co7` | U12.L03 | half-diminished and diminished sevenths | — | same dicts as dom7 |
| `chord.sixth-sus` | `C6 Cm6 C69 Csus C7sus C2 Cadd9` | J1.L02 | sixths, sus and add chords | — | dict coverage varies: STYLE §5 table; `Csus C7sus C2 Cadd9` are ireal-only |
| `chord.alt` | `C7b9 C7#9 C7#11 C7b13 C7alt`, and the minor-major seventh `Cm^7` | J2.L02 | altered dominants; the tonic colours of the minor ii–V–i | — | `C7alt` is ireal-only; minor-major seventh is `Cm^7` in ireal and `CmM7` in lefthand and guidetones |
| `chord.ext` | `C^9 Cm9 C9 C13 Cm11` | J2.L03 | extensions | — | ireal / ireal-ext; `C^9 Cm9` also guidetones |

**F. Drum sounds and banks**

| ID | Code form | Unlocks at | Justifying concept | Preview before unlock | Notes |
|---|---|---|---|---|---|
| `snd.drum.bd` | `bd` kick | U01.L01 | pulse | U00.L01 |  |
| `snd.drum.sd` | `sd` snare | U01.L01 | pulse | U00.L01 |  |
| `snd.drum.hh` | `hh` closed hat | U01.L01 | pulse | U00.L01 |  |
| `snd.drum.cp` | `cp` clap | U01.L01 | pulse | — |  |
| `snd.drum.rim` | `rim` rimshot | U01.L01 | pulse | — |  |
| `snd.drum.oh` | `oh` open hat | U01.L02 | accents | — |  |
| `snd.drum.cr` | `cr` crash | U01.L02 | marking the downbeat | — |  |
| `snd.drum.rd` | `rd` ride | U01.L02 | a second timekeeper | — |  |
| `snd.bank.RolandTR909` | `.bank("RolandTR909")` | U01.L03 | drum-machine timbre | — |  |
| `snd.bank.RolandTR808` | `.bank("RolandTR808")` | U01.L03 | drum-machine timbre | U00.L01 |  |
| `snd.drum.lt` | `lt` low tom | U01.L06 | fills | — |  |
| `snd.drum.mt` | `mt` mid tom | U01.L06 | fills | — |  |
| `snd.drum.ht` | `ht` high tom | U01.L06 | fills | — |  |
| `snd.bank.LinnDrum` | `.bank("LinnDrum")` | U01.L09 | copying grooves | — |  |
| `snd.bank.AkaiLinn` | `.bank("AkaiLinn")` | U01.L09 | copying grooves | — |  |
| `snd.bank.RolandTR707` | `.bank("RolandTR707")` | U01.L09 | copying grooves | — |  |
| `snd.drum.sh` | `sh` shaker | U01.L09 | percussion colour | — |  |
| `snd.drum.cb` | `cb` cowbell | U01.L09 | percussion colour | — |  |
| `snd.drum.tb` | `tb` tambourine | U01.L09 | percussion colour | — |  |
| `snd.jazzkit` | `.bank("jazzkit")` (Oak kit: brushes, ride) | J1.L01 | swing feel | jazz-soul Band from U01 |  |
| `snd.brk` | `brk` (CC0 break loop rendered by Oak) | A2.L04 | sampling | — |  |
| `snd.oak909` | `.bank("oak909")` (Oak's synthesised 909-style machine, CC0) | U01.L03 | drum-machine timbre | — | sound pack v4; `.bank("RolandTR909")`, `"RolandTR707"` play it |
| `snd.oak808` | `.bank("oak808")` (Oak's synthesised 808-style machine, CC0) | U01.L03 | drum-machine timbre | — | sound pack v4; `.bank("RolandTR808")` plays it |
| `snd.rockkit` | `.bank("rockkit")` (Big Rusty Drums, CC0) | U01.L09 | copying grooves | — | sound pack v4; `.bank("LinnDrum")` plays it |
| `snd.lofikit` | `.bank("lofikit")` (Virtuosity Drums' lo-fi mic, CC0) | U01.L09 | copying grooves | — | sound pack v4; `.bank("AkaiLinn")` plays it |
| `snd.drum.clave` | `clave` claves | R3.L02 | clave direction | — | VCSL, CC0 |
| `snd.drum.conga` | `conga` conga | R3.L04 | the tumbao layer | — | VCSL, CC0 |
| `snd.drum.bongo` | `bongo` bongos | R3.L04 | the tumbao layer | — | VCSL, CC0 |
| `snd.breaks` | `brkfunk brkboombap brkjungle brkhouse brkjazz brklofi` (CC0 breaks rendered by Oak) | A2.L04 | choosing and fitting breaks | — | one row, several names; tempos in `/sounds/<v>/breaks.json` |
| `snd.foley` | `foley snap impact swoosh scratch drone` (CC0 one-shots) | A2.L04 | chopping one-shots | — | Sonic Pi's CC0 samples |
| `snd.sbd` | `sbd` (a synthesised kick) | A1.L03 | a kick is a falling sine | — | superdough built-in |
| `snd.textures` | `vinyl tape` | A1.L05 | lo-fi colour | — | Sonic Pi's vinyl hiss (CC0) and Oak's tape bed |

**G. Pitched instruments (Oak aliases) and synth waves**

| ID | Code form | Unlocks at | Justifying concept | Preview before unlock | Notes |
|---|---|---|---|---|---|
| `snd.piano` | `piano` (Salamander) | U02.L01 | pitch | U00.L01 |  |
| `snd.wave.sine` | `sine` | U02.L06 | timbre | — |  |
| `snd.wave.triangle` | `triangle` | U02.L06 | timbre | — |  |
| `snd.wave.square` | `square` | U02.L06 | timbre | — |  |
| `snd.wave.sawtooth` | `sawtooth` | U02.L06 | timbre | — |  |
| `snd.ebass` | `ebass` (gm_electric_bass_pick:0) | C1.S1 | a real bass for the first loop | U00.L01; Band from U01 | unlocks at the START of C1.S1; fallback grant on completing U03.L03 (rule 12) |
| `snd.acgtr` | `acgtr` (gm_acoustic_guitar_steel) | U03.L11 | folk melody colour | — |  |
| `snd.upright` | `upright` (D. Smolken's 1958 Otto Rubner double bass, pizzicato, CC0) | U05.L06 | bass register and bass clef | jazz-soul Band from U01 |  |
| `snd.rhodes` | `rhodes` (gm_epiano1; variant fixed in the listening pass) | U05.L08* | voiced chords | U00.L01; Band from U01 |  |
| `snd.organ` | `organ` (gm_drawbar_organ:0) | U05.L08* | voiced chords | — |  |
| `snd.pad` | `pad` (gm_pad_warm) | U06.L06 | sustained harmony for schemas | — |  |
| `snd.fingerbass` | `fingerbass` (gm_electric_bass_finger:0) | U08.L05 | bass tone | funk Band from U01 |  |
| `tb.template.synthbass` | recipe `note("…").s("sawtooth").lpf(600)` | U08.L05 | synth bass | — |  |
| `snd.strings` | `strings` (gm_string_ensemble_1:4) | U10.L09 | minor-ballad texture | — |  |
| `snd.crunch` | `crunch` (gm_overdriven_guitar:4) | U11.L03 | blues and rock riffs | — |  |
| `snd.jazzgtr` | `jazzgtr` (gm_electric_guitar_jazz:0) | U12.L06 | seventh-chord comping | — |  |
| `snd.cleangtr` | `cleangtr` (gm_electric_guitar_clean:5) | U13.L02 | 16th grooves | indie Band from U01 |  |
| `snd.horns` | `horns` (gm_brass_section:0) | U15.L05 or RC1.S2 | stabs on dominant chains; funk stabs | — | START at RC1.S2 (rule 11) |
| `snd.trumpet` | `trumpet` (gm_trumpet:0) | U15.L05 | lead line | — |  |
| `snd.tenor` | `tenor` (gm_tenor_sax:0) | U16.L05 | melody voice for mixture | — |  |
| `snd.vibes` | `vibes` (gm_vibraphone) | J1.L01 | swing | — |  |
| `snd.mutetpt` | `mutetpt` (gm_muted_trumpet) | J4.L02 | jazz-blues head | — |  |
| `snd.clav` | `clav` (gm_clavinet) | R1.L03 | funk | funk Band from U01 |  |
| `snd.choir` | `choir` (gm_choir_aahs:5) | AC2.S1 | neo-soul pad | — | unlocks at the START of AC2.S1 |
| `snd.wave.supersaw` | `supersaw` | A1.L07 | thick synth source | — |  |
| `snd.wave.pulse` | `pulse` | A1.L07 | pulse width | — |  |
| `snd.marimba` | `marimba` (VCSL, CC0) | A2.L06 | idiomatic timbres | — | sound pack v4 |
| `snd.kalimba` | `kalimba` (VCSL, CC0) | A2.L06 | idiomatic timbres | — | sound pack v4 |
| `snd.glockenspiel` | `glockenspiel` (VCSL, CC0) | A2.L06 | idiomatic timbres | — | sound pack v4 |
| `snd.noise` | `white pink brown crackle` | A1.L02 | noise is the clearest thing to filter | — | superdough built-ins; one row, several names |
| `snd.wt` | `wt_basic wt_organ wt_epiano wt_bass wt_fm wt_chip wt_voice wt_clav wt_morph wt_pwm wt_drawbar wt_fmsweep` | A1.L01 | a wave is one repeating cycle | — | AKWF single cycles (CC0) and Oak's morph tables |

**H. Effects and sound controls (every row must be `audible:true` in the S3 harness)**

| ID | Code form | Unlocks at | Justifying concept | Preview before unlock | Notes |
|---|---|---|---|---|---|
| `tb.room` | `.room(x)` | U02.L08 | the sound of a space | Band production defaults |  |
| `tb.clip` | `.clip(x)` | U02.L08 | short vs long notes | — |  |
| `tb.lpf` | `.lpf(hz)` (taught as the bass preset `.lpf(600)`) | C1.S1 or A1.L02 | a darker bass; filters | U00.L01; Band production defaults | unlocks at the START of C1.S1 together with `ebass`; fallback grant on completing U03.L03 (rule 12) |
| `tb.delay` | `.delay(x)` | U10.L09 or A1.L04 | echo for ballads; space | — | rule 11 |
| `tb.distort` | `.distort(x)` | U11.L03 or A1.L05 | grit for riffs | — | rule 11 |
| `tb.pan` | `.pan(x)` | U14.L06 or A2.L05 | stereo space; the mix | Band production defaults | rule 11 |
| `tb.jux` | `.jux(fn)` | U14.L06 | stereo doubling | — |  |
| `tb.scope` | `.scope()` → Oak scope panel (never Strudel's canvas) | A1.L01 | seeing a wave | — |  |
| `tb.partials` | `.partials([…])` † | A1.L01 | the harmonic series | — |  |
| `tb.hpf` | `.hpf(hz)` | A1.L02 | filters | — |  |
| `tb.bpf` | `.bpf(hz)` | A1.L02 | filters | — |  |
| `tb.lpq` | `.lpq(q)` | A1.L02 | resonance | — |  |
| `tb.lpenv` | `.lpenv(depth)` with `.lpa() .lpd() .lps() .lpr()` | A1.L02 | filter envelope | — |  |
| `tb.adsr` | `.attack() .decay() .sustain() .release()` | A1.L03 | envelopes | — |  |
| `tb.roomsize` | `.roomsize(x)` | A1.L04 | reverb size | — |  |
| `tb.delaytime` | `.delaytime(x)` | A1.L04 | delay time | — |  |
| `tb.delayfeedback` | `.delayfeedback(x)` | A1.L04 | delay repeats | — |  |
| `tb.orbit` | `.orbit(n)` | A1.L04 | separate effect buses | — |  |
| `tb.crush` | `.crush(bits)` | A1.L05 | bit reduction | — |  |
| `tb.coarse` | `.coarse(n)` | A1.L05 | sample-rate reduction | — |  |
| `tb.distorttype` | `.distorttype("…")` † | A1.L05 | saturation flavours | — |  |
| `tb.vib` | `.vib(hz)` and `.vibmod(depth)` | A1.L06 | vibrato | — |  |
| `tb.phaser` | `.phaser(speed)` | A1.L06 | phaser | — |  |
| `tb.tremolo` | `.tremolosync(n)` `.tremolodepth(x)` † | A1.L06 | tremolo | — | both exist as controls in core 1.2.6; audibility is S3's call |
| `tb.lpmod` | `.lprate()` `.lpdepth()` † | A1.L06 | filter LFO | — |  |
| `tb.fm` | `.fm(index)` and `.fmh(ratio)` | A1.L07 | FM | — |  |
| `tb.unison` | `.unison(n)` `.detune(x)` `.spread(x)` | A1.L07 | supersaw shaping | — |  |
| `tb.pw` | `.pw(x)` | A1.L07 | pulse width | — |  |
| `tb.fscope` | `.fscope()` → Oak spectrum panel | A2.L01 | frequency space | — |  |
| `tb.chop` | `.chop(n)` `.slice(n, pat)` `.splice(n, pat)` `.striate(n)` | A2.L04 | chopping | — |  |
| `tb.loopAt` | `.loopAt(bars)` | A2.L04 | fitting a loop to the bar | — |  |
| `tb.speed` | `.speed(x)` `.begin(x)` `.end(x)` | A2.L04 | sample playback | — |  |
| `tb.compressor` | `.compressor("…")` | A2.L05 | dynamics | — |  |
| `tb.postgain` | `.postgain(x)` | A2.L05 | level after effects | — |  |
| `tb.duck` | `.duckorbit(n)` `.duckdepth(x)` † | A2.L05 | sidechain feel | — |  |
| `tb.ftype` | `.ftype("ladder")` | A1.L02 | resonance: the ladder filter's squelch | — | sound pack v4 |
| `tb.penv` | `.penv(st)` `.pattack()` `.pdecay()` | A1.L03 | pitch envelope | — | sound pack v4 |
| `tb.drive` | `.drive(x)` | A1.L05 | saturation | — | sound pack v4; ladder filter only |
| `tb.density` | `.density(x)` | A1.L05 | crackle density | — | sound pack v4 |
| `tb.wt` | `.wt(x)` `.wtenv()` `.wtrate()` `.wtdepth()` | A1.L06 | timbre that moves | — | sound pack v4 |

Legend: `*` = behind the voicing gate (rule 6). † = audibility pending spike S3 (rule 7). "START" rows unlock when the session starts. "X or Y" = alternative sites (rule 11). Every control name in group H was checked to exist on `Pattern.prototype` in `@strudel/core` 1.2.6 (`partials`, `distorttype`, `tremolosync`, `tremolodepth`, `lprate`, `lpdepth`, `duckorbit`, `duckdepth` included); `scope`, `fscope` and `piano` do not exist in the grader realm and are stubbed there (§11.4).

Sound pack v4 (2026-11-24, `scripts/sounds/pack.config.ts`, `docs/design/samples/proposal.md`): `rhodes`, `upright`, `ebass`, `fingerbass`, `organ`, `cleangtr`, `jazzgtr`, `strings`, `trumpet`, `mutetpt`, `tenor` and `vibes` are now real CC0 or CC-BY recordings behind the same IDs and names (no unlock changed); `acgtr`, `crunch`, `horns`, `clav`, `pad` and `choir` stay General MIDI. The five `snd.bank.*` rows keep their names and unlocks, but the tidal-drum-machines samples are retired: each name plays the closest CC0 kit (RolandTR909 and RolandTR707 → `oak909`, RolandTR808 → `oak808`, LinnDrum → `rockkit`, AkaiLinn → `lofikit`). `snd.jazzkit` is rebuilt from Virtuosity Drums and Swirly Drums.

Curated soundfont variants and the mirror list follow curriculum §3 ("Curated gm_* set") with two additions already noted there (`gm_muted_trumpet`, `gm_electric_bass_finger:0`); `gm_electric_bass_finger:1` is never referenced (it 404s). The listening pass may replace a cheap-sounding GM patch behind an alias with a superdough synth patch; the alias ID does not change.

### 3.3 The toolbox-aware lint

One lint pass, `lintOak(code, ctx)` in `@oak/content-kit`, is used by the CM6 editor, both grader hosts, content CI and the tutor's card validator. `ctx = { profile, unlocked: Set<ToolId | SoundId | ScaleId | ChordFamilyId>, allowPreview, meter, key }`.

It walks, in this order:

1. **Syntax and safety** (acorn, ecma2022): the base safety profile for learner-typed code and the strict profile for code the learner did not type (§11.3).
2. **Call identifiers**: every callee and method name maps to a `tb.*` ID (`.voicing` → `tb.voicing`). An unknown name that exists in Strudel but not in the catalog is `code.uncatalogued` (warning in Studio, error in content).
3. **String arguments by callee**: `s`/`sound` → `snd.*` (each mini leaf); `bank` → `snd.bank.*`; `scale` → `scale.*` (each alternative of a patterned scale) plus the octave and spelling rules; `chord` → a chord family per symbol through `parseChordSymbol`, then a membership check against the `dict()` in the same chain (default `ireal`); `mode` → `tb.mode.*`; `dict` → `tb.dict.*`; `transpose` with a string → `tb.transpose.interval`.
4. **Mini-notation**: every double-quoted or backtick literal is parsed (`mini2ast`, falling back to the tokenizer) and each operator maps to a `tb.mini.*` ID. Chromatic step tokens (`3#`) map to `tb.n.chromatic`; `..` to `tb.mini.range`.
5. **Labels and tempo**: label set, `$:`, capital-S labels, `_name:`, missing or malformed tempo line (STYLE §2, §8).
6. **Dialect rules**: everything in STYLE §12 "Forbidden constructs".

Severity by profile:

| Profile | Locked tool | Dialect violation | Used for |
|---|---|---|---|
| `graded` | error | error or warning as listed in STYLE | lesson steps, Make, checkpoints, capstones |
| `studio` | info (never blocks) | info | Studio, Transcribe own-audio |
| `content` | error unless `preview: true` | error | content CI over authored code |
| `tutor-card` | marks the card "preview" | error (card is rejected and the model is told why) | `propose_code`, review `tryCode` |
| `band` | allowed | error | Band-layer code |

## 4. Skill graph (`content/skills.ts`)

### 4.1 Nodes and edges

143 live nodes in 8 regions. IDs, names and categories are the curriculum's; edges are re-cut so that no node is taught before its prerequisites. **Kind** drives the mastery model (§7.5): `fact`, `concept`, `perceptual`, `production`, `creative`. The exercises doc's fine-grained skills are categories under these nodes (`E05/deg.6`).

**Region 1 — Groove**

| ID | Name | Category | Kind | Prerequisites | Introduced | Change vs curriculum §2 |
|---|---|---|---|---|---|---|
| R01 | Pulse & beat | rhythm | production | — | U01.L01 |  |
| R02 | Tempo / BPM | rhythm | concept | R01 | U01.L01 |  |
| R03 | Meter 4/4, bar & downbeat | rhythm | concept | R01 | U01.L01 |  |
| R04 | Backbeat & layered groove | rhythm | concept | R03 | U01.L03 |  |
| R05 | Eighth subdivision | rhythm | concept | R03 | U01.L04 |  |
| R06 | Rests | rhythm | concept | R03 | U01.L02 | was ← R05; rests are taught in U01.L02, before eighths |
| R07 | Sixteenths & 1-e-&-a | rhythm | concept | R05 | U01.L06 |  |
| R08 | Triple meter 3/4 | rhythm | concept | R03 | U01.L08 |  |
| R09 | Ties & dotted rhythms | rhythm | concept | R06 | U13.L03 |  |
| R10 | Syncopation & anticipation | rhythm | concept | R07 | U13.L01 | was ← R07 R09; R09 is taught two lessons later (U13.L03) |
| R11 | Compound meter 6/8 12/8 | rhythm | concept | R08 R07 | U13.L04 |  |
| R12 | Triplets & tuplets | rhythm | concept | R11 | U13.L05 |  |
| R13 | Swing & shuffle | rhythm | concept | R05 R08 | U11.L07 | was ← R12; swing is taught in U11 as long–short eighths, U13 revisits the triplet basis |
| R14 | 16th funk & ghost notes | rhythm | concept | R10 | R1.L03 |  |
| R15 | Metric displacement | rhythm | concept | R10 | R1.L05 |  |
| R16 | Odd meters | rhythm | concept | R11 | R2.L01 |  |
| R17 | Hemiola, polyrhythm, polymeter | rhythm | concept | R12 R16 | R2.L03 |  |
| R18 | Clave, tresillo, Euclidean | rhythm | concept | R10 | R3.L01 |  |

**Region 2 — Pitch & Staff**

| ID | Name | Category | Kind | Prerequisites | Introduced | Change vs curriculum §2 |
|---|---|---|---|---|---|---|
| P01 | High/low & octave | pitch | concept | — | U02.L01 |  |
| P02 | Note names & keyboard | pitch | concept | P01 | U02.L02 |  |
| P03 | Half & whole steps | pitch | concept | P02 | U02.L03 |  |
| P04 | Accidentals & enharmonics | pitch | concept | P03 | U02.L03 |  |
| P05 | Octave numbers & MIDI, C4 = 60 | pitch | concept | P02 | U02.L02 |  |
| P06 | Chromatic scale & chromatic degrees | pitch | concept | P04 | U02.L05 |  |
| N01 | Rhythm values & rests | notation | concept | R05 | U01.L05 |  |
| N02 | Treble clef & ledger lines | notation | fact | P02 | U02.L04 |  |
| N03 | Key signatures on the staff | notation | fact | S04 N02 | U03.L06 |  |
| N04 | Bass clef & grand staff | notation | fact | N02 | U05.L06 |  |
| N05 | Chord symbols (lead sheet) | notation | fact | C03 | U05.L09 | lesson split out of U05.L04 in 1.6 |
| N06 | Roman numerals | notation | concept | H01 | U06.L02 |  |
| N07 | Lead sheets | notation | concept | N05 M03 | U07.L09 |  |
| N08 | Ties, dots & beaming | notation | concept | N01 R09 | U13.L03 | was "Ties, beaming, tuplets & meter notation" ← N01 R12; tuplets moved to N09 |
| N09 | Tuplet & compound-meter notation | notation | concept | N08 R12 | U13.L05 | NEW (split from N08), introduced at U13.L05 |

**Region 3 — Keys & Scales**

| ID | Name | Category | Kind | Prerequisites | Introduced | Change vs curriculum §2 |
|---|---|---|---|---|---|---|
| S01 | Major scale W-W-H-W-W-W-H | scales | concept | P03 | U03.L01 |  |
| S02 | Scale degrees & tonic (n = degree − 1) | scales | concept | S01 | U03.L02 |  |
| S03 | Keys as transposition | scales | concept | S02 | U03.L05 |  |
| S04 | Key signatures & circle of fifths | scales | fact | S03 P04 | U03.L06 |  |
| S05 | Natural minor | scales | concept | S02 | U10.L01 |  |
| S06 | Relative & parallel keys | scales | concept | S05 S04 | U10.L02 |  |
| S07 | Harmonic minor | scales | concept | S05 | U10.L06 |  |
| S08 | Melodic minor | scales | concept | S07 | U10.L08 |  |
| S09 | Major pentatonic | scales | concept | S02 | U11.L01 |  |
| S10 | Minor pentatonic | scales | concept | S09 S05 | U11.L02 |  |
| S11 | Blues scale & blue notes | scales | concept | S10 | U11.L03 |  |
| S12 | Mixolydian & Dorian | scales | concept | S05 S06 | U14.L01 |  |
| S13 | Lydian & Phrygian | scales | concept | S12 | U14.L04 |  |
| I01 | Generic intervals (in a key) | intervals | concept | S02 | U04.L01 |  |
| I02 | Interval quality M/m/P | intervals | concept | I01 P03 | U04.L02 |  |
| I03 | Tritone, augmented & diminished | intervals | concept | I02 | U04.L03 |  |
| I04 | Inversion & compound intervals | intervals | concept | I02 | U12.L06 | unchanged edge; lesson moved from U04 to U12.L06 |
| I05 | Consonance & dissonance | intervals | concept | I02 | U04.L03 |  |

**Region 4 — Chords & Harmony**

| ID | Name | Category | Kind | Prerequisites | Introduced | Change vs curriculum §2 |
|---|---|---|---|---|---|---|
| C01 | Triads by thirds | chords | concept | I01 | U05.L01 |  |
| C02 | Major vs minor triad | chords | concept | C01 I02 | U05.L02 |  |
| C03 | Diminished & augmented | chords | concept | C02 I03 | U05.L03 |  |
| C04 | Inversions & slash chords | chords | concept | C02 | U05.L05 |  |
| C05 | Voice leading by hand | chords | concept | C04 | U05.L07 |  |
| C06 | Dominant 7th | chords | concept | C02 | U11.L04 |  |
| C07 | Seventh family maj7 m7 ø7 °7 | chords | concept | C06 | U12.L01 |  |
| C08 | Diatonic sevenths | chords | concept | C07 H01 | U12.L04 |  |
| C09 | Sus & add chords | chords | concept | C02 | J1.L02 | now has a lesson: J1.L02 |
| C10 | Seventh colour (one more third) | chords | concept | H01 | U06.L10 | NEW, for the U06.L10 preview lesson |
| H01 | Diatonic triads & RN | harmony | concept | C03 S02 | U06.L01 |  |
| H02 | Function T/PD/D | harmony | concept | H01 | U06.L03 |  |
| H03 | Cadences | harmony | concept | H02 | U06.L04 |  |
| H04 | Four-chord schema family | harmony | concept | H01 | U06.L06 |  |
| H05 | Doo-wop & three-chord schemas | harmony | concept | H04 | U06.L07 |  |
| H06 | Harmonic rhythm & comping | harmony | concept | H01 R03 | U06.L08 |  |
| H07 | Minor-key harmony | harmony | concept | H01 S05 | U10.L04 |  |
| H08 | Aeolian schema i–VI–III–VII | harmony | concept | H07 | U10.L05 |  |
| H09 | Harmonic-minor V & Andalusian | harmony | concept | H07 S07 | U10.L06 |  |
| H10 | 12-bar blues & turnaround | harmony | concept | C06 H03 | U11.L05 |  |
| H11 | Modal harmony (♭VII, I–♭VII–IV, i–IV) | harmony | concept | S12 H07 | U14.L02 |  |
| H12 | Secondary dominants & tonicization | harmony | concept | H03 C06 P06 | U15.L02 |  |
| H13 | Borrowed chords | harmony | concept | H07 H03 | U16.L01 |  |
| H14 | Modulation | harmony | concept | H12 | U17.L01 |  |
| H15 | Pedal, line cliché, descending bass | harmony | concept | C04 H04 | U06.L11 |  |
| B01 | Root bass lines | harmony | concept | H01 | U08.L01 |  |
| B02 | Root–5th–octave | harmony | concept | B01 I02 | U08.L02 |  |
| B03 | Approach & passing tones | harmony | concept | B02 M04 | U08.L03 |  |
| B04 | Bass–kick lock, syncopated bass | harmony | concept | B01 R07 | U08.L04 |  |
| B05 | Walking bass | harmony | concept | B03 C07 | J3.L04 |  |

**Region 5 — Melody & Form**

| ID | Name | Category | Kind | Prerequisites | Introduced | Change vs curriculum §2 |
|---|---|---|---|---|---|---|
| M01 | Contour, range, steps & leaps | melody | creative | S02 | U03.L09 |  |
| M02 | Motif & variation | melody | creative | M01 | U07.L02 |  |
| M03 | Chord tones on strong beats | melody | concept | M01 C02 | U07.L03 |  |
| M04 | Passing & neighbour tones | melody | concept | M03 | U07.L04 |  |
| M05 | Appoggiatura & suspension | melody | concept | M04 | U07.L05 |  |
| M06 | Antecedent / consequent | melody | creative | M03 H03 | U07.L06 |  |
| M07 | Call & response | melody | creative | M06 | U07.L07 |  |
| M08 | Riffs & blues melody | melody | creative | S10 M02 | U11.L08 | was ← S11 M02; now introduced at U11.L08 only |
| M09 | Hook writing | melody | creative | M06 M02 | U07.L10 |  |
| M10 | Pickups (anacrusis) | melody | concept | M06 R06 | U07.L08 | NEW, for the U07.L08 pickup lesson |
| F01 | Phrase, section, hypermeter | form | concept | R03 M06 | U07.L06 |  |
| F02 | Verse–chorus | form | creative | F01 | U09.L02 |  |
| F03 | AABA & strophic | form | concept | F01 | U09.L03 |  |
| F04 | 12-bar form | form | concept | F01 H10 | U11.L05 |  |
| F05 | Energy curve & contrast | form | creative | F02 | U09.L04 |  |
| F06 | Arranging sections in code | form | creative | F05 | U09.L05 |  |

**Region 6 — Ears & Voice**

| ID | Name | Category | Kind | Prerequisites | Introduced | Change vs curriculum §2 |
|---|---|---|---|---|---|---|
| E01 | Tap & rhythm echo | ear | production | R01 | U01.L01 |  |
| E02 | Pitch match & higher/lower | ear | perceptual | P01 | U02.L01 |  |
| E03 | Find the tonic | ear | perceptual | S01 | U03.L01 | was ← S02; "tonic" now arrives in U03.L01, one lesson before degrees |
| E04 | Degrees 1-3-5 | ear | perceptual | E03 S02 | U03.L02 |  |
| E05 | All diatonic degrees | ear | perceptual | E04 | U03.L03 |  |
| E06 | Intervals in a key (and isolated) | ear | perceptual | E05 I01 | U04.L01 | was ← E05 I02; in-key interval hearing starts in U04.L01 |
| E07 | Melodic dictation | ear | perceptual | E05 R05 | U03.L10 |  |
| E08 | Triad quality | ear | perceptual | C02 | U05.L02 | was ← C03; major/minor quality is heard in U05.L02, before dim/aug |
| E09 | Bass-degree & schema dictation | ear | perceptual | E05 H01 | U06.L05 | was ← E05 H04 |
| E10 | Minor & modal degrees | ear | perceptual | E05 S05 | U10.L03 |  |
| E11 | Seventh-chord quality | ear | perceptual | C07 E08 | U12.L02 |  |
| E12a | Chromatic degrees by ear | ear | perceptual | P06 E05 | U15.L01 | NEW: E12 split (E12 is retired) |
| E12b | Secondary & borrowed chord ID | ear | perceptual | H12 H13 | U16.L05 | NEW: E12 split; introduced at U16.L05 |
| E13 | Modulation detection | ear | perceptual | H14 E12b | U17.L03 | was ← H14 E12 |
| E14 | Rhythmic dictation (sync/swing/compound) | ear | perceptual | R10 R12 E01 | U13.L06 |  |
| V01 | Sustain & match a pitch | voice | production | — | U00.L02 | was ← E02; it is the root of the voice chain (U00.L02) |
| V02 | Sing the tonic after a cadence | voice | production | E03 V01 | U03.L02 |  |
| V03 | Sing degrees (numbers, then solfège) | voice | production | V02 E04 | U03.L03 |  |
| V04 | Sight-sing from staff | voice | production | V03 N02 | U03.L09 |  |
| V05 | Sing bass lines | voice | production | V03 H01 | U06.L05 | was ← V03 B01 |
| V06 | Sing guide-tone lines | voice | production | V03 J07 | J1.L04 |  |

**Region 7 — Jazz**

| ID | Name | Category | Kind | Prerequisites | Introduced | Change vs curriculum §2 |
|---|---|---|---|---|---|---|
| J01 | Jazz symbols iReal ↔ lead sheet | jazz | fact | C07 N05 | J1.L02 |  |
| J02 | Extensions & alterations | jazz | concept | J01 | J2.L02 |  |
| J03 | Chord-scale basics | jazz | concept | J02 S12 | J2.L04 | edge unchanged; its lesson J2.L04 is gated on U14.CP |
| J04 | Major ii–V–I | jazz | concept | C08 H02 | J1.L03 |  |
| J05 | ii–V–I in all keys | jazz | concept | J04 S04 | J2.L01 |  |
| J06 | Minor iiø–V7alt–i | jazz | concept | J04 J02 S07 | J2.L02 |  |
| J07 | Guide-tone lines | jazz | concept | J04 | J1.L04 |  |
| J08 | Shell voicings | jazz | concept | J07 | J1.L05 |  |
| J09 | Rootless & drop-2 | jazz | concept | J08 J02 | J3.L01 |  |
| J10 | Turnarounds | jazz | concept | J04 H12 | J4.L01 |  |
| J11 | Jazz blues | jazz | concept | H10 J04 | J4.L02 |  |
| J12 | Rhythm changes | jazz | concept | J10 F03 | J4.L03 |  |
| J13 | Tritone sub & backdoor | jazz | concept | J10 I03 | J5.L01 |  |
| J14 | Reharmonization | jazz | creative | J13 H13 | J5.L03 |  |

**Region 8 — Sound**

| ID | Name | Category | Kind | Prerequisites | Introduced | Change vs curriculum §2 |
|---|---|---|---|---|---|---|
| D01 | Timbre & palette | sound | concept | — | U00.L01 |  |
| D02 | Oscillators & harmonics | sound | concept | D01 | A1.L01 |  |
| D03 | Filters & filter envelope | sound | concept | D02 | A1.L02 |  |
| D04 | ADSR | sound | concept | D02 | A1.L03 |  |
| D05 | Reverb & delay | sound | concept | D01 | U02.L08 |  |
| D06 | Saturation & distortion | sound | concept | D02 | A1.L05 |  |
| D07 | Modulation (vibrato, phaser, FM) | sound | concept | D03 D04 | A1.L06 |  |
| D08 | Roles & frequency space | sound | concept | D01 C05 | A2.L01 |  |
| D09 | Texture, density, counter-melody, genre re-arrangement | sound | creative | D08 M07 F06 | A2.L02 |  |
| D10 | Mix & dynamics | sound | concept | D05 | A2.L05 |  |
| D11 | Sampling & chopping | sound | concept | D01 | A2.L04 |  |


Retired: `E12`. Rendering order of regions on the map: Groove → Pitch & Staff → Keys & Scales → Chords & Harmony → Melody & Form → Ears & Voice → Jazz / Sound. At v1 the map renders `content/.generated/skill-graph.json` as a plain graph; the illustrated tree arrives in W7.

### 4.2 What an edge means

1. **Ordering (CI).** For every node N introduced by lesson L, every prerequisite of N is introduced either in a lesson that is guaranteed to come before L in every legal order (§7.6: linear core, track gates of §4.3), or earlier in L's own ordered `introduces` list. Same-lesson prerequisites are allowed because lessons teach in chains (U01.L01 introduces R01 → R02 → R03). CI fails on any violation, on a node that no lesson introduces, and on a node introduced twice.
2. **Availability.** A node is `available` exactly when its introducing lesson is open. Prerequisite mastery never locks a node or a lesson; lesson gating (§7.6) is the only gate.
3. **Planner hints.** When a node is weak (`debt`, or strength M < 0.6), its prerequisites get a small boost in warm-up selection.
4. **Map drawing.** Edges inside a region are solid; edges between regions are dashed.

### 4.3 Track gates that the edges rely on

| Gate | Opens |
|---|---|
| U03.L02 completed | A1.L01–L04 (optional side lessons) |
| U09.CP | A1.L05–L07 |
| U10.CP | A2 |
| U13.CP | J1, J2.L01–L03, J3, R1–R3 |
| U14.CP | J2.L04 (chord-scales; J03 ← S12) |
| U15.L06 completed | J4 (J10 ← H12) |
| U17.CP | J5 (J14 ← H13) |
| J.CP1 | JC1 |
| R.CP | RC1, RC2 |
| A.CP + U11.CP | AC1 (Sweet Georgia Brown as its tune also needs U15.L05) |
| A.CP + J3.L04 + R1.L05 | AC2 |
| J4.L04 completed | JC2 |
| J.CP2 | JC3, JC4 |

## 5. Content schema decision

### 5.1 Decision

The canonical contract is **exercises.md §2** (authoring schema and result types), amended as shown below, implemented once in `packages/content-kit/src/schema/` and re-exported through `@oak/api`. Everything else that looks like a lesson, check or result schema in the other three docs is deleted (§5.9).

Types **kept unchanged** from exercises §2: `Rat`, `Md`, `CodeRange`, `DrumRole`, `Layer`, `ChordQuality`, `PitchMode`, `Role`, `SrsLink`, `Stimulus`, `Cue`, `Choice`, `Answer`, `PartialMap`, `CodeSpec`, `Reference`, `MiniOp`, `TapTolerance`, `InvestigateQ`, `TargetSelector`, `BlankSpec`, `ParsonsBlock`, `StaffExpect`, `SingMode`, `SingTarget`, `DictationStage`, `TestResponse`, `Dimension`, `DimScore`, `Loc`, `Diagnostic`, `AnalysisSummary`, `CadenceType`, `PitchSource`, and the 18 exercise kinds `PredictEx`, `RunInvestigateEx`, `CodeModifyEx`, `CodeFillEx`, `ParsonsEx`, `ErrorHuntEx`, `CodeMakeEx`, `IdentifyEx`, `FactEx`, `KeyboardEx`, `StaffReadEx`, `StaffWriteEx`, `TapEx`, `SingEx`, `DictationEx`, `TranscribeStepEx`, `ComposeBriefEx`, `ListenEx`. From §4.1: `LevelParams`, `DrillFamily`, `Trial`, `TrialResult`, `FactDeck`. From §3: every matcher and analyzer signature, and the feedback catalog of §2.6.

Types **amended**: ID aliases, `Degree`, `MeterSpec`, `TrackRef`, `SkillWeight`, `ExBase`, `Hint`, `TutorPolicy`, `AnswerUi`, `Matcher`, `AstConstraint`, `SingTolerance`, `RubricRule`, `NEvent`, `GradeResult`, `TestCase`, `LearnerProfile`. Types **added**: `HintLadder`, `ParamGen`, `ParamRef`, `SwingSpec`, `PickupSpec`, `AllEx`, `LessonDef`, `StepDef`, `StepKind`, `StepUi`, `TermDef`, `BandRef`, `SectionRef`.

A kind or a rubric rule may sit in the schema before it is implemented. `packages/content-kit/src/implemented.ts` lists what the current wave supports, and content CI rejects a lesson that uses anything outside it. Rubric rules are implemented when the first capstone that needs them is authored.

### 5.2 Common types (`schema/common.ts`)

```ts
import type { LessonId, CapstoneId, SkillId, FamilyId, DeckId, ToolId, SoundId, ScaleId, ChordFamilyId,
  CanDoId, FeedbackId, TermId, SongId, FlavourId, BandId } from '../../../content/.generated/ids';

export type Rat = readonly [n: number, d: number];          // reduced, d > 0, unit = cycles = bars
export type Md = string;                                    // markdown with Oak inline components
export type CodeRange = { from: number; to: number };       // offsets into the CLEAN code (markers stripped)
export type Degree = '1'|'#1'|'b2'|'2'|'#2'|'b3'|'3'|'4'|'#4'|'b5'|'5'|'#5'|'b6'|'6'|'#6'|'b7'|'7';
export type ScaleMode = 'major'|'minor'|'harmonic minor'|'melodic minor'|'dorian'|'phrygian'|'lydian'
  |'mixolydian'|'locrian'|'major pentatonic'|'minor pentatonic'|'blues';
export interface KeySpec { tonic: string; mode: ScaleMode }  // tonic spelled: 'Eb', 'F#'
export type MeterId = '4/4'|'3/4'|'2/4'|'6/8'|'9/8'|'12/8'|'5/4'|'5/8'|'7/8'|'9/8i';   // table in §6.9
export type TempoUnit = 'quarter'|'dottedQuarter'|'eighth';
export interface MeterSpec { id: MeterId; num: number; den: 4|8; tempoUnit: TempoUnit; unitsPerBar: number; grouping: number[] }
export interface SwingSpec { subdivision: 8|16; amount: number }       // amount = the swingBy amount, 1/3 = triplet swing
export interface PickupSpec { units: Rat }                             // pickup length in tempo units; lives in bar 0
export type DrumRole = 'kick'|'snare'|'clap'|'rim'|'hatClosed'|'hatOpen'|'tom'|'crash'|'ride'|'shaker'|'perc';
export type Layer = 'drums'|'bass'|'chords'|'melody'|'all';
export type ChordQuality = 'maj'|'min'|'dim'|'aug'|'sus2'|'sus4'|'maj7'|'7'|'m7'|'m7b5'|'dim7'|'mMaj7'
  |'6'|'m6'|'69'|'add9'|'9'|'maj9'|'m9'|'m11'|'7b9'|'7#9'|'7#11'|'7b13'|'13'|'7alt'|'maj7#11'|'7sus4';
export type PitchMode = 'absolute'|'octave-free'|'key-relative'|'transposition-invariant';
/** A label ('mel', 'bass'), '*' (all learner tracks), an inferred role ('@drums' '@bass' '@chords' '@melody'),
 *  or a Band track ('band.chords'). Band tracks are never matched by '*' or by a role. */
export type TrackRef = string;
export type SkillRef = SkillId | `${SkillId}/${string}`;
export interface SkillWeight { skill: SkillRef; w: number }
export type Role = 'practice'|'check'|'checkpoint'|'capstone';
export type ParamRef = { param: string };
export type Num = number | ParamRef;                        // any numeric field marked Num accepts a step param
```

`LessonId`, `SkillId`, `FamilyId`, `DeckId`, `ToolId`, `FeedbackId` are the generated unions, not `string`. `Instrument` is replaced by `SoundId`.

### 5.3 Exercise base, hints, params (`schema/exercise.ts`)

```ts
interface ExBase<K extends string> {
  kind: K;
  id: string;                         // slug, unique in its lesson; global ID `${owner}/${id}`
  version: number;                    // bump when grading semantics change; attempts are keyed by (id, version)
  title?: string;
  prompt: Md;                         // may contain {{param:name}}
  skills: SkillWeight[];
  role: Role;
  key?: KeySpec; meter?: MeterId; bpm?: Num; swing?: SwingSpec; pickup?: PickupSpec;   // default: the lesson's
  params?: Record<string, ParamGen>;  // §5.5
  pass?: number;                      // override of the kind's default pass threshold
  hints: HintLadder | null;           // null only for: predict, listen, fact-deck items, any exercise with role 'checkpoint'
  feedbackText?: Partial<Record<FeedbackId, Md>>;
  tutor?: TutorPolicy;
  srs?: SrsLink[];
  canDo?: CanDoId[];
  fallback?: 'identify'|'skip';       // modality fallback for mic and tap kinds
  tests: TestCase[];                  // code kinds: ≥1 pass and ≥2 fail with distinct feedback codes (AUTHORING §8)
}

/** Fixed 4-rung ladder. Position is the rung: [1] nudge, [2] pointer, [3] partial, [4] reveal. */
export type HintLadder = readonly [nudge: Hint, pointer: Hint, partial: Hint, reveal: Hint | 'auto'];
export interface Hint {
  text: Md;
  highlight?: { code?: CodeRange[]; bars?: number[]; noteSelector?: TargetSelector };
  patch?: string;                     // rung 3: a partial diff; rung 4: the full solution (default reference.solutions[0])
  replay?: { rate?: number; isolate?: Layer; bars?: [number, number] };
}
export interface TutorPolicy { enabled: boolean; reviewOnSubmit?: 'none'|'offer'|'auto' }
```

Hint semantics, identical for every kind:

| Rung | Name | Author writes | UI shows | Evidence multiplier | Best SRS rating |
|---|---|---|---|---|---|
| 0 | — | nothing (grader diagnostics) | where and how many | ×1.0 | Easy |
| 1 | nudge | a conceptual question | the nudge; diagnostics still say only where | ×0.9 | Good |
| 2 | pointer | names the bar/beat and the concept | the pointer, each diagnostic's "what", A/B audio of the target | ×0.8 | Hard |
| 3 | partial | one issue solved, or the same idea in another key | the fix for one issue + ghost notes | ×0.7, flagged assisted | Hard |
| 4 | reveal | `'auto'` or a worked solution | full solution as a diff with Apply | ×0, assisted, revealed | Again |

Rules: rung 1 is offered after the first failed check and never shown unasked; any rung can be requested at any time, in order; Reveal is always available after 2 graded attempts (3 for sing and tap). `reveal: 'auto'` renders `reference.solutions[0]` as a diff. A tutor hint request advances the same ladder by one rung, up to rung 3 (§10.4). `ExBase.unlocks` from the exercises doc is deleted: unlocks live only in `content/toolbox.ts`.

The removed fields of `Hint` (`id`, `level`) and of `TutorPolicy` (`seesReference`, `effort`) have no replacement: the server redacts by rung (§10.5) and effort is fixed per thread kind (§10.2).

### 5.4 Answers, matchers, constraints, tolerances

```ts
export type AnswerUi =
  | { ui: 'choice'; options: Choice[]; multi?: boolean; layout?: 'buttons'|'cards'|'audio-cards'|'roll-thumbs'|'staff-thumbs' }
  | { ui: 'degree-pad'; set: Degree[]; sequenceLen?: number; syllables: boolean; rhythmTemplate?: string }
  | { ui: 'quality-pad'; set: ChordQuality[] }
  | { ui: 'rn-palette'; slots: number; allow: ('triads'|'sevenths'|'inversions'|'secondary'|'borrowed')[] }
  | { ui: 'text'; normalize: 'note'|'chord'|'rn'|'interval'|'key'|'free' }
  | { ui: 'number' }
  | { ui: 'keyboard'; range: [string, string]; mode: 'single'|'chord'|'sequence' }
  | { ui: 'staff-input'; clef: 'treble'|'bass'|'grand'; bars: number; palette: { durations: string[]; accidentals: boolean; ties: boolean; rests: boolean } }
  | { ui: 'grid'; rows: DrumRole[] | ['hit']; stepsPerBar: 8|12|16; bars: number }
  | { ui: 'code'; starter: string; constraints?: AstConstraint[] }
  | { ui: 'tap' } | { ui: 'mic' }
  | { ui: 'bar-buttons'; bars: number }
  | { ui: 'click-code' | 'click-staff' | 'click-roll'; target: TargetSelector };      // predicate target, never an event ID

export type Matcher =
  | { m: 'events'; pitch: PitchMode; rhythm: 'exact'|'onsets'|'ignore'; durations: boolean; sound?: 'ignore'|'s'|'drum-role'; tracks?: TrackRef[] }
  | { m: 'rhythm'; tol: Rat; durations: boolean; perRole: boolean; displacementCredit: number; tracks?: TrackRef[] }
  | { m: 'melody'; pitch: PitchMode; wPitch: number; wRhythm: number; rhythmTol: Rat; track?: TrackRef }
  | { m: 'harmony'; level: 'bass'|'root'|'quality'|'rn'|'full'; qualityDepth: 'triad'|'seventh'|'extended';
      inversion: boolean; harmonicRhythm: 'given'|'graded'; weights?: Partial<Record<'bass'|'root'|'quality'|'inversion', number>> }
  | { m: 'pcset'; perOnset: boolean; bass: boolean; tracks?: TrackRef[] }       // the only matcher allowed for voicing() output
  | { m: 'rubric'; rules: RubricRule[] }
  | { m: 'all'; of: Matcher[]; weights?: number[] };                            // every member must pass; score = weighted mean

export type AstConstraint = { id?: string; feedback?: FeedbackId } & (
  | { c: 'must-use'; tool: ToolId | ToolId[]; min?: number }          // replaces must-call / mini-uses: any toolbox ID, strings and mini ops included
  | { c: 'must-not-use'; tool: ToolId | ToolId[]; why?: Md }          // replaces must-not-call / mini-avoids
  | { c: 'arg-matches'; fn: string; argIndex: number; pattern: string }
  | { c: 'labels'; min?: number; max?: number; names?: string[] }
  | { c: 'no-note-names'; within?: string[] }
  | { c: 'no-randomness' }
  | { c: 'max-changed-tokens'; n: number }
  | { c: 'edit-only-regions' }
  | { c: 'tempo'; bpm: Num; tol?: number }                            // compared in BPM through the lesson meter's tempoUnit (§6.9)
  | { c: 'max-chars'; n: number });

export interface SingTolerance {
  cents: 70 | 50 | 35 | 25 | 'learner';   // 'learner' = profile.singTolCents (§8.2). Authors use 'learner' unless the step is calibration.
  octave: 'per-note'|'global'|'exact';
  driftCompCents: number; onsetMs?: number; minCoverage: number; passHitRate: number;
}
export interface LearnerProfile { rangeLow: number; rangeHigh: number; comfLow: number; comfHigh: number;
  tapLatencyMs: number; tapJitterMs: number; singLatencyMs: number; singTolCents: 70|50|35|25; singTolMode: 'auto'|'fixed';
  noiseFloorDb: number; outputKind: 'wired'|'bluetooth'|'speakers'|'unknown'; inputKind: 'builtin'|'external'|'bluetooth'|'none';
  quiet: boolean }

/** Multi-part step graded as one check: every part must pass. Parts may be any non-'all' kind. */
export interface AllEx extends ExBase<'all'> { parts: Exclude<Exercise, AllEx>[]; weights?: number[] }
export type Exercise = PredictEx|RunInvestigateEx|CodeModifyEx|CodeFillEx|ParsonsEx|ErrorHuntEx|CodeMakeEx|IdentifyEx|FactEx
  |KeyboardEx|StaffReadEx|StaffWriteEx|TapEx|SingEx|DictationEx|TranscribeStepEx|ComposeBriefEx|ListenEx|AllEx;

export interface TestCase { name: string; response: TestResponse; params?: Record<string, number|string>;
  expect: 'pass'|'fail'|'error'; score?: [number, number]; feedback?: FeedbackId[] }
```

Notes that bind:

- **Predicate targets.** A click question never names an event ID. `TargetSelector { track?, drum?, bar?, beat?, degree?, nth? }` is resolved at grade time by evaluating the code; the selected events' `locs` and IDs are the accepted targets. `{ degree: '3' }` replaces the curriculum's `targetId: 'oak-e3'`.
- **`all` at two levels.** `Matcher {m:'all'}` combines matchers on one code answer (events + constraints). `AllEx` combines different responses in one step (a choice plus a code check; a held tonic plus an arpeggio). An `AllEx` counts as one graded check for the budget (§9.2).
- **Curriculum `GradeRule` kinds map as follows.** `choice`, `number` → `FactEx`/`IdentifyEx`; `tap` → `TapEx`; `haps` → `CodeModifyEx` with `Matcher {m:'events'|'rhythm'|'melody'}`; `tempo` → `AstConstraint {c:'tempo'}`; `source` → `must-use` / `must-not-use`; `staffClick` → `InvestigateQ {q:'click-staff', target}`; `drill` → `IdentifyEx`/`DictationEx` with `Stimulus {src:'generator'}`; `sing` → `SingEx`; `rubric` → `CodeMakeEx`/`ComposeBriefEx`; `all` → `AllEx` or `Matcher {m:'all'}`.

### 5.5 Step params with seeded generators

```ts
export type ParamGen =
  | { gen: 'int'; min: number; max: number; step?: number; awayFrom?: { value: number; by: number } }
  | { gen: 'choice'; of: (string | number)[] }
  | { gen: 'key'; keys: 'C'|'≤2acc'|'≤4acc'|'all'; mode: ScaleMode }
  | { gen: 'degree'; set: Degree[] };
```

- Params are drawn once per attempt series from `mulberry32(hash(exerciseGlobalId, seriesNo))` and stored with the attempt (`step_attempts.params_json`). A retry inside the series keeps the same values; "Try a new one" starts a new series.
- A param is used as `{{param:name}}` inside any string field (prompt, starter, solutions, hint text, stimulus code) and as `{ param: 'name' }` in any numeric field typed `Num`.
- The reference solutions are evaluated per attempt with the same params. CI runs every `TestCase` with its explicit `params` and, where a test gives none, with 5 seeds.
- Example (the curriculum's mystery-tempo step): `params: { target: { gen: 'int', min: 70, max: 140, awayFrom: { value: 100, by: 15 } } }`, `constraints: [{ c: 'tempo', bpm: { param: 'target' }, tol: 4 }]`, hint 4 text `"setcpm({{param:target}}/4)"`.

### 5.6 Rubric rules

`RubricRule = { id: string; label: Md; required: boolean; skills: SkillRef[] } & (…)`. Kept from exercises §2.4: `bars`, `duration-sec`, `tempo-bpm`, `tracks`, `in-key`, `ends-on-degree`, `cadence`, `chord-tones-strong`, `progression`, `contains-rn`, `range`, `step-ratio`, `harmonic-rhythm`, `groove-lock`, `swing`, `syncopation`, `form`, `voice-leading`, `guide-tones`, `mode`, `blues-form`, `euclid`, `clave`, `polyrhythm`, `register-separation`, `no-muddy-low`, `uses`, `custom`. Amended and added:

```ts
export type SectionRef = { section: string; nth?: number } | { bars: [number, number] } | 'last';
  // rules below are added to the RubricRule union
  | { rule: 'motif-reuse'; track: TrackRef; minRatio: number; unitBars?: number; shape?: 'semitones' | 'steps' | 'either' }
      // share of melody units (default 1 bar) whose interval sequence matches an earlier unit, exactly or transposed,
      // by edit similarity ≥ 0.75. Replaces 'motif-repetition' and the curriculum's motifReuse≥x.
      // Measured over one period of the learner's loop, not over the rendered bars. `shape` (default 'semitones')
      // says how intervals are compared: by half steps, by scale steps in the rule's key (a diatonic sequence
      // then counts), or whichever matches.
  | { rule: 'contrast'; a: SectionRef; b: SectionRef; axes: ('pitch'|'density'|'harmony'|'register'|'energy')[]; minAxes: number;
      thresholds?: { pitchSemis?: number; densityRatio?: number; registerSemis?: number; energyDelta?: number } }
      // pitch: mean melody pitch differs ≥ 3 st; density: onsets per bar differ ≥ 25%; harmony: RN sequences differ;
      // register: lowest/highest sounding note moves ≥ 5 st; energy: |ΔE| ≥ 0.15. Replaces 'section-contrast'.
  | { rule: 'key-change'; at: SectionRef; semitones: number[]; minBarsAfter?: number; sameMelody?: boolean }
      // new key = old key + one of `semitones`; the section at `at` must last ≥ minBarsAfter (default 8) bars;
      // sameMelody: key-relative degree sequences of the two sections are equal. Replaces 'modulation' for lifts.
  | { rule: 'modulation'; to: 'up-step'|'up-half'|'relative'|'dominant'|KeySpec; atBar?: number }      // kept, for pivot modulations
  | { rule: 'velocity-ghosts'; track: TrackRef; min: number; maxGain?: number; on?: '16th-offbeat'|'any' }
      // ≥ min hits with effective gain ≤ maxGain (default 0.4) at the given positions
  | { rule: 'onsets'; track: TrackRef; drum?: DrumRole; contains?: Rat[]; equals?: Rat[]; perBar: boolean }
  | { rule: 'degree-set'; track: TrackRef; subsetOf?: Degree[]; contains?: Degree[]; minCount?: number }
  | { rule: 'sounds'; subsetOf?: SoundId[]; contains?: SoundId[] }
  | { rule: 'distinct-pitches'; track: TrackRef; min: number }
  | { rule: 'device-count'; devices: string[]; min: number }           // device names from AnalysisSummary.devices
  | { rule: 'matches'; reference: Reference; matcher: Matcher; min: number }   // e.g. "melody identical to the reference" (JC4, AC1)
  | { rule: 'uses'; tool: ToolId | ToolId[]; min?: number }             // amended: toolbox IDs, like AstConstraint 'must-use'
  | { rule: 'swing'; track: TrackRef | TrackRef[]; drums?: DrumRole[]; subdivision: 8 | 16; ratio: [number, number] }
      // amended: a priority list of tracks, an optional drum-sound filter, and the subdivision that swings (§6.6)
```

**Additive in 1.7 and 1.8** (the corrections pass and the advanced tracks). `@oak/content-kit` is the implementation; `IMPLEMENTED` and `PLANNED` say what grades today, and a lesson that uses a planned shape fails content CI until the Build lands it (§5.1).

- Matcher fields: `melody.durations` and `pcset.durations` (written lengths compared, not only onsets).
- Rule fields of the corrections pass: `cadence.before`, `chord-tones-strong.cover`, `motif-reuse.loopRepeats`, `voice-leading.loop`, `sounds.track` and `sounds.anyOf`, `pickup.leadsIn`, `guide-tones.at: 'bar'` and `guide-tones.changes`, `onsets.excludes`, `modulation.cadence`. Of the advanced tracks: `clave.minBars` and `clave.exact` (every two-bar window from bar 1 for at least `minBars` bars holds the whole clave in its direction: coverage, not a sample), `polyrhythm.minBars` and `polyrhythm.span` (both pulses evenly spaced in the SAME bars; tracks that take turns never meet), `voice-leading.voice: 'top'` with `minRatio` (the highest note of each chord of a hand-voiced track, on that share of the changes; a `voicing()` track is never graded by its top note, §6.7), `reharmonize.devices` (the jazz devices of `device-count`).
- Custom rules, `{ rule: 'custom', fn, params }`, each also taking `params.alsoUses` (once the effect is heard, the code must use one of these tools, else credit 0.5), so a lesson Make keeps one required rule. The corrections pass's effect checks: `silent-beat`, `split-beat`, `held`, `bars-differ`, `speed-change`, `transposed-copy`, `distinct-keys`, `orbits-differ`, `call-response`, `stack-intervals`, `chords-per-bar`, `last-chord`, `song-kept`, `tuplets-every-bar`, `swung-offbeats`, `voiced-with`, `control-set`, `parts-enter`, `broken-chord`, `black-keys`, `chance-varies`, `echo`. The advanced tracks' (parameters in `TRACK_CUSTOM_RULES`): `walking-bass` (an attack on every quarter of every bar, the root on beat 1, a chord tone on beat 3, beat 4 a step or half step from the next downbeat; four attacks crowded into beat 1 fail), `allowed-tensions` (reads the MELODY: its structural notes, on a beat or a beat long, are chord tones or available tensions of the chord sounding at their onset), `ii-v-chain` (distinct target keys of chained ii–V pairs), `voicing-shape` (shell, close, drop-2, rootless A and B, octave-aware, hand voicings only), `song-melody-kept`, `contrafact`, `two-versions-differ`, `same-tune-two-ways`, `extended-share`, `microtiming` (tempo-aware: milliseconds behind or ahead of the grid), `displaced-copy`, `metric-weight`, `grouping-accents`, `regrouped`, `polymeter-cycle`, `clave-aligned`, `stabs`, `chord-scale-fit`, `tensions-used`, `counter-melody`, `slices-reordered`, `level-balance`.
- Events and context: `NEvent.voicedWith` (the dictionary in force when `voicing()` ran); `GradeContext.songForm[].chords` (CF-T's `song-kept`), `GradeContext.songMelody` (the picked song's melody, for `song-melody-kept` and CF-T.S4), `GradeContext.otherVersion` (AC1's second version).
- Exercise shapes of the advanced tracks: the `grouping` answer (odd-meter group sizes) and the `euclid` answer (k, n and a rotation, graded by the onsets they make); `text` answers with `jazz: true` (glyphs and extensions read as chords); "build this voicing" (`KeyboardEx.expect.voicing`, `StaffExpect` chords with `voicing`); two-lane tapping (`TapEx.lanes`, one lane per hand); two-version capstones (`CapstoneDef.versions`: two pieces of code, each with its own tempo line, one album track).
- What is heard: every effect rule judges sounding events; normalization drops an event at effective gain ≤ 0.01, and authors treat a part more than 24 dB under the loudest part as not heard (decision 71).

`swing` always names the track or tracks it measures (hats, ride or comping), never a quarter-note bass; how it picks among them is in §6.6. `form` reads `sectionsFromAst` under the convention of §6.3. `custom` stays for one-off checks (`walking-bass`, `allowed-tensions`, `ii-v-chain`), each registered by name with a unit test.

Numeric rules return `{ ok, value, target }` and give partial credit `min(1, value/target)`. `required` is all-or-nothing for pass.

### 5.7 Events, results, feedback codes

```ts
export interface NEvent {
  id: string;                 // `${track}|${bar}|${onset[0]}/${onset[1]}|${midi ?? s ?? chordSymbol}|${k}` (k disambiguates duplicates). Deterministic for the same code.
  track: string;              // label ('mel'), '$0' for anonymous `$:` lines, 'main' for one unlabelled expression, 'band.<label>' for Band tracks
  onset: Rat; dur: Rat; clipDur?: Rat;
  midi: number | null; cents?: number; pitchSource: PitchSource;
  written?: string; chordSymbol?: string;       // chord() value or the grader's `_oakChord` shim tag
  drum?: DrumRole; s?: string; bank?: string; sampleN?: number;
  gain: number;               // (gain ?? 0.8) · (velocity ?? 1) · (postgain ?? 1)
  scaleCtx?: string;          // hap.context.scale, e.g. 'D4 major'
  locs: CodeRange[];
}
export interface GradeResult {
  exerciseId: string; exerciseVersion: number; attemptNo: number; firstAttempt: boolean;
  mode: 'lesson'|'capstone'|'tutor';
  status: 'pass'|'fail'|'error'|'ungraded';
  score: number; adjustedScore: number;                       // adjusted = score × rung multiplier × replay multiplier (§5.3, §7.2)
  dims: Partial<Record<Dimension, DimScore>>;
  constraints: { id: string; ok: boolean; diag?: Diagnostic }[];
  rubric?: { ruleId: string; required: boolean; ok: boolean; value?: number; target?: number; diag?: Diagnostic }[];
  diagnostics: Diagnostic[]; messages: { id: FeedbackId; text: string; where?: Loc }[];
  assist: { rung: 0|1|2|3|4; tutorHints: number; extraReplays: number; revealed: boolean };
  params?: Record<string, number | string>;
  modality?: 'normal'|'fallback';
  disputed?: boolean;                                         // set by "Report a grading problem" (§11.8)
  eval?: { ms: number; cps: number; bpm: number; bars: number; tracks: string[]; logs: { level: 'error'|'warn'|'log'; text: string }[]; truncated: boolean };
  analysis?: AnalysisSummary; overlay?: { answer: { id: string; ok: boolean }[]; missing: NEvent[] };
}
```

- The UX doc's `GradeResult { facets, issues }` is a **view**, built by `toIssueView(result, rung)` in `@oak/content-kit`: `dims` become facet chips, each `Diagnostic` becomes an issue whose `what`, `fix`, `expected` and ghost notes are filled only from the rung that allows them (§5.3). The same function redacts tutor tool results (§10.5).
- The link bus and the staff use `NEvent.id`. abcjs class names are `oak-e{n}` where `n` is the index in the notation `idMap` of the current render; content never refers to either.
- **Feedback codes.** The registry is the exercises §2.6 catalog plus the additions below. Areas: `eval`, `code`, `lint`, `rhythm`, `melody`, `harmony`, `spell`, `keysig`, `sing`, `tap`, `id`, `fill`, `parsons`, `hunt`, `investigate`, `kb`, `staff`, `predict`, `form`, `make`, `rubric`, `pass`. Each code has one catalog template with `{param}` slots; an exercise may override the text, never the code.

| Added code | Severity | Meaning |
|---|---|---|
| `code.locked-tool` `code.locked-sound` `code.locked-scale` `code.locked-chord` `code.locked-mini` | E (graded) / I (Studio) | replaces `code.locked-fn`; names the unlocking session |
| `code.preview-tool` | I | this tool is only being previewed here |
| `code.uncatalogued` | W / E | a Strudel name Oak has no card for |
| `code.dollar-label` | I (graded, Studio) / E (content) | `$:` used; tracks are read through role inference |
| `code.label-unknown` `code.label-solo-prefix` `code.muted-label` | W / E / I | label outside the set; label starts with capital S; `_name:` mutes the line for the checker |
| `code.chord-not-in-dict` | E | the symbol is valid but the `dict()` of this chain does not carry it, or voices it wrongly (`Caug` in `triads`, `C69` in `lefthand`); suggests a dict or a spelling |
| `code.slash-chord` | E | `/` inside `chord("…")`; says to put the bass note in the `bass:` track |
| `code.scale-no-octave` `code.scale-spaces` | W / E | `"C:major"`; `"C4 major"` |
| `code.chromatic-step` | W | accidental step ≥ 7, or `4#` where ♯4 is meant |
| `code.mode-above` | E | `mode("above")` |
| `code.transpose-after-scale` | W | key change by `.transpose()`; suggests patterned `.scale()` |
| `code.add-on-control` | E | `.add("…")` with a bare string on a control pattern |
| `code.nudge-studio-only` | E (graded) / I (Studio) | |
| `code.swing-convention` `code.swing-fraction-string` | W / E | second argument is not beats per bar (or twice it); `"1/3"` inside a patterned amount |
| `code.setcpm-missing` `code.setcpm-form` | W | no tempo line; `setcpm(30)` instead of `setcpm(120/4)` (passes with the note) |
| `code.range-spacing` | E | `0..7` without spaces |
| `code.time-fraction-string` | E | a fraction inside a string argument of `late`, `early` or `off` (`.late("1/16")` does not shift; write `.late(1/16)`) |
| `code.arranged-scale-pattern` | W | a patterned `.scale("<…>")` inside a const that is used as an `arrange()` section: it restarts with the section; put the key plan after `arrange()` |
| `form.section-period` | W | a section's bar count is not a multiple of its pattern's period, so the idea is cut off |
| `lint.strict.computed-member` `lint.strict.this` `lint.strict.reserved-string` `lint.strict.construct` | E | strict profile (§11.3) |
| `rhythm.swing-missing` | W | right rhythm, but straight where the target swings (or the reverse) |
| `rhythm.pickup-missing` | W | the phrase starts on the downbeat but should start with a pickup |
| `form.inconsistent-arrange` | E | `arrange()` sections differ between tracks |
| `make.beyond-brief` | I | "You went past today's brief" |
| `eval.truncated` | I | piece longer than the grading cap; only the first 128 bars were checked |

### 5.8 Lesson files

Folder layout (the only one):

```
content/
  STYLE.md  AUTHORING.md  syllabus.ts  skills.ts  families.ts  toolbox.ts  candos.ts  terms.ts  flavours.ts
  ids.lock.json                      committed ledger of every ID ever published
  core/U03/L02/lesson.ts             typed truth: meta, steps, exercises, code, grading, tests
  core/U03/L02/lesson.mdx            prose only: one <Step id="S3"> block per step; no code fences, no numbers that grading depends on
  core/U03/CP/checkpoint.ts          authored items + generator recipe
  core/capstones/C2/capstone.ts      brief, rubric, sessions      core/capstones/C2/brief.mdx
  advanced/J1/L03/lesson.ts …        advanced/capstones/JC1/…
  gym/ladder.ts  gym/templates.ts    bands/*.ts   repertoire/<song-id>/song.ts
  validate/                          content CI suites
  .generated/                        ids.ts index.json skill-graph.json toolbox.json examples.json sounds-used.json lesson-text/ tutor/
```

```ts
export type StepKind = 'listen'|'predict'|'run'|'investigate'|'see'|'concept'|'modify'|'parsons'|'quiz'
  |'ear'|'sing'|'tap'|'dictate'|'notate'|'compare'|'make'|'reflect';        // presentation only (UX §3.2)
export interface StepUi { panels: { roll: boolean; staff: false|'treble'|'bass'|'grand'|'perc'|'lead'; keyboard: boolean };
  rollLabels?: 'none'|'note'|'degree'|'degree+solfege'; loopBars?: number; band?: BandRef | false }
export interface BandRef { band: BandId; followsLearnerKey?: boolean; tracks?: ('drums'|'bass'|'chords')[] }
export interface TermDef { id: TermId; step: string; card?: { testedIn: LessonId } }   // glossary entry; a fact card only if a later lesson tests it
export interface StepDef {
  id: `S${number}`; kind: StepKind; title: string;
  minutes: number;                    // the author's expert estimate; CI applies the 1.4 factor (§9.2)
  ui: StepUi;
  exercise?: Exercise;                // absent for concept, see, reflect
  example?: { id: string; code: string; bars: number; preview?: boolean };
  graded?: boolean;                   // true for the lesson's ≤3 graded checks
  optional?: boolean;                 // stretch step, shown only at the 25-minute target
  testOut?: { skips: `S${number}`[] } // §9.5
}
export interface LessonDef {
  id: LessonId; version: number; title: string; objective: string;
  key: KeySpec; meter: MeterId; bpm: number; swing?: SwingSpec; pickup?: PickupSpec;
  introduces: SkillId[]; practises: SkillId[];
  terms: TermDef[];                   // ≤ 3
  canDo: CanDoId[];
  flavours?: Partial<Record<FlavourId, { band?: BandId; sounds?: Record<string, SoundId> }>>;
  steps: StepDef[];                   // ≤ 12; the last is kind 'make'
  wrapAt: `S${number}`;               // the "save & wrap" midpoint (§9.4)
}
```

`StepKind` → exercise kind: `listen` → `ListenEx`; `predict` → `PredictEx`; `run` → `RunInvestigateEx` with no questions; `investigate` → `RunInvestigateEx`; `see`, `concept`, `reflect` → no exercise; `modify` → `CodeModifyEx` | `CodeFillEx` | `ErrorHuntEx`; `parsons` → `ParsonsEx`; `quiz` → `FactEx` | `KeyboardEx` | `StaffReadEx` | `IdentifyEx` on a visual stimulus; `ear` → `IdentifyEx` | `DictationEx` with a generator stimulus; `sing` → `SingEx`; `tap` → `TapEx`; `dictate` → `DictationEx` | `TranscribeStepEx`; `notate` → `StaffWriteEx`; `compare` → `IdentifyEx` with two audio cards; `make` → `CodeMakeEx` (lessons) | `ComposeBriefEx` (capstones). The warm-up and the Coda are engine-driven and are never authored as steps (the curriculum's `review` and `wrap` kinds are gone).

### 5.9 Deleted from the other documents

| Document | Deleted | Replaced by |
|---|---|---|
| architecture §2.3 | the "Checks DSL": `Check`, `GradeSpec`, `CompareMode`, `hapsMatch`, the `RuleId` registry, its `GradeResult`/`Feedback`/`FeedbackCode` set, `OakEvent` | `Exercise`, `Matcher`, `RubricRule`, `GradeResult`, `Diagnostic`, `NEvent`, the feedback catalog |
| architecture §3.1, §3.2 | the `u03.04` / `c.*` / `ear.*` / `fn.*` ID table; `defineLesson` with `codeExercise`, `wrong[].expect`, `unlocks` in the lesson | §1, §5.8; wrong variants are `tests` with `expect: 'fail'` |
| architecture §2.6–§2.10, §2.13 | `gradeSungNote` (longest stable segment), per-degree family cards, the 70/90 grade map, `['1m','10m']` learning steps, EWMA mastery, the "voicing unlocks at the U06 gate" invariant, daily streak with freeze tokens | §7, §8, §3.1 rule 6 |
| architecture §5.1, §5.3, §5.8 | betas other than `server-side-fallback-2026-07-01`, `display:'updates'`, `block_binding`, effort-only system messages, the 9-tool list, `submit_review`, the $1.50/$3.00 daily caps | §10 |
| architecture §2.12 | routes `/map`, `/drills`, `/sketchbook`, `/studio/$transcriptionId` | §11.9 |
| UX §3.3 | `Lesson`, `Step`, `CheckSpec`, `RuleSpec`, `RuleId`, `u03.l02` IDs, `content/units/...` layout | §5.8 (`StepKind` survives as presentation) |
| UX §3.5 | `GradeResult { facets, issues }` as a grader type | a view over the canonical result (§5.7) |
| UX §3.9, §4.1, §4.3, §4.4, §5.4 | two-part checkpoints, the 70/90 set grade map, "≥250 ms in-band within 1 s", tolerance by "two consecutive days", tap ±60→±35 ms, daily rests and ties | §7.6, §7.2, §8 , §7.8 |
| UX §5.1, §8 | the unlock map; the 10-minute onboarding with `.env.local` restart, hidden-target first sing, U0.2/U0.3 | §3; U00.L01/L02 in §2.3 |
| UX §2.3 | mute/solo by rewriting `$:` → `_:` | §6.2 |
| curriculum §1, §3, §6, §7.2, §7.5, §7.9, §7.11, §7.16, §7.19, checkpoint protocol | the old course map and unlock table, `GradeRule`/`Step` with 3-tier hints, `swingBy(1/3, 4)` for every meter, `"4#"`/`"7b"` chromatic steps, `C-`/`Ch7`/`C+` as canonical, per-unit tolerance tightening, the 70/90 grade map, the 20-minute checkpoint with ≥75% per node | §2, §3, §5, STYLE, §8, §7 |
| exercises §0.3, §4.3, §5.4, §5.5, §6 | the `src/…` and `content/lessons/uNN` layout, new-card throttle of 15/day, the opacity formula, the cp01–cp12 map and "2 failed attempts" soft pass, the 12-minute CI limit, auto-mutants on every exercise | §5.8, §7 |

### 5.10 Band layer and flavour kits

The **Band layer** is a read-only backing that makes a Make sound like a song from U01 on. It is a content type of its own.

```ts
export interface BandDef {
  id: BandId; title: string; bars: number;
  roles: ('drums'|'bass'|'chords')[];
  code: Record<FlavourId, string>;      // labelled tracks drums: bass: chords: only; may use any tool (profile 'band')
  params: { key: boolean; bpm: boolean };   // code may contain {{key}} (e.g. "C4:major" → tonic+mode) and {{bpm}}
}
export interface FlavourKit {
  id: FlavourId; title: string;
  drums: SoundId; bass: SoundId; chords: SoundId; lead: SoundId;
  chordDepth: 'triad'|'seventh'; swing?: SwingSpec;
  production: { room: number; bassLpf: number; humanizeVelocity: number; pan: Partial<Record<'drums'|'bass'|'chords'|'lead', number>> };
}
```

| Flavour | Drums | Bass | Chords | Lead | Harmony and feel | Ships in |
|---|---|---|---|---|---|---|
| `flavour.pop` | uzu kit (default) | `ebass` | `piano` | `piano` | triads, straight | W2 |
| `flavour.jazz-soul` | `jazzkit` | `upright` | `rhodes` | `vibes` | seventh chords and swing 8ths (`amount: 1/3`) from U03 on; triads and straight in U01–U02 | W2 |
| `flavour.indie` | `LinnDrum` | `ebass` | `cleangtr` | `acgtr` | triads, straight | W5 |
| `flavour.funk` | `RolandTR808` | `fingerbass` | `clav` | `organ` | sevenths from U06, 16th feel | W5 |
| `flavour.electronic` | `oak909` (`lofikit` in a song's lo-fi sections) | `sawtooth` (acid recipe; a `sine` sub in softer sections) | `sawtooth` (stabs; a `supersaw` pad in songs) | `square` (pluck with an echo) | straight; triads until U06.L10, then four-note chords (sixths on I and IV, as funk) | S1 |

Production defaults for every kit: `room` 0.2–0.35, `.lpf(700–900)` on the bass, velocity humanized ±0.08, bass centre, chords and lead slightly apart. The listening pass fixes the exact numbers and may swap a cheap-sounding GM patch for a superdough synth patch behind the same alias.

**Electronic** (sound pack v4, `docs/design/samples/proposal.md` §4) is the one kit made of synthesis. Its bass is the TB-303 recipe after the kit's `.lpf(700)`: `.lpq(12).ftype("ladder")` and a filter envelope (`.lpenv`, `.lpd`, `.lps(0)`) opened by an accent pattern, short notes (`.decay(.2).sustain(.4)`); in a Band its acid cells repeat the root (the acid is in the filter), and only the forms that need another note (the shuffle's 5th, the walking jazz forms, the son tumbao, the ii–V–I's two-feel) play one, so it never rises into the chords. Its chords are sawtooth stabs whose filter snaps shut, on the off-beats between the four-on-the-floor kicks (the pump of a sidechained record); in a unit song the loud sections duck the on-beat chord (`.postgain` or `.velocity`) and the soft ones swell a `supersaw` pad after each kick. Its synth parts sit under the sampled kits' gains (bass .55, chords .3, drums .6 in the Bands), because a raw sawtooth is as loud as a sampled bass. It plays no swing of its own: a Band that swings in every kit (the shuffles, the jazz forms, the neo-soul loop) swings in electronic too. Ships `S1`, with the unit songs: the Settings picker and a song's style picker offer it. Studio, onboarding and the capstone picker still offer only the `W2` kits, and a capstone brief's `flavours` stay the four with tested pieces; a capstone opened by an electronic learner starts in pop, and every Band still has electronic code for any path that asks for it (rule 7 holds either way).

Rules:

1. Band code is never part of the learner's code. The adapter evaluates it separately and adds its tracks to the collector as `band.drums`, `band.bass`, `band.chords`. The editor shows a collapsed, read-only "Band" strip with a mute button per track; there is no edit affordance.
2. The Band shares the session's tempo (one scheduler). Its key is the step's key; with `followsLearnerKey: true` it takes the tonic and mode of the learner's first `.scale()` after each evaluation.
3. The grader ignores Band tracks unless a rule names one (`harmony: 'band.chords'`). A learner's own track with the same role replaces nothing: both play unless the learner mutes the Band track.
4. Band code may use locked tools (it is one of the four preview contexts). It must pass the strict lint and the audibility check, and every `(band, flavour)` pair is evaluated in content CI.
5. A sketch saved over a Band stores `{ bandId, flavour, mutes }`. Its liner notes say "Band: Oak (jazz-soul kit)". Album export records the Band unless muted. Evidence is taken from the learner's tracks only.
6. From U01 every lesson Make declares a Band (`StepUi.band`) unless the lesson's point is silence around the part (`band: false`, with a one-line reason in `lesson.ts`).
7. A flavour never changes a rubric (§6.6). The learner's flavour choice (Settings → Learning, or per capstone) selects the Band code and the starter sounds only.
8. **Starter sounds follow the unlock table.** A flavour's `sounds` swap is applied to code the learner edits (a starter, a solution, a hint patch) only when that sound is unlocked for the session. Otherwise the default stays: `piano` for lead and chords, `ebass` for bass (`piano` before `ebass` unlocks), the default kit for drums. The Band may use the kit's sounds at any time, because it is a preview context. A jazz-soul learner therefore hears vibes and Rhodes in the Band from U01 and writes with `piano` until `rhodes` (U05.L08) and `vibes` (J1.L01) unlock; content CI checks every flavour's starter against the unlock table. A lesson's `flavours` swap is partial: a flavour it does not name (electronic in every lesson today) keeps the default sounds, so its learner writes with `piano` and `ebass` as rule 8 says.

### 5.11 Unit songs

Every unit except U00 is **one song** (core U01–U17, tracks J1–J5, R1–R3, A1–A2: 27 songs). When the unit starts, Oak plays the whole song in the learner's style; each take lesson's Make takes over **cells** of it (a part in a section), Oak keeps playing every cell nobody has taken, and the song is released to the album when the unit ends. The design is `docs/superpowers/specs/2026-11-24-unit-songs-design.md` (its §10a calls are decisions 88–94); the authoring rules are AUTHORING §23.

**Principles (binding).**

1. **Grading is untouched.** The grader sees the learner's Make code only, as before; `GradeContext.band` stays unset and no song track reaches a rubric. No rubric rule, matcher, test or `required` flag changes for songs, except a Make re-keyed to fit its song (rule 14), which follows §11.7 and the corrections-pass standard (AUTHORING §20.2).
2. **One composer.** The song is a playback, persistence and presentation layer around the learner's code. One composer (`packages/grader/src/song/compose.ts`, exported as `@oak/grader/song` and re-exported unchanged as `@oak/strudel/song-compose`; it lives in the grader because the grader may not import the adapter) builds what is heard on every path: the editor during a Make, `PatternPlayer`, the offline export, the Workbench analysis, the loop player and album playback. No path computes "what Oak plays" on its own, and the loop player never glues band text into learner text (it loads the composed band).
3. **Terms are gated by data.** A section or part shows its musical name (verse, chorus, bridge, melody…) only once the learner has been introduced to its term (`terms_introduced`, §10.8). Before that it shows a neutral label: letters A, B, C… for sections, `plainName` for parts.
4. **Nothing is lost.** Lesson-make sketches stay as they are; a song refers to them. Units already started get their songs by backfill (rule 17).

**Ids and files.** `SongDef`, `SongId` and `song.*` keep meaning the repertoire (§2.8), and the server loader treats every `**/song.ts` as a repertoire song. A unit song is a `UnitSongDef` with the id `usong.<UNIT>` (`usong.U01`, `usong.J1`; grammar `^usong\.(?:U\d{2}|J[1-5]|R[1-3]|A[1-2])$`, the unit grammar of §1.2), in `content/unit-songs/<UNIT>.ts` (never a file named `song.ts`), registered in `content/unit-songs/index.ts`, the ID ledger and `scripts/content/generate.ts`, and validated at import by `defineUnitSong` (zod, `packages/content-kit/src/schema/unit-song.ts`).

```ts
export type SongSectionId = string;   // 'intro', 'verse1', 'chorus2': a slug, unique in the song, stable once shipped
export type SongPartId = string;      // 'kick', 'bass', 'lead': a slug, unique in the song, stable once shipped
export interface UnitSongDef {
  id: UnitSongId; unit: UnitId;
  version: number;                    // bump when Oak's code or the plan changes (rule 16)
  title: string;                      // Oak's working title; the learner may rename their copy
  meter: MeterId;                     // every take step's Make is in this meter
  key: KeySpec;                       // every pitched take step's Make is in this key, or its section's
  bpm: number;                        // Oak's tempo until the learner sets one
  sections: { id: SongSectionId; type: string; bars: number; key?: KeySpec }[];
      // in form order; `type` is the section kind (STYLE §10 words: intro verse pre chorus bridge solo break head vamp
      // lift outro ballad drive a b c, plus prechorus) for display names and for mapping a learner's arrange();
      // `key` overrides the song's key in that section
  parts: { id: SongPartId; label: string; role: 'drums'|'bass'|'chords'|'melody'|'pad';
           sounds?: string[];         // drum parts only, and required there: the sound names this part owns
           name: string; plainName: string; termId?: TermId }[];
  code: Record<FlavourId, string>;    // Oak's whole song per flavour (rule 6)
  plan: TakeoverStep[];               // one entry per lesson of the unit, in syllabus order (§2.3, §2.6)
  releaseAfter: LessonId | CheckpointId;   // the song can be released once this is complete
}
export type TakeoverStep =
  | { lesson: LessonId; kind: 'take';
      sections: SongSectionId[] | 'all';   // where this Make's code plays in the song
      parts: SongPartId[];                 // the parts it takes there (CI: ⊇ the parts the reference code plays)
      oakKeeps?: SongPartId[];             // Oak pitched parts that keep playing under a take that plays chords
      startFrom: 'oak' | LessonId;         // the authored starter, or the learner's code of an earlier take step
      today: string }                      // one line for Today and the lesson card, ≤ 20 words
  | { lesson: LessonId; kind: 'side'; reason: string };   // the Make stays a standalone sketch over its Band
```

**The song (content).**

5. Total bars ≤ 64 (the Workbench analysis limit). Each section is a whole multiple of 4 bars, or a one-bar stop or pickup bar. Part labels are STYLE §2 labels, each used once, in a role the label allows (`fx` is never a part); a drum sound belongs to at most one part, and the sound name is read before any `:` index (`bd:3` is `bd`).
6. Oak's code, in every flavour: no tempo line; one labelled track per part (label = `part.label`); section patterns as `const`s named `<label><Section>` by section type; **one `arrange()` per track** listing every section of the song in order with its bars (`silence` where the part rests), as §6.3 and STYLE §10. A section key is a key plan after `arrange()` (§6.8 item 4). Lint profile `band`; locked tools are allowed, because Oak's song code is a preview context in the sense of Band-layer code (§3.1 rule 5 (b)).
7. Every flavour has the same sections, parts and bar lengths, the same chord roots and functions, the same bass roots on the downbeats and the same lead-tune pitches. A flavour may change sounds, groove and swing, and may colour chords with sixths, sevenths and ninths as its kit does (§5.10: jazz-soul from U03, funk from U06). Swing follows the kit's staging; a song stays straight wherever the unit's takes are straight-subdivision parts the learner writes (all of U01–U02 and U13).
8. The lead tune and the bass never hold a note a half step from a sounding chord tone (the AUTHORING §13 clash rule), scanned per flavour. The song's levels are set and guarded by the song loudness harness (`packages/strudel/e2e/songs.pw.ts`, budget `packages/strudel/sound-songs.json`; AUTHORING §23.5 rule 1), so the learner's part is on top: per flavour, Oak's whole song between 2 LU under the quietest Band of §5.10 and the Band median + 2 LU (never over the loudest Band), and every take's learner part no more than 3 LU under Oak's in the cells it takes.

**Claims and the composer.**

9. The song is a grid of cells (part × section). Takes apply in the order they were recorded; a later take overrides an earlier one cell by cell. In each section it plays in, a take claims (a) its declared `parts`; (b) every part its code actually plays: a drum hit belongs to the drum part whose `sounds` contain its sound name (sound pack v4 names no part lists stand for kit sounds: `conga bongo clave` and the foley one-shots `foley snap impact swoosh scratch` for the part that owns the song's percussion, `cb tb sh` or else the part labelled `perc`; `sbd` for the part that owns `bd`; a break, `brkfunk brkboombap brkjungle brkhouse brkjazz brklofi`, for every drum part; `drumPartsOfSound`), a pitched track to the part with its exact label, else the first part of its role (§6.2 rule 1); (c) when its code plays chords, every Oak pitched part (bass, chords, melody, pad) in those sections except those in `oakKeeps`. Oak's drums keep playing under (c).
10. Oak's tracks play, bar by bar, in every cell no take owns. A learner source plays in the cells it still owns: a drum track filtered hit by hit to the drum parts it still owns there (a later take of the kick does not double an earlier `drums:` line's kick; a break, one sample for the whole kit, plays while its source owns any drum part there); a pitched track where its part is still its own; a track that maps to no part wherever the source still owns any cell of that section (going past the brief, §6.5). A take claims only the sections it filled; sections it does not fill keep their owner.
11. Before U09.L02 a source is a loop, placed per section with `arrange()` semantics: it restarts at the start of every section it plays in (§6.3 item 7). From U09.L02 a source may contain `arrange()`: its sections map onto the song's by `type` (its first verse into every song section of type verse; a numbered variant such as `chorus2` into the matching occurrence when there is one), each learner section looping inside the song section it fills (`zoom(start, end)`, then `slow(bars)`). The song's form stays Oak's (`followLearnerForm` is off for songs); the Make's "Today's code" switch plays the learner's own form as written.
12. **Tempo and key.** The song's tempo is the newest learner source's tempo, else `bpm`; a source's own `setcpm` is ignored while it is placed. Keys are fixed per section by the song (`sections[].key`, else `key`); Oak never follows the learner's key in a song. A learner who changes key past the brief changes only their own cells.
13. **Track names.** Oak's song tracks are `band.oak.<label>`; a carried learner source's tracks are `band.take.<lessonId>.<label>`; the code being edited keeps its own labels. Both prefixes start with `band.`, so §6.2 rule 5 covers them. `BandSetup.tracks` and the sketch's `bandState.mutes` widen from `drums|bass|chords` to part labels, and `bandState` gains an optional `song: { unitId, takeIds }`; plain Bands keep working, and §5.10 rule 3 still holds for them and for "Today's code". Inside a song a take **replaces** Oak's parts in the cells it claims.

**The Make inside the song.**

14. A take step's Make opens with the lesson's authored starter (`startFrom: 'oak'`) or with the learner's saved Make code of the named earlier take step of this song, with "Start from Oak's copy" (the `fromSketch` UI, generalised); in both cases the first `setcpm` is set to the song's tempo when the Make's range allows it. `make.unchanged` compares with the code the Make opened with. While editing, the live code owns today's cells and the Workbench loops today's sections, with "Play the whole song"; the switch **In your song | Today's code** plays either the composed song or the editor's code alone over the lesson's own Band. A take step's Make is in the song's meter and in the key of every section it plays in; a Make that is not is a side step, or is re-keyed with a new exercise version (§11.7), every test updated and the corrections-pass standard kept.
15. Saving is unchanged (`steps.attempt` → `sketches.create` lesson-make → `lessons.complete`), followed by `songs.recordTake` with the cells the saved code claims (rule 9) and its track labels. A side step's Make is the standalone sketch over the lesson's Band, and the lesson card says why.

**Persistence, versions and release** (migration `0011_unit_songs.sql`: new tables and `ADD COLUMN` only; `sketches`, `album_tracks`, `album_track_versions` and `sessions` are never rebuilt, because the foreign-key cascade deletes data).

16. `unit_songs` (one row per unit: song id and version, flavour, title, `open`|`released`, `backfilled`, `style_seen`) and `unit_song_takes` (lesson, sketch version, cells, labels, bpm), whose order is the song's state. Endpoints: `songs.list`, `songs.get`, `songs.start`, `songs.setFlavour`, `songs.rename`, `songs.ackStyle`, `songs.recordTake`, `songs.release`; `start` and `recordTake` are idempotent. `SessionPlan.song` summarises the song of the planned lesson. A `UnitSongDef.version` bump keeps every take; the composer plays the new Oak code, and cells whose part or section no longer exists fall back to Oak while the take history keeps them. A changed flavour keeps every take.
17. **Backfill.** When a song is created, and at start-up after migration 0011 and after a backup import, every unit with a completed take lesson gets its song idempotently: the profile flavour, one take per completed take lesson from its latest lesson-make sketch (cells = the step's `sections` × `parts`, refined at the next saved take), `backfilled = 1`, and a one-time card on Today that offers the style picker. A unit whose `releaseAfter` is complete is offered for release. A song that already exists keeps every take it has and gains a backfilled take only for a completed take lesson with no take at all (a take post that never reached the server); the gap fill runs at start-up, on `songs.get`, in `recordTake` and before `release`, and the added take never takes a cell an existing take owns.
18. **Release is a frozen snapshot.** `songs.release` is refused until `releaseAfter` is complete. It writes `unit_song_releases` with everything needed to play it again (Oak's exact code of the flavour at release, the sections and parts, each take's sketch version and cells, the title and bpm) and an album track with no capstone (`album_tracks.unit_id`; its `album_track_versions` row points at the newest take's sketch version and at the snapshot, `song_release_id`). `album.source` of such a version carries `AlbumSource.songRelease: { unitId, releaseId }` (absent on every other version; its `code` is only the newest take's), and the app's export and album playback read the release with `songs.snapshot`. Album playback and export compose from the snapshot, never from current content. A take after release updates the song, not the release; the song page then offers "Release again", which adds a new album version with a new snapshot. Backups include the new tables, and `markForReview` covers takes.
19. The tutor's lesson context (`get_lesson_context`, §10.3, and the context chips) names the song: its title, style, the learner's cells and today's line. No new tools.

**Validation** (`content/validate/unit-songs.ts`, run by `content/validate/unit-songs.test.ts` and by `content:check` for a lesson in a song). For every song: every flavour evaluates, is not silent and lints in profile `band`; matches `meter` and the section lengths, with events for each part in every section it plays; sections, parts, chord roots, bass downbeat roots and lead pitches agree across flavours; the clash scan passes per flavour; ids, terms and the ledger are valid. For every plan: each lesson of the unit appears once, in syllabus order; take Makes are in the song's meter and in the key of every section they play in; `sections`, `parts` and `oakKeeps` name real ids; `parts` ⊇ the parts the passing reference code plays; with `oakKeeps` the reference passes the clash scan against those Oak parts; from U09.L02 a reference that uses `arrange()` names sections that map onto the song's types; `startFrom` names an earlier take step that is completed before this one in every legal order (never an optional, side or passable lesson, which the app opens past) and whose passing reference lints and evaluates at this lesson and does **not** already meet today's required rule; `today` passes the lesson's voice and terms checks; `releaseAfter` exists and comes after the last take step.

## 6. Grading rules

### 6.1 Principles

Deterministic graders alone decide pass or fail. Code answers are evaluated headlessly and compared as normalized events (`NEvent`), never as text. The first unassisted attempt is the mastery signal. `status: 'error'` (syntax error, timeout, mic not detected) is not an attempt. The tutor never changes a `GradeResult`.

### 6.2 Tracks, labels, mute and solo

1. Graders select tracks by label or by role (`TrackRef`). The label set and the label → role map are in STYLE §2. Role resolution: labels `drums kick snare hats perc` → `@drums`; `bass` → `@bass`; `chords pad` → `@chords`; `mel vox` → `@melody`; `keys gtr horns` and any other label → `inferRoles`. `inferRoles` decides in this order: (a) a track whose events are all drum sounds is drums; (b) a pitched track is polyphonic, and so chords, when at least 25% of its onsets carry two or more pitches; (c) among the remaining monophonic tracks, the one with the lowest median pitch is bass if that median is below C3 (MIDI 48); (d) the monophonic track with the highest median pitch is melody, and any others are extra melody lines. A single monophonic track is melody unless its median is below C3. Ties go to the track written first.
2. `$:` lines are accepted everywhere: they become `$0`, `$1`, … and are read through `inferRoles`, with the info note `code.dollar-label`. Content never uses `$:`.
3. **UI mute and solo never rewrite code.** The adapter's `beforeEval` hook wraps `Pattern.prototype.p` (after the repl injects it) and maps UI-muted labels to `silence`; solo mutes every other label. The editor text, highlight offsets and saved code are untouched.
4. **The grader ignores UI mute state.** It evaluates the code as written with its own `.p` collector. A track the learner muted with the button is still graded. A track muted in code (`_drums:`) is silent for the grader too, and the lint says so (`code.muted-label`).
5. Band tracks are collected as `band.<label>`, are never matched by `'*'` or a role, and can be named explicitly (`harmony: 'band.chords'`) so a melody can be checked against the Band's chords. **Unit songs (§5.11):** Oak's song tracks are `band.oak.<label>` and a carried learner take's tracks are `band.take.<lessonId>.<label>`. Both start with `band.`, so this rule covers them: `'*'` and roles never match them, and no rubric names them, because the grader is never given a song (§5.11 rule 1).

### 6.3 Form: one `arrange()` per labelled track

1. A piece with sections is written as section patterns in `const`s and **one `arrange()` per labelled track** (STYLE §10). Every arranged track has the same number of sections with the same lengths in bars.
2. Section names come from the identifiers: `<role><Section>` in camelCase (`bassVerse`, `melChorus2`). The role prefix is stripped, the rest is lower-cased; a trailing digit distinguishes variants of the same section type (`chorus2` is a chorus). `silence` is allowed as a section for a track that rests.
3. `sectionsFromAst` returns `{ label, bars }[]` only if all arranged tracks agree; otherwise the form rules fail with `form.inconsistent-arrange` and name the first disagreement. Tracks without `arrange()` are "through" tracks and do not take part in form detection. At least one arranged track is needed for a `form`, `contrast` or `key-change` rule.
4. The `form` rule accepts section names (`'verse chorus verse chorus'`) or letters by first appearance (`'ABAB'`); `?` matches any section. A tagged section (`chorus2`) matches its type.
5. `key-change` and `contrast` take `SectionRef`s resolved through the same section list. A key lift needs a final section of at least 8 bars (`minBarsAfter`), which removes the old "two 4-bar windows" problem.
6. `arrange()` may be followed by a method chain on the same track (`arrange(…).scale("…").s("piano").room(.2)`). A track is "arranged" when its labelled expression has exactly one `arrange()` call at the root of that chain; `sectionsFromAst` reads it there.
7. **Sections restart.** Executed against 1.2.6: inside `arrange()` each section plays from its own cycle 0 (`arrange([2, a], [3, b], [2, a])` plays a's first two bars both times). Two consequences bind. A section's bar count must be a whole multiple of its pattern's period, or the idea is cut off mid-way (`form.section-period`, a warning). And anything that must change **across** sections (a key plan, a long build) is applied after `arrange()`, never inside a section const (§6.8 item 4). The grader evaluates the first pass of the piece only.
8. Golden rubric tests cover the convention: for each of `form`, `contrast`, `key-change` and `groove-lock`, one piece that passes under per-track `arrange()` and one that fails only because two tracks disagree about the sections.

### 6.4 Grading modes and caps

| Mode | Used by | Bars queried | Timeout | Hap cap | Total length |
|---|---|---|---|---|---|
| `lesson` | lesson steps, Make, drills, checkpoints, gym L1–L5 | `min(64, max(reference.bars, min(16, periodOf(answer))))` | 1500 ms (worker killed and respawned) | 20 000 | from the query |
| `capstone` | every capstone, CF-T, gym L6 and L8 | the whole piece, at most **128 bars** | **5 s** | 60 000 | `totalBars` = the `arrange()` sum from the AST, else `periodOf` up to 128; `durationSec = totalBars / cps` is **computed, never played** |
| `tutor` | `evaluate_strudel`, `compare_haps` | a window of at most 16 bars starting at `fromBar` | 1500 ms | 5 000 | — |

A piece longer than 128 bars is graded on its first 128 with `eval.truncated`; `durationSec` and `bars` rules still use the AST total. `periodOf` is capped at 16 in `lesson` mode and 128 in `capstone` mode.

### 6.5 Make steps and going past the brief

1. A Make step (`CodeMakeEx`) has **exactly one** rule with `required: true`: the lesson's concept. Content CI rejects 0 or 2+. Every other rule is a suggestion, shown as an unticked or ticked line, never as ✗.
2. Pass = the required rule is met and the code evaluates and is not silent. Saving is never blocked: "Save anyway" stores a draft and the open item becomes a tutor talking point.
3. Going past the brief is never a failure: more bars than asked, extra tracks, extra unlocked tools, a different tempo inside the allowed range all produce at most the info note `make.beyond-brief` ("You went past today's brief. Nice."). Only two things are refused in a Make: locked tools (§3.1 rule 4) and a broken required rule.
4. Capstones (`ComposeBriefEx`) list several required rules (§6.6); the "one required rule" limit is for lesson Makes only.
5. Rubric rules feed evidence at weight 1.5 to their `skills` only when the code was typed by the learner (§10.7).

### 6.6 Capstone rubrics (binding fixes)

All capstones: flavour never changes a rubric; progressions compare on the **triad core** (root pitch class + triad quality), so sevenths and extensions pass; every rubric is tested with at least one passing piece per shipped flavour.

| Capstone | Required rules |
|---|---|
| **C0 Intro** | 4/4; `bars` 4–8; `tracks` ≥2 drum-role lines; `onsets` snare ⊇ {1/4, 3/4} per bar in ≥3 bars; hats on an 8th or 16th grid; the last bar's drum onsets differ from bar 1 (a fill); `tempo-bpm` 70–140 |
| **C1 First Loop** | roles drums + bass + melody present; `bars` = 4; snare ⊇ {1/4, 3/4}; bass within c1–c3 with `distinct-pitches` ≥ 3; melody `range` ≤ 15 st; `tempo-bpm` 70–140 |
| **C2 Four-Chord Song** | `bars` = 8; roles chords + melody; `progression`: bars 1–6 are an H04-family schema loop in any rotation (bars 1–4 one full turn, bars 5–6 its first two chords), one chord per bar; `cadence` at bars 7–8 of type PAC, IAC or PC (authentic, perfect or imperfect: V→I, or vii°→I as an imperfect cadence; or plagal: IV→I or iv→I), ending on I; `chord-tones-strong` ≥ 0.6 on beats 1 and 3; melody `range` ≤ 19 st; `motif-reuse` ≥ 0.5 (`shape: 'either'`), labelled "Repeat or vary your bar-1 idea in half the bars or more". Suggestion only: melody ends on 1. The brief shows the "loop, then land" template. |
| **X1 Folk Transcription** | Opens when U07.CP is passed (soft pass counts), C2 is released and `fam.mel.dictation` is at level ≥ 4; otherwise Today says "Two more gym sets open X1" and schedules them. Given to the learner: meter, key, tonic, pickup position, the rhythm skeleton of phrase 1. Worked phrase by phrase (4 bars each) with A/B and a check per phrase: `Matcher {m:'melody', pitch:'key-relative'}` ≥ **0.85** per phrase. Chords in S3 by bass-first stages (`harmony`, level `rn`, triad depth) ≥ **0.85** per stage. A revealed phrase earns no evidence and is named in the liner notes. |
| **C3 Verse–Chorus Demo** | `form` = `verse chorus verse chorus` (tags allowed); `contrast(chorus, verse)` on ≥ 2 axes; `duration-sec` ≥ 90 (from the AST); `groove-lock` bass-on-kick ≥ 0.5; the lead sheet renders with `approximate = false` (a declared `swing` is carried by the notation, so swung flavours pass) |
| **C4 Minor Indie Ballad** | verse `progression` = `schema.aeolian`; `contains-rn` V (major, with the raised 7) followed by i, ≥ 1; melody `degree-set` contains ♭3 and ♭6; `ends-on-degree` 1 over i; `tempo-bpm` 60–95 |
| **C5 12-Bar Shuffle** | `blues-form` standard or quick-change, ≥ 2 choruses; every chord is a dominant seventh (read from its symbol; from the pitch-class set only for a hand-voiced chord); `swing` (subdivision 8) on the hi-hat or ride line, ratio in [1.6, 2.4]; bar 12 contains V; melody uses ♭3 or ♭5 ≥ 2×; riff `motif-reuse` ≥ 0.6 |
| **X2 Blues Transcription** | bass ≥ 0.90; changes ≥ 0.85; melody ≥ 0.85; stages in that order |
| **C6 Modal Vamp** | `mode` with `requireCharacteristic` (♭7 or ♮6 on a strong beat ≥ 2×); no leading tone (Mixolydian) or no ♭6 (Dorian); tonic chord in ≥ 40% of bars; `bars` ≥ 16 |
| **C7 Chromatic Colour** | `contains-rn` secondary dominant ≥ 1 with `mustResolve`; ♭VI–♭VII–I present; `key-change` at the last chorus by +1 or +2 with `sameMelody` and `minBarsAfter` 8; `bars` ≥ 32 |
| **CF-A Album Single** | `device-count` ≥ 4 of {secondary dominant, borrowed chord, modulation, suspension, syncopated bass, modal colour}; `form` contains a bridge; `duration-sec` ≥ 120 |
| **CF-T Standard Transcription** | melody ≥ 0.90; changes ≥ 0.85 per bar; form map correct; session by session (bass → changes → melody → arrange) |
| **JC1 ii–V Ballad** | `bars` = 16; `custom ii-v-chain` with ≥ 3 distinct target keys; `guide-tones` melody-on-3rd-or-7th at chord changes ≥ 0.7 with motion ≤ 2 st; `tempo-bpm` 56–92. Twelve-key coverage lives in `fam.jzz.ii-v`, not here. |
| **JC2 Jazz Blues in F** | `blues-form` jazz; `custom walking-bass` (4 onsets per bar, root on beat 1 ≥ 75%, beat-4 approach ≥ 50%); **`swing` measured on the ride or comping track**, ratio in [1.6, 2.4], never on the quarter-note bass; comping and bass derive from one `chord()` pattern (`uses tb.set` or `tb.rootNotes`) |
| **JC3 Rhythm-Changes Contrafact** | `form` AABA, 32 bars; changes match `schema.rhythm-A` and the bridge D7 G7 C7 F7; `chord-tones-strong` ≥ 0.55; ≥ 50% of bridge changes are met by a 3rd or 7th on the downbeat |
| **JC4 Reharmonize a Standard** | `matches` melody identical to the reference; `custom allowed-tensions` ≥ 0.85; `device-count` ≥ 3 of {tritone sub, secondary ii–V, backdoor, diminished passing} |
| **RC1 16th-Note Funk** | `velocity-ghosts` ≥ 4 on 16th off-beats; bass `syncopation` with ≥ 3 onsets off the 8th grid; bass and kick both at beat 1 of every bar; a track labelled `horns` with at least 2 onsets in every 2 bars (stabs; any unlocked sound) |
| **RC2 Clave & Polyrhythm** | `clave` son 3-2 on the **2-bar 8th grid** (1 cycle = 1 bar): bar A onsets {0, 3/8, 6/8}, bar B onsets {2/8, 4/8}, for ≥ 8 bars; bass ⊇ tresillo {0, 3/8, 6/8} on every 3-side bar (every bar also passes); `polyrhythm` 3:2 between two named tracks (3 even onsets against 2 per bar); `uses tb.mini.euclid` ≥ 1. For reference, the `clave` rule's other grids: son 2-3 swaps the two bars; rumba 3-2 is bar A {0, 3/8, 7/8}, bar B {2/8, 4/8}. |
| **AC1 One Tune, Two Genres** | Opens after A.CP + U11.CP. Both versions: `matches` melody pitch-class sequence = reference; Δ tempo ≥ 20 BPM or one swung and one straight; instrument sets differ by ≥ 2 sounds; each version `uses` ≥ 1 A1 tool |
| **AC2 Neo-Soul Ballad** | chords include a 9th or 11th in ≥ 60% of bars; `swing` on the hats track with subdivision 16, ratio in [1.2, 2.4]; `voice-leading` top voice ≤ 2 st on ≥ 80% of changes; `sounds` contains `snd.rhodes`. Laid-back feel is written with `.late()`; `nudge` is not accepted. |

**Release.** A capstone's first release requires that its latest passing check graded the code being released (a draft edited after its check is checked again); a revision of a released track is not re-checked (decision 45 in `docs/decisions.md` and migration 0005).

**Which track a `swing` rule measures.** `track` is a list in priority order. The rule uses the first listed track that, after the optional `drums` filter, has at least 4 measurable beats on the rule's subdivision (a beat is measurable when it has an onset at its start and exactly one inside it). C5 uses `track: ['hats', '@drums'], drums: ['hatClosed', 'hatOpen', 'ride'], subdivision: 8`; JC2 uses the same list followed by `'chords'`; AC2 uses `['hats', '@drums']` with `subdivision: 16`. If no listed track is measurable the rule fails with `rhythm.swing-missing` and names the line to swing.

Every capstone also gets a tutor review (§10.6), which never affects pass or fail.

### 6.7 Voicings

1. `voicing()` output is graded **only** by pitch-class set per chord and by bass pitch class (`Matcher {m:'pcset', perOnset:true, bass:true}` or the `harmony` matcher). Never by octave, top note, note count or spelling: these differ between 1.2.6 and Strudel main.
2. The grader realm wraps `Pattern.prototype.voicing` with the `_oakChord` shim (`this.fmap(v => ({ ...v, _oakChord: v.chord }))` before the original call) so the source symbol survives on each voiced note. Executed on the main thread against 1.2.6: the tag survives `.voicing()`, `.s()`, `.struct()` and the `n(…).chord(…).voicing()` form (whose notes come out as MIDI numbers, not names). **Chord identity (root, quality, Roman numeral, triad core) always comes from the symbol**, because rootless, extended and two-note voicings cannot be identified from their notes (§0.25). If spike S1 finds the shim unreliable inside a Worker, the fallback is the symbol read from the event's source location (`locs` → the mini-notation leaf inside `chord("…")`); `identifyChord` on sounding notes is used only for hand-voiced note lists and `n()` stacks.
3. `mode("above")` is a lint error everywhere. Allowed modes: `below` (default), `root:<note>`, `duck`.
4. Hand voicings (U05.L07) are graded with `voice-leading` (`maxMovePerVoice`, common tones kept) plus the `pcset` matcher.
5. Inversions and slash chords are read from the lowest sounding note across all pitched learner tracks at the chord's onset, so a separate `bass:` track sets the inversion. A default `voicing()` with no bass track often has the 3rd or 5th lowest (`chord("C").voicing()` → E3 C4 E4 G4 C5), so a rule that needs root position (`cadence` PAC) is only authored where the lesson has given the learner a way to put the root in the bass.
6. A `(symbol, dict)` pair that Strudel voices wrongly (`Caug` in `triads`, `C69` in `lefthand`) is treated exactly like a missing pair: lint error `code.chord-not-in-dict`, never authored, never an expected answer. STYLE §5.2 is the list; a content-CI test re-derives it by voicing every pair and comparing pitch classes with `@oak/theory`.
7. `@oak/theory` owns the single chord-spelling table (STYLE §5.1): quality ↔ code spelling ↔ lead-sheet display ↔ jazz glyph. `parseChordSymbol`, `toLeadSheet`, `toCode` and the lint's chord-family map all derive from it; no other package spells a chord.
8. **The written exception (2.2): a chord shape is graded on its notes.** Where a step's point is one chord shape moved as a block (U06.L13 Parallel Chords, the custom rule `same-shape`), the shape is read from the sounding notes of hand-voiced chords: the half-step gaps inside every chord of the track are equal and the chord sits at ≥ `minShifts` different heights. `.voicing()` is refused there, because it moves each chord's notes to the nearest place and so changes the shape; the rule says so in its detail line. The same holds for quartal stacks (J3.L05, `stack-intervals`) and for `bass-names-chord`, which names the chord from its notes and the bass under them. Everywhere else rules 1–7 stand.

### 6.8 Key-relative analysis and key changes

1. Key-relative pitch (degrees, `alignMelody` in `key-relative` mode, liner-note degrees) uses, in this order: the exercise or lesson key; the event's `scaleCtx`; a per-section `keyEstimate`. A failing capstone check whose piece reads in another scale than the brief's key says so first (`harmony.key-mismatch`, a warning; it never changes the result).
2. `.transpose()` after `.scale()` leaves `scaleCtx` unchanged (verified: after `.transpose(2)` the context still says `C4 major`). Therefore key changes are **taught and written with a patterned `.scale()`** (`.scale("<C4:major!8 D4:major!8>")`), which keeps `scaleCtx` correct per section (verified).
3. If the AST has a `.transpose` later in the same chain as a `.scale`, analysis ignores `scaleCtx` for that track and uses the per-section `keyEstimate`; the lint adds `code.transpose-after-scale` (warning for learners, error in content).
4. **Key changes in an arranged piece.** Sections restart (§6.3 item 7), so a patterned `.scale()` inside a section const never reaches its later keys. The binding form, executed against 1.2.6: section consts are bare degree patterns and the key plan follows `arrange()` on each pitched track, counted in bars of the whole piece:

   ```js
   const melVerse = n("<[0 2 4 2] [4 2 1 ~]>")
   const melChorus = n("<[7 6 4 2] [4 ~ 2 ~]>")

   mel: arrange([8, melVerse], [8, melChorus], [8, melChorus]).scale("<C4:major!16 D4:major!8>").s("piano")
   ```

   The alternative is a lifted section with its own const (`const melLift = melChorusNotes.scale("D4:major")`). Chord tracks written by degree (`n("[0,2,4]").add(n("<0 4 5 3>"))`) take the same key plan after `arrange()`; `chord("…")` tracks need a lifted const with the new symbols. Both forms keep `scaleCtx` right per bar. The lint flags a patterned `.scale()` inside an arranged section (`code.arranged-scale-pattern`).

### 6.9 Meter and tempo (`tempoUnit`)

1 cycle = 1 bar, always. `cpm = bpm / unitsPerBar`, where `bpm` counts the meter's tempo unit. The tempo line is always written as a division that shows the BPM.

| MeterId | Tempo unit (what BPM counts) | Units per bar | Tempo line | Grouping (in eighths for /8) | Beat labels |
|---|---|---|---|---|---|
| `4/4` | quarter | 4 | `setcpm(bpm/4)` | 1+1+1+1 | 1 e & a |
| `3/4` | quarter | 3 | `setcpm(bpm/3)` | 1+1+1 | 1 e & a |
| `2/4` | quarter | 2 | `setcpm(bpm/2)` | 1+1 | 1 e & a |
| `6/8` | dotted quarter | 2 | `setcpm(bpm/2)` | 3+3 | 1 la li |
| `9/8` | dotted quarter | 3 | `setcpm(bpm/3)` | 3+3+3 | 1 la li |
| `12/8` | dotted quarter | 4 | `setcpm(bpm/4)` | 3+3+3+3 | 1 la li |
| `5/4` | quarter | 5 | `setcpm(bpm/5)` | declared: 3+2 or 2+3 | 1 e & a |
| `5/8` | eighth | 5 | `setcpm(bpm/5)` | declared: 2+3 or 3+2 | group counts |
| `7/8` | eighth | 7 | `setcpm(bpm/7)` | declared: 2+2+3, 2+3+2 or 3+2+2 | group counts |
| `9/8i` | eighth | 9 | `setcpm(bpm/9)` | declared: 2+2+2+3 (or a rotation) | group counts |

- `METERS: Record<MeterId, MeterSpec>` in `@oak/theory` is the only implementation; `bpmToCpm(bpm, meter)` and `cpmToBpm` have a golden test per row. `bpm = cps · 60 · unitsPerBar`.
- The `tempo` constraint compares BPM through this table and accepts any expression that evaluates to the right cpm; `setcpm(30)` for 120 BPM in 4/4 passes with the note `code.setcpm-form`. A value off by exactly the `unitsPerBar` factor gets the specific hint ("That is 480 BPM: divide by the beats per bar").
- A piece does not change tempo or meter mid-way. The per-hap `cps` control is not taught and is ignored by the grader. Metric modulation (R2.L05) is taught only as implied: a new grouping of the same subdivision at a constant cycle length.

### 6.10 Swing

1. **Convention.** Eighth-note swing is `.swingBy(1/3, unitsPerBar)`: `swingBy(1/3, 4)` in 4/4, `swingBy(1/3, 3)` in 3/4. Sixteenth-note swing is `.swingBy(1/3, 2 * unitsPerBar)`: `swingBy(1/3, 8)` in 4/4. Verified: `s("hh*8").swingBy(1/3, 4)` puts the off-beats at 2/3 of each beat; `swingBy(1/3, 3)` does the same in a 3-beat bar; `swingBy(1/3, 8)` swings 16ths. With amount `x` the off-beat sits at `(1 + x) / 2` of its slot. `.swing(n)` equals `.swingBy(1/3, n)`. Swing is not used in compound meters.
2. **Metadata.** A lesson, exercise, song or sketch that swings declares `swing: { subdivision: 8 | 16, amount }`. For learner sketches the notation pipeline fills it from `swingRatio` when the class is `light`, `triplet` or `hard` on a consistent subdivision.
3. **Notation.** `NotationInput` carries `swing?: SwingSpec`. Before quantizing, onsets and durations on the swung subdivision are mapped back to the straight grid, and the score prints "Swing 8ths" or "Swing 16ths" above the first bar. A swung piece therefore renders with `approximate = false`. An amount other than 1/3 prints the same text; the amount is shown in the liner notes.
4. **Grading.** Rhythm, melody and harmony matchers compare on the straightened grid when the reference declares `swing`. If the answer is straight where the reference swings (or the reverse) the onsets still match and the result carries `rhythm.swing-missing`; the step fails only if it has a `swing` rule or constraint. The `swing` rubric rule always names its track and needs on-beat plus off-beat onsets on the swung subdivision in at least 4 beats; quarter-note lines are not measurable (verified: quarter notes are unchanged by `swingBy`).
5. Patterned amounts use decimals (`.swingBy("<0 .1 .2 .33>", 4)`); a fraction inside the string is the lint error `code.swing-fraction-string`.
6. **Straightening, exactly.** `swingBy` delays the off-beat event by `amount / 2` of a slot (a slot is a beat for 8th swing, half a beat for 16th swing) and keeps every event's length, so a swung off-beat note overlaps the next slot and the last one of a bar crosses the bar line (§0.26). Straightening subtracts `amount / 2 × slot` from the onset of each off-beat event and leaves durations alone; the notation quantizer then clips a note at the next onset on its track.

### 6.11 Pickups (anacrusis)

1. **Code.** The pickup is written as leading rests in bar 0, the first cycle: in 3/4 with a one-beat pickup, bar 0 of the melody is `[~ ~ 4]`. Other tracks rest in bar 0 or play a count-in. The piece is `N + 1` cycles long; the last cycle is written in full.
2. **Metadata.** The lesson, exercise or song declares `pickup: { units }` (length in tempo units). Without the metadata there is no pickup: leading rests are just rests.
3. **Positions.** With a pickup, cycle 0 is "the pickup bar" and bar numbering starts at 1 on the first full bar (cycle 1). Diagnostics say "pickup" instead of "bar 0".
4. **Notation.** Bar 0 is engraved as a partial measure containing only the pickup. If the final bar ends with rests at least as long as the pickup, it is shortened by the pickup length; otherwise it is left whole.
5. **Grading.** Matchers align in absolute cycle positions. An answer that is the reference shifted so that the pickup lands on the downbeat gets `rhythm.pickup-missing` in place of per-note errors, and the usual displacement credit (0.5).
6. X1 and every PD song state the pickup; the learner is told it.

### 6.12 Transcription grading and realism

- Ladder L1–L6 answers are Strudel code graded by the layer's matcher against the hidden reference (`TranscribeStepEx`, `grading.mode: 'auto'`), pass ≥ 0.85 unless §6.6 says otherwise. Tempo, meter, key and pickup are given. A/B against the original is free; hints follow the normal ladder.
- **Pattern source.** Ladder stimuli (L1–L6, X1, X2, CF-T) have no audio file. The hidden reference code plays through a second, hidden adapter instance: rate is a cps scale (25–100%), transposition is `.transpose(semitones)` on the pitched tracks, the A–B loop is `.ribbon(fromBar, bars)`, and a bar timeline replaces the waveform and spectrogram. Fine-tune is disabled for pattern sources. The hidden code never enters an editor or the DOM, and reaches the tutor only as §10.5 allows.
- Own-audio work (L7, L8) is `grading.mode: 'self'`: a checklist, `status: 'ungraded'`, evidence weight 0.3 flagged `selfReported`.
- **Realism levels** for generated and PD stimuli, raised one step each time two consecutive ladder sessions pass at ≥ 0.9, lowered after one below 0.6: R0 clean and quantized; R1 timing humanized ±15 ms and velocity ±0.1; R2 swing or shuffle feel where idiomatic, plus room; R3 dense mix with the target part 6 dB down; R4 vocal-like lead (`tenor`, `choir`) and detune up to ±30¢. Grading tolerances do not change with realism; answers stay on the grid.
- Transcribe has rate 25–100%, ±12 semitones, **±50¢ fine-tune**, A–B loop. "Hum it, Oak drafts it" turns a sung line into a draft `n("…").scale("…")` line that the learner must edit and confirm; the draft is flagged machine-made and gives no evidence until the learner's corrected version is checked.

## 7. SRS, governor, mastery, gates, streak, return policy, map shading

One numeric spec. It is implemented in `@oak/srs` (schedulers, governor, planner), `server/services/{mastery,gates,streak,session-plan}` and nowhere else. All constants live in `packages/srs/src/constants.ts`.

### 7.1 Cards and schedulers (ts-fsrs 6.0.0, `DefaultScheduler`, FSRS-7)

| Card kind | One card per | Desired retention | Short-term steps | Fuzz | Max interval |
|---|---|---|---|---|---|
| `fact` | atomic fact (`fact.*`) | 0.90 | `learningSteps: ['5m']`, `relearningSteps: ['5m']` | on | 365 d |
| `concept` | concept family (`fam.*` of kind concept) | 0.90 | none (`enableShortTerm: false`) | on | 180 d |
| `family` | perceptual or production family | 0.85 | none | on | 180 d |
| `composite` | `fam.mix.pitch`, `fam.mix.harmony`, `fam.mix.rhythm` | 0.80 | none | on | 365 d |

- **One FSRS card per drill family.** Levels, per-category statistics and confusion pairs live in `family_state`, not in cards. Categories drive sampling and feedback only. There are no per-degree or per-quality cards.
- A 5-minute learning step that comes due inside the running session is shown in a "quick recall" strip between New and Make (at most 3 cards, 30 s); otherwise it is first in the next warm-up.
- Card JSON is stored with `model: 'FSRS-7'`. Retrievability `R` comes from `scheduler.model.forgettingCurve`.

### 7.2 Grade map

A review of a family card is one **set** of 5–8 freshly generated trials (new key, register and instrument each trial).

| Rating | Condition (first match wins) |
|---|---|
| Again | the answer was revealed, **or** mean credit < 0.65 |
| Hard | mean credit < 0.80, **or** any extra replay beyond the level's limit, **or** hint rung ≥ 2 was used |
| Easy | mean credit ≥ 0.95 **and** median response time ≤ the family's `fastRtMs` **and** the set was played at or above the card's level (production families also need mean \|cents\| ≤ half the tolerance) |
| Good | everything else |

- Credit is graded against the level actually played (75% of trials at the current level, 25% one level down).
- Fact cards: wrong → Again; right but hinted or slower than 3 × `fastRtMs` → Hard; right within `fastRtMs` → Easy; else Good.
- Lesson steps that seed or review a card use the same table on the step's first-attempt `adjustedScore`, with the rung caps of §5.3.
- Replay multiplier on evidence: `max(0.6, 0.9^extraReplays)`.
- A disputed attempt (§11.8) and a mic-less skip produce no rating.

### 7.3 Family catalog and composites

Families are the exercises §4.4 catalog with the `fam.` prefix, re-pointed at the new lesson IDs. Ladders, level parameters, randomization codes, `fastRtMs` and `masteryLevel` are as in exercises §4.4 unless a row says otherwise. Kind: C concept, P perceptual, Pr production, F fact deck. "Mix" is the composite a graduated family joins.

| ID | Kind | Unlocks at (later level gates) | Node(s) | Mix |
|---|---|---|---|---|
| `fam.rhy.pulse` | Pr | U01.L01 | R01, E01 | rhythm |
| `fam.rhy.echo` | Pr | U01.L04 (L5 U13.L01; L6 U11.L07, its triplet items from U13.L05; L7 U13.L04) | E01 | rhythm |
| `fam.rhy.read` | Pr | U01.L05 (dotted and tied figures from U13.L03) | N01 | rhythm |
| `fam.rhy.count` | C | U01.L04 (L2 U01.L06; L3 U13.L05; L4 U13.L04) | R05, R07 | — |
| `fam.rhy.meter` | P | U01.L08 (L3 U13.L04; L5 R2.L01) | R08, R11, R16 | rhythm |
| `fam.rhy.dictation` | P | U01.L09 (L5+ U13.L06) | E01, E14 | rhythm |
| `fam.rhy.groove-lock` | P | U08.L04 | B04 | rhythm |
| `fam.rhy.swing` | P | U11.L07 (L4 R1.L02) | R13 | rhythm |
| `fam.rhy.syncopation` | P | U13.L01 | R10 | rhythm |
| `fam.rhy.subdivision` | P | U13.L05 | R12 | rhythm |
| `fam.rhy.odd-grouping` | P | R2.L01 | R16 | rhythm |
| `fam.rhy.polyrhythm` | P/Pr | R2.L04 | R17 | rhythm |
| `fam.rhy.clave` | P | R3.L01 (L2 R3.L02) | R18 | rhythm |
| `fam.pit.match` | Pr | U00.L02 | V01 | pitch |
| `fam.pit.compare` | P | U02.L01 | E02 | pitch |
| `fam.pit.keyboard` | C | U02.L02 (L2 U02.L03) | P02, P04 | — |
| `fam.pit.steps` | P | U02.L03 | P03 | pitch |
| `deck.pit.staff-names` | F | U02.L04 treble; U05.L06 bass | N02, N04 | — |
| `fam.not.read` | C | U02.L08 (accidentals U03.L06; bass clef U05.L06; lead sheet U07.L09) | N02, N03, N04, N07 | — |
| `fam.key.scale-spell` | C | U03.L01 (L3 U10.L01, harmonic and melodic forms from U10.L06 and U10.L08; L4 U11.L01, blues from U11.L03; L5 U14.L01, each mode from its own lesson) | S01 | — |
| `fam.deg.tonic` | P/Pr | U03.L01 (L4 U10.L01; L5 U14.L01) | E03 | pitch |
| `fam.deg.fet-major` | P | U03.L02 with {1,5} then {1,3,5} (L2 U03.L03; L3 U03.L04) | E04, E05 | pitch |
| `fam.deg.sing` | Pr | U03.L02 | V02, V03 | pitch |
| `fam.deg.index` | C | U03.L02 (L3 U10.L01; L4 U14.L01; new L5 U15.L01: chromatic steps ♯4 ↔ `3#`, ♭7 ↔ `6b`, ♭3 ↔ `2b`, ♭6 ↔ `5b`, ♭2 ↔ `1b`) | S02 | — |
| `fam.deg.resolve` | Pr | U03.L04 (L4 U10.L03) | V03 | pitch |
| `deck.key.signature` | F | U03.L06 sharps; U03.L07 flats; U10.L02 minor | S04, N03 | — |
| `fam.key.circle` | C | U03.L07 (L2–L3 U10.L02) | S04, S06 | — |
| `fam.mel.sight` | Pr | U03.L09 | V04 | pitch |
| `fam.mel.dictation` | P | U03.L10 | E07 | pitch |
| `fam.mel.echo` | Pr | U03.L10 | V03 | pitch |
| `fam.int.in-key` | P | U04.L01 | E06 | pitch |
| `fam.int.spell` | C | U04.L02 (aug/dim U05.L03) | I02, I03 | — |
| `deck.int.names` | F | U04.L02 (tritone U04.L03; the half-step counts U12.L06) | I02, I03 | — |
| `fam.int.sing` | Pr | U04.L04 | V03 | pitch |
| `fam.int.isolated` | P | U12.L06 | E06, I04 | pitch |
| `fam.chd.quality-triad` | P | U05.L02 (L3 U05.L03) | E08 | harmony |
| `fam.chd.spell` | C | U05.L02 (L2 U05.L03; L3 U12.L01; L4 J2.L03) | C02, C03, C07 | — |
| `deck.chd.triads` | F | U05.L02 (diminished and augmented U05.L03) | C02, C03 | — |
| `deck.chd.symbols` | F | U05.L09 (U11.L04, U12.L01, U12.L03, J1.L02) | N05, J01 | — |
| `fam.chd.inversion` | P | U05.L05 (L3 U12.L04) | C04 | harmony |
| `fam.har.rn` | C | U06.L02 (L3 U10.L04, the harmonic-minor V from U10.L06; L4 U12.L04; L5 U15.L02, U16.L01) | N06 | — |
| `deck.har.rn` | F | U06.L02 | N06 | — |
| `fam.har.function` | C/P | U06.L03 (L3 U10.L04; L4 U12.L04, applied chords from U15.L02) | H02 | harmony |
| `fam.har.cadence` | P | U06.L04. Ladder re-cut to the merged lesson: L1 PAC vs HC · L2 + IAC · ★L3 + plagal and deceptive (gate U06.L07) · L4 + ♭VII–I and minor cadences (gate U14.L02) | H03 | harmony |
| `deck.har.cadence` | F | U06.L04 (deceptive U06.L06; plagal U06.L07) | H03 | — |
| `fam.har.bass` | P | U06.L05 (L5 U10.L04; L6 U15.L06, U16.L05) | E09, V05 | harmony |
| `fam.har.schema` | P | U06.L06. Ladder re-cut to the lesson order: L1 axis vs three-chord · L2 + axis-vi, doo-wop (U06.L07) · ★L3 + aeolian, andalusian (U10.L07) · L4 + blues12 (U11.L05) · L5 + mixolydian, dorian vamp (U14.L06) · L6 + ii–V–I (J1.L03) | H04, H05 | harmony |
| `fam.har.progression` | P | U06.L09 (L4 U10.L04; L5 U12.L04; L6 U16.L05) | E09 | harmony |
| `fam.mel.nct` | P/C | U07.L04 (L2 U07.L05) | M04, M05 | pitch |
| `fam.frm.sections` | P | U09.L03 | F02, F03 | harmony |
| `fam.key.mode` | P | U10.L01 (L3 and L4 U14.L03; L5 U14.L05) | E10 | pitch |
| `deck.scl.modes` | F | U14.L01 (♭VII U14.L02; Dorian U14.L03; Lydian U14.L04; Phrygian U14.L05) | S12 | — |
| `deck.scl.degrees` | F | U10.L01 (harmonic U10.L06; melodic U10.L08; pentatonic U11.L01–L02; blues U11.L03) | S05, S07, S08, S09, S10, S11 | — |
| `deck.key.minor` | F | U10.L02 (harmonic minor U10.L06; melodic minor U10.L08) | S06, S07, S08 | — |
| `fam.deg.fet-minor` | P | U10.L03 | E10 | pitch |
| `deck.har.minor` | F | U10.L04 (Aeolian loop U10.L05; major V U10.L06; Andalusian U10.L07) | H07, H08, H09 | — |
| `deck.chd.dom7` | F | U11.L04 | C06 | — |
| `fam.frm.blues` | P/C | U11.L05 (L4 J4.L02) | F04 | harmony |
| `deck.frm.twelve-bar` | F | U11.L05 (quick change and turnaround U11.L06) | F04, H10 | — |
| `fam.chd.quality-7th` | P | U12.L02 (L3 U12.L03; L5 J1.L02 for 6 and m6, J2.L02 for the minor-major seventh) | E11 | harmony |
| `deck.chd.sevenths` | F | U12.L01 (half-diminished and diminished U12.L03) | C07 | — |
| `deck.har.sevenths` | F | U12.L04 (minor keys U12.L05) | C08 | — |
| `fam.deg.fet-chromatic` | P | U15.L01 | E12a | pitch |
| `fam.har.chromatic` | P | U15.L06 (L3 U16.L05) | H12, E12b | harmony |
| `deck.har.applied` | F | U15.L02 (V7 of vi, ii and IV U15.L03; vii°/V U15.L04) | H12 | — |
| `deck.har.borrowed` | F | U16.L01 (♭VI and ♭VII U16.L02; ♭III U16.L03; Picardy and Dorian IV U16.L04) | H13 | — |
| `fam.har.modulation` | P | U17.L03 | E13 | harmony |
| `deck.har.pivots` | F | U17.L01 (direct lifts U17.L02) | H14 | — |
| `fam.jzz.ii-v` | P | J1.L03 (L2 J2.L02) | J04, J05 | harmony |
| `fam.jzz.guide` | Pr/P | J1.L04 | J07, V06 | harmony |
| `fam.jzz.voicing` | C | J1.L05 (L2 J3.L01; L3 J3.L02) | J08, J09 | — |
| `fam.jzz.extension` | P | J2.L03 | J02 | harmony |
| `fam.jzz.chord-scale` | C | J2.L04 | J03 | — |
| `fam.jzz.subs` | P | J5.L01 (L2 J5.L02) | J13 | harmony |
| `fam.snd.params` | P | A1.L02 (A1.L03, A1.L04) | D03, D04, D05 | harmony |
| `fam.snd.roles` | P | A2.L01 | D08 | harmony |
| `deck.jzz.symbols` | F | J1.L02 jazz glyphs ∆ – ø ° (altered dominants J2.L02; extensions J2.L03) | J01, J02 | — |
| `deck.jzz.ii-v` | F | J1.L03 ii–V–I in C, F, B♭ (all twelve keys J2.L01; minor ii–V–i J2.L02) | J04, J05, J06 | — |
| `deck.jzz.voicings` | F | J1.L05 shells (rootless A and B J3.L01; drop-2 J3.L02) | J08, J09 | — |
| `deck.jzz.tensions` | F | J2.L03 tensions and avoid notes (chord-scales J2.L04) | J02, J03 | — |
| `deck.jzz.forms` | F | J4.L01 turnarounds (jazz blues J4.L02; rhythm changes J4.L03) | J10, J11, J12 | — |
| `deck.jzz.subs` | F | J5.L01 tritone substitutes (backdoor J5.L02; secondary ii–Vs J5.L03; passing diminished J5.L04) | J13, J14 | — |
| `deck.rhy.meters` | F | R2.L01 groupings of 5/4 and 7/8 (9/8 R2.L02; hemiola R2.L03; polymeter periods R2.L05) | R16, R17 | — |
| `deck.rhy.euclid` | F | R3.L01 (k,n) patterns (rotations R3.L03) | R18 | — |
| `deck.rhy.clave` | F | R3.L02 son and rumba, 3-2 and 2-3 | R18 | — |
| `deck.snd.controls` | F | A1.L02 filters (envelopes A1.L03; space A1.L04; grit A1.L05; movement A1.L06; FM A1.L07; mix A2.L05) | D03, D04, D05, D06, D07, D10 | — |
| `fam.code.mini` | C | U01.L02; ladder re-cut to the unlock order: L1 space `*` `~` · L2 `[ ]` · L3 `@` `_` `!` · ★L4 `< >` · L5 `,` (U04.L03) · L6 `(k,n,r)`, `{ }%n` (R3.L03, R2.L05) | category per operator under the node of its unlocking lesson | — |
| `fam.code.functions` | C | U03.L02 | category per function under the node of its unlocking lesson | — |

**Level and category gates.** Every category of a family names the lesson that teaches it (`unlockAt`), and the generator samples only categories whose lesson is completed. A level opens at the gate in the table and is filled from its open categories; a family is promoted past a level only when every category of that level is open. So no trial ever asks for something untaught, even where one level of the original ladder mixes material from two lessons (the notes in brackets above name those cases).

The critique's "`fact.n-index` card" is `fam.deg.index`: its new level 5 carries the chromatic step pairs, and `packages/theory` has a golden test for each pair of STYLE §6 in C, G, F, D and E♭ major and in A minor.

`fam.not.read` is the daily **"Read it"** family: two bars shown on the staff only; the learner writes the code (or, from U03.L09, may sing it through `fam.mel.sight`). It is scheduled like any concept card and is in addition to the one "Play from the page" step every unit must contain (AUTHORING §5).

Ear stages of the plan: A = `rhy.pulse`, `rhy.echo`, `pit.match`, `pit.compare`, `deg.tonic`; B = `deg.fet-major`, `deg.sing`, `deg.resolve`; C = `int.in-key`, `mel.dictation`, `mel.echo`; D = `chd.quality-triad`, `har.bass`, `har.schema`, `har.cadence`, `chd.inversion`; E = `deg.fet-minor`, `chd.quality-7th`, `frm.blues`, `key.mode`; F = `deg.fet-chromatic`, `har.chromatic`, `har.modulation`; G = `jzz.*`; H = `rhy.syncopation`, `rhy.swing`, `rhy.clave`, `rhy.odd-grouping`. A stage is a grouping, not a gate: a family enters the warm-up at the lesson its row names. So `rhy.swing` is practised from U11.L07 (straight against swung, its first levels) beside the stage E families, and stage H continues it with swing ratios (L4, R1.L02).

### 7.4 The review-load governor

**Budgets.** Warm-up on a session day: **4 / 5 / 6 minutes** at the 15 / 20 / 25-minute target (3 minutes on checkpoint and capstone days). The planner fills the warm-up with sets and fact mini-sets (up to 10 due cards) until the estimated time reaches the budget. Leftovers stay due without any penalty or display. On a day with no lesson, `/practice/review` plans the same budget and then offers "a little more" in budget-sized blocks, up to **12 minutes** of them; the warm-up before them does not count against those 12 minutes (d22).

**Warm-up order.** (1) An anchor: the highest-R due item, or 4 trials one level down from the highest-R mastered family (evidence 0.5, no FSRS rating). (2) Repair-queue families (failed checkpoint skills). (3) By priority `2·(1 − R) + 1·blockedIntroPending + 0.5·linkedToNextLesson + 0.5·debt`. Constraints: no two consecutive sets from one domain; at most 2 mic sets (0 in Quiet mode); a 15–20 s listen-only block after every second perceptual set; first drill and first sing of a new family arrive here as blocked-intro sets on the day after the lesson that seeded them, not inside the lesson; a family's first set is planned before the opener and the priority order, after a gap too.

**Active-family cap.** At most **12** family cards of kind P or Pr are active (scheduled) at once.

**Graduation.** A P or Pr family graduates when `family_state.level ≥ masteryLevel`, the card's stability is ≥ 21 days and its last two ratings were Good or Easy. Its own card is suspended and the family becomes a member of its composite (table above). A composite review is one set of up to 10 trials: 2 per member, members rotated when there are more than 5, weighted toward the lowest recent accuracy; at most one sung member per set, none in Quiet mode. Each member's trials update its own `family_state`. A member whose credit over its last 6 composite trials falls below 0.65 is **recalled**: its own card is reactivated in the relearning state as soon as a slot is free, and until then it is sampled in every composite set.

**Gated ladders.** A family whose next level is closed by a lesson the learner has not completed counts as being at its mastery level, for graduation only, while it sits at its highest open level with stability ≥ 21 days and two Good-or-better ratings. (Otherwise `fam.rhy.read`, whose dotted figures wait for U13.L03, would hold one of the 12 slots for months.) When the gating lesson is completed the family is recalled like any other member and climbs on.

**When the cap is hit.** A new family seeded by a lesson while 12 are active is created `deferred`. If no active family is ready to graduate, the one with the highest stability at or above its mastery level graduates early; if none qualifies, the new family waits in the deferred queue (see the first-review bound) and the lesson's own in-lesson practice still counts as evidence. No family graduates, early or not, before its own first review set.

**Intake throttle.** Before any new card gets its first review, the planner computes the 7-day forecast (seconds of review due per day, sets × `trialsPerSet·estTrialSec`). New cards are created `deferred` while the forecast mean exceeds 0.85 × budget or any single day exceeds 1.25 × budget. Deferred cards are released oldest first, at most 1 family and 4 fact cards per day, when the forecast mean is below 0.70 × budget. Independent caps: at most 2 new families and 6 new fact cards per day.

**First-review bound** (decisions 27 and 30). A perceptual or production family still deferred 2 days after the lesson that seeded it is released that day whatever the forecast says: longest wait first, at most 2 a day, also while a backlog is being cleared. Room is made for it when no slot is free, the set forecast is not below 0.70 × budget, or it needs the mic and the mic sets are full. An active family at its mastery level graduates early (highest stability first); otherwise the active family with the highest stability that has had at least 3 sets of its own, its blocked-intro sets done and a last rating of Good or Easy **rests** in its composite (for a sung family, a sung one). A resting family is a composite member like any other: 2 trials when drawn, recalled below 0.65. Once no perceptual or production family is waiting, a slot is free and the set forecast is below 0.70 × budget, the family that has rested longest returns to its own card where it left off, at most one a day. A family in its composite whose next level opens comes back this way, not by the gated-ladder recall.

**Terms.** A new term becomes a glossary entry. It becomes a fact card only if `TermDef.card.testedIn` names a later lesson that tests it; CI checks that lesson exists and uses the term in a graded step.

**Evidence from other work.** An in-lesson ear, sing or tap step, a gym set and a graded transcription step count as the review of a linked card when that card is due within the next 2 days (`review-if-due`); otherwise they are evidence only and leave the schedule alone. Free practice of a card that is not due never changes its schedule.

**Display.** Raw due counts are never shown anywhere. Today says "Today's review ≈ 5 min". The Practice nav item shows a plain dot only when today's planned review is not yet done. Overflow is invisible.

**CI gate.** `bun test packages/srs` runs a 300-day simulation with the full family and deck catalog introduced in default course order, 5 sessions a week, a simulated learner at 85% mean credit (10% of sets below 0.65), for each target. It must hold: p95 planned warm-up ≤ **240 / 300 / 360 s** for 15 / 20 / 25; active P/Pr family cards ≤ 12 on every day; p95 age of the oldest undelivered due card ≤ 7 days; every perceptual and production family has its first review set within **7 days** of the lesson that seeded it, on every run and target (the learner's own breaks not counted; a family still unreviewed at the end counts the days it has waited), and no family is left unreviewed; review day p95 ≤ 720 s, counting the "a little more" review only (the warm-up is budgeted by §9.1). A failing simulation blocks the merge of any change to families, decks, schedulers or constants.

### 7.5 Mastery

Quantities, per skill node (categories roll up to their node):

```
evidence e_i = (s_i = adjustedScore ∈ [0,1], w_i, t_i)
decay_i = 0.5 ^ (ageDays_i / 45)
P = (Σ w_i·decay_i·s_i + 0.5) / (Σ w_i·decay_i + 1)          performance, shrunk toward 0.5
D = number of distinct days in the last 60 with an evidence item s ≥ 0.8
R = Σ ω_c·R_c / Σ ω_c over linked cards (ω = 2 for P/Pr families, 1 otherwise; paused cards excluded)
M = P · R                                                        strength, for display and planning
```

Evidence weights: lesson step first attempt 1.0; retry after a fail 0.3; `predict` 0.5; checkpoint item 2.0; SRS set 1.0 (+0.5 per category with ≥ 2 trials); gym set 0.5; anchor set 0.5; capstone or Make rubric rule 1.5 per rule; self-assessed transcription 0.3. Disputed attempts and tutor-typed code give none.

| Level | Condition |
|---|---|
| `new` | its introducing lesson is not open |
| `available` | its introducing lesson is open |
| `learning` | introduced; P < 0.70 or Σw < 2 |
| `practiced` | P ≥ 0.70 |
| `mastered` | P ≥ τ and D ≥ 2 and (for P/Pr nodes) the linked family is at `masteryLevel` and (for nodes in a checkpoint's range) that checkpoint is passed or soft-passed. τ = 0.90 for fact and concept nodes, 0.85 for perceptual, production and creative nodes. Creative nodes need evidence from ≥ 2 pieces. |
| demotion | mastered → practiced only when P < τ − 0.10. Low R never revokes mastery; it shows as fading (§7.10). |

Flags: `provisional` (a perceptual node in a passed checkpoint's range until it has a set ≥ 0.85 on a second day); `debt` (§7.6, §7.7); `paused` (production node with no mic, §8.5).

**The V-node rule.** Production nodes (kind `production`: R01, E01, V01–V06) never block anything: no lesson, checkpoint, capstone, unlock or can-do outside the "sing" and "tap" areas depends on them. They advance only from mic or tap evidence. When they lag they get `debt`, which only raises their warm-up priority.

### 7.6 Checkpoints and gates

**Session shape.** A checkpoint is the New block of a normal session: warm-up 3 min → checkpoint ≈ 12 min → Make 4 min ("a groove or melody using this unit's tools", which also counts as one item) → Coda. It is one part on one day. It is scheduled after the next unit's L01 (U17.CP and the track checkpoints: after any one intervening session), so it always falls on a later day than the unit's last lesson.

**Composition.** 12–18 items, at least 2 per skill in range, generated fresh at each skill's mastery level plus 2–3 authored items, interleaved. Hints and the tutor are off. Sing and tap items use the learner's current tolerance.

**What gates.** Items are tagged `gating` or `level-setting` by the kind of the skill they test:

| Skill kind | Item role | Effect |
|---|---|---|
| fact, concept, creative (code, notation, theory) | gating | counted in the pass score |
| perceptual (ear) | level-setting | sets family level and `provisional`/`debt`; **never blocks** |
| production (sing, tap) | level-setting, skipped in Quiet mode | sets level and `debt`; **never blocks**. Singing never gates anything. |

**Pass.** Weighted score over gating items ≥ **0.85** and every gated skill's item mean ≥ **0.70**.

**On pass.** The next unit's L03 and later open; the unit's capstones open; skills in range become eligible for `mastered`; linked cards get `review-if-due`; a tutor debrief is offered (chat thread, medium effort).

**On fail.** A per-skill breakdown; a repair queue of 2 sets per failed skill (or regenerated code items for concept skills) scheduled into the next warm-ups; a retake on any later day with regenerated items.

**Soft pass.** A retake (the second attempt or later) that scores ≥ **0.75** on gating items offers "Continue anyway". From the third attempt on, "Continue anyway" is offered whatever the score. A soft pass opens everything a pass opens; each gated skill below 0.70 gets `debt`, is boosted in warm-ups and is re-tested by up to 3 items in the next checkpoint.

**Gates and the legal orders.** These rules define every order in which a learner can meet the content; "every legal order" in §3.1 and §4.2 means exactly this.

1. **Core lessons are linear.** A core lesson opens when the lesson before it in §2.3 is completed, across unit boundaries. Nothing in the core can be skipped ahead.
2. **L01 and L02 of a unit need nothing else. L03 and later also need the most recent checkpoint before that unit** passed or soft-passed. For the units that follow a unit without its own checkpoint this reads: U08.L03 onward and all of U09 need U07.CP; U12.L03 onward and all of U13 need U11.CP; U15.L03 onward, U16 and U17 need U14.CP.
3. A checkpoint opens when the last lesson it covers is completed; the planner places it after the next unit's L01.
4. **A capstone never gates a lesson, a checkpoint or a unit.** It opens by §2.4 and §4.3, and the only things it holds back are other capstones named there (C2 → X1, C5 → X2, C7 → CF-A). Gym slots are scheduling, not gates.
5. **Tracks.** A track lesson opens when its gate in §4.3 is met and the previous lesson of its track is completed. J2.L04 is the one lesson that can be passed over: while U14.CP is unpassed the track goes on to J.CP1 and J3, and J2.L04 is offered as soon as U14.CP is passed. Track checkpoints gate only track capstones.
6. Never gated: Studio, Practice, Transcribe and the gym, the tutor, the album, lesson replays.

The default order of §2.5 is one legal order; from Today the learner may pick any other.

**Other rules.** An unfinished checkpoint attempt older than 3 days restarts with new items. The sing tolerance does not tighten while a checkpoint is pending (§8.2).

**Checkpoint map** (gated skills; level-setting skills in brackets):

| CP | Skills |
|---|---|
| U01.CP | R02 R03 R04 R05 R06 R07 R08 N01 [R01 E01] |
| U02.CP | P01–P06 N02 D01 [E02 V01] |
| U03.CP | S01–S04 N03 M01 [E03 E04 E05 E07 V02 V03 V04] |
| U04.CP | I01 I02 I03 I05 [E06] |
| U05.CP | C01–C05 N04 N05 [E08] |
| U06.CP | H01–H06 H15 N06 C10 [E09 V05] |
| U07.CP | M02–M07 M09 M10 N07 F01 [V04] |
| U09.CP | B01–B04 F02 F03 F05 F06 |
| U10.CP | S05–S08 H07–H09 [E10] |
| U11.CP | S09–S11 C06 H10 F04 R13 M08 |
| U13.CP | C07 C08 I04 R09–R12 N08 N09 [E11 E14] |
| U14.CP | S12 S13 H11 [E10] |
| U17.CP | H12 H13 H14 [E12a E12b E13] |
| J.CP1 | J01 J02 J04–J08 C09 [V06] |
| J.CP2 | J03 J09–J14 B05 |
| R.CP | R14–R18 [E14] |
| A.CP | D02–D11 |

Every one of the 143 nodes is in exactly one checkpoint as a first listing. A bracketed skill that appears again in a later checkpoint (V04 in U07.CP, E10 in U14.CP, E14 in R.CP) is a re-test: it sets the level again, and the first listing is the one §7.5 means by "that checkpoint". D05 is introduced in U02.L08 but is checked in A.CP with the rest of the sound nodes; until then it can reach `practiced`, not `mastered`.

### 7.7 Debt

`debt` is a boolean on a skill node with a reason (`soft-pass`, `production-lag`, `checkpoint-level`). It raises warm-up priority by 0.5, adds the skill to the next checkpoint (≤ 3 debt items), and shows a small marker on the map with the copy "worth another look". It clears when the node next reaches P ≥ 0.80 with evidence on two days. Debt never locks content and is never counted or totalled in the UI.

### 7.8 Weekly streak

- **Day** = local calendar day with a 04:00 rollover. A session started before the rollover stays the open session for up to 3 hours after its start (a reload resumes it; it counts for the day it started). **Week** = Monday 04:00 to the next Monday 04:00.
- **Qualifying day**: at least one of (a) a completed review set (≥ 4 trials, or ≥ 5 fact cards); (b) a saved sketch after at least one successful Run (lesson Make, Studio, capstone draft, transcription version); (c) a **Keep-alive**: one easy set plus an optional one-minute "riff of the day", which qualifies at the 2-minute mark or when the set ends.
- **Weekly goal** G: 3–7 qualifying days, default 5. The first week after onboarding uses `max(1, ceil(G × daysLeftInWeek / 7))`.
- **Primary streak** = consecutive weeks that met the goal. The running week never breaks the streak before it ends. **Secondary number** = total days practised and the current run of days, shown small; it has no rules, no rewards and no reset ceremony.
- **Planned rests.** The 7 − G free days of a week are simply rest days. They cost nothing and are drawn as rests (𝄽).
- **Banked rests.** Each week met on qualifying days alone earns 1 banked rest; the bank holds at most 2. At week close, if qualifying days Q < G and Q + bank ≥ G, the missing days are covered automatically and the week counts as met. A week met with banked rests earns no new rest.
- **Repair.** If a week closes short even with the bank, an open tie lasts 48 hours (until Wednesday 04:00). Any qualifying activity in that window counts for the new week **and** as one day of the short week (two activities on two days repair two days). If that brings the short week to its goal it is met, drawn with a tie (⁀). Otherwise the streak restarts at the current week with neutral copy: "A new phrase begins. Longest run: N weeks."
- **Pause.** Settings → Learning → "Pause Oak" marks up to 4 whole weeks as paused in advance or on return; paused weeks are neither met nor missed.
- Banned: loss-framed copy, countdowns, notifications, red states, streak-loss modals.

### 7.9 Return policy

`gap` = days since the last qualifying day.

| Gap | Session |
|---|---|
| 0–2 | normal |
| ≥ 3 | **Warm-up** within the normal budget, drawn from due items whose predicted success (the card's R) is between **0.75 and 0.90**, highest first; if too few, add R > 0.90, then items just under 0.75. **Recap card**, 30 s: the last can-do statement and the last sketch playing. Then straight to the **next** lesson (an unfinished lesson resumes at its step with a two-line "where you were"). |
| ≥ 10 | as above, but the New block is a **Light lesson**: the last completed lesson's Make with one new constraint, no new skill nodes. The next session continues the course. |
| ≥ 21 | as ≥ 10, plus a one-tap offer to loosen the sing tolerance one step. Nothing loosens by itself. |

Backlog handling after any gap ≥ 3: the overdue backlog is spread over `N = clamp(ceil(overdueSeconds / budget), 5, 7)` days by the planner (FSRS state is untouched; ratings use real elapsed time); at most **3** cards a day may enter relearning (after the third Again, remaining items with R < 0.60 wait for tomorrow; a family's first set is excepted); no new cards are released until the backlog is cleared. A checkpoint attempt older than 3 days restarts. A capstone resumes by playing the draft from the top, then opening the session where it stopped. Gap lengths are never shown.

### 7.10 Skill-map shading

Shading shows freshness **relative to each card's own desired retention ρ**, so a learner who is exactly on schedule sees a fully green tree.

```
freshness_c = clamp((R_c − (ρ_c − 0.30)) / 0.25, 0, 1)        // 1 while R_c ≥ ρ_c − 0.05; 0 at R_c ≤ ρ_c − 0.30
F_node      = Σ ω_c·freshness_c / Σ ω_c                        // ω = 2 for P/Pr family cards, 1 for fact/concept cards
opacity     = 0.35 + 0.65 · F_node
```

- ρ is 0.90, 0.85 or 0.80 by card kind (§7.1). A graduated family contributes through its composite card. Paused cards are left out; a node with only paused cards keeps its last F and shows a small mic glyph.
- At its due date a card has R ≈ ρ, so `freshness = 1`. The 0.05 band is wider than the fuzz window, so a card fades only when it is genuinely overdue.
- Fill hue comes from the mastery level (new: outline; available: outline with glow; learning: amber; practiced: teal; mastered: deep green with a ring). Opacity comes from F. The weighted mean is used, never the minimum.
- **Drying** (droop, dry edge, a "Revive" action) is drawn only on nodes whose stale cards are in **today's planned warm-up**. Other stale nodes are simply paler. "Revive" starts exactly those planned sets and never extends the session past its budget; "Revive more" is an explicit opt-in with its own time shown.
- Can-do status: `emerging` = first evidence; `solid` = ≥ 0.85 on 2 days; `strong` = solid and F ≥ 0.9 for 30 days; `fading` = F < 0.5. Status changes are stored as history.

## 8. Singing and tapping

### 8.1 One rule for a sung note: `gradeSung`

`@oak/pitch` exports `gradeSung(frames, targets, tol, mode, profile): MatchResult` (exercises §3.8) and its incremental form `gradeSungLive`, which returns the same per-note credit for the frames received so far. **The PitchLane fill, the per-note tick and the grade all come from this one function.** The UX rule "≥ 250 ms in band within 1 s" and the architecture's `gradeSungNote` are deleted.

Pipeline (worklet → `pitchFramesToNotes` → `gradeSung`):

1. Frames: 2048-sample window, 512 hop, pitchy McLeod. Voiced when clarity ≥ 0.90 (0.85 with a low-voice profile) and RMS ≥ max(−45 dBFS, noise floor + 12 dB). Median of 5. Octave-error repair: an 11–13 semitone jump that returns within 4 frames is folded back.
2. Timed modes (`pitch`, `degree`, `sight`): each target window is `[on + min(80 ms, 0.25·dur), off − 0.1·dur]` after output and input latency compensation; the estimate is the median of voiced frames in the window; `coverage` = voiced frames / window frames. Free modes (`echo`, `resolution`, `bassline`): segment into notes, then Needleman–Wunsch against the targets on folded pitch.
3. Octave policy: `per-note` (single notes: fold each error into (−600, 600]), `global` (phrases: one best octave shift; a note 12 off earns 0.5 with `sing.octave-jump`), `exact` (no folding; only after register lessons). Targets are always transposed by octaves into the learner's comfort range.
4. Drift compensation: the median error over notes within 100¢ is subtracted when it is within `driftCompCents`; `sing.drift` is reported above 15¢.
5. **Per-note credit**, with `e` = the cents error and `T` = the tolerance:

| Condition | Credit | Diagnostic |
|---|---|---|
| coverage < `minCoverage` (default 0.4) | 0 | `sing.missed` |
| \|e\| ≤ T | 1 | — |
| T < \|e\| ≤ min(2T, 100) | 0.5 | `sing.sharp` / `sing.flat` |
| otherwise | 0 | `sing.wrong-note` with the sung degree |

6. Timing credit (timed modes only): onset error ≤ `onsetMs` → 1, ≤ 2·`onsetMs` → 0.5, else 0. Score: `sight` 0.75 pitch + 0.25 timing; `echo` 0.85 pitch + 0.15 rhythm; the other modes pitch only.
7. **Pass**: mean pitch credit ≥ 0.8 and at most 1 missed note.
8. The first sing in U00.L02 is the one exception to the ladder: the tonic plays first and any sustained pitch (coverage ≥ 0.4 for 600 ms) within ±100¢ after per-note folding passes; the reveal then says "that's 1".

### 8.2 Tolerance ladder

`profile.singTolCents` ∈ **70 → 50 → 35 → 25**. Every learner starts at 70.

| Step | Tightens when, on 3 distinct days within 21 days, each with ≥ 8 graded sung notes, the day's median \|e\| is |
|---|---|
| 70 → 50 | ≤ 35¢ |
| 50 → 35 | ≤ 25¢ |
| 35 → 25 | ≤ 20¢ |

- Performance-based only: never by unit, never by date.
- It **never tightens while a checkpoint is pending**: from the day the planner first offers a checkpoint until that checkpoint is passed or soft-passed (decision 29). A checkpoint the planner has stopped offering, such as one on a track the learner left, lets go of the hold after 14 days with a session on which it was not offered; a break does not count toward those days (decision 31).
- It never loosens by itself. Settings → Voice offers Auto / ±70 / ±50 / ±35 / ±25; choosing a fixed value sets `singTolMode: 'fixed'`. After a gap of 21 days or more a one-tap loosen is offered.
- A change is announced once in the Coda ("Your ear-to-voice aim got finer: ±35¢ now"), never mid-session.

### 8.3 How often singing is asked

- In a functional-ear (FET) set, a **sung resolution is asked on 2–3 trials per set**, never on every trial: 3 in the first set of the day, 2 in later sets, chosen to cover the degrees with the lowest sung accuracy. At family levels 1–2 Oak plays the path first; from level 3 the learner sings first.
- Sung resolutions never change the identification credit of the trial; they feed `fam.deg.resolve`.
- At most 2 mic sets per warm-up. `Shift+S` skips a sung part (logged, no evidence, no penalty).
- Singing uses numbers ("one, three, five") until U03.L08 introduces syllables; afterwards syllables are the default label and numbers stay accepted.

### 8.4 Tapping

- Input: `KeyboardEvent.timeStamp` mapped to AudioContext time through `getOutputTimestamp()` pairs, minus the calibrated `tapLatencyMs`. `Space` taps only while the TapPad is armed; two-voice taps use `F`/`J`.
- **One window rule, `windowMs: 'auto'`**: `w = max(floor, clamp(0.25 × minIOI, 50, 120) × levelFactor)`, where `levelFactor` runs from 1.0 at the family's first level to 0.6 at its top level, and **`floor` = 50 ms** (70 ms when `outputKind` is `bluetooth`; 80 ms when the calibration jitter `tapJitterMs`, the MAD of the calibration taps, exceeds 25 ms). The window is never below the floor.
- Grading (`gradeTaps`): coarse offset, monotone DP alignment, `F1 = 2M / (|T| + |A|)`, `timing = mean(1 − |e|/w)`; a constant offset above 25 ms is reported (`tap.offset`) and forgiven at levels 1–2. Score = 0.7·F1 + 0.3·timing. **Pass**: F1 ≥ 0.9 and timing ≥ 0.5.
- Authors write `tol: { windowMs: 'auto', … }`. A numeric window is allowed only in calibration steps.

### 8.5 Quiet mode and no microphone

Quiet mode is on when the learner toggles it for the day (Settings → Voice, or the mic chip) or when no usable mic is found.

| Thing | In Quiet mode |
|---|---|
| `sing` steps | shown as their `fallback`: an `identify` equivalent, or "hear it in your head, then press Space". `modality: 'fallback'`, no penalty, no evidence for voice nodes |
| `predict` with `hum` | becomes `choose` |
| sung resolutions | replaced by listening to the resolution |
| production cards (sing) | **paused**: not due, not rated, not in the load forecast, not in map shading |
| V nodes (V01–V06) | advance only from mic evidence; they keep their level and show a small mic glyph |
| checkpoints | sing items are skipped; nothing is blocked (§7.6) |
| capstones, unlocks, lessons | unaffected: no rubric rule, unlock or gate may require the mic. Content CI rejects a `required` rule or a gate that depends on a `sing` or `tap` result, and every `sing` exercise must declare a `fallback`. |

Tap steps do not need the mic and are unaffected. A learner who never uses a mic completes the whole course with the "sing" can-dos left at "not yet".

### 8.6 Headphones and AirPods

- Set-up (U00.L02, re-runnable at `/settings/voice/setup`): output check (L/R), device kind, mic permission with echo cancellation, noise suppression and auto gain **off**, noise floor, bleed test, tap latency (16 clicks; median and MAD stored), sing latency (8 clicks), range sweep, three pitch-match trials.
- **AirPods / Bluetooth mode.** When the output device label matches Bluetooth earbuds, Oak keeps the output on Bluetooth and selects the **built-in microphone** as input (never the earbuds' own mic, which would switch the output to a low-quality call profile). Copy: "AirPods are fine for listening. Oak will listen through your Mac's microphone." Tap latency and sing latency are calibrated in this configuration and re-checked when the device changes; the tap floor rises to 70 ms; if measured tap latency exceeds 120 ms the card says timing grades will be more forgiving, and they are (the floor rule above).
- Speakers: allowed for everything except sing steps with playback, which show `sing.bleed` and offer the fallback.
- Bleed detection during sing steps: voiced frames within 30¢ of the playing note for more than 300 ms in playback-only spans.
- The mic opens only during sing steps and calibration; a "Mic live" indicator is always visible while it is open; `Cmd/Ctrl+Shift+M` closes it. Audio never leaves the machine.

## 9. Session budget and accounting

### 9.1 Minutes per target

| Target | Warm-up (max) | New | Make | Coda | Lesson content cap (New + Make) |
|---|---|---|---|---|---|
| 15 | 4 | 7 | 3 | 1 | 10 (lessons split, §9.4) |
| **20 (default)** | 5 | 9 | 4 | 1 | **13** |
| 25 | 6 | 13 | 5 | 1 | 18 (13 of lesson + optional stretch steps + a longer Make) |

The 20-minute row leaves one minute of slack on purpose. Checkpoint day: 3 + 12 + 4 + 1 at **every** target (the checkpoint is never split; a 15-minute learner sees "Checkpoint day: about 20 minutes" on Today and may wrap up with a Quick sketch instead of the Make). Capstone day: 3 + work + 1, with 11 / 15 / 20 minutes of work at the 15 / 20 / 25 targets (the draft save is the Make). Gym day: 4 + transcription + 1, with 10 / 14 / 19 minutes (the saved transcription version is the Make).

### 9.2 Authoring caps (content CI fails the lesson otherwise)

1. `BEGINNER_FACTOR = 1.4`. `Σ step.minutes × 1.4 ≤ 13` over all non-optional steps, Make included. So the author's own expert estimates add up to at most **9.25 minutes** (13 / 1.4 = 9.29; `minutes` is written in steps of 0.25).
2. At most **12 steps**. At most **3 graded checks** (`graded: true`): an `AllEx` counts once; the Make's required rule, `predict`, `listen`, `run`, `see`, `concept` and `reflect` steps do not count.
3. The last step is `make`. Exactly one `wrapAt`.
4. In **U00–U04** a step may enable at most **2 of {roll, staff, keyboard}**.
5. At most **3 new terms** (`terms.length ≤ 3`; an antonym pair introduced together is one term).
6. A first drill set and a first sing for a new family are not placed inside the lesson unless the lesson still fits; by default the lesson seeds the family and the blocked-intro sets run in the next day's warm-up (§7.4).
7. Optional stretch steps (`optional: true`) add at most 5 scaled minutes and are shown only at the 25-minute target.
8. Unit level: at least one "Play from the page" step (staff-only starter) per unit from U02 on.

### 9.3 The session itself

- Session machine: `idle → warmup → main → make → coda → done`, with pause and resume at a step. Nothing auto-advances into another lesson.
- At the target time a non-modal line offers "Wrap up with a quick sketch?"; "Keep going" is always allowed.
- Coda shows only cards whose state changed today (sketch saved, can-do change, unlock, tolerance change, weekly rhythm). The unlock ceremony lasts at most 8 seconds and can be replayed from the Toolbox. The next-lesson teaser is opt-in after the learner's second week. The last button is "Done for today".

### 9.4 "Save & wrap" and the 15-minute split

Every lesson has an authored midpoint `wrapAt`: a step after which the learner has made something that stands on its own.

- At the 15-minute target a lesson whose scaled content exceeds 10 minutes is **split at `wrapAt`**. Part A = steps up to and including `wrapAt`, then a Quick sketch (budgeted at 1.5 minutes) that saves the current workbench, then Coda. Part B, in the next session = a 20-second recap, the remaining steps, the Make.
- CI checks both halves: scaled part A ≤ 8.5 min, scaled part B ≤ 9.5 min.
- At any target, "Wrap up" before the Make jumps to the Quick sketch; the lesson resumes at the next unfinished step next time.

### 9.5 Test-out for code mechanics

A `modify` step that only exercises code mechanics (a mini-notation operator, `setcpm`, labels) may declare `testOut: { skips: […] }`. The UI then offers "Know this already? Try the check." A first-attempt pass with no hints marks the skipped scaffold steps complete, rates linked concept cards Easy and saves the time. A fail simply continues into the scaffold steps with no penalty. Test-out is never offered on ear, sing, tap, notation or theory steps.

### 9.6 Accounting: what counts as what

| Thing | Advances the course map by | Streak day | Counts in the pace estimate |
|---|---|---|---|
| Lesson completed in one session | 1 | yes | 1 |
| Lesson split in two (15-minute target) | 1 (when part B ends) | yes, both days | 2 |
| Checkpoint session | 1 (pass, soft pass or fail: a retake is another session) | yes | 1 per attempt |
| Capstone session `X.Sn` | 1 | yes | 1 |
| Gym session `GYM.nn` | 1 | yes | 1 |
| CF-T session | 1 (uses a gym slot) | yes | 1 |
| Optional A1 side lesson | 1 in track A | yes | 1 |
| Keep-alive (≥ 2 min) | 0 | yes | 0 |
| Light lesson after a long gap | 0 | yes | 0 |
| Reviews only / Studio sketch saved | 0 | yes | 0 |
| Repair set after a failed checkpoint | 0 (it is part of a warm-up) | via the session | 0 |

The pace estimate on `/progress` = remaining map sessions × (measured sessions per map session over the last 30 days) ÷ (measured sessions per week over the last 4 weeks). It is shown as a month, never as a count of sessions behind.

### 9.7 Telemetry (local only, shown on Progress › Your sessions, `/progress/sessions`)

`step_telemetry`: `session_id, lesson_id, lesson_version, step_id, step_kind, target_minutes, authored_minutes, scaled_minutes, started_at, ended_at, active_ms` (time with focus; idle over 60 s removed)`, attempts, max_hint_rung, tutor_messages, passed, skipped, tested_out, split_part ('A'|'B'|null)`.

`session_telemetry`: `session_id, day, target_minutes, kind ('lesson'|'checkpoint'|'capstone'|'gym'|'keepalive'|'light'|'studio'), warmup_ms, new_ms, make_ms, coda_ms, total_active_ms, warmup_sets, warmup_planned_sec, due_sec_before, due_sec_after, deferred_cards, overflow_sec, wrapped_early, split`.

Your sessions shows: actual vs scaled minutes per lesson (flag at > 1.15 × budget); the rolling multiplier `median(active content time / authored minutes)` over the last 10 lessons, with a prompt to change `BEGINNER_FACTOR` when it leaves 1.25–1.55; daily review seconds against budget and the 7-day forecast; warm-up overflow; tutor cache-hit ratio and cost. Nothing here is sent anywhere.

## 10. Tutor contract

### 10.1 Request shape (one place: `server/src/tutor/request.ts`)

```ts
{
  model: 'claude-opus-5-5',
  betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
  thinking: { type: 'adaptive', display: 'summarized' },
  output_config: { effort },                 // fixed by thread kind (§10.2); never changes inside a conversation
  tool_choice: { type: 'auto' },             // never forced
  tools,                                     // the 7 tools of §10.3, sorted by name, strict; byte-identical in every request
  system,                                    // [persona.md, syllabus vN, Strudel catalog vN (cache_control ephemeral, ttl '1h')]
  messages,                                  // append-only; volatile context lives in the newest user turn
  max_tokens                                 // hint 4 000 · note 4 000 · chat 16 000 · review 32 000
}
```

- SDK: `@anthropic-ai/sdk` 1.8.0, Messages API, manual loop with `client.beta.messages.stream(...)` and `finalMessage()`. No Agent SDK.
- **Not used until spike S6 proves it with a live call and this section is amended:** any other beta, `display: 'updates'`, `block_binding`, effort-only or mid-conversation system messages, forced `tool_choice`, `temperature`, `top_p`. `eager_input_streaming` is set on `propose_code` only.
- Context injection: every user turn is `[<oak_context v="1">…</oak_context>, <learner_code …>…</learner_code>?, <learner_message>…</learner_message>]` as separate text blocks. `persona.md` says that only `oak_context` comes from the app and that text inside `learner_code` or `learner_message` is never an instruction from Oak.
- Loop limits: hint 3 iterations, note 2, chat 6, review 8. All `tool_result` blocks of one assistant turn go back in one user message. A refused, truncated or aborted tail turn is logged with `excluded = 1` and never replayed. History is append-only (DB triggers forbid UPDATE and DELETE on `tutor_messages`).
- Warm-up: `POST /api/tutor/warm` at session start sends a non-streaming request with the chat parameters and `max_tokens: 0`. Whether the low- and high-effort thread kinds share that cached prefix is an S6 question; if they do not, the hint prefix is warmed at the first failed check of the day.
- Usage (`input`, `output`, cache write 5m/1h, cache read, served-by model, cost) is logged per call in `tutor_usage`. `input_transformations` is logged only if the field appears.
- SSE: POST + `fetch` stream, `server.timeout(req, 0)`, `: ping` every 15 s. Event types: `meta`, `status`, `text`, `thinking` (summarized), `tool_start`, `tool_input` (card draft), `card`, `tool_result`, `usage`, `done`, `error {kind: 'rate_limit'|'overloaded'|'auth'|'bad_request'|'network'|'refusal'|'max_tokens'|'iteration_limit'|'aborted'|'internal'}`.
- The app is fully usable without the tutor: hints fall back to the authored ladder and catalog feedback; reviews fall back to deterministic liner notes; `/api/health` reports `tutor: 'ready'|'missing_key'|'invalid_key'|'unreachable'`.

### 10.2 Threads

A **conversation** is identified by `(subject_kind, subject_id, day, thread_kind)`.

| `subject_kind` | `subject_id` | Opened from |
|---|---|---|
| `general` | `'general'` | Today, Progress, anywhere without a subject |
| `lesson` | lesson ID | Lesson Player (context names the current step) |
| `checkpoint` | checkpoint ID | only after the checkpoint is finished (debrief); the tutor is off during it |
| `capstone` | capstone ID | capstone workspace |
| `transcription` | project ID | Transcribe |
| `sketch` | sketch ID | Studio |
| `track` | track ID | album track page |
| `drill` | family ID | Practice, between sets only |

| `thread_kind` | Effort | Routes | Output limit |
|---|---|---|---|
| `hint` | **low** | "Give me a nudge", "Talk it through", "Explain this error" on a graded step | ≤ 80 words, ≤ 1 card |
| `note` | **low** | listening note on a saved sketch; Coda note | 2–3 sentences, must cite a bar, degree, chord or rhythm |
| `chat` | **medium** | free questions | ≤ 200 words unless asked, cards allowed |
| `review` | **high** | capstone review, transcription review | one `submit_*_review` call |

- `day` is the learner-local day (04:00 rollover). The first message of a new day on a subject starts a new conversation. Nothing is ever deleted; earlier days are read-only history. This bounds token growth.
- The panel shows **one merged timeline per subject** (all days, all thread kinds, ordered by time). The learner sees one thread; the API sees up to four conversations per subject per day, each with a constant effort.
- **Seeding.** The first user turn of every conversation carries `<oak_notes>`: the 10 most recent non-retracted `tutor_notes` (this subject first, then general). When a hint or review conversation produces something the chat conversation should know, a one-line summary is added to the next chat turn's `oak_context` ("hint at rung 2 on S5: pointed at bar 2"; "review of C2 submitted: revision 'land the cadence'").
- **Tutor notes (v1).** Rows are written by the server, not by a model tool: each listening note; each review's revision titles and listening question; deterministic observation lines from grader statistics ("mixes up 4 and 6", "three reveals in U06"). Every note shows in the panel as a chip with **Remove**, which sets `retracted_at`; retracted notes are never sent again.
- **Today's TutorNoteCard** is rendered deterministically from the latest non-retracted note and the next lesson's title. It makes no API call.
- Context chips show exactly what the newest turn will carry (step, code, result redacted to the current rung, hints n/4, selection). Audio is never sent; own-audio projects send code, the checklist and the title the learner typed.

### 10.3 Tools (v1)

Seven tools, all `strict: true`, every object `additionalProperties: false` with all fields required (nullable where noted). Inputs are also validated with zod and numeric ranges clamped on the server. The five learner-facing tools are the plan's v1 list; the two `submit_*` tools are the delivery channel for the review schemas, because forced tool choice is not available.

| Tool | Input | Output (before redaction) |
|---|---|---|
| `evaluate_strudel` | `{ code: string, from_bar: integer ≥ 1, bars: integer 1–16, key: string \| null }` | `{ ok, error: { kind, message, line } \| null, tempo: { cps, bpm, meter }, tracks: [{ label, role, total_events, events: [{ bar, beat, dur_beats, pitch \| null, degree \| null, sound \| null, chord \| null }] }]` (≤ 64 events per track)`, warnings: FeedbackId[], locked_tools: ToolId[] }` |
| `compare_haps` | `{ learner_code: string \| null` (null = the code in the subject's editor)`, target: { kind: 'exercise' \| 'code', ref: string }, from_bar, bars, mode: 'auto' \| 'events' \| 'rhythm' \| 'melody' \| 'harmony' \| 'pcset' }` | `{ status, score, dims, issues: IssueView[], counts: { missing, extra, wrong } }`, built by `toIssueView(result, rung)`. `mode: 'auto'` uses the exercise's own matcher. |
| `get_learner_progress` | `{}` | `{ current: { unit, lesson, step }, unlocked: { recent: ToolId[] (≤ 20), count }, weak_skills: [{ id, name, strength }] (≤ 5), debts: SkillId[], recent_feedback: [{ code, count }] (≤ 10), families: [{ id, level, confusions }] (≤ 5), streak_weeks, sing_tolerance, quiet }` |
| `get_lesson_context` | `{ lesson_id: string, step_id: string \| null }` | `{ lesson: { id, title, objective, key, meter, bpm }, step: { id, kind, prompt, starter_code, constraints: string[], rubric: [{ label, required, met }] \| null, rung, attempts, hints_seen: string[], known_mistakes: [{ feedback, description }], solution: string \| null } \| null }` |
| `propose_code` | `{ kind: 'hint' \| 'fix' \| 'variation' \| 'example' \| 'next_step', title: string, code: string, explanation: string, bars: integer 1–16 }` | `{ card_id, shown: boolean, apply: 'preview_only' \| 'applicable', errors: string[], locked_tools: ToolId[] }`. The server decides `apply`; the model cannot ask for it. |
| `submit_capstone_review` | the `CapstoneReview` object (§10.6) | `{ accepted: boolean, problems: string[] }` |
| `submit_transcription_review` | the `TranscriptionReview` object (§10.6) | `{ accepted: boolean, problems: string[] }` |

- `evaluate_strudel` and `compare_haps` run on the Bun grader host in `tutor` mode (§6.4) under the strict lint profile (§11.3). A lint or eval failure is returned as data (`ok: false`), not as a tool error.
- `propose_code` cards are validated before display: strict lint, toolbox lint with the learner's unlocked set, a 4-bar evaluation that must not be silent. An invalid card is not shown; the model gets `errors` and may retry. Any code of two or more lines must go through `propose_code`; a fenced code block in text is rendered as plain, non-playable text.
- A `submit_*` call outside a `review` conversation returns `accepted: false`. A review conversation that ends its turn without one gets a single reminder turn; after the iteration limit the review falls back to deterministic liner notes.
- Deferred to a later version (not in the tool list, not in `persona.md`): `record_observation`, `suggest_practice`, `theory_query`. Until `theory_query` exists the persona tells the model to verify pitch and chord claims with `evaluate_strudel`.

### 10.4 The tutor and the hint ladder

- The learner's rung for a step is stored on the server (`step_attempts.hint_rung`, max over the attempt series). The UI ladder and the tutor share it.
- A request on the `hint` thread advances the rung by one (0 → 1, 1 → 2, 2 → 3) **before** the model is called, exactly as pressing Hint would, and the reply may use what that rung allows. It never advances to 4.
- A message on the `chat` thread while a graded step is unpassed does not advance the rung; the tools still redact at the current rung, so the answer cannot say more than the ladder has shown.
- Rung 4 is reached only through the UI. When the learner asks for the answer, the tutor replies with one sentence and the token `[[reveal]]`, which the panel renders as the "Reveal (hint 4)" button. Pressing it records the reveal (assisted, ×0, Again) and only then may the tutor discuss the solution.
- After a pass, "Why does this work?" is free at every rung: the step is finished and nothing is redacted.
- During drill trials the tutor never receives the current trial's expected answer. During checkpoints the tutor is off.

### 10.5 Redaction matrix

Applied by the tool executors and the context builder, from the server-side rung. ✓ = may be returned.

| Data | Rung 0 | 1 | 2 | 3 | 4 or passed |
|---|---|---|---|---|---|
| Prompt, starter code, constraints as text, rubric labels and which are met | ✓ | ✓ | ✓ | ✓ | ✓ |
| The learner's code, its evaluated events, lint warnings | ✓ | ✓ | ✓ | ✓ | ✓ |
| `status`, `score`, `dims`, counts of missing / extra / wrong | ✓ | ✓ | ✓ | ✓ | ✓ |
| Issue **where**: track, bar, beat, code range | ✓ | ✓ | ✓ | ✓ | ✓ |
| Authored hint texts | — | nudge | + pointer | + partial | all |
| Issue **what**: kind (wrong degree, missing note, early…), direction (too high, too late) | — | — | ✓ | ✓ | ✓ |
| Known mistakes: feedback code and description of the matching wrong variant | — | — | ✓ | ✓ | ✓ |
| That target audio may be A/B'd; the name of the concept at fault | — | — | ✓ | ✓ | ✓ |
| Issue **fix** and expected value (`expected`, `got`) | — | — | — | first issue only | all |
| Wrong-variant code | — | — | — | — | ✓ |
| Reference solution(s), full expected event list, full diff | — | — | — | — | ✓ |

- Dictation and transcription steps follow the same matrix per stage or phrase; A/B against the stimulus is always allowed because the stimulus is the question.
- Make steps and capstone compositions have no reference; the matrix reduces to its first three rows. `tryCode` in reviews is governed by §10.7.
- `compare_haps` with `target.kind: 'code'` (two pieces of the learner's or tutor's own code) is never redacted.
- **Cassette test** (`bun test server/tutor`): recorded conversations at rungs 0–3 are replayed against the executors; the test fails if any tool result or context block contains a reference solution, any solution's mini-notation literal (whitespace-normalized, ≥ 8 characters), a wrong-variant code, or an `expected` field above the row's allowance. A second cassette asserts the request prefix (tools + system) is byte-stable across thread kinds.

### 10.6 Review schemas

Each schema is defined once in `@oak/api` with zod and used both as the strict tool `input_schema` and by the Review sheet. Counts and word limits are checked on the server; a violation returns `accepted: false` with `problems` so the model can resubmit once.

```
CapstoneReview = {
  strengths: Array<{ text: string /* ≤ 40 words */, bars: [integer, integer] }>   // exactly 2 or 3, each anchored to bars
  revisions: Array<{ title: string /* ≤ 8 words */, bars: [integer, integer], why: string /* ≤ 50 words */,
                     tryCode: string /* ≤ 12 lines; passes the tutor-card lint */, skills: string[] /* SkillIds, ≤ 3 */ }>
             // exactly 1 for C0–C4, X1; exactly 2 for C5 and every later capstone (C5, X2, C6, C7, CF-A, CF-T, JC*, RC*, AC*)
  listeningQuestion: string       // exactly one question, ≤ 30 words, answerable by listening to the learner's own track
  linerNote: string               // ≤ 60 words, third person, liner-notes ready
}

TranscriptionReview = {
  strengths: Array<{ text: string /* ≤ 40 words */, bars: [integer, integer], layer: 'drums'|'bass'|'chords'|'melody'|'form' }>   // 2 or 3
  revisions: Array<{ title: string, bars: [integer, integer], layer: 'drums'|'bass'|'chords'|'melody'|'form',
                     why: string /* ≤ 50 words */, listenFor: string /* ≤ 30 words: what to listen for, never the answer */ }>
             // exactly 1 (2 for X2, CF-T and later)
  plausibilityFlags: Array<{ bars: [integer, integer], issue: string /* ≤ 30 words */ }>   // 0 to 3; e.g. "bass and chord disagree in bar 5"
  listeningQuestion: string       // exactly one
  linerNote: string               // ≤ 60 words
}
```

- A review receives: the code, the deterministic `AnalysisSummary`, the rubric result, the brief, the learner's own one-line note. For transcriptions of the learner's own audio there is no answer key and no audio: only code, metadata and the checklist. For graded ladder pieces the reference is included only after the piece has passed.
- The review never states or implies pass or fail. The Review sheet header says "Claude's comments never affect pass or fail."
- Storage: `album_track_versions.review_json` or `transcriptions.review_json`. The learner chooses whether the liner note appears in the album.

### 10.7 Output markup, code cards, authorship

**Grammar** (tutor text is markdown plus these tokens; specified in `persona.md`, parsed by `MusicTokens`):

```
token   = "[[" kind ":" value "]]" | "[[reveal]]"
kind    = "deg" | "rn" | "note" | "chord" | "bars" | "tool" | "term"
deg     : 1..7 with optional b or # prefix                [[deg:5]] [[deg:b3]] [[deg:#4]]
rn      : a Roman numeral in Oak's dialect                [[rn:V7]] [[rn:V7/vi]] [[rn:bVII]]
note    : letter, optional # or b, octave                 [[note:F#4]]
chord   : a canonical chord symbol (STYLE §5), optionally with a slash bass [A-G][#b]?   [[chord:Am7]] [[chord:G/B]]   → shown in lead-sheet form
bars    : n or n-m                                        [[bars:3-4]]    → loops those bars in the active workbench
tool    : a ToolId                                        [[tool:tb.voicing]] → Toolbox link; shows a lock if locked
term    : a TermId                                        [[term:cadence]] → glossary popover; "preview" badge if not yet introduced
reveal  : no value; valid only on a hint or chat thread whose subject step is graded and unpassed → the "Reveal (hint 4)" button
```

Unknown or malformed tokens render as plain text. Tutor markdown is rendered **without raw HTML**: no HTML nodes, no images, no iframes; links are allowed only to in-app routes. Inline code is allowed; multi-line code must come through `propose_code`.

**Code cards** show a mini workbench (Preview through the evaluation mutex), a token-level Diff, and the tools used.

| Where the card appears | State | Buttons |
|---|---|---|
| Graded step, rung < 4, card touches the graded region | `preview_only` | Preview, Diff. No Apply, no copy. Tooltip: "Try it yourself first, or take hint 4." |
| **Make step** (any rung) | `preview_only` | Preview, Diff |
| **Capstone workspace before the track's first release**, including review `tryCode` | `preview_only` | Preview, Diff |
| Capstone after the first release (revision mode) | `applicable` | Preview, Diff, Apply, Apply to new sketch |
| Studio, Transcribe own-audio, general chat | `applicable` | Preview, Diff, Apply, Apply to new sketch |
| Any card using a locked tool | as above, badged "preview: unlocks at …" | never Apply in a graded context |

"No copy" means the card's code is not selectable and the card has no copy button; the learner types what they want to keep.

**Authorship and attribution.**

- Mastery evidence, rubric evidence and unlock conditions come only from code the learner typed. Applying a card sets `sketch_versions.tutor_assisted = 1` on the resulting version; that version gives no evidence. The next version the learner edits by hand counts again from the edit on.
- A released track version that contains an applied card is credited in its version summary and liner notes: "Revision suggested by Claude (bars 5–8)".
- The first release of a capstone (v1) is, by the rules above, always the learner's own typing.
- A sketch whose code uses locked or preview tools carries that fact in its liner notes (§3.1 rule 4).

### 10.8 Introduced-terms rule

`oak_context` carries `terms_introduced`: the IDs of every glossary term from lessons the learner has completed (sent as a count plus the 30 most recent; the syllabus block lists terms per lesson so the model can resolve the rest). The persona rule: use introduced terms freely; describe anything else by sound and degree numbers first; if a not-yet-introduced term is worth naming, write it once as `[[term:…]]`, which the UI badges "preview", and do not build the explanation on it. The same rule covers tools: cards use unlocked tools unless the card is deliberately a preview. A cassette test checks that a rung-1 hint for a U03 learner contains no `[[term:…]]` outside the introduced list without the preview badge path.

### 10.9 Budget

- Cost is shown in **Settings → Tutor only**: this month's tokens and estimated dollars, per thread kind, cache-hit ratio. Nothing about cost appears in the tutor panel, Today or the Coda.
- **Soft warning, always on:** when the month's estimate first passes `tutor.softMonthlyUsd` (default **$25**, editable), Settings shows a marker and one toast says "Tutor spending passed your monthly marker. Details in Settings." It never blocks and never changes model, effort or behaviour.
- **No hard cap.** The optional hard cap (`tutor.hardMonthlyUsd`, `error { kind: 'budget' }`) was removed on 2026-11-11 by the owner's decision: spending only ever raises the soft warning above, and no tutor route is refused for cost.
- Effort is never lowered to save money. The cost lever is the thread kind's fixed effort.

### 10.10 Coda note policy

- The listening note is **on demand**: the Coda shows "Ask Claude to listen" (note thread, low effort). It is automatic only (a) during the learner's first 7 calendar days and (b) in the Coda of a capstone session.
- A note is 2–3 sentences, cites at least one concrete bar, degree, chord or rhythm, may ask one question, and carries the caption "Claude reads your code and score, never your audio."
- Capstone and transcription reviews are requested by the learner ("Request review") or offered once at release; they are never automatic mid-work.

### 10.11 Persona (binding rules for `server/src/tutor/prompt/persona.md`)

Formative only; refers to "Oak's checker" for results and never decides pass or fail. Sound → code → symbol. Degrees first, letter names in parentheses, movable do for singing. Always explains `n` = degree − 1. Uses the STYLE dialect in every card. Socratic ladder: ask one question → point to the place → model with a different example → reveal only through `[[reveal]]`. Never claims to hear audio. No lyrics; no copyrighted melodies; public-domain repertoire only. One idea per message, ending with a concrete next action. Specific praise only. Length limits per thread kind (§10.2).

### 10.A Amendment 1.2 (2026-11-11): two tutor backends

Decided by the user on 2026-11-11 (relayed from a sibling session; live spike in `spikes/s8-claude-cli/`). This amends §10 and PLAN binding resolution 10.

- The tutor sits behind a `TutorBackend` interface with two implementations that share the SSE protocol, tool executors, rung redaction, review schemas and thread model:
  - `anthropic-api`: the Messages API loop from spike S6 (`@anthropic-ai/sdk`). Cassette-tested only until an API key exists and the user approves a paid live check.
  - `claude-cli`: one `claude -p --output-format stream-json` process per turn, with Oak's five tools exposed through a local MCP HTTP endpoint and no built-in tools (`--tools "" --strict-mcp-config`). Uses the user's own Claude login.
- Selection order: explicit setting, then an API key if present, then a logged-in `claude` on the PATH (`claude auth status` JSON `loggedIn`), otherwise the tutor is off. Settings shows the active backend.
- Differences on `claude-cli`: no thinking deltas (progress comes from `tool_start`/`tool_result` events); no mid-conversation system messages (volatile context goes inside the user turn in `<oak_context>` tags); the hint rung is bound per turn by a server-side token in the MCP header and is never model-supplied; no `fallbacks`, explicit cache breakpoints or betas (those rules and the cache-hit gate apply to `anthropic-api` only); cost is shown as "included in your Claude plan"; the CLI's own session files live under a dedicated cwd (`~/.oak/tutor-cwd`) and SQLite stays the source of truth.
- Model-written code is always evaluated in the subprocess grader backend (spike S1), never in the server process.

## 11. Security and data

### 11.1 Endpoint security

1. The server binds **`127.0.0.1:8787`** only (`Bun.serve({ hostname: '127.0.0.1' })`).
2. Every `/api/*` request: `Host` must be `127.0.0.1:8787` or `localhost:8787` (in dev also `127.0.0.1:5173`, `localhost:5173`). Anything else → 403. This blocks DNS rebinding.
3. Every non-GET request: `Origin` must be in the same allowlist.
4. Every `/api/*` request must carry **`X-Oak: 1`**, with one exemption: **media GETs** (`GET /api/audio/:id`, `GET /api/audio/:id/peaks`, `GET /api/album/tracks/:id/versions/:v/audio`), which are `<audio src>` targets. Those must instead carry `Sec-Fetch-Site: same-origin` (and pass the Host check).
5. No CORS headers are ever sent and preflights (`OPTIONS`) are answered 403.
6. The API key never appears in any response, log line or error. `/api/health` returns a status enum only.
7. `/dev/*` routes and `/api/dev/*` endpoints exist only when `OAK_DEV=1`.

### 11.2 Content Security Policy

Sent on every HTML response:

```
default-src 'self';
script-src 'self' 'unsafe-eval' data: blob:;
worker-src 'self' blob: data:;
connect-src 'self';
img-src 'self' data: blob:;
media-src 'self' blob:;
style-src 'self' 'unsafe-inline';
font-src 'self';
object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

`/offline-render.html` (the offline renderer's frame, same origin only) is served with `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`; every other document keeps `frame-ancestors 'none'` and `DENY`.

`'unsafe-eval'` is required by Strudel's `evaluate` (`Function`); `data:` and `blob:` by its inlined AudioWorklets and by Vite workers. In dev only, `connect-src` also allows `ws://127.0.0.1:5173 ws://localhost:5173`. No third-party origin is ever contacted by the app; sounds are served from `/sounds/<version>/`.

### 11.3 Lint profiles for running code

**Base safety profile** (all code, including the learner's own typing): reject `import()`, `import.meta`, `with`, and the identifiers `globalThis self window document process Bun require module fetch XMLHttpRequest WebSocket EventSource Worker SharedWorker eval Function importScripts navigator postMessage localStorage sessionStorage indexedDB caches`; reject non-computed member access to `constructor`, `__proto__`, `prototype`; reject `samples(` with a remote URL.

**Strict profile** = base plus the rules below. It applies to all **code the learner did not type**: tutor cards and review `tryCode`, every authored content snippet (examples, starters, solutions, Band code, ladder references), and code arriving in an imported backup before its first run.

1. No computed member access (`a[b]`) unless the key is a numeric literal → `lint.strict.computed-member`.
2. No `this` → `lint.strict.this`.
3. No string or template literal containing `constructor`, `__proto__` or `prototype` → `lint.strict.reserved-string`.
4. No `new`, no `class`, no `function` declarations or expressions (arrow functions with expression bodies are allowed, as Strudel callbacks need them), no loops (`for`, `while`, `do`), no `try`, no `async`/`await`, no generators, no assignment except `const` declarations, no regex literals, no tagged templates, no `${…}` inside template literals, no getters or setters, no spread of non-literal arrays into calls → `lint.strict.construct`.

A snippet that fails the strict profile is never evaluated anywhere: a tutor card is rejected back to the model, content fails CI, an imported sketch opens as text with "Review before running".

### 11.4 Grader workers

- Browser: a module Web Worker; 1.5 s kill and respawn (5 s in capstone mode); hap caps of §6.4.
- Server: a Bun Worker started with `env: {}` (if spike S1 shows `env` or `terminate()` is unreliable, `Bun.spawn` with `env: {}` and `kill()` behind the same interface). The API key is read once and `delete process.env.ANTHROPIC_API_KEY` runs before any worker or child is started.
- After realm set-up (`evalScope`) the worker captures the `Function` it needs for `evaluate` and then **disables the `Function` constructor**: `Function.prototype.constructor` and the constructors of the async, generator and async-generator function prototypes are replaced by a throwing stub. It also replaces `fetch`, `WebSocket`, `XMLHttpRequest`, `EventSource`, `Worker`, `importScripts`, `indexedDB` and `caches` with throwing stubs.
- One request at a time per worker; state reset before each grade (`resetVoicings()`, `useRNG('legacy')`, cleared label map and cps).
- A parity test asserts that every catalogued function is callable in both the adapter realm and the grader realm (this covers `.piano()` and the visual stubs).

### 11.5 API key

Sources, in order: `ANTHROPIC_API_KEY` in `.env.local`; or the key pasted in the app (U00.L01 or Settings → Tutor) through `POST /api/settings/anthropic-key`. A pasted key is written to `~/.oak/secrets/anthropic.key` (directory mode 0700, file mode **0600**), takes effect without a restart, and can be removed from Settings (a destructive action, §11.6). The key is held only in the server process, is never sent to the browser, never written to the database, backups or logs, and is never visible to grader workers. The endpoint answers with a status enum after one minimal validation call.

### 11.6 Destructive actions need a confirm nonce

Destructive endpoints: `POST /api/backup/import`, `POST /api/data/reset`, `DELETE /api/sketches/:id`, `DELETE /api/album/tracks/:id`, `DELETE /api/audio/:id`, `DELETE /api/transcriptions/:id`, `DELETE /api/settings/anthropic-key`. Oak 2.0 (§13) adds `DELETE /api/scraps/:id` (`scrap.delete`) and `DELETE /api/templates/:id` (`template.delete`): every DELETE is destructive.

Each requires the header `X-Oak-Confirm: <nonce>`. A nonce comes from `POST /api/confirm { action, target }` → `{ nonce, expiresAt }`; it is single-use, lives 60 seconds, is bound to that `(action, target)` pair and is kept in server memory only. The UI requests it only after the learner accepts a native confirm dialog that names the action. Tutor threads and messages have no delete endpoint at all.

### 11.7 Content versioning

Content is authored just in time, at least two units ahead of the learner, so lessons the learner has passed will be edited. The rules:

1. **IDs are stable.** Lesson, step and exercise IDs never change and are never reused (§1.1). Step IDs are not renumbered when a step is inserted (use the next free number; order is the array order).
2. **Versions.** `LessonDef.version` bumps on any change; `Exercise.version` bumps only when grading semantics change (matcher, reference, constraints, rubric, params). Prose and hint edits do not bump an exercise.
3. **Completed stays completed.** A completed lesson, a passed exercise, a passed or soft-passed checkpoint and a released capstone keep their status whatever changes later. Attempts are keyed by `(exerciseId, version)`; an old pass is honoured.
4. **New steps in a completed lesson** appear in the replay view with a "new since you finished" dot and are never required.
5. **Unlocks are never revoked.** If an unlock moves later in the course, a learner who already has it keeps it. If it moves earlier than the learner's frontier, it is granted silently at the next content load (a backfill pass grants every unlock whose session is completed).
6. **SRS cards survive.** Cards are keyed by family, deck or fact ID. Changing a family's ladder keeps the card and clamps `family_state.level` to the new range. Retiring a family or fact suspends its card; `supersededBy` in `ids.lock.json` moves card state and evidence to the successor.
7. **Skills.** Evidence is keyed by skill ID. A retired node's evidence moves to its `supersededBy` nodes.
8. **Gates.** A passed checkpoint is not re-opened when its composition changes. Debt is recomputed from current evidence.
9. `lesson_progress.content_hash` records the lesson hash at completion, for telemetry and bug reports only.
10. `content/.generated/index.json` carries `contentVersion = sha256(content)`; the server stores it per session.

### 11.8 "Report a grading problem"

Every graded result (lesson step, drill trial, checkpoint item, capstone rubric, ladder transcription) has a quiet "Report a grading problem" action.

- It writes one row to `qa_reports`: `id, at, kind, lesson_id, step_id, exercise_id, exercise_version, family_id, trial_seed, params_json, response_json` (code or answer)`, grade_result_json, hint_rung, note` (optional text)`, content_version, app_version, status ('open'|'triaged'|'fixed'|'wontfix')`.
- The attempt is marked `disputed`: it gives no mastery evidence and no SRS rating, and the step offers "Continue anyway" at once (recorded as completed-disputed, not as passed).
- Settings › Grading reports (`/settings/reports`) lists the queue and exports any report as a ready-made `TestCase` for the exercise's `tests`, so a grader false negative becomes a regression test when it is fixed.
- Nothing leaves the machine.

### 11.9 Naming, routes, keymaps, theme

**Naming.** In the nav and in all copy, **"Studio"** means the sketchbook and free play. **"Transcribe"** means transcription (ladder and own audio). "Transcription Studio" is not used. "Transcription Gym" is the scheduled session type that opens Transcribe. The skill map is "The Oak". The wrap-up is "Coda".

**Routes** (TanStack file routes; the architecture's `/map`, `/drills`, `/sketchbook` and `/studio/$transcriptionId` do not exist):

| Route | Screen | Mode |
|---|---|---|
| `/` | Today | shell |
| `/onboarding/$step` | U00.L01 flow | focus |
| `/learn/$lessonId?step=` | Lesson Player | focus |
| `/checkpoint/$unitId` | Checkpoint. The parameter is the checkpoint ID with `.CP` removed for core checkpoints (`U07`) and the full ID for track checkpoints (`J.CP1`, `J.CP2`, `R.CP`, `A.CP`) | focus |
| `/capstone/$id` | Capstone workspace | shell |
| `/session/coda` | Coda | focus |
| `/studio`, `/studio/$sketchId` | Studio (sketchbook, free play) | shell |
| `/oak?view=tree\|course\|leaves` | Skill map | shell |
| `/practice`, `/practice/$familyId`, `/practice/review` | Practice hub, one family, today's review | shell / focus |
| `/transcribe`, `/transcribe/$projectId` | Transcribe | shell |
| `/album`, `/album/$trackId?v=` | Album, track page | shell |
| `/toolbox?cat=`, `/toolbox/$toolId` | Toolbox | shell |
| `/progress`, `/progress/sessions` | Can-do ledger, milestones, pace; Your sessions (telemetry, §9.7) | shell |
| `/settings/{audio,voice,tutor,learning,appearance,keys,data,listening,reports,about}`, `/settings/voice/setup` | Settings (Listening pass = Listen QA; Grading reports = the grading-problem queue, §11.8); calibration wizard | shell / focus |

**Endpoints renamed or added** against architecture §4.4: `POST /api/tutor/warm` (the only warm endpoint); `POST /api/tutor/note` (replaces `listening-comment`); `POST /api/confirm`; `POST /api/data/reset`; `POST /api/qa/reports`, `GET /api/qa/reports`, `PATCH /api/qa/reports/:id`; `GET /api/telemetry`; `GET /api/listen`, `PUT /api/listen/:ref` (in every build since 2026-11-24; they were `/api/dev/qa`, `/api/dev/telemetry` and `/api/dev/listen`); `POST /api/telemetry/steps` (batched); `POST /api/checkpoints/:cpId/attempts`; `POST /api/gym/sessions`; `GET /api/terms/introduced`; `POST /api/tutor/notes/:id/retract`; `DELETE` endpoints of §11.6.

**Keymap scopes.** Keymaps are scoped to the focused region; a key acts only in its scope.

| Scope | Keys that changed against UX §7.10 |
|---|---|
| Global | the `G`-then-letter navigation prefix is disabled in focus routes (lesson, drill, checkpoint, onboarding) and whenever an answer pad or the workbench has focus |
| Drill answer pad | `1`–`7` answer; the chromatic typing keys `A W S E D F T G Y H U J K` are live only while a chromatic pad has focus; **`Shift+S`** skips a sung part (plain `S` is a note key); there is no hint key in drills |
| TapPad | `Space` (and `F`/`J`) are captured only while the pad is armed; otherwise `Space` is play/stop |
| Workbench (not the editor) | `A`/`B` and `Shift+A` for A/B; `K` toggles typing-keyboard play, during which letter keys are notes and the other workbench letter shortcuts are off |
| Lesson prompt | `H` next hint, `Enter` continue; never active while the editor or a pad has focus |

**Theme hook.** One mechanism: `data-theme="paper" | "bark"` on `<html>`. Oak never reads or writes the `dark` class (StrudelMirror toggles it); no `oak-dark` class.

### 11.10 Backup, including audio

- **Automatic:** on the first launch of each day, `VACUUM INTO ~/.oak/backups/oak-YYYYMMDD.db`, keeping 14.
- **Export** (`GET /api/backup/export`): one `.oakbackup` archive (zip) with `backup.json` (`{ format: 'oak-backup', formatVersion, schemaVersion, contentVersion, exportedAt, tables }`), **`audio/<sha256>.<ext>` for every file in `audio_files`** (the learner's own audio and waveform peaks) and `album/<trackId>/v<n>.<ext>` for every recorded album version. Audio is **included by default**; the export dialog shows the size and offers "without audio" as an explicit opt-out. The API key and `~/.oak/secrets` are never included.
- **Import** (`POST /api/backup/import`, nonce required): validate with zod → automatic `VACUUM INTO` of the current state → one transaction replacing all tables (append-only triggers dropped and recreated) → audio files written by hash → migrate forward if the schema is older. Imported code runs only after the strict lint (§11.3).
- Data directory: `OAK_DATA_DIR` (default `~/.oak`) with `oak.db`, `audio/`, `album/`, `backups/`, `secrets/`. SQLite is the single source of truth; the browser keeps only UI preferences.

### 11.11 Database amendments to architecture §4.2 (`0001_init.sql`)

| Table | Amendment |
|---|---|
| `album_tracks` | `capstone_id` becomes **nullable**; add `side TEXT NOT NULL CHECK (side IN ('A','B','Bside'))`; add `sketch_id` for B-sides |
| `album_track_versions` | add `tutor_assisted INTEGER NOT NULL DEFAULT 0`, `attribution TEXT`, `band_json TEXT`, `flags_json TEXT` (locked or preview tools used) |
| `streak_days` | `source` CHECK becomes `('review','sketch','keepalive','session','repair','rest','banked-rest','paused')`; add `kinds_json` |
| new `streak_weeks` | `week_start TEXT PRIMARY KEY, goal INTEGER, qualifying_days INTEGER, banked_used INTEGER, repaired_days INTEGER, status TEXT CHECK (status IN ('open','met','met-banked','met-repaired','tie-open','missed','paused'))` |
| `freeze_tokens` → **`rests`** | `id, earned_week TEXT, spent_week TEXT NULL`; at most 2 unspent |
| `cando_ledger` | becomes **status history**: `(cando_id, status CHECK (status IN ('emerging','solid','strong','fading')), evidence_kind, evidence_id, at)`, primary key `(cando_id, at)`; current status = latest row |
| `tutor_notes` | add `subject_kind`, `subject_id`, `source CHECK (source IN ('listening','review','observation'))`, **`retracted_at TEXT NULL`**; `concept_id` becomes nullable `skill_id` |
| `tutor_conversations` | `kind` replaced by `thread_kind CHECK (thread_kind IN ('hint','note','chat','review'))`; add `day TEXT NOT NULL`, `effort TEXT NOT NULL`; `UNIQUE (subject_kind, subject_id, day, thread_kind)`; drop `current_effort` |
| `tutor_messages` | `role` CHECK becomes `('user','assistant')`; drop `extra_json` |
| `tutor_cards` | add `apply_state CHECK (apply_state IN ('preview_only','applicable','applied'))`, `locked_tools_json` |
| `learner_profile` | add `sing_latency_ms REAL`, `tap_latency_ms REAL`, `tap_jitter_ms REAL`, `output_kind` (replaces `headphones`: `'wired','bluetooth','speakers','unknown'`), `input_kind`, `input_device_id`, `noise_floor_db`, `comfort_low_midi`, `comfort_high_midi`, `sing_tol_mode`, `quiet INTEGER`, `weekly_goal INTEGER DEFAULT 5`, `flavour TEXT`; `sing_tolerance_cents` DEFAULT **70**, CHECK IN (70,50,35,25) |
| `step_attempts` | add `exercise_version`, `hint_rung INTEGER NOT NULL DEFAULT 0`, `params_json`, `series_no`, `disputed INTEGER NOT NULL DEFAULT 0`, `modality`, `adjusted REAL` |
| `skills`, `skill_evidence` | replaced by exercises §6: `evidence(skill_id, at, day, score, weight, source_kind, source_id)` and `skill_state(skill_id, P, R, D, level, debt, debt_reason, provisional, paused, updated_at)`; the EWMA columns are dropped |
| `srs_cards` | `kind` CHECK becomes `('fact','concept','family','composite')`; add `status CHECK (status IN ('active','deferred','graduated','paused','retired'))`, `released_at` |
| new `family_state` | `family_id PRIMARY KEY, level, promo_day, category_stats_json, confusion_json, blocked_remaining, composite_id NULL, graduated_at NULL` (replaces `difficulty_state`) |
| `checkpoint_attempts` | keyed by `cp_id` (not `unit_id`); add `soft_pass INTEGER`, `per_skill_json`, `attempt_no` |
| new `gym_sessions` | `gym_id TEXT PRIMARY KEY` (`GYM.nn`)`, session_id, kind CHECK (kind IN ('ladder','own-audio')), ladder_level, realism, transcription_id, at` |
| `transcriptions` | `source_kind` CHECK becomes `('own-audio','pd-song','generated')` plus `player CHECK (player IN ('audio','pattern'))`, `hidden_code TEXT`, `fine_tune_cents REAL`, `realism INTEGER` |
| `capstone_state` | add `checked_sketch_id TEXT`, `checked_sketch_version INTEGER` (migration 0005): the sketch version the latest rubric check graded |
| `sketches`, `sketch_versions` | `origin_kind` adds `'keepalive'`; versions add `tutor_assisted`, `band_json`, `flags_json` |
| new `qa_reports`, `step_telemetry`, `session_telemetry` | §11.8, §9.7 |
| new `terms_introduced` | `term_id PRIMARY KEY, lesson_id, at` |
| `sessions` | add `kind`, `target_minutes`, `content_version`, `map_item_id` |
| `unlocks` | `kind` CHECK becomes `('tool','sound','scale','chord','feature','template','lens')`; rows are never deleted |
| new `scraps` | Oak 2.0 (migration 0012, §13): `id TEXT PRIMARY KEY, role, label, code TEXT NOT NULL, bpm REAL, meter, key_json, source_kind TEXT NOT NULL, source_ref, created_at TEXT NOT NULL, review_before_run INTEGER NOT NULL DEFAULT 0` (0/1) |
| new `user_templates` | Oak 2.0: `id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL, bpm REAL, meter, is_blank INTEGER NOT NULL DEFAULT 0` (0/1)`, created_at, updated_at, review_before_run INTEGER NOT NULL DEFAULT 0` (0/1) |
| new `capstone_check_history` | Oak 2.0: `id INTEGER PRIMARY KEY AUTOINCREMENT, capstone_id TEXT NOT NULL, session_id, sketch_id TEXT NOT NULL, sketch_version INTEGER NOT NULL, passed INTEGER NOT NULL` (0/1)`, at TEXT NOT NULL`; `capstone_checks` is unchanged |
| new `later_items` | Oak 2.0: `id TEXT PRIMARY KEY, text TEXT NOT NULL, source, created_at TEXT NOT NULL, done_at` |
| new `catalogs` | Oak 2.0: `id TEXT PRIMARY KEY, ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL, lines_json TEXT NOT NULL, sketch_id, created_at TEXT NOT NULL` |
| `sketch_versions` (2.0) | add `take_state TEXT`, `parent_version INTEGER`, `generation INTEGER`, `dimension TEXT` (no CHECK; §13) |
| `sketches` (2.0) | add `committed_json TEXT`, `cards_json TEXT` |
| `album_tracks` (2.0) | add `shelved INTEGER NOT NULL DEFAULT 0` (0/1) |

### 11.12 Supported browsers

Chromium-based desktop browsers only: Chrome, Arc and Edge, current stable and the one before it. Any other engine gets a static "Open Oak in Chrome" page before app code loads. The reasons are `AudioContext.getOutputTimestamp()` for tap timing, AudioWorklet with raw microphone constraints, the fake-microphone end-to-end tests, and Safari's voice ducking. No code path, polyfill or test targets another engine.

## 12. Resolution ledger

Every issue and every MISSING item in `docs/design/critiques.md`, with where this document (or STYLE / AUTHORING) resolves it. "F" = feasibility critic, "L" = learner critic.

| # | Critique issue (short name) | Resolved in |
|---|---|---|
| F1 | Four content contracts and ID namespaces | §1 (one registry), §5 (one schema), §5.9 (deletions) |
| F2 | Four unlock owners; voicing invariant contradicts the schedule | §3 (single table; rule 6 voicing gate at U05.L08) |
| F3 | Tutor depends on unverified betas; effort changes mid-conversation | §10.1 (verified parameters only), §10.2 (effort fixed per thread kind) |
| F4 | Tutor tools leak answers before rung 4 | §10.4, §10.5 (server-side redaction matrix, cassette test), §10.7 (Preview-only) |
| F5 | Review payloads, thread model, output markup inconsistent | §10.2 (threads), §10.6 (two schemas), §10.7 (grammar with `[[reveal]]`), §10.2 (TutorNoteCard) |
| F6 | Canonical chord spellings silent outside `ireal` | §0.1, §0.2, §0.13, §0.14; STYLE §5 (dictionary-aware table and lint; the golden "(symbol, dict) renders ≥ 2 right notes" test); §3.3 step 3; §6.7 item 7 (the single `toLeadSheet` table in `@oak/theory`) |
| F7 | Chromatic step strings off by one | §0.5; STYLE §6; `tb.n.chromatic` in §3.2; `code.chromatic-step`; the pairs join `fam.deg.index` at level 5 and get golden tests (§7.3) |
| F8 | Swing has no notation or grading path | §6.10; `SwingSpec` in §5.2; STYLE §7 |
| F9 | RC2 clave rubric mixes grids | §6.6 (RC2 on the 2-bar 8th grid); R3.L02 in §2.6 |
| F10 | Track labels conflict; mute/solo rewrites code | §6.2; STYLE §2 |
| F11 | Form checks vs per-track checks under `arrange()` | §6.3 (items 6–8: chains after `arrange()`, sections restart, golden rubric tests); §6.8 item 4; STYLE §9, §10; `key-change`, `contrast` in §5.6 |
| F12 | Query caps make long capstones ungradeable | §6.4 (capstone mode: 128 bars, 5 s, AST duration) |
| F13 | Ladder stimuli have no audio to load | §2.9, §6.12 (pattern source: cps rate, `.transpose()`, `.ribbon()` loop, bar timeline); offline renderer stays a W7 item |
| F14 | No-op, invisible, unverified or missing sound tools | §3.1 rules 7–9; §3.2 († rows, `sh cb tb`, full bank names, `snd.brk`); STYLE §4, §11 |
| F15 | Locked-feature lint sees only identifiers | §3.3 (one toolbox-aware lint that walks strings and mini-notation) |
| F16 | SRS models conflict; no realistic load check | §7.1–§7.4 (one card per family, one grade map, governor, 300-day CI on the warm-up budget and on the 12-minute reviews-only day; graduation into composites is the retirement and merging the critic asked for) |
| F17 | Mastery, checkpoint and gate rules specified four ways; singing can block | §7.5–§7.7 (one map keyed to the curriculum's CP IDs; one definition of the legal orders), §8.5. The two-part checkpoint the critic proposed is superseded by L7's one-part session. |
| F18 | Skill-graph edges contradict lesson order | §4.1 (re-edged, machine-checked twice), §4.2 (CI rule over every legal order, §7.6). R13 follows the learner critic's edge (← R05 R08), not the feasibility critic's (← R05 R07). |
| F19 | Exemplar lessons do not fit the budget | §9.1, §9.2, §9.4; AUTHORING §3; U03 split in §2.3 |
| F20 | Sandbox bypasses; model code in the main realm; no CSP | §11.2–§11.4, §11.6; §10.7 (no raw HTML) |
| F21 | Sung-note and tap acceptance rules disagree | §8.1 (one `gradeSung`), §8.2, §8.4 |
| F22 | The plan collapses under its own size | Plan waves and just-in-time authoring (the plan keeps staff input in W3 and the advanced tracks in W7 instead of deferring them outright); §5.1 (`implemented.ts`, rules on demand); §2.4 (CF-T limited to 3 songs); §4.1 (plain graph until W7); §10.3 (5 learner-facing tools); AUTHORING §8 (Listen QA scope) |
| F23 | Routes, names, tables do not line up | §11.9, §11.11 |
| F24 | `X-Oak` header breaks media playback | §11.1 rule 4 |
| F25 | GradeRules reference values that cannot exist at authoring time | §5.4 (predicate targets, `AllEx`), §5.5 (params) |
| F26 | Tempo conventions for compound and odd meters; metric modulation | §6.9; R2.L05 in §2.6; STYLE §8 |
| F27 | Key-relative analysis after `.transpose()` | §6.8; U17.L02 in §2.3; STYLE §9 |
| F28 | Voicing grading and realm parity gaps | §6.7; §11.4 (parity test); STYLE §5, §12 |
| F29 | Repertoire provenance; audio-storage wording | §2.8 |
| F30 | Keymaps collide | §11.9 (keymap scopes) |
| F31 | CI rules misfire on open-ended steps | AUTHORING §8 (auto-mutants only for exact-match kinds; Listen QA only for shown examples and solutions) |
| F32 | Tutor budget semantics conflict | §10.9 |
| FM1 | Missing: single contracts document | this document |
| FM2 | Missing: target-browser decision | §11.12 |
| FM3 | Missing: audio source for Oak's renditions | §2.9, §6.12 |
| FM4 | Missing: content-versioning policy | §11.7 |
| FM5 | Missing: "report a grading problem" | §11.8 |
| FM6 | Missing: just-in-time authoring pipeline | Plan resolution 14; AUTHORING §1, §9; §11.7 |
| FM7 | Missing: local telemetry | §9.7 |
| FM8 | Missing: backup of audio | §11.10 |
| FM9 | Missing: session accounting rules | §9.6, §2.5 |
| FM10 | Missing: complete no-mic path | §8.5 |
| FM11 | Missing: canonical Strudel dialect spec | `content/STYLE.md` |
| FM12 | Missing: audibility check for every control and alias | §3.1 rule 7 |
| FM13 | Missing: rule for sketches and cards using locked features | §3.1 rule 4, §10.7 |
| L1 | Sessions run past 25 minutes | §9.1–§9.4 |
| L2 | FSRS load outgrows the warm-up | §7.4 |
| L3 | Streak breaks every week on a 5-day goal | §7.8 |
| L4 | Conflicting toolbox tables and lesson IDs; bad bass in the first track | §1, §3 (`ebass` + `.lpf()` at C1 start; voicing at U05.L08) |
| L5 | Genre-fitting music arrives too late | §5.10 (Band layer); U06.L10, U01.L09 in §2.3; §2.8 (repertoire); jazz-soul kit uses sevenths and swing from U03 |
| L6 | U03.L01 overloads the learner | U03.L01/L02 in §2.3; §9.2 rules 4–5; §8.3 (numbers before syllables) |
| L7 | Checkpoint protocol defined four ways; can block on ear or voice; no Make | §7.6 |
| L8 | Prerequisite violations; capstones need locked tools | §4; §4.3 (J2.L04 behind U14.CP; AC2 behind J3 + R1; AC1 behind U11.CP); RC1 no longer needs Dorian or a locked `horns` sound (§2.6, §6.6); §3.1 rules 10–12 |
| L9 | Jazz track teaches theory before music | J1–J3 and JC1 in §2.6; §6.6 (JC1) |
| L10 | C2 rubric cannot be passed | §6.6 (C2) |
| L11 | X1 jumps too far; notation traps | §6.6 (X1); §6.11; U07.L08 |
| L12 | Core Finale packs two projects into four sessions | CF-A, CF-T in §2.4, §2.5 |
| L13 | Transcription may not transfer to real recordings | §2.5 (scheduled gym), §6.12 (realism, fine-tune, hum-to-draft) |
| L14 | Tutor may do the learning, leak answers, use unknown terms | §10.4, §10.5, §10.7, §10.8 |
| L15 | Skill map looks faded when on schedule | §7.10 |
| L16 | Layering written four ways | STYLE §2 (labelled lines; `,` only for simultaneous pitches in authored code); §6.2; `tb.stack` and `tb.mini.stack` rows in §3.2 |
| L17 | Day 1 has too much set-up, stale key flow, failable first sing | U00.L01/L02 in §2.3; §8.1 item 8; §11.5 |
| L18 | Tolerances defined four ways; singing on every trial | §8.2–§8.4 |
| L19 | Returning after a gap is the hardest experience | §7.9 |
| L20 | U04 is seven sessions of dry theory | U04 in §2.3 |
| L21 | Too little staff-reading practice | `fam.not.read` in §7.3; §9.2 rule 8; AUTHORING §5 (scaffold fading U5–U7) |
| L22 | Make rubrics penalize creative choices | §6.5 |
| L23 | Review formats inconsistent and heavy; daily notes and cost are noise | §10.6, §10.9, §10.10. The critic's "budget that quietly lowers effort" is not adopted: plan resolution 10 fixes effort per thread kind. |
| L24 | Cheap-sounding instruments; sound design held back | §5.10 (production defaults, patch swap); A1.L01–L04 from U03 in §2.6 |
| L25 | Naming and IDs collide | §1, §11.9; C0 in §2.4 |
| L26 | Coda has too many ceremonies | §9.3 |
| LM1 | Missing: Band content type | §5.10 |
| LM2 | Missing: review-load governor spec | §7.4 |
| LM3 | Missing: return-after-gap policy | §7.9 |
| LM4 | Missing: lesson-time telemetry and split protocol | §9.4, §9.7 |
| LM5 | Missing: single generated registry | §1 |
| LM6 | Missing: hum-to-draft, realism ladder, fine-tune | §6.12; `tb.feature.transcribe` in §3.2 |
| LM7 | Missing: tutor authorship and terminology policy | §10.7, §10.8 |
| LM8 | Missing: test-out fast path for code mechanics | §9.5 |
| LM9 | Missing: no-mic / Quiet path and AirPods mode | §8.5, §8.6 |
| LM10 | Missing: pickup convention | §6.11; STYLE §9 |
| LM11 | Missing: cumulative "song of the week" Make thread | **Not adopted in v1.** The plan does not include it. Each lesson Make stays a separate sketch; B-sides cover promotion. Revisit after the W2 dogfooding. |
| LM12 | Missing: real-music listening tasks | **Not adopted in v1.** Own-audio gym sessions (even gym slots) are the bridge to the learner's own music. Revisit with W5. |
| LM13 | Missing: daily staff-to-code reading family | `fam.not.read` in §7.3; §9.2 rule 8 |
| LM14 | Missing: weekly-goal streak semantics | §7.8 |

## 13. Oak 2.0

Binding for the Oak 2.0 waves W1–W5 (`docs/oak2/PLAN.md` revision 2, §4 Studio 2.0, §5 Course 2.0, §6 Finishing 2.0). Written in W0 so later waves only implement; a name here changes only by a change to this section and its changelog row. The state of W0 as delivered is in `docs/design/oak2/W0.md`.

### 13.1 Migration 0012 (`server/src/db/migrations/0012_oak2.sql`)

1. **Additive only.** New tables and `ADD COLUMN` only; `sketches`, `sketch_versions`, `album_tracks`, `album_track_versions` and `sessions` are never rebuilt (a rebuild inside the migration's transaction cascades into their children; 0011's header). A 1.4.0 database (schema 11) migrates once and keeps every row (`server/src/db/migrations.oak2.test.ts`).
2. **No CHECK on status-like text.** `take_state`, `dimension`, `scraps.role`, `scraps.source_kind`, `catalogs.ref_kind` and `later_items.source` take any text in SQLite; the services validate them against the `@oak/api` enums of §13.3, so a later wave widens an enum without a migration. Only 0/1 flags carry a CHECK.
3. **Backup.** The new tables are exported and imported like every other table (§11.10). `scraps` and `user_templates` hold runnable code of their own, so an import sets their `review_before_run` (`markForReview`, §11.3) and the app runs that code only after the strict lint. `catalogs` holds plain words; the sketch it names is flagged with its versions.

The tables and columns are listed in §11.11 (rows marked Oak 2.0).

### 13.2 Endpoints

Declared in `packages/api/src/contract.ts` (`OAK2_ENDPOINTS`), schemas in `dto.ts`. Each answers the typed 501 `not_implemented` until its wave builds the handler.

| Name | Method and path | Body → response | Built in |
|---|---|---|---|
| `scraps.list` | `GET /api/scraps?role=&origin=` | → `{ items: Scrap[] }` | W1 (X6) |
| `scraps.create` | `POST /api/scraps` | `ScrapCreate` → `Scrap` | W1 (X6) |
| `scraps.delete` | `DELETE /api/scraps/:id` | → `Ok`; nonce `scrap.delete`; an `index` scrap is refused | W1 (X6) |
| `templates.list` | `GET /api/templates` | → `{ items: UserTemplate[] }` | W1 (X7) |
| `templates.create` | `POST /api/templates` | `UserTemplateCreate` → `UserTemplate` | W1 (X7) |
| `templates.patch` | `PATCH /api/templates/:id` | `UserTemplatePatch` → `UserTemplate` | W1 (X7) |
| `templates.delete` | `DELETE /api/templates/:id` | → `Ok`; nonce `template.delete` | W1 (X7) |
| `sketches.patchVersion` | `PATCH /api/sketches/:id/versions/:version` | `{ takeState }` → `SketchVersion` | W1 |
| `sketches.lineage` | `GET /api/sketches/:id/lineage?version=` | → `SketchLineage` (first to last) | W3 (X15) |
| `album.patchTrack` | `PATCH /api/album/tracks/:id` | `TrackPatch` (`{ shelved }`) → `AlbumTrack` | W4 |
| `habits.get` | `GET /api/habits` | → `Habits` | W3 (X16) |
| `later.list` | `GET /api/later?done=` | → `{ items: LaterItem[] }` | W1 |
| `later.create` | `POST /api/later` | `LaterCreate` → `LaterItem` | W1 |
| `later.patch` | `PATCH /api/later/:id` | `LaterPatch` → `LaterItem` | W1 |
| `catalogs.list` | `GET /api/catalogs?refKind=&refId=` | → `{ items: Catalog[] }` | W3 |
| `catalogs.create` | `POST /api/catalogs` | `CatalogCreate` → `Catalog` | W3 |
| `capstones.checkHistory` | `GET /api/capstones/:id/check-history` | → `{ items: CapstoneCheckHistoryEntry[] }` (oldest first) | W4 |

Amended request bodies: `SketchVersionCreateSchema` gains optional `takeState`, `parentVersion`, `generation`, `dimension` (absent = `null`; `analysis` was already there and is now saved for the habits mirror); `SketchPatchSchema` gains `committed` and `cards` (each replaces the whole list). Amended responses: `SketchVersion` gains `takeState`, `parentVersion`, `generation`, `dimension`; `Sketch` gains `committed`, `cards`; `AlbumTrack` gains `shelved`. These response fields are optional in the schema only while a 1.x server may answer; once the wave that writes them lands, the server always sends them.

### 13.3 Enums and shapes

- `TAKE_STATES` = `kept`, `cut` (`null` = not judged, or not a take). Cut takes are hidden, never deleted.
- `SKETCH_DIMENSIONS` = `sound`, `rhythm`, `notes`, `harmony`, `form`: the dimension a sibling or a generation changes, and the names `diffDimensions` (`@oak/grader`) reports. A form change counts as one change.
- `generation`: `null` for ordinary Runs; 1 for a child of a version outside any chain, the parent's + 1 after that. `parent_version` names a version of the same sketch.
- `SCRAP_ROLES` = `drums`, `bass`, `chords`, `tune`, `other`; `SCRAP_SOURCE_KINDS` = `sketch`, `lesson`, `hum`, `tap`, `memo`. A scrap's `origin` is `saved` (a `scraps` row) or `index` (a labelled line of a sketch's current version, never stored).
- `CATALOG_REF_KINDS` = `song`, `transcription`, `audio`; `CATALOG_LINES` = `tempo`, `sound`, `harmony`, `melody`, `rhythm`, `form` (plain words, at most 400 characters each).
- `LATER_SOURCES` = `tutor`, `learner`.
- `committed`: `{ label, version, at }`, the line's sound settings as they were in `version`. `cards`: `{ cardId, drawnAt }` (`content/studio/cards.ts` ids).
- Habits: `{ sketches, habits: { id, text }[] }`, plain sentences; the `id` is stable per habit so "Not this time" can name it.

### 13.4 Rules every 2.0 wave keeps

1. **Studio describes, never scores** (PLAN §2 anti-goal): no Studio endpoint returns a pass or fail; cards and habits describe.
2. **No invented numbers** (PLAN §2 fidelity rule 2): an Oak threshold is written as Oak's call in the code that holds it and kept loose.
3. **Nothing the learner made is lost:** cut takes, shelved tracks and done Later items stay as rows; only the two confirm-guarded DELETEs remove a row.

## Change log

| Version | Date | Change |
|---|---|---|
| 1 | 2026-11-11 | First binding version, written in Wave 0 from the plan's resolutions and the two critiques. |
| 1.1 | 2026-11-11 | Adversarial edit pass before the freeze. By execution: `Caug` is wrong in `triads` and `C69` in `lefthand` (§0.13, §0.14); `n` goes before `chord().voicing()` (§0.15); fraction strings in `late`/`off` (§0.16); control patterns take their rhythm from the left (§0.17); sections restart inside `arrange()`, so the key plan follows it (§0.18, §6.3, §6.8); straightening swing (§0.26, §6.10). By checking the tables: `tb.note.names` and `tb.s.pitched` move to U02.L01; `tb.meter.2-4` added; alternative unlock sites and the C1 fallback (§3.1 rules 11–12); AC1 gated on U11.CP; RC1 freed from Dorian and the `horns` sound; J03 only in J.CP2; U07.CP gains M09 and drops M01; R.CP drops R13; U02.CP gains D01. Decided: the legal orders (§7.6); level and category gates and graduation of gated ladders (§7.3, §7.4); `fam.har.schema` and `fam.har.cadence` ladders re-cut; `inferRoles` tie-breaks (§6.2); which track a `swing` rule measures (§6.6); starter sounds follow the unlock table (§5.10); per-target capstone, gym and checkpoint days (§9.1); supported browsers (§11.12); ID grammar for fact cards and three-part feedback codes (§1.2). |
| 1.2 | 2026-11-11 | §10.9: the optional hard monthly cap (`tutor.hardMonthlyUsd`, error kind `budget`) is removed by the owner's decision; only the soft warning remains. |
| 1.3 | 2026-11-12 | Wave 3. §7.4: the CI criterion "deferred queue p95 ≤ 4 cards" is replaced by the first-review bound of 7 days (decisions 27 and 30), with the release, resting and return rules that meet it; a family's first set is planned first and is exempt from the Again cascade (§7.9); no family graduates before its first review set. §8.2: the tolerance hold starts when a checkpoint is offered and lapses after 14 practised days without an offer (decisions 29 and 31). §5.6: `motif-reuse` gains `shape` and is measured over one period of the loop. |
| 1.4 | 2026-11-13 | Wave 4. §6.6: C2's motif rule is labelled as it is checked ("in half the bars or more", `shape: 'either'`) and its cadence text lists what the grader accepts (vii°→I, iv→I); a first release must be of the code the latest passing check graded. §7.3: `fam.not.read` trains N04 too. §10.7: a chord token may carry a slash bass. §11.11: `capstone_state` records the checked sketch version. |
| 1.5 | 2026-11-13 | Wave 5. §2.4: X2.S1 names Careless Love, and St. Louis Blues only once a verified answer key exists. §3.2: the row for `tb.feature.chord-symbols` (U05.L04). §6.8: a failing capstone check names a key mismatch first (`harmony.key-mismatch`). §7.3: stages are groupings, so `rhy.swing` is practised from U11.L07. §7.8: a session started before the 04:00 rollover stays open for 3 hours. The §7.3 rows for the written fact decks follow in 1.6, in the same change that moves those decks out of `PENDING_DECKS`. |
| 1.6 | 2026-11-13 | Wave 6 Foundation, the learner's decisions of 2026-11-13. §7.3: rows for the nine written fact decks (`deck.int.names`, `deck.chd.triads`, `deck.har.rn`, `deck.har.cadence`, `deck.scl.degrees`, `deck.key.minor`, `deck.har.minor`, `deck.chd.dom7`, `deck.frm.twelve-bar`), which join `decks` with one new card a day each. §2.3, §3.2, §4.1, §7.3: U05.L04 is split; it keeps `.arp()` as "Arpeggios", and chord-symbol names (N05, `tb.feature.chord-symbols`, `deck.chd.symbols`) are the new lesson U05.L09 "Chord Names", taught directly after it; no lesson ID changes, and a learner who completed U05.L04 before the split counts as having completed U05.L09 (content-kit `LessonMeta.splitFrom`). §2.4: C3 takes four sessions (C3.S3 arranges and writes the lead sheet; C3.S4 records the take, reviews and releases). §2.5, §2.7, §0.10: the default order has 185 sessions (125 lessons, 13 checkpoints, 30 capstone sessions, 17 gym sessions), 259 with the tracks; the landmarks move with it. §6.6: X1's chord stages pass at 0.85, like its melody. |
| 1.7 | 2026-11-14 | Corrections pass before the learner starts. §7.3: rows for the six U12–U17 fact decks (`deck.chd.sevenths`, `deck.har.sevenths`, `deck.scl.modes`, `deck.har.applied`, `deck.har.borrowed`, `deck.har.pivots`), which join `decks` with one new card a day each; the §7.4 simulation holds with them on every seed and target. §7.4: the warm-up no longer counts against the 12-minute cap of "a little more", and the CI criterion for a reviews-only day counts the "a little more" review only (the learner's decision d22 of 2026-11-13; the warm-up is budgeted by §9.1). §2.3, §2.8: U14.L03 and the L5 pool no longer name Scarborough Fair, which no lesson uses (no printing of its familiar Dorian tune from 1930 or earlier is known). |
| 1.8 | 2026-11-14 | Wave 7 Foundation, the advanced tracks. No lesson is split: J5.L03, R1.L05, A1.L07 and A2.L03 each keep ONE required operation inside their session budget and treat the other as a comparison step or an optional stretch (the content lead's settlement of the pre-flight), so §2.6, §2.7 (259 sessions) and §3–§4 are unchanged. §7.3: rows for the ten fact decks of the tracks (`deck.jzz.symbols`, `deck.jzz.ii-v`, `deck.jzz.voicings`, `deck.jzz.tensions`, `deck.jzz.forms`, `deck.jzz.subs`, `deck.rhy.meters`, `deck.rhy.euclid`, `deck.rhy.clave`, `deck.snd.controls`), which join `decks` when the drills engine writes them. §5.6: the additive rule fields and custom rules of the corrections pass, and the shapes and rules of the tracks (clave coverage, simultaneous polyrhythm, the top voice, the walking bass on quarter positions, allowed tensions read against the melody, octave-aware voicing shapes, two-version capstones, two-lane taps, the grouping and Euclid answers). §11.2: `/offline-render.html` may be framed by Oak itself (`frame-ancestors 'self'`, `SAMEORIGIN`); every other document still refuses framing. |
| 1.9 | 2026-11-24 | Unit songs. §5.11 (new): every unit except U00 is one song (`UnitSongDef`, ids `usong.<UNIT>`, files `content/unit-songs/<UNIT>.ts`) that Oak plays whole from the first lesson in the learner's style; each take lesson's Make takes over cells (a part in a section) by the claim rules, Oak plays every cell nobody has taken, and the song is released as a frozen snapshot after `releaseAfter`. Grading is untouched: the grader still sees only the learner's Make code, and no rubric, matcher, test or `required` flag changes except a Make re-keyed to its song (a new exercise version, §11.7). One composer builds what every path plays; `make.unchanged` compares with the code a Make opened with; migration 0011 adds tables and columns only. §6.2 rule 5: song tracks are `band.oak.<label>` and `band.take.<lessonId>.<label>`. The designer's calls of the spec's §10a are decisions 88–94. |
| 1.9 | 2026-11-24 | Sound pack v4 (same version, unit-songs branch). §3.2: rows `snd.oak909`, `snd.oak808` (U01.L03), `snd.rockkit`, `snd.lofikit` (U01.L09), `snd.drum.clave` (R3.L02), `snd.drum.conga`, `snd.drum.bongo` (R3.L04), `snd.breaks`, `snd.foley` (A2.L04), `snd.sbd`, `tb.penv` (A1.L03), `snd.marimba`, `snd.kalimba`, `snd.glockenspiel` (A2.L06), `snd.noise`, `tb.ftype` (A1.L02), `snd.wt` (A1.L01), `snd.textures`, `tb.drive`, `tb.density` (A1.L05), `tb.wt` (A1.L06); the note under group H on the sample-backed aliases and the retired banks' names. |
| 1.9 | 2026-11-24 | The fifth flavour, `flavour.electronic` (same version, unit-songs branch). §1.2 flavour grammar; §5.10 table row and the electronic paragraph (oak909, acid sawtooth bass, sawtooth stabs, square lead; straight; four-note chords from U06.L10; ships `S1`); every Band and unit song carries electronic code. |
| 1.9 | 2026-11-24 | Unit songs, infrastructure (same version, unit-songs branch). §5.11 rule 2: the one composer moves to `packages/grader/src/song/compose.ts` (`@oak/grader/song`), re-exported unchanged as `@oak/strudel/song-compose`, because the grader's Workbench analysis composes songs and the grader may not import the adapter. Rule 8: song levels are set and guarded by the song loudness harness (`songs.pw.ts`, `sound-songs.json`), not by staying under the Bands. Rules 9–10: sound pack v4 names no part lists (`conga bongo clave`, the foley one-shots, `sbd`, the six breaks) stand for kit sounds (`drumPartsOfSound`); a break belongs to every drum part. Rule 18 names `AlbumSource.songRelease`. The grader's drum tables classify the v4 names additively (`DRUM_MAP`: hand percussion, foley and breaks `perc`, `sbd` `kick`; the lint's sample-index names; `tables()` is a sample loader the base lint checks); no rubric rule, matcher or test changes. |
| 2.0 | 2026-11-24 | Oak 2.0 W0 foundations (`docs/oak2/PLAN.md` revision 2). §13 (new): migration 0012 (tables `scraps`, `user_templates`, `capstone_check_history`, `later_items`, `catalogs`; columns `sketch_versions.take_state/parent_version/generation/dimension`, `sketches.committed_json/cards_json`, `album_tracks.shelved`; additive only, no CHECK on status-like text, scraps and templates marked for review on import), the seventeen 2.0 endpoints (`OAK2_ENDPOINTS`, typed 501 until built), their enums and shapes. §11.6: `DELETE /api/scraps/:id` and `DELETE /api/templates/:id` need a nonce (`scrap.delete`, `template.delete`). §11.11: rows for the 0012 tables and columns. The ledger stays §12, so Oak 2.0 is §13. |
| 2.2 | 2026-11-25 | Oak 2.0 W2, the course (`docs/oak2/PLAN.md` §5; numbered after W1's 2.1, renumbered at integration if W1 lands later). §2.1, §2.3, §2.6: ten lessons inside the existing units, each placed by array position after the lesson it follows (the U05.L09 precedent): U06.L13 Parallel Chords, U07.L11 Turn It Around, U08.L06 Kick and Bass, One Line, U09.L06 Endings, U09.L07 Carve It, R1.L06 One Drummer, One Line, J3.L05 Fourths, A2.L08 Peak First, A2.L09 Seams and Surprises, A2.L07 Hocket. No lesson ID changes and no skill node is added (the graph stays 143 nodes). §2.5: the five core lessons add five sessions, and the slot rule then places one more gym slot, so the core is 191 sessions with GYM.01–GYM.18 (W2's plan said 190 and 17; the rule, which `content/validate/gym.test.ts` proves, gives 191 and 18); landmarks C2.S2 82, U13.CP 153, CF-A.S4 191. §2.7: 130 core lessons, 191 core sessions; Jazz 35, Rhythm 21, Arrangement 23; 79 advanced; 270 in all. §6.7 rule 8: the written exception for a chord shape graded on its notes (`same-shape`; `.voicing()` refused). `CONTRACTS_VERSION` stays as W0 left it until integration with W1. |
