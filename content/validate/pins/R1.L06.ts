// Fidelity pins for R1.L06 One Drummer, One Line (docs/oak2/PLAN.md §2 rule 4). The book's point: in linear
// drumming no two drums hit at once and no drum keeps time on its own, so the beat is one line handed from drum to
// drum; grouped 3+3+2, each group's start is marked by a change of drum or an accent. A piece that keeps the
// surface (every drum on its own line, no hit stacked) but leaves a hi-hat ticking every eighth misses it; toms and a
// ride in place of the hats, or accents written with `.velocity()` in place of role changes, get it another way.
import type { Oak2Pin } from "./types.ts";

const T = "setcpm(96/4)\n\n";
const BASS = 'bass: note("e2 ~ ~ ~ ~ ~ ~ ~ ~ ~ e2 ~ ~ ~ ~ ~").s("fingerbass").clip(.6)';
/** S4 and the Make's minimal answer keep R1.L06's kick (1, the "and" of 3) and snare (2, 4, the last sixteenth). */
const KICK = 'kick: s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~")';
const SNARE = 'snare: s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ sd")';
const s4 = (...lines: string[]) => `${T}${[KICK, SNARE, ...lines, BASS].join("\n")}`;
const make = (...lines: string[]) => `${T}${lines.join("\n")}`;

/** The kick and the snare moved off the eighths, so nothing lands together, and the hats still tick every eighth. */
const HATS_KEEP_TIME = [
  'kick: s("~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~")',
  'snare: s("~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ sd")',
  'hats: s("hh*8")',
];
/** Toms and a ride where the hats were: the ride on three places, two toms between, none of them on a steady grid. */
const TOMS_AND_RIDE = 'hats: s("~ ~ rd ~ ~ ~ lt mt rd ~ ~ ~ ~ ~ rd ~")';

/** S5: the S4 groove with hats filling the sixteenths: beat 1 is marked, the "and" of 2 and beat 4 are not. */
const s5 = (kick: string, snare: string, hats: string, tail = "") =>
  `${T}kick: s("${kick}")\nsnare: s("${snare}")\nhats: s("${hats}")${tail}`;

export default [
  // ---- S4: the hats move into the gaps -------------------------------------------------------------------------
  {
    owner: "R1.L06",
    at: "S4",
    name: "the kick and snare moved off the eighths, the hats still on every eighth: nothing stacked, a hat keeps time",
    kind: "book-miss",
    expect: "fail",
    says: "Break up the evenly spaced hits",
    code: make(...HATS_KEEP_TIME, BASS),
  },
  {
    owner: "R1.L06",
    at: "S4",
    name: "the hats moved into the gaps but one left with the kick on beat 1",
    kind: "book-miss",
    expect: "fail",
    says: "Let only one drum hit at a time",
    code: s4('hats: s("hh ~ hh ~ ~ ~ hh ~ hh ~ ~ ~ ~ ~ hh ~")'),
  },
  {
    owner: "R1.L06",
    at: "S4",
    name: "toms and a ride in place of the hi-hat, each in a gap",
    kind: "book-other-way",
    expect: "pass",
    code: s4(TOMS_AND_RIDE),
  },
  // ---- S5: 3+3+2 ----------------------------------------------------------------------------------------------
  {
    owner: "R1.L06",
    at: "S5",
    name: "a linear groove split 2+3+3: its marks fall on 1, beat 2 and the and of 3",
    kind: "book-miss",
    expect: "fail",
    says: "Mark each group start",
    code: s5(
      "bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~",
      "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~",
      "~ hh hh hh ~ hh hh hh hh hh ~ hh hh hh hh hh",
    ),
  },
  {
    owner: "R1.L06",
    at: "S5",
    name: "accents written with .velocity on the hats at the three group starts, no drum moved",
    kind: "book-other-way",
    expect: "pass",
    code: s5(
      "bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~",
      "~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~",
      "~ hh hh hh ~ hh hh hh hh hh ~ hh hh hh ~ hh",
      '.velocity("1 .5 .5 .5 1 .5 1 .5 .5 .5 1 .5 1 .5 1 .5")',
    ),
  },
  // ---- S6: the Make -------------------------------------------------------------------------------------------
  {
    owner: "R1.L06",
    at: "S6",
    name: "every drum on its own line and nothing stacked, but the hats still tick every eighth",
    kind: "book-miss",
    expect: "fail",
    says: "Break up the evenly spaced hits",
    code: make(...HATS_KEEP_TIME),
  },
  {
    owner: "R1.L06",
    at: "S6",
    name: "a linear groove with a kick and a hat together on beat 1",
    kind: "book-miss",
    expect: "fail",
    says: "Let only one drum hit at a time",
    code: make(KICK, SNARE, 'hats: s("hh ~ hh ~ ~ ~ hh ~ hh ~ ~ ~ ~ ~ hh ~")'),
  },
  {
    owner: "R1.L06",
    at: "S6",
    name: "no hi-hat at all: a ride and two toms take the hats' places",
    kind: "book-other-way",
    expect: "pass",
    code: make(KICK, SNARE, 'perc: s("~ ~ rd ~ ~ ~ lt mt rd ~ ~ ~ ~ ~ rd ~")'),
  },
] satisfies Oak2Pin[];
