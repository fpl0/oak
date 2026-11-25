// Oak 2.0 W1 (PLAN §4 S3): the Jam toggle and, while Jam is on, the bar under the header: what Jam does, an
// optional timebox (the learner names the task and picks a length; a quiet clock; when it runs out Oak names a
// stop and break and never stops the playback) and an optional "what's in this take" row that only describes the last Run.
import { Clock, Music2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/kit/Button.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import {
  clockText,
  JAM_WORDS,
  roughPassLine,
  TIMEBOX_MINUTES,
  type Timebox,
  timeboxLeft,
  timeUpLine,
} from "./jam.ts";

/** The header's Jam switch (off by default; the learner chooses). */
export function JamToggle({ jam, onToggle }: { jam: boolean; onToggle(on: boolean): void }) {
  return (
    <Button
      variant={jam ? "primary" : "ghost"}
      icon={<Music2 aria-hidden className="size-4" />}
      aria-pressed={jam}
      title={JAM_WORDS.jamTitle}
      onClick={() => onToggle(!jam)}
      data-testid="jam-toggle"
    >
      {JAM_WORDS.jam}
    </Button>
  );
}

const timeboxKey = (sketchId: string) => `oak.studio.timebox.${sketchId}`;

function readTimebox(sketchId: string): Timebox | null {
  try {
    const raw = sessionStorage.getItem(timeboxKey(sketchId));
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<Timebox>;
    return typeof t.task === "string" && typeof t.minutes === "number" && typeof t.startedAt === "number"
      ? { task: t.task, minutes: t.minutes, startedAt: t.startedAt }
      : null;
  } catch {
    return null;
  }
}

function writeTimebox(sketchId: string, t: Timebox | null): void {
  try {
    if (t === null) sessionStorage.removeItem(timeboxKey(sketchId));
    else sessionStorage.setItem(timeboxKey(sketchId), JSON.stringify(t));
  } catch {
    // a timebox that is not remembered across a reload is still a timebox
  }
}

/** The bar shown while Jam is on. `lastRunCode`: the code of the last successful Run (the rough-pass row reads it). */
export function JamBar({
  sketchId,
  lastRunCode,
  onSwitchToEditing,
}: {
  sketchId: string;
  lastRunCode: string | null;
  onSwitchToEditing(): void;
}) {
  const [timebox, setTimeboxState] = useState<Timebox | null>(() => readTimebox(sketchId));
  const setTimebox = (t: Timebox | null) => {
    setTimeboxState(t);
    writeTimebox(sketchId, t);
  };
  const [task, setTask] = useState("");
  const [minutes, setMinutes] = useState<number | null>(null);
  const [rough, setRough] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const left = timebox ? timeboxLeft(timebox, now) : null;
  const up = left?.up ?? false;
  // A quiet clock: it ticks once a second while running and stops when the time is up.
  useEffect(() => {
    if (!timebox || up) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timebox, up]);

  const start = () => {
    if (task.trim() === "" || minutes === null) return;
    const at = Date.now();
    setNow(at);
    setTimebox({ task: task.trim(), minutes, startedAt: at });
  };

  return (
    <section
      aria-label="Jam"
      className="flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2 text-sm"
      data-testid="jam-bar"
    >
      <p className="text-text-2">{JAM_WORDS.jamOn}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {timebox === null ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
            data-testid="timebox-form"
          >
            <Clock aria-hidden className="size-4 text-text-3" />
            <label className="flex items-center gap-1.5">
              <span className="text-text-2">{JAM_WORDS.timeboxTask}</span>
              <input
                value={task}
                maxLength={80}
                onChange={(e) => setTask(e.target.value)}
                placeholder={JAM_WORDS.timeboxTaskPlaceholder}
                className="h-8 w-48 rounded-control border border-border bg-surface px-2 text-text"
                data-testid="timebox-task"
              />
            </label>
            <fieldset className="m-0 flex items-center gap-1 border-0 p-0">
              <legend className="sr-only">{JAM_WORDS.timeboxLength}</legend>
              {TIMEBOX_MINUTES.map((m) => (
                <label
                  key={m}
                  className="flex h-7 cursor-pointer items-center rounded-control border border-border px-2 has-[:checked]:border-accent has-[:checked]:bg-lane-in"
                >
                  <input
                    type="radio"
                    name={`timebox-${sketchId}`}
                    value={m}
                    checked={minutes === m}
                    onChange={() => setMinutes(m)}
                    className="sr-only"
                    data-testid={`timebox-${m}`}
                  />
                  {m} min
                </label>
              ))}
            </fieldset>
            <Button size="sm" type="submit" disabled={task.trim() === "" || minutes === null}>
              {JAM_WORDS.timeboxStart}
            </Button>
          </form>
        ) : (
          <span className="flex items-center gap-2" data-testid="timebox">
            <Clock aria-hidden className="size-4 text-text-3" />
            <span className="text-text">“{timebox.task}”</span>
            <span className="font-mono text-text-2 tabular-nums" data-testid="timebox-clock">
              {clockText(left?.leftMs ?? 0)} {JAM_WORDS.timeboxLeft}
            </span>
            {!up ? (
              <Button size="sm" variant="ghost" onClick={() => setTimebox(null)}>
                {JAM_WORDS.timeboxStop}
              </Button>
            ) : null}
          </span>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-text-2" title={JAM_WORDS.roughPassTitle}>
          <input
            type="checkbox"
            checked={rough}
            onChange={(e) => setRough(e.target.checked)}
            className="accent-[var(--oak-accent)]"
            data-testid="rough-pass-toggle"
          />
          {JAM_WORDS.roughPass}
        </label>
      </div>
      {rough ? (
        <div className="flex flex-col gap-1">
          <p className="text-text" data-testid="rough-pass">
            {lastRunCode === null ? JAM_WORDS.roughPassEmpty : roughPassLine(lastRunCode)}
          </p>
          {lastRunCode !== null ? (
            <p className="text-text-2" data-testid="rough-pass-listen">
              {JAM_WORDS.roughPassListen}
            </p>
          ) : null}
        </div>
      ) : null}
      {timebox && up ? (
        <Callout
          tone="info"
          title={timeUpLine(timebox.task)}
          actions={
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setTimebox(null);
                onSwitchToEditing();
              }}
              data-testid="timebox-switch"
            >
              {JAM_WORDS.switchToEditing}
            </Button>
          }
        />
      ) : null}
    </section>
  );
}
