// Oak 2.0 W4 (PLAN F2): `capstones.checkHistory`, every rubric check of a capstone's drafts, oldest first. Mounted by
// the W4 integrator (stage B) before `oak2PendingRoutes`, with `d.services.checkHistory`.
import type { CheckHistoryService } from "../services/check-history.ts";
import type { Mounter } from "./define.ts";

export function checkHistoryRoutes(mount: Mounter, history: CheckHistoryService): void {
  mount("capstones.checkHistory", ({ params }) => ({ items: history.list(params.id) }));
}
