// Loading, error and empty states for server data. Every page renders through these so the three states look
// and read the same everywhere.
import { OakApiError } from "@oak/api";
import type { UseQueryResult } from "@tanstack/react-query";
import { CloudOff, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button.tsx";
import { EmptyState, Skeleton } from "./basics.tsx";

/**
 * What every surface says while Oak's server is not answering (pages, Settings, the tutor panel): one message and one
 * way back. The desktop app never shows it: it says "Oak stopped" itself and quits (desktop/main.cjs). Queries ask
 * again when the window gets the focus back (lib/query-client.ts), so the page fills in once the server is back.
 */
export const SERVER_DOWN = {
  title: "Oak's server isn't answering",
  body: "Start Oak again (in a terminal: bun run start). Your work is saved.",
} as const;

/** The server is not there: no response at all, or the dev proxy's "bad gateway" or "gateway timeout" in its place. */
export function isServerDown(error: unknown): boolean {
  return (
    error instanceof OakApiError && (error.code === "network" || error.status === 502 || error.status === 504)
  );
}

/** Learner-facing copy for an API failure. Never shows a stack or a raw status line. */
export function describeError(error: unknown): { title: string; body: string } {
  if (isServerDown(error)) return { ...SERVER_DOWN };
  if (error instanceof OakApiError) {
    switch (error.code) {
      case "not_found":
        return { title: "Nothing here", body: "This item doesn't exist, or it was deleted." };
      case "contract":
        return {
          title: "The server and the app disagree",
          body: "They are from different versions. Restart Oak to bring them back in step.",
        };
      case "forbidden":
        return { title: "Request refused", body: "Oak only answers its own page on this computer." };
      case "not_implemented":
        return { title: "Not built yet", body: "This part of Oak's server is still being built." };
      default:
        return { title: "Something went wrong", body: error.message };
    }
  }
  return { title: "Something went wrong", body: error instanceof Error ? error.message : String(error) };
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { title, body } = describeError(error);
  return (
    <div role="alert" data-state="error">
      <EmptyState
        icon={<CloudOff aria-hidden />}
        title={title}
        action={
          onRetry && (
            <Button icon={<RotateCcw aria-hidden className="size-4" />} onClick={onRetry}>
              Try again
            </Button>
          )
        }
      >
        {body}
      </EmptyState>
    </div>
  );
}

export function LoadingState({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} data-state="loading" className="flex flex-col gap-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

/**
 * Renders `children(data)` once a query has data, a skeleton while it loads, an error state with retry when it
 * fails, and `empty` when `isEmpty(data)` holds.
 */
export function QueryView<T>({
  query,
  children,
  empty,
  isEmpty,
  loading,
}: {
  query: Pick<UseQueryResult<T>, "data" | "error" | "isPending" | "isError" | "refetch">;
  children: (data: T) => ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  loading?: ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <LoadingState />}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data as T;
  if (empty !== undefined && isEmpty?.(data)) return <div data-state="empty">{empty}</div>;
  return <>{children(data)}</>;
}
