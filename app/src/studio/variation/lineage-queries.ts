// Oak 2.0 W3 (PLAN §4 S5 generations): the variation chain that ends at a version (`sketches.lineage`, first to last,
// with the server's `undoesGrandparent`). Until the lineage service is mounted the endpoint answers 501; the chain view
// then lists the chain from the sketch's own versions and says the rest arrives with the update.
import { OakApiError, type SketchVersion } from "@oak/api";
import { useQuery } from "@tanstack/react-query";
import { apiQuery } from "../../lib/queries.ts";

/** The chain ending at `version` (`null`: not asked yet). Read fresh: a kept generation moves the tip. */
export function useLineage(sketchId: string, version: number | null) {
  return useQuery({
    ...apiQuery("sketches.lineage", {
      params: { id: sketchId },
      query: { version: String(version ?? 1) },
    }),
    enabled: version !== null,
    staleTime: 0,
    retry: false,
  });
}

/** The endpoint is not built on this server yet (contracts §13: a typed 501 until W3 stage A mounts it). */
export const lineageNotBuilt = (e: unknown): boolean =>
  e instanceof OakApiError && e.code === "not_implemented";

/**
 * The chain from the sketch's own versions, first to last: `tip`, its parent, its parent's parent… up to the first
 * version that names no parent. What the chain view lists while `sketches.lineage` is not built.
 */
export function localChain(versions: readonly SketchVersion[], tip: number): SketchVersion[] {
  const byVersion = new Map(versions.map((v) => [v.version, v]));
  const out: SketchVersion[] = [];
  const seen = new Set<number>();
  let at = byVersion.get(tip);
  while (at && !seen.has(at.version)) {
    seen.add(at.version);
    out.push(at);
    at = at.parentVersion == null ? undefined : byVersion.get(at.parentVersion);
  }
  return out.reverse();
}
