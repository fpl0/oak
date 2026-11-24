// @oak/grader/song: the unit-song composer and the static readers it needs (spec 2026-11-24 §5.2). Headless and
// pure: `@strudel/core` and `@oak/content-kit` only. The grader's Workbench analysis (runtime/analyze.ts) and the
// adapter (`@oak/strudel/song-compose`, `band-form.ts`, `comments.ts`, which re-export this module) share it, so
// there is one composer (contracts §5.11 rule 2).
export * from "./band-form.ts";
export * from "./comments.ts";
export * from "./compose.ts";
