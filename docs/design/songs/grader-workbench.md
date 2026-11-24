# Grader, Strudel adapter and Workbench: what exists, for the "each unit is one song" redesign

Scope: `packages/grader`, `packages/strudel`, `app/src/workbench` (plus the few call sites in `app/src/lesson`, `content/bands`, `content/STYLE.md`, `docs/design/contracts.md` that decide how they behave). Line numbers are for the tree at `dec85d2`. Everything marked **[probe]** was run headlessly against the real grader realm (scripts in `…/scratchpad/understand/probe/`); nothing in the repository was changed.

---

## 0. The short version

1. **Oak already has the mechanism a song needs: the Band layer.** Band code is evaluated *separately* from the learner's code, and its labelled tracks are collected as `band.<label>` on the *same scheduler* (live editor, hidden PatternPlayer, offline export) and in the *same realm request* (grader). A Band can already be written in sections (`const drumsVerse …` + one `arrange()` per label: `band.sections`). "Oak plays every part; the learner takes one over" = Oak's song is the Band, and the parts the learner owns are left out of `BandSetup.tracks` (the editor's band collector drops them) and written in the learner's own code.
2. **The grader can already grade one learner part against Oak's parts**, if it is given the Band code: `GradeContext.band` → `EvalOptions.band` → Band evaluated with prefix `band.`; rules can name `band.bass`, `band.chords`, `band.mel` explicitly. **[probe]** `groove-lock {kick: "kick", bass: "band.bass"}`, `bass-line {harmony: "band.chords"}`, `progression {track: "band.chords"}`, `chord-tones-strong {melody: "band.mel", harmony: "band.chords"}` all work end to end through `gradeExercise`. **What is missing is the caller**: `app/src/lesson/grading.ts:703-716` (`ctxOf`) and `content/validate/harness.ts:307-325` never set `ctx.band` (content/AUTHORING.md:201 documents this).
3. **Sections are the real gap.** Every section-aware piece of the grader and the Workbench reads sections from the *learner's* code text (`sectionsFromAst(ctx.code)`): section-scoped rules (`section: {section: "chorus"}`), `form`, `contrast`, `key-change`, `groove-lock`'s consistency check, `formView` (ribbon, form map), `pieceBarsOf` (Workbench loop length), capstone `totalBars`, offline export length. A song whose `arrange()` lives in Oak's code has, for all of these, **no sections** (`form.no-sections`) and a length of one learner loop. **[probe]** a section-scoped rule on a 40-bar song whose form is in the Band fails with "no sections to find the chorus in"; `totalBars` comes back as 1.
4. **The adapter re-forms a sectioned Band to the learner's sections** (`band-form.ts followLearnerForm`): the moment a learner writes their own `arrange()`, Oak's whole song is rewritten to the learner's section list. For a song that must keep its form, this needs to be switched off or inverted. **[probe]** a learner bass arranged as 2+2 bars shrinks the Band's 16-bar form to 4 bars.
5. **The five places that play or read "what Oak plays" do not compute it the same way.** Editor, PatternPlayer and offline export use `bandCodeFor` (key follow, `{{bpm}}`, form follow, register fold) and filter roles by the collected label; the Workbench's analysis and its loop player use raw `BandSetup.code` filtered *line by line* (`bandCodeForTracks`), and the loop player *pastes the Band text into the learner's program*. With song-shaped code (consts, chains broken over lines) this breaks: **[probe]** a learner `const drumsVerse` next to the Band's `const drumsVerse` is a SyntaxError in the loop path (the loop then silently drops the Band), and a Band chain broken over two lines makes `bandCodeForTracks` glue the orphan `.scale(…).s("piano")` onto the drums line (drums played as piano, no error). One shared "Oak's song code for this evaluation" function, used everywhere, is a prerequisite.
6. **Limits are comfortable for a song.** Lesson mode: 64 bars, 1500 ms, 20 000 haps, fuel 1 000 000; capstone: 128 bars, 5 s, 60 000 haps. **[probe]** a 6-track, 40-bar song (intro/verse/chorus/verse/chorus/outro) + a learner kick: 1 440 events, fuel 171 k, 56–71 ms in Bun; 120 bars in capstone mode: 4 320 events, 609 k fuel, 176 ms. The Workbench analyses at most 64 bars (`MAX_PIECE_BARS`); the offline export at most 128 and takes the length from the learner's `arrange()`.
7. **Type-level three-role ceiling.** `BandDef.roles`, `BandRef.tracks`, `BandSetup.tracks`, `bandHeard`, `bandMutesOf`, and the offline export's request check (`offline/request.ts:22`) only allow `drums | bass | chords`. A song with `mel`, `kick`, `hats`, `pad`… needs these widened. The runtime collectors (`evaluateBand`, grader `evaluateCode`) already accept any label.
8. **Pre-U09 learners cannot write `const` (U08.L04) or `arrange()` (U09.L02)** in graded code (locked tool = error). Any section-awareness of the learner's part before U09 (e.g. "your bass plays only in the chorus") must come from Oak's side: a per-track section mask in the adapter/grader, or Oak's song wrapping the part.

---

## 1. Data flow today (one Make step with a Band)

```
content/bands/index.ts  BandDef.code[flavour] (+ BAND_STAGES)  --bandCodeAt()-->  code with {{key}} {{bpm}}
app/src/lesson/band.ts  bandSetupOf(): substitutes {{key}}, {{bpm}}  -->  BandSetup { band, flavour, code, followsLearnerKey, tracks }
                                                                               |
        +-------------------------------+--------------------------------------+---------------------------+-------------------------+
        | live editor                   | Workbench analysis                   | Workbench loop region     | offline export          | grading
        | packages/strudel/editor.ts    | app/src/workbench/use-analysis.ts    | app/src/workbench/use-loop| strudel/offline/frame.ts| app/src/lesson/grading.ts
        | bandCodeFor(...) + band lint  | bandCodeForTracks(raw code, tracks)  | codeWithBand(): TEXT      | bandCodeFor(...)        | NO band passed
        | evaluateBand(code, roles)     | grader.analyze(code, {band})         | concat, labels renamed    | evaluateBand(code,roles)|
        | -> session.band[] band.<lbl>  | -> evaluateCode(band,"band.")        | oakbandDrums: ...         |                         |
        | finalizePattern: stack+mutes  | -> events band.<lbl>                 | PatternPlayer.load(text)  | finalizePattern         |
        +-------------------------------+--------------------------------------+---------------------------+-------------------------+
```

---

## 2. The Strudel adapter (`packages/strudel`)

### 2.1 Editor evaluation (`src/editor.ts`)

`createEditor` builds the one `StrudelMirror` per editor. `evaluate()` (line 331 on) runs inside the global `EvalMutex` (`rt.mutex.run`), in this order:

1. **Lint** the learner's code with the injected `lintOak` (`lintNow`); an error-severity finding = not run.
2. `rt.prebake()`, `rt.unlock()`.
3. **Prepare the Band** (lines 386-397): `bandCodeFor(band, { key: lessonCtx.key, defaultBpm, learnerCode })`, then a separate lint with `profile: "band", allowPreview: true`. Passing → `pendingBand = { code, roles: band.tracks }`; failing → warning `ADAPTER_FEEDBACK.band` ("The Band could not play…; your code still runs").
4. `rawEvaluate(false)` → Strudel's `repl.evaluate`. Its `beforeEval` hook (lines 161-173): sets the scheduler to `lessonCtx.defaultBpm` (the learner's `setcpm` overrides it later), installs the track wrapper, then `await evaluateBand(pendingBand.code, pendingBand.roles, session)`.
5. `editPattern` (line 155): `finalizePattern(pat, { session, mutes, scopeTrack })` then `.onPaint(...)`.
6. `tracks = [...session.tracks, ...session.band.map(b => b.track)]` (line 421): learner labels first, then `band.<label>`.
7. Silence check over `min(loopBars, 16)` cycles (Band included), warm the first two cycles (≤ 4 s), then warm ahead up to `min(formBarsOf(learnerCode) ?? 256, 256)` bars in 8-bar chunks (line 447) and start.

`setBand(next)` (line 627) only stores the setup: it takes effect at the **next evaluate**. `setMutes` is live (no re-evaluation).

### 2.2 The `.p` collector, mute and solo (`src/evaluation.ts`, `src/mutes.ts`)

- The transpiler turns `label: expr` into `expr.p("label")`. `installTrackWrapper` (evaluation.ts:41-53) wraps the `.p` that `repl.evaluate` re-injects every time: it tags each hap with `context.oakTrack = <label>` and wraps the pattern in `filterHaps(() => !isMuted(track, mutes()))`. Muted-in-code labels (`_x`, `x_`) and non-strings pass through. `$` labels get a running index (`$0`, `$1`).
- `evaluateBand` (evaluation.ts:60-85) swaps in a **private** `.p` collector, runs `core.evaluate(code, transpiler, { id: "oak_band_" })`, restores `.p`, then keeps only labels in `roles` (`if (roles.length > 0 && !roles.includes(label)) continue`), tags each `band.<label>` and **drops hap locations** (`locations: []`: offsets into Band code are not offsets into the editor).
- `finalizePattern` (evaluation.ts:143-156): `stack(learnerPattern, ...bandPatterns)`, then a live filter: untagged haps mute as `main`, `band.*` haps mute by their `band.<label>` name; optional live transpose and scope tap.
- `MuteMap = { muted: Set<string>, solo: string | null }`; `isMuted` (mutes.ts:7-10): solo wins and silences everything else, Band included. Contracts §6.2 rule 3: UI mute/solo never rewrite code.
- Strudel's own solo rule (`S`-prefixed label longer than one char) applies only to the learner repl's labels; the Band is outside the repl's label map.

Consequences for a song:
- Because the Band runs in its own `core.evaluate` scope, Oak's consts and the learner's consts never collide in the editor, PatternPlayer, offline export or grader.
- `repl.evaluate` re-injects `all`, `each`, `hush`, `setcpm` globally for the *learner's* repl before `beforeEval` (node_modules/@strudel/core/repl.mjs:209-232). Band code that calls `setcpm` sets the learner repl's tempo (later overridden by the learner's own `setcpm`); a Band `all()` is wiped by `allTransforms = []` right after `beforeEval` in the editor but **is** applied to the Band's own stack in the grader. Song code should carry no `setcpm`, `all`, `each`, `hush` (BandDef already carries no tempo line, contracts §5.10 rule 2).
- Because Band haps lose their locations, Oak's code cannot light up token by token while playing, and roll→code links do not reach Oak's notes, even if Oak's code is shown somewhere.

### 2.3 Preparing the Band code (`src/band.ts`, `src/band-form.ts`)

`BandSetup` (types.ts:79-86): `{ band: BandId; flavour; code (with {{key}}/{{bpm}} substituted, read-only, strict-linted); followsLearnerKey; tracks: ("drums"|"bass"|"chords")[] }`.

`bandCodeFor(band, { key, defaultBpm, learnerCode })` (band.ts:201-240):
1. `followsLearnerKey`: rewrites the step key's scale names to the learner's first `.scale()`; a learner key plan (patterned `.scale("<C4:major!8 D4:major!4>")` or lifted section consts, `learnerKeyPlanOf`) replaces every single-key Band `.scale()`.
2. Fills leftover `{{key}}` (`<tonic>4:<mode>`) and `{{bpm}}` (learner's `setcpm` BPM or the default).
3. **`followLearnerForm(code, learnerCode)`** (band-form.ts:176-191): if the learner's code has a readable `arrange()` (all tracks agree), *every* readable Band `arrange()` is rewritten to the learner's section list, each learner section played by the Band section of the same type (or a kin type from `KIN`: chorus↔hook/refrain/drop, bridge→middle/breakdown/verse, intro→verse, …, else the Band's first). Without learner sections the Band keeps its own form.
4. `foldBandRegister`: every `.scale("X4:mode")` moved so the tonic sits within a tritone below to a fourth above C4 (`bandOctave`).

The parse is static and regex-based (`arrangeCalls`): sections must be `[number, identifier]` exactly. `formBarsOf(code)` = learner form length (preload horizon, PatternPlayer warm-ahead).

**[probe]** with `band.sections` (16 bars) and a learner `bass: arrange([2, bassVerse], [2, bassChorus])`, `bandCodeFor` returns `drums: arrange([2, drumsVerse], [2, drumsChorus])…`, `chords: arrange([2, chordsVerse], [2, chordsChorus])…`: the song shrinks to the learner's 4 bars. For a unit song this behaviour must become opt-in (e.g. a `followsLearnerForm` flag on `BandSetup`, default on only for `SECTION_BANDS`), or be inverted (the learner's sections must match the song's).

### 2.4 The hidden PatternPlayer (`src/pattern-player.ts`)

A repl with no editor and no DOM (`createPatternPlayer`). `load(code, { bars, cps, lint?, band?, key? })` lints the code (default: content profile with previews), prepares the Band with the **same** `bandCodeFor` + band lint (`prepareBand`, lines 175-192), evaluates through `beforeEval → evaluateBand`, and builds `effective = finalizePattern(raw) → .ribbon(fromBar, bars) (A–B loop) → realism`. `setLoop`, `setMutes`, `setRate` (cps scale 0.25–1), `setTranspose`, `setRealism` act live. Preloads 16 bars up front, warms the rest up to `min(max(bars, formBarsOf(code)), 256)`. Meter is hard-wired to 4/4 for the transport (`meter: () => "4/4"`, line 198) and for the Band's `{{bpm}}` (`BEATS_PER_BAR = 4`, line 56).

A PatternPlayer is the natural engine for a Today-screen "play the song" button with no editor: `load(learnerParts, { band: song })`.

### 2.5 Flavour kits and the sound pack

- Kits: `content/flavours.ts` (`FlavourKit`: drums, bass, chords, **lead**, chordDepth, swing, production {room, bassLpf, humanizeVelocity, pan.{drums,bass,chords,lead}}) and `content/bands/index.ts` `KITS` (lines 89-115: bank, bass sound, chord sound, gains). `FLAVOUR_RULES`: jazz-soul sevenths + swing from U03.L01; funk sevenths from U06.L01; `bandCodeAt(def, flavour, reached)` picks the `BAND_STAGES` stage a session has reached. A flavour never changes a rubric (contracts §5.10 rule 7).
- No Band plays a lead today: `layers()` (bands/index.ts:150-161) and `sectionLayers()` (575-591) write `drums:`, `bass:`, `chords:` only. The kit's `lead` sound exists (piano / vibes / acgtr / organ) but is only used for learner starter swaps.
- Sound pack: `src/pack.ts` prebakes the self-hosted pack from `<soundsRoot>/manifest.json` (sample maps, bank aliases, curated GM soundfont aliases, `kitGains`); no remote origin. Band mixes are measured per Band and flavour in `packages/strudel/e2e/wave5.pw.ts`/`wave6-bands*`/`wave7-bands*` (loudness balance). A song per flavour would need the same treatment.

### 2.6 Transport, coordinator, mutex, live editors

- One `Transport` (the active editor's or player's scheduler); `audibleCycle()` drives every playhead. The scheduler cannot seek: a running editor keeps its cycle across re-evaluations, so "start at the chorus" is only possible through the PatternPlayer's `.ribbon()` loop.
- `PlaybackCoordinator`: **one source plays at a time**; editors, players and exclusive plans claim it and stop the others. Two editors can never sound together, so a song cannot be assembled from several live editors.
- `EvalMutex`: every evaluation (all editors, all players) is serialised.
- Live mirror budget: `maxLiveEditors` default **6** (index.ts:111, app does not override it, `app/src/lib/oak.ts:70-82`); LRU eviction never takes a playing or focused editor; an evicted editor becomes a static `<pre class="oak-static-code">` and fires `onEvicted`.

### 2.7 Offline export (album) (`src/offline/*`)

`RenderPieceRequest { code, band?, key?, mutes? … }`; `frame.ts:55-100` evaluates exactly like the editor (`bandCodeFor` + `evaluateBand`). Bounds (`bounds.ts`): base lint + no JS loops + literals ≤ 100 000; **length = the `arrange()` total of the learner's code** (`checkSource`, lines 126-163: "Give the piece an arrangement … so the export knows where it ends"; a Band "has no form of its own (it follows the piece)"), at most 128 bars (`offline/math.ts`), ≤ 60 000 notes, 10 s query budget, 60 s overall. `request.ts:18-22` rejects any Band track outside `drums|bass|chords`. For a song release both need changing: length from the song's form, and any label.

---

## 3. The grader (`packages/grader`)

### 3.1 Realm and evaluation (`src/runtime/*`)

- One Strudel realm per Worker/subprocess/test process (`realm.ts`): core + mini + tonal + repl stubs (`setcps/setcpm/all/each/hush`, inert audio functions), visual methods stubbed to identity, `.piano()`, the `_oakChord` voicing shim, console capture, fuel meter, snapshot-and-heal of the scope before and after every request, lockdown of `Function`/`eval`/network in workers.
- **The `.p` collector** (realm.ts:217-227) mirrors repl.mjs 1.2.6: `_x`/`x_` → silence; `$` labels get `R.collector.anon++`; `R.collector.tracks.set(id, this)` (repeated label keeps its first position, the later pattern wins); a non-string id throws like the editor.
- `evaluateCode(code, prefix = "")` (evaluate.ts:61-116): transpile, refuse `import()`, `safeEval` with every host global shadowed, then collect: the repl solo rule (any key longer than one char starting with `S` solos), `each` (last one wins) per track, names prefixed (`band.` for the Band), every track tagged `oakTrack`, `stack()`, then `all()` transforms.
- `evaluateForGrading(code, opts)` (analyze.ts:29-184), one request at a time per realm:
  1. Lint the learner code (`opts.lint`; `null` = trusted reference, no lint). If `opts.band`: lint it with `profile: "band"` (lines 76-86); a Band lint error **fails the whole request** ("Band code: …").
  2. `astTotal = arrangedTotal(sectionsFromAst(code))` — **learner code only** (lines 88-89).
  3. Evaluate learner, then Band with prefix `band.` (lines 110-131). A Band eval error **fails the whole request**. Tempo: "the learner's tempo wins; the Band's applies only when the learner set none" (126-130).
  4. Bars: `requested = mode === "capstone" ? (astTotal ?? opts.bars) : opts.bars`, clamped to the mode's `maxBars`; `truncated` when above (133-135).
  5. `tracks = [learner labels…, band.<labels>…]` (137); `queryCycles(sources, fromCycle, bars, cps, hapCap)`.
  6. `totalBars = astTotal ?? periodOfEvents(learner events only…)` (160-162); `eval.silent` when there are no **learner** events (246-248).
- `queryCycles` (evaluate.ts:133-169): one cycle at a time, each source (learner, Band) queried with `pattern.query(new State(span, { _cps }))`; throws `too-much-work` when fuel runs out, `too-many-events` when one cycle of one source returns more than `hapCap × 4` haps (fragments included), or when the running total of onset events exceeds `hapCap` (**learner and Band together**).

`EvalOptions.band` is a plain string: the grader keeps **every** label in the Band code. Role filtering is the caller's job (today `bandCodeForTracks`, a line filter; see §4.3).

### 3.2 Normalization (`src/normalize/nevent.ts`, `src/analyze/tracks.ts`)

`normalize(result, ctx)` → `Normalized { byTrack, all, band, cps, bpm, roles }` (types.ts:202-211):
- `all` = learner tracks only; `band` = `band.*` events; `byTrack` holds both; every evaluated track is present even when silent.
- Inaudible events are dropped (`effectiveGain ≤ 0.01`); learner events below 1/16 of the **learner** peak are dropped as masked (`audibleInMix`, nevent.ts:172-179). The Band is "judged on its own": a quiet learner part under a loud Oak mix is never treated as masked.
- `roles` from fixed labels (`LABEL_ROLES`, content-kit common.ts:350-361: drums kick snare hats perc → drums; bass; chords pad; mel vox → melody) then `inferRoles` (all-drum track; ≥ 25 % polyphonic → chords; lowest monophonic below C3 → bass; highest → melody). **Learner tracks only.**

### 3.3 Modes and caps (types.ts:127-145, contracts §6.4)

| Mode | Used for | maxBars | timeout (whole request, worker killed + respawned) | hapCap (events, learner + Band) | periodCap | fuel (fraction ops) |
|---|---|---|---|---|---|---|
| `lesson` | steps, Make, checkpoints, drills, **Workbench analysis** | 64 | 1 500 ms | 20 000 | 16 | max(1e6, 20 000×50) = 1 000 000 |
| `capstone` | capstones, CF-T, ladders L6/L8 | 128 | 5 000 ms | 60 000 | 128 | 3 000 000 |
| `tutor` | `evaluate_strudel`, `compare_haps` | 16 | 1 500 ms | 5 000 | 16 | 1 000 000 |

- `barsToQuery` (runtime/caps.ts) for reference-matched steps: `min(64, max(ref.bars, min(16, periodOf(answer))))`.
- Make (`gradeRubricPiece`, grade/index.ts:616-718): `bars = min(cap, max(ex.bars[1], astTotal ?? (capstone ? 64 : 16)))` (line 625-626), with `astTotal` from the **learner** code.
- The timeout covers the whole `grade` request: learner + Band + any `matches`/`reharmonize` references + `otherVersion`, all in one realm.
- The app has **one** browser GraderHost (`app/src/lib/grader-client.ts`): a module Worker, FIFO, one request at a time, warm spare after a kill. Workbench analysis (debounced 300 ms) and grading queue behind each other.

**[probe]** (Bun, in-process, no lockdown; `song-probe.ts`): a song with `kick snare hats bass chords mel`, each `arrange([4,intro],[8,verse],[8,chorus],[8,verse],[8,chorus],[4,outro])`, learner owning `kick`:

| Song | Mode | Bars queried | Events (learner) | Fuel | Time |
|---|---|---|---|---|---|
| 40 bars | lesson | 40 | 1 440 (80) | 171 435 | 71 ms |
| 40 bars | capstone | 40 | 1 440 (80) | 171 435 | 56 ms |
| 80 bars | lesson | 64 (truncated) | 2 290 (128) | 299 324 | 89 ms |
| 80 bars | capstone | 80 | 2 880 (160) | 373 359 | 111 ms |
| 120 bars | capstone | 120 | 4 320 (240) | 608 883 | 176 ms |

Roughly 36 events and 4 300 fuel per bar for a plain 6-part pop song: about 7 % of the lesson hap cap and 17 % of its fuel at 40 bars. Denser writing (16th hats throughout, 4-note chords on eighths, `voicing()`, swing) raises both; measure with the real song code per flavour. A browser Worker is slower than Bun in-process, but there is an order of magnitude of headroom under 1 500 ms.

### 3.4 How a rule targets a track (`src/analyze/tracks.ts`, `src/rubric/*`)

`TrackRef` is a string (content-kit common.ts:291). `selectTrack(n, ref)` (tracks.ts:45-54):
- `"*"` → `n.all` (learner only);
- `"@drums" | "@bass" | "@chords" | "@melody"` → `tracksOfRole` (tracks.ts:13-23): fixed labels + the inferred one, **never `band.*`**;
- `"band.<label>"` → `n.byTrack[ref]` (Band events);
- any other string → that learner label.

Contracts §6.2 rule 5: "Band tracks are collected as `band.<label>`, are never matched by `'*'` or a role, and can be named explicitly". Rule fields that take a `TrackRef` (content-kit `schema/rubric.ts`): `in-key.tracks`, `ends-on-degree.track`, `chord-tones-strong.melody/harmony`, `progression.track`, `range.track`, `step-ratio.track`, `groove-lock.kick/bass`, `swing.track`, `syncopation.track`, `voice-leading.track`, `guide-tones.track/harmony`, `euclid.track`, `clave.track`, `polyrhythm.a/b`, `register-separation.low/high`, `no-muddy-low.track`, `motif-reuse.track`, `velocity-ghosts.track`, `onsets.track`, `degree-set.track`, `sounds.track`, `distinct-pitches.track`, `pickup.track`, `chord-qualities.track`, `chord-inversions.track`, `non-chord-tones.track/harmony`, `bass-line.track/harmony`, `notates.melody`, `reharmonize.melody/harmony`, `tuplets.track`. Any of these can point at `band.<label>`.

Specific rules named in the brief:
- **`groove-lock`** (rules.ts:954-990): `kickOnsets` = onsets of the selected track's `drum === "kick"` events (else all its onsets); bass onsets from `selectTrack(r.bass)`; lock = share of bass onsets on a kick (`grooveLock`, analyze/groove.ts:18-31, tolerance 0, grid 1/16). It first refuses an inconsistent learner `arrange()`.
- **"roles"**: not a rule name; it is the rule **id** capstones give to `{ rule: "tracks", min, roles: [...] }` (content/capstones.ts:1393, 1790, 1909). `tracks` (rules.ts:272-295) counts **learner** labels with events (`!t.startsWith("band.")`), by role via `tracksOfRole`. In a song this naturally means "parts the learner owns".
- **Harmony: `chords` vs `band.chords`.** Rules with an optional harmony (`bass-line.harmony`, `non-chord-tones.harmony`, `progression.track`, `chord-qualities.track`, `ends-on-degree.over`, and every rule that reads "the piece's chords": `cadence`, `contains-rn`, `harmonic-rhythm`, `device-count`, `mode`, `blues-form`, `modulation`, `key-change`) go through `pieceSlots(n, track?)` (rules.ts:176-207) or `harmonySlots` (analyze/piece.ts:51-56): the default is `selectTrack(n, "*")` / learner `@chords`, and the **slot bass is always `pitched(n.all)`** (learner tracks), so Oak's bass never decides an inversion in the grader. Only an explicit `harmony: "band.chords"` / `track: "band.chords"` reads Oak's chords. Key reading (`keyOf(n.all, ctx.key)`), energy, density, contrast features, swing views, Wave 7 lens views are learner-only too.
- **[probe]** (`song-probe2.ts`) learner `bass` over Band drums+chords: `bass-line` with default harmony → "no chords to play the bass against"; with `harmony: "band.chords"` → graded ("roots on 54 % of the chord changes"); `progression` default → "chords go ;" (nothing); with `track: "band.chords"` → met. `range {track: "@bass"}` with Oak's bass only → "no pitched notes".

### 3.5 Sections in the grader

- One reading of sections: `sectionsFromAst(code)` / `sectionsFromProgram` (lint/ast.ts:465-630). Each labelled track whose chain *starts* with `arrange(` contributes its `[bars, pattern]` list; names come from `<role><Section>` identifiers (or the const a call wraps, `chord(A)`), `silence` = rest; all arranged tracks must agree on count and lengths, else `{ inconsistent }` (`form.inconsistent-arrange`); a time-scaling method after `arrange()` (`.fast(2)`) is refused. Result: `SectionInfo { label, tag, bars, startBar }[]` + `totalBars` (types.ts:456-464).
- `SectionRef` (content-kit rubric.ts:20): `{ section, nth? } | { bars: [from, to] } | "last"`; `RubricRuleBase.section` scopes any rule except `contrast`/`key-change` (feature `rubric.section`). `evalRule` (rules.ts:1927-1950) → `scopeToSection` (wave5-rules.ts:258-322) slices the piece to the span and shifts it to bar 0, `unscope` shifts `where.bar` back (wave5-rules.ts:324-339).
- **Every section reader takes the learner's code**: `scopeToSection` (wave5-rules.ts:268), `sectionsFor` (`contrast`, rules.ts:1348-1374), `form` (rules.ts:1159, wave6-rules.ts:606), `grooveLockRule` (rules.ts:962), `analyzePiece` (piece.ts:330), `keysByBar` (key-plan.ts:78), `formView` (wave5-views.ts:106-133), analyze.ts `astTotal`, `gradeRubricPiece` `astTotal` (grade/index.ts:622).
- **The `{ bars: [a, b] }` form needs no `arrange()`**: it works today for a song whose form lives in Oak's code, if content knows the bars. **[probe]** `groove-lock` with `section: { bars: [13, 20] }` graded correctly; `section: { section: "chorus" }` failed with `form.no-sections`. Small pre-existing wrinkle: inside a scoped rule the *prose* keeps section-relative bar numbers ("Bars 13–20: … (bar 1, 1&: …)") while `where.bar` is shifted; `unscope` does not rewrite the detail text.
- A ready-made carrier for song sections exists: `GradeContext.songForm` / `RubricContext.songForm` (`{ label, bars, chords? }[]`, types.ts:280, rubric/context.ts:32), used by `form`'s `@song` pattern and by `song-kept`/song-chart rules (rules.ts:1742-1780, corrections-rules.ts:985-1030). It is not consulted by `scopeToSection`, `contrast`, `formView` or the bar counts.

### 3.6 `ctx.band`: what exists and what does not

- `GradeContext.band?: string` (types.ts:262) → `evaluateCode` helper in grade/index.ts:227-245 passes `band: ctx.band` to `deps.evaluate` for the learner side only (`!trusted`); references are evaluated without it.
- Nobody sets it: `app/src/lesson/grading.ts:703-716` (`ctxOf`), `app/src/lesson/LessonPlayer.tsx:417` (`gradeMake`), `app/src/capstone/engine.ts`, `content/validate/harness.ts:307-325`. content/AUTHORING.md:201 and comments in U06.L05/U07.L02/U07.L04/U07.CP say so and route around it ("A check that needs harmony under a learner melody reads a chord track in the learner's code").
- `bandCodeFor` (what the learner actually hears) is not exported from `@oak/strudel` (package.json `exports` has no band entry; index.ts exports no band helper). To grade against exactly what plays, the app needs it (it is pure text code: band.ts imports only band-form.ts and sounds-in.ts).
- **[probe]** (`grade-probe.ts`) the same Make, learner `bass` over `band.sections` drums+chords, required `groove-lock {kick: "band.drums", bass: "bass"}`: without `ctx.band` → "no kick drum to lock the bass to", score 0; with `ctx.band` → graded on the real kick ("50 % of the bass notes land with a kick"), score 0.67, `eval.tracks = bass, band.drums, band.chords`. A section-scoped suggestion still fails "no sections".

---

## 4. The Workbench (`app/src/workbench`)

### 4.1 Props and Band wiring (`Workbench.tsx`)

- One editor per Workbench (`oak.createEditor`, lines 600-675), mounted once per ID; `band` goes into `EditorOptions.band` and later through `handle.setBand` (lines 687-690). `readOnly: true | { editable: CodeRange[] }` gives editable regions inside one document (the ⟪⟫ regions of a starter); `initialMutes` (a sketch's Band mutes), `onMutes`, `codeKey` ("Start from Oak's copy"), `tutorBars`, `onLoopChange`.
- **Loop length**: `loopBars = max(pieceBarsOf(code, lessonCtx.loopBars), min(64, keyPlanBars(code)))` (lines 378-381) — from the **learner's** `arrange()` or the host's `lessonCtx.loopBars`. For a song in Oak's code the host must pass the song length as `lessonCtx.loopBars` (LessonPlayer.tsx:799 sets it from `ui.loopBars`/example/reference/make bars).
- `bandHeard` = `band.tracks` less the muted ones (line 396): the harmony reads only these.

### 4.2 Analysis path (`use-analysis.ts`)

`grader.analyze(code, { mode: "lesson", bars: loopBars, lint, meter, band: bandCodeForTracks(band.code, band.tracks) })` (lines 63-70), debounced 300 ms, immediate after a Run, re-run when the "shape" (bars, key, Band code/tracks, lint) changes; a failure keeps the last good model. Note it passes the **raw** setup code, not `bandCodeFor`: no learner-key follow, no learner-form follow, no register fold. What the roll/chord band shows of the Band can therefore differ from what plays (wrong octave in G–B, the Band's own form when the learner arranged, the step key after the learner moved the key). And since a Band lint/eval error fails the whole analysis (§3.1), a broken Band blanks the learner's roll and staff, while in the editor it only produces a warning.

`buildModel` (model.ts:529 on): learner events + Band events; `heardBand` filters the harmony's Band input; the roll draws every Band part dimmed (`e.band ? 0.55`, PianoRoll.tsx:651); `workbenchHarmony` (harmony.ts:142-160) reads the learner's chords with Oak's bass as the learner's (`withBandBass`), and falls back to Oak's chords + bass when the learner has none (`withBandHarmony`), labelling the chord band "Band" (`source: "band"`). This is the Workbench's own version of "grade in context of the song"; the grader has no equivalent default.

### 4.3 Loop region playback (`use-loop.ts`, `loop-math.ts`)

The editor has no loop; `L` / a section click plays through a hidden PatternPlayer with `.ribbon(from, bars)`. `start(code)` (use-loop.ts:69-92) loads `codeWithBand(code, band)`: **the learner's text followed by the Band's text**, Band labels renamed `oakbandDrums:` (loop-math.ts:79-107), Band lines filtered by `bandCodeForTracks` (a regex over lines starting `label:`). The comment "The hidden player has no Band layer of its own" is stale: `PatternPlayer.load` has accepted `band` since Wave 4 (types.ts:283-289) and uses `bandCodeFor` + `evaluateBand`.

Problems for song code (all **[probe]**-confirmed, `song-probe2.ts`):
- A learner const with the same name as one of Oak's (`const drumsVerse` on both sides) → duplicate declaration → SyntaxError → `use-loop` retries without the Band (line 78): the section loop plays the learner alone, silently.
- STYLE §1 rule 5 breaks chains longer than 100 characters onto indented lines. `bandCodeForTracks` keeps unlabelled lines, so dropping `chords: arrange(...)` leaves `  .scale("C4:major").s("piano")` behind, which attaches to the previous statement: `drums: s("bd sd")` became `drums: s("bd sd").scale("C4:major").s("piano")` with no error. (Analysis uses the same filter.)
- No `bandCodeFor`: no key follow, no register fold, no form follow, so the loop can sound different from Play.
Fix shape: `p.load(code, { bars, cps: 0, lint, band })` and drop `codeWithBand`/`mutesForLoop`; give the grader a role filter by collected label instead of line filtering.

### 4.4 Sections in the Workbench (`lines.ts`, `lib/form-view.ts`, `SectionRibbon.tsx`, `FormMap.tsx`)

- `linesOf(n, { code, bars, … })` (lines.ts:153-219) → `formView(n, { code, bars })` (grader) → `formSectionsOf` (form-view.ts:66-83) → `FormViewSection { label, tag, text ("Chorus 2"), startBar, bars, tracks (learner tracks that sound), energy, letter (A, B by first appearance) }`, clipped to the analysed bars (`clipSections`, with a `FormCut` "the song runs 136 bars; the Workbench reads its first 64"). `MAX_PIECE_BARS = 64` (lines.ts:116). `energy` per bar is learner-only (`energyCurve` skips `band.*`, analyze/form.ts:22).
- **SectionRibbon**: one button per section over the roll (or over the staff on a `linearAxis`), coloured by letter, filled by energy, `data-playing` on the current section, click/Enter loops it (`sectionLoopOf` → `LoopRegion`), arrows walk every section (turning the roll's page via `onReveal`), Escape stops the loop; optional energy curve; when the arranged tracks disagree it prints the disagreement in words. Shown when `variant !== "mini"` and (the section lens is on or the form panel is open) (Workbench.tsx:839). The lens is `tb.lens.form`, unlocked at U09.L02 (content/toolbox.ts:245).
- **FormMap** (panel "form"): letters (`A B A B`), "N sections, M bars", an SVG of section bands + boundaries + energy path + now-line, one list row per section (loop button, bars text, tracks or "silence", energy meter), and the first contrast ("Chorus against Verse: denser; higher…", `firstContrast` + `CONTRAST_WORDS`). Without sections it teaches `drums: arrange([4, drumsVerse], [4, drumsChorus])`.
- Section loop = `clampRegion({ from: startBar, bars })` → `useLoopPlayback.start` (Workbench.tsx:819-838).
Because `formView` reads the learner's code, a song whose form is in Oak's code shows **no ribbon, no form map** today. Both components only need `FormViewSection[]` + energy: they can draw Oak's song sections unchanged once something builds them from the song code (and `tracks` per section could list owners: learner labels vs `band.*`).

### 4.5 Transport bar and track UI

- `TransportBar.tsx`: play/stop, bar.beat, tempo, meter, key, practice tempo, loop control, metronome, lens switches, and **one mute/solo chip per track** (lines 286-320), Band tracks shown as `drums (band)` (line 297). There is no "Band strip" component yet (contracts §5.10 rule 1 describes one); ownership is visible only through these chips, the dimmed roll notes and the chord band's "Band" label.
- `TrackStrips.tsx` / `track-lens.ts` / `track-switches.ts` are the **Wave 7 lens strips** (clave grid, pulse lanes, density per section, register bands, voicing/chord-scale/ii–V labels, microtiming), not a per-part mixer. Every lens skips `band.*` tracks (track-lens.ts:301, 515, 572, `handVoicings`), so they describe learner parts only. `densityLens(n, meter, bars, sections)` already takes the section list.

---

## 5. `arrange()` and section consts: STYLE and Strudel semantics

- STYLE §10 (content/STYLE.md:382-412): section patterns are `const`s named `<role><Section>` in camelCase (`drumsVerse`, `bassChorus`, `melChorus2`); section words `intro verse pre chorus bridge solo break head vamp lift outro`, `ballad drive`, or `a b c`, optional digit for a variant; **one `arrange()` per labelled track**, same sections and bar counts on every arranged track, `silence` for a resting part; a track that never changes may skip `arrange()`; `const` only, names never reused; `arrange()` may be followed by a chain but never wrapped; sections restart, so a section's bars must be a multiple of its pattern's length (`form.section-period`). Wrong: one `song:` label holding a `stack()` of parts; unequal section lengths.
- STYLE §9: a key plan goes *after* `arrange()` (`.scale("<C4:major!8 D4:major!4>")`), because a patterned `.scale()` inside a section const restarts with the section (`code.arranged-scale-pattern`).
- STYLE §1/§2/§8: tempo line first (`setcpm(bpm/units)`), one labelled statement per part in the order drums → bass → chords → melody → extras; labels from the §2 table (`drums` or `kick snare hats perc`, `bass`, `chords pad`, `keys gtr horns`, `mel vox`, `fx`, digit suffixes 2–4); chains over 100 characters break before a `.`.
- Strudel 1.2.6 `arrange(...sections)` (node_modules/@strudel/core/pattern.mjs:1469-1473): `stepcat(...sections.map(([c, p]) => [c, p.fast(c)])).slow(total)` — sections play in order, each from its own cycle 0, and the whole form loops every `total` bars. One cycle = one bar (STYLE "pinned behaviour").
- Contracts §6.3: the binding form contract (names from identifiers, agreement or `form.inconsistent-arrange`, `form`/`contrast`/`key-change` need ≥ 1 arranged track).
- Unlocks: `tb.const` U08.L04, `tb.arrange` U09.L02, `tb.lens.form` U09.L02 (content/toolbox.ts:245-288). In a graded step a locked tool is an error; in Band code it is allowed (profile `band`).

---

## 6. Answers

### (1) Playing a multi-part song: Oak's read-only parts + the learner's editable parts, with sections

**What works today (Band-layer route):** Oak's song = a sectioned Band (consts + one `arrange()` per label, no tempo line). The learner's code holds only the labels the learner owns. Taking a part over = removing that label from `BandSetup.tracks`: `evaluateBand` (editor/player/export) does not collect it, so only the learner's version sounds. Both stacks share one scheduler, one tempo (`lessonCtx.defaultBpm`, overridden by a learner `setcpm`), cycle 0 = bar 1 of the song; with no learner `arrange()` the song plays its own form and the learner's loop repeats under every section. Mutes: `band.<label>` and learner labels in one `MuteMap`.

**What has to change:**
- Widen the role type to any STYLE label (`BandDef.roles`, `BandRef.tracks`, `BandSetup.tracks`, `bandHeard`, `bandMutesOf`, `offline/request.ts:22`, content tests that assert the three roles). Write Oak's drums as `kick`/`snare`/`hats` (and melody as `mel`) so a learner can take over "part of one".
- Make `followLearnerForm` opt-in (or invert it: the learner's `arrange()` must match the song's sections, else a clear message).
- One function for "Oak's code for this evaluation" (today `bandCodeFor` + collector-level role filter) used by the editor, PatternPlayer, offline export, **Workbench analysis** and **loop playback** (switch `use-loop` to `PatternPlayer.load({ band })`; drop the line-based `bandCodeForTracks` in favour of filtering by collected label, which the grader can do too: `EvalOptions.band` could become `{ code, tracks }`).
- Song length must come from the song: `lessonCtx.loopBars` (host), the Workbench's `pieceBarsOf`, the preload horizon `formBarsOf(learnerCode)` (editor.ts:447, pattern-player.ts:275: the 256-bar default covers it), and the offline export's `checkSource` length.
- Section-aware learner parts before U09 (no `const`/`arrange()`): a per-label section window applied by Oak, e.g. a `MuteMap` extension "this label sounds only in bars [a, b)" in `finalizePattern`, mirrored in the grader (today `GradeContext.window` exists but applies to every track; `onsetWindow`, grade/index.ts:362-371).
- Oak's code on screen: Band haps carry no locations, so token highlighting and roll→code links for Oak's parts need either locations kept per Band (and a second, read-only view to map them into) or a static display.

**Alternative (one-document route):** the whole song in one editor, Oak's lines read-only and the learner's region editable (`readOnly: { editable: ranges }`). Sections, highlighting, the ribbon, `formView`, offline export length and the grader's section rules all work unchanged, because everything reads one program. Costs: the grader treats Oak's parts as the learner's (`*`, roles, `tracks`, `eval.silent`, masking peak, "evidence only for code the learner typed"); the graded lint flags Oak's locked tools as errors (no per-range lint profile exists: `LintContext` has no ranges); a learner syntax error silences the whole song; const names collide (STYLE "names are never reused"); editable-region offsets have to be remapped after every edit. It would need a "learner-owned labels" list in `GradeContext` and a range-aware lint.

### (2) Grading one learner part in the context of the whole song

Yes, today, with explicit references, once the caller passes the Band:
- Kick in the learner's drums vs the song's bass: `{ rule: "groove-lock", kick: "kick", bass: "band.bass", min }` **[probe] works** (37 % over a 40-bar song).
- Learner bass vs Oak's chords: `bass-line { harmony: "band.chords" }`, `non-chord-tones { harmony: "band.chords" }`; learner melody vs Oak's chords: `chord-tones-strong { harmony: "band.chords" }`, `guide-tones { harmony: "band.chords" }` **[probe] works**.

Changes needed:
1. **Pass `ctx.band`** from `app/src/lesson/grading.ts` (`ctxOf`), the checkpoint and capstone engines, and `content/validate/harness.ts`, computed exactly as heard (export `bandCodeFor` or a shared helper; filter to Oak-owned labels). Optionally make `EvalOptions.band` `{ code, tracks }` so the realm filters by collected label.
2. **Song sections for the rubric**: let `RubricContext` carry the song's sections (reuse `songForm`, or add `sections`/`formCode`) and make `scopeToSection`, `sectionsFor`, `form`, `formWave6`, `grooveLockRule`'s consistency check, `analyzePiece`, `keysByBar`, `formView` fall back to them when the learner code has no `arrange()`. Until then, content can use `section: { bars: [a, b] }`.
3. **Song length for bars/totalBars**: `gradeRubricPiece` takes `want = ex.bars[1]` and `astTotal` from learner code; `analyze.ts` capstone `requested = astTotal ?? opts.bars`. Song mode needs the song's total (a ctx field, or `ex.bars[1]` set to the song length); `make.beyond-brief` and `bars`/`duration-sec` rules read `pieceBars`.
4. **Decide the defaults**: should "the piece's chords" / "the bass" include Oak's parts in song mode? Today they never do in the grader (`pieceSlots`, `harmonySlots`, slot bass = `n.all`, `keyOf(n.all)`, `@role`), while the Workbench's harmony falls back to them (`withBandBass`, `withBandHarmony`). Either content always names `band.*`, or add a song-context merge in the grader (the Workbench's two helpers are the model), keeping `'*'`, roles, `tracks` and evidence learner-only (contracts §6.2 rule 5, §5.10 rule 5).
5. **Robustness**: today a Band lint or eval error fails the whole grade (`analyze.ts:76-86, 119-125`). With content-CI-checked song code that is acceptable, but a song that grows with learner parts should never fail a grade because of Oak's side.
6. Masking: `audibleInMix` uses the learner peak only; a learner part far under Oak's mix is never "masked". Decide whether that matters for song Makes.
7. Minor: section-scoped rule prose keeps section-relative bar numbers (`unscope`).

### (3) Limits

| Limit | Value | Where |
|---|---|---|
| Bars queried, lesson / capstone / tutor | 64 / 128 / 16 | types.ts:136-140 |
| Wall clock per request (whole grade: learner + Band + references) | 1 500 / 5 000 / 1 500 ms, worker killed and respawned | types.ts, hosts/core.ts:188 |
| Hap cap (learner + Band onset events) | 20 000 / 60 000 / 5 000; per cycle per source ≤ 4 × cap haps incl. fragments | types.ts, evaluate.ts:154-165 |
| Fuel | max(1e6, cap × 50) | types.ts:142-145 |
| `periodOf` cap | 16 / 128 / 16 | types.ts |
| Make bars | min(cap, max(ex.bars[1], learner arrange total ?? 16)) | grade/index.ts:625-626 |
| Workbench analysis | lesson mode, ≤ 64 bars (`MAX_PIECE_BARS`), 300 ms debounce, one shared Worker FIFO with grading | lines.ts:116, use-analysis.ts |
| Live editors | 6 live mirrors (LRU; playing/focused never evicted), one source plays at a time, one global eval mutex | strudel/index.ts:111, lru.ts |
| Preload | first 2 bars before start (≤ 4 s), then warm-ahead ≤ 256 bars in chunks of 8; PatternPlayer 16 bars up front | editor.ts:447, preload.ts:164-166, pattern-player.ts:58 |
| Offline export | ≤ 128 bars from the learner's `arrange()`, ≤ 60 000 notes, 10 s query budget, 60 s total, literals ≤ 100 000, no JS loops, Band tracks ∈ drums/bass/chords | offline/bounds.ts, math.ts, request.ts |
| Measured song cost | 40 bars × 6 parts ≈ 1 440 events, 171 k fuel, ~60 ms (Bun) | **[probe]** |

A 40–64-bar unit song fits lesson mode with large headroom; a whole release over 64 bars needs capstone mode for grading and is cut (with a note) in the Workbench.

### (4) `arrange()` and section consts in STYLE; how FormMap and SectionRibbon show them

See §5 for STYLE and §4.4 for the views. Both views are pure functions of `FormViewSection[]` + per-bar energy + a loop callback; they already handle loops per section, the current section while playing, paging, cut songs and disagreements. The work is only upstream: building the sections from Oak's song code (and deciding whether a section's `tracks` should list both owners, e.g. "kick (you), snare, hats, bass, chords, mel (Oak)"), and showing the ribbon from U01 rather than from `tb.lens.form` at U09.L02.

---

## 7. Easy vs hard

Easy (exists or is a small change):
- Separate evaluation of Oak's code and the learner's code everywhere, `band.<label>` naming, live mute/solo by label, Band in the grader's realm with explicit `band.*` refs, sectioned Band code, section loop via `.ribbon`, ribbon/form-map components, per-flavour Band code and stages, `fromSketch` (a Make opening on an earlier lesson's sketch: content-kit `CodeMakeEx.fromSketch`, exercise.ts:703-710) as a precedent for a persistent, growing piece, songForm in `GradeContext`.
- Passing `ctx.band` (the plumbing exists end to end).
- Widening the role unions (types only, plus content tests and the offline request check).

Medium:
- Song sections as a first-class input to the rubric and to `formView` (many call sites, one shape).
- One shared "Oak's code for this evaluation" helper; switching the loop player to `PatternPlayer.load({ band })`; role filtering by collected label in the grader.
- Song length as the Workbench loop, the analysis window and the export length.
- Turning off/inverting `followLearnerForm`.

Hard / design decisions:
- Section-aware learner parts before `const`/`arrange()` unlock (needs a new per-label section window in adapter and grader, or code composition).
- Whether default harmony/bass/key in rules should include Oak's parts in song mode.
- Showing Oak's code with highlighting (Band locations are dropped).
- Song-level mix balance per flavour (audibility e2e) and a lead part in every flavour.

---

## Probe scripts (scratchpad, not in the repo)

- `/private/tmp/claude-501/-Users-fpl0-Code-Oak/4fb6682d-c484-494a-8850-13e101b1acf3/scratchpad/understand/probe/song-probe.ts` — 40/80/120-bar song, timings, caps, `groove-lock` vs `band.bass`, section rule failure, `@bass` vs Band.
- `/private/tmp/claude-501/-Users-fpl0-Code-Oak/4fb6682d-c484-494a-8850-13e101b1acf3/scratchpad/understand/probe/song-probe2.ts` — `followLearnerForm` shrinking the Band, harmony default vs `band.chords`, `bandCodeForTracks` multi-line glue, `codeWithBand` const collision.
- `/private/tmp/claude-501/-Users-fpl0-Code-Oak/4fb6682d-c484-494a-8850-13e101b1acf3/scratchpad/understand/probe/grade-probe.ts` — `gradeExercise` on a code-make with and without `ctx.band`.
