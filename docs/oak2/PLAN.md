# Oak 2.0 — from lessons to your own music

Status: draft for approval, revision 2 (2026-11-24). Revision 2 follows a test of the plan against the book: four reviewers re-read every page and judged each of the 74 strategies as faithful, diluted, misread or missing; their findings are folded in below (reports: `scratchpad/test-*.md` of the planning session).

Source: Dennis DeSantis, *Making Music: 74 Creative Strategies for Electronic Music Producers* (Ableton, 2015). Strategy names are the book's; the designs are Oak's.

## 1. Why

Oak 1.x teaches well *inside* lessons. Outside them the learner is alone with a blank editor, and Oak's own songs, Bands and examples were written before anyone measured them against a theory of how music gets made and finished. The book is a catalogue of moves for starting, growing and finishing music. Oak 2.0 brings in the moves that fit a beginner who writes music in code, keeps the book's stance, and reworks Oak's own music so it practises what it teaches.

The learner (and only user, 2026-11-24) is a programmer with no musical training, 15–25 minutes a day, headphones and voice, no instrument; pop/rock/indie and jazz/soul/funk.

## 2. Goals, non-goals, anti-goals, fidelity rules

**Goals**
1. **Studio 2.0:** start, grow and keep ideas without a lesson (scraps, starting points, jam then edit, one-part focus, variation, cards, a habits mirror).
2. **Course 2.0:** the gaps the book exposes become lessons and steps inside the existing units.
3. **Finishing 2.0:** pieces end on purpose; the learner learns to judge "done".
4. **Oak's own music, reworked:** unit songs, Bands, lesson examples and the sound pack follow the book's ideas (§7).

**Non-goals:** audio editing or stems; collaboration and sharing; lyrics (The Rhythm of Lyrics); extended physical techniques; tuning drums to the key (Oak's drum samples have no known pitch).

**Anti-goals**
- Studio scores the learner. Studio *describes* what happened ("you changed rhythm and sound"), never passes or fails.
- Tools compose for the learner. Every tool writes visible, plain Strudel the learner can read and undo.
- New lessons break AUTHORING §21–22 or the corrections standard (§9, §20.2).
- Data loss: no table is rebuilt; `sketches`, `album_tracks`, `album_track_versions`, `sessions` only gain columns or sibling tables. Backup before migrating.

**Fidelity rules** (from the test against the book; every wave checks its work against them)
1. **Patterns, not rules.** The book offers a strategy for when you have its problem. Only lessons grade a strategy; in capstones a book strategy is an optional suggestion, except where the brief is about that very move.
2. **No invented numbers.** No quota the book does not give (no "1–3 events", no "cut one", no "3 versions"). Where Oak needs a threshold, it is Oak's call, written as such and kept loose.
3. **The learner does the listening.** Where the book's point is the learner's own listening or describing, the learner does it first; Oak's analysis comes after, as a comparison.
4. **The rule checks the book's point.** For every graded step, the corrections pins include a piece that keeps the surface but misses the point (must fail) and one that gets the point another way (must pass).

## 3. Approaches considered

| | Shape | Trade-off | Chosen |
|---|---|---|---|
| A | Studio first as 2.0, lessons and finishing later | Earliest use of tools | |
| **B** | **One 2.0, built in waves** | Longest before release; one coherent course map | **Owner's pick** |
| C | Lessons first | Daily course first; Studio stays thin | |

New lessons go **inside the existing units** (owner's pick), next free number, placed by array position (the U05.L09 precedent).

## 4. Studio 2.0

All in `app/src/studio/`, `server/src/services/library.ts`, API in `packages/api`.

**S1. Scraps** *(Scraps and Sketches)*
- Every labelled line of every sketch is a scrap automatically: an index built from `programInfo` labels (`packages/grader/src/lint/ast.ts`), no save step. Lines from lessons and captures are saved explicitly into a `scraps` table (role, code line, bpm, meter, key, source, created_at; in backup review).
- Scraps panel: filter by role, play one alone, "New sketch from scraps" (1–4 lines; `withDraft` from `app/src/transcribe/hum.ts`).

**S2. Starting points** *(Three Ways to Start, Tyranny of the Default, Mise en Place, Simple Sounds, Presets as Starting Points, Arranging as a Subtractive Process)*
- New sketch from: **Drums and bass first**; **From your head** (hum live with `HumDialog`/`draftOfTake`, *or import a voice memo* from the phone into the same pipeline; tap → mini-notation via a new quantiser); **Fill it all** (every part plays the whole length, to be carved); **Plain start** (one plain sound per role, to shape later); **From scraps**; **From a form you mapped** (§6 F7); **With a card** (S6).
- **Defaults are the learner's:** "Make this my Blank" (tempo, meter, sounds, no notes) and setup-only templates in a `user_templates` table. Oak's `STARTER_SONGS` are relabelled *learning kits*, not templates. The built-in Blank stops writing `bd hh sd hh` at 90 bpm into every sketch (`app/src/studio/model.ts`), or the habits mirror would read Oak's defaults as the learner's style.
- **Capture an idea, anywhere:** a top-bar button and shortcut for hum/tap/memo capture that lands in scraps.

**S3. Jam, then edit** *("Write drunk; edit sober", Breadth Before Depth, Procrastination and Timeboxing)*
- Jam toggle: tutor closed (`TutorSubject.tutorOpen: false`), hint callouts hidden, only lint *errors* shown. Every Run is a take (`sketch_versions.take_state`: null | kept | cut).
- **Timebox:** the learner names the task and a length; when time is up Oak stops the clock and asks "switch to editing?" (the book's stop rule), never stops playback by itself.
- **Rough pass:** an optional descriptive row "drums · bass · chords · tune present" so breadth comes before depth.
- **Edit view:** play takes, keep or cut (cut = hidden, never deleted), and build a new version from lines across takes; any line can go to scraps.

**S4. Focus one part** *(One Part at a Time — not in Oak today; the existing "one part at a time" steps are listening/muting)*
- Solo the line under the cursor, hide the rest, and a self-check: "Could this part be released on its own?". A card "one part only today". Offered beside Jam as the opposite way of working; the learner chooses.

**S5. Variation** *(Creating Variation 1–3, Drums to Pitches, Misusing Rhythmic Tools)*
- **Siblings:** copy the current version N times; for each, the learner picks the dimension to change (sound, rhythm, notes, harmony, form; repeats allowed). Oak plays siblings back to back and *describes* what changed in each (`diffDimensions`; a form change counts as one change).
- **Next generation:** an explicit step, separate from Runs: a child of the current generation that changes one dimension against its parent; Oak notes when a change undoes the grandparent's. `sketch_versions.parent_version` + `generation` (ADD COLUMN). The chain plays first to last.
- **Transforms** on the line under the cursor, written as code: transpose (`.add`/`.transpose`), invert *around the line's own centre* (keeps the range), retrograde of pitches with the rhythm kept, and `.rev()` as the literal mirror, rotate pitches (a visible rewrite of the line's numbers; Strudel 1.2.6 has no `.rot`), time shift (`.early`), snap to the key's scale, add a harmony (`.superimpose`). Locked tools are allowed and raise the existing liner flag.
- **Derive a part:** the rhythm of one line onto the notes of another (`.struct`), a drum rhythm as a melody or a melody as drums.
- **Misuse cards:** `.segment` on a busy line, `.chop`/`.striate` on a pad, `.ply` on held chords.

**S6. Cards and habits** *(Arbitrary Constraints, Avoidance List, Catalog of Attributes, Listening to Music You Hate, Thinking Like an Amateur, Choosing a Tempo)*
- **Cards** (`content/studio/cards.ts`): text, unlock lesson, optional fact checker (lint `used`, sounds, degree range, track count, bpm, numerals). A card's row *describes* ("no hats so far"), never ticks or blocks. Avoidance cards carry "instead, try…".
- **Habits mirror:** Studio saves the worker's analysis with each version; a server summary over the current version of every sketch, ignoring values equal to the defaults. Shown in plain words. "Not this time" appears when the learner says a new piece sounds like an old one, and turns the habit into an avoidance card.
- **Catalog of attributes:** the learner picks a reference (a unit song, a recording, their own audio), writes six plain lines (tempo, sound, harmony, melody, rhythm, form), the reference is hidden, they write from the lines; Oak's analysis of the reference is shown afterwards for comparison.
- **Outside your lane:** an occasional prompt to listen to a style the learner avoids and write what its fans love; the learner brings the track.
- **Just play:** on light days Today offers an ungraded "play with a tool" session (`TryTool`, random unlocked tool, saved only if kept), and once in a while a Band style the learner has never used.
- **Tempo try:** play the loop at −8 / 0 / +8 bpm, pick by feel, move on.

**S7. Sound and listening tools** *(Simple Sounds, Deliberately Bad Listening, Rendering as Commitment, Humanizing)*
- **Plain sounds per role** while writing: bass → plain bass, chords → plain keys, tune → plain lead, drums unchanged (`fmap` in `finalizePattern`, `packages/strudel/src/evaluation.ts`); then a "make the sounds yours" pass.
- **Listen through…** (muffled, small speaker, very quiet), followed by "write one thing you heard into your code".
- **Commit sounds:** mark a line's sound settings as committed (edits to them ask first); a capstone can commit after its sound session so later sessions arrange and mix.
- **Tutor stance** (`server/src/tutor/prompt/persona.ts`): judge whether a piece works, never whether it is original; be honest (no padding with praise; strengths only when real); park off-topic deep dives in a **Later** list on Today.

## 5. Course 2.0 (inside the units)

Each lesson follows AUTHORING §2–4, §20.2–22 and fidelity rule 4. Each gets a unit-song plan entry (take or side). New rules are custom rules (`packages/grader/src/rubric/`, listed in `IMPLEMENTED.customRules`) with right/wrong tests.

**New lessons**

| ID (after) | Lesson | Book | Grading (what the rule must check) |
|---|---|---|---|
| U06.L13 (L12) | **Parallel Chords**: one chord shape moved by half steps (`note(roots).add(note("[0,3,7,10]"))` or `.transpose`); deep house and post-dubstep sound; leaves the key on purpose | Parallel Harmony | new `same-shape`: the semitone gaps inside every chord of the chords track are equal, ≥ 2 different transpositions, no `.voicing()` (a written exception to contracts §6.7). Pin: the scale-step `.add(n(…))` version fails |
| U07.L11 (L02) | **Turn It Around**: transpose, invert around the centre, retrograde with rhythm kept vs `.rev()`, rotate, time shift, snap to scale, a transformation as harmony | Note Transformations | new `inverted-copy` (centre-preserving), `rotated-copy`, `time-shifted`; `transposed-copy` (together); rotation is taught by rewriting the degrees (no `.rot` in Strudel 1.2.6) |
| U08.L06 (L04) | **Kick and Bass, One Line**: the bass plays between the kicks; the opposite of Lock with the Kick; a muddy-vs-clean listen step | Bass Lines and Kick Drums as a Single Composite | extend `groove-lock` (or new `kick-bass-composite`): one bass note at a time, no kick while a bass note sounds (event durations), a near-collision window, a minimum number of bass notes |
| U09.L06 (L05) | **Endings**: mirror the intro, shrink a loop of the closing phrase, loop and build to a bang, fade a loopable part; a cadence or final hit also ends on purpose | Three Ways to End; Short Loops as Endings | new `ends-on-purpose` with modes `exit-order`, `shrinking-tail` (one shortening of the closing phrase is enough), `build-out`, `fades-out` (faded material repeats), `cadence/final-hit` |
| U09.L07 (L06) | **Carve It**: start from "everything everywhere", only delete; leave one seam where some (not all) parts extend, stop early or leave a gap; add at least one event that happens once | Arranging as a Subtractive Process; Power of Erasing; Fuzzy Boundaries; Unique Events | new `carved` + `contrast`; `staggered-boundary` (some but not all tracks; extend, retract or gap); `unique-event` (≥ 1, inside a section, ≤ 1 bar, not a whole section heard once) |
| R1.L06 (L04) | **One Drummer, One Line**: linear drumming, 3+3+2 taught in the lesson, alternate-hand velocity | Programming Beats 2; Top, Bottom, Left, Right | `interlock` with drum roles and beat 1 counted, relaxed cover; + `grouping-accents`/`regrouped` for 3s ending in a 2; no drum keeps a fixed timekeeping grid. A top-down (ride) vs bottom-up (kick/snare) listen step |
| J3.L05 (L01) | **Fourths**: quartal voicings ("So What" allowed), and the bass decides the chord's name | Creating Harmony 2 | `stack-intervals` on `@chords` with 4ths and an optional 3rd on top; new `bass-names-chord` (the chord read with the bass is the asked m11/sus) |
| A2.L07 (L03) | **Hocket**: a given line split across two sounds; a slow "sound-colour" cousin as an ungraded step | Linear Rhythm in Melodies; Sound-Color Melody | new `hocket`: the two tracks together reproduce the given line, never together (beat 1 counted), different sounds |
| A2.L08 (L02) | **Peak First**: write the densest section, then make every other section by removing parts | Maximal Density; Dramatic Arc | new `carved`: every section is the densest section minus parts; optional `arc` suggestion (thinner before and after the densest; repeats allowed) |
| A2.L09 (L08) | **Seams and Surprises**: anticipating and hesitating fills, a surprise off the grid, an effect switched on once | Fuzzy Boundaries; Unique Events | `staggered-boundary` with fill timing; `unique-event` including one-time control changes |

**New steps in existing lessons**

| Lesson | Step | Book | Grading |
|---|---|---|---|
| U07.L01 Shape | Leap, then step back (a tendency, not a law; arpeggios exempt) | Creating Melodies 1 | new `gap-fill` as a ratio; optional single-peak suggestion |
| U07.L10 Hook Lab | **Freeze it**: keep one random result as notes, then fix what you don't like (replaces ungraded S5) | Randomness and Responsibility | `matches` ≈ 0.75 against the frozen result + new `no-chance` |
| U09.L04 Energy Curve | One random bar over drums only, frozen and looped until it sounds meant | Repetition and Insistence | ungraded listen + `no-chance` |
| U06.L08 Harmonic Rhythm | Busy notes over slow chords; a breakdown at half the chord rate | Harmonic Rhythm | `chords-per-bar` per bar range (no sections yet), chord order unchanged, note rate vs chord rate on pitched tracks only |
| A1.L04 Space | Clinical (dry, short) vs a noise bed under sparse chords | Silence and Noise | ungraded compare |
| A1.L06 Movement | Steps, not sweeps (filter jumps on the beat, short notes); an ungraded humanize step (slow drift on decay and detune) | Rhythm of Automation; Humanizing With Automation | new `stepped-control`: repeated values then jumps, on note onsets; fits 1.0 expert minute |
| A2.L04 Sampling | Speed as a rhythm machine (a phrase at three speeds changes its rhythm); optional: a tiny loop of speech, tap the rhythm you hear | Sampling the Old-Fashioned Way; Implied Rhythm in Short Loops | `controls` on `.speed`; the optional step needs a CC0 speech sample (§7) |
| A2.L05 Mix & Dynamics | Front, middle, back: the background barely changes, the front changes most, one background part steps forward for a bar | Foreground, Middle Ground, Background | new `depth-layers` |
| A2.L06 Genre Translation | The house pad: one held bass note turns a pad into m9/m11 | Creating Harmony 2 | ungraded listen (reaches non-jazz learners) |

**Drills:** `fam.code.functions` gains rev / rotation / inversion / time shift (seeded by U07.L11); `fam.snd.roles` gains "which part is in front?" with register and rate varied at equal volume (seeded by A2.L05); new `fam.harm.motion` "voice-led or parallel?" (seeded by U06.L13) with its `listen-for.ts` line.

**Bookkeeping** per lesson: syllabus row and order slot; contracts §2.3/2.5/2.6/2.7 (+ §3.2, §4.1, §7.3); counts in `build.test.ts`, `course.test.ts`, `contracts-sync.test.ts`, `wave7-learner.test.ts`, `SESSION_COUNTS`, `LANDMARKS`; unit spec + `.md`; `content:build` locks IDs.

## 6. Finishing 2.0

**F1. Ends on purpose.** `ends-on-purpose` (§5) is **required on CF-A** (taught in core U09.L06) and optional on C6, C7, JC1–JC4, RC1–RC2. `staggered-boundary`, `unique-event` and `arc` are **optional suggestions** on capstones from C3 on (U09.L07 teaches them in core). Nothing book-based is required on AC1/AC2 beyond their current briefs. Capstone content versions bump.

**F2. "Is it better, or just different?"** *(Diminishing Returns)* Triggered when recent edits only tweak values, or swing back to an earlier state (code or analysis equal to an earlier version), never by a count of versions. The nudge is a blind, level-matched A/B of an earlier passing draft against the current one: "Which is better? If you can't tell, it may be done." The learner judges. Check history in a new `capstone_check_history` table (the existing `capstone_checks` keeps transcription scores).

**F3. Erase pass** *(The Power of Erasing)* In capstones and Studio: mute each part in turn, or thin it (fewer notes, shorter decays), and listen; Oak points at parts that overlap in the same register at the same time. No quota; the copy says plainly this is not about minimalism.

**F4. Honest review, your question** *(Getting Feedback)* An optional question with the review request, plus three optional prompts (sound, form, a detail); `reviewLines` prints the question and a persona rule answers it first; strengths only when real. `CapstoneReviewSchema` gains an optional `answer` (bump the review contract version, JSON schema, lint and leak tests).

**F5. Level-matched listening** *(Getting Feedback)* Every A/B the learner makes (F2, Versions, siblings) plays at matched loudness (`matchedGains`, `levelOfBuffer`). Oak's own call, not the book's: album release recordings are normalised to a common loudness with the peak under −1 dBFS (BS.1770 `loudness()` moved from `packages/strudel/src/audibility/quality.ts` to `packages/audio`); code `.gain()` values never change.

**F6. Finish it anyway, then shelve** *(Fail Better)* When the learner is about to abandon a piece (delete, or a capstone/sketch left with a half arrangement), Oak offers "Finish it anyway": a quick Fill-it-all-and-carve pass, then the Shelf. Shelved pieces count as finished (gates unchanged), do not go on the album (`album_tracks.shelved`, a Shelf drawer), and their lines are scraps.

**F7. Borrow a form you mapped** *(Formal Skeletons)* The learner marks the sections of a song they like with the transcription form-map tool; Oak turns *their* map into an empty skeleton (`skeletonOfForm`, `app/src/transcribe/standard.ts`) for a sketch or a bare capstone draft (`isBareDraft`). Oak's ready-made maps are offered only after the learner has made one.

## 7. Oak's own music, reworked: songs, Bands, examples and sounds

The book's ideas applied to what Oak plays to the learner. An audit first (W0, read-only), fixes in W2.

**Audit checklist** (per unit song, Band style and whole-piece lesson example): ends on purpose; at least one seam where parts don't all switch at once; a once-only moment; clear front/middle/back (background repeats, front changes); kick and bass don't collide where the style wants a clean low end; repeated sections are varied, not copy-pasted; an arc (build and release); no section crowded with parts in one register; drums with looseness (velocity shape, ghost notes, alternate-hand hats) where the style plays that way; jazz Bands built top-down from the ride, rock/pop bottom-up from kick and snare.

**Sound pack v5** (CC0/CC-BY only, via `bun run sounds:mirror`, `pack.lock.json`): one plain sound per role (for Plain start and plain sounds); round-robin hi-hats (alternate hands); a CC0 speech/field-recording sample (implied rhythm); noise beds (pink/brown/vinyl crackle) for Silence and Noise; a synthesized kick that can be pitched; level-matched like v4.

**Rules for the fixes:** a song change bumps `UnitSongDef.version` and keeps sections ≤ 64 bars in multiples of 4; any Band or kit level change re-runs the songs loudness harness (`packages/strudel/e2e/songs.pw.ts`, `SONGS_CALIBRATE=1`); the "Listen" list in `docs/decisions.md` names what changed for the owner's ear.

## 8. Waves and parallel work

**Base:** `origin/main` at 1.4.0 (`376dbe9`). Work in worktrees, never the main checkout. Each wave is one Workflow (the owner opted in to multi-agent orchestration). Two kinds of workers run side by side in every wave:

- **Opus agents** (Claude sub-agents, `model: 'opus'`): work that leans on shared files, UI integration, or judgement across many parts of the app. Each prompt opens with the guard paragraph, is wrapped in a retry, and writes its full result to the scratchpad.
- **Codex Astra** (§9): every piece that is self-contained, has a clear interface and can be proven by its own tests or by reading. Each runs in its **own worktree** on its own branch; the wave's Opus integrator reviews the diff, re-runs the proof commands and merges.

**What goes to whom:** Codex gets pure modules, server services built against contracts fixed in W0, rule functions, generators, sound recipes, whole lesson folders whose shared bookkeeping (syllabus, contracts, counts) the Opus integrator does, and every independent review. Opus keeps W0's contracts and migrations, the files several features share (`contract.ts`, `rules.ts` registry, `implemented.ts`, syllabus, unit-song plans), UI wiring and integration. At most **3 Codex runs at once** (machine load), started first in each wave because they run longest.

Agents in the same wave never share files: each row below names what it owns. Shared registries (`packages/grader/src/rubric/rules.ts`, `packages/content-kit/src/implemented.ts`, `packages/grader/src/index.ts`, `packages/audio/src/index.ts`, `content/syllabus.ts`, `docs/design/contracts.md`) are edited only by the wave's integrator, who wires in what the workers deliver.

| Wave | Opus agents | Codex tasks (§9) | Integrator merges |
|---|---|---|---|
| **W0 Foundations** | 1 contracts 2.0 + migrations + API entries for every 2.0 endpoint and table; 2 grader rules A, form and arrangement (`ends-on-purpose`, `carved`, `staggered-boundary`, `unique-event`, `arc`); 3–4 audit of songs U00–U09 / U10–A2, Bands and whole-piece examples (read-only, `docs/oak2/audit-*.md`) | X1 rewrite + `diffDimensions`; X2 pitch and harmony rules; X3 rhythm and sound rules; X4 audit cross-check | rules registry, `implemented.ts`, exports |
| **W1 Studio core** ∥ W2 | 1 scraps + capture UI; 2 starting points + templates UI + Blank defaults; 3 jam/edit + timebox + focus one part; 4 plain sounds, listen-through, commit sounds, tutor stance | X5 tap quantiser; X6 scraps service; X7 user templates service; X8 hum from a recording | routes mount, `index.ts` exports |
| **W2 Course + music** ∥ W1 | 1 U06+U07; 2 U08+U09; 3 R1+J3; 4 A1 steps + A2.L04–L06 steps; 5 Band and song audit fixes for units not owned by 1–4; 6 sound pack v5 sampled sounds (CC0 speech, round-robin hats; needs licence checks on the web); 7 bookkeeping integrator | X9 A2.L07 Hocket; X10 A2.L08 Peak First; X11 A2.L09 Seams and Surprises; X12 drill generators; X13 synthesized sounds for v5; X14 adversarial lesson review (after authors) | syllabus, contracts §2/§3/§4/§7, counts, unit-song plans for A2 |
| **W3 Variation + habits** ∥ W4 | 1 variation UI (siblings, generations, transforms, derive, misuse cards); 2 cards UI, habits page, catalog of attributes, outside-your-lane, just play, tempo try | X15 lineage service; X16 habits core; X17 card deck and checkers | |
| **W4 Finishing** ∥ W3 | 1 F1 briefs + F6 shelf/finish-anyway + F7 borrow a form; 2 F2 A/B nudge UI + F3 erase pass + F5 matched A/B UI | X18 edit-kind classifier; X19 loudness core; X20 honest review with your question | |
| **W5 Release 2.0** | 1 book re-test of the shipped features (fresh readers, as in revision 2); 2–3 fixers by area; full suites once; `release.sh 2.0.0` | X21 independent code review; X22 corrections-standard sweep of every new lesson | |

## 9. Codex Astra

**How every run is launched:** `codex exec -m gpt-6-astra -c model_reasoning_effort=high -s <mode> -C <worktree> -o <scratchpad>/codex-<id>.md - < <scratchpad>/codex-<id>-brief.md`, in the background. Writing tasks use `-s workspace-write` in a fresh worktree `Oak-wt/oak2-<id>` (branch `oak2-<id>`) cut from the wave base, with `bun install --frozen-lockfile` done before launch; reviews use `-s read-only`. Network stays off unless a brief says otherwise. Codex cannot launch Chromium in its sandbox: it writes browser specs, Claude runs them.

**Every brief has these ten sections, in this order** (no brief goes out missing one):
1. **Context** — what Oak is, who the learner is, which wave this is, why this piece matters, in two short paragraphs. Knows nothing else.
2. **Read first** — the exact files (and sections of `content/AUTHORING.md`, `content/STYLE.md`, `docs/design/contracts.md`, `docs/oak2/PLAN.md`) to read before writing anything.
3. **Scope** — the only files it may create or change; everything else is read-only. It commits on its branch with a given message and does not push.
4. **Interface** — exact signatures, types and the module it exports from.
5. **Behaviour** — numbered rules, each one testable.
6. **Acceptance criteria** — numbered, each with its concrete test cases (inputs and expected outputs), including the cases that must fail.
7. **Proof** — the exact commands to run (typecheck, `bunx biome check <files>`, `bun test --isolate <files>`, `bun run content:check <id>`), and that their output goes in the report. Never the full suites.
8. **Deliverable** — a report with: files changed; an AC table (criterion, pass/fail, evidence); command output; "could not verify" items; open questions.
9. **Rules** — say "could not verify" rather than guess; never weaken a test or an AC to pass, stop and explain instead; no tests changed except its own; no personal details; no network unless stated.
10. **Stop conditions** — when to stop and report instead of improvising (a contract that does not fit, an AC that contradicts the code, a needed file outside scope).

**Review before merge:** the integrator reads the whole diff, re-runs every proof command in the Codex worktree, checks the AC table against the evidence, and merges only when every criterion holds; anything it doubts goes back to the same Codex run with a follow-up brief.

**The tasks.** Interfaces below are binding; the briefs add the full behaviour and test tables.

*W0*
- **X1 Code rewrite and dimension diff** — `packages/grader/src/rewrite/{chain,degrees}.ts`, `packages/grader/src/analyze/diff-dimensions.ts`, tests. `wrapChain(code, label, method, args)`, `rewriteDegrees(code, label, f)`, `invertAroundCentre(code, label)`, `retrogradePitches(code, label)`, `diffDimensions(a: EvalSuccess, b: EvalSuccess): Dimension[]`. AC: pure; output re-parses and evaluates; missing label returns input unchanged; inversion keeps min/max on ≥ 10 cases; retrograde keeps onsets exactly; 10 single-change pairs give exactly one dimension, 4 double-change pairs give two, an added section counts as `form` only.
- **X2 Pitch and harmony rules** — `packages/grader/src/rubric/oak2-pitch.ts` + test: `same-shape`, `bass-names-chord`, `inverted-copy`, `rotated-copy`, `time-shifted`, `gap-fill`. AC per rule: the right piece passes; the book-miss piece fails (e.g. `same-shape`: the scale-step `.add(n(…))` progression fails, `.voicing()` fails, a single transposition fails; `gap-fill`: an arpeggio passes, a ratio below threshold fails); the detail line names what failed in plain words (`rubric.unmet` format).
- **X3 Rhythm and sound rules** — `packages/grader/src/rubric/oak2-rhythm.ts` + test: `kick-bass-composite`, `hocket`, `stepped-control`, `no-chance`, `depth-layers`, `linear-drums`. AC as X2, e.g. `kick-bass-composite`: a token one-note bass fails, a bass note ringing through a kick fails, two bass notes at once fail; `stepped-control`: a per-note sine sweep fails, held values with jumps pass.
- **X4 Audit cross-check** (read-only) — audits U02, U05, U09, U13, J3, A2 songs and 3 Band styles against the §7 checklist on its own, then compares with the Opus audits. AC: a row per song × checklist item (yes/no/partly, bar numbers); each disagreement with evidence.

*W1*
- **X5 Taps to mini-notation** — `packages/audio/src/tap-notation.ts` + test. `tapsToMini(onsetsSec, bpm, opts?: { grid?: 8|12|16; bars?: number }): { mini; bars; dropped }`. AC: 8 exact cases at 90/120/140 bpm incl. rests and a pickup; ±30 ms jitter gives the same strings; triplets with `grid: 12`; close taps merge into `dropped`; `readMini` parses every output.
- **X6 Scraps service** — `server/src/services/scraps.ts`, repo, route handlers for the W0 contract entries, tests. Automatic index of labelled lines across current sketch versions plus saved scraps. AC: a sketch with 4 labelled lines yields 4 scraps with role, bpm, key; editing a sketch updates its scraps; deleting a sketch removes its index rows but never saved scraps; backup round-trip keeps saved scraps; 403 on a foreign Host (existing security tests pattern).
- **X7 User templates service** — `server/src/services/user-templates.ts`, repo, handlers, tests. AC: "Make this my Blank" stores tempo, meter and sounds with no notes (a sketch with notes yields a template without them); one Blank at a time; list/rename/delete; backup round-trip.
- **X8 Hum from a recording** — `packages/pitch/src/hum-pcm.ts` + test: `humFromPcm(pcm: Float32Array, sampleRate: number, opts): HumDraft` reusing `humToDraft`. AC: synthetic sung-note fixtures (sines with vibrato and noise) at 44.1/48 kHz give the expected degrees and rhythm; silence gives an empty draft; a 60 s file finishes under 2 s.

*W2*
- **X9 / X10 / X11 Lessons A2.L07 Hocket, A2.L08 Peak First, A2.L09 Seams and Surprises** — each a lesson folder (`lesson.ts`, `lesson.mdx`), its corrections pins in a new per-lesson pins file, written to AUTHORING §2–4, §9, §20.2–22 and fidelity rule 4 (§2), using the W0 rules. The integrator adds the syllabus rows, contracts rows, counts and the A2 song plan entries. AC: `bun run content:check <id>` passes all 15 checks; the step budget holds; every graded step has the reference, three other right answers, the unchanged starter failing with `code.unchanged`, a wrong answer that uses the right function and fails on the effect, two realistic mistakes with different codes, and the book-miss and book-other-way pins; prompts are one imperative task each with a "Done when…" line.
- **X12 Drill generators** — `packages/drills/src/gen/` additions + tests: `fam.harm.motion` (voice-led vs parallel) and the new categories of `fam.code.functions` and `fam.snd.roles` (front part at equal volume). AC: property tests on headless Strudel (every generated item plays, the answer is unambiguous by the generator's own check, levels and categories follow the family spec); the `listen-for.ts` line uses only terms taught by the seeding lesson.
- **X13 Synthesized sounds for v5** — recipes in `scripts/sounds/` (plain role sounds, noise beds, a pitchable synthesized kick), rendered by the existing tools, all original CC0. AC: `scripts/sounds` tests pass; every new sound renders, loops cleanly where it should, and sits within ±1 LU of its role's v4 level; credits file updated.
- **X14 Adversarial lesson review** (read-only, after the authors) — every new lesson and step in §5. AC per lesson: pieces that keep the surface but miss the book's point and pass (with code); pieces that get the point another way and fail; §22 clarity breaks; "could not verify" items.

*W3*
- **X15 Lineage service** — `server/src/services/lineage.ts` + handlers + tests over `parent_version` and `generation`. AC: siblings share a parent; a generation's child must name its parent; a change back to the grandparent's dimension value is reported (not blocked); the chain endpoint returns versions first to last; ordinary Runs never create generations.
- **X16 Habits core** — `server/src/services/habits-core.ts` + test: `summarizeHabits(items, defaults): Habits`. AC: defaults ignored; a 9-sketch golden fixture gives the exact expected summary; empty input gives no sentences; sentences use only terms in `content/terms.ts`.
- **X17 Card deck and checkers** — `content/studio/cards.ts` + `packages/grader/src/cards/` + tests. AC: every card has an unlock lesson that exists and an "instead, try…" line when it bans; each checker is pure over analysis facts and returns a description string, never a pass/fail; 2 fixtures per checker.

*W4*
- **X18 Edit-kind classifier** — `app/src/capstone/edit-kind.ts` + test: `classifyRecentEdits(versions): "tweaks" | "swing-back" | "changes"`. AC: value-only edits (numbers, gains) → tweaks; returning to an earlier version's code or analysis → swing-back; any structural change → changes; 12 table cases.
- **X19 Loudness core** — BS.1770 `loudness()`/`peakDb()` moved to `packages/audio/src/loudness.ts` (re-exported from the old place) + `normalizeGain(channels, sampleRate, targetLufs, maxPeakDb = -1)`. AC: existing quality tests pass unchanged; 1 kHz sine at −20 dBFS reads −23.0 ± 0.3 LUFS; target ± 0.5 LU on 4 fixtures, peak never above `maxPeakDb`.
- **X20 Honest review with your question** — `server/src/tutor/context.ts` (`reviewLines`), `persona.ts`, `packages/api/src/tutor.ts` (`answer`), `server/src/tutor/reviews.ts`, JSON schema, tests. AC: a question in the request prints as its own line and the recorded-response test shows it answered first; no question → output unchanged; strengths may be empty; schema version bumped; lint and leak tests pass.

*W5*
- **X21 Independent code review** (read-only) — this plan, `git diff 376dbe9..HEAD`, §2. AC: findings ranked by severity, each with file:line, failure scenario and the plan clause it breaks; fidelity violations listed separately.
- **X22 Corrections sweep** (read-only) — runs `bun run content:check` for every new and changed lesson and checks each graded step against AUTHORING §20.2 and fidelity rule 4. AC: one row per step; every missing pin named.

## 10. Calls made for the owner to check

1. Shelved pieces count as finished.
2. Only `ends-on-purpose` is required in a capstone (CF-A); every other book move is an optional suggestion in capstones.
3. Jam takes are versions marked kept/cut; cut takes are hidden, never deleted.
4. Transforms may write tools not yet unlocked (existing liner flag).
5. F2 is triggered by the kind of edits, not a count; the learner decides.
6. Album recordings are normalised to a common loudness (Oak's call).
7. Sound pack v5 adds plain role sounds, round-robin hats, a speech sample, noise beds and a pitched kick, all CC0/CC-BY.
8. Codex Astra takes every self-contained piece (22 tasks, about a third of the work) at `model_reasoning_effort=high` (owner: "Astra high"), with at most 3 runs at once.

## 11. Verification

**Test policy (owner):** as work advances, only the relevant tests: `bun run check:changed` / `test:changed` / `e2e:changed --max 8` and `content:check <id>` after each piece of work and at each wave gate; never a full suite mid-build. W5 runs the full suites once (`bun run check:full`); what they find is fixed and re-checked with the changed-only runners.

- Lessons: corrections pins per fidelity rule 4; `bun test ./content/validate/unit-songs.test.ts ./content/unit-songs/index.test.ts`; songs loudness harness for every unit whose song or Band changed.
- Studio and finishing: build in the worktree, serve on a spare port with a scratch copy of `~/.oak`, walk each flow in the browser pane.
- Migrations: backup → migrate → restore test; no table rebuilt.
- Fidelity: X14, X21 and X22 report against §2, and W5 re-tests the shipped features against the book; W5 does not ship with an open fidelity violation.

## Appendix: the 74 strategies

**Studio:** Three Ways to Start, Tyranny of the Default, Mise en Place, Simple Sounds, Presets as Starting Points (S2); "Write drunk; edit sober", Breadth Before Depth, Procrastination and Timeboxing (S3); One Part at a Time (S4); Creating Variation 1–3, Drums to Pitches, Misusing Rhythmic Tools (S5); Arbitrary Constraints, Avoidance List, Catalog of Attributes, Listening to Music You Hate, Thinking Like an Amateur, Goal-less Exploration, Choosing a Tempo (S6); Deliberately Bad Listening, Rendering as Commitment, Humanizing With Automation, Problem-Solving as Distraction, Originality vs. Quality (S7).
**Course:** Parallel Harmony, Note Transformations, Bass and Kick as One Line, Three Ways to End, Short Loops as Endings, Arranging as a Subtractive Process, Power of Erasing, Fuzzy Boundaries, Unique Events, Programming Beats 2 and 4, Creating Harmony 2, Linear Rhythm in Melodies, Sound-Color Melody, Maximal Density, Dramatic Arc, Creating Melodies 1, Randomness and Responsibility, Repetition and Insistence, Harmonic Rhythm, Silence and Noise, Rhythm of Automation, Sampling the Old-Fashioned Way, Implied Rhythm in Short Loops, Foreground/Middle Ground/Background (§5).
**Finishing:** Diminishing Returns (F2), Power of Erasing (F3), Getting Feedback (F4, F5), Fail Better (F6), Formal Skeletons (F7).
**Oak's own music:** most of the course strategies again, applied to songs, Bands and examples (§7).
**Already in Oak:** Active Listening, Creating Melodies 2 (motives), Multiple Simultaneous Melodies (A2.L03), Creating Harmony 1, Voice Leading and Inversions, Asynchronous Loops, 3+3+2, On Looseness, Ghost Notes, Common Forms 1 and 2.
**Left out:** Different Tools, Extended Techniques, Collaboration, Personal Workflow, Process vs. Product (kept as the anti-goal "Studio never scores"), On Work, Tuning Everything (samples have no known pitch), The Rhythm of Lyrics.
