// Oak 2.0 W4 (PLAN F2): `capstone_check_history` (migration 0012), one row per accepted rubric check of a capstone
// draft. The "Is it better, or just different?" nudge reads it to find an earlier draft that passed. Transcription
// phrase checks keep their own `capstone_checks` table and never write here. Rows are only ever added.
import { all, type Db, run } from "../index.ts";

export interface CheckHistoryRow {
  id: number;
  capstone_id: string;
  session_id: string | null;
  sketch_id: string;
  sketch_version: number;
  /** 0/1. */
  passed: number;
  at: string;
}

export class CheckHistoryRepo {
  constructor(private readonly db: Db) {}

  /** Adds one row; returns its id. */
  insert(r: Omit<CheckHistoryRow, "id">): number {
    return run(
      this.db,
      "INSERT INTO capstone_check_history (capstone_id, session_id, sketch_id, sketch_version, passed, at) VALUES (?, ?, ?, ?, ?, ?)",
      r.capstone_id,
      r.session_id,
      r.sketch_id,
      r.sketch_version,
      r.passed,
      r.at,
    ).lastInsertRowid;
  }

  /** Every check of one capstone, oldest first (ties in `at` by insertion order). */
  list(capstoneId: string): CheckHistoryRow[] {
    return all<CheckHistoryRow>(
      this.db,
      "SELECT id, capstone_id, session_id, sketch_id, sketch_version, passed, at FROM capstone_check_history WHERE capstone_id = ? ORDER BY at, id",
      capstoneId,
    );
  }
}
