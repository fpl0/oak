// `/studio?try=<toolId>` (the Coda's and the unlock moment's "Try it in Studio"): opens a new sketch that starts from
// the tool's demo. A locked or unknown tool, or a failed create, lands on the sketchbook with a calm toast.
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useContent } from "../lib/content.ts";
import { errorWords } from "../lib/error-words.ts";
import { useSketchCreate } from "../lib/queries.ts";
import { shownToolLabel as toolLabel } from "../toolbox/label.ts";
import { toolSketchBody } from "../toolbox/model.ts";
import { Page } from "../ui/kit/basics.tsx";
import { LoadingState } from "../ui/kit/QueryState.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { useUnlockedSet } from "./queries.ts";

export function TryTool({ toolId, onHandled }: { toolId: string; onHandled(): void }) {
  const navigate = useNavigate();
  const content = useContent();
  const create = useSketchCreate();
  const { unlocked, ready } = useUnlockedSet();
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !content.data || !ready) return;
    started.current = true;
    const tool = content.data.toolbox.find((t) => t.id === toolId);
    const why =
      tool === undefined
        ? "That tool isn't in the toolbox"
        : !unlocked.has(tool.id)
          ? `${toolLabel(tool).text} isn't unlocked yet`
          : !tool.catalog.demo
            ? `${toolLabel(tool).text} has no example to start from. Open a new sketch and try it there.`
            : null;
    if (tool === undefined || why !== null) {
      toast.info(why ?? "That tool isn't in the toolbox");
      onHandled();
      return;
    }
    create
      .mutateAsync({ body: toolSketchBody(tool, tool.catalog.demo) })
      .then((saved) =>
        navigate({ to: "/studio/$sketchId", params: { sketchId: saved.sketch.id }, replace: true }),
      )
      .catch((e: unknown) => {
        toast.error("Couldn't open it in the Studio", errorWords(e));
        onHandled();
      });
  }, [content.data, ready, unlocked, toolId, create, navigate, onHandled]);
  return (
    <Page>
      <LoadingState rows={3} label="Opening a new sketch" />
    </Page>
  );
}
