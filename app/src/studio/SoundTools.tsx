// Oak 2.0 W1 (PLAN S4, S7): the sound tools under the sketch's transport (editor slot `sound-tools`, place
// `toolbar`). Two listening modes and a commit:
//   - Plain sounds: the learner's bass, chords and tune each play one plain sound (`EditorHandle.setPlainSounds`).
//   - Listen through…: the mix as through a wall, a small speaker or very quietly (`MasterBus.setListenThrough`),
//     before the speakers only (never the record tap or the meters). Switched off after use, it asks the learner to
//     write one thing they heard; "Add to code" writes it as a comment after the tempo line, through `applyCode`.
//   - Commit sounds of <line>: keeps that line's sound as it is in the saved version; CommitGuard asks about later
//     changes.
// The two listening modes change only what is heard, say so on screen while on, never touch the code, and are off
// again when the editor closes (W1 fidelity rule 3). Copy lives in commit.ts (`COMMIT_COPY`), checked descriptive.
import { labelledLines, tempoLineOf } from "@oak/content-kit";
import type { ListenThroughMode } from "@oak/strudel";
import { useEffect, useId, useRef, useState } from "react";
import { getOak, peekOak } from "../lib/oak.ts";
import { useSketchPatch } from "../lib/queries.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Chip } from "../ui/kit/basics.tsx";
import { Switch } from "../ui/kit/Field.tsx";
import { COMMIT_COPY, heardComment, insertAfterTempo, LISTEN_LABELS } from "./commit.ts";
import type { EditorSlotProps } from "./editor-slots.ts";

type ListenChoice = ListenThroughMode | "off";
const LISTEN_OPTIONS: readonly { value: ListenChoice; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "muffled", label: LISTEN_LABELS.muffled },
  { value: "small-speaker", label: LISTEN_LABELS["small-speaker"] },
  { value: "quiet", label: LISTEN_LABELS.quiet },
];

function PlainSoundsSwitch({ editor }: { editor: EditorSlotProps["editor"] }) {
  const [on, setOn] = useState(false);
  const id = useId();
  // A new editor starts with plain sounds off; leaving the sketch (or replacing the editor) turns them off.
  useEffect(() => {
    setOn(editor?.plainSounds() ?? false);
    return () => {
      if (editor && !editor.disposed) editor.setPlainSounds(false);
    };
  }, [editor]);
  const toggle = (next: boolean) => {
    if (!editor) return;
    editor.setPlainSounds(next);
    setOn(next);
  };
  return (
    <>
      <span className="inline-flex items-center gap-2">
        <Switch id={id} checked={on} onChange={toggle} disabled={!editor} />
        <label htmlFor={id} className="text-sm">
          {COMMIT_COPY.plainSwitch}
        </label>
      </span>
      {on && (
        <p className="order-last basis-full text-sm text-text-2" role="status" data-testid="plain-sounds-on">
          {COMMIT_COPY.plainOn}
        </p>
      )}
    </>
  );
}

function ListenThrough({ liveCode, applyCode }: Pick<EditorSlotProps, "liveCode" | "applyCode">) {
  const [mode, setMode] = useState<ListenThroughMode | null>(null);
  /** The mode last heard, once it was switched off: the learner is asked what they heard. */
  const [heardFrom, setHeardFrom] = useState<ListenThroughMode | null>(null);
  const [heard, setHeard] = useState("");
  const id = useId();
  const heardId = useId();
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Off when the editor closes: the master bus is shared by every page.
  useEffect(
    () => () => {
      if (modeRef.current !== null) peekOak()?.master.setListenThrough(null);
    },
    [],
  );
  const choose = async (choice: ListenChoice) => {
    const next = choice === "off" ? null : choice;
    const before = mode;
    setMode(next);
    if (next === null) peekOak()?.master.setListenThrough(null);
    else {
      setHeardFrom(null);
      try {
        (await getOak()).master.setListenThrough(next);
      } catch {
        setMode(before); // audio did not start: the shell's audio status says why
        return;
      }
    }
    if (next === null && before !== null) setHeardFrom(before);
  };
  const add = () => {
    if (heardFrom === null || heard.trim() === "") return;
    applyCode(insertAfterTempo(liveCode, heardComment(heardFrom, heard), tempoLineOf(liveCode)));
    setHeard("");
    setHeardFrom(null);
  };
  return (
    <>
      <span className="inline-flex items-center gap-2">
        <label htmlFor={id} className="text-sm">
          {COMMIT_COPY.listenMenu}
        </label>
        <select
          id={id}
          value={mode ?? "off"}
          onChange={(e) => void choose(e.target.value as ListenChoice)}
          className="h-8 rounded-control border border-control-border bg-control px-2 text-sm text-text hover:bg-control-hover"
          data-testid="listen-through"
        >
          {LISTEN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
      {mode !== null && (
        <p
          className="order-last basis-full text-sm text-text-2"
          role="status"
          data-testid="listen-through-on"
        >
          {COMMIT_COPY.listenOn(LISTEN_LABELS[mode])}
        </p>
      )}
      {heardFrom !== null && (
        <form
          className="order-last flex basis-full flex-wrap items-center gap-2"
          data-testid="heard-prompt"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor={heardId} className="text-sm">
            {COMMIT_COPY.heardPrompt}
          </label>
          <input
            id={heardId}
            type="text"
            value={heard}
            maxLength={200}
            onChange={(e) => setHeard(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-control border border-control-border bg-control px-2 text-sm text-text"
            data-testid="heard-field"
          />
          <Button type="submit" size="sm" disabled={heard.trim() === ""}>
            {COMMIT_COPY.heardAdd}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setHeardFrom(null)}>
            {COMMIT_COPY.notNow}
          </Button>
        </form>
      )}
    </>
  );
}

function CommitSounds({
  sketch,
  version,
  cursorLabel,
}: Pick<EditorSlotProps, "sketch" | "version" | "cursorLabel">) {
  const patch = useSketchPatch();
  if (cursorLabel === null) return null;
  const committed = sketch.committed ?? [];
  const mine = committed.find((c) => c.label === cursorLabel);
  const write = (next: typeof committed) =>
    patch.mutate({ params: { id: sketch.id }, body: { committed: next } });
  if (mine)
    return (
      <span className="inline-flex items-center gap-2" data-testid="commit-state">
        <Chip tone="accent" title={`v${mine.version}`}>
          {COMMIT_COPY.committed}
        </Chip>
        <Button
          variant="ghost"
          size="sm"
          loading={patch.isPending}
          onClick={() => write(committed.filter((c) => c.label !== cursorLabel))}
        >
          {COMMIT_COPY.uncommit}
        </Button>
      </span>
    );
  // The committed sound is the saved version's line: a line not saved yet has nothing to commit.
  const saved = labelledLines(version.code).some((l) => l.label === cursorLabel);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={!saved}
      loading={patch.isPending}
      onClick={() =>
        write([...committed, { label: cursorLabel, version: version.version, at: new Date().toISOString() }])
      }
      data-testid="commit-sounds"
    >
      {COMMIT_COPY.commit(cursorLabel)}
    </Button>
  );
}

export function SoundTools(props: EditorSlotProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="sound-tools">
      <PlainSoundsSwitch editor={props.editor} />
      <ListenThrough liveCode={props.liveCode} applyCode={props.applyCode} />
      <CommitSounds sketch={props.sketch} version={props.version} cursorLabel={props.cursorLabel} />
    </div>
  );
}
