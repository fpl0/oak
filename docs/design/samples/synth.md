# Synthesis and wavetables: what Oak can make with no samples

Scope: what superdough 1.3.0 (installed with @strudel/webaudio 1.3.0 and @strudel/core 1.2.6) can produce with no
samples, what Oak already exposes, wavetable sources and their licences, and synth-only recipes for the electronic
style (TB-303 acid, 808 sub, house organ and stab, pads, plucks, drums).

Everything under "Verified in source" comes from reading
`/Users/fpl0/Code/Oak-wt/songs/node_modules/superdough/*.mjs` (synth.mjs, helpers.mjs, noise.mjs, zzfx.mjs,
wavetable.mjs, sampler.mjs, superdough.mjs, worklets.mjs) and `@strudel/core@1.2.6/controls.mjs`.
The recipes have not been played by ear. Each one needs a listening check before it goes into lesson content.

---

## 1. Verified in source: built-in sounds (`registerSynthSounds` + `registerZZFXSounds`)

Oak already calls both functions in `packages/strudel/src/pack.ts:197-198`, so every sound below is available in
Oak today.

| `s("…")` | Engine | Parameters it reads (exact names) |
|---|---|---|
| `sine` `triangle` `square` `sawtooth` (aliases `sin` `tri` `sqr` `saw`) | WebAudio OscillatorNode, gain 0.3 | ADSR (`attack decay sustain release`, defaults 0.001/0.05/0.6/0.01), `partials`, `phases`, `noise` (pink-noise dry/wet mix), `vib` `vibmod`, pitch envelope `penv pattack pdecay psustain prelease pcurve panchor`, FM `fm/fmi fmh fmwave fmattack fmdecay fmsustain fmrelease fmenv` (up to 8 operators: `fm2…fm8`, matrix `fmi12`, etc.) |
| `user` | Additive (PeriodicWave). Falls back to triangle if no partials are set | `partials([...])` gives sine-partial magnitudes, plus `phases` |
| `supersaw` | AudioWorklet `supersaw-oscillator` | `unison` (default 5, 1-100), `detune` (default 0.18; **falls back to `n`**), `spread` (pan spread, default 0.6), ADSR, pitch env, vib, FM |
| `pulse` | AudioWorklet `pulse-oscillator` | `pw` (default 0.5), `pwrate`, `pwsweep` (PWM LFO; setting `pwrate` alone gives sweep 0.3), ADSR, pitch env, vib, FM |
| `sbd` | Synth kick: triangle through tanh saturator, with a brown-noise click | `note` (default **29 = F1**), `decay` (0.5), `pdecay` (0.5), `penv` (**36 semitones**), `clip` |
| `white` `pink` `brown` `crackle` | Noise buffers, gain 0.3 | ADSR; `density` (crackle, default 0.02) |
| `zzfx` `z_sine` `z_sawtooth` `z_triangle` `z_square` `z_tan` `z_noise` | ZzFX buffer synth (rendered per hap) | `zrand curve slide deltaSlide pitchJump pitchJumpTime lfo znoise zmod zcrush zdelay tremolo` + ADSR |
| `bytebeat` | Worklet that compiles a string into code | Oak's lint already refuses `bbexpr`/`byteBeatExpression` (`packages/grader/src/lint/safety.ts`). **Do not teach.** |
| `one`, `bus` | Modulation constant and bus input | Not musical sources |

**There is no synth snare (`sd`) in superdough 1.3.0.** `sbd` is the only synth drum. Snares, hats and claps
have to be built from noise (section 4).

Gotchas found in the source:

- On the stock waves, `n` doubles as `partials`. In `getOscillator`, `partials = value.partials ?? value.n`, so
  `s("sawtooth").n(4)` gives a 4-harmonic saw, not variant 4. `scale()` removes `n` before it reaches superdough
  (`@strudel/tonal` `scale` rebuilds the value as `{...otherValues, note}`), so `n("0 2 4").scale(..).s("sawtooth")`
  is safe.
- On `supersaw`, `n` doubles as `detune`: `detune = detune ?? n ?? 0.18`. The same `scale()` caveat applies.
- The pitch envelope's defaults change depending on which parameters are set (`getADSRValues`):
  - `.penv(x)` alone gives attack 0.2 s and sustain 1, with anchor = sustain. The pitch starts `x` semitones
    **below** the note (above it if `x` is negative) and glides to the note in 0.2 s. That is a usable portamento
    or slide.
  - `.penv(x).pdecay(d)` (decay set, attack not set) gives sustain 0.001. The pitch jumps to `+x` and falls back
    to the note over `d`. That is the 808 or tom "drop".
- Filters: `lpf/cutoff`, `lpq/resonance`, `hpf`, `hpq`, `bpf/bandf`, `bandq`. Filter envelopes use `lpenv lpa lpd
  lps lpr` (and the `hp`/`bp` equivalents) plus `fanchor`. Filter LFOs use `lprate lpsync lpdepth lpshape lpdc
  lpskew`.
- `ftype`: `12db` (default biquad), `24db` (two biquads in series), or `ladder` (worklet Moog-style 4-pole with
  tanh stages).
  - On `ladder`: resonance `k = min(8, q*0.13)`, so `lpq` 10-25 is the squelch range and self-oscillation starts
    around `lpq` 30.
  - `drive` scales the input by `exp(drive)` (default 0.69, about x2) and is ladder-only.
  - Cutoff is read once per 128-sample block, so envelopes are block-rate. That is fine for acid.
- Distortion: `distort` + `distorttype` ∈ `scurve soft hard cubic diode asym fold sinefold chebyshev`,
  `distortvol`. Also `shape` (+`shapevol`), `crush`, `coarse`.
- Movement and mix: `vowel`, `phaser*`, `tremolo/tremolosync/tremolodepth/tremoloshape`, `compressor`, `pan`,
  `room*`, `delay*`, `orbit`, and the sidechain duck `duckorbit duckdepth duckattack duckonset`. Also `transient`
  (+`transsustain`) and `stretch` (phase vocoder).
- **No glide or legato/portamento control exists**: `grep glide|portamento superdough/*.mjs` finds nothing. Acid
  slides have to be approximated per note with `penv` (section 4.1).
- Every control used in this report exists in `@strudel/core@1.2.6/controls.mjs`. One exception: `partials` and
  `phases` are Pattern methods in `pattern.mjs:3709`, not `registerControl` entries. Both work.

## 2. Verified in source: wavetables in 1.3.0

- **How a sound becomes a wavetable.** `sampler.mjs registerSampleSource`: any sample-map key that starts with
  `wt_` is registered by `registerWaveTable` instead of as a sample (`data.type: 'wavetable'`, `data.tables:
  [urls]`). The second way is `tables(url, frameLen, json)` (wavetable.mjs). Both are exported through
  `superdough/index.mjs`, so they are also in Strudel's eval scope.
- **Engine.** AudioWorklet `wavetable-oscillator-processor`. The file is decoded at its native WAV rate and cut
  into frames of `frameLen` samples (default **2048**). A file shorter than one frame becomes one frame of its
  own length, because `_sampleFrame` uses `frame.length`. A single-cycle AKWF file (600 samples) therefore plays
  correctly as a static wave.
- **Morphing needs the file to be a multi-frame table with the frame length the loader expects.**
  `samples()`/`registerSampleSource` never passes `frameLen`, so tables loaded through Oak's normal sample-map
  path must use **2048-sample frames**.
- **Controls** (read in `onTriggerSynth`):
  - `n` selects the table file.
  - `wt` is the frame position, 0-1. Envelope: `wtenv wtattack wtdecay wtsustain wtrelease`. LFO: `wtrate wtsync
    wtdepth wtshape wtskew wtdc`.
  - `warp` and `warpmode` ∈ `none asym mirror bendp bendm bendmp sync quant fold pwm orbit spin chaos primes binary
    brownian reciprocal wormhole logistic sigmoid fractal flip`. Warp also has env and LFO variants
    (`warpenv warpattack …`, `warprate warpsync warpdepth …`).
  - Unison: `unison`, `detune`, `spread`, `wtphaserand`. Also ADSR, pitch envelope, `vib` and FM.
- **Read path.** Frames are read with linear interpolation, crossfading between adjacent frames. I saw no
  band-limiting or mipmapping in the read path, so bright tables at high notes may alias. Check by ear.
- **Oak-specific gaps** (these must be fixed before wavetables ship in the pack):
  1. `pack.ts packFileUrls` lists only `data.type === "sample"` entries, so wavetable files would be left out of
     the offline file list and the bytes count.
  2. `preload.ts warmValue` returns `"synth"` for anything that is not a sample or a soundfont, so wavetables are
     never warmed. The loader in `onTriggerSynth` awaits the fetch and then returns silently if
     `ac.currentTime > t` (`"still loading"`), so **the first note of a cold wavetable is dropped**. The loader's
     cache (`loadCache`, `getPayload`) is module-private. To warm a table, either trigger a silent note at gain 0
     or call `tables(url, 2048, {wt_x: [...]})` and play one hap ahead.
  3. Offline rendering (`renderPatternAudio`) would hit the same first-note skip unless tables are warmed first.
  4. `assertLocal` already forces local URLs for `manifest.sampleMaps`, so a `wt_*` map inside the pack is fine.
     The learner can still call `tables("github:...")` in code. `tables` is not in the grader's `SAMPLE_LOADERS`
     set (only `samples` and `aliasBank` are; `packages/grader/src/lint/safety.ts:135`). Add it, or Oak's
     offline-first rule can be broken from code.

## 3. What Oak already exposes (`content/toolbox.ts`, `packages/strudel/src/pack.ts`)

- **Waves:** `sine triangle square sawtooth` (U02.L06), `supersaw` and `pulse` (A1.L07).
- **Template:** `tb.template.synthbass` = `note(…).s("sawtooth").lpf(600)` (U08.L05).
- **Controls already in the toolbox:**
  - Filters: `lpf hpf bpf lpq`, `lpenv` with `lpa lpd lps lpr` (A1.L02), `lprate/lpdepth` (A1.L06).
  - Envelope: ADSR (A1.L03).
  - Space: `room roomsize delay delaytime delayfeedback orbit`.
  - Grit: `distort` (with `distorttype`), `crush coarse` (A1.L05).
  - Movement: `vib/vibmod phaser tremolo` (A1.L06).
  - Sources: `fm/fmh` (A1.L07), `unison/detune/spread`, `pw` (A1.L07), `partials` (A1.L01).
  - Mix: `compressor postgain duckorbit/duckdepth` (A2.L05).
- **Not exposed yet:**
  - Sources: `sbd`, the noise sources (`white pink brown crackle`), the ZzFX sounds, `user` + `partials` as an
    organ source, wavetables.
  - Filter and drive: `ftype("ladder")`, `drive`.
  - Envelopes and modulation: the pitch envelope (`penv pattack pdecay`), the FM envelope (`fmdecay` …), `pwrate`.
  - Other: `noise` (the oscillator noise mix).
- `SILENT_CONTROLS` (never taught): `leslie lrate lsize amp squiz triode ring`. None of those are needed below.
- The pack already has TR-909/808/707, LinnDrum and AkaiLinn banks (`scripts/sounds/pack.config.ts:39`). Their
  licence is unknown, so the synth drums in section 4.6 are the licence-free fallback.

## 4. Recipes for the electronic style with no samples (not ear-tested)

Parameter names below are verified. The values are starting points and need a listening pass.

### 4.1 TB-303 acid line

```js
note("<c2 c2 c3 c2 eb2 c2 bb1 c2>*8")        // 16ths in practice: "c2 c2 c3 c2 ..."
  .s("sawtooth")                              // or "square" for the 303's other wave
  .ftype("ladder").lpf(320).lpq(18)           // ladder squelch; q≈30 self-oscillates
  .lpenv("<4 2 2 6>*8").lpd(.18).lps(0)       // envelope amount patterned = "accent"
  .decay(.22).sustain(.35)
  .gain("<1 .8 .8 1.1>*8")                    // accent loudness
  .penv("<0 0 0 -12 0 0 0 0>*8").pattack(.06) // slide down an octave into a note (≈ 303 slide)
  .distort(1.2).distorttype("diode")
  .lprate(.25).lpdepth(.4)                    // slow cutoff drift, or sweep lpf with a signal
```

The teaching hooks are cutoff, resonance, envelope, accent and slide. All are separate controls Oak can make
audible one at a time. A sweep such as `.lpf(sine.range(200,2000).slow(8))` uses the signals already in the
toolbox (`tb.signal`).

### 4.2 808 sub bass

```js
note("c1 ~ ~ c1 ~ ~ eb1 ~").s("sine")
  .penv(12).pdecay(.06)          // pitch drop on the attack (the 808 "thump")
  .decay(1.2).sustain(0).release(.1)
  .shape(.3)                     // or .distort(.6): harmonics so it reads on laptop speakers
  .lpf(200)
```

For a glide between bass notes, use `.penv(-5).pattack(.1)` on the target note.

The kick version is `s("sbd").note("c1").decay(1.4)`, which keeps sbd's 36-semitone default drop. Use
`.penv(24).pdecay(.04)` for a tighter click.

### 4.3 House organ and stab

- **Organ (drawbar or "M1-ish" bright organ):**
  ```js
  chord("<Cm7 Fm7>").voicing().s("user").partials([1,1,.7,.8,0,.6,0,.5]).decay(.25).sustain(0)
  ```
  Use `.hpf(200).room(.3)`. The source uses only harmonics 1, 2, 3, 4, 6 and 8, which is the drawbar idea and
  also the harmonic-series lesson (A1.L01) applied.
- **Classic house chord stab:**
  ```js
  chord("<Cm9 Ebmaj7>").voicing().struct("~ x ~ x").s("sawtooth").lpf(1200).lpenv(3).lpd(.12)
  ```
  Finish with `.decay(.18).sustain(0).room(.4).delay(.25)`.
- **FM electric-piano or bell:**
  ```js
  s("sine").fm(2).fmh(1).fmdecay(.4).fmsustain(.1)
  ```
  This is a Rhodes-like tine. `fmh(3.5)` gives a bell (already the A1.L07 contrast).
- An organ-like additive source is also possible with an AKWF `eorgan` single cycle as a wavetable (section 5).

### 4.4 Pads

```js
chord("<Am9 Fmaj7 C G>").voicing().s("supersaw").unison(7).detune(.25).spread(.8)
  .attack(.8).release(1.5).lpf(1400).lprate(.1).lpdepth(.5).room(.7).roomsize(6)
```

This is froos-style. For a darker PWM pad use `s("pulse").pwrate(.3).pwsweep(.3)`. Use `.orbit(2)` with
`.duckorbit(…)` for the sidechain pump.

### 4.5 Plucks

```js
n("0 2 4 7 9 7 4 2").scale("A3:minor").s("square")  // or sawtooth/triangle
  .decay(.15).sustain(0).lpf(900).lpenv(4).lpd(.1).delay(.35).delaytime(.1875).delayfeedback(.45)
```

A softer pluck is `s("triangle").fm(1).fmdecay(.08)`.

### 4.6 Synth drums (licence-free fallback)

- Kick: `s("sbd")` (decay and pdecay to taste).
- Snare: `s("white").decay(.12).sustain(0).hpf(1800)` layered with `s("triangle").note("e3").penv(7).pdecay(.04).decay(.08).sustain(0)`.
- Closed hat: `s("white").hpf(8000).decay(.03).sustain(0)`. Open hat: `.decay(.25)`.
- Clap: `s("pink").bpf(1200).bandq(2).decay(.1).sustain(0)` with `.ply(3)` on a very short `.clip` (flam). Check by ear.
- Toms: `s("sine").note("a2").penv(12).pdecay(.08).decay(.25).sustain(0)`.

Expect these to be thinner than the TR-909 samples. They work as a teaching device ("a kick is a falling sine")
more than as a production kit.

### 4.7 Lo-fi texture, risers and "foley"-like one-shots

- Vinyl crackle: `s("crackle").density(.03).gain(.6)`. This gives the coastline-style lo-fi bed with no samples.
- Noise risers: `s("white").attack(4).lpf(saw.range(500,8000).slow(4))`.
- ZzFX one-shots for zaps, whooshes and blips: for example `s("z_noise").slide(-1)` or `s("z_sawtooth").pitchJump(12)`.
  These stand in for some of the freesound one-shots in froos's piece. Real foley (whirls, attacks) still needs
  samples.

**Bottom line:** acid line, 808 sub, organ and stab, pads, plucks, risers and crackle can all be synthesized. The
electronic style needs samples for only (a) a convincing 909/808 kit (already in the pack) and (b) breaks and
foley one-shots (the brk loop is already in the pack; more breaks are another agent's area).

## 5. Wavetable sources and licences

### 5.1 AKWF-FREE (Adventure Kid Waveforms)

- **URL:** https://github.com/KristofferKarlAxelEkstrand/AKWF-FREE (default branch `main`)
- **Licence:** CC0 1.0. I read the LICENSE text myself at
  https://raw.githubusercontent.com/KristofferKarlAxelEkstrand/AKWF-FREE/master/LICENSE.md: it begins "CC0 1.0
  Universal". The GitHub API also reports `spdx_id: CC0-1.0`.
- **Contents:** single-cycle waveforms in the `AKWF/` folder, 65 subfolders. Examples:
  - Basic shapes: `AKWF_bw_saw`, `bw_squ`, `bw_tri`, `bw_sin`, `bw_perfectwaves`.
  - Synth and chip: `AKWF_fmsynth`, `AKWF_oscchip`, `AKWF_vgame`, `AKWF_vgamebasic`.
  - Keys: `AKWF_eorgan` (154 files), `AKWF_epiano`, `AKWF_clavinet`, `AKWF_piano`.
  - Bass: `AKWF_ebass`, `AKWF_dbass`.
  - Other instruments: `AKWF_hvoice`, `AKWF_cello`, `AKWF_violin`, `AKWF_flute`, `AKWF_altosax`.
  - Numbered general sets: `AKWF_0001`-`AKWF_0020`.

  The README states "600 samples long", 16-bit, 44.1 kHz, mono. Each WAV is 1,344 bytes. The whole repo is about
  860 MB because it includes PNG plots and vendor variants (GitHub API size field); do not mirror it whole.
- **Loading in Strudel:** no official sample map exists for the full set. Mirror chosen files into the pack as a
  `wt_*` map. One file per entry plays as a static single-cycle wave through the wavetable engine (fine, as shown
  in section 2). Morphing would need files concatenated into a 2048-frame table, resampled from 600 to 2048
  samples per frame; that is an Oak build step.
- **Quality:** widely used free single-cycle set. The README cites hardware use (Qubit "Chord" module) and an
  open-source preview app. It describes the set itself as "not wavetables" but morphable in some synths.
- **Verdict: RECOMMEND.** CC0, tiny (40 curated waves ≈ 55 KB). Organ, epiano, ebass and chip waves widen the
  palette at almost no size cost.

### 5.2 uzu-wavetables (tidalcycles)

- **URL:** https://github.com/tidalcycles/uzu-wavetables. The map is at
  https://raw.githubusercontent.com/tidalcycles/uzu-wavetables/main/strudel.json and can be loaded upstream as
  `samples('github:tidalcycles/uzu-wavetables')`. Oak would mirror it locally instead.
- **Licence:** no licence at the repo root (GitHub API: `license: null`). The readme credits the two folders:
  - **`wt_vgame`** (11 files, `wt_vgame10…20.wav`, 1,344 bytes each, about 15 KB total). The readme says "single
    cycle waveforms by Adventure Kid" and links to AKWF-FREE, so these are AKWF CC0 files. There is no LICENSE in
    that folder; I verified the provenance claim, not a licence file. Safest path: take the same files straight
    from AKWF-FREE `AKWF_vgame`.
  - **`wt_digital`** (5 files: `wt_bad_day`, `wt_basique`, `wt_crickets`, `wt_curses`, `wt_echoes`; about 1 MB,
    1 MB, 2 MB, 2 MB and 25 KB, about 6.3 MB total), "provided by Glossing". I read
    https://raw.githubusercontent.com/tidalcycles/uzu-wavetables/main/wt_digital/LICENSE: it is the Unlicense,
    beginning "This is free and unencumbered software released into the public domain."
- **Format and frame length:** I could not verify these for `wt_digital` (I did not download the MB files). Their
  sizes suggest multi-frame 2048-sample tables, which is the Strudel default.
- **Verdict:**
  - `wt_vgame`: **RECOMMEND**, but source it from AKWF directly.
  - `wt_digital`: **MAYBE.** Unlicensed public domain is fine; 6.3 MB is a big cost for 5 tables of unknown
    musical use. Listen first.

### 5.3 Dough-Waveforms (Bubobubobubobubo)

- **URL:** https://github.com/Bubobubobubobubo/Dough-Waveforms. The readme says "Testing loading AKWF waveforms to
  Superdough". strudel.cc's synth docs point to an AKWF library of more than 1,000 waves (loaded there with
  `samples('bubo:waveforms')`).
- **Licence:** none declared (GitHub API: `license: null`; no LICENSE file in the root listing). The files are
  "_reworked" AKWF waves (for example `AKWF_0001_reworked.wav`, 1,246 bytes), mapped per pitch (keys like `"d2"`).
  The AKWF originals are CC0, but the rework itself has no declared licence. I could not verify the rework's terms.
- **Verdict: AVOID.** Unknown licence on the derivative, and an older per-pitch sample layout. Build the same thing
  from AKWF-FREE ourselves.

### 5.4 Oak-generated tables

- **Source:** a build script that computes frames: saw→square morph, PWM sweep, additive organ drawbars, FM-index
  sweep. Output is 2048-sample frames, 16-bit or float WAV.
- **Licence:** Oak's own, released CC0 like `brk`.
- **Verdict: RECOMMEND.** No provenance question at all. It shows off `wt`/`wtenv`, which is a great "the timbre
  moves" lesson, and stays about 100-300 KB for 3-4 tables of 64 frames.

## 6. Recommendations

1. Lean on synthesis for the electronic style. Teach the following new toolbox entries:
   - `ftype("ladder")` and `drive` (acid).
   - The pitch envelope `penv pattack pdecay` (808 drop, slides, toms).
   - The FM envelope `fmdecay/fmsustain` (epiano and bells).
   - `s("user").partials(...)` as the organ.
   - `sbd` and the noise sources (`white pink brown crackle`) for synth drums and lo-fi.
   - `pwrate/pwsweep`.

   All are already registered in Oak; this costs no bytes.
2. Add a small wavetable section to pack v4:
   - About 30-60 curated AKWF-FREE single cycles (CC0, under 100 KB): eorgan, epiano, ebass/dbass, fmsynth,
     vgame, hvoice, bw_*.
   - 2-4 Oak-generated morph tables (CC0).

   Ship it as one `wt_*` sample map plus one attribution line. Attribution is not required for CC0 but is
   courteous.
3. Before shipping wavetables, fix Oak's pack and preload code:
   - Count `type: "wavetable"` (`data.tables`) in `packFileUrls`.
   - Warm wavetables in `preload.ts`; otherwise the first note is dropped.
   - Add `tables` to the lint's sample loaders so learner code cannot fetch remote tables.
4. Keep `bytebeat` out (it is already refused). Skip `wt_digital` unless a listening test justifies its 6.3 MB.
   Avoid Dough-Waveforms.
5. Breaks and foley (the froos piece) cannot be synthesized well. They remain the samples part of the plan.
