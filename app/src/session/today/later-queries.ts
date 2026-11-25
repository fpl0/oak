// Oak 2.0 W1 (PLAN S7): the Later list's data hooks (`later.list`, `later.create`, `later.patch`). Both Today's
// LaterList and the tutor's "Park it for later" write through these, so Today refreshes after either.
import { useQuery } from "@tanstack/react-query";
import { apiQuery, useApiMutation } from "../../lib/queries.ts";

/** Open items, oldest first. */
export const useLaterOpen = () => useQuery(apiQuery("later.list", { query: { done: "0" } }));
/** Done items, latest first. */
export const useLaterDone = () => useQuery(apiQuery("later.list", { query: { done: "1" } }));
export const useLaterCreate = () => useApiMutation("later.create", ["later.list"]);
export const useLaterPatch = () => useApiMutation("later.patch", ["later.list"]);
