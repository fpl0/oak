import type { LineageService } from "../services/lineage.ts";
import type { Mounter } from "./define.ts";

export function lineageRoutes(mount: Mounter, lineage: LineageService): void {
  mount("sketches.lineage", ({ params, query }) =>
    lineage.lineage(params.id, query.version === undefined ? undefined : Number(query.version)),
  );
}
