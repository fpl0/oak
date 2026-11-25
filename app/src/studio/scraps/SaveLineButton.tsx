// Oak 2.0 W1 (S1): "Save a line" beside a Workbench (a lesson's Make): pick one labelled line of the code and keep it
// in scraps, with the consts it uses, so it can start a sketch later.
import { type KeySpec, labelledLines, type MeterId, roleOfLabel, tempoLineOf } from "@oak/api";
import { BookmarkPlus } from "lucide-react";
import { useState } from "react";
import { bpmOfTempoLine } from "../../capture/model.ts";
import { errorWords } from "../../lib/error-words.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Dialog } from "../../ui/kit/Dialog.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { lineScrapBody, ROLE_WORDS } from "./model.ts";
import { useScrapCreate } from "./queries.ts";

export function SaveLineButton({
  code,
  source,
  bpm,
  meter,
  keySpec,
}: {
  code: string;
  /** Where the line is saved from: a lesson step (`"<lessonId>/<stepId>"`) or a sketch (`"<sketchId>@<version>"`). */
  source: { kind: "lesson" | "sketch"; ref: string };
  /** The tempo the code plays at when it has no tempo line of its own. */
  bpm: number | null;
  meter: MeterId | null;
  keySpec: KeySpec | null;
}) {
  const [open, setOpen] = useState(false);
  const create = useScrapCreate();
  // One row per label: a label saves its first line (`scrapCode`).
  const seen = new Set<string>();
  const lines = labelledLines(code).filter((l) => {
    if (l.label === "$" || seen.has(l.label)) return false;
    seen.add(l.label);
    return true;
  });
  const empty = lines.length === 0;

  const save = async (label: string) => {
    const body = lineScrapBody({
      code,
      label,
      sourceKind: source.kind,
      sourceRef: source.ref,
      // The code's own tempo line wins: the scrap plays as the learner heard it.
      bpm: (() => {
        const t = tempoLineOf(code);
        return (t && meter ? bpmOfTempoLine(t, meter) : null) ?? bpm;
      })(),
      meter,
      key: keySpec,
    });
    if (!body) return;
    try {
      await create.mutateAsync({ body });
      setOpen(false);
      toast.success(`Saved “${label}” to scraps`, "Studio › Scraps has it.");
    } catch (e) {
      toast.error("The line wasn't saved", errorWords(e));
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        icon={<BookmarkPlus aria-hidden className="size-4" />}
        disabled={empty}
        title={empty ? "Give a line a name (drums: …) to save it" : undefined}
        onClick={() => setOpen(true)}
        data-testid="save-line"
      >
        Save a line
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Save a line to scraps"
        description="Pick a line to keep. It goes to Studio › Scraps with what it needs to play."
      >
        <ul className="flex flex-col gap-2" data-testid="save-line-list">
          {lines.map((l) => (
            <li key={`${l.label}@${l.from}`} className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-text-2">{ROLE_WORDS[roleOfLabel(l.label)]}</span>
                <code className="block truncate font-mono text-sm text-text">{l.text.split("\n")[0]}</code>
              </span>
              <Button
                size="sm"
                loading={create.isPending && create.variables?.body.label === l.label}
                onClick={() => void save(l.label)}
                data-testid="save-line-pick"
              >
                Save {l.label}
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
