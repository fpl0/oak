// Every content registry in one place (isomorphic: no fs). Lesson files are discovered from disk by
// content/lib/load.bun.ts; the build turns all of this into content/.generated/.
import { bands } from "./bands/index.ts";
import { candos } from "./candos.ts";
import { capstones } from "./capstones.ts";
import { catalog } from "./catalog/index.ts";
import { CHECKPOINT_LESSON_EXCEPTIONS, checkpointMetas } from "./checkpoints.ts";
import { decks, EAR_STAGES, families } from "./families.ts";
import { flavours } from "./flavours.ts";
import { ladder } from "./gym/ladder.ts";
import { templates } from "./gym/templates.ts";
import { buildCourseGraph, type CourseGraph } from "./lib/course.ts";
import { milestones } from "./milestones.ts";
import { repertoire } from "./repertoire/index.ts";
import { skills } from "./skills.ts";
import { syllabus } from "./syllabus.ts";
import { terms } from "./terms.ts";
import { toolbox } from "./toolbox.ts";
import { unitSongs } from "./unit-songs/index.ts";

export const registries = {
  syllabus,
  skills,
  toolbox,
  families,
  decks,
  terms,
  candos,
  milestones,
  flavours,
  bands,
  unitSongs,
  capstones,
  checkpoints: checkpointMetas,
  repertoire,
  ladder,
  templates,
  catalog,
  earStages: EAR_STAGES,
} as const;
export type Registries = typeof registries;

let graph: CourseGraph | null = null;
/** The legal-order graph of contracts §7.6 over the whole course (built once). */
export function courseGraph(): CourseGraph {
  graph ??= buildCourseGraph(syllabus, capstones, CHECKPOINT_LESSON_EXCEPTIONS);
  return graph;
}
