import type { UserTemplatesService } from "../services/user-templates.ts";
import type { Mounter } from "./define.ts";

export function templatesRoutes(mount: Mounter, templates: UserTemplatesService): void {
  mount("templates.list", () => ({ items: templates.list() }));
  mount("templates.create", ({ body }) => templates.create(body));
  mount("templates.patch", ({ params, body }) => templates.patch(params.id, body));
  mount("templates.delete", ({ params }) => {
    templates.delete(params.id);
    return { ok: true as const };
  });
}
