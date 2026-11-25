// Oak 2.0 W4 F2: the capstone's rubric-check history (`capstones.checkHistory`, oldest first), which the "Is it
// better, or just different?" card reads. `key` changes whenever a new check may have landed (the checked version,
// the last result), so the list is fetched again then. Until the server mounts the route it answers 501 and the card
// shows nothing.
import type { CapstoneCheckHistoryEntry } from "@oak/api";
import { useQuery } from "@tanstack/react-query";
import { callApi } from "../lib/api.ts";
import { apiKey } from "../lib/queries.ts";

export function useCheckHistory(capstoneId: string, key: string) {
  const input = { params: { id: capstoneId } };
  return useQuery({
    queryKey: [...apiKey("capstones.checkHistory", input), key] as const,
    queryFn: async ({ signal }): Promise<CapstoneCheckHistoryEntry[]> =>
      (await callApi("capstones.checkHistory", input, { signal })).items,
    retry: 0,
    staleTime: 30_000,
  });
}
