import type { Oak2Pin } from "./types.ts";

// The line is the lesson's own four-bar line, written out here so the pins check the lesson's `pitches` against
// the evaluated notes (the alternate split must pass). `hocket` reads `pitches` per four-bar loop (X9 rule change).
const BARS = ["0 1 2 3 4 3 2 1", "0 1 2 3 5 4 2 1", "2 3 4 5 6 5 4 3", "6 5 3 2 1 2 6 4"];
const pattern = (keep: (i: number) => boolean) =>
  `<${BARS.map(
    (bar, b) =>
      `[${bar
        .split(" ")
        .map((note, s) => (keep(b * 8 + s) ? note : "~"))
        .join(" ")}]`,
  ).join(" ")}>`;
const line = (track: string, notes: string, sound: string) =>
  `${track}: n("${notes}").scale("A4:minor").s("${sound}").gain(.5)`;
const backing = [
  'bass: note("<a1 f1 c2 g1>").s("sawtooth").lpf(400)',
  'chords: n("<[0,2,4] [-2,0,2] [-5,-3,-1] [-1,1,3]>").scale("A3:minor").s("piano").gain(.5)',
];
const piece = (at: string, mel: string, vox: string, sound = "piano") =>
  `setcpm(90/4)\n\n${[
    ...(at === "S6" ? backing : []),
    line("mel", mel, "square"),
    line("vox", vox, sound),
  ].join("\n")}`;
const alternate = (i: number) => i % 2 === 0;
// mel takes 1 note, vox 2, mel 1, vox 3, and again: turns of 1, 2, 1 and 3 notes.
const irregular = (i: number) => [0, 3].includes(i % 7);
const crossing = (i: number) => Math.floor(i / 3) % 2 === 0;
const wholeBars = (i: number) => Math.floor(i / 8) % 2 === 0;
const halves = (i: number) => i % 8 < 4;
const full = pattern(() => true);
// Message start copied from content:check A2.L07 --verbose (S4 and the Make share the rule and its label).
const SAYS =
  "`mel` and `vox` play every note of the line once between them, each in its place and never together, on two different sounds, taking turns inside every bar: not yet.";

export default [
  ...["S4", "S6"].flatMap((at): Oak2Pin[] => [
    {
      owner: "A2.L07",
      at,
      name: "whole bars traded: mel takes bars 1 and 3, vox takes bars 2 and 4",
      kind: "book-miss",
      expect: "fail",
      says: SAYS,
      code: piece(
        at,
        pattern(wholeBars),
        pattern((i) => !wholeBars(i)),
      ),
    },
    {
      owner: "A2.L07",
      at,
      name: "both lines use square: the colour never changes",
      kind: "book-miss",
      expect: "fail",
      says: SAYS,
      code: piece(
        at,
        pattern(alternate),
        pattern((i) => !alternate(i)),
        "square",
      ),
    },
    {
      owner: "A2.L07",
      at,
      name: "vox doubles every mel note",
      kind: "book-miss",
      expect: "fail",
      says: SAYS,
      code: piece(at, full, full),
    },
    {
      owner: "A2.L07",
      at,
      name: "irregular turns of one, two, one and three notes",
      kind: "book-other-way",
      expect: "pass",
      code: piece(
        at,
        pattern(irregular),
        pattern((i) => !irregular(i)),
      ),
    },
    {
      owner: "A2.L07",
      at,
      name: "three-note turns cross bar lines",
      kind: "book-other-way",
      expect: "pass",
      code: piece(
        at,
        pattern(crossing),
        pattern((i) => !crossing(i)),
      ),
    },
    {
      owner: "A2.L07",
      at,
      name: "half-bar phrases traded every bar pass (Oak's call: turns inside the bar are not capped; open fidelity question)",
      kind: "extra",
      expect: "pass",
      code: piece(
        at,
        pattern(halves),
        pattern((i) => !halves(i)),
      ),
    },
    {
      owner: "A2.L07",
      at,
      name: "the given line split exactly in alternate notes",
      kind: "extra",
      expect: "pass",
      code: piece(
        at,
        pattern(alternate),
        pattern((i) => !alternate(i)),
      ),
    },
  ]),
  {
    owner: "A2.L07",
    at: "S6",
    name: "marimba is still locked at this lesson",
    kind: "extra",
    expect: "fail",
    code: piece(
      "S6",
      pattern(alternate),
      pattern((i) => !alternate(i)),
      "marimba",
    ),
  },
] satisfies Oak2Pin[];
