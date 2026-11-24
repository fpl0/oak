// The pack's credits: credits.json (machine-readable; the app's About page renders it), CREDITS.md (for
// people) and the licence texts in LICENSES/. Every source of a shipped file has an entry, CC0 and
// Unlicense ones included (a courtesy; CC-BY ones are required, with their attribution and the note of
// what Oak changed). check.ts holds the licence allow-list and checks that every audio file is covered.

import { SOURCES } from "./library.ts";
import { type CreditEntry, LEGACY_GM, SAMPLE_MAPS } from "./pack.config.ts";

/** Licence texts shipped in LICENSES/ (copied byte-for-byte from their publishers; pinned in the lock). */
export const LICENSE_FILES: Record<string, string> = {
  "CC-BY-3.0.txt": "https://creativecommons.org/licenses/by/3.0/legalcode.txt",
  "CC-BY-4.0.txt": "https://creativecommons.org/licenses/by/4.0/legalcode.txt",
  "CC0-1.0.txt": "https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt",
  "Unlicense.txt": "https://unlicense.org/UNLICENSE",
  "FluidR3-MIT.md":
    "https://raw.githubusercontent.com/musescore/MuseScore/2782c43d211c210ec5f20ce0dbc5dbda49e967e6/share/sound/FluidR3Mono_License.md",
  // the MIT notice of the WebAudioFont conversion every GM preset file is (Copyright (c) 2017 Srgy Surkv)
  "webaudiofontdata-MIT.txt":
    "https://raw.githubusercontent.com/felixroos/webaudiofontdata/23ca907d4370a04fd89ca483a92915e4d6159ab9/LICENSE",
};

/** The conversion's notice, which MIT requires to ship with the preset files. */
const WEBAUDIOFONT_NOTICE =
  "WebAudioFont conversion Copyright (c) 2017 Srgy Surkv, MIT licence (LICENSES/webaudiofontdata-MIT.txt).";

const MP3 =
  "selected notes and velocity layers; trimmed; levelled; retuned to equal temperament; MP3 (LAME V0)";
const HITS = "selected hits; microphones mixed to mono one-shots; trimmed; levelled; FLAC";

/** What Oak did to each source's files. */
const MODIFIED: Record<string, string> = {
  jrhodes: MP3,
  sneakybass: MP3,
  smolken: MP3,
  shinyguitar: MP3,
  bassyr: MP3,
  fsbsclean: `${MP3}; folded to mono`,
  organ: "selected notes; trimmed; levelled; MP3 (LAME V0)",
  vsco: `${MP3}; strings kept in stereo`,
  vcsl: `${MP3} (pitched); trimmed, levelled one-shots as FLAC (percussion)`,
  virtuosity: `${HITS}; the lo-fi kit through Oak's lo-fi chain`,
  swirly: HITS,
  bigrusty: HITS,
  sonicpi: "trimmed; levelled; FLAC",
  akwf: "unchanged (single-cycle WAV files)",
};

/** Oak's own sounds (no upstream): released CC0 by Oak. */
const OAK: Record<string, { title: string; modified: string }> = {
  "oak-oak909": { title: "oak909 drum machine", modified: "synthesised by scripts/sounds/drummachine.ts" },
  "oak-oak808": { title: "oak808 drum machine", modified: "synthesised by scripts/sounds/drummachine.ts" },
  "oak-breaks": {
    title: "Oak breaks (brk, brkfunk, brkboombap, brkjungle, brkhouse, brkjazz, brklofi)",
    modified:
      "original grooves rendered by scripts/sounds/brk.ts and breaks.ts from Oak's CC0 kits and the uzu-drumkit",
  },
  "oak-tables": {
    title: "Oak wavetables (wt_morph, wt_pwm, wt_drawbar, wt_fmsweep)",
    modified: "computed by scripts/sounds/wavetables.ts",
  },
  "oak-tape": { title: "Oak tape bed (tape)", modified: "synthesised by scripts/sounds/dsp.ts" },
};

export interface CreditItem {
  id: string;
  entry: CreditEntry;
}

/** One entry per source that a shipped file comes from, with the Oak sounds built from it. */
export function buildCredits(sounds: Map<string, Set<string>>): CreditItem[] {
  const out: CreditItem[] = [];
  const list = (id: string) => [...(sounds.get(id) ?? [])].sort();
  for (const [id, s] of Object.entries(SOURCES)) {
    if (!sounds.has(id)) continue;
    out.push({
      id,
      entry: {
        ...s.credit,
        pinned: s.kind === "github" ? `${s.repo}@${s.commit}` : `${s.url} (sha256 ${s.sha256})`,
        modified: MODIFIED[id] ?? "trimmed; levelled",
        sounds: list(id),
        ...(id === "sonicpi" ? { origins: SONIC_PI_ORIGINS } : {}),
      },
    });
  }
  for (const m of SAMPLE_MAPS) {
    const id = m.json.replace(/\.json$/, "");
    if (!sounds.has(id)) continue;
    out.push({
      id,
      entry: {
        ...m.credit,
        pinned: `https://strudel.b-cdn.net/${m.json}`,
        modified:
          id === "piano"
            ? "unchanged from the Strudel project's MP3 set"
            : "unchanged; roles outside Oak's drum set pruned",
        sounds: list(id),
      },
    });
  }
  if (sounds.has("gm-fluidr3"))
    out.push({
      id: "gm-fluidr3",
      entry: {
        title: "FluidR3 GM SoundFont (WebAudioFont presets)",
        author: "Frank Wen; converted by the webaudiofontdata project",
        url: "https://github.com/felixroos/webaudiofontdata",
        licence: "MIT",
        licenceUrl: "https://opensource.org/license/mit",
        attribution: `Fluid (R3) SoundFont, Copyright (c) 2000-2002, 2008 Frank Wen, MIT licence (LICENSES/FluidR3-MIT.md). ${WEBAUDIOFONT_NOTICE}`,
        pinned: "https://felixroos.github.io/webaudiofontdata/sound/",
        modified: "unchanged",
        sounds: list("gm-fluidr3"),
      },
    });
  if (sounds.has("gm-legacy"))
    out.push({
      id: "gm-legacy",
      entry: {
        title: "General MIDI WebAudioFont presets (JCLive, Aspirin, LK_AcousticSteel and others)",
        author: "Various SoundFont authors; converted by the webaudiofontdata project (MIT)",
        url: "https://github.com/felixroos/webaudiofontdata",
        licence: LEGACY_GM,
        licenceUrl: "https://github.com/felixroos/webaudiofontdata",
        attribution: WEBAUDIOFONT_NOTICE,
        pinned: "https://felixroos.github.io/webaudiofontdata/sound/",
        modified:
          "unchanged. Kept from earlier packs so gm_* names and the acgtr, clav, pad and choir sounds keep playing; the source SoundFonts' own licences could not be verified, and each is to be replaced by a CC0 recording.",
        sounds: list("gm-legacy"),
      },
    });
  for (const [id, o] of Object.entries(OAK)) {
    if (!sounds.has(id)) continue;
    out.push({
      id,
      entry: {
        title: o.title,
        author: "Oak",
        url: "https://github.com/fpl0/oak",
        licence: "CC0-1.0",
        licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        modified: o.modified,
        sounds: list(id),
      },
    });
  }
  return out;
}

/** freesound.org pages behind the Sonic Pi samples Oak ships (etc/samples/README.md). */
const SONIC_PI_ORIGINS = [
  "vinyl_hiss: https://freesound.org/people/veezay/sounds/130393/",
  "vinyl_scratch: https://freesound.org/people/hello_flowers/sounds/28681/",
  "vinyl_rewind: https://freesound.org/people/TasmanianPower/sounds/162493/",
  "perc_snap: https://freesound.org/people/SoundCollectah/sounds/109400/",
  "perc_snap2: https://freesound.org/people/Peram/sounds/158615/",
  "perc_impact1: https://freesound.org/people/hullum/sounds/415578/",
  "perc_impact2: https://freesound.org/people/hullum/sounds/415581/",
  "perc_swoosh: https://freesound.org/people/hullum/sounds/415580/",
  "perc_door: https://freesound.org/people/hullum/sounds/415579/",
  "perc_swash: https://freesound.org/people/qubodup/sounds/60009/",
  "ambi_dark_woosh: https://freesound.org/people/EcoDTR/sounds/27281/",
  "ambi_drone: https://freesound.org/people/Autistic%20Lucario/sounds/195341/",
  "ambi_glass_hum: https://freesound.org/people/kaligari/sounds/35391/",
  "glitch_perc1-5: https://freesound.org/people/hullum/sounds/415548/ (and 415555, 415554, 415553, 415552)",
  "elec_wood: https://freesound.org/people/looppool/sounds/13135/",
  "elec_pop: https://freesound.org/people/looppool/sounds/13134/",
  "elec_twip: https://freesound.org/people/looppool/sounds/13094/",
  "tbd_perc_tap_1: donated to Sonic Pi by The Black Dog under CC0",
];

/** CREDITS.md: the same entries for people. */
export function creditsMarkdown(version: string, items: CreditItem[]): string {
  const lines = [
    `# Oak sound pack ${version}: credits and licences`,
    "",
    "CC BY works are credited as their authors ask; CC0, Unlicense and MIT works are credited as a courtesy.",
    "Oak's own renders (drum machines, breaks, wavetables, tape) are released CC0. The last entry, the General",
    "MIDI presets kept from earlier packs, is the one exception: its source SoundFonts' licences could not be",
    "verified, and each is to be replaced. Licence texts are in LICENSES/.",
    "",
    "Music you make with these sounds is yours.",
    "",
  ];
  const order = (i: CreditItem) =>
    i.entry.licence.startsWith("CC-BY")
      ? 0
      : i.entry.licence === LEGACY_GM
        ? 3
        : i.entry.author === "Oak"
          ? 2
          : 1;
  for (const i of [...items].sort(
    (a, b) => order(a) - order(b) || a.entry.title.localeCompare(b.entry.title),
  )) {
    const e = i.entry;
    lines.push(`## ${e.title}`, "");
    lines.push(`- Author: ${e.author}`);
    lines.push(`- Source: ${e.url}${e.pinned ? ` (${e.pinned})` : ""}`);
    lines.push(`- Licence: ${e.licence} (${e.licenceUrl})`);
    if (e.attribution) lines.push(`- Attribution: ${e.attribution}`);
    lines.push(`- Changes: ${e.modified}`);
    lines.push(`- Oak sounds: ${e.sounds.join(", ")}`);
    if (e.origins?.length) {
      lines.push("- Originals:");
      for (const o of e.origins) lines.push(`  - ${o}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}`;
}
