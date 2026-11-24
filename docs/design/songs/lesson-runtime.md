# Lesson runtime map (app/src/lesson) — for the "each unit is one song" redesign

Scope: how a lesson runs today, from route to completion, with the Make step, the Band layer, grading, saving, example playback, and the seams where a "Your song so far" step or a "take over one part of the song" Make would plug in. All paths are repo-relative to `/Users/fpl0/Code/Oak`. Line numbers are as of commit `dec85d2`.

---

## 0. The ten-line version

- A lesson is a static `LessonDef` (`content/{core,advanced}/Uxx/Lyy/lesson.ts`) plus prose (`lesson.mdx`, one `<Step id>` block per step). The player loads both, drives an XState machine (`app/src/lesson/machine.ts`) and renders one step at a time through a renderer registry.
- The Make is always the last step (`kind: "make"`, exercise `code-make` or `compose-brief`), rendered by `MakeRenderer` (`app/src/lesson/renderers.tsx:568`). Its editor opens with the step's code held in the machine, else the learner's newest sketch of `fromSketch` (4 Makes in the whole course use it), else the authored `code.starter`.
- The Band is NOT string-concatenated into the learner's code in the editor: it is a separate `BandSetup` (`{band, flavour, code, followsLearnerKey, tracks}`), evaluated separately by the Strudel adapter with a private `.p` collector and stacked under the learner's pattern as `band.drums|bass|chords` (`packages/strudel/src/evaluation.ts:60-85,143-156`). Only the loop-region player concatenates (with renamed labels).
- `ui.band.tracks` picks which Band roles play. In practice 91 of 176 Makes keep only the Band's drums, because the grader is never given the Band (content comments say so), so authors moved chords/bass into the learner's starter. The "learner owns a part, Oak plays the rest" mechanism already exists per step, but only for the three roles `drums|bass|chords`.
- Grading sends only the learner's code. `GradeContext.band` exists in the grader and is evaluated into `band.*` tracks, but the lesson never sets it, and rubric rules skip `band.*` tracks.
- Save = `sketches.create` (always a NEW sketch, `originKind: "lesson-make"`, `originId: lessonId`) storing the code plus `{bandId, flavour, mutes}`; then `lessons.complete` with that `sketchId`. No liner notes and no analysis are written for lesson Makes. Saving is never blocked by the rubric ("Save anyway").
- In-progress Make code lives only in the machine's memory (`context.code[stepId]`): a reload loses it. Drafts in localStorage cover picked answers only, never code.
- `<Example>` buttons in prose play a step's `example` through a hidden `PatternPlayer` with NO Band, twice, then stop. Hook (`listen`) items play in a read-only Workbench that DOES carry the step's Band.
- The easiest seam for a song: generate the "Oak's parts" as a `BandSetup` (its `code` can be any Strudel; it does not have to come from `content/bands`) and give the learner only their own parts in the editor. The hard parts: the three-role type limit, the register fold applied to every `.scale()` in Band code, form/length (the Workbench only follows the LEARNER's `arrange()`), grading context, `make.unchanged` against a dynamic starter, and persistence (new sketch per save, no server-side Make draft).

---

## 1. Life of a lesson: route load to completion

### 1.1 Entry points

- Route `/learn/$lessonId` (`app/src/routes/learn/$lessonId.tsx:10-29`): search params `step` (`/^S\d+$/`, a revisit), `preview` (dev, play a locked lesson without saving), `from` (`today|toolbox|map|progress`, where the end screen returns). Renders `<LessonPlayer lessonId step preview from />`.
- Inside a session: `LessonView` (`app/src/session/host/BlockViews.tsx:40-44`) renders `<LessonPlayer key={lessonId} lessonId={plan.mapItemId} step={plan.main?.resumeStep} />`. The player reads the session (id, split part, wrap) from the zustand session store itself.

### 1.2 `LessonPlayer` (outer shell) — `app/src/lesson/LessonPlayer.tsx:148-271`

Queries, all must settle before the step renders (lines 149-177):

| Query | Source | Used for |
|---|---|---|
| `useLessonContent(id)` | `app/src/lesson/content.ts:108-136`, Vite glob over `content/{core,advanced}/**/lesson.ts` and `lesson.mdx`, `staleTime: Infinity` | `LoadedLesson {def, Mdx, sample, context?, note?, gate?, extraUnlocks?}` |
| `useContent()` | content bundle (syllabus, toolbox, terms, candos, skills) | titles, toolbox, recap |
| `useCourseProgress()` | `lessons.progress` | `LessonProgress` of this lesson (`status`, `currentStep`, `splitPart`) |
| `useProfile()` | profile | `flavour` (default `"flavour.pop"`, line 256), `targetMinutes`, learner profile for trials |
| `useUnlocks()` | `unlocks.list` | server-held tools |
| `useVoiceState()` | `voice.get` | Quiet mode, sing labels, tolerance |
| `useHealth()` | `health` | dev flag |

Gates: unknown lesson → empty state; locked lesson (`lp === null || lp.status === "locked"`, and not a sample) → "This lesson isn't open yet" with a dev-only Preview link (lines 203-235). Otherwise renders `<ServicesGate load={lessonServices} auto><PlayerCore key={lessonId} … /></ServicesGate>` (237-269). `flavour` is the learner's global profile flavour; the lesson runtime has no per-lesson flavour choice. `LessonDef.flavours` (per-flavour band override) is NOT read by the lesson runtime (only `app/src/capstone/content.ts:109` reads a def's `flavours`).

### 1.3 `PlayerCore` — `LessonPlayer.tsx:325-1279`

Set-up, in order:

1. Session binding (329-336): `inSession` only when the session plan's `mapItemId === def.id` (`reportsToSession`, `app/src/lesson/side.ts:99-101`). `target` minutes from the plan or the profile; `splitPart = splitPartFor(def, target, lp)` (`model.ts:43-52`; 15-minute days split at `wrapAt`).
2. `useStepStates(def)` (283-306): `lessons.steps` (fallback: one `steps.state` per exercise step). Server `StepState` per step (rung, attempts, passed, seriesNo, revealAvailable, practiceNext).
3. Voicing gate (U05.L07/L08 only) (339-344).
4. `GradeEnv` (378-388): `{ownerId, key, meter, bpm, swing?, pickup?, unlocked, allowPreview, profile}`. `unlocked` = server unlocks ∪ `unlockedAt(courseGraph(), toolbox, lessonId)` ∪ fixture extras (367-375). No Band in it.
5. `bandOf(step)` (392-398): `bandSetupOf(step.ui.band, {flavour: props.flavour, key: def.key, bpm: def.bpm, at: def.id})` (see §2.3).
6. `LessonDeps` (401-430): `previewDeps(def)` in preview, else `serverDeps({...})` (`app/src/lesson/server.ts`). Notable options: `band(stepId)` → `{bandId, flavour, mutes: bandMutesOf(b)}` for the sketch (411-415); `ranOk(stepId)` from the machine's `done` map (416); `gradeMake(code)` grades the Make's exercise with params `{}`, attempt 1, rung 0 (417-427). Note: `deps` is created once (`useRef(...).current`), so its closures keep the first render's flavour.
7. `deps.stepLeft` (431-460): step telemetry (`logStep`) on leaving a step.
8. Machine actor (462-465) with input `{lessonId, target, sessionId, deps}`.
9. `LOADED` once step states are in (467-499): `resumeStep = searchStep ?? lp.currentStep`, `splitPart`, `reachedStep` (the furthest step: a completed lesson's last step), `gate`. Then one `STATE` event per server step state.
10. Publishing (505-554): `snapshotOf` → `publishLesson` (zustand `useLessonPublic`, `app/src/lesson/public.ts:13-17`) and `setSubject(lessonSubject(...))` for the tutor (the tutor sees the learner's code only, never the Band). `registerTutorHost` routes tutor Apply (`applyToEditor("l-<stepId>", code)` prefix match → replaces the WHOLE editor text, `app/src/lib/editors.ts:24-29`) and Reveal through the machine.
11. Session reporting (607-628): when the Make step comes on screen, `reportBlockDone({block:"new", source:"lesson", itemId})`; at completion `reportBlockDone({block:"make", source:"lesson", sketchId})` (or `quick-sketch` after a wrap).
12. Drafts cleared when the step changes (630-637). Session "Wrap up" forwarded as `WRAP_UP` (651-655). Hotkeys (671-718): Mod+Shift+Enter check, H hint, Enter continue, Alt+←/→.

Per-step render (867-1278):

- `params = stepParams(def.id, rawEx, seriesNo)`; `ex = withParams(rawEx, params)`; generator `trials` per part (868-888).
- `grade(response)` (919-942): sends `CHECK`, publishes the tutor answer, `gradeStep(browserGrader, env, target, response, {...})`; failure → `CHECK_FAILED`. `gradeQuiet` (943-961): same without telling the machine (the Make's live checklist uses it).
- `workbenchBase(step)` (774-835): everything every Workbench of the step shares (see §2.4).
- `host: StepHost` (1123-1230) → `StepHostContext`. Make-relevant members: `workbench`, `code` (`ctx.code[step.id] ?? null`), `setCode` (→ `CODE`), `gradeQuiet`, `preview(result)` (→ `LOCAL_RESULT`), `save(code,title)` (→ `SAVE_MAKE`), `markDone` (→ `DONE`), `prose` (MDX inside `MdxStepProvider`), `renderFooter` (StepFooter; `onWrapUp` is null on the Make, 1221).
- Renderer choice (1232-1237): `step.kind === "make" && ex` → `MakeRenderer`; else `rendererFor(ex.kind)`; no exercise → `ProseStep` (1284-1313). Rendered as `<Renderer key={`${step.id}:${seriesNo}`} …/>` (1270): each step remounts its renderer.
- Screens: `status === "complete"` → `CompleteScreen` (836-851); `"wrapping"` → `QuickSketch` (852-865).

### 1.4 The machine — `app/src/lesson/machine.ts`

States: `loading` → `active` (`idle.{answering,result}`, `grading`, `posting`, `hinting`, `series`) → `finishing` → `complete`; plus `wrapping.{editing,saving}` and `error`.

Context (`LessonContext`, 92-133): `lesson`, `steps` (visible at this target, gate-filtered), `range` (today's part), `index`, `furthest`, `states`, `results`, `done`, `disputed`, `unavailable`, `code: Record<stepId,string>` (the ONLY place in-progress code lives), `tutorAssisted`, `testedOut`, `attemptKeys`, `notice`, `error`, `wrapReason`, `sketchId`, `completion`, `gate`, `retried`, `resultNo`.

Key transitions:

- `LOADED` (338-358): `steps = stepsForGate(visibleSteps(lesson, target), gate?.passed)`; `range = partRange(steps, wrapAt, splitPart)`; `index = startIndex(...)`. Steps come only from content; nothing is injected at runtime.
- `CODE` / `APPLY_CARD` (364-383): set `code[currentStep]`, toggling `tutorAssisted`.
- `LOCAL_RESULT` (384-388): the Make's live check result into `results[stepId]` (never posted).
- `CONTINUE` (444-461): guarded by `canContinue` (`model.ts:339-348`), which is always false for `kind: "make"`. End of part A → `wrapping` with `wrapReason: "split"`.
- `WRAP_UP` (498-509): only while the current step is not the Make (`beforeMake`, 268-271) → `wrapping` with `wrapReason: "wrap-up"`, `deps.position(stepId, true)`.
- `SAVE_MAKE` (510) → `finishing` (631-666): invokes `deps.finish({stepId, code, title, result: results[stepId] ?? null, tutorAssisted})`. Done → `complete` with `sketchId`, `completion`; error → back to `active` with a notice ("The sketch was not saved: … Your code is still here").
- `SAVE_QUICK` in `wrapping.editing` → `saving` (680-711): `deps.quickSketch({stepId, code, title, part: "A"|null, resumeStep})`.
- Helpers: `codeOf(c, step)` (189-194) = held code, else `editorStart(step.exercise, step.example).code` (the AUTHORED starter, not the `fromSketch` copy); `latestCode(c)` (197-210) = newest non-empty code at or before the current step (what a Quick sketch saves); `snapshotOf` (747-769) feeds tutor/session (`code: codeOf(c, s)`).

`LessonStatus` (`types.ts:80-92`) has a `"make"` value: `statusOf` returns it whenever the current step's kind is `make` (`machine.ts:743`).

### 1.5 Completion

`serverDeps.finish` (`server.ts:111-154`), see §3.2. The server's `lessons.complete` (`server/src/services/course.ts:508-530`) requires the `sketchId` to exist (404 otherwise), does not look at the Make's result, records completion, unlocks, terms, mastery, can-dos, newly opened items, track gates, SRS seeding. `CompleteScreen` (`app/src/lesson/screens.tsx:17-173`) lists unlocks, can-dos, words, practice sets, what opened; buttons "On to the Coda" (in session) / origin link, and "Open the sketch in Studio" (`/studio/$sketchId`, 165-169).

---

## 2. How a Make step is built

### 2.1 Content shape

```ts
// packages/content-kit/src/schema/exercise.ts:696-711
interface CodeMakeEx extends ExBase<"code-make"> {
  code: CodeSpec;               // { starter, toolbox?, autoCheckOnRun? }  (422-428)
  bars: [min: number, max: number];
  rubric: RubricRule[];         // exactly one `required: true`
  saveAs: "sketch";
  fromSketch?: LessonId;        // d15: open with the learner's sketch of that lesson
}
// ComposeBriefEx (940-950) can also be a lesson Make: brief, flavours?, code, rubric, minDurationSec?, album?, review
```

`ExBase` (39-78) gives `title` (the sketch's default title), `prompt`, `key`, `keyPlan`, `meter`, `bpm`, `swing`, `pickup`, `hints`, `tests`. `RubricRuleBase.section` (`rubric.ts:37`) lets a rule read only one section (`{section:"verse"}`, `{bars:[a,b]}`, `last`) of an arranged piece.

Real-world shape of core Makes (scan of all 150-odd core lessons; full table in `/private/tmp/claude-501/-Users-fpl0-Code-Oak/4fb6682d-c484-494a-8850-13e101b1acf3/scratchpad/scan2.ts` output, reproduced in the appendix):

- U01: starter is a drum line; Band plays `bass+chords` (the learner owns the drums).
- U02–U04: starter is one `mel:` line (`setcpm(...)` + `mel: note("…").s("piano")`); Band plays all three roles.
- U05–U17: starter already holds `chords:`, often `bass:` and `mel:` too; Band reduced to `drums` (91 of 176 Makes in the course). U13 and U11.L07/L08 Makes have `band: false`.
- U09.L02+ Makes are 12–32 bars and already arranged (`arrange()` unlocks at U09.L02, `content/toolbox.ts:288`; labelled tracks `name:` from U00.L01, `toolbox.ts:259`).

So the "learner takes over a part, Oak plays the others" pattern already exists, but each lesson re-authors its own starter; nothing carries the learner's parts from lesson to lesson except the 4 `fromSketch` Makes (U06.L10←U05.L01, U10.L06←U10.L05, U11.L07←U11.L06, U15.L06←U12.L04).

### 2.2 The editor's starter — `MakeRenderer` + `make-start.ts`

`app/src/lesson/renderers.tsx:568-752`, `app/src/lesson/make-start.ts`:

```ts
const starter = starterOf(ex);                     // stripMarkers(ex.code.starter) → {code, editable}
const from = fromSketchOf(ex);                     // ex.fromSketch or null
const sketchQ = useLessonSketch(from);             // GET /lessons/:id/sketch
const own = from !== null && sketchQ.isSuccess ? ownSketchOf(sketchQ.data) : null; // newest version of newest sketch
const waiting = from !== null && h.code === null && sketchQ.isPending && …;        // spinner "Looking for your sketch"
const start = makeStart({ starter: starter.code, own, current: h.code });
```

`makeStart` (`make-start.ts:44-48`), the precedence rule:

```ts
if (o.own === null) return { code: o.current ?? o.starter, source: "oak", choice: false };
if (o.current === null) return { code: o.own.code, source: "sketch", choice: true };
return { code: o.current, source: o.current === o.starter ? "oak" : "sketch", choice: true };
```

- Code already in the step (machine `code[stepId]`, from an edit or a return to the step in this visit) always wins.
- An effect copies the sketch into the machine as soon as it arrives (587-590), so Wrap up and Save read it.
- When a sketch exists, a callout offers "Start from Oak's copy" / "Use my sketch" (656-676); `switchTo` keeps each copy's edits in a ref (`kept`) and re-keys the Workbench with `codeKey={side}` (644).
- `ownSketchOf` (`make-start.ts:21-27`) takes the highest `version` of the sketch the server returns; the server picks the newest unarchived `lesson-make` sketch with `originId === lessonId`, by `updatedAt` (`server/src/services/library.ts:114-124`). Studio edits (`sketches.addVersion`) therefore flow into a later `fromSketch` Make. A Quick sketch also saves with `originKind: "lesson-make"` and the same `originId` (`server.ts:63-85`), so a mid-lesson wrap snapshot can become "your sketch" of that lesson.
- `useTargetMarks(editorId, starter.editable, code === starter.code, h.result)` (603) draws the dashed box on `⟪…⟫` regions of the starter until the learner edits; the Make itself is fully editable (no `readOnly` passed). Code-modify steps, by contrast, pass `readOnly: { editable }` (`inputs.tsx:335-339`): a locked-regions editor already exists in the Workbench (`EditorOptions.readOnly`, `packages/strudel/src/types.ts:104-106`).

### 2.3 Resolving the Band — `app/src/lesson/band.ts`

```ts
// band.ts:14-36
export function bandSetupOf(ref: BandRef | false | undefined, o: { flavour; key; bpm; at? }): BandSetup | null {
  if (!ref) return null;
  const def = bandById.get(ref.band);                                   // content/bands/index.ts:1441
  const flavour = def.code[o.flavour] ? o.flavour : "flavour.pop";      // flavour fallback
  const staged = bandCodeAt(def, flavour, (from) => atOrBefore(graph, from, at)); // BAND_STAGES by course position
  const code = staged.replaceAll("{{key}}", keyArg(o.key)).replaceAll("{{bpm}}", String(o.bpm)); // "C4:major"
  return { band: ref.band, flavour, code, followsLearnerKey: ref.followsLearnerKey === true,
           tracks: [...(ref.tracks ?? def.roles)] };
}
export function bandMutesOf(setup) { return ["drums","bass","chords"].filter((r) => !setup.tracks.includes(r)); } // 42-44
```

`BandSetup` (`packages/strudel/src/types.ts:79-85`): `{ band: BandId; flavour: FlavourId; code: string; followsLearnerKey: boolean; tracks: ("drums"|"bass"|"chords")[] }`. `BandRef` (`packages/content-kit/src/schema/lesson.ts:144-149`): `{ band; followsLearnerKey?; tracks? }`. The key is the LESSON's key (`def.key`), not the exercise's `key`. `{{bpm}}` is the lesson's bpm (Band code normally carries no tempo line; the learner's `setcpm` drives the shared scheduler).

Note: nothing forces `BandSetup.code` to come from `content/bands`. Any Strudel string with labelled `drums:`/`bass:`/`chords:` lines (consts allowed) works downstream.

### 2.4 What the Make's Workbench gets — `workbenchBase` (`LessonPlayer.tsx:774-835`)

- `lessonCtx: { key: ex.key ?? def.key, meter, defaultBpm: def.bpm, loopBars }`, with `loopBars = ui.loopBars ?? example.bars ?? reference.bars ?? (code-make ? ex.bars[1]) ?? (band ? 2 : 1)` (799).
- `lint: gradedLint(env)` — profile `graded`: a tool the learner has not unlocked is an ERROR and the editor refuses to run (`packages/strudel/src/editor.ts:343-353`). This matters for any design that puts Oak-written parts into the learner's editor.
- `views` from `ui.panels`, `roll.labels` from `ui.rollLabels` (with the feature-moment step-down), `staff`, `initialPanels`, `scopePanel`, `musicLenses`, `pickup`, `unit`, `lessonId`, `onModel` (tutor harmony), `variant: "compact"` when any line is longer than 56 characters.
- `band: bandOf(s)` (819).

`MakeRenderer` adds `id="l-<step>-make"`, `tutorBars`, `code`, `codeKey`, `onChange → h.setCode`, `onEvaluated → markDone (if ok) + live(outcome.code)` (638-651). It does not pass `initialMutes` / `onMutes`, so mute/solo state is local UI state only.

Inside the Workbench (`app/src/workbench/Workbench.tsx`):

- The analysed/looped length: `loopBars = max(pieceBarsOf(code, lessonCtx.loopBars), keyPlanBars(code))` (380-383). `pieceBarsOf` (`app/src/workbench/lines.ts:123-132`) reads the LEARNER's `arrange()` only (cap `MAX_PIECE_BARS = 64`). A Band with its own long form is not counted: if the song's form lived only in the Band layer, the roll would show `lessonCtx.loopBars` bars.
- `bandHeard = band.tracks minus muted band.* chips` (396) → the chord band and the analysis read only what is heard.

### 2.5 How the Band and the learner's code are combined for playback

There are four paths; only one concatenates strings.

1. Editor Run / Play (the normal case) — separate evaluation, then stack.
   - `packages/strudel/src/editor.ts:386-397`: `bandCode = bandCodeFor(band, { key: lessonCtx.key, defaultBpm, learnerCode: code })`; lint it with profile `"band"` (`allowPreview: true`, locked tools allowed); on failure a warning "The Band could not play …; your code still runs".
   - `bandCodeFor` (`packages/strudel/src/band.ts:201-240`), applied after every learner evaluation: fills leftover `{{key}}`/`{{bpm}}`; with `followsLearnerKey`, rewrites the Band's scale names to the learner's first `.scale()` (or the learner's whole key plan, `learnerKeyPlanOf`, 119-152); `followLearnerForm` (`band-form.ts:176-191`) rewrites each Band `arrange()` to the learner's section list (same order and bar counts, Band section of the same type or a kin type, `KIN` 143-155) when the learner's code has readable `arrange()` sections; last, `foldBandRegister` (78-88) moves EVERY `.scale("X<oct>:mode")` in the Band code into the Band's register (tonics F♯–B drop an octave).
   - `evaluateBand` (`packages/strudel/src/evaluation.ts:60-85`): evaluates the Band code with a private `.p` collector (it never reaches the repl's label map), keeps only labels in `roles` (= `BandSetup.tracks`), tags them `band.<label>`, drops source locations.
   - `finalizePattern` (143-156): `stack(learnerPattern, ...bandPatterns)`, then a live `filterHaps` for mutes. Mute/solo never rewrites code.
   - Track list = learner labels + `band.*` labels (`editor.ts:421`).
2. Loop region (`L`, `[`/`]`) — string concatenation. `app/src/workbench/use-loop.ts:76-78` loads `codeWithBand(code, band)` into a hidden player: `app/src/workbench/loop-math.ts:100-107` appends `bandCodeForTracks(band.code, band.tracks)` (line filter by `label:`) to the learner's code with labels renamed `drums:` → `oakbandDrums:` (`bandTrackAlias`, 78-84). This path does NOT run `bandCodeFor` (no key follow, no form follow, no register fold). If it fails, it retries without the Band.
3. Analysis (roll, chord band, staff, tutor harmony) — `app/src/workbench/use-analysis.ts:69` passes `band: bandCodeForTracks(o.band.code, o.band.tracks)` to the grader's `analyze`, which lints it as `band` and evaluates it separately with track prefix `band.` (`packages/grader/src/runtime/analyze.ts:76-141`). Also no `bandCodeFor`.
4. Key preview (circle of fifths) — `PatternPlayer.load(code, { band })` (`app/src/workbench/use-key-preview.ts:107-160`; `PatternPlayer.load` option `band`, `packages/strudel/src/types.ts:283-296`).

Consequence: paths 2 and 3 can disagree with path 1 when the learner changes key or uses sections.

### 2.6 Which tracks the Band plays (`ui.band.tracks`)

- `tracks` absent → all of the Band's `roles` (every Band today has `["drums","bass","chords"]`).
- The filter happens at evaluation (`evaluateBand`, roles), so an excluded role is not even evaluated, not merely muted, and has no mute chip.
- Distribution over all 176 Makes (core + advanced): drums 91, all (no `tracks`) 27, none (`band:false` or no band) 17, bass+chords 12, chords 11, drums+bass 10, drums+chords 4, drums+bass+chords 4.
- The saved sketch records the excluded roles as `mutes` (`bandMutesOf`), so Studio plays it the same way (Studio builds `tracks: all roles` and applies the sketch mutes as `initialMutes`, `followsLearnerKey: false`: `app/src/studio/model.ts:85-102`).
- The role vocabulary is hard-coded to three roles in: `BandSetup.tracks`, `BandRef.tracks`, `BandDef.roles` (contracts §5.10), the API's `bandState.mutes` enum (`packages/api/src/dto.ts:1584-1588`), `bandMutesOf` (lesson and Studio). A Band melody/lead/pad role does not exist.

### 2.7 Mute and solo

- `MuteMap { muted: ReadonlySet<string>; solo: string | null }` (`packages/strudel/src/types.ts:72-77`); `isMuted` (`packages/strudel/src/mutes.ts`): solo wins and silences everything else, Band included.
- Workbench state `mutes` (`Workbench.tsx:360`), `applyMutes` (962-966) → `handle.setMutes` (live filter) and `onMutes` callback. TransportBar chips (`app/src/workbench/TransportBar.tsx` ~285-318) list every track; Band tracks show as `drums (band)`. Buttons `mute-<track>` / `solo-<track>`.
- Lesson Makes never persist mute choices; the sketch's `mutes` are the step's excluded roles, not the learner's chips.
- Contract §5.10 rule 3: a learner track with the same role replaces nothing; both play unless the Band track is muted.

---

## 3. Grading and saving the Make

### 3.1 What reaches the grader

- Live checklist: `live(src)` (`renderers.tsx:607-611`) → `h.gradeQuiet({code: src})` → `gradeStep(browserGrader, env, ex, {code}, {params, attemptNo: 1, rung, extraReplays: 0, trial, trials})`. Debounced 700 ms on every code change (623-627) and on every Run (`onEvaluated`, 646-650); Mod+Shift+Enter also runs it (628-631). The result goes to the machine as `LOCAL_RESULT` (never posted).
- `gradeStep` (`app/src/lesson/grading.ts:691-739`) builds `GradeRequest { exercise, response: {code}, ctx }` with `ctx = {exerciseGlobalId: "<lesson>/<exId>", mode: "lesson", key, meter, bpm, swing?, pickup?, params, attemptNo, firstAttempt, rung, tutorHints, extraReplays, lint: gradedLint(...), profile}`. No `band`.
- The grader already supports `GradeContext.band?: string` (`packages/grader/src/types.ts:262`): `evaluateCode` passes it to the evaluator (`packages/grader/src/grade/index.ts:241`), so Band tracks would appear as `band.*` in the normalized piece. Rubric rules skip `band.*` tracks unless named (several rules take `harmony: TrackRef`, e.g. `rubric.ts:67,179,415`). Content comments confirm the gap: "the grader is not given the Band's code (neither content:check nor the app passes `ctx.band`), so `harmony: "band.chords"` reads no chords" (`content/core/U06/L05/lesson.ts:63-67`, `content/core/U07/L06/lesson.ts:8-14`). This is why most Makes moved chords and bass into the learner's starter.
- `gradeRubricPiece` (`grade/index.ts:616-718`): evaluates `max(ex.bars[1], arrangedTotal ?? 16)` bars, capped at 64 in lesson mode (`MODE_LIMITS`, `types.ts:136-140`); silent → `make.silent`; required rule(s) decide pass; `make.beyond-brief` when the piece is longer than `bars[1]` (shown as "You went past today's brief. Nice.").
- `make.unchanged` (`grade/index.ts:~1125-1145`): a `code-make` whose code equals the AUTHORED `ex.code.starter` never passes. With a dynamic starter (a `fromSketch` copy today, the song tomorrow), unchanged code is compared with the authored starter, so an unchanged own sketch that already meets the rule passes.
- UI: checklist with each rubric row (`data-rule`, `data-ok`), "(the one that counts today)" on the required one (677-707); locked-tool diagnostic (`code.locked*`) explained (717-725); error line when code did not run (726-730).

### 3.2 Save

Button "Save sketch" / "Save anyway" when the required rule is not met (744-748); never disabled by the rubric. Title field defaults to `makeTitle(ex, lesson)` = `ex.title ?? lesson.title` (`rules.ts:277-280`).

`h.save(code, title)` → `SAVE_MAKE` → `finishing` → `serverDeps.finish` (`app/src/lesson/server.ts:111-154`):

1. `result = f.result?.status !== undefined ? f.result : await o.gradeMake(f.code)` (the live result can be up to one debounce older than the saved code).
2. If `result.status !== "error"`: `steps.attempt` with `seriesNo: 0`, `response: {code}`, `result`, `idempotencyKey` per (stepId, code) — failure swallowed. This is the Make's evidence.
3. `createSketch` (63-85) → `sketches.create` with body:

```ts
{ title, originKind: "lesson-make", originId: lessonId, sessionId, code,
  bpm: lesson.bpm, meter: lesson.meter, key: lesson.key,
  analysis: null, note: null, tutorAssisted,
  band: { bandId, flavour, mutes } | null,       // mutes = Band roles the step left out
  flags: { lockedTools: [], previewTools: [] }, ranOk }
```

   Always a NEW sketch (version 1). `sketches.addVersion` (`packages/api/src/contract.ts:275-281`) is never used by the lesson. Invalidates `sketches.list`, `streak.get`.
4. `lessons.complete` with `{sessionId, sketchId, lessonVersion, contentHash: "<id>@<version>:<bundle version>", splitPart: "B"|null}` when the ID is a lesson ID. Invalidates progress, skills, unlocks, can-dos, `session.today`, `bootstrap`.
5. Machine → `complete`; player reports the `make` block; `CompleteScreen`.

Preview deps return `sketchId: "preview"` and save nothing.

Sketch data model (`packages/api/src/dto.ts`): `SKETCH_ORIGINS` (1575-1583: `lesson-make, free, capstone, transcription, tutor, keepalive, checkpoint`); `SketchSchema` (1617-1628: `id, title, originKind, originId, currentVersion, tags, archived, listeningNote, …`); `SketchVersionSchema` (1600-1615: `version, code, bpm, meter, key, analysis, note, tutorAssisted, band: {bandId, flavour, mutes} | null, flags, createdAt`). Only the Band's ID is stored, never its code: playback elsewhere rebuilds it from content (`bandCodeAt` at the learner's current stage, Studio `model.ts:94`).

Liner notes: not part of the lesson Make. They belong to album track versions (`linerNotesMd`, `AlbumTrackVersionSchema`; deterministic fallback `linerNotes()` in `packages/grader/src/analyze/piece.ts:437-470` with "Played with <band>."). Studio shows "liner flags" from a version (`app/src/studio/model.ts:290`). The album entry point is `album.createTrack` (`AlbumTrackCreateSchema`: `capstoneId | null, side: "A"|"B"|"Bside", title, flavour, …trackVersionInput` including `sketchId` + `sketchVersion`, dto.ts:1743-1749).

"Recap": two different things.
- `<Recap />` in the Make step's prose (`app/src/lesson/mdx.tsx:334-385`): objective, tools new today, practised skills, words, toolbox size. Present in 126 core lesson.mdx files. Because the Make renders `answerFirst` (`frame.tsx:140,198,222`), the prose (and the Recap) sits under the checklist. Pure display; nothing is saved.
- The session's returning Recap (`app/src/session/host/RecapCard.tsx`): after a break, plays the last sketch for 30 s through a hidden `PatternPlayer` with `bars: 8` and no Band (59-62), so a drums-only-Band sketch plays without its drums.

### 3.3 Wrap up and the Quick sketch

`WRAP_UP` (not on the Make) or the end of part A → `QuickSketch` (`screens.tsx:175-247`): a Workbench (`views: ["roll"]`) with `latestCode(ctx)`, a title, Save. `serverDeps.quickSketch` (`server.ts:155-175`) creates a `lesson-make` sketch with the Band of the CURRENT step (not the Make's), then `lessons.complete` with `splitPart: "A"` or `lessons.position` with `wrapped: true`.

### 3.4 Persistence of an unfinished Make

None beyond the tab: `context.code` is in memory. `app/src/lesson/drafts.ts:9-24` keeps only answer widgets built from picks (`form, scale-builder, bar-grid, rn-palette, staff-input, keyboard, grouping, euclid, slot-choice`), never code. `lessons.position` stores only the step ID. A reload on the Make re-opens the starter (or the `fromSketch` copy).

---

## 4. How hooks and examples are played

- Hooks are the sound-first opening `listen` steps (AUTHORING §1, line 33). `ListenRenderer` → `ListenItems` (`renderers.tsx:255-358`) unless `passive`. Each item is a read-only Workbench (`id l-<step>-<i>`, `code=item.code`, `readOnly`, `lessonCtx.loopBars=item.bars`) spread from `h.workbench`, so it plays over the step's Band through the editor path (§2.5 path 1) in the learner's flavour. 115 of 178 `listen` exercises declare a Band. Switching items auto-plays (`autoPlay={switched}`). The step completes when every item has played one full loop (`setTimeout(item.bars / cps)` after a successful evaluation, 318-330).
- Predict steps show the code as text until the guess is locked, then a read-only Workbench with the Band (`renderers.tsx:379-386`).
- `<Example id>` in prose (`mdx.tsx:95-105`) → `ExampleButton` (63-93) → `useExamplePlayer` (`app/src/lesson/audio.ts:181-214`): one hidden `PatternPlayer` per `MdxStepProvider`, `p.load(code, { bars, cps: 0 })` with NO `band`, plays 2 loops then stops on a timer. `exampleOf` (`mdx.tsx:48-52`) finds examples only in `lesson.steps[].example` (`StepExample {id, code, bars, preview?}`), not in listen items. A step's own example returns null from `<Example>` (the comment says it is the Workbench beside the prose; for prose-only steps `ProseStep` renders no stage, so 18 prose steps with an `example` show it nowhere unless the MDX uses `<Staff/PianoRoll/LeadSheet example>`).
- `<Compare a b>` (107-115): two ExampleButtons. `<Staff|PianoRoll|LeadSheet example>` (118-137, 509-511): static `CodeMusic` render plus "Hear it".
- Ear/tap/sing stimuli (`audio.ts:82-141`): `analyzeCode` then `normalize`, then `eventsToAudioPlan([...n.all, ...n.band])` on the AudioContext clock (no Band is passed, so `n.band` is empty), with optional home cue and count-in.

---

## 5. Where new song features would plug in

### 5.1 A "Your song so far" step

What exists to reuse:
- A playback surface for "the song with Oak's parts": either a read-only Workbench with a `band` (like `ListenItems`), or a hidden `PatternPlayer.load(code, { band })` (supported since Wave 4; `types.ts:283-296`).
- Data: `useLessonSketch(lessonId)` (`app/src/lib/queries.ts:443-447`) / `lessons.sketch` returns the newest sketch of one lesson. A unit-level equivalent ("the unit's song", its learner parts, which parts are whose) does not exist.

Seams, in order of how much they touch:
1. Content: a step must be content-defined. The server validates step IDs against the LessonDef (`lessons.position` 404s on an unknown step, `server/src/services/course.ts:266-272`; `steps.attempt` likewise), the route accepts only `S\d+`, and `LessonDef` allows ≤ 12 steps with minutes budgets. Options: a new `StepKind` (`STEP_KINDS`, `lesson.ts:34-53`; `STEP_EXERCISE_KINDS`, 212; `STEP_KIND_LABEL`, `model.ts:402-420`) or a flag on `listen` (e.g. `ListenEx.song: true` with `items: []`, like `passive` allows empty items).
2. Machine: nothing special if it is an ungraded step: `markDone` → `DONE` opens Continue (`canContinue` for ungraded steps is true). No machine change needed. Injecting a synthetic step at `LOADED` (`machine.ts:338-358`) is possible client-side but would break server position/telemetry.
3. Renderer: add to `RENDERERS` (`renderers.tsx:762-770`) or special-case in `LessonPlayer.tsx:1232-1237` (as the Make is). It needs the song query and a way to label sections and owners (Oak vs you). The Workbench's `FormMap`/`SectionRibbon` read sections from the analysed (learner) code; for a Band-owned form they would need input from the Band side.
4. Prose: an MDX component (`lessonMdxComponents`, `mdx.tsx:504-531`) like `<SongSoFar/>` could embed it in any step's prose instead of being a step.

### 5.2 A Make that edits one part of a multi-part song

The cleanest mapping onto today's runtime: the learner's editor holds ONLY the learner's parts; Oak's parts of the song are a `BandSetup` whose `code` is generated from the unit song (not from `content/bands`) and whose `tracks` are the roles Oak still owns.

| Concern | Where | What it means for the song |
|---|---|---|
| Starter = learner's parts so far | `makeStart` (`make-start.ts:44`), `MakeRenderer` (571-596), `codeOf`/`editorStart` (`machine.ts:189`, `model.ts:120`) | Add a "song" source beside `sketch`/`oak`. `codeOf` and `latestCode` read the authored starter, so the snapshot/tutor/Quick sketch must learn the dynamic starter too. |
| Oak's parts | `bandSetupOf` (`band.ts:14-36`), `bandOf` (`LessonPlayer.tsx:392-398`) | Replace content Band lookup with "Oak's remaining song parts". `BandSetup.code` can be any labelled code. |
| Role vocabulary | `BandSetup.tracks`, `BandRef.tracks`, `BandDef.roles`, API `bandState.mutes`, `bandMutesOf` (x2) | Only `drums|bass|chords`. A song with Oak-owned melody/lead/pad/counter-line needs the type widened end to end (`evaluateBand` itself filters by any label, so the runtime is not the blocker; the types and the API enum are). |
| Register fold | `foldBandRegister` (`packages/strudel/src/band.ts:78-88`) via `bandCodeFor` | Every `.scale("X4:…")` in Band code is moved to the Band's register (G–B drop an octave). Fine for bass/chords; wrong for an Oak melody written at its real octave. Needs an opt-out per track. |
| Key | `bandSetupOf` uses `def.key`; `followsLearnerKey` rewrites to the learner's first `.scale()` | A song with a fixed key per unit works; a learner who re-keys the song moves Oak's parts only when `followsLearnerKey`. |
| Form / sections | `followLearnerForm` (`band-form.ts:176`), `pieceBarsOf` (`lines.ts:123`) | If the learner's code has `arrange()`, Oak's Band follows the learner's sections (same type → kin type). If only Oak's code has the form, the Workbench analyses/loops only `lessonCtx.loopBars` bars and the learner's loop repeats under every section. Before U09.L02 the learner cannot write `arrange()` (locked tool → lint error), so "the learner's part only in the chorus" cannot be expressed in learner code early on without a runtime wrapper. |
| Lint | `gradedLint` in the editor (`LessonPlayer.tsx:801`), `editor.ts:343-353` | Oak parts kept in the learner's editor would be linted as graded: any not-yet-unlocked tool refuses the Run. Oak parts in the Band layer are linted with profile `band` (preview allowed). |
| Locked regions (alternative design) | `readOnly: { editable }` (`inputs.tsx:335-339`, `EditorOptions.readOnly`) | Whole song in one editor with only the learner's region editable is technically available, but tutor Apply replaces the whole text (`applyToEditor`), the graded lint covers Oak's code, the grader grades every track as the learner's (`tracks` and other rules would count Oak's parts), and the sketch would store Oak's parts as the learner's. |
| Playback paths | §2.5 | Paths 2 (loop) and 3 (analysis) skip `bandCodeFor`; with song-generated Band code that depends on the learner's form/key, they will diverge from path 1 unless unified. |
| Grading context | `gradeStep` ctx (`grading.ts:703-719`); `GradeContext.band` (`grader/types.ts:262`) | Passing Oak's parts as `ctx.band` is a small change and lets rules name `band.chords` etc. Content and `content:check` would need the same. |
| `make.unchanged` | `grade/index.ts:~1127-1145` | Compares with the authored `ex.code.starter`; a song Make needs "unchanged against the song's starting point". |
| Rubric targeting a section | `RubricRuleBase.section` (`rubric.ts:37`) | Already supports `{section: "chorus"}` and bar windows, but reads sections from the learner's code (`sectionsFromAst`); a section rule on code without `arrange()` fails `form.no-sections`. |
| Length | `MODE_LIMITS.lesson.maxBars = 64`; `make.beyond-brief` when longer than `bars[1]` | A 24–32 bar song fits; `bars` of the Make should describe the song, not today's fragment, or the "past today's brief" line fires every time. |
| Save | `serverDeps.finish` → `createSketch` (`server.ts:63-85`) | Every save is a new `lesson-make` sketch. A song that persists across the unit wants `sketches.addVersion` on one song sketch (or a new entity), plus a record of which parts are the learner's. `bandState` stores only `{bandId, flavour, mutes}`; Oak's generated parts cannot be stored or replayed by Studio/album/RecapCard without a new reference (e.g. "unit song X at stage Y"). |
| In-progress persistence | machine `context.code` only | Nothing survives a reload; a long-lived song needs server-side drafts or saving per lesson. |
| Mutes | Workbench `initialMutes`/`onMutes` unused by the Make | Owner-aware mute/solo ("hear only Oak", "hear only you") is a UI choice over existing `MuteMap`. |
| Session / Today | `reportBlockDone` (`LessonPlayer.tsx:607-628`); Today's Make row text "A short sketch with today's tools" (`app/src/session/today-model.ts:236-250`) | Copy and block semantics change; mechanics can stay. |

### 5.3 What makes the rework easy

- The Band layer is already "Oak's parts, read-only, evaluated separately, mutable per track, followed in key and form". `BandSetup.code` is just Strudel text.
- Per-step role exclusion (`ui.band.tracks`) is exactly "the learner has taken over this role", and 159 of 176 Makes already use a Band.
- `fromSketch` + `lessons.sketch` + `makeStart` is a working "continue from your earlier work" flow with an Oak-copy escape hatch and per-copy edit keeping.
- `followLearnerForm` already maps Band sections onto the learner's sections by type, with kin fallbacks (chorus↔hook↔refrain, bridge↔middle, intro↔verse …). `band.sections` (`content/bands/index.ts:1145-1152`, `SECTION_FORM` 557-558) is a ready verse/chorus Band in all four flavours.
- `PatternPlayer.load({ band })` already exists for a hidden "play the whole song" button.
- The grader already accepts a Band string and rubric rules can already target sections and bar windows.
- Machine changes are small: the Make is just "a step whose Continue is Save".

### 5.4 What makes it hard

- Three hard-coded Band roles across content-kit, strudel, api and Studio.
- Four playback paths with two different Band preparations (only the editor path follows key/form/register).
- The Workbench's length and section views follow the learner's `arrange()`, not the Band's form; `arrange()` is locked until U09.L02.
- The grader never sees the Band; harmony rules were rewritten to read learner-owned chords, so many U05+ starters contain chords and bass the learner did not write in that lesson.
- `make.unchanged` and `codeOf`/`latestCode` assume the authored starter.
- Every save is a new sketch; the sketch stores a Band by ID only; no server draft of an unfinished Make.
- Steps are content-only and server-validated, so a "song so far" step means a content/schema change (new kind or listen flag), budgets, and CI checks.

---

## 6. Per-step flags relevant to Makes and Bands

`StepUi` (`packages/content-kit/src/schema/lesson.ts:55-89`):

| Flag | Type | Runtime effect |
|---|---|---|
| `panels` | `{roll: boolean; staff: false|"treble"|"bass"|"grand"|"perc"|"lead"; keyboard: boolean}` | `viewsOf` → Workbench views (`model.ts:423-430`); `initialTabOf` "both" for roll + bass/grand (436-439); staff `perc` → percussion staff |
| `rollLabels` | `none|note|degree|degree+solfege` | roll labels (content wins over lenses); stepped down during a feature moment |
| `staffLabels` | same | staff labels; default by unit via `staffLabelsOf` (`rules.ts:258-264`) |
| `loopBars` | number | `lessonCtx.loopBars` (else example bars, reference bars, Make `bars[1]`, 2 with a Band, 1) |
| `band` | `BandRef | false` | `{ band: BandId; followsLearnerKey?: boolean; tracks?: ("drums"|"bass"|"chords")[] }`; `false` = deliberate silence. Drives the Workbench Band on ANY step (listen, predict, investigate, modify, make), the sketch's `band` and `mutes` |
| `initialPanels` | `WorkbenchPanelId[]` (`key, circle, chords, function, range, chord-tones, form, scope, spectrum`) | panels open at step start; `chords` draws the chord band (reads Band chords when heard), `form` the form map |
| `leadSheet` | `{melody?, chords: TrackRef | {chart}, title?, degrees?}` | lead sheet beside play-from-the-page steps; `chords` may be `band.chords` |
| `probe` | `{kind: filter|envelope|harmonics; track?}` | visual probe beside the sound |

Exercise-level (Make): `code.starter` (with `⟪…⟫` target marks), `code.toolbox`, `code.autoCheckOnRun`, `bars: [min,max]` (Workbench length, grading window, beyond-brief), `rubric` (one `required`; optional `section`), `fromSketch`, `saveAs: "sketch"`, `title` (default sketch title), `key`/`keyPlan`/`meter`/`bpm`/`swing`/`pickup` (grading and Workbench context; the Band's key still comes from the lesson's `key`).

Lesson-level: `key`, `meter`, `bpm` (fill the Band's `{{key}}`/`{{bpm}}`), `swing`, `pickup`, `wrapAt` (split and "stop point"), `flavours` (per-flavour band/sounds override; unused by the lesson runtime).

Contract §5.10 (`docs/design/contracts.md:1460-1497`) binds: Band code never part of the learner's code; evaluated separately as `band.drums|bass|chords`; shares tempo; key = step key or learner's first `.scale()`; grader ignores Band tracks unless a rule names one; Band may use locked tools; sketch stores `{bandId, flavour, mutes}`; every Make from U01 declares a Band unless silence is the point; a flavour never changes a rubric; starter sounds follow the unlock table. A song redesign that moves Oak's parts into the learner's editor, or adds Band roles, has to amend this section.

---

## Appendix A. Key files and functions

| File | What to read |
|---|---|
| `app/src/lesson/LessonPlayer.tsx` | `LessonPlayer` 148-271, `useStepStates` 283-306, `PlayerCore` 325-1279 (`bandOf` 392, deps 401-430, `LOADED` 467-499, block reports 607-628, `workbenchBase` 774-835, `grade` 919-961, `host` 1123-1230, renderer choice 1232-1270), `ProseStep` 1284 |
| `app/src/lesson/machine.ts` | `LessonDeps` 69-83, `LessonContext` 92-133, events 136-172, `codeOf`/`latestCode` 189-210, `LOADED` 338-358, `SAVE_MAKE` 510, `finishing` 631-666, `wrapping` 667-712, `snapshotOf` 747-769 |
| `app/src/lesson/renderers.tsx` | `MakeRenderer` 568-752, `ListenItems` 262-358, `PredictRenderer` 362-440, `RENDERERS` 762-770 |
| `app/src/lesson/make-start.ts` | `fromSketchOf`, `ownSketchOf`, `makeStart`, `makeStartNote` |
| `app/src/lesson/band.ts` | `bandSetupOf`, `bandMutesOf`, `makeBandOf`, `checkpointMakeBand` |
| `app/src/lesson/server.ts` | `serverDeps` (`createSketch` 63, `finish` 111, `quickSketch` 155, `position` 176), `previewDeps` 198 |
| `app/src/lesson/grading.ts` | `GradeEnv` 58, `gradedLint` 88, `gradeStep` 691-739 |
| `app/src/lesson/model.ts` | `visibleSteps`, `splitPartFor`, `partRange`, `startIndex`, `editorStart` 120, `canContinue` 339, `STEP_KIND_LABEL` 402, `viewsOf` 423, `keyArg` 442 |
| `app/src/lesson/frame.tsx` | `StepHost` 25-92, `StepLayout` 143-235 (`answerFirst`) |
| `app/src/lesson/mdx.tsx` | `Example` 95, `ExampleButton` 63, `ExampleMusic` 118, `Recap` 334, components 504-531 (`Make: none`) |
| `app/src/lesson/audio.ts` | `useExamplePlayer` 181-214, `playStimulus` 110-141 |
| `app/src/lesson/screens.tsx` | `CompleteScreen` 17, `QuickSketch` 175, `ReportDialog` 249 |
| `app/src/lesson/drafts.ts` | `DRAFT_UIS` 9-24 (no code) |
| `app/src/lesson/check.tsx` | `useCheck` 36-59, `CheckButton`, `StepFeedback` |
| `app/src/lesson/side.ts` | side lessons, `reportsToSession` 99 |
| `app/src/lesson/track-ui.tsx` | `LockedLine` (track lock copy) |
| `app/src/lesson/types.ts` | `StepHostProps`, `LessonStatus` (`make`), `LessonSnapshot`, `LessonEvent` |
| `app/src/workbench/Workbench.tsx` | `band` prop 146, `initialMutes`/`onMutes` 208-211, `loopBars` 380-383, `bandHeard` 396, editor creation 600-668, `setBand` 688-690, loop 765-779, `applyMutes` 962 |
| `app/src/workbench/loop-math.ts` | `bandTrackAlias` 78, `bandCodeForTracks` 88, `codeWithBand` 100 |
| `packages/strudel/src/band.ts` | `bandCodeFor` 201-240, `foldBandRegister` 78, `learnerKeyPlanOf` 119 |
| `packages/strudel/src/band-form.ts` | `followLearnerForm` 176, `learnerSectionsOf` 125, `KIN` 143 |
| `packages/strudel/src/evaluation.ts` | `evaluateBand` 60-85, `finalizePattern` 143-156 |
| `packages/strudel/src/editor.ts` | lint refusal 343-353, Band prep 386-397, `setBand` 627 |
| `packages/grader/src/grade/index.ts` | `evaluateCode` band 241, `gradeRubricPiece` 616-718, `make.unchanged` ~1127 |
| `packages/api/src/dto.ts` | sketches 1575-1665, `LessonSketchSchema` 3147, `AlbumTrackCreateSchema` 1743 |
| `server/src/services/library.ts` | `lessonSketch` 114-124 |
| `server/src/services/course.ts` | `position` 266 (step ID check), `complete` 508 (sketch must exist) |
| `content/bands/index.ts` | header 1-11, `band.sections` 1145, `SECTION_BANDS` 1277, `bandCodeAt` 1408, `bandById` 1441 |

## Appendix B. Core Make survey (lesson, Band, Band tracks, followsLearnerKey, bars, starter labels, required rule)

```
U01.L01-L09  two-chord-vamp (L08 waltz-vamp)  bass+chords      bars 1-2..4-8   starter: drums | kick,snare,hats
U02.L01-L08  two-chord-vamp                   all              bars 1-4, 2-8   starter: mel
U03.L01-L10  two-chord-vamp (fLK from L02)    all              bars 1-4..4-4   starter: mel
U03.L11      phrase-8bar fLK                  all              bars 8-16       starter: mel
U04.L01-L04  two-chord-vamp                   all              bars 1-4        starter: mel | mel,vox | keys
U05.L01-L09  axis-4bar                        drums (+bass in L01,L04,L07; drums+chords in L06)  starter: chords (bass in L06)
U06.L01-L12  axis-4bar                        drums (L12 drums+bass)            starter: chords (+bass, +mel)
U07.L01-L10  phrase-8bar/axis/two-chord/waltz drums..all                        starter: mel | chords,mel
U08.L01-L05  axis-4bar                        drums (L04 chords)                starter: chords,bass | kick,bass
U09.L01      phrase-8bar                      all              bars 8-16       starter: mel
U09.L02-L05  axis-4bar                        drums            bars 12-32/16-32 starter: chords,bass,mel (arranged)
U10.L01-L09  axis-4bar                        drums            bars 4-8        starter: chords,bass,mel
U11.L01-L06  axis-4bar                        drums (L01 drums+chords)          starter: bass,mel | gtr | chords,bass,gtr
U11.L07-L08  band: false                                       bars 12-24      starter: full kit + parts
U12.L01-L06  axis-4bar                        drums                             starter: chords,bass,mel
U13.L01-L06  band: false                                       bars 2-8..4-8   starter: kick,snare,hats,bass,chords(,mel)
U14.L01-L06  axis-4bar                        drums                             starter: gtr/pad/chords,bass,mel
U15.L01-L06  axis-4bar                        drums                             starter: chords,bass(,mel)
U16.L01-L05  axis-4bar (L04 aeolian-4bar)     drums                             starter: chords,bass(,pad),mel
U17.L01-L04  axis-4bar                        drums            bars 8-16/12-24 starter: chords,bass,mel
```

Totals over core + advanced Makes (176): Band tracks drums 91, all 27, none 17, bass+chords 12, chords 11, drums+bass 10, drums+chords 4, drums+bass+chords 4. `fromSketch` 4. Listen exercises with a Band: 115 of 178.
