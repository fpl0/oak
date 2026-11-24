// `/capstone/$id` (ux §2.3, contracts §2.4): the capstone workspace. Locked → why and what opens it; open → the
// start of its first session (flavour choice, what unlocks now); in progress or released → the workspace.
import {
  type CapstoneDef,
  type CapstoneGate,
  type CapstoneState,
  type FlavourId,
  isCapstoneId,
  type SongId,
  type ToolEntry,
} from "@oak/api";
import type { PatternPlayer } from "@oak/strudel";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Lock, Play, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sideOfCapstone, tidyReason } from "../album/model.ts";
import { ownSketchOf } from "../lesson/make-start.ts";
import { useContent } from "../lib/content.ts";
import { formatDate } from "../lib/format.ts";
import { usePageTitle } from "../lib/nav.ts";
import { getOak } from "../lib/oak.ts";
import {
  apiQuery,
  useBootstrap,
  useCapstone,
  useCapstoneGate,
  useLessonSketch,
  useSessionDay,
  useSketches,
} from "../lib/queries.ts";
import { ownOpenSession } from "../lib/tab-session.ts";
import { currentSessionId } from "../session/store.ts";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { Card, Chip, EmptyState, Page, Skeleton } from "../ui/kit/basics.tsx";
import { SegmentedControl } from "../ui/kit/Controls.tsx";
import { Select } from "../ui/kit/Field.tsx";
import { ErrorState } from "../ui/kit/QueryState.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { FLAVOUR_TITLE, useCapstoneContent } from "./content.ts";
import { useCreateDraft, usePatchDraft, useStartCapstoneSession } from "./queries.ts";
import { GROWN_FROM, planFromSketch } from "./sketch-plan.ts";
import { arrangeStarter, picksSong, reharmStarter, songsOf, versionsOf, versionTag } from "./tracks.ts";
import { starterOf, Workspace } from "./Workspace.tsx";
import { capstoneStarter } from "./x1/cft.ts";
import { bassFirst } from "./x1/phrases.ts";
import { songWritten, useSong } from "./x1/songs.ts";
import { X1Workspace } from "./x1/X1Workspace.tsx";

/** "C0 Intro" → "Intro": the track's default title. */
/** Capstones that open with the learner's own sketch of a lesson's Make when there is one (lesson ID). */
export const CAPSTONE_FROM_SKETCH: Readonly<Record<string, string>> = { C6: "U14.L06" };

export function trackTitleOf(def: Pick<CapstoneDef, "id" | "title">): string {
  return def.title.startsWith(`${def.id} `) ? def.title.slice(def.id.length + 1) : def.title;
}

export function CapstoneScreen({ id }: { id: string }) {
  const content = useCapstoneContent();
  const state = useCapstone(id);
  const def = content.data?.capstones.find((c) => c.id === id);
  usePageTitle(def?.title ?? id);

  if (!isCapstoneId(id))
    return (
      <Page>
        <EmptyState title="No such capstone">
          “{id}” is not a capstone.{" "}
          <Link to="/oak" search={{ view: "course" }} className="text-link underline">
            The course map
          </Link>{" "}
          lists them all.
        </EmptyState>
      </Page>
    );
  if (content.isError || state.isError)
    return (
      <Page>
        <ErrorState
          error={content.error ?? state.error}
          onRetry={() => {
            void content.refetch();
            void state.refetch();
          }}
        />
      </Page>
    );
  if (!content.data || !state.data) return <WorkspaceSkeleton />;
  if (!def)
    return (
      <Page>
        <EmptyState title="This capstone is not in the course yet">
          Its brief has not been written.
        </EmptyState>
      </Page>
    );
  const s = state.data;
  if (s.status === "locked") return <Locked def={def} state={s} />;
  if (def.kind === "transcribe") {
    if (!def.song?.length) return <TranscribeElsewhere def={def} />;
    if (s.status === "open") return <Start def={def} state={s} />;
    return <X1Workspace key={def.id} def={def} state={s} content={content.data} />;
  }
  if (!def.brief) return <TranscribeElsewhere def={def} />;
  if (s.status === "open") return <Start def={def} state={s} />;
  return <Workspace key={def.id} def={def} state={s} content={content.data} />;
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full min-h-0" role="status" aria-busy="true" aria-label="Loading the capstone">
      <div className="w-[300px] shrink-0 border-r border-border bg-surface p-4">
        <Skeleton className="mb-3 h-5 w-16" />
        <Skeleton className="mb-6 h-7 w-44" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-2 h-4 w-5/6" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
      <div className="flex-1 p-4">
        <Skeleton className="mb-3 h-10 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

function SessionPlan({ def, state }: { def: CapstoneDef; state: Pick<CapstoneState, "sessions"> }) {
  const total = def.sessionDefs.length;
  return (
    <ol className={total >= 4 ? "grid gap-x-8 gap-y-2 sm:grid-cols-2" : "flex flex-col gap-2"}>
      {def.sessionDefs.map((sd, i) => (
        <li key={sd.id} className="flex gap-3">
          <span className="w-8 shrink-0 font-mono text-sm text-text-3 tabular-nums">
            {i + 1}/{total}
          </span>
          <span className="min-w-0">
            <span className="font-medium">{sd.title}</span>
            <span className="block text-sm text-text-2">{sd.goal}</span>
            {state.sessions.includes(sd.id) && <span className="sr-only">done</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** What a closed capstone waits for (`capstones.gate`, contracts §2.4): each condition, met or not. */
function GateList({ gate }: { gate: CapstoneGate }) {
  return (
    <ul className="mt-3 flex flex-col gap-1 text-sm" data-testid="capstone-gate">
      {gate.conditions.map((c) => (
        <li key={`${c.kind}:${c.ref}`} className="flex items-start gap-2">
          {c.met ? (
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          ) : (
            <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-text-3" />
          )}
          <span className={c.met ? "text-text-2" : "text-text"}>
            {c.label}
            {c.kind === "family-level" && c.have !== null && c.need !== null && !c.met
              ? ` (level ${c.have} of ${c.need})`
              : ""}
            <span className="sr-only">{c.met ? " (met)" : " (not yet)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Locked({ def, state }: { def: CapstoneDef; state: CapstoneState }) {
  const gate = useCapstoneGate(def.id);
  const g = gate.data ?? null;
  return (
    <Page width="narrow">
      <p className="text-sm text-text-3">Capstone</p>
      <h1 className="text-h1">{def.title}</h1>
      <p className="mt-2 text-text-2">{def.objective}</p>
      <Card className="mt-6 flex items-start gap-3 p-5">
        <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-text-3" />
        <div>
          <p className="font-medium">Not open yet</p>
          <p className="mt-1 text-text-2">
            {g?.message ??
              tidyReason(state.lockedReason) ??
              "It opens when the checkpoint before it is passed."}{" "}
            A capstone never holds back a lesson; it waits here until you are ready.
          </p>
          {g && g.conditions.length > 0 && <GateList gate={g} />}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/oak" search={{ view: "course" }} className={buttonClass("secondary", "sm")}>
              See the course map
            </Link>
            <Link to="/album" className={buttonClass("ghost", "sm")}>
              The album
            </Link>
          </div>
        </div>
      </Card>
      <h2 className="mt-8 mb-3 text-h3">Sessions</h2>
      <SessionPlan def={def} state={state} />
    </Page>
  );
}

function TranscribeElsewhere({ def }: { def: CapstoneDef }) {
  return (
    <Page width="narrow">
      <p className="text-sm text-text-3">Capstone</p>
      <h1 className="text-h1">{def.title}</h1>
      <p className="mt-2 text-text-2">{def.objective}</p>
      <Card className="mt-6 p-5">
        <p className="font-medium">This capstone is a transcription</p>
        <p className="mt-1 text-text-2">
          It is worked phrase by phrase in Transcribe, with a check per phrase.
        </p>
        <Link to="/transcribe" className={buttonClass("primary", "md", "mt-3")}>
          Open Transcribe
        </Link>
      </Card>
    </Page>
  );
}

/** Tools that unlock when this session starts (START rows of contracts §3.2, e.g. `ebass` and `.lpf()` at C1.S1). */
export function startUnlocks(toolbox: readonly ToolEntry[], sessionId: string): ToolEntry[] {
  return toolbox.filter((t) => {
    const at = Array.isArray(t.unlock.at) ? t.unlock.at : [t.unlock.at];
    return t.unlock.when === "start" && at.includes(sessionId as never);
  });
}

function Start({ def, state }: { def: CapstoneDef; state: CapstoneState }) {
  const shared = useContent();
  const boot = useBootstrap();
  const capContent = useCapstoneContent();
  const start = useStartCapstoneSession();
  const create = useCreateDraft();
  const patch = usePatchDraft();
  const shipping = capContent.data?.shipping ?? ["flavour.pop"];
  const preferred = boot.data?.profile.flavour;
  const [flavour, setFlavour] = useState<FlavourId>(
    preferred && shipping.includes(preferred) ? preferred : (shipping[0] ?? "flavour.pop"),
  );
  const first = def.sessionDefs[0];
  const unlocks = first ? startUnlocks(shared.data?.toolbox ?? [], first.id) : [];
  const transcribe = def.kind === "transcribe";
  // Wave 7: JC4 and AC1 work on a song the learner picks (AC1's tunes open separately: `CapstoneGate.tunes`).
  const pickSong = picksSong(def);
  const gate = useCapstoneGate(pickSong ? def.id : null);
  const tunes = gate.data?.tunes ?? null;
  const offered = (transcribe ? (def.song ?? []) : pickSong ? songsOf(def) : []).map((id) => {
    const tune = tunes?.find((t) => t.songId === id) ?? null;
    const written = songWritten(id);
    return {
      id,
      entry: capContent.data?.repertoire.find((r) => r.id === id) ?? null,
      written: written && (tune === null || tune.open),
      reason: !written ? null : tune && !tune.open ? (tune.reason ?? "Not open yet") : null,
    };
  });
  const [songId, setSongId] = useState<SongId | null>(null);
  // Only the chosen song's module (its answer key) is loaded; the others stay on the server.
  const chosenId =
    offered.find((o) => o.id === songId && o.written)?.id ?? offered.find((o) => o.written)?.id ?? null;
  const chosenQuery = useSong(transcribe || pickSong ? chosenId : null);
  const chosenSong = chosenId ? { id: chosenId, song: chosenQuery.data ?? null } : null;
  // CF-A: the single starts from the plan, or from one of the learner's own sketches as its verse.
  const twoStarts = def.id === "CF-A";
  const [startFrom, setStartFrom] = useState<"plan" | "sketch">("plan");
  const sketchList = useSketches();
  const ownSketches = twoStarts
    ? (sketchList.data?.items ?? [])
        .filter((x) => !x.archived && (x.originKind === "free" || x.originKind === "lesson-make"))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    : [];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = ownSketches.find((x) => x.id === pickedId) ?? ownSketches[0] ?? null;
  const pickedDetail = useQuery({
    ...apiQuery("sketches.get", { params: { id: picked?.id ?? "none" } }),
    enabled: twoStarts && startFrom === "sketch" && picked !== null,
  });
  const pickedCode = pickedDetail.data?.versions.at(-1)?.code ?? null;
  const grown = startFrom === "sketch" && pickedCode !== null ? planFromSketch(pickedCode) : null;
  const sketchBlocked = twoStarts && startFrom === "sketch" && (grown === null || !grown.ok);
  // A capstone that grows out of a lesson's Make (C6 from the Mode Lab vamp of U14.L06) opens with the learner's
  // own sketch of it when there is one, with Oak's starter beside it (as a lesson Make with `fromSketch`, d15).
  const vampFrom = CAPSTONE_FROM_SKETCH[def.id] ?? null;
  const vampQ = useLessonSketch(vampFrom);
  const ownVamp = vampFrom ? ownSketchOf(vampQ.data) : null;
  const ownVampKey =
    ownVamp && vampQ.data?.sketch
      ? (vampQ.data.sketch.versions.reduce((a, b) => (b.version > a.version ? b : a)).key ?? null)
      : null;
  const [vampStart, setVampStart] = useState<"own" | "oak">("own");
  const fromOwnVamp = ownVamp !== null && vampStart === "own";
  // A tab holds one open session (d21: each tab its own; another tab's never blocks this one). Started from the
  // map while this tab's session is open, the server would hand that one back. Say so, and send the learner to
  // finish it, instead of a button that does nothing.
  const day = useSessionDay();
  const open = ownOpenSession(day.data);
  const blocked = !currentSessionId() && open !== null && open.mapItemId !== first?.id;
  const onStart = async () => {
    if (!first || !boot.data || blocked || sketchBlocked) return;
    if ((transcribe || pickSong) && !chosenSong?.song) return;
    const picked = pickSong && chosenSong?.song ? chosenSong.song : null;
    try {
      // The draft first, so the flavour chosen here stays with it (the server stores it at completion) and the
      // workspace opens on it; then the session, which flips the capstone to "in progress" and grants its START
      // unlocks. Inside Today's session the runner has already started this map item.
      const draft = await create.mutateAsync({
        body: {
          title: def.title,
          originKind: "capstone",
          originId: def.id,
          sessionId: currentSessionId(),
          code:
            transcribe && chosenSong?.song
              ? capstoneStarter(def, chosenSong.song)
              : picked
                ? def.id === "JC4"
                  ? reharmStarter(picked)
                  : arrangeStarter(picked)
                : grown?.ok
                  ? grown.code
                  : fromOwnVamp && ownVamp
                    ? ownVamp.code
                    : starterOf(def),
          bpm: (transcribe || picked) && chosenSong?.song ? chosenSong.song.bpm : null,
          meter: transcribe && chosenSong?.song ? chosenSong.song.meter : def.meter,
          key:
            (transcribe || picked) && chosenSong?.song
              ? chosenSong.song.key
              : grown?.ok
                ? (pickedDetail.data?.versions.at(-1)?.key ?? null)
                : fromOwnVamp
                  ? (ownVampKey ?? def.key ?? null)
                  : (def.key ?? null),
          analysis: null,
          // The sleeve says where the single came from ("Grown from …", content/specs/CF.md Liner notes).
          note:
            grown?.ok && picked
              ? `${GROWN_FROM} “${picked.title}”`
              : fromOwnVamp && ownVamp
                ? `${GROWN_FROM} “${ownVamp.title}”`
                : null,
          tutorAssisted: false,
          band: null,
          flags: { lockedTools: [], previewTools: [] },
          ranOk: false,
        },
      });
      await patch.mutateAsync({
        params: { id: draft.sketch.id },
        body: {
          tags:
            transcribe && chosenSong
              ? [chosenSong.id]
              : [
                  flavour,
                  ...(picked && chosenSong ? [chosenSong.id] : []),
                  ...(versionsOf(def).length === 2 ? [versionTag("a")] : []),
                ],
        },
      });
      if (!currentSessionId())
        await start.mutateAsync({
          body: {
            kind: "capstone",
            mapItemId: first.id as never,
            targetMinutes: boot.data.profile.targetMinutes,
          },
        });
    } catch (e) {
      toast.error("The session didn't start", e instanceof Error ? e.message : undefined);
    }
  };
  return (
    <Page width="narrow">
      <p className="text-sm text-text-3">Capstone</p>
      <h1 className="text-h1">{def.title}</h1>
      <p className="mt-2 max-w-[60ch] text-lg text-text-2">{def.brief?.prompt ?? def.objective}</p>
      <Card className="mt-6 flex flex-col gap-5 p-5">
        <div>
          <h2 className="mb-2 text-h3">The plan</h2>
          <SessionPlan def={def} state={state} />
        </div>
        {pickSong && (
          <div data-testid="song-pick">
            <h2 className="mb-1 text-h3">The song</h2>
            <p className="mb-2 text-sm text-text-2">
              {def.id === "JC4"
                ? "Pick one. Its melody and its original changes are given; the melody stays exactly as written, the chords become yours."
                : "Pick one. Its melody is given; you arrange it twice, in two genres."}
            </p>
            {offered.some((o) => o.written) ? (
              <SegmentedControl<string>
                label="The song"
                value={chosenSong?.id ?? ""}
                options={offered.map((o) => ({
                  value: o.id,
                  label: o.entry?.title ?? o.id,
                  disabled: !o.written,
                }))}
                onChange={(v) => setSongId(v as SongId)}
              />
            ) : (
              <p className="text-sm text-text-2" data-testid="no-answer-keys">
                Oak's renditions of {offered.map((o) => o.entry?.title ?? o.id).join(" and ")} are still being
                written and checked against their sources. This capstone starts once one is ready; nothing
                else waits on it.
              </p>
            )}
            {offered
              .filter((o) => !o.written)
              .map((o) => (
                <p key={o.id} className="mt-1 text-sm text-text-3" data-testid="song-closed">
                  {o.entry?.title ?? o.id}: {o.reason ?? "not ready yet"}.
                </p>
              ))}
          </div>
        )}
        {transcribe ? (
          <div>
            <h2 className="mb-1 text-h3">The song</h2>
            <p className="mb-2 text-sm text-text-2">
              {bassFirst(def.sessionDefs.flatMap((sd) => sd.checks ?? []))
                ? "Pick one; you transcribe it by ear, bass first, then the changes, then the melody. Its meter, key, tempo, pickup, form and feel are given."
                : "Pick one; you transcribe it by ear. Its meter, key, tonic, pickup and the rhythm of the first phrase are given."}
            </p>
            {offered.some((o) => o.written) ? (
              <SegmentedControl<string>
                label="The song"
                value={chosenSong?.id ?? ""}
                options={offered.map((o) => ({
                  value: o.id,
                  label: o.entry?.title ?? o.id,
                  disabled: !o.written,
                }))}
                onChange={(v) => setSongId(v as SongId)}
              />
            ) : (
              <p className="text-sm text-text-2" data-testid="no-answer-keys">
                Oak's renditions of these songs are still being written and checked against their sources.
                This capstone starts once one is ready; nothing else waits on it.
              </p>
            )}
            {offered.some((o) => !o.written) && offered.some((o) => o.written) && (
              <p className="mt-1 text-sm text-text-3">
                {offered
                  .filter((o) => !o.written)
                  .map((o) => o.entry?.title ?? o.id)
                  .join(" and ")}{" "}
                is not ready yet.
              </p>
            )}
          </div>
        ) : (
          <div>
            <h2 className="mb-1 text-h3">Style</h2>
            <p className="mb-2 text-sm text-text-2">
              The sound world of the brief and of the Band you can play along with. It never changes what is
              checked.
            </p>
            <SegmentedControl<FlavourId>
              label="Style"
              value={flavour}
              options={shipping.map((f) => ({ value: f, label: FLAVOUR_TITLE[f] }))}
              onChange={setFlavour}
            />
          </div>
        )}
        {twoStarts && (
          <div data-testid="single-start">
            <h2 className="mb-1 text-h3">Start from</h2>
            <p className="mb-2 text-sm text-text-2">
              The plan is a verse, a chorus and a bridge laid out at full length. Or take one of your own
              sketches as the verse: its parts, key and tempo stay as you wrote them.
            </p>
            <SegmentedControl<"plan" | "sketch">
              label="Start from"
              value={startFrom}
              options={[
                { value: "plan", label: "The plan" },
                { value: "sketch", label: "One of your sketches", disabled: ownSketches.length === 0 },
              ]}
              onChange={setStartFrom}
            />
            {ownSketches.length === 0 && !sketchList.isPending && (
              <p className="mt-1 text-sm text-text-3">Your sketchbook is empty, so the plan it is.</p>
            )}
            {startFrom === "sketch" && picked && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="single-sketch" className="text-sm font-medium">
                    Sketch
                  </label>
                  <Select<string>
                    id="single-sketch"
                    value={picked.id}
                    options={ownSketches.map((x) => ({
                      value: x.id,
                      label: `${x.title} · ${formatDate(x.updatedAt, true)}`,
                    }))}
                    onChange={setPickedId}
                  />
                  <HearSketch code={pickedCode} />
                </div>
                {pickedDetail.isPending ? (
                  <p className="text-sm text-text-3">Reading the sketch…</p>
                ) : grown && !grown.ok ? (
                  <p className="text-sm text-text-2" role="status" data-testid="sketch-problem">
                    {grown.problem.replaceAll("`", "")}
                  </p>
                ) : grown?.ok ? (
                  <p className="text-sm text-text-2" role="status" data-testid="sketch-plan">
                    It becomes the verse of a {grown.bars}-bar plan: verse, chorus, verse, chorus, bridge,
                    chorus. The chorus and the bridge start as the same notes, for you to rewrite.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
        {ownVamp && (
          <div data-testid="vamp-start">
            <h2 className="mb-1 text-h3">Start from</h2>
            <p className="mb-2 text-sm text-text-2">
              Your vamp from the Mode Lab, “{ownVamp.title}”, can be the first bars of this one: its mode, key
              and groove stay as you wrote them. Oak's starter is a two-bar loop on G.
            </p>
            <SegmentedControl<"own" | "oak">
              label="Start from"
              value={vampStart}
              options={[
                { value: "own", label: "Your Mode Lab vamp" },
                { value: "oak", label: "Oak's starter" },
              ]}
              onChange={setVampStart}
            />
            {vampStart === "own" && (
              <div className="mt-2">
                <HearSketch code={ownVamp.code} />
              </div>
            )}
          </div>
        )}
        {unlocks.length > 0 && (
          <div className="flex items-start gap-3 rounded-card bg-lane-in p-3">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
            <p className="text-sm">
              Starting this session {unlocks.every((t) => t.kind === "feature") ? "opens" : "unlocks"}{" "}
              {unlocks.map((t, i) => (
                <span key={t.id}>
                  {i > 0 && (i === unlocks.length - 1 ? " and " : ", ")}
                  {t.kind === "feature" ? (
                    t.id === "tb.feature.album" ? (
                      "your album"
                    ) : (
                      t.code
                    )
                  ) : (
                    <code className="rounded bg-surface px-1 font-mono">{t.catalog.signature}</code>
                  )}
                </span>
              ))}
              .
            </p>
          </div>
        )}
        {blocked ? (
          <div className="flex flex-col items-start gap-3" data-testid="capstone-session-open">
            <p className="max-w-[60ch] text-sm text-text-2">
              Today already has a session open. Finish it from Today first; {def.title} starts here after,
              today or tomorrow.
            </p>
            <Link to="/" className={buttonClass("primary", "lg")}>
              Back to Today
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              loading={start.isPending || create.isPending || patch.isPending}
              disabled={((transcribe || pickSong) && !chosenSong?.song) || sketchBlocked}
              onClick={() => void onStart()}
              autoFocus
            >
              Start session 1 of {def.sessionDefs.length}
            </Button>
            <span className="text-sm text-text-3">
              About {def.sessionDefs.length > 1 ? "15 minutes a session" : "15 minutes"}.
            </span>
          </div>
        )}
      </Card>
      <p className="mt-4 flex items-center gap-2 text-sm text-text-3">
        {def.id === "C0" && <Chip tone="accent">Side A · track 1</Chip>}
        {def.id === "C0"
          ? "This is the track that opens your album."
          : transcribe
            ? "When you release it, your transcription joins your album with a cover grown from the music."
            : sideOfCapstone(def.id) === "B"
              ? versionsOf(def).length === 2
                ? "When you release it, both versions join Side B of your album as one track, with a cover grown from the music."
                : "When you release it, it joins Side B of your album with a cover grown from the music."
              : "When you release it, it joins your album with a cover grown from the music."}
      </p>
    </Page>
  );
}

/** Two bars of a sketch, to choose it by ear. */
function HearSketch({ code }: { code: string | null }) {
  const player = useRef<PatternPlayer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    player.current?.stop();
    setPlaying(false);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      player.current?.dispose();
    },
    [],
  );
  // Another sketch chosen: the one that was playing stops.
  useEffect(() => stop, [code]);
  const hear = async () => {
    if (playing) return stop();
    if (!code) return;
    setBusy(true);
    try {
      const oak = await getOak();
      await oak.unlock();
      player.current ??= oak.createPatternPlayer();
      const out = await player.current.load(code, { bars: 4, cps: 0 });
      if (!out.ok) {
        toast.info("This sketch doesn't run as it is", "Open it in the Studio to fix it, or pick another.");
        return;
      }
      await player.current.play();
      setPlaying(true);
      const cps = out.cps && out.cps > 0 ? out.cps : oak.transport.cps() || 0.5;
      timer.current = setTimeout(stop, Math.min(20_000, (4 / cps) * 1000));
    } catch (e) {
      toast.error("Sound did not start", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      size="sm"
      loading={busy}
      disabled={!code}
      aria-pressed={playing}
      icon={playing ? <Square aria-hidden className="size-3.5" /> : <Play aria-hidden className="size-3.5" />}
      onClick={() => void hear()}
      data-testid="hear-sketch"
    >
      {playing ? "Stop" : "Hear four bars"}
    </Button>
  );
}
