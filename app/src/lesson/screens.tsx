// The lesson's end states: the completion summary (what was made, tools unlocked, can-dos, words met, what
// opens next), the Quick sketch of "Wrap up" and of part A of a split lesson (contracts §9.4), and the
// "Report a grading problem" dialog (contracts §11.8). Calm copy, the next action obvious.
import type { LessonCompleteResult, LessonDef } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { type ContentBundle, lessonTitles } from "../lib/content-model.ts";
import { toolName as learnerToolName } from "../lib/tool-label.ts";
import { useSongAfterSave } from "../song/hooks.ts";
import { SongGrew } from "../song/SongGrew.tsx";
import { newestTakeOfLesson } from "../song/surfaces-model.ts";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { Chip, Skeleton } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { Dialog } from "../ui/kit/Dialog.tsx";
import { Workbench, type WorkbenchProps } from "../workbench/Workbench.tsx";
import { openedText, tracksOpenedCopy } from "./checkpoint/model.ts";
import { InlineMd } from "./frame.tsx";
import type { OriginLink, SideInfo } from "./side.ts";
import { songMakeOf } from "./song-make.ts";

export function CompleteScreen({
  lesson,
  completion,
  sketchId,
  wrapped,
  partA,
  preview,
  inSession,
  content,
  side = null,
  origin = { to: "/", label: "Back to Today" },
  nextSide = null,
}: {
  lesson: LessonDef;
  completion: LessonCompleteResult | null;
  sketchId: string | null;
  wrapped: boolean;
  partA: boolean;
  preview: boolean;
  inSession: boolean;
  content: ContentBundle | null;
  /** A side lesson (Wave 5): its end says it was optional and returns to where the learner came from. */
  side?: SideInfo | null;
  /** Where "back" goes outside a session (Today, the Toolbox, the map). */
  origin?: OriginLink;
  /** The next side lesson of the track, offered without pressure. */
  nextSide?: { id: string; title: string } | null;
}) {
  // The learner's name for a tool (lib/tool-label.ts, as Today and the Coda say it): a feature by its plain name
  // ("Sing panel", never the registry's editorial note in parentheses, as in "Sing panel (PitchLane)"), a code row by
  // its code, a sound by the code the learner types, never the catalog's "†" author mark.
  const toolName = (id: string) => {
    const entry = content?.toolbox.find((t) => t.id === id);
    return entry ? learnerToolName(entry) : { text: id, mono: true };
  };
  const canDo = (id: string) => content?.candos.find((c) => c.id === id)?.statement ?? id;
  const term = (id: string) => content?.terms.find((t) => t.id === id)?.term ?? id;
  // What opens is named by title ("Blues checkpoint"), never by ID.
  const opened = openedText(completion?.opened ?? [], lessonTitles(content?.syllabus ?? null));
  // Wave 6: a completion that met an advanced-track gate (U15.L06: more of the Jazz track) says so once.
  const tracksCopy = tracksOpenedCopy(
    completion?.gatesOpened,
    new Map((content?.syllabus?.tracks ?? []).map((t) => [t.id, t.title])),
  );
  const title = partA
    ? "Part A done"
    : wrapped
      ? "Saved for next time"
      : side
        ? "Side lesson complete"
        : "Lesson complete";
  const body = partA
    ? "Your quick sketch is saved. Part B picks up right after this step next time."
    : wrapped
      ? "Your quick sketch is saved. The lesson resumes at the next unfinished step."
      : `${lesson.title}: ${lesson.objective}`;
  // A take lesson finished outside a session (a side lesson from Today, a lesson from the map): its Make went into
  // the unit's song, so the recap shows the song as it grew and leads to it (spec §5.5). Inside a session the Coda
  // shows the same card, so the recap stays short there.
  const grew = !inSession && !partA && !wrapped && !preview && songMakeOf(lesson.id) !== null;
  // Whether the song card shows today's Make: `pending` while the song is read, `missing` when the Make is not in it.
  const songCard = useSongCardState(grew ? lesson.id : null, sketchId);
  return (
    <div className="mx-auto flex max-w-[40rem] flex-col gap-5 px-6 py-10" data-testid="lesson-complete">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Check aria-hidden className="size-5" />
        </span>
        <div>
          <h2
            tabIndex={-1}
            className="font-display text-h1 font-semibold"
            ref={(el) => el?.focus({ preventScroll: true })}
          >
            {title}
          </h2>
          <p className="mt-1 text-text-2">
            <InlineMd text={body} />
          </p>
        </div>
      </div>
      {side && !partA && !wrapped && (
        <p className="text-sm text-text-2" data-testid="side-complete-note">
          {nextSide
            ? `It was optional, and your course carries on where it was. ${nextSide.title}, the next side lesson, is there whenever you want it.`
            : "It was optional, and your course carries on where it was."}
        </p>
      )}
      {preview && (
        <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-text-2">
          This was a preview: nothing was saved to your progress.
        </p>
      )}
      {completion && (
        <dl className="grid gap-3">
          {completion.unlocks.length > 0 && (
            <div>
              <dt className="text-sm font-medium">New in your toolbox</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {completion.unlocks.map((u) => {
                  const name = toolName(u.itemId);
                  return (
                    // A long name (a list of sounds) wraps inside the column instead of running under the rail.
                    <Chip
                      key={u.itemId}
                      tone="amber"
                      className="h-auto min-h-6 max-w-full whitespace-normal py-0.5 [overflow-wrap:anywhere]"
                    >
                      {name.mono ? <code className="font-mono">{name.text}</code> : name.text}
                    </Chip>
                  );
                })}
              </dd>
            </div>
          )}
          {completion.canDo.length > 0 && (
            <div>
              <dt className="text-sm font-medium">Can-do</dt>
              <dd className="mt-1 flex flex-col gap-1 text-sm">
                {completion.canDo.map((c) => (
                  <span key={`${c.candoId}-${c.status}`}>
                    {canDo(c.candoId)} <span className="text-text-3">({c.status})</span>
                  </span>
                ))}
              </dd>
            </div>
          )}
          {completion.terms.length > 0 && (
            <div>
              <dt className="text-sm font-medium">Words you met</dt>
              <dd className="mt-1 text-sm text-text-2">
                {completion.terms.map((t) => term(t.termId)).join(", ")}
              </dd>
            </div>
          )}
          {completion.seeded.length > 0 && (
            <div>
              <dt className="text-sm font-medium">Practice</dt>
              <dd className="mt-1 text-sm text-text-2">
                {completion.seeded.length === 1
                  ? "One new practice set joins your warm-ups."
                  : `${completion.seeded.length} new practice sets join your warm-ups.`}
              </dd>
            </div>
          )}
          {opened !== "" && (
            <div>
              <dt className="text-sm font-medium">Open now</dt>
              <dd className="mt-1 text-sm text-text-2" data-testid="lesson-opened">
                {opened}
              </dd>
            </div>
          )}
        </dl>
      )}
      {tracksCopy && (
        <div data-testid="tracks-opened" data-authored={tracksCopy.authored ? "1" : "0"}>
          <Callout tone="info" title={tracksCopy.title}>
            {tracksCopy.body}
          </Callout>
        </div>
      )}
      {/* The way on comes before the song card, so it stays on the first screen at 1280×800 however tall the card
          is. The Studio link is a quiet second; once the song card shows, its own "Open today's code in Studio"
          stands for it, and while the song is read neither shows, so nothing flashes before the primary. */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={inSession ? "/" : origin.to}
          className={buttonClass("primary", "lg")}
          data-testid="back-to-today"
        >
          {inSession ? "On to the Coda" : origin.label}
        </Link>
        {sketchId && sketchId !== "preview" && (!grew || songCard === "missing") && (
          <StudioLink sketchId={sketchId} />
        )}
      </div>
      {grew && sketchId && (
        <SongGrew
          lessonId={lesson.id}
          sketchIds={[sketchId]}
          fallback={null}
          // The card's room while the song is read, so the recap does not grow under the learner's eyes.
          pending={<Skeleton className="h-[28rem] w-full rounded-card" />}
        />
      )}
    </div>
  );
}

/**
 * What the recap's song card shows for a take lesson's Make (`SongGrew`'s own test): the card, or not yet known. The
 * save has just invalidated the song, so the copy in hand can predate it: until a read from after the recap opened
 * settles, the Make is not judged missing (`useSongAfterSave`), so the Studio link never flashes before the card.
 */
function useSongCardState(lessonId: string | null, sketchId: string | null): "pending" | "shown" | "missing" {
  const make = lessonId ? songMakeOf(lessonId) : null;
  const { q, settling } = useSongAfterSave(make ? make.def.unit : null);
  if (!make) return "missing";
  if (!q.data) return q.isPending ? "pending" : "missing";
  if (lessonId && sketchId && newestTakeOfLesson(q.data, lessonId, [sketchId])) return "shown";
  return settling ? "pending" : "missing";
}

function StudioLink({ sketchId }: { sketchId: string }) {
  return (
    <Link
      to="/studio/$sketchId"
      params={{ sketchId }}
      className={buttonClass("secondary")}
      data-testid="recap-open-sketch"
    >
      Open the sketch in Studio
    </Link>
  );
}

export function QuickSketch({
  code,
  partA,
  canCancel,
  busy,
  notice,
  workbench,
  defaultTitle,
  onSave,
  onCancel,
}: {
  code: string;
  partA: boolean;
  canCancel: boolean;
  busy: boolean;
  notice: string | null;
  workbench: Omit<WorkbenchProps, "id" | "code">;
  defaultTitle: string;
  onSave(code: string, title: string): void;
  onCancel(): void;
}) {
  const [current, setCurrent] = useState(code);
  const [title, setTitle] = useState(defaultTitle);
  return (
    <div className="mx-auto flex h-full max-w-[60rem] flex-col gap-4 px-6 py-6" data-testid="quick-sketch">
      <div>
        <h2
          tabIndex={-1}
          className="font-display text-h2 font-semibold"
          ref={(el) => el?.focus({ preventScroll: true })}
        >
          Quick sketch
        </h2>
        <p className="mt-1 max-w-[60ch] text-text-2">
          {partA
            ? "That's part A. Save what you have as a sketch; part B starts right after this next time."
            : "Save what you have as a sketch. The lesson keeps your place and picks up at the next unfinished step."}
        </p>
      </div>
      <Workbench {...workbench} id="l-quick" code={current} onChange={setCurrent} />
      {notice && (
        <p role="status" className="rounded-control bg-surface-2 px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-2">Title</span>
          <input
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 w-72 rounded-control border border-border bg-surface px-2"
          />
        </label>
        <Button
          variant="primary"
          size="lg"
          loading={busy}
          onClick={() => onSave(current, title.trim() || defaultTitle)}
          data-testid="save-quick"
        >
          Save sketch
        </Button>
        {canCancel && (
          <Button variant="ghost" size="lg" onClick={onCancel} disabled={busy}>
            Back to the lesson
          </Button>
        )}
      </div>
    </div>
  );
}

export function ReportDialog({
  open,
  onClose,
  onSend,
  busy,
}: {
  open: boolean;
  onClose(): void;
  onSend(note: string): void;
  busy: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Report a grading problem"
      description="Oak saves this check, your answer and your note on this computer. The check gives no evidence and you can go on at once."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => onSend(note.trim())}
            data-testid="send-report"
          >
            Send report
          </Button>
        </div>
      }
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text-2">What looks wrong? (optional)</span>
        <textarea
          value={note}
          maxLength={2000}
          rows={4}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-control border border-border bg-surface p-2"
          data-testid="report-note"
        />
      </label>
    </Dialog>
  );
}
