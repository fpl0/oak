// onboarding_state (one row) and listen_marks (Settings › Listening pass verdicts). Migration 0002.
import {
  LISTEN_VERDICTS,
  type ListenMark,
  ONBOARDING_STEPS,
  type OnboardingState,
  type OnboardingStep,
} from "@oak/api";
import { all, type Db, fromJson, get, run, toJson } from "../index.ts";

interface OnboardingRow {
  step: string;
  completed_json: string;
  skipped_json: string;
  first_edit: number | null;
  sketch_id: string | null;
  started_at: string | null;
  finished_at: string | null;
}

const isStep = (s: unknown): s is OnboardingStep =>
  typeof s === "string" && (ONBOARDING_STEPS as readonly string[]).includes(s);
const steps = (text: string): OnboardingStep[] => {
  const raw = fromJson<unknown>(text, []);
  return Array.isArray(raw) ? [...new Set(raw.filter(isStep))] : [];
};

export const FRESH_ONBOARDING: OnboardingState = {
  step: "welcome",
  completed: [],
  skipped: [],
  firstEdit: null,
  sketchId: null,
  startedAt: null,
  finishedAt: null,
};

export class OnboardingRepo {
  constructor(private readonly db: Db) {}

  get(): OnboardingState {
    const r = get<OnboardingRow>(this.db, "SELECT * FROM onboarding_state WHERE id = 1");
    if (r === null) return { ...FRESH_ONBOARDING, completed: [], skipped: [] };
    return {
      step: isStep(r.step) ? r.step : "welcome",
      completed: steps(r.completed_json),
      skipped: steps(r.skipped_json),
      firstEdit: r.first_edit,
      sketchId: r.sketch_id,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
    };
  }

  save(s: OnboardingState, at: string): OnboardingState {
    run(
      this.db,
      `INSERT INTO onboarding_state (id, step, completed_json, skipped_json, first_edit, sketch_id, started_at, finished_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET step = excluded.step, completed_json = excluded.completed_json,
         skipped_json = excluded.skipped_json, first_edit = excluded.first_edit, sketch_id = excluded.sketch_id,
         started_at = excluded.started_at, finished_at = excluded.finished_at, updated_at = excluded.updated_at`,
      s.step,
      toJson(s.completed),
      toJson(s.skipped),
      s.firstEdit,
      s.sketchId,
      s.startedAt,
      s.finishedAt,
      at,
    );
    return this.get();
  }
}

interface ListenRow {
  ref: string;
  hash: string;
  verdict: string;
  note: string;
  at: string;
}

export class ListenRepo {
  constructor(private readonly db: Db) {}

  list(): ListenMark[] {
    return all<ListenRow>(this.db, "SELECT * FROM listen_marks ORDER BY ref")
      .filter((r) => (LISTEN_VERDICTS as readonly string[]).includes(r.verdict))
      .map((r) => ({ ...r, verdict: r.verdict as ListenMark["verdict"] }));
  }

  put(mark: ListenMark): ListenMark {
    run(
      this.db,
      `INSERT INTO listen_marks (ref, hash, verdict, note, at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (ref) DO UPDATE SET hash = excluded.hash, verdict = excluded.verdict, note = excluded.note, at = excluded.at`,
      mark.ref,
      mark.hash,
      mark.verdict,
      mark.note,
      mark.at,
    );
    return mark;
  }
}
