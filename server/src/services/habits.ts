import { type Habits, OAK_DEFAULTS, OAK_START_NOTES } from "@oak/api";
import type { ServiceContext } from "./context.ts";
import { type HabitItem, summarizeHabits } from "./habits-core.ts";

export class HabitsService {
  constructor(private readonly ctx: ServiceContext) {}

  get(): Habits {
    const items: HabitItem[] = [];
    for (const sketch of this.ctx.repos.sketches.list({ origin: "free", archived: false })) {
      const first = this.ctx.repos.sketches.version(sketch.id, 1);
      // A later note cannot change whether this sketch began as Oak's own code.
      if (first === null || OAK_START_NOTES.some((start) => first.note?.startsWith(start))) continue;
      const current =
        sketch.currentVersion === 1
          ? first
          : this.ctx.repos.sketches.version(sketch.id, sketch.currentVersion);
      if (current !== null) items.push(current);
    }
    return summarizeHabits(items, OAK_DEFAULTS);
  }
}
