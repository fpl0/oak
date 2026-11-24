# Unit Songs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every unit of Oak becomes one song that sounds finished on day one. Each lesson's Make takes over cells of that song, the song grows visibly on Today, in the lesson, in the Coda and on its own page, and it is released to the album when the unit ends.

**Architecture:** A new content type `UnitSongDef` (Oak's song in four styles plus a takeover plan per lesson). A pure claims model in `@oak/content-kit` decides who owns each cell (part × section). A pattern-level composer in `@oak/strudel` builds what is heard from Oak's evaluated tracks and the learner's saved Make codes. Every playback path uses it. Grading is untouched: the grader still sees only the learner's Make code. The server stores songs, takes and frozen release snapshots in new tables. The app draws the song on every daily surface.

**Tech Stack:** Bun 1.4 workspaces, TypeScript 7, zod 4, Strudel 1.2.6/1.3.0 (`@strudel/core`), Hono + `bun:sqlite`, React 19 + TanStack Router/Query + XState 5 + Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-24-unit-songs-design.md` (read it first; its §4 principles and §10a calls are binding). Research maps: `docs/design/songs/*.md`.

## Global Constraints

- Work only in the worktree `/Users/fpl0/Code/Oak-wt/songs` (branch `songs`). Never touch `/Users/fpl0/Code/Oak` (the owner runs Oak from it).
- **No test suites while implementing** (owner, 2026-11-24): never run `bun run test`, `bun run check`, `bun run e2e`, `bun run test:content` or `bun test` without a file path. Allowed: `bun test <one or a few file paths>` (prefix content paths with `./`), `bun run content:check <id>`, and `bunx tsc --noEmit -p <one tsconfig>`. The full suites run once, in the final task.
- Grading is untouched (spec §4.1): no rubric rule, matcher, test, `required` flag or `GradeContext.band` changes, except re-keying a Make per spec §7.3. A re-key gets a new exercise version (contracts §11.7) and keeps the corrections-pass standard (AUTHORING §20.2).
- The name `song`/`SongDef`/`song.*` already means repertoire songs. New ids are `usong.<UNIT>`. Files are `content/unit-songs/<UNIT>.ts`. Never name a file `song.ts`.
- DB: migration `0011_unit_songs.sql`, with new tables and `ADD COLUMN` only. Never rebuild `sketches`, `album_tracks`, `album_track_versions` or `sessions` (the foreign-key cascade deletes data; see `docs/design/songs/server.md`).
- Copy follows AUTHORING §5, §21 and §22: no exclamation marks, no "let's/simply/easy/awesome", sentence case, only taught words. A section or part name is shown only once its term is introduced (spec §4.3).
- Lesson prose changes bump `LessonDef.version`; exercise grading changes bump the exercise `version` (contracts §11.7).
- Track label conventions (STYLE §2): lowercase labels, never `$:`. Oak's song tracks are `band.oak.<label>`. A carried learner source's tracks are `band.take.<lessonId>.<label>`. Both start with `band.`, so `'*'` and roles never match them (contracts §6.2 rule 5).
- Every agent prompt and subagent brief repeats the testing rule above.

## Review Focus

1. **A learner whose U01 sketches predate songs.** Their song 1 must appear with their L01–L04 drums in it after the first start-up, in the profile flavour, with the one-time style card. Test: `server/src/services/unit-songs.test.ts › backfills a started unit from lesson-make sketches`.
2. **A Make opened, abandoned, then reopened.** The opening code is recomputed from the song: no duplicate take, and `make.unchanged` compares with what the editor opened with. Test: `app/src/lesson/song-make.test.ts › reopening a take Make does not record a take and unchanged code fails`.
3. **The style changed mid-song.** Takes stay, Oak's parts switch style, a released track keeps its snapshot's style. Test: `server/src/services/unit-songs.test.ts › setFlavour keeps takes and never touches a release snapshot`.
4. **A beyond-brief track** (a snare added in U01.L01). It silences Oak's snare only in that take's sections, and a later take of the kick does not double the earlier `drums:` kick. Tests: `packages/content-kit/src/unit-songs/claims.test.ts › played parts claim beyond the declared parts` and `packages/strudel/src/song-compose.test.ts › drum hits are filtered to the parts a source still owns`.
5. **Replaying a lesson after the release.** The album track does not change, and the song page offers "Release again". Test: `server/src/services/unit-songs.test.ts › a take after release leaves the snapshot and marks the song changed`.

---

## Wave S1: platform, plus songs U01 and U02

### Task 1: `UnitSongDef` schema and ids

**Files:**
- Create: `packages/content-kit/src/schema/unit-song.ts`
- Modify: `packages/content-kit/src/schema/index.ts`, `packages/content-kit/src/ids.ts` (id grammar `usong.<UNIT>`), `packages/content-kit/src/define.ts` (`defineUnitSong`), `packages/content-kit/src/index.ts`
- Test: `packages/content-kit/src/unit-song.test.ts`

**Interfaces:**
- Produces (exported from `@oak/content-kit`): `UnitSongId`, `SongSectionId`, `SongPartId`, `UnitSongSection { id; type; bars; key? }`, `UnitSongPart { id; label; role: 'drums'|'bass'|'chords'|'melody'|'pad'; sounds?: string[]; name; plainName; termId? }`, `TakeStep`, `SideStep`, `TakeoverStep = TakeStep | SideStep`, `UnitSongDef`, all exactly as spec §5.1. Also `unitSongSchema` (zod) and `defineUnitSong(def: UnitSongDef): UnitSongDef`, which throws a `ZodError` with readable paths.

- [ ] **Step 1: Write the failing tests** `unit-song.test.ts`:
  - `accepts a minimal valid song`: one 4/4 song, two sections (4 + 8 bars), two parts (kick with `sounds:['bd']`; bass), code for all four flavours, one take step and one side step.
  - `rejects a missing flavour`: the error path is `code`.
  - `rejects duplicate section or part ids`.
  - `rejects a take step naming an unknown section or part`, including in `oakKeeps`.
  - `rejects sounds on a pitched part and a drum part without sounds`.
  - `rejects a total over 64 bars`.
  - `ids: usong.U01 and usong.J1 are valid, song.U01 and usong.u01 are not`.
- [ ] **Step 2:** `bun test packages/content-kit/src/unit-song.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the zod schema with `z.record(flavourId, z.string())`; it requires all four flavours, as Bands do. The cross-field checks are a `superRefine`.
- [ ] **Step 4:** Run the same test. Expected: PASS. Also run `bunx tsc --noEmit -p packages/content-kit/tsconfig.json`.

### Task 2: the claims model (pure)

**Files:**
- Create: `packages/content-kit/src/unit-songs/claims.ts`
- Test: `packages/content-kit/src/unit-songs/claims.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - `type CellKey = \`${SongPartId}@${SongSectionId}\``.
  - `interface PlayedParts { parts: ReadonlySet<SongPartId>; playsChords: boolean }`.
  - `partOfDrumSound(def: UnitSongDef, sound: string): SongPartId | null` (the sound name before any `:` index).
  - `partOfTrack(def: UnitSongDef, track: { label: string; role: 'drums'|'bass'|'chords'|'melody'|null }): SongPartId | null`. This one is for pitched tracks: an exact part label first, then the first part with that role.
  - `claimsOf(def: UnitSongDef, step: TakeStep, played: PlayedParts, filled?: readonly SongSectionId[]): CellKey[]`, per spec §5.2. Its sections are `step.sections` (resolving `'all'`), narrowed to `filled` when given. Its parts are the declared parts, the played parts, and, when `playsChords`, every pitched part not in `oakKeeps`.
  - `interface SourceClaim { sourceId: string; cells: readonly CellKey[] }`.
  - `resolveGrid(def: UnitSongDef, takes: readonly SourceClaim[]): ReadonlyMap<CellKey, string | 'oak'>`. Later takes override earlier ones.
  - `ownedBy(grid, sourceId): { parts: Map<SongSectionId, Set<SongPartId>> }`.

- [ ] **Step 1: Write the failing tests:**
  - `declared parts claimed in declared sections`.
  - `'all' covers every section`.
  - `played parts claim beyond the declared parts` (a snare played in a kick take).
  - `playing chords claims every Oak pitched part except oakKeeps`.
  - `filled narrows the sections`.
  - `a later take overrides an earlier one cell by cell`.
  - `cells naming a part or section the song no longer has fall back to Oak` (spec §5.6).
  - `partOfDrumSound maps bd:3 to kick and an unknown sound to null`.
  - `partOfTrack prefers the exact label`.
- [ ] **Step 2:** `bun test packages/content-kit/src/unit-songs/claims.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** No Strudel imports; the module is pure.
- [ ] **Step 4:** Run the test. Expected: PASS.

### Task 3: the content registry and loaders

**Files:**
- Create: `content/unit-songs/index.ts` (the registry), `content/unit-songs/U01.ts`, `content/unit-songs/U02.ts` (placeholders: valid, minimal, marked `// S1 placeholder: Task 11 replaces it`)
- Modify: `content/index.ts`, `scripts/content/generate.ts`, `content/ids.lock.json`, `server/src/content/loader.ts`
- Test: `content/unit-songs/index.test.ts`

**Interfaces:**
- Produces:
  - `unitSongs: readonly UnitSongDef[]`.
  - `unitSongById: ReadonlyMap<UnitSongId, UnitSongDef>`.
  - `unitSongOfUnit(unit: UnitId): UnitSongDef | null`.
  - `songStepOf(lesson: LessonId): { song: UnitSongDef; step: TakeoverStep } | null`.
  - The server's loaded content gains `unitSongs`.
- [ ] **Step 1: Test** `index.test.ts`:
  - `every registered song parses with defineUnitSong`.
  - `songStepOf finds a lesson's step and returns null for a lesson in no song`.
  - `the id ledger lists every usong id`.
- [ ] **Step 2:** `bun test ./content/unit-songs/index.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Register in `generate.ts` the way Bands are; add the explicit server loader entry next to capstones.
- [ ] **Step 4:** Run the test. Expected: PASS. Then run `bun run content:check U01.L05` and expect it to stay PASS.

### Task 4: the composer and every playback path (`@oak/strudel`)

**Files:**
- Create:
  - `packages/strudel/src/song-compose.ts`: pure, importing only `@strudel/core` and content-kit types.
  - `packages/strudel/src/song-compose.test.ts`.
- Modify:
  - `packages/strudel/src/types.ts`: `BandSetup.tracks: string[]`, plus an optional `song?: SongBand`.
  - `packages/strudel/src/evaluation.ts`: evaluate a `SongBand` as several sources.
  - `packages/strudel/src/band.ts`: `bandCodeFor` stays for plain Bands, and is exported.
  - `packages/strudel/src/pattern-player.ts`, `packages/strudel/src/offline/request.ts`: drop the role enum and accept `song`.
  - `app/src/workbench/loop-math.ts`, `app/src/workbench/use-loop.ts`: the loop player uses `PatternPlayer.load({ band })` and stops gluing band text.
  - `app/src/workbench/use-analysis.ts`: the analysis evaluates through the same path.
  - `packages/api/src/dto.ts`: the sketch `bandState.mutes` becomes `z.array(z.string().max(64))`, and `bandState` gains an optional `song: { unitId, takeIds }`.

**Interfaces:**
- Consumes: Task 2 (`resolveGrid`, `partOfDrumSound`, `partOfTrack`).
- Produces:
  - `interface SongBand { def: UnitSongDef; flavour: FlavourId; bpm: number; sources: SongSource[]; live?: { sourceId: 'live'; sections: SongSectionId[] | 'all'; step: TakeStep }; grid: ReadonlyMap<CellKey, string|'oak'> }`.
  - `interface SongSource { sourceId: string; lessonId: LessonId; code: string }`.
  - `composeSongPatterns(input: { def; lengthBars: number; oak: {label:string; pattern:Pattern}[]; sources: { sourceId: string; tracks: {label:string; role: Role|null; pattern: Pattern}[]; sections: {type:string; startBar:number; bars:number}[] | null }[]; grid }): { track: string; pattern: Pattern }[]`.
  - `songLengthBars(def): number` and `songFormView(def, labels): { label: string; bars: number }[]` (not `songFormOf`: the grader already exports that name) (for `formView` and the ribbon).
  - `evaluateSongBand(session, band: SongBand, opts)`: the `SongBand` counterpart of `evaluateBand`.
- Rules to implement (spec §5.2):
  - Oak tracks are masked bar by bar to their cells still owned by `'oak'`.
  - Learner loops are placed per owned section with `arrange()` restart semantics. Before placing, drum tracks are filtered hit by hit (`filterValues` on `s`) to the parts the source still owns there.
  - A source with `sections` (its own `arrange()`, read with `sectionsFromAst`) maps by `type`, using `zoom(start,end).slow(bars)`.
  - Sources' `setcpm` is neutralised: evaluate the source with `setcpm`/`setcps` stubbed during its evaluation.
  - Track names are `band.oak.<label>` and `band.take.<lessonId>.<label>`.

- [ ] **Step 1: Write the failing tests** in `song-compose.test.ts`. They evaluate tiny codes with `@strudel/core` + mini in Bun, as `band-form.test.ts` does.
  - `oak plays every unclaimed cell and nothing in claimed ones`: haps of `band.oak.kick` exist in bars 0–3 and none in bars 4–11 when the kick is claimed in section 2 (bars 4–11).
  - `a one-bar loop restarts at each owned section`: a 3-bar intro, then a 4-bar `<a b c d>` loop owned in the verse; the verse's first bar is `a`.
  - `drum hits are filtered to the parts a source still owns`: the source `s("bd sd")` with the kick taken by a later source keeps only `sd`.
  - `a learner arrange() maps by section type`: learner verse/chorus 2+2 bars into a song with intro 4, verse 4, chorus 4. The song's verse plays the learner verse twice, its chorus the learner chorus twice, and its intro stays Oak's.
  - `a source's setcpm does not change the tempo`.
  - `songFormView lists the sections with bars and the term-free labels it is given`.
- [ ] **Step 2:** `bun test packages/strudel/src/song-compose.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `song-compose.ts`, then wire it into `evaluation.ts`, the players, export, the loop player and the analysis.
- [ ] **Step 4:** Run the test, plus `bun test packages/strudel/src/band.test.ts packages/strudel/src/band-form.test.ts` (no regressions for plain Bands). Then run `bunx tsc --noEmit -p packages/strudel/tsconfig.json` and `bunx tsc --noEmit -p app/tsconfig.json`.

### Task 5: the server (migration, service, API)

**Files:**
- Create:
  - `server/src/db/migrations/0011_unit_songs.sql`;
  - `server/src/services/unit-songs.ts`, `server/src/services/unit-songs.test.ts`;
  - `server/src/routes/songs.ts`.
- Modify:
  - `packages/api/src/contract.ts` and `packages/api/src/dto.ts` (endpoints and DTOs below);
  - `server/src/app.ts` (mount the routes);
  - `server/src/main.ts` (backfill at start-up);
  - `server/src/services/backup.ts` (`markForReview` covers takes; the backfill runs after import);
  - `server/src/services/session-plan.ts` (`SessionPlan.song`);
  - `server/src/db/db.test.ts` (pin version 11 and the new tables).

**Interfaces:**
- Migration:
  - `unit_songs(unit_id TEXT PRIMARY KEY, song_id TEXT NOT NULL, song_version INTEGER NOT NULL, flavour TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', backfilled INTEGER NOT NULL DEFAULT 0, style_seen INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, released_at TEXT)`.
  - `unit_song_takes(id INTEGER PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES unit_songs(unit_id), lesson_id TEXT NOT NULL, sketch_version_id INTEGER NOT NULL, cells_json TEXT NOT NULL, labels_json TEXT NOT NULL, bpm REAL NOT NULL, created_at TEXT NOT NULL)`.
  - `unit_song_releases(id INTEGER PRIMARY KEY, unit_id TEXT NOT NULL, album_track_id INTEGER NOT NULL, song_id TEXT NOT NULL, song_version INTEGER NOT NULL, flavour TEXT NOT NULL, title TEXT NOT NULL, bpm REAL NOT NULL, oak_code TEXT NOT NULL, def_json TEXT NOT NULL, takes_json TEXT NOT NULL, created_at TEXT NOT NULL)`.
  - `ALTER TABLE album_tracks ADD COLUMN unit_id TEXT`.
  - `ALTER TABLE album_track_versions ADD COLUMN song_release_id INTEGER`.
- Endpoints (zod, `contract.ts`):

| Endpoint | Method and path | Body or result |
|---|---|---|
| `songs.list` | GET `/songs` | `UnitSongSummary[]` |
| `songs.get` | GET `/songs/:unitId` | `UnitSongDetail` (with each take's `code` from its sketch version) |
| `songs.start` | POST `/songs/:unitId/start` | `{ flavour }`; idempotency key; upsert on `unit_id`; runs the unit's backfill |
| `songs.setFlavour` | POST `/songs/:unitId/flavour` | `{ flavour }` |
| `songs.rename` | POST `/songs/:unitId/title` | `{ title }`, 1–60 characters |
| `songs.ackStyle` | POST `/songs/:unitId/style-seen` | — |
| `songs.recordTake` | POST `/songs/:unitId/takes` | `{ lessonId, sketchVersionId, cells: string[], labels: Record<string,string\|null>, bpm }`; idempotency key; the lesson must be a take step of this unit's song; returns `UnitSongDetail` |
| `songs.release` | POST `/songs/:unitId/release` | `{ title }`; refused until `releaseAfter` is complete; writes the snapshot and the album rows; returns `{ albumTrackId }` |

- DTOs: `UnitSongDetail = { unitId, songId, songVersion, contentVersion, flavour, title, status: 'open'|'released', changedSinceRelease: boolean, backfilled, styleSeen, takes: { id, lessonId, sketchVersionId, code, cells, labels, bpm, createdAt }[], releases: { id, albumTrackId, flavour, title, createdAt }[] }`. `UnitSongSummary` is the same without takes or code, plus `takesCount`.
- `SessionPlan.song?: { unitId, title, flavour, status, takesCount, lessonIndex, lessonsInSong, today: string | null, side: boolean }`, filled when the planned lesson belongs to a song.
- The service: `startSong`, `getSong`, `listSongs`, `setFlavour`, `rename`, `ackStyle`, `recordTake`, `releaseSong` and `backfillSongs(db, content)`.
  - `backfillSongs` is idempotent. It runs for every unit with a completed take lesson, uses the latest `lesson-make` sketch version of each completed take lesson, and sets `backfilled = 1`.
  - Backfilled cells are the step's `sections` × `parts`, because the server cannot evaluate code. The app refines them the next time it saves a take.

- [ ] **Step 1: Write the failing tests** in `unit-songs.test.ts`, against an in-memory DB with the real migrations:
  - `start is idempotent and stores the flavour`.
  - `recordTake refuses a lesson outside the song and a side step`.
  - `recordTake with the same idempotency key stores one take`.
  - `backfills a started unit from lesson-make sketches`: U01.L01–L04 sketches, then one take each, ordered and `backfilled = 1`.
  - `release is refused before releaseAfter, then writes the snapshot with Oak's code`.
  - `a take after release leaves the snapshot and marks the song changed`.
  - `setFlavour keeps takes and never touches a release snapshot`.
  - `SessionPlan.song names today's line for a planned take lesson`.
  - `db.test`: version 11 and the new table list.
- [ ] **Step 2:** `bun test server/src/services/unit-songs.test.ts server/src/db/db.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration, then the service, routes, contract and plan field.
- [ ] **Step 4:** Run the tests, plus `bun test packages/api/src/contract.test.ts` (every endpoint mounted). Expected: PASS. Then run `bunx tsc --noEmit -p tsconfig.server.json`.

### Task 6: content validation for songs

**Files:**
- Create: `content/validate/unit-songs.test.ts`, `content/validate/unit-songs.ts` (the checks, shared with `content:check`)
- Modify: `scripts/content/check.ts` (new section "15. Unit song" for a lesson in a song), `content/validate/harness.ts` (export what the checks need)

**Interfaces:**
- Consumes: Tasks 1–4; harness `evaluate`, `lint` (profile `band`), `grade`; the clash scan used by `test:content`.
- Produces:
  - `checkSong(def: UnitSongDef): Issue[]`: every item under "For every song" in spec §8.
  - `checkSongStep(def, step, lesson: LessonDef): Issue[]`: every item under "For every plan" in spec §8. The "reference code" is the Make's first passing test response (`tests.find(t => t.expect === 'pass')`).
  - `checkPlanCoverage(def): Issue[]`: each lesson of the unit once, in syllabus order; `releaseAfter` after the last take.

- [ ] **Step 1: Write the failing tests** in `unit-songs.test.ts`:
  - `every registered song passes checkSong and checkPlanCoverage`.
  - `every take step passes checkSongStep`.
  - Plus fixture failures, each expecting its issue code:
    - a silent flavour → `usong.silent`;
    - a flavour with a different lead pitch → `usong.flavour-notes`;
    - a held lead note a half step off a chord tone → `usong.clash`;
    - a take in another key → `usong.key`;
    - a `startFrom` code that already passes today's required rule → `usong.start-passes`;
    - `parts` missing a played part → `usong.parts`;
    - a `today` line with an untaught term → `usong.terms`.
- [ ] **Step 2:** `bun test ./content/validate/unit-songs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, then add section 15 to `content:check`.
- [ ] **Step 4:** Run the test (placeholders from Task 3 must pass), then `bun run content:check U01.L05`. Expected: PASS, with a "15. Unit song" line.

### Task 7: the Make inside the song (app, lesson)

**Files:**
- Create:
  - `app/src/song/model.ts` (pure view model) and `app/src/song/model.test.ts`;
  - `app/src/song/hooks.ts`;
  - `app/src/lesson/song-make.ts` and `app/src/lesson/song-make.test.ts`.
- Modify:
  - `app/src/lesson/band.ts`: `bandSetupOf` returns the song band for a take step;
  - `app/src/lesson/make-start.ts`: `startFrom`;
  - `app/src/lesson/renderers.tsx` (`MakeRenderer`): the song strip, the "In your song | Today's code" switch, section loop, opening-code note;
  - `app/src/lesson/grading.ts`: `make.unchanged` against the opening code;
  - `app/src/lesson/server.ts` (finish): `songs.recordTake` after `sketches.create`;
  - `app/src/lesson/track-ui.tsx`: chips "Oak", "yours (from …)", today's code.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  - `songViewOf(def, detail: UnitSongDetail | null, introducedTerms: ReadonlySet<TermId>, opts?: { live?: TakeStep }): SongView`, where `SongView = { title; flavour; sections: { id; label; bars }[]; parts: { id; name }[]; cells: { part; section; owner: 'oak'|'yours'|'today'; lessonId?: LessonId }[]; takesCount; lessonsInSong }`. Section labels are letters A, B, C… by order of first appearance of each `type` until that type's term is introduced; part names use `plainName` until `termId` is introduced.
  - `useUnitSong(unitId)`, `useSongOfLesson(lessonId)`.
  - `songMakeOf(lessonId) → { def; step: TakeStep } | null`.
  - `openingCode(step, detail, authoredStarter, songBpm): { code; source: 'oak' | LessonId }`.
  - `withSongTempo(code, bpm, allowed?: [number, number]): string`, which rewrites only the first `setcpm(<n>/<beats>)`.
  - `playedPartsOf(def, tracks: { label; role; sounds: string[]; chords: boolean }[]): PlayedParts`.
- Behaviour:
  - The first visit to a take lesson whose song is not started shows the New song moment (Task 8) before the lesson.
  - A side step shows its reason on the lesson card and plays today's Band.
  - On finish, the app evaluates the saved code once, computes `claimsOf`, and posts `songs.recordTake` with the idempotency key `take:<lessonId>:<sketchVersionId>`.

- [ ] **Step 1: Write the failing tests:**
  - `model.test.ts › letters until the verse term is introduced, names after`.
  - `model.test.ts › cells mark today's sections while a Make is open`.
  - `song-make.test.ts › openingCode starts from the named earlier take, else the starter`.
  - `song-make.test.ts › withSongTempo rewrites only the tempo line and respects the allowed range`.
  - `song-make.test.ts › reopening a take Make does not record a take and unchanged code fails`.
  - `song-make.test.ts › playedPartsOf maps drum sounds and a chords track`.
- [ ] **Step 2:** `bun test app/src/song/model.test.ts app/src/lesson/song-make.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep `fromSketch` working for non-song Makes.
- [ ] **Step 4:** Run the tests, plus `bun test app/src/lesson/band.test.ts app/src/lesson/grading.test.ts`. Then run `bunx tsc --noEmit -p app/tsconfig.json`.

### Task 8: song surfaces (app UI)

Load the `frontend-design:frontend-design` skill first. Keep the existing tokens (`app/src/styles`, the Paper/Bark themes, Fraunces/Inter/JetBrains Mono, earth-tone part colours, the flavour wood colours; see `docs/design/songs/app-surfaces.md` §4). Add imagery and motion with the existing durations (120/200/360 ms), and respect `prefers-reduced-motion`.

**Files:**
- Create in `app/src/song/`:
  - `SongGrid.tsx`: sections as columns sized by bars, parts as rows; yours filled, Oak's outlined, today's highlighted; the playhead.
  - `SongCover.tsx`: reuses the `SketchCover` rings, one per take.
  - `SongPlayButton.tsx`: plays the composed song through `PatternPlayer`; one source plays at a time.
  - `SongCard.tsx`: the lesson card.
  - `SongHero.tsx`: Today.
  - `SongGrew.tsx`: the Coda, with before/after and the new ring and cells animating.
  - `NewSong.tsx`: the style picker; four cards each with ▶; the working title; "Start this song"; the backfill variant.
  - `SongPage.tsx`: the grid, section loop, mute/solo per part, take history with ▶ per version, rename, style change, Release / Release again.
  - `AlbumSongs.tsx`: the album shelf.
- Create: `app/src/routes/song/$unitId.tsx`.
- Modify:
  - `app/src/session/today/TodayPage.tsx` (the hero above the setlist);
  - `app/src/session/coda/CodaPage.tsx` (replace `SketchCard` for take lessons; Release card);
  - `app/src/lesson/LessonPlayer.tsx` (`SongCard` above step 1, the New song gate);
  - `app/src/routes/album/index.tsx` (the shelf);
  - the session-surface list (`isSessionSurface`) so `/song/*` counts as session time;
  - the nav where Album is listed.
- Test: `app/src/song/surfaces.test.tsx` (render tests in the style of the existing `*.test.tsx`; no browser)

**Interfaces:**
- Consumes: Task 7 `songViewOf`, the hooks; Task 5 endpoints.
- Produces: `<SongGrid view={SongView} playheadBar?={number} compact?={boolean} />`, `<SongHero plan={SessionPlan} />`, `<SongCard lessonId />`, `<SongGrew lessonId />`, `<NewSong unitId onStarted />`.

- [ ] **Step 1: Write the failing tests:**
  - `SongGrid draws one column per section with widths by bars and marks yours, Oak's and today's cells`.
  - `SongHero shows today's line and the lesson count`.
  - `NewSong lists four styles and posts songs.start with the picked flavour`.
  - `SongPage offers Release only when releasable and Release again when changed`.
  - `no section name before its term`.
- [ ] **Step 2:** `bun test app/src/song/surfaces.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run the test. Then run `bunx tsc --noEmit -p app/tsconfig.json` and `bunx biome check app/src/song`.

### Task 9: the tutor knows the song

**Files:**
- Modify: the lesson-context builder used by `get_lesson_context` and the context chips (`server/src/tutor/` lesson context; `app/src/tutor/` chips)
- Test: extend the nearest existing context test (`server/src/tutor/*context*.test.ts`) with `lesson context names the song, the learner's cells and today's line`

- [ ] **Step 1:** Write the test. **Step 2:** Run it. Expected: FAIL. **Step 3:** Add `song: { title, flavour, yours: string[], today }` to the context. **Step 4:** Run it. Expected: PASS. No live tutor calls.

### Task 10: the contracts and authoring rules

**Files:**
- Modify:
  - `docs/design/contracts.md`: a new §5.11 "Unit songs", condensing spec §4, §5.1–§5.4 and §10a; a §6.2 rule 5 note about `band.oak.*`/`band.take.*`; a change-log row 1.9 dated 2026-11-24.
  - `content/AUTHORING.md`: a new §23 "Unit songs": how to write a song, plans by part in U01–U04 and by section from U05, `today` lines, side steps, the re-key rule, the checks.
  - `docs/decisions.md`: one row per §10a call.
- Test: `bun test ./content/validate/contracts-sync.test.ts` (the existing sync test must stay green)

### Task 11: songs U01 and U02 (content)

Follow AUTHORING §23 (Task 10) and the proposals in `docs/design/songs/makes-core-a.md` §8 (U01 "the groove song", U02 "the riff song").

**Files:**
- Replace: `content/unit-songs/U01.ts`, `content/unit-songs/U02.ts`
- Modify: the Make step (`lesson.mdx` Make block, the Make `prompt` in `lesson.ts`, `version` bump) of every take lesson in U01 and U02
- Test: `bun run content:check <id>` for each of U01.L01–L09, U02.L01–L08

- [ ] **Step 1:** Write U01's song:
  - Four flavours, straight, at about 100 BPM; Oak's harmony is I–IV in the verse and I V vi IV in the chorus.
  - The form is intro 4 · verse 8 · stop 1 · chorus 8 · bridge 4 · chorus 8 · outro 4 (adjust to ≤ 64 bars and multiples of 4, apart from the stop bar).
  - The parts are kick, snare, hats, perc (crash, toms), bass, chords and lead.
  - The plan follows the inventory's takeover sequence; L08 is `side` (3/4).
  - `releaseAfter: 'U01.CP'`.
- [ ] **Step 2:** Write U02's song: I–IV throughout, a lead riff Oak plays until the learner takes it, the inventory sequence, and `releaseAfter: 'U02.CP'`.
- [ ] **Step 3:** Rewrite each take Make's prompt and prose so the task is about the song and says exactly what to do and where (AUTHORING §22). Bump the lesson versions.
- [ ] **Step 4:** Run `bun run content:check` for every U01 and U02 lesson, then `bun test ./content/validate/unit-songs.test.ts ./content/unit-songs/index.test.ts`. Expected: every section PASS.

### Task 12: wave S1 integration and commit

- [ ] Run the targeted tests of Tasks 1–11 together, `bunx tsc --noEmit` per touched project, and `bunx biome check` on the touched folders.
- [ ] Do a manual smoke in a dev server on a shifted port (never 8787/5173/8790), with a dev seed at U01.L05. Expected: Today shows song 1 with the seeded drums; the lesson card plays; the Make plays inside the song; the Coda shows the song grew.
- [ ] Commit on `songs`: `git add <explicit paths>`, then `git commit -m "Unit songs, wave S1: the platform and the U01–U02 songs"`.

---

## Waves S2–S4: one song per remaining unit

**Task template "Unit song <UNIT>"** (one task per unit; units in one wave run in parallel, because each touches only its own song file and its own lessons):

- **Files:**
  - Create `content/unit-songs/<UNIT>.ts`.
  - Modify the Make block and the Make `prompt` of each take lesson, and bump the lesson `version`.
  - Re-key only per spec §7.3: new exercise version, all tests updated.
  - Mark `side` steps with a one-line reason.
- **Source of proposals:** `docs/design/songs/makes-core-{a,b,c}.md` §8 for the unit's form, harmony, takeover order and release anchor. U05 onward plans by section.
- **Done when:**
  - `bun run content:check <id>` is PASS for every lesson of the unit;
  - `bun test ./content/validate/unit-songs.test.ts` is green for this song;
  - a music review agent re-derives the song's harmony and clash claims with `bun run theory …` and finds nothing.

| Wave | Units | Notes from the inventory |
|---|---|---|
| S2 | U03, U04, U05, U06, U07, U08, U09 | U03 uses section keys for L05–L07. U04 is the second voice. U05–U06 are planned by section; chord takes silence Oak's pitched parts. U07 ends at C2, and the X1 transcription stays aside. U08 is the bass song. U09 is form: learner `arrange()` maps by type. U07.L09 (3/4) is side. |
| S3 | U10, U11, U12, U13, U14, U15, U16, U17 | U10 is A minor (L01 in C minor: section key or side; L09 side). U11 is the blues growing to 12 bars (L01 weak: side). U12 has an A-minor bridge section. U13 stays straight, its drums are the learner's, and L04 (6/8) is side. U14 is modal sections on G. U17 is modulation with section keys. |
| S4 | J1, J2, J3, J4, J5, R1, R2, R3, A1, A2 | R2 is mostly side (odd meters). A1 and A2 are natural pilots. J4 is the jazz blues, J5 a reharmonised standard. Static-reference rules (`reharmonize`, `matches`, custom chord lists) stay graded on the learner's code only. |

Each wave ends like Task 12: targeted checks, a music review, then one commit (`Unit songs, wave S<n>: songs <units>`).

---

## Final

### Task F1: adversarial review

- An independent review of the whole branch diff, in two parts:
  - correctness of the composer and claims, migration safety, idempotency;
  - the learner experience against the spec (§2, §5.5).
- Use a fresh agent, plus a read-only Codex (model `gpt-6-astra`, `-s read-only`) review. Fix confirmed findings.

### Task F2: the full suites, once

- [ ] `bun run check` (typecheck, Biome, `bun test`), then `bun run e2e`, on free ports. If something fails, fix it and re-run only the failing files, then the suite once more.
- [ ] `bun run build` in the worktree.

### Task F3: ship

- [ ] Merge `songs` into `main` (fast-forward when possible), then `git push`.
- [ ] Build the desktop app from a clean detached worktree of the release commit:
  - `bun install --frozen-lockfile`, and copy `sounds/pack` and `pack.lock.json`;
  - bump the minor version in `desktop/package.json`;
  - run `OAK_SRC=<wt> npm run dist` in `desktop/`;
  - run `shasum -a 256 Oak-macos-arm64.dmg Oak-macos-arm64.zip > SHA256SUMS`;
  - tag, then `gh release create --repo fpl0/oak` with the DMG, the zip and `SHA256SUMS`.
- [ ] Install at `/Applications/Oak.app` (quit Oak first), and check that it launches and serves on 8797.
- [ ] In `~/Code/heyfilipelima/src/content/posts/oak.mdx`:
  - point the download and source links at `fpl0/oak`;
  - check that `releases/latest/download/Oak-macos-arm64.dmg` resolves to the new release;
  - add one line on songs if it fits the post;
  - commit and push.
