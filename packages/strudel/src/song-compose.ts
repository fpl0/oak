// The unit-song composer (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.2), as the adapter and its
// users (app, offline export, e2e) import it: `@oak/strudel/song-compose`. The composer itself is headless and pure
// and lives in the grader package (packages/grader/src/song/compose.ts, `@oak/grader/song`), because the grader's
// Workbench analysis composes songs too and the grader may not import the adapter (docs/design/interfaces.md §2).
// This module re-exports it unchanged: one composer (contracts §5.11 rule 2).
export * from "@oak/grader/song";
