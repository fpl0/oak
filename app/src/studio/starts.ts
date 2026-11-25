// Oak 2.0 W1 starting points (PLAN §4 S2): the New sketch dialog's starts that are the learner's own or carry no
// habit of Oak's. Oak's Blank and the learner's Blank, drums and bass first, plain start, fill it all, and a sketch
// from one of the learner's templates. Every line an Oak start writes is in `OAK_DEFAULTS.lines` (model.ts), and
// every pattern it writes is a rest: a start names parts and plain sounds, never notes or a rhythm. Pure: tested in
// starts.test.ts.
import { constDecls, labelledLines, type SketchCreate, type UserTemplate } from "@oak/api";
import type { MeterId } from "@oak/content-kit";
import { METERS } from "@oak/theory";
import { BLANK_CODE, START_LINES } from "./model.ts";

/** `setcpm(90/4)`: the tempo line for a tempo in BPM and a meter (cycles per minute = BPM over beats a bar). */
export function tempoLine(bpm: number, meter: MeterId): string {
  return `setcpm(${bpm}/${METERS[meter].unitsPerBar})`;
}

/** Drums and bass first: the tempo, a comment, an empty drum part and an empty bass part with a plain sound. */
export function drumsAndBassCode(bpm: number, meter: MeterId): string {
  return [
    tempoLine(bpm, meter),
    "",
    START_LINES.drumsBassComment,
    START_LINES.drums,
    START_LINES.bass,
    "",
  ].join("\n");
}

/** Plain start: four empty parts (drums, bass, chords, a tune), each role on its plain sound. */
export function plainStartCode(bpm: number, meter: MeterId): string {
  return [
    tempoLine(bpm, meter),
    "",
    START_LINES.plainComment,
    START_LINES.drums,
    START_LINES.bass,
    START_LINES.chords,
    START_LINES.mel,
    "",
  ].join("\n");
}

/**
 * Fill it all's section counts: the learner picks one; 4 is preselected. Oak's call, loose: a common song length
 * in sections, never shown as a target.
 */
export const FILL_SECTIONS = { choices: [2, 3, 4, 6, 8] as const, preselected: 4 } as const;
export type FillSections = (typeof FILL_SECTIONS.choices)[number];

const LABEL_HEAD = /^\s*[A-Za-z_$][\w$]*\s*:(?!:)\s*/;
const ARRANGE = /\barrange\s*\(/;

/**
 * Fill it all (STYLE §10): every labelled, unmuted part becomes a section const `<label>A` (written where the part
 * was, so the consts it uses stay above it and appear once) and one `arrange()` per part at the end, the same
 * sections and bar counts on every track: every part plays in every section, and the learner carves from there.
 * The tempo line, comments, consts and muted parts stay as written. A piece already in sections (`arrange(`) and
 * a piece with no part are refused.
 */
export function fillItAllCode(
  source: string,
  o: { sections: number; bars: number },
): { code: string } | { error: "has-sections" | "no-parts" } {
  const lines = labelledLines(source);
  const consts = constDecls(source);
  if ([...lines, ...consts].some((s) => ARRANGE.test(s.text))) return { error: "has-sections" };
  const parts = lines.filter((l) => !l.muted);
  if (parts.length === 0) return { error: "no-parts" };

  const taken = new Set(consts.map((d) => d.name));
  const named = parts.map((part) => {
    // `$:` has no role to name it by (STYLE §10 names sections `<role><Section>`).
    const base = part.label === "$" ? "part" : part.label;
    let name = `${base}A`;
    for (let n = 2; taken.has(name); n++) name = `${base}A${n}`;
    taken.add(name);
    const expr = part.text.replace(LABEL_HEAD, "");
    return { part, name, expr };
  });

  let code = source;
  for (const { part, name, expr } of [...named].reverse()) {
    code = `${code.slice(0, part.from)}const ${name} = ${expr}${code.slice(part.to)}`;
  }
  const sections = Math.max(1, Math.round(o.sections));
  const bars = Math.max(1, Math.round(o.bars));
  const arranged = named.map(({ part, name }) => {
    const entries = Array.from({ length: sections }, () => `[${bars}, ${name}]`).join(", ");
    return `${part.label}: arrange(${entries})`;
  });
  return { code: `${code.trimEnd()}\n\n${arranged.join("\n")}\n` };
}

interface StartOptions {
  title: string;
  sessionId: string | null;
}

function flagsFor(t: UserTemplate | null): SketchCreate["flags"] {
  return {
    lockedTools: [],
    previewTools: [],
    ...(t?.reviewBeforeRun === true ? { reviewBeforeRun: true as const } : {}),
  };
}

function freeSketch(o: StartOptions): Omit<SketchCreate, "code" | "bpm" | "meter" | "note" | "flags"> {
  return {
    title: o.title,
    originKind: "free",
    originId: null,
    sessionId: o.sessionId,
    key: null,
    band: null,
    analysis: null,
    tutorAssisted: false,
    ranOk: false,
  };
}

/**
 * A Blank sketch: the learner's own Blank (its code, tempo and meter) when they have one, else Oak's Blank with the
 * tempo they chose. A Blank to review (from a backup) starts a sketch to review.
 */
export function blankStartBody(
  t: UserTemplate | null,
  o: StartOptions & { bpm: number; meter: MeterId },
): SketchCreate {
  if (t) {
    return {
      ...freeSketch(o),
      code: t.code,
      bpm: t.bpm ?? o.bpm,
      meter: t.meter ?? o.meter,
      note: "From your Blank",
      flags: flagsFor(t),
    };
  }
  return {
    ...freeSketch(o),
    code: BLANK_CODE.replace("setcpm(90/4)", tempoLine(o.bpm, o.meter)),
    bpm: o.bpm,
    meter: o.meter,
    note: null,
    flags: flagsFor(null),
  };
}

/** A sketch from one of the learner's templates: its code, tempo and meter; to review when the template is. */
export function templateStartBody(t: UserTemplate, o: StartOptions): SketchCreate {
  return {
    ...freeSketch(o),
    code: t.code,
    bpm: t.bpm,
    meter: t.meter,
    note: `From your template “${t.name}”`,
    flags: flagsFor(t),
  };
}

/** "84 BPM, 4/4; parts: drums, bass": what a template of the learner's starts with. */
export function templateStartDetail(t: Pick<UserTemplate, "code" | "bpm" | "meter">): string {
  const parts = [...new Set(labelledLines(t.code).map((l) => l.label))];
  const tempo = [t.bpm !== null ? `${t.bpm} BPM` : null, t.meter].filter((x): x is string => x !== null);
  const head = tempo.join(", ");
  if (parts.length === 0) return head ? `${head}; no parts yet` : "No parts yet";
  const list = `parts: ${parts.join(", ")}`;
  return head ? `${head}; ${list}` : list.charAt(0).toUpperCase() + list.slice(1);
}

/** The detail line of each start in the New sketch dialog (descriptive: starts.test.ts checks each). */
export const START_DETAILS = {
  oakBlank: "A tempo line, nothing else. You choose the tempo.",
  overBand: "A read-only backing in your key and tempo; you write the parts on top.",
  drumsAndBass: "An empty drum part and an empty bass part: write the drums, then a bass that fits them.",
  fromHead: "Hum, tap or record an idea; it becomes the first line of a new sketch.",
  fillItAll:
    "A copy of one of your sketches in sections, every part playing in every one; you take out what you like.",
  plainStart: "Four empty parts (drums, bass, chords and a tune), each on a plain sound for now.",
  fromScraps: "Pick lines you have written before and put them together in a new sketch.",
} as const;

/** Headings and notes of the dialog's groups (descriptive). */
export const START_HEADINGS = {
  yourTemplates: "Your templates",
  manageTemplates: "Your templates…",
  learningKits: "Learning kits",
  learningKitsNote: "Oak's songs to learn from; your own starting points are above.",
} as const;

/** Fill it all's two refusals, in plain words. */
export const FILL_REFUSALS = {
  "has-sections": "That sketch is already in sections. Pick another one, or carve this one where it is.",
  "no-parts": "That sketch has no part yet: give it a line with a name and a colon first.",
} as const;

/** The words of "Make this my Blank", "Save as a template…" and Your templates (descriptive). */
export const TEMPLATE_COPY = {
  menu: "Starting point",
  makeBlank: "Make this my Blank",
  saveTemplate: "Save as a template…",
  blankAbout:
    "Your Blank keeps this sketch's tempo, meter and sounds, and none of its notes. New sketches start from it.",
  templateAbout:
    "A template keeps this sketch's tempo, meter and sounds, and none of its notes. It is listed when you start a sketch.",
  fromSaved: "It reads the last saved version; changes since then are not in it.",
  blankShown: "Your Blank starts like this:",
  templateShown: "Your template starts like this:",
  isBlank: "Your Blank",
  makeItBlank: "Make it my Blank",
  stopBlank: "Stop using it as my Blank",
  review: "From a backup: Oak checks it before a sketch from it plays.",
  none: "No templates yet. In a sketch, choose Starting point, then Make this my Blank or Save as a template.",
  deleteQuestion: (name: string) =>
    `Delete the template “${name}”? Sketches you started from it stay as they are. This cannot be undone.`,
} as const;
