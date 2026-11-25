// What to listen for in a "Just listen" block (the warm-up's ListenBlock, Practice's PassiveListen): one or two
// sentences per family saying where to put the ear and why it matters, so a block of examples is never just
// sounds playing. Written in the words the learner has by the family's unlock lesson (content/families.ts
// `unlock`): no term before the lesson that introduces it (content/terms.ts). Voice rules of AUTHORING §5.
import type { FamilyDef } from "@oak/api";
import { optionLabel } from "./model.ts";

const BY_FAMILY: Readonly<Record<string, string>> = {
  // Rhythm
  "fam.rhy.pulse":
    "Find the steady beat under the busier parts. The kick and the snare usually spell it out; the hats are decoration on top. Nod with it before you think about tapping.",
  "fam.rhy.echo":
    "Count the beats under each rhythm and notice where every hit lands: on a count, halfway between two counts, or held across one.",
  "fam.rhy.read":
    "Follow the written rhythm while it plays. Each note's shape tells you how long it lasts before the next sound: open heads last longer, flags make a note shorter.",
  "fam.rhy.count":
    "Count with the hats, out loud if you can: 1 and 2 and 3 and 4 and. Notice which word each clap falls on.",
  "fam.rhy.meter":
    "Find the strongest beat, then count until it comes round again. Two, three or four counts to a bar is what tells a march from a waltz from a rock groove.",
  "fam.rhy.dictation":
    "Keep the beat going in your head and place every hit against it: on a number, on an and, or between the two.",
  "fam.rhy.syncopation":
    "Keep the beat steady in your head. A push arrives just before a beat and takes its place, so the beat itself goes quiet. Feel the groove lean forward.",
  "fam.rhy.subdivision":
    "Keep the beat, then count the even notes inside one beat: two, three or four. Three makes the beat roll; four makes it busy and tight.",
  "fam.rhy.swing":
    "Listen to the notes between the beats. Straight, they split each beat in half. Swung, the first is long and the second short, a lilt. Notice how far the lilt goes.",
  "fam.rhy.clave":
    "The pattern runs over two bars: one busier with three hits, one calmer with two. Which bar comes first is the direction every other part lines up with.",
  "fam.rhy.odd-grouping":
    "Short beats gathered in twos and threes. Follow the accents and say the groups as they pass, 1-2 and 1-2-3: the group of three feels like a small stretch.",
  "fam.rhy.groove-lock":
    "Listen to the kick and the bass only. Locked, they start together and sound like one low hit. Otherwise the bass moves between the kicks, or arrives just before them.",
  "fam.rhy.polyrhythm":
    "Two even pulses at once that meet only on beat 1. Follow one, then switch to the other. The roll you feel is the two of them rubbing against each other.",
  // Pitch, degrees, melody, intervals
  "fam.pit.match":
    "One note at a time. Hum each one quietly before the next arrives: you are teaching your voice to find a note it hears. Higher or lower than the piano is fine.",
  "fam.pit.compare":
    "Two notes each time, and one question: did the second go up, down or stay put? Let your voice follow it under your breath.",
  "fam.pit.steps":
    "Two neighbouring notes. A half step is the smallest move on the keyboard and sounds close, almost a smear. A whole step sounds like a clear stride.",
  "fam.key.mode":
    "Find home first, then listen to the 3rd above it: bright for major, darker for minor. Other colours differ from these by one telltale note against home.",
  "fam.deg.tonic":
    "Every phrase leans on one note. Hum along and notice which note would let the music stop. That note is home.",
  "fam.deg.fet-major":
    "The key is set, then one note sounds. Feel what it does: 1, 3 and 5 can rest, the others lean toward a neighbour. Hum it, then hum your way home to 1.",
  "fam.deg.fet-minor":
    "A minor key is set, then one note. ♭3 and ♭6 give minor its shade; a raised 7 leans hard up into 1. Hum the note, then find your way home.",
  "fam.deg.fet-chromatic":
    "After the key is set, some notes come from outside it. They sound borrowed and want to move a half step: ♯4 up to 5, ♭7 down to 6.",
  "fam.deg.sing":
    "The key is set, then a degree is named. Hear it in your head before you sing: find 1, then walk up the scale in your mind to the target.",
  "fam.deg.resolve":
    "Each line starts away from home. Notice how every note pulls toward the next, and how the last one lands on 1.",
  "fam.mel.dictation":
    "Follow the shape first: up or down, step or leap. Then fix the first note against home; the rest follow from it.",
  "fam.mel.echo":
    "Take in the whole phrase before you sing: its shape, its first note against home, and where it ends.",
  "fam.mel.sight":
    "Follow the staff as it plays: a step moves to the next line or space, a leap skips over some. Try to hear each note just before it sounds.",
  "fam.mel.nct":
    "Listen for the notes that are not in the chord and how each one moves: walking between two chord notes, stepping away and back, or landing on the beat and leaning.",
  "fam.int.in-key":
    "Two degrees of the key. Feel the distance: a 2nd is a step, a 3rd skips one note, a 5th sounds open and bare, the octave sounds like the same note higher.",
  "fam.int.sing":
    "A note, then the interval above it. Hear the second note in your head before you sing it, and notice how wide it feels.",
  "fam.int.isolated":
    "No key around them, just the distance. Pin each interval to its colour: a minor 2nd grinds, a perfect 5th sounds open, the tritone hangs unresolved.",
  // Harmony and form
  "fam.chd.quality-triad":
    "Listen to the middle note against the bottom. Major sounds bright and settled, minor darker. Diminished sounds tight and restless, augmented stretched and unresolved.",
  "fam.chd.quality-7th":
    "Hear the triad first, then the note on top. A major 7th sits just under the next root and shimmers; a dominant 7th leans toward home; a diminished 7th is all tension.",
  "fam.chd.inversion":
    "Listen only to the lowest note. With the root at the bottom a chord sounds solid; with the 3rd, lighter and on the move; with the 5th, unsettled.",
  "fam.har.motion":
    "Follow the top note and the bass from chord to chord. Moving together by the same amount each time, the chords are parallel; the top note staying close while the bass moves, they are voice-led.",
  "fam.har.function":
    "Every chord has a job. Home sounds at rest, away moves off it, and tension wants to come back. Listen to how much each chord wants to move.",
  "fam.har.cadence":
    "Listen to the last two chords of each phrase. Landing on I sounds final; stopping on V sounds like a question; a turn elsewhere sounds like a surprise.",
  "fam.har.bass":
    "Let the top go and hum the lowest notes. Each one is a degree of the key: find 1 first, then measure the others from it.",
  "fam.har.schema":
    "Each loop has its own bass shape and its own mood. Hum the bass line under each one: it usually gives the loop away.",
  "fam.har.progression":
    "Take it in layers: the bass first, then whether each chord is bright or dark, and only then the numerals.",
  "fam.har.chromatic":
    "One chord brings in a note from outside the key. Notice where that note pulls, usually a half step into the next chord.",
  "fam.har.modulation":
    "Hum home at the start, then again at the end. Is it still the same note, or has the ground moved under you?",
  "fam.frm.sections":
    "Listen for what comes back. A section that returns keeps its letter; something new gets the next one. Count the bars of each.",
  "fam.frm.blues":
    "Twelve bars in three lines of four. Listen for the move to IV in bar 5, or already in bar 2, and for V in bar 9.",
  // Jazz
  "fam.jzz.ii-v":
    "Listen for two chords that pull and a third that arrives. Where the ii–V–I lands is home, for now.",
  "fam.jzz.guide":
    "Follow only the 3rds and 7ths. From chord to chord they move by a step or not at all: a quiet line inside the harmony.",
  "fam.jzz.extension":
    "The same chord with one colour added on top. Listen above the 7th: a 9th sounds open, a ♭9 tense, a 13th warm.",
  "fam.jzz.subs":
    "The same arrival, reached by another road. Follow the bass into the last chord: down a 5th, down a half step, or up a whole step.",
  // Sound and arrangement
  "fam.snd.params":
    "The notes stay the same; one thing about the sound changes. Is it brighter or darker, does it ring, does each note start or end differently, or is there space around it?",
  "fam.snd.roles":
    "Pick out who plays what: the tune, the harmony, the low end. Where two parts sit at the same height, they blur into each other.",
};

const BY_DOMAIN: Readonly<Record<string, string>> = {
  rhythm: "Keep the beat in your head and notice where each sound lands against it.",
  pitch: "Hum along under your breath and notice where each note sits against home.",
  harmony: "Listen to the lowest notes first, then to the colour of the chords above them.",
};

/** What to listen for in a family's examples; never empty. */
export function listenFor(def: Pick<FamilyDef, "id" | "domain"> | undefined): string {
  if (!def) return "Hear each one through and notice what changes from one to the next.";
  return (
    BY_FAMILY[def.id] ??
    BY_DOMAIN[def.domain] ??
    "Hear each one through and notice what changes from one to the next."
  );
}

/** What one example of a family is called when every example is the same kind ("Note 3", not "Example 3"). */
export function exampleNoun(familyId: string): string {
  return familyId === "fam.pit.match" ? "Note" : "Example";
}

/**
 * The lines of a "Just listen" block, one per example. Captions are category ids ("T", "PD", "D"); the family's
 * generator turns them into the learner's words (Tonic, Predominant, Dominant), as the answer buttons do. One
 * category heard several times ("match" × 8) says nothing per line, so those examples are numbered instead.
 */
export function listenExampleLines(
  captions: readonly string[],
  familyId: string,
  generator?: string,
): string[] {
  const same = captions.length > 1 && captions.every((c) => c === captions[0]);
  return captions.map((c, i) =>
    same ? `${exampleNoun(familyId)} ${i + 1}` : `${i + 1}. ${optionLabel(c, generator)}`,
  );
}
