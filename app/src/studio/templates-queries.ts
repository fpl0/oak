// Oak 2.0 W1 (S2): the learner's own templates and Blank over `templates.*` (contracts §13). Until the server
// mounts the service, `templates.list` answers 501 and the dialog shows no template of the learner's.
import { useQuery } from "@tanstack/react-query";
import { apiQuery, useApiMutation, useDestructiveMutation } from "../lib/queries.ts";

/** The learner's templates, the Blank first, then by name. */
export const useTemplates = () => useQuery({ ...apiQuery("templates.list"), staleTime: 30_000, retry: 0 });
export const useTemplateCreate = () => useApiMutation("templates.create", ["templates.list"]);
export const useTemplatePatch = () => useApiMutation("templates.patch", ["templates.list"]);
/** Asks first (contracts §11.6, nonce `template.delete`). */
export const useTemplateDelete = () => useDestructiveMutation("templates.delete", ["templates.list"]);
