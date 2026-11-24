# Acoustic and orchestral multisamples for the Oak sound pack

Researched 2026-11-24. Read-only. I read every licence marked "read" myself, from the URL given. Sizes come from the GitHub git-tree API (exact byte counts of the files in the repo) or from the publisher's download table. "Could not verify" means I did not read the licence text myself.

## 0. What strudel.cc's own prebake loads (and the licence of each map)

Source: https://codeberg.org/uzu/strudel/raw/branch/main/website/src/repl/prebake.mjs (read).
`baseCDN = 'https://strudel.b-cdn.net'`. The prebake loads these, with the soundfonts registered separately:

| map | base | licence (as I verified it) |
|---|---|---|
| `piano.json` | `/piano/` | Salamander Grand V3, CC-BY 3.0 (the prebake comment says so; already in Oak) |
| `vcsl.json` | `/VCSL/` | **CC0**: the prebake comment reads "LICENSE: CC0 general-purpose", and I read the VCSL LICENSE myself (section 1) |
| `tidal-drum-machines.json` | `/tidal-drum-machines/machines/` | no licence declared (already in Oak) |
| `uzu-drumkit.json`, `uzu-wavetables.json` | ... | (already in Oak, or outside my area) |
| `mridangam.json` | `/mrid/` | `_base` is raw.githubusercontent.com/yaxu/mrid. Its README reads "Shared under a creative commons attribution share-alike license." with no version number, so it is **CC-BY-SA**. See section 6 |
| inline map (`casio`, `crow`, `insect`, `wind`, `jazz`, `metal`, `east`, `space`, `numbers`, `num`) | `/Dirt-Samples/` | Dirt-Samples, outside my area |

The prebake has no other acoustic map. The `strudel.cc` names people copy from examples (`sax`, `vibraphone`, `marimba`, `conga`, `kawai`, `harp`...) are **VCSL keys**. If Oak mirrors a subset of `vcsl.json` under the same keys, code copied from strudel.cc runs unchanged.

The CDN serves VCSL files byte-identical to GitHub. I checked `Vibes_hard_A2_v3_rr1_Main.wav`: both are 1,907,772 bytes, RIFF/WAVE, 16-bit, 44.1 kHz, stereo.

Two defects in upstream `vcsl.json` that the mirror must handle:
- The 8 `tom_mallet` paths are missing the `Membranophones/` prefix, so those files 404.
- The `harp` paths contain raw spaces that are not %-encoded.

## 1. VCSL: Versilian Community Sample Library — RECOMMEND (core of the upgrade)

- URL: https://github.com/sgossner/VCSL (map: https://strudel.b-cdn.net/vcsl.json)
- Licence: CC0 1.0. I read https://raw.githubusercontent.com/sgossner/VCSL/master/LICENSE ("CC0 1.0 Universal"). The README says "This collection is under a Creative Commons 0 license."
- Contents: 4,550 files, 6.16 GB in the repo. The strudel map has 128 keys covering 2.58 GB of WAV.
  - Format: 44.1 or 48 kHz, 16 or 24-bit WAV, mostly stereo, as the README's contribution standard states.
  - Design, per the README: wholetone sampling where possible, "most articulations only have a single round robin and two to three velocity layers".
  - It has **no** guitars, basses, bowed strings, brass, Rhodes, choir or clav.
- Loading: `samples('<pack>/vcsl.json', '<pack>/VCSL/')`, the same as strudel.cc. Pitched keys are note-name objects (`{ "A2": "...wav" }`) that superdough repitches to the nearest note. Unpitched keys are arrays indexed by `n`.
- Quality: these are Versilian Studios' own recordings, cut for "lightweight sample library creation". FreePats reuses VCSL for its own CC0 saxophone, conga and claves banks. This is a reputable reuse, but it is not a review.
- Fixes for current GM instruments, with raw WAV size of the map entry:

| Oak alias / need | VCSL key | files | raw WAV |
|---|---|---|---|
| `tenor` (GM tenor sax) | `sax` (Brett tenor, non-vib, 23 pitches A#1–E5), `sax_vib` (19), `sax_stacc` (23) | 23 / 19 / 23 | 50.3 / 33.8 / 3.6 MB |
| `vibes` (GM vibraphone) | `vibraphone` (hard mallets), `vibraphone_soft`, `vibraphone_bowed` (F2–E5) | 11 / 11 / 6 | 21.9 / 24.6 / 15.4 MB |
| mallets | `marimba` (F1–C6), `glockenspiel` (G4–C7), `xylophone_{soft,medium,hard}_{pp,ff}` | 10 / 7 / 8 each | 10.4 / 5.1 / ~4.5 each MB |
| other pitched | `harp` (concert), `kalimba`..`kalimba5`, `harmonica`, `tubularbells`, `handchimes`, `pipeorgan_quiet` | 23 / 11–25 / 9 / 9 / 19 / 21 | 35 / 15–34 / 5.6 / 30 / 43 / 45 MB |
| world percussion | `conga` 34, `bongo` 28, `cajon` 18, `darbuka` 20, `framedrum` 18, `shaker_small` 16, `shaker_large` 6, `tambourine` 7, `tambourine2` 7, `clave` 6, `cabasa` 6, `guiro` 5, `agogo` 5, `cowbell` 13, `woodblock` 10, `triangles` 37, `slitdrum` 6, `belltree` 6 | | 4.9, 6.8, 4.2, 2.5, 6.5, 1.8, 1.4, 6.5, 6.3, 1.2, 1.0, 1.5, 1.4, 2.7, 2.5, 32.5, 1.5, 4.7 MB |
| FM keys (CC0) | `fmpiano`, `piano1`, `clavisynth` (Yamaha TX81Z renders, C0–C8) | 22 / 22 / 19 | 23.5 / 13.6 / 12.3 MB |

- Size: a sensible subset is sax, sax_stacc, vibraphone, vibraphone_soft, marimba, glockenspiel, one xylophone, harp, kalimba, harmonica and the world-percussion row. That is about 210 MB of WAV. It needs **transcoding** (mp3/ogg at about 160 kb/s stereo is roughly 9× smaller), tail trimming and pruning of round robins and velocities to fit Oak's ~30 MB pack: about 15–25 MB after processing.
  - Oak's mirror is currently byte-for-byte. Transcoding would be a new "derived" step; the lock already has `derived: true`.
- Verdict: **RECOMMEND**. It is CC0, it is the exact library strudel.cc uses, and it fixes `tenor`, `vibes`, mallets and world percussion.

## 2. VSCO 2 Community Edition (Versilian Studios Chamber Orchestra 2 CE) — RECOMMEND (strings, brass, winds, upright pizz)

- URL: https://github.com/sgossner/VSCO-2-CE (info: https://versilian-studios.com/vsco-community/)
- Licence: CC0 1.0. I read https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/LICENSE ("CC0 1.0 Universal").
- Contents: 3.24 GB of WAV in total. The README says "Recorded by Sam Gossner & Simon Dalzell". Relevant folders, from the git tree:

| need (Oak alias) | folder | files | raw WAV |
|---|---|---|---|
| `strings` | `Strings/Violin Section/susVib` | 22 | 46.0 MB |
| | `Strings/Viola Section/susvib` | 26 | 71.7 MB |
| | `Strings/Cello Section/susvib` | 27 | 72.6 MB |
| | section pizz (`Violin Section/Pizz`, `Viola Section/pizz`, `Cello Section/pizzT`) | 44 / 46 / 52 | 9.0 / 15.0 / 34.8 MB |
| | spiccato and tremolo | (each) | 9–52 MB |
| `upright` (alternative) | `Strings/Solo Contrabass/Pizz` | 40 | 20.8 MB |
| `trumpet` | `Brass/Trumpet/sus`, `susvib`, `stac` | 20 / 22 / 66 | 40.5 / 21.6 / 14.6 MB |
| `mutetpt` | `Brass/Trumpet/harmonM-sus` (harmon mute), `straightM-sus` | 16 / 16 | 18.5 / 24.4 MB |
| `horns` (section built by layering) | `Brass/Tenor Trombone/sus`, `stac`; `Brass/F Horn/sus`, `stac`; `Brass/Tuba` | 31 / 56; 29 / 54; 87 | 60.1 / 13.4; 50.6 / 13.2; 40.6 MB |
| `flute` | `Woodwinds/Flute/susvib`, `stac` | 13 / 48 | 25.2 / 10.2 MB |
| clarinet / oboe / bassoon | `Woodwinds/*` | | 66 / 66 / 69 MB |
| mallets (duplicates VCSL) | `Percussion/Glock`, `Marimba`, `Xylo` | | |

- Loading: there is no strudel.cc map. Oak would write its own map, for example `{ "strings": { "A2": "Strings/Violin Section/susVib/VlnEns_susVib_A2_v1.wav", ... } }`. Pick one dynamic (`v1` or `v2`) and one round robin per pitch.
  - A single `strings` key can span cello (low), viola (mid) and violin section (high), because superdough picks the nearest pitch key.
  - `horns` can be a Strudel `stack()` of trumpet + trombone + VCSL `sax`, or a pre-mixed render, though that is extra work.
- Quality: these are chamber-size sections (a "chamber orchestra"), so expect them to sound thinner than a Hollywood string library. They are a large upgrade on GM `0480_Aspirin`. Harmon-mute trumpet is the idiomatic jazz muted sound.
- Verdict: **RECOMMEND**. It is CC0 and covers `strings`, `trumpet`, `mutetpt`, `flute`, the components of a `horns` section, and a CC0 upright pizz.

## 3. Electric keys (Rhodes, Wurlitzer, organ, clav)

### 3a. jRhodes3c / jRhodes3d (Jeff Learman, 1977 Rhodes Mark I Stage 73) — RECOMMEND (CC-BY, attribution required)
- URLs: https://github.com/sfzinstruments/jlearman.jRhodes3d (full-length) and https://github.com/sfzinstruments/jlearman.jRhodes3c (looped)
- Licence: read https://raw.githubusercontent.com/sfzinstruments/jlearman.jRhodes3d/HEAD/LICENSE.
  - Samples: "the jRhodes samples are licensed under CC BY 4.0". Control files are CC0.
  - Required credit: state that the samples are "from (or based on) jRhodes3d - https://github.com/sfzinstruments/jlearman.jRhodes3d", for example in an About/credits screen.
- Contents (README): "67 16-bit full-length samples, with up to 5 velocity layers, sampling every 4th white key", recorded "directly from the harp connector", FLAC.
  - 3d: mono, 65 files, 22.9 MB FLAC. Stereo (`-ST`) is 37.9 MB and stereo vibrato (`-SV`) is 34.3 MB. Samples run up to 25 s.
  - 3c: looped stereo, 130 files, 17.5 MB.
- Loading: Oak's own map. Take one middle velocity layer per sampled pitch, about 13 files, so roughly 4–5 MB FLAC, or about 1–1.5 MB as trimmed mp3. Superdough decodes FLAC in Chromium/Electron, but mp3 matches the existing pack.
- Quality (author's description): "recorded with EQ, with a treble boost and low-mid scoop, emphasizing the bell tones, and with substantial bark on the higher velocity layers". That is the classic soul/lo-fi Rhodes character.
- Verdict: **RECOMMEND** for `rhodes`. This is a real Rhodes, against the GM `0040_FluidR3_GM`. It needs one attribution line next to the Salamander one.

### 3b. Greg Sullivan's E-Pianos (Wurlitzer EP200, Hohner Pianet T, Yamaha CP80) — MAYBE
- URL: https://github.com/sfzinstruments/GregSullivan.E-Pianos
- Licence: read the repo LICENSE ("Attribution 3.0 Unported", CC-BY 3.0). The README says the instruments are mapped "with the author permission with the request for attribution".
- Contents: FLAC files. Wurlitzer EP200 is 42 files / 2.4 MB, Pianet T is 49 / 8.0 MB and CP80 is 81 / 11.0 MB. Versions date from 1999–2004.
- Loading: Oak's own map.
- Quality: these are old (1999) and small. I could not assess quality from a reputable review.
- Verdict: **MAYBE**. It is the only redistributable Wurlitzer I found, it is tiny, and it needs attribution. Audition it first.

### 3c. FreePats Electric Organ (setBfree drawbar-organ renders) — RECOMMEND
- URL: https://freepats.zenvoid.org/Organ/electric-organ.html
- Licence: read on that page: "Published under the terms of the Creative Commons CC0 1.0 public domain dedication."
- Contents: three banks, all rendered from setBfree, a free Hammond (tonewheel) emulator.
  - Drawbar organ, by Roberto (FreePats): SFZ+WAV, 5.8 MiB.
  - Percussive organ, by the Strix SoundFont Team: 12 MiB.
  - Rock organ, by the Strix SoundFont Team: 12 MiB.
- Loading: Oak's own map, built from the SFZ regions: one WAV per sampled pitch.
- Quality: these are renders of a respected tonewheel emulator. The page itself recommends running setBfree live for best quality.
- Verdict: **RECOMMEND** for `organ`, alongside the GM drawbar. It is CC0 and small. An Oak-rendered alternative would be to render setBfree or Oak's own additive drawbar synth offline (CC0 by construction).

### 3d. Clavinet — no redistributable multisample found
- My searches found no free D6 clavinet with a stated CC0 or CC-BY licence. Every free one I found was "free download" with no licence, or locked to Kontakt or Zampler.
- VCSL `clavisynth` (a TX81Z FM clav, CC0, 19 files, 12.3 MB WAV) is the nearest CC0 option.
- Verdict: **MAYBE** for VCSL `clavisynth`. Otherwise keep GM `clav`, or render an Oak clav offline from Strudel's own synths.

## 4. Basses

### 4a. FreePats Clean Electric Bass "Bass Guitar YR" (Yamaha RBX, by Andrea Biasior) — RECOMMEND
- URL: https://freepats.zenvoid.org/ElectricGuitar/clean-electric-bass.html
- Licence: read on that page. It was sent "under the terms of the Creative Commons CC0 1.0 public domain dedication".
- Contents: a pick variation (SFZ+FLAC 2.7 MiB, WAV 4.5 MiB) and a finger variation (FLAC 3.1 MiB, WAV 5.1 MiB). Version 2019-09-30.
- Loading: Oak's own map from the SFZ.
- Verdict: **RECOMMEND** for `ebass` (pick) and `fingerbass` (finger). It is CC0, tiny, and a real bass guitar replacing GM fonts.

### 4b. Karoryfer Sneakybass (1958 Otto Rubner double bass, pizzicato) — RECOMMEND
- URL: https://github.com/sfzinstruments/karoryfer.sneakybass
- Licence: read the repo LICENSE ("CC0 1.0 Universal"). The readme says "Royalty-free for all commercial and non-commercial use. CC-0 license."
- Contents: 660 WAV files, 415 MB. The `finger` folder has 148 files (94.7 MB) and there are also `pluck`, `mute`, `ghost` and `noise`. Four round robins per note.
- Quality (readme): "played pizzicato and very quietly. Think sneaky late night practice." The player is Drogomir Smolken.
- Loading: Oak's own map. One RR per pitch at about a minor third apart is roughly 12 files, about 8 MB WAV or about 1 MB mp3.
- Verdict: **RECOMMEND** for `upright` in a jazz/soul context: a warm, soft pizz.

### 4c. D. Smolken double bass (same instrument, arco + pizz) — RECOMMEND (alternative to 4b)
- URL: https://github.com/sfzinstruments/dsmolken.double-bass
- Licence: read the LICENSE ("CC0 1.0 Universal"). The readme says "Royalty-free for all commercial and non-commercial use."
- Contents: `pizz` 129 files / 121 MB, `arco` 159 / 116 MB, plus noises. WAV.
- Verdict: **RECOMMEND** if a louder, more articulate pizz than Sneakybass is wanted. Audition both.

### 4d. Karoryfer Meatbass (same bass; arco + pizz with 4 velocities and 4 RRs) — MAYBE
- URL: https://github.com/sfzinstruments/karoryfer.meatbass
- Licence: read, CC0. `Samples/pizz` is 264 files / 127 MB.
- Verdict: **MAYBE**. It duplicates 4b and 4c.

### 4e. Karoryfer Black And Blue Basses, Pastabass (Squier Bass VI), Growlybass, Swagbass, Fashionbass — MAYBE
- URLs: https://github.com/sfzinstruments/karoryfer.black-and-blue-basses and the sibling repos.
- Licence: CC0 per the GitHub licence field. I read Pastabass's LICENSE: CC0.
- Contents: large WAV sets. Black And Blue is 2,208 files / 1.12 GB, with round robins up to rr8.
- Verdict: **MAYBE**. They are good alternatives for funk or rock tone, but heavy to curate. 4a is enough to start.

### 4f. VSCO 2 CE Solo Contrabass Pizz — MAYBE
- See section 2: 40 files, 20.8 MB, CC0.
- Verdict: **MAYBE**, as an orchestral rather than jazz pizz.

## 5. Guitars

### 5a. FreePats FSBS Electric Guitar Clean #1 and Clean #2 (Jazz) — RECOMMEND
- URL: https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html
- Licence: read on that page: "Published under the terms of the Creative Commons CC0 1.0 public domain dedication."
- Contents: "direct sampling a Fender electric guitar", then processed through an amp/effects rack.
  - Clean #1: small SFZ+FLAC 3.0 MiB, full 118 MiB.
  - Clean #2 (Jazz): small 2.4 MiB, full 63 MiB.
  - An unprocessed DI version is also offered.
  - Version 2026-08-07.
- Verdict: **RECOMMEND** for `cleangtr` (Clean #1, small) and as an option for `jazzgtr` (Clean #2 Jazz, small).

### 5b. FreePats FSBS Electric Guitar Distorted #1 / #2 — MAYBE
- URL: https://freepats.zenvoid.org/ElectricGuitar/distorted-electric-guitar.html
- Licence: read, CC0.
- Contents: #2 is 129 MiB as FLAC and #1 is 300 MiB. There is no small version, so a subset would have to be cut.
- Verdict: **MAYBE** for `crunch`. It is CC0 but heavy to curate. An alternative is to run Oak's 5a samples through Strudel's `distort`/`shape`.

### 5c. Karoryfer Shinyguitar (archtop, played and mapped by D. Smolken) — RECOMMEND for `jazzgtr`
- URL: https://github.com/sfzinstruments/karoryfer.shinyguitar
- Licence: read the LICENSE ("CC0 1.0 Universal"). The readme says it is "royalty-free for all commercial and non-commercial use".
- Contents: an archtop guitar recorded on both a magnetic pickup (`Samples/electric`, 423 files, 230 MB) and a microphone (`Samples/acoustic`, 423 files, 230 MB). WAV.
- Verdict: **RECOMMEND** for `jazzgtr`. An archtop is the jazz guitar. Curate about 12–15 pitches from one layer.

### 5d. Karoryfer Emilyguitar (Epiphone, flatwounds, DI) and Black And Green Guitars (Gretsch Anniversary, Hofner Club) — MAYBE
- URLs: https://github.com/sfzinstruments/karoryfer.emilyguitar and https://github.com/sfzinstruments/karoryfer.black-and-green-guitars
- Licence: read both LICENSE files: CC0.
- Contents:
  - Emily: "All samples recorded direct", d'Addario Chromes flatwounds, 216 note files (121 MB), plus power/major/minor chord samples.
  - Black/Green: 1,776 files, 578 MB.
- Verdict: **MAYBE**. Emily's DI samples need amp colouring. The Gretsch is a good indie/rock option.

### 5e. Acoustic steel-string guitar — no clean option found
- FreePats FSS Steel-String Acoustic Guitar: https://freepats.zenvoid.org/Guitar/steel-acoustic-guitar.html. Licence read on the page: "GNU General Public License version 3 or later, with a special exception". The exception text is at https://freepats.zenvoid.org/licenses.html#GPL_exception.
  - The exception only frees *compositions* that use the sounds.
  - Shipping the samples inside Oak means distributing GPLv3 works. The sample files, including any transcoded or trimmed derivatives, must be offered under GPLv3, with the licence text and the "source": the preferred form for modification, meaning the original WAVs or SFZ.
  - Oak's code is very likely "mere aggregation" and not bound, but this is the kind of copyleft obligation the brief excludes. FreePats itself has deprecated this licence.
  - Verdict: **AVOID**.
- FreePats Nylon-String (Spanish classical): https://freepats.zenvoid.org/Guitar/acoustic-guitar.html. Licence read: CC0. SFZ+FLAC 4.5 MiB. The page admits "The recording conditions were far from ideal". Verdict: **MAYBE**, for nylon or bossa only.
- Karoryfer Shinyguitar's microphone layer (5c) is the best CC0 *acoustic-sounding* guitar I found, although it is an archtop rather than a dreadnought. Verdict: **MAYBE** for `acgtr`. Otherwise keep GM `acgtr`.

## 6. Saxophone, brass and other winds

### 6a. VCSL tenor sax (`sax`, `sax_vib`, `sax_stacc`) — RECOMMEND (see section 1)

### 6b. Karoryfer Weresax (alto) and Bear Sax (1926 Conn baritone) — MAYBE
- URLs: https://github.com/sfzinstruments/karoryfer.weresax and https://github.com/sfzinstruments/karoryfer.bear-sax
- Licence: read both LICENSE files: CC0. Bear Sax's readme says "Royalty-free for all commercial and non-commercial use."
- Contents: Weresax is 256 WAV / 202 MB. Bear Sax is 755 WAV / 143 MB, with sustain, marcato, staccato, subtone and growl.
- Verdict: **MAYBE**. A bari sax is useful for funk/soul horn sections. An alto would be nice-to-have.

### 6c. MTG Solo Saxophones (soprano, alto, tenor, baritone) — MAYBE (CC-BY)
- URL: https://github.com/sfzinstruments/MTG.SoloSax
- Licence: read the repo LICENSE and README: "Creative Commons Attribution 4.0 International License".
  - It is built from MTG's freesound packs 20251, 20239, 20247 and 20253. I did **not** read the licences of those freesound packs myself, so that upstream licence is *could not verify*.
- Contents: 737 FLAC files, 110.8 MB, "24 bit, 48 kHz, Mono", looped, with 2–3 velocity layers.
- Verdict: **MAYBE**. Use it only if VCSL's tenor is not enough, and check the freesound pack licences first.

### 6d. Brass section for `horns`
- No CC0 *section* recording found.
- Build it from VSCO 2 CE trumpet + tenor trombone (+ VCSL sax), either layered at runtime or pre-rendered by Oak as a CC0 derivative.
- See section 2.

## 7. Choir / vocal "oohs"
- No CC0 or CC-BY choir multisample found.
  - The sfzinstruments vocals page (https://sfzinstruments.github.io/vocals) lists Karoryfer's Hadzi-Fia, Hadzi-Hevi, Hadziha, Hster and Torgbe as **Commercial**.
  - 272 Merry Orks is CC0, but it is orc/creature voices.
- https://github.com/sfzinstruments/legato_vocal_tutorial: its LICENSE is CC0 1.0 (read). It holds "the a vowel from the Hadzi-Fia sample library". I could not list its sample folder because the GitHub API rate limit was hit, so its contents and size are *could not verify*. Verdict: **MAYBE**, as a single solo "aah" voice, not a choir.
- Verdict for `choir`: keep the GM choir for now, or render an Oak formant-synth "ooh" (CC0 by construction).

## 8. World percussion
- VCSL (section 1) covers congas, bongos, cajon, darbuka, frame drum, shakers, tambourines, claves, cabasa, guiro, agogo, cowbell, woodblock, triangles and slit drum. **RECOMMEND**.
- FreePats World and Rare Percussion: https://freepats.zenvoid.org/Percussion/world-and-rare-percussion.html.
  - Licence read: CC0.
  - Contents: cajón flamenco, bongos, egg shaker, tambourine, hand clap, claves, castanets, conga, maracas and darbuka. SFZ+FLAC 6.6 MiB, "Round-robin and randomized layers".
  - Verdict: **RECOMMEND**, as a small second flavour (egg shaker, maracas, castanets).
- Karoryfer body_percussion: https://github.com/sfzinstruments/body_percussion.
  - Licence read: CC0.
  - Contents: 202 WAV, 61.7 MB, "Stereo, 44.1 kHz 24-bit", 4–6 round robins (claps, stomps, snaps).
  - Verdict: **MAYBE**.
- Tabla: no redistributable tabla multisample found. Verdict: could not verify any source.
- Mridangam (strudel.cc `mridangam.json`, https://github.com/yaxu/mrid): README "Samples (c) Arthur Carabott 2022 ... creative commons attribution share-alike". There is no version number and no LICENSE file.
  - Shipping it means the pack's mridangam files, and any trimmed or transcoded version of them, must stay CC-BY-SA. That requires attribution, a licence link, a note of changes, and no added restrictions on those files.
  - Oak's code and other samples are a "collection", not an adaptation, so they are not bound.
  - Verdict: **AVOID** for now, given the unversioned licence; MAYBE if Oak wants it and labels it.

## 9. Others in my area that I checked

| source | licence (as read) | verdict |
|---|---|---|
| University of Iowa MIS, https://theremin.music.uiowa.edu/MIS.html | page text: "may be downloaded and used for any projects, without restrictions" (no formal licence) | **MAYBE**. Permissive, but not a named licence. Pre-2011 files are 16/44.1 mono chromatic *runs* that must be sliced; post-2011 files are 24/96 single notes, recorded in an anechoic chamber (dry). VSCO and VCSL cover the same instruments under CC0. (Karoryfer's CC0 Scarypiano is built from Iowa piano samples.) |
| Philharmonia sound samples, https://philharmonia.co.uk/resources/sound-samples/ | "must not be sold or made available 'as is'" (as samples or a sampler instrument) | **AVOID**. A sound pack is exactly "made available as samples". |
| Salamander Drumkit (Alexander Holm), https://github.com/endolith/Salamander-Drumkit (originals at archive.org/details/SalamanderDrumkit) | readme: "Licence: CC BY-SA" (3.0). The share-alike "only applies if you modify the samples themselves or create new sample libraries" | **AVOID**. A curated, trimmed pack *is* a new sample library, so those files would have to be CC-BY-SA 3.0 (attribution, licence link, change note, no added restrictions). Not my area, but sfzinstruments' `virtuosity_drums` (Versilian + Karoryfer, CC0 per GitHub) is a CC0 acoustic kit to pass to the drums researcher. |
| Sonatina Symphonic Orchestra | **could not verify** (reported as CC Sampling Plus 1.0, a retired licence) | **AVOID**. VSCO 2 CE is CC0 and covers it. |
| Terkelsen Marimba, Damien's Funky Guitar, OvationGuitar, Discord-SFZ-GM-Bank, Ethan Winer SoundFonts (sfzinstruments) | no LICENSE file; the READMEs state no licence (**could not verify**) | **AVOID**. Unknown licence. |
| Karoryfer x bigcat Cello, https://github.com/sfzinstruments/karoryfer-bigcat.cello | read LICENSE: CC0 ("royalty-free for all commercial and non-commercial use") | **MAYBE**. A solo cello: sus 136 WAV / 86 MB, pizz 52 / 16 MB, staccato 270 / 29 MB. A nice solo line for soul ballads. |
| VCSL `kawai` / `steinway` | CC0 | **AVOID** for now. Salamander already covers piano and these are 142–256 MB. |

## 10. Proposed mapping (replace GM aliases with CC0 or CC-BY instruments)

| Oak alias (now GM) | proposed source | licence | est. size after curation + mp3 |
|---|---|---|---|
| `rhodes` | jRhodes3d mono, 1 velocity layer | CC-BY 4.0 | ~1.5 MB |
| `upright` | Karoryfer Sneakybass `finger` (or Smolken `pizz`) | CC0 | ~1 MB |
| `ebass`, `fingerbass` | FreePats Clean Electric Bass, pick and finger | CC0 | ~1 MB each |
| `organ` | FreePats Electric Organ, drawbar (+ rock) | CC0 | ~1–2 MB |
| `cleangtr` | FreePats FSBS Clean #1, small | CC0 | ~1 MB |
| `jazzgtr` | Karoryfer Shinyguitar `electric` (or FSBS Clean #2 Jazz) | CC0 | ~1.5 MB |
| `crunch` | FSBS Distorted #2 subset (or Clean + `shape`) | CC0 | ~1.5 MB |
| `acgtr` | keep GM, or Shinyguitar `acoustic` | CC0 | ~1.5 MB |
| `strings` | VSCO 2 CE cello + viola + violin section susvib | CC0 | ~3–4 MB |
| `trumpet`, `mutetpt` | VSCO 2 CE Trumpet `sus` / `harmonM-sus` | CC0 | ~2 MB each |
| `horns` | stack of VSCO trumpet + trombone + VCSL sax (or Oak pre-render) | CC0 | ~2 MB |
| `tenor` | VCSL `sax` | CC0 | ~3 MB |
| `vibes` | VCSL `vibraphone` / `vibraphone_soft` | CC0 | ~2–3 MB |
| `flute` | VSCO 2 CE Flute `susvib` | CC0 | ~1.5 MB |
| `clav`, `choir` | keep GM (no redistributable source found) | — | — |
| new | VCSL `marimba`, `glockenspiel`, `harp`, `kalimba`, `harmonica` and the world-percussion keys under strudel.cc names | CC0 | ~10–15 MB |

The size estimates are mine, not measured. They assume one velocity layer, one round robin, a pitch every 3–4 semitones, tails trimmed to ≤4 s, and mp3 at 128–160 kb/s.

Attribution list to add if CC-BY items are taken:
- Salamander Grand Piano (Alexander Holm, CC-BY 3.0), already shipped.
- jRhodes3d (Jeff Learman, CC-BY 4.0, with the link above).
- Greg Sullivan E-Pianos (CC-BY 3.0), only if 3b is taken.
- MTG Solo Saxophones (CC-BY 4.0), only if 6c is taken.

Pipeline notes for the implementer (no files were changed):
- The sfzinstruments and FreePats sets ship SFZ. The pitch of each WAV is in the SFZ `pitch_keycenter` (or in the file name, e.g. `gb4`), which the mirror can parse to build note-keyed maps.
- Superdough plays one file per note key: no velocity layers and no round robins on pitched maps. Pick the mf layer.
- Every new source pins to a commit SHA (the git tree API gives exact byte sizes) and goes into `pack.lock.json` with sha256, like the existing groups.
