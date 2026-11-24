# Oak server and API contracts: what exists, for the "each unit is one song" redesign

Scope: `server/src` (Hono + bun:sqlite) and `packages/api` (zod contract, DTOs, typed client). All paths are repo-relative to `/Users/fpl0/Code/Oak`. Line numbers are from `main` at `dec85d2`.

---

## 0. Most important findings (read first)

1. **The server does not know about Bands, flavour kits or parts.** `ContentSource` (`server/src/content/types.ts:25-55`) loads syllabus, toolbox, skills, families, decks, terms, can-dos, milestones, repertoire songs, lessons, checkpoints and capstones. It does **not** load `content/bands/` or `content/flavours.ts`. Band code is evaluated only in the browser. The only Band data the server stores is an opaque `{ bandId, flavour, mutes: ("drums"|"bass"|"chords")[] }` on sketch and album versions (`packages/api/src/dto.ts:1584`). If Today has to show sections, which parts the learner owns and what today adds, either the server loads a new "unit song" content registry (a `loader.ts` change) or the app works it out from content and the server only stores ownership.
2. **The learner's flavour is a profile column, not a setting.** It is `learner_profile.flavour TEXT NOT NULL`, default `'flavour.pop'` (`0001_init.sql:19`, `db/repos/profile.ts:114`), validated as `z.enum(FLAVOUR_IDS)` (`dto.ts:40,87`). The server never reads it for logic. The app reads `bootstrap.profile.flavour` and passes it to the Make's Band (`app/src/lesson/LessonPlayer.tsx:256`). A capstone keeps its own flavour in `capstone_state.flavour`, taken from the client body on `capstones.completeSession` and `capstones.release`. Album tracks keep `album_tracks.flavour`.
3. **Each lesson's Make becomes a new sketch today, and `lessons.complete` requires one.** The app calls `steps.attempt` (the Make's rubric, idempotent), then `sketches.create` (`originKind: "lesson-make"`, `originId: lessonId`, **not** idempotent), then `lessons.complete { sketchId }`. `course.complete` returns 404 if that sketch does not exist (`services/course.ts:521-526`; `dto.ts:1115-1123`: "A lesson cannot complete without one"). Keeping that contract, with the song's code stored as a sketch, leaves completion, streak, the Coda's `sketchesSaved`, `lessons.sketch` (d15 `fromSketch`) and the test driver (`server/src/testing/learner.ts:230`) working unchanged.
4. **Album releases are tied to capstones and to sketch versions.** `album_track_versions.sketch_id/sketch_version` are `NOT NULL`. `album.source` (export), `album.attachReview`, `reviewRecords` and `capstones.release` all go through `album_tracks.capstone_id` (`trackOfCapstone`). `library.createTrack` refuses a track with no capstone unless `side = 'Bside'` (`services/library.ts:344-348`). There are 12 core capstones and 18 core units (U00 to U17), plus 8 track capstones and 10 track units, so unit songs are **not** one-to-one with capstones. Side counts come from `ALBUM_SIDES` (`dto.ts:3280`).
5. **Widening a CHECK on `sketches`, `album_tracks` or `sessions` silently deletes data if it is done the way earlier migrations rebuilt tables.** `migrate()` runs each file inside `db.transaction().immediate()` with `foreign_keys = ON`, and `PRAGMA foreign_keys = OFF` inside a transaction does nothing. I tested this on SQLite 3.54.0 in a scratch script: rebuilding a parent table (create new, copy, `DROP`, rename) cascades the `DROP` into the children and empties them. That would empty `sketch_versions`, `album_track_versions` and `album_takes`, and set `session_id` to NULL in `step_attempts` and `drill_sessions`. Earlier rebuilds (`ladder_state`, `capstone_checks` in 0006/0007) only touched tables with no children. So:
   - Adding `'song'` to `sketches.origin_kind` (`0001_init.sql:328`), a side to `album_tracks.side` (`:358`) or a kind to `sessions.kind` (`:52`) needs either a change to `migrate.ts` (run that migration with foreign keys off, outside the transaction) or a design that avoids changing the CHECK.
   - `ALTER TABLE … ADD COLUMN` and new tables are safe.
6. **Backups already include every table.** `dumpTables` walks `sqlite_master` (`services/backup.ts:78-83`), and import replaces everything and migrates older backups forward through a scratch database (`:220-233`). New tables are therefore exported, imported and reset with no backup code. What does need code:
   - `markForReview` (`:400-409`): flag song code that arrives in an import.
   - The audio path whitelist `ARCHIVE_AUDIO_PATH` and `#files()`, if songs get recordings outside `album_takes`.
   - The import route (`routes/ops.ts:131-137`, which only re-runs `unlocks.backfill()`), if songs are backfilled in TypeScript.
   - The pinned list of table names and `schemaVersion == 10` in `db/db.test.ts:14-81`.
7. **Only four endpoints are idempotent.** They are `steps.attempt`, `srs.review`, `capstones.recordCheck` and `ladder.submit`. The generic helper is `idempotent(d, endpoint, key, scope, write)` (`server/src/idempotency.ts:37-74`), backed by `idempotency_keys(endpoint, key, body_hash, response_json, at)`; keys are kept at least 24 h and pruned after 48 h.
   - Every song write should take `idempotencyKey: IdempotencyKeySchema.optional()`: start or arrange, save a part, take over a part, release.
   - "Start the unit's song" also needs a database-level uniqueness guard (`unit_id` primary key with `ON CONFLICT`). The in-flight map only serialises requests that share a key; two tabs use different keys.
   - The helper stores the whole response JSON, so song endpoints should return a compact state, not every version's code.
8. **There is no code generation.** `packages/api/src/contract.ts` is one `as const` table. The server mounts each entry by name through `createMounter` (`routes/define.ts:102-183`), which validates params, query and body and, in dev and tests, the response. The client (`packages/api/src/client.ts`) types `call(name, input)` from the same table and validates every response. The app wraps it in `callApi` plus TanStack Query keys `["api", name, input]` (`app/src/lib/api.ts`, `app/src/lib/queries.ts`).
   - A new endpoint means a DTO schema in `dto.ts`, a contract entry, a `mount(...)` in a routes file and a hook in `queries.ts`.
   - `routes.test.ts:576-590` fails if any contract endpoint is not mounted.
9. **Today's plan has no Make or Coda block.** `SessionPlan` (`dto.ts:1374-1466`) is `kind`, `mapItemId`, `title`, `note`, `warmup` (a DueBatch), `main {resumeStep, splitPart, light, estMinutes}` and wave-7 extras. The app builds warm-up, then New, then Make, then Coda from the plan plus the lesson's steps. The server only sees the phases through `session.heartbeat` (`phase` in `idle|warmup|main|make|coda|done`) and in `session.end` telemetry (`phaseMs.make`). A Today song card would be an optional `song` field on `SessionPlan`, following the waves' "additive optional fields" rule, or a new GET endpoint.
10. **"Song" already has a meaning in the codebase.** It means a repertoire tune for transcription: `SongDef`, ids `song.*`, `ContentSource.songs`, `transcriptions.song_id`, `CAPSTONE_SONGS`, `ladder.songs`, and the loader's `**/song.ts` glob (`server/src/content/loader.ts:136`). Use a distinct name in schema and code (`unit_songs`, `UnitSong`, ids keyed by unit id such as `U03`) so the two never collide.

---

## 1. Server architecture in brief

- **Layers.** `routes/*.ts` mount contract endpoints and call services. `services/*.ts` hold the rules. `db/repos/*.ts` hold the SQL; the header of `db/repos/index.ts` says nothing else writes SQL.
  - `createServer` (`server/src/app.ts:130-205`) opens the database, which migrates it, then builds the `ContentIndex`, `createServices` (`services/index.ts:69-205`), the SRS wiring (`srs-wiring.ts:1198-1243`) and the tutor wiring.
  - `startupTasks` (`app.ts:107-120`) runs the daily backup, `unlocks.backfill()` and `tracks.backfill()`.
- **One writer.**
  - `openDb` (`db/index.ts:15-28`) sets WAL, `foreign_keys = ON` and `busy_timeout`.
  - `tx(db, fn)` is `BEGIN IMMEDIATE` and nested calls join the outer transaction (`db/index.ts:44-47`).
  - Every service write is one transaction.
- **Conventions** (`0001_init.sql:1-4`):
  - Tables are STRICT.
  - Timestamps are ISO UTC `TEXT`; `day` is the learner-local `YYYY-MM-DD` after the 04:00 rollover.
  - `*_json` columns hold JSON text and booleans are 0/1.
  - A single-row table uses `id INTEGER PRIMARY KEY CHECK (id = 1)`.
  - IDs come from `newId(prefix)`, which gives `prefix_<20 hex>` (`services/context.ts:69-71`): `sk_`, `trk_`, `ses_` and so on.
- **Errors.** `ApiError` codes are `bad_request|forbidden|not_found|conflict|confirm_required|payload_too_large|unavailable|internal|not_implemented` (`dto.ts:52-71`, `server/src/errors.ts`).
- **Destructive endpoints** need a nonce: `POST /api/confirm`, then the `X-Oak-Confirm` header. The nonce is single-use, lives 60 s and is bound to `(action, target)` (`server/src/confirm.ts`). The actions are listed in `CONFIRM_ACTIONS` (`dto.ts:2089-2099`). Deleting or restarting a song would need a new action there.

---

## 2. Database schema and migrations

### 2.1 How migrations work

`server/src/db/migrate.ts`:

- Files are `server/src/db/migrations/NNNN_name.sql`, matched by `/^(\d{4})_([a-z0-9_-]+)\.sql$/`, sorted, and they must be **contiguous from 1**; otherwise loading throws (`:16-28`).
- Each file runs in **its own transaction** (`db.transaction(...).immediate()`), followed by `PRAGMA user_version = N` (`:39-55`).
- Start-up refuses a database newer than the code (`:42-43`).
- `latestVersion()` is the number of migration files.
- `triggerDdl(db)` lists the triggers so that import and reset can drop and recreate them (`:58-62`).

Existing files (**the latest is 0010; the next is `0011_<name>.sql`**):

| File | What it does |
|---|---|
| `0001_init.sql` | Every base table, about 41 of them (see §2.2), and the triggers `rests_bank_max`, `unlocks_no_delete`, `tutor_messages_no_update/_no_delete`, `tutor_backend_records_no_update/_no_delete` |
| `0002_wave2.sql` | `onboarding_state` (one row, carries `sketch_id` of Sketch 001), `listen_marks`; rekeys `exercise_results` |
| `0003_wave3.sql` | `idempotency_keys`, `voice_state`, `sung_notes` |
| `0004_wave4.sql` | `capstone_sessions`, `capstone_checks`; `album_track_versions` + `include_review_note`, `review_conversation_id`; transcription columns; `ladder_state`, `ladder_sessions` |
| `0005_checked_version.sql` | `capstone_state` + `checked_sketch_id`, `checked_sketch_version` |
| `0006_wave5.sql` | rebuilds `ladder_state` (no children); `transcription_versions` + `review_before_run`, `phrase`; `step_attempts` + `imported`; `transcription_review_versions` |
| `0007_wave6.sql` | rebuilds `ladder_state`; `sessions` + `tab_id`; `track_gates`, `core_state`, `album_takes` (+ backfill); `album_track_versions` + `current_take`; rebuilds `capstone_checks` (no children); a **data backfill** inserting `U05.L09` completed (a precedent for a backfill written in SQL) |
| `0008_wave7.sql` | `track_focus`, `course_state`, `capstone_versions` |
| `0009_gym_source.sql` | `gym_sessions` + `source` |
| `0010_practice.sql` | `step_attempts` + `practice` |

What else has to change when a migration is added:

- `server/src/db/db.test.ts:14-81` pins `schemaVersion(db) === 10`, `latestVersion() === 10` and the exact table list.
- `services/dev-seed-cache.ts:65-76` includes `schemaVersion` in the snapshot key, so it invalidates itself.
- The desktop app ships the server as source (`desktop/scripts/stage.sh:22` rsyncs `server/` and `packages/`). The learner's real `~/.oak/oak.db`, from v1.2.x, migrates on the next launch. **Any migration must carry over a learner who is in the middle of a unit.**

### 2.2 Tables (the ones that matter here, with exact columns)

From `0001_init.sql` unless noted otherwise.

- `settings(key PK, value_json, updated_at)`: a key-value store validated by `SettingsSchema` (§10).
- `learner_profile(id=1, …, flavour TEXT NOT NULL, daily_minutes IN (15,20,25), weekly_goal, timezone, rollover_hour, … onboarded_at, created_at)` (`:12-40`).
- `sessions(id PK, day, kind CHECK IN ('lesson','checkpoint','capstone','gym','keepalive','light','studio','review'), target_minutes, content_version, map_item_id, phase CHECK IN ('idle','warmup','main','make','coda','done'), started_at, ended_at, active_minutes, plan_json, summary_json)` plus `tab_id` (0007).
  - **Parent of** `step_attempts.session_id` and `drill_sessions.session_id`, both `ON DELETE SET NULL`.
- `lesson_progress(lesson_id PK, status CHECK IN ('locked','available','in_progress','completed'), current_step, split_part, started_at, completed_at, best_score, completed_version, content_hash, updated_at)` (`:65-76`).
- `step_state(lesson_id, step_id, series_no, rung, tutor_hints, attempts, passed, updated_at; PK(lesson_id, step_id))`.
- `step_attempts(… lesson_id, step_id, exercise_id, exercise_version, code, response_json, result_json, passed, score, adjusted, …, tutor_assisted, at)` plus `imported` (0006) and `practice` (0010). The Make's rubric attempt lands here with `code` set to the Make's code. The voicing gate reads `code` (`services/unlocks.ts:41-80`).
- `capstone_state(capstone_id PK, status CHECK IN ('open','in_progress','released'), sessions_json, sketch_id, track_id, flavour, last_result_json, started_at, released_at, updated_at)` plus `checked_sketch_id`, `checked_sketch_version` (0005) (`:155-166`).
- `capstone_sessions(capstone_session_id PK, capstone_id, session_id, draft_sketch_id, draft_sketch_version, draft_saved_at, started_at, completed_at, updated_at)` (0004).
- `capstone_checks(capstone_id, check_id, stage, capstone_session_id, best_score, passed, revealed, attempts, sketch_id, sketch_version, last_result_json, last_at; PK(capstone_id, check_id, stage))` (0004, rebuilt in 0007).
- `capstone_versions(capstone_id, version_id IN ('a','b'), sketch_id, sketch_version, saved_at; PK(capstone_id, version_id))` (0008).
- `unlocks(item_id PK, kind CHECK, source_kind, source_id, unlocked_at, seen)`; **its trigger forbids DELETE** (`:298-308`).
- `cando_ledger(cando_id, status CHECK IN ('emerging','solid','strong','fading'), evidence_kind, evidence_id, at; PK(cando_id, at))`: a status history (`:310-317`).
- `terms_introduced(term_id PK, lesson_id, at)`.
- `sketches(id PK, title, origin_kind CHECK IN ('lesson-make','free','capstone','transcription','tutor','keepalive','checkpoint'), origin_id, current_version, tags_json, archived, listening_comment, created_at, updated_at)` (`:325-336`).
- `sketch_versions(sketch_id FK→sketches ON DELETE CASCADE, version, code, bpm, meter, key, analysis_json, note, tutor_assisted, band_json, flags_json, created_at; PK(sketch_id, version))` (`:338-352`).
- `album_tracks(id PK, capstone_id NULL, sketch_id NULL, side CHECK IN ('A','B','Bside'), track_no, title, flavour, current_version, cover_seed, created_at)` (`:354-365`).
- `album_track_versions(track_id FK→album_tracks ON DELETE CASCADE, version, sketch_id NOT NULL, sketch_version NOT NULL, audio_path, audio_mime, duration_s, liner_notes_md, theory_tags_json, review_json, tutor_assisted, attribution, band_json, flags_json, created_at; PK(track_id, version))`, plus `include_review_note`, `review_conversation_id` (0004) and `current_take` (0007) (`:367-384`).
- `album_takes(track_id FK→album_tracks ON DELETE CASCADE, version, take ≥1, audio_path, audio_mime, duration_s, bytes, recorded_at; PK(track_id, version, take))` (0007).
- `streak_days(day PK, qualified, source CHECK, kinds_json, minutes, review_sets, sketch_saved)`.
- `idempotency_keys(endpoint, key, body_hash, response_json, at; PK(endpoint, key))` (0003).
- `track_gates`, `core_state`, `course_state`, `track_focus` (0007 and 0008): record-once and announce-once single rows. They are a pattern to copy for a song's "released, shown in the Coda once" moment.

---

## 3. Repositories (`server/src/db/repos/`)

`createRepos(db, defaults)` in `index.ts:58-94` bundles them all into `Repos`:

| Repo | File | Notes |
|---|---|---|
| `ProfileRepo`, `SettingsRepo` | `profile.ts` | `profile.get()` creates the row with `flavour.pop` (`:109-121`); `patch` maps DTO fields to columns (`PROFILE_COLUMNS`, `:43-69`); `settings.all()` lays stored values over `DEFAULT_SETTINGS` and drops invalid ones (`:178-192`) |
| `LessonsRepo` | `lessons.ts` | `progress`, `allProgress`, `saveProgress` (upsert), `stepState`, `insertAttempt`, `attemptsOfLesson`, `exerciseResult`… |
| `SketchesRepo` | `library.ts:73-187` | `list({origin, archived})`, `get`, `versions`, `version`, `insert`, `insertVersion` (also bumps `current_version` and `updated_at`), `patch`, `delete`, `savedSince(at)`, `latest()` |
| `AlbumRepo` | `library.ts:255-411` | `tracks()` sorts A, then B, then Bside, then `track_no`; `trackOfCapstone`, `nextTrackNo(side)`, `insertTrack`, `insertVersion` (bumps `current_version`), `patchVersion`, `setAudio`, `setReview`, `reviewConversation`, `deleteTrack` |
| `CapstonesRepo`, `UnlocksRepo`, `CanDoRepo`, `TermsRepo`, `CheckpointsRepo` | `progress.ts` | `capstones.save` is an upsert; `checked` is written only when present (`:383-412`). `unlocks.grant` is `INSERT OR IGNORE`. `cando.append` nudges `at` by 1 ms on a key clash |
| `CapstoneSessionsRepo`, `LadderRepo` | `wave4.ts` | capstone sessions and checks |
| `TrackGatesRepo`, `CoreStateRepo`, `TakesRepo` | `wave6.ts` | record-once rows; takes |
| `TrackFocusRepo`, `CourseStateRepo`, `CapstoneVersionsRepo` | `wave7.ts` | |
| `IdempotencyRepo`, `VoiceRepo`, `SungNotesRepo` | `voice.ts` | `idempotency.get/put/prune` (`:12-41`) |
| `SessionsRepo`, `GymRepo` | `sessions.ts` | `create(s, plan)` stores `plan_json`; `end(id, endedAt, minutes, summary)` stores `summary_json` |

A new song repo would be a class in a new file (for example `db/repos/songs.ts`) added to `Repos` and to `createRepos`.

---

## 4. Course state and lesson progress

**Endpoints** (`routes/course.ts`):

- `lessons.progress` (`GET /lessons/progress`) returns `CourseProgress` (`dto.ts:970`): lessons, checkpoints, capstones, gym, `next`, `mapDone/mapTotal`, tracks, core, course. It is built by `gates.courseProgress()` plus `tracks`.
- `lessons.steps`, `steps.state`, `steps.attempt` (idempotent), `steps.hint`, `steps.newSeries`.
- `lessons.position` (`PUT`): the resume point; "Wrap up" before the Make (`dto.ts:2223`).
- `lessons.complete` (`POST /lessons/:id/complete`, body `LessonCompleteRequestSchema`, `dto.ts:1115-1123`): `{ sessionId, sketchId, lessonVersion, contentHash, splitPart }`.
- `lessons.sketch` (`GET /lessons/:id/sketch`, d15): the newest unarchived `lesson-make` sketch of that lesson, with its versions (`services/library.ts:114-126`). Content uses it through `CodeMakeEx.fromSketch?: LessonId` (`packages/content-kit/src/schema/exercise.ts:696-711`; used in `U06/L10`, `U10/L06`, `U11/L07`, `U15/L06`). **This is the only existing way one lesson's Make carries into a later lesson.** The unit song generalises it.

**`CourseService.complete`** (`services/course.ts:508-600`) runs in one transaction:

1. Checks that the sketch exists (`:521-526`) and the voicing-gate block (`:527-529`).
2. `splitPart: "A"` only stores `splitPart` and `currentStep = wrapAt`.
3. Otherwise it marks the lesson completed (completed stays completed), then calls `unlocks.onComplete(lessonId)`, `voice.onLessonComplete`, the terms, `mastery.recompute`, `cando.evaluate({sourceId: lessonId, evidence: {kind: "lesson"}})`, opened items and `tracks.recordGates`.
4. After the transaction it calls `srs.seedLesson`.

The result is `LessonCompleteResult` (`dto.ts:1124`).

**`CourseService.attempt`** (`:303-474`): the Make's rubric (`code-make`) gives rubric evidence at weight 1.5 for each rule (`#rubricEvidence`, `:476-497`) unless the attempt is tutor-assisted or practice. `code` is stored. **If the Make's response code became the whole song (Oak's parts included), evidence and the voicing gate would read Oak's code.** The gate rejects code that reaches the gated helpers (`unlocks.ts:66-69`), and Band-style parts may use locked tools. The Make attempt should keep posting only the learner's own part, or the grader context should separate them; contracts §5.10 rule 5 says "Evidence is taken from the learner's tracks only".

**Gates** (`services/gates.ts`):

- `lessonOpen` (`:83-108`): core lessons are linear across units, and L03 and later need the checkpoint before the unit.
- `lessonStatus`, `checkpointOpen` (every covered lesson completed), `capstoneStatus` (`:172-189`).
- `sessionDone` and `sessionOpen` parse capstone session ids with `/^(.+)\.S(\d+)$/` (`:198-227`).
- `nextMapItem` follows the content's `defaultOrder()`.

**Units on the server.** `ContentIndex` keeps `LessonSite { meta, unit: UnitDef, ordinal, index }` (`server/src/content/index.ts:44-51`). Lesson-to-unit is therefore available, as are `coreUnits` and `checkpointBefore(unitId)`. Units in `content/syllabus.ts`:

- Core: U00 Onboarding, U01 to U17. Units U08, U12, U15 and U16 have no checkpoint.
- Tracks: J1 to J5, R1 to R3, A1 and A2.

---

## 5. Session planning (what decides Today)

**Endpoints:**

- `session.today` (`GET`, `?targetMinutes`) calls `planner.today(...)` (`routes/course.ts:56-64`).
- `session.start`, `session.heartbeat`, `session.end`, `session.summary`, `session.day` (`?tab=`), and `bootstrap` (`openSession`).

**The planner.** `SessionPlanService` (`services/session-plan.ts:219-516`) is built over three ports, implemented in `srs-wiring.ts`:

- `SessionPlanCoursePort` → `CourseAdapter` (`srs-wiring.ts:867-1111`):
  - `next(day)`: the first item of `content.defaultOrder()` that is open, not done and authored. A checkpoint is never offered on the day its unit's last lesson was completed.
  - `history()`, `alternatives()` (open capstones, gym), `lessonProgress`, `lessonScaledMinutes`, the track hooks, `capstoneGymNote`, `pause()`.
- `SessionPlanLearnerPort` → `PlanLearnerAdapter` (`:1113-1132`): profile minutes, the last qualifying day, `lastCanDo`, **`lastSketchId()` = `sketches.latest()`** (used in the returning recap), `tutorNote`.
- `SessionPlanSrsPort`: the SRS service for the warm-up.

**`#today`** (`session-plan.ts:253-357`):

1. Work out the gap and return mode, and prepare the SRS day.
2. Build `base` (day, target, returning recap, alternatives, tutorNote, tracks, core, focus).
3. After a gap of 10 or more days, plan a **Light** session: the last lesson's Make with one new constraint (`main.light`, `estMinutes = MAIN_MINUTES.make[target]`).
4. Otherwise take `next = course.next(day)`, apply the track focus, then `#main`.

**`#main`** (`:359-483`), in order:

1. Transcription slot every 5th session (gym, CF-T or X#).
2. CF-T after the core.
3. X1 gym note.
4. A reviews-only day when `next === null`.
5. Checkpoint.
6. Capstone.
7. Otherwise a **lesson**: `resumeStep` comes from progress; at the 15-minute target a lesson longer than 10 scaled minutes is split into A and B.

`MAIN_MINUTES` is at `:126-134`.

**Warm-up, New, Make, Coda.**

- The warm-up is `plan.warmup` (`DueBatch`: budget, plannedSec, items, label).
- New is the lesson's steps. The Make is the lesson's last `code-make` step, decided by the content and the app, not the planner.
- The Coda is the `SessionSummary` that `session.end` returns (`services/sessions.ts:221-327`): `sketchesSaved` (`sketches.savedSince(startedAt)`), `canDo`, `unlocks`, `toleranceChange`, `teaser`, `gym`, `gatesOpened`, `coreComplete`, `courseComplete`, and `next` (the planner's peek at tomorrow, `nextSessionOf` in `srs-wiring.ts:1149-1196`).
- The app's machine is `app/src/session/machine.ts`: warmup, main, make, coda.

**Session rows.** `SessionsService.start` (`sessions.ts:139-219`):

- One open session per tab per day; a repeated start returns the open one.
- It checks that the kind fits the map item (`kindOf`).
- For capstone sessions it upserts `capstone_state` to `in_progress` and calls `capstoneSessions.onSessionStart`.

**What a song needs here.**

- The plan has no song field. Following the waves' additive convention, add an optional `song` to `SessionPlanSchema`:
  - the unit, title and flavour;
  - the sections;
  - the parts with `owner: "oak" | "learner"`, the lesson that took each over and the version;
  - and "today adds": the part or role that today's lesson Make takes over.
- It is computed from the unit of `plan.mapItemId` (lesson to unit through `lessonSite`) plus the song's stored state.
- `NextSession` (the Coda's "next" line, `dto.ts:1297`) could carry the same hint.
- A Light session already replays "the last lesson's Make". With songs it would naturally replay inside the song.

---

## 6. Sketches and sketch versions

**Endpoints** (`routes/library.ts:28-41`, contract `contract.ts:259-301`):

- `sketches.list` (`?origin`, `?archived`) and `sketches.create` (`SketchCreateSchema`, `dto.ts:1645`), which returns `SketchSaved {sketch: SketchDetail, streak}`.
- `sketches.get` (`SketchDetail` = the sketch with every version) and `sketches.addVersion` (`SketchVersionCreateSchema`).
- `sketches.patch` (title, tags, archived, listeningNote) and `sketches.delete` (confirm `sketch.delete`).

**Shape.**

- `SketchSchema` (`dto.ts:1617`): `{id, title, originKind, originId, currentVersion, tags, archived, listeningNote, createdAt, updatedAt}`.
- `SketchVersionSchema` (`dto.ts:1600`): `{sketchId, version, code, bpm, meter, key: KeySpec|null, analysis: AnalysisSummary|null, note, tutorAssisted, band: {bandId, flavour, mutes}|null, flags: {lockedTools, previewTools, reviewBeforeRun?}, createdAt}`.
- `band` and `flags` are **`z.strictObject`** (`dto.ts:1584-1598`). Storing extra keys, such as part ownership, in `band_json` would fail response validation in the client and in the dev server. If ownership goes into a version it needs schema changes, or better, its own column or table.

**Service** (`services/library.ts:101-185`):

- `createSketch` (`:144-166`) runs one transaction: insert the sketch and version 1, then `streak.qualify("sketch")` if `ranOk`.
- `addSketchVersion` (`:168-176`) appends version N+1 and qualifies the streak if `ranOk`.
- **Neither is idempotent.** A retried `sketches.create` makes a duplicate sketch.
- Saving a version updates `sketches.updated_at`, which is what `lessons.sketch` and `sketches.latest()` sort by.

**Origins.** `SKETCH_ORIGINS` (`dto.ts:1575`) are `lesson-make`, `free`, `capstone`, `transcription`, `tutor`, `keepalive`, `checkpoint`, mirroring the SQL CHECK. A new origin needs a table rebuild (see §0.5).

**Other users of sketches:**

- Capstone drafts: `capstones.saveDraft` points `capstone_sessions` at a sketch version.
- Checkpoint Makes: `CheckpointSubmit.makeSketchId`, `dto.ts:1178`.
- Onboarding's Sketch 001: `onboarding_state.sketch_id`.
- Tutor cards: `tutor.cardApplied {sketchId, toNewSketch}` and `tutor_cards.saved_sketch_id`.
- Tutor subjects: `subjectKind: "sketch"`.
- The Sketchbook in Studio: filters such as `"lesson-make"`, `app/src/studio/Sketchbook.tsx:20-29`.

---

## 7. Capstones: state, sessions, checks, versions, release

**Endpoints** (`routes/course.ts:102-138`):

- `capstones.get` returns `CapstoneState` (`dto.ts:1214`): status, sessions done and total, sketchId, trackId, `flavour`, `lastResult`, `reviewRequested`, `checkedVersion`, `draftChangedSinceCheck`.
- `capstones.check` (a rubric run on a draft version): stores `lastResult` and `checked`, and gives rubric evidence once per version (`course.ts:836-872`).
- `capstones.completeSession` (`{sessionId, capstoneSessionId, sketchId, flavour}`): sessions are done in order; it saves `flavour = body.flavour ?? row.flavour` and grants that session's unlocks (`course.ts:874-909`).
- `capstones.sessions` returns `CapstoneSessions` (`dto.ts:2641`): per session its status, draft and checks; `current`; and `versions` for AC1.
- `capstones.saveDraft` (`CapstoneDraftSaveSchema`, `dto.ts:2666`): `{capstoneSessionId, sessionId, sketchId, sketchVersion, versionId?}`. It writes `capstone_sessions.draft_*`, `capstone_versions` for two-version capstones and `capstone_state.sketch_id`, then calls `streak.qualify("sketch")` (`capstone-sessions.ts:308-349`).
- `capstones.recordCheck` (idempotent; transcription phrase and stage checks).
- `capstones.gate` and `capstones.release`.

**Release** (`services/capstone-release.ts:48-178`), one transaction:

1. Checks the gate, that `capstone_state` exists, and that the sketch version exists.
2. Checks readiness: `checksCleared` for transcription capstones, otherwise the latest rubric `lastResult.status === "pass"`. The first release must be the code that was checked (`checked`).
3. Completes any missing last session and grants its unlocks.
4. Builds the liner notes:
   - the client's `linerNotesMd`, which `ReleaseDialog.tsx:116` composes deterministically;
   - plus lines naming revealed checks;
   - plus the review's `linerNote` when `includeReviewNote` is set and a `CapstoneReview` exists (`repos.tutor.latestReview("capstone", id)`).
5. **Dedupes a retried release** by comparing it with the current version (sketch, version, notes, tags) (`:114-125`). This stands in for idempotency on release.
6. Creates the track if none exists (`library.createTrack`, side from `sideOf`: A for core, B for track capstones); otherwise it calls `addTrackVersion`, which makes a revision. AC1 releases two sketch versions as track versions 1 and 2.
7. Attaches the review, then saves `capstone_state` as released with `trackId` and `flavour = body.flavour ?? row.flavour`.
8. On the first release it also runs `unlocks.onComplete(capstoneId)`, `cando.evaluate({sourceId, evidence: {kind: "track", id}})` and `tracks.syncCore`.

It returns `{state, track, unlocks, canDo, streak}` (`dto.ts:2248`). After that the app records the real-time take and `PUT`s the audio.

**How the capstone model maps onto a unit song:**

- It already models "one piece worked across several sessions, with a draft per session, then released to the album".
- It is keyed by content-defined `CapstoneId`s, and `sessionDone` and `sessionOpen` treat `X.Sn` as map items for the planner.
- Unit songs are per unit and their "sessions" are the unit's lessons. Reusing `capstone_state` and `capstone_sessions` for songs would mix two concepts in planner code that pattern-matches ids.
- Its pieces are good templates: the draft as a sketch version, the "checked version" guard, two-version drafts (`capstone_versions`), release dedupe, and record-once moments.

---

## 8. Album: tracks, versions, takes, covers, liner notes, reviews

**Endpoints** (`routes/library.ts:43-60,100-132`):

- `album.get` returns `Album {tracks, sides}`; `sides` is computed from `ALBUM_SIDES` capstone lists (`library.ts:194-206`).
- `album.track` (with versions and takes), `album.createTrack` (B-sides or capstone tracks) and `album.addVersion`.
- `album.putAudio` and `album.addTake`: a binary upload becomes a new take, a retried identical upload is detected byte for byte, and files are written at `album/<trackId>/v<n>[-t<k>].<ext>` (`library.ts:408-449`, `audio-store.ts:129-133`).
- `album.chooseTake`, `album.getAudio` (Range, `?take`), `album.deleteTrack` (confirm `track.delete`).
- `album.patchVersion` (liner notes, `includeReviewNote`) and `album.attachReview`. The review must come from a `review` conversation whose subject is **this track's capstone** (`library.ts:524-547`).
- `album.source`: what a released version plays (sketch code, Band, key, mutes, file name) for offline export (`library.ts:213-254`).

**Covers.** `cover_seed = sha256(`${id}:${title}`).slice(0, 16)` at `createTrack` (`library.ts:363`). The app draws the cover from that seed.

**Couplings** that keep songs from simply reusing the album as it is:

- `createTrack` refuses `capstoneId === null` unless the side is `Bside`, and refuses a second track for the same capstone (`:344-348`). Both rules are in the service, not in SQL, so they are easy to relax.
- `album_track_versions` requires a sketch and a sketch version, so a song release must point at a sketch version.
- `reviewRecords` (`routes/tutor.ts:27-60`), `saveCapstoneReview` (`library.ts:493-503`) and `attachTrackReview` all key reviews by the track's `capstone_id`.
- `tracks.ts:351,553` and `WholeCourse.album` count released tracks per side from capstone ids.
- Adding a `unit_id TEXT` column to `album_tracks` is a safe `ADD COLUMN`. The side CHECK already allows `'A'` and `'B'`.

---

## 9. Unlocks, can-do ledger, milestones, terms, streak

- **Unlocks.**
  - `UnlocksService.onComplete(sessionId)` grants the toolbox rows whose `unlock.at` names that session (a lesson, checkpoint, capstone or capstone session id), plus fallbacks; `onStart(sessionId)` grants the START rows (`services/unlocks.ts:115-140`).
  - `backfill()` (`:206-231`) grants rows silently; it runs at start-up and after a backup import.
  - Rows are never deleted; a trigger enforces this.
  - Endpoints: `unlocks.list`, `unlocks.seen`, `unlocks.next`, `gates.voicing`.
  - A song release could grant unlocks if toolbox rows named a unit id; none do today.
- **Can-do ledger.**
  - `CanDoService.evaluate({skills?, sourceId?, evidence: {kind, id}})` appends a row for each status change (`services/cando.ts:84-121`).
  - `CanDoEntry.evidenceKind` is `z.enum(["sketch","track","lesson","checkpoint","set","transcription"])` (`dto.ts:323-330`), so a new kind is a DTO change.
  - `sourceDone(id)` (`services/index.ts:78-83`) understands lesson, checkpoint and capstone ids only.
- **Milestones** are **computed, not stored**: `progressReport` (`routes/practice.ts:21-90`) builds `doneAt` from completed lessons, passed checkpoints, released capstones and their sessions, and gym. It then checks each `content/milestones.ts` condition `{sessions, capstones, canDos, ladder, anyOf}`. A released unit song would need a `doneAt` entry and probably a new condition key in `MilestoneDef` (content-kit).
- **Terms.** `terms_introduced` is filled on lesson completion.
- **Streak.** `streak.qualify("sketch")` is called by `createSketch` and `addSketchVersion` when `ranOk`, and by `capstones.saveDraft`. A song save must qualify the day the same way (contracts §7.8 b).

---

## 10. Settings and flavour

- `SettingsSchema` (`dto.ts:230-264`) has: theme, volume, clickVolume, rollLabels, editorFontSize, pausedWeeks, teaserOptIn, linerNotesInAlbum, tutor, backupWithAudio, lenses, albumTitle. `DEFAULT_SETTINGS` is at `:268-281`.
- `PUT /settings/:key` validates the value against that key's schema (`routes/meta.ts:54-71`). A new setting needs no migration, only the DTO.
- **Flavour is not a setting.** It is `Profile.flavour`, written by `profile.put` / `ProfilePatchSchema`. Writers:
  - onboarding (`app/src/onboarding/screens/PrefsScreen.tsx:40,90`, which offers only pop or jazz-soul);
  - Settings → Learning, "Genre flavour" (`app/src/routes/settings/learning.tsx:49-56`).
- **Readers:**
  - the app's lesson Make (`LessonPlayer.tsx:256`) and checkpoint (`CheckpointPlayer.tsx:208`);
  - the capstone (`CapstoneScreen.tsx:241`; `Workspace.tsx:272`: `state.flavour ?? tagFlavour ?? profile.flavour ?? content.shipping[0]`);
  - the Studio dialog.
  - The server only stores the flavour that comes back in request bodies: `capstone_state.flavour`, `album_tracks.flavour` and `sketch_versions.band_json.flavour`.
- **For songs:** store the flavour chosen when the song starts as a column of the song row, defaulting to `profile.flavour`. Changing it mid-unit is a deliberate re-arrangement, perhaps a new version. Contracts §5.10 rule 7 says "per capstone" flavour overrides already exist.

---

## 11. Backups, reset, import

`services/backup.ts`:

- **Daily:** `VACUUM INTO backups/oak-YYYYMMDD.db`, keeping 14 (`:41-53`).
- **Export:** a zip containing `backup.json` (`BackupManifestSchema`, `dto.ts:2110`). Its `tables` field is **every user table** (`dumpTables`, `:78-83`, via `tableNames`). Audio is added by default:
  - `audio/<sha256>.<ext>` for own files and peaks;
  - `album/<trackId>/v<n>[-t<k>].<ext>` for every take (`#files`, `:98-138`).
  - The archive path whitelist is `ARCHIVE_AUDIO_PATH` (`:28-29`).
- **Import** (`:271-338`, confirm `backup.import`), in order:
  1. validate;
  2. check every audio file's hash and path;
  3. `#forward`: migrate an older backup's rows through an in-memory database up to the latest schema;
  4. make a safety copy;
  5. `#replaceAll`: foreign keys off, triggers dropped, delete everything, insert only the columns each table has, recreate the triggers, `foreign_key_check`;
  6. `markForReview` (`:400-409`) sets `flags.reviewBeforeRun` on every `sketch_versions` and `album_track_versions` row, `transcription_versions.review_before_run = 1` and `step_attempts.imported = 1`;
  7. write the audio and set orphaned audio aside.

  The route then calls `unlocks.backfill()` (`routes/ops.ts:131-137`).
- **Reset:** a safety copy, then `#replaceAll(db, {})`, then wipe the audio folders (`:384-392`).

**What songs change:**

- New tables are included automatically in export, import, reset and forward migration.
- If song code lives in its own table, rather than as sketch versions, add it to `markForReview`. Imported code must run only after the strict lint (contracts §11.3), and `album.source` already refuses export of flagged code that fails the strict lint (`library.ts:222-229`).
- If songs get audio outside `album_takes`, such as per-version renders, extend `#files`, `info()` and `ARCHIVE_AUDIO_PATH`.
- **Backfill for existing learners must also run after an import of an older backup.** Either do it in the SQL migration, which `#forward` runs on import automatically, or call the TypeScript backfill from both `startupTasks` and the import route, as `unlocks.backfill()` is.
- Update `db/db.test.ts` and `services/backup.test.ts` (the round-trip and reset tests). `data-integrity.test.ts:427-467` checks that "backup → restore gives the same plan", so a `song` field on `SessionPlan` must survive the round trip.
- `idempotency_keys` is exported too, so after an import stale keys can answer once. That is harmless: they are pruned after 48 h.

---

## 12. Idempotency today

- **The helper** is `server/src/idempotency.ts:37-74`:
  - `idempotent(d, endpoint, key | undefined, scope, write)`; no key means no deduplication.
  - The scope hash is a stable JSON sha256 of `{params, body without the key}`.
  - Requests with the same key in flight are serialised.
  - A stored response is returned as it was; the same key with a different body is a 409.
  - The response is stored after `write()` resolves. It is not in the same transaction, so a crash between them re-runs the write on retry; that is acceptable for upsert-style writes.
- **The key schema** is `IdempotencyKeySchema` (`dto.ts:565-567`): `/^[A-Za-z0-9_-]{8,64}$/`.
- **Endpoints that use it:**
  - `steps.attempt` (`routes/course.ts:83-92`);
  - `capstones.recordCheck` (`:123-132`);
  - `srs.review` (`routes/practice.ts:267-270`);
  - `ladder.submit` (`:318-323`).
- **Other ways of not counting twice:**
  - release dedupe by content;
  - takes compared byte for byte;
  - `session.start` returns the tab's open session;
  - `INSERT OR IGNORE` on unlocks and terms;
  - `finishDrill` with an in-flight map.
- **App side:** `app/src/lib/idempotency.ts` makes the key (`crypto.randomUUID()`). `app/src/lesson/server.ts:50-60` keys the Make attempt per `(stepId, code)` so that a retried Save counts once.

**What songs need:**

- `songs.start` or `songs.arrange`: create the song for a unit, with flavour and template version. Make it an upsert on the `unit_id` primary key: a second start returns the existing song, as `session.start` does.
- `songs.saveVersion` or `songs.takePart`: write the learner's part as a new song version and mark ownership. Use an `idempotencyKey`, keyed per learner action, for example per `(lessonId, partId, code)` as the Make key is today.
- `songs.release`: release with a key, or content dedupe as `capstones.release` does.
- Return compact payloads: a song state plus the current version's code, never every version, to keep `idempotency_keys.response_json` small.
- If the Make still creates a `lesson-make` sketch, consider making `sketches.create` idempotent with an optional key. Today a retry duplicates the sketch.

---

## 13. `packages/api`: contract, DTOs, typed client, and how the app uses them

- `packages/api/src/index.ts` re-exports `@oak/content-kit`, `client.ts`, `contract.ts`, `dto.ts` and `tutor.ts`. It is isomorphic; `package.json` exports `./src/index.ts` with no build step.
- **The contract** (`contract.ts`) is a table:

  ```ts
  "lessons.complete": { method: "POST", path: "/lessons/:id/complete", params: p("id"),
    body: D.LessonCompleteRequestSchema, res: D.LessonCompleteResultSchema },
  ```

  - Entry options: `confirm` (a nonce is required), `confirmIf` (a nonce only when something is replaced), `media`, `dev`, `body: "binary"`, `res: "binary" | "sse"`.
  - The type helpers `EndpointInput`, `EndpointOutput` and `HandlerInput` are at `:877-908`.
  - Each wave listed its new endpoints in `WAVEn_ENDPOINTS` (`:744-829`), used by the tests as a "pending 501" checklist. All of them are built now.
- **Server.** `createMounter` (`routes/define.ts:102-183`) mounts by name:
  - It parses params, query and body with the contract's zod.
  - It enforces the confirm nonce.
  - When `validateResponses` (dev or test) is on, it validates the handler's output against `res`; a mismatch is a 500.
  - Handlers are `mount("name", ({params, query, body}) => ...)`.
- **Client.** `createClient()` (`client.ts:140-328`):
  - It sends `X-Oak: 1` and checks the request against the contract (`prepare`).
  - It throws `OakApiError` with a code, parses the response with `res`, and gives `contract` errors on drift.
  - It provides `destructive(name, target, input)` (confirm, then call) and `stream()` for tutor SSE.
- **App.**
  - `app/src/lib/api.ts` holds one client, `callApi(name, input)` (which adds `tabId` to `session.start` and `session.day`), `callDestructive` and `apiUrl`.
  - `app/src/lib/queries.ts` provides `apiQuery(name, input)` with key `["api", name, input]`, `useApiMutation(name, invalidates[])` and `useDestructiveMutation`, plus a named hook for each endpoint group.
  - Invalidation is by endpoint name. For example, `lessons.complete` invalidates progress, the skills map, unlocks, can-do, `session.today` and bootstrap.
- **Steps to add the song API:**
  1. Schemas in `dto.ts`: `UnitSongSchema`, `UnitSongVersionSchema`, request bodies.
  2. Contract entries.
  3. `mount`s in a routes file (a new `routes/songs.ts`, or `course.ts`).
  4. Hooks in `queries.ts`, plus invalidation lists that include the song GET after `lessons.complete`.
  5. Optional `song` fields on `SessionPlan`, `SessionSummary` and `LessonCompleteResult`, following the waves' rule: "additive: existing shapes only gained optional fields".
  6. Consider bumping `CONTRACTS_VERSION` (`packages/content-kit/src/version.ts:5`, currently `"1.8"`).
  7. Contract tests: `packages/api/src/contract.test.ts` and `server/src/routes/routes.test.ts`.

---

## 14. Tutor couplings worth knowing

- Tutor subjects are `general|lesson|checkpoint|capstone|transcription|sketch|track|drill` (`packages/content-kit/src/ids.ts:86-95`). Their titles and released state are resolved in `server/src/tutor-adapters/lessons.ts:377-414`.
- Reviews exist for `capstone` and `transcription` only (`:416-421`, `routes/tutor.ts:27`).
- A song that should get a tutor hint, chat or review either goes through an existing subject (`sketch`, or `lesson` for the Make) or needs a new subject kind. That kind would touch content-kit ids, the tutor context, and possibly review schemas and album review attachment, which is keyed by capstone.
- Tutor cards apply to a sketch (`tutor.cardApplied {sketchId, toNewSketch}`). Song code that is not a sketch would need its own path for applying a card.

---

## 15. Dev seeds and tests

- `services/dev-seed.ts` (1725 lines, about 40 seed points) walks the learner through real services: `library.createSketch(…, "lesson-make", lessonId, code)` followed by `course.complete(...)` (`:755-780`), and drafts and releases capstones (`:959-1035`).
- `server/src/testing/learner.ts:94-110,230-239` drives tests over HTTP the same way. 34 or more test files use completion.
- If `lessons.complete` keeps `sketchId` and the song is created or updated as a side effect of completion or of the Make save, most of this keeps working. Otherwise every seed point and many simulation tests need song steps.
- Seed points such as "JC1 released" or "core complete" would need believable song states. That is easiest if a backfill builds songs from existing `lesson-make` sketches and completed lessons.

---

## 16. What a "unit song" needs on the server: a proposal

### 16.1 Data the song must hold

- **Identity:** one song per unit (`unit_id` such as `U03`, `J1`). Start or arrange is idempotent.
- **Chosen flavour** (`FlavourId`), fixed at start and defaulting to `profile.flavour`.
- **Template reference:** which arrangement it started from (sections, parts) and the template's version or content hash, because content changes over time (contracts §11.7).
- **Code:** the current full code, and/or code per part.
- **Version history:** each save tagged with the lesson or session that made it and the part it changed.
- **Ownership:** for each part (or sub-part, such as `bass.verse`), whether the owner is `oak` or `learner`, since which lesson and since which version.
- **Status:** `open | in_progress | released`, plus `released_at` and a link to the album track (`track_id`, version).
- **Flags** like sketches have: `tutorAssisted` and `reviewBeforeRun` (imports), and the Band state for export.

### 16.2 Reuse options

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. A new `unit_songs` table plus a backing sketch (recommended)** | The `unit_songs` row holds unit, flavour, template version, status, `sketch_id`, `track_id` and released times. The song's code history is the versions of one sketch. Ownership goes in a `unit_song_parts` table, with an optional per-version part log. | Reuses everything that takes `sketchId`/`sketchVersion`: `lessons.complete` (pass the song sketch, or a per-lesson snapshot), streak, `sketchesSaved`, album versions (NOT NULL sketch refs), `album.source` export, `markForReview`, tutor cards and the `sketch` subject, and the Studio editor. | `sketches.origin_kind` has no `song` value. Either rebuild with foreign keys off (needs a `migrate.ts` change) or reuse an origin; reusing makes Sketchbook filters and `lessons.sketch` ambiguous. The full code in `sketch_versions.code` mixes Oak's parts with the learner's, so evidence and the voicing gate must not read it (§4). |
| **B. Reuse the capstone tables** (`capstone_state`, `capstone_sessions`, `capstone_versions`) with synthetic ids | `U03` as a capstone-like id, lessons as its "sessions" | Release, drafts and the dedupe already exist. | Capstone ids come from content (`CapstoneMeta`). `gates.sessionDone` and `sessionOpen`, the planner and unlocks parse `X.Sn` ids. `capstone_state.status` and `sessions_json` semantics differ. Capstones still exist, so mixing them is error-prone. |
| **C. A standalone song store** (`unit_songs` + `unit_song_versions(code, parts_json, owned_json, …)`) | Its own version table | A clean model; ownership stored per version | Duplicates sketch features: streak, export, review flags, tutor cards and the album's NOT NULL sketch refs. A release still has to mint a sketch version for `album_track_versions`, or that table has to change, which means a rebuild with children. |

**Recommendation:** option A, with the song's code history as a sketch (one sketch per unit song). Add:

- `unit_songs(unit_id TEXT PRIMARY KEY, flavour TEXT NOT NULL, template_id TEXT, template_version INTEGER, sketch_id TEXT NOT NULL, status TEXT CHECK (status IN ('open','in_progress','released')), track_id TEXT, started_at, released_at, updated_at)`.
- `unit_song_parts(unit_id, part_id, owner CHECK (owner IN ('oak','learner')), lesson_id, sketch_version, updated_at, PRIMARY KEY (unit_id, part_id))`. Add a history table if Today and the Coda need "what changed when".
- `album_tracks.unit_id TEXT` (ADD COLUMN) so a released song is found without `capstone_id`.

Pick a sketch origin without a CHECK rebuild if possible. If a new origin is required, add support for a migration flagged to run with `foreign_keys = OFF` outside the per-file transaction, following SQLite's 12-step table-alteration procedure; the probe in §0.5 shows the cascade. `album_track_versions` keeps its sketch refs unchanged.

### 16.3 Endpoints (sketch)

- `GET /songs/:unitId` returns `UnitSong`: unit, title, flavour, sections, parts with owner, lesson and since-version, current version (code + band), status, track link and "today adds".
- `GET /songs` lists the songs, for the album and the map.
- `POST /songs/:unitId/start` takes `{flavour, idempotencyKey?}` and upserts.
- `POST /songs/:unitId/versions` takes `{lessonId|null, sessionId, partId|null, code, band, ranOk, tutorAssisted, idempotencyKey}`. It writes a sketch version, updates ownership, qualifies the streak and returns `{song, sketchVersion}`.
- `POST /songs/:unitId/release` takes `{sketchVersion, title, linerNotesMd, theoryTags, includeReviewNote, sessionId, idempotencyKey?}`. It creates or revises the album track (side A or B by the unit's track, `unit_id` set), records can-do and milestone input, and returns `{song, track, unlocks, canDo, streak}`.
- Optional `song` fields on `SessionPlan` (Today) and on `SessionSummary` / `LessonCompleteResult` (the Coda: "you took over the bass").
- `lessons.complete` either gets an optional `songVersion: {unitId, version}` or keeps receiving the song's `sketchId`. Validate that the Make's part exists.

### 16.4 Migration and backfill for current learners

- Existing data: `lesson-make` sketches per lesson, released capstones and album tracks.
- A backfill (SQL in `0011` for import-forward safety, or TypeScript run at start-up and after import) could create a `unit_songs` row for:
  - every unit with a completed lesson;
  - the in-progress unit, from the learner's latest `lesson-make` sketches.
  
  Mark parts as learner-owned where a lesson's Make already covered that role. Released capstones stay album tracks as they are.
- The real learner is on desktop v1.2.x: decide whether a unit already in progress is converted or finishes under the old model.

### 16.5 Easy vs hard

**Easy:**

- New tables and `ADD COLUMN`s, migration 0011.
- Backups: automatic table coverage.
- Settings keys.
- Optional fields on `SessionPlan` and `SessionSummary`.
- New contract endpoints: a mechanical pattern.
- Unit lookup from a lesson (`lessonSite(id).unit`).
- Streak qualification (call `streak.qualify("sketch")`).
- Album covers (seed from id and title).
- Release dedupe and idempotency (existing helper).

**Medium:**

- Today and plan composition: content for song templates is not loaded by the server today, so `loader.ts` and `ContentSource` must be extended, or the app computes it.
- Can-do and milestone hooks: `sourceDone` and `MilestoneDef` know lessons, checkpoints and capstones only.
- Album side counts and `WholeCourse.album` totals (`ALBUM_SIDES` is capstone-based).
- Tutor subject and review attachment (capstone-keyed).
- Dev seeds and test drivers.

**Hard or risky:**

- **Any CHECK change on `sketches`, `album_tracks` or `sessions`**: a cascade on rebuild; needs foreign-keys-off migration support.
- Keeping evidence and the voicing gate on the learner's own code when the Make edits inside a full song (`step_attempts.code`, `unlocks.gateAttempts`).
- The relationship between existing capstones (12 core, 8 track, multi-session, rubric-gated) and the per-unit release. Unit songs and capstones do not align one to one, so the album's Side A and B semantics, milestones `ms.01` to `ms.11` (capstone-keyed), and `capstone_state` gates for X1, X2 and CF-T need a decision.
- Name collision with repertoire `song` (§0.10).
