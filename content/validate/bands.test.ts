// Band layers and flavour kits (contracts §5.10): every (band, flavour) pair evaluates in the key it is
// given, carries exactly the roles it declares, passes the strict lint as a preview context (locked tools
// allowed, dialect enforced), and plays the harmony it says. Kits sit in the production ranges.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { midisOf } from "@oak/grader/testing";
import { METERS } from "@oak/theory";
import { bandMeter, bands } from "../bands/index.ts";
import { FLAVOUR_RULES, flavours, PRODUCTION_RANGES } from "../flavours.ts";
import { BAD_LOG, evaluate, lint } from "./harness.ts";

setDefaultTimeout(60_000);
const fill = (code: string, key = "C4:major", beats = 4) =>
  `setcpm(96/${beats})\n\n${code.replaceAll("{{key}}", key).replaceAll("{{bpm}}", "96")}`;
/**
 * The divisor of a Band's tempo line (contracts §6.9): the meter's tempo units in a bar — beats, dotted quarters in
 * a compound meter (6/8 → 2), eighths in an odd /8 meter (7/8 → 7, `setcpm(bpm/7)`).
 */
const beatsOf = (id: string) => METERS[bandMeter(id) as keyof typeof METERS].unitsPerBar;
/** The 0-based bar of an event's begin ("a/b" or a whole number). */
const barOf = (begin: string | number): number => {
  const [a, b] = String(begin).split("/").map(Number);
  return Math.floor(b ? (a as number) / b : (a as number));
};

describe("bands", () => {
  for (const b of bands)
    for (const [flavour, code] of Object.entries(b.code))
      test(`${b.id} × ${flavour}`, async () => {
        for (const key of ["C4:major", "G4:major", "Eb4:major"]) {
          const r = await evaluate(fill(code, key, beatsOf(b.id)), b.bars);
          expect([key, r.ok, r.error ?? ""]).toEqual([key, true, ""]);
          expect(r.logs.filter((l) => BAD_LOG.test(l))).toEqual([]);
          expect([...r.tracks].sort()).toEqual([...b.roles].sort());
          for (const role of b.roles)
            expect([role, r.events.some((e) => e.track === role)]).toEqual([role, true]);
        }
        const res = lint(fill(code, "C4:major", beatsOf(b.id)), {
          session: "U01.L01",
          meter: bandMeter(b.id),
          allowPreview: true,
          profile: "band",
        });
        expect(
          res.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.id} ${d.message}`),
        ).toEqual([]);
      });
  for (const f of flavours)
    test(`every band has a ${f.id} version`, () => {
      for (const b of bands) expect(Object.keys(b.code)).toContain(f.id);
    });
});

describe("harmony (music facts, checked against Strudel)", () => {
  test("the four-chord band plays I–V–vi–IV with roots C2 G2 A2 F2 in C", async () => {
    const code = (bands.find((b) => b.id === "band.axis-4bar")?.code["flavour.pop"] ?? "")
      .split("\n")
      .find((l) => l.startsWith("bass:")) as string;
    expect(await midisOf(fill(code), 4)).toEqual([36, 43, 45, 41]);
  });
  test("its chords are C–E–G, G–B–D, A–C–E, F–A–C", async () => {
    const line = (bands.find((b) => b.id === "band.axis-4bar")?.code["flavour.pop"] ?? "")
      .split("\n")
      .find((l) => l.startsWith("chords:")) as string;
    const r = await evaluate(fill(line.replace(/\.struct\("[^"]*"\)/, "")), 4);
    const byBar = [0, 1, 2, 3].map((b) =>
      r.events.filter((e) => Math.floor(e.onset) === b).map((e) => e.midi),
    );
    expect(byBar).toEqual([
      [48, 52, 55],
      [55, 59, 62],
      [57, 60, 64],
      [53, 57, 60],
    ]);
  });
  test("the jazz-soul version stacks sevenths: Cmaj7 is C E G B", async () => {
    const line = (bands.find((b) => b.id === "band.axis-4bar")?.code["flavour.jazz-soul"] ?? "")
      .split("\n")
      .find((l) => l.startsWith("chords:")) as string;
    const r = await evaluate(
      fill(line.replace(/\.struct\("[^"]*"\)/, "").replace(/\.swingBy\([^)]*\)/, "")),
      1,
    );
    expect(r.events.map((e) => e.midi)).toEqual([48, 52, 55, 59]);
  });
  test("the waltz band: bass on beat 1, chords on beats 2 and 3, I then IV", async () => {
    const code = bands.find((b) => b.id === "band.waltz-vamp")?.code["flavour.pop"] ?? "";
    const r = await evaluate(fill(code, "C4:major", 3), 2);
    const on = (track: string) =>
      r.events.filter((e) => e.track === track).map((e) => [Number(e.onset.toFixed(3)), e.midi]);
    expect(on("bass")).toEqual([
      [0, 36],
      [1, 41],
    ]);
    const chordOnsets = [...new Set(on("chords").map(([t]) => t))];
    expect(chordOnsets).toEqual([0.333, 0.667, 1.333, 1.667]);
    expect(
      on("chords")
        .filter(([t]) => t === 1.333)
        .map(([, m]) => m),
    ).toEqual([53, 57, 60]);
  });
  // U01.L08 tells the learner the waltz band "leans on 1 with its bass and answers on 2 and 3 with its
  // chords". In every flavour the bass plays on beat 1 and no chord does (the indie chords once hit all three).
  test("the waltz band in every flavour: bass on 1, chords never on 1", async () => {
    const b = bands.find((x) => x.id === "band.waltz-vamp");
    for (const [flavour, code] of Object.entries(b?.code ?? {})) {
      const r = await evaluate(fill(code, "C4:major", 3), 2);
      const onsets = (track: string) =>
        r.events.filter((e) => e.track === track).map((e) => Number((e.onset % 1).toFixed(3)));
      expect({ flavour, bassOnOne: onsets("bass").includes(0) }).toEqual({ flavour, bassOnOne: true });
      expect({ flavour, chordsOnOne: onsets("chords").includes(0) }).toEqual({ flavour, chordsOnOne: false });
    }
  });
  test("the eight-bar phrase: roots I IV I V I IV V I, the half close on V in bar 4, home in bar 8", async () => {
    const pop = bands.find((b) => b.id === "band.phrase-8bar")?.code["flavour.pop"] ?? "";
    const bass = pop.split("\n").find((l) => l.startsWith("bass:")) as string;
    expect(await midisOf(fill(bass), 8)).toEqual([36, 41, 36, 43, 36, 41, 43, 36]);
    const chords = pop.split("\n").find((l) => l.startsWith("chords:")) as string;
    const r = await evaluate(fill(chords), 8);
    const bar = (i: number) =>
      [...new Set(r.events.filter((e) => barOf(e.begin) === i).map((e) => e.midi))].sort();
    // C E G · C F A · B D G · C E G: each chord change moves a voice by a step at most.
    expect([bar(0), bar(1), bar(3), bar(6), bar(7)]).toEqual([
      [48, 52, 55],
      [48, 53, 57],
      [47, 50, 55],
      [47, 50, 55],
      [48, 52, 55],
    ]);
    const jazz = (bands.find((b) => b.id === "band.phrase-8bar")?.code["flavour.jazz-soul"] ?? "")
      .split("\n")
      .find((l) => l.startsWith("chords:")) as string;
    const j = await evaluate(fill(jazz), 8);
    const v7 = [...new Set(j.events.filter((e) => barOf(e.begin) === 3).map((e) => e.midi))];
    // G7 as B D F G.
    expect(v7.sort()).toEqual([47, 50, 53, 55]);
  });
  test("the band follows the key: in G the vamp is G and C", async () => {
    const line = (bands.find((b) => b.id === "band.two-chord-vamp")?.code["flavour.pop"] ?? "")
      .split("\n")
      .find((l) => l.startsWith("bass:")) as string;
    expect(await midisOf(fill(line, "G4:major"), 2)).toEqual([43, 48]);
  });
});

describe("flavour kits", () => {
  test("production defaults sit in the ranges of §5.10", () => {
    for (const f of flavours) {
      expect(f.production.room).toBeGreaterThanOrEqual(PRODUCTION_RANGES.room[0]);
      expect(f.production.room).toBeLessThanOrEqual(PRODUCTION_RANGES.room[1]);
      expect(f.production.bassLpf).toBeGreaterThanOrEqual(PRODUCTION_RANGES.bassLpf[0]);
      expect(f.production.bassLpf).toBeLessThanOrEqual(PRODUCTION_RANGES.bassLpf[1]);
      expect(f.production.humanizeVelocity).toBe(PRODUCTION_RANGES.humanizeVelocity);
      expect(f.production.pan.bass).toBe(0.5);
    }
  });
  test("the table of §5.10", () => {
    const row = (id: string) => flavours.find((f) => f.id === id);
    expect(row("flavour.jazz-soul")).toMatchObject({
      drums: "snd.jazzkit",
      bass: "snd.upright",
      chords: "snd.rhodes",
      lead: "snd.vibes",
      chordDepth: "seventh",
      swing: { subdivision: 8, amount: 1 / 3 },
    });
    expect(row("flavour.indie")).toMatchObject({
      drums: "snd.bank.LinnDrum",
      bass: "snd.ebass",
      chords: "snd.cleangtr",
      lead: "snd.acgtr",
      chordDepth: "triad",
    });
    expect(row("flavour.funk")).toMatchObject({
      drums: "snd.bank.RolandTR808",
      bass: "snd.fingerbass",
      chords: "snd.clav",
      lead: "snd.organ",
      chordDepth: "seventh",
    });
    expect(row("flavour.pop")).toMatchObject({
      bass: "snd.ebass",
      chords: "snd.piano",
      lead: "snd.piano",
      chordDepth: "triad",
    });
    expect(row("flavour.electronic")).toMatchObject({
      drums: "snd.oak909",
      bass: "snd.wave.sawtooth",
      chords: "snd.wave.sawtooth",
      lead: "snd.wave.square",
      chordDepth: "seventh",
    });
    expect(row("flavour.electronic")?.swing).toBeUndefined();
    expect(FLAVOUR_RULES["flavour.jazz-soul"].seventhsFrom).toBe("U03.L01");
    expect(FLAVOUR_RULES["flavour.funk"].seventhsFrom).toBe("U06.L01");
    expect(FLAVOUR_RULES["flavour.electronic"]).toEqual({
      ships: "S1",
      seventhsFrom: "U06.L10",
      feel: "straight",
    });
  });
});
