# Retry and onboarding: one policy, one control, one frame

Status: **binding, built and gate-checked** (retry pass, 2026-11-15; what was built where, and every deviation from
the plan below, is §10 — it wins over §2–§7 where they differ). Written by the
design step from the two audits (retry and onboarding, run on the Wave 7 build) and the learner's first feedback from
real use, verbatim: *"Ensure the onboarding flow is consistent and intuitive. One thing I noticed is that when I get
prompted to sing a note, there's no option to retry! Allow exercises to be retried!"*

Order of authority: contracts.md (unchanged by this pass; the sentences it would need are in §8), then this document,
then ux.md. The code beats the documents. Built and tested in this step (use it, do not copy it):

| What | Where | Proven by |
|---|---|---|
| `ResultActions` (the row) and `useResultActions` (the logic) | `app/src/ui/kit/ResultActions.tsx`, exported from `ui/kit/index.ts` | `app/src/ui/kit/e2e/retry.pw.ts` (kit project), gallery `ui/kit/gallery/KitRetry.tsx` (`mountKitRetry`) |
| Label, key, lines, what a take counts for, focus rule | `app/src/lib/retry.ts` | `app/src/lib/retry.test.ts` |
| Shortcut sheet rows (Alt+R, Enter on Continue) | `app/src/ui/keys/sheet.ts`, section "Answers" | `lib/retry.test.ts`, `ui/keys/sheet.test.ts` |
| Onboarding progress in the focus header ("Step N of M · name", visitable dots, "skipped") | `ui/kit/basics.tsx` `StepRail`, `railPositionText`; `ui/shell/focus-header.ts`; `ui/shell/AppShell.tsx` | `ui/kit/rail.test.ts`, `retry.pw.ts` |
| Practice attempts on the server, first-attempt rule, drill first answer, capstone version once | migration `0010_practice.sql`; `server/src/services/retry.ts`; `services/course.ts` `attempt`, `stepState`, `capstoneCheck`; `srs-wiring.ts` `#recordTrials`; repos `lessons.ts`, `srs.ts`, `mastery.ts` | `server/src/services/retry.test.ts`, `server/src/routes/retry.test.ts` |
| API (additive) | `@oak/api` dto: `StepAttempt.practice?`, `StepState.practiceNext?`, `DrillTrialRecord.retries?` | the route tests above; `bun run typecheck` |

---

## 1. The rule

**Every judged exercise offers "Try again" after any result, and before the learner moves on.** "Judged" means Oak
asks the learner to do something and then says something about it: pick, type, write code, place notes, tap, sing, a
drill trial, a fact card, a sung resolution, a checkpoint item, a set-up measurement, an onboarding step, a capstone
check, a ladder item. "Any result" means right, wrong, accepted, revealed, saved, measured or "unclear". A retry
**never punishes**: what counts follows §3, and when the next take cannot change what was recorded the screen says
so in one line.

Nothing moves the learner past a result by itself. Where a surface advances today on a result, it stops at the result
and waits for Continue (§2.5).

## 2. The control

### 2.1 One label, one place, one key

- **Label: "Try again".** Exactly these words, on every surface, for every kind. Not "Retry", "Check again", "Sing it
  again", "Tap it again", "Sweep again", "Measure again", "Try the three notes again", "Start a fresh try",
  "Retake it". (Auditions stay what they are and are not retries: "Hear it again", "Hear the answer". "Try a new one"
  stays: it changes the question, §3.1.)
- **Place: immediately before the primary action, in one right-aligned row; the primary is the last (rightmost)
  button.** The pair never wraps apart, so the primary does not move when Try again appears. Other secondary actions
  (auditions, "Set up later", Back in onboarding, "Report a grading problem") sit at the left of the same row and wrap
  above it on a narrow column. This is `ResultActions`; no surface draws its own pair.
- **Key: `Alt+R`** (shown `⌥R` on macOS, `Alt+R` elsewhere). Free in every scope of contracts §11.9 and the sheet:
  plain `R` (drill replay, Workbench roll) and `Shift+R` (Roman numerals lens) are taken; Strudel and CodeMirror bind
  `Alt+Q`, `Alt+W`, `Alt+A`, `Alt+I`, `Alt+L`, `Alt+U`, never `Alt+R`. It is read from the physical key (`KeyR`), so
  Option+R typing "®" on macOS still works. It is a global binding allowed in inputs (it works from the editor and
  from a pad) and acts only while a Try again is shown and enabled. **Only one row on screen binds it** (the
  `shortcut` option; a gallery or a list of past results passes `shortcut={false}`).

### 2.2 How it looks, per state

| State | Try again | Primary | Line under the row |
|---|---|---|---|
| Before a result | hidden | the surface's own action in the primary place (`action` prop: Check, Save answer, Play the note, Start …); Continue, if shown, is held | none (or the held note) |
| A check is posting | shown, disabled (`retryDisabled`; `resultKey` kept) | held | none |
| A take or measurement is running | hidden (`resultKey` null: the new take replaces the result); a secondary **Stop** in the left group | held | none |
| Result, Continue open (right; accepted; measured; any result once something counts) | secondary button: ↺ icon, "Try again", key cap ⌥R | **Continue**, primary (green) | the practice line when §3 says practice |
| Result, Continue held (wrong, nothing counts yet) | secondary, **has the focus** | Continue drawn as a secondary, disabled, its reason in its tooltip and under the row | none |
| After a reveal, step not passed | as above | held until a pass | `REVEALED_LINE` |
| Checkpoint item saved | shown | "Next item" | `CHECKPOINT_LINE` |
| Set-up measurement shown | shown | Continue | `MEASURE_LINE` when one is already saved |

One green primary per state: a held Continue is drawn secondary (the kit does it). Lines, from `lib/retry.ts`:

- `PRACTICE_LINE` — "Practice: this try does not change your result."
- `REVEALED_LINE` — "Answer shown: a pass now finishes the step but does not count as known."
- `CHECKPOINT_LINE` — "Your last saved answer is the one that counts."
- `MEASURE_LINE` — "A new measurement replaces this one only if it works."

Use `retryLine({ surface, counted, revealed })` to pick it; never write another sentence for the same idea.

### 2.3 Screen readers

The button's accessible name is "Try again" (the key cap is hidden from the name), `aria-keyshortcuts="Alt+R"`, and
`aria-describedby` points at the practice line when there is one. The line is `aria-live="polite"`. The verdict
itself stays the surface's own `role="status"`.

### 2.4 Focus

When a new result appears (`resultKey` changes to a new non-null value) the focus lands:

1. nowhere new if it is in the code editor or a text field (the learner fixes the answer there; `Mod+Shift+Enter`
   checks, `Alt+R` still works);
2. otherwise on **Continue** when it is open — so **Enter continues**, and Try again is `Shift+Tab` or `Alt+R` away;
3. otherwise on **Try again** — so Enter tries again.

After Try again the surface's `retryFocus()` element gets the focus: the pad or the first option (pick kinds), the
editor (code kinds), the take's own start or the live take (sing, tap, measurements). Focusing Continue scrolls it
into view, which also fixes "Continue below the fold" (onboarding audit, latency).

### 2.5 What Try again does, and what replaces automatic moves

- **Try again clears the verdict and re-opens the same question with the same params** (contracts §5.5: a retry
  inside the series keeps the values). The answer widget is locked while a verdict is on screen; changing the answer
  is done through Try again, so a verdict never sits beside a changed answer (retry audit, lesson row 1).
- For a take (sing, tap, measurement) Try again starts a new take at once: no extra Start press.
- **Continue** goes on; it is the primary and the focus target. Surfaces that bind Enter themselves (lesson prompt,
  drill feedback) pass `continueKeys="Enter"` so the cap is drawn.
- Replaced automatic moves:
  - **Onboarding first sing** ends the take the instant the live grade reaches credit 1. Replace: the take runs its
    window (the note's held part plus 1 s, at most the current 12 s), then shows the result with Try again.
  - **Onboarding edit → react**: a successful run moves to "react" at once. Keep the move (react *is* the result of
    edit) and give react the row: Try again focuses the editor on the boxed number; each successful run there
    replaces the learner's number (§7, item 7).
  - **Drill single-pick pads auto-submit** on the first press. Keep (response time is part of the grade, §7.2), but
    the feedback now has Try again; it never auto-advances (it does not today: keep it so).
  - **Lesson "listen" steps** complete after one loop: not judged, unchanged.
  - **Checkpoint dev hook** `__oakCheckpoint.answer` advances; it is a test hook, unchanged.

## 3. What a retry counts for (inside the contracts)

### 3.1 Lesson steps (server-decided)

The server classifies every graded attempt (`server/src/services/retry.ts` `countAttempt`):

| The attempt | Counts as | Evidence (§7.5) | SRS (§7.2) | Step attempts, results, best score | Test-out (§9.5) |
|---|---|---|---|---|---|
| first graded attempt **in the step** | first | 1.0 at `adjustedScore` | the step's rating, if it seeds or reviews a card | updated | yes, on a pass with no hints |
| after a fail, step not passed | retry | 0.3 at `adjustedScore` | none | updated | no |
| after a reveal, step not passed | retry at rung 4 (×0, §5.3) | 0.3 at score 0: **never counts as known** | none | updated | no |
| any attempt once the step has **passed** | **practice** | none | none | **unchanged** (only `step_state.attempts` +1) | no |
| any attempt in a **completed lesson** (replay, Looking back) | **practice** | none | none | unchanged (attempts +1) | no |
| a second `predict` answer | **practice** | none (the first gave 0.5) | none | unchanged (attempts +1) | no |

- "First" is first in the step, not first in the series. **"Try a new one" never earns a second first attempt** (it
  did before: attempts reset to 0, so a new series gave 1.0 evidence and a second SRS rating).
- A wrong practice take never writes a 0: "a retry never punishes" is true on the server, not only in copy.
- The voicing gate still reads every graded, unrevealed attempt of its exercise, practice included (contracts §3.1
  rule 6 is an unlock, not mastery): "Start a fresh try" after a revealed gate check can still open the gate.
- `StepState.practiceNext` says, before the take, that the next attempt will be practice; `attempt.practice` says it
  after. The client shows `PRACTICE_LINE` from `practiceNext` (and `REVEALED_LINE` when `rung === 4 && !passed`).
- Make steps (`code-make`, `compose-brief`): the live check on Run is never posted (unchanged); a posted check after
  the Make passed is practice (no second rubric evidence).

### 3.2 Checkpoint items (§7.6)

- Before "Hand it in", Try again re-opens the item and **the last saved answer is the item's answer** (`record`
  already keeps one per idx). No verdict is ever shown before hand-in, so an item cannot be repeated "until right":
  the learner never learns which answer is right. Hints and the tutor stay off.
- The learner may go **Back** to an earlier item before hand-in (allowed by §7.6: the score is the hand-in), and the
  review screen lists every item with "Change" (= Try again on that item). Skipped items can be opened again.
- Sung and tapped items are level-setting only and never in the pass score: a take may be taken again; the last take
  is the item's take. Per-note credits drawn after a take stay (they cannot change the pass).
- After hand-in nothing in that attempt can change: a second submit is refused (409, already so; proven in
  `routes/retry.test.ts`). **The retry of a checkpoint is the retake** on a later day with new items (§7.6, §9.6: a
  retake is another session). A failed checkpoint's breakdown offers its repair sets; no per-item retry after hand-in.

### 3.3 Drill trials, sung resolutions, fact cards

- **A trial's first answer grades the card** (§7.2: the set's rating is the mean credit of its trials). Try again
  re-opens the same trial (same seed, key, register, instrument) for a **practice take**: the verdict is shown, it is
  never recorded as `credit`/`correct`. The record carries `retries` (telemetry). The server keeps the first stored
  answer of an index whatever a re-post says (`keepFirstAnswer`): only a sung resolution not yet stored and the
  practice count are taken from a later post.
- **Sung resolution** ("Sing it home"): the first take is the resolution (`sungResolution`, feeds
  `fam.deg.resolve`, §8.3); Try again is a practice take (drawn, graded, not sent). `Shift+S` still skips.
- **Sung and tapped trials**: the take is graded when captured (the first take is the answer); Try again is a
  practice take.
- **Fact cards**: the first answer is the one `POST /srs/review` (one per card per sitting); Try again lets the learner
  answer again and see the verdict, posts nothing. "Flip the card" is a reveal: the card is Again (§7.2); Try again
  after it is practice.
- A whole set: Practice already has "Another set" (a new session; unchanged). Warm-up sets have no "again": the warm-up
  plan decides the next set; a family can be practised from Practice.

### 3.4 Sung and tapped takes in lessons and set-up (§8)

- Any take can be repeated. **In a lesson step the counted take is the one posted by the first Check that counts**
  (§3.1); later takes are practice. Practice takes **do not feed the tolerance ladder** (§8.2 counts the takes that
  count, not the best of many): `voice.recordStep` runs only for counted attempts (built).
- **Set-up measurements** (headphones L/R, noise floor, bleed, range, tap and sing latency, pitch match): every
  result has Try again; **a new measurement replaces the saved one only if it succeeds** (an "unclear" take never
  overwrites a good one). Each measurement is one `POST /profile/calibration`, as now.
- **The onboarding first sing** (§8.1 rule 8): after a pass the step stays passed (Continue open) whatever a later
  take does; later takes are practice and say `PRACTICE_LINE`; only the first passing run is saved with `first: true`.

### 3.5 Quiet mode and no microphone (§8.5)

Fallbacks are judged surfaces too: an `identify` fallback has Try again like any pick; "hear it in your head, then
press Space" has no verdict (self-report) and no Try again. Singing never gates: Continue/"Skip" stays open on every
sung step whatever happens.

### 3.6 Capstone checks and ladder items

- "Check my track" may be pressed any time; **a version's rubric rules count once** (1.5 per rule, §7.5): a re-check
  of a version that already gave evidence stores `lastResult` and gives none (built; this closes the farm the retry
  audit found). "Check my track" keeps its name (it is the check itself); once a verdict is shown in the panel the row
  gets Try again, which re-runs the check on the current code.
- Ladder and song panels: "Check again" becomes "Try again"; evidence and otherWork stay the stage's first graded,
  unrevealed answer (already so); later checks are practice and say so.

## 4. What is recorded, and the guard against double posts

| | Practice take | Counted take |
|---|---|---|
| `step_attempts` row | yes, `practice = 1`, with its grade, rung and code | yes |
| `step_telemetry.attempts` | counts every Check, practice included (it measures effort, §9.7) | yes |
| mastery evidence, SRS rating, test-out, tolerance ladder | **no** | per §3.1 |
| `step_state.attempts` (graded attempts in the series; one learner action, one count) | +1 | +1 |
| `step_state.passed`, `exercise_results`, `lesson_progress.best_score` | **unchanged** | updated |
| checkpoint score, streak, sessions, map advance | never touched by any retry | — |
| drill trial record | `retries` +1 only | the first answer |

Double posts:

- **Lesson**: Try again only clears the verdict and re-opens the widget; the next Check goes through the machine's one
  `SUBMIT` path (its `attemptKeys` key per `[exercise, version, seriesNo, params, response]`, and the server's
  idempotency key). No surface posts from the retry handler itself.
- **Drill**: the runner re-sends `records[index]` with `retries`; the server keeps the first answer (built), so a
  re-post can never change the set's rating.
- **Fact card**: one `POST /srs/review` per card, at its first answer; the retry handler never posts.
- **Checkpoint**: local records replace by idx; one hand-in; a second hand-in is refused.
- **Set-up**: each successful measurement is one calibration run; Try again starts a new measurement, it does not
  re-send the old one.

## 5. Every surface: the change and its owner

Owners: **L** = lesson engineer (`app/src/lesson/**`, `app/src/answers/**`, `app/src/capstone/**`), **P** = practice
engineer (`app/src/drills/**`, `app/src/routes/practice*`, `app/src/transcribe/**`), **O** = onboarding engineer
(`app/src/onboarding/**`, `app/src/voice/**`). Line numbers are the audit's (Wave 7 commit).

| # | Surface | Today | Change | Owner |
|---|---|---|---|---|
| 1 | Lesson steps, every pick/type/place kind (choice, degree/quality pads, rn-palette, text, number, keyboard, staff, grid, slots, form, bar-grid, scale-builder, grouping, euclid, click) | retry only by changing the answer and pressing a secondary "Check"; verdict stays beside a changed answer | `ResultActions` in the StepFooter's action row: `action`=Check before a result; after a result Try again (clears `h.result`, unlocks the widget, focus the widget) + Continue; `line` from `practiceNext`/rung. Widgets disabled while a verdict shows (`disabled: h.checking \|\| h.review \|\| h.result !== null`) | L |
| 2 | Lesson code kinds (code-modify, code-fill, parsons, error-hunt, code by-ear, transcribe-step) | auto-check on Run until passed; Check | same row; Try again clears the verdict and focuses the editor (code stays). Auto-check on Run stays until passed | L |
| 3 | by-ear parts, staged dictation, `all` steps | per-part/stage re-check; quiet | stage checks stay as they are (inner, quiet); the step's row as #1 | L |
| 4 | predict (choose/count) | "Lock in my guess" disappears; locked | after the reveal of the outcome, Try again re-opens the guess as practice (`practiceNext`); the first guess is the 0.5 evidence | L |
| 5 | predict hum | "Hum it again" | label "Try again" in the row; ungraded as now | L |
| 6 | tap (lesson) | "Tap it again" then Check | Try again re-arms the pad and starts the count-in (one press) | L |
| 7 | sing (lesson, mic) | "Sing it again" then Check | Try again starts a new take; Continue/"Skip singing" stays open (never gates) | L |
| 8 | sing fallback (identify) / inner hearing | as pick / self-report | #1 / unchanged | L |
| 9 | Looking back (Alt+←, rail) and lesson replays | locked ("Looking back", Check disabled) | open as practice: the step works as #1 with `PRACTICE_LINE` from the first take (server marks practice; `review` no longer disables widgets) | L |
| 10 | "Try a new one" / "Start a fresh try" | resets attempts and rung | unchanged on screen; the server no longer gives a second first attempt (built) | L |
| 11 | Make (code-make, compose-brief) | Save completes | unchanged (not a judged retry); a re-check after a pass is practice (built) | L |
| 12 | Checkpoint items | "Save answer", "Answer saved…", no Back | row: `action`="Save answer" before a save; after a save Try again (re-opens the item) + "Next item", `CHECKPOINT_LINE`; Back to earlier items; review screen with "Change" per item; skipped items reopenable; hand-in once | L |
| 13 | Capstone "Check my track" | any time; rubric farm | row after a shown result; server counts a version once (built) | L |
| 14 | Drill trials, single-pick pads | auto-submit; feedback: "Hear it again R", "Hear the answer A", "Next Enter" | feedback row: auditions left, Try again + "Next trial" (Enter); Try again re-opens the trial as practice (`retries`+1, record untouched; machine: new `RETRY` from `feedback` to the answering state of the same trial with a `practice` flag) | P |
| 15 | Drill multi-answer, slots, code, staff, staged | trial SUBMIT final; inner stages retry | as #14 after the trial's SUBMIT | P |
| 16 | Drill tap and sing trials | `CAPTURED` → feedback, no retake | as #14: Try again starts a practice take | P |
| 17 | FET sung resolution | `resolution.done` accepts only NEXT | Try again: a practice take of the path (not sent); first take stays `sungResolution` | P |
| 18 | Warm-up fact cards | "Next card" only | Try again after any answer (and after "Flip the card"): answer again, see it, nothing posted | P |
| 19 | Mic error mid-trial | "Try again" (REPLAY) / "Skip singing" | already the label; move into the row | P |
| 20 | Ladder items, song/standard panels | "Check again" | label "Try again" in the row; practice line after the first graded answer | P |
| 21 | Gym rhythm lab, jazz chart | local check | the row; local only | P |
| 22 | Onboarding first sing | no retry after a pass; take cut at credit 1 | §7 items 1–2 | O |
| 23 | Pitch match, range sweep | "Try the three notes again", "Sweep again" | the row, label "Try again" | O |
| 24 | Tap and sing latency | no retry once done | the row per half; implausible results are "unclear" (§7 item 3) | O |
| 25 | Mic: quiet check, bleed check | no retry when OK / never | the row in each sub-step; "Set up later" in every sub-step | O |
| 26 | Headphones L/R | "Play it again" + answer again | the row ("Hear it again" stays an audition) | O |
| 27 | Edit / react (first loop) | react: edit in place; retry discarded | the row on react; the last run is the learner's number | O |
| 28 | Settings › Voice set-up (same parts) | as 22–26 | inherits the parts' row (context "settings") | O |

## 6. Onboarding: one frame for every step

### 6.1 The frame (every step, top to bottom)

1. **Focus header** (exists): "‹ Today" at the left; at the right the progress: **"Step 8 of 13 · Microphone"** in
   text, then the dots. Done dots are links (visit a finished step); the current dot is marked; a skipped or
   Quiet-passed dot reads "skipped" to screen readers (not "to do"). The mic step adds its sub-step: "Microphone · 2
   of 3: a quiet moment".
2. **Title**: one `h1` per step, in the same size on every step (the set-up parts render `h1` in onboarding, `h2`
   in Settings), and **the same name** in the rail, the heading and the Back label (table §6.3).
3. **Instruction**: one sentence under the title saying what to do now ("Sing the note back and hold it.").
   Explanation, privacy lines and tips go below it in the body, never instead of it.
4. **Body**: the stage (workbench, meter, pitch lane, cards).
5. **Status line**: the result or the problem, in one callout directly above the footer (`role="status"`).
6. **Footer = `ResultActions`**, sticky to the bottom of the viewport when the step is taller than the screen:
   left group **[‹ Back: <previous step name>] [Set up later]**; right pair **[Try again] [primary]**. Before a result
   the primary place holds the step's start action (`action`). Back is absent on Welcome and on the first loop; the
   coda has Back to Sketch 001.

`Enter` activates the primary because the focus is on it (§2.4); onboarding never binds a page-wide Enter (pickers and
the editor own Enter).

### 6.2 Words (one verb per action, every step)

| Action | Words |
|---|---|
| begin a measurement or a take | **"Start"** + what: "Start sound", "Start the ear test", "Start the quiet check", "Start the speaker check", "Start the sweep", "Start tapping", "Start singing", "Start the note" |
| give the browser permission | "Allow the microphone" (the only other start verb) |
| while it runs | the button is replaced by "Listening…" / "Measuring…" and a secondary **"Stop"** (Esc) |
| do it again after any result | **"Try again"** (⌥R) |
| hear the stimulus again | **"Hear it again"** |
| go on | **"Continue"** (the coda: "Done for today") |
| leave a step for later | **"Set up later"**, on every skippable step and every mic sub-step; never "Continue without the tutor", "Continue without a mic", "Measure singing later" |
| go back | **"Back: <step name>"** |

Plain words first, the number second, no audio or music jargon on set-up screens: "Room noise: quiet (−71 dBFS)" →
"Your room is quiet enough." with the number in the details; "bleed" → "speaker sound in the mic"; "C4 −2¢" →
"You're on the note"; range "A2–E4 (comfortable D♭3–D♭4)" → "Your comfortable range is about an octave, low to
middle" with the note names in the details. No music lenses on onboarding workbenches (`lenses={null}` on LoopStage
and SketchScreen).

### 6.3 Steps and their states

Names: the rail label = the `h1` = the Back label. Proposed `STEP_META` labels in the right column.

| Step | Name (rail = h1 = Back) | Ready | Running | Result | Problem / no mic / Quiet | Skip |
|---|---|---|---|---|---|---|
| welcome | Welcome | instruction + **Start sound** (autofocus); the header's "press any key" hint hidden on this screen | spinner on Start sound + progress | moves to the loop (no judgement) | load error callout, Start sound again | no |
| loop | Your first loop | the build-up plays at once | musicians enter (5 bars); Continue held with "Listening to the build-up…" for ≤ 13 s, focus moves to Continue when it opens | Continue; "Hear it again" restarts the build-up | — | no |
| edit | Change one number | the boxed number is the only box drawn (no playback highlight boxes on this screen); Run it / ⌘↵ | — | a valid run → react | unchanged / invalid number: status line, Try again focuses the box (re-marked after every change) | no |
| react | What you changed | — | — | reaction line + row: Try again (editor on the box) + Continue; each successful run replaces the number | — | no |
| prefs | Your sound and your week | choices with defaults | — | Continue | — | no |
| tutor | Your tutor | Ask (once per click, re-askable) + Continue; panel opens without re-centring the page | streaming | Continue | not connected: line + Continue + Set up later | yes |
| headphones | Headphones | **Start the ear test** | tone plays | "Left/Right" answered → row: Try again (play and answer again) + Continue; Bluetooth/AirPods line per contracts §8.6 | no output device: line + Set up later | yes |
| mic | Microphone (1 of 3 permission, 2 of 3 a quiet moment, 3 of 3 speaker check) | Allow the microphone | listening meter | each sub-step: row Try again + Continue | denied / no device / hears nothing for 8 s: status line + **primary "Set up later"** (→ Quiet mode, said in the line) + Try again; a voice in the room on 2 quiet checks: **"Use this room anyway"** as primary | yes, in every sub-step |
| range | Your voice | **Start the sweep** | Listening… + Stop | row; a saved range hides "Set up later" (Continue is the way on) | unclear: Try again primary-focused + Set up later | yes |
| latency | Timing (1 of 2 tapping, 2 of 2 singing) | **Start tapping** (one green primary at a time: the singing card's start is secondary until tapping is done) | Measuring… + Stop | row per half; Continue visible without scrolling at 1280×800 | fewer than 4 taps → "Not enough taps to measure" + Try again (never the raw RangeError); sung latency < −30 ms or > 400 ms → "unclear" + Try again; Quiet: tapping only, no second card | yes |
| first-sing | Your first note | **Start the note** | the note plays, then "Listening…" for the window (§2.5) + Stop | "That note is 1: home." + row: Try again + Continue + "Hear it again"; later takes say `PRACTICE_LINE` | missed: status line, Try again focused + Set up later; **Quiet: a listening version** ("Hear the note. That note is 1: home." + Continue), never silently passed over | yes |
| sketch | Sketch 001 | editor + **Save as Sketch 001** in the footer's primary place | — | saved → coda | save error line + Try again | no |
| coda | Done for today | summary + **Done for today** | — | Today | — | no; Back: Sketch 001 |

### 6.4 Paths that must never dead-end

- **No microphone device / denied / hears nothing**: the mic step's primary is "Set up later" (Quiet mode, said in
  the line); range is passed over; latency keeps tapping; first-sing becomes its listening version; the coda lists
  "Mic: set up later in Settings › Voice".
- **A room that is never quiet**: after two voiced quiet checks the primary becomes "Use this room anyway" (saves the
  measured floor, flags it) with Try again and Set up later beside it.
- **Quiet chosen up front, then Back to the mic and Allow**: range and first-sing are offered again (not left
  "skipped"): `applyDone` on `mic` with Quiet off moves the frontier to range.
- **AirPods**: the headphones result says contracts §8.6's line; tap floor 70 ms is said on the latency result.
- **Reload or Back mid-step**: every part opens in its **result state** when the profile already holds its measurement
  (output kind, noise floor, bleed, range, tap/sing latency, first-sing run) with the row (Try again + Continue); the
  mic resumes at its first unmeasured sub-step; a take or measurement interrupted by a reload restarts at Ready.
  Browser Back mid-take leaves to the previous step and closes the mic (already so).
- **Leaving mid-way**: Today's card says "Carry on setting up · Step 8 of 13: Microphone" with **Continue**, never
  "Begin" (needs the session owner, §8).

### 6.5 Ordered fix list (O unless marked)

1. **First sing** (`app/src/voice/parts/FirstSingPart.tsx` 87–125, 183–215): grade at the end of the window, never
   stop at credit 1; result row with Try again + Continue + "Hear it again"; Set up later in every non-running state;
   practice line after a pass; `first: true` only on the first passing run; the lenient pass needs the sustained part
   (coverage ≥ 0.4 for 600 ms, §8.1 rule 8), not blips.
2. **One footer for every part** (`voice/parts/common.tsx` `PartFooter` → `ResultActions`; `PartFrame` renders `h1`
   in onboarding): Headphones, Mic (three sub-steps), Range, Latency (two halves), Pitch match, First sing. Running
   state: "Listening…/Measuring…" + Stop. No "Try again" on a first attempt in progress (LatencyPart 209, 243;
   RangePart 169; FirstSingPart 205).
3. **Implausible measurements are "unclear", never saved** (`LatencyPart.tsx` 109–112 catch the RangeError →
   tapVerdict "Not enough taps"; `voice/logic.ts` 79–90 sing latency < −30 ms or > 400 ms → unclear).
4. **No dead end in the mic step** (`MicPart.tsx` 284–305, 380–466): Set up later in every sub-step, a real primary
   on denied/no-device, "Use this room anyway" after two voiced checks, a hint after 8 s of silence.
5. **Results survive reload and Back**: each part hydrates its result from `profile`; mic resumes at its first
   unmeasured sub-step; Range's "Set up later" hidden once a range is saved (`RangePart.tsx` 154; `machine.ts`
   `applySkip` must not mark a step with a saved result as skipped).
6. **Focus and Enter**: the kit does it for every row (§2.4); fix the loop's Continue (`LoopStage.tsx`: move focus
   when it enables) and tutor Ask/headphones Play (focus stays on the control or moves to the row).
7. **React's retry counts** (`OnboardingFlow.tsx` 220–222, `machine.ts` 42): every successful run on react records
   the number (`DONE edit` re-applied, or a new `EDITED` event setting `firstEdit`); sketch and coda follow it.
   Re-mark the editable slot after each change (`LoopStage.tsx` 161–173); hide playback highlight boxes on edit/react;
   "in the box" copy true again (272).
8. **Words and primaries** (§6.2): Start/Try again/Set up later/Back everywhere; one green primary per state (latency
   cards); the footer is the only place for the primary (loop, edit, react, sketch move theirs down).
9. **Progress** (`flow.ts` `railOf`, `OnboardingFlow.tsx` 120): `railOf` marks skipped steps `"skipped"` and the
   current step's `sub` ("2 of 3: a quiet moment"); call `useFocusHeaderContent("Hello, Loop", rail, { position:
   true, onVisit: (id) => send({ type: "VISIT", step: id }) })`; one name per step (§6.3).
10. **Jargon off** (`LoopStage.tsx` 282–297 and `SketchScreen.tsx` 122 pass `lenses={null}`; MicPart, RangePart,
    CodaScreen copy per §6.2).
11. **Quiet-mode first sing** as a listening step (`flow.ts` 83–97: `first-sing` no longer `needsMic`; the part
    renders its Quiet version).
12. **Tutor step** (`TutorScreen.tsx` 88–91, 155): keep the onboarding thread after the step (or close the panel on
    leaving); no re-centring; Ask can be asked again.
13. **Coda** (`CodaScreen.tsx` 156–159): Back to Sketch 001; "next time" must not repeat what onboarding just set up
    (see §8 request); no "dBFS".
14. **Welcome**: the header's "Sound asleep — press any key" is hidden on Welcome (the button says it).

Built in the kit for item 9 (use it; the kit is not edited by the builders): `RailStep.state` has `"skipped"`
(dashed dot, read "skipped"), `RailStep.sub`; `StepRail` takes `position` (the visible "Step N of M · name · sub",
`railPositionText`) and `onVisit` (done and skipped dots become buttons "Go back to N. name (done)");
`useFocusHeaderContent(title, steps, { position, onVisit })` carries both to the focus header
(`ui/shell/focus-header.ts`, `AppShell.tsx`). Specimen in `KitRetry.tsx`, proven in `retry.pw.ts` and
`ui/kit/rail.test.ts`. Nothing else in the kit changes for onboarding.

## 7. The shared control's API (for the builders)

```tsx
import { ResultActions } from "../ui/kit";            // or useResultActions for a bespoke layout
import { retryLine } from "../lib/retry.ts";

<ResultActions
  resultKey={attempt?.id ?? null}                      // new value per result, null while none / running
  onRetry={retry}                                       // clears the verdict, re-opens the same question
  retryDisabled={posting}
  retryFocus={() => widgetRef.current}                  // the pad / the editor / the live take
  onContinue={next}
  continueDisabled={!canContinue}
  continueNote="Pass the check, or show the answer, to go on."
  continueLabel="Continue"                              // "Next trial", "Next item", "Done for today"
  continueKeys="Enter"                                  // only where the surface binds Enter itself
  line={retryLine({ surface: "lesson-step", counted: state.practiceNext ?? false, revealed: rung === 4 })}
  action={result === null && <Button variant="primary" onClick={check}>Check</Button>}
>
  {/* left group: auditions, Set up later, Back, Report a grading problem */}
</ResultActions>
```

`useResultActions(options)` returns `{ retryRef, continueRef, retry, retryAvailable, retryKeyLabel }` for a surface
whose row cannot be the kit's (none is expected in this pass; say why under apiNotes if you use it).

## 8. Contract text this pass would need (not edited here; for the gate)

1. §7.5 Mastery, after "Evidence weights: …": *"A retry after a pass, every attempt in a completed lesson and a
   second `predict` answer are practice: stored with their grade (`step_attempts.practice = 1`), they give no
   evidence. 'First attempt' means the step's first graded attempt in any series."*
2. §7.2 Grade map, after "Lesson steps that seed or review a card …": *"A drill trial's first answer is its credit; a
   'Try again' inside the trial is practice and changes neither its credit nor the set's rating. A fact card is rated
   once per sitting, at its first answer."*
3. §7.6, under **Other rules**: *"Before hand-in an item may be changed and re-saved, and earlier items may be
   reopened; the last saved answer is the item's answer. No verdict is shown before hand-in. After hand-in the
   attempt cannot change; the retake is the retry."*
4. §8.2: *"Graded sung notes means the notes of counted takes; practice takes (a retry after the result counted) do
   not feed the ladder."*
5. §6.6 / §7.5: *"A capstone check's rubric rules give evidence once per draft version."*
6. §11.9 keymaps, a new row: *"Results | `Alt+R` Try again after any result (global, also in the editor and pads);
   `Enter` activates Continue, which has the focus after a result."*
7. §11.11 database amendments: *"0010: `step_attempts.practice INTEGER NOT NULL DEFAULT 0`."*

Requests to owners outside the three areas: the **session** owner — Today's mid-onboarding card ("Carry on setting
up · Step N of 13: <name>" + Continue; `session/today-model.ts` 340, 463, `TodayPage.tsx` 175) and the U00.L02 copy on
Today and the coda (`content/syllabus.ts` 60–61: learner words, not the objective; and not "next time" for what
onboarding already set up) — the **content** owner for the syllabus line.

## 9. Tests (inside the budget, wave5.md §7.1)

- What a retry counts for is proven in bun tests (built: `server/src/services/retry.test.ts`,
  `server/src/routes/retry.test.ts`, `app/src/lib/retry.test.ts`). Builders add bun tests where their reducer or
  machine decides a retry: the lesson machine (Try again → idle, same series and params, widget unlocked), the drill
  machine (`RETRY` from feedback/resolution keeps `records[i]`, increments `retries`, never re-sends credit), FactSet
  (one review per card), CheckpointPlayer's record (last save wins; Back), the onboarding machine (react re-applies
  the number; Quiet-off reopens range and first-sing) and the voice logic (implausible latencies).
- In the browser, **once per kind of exercise**, not once per lesson: lesson (one pick kind, one code kind, one sung
  take in an existing lesson walk), practice (one single-pick trial, one sung resolution), onboarding (the first-sing
  retry after a pass, in the existing onboarding spec with the fake mic). The kit spec proves the row once.

## 10. As built (gate, 2026-11-15)

Where each surface's row lives, and where the build differs from §2–§7.

| Surface | Row | Try again does | Notes |
|---|---|---|---|
| Lesson steps, every kind | `app/src/lesson/result-row.tsx` `ResultRow`: the kit's `useResultActions`, drawn as `ResultActions` draws it | clears the verdict, unlocks the widget, focuses it (`answerFocus`); a take starts at once | the primary keeps its test id `continue`; a code editor stays editable and `Mod+Shift+Enter` re-checks from it while a verdict shows |
| Checkpoint items | `ResultRow` with "Next item" | re-opens the item; the last save counts (`CHECKPOINT_LINE`) | Back to earlier items, "Change" on the review |
| Pre-check takes (sing, tap, hum) | beside the take: `answers/ui.tsx` `TAKE_RETRY_PROPS` (name "Try again", ⌥R) | a new take | after a Check only the row has Try again |
| Drill trials, sung resolutions, mic error | kit `ResultActions`, `continueTestId="next-trial"` | a practice take of the same trial (`RETRY`) | the record keeps the first answer; `retries` counts |
| Fact cards | kit `ResultActions` (mounted for the whole card) | answer again, nothing posted | one review per card per sitting, kept across reloads (`drills/retry.ts` `factSitting`) |
| Onboarding and the voice parts (onboarding, Settings, lessons) | `voice/parts/common.tsx` `PartActions` around the kit row | a new measurement or take at once | one press per task; a new measurement replaces the saved one only if it works |
| First sung note | `PartActions` | a new take at once; the pass stays | during a practice take Continue is held only until it ends, and says the note already counts |
| Lesson set-up parts (U00.L02) | `PartActions` inside the step's `Setup` | as above | when one part finishes, the focus goes to the next part's primary (its pair in the row), never to its "Set up later" |
| First loop (react) | `react-actions` | the cursor on the boxed number | each successful run becomes the learner's number |
| Capstone "Check my track" | the check's notice carries the kit row (`check-result-actions`) | runs the check again on the code as it is now | a version's rubric counts once (server) |
| Ladder items L1–L4 | kit row in `LadderPanel` (`ladder-actions`) | after a fail: the verdict goes, Check comes back, the editor has the cursor; after a pass: the same item (or the passed L3 stage) opens again and its check is practice (`PRACTICE_LINE`) | after a passed stage the next stage's Check stays open beside Try again; solved: "Next item" (`next-item`) is the primary |
| Song panels L5–L6, standards L8 | kit row in `SongPanel` (`song-actions`) and `StandardPanel` (`standard-actions`) | as the ladder: the same phrase, line, stage or section opens again | a standard's form, once passed, is settled into its sections: Try again then only clears the verdict |
| Gym jazz chart and rhythm lab (local) | kit row in `GymPages` (`gym-actions`) | the marks and a shown answer go; the answer stays to be changed | the widget's own Check stays (nothing is recorded); passed: "Back to the gym" |

Kit (`ui/kit/ResultActions.tsx`) additions at the gate: `continueTestId` (a surface whose suites address its own
primary keeps it), `describedBy` (the verdict a screen reader hears with the focused button), `isEditing` (a read-only
or disabled field does not keep the focus on a result), and the first focus under StrictMode (the key is marked shown
only when its frame ran).

Left as they are, on purpose: "Try a new one" and "Start a fresh try" (a new series, §3.1); "Retake it" (a whole
checkpoint on a later day, which §3.2 makes the checkpoint's retry); the tutor's "Check again" (the connection, not an
exercise); the capstone mastering meter's "Measure again" (a reading while the track plays, not judged).

Onboarding requests from §8 done at the gate: Today's "Next time" line for U00.L02 is learner words
(`session/today-model.ts` `learnerObjective`, the coda's sentence), and Welcome's header no longer says "press any
key" beside "Start sound" (`ui/shell/status.tsx`).
