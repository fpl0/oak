# Oak sound pack: drum machines and drum kits (research, 2026-11-24)

Scope: what Oak could vendor into the self-hosted pack (`/sounds/<ver>`, mirrored by
`scripts/sounds/mirror.ts` from `pack.config.ts`). The pack ships inside a public macOS release, so every
file must be redistributable. Licences were read at the URLs given. "Could not verify" means I did not
read a licence text myself.

Short quotes from licence texts are under 15 words.

---

## 0. Headline findings

1. **Karoryfer / Versilian drum libraries on `github.com/sfzinstruments` are CC0, and they are the best
   source by far.** Each repo has a LICENSE file holding the CC0 1.0 legal code. Between them they cover a
   jazz kit played with sticks (Virtuosity Drums, with a "lofi" mic position), brushes (Swirly Drums, Big
   Rusty Drums, Frankensnare), a rock kit (Big Rusty, Unruly) and aux percussion. All are multi-mic, so
   Oak would mix chosen hits down to one-shots offline, much as it already renders `brk`.
2. **eddyflux/crate cannot ship.** It is 367 WAVs (about 184 MB) with no licence, no README and no stated
   source. The file names (`snare-aprilshowers-1.wav`, `kick-takecare-1.wav`) look like they come from
   other sample packs. AVOID. Oak can build its own CC0 "crate" with the same roles (see section 6).
3. **ritchse/tidal-drum-machines has no licence and says nothing about where its samples came from.**
   The README credits only the install script. The GitHub API reports `license: null`, and there is no
   LICENSE file. Do not add more banks. The 5 banks Oak already ships, plus the MC-303 bank behind the
   current `jazzkit`, are the biggest licence risk in the pack. The CC0 kits below can replace them.
4. **Strudel's "other sample repos" are not clean.** `yaxu/clean-breaks` is 33 breaks taken from commercial
   records (Amen, Funky Drummer, Apache, Impeach the President...), with no licence. Dirt-Samples has no
   licence. AVOID both.
5. **For the electronic style (909/808/606 acid):** no CC0 recording of a classic machine has clean
   provenance. The safest path is for **Oak to synthesise its own 808/909/606/CR-78-style voices offline**,
   which makes them CC0 by construction. A few freesound packs that people recorded from their own analog
   machines can add character (MAYBE, check each sound).

---

## 1. Already in or near Strudel (sample maps exist)

### 1.1 ritchse/tidal-drum-machines (the 66 banks Oak does not ship)
- URL: https://github.com/ritchse/tidal-drum-machines ; strudel map https://strudel.b-cdn.net/tidal-drum-machines.json
- Licence: **none**. No LICENSE file, the README says nothing about provenance, and the GitHub API reports
  `license: null`. Read at the repo page and through the API. The README's only credit is to "Julian" for
  the installation script.
- Contents: 73 machine folders upstream (71 banks in the Strudel map, plus EmuSP12, which has its own map).
  File counts per bank from the map include YamahaRM50 485, RolandMC303 148, RolandTR808 122, YamahaRY30 84,
  RolandTR909 74, EmuSP12 68, SimmonsSDS5 64, RolandJD990 62, RolandSystem100 62, AkaiXR10 57, AlesisSR16 52,
  RolandR8 52, BossDR550 47, KorgM1 44, RolandS50 43, RolandSH09 43 (all bd), ViscoSpaceDrum 40,
  KorgMinipops 32, RolandTR626 30, RolandMT32 30, LinnDrum 28, RolandDDR30 24, LinnLM2 23, AkaiMPC60 21,
  OberheimDMX 20, RolandCompurhythm78 20, SimmonsSDS400 20, Linn9000 20, LinnLM1 17, MPC1000 17,
  RolandTR505 16, RolandTR707 14, RolandCompurhythm8000 13, RolandTR606 7, and so on. The format is WAV.
- Loading: `samples('https://strudel.b-cdn.net/tidal-drum-machines.json', '<base>/machines/')`, then
  `.bank("RolandTR606")` and the like. mirror.ts already handles this.
- Quality: these are the de-facto Strudel defaults, and many are hardware or ROM captures. Several
  downstream projects treat the collection as unlicensed and fetch it only on the user's machine
  ("redistribute: false"; see github.com/iheitlager/algo-synth issues 573, 577, 579). Those are
  second-hand opinions, not a licence.
- **Verdict: AVOID** adding banks: no licence and unknown provenance. Also consider retiring the 5 shipped
  banks and the MC-303 `jazzkit` (see section 7).

### 1.2 eddyflux/crate
- URL: https://github.com/eddyflux/crate (`strudel.json` at the root, `_base` raw.githubusercontent.com/eddyflux/crate/main/)
- Licence: **none**. There is no LICENSE file and no README. The GitHub API reports `license: null`, and
  the repo has one commit, from 2024-01-05.
- Contents, from its strudel.json: 18 keys and 367 WAVs, about 184 MB in all (git tree sizes).
  crate_sd 54, crate_bd 53, crate_hh 49, crate_perc 40, crate_cp 37, crate_oh 34, crate_rd 20, crate_cr 16,
  crate_sh 15, crate_conga 11, crate_tb 8, crate_block 7, crate_stick 6, crate_djembe 4, crate_clave 4,
  crate_bongo 4, crate_rim 3, crate_bell 2.
- File names carry suffixes that look like product or kit names (`snare-aprilshowers`, `kick-introvert`,
  `closedhh-lovesong`, `crash-sunrise`, `conga-hangten`...). This suggests the samples were gathered from
  third-party lo-fi packs. That is an inference; no source is stated anywhere.
- Loading: `samples('github:eddyflux/crate')`, then `.bank("crate")`.
- **Verdict: AVOID**: no licence, and the source is probably commercial packs. Oak should build its own
  CC0 kit with the same role names (section 6).

### 1.3 tidalcycles/uzu-drumkit (already shipped)
- https://github.com/tidalcycles/uzu-drumkit. The GitHub API reports `license: Unlicense`. Already in pack v3. Nothing new to do.

### 1.4 VCSL (Versilian Community Sample Library): acoustic percussion
- URL: https://github.com/sgossner/VCSL ; strudel map https://strudel.b-cdn.net/vcsl.json (base `${CDN}/VCSL/`)
- Licence: CC0. Read at https://raw.githubusercontent.com/sgossner/VCSL/master/LICENSE: "CC0 1.0 Universal".
  The Strudel prebake comment also says "LICENSE: CC0 general-purpose".
- Drum-relevant keys and file counts in vcsl.json: bassdrum1 8, bassdrum2 30 (concert bass drum),
  snare_modern 72, snare_hi 8, snare_low 20, snare_rim 4, tom_stick 8, tom_mallet 8, tom_rim 6,
  tom2_stick/mallet/rim 8/8/6, hihat 15, clap 10, sus_cymbal 25, sus_cymbal2 23, clash 10, bongo 28,
  conga 34, darbuka 20, framedrum 18, cajon 18, clave 6, cowbell 13, woodblock 10, tambourine 7,
  tambourine2 7, shaker_small 16, shaker_large 6, cabasa 6, guiro 5, agogo 5, triangles 37, vibraslap 4,
  slitdrum 6, oceandrum 3. The format is WAV, with an occasional mp3.
- Loading: an existing strudel.cc map. mirror.ts can mirror it with a `keep` filter, the same way it
  handles tidal-drum-machines.
- Quality: a well-known orchestral and world collection. The kick is an orchestral bass drum, not a
  drum-kit kick. Hand percussion is its strength.
- **Verdict: RECOMMEND** for the percussion roles (sh, tb, cb, conga, bongo, clave, woodblock, cajon, clap).
  It is the cheapest win: a map already exists and the licence is CC0. It is not a kit on its own.

### 1.5 Sonic Pi bundled samples (drum subset)
- URL: https://github.com/sonic-pi-net/sonic-pi/tree/main/etc/samples (README there lists the provenance of every file)
- Licence: the README says the Arovane samples are CC0, and that every other sample is from freesound,
  "placed in the public domain via the Creative Commons 0 License". Each file is linked to its freesound
  source.
- Contents: about 35 MB of FLAC for the whole folder. Drum one-shots: bd_* 15, sn_* 4, hat_* 21, ride_* 2,
  drum_* 20 (an acoustic kit by menegass), elec_* 26, perc_* 10, tabla_* 25, plus loops.
- Loading: a folder we would map ourselves (FLAC decodes in Electron/Chromium).
- Caveats: `hat_bdu` comes from freesound user bdu's "Roland TR606 sampleset", whose sound descriptions say
  it is the fdiskc.com TR-606 set, so the CC0 is questionable. Skip it, along with `loop_amen`,
  `loop_amen_full` and `loop_breakbeat` (recordings of the Amen break and other breaks).
- **Verdict: MAYBE**. A small CC0 one-shot set that suits lo-fi or boom-bap layering. Check each freesound
  source link before vendoring.

---

## 2. CC0 acoustic kits (sfzinstruments org): the core recommendation

All repos below are on https://github.com/sfzinstruments. The GitHub API reports `CC0-1.0`, and I read the
start of each LICENSE file, which holds the CC0 1.0 legal code. Karoryfer made its formerly commercial drum
libraries free and open in April 2023 (KVR/sfz-site reports). The Swirly Drums changelog (1.104) says
"License changed to free." Every library is multi-mic (close/top/bottom/OH/room...), mono, 44.1 or 48 kHz,
16 or 24 bit, FLAC or WAV, mapped in SFZ. **Loading in Oak:** none has a Strudel map. Oak would pick hits,
**mix the mic channels down to one mono or stereo one-shot per hit** with a script (offline, like
`scripts/sounds/brk.ts`), trim and normalise them, and write its own `oak-*.json` map with Oak's
`DRUM_ROLES` keys (`<bank>_bd`, `<bank>_sd`...) so that `.bank("<bank>")` works. Mirror only the folders
needed: never the whole repos, which run to hundreds of MB or GB.

### 2.1 Virtuosity Drums (Versilian Studios + Karoryfer): jazz kit, sticks
- URL: https://github.com/sfzinstruments/virtuosity_drums ; LICENSE: https://raw.githubusercontent.com/sfzinstruments/virtuosity_drums/master/LICENSE
- Licence: CC0. The LICENSE file reads "CC0 1.0 Universal", and Versilian calls it "open source
  (Creative Commons 0)". It was a KVR Developer Challenge 2021 entry.
- Contents: the README calls it a "Contemporary Jazz drum kit... performed with sticks", recorded at
  Virtuosity Musical Instruments, Boston, with drummer Austin McMahon. Pieces: kick (snares on/off),
  snare (center, off-center, stickshot, rimshot, cross-stick, hand-muted, flam, buzz, roll), 2 toms,
  hi-hat (closed, open, pedal, half, 3/4, splash), ride + bell, flat ride, crash and sizzle crash.
  Aux percussion from VSCO 2 Pro and Karoryfer: cowbell, vibraslap, bongos, congas, tumba, timbales,
  agogo, cabasa, shaker, whistle, guiro, claves, woodblock, cuica, triangle.
- Files: 5,358 files, about 1.49 GB in the repo. 3,390 FLAC and 1,468 WAV. Mic positions `kickmic`,
  `snaremic`, `mid`, `oh`, `room` and **`lofi`**, each with 575 samples, plus `perc/` with 1,408.
  The probed file was FLAC, 24-bit, mono, 48 kHz.
- The `lofi` mic folder (about 136 MB) is a ready-made lo-fi colour for the coastline-style patch.
- Quality: KVR reviews describe it as a "very well-recorded jazz drum set", about 5,000 samples and 60
  articulations.
- **Verdict: RECOMMEND**. This should be Oak's acoustic and jazz kit (sticks). A mixdown of about 40 hits
  (4 velocities across bd, sd, rim, hh, oh, rd, rd-bell, cr, lt, ht) would come to about 5–8 MB.

### 2.2 Swirly Drums (Karoryfer): brushes
- URL: https://github.com/sfzinstruments/karoryfer.swirly-drums ; LICENSE: https://raw.githubusercontent.com/sfzinstruments/karoryfer.swirly-drums/main/license
- Licence: CC0. The file reads "CC0 1.0 Universal", and changelog 1.104 says "License changed to free".
  It was a paid product from 2018 (KVR, rekkerd).
- Contents: a kit played with brushes. KVR and rekkerd describe "playable, flexible snare swirls", plus a
  darbouka, djembe, bongos and cowbell played with brushes, china, broken crash, cracked splash, and a
  cajon used as a kick. Folders: snare_main 96, snare_edge 80, snare_dig 56, **snare_stir 32 (26 MB)**,
  snare_flutter 8, ride 60, hat_tight/closed/half/quarter/open/sizzling/foot/footsplash, crash, china,
  splash, toms (vhi, mhi, xmed, mlow, floor), marching_kick, cajon_kick, kick_buzz, hbongo, lbongo,
  djembe, darbouka, cowbell. There are also `wet` and `wetter` copies (about 1.5 GB) that Oak should skip.
- Total: 5,103 files, about 1.83 GB. The probed file was WAV, 16-bit, mono, 44.1 kHz, split by mic
  (`_top`/`_btm`).
- Caveat: it has no conventional kick (marching or cajon kick only). Pair it with the Virtuosity or Big
  Rusty kick.
- **Verdict: RECOMMEND** for the brush snare (hits, digs, **stir loops** for `s("stir").slow(2)`), the brush
  ride and the brush hats. It replaces the MC-303 "brushes" in the current `jazzkit`.

### 2.3 Big Rusty Drums (Karoryfer): vintage rock kit with sticks, brushes and mallets
- URL: https://github.com/sfzinstruments/karoryfer.big-rusty-drums ; LICENSE: https://raw.githubusercontent.com/sfzinstruments/karoryfer.big-rusty-drums/main/LICENSE
- Licence: CC0 ("CC0 1.0 Universal").
- Contents: KVR describes an oversized 1980s Polish kit (by Zygmunt Szpaderski). There are folders for
  every stroke type. snare_14: center, edge, rimshot, sidestick, **brush, bdig, bstir, bflutter,
  brelease**, mallet. hihat_14: closed, open, pedal, and `*_brush` variants. ride_22 and ride_sizzle_19:
  rd, bell, edge, **brush**, mallet. crash_17, crash_sizzle_17 and china_18, each with **brush** and
  mallet. kick_24 and kick_24_nodamp. Toms: 14, 15, 18 and 22.
- Files: 4,872 files, about 731 MB, mostly FLAC (4,366). Mics are cl, oh, top and btm. The probed file
  was FLAC, 16-bit, mono, 44.1 kHz.
- **Verdict: RECOMMEND**. It is the rock and indie kit (the `kick_24` is huge). It also gives a second,
  complete brush kit that includes brushed cymbals, which Swirly lacks in places.

### 2.4 Unruly Drums (Karoryfer)
- URL: https://github.com/sfzinstruments/karoryfer.unruly-drums. Licence CC0 (LICENSE begins "CC0 1.0 Universal").
- Contents: the repo describes "a drum kit where every drum has snare wires on it". Kick k20, snares
  s13/s14/s22, hi-hat h14 (455 samples per mic), ride r20, crash c16. 6,372 files, about 815 MB, FLAC.
- **Verdict: MAYBE**. It has a distinctive, buzzy garage or indie character. Use it as a second kit if
  pack size allows.

### 2.5 Frankensnare (Karoryfer)
- URL: https://github.com/sfzinstruments/karoryfer.frankensnare. The repo sidebar shows CC0-1.0, and the
  `license` file has the CC0 1.0 legal code (read via the repo page).
- Contents: many snare drums (10" to 22"; basic, rimshot, muted, prep, tamb, "symp_60s/80s") and **brush**
  sets (10_brush, 14d_brush, 20_brush, 22_brush). Mics are top, btm and oh. 4,058 files, about 436 MB.
- **Verdict: MAYBE**. Use it to vary snares (e.g. `sd:0..7`) and brush snares.

### 2.6 The Hat With The Phat (Karoryfer)
- URL: https://github.com/sfzinstruments/Karoryfer.TheHatWithThePhat. The GitHub API reports CC0-1.0.
- The README text says "Royalty-free for all commercial and non-commercial use". That wording is weaker
  than CC0, and I did not open the LICENSE file itself (could not verify that its text is CC0).
- Contents: a giant hi-hat made of two ride cymbals. 786 files, 983 MB.
- **Verdict: MAYBE**. It is a novelty, and the licence file should be read before using it.

### 2.7 body_percussion (sfzinstruments)
- URL: https://github.com/sfzinstruments/body_percussion. The README says "CC 0 license", and the GitHub
  API reports CC0-1.0.
- Contents: 202 WAV body sounds (claps, snaps, chest and thigh slaps), stereo, 44.1 kHz/24-bit, 4–6 round
  robins. About 233 MB.
- **Verdict: MAYBE**. Good organic claps and snaps for `cp` and foley.

### 2.8 CC-BY 4.0 kits (attribution list needed)
- **Naked Drums (Wilkinson Audio, SFZ port by kinwie)**: https://github.com/sfzinstruments/WilkinsonAudio.NakedDrums.
  The README carries a CC-BY 4.0 badge ("Creative Commons Attribution 4.0 International License"). Yamaha
  Recording Custom kit, 10 round robins, up to 5 velocity layers, 16 mic channels, FLAC, 4,288 files,
  about 1.29 GB. The README says the kit was "Originally available free in Kontakt nki format". I could
  not verify that Wilkinson Audio itself granted CC-BY rather than the porter. **MAYBE.**
- **DrumGizmo DRSKit**: https://drumgizmo.org/wiki/doku.php?id=kits:drskit. The page says "released under
  the Creative Commons Attribution 4.0 International License" and asks for attribution where performer
  credits appear. A handmade DRSDrums kit, "usable for everything from jazz to rock". 13 mic channels.
  There is also an SFZ port (stereo, FLAC) at https://github.com/sfzinstruments/DrumGizmo.DRSKit
  (CC-BY-4.0, about 736 MB). **MAYBE**. CC0 kits already cover this ground.
- **DrumGizmo MuldjordKit** (https://drumgizmo.org/wiki/doku.php?id=kits:muldjordkit, CC-BY 4.0, a Tama
  Superstar kit, "metal or rock") and **CrocellKit** (CC-BY 4.0, a metal kit, 5.5 GB). **AVOID** for Oak's
  genres: too heavy and metal-oriented.
- **kinwie Dim Cabasa** (https://github.com/sfzinstruments/kinwie.dim-cabasa): the API reports CC-BY-4.0.
  250 cabasa samples, 24-bit, 48 kHz. **MAYBE** for `sh`.

### 2.9 CC-BY-SA kits: what share-alike would require
- **AVL Drumkits (Glen MacArthur): Black Pearl, Red Zeppelin, Blonde Bop (sticks / Hot Rods), Buskman's
  Holiday percussion**. Site: http://www.bandshed.net/avldrumkits/. Licence PDF:
  http://bandshed.net/pdf/AVL-Drumkits%20CC-BY-SA%20License.pdf ("AVL-Drumkits CC-BY-SA 3.0 License").
  The PDF adds an exception: "produced music and other non-sample-library works can be licensed freely".
  Within it: "The by-sa condition is imperative if you modify the samples themselves or create new sample
  libraries"; attribution means keeping the authors' info and the readme; a fork must "release and
  distribute it under a different name".
  - What this means for Oak: trimming or remixing the hits into Oak's pack counts as modifying the samples
    and making a new sample library. **Those files** (not Oak's code) would have to be released under
    CC-BY-SA 3.0, ship the AVL readme, credit Glen MacArthur, and be named something other than "AVL
    Drumkits". Bundling them next to the app is aggregation, so the app's own licence is not bound, but
    the pack would then contain files under mixed licences.
  - Sizes from the SFZ downloads: AVL_Drumkits 1.1 about 29 MB, BLONDE_BOP_SFZ 18 MB, BLONDE_BOP_HR_SFZ
    16 MB. Each piece has 5–10 velocity layers (site text). The Hydrogen feed lists the Blonde Bop kits as
    "CC BY-SA".
  - **Verdict: MAYBE**. Good small kits, but CC0 libraries cover the same sounds without share-alike.
- **Salamander Drumkit (Alexander Holm)**: https://github.com/endolith/Salamander-Drumkit. The README says
  "Licence: CC BY-SA", with the same samples-only share-alike exception. A rock kit with many round
  robins and few velocity layers. The trimmed samples are 385 MB. **MAYBE / AVOID**: same share-alike
  issue, and no brushes.
- **Sam's Sonor** (https://github.com/sfzinstruments/SamsSonor): the README says CC-BY-SA 4.0.
  118 MB of FLAC. **AVOID**: share-alike, and nothing it offers is missing elsewhere.

### 2.10 Hydrogen drum kits
- Feed: http://hydrogen-music.org/feeds/drumkit_list.php (52 kits, each with a `<license>` field; read).
  The bundled kits in the repo, GMRockKit and TR808EmulationKit, have `<license>GPL</license>` in
  drumkit.xml.
- Licence breakdown:
  - GPL: GMRockKit, TR808EmulationKit, Forzee, Gimme A Hand, The Black Pearl 1.0, BeatBuddy.
  - Blank or missing: about 20 kits by Artemiy Pavlov ("(sf)").
  - "Do not redistribute": GSCW 1/2, and the Roland_MC-307 kits by Michael Wolkstein.
  - All rights reserved: JazzFunkKit (Orange Tree Samples).
  - CC-BY-SA: BJA_Pacific, circAfrique, Denon CRB-90, the AVL 2023 kits.
  - CC-BY: rumpf_kit_z01, and five kits by Guilherme Passos named after famous drummers (Dave Grohl, John
    Bonham...). Those names make it likely they were sampled from records. I could not verify.
  - CC0: Audiophob ("Cheap sounds from freesound.org", dubstep).
- GPL samples: redistributing them means the sample files go out under GPL with source (for a WAV, the
  WAV is effectively the source). Most people do not read that as binding the app, but it is untidy.
- **Verdict: AVOID** as a source, apart from the AVL kits (section 2.9) and perhaps rumpf_kit_z01 (CC-BY 3.0,
  not inspected).

---

## 3. Drum machines (electronic style)

### 3.1 freesound.org packs (per-sound licences; check each sound)
Freesound licenses each sound separately. The packs below appeared under the "Creative Commons 0" search
filter (read at freesound search pages). That is not a per-file guarantee, so confirm every sound page
before download. Downloads need a freesound login; the API needs a key or OAuth that the owner would set
up. Prefer packs whose uploader recorded their own machine:
- **"Modified 606"** by oceansonmars (https://freesound.org/people/oceansonmars/packs/44238/): 40 sounds,
  "Sounds made using a Modified TR 606 Drum Machine". The profile says the uploader collects drum
  machines. **MAYBE** (modified, so not stock 606).
- **"CR78 Drum Kit"** by oceansonmars (https://freesound.org/people/oceansonmars/packs/39611/): CR-78 loops
  plus a few one-shots. It showed in the CC0 filter (16 matches). **MAYBE**: few one-shots.
- **"Modified Boss Dr. Rhythm DR-110"** by Hieronimo (https://freesound.org/people/Hieronimo/packs/36006/):
  62 WAV hits from "my analogue Boss Dr-110". **MAYBE** (good for lo-fi and electronic).
- **"Korg Mini Pops 45"** by schafferdavid (https://freesound.org/people/schafferdavid/packs/16510/): 36 WAV
  hits, "Samples of the vintage Korg Mini Pops 45", with only gentle noise reduction. **MAYBE**.
- **"Simmons Drums"** by tarane468 (https://freesound.org/people/tarane468/packs/26582/): 39 sounds in CC0
  results; provenance not stated. **MAYBE**, could not verify.
- **AVOID:**
  - "Roland TR606 sampleset" by bdu (pack 49): the sound descriptions say it is the fdiskc.com set, so the
    uploader cannot waive rights.
  - "TR-909 Drum Hits" by GRD-music- (pack 23395): from a Roland JD-Xi emulation; fine in principle, but
    weak.
- Acoustic / brush / lo-fi on freesound:
  - soneproject "acoustic-drumkit-1" (pack 25895): 150 FLAC, "sampled at multiple velocities with drum
    sticks and brushes", ZOOM H1; showed under CC0. **MAYBE**.
  - johnnypanic "Lo Fi Drum Kit" (pack 35984): about 10 WAVs, created, edited and layered by the uploader.
    **MAYBE**.
  - The CC0 searches found no reliable CC0 boom-bap one-shot pack.

### 3.2 Collections that call themselves "public domain"
- **oramics/sampled** (https://github.com/oramics/sampled): the README says it collects instruments "with
  public domain or similar license", but "Each instrument has it's own license". Its CR-78, LM-2, MRK-2
  and TR-505 entries say "license: Public Domain", yet their stated sources do not. boxedear.com/free.html
  states no licence (read). LM-2 comes from machines.hyperreal.org; TR-505 from a progsounds free pack.
  The Pearl Master Studio kit is labelled CC-BY 3.0. **AVOID**: the "public domain" labels are the
  maintainer's own, and nothing upstream backs them.
- **smpldsnds/drum-machines** ("A collection of public domain samples of different drum machines": TR-808,
  LM-2, CR-8000, Drumtraks...): no licence file and no per-source proof. **AVOID**.
- **smpldsnds/drum-abuse-vol1..5**: thousands of one-shots (vol 1 alone: 61 machines, 5,611 WAVs,
  385 MB) "extracted from the Synth Abuse Drum Machine Sample Collection". The repos have no licence, and
  I found no Synth Abuse licence. **AVOID**, could not verify.
- **Reverb Drum Machines** (53 free packs, about 1.4 GB): the licence is not public in what I read; the
  blogs mention only use in music. These are typical royalty-free terms that bar redistribution.
  **AVOID**, could not verify.
- **archive.org**: I found no drum-machine set with an explicit CC0 or public-domain dedication. A
  forum-cited "Roland TR-808 Rhythm Composer Sound Sample Set" item lists no licence in what I saw.
  **AVOID** until an item page with a stated licence turns up.
- Caution, not legal advice: for ROM-sample machines (LinnDrum, DMX, TR-707/727, the 909's hats and
  cymbals, RX, RM50), the sounds are recordings owned by someone. A CC0 notice from whoever captured the
  output may not cover the underlying ROM. Analog voices (808, 606, CR-78, DR-110, Mini Pops) carry less
  of this concern.

### 3.3 Oak-rendered drum-machine voices (recommended for "electronic")
- Oak already renders `brk` (CC0) in `scripts/sounds/brk.ts`. Do the same for **808/909/606/CR-78-style
  analog voices**, using classic published circuit models: sine plus pitch-envelope kicks; noise plus tone
  snares; six-square metallic hats and cymbals, as on the 808/606; clap bursts; cowbell from two squares.
  Render at 44.1 kHz with several variants per role (`MAX_VARIANTS_PER_ROLE`) and ship them under the
  `oak-rendered` map as banks such as `oak808`, `oak909`, `oak606`, `oakcr78`.
- Licence: CC0 by construction. The size is tiny, well under 2 MB.
- **Verdict: RECOMMEND**. This gives acid-tooth-style (909 kick, closed and open hats, clap) and electro
  patches with no provenance risk. Teach the drum-machine *idea* through Oak's own voices.

---

## 4. Brushes and jazz: summary
- Sticks jazz kit: **Virtuosity Drums (CC0)**.
- Brushes: **Swirly Drums (CC0)** for snare hits, digs and stirs, plus **Big Rusty Drums (CC0)** for brushed
  ride, hats and cymbals. Frankensnare `*_brush` adds more brush snares.
- Hot Rods: AVL Blonde Bop HR (CC-BY-SA, MAYBE).
- Hand percussion: VCSL (CC0, Strudel map exists) and Virtuosity's `perc/` (CC0).

## 5. Lo-fi / boom-bap
- No trustworthy CC0 boom-bap one-shot crate turned up. Build one:
  - Virtuosity's **`lofi` mic** (CC0) for kick, snare, hats and ride.
  - Mix Big Rusty or Unruly hits through an Oak offline chain (tape saturation, 12-bit or 26 kHz
    decimation, low-pass, vinyl noise) and ship the results as CC0 renders.
  - The Sonic Pi bd_/sn_/hat_ files, after per-file checks.
  - A few self-recorded freesound CC0 packs (DR-110, Mini Pops) for character.

## 6. Proposed Oak "crate-like" CC0 kit (so coastline-style code has a home)
eddyflux's crate uses these keys: crate_{bd, sd, hh, oh, cp, rim, rd, cr, sh, tb, perc, conga, bongo, clave,
djembe, stick, block, bell}. Oak could ship a CC0 bank with the same role names, filled from:
- bd, sd, rim, hh, oh, rd, cr, stick (cross-stick): Virtuosity `lofi` and `room` mixes.
- cp: body_percussion claps or VCSL `clap`.
- sh, tb, conga, bongo, clave, block (woodblock), bell (agogo or cowbell), perc: VCSL and Virtuosity `perc/`.
- djembe: Swirly `djembe` (brushed) or VCSL `darbuka`/`framedrum`.
- Naming: use a distinct bank name (e.g. `.bank("oakcrate")`) rather than `crate`, so nobody assumes it is
  eddyflux's sounds. Optionally, offer an alias so that pasted strudel.cc code with `.bank("crate")` plays
  something; this is the owner's call.

## 7. Risk note on the current pack (v3)
- The 5 tidal-drum-machines banks and the `jazzkit` (Roland MC-303 brushes and ride from tidal-drum-machines)
  have no licence and no provenance. Suggested migration:
  - `jazzkit`: switch to Virtuosity plus Swirly/Big Rusty brushes.
  - Rock and pop defaults: Big Rusty or Virtuosity.
  - TR808/TR909/TR707/Linn: switch to Oak-rendered analog-style banks. LinnDrum and TR707 are ROM machines
    with no clean CC0 equivalent, so drop them or replace them with the Oak "80s" render.
  - Keep `.bank("RolandTR909")`-style aliases pointing at the Oak renders only if the owner accepts that
    the sound differs.

## 8. Loading notes (superdough)
- A `samples({ _base, key: [files] })` map works for any of the mixed-down one-shots. Keys follow
  `<bank>_<role>`, so `s("bd sd").bank("virtuosity")` resolves to `virtuosity_bd`/`virtuosity_sd`, and `n`
  selects the variant (taken modulo the count).
- FLAC decodes in Electron/Chromium. Still, render to 16-bit/44.1 kHz WAV (or the pack's current format)
  for consistency and a stable sha256 in pack.lock.json.
- Do not mirror the upstream repos whole. Pin a commit SHA, download only the files the mixdown script
  needs, and record the upstream URL and SHA plus the licence file in the pack (LICENSES/ or the manifest).
  For CC-BY sources, add the attribution lines to the pack's credits.

## Sources read
- https://github.com/ritchse/tidal-drum-machines (README, API: license null) ; https://strudel.b-cdn.net/tidal-drum-machines.json
- https://github.com/eddyflux/crate (API: license null; strudel.json; git tree)
- https://raw.githubusercontent.com/sgossner/VCSL/master/LICENSE ; https://strudel.b-cdn.net/vcsl.json
- https://codeberg.org/uzu/strudel/raw/branch/main/website/src/repl/prebake.mjs
- https://github.com/felixroos/dough-samples (README) ; https://github.com/yaxu/clean-breaks (file list) ; https://github.com/tidalcycles/Dirt-Samples (README)
- sfzinstruments repos (API licence fields, LICENSE/README files, git trees): virtuosity_drums, karoryfer.swirly-drums (license + changelog.txt), karoryfer.big-rusty-drums, karoryfer.unruly-drums, karoryfer.frankensnare, Karoryfer.TheHatWithThePhat, body_percussion, WilkinsonAudio.NakedDrums, DrumGizmo.DRSKit, SamsSonor
- https://drumgizmo.org/wiki/doku.php?id=kits:crocellkit , kits:drskit , kits:muldjordkit
- http://www.bandshed.net/avldrumkits/ ; http://bandshed.net/pdf/AVL-Drumkits%20CC-BY-SA%20License.pdf ; http://www.bandshed.net/sounds/sfz/
- https://github.com/endolith/Salamander-Drumkit (README)
- http://hydrogen-music.org/feeds/drumkit_list.php ; hydrogen repo data/drumkits/*/drumkit.xml
- https://raw.githubusercontent.com/sonic-pi-net/sonic-pi/main/etc/samples/README.md
- https://github.com/oramics/sampled (+ DM/*/README.md) ; http://www.boxedear.com/free.html ; https://github.com/smpldsnds (drum-machines, drum-abuse-vol1 README)
- freesound.org CC0-filtered searches and pack pages: oceansonmars 44238/39611, Hieronimo 36006, schafferdavid 16510, bdu 49, GRD-music- 23395, soneproject 25895, johnnypanic 35984, tarane468 26582
- KVR/rekkerd news on Swirly Drums, Big Rusty Drums, Virtuosity Drums (descriptions only)
