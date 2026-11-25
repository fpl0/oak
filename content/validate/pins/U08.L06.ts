// U08.L06 Kick and Bass, One Line: fidelity pins (docs/oak2/PLAN.md §2 rule 4). The book's point (DeSantis, "Bass Lines
// and Kick Drums as a Single Composite"): kick and bass take turns and are heard as one line. A bass that only looks
// moved (a token note, a note that starts in a gap and rings through the next kick, a loud note left on the kick) must
// fail; a composite reached another way (the kick moved into the bass's gaps, a house bass between four kicks, a pickup
// into each kick) must pass.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(96/4)\n\n";
const KICK = 'kick: s("bd ~ bd ~")';
const SNARE = 'snare: s("~ sd ~ sd")';
const HATS = 'hats: s("hh*8").gain(.5)';
const bass = (rhythm: string, tail = "") =>
  `bass: n("<0 4 5 3>").struct("${rhythm}").scale("C2:major").s("ebass").lpf(600)${tail}`;
const groove = (bassLine: string, kick = KICK, ...more: string[]) =>
  `${T}${[kick, SNARE, HATS, bassLine, ...more].join("\n")}`;
const make = (kick: string, bassLine: string) => `${T}${[kick, SNARE, bassLine].join("\n")}`;

const PINS: Oak2Pin[] = [
  // S4: move the bass into the gaps.
  {
    owner: "U08.L06",
    at: "S4",
    name: "a token bass: one note a bar between the kicks",
    kind: "book-miss",
    expect: "fail",
    says: "Every bass note starts between two kicks and stops before the next one: Add more bass notes",
    code: groove(bass("~ ~ x ~ ~ ~ ~ ~")),
  },
  {
    owner: "U08.L06",
    at: "S4",
    name: "moved off the kicks but held through them",
    kind: "book-miss",
    expect: "fail",
    says: "Every bass note starts between two kicks and stops before the next one: Shorten bass notes",
    code: groove(bass("~ x@4 ~ x@2")),
  },
  {
    owner: "U08.L06",
    at: "S4",
    name: "a quiet bass between the kicks and a loud one on them",
    kind: "book-miss",
    expect: "fail",
    code: groove(bass("x x x x x x x x", '.gain("[1 .02]*4")')),
  },
  {
    owner: "U08.L06",
    at: "S4",
    name: "a sixteenth pickup into each kick: the bass leads the kick in",
    kind: "book-other-way",
    expect: "pass",
    code: groove(bass("~ ~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x")),
  },
  {
    owner: "U08.L06",
    at: "S4",
    name: "every gap filled, each note stopping at the next kick",
    kind: "book-other-way",
    expect: "pass",
    code: groove(bass("~ x x x ~ x x x")),
  },
  // S5: shorten the bass so it stops before the kick.
  {
    owner: "U08.L06",
    at: "S5",
    name: "short notes moved back onto the kicks",
    kind: "book-miss",
    expect: "fail",
    says: "Every bass note starts between two kicks and stops before the next one: Move bass notes away",
    code: groove(bass("x@2 x x", ".clip(.5)")),
  },
  {
    owner: "U08.L06",
    at: "S5",
    name: "shortened by deleting the held note: one note a bar left",
    kind: "book-miss",
    expect: "fail",
    code: groove(bass("~ ~ ~ x")),
  },
  {
    owner: "U08.L06",
    at: "S5",
    name: "the held note struck twice as two short notes",
    kind: "book-other-way",
    expect: "pass",
    code: groove(bass("~ [x x] ~ x")),
  },
  // S6, the Make: take turns.
  {
    owner: "U08.L06",
    at: "S6",
    name: "a token bass under the kick",
    kind: "book-miss",
    expect: "fail",
    says: "The bass plays only between the kicks, at least two notes a bar: not yet",
    code: make(KICK, bass("~ x ~ ~")),
  },
  {
    owner: "U08.L06",
    at: "S6",
    name: "a quiet bass between the kicks and a loud one on them",
    kind: "book-miss",
    expect: "fail",
    code: make(KICK, bass("x x x x", '.gain("1 .02 1 .02")')),
  },
  {
    owner: "U08.L06",
    at: "S6",
    name: "a bass too quiet to hear, between the kicks only (34 dB under the kick)",
    kind: "book-miss",
    expect: "fail",
    code: make(KICK, bass("~ x ~ x", ".gain(.02)")),
  },
  {
    owner: "U08.L06",
    at: "S6",
    name: "the bass kept and the kick moved into its gaps",
    kind: "book-other-way",
    expect: "pass",
    code: make('kick: s("~ bd ~ bd")', bass("x ~ x ~")),
  },
  {
    owner: "U08.L06",
    at: "S6",
    name: "a house bass between four kicks",
    kind: "book-other-way",
    expect: "pass",
    code: make('kick: s("bd*4")', bass("[~ x]*4")),
  },
];

// X14 adversarial review (W2 Task 14): the confirmed findings, pinned after the rule or step was fixed.
const X14: Oak2Pin[] = [
  {
    owner: "U08.L06",
    at: "S6",
    name: "X14: no bass in bar 1, four notes in bar 2 (two a bar on average only)",
    kind: "extra",
    expect: "fail",
    code: 'setcpm(96/4)\n\nkick: s("bd ~ bd ~")\nsnare: s("~ sd ~ sd")\nbass: n("<0 4 5 3>").struct("<[~ ~ ~ ~] [~ [x x] ~ [x x]]>").scale("C2:major").s("ebass").lpf(600)\n',
  },
];

export default [...PINS, ...X14];
