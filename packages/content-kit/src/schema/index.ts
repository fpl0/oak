export * from "./catalog.ts";
export * from "./common.ts";
export * from "./exercise.ts";
export * from "./lesson.ts";
export * from "./results.ts";
export * from "./rubric.ts";
export * from "./unit-song.ts";
export * from "./wave7.ts";

import type { FeedbackId, SkillId } from "../ids.ts";
/** Key aliases used by the zod schemas for records keyed by an ID pattern. */
export type FeedbackKey = FeedbackId;
export type SkillKey = SkillId;
