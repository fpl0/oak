// AC1 "One Tune, Two Genres" (Wave 7; content-kit `capstone.versions`; docs/design/wave7.md §11): one tune arranged
// twice, each version its own draft and its own editor. The switch above the Workbench moves between them (version
// two opens with its session); the brief's rules run on each version with the other one beside it
// (`GradeContext.otherVersion`, for `two-versions-differ`). The compare card renders both offline and plays them
// A/B at matched loudness: the louder is turned down to the quieter's level, and a switch keeps the place in the
// tune (the bar), not the second, because the tempi differ (Oak 2.0 W4: the compare is the shared `MatchedCompare`). The album holds both: the first release waits until
// both versions meet the brief, and the second is added to the same track.
import type { CapstoneDef, CapstoneState, UnlockableId } from "@oak/api";
import type { KeySpec } from "@oak/content-kit";
import type { BandSetup } from "@oak/strudel";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { apiQuery, useCapstoneSessions, useCourseProgress, useUnlocks } from "../lib/queries.ts";
import { MatchedCompare } from "../listen/MatchedCompare.tsx";
import { bandReached } from "../studio/model.ts";
import { checklistOf, readiness } from "./checklist.ts";
import type { CapstoneContent } from "./content.ts";
import { checkPiece } from "./engine.ts";
import { exportBandOf } from "./export.ts";
import { latestVersion, useDraft } from "./queries.ts";
import { currentSession, sessionViews, starterOf } from "./sessions.ts";
import { useSongMelody } from "./song-melody.ts";
import {
  arrangeStarter,
  songOfDraft,
  type VersionDraft,
  versionDrafts,
  versionOfSession,
  versionOpen,
  versionsOf,
} from "./tracks.ts";
import { WorkbenchServicesLoader } from "./WorkbenchServicesLoader.tsx";
import { Loaded, type VersionCtx } from "./Workspace.tsx";
import { useSong } from "./x1/songs.ts";

type Vid = "a" | "b";
/** What a version plays beside its code: its Band (as its draft saved it) and its key. */
interface Played {
  band: BandSetup | null;
  key: KeySpec | null;
}
const other = (v: Vid): Vid => (v === "a" ? "b" : "a");

export function VersionsWorkspace({
  def,
  state,
  content,
}: {
  def: CapstoneDef;
  state: CapstoneState;
  content: CapstoneContent;
}) {
  const versions = versionsOf(def);
  const sessionsQ = useCapstoneSessions(def.id);
  const list = useQuery(apiQuery("sketches.list", { query: { origin: "capstone" } }));
  const listed = versionDrafts(
    sessionsQ.data,
    list.data?.items ?? [],
    def.id,
    state.sketchId ?? null,
    versions,
  );
  // A version's first save makes its sketch; its tag lands a moment after the list was refetched, so the editor
  // says which sketch it saved to.
  const [made, setMade] = useState<Partial<Record<Vid, string>>>({});
  // A sketch made this sitting is the version's newest; otherwise where the server or the tags put it.
  const where: Record<Vid, VersionDraft | null> = {
    a: made.a ? { sketchId: made.a, sketchVersion: null } : listed.a,
    b: made.b ? { sketchId: made.b, sketchVersion: null } : listed.b,
  };
  const ids = { a: where.a?.sketchId ?? null, b: where.b?.sketchId ?? null };
  const draftA = useDraft(ids.a);
  const draftB = useDraft(ids.b);
  const views = sessionViews(def, state, sessionsQ.data ?? null);
  const current = currentSession(views, sessionsQ.data ?? null);
  const allDone = views.every((v) => v.status === "done") || state.sessionsDone >= def.sessionDefs.length;
  const currentIndex = allDone ? def.sessionDefs.length - 1 : (current?.index ?? 0);
  const indexOf = (sid: string) => def.sessionDefs.findIndex((sd) => sd.id === sid);
  const [picked, setPicked] = useState<Vid | null>(null);
  const active: Vid = picked ?? versionOfSession(versions, allDone ? null : (current?.id ?? null), null);
  const open = (v: Vid) => versionOpen(versions, v, indexOf, currentIndex);
  const labelOf = (v: Vid) =>
    versions.find((x) => x.id === v)?.label ?? (v === "a" ? "Version one" : "Version two");

  const tagsA = draftA.data?.tags ?? [];
  // Version one's draft carries the song chosen at the start; a new draft is tagged a moment after it is made.
  const tags = [...new Set([...(active === "b" ? (draftB.data?.tags ?? []) : []), ...tagsA])];
  const songId = songOfDraft(def, tags);
  const song = useSong(songId).data ?? null;
  const melody = useSongMelody(song);
  // A version's own sketch version (a seeded AC1 keeps both versions in one sketch), else the sketch's newest.
  const versionIn = (v: Vid, d: typeof draftA.data) => {
    const at = where[v]?.sketchVersion ?? null;
    const own = at === null ? undefined : d?.versions.find((x) => x.version === at);
    return own ?? latestVersion(d);
  };
  const latestA = versionIn("a", draftA.data);
  const latestB = versionIn("b", draftB.data);
  // Two versions in one sketch: version two's first save starts its own sketch, so the two histories stay apart.
  const shared = ids.a !== null && ids.a === ids.b;
  const starterFor = (v: Vid) =>
    versions.find((x) => x.id === v)?.starter ??
    (song
      ? arrangeStarter(song)
      : starterOf(def, Math.max(0, indexOf(versions.find((x) => x.id === v)?.startsIn ?? ""))));
  // The other version's code: its newest saved draft (version two opened for the first time starts from its starter).
  const codeOf = (v: Vid) => (v === "a" ? latestA?.code : latestB?.code) ?? null;
  // Each version's Band as its draft saved it (the two genres play two Bands): the A/B compare renders it with the
  // version, as the export does, so the loudness match is of what the learner hears.
  const progress = useCourseProgress();
  const playedWith = (v: Vid): Played => {
    const d = v === "a" ? latestA : latestB;
    const key = d?.key ?? null;
    return {
      key,
      band: d
        ? exportBandOf(d.band, key, {
            bands: content.bands,
            capstone: def,
            reached: bandReached(progress.data),
          })
        : null,
    };
  };

  // This sitting's readiness per version (each editor reports its own), and a check of the other one's draft.
  const [ready, setReady] = useState<Record<Vid, { code: string; ready: boolean } | null>>({
    a: null,
    b: null,
  });
  const unlocksQ = useUnlocks();
  const unlockKey = (unlocksQ.data?.items ?? [])
    .map((u) => u.itemId)
    .sort()
    .join(",");
  const otherId = other(active);
  const otherCode = codeOf(otherId);
  const [otherCheck, setOtherCheck] = useState<{ code: string; ready: boolean } | null>(null);
  const activeCode = ready[active]?.code ?? codeOf(active);
  const releaseNear = allDone || currentIndex >= def.sessionDefs.length - 1;
  useEffect(() => {
    if (!releaseNear || !otherCode || unlocksQ.isPending) return;
    let live = true;
    const t = setTimeout(() => {
      const unlocked = new Set(unlockKey ? (unlockKey.split(",") as UnlockableId[]) : []);
      checkPiece(def, otherCode, unlocked, undefined, {
        songMelody: melody.data ?? null,
        otherVersion: activeCode ? { id: active, code: activeCode } : null,
      }).then(
        (o) => {
          if (live)
            setOtherCheck({
              code: otherCode,
              ready: readiness(checklistOf(def.brief?.rubric ?? [], o.result)).ready,
            });
        },
        () => {},
      );
    }, 1200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [releaseNear, otherCode, activeCode, unlockKey, melody.data, active]);
  const reported = ready[otherId];
  const otherReady =
    reported && reported.code === otherCode
      ? reported.ready
      : otherCheck && otherCheck.code === otherCode
        ? otherCheck.ready
        : null;

  const pending =
    list.isPending ||
    sessionsQ.isPending ||
    (ids.a !== null && !draftA.data) ||
    (ids.b !== null && !draftB.data);
  if (pending)
    return (
      <div className="flex h-full min-h-0" data-testid="capstone-workspace">
        <div className="flex-1 p-4 text-sm text-text-3">Opening your versions…</div>
      </div>
    );

  const ctx: VersionCtx = {
    id: active,
    label: labelOf(active),
    versions,
    starter: starterFor(active),
    other: { id: otherId, label: labelOf(otherId), code: otherCode },
    otherReady,
    // Only a sketch this version did not have yet is "made": the version's own draft saving again (a seeded AC1
    // keeps both versions in one sketch) must not lose which sketch version is this version's.
    onSketch: (id) =>
      setMade((m) => (m[active] === id || listed[active]?.sketchId === id ? m : { ...m, [active]: id })),
    onReadiness: (r) =>
      setReady((s) =>
        s[active]?.code === r.code && s[active]?.ready === r.ready
          ? s
          : { ...s, [active]: { code: r.code, ready: r.ready } },
      ),
    header: (
      <VersionsBar
        active={active}
        labels={{ a: labelOf("a"), b: labelOf("b") }}
        open={{ a: open("a"), b: open("b") }}
        opensIn={{
          a: `Session ${indexOf(versions[0]?.startsIn ?? "") + 1}`,
          b: `Session ${indexOf(versions[1]?.startsIn ?? "") + 1}`,
        }}
        onSwitch={setPicked}
        codes={{ a: codeOf("a"), b: codeOf("b") }}
        played={{ a: playedWith("a"), b: playedWith("b") }}
        status={{
          a: (active === "a" ? ready.a?.ready : otherReady) ?? null,
          b: (active === "b" ? ready.b?.ready : otherReady) ?? null,
        }}
      />
    ),
  };
  return (
    <div className="flex h-full min-h-0" data-testid="capstone-workspace" data-version={active}>
      <WorkbenchServicesLoader label="Loading the workbench">
        <Loaded
          key={active}
          def={def}
          state={state}
          content={content}
          sketchId={active === "a" ? ids.a : shared ? null : ids.b}
          latest={active === "a" ? latestA : latestB}
          tags={tags}
          grown={null}
          version={ctx}
        />
      </WorkbenchServicesLoader>
    </div>
  );
}

function VersionsBar({
  active,
  labels,
  open,
  opensIn,
  onSwitch,
  codes,
  played,
  status,
}: {
  active: Vid;
  labels: Record<Vid, string>;
  open: Record<Vid, boolean>;
  opensIn: Record<Vid, string>;
  onSwitch(v: Vid): void;
  codes: Record<Vid, string | null>;
  played: Record<Vid, Played>;
  status: Record<Vid, boolean | null>;
}) {
  const both = codes.a !== null && codes.b !== null;
  return (
    <section
      aria-label="The two versions"
      data-testid="versions-bar"
      className="flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2.5 text-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Version"
          className="inline-flex rounded-control border border-border p-0.5"
        >
          {(["a", "b"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={active === v}
              disabled={!open[v]}
              title={open[v] ? undefined : `Opens in ${opensIn[v].toLowerCase()}`}
              data-testid={`version-tab-${v}`}
              onClick={() => onSwitch(v)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  const next = other(v);
                  if (open[next]) {
                    e.preventDefault();
                    onSwitch(next);
                  }
                }
              }}
              className={clsx(
                "inline-flex h-8 items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-3 font-medium",
                active === v ? "bg-accent text-on-accent" : "text-text-2 hover:text-text",
                !open[v] && "cursor-not-allowed opacity-60",
              )}
            >
              {!open[v] && <Lock aria-hidden className="size-3.5" />}
              {labels[v]}
              {status[v] !== null && (
                <span className="sr-only">{status[v] ? " (meets the brief)" : " (not yet)"}</span>
              )}
            </button>
          ))}
        </div>
        <p className="text-text-2" data-testid="versions-status">
          {(["a", "b"] as const)
            .map((v) =>
              codes[v] === null
                ? `${labels[v]}: ${open[v] ? "not started" : `opens in ${opensIn[v].toLowerCase()}`}`
                : `${labels[v]}: ${status[v] === null ? "saved" : status[v] ? "meets the brief" : "not yet"}`,
            )
            .join(" · ")}
        </p>
      </div>
      {both && (
        <MatchedCompare
          testId="versions-compare"
          sides={(["a", "b"] as const).map((v) => ({
            id: v,
            label: labels[v],
            code: codes[v] as string,
            band: played[v].band,
            key: played[v].key,
          }))}
        />
      )}
    </section>
  );
}
