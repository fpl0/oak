// Oak 2.0 W1 plain sounds (PLAN S4): a live listening filter on the learner's pitched parts. Review Focus 4: it
// changes only learner bass, chords and tune haps, never drums, the Band or the code, and turning it off restores.
import { beforeAll, describe, expect, test } from "bun:test";
import { PLAIN_SOUNDS } from "@oak/content-kit";
import * as core from "@strudel/core";
import * as mini from "@strudel/mini";
import * as tonal from "@strudel/tonal";
import { transpiler } from "@strudel/transpiler";
import { finalizePattern, installTrackWrapper, newSession } from "./evaluation.ts";
import { stubVisualMethods } from "./pack.ts";
import { PLAIN_STRIP, plainValue } from "./plain-sounds.ts";
import { queryLiveHaps } from "./transport.ts";
import type { MuteMap } from "./types.ts";

beforeAll(async () => {
  await core.evalScope(core, mini, tonal);
  stubVisualMethods(core.Pattern);
});

describe("plainValue", () => {
  test("only learner bass, chords and tune haps change; drums, Band and the code do not", () => {
    const bass = { note: 36, s: "ebass", lpf: 600, gain: 0.8, room: 0.3 };
    const before = JSON.stringify(bass);
    expect(plainValue(bass, "bass")).toEqual({ note: 36, s: PLAIN_SOUNDS.bass, gain: 0.8 });
    expect(JSON.stringify(bass)).toBe(before); // the input is not mutated
    expect(plainValue({ note: 48, s: "rhodes" }, "chords")).toEqual({ note: 48, s: PLAIN_SOUNDS.chords });
    expect(plainValue({ note: 48, s: "rhodes", attack: 0.2 }, "pad")).toEqual({
      note: 48,
      s: PLAIN_SOUNDS.chords,
    });
    expect(plainValue({ note: 72, s: "sawtooth", delay: 0.4 }, "mel")).toEqual({
      note: 72,
      s: PLAIN_SOUNDS.tune,
    });
    // Muted-in-code marks are read through `roleOfLabel`.
    expect(plainValue({ note: 36, s: "ebass" }, "_bass")).toEqual({ note: 36, s: PLAIN_SOUNDS.bass });
    // Kept: level, place, pitch and length.
    expect(
      plainValue(
        { n: 2, note: 40, freq: 82.4, s: "ebass", velocity: 0.5, postgain: 1.2, pan: 0.3, legato: 0.9 },
        "bass",
      ),
    ).toEqual({
      n: 2,
      note: 40,
      freq: 82.4,
      s: PLAIN_SOUNDS.bass,
      velocity: 0.5,
      postgain: 1.2,
      pan: 0.3,
      legato: 0.9,
    });
    // Every PLAIN_STRIP key goes.
    const loaded: Record<string, unknown> = { note: 36, s: "ebass" };
    for (const key of PLAIN_STRIP) loaded[key] = 1;
    expect(plainValue(loaded, "bass")).toEqual({ note: 36, s: PLAIN_SOUNDS.bass });

    const drums = { s: "bd", bank: "oak909" };
    expect(plainValue(drums, "drums")).toBe(drums);
    const band = { note: 36, s: "ebass", lpf: 600 };
    expect(plainValue(band, "band.bass")).toBe(band);
    expect(plainValue(band, "band.mel")).toBe(band);
    expect(plainValue(band, null)).toBe(band);
    const riff = { note: 60, s: "gm_electric_guitar_clean", room: 0.2 };
    expect(plainValue(riff, "riff")).toEqual({ note: 60, s: PLAIN_SOUNDS.tune });
    const riffNoPitch = { s: "cp", room: 0.2 };
    expect(plainValue(riffNoPitch, "riff")).toBe(riffNoPitch);
    expect(plainValue("c3", "bass")).toBe("c3");
    expect(plainValue(5, "bass")).toBe(5);
    expect(plainValue(null, "bass")).toBe(null);
  });
});

describe("plain sounds on the playing pattern", () => {
  test("off restores", async () => {
    const mutes: MuteMap = { muted: new Set(), solo: null };
    let plain = true;
    let session = newSession();
    const repl = core.repl({
      defaultOutput: () => {},
      getTime: () => 0,
      transpiler,
      beforeEval: async () => {
        session = newSession();
        installTrackWrapper(session, () => mutes);
      },
      editPattern: (pat: Strudel.Pattern) =>
        finalizePattern(pat, { session, mutes: () => mutes, plain: () => plain }),
    });
    const code = 'bass: note("c2").s("ebass").lpf(600)\ndrums: s("bd").bank("oak909")';
    await repl.evaluate(code, false);
    const pattern = repl.state.pattern as Strudel.Pattern;
    const valueFor = (track: string) => queryLiveHaps(pattern, 0, 1).find((h) => h.track === track)?.value;

    const on = valueFor("bass");
    expect(on?.s).toBe(PLAIN_SOUNDS.bass);
    // Strudel stores `.lpf(600)` under its canonical control name, `cutoff`.
    expect(on?.cutoff).toBeUndefined();
    expect(on?.lpf).toBeUndefined();
    expect(valueFor("drums")).toMatchObject({ s: "bd", bank: "oak909" });

    plain = false; // the same pattern, queried again: no re-evaluation
    const off = valueFor("bass");
    expect(off?.s).toBe("ebass");
    expect(off?.cutoff ?? off?.lpf).toBe(600);
    expect(code).toBe('bass: note("c2").s("ebass").lpf(600)\ndrums: s("bd").bank("oak909")');
  });
});
