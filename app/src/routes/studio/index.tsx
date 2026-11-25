// /studio (ux §2.3): the sketchbook. The page lives in app/src/studio/Sketchbook.tsx.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Sketchbook } from "../../studio/Sketchbook.tsx";
import { TryTool } from "../../studio/TryTool.tsx";

const searchSchema = z.object({
  new: z.boolean().optional().catch(undefined),
  /** "Try it in Studio" (the Coda, the unlock moment): a new sketch from this tool's demo. */
  try: z.string().optional().catch(undefined),
  /** Oak 2.0 S1: open the sketchbook on its Scraps tab ("From scraps", a capture's "See it in scraps"). */
  /** `?scraps=1` (a number once TanStack parses the search) counts as `true`, as the plan and the specs write it. */
  scraps: z
    .union([z.boolean(), z.literal(1), z.literal("1")])
    .transform((v) => v === true || v === 1 || v === "1")
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/studio/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: StudioRoute,
});

function StudioRoute() {
  const { new: wantsNew, try: tryTool, scraps: wantsScraps } = Route.useSearch();
  const navigate = useNavigate();
  if (tryTool)
    return (
      <TryTool
        toolId={tryTool}
        onHandled={() => void navigate({ to: "/studio", search: {}, replace: true })}
      />
    );
  return (
    <Sketchbook
      wantsNew={wantsNew === true}
      wantsScraps={wantsScraps === true}
      onScrapsChange={(open) =>
        void navigate({ to: "/studio", search: open ? { scraps: true } : {}, replace: true })
      }
      onNewHandled={() => void navigate({ to: "/studio", search: {}, replace: true })}
    />
  );
}
