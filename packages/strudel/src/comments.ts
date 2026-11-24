// Comment stripping for the static readers: it lives in the grader package (`@oak/grader/song`, headless, shared by
// both realms with the unit-song composer) and is re-exported here for the adapter's readers (sounds-in.ts).
export { stripComments } from "@oak/grader/song";
