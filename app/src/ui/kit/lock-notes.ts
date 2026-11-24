// The one wording of a lock note: where something closed opens, said in words (shared decision 5: an id such as
// U02.L02, U13.CP or J2.L03 never stands alone in learner copy). The map, the track lenses, the shortcut sheet, the
// track card and the shell's track lines all say it through these, so the same gate reads the same everywhere.

/** "the unit 13 checkpoint" for a core checkpoint; a track's own by its title ("Jazz checkpoint 1"), else "its checkpoint". */
export function checkpointWords(ref: string, title?: string | null): string {
  const unit = /^U(\d+)\.CP$/.exec(ref);
  if (unit) return `the unit ${Number(unit[1])} checkpoint`;
  return title ?? "its checkpoint";
}

/**
 * A lesson in words: "the lesson “Extensions”" with its title; without one, its place in a core unit ("lesson 2 of
 * unit 3"), else "a later lesson".
 */
export function lessonWords(ref: string, title?: string | null): string {
  if (title) return `the lesson “${title}”`;
  const core = /^U(\d+)\.L(\d+)$/.exec(ref);
  return core ? `lesson ${Number(core[2])} of unit ${Number(core[1])}` : "a later lesson";
}

/** "unit 9, Form" for a core unit (its title when known); a track's unit by its title alone. */
export function unitWords(unitId: string, title?: string | null): string {
  const core = /^U(\d+)$/.exec(unitId);
  if (core) return title ? `unit ${Number(core[1])}, ${title}` : `unit ${Number(core[1])}`;
  return title ? `the unit “${title}”` : "a later unit";
}

/** "Opens with the lesson “Extensions”.", "Opens with unit 9, Form.", "Opens with the unit 13 checkpoint." */
export function opensWithNote(place: string): string {
  return `Opens with ${place}.`;
}

/** "Opens with the unit 13 checkpoint." (course-state's track note while a gate is closed). */
export function opensWithCheckpoint(ref: string, title?: string | null): string {
  return opensWithNote(checkpointWords(ref, title));
}

/**
 * What a waiting track waits for, from the gate's first unmet requirement: "Waits for the unit 13 checkpoint.",
 * "Waits for lesson 2 of unit 3." The server's own label ("U13 checkpoint passed") leads with an id, so the words
 * come from the requirement's ref and kind.
 */
export function waitsForNote(req: GateRequirement, title?: string | null): string {
  return `Waits for ${requirementWords(req, title)}.`;
}

/** A gate's requirement in words: "the unit 13 checkpoint", "lesson 2 of unit 3", "the lesson “Extensions”". */
export function requirementWords(req: GateRequirement, title?: string | null): string {
  return req.kind === "checkpoint" ? checkpointWords(req.ref, title) : lessonWords(req.ref, title);
}

type GateRequirement = { ref: string; kind: "checkpoint" | "lesson" };
