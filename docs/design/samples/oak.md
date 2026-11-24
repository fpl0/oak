# Oak internals: vendoring samples and folding them into the course

Scope: how a new sample source enters Oak's self-hosted pack, becomes a learner-facing sound, and reaches lessons,
unit songs and flavour kits. Read from the `songs` worktree (`/Users/fpl0/Code/Oak-wt/songs`, HEAD a98be8a) and
the released app in `/Users/fpl0/Code/Oak/desktop`. Nothing in the repository was changed.

---

## 0. Top findings (read this first)

1. **The pack has 1.26 MiB of headroom.** v3 is 30,133,902 B (28.74 MiB, 254 files) against
   `BUDGET_BYTES = 30 * 1024 * 1024` in `scripts/sounds/mirror.ts`. Groups: tidal-drum-machines 11.22 MB,
   soundfonts 9.29 MB, piano 5.48 MB, uzu-drumkit 2.32 MB, kit-jazzkit 1.38 MB, oak-rendered (brk) 0.44 MB.
   Going over the budget only makes `mirror.ts` print a WARNING and exit 2. `check.ts` does **not** enforce it, even
   though `docs/design/architecture.md` (A5) says "`bun run sounds:check` enforces the budget". A richer library
   means raising the budget on purpose (decide a new number, e.g. 60 MiB) and making `check.ts` enforce it.
2. **The desktop app already ships three packs.** `desktop/scripts/stage.sh` runs
   `rsync -a "$ROOT/sounds/pack" ...`, which copies `v1/`, `v2/` and `v3/` (28 + 29 + 29 MB = **86 MB** in
   `Oak.app/Contents/Resources/oak/sounds`). The server only serves the lock's version. Copying only
   `sounds/pack/<packVersion>` saves about 57 MB in the app, which is more than any likely new sample set needs.
   Current artefacts: `Oak-macos-arm64.dmg` 265 MB, `.zip` 269 MB; the stage is 367 MB, of which node_modules is
   157 MB. MP3 and WAV barely compress in a DMG, so count each new MB of samples as about +1 MB of download.
3. **The mirror can only fetch from `strudel.b-cdn.net` today.** `SampleMapSpec` is `{ json, dir, keep }`. The map
   comes from `${SAMPLE_CDN}/${json}` and every file from `${SAMPLE_CDN}/${dir}${file}`. The upstream `_base`
   (always a `raw.githubusercontent.com/...` URL) is ignored. Any source that is not already on the Strudel CDN
   (a GitHub repo, freesound, a Zenodo or archive.org zip, Oak-transcoded files) needs `mirror.ts` changes.
4. **The cheapest source to add mechanically, and verified CC0, is VCSL.** `https://strudel.b-cdn.net/vcsl.json`
   (184 KB, 128 keys, 1,908 files) has its files mirrored at `https://strudel.b-cdn.net/VCSL/`. That is the same
   host and the same shape the mirror already handles: `{ json: "vcsl.json", dir: "VCSL/", keep }`. Its LICENSE is
   CC0 1.0, read at https://raw.githubusercontent.com/sgossner/VCSL/master/LICENSE. There are two problems:
   (a) the file names in `vcsl.json` are already percent-encoded (`Struck%20Idiophones/...`), and
   `mirror.ts`'s `encodePath` (`encodeURI`) would double-encode them into `%2520`, which 404s;
   (b) the files are huge stereo 16-bit 44.1 kHz WAVs (one vibraphone note is 1.9 MB). By HEAD request:
   vibraphone 10 files 18.0 MiB, marimba 9.1 MiB, kalimba 12.6 MiB, glockenspiel 4.3 MiB, clavisynth 11.6 MiB,
   fmpiano 22.1 MiB, sax 46.4 MiB, pipeorgan_quiet 40.8 MiB, organ_4inch 42.9 MiB. So **a transcode step is
   required** before any real sample set fits: mono, trimmed tails, MP3 or Ogg at about 96–128 kbps, roughly 10×
   smaller. The mirror has no transcoding today; the only derived audio is `brk.ts`, pure TypeScript.
5. **A sample-backed pitched instrument cannot be an Oak alias yet.** `OAK_ALIASES` (`AliasSpec`) only pins a
   `gm_*` soundfont variant. `scripts/sounds/audibility.test.ts` requires every group-G instrument other than
   piano and the waves to be an `OAK_ALIASES` key. Contracts §3.2 says a cheap patch can be swapped "behind the
   same alias, the alias ID does not change", but the code can only do that from one GM font to another, or (per
   the contract) to a synth patch. Replacing `rhodes`, `upright` or `vibes` with real samples needs a second alias
   kind: `{ sample: "<map key>", gain, release, range }`, registered in `pack.ts` like the GM aliases (variant pin,
   `withOutputGain`, `tag: "oak"`).
6. **The attribution story contradicts the public release.** `app/src/content/about.mdx` says *"The mirrored pack is
   for personal use; do not redistribute it."* The pack is inside a public GitHub DMG, and `README.md` › Credits
   says it is "redistributed under their licences". The About page names Salamander (CC-BY 3.0) but has no
   licence link and says nothing about modification. It names tidal-drum-machines with no licence, because none
   is declared upstream. Any CC-BY addition should come with a generated credits list (§9).
7. **Adding a sound touches about 12 places** (pack config, runtime kit list, toolbox row, ID ledger, contracts table,
   audibility cases plus Playwright results, quality harness, demos, STYLE §4, grader and notation drum maps,
   flavours). §11 is the checklist.

---

## 1. What is in the pack now (v3)

| Group (lock) | Source | Files | Bytes | Format |
|---|---|---|---|---|
| `piano` | `piano.json` → `piano/` (Salamander V3, one velocity, 29 pitches) | 30 | 5,479,792 | MP3 128 kbps 44.1 kHz stereo |
| `uzu-drumkit` | `uzu-drumkit.json` → `uzu-drumkit/` (14 Oak roles kept; upstream `brk` and `misc` pruned) | 36 | 2,316,190 | WAV |
| `tidal-drum-machines` | `tidal-drum-machines.json` → `tidal-drum-machines/machines/`, 5 banks × 14 roles × ≤4 variants | 132 | 11,222,972 | WAV |
| `kit-jazzkit` | Roland MC-303 files from the same map, plus `oak-kit-jazzkit.json` | 20 | 1,375,228 | WAV |
| `oak-rendered` | `brk` rendered by `scripts/sounds/brk.ts` (CC0) and `oak-rendered.json` | 2 | 441,129 | WAV |
| `soundfonts` | 33 WebAudioFont presets for 20 `gm_*` names, from `felixroos.github.io/webaudiofontdata/sound` | 33 | 9,290,858 | JS with embedded audio |
| `manifest` | `manifest.json` | 1 | 7,733 | JSON |

Totals: 254 files, 30,133,902 B. Old packs `v1` and `v2` are still on disk in `sounds/pack/`, which is ignored by
git; only `sounds/pack.lock.json` is committed.

---

## 2. How a sample source is added today (the build side)

### 2.1 `scripts/sounds/pack.config.ts`: the single definition
- `PACK_VERSION = "v3"` and `PUBLIC_ROOT = /sounds/${PACK_VERSION}`. The header rule: *bump PACK_VERSION whenever
  the file list or a derived file (manifest, maps) changes*, because `/sounds/<v>/` is served `immutable` and the
  Service Worker caches it CacheFirst, so a path must never change content. The header keeps a changelog
  (v2: `acgtr`, gains and releases, jazzkit; v3: `brk`). Add a v4 line.
- `SAMPLE_CDN = "https://strudel.b-cdn.net"` and `SOUNDFONT_CDN = ".../webaudiofontdata/sound"`.
- `SAMPLE_MAPS: SampleMapSpec[]`, each `{ json, dir, keep(key) → max variants }`. `keep` returning 0 prunes the
  key; `Infinity` keeps all of it. Pitched maps (`{ C3: file }`) are supported: piano is one.
- `DRUM_ROLES` (14), `DRUM_BANKS` (5 kept of 71) and `MAX_VARIANTS_PER_ROLE = 4` shape the drum machines.
- `GM_VARIANTS`: which `gm_*` font indices to mirror (index 0 is always kept). `gm_electric_bass_finger:1` 404s.
- `OAK_ALIASES: Record<alias, { gm, variant, gain?, release?, range? }>` holds the 18 curated pitched names (GM only).
- `OAK_KITS: Record<kit, { json, dir, source, licence, roles: { <role>: { files, gain } } }>` holds Oak kits built
  from files of an upstream map. Each file must be listed in that map (provenance check). The output is
  `oak-kit-<kit>.json` with keys `<kit>_<role>`.
- `BANK_ALIAS_JSON` (`tidal-drum-machines-alias.json`), pruned to `DRUM_BANKS`.

### 2.2 `scripts/sounds/mirror.ts`: fetch, prune, rewrite, lock
- Modes: frozen when a lock exists (reproduce it exactly, failing on any sha256 mismatch); `--update` re-resolves
  and rewrites the lock; `--dry-run` prints sizes from HEAD requests; `--offline` builds from the locked pack on
  disk (good for a bump that only adds Oak-rendered files).
- After a `PACK_VERSION` bump, `--update` copies a file from the previous version's directory when its source URL
  and bytes are unchanged, so nothing is downloaded again.
- For each `SAMPLE_MAPS` entry it fetches the upstream map and keeps keys per `keep`. Each kept file is checked
  by `isSafeSamplePath`, planned as `v/<dir><file>` from `${SAMPLE_CDN}/${dir}${encodePath(file)}`, and the
  rewritten JSON is written with `_base = /sounds/<v>/<dir>`.
- Then the kits, the bank alias file, the rendered break (`renderBreakWav`, from the uzu one-shots), the GM fonts,
  the aliases, and finally `manifest.json` (`sampleMaps[] {json, base, tag}`, `bankAliases`, `soundfontUrl`,
  `soundfonts`, `aliases`, `kitGains`).
- `validate()` sniffs bytes: it rejects an HTML page, checks RIFF for `.wav`, an ID3 or frame sync for `.mp3`, and
  the WebAudioFont markers. `.ogg` and `.flac` would pass unsniffed. The server serves both: `server/src/static.ts`
  `TYPES` has `.ogg`, `.flac` and `.m4a`.
- Stale files in the version directory are deleted. The lock records `{path, sourceUrl, bytes, sha256, derived?}`
  per file, plus per-group totals.
- Over-budget gives a warning and exit 2 (see §0.1).

**What it cannot do yet, and what to add for a non-CDN source:**
- **Per-source host.** Add `sourceBase` (or `mapUrl` plus `filesBase`) to `SampleMapSpec`, and pin GitHub sources to
  a **commit SHA** (`raw.githubusercontent.com/<user>/<repo>/<sha>/...`), never `main` or `master`, so frozen
  mirrors stay reproducible.
- **Our own map.** Freesound picks or zip-released kits have no `strudel.json`. Allow a spec whose map is written
  in `pack.config.ts` (like `OAK_KITS`) with each file's source URL. `check.ts` requires an `https://` `sourceUrl`
  for every non-derived file.
- **Percent-encoded names** (vcsl.json): decode before `isSafeSamplePath`, write the decoded name to disk, and
  encode once for the fetch. At runtime `pack.ts` `encodeSoundPath` does `encodeURI(decodeURI(p))`, so either
  spelling in the rewritten JSON works, but the disk path must be the decoded one, because `server/src/static.ts`
  `safeFile` decodes the URL once.
- **Transcoding** (mono, trim, normalise, MP3 or Ogg): a derived step like `brk`, with sourceUrl
  `generated:...(<original URL>, <licence>)`, `derived: true`, and a deterministic encoder pinned by version so
  the lock's sha256 holds. The repository has no ffmpeg dependency today. Do it in TypeScript (WAV → decimated or
  trimmed WAV is easy; MP3 or Ogg encoding needs a pinned wasm encoder or a pinned ffmpeg), or commit the
  transcoded files to a separate public assets repository and mirror those by SHA. CC-BY material modified this
  way must say so in the credits (§9).
- **Licence metadata per source**: `source`, `licence`, `licenceUrl` and `attribution` on `SampleMapSpec`, as
  `KitSpec` already has `source` and `licence`. Copy them into the manifest so the app can render the credits.

### 2.3 `scripts/sounds/check.ts` (offline, run by `bun run build`)
It fails on: a locked file missing or with the wrong size or sha256, an unlocked file on disk, a map `_base` not
under `PUBLIC_ROOT/` ending in `/`, any `https?://|github:|bubo:|shabda` left in a map, a map reference not in
the pack, an unmirrored font, alias gain outside (0,4], release outside [0.01,2], range outside 0..127, and
mismatched kit gains. **Add:** a budget check (§0.1), and, with the licence metadata, "every map has a licence
from an allow-list (CC0, Unlicense, CC-BY-3.0/4.0)".

### 2.4 The lockfile `sounds/pack.lock.json`
It is committed. `packVersion`, `publicRoot`, `totalBytes`, `fileCount`, `groups` and `files[]`. Readers:
`server/src/static.ts` `packVersion()` (which version to serve); `packages/strudel/src/offline/request.ts` (the
offline renderer's `soundsRoot = pack.publicRoot`); `app/src/workbench/kept-in-step.test.ts` (checks
`STANDALONE_SOUNDS_ROOT`); `desktop/scripts/stage.sh` (presence check).

### 2.5 PACK_VERSION bump: everything that must move together
1. `pack.config.ts` `PACK_VERSION` plus the changelog comment.
2. `bun scripts/sounds/mirror.ts --update` writes `sounds/pack/<v>/` and the new lock. Commit the lock.
3. `app/src/workbench/standalone-services.ts`: `STANDALONE_SOUNDS_ROOT = "/sounds/v3"` is **hard-coded**
   (`kept-in-step.test.ts` fails until it matches).
4. `packages/strudel/e2e/pack-root.ts`: `SOUNDS_ROOT = "/sounds/v3"` is **hard-coded** (`sounds.pw.ts` checks it).
5. Nothing else: the app reads `/sounds/manifest.json` (no-cache) and registers `/sw.js?pack=<packVersion>`.
6. Release builds in a clean worktree copy `sounds/pack` and the lock from the main checkout (memory note), so
   mirror there first.

### 2.6 Serving and offline caching
- `server/src/static.ts`: `GET /sounds/manifest.json` serves the lock version's manifest with `no-cache`.
  `GET /sounds/:version/*` serves any safe directory (old versions too) as `public, max-age=31536000, immutable`
  with Range support. `server/src/app.ts` puts `/sounds/*` behind `hostOnly`.
- `app/public/sw.js`: `oak-sounds-<packVersion>` is CacheFirst for `/sounds/<v>/*`, and old `oak-sounds-*` caches
  are deleted on activate. It caches on first play. A `precache` message (the whole URL list from
  `packFileUrls()` in `packages/strudel/src/pack.ts`, exposed as `OakStrudel.packFiles()`) exists, but only the
  e2e calls it; there is no "Download all sounds" button in the app today. **New maps need no SW change**:
  `packFileUrls` walks every registered sample sound and every font.
- CSP and `assertLocal()` in `pack.ts` refuse any non-same-origin sound URL, so runtime fetching is impossible by
  construction. That is the point.

---

## 3. How sounds become names at runtime (`packages/strudel/src/pack.ts`)

`prebake(soundsRoot)`: `evalScope`, visual stubs, `registerSynthSounds()` and `registerZZFXSounds()`; then
`setSoundfontUrl` and `registerSoundfonts()`, then `curateSoundfonts()`, which keeps only the mirrored `gm_*`
names and pins `n` to the mirrored upstream indices. Then **every `manifest.sampleMaps` entry**: fetch the JSON,
delete `_base`, `samples(map, base, { prebake: true, tag })`. Then `aliasBank`, `registerOakKits()`,
`trimKits(kitGains)`, and finally each `manifest.aliases` entry as `registerSound(alias, withOutputGain(pinVariant(gm
font)), { type: "soundfont", tag: "oak", range })`.

Consequences:
- **Every key of a mirrored map becomes a sound name as-is** (`vibraphone`, `kalimba`, `wt_digital`...). A raw
  upstream key with no toolbox row is "uncatalogued" for the lint (§4), so prune maps hard with `keep`.
- **No per-sample-sound gain or default release.** Only GM aliases (`gain`, `release`) and kit roles (`kitGains`)
  have trims. A sample instrument needs the new alias kind of §0.5, or a kit-like gain table.
- **`OAK_KITS = ["jazzkit"]` is duplicated** in `pack.ts`, separately from `pack.config.ts` `OAK_KITS`.
  `registerOakKits()` aliases every missing role of a kit to the default uzu role. A new kit (say an electronic
  909-plus kit, or a lo-fi kit) must be added to **both** lists. `KIT_ROLES` in `pack.ts` repeats the 14 roles.
- The preloader (`packages/strudel/src/preload.ts`) warms sample buffers (pitched maps: the nearest note) and font
  zones. Aliases declare `range`. A sample-backed alias should get a `range` too.
- `app/src/onboarding/prefs.ts` `withInstalledBanks()` drops a `.bank()` the installed pack lacks (the v1 pack had
  no jazzkit). Mirror that pattern for any new kit that Band code names.

---

## 4. The catalog, the lint and unlocking

### 4.1 `content/toolbox.ts` (the only place an unlock is declared, contracts §3.1 rule 1)
Sound rows (`kind: "sound"`, id `snd.*`, `SoundId = snd.${string}`):
- `drum(name, label, at, concept, demo)` → `snd.drum.<name>` (group F, `matches: [name]`, `s("name")`).
- `bank(name, at, concept)` → `snd.bank.<Name>` (`matches: [name]`, `.bank("Name")`).
- `row("F", "snd.jazzkit", ...)` and `row("F", "snd.brk", ...)` are one-offs. `snd.brk` (unlocks A2.L04
  "sampling") is the pattern to copy for new non-drum-machine samples: one-shots, breaks, foley.
- `inst(alias, gm, at, concept, line)` → `snd.<alias>` (group G; `meaning` says "Oak's X sound (gm)"; `strudelCc`
  is `.s("gm_...")` for GM). For a sample alias, set `strudelCc` to the strudel.cc name (VCSL keys exist on
  strudel.cc, e.g. `.s("vibraphone")`).
- `wave(name, ...)` → `snd.wave.<name>` (synths: no pack change).
- Row fields: `unlock.at` (one session or an array of alternative sites), `when: "start"`, `gated`, `preview`,
  `audible`, `catalog { signature, meaning, demo }`.

### 4.2 What else must agree with a new row
- **`docs/design/contracts.md` §3.2 table F or G**: `content/validate/contracts-sync.test.ts` re-parses it and fails
  on drift ("Changing a contract means editing both").
- **`content/ids.lock.json`**: the ID ledger, updated by `bun scripts/content/build.ts`. IDs are retired, never
  renamed.
- **Audibility**: `packages/strudel/src/audibility/cases.ts` `SOUND_CASES` (e.g.
  `{ id: "snd.brk", sound: "brk", code: 's("brk")' }`), and the result in `packages/strudel/audibility.json`,
  written by the Playwright harness `packages/strudel/e2e/audibility.pw.ts` (headless Chrome, OfflineAudioContext).
  `scripts/sounds/audibility.test.ts` requires every catalog sound to have a case that is `true`.
- **Quality** (pitched instruments): `QUALITY_CASES` in `cases.ts` and the result in
  `packages/strudel/sound-quality.json` from `packages/strudel/e2e/quality.pw.ts`. The criteria are the first
  partial within ±10 cents at A2/A3/A4 (basses one octave lower), the octave it claims, no click at note ends, and
  loudness within ±1.5 LU of the piano; Wave 4 adds triads within ±3 LU of the piano's chords. The tests demand
  this for "the piano and every alias".
- **Alias/kit/catalog identity** (`audibility.test.ts`): every group-G instrument except piano and the waves is an
  `OAK_ALIASES` key, every alias is in the catalog, and every `OAK_KITS` key is a catalog sound (§0.5).
- **Toolbox demos**: `app/src/toolbox/demos.ts` (core) and `demos-w7.ts` (tracks; `demos-w7.test.ts` lints each
  demo at its unlock site and checks every part sounds). `snd.brk` has a demo there.
- **STYLE §4** (`content/STYLE.md`) lists the allowed drum names, banks and curated aliases. Authored code must stay
  inside it (rule 3: raw `gm_*` and `:n` variants are never written; rule 5: no `samples(...)`).
- **`content/terms.ts`** (term definitions; `brk` appears there) and the `/dev/listen` page
  (`app/src/routes/dev/-components/ListenPage.tsx`, which lists manifest aliases, soundfonts and non-machine maps
  for the listening verdicts).

### 4.3 The lint (`packages/grader/src/lint/oak.ts`, contracts §3.3)
- In `s()`/`sound()` each mini atom (before `:`) becomes `snd:<name>`. An unknown name gives `code.uncatalogued`
  ("not a sound in Oak's pack"): an **error** in graded and content profiles, info in Studio. A `gm_*` name is
  info ("use Oak's instrument names"). `.bank(x)` → `bank:x`, and an unknown bank is `code.locked-sound`.
- `samples(...)` is always `code.uncatalogued` ("sounds come from Oak's sound pack"): learners cannot load
  `github:` maps, by design.
- `DRUMS = "bd sd hh oh cp rim rm lt mt ht cr rd sh cb tb perc misc fx"` decides that `n` on a drum is a sample
  index, not a pitch. Add new unpitched one-shot names here.

### 4.4 Grader, notation and drills: drum-ness of a sound name
- `packages/grader/src/normalize/nevent.ts` `DRUM_MAP` (sound → `DrumRole`; `brk: "perc"` was added). It strips a
  bank prefix and any `xxx_yyy` prefix. A new unpitched sample with no role gets `drum: null`: it is not a drum
  event and has no pitch, so rhythm rules will not see it. Map new percussive one-shots (`perc`), or they are
  invisible to grading.
- `packages/notation/src/drums.ts` `BY_SOUND` places drum names on the percussion staff (unknown → not drawn).
- `packages/drills/src/build.ts` `DRUM_ROLES`, `app/src/drills/DrillRunner.tsx` `INSTRUMENT_DRUMS`.
- `packages/content-kit/src/schema/unit-song.ts` `DRUM_SOUND = /^[a-z][a-z0-9]*$/`: a drum part's `sounds` must be
  lowercase alphanumeric, so **no underscores** (`snare_modern` from VCSL could not be a song drum part's sound).
  Give vendored one-shots short Oak names via a derived map.

---

## 5. Flavours (contracts §5.10, `content/flavours.ts`)

- `FlavourKit = { id, title, drums, bass, chords, lead: SoundId, chordDepth, swing?, production { room 0.2–0.35,
  bassLpf 700–900, humanizeVelocity 0.08, pan } }`. Current kits:
  pop (`snd.drum.bd` default kit, `ebass`, `piano`, `piano`); jazz-soul (`jazzkit`, `upright`, `rhodes`, `vibes`,
  swing 1/3); indie (`LinnDrum`, `ebass`, `cleangtr`, `acgtr`); funk (`RolandTR808`, `fingerbass`, `clav`, `organ`).
- `FLAVOUR_RULES` (ships, `seventhsFrom`, `feelFrom`, feel) and `PRODUCTION_RANGES` are checked by
  `content/validate/bands.test.ts`.
- Rule 8: starter swaps apply only when the flavour sound is unlocked for the session; otherwise
  `DEFAULT_STARTER_SOUNDS` (`piano`/`piano`/`ebass`, `piano` before `ebass`). The Band and unit-song code may use
  any sound at any time (preview context, lint profile `band`).
- **Adding `flavour.electronic`** (being added in this unit) is not just a `flavours.ts` entry:
  `packages/content-kit/src/ids.ts` has the `FlavourId` union, `FLAVOUR_IDS` and the `flavour:` regex
  `/^flavour\.(?:pop|indie|jazz-soul|funk)$/`. `BandDef.code` and `UnitSongDef.code` are
  `Record<FlavourId, string>`, and the unit-song zod schema **requires all flavours**. So the 23 Bands in
  `content/bands/index.ts` and every unit song (`content/unit-songs/U01.ts`, `U02.ts`, ...) need electronic code.
  Plus `FLAVOUR_RULES`, the contracts §5.10 table, `app/src/lib/format.ts`, `app/src/album/cover.ts`, the
  `NewSong` style picker, `content/capstones.ts`, and tests that enumerate flavours (`grep -rl flavour.funk`
  lists about 40 files).
- An electronic kit can be built **with no new samples**: drums `snd.bank.RolandTR909` (in the pack); bass
  `snd.wave.sawtooth` (a 303-style line is `sawtooth` + `lpf` + `lpenv` + `lpq`, all real superdough controls;
  `lpenv` and `lpq` unlock in A1.L02); chords `snd.pad` or `snd.wave.supersaw` (A1.L07); lead `snd.wave.square`.
  Rule 8 then falls back to `piano`/`ebass` until those unlock. The waves unlock at U02.L06, so an electronic
  learner gets synth leads early. New samples make it better (a 909 open hat and ride are already in the TR909
  bank; a vendored CC0 909 or 808 set adds little). What electronic lacks is risers, noise sweeps, vinyl and foley
  one-shots, and a second break.

---

## 6. Lessons that teach sounds today (where a richer library folds in)

| Session | What it teaches with sounds now | Natural fold-in |
|---|---|---|
| U01.L03 | `.bank("RolandTR909")`, `.bank("RolandTR808")`: drum-machine timbre | — |
| U01.L09 "Copy That Groove" | LinnDrum, AkaiLinn, RolandTR707 banks; `sh cb tb` | A lo-fi or acoustic kit bank (`.bank("lofikit")`) as a 6th bank, if one is vendored |
| U02.L06 "Tones & Timbres" | `piano` vs `sine triangle square sawtooth` (the four waves unlock here); "Name the sound" four-way choice | Add one or two sampled timbres to the listening trials only (e.g. vibes or kalimba), never as a new unlock here, which would break the §3.2 table |
| U03.L11 / U05.L06 / U05.L08 / U06.L06 / U08.L05 / U10.L09 / U11.L03 / U12.L06 / U13.L02 / U15.L05 / U16.L05 | The alias unlocks (`acgtr`, `upright`, `rhodes`+`organ` behind the voicing gate, `pad`, `fingerbass`, `strings`, `crunch`, `jazzgtr`, `cleangtr`, `horns`+`trumpet`, `tenor`) | **Swap the samples behind the alias; do not rename.** Every lesson, Band and song improves with no content edits |
| J1.L01 | `jazzkit`, `vibes` | A better brush or ride kit (behind `jazzkit`) and VCSL vibraphone (behind `vibes`) |
| A1.L01–L07 (sound design) | Synth waves only (sawtooth, square, sine, triangle; `supersaw`, `pulse` at A1.L07); `bd`/`hh` drums | Natural home for an "acid" line (A1.L02 filters and envelopes) and for wavetables (`uzu-wavetables` is on the CDN as `wt_*`; superdough treats `wt_` keys as wavetables). A sound-design lesson could unlock a noise or riser one-shot |
| A2.L04 "Sampling" | `s("brk")` with `.slice`, `.splice`, `.begin`/`.end`, `.loopAt`, `.speed` (`tb.chop`, `tb.loopAt`, `tb.speed` unlock here) | **Best place for the broken-cut style**: a second CC0 break, and foley or texture one-shots chopped with `chop`/`striate` |
| A2.L05 "Mix & Dynamics" | `sawtooth` bass, `piano`, `strings` pad, `square` lead | Richer stems make the mix lesson audible; no unlock change needed |
| A2.CP, AC2 | `brk`, `choir` (AC2.S1 START) | — |

Approximate use in `content/**/*.ts` (`s("...")` and quoted names; `pad` also matches the label, so it is
inflated): piano 1003 refs/219 files, **rhodes 444/134**, ebass 219/92, **upright 209/88**, fingerbass 152/54,
sawtooth 146/30, vibes 80/36, square 70/21, sine 74/14, organ 64/33, crunch 49/19, acgtr 42/22, triangle 39/14,
brk 35/6, clav 34/17, strings 33/19, horns 30/7, cleangtr 28/17, tenor 19/13, jazzgtr 22/13, mutetpt 13/9, choir
9/5, supersaw 11/5, pulse 13/5. Banks: **jazzkit 94**, RolandTR909 38, RolandTR808 31, LinnDrum 25, RolandTR707
6, AkaiLinn 4. So upgrading `rhodes`, `upright`, `ebass` and `jazzkit` behind their names has the biggest reach.

Unit songs (this branch) so far: `content/unit-songs/U01.ts` and `U02.ts`. They take sounds from each flavour kit
(`k.bank`, `k.bass.sound`, `k.chords`, `k.lead`) and `bd sd hh` plus a crash, so a better kit or alias reaches
them automatically.

---

## 7. Sounds the docs flag as possibly cheap (`docs/decisions.md`, "Listen")

The owner's open item (decisions.md line 13) asks them to open `/dev/listen` and *"say which sounds cheap"*:
- **`rhodes`** (gm_epiano1:1, FluidR3 `0040_FluidR3_GM`)
- **`upright`** (gm_acoustic_bass:1, FluidR3)
- **`ebass`** (gm_electric_bass_pick:0, JCLive)
- **`organ`** (gm_drawbar_organ:3, FluidR3)
- **guitars**: `acgtr` (gm_acoustic_guitar_steel:5, LK_AcousticSteel), `jazzgtr` (gm_electric_guitar_jazz:0,
  JCLive), `cleangtr` (gm_electric_guitar_clean:0, Aspirin), `crunch` (gm_overdriven_guitar:0, FluidR3)
- **`strings`** (gm_string_ensemble_1:0, Aspirin)
- **`horns`** (gm_brass_section:3, FluidR3)
- **`tenor`** (gm_tenor_sax:0, JCLive)
- **the jazz-soul kit `jazzkit`**: an MC-303 kick (`Drybd2.wav`), brushes on the snare
  (`Brushtap`/`Brushslp`/`Brushswi`), a ride in eighths (`Ridecymb`/`Ridecym2`)
- and *"seventeen jazz lessons in a row comp on the same Rhodes, upright and vibes: say if that trio wears thin"*:
  **`rhodes`, `upright`, `vibes`** (gm_vibraphone:3, FluidR3).

Related notes: `docs/spikes.md` line 410 says no variant was ever auditioned and the picks follow research
suggestions; contracts §3.2 and §5.10 say "the listening pass may swap a cheap-sounding GM patch... behind the
same alias". No listening verdicts are recorded yet. Not flagged but also GM: `fingerbass`, `pad`, `clav`,
`trumpet`, `mutetpt`, `choir`.

---

## 8. Desktop bundling and size

- `desktop/scripts/stage.sh` stages server, packages, content, dist, **all of `sounds/pack`** and the lock into
  `desktop/stage/oak`, runs `bun install --production`, and copies the Bun binary. `desktop/scripts/after-pack.cjs`
  rsyncs `stage/oak` into `Oak.app/Contents/Resources/oak`. `electron-builder.yml`: dmg and zip, arm64, asar for
  the shell only.
- Measured (`/Users/fpl0/Code/Oak/desktop`, built 22 Nov): stage 367 MB (node_modules 157, sounds **86**, dist 16,
  content 15, packages 5.5, server 2.6); `Oak-macos-arm64.dmg` **265 MB**, `.zip` 269 MB.
- **Fix first:** `rsync -a "$ROOT/sounds/pack/$V" "$OAK/sounds/pack/"`, with `V` read from `pack.lock.json`
  (`packVersion`). That saves about 57 MB, so a 60 MiB pack would still leave the DMG about 30 MB smaller than
  today.
- Each pack MB counts in full: MP3 and transcoded Ogg do not compress further, and a WAV gains maybe 10–20%. The
  SW cache in the browser build stores whatever is played, so a bigger pack also means a bigger
  `oak-sounds-<v>` cache. The by-name preloader only warms sounds a step names, so load time grows only with what
  is used.

---

## 9. Attribution and credits today

- `app/src/content/about.mdx` › "Sound attributions": Salamander Grand Piano by Alexander Holm, **CC-BY 3.0**;
  drum machines from `tidal-drum-machines`; GM soundfonts from `webaudiofontdata` (FluidR3, JCLive, GeneralUser
  GS and others). It then says *"The mirrored pack is for personal use; do not redistribute it"*, which is wrong
  for a public DMG and must go.
- `README.md` › "Credits and licences": the sound pack "redistributed under their licences": Salamander (CC BY
  3.0), uzu-drumkit (Unlicense), tidal-drum-machines, GM soundfonts; `brk` CC0 1.0.
- Nothing inside `sounds/pack/<v>/` (no CREDITS or LICENSE file) and nothing in the manifest carries a licence.
  `KitSpec.licence` exists for jazzkit only, and its text says "as the rest of tidal-drum-machines in this pack".
- **Proposal:** give each `SampleMapSpec` and `KitSpec` `{ source, licence (SPDX), licenceUrl, attribution?,
  modified? }`, emit `credits.json` and `CREDITS.md` into the pack root (listed in the lock), and render the About
  page's sound section from `/sounds/<v>/credits.json`. CC-BY 3.0/4.0 needs the author, title, licence URL and a
  note of changes (transcoding counts). CC0 and Unlicense need nothing, but credit them anyway. Reject NC, ND,
  "no redistribution" and unknown licences in `check.ts` via an allow-list. For CC-BY-SA samples: the
  ShareAlike clause applies to adaptations of the *samples* (a transcoded file is one), so Oak would have to ship
  those files under CC-BY-SA with credits. Whether a song made with them is an adaptation is unsettled, so AVOID
  SA in a teaching pack whose learners' album exports are their own.

---

## 10. Candidate source verified while reading internals

**VCSL: Versilian Community Sample Library**
- URL: https://github.com/sgossner/VCSL; Strudel map https://strudel.b-cdn.net/vcsl.json, files at
  https://strudel.b-cdn.net/VCSL/.
- Licence: CC0 1.0, read at https://raw.githubusercontent.com/sgossner/VCSL/master/LICENSE. The README says "This
  collection is under a Creative Commons 0 license."
- Content: 128 Strudel keys and 1,908 files, among them vibraphone (hard, soft, bowed), marimba, xylophone,
  glockenspiel, kalimba ×5, harp, folkharp, sax and saxello, recorders, harmonica, pipe organ and `organ_*`, Steinway
  and Kawai pianos, `fmpiano`, `clavisynth`, and percussion (bongo, conga, cajon, clave, cabasa, guiro, shakers,
  tambourines, cowbell, woodblock, timpani, toms, snares, bass drums, cymbals, gongs). Format: WAV, stereo, 16-bit,
  44.1 kHz (header read). Sizes are in §0.4.
- Strudel loading: `samples('https://strudel.b-cdn.net/vcsl.json', 'https://strudel.b-cdn.net/VCSL/')`; the map's
  own `_base` is the GitHub raw master. For Oak: `{ json: "vcsl.json", dir: "VCSL/", keep: k => KEEP.has(k) ? ∞ : 0 }`,
  plus the percent-decoding fix and a transcode step.
- Quality: a broad orchestral and folk library from a commercial sample developer. It is not a jazz, soul or
  electronic library. Judge `vibraphone` against `vibes`, and `sax` against `tenor` (which sax it is was not
  verified), at `/dev/listen`.
- Verdict: **RECOMMEND** (mechanically the shortest path; CC0), but only after transcoding. For the owner's genres it
  mostly upgrades `vibes`, adds tuned percussion and Latin hand percussion (funk, soul), and gives real organ and
  piano alternatives. It brings no Rhodes, no upright or electric bass, and no lo-fi or electronic drums.

Also on the CDN, so loadable with the current shape (licences not read, so **could not verify**):
`uzu-wavetables.json` (7 keys, 21 files, `wt_*` wavetables, base `tidalcycles/uzu-wavetables`), `mridangam.json`
(13 keys, 131 files, base `yaxu/mrid`). `dirt-samples.json` is **not** on the CDN (404); strudel.cc loads it as
`github:tidalcycles/dirt-samples`, so it would need the per-source host change of §2.2.

---

## 11. Checklist: files to change

### A. Add a sample source to the pack
1. `scripts/sounds/pack.config.ts`: a new `SAMPLE_MAPS` entry (or `OAK_KITS` entry); for a non-CDN source, extend
   `SampleMapSpec` (`sourceBase` or `mapUrl` pinned to a commit SHA, an inline map, percent-decoding, a transcode
   flag, licence metadata); bump `PACK_VERSION` and add a changelog line.
2. `scripts/sounds/mirror.ts`: honour the new spec fields (host, encoding, transcode as `derived`, licence into the
   manifest and `credits.json`); raise `BUDGET_BYTES` to the agreed number.
3. `scripts/sounds/check.ts`: enforce the budget; check licences against an allow-list; extend the
   remote-reference regex if new prefixes appear.
4. `scripts/sounds/paths.ts`: unchanged, unless decoded names need extra rules (commas and spaces are fine).
5. Run `bun scripts/sounds/mirror.ts --dry-run`, then `--update`; commit `sounds/pack.lock.json`.
6. `app/src/workbench/standalone-services.ts` (`STANDALONE_SOUNDS_ROOT`) and `packages/strudel/e2e/pack-root.ts`
   (`SOUNDS_ROOT`): set `/sounds/<new v>`.
7. `packages/strudel/src/pack.ts`: only for a new alias kind (sample-backed `rhodes`/`upright`/`vibes`...: extend
   `PackManifest.aliases` / `AliasEntry` and register with `samples` key + `withOutputGain` + default release) or
   a new kit (add it to `OAK_KITS` here **and** in pack.config).
8. `packages/strudel/src/types.ts` / manifest types, if the manifest gains `credits` or `sampleAliases`.
9. `desktop/scripts/stage.sh`: copy only the current pack version.
10. Credits: `app/src/content/about.mdx` (remove the "personal use" sentence; render or list the credits),
    `README.md` › Credits and licences.

### B. A sample-backed upgrade behind an existing alias (best value: rhodes, upright, ebass, vibes, jazzkit)
1. `pack.config.ts` `OAK_ALIASES[alias]` points at the sample key (new alias kind) with `gain`, `release` and `range`;
   for jazzkit, `OAK_KITS.jazzkit.roles[*].files` and `gain`.
2. Re-run the quality harness (`packages/strudel/e2e/quality.pw.ts`) → `packages/strudel/sound-quality.json`
   (tuning within ±10 c, octave, no click, loudness within ±1.5 LU of piano; triads within ±3 LU), and the
   audibility harness → `packages/strudel/audibility.json`.
3. `scripts/sounds/audibility.test.ts`: allow the new alias kind in "every catalog instrument is a curated alias".
4. `content/toolbox.ts` `inst(...)`: update the `code` text (`rhodes (gm_epiano1:1)` → the new source), `meaning`
   and `strudelCc`; the same row text in `docs/design/contracts.md` §3.2 G (contracts-sync).
5. Wave band/tuning fixtures that pin GM behaviour: `packages/strudel/e2e/wave{4,5,6,7}*.ts`, the `W6_TUNING`,
   `W7_TUNING` and `W7_KNOWN_TUNING` tables, `packages/strudel/sound-wave{5,6,7}.json`. Re-measure them.
6. No lesson, Band or song edits: every use of the alias name upgrades.

### C. A new learner-facing sound (new name: a second break, foley, a lo-fi kit, an acid preset)
1. Pack: A above.
2. `content/toolbox.ts`: a new row (`row("F", "snd.<name>", "sound", ...)` like `snd.brk`, or `bank(...)` / a kit
   row like `snd.jazzkit`) with `unlock.at` at the lesson that teaches it (A2.L04 for breaks and foley; U01.L09 for a
   bank; A1.L0x for synth or texture material).
3. `docs/design/contracts.md` §3.2 (table F or G) plus its change-log line; `content/ids.lock.json` via
   `bun scripts/content/build.ts`.
4. `packages/strudel/src/audibility/cases.ts` `SOUND_CASES` (and `QUALITY_CASES` if pitched), then re-run
   `audibility.pw.ts` and `quality.pw.ts` and commit the JSON results.
5. `app/src/toolbox/demos.ts` or `demos-w7.ts`: a demo groove for the row.
6. `content/STYLE.md` §4: add the name to the allowed lists.
7. Drum-ness: `packages/grader/src/lint/oak.ts` `DRUMS`, `packages/grader/src/normalize/nevent.ts` `DRUM_MAP`
   (role), `packages/notation/src/drums.ts` `BY_SOUND`, and if drills use it, `packages/drills/src/build.ts` and
   `app/src/drills/DrillRunner.tsx`. Keep names lowercase alphanumeric (unit-song `DRUM_SOUND`).
8. A new kit: `packages/strudel/src/pack.ts` `OAK_KITS`, plus `app/src/onboarding/prefs.ts` (`withInstalledBanks`)
   if the Band uses it.
9. `content/terms.ts` if a lesson introduces a word for it.

### D. Fold into lessons
1. The lesson's `content/<core|advanced>/<unit>/<Lxx>/lesson.ts` and `lesson.mdx` (examples, starters, solutions,
   hints, listening options), with the lesson `version` bumped per contracts §11.7. A changed exercise needs a new
   exercise version and its tests.
2. The spec `content/specs/<UNIT>.md` / `.ts` (`content/validate/specs.test.ts`).
3. Unlock-before-use in every legal order (contracts §3.1 rule 10): use a new sound only at or after its unlock
   site, or in a `preview: true` example.
4. Run `bun run content:check <lesson> --verbose`, `bun test content`, and the browser suite for the waves touched.
5. Candidates: A2.L04 (second break, foley chop), A1.L02 or A1.L03 (acid line on `sawtooth`), U01.L09 (a sixth
   bank), U02.L06 (extra timbres in the listening trials only), J1 (upgraded vibes and jazzkit).

### E. Fold into unit songs
1. `content/unit-songs/<UNIT>.ts`: per-flavour `code` (lint profile `band`, so locked sounds are fine); drum
   parts' `sounds` list any new drum name; bump the song `version` if the code changes.
2. `content/validate/unit-songs.ts` checks (evaluates, not silent, clash scan, cross-flavour agreement).
   Electronic must keep the same chord roots, bass downbeats and lead pitches as the other flavours (contracts §5.11
   rule 7).

### F. Fold into flavours (electronic)
1. `packages/content-kit/src/ids.ts`: the `FlavourId` union, `FLAVOUR_IDS`, the `flavour:` regex.
2. `content/flavours.ts`: the `flavour.electronic` kit (e.g. drums `snd.bank.RolandTR909`, bass
   `snd.wave.sawtooth`, chords `snd.pad` or `snd.wave.supersaw`, lead `snd.wave.square`, production in range),
   plus `FLAVOUR_RULES`.
3. `docs/design/contracts.md` §5.10 table and rules; `content/bands/index.ts` (all 23 Bands need electronic code);
   every `content/unit-songs/*.ts`; `content/capstones.ts`; `content/core/U08/L05/lesson.ts` and any lesson with
   `flavours:`; app surfaces (`app/src/lib/format.ts`, `app/src/album/cover.ts`, `app/src/capstone/content.ts`, the
   song style picker); tests enumerating flavours (`grep -rl "flavour.funk"`: about 40 files, including
   `packages/strudel/e2e/wave6-bands.ts` and `wave7-bands.ts` and `sound-wave{5,6,7}.json`).

### G. Release
1. Mirror in the release worktree (or copy `sounds/pack/<v>` and the lock); `bun run build` runs `sounds:check`.
2. `desktop/scripts/stage.sh` (current version only); `npm run dist`; regenerate `SHA256SUMS`; credits in About and
   README.
