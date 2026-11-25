// Oak 2.0 W4 (PLAN F2, contracts §13.7): the history of a capstone's rubric checks. `CourseService.capstoneCheck`
// writes one row per accepted check, inside its own transaction (`recordCapstoneCheck`); a refused check (a locked
// capstone, an unknown sketch version) throws before it and writes nothing. `capstones.checkHistory` lists them,
// oldest first. The repository is built from `ctx.repos.db` on each call, so a backup import (which rewrites the same
// `Db`) is read as it is now. Nothing here judges: a row says only that a version was checked and whether it passed.
import type { CapstoneCheckHistoryEntry } from "@oak/api";
import type { Db } from "../db/index.ts";
import { CheckHistoryRepo, type CheckHistoryRow } from "../db/repos/check-history.ts";
import { notFound } from "../errors.ts";
import type { ServiceContext } from "./context.ts";

/** One accepted check of a capstone draft (called inside `capstoneCheck`'s transaction). */
export function recordCapstoneCheck(
  db: Db,
  e: {
    capstoneId: string;
    sessionId: string | null;
    sketchId: string;
    sketchVersion: number;
    passed: boolean;
    at: string;
  },
): void {
  new CheckHistoryRepo(db).insert({
    capstone_id: e.capstoneId,
    session_id: e.sessionId,
    sketch_id: e.sketchId,
    sketch_version: e.sketchVersion,
    passed: e.passed ? 1 : 0,
    at: e.at,
  });
}

const toEntry = (r: CheckHistoryRow): CapstoneCheckHistoryEntry => ({
  id: r.id,
  capstoneId: r.capstone_id as CapstoneCheckHistoryEntry["capstoneId"],
  sessionId: r.session_id,
  sketchId: r.sketch_id,
  sketchVersion: r.sketch_version,
  passed: r.passed === 1,
  at: r.at,
});

export class CheckHistoryService {
  constructor(private readonly ctx: ServiceContext) {}

  /** Every check of the capstone's drafts, oldest first. 404 for a capstone the course does not have. */
  list(capstoneId: string): CapstoneCheckHistoryEntry[] {
    if (this.ctx.content.capstoneMeta(capstoneId) === null) throw notFound(`capstone ${capstoneId}`);
    return new CheckHistoryRepo(this.ctx.repos.db).list(capstoneId).map(toEntry);
  }
}
