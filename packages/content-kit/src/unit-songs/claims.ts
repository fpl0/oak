// The claims model of unit songs (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.2, §5.6). A song is
// a grid of cells, one per part × section. Takes are applied in order and a later take overrides an earlier one cell
// by cell; every cell nobody has taken is Oak's. Pure: no Strudel, no I/O. The composer (@oak/grader/song, re-exported
// as @oak/strudel/song-compose), the server and the app all ask this module who owns what, so they never disagree.
import type { SongPartId, SongPartRole, SongSectionId, TakeStep, UnitSongDef } from "../schema/index.ts";

/** One cell of the grid: `<part>@<section>` (`kick@verse`). Part and section ids are slugs, so `@` never occurs in them. */
export type CellKey = `${SongPartId}@${SongSectionId}`;

/** The owner of every cell that no take holds. A take's `sourceId` is never `"oak"`. */
export const OAK_OWNER = "oak" as const;

/** What a take's code actually plays, as read from its evaluated tracks (the app computes it; see `drumPartsOfSound`). */
export interface PlayedParts {
  /** Every part the code plays: drum hits by sound (`drumPartsOfSound`), pitched tracks by label and role (`partOfTrack`). */
  parts: ReadonlySet<SongPartId>;
  /** The code plays chords (a track whose role is chords): it then takes Oak's pitched parts, except `oakKeeps`. */
  playsChords: boolean;
}

/** The cells one source (a saved take, or the live Make) claims, in the order the takes were recorded. */
export interface SourceClaim {
  sourceId: string;
  cells: readonly CellKey[];
}

export const cellKey = (part: SongPartId, section: SongSectionId): CellKey => `${part}@${section}`;

/** `kick@verse` → `{ part: "kick", section: "verse" }`; `null` for anything that is not a cell key. */
export function parseCellKey(key: string): { part: SongPartId; section: SongSectionId } | null {
  const at = key.indexOf("@");
  if (at <= 0 || at === key.length - 1 || key.indexOf("@", at + 1) >= 0) return null;
  return { part: key.slice(0, at), section: key.slice(at + 1) };
}
export const isCellKey = (key: string): key is CellKey => parseCellKey(key) !== null;

/** The sections a take step plays in, in song order: `'all'` is every section; ids the song lacks are dropped. */
export function stepSectionIds(def: UnitSongDef, step: Pick<TakeStep, "sections">): SongSectionId[] {
  const ids = def.sections.map((s) => s.id);
  if (step.sections === "all") return ids;
  const wanted = new Set(step.sections);
  return ids.filter((id) => wanted.has(id));
}

/** The percussion names a song's drum parts list (`cb` cowbell, `tb` tambourine, `sh` shaker, `perc`, `misc`). */
const PERCUSSION: readonly string[] = ["perc", "cb", "tb", "sh", "misc"];

/**
 * Sound pack v4 hits that a song's parts may not list (the songs were written with the kit names), read as the sounds
 * they stand in for: a conga, bongo or clave hit and the foley one-shots are percussion, `sbd` (a synthesised kick)
 * is a kick. Asked only when no part lists the name itself, so no listed name changes part.
 */
const STANDS_FOR: Readonly<Record<string, readonly string[]>> = {
  conga: PERCUSSION,
  bongo: PERCUSSION,
  clave: PERCUSSION,
  foley: PERCUSSION,
  snap: PERCUSSION,
  impact: PERCUSSION,
  swoosh: PERCUSSION,
  scratch: PERCUSSION,
  sbd: ["bd"],
};

/**
 * Sound pack v4's breaks: each is a whole kit playing (kick, snare, hats, a tambourine or shaker), so a break hit
 * belongs to every drum part of the song. `brk`, the older break, keeps its meaning: it belongs to a part only when
 * one lists it.
 */
export const BREAK_SOUNDS: readonly string[] = [
  "brkfunk",
  "brkboombap",
  "brkjungle",
  "brkhouse",
  "brkjazz",
  "brklofi",
];

/**
 * Every drum part a hit belongs to (contracts §5.11 rule 9), in song order:
 *
 * 1. the part whose `sounds` hold the sound's name (`bd:3` is `bd`; a name written with its bank, `RolandTR909_bd`,
 *    is read by what follows the last `_`);
 * 2. else, for a sound pack v4 name no part lists: a break (`BREAK_SOUNDS`) belongs to every drum part; a conga,
 *    bongo, clave or foley hit to the part that owns the song's percussion (`cb`, `tb`, `sh`…, else the part
 *    labelled `perc`); `sbd` to the part that owns `bd`.
 *
 * Empty when no part owns it.
 */
export function drumPartsOfSound(def: UnitSongDef, sound: string): SongPartId[] {
  const name = (sound.split(":")[0] ?? "").trim();
  if (name === "") return [];
  const drums = def.parts.filter((p) => p.role === "drums");
  const owner = (n: string) => drums.find((p) => (p.sounds ?? []).includes(n));
  const bare = name.includes("_") ? name.slice(name.lastIndexOf("_") + 1) : null;
  const listed = owner(name) ?? (bare === null ? undefined : owner(bare));
  if (listed) return [listed.id];
  const base = BREAK_SOUNDS.includes(name) || STANDS_FOR[name] ? name : (bare ?? name);
  if (BREAK_SOUNDS.includes(base)) return drums.map((p) => p.id);
  const standsFor = STANDS_FOR[base];
  if (!standsFor) return [];
  const part =
    drums.find((p) => (p.sounds ?? []).some((s) => standsFor.includes(s))) ??
    (standsFor === PERCUSSION ? drums.find((p) => p.label === "perc") : undefined);
  return part ? [part.id] : [];
}

/**
 * The drum part a hit belongs to, when it is exactly one (`drumPartsOfSound`): `bd:3` is the part that lists `bd`.
 * `null` when no part owns it, and for a break, which belongs to every drum part (ask `drumPartsOfSound`).
 */
export function partOfDrumSound(def: UnitSongDef, sound: string): SongPartId | null {
  const parts = drumPartsOfSound(def, sound);
  return parts.length === 1 ? (parts[0] as SongPartId) : null;
}

/** The part roles a track's inferred role may fall back to, in order (a chords track fills a pad part too). */
const FALLBACK_ROLES: Readonly<Record<"drums" | "bass" | "chords" | "melody", readonly SongPartRole[]>> = {
  drums: ["drums"],
  bass: ["bass"],
  chords: ["chords", "pad"],
  melody: ["melody"],
};

/**
 * The part a learner's track plays (for pitched tracks; drum tracks are split hit by hit with `drumPartsOfSound`):
 * the part with exactly this label, else the first part with the track's role (contracts §6.2 rule 1 infers it),
 * else `null` (the track goes past the brief and plays wherever its source owns a cell of the section).
 */
export function partOfTrack(
  def: UnitSongDef,
  track: { label: string; role: "drums" | "bass" | "chords" | "melody" | null },
): SongPartId | null {
  const exact = def.parts.find((p) => p.label === track.label);
  if (exact) return exact.id;
  if (track.role === null) return null;
  for (const role of FALLBACK_ROLES[track.role]) {
    const part = def.parts.find((p) => p.role === role);
    if (part) return part.id;
  }
  return null;
}

/**
 * The cells a take claims (spec §5.2), in song order (section by section, parts in song order). Its sections are
 * the step's (`'all'` is every section), narrowed to `filled` when given: the sections its code actually filled,
 * for a learner `arrange()` that maps onto only some of them. In each of those sections it claims its declared
 * parts, every part its code plays, and, when its code plays chords, every pitched part not in `oakKeeps`.
 * Parts the song does not have claim nothing.
 */
export function claimsOf(
  def: UnitSongDef,
  step: TakeStep,
  played: PlayedParts,
  filled?: readonly SongSectionId[],
): CellKey[] {
  const within = filled ? new Set(filled) : null;
  const sections = stepSectionIds(def, step).filter((s) => within === null || within.has(s));
  const keep = new Set(step.oakKeeps ?? []);
  const claimed = new Set<SongPartId>([...step.parts, ...played.parts]);
  if (played.playsChords)
    for (const p of def.parts) if (p.role !== "drums" && !keep.has(p.id)) claimed.add(p.id);
  const out: CellKey[] = [];
  for (const section of sections)
    for (const p of def.parts) if (claimed.has(p.id)) out.push(cellKey(p.id, section));
  return out;
}

/**
 * Who owns every cell of the song: Oak (`"oak"`) unless a take claimed it, the later take winning. The map holds
 * exactly the song's cells, section by section with parts in song order; claimed cells that name a part or a
 * section the song no longer has are ignored, so those cells fall back to Oak (spec §5.6).
 */
export function resolveGrid(
  def: UnitSongDef,
  takes: readonly SourceClaim[],
): ReadonlyMap<CellKey, string | "oak"> {
  const grid = new Map<CellKey, string>();
  for (const s of def.sections) for (const p of def.parts) grid.set(cellKey(p.id, s.id), OAK_OWNER);
  for (const t of takes) for (const c of t.cells) if (grid.has(c)) grid.set(c, t.sourceId);
  return grid;
}

/** The parts a source still owns, per section (sections where it owns nothing are absent), in grid order. */
export function ownedBy(
  grid: ReadonlyMap<CellKey, string | "oak">,
  sourceId: string,
): { parts: Map<SongSectionId, Set<SongPartId>> } {
  const parts = new Map<SongSectionId, Set<SongPartId>>();
  for (const [key, owner] of grid) {
    if (owner !== sourceId) continue;
    const cell = parseCellKey(key);
    if (!cell) continue;
    const set = parts.get(cell.section) ?? new Set<SongPartId>();
    set.add(cell.part);
    parts.set(cell.section, set);
  }
  return { parts };
}
