// Oak 2.0 W3 (PLAN §4 S6): the habits mirror's data (`habits.get`). The sentences change when a sketch is saved, so the
// read is refreshed whenever the tab or the "Sounds like…" list opens. A server that has not built the endpoint yet
// answers 501 (`not_implemented`): `notBuilt` says so, and the panels show a plain line instead of an error.
import { OakApiError } from "@oak/api";
import { useQuery } from "@tanstack/react-query";
import { apiQuery } from "../../lib/queries.ts";

export const notBuilt = (e: unknown): boolean =>
  e instanceof OakApiError && (e.status === 501 || e.code === "not_implemented");

/** `habits.get`: `{ sketches, habits: { id, text }[] }`. */
export function useHabits(o: { enabled?: boolean } = {}) {
  return useQuery({
    ...apiQuery("habits.get"),
    enabled: o.enabled ?? true,
    staleTime: 0,
    retry: (count, e) => !notBuilt(e) && count < 2,
  });
}
