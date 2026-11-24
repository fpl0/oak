// Unit songs (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.1): every unit is one song that Oak
// plays whole from day one, and each lesson's Make takes over cells of it (a part in a section). The names
// `SongDef`, `SongId` and `song.*` already mean the repertoire, so this type is `UnitSongDef`, its ids are
// `usong.<UNIT>` and its files `content/unit-songs/<UNIT>.ts` (never `song.ts`: the server globs those).
//
// The zod schema lives here rather than in ../zod.ts: zod.ts imports this folder at runtime, so a schema here that
// used zod.ts's building blocks would close an import cycle. It is built from `zod`, ../ids.ts and ./common.ts only.
import { z } from "zod";
import {
  type CheckpointId,
  FLAVOUR_IDS,
  type FlavourId,
  ID_PATTERNS,
  type LessonId,
  parseLessonId,
  type TermId,
  type UnitId,
  type UnitSongId,
} from "../ids.ts";
import {
  type KeySpec,
  METER_IDS,
  type MeterId,
  SCALE_MODES,
  TRACK_LABELS,
  type TrackLabel,
} from "./common.ts";

/**
 * A section's id inside its song (`intro`, `verse1`, `chorus2`): a slug, unique in the song. Learner takes are
 * keyed by it, so it never changes once a song has shipped (a removed id falls back to Oak, spec §5.6).
 */
export type SongSectionId = string;
/** A part's id inside its song (`kick`, `bass`, `lead`): a slug, unique in the song, stable like a section id. */
export type SongPartId = string;

export const SONG_PART_ROLES = ["drums", "bass", "chords", "melody", "pad"] as const;
export type SongPartRole = (typeof SONG_PART_ROLES)[number];

/**
 * Section kinds (STYLE §10 rule 1, plus `prechorus` of the form lens): what a section is called once its term is
 * introduced, and how a learner's `arrange()` maps onto the song (its `melVerse` fills every section of type verse).
 */
export const UNIT_SONG_SECTION_TYPES = [
  "intro",
  "verse",
  "pre",
  "prechorus",
  "chorus",
  "bridge",
  "solo",
  "break",
  "head",
  "vamp",
  "lift",
  "outro",
  "ballad",
  "drive",
  "a",
  "b",
  "c",
] as const;
export type UnitSongSectionType = (typeof UNIT_SONG_SECTION_TYPES)[number];

export interface UnitSongSection {
  id: SongSectionId;
  /** The section kind (`UNIT_SONG_SECTION_TYPES`): display names and the mapping of a learner's `arrange()`. */
  type: string;
  /** A whole multiple of 4, or 1 for a one-bar stop or pickup. */
  bars: number;
  /** Overrides the song's key in this section (a key change, a modal section, a minor bridge). */
  key?: KeySpec;
}

export interface UnitSongPart {
  id: SongPartId;
  /** The track label in Oak's code (STYLE §2, lowercase): Oak's track plays as `band.oak.<label>`. */
  label: string;
  role: SongPartRole;
  /** Drum parts only, and required there: the sound names this part owns (`bd` → kick; `sd`, `rim`, `cp` → snare). */
  sounds?: string[];
  /** The part's musical name ("Melody"), shown once `termId` is introduced (always, without a `termId`). */
  name: string;
  /** The part's name before its term is introduced ("Tune"). */
  plainName: string;
  termId?: TermId;
}

/** A lesson whose Make takes over cells of the song. */
export interface TakeStep {
  lesson: LessonId;
  kind: "take";
  /** Where this Make's code plays in the song. */
  sections: SongSectionId[] | "all";
  /** The parts it is expected to take there (content CI: ⊇ the parts the reference code plays). */
  parts: SongPartId[];
  /** Oak pitched parts that keep playing under a take that plays chords (content CI clash-checks them). */
  oakKeeps?: SongPartId[];
  /** Open with the lesson's authored starter, or with the learner's code of an earlier take step of this song. */
  startFrom: "oak" | LessonId;
  /** One line for Today and the lesson card: at most 20 words, in the lesson's own vocabulary. */
  today: string;
}
/** A lesson whose Make stays a standalone sketch (a 3/4 lesson in a 4/4 song). */
export interface SideStep {
  lesson: LessonId;
  kind: "side";
  /** Why, in one line for the lesson card. */
  reason: string;
}
export type TakeoverStep = TakeStep | SideStep;

export interface UnitSongDef {
  id: UnitSongId;
  unit: UnitId;
  /** Bump when Oak's code or the plan changes (spec §5.6): takes are kept, cells that no longer exist fall back to Oak. */
  version: number;
  /** Oak's working title; the learner may rename their copy. */
  title: string;
  /** Every take step's Make is in this meter. */
  meter: MeterId;
  /** Every pitched take step's Make is in this key (or its section's key). */
  key: KeySpec;
  /** Oak's tempo until the learner sets one. */
  bpm: number;
  /** In form order. At most 64 bars in all (the Workbench analysis limit). */
  sections: UnitSongSection[];
  parts: UnitSongPart[];
  /**
   * Oak's whole song per flavour: no tempo line, one labelled track per part (label = `part.label`), sections as
   * consts named `<label><Section>` and one `arrange()` per track listing the song's sections (STYLE §10,
   * contracts §6.3). Lint profile `band`; locked tools are allowed (a preview context).
   */
  code: Record<FlavourId, string>;
  /** One entry per lesson of the unit, in syllabus order. */
  plan: TakeoverStep[];
  /** The song can be released once this lesson or checkpoint is complete. */
  releaseAfter: LessonId | CheckpointId;
}

// --- zod ----------------------------------------------------------------------------------------

const MAX_BARS = 64;
const MAX_TODAY_WORDS = 20;
const SLUG = /^[a-z][a-z0-9-]*$/;
const LABEL = /^([a-z]+)([2-4])?$/;
const DRUM_SOUND = /^[a-z][a-z0-9]*$/;

/** The roles a part may take under each STYLE §2 label (contracts §6.2): `fx` has none, so it is never a part. */
const LABEL_PART_ROLES: Readonly<Record<TrackLabel, readonly SongPartRole[]>> = {
  drums: ["drums"],
  kick: ["drums"],
  snare: ["drums"],
  hats: ["drums"],
  perc: ["drums"],
  bass: ["bass"],
  chords: ["chords"],
  pad: ["pad", "chords"],
  mel: ["melody"],
  vox: ["melody"],
  keys: ["chords", "melody", "pad"],
  gtr: ["chords", "melody", "pad"],
  horns: ["chords", "melody", "pad"],
  fx: [],
};

const idOf = <T>(re: RegExp, what: string) =>
  z.string().regex(re, `expected a ${what} ID (contracts §1.2)`) as unknown as z.ZodType<T>;
const slug = z.string().regex(SLUG, "expected a slug: a lower-case letter, then letters, digits and hyphens");
const lessonId = idOf<LessonId>(ID_PATTERNS.lesson, "lesson");
const keySpec: z.ZodType<KeySpec> = z.strictObject({
  tonic: z.string().regex(/^[A-G](?:#|b)?$/, 'expected a spelled tonic like "Eb" or "F#"'),
  mode: z.enum(SCALE_MODES),
});

const sectionSchema: z.ZodType<UnitSongSection> = z.strictObject({
  id: slug,
  type: z.enum(UNIT_SONG_SECTION_TYPES),
  bars: z.number().int().positive(),
  key: keySpec.exactOptional(),
});
const partSchema: z.ZodType<UnitSongPart> = z.strictObject({
  id: slug,
  label: z.string().min(1),
  role: z.enum(SONG_PART_ROLES),
  sounds: z.array(z.string()).exactOptional(),
  name: z.string().min(1),
  plainName: z.string().min(1),
  termId: idOf<TermId>(ID_PATTERNS.term, "term").exactOptional(),
});
const takeSchema = z.strictObject({
  lesson: lessonId,
  kind: z.literal("take"),
  sections: z.union([z.literal("all"), z.array(slug).min(1)]),
  parts: z.array(slug).min(1),
  oakKeeps: z.array(slug).exactOptional(),
  startFrom: z.union([z.literal("oak"), lessonId]),
  today: z.string().trim().min(1),
});
const sideSchema = z.strictObject({
  lesson: lessonId,
  kind: z.literal("side"),
  reason: z.string().trim().min(1),
});

/** The labelled tracks of a code: label → each statement's text (its line and the indented lines after it). */
function labelledTracks(code: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let list: string[] | null = null;
  for (const line of code.split("\n")) {
    const m = /^([A-Za-z_$][\w$]*)\s*:(?!:)/.exec(line);
    if (m) {
      const label = m[1] as string;
      list = out.get(label) ?? [];
      list.push(line);
      out.set(label, list);
    } else if (list && /^\s+\S/.test(line)) list[list.length - 1] += `\n${line}`;
    else list = null;
  }
  return out;
}

/** `kickChorus2` → `chorus`, as the grader's `sectionName` reads a section const (contracts §6.3). */
function sectionTypeOf(identifier: string): string {
  const m = /^[a-z][a-z0-9]*?([A-Z][A-Za-z0-9]*)$/.exec(identifier);
  const tag = (m ? (m[1] as string) : identifier).toLowerCase();
  return tag.replace(/\d+$/, "") || tag;
}

/**
 * The `[bars, section]` entries of the first `arrange(…)` in a track, or `null` without one. An entry whose bars
 * are not an integer literal comes back with `bars: NaN`, one whose section is not an identifier with `name: ""`.
 */
function arrangeEntries(track: string): { bars: number; name: string }[] | null {
  const at = track.indexOf("arrange(");
  if (at < 0) return null;
  const entries: { bars: number; name: string }[] = [];
  let paren = 1;
  let bracket = 0;
  let start = -1;
  for (let i = at + "arrange(".length; i < track.length && paren > 0; i++) {
    const c = track[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < track.length && track[i] !== c; i++) if (track[i] === "\\") i++;
      continue;
    }
    if (c === "(") paren++;
    else if (c === ")") paren--;
    else if (c === "[") {
      if (paren === 1 && bracket === 0) start = i + 1;
      bracket++;
    } else if (c === "]") {
      bracket--;
      if (paren === 1 && bracket === 0 && start >= 0) {
        const body = track.slice(start, i);
        const comma = body.indexOf(",");
        const bars = comma < 0 ? "" : body.slice(0, comma).trim();
        const name = comma < 0 ? body.trim() : body.slice(comma + 1).trim();
        entries.push({
          bars: /^\d+$/.test(bars) ? Number(bars) : Number.NaN,
          name: /^[A-Za-z_$][\w$]*$/.test(name) ? name : "",
        });
        start = -1;
      }
    }
  }
  return entries;
}

/** Problems of one flavour's code against the song's parts and sections (static: nothing is evaluated here). */
function codeIssues(
  code: string,
  parts: readonly UnitSongPart[],
  sections: readonly UnitSongSection[],
): string[] {
  const issues: string[] = [];
  if (/\bset(?:cpm|cps)\s*\(|\.cpm\s*\(/.test(code))
    issues.push("no tempo line: the song plays at the learner's tempo (or `bpm`)");
  const tracks = labelledTracks(code);
  const labels = new Set(parts.map((p) => p.label));
  for (const [label, list] of tracks) {
    if (!labels.has(label)) issues.push(`"${label}:" is not the label of a part`);
    else if (list.length > 1) issues.push(`"${label}:" is written ${list.length} times`);
  }
  const want = sections.map((s) => s.bars).join(", ");
  for (const part of parts) {
    const track = tracks.get(part.label)?.[0];
    if (track === undefined) {
      issues.push(`no "${part.label}:" track`);
      continue;
    }
    const entries = arrangeEntries(track);
    if (entries === null) {
      issues.push(`"${part.label}:" is not arranged: one arrange() per track, in the song's sections`);
      continue;
    }
    if (entries.some((e) => Number.isNaN(e.bars) || e.name === "")) {
      issues.push(`"${part.label}:" arrange() entries are [bars, sectionConst] pairs`);
      continue;
    }
    const got = entries.map((e) => e.bars).join(", ");
    if (got !== want) {
      issues.push(`"${part.label}:" arranges bars [${got}]; the song's sections are [${want}]`);
      continue;
    }
    entries.forEach((e, i) => {
      const section = sections[i] as UnitSongSection;
      if (e.name !== "silence" && sectionTypeOf(e.name) !== section.type)
        issues.push(
          `"${part.label}:" plays ${e.name} in section ${i + 1} (${section.id}), a ${section.type}: name it ${part.label}${section.type[0]?.toUpperCase()}${section.type.slice(1)}`,
        );
    });
  }
  return issues;
}

const wordCount = (s: string): number => s.split(/\s+/).filter((w) => w !== "").length;

/** The `UnitSongDef` schema: shape, then the cross-field rules of spec §5.1 (as issues at the offending path). */
export const unitSongSchema: z.ZodType<UnitSongDef> = z
  .strictObject({
    id: idOf<UnitSongId>(ID_PATTERNS.unitSong, "unit song"),
    unit: idOf<UnitId>(ID_PATTERNS.unit, "unit"),
    version: z.number().int().positive(),
    title: z.string().trim().min(1).max(60),
    meter: z.enum(METER_IDS),
    key: keySpec,
    bpm: z.number().min(40).max(240),
    sections: z.array(sectionSchema).min(1),
    parts: z.array(partSchema).min(1),
    code: z.record(z.enum(FLAVOUR_IDS), z.string().min(1)),
    plan: z.array(z.discriminatedUnion("kind", [takeSchema, sideSchema])).min(1),
    releaseAfter: z
      .string()
      .refine(
        (s) => ID_PATTERNS.lesson.test(s) || ID_PATTERNS.checkpoint.test(s),
        "expected a lesson or checkpoint ID",
      ) as unknown as z.ZodType<LessonId | CheckpointId>,
  })
  .superRefine((def, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    if (def.id !== `usong.${def.unit}`) issue(["id"], `the song of ${def.unit} is usong.${def.unit}`);

    // Sections: unique ids, whole fours (or a one-bar stop), 64 bars at most.
    const sectionIds = new Set<string>();
    def.sections.forEach((s, i) => {
      if (sectionIds.has(s.id)) issue(["sections", i, "id"], `section "${s.id}" is defined twice`);
      sectionIds.add(s.id);
      if (s.bars !== 1 && s.bars % 4 !== 0)
        issue(
          ["sections", i, "bars"],
          `${s.bars} bars: a section is a whole multiple of 4 bars, or a one-bar stop`,
        );
    });
    const total = def.sections.reduce((n, s) => n + s.bars, 0);
    if (total > MAX_BARS) issue(["sections"], `${total} bars: a song has at most ${MAX_BARS}`);

    // Parts: unique ids and labels, STYLE §2 labels, a role the label allows, drum sounds on drum parts only.
    const partIds = new Set<string>();
    const partLabels = new Set<string>();
    const soundOwner = new Map<string, string>();
    def.parts.forEach((p, i) => {
      if (partIds.has(p.id)) issue(["parts", i, "id"], `part "${p.id}" is defined twice`);
      partIds.add(p.id);
      if (partLabels.has(p.label)) issue(["parts", i, "label"], `label "${p.label}" is used by two parts`);
      partLabels.add(p.label);
      const m = LABEL.exec(p.label);
      const base = m?.[1] as TrackLabel | undefined;
      if (!m || !base || !(TRACK_LABELS as readonly string[]).includes(base))
        issue(
          ["parts", i, "label"],
          `"${p.label}" is not a STYLE §2 label (${TRACK_LABELS.join(" ")}, or one with 2–4)`,
        );
      else if (!LABEL_PART_ROLES[base].includes(p.role))
        issue(
          ["parts", i, "role"],
          `a "${p.label}" part plays ${LABEL_PART_ROLES[base].join(" or ") || "no role"}, not ${p.role}`,
        );
      if (p.role === "drums") {
        if (!p.sounds || p.sounds.length === 0)
          issue(["parts", i, "sounds"], 'a drum part names the sounds it owns (`sounds: ["bd"]`)');
        for (const [j, sound] of (p.sounds ?? []).entries()) {
          if (!DRUM_SOUND.test(sound))
            issue(["parts", i, "sounds", j], `"${sound}" is not a drum sound name (bd, sd, hh, cr…)`);
          else if (soundOwner.has(sound))
            issue(["parts", i, "sounds", j], `"${sound}" already belongs to part "${soundOwner.get(sound)}"`);
          else soundOwner.set(sound, p.id);
        }
      } else if (p.sounds !== undefined) issue(["parts", i, "sounds"], "only drum parts have sounds");
    });

    // Oak's code, per flavour.
    for (const f of FLAVOUR_IDS) {
      const code = def.code[f];
      if (typeof code !== "string") continue;
      for (const message of codeIssues(code, def.parts, def.sections)) issue(["code", f], message);
    }

    // The plan: one entry per lesson of this unit; takes name real sections and parts.
    const pitched = new Set(def.parts.filter((p) => p.role !== "drums").map((p) => p.id));
    const seen = new Set<string>();
    const takesBefore = new Set<string>();
    def.plan.forEach((step, i) => {
      if (seen.has(step.lesson)) issue(["plan", i, "lesson"], `${step.lesson} is in the plan twice`);
      seen.add(step.lesson);
      if (parseLessonId(step.lesson)?.unit !== def.unit)
        issue(["plan", i, "lesson"], `${step.lesson} is not a lesson of ${def.unit}`);
      if (step.kind === "take") {
        if (step.sections !== "all") {
          const dup = new Set<string>();
          step.sections.forEach((s, j) => {
            if (!sectionIds.has(s)) issue(["plan", i, "sections", j], `"${s}" is not a section of this song`);
            else if (dup.has(s)) issue(["plan", i, "sections", j], `"${s}" is listed twice`);
            dup.add(s);
          });
        }
        const dup = new Set<string>();
        step.parts.forEach((p, j) => {
          if (!partIds.has(p)) issue(["plan", i, "parts", j], `"${p}" is not a part of this song`);
          else if (dup.has(p)) issue(["plan", i, "parts", j], `"${p}" is listed twice`);
          dup.add(p);
        });
        (step.oakKeeps ?? []).forEach((p, j) => {
          if (!partIds.has(p)) issue(["plan", i, "oakKeeps", j], `"${p}" is not a part of this song`);
          else if (!pitched.has(p))
            issue(["plan", i, "oakKeeps", j], `"${p}" is a drum part; oakKeeps names pitched parts`);
          else if (step.parts.includes(p))
            issue(["plan", i, "oakKeeps", j], `"${p}" is taken by this step, so Oak cannot keep it`);
        });
        if (step.startFrom !== "oak" && !takesBefore.has(step.startFrom))
          issue(["plan", i, "startFrom"], `${step.startFrom} is not an earlier take step of this song`);
        if (wordCount(step.today) > MAX_TODAY_WORDS)
          issue(
            ["plan", i, "today"],
            `${wordCount(step.today)} words: a today line has at most ${MAX_TODAY_WORDS}`,
          );
        takesBefore.add(step.lesson);
      }
    });
    const lastTake = def.plan.findLastIndex((s) => s.kind === "take");
    const release = def.plan.findIndex((s) => s.lesson === def.releaseAfter);
    if (release >= 0 && release < lastTake)
      issue(
        ["releaseAfter"],
        `${def.releaseAfter} comes before the last take step (${def.plan[lastTake]?.lesson})`,
      );
  });
