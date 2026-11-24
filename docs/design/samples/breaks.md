# Drum breaks, loops, textures and one-shots for the Oak sound pack

Research date: 2026-11-24. Scope: drum breaks, loops, textures (vinyl, tape, room, field), FX (risers, impacts, whooshes), vocal chops, claps/snaps, and Oak rendering its own breaks. Every licence below was read by me unless marked "could not verify". Quotes are kept under 15 words.

---

## 0. Bottom line

1. **Sonic Pi's bundled samples (RECOMMEND, minus 2 Amen files).** About 200 FLAC files, 35 MB in total, all declared CC0 in Sonic Pi's LICENSE.md and in a per-file source list. This one source covers most of the brief: vinyl hiss, rewind, backspin and scratch; snaps, impacts and swooshes; ambient drones and pads; original CC0 drum loops; acoustic and electronic one-shots; Arovane's donated CC0 beats; The Black Dog's CC0 pads and percussion. Drop `loop_amen` and `loop_amen_full`, which are the Winstons recording. A curated 8–12 MB subset is enough.
2. **Oak-rendered breaks, extended (RECOMMEND, the main route to breaks).** Grow `brk.ts` from one bar into a small library: funk, boom-bap, jungle, house and a jazz shuffle, each rendered at its own native tempo(s) from CC0 one-shots. For an acoustic character, take those one-shots from the CC0 **Virtuosity Drums** (Versilian and Karoryfer) or **Big Rusty Drums** (Karoryfer). Those libraries offer velocity layers, round-robins and room mics, which the current single uzu hit per voice lacks. This route is the only one that gives famous-break-like material with a clean licence.
3. **VCSL percussion (RECOMMEND).** CC0, and strudel.cc already loads it from `strudel.b-cdn.net/vcsl.json`. Take claps (10 round-robins), small and large shakers, tambourine, cajon, guiro, slapstick and ocean drum, as one-shots and as rendering sources.
4. **Freesound, hand-picked and frozen (RECOMMEND with process).** The froos IDs 495416, 495313 and 494947 are all **CC0**: PhonosUPF saxophone extended-technique sounds, and all 2,430 PhonosUPF uploads are CC0. Add one or two real vinyl-crackle and tape-hiss recordings (e.g. Anthousai, veezay, kijjaz, D.S.G.) and a few kyles field and room recordings. Freesound's "CC0" is the uploader's claim. Uploads of James Brown and Amen loops are labelled CC0, so each file needs vetting.
5. **Dirt-Samples (AVOID as a whole).** It has no licence file, and its maintainer wrote in issue #19 that "A lot of them have unknown provenance". The cleaned-up spin-off shows the core `bd/sn/cp/ht/lt/mt` folders are Rob Roy TR-909 recordings tagged **CC-by-sa-nc**. Only `tidalcycles/sounds-tr808-fischer` (CC0 file in repo) is usable, with a caveat.
6. **Synthesise rather than sample** where superdough already can. superdough 1.3.0 registers `white`, `pink`, `brown` and **`crackle`** (with `density`) noise sounds. Risers, sweeps, tape-like hiss and a basic vinyl crackle are better taught as code (noise + `lpf` sweep + `gain` envelope) than shipped as files.

---

## 1. Ground rules that shape every verdict

- **Famous breaks are copyrighted sound recordings.** The Amen (The Winstons, "Amen, Brother", 1969), Funky Drummer (James Brown/Clyde Stubblefield, 1970), Think (Lyn Collins, 1972), Apache (Incredible Bongo Band), Impeach the President, Synthetic Substitution and the rest are owned by labels and publishers. A freesound or GitHub "CC0" tag on one of them is void, because the uploader cannot license someone else's recording. Avoid all of them, including chopped, pitched or "processed" versions. Oak already applies this rule: `pack.config.ts` prunes uzu-drumkit's `brk` ("a recording of the Amen break").
- **Re-playing a groove is different from sampling a recording.** Rendering an original pattern from CC0 one-shots involves no sound-recording copyright, and that copyright is what the break disputes are about. Keep Oak's grooves original ("in the style of"), not note-for-note transcriptions of a named record. That keeps it clean and is better teaching anyway.
- **Freesound mechanics.** Original files need a logged-in account. The API docs say Download Sound "requires OAuth2 authentication". Previews are lossy: hq-mp3 is about 128 kbps and hq-ogg about 192 kbps. So `mirror.ts` cannot fetch freesound originals anonymously. Practical route: the owner downloads the chosen originals once, while logged in. They are stored under a vendored path, `sourceUrl` records the freesound page, and the lock's sha256 freezes them. Keep an attribution and provenance list anyway, even for CC0, to record where each file came from.
- **Freesound "CC0" is a claim, not proof.** The same CC0-filtered search for "drum break" returned "James Brown - Soul Pride (Drum Loop - Amplified).wav" (501749) and "Amen Drum Break Loop.wav" (503345), both tagged CC0. Every pick must be listened to and its description read.
- **Formats.** Sonic Pi ships FLAC, and Karoryfer and Virtuosity ship mostly FLAC. superdough decodes through the browser's `decodeAudioData`, and Chromium (Electron) decodes FLAC, so FLAC can be served as-is. `brk.ts`'s `decodeWav` reads only WAV, though, so rendering from FLAC sources needs a pinned FLAC decoder at mirror time. FLAC is lossless, so the result stays byte-deterministic. The other option is to vendor WAV conversions of the few source hits.

---

## 2. Candidate sources

### 2.1 Sonic Pi bundled samples: RECOMMEND (curated subset; AVOID 2 files)

- **Name/URL:** Sonic Pi `etc/samples`: https://github.com/sonic-pi-net/sonic-pi/tree/dev/etc/samples
- **Licence:** CC0 1.0, read at https://github.com/sonic-pi-net/sonic-pi/blob/dev/LICENSE.md: "All the bundled samples are individually licensed under a CC0 1.0 Universal". The per-file sources are listed in https://github.com/sonic-pi-net/sonic-pi/blob/dev/etc/samples/README.md. That file says the samples "have also been placed in the public domain via the Creative Commons 0". Arovane (`arovane_`) and The Black Dog (`tbd_`) donated theirs under CC0.
- **What is in it (from the GitHub contents API, dev branch):** 206 FLAC files, 35.0 MB, 44.1 kHz, mostly 16-bit. Groups: tabla 26, elec 25, hat 21, drum 20, loop 17, bd 15, ambi 11, mehackit 11, tbd 11, perc 10, bass 9, glitch 8, arovane 5, guit 4, sn 4, vinyl 4, misc 3, ride 2. README says "Many of the samples have been slightly modified and trimmed".
- **Spot-checked on freesound (all show "Creative Commons 0"):**
  - `drum_snare_hard`: menegass 100058, "Guigui acoustic drum set", mono 44.1/16
  - `perc_snap`: SoundCollectah 109400
  - `perc_impact_1`: hullum 415578
  - `loop_3dprinter`: hullum 415571
  - `bd_haus`: Rodrigo The Mad 137722
  - `sn_dub`: Adriak909 173142
  - `hat_snap`: TheEndOfACycle 674294
  - `vinyl_hiss`: veezay 130393 ("unpressed side of a single-sided vinyl record", 42 s)
  - `vinyl_rewind`: TasmanianPower 162493 (made in FL Studio's Fruity Scratcher, a DJ-rewind effect)
  - `vinyl_scratch`: hello_flowers 28681
  - `vinyl_backspin`: il112 182316
  - `loop_breakbeat`: Snapper4298 160354 ("produced on my retro Roland 808", original)
  - `loop_mika`: mika55 188551 (120 BPM drum solo)
  - `loop_garzul`: Garzul 213524 (120 BPM distorted)
  - `loop_industrial`: godspine 222072 (built entirely from the author's own sounds)
  - `loop_safari`: nemaavla 318759 ("recorded in my keyboard")
  - `loop_compus`: godspine 212288 (an Ableton Live "Compuspank" kit)
- **Loading:** no strudel.cc map exists. Oak maps it itself: mirror pinned files from `raw.githubusercontent.com/sonic-pi-net/sonic-pi/<commit>/etc/samples/<name>.flac` and write e.g. `sonicpi.json` with `_base: /sounds/v4/sonicpi/`. Key names could be Oak-friendly (`vinyl`, `hiss`, `snap`, `impact`, `swoosh`, `drone`...).
- **Quality notes:** the files are trimmed and level-matched for live coding, and widely used in Sonic Pi teaching. The `drum_*` set is a single acoustic kit (one hit per articulation, mono). The `arovane_beat_*` files (1.25–2.6 MB each) are glitchy IDM beats by a recording artist. `tbd_pad_*` are lush pads.
- **AVOID inside it:**
  - `loop_amen`: Dolfeus 43389, "The famous "Amen Break" by "the Winstons" Cutted"
  - `loop_amen_full`: gowers 202537, "140 Bpm Amen Break Original (Processed)", tags "winston", "brothers"
  - Both are CC0-labelled, but the label is void.
- **MAYBE inside it:**
  - `vinyl_backspin` is tagged "aah": a scratch of an "aah" vocal, which may come from a commercial record. Listen first, and drop it if it is a recognisable record.
  - `loop_compus` is an Ableton Live library kit. A loop made with it is a finished work, but check before shipping.
  - `loop_safari` is a keyboard's built-in rhythm.
  - The `tabla_*` source pages (dio_333) are gone ("link deprecated"), so I **could not verify** their licence beyond Sonic Pi's statement.
- **Verdict: RECOMMEND.** CC0 throughout, already curated, small, and covers vinyl, FX, ambience, snaps and original loops. Suggested subset, about 8–12 MB:
  - `vinyl_hiss`, `vinyl_rewind`, `vinyl_scratch`
  - `perc_snap`, `perc_snap2`, `perc_impact1/2`, `perc_swoosh`, `perc_swash`, `perc_door`
  - `ambi_drone`, `ambi_glass_hum`, `ambi_lunar_land`, `ambi_dark_woosh`, `ambi_swoosh`
  - `loop_breakbeat`, `loop_mika`, `loop_garzul`, `loop_industrial`, `loop_electric`, `loop_perc1/2`, `loop_weirdo`
  - `arovane_beat_a..e`
  - `tbd_pad_1..4`, `tbd_fxbed_loop`, `tbd_perc_*`
  - `drum_*` (acoustic one-shots, also a rendering source)
  - `bd_*`, `sn_*`, `hat_*` picks

### 2.2 tidalcycles/Dirt-Samples: AVOID (as a whole)

- **URL:** https://github.com/tidalcycles/Dirt-Samples
- **Licence:** **none**. The repo has no LICENSE file, the API reports `license: null`, and the README says nothing about licensing. Issue #19 "Add a license" (https://github.com/tidalcycles/Dirt-Samples/issues/19) is open. The maintainer (yaxu) answered: "A lot of them have unknown provenance."
- **What is in it:** 218 folders, about 174 MB repo, mostly 44.1 kHz WAV. It includes `breaks125/152/157/165`, `amencutup`, `jungle`, `808*`, `909`, `gabba`, `speakspell`, `crow`, `insect`, `wind`, `numbers`, `alphabet`, and more. It also contains a `strudel.json`, which is what `samples('github:tidalcycles/dirt-samples')` loads.
- **Evidence of problems:**
  - The cleaned-up `tidalcycles/sounds-dirty` metadata (`_soundmeta/bd.json`) marks `bd`, `cp`, `sn`, `ht`, `lt` and `mt` as "tr909 samples from Rob Roy recordings", licence **"CC-by-sa-nc"**. That is non-commercial, so not acceptable.
  - Issue #20 describes `gabba` as taken from the Roland JV-1080 Techno expansion board, a commercial ROM.
  - `amencutup` is the Amen by name, and the `breaks*` and `jungle` folders are almost certainly cut from records.
- **Clearly redistributable folders:** **none can be called clear from the repo itself.** strudel.cc's prebake loads a few Dirt-Samples folders (`casio`, `crow`, `insect`, `wind`, `jazz`, `metal`, `east`, `space`, `numbers`, `num`) from the Strudel CDN, but no licence for them is stated anywhere I could read.
- **Verdict: AVOID.** Unknown provenance, with some folders known to be NC or from records.

### 2.3 Clean-Samples family (tidalcycles), the licensed successor to Dirt-Samples

- `tidalcycles/Clean-Samples` (https://github.com/tidalcycles/Clean-Samples): a meta-quark, GPL-3.0 for the repo tooling. Its README says the packs have "clear provenance and license info". It is a list of dependency packs, not samples itself.
- **`tidalcycles/sounds-tr808-fischer`** (https://github.com/tidalcycles/sounds-tr808-fischer): **MAYBE.**
  - Licence: CC0 1.0 LICENSE file in the repo, and `_soundmeta/*.json` says `"license": "cc0"`.
  - Caveat: the CC0 was applied by the Tidal maintainer, not by the author. Michael Fischer's 1994 README only says the samples "are ABSOLUTELY FREE!".
  - Contents: 116 WAV files, 12.6 MB, 16 TR-808 voices at several knob settings.
  - Overlaps the pack's existing TR-808 bank (tidal-drum-machines, which itself declares no licence). If Oak wants a *licensed* 808, this is the better-documented source, with that caveat.
- `tidalcycles/sounds-dirty`: **AVOID**. Rob Roy 909, tagged CC-by-sa-nc.
- `tidalcycles/sounds-repetition`: CC0 (repo licence), described as made with "Various dodgy speech synths". These are speech-synth one-shots and could serve as robot "vocal chops". **MAYBE**: CC0, but the synth engines' output terms were **not verified**.

### 2.4 VCSL percussion (Versilian Community Sample Library): RECOMMEND

- **URL:** https://github.com/sgossner/VCSL. Strudel map: `https://strudel.b-cdn.net/vcsl.json` with `_base` `https://raw.githubusercontent.com/sgossner/VCSL/master/`. strudel.cc's prebake loads it by default.
- **Licence:** CC0 1.0. LICENSE at https://github.com/sgossner/VCSL/blob/master/LICENSE ("CC0 1.0 Universal"). The README says "you can do whatever you want with these sounds".
- **In my area:**
  - `clap` (10)
  - `shaker_small` (16), `shaker_large` (6)
  - `tambourine` (7), `tambourine2` (7)
  - `cajon` (18), `guiro` (5), `slapstick` (5), `ratchet` (8), `vibraslap` (4)
  - `oceandrum` (3, sustained texture)
  - `hihat` (15), `snare_modern` (72), `snare_hi`/`snare_low`/`snare_rim`, `tom_*`, `sus_cymbal` (25)
  - `bongo` (28), `conga` (34), `cowbell` (13), `woodblock` (10)
  - Format: WAV at 44.1/48 kHz, 16/24-bit, "mid-close" stereo or mono (README contributor standards).
- **Gap:** the `bassdrum1/2` keys are concert bass drums (`bassdrum_cresc_*`, `bassdrum_rub*`), not a kit kick.
- **Loading:** the existing map works. Oak mirrors a pruned key list exactly as `pack.config.ts` does for uzu and tidal-drum-machines (`keep: (key) => ...`).
- **Quality:** consistent, professionally recorded, round-robins on percussion. This is the best CC0 source for real claps, shakers and tambourine, and a strong rendering source for snares, hats and ghost notes.
- **Verdict: RECOMMEND.** Already in the strudel.cc default set, CC0, and fills the clap, shaker and foley-percussion gap.

### 2.5 CC0 acoustic drum multisample libraries (rendering sources, not shipped whole)

Licences below were read from the repos' LICENSE files through the GitHub API.

- **Virtuosity Drums** (Versilian Studios and Karoryfer Samples): https://github.com/sfzinstruments/virtuosity_drums. **RECOMMEND as render source.**
  - LICENSE: "CC0 1.0 Universal".
  - "Contemporary Jazz drum kit library, performed with sticks", recorded at Virtuosity Musical Instruments, Boston, drummer Austin McMahon.
  - Six mic positions (kick, snare, OH, mid, room, vintage).
  - Articulations: kick snares-on/off; snare centre/off-centre/rimshot/stickshot/cross-stick/hand-muted/flam/buzz; toms; hi-hat closed/open/pedal; ride, crash and more.
  - 5,358 files (3,390 FLAC + 1,468 WAV), 1.49 GB total.
  - Oak would pick roughly 20–40 hits (a few MB) and render from them.
- **Big Rusty Drums** (Karoryfer): https://github.com/sfzinstruments/karoryfer.big-rusty-drums. **RECOMMEND as render source** (rock and boom-bap weight).
  - LICENSE: "CC0 1.0 Universal".
  - SFZ Instruments describes it as an oversized 1980s Polish kit. It was made free and open source in April 2023 (KVR News).
  - 4,872 files (4,366 FLAC), 731 MB.
- Karoryfer **Swirly Drums**, **Unruly Drums** ("every drum has snare wires on it, including the kick") and **Frankensnare** ("various snare drum samples"): all CC0-1.0 per the GitHub API (I read Swirly's LICENSE text, "CC0 1.0 Universal"; for Unruly and Frankensnare I saw only the API licence field). **MAYBE**: useful for lo-fi and odd textures, but large.
- **DrumGizmo DRSKit / MuldjordKit (sfz ports):** https://github.com/sfzinstruments/DrumGizmo.DRSKit, https://github.com/sfzinstruments/DrumGizmo.MuldjordKit. CC-BY-4.0 per the GitHub API. **MAYBE**: attribution only, so acceptable, but CC0 alternatives exist.
- **Salamander Drumkit** (Alexander Holm): https://github.com/endolith/Salamander-Drumkit. **AVOID for rendering.**
  - Licence: CC BY-SA 3.0. The author's note says share-alike "only applies if you modify the samples themselves or create new sample libraries".
  - A pack of Oak-rendered breaks *is* a new sample library made from them. Those breaks would have to be released CC BY-SA 3.0 with attribution, and so would any vendored hits.
  - The app code would not be bound, because a collection is not an adaptation. Still, it is needless friction next to CC0 kits.
- **AVL Drumkits** (Glen MacArthur): https://github.com/studiorack/avl-drumkits. **AVOID**: CC BY-SA 3.0 Unported (LICENSE read), with the same share-alike consequence.

### 2.6 Freesound picks

**froos's IDs from "broken cut 1".** I checked each page:

| ID | Name | Author | Licence | Format |
|---|---|---|---|---|
| 495416 | "sax slap" | PhonosUPF | **Creative Commons 0** | WAV 44.1 kHz, 0.89 s, 153 KB |
| 495313 | "sax vibrato" | PhonosUPF | **Creative Commons 0** | WAV 44.1 kHz, 3.96 s, 683 KB |
| 494947 | "sax attack" | PhonosUPF | **Creative Commons 0** | WAV 44.1 kHz, 1.83 s, 316 KB |

PhonosUPF has 2,430 uploads, and the CC0-filtered search returns all 2,430. The page footer links to Phonos and Universitat Pompeu Fabra. Categories: 890 sound effects, 604 music, 536 instrument samples, 390 soundscapes. The sounds are transformed instrument and percussion material: extended sax techniques, brass attacks, claves, "creaking door", "vibrating wood", "drumming". **RECOMMEND.** This is exactly the "attack/whirl/foley one-shot" palette froos uses, and it is uniformly CC0. Pick about 15–30 files, under 5 MB.

**Vinyl crackle (real).** Two sources, **RECOMMEND 1–2 files**:
- **Anthousai "Vinyl Crackle" pack**, https://freesound.org/people/Anthousai/packs/22442/. E.g. 398817 "vinyl - out 05.wav": CC0, WAV 44.1/24, 9.65 s, "The couple seconds of crackle after an old vinyl record ends", from a Sony PS-LX300USB.
- **veezay 130393** (already Sonic Pi's `vinyl_hiss`): CC0, 42 s of an unpressed vinyl side.
- Note: `s("crackle")` in superdough already makes synthetic crackle. The value of a real recording is rumble and surface noise.

**Tape hiss.** Candidates from the CC0-filtered search: kijjaz 430975 "Tape Hiss from Blank Tape - Dolby B-NR", D.S.G. 241415 "Tape Hiss", stecman 375985, kyles 452911 "cassette tape hiss stop, crackle, click". I did not open each page. Confirm each licence on its page when picking. **MAYBE**: pink or brown noise plus `lpf` teaches the same idea in code.

**Field recordings / room tone / foley.**
- **kyles**: 5,632 uploads in the CC0 filter, mostly sound effects (3,462) and soundscapes (1,856). Streams, city, apartment rooms, machines, tape-machine handling, doors. **RECOMMEND** a handful, e.g. a room tone, a rain or street bed, a door or handling sound.
- Sonic Pi `ambi_*` and `perc_door` cover some of this already.
- InspectorJ, a very popular field recordist, is CC-BY 4.0 (from general knowledge; **could not verify** in this pass). That would be acceptable with attribution.

**Risers / whooshes / impacts.** The CC0 search turns up many. E.g. risers: rubenrox 487698 "Noisy Riser", reathance 503818, spaghettiSFX 795292. Whooshes: sramse 342983 "Whoosh Noises Raw", ch_ase 423799 "Little Whooshes", Qvantor 877983 "Synthesized Whooshes, Transitions and Wind". I did not open these pages, so **could not verify** them individually. **MAYBE**: Sonic Pi's `perc_swoosh`, `ambi_swoosh`, `ambi_dark_woosh` and `perc_impact1/2` (verified CC0) cover the basics. A riser is better written as Strudel code (`s("pink").lpf(saw.range(200,8000).slow(4))`) so the learner sees how it works.

**Claps / snaps.** Sonic Pi `perc_snap` (SoundCollectah 109400, CC0, verified) and `perc_snap2` (Peram 158615), plus VCSL `clap`. Freesound has more (e.g. "Clap Snaps & Other" pack by ilip33, 593223), but there is no need. **RECOMMEND** the Sonic Pi and VCSL ones.

**Vocal chops.** The CC0 results are thin and mostly by small uploaders (e.g. CAT-FOX_ALEX 864909 "EarlyFile-Vocal Chop 1"; wenter13 161507 "Chopped Vocal Loop 1"). Ownership of a sung or spoken voice is hard to verify. **MAYBE / mostly AVOID.** Better CC0 options:
- `choir` (gm_choir_aahs, already in the pack) chopped with `.chop()`.
- Sonic Pi `ambi_choir` (Exsomniel 207809, from the CC0 list).
- `tbd_voctone`.
- `sounds-repetition` speech synths.
- An owner-recorded vocal released CC0 (the owner is the only learner, and recording a few "oh/ah/hey" syllables is itself a lesson).

**Jazz loops made with apps.** E.g. bassimat 853457 "Chicago-Style Jazz Drum Loops – 120 BPM" is CC0-tagged but "Produced with iPad Jazz Drummer". The app's own sound content and EULA govern the material, which I did not read. **AVOID** unless that app's terms clearly allow redistribution.

### 2.7 Kenney "Impact Sounds": MAYBE

- https://kenney.nl/assets/impact-sounds: 130 files. The page states the licence as "Creative Commons CC0". Format not stated on the page.
- These are game SFX (impacts on materials). Usable for foley hits, but less musical than Sonic Pi and PhonosUPF.

### 2.8 Commercial "free" sources: AVOID

- **Sonniss GDC bundles** (https://sonniss.com/gdc-bundle-license/): the licensee "may not distribute, publish, sub-license or otherwise supply the sound effects". Explicitly not as an "asset pack" or SDK. That rules out an app that exposes the files.
- **MusicRadar SampleRadar:** labelled "royalty-free", and some collections use the RemArc non-commercial licence. **Could not verify** the redistribution clause (the readme I found 404'd). Royalty-free for use in tracks is not a licence to redistribute raw samples, so AVOID.
- **BBC Sound Effects (RemArc):** non-commercial. AVOID.
- **Splice, Looperman, SampleSwap, YouTube "free breaks" packs:** no redistribution rights, or provenance from records. AVOID.

---

## 3. Synthesise instead (no files needed)

superdough 1.3.0 (in `node_modules/.bun/superdough@1.3.0/.../helpers.mjs`) registers the noise sounds `pink`, `white`, `brown` and `crackle`. `crackle` takes `density`. This covers, as teachable code:

- vinyl crackle: `s("crackle").density(.03)`
- hiss: `s("pink").gain(.05).hpf(4000)`
- risers: noise with an `lpf` sweep, `gain` rise and `.slow(4)`
- downlifters and sub drops: sine with a pitch slide
- white-noise snares and claps (layered noise bursts with `.ply`)

Ship samples only where the recording adds something code cannot: real vinyl rumble, real rooms, real acoustic drums, PhonosUPF-style transformed timbres.

---

## 4. Oak rendering its own breaks (extending `scripts/sounds/brk.ts`)

### 4.1 What `brk.ts` does today

- One bar, 96 BPM, 44.1 kHz, 16-bit stereo WAV, about 441 KB. Rendered sample by sample from four uzu-drumkit one-shots (Unlicense): kick `bd/11_bd_mot4i.wav`, snare `sd/11_sd_switchangel_3.wav`, hat `hh/11_hh_mot4i.wav`, open hat `oh/11_oh_switchangel.wav`.
- The groove is a fixed table of `{step 0–15, voice, gain, nudgeMs}`:
  - kick on 1, the "a" of 1, 3 and a push into 4
  - backbeat snare with ghosts at about 0.3 gain, dragged 5–7 ms
  - 16th hats accented by position
  - an open hat on the "and" of 4, choked by the next closed hat (20 ms)
- Per-voice equal-power pan, peak-normalised to −3 dBFS, a 4 ms end fade.
- Deterministic: identical bytes every time, so its sha256 can be locked.
- Output is released CC0, which is valid because the inputs are Unlicense or CC0 and the groove is original.
- Served as `s("brk")` via `oak-rendered.json`. `s("brk").loopAt(1)` fits it to any cps.

### 4.2 How far the approach goes

Feasible styles with the same engine (a groove table, a source kit and a tempo):

| Style | Native tempo(s) to render | Groove sketch | Best CC0 source hits |
|---|---|---|---|
| Funk (2-bar) | 96, 104 | syncopated 16th kicks, ghosted snares, 16th hats with open-hat lifts | Virtuosity snare centre/ghost (low-velocity layers), Big Rusty kick, VCSL tambourine on 2 & 4 |
| Boom-bap | 88, 92 | kick on 1 and "and of 2" variations, hard snare on 2 & 4, swung 16th or 8th hats (swing via `nudgeMs` on off-16ths, about 55–62%) | Big Rusty kick/snare, Virtuosity room mic, Sonic Pi `drum_*` |
| Jungle / DnB break | 160–172 (render at, e.g., 136 *and* 170; see pitch note below) | 2-bar syncopated snare patterns, rolls, displaced kicks, ride or hat 8ths | acoustic snares with several round-robins, ghost flams; then the learner chops it with `.slice(16, ...)`, `.splice`, `.ply` |
| House / garage loop | 122–126 | four-on-the-floor kick, off-beat open hat, clap on 2 & 4, shuffled 16th hats/shaker (garage swing) | uzu or Sonic Pi `bd_haus`, VCSL clap and shaker |
| Jazz shuffle / brush (bonus) | 120–160 | ride swing pattern, hat on 2 & 4, feathered kick, comping snare | Virtuosity ride and hat-pedal; the pack's `jazzkit` brushes |
| Lo-fi (coastline-like) | 70–85 | lazy boom-bap with heavy swing, quiet hats | any of the above plus a deterministic lo-fi chain (see 4.3) |

**Size budget:** a 2-bar break at 90 BPM, stereo 16-bit 44.1 kHz, is about 0.94 MB, and at 170 BPM about 0.5 MB. Ten to twelve breaks (several styles at two tempos each) fit in roughly 6–9 MB of WAV, and about half that if the pack accepts FLAC.

**Why render several native tempos.** `loopAt`/`fit` fit a break by changing playback **speed**, which also changes **pitch**. A 96 BPM break played at 170 BPM sounds chipmunked; sometimes that is the jungle aesthetic, but usually it is not wanted. Rendering at the target tempo keeps the drums' pitch and decays natural. Also offer a slow render that the learner deliberately speeds up, which teaches why jungle sounds the way it does.

**Strengths for teaching:**
- Oak knows every onset, so it can write slice metadata (hit positions per 16th) beside each break. Lessons on `.slice(16, "<0 4 8 12>")`, `.splice`, `.chop`, `.ply` and `.striate` then cut exactly on hits.
- Lessons can show the groove table as "the drummer's score", tying it to the bar/beat/subdivision theory the course teaches.
- No licence questions, ever.

### 4.3 What it would take (engine changes, all deterministic)

1. **Multi-sample sources.** Allow several files per voice (velocity layers and round-robins) and choose by gain and step, never by `Math.random`, e.g. round-robin index = hit index mod N. This removes the "machine-gun" effect of reusing one hit at different gains.
2. **Acoustic sources.** Take 20–40 hits from Virtuosity Drums or Big Rusty Drums (CC0). Vendor them as WAV, or add a pinned FLAC decoder, because `decodeWav` reads only WAV. Mix close and room mics at fixed ratios to get real kit ambience and bleed. That ambience is most of what makes a "break" sound like a break.
3. **Multi-bar grooves and fills.** 2- or 4-bar tables, with a fill on the last bar.
4. **Swing as a parameter.** Off-16th delay as a percentage, so the same table renders "straight" and "swung" variants.
5. **Deterministic colour chain:**
   - `tanh` saturation or tape-style soft clip
   - simple feed-forward compressor
   - sample-rate and bit reduction (SP-1200/MPC flavour for boom-bap and lo-fi)
   - an algorithmic room (Schroeder or FDN with fixed coefficients)
   - fixed-rate wow/flutter via an LFO on read position
   - an optional CC0 vinyl bed mixed under it (Anthousai or veezay)
   - All of this is pure arithmetic, so the sha256 stays stable.
6. **Naming:** e.g. `brk` (keep), `brk_funk`, `brk_boombap`, `brk_jungle`, `brk_house`, `brk_jazz`. Use `:n` indices for tempo variants, or separate keys per tempo (`brk_jungle170`). Write the BPM into the manifest so lessons can call `.loopAt(2)` or `.fit()` with the right cycle count.

### 4.4 Limits (be honest in the course)

- **It is a sequenced kit, not a performance.** A drummer's continuous dynamics, hi-hat openness gradients, buzz and drag rudiments, and bar-to-bar micro-variation are only approximated by tables. More velocity layers and round-robins help, but famous breaks also carry a specific room, mics, console and tape, plus decades of vinyl wear. Oak can evoke that, not reproduce it.
- **No sampled-record grit unless processed.** Without the 4.3 chain, a clean render sounds "drum-machine-like". The current `brk`, built from electronic uzu hits, sounds so.
- **The famous rhythms themselves.** A recognisable note-for-note transcription of a named break is best avoided (see section 1). Original grooves in the style are the safe and better-teaching choice.
- **Pitch at extreme tempos.** Resolved by rendering native tempos, at the cost of more files.
- **Determinism constraints.** No random humanisation unless seeded and fixed, and no third-party effects whose output differs by version, which rules out ffmpeg filters for rendering.
- **Source size.** The acoustic libraries are 0.7–1.5 GB repos. Fetch only the chosen files, using raw URLs pinned to a commit, inside mirror.ts. Never clone whole repos at build time.

---

## 5. Proposed additions for a v4 pack (this area only)

| Group | Source | Licence | Est. size |
|---|---|---|---|
| `sonicpi` subset (vinyl, snaps, impacts, swooshes, ambi drones, CC0 loops, arovane beats, tbd pads/perc, acoustic `drum_*`) | Sonic Pi etc/samples @ pinned commit | CC0 | 8–12 MB (FLAC) |
| `vcsl` percussion subset (clap, shakers, tambourine, cajon, guiro, slapstick, ocean drum, snare and hat layers) | strudel.b-cdn.net/vcsl.json (VCSL) | CC0 | 4–8 MB |
| `phonos` one-shots (froos-style attacks, slaps, whirls, foley) | freesound PhonosUPF, owner-downloaded, frozen by sha256 | CC0 | 3–5 MB |
| `texture` (1–2 vinyl beds, 1 tape hiss, 2–3 room/field beds) | freesound Anthousai / veezay / kyles etc., owner-downloaded | CC0 | 3–6 MB |
| `oak-rendered` breaks: funk, boom-bap, jungle, house, jazz × 2 tempos | Oak render from Virtuosity / Big Rusty / VCSL / uzu hits | CC0 (output) | 6–9 MB |

Total: about 25–40 MB on top of the current ~30 MB. Keep a `CREDITS` list of source URLs even for CC0 (provenance), and **exclude** `loop_amen`, `loop_amen_full`, uzu `brk`, all Dirt-Samples break folders, and any freesound upload that names a record or artist.

---

## Sources read

- Sonic Pi LICENSE.md: https://github.com/sonic-pi-net/sonic-pi/blob/dev/LICENSE.md
- Sonic Pi samples README: https://github.com/sonic-pi-net/sonic-pi/blob/dev/etc/samples/README.md
- Dirt-Samples: https://github.com/tidalcycles/Dirt-Samples, issues #19 (https://github.com/tidalcycles/Dirt-Samples/issues/19), #20 and #15
- Clean-Samples: https://github.com/tidalcycles/Clean-Samples
- sounds-dirty `_soundmeta`: https://github.com/tidalcycles/sounds-dirty
- sounds-tr808-fischer: https://github.com/tidalcycles/sounds-tr808-fischer
- VCSL: https://github.com/sgossner/VCSL
- Strudel prebake: https://codeberg.org/uzu/strudel/src/branch/main/website/src/repl/prebake.mjs
- Virtuosity Drums: https://github.com/sfzinstruments/virtuosity_drums
- Big Rusty Drums: https://github.com/sfzinstruments/karoryfer.big-rusty-drums
- Swirly Drums: https://github.com/sfzinstruments/karoryfer.swirly-drums
- Frankensnare: https://github.com/sfzinstruments/karoryfer.frankensnare
- Salamander Drumkit: https://github.com/endolith/Salamander-Drumkit
- AVL Drumkits: https://github.com/studiorack/avl-drumkits
- DrumGizmo DRSKit: https://github.com/sfzinstruments/DrumGizmo.DRSKit
- DrumGizmo MuldjordKit: https://github.com/sfzinstruments/DrumGizmo.MuldjordKit
- Freesound sound pages: 495416, 495313, 494947, 43389, 202537, 160354, 130393, 182316, 28681, 162493, 674294, 222072, 188551, 213524, 212288, 318759, 100058, 415571, 415578, 137722, 173142, 109400, 398817, 853457
- Freesound API docs: https://freesound.org/docs/api/resources_apiv2.html
- Kenney Impact Sounds: https://kenney.nl/assets/impact-sounds
- Sonniss GDC licence: https://sonniss.com/gdc-bundle-license/
- Oak sources: `/Users/fpl0/Code/Oak-wt/songs/scripts/sounds/brk.ts`, `pack.config.ts`, `mirror.ts`; superdough 1.3.0 `helpers.mjs` and `synth.mjs`
