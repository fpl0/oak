// The revised course map (contracts §2): every unit, lesson, checkpoint and capstone, the track gates of
// §4.3 and the default linear order of §2.5. Transcribed from the tables of docs/design/contracts.md;
// content/validate/contracts-sync.test.ts re-parses that document and fails on any drift.
// Unlocks are not repeated here: content/toolbox.ts is the only unlock table.
import {
  type CapstoneId,
  type CheckpointId,
  defineUnit,
  type LessonId,
  type LessonMeta,
  type SessionId,
  type SkillId,
  type SyllabusDef,
  type TrackDef,
  type TrackGate,
  type TrackId,
  type UnitDef,
  type UnitId,
} from "@oak/content-kit";
import { capstoneMetas } from "./capstones.ts";
import { checkpointMetas } from "./checkpoints.ts";

const skills = (list: string): SkillId[] => (list === "" ? [] : (list.split(" ") as SkillId[]));
/** One row of a §2.3 or §2.6 table: ID, title, objective, introduces, practises. */
const lesson = (
  id: LessonId,
  title: string,
  objective: string,
  introduces = "",
  practises = "",
  optional = false,
): LessonMeta => ({
  id,
  title,
  objective,
  introduces: skills(introduces),
  practises: skills(practises),
  ...(optional ? { optional } : {}),
});
/** Wave 5: an optional side lesson (A1.L01–L04, contracts §2.6), offered from its track gate on. */
const side = (meta: LessonMeta): LessonMeta => ({ ...meta, optional: true, side: true });
const unit = (
  id: UnitId,
  title: string,
  track: "core" | TrackId,
  checkpoint: CheckpointId | null,
  lessons: LessonMeta[],
): UnitDef => defineUnit({ id, title, track, lessons, ...(checkpoint ? { checkpoint } : {}) });

export const units: UnitDef[] = [
  unit("U00", "Onboarding", "core", null, [
    lesson(
      "U00.L01",
      "Hello, Loop",
      "~8 min. Start sound, hear a four-layer loop build up, change one number and hear it land, paste the API key in the app (skippable), meet the tutor, save Sketch 001.",
      "D01",
    ),
    lesson(
      "U00.L02",
      "Set Up & First Sing",
      "~12 min. Headphones (with AirPods guidance), mic, noise and bleed, vocal range, tap and sing latency; a lenient first sung tonic (the tonic plays first; any sustained pitch within ±100¢ after octave folding passes).",
      "V01",
    ),
  ]),
  unit("U01", "Pulse & Rhythm I", "core", "U01.CP", [
    lesson(
      "U01.L01",
      "Heartbeat",
      "Feel pulse and beat, set a tempo with `setcpm(bpm/4)`, learn that 1 cycle = 1 bar, write a one-line beat.",
      "R01 R02 R03 E01",
    ),
    lesson(
      "U01.L02",
      "Count to Four",
      "Find the downbeat, count 1-2-3-4, use rests as rhythm.",
      "R06",
      "R03",
    ),
    lesson(
      "U01.L03",
      "Backbeat",
      "Kick on 1 and 3, snare on 2 and 4; layer parts as one labelled line per drum (`kick:` `snare:` `hats:`).",
      "R04",
    ),
    lesson("U01.L04", "Two per Beat", "Eighth-note subdivision and hat patterns with `[ ]`.", "R05"),
    lesson(
      "U01.L05",
      "Seeing Rhythm",
      "Whole, half, quarter and eighth notes and rests on the percussion staff; lengths with `@` and `_`.",
      "N01",
      "R06",
    ),
    lesson("U01.L06", "Sixteenths & 1-e-&-a", "Four per beat, spoken counting, tom fills.", "R07"),
    lesson(
      "U01.L07",
      "Four-Bar Phrases & Fills",
      "Bar-level variation with `< >`; a fill in bar 4.",
      "",
      "R04 R07",
    ),
    lesson(
      "U01.L08",
      "Three to a Bar",
      '3/4 waltz feel with `setcpm(bpm/3)`; meter as "beats per bar", with a 2/4 march (`setcpm(bpm/2)`) heard once as the contrast.',
      "R08",
    ),
    lesson(
      "U01.L09",
      "Copy That Groove",
      "Transcribe generated drum loops (ladder L1); half-time vs double-time with `.slow()`/`.fast()`; hear straight vs swung hats as a feel preview (swing stays locked).",
      "",
      "E01 R05",
    ),
  ]),
  unit("U02", "Pitch, Keyboard & Treble Staff", "core", "U02.CP", [
    lesson(
      "U02.L01",
      "High & Low",
      'Pitch and octaves; `note("c3 c4 c5").s("piano")` (the letters are explained in L02); higher/lower by ear.',
      "P01 E02",
    ),
    lesson("U02.L02", "The White Keys", "Letter names, octave numbers, C4 = 60.", "P02 P05"),
    lesson("U02.L03", "Half & Whole Steps", "Semitone and tone, sharps and flats, enharmonics.", "P03 P04"),
    lesson("U02.L04", "The Treble Staff", "Lines, spaces, ledger lines; staff ↔ code ↔ keys.", "N02"),
    lesson(
      "U02.L05",
      "Moving Melodies",
      "MIDI numbers, transposing by semitones, the chromatic scale.",
      "P06",
      "P05",
    ),
    lesson("U02.L06", "Tones & Timbres", "The same tune on different sounds.", "", "D01"),
    lesson("U02.L07", "Sing It Back", "Pitch matching, higher/lower, 2–3-note echoes.", "", "V01 E02"),
    lesson(
      "U02.L08",
      "Playing from the Page",
      "Staff → code on adult trad/PD tunes (Ode to Joy theme; When the Saints); a first room reverb.",
      "D05",
      "N02 N01",
    ),
  ]),
  unit("U03", "Major Scale & Degrees", "core", "U03.CP", [
    lesson(
      "U03.L01",
      "Home & the Major Scale",
      "Tonic as home, W-W-H-W-W-W-H, spelling a scale with each letter once, the scale on the staff; note names only, no `n()` yet.",
      "S01 E03",
    ),
    lesson(
      "U03.L02",
      "Degrees in Code",
      '`n` = degree − 1 with `.scale("C4:major")`; key as one parameter; first FET drill (1 vs 5, then 1-3-5); sing on numbers.',
      "S02 E04 V02",
    ),
    lesson(
      "U03.L03",
      "Restless Neighbours",
      "Degrees 2 and 4 and their pull home; negative and ≥7 `n` to reach below and above the tonic.",
      "E05 V03",
      "S02",
    ),
    lesson("U03.L04", "Leading Tone & Six", "Degrees 6 and 7, the 7→1 pull; the `..` range.", "", "E05"),
    lesson("U03.L05", "Same Song, Any Key", 'Key as a parameter; patterned `.scale("<…>")`.', "S03"),
    lesson(
      "U03.L06",
      "Sharp Keys",
      "G D A E B F♯ and the order of sharps; key signatures on the staff.",
      "S04 N03",
    ),
    lesson("U03.L07", "Flat Keys & the Circle", "F B♭ E♭ A♭ D♭ and the circle of fifths.", "", "S04 N03"),
    lesson("U03.L08", "Solfège", "Movable do; sing degree patterns on syllables.", "", "V03"),
    lesson(
      "U03.L09",
      "Tunes by Number",
      "Write trad tunes as degrees and sight-sing them; phrasing with `.legato()`.",
      "M01 V04",
    ),
    lesson(
      "U03.L10",
      "By-Ear Transcription I",
      "Fragments, then adult trad/PD tunes by ear (Auld Lang Syne, Swing Low, Michael Row the Boat Ashore).",
      "E07",
    ),
    lesson("U03.L11", "Melody Workshop", "An 8-bar melody that cadences on 1.", "", "M01 S03"),
  ]),
  unit("U04", "Intervals (compressed)", "core", "U04.CP", [
    lesson(
      "U04.L01",
      "Steps Apart",
      "Intervals inside a key: distance between degrees (2nd, 3rd … octave); two-voice riffs over the Band.",
      "I01 E06",
    ),
    lesson(
      "U04.L02",
      "Major, Minor, Perfect",
      'Interval quality from semitones; interval strings in `.transpose("3M")`.',
      "I02",
    ),
    lesson(
      "U04.L03",
      "Together Now",
      "Harmonic intervals, consonance and dissonance, the tritone; `,` inside mini-notation.",
      "I05 I03",
    ),
    lesson(
      "U04.L04",
      "Interval Ear Lab",
      "In-key pairs ascending, descending and harmonic, with passive-listen blocks.",
      "",
      "E06",
    ),
  ]),
  unit("U05", "Triads", "core", "U05.CP", [
    lesson("U05.L01", "Stacking Thirds", '`n("[0,2,4]")`: root, 3rd, 5th.', "C01"),
    lesson("U05.L02", "Major & Minor", "Triad quality by intervals and by ear.", "C02 E08"),
    lesson(
      "U05.L03",
      "Diminished & Augmented",
      "The two unstable triads; augmented and diminished interval names.",
      "C03",
      "E08 I03",
    ),
    lesson(
      "U05.L04",
      "Arpeggios",
      "`.arp()` on hand-stacked triads: a chord played one note at a time.",
      "",
      "C01",
    ),
    // Split out of U05.L04 in contracts 1.6 and taught directly after it (the rows are in teaching order, so
    // U05.L09 sits before U05.L05). A learner who completed U05.L04 before the split has had this lesson.
    {
      ...lesson(
        "U05.L09",
        "Chord Names",
        "Lead-sheet symbols C Cm C° C+ and their code spellings `C Cm Co Caug`, read and typed as answers and seen in read-only `preview` examples (`chord()` stays locked until L08).",
        "N05",
      ),
      splitFrom: "U05.L04",
    },
    lesson(
      "U05.L05",
      "Inversions",
      "First and second inversion; slash-chord names; the lowest note decides.",
      "C04",
    ),
    lesson("U05.L06", "Bass Clef & Grand Staff", "Reading the low register.", "N04"),
    lesson(
      "U05.L07",
      "Voice Leading by Hand",
      "Voice I–IV–V–I with note lists: common tones, nearest motion. Holds the gate check for `voicing()`.",
      "C05",
    ),
    lesson(
      "U05.L08",
      "Let Strudel Voice It",
      "Compare `chord().voicing()` with your hand voicing (unlocks only once the U05.L07 gate check is passed at ≥0.9).",
      "",
      "C05 N05",
    ),
  ]),
  unit("U06", "Diatonic Harmony", "core", "U06.CP", [
    lesson("U06.L01", "The Seven Chords", "Diatonic triads by stacking degrees on every step.", "H01"),
    lesson("U06.L02", "Roman Numerals", "I ii iii IV V vi vii° and the quality pattern.", "N06", "H01"),
    lesson("U06.L03", "Home, Away, Tension", "Tonic, predominant, dominant and the phrase model.", "H02"),
    lesson(
      "U06.L04",
      "Endings",
      "Cadences: authentic (perfect and imperfect) and half. (Former L04 and L05 merged.)",
      "H03",
    ),
    lesson("U06.L05", "Hear the Bass First", "Bass-degree dictation; sing the roots.", "E09 V05"),
    lesson(
      "U06.L06",
      "The Four-Chord Schema",
      "I–V–vi–IV and its rotations; the deceptive move V→vi.",
      "H04",
      "H03",
    ),
    lesson(
      "U06.L07",
      "Doo-Wop & Three-Chord Rock",
      "I–vi–IV–V and I–IV–V; the plagal ending IV→I.",
      "H05",
      "H03",
    ),
    lesson("U06.L08", "Harmonic Rhythm", "One vs two chords per bar.", "H06"),
    lesson("U06.L09", "Chord Dictation Workshop", "Bass → quality → Roman numeral on loops.", "", "E09"),
    lesson(
      "U06.L10",
      "Seventh Colour (preview)",
      'Stack one more third, `n("[0,2,4,6]")`: an Imaj7–vi7–ii7–V7 neo-soul loop. Formal seventh-chord theory waits for U12.',
      "C10",
    ),
    lesson(
      "U06.L11",
      "Slash Chords & Walking Down",
      "The descending bass I–V⁶–vi (C–G/B–Am), line cliché, pedal; the bass track decides the inversion.",
      "H15",
      "C04",
    ),
    lesson("U06.L12", "Comping Patterns", "Chord rhythms locked to the drums with `.struct()`.", "", "H06"),
    // Oak 2.0 W2 (contracts 2.2): new lessons are placed by array position, as U05.L09 is.
    lesson(
      "U06.L13",
      "Parallel Chords",
      "One chord shape moved by half steps: the deep-house colour that leaves the key on purpose.",
      "",
      "H01 H06",
    ),
  ]),
  unit("U07", "Melody", "core", "U07.CP", [
    lesson("U07.L01", "Shape", "Contour, range, steps vs leaps.", "", "M01"),
    lesson("U07.L02", "Motif & Variation", "Repetition, sequence, retrograde.", "M02"),
    // Oak 2.0 W2 (contracts 2.2): taught directly after U07.L02.
    lesson(
      "U07.L11",
      "Turn It Around",
      "Transform a motif: upside down, backwards with its rhythm kept, rotated, moved in time.",
      "",
      "M02",
    ),
    lesson("U07.L03", "Landing on Chord Tones", "Chord tones on strong beats.", "M03"),
    lesson(
      "U07.L04",
      "Passing & Neighbour Tones",
      "Stepwise non-chord tones between and around chord tones.",
      "M04",
    ),
    lesson("U07.L05", "Leaning & Holding", "Appoggiatura; 4–3 and 9–8 suspensions.", "M05"),
    lesson("U07.L06", "Question & Answer", "Antecedent and consequent phrases.", "M06 F01"),
    lesson("U07.L07", "Call & Response", "Echoes and answers between parts.", "M07"),
    lesson(
      "U07.L08",
      "Pickups",
      "Anacrusis: leading rests in bar 0, `pickup` metadata, the pickup bar in notation.",
      "M10",
    ),
    lesson(
      "U07.L09",
      "Reading Lead Sheets",
      "Amazing Grace (New Britain): play and sing from a lead sheet in 3/4 with a pickup.",
      "N07",
      "V04 M10",
    ),
    lesson("U07.L10", "Hook Lab", "Hooks and controlled chance.", "M09"),
  ]),
  unit("U08", "Bass Lines", "core", null, [
    lesson("U08.L01", "Roots Down Low", "Root bass lines from the chords.", "B01"),
    lesson("U08.L02", "Root–Five–Octave", "The three-note bass vocabulary.", "B02"),
    lesson("U08.L03", "Walking Up to It", "Diatonic and chromatic approach tones.", "B03"),
    lesson(
      "U08.L04",
      "Lock with the Kick",
      "Shared rhythm and syncopated bass; `const` pattern variables.",
      "B04",
    ),
    // Oak 2.0 W2 (contracts 2.2): taught directly after U08.L04.
    lesson(
      "U08.L06",
      "Kick and Bass, One Line",
      "The bass plays between the kicks, so kick and bass sound as one line.",
      "",
      "B04 B01",
    ),
    lesson(
      "U08.L05",
      "Bass Dictation & Tone",
      "Transcribe bass lines; shape the bass sound.",
      "",
      "B01 V05 E09",
    ),
  ]),
  unit("U09", "Form", "core", "U09.CP", [
    lesson("U09.L01", "Phrases Make Sections", "4- and 8-bar units, hypermeter.", "", "F01"),
    lesson(
      "U09.L02",
      "Verse & Chorus",
      "Contrast between sections; one `arrange()` per labelled track.",
      "F02",
    ),
    lesson("U09.L03", "AABA & Strophic", "Two more song forms.", "F03"),
    lesson("U09.L04", "The Energy Curve", "Builds and drops with signals.", "F05"),
    lesson("U09.L05", "Arranging in Code", "Layer entries and exits with `.mask()`.", "F06"),
    // Oak 2.0 W2 (contracts 2.2).
    lesson(
      "U09.L06",
      "Endings",
      "End on purpose: parts leave in turn, a loop shrinks, a fade, a final hit or a cadence.",
      "",
      "F06 F05",
    ),
    lesson(
      "U09.L07",
      "Carve It",
      "Start from everything everywhere and only delete; leave a seam and one moment heard once.",
      "",
      "F06 F05",
    ),
  ]),
  unit("U10", "Minor", "core", "U10.CP", [
    lesson("U10.L01", "The Dark Twin", "Natural minor, ♭3 ♭6 ♭7, do-based minor solfège.", "S05"),
    lesson("U10.L02", "Relative & Parallel", "Two ways a major key has a minor twin.", "S06"),
    lesson("U10.L03", "Hearing Minor", "Minor-degree drills.", "E10"),
    lesson("U10.L04", "Minor-Key Chords", "i ii° III iv v VI VII.", "H07"),
    lesson("U10.L05", "The Aeolian Loop", "i–VI–III–VII vs vi–IV–I–V.", "H08"),
    lesson("U10.L06", "Raise the Seventh", "Harmonic minor and the major V.", "S07 H09"),
    lesson("U10.L07", "The Andalusian Cadence", "i–VII–VI–V.", "", "H09"),
    lesson("U10.L08", "Melodic Minor", "Raised 6 and 7 on the way up.", "S08"),
    lesson(
      "U10.L09",
      "Minor Melodies",
      "Wayfaring Stranger (trad) and Go Down Moses (spiritual): transcribe and sight-sing.",
      "",
      "E07 V04",
    ),
  ]),
  unit("U11", "Pentatonic & Blues", "core", "U11.CP", [
    lesson("U11.L01", "Five Notes, No Wrong Ones", "Major pentatonic.", "S09"),
    lesson("U11.L02", "The Minor Pentatonic Riff", "Minor pentatonic and a first riff.", "S10"),
    lesson("U11.L03", "Blue Notes", "The blues scale.", "S11"),
    lesson("U11.L04", "The Dominant Seventh", "The `C7` sound and symbol.", "C06"),
    lesson("U11.L05", "Twelve Bars", "The 12-bar form.", "H10 F04"),
    lesson("U11.L06", "Quick Change & Turnaround", "Two standard variations.", "", "H10"),
    lesson("U11.L07", "Shuffle", "Swung eighths, `swingBy(1/3, 4)`, swing notation.", "R13"),
    lesson(
      "U11.L08",
      "Riffs & Response",
      "Riff writing and answering; a St. Louis Blues (1914) fragment.",
      "M08",
      "M07",
    ),
  ]),
  unit("U12", "Seventh Chords", "core", null, [
    lesson("U12.L01", "Major 7 & Minor 7", "`C^7` and `Cm7`.", "C07"),
    lesson("U12.L02", "Dominant vs Major 7", "Hear the difference a half step makes.", "E11"),
    lesson("U12.L03", "Half-Diminished & Diminished 7", "`Cm7b5` and `Co7`.", "", "C07"),
    lesson("U12.L04", "Diatonic Sevenths in Major", "Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7.", "C08"),
    lesson(
      "U12.L05",
      "Sevenths in Minor & Guide-Tone Preview",
      "Minor-key sevenths; 3rds and 7ths as the thread.",
      "",
      "C08",
    ),
    lesson(
      "U12.L06",
      "Seventh Ear Lab & Left-Hand Voicings",
      'Quality by ear; `dict("lefthand")`; interval inversion and compound intervals (moved here from U04).',
      "I04",
      "E11",
    ),
  ]),
  unit("U13", "Rhythm II", "core", "U13.CP", [
    lesson(
      "U13.L01",
      "Pushes & Anticipations",
      "Syncopation by arriving early; `.early()` and `.late()`.",
      "R10",
    ),
    lesson(
      "U13.L02",
      "Sixteenth Grooves & Ghost Notes",
      "Dynamics inside the groove with `.velocity()`.",
      "",
      "R10",
    ),
    lesson("U13.L03", "Ties Across the Beat", "Ties and dotted rhythms; notating syncopation.", "R09 N08"),
    lesson("U13.L04", "Compound Meter", "6/8 and 12/8 with the dotted-quarter beat.", "R11"),
    lesson("U13.L05", "Triplets", "Tuplets in simple meter; `.ply()`.", "R12 N09"),
    lesson("U13.L06", "Rhythm Dictation II", "Syncopated, swung and compound rhythms by ear.", "E14"),
  ]),
  unit("U14", "Modes", "core", "U14.CP", [
    lesson("U14.L01", "Modes as Colours", "The characteristic tone; Mixolydian ♭7.", "S12"),
    lesson("U14.L02", "Mixolydian Rock", "I–♭VII–IV; Old Joe Clark.", "H11"),
    lesson("U14.L03", "Dorian ♮6", "i–IV; Drunken Sailor.", "", "S12 H11"),
    lesson("U14.L04", "Lydian Glow", "♯4 and I–II.", "S13"),
    lesson("U14.L05", "Phrygian Edge", "♭2 and i–♭II.", "", "S13"),
    lesson("U14.L06", "Mode Lab", "Mode identification and a modal vamp.", "", "E10"),
  ]),
  unit("U15", "Secondary Dominants", "core", null, [
    lesson(
      "U15.L01",
      "Chromatic Degrees",
      '♯4 ♭7 ♯5 ♯1 ♭2 ♭3 ♭6 by ear and in code (`n("3#")` = ♯4, `n("6b")` = ♭7); chromatic solfège.',
      "E12a",
      "P06",
    ),
    lesson("U15.L02", "Five of Five", "V/V and V7/V.", "H12"),
    lesson("U15.L03", "Visiting Other Chords", "V/vi, V/ii, V7/IV.", "", "H12"),
    lesson("U15.L04", "Tonicization", "Applied vii°.", "", "H12"),
    lesson("U15.L05", "Dominant Chains", "III7–VI7–II7–V7 (Five Foot Two, Sweet Georgia Brown).", "", "H12"),
    lesson("U15.L06", "Hearing Secondaries", "Locate and name applied dominants by ear.", "", "H12 E12a"),
  ]),
  unit("U16", "Borrowed Chords", "core", null, [
    lesson("U16.L01", "The Sad IV", "iv in major.", "H13"),
    lesson("U16.L02", "♭VI & ♭VII", "♭VI–♭VII–I.", "", "H13"),
    lesson("U16.L03", "♭III & Minor Plagal", "More colours from the parallel minor.", "", "H13"),
    lesson("U16.L04", "Picardy & Dorian IV", "Borrowing in minor keys.", "", "H13"),
    lesson(
      "U16.L05",
      "Mixture Lab",
      "Reharmonize a folk tune; name secondary and borrowed chords by ear.",
      "E12b",
    ),
  ]),
  unit("U17", "Modulation", "core", "U17.CP", [
    lesson("U17.L01", "Pivot Chords", "Changing key through a shared chord.", "H14"),
    lesson(
      "U17.L02",
      "Truck-Driver & Direct Modulation",
      'A key lift with a patterned `.scale("<C4:major!8 D4:major!8>")` on the track, placed after `arrange()` when the piece has sections (never `.transpose()`).',
      "",
      "H14",
    ),
    lesson("U17.L03", "Hearing Key Changes", "Detect and locate modulations.", "E13"),
    lesson(
      "U17.L04",
      "Transcribing Through a Key Change",
      "Generated pop; Body and Soul A→bridge.",
      "",
      "E13",
    ),
  ]),
  unit("J1", "Swing, Symbols & the ii–V–I", "J", null, [
    lesson(
      "J1.L01",
      "Swing Feel & the Ride",
      "The ride pattern and swung eighths on a jazz kit; feel first.",
      "",
      "R13",
    ),
    lesson(
      "J1.L02",
      "Reading 7th-Chord Symbols",
      "iReal ↔ lead-sheet ↔ jazz glyphs for seventh chords, sixths and sus (∆ – ø °).",
      "J01 C09",
    ),
    lesson("J1.L03", "The Major ii–V–I", "ii7–V7–Imaj7 as one gesture.", "J04"),
    lesson(
      "J1.L04",
      "Guide-Tone Lines",
      'Sing and write the 3rds and 7ths; `dict("guidetones")`.',
      "J07 V06",
    ),
    lesson(
      "J1.L05",
      "Shells",
      "Shell voicings; one chord pattern drives comping, bass and melody; you comp your own swinging ii–V–I.",
      "J08",
    ),
  ]),
  unit("J2", "Keys, Minor ii–V & Colour", "J", null, [
    lesson("J2.L01", "All Twelve Keys", "ii–V–I around the cycle of fourths.", "J05"),
    lesson("J2.L02", "Minor ii–V–i", "iiø7–V7alt–i; ♭9, ♯9 and alt introduced in context.", "J02 J06"),
    lesson("J2.L03", "Extensions", "9, 11, 13 and avoid notes.", "", "J02 I04"),
    lesson(
      "J2.L04",
      "Chord-Scales",
      "Dorian, Mixolydian, Ionian, Lydian per chord (gated on U14.CP).",
      "J03",
      "",
      true,
    ),
  ]),
  unit("J3", "Voicings, Comping & Walking", "J", null, [
    lesson("J3.L01", "Rootless A/B Voicings", '`mode("duck")` and `.offset()`.', "J09"),
    // Oak 2.0 W2 (contracts 2.2): taught directly after J3.L01.
    lesson("J3.L05", "Fourths", "Quartal voicings, and the bass decides the chord's name.", "", "J09"),
    lesson("J3.L02", "Drop-2 & Spread", "Wider voicings and where they sit.", "", "J09"),
    lesson("J3.L03", "Comping Rhythms", "Charleston and pushes.", "", "H06 R10"),
    lesson("J3.L04", "Walking Bass", "Four to the bar with approach tones.", "B05"),
  ]),
  unit("J4", "Forms: Turnarounds, Blues, Rhythm Changes", "J", null, [
    lesson("J4.L01", "Turnarounds", "I–vi–ii–V and iii–VI–ii–V.", "J10"),
    lesson("J4.L02", "Jazz Blues in F", "The jazz 12-bar.", "J11"),
    lesson("J4.L03", "Rhythm Changes", "The 32-bar AABA on I Got Rhythm.", "J12"),
    lesson("J4.L04", "Reading a Standard", "A public-domain head plus changes.", "", "N07 J12"),
  ]),
  unit("J5", "Substitution & Reharmonization", "J", null, [
    lesson("J5.L01", "Tritone Substitution", "♭II7 for V7.", "J13"),
    lesson("J5.L02", "Backdoor", "iv–♭VII7–I.", "", "J13"),
    lesson("J5.L03", "Secondary ii–Vs & Diminished Passing Chords", "Two reharmonization devices.", "J14"),
    lesson("J5.L04", "Reharm Techniques", "Putting the devices to work on a tune.", "", "J14"),
    lesson("J5.L05", "Coltrane Changes", "Enrichment; not gated and not in any checkpoint.", "", "J14"),
  ]),
  unit("R1", "Feel & the Pocket", "R", null, [
    lesson("R1.L01", "Metric Weight", "The syncopation hierarchy.", "", "R10"),
    lesson("R1.L02", "Swing Ratios", "8th vs 16th swing; patterned swing amount.", "", "R13"),
    lesson("R1.L03", "The One", "16th funk drums and ghost notes.", "R14"),
    lesson("R1.L04", "Interlock", "Bass, clav and guitar as one machine.", "", "R14 B04"),
    // Oak 2.0 W2 (contracts 2.2): taught directly after R1.L04.
    lesson(
      "R1.L06",
      "One Drummer, One Line",
      "Linear drumming: no two drums at once, grouped 3+3+2.",
      "",
      "R14 R10",
    ),
    lesson(
      "R1.L05",
      "Displacement & Laid-Back Feel",
      "Shifted figures; microtiming with `.late()` (never `nudge`).",
      "R15",
    ),
  ]),
  unit("R2", "Odd Meters & Cross-Rhythm", "R", null, [
    lesson("R2.L01", "Five & Seven", "5/4 and 7/8 groupings; odd-meter tempo lines.", "R16"),
    lesson("R2.L02", "Odd Grooves", "7/8 and 9/8 (2+2+2+3).", "", "R16"),
    lesson("R2.L03", "Hemiola", "6/8 ↔ 3/4.", "R17"),
    lesson("R2.L04", "Polyrhythm 3:2, 4:3", "Two pulses at once.", "", "R17"),
    lesson(
      "R2.L05",
      "Polymeter & Implied Metric Modulation",
      "`{ }%n`; metric modulation only as implied regrouping at a constant cycle (no tempo change).",
      "",
      "R17",
    ),
  ]),
  unit("R3", "Clave & Euclidean Rhythm", "R", null, [
    lesson("R3.L01", "Tresillo & Cinquillo", "E(3,8) and E(5,8) with `(k,n)`.", "R18"),
    lesson("R3.L02", "Clave Direction", "Son and rumba, 3-2 and 2-3, on the 2-bar 8th grid.", "", "R18"),
    lesson("R3.L03", "Euclidean Rhythms & Rotation", "`(k,n,r)`, `.euclid()`, `.euclidRot()`.", "", "R18"),
    lesson("R3.L04", "Montuno & Tumbao Layering", "Clave-aligned piano and bass.", "", "R18 B04"),
    lesson("R3.L05", "Rhythm Master Lab", "Mixed rhythm dictation.", "", "E14"),
  ]),
  unit("A1", "Sound Design", "A", null, [
    side(
      lesson("A1.L01", "Waves & Harmonics", "The harmonic series; see a wave in Oak's scope panel.", "D02"),
    ),
    side(lesson("A1.L02", "Filters & Filter Envelopes", "Cutoff, resonance and movement.", "D03")),
    side(lesson("A1.L03", "Envelopes", "Attack, decay, sustain, release.", "D04")),
    side(lesson("A1.L04", "Space", "Reverb size, delay time and feedback, orbits.", "", "D05")),
    lesson("A1.L05", "Grit", "Saturation and bit reduction.", "D06"),
    lesson("A1.L06", "Movement", "Vibrato, phaser and other modulation.", "D07"),
    lesson("A1.L07", "FM & Supersaw", "Two richer synth sources.", "", "D07"),
  ]),
  unit("A2", "Arrangement & Mix", "A", null, [
    lesson(
      "A2.L01",
      "Roles & Registers",
      "Frequency space and why low thirds turn to mud; Oak's spectrum panel.",
      "D08",
    ),
    lesson("A2.L02", "Texture & Density", "Thin vs thick.", "D09", "F05"),
    // Oak 2.0 W2 (contracts 2.2): A2.L08 and A2.L09 follow A2.L02; A2.L07 follows A2.L03.
    lesson(
      "A2.L08",
      "Peak First",
      "Write the fullest section first, then make every other section by taking parts away.",
      "",
      "D09 F05 F06",
    ),
    lesson(
      "A2.L09",
      "Seams and Surprises",
      "Fills that anticipate or hesitate across a seam; an effect switched on once.",
      "",
      "F06 D09",
    ),
    lesson(
      "A2.L03",
      "Counter-Melody & Re-Voicing per Section",
      "A second line and section-specific voicings.",
      "",
      "D09 M07",
    ),
    lesson("A2.L07", "Hocket", "One line split across two sounds, note by note.", "", "D09 M07"),
    lesson("A2.L04", "Sampling", "Chop Oak's CC0 `brk` break loop.", "D11"),
    lesson("A2.L05", "Mix & Dynamics", "Levels, compression, room for each part.", "D10"),
    lesson("A2.L06", "Genre Translation", "One idea in two idioms.", "", "D09 F06"),
  ]),
];

export const tracks: TrackDef[] = [
  {
    id: "J",
    title: "Jazz Harmony",
    units: ["J1", "J2", "J3", "J4", "J5"],
    checkpoints: ["J.CP1", "J.CP2"],
    capstones: ["JC1", "JC2", "JC3", "JC4"],
  },
  {
    id: "R",
    title: "Advanced Rhythm",
    units: ["R1", "R2", "R3"],
    checkpoints: ["R.CP"],
    capstones: ["RC1", "RC2"],
  },
  {
    id: "A",
    title: "Arrangement & Sound",
    units: ["A1", "A2"],
    checkpoints: ["A.CP"],
    capstones: ["AC1", "AC2"],
  },
];

/** Track gates (contracts §4.3). All conditions of a gate must hold; a checkpoint counts when passed or soft-passed. */
export const trackGates: TrackGate[] = [
  { gate: { lessonsCompleted: ["U03.L02"] }, opens: ["A1.L01", "A1.L02", "A1.L03", "A1.L04"] },
  { gate: { checkpoints: ["U09.CP"] }, opens: ["A1.L05", "A1.L06", "A1.L07"] },
  { gate: { checkpoints: ["U10.CP"] }, opens: ["A2"] },
  { gate: { checkpoints: ["U13.CP"] }, opens: ["J1", "J2.L01", "J2.L02", "J2.L03", "J3", "R1", "R2", "R3"] },
  { gate: { checkpoints: ["U14.CP"] }, opens: ["J2.L04"] },
  { gate: { lessonsCompleted: ["U15.L06"] }, opens: ["J4"] },
  { gate: { checkpoints: ["U17.CP"] }, opens: ["J5"] },
  { gate: { checkpoints: ["J.CP1"] }, opens: ["JC1"] },
  { gate: { checkpoints: ["R.CP"] }, opens: ["RC1", "RC2"] },
  { gate: { checkpoints: ["A.CP", "U11.CP"] }, opens: ["AC1"] },
  { gate: { checkpoints: ["A.CP"], lessonsCompleted: ["J3.L04", "R1.L05"] }, opens: ["AC2"] },
  { gate: { lessonsCompleted: ["J4.L04"] }, opens: ["JC2"] },
  { gate: { checkpoints: ["J.CP2"] }, opens: ["JC3", "JC4"] },
];

/**
 * The default linear order of the core (contracts §2.5): 191 sessions, gym slots included as GYM.nn.
 * A checkpoint sits after the next unit's L01 so it falls on a later day than the unit's last lesson.
 */
// biome-ignore format: about ten sessions to a line, as in contracts §2.5
export const defaultOrder: SessionId[] = [
  "U00.L01", "U00.L02", "U01.L01", "U01.L02", "U01.L03", "U01.L04", "U01.L05", "U01.L06", "U01.L07", "U01.L08",
  "U01.L09", "U02.L01", "U01.CP", "C0.S1", "U02.L02", "U02.L03", "U02.L04", "U02.L05", "U02.L06", "U02.L07",
  "U02.L08", "U03.L01", "U02.CP", "C1.S1", "U03.L02", "U03.L03", "U03.L04", "U03.L05", "U03.L06", "U03.L07",
  "U03.L08", "U03.L09", "U03.L10", "U03.L11", "U04.L01", "U03.CP", "U04.L02", "U04.L03", "U04.L04", "U05.L01",
  "U04.CP", "U05.L02", "U05.L03", "U05.L04", "U05.L09", "U05.L05", "U05.L06", "U05.L07", "U05.L08", "U06.L01",
  "U05.CP", "U06.L02", "U06.L03", "U06.L04", "U06.L05", "U06.L06", "U06.L07", "U06.L08", "U06.L09", "U06.L10",
  "U06.L11", "U06.L12", "U06.L13", "U07.L01", "U06.CP", "U07.L02", "U07.L11", "GYM.01", "U07.L03", "U07.L04",
  "U07.L05", "U07.L06", "GYM.02", "U07.L07", "U07.L08", "U07.L09", "U07.L10", "GYM.03", "U08.L01", "U07.CP",
  "C2.S1", "C2.S2", "X1.S1", "X1.S2", "X1.S3", "U08.L02", "U08.L03", "U08.L04", "U08.L06", "GYM.04",
  "U08.L05", "U09.L01", "U09.L02", "U09.L03", "GYM.05", "U09.L04", "U09.L05", "U09.L06", "U09.L07", "GYM.06",
  "U10.L01", "U09.CP", "C3.S1", "C3.S2", "C3.S3", "C3.S4", "GYM.07", "U10.L02", "U10.L03", "U10.L04",
  "U10.L05", "GYM.08", "U10.L06", "U10.L07", "U10.L08", "U10.L09", "GYM.09", "U11.L01", "U10.CP", "C4.S1",
  "C4.S2", "GYM.10", "U11.L02", "U11.L03", "U11.L04", "U11.L05", "GYM.11", "U11.L06", "U11.L07", "U11.L08",
  "U12.L01", "GYM.12", "U11.CP", "C5.S1", "C5.S2", "X2.S1", "X2.S2", "U12.L02", "U12.L03", "U12.L04",
  "U12.L05", "GYM.13", "U12.L06", "U13.L01", "U13.L02", "U13.L03", "GYM.14", "U13.L04", "U13.L05", "U13.L06",
  "U14.L01", "GYM.15", "U13.CP", "U14.L02", "U14.L03", "U14.L04", "GYM.16", "U14.L05", "U14.L06", "U15.L01",
  "U14.CP", "CF-T.S1", "C6.S1", "C6.S2", "U15.L02", "U15.L03", "CF-T.S2", "U15.L04", "U15.L05", "U15.L06",
  "U16.L01", "CF-T.S3", "U16.L02", "U16.L03", "U16.L04", "U16.L05", "CF-T.S4", "U17.L01", "U17.L02", "U17.L03",
  "U17.L04", "GYM.17", "U17.CP", "C7.S1", "C7.S2", "C7.S3", "GYM.18", "CF-A.S1", "CF-A.S2", "CF-A.S3",
  "CF-A.S4",
];

/** Default order inside each advanced track (contracts §2.6): the order of its table. */
// biome-ignore format: one track to a block
export const trackOrder: Record<TrackId, SessionId[]> = {
  J: [
    "J1.L01", "J1.L02", "J1.L03", "J1.L04", "J1.L05", "J2.L01", "J2.L02", "J2.L03", "J2.L04", "J.CP1",
    "JC1.S1", "JC1.S2", "J3.L01", "J3.L05", "J3.L02", "J3.L03", "J3.L04", "J4.L01", "J4.L02", "J4.L03",
    "J4.L04", "JC2.S1", "JC2.S2", "J5.L01", "J5.L02", "J5.L03", "J5.L04", "J5.L05", "J.CP2", "JC3.S1",
    "JC3.S2", "JC3.S3", "JC4.S1", "JC4.S2", "JC4.S3",
  ],
  R: [
    "R1.L01", "R1.L02", "R1.L03", "R1.L04", "R1.L06", "R1.L05", "R2.L01", "R2.L02", "R2.L03", "R2.L04",
    "R2.L05", "R3.L01", "R3.L02", "R3.L03", "R3.L04", "R3.L05", "R.CP", "RC1.S1", "RC1.S2", "RC2.S1",
    "RC2.S2",
  ],
  A: [
    "A1.L01", "A1.L02", "A1.L03", "A1.L04", "A1.L05", "A1.L06", "A1.L07", "A2.L01", "A2.L02", "A2.L08",
    "A2.L09", "A2.L03", "A2.L07", "A2.L04", "A2.L05", "A2.L06", "A.CP", "AC1.S1", "AC1.S2", "AC1.S3",
    "AC2.S1", "AC2.S2", "AC2.S3",
  ],
};

export const syllabus: SyllabusDef = {
  units,
  tracks,
  checkpoints: checkpointMetas,
  capstones: capstoneMetas,
  trackGates,
  defaultOrder,
};
export default syllabus;

/** Session counts of contracts §2.7; content/validate proves the data adds up to them. */
export const SESSION_COUNTS = {
  coreLessons: 130,
  coreCheckpoints: 13,
  coreCapstoneSessions: 30,
  gymSessions: 18,
  core: 191,
  jazz: 35,
  rhythm: 21,
  arrangement: 23,
  advanced: 79,
  total: 270,
} as const;

/** Landmarks of the default order (contracts §2.5), as 1-based session numbers. */
export const LANDMARKS: Record<string, { session: SessionId; n: number }> = {
  firstAlbumTrack: { session: "C0.S1", n: 14 },
  firstChordsInOwnCode: { session: "U05.L01", n: 40 },
  firstComposedSong: { session: "C2.S2", n: 82 },
  tracksOpen: { session: "U13.CP", n: 153 },
  coreComplete: { session: "CF-A.S4", n: 191 },
};

export type { CapstoneId, CheckpointId, LessonId };

/**
 * Session length at the default 20-minute target (contracts §9.1): a lesson is warm-up 5 + New and Make
 * 13 (scaled) + Coda 1 + 1 slack; checkpoint day 3 + 12 + 4 + 1 at every target; capstone day 3 + 15 + 1;
 * gym day 4 + 14 + 1.
 */
export const SESSION_MINUTES = { lesson: 20, checkpoint: 20, capstone: 19, gym: 19 } as const;
/** Per target: [15, 20, 25] minutes of the session's main block (§9.1). */
export const MAIN_BLOCK_MINUTES = {
  lesson: [10, 13, 18],
  checkpoint: [16, 16, 16],
  capstone: [11, 15, 20],
  gym: [10, 14, 19],
} as const;
/** The one lesson a track can go past (§7.6 rule 5). */
export const PASSABLE_LESSONS: LessonId[] = ["J2.L04"];
