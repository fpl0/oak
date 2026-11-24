import { expect, test } from "bun:test";
import type { CalibrationRecord } from "@oak/api";
import { calibrationLine, inputLabel, lastLeak, lastMatch } from "./history.ts";

const rec = (kind: CalibrationRecord["kind"], result: Record<string, unknown>): CalibrationRecord => ({
  id: 1,
  kind,
  result,
  at: "2026-11-11T10:00:00.000Z",
});

test("one readable line per calibration kind", () => {
  expect(
    calibrationLine(rec("range", { lowMidi: 45, highMidi: 64, comfortLowMidi: 48, comfortHighMidi: 60 })),
  ).toBe("Range · A2–E4, comfortable C3–C4");
  expect(calibrationLine(rec("noise", { floorDb: -58.4 }))).toBe("Noise floor · -58 dBFS");
  expect(calibrationLine(rec("tap-latency", { latencyMs: 33.6 }))).toBe("Tap latency · 34 ms");
  expect(calibrationLine(rec("bleed", { heard: false }))).toBe("Headphone leak · none");
  expect(calibrationLine(rec("bleed", { heard: true }))).toBe("Headphone leak · the mic heard Oak's sound");
  expect(calibrationLine(rec("output", { choice: "bluetooth", lrCorrect: true }))).toBe(
    "Output · Bluetooth, left and right correct",
  );
  expect(calibrationLine(rec("pitch-match", { first: true, centsError: -12 }))).toBe(
    "First note · sung (-12¢)",
  );
  expect(calibrationLine(rec("sing-latency", {}))).toBe("Sing latency · not measured");
});

test("input words", () => {
  expect(inputLabel({ inputKind: "none", quiet: true })).toBe("No microphone (Quiet mode)");
  expect(inputLabel({ inputKind: "builtin", quiet: true })).toBe("Built-in microphone · Quiet mode on");
});

test("the three-note pitch match", () => {
  const match = rec("pitch-match", {
    trials: [
      { midi: 60, cents: 12 },
      { midi: 64, cents: -70 },
      { midi: 55, cents: 30 },
    ],
    within: 2,
    windowCents: 50,
  });
  expect(calibrationLine(match)).toBe("Pitch match · 2 of 3 within ±50¢");
  expect(lastMatch([rec("pitch-match", { first: true, centsError: 3 }), match])).toBe("2 of 3 within ±50¢");
  expect(lastMatch([rec("range", {})])).toBeNull();
});

test("the newest speaker check, for Settings › Voice", () => {
  expect(lastLeak([rec("range", {})])).toBeNull();
  expect(lastLeak([rec("bleed", { heard: true }), rec("bleed", { heard: false })])).toEqual({
    heard: true,
    words: "Your mic hears Oak's sound",
  });
  expect(lastLeak([rec("noise", { floorDb: -60 }), rec("bleed", { heard: false })])?.heard).toBe(false);
});
