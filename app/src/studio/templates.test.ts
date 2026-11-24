// The Studio's song templates (templates.ts): every template row of the toolbox has a starter song; each lints
// clean with what the learner has where it unlocks (the way demos-w7.test.ts checks the Toolbox examples); each
// plays with every part sounding; its tempo, key and length are the ones its code plays.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { SessionId } from "@oak/content-kit";
import { initRealm } from "@oak/grader";
import { evalHeadless } from "@oak/grader/testing";
import { toolbox } from "../../../content/toolbox.ts";
import { lint } from "../../../content/validate/harness.ts";
import {
  STARTER_SONGS,
  starterSong,
  templateDetail,
  templateSketchBody,
  templateTitle,
} from "./templates.ts";

setDefaultTimeout(120_000);
beforeAll(async () => {
  await initRealm({ toolbox: [], lockdown: false });
});

const templates = toolbox.filter((t) => t.kind === "template" && /^Studio template /.test(t.code));
const sitesOf = (t: (typeof toolbox)[number]): string[] =>
  Array.isArray(t.unlock.at) ? [...t.unlock.at] : [t.unlock.at];

/** The loop's length: the least common multiple of the top-level `<…>` alternations (`x!n` counts n). */
function loopBars(code: string): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let bars = 1;
  for (const m of code.matchAll(/"<([^"]*)>"/g)) {
    let depth = 0;
    let count = 0;
    let token = "";
    const flush = () => {
      const t = token.trim();
      if (t) count += Number(/!(\d+)$/.exec(t)?.[1] ?? 1);
      token = "";
    };
    for (const ch of m[1] as string) {
      if ("[<{(".includes(ch)) depth++;
      if ("]>})".includes(ch)) depth--;
      if (ch === " " && depth === 0) flush();
      else token += ch;
    }
    flush();
    bars = (bars * count) / gcd(bars, count);
  }
  return bars;
}

describe("the Studio's song templates", () => {
  test("every template row has a starter song, and every starter song is a template row's", () => {
    expect(templates.map((t) => t.id).sort()).toEqual(STARTER_SONGS.map((s) => s.id).sort());
    for (const t of templates) expect(`Studio template "${starterSong(t.id)?.name}"`).toBe(t.code);
  });

  for (const song of STARTER_SONGS) {
    test(`${song.name}: lints clean where it unlocks, plays, every part sounds`, async () => {
      const row = templates.find((t) => t.id === song.id);
      expect(row).toBeDefined();
      for (const site of sitesOf(row as (typeof toolbox)[number]))
        for (const profile of ["content", "studio"] as const) {
          const r = lint(song.code, {
            session: site as SessionId,
            meter: song.meter,
            key: song.key,
            profile,
          });
          const bad = r.diagnostics.filter((d) => d.severity === "error" || d.severity === "warn");
          expect({ site, profile, bad: bad.map((d) => `${d.id} ${d.message}`), locked: r.locked }).toEqual({
            site,
            profile,
            bad: [],
            locked: [],
          });
        }
      const r = await evalHeadless(song.code, song.bars);
      const tracks = new Set(r.events.map((e) => e.track));
      const labels = [...song.code.matchAll(/^([a-z]+):/gm)].map((m) => m[1] as string);
      for (const l of labels) expect({ l, sounds: tracks.has(l) }).toEqual({ l, sounds: true });
      expect(
        r.logs.filter((l) => /\[(mini|tonal|voicing|query|eval)\]|error|unknown chord/i.test(l)),
      ).toEqual([]);
      // Its learner's part is marked, and the song is a whole one: 8 to 16 bars, the blues 12.
      expect(song.code).toMatch(/^\/\/ Your /m);
      expect(song.bars).toBeGreaterThanOrEqual(8);
      expect(song.bars).toBeLessThanOrEqual(16);
      if (/blues|shuffle/i.test(song.name)) expect(song.bars).toBe(12);
    });

    test(`${song.name}: its tempo, meter, key and length are the code's`, () => {
      expect(Number(/setcpm\((\d+)\/4\)/.exec(song.code)?.[1])).toBe(song.bpm);
      expect(song.meter).toBe("4/4");
      expect(loopBars(song.code)).toBe(song.bars);
      for (const m of song.code.matchAll(/\.scale\("([A-G][#b]?)\d:([a-z ]+)"\)/g))
        expect({ tonic: m[1], mode: m[2] }).toEqual(song.key);
    });
  }
});

describe("a sketch from a template", () => {
  test("is titled after the template, never the title of a sketch already there", () => {
    expect(templateTitle("Four-chord pop", [{ title: "Sketch 001" }])).toBe("Four-chord pop");
    expect(templateTitle("Four-chord pop", [{ title: "Four-chord pop" }])).toBe("Four-chord pop 2");
    expect(
      templateTitle("Four-chord pop", [{ title: "Four-chord pop" }, { title: "Four-chord pop 2" }]),
    ).toBe("Four-chord pop 3");
  });

  test("carries the template's code, tempo, meter and key, with no Band", () => {
    const song = STARTER_SONGS[1] as (typeof STARTER_SONGS)[number];
    const body = templateSketchBody(song, "12-bar shuffle", null);
    expect(body).toMatchObject({
      title: "12-bar shuffle",
      originKind: "free",
      code: song.code,
      bpm: 100,
      meter: "4/4",
      key: { tonic: "A", mode: "blues" },
      band: null,
    });
  });
});

describe("a template in the New sketch dialog", () => {
  test("reads as its key, tempo and length", () => {
    expect(STARTER_SONGS.map(templateDetail)).toEqual([
      "G major, 100 BPM, 8 bars",
      "A blues, 100 BPM, 12 bars",
      "D Dorian, 96 BPM, 8 bars",
      "F blues, 132 BPM, 12 bars",
    ]);
  });
});
