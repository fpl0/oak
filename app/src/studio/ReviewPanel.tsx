// "Review before running" (contracts §11.3; interfaces known gap 4): a version that arrived in an imported
// backup opens as text. It runs only after the strict lint passes; until then the learner can read it, edit it
// as text and check again. Nothing here evaluates the code.
import type { KeySpec, MeterId } from "@oak/content-kit";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { errorWords } from "../lib/error-words.ts";
import { lintInBrowser } from "../lib/grader-client.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { type StrictVerdict, strictLint, strictVerdict } from "./model.ts";

export function ReviewPanel({
  code: initial,
  version,
  meter,
  keySpec,
  onCleared,
}: {
  code: string;
  version: number;
  meter: MeterId;
  keySpec: KeySpec | null;
  /** The strict check passed for this code: it may run. */
  onCleared(code: string): void;
}) {
  const [code, setCode] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [verdict, setVerdict] = useState<StrictVerdict | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const check = async () => {
    setChecking(true);
    setFailed(null);
    try {
      setVerdict(strictVerdict(await lintInBrowser(code, strictLint(meter, keySpec))));
    } catch (e) {
      setFailed(errorWords(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="review-title" data-testid="review-panel">
      <Callout
        tone="attention"
        title={<span id="review-title">Review before running</span>}
        actions={
          verdict?.safe ? (
            <Button
              variant="primary"
              icon={<ShieldCheck aria-hidden className="size-4" />}
              onClick={() => onCleared(code)}
              data-testid="review-open"
            >
              Open in the workbench
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={checking}
              onClick={() => void check()}
              data-testid="review-check"
            >
              Run the safety check
            </Button>
          )
        }
      >
        Version {version} came from an imported backup, so it was not typed on this machine. Oak shows it as
        text first and runs it only after a strict safety check: no network, no page access, nothing but
        music.
      </Callout>
      {failed ? (
        <Callout tone="issue" title="The check could not run">
          {failed}
        </Callout>
      ) : null}
      {verdict?.safe ? (
        <Callout tone="success" title="The check passed">
          Nothing in this code reaches outside the music. Open it to play it; your next Run saves it as a new
          version.
        </Callout>
      ) : null}
      {verdict && !verdict.safe ? (
        <Callout tone="issue" title="It stays as text">
          <p>
            The check found{" "}
            {verdict.problems.length === 1 ? "one thing" : `${verdict.problems.length} things`} it will not
            run:
          </p>
          <ul className="mt-1 list-disc pl-5" data-testid="review-problems">
            {verdict.problems.map((p, i) => (
              <li key={i}>
                Line {p.line}: {p.message}
              </li>
            ))}
          </ul>
          <p className="mt-1">Edit those lines below and check again, or keep it as text.</p>
        </Callout>
      ) : null}
      <div className="rounded-card border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-sm text-text-2">
          <span>Code of version {version}, as text</span>
          <button
            type="button"
            className="rounded-control px-2 py-0.5 text-link hover:bg-surface-2"
            onClick={() => setEditing((e) => !e)}
            aria-pressed={editing}
          >
            {editing ? "Done editing" : "Edit as text"}
          </button>
        </div>
        {editing ? (
          <textarea
            aria-label={`Code of version ${version}`}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setVerdict(null);
            }}
            spellCheck={false}
            className="block min-h-64 w-full resize-y bg-surface p-3 font-mono text-sm leading-relaxed text-text outline-none"
          />
        ) : (
          <pre
            className="max-h-[50vh] overflow-auto p-3 font-mono text-sm leading-relaxed"
            data-testid="review-code"
          >
            {code}
          </pre>
        )}
      </div>
    </section>
  );
}
