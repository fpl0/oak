// review:teaching-rest (Wave 7): the rhythm track's musical claims and Bands, re-derived by running them. Each test
// pins a defect the review found and fixed, or a reading the review made as the second reader:
// - the Bands under the rhythm track play straight: a son clave, a tresillo, a Euclidean bell and sixteenth ghost
//   notes are straight figures, and band.two-chord-vamp's jazz-soul flavour swings its ride and comping
//   (`.swingBy(1/3, 4)`), so R3.L01–L03's Makes and R.CP's Make moved to band.son-montuno;
// - R2.L02: the compound nine's tempo line at the lesson's speed (`setcpm(80/3)`) is the same bar as `setcpm(240/9)`;
// - R2.L05: a cycle in curly brackets drifts exactly when it neither fits a whole number of times into the bar nor
//   fills a whole number of bars, which is what the lesson now says (it said "does not divide", true of 8 at %4);
// - St. Louis Blues, the first strain: the second reader's pitches, attacks and chart (carry f8).
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { flattenExercise, type LessonDef } from "@oak/content-kit";
import { bandCodeAt, bandMeter } from "../../bands/index.ts";
import { CHECKPOINT_MAKE_BANDS } from "../../checkpoints.ts";
import { loadLessons } from "../../lib/load.bun.ts";
import slb from "../../repertoire/st-louis-blues/song.ts";
import { evaluate } from "../../validate/harness.ts";

setDefaultTimeout(120_000);

const { lessons } = await loadLessons();
const lesson = (id: string): LessonDef => {
  const l = lessons.find((x) => x.def.id === id);
  if (!l) throw new Error(`no ${id}`);
  return l.def;
};
const mdx = (id: string) => lessons.find((x) => x.def.id === id)?.mdxSource ?? "";
const FLAVOURS = [
  "flavour.pop",
  "flavour.jazz-soul",
  "flavour.indie",
  "flavour.funk",
  "flavour.electronic",
] as const;
const frac = (s: string) => {
  const [n, d] = s.split("/").map(Number);
  return d ? (n as number) / d : (n as number);
};

/** Every onset of the Band's chosen tracks over two bars that is off the meter's straight sixteenth grid. */
async function swungOnsets(
  band: string,
  tracks: readonly string[] | undefined,
  key: string,
): Promise<string[]> {
  const out: string[] = [];
  const meter = bandMeter(band);
  // A sixteenth of a bar of four quarters is 1/16; of six eighths (6/8) 1/12; of five quarters (5/4) 1/20.
  const steps = meter === "6/8" ? 12 : meter === "5/4" ? 20 : 16;
  for (const f of FLAVOURS) {
    // Every learner of the track is past U13.CP, so every Band stage of the core has been reached.
    const code = bandCodeAt(band, f, () => true).replaceAll("{{key}}", key);
    const r = await evaluate(`setcpm(100/4)\n${code}`, 2);
    if (!r.ok) throw new Error(`${band} ${f}: ${r.error}`);
    for (const e of r.events) {
      if (tracks && !tracks.includes(e.track)) continue;
      const x = frac(e.begin) * steps;
      if (Math.abs(x - Math.round(x)) > 1e-6) out.push(`${f} ${e.track}@${e.begin}`);
    }
  }
  return [...new Set(out)];
}

describe("the rhythm track's Bands play straight", () => {
  const steps = lessons
    .filter((l) => /^R[123]\./.test(l.def.id))
    .flatMap((l) =>
      l.def.steps.flatMap((s) =>
        s.ui?.band && typeof s.ui.band === "object"
          ? [{ id: `${l.def.id} ${s.id}`, def: l.def, band: s.ui.band }]
          : [],
      ),
    );
  test("there are Bands to check (R1–R3 Makes)", () => {
    expect(steps.length).toBeGreaterThanOrEqual(8);
  });
  for (const s of steps)
    test(`${s.id}: ${s.band.band} ${JSON.stringify(s.band.tracks ?? "all")}, in every flavour`, async () => {
      const key = `${s.def.key.tonic}3:${s.def.key.mode === "minor" ? "minor" : "major"}`;
      expect(await swungOnsets(s.band.band, s.band.tracks, key)).toEqual([]);
    });
  test("R.CP's Make: the son groove's off-beat chords, straight in every flavour", async () => {
    const ref = CHECKPOINT_MAKE_BANDS["R.CP"];
    expect(ref?.band).toBe("band.son-montuno");
    expect(await swungOnsets(ref?.band ?? "", ref?.tracks, "C3:major")).toEqual([]);
  });
  test("the regression the move fixed: the two-chord vamp swings in jazz-soul", async () => {
    expect(
      (await swungOnsets("band.two-chord-vamp", ["drums", "chords"], "C3:major")).length,
    ).toBeGreaterThan(0);
  });
  test("R3.L01–L03 Makes name the son groove's chords, C then G7, and their pieces play G under G7", () => {
    for (const id of ["R3.L01", "R3.L02", "R3.L03"]) {
      const make = lesson(id).steps.find((s) => s.kind === "make");
      const ex = make?.exercise ? flattenExercise(make.exercise)[0] : undefined;
      expect([id, ex?.prompt.includes("C then G7")]).toEqual([id, true]);
      expect([id, ex?.prompt.includes("C then F")]).toEqual([id, false]);
    }
  });
});

describe("tempo lines and drift, as the lessons state them", () => {
  test("R2.L02: the compound nine at this speed, setcpm(80/3), lasts as long as setcpm(240/9)", async () => {
    const a = await evaluate('setcpm(80/3)\ns("bd")', 1);
    const b = await evaluate('setcpm(240/9)\ns("bd")', 1);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.cps).toBeCloseTo(b.cps, 12);
    expect(mdx("R2.L02")).toContain("`setcpm(80/3)`");
    expect(mdx("R2.L02")).not.toContain("setcpm(60/3)");
  });

  /** The bar-1 positions of each bar, in quarters, of `{bd ~ …}%4` with a cycle of `n` steps, over 24 bars. */
  async function barShapes(n: number): Promise<string[]> {
    const cycle = ["bd", ...Array.from({ length: n - 1 }, () => "~")].join(" ");
    const r = await evaluate(`setcpm(100/4)\nkick: s("{${cycle}}%4")`, 24);
    if (!r.ok) throw new Error(r.error);
    const bars: number[][] = Array.from({ length: 24 }, () => []);
    for (const e of r.events) {
      const t = frac(e.begin);
      bars[Math.floor(t)]?.push(Math.round((t % 1) * 4));
    }
    return bars.map((b) => b.join(","));
  }
  test("R2.L05: a cycle drifts exactly when it neither fits the bar a whole number of times nor fills whole bars", async () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8, 12]) {
      const shapes = await barShapes(n);
      // Drifting: the kick lands somewhere new in some bar, and the cycle crosses the bar line (it is not a figure
      // of whole bars, which would repeat bar for bar inside its own length).
      const crosses = shapes.some((s) => s !== shapes[0]) && n % 4 !== 0;
      const rule = 4 % n !== 0 && n % 4 !== 0;
      expect([n, crosses]).toEqual([n, rule]);
    }
    const said = [mdx("R2.L05"), JSON.stringify(lesson("R2.L05"))].join(" ");
    expect(said).toContain(
      "neither fits a whole number of times into the bar nor fills a whole number of bars",
    );
    expect(said).not.toContain("a cycle the bar does not divide");
    expect(said).not.toContain("does not divide into the steps played in a bar");
  });
});

describe("St. Louis Blues, the first strain: the second reader (carry f8)", () => {
  // Read independently from the strain as sung (one note a syllable: "I hate to see de ev'nin' sun go down" twice,
  // then "'Cause my baby, he done lef' dis town") and the common chart of the tune, without Oak's notes: pitch
  // names per bar in order. Bar 9 attacks its D once (four syllables), bar 10 holds the blue third over D7.
  const READING = [
    ["B", "D", "B", "G"],
    ["D#", "E", "G", "Bb", "A"],
    ["G"],
    [],
    ["E", "G", "A"],
    ["E", "G", "A", "Bb", "A"],
    ["G"],
    [],
    ["F#", "A", "F#", "D"],
    ["Bb", "Bb", "Bb", "A"],
    ["G"],
    [],
  ];
  const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
  const enh: Record<string, string> = { "D#": "Eb" };
  test("the answer key's melody: the same pitches and the same number of attacks in every bar", async () => {
    const r = await evaluate(`setcpm(126/4)\nmel: ${slb.answerKey.layers.melody}`, 12);
    if (!r.ok) throw new Error(r.error);
    const bars: string[][] = Array.from({ length: 12 }, () => []);
    for (const e of r.events) bars[Math.floor(frac(e.begin))]?.push(NAMES[(e.midi as number) % 12] as string);
    expect(bars).toEqual(READING.map((b) => b.map((x) => enh[x] ?? x)));
  });
  test("the chart: G C7 G G7 | C C7 G G | D7 D7 G G, one chord a bar", () => {
    expect((slb.answerKey.chords ?? []).map((c) => c.symbol)).toEqual([
      "G",
      "C7",
      "G",
      "G7",
      "C",
      "C7",
      "G",
      "G",
      "D7",
      "D7",
      "G",
      "G",
    ]);
  });
});
