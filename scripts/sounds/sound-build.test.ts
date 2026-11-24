// The v4 build's own audio code: Oak's FLAC writer is lossless and deterministic, the pitch measure finds a
// partial's offset, the library's note names and pinned sources are well-formed, and every kit alias and
// sample alias the runtime will register is consistent with pack.config.ts. No network.
import { describe, expect, test } from "bun:test";
import gm from "@strudel/soundfonts/gm.mjs";
import { decodeAudio, measureCents, midiToHz, retune } from "./audio.ts";
import { BREAKS } from "./breaks.ts";
import { buildCredits, LICENSE_FILES } from "./credits.ts";
import { encodeFlac } from "./flac.ts";
import { midiOf, PITCHED, SOURCES, type Source } from "./library.ts";
import {
  FLUIDR3_FONT,
  GM_VARIANTS,
  isSampleAlias,
  KIT_ALIASES,
  LICENCE_ALLOW_LIST,
  OAK_ALIASES,
  OAK_KITS,
} from "./pack.config.ts";
import { renderTable, WT_FRAME, WT_FRAMES } from "./wavetables.ts";

const RATE = 44100;
const sine = (hz: number, sec: number, amp = 0.5) =>
  Float32Array.from(
    { length: Math.round(sec * RATE) },
    (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / RATE),
  );

describe("encodeFlac", () => {
  test("round-trips 16-bit mono and stereo exactly (decoded by the reference flac)", () => {
    let seed = 7;
    const noise = Float32Array.from({ length: 9000 }, () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed / 2147483648 - 0.5) * 0.4;
    });
    for (const channels of [[sine(220, 0.2)], [sine(330, 0.2, 0.3), noise.slice(0, sine(330, 0.2).length)]]) {
      const bytes = encodeFlac({ sampleRate: RATE, channels });
      expect(encodeFlac({ sampleRate: RATE, channels })).toEqual(bytes);
      const back = decodeAudio(bytes);
      expect(back.channels.length).toBe(channels.length);
      for (const [c, ch] of channels.entries()) {
        const got = back.channels[c] as Float32Array;
        expect(got.length).toBe(ch.length);
        let worst = 0;
        for (let i = 0; i < ch.length; i++)
          worst = Math.max(
            worst,
            Math.abs((got[i] as number) - Math.round((ch[i] as number) * 32767) / 32768),
          );
        expect(worst).toBe(0);
      }
    }
  });
});

describe("pitch", () => {
  test("measureCents finds a sine's offset; retune removes it", () => {
    const hz = midiToHz(57) * 2 ** (17 / 1200);
    const p = { sampleRate: RATE, channels: [sine(hz, 1.5)] };
    const c = measureCents(p, 57);
    expect(c).not.toBeNull();
    expect(Math.abs((c as number) - 17)).toBeLessThan(1);
    const fixed = measureCents(retune(p, -(c as number)), 57);
    expect(Math.abs(fixed as number)).toBeLessThan(1);
  });
});

describe("library", () => {
  test("note names: C4 is 60, an octave convention shifts them", () => {
    expect(midiOf("C4")).toBe(60);
    expect(midiOf("a2")).toBe(45);
    expect(midiOf("Bb1")).toBe(34);
    expect(midiOf("G#3", 12)).toBe(68);
  });

  test("every source is pinned and on the licence allow-list; CC BY ones carry their attribution", () => {
    for (const [id, s] of Object.entries(SOURCES) as [string, Source][]) {
      if (s.kind === "github") expect([id, /^[0-9a-f]{40}$/.test(s.commit)]).toEqual([id, true]);
      else expect([id, /^[0-9a-f]{64}$/.test(s.sha256)]).toEqual([id, true]);
      expect([id, LICENCE_ALLOW_LIST.includes(s.credit.licence)]).toEqual([id, true]);
      if (s.credit.licence.startsWith("CC-BY")) expect([id, !!s.credit.attribution]).toEqual([id, true]);
    }
  });

  test("every sampled instrument is a sample alias whose layers its split can reach", () => {
    for (const [alias, spec] of Object.entries(PITCHED)) {
      const a = OAK_ALIASES[alias];
      expect([alias, !!a && isSampleAlias(a)]).toEqual([alias, true]);
      if (!a || !isSampleAlias(a)) continue;
      const layers = Math.max(...spec.notes.map((n) => n.layers.length));
      expect([alias, (a.split?.length ?? 0) + 1]).toEqual([alias, layers]);
      const midis = spec.notes.map((n) => n.midi);
      expect([alias, [...midis].sort((x, y) => x - y)]).toEqual([alias, midis]);
    }
  });

  test("retired bank names play Oak kits; breaks are two bars on a known grid", () => {
    for (const kit of Object.values(KIT_ALIASES)) expect(kit in OAK_KITS).toBe(true);
    for (const [name, b] of Object.entries(BREAKS)) {
      expect([name, /^[a-z][a-z0-9]*$/.test(name)]).toEqual([name, true]);
      for (const t of b.tracks) {
        expect([name, t.bars.length]).toEqual([name, 2]);
        for (const bar of t.bars) expect([name, t.name, bar.length]).toEqual([name, t.name, b.steps]);
        expect([name, t.voice.kit in OAK_KITS]).toEqual([name, true]);
      }
    }
  });
});

test("Oak's wavetables are 64 frames of 2048 samples, peak 0.9", () => {
  const t = renderTable("wt_morph");
  const x = t.channels[0] as Float32Array;
  expect(x.length).toBe(WT_FRAME * WT_FRAMES);
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  expect(peak).toBeCloseTo(0.9, 3);
});

describe("General MIDI presets and their credits", () => {
  // The `n` indices v3's toolbox printed and its pack mirrored (main's GM_VARIANTS) that are FluidR3 (MIT): code
  // written from those labels, such as s("gm_vibraphone:3"), must keep selecting the same preset. pinVariant
  // wraps an unmirrored index onto index 0, a different preset an octave or two off for organ and vibraphone.
  const V3_FLUIDR3: [string, number][] = [
    ["gm_epiano1", 1],
    ["gm_drawbar_organ", 3],
    ["gm_acoustic_bass", 1],
    ["gm_electric_bass_pick", 1],
    ["gm_electric_guitar_jazz", 3],
    ["gm_choir_aahs", 2],
    ["gm_vibraphone", 3],
    ["gm_flute", 2],
  ];

  test("v3's FluidR3 variants are still mirrored at the same index", () => {
    const fonts = gm as Record<string, string[]>;
    for (const [name, n] of V3_FLUIDR3) {
      expect([name, n, GM_VARIANTS[name]?.includes(n)]).toEqual([name, n, true]);
      expect([name, n, FLUIDR3_FONT.test(fonts[name]?.[n] ?? "")]).toEqual([name, n, true]);
    }
  });

  test("the webaudiofontdata conversion's MIT notice ships in LICENSES/, pinned to a commit", () => {
    const url = LICENSE_FILES["webaudiofontdata-MIT.txt"] ?? "";
    expect(url).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/felixroos\/webaudiofontdata\/[0-9a-f]{40}\/LICENSE$/,
    );
  });

  test("GM credits point at that notice; the upright's credit says it was retuned and re-encoded", () => {
    const sounds = new Map([
      ["gm-fluidr3", new Set(["gm_vibraphone"])],
      ["gm-legacy", new Set(["gm_piano"])],
      ["smolken", new Set(["upright"])],
    ]);
    const byId = Object.fromEntries(buildCredits(sounds).map((c) => [c.id, c.entry]));
    for (const id of ["gm-fluidr3", "gm-legacy"])
      expect([id, `${byId[id]?.attribution} ${byId[id]?.author}`]).toEqual([
        id,
        expect.stringContaining("LICENSES/webaudiofontdata-MIT.txt"),
      ]);
    expect(byId.smolken?.modified).toContain("retuned to equal temperament");
    expect(byId.smolken?.modified).toContain("MP3");
  });
});
