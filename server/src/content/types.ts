// What the server needs from the authored content. The content engineer's generator writes
// `content/.generated/`; `loader.ts` reads that and the content sources behind this one interface, and
// tests use `fixture.ts`. Nothing else in the server touches content files.
import type {
  CanDoDef,
  CapstoneDef,
  CheckpointDef,
  FactDeck,
  FamilyDef,
  LessonDef,
  MilestoneDef,
  SkillDef,
  SongDef,
  SyllabusDef,
  TermEntry,
  ToolEntry,
  UnitSongDef,
} from "@oak/content-kit";

export interface ContentProblem {
  id: string;
  message: string;
}

/** The raw content set: registries plus whichever lesson, checkpoint and capstone files exist. */
export interface ContentSource {
  /** `contentVersion = sha256(content)` from `content/.generated/index.json`; `null` before the first build. */
  contentVersion: string | null;
  syllabus: SyllabusDef;
  toolbox: readonly ToolEntry[];
  skills: readonly SkillDef[];
  families: readonly FamilyDef[];
  decks: readonly FactDeck[];
  terms: readonly TermEntry[];
  canDos: readonly CanDoDef[];
  milestones: readonly MilestoneDef[];
  songs: readonly SongDef[];
  /**
   * Wave 5: the repertoire pool's metadata (`content/repertoire/index.ts`): which ladder level a song serves
   * (contracts §2.8–§2.9) and from which lesson. Absent from older fixtures (treated as empty).
   */
  repertoire?: readonly RepertoireMeta[];
  /** Authored lessons. The syllabus may list lessons that are not written yet. */
  lessons: readonly LessonDef[];
  checkpoints: readonly CheckpointDef[];
  capstones: readonly CapstoneDef[];
  /**
   * The unit songs (`content/unit-songs/index.ts`, spec 2026-11-24 §5.1): one per unit that has one. Absent from
   * older fixtures (treated as empty).
   */
  unitSongs?: readonly UnitSongDef[];
  /** The generated syllabus and Strudel catalog text of the tutor's system prefix. */
  tutorPrefix: { syllabus: string; catalog: string };
  /** What the loader could not read. Shown by `GET /api/dev/content-report`. */
  problems: readonly ContentProblem[];
}

/** One repertoire entry as the server reads it (the answer key, when written, is the `SongDef` of the same ID). */
export interface RepertoireMeta {
  id: string;
  title: string;
  year: number | "trad";
  /** The ladder level the song serves (5 PD folk, 6 blues and standards, 8 CF-T), when it serves one. */
  ladder?: number;
  /** Not offered before this lesson is completed ("Opens with U14.L03"). */
  availableFrom?: string;
  /** Offered only once a human verified it. */
  onlyWhenVerified?: boolean;
  form?: string;
}

export const EMPTY_SYLLABUS: SyllabusDef = {
  units: [],
  tracks: [],
  checkpoints: [],
  capstones: [],
  trackGates: [],
  defaultOrder: [],
};

export function emptyContent(problems: readonly ContentProblem[] = []): ContentSource {
  return {
    contentVersion: null,
    syllabus: EMPTY_SYLLABUS,
    toolbox: [],
    skills: [],
    families: [],
    decks: [],
    terms: [],
    canDos: [],
    milestones: [],
    songs: [],
    repertoire: [],
    lessons: [],
    checkpoints: [],
    capstones: [],
    unitSongs: [],
    tutorPrefix: { syllabus: "", catalog: "" },
    problems,
  };
}
