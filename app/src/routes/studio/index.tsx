// /studio (ux §2.3): the sketchbook. The page lives in app/src/studio/Sketchbook.tsx. Oak 2.0: `?scraps=1` (W1),
// `?habits=1` and `?catalog=new|outside` (W3) open its tabs.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { type BookTab, Sketchbook } from "../../studio/Sketchbook.tsx";
import { TryTool } from "../../studio/TryTool.tsx";

/** `?x=1` (a number once TanStack parses the search) counts as `true`, as the plan and the specs write it. */
const flag = z
  .union([z.boolean(), z.literal(1), z.literal("1")])
  .transform((v) => v === true || v === 1 || v === "1")
  .optional()
  .catch(undefined);

const searchSchema = z.object({
  new: z.boolean().optional().catch(undefined),
  /** "Try it in Studio" (the Coda, the unlock moment): a new sketch from this tool's demo. */
  try: z.string().optional().catch(undefined),
  /** Oak 2.0 S1: open the sketchbook on its Scraps tab ("From scraps", a capture's "See it in scraps"). */
  scraps: flag,
  /** Oak 2.0 W3 (S6): the Habits tab. */
  habits: flag,
  /** Oak 2.0 W3 (S6): the Catalogs tab; `outside` opens "Outside your lane" (offered on Today). */
  catalog: z.enum(["new", "outside"]).optional().catch(undefined),
});

/** The search that shows a sketchbook tab. */
function searchOfTab(tab: BookTab): { scraps?: true; habits?: true; catalog?: "new" } {
  if (tab === "scraps") return { scraps: true };
  if (tab === "habits") return { habits: true };
  if (tab === "catalogs") return { catalog: "new" };
  return {};
}

export const Route = createFileRoute("/studio/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: StudioRoute,
});

function StudioRoute() {
  const {
    new: wantsNew,
    try: tryTool,
    scraps: wantsScraps,
    habits: wantsHabits,
    catalog,
  } = Route.useSearch();
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
      wantsHabits={wantsHabits === true}
      wantsCatalog={catalog ?? null}
      onTabChange={(tab) => void navigate({ to: "/studio", search: searchOfTab(tab), replace: true })}
      onNewHandled={() => void navigate({ to: "/studio", search: {}, replace: true })}
    />
  );
}
