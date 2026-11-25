import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type { FamilyDef, KeySpec } from "@oak/content-kit";
import { lintOak } from "@oak/grader";
import { evalHeadless, type HeadlessEvent } from "@oak/grader/testing";
import { courseGraph } from "../../../content/index.ts";
import { unlockedAt } from "../../../content/lib/course.ts";
import { toolbox } from "../../../content/toolbox.ts";
import { FAMILIES } from "./catalog/families.ts";
import { bindFamily, DEFAULT_PROFILE, maxOpenLevel, planSet } from "./engine.ts";
import { transformRhythmOk } from "./gen/code.ts";
import { MOTION_LABELS, type Motion, motionChecks, nearestMotionChord } from "./gen/motion.ts";
import { frontChecks, ROLE_LABELS } from "./gen/sound.ts";
import { stepToMidi } from "./kernel.ts";
import { EARLY_ORDER, LATE_ORDER } from "./legal-orders.test-util.ts";
import { createRng } from "./rng.ts";
import { flattenEvents, strudelEvents } from "./testing.test-util.ts";

const SEEDS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
  29,
];
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("missing test fixture value");
  return value;
}
const fam = (id: string) => FAMILIES.find((f) => f.id === id) as FamilyDef;
function trial(id: string, level: number, category: string, seed: number) {
  const def = fam(id);
  return bindFamily(def).generate(createRng(seed), required(def.levels[level - 1]), level, DEFAULT_PROFILE, {
    category,
    openCategories: def.categories.map((c) => c.id),
  });
}
const signature = (events: readonly HeadlessEvent[]) =>
  events.map((e) => `${e.begin}|${e.end}|${e.midi}`).sort();
const duration = (e: HeadlessEvent) => {
  const [n, d = 1] = e.end.split("/").map(Number);
  return (n as number) / d - e.onset;
};
const asFront = (events: readonly HeadlessEvent[]) =>
  events.map((e) => ({
    track: e.track,
    t: e.onset,
    dur: duration(e),
    midi: e.midi as number,
    gain: e.value.gain as number,
  }));
const chordsOf = (events: readonly HeadlessEvent[]) =>
  Array.from({ length: 4 }, (_, b) =>
    events
      .filter((e) => e.track === "chords" && e.onset === b)
      .map((e) => e.midi as number)
      .sort((a, b) => a - b),
  );
const chordCode = (chords: readonly (readonly number[])[]) =>
  `setcpm(90/4)\nchords: note("<${chords.map((c) => `[${c.join(",")}]`).join(" ")}>").s("piano").gain(.65)`;
const candidateCode = (candidate: string) => `setcpm(90/4)\nmel: ${candidate}.s("piano").gain(.55)`;
const lint = (code: string, key: KeySpec | null = null) =>
  lintOak(
    code,
    {
      profile: "content",
      unlocked: unlockedAt(courseGraph(), toolbox, "U07.L11"),
      allowPreview: false,
      meter: "4/4",
      key,
    },
    toolbox,
  );

async function played(id: string, level: number, category: string, seed: number) {
  const t = trial(id, level, category, seed);
  expect(trial(id, level, category, seed)).toEqual(t);
  const result = await evalHeadless(t.code, Number(t.params.bars));
  expect(result.cpsSet).toBe(true);
  expect(result.cps).toBeGreaterThan(0);
  expect(result.logs).toEqual([]);
  expect(result.events.length).toBeGreaterThan(0);
  expect(result.events.every((e) => e.s && e.midi !== null && Number(e.value.gain) > 0)).toBe(true);
  expect((await strudelEvents(t.code, Number(t.params.bars))).flat).toEqual(flattenEvents(t.events));
  return { t, events: result.events };
}

describe("Oak 2.0 W2: harmony motion", () => {
  for (const level of [1, 2])
    for (const category of required(fam("fam.har.motion").levels[level - 1]).categories) {
      test(`30 real Strudel trials: level ${level} ${category}`, async () => {
        const seen = new Set<string>();
        for (const seed of SEEDS) {
          const { t, events } = await played("fam.har.motion", level, category, seed);
          const chords = chordsOf(events);
          const roots = t.params.roots as number[];
          const shape = t.params.shape as number[];
          const answer = t.params.motion as Motion;
          seen.add(answer);
          const checks = motionChecks(chords, roots);
          expect(checks[answer]).toBe(true);
          expect(Object.values(checks).filter(Boolean)).toHaveLength(1);
          expect(t.expected.choice).toEqual([MOTION_LABELS[answer]]);
          expect(t.params.options).toEqual(Object.values(MOTION_LABELS));
          for (let b = 0; b < 4; b++) {
            expect(
              required(chords[b])
                .map((n) => (((n - required(roots[b])) % 12) + 12) % 12)
                .sort((a, b) => a - b),
            ).toEqual(shape);
            if (b === 0) continue;
            const distance = Math.abs(required(roots[b]) - required(roots[b - 1]));
            expect(distance).toBeGreaterThanOrEqual(category === "parallel-step" ? 1 : 3);
            expect(distance).toBeLessThanOrEqual(category === "parallel-step" ? 2 : 7);
            if (answer === "voice-led") {
              const moves = required(chords[b]).map((n, v) => n - required(required(chords[b - 1])[v]));
              expect(new Set(moves).size).toBeGreaterThan(1);
              expect(chords[b]).toEqual(
                nearestMotionChord(required(chords[b - 1]), required(roots[b]), shape),
              );
            }
          }
        }
        expect([...seen].sort()).toEqual(["parallel", "voice-led"]);
      });
    }
  test("reject a voice-led item with exactly one block move, after real evaluation", async () => {
    const result = await evalHeadless(
      chordCode([
        [48, 52, 55],
        [49, 53, 56],
        [46, 51, 55],
        [45, 48, 53],
      ]),
      4,
    );
    expect(result.cpsSet).toBe(true);
    expect(result.events).toHaveLength(12);
    const chords = chordsOf(result.events);
    const moves = chords
      .slice(1)
      .map((chord, i) => chord.map((n, v) => n - required(required(chords[i])[v])));
    expect(moves.filter((change) => new Set(change).size === 1)).toHaveLength(1);
    for (const change of moves) expect(Math.abs(required(change.at(-1)))).toBeLessThanOrEqual(2);
    const shapes = chords.map((chord) =>
      chord
        .slice(1)
        .map((n, i) => n - required(chord[i]))
        .join(","),
    );
    expect(new Set(shapes).size).toBeGreaterThan(1);
    expect(motionChecks(chords, [48, 49, 51, 53])["voice-led"]).toBe(false);
  });
  test("reject a re-voiced parallel chord and a five-half-step top jump, after real evaluation", async () => {
    const parallel = [
      [48, 52, 55],
      [50, 54, 57],
      [52, 56, 59],
      [50, 54, 57],
    ];
    parallel[1] = [54, 57, 62];
    const badParallel = await evalHeadless(chordCode(parallel), 4);
    expect(badParallel.events).toHaveLength(12);
    expect(motionChecks(chordsOf(badParallel.events), [48, 50, 52, 50]).parallel).toBe(false);
    const jumping = [
      [48, 52, 55],
      [50, 54, 60],
      [48, 53, 57],
      [47, 50, 55],
    ];
    const badVoiceLed = await evalHeadless(chordCode(jumping), 4);
    expect(
      required(required(chordsOf(badVoiceLed.events)[1]).at(-1)) -
        required(required(chordsOf(badVoiceLed.events)[0]).at(-1)),
    ).toBe(5);
    expect(motionChecks(chordsOf(badVoiceLed.events), [48, 50, 53, 55])["voice-led"]).toBe(false);
  });
});

describe("Oak 2.0 W2: motif transforms", () => {
  for (const category of ["inversion", "rotation", "time-shift"])
    test(`${category}: 30 seeds, every candidate plays and lints`, async () => {
      for (const seed of SEEDS) {
        const { t, events } = await played("fam.code.functions", 4, category, seed);
        const options = t.params.options as string[];
        expect(options).toHaveLength(3);
        const plain = options.filter((option) => /^n\("[^"]+"\)\.scale\("[^"]+"\)$/.test(option));
        expect(plain).toContain(required(t.expected.choice?.[0]));
        expect(plain.length).toBeGreaterThanOrEqual(2);
        const motif = await evalHeadless(candidateCode(t.params.motif as string), 2);
        expect(transformRhythmOk(motif.events.map((e) => ({ t: e.onset, dur: duration(e) })))).toBe(true);
        const sigs = [];
        for (const option of options) {
          const code = candidateCode(option);
          const checked = lint(code, t.params.key as KeySpec);
          expect(checked.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
          expect(checked.ok).toBe(true);
          expect(/\.(early|late|off|superimpose)\(/.test(code)).toBe(false);
          const res = await evalHeadless(code, 2);
          expect(res.cpsSet).toBe(true);
          expect(res.events.length).toBeGreaterThan(0);
          expect(res.logs).toEqual([]);
          if (category === "inversion" && plain.includes(option) && option !== t.expected.choice?.[0]) {
            const degreesOf = (code: string) =>
              required(
                required(required(code.match(/n\("([^"]+)"\)/))[1])
                  .replace(/@\d+/g, "")
                  .match(/-?\d+/g),
              ).map(Number);
            const original = degreesOf(t.params.motif as string);
            const transposed = degreesOf(option);
            const shifts = transposed.map((n, i) => n - required(original[i]));
            expect(new Set(shifts).size).toBe(1);
            expect([1, 2]).toContain(required(shifts[0]));
            const octave = Number(required(option.match(/(\d):major/))[1]);
            expect(res.events.filter((e) => e.onset < 1).map((e) => e.midi)).toEqual(
              transposed.map((degree) => stepToMidi(degree, t.params.key as KeySpec, octave)),
            );
            expect(res.events.map((e) => [e.begin, e.end])).toEqual(
              motif.events.map((e) => [e.begin, e.end]),
            );
          }
          const sig = signature(res.events);
          sigs.push(JSON.stringify(sig));
          expect(JSON.stringify(sig) === JSON.stringify(signature(events))).toBe(
            option === t.expected.choice?.[0],
          );
        }
        expect(new Set(sigs).size).toBe(3);
        // Verify the defining operation on the real events, including lengths and rests.
        const source = motif.events.filter((e) => e.onset < 1);
        const target = events.filter((e) => e.onset < 1);
        if (category === "rotation") {
          expect(target.map((e) => e.midi)).toEqual([
            required(source[2]).midi,
            required(source[0]).midi,
            required(source[1]).midi,
          ]);
          expect(target.map((e) => [e.onset, duration(e)])).toEqual(
            source.map((e) => [e.onset, duration(e)]),
          );
        } else if (category === "time-shift") {
          expect(target.map((e) => e.midi)).toEqual(source.map((e) => e.midi));
          target.forEach((e, i) => {
            expect(e.onset).toBeCloseTo((required(source[i]).onset + 1 / 6) % 1);
            expect(duration(e)).toBeCloseTo(duration(required(source[i])));
          });
        } else {
          const mini = required(required((t.params.motif as string).match(/n\("([^"]+)"\)/))[1]);
          const degrees = required(mini.replace(/@\d+/g, "").match(/-?\d+/g)).map(Number);
          const centreTwice = Math.min(...degrees) + Math.max(...degrees);
          const octave = Number(required((t.params.motif as string).match(/(\d):major/))[1]);
          expect(target.map((e) => e.midi)).toEqual(
            degrees.map((d) => stepToMidi(centreTwice - d, t.params.key as KeySpec, octave)),
          );
          const contour = (es: readonly HeadlessEvent[]) =>
            es.slice(1).map((e, i) => Math.sign(required(e.midi) - required(required(es[i]).midi)));
          expect(contour(target)).toEqual(contour(source).map((d) => -d));
          expect(target.map((e) => [e.onset, duration(e)])).toEqual(
            source.map((e) => [e.onset, duration(e)]),
          );
        }
      }
    });
  test("an even rotation is also a time shift and must be rejected; early plays but is locked", async () => {
    const even = await evalHeadless(candidateCode('n("0 2 4").scale("C4:major")'), 2);
    const rotation = await evalHeadless(candidateCode('n("4 0 2").scale("C4:major")'), 2);
    const moved = await evalHeadless(candidateCode('n("0 2 4").scale("C4:major").late(1/3)'), 2);
    expect(signature(rotation.events)).toEqual(signature(moved.events));
    expect(transformRhythmOk(even.events.map((e) => ({ t: e.onset, dur: duration(e) })))).toBe(false);
    const locked = candidateCode('n("0@2 2 ~ 4 ~").scale("C4:major").early(1/6)');
    expect((await evalHeadless(locked, 2)).events.length).toBeGreaterThan(0);
    expect(lint(locked).ok).toBe(false);
    expect(lint(locked).lockedTools).toContain("tb.early");
  });
});

describe("Oak 2.0 W2: front part", () => {
  test("30 real trials: unique changing part, equal gains, register and rate are not answers", async () => {
    let isHighest = 0;
    let isBusiest = 0;
    let notHighest = 0;
    let notBusiest = 0;
    const seen = new Set<string>();
    const registers = new Set<string>();
    const rates = new Set<string>();
    for (const seed of SEEDS) {
      const { t, events } = await played("fam.snd.roles", 3, "front", seed);
      const front = t.params.front as keyof typeof ROLE_LABELS;
      seen.add(front);
      const checks = frontChecks(asFront(events));
      expect(checks[front]).toBe(true);
      expect(Object.values(checks).filter(Boolean)).toHaveLength(1);
      expect(t.expected.choice).toEqual([front]);
      expect(t.params.options).toEqual(Object.keys(ROLE_LABELS));
      expect(t.params.optionLabels).toEqual(ROLE_LABELS);
      expect(new Set(events.map((e) => e.value.gain))).toEqual(new Set([0.55]));
      const tracks = ["bass", "pad", "mel"];
      const track = front === "lead" ? "mel" : front;
      const highest = tracks.map((name) =>
        Math.max(...events.filter((e) => e.track === name).map((e) => required(e.midi))),
      );
      const counts = tracks.map((name) => events.filter((e) => e.track === name).length / 4);
      // Count a held chord as one attack; retain the original notes-per-bar comparison too.
      const attacks = tracks.map(
        (name) => new Set(events.filter((e) => e.track === name).map((e) => e.begin)).size / 4,
      );
      expect(counts.map((n) => n === Math.max(...counts))).toEqual(
        attacks.map((n) => n === Math.max(...attacks)),
      );
      expect(attacks[1]).toBe(1);
      expect(events.filter((e) => e.track === "pad").every((e) => duration(e) === 1)).toBe(true);
      registers.add(highest.join(","));
      rates.add(counts.join(","));
      if (required(highest[tracks.indexOf(track)]) < Math.max(...highest)) notHighest++;
      else isHighest++;
      if (required(counts[tracks.indexOf(track)]) < Math.max(...counts)) notBusiest++;
      else isBusiest++;
      for (const name of tracks)
        for (let bar = 0; bar < 4; bar++)
          expect(events.some((e) => e.track === name && Math.floor(e.onset) === bar)).toBe(true);
    }
    expect(seen.size).toBe(3);
    expect(registers.size).toBeGreaterThan(1);
    expect(rates.size).toBeGreaterThan(1);
    expect(isHighest).toBeGreaterThanOrEqual(7);
    expect(isBusiest).toBeGreaterThanOrEqual(7);
    expect(notHighest).toBeGreaterThanOrEqual(10);
    expect(notBusiest).toBeGreaterThanOrEqual(10);
  });
  test("reject a front part made 6 dB louder, after real evaluation", async () => {
    const t = trial("fam.snd.roles", 3, "front", 0);
    const track = t.params.front === "lead" ? "mel" : t.params.front;
    const loud = t.code
      .split("\n")
      .map((line) =>
        line.startsWith(`${track}:`) ? line.replace(".gain(.55)", `.gain(${0.55 * 10 ** (6 / 20)})`) : line,
      )
      .join("\n");
    const events = (await evalHeadless(loud, 4)).events;
    const gain = required(events.find((e) => e.track === track)).value.gain as number;
    expect(20 * Math.log10(gain / 0.55)).toBeCloseTo(6);
    expect(Object.values(frontChecks(asFront(events))).some(Boolean)).toBe(false);
  });
});

describe("Oak 2.0 W2: lesson gates and listening words", () => {
  for (const order of [EARLY_ORDER, LATE_ORDER])
    test(`${order === EARLY_ORDER ? "early" : "late"} legal order`, () => {
      for (const [id, category, gate, level] of [
        ["fam.har.motion", "parallel-step", "U06.L13", 1],
        ["fam.har.motion", "parallel-leap", "U06.L13", 2],
        ["fam.code.functions", "inversion", "U07.L11", 4],
        ["fam.code.functions", "rotation", "U07.L11", 4],
        ["fam.code.functions", "time-shift", "U07.L11", 4],
        ["fam.snd.roles", "front", "A2.L05", 3],
      ] as const) {
        const def = fam(id);
        expect(def.categories.find((c) => c.id === category)?.unlockAt).toBe(gate);
        expect(required(def.levels[level - 1]).categories).toContain(category);
        for (let i = 0; i < order.length; i++) {
          const done = order.slice(0, i + 1);
          const open = def.categories.filter((c) => done.includes(c.unlockAt)).map((c) => c.id);
          if (!done.includes(gate)) {
            expect(open).not.toContain(category);
            if (level > 2) expect(maxOpenLevel(def, open, done)).toBeLessThan(level);
            if (id === "fam.har.motion") expect(done.includes(def.unlock.lesson)).toBe(false);
          }
        }
        const allDone = [...order];
        expect(
          maxOpenLevel(
            def,
            def.categories.map((c) => c.id),
            allDone,
          ),
        ).toBe(def.levels.length);
      }
      const def = fam("fam.code.functions");
      const done = order.slice(0, order.indexOf("U07.L02") + 1);
      const open = def.categories.filter((c) => done.includes(c.unlockAt)).map((c) => c.id);
      for (const seed of SEEDS) {
        const plan = planSet(bindFamily(def), {
          family: def.id,
          setId: `before-transforms-${seed}`,
          level: maxOpenLevel(def, open, done),
          openCategories: open,
          categoryStats: {},
          blockedRemaining: 0,
          quiet: false,
        });
        expect(plan.trials.some((t) => ["inversion", "rotation", "time-shift"].includes(t.category))).toBe(
          false,
        );
      }
      // unlockedAt uses graph ancestors, the intersection of every legal route. The two concrete walks
      // also witness that these ancestors really precede the lesson; no later tool can leak through.
      const before = courseGraph().before("U07.L11");
      for (const id of before) expect(order.indexOf(id)).toBeLessThan(order.indexOf("U07.L11"));
      expect(before.has("U13.L01")).toBe(false);
      expect(before.has("U07.L07")).toBe(false);
    });
  test("motion has its listening line; A2.L01 retains its original words", async () => {
    const text = await Bun.file(new URL("../../../app/src/drills/listen-for.ts", import.meta.url)).text();
    expect(text).toContain(
      '"fam.har.motion":\n    "Follow the top note and the bass from chord to chord. When they move together by the same amount every time, the chords are parallel; when the top note stays close while the bass moves a different way, they are voice-led."',
    );
    expect(text).toContain(
      '"fam.snd.roles":\n    "Pick out who plays what: the tune, the harmony, the low end. Where two parts sit at the same height, they blur into each other."',
    );
  });
});

// Captured before edits on clean oak2-x12 at 11f3770434210031558c049c0295424d524805da.
// For each existing category at each existing level, run bindFamily(...).generate(createRng(seed),
// level, levelNo, DEFAULT_PROFILE, { category, openCategories: all category ids }) for seeds 0..19.
// SHA-256(JSON.stringify(the 20 complete trials)) pins code, answer, events, options and metadata.
const BASELINE: readonly [string, number, string, string][] = [
  ["fam.code.functions", 1, "scale", "206e5f1f0685a3facfe8d7f1c11449b0e8b941a031f3fd4adf8062723ad1916a"],
  [
    "fam.code.functions",
    1,
    "scale-patterned",
    "140cd240a5450320753a721cd902fd902bc9325d102c88f4203d0117f8994820",
  ],
  ["fam.code.functions", 2, "scale", "23a8fc09e834361f69b30016722e33abf5106d7c82c88d4969b2cc607baf3732"],
  [
    "fam.code.functions",
    2,
    "scale-patterned",
    "c1885e01292550a736b725788dd4469dc570ef0476b056659d195ec4919d3e60",
  ],
  ["fam.code.functions", 2, "transpose", "45ec243909da118f30ee11d5385882d3f99aec6868246e80c8ee5e0f75942077"],
  ["fam.code.functions", 2, "arp", "136144f33075a9ce5fbfca76d134740d91bcc07797e21ebc63c20de6e10871d5"],
  ["fam.code.functions", 2, "add", "5cabd35277ad95c5c426b1f44894c4767290b42558ef801cd5cad1cb725e8d56"],
  ["fam.code.functions", 3, "scale", "669a162f7f3c34d0eba420b61bbec29395e493dd4b7d118c87f87195923fd690"],
  [
    "fam.code.functions",
    3,
    "scale-patterned",
    "1fb08046973c1da0fa8d0280fd1d9556f8798239aa04deaad9d806bd39330c95",
  ],
  ["fam.code.functions", 3, "transpose", "2170148e55aa12d87a686f6c77290c6580a6ddc114784b02f68efe3fb6fca298"],
  ["fam.code.functions", 3, "arp", "bbcad649d2845105ed5c27ce0cc8da3d7ce0264745f8f70705e110a66d8b242b"],
  ["fam.code.functions", 3, "add", "aae4f9b98a4a362185c2f7725b7784b25e46e83fe6f259e3d49bc772092a5ca1"],
  ["fam.code.functions", 3, "rev", "8f9137ed54e22f59ea092a5ac7b085293bc89714ef1a2cc1e2c77e5da26e3596"],
  [
    "fam.code.functions",
    3,
    "scale-transpose",
    "cd24c236ec45af93b9875ce5a823af8f018d469c38789cd505d8c17257a66b06",
  ],
  ["fam.code.functions", 3, "root-notes", "18ffd4ebc021c025294df330ff307b7a98141572f5381588d265ff3318d5627f"],
  ["fam.snd.roles", 1, "roles", "04fafb02db9361905829e92cdbc3b8500d0c83178892bb5d881422dbd62a932f"],
  ["fam.snd.roles", 2, "roles", "cbe215df0971e16b48baf72042c0ae91ce3ec662f452b3a64372b49752719579"],
  ["fam.snd.roles", 2, "masking", "a92e001ed1d41ed339bedf55acdbf03ceee7a464b99d3bad47aa9c6da7d9dbd5"],
];
test("all 360 pre-change trials remain byte-identical, and still play in real Strudel", async () => {
  for (const [id, level, category, digest] of BASELINE) {
    const trials = SEEDS.slice(0, 20).map((seed) => trial(id, level, category, seed));
    expect([id, level, category, createHash("sha256").update(JSON.stringify(trials)).digest("hex")]).toEqual([
      id,
      level,
      category,
      digest,
    ]);
    for (const t of trials) {
      const result = await evalHeadless(t.code, Number(t.params.bars));
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.cpsSet).toBe(true);
      expect((await strudelEvents(t.code, Number(t.params.bars))).flat).toEqual(flattenEvents(t.events));
    }
  }
}, 120_000);
