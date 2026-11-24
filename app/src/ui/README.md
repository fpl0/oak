# app/src/ui — the shared kit, shell and keys

Owner: **kit** (docs/design/wave4.md §1). Everyone else imports from here and never edits it; ask under `apiNotes`.

## Retry pass (docs/design/retry.md; use these, never a local copy)

- **`ResultActions`** (`kit/ResultActions.tsx`): the row every judged exercise shows after a result. Left: your
  secondaries (auditions, Set up later, Back, Report). Right, never wrapping apart: **Try again** (secondary, ↺, key
  cap ⌥R, `aria-keyshortcuts="Alt+R"`, described by the line) immediately before the **primary** (Continue, "Next
  trial", "Next item"; drawn secondary while held). `action` holds your Check / Start before a result. `resultKey`
  (new value per result, `null` while none) moves the focus: to Continue when open (Enter continues), else to Try
  again, never out of the editor. `retryFocus` gets the focus after Try again. Binds `Alt+R` (global, works in the
  editor and pads) while Try again is shown; `shortcut={false}` on every other row on screen. `useResultActions` is
  the same logic for a bespoke layout. Lines and labels: `lib/retry.ts` (`RETRY_LABEL`, `PRACTICE_LINE`,
  `retryLine`, `retryCount`). Specimens: `kit/gallery/KitRetry.tsx` (`mountKitRetry`), spec `kit/e2e/retry.pw.ts`.
- **`StepRail`** gains `position` ("Step 8 of 13 · Microphone · 2 of 3: a quiet moment", `railPositionText`),
  `onVisit` (done and skipped dots become buttons) and the `skipped` state; `useFocusHeaderContent(title, steps,
  { position, onVisit })` passes them to the focus header.
- The shortcut sheet's "Answers" section lists `Alt+R` (Try again) and Enter on a focused Continue.

## New in Wave 7 (use these instead of a local copy)

`TrackCard`, `TwoLaneTapPad`, `VersionSwitch`, `ExportButton`, `PartLevels`, `EuclidRing`, `PlaySlider` — all exported
from `kit/index.ts`; specimens in both themes in `kit/gallery/KitWave7.tsx` (`mountKitWave7`, screenshot- and
keyboard-tested by `kit/e2e/wave7.pw.ts`). Pure rules in `kit/model-w7.ts` (unit-tested in `model-w7.test.ts`). As
before, each piece draws and reports only: the owner measures, plays, renders and words the music.

| Piece | File | What it is for |
|---|---|---|
| `TrackCard` | `kit/TrackCard.tsx` | An advanced track as a place: `track` is the server's `TrackState`. Four states with icon + words: `open` (something to start, nothing done), `in-progress` (the next session named: lesson, checkpoint or capstone session, with minutes), `waiting` ("Waits for the unit 14 checkpoint." — the first closed gate's unmet requirement in words, `kit/lock-notes.ts` `waitsForNote`, never a count; a waiting track with no closed gate keeps the server's note), `complete` ("All 34 sessions done. Every lesson stays open to replay."). `action` drawn only when there is something to start; `focus` ("Your focus", defaults to `TrackState.focus`); progress bar + "7 of 34 sessions · 1 of 4 capstones released"; `layout="card" | "row"`; `state`/`line` overrides. Use it for Today's `trackOffers`, Progress, the Coda, the Oak's course view. |
| `TwoLaneTapPad` | `kit/TwoLaneTapPad.tsx` | Two lanes (3 against 2, clave against pulse): F taps lane 1, J lane 2 (one focus stop, `data-keyscope="tap"`), a pointer-down on a lane taps it. `onTap(lane, at)` gives the event's `timeStamp`; the owner keeps the clock and passes `targets`, `marks` ({ at 0–1, state hit / near / miss / extra: each a different shape}), `playhead`, `beats`, `note` per lane, `armed`, `idleText`. (The answers' tap pad keeps its own two-lane mode for `tap.lanes`; this one is for drills, stage H and the capstones.) |
| `VersionSwitch` | `kit/VersionSwitch.tsx` | Which version of one piece is in front (AC1's two versions, an album track's versions): radio segments with a letter badge, name and detail line; `playing` says which sounds ("…, playing" + a speaker icon); arrows/Home/End; `keyHint`; bind your page key with `nextVersion`. |
| `ExportButton` | `kit/ExportButton.tsx` | Export a WAV (carry f2): `state: ExportState` (`idle` · `rendering` with `fraction` or indeterminate, Cancel beside it · `done` "Saved X.wav (2.1 MB)." · `failed` the renderer's message + "Nothing was saved." · `cancelled`), `onExport`, `onCancel`, `what`, `disabledReason`. One `role="status"` line. |
| `PartLevels` | `kit/PartLevels.tsx` | A labelled meter row per part (A2.L05, AC2's mix): `parts: { id, label, db, target? }[]`, dB scale −60…0, the target band shaded, the level in numbers, and a part more than **24 dB under the loudest** marked "Not heard" (icon + hatched bar; `levelRows`, `INAUDIBLE_BELOW_DB`), a silent part "silent"; `role="meter"` with the row's sentence; `live`; `empty`. |
| `EuclidRing` | `kit/EuclidRing.tsx` | `x(k,n,r)` round a circle from the top, clockwise, the grid from @oak/theory `euclid` (Strudel's rotation). Hits numbered 1-based, joined by a polygon; `playStep`; `showCode` ("x(5,16,10)"). With `onChange`: one tab stop, ArrowUp/Down hits, ArrowLeft/Right rotate, Shift+ArrowUp/Down steps, Home no rotation; `controls` adds three − value + rows. |
| `PlaySlider` | `kit/PlaySlider.tsx` | A slider that plays (swing amount, a `.late()` offset, a drive): the `FineSlider` props + `playing`, `onPlayToggle` (the button and Space on the slider), `onAudition(v)` once a changed value has rested `PLAY_SETTLE_MS` while playing (a drag never restarts the sound per step), `describe(v)` for the line under it ("1.5:1: light swing"). |
| helpers | `kit/model-w7.ts` | `trackCardState`, `trackCardLine`, `trackNext`, `trackNextLine`, `trackWaitingFor`, `trackProgressText`, `trackCapstonesText`, `trackCardSummary`, `versionName`, `nextVersion`, `exportStatusText`, `levelRows`, `INAUDIBLE_BELOW_DB`, `euclidGrid`, `euclidText`, `euclidCode`, `euclidKeyValue`, `ringPoint`, `laneOfKey`, `LANE_KEYS`, `tapCountText`, `PLAY_SETTLE_MS`. |
| tree colours | `theme/palette.ts` | `TREE_COLOURS[theme]` (bg, ground, wood, grain, ink, accent, issue, acorn, `leaf.{introduced,practising,mastered}`) and `TREE_LINES` / `TREE_LINE_SCALE` (hair 0.8, fine 1.2, firm 1.5, bold 2) for the illustrated Oak — equal to tokens.css `--oak-tree-*`, `--oak-leaf-*`, `--oak-tree-line-*` (theme.test.ts); every leaf fill 3:1 on the tree's paper and ground. |

## Shell and settings (Wave 7)

- **The tracks are places.** The palette's "Jazz Harmony" opens the track's next session (a lesson, `/checkpoint/J.CP1`,
  `/capstone/JC1`), a waiting track says "waits for: U14 checkpoint passed" and leads to the Oak; the rail's Oak label
  names each open track's next session ("Jazz Harmony: next J1.L03; Advanced Rhythm: next R1.L01"); Arrangement &
  Sound joins it once its own lessons open (U09.CP), never for the side lessons; a complete track is not named there.
  `shell/course-state.ts` (`ShellTrack.session`, `card`, `waitingFor`, `trackSessionTarget`).
- **Settings › Learning › Advanced tracks**: each track as a `TrackCard` row with the way into its next session, and
  the learner's **focus** (core / an open track; `tracks.focus` + `tracks.setFocus`; says so plainly when the server
  cannot set it). **Track lenses**: the eight lenses with their state and the lesson that opens each.
- **Palette**: "Focus on Jazz Harmony" / "Focus on the core" (only once the server answers `tracks.focus`), and the eight
  track lenses ("Tensions lens: turn off", "Clave lens · Opens with the lesson “Clave Direction”."), `shell/TrackCommands.tsx`,
  `shell/track-lenses.ts`.
- **Shortcut sheet**: Shift+X, Shift+Q, Shift+D (the Workbench's rows) are locked until the lens opens — by its tool
  or by its lesson (`keys/locks.ts` `rowLock(…, completed)`), saying "Opens with the lesson “Extensions”.".

## New in Wave 6 (use these instead of a local copy)

`KeyStrip`, `DeviceCounter`, `LoudnessReadout`, `AlbumPlayerBar`, `BranchCard` — all exported from `kit/index.ts`;
specimens in both themes in `kit/gallery/KitWave6.tsx` (`mountKitWave6`, screenshot and keyboard-tested by
`kit/e2e/wave6.pw.ts`). Pure rules in `kit/model-w6.ts` (unit-tested in `model-w6.test.ts`). Each piece draws and
reports only: the owner measures, plays and words the music (`@oak/theory`, the grader's views, the server's notes).

| Piece | File | What it is for |
|---|---|---|
| `KeyStrip` | `kit/KeyStrip.tsx` | The key in force along a piece: segments as wide as their bars, every change a heavy bar line with its distance in words above it ("+2: up a whole step", never colour alone). `segments: KeySegment[]` (`text`, `startBar` 0-based, `bars`, `change`, `sounding`); `keySegments(spans, { pickup, totalBars })` turns the 1-based spans of the grader's `keyPlanView` into them, `keyChangeWords(keyDistance(...))` words a change. One tab stop: arrows, Home/End, Enter/Space picks (`onSelect`, `selectedId`); `currentBar` outlines and names the key that sounds; a narrow segment prints "D", "Em", "+2" and keeps the full name in its accessible name; `hideSingle` draws nothing for a piece in one key; `empty`. A live status line reads the whole plan ("C major, then D major from bar 33 (+2: up a whole step)"). |
| `DeviceCounter` | `kit/DeviceCounter.tsx` | Named things a piece may hold (CF-A's six devices, C7's colours), each found (with where: `barsListText` → "bars 11 and 27") or open ("Not yet": quiet, never an error), the count beside the heading against the rule's `need` ("3 of 6 · 4 needed"), one pip per item with the need marked, a `detail` line and an `action` per row, `dense`, `countText` (a rule not live yet). |
| `LoudnessReadout` | `kit/LoudnessReadout.tsx` | A calm meter with numbers for CF-A's Master step: the loudest moment before the limiter on a dB scale with the threshold marked (amber past it, never red, no flashing), what the limiter took off and in words (`limiter`: resting / touching / working → "Resting", "Catching peaks", "Working steadily"), the average level, `live` while measuring, `lines` (the owner's sentences), `empty`, `action`. `dbText` prints levels as @oak/audio's `levelText` does. Reduced motion: no transitions. |
| `AlbumPlayerBar` | `kit/AlbumPlayerBar.tsx` | One bar that plays a whole record (Side A on the finale Coda and the album): "3 of 12 · Four-Chord Song · 0:42 / 1:36", a play / stop button that names what it plays, previous / next, the track's progress. Keys on the bar: Space plays or stops, ←/→ change track, Esc stops. The owner keeps the `<audio>`, the order and the breath between tracks; it never starts by itself. `disabledReason`, `idleText`, `cover`, `actions`, `sticky`. |
| `BranchCard` | `kit/BranchCard.tsx` | A branch of the course off the core's path (an advanced track): `locked` ("Not open yet" + what opens it), `open` (gate met, nothing to start: the server's honest note, "Its first lessons are still being written."), `ready` (a lesson to start). `branchState(TrackState)` picks the state; an `action` is drawn ONLY when `ready`, so an unwritten track can never look like a way in; `more` is an always-honest link (to the Oak); `fresh` says "Opened today"; `layout="card" | "row"`; `progress` only when ready. |
| helpers | `kit/model-w6.ts` | `keySegments`, `keyChangeWords`, `keyPlanSentence`, `keySegmentAt`, `shortKeyName`, `shortChange`, `deviceCount`, `barsListText`, `dbText`, `reductionText`, `dbFraction`, `loudnessSentence`, `LIMITER_WORDS` / `LIMITER_PHRASES`, `nowPlayingText`, `playFraction`, `branchState`, `branchNote`, `branchSummary`, `listWords`. |

## Shell and settings (Wave 6)

- **Advanced tracks, honestly.** `shell/course-state.ts` reads the server's `TrackState` (`lessons.progress.tracks`),
  or the same gates from the course progress when a server does not send it. Before U13.CP nothing is said in the
  rail; afterwards the Oak's rail item and tooltip say "Jazz Harmony and Advanced Rhythm are open, their first lessons
  still being written" (never a lock or a badge: tracks are optional). In the palette a track is "Advanced track ·
  open · its first lessons are still being written" and leads to `/oak?view=course`; a lesson nobody has written yet
  says "… · still being written" and leads there too, never to an empty `/learn` page.
- **The end of the core.** Every rail destination stays, none locked or worded as an ending (`FINISHED_WORDS` is
  tested against the rail, the palette and the sheet). Once the core's lessons are done the palette asks
  `course.completion` and lists what stays open first ("Open to you · …"; a track with nothing to start: "Open,
  nothing to start yet · …", leading to the Oak).
- **Shortcut sheet.** New section "Key strip and the record"; "Staff input: rhythm" (T tie, . dot, ; triplet — a
  staff that offers them registers the same id); the applied-numeral key `/`; the form map's X and A; the music-lens
  keys Shift+I guide tones, Shift+J key ribbon, Shift+V beat grid, each locked until ANY ONE of its tools is unlocked
  (`keys/locks.ts` `WORKBENCH_KEY_ANY_UNLOCKS`, from `MUSIC_LENS_UNLOCKS`). The sheet flows in two columns that
  scroll down. `G L` resumes the lesson THIS tab left open (d21: `ownOpenSession(session.day)`), else goes to Today.
- `Kbd tone="onAccent"` for a key hint inside a primary button (AA on the accent in both themes).

## New in Wave 5 (use these instead of a local copy)

All exported from `kit/index.ts`; specimens in both themes in `kit/gallery/KitWave5.tsx` (`mountKitWave5`, screenshot by
`kit/e2e/wave5.pw.ts`). Pure rules in `kit/model-w5.ts` (unit-tested).

| Piece | File | What it is for |
|---|---|---|
| `SectionRibbon` | `kit/SectionRibbon.tsx` | The sections of a piece as labelled blocks as wide as their bars (`RibbonSection`: `tag`, `text`, `letter`, `startBar`, `bars`, `energy?`; a `FormViewSection` from `lib/form-view.ts` fits as is). One tab stop: arrows move, Home/End, Enter or Space loops the focused section (again: stops), Esc stops; a click loops. `loopTag` + `onLoop` (loopable), `selectedTag` + `onSelect` (a form answer), `currentBar` (a playhead), `pickup` (bars count from the first full bar, c4), `problem` (the tracks disagree: a sentence, never a wrong form), `empty`. Blocks under a tenth of the ribbon show their letter alone. The Workbench keeps its own ribbon on the roll's time axis; this one stands alone (a brief, a prompt, the Coda). |
| `BarGrid` | `kit/BarGrid.tsx` | A grid of bar boxes, four a line (the twelve-bar chart, a 16-bar form). `cells: { content, text?, state? }[]` with states `empty` (a slash a beat), `given`, `filled`, `met`, `unmet` (icon + words). One tab stop: arrows move a box, up/down a line, Home/End the line, Mod+Home/End the grid; `selected` + `onSelect`, `current` (playing), `lineLabels` ("I", "IV", "V"), `firstBar`. |
| `LineChart` | `kit/LineChart.tsx` | A small line chart of one series (the energy curve): SVG line and area, HTML points and labels (a run of equal labels prints once), `marked` point, one accessible sentence naming the lowest and highest points (`chartSummary`), `table` adds a visually hidden table, `empty` text. |
| `ScopeFrame` | `kit/ScopeFrame.tsx` | The frame Oak's scope, spectrum and probe curves draw in: a DPR-sized canvas, the grid at the axis ticks, HTML tick labels that thin out so none overlap (`thinTicks`), `x`/`y` `AxisSpec` (`linear` / `log`, unit, label, ticks), an `empty` sentence ("Press Play to see the wave"), `header`, `description`. `live` redraws every frame — at most 10 a second under reduced motion (wave5.md §4.4); otherwise it redraws on `frameKey`, size and theme. You draw in `draw(ctx, plot)` with `plot.x(v)`, `plot.y(v)` and the theme's `plot.colours`. |
| `ControlReadout` | `kit/ControlReadout.tsx` | One sound control, knob-less: label, its method in code (`.lpf()`), the value large with its unit ("800 Hz"), a slider on the control's own scale (`log`: a step is a half step of frequency, Shift an octave, Alt a quarter of a half step; `linear`: `step` / `fine` / `coarse`), Home/End, PageUp/PageDown, a Reset to `defaultValue`, `help`. `role="slider"` carries the real value. |
| helpers | `kit/model-w5.ts` | `barNumber`, `barSpanText` ("bars 5–8", "the pickup and bars 1–4"), `axisFraction`, `axisValue`, `axisTicks`, `unitLabel` ("1.2 kHz", "250 ms", "−12 dB"), `chartSummary` (exported from the index); `ribbonKey`, `gridMove`, `controlKeyValue`, `thinTicks` (internal, tested). |

## Shell and settings (Wave 5)

- The shortcut sheet has a section **Sections, charts and sound controls** (the kit pieces' keys). Workbench lens and
  panel keys whose tool is not unlocked yet stay listed but say when they open ("Opens with unit 9, Form.", "Opens with
  the side lesson “Waves & Harmonics”."), in the one lock wording of `kit/lock-notes.ts`, from the owners' tables (`workbench/panels.ts`, `lib/lenses.ts`) and the
  course (`keys/locks.ts`). Nothing is marked before the unlock list loads.
- The command palette lists side lessons as optional ("Optional side lesson", "Side lesson · opens after …",
  "Side lesson · done"): the server's `sideLessons.list` answer when a page loaded it, else the unlock list
  (`shell/side-lessons.ts`). It never fetches for it.
- Settings › Data lists the album's recordings (each version with a take: place, length, size, on the album or an
  earlier version) with the server's total, and the own-audio recordings that deleted projects left behind.

## New in Wave 4 (use these instead of a local copy)

| Piece | File | What it is for |
|---|---|---|
| `TransportBar` | `kit/Transport.tsx` | Play/pause with its key, clock (`position` / `duration` in s), A–B `loop` (on, range in words, key), `rate` (FineSlider, 25–100 % default, 5 % steps, 1 % with Alt), `pitch` (±12 st Nudge, optional ±50¢ fine-tune). Draws and reports only; the owner keeps the audio state and binds the keys. |
| `FineSlider` | `kit/FineSlider.tsx` | A slider with fine keyboard steps: arrows `step`, Alt+arrows `fine`, Shift+arrows and PageUp/PageDown `coarse`, Home/End. `origin` fills from a centre; `defaultValue` adds a Reset; `marks` draws ticks. `role="slider"` with `aria-valuetext`. |
| `Nudge` | `kit/Transport.tsx` | A `−  value  +` control for whole steps (semitones), naming its keys. |
| `AbSwitch` | `kit/Transport.tsx` | The segmented A/B switch with letter badges ("A Source · B Mine · A+B Both"), roving arrows, optional key hint. |
| `Checklist` | `kit/Checklist.tsx` | Lines with a state each: `met`, `partial`, `unmet`, `pending`, `running`, `revealed`, `locked`, `optional`; icon + words, never colour alone; "3 of 5 met" summary; a detail line and an action per line. |
| `VersionList` | `kit/VersionList.tsx` | Versions newest first, the open one `aria-current`, "latest" marked, ArrowUp/ArrowDown between rows, row actions beside the row button. |
| `FileDropZone` | `kit/FileDropZone.tsx` | Drop or choose a file; refuses wrong type, empty or over-limit files with a sentence; `busy` while you upload. Pass `accept={AUDIO_UPLOAD_TYPES}`-style rules and `maxBytes={AUDIO_UPLOAD_MAX_BYTES}`. |
| `MediaCard` | `kit/MediaCard.tsx` | An album track as a card (`tile` for a grid, `row` for a list): cover slot, title node (make it a Link), subtitle, meta, length, play button that names the track or says why there is nothing to play. |
| helpers | `kit/model.ts` | `rateLabel`, `semitoneLabel`, `centsLabel`, `clockLabel`, `bytesLabel`, `fileProblem`, `acceptsFile`, `checklistSummary`, `versionLabel` (all unit-tested). |

All of it is exported from `kit/index.ts`. A specimen of each, in both themes, is in `kit/gallery/KitWave4.tsx`
(`kit/e2e/wave4.pw.ts` screenshots it).

## Shell (Wave 4)

- The NavRail marks **Transcribe** (opens with `tb.feature.transcribe`, U07.L01) and **Album** (`tb.feature.album`,
  the first capstone session) honestly: before the unlock the item is quieter, carries a small lock and its
  tooltip says when it opens. Both stay reachable (contracts §7.6 rule 6: never gated). `shell/nav-state.ts`.
- The shortcut sheet lists Transcribe's keys (from `transcribe/keys.ts`) and the harmony answers' keys from any
  page; register your own section with `registerShortcutSection` (`keys/sheet.ts`). Rows with several keys may be
  written "A B C" or "ArrowRight / ArrowLeft": the sheet shows them as keys, not as a sequence.

## Rules

- Colours only from `--oak-*` tokens (`theme/tokens.css`); Paper and Bark must both read at WCAG AA.
- Every control has a visible focus ring (global `:focus-visible`), an accessible name and a keyboard path.
- Motion obeys `reduced:` (≤ 120 ms cross-fades).
