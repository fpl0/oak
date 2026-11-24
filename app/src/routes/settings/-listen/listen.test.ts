import { describe, expect, test } from "bun:test";
import type { LessonDef } from "@oak/content-kit";
import { evalHeadless, midisOf } from "@oak/grader/testing";
import {
  codeHash,
  exportMarks,
  filterExamples,
  fromGenerated,
  fromLessons,
  type ListenMark,
  marksByRef,
  SOUNDS_UNIT,
  soundDemo,
  soundItems,
  statusOf,
} from "./listen.ts";

describe("listen manifest", () => {
  test("hash is deterministic and changes with the code", () => {
    expect(codeHash('s("bd")')).toBe(codeHash('s("bd")'));
    expect(codeHash('s("bd")')).not.toBe(codeHash('s("sd")'));
    expect(codeHash("")).toMatch(/^[0-9a-f]{8}$/);
  });

  test("generated entries are normalised; junk is skipped", () => {
    const ex = fromGenerated([
      { ref: "U01.L02@beat", code: 's("bd")', hash: "abc", bars: 2, key: null, meter: "4/4" },
      { ref: 3 },
      null,
    ]);
    expect(ex).toEqual([
      { ref: "U01.L02@beat", code: 's("bd")', hash: "abc", bars: 2, key: null, meter: "4/4", unit: "U01" },
    ]);
    expect(fromGenerated({})).toEqual([]);
  });

  test("lesson step examples are collected when the build has not run", () => {
    const lesson = {
      id: "U03.L02",
      key: { tonic: "D", mode: "major" },
      meter: "4/4",
      steps: [
        { id: "s1", example: { id: "walk", code: 'mel: n("0 1 2")', bars: 1 } },
        { id: "s2" },
        { id: "s3", example: { id: "voiced", code: 'chords: chord("D").voicing()', bars: 2, preview: true } },
      ],
    } as unknown as LessonDef;
    const ex = fromLessons([lesson]);
    expect(ex.map((e) => [e.ref, e.unit, e.bars, e.preview ?? false])).toEqual([
      ["U03.L02@voiced", "U03", 2, true],
      ["U03.L02@walk", "U03", 1, false],
    ]);
    expect(ex[0]?.key).toEqual({ tonic: "D", mode: "major" });
  });
});

describe("verdicts", () => {
  const a = fromGenerated([{ ref: "U01.L01@a", code: "x" }])[0];
  const b = fromGenerated([{ ref: "U02.L01@b", code: "y" }])[0];
  if (!a || !b) throw new Error("fixtures");
  const ok: ListenMark = { ref: a.ref, hash: a.hash, verdict: "ok", note: "", at: "2026-11-11T00:00:00Z" };

  test("status: unmarked, ok, flagged, changed since its verdict", () => {
    expect(statusOf(a, undefined)).toBe("unmarked");
    expect(statusOf(a, ok)).toBe("ok");
    expect(statusOf(a, { ...ok, verdict: "wrong-sound" })).toBe("flagged");
    expect(statusOf({ ...a, hash: "different" }, ok)).toBe("changed");
  });

  test("filters by unit and by 'needs a listen'", () => {
    const marks = { [a.ref]: ok };
    expect(filterExamples([a, b], marks, { unit: null, needsListen: true }).map((e) => e.ref)).toEqual([
      b.ref,
    ]);
    expect(filterExamples([a, b], marks, { unit: "U01", needsListen: false }).map((e) => e.ref)).toEqual([
      a.ref,
    ]);
    expect(filterExamples([{ ...a, hash: "new" }, b], marks, { unit: null, needsListen: true }).length).toBe(
      2,
    );
  });

  test("server marks are keyed by ref, newest first wins, and export sorted", () => {
    const older = { ...ok, verdict: "weak" as const, at: "2026-11-10T00:00:00Z" };
    const other = { ...ok, ref: "U00.L01@z", verdict: "weak" as const, note: "thin" };
    const marks = marksByRef([ok, older, other]);
    expect(marks[a.ref]?.verdict).toBe("ok");
    expect(JSON.parse(exportMarks(marks)).map((m: ListenMark) => m.ref)).toEqual(["U00.L01@z", "U01.L01@a"]);
  });
});

describe("sounds", () => {
  const items = soundItems({
    aliases: ["upright", "rhodes"],
    soundfonts: ["gm_piano"],
    samples: { "uzu-drumkit": ["_base", "sd", "bd", "hh"], piano: ["piano"] },
  });

  test("every curated sound is one item with a stable ref, grouped", () => {
    expect(items.map((i) => i.ref)).toEqual([
      "sound:rhodes",
      "sound:upright",
      "sound:piano",
      "sound:bd",
      "sound:hh",
      "sound:sd",
      "sound:gm_piano",
      "sound:sine",
      "sound:triangle",
      "sound:square",
      "sound:sawtooth",
    ]);
    expect(items.find((i) => i.ref === "sound:bd")?.group).toBe("Drum kit");
    expect(items.every((i) => i.unit === SOUNDS_UNIT && i.hash === codeHash(i.code))).toBe(true);
  });

  test("demos follow the dialect and play in the right register", async () => {
    for (const i of items) {
      expect(i.code.startsWith("setcpm(96/4)\n\n")).toBe(true);
      expect(i.code).not.toContain("'");
      const r = await evalHeadless(i.code, 1);
      expect(r.events.length, i.ref).toBeGreaterThan(0);
    }
    expect(await midisOf(soundDemo("upright", "pitched"), 1)).toEqual([36, 43, 48]);
    expect(await midisOf(soundDemo("rhodes", "pitched"), 1)).toEqual([60, 64, 67, 60, 64, 67]);
  });
});
