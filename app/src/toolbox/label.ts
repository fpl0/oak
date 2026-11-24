// The label a learner sees for a tool on the Toolbox and Studio surfaces: `lib/tool-label.ts` `toolLabel`, without
// the catalog's internal "†" (contracts §3.2 rule 7: a row whose audibility the S3 harness still has to confirm).
// The mark is a note for authors, not for the learner: ".partials([…]) †" reads ".partials([…])".
// A sound is named by the code the learner types (`toolName`: `.s("ebass")`, `.bank("rockkit")`), never by the
// registry's code column, which glues a description, a credit and a licence to the name ("ebass (a real bass
// guitar, picked (FreePats Bass Guitar YR, CC0))") or names a soundfont file ("pad (gm_pad_warm)").
import type { ToolEntry } from "@oak/content-kit";
import { type ToolLabel, toolLabel, toolName } from "../lib/tool-label.ts";
import { starterSong } from "../studio/templates.ts";

export function shownToolLabel(t: Parameters<typeof toolLabel>[0]): ToolLabel {
  const l = t.kind === "sound" ? toolName(t) : toolLabel(t);
  return { ...l, text: l.text.replace(/\s*†\s*$/u, "").replace(/\s+†\s+/gu, " ") };
}

/** A credit or a soundfont file name in brackets: "(FreePats Bass Guitar YR, CC0)", "(gm_pad_warm)", "(CC0)". */
const SOURCE_NOTE = /\s*\((?:[^()]*\b(?:CC0|CC BY[^()]*|MIT|Unlicense)\b[^()]*|gm_[^()]*)\)/g;

/**
 * What a tool does, as a card or a tool page says it: the catalog's meaning, for a sound without its credit and
 * licence (the tool page gives them on their own line, from the pack's credits) or a soundfont file name.
 */
export function shownMeaning(t: Pick<ToolEntry, "kind" | "catalog">): string {
  const m = t.catalog.meaning;
  return t.kind === "sound" ? m.replace(SOURCE_NOTE, "").replace(/\s+([.,;:])/g, "$1") : m;
}

/** A Studio template row ("Studio template \"Four-chord pop\""): its starter song is in studio/templates.ts. */
export const isStudioTemplate = (t: Pick<ToolEntry, "kind" | "code">): boolean =>
  t.kind === "template" && /^Studio template /.test(t.code);

/**
 * The idea behind a tool. A Studio template's registry concept is a release note ("released C2"), which says
 * nothing to a learner: it reads as what the template is.
 */
export function shownConcept(t: Pick<ToolEntry, "kind" | "code" | "concept">): string {
  return isStudioTemplate(t) ? "a whole song to start a sketch from" : t.concept;
}

/**
 * What a tool does, on its card and its page. A Studio template says what its starter song is (studio/templates.ts)
 * rather than its registry note ("Released C2."), which says nothing of the song.
 */
export function shownToolMeaning(t: Pick<ToolEntry, "id" | "kind" | "code" | "catalog">): string {
  if (isStudioTemplate(t)) return starterSong(t.id)?.about ?? "A whole song to start a new sketch from.";
  return shownMeaning(t);
}
