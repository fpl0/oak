# Oak sound pack v4: curated library proposal

Curator's pass, 2026-11-24. Inputs: `acoustic.md`, `drums.md`, `breaks.md`, `synth.md`, `oak.md` in this folder, and
the `songs` worktree (`/Users/fpl0/Code/Oak-wt/songs`, HEAD a98be8a). Nothing in either repository was changed.

**Licence rule used here.** A source enters the library only if I opened its licence text myself, today, and it
allows redistribution inside a public app: CC0, Unlicense, MIT or CC-BY. Everything I could not read myself is marked
"could not verify" and is left out, whatever the research reports said. Quotes are under 15 words.

---

## 0. The decisions, in one screen

1. **Upgrade behind the existing names first.** `rhodes`, `upright`, `ebass`, `fingerbass`, `organ`, `cleangtr`,
   `jazzgtr`, `strings`, `trumpet`, `mutetpt`, `tenor`, `vibes` and the `jazzkit` bank are replaced with real CC0 or
   CC-BY recordings. These names already appear in about 1,300 places in lessons, Bands and songs, and none of those
   places needs an edit: every one of them sounds better. This step needs a new kind of alias: one backed by samples
   instead of a GM font.
2. **New kits, all CC0.** `rockkit` (Big Rusty Drums), `lofikit` (the Virtuosity "lofi" mic plus an Oak lo-fi chain:
   Oak's own CC0 answer to eddyflux's crate), and two Oak-synthesised drum machines, `oak909` and `oak808`. Oak builds
   these offline, so they are CC0 by construction.
3. **Breaks: Oak renders them.** I found no clean CC0 *recording* of a famous-style break. Every famous break is a
   copyrighted record, and freesound's "CC0" tag on Amen or James Brown loops is void. So Oak grows `brk.ts` into six
   original 2-bar grooves, each at its own native tempo: `brkfunk`, `brkboombap`, `brkjungle`, `brkhouse`, `brkjazz`
   and `brklofi`. They are rendered from the CC0 kits above.
4. **Textures and foley:** Sonic Pi's CC0 samples (vinyl, snaps, impacts, swooshes) plus hand-picked CC0 freesound
   files: PhonosUPF for the froos-style "attack/slap/whirl" one-shots, and tape hiss.
5. **Synthesis covers most of the electronic style, for 0 bytes:** acid (`ftype("ladder")`, `lpenv`, `penv`), the 808
   sub, stabs, pads and noise risers. Wavetables (AKWF CC0 single cycles plus Oak-made morph tables) cost about 0.4 MB.
6. **Retire the unlicensed material.** That means the 5 tidal-drum-machines banks, the MC-303 `jazzkit`, and the GM
   fonts whose provenance I could not verify. The retirement waits until the CC0 replacements pass `/dev/listen`.
7. **Budget:** about 47 MB target, with a hard limit of 56 MiB enforced in `check.ts`. The DMG still gets *smaller*,
   because `stage.sh` stops shipping v1–v3.

---

## 1. The library

Formats: **pitched instruments** are mono (stereo where noted) MP3 at 128 kb/s with tails trimmed, the same as the
piano. **One-shot drums, breaks and foley** are FLAC (or 16-bit WAV if the FLAC spike fails, §6.2), so that onsets stay
sample-exact. Sizes are my estimates after curation. I did not measure them.

Abbreviations: VCSL = https://github.com/sgossner/VCSL (licence https://raw.githubusercontent.com/sgossner/VCSL/master/LICENSE,
"CC0 1.0 Universal"). sfzi = https://github.com/sfzinstruments.

### 1.1 Drum kits (all `.bank("<name>")`, map keys `<name>_<role>`, Oak's 14 `DRUM_ROLES`)

| Source | Licence (read) | Subset to vendor | Est. size | Oak name | Why |
|---|---|---|---|---|---|
| Virtuosity Drums (Versilian + Karoryfer), sfzi/virtuosity_drums | CC0: LICENSE https://raw.githubusercontent.com/sfzinstruments/virtuosity_drums/master/LICENSE, "CC0 1.0 Universal" | `Samples/kickmic,snaremic,oh,room`: kick (snares off), snare centre (3 velocities), cross-stick (2), hh closed/pedal/open (2 each), ride and ride bell (3), crash (1), 2 toms. Close, OH and room mixed to mono at fixed ratios | 2.0 MB | **`jazzkit`** (replaces MC-303 behind the same name) | A real, well-recorded jazz kit played with sticks. `jazzkit` has 94 references, the most of any kit |
| Swirly Drums (Karoryfer), sfzi/karoryfer.swirly-drums | CC0: https://raw.githubusercontent.com/sfzinstruments/karoryfer.swirly-drums/main/license, "CC0 1.0 Universal" | `snare_main` brush taps (3), `snare_edge` slap (2), `snare_stir` (2 stir loops, trimmed to 1 bar at 120), top+btm mixed | 1.5 MB | `jazzkit_sd` (3 variants, as today: tap, slap, stir) | Real brushes. Today's are MC-303 ROM brushes |
| Big Rusty Drums (Karoryfer), sfzi/karoryfer.big-rusty-drums | CC0: https://raw.githubusercontent.com/sfzinstruments/karoryfer.big-rusty-drums/main/LICENSE, "CC0 1.0 Universal" | `kick_24` (3 vel.), `snare_14` centre (3), rimshot (1), sidestick (1), `hihat_14` closed/open/pedal (2/2/1), `ride_22` rd/bell (2/1), `crash_17` (1), toms 14/15/18 (1 each). cl+oh+room mixdown | 3.0 MB | **`rockkit`** | The pop/rock/indie kit. It replaces `LinnDrum` in the indie flavour |
| Virtuosity Drums `Samples/lofi` mic + VCSL `clap`, `shaker_small`, `tambourine` + Oak lo-fi chain (tanh saturation, 26 kHz / 12-bit reduction, LP at 9 kHz; deterministic) | CC0 (both read above) | Same hits as `jazzkit`, from the `lofi` mic; cp 3, sh 2, tb 2. Stored at 22.05 kHz | 1.2 MB | **`lofikit`** | The coastline-style "crate" kit, made from licensed sources. A distinct name, so it is never mistaken for eddyflux's crate |
| Oak-synthesised analog voices (new `scripts/sounds/drummachine.ts`) | CC0 by construction (Oak's own code and output) | `oak909`: bd (3), sd (3), cp (2), hh (2), oh (2), rd (1), cr (1), lt/mt/ht. `oak808`: bd (long and short boom, 3), sd (3), cp, hh, oh, cb, rim, toms, sh | 1.0 MB | **`oak909`**, **`oak808`** | Electronic kits with no provenance question, from the published circuit models: sine + pitch-envelope kick, noise + tone snare, six-square metal hats. The acid-tooth 909 role |

Not taken: **eddyflux/crate** (GitHub API `license: null`, confirmed by me. AVOID: no licence, and the file names
point to commercial packs). **ritchse/tidal-drum-machines** (now `geikha/tidal-drum-machines`, API `license: null`,
confirmed. AVOID adding more, see §3.2). Unruly, Frankensnare, body_percussion, Naked Drums and DRSKit are MAYBE but
not needed. AVL, Salamander Drumkit and Sam's Sonor are CC-BY-SA per the drums report (**could not verify**, not
re-read by me; AVOID because share-alike would bind the pack files). Hydrogen kits: AVOID (mixed GPL, undeclared or
no-redistribution licences).

### 1.2 Breaks

| Source | Licence | Subset | Est. size | Oak names | Why |
|---|---|---|---|---|---|
| Oak-rendered (extend `scripts/sounds/brk.ts` into `breaks.ts`) from the CC0 kits of §1.1 + VCSL tambourine/shaker | CC0 (Oak output; inputs CC0/Unlicense) | Six original 2-bar grooves, one native tempo each. A fill in bar 2. Swing as a parameter. Deterministic round-robin selection (hit index mod N). Close/room mix, plus an optional colour chain (§1.2 note) | 3.5 MB FLAC (5.4 MB WAV) | `brk` (kept, 1 bar at 96), **`brkfunk`** (100, rockkit, tamb on 2 & 4), **`brkboombap`** (90, rockkit + lo-fi chain, 58% swing), **`brkjungle`** (170, jazzkit snares with ghosts and rolls), **`brkhouse`** (124, oak909 + VCSL shaker, open hat off-beats), **`brkjazz`** (140, jazzkit ride + brushes), **`brklofi`** (80, lofikit + Sonic Pi `vinyl_hiss` bed) | The only clean route to break material. Oak knows every onset, so each break ships a slice table (16ths → sample offsets) that lessons can use for `.slice`/`.splice` |
| Sonic Pi `loop_breakbeat` (Snapper4298 160354, "on my retro Roland 808"), `loop_mika`, `loop_garzul` | CC0 (Sonic Pi LICENSE.md, read; see §1.4) | **Not in v4.** Kept as a MAYBE for a later pack | — | — | Fine to use, but Oak's renders teach better (known tempo and onsets) |

AVOID: `yaxu/clean-breaks` (API `license: null`, confirmed; famous records), Dirt-Samples (`license: null`,
confirmed), Sonic Pi `loop_amen` and `loop_amen_full` (the Winstons recording: the CC0 label is void), and any
freesound "drum break" that names an artist or record.

Note on naming: unit-song drum parts require `/^[a-z][a-z0-9]*$/` (no underscores), and STYLE rule 3 bans `:n`
variants in authored code. So each style is a separate key, not `brk:3`. The tempo is written into the manifest
(`breaks: { brkjungle: { bpm: 170, bars: 2, onsets: [...] } }`) so that lessons can call `.loopAt(2)` correctly.

### 1.3 Acoustic instruments (upgrades behind existing aliases, plus a few new ones)

Each one is a pitched sample map, with one velocity layer and one round robin, a pitch every 3–4 semitones, tails
trimmed (4 s for plucked and struck sounds, 6 s for sustained ones), mono MP3 128 kb/s unless noted. The sample keys
are `src_<alias>`, which are never taught. The alias is registered on top (§6.3).

| Oak alias | Source | Licence (read) | Subset | Est. size | Replaces | Why |
|---|---|---|---|---|---|---|
| `rhodes` | jRhodes3d (Jeff Learman, 1977 Rhodes Mk I Stage 73), sfzi/jlearman.jRhodes3d | **CC-BY 4.0** for the samples: https://raw.githubusercontent.com/sfzinstruments/jlearman.jRhodes3d/HEAD/LICENSE, "the jRhodes samples are licensed under CC BY 4.0" | Mono set, one middle velocity layer, every sampled pitch (~13) | 1.5 MB | gm_epiano1:1 (FluidR3) | A real Rhodes: the coastline and neo-soul sound. 444 references. Needs attribution (§3) |
| `upright` | Karoryfer Sneakybass (1958 double bass, pizz), sfzi/karoryfer.sneakybass | CC0: .../karoryfer.sneakybass/HEAD/LICENSE, "CC0 1.0 Universal" | `finger`, rr1, ~12 pitches E1–G3 | 1.0 MB | gm_acoustic_bass:1 | A warm, quiet late-night pizz for jazz-soul. Alternative: D. Smolken double bass `pizz` (CC0, read, same instrument, more attack). Audition both |
| `ebass` | FreePats Clean Electric Bass "Bass Guitar YR" (pick), https://freepats.zenvoid.org/ElectricGuitar/clean-electric-bass.html | CC0, read on the page: "Creative Commons CC0 1.0 public domain dedication" | Pick variation, ~12 pitches | 1.0 MB | gm_electric_bass_pick:0 (JCLive, **provenance could not verify**) | A real Yamaha RBX bass |
| `fingerbass` | Same page, finger variation | CC0 (same page) | ~12 pitches | 1.0 MB | gm_electric_bass_finger:0 (JCLive) | Same |
| `organ` | FreePats Electric Organ, "Drawbar organ" (setBfree renders), https://freepats.zenvoid.org/Organ/electric-organ.html | CC0, read: "Published under the terms of the Creative Commons CC0 1.0..." | ~10 pitches, 6 s sustain, plus loop points if superdough `loop` works on the alias (spike) | 1.0 MB | gm_drawbar_organ:3 | A tonewheel-emulator render. Alternative: `s("user").partials(...)` drawbar synthesis |
| `cleangtr` | FreePats FSBS Electric Guitar Clean #1 (small), https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html | CC0 (read on the page) | Small SFZ set, ~12 pitches | 1.0 MB | gm_electric_guitar_clean:0 (Aspirin, **could not verify**) | A direct-sampled Fender through an amp |
| `jazzgtr` | Karoryfer Shinyguitar (archtop), `Samples/electric`, sfzi/karoryfer.shinyguitar | CC0: .../karoryfer.shinyguitar/HEAD/LICENSE, "CC0 1.0 Universal" | ~13 pitches, one layer | 1.5 MB | gm_electric_guitar_jazz:0 (JCLive) | An archtop is *the* jazz guitar. Fallback: FSBS Clean #2 (Jazz), CC0 |
| `strings` | VSCO 2 Community Edition, `Strings/{Cello,Viola,Violin} Section/susvib`, https://github.com/sgossner/VSCO-2-CE | CC0: https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/LICENSE, "CC0 1.0 Universal" | One map spanning cello (low), viola and violin (high), ~16 pitches, 6 s, **stereo** | 2.5 MB | gm_string_ensemble_1:0 (Aspirin) | Real chamber sections. Thinner than a film library, far better than GM |
| `trumpet` | VSCO 2 CE `Brass/Trumpet/sus` | CC0 (as above) | ~10 pitches | 0.8 MB | gm_trumpet:0 (FluidR3) | Real trumpet |
| `mutetpt` | VSCO 2 CE `Brass/Trumpet/harmonM-sus` (harmon mute) | CC0 | ~10 pitches | 0.8 MB | gm_muted_trumpet:0 (JCLive) | The idiomatic jazz harmon sound (J4.L02) |
| `tenor` | VCSL `sax` (tenor, non-vibrato; strudel.cc key `sax`) | CC0 (VCSL) | ~10 of 23 pitches | 0.8 MB | gm_tenor_sax:0 (JCLive) | A real tenor |
| `vibes` | VCSL `vibraphone` (hard mallets) **or** `vibraphone_soft`, chosen at `/dev/listen` | CC0 | ~11 pitches F2–E5, 5 s, stereo | 1.2 MB | gm_vibraphone:3 | Real vibes for J1 and the jazz-soul lead |
| **new** `marimba` | VCSL `marimba` (strudel.cc key) | CC0 | ~9 pitches | 0.6 MB | — | Genre colour (A2.L06). Pasted strudel.cc code works unchanged |
| **new** `kalimba` | VCSL `kalimba` | CC0 | ~8 pitches | 0.5 MB | — | Lo-fi and indie ostinati |
| **new** `glockenspiel` | VCSL `glockenspiel` | CC0 | 7 pitches | 0.4 MB | — | Indie-pop sparkle |
| **new** `conga`, `bongo`, `clave` | VCSL `conga` (8 of 34), `bongo` (6 of 28), `clave` (3 of 6) (strudel.cc keys, unpitched, `n` = variant) | CC0 | One-shots, FLAC | 0.8 MB | — | R3 Latin track (clave direction, tumbao) and funk/soul Bands |

Kept on GM for now (no clean source found or verified): `acgtr` (LK_AcousticSteel, **could not verify**; MAYBE
Shinyguitar's `acoustic` mic later), `crunch` (FluidR3, MIT, see §3.2; MAYBE run `cleangtr` through `.distort`
instead), `horns` (FluidR3; a pre-mixed VSCO trumpet + trombone section render is phase 2), `clav` (JCLive, **could
not verify**), `pad` (JCLive), `choir` (Aspirin). Not taken: Greg Sullivan E-Pianos (CC-BY 3.0 per the report, not
re-read; MAYBE for a Wurlitzer later), MTG Solo Sax (CC-BY 4.0, but its freesound upstream is **could not verify**),
FreePats steel-string guitar (GPLv3 with an exception, per the report, not re-read; AVOID), Philharmonia (AVOID,
no redistribution "as is"), mridangam (CC-BY-SA, unversioned, per the report; AVOID), Iowa MIS (no named licence;
AVOID), Karoryfer Bear Sax and Weresax (CC0; I read Bear Sax's LICENSE. MAYBE: a bari for funk horns in phase 2).

### 1.4 Textures, foley and one-shots

| Source | Licence (read) | Subset | Est. size | Oak names | Why |
|---|---|---|---|---|---|
| Sonic Pi `etc/samples`, https://github.com/sonic-pi-net/sonic-pi (pin a commit) | CC0: https://raw.githubusercontent.com/sonic-pi-net/sonic-pi/dev/LICENSE.md, "All the bundled samples are individually licensed under a CC0 1.0" (per-file freesound sources in `etc/samples/README.md`) | `vinyl_hiss` (veezay 130393, CC0 checked on freesound), `vinyl_scratch`, `vinyl_rewind`; `perc_snap`, `perc_snap2` (109400 and 158615, CC0 checked); `perc_impact1`, `perc_impact2`, `perc_swoosh`, `ambi_dark_woosh`, `ambi_glass_hum`, `ambi_drone`. Excluded: `loop_amen*`, `vinyl_backspin` (scratched "aah" vocal), `tabla_*` (dead source links), `hat_bdu` | 2.5 MB FLAC | `vinyl` (hiss bed), `scratch` (scratch, rewind), `snap` (2), `impact` (2), `swoosh` (2), `drone` (2) | Real vinyl surface noise, scratches, snaps and hits: what code cannot synthesise convincingly |
| freesound **PhonosUPF** (Universitat Pompeu Fabra) | CC0 on each page I opened: 495416 "sax slap", 495313 "sax vibrato", 494947 "sax attack" all show "Creative Commons 0" | The 3 froos IDs, plus ~12 more chosen by ear (brass attacks, creaking wood, whirls). **Each pick's page must show CC0** | 2.0 MB FLAC | `foley` (`n` 0–14) | The broken-cut palette of transformed acoustic attacks and slaps |
| freesound tape hiss: kijjaz 430975, D.S.G. 241415, kyles 452911 | CC0, checked on each page | One of them, 8 s, after listening | 0.6 MB | `tape` | A real tape bed for lo-fi. `s("pink").hpf(4000)` teaches the same idea in code |
| freesound kyles field and room beds | CC0 per page (picks not made yet) | MAYBE: 1 room tone + 1 rain/street, 10 s | (1.5 MB, optional) | `field` | Only if the budget allows |

Not taken: Kenney Impact Sounds (CC0 per the report, not re-read; game SFX, MAYBE), Sonniss GDC bundles (AVOID: no
redistribution), BBC RemArc (AVOID: non-commercial), MusicRadar/Splice/Looperman (AVOID), `sounds-tr808-fischer`
(the CC0 was applied by the Tidal maintainer, not the author; MAYBE, not needed beside `oak808`),
`sounds-repetition` (speech-synth output terms **could not verify**).

Freesound originals need a login, so the owner downloads each chosen file once (§6.1). The lock's sha256 then freezes
it.

### 1.5 Synth: no-sample recipes and wavetables

| Source | Licence (read) | Subset | Est. size | Oak names | Why |
|---|---|---|---|---|---|
| superdough 1.3.0 built-ins (already registered by `pack.ts`) | MIT/AGPL code, no samples | Expose: `sbd`; `white pink brown crackle`; `ftype("ladder")`, `drive`; `penv pattack pdecay`; `fmdecay fmsustain`; `pwrate pwsweep` | 0 | `sbd`, `white`, `pink`, `brown`, `crackle` + toolbox rows | Acid, 808 sub, risers and crackle as code (recipes: `synth.md` §4, which need an ear check) |
| AKWF-FREE, https://github.com/KristofferKarlAxelEkstrand/AKWF-FREE | CC0: https://raw.githubusercontent.com/KristofferKarlAxelEkstrand/AKWF-FREE/master/LICENSE.md, "CC0 1.0 Universal" | ~40 single cycles: `bw_saw/squ/tri/sin`, 4 `eorgan`, 4 `epiano`, 3 `ebass`, 3 `fmsynth`, 6 `vgame`, 3 `hvoice`, 3 `clavinet`, 3 `oscchip` | 0.06 MB | `wt_organ`, `wt_epiano`, `wt_bass`, `wt_fm`, `wt_chip`, `wt_voice`, `wt_clav`, `wt_basic` (`n` picks the file) | "A wave is one cycle", on the scope panel, at almost no cost |
| Oak-generated tables (new `scripts/sounds/wavetables.ts`) | CC0 (Oak output) | 4 tables × 64 frames × 2048 samples: saw→square, PWM sweep, drawbar build-up, FM-index sweep | 0.35 MB | `wt_morph`, `wt_pwm`, `wt_drawbar`, `wt_fmsweep` | `wt` and `wtenv` make "the timbre moves" audible |

Not taken: `uzu-wavetables/wt_digital` (Unlicense; I read its LICENSE, "free and unencumbered", but it is 6.3 MB of
unknown musical use: MAYBE after listening). `Dough-Waveforms` (no licence: AVOID).

---

## 2. Size budget

| Group | v3 (MB) | v4 (MB, est.) | Note |
|---|---|---|---|
| piano (Salamander) | 5.48 | 5.48 | unchanged |
| uzu-drumkit | 2.32 | 2.32 | unchanged (Unlicense; the default kit) |
| tidal-drum-machines (5 banks) | 11.22 | **0** | retired once `oak909/oak808/rockkit/lofikit` pass listening (§3.2). If they are kept: +11.2 |
| kit-jazzkit (MC-303) | 1.38 | 0 | replaced behind `jazzkit` |
| soundfonts (33 presets) | 9.29 | ~1.8 | only the 6 GM aliases still used (acgtr, crunch, horns, clav, pad, choir), alias variants only |
| oak-rendered `brk` | 0.44 | 0.44 | unchanged |
| kits (jazzkit, rockkit, lofikit, oak909, oak808) | — | 8.7 | §1.1 |
| breaks (6 new) | — | 3.5 | FLAC (5.4 as WAV) |
| acoustic aliases + new pitched | — | 15.4 | §1.3 |
| hand percussion | — | 0.8 | |
| textures and foley | — | 5.1 | (+1.5 if `field`) |
| wavetables | — | 0.4 | |
| manifest, maps, credits, break metadata | 0.01 | 0.1 | |
| **Total** | **30.1** | **≈ 44–48** | |

- **Target: 48 MiB. Hard limit: `BUDGET_BYTES = 56 * 1024 * 1024`**, enforced by `check.ts` as a failure, not a
  warning. The 8 MiB margin covers the WAV fallback for drums and breaks (§6.2) and the optional `field`.
- **The DMG shrinks.** Today the app carries v1+v2+v3 = 86 MB of sounds (`stage.sh` rsyncs all of `sounds/pack`).
  Shipping only v4 is about 47 MB, so `Oak-macos-arm64.dmg` goes from ~265 MB to about 225 MB.
- **Cut to meet the budget:** all extra velocity layers and round robins on pitched instruments; VCSL `sax_vib`,
  `sax_stacc`, harp, harmonica, xylophones, tubular bells and pipe organ; VSCO flute, winds, tuba, pizz and tremolo;
  Unruly, Frankensnare, body_percussion and Swirly's wet mics; Sonic Pi loops, arovane and tbd material; `wt_digital`;
  the GM index-0 duplicates and every replaced GM font. If the budget is still tight, cut the `field` beds first, then
  `glockenspiel`, then the `strings` stereo (go mono).

---

## 3. Licence compliance

### 3.1 Credits and attribution plan

- **Per-source metadata in `pack.config.ts`.** Every `SampleMapSpec`, `KitSpec`, alias and render gets
  `{ title, author, url, commit, licence (SPDX), licenceUrl, attribution?, modified }`. Example of `modified`:
  "selected notes; trimmed; mixed to mono; MP3 128 kb/s".
- **Pack files.** The mirror writes `credits.json` (machine-readable) and `CREDITS.md` (human-readable) at the pack
  root, both listed in the lock. It also writes `LICENSES/CC-BY-3.0.txt` and `LICENSES/CC-BY-4.0.txt`. Linking is
  enough for CC-BY, but shipping the text costs nothing.
- **Required attributions (CC-BY):**
  - "Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/), selected
    and re-encoded by Oak."
  - "Rhodes samples from jRhodes3d by Jeff Learman, https://github.com/sfzinstruments/jlearman.jRhodes3d, CC BY 4.0,
    trimmed and re-encoded by Oak." This is the form the author asks for: "state that samples are from (or based on)
    jRhodes3d".
- **Courtesy credits (CC0, Unlicense, MIT):** VCSL and VSCO 2 CE (Versilian Studios), Karoryfer Samples (Sneakybass,
  Shinyguitar, Swirly, Big Rusty), Versilian + Karoryfer (Virtuosity Drums), FreePats (Andrea Biasior's bass, the
  setBfree organ renders, FSBS guitar), Sonic Pi and the freesound uploaders (each file with its freesound URL),
  PhonosUPF, AKWF (Kristoffer Ekstrand), uzu-drumkit, FluidR3 (Frank Wen, MIT).
- **In the app.** The About page's "Sound attributions" section is rendered from `/sounds/<v>/credits.json`, plus a
  "Sounds" link in Settings. Remove the false sentence "The mirrored pack is for personal use; do not redistribute
  it." from `app/src/content/about.mdx`. `README.md` › Credits links to `CREDITS.md`. The desktop app shows the same
  About page.
- **Enforcement (`check.ts`):** every map, kit, alias and render must carry a licence from the allow-list `CC0-1.0`,
  `Unlicense`, `MIT`, `CC-BY-3.0`, `CC-BY-4.0`. CC-BY entries must also have `attribution`. Anything else fails,
  except the explicit, dated `LicenseRef-undeclared` exception of §3.2 option (a), if the owner chooses it.

### 3.2 Honest note on the existing pack

- **tidal-drum-machines (11.2 MB, 5 banks) and the MC-303 `jazzkit` (1.4 MB).** The GitHub API reports
  `license: null`; I confirmed this today (the repo is now `geikha/tidal-drum-machines`). There is no LICENSE file, and
  the README states no provenance. These are captures of commercial machines; several (LinnDrum, TR-707, the 909's
  cymbals) are ROM samples. The 808 and 909 drums are analog voices. strudel.cc serves them from its CDN, but that is
  not a licence Oak can rely on for a public DMG.
  - **(a) Keep and document:** zero work. CREDITS states "no licence declared upstream; redistributed as the Strudel
    project does; removed on request". Some risk remains.
  - **(b) Replace with CC0 equivalents (recommended):** `oak909`/`oak808` replace RolandTR909/TR808 at U01.L03.
    `rockkit`/`lofikit` replace LinnDrum/AkaiLinn/RolandTR707 at U01.L09. `jazzkit` is rebuilt from Virtuosity +
    Swirly. The flavour drums become `rockkit` (indie) and `oak808` (funk). This costs lesson edits in U01.L03 and
    U01.L09 and about 100 bank references in Bands and lessons (`grep -rn 'RolandTR\|LinnDrum\|AkaiLinn' content`).
    The five `snd.bank.*` IDs are **retired** (never renamed, contracts §1.1). It saves 12.6 MB. Do not alias
    `RolandTR909` → `oak909`: that would present Oak's synth as Roland's sound.
  - **(c) Hybrid:** ship (b), and keep a tidal bank only if `/dev/listen` shows the Oak render clearly fails, labelled
    with option (a)'s note.
- **GM soundfonts (`felixroos/webaudiofontdata`, 9.3 MB).** The repo is MIT (API), but that covers the conversion. The
  sample data comes from each source SoundFont:
  - **FluidR3 (Frank Wen):** MIT. I read it in MuseScore's `FluidR3Mono_License.md`, which says FluidR3 was shared
    "under the MIT license". It is used today by rhodes, upright, organ, crunch, horns, trumpet and vibes.
  - **GeneralUser GS:** **could not verify** (the author's page did not show the terms in what I read).
  - **JCLive, Aspirin, LK_AcousticSteel, Stratocaster:** **could not verify**. These sit behind `ebass`,
    `fingerbass`, `jazzgtr`, `cleangtr`, `strings`, `tenor`, `mutetpt`, `clav`, `pad`, `choir` and `acgtr`, plus every
    index-0 preset.
  - **Options:** replace (v4 does this for 8 of the 11 unverifiable ones, §1.3); drop the index-0 duplicates that no
    alias uses (pasted strudel.cc `gm_*` code stops sounding, which the lint already discourages); and document the
    remaining `clav`, `pad`, `choir` and `acgtr` as "source SoundFont licence not verified" until replaced. Candidate
    replacements: `pad` as a supersaw synth alias, `clav` from AKWF `clavinet` cycles or VCSL `clavisynth` (CC0),
    `choir` as an Oak formant render, `acgtr` from Shinyguitar's `acoustic` mic.
- **uzu-drumkit** is Unlicense (API: `unlicense`), fine. **Salamander** is CC-BY 3.0: add the licence link and the
  modification note, which are missing today. **`brk`** is CC0, fine.

---

## 4. The electronic style kit (contracts §5.10 `FlavourKit`)

```ts
defineFlavour({
  id: "flavour.electronic",
  title: "Electronic",
  drums: "snd.bank.oak909",        // Oak-synthesised 909-style kit (CC0). Fallback before unlock: default kit
  bass: "snd.wave.sawtooth",       // the acid/sub line is code on a saw (Band adds the acid controls; §4 bass)
  chords: "snd.wave.sawtooth",     // house stab: saw + lpf + short lpenv; unlocks U02.L06, so starters swap early
  lead: "snd.wave.square",         // plucky square lead with delay
  chordDepth: "seventh",           // m7/m9 stabs; triads before seventhsFrom
  production: {
    room: 0.2,                     // dry, club-like
    bassLpf: 700,                  // the acid base cutoff; the Band's lpenv opens above it
    humanizeVelocity: 0.08,        // required constant (PRODUCTION_RANGES)
    pan: { drums: 0.5, bass: 0.5, chords: 0.4, lead: 0.6 },
  },
}),
// FLAVOUR_RULES: "flavour.electronic": { ships: "S1" /* new value */, seventhsFrom: "U06.L10", feel: "straight" }
```

- **Drums.** `oak909` for house and acid-tooth: kick on every beat, clap on 2 & 4, open hat off-beats, 16th closed
  hats. `oak808` for electro and trap-ish halves. Breaks (`brkhouse`, `brkjungle`) appear in unit-song code where a
  song has a break section.
- **Bass recipes** (in the Band kit as a new `bassFx` string; parameter names verified in superdough 1.3.0 by
  `synth.md`, values need an ear check):
  - *acid*: `.s("sawtooth").ftype("ladder").lpq(16).lpenv("<4 2 2 6>*8").lpd(.18).lps(0).decay(.22).sustain(.35).distort(1).distorttype("diode")`,
    accents via `.gain`, slides via `.penv(-12).pattack(.06)` on chosen notes. Then the template's own `.lpf(700)`.
  - *sub* (electronic ballad sections): `.s("sine").penv(12).pdecay(.06).decay(1.2).sustain(0).shape(.3)`.
  - Starter swap: learners write `s("sawtooth")` from U02.L06 on (the swap engine only swaps the name). The acid
    controls arrive with A1.L02.
- **Chords and pads.** Band chords: a saw stab, `.lpf(1200).lpenv(3).lpd(.12).decay(.18).sustain(0)`, sidechained
  with `.orbit(2).duckorbit(2)`-style ducking (A2.L05 tools; the Band may use them). Pads in unit songs:
  `supersaw` with `unison(7).detune(.25)`, slow attack, `lprate` drift.
- **Lead.** `square` with `.decay(.15).sustain(0).lpf(900).lpenv(4).delay(.35).delaytime(.1875).delayfeedback(.45)`.
- **Textures.** Not in the FlavourKit shape (it has only four roles). Unit songs may add an `fx:` track:
  `s("white").attack(4).lpf(saw.range(500,8000).slow(4))` as a riser into a section, and `s("crackle")` for lo-fi
  breakdowns, but only if the unit-song schema allows a fifth track. Otherwise there are none.
- **Consequences** (oak.md §5): the `FlavourId` union, `FLAVOUR_IDS` and the flavour regex in
  `packages/content-kit/src/ids.ts`; electronic code in all 23 Bands and every unit song (the zod schema requires every
  flavour); `FLAVOUR_RULES.ships` gains a value; app surfaces (`format.ts`, `album/cover.ts`, the style picker,
  `capstone/content.ts`); about 40 tests that enumerate flavours. Electronic must keep the same chord roots, bass
  downbeats and lead pitches as the other flavours (§5.11 rule 7).

---

## 5. Folding across the course

Rules applied: contracts §3.1. Unlocks are declared only in `content/toolbox.ts`. A new sound is used in learner
code only at or after its unlock site in every legal order. Bands, unit songs and `preview: true` examples may use
anything (rule 5). An upgrade **behind an existing alias changes no row and no unlock**.

### 5.1 Upgrades behind existing names (no unlock change; everything improves)

| Name | Unlock (unchanged) | Who hears it |
|---|---|---|
| `jazzkit` | J1.L01 | jazz-soul Band from U01, J1–J5, AC2 |
| `rhodes` | U05.L08* | U00.L01 preview, jazz-soul Band from U01, AC2 (`sounds` must contain `snd.rhodes`) |
| `upright` | U05.L06 | jazz-soul Band, J tracks |
| `ebass` | C1.S1 START (rule 12) | U00.L01, pop and indie Bands, most Makes |
| `fingerbass` | U08.L05 | funk Band, R1, RC1 |
| `organ` | U05.L08* | funk lead, gospel/soul colours |
| `cleangtr`, `jazzgtr` | U13.L02, U12.L06 | indie Band; jazz comping |
| `strings` | U10.L09 | minor ballads, A2.L05 mix |
| `trumpet`, `mutetpt`, `tenor`, `vibes` | U15.L05, J4.L02, U16.L05, J1.L01 | leads |

### 5.2 New rows (`content/toolbox.ts` + contracts §3.2)

| New row ID | Matches | Unlock at | Justification (what that lesson teaches) | Preview / Band use |
|---|---|---|---|---|
| `snd.bank.oak909`, `snd.bank.oak808` | `oak909`, `oak808` | **U01.L03** "Backbeat" (replacing the retired TR909/TR808 rows; "drum-machine timbre") | Where banks are first taught | electronic Band (909), funk Band (808), U00.L01 preview (808, as the TR808 row had) |
| `snd.rockkit`, `snd.lofikit` | `rockkit`, `lofikit` | **U01.L09** "Copy That Groove" (replacing LinnDrum/AkaiLinn/RolandTR707; "copying grooves") | Transcribing grooves on different kits | indie Band (rockkit); jazz-soul unit-song lo-fi sections (lofikit) |
| `snd.noise` | `white pink brown crackle` | **A1.L02** "Filters & Filter Envelopes" | Noise is the clearest thing to filter: a riser is noise plus an `lpf` sweep | electronic risers in unit songs |
| `tb.ftype` | `ftype("ladder")` | **A1.L02** | Resonance: the ladder's squelch is the acid sound | electronic Band bass |
| `snd.sbd`, `tb.penv` | `sbd`; `penv pattack pdecay` | **A1.L03** "Envelopes" | A kick is a sine with a pitch envelope; 808 sub "drop"; slides | electronic Band (sub, slides) |
| `tb.drive`, `tb.density` | `drive`; `density` | **A1.L05** "Grit" | Saturation (ladder drive); crackle density as lo-fi grit | — |
| `snd.textures` | `vinyl tape` (+ `field`) | **A1.L05** "Grit" | Lo-fi colour = saturation + bit reduction + a noise bed | lo-fi sections in jazz-soul and electronic songs |
| `snd.wt` | `wt_organ wt_epiano wt_bass wt_fm wt_chip wt_voice wt_clav wt_basic wt_morph wt_pwm wt_drawbar wt_fmsweep` | **A1.L01** "Waves & Harmonics" | A wave is one repeating cycle; the scope shows each table's shape | — |
| `tb.wt` | `.wt() .wtenv .wtrate .wtdepth` | **A1.L06** "Movement" | Timbre that moves (frame position under an LFO) | — |
| `snd.breaks` | `brkfunk brkboombap brkjungle brkhouse brkjazz brklofi` | **A2.L04** "Sampling" | Choosing, fitting and chopping breaks; native tempo vs `.speed` (pitch) | unit songs: break sections in every flavour |
| `snd.foley` | `foley snap impact swoosh scratch drone` | **A2.L04** | The broken-cut idea: chop and `ply` one-shots | electronic and lo-fi Bands |
| `snd.drum.clave` | `clave` | **R3.L02** "Clave Direction" | The clave is the instrument whose pattern the lesson teaches | funk/soul Bands |
| `snd.drum.conga`, `snd.drum.bongo` | `conga`, `bongo` | **R3.L04** "Montuno & Tumbao Layering" | The conga tumbao layer | funk Band percussion |
| `snd.marimba`, `snd.kalimba`, `snd.glockenspiel` | same | **A2.L06** "Genre Translation" | One idea in two idioms needs idiomatic timbres | indie and pop Bands (preview) |

Rule notes:
- `snd.noise`, `snd.wt`, `snd.breaks`, `snd.foley` and `snd.textures` are one row each with several `matches`,
  like `tb.lpenv`. That keeps each session's new-tool count to one or two (authoring caps §9.2).
- A1.L01–L04 open after U03.L02 and A1.L05–L07 after U09.CP, so these rows never collide with the voicing gate. A1
  lessons stay optional, so no core lesson may *require* `snd.noise` or `sbd`.
- If option §3.2(b) is not taken, `oak909`/`oak808` take U01.L03 as a **second** site beside the TR rows, and
  `rockkit`/`lofikit` take U01.L09 the same way (rule 11 alternative sites are not needed: one session, two rows).

### 5.3 Lessons and Makes to edit

- **A1 (sound design).**
  - A1.L01: add one listening/scope step comparing `sawtooth` to `wt_organ`/`wt_epiano` (single cycles).
  - A1.L02: the Make becomes an **acid line** (`sawtooth` + `ftype("ladder")` + `lpq` + `lpenv`), with a noise riser
    as a worked example.
  - A1.L03: `sbd` and `penv` ("a kick is a falling sine"; 808 sub).
  - A1.L05: `drive`, `distorttype("diode")` on the acid line, and a lo-fi step (`lofikit` + `crush`/`coarse` +
    `vinyl`).
  - A1.L06: `wt_morph` with `wtrate`.
  - A1.L07: a comparison step, FM e-piano vs the new sampled `rhodes` ("why samples still matter").
- **A2.L04 (sampling).** Keep `brk` as the first object. Add a step "the same break at its own tempo vs sped up":
  `brk` at 96 → `.speed(1.77)` vs `brkjungle` at 170, the pitch–tempo link. The Make becomes froos-style: chop a
  break with `.slice(16, …)` + `.ply`, plus `foley` one-shots with `.chop`/`.striate`. Use the slice table so the
  grader's onsets are exact.
- **A2.L05 (mix):** swap the `square` lead stem for `rhodes`/`strings` stems. No unlock change.
- **U01.L03 / U01.L09:** bank edits under §3.2(b).
- **U02.L06 (Tones & Timbres):** add `vibes` and `marimba` to the "Name the sound" listening trials as
  `preview: true` options only. No unlock.
- **J1.L01:** none (the upgraded `jazzkit` and `vibes` arrive by name). Re-measure the swing fixtures.
- **R3.L02 / R3.L04:** clave and conga parts in the Makes.
- **AC2 (Neo-Soul Ballad):** the starter's drums become `lofikit` plus `vinyl` (both unlocked by then: AC2 opens
  after A.CP).
- **Bands:** indie drums → `rockkit`; funk drums → `oak808`; electronic as §4. Optional `conga`/`clave` layers in funk
  Bands.

---

## 6. Implementation checklist

Paths are relative to the repo root (`/Users/fpl0/Code/Oak` main, or the `songs` worktree).

### 6.1 Source acquisition

1. Pin each GitHub source to a commit SHA: VCSL, VSCO-2-CE, jRhodes3d, karoryfer.sneakybass, karoryfer.shinyguitar,
   virtuosity_drums, karoryfer.swirly-drums, karoryfer.big-rusty-drums, AKWF-FREE, sonic-pi. Record
   `raw.githubusercontent.com/<owner>/<repo>/<sha>/<path>` per file. Never clone a whole repo.
2. FreePats zips (bass, organ, FSBS Clean #1): download once, pin the zip URL plus its sha256, and extract only the
   chosen WAV/FLAC files at mirror time.
3. Freesound: the owner, logged in, downloads the originals (3 froos IDs, ~12 PhonosUPF picks, one tape hiss). They are
   committed to a small **public** repo `oak-sounds-src` (or `sounds/vendor/freesound/` in Oak), with one
   `sources.json` row per file: `{ id, url, author, licence: "CC0-1.0", checkedOn }`. The mirror fetches them by SHA.
4. Spike first (half a day):
   - (a) A pinned pure-JS MP3 encoder (e.g. lamejs, exact version) and FLAC codec give the same bytes on two machines.
   - (b) Chromium's `decodeAudioData` onset offset for MP3 vs FLAC.
   - (c) superdough `loop`/`loopBegin` on a sample alias for organ and strings sustain.
   - (d) Safari decodes FLAC.
   Decide FLAC or WAV for drums and breaks from (b) and (d).

### 6.2 `scripts/sounds/pack.config.ts`

1. `PACK_VERSION = "v4"`, plus a changelog line: "v4: CC0/CC-BY library; sample-backed aliases; kits jazzkit (rebuilt),
   rockkit, lofikit, oak909, oak808; breaks; foley and textures; wavetables; credits; tidal banks retired."
2. Extend `SampleMapSpec`:
   - `mapUrl?` / `filesBase?` (pinned host);
   - `inline?: Record<key, files|{note: file}>` (Oak-written maps);
   - `decodePercent?: true` (VCSL);
   - `transcode?: { to: "mp3"|"flac"|"wav", mono, trimSec, rate? }`;
   - `credit: { title, author, url, commit, licence, licenceUrl, attribution?, modified }`.
   - New entries: `vcsl` (keep `sax vibraphone marimba kalimba glockenspiel conga bongo clave clap shaker_small
     tambourine`, with variant caps as in §1.3), `vsco` (inline map), `jrhodes`, `sneakybass`, `freepats-bass`,
     `freepats-organ`, `freepats-gtr`, `shinyguitar`, `sonicpi`, `foley`, `akwf`.
3. `AliasSpec` becomes a union: `{ kind?: "gm", gm, variant, ... } | { kind: "sample", sample: "src_<alias>", gain?,
   release?, range? }`. Move the 12 upgraded aliases to `kind: "sample"`. Prune `GM_VARIANTS` to the 6 remaining GM
   aliases' variants.
4. `KitSpec`: allow `render: "mixdown"` sources (multi-mic files plus mix ratios) and `credit`. Rewrite `jazzkit`; add
   `rockkit`, `lofikit`, `oak909`, `oak808`. Remove the tidal map entry, `DRUM_BANKS` and `BANK_ALIAS_JSON` under
   §3.2(b).
5. `BREAKS: Record<name, { bpm, bars, kit, groove, swing, chain }>` for the renderer.

### 6.3 Build scripts

1. `scripts/sounds/mirror.ts`:
   - honour `mapUrl`/`filesBase`/`inline`;
   - percent-decode before `isSafeSamplePath`, and encode once for the fetch;
   - run the transcode, mixdown, breaks, drum-machine and wavetable steps as `derived: true` files with
     `sourceUrl: "generated:<script>(<inputs>, <licence>)"`;
   - sniff `fLaC` in `validate()`;
   - write `credits.json`, `CREDITS.md`, `LICENSES/*` and `breaks.json` (bpm, bars, onsets), all locked;
   - set `BUDGET_BYTES = 56 * 1024 * 1024`;
   - put `sampleAliases`, `credits` and `breaks` in `manifest.json`.
2. New `scripts/sounds/transcode.ts` (pinned decoders and encoders; mono fold-down, trim with a 30 ms fade, peak
   normalise to −1 dBFS), `scripts/sounds/mixdown.ts` (multi-mic → one-shot), `scripts/sounds/breaks.ts` (generalise
   `brk.ts`: multi-bar tables, round robins, swing, colour chain; keep `brk` byte-identical),
   `scripts/sounds/drummachine.ts` (oak909/oak808), `scripts/sounds/wavetables.ts` (2048-sample frames).
3. `scripts/sounds/check.ts`: budget failure; licence allow-list plus `attribution` required for CC-BY; every
   `sampleAliases` target exists; every kit role file exists; `credits.json` covers every locked non-manifest file.
4. Run `bun scripts/sounds/mirror.ts --dry-run`, then `--update`, then commit `sounds/pack.lock.json`.

### 6.4 Runtime (`packages/strudel`)

1. `src/pack.ts`:
   - register `manifest.sampleAliases`: look up `src_<alias>` in `soundMap`, then
     `registerSound(alias, withOutputGain(entry.onTrigger, gain, release), { type: "sample", samples: entry.data.samples, tag: "oak", range })`,
     so that `packFileUrls` and the preloader see it as a sample;
   - set `OAK_KITS = ["jazzkit","rockkit","lofikit","oak909","oak808"]`;
   - make `packFileUrls` add `credits.json`, `breaks.json` and `data.type === "wavetable"` tables.
2. `src/preload.ts`: warm sample aliases (nearest note within `range`) and wavetables, by triggering a silent hap or
   calling `tables(...)` ahead, so that the first note is not dropped.
3. `src/types.ts`: manifest types for `sampleAliases`, `credits` and `breaks`.
4. `src/audibility/cases.ts`:
   - `SOUND_CASES` for every new row: `oak909`, `oak808`, `rockkit`, `lofikit`, each break, `foley`, `vinyl`, `tape`,
     `snd.noise` (`s("pink")`), `sbd`, `wt_organ`, `clave`, `conga`, `bongo`, `marimba`, `kalimba`, `glockenspiel`;
   - control cases for `tb.ftype` (base `s("sawtooth").lpf(400).lpq(15)`), `tb.penv`, `tb.drive`, `tb.wt`;
   - `QUALITY_CASES` for every sample alias and every new pitched instrument.
5. Re-run `e2e/audibility.pw.ts` → `audibility.json` and `e2e/quality.pw.ts` → `sound-quality.json` (±10 c, octave,
   no click, ±1.5 LU vs piano; triads ±3 LU). Re-measure `e2e/wave{4,5,6,7}*.ts` and `sound-wave{5,6,7}.json`.
6. `e2e/pack-root.ts` `SOUNDS_ROOT = "/sounds/v4"`; `app/src/workbench/standalone-services.ts`
   `STANDALONE_SOUNDS_ROOT = "/sounds/v4"`.

### 6.5 Lint, grader, notation

1. `packages/grader/src/lint/oak.ts` `DRUMS`: add `clave conga bongo foley snap impact swoosh scratch drone vinyl tape
   field` and the six `brk*`.
2. `packages/grader/src/lint/safety.ts`: add `tables` to `SAMPLE_LOADERS` (blocks remote wavetables from learner
   code).
3. `packages/grader/src/normalize/nevent.ts` `DRUM_MAP`: `clave`/`conga`/`bongo` → `perc`; `brk*` → `perc`;
   `foley`/`snap`/`impact`/`swoosh`/`scratch` → `perc`; `sbd` → `kick`. Watch the `xxx_yyy` stripping: `wt_*` is
   pitched and must stay `null`.
4. `packages/notation/src/drums.ts` `BY_SOUND`: clave, conga, bongo, sbd. `packages/drills/src/build.ts` and
   `app/src/drills/DrillRunner.tsx` only if drills use them.

### 6.6 Content

1. `content/toolbox.ts`: rows of §5.2; `inst(...)` text for the 12 upgraded aliases (`code`/`meaning`/`strudelCc`:
   e.g. `rhodes (jRhodes3d, CC-BY)`, with `strudelCc` `.s("gm_epiano1")` → none or the VCSL key); under §3.2(b)
   retire the five `snd.bank.*` rows (and `snd.bank.*` IDs stay in `ids.lock.json` as retired).
2. `docs/design/contracts.md`: §3.2 tables F/G/H, §5.10 table plus electronic row and rules, the change-log row.
   Then `content/validate/contracts-sync.test.ts`.
3. `bun scripts/content/build.ts` → `content/ids.lock.json`.
4. `app/src/toolbox/demos.ts` / `demos-w7.ts`: a demo per new row (A1/A2 rows in `demos-w7.ts`).
5. `content/STYLE.md` §4: allowed drum names, kits and aliases. `content/terms.ts`: "break", "foley", "wavetable",
   "ladder filter".
6. `content/flavours.ts` (+ `FLAVOUR_RULES`); `packages/content-kit/src/ids.ts` (FlavourId, `FLAVOUR_IDS`, regex);
   `content/bands/index.ts` (`KITS["flavour.electronic"]` with `bank: "oak909"`, `bass: "sawtooth"`, `chords:
   "sawtooth"`, a new `bassFx`; indie `bank: "rockkit"`, funk `bank: "oak808"`); every `content/unit-songs/*.ts`;
   `content/capstones.ts`; app surfaces (`app/src/lib/format.ts`, `app/src/album/cover.ts`,
   `app/src/capstone/content.ts`, the song style picker); `app/src/onboarding/prefs.ts` `withInstalledBanks()` for the
   new kits.
7. Lessons of §5.3: `lesson.ts`/`lesson.mdx` plus version bumps (§11.7) and `content/specs/<UNIT>.md|ts`. Run
   `bun run content:check <lesson> --verbose` and `bun test content`.

### 6.7 Serving, Service Worker, desktop, credits UI

1. `app/public/sw.js`: no code change. `PACK_VERSION` comes from `/sw.js?pack=<v>`, and `oak-sounds-v3` is deleted on
   activate. Precache works through `packFileUrls` once §6.4.1 is done. Optional: a Settings button "Download all
   sounds (≈47 MB)" that posts the existing `precache` message (the browser build only; desktop serves locally).
2. `server/src/static.ts`: none needed (`.flac`/`.mp3`/`.wav`/`.json` are already typed).
3. `desktop/scripts/stage.sh`: `V=$(jq -r .packVersion "$ROOT/sounds/pack.lock.json")`;
   `rsync -a "$ROOT/sounds/pack/$V" "$OAK/sounds/pack/"`. Release worktrees copy `sounds/pack/v4` and the lock from
   main.
4. `app/src/content/about.mdx`: render the credits from `/sounds/<v>/credits.json`; delete the "personal use" line.
   `README.md` › Credits: link `CREDITS.md`, name the CC-BY works.
5. `/dev/listen` (`app/src/routes/dev/-components/ListenPage.tsx`): list sample aliases, kits and breaks for the
   owner's listening verdicts. Gate §3.2(b) on those verdicts.

### 6.8 Order of work

1. Spike (§6.1.4).
2. Mirror and pack (§6.2–6.3) with aliases only.
3. Runtime alias kind and harnesses (§6.4).
4. Listening pass.
5. Kits and breaks.
6. Retire the tidal banks (§3.2b) and edit content (§6.6).
7. Electronic flavour.
8. Credits UI, stage.sh, release.
