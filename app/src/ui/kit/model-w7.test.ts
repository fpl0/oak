import { describe, expect, test } from "bun:test";
import type { TrackState } from "@oak/api";
import {
  euclidCode,
  euclidGrid,
  euclidKeyValue,
  euclidText,
  exportStatusText,
  INAUDIBLE_BELOW_DB,
  laneOfKey,
  levelRows,
  nextVersion,
  ringPoint,
  tapCountText,
  trackCapstonesText,
  trackCardLine,
  trackCardState,
  trackCardSummary,
  trackNext,
  trackProgressText,
  trackWaitingFor,
  versionName,
} from "./model-w7.ts";

const gate = (open: boolean, label: string, met = open): TrackState["gates"][number] => ({
  gateId: "J.main",
  trackId: "J",
  opens: "J1, J2.L01–L03, J3",
  requires: [{ ref: "U13.CP", kind: "checkpoint", label, met }],
  open,
  openedAt: open ? "2026-11-01T10:00:00.000Z" : null,
  lessonsAuthored: 5,
  lessonsTotal: 5,
});

const track = (over: Partial<TrackState> = {}): TrackState => ({
  trackId: "J",
  title: "Jazz Harmony",
  status: "open",
  openedAt: "2026-11-01T10:00:00.000Z",
  gates: [gate(true, "U13 checkpoint passed")],
  sessionsDone: 0,
  sessionsTotal: 34,
  next: "J1.L01",
  note: "Next: J1.L01 Swing Feel & the Ride.",
  nextSession: { kind: "lesson", mapItemId: "J1.L01", title: "Swing Feel & the Ride", estMinutes: 20 },
  ...over,
});

describe("track card", () => {
  test("open: something to start, nothing done", () => {
    const t = track();
    expect(trackCardState(t)).toBe("open");
    expect(trackCardLine(t)).toBe("Next: J1.L01 Swing Feel & the Ride · about 20 min");
    expect(trackProgressText(t)).toBeNull();
  });

  test("in progress names the next session, of any kind", () => {
    const cp = track({
      sessionsDone: 6,
      nextSession: { kind: "checkpoint", mapItemId: "J.CP1", title: "Jazz checkpoint 1", estMinutes: 25 },
    });
    expect(trackCardState(cp)).toBe("in-progress");
    expect(trackCardLine(cp)).toBe("Next: Checkpoint J.CP1 Jazz checkpoint 1 · about 25 min");
    expect(trackProgressText(cp)).toBe("6 of 34 sessions");
    const cap = track({
      sessionsDone: 7,
      nextSession: { kind: "capstone", mapItemId: "JC1.S1", title: "ii–V Ballad", estMinutes: 25 },
    });
    expect(trackCardLine(cap)).toContain("Capstone session JC1.S1");
  });

  test("waiting names the gate that holds it, never a count", () => {
    const locked = track({
      status: "locked",
      openedAt: null,
      gates: [gate(false, "U13 checkpoint passed")],
      next: null,
      nextSession: null,
      note: "Opens with the unit 13 checkpoint.",
    });
    expect(trackCardState(locked)).toBe("waiting");
    expect(trackWaitingFor(locked)).toBe("U13 checkpoint passed");
    // In words, never the gate's id (shared decision 5): the server's label leads with "U13".
    expect(trackCardLine(locked)).toBe("Waits for the unit 13 checkpoint.");
    // J2.L04 waits for U14.CP while the rest of the track goes on: a second gate, closed.
    const j2l04 = track({
      sessionsDone: 30,
      gates: [
        gate(true, "U13 checkpoint passed"),
        {
          ...gate(false, "U14 checkpoint passed"),
          gateId: "J.chord-scales",
          requires: [{ ref: "U14.CP", kind: "checkpoint", label: "U14 checkpoint passed", met: false }],
        },
      ],
      next: null,
      nextSession: null,
      note: "J2.L04 opens with the U14 checkpoint.",
    });
    expect(trackCardState(j2l04)).toBe("waiting");
    expect(trackCardLine(j2l04)).toBe("Waits for the unit 14 checkpoint.");
    expect(trackCardLine(j2l04)).not.toMatch(/\d+ (more|left|missing|remaining)/);
  });

  test("waiting with no closed gate keeps the server's note", () => {
    const t = track({
      next: null,
      nextSession: null,
      note: "Open. Its next lessons are still being written.",
    });
    expect(trackCardState(t)).toBe("waiting");
    expect(trackCardLine(t)).toBe("Its next lessons are still being written.");
  });

  test("complete", () => {
    const t = track({ sessionsDone: 34, next: null, nextSession: null });
    expect(trackCardState(t)).toBe("complete");
    expect(trackCardLine(t)).toBe("All 34 sessions done. Every lesson stays open to replay.");
    expect(trackProgressText(t)).toBe("34 of 34 sessions");
  });

  test("an older server without nextSession: the next lesson", () => {
    const t = track();
    delete (t as Partial<TrackState>).nextSession;
    expect(trackNext(t)).toEqual({ kind: "lesson", id: "J1.L01", title: null, minutes: null });
    expect(trackCardLine(t)).toBe("Next: J1.L01");
  });

  test("capstones and the summary", () => {
    const t = track({
      sessionsDone: 12,
      focus: true,
      capstones: [
        { capstoneId: "JC1", status: "released", lockedReason: null },
        { capstoneId: "JC2", status: "open", lockedReason: null },
        { capstoneId: "JC3", status: "locked", lockedReason: "Opens with J.CP2." },
        { capstoneId: "JC4", status: "locked", lockedReason: "Opens with J.CP2." },
      ],
    });
    expect(trackCapstonesText(t)).toBe("1 of 4 capstones released");
    expect(trackCardSummary("Jazz Harmony", t)).toBe(
      "Jazz Harmony: in progress, your focus. Next: J1.L01 Swing Feel & the Ride · about 20 min",
    );
  });
});

describe("version switch", () => {
  const opts = [
    { id: "a", letter: "A", label: "Swing", detail: "120 BPM" },
    { id: "b", letter: "B", label: "Funk" },
  ];
  test("names and cycles", () => {
    expect(versionName(opts[0] as (typeof opts)[number])).toBe("Version A: Swing (120 BPM)");
    expect(nextVersion(opts, "a")).toBe("b");
    expect(nextVersion(opts, "b")).toBe("a");
    expect(nextVersion(opts, "a", -1)).toBe("b");
    expect(nextVersion([], "a")).toBe("a");
  });
});

describe("export status", () => {
  test("each phase in words; a failure and a cancel say nothing was saved", () => {
    expect(exportStatusText({ phase: "idle" })).toBe("");
    expect(exportStatusText({ phase: "rendering", fraction: 0.416 })).toBe("Rendering… 42 %");
    expect(exportStatusText({ phase: "rendering", fraction: null })).toBe("Rendering…");
    expect(exportStatusText({ phase: "done", fileName: "Four-Chord Song.wav", bytes: 2_202_009 })).toBe(
      "Saved Four-Chord Song.wav (2.1 MB).",
    );
    expect(exportStatusText({ phase: "done", fileName: "a.wav", bytes: 30_000 })).toBe(
      "Saved a.wav (29 KB).",
    );
    expect(exportStatusText({ phase: "cancelled" })).toBe("Export cancelled. Nothing was saved.");
    expect(exportStatusText({ phase: "failed", message: "This piece uses a sound that is not loaded" })).toBe(
      "This piece uses a sound that is not loaded. Nothing was saved.",
    );
    expect(exportStatusText({ phase: "failed" })).toBe("The export failed. Nothing was saved.");
  });
});

describe("part levels", () => {
  test("a part more than 24 dB under the loudest is not heard", () => {
    const rows = levelRows([
      { id: "drums", label: "Drums", db: -6 },
      { id: "bass", label: "Bass", db: -12, target: { low: -14, high: -8 } },
      { id: "keys", label: "Keys", db: -6 - INAUDIBLE_BELOW_DB },
      { id: "pad", label: "Pad", db: -31 },
      { id: "vox", label: "Vox", db: Number.NEGATIVE_INFINITY },
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.drums?.heard).toBe(true);
    expect(by.drums?.sentence).toBe("−6.0 dB, the loudest part");
    expect(by.bass?.heard).toBe(true);
    expect(by.bass?.inTarget).toBe(true);
    expect(by.bass?.sentence).toBe("−12.0 dB, 6.0 dB under the loudest part");
    // Exactly 24 dB under still counts; more does not.
    expect(by.keys?.heard).toBe(true);
    expect(by.pad?.heard).toBe(false);
    expect(by.pad?.sentence).toBe("not heard: 25.0 dB under the loudest part");
    expect(by.vox?.heard).toBe(false);
    expect(by.vox?.text).toBe("silent");
    expect(by.vox?.fraction).toBe(0);
    expect(by.drums?.fraction).toBeCloseTo(0.9, 5);
  });
  test("nothing playing: nothing heard, no loudest part", () => {
    const rows = levelRows([{ id: "a", label: "A", db: null }]);
    expect(rows[0]?.heard).toBe(false);
    expect(rows[0]?.under).toBeNull();
  });
});

describe("Euclid ring", () => {
  test("the grid is Strudel's: tresillo and the bossa rim", () => {
    expect(euclidGrid({ pulses: 3, steps: 8, rotation: 0 })).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
    ]);
    // (5,16,10) is the bossa nova rim, 3+3+4+3+3 (content/specs/R3).
    const rim = euclidGrid({ pulses: 5, steps: 16, rotation: 10 });
    const on = rim.flatMap((h, i) => (h ? [i] : []));
    const gaps = on.map((s, i) => ((on[(i + 1) % on.length] as number) - s + 16) % 16);
    expect(gaps.slice().sort()).toEqual([3, 3, 3, 3, 4]);
    expect(euclidGrid({ pulses: 9, steps: 8, rotation: 0 }).some(Boolean)).toBe(false);
  });
  test("words and code", () => {
    expect(euclidText({ pulses: 5, steps: 16, rotation: 10 })).toBe("5 hits in 16 steps, rotated by 10");
    expect(euclidText({ pulses: 1, steps: 4, rotation: 0 })).toBe("1 hit in 4 steps");
    expect(euclidCode({ pulses: 3, steps: 8, rotation: 0 })).toBe("(3,8)");
    expect(euclidCode({ pulses: 5, steps: 8, rotation: 1 })).toBe("(5,8,1)");
  });
  test("geometry: step 0 at the top, clockwise", () => {
    const top = ringPoint(0, 8, 10);
    expect(top.x).toBeCloseTo(0, 6);
    expect(top.y).toBeCloseTo(-10, 6);
    const right = ringPoint(2, 8, 10);
    expect(right.x).toBeCloseTo(10, 6);
    expect(right.y).toBeCloseTo(0, 6);
  });
  test("keys", () => {
    const v = { pulses: 3, steps: 8, rotation: 0 };
    expect(euclidKeyValue({ key: "ArrowUp" }, v)).toEqual({ ...v, pulses: 4 });
    expect(euclidKeyValue({ key: "ArrowDown" }, { ...v, pulses: 0 })).toBeNull();
    expect(euclidKeyValue({ key: "ArrowUp" }, { ...v, pulses: 8 })).toBeNull();
    expect(euclidKeyValue({ key: "ArrowLeft" }, v)).toEqual({ ...v, rotation: 7 });
    expect(euclidKeyValue({ key: "ArrowRight" }, { ...v, rotation: 7 })).toEqual({ ...v, rotation: 0 });
    expect(euclidKeyValue({ key: "Home" }, { ...v, rotation: 3 })).toEqual(v);
    expect(euclidKeyValue({ key: "Home" }, v)).toBeNull();
    expect(
      euclidKeyValue({ key: "ArrowDown", shiftKey: true }, { pulses: 5, steps: 5, rotation: 4 }),
    ).toEqual({
      pulses: 4,
      steps: 4,
      rotation: 0,
    });
    expect(euclidKeyValue({ key: "ArrowUp", shiftKey: true }, { ...v, steps: 16 })).toBeNull();
    expect(euclidKeyValue({ key: "x" }, v)).toBeNull();
  });
});

describe("two-lane tap pad", () => {
  test("F and J tap the lanes", () => {
    expect(laneOfKey("f")).toBe(0);
    expect(laneOfKey("F")).toBe(0);
    expect(laneOfKey("j")).toBe(1);
    expect(laneOfKey(" ")).toBeNull();
    expect(tapCountText(0)).toBe("No taps yet");
    expect(tapCountText(1)).toBe("1 tap");
    expect(tapCountText(6)).toBe("6 taps");
  });
});
