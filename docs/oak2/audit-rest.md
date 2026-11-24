# Oak 2.0 audit: U10–U17, J, R and A songs, jazz-soul/funk/electronic Bands, whole-piece examples

Wave W0, Task 6 Step 1, the rest half (agent A4). Read-only audit against the PLAN §7 checklist; no code was changed.
The fixes are proposals for W2. The core half (U01–U09, pop/indie Bands) is `docs/oak2/audit-core.md`.

## How this was read

- **Songs:** all 18 unit songs in scope (U10–U17, J1–J5, R1–R3, A1–A2, `content/unit-songs/*.ts`) were evaluated
  headlessly in pop, jazz-soul, funk and electronic (72 renders, `strudel(code, bars)` from
  `packages/grader/src/analyze/__support__/fixtures.ts`). Indie was not rendered: it shares pop's notes and A3 owns
  the indie style. Per section the script measured events per bar per track, each pitched track's 10–90 % pitch
  range, which pitched tracks overlap in range (≥ 60 % of the smaller range), whether two sections of one type are
  identical bar for bar, bars heard once inside a repeated section type, per drum sound the hits per bar, the number
  of distinct velocity levels and the hits under 60 % of the loudest (ghosts), bass onsets within 1/32 of a kick and
  kicks that land while a bass note still sounds, the last onset of every track, and at each boundary which tracks
  enter late, leave a bar early, pick up, or hold a note across the line. Numbers are pop unless a flavour is named;
  bars count from 1 over the whole song. Every song's header comment and its pop `arrange()` lines were read; the
  drum, bass and kick consts were read for jazz-soul (U10, J1, J5), funk (U10) and electronic (U11, A1, J3, R3).
- **Who keeps what** (`packages/content-kit/src/unit-songs/claims.ts`): a take that plays chords claims every
  non-drum Oak part of its sections except `oakKeeps`. So after the takes, Oak's pads, doubles, horns and guitars
  are mostly gone; Oak's **drums survive every take except** U11 chorus3–4, U13 (all), R1 (all but outro), R2
  verses/bridge/outro (kick, perc), R3 (bells, mambo kick), A1 (all), A2 (break, ballad, drive). Pitched fixes
  improve the song Oak plays when the unit opens (the learner's model); drum fixes also survive the takes. Each
  fix says which.
- **Bands:** every Band in `content/bands/index.ts` (25, compound ones included) was evaluated in jazz-soul, funk
  and electronic (`{{key}}` = `C4:major`) for kick/bass collisions and drum velocity levels; the groove builders
  (`JAZZ_4`, `FUNK_4`, `ELEC_4`, `acidCell`, `jazzForm`, `iiVIComp`, `blues`, `sections`) were read.
- **Examples:** every lesson example in `content/core/U1*/L*/lesson.ts` and `content/advanced/*/L*/lesson.ts` whose
  code has `arrange(`: U17.L02 "hook" (also the graded reference), A2.L02 "hook", A2.L04 "three-fits", A2.L06
  "hook", J4.L03 "the-whole-form". U10.L01, U17.L03 and A2.L03 mention `arrange()` only in comments or starters.
- **Rules every song fix keeps** (AUTHORING §23.2–§23.5, PLAN §7): no section added, renamed or resized (U10, U11,
  U14, U16, A2 are at 64 bars); new material only as variant consts (`hatsChorus2`) through the builder's
  `ByKind.only`; tune pitches, bass downbeat roots and chord roots identical across flavours; the §13 clash scan
  for any new pitched note; `UnitSongDef.version` 1 → 2; re-record the loudness harness for the song
  (`SONGS_RECORD=1`) after any change that moves levels; list it in the "Listen" list of `docs/decisions.md`.
  Strudel used below: `.mask("<1!7 [1 0]>")` inside a section const silences beats 3–4 of the section's bar 8
  (`arrange()` restarts each section); `.velocity()` under ~.5 on `jazzkit`/`rockkit` picks the soft (ghost) layer
  (`packages/strudel/src/pack.ts` `layeredIndex`); `.orbit(2)` on a part plus `.duckorbit(2).duckdepth(x)` on the
  kick is the sidechain duck the toolbox already teaches (`tb.duck`, A2.L05).
- **Could not verify:** anything by ear, loudness and the "loud sections ≥ 1 LU over quiet" claim (no harness run);
  whether profile `band` lint accepts `stack()` and `.duckorbit()` in a Band line; whether the production normaliser
  and the composer treat a `.mask()`ed section const exactly as the headless one does.

Ratings: **yes** / **no** / **partly**; **n/a** where the item cannot apply (a Band loop has no ending; a song in a
style that is neither jazz nor rock/pop is not built from either end).

---

## Findings across the 18 songs (read these first)

1. **Endings are solid; seams are not.** All 18 songs end on purpose (an outro, a cadence, a final hit; J2 and J5
   let parts leave in order), though all 18 end the same way, so the album could use a fade or an exit order more
   often. Half the songs (U10, U12, U14, U15, U16, J1, J2, J5, R3) switch every part on the bar line at every
   boundary: the only seam markers are a crash on the downbeat and a snare fill in the bar before (U16 and R3 have
   one incidental late snare). U11 (late guitar answers), U13 (the push and the stop), U17 (bass and hats drop the
   bar before each chorus), J3 (the one-bar breaks), J4 (the ride sits out), R1 (horn pickups), R2 (late tune, the
   drift), A1 (the lift's drop) and A2 (late tune in the break) stagger a boundary.
2. **Copy-paste repeats.** Chorus 2 is chorus 1 in every part in U12, U14, U15, U16; U15's verse 2 is verse 1 too;
   J1's three A sections are one A three times (pop, funk, electronic); U10's two pre-choruses, A1's two lifts, R3's
   verses (9 of 10 parts) likewise. A chorus 3 that differs only by a tambourine (U12, U14, U16) reads the same.
3. **Once-only moments live in whole sections.** Seven songs (U12, U14, U15, J1, R2, R3, A2) have no bar heard once
   inside a repeated section type: their unique material is a bridge, a key, a break heard once as a whole section,
   which `unique-event` does not count. A drum-only stop (survives the takes) fixes most of them.
4. **The middle is crowded wherever Oak adds a pad or a double.** The pad plays the chords' notes in the chords'
   octave (U12, U16, U17, J1, J5, A1, A2); the octave-down vox sits inside the chords (U10, U17, J2); horns sit on the
   chords (U15, R1, R3); guitar and keys stack on the chords (U11 vamp, U13 chorus, U14 outro, R1). The tune is
   always clear above; the problem is two or three parts in one octave under it. Takes remove most of these after the
   fact, so this is about the song Oak plays first.
5. **Drums are tidy, not loose.** Outside U13, R1–R3 and A1, every kick and snare in every flavour plays at one
   velocity; the hats or ride carry one fixed accent shape (`[1 .86 .94 .86]*2`). No ghost notes, no alternate-hand
   hats, and the jazzkit and rockkit soft layers (v4 has them) are never reached.
6. **Jazz-soul flavour rides, but the kick is not feathered.** In U10–U17 jazz-soul the ride plays the jazz pattern
   and the hi-hat 2 and 4 (top-down), but the kick plays `bd ~ bd ~` (or `bd*4` in J1) at full velocity.
7. **Electronic low end:** where the electronic flavour drops a sine sub or a held acid note under four-on-the-floor
   (U11 vamp, A1 verse/intro/outro, J2 heads, J3 heads, R3 tresillo) 60–88 kicks land on a ringing bass. Elsewhere
   the electronic bass avoids the kick well (≈ 43 % of bass onsets on a kick, ≤ 14 kicks under a ringing bass).

---

## Unit songs

### U10 "After dark" (A minor, 64 bars: intro 4, verse1 8, pre1 4, chorus1 8, verse2 8, pre2 4, chorus2 8, bridge 8, chorus3 8, outro 4)

Takes claim mel, chords, bass in every section; Oak's drums, perc and vox (when the take plays no chords) survive.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 61–64 | i iv V i, final bar one held hit (`a1@8`, chord, kick); snare leaves at 63.3, hats at 63.4, vox already out. None. |
| Seam not all at once | partly | every boundary | All 8 parts switch on the line; only snare fills (`[sd sd]` in bar 8) and crashes mark seams. pre→chorus: let kick and bass stop after beat 2 of pre bar 4 while the snare roll carries on: `kickPre = s("<[bd ~ bd ~ bd ~ bd ~]!3 [bd bd bd bd ~ ~ ~ ~]>")`. chorus2→bridge: hats leave a beat late, `hatsBridge = s("<[hh hh hh hh ~ ~ ~ ~] ~!7>")` (now `silence`). Drum fixes survive the takes. |
| Once-only moment | partly | chorus3 bar 7 (59) | Only the V–i cadence bar (E for G) is heard once inside a repeated type; the C-minor bridge is a whole section. Add a drum stop in chorus3 bar 4 (bar 56): `kickChorus3`/`snareChorus3`/`hatsChorus3` = chorus pattern `.mask("<1!3 [1 0] 1!4>")`; tune and chords ring through. |
| Front/middle/back | yes | all | Tune 33 distinct bars of 62; hats 3/54, kick 9/64. None. |
| Kick and bass | yes | all | Pop locks bass to kick (81 %, 7 kicks under a ringing note); electronic 44 % on the kick, 6 rings. None. |
| Repeats varied | partly | pre1 = pre2 (8/8 parts); chorus2 = chorus1 + vox | pre2: `hatsPre2 = s("<[hh*16]!3 [hh*14 oh ~]>")`, `percPre2` tambourine for shaker (`tb*8`); chorus2: `percChorus2 = s("<[~ tb ~ tb]!4 [tb*8]!4>")` (bars 5–8 lift). Drums only, so they survive. |
| Arc | yes | densities 23/30/71/50/34/71/53/18.5/59/21 | Build, a bridge valley, the last chorus over the first two. The pre-chorus (hats 16ths, shaker 8ths, bass 8ths) is denser than any chorus: optional `hatsChorus3 = s("[hh hh hh oh]*4")` so chorus3 is the peak. |
| Registers clear | no | chorus2, chorus3 | vox (strings, tune `.transpose(-12)`, 57–64) sits inside `chordsChorus` (55–64). Drop the `.transpose(-12)`: a unison string double of the tune thickens the front without entering the middle (pitches already clash-checked). |
| Drum looseness | partly | all | Hats: fixed accent shape; pre: a saw ramp. Kick, snare, clap one level in every flavour, no ghosts; jazz-soul cross-stick one level. Pop/indie: `snareVerse = s("<[~ sd [~ ~ ~ sd] sd]!7 …>").velocity("<[1 1 [1 1 1 .3] 1]!7 …>")` (a ghost on the "a" of 3, rockkit's soft layer); funk: ghosts on the "e" of 2 and 4 (`.velocity(.25)`); jazz-soul: `[~ ~ ~ rim]` at .4 as comping. |
| Built from the right end | partly | jazz-soul | Pop/indie/funk/electronic: kick and snare carry each section, hats on top (yes). Jazz-soul: ride pattern and hats 2 & 4 (top-down) but `kickVerse = s("bd ~ bd ~")` at full level: feather it, `s("bd*4").velocity(.3)` in the jazz-soul builder. |

### U11 "Down on C" (C blues, 64 bars: intro 4, vamp1 4, vamp2 4, chorus1–4 12 each, outro 4)

Takes claim gtr, chords, bass (keep mel, vox) and, in chorus3–4, kick, snare, hats.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 61–64 | The riff tags C7 F7 C7–G7 and lands on one C hit; vox ends at 63.75. None. |
| Seam not all at once | yes | chorus1–3, chorus4 | The guitar answers enter late in each chorus; the vox enters late in chorus4; the riff plays the intro alone before the band drops in. None. |
| Once-only moment | yes | chorus2 (in G), bar 37 | Chorus2's quick change in G and its fills are heard once inside the repeated `chorus` type; the crash/perc hit at chorus3 bar 1. None. |
| Front/middle/back | yes | all | Tune 14/27 distinct, guitar answers 18/31, hats 6/63. None. |
| Kick and bass | partly | vamp1, chorus3–4, outro (electronic) | Pop 42 % on the kick (boogie 8ths), 24 kicks under a ringing note. Electronic: 82 kicks under a ringing bass: `bassVamp` sine `c2@7 c2@3 c2@6` and the swung `c2@2` shuffles under `bd*4`. Electronic only: put the bass on `.orbit(2)` and `kickChorus …duckorbit(2).duckdepth(.6)`, or shorten the sub (`.decay(.3).sustain(0)`). Re-record loudness. |
| Repeats varied | yes | chorus1–4 | 0–1 of 9 parts identical between choruses. None. |
| Arc | partly | chorus2 63 ev/bar vs chorus4 53 | The densest section is chorus2 (chords strike four notes on every 8th, 32 events/bar); chorus3 falls to 36, chorus4 is 53: the peak is mid-song. `chordsChorus2` → `struct("x ~ [~ x] ~")` comp (8/bar) so chorus4 (riff, answers, shuffle) is the peak. |
| Registers clear | partly | vamp1–chorus3, chorus4 | Guitar riff (55–64) on the chords (52–60) in vamp1 strike together (in the choruses the riff answers in the tune's gaps); chorus4 stacks chords 58–67, vox 60–72, tune 67–77. vamp1: `chordsVamp` one strike a bar (`struct("x ~ ~ ~")`) under the riff; chorus4: give `chordsChorus4` chorus1's lower voicing (52–60), roots unchanged. |
| Drum looseness | partly | all | Swing from chorus3 in every flavour, hats 3 levels; kick and snare one level, no ghosts. Shuffle ghosts: `snareChorus3 = s("[~ sd] sd [~ sd] sd").velocity("[1 .3] 1 [1 .3] 1")` (ghost on the swung "let"). Taken in chorus3–4, so put the same in `snareChorus` (chorus1–2) to survive. |
| Built from the right end | yes | all | Pop backbeat from kick and snare; jazz-soul rides (`rd` 6.7/bar, hats 2 & 4). None. |

### U12 "Seventh heaven" (C major, 61 bars: intro 4, verse1 8, chorus1 8, verse2 8, chorus2 8, bridge 8, turn 4, chorus3 8, outro 4, end 1)

Takes claim mel, chords, bass everywhere (bridge keeps pad); Oak's drums and perc survive.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 57–60, end 61 | The staircase Dm7 Em7 Fmaj7 G7, then one bar of Cmaj7 (tune on E), hats and snare out. None. |
| Seam not all at once | partly | every boundary | Crash in the bar before and snare fills only. turn→chorus3: `kickBridge2 = s("<[…]!3 [bd ~ bd ~ ~ ~ ~ ~]>")` and the snare likewise, so the E7 rings alone for two beats into the last chorus (stop early); survives the takes. |
| Once-only moment | no | — | Chorus1 = chorus2 in all 8 parts, chorus3 differs only in perc; bars heard once are only in the bridge, turn and end (whole sections). Drum stop in chorus3 bar 5 (bar 53): `kickChorus3`/`snareChorus3`/`hatsChorus3` = `.mask("<1!4 [1 0] 1!3>")`. |
| Front/middle/back | yes | all | Tune 31/59; hats 2/48, kick 6/60. None. |
| Kick and bass | yes | all | Pop 62 % on the kick, 4 rings; electronic 43 %, 11. None. |
| Repeats varied | no | chorus1 = chorus2 (8/8); chorus3 = chorus1 but perc | `hatsChorus2 = s("<[hh*8]!4 [hh hh hh oh]*2!4>")`; chorus2 bar 8 snare fill `[~ sd [sd sd] [sd sd sd sd]]` (`snareChorus2`); chorus3: `hatsChorus3` 16ths plus the crash every 4 bars. Drums only. |
| Arc | yes | 27/34/46/38/46/25/27.5/52/33/12 | Bridge and turn are the valley, chorus3 the peak. None. |
| Registers clear | no | intro, chorus1–3, bridge, end | The pad plays the chords' notes in the chords' octave (50–62 both). Carve: pad = the two top chord tones moved into the free gap above the chords and under the tune (62–67), or `padChorus` → `silence` in chorus1–2 and kept for chorus3 (also a lift). The bridge keeps the pad over the learner's chords (`oakKeeps`), so move it there first. |
| Drum looseness | partly | all | Hats 3 levels; kick, snare, clap one level; jazz-soul swings, snare one level. Soul ghosts: `snareVerse = s("~ [sd ~ ~ sd] ~ [sd ~ ~ sd]").velocity("1 [1 0 0 .3] 1 [1 0 0 .3]")` in pop, indie, jazz-soul. |
| Built from the right end | partly | jazz-soul | Pop bottom-up (yes); jazz-soul rides but the kick is one level: feather it as U10. |

### U13 "Ahead of the beat" (C major, 54 bars: intro 4, verse1 8, stop 1, chorus1 8, verse2 8, bridge 8, break 4, chorus2 8, outro 4, end 1)

Takes claim drums, bass and chords in every section (keep mel, gtr); every drum fix here is for the opening listen only.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro, end 54 | One C^7 hit; hats, snare, guitar out. None. |
| Seam not all at once | yes | verses, stop 13, break 38–41 | Kick, bass and chords push on the "and" of 4 across the line; the one-bar snare fill; the break's last kick pushes into chorus2. None. |
| Once-only moment | yes | stop (13), break (38–41) | None. |
| Front/middle/back | yes | all | Tune 22/45; guitar scratch the middle; hats 5/52. None. |
| Kick and bass | yes | all | Locked on purpose (77 %, 0 rings); electronic 63 %, 8 rings. None. |
| Repeats varied | yes | verse2 + guitar; chorus2 new hats, perc | None. |
| Arc | yes | 24/32/8/99/44/72/23.5/103/43/8 | None. |
| Registers clear | no | chorus1, chorus2 | Guitar 16ths (48 events/bar, 53–62) and the Rhodes (53–62) share one octave; the header's "guitar triads above them" is not what sounds. `chordsChorus` → one strike per chord (`struct("x ~ ~ ~")`), the guitar keeps the grid; the guitar survives the chord takes (`oakKeeps`), so this also clears it against the learner's Rhodes. |
| Drum looseness | yes | all flavours | Ghost snares at .3 (90), breathing hats (152 soft). None. |
| Built from the right end | yes | all | Straight in every flavour by rule; jazz-soul rides with ghosted ride. None. |

### U14 "Four colours" (modes, 64 bars: intro, verse1, chorus1, verse2, chorus2, bridge, chorus3, outro, 8 each)

Takes claim gtr/mel/pad, chords, bass; Oak's drums and perc survive.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 57–64 | (Dm7 G7)×3 Dm7 Dm7; drums out after bar 63, a final hit plus one guitar note. None. |
| Seam not all at once | partly | intro→verse1, verse1→chorus1 | Crash in the bar before; all parts switch on the line. Verse→chorus: kick and bass drop beats 3–4 of verse bar 8, the riff leads in alone: `kickVerse = s("<[…]!7 [bd ~ ~ ~ ~ ~ ~ ~]>")` (bass is taken; the kick survives). |
| Once-only moment | no | — | No bar heard once inside chorus×3 or verse×2; the colours change per section only. Drum stop in chorus3 bar 8 (bar 56): `.mask("<1!7 [1 0 0 0]>")` on kick, snare, hats; the hook's last note rings alone. |
| Front/middle/back | yes | all | Riff fronts the verses, tune the choruses (13/37); kick 4/60. None. |
| Kick and bass | yes | all | 67 %, 3 rings; electronic 48 %, 14. None. |
| Repeats varied | no | chorus1 = chorus2 (9/9); chorus3 = chorus1 but perc | `hatsChorus2` opens on the "and" of 4 in bars 4 and 8 (`<[hh*16]!3 [hh*14 oh ~]>`); `snareChorus2` bar 8 fill. Drums only. |
| Arc | yes | 12/27/47.5/32/47.5/27.6/55.5/32.6 | None. |
| Registers clear | partly | outro | Guitar riff (50–59) and chords (50–59) together. `chordsOutro` → `silence` for bars 1–4 (`"<~!4 …>"`), back for 5–8: the riff and bass alone, then the chords return (also a staggered close). |
| Drum looseness | partly | all | Hats, tambourine 3-level shapes; kick, snare one level; jazz-soul ride 3 levels. Ghost snares as U12 (pop, indie, jazz-soul) and funk 16th ghosts. |
| Built from the right end | partly | jazz-soul | As U10: feather the jazz-soul kick. |

### U15 "Visitors" (C major, 61 bars: intro 4, verse1 8, chorus1 8, solo 8, verse2 8, chorus2 8, bridge 8, outro 8, end 1)

Takes claim mel, chords, bass (keep horns, and mel in the bridge); Oak's drums, perc and horns survive.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 53–60, end 61 | The chain E7 A7 D7 G7 with horn stabs, then one C. None. |
| Seam not all at once | partly | chorus2→bridge | Horns enter a bar late in the bridge's second half; otherwise every part on the line. chorus1→solo: horns hold the chorus's last landing for one beat into the solo, `hornsSolo = note("<[e4,g4,b4] ~!7>").struct("<[x ~ ~ ~] ~!7>")` (now `silence`; horns survive the takes; clash-check over Cmaj7). |
| Once-only moment | no | — | Verse2 = verse1 and chorus2 = chorus1 in all 8 parts; once-heard bars only in outro/end. chorus2 bar 8 (bar 44): a stop where only horns and tune sound: `.mask("<1!7 [1 0]>")` on kick, snare, hats, perc. |
| Front/middle/back | yes | all | Tune 37/59; horns step forward in the outro. None. |
| Kick and bass | yes | all | Pop bass on every kick (100 %), 0 rings; electronic 43 %, 0. None. |
| Repeats varied | no | verse1 = verse2, chorus1 = chorus2 (8/8 each) | verse2: `hornsVerse2` long notes in bars 5–8 (survive), `hatsVerse2 = s("[hh hh hh oh]*2")`; chorus2: `percChorus2 = s("tb*8")`, `snareChorus2` 16th fill in bar 4. |
| Arc | partly | chorus 58 = chorus 58 > outro 50 > bridge 41 | The two equal choruses are the peak; the last third never climbs past them. Outro: `hatsOutro = s("hh*16")`, `percOutro` tambourine 8ths and the horns on every stab, so the outro tops the choruses before the end bar. |
| Registers clear | no | chorus1, chorus2, outro, end | Horns (55–65) sit on the chords (55–65). Horns up an octave where the tune rests (outro bar 8, end), and in the choruses the chords rest on the horns' beats (`chordsChorus` `struct` as the complement of `hornsChorus`). Horns are `oakKeeps`, so they then also clear the learner's chords. |
| Drum looseness | partly | all | Hats 70 levels (shape), ride 3; kick, snare one level. Ghost snares as U12. |
| Built from the right end | partly | jazz-soul | Feather the jazz-soul kick. |

### U16 "Borrowed light" (C major, 64 bars: intro 4, verse1 8, chorus1 8, verse2 8, chorus2 8, solo 8, bridge 8, chorus3 8, outro 4)

Takes claim mel, chords, bass (bridge also pad); Oak's drums and perc survive.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 61–64 | C E♭ Fm C (minor plagal), final hits, the tune's last note on the "e". None. |
| Seam not all at once | partly | solo→bridge | Only one part staggers: the snare enters a bar late in the bridge. chorus3→outro: the hats keep time two beats into the outro and stop (`hatsOutro = s("<[hh*4 ~ ~ ~ ~] [hh*8]!3>")` — or leave and let them stop one bar early in chorus3). |
| Once-only moment | partly | verse1/verse2 bar 8 | Only the two verse fills differ. chorus3 bar 7 (♭VI ♭VII I, bar 59): drums drop on the A♭ and return on the B♭, `.mask("<1!6 [0 1] 1>")` on kick, snare, hats. |
| Front/middle/back | yes | all | None. |
| Kick and bass | yes | all | 58 %, 0 rings; electronic 43 %, 0. None. |
| Repeats varied | partly | chorus1 = chorus2 (8/8); chorus3 = chorus1 but perc | `hatsChorus2` 16ths in bars 5–8, `snareChorus2` bar 8 fill; verse2 already varies. |
| Arc | yes | 29/29/58/34/58/28/24/62/26 | None. |
| Registers clear | no | chorus1–3 | Pad (55–64) doubles chords (55–64); the tune sits at 71–77, leaving 65–70 free. `padChorus` = the chord's two top tones an octave up (E4–A4 range), under the tune. |
| Drum looseness | partly | all | One-level kick and snare. Ghost snares as U12. |
| Built from the right end | partly | jazz-soul | Feather the jazz-soul kick. |

### U17 "The long way round" (60 bars: intro 4, verse1 8, chorus1 8, verse2 8, bridge 8, lift 8, chorus2 8, outro 8)

Takes claim mel, chords, bass; Oak's drums and perc survive; pad and vox survive only in the outro and where a take plays no chords.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 53–60 | D A Bm G D A G D, drums out at the end, final hit. None. |
| Seam not all at once | yes | verse1→chorus1, lift→chorus2 | The bass (and hats, perc before chorus2) rest in the last bar while chords and tune play on. None. |
| Once-only moment | partly | verse2 bars 7–8 | Only the door to G (D7 G) is heard once; the lift to D is a whole section. Lift bar 8: a reverse swell into chorus2, `percLift = s("<~!7 [~ ~ swoosh ~]>")`, and an `impact` on chorus2 bar 1 (`percChorus2 = s("<[cr, impact] …>")`), once. |
| Front/middle/back | yes | all | None. |
| Kick and bass | yes | all | 64 %, 1 ring; electronic 46 %, 13. None. |
| Repeats varied | yes | verse2 new harmony; chorus2 lifted with pad, vox | None. |
| Arc | yes | 23/28/54/29/21.5/40/66/52 | None. |
| Registers clear | no | bridge, chorus2, outro | chorus2 and outro stack chords (54–62), pad (54–62) and vox (57–64): three parts in one octave. vox: drop its octave-down transpose (unison double of the tune, 69–76); pad: the top two chord tones in the gap 64–69, or `silence` in chorus2 bars 1–4. |
| Drum looseness | partly | all | One-level kick and snare. Ghost snares as U12. |
| Built from the right end | partly | jazz-soul | Feather the jazz-soul kick. |

### J1 "Two-five street" (swing, 57 bars: intro 4, a1 8, bridge-bb1 4, bridge-f1 4, a2 8, solo 8, bridge-bb2 4, bridge-f2 4, a3 8, outro 4, end 1)

Takes claim chords (a1–a3, keeping tune and bass) and mel, chords, bass elsewhere; Oak's drums survive everywhere.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro, end 57 | Em7 A7 Dm7 G7 then one C^7 with the crash. None. |
| Seam not all at once | partly | a1 bar 8 | A snare fill at a1's bar 8 (jazz-soul); every part switches on the line at all 10 boundaries. The vibes pick up into each A from the bridge: `melBridge2` bar 4 (F6, tune on D) ends `[d5@6 c5 d5]`-style with two chord-tone eighths before the A (survives only where the bridge take has not claimed mel; also good in a2/a3 where mel is `oakKeeps`). |
| Once-only moment | no | — | a1 = a2 = a3 and bridge-bb1 = bridge-bb2 in all 8 parts (pop, funk, electronic); once-heard bars only in outro/end. a3 bar 4: stop-time, drums and bass hit beat 1 only while the vibes play on: `.mask("<1!3 [1 0 0 0] 1!4>")` on drums, kick, snare, hats in `*A3` consts. |
| Front/middle/back | yes | all | Tune 25/53, ride 5/57. None. |
| Kick and bass | yes | all | Feathered kick under a walking bass is the style; 63 % on the kick. None. |
| Repeats varied | no | a1 = a2 = a3 (8/8; jazz-soul varies a3 bass and snare) | a2: hats open on the "and" of 4 in bar 8 and the ride switches to the bell or crash-ride on bar 1 (`drumsA2`); a3: the bass walks (jazz-soul's `bassA3` in every flavour) and the comping goes to four-to-the-bar. Drum variants survive. |
| Arc | partly | flat 29 ev/bar; solo 41 | A jazz arc peaks in the solo, which it does; the out-head is the in-head. a3 as the shout: crash on 1 and `snareA3` comping on the "and" of 2 and 4. |
| Registers clear | partly | bridges, outro, end | Pad (46–60) doubles chords (46–60). Pad as two guide tones above the comping (62–67), or `silence` in bridge-bb2/bridge-f2 (variation too). |
| Drum looseness | partly | all | Ride 3-level shape, swing; kick (`bd*4`, meant as feathering) and snare one level. `kickA = s("bd*4").velocity(.3)` (jazzkit soft layer); comping `snareA = s("~ ~ [~ sd] ~").velocity(.45)` with the fill kept. |
| Built from the right end | yes | all flavours | Ride pattern and hats 2 & 4 first in every flavour. None. |

### J2 "On the road" (swing, 60 bars: intro 4, head1 8, tour 12, bridge 8, solo 8, head2 8, ballad 8, outro 4)

Takes claim mel, chords, bass in tour, bridge, solo, ballad; heads, intro and outro stay Oak's.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 57–60 | Drums stop after outro bar 2 (hats, snare, ride), then Dm9 G13 C6/9 alone: exit order and a last chord. None. |
| Seam not all at once | partly | crashes only | Every part on the line. head2→ballad: the ride keeps two beats into the ballad and stops (`percBallad = s("<[rd rd ~ ~] ~!7>")` before the ballad's own pattern), the drums thin a beat late. |
| Once-only moment | partly | tour bars 13, 17; head2 41 | Crashes at each new key, vox in head2 (whole section). head2 bar 8 (bar 48): a two-beat break, only vibes and vox (`.mask("<1!7 [1 0]>")` on kick, snare, hats, perc). |
| Front/middle/back | yes | all | Tune 45/60. None. |
| Kick and bass | partly | heads (electronic) | Jazz-soul 62 %, 0 rings; electronic 60 kicks under the two-feel half notes. Electronic: bass `.orbit(2)` + kick `.duckorbit(2).duckdepth(.5)`, or `.clip(.5)` on the two-feel. |
| Repeats varied | yes | head2 new chords, vox, perc | None. |
| Arc | yes | 24/26/29.5/20/30/34/16/17.5 | Build to head2, release into ballad. None. |
| Registers clear | partly | head2, ballad, outro | vox (53–64) under/in the chords (50–60) in head2; pad on chords in ballad and outro. vox up an octave as the tune's unison; pad as guide tones above. |
| Drum looseness | partly | all | Ride 3 levels; snare (0.6/bar) and kick one level. Comping ghosts on the snare, feathered kick (as J1). |
| Built from the right end | yes | all | Ride first (jazz-soul `rd` 5/bar), hats 2 & 4. None. |

### J3 "Four rooms" (swing, 60 bars: intro 4, then the 17-bar tune ×3 as four 4-bar rooms + a 1-bar break, outro 4, end 1)

Takes claim chords (keep bass, mel) and in the G rooms the bass; Oak's drums survive.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro, end 60 | One Fmaj9 hit, hats and snare out. None. |
| Seam not all at once | yes | break1–3, intro→head1-f | The one-bar breaks (bass and chords rest, vibes alone); the tune's pickup into head1. None. |
| Once-only moment | partly | crashes at 22, 39 | The breaks recur three times; heads differ only by key. head2-g bar 4 (bar 55): stop-time before the outro, `.mask("<1!3 [1 0 0 0]>")` on kick, snare, hats. |
| Front/middle/back | yes | all | Tune 39/57. None. |
| Kick and bass | partly | heads (electronic, pop) | Electronic: 88 kicks under the sine sub held a whole bar (`bassHead = note("<[g1@8] …>")`) under `bd`; pop 32. Electronic: `.orbit(2)`/`.duckorbit(2)` or a sub that rests on the beat (`[~ g1@7]`). |
| Repeats varied | yes | head2 walks, new hats and snare | None. |
| Arc | partly | 25→27→36 (solo)→35 (head2)→31→8 | Plateau from the solo to the outro. head2-f and head2-c back to head1's hats (2 and 4) and brushes, head2-bb/g add comping on every beat and the crash: the last two rooms build. Drums only. |
| Registers clear | yes | all | No overlapping ranges found. None. |
| Drum looseness | partly | all | Swing and a 3-level ride; kick, snare one level. As J1. |
| Built from the right end | partly | pop, funk, electronic | Jazz-soul rides (5.5/bar) with hats 2 & 4 (yes); pop, funk, electronic play swung 8th hats with the ride a colour (pop `hh` 6.3/bar, `rd` 1.1). As J1 does: `hatsHead` → `rd ~ rd rd rd ~ rd rd` plus `~ hh ~ hh` in every flavour. |

### J4 "Back to the top" (jazz blues in F, 64 bars: intro 4, head1 12, head2 12, solo 12, bridge 8, head3 12, outro 4)

Takes claim mel, chords, bass, drums (ride), hats in head1–3 and the bridge; kick and snare survive.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 61–64 | The turnaround tag, then F7 held two bars; the last onsets fall in bar 63. None. |
| Seam not all at once | yes | head1→head2, head2→solo, head3→outro | The ride sits out the last bar of a head while the band plays on, and enters late in the outro. None. |
| Once-only moment | partly | head1 bars 4, 6, 8; head3 bar 12 | First-time-through bass/chords and a kick fill. head3 bar 12 (bar 60): stop-time, kick and snare hit beat 1 then rest (`.mask("<1!11 [1 0 0 0]>")` on `kickHead3`, `snareHead3`), the trumpet alone into the tag. |
| Front/middle/back | yes | all | Tune 37/60. None. |
| Kick and bass | partly | funk | Jazz-soul 15, pop 14 rings (fine); funk 95 kicks under the fingerbass. Funk: `.clip(.8)` on the bass or a 16th rest before each kick. |
| Repeats varied | yes | head2, head3 differ | None. |
| Arc | yes | 21/26/32/38/19/32/20 | Solo peak, bridge drop, head3 back up. None. |
| Registers clear | yes | all | None. |
| Drum looseness | yes | jazz-soul | Kick 5 levels with 32 feathered hits, snare 3 levels. Pop/funk hats shape only (minor). None for the style. |
| Built from the right end | yes | all | Ride and hats 2 & 4 first. None. |

### J5 "Home by another door" (ballad, 72 BPM, 48 bars: intro 8, a1 8, a2 8, solo 8, a3 8, outro 8)

Takes claim chords, bass (keep mel) in the intro, and mel, chords, bass (solo: plus hats, perc) elsewhere; a2 and the outro stay Oak's.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 41–48 | The tune ends a bar before the band's last Fadd9: exit order and a final chord. None. |
| Seam not all at once | partly | crashes only | Drums enter on the bar line at a1. A tenor pickup from the intro's last bar (B♭ turnaround, F7 backdoor, chord tones) into a1, and the brushes come in on beat 3 of a1 bar 1 (`snareA = s("<[~ ~ sd sd] [sd sd sd sd]!7>")`). |
| Once-only moment | partly | a2 bar 8 | Every A differs harmonically; one snare bar. a3 bar 4 (B♭m7 E♭7, the backdoor home, bar 36): the band stops for two beats, the tenor alone (`.mask("<1!3 [1 0] 1!4>")` on kick, snare, perc). |
| Front/middle/back | yes | all | None. |
| Kick and bass | yes | all | 91 % together, 0 rings. None. |
| Repeats varied | yes | all A sections differ | None. |
| Arc | yes | 7.6/30/41/39/35/25.5 | None. |
| Registers clear | no | a2, a3, outro | Pad (45–62) doubles chords (45–62). Pad as the two guide tones an octave above the comping, under the tenor; a2 and outro are untaken, so it is heard there. |
| Drum looseness | partly | all | Brushes are `sd sd sd sd` with `.n("2 0 2 0")` at one velocity; ride 3 levels; kick one level. `.velocity("[.5 .35 .45 .35]")` on the brushes, kick feathered at .3; a real sweep needs v5 (below). |
| Built from the right end | yes | all | Ride and brushes first. None. |

### R1 "In the pocket" (E minor funk, 57 bars: intro 4, verse 8, chorus1 8, bridge 8, break 8, lift 8, stop 1, chorus2 8, outro 4)

Takes claim the drums and bass (and keys/gtr) in every section but the intro, the stop and the outro.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro, bar 57 | One held hit by every part. None. |
| Seam not all at once | yes | into chorus1, lift, stop, chorus2 | Horn pickups across the line; horns and chords enter late elsewhere. None. |
| Once-only moment | yes | stop (45) | The one-bar drum fill with horns. None. |
| Front/middle/back | yes | all | Weighted hats repeat, tune 28/44. None. |
| Kick and bass | yes | all | Kick and bass pull together on purpose (78 %), 0 rings. None. |
| Repeats varied | partly | chorus2 = chorus1 but hats, perc (8/10 parts) | `hornsChorus2` adds a shout line in bars 7–8; `gtrChorus2` scratches 16ths in bars 5–8 (both `oakKeeps`, so they survive). |
| Arc | yes | 50/51/75/48/47/60/16/79/60 | None. |
| Registers clear | no | verse, lift, outro; intro, choruses, break | Four comping parts: guitar (55–64) on chords (50–62), keys (64–74) on horns (67–76). verse: `chordsVerse` stabs on beat 1 only, guitar owns the 16ths; choruses: keys rest where the horns stab (`keysChorus` `struct` complement) or move down to the chords' old octave once the chords are out. |
| Drum looseness | yes | all | Metric-weight hats (8 levels), ghost snares (127). None. |
| Built from the right end | yes | all | Kick, snare and bass first. None. |

### R2 "Crosscurrent" (4/4 polyrhythm, 53 bars: intro 4, verse1 8, chorus1 8, verse2 8, break 4, bridge 8, chorus2 8, outro 4, end 1)

Takes claim kick, perc, bass, chords in the verses and kick, snare, hats, bass, chords in bridge and outro.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | end 53 | One Dm7 hit. None. |
| Seam not all at once | yes | break→bridge, bridge drift | The tune enters a bar late after the break; the bridge's cycle drifts across the bar line. None. |
| Once-only moment | no | — | Verse2 = verse1 but hats; chorus2 is chorus1 in D minor; once-heard bars only at the end. chorus2 bar 4 (bar 44): one bar where the cowbell's three plays alone under the tune (`.mask("<1!3 0 1!4>")` on kick, snare, hats, `perc2`); the choruses are untaken. |
| Front/middle/back | yes | all | None. |
| Kick and bass | yes | all | 80 %, 0 rings. None. |
| Repeats varied | partly | verse1 = verse2 but hats (7/8) | `perc2Verse2` toms answering the two in bars 4 and 8; `snareVerse2` already differs in jazz-soul. |
| Arc | partly | 41 ev/bar from chorus1 to the outro | Plateau: chorus1, bridge, chorus2, outro all 41. Bridge bars 1–4: hats and perc out (`hatsBridge = s("<~!4 …>")`) so the drift starts thin; the outro sheds parts bar by bar. |
| Registers clear | yes | all | None. |
| Drum looseness | yes | all | Soft hats (116), shaker ghosts, snare 2 levels. None. |
| Built from the right end | yes | all | Kick and bass carry the two, cowbell and chords the three. None. |

### R3 "Wood and iron" (son, 56 bars: intro 4, verse1 8, coro 8, verse2 8, bells 8, montuno 8, mambo 8, outro 4)

Takes claim bass, perc in the verses and percussion, kick, keys in bells, montuno, mambo; horns and mel are kept.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 53–56 | Refrain, G7 on the three-side, then C, every part on one hit. None. |
| Seam not all at once | partly | verse2→bells | Only the snare's late entry in the bells. coro→verse2: the horns (silent until the mambo) play one call on the "and" of 4 of the coro's bar 8, a new `hornsChorus` in place of `silence`, `.struct("<~!7 [~ ~ ~ [~ x]]>")` on a chord tone of G7; horns are kept by the takes, so it survives. |
| Once-only moment | no | — | No bar heard once inside a repeated type. mambo bar 8 (bar 52): a cierre, every part hits the clave's three-side and rests (`.struct("x ~ ~ x ~ ~ x ~")` on the mambo consts' bar 8 via `"<…!7 [x ~ ~ x ~ ~ x ~]>"`), once. |
| Front/middle/back | yes | all | Horns and tune front, clave and cowbell back. None. |
| Kick and bass | partly | coro, montuno, mambo (funk, electronic) | Pop locks the tresillo (100 %, idiomatic). Funk 81 and electronic 83 kicks under the held tresillo (`c2@6`) under four-on-the-floor. Funk/electronic: the kick follows the tresillo (`s("bd ~ ~ bd ~ ~ bd ~")`) in those sections, or bass `.clip(.6)`. |
| Repeats varied | no | verse1 = verse2 but congas (9/10) | verse2: horns answer the tune in bars 4 and 8 (`hornsVerse2`, kept), keys play the montuno figure instead of block chords. |
| Arc | partly | coro 61 > mambo 59 | The mambo should be the climax. mambo: cowbell on every beat plus the horns harmonised; or thin the coro's congas. |
| Registers clear | partly | mambo, outro | Keys (60–72), horns (60–83) and tune (72–79) overlap. mambo: keys' montuno down an octave (C3–C4), horns take C4 up. |
| Drum looseness | yes | all | Congas 8 levels, bongó 6, cowbell 3, kick 4. None. |
| Built from the right end | n/a | — | A son is built from the clave and the tresillo, which this one is. |

### A1 "Turn the dial" (C–F vamp, 57 bars: intro 4, verse1 8, lift1 4, chorus1 8, verse2 8, bridge 8, lift2 4, chorus2 8, outro 4, end 1)

Takes claim drums, bass, mel (and pad in lifts/chorus2) in every section; only chords (kept) and perc survive.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro, end 57 | Back to the old record, one clean bar of C. None. |
| Seam not all at once | yes | lift→chorus | The lift's last bar drops the kick and bass for beats 3–4 before the drop. None. |
| Once-only moment | partly | verse1/verse2 bar 8 | Two verse fills; the echo bridge is a whole section. chorus2 bar 1: one `impact` with the crash (`percChorus2 = s("<[cr, impact] …>")`); perc survives the takes. |
| Front/middle/back | partly | all | The riff (front) repeats its notes in every section (14/53 distinct); what changes is its sound, the unit's idea. None needed; optionally a varied last bar in verse2. |
| Kick and bass | partly | intro, verse, bridge, outro (electronic) | Electronic: 60 kicks under the sine sub (`c2@8`) and the held wavetable bass (`c2@4`) on four-on-the-floor. `.orbit(2)` on those bass consts + `.duckorbit(2).duckdepth(.6)` on the kick (the unit's own pump idea). |
| Repeats varied | partly | lift1 = lift2 (8/8) | lift2: `snareLift2` roll doubles in bar 4 (`sd*16` → `sd*32` with a velocity ramp), the riser starts higher; drums are taken, so also `percLift2` (survives). |
| Arc | partly | verse2 52 ≥ lift 50 > chorus2 47 > chorus1 42 | By events the busiest section is a verse; the choruses' size is in sound (filter, acid), which density does not measure, and could not be checked by ear. `hatsVerse2` 16ths → 8ths so the chorus stays the peak. |
| Registers clear | partly | lifts, chorus2 | Pad (55–65) on chords (52–60). Pad as an open fifth above the chords' top note. |
| Drum looseness | partly | pop, jazz-soul | Ghost hats (128), snare 4 levels in pop; electronic is machine-tight by style. Kick one or two levels; fine. Optional. |
| Built from the right end | yes | all | None. |

### A2 "Room to breathe" (A minor, 64 bars: intro 4, verse1 8, chorus1 8, verse2 8, chorus2 8, break 8, ballad 8, drive 8, outro 4)

Takes claim mel, chords, bass (plus pad or vox) in verses and choruses, drums in break, ballad, drive.

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | yes | outro 61–64 | F G Am Am, snare out at bar 63, final hits. None. |
| Seam not all at once | yes | chorus2→break | The tune enters a bar late in the break, over the sampled break. None. |
| Once-only moment | no | — | No bar heard once inside verse×2 or chorus×2; the break is a whole section. chorus2 bar 8 (E, bar 36): an `impact` and a `swoosh` (`percChorus2 = s("<~!7 [impact ~ ~ swoosh]>")`) leading into the break, once; perc survives the takes. |
| Front/middle/back | yes | all | None. |
| Kick and bass | yes | all | 72 %, 3 rings; electronic 40 %, 6. None. |
| Repeats varied | yes | verse2 counter-line, chorus2 held line | The lessons' ideas. None. |
| Arc | yes | 25/28/54/34/55/19/16/49/23 | Two valleys before the drive. None. |
| Registers clear | no | intro, choruses, verse2, ballad, drive, outro | Pad (52–64) on chords (52–64); verse2's counter-melody (55–64) inside the chords' octave, against A2.L01's own registers idea of verse1. verse2: `chordsVerse2` shells (root and 5th, under C3) or stabs on beat 1, so the counter-line owns C4–E4; pad as the top two tones in the gap 64–69 under the hook. |
| Drum looseness | partly | pop, jazz-soul, funk | Hats 3 levels, kick and snare one level; the break is a sampled break (loose). Ghost snares as U12 in verses and choruses (untaken drums). |
| Built from the right end | yes | all | None. |

---

## Band styles

Bands loop under the learner's piece, so items 1, 3 and 7 (ending, once-only, arc) belong to the learner's code,
not the Band: **n/a**, except `band.sections`, the one Band with a form. Item 2 is judged on `band.sections`.

### Jazz-soul (jazzkit, upright, Rhodes; swing from U03)

| Item | Rating | Bands | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | n/a | — | — |
| Seam not all at once | no | `band.sections` | Verse→chorus switches every part on the line. `drumsVerse` bar 4: `s("<[bd ~ sd ~, rd*4]!3 [bd ~ sd [sd sd], rd*4]>")` (a fill), and the bass walks into the chorus root on beat 4 of verse bar 4. |
| Once-only moment | n/a | — | — |
| Front/middle/back | yes | all | The Band is the back by design. None. |
| Kick and bass | yes | all | A light kick under walking or two-feel bass is the style. None. |
| Repeats varied | no | every Band | Exact 1–4-bar loops (8, 12, 32 for phrase, blues, rhythm changes): no turnaround fill, the same comp every bar. A 4-bar drum cycle with a fill in bar 4: `<[groove]!3 [groove, ~ ~ ~ [~ sd]]>`; comping `struct("<x ~ [~ x] ~>!3 [x ~ ~ [~ x]]")`. |
| Arc | n/a | — | — |
| Registers clear | yes | all | Chords voiced below the tonic, bass two octaves down (`content/bands/index.test.ts`). None. |
| Drum looseness | partly | all | One accent shape `HUMAN_8THS` over the whole stacked drum line, so kick, snare and ride share one contour; no ghost snare, no feathered kick; the jazzkit's soft layers are never reached. Per-layer velocities: `stack(s("rd [rd rd] rd [rd rd]").velocity("[.95 [.7 .8]]*2"), s("~ hh ~ hh").velocity(.8), s("bd*4").velocity(.3), s("~ ~ ~ [~ sd]").velocity(.4))`. |
| Built from the right end | partly | `JAZZ_4`, axis, aeolian, modal, two-five-one, doo-wop, three-chord, vamp, soul-68 | Only `jazzForm` (jazz-blues, rhythm-changes) and `iiVIComp` are top-down (`bd ~ ~ ~, rd [rd rd] rd [rd rd], ~ hh ~ hh`). The rest play `bd ~ sd ~, rd*8` / `bd ~ sd [~ bd], rd*8`: a rock backbeat with the hi-hat swapped for an even-eighth ride and no hi-hat on 2 and 4 — `band.two-five-one`, J1's own Band, among them. Make `JAZZ_4` the top-down stack above for every jazz-soul Band except the soul ones (soul-68, neo-soul keep a backbeat). |

### Funk (RolandTR808 / oak808, fingerbass, clav; feel "16th")

| Item | Rating | Bands | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | n/a | — | — |
| Seam not all at once | no | `band.sections` | As jazz-soul: a bar-4 fill in `drumsVerse` (`[bd ~ sd [sd sd], hh*16]`) and an octave pop leading into the chorus root. |
| Once-only moment | n/a | — | — |
| Front/middle/back | yes | all | None. |
| Kick and bass | partly | blues, blues-qc, sections | Root on 1 with the kick is funk's lock (fine); `FUNK_SHUFFLE` rings through 12 of 24 kicks, `band.sections` 16 of 32. `.clip(.7)` on those bass lines. |
| Repeats varied | no | every Band | Exact loops. `<[bd ~ sd ~, hh*16]!3 [bd ~ sd [~ sd sd sd], hh*16]>`. |
| Arc | n/a | — | — |
| Registers clear | yes | all | Clav stabs off the beat above the bass. None. |
| Drum looseness | no | `FUNK_4` and every funk groove | `bd ~ sd ~, hh*16`: kick and snare on quarters only, no ghost notes, no pushed kick, straight 16ths at one shape; oak808 has one velocity layer, so a ghost is only quieter, not softer. Keep `bd ~ sd ~` and add what funk plays around it: `stack(s("bd [~ ~ ~ bd] sd ~"), s("[~ ~ ~ sd] ~ [~ sd ~ ~] [~ ~ ~ sd]").velocity(.25), s("hh*16").velocity("[1 .6 .85 .6]*4")).swingBy(1/12, 8)` (a kick on the "a" of 1, ghosts, a light 16th swing for the kit's declared "16th" feel); a soft-sounding ghost needs v5. |
| Built from the right end | yes | all | Kick and snare first, hats on top. None. |

### Electronic (oak909, acid sawtooth bass, sawtooth stabs)

| Item | Rating | Bands | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | n/a | — | — |
| Seam not all at once | no | `band.sections` | `drumsVerse` bar 4: a clap roll `[~ cp ~ [cp cp]]` and the hats drop on beat 4 (`[hh hh oh ~]`). |
| Once-only moment | n/a | — | — |
| Front/middle/back | yes | all | None. |
| Kick and bass | no | vamp, axis, phrase, aeolian, modal, three-chord, doo-wop, sections (acid); blues; two-five-one, ii-v-i-comp | `acidCell` = `[r ~ r r r ~ r ~ r ~ r r r ~ ~ r]` puts a bass note on every quarter, on every four-on-the-floor kick (16 of 16); `ACID_SHUFFLE` rings through 47 of 48 kicks; `TWO_FEEL` half notes through 8 of 16. The stabs sit between the kicks; the bass does not. `acidCell` → `[~ r r ~ ~ r r r ~ r r ~ ~ r ~ r]` (no note on a kick sixteenth), electronic `TWO_FEEL` → `.struct("[~ x]*4")`, or keep the notes and duck (`bass ….orbit(2)`, `drums ….duckorbit(2).duckdepth(.6)`). Re-run the Band loudness (`wave5.pw.ts`) and the songs harness (`SONGS_CALIBRATE=1`). |
| Repeats varied | no | every Band | Exact loops. An 8-bar cycle: `<[bd*4, ~ cp ~ cp, [hh hh oh hh]*4]!7 [bd*4, ~ cp ~ [cp cp], [hh hh oh hh]*3 [hh hh hh hh]]>`. |
| Arc | n/a | — | — |
| Registers clear | yes | all | Stabs above the acid root. None. |
| Drum looseness | yes | all | Machine-tight with a 16th accent shape, which the style wants. None. |
| Built from the right end | yes | all | Four on the floor first. None. |

Notes on shared Bands: `band.son-montuno`, `band.neo-soul` and `band.odd-54` play the same code in every flavour.
neo-soul already swings its 16ths (`swingBy(1/6, 8)`) and has a 3-level kick; son-montuno is built from the clave
side. The jazz-unit Bands in pop/indie/funk/electronic (`jazzForm`: `bd ~ sd ~, hh*8`) are rock beats with swung
hats, unlike the J songs, which ride in every flavour: give them the ride pattern too.

---

## Whole-piece lesson examples

### U17.L02 "hook" (12 bars: verse 4, chorus 4, the chorus lifted to D 4; also `reference.solutions[0]`, graded in absolute pitch)

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | no | bar 12 | Stops on G (IV of D) mid-phrase and loops. Split the hook from the reference (`example.code: HOOK` ≠ `SONG`) and give the hook a one-bar tag on D: `[1, chord("D").voicing()]`, bass `0`, tune `0` (13 bars); the graded `SONG` stays. |
| Seam not all at once | no | bars 5, 9 | All three lines switch on the line. In the hook only: the tune picks up into the lift (`melChorus` bar 4 ends with two eighths of the D chord, A and D, written in C's key plan as degrees). |
| Once-only moment | partly | bars 9–12 | The lift is the once-only move, as a whole section: the lesson's point. None. |
| Front/middle/back | yes | all | None. |
| Kick and bass | n/a | — | No drums in the example. |
| Repeats varied | yes | chorus2 | The repeat is lifted: the lesson. None. |
| Arc | partly | 12 bars | Builds (verse chords on 1 and 3, chorus on every beat, the lift), no release; with the tag above it lands. |
| Registers clear | no | all | `chord().voicing()` reaches 53–71; the tune is 62–72, inside the chords. Tune up an octave (`.scale("<C5:major!8 D5:major!4>")`) or `chord(…).anchor("e4").voicing()`; either changes graded notes, so re-pin the corrections (AUTHORING §20.2). |
| Drum looseness | n/a | — | — |
| Built from the right end | n/a | — | — |

### A2.L02 "hook" (8 bars: thin verse 4, thick chorus 4)

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | n/a | — | A loop over the Aeolian Band; ending is not the lesson's point. |
| Seam not all at once | no | bar 5 | Bass, chords and pad switch together. `padChorus` swells in from beat 3 of bar 4: `padVerse = n("<~ ~ ~ [~ [0,4]]>")` (a pickup, the pad's first chord). |
| Once-only moment | n/a | — | — |
| Front/middle/back | partly | all | The tune (front) repeats its 4 bars exactly while the middle changes density (the lesson's design). None. |
| Kick and bass | n/a | — | Drums come from `band.aeolian-4bar`; could not verify the combination. |
| Repeats varied | n/a | — | — |
| Arc | partly | 8 bars | Thin to thick, no release (the lesson). None. |
| Registers clear | yes | all | Bass < C3, chords A3–E4, tune A4 up, pad A5: A2.L01's registers. None. |
| Drum looseness | n/a | — | — |
| Built from the right end | n/a | — | — |

### A2.L06 "hook" (8 bars: ballad 4, drive 4)

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | n/a | — | Loop. |
| Seam not all at once | no | bar 5 | All six lines switch on the line. `hatsDrive` enters one beat early with an offbeat pickup in ballad bar 4 (`hats: arrange([4, s("<~!3 [~ ~ ~ [~ hh]]>")], [4, hatsDrive])`). |
| Once-only moment | n/a | — | — |
| Front/middle/back | yes | all | None. |
| Kick and bass | no | drive | `bd*4` (909) under `a1*8` sawtooth 8ths: half the bass notes on a kick, every kick under a sounding bass, in the style that most wants a clean low end. `bassDrive = note("<[~ a1]*4 [~ f1]*4 [~ c2]*4 [~ g1]*4>")` (house off-beat bass) — first confirm no A2.L06 rule reads the drive bass's onsets. |
| Repeats varied | n/a | — | — |
| Arc | partly | 8 bars | Two states, the lesson. None. |
| Registers clear | yes | all | None. |
| Drum looseness | yes | — | A ballad and a machine drive, both as their styles play. None. |
| Built from the right end | yes | drive | Four on the floor first. None. |

### J4.L03 "the-whole-form" (32 bars, AABA in B♭, 176 BPM)

| Item | Rating | Bars / sections | Proposed fix (Strudel) |
|---|---|---|---|
| Ends on purpose | partly | bar 32 | A3 lands on B♭^7 with the vibes holding D, but ride and hi-hat play on to the last swung eighth. `drums: arrange([8, ride], [8, ride], [8, ride], [8, s("<[rd [rd rd] rd [rd rd]]!7 [rd ~ ~ ~]>")])`, and the same for `hats`. |
| Seam not all at once | partly | B (17–24) | The tune leaves for the bridge on the line while comping and bass go on; nothing anticipates the return. B's tune: `note("<~!7 [~@6 a4 c5]>")` (3rd and 5th of F7) as a pickup into A3's D. |
| Once-only moment | yes | bars 31–32 | A3's Cm7 F7 → B♭^7 with the held D, heard once. None. |
| Front/middle/back | yes | all | None. |
| Kick and bass | n/a | — | No kick. |
| Repeats varied | partly | A2 = A1 | A2's comping in another rhythm, `chord(A).…struct("x ~ [~ x] ~ ~ x ~ ~")` as A2's own section; check the form-lens rules read sections, not struct. |
| Arc | no | all | 24 events a bar everywhere but the tune's rest. B as the lift: hats in 8ths and a crash on B's bar 1 (`hats: arrange([8, a], [8, a], [8, s("hh*8")], [8, a])`). |
| Registers clear | yes | all | Comping 57–67 under the riff 67–77. None. |
| Drum looseness | partly | all | One velocity on the ride. `.velocity("[1 [.7 .85]]*2")`. |
| Built from the right end | yes | all | Ride and hi-hat 2 & 4 only. None. |

A2.L04 "three-fits" (6 bars, one `drums:` line of three sliced breaks) demonstrates fitting a break to the tempo;
it is a two-bar comparison three times, not a piece, so it has no rows.

---

## Sound pack v5 needs (from this audit)

1. **Ghost-note layers for the funk and electronic kits.** `jazzkit` and `rockkit` have two velocity layers per
   role (`sd_0_0`/`sd_0_1`), so a `.velocity(.3)` ghost plays a softer stroke; `oak808` (the funk flavour and funk
   Band) and `oak909`/`lofikit` have one, so a funk ghost is only a quieter accent. Needed: soft snare and hat layers
   for `oak808` (or a CC0 acoustic funk kit with ≥ 3 snare layers), trimmed like v4 (`layer-trims.ts`).
2. **Round-robin hats and ride** (PLAN's item, confirmed): every 8th/16th hat and every ride stroke repeats one file
   per layer; `hh_0_x`/`rd_0_x` alternation per hit would give the alternate-hand feel the fixes above ask for.
3. **Brushes for the jazz ballads** (J5, `band.soul-68`): a brush sweep (sustained, loopable to a beat) and a brush
   tap with soft and hard layers; today `sd` with `.n("2 0 2 0")` stands in.
4. **A pitched synthesized kick** (PLAN's item, confirmed): the electronic collisions (U11, A1, J2, J3, R3, the acid
   Bands) clear most cleanly when the kick owns the sub on the beat and the bass plays between; a kick tuned per
   `{{key}}` root makes that possible without a sine sub under it.
5. **A natural reverse cymbal / riser and an acoustic "impact"** for staggered seams and once-only hits in the
   acoustic flavours; v4's `swoosh`, `impact` and pink-noise risers are synthetic foley and sit oddly in jazz-soul or
   pop.
6. **A CC0 speech / crowd one-shot** (PLAN's item, confirmed) as a once-only moment ("hey", a count-in, a shout in
   R1's stop or R3's mambo).
7. **Timbales (and a güiro)** for R3: a timbale roll into the mambo and an abanico are the son's own once-only
   moments; v4 has bongó, conga, clave, cowbell but no timbales.
8. **A brass fall / shake articulation** (trumpet, mutetpt) for horn endings and shouts (U15 outro, R1 stop, R3
   mambo, J4 tag): a single unique gesture the sustained samples cannot make.
9. **Noise beds**: A1 already uses `crackle` and `pink`; a brown-noise bed and tape hiss would complete the PLAN's
   Silence and Noise set. Level-match all of the above as v4.

---

## Summary

Counts over 25 audited pieces: 18 songs, 3 Band styles, 4 examples (songs / Bands / examples).

| Item | yes | partly | no | n/a |
|---|---|---|---|---|
| Ends on purpose | 18 / 0 / 0 | 0 / 0 / 1 | 0 / 0 / 1 | 0 / 3 / 2 |
| Seam not all at once | 9 / 0 / 0 | 9 / 0 / 1 | 0 / 3 / 3 | — |
| Once-only moment | 3 / 0 / 1 | 8 / 0 / 1 | 7 / 0 / 0 | 0 / 3 / 2 |
| Front/middle/back | 17 / 3 / 3 | 1 / 0 / 1 | — | — |
| Kick and bass | 12 / 1 / 0 | 6 / 1 / 0 | 0 / 1 / 1 | 0 / 0 / 3 |
| Repeats varied | 8 / 0 / 1 | 5 / 0 / 1 | 5 / 3 / 0 | 0 / 0 / 2 |
| Arc | 11 / 0 / 0 | 7 / 0 / 3 | 0 / 0 / 1 | 0 / 3 / 0 |
| Registers clear | 3 / 3 / 3 | 6 / 0 / 0 | 9 / 0 / 1 | — |
| Drum looseness | 5 / 1 / 1 | 13 / 1 / 1 | 0 / 1 / 0 | 0 / 0 / 2 |
| Built from the right end | 10 / 2 / 2 | 7 / 1 / 0 | — | 1 / 0 / 2 |

The ten most valuable fixes, in order (value = how often it is heard, whether it survives the takes, how directly
it serves the book's idea):

1. **Electronic Bands: take the acid bass off the kick** (`acidCell` → `[~ r r ~ ~ r r r ~ r r ~ ~ r ~ r]`,
   `TWO_FEEL` off-beat, or a duck), so every electronic Band under every learner piece has a clean low end.
2. **Jazz-soul Bands built top-down**: `JAZZ_4` and the `bd ~ sd ~, rd*8` grooves become the ride pattern, hi-hat
   on 2 and 4, a feathered kick and a ghosted snare comp, with per-layer velocities (`band.two-five-one`, J1's Band,
   first).
3. **A drum-only once-only moment** in the seven songs with none (U12, U14, U15, J1, R2, R3's cierre, A2's impact):
   a `.mask()`ed stop or one hit inside a repeated section, in parts the takes leave to Oak.
4. **Vary the copy-paste repeats in the parts that survive**: chorus2 in U12, U14, U15, U16; U15's verse2; J1's a2
   and a3; U10's pre2; A1's lift2; R3's verse2 (hats, fills, percussion, horns that are `oakKeeps`).
5. **Ghost notes and a feathered kick** across U10–U17 (pop, indie, jazz-soul reach the kits' soft layers with
   `.velocity(.3)`), and the funk Band groove with ghosts, a pushed kick and a light 16th swing.
6. **Carve the middle** of Oak's opening listen: the pad into the gap between chords and tune (U12, U16, U17, J5,
   A2), the octave-down vox as a unison double (U10, U17, J2), horns and chords on complementary beats (U15, R1),
   U13's chorus Rhodes to one strike a chord under the kept guitar.
7. **One staggered seam per song** in the nine that switch everything on the line: kick (and bass) stop two beats
   before the chorus (U10, U12, U14), horn or tune pickups across the line (U15, R3, J1, J5).
8. **Electronic low end in the songs**: duck or shorten the sine subs and held acid notes under four-on-the-floor
   (U11, A1, J2, J3), and let R3's funk/electronic kick follow the tresillo.
9. **Put the peak where the form wants it**: U11's chorus2 comp lighter so chorus4 peaks, U15's outro over its
   choruses, R2's bridge starting thin, R3's mambo over the coro, A1's verse2 hats back to 8ths.
10. **Examples**: split U17.L02's hook from its graded reference, give it a one-bar ending and clear the tune of the
   chord voicings (re-pin); end J4.L03's ride with the form; an off-beat house bass in A2.L06's drive.
