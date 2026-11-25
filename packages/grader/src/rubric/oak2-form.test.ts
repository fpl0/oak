// Oak 2.0 form and arrangement rules (docs/oak2/PLAN.md §5, W0 Task 2), pinned on real Strudel 1.2.6 output. Every
// rule has passing pieces that get the book's point in different ways, failing pieces including one that keeps the
// surface but misses the point (PLAN §2 fidelity rule 4), and the Review Focus edge pins: a named track with no
// events (1), no `arrange()` (2), a Band beside the learner (3), and bar/beat arithmetic in 3/4 and with a pickup (4).
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { KeySpec, MeterId, NEvent, PickupSpec } from "@oak/content-kit";
import { strudel } from "../analyze/__support__/fixtures.ts";
import { sectionsFromAst } from "../analyze/sections.ts";
import { normalizedFromEvents } from "../analyze/tracks.ts";
import type { Normalized } from "../types.ts";
import type { RubricContext } from "./context.ts";
import { oak2FormRules } from "./oak2-form.ts";
import { CUSTOM_DEPS } from "./rules.ts";

setDefaultTimeout(30_000);
const C: KeySpec = { tonic: "C", mode: "major" };
const RULES = oak2FormRules(CUSTOM_DEPS);

interface Opts {
  bars?: number;
  key?: KeySpec | null;
  meter?: MeterId;
  pickup?: PickupSpec;
  /** Strudel code of a Band, played beside the learner as `band.<label>` tracks. */
  band?: string;
}
/** The Band's events as `band.<label>` tracks next to the learner's (what the grade pipeline hands a rubric). */
function withBand(n: Normalized, band: Normalized): Normalized {
  const moved: NEvent[] = band.all.map((e) => ({ ...e, track: `band.${e.track}`, id: `band.${e.id}` }));
  return normalizedFromEvents([...n.all, ...moved], { cps: n.cps });
}
async function run(name: string, code: string, params: Record<string, unknown> = {}, o: Opts = {}) {
  const s = sectionsFromAst(code);
  const total = o.bars ?? (s && "totalBars" in s ? s.totalBars : 4);
  let n = await strudel(code, total);
  if (o.band) n = withBand(n, await strudel(o.band, total));
  const key = o.key === undefined ? C : o.key;
  const ctx: RubricContext = {
    meter: o.meter ?? "4/4",
    code,
    params: {},
    bars: total,
    totalBars: total,
    ...(key ? { key } : {}),
    ...(o.pickup ? { pickup: o.pickup } : {}),
  };
  const rule = RULES[name];
  if (!rule) throw new Error(`no rule ${name}`);
  return rule(n, ctx, params);
}
async function passes(name: string, code: string, params: Record<string, unknown> = {}, o: Opts = {}) {
  const r = await run(name, code, params, o);
  if (!r.ok) throw new Error(`expected a pass for:\n${code}\n→ ${r.detail}`);
  return r;
}
async function failsWith(
  name: string,
  code: string,
  re: RegExp,
  params: Record<string, unknown> = {},
  o: Opts = {},
) {
  const r = await run(name, code, params, o);
  if (r.ok) throw new Error(`expected a fail for:\n${code}\n→ ${r.detail}`);
  expect(r.detail).toMatch(re);
  return r;
}

test("the table has the five rules of the form wave", () => {
  expect(Object.keys(RULES).sort()).toEqual(
    ["arc", "carved", "ends-on-purpose", "staggered-boundary", "unique-event"].sort(),
  );
});

// --- ends-on-purpose -------------------------------------------------------------------------------------

describe("ends-on-purpose", () => {
  // Parts come in one at a time in the intro and leave in the reverse order in the outro (mirror the intro).
  const EXIT = `setcpm(120/4)
const drumsIntro = s("bd sd bd sd")
const drumsVerse = s("bd sd bd sd")
const drumsOutro = s("<[bd sd bd sd] [bd sd bd sd] [bd sd bd sd] ~>")
const bassIntro = n("<~ 0 0 0>").scale("C2:major").s("piano")
const bassVerse = n("0 4").scale("C2:major").s("piano")
const bassOutro = n("<[0 4] [0 4] ~ ~>").scale("C2:major").s("piano")
const melIntro = n("<~ ~ [0 2 4 2] [4 2 0 ~]>").scale("C4:major").s("piano")
const melVerse = n("<[0 2 4 2] [4 2 0 ~]>").scale("C4:major").s("piano")
const melOutro = n("<[0 2 4 2] ~ ~ ~>").scale("C4:major").s("piano")
drums: arrange([4, drumsIntro], [4, drumsVerse], [4, drumsOutro])
bass: arrange([4, bassIntro], [4, bassVerse], [4, bassOutro])
mel: arrange([4, melIntro], [4, melVerse], [4, melOutro])`;

  // The loop plays unchanged to the end: the book-miss pin (an outro section that is just more of the same).
  const LOOP = `setcpm(120/4)
const drumsVerse = s("bd sd bd sd")
const drumsOutro = s("bd sd bd sd")
const bassVerse = n("0 4").scale("C2:major").s("piano")
const bassOutro = n("0 4").scale("C2:major").s("piano")
const melVerse = n("<[0 2 4 2] [4 2 0 ~]>").scale("C4:major").s("piano")
const melOutro = n("<[0 2 4 2] [4 2 0 ~]>").scale("C4:major").s("piano")
drums: arrange([4, drumsVerse], [4, drumsOutro])
bass: arrange([4, bassVerse], [4, bassOutro])
mel: arrange([4, melVerse], [4, melOutro])`;

  test("exit-order: parts leave in the reverse order of their entry", async () => {
    const r = await passes("ends-on-purpose", EXIT);
    expect(r.detail).toMatch(/leave one by one/);
    await passes("ends-on-purpose", EXIT, { modes: ["exit-order"] });
  });
  test("exit-order: parts leaving in the order they came in is no mirror", async () => {
    // First in, first out: the drums came in first and leave first.
    const code = EXIT.replace(
      'const drumsOutro = s("<[bd sd bd sd] [bd sd bd sd] [bd sd bd sd] ~>")',
      'const drumsOutro = s("<[bd sd bd sd] ~ ~ ~>")',
    ).replace(
      'const melOutro = n("<[0 2 4 2] ~ ~ ~>")',
      'const melOutro = n("<[0 2 4 2] [4 2 0 ~] [0 2 4 2] ~>")',
    );
    await failsWith("ends-on-purpose", code, /leave one by one/, { modes: ["exit-order"] });
  });
  test("exit-order: parts that all stop in the same bar leave together, not in turn (X14)", async () => {
    const code = EXIT.replace(
      'const melOutro = n("<[0 2 4 2] ~ ~ ~>")',
      'const melOutro = n("<[0 2 4 2] [4 2 0 ~] ~ ~>")',
    );
    await failsWith("ends-on-purpose", code, /leave one by one/, { modes: ["exit-order"] });
  });

  test("fades-out: the repeating outro fades by more than 9 dB", async () => {
    const code = `setcpm(120/4)
const drumsVerse = s("bd sd bd sd")
const drumsOutro = s("bd sd bd sd").gain("<.8 .5 .3 .15>")
const melVerse = n("<[0 2 4 2] [4 2 0 ~]>").scale("C4:major").s("piano")
const melOutro = n("[0 2 4 2]").scale("C4:major").s("piano").gain("<.8 .5 .3 .15>")
drums: arrange([4, drumsVerse], [4, drumsOutro])
mel: arrange([4, melVerse], [4, melOutro])`;
    const r = await passes("ends-on-purpose", code);
    expect(r.detail).toMatch(/fades out/);
  });
  test("fades-out: a small dip in level is no fade", async () => {
    const code = `setcpm(120/4)
const drumsVerse = s("bd sd bd sd")
const drumsOutro = s("bd sd bd sd").gain("<.8 .75 .7 .65>")
drums: arrange([4, drumsVerse], [4, drumsOutro])`;
    await failsWith("ends-on-purpose", code, /fade out a part that repeats/, { modes: ["fades-out"] });
  });

  test("final-hit: one last hit, then silence", async () => {
    const code = LOOP.replace(
      'const drumsOutro = s("bd sd bd sd")',
      'const drumsOutro = s("<[bd sd bd sd] [bd sd bd sd] [bd sd bd sd] [bd ~ ~ ~]>")',
    )
      .replace('const bassOutro = n("0 4")', 'const bassOutro = n("<[0 4] [0 4] [0 4] [0 ~ ~ ~]>")')
      .replace(
        'const melOutro = n("<[0 2 4 2] [4 2 0 ~]>")',
        'const melOutro = n("<[0 2 4 2] [4 2 0 ~] [0 2 4 2] [0 ~ ~ ~]>")',
      );
    const r = await passes("ends-on-purpose", code, { modes: ["final-hit"] });
    expect(r.detail).toMatch(/one last hit \(bar 8, beat 1\)/);
  });

  test("cadence: the last chord change is V to I, on a bar written for the end", async () => {
    const code = `setcpm(120/4)
const chordsVerse = chord("<C F G C>").voicing().s("piano")
const chordsOutro = chord("<F C G [C ~]>").voicing().s("piano")
const drumsVerse = s("bd sd bd sd")
const drumsOutro = s("<[bd sd bd sd] [bd sd bd sd] [bd sd bd sd] [bd ~ ~ ~]>")
chords: arrange([4, chordsVerse], [4, chordsOutro])
drums: arrange([4, drumsVerse], [4, drumsOutro])`;
    const r = await passes("ends-on-purpose", code, { modes: ["cadence"] });
    expect(r.detail).toMatch(/home chord/);
  });
  test("cadence: a chord loop that happens to end on I is the loop playing on", async () => {
    const code = `setcpm(120/4)
chords: chord("<C F G C>").voicing().s("piano")
drums: s("bd sd bd sd")`;
    await failsWith("ends-on-purpose", code, /home chord/, { modes: ["cadence"] }, { bars: 8 });
  });

  test("shrinking-tail: the closing phrase is looped shorter", async () => {
    // The verse ends on its phrase C D; the outro plays C D, then only D twice (one shortening is enough).
    const code = `setcpm(120/4)
const melVerse = n("<[0 2 4 2] [4 5 4 2] [2 1 0 1] [0 ~ 4 ~]>").scale("C4:major").s("piano")
const melOutro = n("<[2 1 0 1] [0 ~ 4 ~] [0 ~ 4 ~] [0 ~ 4 ~]>").scale("C4:major").s("piano")
mel: arrange([4, melVerse], [4, melOutro])`;
    const r = await passes("ends-on-purpose", code, { modes: ["shrinking-tail"] });
    expect(r.detail).toMatch(/shorter/);
  });
  test("shrinking-tail: a phrase whose last two bars match is no shortening when it loops on", async () => {
    const code = `setcpm(120/4)
const melVerse = n("<[0 2 4 2] [4 5 4 2] [0 ~ 4 ~] [0 ~ 4 ~]>").scale("C4:major").s("piano")
const melOutro = n("<[0 2 4 2] [4 5 4 2] [0 ~ 4 ~] [0 ~ 4 ~]>").scale("C4:major").s("piano")
mel: arrange([4, melVerse], [4, melOutro])`;
    await failsWith("ends-on-purpose", code, /shorter and shorter/, { modes: ["shrinking-tail"] });
  });

  test("build-out: parts pile up and the last bar is the fullest", async () => {
    const code = `setcpm(120/4)
const drumsVerse = s("bd sd")
const drumsOutro = s("<[bd sd] [bd sd] [bd sd bd sd] [bd*4, hh*8, ~ sd ~ sd]>")
const melVerse = n("[0 2 4 2]").scale("C4:major").s("piano")
const melOutro = n("<~ [0 2 4 2] [0 2 4 2] [0 2 4 2 4 2 0 2]>").scale("C4:major").s("piano")
drums: arrange([4, drumsVerse], [4, drumsOutro])
mel: arrange([4, melVerse], [4, melOutro])`;
    const r = await passes("ends-on-purpose", code, { modes: ["build-out"] });
    expect(r.detail).toMatch(/fullest/);
  });

  test("the loop played unchanged to the end fails, naming every way it looked for", async () => {
    const r = await failsWith(
      "ends-on-purpose",
      LOOP,
      /the last section \(the outro\) plays on like the rest/,
    );
    expect(r.detail).toMatch(/leave one by one/);
    expect(r.detail).toMatch(/end on one last hit/);
    // Only the asked-for ways are named.
    const one = await failsWith("ends-on-purpose", LOOP, /fade out/, { modes: ["fades-out"] });
    expect(one.detail).not.toMatch(/leave one by one/);
  });

  test("edge 1: a named track with no events fails naming it", async () => {
    await failsWith("ends-on-purpose", EXIT, /`keys` plays nothing/, { tracks: ["keys"] });
    const muted = EXIT.replace("bass: arrange", "_bass: arrange");
    await failsWith("ends-on-purpose", muted, /`bass` plays nothing/, { tracks: ["bass", "drums"] });
  });
  test("edge 2: without arrange() the last 4 bars are read", async () => {
    // One loop: plays on unchanged.
    await failsWith(
      "ends-on-purpose",
      `setcpm(120/4)\ndrums: s("bd sd bd sd")`,
      /the last 4 bars play on like the rest/,
      {},
      { bars: 8 },
    );
    // One long cycle that fades over its last 4 bars.
    await passes(
      "ends-on-purpose",
      `setcpm(120/4)\ndrums: s("bd sd bd sd").gain("<.8 .8 .8 .8 .8 .4 .2 .1>")`,
      {},
      { bars: 8 },
    );
  });
  test("edge 3: a Band playing past the end is not one of the learner's parts", async () => {
    // A Band that comes in late and plays to the end would break the mirror if it were counted.
    await passes("ends-on-purpose", EXIT, { modes: ["exit-order"] }, { band: `drums: s("<~ ~ ~ hh*4>")` });
    // A Band that keeps playing after the learner's final hit does not cancel the silence.
    const code = `setcpm(120/4)
const drumsVerse = s("bd sd bd sd")
const drumsOutro = s("<[bd sd bd sd] [bd ~ ~ ~]>")
drums: arrange([4, drumsVerse], [2, drumsOutro])`;
    await passes(
      "ends-on-purpose",
      code,
      { modes: ["final-hit"] },
      { band: `keys: n("0 2 4 2").scale("C4:major").s("piano")` },
    );
  });
  test("edge 4: 3/4 and a pickup count beats and bars from the meter", async () => {
    const waltz = `setcpm(120/3)
const drumsVerse = s("bd sd sd")
const drumsOutro = s("<[bd sd sd] [bd sd ~]>")
drums: arrange([4, drumsVerse], [2, drumsOutro])`;
    const r = await passes("ends-on-purpose", waltz, { modes: ["final-hit"] }, { meter: "3/4" });
    expect(r.detail).toMatch(/bar 6, beat 2/);
    // In 3/4 a quarter of the bar is less than a beat: the last hit leaves no full beat of silence after it.
    await failsWith(
      "ends-on-purpose",
      waltz.replace("[bd sd ~]", "[bd sd sd ~]"),
      /end on one last hit/,
      { modes: ["final-hit"] },
      { meter: "3/4" },
    );
    // The same piece counted in 4/4 has a full (shorter) beat of silence: the meter decides.
    await passes(
      "ends-on-purpose",
      waltz.replace("[bd sd ~]", "[bd sd sd ~]"),
      { modes: ["final-hit"] },
      { meter: "4/4" },
    );
    // With a pickup, cycle 0 is bar 0: the last hit in cycle 5 is in bar 5.
    const p = await passes(
      "ends-on-purpose",
      waltz,
      { modes: ["final-hit"] },
      { meter: "3/4", pickup: { units: [1, 1] } },
    );
    expect(p.detail).toMatch(/bar 5, beat 2/);
  });
});

// --- carved ------------------------------------------------------------------------------------------------

describe("carved", () => {
  const FULL_DRUMS = `s("bd sd bd sd")`;
  const FULL_BASS = `n("<0 4 5 3>").scale("C2:major").s("piano")`;
  const FULL_MEL = `n("<[0 2 4 2] [4 2 0 ~]>").scale("C4:major").s("piano")`;
  // Intro, verse and chorus are the chorus with parts taken out.
  const CARVED = `setcpm(120/4)
const drumsIntro = silence
const drumsVerse = ${FULL_DRUMS}
const drumsChorus = ${FULL_DRUMS}
const bassIntro = ${FULL_BASS}
const bassVerse = ${FULL_BASS}
const bassChorus = ${FULL_BASS}
const melIntro = silence
const melVerse = silence
const melChorus = ${FULL_MEL}
drums: arrange([4, drumsIntro], [4, drumsVerse], [4, drumsChorus])
bass: arrange([4, bassIntro], [4, bassVerse], [4, bassChorus])
mel: arrange([4, melIntro], [4, melVerse], [4, melChorus])`;

  test("every section is the fullest with parts taken out", async () => {
    const r = await passes("carved", CARVED);
    expect(r.detail).toMatch(/the chorus/);
  });
  test("erasing notes inside a part is carving too (only deleting)", async () => {
    const code = CARVED.replace(
      'const drumsVerse = s("bd sd bd sd")',
      'const drumsVerse = s("bd ~ bd ~")',
    ).replace("const melVerse = silence", 'const melVerse = n("<[0 ~ 4 ~] ~>").scale("C4:major").s("piano")');
    await passes("carved", code);
  });
  test("an additive build fails: the verse plays a line the chorus never plays", async () => {
    // Passes a contrast rule (the sections differ) but is built by adding, not carving.
    const code = CARVED.replace('const bassVerse = n("<0 4 5 3>")', 'const bassVerse = n("<0 2 0 2>")');
    const r = await failsWith(
      "carved",
      code,
      /`bass` plays something in the verse .* does not play at that place in the chorus/,
    );
    expect(r.where?.track).toBe("bass");
  });
  test("a part missing from the fullest section fails", async () => {
    const code = `${CARVED}\npad: arrange([4, padIntro], [4, padVerse], [4, padChorus])`.replace(
      "const melIntro",
      `const padIntro = chord("C").voicing().s("piano")\nconst padVerse = silence\nconst padChorus = silence\nconst melIntro`,
    );
    await failsWith("carved", code, /`pad` .* not in the chorus/);
  });
  test("all sections identical fail", async () => {
    const code = CARVED.replace("const drumsIntro = silence", `const drumsIntro = ${FULL_DRUMS}`)
      .replace("const melIntro = silence", `const melIntro = ${FULL_MEL}`)
      .replace("const melVerse = silence", `const melVerse = ${FULL_MEL}`);
    await failsWith("carved", code, /every section plays the same parts/);
  });
  test("minDiffer asks for more versions", async () => {
    await failsWith("carved", CARVED, /3 different versions.*asks for 4/, { minDiffer: 4 });
  });
  test("a bar moved to another place is new material, not carving (X14 book miss)", async () => {
    const code = CARVED.replace('const bassVerse = n("<0 4 5 3>")', 'const bassVerse = n("<4 0 3 5>")');
    await failsWith("carved", code, /`bass` plays something in the verse .* at that place/);
  });
  test("every part kept and thinned by a quarter or more is carving too (X14 other way)", async () => {
    const code = CARVED.replace("const drumsIntro = silence", 'const drumsIntro = s("bd ~ ~ ~")')
      .replace('const drumsVerse = s("bd sd bd sd")', 'const drumsVerse = s("bd ~ bd ~")')
      .replace(
        "const melIntro = silence",
        'const melIntro = n("<[0 ~ ~ ~] [4 ~ ~ ~]>").scale("C4:major").s("piano")',
      )
      .replace(
        "const melVerse = silence",
        'const melVerse = n("<[0 ~ 4 ~] [4 ~ 0 ~]>").scale("C4:major").s("piano")',
      );
    const r = await passes("carved", code);
    expect(r.detail).toMatch(/3 different versions/);
  });
  test("edge 1: a named track with no events fails naming it", async () => {
    await failsWith("carved", CARVED, /`keys` plays nothing/, { tracks: ["keys", "bass"] });
  });
  test("edge 2: without arrange() carved needs sections", async () => {
    await failsWith("carved", `setcpm(120/4)\ndrums: ${FULL_DRUMS}`, /needs sections/);
  });
  test("edge 3: a Band part in the intro is not the learner's", async () => {
    await passes(
      "carved",
      CARVED,
      {},
      { band: `keys: n("<[0 4 7] ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~>").scale("C3:major").s("piano")` },
    );
  });
  test("edge 4: a 3/4 piece is read by its bars", async () => {
    const waltz = `setcpm(120/3)
const drumsVerse = s("bd ~ ~")
const drumsChorus = s("bd sd sd")
const melVerse = silence
const melChorus = n("<[0 2 4] [4 2 0]>").scale("C4:major").s("piano")
drums: arrange([4, drumsVerse], [4, drumsChorus])
mel: arrange([4, melVerse], [4, melChorus])`;
    await passes("carved", waltz, {}, { meter: "3/4" });
  });
});

// --- staggered-boundary ----------------------------------------------------------------------------------------

describe("staggered-boundary", () => {
  // Verse → chorus at bar 5. The drums and bass change on the bar line.
  const HARD = `setcpm(120/4)
const drumsVerse = s("bd sd bd sd")
const drumsChorus = s("bd bd sd bd")
const bassVerse = n("0 0 0 0").scale("C2:major").s("piano")
const bassChorus = n("3 3 4 4").scale("C2:major").s("piano")
const melVerse = n("0 2 4 2").scale("C4:major").s("piano")
const melChorus = n("7 6 4 2").scale("C4:major").s("piano")
drums: arrange([4, drumsVerse], [4, drumsChorus])
bass: arrange([4, bassVerse], [4, bassChorus])
mel: arrange([4, melVerse], [4, melChorus])`;

  test("one part stops early while the rest change on the bar line", async () => {
    const code = HARD.replace('n("0 2 4 2").scale', 'n("<[0 2 4 2] [0 2 4 2] [0 2 4 2] [0 2 ~ ~]>").scale');
    const r = await passes("staggered-boundary", code);
    expect(r.detail).toMatch(/`mel` stops 2 beats early/);
  });
  test("one part comes in late (a gap) while the rest change on the bar line", async () => {
    const code = HARD.replace('n("7 6 4 2").scale', 'n("<[~ ~ 4 2] [7 6 4 2] [7 6 4 2] [7 6 4 2]>").scale');
    const r = await passes("staggered-boundary", code);
    expect(r.detail).toMatch(/`mel` comes in 2 beats late/);
  });
  test("one part carries on into the next section", async () => {
    const code = HARD.replace('n("3 3 4 4").scale', 'n("<[0 0 4 4] [3 3 4 4] [3 3 4 4] [3 3 4 4]>").scale');
    const r = await passes("staggered-boundary", code);
    expect(r.detail).toMatch(/`bass` carries on 2 beats into the chorus/);
  });
  test("every part switching on the bar line fails (book miss)", async () => {
    await failsWith("staggered-boundary", HARD, /every part changes right on the bar line/);
  });
  test("every part offset by the same amount just moves the seam", async () => {
    const code = HARD.replace(
      's("bd sd bd sd")',
      's("<[bd sd bd sd] [bd sd bd sd] [bd sd bd sd] [bd sd bd bd]>")',
    )
      .replace('n("0 0 0 0").scale', 'n("<[0 0 0 0] [0 0 0 0] [0 0 0 0] [0 0 0 4]>").scale')
      .replace('n("0 2 4 2").scale', 'n("<[0 2 4 2] [0 2 4 2] [0 2 4 2] [0 2 4 6]>").scale');
    await failsWith("staggered-boundary", code, /all change 1 beat early together/);
  });
  test("fill: anticipate leaves the downbeat empty; hesitate runs past it", async () => {
    const anticipate = HARD.replace(
      's("bd sd bd sd")',
      's("<[bd sd bd sd] [bd sd bd sd] [bd sd bd sd] [bd sd sd*4 sd*4]>")',
    ).replace('s("bd bd sd bd")', 's("<[~ bd sd bd] [bd bd sd bd] [bd bd sd bd] [bd bd sd bd]>")');
    const a = await passes("staggered-boundary", anticipate, { fill: "anticipate" });
    expect(a.detail).toMatch(/drum fill .* empty downbeat/);
    await failsWith("staggered-boundary", anticipate, /fill that runs past the downbeat/, {
      fill: "hesitate",
    });
    const hesitate = HARD.replace(
      's("bd sd bd sd")',
      's("<[bd sd bd sd] [bd sd bd sd] [bd sd bd sd] [bd sd sd*4 sd*4]>")',
    ).replace('s("bd bd sd bd")', 's("<[sd*4 bd sd bd] [bd bd sd bd] [bd bd sd bd] [bd bd sd bd]>")');
    await passes("staggered-boundary", hesitate, { fill: "hesitate" });
    await failsWith("staggered-boundary", HARD, /drum fill/, { fill: "anticipate" });
  });
  // X14 round 2 (A2.L09): drum lines on their own tracks, verse → chorus at bar 5.
  const KIT = (
    kick: string,
    snare: string,
    hats: string,
    perc = "silence",
    percChorus = 's("<~ [cr ~ ~ ~] ~ ~>")',
  ) =>
    `setcpm(90/4)
const kickVerse = ${kick}
const kickChorus = s("bd*4")
const snareVerse = ${snare}
const snareChorus = s("~ sd ~ sd")
const hatsVerse = ${hats}
const hatsChorus = s("hh*16")
const percVerse = ${perc}
const percChorus = ${percChorus}
kick: arrange([4, kickVerse], [4, kickChorus])
snare: arrange([4, snareVerse], [4, snareChorus])
hats: arrange([4, hatsVerse], [4, hatsChorus])
perc: arrange([4, percVerse], [4, percChorus])`;
  test("a part silent on both sides of the bar line does not mark it; parts silent from one beat leave together", async () => {
    // kick, snare and hats all leave one beat early; perc only plays in the chorus's second bar.
    await failsWith(
      "staggered-boundary",
      KIT(
        's("<bd*8 bd*8 bd*8 [bd bd bd bd bd bd ~ ~]>")',
        's("<sd*8 sd*8 sd*8 [sd sd sd sd sd sd ~ ~]>")',
        's("<hh*8 hh*8 hh*8 [hh hh hh hh hh hh ~ ~]>")',
      ),
      /all change 1 beat early together/,
    );
    // All silent from beat 3, though the kick's and snare's last missing hits fall on different beats.
    await failsWith(
      "staggered-boundary",
      KIT(
        's("<[bd ~ bd ~] [bd ~ bd ~] [bd ~ bd ~] [bd ~ ~ ~]>")',
        's("<[~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [~ sd ~ ~]>")',
        's("<hh*8 hh*8 hh*8 [hh*4 ~]>")',
      ),
      /all change 2 beats early together/,
    );
    // A crash on the chorus downbeat marks the seam on the bar line.
    await failsWith(
      "staggered-boundary",
      KIT('s("bd ~ bd ~")', 's("~ sd ~ sd")', 's("hh*8")', "silence", 's("<[cr ~ ~ ~] ~ ~ ~>")'),
      /every part changes right on the bar line/,
    );
    // Hats leave two beats early while the kick changes on the bar line: blurred.
    await passes(
      "staggered-boundary",
      KIT('s("bd ~ bd ~")', 's("~ sd ~ sd")', 's("<hh*8 hh*8 hh*8 [hh*4 ~]>")'),
    );
  });
  test("fill: it peaks late in the bar; the gap is where drums usually play; the fill's own lines run on", async () => {
    const gap = (kit: string) =>
      kit
        .replace('s("bd*4")', 's("<[~ bd bd bd] bd*4 bd*4 bd*4>")')
        .replace('s("hh*16")', 's("<[~ hh*4 hh*4 hh*4] hh*16 hh*16 hh*16>")');
    const fill = (f: string) => `s("<[~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [${f}]>")`;
    await passes("staggered-boundary", gap(KIT('s("bd ~ bd ~")', fill("sd*4 sd*4 sd*4 ~"), 's("hh*8")')), {
      fill: "anticipate",
    });
    // A fill at the start of the bar, then the usual backbeat: not one that peaks before the downbeat.
    await failsWith(
      "staggered-boundary",
      gap(KIT('s("bd ~ bd ~")', fill("sd*4 sd*4 ~ sd"), 's("hh*8")')),
      /no drum fill before a seam/,
      { fill: "anticipate" },
    );
    // No drum ever plays a downbeat: the empty one at the seam is no gap.
    await failsWith(
      "staggered-boundary",
      KIT('s("~ bd ~ bd")', fill("sd*4 sd*4 sd*4 ~"), 's("[~ hh]*4")')
        .replace('s("bd*4")', 's("~ bd bd bd")')
        .replace('s("hh*16")', 's("[~ hh]*4")'),
      /no drum fill before a seam/,
      { fill: "anticipate" },
    );
    const late = KIT('s("bd ~ bd ~")', fill("~ sd sd*4 sd*4"), 's("hh*8")');
    // The fill stops at the bar line and a crash lands on the downbeat: no hesitation.
    await failsWith(
      "staggered-boundary",
      late.replace('s("<~ [cr ~ ~ ~] ~ ~>")', 's("<[cr ~ ~ ~] ~ ~ ~>")'),
      /no drum fill that runs past the downbeat/,
      { fill: "hesitate" },
    );
    // The snare runs on; then the fill passes to toms on a line silent before; then the hats make room.
    await passes(
      "staggered-boundary",
      late.replace(
        'snareChorus = s("~ sd ~ sd")',
        'snareChorus = s("<[sd*4 sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd]>")',
      ),
      { fill: "hesitate" },
    );
    await passes(
      "staggered-boundary",
      late.replace('s("<~ [cr ~ ~ ~] ~ ~>")', 's("<[ht*4 ~ ~ ~] [cr ~ ~ ~] ~ ~>")'),
      { fill: "hesitate" },
    );
    await passes(
      "staggered-boundary",
      KIT('s("bd ~ bd ~")', fill("~ sd sd*4 sd*4"), 's("<hh*8 hh*8 hh*8 ~>")').replace(
        'snareChorus = s("~ sd ~ sd")',
        'snareChorus = s("<[sd*4 sd ~ sd] [~ sd ~ sd] [~ sd ~ sd] [~ sd ~ sd]>")',
      ),
      { fill: "hesitate" },
    );
  });
  test("edge 1: a named track with no events fails naming it", async () => {
    await failsWith("staggered-boundary", HARD, /`hats` plays nothing/, { tracks: ["hats"] });
  });
  test("edge 2: without arrange() it needs sections", async () => {
    await failsWith("staggered-boundary", `setcpm(120/4)\ndrums: s("bd sd bd sd")`, /needs sections/);
  });
  test("edge 3: a Band staggered at the seam is not the learner's stagger", async () => {
    // Only the Band stops early; the learner's parts all switch on the bar line.
    await failsWith(
      "staggered-boundary",
      HARD,
      /every part changes right on the bar line/,
      {},
      {
        band: `keys: n("<[0 2 4 2] [0 2 4 2] [0 2 4 2] [0 2 ~ ~] [7 6 4 2]>").scale("C3:major").s("piano")`,
      },
    );
  });
  test("edge 4: in 3/4 a part that stops one beat early is one beat, at beat 3", async () => {
    const waltz = `setcpm(120/3)
const drumsVerse = s("bd sd sd")
const drumsChorus = s("bd bd sd")
const melVerse = n("<[0 2 4] [0 2 4] [0 2 4] [0 2 ~]>").scale("C4:major").s("piano")
const melChorus = n("7 6 4").scale("C4:major").s("piano")
drums: arrange([4, drumsVerse], [4, drumsChorus])
mel: arrange([4, melVerse], [4, melChorus])`;
    const r = await passes("staggered-boundary", waltz, {}, { meter: "3/4" });
    expect(r.detail).toMatch(/`mel` stops 1 beat early \(bar 4, beat 3\)/);
    const p = await passes("staggered-boundary", waltz, {}, { meter: "3/4", pickup: { units: [1, 1] } });
    expect(p.detail).toMatch(/bar 3, beat 3/);
  });
});

// --- unique-event ----------------------------------------------------------------------------------------------

describe("unique-event", () => {
  const BASE = `setcpm(120/4)
const drumsVerse = s("bd sd bd sd")
const drumsChorus = s("bd bd sd bd")
const melVerse = n("<[0 2 4 2] [4 2 0 ~]>").scale("C4:major").s("piano")
const melChorus = n("<[7 6 4 2] [4 ~ 2 ~]>").scale("C4:major").s("piano")`;
  const PLAIN = `${BASE}
drums: arrange([4, drumsVerse], [4, drumsChorus], [4, drumsVerse], [4, drumsChorus])
mel: arrange([4, melVerse], [4, melChorus], [4, melVerse], [4, melChorus])`;

  test("a fill in one bar of the second verse happens once", async () => {
    const code = `${BASE}
const drumsVerse2 = s("<[bd sd bd sd] [bd sd bd sd] [bd sd bd sd] [bd sd sd*4 sd*4]>")
drums: arrange([4, drumsVerse], [4, drumsChorus], [4, drumsVerse2], [4, drumsChorus])
mel: arrange([4, melVerse], [4, melChorus], [4, melVerse], [4, melChorus])`;
    const r = await passes("unique-event", code);
    expect(r.detail).toMatch(/`drums` .* once, in bar 12 \(verse\)/);
  });
  test("a one-time hit on a track of its own counts", async () => {
    const code = `${PLAIN}\nperc: s("<~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ cr ~ ~>")`;
    await passes("unique-event", code);
  });
  test("with controls, an effect switched on once counts", async () => {
    const code = `${PLAIN}\nhats: s("hh*8").room("<0 0 0 0 0 0 0 0 0 0 0 0 0 .8 0 0>")`;
    await passes("unique-event", code, { controls: true });
    await failsWith("unique-event", code, /nothing happens only once/);
  });
  test("nothing heard once fails", async () => {
    await failsWith("unique-event", PLAIN, /nothing happens only once/);
  });
  test("with controls, a change too small to hear or the same effect twice is no moment (X14 round 2)", async () => {
    const mel = (lpf: string) => `${PLAIN.replace(/\nmel: .*/, "")}
mel: arrange([4, melVerse], [4, melChorus], [4, melVerse], [4, melChorus]).lpf(${lpf})`;
    await passes("unique-event", mel('"<2000!9 1200 2000!6>"'), { controls: true });
    // 2000 → 1990: under a third of an octave.
    await failsWith("unique-event", mel('"<2000!9 1990 2000!6>"'), /nothing happens only once/, {
      controls: true,
    });
    // The same dip in bar 2 and bar 11: different notes under it, the same sound twice.
    await failsWith("unique-event", mel('"<2000 400 2000!8 400 2000!5>"'), /nothing happens only once/, {
      controls: true,
    });
  });

  test("a one-bar stop in the second verse is a moment too (X14 other way)", async () => {
    const code = `${BASE}
const drumsVerse2 = drumsVerse.mask("<1 1 1 0>")
drums: arrange([4, drumsVerse], [4, drumsChorus], [4, drumsVerse2], [4, drumsChorus])
mel: arrange([4, melVerse], [4, melChorus], [4, melVerse], [4, melChorus])`;
    const r = await passes("unique-event", code);
    expect(r.detail).toMatch(/`drums` stops for one bar, once, in bar 12 \(verse\)/);
  });
  test("a whole section heard once (a bridge) is no unique event (book miss)", async () => {
    const code = `${BASE}
const drumsBridge = s("hh*8")
const melBridge = n("<[9 8 7 6] [5 4 3 2]>").scale("C4:major").s("piano")
drums: arrange([4, drumsVerse], [4, drumsChorus], [4, drumsBridge], [4, drumsChorus])
mel: arrange([4, melVerse], [4, melChorus], [4, melBridge], [4, melChorus])`;
    await failsWith(
      "unique-event",
      code,
      /bridge (plays|each play) only once as a whole, and nothing happens only once/,
    );
  });
  test("a second verse rewritten whole is a new section, not a moment", async () => {
    const code = `${BASE}
const melVerse2 = n("<[9 8 7 6] [5 4 3 2]>").scale("C4:major").s("piano")
drums: arrange([4, drumsVerse], [4, drumsChorus], [4, drumsVerse], [4, drumsChorus])
mel: arrange([4, melVerse], [4, melChorus], [4, melVerse2], [4, melChorus])`;
    await failsWith("unique-event", code, /nothing happens only once/);
  });
  test("min asks for more moments", async () => {
    const code = `${PLAIN}\nperc: s("<~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ cr ~ ~>")`;
    await failsWith("unique-event", code, /1 moment .* asks for 2/, { min: 2 });
  });
  test("edge 1: a named track with no events fails naming it", async () => {
    await failsWith("unique-event", PLAIN, /`perc` plays nothing/, { tracks: ["perc"] });
  });
  test("edge 2: without arrange() it needs sections", async () => {
    await failsWith("unique-event", `setcpm(120/4)\ndrums: s("<bd sd bd cr>")`, /needs sections/);
  });
  test("edge 3: a Band's one-time hit is not the learner's", async () => {
    await failsWith(
      "unique-event",
      PLAIN,
      /nothing happens only once/,
      {},
      {
        band: `perc: s("<~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ cr ~ ~>")`,
      },
    );
  });
  test("edge 4: bar numbers follow the pickup and 3/4", async () => {
    const code = `setcpm(120/3)
const drumsVerse = s("bd sd sd")
const drumsChorus = s("bd bd sd")
drums: arrange([2, drumsVerse], [2, drumsChorus], [2, drumsVerse], [2, drumsChorus])
perc: s("<~ ~ ~ ~ ~ [~ cr ~] ~ ~>")`;
    const r = await passes("unique-event", code, {}, { meter: "3/4" });
    expect(r.detail).toMatch(/bar 6 \(verse\)/);
    const p = await passes("unique-event", code, {}, { meter: "3/4", pickup: { units: [1, 1] } });
    expect(p.detail).toMatch(/bar 5 \(verse\)/);
  });
});

// --- arc ----------------------------------------------------------------------------------------------------

describe("arc", () => {
  const S = {
    thin: `s("bd ~ ~ ~")`,
    mid: `s("bd ~ sd ~")`,
    full: `s("bd*4, hh*8, ~ sd ~ sd")`,
  };
  const piece = (...parts: (keyof typeof S)[]) =>
    `setcpm(120/4)\n${parts.map((p, i) => `const drums${["A", "B", "C", "D", "E"][i]} = ${S[p]}`).join("\n")}\ndrums: arrange(${parts.map((_, i) => `[2, drums${["A", "B", "C", "D", "E"][i]}]`).join(", ")})`;

  test("thin, fuller, fullest, thinner: an arc", async () => {
    const r = await passes("arc", piece("thin", "mid", "full", "mid"));
    expect(r.detail).toMatch(/fullest/);
  });
  test("repeats of the fullest next to each other are allowed", async () => {
    await passes("arc", piece("thin", "full", "full", "thin"));
  });
  test("the fullest first fails", async () => {
    await failsWith("arc", piece("full", "mid", "thin"), /comes first/);
  });
  test("the fullest last fails (it builds but never comes down)", async () => {
    await failsWith("arc", piece("thin", "mid", "full"), /comes last/);
  });
  test("flat density fails", async () => {
    await failsWith("arc", piece("mid", "mid", "mid"), /about as busy/);
  });
  test("exactly a quarter thinner counts, as in `contrast` (X14)", async () => {
    const code = `setcpm(120/4)
const drumsA = s("bd sd bd ~")
const drumsB = s("bd sd bd sd")
drums: arrange([2, drumsA], [2, drumsB], [2, drumsA])`;
    await passes("arc", code);
  });
  test("edge 1: a named track with no events fails naming it", async () => {
    await failsWith("arc", piece("thin", "full", "thin"), /`bass` plays nothing/, { tracks: ["bass"] });
  });
  test("edge 2: without arrange() it needs sections", async () => {
    await failsWith("arc", `setcpm(120/4)\ndrums: s("bd sd")`, /needs sections/);
  });
  test("edge 3: a Band crowding the first section does not move the peak", async () => {
    await passes("arc", piece("thin", "full", "thin"), {}, { band: `drums: s("<[hh*16] [hh*16] ~ ~ ~ ~>")` });
  });
  test("edge 4: a 3/4 piece names its bars", async () => {
    const code = `setcpm(120/3)
const drumsA = s("bd ~ ~")
const drumsB = s("bd*3, hh*6")
const drumsC = s("bd ~ ~")
drums: arrange([2, drumsA], [2, drumsB], [2, drumsC])`;
    const r = await passes("arc", code, {}, { meter: "3/4" });
    expect(r.detail).toMatch(/bars 3–4/);
  });
});
