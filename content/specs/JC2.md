# JC2 JC2 Jazz Blues in F: unit spec

<!-- GENERATED from content/specs/JC2.ts by `bun scripts/content/spec.ts`. Edit the .ts, never this file; content/validate/specs.test.ts fails when they differ. -->

The jazz track's second capstone and its first whole tune of the learner's own: a jazz blues in F, two choruses, with every part driven by one chord pattern. Session 1 writes the changes once (`const changes`), comps them with shells (the 3rd and the 7th on the Rhodes, the root in the bass) and walks the bass, its roots taken from the same pattern; session 2 writes an original head on the muted trumpet or the vibes, plays it over two choruses that are not the same twice, and releases the track to the album. It opens when J4.L04 is completed (contracts §3, wave7.md §5.3) and is an album track like every capstone. Nothing new is taught: J3.L03 (comping), J3.L04 (walking), J4.L02 (the jazz blues) and J1.L05 (one chord pattern, `.set()` / `.rootNotes()`) are put to work.

This spec has no lessons. `bun test content/validate/specs.test.ts` checks that this document is the current rendering of its source; the capstone rubrics, session flags, slots and ladder titles it prints are read from the registries.

## Conventions for this unit

- Earliest route: J4.L04 completed, so U15.L06, J1–J4, J.CP1 and JC1 are behind the learner; U16–U17 and J5 may not be. The tools are J4's (conventions of content/specs/J4.ts), plus `mutetpt` (J4.L02). `tb.template.jazz-blues-f` (contracts §3.2) unlocks at JC2.S2 (`released JC2`): the Studio template is the released piece's skeleton, never offered inside the capstone itself.
- One chord pattern (contracts §2.6, §6.6): the changes are written once, `const changes = "<…>"`, and every line that plays harmony reads them: the comping `chord(changes)…`, the bass's roots `chord(changes).rootNotes(2)`, a guide line or arpeggio `n("0 1").set(chord(changes)).voicing()` if the learner wants one. Change a chord in the string and every part follows: that is what the session shows by doing it once (bar 8 D7 → Am7 D7 and back).
- The walk is the learner's (J3.L04), its roots are the pattern's: `bass: stack(chord(changes).rootNotes(2).struct("x ~ ~ ~"), note("<[~ a2 c3 b2] …>")).s("upright")`: beat 1 from the chord pattern, beats 2–4 written by hand, one labelled line. `rootNotes(2)` puts every root between C2 and B2, so an approach note aims at that octave (into C2 from D♭2 or B1, not from D♭3). A bass written entirely by hand sounds right but does not come from the pattern: the brief says so ("the roots come from your chord pattern"), so the `uses` rule refusing it rejects nothing the brief allowed.
- Shell comping (J1.L05) from the pattern: the shell's 3rd and 7th on the Rhodes, `chord(changes).dict("guidetones").voicing()` (evaluated: B°7 voices D4 A♭4), and its root in the bass on beat 1. Rootless `lefthand` voicings anchored at A4 (J3.L01) are the learner's alternative; both pass every rule. The comping rhythm is the learner's (J3.L03: the Charleston, pushes).
- The grader gap that blocks this capstone today (run for this spec): `blues-form` with `variant: "jazz"` FAILS the chart J4.L02 teaches, because the grader's jazz form (`BLUES_FORMS.jazz`, packages/grader/src/analyze/chords.ts) takes only I on bar 4's downbeat and the chart has Cm7 F7 there ("bar 4 should stay on I (F7); it is v (Cm7)"). The same piece with F7 in bar 4 passes as "2 choruses of jazz blues". Requested of the grader: bar 4 `[0, 7]`; and bar 2 `[5, 0]` so a jazz blues without the quick change is not refused. `walking-bass` must also be rebuilt to its content-kit definition (pre-flight A3). Until both land, the capstone's reference fails content:check and the capstone author pins it as a known failure, not a pass.

## JC2 Jazz Blues in F

Author: **capstones-jazz-a**. The first jazz tune that is wholly the learner's, made from the skills of J3 and J4: a jazz blues in F, two choruses, comped in shells and walked by a bass whose roots come from the same chord pattern as the comping, with an original head on top. Session 1 is the band (changes, comping, walk: the tune's floor); session 2 is the tune (a head over two choruses, the second not a copy of the first) and the release. The brief fixes the form and the one-pattern rule and leaves the music to the learner.

Opens after: {"lessonsCompleted":["J4.L04"]}. Meter 4/4, 100–180 BPM. Brief: "Write a jazz blues in F. Write the changes once, as one chord pattern, and drive the band from it: shells on the Rhodes, and a walking bass that takes its roots from the pattern. Swing the ride or the comping. Put your own head on top for two choruses, the second one changed. Tempo and tune are yours."

Starter:

```js
setcpm(132/4)

// One chord pattern drives the band: change a chord here and the comping and the bass's roots follow.
const changes = "<F7 Bb7 F7 F7 Bb7 Bb7 F7 F7 C7 Bb7 F7 C7>"

drums: s("rd [rd rd] rd [rd rd]").swingBy(1/3, 4).bank("jazzkit").gain(.6)
hats: s("~ hh ~ hh").bank("jazzkit").gain(.5)
chords: chord(changes).dict("guidetones").voicing().s("rhodes").gain(.6)
bass: chord(changes).rootNotes(2).struct("x ~ x ~").s("upright")
```

| Rule | Label | Required | Rule kind | Parameters | Skills |
|---|---|---|---|---|---|
| form | A jazz blues in F, two choruses | yes | `blues-form` | {"variant":"jazz","choruses":2} | J11 |
| walking | The bass walks: mostly the root on beat 1, a chord tone on 3, and on 4 a note a step from the next bar's root | yes | `custom` | {"fn":"walking-bass","params":{"bass":"@bass","harmony":"@chords","rootOnOne":0.75,"chordToneOnThree":0.5,"approachOnFour":0.5,"maxSemis":2}} | B05 |
| swing | Swung 8ths on the ride or the comping | yes | `swing` | {"track":["hats","@drums","chords"],"drums":["hatClosed","hatOpen","ride"],"subdivision":8,"ratio":[1.6,2.4]} | R13 |
| one-pattern | Comping and bass come from one chord pattern | yes | `uses` | {"tool":["tb.set","tb.rootNotes"],"min":1} | J08 |
| head | Four parts heard: drums, bass, chords and your head on top | yes | `tracks` | {"min":4,"roles":["drums","bass","chords","melody"]} | J11 |
| head-sound | The head on the muted trumpet or the vibes |  | `sounds` | {"track":"mel","anyOf":["snd.mutetpt","snd.vibes"]} | J11 |
| chord-tones | The head lands on chord tones |  | `chord-tones-strong` | {"minRatio":0.6,"melody":"@melody","harmony":"@chords","strength":"strong"} | M03 |
| tempo | A medium-swing tempo, 100 to 180 BPM |  | `tempo-bpm` | {"min":100,"max":180} | R02 |
| ending | It ends on purpose |  | `custom` | {"fn":"ends-on-purpose"} |  |

Tests in the brief: "the starter: U11's blues in two, no walk, no head" (fail), "jazz-soul, the reference: Rhodes shells, the walk on the upright, the muted trumpet's head, at 132" (pass), "pop: piano shells, the electric bass walking, the head on the piano, at 120" (pass), "indie: clean-guitar shells, Am7 D7 in bar 8, the head on the acoustic guitar, at 112" (pass), "funk: rootless lefthand voicings at A4, the fingerbass walking, the organ head, at 144" (pass), "the head on the vibes at 160 over rootless comping" (pass), "minimal comping: shells on 2 and 4 only, at 104" (pass), "the right function, no walk: each bar's four notes crowded into beat 1" (fail), "roots on 1 and chord tones on 3, but beat 4 repeats beat 3: no approaches" (fail), "the roots four to the bar from the pattern: a bass on every beat, not a walk" (fail), "the right function on the wrong line: ride and comping straight, the swing on the quarter-note bass" (fail), "U11's blues, walked and with a head: not the jazz chart" (fail), "one chorus" (fail), "comping and walk written out note by note: no chord pattern" (fail), "the band without a head" (fail), "the right head, not heard: the melody at gain 0" (fail).

**Opens.** When J4.L04 is completed (contracts §3: "J4.L04 completed | JC2"; wave7.md §5.3 `TRACK_CAPSTONE_GATES`). J4.L04's Coda says JC2 is open; until then the album slot reads "Opens after Reading a Standard (J4.L04)" and Today says the same in one line. JC2 needs no checkpoint (J.CP2 gates JC3 and JC4 only, contracts §7.6). A learner may leave it open and go on with J5 or the other tracks; Today offers it first on a day with no lesson due.

**Band.** None: the learner writes the ride (`drums:`) and the hi-hat (`hats:`) in the starter, because the swing rule reads them and a Band's drums would double them. The flavour sets the starter's sounds (jazz-soul: the jazz kit, upright, Rhodes; other flavours keep the jazz kit, which is the genre) and never changes the rubric.

**The frame and the freedom.** The brief the learner reads (content/capstones.ts, author:capstones-jazz-a), proposed text: "A jazz blues in F, yours. Write the changes once and let them drive the band: shells on the Rhodes, a bass that walks with its roots taken from your chord pattern, the ride swinging. Then put your own head on top and play it for two choruses, the second one changed. Tempo, comping, the walk and the tune are yours."

- Fixed: 4/4; F major; a tempo between 100 and 180 BPM; the jazz blues chart's roots bar by bar (bar 2 B♭7, bar 4 Cm7 F7, bar 6 B♭7 or B°7, bar 8 D7 or Am7 D7, bars 9–10 Gm7 C7, bars 11–12 a turnaround), two choruses (24 bars); the bass walks; the ride or the comping swings; the changes are written once and both the comping and the bass's roots read them.
- Free: the head (its rhythm, its range, riff or line, on `mutetpt` or `vibes` or any unlocked pitched sound); the comping rhythm and voicing (shells from `guidetones`, rootless `lefthand`); the walk between the roots (up, down, chromatic, skips); the chart's variants above; drums beyond the ride and the hat (a kick feathered on four, a snare comment); the title.
- The second chorus differs from the first somewhere a listener hears: the head's last four bars answered or varied, the head an octave up, a second line entering. `blues-form` with `choruses: 2` refuses two identical choruses ("a chorus that only repeats the one before reads as the same 12 bars looping"), and the brief says it in plain words.
- Not possible, said in the notes and not in the brief: a minor blues (JC2 is F major); a slow-blues 12/8 (one meter: 4/4, swing gives the lilt).

**Rubric (the exact rule bodies; contracts §6.6 with the content lead's settled additions).** Required rules gate the release; suggestions show on the checklist and never gate. Every required rule reads what is heard, except `one-pattern-code`, which §6.6 binds and which sits beside the heard check of the same thing.

- form (required): `{ id: "form", label: "A jazz blues in F, two choruses", required: true, skills: ["J11"], rule: "blues-form", variant: "jazz", choruses: 2 }`.
- walking (required): `{ id: "walking", label: "The bass walks", required: true, skills: ["B05"], rule: "custom", fn: "walking-bass", params: { bass: "@bass", harmony: "@chords", rootOnOne: 0.75, chordToneOnThree: 0.5, approachOnFour: 0.5, maxSemis: 2 } }`: judged against the comping's chords (no `changes` list), so a bass that walks the right roots under comping in another key fails.
- swing (required): `{ id: "swing", label: "Swung 8ths on the ride or the comping", required: true, skills: ["R13"], rule: "swing", track: ["hats", "@drums", "chords"], drums: ["hatClosed", "hatOpen", "ride"], subdivision: 8, ratio: [1.6, 2.4] }`: never measured on the quarter-note bass (contracts §6.6, §6.10 item 4).
- one-pattern-heard (required): `{ id: "one-pattern-heard", label: "The bass and the comping play the same changes", required: true, skills: ["J08"], rule: "matches", min: 0.75, reference: { solutions: [REFERENCE], bars: 24 }, matcher: { m: "harmony", level: "bass", qualityDepth: "seventh", inversion: false, harmonicRhythm: "given" } }` with REFERENCE the jazz blues of this spec, two choruses, bass on `rootNotes(2)`.
- one-pattern-code (required, contracts §6.6): `{ id: "one-pattern-code", label: "Comping and bass come from one chord pattern", required: true, skills: ["J08"], rule: "uses", tool: ["tb.set", "tb.rootNotes"], min: 1 }`.
- head (requested as required, additive to §6.6, see notes): `{ id: "head", label: "A head on top", required: true, skills: ["J11"], rule: "tracks", min: 4, roles: ["drums", "bass", "chords", "melody"] }`.
- Suggestions: `{ rule: "sounds", track: "mel", anyOf: ["snd.mutetpt", "snd.vibes"] }` "The head on the muted trumpet or the vibes"; `{ rule: "chord-tones-strong", minRatio: 0.6, melody: "@melody", harmony: "@chords", strength: "strong" }` "The head lands on chord tones"; `{ rule: "tempo-bpm", min: 100, max: 180 }` "A medium-swing tempo".
- The rubric's `feedbackText` overrides `rubric.unmet` with "{label}: not yet." and `harmony.blues-bar` with a sentence naming the bar and the job of its chord ("Bar 4 leads into bar 5: two chords, a ii–V into B♭7"), never the chord symbol below rung 4.

**Tests the brief carries (content:check runs them; the capstone author writes them from these).** The reference passes; each named wrong piece fails on the rule given, and at least three other right pieces pass. Each wrong piece below that uses the right function is marked so.

- Passes: the reference (two choruses, guidetones comping on the Charleston, the walk of this spec, the head of J4.L02's hook then varied); the comping rootless (`lefthand` anchored at A4) instead of shells; bar 8 as `[Am7 D7]`; the head on `vibes` at 160 BPM.
- Fails `walking`: four bass notes crowded into beat 1 (`[f2 f2 f2 f2]` as sixteenths, then rests: RIGHT FUNCTION, no walk; pre-flight A3); a walk with roots on 1 and every beat 4 a repeat of beat 3 (no approaches); the starter's four roots a bar (`rootNotes(2).struct("x*4")`: beat 4 repeats the next root, not an approach).
- Fails `swing`: the ride and the comping straight (`rd*8`, no swing call) while the bass walks in quarters (swing measured on a quarter-note bass would be no measurement: RIGHT FUNCTION `.swingBy(1/3, 4)` on the bass only).
- Fails `form`: the U11 blues changes (`F7 Bb7 F7 F7 Bb7 Bb7 F7 F7 C7 Bb7 F7 C7`); one chorus (12 bars); two identical choruses.
- Fails `one-pattern-heard`: a bass that walks Bb7 where the comping plays F7 for four bars (the comping and the bass disagree).
- Fails `one-pattern-code`: the comping and a walk written entirely in note names with no `rootNotes` or `set` anywhere (the brief asks for roots from the chord pattern).
- Fails `head`: the band without a melody line.
- Until the grader widens `BLUES_FORMS.jazz` bar 4 and rebuilds `walking-bass`, the reference fails `form` and the walking tests cannot pass or fail for the right reason: content:check lists JC2 among the briefs whose tests fail, and the author records it.

### JC2.S1: Changes, shell comping and walking bass from one `chord()` pattern.

- **Opens with.** The starter: the tempo line (132 BPM), the ride and the hi-hat on the jazz kit, `const changes` holding the U11 blues in F (F7 Bb7 F7 F7 | Bb7 Bb7 F7 F7 | C7 Bb7 F7 C7), the comping `chord(changes).dict("guidetones").voicing()` held a bar each on the Rhodes, and the bass `chord(changes).rootNotes(2).struct("x ~ x ~")` (a two-feel on the roots) on `upright`. The brief and a card "From J4.L02: the jazz blues in F" with the chart in the chord band.
- **Hears.** The starter plays the U11 blues swinging in two. The chart card plays J4.L02's jazz blues once on request.
- **Sees.** The capstone workspace: code, roll with the chord band (numerals on), the checklist with `form` (one chorus counts this session: "1 of 2 choruses"), `walking`, `swing`, `one-pattern-heard` and `one-pattern-code`, and the form lens showing the twelve bars.
- **Work.**
  1. Turn the changes into the jazz blues (bars 4, 6, 8–12), in the one `const changes`; hear the comping and the bass's roots follow.
  2. Give the comping a rhythm (the Charleston, a push, J3.L03) and decide shells or rootless.
  3. Walk the bass: keep the roots from the pattern on beat 1 (`stack(chord(changes).rootNotes(2).struct("x ~ ~ ~"), note("<[~ … ] …>"))`), write beats 2–4 bar by bar, a chord tone on 3 and a step or half step into each next root on 4.
  4. Change one chord of the pattern (bar 8 D7 → `[Am7 D7]`), hear comping and roots follow, keep it or change it back.
- **Checks.**
  - `form` with one chorus (the session's checklist reads `choruses: 1`; the release reads 2), `walking`, `swing`, `one-pattern-heard` (on one chorus: the reference's first 12 bars) and `one-pattern-code`: the draft is saved whatever they say; the checklist shows each.
- **Ends.** The draft is saved (the Make of the session); the Coda says what is walking and what is next: "Tomorrow: a head of your own over two choruses, and the release."
- **Enjoyment.** A swinging jazz blues band the learner built in one sitting: their changes, their comping and their walking bass all moving together, a loop they can leave playing.
- **Pace.** Three jobs the learner has done before (J4.L02's chart, J3.L03's comping, J3.L04's walk) on one tune; the only new move is taking the walk's roots from the pattern. The head waits for tomorrow.
- **Return.** The Coda says: your band plays a jazz blues in F from one chord pattern. Tomorrow you write the head and release it.

### JC2.S2: Original head over two choruses; release. (review, release)

- **Opens with.** The draft from JC2.S1, with an empty `mel:` line on `mutetpt` and an `arrange([12, …], [12, …])` skeleton for it, so the head can be one chorus and its variation the next.
- **Hears.** The band from yesterday. A card plays two heads from J4.L02 (the hook's) as an example of chord tones on the strong beats.
- **Sees.** The same workspace; the checklist now asks two choruses and the head; the form lens shows 24 bars.
- **Work.**
  1. Write a twelve-bar head: a riff or a line, chord tones on the strong beats where the chords change (bars 4, 6, 8–12).
  2. Play it twice in `arrange()`: chorus 2 changes something a listener hears (the last four bars answered, an octave up, a second voice).
  3. Mix by ear: the head on top, the comping under it, the bass felt; a tempo between 100 and 180.
  4. Release: title, the liner notes' inputs, the cover.
- **Checks.**
  - Every required rule of the rubric on the whole 24 bars; the release waits for all of them. Suggestions show and never gate.
- **Ends.** The release: the track joins the album. The tutor review is offered (contracts §10.6). The Coda says: "You can now comp and walk a jazz blues from one chord pattern" (`cd.compose.jazz-blues`), and that the Studio template "Jazz blues in F" is yours.
- **Enjoyment.** Their own jazz blues on the album: a head they wrote over a band they built, two choruses that sound like a small group on a record.
- **Pace.** One job: the head and its variation. The band is yesterday's, unchanged unless the learner wants; the release is three fields.
- **Return.** The Coda says the can-do and the Studio template, and what opens next: J5 (substitutions) once U17.CP is passed, or JC1 and the other tracks, and JC3 and JC4 after J.CP2.

**Liner notes.**

- Deterministic: "A jazz blues in F, two choruses, at {bpm} BPM. The changes are written once and drive the band: shells on the {chords sound}, a walking bass on the {bass sound} with its roots from the chord pattern, the head on the {melody sound}."
- From the analysis: the number of bar lines the bass approaches by a step or a half step ("The bass leans into 11 of 12 bar lines"); the chart's variants used ("Am7 D7 in bar 8"); the swing ratio of the ride.
- The learner's inputs: the title, one line about the head (optional).

**Tests the brief or the checks must carry.**

- the reference passes every required rule (after the grader's bar-4 fix and the `walking-bass` rebuild)
- four bass notes crowded into beat 1 fail `walking` (right function, no walk)
- a walk with no approaches fails `walking`
- the ride and comping straight with a swung quarter-note bass fail `swing`
- the U11 blues fails `form`; one chorus fails `form`; two identical choruses fail `form`
- a bass a chord off the comping for four bars fails `one-pattern-heard`
- a hand-written walk with no `rootNotes`/`set` fails `one-pattern-code`
- no melody fails `head`
- rootless comping, `[Am7 D7]` in bar 8, and the head on vibes at 160 BPM each pass

- Reference (evaluated with headless Strudel; rules run on the real grader for this spec): the changes `<F7 Bb7 F7 [Cm7 F7] Bb7 Bo7 F7 D7 Gm7 C7 [F7 D7] [Gm7 C7]>`, the ride and the hat, `chords: chord(changes).dict("guidetones").voicing().struct("x ~ ~ x ~ ~ ~ ~").swingBy(1/3, 4)`, `bass: stack(chord(changes).rootNotes(2).struct("x ~ ~ ~"), note("<[~ a2 c3 b2] [~ a2 ab2 g2] [~ g2 eb2 db2] [~ eb3 f2 a2] [~ ab2 f2 c3] [~ ab2 f2 e2] [~ e2 eb2 c#2] [~ c3 a2 ab2] [~ bb2 f2 db2] [~ bb2 g2 gb2] [~ a2 d2 f#2] [~ bb2 c3 e2]>")).s("upright")`, and the head of J4.L02's hook over two choruses with its last four bars changed in the second. Results: `swing` passes ("`drums` swings at 2:1"), `uses` passes, `blues-form` jazz `choruses: 2` FAILS at bar 4 (the grader gap above) and PASSES when bar 4 is F7 ("2 choruses of jazz blues").
- The walk of the reference, evaluated: beat 1 roots F2 B♭2 F2 C2 B♭2 B2 F2 D2 G2 C2 F2 G2; beat 3 a chord tone in all twelve bars; beat 4 a step or a half step from the next beat 1 at all twelve bar lines, the loop's included.
- Contracts §6.6 lists no melody rule for JC2 although JC2.S2's goal is the head; the `head` rule (`tracks` with a melody role) is proposed as required (apiNote to the content lead: add "a head on top (`tracks` with a melody role)" to §6.6's JC2 row). Without it, a band with no head can be released.
- The scaffold in content/capstones.ts must change to match: bar 4 `[Cm7 F7]` and bar 12 `[Gm7 C7]` in the starter's chart are the learner's to write (the starter now holds the U11 blues); the hint ladder's rung 3 ("Walk F A C B to reach B♭") is right (B to B♭ is a half step); add `choruses: 2`, `one-pattern-heard`, `head` and the swing on `["hats", "@drums", "chords"]` as above; the `walking-bass` params as above.
- Copyright: no standard is used; the head is the learner's.
