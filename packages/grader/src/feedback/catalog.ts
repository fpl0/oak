// The feedback catalog (exercises §2.6 plus the additions of contracts §5.7, plus the codes the matcher
// library emits). Every diagnostic the grader produces has exactly one entry here, so a message is
// always the same text for the same finding. An exercise may override the text, never the code.
import type { Diagnostic, FeedbackId, GradeResult, Loc, Md, Severity } from "@oak/content-kit";
import type { FeedbackTemplate } from "../types.ts";

type Sev = FeedbackTemplate["severity"];
const E: Sev = "error";
const W: Sev = "warn";
const I: Sev = "info";
const P: Sev = "praise";

const entries: [string, Sev, string][] = [
  // --- evaluation
  ["eval.syntax", E, "Line {line}: {detail}. Check brackets, commas and quotes."],
  ["eval.mini-parse", E, "Line {line}: the pattern string can't be read ({detail})."],
  [
    "eval.timeout",
    E,
    "Your code ran over {ms} ms, which usually means an endless loop or a huge pattern like `.fast(10000)`.",
  ],
  ["eval.too-many-events", E, "That's {n} notes in {bars} bars, which is too many to check. Simplify it."],
  ["eval.too-much-work", E, "This pattern does too much work to check. Simplify it."],
  ["eval.runtime", E, "{fn} failed: {detail}"],
  ["eval.query", E, "{fn} failed: {detail}"],
  ["eval.not-a-pattern", E, "The code doesn't end in a pattern, so nothing would play."],
  ["eval.silent", E, "Nothing plays in bars 1–{bars}."],
  ["eval.crashed", E, "The checker stopped unexpectedly. Run it again."],
  ["eval.truncated", I, "This piece is longer than {bars} bars; only the first {bars} were checked."],
  // --- code (lint and constraints)
  [
    "code.single-quoted-pattern",
    W,
    "'{text}' uses single quotes, so it's plain text, not a pattern. Use \"{text}\".",
  ],
  [
    "code.n-without-scale",
    E,
    '`n("…")` gives numbers, not pitches. Add `.scale("{key}")`, where 0 = degree 1.',
  ],
  [
    "code.label-duplicate",
    { graded: W, studio: I, content: E },
    '"{label}:" is used twice; the second line replaces the first.',
  ],
  [
    "code.unlabelled-line",
    { graded: W, studio: I, content: E },
    "This line has no label, so it does not play next to the labelled parts.",
  ],
  ["code.bare-value", E, 'Values with no sound control. Use `note("…")` or `s("…")`.'],
  ["code.no-pitch", W, "`{s}` needs a pitch: add `note(…)` or `n(…).scale(…)`."],
  ["code.unknown-chord", E, '"{sym}" {why}. Write "{suggest}".'],
  ["code.lowercase-chord-root", E, 'Chord roots are capitals: "{suggest}".'],
  [
    "code.locked-tool",
    { graded: E, studio: I, content: E },
    "`{tool}` unlocks in {lesson}. For now, use the tools you have.",
  ],
  // The lint reports a sound as `{name}` with a `{reason}` ("unlocks in the lesson “Degrees in Code”", or why a
  // bank is unknown).
  ["code.locked-sound", { graded: E, studio: I, content: E }, 'The sound "{name}" {reason}.'],
  ["code.locked-scale", { graded: E, studio: I, content: E }, 'The scale "{tool}" unlocks in {lesson}.'],
  ["code.locked-chord", { graded: E, studio: I, content: E }, 'The chord "{tool}" unlocks in {lesson}.'],
  [
    "code.locked-mini",
    { graded: E, studio: I, content: E },
    "The mini-notation `{tool}` unlocks in {lesson}.",
  ],
  ["code.preview-tool", I, "`{tool}` is only being previewed here."],
  ["code.uncatalogued", { graded: W, studio: W, content: E }, "`{name}` is not in Oak's toolbox{why}."],
  [
    "code.dollar-label",
    { graded: I, studio: I, content: E },
    "`$:` works, but naming the line (`mel:`, `bass:`) lets Oak check each part.",
  ],
  ["code.label-unknown", W, "`{label}:` isn't one of the usual labels; Oak will guess its role."],
  [
    "code.label-solo-prefix",
    E,
    "`{label}:` starts with a capital S, which solos the line. Use a lower-case name.",
  ],
  [
    "code.muted-label",
    I,
    "`{label}:` is muted in the code (the `_`), so the checker doesn't hear it either.",
  ],
  ["code.chord-not-in-dict", E, '"{sym}" {problem} in the `{dict}` dictionary. {fix}'],
  ["code.slash-chord", E, 'No `/` inside `chord("…")`: put the bass note in the `bass:` track.'],
  ["code.scale-no-octave", W, '"{scale}" has no octave, so it plays in octave 3. Write "{suggest}".'],
  ["code.scale-spaces", E, 'Scale names use colons, not spaces: write "{suggest}".'],
  [
    "code.chromatic-step",
    W,
    '"{step}" is step {n} with an accidental: the number is the 0-based step, not the degree (♯4 in major is "3#").',
  ],
  ["code.mode-above", E, '`mode("above")` isn\'t used in Oak; use `below`, `root:<note>` or `duck`.'],
  [
    "code.dict-after-voicing",
    W,
    '`.dict("{dict}")` after `.voicing()` changes nothing: the voicing is already chosen. Put it before: `.dict("{dict}").voicing()`.',
  ],
  [
    "code.transpose-after-scale",
    W,
    'A key change by `.transpose()` confuses the degrees; use a patterned `.scale("<…>")` instead.',
  ],
  ["code.add-on-control", E, '`.add("…")` with a bare string doesn\'t work here; write `.add(n("…"))`.'],
  [
    "code.nudge-studio-only",
    { graded: E, studio: I, content: E },
    "`nudge` only works in the Studio; use `.late()` here.",
  ],
  [
    "code.swing-convention",
    W,
    "`{fn}(…, {got})`: the second number is the beats per bar ({beats} here), or {double} for 16ths.",
  ],
  [
    "code.swing-fraction-string",
    E,
    "A fraction inside quotes gives no swing: write the amount as a plain number, without quotes.",
  ],
  ["code.setcpm-missing", W, "{detail}: start with a tempo line like `setcpm({example})`."],
  ["code.setcpm-form", W, "Tempo line: {detail}."],
  [
    "code.range-spacing",
    E,
    'Strudel reads "{text}" as one word, not a range. Put a space on each side of the dots: "{suggest}".',
  ],
  [
    "code.time-fraction-string",
    E,
    '`.{fn}("{text}")` doesn\'t shift anything; write `.{fn}({text})` without quotes.',
  ],
  [
    "code.arranged-scale-pattern",
    W,
    'A patterned `.scale("<…>")` inside a section restarts with the section; put the key plan after `arrange()`.',
  ],
  ["code.locked-fn", E, "`{fn}()` unlocks in {lesson}. For now use {alt}."],
  // Wave 5: "match this sound" (the `controls` matcher, A1). Never prints the hidden value.
  [
    "code.control-missing",
    E,
    "The target sound uses `{fn}`; yours leaves it out, so it plays at Strudel's default. Add it and listen again.",
  ],
  ["code.control-off", E, "`{fn}`: yours is {how}."],
  ["code.must-use", E, "Use {tool} here."],
  ["code.must-not-use", E, "Solve this without {tool}: {why}"],
  ["code.must-call", E, "Use `{fn}()` here."],
  ["code.must-not-call", E, "Solve this without `{fn}()`: {why}"],
  ["code.arg-mismatch", E, "`{fn}({got})`: this needs {expected}."],
  ["code.mini-uses", E, "Use {opName} (`{op}`)."],
  ["code.mini-avoids", W, "Try it without {opName}."],
  ["code.no-note-names", E, "Write degree numbers here, not note names like `{text}`."],
  ["code.no-randomness", E, "`{fn}` makes this uncheckable. Remove it for this exercise."],
  ["code.unchanged", I, "Nothing changed yet. Edit the highlighted part and Check again."],
  ["code.edit-outside", E, "Only the highlighted part should change."],
  ["code.too-many-changes", W, "You changed {n} tokens; {max} is enough."],
  ["code.labels", E, "Use {min} labeled parts (`name: …`), one per instrument."],
  ["code.tempo", W, "Tempo is {got} BPM; the brief says {expected}: `setcpm({expected}/{beats})`."],
  ["code.tempo-factor", W, "That is {got} BPM: divide by the beats per bar, `setcpm({expected}/{beats})`."],
  ["code.max-chars", W, "That's {n} characters; keep it under {max}."],
  ["code.octave-default", I, '"{note}" has no octave, so it plays in octave 3. Did you mean "{suggest}"?'],
  [
    "code.letter-accidental",
    I,
    '"{note}" plays the right note; Oak writes sharps and flats as # and b: "{suggest}".',
  ],
  ["lint.strict.computed-member", E, "Computed member access isn't allowed in code Oak runs for you."],
  ["lint.strict.this", E, "`this` isn't allowed in code Oak runs for you."],
  ["lint.strict.reserved-string", E, "That string isn't allowed in code Oak runs for you."],
  ["lint.strict.construct", E, "That construct isn't allowed in code Oak runs for you."],
  // --- rhythm
  ["rhythm.missing", E, "Bar {bar}, {beatLabel}: missing hit{role}."],
  ["rhythm.extra", E, "Bar {bar}, {beatLabel}: extra hit{role}."],
  ["rhythm.displaced", W, "Right rhythm, shifted {shiftLabel}. Check where it starts."],
  ["rhythm.subdivision", W, "Your notes move in {got}; this rhythm moves in {expected}."],
  ["rhythm.duration", W, "Bar {bar}, {beatLabel}: {got} long, should be {expected}."],
  ["rhythm.period", W, "Yours repeats every {got} bar(s); the target repeats every {expected}."],
  ["rhythm.role-missing", E, "No {role} part found."],
  ["rhythm.swing-missing", W, "Right rhythm, but {got} where the target is {expected}."],
  // Wave 5: the `swing` rule (U11.L07, C5) names the line and the fix.
  ["rhythm.swing-amount", W, "`{line}` swings at {ratio}:1; the brief asks for {range}:1, so {tip}."],
  [
    "rhythm.pickup-missing",
    W,
    "The phrase starts on the downbeat; it should start with a pickup of {units} beat(s).",
  ],
  // --- melody
  [
    "melody.wrong-degree",
    E,
    "Bar {bar}, {beatLabel}: you have {got} ({gotSyl}); the {line} has {exp} ({expSyl}).",
  ],
  ["melody.octave", W, "Bar {bar}, {beatLabel}: right note, an octave {dir}."],
  [
    "melody.index-shift",
    E,
    "Every note is one step {dir}. `n` counts from 0, so degree {deg} is `n({idx})`.",
  ],
  ["melody.transposed", I, "Right tune, but in {gotKey}, not {expKey}."],
  ["melody.missing-note", E, "Bar {bar}, {beatLabel}: note {exp} missing."],
  ["melody.extra-note", E, "Bar {bar}, {beatLabel}: extra note {got}."],
  ["melody.contour-right", I, "The ups and downs are right; check how big each step is."],
  ["melody.rhythm-only", I, "All pitches right; the rhythm differs at the marks."],
  ["melody.ends-on", E, "It ends on {got}; the brief asks for {expected}."],
  ["melody.no-line", E, "No melody line found{track}."],
  // by-ear transcription (Wave 3, DictationEx.byEar)
  ["melody.first-difference", I, "The first difference is in bar {bar}, {beatLabel}: {what}."],
  [
    "melody.rhythm-note",
    W,
    "Bar {bar}, {beatLabel}: {got} is the right note, but it starts at {expAt} in the source.",
  ],
  ["melody.pitch-only", I, "The rhythm is right throughout; only the pitches at the marks differ."],
  [
    "melody.wrong-key",
    E,
    "Right tune, but in {gotKey}. This step wants it as it plays, in {expKey}: move every note {semis} {dir}.",
  ],
  // Wave 6 (U17, `key-plan`): a stretch left in the key before a key change.
  [
    "melody.key-plan",
    E,
    "From bar {bar} the tune is in {expKey}; yours is still in {gotKey} there. Move those bars {semis} {dir}: give the line its key plan.",
  ],
  [
    "melody.wrong-octave",
    E,
    "Right notes, an octave {dir} than the source. This step wants the octave you hear.",
  ],
  // --- harmony
  ["harmony.bass", E, "Chord {slot} (bar {bar}): bass is {got}; you should hear {exp}."],
  ["harmony.root", E, "Chord {slot}: root {got}, expected {exp}."],
  ["harmony.quality", E, "Chord {slot}: right root ({root}), but {exp}, not {got}."],
  ["harmony.inversion", W, "Chord {slot}: right chord, but the bass should be its {member}."],
  ["harmony.rn-case", W, "Chord {slot}: {got} → {exp}. Upper case = major, lower = minor."],
  ["harmony.rn", E, "Chord {slot}: {got}, expected {exp}."],
  ["harmony.missing-chord", E, "Bar {bar}, {beatLabel}: a chord change is missing."],
  ["harmony.extra-chord", W, "Bar {bar}, {beatLabel}: no change here."],
  [
    "harmony.transposed",
    E,
    "Right changes, but in {gotKey}. The song is in {expKey}: move every chord {semis} {dir}.",
  ],
  [
    "harmony.key-mismatch",
    W,
    "Your piece reads in {got}; the brief is in {exp}, so every check reads it in {exp}. Move it to {exp}: the key in .scale() and the chords.",
  ],
  ["harmony.schema-rotation", I, "Right loop ({schema}), but it starts on a different chord."],
  ["harmony.not-in-key", W, "{chord} isn't in {key}. Intended?"],
  ["harmony.pcset", E, "Bar {bar}, {beatLabel}: the chord has {got}; it should have {exp}."],
  ["harmony.no-chords", E, "No chords found{track}."],
  // Wave 6 (U13): the right chords at another time, each moved by the same amount.
  ["harmony.shifted", E, "The chords are right, but each starts {shift} than in the target{push}."],
  // Wave 5: the 12-bar blues (`blues-form`, the bar grid), the last chord under the tune (`ends-on-degree` over).
  ["harmony.blues-bar", E, "Bar {bar} of the blues should be {exp}; yours is {got}."],
  ["harmony.bar", E, "Bar {bar}: {exp}, not {got}. {why}"],
  ["harmony.ends-over", E, "The melody ends on the right note, but {detail}."],
  // Wave 4: the voicing gate (hand voice leading), numerals by degree, quality and bass, strips of choices.
  ["harmony.voice-count", E, "Bar {bar}: {notes} is {got} notes; the brief asks for {exp} voices."],
  [
    "harmony.common-tone",
    E,
    "Bar {bar}: {pc} is in both chords. Keep the {note} where it is, in the same voice.",
  ],
  [
    "harmony.voice-leap",
    E,
    "Bar {bar}: the voice on {from} jumps {semis} half steps to {to}. The nearest note of the new chord is {nearest}; move at most {max}.",
  ],
  [
    "harmony.voice-crossing",
    E,
    "Bar {bar}: the voice on {low} moves to {lowTo}, above the voice that went from {high} to {highTo}. Keep the voices in order.",
  ],
  [
    "harmony.rn-degree",
    E,
    "Chord {slot}: {got} is built on degree {gotDeg} ({gotChord}); this chord is {exp}, built on degree {expDeg} ({expChord}).",
  ],
  ["harmony.rn-quality", E, "Chord {slot}: right degree, but {exp} is {expQ}, not {gotQ} ({got})."],
  // Wave 6 (U15–U16): applied chords. The right chord under the wrong kind of name; one applied chord for another.
  ["harmony.rn-applied", E, "Chord {slot}: {got} names the right notes ({chord}), but {why}: {exp}."],
  [
    "harmony.rn-target",
    E,
    "Chord {slot}: {got} is {gotChord}, which leads to {gotTarget}; this chord is {exp} ({expChord}): it leads to {expTarget}.",
  ],
  [
    "harmony.rn-inversion",
    W,
    "Chord {slot}: right chord, but its {member} is in the bass, so it is {exp}, not {got} ({gotMember} in the bass).",
  ],
  ["harmony.function", E, "{at}: this chord is {exp}, not {got}."],
  ["harmony.cadence", E, "{at}: that ending is {exp}, not {got}."],
  // --- spelling, key signatures
  ["spell.enharmonic", E, "{got} sounds right, but in {context} it's spelled {exp}."],
  ["spell.wrong", E, "{got} → {exp}."],
  ["spell.order", W, "Right notes, wrong order."],
  ["keysig.wrong", E, "{key} has {exp}; you wrote {got}."],
  ["keysig.count", E, "{key} has {n} {kind}: {exp}. You wrote {count}."],
  [
    "keysig.type",
    E,
    "{key} is a {expKind} key: its signature is {exp}. Sharps and flats never mix in a key signature.",
  ],
  [
    "keysig.order",
    E,
    "Right {kind}, written in another order. A signature always reads {order}: here {exp}.",
  ],
  // --- singing and tapping (graded by @oak/pitch; the text lives here)
  // `more` (from @oak/pitch) says why: too much noise around the voice, or only short blips.
  ["sing.no-voice", E, "I couldn't hear singing (input {db} dB).{more}"],
  [
    "sing.clipped",
    W,
    "The mic input is too loud: it hit full scale {n} times, which distorts the pitch. Turn the input down or sing a little further from the mic.",
  ],
  ["sing.bleed", E, "The mic hears the playback; use wired headphones."],
  ["sing.sharp", W, "Note {i} ({exp}): {cents}¢ {dir}."],
  ["sing.flat", W, "Note {i} ({exp}): {cents}¢ {dir}."],
  ["sing.wrong-note", E, "Note {i}: you sang {got}, target {exp}."],
  ["sing.missed", E, "Note {i} ({exp}) wasn't sung."],
  ["sing.octave-jump", I, "Note {i} jumped an octave."],
  ["sing.drift", I, "You drifted {cents}¢ {dir}; re-anchor on {tonicSyl}."],
  ["sing.unstable", I, "Note {i} wobbled ±{cents}¢."],
  ["sing.early", W, "Note {i}: {ms} ms {dir}."],
  ["sing.late", W, "Note {i}: {ms} ms {dir}."],
  // Wave 5 (U11): a blue note sung toward its neighbour is credited (`SungTarget.blue`); the host re-spells
  // `exp`/`toward` (neutral sharp names) or reads `expDeg`/`towardDeg` from @oak/pitch `labelSungResult`.
  [
    "sing.blue-note",
    I,
    "Note {i} ({exp}): {cents}¢ {dir}, bent toward {toward}. That is a blue note, and it counts.",
  ],
  // sung degree patterns (the grader judges the pattern; @oak/pitch judged each note)
  ["sing.wrong-degree", E, "Note {i}: you sang {got}; the pattern has {exp} here."],
  ["sing.contour-right", I, "The ups and downs are right; check how far each step goes."],
  [
    "sing.octave-folded",
    I,
    "Note {i}: right degree ({exp}), but the pattern goes {targetDir} to it and you sang it {gotDir}. Counted as right.",
  ],
  ["sing.too-short", E, "You sang {got} of {n} notes; the pattern goes on with {rest}."],
  ["tap.missed", E, "No tap for note {i} of the rhythm."],
  ["tap.extra", W, "Tap {j} was one too many."],
  ["tap.offset", I, "You're consistently {ms} ms {dir}."],
  ["tap.rushing", W, "You sped up {ms} ms over the phrase."],
  ["tap.dragging", W, "You slowed down {ms} ms over the phrase."],
  // Wave 5 (U11.L07): the measured feel of a tapped shuffle (@oak/pitch `gradeSwingTaps`); warn when it is off.
  ["tap.swing", I, "Your off-beats sat at {got}, {gotFeel}; the pattern is {exp}, {expFeel}."],
  // Wave 6 (U13): pushes, triplets and compound meter tapped against a click (@oak/pitch `gradeRhythmTaps`; the
  // texts are pitch's `RHYTHM_TAP_FEEDBACK`, word for word).
  [
    "tap.push-on-beat",
    W,
    "{which} landed on the beat. A push comes {by} early: tap it just before the beat, then leave the beat itself empty.",
  ],
  [
    "tap.push-late",
    W,
    "Your pushes are {ms} ms late, leaning toward the beat. Let them come a little sooner.",
  ],
  ["tap.push-early", W, "Your pushes are {ms} ms early: they come a touch sooner than the pattern has them."],
  [
    "tap.triplet-uneven",
    W,
    "{n} of {of} triplets came out as {shape}. A triplet is three even notes to the beat: 1-trip-let.",
  ],
  [
    "tap.grouping",
    W,
    "You tapped {quarters} even beats to the bar. {meter} has {beats} beats of three eighths: {count}.",
  ],
  ["tap.kind-timing", I, "Your {kind} are {ms} ms {dir} against your on-beat notes."],
  // Wave 7 (R1–R3, stage H): two lanes, timelines, the clave, odd groupings and the lay-back (@oak/pitch
  // `gradeLaneTaps`, `gradeTimelineTaps`, `gradeClaveTaps`, `gradeGroupingTaps`, `gradeLayBackTaps`; the texts are
  // pitch's `TRACK_TAP_FEEDBACK`, word for word: catalog-pitch-wave7.test.ts). Each says what the taps did; the
  // pattern named is the one the step plays.
  ["tap.lane-rushing", W, "Your {lane} is rushing against the {other}: its taps come {ms} ms early."],
  ["tap.lane-dragging", W, "Your {lane} is dragging against the {other}: its taps come {ms} ms late."],
  ["tap.lane-silent", E, "No taps on {key}: that hand plays the {lane} while the other plays the {other}."],
  ["tap.lanes-swapped", E, "Your hands swapped parts: {keyA} tapped the {laneB} and {keyB} the {laneA}."],
  ["tap.lanes-flam", I, "Where both hands play together, they landed {ms} ms apart."],
  ["tap.timeline", W, "Bar {bar}: you tapped {got}. The pattern is {exp}."],
  [
    "tap.clave-direction",
    W,
    "You tapped the clave {got}, starting from its {gotFirst} side. This one runs {exp}: the {expFirst} side first.",
  ],
  [
    "tap.clave-type",
    W,
    "You tapped a {got} clave: its three side ends {gotWhere}. This one is a {exp} clave, ending {expWhere}.",
  ],
  ["tap.grouping-order", W, "You tapped {got} ({gotWords}). This bar of {meter} goes {exp}: {expWords}."],
  ["tap.grouping-even", W, "You tapped evenly, {every}. This bar of {meter} goes {exp}: {expWords}."],
  ["tap.lay-back", I, "You sat {about}{ms} ms {dir} the beat (± {pm} ms): {word}."],
  // Wave 7 (J2.L03, J3.L04): sung tensions and walking roots (@oak/pitch `gradeSungTensions` / `gradeSungRoots`;
  // pitch's `JAZZ_SING_FEEDBACK`, word for word).
  ["sing.tension", E, "Note {i}, over {chord}: you sang {gotRole} ({got}), {step} {dir} {expRole} ({exp})."],
  [
    "sing.root",
    E,
    "Note {i}, over {chord}: you sang {gotRole} ({got}). The bass walks from {expRole}, {exp}.",
  ],
  // Wave 6 (U12.L05, U14, U15.L01): sung chromatic degrees, a mode's colour tone and guide-tone lines
  // (@oak/pitch `explainColourResult` / `gradeGuideTones`; the texts are pitch's `COLOUR_FEEDBACK`).
  [
    "sing.neighbour",
    E,
    "Note {i}: you sang {gotDeg} ({gotSyl}), the key's own note. {expDeg} ({expSyl}) is a half step {dir} it, leaning on to {leanDeg}.",
  ],
  [
    "sing.plain-scale",
    E,
    "Note {i}: you sang {gotDeg} ({gotSyl}), the note of plain {plain}. The colour of {mode} is {expDeg} ({expSyl}), a half step {dir}.",
  ],
  [
    "sing.neighbour-close",
    I,
    "Note {i} ({expDeg}) counted, but it was {cents}¢ {dir}: closer to {gotDeg} than to {expDeg}.",
  ],
  [
    "sing.guide-tone",
    E,
    "Note {i}, over {chord}: you sang the {gotRole} ({got}). The guide tone here is the {expRole} ({exp}).",
  ],
  [
    "sing.guide-tone-other",
    W,
    "Note {i}, over {chord}: you sang the {gotRole} ({got}), the chord's other guide tone. This line takes the {expRole} ({exp}), the smaller step.",
  ],
  // --- answers
  ["id.wrong", E, "That was {exp}, not {got}. Listen to both."],
  ["id.partial", W, "Close: {got} is near {exp}."],
  ["id.confusion", I, "You mixed up {a} and {b} {n}×: {tip}"],
  ["id.missing", E, "Answer every slot ({n} left)."],
  ["id.slot", E, "{at}: {exp}, not {got}."],
  ["id.quality", E, "That was {exp}, not {got}: {tip}."],
  ["id.chord-root", E, "{exp}, not {got}: the chord is built on {expRoot}, not {gotRoot}."],
  ["id.chord-quality", E, "{exp}, not {got}: right root, but the chord is {expQ}, not {gotQ}."],
  [
    "id.chord-inversion",
    E,
    "{exp}, not {got}: right chord, but the lowest note is {expBass}, not {gotBass}.",
  ],
  ["id.chord-spelling", E, "{got} sounds right, but here it is spelled {exp}."],
  // Wave 5: the scale builder (U10–U11) and the form strip (U09).
  ["id.scale-missing", E, "{scale} also has {deg} ({syl}), the note {note}."],
  ["id.scale-extra", E, "{deg} ({note}) is not in {scale}."],
  // Wave 6 (U14): the answer is another scale the learner knows, a note away per changed degree.
  ["id.scale-other", E, "That is {got}; {scale} has {swaps}."],
  ["form.section", E, "Section {slot} is {exp}, not {got}."],
  [
    "id.interval-quality",
    E,
    "Right size, a {generic}, but {exp} ({expLong}), not {got}. Count the half steps: {semis}.",
  ],
  [
    "id.interval-number",
    E,
    "That was {exp} ({expLong}), not {got}. Count the letter names from the lower note, both ends included.",
  ],
  ["fill.blank-wrong", E, "Blank {blank} isn't right yet."],
  ["fill.blank-empty", E, "Fill in blank {blank}."],
  ["parsons.swap", E, "Two blocks are in the wrong order: check line {slot}."],
  ["parsons.distractor", E, "One block doesn't belong in the answer."],
  ["parsons.missing", E, "{n} block(s) are missing."],
  ["hunt.not-here", E, "The problem isn't here. Listen again and compare."],
  ["hunt.found", P, "Found it."],
  ["investigate.not-here", E, "Not that one. Listen again and compare."],
  ["investigate.wrong", E, "Not quite. Listen again and compare."],
  ["kb.wrong-note", E, "You played {got}; the answer is {exp}."],
  ["kb.missing-note", E, "{exp} is missing."],
  ["kb.extra-note", E, "{got} doesn't belong."],
  ["kb.octave", W, "Right note, wrong octave: {got} instead of {exp}."],
  ["kb.bass", E, "The lowest note should be {exp}, not {got}."],
  ["kb.order", W, "Right notes, wrong order."],
  // Wave 7 (`keyboard.voicing`, `staff-expect.voicing`): the shape played, never the notes that would be right.
  ["kb.voicing", E, "That is {got}; the step asks for {want}."],
  ["harmony.voicing-shape", E, "Chord {slot}: that is {got}; the step asks for {want}."],
  // Wave 7 (`grouping` and `euclid` answers): what the learner's own answer is, not the answer.
  ["id.grouping-count", E, "{got} adds up to {gotTotal}; this bar has {total}. Count the pulses again."],
  ["id.grouping-order", W, "The right groups in another order ({got}): listen for which group comes first."],
  ["id.grouping-wrong", E, "{got} is not how this bar falls: listen for where the accents land."],
  [
    "id.euclid-wrong",
    E,
    "{got} makes {k} hits over {n} steps, another rhythm: count the hits, then the steps.",
  ],
  [
    "id.euclid-rotation",
    W,
    "{got} has the right hits and steps but starts from another hit: find where it begins.",
  ],
  ["staff.wrong-note", E, "Bar {bar}, {beatLabel}: {got} should be {exp}."],
  ["staff.missing-note", E, "Bar {bar}, {beatLabel}: a note is missing."],
  ["staff.extra-note", E, "Bar {bar}, {beatLabel}: one note too many."],
  ["staff.rhythm", E, "Bar {bar}, {beatLabel}: the rhythm differs."],
  // Wave 5: `notates` (C3 "the lead sheet renders").
  ["staff.not-exact", E, "The lead sheet can't write {bars} exactly: {why}."],
  [
    "staff.octave",
    E,
    "{at}: {got} is the right note, an octave too {dir}. {exp} sits seven lines and spaces {dir2}.",
  ],
  ["staff.accidental", E, "{at}: {got} should be {exp}: same line or space, different accidental{why}."],
  ["staff.enharmonic", E, "{at}: {got} sounds right, but in {key} it is written {exp}{why}."],
  ["predict.done", P, "Now listen and compare."],
  // --- form
  ["form.inconsistent-arrange", E, "The tracks disagree about the sections: {detail}."],
  ["form.section-period", W, "`{name}` repeats every {period} bars, so a {bars}-bar section cuts it off."],
  ["form.wrong", E, "The form is {got}; the brief asks for {expected}."],
  ["form.no-sections", E, "No sections found: write one `arrange()` per labelled track."],
  ["form.no-section", E, "There is no {section} in your sections ({have})."],
  ["form.contrast", E, "The {a} is no {list} than the {b}: change {need} of these."],
  // Wave 6: the form map of a whole tune (CF-T.S1, ladder L8).
  [
    "form.map-start",
    E,
    "Bars {from}–{to} hold more than one section: listen through them for the bar where the tune starts again or turns somewhere new.",
  ],
  ["form.map-extra", W, "Bar {bar} is inside a section: nothing new starts there."],
  // --- make, rubric, pass
  ["make.beyond-brief", I, "You went past today's brief. Nice."],
  ["make.silent", E, "Nothing plays yet."],
  ["make.unchanged", E, "This is still the starter as it came. Change it to make it yours, then save."],
  ["rubric.unmet", E, "{label}: {detail}"],
  ["rubric.met", P, "{label}: done"],
  ["rubric.unknown", E, "Rule {rule} can't be checked."],
  ["pass.perfect", P, "Exactly right."],
  ["pass.close", P, "Passed. Small things to polish: {n}."],
];

/**
 * How a toolbox entry reads in a message: its code form from the toolbox (`ToolEntry.code`) when the caller
 * has the toolbox, in backticks when it is code (`.transpose("3M")`, `,`) and as written when it is a
 * description ("negative and ≥7 n"); without the toolbox, the last part of the ID in backticks. Never the
 * raw ID ("tb.mini.stack").
 */
export function toolText(id: string, toolCode?: (id: string) => string | null): string {
  const code = toolCode?.(id)?.trim();
  if (!code) return `\`${id.split(".").pop() ?? id}\``;
  return /\s/.test(code) && !/^[.\w$]+\(.*\)$/.test(code) ? code : `\`${code}\``;
}

/** The registry of feedback codes. Source of truth for which `FeedbackId`s exist. */
export const FEEDBACK_CATALOG: Readonly<Record<string, FeedbackTemplate>> = Object.freeze(
  Object.fromEntries(entries.map(([id, severity, template]) => [id, { id, severity, template }])),
);

/** The catalog severity for a profile (`graded` unless said otherwise). */
export function catalogSeverity(id: string, profile: "graded" | "studio" | "content" = "graded"): Severity {
  const sev = FEEDBACK_CATALOG[id]?.severity;
  if (!sev) return "error";
  return typeof sev === "string" ? sev : (sev[profile] ?? sev.graded ?? "error");
}

/** A diagnostic with the catalog's severity. */
export function diag(
  id: FeedbackId,
  params: Record<string, string | number> = {},
  where?: Loc,
  dim?: Diagnostic["dim"],
): Diagnostic {
  return { id, severity: catalogSeverity(id), params, ...(dim ? { dim } : {}), ...(where ? { where } : {}) };
}

/**
 * Values for slots a template gained after diagnostics were stored (a Wave 3 attempt's `melody.wrong-degree`
 * has no `line`): the stored finding still renders whole. Params always win.
 */
const SLOT_DEFAULTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "melody.wrong-degree": { line: "melody" },
};

/**
 * Renders a diagnostic with its catalog template, or the exercise's override text. Slots come from
 * `params`, then from `where` (`bar`, `beat`, `beatLabel`, `track`, `slot`, `rule`, `blank`). A slot with
 * no value is dropped with its surrounding spaces. Deterministic: same input, same text.
 */
export function renderFeedback(d: Diagnostic, overrides?: Partial<Record<FeedbackId, Md>>): string {
  const template = overrides?.[d.id] ?? FEEDBACK_CATALOG[d.id]?.template ?? `${d.id}`;
  const w = d.where ?? {};
  const slots: Record<string, string | number | undefined> = {
    ...SLOT_DEFAULTS[d.id],
    bar: w.bar === 0 ? "pickup" : w.bar,
    beat: w.beat,
    beatLabel: w.beatLabel,
    track: w.track,
    slot: w.slot,
    rule: w.rule,
    blank: w.blank,
    ...d.params,
  };
  let text = template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = slots[k];
    return v === undefined || v === null ? "\uE000" : String(v);
  });
  // "Bar pickup, 3:" reads as "Pickup, 3:".
  text = text.replace(/^Bar pickup/, "Pickup").replace(/\(bar pickup\)/, "(pickup)");
  return text
    .replace(/\s*\(\uE000\)/g, "")
    .replace(/ ?\uE000/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Slots a template may leave out by design (the text reads whole without them): an optional suffix such as
 * `{role}` (" (kick)"), `{why}` or `{more}`. Every other slot must be filled by the diagnostic.
 */
export const OPTIONAL_SLOTS: Readonly<Record<string, readonly string[]>> = {
  "rhythm.missing": ["role"],
  "rhythm.extra": ["role"],
  "melody.no-line": ["track"],
  "harmony.no-chords": ["track"],
  "harmony.shifted": ["push"],
  "code.uncatalogued": ["why"],
  "staff.accidental": ["why"],
  "staff.enharmonic": ["why"],
  "sing.no-voice": ["more"],
};

/**
 * The template slots a diagnostic leaves empty (neither `params` nor `where` fills them), minus the
 * entry's optional ones: a non-empty result renders as a sentence with a hole ('"" has no octave').
 */
export function unfilledSlots(d: Diagnostic, overrides?: Partial<Record<FeedbackId, Md>>): string[] {
  const template = overrides?.[d.id] ?? FEEDBACK_CATALOG[d.id]?.template ?? "";
  const w = d.where ?? {};
  const have: Record<string, unknown> = {
    bar: w.bar,
    beat: w.beat,
    beatLabel: w.beatLabel,
    track: w.track,
    slot: w.slot,
    rule: w.rule,
    blank: w.blank,
    ...d.params,
  };
  const optional = new Set(OPTIONAL_SLOTS[d.id] ?? []);
  const out = new Set<string>();
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    const k = m[1] as string;
    if (!optional.has(k) && (have[k] === undefined || have[k] === null)) out.add(k);
  }
  return [...out];
}

const SEV_ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2, praise: 3 };
/** Sorted: severity, bar, beat (contracts §5.7); stable otherwise. */
export function sortDiagnostics(ds: readonly Diagnostic[]): Diagnostic[] {
  return ds
    .map((d, i) => ({ d, i }))
    .sort(
      (a, b) =>
        SEV_ORDER[a.d.severity] - SEV_ORDER[b.d.severity] ||
        (a.d.where?.bar ?? Number.POSITIVE_INFINITY) - (b.d.where?.bar ?? Number.POSITIVE_INFINITY) ||
        (a.d.where?.beat ?? Number.POSITIVE_INFINITY) - (b.d.where?.beat ?? Number.POSITIVE_INFINITY) ||
        a.i - b.i,
    )
    .map((x) => x.d);
}

/** The rendered top three messages, plus an "n more" line (contracts §5.7). */
export function messagesOf(
  ds: readonly Diagnostic[],
  overrides?: Partial<Record<FeedbackId, Md>>,
  max = 3,
): GradeResult["messages"] {
  // One message per distinct text and place: an `all` matcher's members can report the same finding (the melody
  // and rhythm matchers both say `rhythm.pickup-missing` in U07.L08 S5), which the learner should read once.
  const seen = new Set<string>();
  const sorted = sortDiagnostics(ds).filter((d) => {
    const k = `${d.id}\u0000${renderFeedback(d, overrides)}\u0000${JSON.stringify(d.where ?? null)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const out: GradeResult["messages"] = sorted
    .slice(0, max)
    .map((d) => ({ id: d.id, text: renderFeedback(d, overrides), ...(d.where ? { where: d.where } : {}) }));
  if (sorted.length > max) {
    const rest = sorted.length - max;
    const first = sorted[max] as Diagnostic;
    out.push({ id: first.id, text: `${rest} more` });
  }
  return out;
}

/** Whether every code a list of diagnostics uses is registered. */
export function unknownCodes(ds: readonly Diagnostic[]): string[] {
  return [...new Set(ds.map((d) => d.id).filter((id) => !(id in FEEDBACK_CATALOG)))];
}
