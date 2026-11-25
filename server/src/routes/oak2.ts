// Oak 2.0 endpoints (contracts §13, docs/design/oak2/W0.md): declared in W0, built in W1, W3 and W4. Until a wave
// builds a handler, its endpoint answers the typed 501 stub here. A builder mounts the real handler in its own route
// module and removes the name from `OAK2_PENDING`; routes.test.ts then checks it no longer answers 501.
import { OAK2_ENDPOINTS } from "@oak/api";
import { notImplemented } from "../errors.ts";
import type { Mounter } from "./define.ts";

export type Oak2Endpoint = (typeof OAK2_ENDPOINTS)[number];

/** Oak 2.0 endpoints built so far, each mounted by its own route module (W1: scraps, templates, Later, take state;
 * W3: lineage, habits, catalogs). */
const OAK2_BUILT: ReadonlySet<Oak2Endpoint> = new Set<Oak2Endpoint>([
  "scraps.list",
  "scraps.create",
  "scraps.delete",
  "templates.list",
  "templates.create",
  "templates.patch",
  "templates.delete",
  "sketches.patchVersion",
  "later.list",
  "later.create",
  "later.patch",
  "sketches.lineage",
  "habits.get",
  "catalogs.list",
  "catalogs.create",
]);

/** Oak 2.0 endpoints still answering the typed 501 stub (after W3: the W4 names only). */
export const OAK2_PENDING: readonly Oak2Endpoint[] = OAK2_ENDPOINTS.filter((n) => !OAK2_BUILT.has(n));

export function oak2PendingRoutes(mount: Mounter): void {
  for (const name of OAK2_PENDING)
    mount(name, () => {
      throw notImplemented(name);
    });
}
