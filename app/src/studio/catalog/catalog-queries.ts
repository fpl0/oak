// Oak 2.0 W3 (PLAN §4 S6): the catalogs' data (`catalogs.list`, `catalogs.create`). A create refreshes every list, the
// sketch lists (a "Hide it and write" made one) and Today (its "Outside your lane" line reads the newest outside one).
import type { Catalog } from "@oak/api";
import { useQuery } from "@tanstack/react-query";
import { apiQuery, useApiMutation } from "../../lib/queries.ts";
import { notBuilt } from "../habits/habits-queries.ts";

export interface CatalogFilter {
  refKind?: Catalog["refKind"];
  refId?: string;
}

/** The learner's catalogs, newest first, filtered by reference kind and id when given. */
export function useCatalogs(filter: CatalogFilter = {}, o: { enabled?: boolean } = {}) {
  const query = {
    ...(filter.refKind === undefined ? {} : { refKind: filter.refKind }),
    ...(filter.refId === undefined ? {} : { refId: filter.refId }),
  };
  return useQuery({
    ...apiQuery("catalogs.list", Object.keys(query).length > 0 ? { query } : undefined),
    enabled: o.enabled ?? true,
    retry: (count, e) => !notBuilt(e) && count < 2,
  });
}

export const useCatalogCreate = () => useApiMutation("catalogs.create", ["catalogs.list", "sketches.list"]);
