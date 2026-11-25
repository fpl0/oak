// Oak 2.0 W1 (S1): the scraps endpoints. Index scraps are the lines of every sketch's current version, so the list
// is read fresh whenever the panel opens; saving a sketch elsewhere is seen on the next read.
import type { ScrapRole } from "@oak/api";
import { useQuery } from "@tanstack/react-query";
import { apiQuery, useApiMutation, useDestructiveMutation } from "../../lib/queries.ts";

export interface ScrapsFilter {
  role?: ScrapRole;
  origin?: "saved" | "index";
}

/** Every scrap (saved and index) matching the filter, as the server sends them (newest first). */
export function useScraps(filter: ScrapsFilter = {}) {
  const query: ScrapsFilter = {};
  if (filter.role) query.role = filter.role;
  if (filter.origin) query.origin = filter.origin;
  return useQuery({ ...apiQuery("scraps.list", { query }), staleTime: 0 });
}

/** Saves a line as a scrap. */
export const useScrapCreate = () => useApiMutation("scraps.create", ["scraps.list"]);

/** Deletes a saved scrap after the learner confirms (an index scrap goes with its sketch line). */
export const useScrapDelete = () => useDestructiveMutation("scraps.delete", ["scraps.list"]);
