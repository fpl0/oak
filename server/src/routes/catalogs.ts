// Oak 2.0 W3 (PLAN §4 S6): the catalog of attributes (`catalogs.list`, `catalogs.create`). Mounted by the W3
// integrator (stage B) before `oak2PendingRoutes`, with `d.services.catalogs`.
import type { CatalogsService } from "../services/catalogs.ts";
import type { Mounter } from "./define.ts";

export function catalogsRoutes(mount: Mounter, catalogs: CatalogsService): void {
  mount("catalogs.list", ({ query }) => ({
    items: catalogs.list({
      ...(query.refKind === undefined ? {} : { refKind: query.refKind }),
      ...(query.refId === undefined ? {} : { refId: query.refId }),
    }),
  }));
  mount("catalogs.create", ({ body }) =>
    catalogs.create({ refKind: body.refKind, refId: body.refId, lines: body.lines, sketchId: body.sketchId }),
  );
}
