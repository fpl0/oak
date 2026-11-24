# Oak 2.0 audit: core songs, pop/indie Bands, whole-piece examples (U00–U09)

Wave W0, Task 6 Step 1, the core half (agent A3). Read-only audit against the PLAN §7 checklist; no code was changed.
The fixes below are proposals for W2 (PLAN §8: agent 5 "Band and song audit fixes", and agents 1–2 for U06–U09).

## How this was read

- **Songs:** every unit song U01–U09 (`content/unit-songs/U0*.ts`) was evaluated headlessly in all five flavours
  (45 renders, `strudel(code, bars)` from `packages/grader/src/analyze/__support__/fixtures.ts`) and its generated
  Strudel read in full for pop, with the drum and bass lines of the other four. Per section the script measured
  events per bar, the pitch range of each pitched track, whether two sections of the same type are identical bar for
  bar, bars heard once inside a repeated section type, bass onsets within 1/32 of a kick and kicks that land while a
  bass note sounds, the last onsets of every track, and which tracks enter, leave or fill at each boundary. The
  numbers quoted below come from that run (pop unless a flavour is named). Bar numbers count from 1 over the whole
  song.
- **U00** has no unit song (AUTHORING §23: "every unit except U00") and no U00 lesson plays a multi-section piece,
  so U00 has no rows.
- **Who keeps what.** A fix only lasts if Oak still plays that part after the learner's takes (AUTHORING §23.7).
  From the plans: in U01 the learner takes kick, snare and hats everywhere (Oak keeps perc, bass, chords, tune);
  in U02–U04 the learner takes the tune (Oak keeps drums, bass, chords); from U05 on chord takes silence Oak's
  pitched parts, so **Oak's drums are the only parts that survive every take** in U05–U09 (plus `oakKeeps`, and the
  U09 outro's chords and bass). The fixes put once-only moments, seams and repeat variation in those surviving parts
  wherever they can.
- **Rules every song fix keeps** (AUTHORING §23.2–§23.5, PLAN §7): section ids and bars unchanged (U06 and U09
  are at the 64-bar limit, so no fix adds a section); tune pitches, bass downbeat roots and chord roots identical
  across flavours (`usong.flavour-*`); the clash rule; one builder per song; `UnitSongDef.version` 1 → 2; re-run
  the songs loudness harness for the song (`SONGS_RECORD=1`) after any change that moves levels; list the change in
  the "Listen" list of `docs/decisions.md`.
- **Could not verify:** anything by ear; whether profile `band` lint accepts `.n()` on a drum line, `.speed(-1)` or
  `stack()` inside a section const (no `content:check` run, per the task's command limits); whether the
  production normaliser reads `s("hh").n(1)` as a hat (the test-support normaliser does: `hh/null/hatClosed`);
  whether the v4 hat variants (`hh:0`, `hh:1`, …) are a matched pair.

Ratings: **yes** / **no** / **partly**; **n/a** where the item cannot apply (a one-bar loop has no ending or
once-only moment).

---

## Findings across all nine songs (read these first)

1. **Every song ends on purpose.** All nine close on a cadence and a one-bar final hit (U02, U03, U04 also mirror
   the intro; U02's outro shrinks its riff). They all end the *same* way, though: none models exit-order, a fade or
   a build-out, which U09.L06 Endings will teach.
2. **Copy-pasted repeats are the main gap.** U01 chorus2 = chorus1 in all five flavours; U06 verse2 = verse1,
   pre2 = pre1, chorus2 = chorus1 in all five; U09 verse2 = verse1 and chorus2 = chorus1; U07 and U08 chorus2 =
   chorus1. Elsewhere the second pass usually differs only by a tambourine pattern (perc), and in jazz-soul and
   electronic, whose kits the builders give no hand percussion, not even that (U03 jazz/electronic chorus2 =
   chorus1, U04 jazz chorus2 = chorus1).
3. **No song has a once-only moment inside a repeated section.** The only one-time events are whole sections
   (the one-bar stops in U01, U04, U07, U08; U05's C+ in its one pre-chorus), which the planned `unique-event`
   rule does not count.
4. **The electronic flavour puts a bass note on every kick.** In every song's loud parts the acid line plays on
   the kicks (U01 verse: all 32 kicks; U01 chorus: 3 of every 4; U05–U09 choruses: 32 of 32
   kicks), and the sine sub of quiet sections rings through kicks (U01 intro 8 of 14 kicks, U02 verse 16 of 24).
   House and techno want that low end clean; pop, indie and funk lock bass and kick on purpose, which is fine.
5. **Drums are tidy, not loose.** Hats carry a fixed accent pattern (`[1 .86 .94 .86]`); kick velocity never
   varies (1 value in every song but U08 electronic); there is one ghost-note snare in the whole set (U06 funk);
   no hat alternates samples, though every v4 kit already has 2–5 hat samples (`hh:0`, `hh:1`, …; default kit 5,
   jazzkit and rockkit 4, 808/909/lofikit 2).
6. **Pop plays its chords and its tune on the same piano** in all nine songs (indie separates them: clean guitar
   vs acoustic), with the same `.room()`; front and back are told apart only by register and pan.
7. **Octave-down doubles and pads crowd the chords' register:** U02 chorus2 (strings double at F3–F4 over piano
   chords E3–C4), U07 chorus3 (vox 52–69 over chords 50–60), U09 chorus3 (vox 55–67 over 53–64), U06 pad = chords
   note for note (D3–C4), U05 pad G3–F4 over chords E3–C4, U08 pad B3–A4 over loud-part chords G3–F4.
8. **Jazz-soul drums are bottom-up.** From U03 the verse ride is a swung spang-a-lang (`rd ~ rd rd rd ~ rd rd`) with
   the hi-hat foot on 2 and 4, which is top-down; but the choruses go to straight `rd*8` and the kick and snare play
   the pop patterns (`bd ~ ~ bd bd ~ ~ ~`, backbeat on 2 and 4).

---

## Unit songs

### U01 "Count me in" (37 bars, C major, 100 BPM; straight, triads)

intro b1–4 · verse b5–12 · stop b13 · chorus1 b14–21 · bridge b22–25 · chorus2 b26–33 · outro b34–37.
Oak keeps perc, bass, chords and tune after every take; the learner owns kick, snare and hats.

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | outro b34–37 | None needed: hook cell over C F G, then one held C with kick, crash, bass and chords on b37 beat 1 (final hit + V→I). |
| Seam | yes | bridge b25 → chorus2 | Already there: `bridgeInto()` plays the chorus bass groove in the bridge's last bar, a bar before the drums change; the tune enters on beat 2 of the verse. Keep. |
| Once-only moment | no | — (stop b13 is a whole section) | In `perc` (Oak's for good), chorus2 bar 8 (b33) only: a tom run into the outro, `[~ ~ [ht ht] [mt lt]]`. The builder's `track()` keys consts by section *type*; give it a per-id override so `percChorus2` can exist (AUTHORING §23.2 allows `percChorus2`). |
| Front / middle / back | partly | all | Tune changes every bar, chords and bass repeat (good), but pop plays chords and tune on one `piano` with the same `.room(.25)`. Pop chords: `.lpf(2200).room(.4)`, tune `.room(.15)`, so the comp sits back; same in every song (finding 6). |
| Kick and bass | partly | electronic verse b5–12, chorus b14–21/26–33, intro b1–4 | Pop/indie/funk lock on purpose (keep). Electronic: `ACID_CHORUS` and the verse cell rest on sixteenths 4, 8, 12 and keep sixteenth 0 (the downbeat root `usong.flavour-roots` reads): `[r ~ r+7 r ~ r r+7 r ~ r r+7 r ~ r r+7 r]`; intro/bridge sine sub `.decay(.3).sustain(0)` so it dies before the next kick. |
| Repeats varied | no | chorus2 b26–33 = chorus1 b14–21 in all 5 flavours | chorus2 only, in Oak's parts: `percChorus2` adds a tambourine on 2 and 4 (`[cr, [~ tb]*2]`, then `[~ tb]*2`); `bassChorus2` pops the octave on the last eighth of each bar (`[r r r r r r r r+7]`; downbeat root unchanged). |
| Arc | partly | chorus1 = chorus2 (51.3 events/bar) | Densest section has thinner sections either side (verse 31, bridge 19, outro 40), but the last chorus is no bigger than the first. The chorus2 fixes above make it the peak; check it stays ≥ 1 LU over the bridge in the harness. |
| Register | partly | indie chorus/outro bass up to A3 (57); verse tune C4–C5 on top of chords to C4 | Indie `INDIE_CHORUS_BASS` octave jump `r+7` reaches the chords' A3 on Am: use the 5th `r+4` on Am and F bars, or keep the octave only on C and G. Verse: leave (the low tune is the lesson's register). |
| Drum looseness | partly | all; hats `[1 .86 .94 .86]` only | Oak's drums here are the learner's after U01, so the gain is before the takes: hats alternate samples `s("hh*8").n("0 1")`; snare fills crescendo `.velocity("<1!7 [1 1 .7 .85]>")`. No swing or nudges (U01 stays straight, AUTHORING §23.4). |
| Top-down / bottom-up | partly | jazz-soul all sections | Pop/indie/funk/electronic: bottom-up from kick and snare (yes). Jazz-soul: `rd*8` straight with kick on 1 and 3 is a rock beat played on a ride; straight is required until U03, so: kick feathered on all four beats at `.velocity(.35)`, sidestick only on 4 in the verse. |

### U02 "The riff song" (53 bars, C–F vamp in every section, 96 BPM; straight)

intro b1–4 · verse1 b5–12 · chorus1 b13–20 · verse2 b21–28 · bridge b29–36 · chorus2 b37–44 · outro b45–52 · end b53.
The learner takes the tune (and its double) everywhere but the end; Oak keeps drums, bass and chords.

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | outro b45–52, end b53 | None: half-time outro brings the opening riff back (mirror), its last bars shrink (`[c4 ~ c5 ~ ~ ~ ~ ~]` b50–51), then F→C on b53 with kick and crash. |
| Seam | partly | every boundary | Only snare fills cross a boundary; drums and bass enter at b3 inside the intro. Add a staggered seam in a kept part: hats stop two beats early in verse bars 8 (b12, b28), `hatsVerse` → `<[hh*8]!7 [hh hh hh hh ~ ~ ~ ~]>`, while kick and snare play through. |
| Once-only moment | no | — | chorus2 bar 4 (b40), drums only: a two-beat stop-time hole, `kickChorus2` bar 4 `bd ~ ~ bd ~ ~ ~ ~`, `snareChorus2` bar 4 `[~ [sd,cp] ~ ~]`, `hatsChorus2` bar 4 `[hh hh hh hh ~ ~ ~ ~]`. |
| Front / middle / back | yes | — | Tune front, vox double as middle in the loud parts, comp/bass/drums repeat. Pop piano/piano: finding 6. |
| Kick and bass | partly | electronic verse b5–12/b21–28 (16 of 24 kicks while the sub sounds), chorus (32/32 kicks hit) | As U01: acid cells rest on sixteenths 4, 8, 12; verse sine sub short (`.decay(.3).sustain(0)`). Pop/indie/funk: keep the lock. |
| Repeats varied | yes | verse2 (B♭ in the tune, hand percussion), chorus2 (double an octave down, `tb*8`) | None. |
| Arc | yes | chorus2 61 events/bar is the peak; bridge 36, outro 15 | None. |
| Register | no | chorus2 b37–44: strings double F3–F4 over piano chords E3–C4 | After U02.L05 that double is the learner's own octave-down copy, against Oak's chords: thin Oak's chords in chorus2 to `struct("x ~ x ~")` (or half notes `x@2 x@2`), the `tb*8` keeps the energy. |
| Drum looseness | partly | all | Hats `.n("0 1")`; chorus snare `[sd,cp]` backbeat with one ghost on the "a" of 2 in pop and funk only (`stack(s("~ [sd,cp] ~ [sd,cp]"), s("~ [~ ~ ~ sd] ~ ~").velocity(.3))`). Stay straight (U02). |
| Top-down / bottom-up | partly | jazz-soul | Pop/indie: yes. Jazz-soul: as U01 (straight until U03): feathered kick, rim on 4. |

### U03 "Home in three keys" (61 bars, C / G / F, 88 BPM; jazz-soul swings from here)

intro b1–4 · verse1 b5–12 · pre b13–16 · chorus1 b17–24 · vamp b25–28 · verse2 b29–36 · bridge b37–44 · lift b45–48 · chorus2 b49–56 · outro b57–60 · end b61.
The learner takes the tune in every section; Oak keeps drums, bass, chords.

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | outro b57–60, end b61 | None: the hook's head up high over a half-time I–IV (mirrors the intro), then one C chord with kick and crash. |
| Seam | partly | pre → chorus1 (b16): the tune's B4 on the "and" of 4; lift b48 bass fill | The tune's anticipation is the learner's after U03.L04. Make one in a kept part: in the lift's last bar (b48) the bass stops on beat 3 (`bassLift` bar 4 `[3*4 ~ ~ ~ ~]`) while drums roll through into chorus2. |
| Once-only moment | no | — | verse2 bar 8 (b36), perc only: a reversed crash swelling into the bridge, `s("~ ~ cr ~").speed(-1)` (placed by ear; needs a lint check), or a v4 `swoosh` (foley, routed to perc). |
| Front / middle / back | partly | all | Tune front; the vamp's tambourine `tb*8` and the lift's shaker give a middle; pop piano/piano (finding 6). |
| Kick and bass | partly | electronic: chorus 32/32 kicks hit; the sub sounds under 4 of 8 intro kicks and 8 of 16 vamp kicks | As U01. Jazz-soul: walking bass against a soul kick, fine. |
| Repeats varied | partly | chorus2 b49–56 differs from chorus1 only by `tb*8`; identical in jazz-soul and electronic | chorus2: `kickChorus2` adds the "and" of 4 (`bd ~ ~ bd bd ~ bd bd`), hats open on every "and" (`[hh oh]*4`); jazz-soul `percChorus2` with the jazzkit's own `sh`/`tb` (it has both); electronic: the lofikit shaker by `.bank("lofikit")` on that one const, as U01 already mixes banks. |
| Arc | yes | lift 63.5 / chorus2 60.6 are the peak; bridge 11.9, outro 15.8 | None. |
| Register | yes | chords B2–D4, tune C4–G5, bass G1–A2 | None. |
| Drum looseness | partly | all | Jazz-soul now swings (looseness, yes there). Pop/indie: hats `.n("0 1")`, `.late("[0 .006]*4")` on off-beat hats (a laid-back push, Oak's number); funk: snare ghosts on the "e" before 2 and 4 at `.velocity(.3)`. |
| Top-down / bottom-up | partly | jazz-soul chorus1/2 `rd*8`, kick `bd ~ ~ bd bd ~ ~ ~` | Verse ride is top-down already. Chorus: keep the spang-a-lang (`rd ~ rd rd rd ~ rd rd`) instead of `rd*8`, kick feathered quarters `.velocity(.35)` with the push on the "and" of 2 accented. |

### U04 "Side by side" (54 bars, C–F vamp, 92 BPM)

intro b1–4 · verse1 b5–12 · chorus1 b13–20 · verse2 b21–28 · bridge b29–36 · stop b37 · chorus2 b38–45 · outro b46–53 · end b54.
The learner takes tune and second voice in intro, verses, choruses, outro; the keys pairs in the bridge. Oak keeps drums, bass, chords.

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | outro b46–53, end b54 | None: the opening riff returns with a 3rd above, half time, then both voices hold C5/E5 over C. |
| Seam | partly | stop b37 tune pickup `g4 a4 b4`; fills | The pickup lives in a one-bar section. Add: bass leaves on beat 3 of verse bar 8 (b12, b28) and re-enters with the chorus: `bassVerse` as an 8-bar `<…>` whose bar 8 (F) is `[f2@3 f2 ~ ~ ~ ~]`. |
| Once-only moment | partly | stop b37 (a whole one-bar section) | chorus2 bar 5 (b42), perc: one v4 `impact` with the crash, `[cr, impact]`, the only time it sounds. |
| Front / middle / back | yes | — | Tune + second voice front, comp and drums repeat. |
| Kick and bass | partly | electronic chorus 32/32 kicks hit | As U01. |
| Repeats varied | partly | verse2 adds the 3rd above and a shaker (yes); chorus2 only `tb*8`, identical in jazz-soul | chorus2: hats open `[hh oh]*4`, kick adds the "and" of 4; jazz-soul `percChorus2` uses the jazzkit `tb`. |
| Arc | yes | chorus2 58.9 peak; bridge 19.6, outro 22.9 | None. |
| Register | yes | chords ≤ C4, tune C4–E5, vox up to B5 a 5th above | None. |
| Drum looseness | partly | all | As U03 (hats `.n("0 1")`, funk ghosts, pop off-beat push). |
| Top-down / bottom-up | partly | jazz-soul | As U03 (chorus spang-a-lang, feathered kick). |

### U05 "Climb the chord" (53 bars, 88 BPM)

intro b1–4 · verse1 b5–12 · prechorus b13–16 · chorus1 b17–24 · verse2 b25–32 · bridge b33–40 · chorus2 b41–48 · outro b49–52 · end b53.
Chord takes cover every section but the end; Oak's drums survive everywhere, its pad in intro and choruses (`oakKeeps`), its tune in verse1, verse2 and the choruses.

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | outro b49–52 (C Am G C whole notes), end b53 | None. |
| Seam | partly | bridge b40: bass `g2*8` and snare roll; fills elsewhere | Drums only after the takes: crash on the "and" of 4 of the prechorus's last bar (b16), anticipating chorus1 (`percPrechorus` bar 4 `[sh*8, [~ ~ ~ [~ cr]]]`), kick keeps its downbeat. |
| Once-only moment | partly | prechorus C+ (a once-heard section) | chorus2 bar 4 (b44): one half-time bar in the drums (`kickChorus2` bar 4 `bd ~ ~ ~ ~ ~ ~ ~`, `snareChorus2` bar 4 `~ ~ sd ~`), back to full time at b45. |
| Front / middle / back | partly | intro b1–4 (arpeggio front, pad back) good; choruses pad + eighth chords + tune | See Register: the pad doubles the comp, so there is no clear middle. |
| Kick and bass | partly | electronic chorus 32/32 kicks hit; intro/bridge sub rings through kicks | As U01. |
| Repeats varied | partly | verse2 walks the bass down (yes); chorus2 differs only by `tb*8` | chorus2: pad enters only here (see Register), hats open on the "and"s. |
| Arc | yes | chorus2 62.1 peak; bridge 26.1, outro 15.3 | None. |
| Register | partly | chorus b17–24/41–48: pad G3–F4 over chords E3–C4 | Play the pad only in chorus2 (`padChorus` → `silence` in chorus1; harmless for U05.L07's `oakKeeps`), which also varies the repeat and raises the last chorus. |
| Drum looseness | partly | all | Hats `.n("0 1")`; jazz-soul swings (yes); funk snare ghosts. |
| Top-down / bottom-up | partly | jazz-soul | As U03. |

### U06 "The long way home" (64 bars, 92 BPM, a part in G)

intro b1–4 · verse1 b5–12 · pre1 b13–16 · chorus1 b17–24 · verse2 b25–32 · pre2 b33–36 · chorus2 b37–44 · lift b45–48 · bridge b49–52 · chorus3 b53–60 · outro b61–64.
Chord takes cover every section; Oak's drums survive everywhere (plus tune and bass in intro, chorus2, lift, chorus3).

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | outro b61–64, I IV V I, one held C; hats and snare drop in b64 | None. |
| Seam | partly | fills only; kick and bass enter at b3 inside the intro | Before chorus3 (b52, end of the doo-wop bridge): the triplet hats stop on beat 3 while kick and snare finish the bar (`hatsBridge` → `<[[hh hh hh]*4]!3 [[hh hh hh]*2 ~ ~]>`). |
| Once-only moment | no | — | chorus3 bar 5 (b57): the drums drop out for one bar except the tambourine (`kickChorus3`, `snareChorus3` bar 5 `~`), a breath before the last four bars. |
| Front / middle / back | partly | pre/chorus: pad = chords note for note | See Register. |
| Kick and bass | partly | electronic: chorus 32/32 kicks hit, lift sub through 4 of 8 | As U01. |
| Repeats varied | no | verse2 = verse1, pre2 = pre1, chorus2 = chorus1 in all 5 flavours; chorus3 adds `tb*8` | In drums (they survive every take): `hatsVerse2` `[hh hh hh oh]*2`, `percVerse2` a shaker `[~ sh]*4`; `snarePrechorus2` builds earlier (`<[~ sd ~ sd]!2 [~ sd [sd sd] [sd sd sd sd]] [sd*8]>`); `percChorus2` adds the ride bell on the "and"s (`[~ rd]*4`). New consts named `…Verse2`, `…Prechorus2`, `…Chorus2`; ids unchanged. |
| Arc | yes | chorus3 65.8 peak; lift 21, outro 25.3 | None. |
| Register | partly | pre and choruses: pad D3–C4 = chords D3–C4 | Pad in chorus3 only (silence in pre1/pre2/chorus1/chorus2): the comp keeps the register, and the last chorus gains a layer. An octave up would sit on the hook (G4–E5). |
| Drum looseness | partly | funk has the set's only ghost snare (verse, `.velocity(.35)`) | Copy that ghost pattern to pop and indie verses at `.velocity(.25)`; hats `.n("0 1")`. |
| Top-down / bottom-up | partly | jazz-soul chorus `rd*8` | As U03. |

### U07 "Somewhere to land" (57 bars, 92 BPM)

intro b1–4 · verse1 b5–12 · chorus1 b13–20 · verse2 b21–28 · chorus2 b29–36 · bridge b37–44 · break b45 · chorus3 b46–53 · outro b54–57.
Takes cover the tune everywhere (chords too in intro, chorus2, break, outro); Oak keeps drums and bass everywhere, chords in verses, chorus1, bridge, chorus3.

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | outro b54–57, suspensions, final `bd`+`cr` on b57 | None. |
| Seam | partly | break b45 tune pickup `~ ~ 2 3`; fills | Bass (Oak's everywhere): in chorus2's last bar (b36) it stops on beat 3, so the quiet bridge's bass enters after the drums thin (`bassChorus2` bar 8 `[f1 f1 f1 f1 ~ ~ ~ ~]`). |
| Once-only moment | partly | break b45 (a section) | chorus2 bar 7 (b35), perc: a ride-bell answer to the hook's high point, `[~ ~ ~ ~ ~ ~ rd rd]` stacked on that bar's tambourine, there only. |
| Front / middle / back | yes | vox line in choruses and the call-and-answer bridge gives a middle | None. |
| Kick and bass | partly | electronic chorus 32/32 kicks hit; intro sub through 4 of 8 | As U01. |
| Repeats varied | partly | chorus2 = chorus1 (all flavours); verse2 adds a shaker; chorus3 strongly varied | chorus2 in drums: hats open on every "and" (`[hh oh]*4`), kick adds the "and" of 4; keep chorus3 the biggest. |
| Arc | yes | chorus3 73.6 peak; bridge 27.1, outro 12.3 | None. |
| Register | partly | chorus3 b46–53: vox double 52–69 over chords 50–60 | Oak keeps chords in chorus3, the double is the learner's after U07.L10: chorus3 chords to `struct("x@2 x@2")` (or `x ~ x ~`), kick four on the floor keeps the lift. |
| Drum looseness | partly | all | Hats `.n("0 1")`, pop/indie off-beat `.late`, funk ghosts. |
| Top-down / bottom-up | partly | jazz-soul chorus `rd*8` | As U03. |

### U08 "Ground floor" (58 bars, 96 BPM; the bass song)

intro b1–4 · verse1 b5–12 · chorus1 b13–20 · verse2 b21–28 · chorus2 b29–36 · bridge b37–44 · stop b45 · chorus3 b46–53 · outro b54–57 · end b58.
Takes write chords and bass in every section but stop and end; U08.L04 takes kick and bass in chorus2 and chorus3. Oak keeps tune, pad, snare, hats, perc (and kick outside chorus2/3).

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | outro b54–57 (chords stop at b57), end b58 C with tune C5 and pad | None. |
| Seam | yes | bass approach notes on the last eighth into each chord; stop b45 tune pickup | The bass becomes the learner's; add a seam in a kept part: the pad (Oak's) enters on beat 4 of the verse's last bar with the verse's own G (`padVerse` silent but bar 8 `[~ ~ ~ [b3,d4,g4]]`), a beat before the chorus. |
| Once-only moment | partly | stop b45 (a section) | chorus2 bar 8 (b36), perc: one v4 `swoosh` on beat 4 into the bridge, stacked on that bar's tambourine (`[~ tb ~ tb, ~ ~ ~ swoosh]`). |
| Front / middle / back | partly | loud parts: pad B3–A4 + chords G3–F4 + tune C5–F5 | Pad as two notes (3rd and 5th) or only in chorus3, so the learner's chords own the middle. |
| Kick and bass | partly | electronic verse: sub through 8 of 32 kicks; chorus acid on 32/32 kicks | U08 is the lock unit (U08.L04), so pop/indie/funk/jazz stay locked. Electronic: the acid fix as U01; the bridge (vi IV I V) is where W2 can model PLAN U08.L06 "Kick and Bass, One Line" in electronic (bass on the sixteenths between kicks, `bd ~ ~ ~` + `[~ r ~ r+7 ~ r r ~]`-type cells). |
| Repeats varied | partly | chorus2 = chorus1 (all flavours); verse2 adds `tb`; chorus3 `tb*8` | chorus2: snare adds the clap only on 4 (`[~ sd ~ [sd,cp]]`), hats open on "and" of 4; chorus3 keeps `tb*8`. |
| Arc | yes | chorus3 57.4 peak; bridge 33.5, outro 41.5, end 11 | None. |
| Register | partly | as Front/middle/back | As above. |
| Drum looseness | partly | electronic verse kick has a velocity shape (the only one) | Hats `.n("0 1")`; funk ghosts; pop snare fill crescendo. |
| Top-down / bottom-up | partly | jazz-soul chorus `rd*8` | As U03. |

### U09 "Turn it around" (64 bars, 100 BPM; the form unit)

intro b1–4 · verse1 b5–12 · chorus1 b13–20 · verse2 b21–28 · chorus2 b29–36 · bridge (b) b37–44 · reprise (a) b45–48 · chorus3 b49–56 · outro b57–64.
Takes write tune, chords and bass in every section but the outro (tune only there): **Oak's drums are all that survives**, plus chords and bass in the outro.

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | outro b57–64: the 8-bar phrase, V then I, one final hit b64 | Make the ending model the coming U09.L06 Endings (exit-order, mirroring the intro's one-at-a-time entries): Oak's chords stop after b62 (`chordsOutro` `<[x x x x]!6 ~ ~>`), bass after b63, kick and crash alone on b64. Tune untouched (the learner's after U09.L01). |
| Seam | yes | bass drops for the bar before each chorus (b12, b28); intro tune pickup b4 | Both are in parts the learner takes; add one in drums: hats stop on beat 3 of b48 (reprise → chorus3) while the snare roll runs through. |
| Once-only moment | no | — (chorus3 vox double is a whole section, and is silenced by the takes) | chorus3 bar 4 (b52), drums: a one-time fill with a crash on the "and" of 4 (`snareChorus3` bar 4 `[~ sd ~ [sd sd sd sd]]`, `percChorus3` bar 4 `[tb*8, [~ ~ ~ [~ cr]]]`). |
| Front / middle / back | yes | reprise hats on a `saw` velocity is a background part stepping forward | None. |
| Kick and bass | partly | electronic chorus 32/32 kicks hit; bridge: 8 of 16 kicks land under a sounding bass | As U01. |
| Repeats varied | no | verse2 = verse1, chorus2 = chorus1 in pop (and the others) | Drums only survive: `hatsVerse2` `[hh hh hh oh]*2`, `percVerse2` a tambourine on 4 (`~ ~ ~ tb`); `kickChorus2` adds the "and" of 4; `percChorus2` `[~ tb]*4` → `tb*8` held back for chorus3. |
| Arc | yes | chorus3 62.1 peak, reprise climbs (45.5), outro 28.8 | None. |
| Register | partly | chorus3 vox 55–67 over chords 53–64 | Only before U09.L02 (the takes silence it): drop the vox to a single held note per bar or leave it out; low value. |
| Drum looseness | partly | reprise hats ramp (yes); elsewhere fixed accents | Hats `.n("0 1")`; pop/indie `.late("[0 .006]*4")` on off-beat hats; funk ghosts. |
| Top-down / bottom-up | partly | jazz-soul chorus `rd*8` | As U03. |

---

## Band styles (pop and indie flavours)

The Bands U00–U09 lessons use: `band.two-chord-vamp` (32 references), `band.axis-4bar` (44), `band.phrase-8bar`
(14), `band.waltz-vamp` (2), `band.sections` (U09.CP, C3); plus the rock-family `band.three-chord` and
`band.doo-wop` (U06 and U13 specs). A Band is a backing loop (`content/bands/index.ts`, `layers()`), the learner is
the front; jazz-soul, funk and electronic flavours are A4's.

### Loop Bands: two-chord-vamp, axis-4bar, phrase-8bar, three-chord, doo-wop, waltz-vamp (pop, indie)

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | no | the loop plays until the Make stops | A shared `bandEnding(f)` (one bar: `drums: s("[bd,cr]")`, `bass: n(-14)`, `chords: n(<I>).struct("x")`) that the Band player appends when a render is finite (album export, capstone listen); the learner's own code still decides its ending. |
| Seam | partly | phrase-8bar: no fill at the phrase end; others n/a (1–4 bar loops) | `band.phrase-8bar` pop: `drums: s("<[bd sd [~ bd] sd, hh*8]!7 [bd sd [~ bd] [sd sd], hh*8]>")`; indie `<[bd ~ sd ~, hh*8]!7 [bd ~ sd [sd sd], hh*8]>`. It marks the 8-bar phrase U09.L01 counts. |
| Once-only moment | n/a | a loop | — |
| Front / middle / back | partly | pop: chords on `piano`, the pop lead is also `snd.piano` (content/flavours.ts) | Pop Band chords `.lpf(2200)` (or room .35) so a learner's piano tune stands in front; indie already separates (clean vs acoustic guitar). |
| Kick and bass | yes | pop `bd sd [~ bd] sd`, whole-note bass; three-chord bass eighths | Rock lock or held roots: right for the style. |
| Repeats varied | n/a | a loop | — |
| Arc | n/a | a loop | — |
| Register | partly | axis-4bar chords `[-2,0,2]` reach E4 (in C) | IV voiced `[-4,-2,0]` already; for vi use `[-5,-2,0]`-style close voicing under C4 so the top voice stays below the U05–U07 low tunes (E4 starts); check the existing band test "chords stay out of the tune". |
| Drum looseness | partly | one `velocity` pattern over the whole drum stack; one hat sample; waltz `bd hh hh` | Split the stack: `drums: stack(s("bd sd [~ bd] sd"), s("hh*8").n("0 1").velocity(HUMAN_8THS))`, or keep one line and add `.n("0 1")` on the hats only; pop: ghost snare on the "a" of 2 at `.velocity(.25)` in `three-chord` and `axis-4bar`. |
| Top-down / bottom-up | yes | pop rock beat, indie half-time backbeat | None. |

### band.sections (pop, indie): the only multi-section Band (U09.CP, C3)

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | no | a learner's `outro` falls back to the Band's verse (band-form.ts `KIN.outro = ["verse","intro"]`) and stops dead | Add `drumsOutro`/`bassOutro`/`chordsOutro` (`<I IV V I>` held, last bar `[bd,cr]`, hats out) and put `outro` first in its own KIN; `SECTION_FORM`'s default stays VCVC. |
| Seam | no | all three tracks switch on bar 5/9/13 | Verse bar 4 fill (`drumsVerse` → `<[bd ~ sd ~, hh*8]!3 [bd ~ sd [sd sd], hh*8]>`) and the bass rests on beat 4 (`<-14 -9 -11 [-10@3 ~]>`). |
| Once-only moment | no | — | None proposed: under C3 and the checkpoint, the once-only moment should be the learner's (a Band event would compete with it). |
| Front / middle / back | yes | — | None. |
| Kick and bass | yes | verse whole-note roots, chorus eighths with the rock beat | None. |
| Repeats varied | no | `SECTION_FORM` reuses `drumsVerse`/`drumsChorus` for both passes | `drumsChorus2` (pop `bd sd [~ bd] sd, [hh hh oh hh]*4, cr ~ ~ ~`; indie with a tambourine `[~ tb]*2`) and band-form plays a learner's second chorus with `<type>2` when the Band has it. |
| Arc | yes | chorus doubles hats, bass eighths, chords ×2 | None. |
| Register | yes | — | None. |
| Drum looseness | partly | `velocity("[1 .86 .94 .86]*4")` (16 slots) over eighth hats in the verse gives only 1 / .94 | Verse with `HUMAN_8THS` (8 slots), chorus with `HUMAN_16THS`; hats `.n("0 1")`. |
| Top-down / bottom-up | yes | — | None. |

---

## Whole-piece lesson examples (U09)

U00–U08 lessons have no multi-section example (U08.L03/L04 grade 16-bar loops; no `arrange()` in their examples).
The U09 examples are short didactic pieces, and several lesson questions read their exact bars, so a fix is
proposed only where it changes no answer; elsewhere the lesson's point wins (noted per row).

### U09.L01 S1 "Where it breathes" and S6 ear "Where it moves on" (8 and 16 bars)

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | last bar I after V (both) | None. |
| Seam | no | S6: bars 8→9, only chords and tune move on | None: S6 asks where the music moves on; a drum cue would give the answer away. |
| Once-only moment | n/a | 8/16-bar phrase studies | — |
| Front / middle / back | yes | tune front, chords back, crash marks phrases | None. |
| Kick and bass | yes | S6 `bd ~ bd ~` with roots on 1 | None. |
| Repeats varied | yes | S6 second 8 bars new chords and higher tune | None. |
| Arc | partly | S6 flat drums across both halves | None (as Seam). |
| Register | yes | — | None. |
| Drum looseness | no | S6 `hh*8` at one gain | `hats: s("hh*8").n("0 1").velocity("[1 .8]*4").gain(.4)`: changes no answer. |
| Top-down / bottom-up | yes | — | None. |

### U09.L02 S1/S3 "Two sections" (16 bars, VCVC, over `band.axis-4bar` drums)

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | chorus IV V I I: V→I at bars 14–15, I held to 16 | None (S3 asks "how many bars before it starts over?" = 16; keep the length). |
| Seam | no | all lines switch on 5/9/13 | `melVerse` bar 4 `[1 ~ ~ ~]` → `[1 ~ 4 5]`, a pickup into the chorus (G4 A4 over G: chord tone and a whole step; check S3's roll questions, which ask what changes, not note counts). |
| Once-only moment | n/a | a 16-bar study | — |
| Front / middle / back | yes | tune front, tambourine arrives with the chorus | None. |
| Kick and bass | yes | Band drums, bass roots | None. |
| Repeats varied | no | verse 2 = verse 1, chorus 2 = chorus 1 | None: S2 quotes the chords' `arrange()` and S1's caption says "then both again"; the lesson is about sections returning. |
| Arc | yes | chorus lifts | None. |
| Register | yes | `.voicing()` chords, tune C4–E5 | None. |
| Drum looseness | partly | Band drums | Follows the loop-Band fix. |
| Top-down / bottom-up | yes | — | None. |

### U09.L03 S1/S4 "Away and back" (16 bars, AABA) and S5 ear stimulus (strophic, 24 bars)

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | partly | AABA ends on G (V) in bar 16; strophic ends on C | None: the open V is what loops the AABA back, and S2 asks "in which bar does A come back?" (13). |
| Seam | no | all switch on 5/9/13 | None (S2 reads the boundaries). |
| Once-only moment | n/a | — | — |
| Front / middle / back | yes | — | None. |
| Kick and bass | yes / n/a | AABA has no drums; strophic `bd ~ bd ~` with roots | None. |
| Repeats varied | partly | A = A = A (the form's point); strophic varies the tune's sound each verse | None. |
| Arc | n/a | form studies | — |
| Register | yes | — | None. |
| Drum looseness | no | strophic `hh*8` flat | `hats: s("hh*8").n("0 1").gain(.4)` in the S5 stimulus. |
| Top-down / bottom-up | yes | — | None. |

### U09.L04 S1 "Which one lands" (12 bars: verse, build, chorus) and S5 compare option

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | yes | chorus F G C C | None. |
| Seam | no | kick and snare play the same bar for all 12 bars; everything else turns on bar 9 | Add `perc: arrange([8, silence], [4, s("<cr ~ ~ ~>")])` to both S1 versions (example and item0) so the landing has a crash; S2's questions (bars 5–8, the `fx` note count) are unchanged. |
| Once-only moment | partly | the `fx` riser (a section heard once) | None (it is the lesson's riser). |
| Front / middle / back | yes | build: hats and chords step forward on a `saw` | None. |
| Kick and bass | yes | — | None. |
| Repeats varied | n/a | no repeats | — |
| Arc | yes | build → chorus | None. |
| Register | yes | — | None. |
| Drum looseness | no | `bd ~ bd ~`, `~ sd ~ sd` flat | Hats in the verse `.n("0 1")`; leave kick/snare plain (the riser must read clearly). |
| Top-down / bottom-up | yes | — | None. |

### U09.L05 S1 "Part by part" (8 bars: intro with `.mask()`, verse)

| Checklist item | Rating | Bars / sections | Proposed fix (Strudel terms) |
|---|---|---|---|
| Ends on purpose | n/a | an 8-bar loop study of entries | — |
| Seam | yes | bass at bar 2, chords at bar 3, tune pickup `[~ ~ 4 5]` in bar 4 | None: a model staggered boundary. |
| Once-only moment | n/a | — | — |
| Front / middle / back | yes | — | None. |
| Kick and bass | yes | — | None. |
| Repeats varied | n/a | — | — |
| Arc | yes | parts enter one at a time | None. |
| Register | yes | — | None. |
| Drum looseness | no | drums constant, flat `hh*8` | `hats: s("hh*8").n("0 1").gain(.5)` (S3's question "which part comes in last" reads the pitched parts only). |
| Top-down / bottom-up | yes | — | None. |

---

## Counts per checklist item

Over the 9 songs, the 2 Band tables and the 5 example tables (16 tables). "Kick and bass" in U09.L03 counted as yes.

| Checklist item | yes | partly | no | n/a |
|---|---|---|---|---|
| Ends on purpose | 12 | 1 | 2 | 1 |
| Seam | 4 | 7 | 5 | 0 |
| Once-only moment | 0 | 5 | 6 | 5 |
| Front / middle / back | 10 | 6 | 0 | 0 |
| Kick and bass | 7 | 9 | 0 | 0 |
| Repeats varied | 2 | 6 | 5 | 3 |
| Arc | 12 | 2 | 0 | 2 |
| Register | 8 | 7 | 1 | 0 |
| Drum looseness | 0 | 12 | 4 | 0 |
| Top-down / bottom-up | 7 | 9 | 0 | 0 |

Songs alone (9): ends 9 yes; seam 3 yes / 6 partly; once-only 4 partly / 5 no; front/middle/back 4 yes / 5 partly;
kick and bass 9 partly; repeats 1 yes / 5 partly / 3 no; arc 8 yes / 1 partly; register 2 yes / 6 partly / 1 no;
drum looseness 9 partly; top-down/bottom-up 9 partly.

(The "partly" on kick and bass is the electronic flavour every time; on top-down/bottom-up it is the jazz-soul flavour
of the songs; on drum looseness it is the fixed accents with no ghost notes or alternating hats.)

## The ten most valuable fixes

1. **Vary the second passes in the parts that survive every take** (drums from U05; drums, bass, chords in U02–U04;
   perc, bass, chords in U01): U06 verse2/pre2/chorus2, U09 verse2/chorus2, U01 chorus2, U07 and U08 chorus2.
   `…2` consts, ids unchanged. Gives U01's builder a per-section-id override.
2. **One once-only moment per song, inside a repeated section, ≤ 1 bar, in a kept part:** U01 tom run b33, U02
   stop-time hole b40, U03 reversed crash b36, U04 `impact` b42, U05 half-time bar b44, U06 drum dropout b57, U07
   ride-bell answer b35, U08 `swoosh` b36, U09 fill + crash b52. Different devices, so the album does not repeat one
   trick.
3. **Electronic flavour: keep the low end clean.** Acid cells rest on sixteenths 4, 8 and 12 and keep the
   downbeat root (so `usong.flavour-roots` still passes); sine subs `.decay(.3).sustain(0)`. All nine songs.
4. **U09's outro becomes an exit-order ending** that mirrors its intro (chords out after b62, bass after b63, kick
   and crash alone on b64), so the form unit's own song models what U09.L06 Endings will teach.
5. **Alternate-hand hats everywhere** with the v4 samples already in each kit (`.n("0 1")`), plus ghost-note snares
   in funk and soul (U06 funk's verse is the template), plus a small off-beat `.late()` on pop/indie hats from U03.
   Songs, loop Bands and `band.sections`.
6. **Thin Oak's chords where an octave-down double plays** (U02 chorus2, U07 chorus3), which after the takes is
   the learner's own double: `struct("x ~ x ~")` or half notes.
7. **Stop the pad doubling the chords** (U06 pad = chords; U05 and U08 overlap): pad only in the last chorus, or
   two held notes; this also varies the repeats and raises the last chorus.
8. **band.sections:** an outro section (the learner's outro no longer falls back to the verse and cuts off), a
   fill and an early bass rest at the verse→chorus seam, and a `chorus2` that band-form picks for the second chorus.
9. **Jazz-soul drums top-down from U03:** keep the swung spang-a-lang in the choruses (not `rd*8`), feathered
   kick quarters at low velocity, sidestick on 4 in the verses.
10. **Pop: separate front and back in sound** (chords and tune are both `piano` in all nine songs and the pop
    Bands): chords `.lpf(2200).room(.4)`, tune drier; a "plain keys" sound for v5 (below) settles it.

## Sound pack v5 needs this audit reveals

1. **A matched hat pair per kit.** Every v4 kit already has 2–5 hat samples (`uzu-drumkit` hh ×5, `jazzkit` and
   `rockkit` ×4, `oak808`/`oak909`/`lofikit` ×2); v5 needs them curated as a level- and timbre-matched left/right
   pair at fixed indices (could not verify by ear that `hh:0`/`hh:1` are one).
2. **A soft (ghost) snare stroke per kit** at a documented index: a quiet hand stroke sounds different from a loud
   hit turned down (jazzkit's 6 snare files may already hold layers: could not verify).
3. **A plain keys sound distinct from the plain lead** (pop's chords and lead are both `snd.piano`), level-matched,
   the PLAN's "one plain sound per role" seen from the songs.
4. **Hand percussion for `oak909`** (a synthesized shaker and tambourine): the 909 has none, so electronic second
   passes cannot vary the way the other flavours do (U03, U06 electronic repeats are identical). Until then the
   songs can borrow `lofikit`'s `sh` per const, as U01 already switches banks by section.
5. **A short synthesized kick with a controllable tail** (the PLAN's pitchable kick): electronic kick-and-bass as one
   line (fix 3, PLAN U08.L06) needs a kick that does not ring under the next bass sixteenth.
6. **A reversed cymbal / riser one-shot**, only if `s("cr").speed(-1)` fails the `band` lint or the realm (fix 2,
   U03); v4's foley `swoosh` and `impact` cover the other once-only moments.
7. **Noise beds** (already in PLAN §7) would also serve the songs' quiet sections (U01 bridge, U06 lift, U09 bridge)
   as a background that barely changes.

No need found here for the CC0 speech sample (it serves A2.L04 only).
