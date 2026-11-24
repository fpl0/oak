// The unit song as the app shows and plays it (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.2,
// §5.5; contracts §5.11). Pure: the content's `UnitSongDef`, the learner's song (`songs.get`) and the terms they have
// met go in; out come
//  - `songViewOf`: what every surface draws (sections as columns, parts as rows, each cell Oak's, yours or today's),
//    with a section's musical name and a part's name only once the learner has met the term (spec §4.3): letters
//    A, B, C… and plain part names before that;
//  - `songBandOf`: the song as it plays (`BandSetup.song`), for the composer in `@oak/strudel/song-compose`.
// Grading never reads any of it (spec §4.1).
import {
  type CellKey,
  cellKey,
  claimsOf,
  type FlavourId,
  isCellKey,
  type LessonId,
  OAK_OWNER,
  type PlayedParts,
  resolveGrid,
  type SongPartId,
  type SongSectionId,
  type SourceClaim,
  stepSectionIds,
  type TakeStep,
  type TermId,
  type UnitSongDef,
  type UnitSongDetail,
  type UnitSongPart,
  type UnitSongTake,
} from "@oak/api";
import { lintStrict } from "@oak/grader";
import { LIVE_SOURCE, type SongBand, songLengthBars } from "@oak/strudel/song-compose";

/** Who a cell belongs to on screen: Oak's part, a saved take of the learner's, or the Make open now. */
export type SongCellOwner = "oak" | "yours" | "today";

export interface SongViewSection {
  id: SongSectionId;
  /** The section kind (`verse`): what a learner's `arrange()` maps onto. */
  type: string;
  /** "A", "B"… until the learner has met the section's term; then its name ("Verse"). */
  label: string;
  /** The letter of its type by first appearance, always (A, B, A, C…). */
  letter: string;
  bars: number;
  /** 0-based first bar in the song. */
  startBar: number;
  /** Today's code plays here (the Make of the lesson being taken). */
  today: boolean;
}

export interface SongViewPart {
  id: SongPartId;
  /** The track label Oak's code plays it on (`mel`). */
  label: string;
  role: UnitSongPart["role"];
  /** `plainName` until the learner has met `termId`, then `name`. */
  name: string;
}

export interface SongViewCell {
  part: SongPartId;
  section: SongSectionId;
  owner: SongCellOwner;
  /** The lesson whose take plays this cell (owner `yours`). */
  lessonId?: LessonId;
  /** The take that plays it (owner `yours`). */
  takeId?: number;
  /** Oak's code rests here (`silence` in the part's `arrange()`): an Oak cell with nothing in it. */
  rests: boolean;
}

export interface SongView {
  unitId: string;
  title: string;
  flavour: FlavourId;
  /** `new` until the learner starts the song (the New song moment). */
  status: UnitSongDetail["status"] | "new";
  sections: SongViewSection[];
  parts: SongViewPart[];
  /** Section by section, parts in song order: one per part × section. */
  cells: SongViewCell[];
  takesCount: number;
  /** The song's take lessons (a side lesson has no number): "lesson 4 of 8" (`songLessonOf`). */
  lessonsInSong: number;
  lengthBars: number;
  /** The sections today's code plays in (empty without a Make open). */
  today: SongSectionId[];
}

// --- names gated by the terms the learner has met ----------------------------------------------------

/**
 * The term that names a section type. Verse and chorus come with U09.L02, bridge with U09.L03, the head with J1.
 * The other kinds have no term of their own: they are named once the learner has met the idea of a song's sections
 * at all (`term.form`, U09.L02); before that every section is a letter.
 */
const SECTION_TERMS: Readonly<Record<string, TermId>> = {
  verse: "term.verse",
  chorus: "term.chorus",
  bridge: "term.bridge",
  head: "term.head",
};
const FORM_TERM: TermId = "term.form";

const SECTION_NAMES: Readonly<Record<string, string>> = {
  intro: "Intro",
  verse: "Verse",
  pre: "Pre-chorus",
  prechorus: "Pre-chorus",
  chorus: "Chorus",
  bridge: "Bridge",
  solo: "Solo",
  break: "Break",
  head: "Head",
  vamp: "Vamp",
  lift: "Lift",
  outro: "Outro",
  ballad: "Ballad",
  drive: "Drive",
  a: "A",
  b: "B",
  c: "C",
};

/** The term a section type is named by (`verse` → `term.verse`; kinds without one wait for `term.form`). */
export function sectionTermOf(type: string): TermId {
  return SECTION_TERMS[type] ?? FORM_TERM;
}

/** Each section's letter: its type's place among the types by first appearance (A, B, A, C…). */
export function sectionLetters(def: Pick<UnitSongDef, "sections">): Record<SongSectionId, string> {
  const letters = new Map<string, string>();
  const out: Record<SongSectionId, string> = {};
  for (const s of def.sections) {
    if (!letters.has(s.type)) letters.set(s.type, String.fromCharCode(65 + (letters.size % 26)));
    out[s.id] = letters.get(s.type) as string;
  }
  return out;
}

/** What a section is called on screen: its name once its term is met, else its letter. */
export function sectionLabels(
  def: Pick<UnitSongDef, "sections">,
  introduced: ReadonlySet<string>,
): Record<SongSectionId, string> {
  const letters = sectionLetters(def);
  const out: Record<SongSectionId, string> = {};
  for (const s of def.sections) {
    const named = introduced.has(sectionTermOf(s.type)) && SECTION_NAMES[s.type] !== undefined;
    out[s.id] = named ? (SECTION_NAMES[s.type] as string) : (letters[s.id] as string);
  }
  return out;
}

/** A part's name on screen: `plainName` until its term is met (no term: `name` from the start). */
export function partNameOf(
  part: Pick<UnitSongPart, "name" | "plainName" | "termId">,
  introduced: ReadonlySet<string>,
) {
  return part.termId === undefined || introduced.has(part.termId) ? part.name : part.plainName;
}

// --- Oak's rests, read from its code ----------------------------------------------------------------------

/**
 * The cells where Oak's code rests: each part's track is one `arrange([bars, const], …)` (contracts §5.11 rule 6),
 * and a `silence` entry is a section the part sits out. Read statically; a track it cannot read rests nowhere.
 */
export function oakRestsOf(def: UnitSongDef, flavour: FlavourId): ReadonlySet<CellKey> {
  const code =
    (def.code as Partial<Record<FlavourId, string>>)[flavour] ?? def.code["flavour.pop" as FlavourId];
  const out = new Set<CellKey>();
  if (typeof code !== "string") return out;
  for (const part of def.parts) {
    const entries = arrangeEntriesOf(code, part.label);
    if (!entries || entries.length !== def.sections.length) continue;
    entries.forEach((name, i) => {
      const section = def.sections[i];
      if (section && name === "silence") out.add(cellKey(part.id, section.id));
    });
  }
  return out;
}

/** The const names of one labelled track's `arrange()`, in order, or `null` when the line is not that shape. */
function arrangeEntriesOf(code: string, label: string): string[] | null {
  const line = new RegExp(`^[ \\t]*${label}[ \\t]*:[ \\t]*arrange\\(`, "m").exec(code);
  if (!line) return null;
  let depth = 1;
  let i = line.index + line[0].length;
  const start = i;
  for (; i < code.length && depth > 0; i++) {
    if (code[i] === "(") depth++;
    else if (code[i] === ")") depth--;
  }
  if (depth !== 0) return null;
  const args = code.slice(start, i - 1);
  return [...args.matchAll(/\[\s*\d+(?:\.\d+)?\s*,\s*([A-Za-z_$][\w$]*)\s*\]/g)].map((m) => m[1] as string);
}

// --- the grid and the band -----------------------------------------------------------------------------

/** A take as the claims model reads it: its id as the source, its cells as stored (unknown keys dropped). */
export function takeClaimOf(take: Pick<UnitSongTake, "id" | "cells">): SourceClaim {
  return { sourceId: String(take.id), cells: take.cells.filter(isCellKey) };
}

/**
 * The takes that can play: code that is not empty and, for a take imported from a backup, code that passes the
 * strict lint first (contracts §11.3). The others leave their cells to Oak.
 */
export function playableTakes(detail: Pick<UnitSongDetail, "takes"> | null): UnitSongTake[] {
  return (detail?.takes ?? []).filter(
    (t) => t.code.trim() !== "" && !(t.reviewBeforeRun && lintStrict(t.code).length > 0),
  );
}

/** Who owns each cell from the saved takes, oldest first (a later take wins cell by cell). */
export function songGridOf(def: UnitSongDef, takes: readonly UnitSongTake[]): ReadonlyMap<CellKey, string> {
  return resolveGrid(def, takes.map(takeClaimOf));
}

/** The song's tempo: the newest take's (the learner owns the tempo from U01.L01), else Oak's. */
export function songBpmOf(
  def: Pick<UnitSongDef, "bpm">,
  takes: readonly Pick<UnitSongTake, "bpm">[],
): number {
  for (let i = takes.length - 1; i >= 0; i--) {
    const bpm = takes[i]?.bpm;
    if (typeof bpm === "number" && Number.isFinite(bpm) && bpm > 0) return bpm;
  }
  return def.bpm;
}

/**
 * The song as it plays (`BandSetup.song`): Oak's code in the song's style, every playable take as a source, and,
 * while a Make is open, its step as the live source that owns today's cells. `flavour` is the style to use while the
 * learner has no song yet (the profile's).
 */
export function songBandOf(
  def: UnitSongDef,
  detail: Pick<UnitSongDetail, "flavour" | "takes"> | null,
  opts: { flavour: FlavourId; live?: TakeStep | null },
): SongBand {
  const takes = playableTakes(detail);
  const band: SongBand = {
    def,
    flavour: detail?.flavour ?? opts.flavour,
    bpm: songBpmOf(def, takes),
    // Each take's saved labels (track → part): the composer keeps a take's lines on the parts they were saved for.
    sources: takes.map((t) => ({
      sourceId: String(t.id),
      lessonId: t.lessonId,
      code: t.code,
      labels: t.labels,
    })),
    grid: songGridOf(def, takes),
  };
  if (opts.live) band.live = { sourceId: LIVE_SOURCE, sections: opts.live.sections, step: opts.live };
  return band;
}

const NO_PLAYED: PlayedParts = { parts: new Set(), playsChords: false };

/**
 * What every surface draws. `live` is the take step of the Make open now: its sections are today's, and its cells
 * (its declared parts, plus `played` when the code has run) show as today's over the saved takes.
 */
export function songViewOf(
  def: UnitSongDef,
  detail: UnitSongDetail | null,
  introducedTerms: ReadonlySet<string>,
  opts: { live?: TakeStep | null; played?: PlayedParts | null; flavour?: FlavourId } = {},
): SongView {
  const flavour = detail?.flavour ?? opts.flavour ?? ("flavour.pop" as FlavourId);
  // The takes the song plays (`songBandOf`): an imported take that fails the strict lint leaves its cells to Oak,
  // so the grid draws them as Oak's.
  const takes = playableTakes(detail);
  const grid = songGridOf(def, takes);
  const byId = new Map(takes.map((t) => [String(t.id), t]));
  const today = opts.live ? stepSectionIds(def, opts.live) : [];
  const todayCells = new Set<CellKey>(opts.live ? claimsOf(def, opts.live, opts.played ?? NO_PLAYED) : []);
  const labels = sectionLabels(def, introducedTerms);
  const letters = sectionLetters(def);
  const rests = oakRestsOf(def, flavour);
  const todaySet = new Set(today);
  let at = 0;
  const sections: SongViewSection[] = def.sections.map((s) => {
    const out = {
      id: s.id,
      type: s.type,
      label: labels[s.id] as string,
      letter: letters[s.id] as string,
      bars: s.bars,
      startBar: at,
      today: todaySet.has(s.id),
    };
    at += s.bars;
    return out;
  });
  const cells: SongViewCell[] = [];
  for (const s of def.sections)
    for (const p of def.parts) {
      const key = cellKey(p.id, s.id);
      if (todayCells.has(key)) {
        cells.push({ part: p.id, section: s.id, owner: "today", rests: false });
        continue;
      }
      const owner = grid.get(key) ?? OAK_OWNER;
      const take = owner === OAK_OWNER ? undefined : byId.get(owner);
      if (take)
        cells.push({
          part: p.id,
          section: s.id,
          owner: "yours",
          lessonId: take.lessonId,
          takeId: take.id,
          rests: false,
        });
      else cells.push({ part: p.id, section: s.id, owner: "oak", rests: rests.has(key) });
    }
  return {
    unitId: def.unit,
    title: detail?.title ?? def.title,
    flavour,
    status: detail?.status ?? "new",
    sections,
    parts: def.parts.map((p) => ({
      id: p.id,
      label: p.label,
      role: p.role,
      name: partNameOf(p, introducedTerms),
    })),
    cells,
    takesCount: detail?.takesCount ?? 0,
    lessonsInSong: def.plan.filter((p) => p.kind === "take").length,
    lengthBars: songLengthBars(def),
    today,
  };
}
