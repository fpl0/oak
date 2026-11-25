import { all, type Db, get, run } from "../index.ts";

export interface ScrapRow {
  id: string;
  role: string | null;
  label: string | null;
  code: string;
  bpm: number | null;
  meter: string | null;
  key_json: string | null;
  source_kind: string;
  source_ref: string | null;
  created_at: string;
  review_before_run: number;
}

export class ScrapsRepo {
  constructor(private readonly db: Db) {}

  list(): ScrapRow[] {
    return all<ScrapRow>(this.db, "SELECT * FROM scraps ORDER BY created_at DESC, id");
  }

  get(id: string): ScrapRow | null {
    return get<ScrapRow>(this.db, "SELECT * FROM scraps WHERE id = ?", id);
  }

  insert(r: Omit<ScrapRow, "review_before_run">): void {
    run(
      this.db,
      `INSERT INTO scraps (id, role, label, code, bpm, meter, key_json, source_kind, source_ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      r.id,
      r.role,
      r.label,
      r.code,
      r.bpm,
      r.meter,
      r.key_json,
      r.source_kind,
      r.source_ref,
      r.created_at,
    );
  }

  delete(id: string): boolean {
    return run(this.db, "DELETE FROM scraps WHERE id = ?", id).changes > 0;
  }
}
