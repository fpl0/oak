# Oak content model and validation: map for the "each unit is one song" rework

Scope: `packages/content-kit`, `content/*.ts` registries, `content/bands`, `content/capstones.ts`, ID generation
(`content/ids.lock.json`, `content/.generated`), the content validation pipeline (`content/validate/*`,
`scripts/content/*`), and how content reaches the app and the server. Line numbers are as of commit `dec85d2`.

---

## 0. The findings that matter most

1. **The name `SongDef` (and `SongId = song.${string}`) is already taken** by the public-domain repertoire
   (`packages/content-kit/src/schema/catalog.ts:302`, `ids.ts:49`, grammar `^song\.[a-z0-9-]+$`), used by about 10
   app files, the server loader, the grader context (`songForm`, `songMelody`) and transcription capstones. The
   server loader also globs every `**/song.ts` under `content/` and rejects one whose id is not a `song.*` id
   (`server/src/content/loader.ts:136-154`). The new type needs another name (e.g. `UnitSongDef`, `TuneDef`) and
   its files must not be called `song.ts`.
2. **A Band can only play drums, bass and chords.** That limit is in the type (`BandDef.roles`, `BandRef.tracks`),
   the zod refine (`BAND_LABEL`), `defineBand` (one `role:` track per role), the test that asserts the evaluated
   tracks equal the roles, `BandSetup.tracks` in @oak/strudel, and the sketch DTO `bandState.mutes` enum. A song
   in which Oak plays every part (melody too, and kick/snare/hats as separate lanes for U01) cannot be a `BandDef`
   as it stands. It needs a new type, or a widened Band contract (contracts §5.10).
3. **Today a lesson's tempo, key and meter belong to the lesson, not to the unit.** No unit has a single tempo:
   U06 alone uses 8 different BPMs. Several units change key or mode on purpose (U03.L06 G, U03.L07 F; U10 moves
   between C minor, C major and A minor; U14 is a different mode in every lesson; U17 modulates). Three units
   change meter (U01.L08 3/4, U07.L09 3/4 in F, U13.L04 6/8), and R2 is all odd meters. A persistent song per unit
   must either impose one key, tempo and meter, override them in lessons, or allow them to change by section. This
   is the largest content cost (§5).
4. **From U05 on, the learner already writes most of the song, and Oak plays only drums.** In 250 of the 402
   Band-carrying steps the Band is `band.axis-4bar`, and from U05 on almost every Make is `tracks: ["drums"]`, with
   the learner writing chords, bass and melody at once. U11.L07–L08, all of U13 and most of R1–R2 have
   `band: false`. "The learner takes over one of Oak's parts" is closest to today's U01–U04 (learner drums over
   Band bass+chords, then learner melody over the full Band). After that it inverts what lessons do now.
5. **The precedents for "one piece that grows across sessions" are capstones and `fromSketch`, not Bands.**
   - A capstone draft carries from session to session (`CapstoneSessionDef.starter` opens S1; later sessions
     open the previous draft; only the last session has `release: true`).
   - `CodeMakeEx.fromSketch` opens a Make with the learner's sketch from an earlier lesson (4 uses: U06.L10←U05.L01,
     U10.L06←U10.L05, U11.L07←U11.L06, U15.L06←U12.L04).
   - `BAND_STAGES` + `bandCodeAt(reached)` is the precedent for Oak code that changes with course position.
   - `band.sections` + `packages/strudel/src/band-form.ts` is the precedent for Oak code in sections, one
     `arrange()` per labelled track, that follows the learner's form.
6. **The closest file-level patterns to copy:**
   - **Bands** for the per-flavour code record and its CI: exhaustive `Record<FlavourId,string>`, `defineBand`,
     `content/validate/bands.test.ts`, the 12-key / every-stage evaluation and music scans in
     `content/bands/index.test.ts`.
   - **Capstones** for sessions, release, album slot, liner notes, gate and course-graph integration.
   - **Repertoire `SongDef`** for a form with contiguous sections (`defineSong` rule `song.sections`).
   - **CF-A's `single()` builder** (`content/capstones.ts:1064`) for writing a whole multi-section song with
     per-role, per-section consts and one `arrange()` per track in four flavour versions (`CF_A_PIECES`, `:1289`).
     This builder is almost exactly what a unit song's code would look like.
7. **Shipping is cheap; validation and runtime coupling are where the cost is.**
   - The app imports content TS modules directly; there is no JSON export of bands or capstones.
   - The server imports registries and per-folder files with Bun (`server/src/content/loader.ts`).
   - `.generated/` carries only IDs, indexes, the toolbox, examples, lesson text and the tutor text.
   - About 37 files key off `ui.band`, `makeBandOf`, `bandSetupOf`, `CHECKPOINT_MAKE_BANDS` or `bandCodeAt`
     (§6.6).

---

## 1. Where the content model lives

| Concern | File | Key exports |
|---|---|---|
| Types (contracts §5) | `packages/content-kit/src/schema/{common,exercise,rubric,lesson,catalog,results,wave7}.ts` | `LessonDef`, `StepDef`, `StepUi`, `BandRef`, `CodeMakeEx`, `RubricRule`, `BandDef`, `FlavourKit`, `CapstoneDef`, `SongDef`, … |
| zod mirror (strict objects, `tsc` proves parity) | `packages/content-kit/src/zod.ts` | `LessonDefSchema` :1549, `StepUiSchema` :1486, `codeMakeEx` :1123, `SongDefSchema` :1870, `BandDefSchema` :1913, `FlavourKitSchema` :1926 |
| ID grammar | `packages/content-kit/src/ids.ts` | ID template types :8-54, `FLAVOUR_IDS` :83, `ID_PATTERNS` :108-135, `IdTypes` :145, `idKind`, `IdLockEntry` :440 |
| define* helpers (schema + structural rules + deepFreeze) | `packages/content-kit/src/define.ts` | `define()` :120, `checkLessonStructure` :939, `defineSong` :1371, `defineCapstone` :1437, `defineCheckpoint` :1586, `defineBand` :1619, `defineFlavour` :1643 |
| What the platform implements | `packages/content-kit/src/implemented.ts` | `SCHEMA_FEATURES` :39, `IMPLEMENTED` :181, `unimplementedIn*` |
| Lint types | `packages/content-kit/src/lint-types.ts` | `LINT_PROFILES = graded, studio, content, tutor-card, band` |
| Registries in one object | `content/index.ts:20-38` | `registries`, `courseGraph()` |
| Course graph (legal orders) | `content/lib/course.ts` | `buildCourseGraph`, `atOrBefore`, `unlockedAt`, `firstSite` |
| Loader of lesson/CP files | `content/lib/load.bun.ts` | `loadLessons`, `loadCheckpointFiles`, `contentSourceFiles` |
| Build | `scripts/content/build.ts` → `scripts/content/generate.ts` | `collectIds`, `idsModule`, `updateLock`, `RELEASED_UNITS`, `generate()` |
| Check CLI | `scripts/content/check.ts` | dispatches to `checkLesson`, `checkCheckpoint`, `checkCapstone` |
| Checks | `content/validate/checks.ts` (lessons), `content/validate/owners.ts` (CP, capstones), `content/validate/harness.ts` (lint/evaluate/grade adapters) | |
| Authoring docs | `content/AUTHORING.md` (§8 Band, §11 capstones, §12 checks, §14 registry ownership), `content/STYLE.md` (§2 labels, §10 sections/`arrange()`) | |
| Binding contract | `docs/design/contracts.md` §1 IDs, §2 course map, §5 schema (§5.10 Band), §6.3 form | |

`@oak/api` re-exports all of `@oak/content-kit` (`packages/api/src/index.ts:4`), so the app imports content types
from `@oak/api`.

---

## 2. Types, one by one

### 2.1 IDs (`packages/content-kit/src/ids.ts`)

- Each kind's shape is unique, and the test suite enforces it (`ids.test.ts:126`, "no example matches two kinds").
  Relevant kinds: `UnitId` (`U\d{2}|J[1-5]|R[1-3]|A[1-2]`), `LessonId` (`<unit>.L\d{2}`), `CapstoneId`,
  `CapstoneSessionId` (`<cap>.S\d`), `SongId` (`song.*`), `BandId` (`band.[a-z0-9.-]+`, so dots are allowed),
  `FlavourId` (a closed union of 4), `StepId` (`<lesson>/S\d{1,2}`), `ExerciseId` (`<owner>/<slug>`).
- Adding a kind means touching all of these:
  - `ID_PATTERNS` and the `IdTypes` map in `ids.ts`.
  - The examples table in `ids.test.ts`.
  - `collectIds` and `TYPE_NAMES` in `scripts/content/generate.ts:56-124`, which feed `.generated/ids.ts` and the
    ledger.
  - The registries ID test (`content/validate/registries.test.ts:21-48`).
  - Contracts §1.2 (the grammar table; not machine-synced).
- **The ledger** is `content/ids.lock.json` (`{version:1, ids:[{id,kind,retiredAt?,supersededBy?}]}`). Current
  counts: exercise 1353, step 1184, fact 463, example 405, term 224, canDo 200, lesson 175, tool 145, skill 144,
  family 63, capstoneSession 50, sound 46, song 37, deck 28, milestone 28, unit 28, band 23, capstone 21,
  checkpoint 17, gymSession 17, scale 15, chordFamily 7, flavour 4.
  - `updateLock` (`generate.ts:168`) adds new IDs. The build fails if a locked ID vanishes without `retiredAt`:
    IDs are never renamed (contracts §1.1 rule 4).
  - Lesson-scoped IDs (step, exercise, example) enter the ledger only for units in `RELEASED_UNITS`
    (`generate.ts:154`). That list currently holds every unit, so **every ID is frozen now**.
  - A song's part and section IDs will be keyed into learner state (who owns which part), so they need the same
    ledger treatment, scoped by unit like `LESSON_SCOPED`.
- **An option that needs no new kind:** key the unit song by `UnitId` (exactly one per unit) and give parts and
  sections local slugs (`U05#bass`, `U05#chorus`). Persistence still needs those slugs to be stable, which means
  ledgering them.

### 2.2 Lesson, step and the step UI (`schema/lesson.ts`)

- `LessonDef` (:188-209):
  - Fields: `id`, `version`, `title`, `objective`, **`key: KeySpec`, `meter: MeterId`, `bpm: number`**, `swing?`,
    `pickup?`, `introduces`, `practises`, `terms` (≤3), `canDo`.
  - `flavours?: Partial<Record<FlavourId,{band?,sounds?}>>` holds the per-flavour Band override and starter sound
    swaps. It is used in U06 and U09, for example `{"flavour.jazz-soul":{sounds:{"snd.piano":"snd.rhodes"}}}`.
  - `steps` (≤12; the last is a non-optional `make`) and `wrapAt`.
  - **Key, tempo and meter are lesson-level.** `UnitDef` has only an optional default `meter` (:262-271) and no
    key or tempo.
- `StepDef` (:164-187): `id: S<n>`, `kind` (17 `STEP_KINDS`), `title`, `minutes`, `ui`, `exercise?`, `example?`,
  `graded?`, `optional?`, `testOut?`, `gateCheck?`. `STEP_EXERCISE_KINDS.make = ["code-make","compose-brief"]` (:229).
- `StepUi` (:55-87):
  - Panels; `rollLabels` and `staffLabels`; `loopBars`.
  - **`band?: BandRef | false`**, with the comment "From U01 every Make declares a Band; `false` only when silence
    around the part is the point".
  - `initialPanels` (workbench panels gated by toolbox rows, `WORKBENCH_PANEL_TOOLS` :118; `form` panel =
    `tb.lens.form`); `leadSheet`; `probe`.
- `BandRef` (:144-149):
  ```ts
  export interface BandRef {
    band: BandId;
    /** The Band takes the tonic and mode of the learner's first `.scale()` after each evaluation. */
    followsLearnerKey?: boolean;
    tracks?: readonly ("drums" | "bass" | "chords")[];   // the Band tracks that PLAY (the rest are muted)
  }
  ```
  `tracks` lists what Oak plays; the learner's part is the complement. The app turns the muted tracks into the
  sketch's `band.mutes` (`app/src/lesson/band.ts:46-48`). `makeBandOf(lesson)` takes the last `make` step with a
  band (`:51-55`).
- `TermDef` (:151): `{ id: TermId; step: StepLocalId; card?: { testedIn } }`. The glossary entry is `TermEntry`
  in `catalog.ts:251`.

### 2.3 The Make exercise (`schema/exercise.ts`, `schema/rubric.ts`)

```ts
// exercise.ts:696
export interface CodeMakeEx extends ExBase<"code-make"> {
  code: CodeSpec;                 // { starter (⟪…⟫ editable regions, ⟦id⟧ blanks), toolbox?, autoCheckOnRun? } :422
  bars: [min: number, max: number];
  /** Exactly one rule with `required: true` (contracts §6.5). */
  rubric: RubricRule[];
  saveAs: "sketch";
  fromSketch?: LessonId;          // Wave 6, d15: open with the latest saved sketch of that lesson's Make
}
```
- `ExBase` (:39-79): `id` slug, `version`, `prompt`, `skills`, `role`, optional `key/keyPlan/meter/bpm/swing/pickup`
  that override the lesson's, `params`, `pass`, `hints` (a 4-rung ladder), `feedbackText`, `tutor`, `srs`, `canDo`,
  `fallback`, **`tests: TestCase[]`** (code kinds need ≥1 pass and ≥2 fails; a Make needs a `rubric.unmet` sketch).
- The **one required rule** is enforced in three places:
  - At content:check, check 12 (`content/validate/checks.ts:403-417`).
  - In checkpoint Makes (`owners.ts`).
  - In the `RubricRuleBase.required` docs (`rubric.ts:22-38`).
- Rubric rules can already target a part of a song:
  - `RubricRuleBase.section?: SectionRef` (`{section:"verse", nth?}` | `{bars:[a,b]}` | `"last"`, rubric.ts:20).
    It is read through `sectionsFromAst` (contracts §6.3).
  - Rules name tracks with `TrackRef`: a label `'mel'`, `'*'`, a role `'@bass'`, or a Band track `'band.chords'`
    (common.ts:287-291).
  - So the shape needed to say "today's Make: the chorus bass line, graded on the chorus" already exists.
- `ComposeBriefEx` (:940-950) is the capstone brief: `brief`, `flavours?`, `code`, `rubric` (several required
  rules), `minDurationSec?`, **`album?: { slot }`**, and `review: {tutor}`.
- `fromSketch` validation:
  - In `defineLesson`: it must not name the lesson itself (`define.ts:939-947`, rule `make.from-sketch`).
  - In content CI: the named lesson comes earlier in every legal order (`content/validate/authoring.ts:220`).
  - It is a schema feature (`implemented.ts:117`).

### 2.4 Bands (`content/bands/index.ts`, 1441 lines; type at `catalog.ts:345`)

```ts
export interface BandDef {
  id: BandId; title: string; bars: number;
  roles: ("drums" | "bass" | "chords")[];
  /** Labelled tracks `drums:` `bass:` `chords:` only; may use any tool (lint profile 'band'). */
  code: Record<FlavourId, string>;
  /** The code may contain `{{key}}` (e.g. "C4:major") and `{{bpm}}`. */
  params: { key: boolean; bpm: boolean };
}
```
- **Every flavour is required by the schema.** `z.record(flavourId, …)` with an enum key is exhaustive in zod
  4.6.7; I verified that a pop-only Band fails with `code.flavour.indie: expected string`. The test
  `bands.test.ts:47-50` checks the same thing again.
- **There is no meter or tempo line in a Band.** "A Band carries no tempo line: it plays at the lesson's tempo"
  (AUTHORING §8.2). Meter lives in a side table `BAND_METERS` (`:1433`); the default is 4/4, and the only others are
  waltz 3/4, soul-68 6/8, slow-128 12/8 and odd-54 5/4. `bandMeter(id)` reads it at `:1439`. Check 12 fails a
  Band whose meter differs from the lesson's (`checks.ts:410-415`).
- **Key:** code is written in degrees below the tonic with `.scale("{{key}}")`, or for `TONIC_BANDS` (:1258) in
  semitones above the tonic (`note(...).add(n("0").scale("{{key}}"))`), so one code fits every key. Bands in major
  degrees play bass and chords only under a major key; this is test-enforced (AUTHORING §8, the
  `bands/index.test.ts` "Wave 5" block).
- **Code generation:**
  - `KITS` (:85-114) holds banks, sounds and gains per flavour.
  - `layers(f, parts)` (:150) writes the three labelled tracks with production numbers from `content/flavours.ts`.
  - Groove builders such as `vamp`, `waltz`, `phrase`, `axis`, `doowop`, `rock`, `aeolian`, `blues`, `modal`,
    `sections` each take a flavour and return code. `each(f => …)` (:1037) builds the `Record<FlavourId,string>`.
- **Sections:** `band.sections` (`sectionLayers` :572, `sections` :592) writes consts per `<role><Section>` plus
  one `arrange()` per track (`SECTION_FORM` :557: verse 4 bars, chorus 4, verse, chorus, 16 bars).
  - `SECTION_BANDS` (:1277) marks it.
  - At runtime `followLearnerForm(bandCode, learnerCode)` (`packages/strudel/src/band-form.ts:176`) rewrites the
    Band's `arrange()` to the learner's sections, matching sections by type.
  - It is used only by U09.CP; no lesson Make uses it.
- **Stages (course-position-dependent code):**
  ```ts
  export interface BandStage { from: LessonId; code: string; what: string }   // :1305
  export const BAND_STAGES: Record<bandId, Partial<Record<FlavourId, BandStage[]>>> // :1314
  export function bandCodeAt(band, flavour, reached: (from: LessonId) => boolean): string // :1408
  ```
  jazz-soul moves to four-note chords and swing from U03.L01, and funk to four-note chords from U06.L01. The
  rules behind this are `FLAVOUR_RULES` in `content/flavours.ts:79-96`. Every Band player must go through
  `bandCodeAt`.
- **Side tables:**
  - `BAND_CHANGES` (:1279): the chords each Wave 5+ Band plays, in C.
  - `MODAL_BANDS` (:1270).
  - `COMPOUND_BANDS` (:1045).
  - `bandById` (:1441).
  - Exported chord constants for tests.
- **`followsLearnerKey`** is per step reference, not per Band. It is used in U03 (L02–L05, L08–L11), where the
  learner moves the tune.
- **Contract rules** (contracts §5.10, doc lines 1460-1497):
  1. The Band is never part of the learner's code. It is evaluated separately and collected as
     `band.drums|bass|chords`, and shown as a read-only strip with mute buttons.
  2. It shares the session tempo (one scheduler).
  3. The grader ignores Band tracks unless a rule names one.
  4. Locked tools are allowed (a preview context), but it must pass the strict lint and the audibility check.
  5. A sketch saved over a Band stores `{bandId, flavour, mutes}`.
  6. Every Make from U01 has a Band.
  7. A flavour never changes the rubric.
  8. Starter sounds follow the unlock table.
- **AUTHORING §8 rule 5:** "The grader is not given the Band's code (neither content:check nor the app passes
  `ctx.band` yet)". `GradeContext.band?: string` exists (`packages/grader/src/types.ts:262`) and is honoured at
  `grade/index.ts:241`, but lesson grading does not pass it. Grading a part "in the context of the song" (a
  melody against the song's chords) is therefore not wired today.

### 2.5 Flavours (`content/flavours.ts`; type `FlavourKit` at `catalog.ts:355`)

- There are four kits: `flavour.pop | indie | jazz-soul | funk`. Each kit has `drums/bass/chords/lead: SoundId`,
  `chordDepth`, `swing?`, and `production{room,bassLpf,humanizeVelocity,pan}`. `PRODUCTION_RANGES` (:99) are
  test-enforced.
- `FLAVOUR_RULES` (:79) holds `seventhsFrom`, `feelFrom` and `feel` per flavour. It drives `BAND_STAGES`.
- `flavourSounds(id)` (:104) is the role→sound map. `DEFAULT_STARTER_SOUNDS` (`catalog.ts:372`) is the fallback
  while a flavour sound is locked (rule 8).
- The learner's flavour is stored in `Profile.flavour` (global; `packages/api/src/dto.ts:87`) and in
  `CapstoneState.flavour` (per capstone).
- "A flavour never changes a rubric" is a binding rule. A unit song in four flavours must keep the takeover part's
  rubric flavour-independent.

### 2.6 Syllabus and course graph (`content/syllabus.ts`, `content/lib/course.ts`)

- `units: UnitDef[]` (`syllabus.ts:51-607`) holds, for each unit: `id`, `title`, `track` (`core|J|R|A`),
  `checkpoint?`, and `lessons: LessonMeta[]` (title, objective, introduces, practises, optional, side, splitFrom).
- **Lesson order within a unit is the array order, not the numeric order.** U05 runs
  `L01 L02 L03 L04 L09 L05 L06 L07 L08`: L09 "Chord Names" was split out of L04, with `splitFrom`. Learners who
  had completed L04 before the split are auto-completed for L09 at server start-up, with no Make, so a takeover
  keyed to L09 would never be played by them.
- Core lessons are linear (`course.ts:52-71`): each requires the previous, and L03+ also requires the last
  checkpoint. Track lessons follow gates (`trackGates` :634). `defaultOrder` (:657) interleaves checkpoints,
  capstone sessions and `GYM.nn` slots. Example: `U01.CP` sits after `U02.L01`, and `C0.S1` right after it.
- `contracts-sync.test.ts` re-parses contracts §2.3/§2.6 (lessons), §2.5 (default order), §2.4 (capstone session
  goals), §3.2, §4.1, §7.3 and §7.6. Adding sessions (e.g. a "release" session per unit) means editing the
  contract tables too, plus `SESSION_COUNTS` (:709) and `LANDMARKS`.

### 2.7 Capstones (`content/capstones.ts`, 4663 lines; types at `lesson.ts:331-452`)

```ts
interface CapstoneMeta { id; title; objective; sessions: number; opensAfter: GateSpec; inGymSlots?; kind: "compose"|"transcribe" }
interface CapstoneSessionDef { id: `${cap}.S${n}`; title; goal; focusRules?; stages?; checks?; starter?;
                               review?; release?; formMap?; rubric? }
interface CapstoneDef extends CapstoneMeta { version; key?; meter; bpm?: [min,max]; swing?; brief?: ComposeBriefEx;
                               song?: SongId[]; sessionDefs; reviewRevisions: 1|2; canDo;
                               flavours?: Partial<Record<FlavourId,{band?,sounds?}>>; versions?: CapstoneVersionDef[] }
```
- `GateSpec` (`lesson.ts:280`): `{checkpoints?, lessonsCompleted?, capstones?, familyLevels?}`. Example:
  `opensAfter: { checkpoints: ["U09.CP"] }`.
- Builders:
  - `compose(ComposeSpec)` (:108) builds the brief with all four flavours, `album: {slot: c.album ?? c.id}`, and
    `review: {tutor:"offer"}`.
  - `transcribe()` (:166).
  - `S()` (:58) makes sessions; the **last session gets `review: true, release: true`**.
  - Rubric helpers `req()`/`opt()` (:45-49).
- **Multi-session growth:**
  - `sessionExtras[i].starter` opens S1; later sessions open the previous draft.
  - `focusRules` per session name the brief rules worked on that session. C3 is a good example: four sessions,
    from "Groove & changes" through Melodies and Arrange to "Take & release" (:2128-2185).
  - `versions` (AC1) gives two parallel drafts in one capstone.
- **Section helpers:**
  - `Plan = [bars, Section][]`, `arr(role, plan)`, `sectioned(bpm, consts, tracks)` (:389-401). C3, C4 and C7 are
    built with them.
  - The CF-A `single(SingleSpec)` (:1064) takes `{bpm, plan, plain (through tracks), parts: role → Section → pattern,
    uses (reuse or rest), tails: role → chain after arrange()}`. `CF_A_PIECES` has pop, indie, jazzSoul and funk
    versions of a 56-bar single (:1289-1311). **This is the nearest existing code to "a complete song in four
    flavours".**
- Release, album and liner notes: `CAPSTONE_LINER_SEEDS` (:1509), `CAPSTONE_LINER_PROMPTS` (:1616),
  `tb.feature.album`, which unlocks at `C0.S1` START (`content/toolbox.ts:191`), and `OAK_CAPSTONE_UNITS`
  (`content/oak.layout.ts:46`), which attaches capstones to unit sprigs for display.
- `capstoneMetas` (:4655) feeds the syllabus. `capstoneById` is at :4650.
- `defineCapstone` checks (`define.ts:1437-1584`):
  - `sessionDefs.length === sessions`.
  - Session ids run `.S1..n`.
  - Compose capstones have a brief, and the brief has required rules.
  - Only the last session releases.
  - `focusRules` exist in the brief, plus the version, check and form-map rules.

### 2.8 Checkpoints (`content/checkpoints.ts`)

- `checkpointMetas` (:23) lists `cp(id, title, covers, gated, levelSetting)`. `U09.CP` covers U08 and U09; U08,
  U12, U15 and U16 have no checkpoint of their own.
- `CHECKPOINT_MAKE_BANDS: Partial<Record<CheckpointId, BandRef>>` (:71): a checkpoint has no steps, so its Make's
  Band is registered here.
- `CheckpointDef` (`lesson.ts:315`) has `authored` items, a generator `recipe`, and `make: CodeMakeEx`. Files live
  in `content/core/Uxx/CP/checkpoint.ts`.
- `CHECKPOINT_RULES` (:110).

### 2.9 Toolbox (the only unlock table, `content/toolbox.ts`)

- `ToolEntry` (`catalog.ts:59`): `{ id (tb.|snd.|scale.|chord.), kind, group, code, unlock: UnlockSpec, concept,
  preview?, audible?, audibility?, catalog{signature,meaning,demo}, matches? }`.
- `UnlockSpec` (:45): `{ at: SessionId | SessionId[], when: "complete"|"start", condition? (voicing gate),
  fallbackAt? }`.
- Rows are built with `row()`, `feature()`, `drum()`, `bank()`, `inst()`, `h()`. `defineToolbox` runs at :184.
- Relevant rows:
  - `tb.feature.band` ("Band layer (read-only backing; mute only)", U00.L01).
  - `tb.feature.studio`.
  - `tb.feature.album` (C0.S1, START).
  - `tb.lens.form` (the form panel).
- A unit song is Oak code, so like a Band it would be a preview context (locked tools allowed). Any learner-editable
  starter for a takeover must still use only tools unlocked at that lesson.

### 2.10 Milestones, can-dos and terms

- `MilestoneDef` (`catalog.ts:288`): `when: { sessions?, capstones? (released), canDos?, ladder?, anyOf? }`.
  Example: `ms.01` "You can make a beat." `when: { capstones: ["C0"] }` (`content/milestones.ts:7`).
  - If unit-song releases replace capstone releases as album tracks, milestones need a new condition kind
    (`songs?: UnitId[]`). `MilestoneCondition.capstones` takes only `CapstoneId`.
- `CanDoDef` (`catalog.ts:265`): `{id, area, statement, skills, source: LessonId|CapstoneId|CheckpointId}`.
  `content/candos.ts` builds them with `c(...)`; `content/cando.ts` re-exports.
- `TermEntry` (`catalog.ts:251`) lives in `content/terms.ts`. Song titles and section names in learner-facing text
  must respect term gating: check 14 fails a term such as "chorus", "verse", "bridge", "cadence" or "swing" used
  before its lesson. **This matters for a Today screen that labels sections "verse/chorus" from U01**: the words
  `term.verse`, `term.chorus` and `term.form` are introduced by U09.L02, `term.bridge` by U09.L03 and
  `term.swing` by U11.L07 (`content/terms.ts:130-154`). The term check would need to scan the song's labels, or
  the UI must avoid those words before then.

### 2.11 Oak illustration layout (`content/oak.layout.ts`)

`OAK_ANCHORS: Record<unit, {limb, start, step, join}>` gives fixed sprig geometry per unit. `OAK_CAPSTONE_UNITS`
attaches capstones to units for display. A unit song would hang on the same unit anchor; nothing here blocks it.

### 2.12 Repertoire `SongDef` (the name clash)

`catalog.ts:302-341`: `{ id: song.*, title, year, status, provenance, verifiedBy, key, meter, bpm, pickup?, swing?,
form: string, answerKey: { bars, code, layers: Partial<Record<drums|bass|chords|melody,string>>, chords?, phrases?,
sections?: {label, bars:[from,to]}[] }, keyPlan?, availableFrom?, schema? }`.

- `defineSong` (`define.ts:1371`) checks:
  - `song.sections`: sections are contiguous from bar 1 and end at `answerKey.bars`.
  - `song.key-plan`: in bar order, and the first entry equals `key`.
  - `song.chord-bar` and `song.slash-chord`.
- Files live in `content/repertoire/<slug>/song.ts`. The metadata registry is `content/repertoire/index.ts`
  (`RepertoireEntry`).
- The section validation is worth copying. The type itself is about transcription answer keys, not a playable
  multi-flavour backing.

### 2.13 Unit specs (`content/specs/Uxx.ts`, types in `content/specs/types.ts`)

- These are per-unit authoring intent, rendered to `Uxx.md` by `bun scripts/content/spec.ts`.
- `UnitSpec` (:347): `{unit, title, summary, covers?, lessons: LessonSpec[], checkpoint?, capstones, gym?, ending?,
  conventions}`.
- `LessonSpec.make` is `{brief, required:{rule,label,why}, suggestions, band: BandId|false,
  tracks?: ("drums"|"bass"|"chords")[], flavours}`. `epr` adds enjoyment, pace and return.
- `specDrift` (`checks.ts:452`) warns when a lesson's Make Band or required rule departs from the spec.
  `content/validate/specs.test.ts` checks specs against the registries.
- **This is the natural place for the song plan as authoring intent.** `LessonSpec.make.band/tracks` would become
  `make.part/sections`.

---

## 3. Data flow: authored → validated → shipped

```
content/*.ts, content/core/**/lesson.ts|.mdx, CP/checkpoint.ts, repertoire/*/song.ts
   │  define*() at import time: zod schema + structural rules, deepFreeze; throws ContentDefinitionError
   ▼
content/index.ts `registries` + content/lib/course.ts `courseGraph()`
   │
   ├─ bun run content:build ─► scripts/content/generate.ts ─► content/.generated/ (gitignored)
   │        ids.ts (unions + guards per kind), index.json (contentVersion, counts, units, capstones, defaultOrder),
   │        course-index.json (sessions, requires, unlocks, defaultOrder), skill-graph.json, toolbox.json,
   │        catalog.json, lessons.json (per-lesson source hash = contentHash), examples.json, sounds-used.json,
   │        lesson-text/<id>.json, tutor/syllabus.md, tutor/catalog.md; and content/ids.lock.json (committed)
   │
   ├─ APP (Vite): imports content TS directly by relative path or the @content alias (app/vite.config.ts:89)
   │        lessons/MDX/checkpoints lazily via import.meta.glob (app/src/lesson/content.ts:13-19),
   │        bands/checkpoints/course graph eagerly (app/src/lesson/band.ts:8-11), capstones (app/src/capstone/content.ts),
   │        repertoire songs via glob (app/src/capstone/x1/songs.ts:8), .generated/*.json via glob (app/src/lib/content.ts:8)
   │
   └─ SERVER (Bun): server/src/content/loader.ts imports syllabus/skills/families/toolbox/terms/candos/milestones/
            repertoire/capstones and globs **/{lesson,checkpoint,capstone,song}.ts; reads .generated/index.json for
            contentVersion and tutor/*.md. ContentSource (server/src/content/types.ts) has NO bands and NO flavours.
```

Consequences for a unit song:

- **App:** add `content/songs/index.ts`, or per-unit files plus a glob, and import it like bands. No build step is
  needed. Each player of the song would need an equivalent of `bandSetupOf` (`app/src/lesson/band.ts:15`).
- **Server:** add the song to `loadContent`, `ContentSource` and `fixture.ts`, but only if the server needs it:
  - for the planner's "what today adds",
  - for sketch or song state per learner (today `bandState` is only `{bandId, flavour, mutes}`, DTO
    `packages/api/src/dto.ts:1584`),
  - for the release/album flow (server-side for capstones),
  - for tutor context.
  - **Gotcha:** the existing server glob `**/{lesson,checkpoint,capstone,song}.ts` would pick up any new `song.ts`
    and report "unexpected id". Pick another filename (`unit-song.ts`, `tune.ts`).
- **Generated:** add the new ID kind to `collectIds`/`TYPE_NAMES`. Optionally emit a compact `songs.json` or a
  `units[].song` summary in `course-index.json` (parts, sections, takeover plan by lesson), so the Today screen and
  the server can read it without importing TS. Add a line per unit to `tutor/syllabus.md` so the tutor knows the
  song. The output-list test in `content/validate/build.test.ts:34-63` must be updated.
- **Ledger:** part and section slugs that learner state is keyed by must join `ids.lock.json` and never change.

---

## 4. Validation pipeline

### 4.1 Definition time (`define*`)
Each `define*` runs the zod schema plus structural rules and throws on any issue (`ContentDefinitionError` lists
`path: message [rule]`). Because files throw at import, a broken file becomes a **load error**: `content:check`
reports it, and the server records it as a `ContentProblem` and starts anyway.

### 4.2 `bun run content:check <id>` (`scripts/content/check.ts`)
The target is a lesson id, a unit id (its authored lessons plus its CP file), a checkpoint id, a capstone id, or
`all`, which covers every lesson, every CP file, and every capstone brief that has tests or authored transcription
sessions. It is read-only, prints each numbered check, and exits 1 on any failure.

**Lesson checks** (`content/validate/checks.ts:539-555`, AUTHORING §12.1):

| n | Name | What |
|---|---|---|
| 1 | Schema and MDX | folder id = def id; MDX `<Step id>` ↔ steps; MDX component props name existing IDs |
| 2 | IDs | terms, can-dos, flavours, **`ui.band` exists in `bandById`**, families, skills, rubric tool ids; nothing unimplemented (`unimplementedInLesson`) |
| 3 | Map | title/introduces/practises equal the syllabus row |
| 4 | STYLE lint and unlock-before-use | `lintOak` profile `content` on every code string in this session's unlock context; rubric `uses`/`sounds` tools unlocked; flavour sound swaps unlocked; panels/probes unlocked; gate check |
| 5 | (merged into 4) | |
| 6 | Evaluation | every example/starter/solution evaluates headlessly (`evalHeadless`), **not silent**, **has a tempo line**, no BAD_LOG |
| 7 | Grading | every test meets `expect` and feedback codes; every reference solution passes |
| 8 | Hints | 4 rungs; no solution literal in rungs 1–3 |
| 9 | Notation | staff examples render exactly |
| 10 | Sounds | audibility proven (pending otherwise) |
| 11 | Budget | `checkLessonAuthoring` (minutes, steps, graded checks, terms, test counts) |
| 12 | Make | last step is a Make with **exactly one required rule**; **a Band from U01 on**; **Band meter = lesson meter** |
| 13 | Theory | `.scale()` keys match the declared key; chord symbols parse |
| 14 | Voice, terms and test shape | voice rules, term gating, starter fails `code.unchanged`, Make has a `rubric.unmet` sketch; advice: later terms, spec drift |
| 15 | Corrections standard | advanced-track lessons only |

**Capstone and checkpoint checks** (`content/validate/owners.ts`):
- `checkCapstone` (:416): 1 Brief and tests (≥2 pass, ≥2 fail, the starter graded); 5 Sessions
  (`capstoneSessionSections` :277: each session `starter` lints in that session's context and is not silent, only
  the last releases, song checks resolve against answer keys); then `exerciseSections` (:79), which reuses 2 IDs,
  4 lint, 6 evaluation (`evalBars` 4), 7 grading (`mode: "capstone"`), and 8 hints; then 14 voice; 15 standard.
- `checkCheckpoint` (:216): 3 map vs registry; items; 12 Make (one required rule).

### 4.3 `bun run test:content` (bun tests; not part of `content:check`)
- `content/validate/bands.test.ts`:
  - Every band × flavour evaluates in C, G and E♭ (`fill()` adds `setcpm(96/beats)` and substitutes `{{key}}`).
  - No BAD_LOG.
  - **Evaluated tracks equal `roles`**, and every role has events.
  - Strict lint `profile: "band"` with `allowPreview` passes at `U01.L01`.
  - Every band has every flavour.
  - Kits sit in the production ranges.
- `content/bands/index.test.ts` (1155 lines):
  - Stages per `FLAVOUR_RULES`.
  - **Every band × flavour × stage in all twelve keys.**
  - Production defaults (room, lpf, pan from the kit, velocities within ±0.08 of 0.92).
  - Harmony facts checked against Strudel; voice-leading (no voice moves more than a M3).
  - Swing timing.
  - **"Music over every flavour"**: no learner note a half step above a Band note for a beat.
  - Room for the learner's chords (no Band chords under learner chords); under a learner bass, no Band bass.
  - Band meter = step meter; major-degree Bands only under major keys.
  - Modal vamps never sound the mode-breaking note.
- `content/validate/course.test.ts:752-812`: "music over the Band", the same half-step-clash scan over every authored
  lesson step with a Band (`ALLOWED_CLASHES` whitelist).
- `content/validate/registries.test.ts`:
  - IDs: grammar, uniqueness, ledger.
  - Course map and session counts.
  - Skill graph order.
  - References resolve.
  - Capstones: "one album slot each, the four flavours offered".
  - Glossary examples play and lint; the tempo-line divisor is checked per meter at :280-300.
- `content/validate/contracts-sync.test.ts`: the contract tables against the data.
- `content/validate/build.test.ts`: byte-identical builds, outputs present, ledger behaviour, the `content:new`
  scaffold.
- `content/validate/capstones.test.ts`: compose starters evaluate and are unlocked at S1; binding rubric fixes; gates.
- `content/validate/specs.test.ts`: specs against the registries.
- `packages/strudel/e2e/wave5.pw.ts` (browser): **mix balance** of every Band in every flavour (the ≤10 LU rule
  behind `chordsLift`/`drumsLift` in bands).
- `packages/content-kit/src/*.test.ts`: the define* rules.

### 4.4 Harness (`content/validate/harness.ts`)
- `unlockedFor(session)`.
- `lint(code, {session, meter, key, allowPreview, profile})` calls `grader.lintOak(code, ctx, toolbox)`.
- `evaluate(code, bars)` calls `evalHeadless` and returns `{ok, events, logs, cpsSet, cps, tracks}`.
- `grade(e, test, lessonLike, session, mode, extra)` calls the real grader.
- `BAD_LOG`.

**Everything a song check needs already exists here.**

---

## 5. Survey: what every unit's Makes look like today

Produced with a read-only script that loads every lesson (`loadLessons`) and reads the last step (0 load errors,
176 lessons, 1182 steps, 402 steps with a Band, 244 of them non-Make, 175 `code-make`, 0 `compose-brief`). "Oak
plays" means the Band's `tracks` (`all` when unset). "Learner labels" are the labels in the Make starter.

| Unit | Meters | BPMs | Keys | Oak plays in the Make | Learner labels | Notes for a unit song |
|---|---|---|---|---|---|---|
| U00 | 4/4 | 92 | C | `band: false` (the onboarding loop) | drums,bass,chords,mel | already a 4-part loop |
| U01 | 4/4, **3/4 (L08)** | 88–108 | C | two-chord-vamp [bass+chords]; L08 waltz-vamp | drums / kick,snare,hats | bars 1–2 (L07 4–8); the learner builds drum lanes one by one |
| U02 | 4/4 | 80–96 | C | two-chord-vamp [all] | mel | the most "take over one part" unit |
| U03 | 4/4 | 80–96 | C, **G (L06), F (L07)** | two-chord-vamp [all], phrase-8bar (L11); `followsLearnerKey` L02–05, L08–11 | mel | key lessons move the song |
| U04 | 4/4 | 84–96 | C | two-chord-vamp [all] | mel (+vox, keys) | |
| U05 | 4/4 | 80–92 | C | axis-4bar [drums] or [drums+bass]; L06 [drums+chords] | chords (L06 bass) | order L01-04, **L09**, L05-08 |
| U06 | 4/4 | **76–100 (8 values)** | C (L02 ex G) | axis-4bar [drums] | chords (+bass, mel) | L10 `fromSketch U05.L01` |
| U07 | 4/4, **3/4 (L09, F)** | 76–104 | C, F | phrase-8bar / axis / vamp, [all]→[drums] | mel, chords+mel | |
| U08 | 4/4 | 92–100 | C | axis-4bar [drums]; L04 [chords] | chords,bass; kick,bass | |
| U09 | 4/4 | 100–112 | C | L01 phrase-8bar [all]; else axis [drums] | chords,bass,mel(,hats) | bars 12–32; form/contrast rules; `band.sections` exists but is unused here |
| U10 | 4/4 | 76–100 | **C minor, C major, A minor** | axis [drums] | chords,bass,mel | L06 `fromSketch U10.L05` |
| U11 | 4/4 | 90–112 | C, A minor pent., C blues | axis [drums]; **L07–L08 `band:false`** | chords,bass,gtr; then everything | 12–24 bars from L05; L07 fromSketch L06 |
| U12 | 4/4 | 76–112 | C, A minor | axis [drums] | chords,bass,mel | |
| U13 | 4/4, **6/8 (L04, 60 BPM)** | 76–100 | C | **`band:false` in every lesson** | kick,snare,hats,bass,chords(,mel) | |
| U14 | 4/4 | 84–112 | **a different mode each lesson** (G mixo, D dor, F lyd, E phryg) | axis [drums] | chords,bass,gtr/mel | |
| U15 | 4/4 | 84–120 | C | axis [drums] | chords,bass,mel | L06 `fromSketch U12.L04` |
| U16 | 4/4 | 80–112 | C, A minor | axis / aeolian [drums] | chords,bass,(pad),mel | |
| U17 | 4/4 | 92–112 | C, F | axis [drums] | chords,bass,mel | key-change rules; 8–24 bars |
| J1–J5 | 4/4 | 72–176 | varies per lesson | two-five-one mostly [drums]; blues-12bar J4.L02 | chords,bass,mel | |
| R1 | 4/4 | 88–100 | E/A/C/D minor | aeolian [chords]; L03–L05 `band:false` | kick,snare,hats,bass,keys | |
| R2 | **5/4, 7/8, 6/8, 4/4** | 60–240 | minors | mostly `band:false`; L03 soul-68 | everything | |
| R3 | 4/4 | 100–128 | C | son-montuno, various tracks | perc,bass,keys | |
| **A1** | 4/4 | **100 throughout** | **C throughout** | two-chord-vamp [chords] throughout | kick,snare,hats,bass,mel(,pad) | already one song in practice: a natural pilot |
| **A2** | 4/4 | **90–96** | **A minor throughout** | aeolian-4bar, mostly [drums] | bass,chords,(pad),mel | also nearly consistent |

Band usage over all steps: axis-4bar 250, two-chord-vamp 78, two-five-one 21, aeolian-4bar 20, phrase-8bar 18,
waltz-vamp 8, son-montuno 5, blues-12bar 1, soul-68 1. Only 2 lessons use more than one Band. Of the 23 Bands,
14 serve only checkpoints, capstones or Studio.

---

## 6. How to add a typed, validated, shipped per-unit song type

### 6.1 Closest pattern to copy, by concern

| Concern | Copy from |
|---|---|
| Per-flavour code, exhaustive over flavours, Oak-played, read-only, preview lint profile | **`BandDef` / `defineBand` / `content/bands/index.ts`** |
| Code changes with course position (jazz-soul sevenths from U03, funk from U06; or "after U05.L03 the song's bass is the learner's") | **`BAND_STAGES` / `bandCodeAt(reached)`** |
| A song in sections, consts per `<label><Section>`, one `arrange()` per track, following a form | **`band.sections` + `band-form.ts`**; **CF-A `single()`** (`capstones.ts:1064`) and C3's `Plan/arr/sectioned` (`:389-401`) |
| Contiguous section list with bars | **repertoire `defineSong` → `song.sections`** (`define.ts:1395-1414`) |
| Growing across sessions, a starter, release only at the end, album slot, liner notes, gate | **capstones** (`CapstoneSessionDef.starter/release/review`, `S()`, `ComposeBriefEx.album`, `CAPSTONE_LINER_SEEDS`) |
| The Make opens with the learner's earlier work | **`CodeMakeEx.fromSketch`** |
| Per-unit authoring intent | **`content/specs/types.ts` `LessonSpec.make`** |
| CI | **`content/validate/bands.test.ts` + `content/bands/index.test.ts`** for the music; **`owners.ts` `checkCapstone`** for a `content:check` target |

Recommendation: a new registry type shaped like `BandDef`, with code per flavour, extended with
`meter/bpm/key/swing`, a section form, named parts (labels from STYLE §2), stages and a takeover plan. Its code is
written with a `single()`-style builder. Its CI copies the Band tests, and it gets a `content:check` section like
`checkCapstone`. Do not reuse `BandDef`: its 3-role limit is in too many places (§6.6).

### 6.2 Schema sketch (`packages/content-kit/src/schema/catalog.ts` or a new `schema/unit-song.ts`)

```ts
import type { FlavourId, LessonId, UnitId, CapstoneId } from "../ids.ts";
import type { KeySpec, MeterId, SwingSpec, TrackLabel, Layer } from "./common.ts";   // TRACK_LABELS :333, LABEL_ROLES :350

/** One part of the song: a STYLE §2 label; its role follows LABEL_ROLES (kick/snare/hats → drums). */
export interface UnitSongPart {
  label: TrackLabel | `${TrackLabel}${2|3|4}`;   // "kick", "bass", "chords", "mel", "mel2"
  title: string;                                   // learner-facing ("Bass"); term-gated by check 14
  /** Sub-lanes a lesson may take over separately (U01: drums → kick/snare/hats). Optional. */
  of?: string;                                     // parent part label when this is a lane
}
export interface UnitSongSection { name: string; bars: number }   // contracts §6.3 names: "intro", "verse", "chorus2"

/** What one lesson's Make does to the song (the "takeover plan"). */
export interface UnitSongTakeover {
  lesson: LessonId;                 // a lesson of `unit`, in syllabus order
  part: string;                     // a part label; Oak stops playing it in `sections`
  sections?: string[];              // default: every section the part plays in
  mode: "replace" | "extend";       // replace Oak's part / build on the learner's own earlier version of it
}

export interface UnitSongDef {
  id: UnitSongId;                   // new ID kind (e.g. `tune.u05`) or simply `unit: UnitId` as the key
  unit: UnitId;
  title: string;
  key: KeySpec;                     // or a keyPlan by section/lesson (U03, U10, U14, U17 move keys)
  meter: MeterId;                   // one meter: units with a 3/4 or 6/8 lesson need a decision (§5)
  bpm: number;                      // one tempo (today every unit has several)
  swing?: SwingSpec;
  form: UnitSongSection[];          // order and bars; total = sum
  parts: UnitSongPart[];
  /** Whole-song code per flavour: consts `<label><Section>` + one arrange() per labelled track (STYLE §10). */
  code: Record<FlavourId, string>;  // exhaustive, like BandDef.code (zod 4 record with enum key)
  params?: { key: boolean };        // `{{key}}` as in Bands, if the song follows a lesson/learner key
  takeover: UnitSongTakeover[];
  /** How the unit ends: the release (album slot, liner seeds), and the capstone it replaces or feeds. */
  release: { album: { slot: string }; capstone?: CapstoneId; linerSeeds?: string[] };
}
```

Stages (flavour rules): either keep the `BAND_STAGES` side table keyed by song id, or derive them. The jazz-soul
and funk rules are lesson-dated (U03.L01, U06.L01), and a U01–U02 song in jazz-soul must stay triads and straight.

### 6.3 Files to touch to make it typed

1. `packages/content-kit/src/schema/catalog.ts` (or a new schema file plus `schema/index.ts`): the interfaces.
2. `packages/content-kit/src/zod.ts`: `UnitSongDefSchema` as a strictObject, with `code: z.record(flavourId, z.string().min(1))`
   (exhaustive), `form` `.min(1)`, and `parts` `.min(1)`.
3. `packages/content-kit/src/define.ts`: `defineUnitSong()` with structural rules:
   - unique part labels; every lane's `of` is a part;
   - unique section names per type with a digit suffix (`chorus2`, contracts §6.3);
   - `bars > 0`;
   - every takeover `part` exists; every takeover `sections` entry is in `form`;
   - every `code[f]` has a `<label>:` line for every part (as `band.role-track` does) and one `arrange()` per
     labelled track whose section list equals `form`. This is a static parse, like `arrangeCalls` and
     `learnerSectionsOf` in `packages/strudel/src/band-form.ts`. content-kit cannot import @oak/strudel, so either
     use a small copy or move the parser to content-kit.
4. `packages/content-kit/src/ids.ts` (if a new kind): pattern, `IdTypes`, plus `ids.test.ts` examples. Also
   `scripts/content/generate.ts` (`collectIds`, `TYPE_NAMES`), `content/validate/registries.test.ts` (IDs block),
   and contracts §1.2.
5. `packages/content-kit/src/implemented.ts`: a `SCHEMA_FEATURES` entry (e.g. `"unit-song"` and
   `"make.takeover"`), so lessons cannot use it before the app supports it. `unimplementedInLesson` already reports
   features.
6. If lessons point at the song: `StepUi.song?: { part: string; sections?: string[] }` next to or instead of `band`
   (`schema/lesson.ts:66`, `zod.ts:1495`), and `checkLessonStructure` rules: a Make has a song ref or a band, and
   the part matches the takeover plan.
7. `content/songs/index.ts` (new registry, like `content/bands/index.ts`), exporting `unitSongs`, `unitSongByUnit`,
   and a `songCodeAt(song, flavour, reached, owned)` analogous to `bandCodeAt`. Add it to `registries` in
   `content/index.ts:20`.
8. Contracts: a new §5.11 (or extend §5.10), §1.2 if a new ID kind, and the §2.x tables if sessions change
   (e.g. a release session per unit, which drives `defaultOrder`, `SESSION_COUNTS` and `contracts-sync`).

### 6.4 Validation, mapped to each requirement

| Requirement | Where and how (copy from) |
|---|---|
| **Typed** | zod schema + `tsc` parity (`zod.ts` annotates every schema with its type) + `defineUnitSong` at import |
| **Every flavour present** | the exhaustive zod record (verified) + a test "every song has a `<flavour>` version" (`bands.test.ts:47-50`) |
| **Evaluates** | for song × flavour × stage, and × keys if `params.key`: `evaluate(fill(code), totalBars)` gives `r.ok`, no `BAD_LOG` (`bands.test.ts:26-46`; `bands/index.test.ts:113`). `totalBars = Σ form.bars`; grading mode `capstone` allows up to 128 bars and 5 s (contracts §6.4) |
| **Not silent** | `r.events.length > 0` (`checks.ts:252`) **and** per part per section: every part has events in every section it is not `silence` in (stricter than Bands' "every role has events") |
| **Tracks are what it declares** | `[...r.tracks].sort() == parts.map(label).sort()` (`bands.test.ts:33`) |
| **Lints** | Oak's code: `lint(code, { session: firstLesson, meter: song.meter, allowPreview: true, profile: "band" })` with no errors (`bands.test.ts:37-45`). The learner-editable takeover starter in each Make still goes through lesson check 4 (`profile: "content"`, the lesson's unlock context) |
| **Meter consistent** | `song.meter` equals every takeover lesson's `def.meter` (and the Make exercise's `meter` override), as check 12 does with `bandMeter` (`checks.ts:410-415`); and if the code carries its own tempo line, the divisor is `METERS[meter].unitsPerBar` (the glossary test `registries.test.ts:280-300`) |
| **BPM consistent** | today no unit has one BPM. Either drop `bpm` from takeover lessons (the song's wins), or assert `lesson.bpm === song.bpm`. Also: Bands carry no tempo line ("one scheduler", contracts §5.10 rule 2); decide whether the song or the learner's code owns `setcpm` |
| **Key consistent** | `.scale()` in Oak's code matches `song.key` (the check 13 regex, `checks.ts:420-437`), or `{{key}}` with `params.key`. A major-degree song only under a major key (`bands/index.test.ts` "Wave 5" block) |
| **Sections** | `form` contiguous and positive (`song.sections`, `define.ts:1395`); each section's bars a multiple of its pattern period (the grader's `form.section-period` warning, contracts §6.3 item 7) |
| **Takeover plan** | every lesson of the unit appears at most once, in syllabus array order (not ID order: U05.L09); optional/side lessons and `splitFrom` lessons are not the only owner of a part (they can be skipped or auto-completed); the Make's required rule targets the taken-over part (its `track` resolves to that label/role); Make `bars` fit the section lengths; the Make's starter, references and passing tests, **played inside the song with Oak's remaining parts**, pass the half-step clash scan (`course.test.ts:752-812`) and the "room for the learner's part" rules (`bands/index.test.ts:479-505, 767`) |
| **Music quality** | voice-leading, production defaults from the kit, the modal guards, mix balance in the browser (`packages/strudel/e2e/wave5.pw.ts`) |
| **`content:check` target** | in `scripts/content/check.ts`, when `unitIds.has(arg)` (:117), add `checkUnitSong(song)`. Number the sections with AUTHORING §12.1 numbers (1 schema, 2 IDs, 3 map vs syllabus, 4 lint, 6 evaluation, 10 sounds, 12 Make/takeover, 13 theory) and add the song to `all`. Note the precedent: "The Band scan is not part of `content:check`" (AUTHORING §12); the clash scans live only in `test:content` |

### 6.5 Shipping, step by step

- **App:** import `content/songs/index.ts` directly, like `app/src/lesson/band.ts:8`. Build a `songSetupOf(song,
  {flavour, at, owned})` like `bandSetupOf`. Today's player has two layers, learner code plus read-only Band code
  (`BandSetup`, `packages/strudel/src/types.ts:79-86`, `tracks: ("drums"|"bass"|"chords")[]`). A song needs a third
  source, **the learner's own earlier parts**, either merged into the editable buffer (the capstone-draft and
  `fromSketch` model) or played as another read-only layer.
- **Server:** add to `loadContent` (`server/src/content/loader.ts`), `ContentSource` (`types.ts`) and
  `fixture.ts`, if the server plans "what today adds", stores song state, or runs the release. Persisted state today
  is the sketch version's `band: {bandId, flavour, mutes}` (`packages/api/src/dto.ts:1584-1588`), with
  `SKETCH_ORIGINS` at :1575. A song needs `{songId, flavour, ownedParts: {part, sketchId, version}[]}` or similar.
  Tutor subject kinds (`SUBJECT_KINDS`, `ids.ts:86`) have no "song" kind.
- **Generated:** optional `songs.json` or a `course-index.json` addition; add the new kind to `ids.ts` and the ledger.

### 6.6 What keys off `ui.band` today (must change or be bridged)

- **Content:**
  - `content/validate/checks.ts` (check 2 band exists, check 12 Make band and meter, `specDrift`).
  - `content/validate/course.test.ts`, `content/validate/u12-u17-music.test.ts`, `content/validate/wave7-music.test.ts`.
  - `content/bands/index.test.ts`.
  - `content/checkpoints.ts` (`CHECKPOINT_MAKE_BANDS`).
  - `content/specs/{U00,U14,J2,J5,R3}.ts`, `content/advanced/R3/teaching-review.test.ts`.
  - `content/AUTHORING.md` §8.
- **App:**
  - `app/src/lesson/{band.ts, LessonPlayer.tsx, server.ts, checkpoint/CheckpointPlayer.tsx}`.
  - `app/src/workbench/{model.ts, use-analysis.ts, dev/Playground.tsx, dev/StepHarness.tsx}` and the
    `wave4/wave5-course` tests.
  - `app/src/studio/model.ts`, `app/src/capstone/{content.ts, export.ts}`.
- **Packages:**
  - `packages/strudel/src/{band.ts, band-form.ts, types.ts}` and the e2e specs (`wave4/5/6.pw.ts`).
  - `packages/grader/src/runtime/analyze.ts:77` (band lint), `packages/grader/src/rubric/rules.ts`.
- **API and server:** `packages/api/src/dto.ts` (bandState); `server/src/tutor-adapters/review-facts-w7.ts`.
- About 37 files mention these helpers. Files with the hard-coded `"drums" | "bass" | "chords"` union include
  `app/src/{studio/model.ts, capstone/content.ts, capstone/export.ts, capstone/Workspace.tsx, workbench/model.ts,
  workbench/use-analysis.ts, lesson/server.ts, lesson/band.ts, transcribe/GymPages.tsx, onboarding/loop.ts}`,
  `packages/grader/src/rubric/rules.ts`, `packages/strudel/src/types.ts`,
  `packages/content-kit/src/schema/{lesson,catalog}.ts`, `content/flavours.ts` and `content/specs/types.ts`.

---

## 7. What makes the rework easy, and what makes it hard

**Easy, or already there**
- Exhaustive per-flavour code with schema enforcement and a full CI recipe (Bands).
- Strudel sections are a solved convention: STYLE §10 and contracts §6.3 (one `arrange()` per labelled track,
  `<role><Section>` names, `sectionsFromAst`); `band-form.ts` parses and rewrites them statically; rubric rules
  can be scoped by `section`.
- A whole-song generator in four flavours exists (CF-A `single()` / `CF_A_PIECES`).
- Course position is computable (`courseGraph().before`, `atOrBefore`), and `bandCodeAt(reached)` shows how to
  derive "what Oak plays at this lesson".
- Release, album and liner-notes machinery exists for capstones.
- Content reaches the app with no build step (direct TS imports). The server loader is a short, explicit list.
- Two units (A1, A2) are already consistent in key, tempo and Band: pilots that need almost no lesson rewrites.

**Hard**
- **Tempo, key and meter are lesson-level and vary inside every unit** (§5). Some lessons exist to change key or
  mode (U03.L06–L07, U10, U14, U17) or meter (U01.L08, U07.L09, U13.L04, R2). A single persistent song conflicts
  with them unless key and meter can change by section, or the song "moves" with the lesson (`{{key}}`,
  `followsLearnerKey`).
- **Lesson IDs, step IDs and exercise IDs are frozen** (`RELEASED_UNITS` covers every unit). Lessons can be
  revised (`version` bumps; `lessons.json` hash) but not renamed. Takeover data should therefore attach without
  renumbering anything.
- **The 3-role Band contract** runs from the type through the runtime to the DTO. Oak playing melody, pad or
  separate drum lanes needs a new type, or a contract change touching around 15 non-test files.
- **Grading in context is not wired.** `GradeContext.band` exists, but lessons don't pass it (AUTHORING §8.5), so
  "your bass against the song's chords" can be shown but not graded against Oak's parts yet.
- **The learner's earlier parts are a third audio source** that doesn't exist today: learner code plus Band only.
  Also unresolved: whose `setcpm` wins, and how saved sketches of different bar lengths (1–2 bars in U01, 16–32 in
  U09) fit a fixed song form.
- **Today the learner writes several parts per Make from U05 on.** Moving to one takeover per lesson changes many
  Make starters and rubrics. "A flavour never changes the rubric" still holds.
- **Term gating.** Section names ("verse", "chorus", "bridge") and words like "swing" are terms taught in later
  lessons (U09 for form); a Today screen that labels song sections from U01 collides with check 14 unless the UI
  uses neutral labels until then.
- **Album and capstone overlap.** Album tracks currently come only from capstones (`tb.feature.album` unlocks at
  `C0.S1`; milestones wait on capstone releases; `OAK_CAPSTONE_UNITS`). A per-unit release needs a decision on
  whether it replaces C0–C7, feeds them, or sits beside them, plus milestone and contract-table updates
  (`contracts-sync`, `SESSION_COUNTS`, `defaultOrder`) if sessions change.
- **Split and auto-completed lessons** (U05.L09 `splitFrom` U05.L04) and optional or side lessons (A1.L01–L04,
  J2.L04 passable) mean some learners never play a given lesson's takeover. The plan must tolerate a missing owner
  (Oak keeps the part).
- **Naming and globs:** `SongDef` and `song.ts` are taken (§0.1).
- **Governance:** AUTHORING §14 freezes the registries during Build and gives `content/bands/` an owner
  (author:CP). A new `content/songs/` needs an owner and the same "registry change request" path.
