import { describe, expect, test } from "bun:test";
import type { SyllabusDef } from "@oak/content-kit";
import { syllabus } from "../../../../content/syllabus.ts";
import { TRACK_LENS_IDS, type TrackLensPrefs } from "../../lib/lenses.ts";
import { TRACK_SWITCHES } from "../../workbench/track-switches.ts";
import { TRACK_LENS_KEYS, TRACK_LENS_OF_KEY, trackLensOpens, trackLensRows } from "./track-lenses.ts";

const S = syllabus as unknown as SyllabusDef;
const all = (v: boolean) => Object.fromEntries(TRACK_LENS_IDS.map((id) => [id, v])) as TrackLensPrefs;

describe("the track lenses in the shell", () => {
  test("the keys agree with the Workbench's switches", () => {
    for (const s of TRACK_SWITCHES) expect([s.id, TRACK_LENS_KEYS[s.id] ?? ""]).toEqual([s.id, s.keys]);
    expect(TRACK_LENS_OF_KEY).toEqual({
      "Shift+X": "tensions",
      "Shift+Q": "chordScales",
      "Shift+D": "density",
    });
  });

  test("a lens not open says where it opens, by the lesson's title, never its id", () => {
    expect(trackLensOpens("clave", S)).toBe("Opens with the lesson “Clave Direction”.");
    expect(trackLensOpens("clave", null)).toBe("Opens with a later lesson.");
    const rows = trackLensRows(all(true), { ...all(false), voicings: true }, S);
    expect(rows.map((r) => r.id)).toEqual([...TRACK_LENS_IDS]);
    const voicings = rows.find((r) => r.id === "voicings");
    expect(voicings).toMatchObject({ available: true, on: true, state: "On", keys: null });
    const tensions = rows.find((r) => r.id === "tensions");
    expect(tensions).toMatchObject({ available: false, on: false, keys: "Shift+X" });
    expect(tensions?.state).toBe("Opens with the lesson “Extensions”.");
    // Never a count of what is missing.
    for (const r of rows) expect(r.state).not.toMatch(/\d+ (more|left|to go)/);
  });

  test("an open lens switched off says Off", () => {
    const rows = trackLensRows({ ...all(true), density: false }, all(true), S);
    expect(rows.find((r) => r.id === "density")).toMatchObject({ on: false, state: "Off" });
  });
});
