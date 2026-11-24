# Unit songs: each unit is one song you take over

Date: 2026-11-24. Status: approved direction (owner, 2026-11-24: "A song per unit + take over", "Ok, I like the idea. Build it up").
Research behind it: `docs/design/songs/*.md` (eight read-only maps of the codebase and an inventory of every Make, written 2026-11-24).

## 1. Why

The owner is the only learner. After six lessons they said the app is "very bare and the learning experience is boring", and asked for "something that sticks and keeps me coming back", "seeing results early", and "building up something bigger as we advance the lectures as opposed to the disparate concepts we are exercising in each lesson".

Their record agrees: every lesson ends in a separate sketch (`sketches.create` per Make), nothing carries from one Make to the next (only 4 of 176 Makes use `fromSketch`), and the backing is a one- or two-bar vamp with no form and no tune (Band roles are only drums, bass and chords). Today is a text setlist with no play button anywhere.

## 2. What it is

- **Every unit is one song.** When a unit starts, Oak opens a song that already sounds finished: sections (an opening, a first part, a louder second part, a break, an ending…), and Oak playing every part: kick, snare, hats, percussion, bass, chords and a lead tune. The learner picks the song's style (pop, indie, jazz-soul, funk) when it opens.
- **You take over the band.** Each lesson's Make takes over cells of the song: one or more parts in one or more sections ("your groove now plays the second part", "your riff opens the song"). Oak keeps playing everything you have not taken. By the end of the unit most of the song is yours.
- **The song persists and grows.** Every Make adds a version. Today, the lesson, the Coda, a song page and the album all show the same song, with your cells and Oak's cells told apart, and a play button.
- **The unit ends with a release.** After the unit's last lesson (or its checkpoint) the song is released to the album as a track with a tree-ring cover (one ring per lesson that went into it).

Goals: results from the first minute (the song sounds good before the learner writes a note); a visible, audible thing that grows every day; continuity across a unit; a richer, less bare daily surface.

Non-goals (this round): changing any rubric rule or grading test; changing capstones (they stay separate "singles"); learner-designed song structures; procedurally generated songs; links to commercial recordings; the in-editor count lens and hear-the-difference feedback (proposed earlier, kept as follow-ups).

Anti-goals: anything that makes grading depend on Oak's parts; anything that rewrites the learner's code text behind their back (beyond the tempo line, §5.4); a song that sounds worse than today's Bands; lesson text that names a term before the lesson that teaches it.

## 3. Approaches considered

1. **One song per unit, Oak writes it, the learner picks the style, and takes over the band (chosen).** Finished-sounding from day one; each song can be checked; the style choice gives ownership. Costs about 27 songs × 4 styles of authored music.
2. One song for the whole course. Strongest sense of growth, but one style for a year, and minor, blues, modes and jazz would have to be bent into it. Rejected by the owner.
3. The learner shapes each song (style, tempo, key from seeds) and Oak generates its parts. Most ownership, but generated parts sound generic (the "bare" problem again) and lessons cannot point at exact bars. Rejected.

Inside approach 1, two ways to place the learner's work were weighed:

- **(a, chosen) The learner's code stays a loop; Oak places it.** The Make's editor holds only the learner's code for today's cells, exactly the kind of code each lesson already grades. Oak's song engine places that loop into the claimed sections, and plays everything else. Every rubric and every grading test stays valid unchanged, because the grader still sees only the learner's code.
- (b) Put the whole song in the learner's editor. Rejected: Oak's parts use locked tools (the graded lint would stop Run), the rubrics would count Oak's tracks as the learner's, tutor Apply replaces the whole editor, and `arrange()` is locked until U09.L02.

## 4. Principles (binding for this work)

1. **Grading is untouched.** The grader sees the learner's Make code only, as today (`GradeContext.band` stays unset). No rubric rule, matcher, test or required flag changes for this work, except where a unit author must re-key a Make to fit the song (§7.3), which follows contracts §11.7 (new exercise version) and the corrections-pass standard (AUTHORING §20.2).
2. **The song is a playback, persistence and presentation layer** around the learner's code. One composer builds what is heard everywhere (editor, players, export, album).
3. **Terms are gated by data.** A section or part shows its musical name (verse, chorus, bridge, melody…) only once the learner has been introduced to that term (`terms_introduced`); before that it shows a neutral label (letters A, B, C… and plain part names).
4. **Nothing is lost.** Existing lesson-make sketches stay; a song references them. The learner's already-completed U01 lessons seed song 1.

## 5. The design

### 5.1 Content type: `UnitSongDef` (`content/unit-songs/<UNIT>.ts`)

The names `SongDef`, `SongId` and `song.*` already mean repertoire songs, and the server loader treats every `**/song.ts` as one; this type is `UnitSongDef` with ids `usong.<UNIT>` (`usong.U01`, `usong.J1`), files `content/unit-songs/U01.ts`, registered in the ID ledger and `generate.ts`.

```ts
interface UnitSongDef {
  id: UnitSongId;                    // 'usong.U01'
  unit: UnitId;                      // 'U01'
  version: number;                   // bump when Oak's code or the plan changes (see 5.6)
  title: string;                     // Oak's working title; the learner may rename their copy
  meter: Meter;                      // every take step's Make must be in this meter
  key: { tonic: string; mode: string };  // every pitched take step's Make must be in this key
  bpm: number;                       // Oak's tempo until the learner sets one
  sections: { id: SectionId; type: string; bars: number; key?: { tonic: string; mode: string } }[];
      // in form order; ids unique ('intro','verse1','chorus1'…); `type` is the section kind ('intro','verse','chorus',
      // 'bridge','outro','break', 'a','b'…) used for display names and for matching a learner's arrange() (5.2);
      // `key` overrides the song key for that section (a key change, a modal section, a minor bridge)
  parts: { id: PartId; label: string; role: 'drums'|'bass'|'chords'|'melody'|'pad';
           sounds?: string[];        // drum parts only: the sound names that belong to this part ('bd' → kick; 'sd','rim','cp' → snare…)
           name: string; plainName: string; termId?: TermId }[];
  code: Record<FlavourId, string>;   // Oak's whole song, no tempo line, one labelled track per part (label = part.label),
                                     // sections as consts + one arrange() per track (STYLE §10, contracts §6.3); profile 'band'
  plan: TakeoverStep[];              // one entry per lesson of the unit, in syllabus order (contracts §2.3/§2.6)
  releaseAfter: LessonId | CheckpointId;  // the song can be released once this is complete
}
type TakeoverStep =
  | { lesson: LessonId; kind: 'take';
      sections: SectionId[] | 'all';  // where this Make's code plays in the song
      parts: PartId[];                // the parts it is expected to take there (CI: ⊇ the parts the reference code plays)
      oakKeeps?: PartId[];            // Oak pitched parts that keep playing under a take that plays chords (CI clash-checks them)
      startFrom: 'oak' | LessonId;    // open with the lesson's authored starter, or with the learner's code of an earlier take step of this song
      today: string;                  // one line for Today and the lesson card, ≤ 20 words, the lesson's own vocabulary
    }
  | { lesson: LessonId; kind: 'side'; reason: string };  // the Make stays a standalone sketch (e.g. a 3/4 lesson)
```

Rules:
- Total bars ≤ 64 (the Workbench analysis limit). Each section is a whole multiple of 4 bars, unless it is a one-bar stop or a pickup bar.
- Every flavour has the same sections, parts and bar lengths, the same chord roots and functions, the same bass roots on the downbeats, and the same lead-tune pitches.
- A flavour may change sounds, groove and swing, and may colour chords with sixths, sevenths and ninths as its kit does (contracts §5.10: jazz-soul from U03, funk from U06). Swing follows the kit's staging. A song stays straight wherever the unit's takes are straight-subdivision parts the learner writes (all of U01–U02 and U13). The clash scan runs per flavour.
- Oak's code may use locked tools (preview context).
- The lead tune and bass must not hold a note a half step from a sounding chord tone (the AUTHORING §13 clash rule).
- The song stays under the loudness of today's Bands, so the learner's part sits on top.

### 5.2 The composer (`@oak/strudel`)

One function builds the song for a given state, used by every path (editor during a Make, `PatternPlayer`, the offline export, Workbench analysis, the loop player, album playback):

```ts
composeSong(input: {
  song: UnitSongDef; flavour: FlavourId;
  sources: { code: string; cells: Cell[]; labels: Record<string, PartId | null> }[];  // the learner's saved Make codes and what each owns
  live?: { code: string; cells: Cell[] };       // the Make being edited, owns its cells while open
  keyOf?: …; mutes?: string[]; solo?: string[];
}): { band: ComposedBand; form: SongForm; lengthBars: number }
```

- **Cells and claims.** The song is a grid of cells (part × section). Takes are applied in order; a later take overrides an earlier one cell by cell. In each of its sections, a take claims:
  - its declared `parts`;
  - every part its code actually plays. A drum hit belongs to the drum part whose `sounds` contain its sound name. A pitched track's role comes from its label and `inferRoles` (contracts §6.2 rule 1);
  - when its code plays chords, every Oak pitched part (bass, chords, melody, pad) in those sections, except those in `oakKeeps`. A learner who sets the harmony never hears Oak's bass or tune clash with it; Oak's drums keep playing.
- **Oak's tracks** play in every cell nobody has claimed: each Oak track is masked, bar by bar, to its unclaimed sections.
- **A learner source** plays in the cells it still owns:
  - A drum track is filtered hit by hit to the drum parts it still owns, so a later take of the kick does not double an earlier `drums:` line's kick.
  - A pitched track plays where its part is still its own. A track that maps to no part plays wherever the source still owns any cell of that section (going past the brief, contracts §6.5).
  - Before U09.L02, a source's code is a loop. It is placed per section with `arrange()` semantics: it restarts at the start of every section, so a 4-bar phrase with a fill lines up with every section.
  - From U09.L02, a source may contain `arrange()`. Its sections map onto the song's by `type`: its first verse goes into every song section of type verse, a numbered variant (`chorus2`) into the matching occurrence when there is one. Each learner section loops inside the song section it fills, implemented as `zoom(start, end)` then `slow(bars)` of the evaluated pattern.
  - Song sections that receive nothing from a source keep their current owner, and the take claims only the sections it filled.
  - Oak's form stays the song's form; `followLearnerForm` is off for songs.
  - The source's own `setcpm` is ignored; the song's tempo applies.
- **Tempo**: the song's tempo is the tempo of the newest learner source (the learner owns the tempo from U01.L01), else `UnitSongDef.bpm`.
- **Key**: Oak's song does **not** follow the learner's key. Keys are fixed per section by the song (`sections[].key`, else `key`). CI requires every take step's Make to be in the key of every section it plays in. A learner who changes key beyond the brief changes only their own cells.
- **Form for the Workbench**: the song's sections (`GradeContext.songForm` / `formView`) draw the ribbon and form map.
- Implementation note: today five paths compute "what Oak plays" five ways, and the loop player glues band text into learner text (it mis-parses multi-line chains). Songs must go through `composeSong` everywhere; the loop player moves to `PatternPlayer.load({ band })`.
- `BandSetup.tracks` and the sketch `bandState.mutes` widen from the `drums|bass|chords` enum to part labels; plain Bands keep working.

### 5.3 The Make inside the song

- A take step's Make opens with:
  - `startFrom: 'oak'`: the lesson's authored starter (today's behaviour);
  - `startFrom: <lesson>`: the learner's saved Make code of that earlier lesson in this song, with the existing "Start from Oak's copy" button (the `fromSketch` UI, generalised).
  - In both cases the first line's tempo is set to the song's tempo when the Make allows it.
- While editing, the band is `composeSong` with the live code owning today's cells: the learner hears their loop inside the full song. The Workbench defaults to looping today's sections, with "Play the whole song".
- A switch beside the transport, **In your song | Today's code**, sets what plays. "Today's code" plays the editor's code alone over the lesson's own Band, exactly as Makes play today. Form lessons need it to hear their own arrangement as written.
- From U05 on, most starters hold chords, bass and a tune that the required rule reads. Those lines play in the song as the learner's, in plain default sounds: the claim rule above takes the cells they play. Authors are expected to plan these units by **section** ("the chorus is yours") rather than by part.
- The transport and track chips tell three kinds apart: today's code, "yours (from <lesson title>)", and "Oak".
- `make.unchanged` compares with the code the Make opened with (not only the authored starter), so an unchanged earlier loop does not pass as today's work.
- Save: unchanged flow (`steps.attempt` → `sketches.create` lesson-make → `lessons.complete`), plus `songs.recordTake(unit, lesson, sketchVersionId, cells, labels)`.
- A side step's Make is today's standalone sketch with today's Band, and the lesson card says why it is a side sketch.

### 5.4 Persistence (server, migration `0011_unit_songs.sql`)

New tables only (no CHECK widening: rebuilding `sketches`, `album_tracks` or `sessions` cascades deletes, see `docs/design/songs/server.md`):

- `unit_songs(unit_id PK, song_id, song_version, flavour, title, status 'open'|'released', created_at, released_at, album_track_id NULL)`; created idempotently (unit_id primary key upsert, idempotency key).
- `unit_song_takes(id PK, unit_id, lesson_id, sketch_version_id, cells_json, labels_json, bpm, created_at)`; the song's state is the takes in order, later cells overriding earlier ones.
- API (zod, `packages/api/src/contract.ts`): `songs.get`, `songs.list`, `songs.start` (unit, flavour), `songs.setFlavour`, `songs.rename`, `songs.recordTake`, `songs.release`. `SessionPlan` gains an optional `song` summary.
- Backfill: when a song is created, the learner's latest lesson-make sketch of each earlier take lesson of that unit is recorded as its take (so the owner's U01.L01–L04 work is in song 1). It runs in `songs.start` and after a backup import.
- Backups include the new tables (automatic) and `markForReview` covers song takes.
- **Release is a frozen snapshot.** `unit_song_releases(id PK, unit_id, album_track_id, song_id, song_version, flavour, title, bpm, oak_code, def_json, takes_json, created_at)` stores everything needed to play it again:
  - the exact Oak code of the flavour at release;
  - the song's sections and parts;
  - each take's sketch version id and cells.
- **The album row.** A released song becomes an `album_tracks` row with no capstone (the B-side path that already allows `capstone_id NULL`), plus `ADD COLUMN unit_id`. Its `album_track_versions` row points at the newest take's sketch version (the NOT NULL column) plus `ADD COLUMN song_release_id`.
- **Album playback and export** compose from the snapshot, never from current content.
- **Takes after release** (a replayed lesson) still update the song. The song page then says it changed since the release and offers "Release again", which adds a new album version with a new snapshot.

### 5.5 Surfaces

- **New song** (first lesson of a unit with no song): a full-screen moment. Oak plays the song; four style cards, each with a play button; the working title; "Start this song". Defaults to the profile flavour.
- **Today**: a song hero below the session card and the callouts that ask for a decision (Start stays on the first screen at 1280×800, ux.md §1.4): cover (tree rings, one per take), title and style, a ▶ that plays the song as it stands, the arrangement grid (sections as columns, parts as rows; the learner's cells filled in their colour, Oak's cells outlined; a playhead moves while it plays), "lesson 4 of 9 in this song", and the next lesson's `today` line.
- **Lesson**: a song card above the first step of today's part, not above a step a visit resumes at (▶ "your song so far", the grid in small, today's line), drawn by the app, not authored.
- **Make**: the song strip above the editor with today's cells highlighted; section loop; whole-song play.
- **Coda**: "Your song grew": before/after play, the new cells and ring animate in; a Release card when the song is releasable.
- **Song page `/song/$unitId`**: the grid with playhead, section loop, mute/solo per part, the take history (each lesson: what you took over, ▶ that version), rename, change style, release.
- **Album**: a Songs shelf, one tile per unit song (cover, title, open or released, ▶).
- Visual direction: keep the existing tokens (Fraunces/Inter/JetBrains Mono, Paper/Bark, earth-tone part colours, flavour wood colours), but give these surfaces imagery and motion: covers, playheads, cells filling, ring growth. Reuse the built-but-unused kit pieces (`SectionRibbon`, `MediaCard`, `AlbumPlayerBar`) and the capstone `FormStrip`.

### 5.6 Versions and edits

A `UnitSongDef.version` bump (Oak's code or the plan changed) keeps every take; the composer uses the new Oak code; cells whose part or section no longer exists fall back to Oak, and the take history keeps them. Lesson prose changes bump `LessonDef.version` (contracts §11.7).

### 5.6a Units already started or finished

When the update first runs (server start-up after migration 0011, and after a backup import), every unit with at least one completed take lesson gets its song, idempotently:
- the style is the profile flavour;
- the takes are backfilled from the learner's latest lesson-make sketch of each completed take lesson;
- a unit whose `releaseAfter` is complete is offered for release.

The first time Today shows a backfilled song, a one-time card says Oak made it from the learner's earlier lessons, and offers the style picker.

A song that already exists keeps its takes; it gains a backfilled take only for a completed take lesson that has no take at all (a take that never reached the server), and that take never replaces a cell another take owns.

### 5.7 Tutor

The lesson context sent to the tutor gains the song: title, style, which cells are the learner's, and today's line, so the tutor can talk about "your song". No new tools.

## 6. Units, songs and order

- Core: one song per unit U01–U17 (17 songs). Advanced: one per unit J1–J5, R1–R3, A1–A2 (10 songs). U00 is onboarding and has none.
- Lessons whose Make cannot live in the unit's song are `side` (known now: U01.L08 and U07.L09 in 3/4, U13.L04 in 6/8, U10.L09, U11.L01 weak, most of R2's odd meters). Checkpoint Makes stay standalone.
- Two songs can be open at once (the next unit's first lesson comes before this unit's checkpoint in the default order); Today shows the song of the lesson it plans.
- Per-unit song proposals (harmony, form, takeover order) are in `docs/design/songs/makes-core-{a,b,c}.md` §8; unit authors start from them and may change them.

## 7. Content work per unit

1. Write `content/unit-songs/<UNIT>.ts`: Oak's song in four styles, sections, parts, plan, release anchor.
2. For every take step, rewrite the Make's prose and prompt so the task is about the song ("Put a kick on the second half of beat 2 in your song's second part"), keeping AUTHORING §21–§22 (one task in "Your task", exact, only taught words); bump `LessonDef.version`.
3. Where a Make is off the song's key or meter: mark it `side`, or re-key it (new exercise version, all tests updated, the corrections-pass standard kept).

## 8. Validation (content CI, `content/validate/unit-songs.test.ts` and a `content:check` section)

**For every song:**
- Every flavour evaluates, is not silent, and lints in profile `band`.
- Every flavour matches `meter` and the section lengths, and each part has events in every section it plays.
- Sections, parts, chord roots, bass downbeat roots and lead pitches agree across flavours.
- The per-flavour clash scan between the lead/bass and the chords passes.
- Ids, terms and the ID ledger are valid.

**For every plan:**
- Each lesson of the unit appears exactly once, in syllabus order.
- Take steps' Makes are in the song's meter and in the key of every section they play in.
- `sections`, `parts` and `oakKeeps` reference real ids.
- `parts` ⊇ the parts the step's passing reference code plays.
- With `oakKeeps`, the reference code passes the clash scan against those Oak parts.
- From U09.L02, a reference code that uses `arrange()` has section names that map onto the song's section types.
- `startFrom` names an earlier take step. That step's passing reference code lints and evaluates at this lesson, and does **not** already meet today's required rule.
- `today` passes the voice and terms checks of the lesson.
- `releaseAfter` exists and comes after the last take step.

**For the composer:** golden tests pin the claim rules (declared parts, played parts, the chords rule, `oakKeeps`, hit-by-hit drum filtering, later takes override earlier ones, `arrange()` mapping by type, frozen release snapshots).

## 9. Testing policy (owner, 2026-11-24)

Run the full suites (`bun run check`, `bun run e2e`) once, after all implementation is done. During the work: typecheck, `bun run content:check <id>` per lesson, and single targeted test files only.

## 10. Delivery

Waves in a worktree (`/Users/fpl0/Code/Oak-wt/songs`, branch `songs`): S1 platform + songs U01 and U02 (the owner is at U01.L05); S2 songs U03–U09; S3 songs U10–U17; S4 the advanced tracks; then adversarial review, the full suites, merge to `main`, push, a GitHub release, install at `/Applications/Oak.app`, and the heyfilipelima post's link updated.

## 10a. Calls made after the builder check (2026-11-24)

The owner delegated design; these were settled by the designer, not asked:
1. From U05 on, the starter's given lines (chords, bass, tune) play in the song as the learner's, in plain sounds. Plans in those units take sections rather than single parts. Rewriting about 100 starters to carry the song's own material was rejected: it would cost new exercise versions and every test.
2. A take that plays chords silences Oak's pitched parts in its sections unless `oakKeeps` lists them, and CI clash-checks those.
3. A learner's `arrange()` (U09.L02 on) maps onto the song by section type, and Oak's form stays the song's form. The Make's "Today's code" switch plays the learner's own form as written.
4. Keys are per section, and Oak never follows the learner's key in a song.
5. A release is a frozen snapshot, including Oak's code at the time; a later take offers "Release again".
6. Flavours may colour chords and swing as kits do, but never change roots, bass downbeats or the tune.
7. Units already started or finished get their songs by backfill, in the profile flavour, with a one-time style card.

## 11. Left to the builder

Exact component structure and styling within the tokens; how masks are built in Strudel (mask patterns or per-section `arrange()`); the shape of the `SessionPlan.song` summary; how the style picker previews are loaded; liner notes wording for songs; the cover's ring algorithm for songs (reuse `SketchCover`).
