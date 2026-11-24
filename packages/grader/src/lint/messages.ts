// Lint findings: catalog templates and the severity of each finding by lint profile (contracts §3.3,
// §5.7, §11.3; STYLE §12). The feedback catalog (FEEDBACK_CATALOG) should carry the same templates; the
// lint renders its own message so that it stays pure and usable on the main thread.
import type { FeedbackId, LintProfile, LintSeverity } from "@oak/content-kit";

export const LINT_TEMPLATES = {
  "eval.syntax": "Line {line}: {detail}. Check brackets, commas and quotes.",
  "eval.mini-parse": "Line {line}: the pattern string can't be read ({detail}).",
  "lint.base.import": "`{what}` is not available in Strudel code.",
  "lint.base.with": "`with` is not available in Strudel code.",
  "lint.base.identifier": "`{name}` is not available in Strudel code.",
  "lint.base.member": "`.{name}` is not available in Strudel code.",
  "lint.base.remote-samples": 'Samples come from Oak\'s own sound pack: remove the `{call}("{url}")` call.',
  "lint.strict.computed-member": "Computed access `[…]` is only allowed with a number: {what}.",
  "lint.strict.this": "`this` is not allowed here.",
  "lint.strict.reserved-string": '"{word}" is not allowed in this code.',
  "lint.strict.construct": "{what} is not allowed in this code.",
  "code.locked-tool": "`{name}` unlocks in {at}.",
  "code.locked-sound": 'The sound "{name}" {reason}.',
  "code.locked-scale": 'The scale "{name}" unlocks in {at}.',
  "code.locked-chord": 'The chord "{name}" unlocks in {at}.',
  "code.locked-mini": "The mini-notation operator `{name}` unlocks in {at}.",
  "code.preview-tool": "`{name}` is only being previewed here; it unlocks in {at}.",
  "code.uncatalogued": "`{name}` is not in Oak's toolbox{why}.",
  "code.dollar-label": "`$:` lines work, but name each part instead (`drums:`, `bass:`, `mel:`).",
  "code.label-unknown": '"{label}:" is not one of the part names; it is graded by what it plays.',
  "code.label-solo-prefix":
    '"{label}:" starts with a capital letter, so Strudel plays only that line. Write "{suggest}:".',
  "code.muted-label": '"{label}:" is muted in code: the checker cannot hear it.',
  "code.label-duplicate": '"{label}:" is used twice; the second line replaces the first.',
  "code.unlabelled-line": "This line has no label, so it does not play next to the labelled parts.",
  "code.single-quoted-pattern":
    "'{text}' uses single quotes, so it's plain text, not a pattern. Use \"{text}\".",
  "code.octave-default": '"{note}" has no octave, so it plays in octave 3. Did you mean "{suggest}"?',
  "code.letter-accidental":
    '"{note}" plays the right note; Oak writes sharps and flats as # and b: "{suggest}".',
  "code.scale-no-octave": '"{scale}" has no octave, so it starts in octave 3. Write "{suggest}".',
  "code.scale-spaces": 'Scale names use ":" instead of spaces: write "{suggest}".',
  "code.n-without-scale": '`n("…")` gives numbers, not pitches. Add `.scale("{key}")`, where 0 = degree 1.',
  "code.unknown-chord": '"{sym}" {why}. Write "{suggest}".',
  "code.lowercase-chord-root": 'Chord roots are capitals: "{suggest}".',
  "code.chord-not-in-dict": '"{sym}" {problem} in the "{dict}" dictionary. {fix}',
  "code.slash-chord": 'No "/" inside chord(): give the bass note "{bass}" to the bass: track.',
  "code.mode-above": '{what} is not used in Oak: use the default mode, `.mode("root:…")` or `.mode("duck")`.',
  "code.add-on-control":
    '`.add({arg})` does nothing here: wrap the argument in n(…), as in `.add(n("{inner}"))`.',
  "code.chromatic-step":
    '"{step}" is step {n} with an accidental: the number is the 0-based step, not the degree.',
  "code.range-spacing":
    'Strudel reads "{text}" as one word, not a range. Put a space on each side of the dots: "{suggest}".',
  "code.swing-convention":
    "`{fn}(…, {got})`: the second argument is the beats per bar ({beats}), or {double} for 16ths.",
  "code.swing-fraction-string":
    'A fraction inside quotes ("{text}") gives no swing: write the amount as a plain number, without quotes.',
  "code.time-fraction-string":
    '`.{fn}("{text}")` does not shift anything: write `.{fn}({text})` without quotes.',
  "code.arranged-scale-pattern":
    "`{name}` has a patterned .scale() inside an arrange() section: it restarts with the section. Put the key plan after arrange().",
  "code.setcpm-missing": "{detail}: start with a tempo line like `setcpm({example})`.",
  "code.setcpm-form": "{detail}",
  "code.transpose-after-scale":
    'Change key with a patterned `.scale("<…>")`, not `.transpose()` after `.scale()`.',
  "code.dict-after-voicing":
    '`.dict("{dict}")` after `.voicing()` changes nothing: the voicing is already chosen. Put it before: `.dict("{dict}").voicing()`.',
  "code.nudge-studio-only":
    "`.nudge()` does not move the notes the checker sees: use `.late(…)` or `.early(…)`.",
  "form.inconsistent-arrange": "The arrange() sections differ between tracks: {detail}.",
  "form.section-period": "`{name}` repeats every {period} bars, so a {bars}-bar section cuts it off.",
} as const satisfies Record<string, string>;

export type LintCode = keyof typeof LINT_TEMPLATES;

export function renderLint(id: LintCode, params: Record<string, string | number>): string {
  return LINT_TEMPLATES[id].replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** [authored code, learner in a graded step]. Studio is `info` for every dialect finding. */
const DIALECT: Partial<Record<LintCode, readonly [LintSeverity, LintSeverity]>> = {
  "eval.mini-parse": ["error", "error"],
  "code.uncatalogued": ["error", "warn"],
  "code.dollar-label": ["error", "info"],
  "code.label-unknown": ["error", "warn"],
  "code.label-solo-prefix": ["error", "error"],
  "code.muted-label": ["error", "info"],
  "code.label-duplicate": ["error", "warn"],
  "code.unlabelled-line": ["error", "warn"],
  "code.single-quoted-pattern": ["error", "error"],
  "code.octave-default": ["error", "info"],
  "code.letter-accidental": ["error", "info"],
  "code.scale-no-octave": ["error", "warn"],
  "code.scale-spaces": ["error", "error"],
  "code.n-without-scale": ["error", "error"],
  "code.unknown-chord": ["error", "error"],
  "code.lowercase-chord-root": ["error", "error"],
  "code.chord-not-in-dict": ["error", "error"],
  "code.slash-chord": ["error", "error"],
  "code.mode-above": ["error", "error"],
  "code.add-on-control": ["error", "error"],
  "code.chromatic-step": ["error", "warn"],
  "code.range-spacing": ["error", "error"],
  "code.swing-convention": ["error", "warn"],
  "code.swing-fraction-string": ["error", "error"],
  "code.time-fraction-string": ["error", "error"],
  "code.arranged-scale-pattern": ["error", "warn"],
  "code.setcpm-missing": ["error", "warn"],
  "code.setcpm-form": ["error", "info"],
  "code.transpose-after-scale": ["error", "warn"],
  "code.dict-after-voicing": ["error", "warn"],
  "code.nudge-studio-only": ["error", "error"],
  "form.inconsistent-arrange": ["error", "warn"],
  "form.section-period": ["error", "warn"],
};

/** Severity of a dialect finding; `override` replaces the learner (graded) severity for one finding. */
export function dialectSeverity(id: LintCode, profile: LintProfile, graded?: LintSeverity): LintSeverity {
  const row = DIALECT[id] ?? (["error", "warn"] as const);
  switch (profile) {
    case "studio":
      return "info";
    case "graded":
      return graded ?? row[1];
    default:
      return row[0];
  }
}

export const asFeedbackId = (id: LintCode): FeedbackId => id as FeedbackId;
