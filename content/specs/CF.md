# CF The Core Finale: unit spec

<!-- GENERATED from content/specs/CF.ts by `bun scripts/content/spec.ts`. Edit the .ts, never this file; content/validate/specs.test.ts fails when they differ. -->

The two tracks that close Side A, and the two ladder levels that go with them. CF-T "Standard Transcription" runs first, in the gym slots from U15.L01 (sessions 156, 161, 166 and 171 of the default order): a 1920s standard taken down by ear, the form map and the bass, then the changes, then the melody, then the learner's own arrangement of it. CF-A "Album Single" comes last (sessions 182–185): the learner's own song, two minutes or more, with a verse, a chorus and a bridge and four or more of the six devices the core taught. Neither teaches anything new; both ask the learner to use, unprompted, what half a year of lessons gave them. When both are released, and every other core track with them, the core is complete (content/specs/END.md). Ladder level L7 (the learner's own audio, self-assessed) is specified here as it stands; L8 (a full arrangement) is new.

This spec has no lessons. `bun test content/validate/specs.test.ts` checks that this document is the current rendering of its source; the capstone rubrics, session flags, slots and ladder titles it prints are read from the registries.

## Conventions for this unit

- Session numbers are those of contracts 1.6 (§2.5): CF-T.S1–S4 are sessions 156, 161, 166 and 171, C7 is 178–180, GYM.17 is 181, CF-A.S1–S4 are 182–185, and the core is complete at 185. The wave plan's "session 183" is this session 185 (U05.L09 and C3.S4 each added one).
- Nothing is introduced in a finale: no new tool, no new glossary term, no new skill. Every sound, function and idea a brief, a starter or a test uses is unlocked in every legal order at its session (checked with `lintOak`: at CF-A everything through U17 is unlocked; at CF-T only what U15.L01 guarantees, so `trumpet`, `horns` and `tenor` are never in CF-T's authored code, though a learner who has them may use them).
- Plain words where the glossary has none: "master", "limiter", "form map", "the take" are explained in one sentence where the brief first uses them and are never linked as terms (contracts §10.8: the tutor describes them by what they do).
- A finale session is a capstone day (contracts §9.1): a 3-minute warm-up, the work (11, 15 or 20 minutes at the 15, 20 or 25 target) and the Coda; the saved draft is the Make. A session whose work is not finished when the learner stops keeps its draft and every passed check and stays the current session: Today offers "Continue" the next day, and for CF-T the next slot resumes it.
- Every session ends with something the learner can replay: the draft from bar 1, with whatever they added today. The Coda names the lines met today and the one thing next time is for.
- A capstone never gates (contracts §7.6): a learner may leave either finale open. While one is unreleased the core's stage is `lessons-done`, Today says what is left in one line, and nothing counts down.
- Rubrics do not change with the flavour (contracts §6.6). The golden tests carry one passing piece per shipped flavour (pop, indie, jazz-soul, funk).
- After editing content/capstones.ts or content/gym, run `bun scripts/content/spec.ts`: this document renders the rubric, the starter, the session flags, the slots and the ladder titles from them.

## CF-A Core Finale: Album Single

Author: **finale**. The last track of Side A (sessions 182–185 of the default order) and the learner's own song from the first bar: at least two minutes, a verse, a chorus and a bridge, and four or more of six devices (secondary dominant, borrowed chord, modulation, suspension, syncopated bass, modal colour). Session 1 fixes the plan at full length and lays the groove; session 2 writes the harmony and brings in the devices; session 3 writes the tunes and the bridge; session 4 arranges the energy, masters by ear, records the take and releases. The brief gives a frame and leaves the song to the learner; the workspace shows which of their own earlier tracks used which device, and the checklist counts devices as they appear. Nothing new is taught.

Opens after: {"capstones":["C7"]}. Meter 4/4, 60–160 BPM. Brief: "Write your single, the last track of Side A: two minutes or more, with a verse, a chorus, a bridge and four or more devices from the devices card. End it on purpose: the parts leave one by one, the last phrase gets shorter, it builds to one last hit, or it fades away. The rest is yours."

Starter:

```js
setcpm(100/4)

// The plan: intro 4, verse 8, chorus 8, verse 8, chorus 8, bridge 8, chorus 8, outro 4 = 56 bars, 2:14.
const kickVerse = s("bd ~ bd ~")
const kickChorus = s("⟪bd ~ bd ~⟫")
const kickBridge = s("bd ~ ~ ~")
const kickOutro = s("bd ~ ~ ~")
const snareVerse = s("~ sd ~ sd")
const snareChorus = s("~ sd ~ sd")
const snareBridge = s("~ ~ sd ~")
const hatsIntro = s("hh*4").gain(.4)
const hatsVerse = s("hh*8").gain(.4)
const hatsChorus = s("⟪hh*8⟫").gain(.45)
const hatsBridge = s("hh*4").gain(.4)
const bassVerse = n("<0 5 3 4>").struct("x*4")
const bassChorus = n("<3 4 0 0>").struct("x*4")
const bassBridge = n("<5 5 3 3 1 1 4 4>").struct("x ~ x ~")
const chordsIntro = chord("<C Am>").voicing()
const chordsVerse = chord("<C Am F G>").voicing()
const chordsChorus = chord("<F G C C>").voicing()
const chordsBridge = chord("⟪<Am Am F F Dm Dm G G>⟫").voicing()
const chordsOutro = chord("<F G C C>").voicing()

kick: arrange([4, silence], [8, kickVerse], [8, kickChorus], [8, kickVerse], [8, kickChorus], [8, kickBridge], [8, kickChorus], [4, kickOutro])
snare: arrange([4, silence], [8, snareVerse], [8, snareChorus], [8, snareVerse], [8, snareChorus], [8, snareBridge], [8, snareChorus], [4, silence])
hats: arrange([4, hatsIntro], [8, hatsVerse], [8, hatsChorus], [8, hatsVerse], [8, hatsChorus], [8, hatsBridge], [8, hatsChorus], [4, silence])
bass: arrange([4, silence], [8, bassVerse], [8, bassChorus], [8, bassVerse], [8, bassChorus], [8, bassBridge], [8, bassChorus], [4, silence]).scale("C2:major").s("ebass").lpf(600)
chords: arrange([4, chordsIntro], [8, chordsVerse], [8, chordsChorus], [8, chordsVerse], [8, chordsChorus], [8, chordsBridge], [8, chordsChorus], [4, chordsOutro]).s("piano").gain(.5)
```

| Rule | Label | Required | Rule kind | Parameters | Skills |
|---|---|---|---|---|---|
| devices | At least 4 devices | yes | `device-count` | {"devices":["secondary dominant","borrowed chord","modulation","suspension","syncopated bass","modal colour"],"min":4} | H12 H13 H14 |
| bridge | The form has a bridge | yes | `form` | {"pattern":"*","contains":["bridge"]} | F03 |
| duration | At least 2 minutes | yes | `duration-sec` | {"min":120} | F06 |
| ending | It ends on purpose | yes | `custom` | {"fn":"ends-on-purpose"} | F06 |
| groove-lock | The bass lands with the kick |  | `groove-lock` | {"kick":"@drums","bass":"@bass","min":0.5} | B04 |
| contrast | The bridge goes somewhere the chorus does not |  | `contrast` | {"a":{"section":"bridge"},"b":{"section":"chorus"},"axes":["pitch","density","harmony","register","energy"],"minAxes":2} | F02 F05 |
| motif | The hook comes back |  | `motif-reuse` | {"track":"@melody","minRatio":0.5,"shape":"either"} | M02 |
| chord-tones | Chord notes on beats 1 and 3 |  | `chord-tones-strong` | {"minRatio":0.5,"melody":"@melody","harmony":"@chords","strength":"strong"} | M03 |
| range | The tune within 19 half steps |  | `range` | {"track":"@melody","maxSpan":19} | M01 |
| seam | At one seam, some parts change before or after the others |  | `custom` | {"fn":"staggered-boundary"} |  |
| once | Something happens once and never again |  | `custom` | {"fn":"unique-event"} |  |
| arc | It builds to its fullest section and thins after it |  | `custom` | {"fn":"arc"} |  |

Tests in the brief: "the starter: the plan at 56 bars with a bridge, and none of the six devices" (fail), "pop, five devices: E7 to Am in the chorus, Fm and A♭–B♭ in the bridge, the lift, a 4–3, a pushed bass" (pass), "pop, all six: the same single with a Mixolydian verse, I–♭VII–IV–V" (pass), "indie, exactly four: C B♭ F C, V7/V into the chorus, a 9–8, eight bars in A minor at 84" (pass), "jazz-soul, exactly four: sevenths at 76, the borrowed B♭m7, a chain of dominants, a pushed upright, a 4–3" (pass), "funk, exactly four: an E Dorian verse, F♯7 to B7, a sixteenth-note bass, the last chorus a half step up" (pass), "ends on one last hit: a new last bar, every part on beat 1 with a crash, then silence" (pass), "ends with a fade: the outro loops IV–I while every part falls to a tenth of its level" (pass), "book miss: every other line met, but the last chorus simply stops" (fail), "book miss: the outro loops F C to the end, and its last C is the bar that ends every pass" (fail), "three devices: no lift and a bass on the beat" (fail), "no bridge: verse, chorus and a third verse where the bridge was" (fail), "too short: 44 bars at 100 BPM are 105.6 seconds" (fail).

**Opens.** When C7 is released (contracts §2.4); the Coda of that release already says the single is next (content/specs/U17.md). Until then the album shows the slot with "Opens when C7 is released" and Today says the same in one line. Since core lessons are linear and C7 needs U17.CP, every lesson and checkpoint of the core is behind the learner when CF-A opens: the core's stage is `lessons-done` and CF-A (with any capstone left open) is all that remains. In the default order no gym slot interrupts it (GYM.17 is session 181, the day before CF-A.S1). A learner who puts it off gets review days with the gym slot kept (wave6.md §5.5); the single stays the first thing Today offers.

**Band.** None: the single is the learner's whole song. The starter carries its own `kick:`, `snare:` and `hats:` lines; the flavour sets the starter's kit and sounds (§5.10 rule 8) and never changes the rubric.

**The frame and the freedom.** The brief the learner reads (content/capstones.ts, author:finale) says both in six short lines and nothing else. Proposed text: "Your single. Write a song of your own, two minutes or longer, with a verse, a chorus and a bridge. Use four or more of the six devices on the right; you have used most of them before, and the card shows where. Key, tempo, groove, sounds, the order of the sections and what the song is about are yours. Start from the plan, or from a sketch you already like."

- Fixed (the three required rules of contracts §6.6 and the capstone's own facts): 4/4; a tempo between 60 and 160 BPM; sections named so that the form reads a `bridge` (STYLE §10: `chordsBridge`, `melBridge`, …); at least 120 seconds, computed from the `arrange()` lengths and the tempo, never played; at least four of the six devices.
- Free: the key and whether it is major or minor; the tempo inside the range; the flavour and the kit; which devices, and where; the order and the lengths of the sections; an intro, an outro, a pre-chorus or a solo (the `form` rule is `*` with `contains: ["bridge"]`, so any form with a bridge passes, unlike C3's fixed form); every sound and tool the learner has unlocked; the title; what the song is about.
- The start: the plan (a template arranged at full length) or one of the learner's own sketches as the verse. Released Side A tracks are not offered as a start: the single is a new song, and a track cannot be on the record twice.
- Not possible, said in the notes and not in the brief: a single in 6/8 or 12/8 (a capstone has one meter; triplets and swing give the lilt inside 4/4).

**The six devices: what counts.** The checklist's line "At least 4 devices" (`device-count`, `devices: CORE_DEVICES`, `min: 4`) opens into six rows, one per device. Each row says in one sentence what counts, in the words below, and ticks with the bars where the song has it. One musical event counts for one device (a chord is never two devices at once). For each: what the learner reads, where it was taught, where it sits well in a single, what `detectDevices` (@oak/grader `analyze/piece.ts`) finds today, and what it must find before the rule moves to `IMPLEMENTED`.

- Secondary dominant. "A dominant chord aimed at a chord that is not home, and going there: E7 to Am in C." Taught in U15.L02–L05; required in C7. Sits well in the bar before the chorus (V of V) or inside it (V of vi). Today: any chord that reads as an applied dominant counts, wherever it goes (E7 → Am is V7/vi → vi; D7 → F in C also counts, as "V/V → IV": verified). Must change: it counts only when the next chord is its target, as C7's `mustResolve` has it; and a dominant inside a stretch that has changed key is read in that key (today the lifted chorus of a song in C, now in D, reports its A chord as "V/ii": verified).
- Borrowed chord. "A chord from the minor key on the same home note, used in a major-key song: iv, ♭III, ♭VI or ♭VII (Fm, E♭, A♭, B♭ in C). In a minor-key song: the major IV, or a major chord on home at an ending." Taught in U16.L01–L04; C7 asks for ♭VI–♭VII–I. Sits well in the bridge, or as the last two bars before a chorus. Today: found in major keys only (any chord on a flattened root, and the minor iv and v). Must change: minor keys (the Dorian IV and the Picardy third of U16.L04 are not found: a song in A minor with D major and a final A major reports no borrowed chord, and a false "modulation to A major"); use `outsideChordKind` of @oak/theory for both.
- Modulation. "The song changes key and stays there for eight bars or more: a last chorus lifted a half or a whole step, or a bridge in another key." Taught in U17.L01–L02; C7 asks for the lift. Written as contracts §6.8 item 4 has it: a patterned `.scale()` after `arrange()` on every track written in degrees, and for a `chord()` track a variant section with the new symbols. Today: found from the key estimate (a whole-step lift at bar 49 and a bridge in G with its return are both found). Must change: at least eight bars in the new key, read from the code's own key plan first (`keyPlanView`), so a major chord on the last bar is not a key change.
- Suspension. "A note of the tune held over a chord change so that it rubs against the new chord, then steps down into it: 4 to 3, or 9 to 8." Taught in U07.L05. Sits at a cadence: the last bar of the verse, the bar before the bridge. Written as U07.L05 wrote it, the held note struck again at the change (`[7@2 6@2]` over the new chord: no tie is needed). A hand-stacked chord that holds its 4th and then resolves on the same root counts too (`n("<[4,7,8] [4,6,8]>")`: G C D, then G B D). Today: both are found. The symbol `Gsus` is locked until J1.L02 (`code.locked-chord`): the brief never suggests it.
- Syncopated bass. "The bass lands between the beats and holds across the next one: pushed with `.early(1/8)`, or written off the beat." Taught in U13.L01 on the bass lines of U08. Sits well in the chorus. Today: found when two or more bass notes are syncopated anywhere in the song (`struct("x ~ ~ x ~ x ~ ~")` and quarter notes with `.early(1/8)` are both found; one note on the "and" of 4 that leads into a downbeat is not: it is a pickup, not a push). Must change: ask for four such notes, so that one pushed bar in two minutes is not a device.
- Modal colour. "A stretch that takes its colour from a mode: the ♭VII chord of Mixolydian in I–♭VII–IV, a Dorian groove on i and IV, the ♯4 of Lydian, the ♭2 of Phrygian." Taught in U14; C6 is a whole track of it. Sits well in a verse or in the bridge. Today: only the ♭VII chord in a major key is found, and that same chord is also counted as a borrowed chord (I–♭VII–IV alone ticks two rows: verified). Must change: a section written on a modal `.scale()` whose characteristic tone sounds on a strong beat twice or more counts (`modeView`; today a Dorian bridge is not found); and ♭VII counts once: as a borrowed chord when ♭VI, ♭III or the minor iv sounds within two bars of it, otherwise as modal colour.
- A song that meets the rule the cheapest way is still a pass: four rows ticked. The rows are there so the learner sees what the song has, not so they collect all six.

**Your devices so far (the card beside the brief).** Shown from CF-A.S1 on, beside the brief and then beside the checklist. It answers "have I done this before?" with the learner's own music.

- One row per device, in the order above: its name, the one-sentence definition, and "In your tracks": every released Side A track whose current version has the device, with its title and bars ("Chromatic Colour, bars 9–10") and a play button that plays those two bars of that track from its code.
- A device no released track has: "Not on your record yet. Taught in U07.L05." with a play button for the glossary term's example (`term.suspension`, `term.secondary-dominant`, `term.borrowed-chord`, `term.direct-modulation`, `term.syncopation`, `term.mixolydian`) and a link that replays the lesson.
- How it is computed: when CF-A opens, the capstone workspace grades each released Side A track's current code in the grader worker (capstone mode) and reads the devices with their bars. The result is cached per track version. It needs the device names with their bars from the grader (`AnalysisSummary.devices` is text only today: requested).
- From CF-A.S2 the same rows are the checklist's device counter: "In this song: bars 11 and 27" with the tick, the count beside the line ("3 of 4").
- In the default order a learner has C7 (secondary dominant, borrowed chord, a key lift) and C6 (modal colour) on the record, so four rows start with a track of their own; suspension and syncopated bass often start with the lesson.

**What "master" asks.** Mastering here is four listening steps, about five minutes, with tools the core has unlocked: `.gain()` (U01.L02), `.room()` (U02.L08), `.pan()` (U14.L06), `.delay()` (U10.L09) and the bass's `.lpf()` (C1). No compressor, no equalizer, no `.roomsize()` (those belong to the arrangement track; a learner who took the side lessons may use what they unlocked). The brief says once what the word means: "Mastering is the last listen: set the levels, give the band one room, and check the song against a record you know." The Master card in CF-A.S4 lists the four steps; none of them gates the release.

- 1. Levels. Loop the loudest section (usually the last chorus: click it on the form map). With the mute and solo buttons, check each part, then all of them: the kick and the snare are the floor, the bass sits just under the kick, the chords sit under the tune, the tune is on top. Set every part's `.gain()` (a starting point: hats .4–.5, chords .5, pads .35, drums .8, the tune highest). Two questions decide it: can you hum the tune while it plays, and can you hear the bass change notes?
- 2. The limiter. Oak's output ends in a limiter (Settings › Audio): it catches peaks so nothing clips. The brief says: "It is a safety net, not a volume knob." The card shows a meter while the loop plays: the loudest moment before the limiter, and whether the limiter is working. The aim is that it rests in the verse and at most touches the loudest hits of the last chorus. If it works all the time, turn every `.gain()` down by the same share; do not push the song against it.
- 3. Room. One room for the whole band: `.room()` on the tune (.2–.3) and the chords (.2–.4), a little on the snare (.1), none on the kick and the bass (low notes in a room turn to mud). `.pan()` moves two parts that crowd each other to either side (.35 and .65); kick, snare, bass and the tune stay in the middle. `.delay()` on the tune is optional.
- 4. A reference listen. Pick one of your own released tracks on the card (C7 by default), hear twenty seconds of it, then your chorus, at the same headphone volume: is the single about as loud, and is its tune as clear? Then once more with the volume low: the tune and the snare should still be there. The last listen is the take: the whole song, eyes off the code.
- What is measured and what is the learner's word: step 2 is measured (the peak before the limiter and the limiter's gain reduction, read from the master bus while the loop and the take play); steps 1, 3 and 4 are ticks the learner sets. The ticks are not evidence and are not sent anywhere; the release's liner notes say what was done ("Mastered against Chromatic Colour. Loudest moment −4 dB; the limiter rested.").
- Limits of the measurement: the limiter is the `DynamicsCompressorNode` of @oak/strudel's master bus (threshold −3 dB, ratio 20). "Resting" is a gain reduction of less than 1 dB; "working all the time" is more than 1 dB for over a tenth of the section. Both numbers are to be tuned against the four flavour pieces of the golden tests, which must each read as resting when played as shipped.

**Length.** The rule reads the plan, not the clock: `duration-sec` is the sum of the `arrange()` lengths divided by the tempo.

- In 4/4 a song needs at least BPM ÷ 2 bars for two minutes: 40 bars at 80 BPM, 50 at 100, 60 at 120, 80 at 160. The form map shows bars and minutes against 2:00 from the first session, so length is decided in CF-A.S1 and never has to be found in CF-A.S4.
- The plan of the template: intro 4, verse 8, chorus 8, verse 8, chorus 8, bridge 8, chorus 8, outro 4: 56 bars, 2:14 at 100 BPM (verified: 134.4 s). The same plan without intro and outro is 48 bars: 1:55 at 100 BPM, two minutes exactly at 96.
- The grader reads at most 128 bars (contracts §6.4): at 160 BPM that is 3:12 of graded music; the length and bar rules still use the whole plan.

### CF-A.S1: Plan the form (verse, chorus, bridge) and groove.

- **Opens with.** The brief with the devices card, then a choice of two starts. "Start from the plan": section consts for verse, chorus and bridge (a `kick`, `snare` and `hats` line each for verse and chorus, `chordsVerse = chord("<C Am F G>").voicing()`, a chorus loop, a bridge that is one marked slot, a root bass for verse and chorus), every track arranged intro 4, verse 8, chorus 8, verse 8, chorus 8, bridge 8, chorus 8, outro 4 (56 bars, 2:14 at 100 BPM; `silence` where a track rests). "Start from a sketch": a picker over the learner's sketchbook (Studio sketches and lesson Makes, newest first, each with a play button); the chosen sketch's lines become the verse consts inside the same plan, in the sketch's key and tempo.
- **Hears.** The plan from bar 1 (thin at first: the groove and the chords of two sections). A click on a section of the form map loops that section. A/B against the last saved draft. On the devices card, two bars of the learner's own earlier tracks.
- **Sees.** The capstone workspace: the Workbench (code, roll, the chord band with numerals), the form map with each section's bars and the running length ("56 bars · 2:14") against 2:00, and the checklist. Live today: "The form has a bridge", "At least 2 minutes", and the suggestion "The bass lands with the kick". "At least 4 devices" shows its six rows and "0 of 4", marked "next session". Session bar: "Session 1 of 4: Form and groove".
- **Work.**
  1. Decide the song: the key (major or minor), the tempo, the flavour and its kit, and a working title for the draft.
  2. Fix the plan: the order and the lengths of the sections in the `arrange()` lines, until the form map reads two minutes or more with a bridge in it. The bridge comes once, usually after the second chorus.
  3. Write the groove of the verse and of the chorus: kick, snare and hats, the chorus busier than the verse (open hats, ghost notes with `.velocity()`, a pushed kick).
  4. Put a plain chord loop under the verse and another under the chorus, and a bass on the roots that shares the kick's rhythm (a `const`, U08.L04). The colour chords are for next time.
- **Checks.**
  - `capstones.check` runs the whole rubric on each save. Live in this session: `bridge` (`form`, `pattern: "*"`, `contains: ["bridge"]`: read from the section names of the `arrange()` lines, so the plan already meets it), `duration` (`duration-sec` ≥ 120, from the plan) and the suggestion `groove-lock` (`kick: "@drums"`, `bass: "@bass"`, `min: 0.5`).
  - `devices` is shown as a count and never fails the draft. Nothing blocks saving; the session is done when a draft is saved (`capstones.saveDraft`, then `capstones.completeSession`).
- **Ends.** Draft saved and bound to CF-A.S1. The Coda plays the draft's first verse and chorus and says "Next time: the chords, and four of your devices", with the lines already met.
- **Enjoyment.** The learner leaves with the skeleton of a song that is theirs: their key, their tempo, their groove, a verse and a chorus going round under a plan that already runs for two minutes.
- **Pace.** Four decisions and no more: key, tempo, groove, order. The plan is at full length from the first save, so no later session has to make the song longer; colour chords, tunes and the bridge's contents are kept for their own days.
- **Return.** The Coda shows two of the three required lines met on day one and names the next: "the chords, and four of your devices". The devices card has already shown which of them the learner has used before.

### CF-A.S2: Harmony with ≥4 devices.

- **Opens with.** The CF-A.S1 draft, the devices card open beside the checklist. If the bridge is still its one marked slot, a line under the form map says so.
- **Hears.** The draft, a section at a time. A/B on a chord: the bar before and after a change, the same bar. Each device row plays its example: two bars of the learner's own track, or the lesson's.
- **Sees.** The chord band reads applied and borrowed chords as U15 and U16 taught them (V7/vi, iv, ♭VI), and the key ribbon shows a key plan when there is one (the music lenses of wave6.md §4.3). The device counter is live: six rows, each "In this song: bars …" or "Not yet", the count on the line ("3 of 4"). Session bar: "Session 2 of 4: Harmony".
- **Work.**
  1. Choose four or more of the six. The card says where each usually sits; the choice is the learner's.
  2. Colour the verse and the chorus: for example a secondary dominant into vi or before the chorus, or a Mixolydian ♭VII in the verse.
  3. Write the bridge's chords: start away from home (IV, vi, or a borrowed iv), or move to another key through a chord both keys share; end on V so the chorus can land.
  4. Let the bass follow the new roots, and push it where the groove wants it (`.early(1/8)`, or notes written between the beats).
  5. If the last chorus lifts: add its variant section and the key plan after `arrange()` (U17.L02). A `chord()` track needs the lifted chords as a `…Chorus2` section, so every track still names the same sections.
- **Checks.**
  - `devices` (`device-count`, `devices: [...CORE_DEVICES]`, `min: 4`) is live with its rows and bars. The suspension row says "comes with the tune" while the song has no tune.
  - `bridge`, `duration` and `groove-lock` stay live. Nothing blocks saving: a draft with three devices completes the session and carries the open line forward.
- **Ends.** Draft saved and bound to CF-A.S2. Coda: "Next time: the tunes, and the bridge", with the devices found today and their bars.
- **Enjoyment.** The same groove as yesterday now has harmony the learner chose on purpose: the chord that pulls into the chorus, the bridge that goes somewhere else. Each device ticks the moment it sounds.
- **Pace.** One job: chords and bass. No tune is asked for today, and no device has to be looked up: every row plays an example from the learner's own record or its lesson in two bars.
- **Return.** The Coda lists the devices found, with their bars, and says what is left: the tunes and the bridge. If the count is short, it names the row a tune usually ticks (the suspension).

### CF-A.S3: Melody and bridge.

- **Opens with.** The CF-A.S2 draft. `melVerse`, `melChorus` and `melBridge` are added if the draft has none (`n("⟪~⟫")`, with the key after `arrange()`), and a `mel:` line arranged like the other tracks, resting in the intro and the outro.
- **Hears.** The tunes over the harmony, a section at a time; verse against chorus and chorus against bridge at the same bar of each.
- **Sees.** The chord-tone and range lenses; the form map draws each section's features and says how the bridge differs from the chorus ("lower by 4 half steps, half as busy, new chords"). Session bar: "Session 3 of 4: Tunes and the bridge".
- **Work.**
  1. The chorus first: the hook, short enough to remember, on chord tones at the strong beats, said twice or more.
  2. The verse: lower and plainer than the chorus, so the chorus lifts.
  3. The bridge: a tune with another shape in another register over the chords written last time, ending on a note that leans back into the chorus.
  4. A suspension at a cadence, if it is one of the four: hold the tune's note over the change and step down (U07.L05).
  5. Optional, never graded: sing the hook once before writing it. With no microphone, tap its rhythm or skip it.
- **Checks.**
  - Suggestions, shown as ticked or unticked lines and never as failures: `contrast` (`a: { section: "bridge" }`, `b: { section: "chorus" }`, `minAxes: 2`: "The bridge goes somewhere the chorus does not"), `motif-reuse` on the tune (`minRatio: 0.5`: "The hook comes back"), `chord-tones-strong` (≥ 0.5 on beats 1 and 3) and `range` (≤ 19 half steps).
  - `devices` stays live (a suspension in the tune can tick it); `bridge` and `duration` stay live. Nothing blocks saving.
- **Ends.** Draft saved and bound to CF-A.S3: a whole song, top to bottom. Coda: "Next time: arrange it, master it, press record."
- **Enjoyment.** Today the song gets its tune. The learner leaves able to play two minutes of their own writing from the first bar to the last, with a chorus they can hum.
- **Pace.** Three tunes and nothing else. The chorus comes first because it is the one the song is remembered by; the mix, the ending and the take are tomorrow's.
- **Return.** The Coda plays the chorus and says what tomorrow is: the arrangement, the master, the take and the release. Every required line that is already met is shown met.

### CF-A.S4: Arrange to ≥2:00, master, release. (review, release)

- **Opens with.** The CF-A.S3 draft, the checklist as it stood, and the Master card (four steps, see "What master asks").
- **Hears.** The loudest section on a loop while the levels are set; a reference: twenty seconds of one of the learner's own released tracks, then the single's chorus; then the take, the whole song once through with nothing to do but listen, two minutes or more.
- **Sees.** The form map with each section's energy, the full checklist, the Master card with its meter, then "Record the take" (a count-in, the song's length as a line over the form map, each section lighting as it plays), "Review" and "Release". "Check again before you release" shows whenever the draft changed after its last passing check. Session bar: "Session 4 of 4: Arrange, master, release".
- **Work.**
  1. Arrange the energy: who plays in which section. An intro that is less than the verse; a second verse that differs from the first by one part; a bridge that drops something; a last chorus that has everything; an ending that lands on home and stops. `silence`, `.mask()` and a signal on a gain are the tools (U09.L04–L05). Check the form map still reads two minutes or more.
  2. Master: levels, the limiter, room, a reference listen (about five minutes).
  3. Record the take: the whole song in real time. It may be taken again; every take is kept and one is chosen (d20).
  4. Ask for a review (optional, two revisions, never pass or fail), then release: the title, one line for the sleeve, the cover.
- **Checks.**
  - The whole rubric of contracts §6.6 CF-A on the code being released: `device-count` ≥ 4 of the six, `form` contains a bridge, `duration-sec` ≥ 120 and (Oak 2.0 W4) `ends-on-purpose` in any of U09.L06's endings. Labels: "At least 4 devices", "The form has a bridge", "At least 2 minutes", "It ends on purpose". The book's seam, once-only and arc lines are suggestions with no skills.
  - Release is allowed once the three required lines are met on that code (contracts §6.6 Release). The suggestions and the Master card never block it. The tutor review (contracts §10.6, `reviewRevisions: 2`) is offered before release.
- **Ends.** Review offered (`review: true`), then release (`release: true`): album track CF-A v1 in the slot "single", the last track of Side A, with its recording, a tree-ring cover whose rings follow the sections, deterministic liner notes and the learner's line. If CF-T and every other core track are out, this release completes the core: the Coda is the finale (content/specs/END.md). If something is still open, the Coda says what in one line.
- **Enjoyment.** The take is the reward: two minutes and more of the learner's own song, start to finish, with nothing to fix. Then it is on the record with a cover and a title they gave it.
- **Pace.** The song was already at length and already written. Today is a pass over the energy, five minutes of mastering in four fixed steps, one take and the release: about fourteen minutes of work at the default target. At the 15-minute target the learner may stop after the master: the levels and the room are in the code, so the take and the release can be the next session's.
- **Return.** The Coda is the end of the core: the finished record, what the learner can now do, the Oak, and what is open. Tomorrow has a real session in it (END.md).

**Liner notes.**

- Deterministic (`linerNotes` of @oak/grader, at release): key, tempo, meter, length in bars and minutes ("56 bars, 2:14"); the form in names with each section's bars ("intro, verse, chorus, verse, chorus, bridge, chorus, outro"); the chords of each section as numerals, read in the key in force ("verse I–vi–IV–V; bridge iv–iv–I–I–♭VI–♭VII–V–V"); the devices with their bars, one line each ("Secondary dominant: V7/vi to vi, bars 11 and 27", "Key lift: up a whole step at bar 49"); how the bridge differs from the chorus; instruments and the flavour; tools used.
- From the Master card: the reference track and the measured loudest moment ("Mastered against Chromatic Colour. Loudest moment −4 dB; the limiter rested."). When the limiter worked throughout, the note says so plainly and without judgment ("The limiter worked through the last chorus.").
- The learner's inputs at release: the title (no default: the dialog asks "What is the song called?" and offers the draft's working title) and one line (`album.patchVersion` `linerNotesMd`), prompted with "What is this song about?". When the draft started from a sketch: "Grown from" and the sketch's title.
- The tutor's listening note only with consent (`includeReviewNote`, default `Settings.linerNotesInAlbum`).

**Tests the brief or the checks must carry.**

- The CF-A.S1 template fails on `devices` alone (0 of 4), and passes `bridge` and `duration` (56 bars at 100 BPM: 134.4 s). The brief's present starter (32 bars, 76.8 s, one secondary dominant) fails on `devices` and `duration`.
- Pop, passing (graded with the real grader by content/specs/finale.test.ts; the code is content/specs/finale-reference.ts): C major, 100 BPM, verse chorus verse chorus bridge chorus chorus2, 56 bars, 134.4 s; E7 to Am in the chorus (bars 11, 27, 43), Fm and A♭–B♭ in the bridge (bars 33, 37, 38), the last chorus a whole step up (a `chordsChorus2` section and `.scale("<C4:major!48 D4:major!8>")` after `arrange()`), a 4–3 suspension at the verse's cadence (bars 4 and 8), a bass on `struct("x ~ ~ x ~ x ~ ~")`: all six devices found.
- Indie, passing with exactly four: D major, 84 BPM, 44 bars (125.7 s); I–♭VII–IV in the verse (modal colour), V of V before the chorus (secondary dominant), a bridge in B minor for eight bars (modulation), a 9–8 suspension; a plain bass, no borrowed chord.
- Jazz-soul, passing: F major, 76 BPM, 40 bars (126.3 s), sevenths on `rhodes` with `upright`; a chain of dominants in the bridge (secondary dominant), a borrowed iv (B♭m7) in the chorus, a pushed bass, a suspension; no key change.
- Funk, passing: 104 BPM, 56 bars (129.2 s); a Dorian verse on i and IV with the ♮6 on strong beats (modal colour, once the rule reads a modal section), a sixteenth-note bass with pushes, a half-step lift for the last chorus, a secondary dominant into the chorus.
- Fails, one per rule: three devices (`devices` says which three and "3 of 4"); verse chorus verse chorus chorus, no bridge (`bridge`); the 48-bar plan at 100 BPM, 115.2 s (`duration`).
- One event, one device: I–♭VII–IV alone ticks modal colour and not borrowed chord; ♭VI–♭VII–I ticks borrowed chord and not modal colour (today each ticks both: verified); a bridge in G entered through D7 ticks modulation and not secondary dominant (today both); D7 → F in C ticks nothing (today a secondary dominant).
- The convention of contracts §6.3: a lifted chorus named `chordsLift` while the other tracks call that section a chorus fails with `form.inconsistent-arrange` (verified today); named `chordsChorus2` it passes. `chord("<Gsus G>")` is `code.locked-chord` (verified); the hand-stacked form passes and counts.
- A minor-key single: A minor with the Dorian IV and a Picardy ending counts a borrowed chord and no modulation.

- content/capstones.ts is author:finale's. Its CF-A entry needs: the brief text above; the CF-A.S1 template as that session's `starter` (the present starter is 32 bars and uses a whole-kit `drums:` line with `,`, against STYLE §2 rule 5); `focusRules` per session (S1 `bridge` `duration` `groove-lock`; S2 `devices`; S3 the four suggestions; S4 all); the suggestions as `required: false` rules (`groove-lock`, `contrast`, `motif-reuse`, `chord-tones-strong`, `range`: all implemented today); the three required rules as they are; hints that point at the devices card; `CAPSTONE_LINER_PROMPTS["CF-A"]` and three `CAPSTONE_LINER_SEEDS`; the tests above.
- `device-count`, `form.contains` and the Wave 6 fields are planned: `bun run content:check CF-A` names them until the grader engineer moves them to `IMPLEMENTED` with the golden tests. The device definitions above are the learner's words; where `detectDevices` differs today, the difference is listed and requested of the grader engineer, who owns the rule.
- The capstone engineer builds: the devices card (and its cache), the device counter rows in the checklist, the sketch picker of CF-A.S1, the Master card with its meter and its reference player, the take (as C3.S4's), and the liner-note lines from the Master card. The sound engineer exposes what the meter reads (`master.preAnalyser` peak and `master.limiter.reduction` are on `MasterBus` today; one small reader, such as `master.headroom()`, keeps the app out of the audio nodes).
- One real-time take of the single exists in the browser suite, in the journey (d9; over two minutes of real time); every other spec starts from a seeded take.
- The Master card's ticks live in the workspace for the session and are not stored: a reload shows the measured line again after the next play and leaves the other three unticked. What matters is kept in the liner notes at release.
- Record order: on the finished record the single is the last track of Side A (END.md, the record). content/capstones.ts lists CF-A before CF-T; the album orders Side A itself.

## CF-T Core Finale: Standard Transcription

Author: **finale**. The third transcription on the album and the first whole song: a 32-bar standard from the 1920s (Five Foot Two, Ain't She Sweet or Bye Bye Blackbird, the learner's choice) taken down by ear in four sessions that run in the gym slots from U15.L01 (sessions 156, 161, 166 and 171 of the default order). Session 1 maps the form and takes down the bass; session 2 the changes; session 3 the melody; session 4 turns the transcription into the learner's own arrangement, reviews and releases it. The stages pass in order: the form map correct, the bass at 0.90, the changes at 0.85 of the bars, the melody at 0.90. The form comes first because it is leverage: a tune in four eight-bar sections of which three are alike is sixteen bars of writing, not thirty-two.

**Opens.** When U15.L01 is completed (contracts §2.4); the Coda of that lesson says so on one card, whose words are in content/specs/U15.md. From then on every transcription slot is CF-T's next session until it is released (§2.5): Today shows "Standard Transcription · Session 2 of 4" as the New block, with the usual "Do something else instead". The learner may also open it from the capstone list on any day; that session counts as the transcription session for the slot rule. While it is closed, the album slot says "Opens with U15.L01". It never gates a lesson. A compose capstone in progress is not interrupted by anything except CF-T's own sessions, which are the slot (in the default order CF-T.S1 falls the day before C6.S1).

**Band.** None while transcribing: the source is the song itself, Oak's rendition played as a pattern source (hidden code in a hidden adapter instance, contracts §6.12). In CF-T.S4 the arrangement is the learner's code, top to bottom.

**The three standards.** All three are choruses of 32 bars in 4/4, cut by the answer key into four phrases of eight bars, which are also its sections (`answerKey.phrases` and `answerKey.sections` agree, so every check names the same phrase for every song). The song cards say how the three differ without giving away what the learner is about to hear. author:repertoire writes each `song.ts` from the cited print and a human verifies it; a song without a verified key or without `sections` is offered as "Being checked" and cannot be chosen.

- Five Foot Two, Eyes of Blue (Henderson, Lewis and Young, 1925), in C. The plainest of the three: mostly one chord a bar, few different chords, a tune in mostly plain rhythm (bars 4, 7–8, 12, 19–20, 24, 28 and 31–32 hold ties or syncopations: the repertoire key). Card: "The plainest of the three. A good first standard." Its changes are the dominant chain U15.L05 teaches by name two sessions after CF-T.S2 in the default order: a learner who chose it meets its opening eight bars again in that lesson, as something they already took down.
- Ain't She Sweet (Ager and Yellen, 1927), in C. Two chords a bar in most of its opening section (the sigh A G♯ G is harmonized I, III, V7 in the repertoire key, not with a diminished seventh, which would clash with its G♯); a bridge that sits on one chord for two bars at a time. Card: "Quicker changes: two chords a bar in places."
- Bye Bye Blackbird (Henderson and Dixon, 1926), in F. The longest lines, the most chord colours, and the least repetition between its sections. Card: "The longest lines and the most colours. The one players still call."
- Oak's settings use only what the learner can write at CF-T.S1: triads, the five seventh qualities and diminished sevenths (`chord.triad`, `chord.dom7`, `chord.seventh`, `chord.seventh-dim`), no sixth, ninth or suspended chords (locked until the jazz track: a print's C6 is set as C, an F9 as F7, and the setting note says so). Verified: `C#o7`, `Am7b5`, `Abo7`, `Gm7`, `F^7` and the dominant sevenths voice and lint at CF-T.S1.
- The settings keep the print's rhythm: ties, dots and syncopation are in (U13 is behind the learner), and each setting note lists anything that was straightened. Each song declares `swing: { subdivision: 8, amount: 1/3 }` (Oak's rendition swings its eighths), its pickup if the print has one, and its key.
- Facts to settle against the prints before the answer keys are written: the registry gave Five Foot Two's form as ABAC; it is AABA (corrected in the stub). Bye Bye Blackbird is registered as ABAC; its sections repeat less plainly than the other two's and descriptions of its form differ, so the answer key must take one reading and the setting note must say why (the form map is graded against that reading alone).
- The three descriptions above are of the songs as they are commonly played. author:repertoire confirms each against its print and corrects a card line that the print contradicts.

**What is given, and what is heard.** The givens card stays on screen through all four sessions (`TranscribeGiven`; contracts §6.12).

- Given from the start: the title, the writers and the year; the tempo; the meter (4/4); the key and its home note ("C, home is C"); the feel ("Swing 8ths": grading straightens the swung grid, so a straight answer still matches); the pickup, if any; the length ("one chorus, 32 bars").
- Not given: the form. The bar timeline is numbered 1 to 32 and has no section marks until the learner's map passes; the number of sections is not shown.
- Given at the bass stage: the learner's own form map, drawn over the timeline. Given at the changes stage: the harmonic rhythm (the chart shows one slot or two in each bar, as the song has them) and the bass the learner wrote. Given at the melody stage: nothing more; there is no rhythm skeleton.
- Heard, never shown: every note, every chord, where each section starts. The hidden code never reaches the browser's editor or the DOM.

**The source and its realism.** The rendition is the same for every learner, as X2's was: CF-T's difficulty is the song's, not the learner's gym level.

- Realism R2, fixed (contracts §6.12): timing humanized by up to 15 ms and velocity by 0.1, the swing of the song, and a room. Never R3 or R4: the stage's layer is not pushed down in the mix and nothing is detuned.
- Four layers: drums (brushes or a ride on swung eighths), a two-feel bass (two notes a bar: the root, then the root, the fifth or the next root), comping chords, and the tune on a plain lead. The source mixer brings the stage's layer forward and can mute the tune while the bass and the changes are taken down.
- The player: rate 25–100 %, ±12 semitones, an A–B loop on any bars, a bar timeline (no waveform and no fine-tune for a pattern source), V to switch original and mine at the same bar. Once the form map has passed, a click on a section loops that section.
- Grading tolerances do not change with realism; answers stay on the grid.

**The form map.** The first thing the learner does with a whole song: hear it through, cut its 32 bars into sections and name them. It is the `form` answer in `input: "map"` (`FormMapCheck`: `id: "form-map"`, `vocabulary: "letters"`, `boundaries: "asked"`, `pass: 1`), graded by `gradeFormMap` against `answerKey.sections`.

- The widget is a strip of 32 numbered bars under the timeline. A click on a bar line cuts; a letter names the section to its right (A to D). By keyboard: the arrows move along the bar lines, Enter cuts or joins, a letter key names.
- Correct means every section starts at the right bar and has the right letter by shape: A A B A, X X Y X and "verse verse bridge verse" are the same answer, and a variant may be tagged (A A2 B A3). Verified with `gradeFormMap`: those pass at 1; A B A B on an AABA tune scores 0.25; two halves of sixteen bars 0.5; a fifth section cut at bar 21 scores 0.8. Anything under 1 is not a pass.
- Feedback names the section and what to compare, never the answer: "Section 2 starts in the right place. Its name: listen to bars 9–10 against bars 1–2." A cut in the wrong place: "There is no new section at bar 21: bars 17–24 are one."
- Hints follow the normal ladder. A revealed map opens the bass stage, gives no evidence and is named in the liner notes.
- When it passes, the workspace writes the draft's skeleton from it: one const per distinct section and track (`bassA`, `bassB`; a section that differs in its ending becomes `bassA2` when the learner splits it) and one `arrange()` per track with the sections in order. The learner then writes each distinct section once.

### CF-T.S1: Form map and bass of a public-domain standard (Five Foot Two, Ain't She Sweet or Bye Bye Blackbird).

- **Opens with.** The three song cards (title, writers, year, the one-line description, a four-bar preview of the middle of the tune), then the givens card and the song from bar 1. No code yet: the draft is written when the form map passes.
- **Hears.** The whole chorus, all four layers, once or twice through at tempo (about a minute each time); then sections on a loop; for the bass, the bass layer forward and the tune muted, slowed as far as 25 %.
- **Sees.** The capstone workspace in transcription mode: the stage strip Form → Bass → Changes → Melody → Arrange (a stage opens when the one before has passed or been revealed), the bar timeline numbered 1–32 with the form strip under it, the givens card. After the map: the Workbench with the skeleton, the roll with degree labels, a Check button on each section of the bass. Session bar: "Session 1 of 4: Form and bass".
- **Work.**
  1. Listen through without stopping. Where does the tune start again? Where does it go somewhere new?
  2. Cut the 32 bars into sections and name them. Check.
  3. The bass, a section at a time, home first: two notes a bar. Write each distinct section once; listen for the bars where a repeat ends differently and split that section into a variant.
  4. Check each section; play the whole bass against the original from bar 1.
- **Checks.**
  - `formMap`: `{ id: "form-map", vocabulary: "letters", boundaries: "asked", pass: 1 }`, graded by `gradeFormMap` on the server and recorded with `capstones.recordCheck` (`CapstoneCheckState.layer: "form"`).
  - `PhraseCheck` `bass-1` … `bass-4`, each `after: ["form-map"]`, one eight-bar phrase each: `layer: "bass"`, the L6 bass matcher (`melody` on `@bass`, octave-free; `STANDARD_LADDER_MATCHERS.bass`), pass ≥ 0.90, graded in capstone mode.
  - The session is complete when the map and the four bass checks are recorded (passed or revealed).
- **Ends.** Draft saved and bound to CF-T.S1. The Coda plays the learner's bass under Oak's drums for eight bars and says "The form and the bass are down. Next time: the changes."
- **Enjoyment.** The first minute is simply a good tune played well. By the end the learner's own bass line carries the whole chorus, and they can hear that they wrote sixteen bars and got thirty-two.
- **Pace.** Two jobs, each small: a map (two listens, a few clicks) and a two-notes-a-bar bass. Section checks give feedback every eight bars, and a repeated section is written once. At the 15-minute target the session may end after the map and the first sections; the rest resumes at the next slot or from Today.
- **Return.** The Coda shows the form as letters, the learner's own, and says what the next slot is for. `tb.feature.transcribe.full` unlocks: full-arrangement mode for their own audio.

### CF-T.S2: Changes.

- **Opens with.** The CF-T.S1 draft with a `chords…` const added for each distinct section (rests) and a `chords:` line arranged like the bass. The chart view shows 32 bars, four to a line, a double bar at each section, with one slot or two in each bar and the learner's bass notes under them.
- **Hears.** The song with the chord layer forward and the tune muted; one bar or two on a loop; original against mine at the same bar.
- **Sees.** The chart filling in as symbols are typed; the chord band with symbols, and numerals as a lens (the answer is the symbol). A Check on each section. Session bar: "Session 2 of 4: Changes".
- **Work.**
  1. The bass has given the root of nearly every chord. For each slot: is it a plain triad, a dominant seventh, a minor seventh, something tighter?
  2. Write each distinct section once as `chord("<…>")`, two chords in a bar as `[C C#o7]`.
  3. Check a section; where a bar is wrong, the feedback says which bar and whether the root or the quality is off, not the chord.
- **Checks.**
  - `PhraseCheck` `changes-1` … `changes-4`, each `after: ["bass-1", "bass-2", "bass-3", "bass-4"]`: `layer: "chords"`, `{ m: "harmony", level: "rn", qualityDepth: "seventh", inversion: false, harmonicRhythm: "given", weights: { bass: 0 }, wrongQuality: "none" }`, pass ≥ 0.85.
  - Scored bar by bar (contracts §6.6: "changes ≥ 0.85 per bar"): a bar counts when every chord in it has the right root and the right quality at seventh depth; a right root with the wrong quality earns nothing for its bar (d11). In an eight-bar section one bar may be wrong (7 of 8 is 0.875).
  - The session is complete when the four checks are recorded.
- **Ends.** Draft saved and bound to CF-T.S2. The Coda plays eight bars of the learner's changes over their bass and says "Next time: the tune."
- **Enjoyment.** The learner hears the song's harmony come out of their own code: their bass, their chords, the original's drums. These are the changes of a real 1920s standard, and they wrote them down by ear.
- **Pace.** One question per slot (which quality?), because the bass already answered the other (which root?). The repeated sections are written once.
- **Return.** The Coda shows the chart, complete, and says what the next slot is for. In the default order the lessons in between (U15.L04–L06, U16.L01) explain chords the learner has just heard in this song.

### CF-T.S3: Melody.

- **Opens with.** The CF-T.S2 draft with a `mel…` const for each distinct section (`n("⟪~⟫")`) and a `mel:` line arranged like the others, the song's key after `arrange()`. The tune is unmuted in the source.
- **Hears.** The tune forward, one phrase of two or four bars on a loop, slowed as needed; original against mine at the same bar; the whole chorus at the end.
- **Sees.** The roll with degree labels and chromatic degrees where the tune leaves the key (from U15.L01); the staff when the learner wants it (ties and dots are read there). A Check on each section. Session bar: "Session 3 of 4: Melody".
- **Work.**
  1. Sing or hum a phrase back before writing it (optional; "Hum it, Oak drafts it" gives a draft that must be corrected and checked before it counts).
  2. Write each distinct section once, in degrees; a note from outside the key is a chromatic degree (`n("3#")`).
  3. Listen for where a repeated section's tune ends differently, and write the variant.
  4. Play the whole tune against the original from bar 1.
- **Checks.**
  - `PhraseCheck` `melody-1` … `melody-4`, each `after: ["changes-1", "changes-2", "changes-3", "changes-4"]`, one eight-bar phrase each: `melody`, `pitch: "key-relative"`, `track: "@melody"` (`STANDARD_LADDER_MATCHERS.melody`), pass ≥ 0.90, with the song's pickup and swing in the context.
  - The session is complete when the four checks are recorded. A straight answer to the swung tune passes, with `rhythm.swing-missing` as a note.
- **Ends.** Draft saved and bound to CF-T.S3: the whole song in the learner's code, bass, changes and tune. Coda: "Next time: make it your arrangement, and release it."
- **Enjoyment.** The tune is the part everyone knows. When the last section passes, the learner presses play and hears a standard, all of it, from their own page.
- **Pace.** One layer, one section at a time, with a check after each. The repeats are written once and their endings are the only new work.
- **Return.** The Coda plays the first eight bars, all three layers, and says what is left: an arrangement of their own and the release.

### CF-T.S4: Arrange, review, release. (review, release)

- **Opens with.** The CF-T.S3 draft in the full Workbench, the source one click away for reference. `kick`, `snare` and `hats` lines are added if the draft has no drums.
- **Hears.** The learner's own version from bar 1; the original beside it at any bar; then the take, one chorus (and an intro and an ending if they wrote them) in real time, about a minute.
- **Sees.** The Workbench `full`, the form map with the song's sections, the checklist of three lines, then "Record the take", "Review" and "Release". Session bar: "Session 4 of 4: Arrange and release".
- **Work.**
  1. Drums of their own: a ride or hats on swung eighths, a two-feel kick, a light backbeat or none.
  2. A comping rhythm for the chords (a push from U13.L01, `.dict("lefthand")` on the sevenths) and a sound for each part; the tune on whatever lead the learner has unlocked.
  3. Optional: a four-bar intro and an ending (`intro`, `outro`); levels and a room.
  4. Record the take, ask for a review (optional), release.
- **Checks.**
  - The session rubric (`CapstoneSessionDef.rubric`, graded in capstone mode on the whole piece): `roles` (`tracks`, `min: 4`, `roles: ["drums", "bass", "chords", "melody"]`: "Drums, bass, chords and melody") and `form` (`pattern: "@song"`, `extra: ["intro", "outro"]`: "The song's own sections, in order"). Both required.
  - Release needs the form map and the twelve phrase checks recorded (passed or revealed) and the two rubric lines met on the code being released. The arrangement's taste is not graded.
- **Ends.** The tutor's transcription review is offered (`review: true`, contracts §10.6: two revisions, plausibility flags, a listening question; never pass or fail), then release (`release: true`): album track CF-T v1 with its recording, cover and liner notes. ms.20 "You can now transcribe a standard." The ladder counts the release as an L8 pass, and the gym may now serve another standard at L8.
- **Enjoyment.** A song people have played for a hundred years, in the learner's arrangement, on their record. The take is a minute of listening to it.
- **Pace.** The notes are done. Today is drums, sounds and a take; an intro and an ending are optional. The rubric is three lines the draft nearly meets already: the four parts, the song's sections, and its changes bar by bar.
- **Return.** The Coda shows the track on Side A beside the others and says the gym can now serve another standard at L8. In the default order the four lessons of U17, its checkpoint, C7 and the single remain.

**Liner notes.**

- The song: title, writers, year, status (US-PD), the source edition (`provenance`), "Oak's rendition; transcribed by ear".
- Key, meter, the feel, the form as letters with each section's bars, the changes of each section as symbols and numerals.
- Per stage: transcribed by ear, with the score of each section, or "revealed" (contracts §6.6: a revealed check is named). The form map: "mapped by ear" or "revealed".
- The arrangement: instruments, the flavour, an intro or an ending if there is one; the learner's line (prompt: "What did the form tell you before you wrote a note?"); the tutor's listening note only with consent.

**Tests the brief or the checks must carry.**

- `bun run content:check CF-T` resolves every check against all three songs: until each answer key has `layers.bass`, `layers.chords`, `layers.melody`, four eight-bar `phrases` and four `sections`, the checks are pending and say which song lacks what.
- The form map (`gradeFormMap`, verified today on an AABA and an ABCA key): the key's own letters, section names and tagged variants pass at 1; A B A B on AABA 0.25; two sixteen-bar halves 0.5; an extra cut at bar 21 0.8; on ABCA, A B C D scores 0.75 and A B A C 0.5. Each failing case names the section and never the answer.
- Per song, per section: the answer key's bass passes `bass-n`; the bass a bar late fails; an octave lower passes. The key's chords pass `changes-n`; a triad for a dominant seventh in one bar loses that bar and still passes (7 of 8); in two bars fails; a right quality on a wrong root loses the bar. The key's tune passes `melody-n`; a degree off throughout fails with `melody.index-shift`; the same tune in another key passes (key-relative); a straight answer to the swung tune passes with `rhythm.swing-missing`.
- Order: a bass check before the form map is recorded is refused (`open: false`); `changes-1` before every bass check is refused; a revealed stage opens the next.
- CF-T.S4: a draft without drums fails `roles`; the sections in another order fail `form` (`@song`); the song's sections with `intro` before and `outro` after pass; a second chorus appended fails (one chorus is the song's form).
- Lint at CF-T: an arrangement on `rhodes`, `upright` and `jazzgtr` with `.swingBy(1/3, 4)`, `.velocity()`, `.room()` and `.pan()` is clean at CF-T.S1 and CF-T.S4 (verified); `tenor`, `trumpet` and `horns` are locked there in the legal order where CF-T runs ahead of U15.L05, so no starter or test uses them.

- content/capstones.ts is author:finale's. CF-T's `sessionDefs` are bare today; they need the form map on S1, the twelve phrase checks (four per stage, each on one phrase, with `after` as above), the two-line rubric on S4 and the givens. The shapes are planned features (`capstone.form-map`, `form.map`, `harmony.wrong-quality`, `capstone.session-rubric`, `form.song`): `bun run content:check CF-T` names them until the grader lists them. `TRANSCRIBE_PASS["CF-T"]` already holds the marks.
- This spec checks each stage one eight-bar section at a time (four checks a stage), where AUTHORING §19.8 and the content-kit test show one check over the whole tune. Section checks give feedback after eight bars instead of after thirty-two and let a 15-minute learner stop on a passed section; the marks are the contract's. All three songs are cut the same way, so a check names the same phrase in each.
- "Changes ≥ 0.85 per bar" is read as: the score of a section is the share of its bars that are right, and a section passes at 0.85. `STANDARD_LADDER_MATCHERS.changes` is this matcher; until `wrongQuality` is built it answers `rubric.unknown` and scores 0.
- The pool is three songs and none has an answer key yet (content/repertoire has stubs). CF-T can be offered only once at least one is verified; the learner should be able to choose between at least two.
- U15.L05 plays the first eight bars of Five Foot Two's chorus as its record (content/specs/U15.md). For a learner who chose that song the lesson confirms what they took down two sessions earlier; in an order where the lesson comes first it gives away eight of the thirty-two bars of changes. Both specs accept that: the form map, the bass, the other sections and the tune are still theirs to hear.
- `tb.feature.transcribe.full` is granted when CF-T.S1 is completed (contracts §3.2 has no START note on the row; wave6.md §5.2 says "starts": the contracts win). CF-T itself never needs it (§3.1 rule 12).
- The capstone and transcribe engineers build: the song cards with their previews, the form strip (the answers engineer's `Form.tsx` in `input: "map"`), the skeleton written from a passed map, section loops from the form strip, the four-stage strip, the chart with one or two slots a bar, and the take.

## Transcription Gym

Ladder levels L7 and L8 (Wave 6). The slot rule, the gym session's budget and levels L1–L4 are specified in content/specs/U07.md, L5 and L6 in content/specs/U11.md; this section states L7 as it stands and adds L8, the level CF-T opens. Nobody authors a ladder item: L7 is the learner's own audio in the Transcription Studio, L8 reads the standards' verified answer keys (content/repertoire) and is graded by `gradeFormMap` and `gradeStandardLadder` (@oak/grader `grade/standard-ladder.ts`); the server serves L8 through `ladder.songs`, `ladder.next` and `ladder.submit` (wave6.md §5.4).

**The slot rule (content/gym/slots.ts).** From U07.L01, after 4 completed core sessions since the last transcription session, the next session's New block is a transcription slot.

- Unchanged (U07.md): every fifth session from U07.L01 is a transcription slot; odd `GYM.nn` are graded ladder sessions at the learner's level and realism, even ones own audio (L7), or a ladder session one realism level up when there is no audio project.
- From U15.L01 until CF-T is released, every slot is CF-T's next session (sessions 156, 161, 166 and 171 of the default order); gym sessions resume with GYM.16 (own audio) and GYM.17 (ladder).
- L8 is served in odd slots once the learner has moved to it. A standard spans slots like an L6 song: `ladder.next { level: 8, songId? }` creates a `pd-song` project the first time and resumes it at its next unpassed stage after; the song CF-T used is skipped.
- After the core the slot rule keeps running on review days (d19): the fifth session since the last transcription session is a gym session, odd and even as before.

**Slots in the default order.** GYM.01 (session 68, after U07.L11; ladder); GYM.02 (session 73, after U07.L06; own-audio); GYM.03 (session 78, after U07.L10; ladder); GYM.04 (session 90, after U08.L06; own-audio); GYM.05 (session 95, after U09.L03; ladder); GYM.06 (session 100, after U09.L07; own-audio); GYM.07 (session 107, after C3.S4; ladder); GYM.08 (session 112, after U10.L05; own-audio); GYM.09 (session 117, after U10.L09; ladder); GYM.10 (session 122, after C4.S2; own-audio); GYM.11 (session 127, after U11.L05; ladder); GYM.12 (session 132, after U12.L01; own-audio); GYM.13 (session 142, after U12.L05; ladder); GYM.14 (session 147, after U13.L03; own-audio); GYM.15 (session 152, after U14.L01; ladder); GYM.16 (session 157, after U14.L04; own-audio); GYM.17 (session 182, after U17.L04; ladder); GYM.18 (session 187, after C7.S3; own-audio).

**A gym session (contracts §9.1).**

| Target | Transcription minutes | What it contains |
|---|---|---|
| 15 | 10 | L7: one region of 4–8 bars, one layer, its checklist rows. L8: the form map of a standard, or one eight-bar section of one stage. |
| 20 | 14 | L7: one region, one or two layers, a hum-to-draft if wanted. L8: the form map and the first sections of the bass, or two sections of a stage. |
| 25 | 19 | L7: two regions or a short section in full-arrangement mode. L8: a whole stage (four sections), or the last sections of the tune and a transcription review from the tutor (code only, never audio). |

**The ladder (contracts §2.9; content/gym/ladder.ts).**

| Level | Title | First available | Material | Source | Given | Grading |
|---|---|---|---|---|---|---|
| L7 | Your own audio | U07.L01 | A region of the learner's own audio: a hook, a bass riff, a chorus, 4–8 bars or a whole section. The layer modes are the own-audio templates (content/gym/templates.ts) their rows unlock: Melody from U07.L01, Chords from C4.S1, Bass from X2.S1, Full arrangement (form, drums, bass, chords, melody) once CF-T.S1 is completed. L7 is where the even slots happen; it is never a level the learner moves to and never an item (`ladder.next` and `ladder.setLevel` refuse 7; a session reports `ladderLevel: 7`). | The learner's upload (`audio.upload`); the file stays on this machine and is never sent to the tutor. Waveform, rate 25–100 %, ±12 semitones, ±50¢ fine-tune, A–B loop, the BeatGrid. | Nothing: the learner taps the tempo, drags the bar-1 marker and finds home by ear. "Hum it, Oak drafts it" gives a draft flagged machine-made that counts for nothing until it is corrected and the checklist is filled. | Self-assessed: `OWN_AUDIO_CHECKLIST` (contour, rhythm, landing, bass, chords; each 0–2, rows outside the chosen layers hidden), `grading.mode: "self"`, `status: "ungraded"`, evidence weight 0.3 flagged `selfReported` (contracts §6.12). It never counts as a graded pass for a level-up or a milestone. |
| L8 | A full arrangement | CF-T.S1 | A full arrangement: the whole 32-bar chorus of a standard from the L8 pool (Five Foot Two, Ain't She Sweet, Bye Bye Blackbird; the one CF-T used is skipped) with a verified answer key and `answerKey.sections`, in four stages that open in order: form, bass, changes, melody. Or the learner's own audio in Full-arrangement mode. | content/repertoire (pool L8), Oak's rendition with its swing declared, played as a pattern source at the learner's realism, the stage's layer forward in the source mixer. Own audio: the learner's file. | As CF-T: tempo, meter, key and home note, the feel, the pickup, the length (32 bars); not the sections. At the changes stage the harmonic rhythm. Own audio: nothing. | A standard: `ladder.submit { stage: "form", formMap }` is graded with `gradeFormMap` (every section's start and letter by shape; pass 1), then the code stages with `gradeStandardLadder` in capstone mode at CF-T's marks (`STANDARD_LADDER_PASS`): bass ≥ 0.90, changes ≥ 0.85 of the bars at seventh depth with a wrong quality earning nothing, melody ≥ 0.90, an eight-bar section at a time. Own audio: self-assessed with the Full-arrangement rows (form, groove, changes, melody), weight 0.3. (pass 0.85) |

**Realism.**

- As U07.md and U11.md (contracts §6.12). L8 follows the learner's realism like L5 and L6 and starts at R0, as every new level does: the first standard after CF-T is clean and quantized, an easier listen than CF-T's fixed R2. The swing is the song's own and is there at every level.
- R1 humanizes timing and velocity; R2 adds the room and humanized drums; R3 brings the other layers up over the stage's layer and plays only sounds the learner has unlocked (d7); R4 puts the tune on `tenor` or `choir` with detune.
- Grading tolerances never change with realism.

**Moving up the ladder.**

- L6 → L8 (L7 is not a rung to climb): offered once CF-T is released and two L6 songs have a graded pass on two different learner days (wave6.md §5.4). The released CF-T counts as one L8 pass. Before that `ladder.setLevel { level: 8 }` answers 409 with the reason in plain words.
- A graded L8 pass is a standard whose four stages all passed unrevealed. A revealed stage opens the next and the song then does not count.
- Down a level at any time. L8 is the top of the ladder in the core; the jazz track's transcriptions build on it.
- Dev seed: `ladder L8` (CF-T released, the ladder at L8 and R1, a second standard with its form and bass passed; Transcribe opens it at the changes stage).

**Own audio (even slots).**

- L7 is unchanged from U07.md. Full-arrangement mode is its fourth template: the learner marks the sections of their own recording on the bar grid with the same form strip CF-T uses (not graded), then works a section at a time.
- The API's `OWN_AUDIO_CHECKLIST` has no form row; the Full-arrangement template has one ("I mapped the sections and their lengths"). Requested of the server engineer: add `{ id: "form", label: "The sections start where the recording's sections start" }`, shown only in Full-arrangement mode.

**Notes.**

- content/gym/ladder.ts gives L8 `pass: 0.85`, which the table above prints; its stages have their own marks (`STANDARD_LADDER_PASS`: 1, 0.90, 0.85, 0.90). Requested of drills-engine: drop the single number for L8 or point it at the stage marks.
- L8's pool is the three CF-T standards: after CF-T two are left, and none has a verified answer key today. The further standards of contracts §2.8 (Blue Skies, Ain't Misbehavin', Honeysuckle Rose, On the Sunny Side of the Street, Tea for Two, Lady Be Good) join the pool only when verified (`onlyWhenVerified`). When the pool is used up, L8 slots are own audio in Full-arrangement mode, or a standard again one realism level up.
- Ladder levels reach 8 on the wire and `LADDER_STAGES` has gained `form`: a surface with a 1–6 table or a three-stage switch must handle both (wave6.md §5).
- Nothing in the gym is authored by content authors: drills-engine owns content/gym, the server `ladder.*`, transcribe the Studio, author:repertoire the answer keys.
