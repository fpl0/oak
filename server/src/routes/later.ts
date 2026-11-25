// Oak 2.0 W1 (PLAN S7): the Later list on Today (`later.list`, `later.create`, `later.patch`). Mounted by the W1
// integrator before `oak2PendingRoutes`, with `d.services.later`.
import type { LaterService } from "../services/later.ts";
import type { Mounter } from "./define.ts";

export function laterRoutes(mount: Mounter, later: LaterService): void {
  mount("later.list", ({ query }) => ({
    items: later.list(query.done === undefined ? {} : { done: query.done === "1" }),
  }));
  mount("later.create", ({ body }) => later.create({ text: body.text, source: body.source }));
  mount("later.patch", ({ params, body }) =>
    later.patch(params.id, {
      ...(body.text === undefined ? {} : { text: body.text }),
      ...(body.done === undefined ? {} : { done: body.done }),
    }),
  );
}
