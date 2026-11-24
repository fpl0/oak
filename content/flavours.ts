// Band-layer flavour kits (contracts §5.10). A flavour selects the Band code and the starter sounds only;
// it never changes a rubric (rule 7). Starter swaps follow the unlock table (rule 8): content CI checks
// every flavour's starter sounds against content/toolbox.ts. The listening pass fixes the exact numbers.
import {
  defineFlavour,
  type FlavourId,
  type FlavourKit,
  type LessonId,
  type SoundId,
} from "@oak/content-kit";

export const flavours: readonly FlavourKit[] = [
  defineFlavour({
    id: "flavour.pop",
    title: "Pop",
    // The default (unbanked) kit: its kick stands for the kit.
    drums: "snd.drum.bd",
    bass: "snd.ebass",
    chords: "snd.piano",
    lead: "snd.piano",
    chordDepth: "triad",
    production: {
      room: 0.25,
      bassLpf: 800,
      humanizeVelocity: 0.08,
      pan: { drums: 0.5, bass: 0.5, chords: 0.42, lead: 0.58 },
    },
  }),
  defineFlavour({
    id: "flavour.jazz-soul",
    title: "Jazz-soul",
    drums: "snd.jazzkit",
    bass: "snd.upright",
    chords: "snd.rhodes",
    lead: "snd.vibes",
    chordDepth: "seventh",
    swing: { subdivision: 8, amount: 1 / 3 },
    production: {
      room: 0.35,
      bassLpf: 900,
      humanizeVelocity: 0.08,
      pan: { drums: 0.5, bass: 0.5, chords: 0.4, lead: 0.6 },
    },
  }),
  defineFlavour({
    id: "flavour.indie",
    title: "Indie",
    drums: "snd.bank.LinnDrum",
    bass: "snd.ebass",
    chords: "snd.cleangtr",
    lead: "snd.acgtr",
    chordDepth: "triad",
    production: {
      room: 0.3,
      bassLpf: 750,
      humanizeVelocity: 0.08,
      pan: { drums: 0.5, bass: 0.5, chords: 0.38, lead: 0.62 },
    },
  }),
  defineFlavour({
    id: "flavour.funk",
    title: "Funk",
    drums: "snd.bank.RolandTR808",
    bass: "snd.fingerbass",
    chords: "snd.clav",
    lead: "snd.organ",
    chordDepth: "seventh",
    production: {
      room: 0.2,
      bassLpf: 850,
      humanizeVelocity: 0.08,
      pan: { drums: 0.5, bass: 0.5, chords: 0.42, lead: 0.58 },
    },
  }),
  // Electronic (sound pack v4, docs/design/samples/proposal.md §4): Oak's synthesised 909-style machine, a sawtooth
  // bass (an acid line under a resonant ladder filter whose envelope opens above the corner, or a sine sub in the
  // softer sections), sawtooth stabs and pads for the chords, a square pluck for the lead. Dry and club-like: the
  // least room of the kits, the bass corner low so the filter envelope has somewhere to open.
  defineFlavour({
    id: "flavour.electronic",
    title: "Electronic",
    drums: "snd.oak909",
    bass: "snd.wave.sawtooth",
    chords: "snd.wave.sawtooth",
    lead: "snd.wave.square",
    chordDepth: "seventh",
    production: {
      room: 0.2,
      bassLpf: 700,
      humanizeVelocity: 0.08,
      pan: { drums: 0.5, bass: 0.5, chords: 0.4, lead: 0.6 },
    },
  }),
];
export default flavours;

/** What each kit's harmony and feel do over the course (contracts §5.10 table), and when it ships. */
export const FLAVOUR_RULES: Readonly<
  Record<
    FlavourId,
    {
      /** The wave a kit shipped in: W2 (pop, jazz-soul), W5 (indie, funk), S1 (electronic, with the unit songs). */
      ships: "W2" | "W5" | "S1";
      /** Seventh chords from this lesson on; triads before. Absent: always `chordDepth`. */
      seventhsFrom?: LessonId;
      /** Swing (or the 16th feel) from this lesson on; straight before. */
      feelFrom?: LessonId;
      feel: "straight" | "swing-8" | "16th";
    }
  >
> = {
  "flavour.pop": { ships: "W2", feel: "straight" },
  "flavour.jazz-soul": { ships: "W2", seventhsFrom: "U03.L01", feelFrom: "U03.L01", feel: "swing-8" },
  "flavour.indie": { ships: "W5", feel: "straight" },
  "flavour.funk": { ships: "W5", seventhsFrom: "U06.L01", feel: "16th" },
  // Sevenths (sixth chords on I and IV, as funk plays them) from U06.L10, "Seventh Colour"; straight throughout.
  "flavour.electronic": { ships: "S1", seventhsFrom: "U06.L10", feel: "straight" },
};

/** Production ranges every kit must sit in (contracts §5.10). content/validate checks the kits against them. */
export const PRODUCTION_RANGES = { room: [0.2, 0.35], bassLpf: [700, 900], humanizeVelocity: 0.08 } as const;

export const flavourById: ReadonlyMap<string, FlavourKit> = new Map(flavours.map((f) => [f.id, f] as const));

/** The sounds a flavour would swap into learner-editable code, by role. */
export function flavourSounds(id: FlavourId): Record<"drums" | "bass" | "chords" | "lead", SoundId> {
  const f = flavourById.get(id);
  if (!f) throw new Error(`unknown flavour ${id}`);
  return { drums: f.drums, bass: f.bass, chords: f.chords, lead: f.lead };
}
