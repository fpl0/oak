// Loads the content set for the server. Two inputs, one result:
//  - the content SOURCES (`content/syllabus.ts`, `skills.ts`, `families.ts`, `toolbox.ts`, `terms.ts`,
//    `candos.ts`, `milestones.ts`, `unit-songs/index.ts`, every `lesson.ts`, `checkpoint.ts`, `capstone.ts`,
//    `song.ts`): typed truth, imported directly (Bun runs TypeScript);
//  - `content/.generated/` (written by `bun run content:build`): `index.json` for `contentVersion`,
//    `toolbox.json` when the source table is missing, `tutor/` for the system-prefix text.
// A file that is missing or fails to import becomes a `ContentProblem`; the server still starts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CanDoDef,
  type CapstoneDef,
  type CheckpointDef,
  type FactDeck,
  type FamilyDef,
  idKind,
  type LessonDef,
  type MilestoneDef,
  type SkillDef,
  type SongDef,
  type SyllabusDef,
  type TermEntry,
  type ToolEntry,
  type UnitSongDef,
} from "@oak/content-kit";
import {
  type ContentProblem,
  type ContentSource,
  EMPTY_SYLLABUS,
  emptyContent,
  type RepertoireMeta,
} from "./types.ts";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Every object reachable from a module's exports: the exports themselves and the items of exported arrays. */
function exportedObjects(mod: unknown): Obj[] {
  const out: Obj[] = [];
  if (!isObj(mod)) return out;
  for (const value of Object.values(mod)) {
    if (Array.isArray(value)) out.push(...value.filter(isObj));
    else if (isObj(value)) out.push(value);
  }
  return out;
}

function isSyllabus(v: unknown): v is SyllabusDef {
  return isObj(v) && Array.isArray(v.units) && Array.isArray(v.defaultOrder) && Array.isArray(v.checkpoints);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readFirst(dir: string, names: readonly string[]): string {
  for (const name of names) {
    const path = join(dir, name);
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  return "";
}

export interface LoadOptions {
  /** The `content/` directory. */
  contentDir: string;
  /** Module importer; tests pass their own. */
  importModule?: (path: string) => Promise<unknown>;
}

export async function loadContent(options: LoadOptions): Promise<ContentSource> {
  const { contentDir } = options;
  const importModule = options.importModule ?? ((path: string) => import(path));
  const problems: ContentProblem[] = [];
  if (!existsSync(contentDir))
    return emptyContent([{ id: "content", message: `${contentDir} does not exist` }]);

  const load = async (rel: string, required: boolean): Promise<unknown> => {
    const path = join(contentDir, rel);
    if (!existsSync(path)) {
      if (required) problems.push({ id: rel, message: "missing" });
      return null;
    }
    try {
      return await importModule(path);
    } catch (err) {
      problems.push({
        id: rel,
        message: `import failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return null;
    }
  };
  // One entry per ID: a module that exports its table twice (a named array and `default`) must not
  // give every row twice (unlock rows, can-dos and `unlocks.next` were doubled).
  const byKind = <T>(mod: unknown, ...kinds: string[]): T[] => {
    const seen = new Set<string>();
    return exportedObjects(mod).filter((o) => {
      if (typeof o.id !== "string" || !kinds.includes(idKind(o.id) ?? "") || seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    }) as T[];
  };

  // Registries.
  const syllabusMod = await load("syllabus.ts", true);
  const syllabus =
    (isObj(syllabusMod) ? Object.values(syllabusMod).find(isSyllabus) : undefined) ?? EMPTY_SYLLABUS;
  if (syllabusMod !== null && syllabus === EMPTY_SYLLABUS)
    problems.push({ id: "syllabus.ts", message: "no SyllabusDef export found" });

  let toolbox = byKind<ToolEntry>(await load("toolbox.ts", false), "tool", "sound", "scale", "chordFamily");
  const skills = byKind<SkillDef>(await load("skills.ts", true), "skill");
  const familiesMod = await load("families.ts", true);
  const families = byKind<FamilyDef>(familiesMod, "family");
  const decks = byKind<FactDeck>(familiesMod, "deck");
  const terms = byKind<TermEntry>(await load("terms.ts", false), "term");
  const canDosMod = await load("candos.ts", false);
  const canDos = byKind<CanDoDef>(canDosMod, "canDo");
  const milestones = [
    ...byKind<MilestoneDef>(canDosMod, "milestone"),
    ...byKind<MilestoneDef>(await load("milestones.ts", false), "milestone"),
  ];

  // Wave 5: the repertoire pool's metadata (ladder level, availableFrom) for the L5/L6 song pools.
  const repertoire = byKind<RepertoireMeta>(await load("repertoire/index.ts", false), "song");

  // The capstone registry (`content/capstones.ts`: the full definitions with briefs and rubrics, contracts
  // §6.6). It also exports the metas; a definition is told apart by its `sessionDefs`.
  const capstoneRegistry = exportedObjects(await load("capstones.ts", false)).filter(
    (o) => typeof o.id === "string" && idKind(o.id) === "capstone" && Array.isArray(o.sessionDefs),
  ) as unknown as CapstoneDef[];

  // The unit songs (spec 2026-11-24 §5.1): the registry `content/unit-songs/index.ts`, its songs validated by
  // `defineUnitSong` at import (a broken song fails the import and becomes a problem, like any registry).
  const unitSongs = byKind<UnitSongDef>(await load("unit-songs/index.ts", false), "unitSong");

  // Per-folder files.
  const lessons: LessonDef[] = [];
  const checkpoints: CheckpointDef[] = [];
  const capstones: CapstoneDef[] = [];
  const songs: SongDef[] = [];
  const glob = new Bun.Glob("**/{lesson,checkpoint,capstone,song}.ts");
  const files = [...glob.scanSync({ cwd: contentDir })].filter((f) => !f.startsWith(".generated")).sort();
  for (const rel of files) {
    const mod = await load(rel, true);
    const def = isObj(mod) ? (mod.default ?? Object.values(mod).find(isObj)) : null;
    if (!isObj(def) || typeof def.id !== "string") {
      if (mod !== null) problems.push({ id: rel, message: "no definition exported" });
      continue;
    }
    const kind = idKind(def.id);
    if (rel.endsWith("lesson.ts") && kind === "lesson") lessons.push(def as unknown as LessonDef);
    else if (rel.endsWith("checkpoint.ts") && kind === "checkpoint")
      checkpoints.push(def as unknown as CheckpointDef);
    else if (rel.endsWith("capstone.ts") && kind === "capstone")
      capstones.push(def as unknown as CapstoneDef);
    else if (rel.endsWith("song.ts") && kind === "song") songs.push(def as unknown as SongDef);
    else problems.push({ id: rel, message: `unexpected id "${def.id}"` });
  }

  // A capstone folder file wins over the registry entry of the same ID.
  for (const c of capstoneRegistry)
    if (!capstones.some((x) => x.id === c.id) && !capstones.includes(c)) capstones.push(c);
  const seenCap = new Set<string>();
  for (let i = capstones.length - 1; i >= 0; i--) {
    const id = (capstones[i] as CapstoneDef).id;
    if (seenCap.has(id)) capstones.splice(i, 1);
    seenCap.add(id);
  }
  // Brief tests that read a song's answer key (JC4 on Georgia on My Mind) live beside the content checks, out of the
  // modules the app loads (content/validate/song-tests.ts); the server, like content CI, sees the brief with them
  // (the dev seeds release the brief's own passing piece).
  const songTests = (await load("validate/song-tests.ts", false)) as {
    withSongBriefTests?: (c: CapstoneDef) => Promise<CapstoneDef>;
  } | null;
  if (songTests?.withSongBriefTests)
    for (let i = 0; i < capstones.length; i++)
      capstones[i] = await songTests.withSongBriefTests(capstones[i] as CapstoneDef);

  // Generated files.
  const generated = join(contentDir, ".generated");
  let contentVersion: string | null = null;
  try {
    const indexPath = join(generated, "index.json");
    if (existsSync(indexPath)) {
      const index = readJson(indexPath);
      if (isObj(index) && typeof index.contentVersion === "string") contentVersion = index.contentVersion;
    } else problems.push({ id: ".generated/index.json", message: "missing: run `bun run content:build`" });
    if (toolbox.length === 0 && existsSync(join(generated, "toolbox.json"))) {
      const rows = readJson(join(generated, "toolbox.json"));
      if (Array.isArray(rows)) toolbox = rows.filter(isObj) as unknown as ToolEntry[];
    }
  } catch (err) {
    problems.push({ id: ".generated", message: err instanceof Error ? err.message : String(err) });
  }
  if (toolbox.length === 0) problems.push({ id: "toolbox", message: "no unlock table found" });
  const tutorDir = join(generated, "tutor");
  const tutorPrefix = {
    syllabus: readFirst(tutorDir, ["syllabus.md", "syllabus.txt"]),
    catalog: readFirst(tutorDir, ["catalog.md", "catalog.txt", "strudel-catalog.md"]),
  };

  for (const unit of syllabus.units)
    for (const meta of unit.lessons)
      if (!lessons.some((l) => l.id === meta.id))
        problems.push({ id: meta.id, message: "lesson not authored yet" });

  return {
    contentVersion,
    syllabus,
    toolbox,
    skills,
    families,
    decks,
    terms,
    canDos,
    milestones,
    songs,
    repertoire,
    lessons,
    checkpoints,
    capstones,
    unitSongs,
    tutorPrefix,
    problems,
  };
}
