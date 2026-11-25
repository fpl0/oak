// Pieces for the Wave 6 capstone tests and specs (not a spec): C6 "Modal Vamp", C7 "Chromatic Colour" and the
// single of CF-A, each as a learner would write it, with the variants that leave one rule open. The passing pieces
// follow the grader's golden tests (packages/grader/src/grade/capstone-wave6.test.ts) and the finale spec's
// reference single (content/specs/finale-reference.ts); wave6.test.ts grades every one with the real grader.

/** C6, passing: 16 bars in G Mixolydian over I–♭VII–IV–I, the ♭7 on beat 1 of most bars. */
export const C6_VAMP = `setcpm(100/4)

const chordsA = chord("<G F C G>").voicing()
const chordsB = chord("<G G F C>").voicing()
const melA = n("<[6 4 2 4] [6 ~ 4 2] [0 2 4 2] [6 4 2 0]>")
const melB = n("<[7 ~ 6 4] [6 ~ ~ ~] [6 4 2 4] [0 ~ ~ ~]>")

chords: arrange([8, chordsA], [8, chordsB]).s("piano")
mel: arrange([8, melA], [8, melB]).scale("G4:mixolydian").s("piano")
bass: note("<g2 f2 c2 g2>").s("sawtooth")
drums: s("bd ~ sd ~, hh*8")`;

/** C6, the colour note never on beat 1 or 3 (the rule's "twice or more on a strong beat" stays open). */
export const C6_NO_COLOUR = C6_VAMP.replace(
  '"<[6 4 2 4] [6 ~ 4 2] [0 2 4 2] [6 4 2 0]>"',
  '"<[4 2 0 2] [4 ~ 2 0] [0 2 4 2] [4 2 0 ~]>"',
)
  .replace('"<[7 ~ 6 4] [6 ~ ~ ~] [6 4 2 4] [0 ~ ~ ~]>"', '"<[7 ~ 4 2] [4 ~ ~ ~] [4 2 0 2] [0 ~ ~ ~]>"')
  .replace('chord("<G F C G>")', 'chord("<G G C G>")')
  .replace('chord("<G G F C>")', 'chord("<G G C C>")')
  .replace('"<g2 f2 c2 g2>"', '"<g2 g2 c2 g2>"');

/** C6, a vamp of eight bars (the first session's work): the mode is there, the length is not. */
export const C6_SHORT = `setcpm(100/4)

chords: chord("<G F C G>").voicing().s("piano")
mel: n("<[6 4 2 4] [6 ~ 4 2] [0 2 4 2] [6 4 2 0]>").scale("G4:mixolydian").s("piano")
bass: note("<g2 f2 c2 g2>").s("sawtooth")
drums: s("bd ~ sd ~, hh*8")`;

const c7 = (o: { verse?: string; chorus?: string; lift: boolean }) => `setcpm(100/4)

const chordsVerse = chord("${o.verse ?? "<C A7 Dm G C Am F G>"}").voicing()
const chordsChorus = chord("${o.chorus ?? "<F G C Am F G [Ab Bb] C>"}").voicing()
const chordsChorus2 = chord("<G A D Bm G A [Bb C] D>").voicing()
const melVerse = n("<[0 2 4 2] [4 2 1 ~] [1 3 5 3] [4 ~ ~ ~]>")
const melChorus = n("<[7 6 4 2] [4 ~ 2 ~] [4 5 7 5] [4 ~ ~ ~] [7 6 4 2] [4 ~ 2 ~] [4 ~ 3 ~] [2 ~ ~ ~]>")

chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsVerse], [8, ${o.lift ? "chordsChorus2" : "chordsChorus"}]).s("piano")
mel: arrange([8, melVerse], [8, melChorus], [8, melVerse], [8, melChorus]).scale("${o.lift ? "<C4:major!24 D4:major!8>" : "C4:major"}").s("piano")
drums: s("bd ~ sd ~, hh*8")`;

/** C7, passing: V7/ii to ii in the verse, ♭VI–♭VII–I at the end of the chorus, the last chorus up a whole step. */
export const C7_FULL = c7({ lift: true });
/** C7 after its second session: the colour chords and the tune, no key lift yet. */
export const C7_NO_LIFT = c7({ lift: false });
/** C7 with a secondary dominant that goes elsewhere (A7 to F). */
export const C7_UNRESOLVED = c7({ verse: "<C A7 F G C Am F G>", lift: true });
/** C7 with ♭VI and no ♭VII after it. */
export const C7_NO_RUN = c7({ chorus: "<F G C Am F G [Ab G] C>", lift: false });

/**
 * CF-A, passing (the finale spec's pop reference): C major, 100 BPM, 56 bars (2:14), verse chorus verse chorus
 * bridge chorus and a last chorus a whole step up; V7/vi to vi, the minor iv and ♭VI–♭VII, a 4–3 suspension, a bass
 * between the beats. It ends on purpose (Oak 2.0 W4): in the last chorus the tune leaves two bars before the end and
 * the chords one bar before (`…Chorus3`).
 */
export const CF_A_SINGLE = `setcpm(100/4)

const chordsVerse = chord("<C Am F G>").voicing()
const chordsChorus = chord("<F G E7 Am F G C C>").voicing()
const chordsBridge = chord("<Fm Fm C C Ab Bb G G>").voicing()
const chordsChorus2 = chord("<G A F#7 Bm G A D D>").voicing()
const bassVerse = n("<0 5 3 4>").struct("x ~ ~ x ~ x ~ ~")
const bassChorus = n("<3 4 2 5 3 4 0 0>").struct("x ~ ~ x ~ x ~ ~")
const bassBridge = n("<3 3 0 0 5b 6b 4 4>").struct("x ~ x ~")
const melVerse = n("<[4 ~ 4 2] [0 ~ ~ ~] [3 4 5 7] [7@2 6@2]>")
const melChorus = n("<[7 ~ 7 5] [8 ~ 8 ~] [9 8 6 4#] [5 ~ ~ ~] [7 ~ 7 5] [8 ~ 8 9] [7 ~ ~ ~] ~>")
const melBridge = n("<[5b ~ 4 3] [5b ~ 4 ~] [4 ~ 2 0] ~ [7 ~ 5b 4] [8 ~ 6b 3] [8 ~ ~ ~] [6 ~ ~ ~]>")
const chordsChorus3 = chordsChorus2.mask("<1!7 0>")
const melChorus3 = melChorus.mask("<1!6 0!2>")

kick: s("bd ~ bd ~").gain(.8)
snare: s("~ sd ~ sd").gain(.8)
hats: s("hh*8").gain(.4)
chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsVerse], [8, chordsChorus], [8, chordsBridge], [8, chordsChorus], [8, chordsChorus3]).s("piano").gain(.5).room(.3)
bass: arrange([8, bassVerse], [8, bassChorus], [8, bassVerse], [8, bassChorus], [8, bassBridge], [8, bassChorus], [8, bassChorus]).scale("<C2:major!48 D2:major!8>").s("ebass").lpf(700)
mel: arrange([8, melVerse], [8, melChorus], [8, melVerse], [8, melChorus], [8, melBridge], [8, melChorus], [8, melChorus3]).scale("<C4:major!48 D4:major!8>").s("piano").room(.25)`;

/** CF-A's plan with nothing in it yet (the first session): a verse, a chorus and a bridge at full length, no device. */
export const CF_A_PLAN = `setcpm(100/4)

const chordsVerse = chord("<C Am F G>").voicing()
const chordsChorus = chord("<F G C Am>").voicing()
const chordsBridge = chord("<Dm Dm Am Am F F G G>").voicing()
const bassVerse = n("<0 5 3 4>")
const bassChorus = n("<3 4 0 5>")
const bassBridge = n("<1 1 5 5 3 3 4 4>")

kick: s("bd ~ bd ~").gain(.8)
snare: s("~ sd ~ sd").gain(.8)
hats: s("hh*8").gain(.4)
chords: arrange([8, chordsVerse], [8, chordsChorus], [8, chordsVerse], [8, chordsChorus], [8, chordsBridge], [8, chordsChorus], [8, chordsChorus]).s("piano").gain(.5)
bass: arrange([8, bassVerse], [8, bassChorus], [8, bassVerse], [8, bassChorus], [8, bassBridge], [8, bassChorus], [8, bassChorus]).scale("C2:major").s("ebass").lpf(700)`;

/** CF-A without its bridge: verse chorus verse chorus chorus chorus chorus2 (the `bridge` line stays open). */
export const CF_A_NO_BRIDGE = CF_A_SINGLE.replaceAll("[8, chordsBridge]", "[8, chordsChorus]")
  .replaceAll("[8, bassBridge]", "[8, bassChorus]")
  .replaceAll("[8, melBridge]", "[8, melChorus]");

/** CF-A a chorus short: 48 bars at 100 BPM, 1:55 (the `duration` line stays open, 4 more bars asked). */
export const CF_A_SHORT = CF_A_SINGLE.replace(
  "[8, chordsBridge], [8, chordsChorus], [8, chordsChorus3]",
  "[8, chordsBridge], [8, chordsChorus3]",
)
  .replace("[8, bassBridge], [8, bassChorus], [8, bassChorus]", "[8, bassBridge], [8, bassChorus]")
  .replace("[8, melBridge], [8, melChorus], [8, melChorus3]", "[8, melBridge], [8, melChorus3]")
  .replaceAll("major!48", "major!40");

/**
 * CF-A on its way (session 2): no borrowed bridge and no key lift yet, so fewer than four devices (the `devices`
 * line stays open). With the lift added (`CF_A_LIFTED`) one more device counts.
 */
export const CF_A_PLAIN = CF_A_SINGLE.replace(
  'chord("<Fm Fm C C Ab Bb G G>")',
  'chord("<F F C C Am Dm G G>")',
)
  .replace('n("<3 3 0 0 5b 6b 4 4>")', 'n("<3 3 0 0 5 1 4 4>")')
  .replace(
    'n("<[5b ~ 4 3] [5b ~ 4 ~] [4 ~ 2 0] ~ [7 ~ 5b 4] [8 ~ 6b 3] [8 ~ ~ ~] [6 ~ ~ ~]>")',
    'n("<[5 ~ 4 3] [5 ~ 4 ~] [4 ~ 2 0] ~ [7 ~ 5 4] [8 ~ 6 3] [8 ~ ~ ~] [6 ~ ~ ~]>")',
  )
  .replace("[8, chordsChorus3]", "[8, chordsChorus]")
  .replaceAll("<C2:major!48 D2:major!8>", "C2:major")
  .replaceAll("<C4:major!48 D4:major!8>", "C4:major");
/** CF_A_PLAIN with its last chorus lifted a whole step (the modulation device). */
export const CF_A_LIFTED = CF_A_PLAIN.replace("[8, chordsChorus]).s(", "[8, chordsChorus3]).s(")
  .replace('.scale("C2:major")', '.scale("<C2:major!48 D2:major!8>")')
  .replace('.scale("C4:major")', '.scale("<C4:major!48 D4:major!8>")');
