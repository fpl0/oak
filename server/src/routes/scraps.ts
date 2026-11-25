import type { ScrapsService } from "../services/scraps.ts";
import type { Mounter } from "./define.ts";

export function scrapsRoutes(mount: Mounter, scraps: ScrapsService): void {
  mount("scraps.list", ({ query }) => ({
    items: scraps.list({
      ...(query.role === undefined ? {} : { role: query.role }),
      ...(query.origin === undefined ? {} : { origin: query.origin }),
    }),
  }));
  mount("scraps.create", ({ body }) => scraps.create(body));
  mount("scraps.delete", ({ params }) => {
    scraps.delete(params.id);
    return { ok: true as const };
  });
}
