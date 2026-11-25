import { describe, expect, test } from "bun:test";
import type { NEvent } from "@oak/content-kit";
import { pieceSlots } from "../rubric/rules.ts";
import { ev, norm, strudel } from "./__support__/fixtures.ts";
import { type Dimension, diffDimensions, type PieceView } from "./diff-dimensions.ts";

const melody = (notes = "c4 d4 e4", sound = "piano"): string => `mel: note("${notes}").s("${sound}")`;
const form = (order: string, verse = "c4 d4", chorus = "e4 f4 g4"): string =>
  `const melVerse = note("${verse}").s("piano")\nconst melChorus = note("${chorus}").s("piano")\nmel: arrange(${order})`;
const view = async (code: string, bars = 4): Promise<PieceView> => ({ n: await strudel(code, bars), code });

async function pair(a: string, b: string, expected: Dimension[], bars = 4): Promise<void> {
  const left = await view(a, bars);
  const right = await view(b, bars);
  const before = JSON.stringify([left, right]);
  expect(diffDimensions(left, right)).toEqual(expected);
  expect(diffDimensions(right, left)).toEqual(expected);
  expect(diffDimensions(left, right)).toEqual(expected);
  expect(JSON.stringify([left, right])).toBe(before);
}

describe("AC6 ten single-change pairs", () => {
  const cases: [string, string, string, Dimension][] = [
    ["sound: instrument", melody(), melody("c4 d4 e4", "sine"), "sound"],
    ["sound: control names", melody(), `${melody()}.lpf(800)`, "sound"],
    ["rhythm: more onsets", melody("c4*2"), melody("c4*4"), "rhythm"],
    ["rhythm: shifted onset", melody("c4 ~ d4 ~"), melody("~ c4 ~ d4"), "rhythm"],
    ["notes: reordered pitches", melody("c4 d4 e4"), melody("e4 c4 d4"), "notes"],
    ["notes: octave", melody(), `${melody()}.transpose(12)`, "notes"],
    [
      "harmony: a released seventh leaves a triad",
      'chords: note("[c4,e4,g4,b4]").s("piano")',
      'chords: note("[c4,e4,g4,b4 ~]").s("piano")',
      "harmony",
    ],
    [
      "harmony: a released fifth turns C6 into Am",
      'chords: note("[c4,e4,g4,a4]").s("piano")',
      'chords: note("[c4,e4,g4 ~,a4]").s("piano")',
      "harmony",
    ],
    ["form: order", form("[2, melVerse], [2, melChorus]"), form("[2, melChorus], [2, melVerse]"), "form"],
    [
      "form: bar counts",
      form("[1, melVerse], [3, melChorus]"),
      form("[2, melVerse], [2, melChorus]"),
      "form",
    ],
  ];
  for (const [name, a, b, expected] of cases) {
    test(name, async () => {
      await pair(a, b, [expected]);
      if (expected === "harmony") {
        // Same attacks and pitches, different sustain: the resulting chord slots really change.
        const left = await view(a);
        const right = await view(b);
        expect(left.n.all.map((e) => [e.onset, e.midi])).toEqual(right.n.all.map((e) => [e.onset, e.midi]));
        const identities = (v: PieceView) => pieceSlots(v.n).map((s) => [s.chord?.rootPc, s.chord?.quality]);
        expect(identities(left)).not.toEqual(identities(right));
      }
    });
  }
});

test("harmony fixture has the intended named chord slots", async () => {
  // Releasing C instead left E G A, which pieceSlots could not name. Releasing G leaves C E A:
  // the recognized harmony changes from C6 to Am while attacks and pitch sequences stay identical.
  const before = await view('chords: note("[c4,e4,g4,a4]").s("piano")', 1);
  const after = await view('chords: note("[c4,e4,g4 ~,a4]").s("piano")', 1);
  const slots = (v: PieceView) => pieceSlots(v.n).map((s) => [s.span, s.chord?.rootPc, s.chord?.quality]);
  expect(slots(before)).toEqual([
    [
      [
        [0, 1],
        [1, 1],
      ],
      0,
      "6",
    ],
  ]);
  expect(slots(after)).toEqual([
    [
      [
        [0, 1],
        [1, 2],
      ],
      0,
      "6",
    ],
    [
      [
        [1, 2],
        [1, 1],
      ],
      9,
      "min",
    ],
  ]);
});

describe("AC6 four double-change pairs", () => {
  test("sound and notes", async () => {
    await pair(melody(), melody("e4 d4 c4", "sine"), ["sound", "notes"]);
  });
  test("sound and rhythm", async () => {
    await pair(melody("c4*2"), melody("c4*4", "sine"), ["sound", "rhythm"]);
  });
  test("notes and harmony", async () => {
    await pair('chords: chord("C").voicing().s("piano")', 'chords: chord("Cm").voicing().s("piano")', [
      "notes",
      "harmony",
    ]);
  });
  test("notes and form in a retained section", async () => {
    await pair(form("[2, melVerse], [2, melChorus]"), form("[2, melChorus], [2, melVerse]", "d4 c4"), [
      "notes",
      "form",
    ]);
  });
});

describe("AC6 form and identity", () => {
  test("adding a section to arrange reports form only", async () => {
    await pair(form("[2, melVerse]"), form("[2, melVerse], [2, melChorus]"), ["form"]);
  });
  test("identical pieces report no dimensions", async () => {
    await pair(`${melody()}\ndrums: s("bd ~ sd ~")`, `${melody()}\ndrums: s("bd ~ sd ~")`, []);
  });
  test("equivalent audible notes written another way report no dimensions", async () => {
    await pair(melody("c4 e4 g4"), 'mel: n("0 2 4").scale("C4:major").s("piano")', []);
  });
  test("renaming a section reports form only", async () => {
    await pair(form("[4, melVerse]"), form("[4, melVerse]").replaceAll("melVerse", "melBridge"), ["form"]);
  });
  test("reordered chord sections report form only", async () => {
    const a =
      'const chordsVerse = chord("C").voicing()\nconst chordsChorus = chord("G").voicing()\nchords: arrange([2, chordsVerse], [2, chordsChorus]).s("piano")';
    const b = a.replace("[2, chordsVerse], [2, chordsChorus]", "[2, chordsChorus], [2, chordsVerse]");
    await pair(a, b, ["form"]);
  });
  test("a form change does not hide a rhythm edit in a shared section", async () => {
    await pair(form("[2, melVerse], [2, melChorus]"), form("[2, melChorus], [2, melVerse]", "c4*4"), [
      "rhythm",
      "form",
    ]);
  });
});

describe("track additions and removals", () => {
  test("duplicated musical material counts as sound only", async () => {
    await pair(melody(), `${melody()}\nmel2: note("c4 d4 e4").s("sine")`, ["sound"]);
  });
  test("a new pitch sequence on the same sound and onsets counts as notes", async () => {
    // Doubling at the octave cannot invent a chord in pieceSlots.
    await pair(melody(), `${melody()}\nmel2: note("c5 d5 e5").s("piano")`, ["notes"]);
  });
  test("a new drum onset pattern on the same sound counts as rhythm", async () => {
    await pair('drums: s("bd ~ bd ~")', 'drums: s("bd ~ bd ~")\nperc: s("~ bd ~ bd")', ["rhythm"]);
  });
  test("a new sound and drum onset pattern count as sound and rhythm", async () => {
    await pair('drums: s("bd ~ bd ~")', 'drums: s("bd ~ bd ~")\nhats: s("hh*8")', ["sound", "rhythm"]);
  });
  test("an empty track adds nothing", async () => {
    await pair(melody(), `${melody()}\nmel2: silence`, []);
  });
});

describe("normalized event boundaries", () => {
  const simple = (events: NEvent[]): PieceView => ({ code: "", n: norm(events) });
  const note = (midi: number, track = "mel"): NEvent => ev({ onset: [0, 1], midi, track, s: "piano" });

  test("bank values change sound", () => {
    // The lightweight strudel fixture omits bank; exercise the production NEvent field directly.
    const a = simple([{ ...note(60), bank: "one" }]);
    const b = simple([{ ...note(60), bank: "two" }]);
    expect(diffDimensions(a, b)).toEqual(["sound"]);
  });
  test("Band events cannot change any dimension", () => {
    const a = simple([note(60), note(48, "band.bass")]);
    const b = simple([
      note(60),
      { ...note(49, "band.bass"), s: "sine", controls: { cutoff: 800 }, onset: [1, 4] },
      note(53, "band.chords"),
      note(56, "band.chords"),
    ]);
    expect(diffDimensions(a, b)).toEqual([]);
  });
  test("event order and equivalent rational representations do not change dimensions", () => {
    const a = simple([note(60), { ...note(62), onset: [1, 2] }]);
    const b = simple([{ ...note(62), onset: [2, 4] }, note(60)]);
    expect(diffDimensions(a, b)).toEqual([]);
  });
  // W5 S8 (PLAN S5: Oak "describes what changed in each"): a sound control's value is part of the sound.
  test("a sound control's value changes sound", () => {
    const a = simple([{ ...note(60), controls: { cutoff: 800 } }]);
    const b = simple([{ ...note(60), controls: { cutoff: 1200 } }]);
    expect(diffDimensions(a, b)).toEqual(["sound"]);
  });
  test("a cutoff less than a third of an octave away is the same setting", () => {
    const a = simple([{ ...note(60), controls: { cutoff: 2000 } }]);
    const b = simple([{ ...note(60), controls: { cutoff: 2010 } }]);
    expect(diffDimensions(a, b)).toEqual([]);
  });
  test("level and routing controls are not sound: gain, velocity, postgain, pan, orbit", () => {
    const a = simple([{ ...note(60), controls: { gain: 0.5 } }]);
    const b = simple([
      { ...note(60), controls: { gain: 0.8, velocity: 0.7, postgain: 2, pan: 0.2, orbit: 2 } },
    ]);
    expect(diffDimensions(a, b)).toEqual([]);
  });
});

describe("W5 S8: sound control values through Strudel", () => {
  test("lpf 200 → 8000 changes sound", async () => {
    await pair(`${melody()}.lpf(200)`, `${melody()}.lpf(8000)`, ["sound"]);
  });
  test("room 0.1 → 0.9 changes sound", async () => {
    await pair(`${melody()}.room(0.1)`, `${melody()}.room(0.9)`, ["sound"]);
  });
  test("gain .5 → .8 changes nothing", async () => {
    await pair(`${melody()}.gain(.5)`, `${melody()}.gain(.8)`, []);
  });
  test("lpf 2000 → 2010 changes nothing", async () => {
    await pair(`${melody()}.lpf(2000)`, `${melody()}.lpf(2010)`, []);
  });
  test("per-cycle comparison does not fold away alternation", async () => {
    await pair('mel: note("<c4 [c4 c4]>").s("piano")', 'mel: note("<[c4 c4] c4>").s("piano")', ["rhythm"]);
  });
});
