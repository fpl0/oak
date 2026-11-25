// Oak 2.0 W1 (PLAN S7): the Later list on Today. A question parked by the tutor ("[[later]]") or a note the learner
// parks themselves, so a long detour waits instead of taking over today's session. Plain items: no counts, no goals.
// The SQL is private to this file (a `LaterRepo` over `ctx.repos.db`, table `later_items`, migration 0012), so the
// service is mounted without touching `Repos`.
import { LATER_SOURCES, type LaterItem } from "@oak/api";
import { all, type Db, get, run } from "../db/index.ts";
import { badRequest, notFound } from "../errors.ts";
import { newId, type ServiceContext } from "./context.ts";

type LaterSource = (typeof LATER_SOURCES)[number];

interface LaterRow {
  id: string;
  text: string;
  source: string | null;
  created_at: string;
  done_at: string | null;
}

/** The longest item text (`LaterCreateSchema`). */
export const LATER_TEXT_MAX = 500;

const sourceOf = (v: string | null): LaterSource | null =>
  (LATER_SOURCES as readonly string[]).includes(v ?? "") ? (v as LaterSource) : null;

const toItem = (r: LaterRow): LaterItem => ({
  id: r.id,
  text: r.text,
  source: sourceOf(r.source),
  createdAt: r.created_at,
  doneAt: r.done_at,
});

class LaterRepo {
  constructor(private readonly db: Db) {}
  /** Open items oldest first; done items most recently done first. */
  list(done: boolean | undefined): LaterItem[] {
    const open = "SELECT * FROM later_items WHERE done_at IS NULL ORDER BY created_at, rowid";
    const closed =
      "SELECT * FROM later_items WHERE done_at IS NOT NULL ORDER BY done_at DESC, created_at DESC, rowid DESC";
    const rows =
      done === undefined
        ? [...all<LaterRow>(this.db, open), ...all<LaterRow>(this.db, closed)]
        : all<LaterRow>(this.db, done ? closed : open);
    return rows.map(toItem);
  }
  get(id: string): LaterItem | null {
    const r = get<LaterRow>(this.db, "SELECT * FROM later_items WHERE id = ?", id);
    return r ? toItem(r) : null;
  }
  insert(item: LaterItem): void {
    run(
      this.db,
      "INSERT INTO later_items (id, text, source, created_at, done_at) VALUES (?, ?, ?, ?, ?)",
      item.id,
      item.text,
      item.source,
      item.createdAt,
      item.doneAt,
    );
  }
  update(id: string, text: string, doneAt: string | null): void {
    run(this.db, "UPDATE later_items SET text = ?, done_at = ? WHERE id = ?", text, doneAt, id);
  }
}

function cleanText(text: string): string {
  const t = text.trim();
  if (t === "") throw badRequest("text is empty");
  if (t.length > LATER_TEXT_MAX) throw badRequest(`text is longer than ${LATER_TEXT_MAX} characters`);
  return t;
}

export class LaterService {
  readonly #repo: LaterRepo;
  readonly #ctx: ServiceContext;
  constructor(ctx: ServiceContext) {
    this.#ctx = ctx;
    this.#repo = new LaterRepo(ctx.repos.db);
  }

  /** No `done`: open items (oldest first), then done ones (latest first). `done`: only those. */
  list(o: { done?: boolean } = {}): LaterItem[] {
    return this.#repo.list(o.done);
  }

  create(b: { text: string; source: LaterSource | null }): LaterItem {
    const item: LaterItem = {
      id: newId("lat"),
      text: cleanText(b.text),
      source: sourceOf(b.source),
      createdAt: this.#ctx.clock.now().toISOString(),
      doneAt: null,
    };
    this.#repo.insert(item);
    return item;
  }

  /** `done: true` sets `doneAt` (kept if already done); `false` clears it; `text` renames. */
  patch(id: string, b: { text?: string; done?: boolean }): LaterItem {
    const item = this.#repo.get(id);
    if (!item) throw notFound("later item");
    const text = b.text === undefined ? item.text : cleanText(b.text);
    const doneAt =
      b.done === undefined
        ? item.doneAt
        : b.done
          ? (item.doneAt ?? this.#ctx.clock.now().toISOString())
          : null;
    this.#repo.update(id, text, doneAt);
    return { ...item, text, doneAt };
  }
}
