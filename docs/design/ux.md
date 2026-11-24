# Oak UX Specification v1.0 (2026-11-10)

Audience: the lead architect. This document specifies the experience, screens, components, interaction rules, visual language and copy. Technical choices already made in research are fixed inputs here. Strudel APIs quoted below were checked against the published 1.2.6 sources: `ribbon(offset, cycles)` and `arrange([bars, pat], …)` in core `pattern.mjs`; `rootNotes(octave)` (returns `{note}`) and `chord(...).voicing()` in tonal `voicings.mjs`; `n().scale("C:major")` in `tonal.mjs`.

---

## 0. Decisions at a glance

1. **Session shape.** Oak is a calm studio-classroom. One daily session (15, 20 or 25 min) runs Warm-up, then New, then Make, then Coda. Every session ends with a saved sketch. The last screen's primary button is **Done for today**.
2. **Lesson Player.** It runs in focus mode and shows one step at a time. Each lesson follows a fixed PRIMM template ordered sound → code → symbol. All music lives in one reusable component, the **Music Workbench**: code, piano roll, staff and optional keyboard, linked by stable event ids.
3. **Pitch language.** Every UI surface uses 1-based scale degrees with ♭/♯ (1 2 ♭3 … ♭7, ♯4). Code shows the bridge "n 4 = degree 5". Movable-do with do-based minor appears as a second label, on by default for sung tasks.
4. **Colour is meaning, never the only channel.**
   - The Okabe–Ito 8-colour palette maps to degrees 1–7, with the 8th colour as neutral.
   - Altered degrees keep their base colour and add a hatch pattern.
   - The functions T, PD and D reuse the colours of degrees 1, 4 and 5.
   - The degree number is always printed.
5. **Skill Map is "The Oak".** It is an illustrated tree. Leaves are concepts, coloured by FSRS recall probability. Acorns are released album tracks. Roots are rhythm. Advanced tracks form the crown.
6. **Album cover art is "Tree Rings".** Each cover is generated deterministically from the track's events, one ring per bar.
7. **Streaks are forgiving.**
   - **Rests** are banked freeze tokens.
   - A **tie** is a repair made within 48 h.
   - The week is shown as a 7/4 bar of noteheads.
   - There are no notifications and no loss-framed copy.
8. **Toolbox unlocks are real things:** functions, instruments, templates and analysis "lenses". Nothing is locked away in Studio. "Unlocked" means the tool appears in autocomplete, has docs and a demo, its lint warning goes away, and graded steps accept it.
9. **Tutor.** Claude sits in a right-side panel. Context chips show exactly what is sent. The answer policy is enforced through data: the server withholds the solution until hint rung 4. The tutor never decides pass/fail.
10. **Music-aware tutor markup.** Tokens such as `[[deg:5]]`, `[[rn:V7]]`, `[[bars:3-4]]` and `[[note:F#4]]`, plus ```` ```strudel ```` fences, render as playable chips and cards.
11. **Feedback uses progressive disclosure on a 4-rung hint ladder:** where → what → partial (A/B audio + ghost notes) → reveal. Hints change the SRS grade only, never pass/fail.
12. **Ear drills.** Each trial runs FET cadence → degree answer → sung resolution with a live pitch lane. Keys `1`–`7` always answer. Chromatic input uses the DAW "typing keyboard" layout relative to the tonic (`A W S E D F T G Y H U J K`).
13. **Mic.** The mic opens only during sing and mic-tap steps. A red **Mic live** indicator shows in the top bar. Audio never leaves the device.
14. **UI sounds** are tiny and in the current key. They come from a separate synth bus that bypasses the album recorder. They are auto-muted during ear trials, mic capture, transcription playback and recording.
15. **Keyboard-first.** Strudel bindings (`Ctrl/Cmd+Enter` run, `Ctrl/Cmd+.` stop everything) plus `Cmd+K` palette, `Cmd+J` tutor, `Space` play, `H` hint, `Enter` continue.
16. **Onboarding wow at ≤90 s.** A 4-layer loop builds up, the learner changes one number, sees it on the roll instantly and hears it when bar 4 comes round. The reaction copy is deterministic and needs no API.
17. **Desktop breakpoints.**
    - **L** (≥1440 wide): tutor docked at 360 px.
    - **M** (1280–1439): tutor is a 400 px overlay drawer.
    - Focus routes (lesson, drills, checkpoint, onboarding) hide the nav rail.
18. **Typography.** Fraunces for display, Inter for UI, JetBrains Mono for code, Bravura (SMuFL) for music glyphs in UI text. All fonts are self-hosted.

---

## 1. Product concept and emotional arc

### 1.1 Concept

**Oak — grow an ear, one ring a day.** An adult programmer with no musical training writes real music in Strudel every day. In about 10 months they can:
- compose in pop/rock/indie and jazz/soul/funk,
- transcribe what they hear into code and lead sheets,
- read staff notation.

Each session adds a ring, like a tree. The metaphor carries through the UI:
- tree = skill map,
- rings = album covers,
- rests and ties = streak,
- Coda = wrap-up.

**Design principles** (use these to settle conflicts):

| # | Principle | Consequence |
|---|---|---|
| P1 | Sound → code → symbol | Every concept is heard before it is coded, and coded before the staff appears. |
| P2 | Every screen makes music | Today plays your last sketch, Toolbox cards play demos, tutor cards play code, the album plays live Strudel. |
| P3 | One thing at a time, everything linked | Single-step player; code, roll and staff are always synchronised. |
| P4 | Honest progress | Rewards carry information. Decay is visible and fixable. No XP, no time-based badges. |
| P5 | Deterministic gates, formative AI | Graders decide; Claude explains, questions and reviews. |
| P6 | Strudel-native, keyboard-first | Strudel shortcuts and conventions, never fighting them. |
| P7 | Calm studio | Warm neutrals, colour reserved for musical meaning, quiet sounds in key. |
| P8 | Private by construction | Audio stays local; the mic indicator is always visible; the tutor's payload is inspectable. |

### 1.2 Emotional arc

Pace assumed: 5 sessions per week.

| Moment | Session # | Can do | Feels | Tree | Album / Sketchbook | Designed moments |
|---|---|---|---|---|---|---|
| **Day 1** | 1 (onboarding = U0.1) | Run a loop, change a note, sing the tonic | Wonder: "I made that change and heard it" | Acorn sprouts; one seedling leaf | Sketch 001 saved | 4-layer loop builds up; one-number edit; sung tonic closes the loop; first tool ceremony (`s()`) |
| **Week 2** | ~10 (end of U1) | Write and read 4/4 grooves with 8ths/16ths, count "1 e & a", tap rhythms back, match pitch by voice | Competence and rhythm-confidence: "I can read the drum part" | Roots spread (Rhythm), trunk bud (Pitch) | ~10 sketches; **C0 "Intro"** (drum groove) unlocked as the album's first track at session ~13 | `.bank()` unlock lets the TR-808 arrive; first daily reviews; first "rest" token earned |
| **Month 4** | ~80 (U8, C2 done) | Compose an 8–16 bar song over I–V–vi–IV with a chord-tone melody; hear and name the common pop schemas; read a lead sheet; sing degrees in key | Identity: "I'm writing songs" | Trunk solid; Harmony and Melody limbs in leaf; a few honest amber leaves | 3 tracks (Intro, First Loop, Four-Chord Song) with liner notes; ~70 sketches | `voicing()` ceremony after hand-voicing; Transcription Gym opens (after U6); first "You can now compose…" milestone |
| **Month 10** | ~210 (core done ≈ month 7.5; deep in Jazz track) | Transcribe pop bass, chords and melody from own audio; transcribe changes of public-domain standards; reharmonise with tritone subs and backdoor; write lead sheets | Autonomy and mastery: Oak is studio and gym; lessons are one part of practice | Full crown with Jazz and Arrangement limbs; acorns on most branches | 12–14 tracks (Side A complete, Side B growing); versions show growth | Album Side A release; "You can now transcribe a jazz standard's changes" milestone |

### 1.3 Core daily loop (one session)

**Time budget by target** (minutes):

| Target | Warm-up | New | Make | Coda |
|---|---|---|---|---|
| 15 | 4 | 7 | 3 | 1 |
| 20 (default) | 5 | 10 | 4 | 1 |
| 25 | 6 | 13 | 5 | 1 |

**Warm-up rules**
- The first item is always the highest-recall card, a sure win.
- Items interleave facts, perceptual families and singing.
- Perceptual families run as mini-sets of 5–10 freshly generated trials.
- When the warm-up has ≥2 perceptual sets, a 20–30 s **Just listen** interlude sits between them: passive exposure, no answer.
- Warm-up is capped at the budget. Overflow stays due, and Today offers an optional "Revive more (+5 min)".

**New**
- The main item is the next lesson, a capstone session, a checkpoint part or a Transcription Gym session (see Today priority).
- Lessons follow template L-PRIMM-9 (§3.2).

**Make**
- Make is the lesson's final Make step: a 2–8 bar sketch with a live rule checklist.
- Saving is never blocked: **Save anyway** is always available.
- If the learner leaves a lesson early, Coda offers **Quick sketch (1 min)**, which saves the current workbench as a sketch.

**Coda** (§1.5).

**Session machine** (`src/flows/session.machine.ts`, XState 5):
```
idle → warmup(itemIndex) → main(kind) → make → coda → done
         ↘ skip (0 due)      ↘ pause (place saved; resume at step)
```
- At the target minutes, a non-modal toast appears: "That's 20 minutes. Wrap up with a quick sketch?" It offers **Wrap up** (jumps to Make or Coda) and **Keep going**.
- Nothing auto-advances into another lesson.

### 1.4 Today screen (`/`)

**Purpose:** one decision, which is to start the session. The screen also shows enough state to make returning feel worthwhile.

**Layout at 1440×900** (12-column grid, 24 px gutters, content max-width 1200, nav rail 56):
```
┌──┬─────────────────────────────────────────────────────────────────────────────────┐
│NR│ Tuesday · Day 23 of practice      ♩♩♩𝄽♩○·  (weekly rhythm 7/4)      41 ⁀ streak │ 72
│  ├──────────────────────────────────────────────────────┬──────────────────────────┤
│  │ TODAY'S SETLIST (cols 1–8)                           │ NEXT UNLOCK (cols 9–12)  │
│  │ 1 Warm-up · 5 min   3 facts · 2 ear sets · 1 sing    │ .voicing()  ▮▮▮▮▮▮▯▯ 2 to go│
│  │ 2 New · U6.4 The pre-dominant · 10 min               │ ▶ hear what it does       │
│  │     Listen Predict Run Investigate See Modify Ear Make│──────────────────────────┤
│  │ 3 Make · ii–V–I groove sketch · 4 min                │ THE OAK (mini, 240px)    │
│  │ 4 Coda · 1 min                                       │ 4 leaves drying · Revive  │
│  │                                                      │──────────────────────────┤
│  │            [ Start session  ⏎ ]                      │ LAST SKETCH ▶ Sketch 037 │
│  │                                                      │ CLAUDE'S NOTE (1 line)   │
│  ├──────────────────────────────────────────────────────┴──────────────────────────┤
│  │ Other ways today:  Keep-alive (8 min) · Transcription gym · Continue C2 (2/2) · Studio │
└──┴─────────────────────────────────────────────────────────────────────────────────┘
```

**At 1280×800:** the right column is cols 9–12. The tree mini drops to 180 px and stacks under Next Unlock. Claude's note collapses to an icon row.

**Components** (`src/ui/today/`): `SessionSetlist`, `NextUnlockCard`, `TreeGlance`, `WeeklyRhythm`, `StreakChip`, `LastSketchCard`, `TutorNoteCard`, `AltPaths`.

**Main-item priority**
1. An unfinished lesson (resume at its step).
2. Checkpoint part 2, if part 1 was done ≥1 calendar day ago.
3. The next capstone session.
4. Once a week after U6, Today suggests Gym as an alternative chip.
5. Otherwise, the next lesson.

**Do something else instead** opens a chooser: next lesson, capstone, Gym, reviews only, Studio. This is the autonomy path.

**States**

| State | Trigger | Setlist content | Copy |
|---|---|---|---|
| first-run | before onboarding | → `/onboarding` | — |
| normal | — | as above | "Your setlist for today" |
| resume | lesson in progress | New = "Resume U6.4 at step 5" | "Pick up where you left off" |
| capstone day | capstone next | New = "C2 Four-Chord Song · session 2 of 2: Melody" | — |
| checkpoint | unit lessons done | New = "Checkpoint U6 · part 1 of 2" | "No hints, no rush. Part 2 is tomorrow." |
| welcome back | gap ≥3 days | Warm-up ≤6 min + "Light lesson" (the earlier lesson's Make step revisited) | "Welcome back. We'll ease in." (no gap counts shown) |
| done | session complete | Tomorrow preview + optional extras list | "Session complete. See you tomorrow." |

When the learner starts a session, the client fires `POST /api/session/warm` in the background, which warms the prompt cache.

### 1.5 Coda (wrap-up), `/session/coda`

The cards appear in sequence; each animates in about 400 ms. With reduced motion, everything appears at once.

1. **Sketch saved.** Mini-roll thumbnail, play button, auto title (e.g. "Sketch 037 · D major · 96 BPM") that can be renamed inline.
2. **Today you**, three lines. Example: "12 reviews (9 strong) · learned the pre-dominant · made Sketch 037".
3. **Can-do update.** Changed statements animate their status ("emerging → solid"). One row per change.
4. **Tree.** A mini Oak (320 px) shows the new leaves and the leaves revived today (1.5 s growth).
5. **Unlock ceremony**, if a tool unlocked (§5.1). Skippable with `Esc`.
6. **Claude's listening note.** Streams in and never blocks. Two or three sentences that must cite a bar, degree or chord. Small caption: "Claude reads your score and code — it never hears audio."
7. **Weekly rhythm.** Today's notehead fills (rest or tie glyphs where they apply).
8. **Next.** A cliffhanger card: "Tomorrow: U6.5 — The deceptive cadence". **▶ Teaser** plays a 4-bar loop that ends on V, a literal half cadence. The next session's Start resolves it to I as the warm-up begins. A goal-gradient line follows: "2 lessons → `.voicing()`".
9. **Buttons:** **Done for today** (primary, `Enter`) and *Keep playing in Studio* (secondary). Under the buttons: "Stopping here is good practice — spacing beats cramming."

### 1.6 The pull to return, without dark patterns

| Mechanism | Implementation | Evidence |
|---|---|---|
| Real due work | The FSRS due count is the reason to return; the tree shows it visually | Spacing / retrieval |
| Goal gradient + endowed progress | Unit bars start with the unit's cliffhanger teaser counted as step 1; "N lessons → tool" | Kivetz 2006; Nunes & Drèze 2006 |
| Honest decay | Leaves amber and brown as recall falls; one-click **Revive** set | Informational feedback |
| Album identity | Capstones span 2–4 sessions ("Session 2 of 3"); album slots visibly fill | Identity |
| Musical cliffhanger | Coda teaser ends on V; tomorrow begins with I | Zeigarnik-style open loop, playful and transparent |
| Tutor continuity | Today's note links yesterday's observation to today's lesson | Relatedness (SDT) |
| Forgiving streak | Rests and ties (§5.4) | Silverman & Barasch 2023 |

**Banned** (code-review checklist):
- loss-aversion copy ("you'll lose…"), streak-loss modals, countdown timers, push or browser notifications,
- XP per action or minute, badges for time spent, leaderboards,
- auto-starting the next lesson, infinite feeds, confirmshaming on exit, fake scarcity,
- red "broken" states.

The only reminder is an optional **Add to calendar** button that generates a local `.ics` file.

---

## 2. Information architecture and navigation

### 2.1 App shell

- **NavRail** (56 px, left; label tooltips on hover): Today, The Oak, Practice, Studio, Transcribe, Album, Toolbox, Progress. Bottom: Settings, AudioStatus, Tutor toggle. Only Practice carries a badge, showing the due count.
- **TopBar** (48 px, in non-focus routes):
  - page title,
  - global mini-transport ("Now playing: Studio · Sketch 037", stop),
  - AudioStatus: `Sound asleep — press any key` / `Loading sounds 63%` / `Ready`,
  - **Mic live** red dot (only while capturing),
  - Tutor toggle.
- **Focus mode** (lesson, drill, checkpoint, onboarding): the NavRail is hidden. A 56 px header carries `← Today` (`Esc`; "Your place is saved"), the title, the step rail, a subtle elapsed timer, AudioStatus and the Tutor toggle.
- **Tutor panel:** docked at L (360 default, resizable 320–520, persisted); 400 px overlay drawer at M (`Cmd+J`). Closing the docked panel while focus is in it gives the focus back to where it came from (or the main region).
- **Command palette** (`Cmd/Ctrl+K`): navigate ("Continue lesson", `G L`), actions ("New sketch in D minor", "Start drill: degrees in minor", "Recalibrate mic"), and search over unit songs (by title: started ones and those of units reached), lessons (one still ahead says "not open yet"), tools, sketches and tracks. Word and prefix matches rank first; a scattered-letter match shows only when nothing else matches. Each group heading shows once, and the list scrolls with the arrow keys. A track lens whose track is not open is found by typing but does not fill the empty palette.
- **PlaybackCoordinator** (global): only one source plays at a time — Strudel mirrors (built-in solo), Transcription audio, Toolbox demos and tutor cards. Starting any one stops the others. `Ctrl/Cmd+.` from anywhere is a panic stop for everything.
- **Height rule:** if the Workbench height is below 760 px, the roll and staff panes become tabs (Roll | Staff | Both). Otherwise they stack.

### 2.2 Routes (TanStack file routes under `src/routes/`)

| Route | Screen | Mode |
|---|---|---|
| `/` | Today | shell |
| `/onboarding/$step` | Onboarding (§8) | focus |
| `/learn/$lessonId?step=` | Lesson Player | focus |
| `/checkpoint/$unitId?part=` | Checkpoint | focus |
| `/capstone/$capstoneId` | Capstone workspace | shell |
| `/session/coda` | Coda | focus |
| `/studio`, `/studio/$sketchId` | Studio / Sketchbook | shell |
| `/oak?view=tree\|course\|leaves` | Skill Map (tree, course list, leaves table) | shell |
| `/practice`, `/practice/$familyId`, `/practice/review` | Practice hub, family drill, due reviews | shell / focus |
| `/transcribe`, `/transcribe/$projectId` | Transcription Studio | shell |
| `/album`, `/album/$trackId?v=` | Album, Track page | shell |
| `/toolbox?cat=`, `/toolbox/$toolId` | Toolbox | shell |
| `/progress` | Can-do ledger and stats | shell |
| `/settings/{audio,voice,tutor,learning,appearance,keys,data,about}` | Settings | shell |
| `/settings/voice/setup` | Mic and voice calibration wizard (shared with onboarding) | focus |

### 2.3 Screen specs

**Lesson Player:** §3. **Drills:** §4. **Toolbox, Oak, Album:** §5. **Tutor:** §6. **Onboarding:** §8. The remaining screens:

**Studio / Sketchbook** (`/studio/$sketchId`)
- **Purpose:** free play, revising sketches, starting from unlocked templates.
- **Layout (L):** NavRail | Sketchbook sidebar 280 | Workbench (full variant) | Tutor 360. At M the sidebar collapses to a 56 px icon strip (`Cmd+B` toggles it).
- **Sidebar:**
  - search,
  - filters: Mine / From lessons / Capstone drafts / B-sides,
  - sort: recent / key / tempo,
  - items show a mini-roll thumbnail (64×32), title, key, BPM and date.
- **Header:**
  - title (inline edit),
  - key and meter selectors (feed notation and degree labels; Strudel has no meter),
  - Versions dropdown,
  - Export (code `.js`, audio, lead sheet),
  - **Add to album as B-side**.
- **New sketch from…** Blank; Today's lesson; or an unlocked template ("Four-chord pop", "12-bar shuffle", "Dorian funk vamp", "Jazz blues in F"). Templates unlock with capstones; until a template's starter song is written (content/toolbox.ts has no code for them yet), an unlocked one is listed as "coming soon" and is not offered as a start.
- **Autosave:** every successful Run creates a version; `Cmd+S` names a snapshot.
- **Layers:** gutter icons on each `$:` line toggle mute and solo. The code text is never changed: the adapter rewrites labels at equal length (`$:` → `_:`) so highlight offsets stay valid.
- **Lenses** (unlocked analysis overlays on the roll): Chord-tone %, Function bands, Form map, Range.
- **Empty state:** "Your sketchbook fills up one session at a time." plus a New sketch button.

**Capstone workspace** (`/capstone/$capstoneId`)
- Layout: Studio layout, with a **Brief** panel (300 px) replacing the sidebar.
- **Brief panel:**
  - flavour choice made at the start (pop/rock/indie or jazz/soul/funk brief variant),
  - session plan ("1/3 Groove & changes · 2/3 Melody · 3/3 Arrange & review"),
  - live **Requirements** checklist (rule checks),
  - **Request review** (tutor, high effort),
  - **Release to album**: choose title, write a one-line liner note, consent to include Claude's note.
- Releasing triggers a ceremony: the rings cover draws itself and the album slot fills.
- Revising a released track opens this workspace in revision mode; the next release becomes v2.

**Practice hub** (`/practice`)
- Header: "Practice · 14 due" with **Start due reviews** (primary) and **Mixed set (10 min, recommended)**. Help text for the mixed set: "Mixed practice feels harder — that's why it sticks."
- Family grid grouped by type: Degrees, Intervals-in-key, Isolated intervals, Chord quality, Progressions, Rhythm, Melody, Singing, Theory facts. Each card shows:
  - family name and level ("Level 3 · 5 notes · leaps"),
  - leaf-colour recall dot,
  - 7-day accuracy sparkline with an 80–90% target band,
  - Practice button.
- Locked families are greyed: "Unlocks in unit 3, Major Scale & Degrees", or "Unlocks with the lesson “Degrees in Code”" once that unit has begun (words, never the IDs).
- A **Transcription Gym** card appears after U6.
- Practising cards that are not due is logged as practice. It changes the schedule only for cards due within 2 days. Copy: "Extra practice doesn't change your schedule unless items are nearly due."

**Progress / Can-do ledger** (`/progress`)
- **Left (2/3):** can-do statements grouped Hear / Read / Write / Compose / Transcribe / Sing / Code. Each row shows:
  - status pill: not yet / emerging / solid / strong / fading,
  - evidence links (drill accuracy, lesson, track),
  - date first achieved.
- **Right (1/3):**
  - milestone timeline,
  - weekly rhythm history (a year of 7/4 bars),
  - FSRS load forecast for the next 7 days (bars),
  - family accuracy sparklines,
  - pace estimate: "At 5 sessions/week you'll reach 'transcribe pop songs' around March."

**Settings** (`/settings/*`)

| Section | Contents |
|---|---|
| audio | Master volume; limiter (on, read-only indicator); UI sounds on/volume; practice-tempo default; the one Timing card (tap, sing and output latency + "Measure timing", "again" once measured); sound-pack cache status and size; **Preload all** |
| voice | Input device; noise floor (with its words: a quiet room / a little noisy); bleed test; vocal range and comfort zone + Re-test; tolerance (Auto / ±70 / ±50 / ±35 / ±25 ¢); octave folding (on); syllables on/off (the lesson that brings them named by title while it is ahead); Quiet mode (no singing today); a link to the Timing card in Audio |
| tutor | Status (`ready / missing_key / invalid_key / unreachable`) from `/api/health`, one error and one retry for the card when the server is down; model; this month's tokens and estimated $, with the fixed effort of each kind of request in the usage table (read-only); soft monthly budget warning; "Remove saved key" only when there may be a key; threads list (archive only, append-only); "What Claude sees" explainer |
| learning | Daily target 15/20/25; weekly goal 3–7 (default 5); Style (Pop, Indie, Jazz-soul, Funk, Electronic: the band in lessons, capstones and new songs; each song can pick its own); roll labels (degrees / +syllables / note names); scaffold fading (auto / always colour / never colour); desired retention (advanced: facts 0.90, perceptual 0.85) |
| appearance | Theme Paper / Bark / System; high contrast; UI scale 90–125%; editor font size 13–20; reduced motion (system / on / off); calm highlighting |
| keys | Shortcut sheet; "Strudel-compatible Ctrl on macOS" (on: both Ctrl and Cmd work) |
| data | Export JSON backup (option: include audio files); Import; storage location path; Reset progress (type `RESET OAK`) |
| about | AGPL notice and source link; sound attributions (Salamander CC-BY 3.0, etc.); versions |

---

## 3. Lesson Player anatomy

### 3.1 Layout

**L, 1440×900:**
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Today   U3 · 2  Degrees are numbers   [●][●][●][●][◉][○][○][○][○]          11:40  Ready  Claude │ 56
├──────────────────────┬────────────────────────────────────────────┬────────────────────────┤
│ PROMPT 384           │ WORKBENCH 640                              │ TUTOR 360              │
│ MODIFY · step 5 of 9 │ editor (min 160, default 280, resizable)   │ [U3.2 › Modify][Code]  │
│ Finish the phrase    │                                            │ [Result: 2 issues]     │
│ prose (≤60ch)        │ transport 44                               │ [Hints 1/4]            │
│ ▶ Hear the original  │ roll 220 (drum lanes extra if drums)       │ messages…              │
│                      │ staff 200                                  │                        │
│ ─ checks ─           │ keyboard 80 (collapsed by default)         │ suggested prompts      │
│ ✓ rhythm ✗ pitch 5/7 │                                            │ composer               │
│ Hints ○○○○ [H] [Ask] │                                            │                        │
│        [Continue ⏎]  │                                            │                        │
└──────────────────────┴────────────────────────────────────────────┴────────────────────────┘
```
At M (1280×800): prompt column 352, Workbench 928, tutor as overlay drawer.

**Step rail**
- One dot per step, with the step-type icon on hover.
- States: done (filled), current (ring), upcoming (outline), assisted (filled plus a small dot meaning a hint was used; informational, not shaming).
- Earlier steps can be revisited with `Alt+←`/`Alt+→` (read-only replay).
- Forward movement requires completing the current step. Ungraded steps can be skipped.

**Prompt column**
- Step kind label and title (Fraunces 22), MDX prose, inline example buttons, and the answer UI for non-code steps.
- A sticky footer holds the checks, the hint ladder, **Ask Claude** and **Continue**.

### 3.2 Step types and lesson template

**Template L-PRIMM-9.** The default order is listed below; authors may repeat Modify and Ear.
`listen → predict → run → investigate → see → modify → ear → make → reflect`

| kind | PRIMM / role | UI | Completion | Graded? |
|---|---|---|---|---|
| `listen` | sound first | Workbench read-only, play button, "what do you notice?" chips | played ≥1 full loop | no |
| `predict` | Predict | (a) MCQ of 3 audio clips "Which will this code sound like?"; (b) **hum it** (mic; contour graded loosely); (c) short choice ("higher/lower", "steps/leaps") | answered | logs only |
| `run` | Run | code visible, `Ctrl+Enter`; prediction revealed against result | ran once | no |
| `investigate` | Investigate | toggle layers, hover links; answer by **clicking a code token** or a roll/staff note | correct target clicked | yes (light) |
| `see` | symbol | staff revealed with degree lyrics; "This is how it looks on paper" | viewed | no |
| `concept` | explain | ≤120-word card + diagram + 1–2 audio examples | viewed | no |
| `modify` | Modify | editable regions only; live check on each Run | grader pass | yes |
| `parsons` | Modify (variant) | drag blocks (chords, bars) into order; keyboard: arrows select, `Alt+↑/↓` move | order correct | yes |
| `quiz` | retrieval | MCQ / short answer (note names, key signatures) validated by tonal | correct | yes |
| `ear` | embedded drill | TrialFrame mini-set (5 trials); introduces an SRS family | set done | yes → SRS |
| `sing` | audiation | PitchLane (§4.3) | ≥ threshold | yes → SRS |
| `tap` | rhythm | TapPad (§4.4) | ≥ threshold | yes → SRS |
| `dictate` | transcription | degree / RN / code / staff input (§4.5) | submit | yes → SRS |
| `notate` | write symbol | StaffInput | submit | yes |
| `compare` | judgement | A/B two versions: "Which ends more conclusively?" | answered | yes (light) |
| `make` | Make | open editor + live rule checklist + **Save sketch** (**Save into your song** in a unit song's Make, with a line saying what it puts where) | sketch saved | rules logged, never blocking |
| `reflect` | metacognition | can-do statement self-rating (Not yet / Getting there / Yes) + optional note | answered | no |

Budget: 8–14 steps per lesson, 2–4 graded checks, about 10 min plus about 4 min of Make.

### 3.3 Lesson content schema

Files: `content/units/u03-major-scale/l02-degrees-as-numbers.lesson.ts`, with prose in sibling `.mdx` imported per step.

```ts
// src/content/schema.ts
export type StepKind = 'listen'|'predict'|'run'|'investigate'|'see'|'concept'|'modify'|'parsons'
  |'quiz'|'ear'|'sing'|'tap'|'dictate'|'notate'|'compare'|'make'|'reflect';

export interface Lesson {
  id: `u${number}.l${number}`;            // 'u03.l02'
  title: string; unit: string; minutes: number;
  concepts: ConceptId[];                   // leaves on the Oak
  unlocks: ToolId[];                       // revealed in Coda
  key: { tonic: string; mode: ModeName };  // drives spelling + degree labels
  meter: '4/4'|'3/4'|'6/8'|'12/8'|'5/4'|'7/8';
  bpm: number;
  flavors?: { pop?: Partial<FlavorPatch>; jazz?: Partial<FlavorPatch> }; // instrument/bank/swing swaps
  canDo?: CanDoId[];
  steps: Step[];
}
export interface Step {
  id: string; kind: StepKind; title: string; body?: MDXModule;
  workbench?: WorkbenchConfig;             // §3.4
  answer?: AnswerSpec;                     // mcq | codeRange | noteIds | degreeSeq | rnSeq | staff
  check?: CheckSpec;                       // §3.5
  hints?: [Hint, Hint, Hint, Hint];        // nudge, pointer, partial, reveal (§3.7)
  forbid?: ToolId[];                       // e.g. ['tool.voicing'] in hand-voicing steps
  srs?: { family?: FamilyId; cards?: CardId[] };
}
export type CheckSpec =
  | { kind: 'events'; bars: [number, number]; compare: ('degree'|'midi'|'onset'|'duration'|'pcset')[];
      transpositionInvariant?: boolean; target: string /* reference code */ }
  | { kind: 'rules'; rules: RuleSpec[] }                       // Make
  | { kind: 'answer' };                                         // mcq/codeRange/etc.
export type RuleSpec = { id: RuleId; params?: Record<string, number|string>; required: boolean; label: string };
// RuleId: 'ends-on-tonic' | 'chord-tones-strong>=' | 'distinct-degrees>=' | 'bars==' | 'range<=semitones'
//  | 'stepwise-ratio>=' | 'cadence-at' | 'uses-tool' | 'labels>=' | 'schema-is' | 'has-device'
```

### 3.4 The Music Workbench

**Component:** `src/ui/workbench/Workbench.tsx`.
- Variants: `full` (lesson, Studio, capstone, transcription), `compact` (album track, checkpoint), `mini` (Toolbox demos, tutor cards; editor + 1-row roll, 2 bars).
- Each instance owns one StrudelMirror through the OakStrudel adapter: unique id `oak_${scope}_${n}_`, solo, explicit dispose.

```ts
export interface WorkbenchConfig {
  code: string;
  readOnly?: 'all' | Array<[number, number]>;     // ranges locked; rest editable
  editable?: Array<{ range: [number, number]; label?: string }>; // dashed "edit here" boxes
  key: { tonic: string; mode: ModeName };
  meter: Meter; bpmHint?: number;                   // BPM displayed is derived from setcpm capture
  loopBars: number;                                 // bars visible in roll/staff (default 4)
  panels: { roll: boolean; staff: false | 'treble' | 'bass' | 'grand' | 'perc' | 'lead'; keyboard: boolean };
  roll: { labels: 'none'|'note'|'degree'|'degree+solfege'; color: 'part'|'degree'|'chordTone'|'mono';
          chordBand: boolean; scaleLanes: boolean };
  staff: { colorNotes: boolean; degreeLyrics: boolean; chordSymbols: boolean; romanNumerals: boolean };
  target?: { code: string; audible: 'always' | 'fromHint2' };   // for A/B and diffs
  forbid?: ToolId[];
  practiceTempo?: 1 | 0.85 | 0.7 | 0.5;
}
```

#### Linking model (the core of "three representations")

`src/ui/workbench/linkBus.ts` holds a per-instance zustand store:
```ts
type EventId = string;  // stable: `${part}:${bar}:${onsetFrac}:${locStart}`
interface LinkState {
  events: Map<EventId, { bar: number; beat: string; midi: number|null; degree: string|null;
                         part: string; codeRanges: [number, number][]; abcId: string }>;
  hovered: EventId[]; selected: EventId[]; active: EventId[]; issues: Map<EventId, Issue>;
}
```
- **Code → others:** the cursor or selection range is matched against `codeRanges` overlap. Matching roll rects and staff `.oak-e{id}` elements get `hover` / `selected`.
- **Roll or staff → code:** hover or click selects the code range in CM6 (an outline mark; click also moves the cursor there).
- **Playing:** one rAF loop reads `scheduler.now()` and sets `active`.
  - The code token outline comes from Strudel's own mini-location highlight, recoloured by degree: the adapter's `editPattern` sets `value.color = degreeColor(value)`, and Strudel outlines in `hap.value.color`.
  - Roll notes glow, and staff notes get `.oak-playing`.
- **Visual states** (all three views): hover = 2 px `--link` outline; selected = 3 px halo; active = degree-colour fill at 100% (resting 80%); issue = `--issue` ring plus a marker.

#### Editor (CM6 via StrudelMirror)

- **Oak theme:**
  - background `--surface`; strings (mini-notation) `--text`; function names `--accent`; numbers `--accent-2`; comments `--text-3` italic; `$:` labels bold;
  - read-only ranges tinted `--surface-2` with a lock icon in the gutter;
  - editable regions get a dashed `--accent` box with an "edit here" label on first view.
- **Gutter per `$:` line:** mute (speaker) and solo (S).
- **Autocomplete** (`Ctrl+Space`, and while typing `.`) offers unlocked tools only. Each entry gives a one-line musical meaning plus a hover demo (▶ plays a 2-bar mini).
- **Lint** (as you type, and on Run):
  - parse errors at their position;
  - mini parse errors at the line;
  - dialect hints:
    - "`Cmaj7` → Strudel writes `C^7`";
    - "lower-case chord root";
    - "`n` without `.scale()` is a sample number, not a pitch — add `.scale("C:major")`";
    - "Missing `setcpm(bpm/4)` — Oak counts 1 cycle as 1 bar";
  - locked tools as **info**, not error: "`.voicing()` joins your toolbox after U5's checkpoint. Here it would do this step for you." In a step with `forbid`, using the tool fails the check with that message.

#### Transport bar (44 px)

`▶/■` · `Loop ⟲ bars 1–2` · `2.3 / 4` (bar.beat) · `92 BPM · 4/4` · `D major` · `Metronome` · `Count-in` · `A/B` (when a target exists) · `Practice tempo 100%` (cycles 100/85/70/50; scales cps after eval, code untouched) · `Layers ▾` · master meter.
- Loop uses `pattern.ribbon(startBar-1, nBars)` applied in the adapter's `editPattern`.
- Metronome stacks a click track in the adapter, also via `editPattern`; it is never written into the code.

#### Piano roll (canvas, `PianoRoll.tsx`)

- **Axes:** time across (bars, ruler with bar numbers and beat ticks); pitch auto-ranged to the events ±2 semitones, at least 13 rows, row height 10–18 px.
- **Left gutter (44 px):** label per `roll.labels`. Degrees are 1-based with ♭/♯ (e.g. `1`, `♭3`); syllables are optional (`do`, `me`). Note names appear on hover.
- **Scale lanes:** in-key rows tinted `--lane-in`; out-of-key rows carry a 6% diagonal hatch; tonic rows have a stronger line and a bold `1`.
- **Notes:** 3 px radius rectangles filled with the degree colour. Altered degrees get a hatch overlay. The degree number sits inside the note if it is ≥18 px wide.
- **Chord band** (28 px at the bottom, U6+): per chord span, a function-coloured band labelled with the lead-sheet symbol (`Am7`) and the Roman numeral (`vi7`).
- **Drum lanes:** a separate sub-panel with one row per sound (bd, sd, hh, oh, cp…); hits are diamonds; colour from the part palette.
- **Colour modes:**
  - `degree` (default U3+);
  - `chordTone`: root solid, 3 solid, 5 lighter, 7 solid with stripe, tensions outlined thick, non-chord tones hollow dashed; labels `R 3 5 7 9`;
  - `part` (U0–U2, multi-layer Studio);
  - `mono`.
- **Interactions:**
  - drag-select bars to get a context menu: Loop these bars / Ask Claude about bars 3–4 / Copy as code;
  - click a note to select it (and its code range);
  - `Alt+click` auditions the note.
- **Accessibility:** a **Notes table** toggle shows bar, beat, part, degree, note, duration.

#### Staff (abcjs 6.7.2, lazy, `Staff.tsx`)

- Fixed staffwidth matching the panel, 4 bars per line, key signature from the lesson.
- Chord symbols above in lead-sheet display (`Cmaj7`, `Am7`, `Bø7`).
- Roman numerals below using abcjs `"_IV"` annotations (U6+).
- **Degree lyrics** use a `w:` line under the notes (1-based) in U3–U6.
- Classes: `.oak-playing`, `.oak-hover`, `.oak-selected`, `.oak-issue`. An **approx** badge appears when the quantiser fell back to a grid.
- Percussion staff (`perc`) for U1 rhythm, with counting syllables ("1 e & a") as lyrics.

#### Keyboard (optional, 80 px, `Keyboard.tsx`)

- Two octaves, auto-centred on the key.
- Dots on scale tones; degree labels on in-key keys; active notes lit with the degree colour.
- Click auditions on piano.
- With focus on the workbench and `K` toggled, the computer keyboard plays relative to the tonic (`A`=1, `W`=♭2, `S`=2, `E`=♭3, `D`=3, `F`=4, `T`=♯4, `G`=5, `Y`=♭6, `H`=6, `U`=♭7, `J`=7, `K`=1′; `Z`/`X` change octave).

#### Scaffold-fading schedule (expertise reversal, applied by default)

| Units | Roll labels | Roll colour | Staff | Staff note colour | Degree lyrics | RN under staff | Keyboard |
|---|---|---|---|---|---|---|---|
| U0 | none | part | hidden | — | — | — | hidden |
| U1 | drum lanes | part | perc + counts | — | — | — | hidden |
| U2 | note names | degree (C major) | treble from U2.5 | on | — | — | shown |
| U3–U4 | degrees + syllables | degree | treble | on | on | — | shown |
| U5 | degrees | degree / chordTone | grand staff | on | on | — | shown |
| U6 | degrees | degree + chord band | grand / lead | on | on | on | optional |
| U7+ | degrees | user choice | lead sheet | **off** | **off** | on (until U10) | optional |
| Advanced | user | user | lead sheet | off | off | off | optional |

### 3.5 Feedback and diagnostics

**Check timing**
- `modify` and `make`: every successful Run triggers the grader silently (browser Worker, target ≤300 ms for ≤8 bars). The checks list updates live.
- `dictate`, `quiz`, `notate`: an explicit **Submit** (`Cmd/Ctrl+Shift+Enter`) counts as an attempt.

```ts
// src/grader/types.ts (UI contract)
export interface GradeResult {
  status: 'pass' | 'fail' | 'error';
  score: number;                                  // 0..1
  facets: Partial<Record<'rhythm'|'pitch'|'bass'|'harmony'|'rules', { score: number; label: string }>>;
  issues: Issue[];
  evalError?: { friendly: string; raw: string; codeRange?: [number, number] };
  attempt: number;
}
export interface Issue {
  id: string; severity: 'error'|'warn'|'info';
  bar: number; beat: string;                      // '3', '2&', '1e'
  kind: 'wrong-degree'|'wrong-pitch'|'missing-note'|'extra-note'|'early'|'late'|'wrong-duration'
      |'wrong-root'|'wrong-quality'|'wrong-bass'|'rule'|'forbidden-tool'|'n-without-scale'|'unknown-chord';
  where: string;          // rung 0: always shown   "Bar 2, beat 3"
  what?: string;          // rung 1+                 "the line leaps here; the tune steps"
  fix?: string;           // rung 3+                 "degree 5 (n 4)"
  expected?: NoteSummary; got?: NoteSummary;       // rung 3+
  eventIds: EventId[]; codeRanges: [number, number][];
}
```

**Where feedback appears**

| Surface | Rendering |
|---|---|
| Checks list (prompt footer) | facet chips: `✓ Rhythm` `✗ Pitch 5/7` |
| Feedback tray (slides up in the prompt footer) | summary + issue rows. Each row is clickable: it loops that bar and selects the token. |
| Editor | CM6 diagnostic: squiggle under the token range, gutter marker. Hover shows `where` plus whatever the current rung allows. |
| Roll | issue ring at bar/beat; from rung 3, a ghost target note (dashed outline, target degree colour) |
| Staff | `.oak-issue` tinted notehead; from rung 3, a ghost note in grey |
| Eval errors | red-free "Code didn't run" banner over the roll with the friendly message; the token range is marked; playback continues with the last good pattern (Strudel behaviour) |

**Copy rules**
- Rung 0 always says where and how many: "2 notes differ — bars 2 and 4."
- Pass copy is specific: "That's it: 4 4 3 3 2 2 1 — the tune walks home."
- Never "Wrong!"; never exclamation marks on failure.

### 3.6 "Hear the difference" (A/B)

- Available when `target.audible` allows: always for dictations, from rung 2 for modify steps.
- `A` plays yours and `B` plays the target. Switching happens at the next downbeat via `setPattern`, without stopping.
- **Alternate bar N** (`Shift+A`) loops yours, then target, then yours… for the issue bar (bar N), with a large "A · yours" / "B · target" indicator.
- Roll overlay: target ghost notes are visible only from rung 3.
- In dictation the target is the question itself, so A/B is free. **Play mine** (`P`) renders the learner's answer in the same key and instrument.

### 3.7 Hint ladder and SRS consequences

| Rung | Name | Content | Shows | SRS effect on the step's cards |
|---|---|---|---|---|
| 0 | — | grader `where` | location only | pass on first try, fast → Easy; pass → Good |
| 1 | Nudge | conceptual question ("Does the tune step or leap at the end?") | `what` | pass → Good |
| 2 | Pointer | names the bar/beat and the concept; unlocks A/B audio of the target | `what` + audio | pass → Hard |
| 3 | Partial | ghost target notes for **one** issue, or the same idea in another key | `fix` + ghost notes | pass → Hard (flag "assisted") |
| 4 | Reveal | full solution as a diff card with **Apply**; the step completes as assisted | solution | Again (reschedule soon) |

- `H` (outside the editor) or **Hint** advances one rung. Hints are free and unlimited.
- Copy: "Hints are free — they just tell Oak to bring this back sooner."
- After 3 failed checks on the same step, a non-modal line appears in the tray: "Stuck on bar 2? Talk it through with Claude." Nothing opens automatically.

### 3.8 Hand-off to the tutor

**Talk it through** (tray button, or `Cmd/Ctrl+I` in the editor):
- opens the tutor on the `lesson:{id}` thread;
- attaches chips: Step, Code, Result (redacted to the current rung), Hints (n/4), Selection;
- seeds the composer with "I'm stuck on this step." (editable).

**Server enforcement**
- The tutor context includes `answerPolicy: 'socratic' | 'may_reveal'` (`may_reveal` only at rung 4).
- `get_lesson_context` omits `solution` and the `expected` fields until `may_reveal`.
- When the learner asks for the answer, the tutor replies with an offer and a **Reveal (hint 4)** button. That button drives the UI ladder, so reveals are always recorded the same way.

### 3.9 Checkpoints and capstones

**Checkpoint** (`/checkpoint/$unitId`)
- Two parts on separate days; perceptual families must pass on both days.
- About 12 minutes each, mixed items, no hints.
- The tutor panel shows "Checkpoint in progress — Claude reviews it with you afterwards."
- **Results:** per-skill bars with a line at 85%.
  - **Pass:** unit-complete ceremony (the branch leafs out), tool unlocks, can-do updates.
  - **Not yet:** "Practice plan: 3 short targeted sets over 2 days, then retry." The sets are auto-scheduled into Today's warm-up. The next unit's lessons stay locked; Studio and Practice never lock.

**Capstones:** C0 Intro (drums, after U1, 1 session — added so the album starts early), C1–C7, Core Finale, J1–J4, F1–F3, A1 as in research, run in the capstone workspace (§2.3).

### 3.10 Worked example: U3.2 "Degrees are numbers" (D major, 80 BPM)

**Starter / listen** (read-only). This is Twinkle, a traditional melody:
```js
setcpm(80/4)
$: n("0 0 4 4 5 5 4 ~").scale("D4:major").s("piano")
```
The roll shows labels `1 1 5 5 6 6 5`.

1. **listen:** "Same tune you know. Watch the numbers on the roll."
2. **predict:** "`n("0 1 2 3 4")` — hum it before you run it: up or down? steps or leaps?" Mic contour check (rising, stepwise). Fallback is a 3-clip MCQ.
3. **run:** the roll shows `1 2 3 4 5`. Concept callout with a 2-row table (`n: 0 1 2 3 4 5 6 7` / `degree: 1 2 3 4 5 6 7 1′`), titled "Strudel counts from 0. **Degree = n + 1.**"
4. **investigate:** "Click the number in the code that plays degree 6." Answer: the `5` token (codeRange).
5. **see:** treble staff with D major key signature, degree lyrics under the notes.
6. **modify:** "Finish the tune: 4 4 3 3 2 2 1." Only the second bar is editable:
   ```js
   $: n("<[0 0 4 4 5 5 4 ~] [0 0 0 0 0 0 0 ~]>").scale("D4:major").s("piano")
   ```
   The check is `events` on bar 2 with `degree`; rhythm is fixed. Rung 1: "Each pair steps down by one." Rung 3: ghost notes for bar 2 beats 1–2.
7. **concept:** "Keys are a setting." Change `D4:major` to `G4:major`: same numbers, new key signature (1♯ instead of 2♯).
8. **ear:** FET mini-set, degrees 1, 3, 5, random keys, sung resolution. Creates family `fam.deg.maj.135`.
9. **make:** "Write a 2-bar tune using only 1 2 3 5 6, ending on 1." Rules: `ends-on-tonic` (required), `distinct-degrees>=4`, `bars==2`. **Save sketch**.
10. **reflect:** "I can write a melody with scale-degree numbers."

Coda unlocks `tool.scale` (the ceremony applies `.scale("D:minor")` to the learner's own sketch: same numbers, minor colour, which also teases U10).

---

## 4. Ear training and singing UX

### 4.1 TrialFrame (shared drill shell, `src/ui/drills/TrialFrame.tsx`)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Degrees in major · 1 3 5 + 2 4      Trial 4 of 8   ● ● ○ ●                │  header
├───────────────────────────────────────────────────────────────────────────┤
│  STIMULUS (cadence lights I  IV  V  I as played; "listening" pulse)       │  200
│  key hidden until after answer · instrument chip "rhodes"                  │
├───────────────────────────────────────────────────────────────────────────┤
│  ANSWER PAD (DegreePad / RomanPad / slots / TapPad / PitchLane)           │  260
├───────────────────────────────────────────────────────────────────────────┤
│  C cadence again   R replay   S skip singing   Enter next     Level 3    │  footer
└───────────────────────────────────────────────────────────────────────────┘
```
- Focus mode; the tutor is available via `Cmd+J` but never receives the current trial's answer.
- **No timeouts.** Response time is recorded silently and only separates Easy from Good.
- **Set summary:** "Degree 6 in major · 9/10 · strong" with the leaf animation. Grade mapping: <70% Again, 70–89% Hard, ≥90% Good, ≥90% with fast median response Easy.

### 4.2 FET drill flow (cadence → answer → sung resolution)

1. **Context.** I–IV–V–I in a random key whose tonic lies in the learner's comfort zone.
   - Random instrument: piano / rhodes / organ / strings.
   - Random voicing: close / open.
   - Random tempo: 72–100 BPM.
   - Played via direct `superdough()` calls after preload.
2. A 600 ms gap, then the **target** note, register randomised ±1 octave.
3. **Answer.** DegreePad keys `1`–`7` map to pad positions. The pad shows only the current contrast set (e.g. 1 3 5 → +2 4 → +6 7; minor shows 1 2 ♭3 4 5 ♭6 ♭7 on the same keys).
4. **Feedback.**
   - Correct: the degree key glows in its colour.
   - Incorrect: the pressed key gets a 2 px shake (none with reduced motion), the correct key is outlined, and an auto-replay plays "yours (6) vs it (4)", each resolving.
5. **Resolution, sung.** The path is 2→1, 3→2→1, 4→3→2→1, 5→6→7→1′, 6→7→1′, 7→1′.
   - Levels 1–2: the app plays the path, then the learner sings it.
   - Level 3+: the learner sings first, then hears it (audiation).
   - PitchLane grades each note.
   - `S` skips singing (logged).
   - **Quiet mode** replaces singing with "Hear it in your head, then press Space" (self-report).
6. `Enter` → next trial; the key changes on every trial.

### 4.3 Singing feedback: the PitchLane (`PitchLane.tsx`, canvas, 220 px tall)

```
 cents
  +100 ┤                                         ┌────── 1′ · do ──────┐
       │              ┌──── 7 · ti ────┐ ~~~~~~~~│~~~~~~~~~~~~~~~~~~~~~│ ← live trace
     0 ┤ ┌─ 6 · la ─┐ │~~~~~~~~~~~~~~~~│         └─────────────────────┘
       │ │~~~~~~~~~~│ └────────────────┘   ← ribbon height = ±tolerance
  -100 ┤ └──────────┘                                  ▲ 12¢ low  (needle)
        time →                                          8vb (octave-folded)
```
- **Target ribbons:**
  - rectangles at each target degree, folded into the learner's comfort zone;
  - height = ±tolerance (100 ¢ = 24 px);
  - labelled with degree and syllable;
  - placed on beat lines when the task is rhythmic (latency-compensated).
- **Live trace:**
  - 3 px polyline of detected pitch after clarity ≥0.9 and median-of-5;
  - folded to the target octave;
  - degree colour when in band, `--text-3` when out;
  - gaps for unvoiced frames.
- **Right-edge needle:** signed cents and words ("a little low", "spot on", "a little high"). Arrows only; no red/green semantics.
- **Octave badge:** `8vb`/`8va` when folding applied. Always accepted, never penalised.
- **A note counts** when ≥250 ms of cumulative in-band time falls within a 1 s window.
- **After each note:** the ribbon fills (opacity ∝ accuracy) with a tick at the mean deviation and a label like `+12¢`.
- **Tolerance:**
  - auto profile starts at ±50 ¢ and tightens to ±35 and then ±25 after two consecutive days at ≥90%;
  - "Beginner voice" mode is ±70 ¢ with a 400 ms stability window, offered automatically if pitch-matching is below 1/3 at calibration.
- **Text alternative** for screen readers: "Target 5, sol. You're 30 cents low."

### 4.4 Tap rhythm (`TapPad.tsx`)

1. The pattern plays twice (with click), then a 1-bar count-in ("1 2 3 4" in big numerals and a visual metronome).
2. The learner taps `Space` (one voice) or `F`/`J` (two voices: kick / snare). Optional mic-clap onset mode.
3. **Display:** one bar per row, 16th grid with labels `1 e & a 2 e & a…`. Taps appear as ticks. After the attempt, target onsets are drawn, matched pairs are connected, and offsets are coloured by size (early/late text, ms).
4. **Score:** onset F-measure with a ±60 ms window that narrows to ±35 ms; per-tap latency compensation from calibration.
5. **Write it:** a scaffolded editor, e.g. `$: s("bd ~ ~ bd ~ ~ bd ~")`. The perc staff renders live; **Play mine / Play target** for A/B.

### 4.5 Dictation answer inputs

| Input | Component | Keys | Notes |
|---|---|---|---|
| Degree sequence | `DegreeSlots` | `1`–`7` (context pad), `Backspace`, `←/→` move slot, `P` play mine, `A`/`B` target/mine | Slots show degree and syllable; rhythm is fixed slots early; replay budget shown as "Replays 2/3" (difficulty setting) |
| Roman numerals | `RomanPad` | `1`–`7` = diatonic chord on that degree; `Shift+digit` = 7th chord; `-` before a digit = flat-degree borrowed (`-7` → ♭VII); `M` toggles quality | Three columns **T | PD | D** in function colours (T: I vi iii, PD: IV ii, D: V vii°); a borrowed row appears when unlocked; each button shows the lead-sheet symbol in the current key ("IV · G") |
| Bass-first harmonic dictation | `BassFirstFlow` | as above | **Stage 1:** sing the bass (optional mic), enter bass degrees, submit (graded separately). **Stage 2:** RN per bar; options pre-filtered to diatonic chords containing that bass. **Stage 3:** name the schema (chips: Four-chord I–V–vi–IV, vi–IV–I–V, Doo-wop I–vi–IV–V, Aeolian i–♭VI–♭VII–i / i–VI–III–VII, Andalusian, 12-bar blues, ii–V–I). Facets scored separately. |
| Code | Workbench `compact`, scaffold with editable slots | `Ctrl+Enter` play mine (alternating with target per bar), `Cmd+Shift+Enter` submit | Example scaffold: `$: n("<0 0 0 0>").scale("A2:major").s("ebass")`, with only the four numbers editable |
| Staff | `StaffInput` (pointer layer over abcjs) | `A`–`G` pitch letter; `↑/↓` diatonic step; `Shift+↑/↓` semitone; `Cmd/Ctrl+↑/↓` octave; `←/→` move by grid; `2 3 4 5 6` = 16th, 8th, quarter, half, whole; `.` dot; `0` rest; `Enter` commit; `Delete` remove | Ghost note follows the pointer, snaps to the NotationModel beat grid; on commit the model is updated and the ABC regenerated |

Melodic dictation protocol (Karpinski): key and meter set → listen → **sing it back** (contour, loosely graded, encouraged) → enter → **Play mine** → submit → per-slot ✓/✗ with expected values revealed → alternate-bar A/B.

### 4.6 Drill family catalogue (v1)

| Family id pattern | Stage | Answer UI | Generator knobs |
|---|---|---|---|
| `fam.pitch.match` | A | PitchLane | range, tolerance |
| `fam.pitch.hilo`, `fam.pitch.samediff` | A | 2 buttons (`←/→`) | interval size |
| `fam.rhythm.echo.{level}` | A/H | TapPad | subdivision, syncopation, swing |
| `fam.tonic.find` | A | sing tonic after a progression | instrument, density |
| `fam.deg.maj.{set}` / `fam.deg.min.{set}` / `fam.deg.chrom` | B/E/F | DegreePad / chromatic typing keys | contrast set, register, instrument |
| `fam.int.inkey.{set}` | C | DegreeSlots (2) | melodic up / down / harmonic |
| `fam.int.iso.{set}` | C (secondary) | interval buttons (m2 … P8) | interleaved |
| `fam.mel.dict.{level}` | C | DegreeSlots / code / staff | note count 3–8, leaps, NCTs, replays |
| `fam.chord.quality.{set}` | D/E | buttons (M m ° + maj7 7 m7 ø7 °7) | voicing, register, inversion |
| `fam.prog.bass.{level}` / `fam.prog.schema` | D | BassFirstFlow | schema pool, instrument, tempo |
| `fam.mode.color` | E | Dorian ♮6 / Mixolydian ♭7 / Lydian ♯4 / Phrygian ♭2 | vamp style |
| `fam.fact.*` | all | typed / MCQ / StaffInput (tonal-validated) | key signatures, spelling, RN↔chord |
| `fam.jazz.{iiVI,guide,ext}` | G | RomanPad + extension chips | 12 keys |
| `fam.groove.{swing,clave,odd}` | H | TapPad / choice | ratio, direction, grouping |

### 4.7 Mic setup and calibration (`/settings/voice/setup`, also onboarding steps 4–8)

| Step id | Screen | Pass criterion | Stored |
|---|---|---|---|
| `audio.headphones` | "Put on wired headphones." Stereo L/R test ("Which ear?" two buttons). Device type: Wired / Bluetooth / Speakers. A device label containing "AirPods"/"Bluetooth"/"Buds" triggers a warning card. | L/R correct | `outputKind` |
| `mic.permission` | Why + privacy line: "Your voice is analysed live on this computer. Nothing is recorded or sent." `getUserMedia` (EC/NS/AGC off). Device select, live level meter, live note readout ("Hum anything"). | signal detected | `inputDeviceId` |
| `mic.noise` | "Stay quiet for 3 seconds." | floor < −45 dBFS (otherwise "Find a quieter spot" + continue) | `noiseFloorDb` |
| `mic.bleed` | Plays a 3 s piano phrase at drill volume while listening | no correlated pitch detected | `bleedOk` |
| `latency.tap` | "Tap Space with the 16 clicks" (90 BPM) | median offset | `tapLatencyMs` (>120 ms → "That looks like Bluetooth latency — timing grades will be looser") |
| `latency.sing` | "Sing 'ta' on each of 8 clicks" (RMS onset) | median offset | `singLatencyMs` |
| `voice.range` | Vertical keyboard + live trace: "Slide down to your lowest comfortable note… now up to your highest… now a comfortable middle note" | stable ≥300 ms at clarity ≥0.9 | `voice: {low, high, comfortLow, comfortHigh}` |
| `voice.match` | Three pitch-match trials inside the comfort zone | ≥2/3 within ±50 ¢ (otherwise Beginner voice mode) | tolerance profile |

The result card reads, for example: "Your singing zone: A2–E4 (comfortable C3–C4). Oak will choose keys that sit there." There are no voice-type labels.

Re-check prompt: if more than 40% of voiced frames in a session have low clarity, a non-modal suggestion appears: "Mic sounds noisy today — re-check?"

---

## 5. Motivation surfaces

### 5.1 Toolbox (`/toolbox`)

**Layout:**
- Category tabs: Rhythm · Pitch · Harmony · Melody · Form · Groove · Sound · Instruments · Templates · Lenses.
- Card grid, 4 columns at L and 3 at M, 220×180 cards.
- Instruments are an "Instrument wall" of square cards.

**Card (unlocked):** name (a sound by the code you type, `.s("ebass")`), signature, one-line musical meaning with code set as code, ▶ 2-bar demo (mini Workbench), "Learned in Heartbeat" (the lesson's title; its id in the tooltip), "Used in 14 of your sketches".

**Card (locked):** silhouette with the name visible, unlock condition, goal-gradient bar ("2 lessons to go"), and a ▶ teaser (you can hear it, not open it).

```ts
// content/toolbox.catalog.ts
interface ToolCard {
  id: ToolId; kind: 'function'|'mini'|'scale'|'instrument'|'bank'|'template'|'lens';
  name: string; signature: string; meaning: string;
  unlock: { after: `lesson:${string}` | `checkpoint:${string}` | `capstone:${string}`; requirement?: string };
  demo: { code: string; bars: number };
  personalize?: string;            // template applied to learner's last sketch, e.g. '{melody}.rev()'
  learnedIn: string;
}
```

**Unlock map:** the instrument aliases are Oak's curated aliases.

| Tool | Unlocks after | Demo |
|---|---|---|
| `s()`, mini: space, `~`, `*`, `[ ]`, `setcpm`, `$:` | U0.1 / U0.2 | `$: s("bd ~ sd ~")` |
| sounds `piano`, uzu kit (`bd sd hh oh cp rim`) | U0.1 | — |
| mini `,` stacks, `.gain()` | U0.3 | `s("bd ~ sd ~, hh*8")` |
| mini `< >` (one per bar) | U1.3 | `s("bd <sd cp>")` |
| mini `@`, `!` | U1.5 | `s("bd@3 sd")` |
| `.bank()` + `RolandTR808`, `RolandTR909`, `LinnDrum` | U1.7 | `s("bd*2 sd").bank("RolandTR808")` |
| `note()` with letter names | U2.2 | `note("c4 e4 g4 c5")` |
| synths `sine triangle square sawtooth` | U2.4 | `note("c3").s("sawtooth")` |
| `ebass` | C1 First Loop | `note("<c2 a1 f1 g1>").s("ebass")` |
| `n().scale()` | U3.2 | `n("0 2 4 7").scale("D4:major")` |
| patterned keys `scale("<C:major G:major>")` | U3.6 | — |
| `.add()` | U4.3 | `n("0 1 2 3").add("<0 [0,2]>").scale("C:major")` |
| `.transpose()` | U4.5 | `note("c4 e4 g4").transpose("<0 5 7>")` |
| `[0,2,4]` triads by degree | U5.2 | `n("<[0,2,4] [3,5,7]>").scale("C3:major")` |
| `chord().voicing()` | **CP U5** (after hand-voiced inversions) | `chord("<C Am F G>").voicing().s("rhodes")` |
| `rhodes` | U6.1 | — |
| `.arp()` | U6.7 | `n("[0,2,4]").arp("0 1 2 1").scale("C4:major")` |
| `cleangtr`; template "Four-chord pop" | CP U6 | — |
| `.rev()`, `.scaleTranspose()`, `.off()`, `.ply()` | U7.3–U7.7 | `n("0 1 2 4").scale("C4:major").off(1/8, x => x.add(7))` |
| Lens: chord-tone % | U7.5 | — |
| `.rootNotes()` | U8.1 | `chord("<C Am F G>").rootNotes(2).s("ebass")` |
| `.struct()` | U8.3 | `note("c2").struct("x ~ x x ~ x ~ ~").s("ebass")` |
| `upright` | CP U8–9 | — |
| `arrange()`, `.mask()`; Lens: form map | U9.2 / U9.3 | `arrange([4, verse], [4, chorus])` |
| `:minor`, `:harmonic:minor`, `:melodic:minor`; `strings` | U10.1 / 10.4 / 10.7; C4 | `n("0 2 4 6").scale("A3:harmonic:minor")` |
| `:minor:pentatonic`, `:major:pentatonic`, `:blues` | U11.1 | `n("0 1 2 3 4 5").scale("A3:minor:pentatonic")` |
| `.swingBy()` / `.swing()`; `organ`, `crunch`; template "12-bar shuffle" | U11.5; C5 | `s("bd ~ sd ~, hh*8").swingBy(1/3, 4)` |
| 7th symbols `^7 -7 7 h7 o7`; `jazzgtr` | U12.2 | `chord("<C^7 A-7 D-7 G7>").voicing()` |
| `.late()`, `.degradeBy()`, `.velocity()` | U13 | `s("hh*16").velocity("<1 .4>*8")` |
| `:dorian :mixolydian :lydian :phrygian`; template "Dorian funk vamp" | U14.1–14.4; C6 | `n("0 2 4 5").scale("D3:dorian")` |
| voicing controls `.anchor()`, `.mode()`; Lens: function bands | U15 | `chord("<Dm7 G7 C^7>").voicing().anchor("c5")` |
| `horns`, `tenor` | Core Finale | — |
| euclid mini `(3,8)`, polymeter `{ }%`, `.ribbon()` | Advanced Rhythm | `s("bd(3,8), hh(5,8)")` |
| `vibes`, `clav`, template "Jazz blues in F" | J2 / F1 | — |
| `.lpf() .lpq() .attack() .release() .room() .delay() .pan() .fm()`, `supersaw` | Arrangement & Sound | `note("c2 eb2").s("supersaw").lpf(800)` |

**Unlock ceremony** (in Coda, 15–20 s, `Esc` skips; reduced motion = no flip, cross-fade only):
1. Card flips on the next downbeat; I–IV–V–I arpeggio (UI bus).
2. A 4-bar demo plays in time and its tokens light up.
3. **Try it on your music:** a one-line editable snippet built from `personalize` and today's sketch, e.g. today's chords `.voicing()`. ▶ plays it.
4. Footer: "Now in autocomplete. Docs: `/toolbox/tool.voicing`."

### 5.2 Skill Map: "The Oak" (`/oak`)

**Tabs:** **Tree** · **Course** (units → lessons list with status, replay completed lessons) · **Leaves** (sortable table: concept, unit, recall %, next due, last practised, status).

**Tree anatomy** (SVG viewBox 1600×1000, positions authored in `content/oak.layout.ts`, so the tree grows the same way every time and the learner builds spatial memory):

| Part | Units / tracks |
|---|---|
| Roots (below ground line y=700) | Rhythm & Meter (U1), Rhythm II (U13), Advanced Rhythm (deep roots) |
| Trunk | Pitch (U2), Scales & Degrees (U3), Intervals (U4) |
| Left limb "Harmony" | Triads (U5), Function (U6), Sevenths (U12), Chromatic (U15–U17) |
| Right limb "Line" | Melody (U7), Bass (U8) |
| Centre limb "Form" | Song Form (U9) |
| Right upper limb "Colour" | Minor (U10), Blues & Pentatonic (U11), Modes (U14) |
| Crown left / right | Jazz Harmony / Arrangement & Sound |
| Acorns | released album tracks, hung where the capstone sits |

**Leaf rendering.** One leaf per concept (about 120 core). The leaf is an oak shape, 24×32 at zoom 1. Its fill is the concept's recall, R = weighted mean of the FSRS retrievability of its cards (perceptual families weight 2).

| R | Light theme | Dark theme | Extra cue |
|---|---|---|---|
| not started | dashed bud outline | dashed | — |
| new (<48 h) | #7BC47F with glint | #8FD493 | — |
| ≥0.90 | #2F6B45 | #6FBF8A | — |
| 0.80–0.90 | #5E9A4C | #8CC572 | — |
| 0.70–0.80 | #A3B84A | #C2CF6A | 10° droop |
| 0.60–0.70 | #D49A3A | #E3AE57 | droop + dashed dry edge |
| <0.60 | #A0522D | #C27548 | droop + dry edge |

- Leaves never fall; there is no punishment state.
- Limb length grows with unit progress: bare silhouette → sprig → full.
- Background sky follows local time (dawn/day/dusk/night) with flat gradients. It is static and allowed under reduced motion.

**Interactions**
- Hover a leaf: tooltip with the concept, "Recall 74%", next due, components (facts / hearing), and **Revive (≈2 min)**.
- Click a limb: zoom to that unit (`+`/`-`, drag to pan, `0` to fit).
- **Select fading** (`F`) → **Revive selected (≈4 min)** launches a review set restricted to those cards.
- Legend: colour ramp with % ticks.
- Keyboard: arrows move between leaves in authored order; `Enter` opens the inspector.

**Inspector** (right, 320): concept, lessons, can-do links, cards and families with R, ▶ "hear it" example.

### 5.3 Album (`/album`, `/album/$trackId`)

**Album page**
- Header: album title (set at C0 release; default "Oak Sessions"; editable), total runtime, number of tracks.
- Tracklist as an LP: **Side A — Core** (C0 Intro, C1 First Loop, C2 Four-Chord Song, C3 Verse–Chorus Demo, C4 Minor Indie Ballad, C5 12-Bar Shuffle, C6 Modal Vamp, C7 Chromatic Color, Finale: Album Single, Finale: public-domain transcription) and **Side B — Advanced** (J1–J4, F1–F3, A1 ×2), plus **B-sides** (sketches promoted by the learner).
- **Songs** shelf after the sides: one tile per unit song, open or released, with its stage ("Still growing", "Every lesson is in", "Ready for the album", "On the album", "Off the album"). A released song is listed there only, never again as a B-side; its tree-ring cover follows it to the hero and its track page, and its length and Play all count it.
- Cover grid: 4 columns at L, 220 px covers.
- Empty slots are dashed with the capstone name and when it unlocks.

**Track page layout:** left 400 (cover 360 + liner notes) | right (player, versions, tabs).
- **Player:** live Strudel playback (it is code) with a waveform-like ring progress; **Export audio** records in real time via MediaRecorder ("Recording 1:42…"; UI sounds and the mic are suppressed).
- **Tabs:**
  - Lead sheet: staff in lead-sheet mode, printable, SVG export;
  - Code: Workbench `compact`, read-only; **Revise** opens the capstone workspace and the next release becomes v(n+1);
  - Review: Claude's structured critique (§6.5);
  - Versions: timeline v1…vn, each with its cover, date, auto change summary ("Melody bars 5–8 rewritten; added ♭VI in bar 7") and an optional mini-review.
- **Liner notes:**
  - generated deterministically from analysis: key/mode, tempo, meter, form (labels / `arrange`), detected schemas, devices (secondary dominant, borrowed chord, modulation), instruments, tools used, with each item linked to its leaf on the Oak (showing current R and **Revive**);
  - the learner's line;
  - Claude's listening note (only with consent);
  - credits, including sound attributions (e.g. "Piano: Salamander Grand Piano, CC-BY 3.0").

**Cover algorithm "Tree Rings"** (`src/ui/album/coverRings.ts`, a pure function `(events, meta, seed) → SVG string`, snapshot-tested with bun test):
- Canvas 1000×1000, centre (500, 500). The pith (r=60) is filled with the degree-1 colour and labelled with the key.
- Ring width = 380 / nBars. Bar *b* occupies [60 + b·w, 60 + (b+1)·w], inner rings first.
- Ring background is the function colour of that bar's chord at 12% opacity, otherwise `--bark-neutral`.
- Pitched event:
  - arc starting at angle θ = 2π·(onset within bar) − π/2 (12 o'clock = beat 1);
  - sweep = 2π·duration;
  - radial position inside the ring = pitch normalised to the track's range;
  - stroke = degree colour; width 2–6 px from gain/velocity.
- Drum events are short radial ticks on the ring boundary: kick outward, snare inward, hats 2 px dots.
- Organic woodgrain: deterministic noise displacement ≤1.5 px seeded by `trackId`.
- Title in Fraunces at the bottom left, album name small at the top right. Each version gets its own cover.

### 5.4 Streak and weekly rhythm

- **Practice day:** a local day (boundary 04:00) with at least one completed review set or Keep-alive. Keep-alive is 8 min: due reviews plus a 1-minute "riff of the day" micro-make that saves a sketch.
- **Rests:** earn 1 rest per 7 practice days, bank at most 2. A missed day automatically consumes a rest and is drawn as 𝄽.
- **Ties:** if no rest is available, the streak enters an "open tie" for 48 h. Completing a **Repair set** (one extra 5-min set beyond that day's own) draws a tie ⁀ over the gap and continues the streak. If it lapses, the copy is "A new phrase begins. Longest run: 41 days." Neutral styling.
- **Weekly rhythm:** a 7/4 bar. Filled notehead = full session; hollow half note = Keep-alive; 𝄽 = rest used; empty = nothing. The goal line reads "5 of 7" (configurable 3–7).
- **Copy examples:**
  - "You missed Thursday. A short repair set by Saturday ties it over."
  - "Rest used for Sunday — that's what rests are for."

### 5.5 Milestones and can-do ledger

**Can-do statement:**
```ts
interface CanDo { id: CanDoId; area: 'hear'|'read'|'write'|'compose'|'transcribe'|'sing'|'code';
  text: string; evidence: Array<{ kind: 'family'|'lesson'|'checkpoint'|'track'; ref: string }>;
  status: 'notYet'|'emerging'|'solid'|'strong'|'fading'; firstAchieved?: string }
```
- emerging = first evidence;
- solid = ≥85% on 2 separate days;
- strong = solid and R ≥ 0.9 for 30 days;
- fading = R < 0.75.

Examples:
- `cd.hear.deg.major` "I can name any degree in a major key by ear."
- `cd.read.rhythm16` "I can read and clap 16th-note rhythms."
- `cd.compose.fourchord` "I can write an 8-bar song over a four-chord loop."
- `cd.hear.schemas.pop` "I can recognise I–V–vi–IV, vi–IV–I–V and i–♭VI–♭VII in real songs."
- `cd.transcribe.bass.pop` "I can transcribe the bass line of a pop song."
- `cd.jazz.iiVI.12keys` "I can write ii–V–I in all 12 keys."

**Milestones** (full-width banner in Coda + entry on the Progress timeline; each banner plays 2 bars of the learner's own most recent track):

| id | Trigger | Banner |
|---|---|---|
| M1 | C0 released | "You can make a beat." |
| M2 | C1 released | "You can build a loop with a bass line." |
| M3 | C2 released (~session 74) | "You can now compose a song." |
| M4 | CP U7 | "You can read a lead sheet." |
| M5 | Gym L5 passed + U10 | "You can transcribe a pop song's bass and chords." |
| M6 | C4 + C5 | "You can write in minor and in the blues." |
| M7 | Core Finale | "You finished the core. Side A is complete." |
| M8 | J-track gym L6 | "You can transcribe a jazz standard's changes." |
| M9 | J4 | "You can reharmonise a standard." |

---

## 6. Tutor UX (`src/ui/tutor/`)

### 6.1 Panel anatomy (360 px docked)

```
┌ Claude · ready ●             Thread: U6.4 ▾   ⋯ ┐
│ ─ context chips ─────────────────────────────── │
│ [U6.4 › Modify] [Code 9 lines] [Result: 2 issues] [Hints 1/4] [Bars 3–4] │
│ ─ messages ───────────────────────────────────── │
│ You: why does bar 3 sound off?                   │
│ Claude: (thinking summary line, collapsible)     │
│   "…your bass plays [[deg:6]] under a [[rn:IV]]…"│
│   ┌ strudel card: ▶ Preview  Diff  Apply ─────┐  │
│ ─ suggested prompts (3 chips) ────────────────── │
│ [Give me a nudge] [What's different in bar 3?]   │
│ ┌ composer (Enter send, Shift+Enter newline) ┐   │
│ └ + selection  + bars  + result      ≈ month $3.1┘│
└──────────────────────────────────────────────────┘
```

**States**

| State | Display |
|---|---|
| idle | status dot `ready` |
| streaming | live **thinking summary** line in italics `--text-3` (from `display:'summarized'`); text streams below |
| tool running | collapsed activity rows: "Played your code headlessly (8 bars) ✓", "Compared with target: 2 differences" |
| record_observation | chip "Noted: mixes up 4 and 6" with **Remove** (appends a retract event) |
| error mid-stream | "Claude was interrupted (overloaded). Retry" — the partial text is kept |
| rate-limited | "Cooling down — 0:42" |
| offline / no key | "Tutor offline. Lessons, hints and grading all work without it." plus setup steps |

`Esc` stops generation.

### 6.2 Threads and context chips

- **Threads** (append-only, one per topic): `general`, `lesson:{id}`, `capstone:{id}`, `transcription:{projectId}`, `sketch:{id}`, `track:{id}`.
  - The panel switches thread with the route; the General thread can be pinned.
  - **New thread** starts a fresh thread and archives the old one; nothing is deleted.
- **Chips** show exactly the volatile context injected into the newest user turn.
  - Click toggles inclusion (struck through when excluded).
  - The popover shows the payload summary ("What Claude sees").
  - Defaults by surface: Lesson = Step + Code + Result + Hints; Studio = Code + Selection; Transcription = Project + Code + a 🔒 "Audio never sent" chip (lock icon only, not toggleable); Track = Track + Code + Liner analysis; General = Progress snapshot.
- Composer attachments: `+ selection` (code range), `+ bars` (roll selection), `+ result`.

### 6.3 Suggested prompts (3 chips, rotated by state)

| State | Chips |
|---|---|
| concept / listen | "Why does 7 pull to 1?" · "Play me this in minor" · "How would a jazz player use this?" |
| failed check | "Give me a nudge" · "What's different in bar N?" · "Explain this error" |
| make | "Is my melody too jumpy?" · "Suggest a stronger ending" · "What would make bar 4 more interesting?" |
| Studio | "What's this progression called?" · "Make this swing" · "Help me add a bass line" |
| transcription | "Does bar 5's chord fit the bass?" · "What form is this?" · "Where should I listen next?" |
| drill (between sets) | "How do I hear 6 vs 4?" · "A memory hook for ♭7?" |

### 6.4 Music-aware rendering and code cards

**Markup the tutor is instructed to emit** (parsed in `MusicTokens.tsx`):
- `[[deg:5]]` → degree pill in its colour; click plays cadence + degree in the current key.
- `[[rn:V7]]` → function-coloured RN pill; click plays the chord.
- `[[note:F#4]]` → note pill (plays).
- `[[bars:3-4]]` → link that loops bars 3–4 in the active Workbench.
- `[[tool:voicing]]` → toolbox link; a locked tool shows a lock and its unlock condition.

**```strudel fences → `CodeSuggestionCard`:**
- mini Workbench preview (editor + 1-row roll; ▶ Preview through the evaluation mutex, solo);
- **Diff** tab (unified, token-level, against the current editor code or against the stated selection);
- **Apply** (one CM6 transaction; `Cmd+Z` undoes it);
- **Apply to new sketch**;
- a badge listing tools used; locked tools are flagged ("uses `.voicing()` — unlocks after U5"). The server lints suggestions with the same toolbox lint.
- In graded steps below rung 4, Apply is disabled for code touching the graded region, with the tooltip "Try it yourself first — or take hint 4."

### 6.5 Structured reviews (high effort)

**Capstone review** (zod, strict):
```ts
const CapstoneReview = z.object({
  overall: z.string(),                                          // ≤80 words (prompt-enforced)
  strengths: z.array(z.object({ text: z.string(), bars: z.array(z.number()) })),   // 2–4
  suggestions: z.array(z.object({ title: z.string(), bars: z.array(z.number()), why: z.string(),
                                  tryCode: z.string(), theoryTags: z.array(z.string()) })), // 1–4
  theoryUsed: z.array(z.object({ conceptId: z.string(), evidence: z.string() })),
  listeningNote: z.string(),                                    // 2–3 sentences, liner-notes ready
  nextChallenge: z.string(),
});
```

**Transcription review:** `{ overall, sections: [{ name, bars, bass, harmony, melody, questions[] }], plausibilityFlags: [{ bars, issue, suggestion }], nextFocus }`.

**Rendering (`ReviewSheet.tsx`):**
- Overall paragraph.
- Strengths as bar-anchored bullets.
- Suggestion cards, each with a bar-range pin, theory reason, a `tryCode` card, and **Mark done**.
- Theory-used chips linking to leaves.
- Optional "Next challenge".
- Bar pins appear as comment markers on the roll and staff timelines; clicking one jumps to and loops those bars.
- Header line: "Claude's comments never affect pass/fail."

### 6.6 Listening notes

- Generated in Coda for today's sketch (low effort), 2–3 sentences.
- Must cite at least one concrete fact (bar, degree, chord or rhythm) and may ask one question; no generic praise.
- Tooltip: "Claude reads your notes and code — never your audio."
- Today's TutorNoteCard is a one-line bridge from a recorded observation to today's lesson ("Yesterday's ending on 7 felt unresolved — today you'll meet the reason: the dominant.").

### 6.7 Persona and tone

**Identity:** "Claude", shown honestly; avatar is a small oak leaf. Voice:
- warm, musically literate, concise (≤120 words for hints and chat unless asked);
- scale-degree language first, plus syllables when singing is involved;
- sound-first verbs ("hear how 7 leans up to 1");
- specific praise only;
- admits uncertainty; never claims to hear audio.

**Socratic ladder when the learner is stuck:** ask one question → point to the location → model with a different example (another key or bar) → reveal only at rung 4 via the UI button.

| Do | Don't |
|---|---|
| "Bar 3: your bass is on [[deg:6]] but the chord is [[rn:IV]]. Which chord has 6 as its root?" | "Great job! You're so close! Just change it to 5." |
| "Try singing the bass of bars 1–4 before naming chords." | Dumping the full solution before rung 4 |
| "I can't hear audio, but reading your score…" | "That sounded lovely." |

### 6.8 Cost and health transparency

- Settings → Tutor shows a monthly token and $ estimate (logged usage × price table) and an optional soft budget that warns but never blocks.
- The panel footer shows the month's estimate in `--text-3`.
- Health comes from `/api/health`: `{ tutor: 'ready'|'missing_key'|'invalid_key'|'unreachable' }`. The key never reaches the browser.

---

## 7. Visual design language

### 7.1 Name and tone

**Oak** reads as warm, crafted, calm and precise, "a woodshop studio at dusk". The chrome is warm neutral; saturated colour is reserved for musical meaning. Light theme **Paper**, dark theme **Bark**; System follows `prefers-color-scheme`. Html class `oak-dark` is used instead of `dark`, because StrudelMirror toggles `dark` on `<html>`.

### 7.2 Colour tokens (`src/ui/theme/tokens.css`)

| Token | Paper | Bark |
|---|---|---|
| `--bg` | #F6F2EA | #14110E |
| `--surface` | #FFFDF8 | #1C1814 |
| `--surface-2` | #EFE9DE | #26201A |
| `--border` | #DDD3C3 | #3A3128 |
| `--text` | #1F1A14 | #F2EBDF |
| `--text-2` | #5C5247 | #BDB2A3 |
| `--text-3` | #8A7F72 | #8C8172 |
| `--accent` (oak green) | #2F6B45 | #6FBF8A |
| `--accent-2` (acorn amber) | #B7791F | #E0A54A |
| `--link` (hover/selection) | #2F6B45 | #6FBF8A |
| `--issue` | #B4532A | #E07B4F |
| `--lane-in` | rgba(47,107,69,.06) | rgba(111,191,138,.07) |
| `--danger` (destructive only) | #A4262C | #E5484D |
| `--focus` | 2 px `--accent` + 2 px `--bg` offset | same |

### 7.3 Music-semantic palette (`src/ui/theme/palette.ts`)

| Degree | Okabe–Ito base | Paper (fill) | Bark (fill) | Label colour |
|---|---|---|---|---|
| 1 | vermillion | #D55E00 | #F07A2A | white |
| 2 | orange | #E69F00 | #F2B53A | #1F1A14 |
| 3 | yellow | #E8D93A (+1 px #8A7A10 outline) | #F3E86A | #1F1A14 |
| 4 | bluish green | #009E73 | #2BC08F | white / #14110E |
| 5 | sky blue | #56B4E9 | #7CC8F2 | #1F1A14 |
| 6 | blue | #0072B2 | #3B95D6 | white |
| 7 | reddish purple | #CC79A7 | #DE97C0 | #1F1A14 |
| non-diatonic / unknown | neutral | #8A7F72 | #8C8172 | white |

Rationale: Okabe–Ito is the standard colour-blind-safe 8-category set.

- **Alterations:** base degree colour plus pattern — ♭ = 45° hatch (4 px), ♯ = −45° hatch. The label always prints ♭/♯ (e.g. `♭7` on the 7-colour with hatch).
- **Functions:** T = degree-1 colour, PD = degree-4 colour, D = degree-5 colour, always with the text label T / PD / D. Chromatic or secondary functions use the target's function colour plus a dashed border, e.g. V/V = D-colour dashed.
- **Chord tones:** §3.4. **Parts palette** (layers, drums, never pitches): #8C6A4F, #6F7D5C, #5E6F86, #8A6A86, #9A7B3F, #5F8077.
- **Usage rule:** wherever a degree colour appears, the degree number appears too (in-note label, gutter label or tooltip for tiny marks). A `/dev/palette` page renders all states under CVD simulations as a QA artifact.

### 7.4 Typography (self-hosted woff2, `src/ui/theme/fonts/`)

| Role | Font | Sizes |
|---|---|---|
| Display / headings | **Fraunces** (variable, soft, opsz) — organic warmth that suits Oak | 28 / 22 / 18, weight 560 |
| UI / body | **Inter** (variable; tabular numerals on) — legible at small sizes | 15 base, 13 small, line-height 1.5 |
| Code | **JetBrains Mono** — clear 0/O, good at 15 px | editor 15 (13–20) |
| Music glyphs | **Bravura** (SMuFL, OFL) | ♭ ♯ 𝄽 ⁀ clefs inline |

Prose is limited to 60 characters per line in the prompt column.

### 7.5 Layout

- 4 px base grid; spacing scale 4, 8, 12, 16, 24, 32, 48.
- Radii 6 (controls), 10 (cards), 16 (sheets).
- Borders 1 px `--border`. Shadows only in Paper (`0 1px 2px rgba(31,26,20,.06), 0 4px 12px rgba(31,26,20,.05)`); Bark uses borders.
- Control heights 32 (default) and 40/48 (primary).

### 7.6 Motion

- Tokens: `--dur-fast 120ms`, `--dur-base 200ms`, `--dur-slow 360ms`, `--ease-out cubic-bezier(.2,.8,.2,1)`.
- **Beat-synced:** when audio is playing, ceremonial motion (unlock flips, milestone banners, leaf growth) starts on the next downbeat.
- **Reduced motion** (system or setting):
  - no growth or flip, cross-fade only (≤120 ms);
  - no shakes;
  - the playhead still moves;
  - **calm highlighting** — tokens keep a steady outline while their part is active instead of retriggering per hap (also user-selectable; protects against fast flicker such as `hh*16`).

### 7.7 UI sound design (`src/audio/uiSounds.ts`)

- A tiny own synth: triangle oscillator, 5 ms attack, 180 ms exponential decay, light lowpass.
- Signal path: `uiBus` GainNode at −24 dBFS → `ctx.destination`. It bypasses the master limiter and recorder tap.
- Pitches come from the current lesson key, otherwise the "key of the day" (rotates by fifths daily).

| Event | Sound |
|---|---|
| step passed | 3 → 5 |
| check failed | single soft 2 (unresolved; invites retry) |
| hint opened | none |
| set complete | 5 → 1 |
| session complete (Coda) | V → I two soft dyads |
| unlock | I–IV–V–I arpeggio, then the tool demo |
| tie / rest applied | 5 ⁀ 5 |
| album release | the track's own first 2 bars (via Strudel) |

- **Auto-muted** during ear trials, mic capture, transcription audio and recording. When the Workbench is playing, events are queued to the next beat.
- Off switch in Settings.

### 7.8 Iconography

- **Lucide** (ISC), 20 px, 1.5 px stroke.
- Nav: Today `sunrise`, The Oak custom oak, Practice custom ear/tuning-fork, Studio `notebook-pen`, Transcribe `audio-waveform`, Album custom vinyl-ring, Toolbox `wrench`, Progress `list-checks`, Settings `settings`.
- Step icons: listen `headphones`, predict `circle-help`, run `play`, investigate `search`, see `music`, concept `book-open`, modify `pencil`, parsons `move`, quiz `list-checks`, ear `ear`, sing `mic`, tap `hand`, dictate `pen-line`, notate `pen-tool`, compare `split`, make `sprout`, reflect `message-circle`.
- Custom set (`src/ui/icons/`): oak leaf, acorn, ring, rest, tie.

### 7.9 Accessibility

- WCAG 2.2 AA contrast across both themes; visible focus everywhere; skip link "Skip to workbench".
- **Keyboard-complete:** every flow is operable without a pointer, including StaffInput, Parsons and the tree (§5.2).
- **ARIA:**
  - DegreePad `radiogroup`; RomanPad `grid`; StepRail `list` with `aria-current="step"`;
  - grader summary and tutor stream in `aria-live="polite"` (tutor chunked per sentence);
  - roll and staff have the **Notes table** alternative; PitchLane has a text summary.
- **Colour:** never alone (numbers, patterns, shapes, text labels).
- Everything audible has a visual twin (count-in numerals, visual metronome, cadence chord lights).
- **No timed failures** except intrinsically rhythmic tasks; response speed only lifts Good to Easy.
- 200% zoom: panels stack; editor font independent from UI scale.

### 7.10 Keyboard shortcuts (`src/ui/keys/keymap.ts`)

**Global**

| Keys | Action |
|---|---|
| `Cmd/Ctrl+K` | Command palette |
| `Cmd/Ctrl+J` | Toggle tutor |
| `Ctrl+.` / `Cmd+.` / `Alt+.` | **Stop all audio** (panic; Strudel-consistent) |
| `Space` | Play/stop the focused workbench (not in text fields or on focused buttons) |
| `?` | Shortcut sheet |
| `G` then `T L O P S R A B C ,` | Go to Today, Lesson (resume), Oak, Practice, Studio, tRanscribe, Album, toolBox, Can-do, Settings |
| `Cmd/Ctrl+Shift+M` | Close mic (privacy) |
| `Esc` | Close overlay / leave focus mode (place saved) |

**Editor** (Strudel-compatible; on macOS both Ctrl and Cmd work)

| Keys | Action |
|---|---|
| `Ctrl/Cmd+Enter`, `Alt+Enter` | Run (evaluate + play/update) |
| `Ctrl/Cmd+.`, `Alt+.` | Stop |
| `Alt+Q` / `Alt+W` | Previous / next `$:` block |
| `Cmd/Ctrl+/` | Toggle comment |
| `Cmd/Ctrl+Shift+Enter` | Check / Submit |
| `Cmd/Ctrl+I` | Ask Claude about selection |
| `Cmd/Ctrl+S` | Save named version (Studio) |
| `Ctrl+Space` | Autocomplete |
| `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z` | Undo / redo (includes applied suggestions) |

**Workbench** (focus on the workbench, not the editor): `L` loop, `[`/`]` shrink/extend loop, `Shift+[`/`Shift+]` move loop, `R` roll, `N` notation, `K` keyboard (typing-keyboard play), `M` metronome, `A`/`B` A/B, `Shift+A` alternate bar, `T` practice tempo, `F` focus editor.

**Lesson:** `Enter` Continue / primary; `H` next hint; `Alt+←/→` previous/next completed step.

**Drills:** `1`–`7` answer; chromatic `A W S E D F T G Y H U J K`; `Enter` submit/next; `C` cadence; `R` replay; `S` skip singing; `P` play mine; `Backspace` remove slot; tap with `Space` or `F`/`J`.

**Staff input:** §4.5.

**Transcription:** `Space` play/pause audio; `[`/`]` set A/B at the playhead; `L` loop; `,`/`.` rate −/+5%; `-`/`=` semitone −/+; `V` original ⇄ mine; `O` overlay; `T` tap tempo; `Alt+←/→` previous/next bar.

**Tutor composer:** `Enter` send, `Shift+Enter` newline, `Esc` stop generation, `↑` recall last message as a new draft.

### 7.11 Microcopy voice

Second person, short, musical words, no exclamation marks on failure, no guilt.

| Situation | Copy |
|---|---|
| Check failed | "Not quite — bars 2 and 4 differ. Listen to bar 2 again?" |
| Passed | "That's it: 4 4 3 3 2 2 1. The tune walks home." |
| Fading leaves | "4 leaves are drying. A 3-minute set will green them up." |
| Unlock | "New tool: `.voicing()`. You voiced 12 inversions by hand — now let Strudel lead the voices; you'll know what it's doing." |
| Mic privacy | "Your voice is analysed live on this computer. Nothing is recorded or sent." |
| Own audio | "Your audio file stays on this device. Claude only sees your transcription code." |
| Done | "Session complete. Stopping here is good practice." |

---

## 8. Onboarding (first 10 minutes) = lesson U0.1 "Hello, loop"

> **Superseded in part (2026-11-15).** The built order is welcome → loop → edit → react → prefs → tutor →
> headphones → mic → range → latency → first-sing → sketch → coda (`app/src/onboarding/flow.ts`). The frame every
> step uses, its words, each step's states, the paths without a mic and the retry rule are in
> `docs/design/retry.md` §2 and §6, which win over the table below.

**Wow loop** (shipped as `content/units/u00-start/l01-hello-loop.lesson.ts`; only the final melody token is editable):
```js
// Oak · first loop
setcpm(92/4)

$: s("bd ~ sd ~, hh*8").bank("RolandTR808").gain(.8)
$: note("<c2 a1 f1 g1>").s("ebass")
$: chord("<C Am F G>").voicing().s("rhodes").gain(.5)
$: n("<[4 ~ 2 4] [0 ~ ~ 2] [5 ~ 3 5] [4 ~ ~ ~]>").scale("C4:major").s("piano")
```
The melody's chord tones line up with the chords: G E G over C; C E over Am; A F A over F; G over G.

| t | Screen id | What happens | Why |
|---|---|---|---|
| 0:00 | `onb.welcome` | Rings logo; "Learn music by making it." **Start sound** (`Enter`/`Space`/click) → `ctx.resume()` + `initAudio()`; preload drums first, then ebass, rhodes and piano (≈9 MB from localhost; Service Worker caches it). | Gesture unlock |
| 0:05 | `onb.loop` | Drums start at once. Layers un-mute at bars 2 (bass), 3 (chords) and 5 (melody); each code line lights as it enters. Roll in part colours; staff hidden. The transport keeps play/stop, the bar counter and the mute chips only (no tempo, key, practice speed, loop, metronome or solo on day 1). Caption: "This is code. Each line is a musician." The four lines carry small "you'll unlock this" tags. | Awe; staged entry hides loading |
| 0:40 | `onb.edit` | Dashed box on the last `4`: "Change this number to anything from 0 to 7, then press Ctrl+Enter." The roll updates instantly; the bar-4 note pulses with "plays in N bars". | Agency |
| ≤1:30 | `onb.react` | Deterministic reaction keyed by the chosen value, e.g. 6 → "You ended on 7 (ti). Hear how it leans up, wanting to go home?"; 0 → "You ended on 1 (do) — home, though the chord underneath hasn't arrived yet." 8 variants. | **Wow** without an API dependency |
| 1:45 | `onb.tutor` | `/api/health` ready → tutor slides in and streams a 2-sentence greeting that references the edit (low effort). Otherwise a non-blocking card: "Connect your tutor: add `ANTHROPIC_API_KEY=…` to `.env.local` in the Oak folder and restart `bun run start`. The key stays on the server." **Check again**. | Tutor is central and honest |
| 2:30 | `onb.headphones` | §4.7 `audio.headphones` | — |
| 3:15 | `onb.mic` | `mic.permission`, `mic.noise`, `mic.bleed` | — |
| 4:45 | `onb.latency` | `latency.tap` (singing latency deferred to U0.2) | — |
| 5:30 | `onb.range` | `voice.range` | — |
| 7:00 | `onb.firstSing` | The loop plays softly: "Sing the note that feels like the end." PitchLane with a hidden target (C, folded). On success the loop resolves with the learner's note highlighted: "That note is 1 — do. Everything in Oak is measured from here." | Second wow; core metaphor |
| 8:15 | `onb.prefs` | Style (Pop · Jazz-soul, each with Hear it; the names and blurbs of the song style cards); daily target 15/20/25; weekly goal (default 5); optional **Add to calendar** (.ics). | Autonomy |
| 9:00 | `onb.sketch` | "Make it yours — change anything, then save." Saves **Sketch 001**. | Every session ends with a sketch |
| 9:40 | `onb.coda` | Coda-lite: seedling sprouts; Toolbox ceremony for `s()` + `piano` + uzu kit; teaser "Next: Rows and layers" (`$:` and mini-notation). **Done for today** / *Continue to U0.2*. | Close the loop |

U0.2 "Rows and layers" covers `$:`, mini-notation basics, `setcpm` and the singing-latency calibration. U0.3 "Sketchbook and tutor" is a Studio tour, a first tutor question and a saved sketch.

---

## 9. UX data contracts and file map (for the architect)

**UI-facing types** (`src/shared/ux-types.ts`):
```ts
interface TodayPlan { date: string; targetMinutes: 15|20|25; keyOfDay: string;
  warmup: { items: Array<{ kind: 'fact'|'family'|'sing'; ref: string; estSec: number }>; estMinutes: number; overflow: number };
  main: { kind: 'lesson'|'capstone'|'checkpoint'|'gym'|'welcomeBack'; id: string; title: string;
          estMinutes: number; stepKinds?: StepKind[]; resumeStep?: string };
  make: { title: string; estMinutes: number };
  nextUnlock?: { toolId: ToolId; remaining: number; unit: 'lesson'|'checkpoint'|'capstone' };
  teaser?: { code: string; endsOn: 'V' };
  tutorNote?: string; alt: Array<'keepAlive'|'gym'|'capstone'|'studio'> }
interface StreakState { current: number; longest: number; restsBanked: 0|1|2;
  openTie?: { gapDate: string; expiresAt: string }; week: Array<'full'|'keepAlive'|'rest'|'tie'|'none'>; weeklyGoal: number }
interface OakLeaf { conceptId: ConceptId; status: 'bud'|'new'|'learned'; recall: number; nextDue?: string;
  components: Array<{ kind: 'fact'|'family'; ref: string; recall: number }> }
interface Sketch { id: string; title: string; code: string; key: string; meter: Meter; bpm: number;
  source: 'lesson'|'studio'|'keepAlive'|'capstone'; lessonId?: string; versions: number; createdAt: string }
interface Track { id: string; capstoneId: string; side: 'A'|'B'|'Bside'; title: string; versions: TrackVersion[] }
interface TrackVersion { v: number; code: string; coverSvg: string; liner: LinerNotes; review?: CapstoneReview; changeSummary?: string; createdAt: string }
interface VoiceProfile { low: number; high: number; comfortLow: number; comfortHigh: number; // MIDI
  tolerance: 70|50|35|25; tapLatencyMs: number; singLatencyMs: number; noiseFloorDb: number; outputKind: 'wired'|'bluetooth'|'speakers' }
```

**SQLite tables the UX depends on** (names suggested): `sessions`, `session_events`, `streak_days`, `rests`, `unlocks`, `can_do`, `sketches`, `sketch_versions`, `tracks`, `track_versions`, `reviews`, `tutor_threads`, `tutor_messages` (append-only), `observations` (+ retract events), `voice_profile`, `settings`, `transcription_projects` (+ local audio path).

**File map**
```
src/routes/                     TanStack file routes (§2.2)
src/ui/shell/                   AppShell, NavRail, TopBar, FocusHeader, AudioStatus, CommandPalette, PlaybackCoordinator
src/ui/today/                   SessionSetlist, NextUnlockCard, TreeGlance, WeeklyRhythm, StreakChip, LastSketchCard, TutorNoteCard, AltPaths
src/ui/lesson/                  LessonPlayer, StepRail, steps/*.tsx (one per StepKind), FeedbackTray, ChecksList, HintLadder, Coda
src/ui/workbench/               Workbench, Editor (StrudelMirror host), Transport, PianoRoll, DrumLanes, Staff, StaffInput, Keyboard, NotesTable, linkBus.ts, abTarget.ts
src/ui/drills/                  TrialFrame, DegreePad, RomanPad, DegreeSlots, BassFirstFlow, PitchLane, TapPad, JustListen
src/ui/tutor/                   TutorPanel, ContextChips, MessageView, MusicTokens, CodeSuggestionCard, ReviewSheet, SuggestedPrompts
src/ui/oak/                     OakTree (SVG), LeafInspector, CourseList, LeavesTable
src/ui/album/                   AlbumGrid, TrackPage, coverRings.ts (pure), LinerNotes, VersionsTimeline
src/ui/toolbox/                 ToolGrid, ToolCard, InstrumentWall, UnlockCeremony
src/ui/transcribe/              ProjectList, TranscriptionStudio, Waveform, BeatGrid, Mixer, Checklist
src/ui/theme/                   tokens.css, palette.ts, fonts/
src/audio/uiSounds.ts           UI synth bus
src/flows/                      session.machine.ts, step.machine.ts, trial.machine.ts (XState)
content/units/uNN-*/lNN-*.lesson.ts (+ .mdx)   content/toolbox.catalog.ts   content/oak.layout.ts
content/cando.ts   content/capstones/*.ts   content/onboarding/reactions.ts (8 deterministic variants)
```

**Transcription Studio** (`/transcribe/$projectId`), condensed spec:
```
┌ waveform 180 (wavesurfer: regions = sections, bar lines from BeatGrid, spectrogram toggle) ┐
│ rate 25–100% · semitones −12..+12 · A–B loop · "Fit my voice" (transpose into comfort zone) │
├──────────────────────────── Workbench (60%) ───────────────┬──── Ladder + Checklist (40%) ─┤
│ $: bass   $: chords   $: melody   $: drums                 │ Bass → Chords → Melody → Drums │
│                                                            │ → Form   per-section checklist │
├─ Mixer: Original ◀━━━●━━━▶ Mine · V alternate · O overlay (orig L / mine R) · Play from bar N ┤
└────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **BeatGrid:** tap tempo (`T`, 8 taps) → drag the bar-1 marker onto the downbeat → bar lines overlay the waveform. "Play from bar N" starts both the audio and Strudel there.
- **Ladder projects L1–L6** use Oak-generated or public-domain Strudel renditions as the "audio" and have graded answer keys.
- **"Your songs"** (BYO) are self-assessed: checklist rows each have A/B; the tutor reviews code only.
- Drop zone copy: "Drop an audio file — it stays on this device."

---

## 10. UX acceptance criteria (Playwright e2e and `bun test`)

1. **Onboarding:** from the **Start sound** click to the edited note playing in the loop takes ≤90 s with a scripted user. Roll update after `Ctrl+Enter` takes ≤100 ms.
2. `Ctrl+.` from any route silences all sources within 50 ms (PlaybackCoordinator).
3. Grader feedback appears ≤300 ms after Run for ≤8 bars. A grader timeout shows "That took too long — infinite loop or huge pattern?" and never freezes the UI.
4. The hint ladder never shows `fix` or `expected` before rung 3. The tutor payload never contains `solution` before rung 4 (asserted on the server request log).
5. UI sounds are silent during ear trials, mic capture, transcription playback and recording (assert `uiBus.gain == 0`).
6. With the mic open, the Mic-live indicator is visible; it closes within 200 ms of leaving a sing step.
7. With reduced motion on: no transforms longer than 120 ms; calm highlighting active.
8. Every degree-coloured mark has a visible or accessible degree label (axe + custom check on roll, staff and pads).
9. `coverRings` and liner-notes output are deterministic: the same events and seed produce a byte-identical SVG (snapshot).
10. **Streak:** a missed day with a banked rest consumes it. With no rest, a repair set within 48 h produces a tie. After 48 h the streak resets with no red UI.
11. At 1280×800 every primary action in Lesson Player and Drills is visible without scrolling, with the tutor drawer closed.

**To verify early** (UX-affecting):
- whether Strudel's mini-location outline honours a `value.color` injected through `editPattern` in 1.2.6 (degree-coloured code highlights);
- equal-length label rewrite for mute/solo (`$:` → `_:`) against the 1.2.6 `.p` mute rule;
- `ribbon` loop alignment with the transport counter;
- a listening pass to freeze the instrument aliases.

### Critical Files for Implementation
- /Users/fpl0/Code/Oak/src/ui/workbench/Workbench.tsx (with linkBus.ts, PianoRoll.tsx, Staff.tsx, Transport.tsx)
- /Users/fpl0/Code/Oak/src/ui/lesson/LessonPlayer.tsx (with HintLadder.tsx, FeedbackTray.tsx, steps/*)
- /Users/fpl0/Code/Oak/src/content/schema.ts (Lesson/Step/CheckSpec/GradeResult contracts)
- /Users/fpl0/Code/Oak/src/ui/tutor/TutorPanel.tsx (with ContextChips.tsx, MusicTokens.tsx, CodeSuggestionCard.tsx, ReviewSheet.tsx)
- /Users/fpl0/Code/Oak/src/ui/theme/palette.ts (degree, function, chord-tone and parts palettes shared by roll, staff, editor and pads)