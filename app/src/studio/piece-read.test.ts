// Oak 2.0 W3 stage 0: the worker's reading saved with every Studio version (`analysisForSave` never throws and never
// holds a save up), the defaults moved to @oak/content-kit (re-exported by model.ts and descriptive.ts unchanged),
// and the notes that mark a free sketch as a copy of Oak's code (the habits mirror skips those).
import { describe, expect, test } from "bun:test";
import { isDescriptive as kitIsDescriptive, OAK_DEFAULTS, OAK_START_NOTES } from "@oak/api";
import { strudel } from "../../../packages/grader/src/analyze/__support__/fixtures.ts";
import { toolSketchBody } from "../toolbox/model.ts";
import { isDescriptive } from "./descriptive.ts";
import * as M from "./model.ts";
import {
  ANALYSIS_SAVE_TIMEOUT_MS,
  analysisForSave,
  analysisOfNormalized,
  withTimeout,
} from "./piece-read.ts";
import { blankStartBody } from "./starts.ts";
import { STARTER_SONGS, templateSketchBody } from "./templates.ts";

const fromOak = (note: string | null): boolean => OAK_START_NOTES.some((p) => (note ?? "").startsWith(p));

describe("OAK_START_NOTES match the notes Oak's starts write", () => {
  test("a learning kit and a toolbox demo are Oak's code", () => {
    const song = STARTER_SONGS[0];
    if (!song) throw new Error("no starter song");
    expect(fromOak(templateSketchBody(song, "x", null).note)).toBe(true);
    expect(fromOak(toolSketchBody({ code: ".rev()" }, 's("bd sd").rev()').note)).toBe(true);
  });

  test("Oak's Blank and a sketch from scraps are the learner's", () => {
    const blank = blankStartBody(null, { title: "x", sessionId: null, bpm: 90, meter: "4/4" });
    expect(fromOak(blank.note)).toBe(false);
    expect(fromOak("From scraps")).toBe(false);
  });
});

describe("the defaults moved to @oak/content-kit", () => {
  test("model.ts re-exports the same objects", () => {
    expect(M.OAK_DEFAULTS).toBe(OAK_DEFAULTS);
    expect(M.DEFAULT_KEY).toBe(OAK_DEFAULTS.key);
    expect(M.OAK_DEFAULTS.lines).toContain(M.START_LINES.drums);
    expect(M.overBandStart("4/4").code).toBe(M.OVER_BAND_CODE);
    expect(M.BLANK_CODE.startsWith("setcpm(90/4)")).toBe(true);
  });

  test("descriptive.ts re-exports isDescriptive", () => {
    expect(isDescriptive).toBe(kitIsDescriptive);
    expect(isDescriptive("hh plays in drums.")).toBe(true);
    expect(isDescriptive("You should add hats")).toBe(false);
  });
});

describe("analysisOfNormalized", () => {
  test("the analysis of an Aeolian loop names schema.aeolian", async () => {
    const code = 'chords: note("<[a2,c3,e3] [f2,a2,c3] [c3,e3,g3] [g2,b2,d3]>").s("piano")';
    const a = analysisOfNormalized(await strudel(code, 4), {
      code,
      meter: "4/4",
      key: { tonic: "A", mode: "minor" },
      bars: 4,
    });
    expect(a.schemas.map((s) => s.schema)).toContain("schema.aeolian");
    expect(a.bars).toBe(4);
  });

  test("with no key chosen, the key is read from the notes", async () => {
    const code = 'chords: note("<[a2,c3,e3] [f2,a2,c3] [c3,e3,g3] [g2,b2,d3]>").s("piano")';
    const a = analysisOfNormalized(await strudel(code, 4), { code, meter: "4/4", key: null, bars: 4 });
    expect(a.key.length).toBeGreaterThan(0);
  });

  test("a drums-only piece has no key", async () => {
    const code = 'drums: s("bd ~ sd ~")';
    const a = analysisOfNormalized(await strudel(code, 4), { code, meter: "4/4", key: null, bars: 4 });
    expect(a.key).toEqual([]);
  });
});

describe("analysisForSave gives null after the timeout and never throws", () => {
  test("withTimeout", async () => {
    expect(await withTimeout(new Promise(() => {}), 10)).toBeNull();
    expect(await withTimeout(Promise.reject(new Error("x")), 10)).toBeNull();
    expect(await withTimeout(Promise.resolve(1), 10)).toBe(1);
  });

  test("a grader host that cannot start gives null, not an error", async () => {
    // Under bun test the browser host's worker import cannot load: the failure path of a real save.
    const t0 = performance.now();
    expect(await analysisForSave('drums: s("bd sd")', { meter: "4/4", key: null, bars: 4 })).toBeNull();
    expect(performance.now() - t0).toBeLessThan(ANALYSIS_SAVE_TIMEOUT_MS);
  });

  test("the save waits at most a few seconds (Oak's call)", () => {
    expect(ANALYSIS_SAVE_TIMEOUT_MS).toBe(3000);
  });
});
