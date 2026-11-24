/**
 * Version of docs/design/contracts.md that this package implements. Bump it in the same commit as any
 * contract change (contracts "Changing a contract").
 */
export const CONTRACTS_VERSION = "1.9";

/**
 * Bump when the shape of a content schema changes in a way that old generated content or an older reader
 * cannot satisfy (the schemas are strict: an older reader refuses a new field). 2: the Wave 3 shapes
 * (staff writing with a key, key signatures in order, sung labels, octaves and the lenient first sing,
 * by-ear transcription, passive listening, `revealRollAfter`, `staffLabels`, fact-card `accept`,
 * milestone `ladder`/`anyOf`). 3: the Wave 4 shapes (the `slot-choice` widget, chords on the staff, staged chord
 * dictation with a widget per stage, by-ear transcription in parts, staged transcription and what is
 * given, the capstone-song stimulus and lead-sheet display, Workbench panels opened by a step, the
 * voice-leading gate fields, `progression.bars`, the `pickup`, `chord-qualities` and `chord-inversions`
 * rules, capstone session checks, starter, review and release). 4: the Wave 5 shapes (the `form`, `bar-grid` and
 * `scale-builder` widgets and `Answer.sections`, the `controls` matcher, the `bass-line` and `notates` rules,
 * `section` on every rubric rule, `chord-qualities.depth`, `degree-set.anyOf`, `ends-on-degree.over`,
 * `blues-form.choruses`, the `form`/`scope`/`spectrum` panels and `StepUi.probe`, `LessonMeta.side`,
 * `PhraseCheck.after`). 5: the Wave 6 shapes (`keyPlan` on exercises and songs, `rn-palette` labels and slot
 * keys, grids of 6 and 24 steps, the form map and `Answer.bars`, `scale-builder.from`, the `guide-tones` sing
 * mode, `harmony.wrongQuality`, `contains-rn.kind`/`inOrder`, `form.contains`/`extra` and the `*` and `@song`
 * patterns, `mode.anyOf`, `guide-tones.at`/`maxMoveSemis`, `modulation.via`, `velocity-ghosts.drum`/`accents`,
 * typed `device-count` names, the `reharmonize` rule, `CodeMakeEx.fromSketch`, `LessonMeta.splitFrom`,
 * capstone session `formMap` and `rubric`, song `sections`). 6: the Wave 7 shapes (the `grouping` and `euclid`
 * widgets and their `Answer` fields, `text.jazz`, `KeyboardEx.expect.voicing`, `StaffExpect` chords `voicing`,
 * `TapEx.lanes` and the `lanes` test response, `clave.minBars`/`exact`, `polyrhythm.minBars`/`span`,
 * `voice-leading.voice`/`minRatio`, `reharmonize.devices`, `CapstoneDef.versions`).
 */
export const CONTENT_SCHEMA_VERSION = 6;
