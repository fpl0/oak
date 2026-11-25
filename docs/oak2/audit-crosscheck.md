# X4 cross-check

**The audits are useful inventories, but their verdicts should not become W2 changes without review.** They sometimes treat overlapping notes as proven masking, require more variation than §7 specifies, and overlook existing one-time events. Two proposed changes have concrete compatibility problems.

Read-only review completed. No files changed, no network used, no tests or evaluation scripts run. My initial ratings were recorded before opening either audit.

## 1. Independent audit

Ratings concern **Oak’s authored arrangement before learner takeovers**. The composer can replace or suppress those parts according to ownership; an initial-listen finding therefore does not automatically describe the finished learner song (`packages/grader/src/song/compose.ts:324–350`, `749–799`).

- **Yes:** the written arrangement supplies the feature.
- **No:** the inspected arrangement lacks it.
- **Partly:** coverage is mixed, or the code establishes a concern without establishing its audible effect.
- Audible masking, mix depth and relative prominence **could not verify** without rendering/listening.
- “Once-only” means a specific event within one traversal of the song. I do not count an entire unique section alone. PLAN’s narrower future rule also says “inside a section, ≤ 1 bar”; it does **not** require that section’s type to repeat (`docs/oak2/PLAN.md:100`, `145`).
- Band ratings describe the backing itself. A missing song-level feature in a reusable loop is not automatically a defect.

In each song table, line citations refer to the full file path named immediately above it. **P** means pop; **J** means jazz-soul.

### U02 — `content/unit-songs/U02.ts`

Form: intro 1–4; verse1 5–12; chorus1 13–20; verse2 21–28; bridge 29–36; chorus2 37–44; outro 45–52; end 53 (`L31–40`).

| Checklist item | P | J | Code evidence |
|---|---|---|---|
| Ends on purpose | yes | yes | Outro progressively reduces the opening riff; bar 53 supplies C bass/chord and a final percussion hit (`L106–144`, `257–275`, `403–421`). |
| Parts do not all switch together | yes | yes | P kick continues unchanged across verse1→chorus1; J hats continue unchanged across intro→verse1 (`L217–243`, `382–386`). |
| Once-only moment | yes | yes | Bridge bar 8, global bar 36: P’s unique `sd*16` culmination; J’s corresponding `sd*8` culmination (`L202`, `232`, `377`). |
| Front/middle/back | yes | yes | Changing riff/tune and alternating call/echo sit over repeating C–F accompaniment (`L85–144`, `257–275`, `403–421`). Actual depth **could not verify**. |
| Clean kick/bass relationship | partly | partly | Bass deliberately shares kick attacks and sometimes sustains through them; this establishes coordination, not audible masking (`L219–224`, `259–264`, `364–369`, `405–410`). Cleanliness **could not verify**. |
| Repeated sections varied | yes | yes | Verse2 introduces B♭; chorus2 moves the double down an octave and changes percussion (`L88`, `110–123`, `251–253`, `397–399`). |
| Build and release | yes | yes | Bridge increases subdivision into chorus2; outro reduces rhythm and the final bar removes snare/hats (`L201–205`, `227–245`, `372–390`). |
| No register crowding | partly | partly | Low chords and higher lead are separated, but chorus2’s octave-down double overlaps the chord region (`L94–103`, `123`, `133–144`). Audible crowding **could not verify**. |
| Drum looseness | yes | yes | Explicit hat/ride velocity shapes provide stronger and weaker strokes; straight timing is preserved (`L150–154`, `237–244`, `382–396`). |
| Appropriate drum foundation | yes | partly | P has kick/backbeat support; J uses ride-led choruses but hat/rim-led verses (`L217–243`, `362–399`). Actual prominence **could not verify**. |

### U05 — `content/unit-songs/U05.ts`

Form: intro 1–4; verse1 5–12; prechorus 13–16; chorus1 17–24; verse2 25–32; bridge 33–40; chorus2 41–48; outro 49–52; end 53 (`L44–54`).

| Checklist item | P | J | Code evidence |
|---|---|---|---|
| Ends on purpose | yes | yes | Outro C–Am–G–C, followed by a dedicated C/C6 ending; snare and hats stop (`L108–109`, `151–152`, `349–369`, `509–529`). |
| Parts do not all switch together | yes | yes | P’s eighth-note hat pulse continues into prechorus before doubling in its last bar; J’s foot hats continue across verse/prechorus/chorus changes (`L362–364`, `522–524`). |
| Once-only moment | yes | yes | Bar 14 alone uses C augmented with G♯ in the accompanying climb—a local harmonic event within the four-bar prechorus (`L103`, `125`, `136`, `221`). |
| Front/middle/back | yes | yes | Intro arpeggio is foreground over held bass/pad; later the tune changes over recurring accompaniment. Pad and comp have different temporal roles (`L163–202`, `244–263`, `824–850`). Audible balance **could not verify**. |
| Clean kick/bass relationship | partly | partly | P’s verse bass starts on the kick’s 1 and “and” of 2; J holds roots under its kick/comp (`L340`, `384`, `500`, `545–558`). Masking **could not verify**. |
| Repeated sections varied | yes | yes | Verse2 changes G to G/B; chorus2 increases tambourine/shaker activity in both inspected flavours (`L105`, `375–378`, `536–539`). |
| Build and release | yes | yes | Prechorus and bridge build their drum/bass activity; outro returns to held bass and sparse comp (`L318–326`, `338–402`, `543–563`). |
| No register crowding | partly | partly | Pad and comp overlap around G3–C4, but their notes, envelopes and gains differ (`L118–161`, `333`, `492`, `850–855`). Audible crowding **could not verify**. |
| Drum looseness | yes | yes | Hat/ride velocity contours exist; J additionally swings (`L268–272`, `360–368`, `533–536`, `805–811`). |
| Appropriate drum foundation | yes | yes | P is kick/backbeat-led; J has continuous ride time and foot hats around its comping (`L338–367`, `520–539`). Relative audible prominence **could not verify**. |

### U09 — `content/unit-songs/U09.ts`

Form: intro 1–4; verse1 5–12; chorus1 13–20; verse2 21–28; chorus2 29–36; bridge 37–44; reprise 45–48; chorus3 49–56; outro 57–64 (`L38–48`).

| Checklist item | P | J | Code evidence |
|---|---|---|---|
| Ends on purpose | yes | yes | Outro harmony ends G→C, tune ends C, bass holds the final root and drums reduce to final hits (`L147`, `185–193`, `318–359`, `452–496`). |
| Parts do not all switch together | yes | yes | Bass leaves bar 12/28 before each chorus and bar 48 before chorus3; tune anticipates verse1 in bar 4 (`L198`, `288–299`, `347–350`, `484–487`). |
| Once-only moment | yes | yes | Reprise bar 4, global bar 48, has the one-time snare-roll culmination before chorus3 (`L325`, `460`); this is smaller than the reprise section. |
| Front/middle/back | yes | yes | Repeating backing supports question/answer melodies, with a new double only in chorus3 (`L163–218`, `345–359`, `482–496`). Audible balance **could not verify**. |
| Clean kick/bass relationship | partly | partly | P locks bass to kick; J’s two-feel sustains under kick attacks (`L314–315`, `347–348`, `448–449`, `484–485`). Masking **could not verify**. |
| Repeated sections varied | partly | partly | Verse1/2 and chorus1/2 reuse their material; chorus3 adds octave doubling and percussion (`L199–217`, `343`, `480`). |
| Build and release | yes | yes | Reprise grows through four bars; chorus3 adds a layer; outro strips activity (`L229–231`, `317–359`, `451–496`). |
| No register crowding | partly | partly | Chorus3’s octave-down double intersects the raised chord register (`L108–135`, `165–173`, `217`). Audible crowding **could not verify**. |
| Drum looseness | yes | yes | Regular velocity contours plus a four-bar rising hat contour; J applies swing (`L224–231`, `329–334`, `439`, `469–480`). |
| Appropriate drum foundation | yes | yes | P kick/snare anchor the groove; J retains foot hats and a ride throughout the main sections (`L312–334`, `446–480`). Relative prominence **could not verify**. |

### U13 — `content/unit-songs/U13.ts`

Form: intro 1–4; verse1 5–12; stop 13; chorus1 14–21; verse2 22–29; bridge 30–37; break 38–41; chorus2 42–49; outro 50–53; end 54 (`L54–67`).

| Checklist item | P | J | Code evidence |
|---|---|---|---|
| Ends on purpose | yes | yes | Final Cmaj7/root/E melody with kick/percussion; snare, hats and guitar absent (`L142`, `386`, `399–404`, `573–620`, `708–756`). |
| Parts do not all switch together | yes | yes | Break’s final bass/chord push anticipates chorus2, while its new groove starts on the boundary (`L145`, `276–303`, `546–548`). |
| Once-only moment | yes | yes | Bar 13 is the single snare-only swelling fill, distinct from the later four-bar break (`L59`, `557`, `578`, `713`). |
| Front/middle/back | yes | yes | High melody, clipped guitar scratches, comp and bass have distinct written roles (`L320–404`, `1010–1025`). Audible balance **could not verify**. |
| Clean kick/bass relationship | partly | partly | Pushes and break attacks deliberately coincide; exact grid coordination is clear (`L546–547`, `568`, `604`, `703`, `740`). Acoustic cleanliness **could not verify**. |
| Repeated sections varied | yes | yes | Guitar joins verse2; chorus2 changes P hats/percussion and J ride pattern (`L399–403`, `588–599`, `732–735`). |
| Build and release | yes | yes | Full groove→bar-13 stop→chorus; triplet bridge→reduced break→chorus2→ending (`L54–67`, `567–620`, `702–756`). |
| No register crowding | partly | partly | Guitar and chord voicings genuinely overlap, but guitar notes are clipped and velocity-shaped (`L122–127`, `397–398`, `1015–1023`). Audible crowding **could not verify**. |
| Drum looseness | yes | yes | Snare ghosts at .3, hat levels 1/.6/.4, and ride accents are explicitly encoded (`L410–429`, `579`, `588–589`, `714`, `729–735`). |
| Appropriate drum foundation | yes | yes | P uses kick/backbeat with ghosts; J retains accented ride and foot hats while staying straight (`L567–599`, `702–735`). |

### J3 — `content/unit-songs/J3.ts`

Form: intro 1–4; head1 5–21, break1 at 17; solo 22–38, break2 at 34; head2 39–55, break3 at 51; outro 56–59; end 60. Each pass contains four four-bar key “rooms” (`L66–89`).

| Checklist item | P | J | Code evidence |
|---|---|---|---|
| Ends on purpose | yes | yes | Tag resolves to F bass with A–C–E–G chord and A5 melody; snare/hats leave (`L174–180`, `318`, `427`, `441`, `490`, `503`, `772`). |
| Parts do not all switch together | yes | yes | Breaks remove bass/chords while melody and drums continue; intro melody enters halfway through bar 4 (`L293–296`, `305–315`, `805–815`). |
| Once-only moment | yes | yes | Break2, bar 34, uses `BREAK_SOLO`; breaks1/3 use `BREAK_TUNE`. This is a unique one-bar event within a repeated break type (`L293–315`). |
| Front/middle/back | yes | yes | Melody changes from head to solo; accompaniment keeps recurring comp/time patterns (`L268–285`, `386–390`, `453–459`, `515–521`). Audible balance **could not verify**. |
| Clean kick/bass relationship | partly | partly | Two-feel and walking bass coexist with kicks on 1/3 or added offbeats (`L239–253`, `411–416`, `476–481`, `779–781`). Masking **could not verify**. |
| Repeated sections varied | yes | yes | Returning head changes from two-feel to walking bass; P adds clap/tambourine; J changes snare comping (`L424–425`, `488`, `509`, `779–781`). |
| Build and release | yes | yes | Sparse pickup/head→busier solo/walk→returning head→two-feel tag→final hit (`L239–256`, `296`, `424–459`, `479–521`, `772–781`). |
| No register crowding | partly | partly | C-room chord tops intentionally coincide with melody notes C5/B4/E5; this is the drop-2 lesson’s design (`L165`, `270`). Overlap is certain; harmful crowding **could not verify**. |
| Drum looseness | yes | yes | Swing plus hat/ride velocity shapes are explicit (`L324–329`, `445–450`, `499–502`, `849–852`). |
| Appropriate drum foundation | yes | yes | P is authored as swing-pop with kick/backbeat; J uses continuous ride, foot hats and sparse/comping snare (`L411–450`, `463–501`). Audible hierarchy **could not verify**. |

### A2 — `content/unit-songs/A2.ts`

Form: intro 1–4; verse1 5–12; chorus1 13–20; verse2 21–28; chorus2 29–36; break 37–44; ballad 45–52; drive 53–60; outro 61–64 (`L52–61`).

| Checklist item | P | J | Code evidence |
|---|---|---|---|
| Ends on purpose | yes | yes | F–G–Am–Am outro; melody resolves to A4, bass holds the last root and snare/hats stop in bar 64 (`L155`, `195`, `384–430`, `557–604`). |
| Parts do not all switch together | yes | yes | Break accompaniment/sample starts at bar 37; melody waits four bars and returns at bar 41 (`L209–210`, `915–918`). |
| Once-only moment | yes | yes | `impact` appears once, in break bar 4/global bar 40; later `scratch` also has a single placement (`L265–273`, `915–918`). Sample audibility **could not verify**. |
| Front/middle/back | yes | yes | Verse2 adds a complementary counter-line, chorus2 a held line, drive an octave double over recurring backing (`L182–236`). Audible balance **could not verify**. |
| Clean kick/bass relationship | partly | partly | P’s drive alternates root/octave eighths under four kicks; J uses walking quarters (`L383`, `420`, `556`, `594`). Sample-break kick interactions and masking **could not verify**. |
| Repeated sections varied | yes | yes | Verse2 adds counter-melody; chorus2 adds held melody; P also adds shaker (`L224–232`, `412`). |
| Build and release | yes | yes | Choruses thicken, break/ballad reduce texture, drive rebuilds, outro releases (`L377–430`, `550–606`). |
| No register crowding | partly | partly | Pad explicitly uses the chord voicings; counter-line overlaps their register, but has a different rhythm/timbre (`L116–140`, `222–236`, `889–894`). Audible crowding **could not verify**. |
| Drum looseness | yes | yes | Velocity-shaped hats/ride; J ballad additionally has brush velocities .7/.5/.6/.5 (`L396–402`, `565`, `580–585`). Recorded break performance **could not verify**. |
| Appropriate drum foundation | yes | yes | P has kick/backbeat foundation; J has ride and foot hats, with an intentional brush ballad (`L377–410`, `550–585`). |

### Pop Band style — `content/bands/index.ts`

This covers the loop builders and `band.sections`; section bars below refer to its default VCVC form.

| Checklist item | Verdict | Code evidence |
|---|---|---|
| Ends on purpose | partly | `phrase-8bar` cadences V→I and `sections` ends its chorus on I, but neither supplies a dedicated terminal arrangement (`L47–49`, `307–310`, `652–655`). |
| Parts do not all switch together | no | In default `sections`, drum groove, bass rhythm/harmony and comp change together at bars 5/9/13 (`L652–653`, `689–696`). |
| Once-only moment | no | Default VCVC repeats the same two section patterns; the ordinary loop builders contain recurring material (`L229–232`, `652–653`). This is not automatically a backing-loop defect. |
| Front/middle/back | partly | Three accompaniment roles exist; the changing foreground must come from learner code (`L183–192`). Full composite depth **could not verify**. |
| Clean kick/bass relationship | partly | Whole-note roots or pumping eighths share attacks/sounding time with `POP_4` (`L196`, `232`, `334`, `406–410`). Masking **could not verify**. |
| Repeated sections varied | no | Both verse and chorus occurrences reuse their original patterns (`L652–653`). |
| Build and release | partly | `sections` alternates thinner verse and denser chorus; ordinary loops have no authored larger arc (`L689–696`, `229–232`). |
| No register crowding | partly | Bass is low, but axis chords reach above the tonic into potential learner melody space (`L24`, `334`). Full learner/Band overlap **could not verify**. |
| Drum looseness | yes | Explicit deterministic accents exist, including eighths, quarters and triplets (`L65–75`, `189`, `196`, `365–371`). They need not be random to vary stroke strength. |
| Appropriate drum foundation | yes | `POP_4` and `sections` are built around kick/snare with hats above them (`L196`, `691`). |

### Jazz-soul Band style — `content/bands/index.ts`

Staging matters: the two-chord vamp gains swing/sixths from U03; `bandCodeAt` selects the reached stage (`L1448–1454`, `1583–1593`; also `content/flavours.ts:112–117`).

| Checklist item | Verdict | Code evidence |
|---|---|---|
| Ends on purpose | partly | Phrase Band has V→I closure; loops/default VCVC have no dedicated terminal treatment (`L48`, `311–318`, `652–657`). |
| Parts do not all switch together | no | `sections` changes ride subdivision, bass movement and comp together at its boundaries (`L698–710`). |
| Once-only moment | no | No unique occurrence is authored into default VCVC; repeated loop playback repeats its events (`L652–653`, `698–710`). |
| Front/middle/back | partly | Upright, Rhodes and drums provide differentiated backing roles; learner foreground is unspecified (`L100–106`, `183–192`). Composite depth **could not verify**. |
| Clean kick/bass relationship | partly | Two-feel/walking bass intentionally coexist with kick attacks (`L233–239`, `925–934`, `1048–1058`). Audible cleanliness **could not verify**. |
| Repeated sections varied | no | `sections` reuses both passes; jazz-form drums repeat the same cell (`L652–653`, `1048–1058`). |
| Build and release | partly | `sections` increases ride and bass activity in choruses; ordinary loops lack that larger arc (`L698–710`). |
| No register crowding | partly | Some voicings intentionally sit low; high comp provides a separate alternative for walking bass (`L917–919`, `1076–1092`). All learner combinations **could not verify**. |
| Drum looseness | yes | Velocity contours and staged swing are explicit (`L65–77`, `189`, `1451–1453`). |
| Appropriate drum foundation | partly | `jazzForm`/`iiVIComp` have articulated ride plus foot hats; generic `JAZZ_4` has even ride eighths and kick/snare support (`L197`, `1054–1058`, `1085–1092`). |

### Electronic Band style — `content/bands/index.ts`

| Checklist item | Verdict | Code evidence |
|---|---|---|
| Ends on purpose | partly | Phrase harmony cadences; the generic backing and default VCVC have no dedicated terminal arrangement (`L47–49`, `323–324`, `652–657`). |
| Parts do not all switch together | yes | In `sections`, **kick and clap remain identical** across verse/chorus while hats, bass and comp change (`L733–742`). A changed drum track is not proof that every audible drum part switches. |
| Once-only moment | no | Default VCVC repeats both patterns; acid cells recur (`L217–225`, `652–653`, `736–742`). |
| Front/middle/back | partly | Acid bass and offbeat stabs have distinct rhythmic roles; learner foreground is unspecified (`L209–218`, `183–192`). Composite depth **could not verify**. |
| Clean kick/bass relationship | partly | Acid attacks coincide with quarter-note kicks, but bass has a short filter/envelope treatment (`L144`, `214–218`). Audible masking **could not verify**; coincidence alone is insufficient for “no.” |
| Repeated sections varied | no | Repeated verses/choruses reuse their patterns (`L652–653`, `736–742`). |
| Build and release | partly | `sections` changes from sparse hats/bass to denser acid/hat activity; ordinary loops have no larger arc (`L733–742`). |
| No register crowding | partly | Bass roots sit below chord voicings; resonant bass and stabs share sawtooth timbre (`L139–145`, `739–741`). Spectral crowding **could not verify**. |
| Drum looseness | yes | Sixteenth velocity accents accompany the deliberately regular machine groove (`L65`, `214`, `189`). |
| Appropriate drum foundation | yes | House-style quarter-note kick, backbeat clap and offbeat open hats (`L214`). The checklist’s specifically jazz/pop distinction adds no further requirement here. |

## 2. Comparison and disagreements

“Core” below means `docs/oak2/audit-core.md`; “Rest” means `docs/oak2/audit-rest.md`. Evidence references back to the explicitly named source files above.

### Song verdict disagreements

| Target/item | Other audit → X4 | Evidence and preferred verdict |
|---|---|---|
| U02 seam | Core **partly** (`99`) → **yes** | P kick is unchanged across verse1→chorus1; J hats continue intro→verse1 (`U02.ts:217–243`, `382–386`). X4 fits “parts don’t all switch”; neither a fill nor a special transition function is necessary. |
| U02 once-only | Core **no** (`100`) → **yes** | The bridge’s final snare culmination occurs once, at bar 36 (`U02.ts:202`, `232`, `377`). Prefer X4; evaluate separately if claiming a particular future rubric passes. |
| U02 register | Core **no** (`105`) → **partly** | Overlap is real (`U02.ts:123`, `133–144`), but intentional doubling is not automatically crowding. Prefer the qualified verdict; audible interference **could not verify**. |
| U02 looseness | Core **partly** (`106`) → **yes** | Hat/ride velocity contours already satisfy a listed mechanism (`U02.ts:150–154`, `237–244`, `396`). Additional ghosts/sample alternation are enhancements, not evidence of absence. |
| U05 seam | Core **partly** (`153`) → **yes** | Timekeeping continues while other material changes: P retains eighth-note hats into prechorus, J retains foot hats across several boundaries (`U05.ts:362–364`, `522–524`). Prefer X4 for §7’s minimum requirement. |
| U05 once-only | Core **partly** (`154`) → **yes** | C augmented is a **single bar within** the prechorus, not the whole section (`U05.ts:103`, `125`, `221`). Prefer X4 under PLAN’s wording. |
| U05 depth | Core **partly** (`155`) → **yes**, structurally | Pad holds while comp articulates; intro arpeggio and later melody provide changing foreground (`U05.ts:202`, `244–263`, `824–855`). Shared register does not erase those roles. Audible depth **could not verify**. |
| U05 returns | Core **partly** (`157`) → **yes** | Both verse and chorus returns change: inversion bass in verse2; denser percussion in chorus2 (`U05.ts:105`, `375–378`, `536–539`). “Only percussion changes” still changes what is heard; §7 specifies no minimum number of changed parts. |
| U05 looseness | Core **partly** (`160`) → **yes** | Hat/ride accents and J swing are already present (`U05.ts:268–272`, `360–368`, `533–536`, `805–811`). Prefer X4 for the stated checklist. |
| U05 drum foundation | Core **partly** (`161`) → **yes**, structurally | J has sustained ride time plus foot hats (`U05.ts:520–539`). A backbeat can coexist with that foundation in jazz-soul. Actual ride dominance **could not verify**. |
| U09 once-only | Core **no** (`226`) → **yes** | Bar 48’s special snare culmination is a local event, not merely a unique whole section (`U09.ts:325`, `460`). Prefer X4. |
| U09 returns | Core **no** (`229`) → **partly** | Agree that verse2/chorus2 repeat. Chorus3 nevertheless changes double/percussion (`U09.ts:217`, `343`, `480`). Prefer **partly** for the whole song. |
| U09 looseness | Core **partly** (`232`) → **yes** | Fixed accents and the reprise’s rising hat contour are explicit velocity shaping (`U09.ts:224–231`, `329–334`, `469`). Prefer X4. |
| U09 drum foundation | Core **partly** (`233`) → **yes**, structurally | Ride remains active with foot hats; `rd*8` is also swung by the track (`U09.ts:439`, `463–480`, `737–747`). Even written subdivisions do not imply straight playback. Prominence **could not verify**. |
| U13 low end | Rest **yes** (`143`) → **partly** | Grid lock is established (`U13.ts:546–547`, `568`, `604`); lack of masking is not. Prefer qualified X4 until audio verification. |
| U13 register | Rest **no** (`146`) → **partly** | Agree the guitar/chord pitches overlap; guitar also has short clipped notes and strong/weak articulation (`U13.ts:122–127`, `397–398`, `1018`). Prefer X4: crowding **could not verify**. |
| J3 once-only | Rest **partly** (`260`) → **yes** | Break2 is musically different from breaks1/3, at bar 34 (`J3.ts:293–315`). Prefer X4 even under the audit’s repeated-section framing. |
| J3 arc | Rest **partly** (`264`) → **yes** | Intro/head→solo/walk→tag→final hit supplies build and release (`J3.ts:239–256`, `424–459`, `772–781`). §7 does not require a continuously rising final head. Prefer X4. |
| J3 register | Rest **yes**, “no overlapping ranges” (`265`) → **partly** | C-room chords have C5/B4/E5 tops matching melody notes (`J3.ts:165`, `270`). The no-overlap evidence is wrong; this intentional drop-2 relationship is not itself a defect. |
| J3 looseness | Rest **partly** (`266`) → **yes** | Swing plus varying ride/hat velocities meet the listed mechanisms (`J3.ts:324–329`, `445–450`, `499–502`). Prefer X4. |
| J3 drum foundation | Rest **partly** for non-jazz flavours (`267`) → **yes** for P/J | P is explicitly a swing-pop trio with kick/backbeat; J supplies the ride foundation (`J3.ts:403–450`, `463–501`). Prefer X4 for flavour-specific interpretation; requiring all flavours to use a jazz ride is an additional artistic choice. |
| A2 once-only | Rest **no** (`379`) → **yes** | One `impact` at bar 40 and one later `scratch` are individual events within the break (`A2.ts:265–273`, `915–918`). Prefer X4; the sample’s actual audible result **could not verify**. |
| A2 low end | Rest **yes** (`381`) → **partly** | Attack patterns are readable, but the rendered sampled break and bass interaction are not established (`A2.ts:243–273`, `414–420`, `915–918`). Prefer qualified X4. |
| A2 register | Rest **no** (`384`) → **partly** | Pad/comp overlap is real; counter-line deliberately fills different rhythmic spaces (`A2.ts:222–236`, `889–894`). Prefer X4 until listening establishes crowding. |
| A2 looseness | Rest **partly** (`385`) → **yes** | Shaped hats/ride and J’s explicitly varied brush strokes exist (`A2.ts:396–402`, `565`, `580–585`). Prefer X4 under §7. |

**Flavour-scope qualification on low end:** Core’s overall **partly** for U02/U05/U09 is driven by electronic, whereas it endorses pop/indie/funk locking (`Core:102`, `156`, `228`, `380–381`). My P/J **partly** is an evidence limit, not a claim that locking is defective. Musical coordination is supported; audible cleanliness **could not verify**.

All other song checklist verdicts agree after accounting for flavour scope.

### Band verdict disagreements

| Item/target | Other audit → X4 | Evidence and preferred verdict |
|---|---|---|
| Endings, all three styles | Core **no** (`248`, `263`); Rest **n/a** (`399`, `429`) → **partly** | Phrase harmony explicitly closes V→I; dedicated terminal treatment is absent (`content/bands/index.ts:47–49`, `307–324`). X4 distinguishes cadence from stopping. No automatic “append a bar” requirement follows. |
| Pop loop seam | Core **partly** (`249`) → **no** | The phrase has changing harmony over a repeating groove, but no authored section transition or anticipatory/retracted part (`content/bands/index.ts:307–310`). Prefer **no**, without treating this as a loop defect. |
| Electronic seam | Rest **no** (`430`) → **yes** | Kick/clap remain identical across `sections`; hats/bass/comp change (`content/bands/index.ts:736–742`). Prefer X4: inspect audible subparts rather than only the three track labels. |
| Once-only, ordinary loops | Core/Rest **n/a** (`250`, `401`, `431`) → **no, structurally absent** | Recurring patterns contain no once-per-performance occurrence (`content/bands/index.ts:229–252`, `652–653`). This is a reporting convention difference, **not** a recommendation to add surprises to every backing. |
| Depth, pop `sections`, jazz-soul, electronic | Core/Rest **yes** (`266`, `402`, `432`) → **partly** | The backing has roles but no authored changing learner foreground (`content/bands/index.ts:183–192`, `667–683`). Full-composite depth **could not verify**. |
| Low end, pop and jazz-soul | Core/Rest **yes** (`252`, `267`, `403`) → **partly** | Intentional lock/two-feel is supported; clean audio is not established by MIDI-style overlap counts (`content/bands/index.ts:196–197`, `232–239`, `689–710`). Prefer qualified X4. |
| Low end, electronic | Rest **no** (`433`) → **partly** | Quarter-note collisions exist, alongside bass envelope/filter shaping (`content/bands/index.ts:144`, `214–218`). Prefer X4 until masking is demonstrated. |
| Repeats, ordinary pop loops | Core **n/a** (`253`) → **no, structurally unchanged** | Loop material repeats; default section returns are also identical (`content/bands/index.ts:229–232`, `652–653`). Again a scope convention, not an automatic defect. |
| Arc, style families | Core/Rest loop **n/a** (`254`, `405`, `435`) → **partly** | Ordinary loops lack a larger arc, but `sections` supplies thinner/denser alternation in all three flavours (`content/bands/index.ts:689–710`, `733–742`). Core’s **yes** for pop `sections` (`269`) agrees with that component. |
| Registers, pop `sections`, jazz-soul, electronic | Core/Rest **yes** (`270`, `406`, `436`) → **partly** | Written backing registers are generally separated; actual learner pitches and spectral overlap are unspecified (`content/bands/index.ts:681–682`, `917–919`, `1076–1092`). Universal clearance **could not verify**. |
| Looseness, pop and jazz-soul | Core/Rest **partly** (`256`, `271`, `407`) → **yes** for presence | Deterministic velocity patterns already shape strokes (`content/bands/index.ts:65–77`, `189`). The pop verse’s weaker alternating contrast remains variation. Independent drum contours would improve nuance, but §7 does not require every listed mechanism. |

The remaining Band ratings agree: repeated `sections` are unchanged; pop’s foundation is appropriate; generic jazz-soul foundation is mixed; electronic accents/foundation are appropriate.

### Factual and implementation corrections

These matter even where the headline rating agrees.

1. **A2’s melody enters four bars into the break, at bar 41—not one bar late.** Rest’s seam evidence is incorrect (`Rest:378`; `content/unit-songs/A2.ts:209–210`). Its snare’s last outro hit is in bar 63; silence begins in bar 64 (`Rest:377`; `A2.ts:393`, `567`).

2. **J3’s repeated breaks are not identical.** Break2 has its own descending solo line (`Rest:260`; `content/unit-songs/J3.ts:293–315`).

3. **J3 has deliberate chord/melody pitch overlap.** “No overlapping ranges found” misses C-room drop-2 voicings under their melody tops (`Rest:265`; `J3.ts:165`, `270`). Removing that relationship would undermine the model rather than improve it.

4. **U13’s proposed Oak chord thinning cannot clear the learner’s replacement Rhodes.** Rest claims that consequence (`Rest:146`), but U13.L02 claims the chord cells while keeping guitar (`content/unit-songs/U13.ts:1102–1108`). The composer suppresses Oak’s owned-out chord track (`packages/grader/src/song/compose.ts:329–338`). It can improve the opening listen only.

5. **“All U13 drums are taken” is too broad.** Its plan omits `stop` and `end`; the take lists also do not universally claim percussion (`Rest:135`; `content/unit-songs/U13.ts:1052`, `1090–1138`). What extra parts a learner actually plays remains variable.

6. **The audits’ “repeated section type” restriction is stricter than PLAN’s text.** PLAN excludes counting a whole section as the event; it does not exclude an individual impact, fill or altered chord inside a section heard once (`Core:49–51`; `Rest:61–63`; `docs/oak2/PLAN.md:100`, `145`).

## 3. Rule-breaking fixes and compatibility problems

### Confirmed conflict: J3’s offbeat-only electronic sub

Rest proposes replacing a held root with `[~ g1@7]` (`docs/oak2/audit-rest.md:262`).

That removes the sounding bass root on beat 1 in electronic while other flavours retain it. This conflicts with the shared downbeat-root rule (`content/AUTHORING.md:1043–1047`). The validator explicitly compares the bass sounding at each downbeat, including silence (`content/validate/unit-songs.ts:304–305`, `319–329`, `487–503`).

**Do not apply that alternative as written.** The separate ducking alternative might preserve note timing, but its lint, audio and loudness compatibility **could not verify**.

### Confirmed lesson conflict: related A2.L06 example fix

Rest proposes changing the drive bass from eight notes per bar to `[~ root]*4` (`docs/oak2/audit-rest.md:487`).

The same hook is used by an investigation whose answer is explicitly **eight bass notes**, with hints explaining `*8` (`content/advanced/A2/L06/lesson.ts:236–257`). The proposal produces four attacks per bar.

**Changing that example alone would make the lesson’s answer and hints false.** This is a related example finding, separate from the A2 unit-song table.

### Unresolved form conflict: preserving all current bar counts

Both audits promise not to resize sections (`Core:24–28`; `Rest:31–35`). That preserves existing one-bar sections:

| Song | Existing one-bar sections | Current total | Total if each became four bars |
|---|---|---:|---:|
| U02 | `end` | 53 | 56 |
| U05 | `end` | 53 | 56 |
| U13 | `stop`, `end` | 54 | 60 |
| J3 | `break1`, `break2`, `break3`, `end` | 60 | **72** |

Evidence: `content/unit-songs/U02.ts:31–40`; `U05.ts:44–54`; `U13.ts:54–67`; `J3.ts:66–89`.

These are **pre-existing conflicts with the strict W2 multiples-of-four requirement**, not new bad section lengths introduced by the proposed musical edits. AUTHORING permits certain one-bar breaks/pickups, while PLAN §7 and this brief impose the stricter constraint (`content/AUTHORING.md:1025–1027`; `docs/oak2/PLAN.md:149`).

**The audits do not resolve that conflict.** In particular, mechanically extending J3’s four short sections exceeds 64 bars. Removing or merging its breaks also cannot be assumed harmless: they protect pushed learner chords before the G rooms (`content/unit-songs/J3.ts:12–16`). Section IDs must remain stable.

### Unsafe as specified: A2 chords below C3

Rest proposes root/fifth shells below C3 in verse2 (`docs/oak2/audit-rest.md:384`).

That moves harmonic material into the low region the unit’s register lesson specifically teaches the learner to clear (`content/advanced/A2/L01/lesson.ts:1–4`, `45–48`), and removes the thirds that distinguish the authored Am/F/C/G harmony (`content/unit-songs/A2.ts:116–140`, `144`).

This is a **pedagogical and harmony-preservation risk**, not a proven validator failure: exact proposed pitches, durations and cross-flavour implementation **could not verify**. It needs a concrete voicing before approval.

**No proposed frozen-section-ID rename or newly added over-limit unit-song section was found in the sampled recommendations.** The form issue above is unresolved existing structure.

## 4. Could-not-verify list

- The audits’ numerical event counts, collision percentages, pitch percentiles and uniqueness counts: **could not verify independently**; no evaluator was run.
- Audible kick/bass masking, register crowding, foreground prominence, room depth, loudness or clipping: **could not verify**. Note overlap and event density are evidence for investigation, not audio measurements.
- A2’s break-sample internal kick/snare timing, found-sound prominence and recorded performance looseness: **could not verify** from slice indices alone.
- Actual playback stopping and effect-tail behaviour after the authored final bar: **could not verify**. The written endings are clear; runtime termination was not tested.
- Whether proposed `struct`, `mask`, sample-index, ducking and timing changes lint and evaluate as intended: **could not verify**.
- Whether any proposed change passes existing content checks, flavour invariants, clash scans and loudness budgets: **could not verify**. The J3 downbeat conflict above is established by source logic, not a reproduced test failure.
- Every possible learner-take composition: **could not verify**. Ownership depends partly on what the learner actually plays.
- Perceptual drum hierarchy: **could not verify**. Foundation ratings describe the written rhythmic roles, not measured dominance or the author’s composition process.

## 5. Trust verdict

The two audits can be trusted as **useful source maps and lists of places to investigate**, especially for unchanged U09 returns, overlapping accompaniment registers and generic jazz-soul Band grooves. They should not be trusted as a ready-to-implement W2 backlog: several failures come from stricter unstated criteria, some supporting facts are wrong, and event overlap is repeatedly promoted into an acoustic judgment without listening. Preserve their concrete observations, correct the cited errors, resolve the short-section constraint, and verify each proposed fix against its lesson and rendered result before changing the music.