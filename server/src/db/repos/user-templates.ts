import { all, type Db, get, run } from "../index.ts";

export interface UserTemplateRow {
  id: string;
  name: string;
  code: string;
  bpm: number | null;
  meter: string | null;
  is_blank: number;
  created_at: string;
  updated_at: string;
  review_before_run: number;
}

export class UserTemplatesRepo {
  constructor(private readonly db: Db) {}

  list(): UserTemplateRow[] {
    return all<UserTemplateRow>(this.db, "SELECT * FROM user_templates");
  }

  get(id: string): UserTemplateRow | null {
    return get<UserTemplateRow>(this.db, "SELECT * FROM user_templates WHERE id = ?", id);
  }

  insert(r: Omit<UserTemplateRow, "review_before_run">): void {
    run(
      this.db,
      `INSERT INTO user_templates (id, name, code, bpm, meter, is_blank, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      r.id,
      r.name,
      r.code,
      r.bpm,
      r.meter,
      r.is_blank,
      r.created_at,
      r.updated_at,
    );
  }

  update(id: string, patch: { name?: string; is_blank?: number; updated_at: string }): void {
    run(
      this.db,
      `UPDATE user_templates SET name = COALESCE(?, name), is_blank = COALESCE(?, is_blank),
       updated_at = ? WHERE id = ?`,
      patch.name ?? null,
      patch.is_blank ?? null,
      patch.updated_at,
      id,
    );
  }

  /** Every Blank but `exceptId` stops being one (their `updated_at` = `at`). */
  clearBlank(exceptId: string | null, at: string): void {
    run(
      this.db,
      "UPDATE user_templates SET is_blank = 0, updated_at = ? WHERE is_blank = 1 AND (? IS NULL OR id <> ?)",
      at,
      exceptId,
      exceptId,
    );
  }

  /** Extracting sound settings does not review the expressions kept from an imported sketch. */
  markForReview(id: string): void {
    run(this.db, "UPDATE user_templates SET review_before_run = 1 WHERE id = ?", id);
  }

  delete(id: string): boolean {
    return run(this.db, "DELETE FROM user_templates WHERE id = ?", id).changes > 0;
  }
}
