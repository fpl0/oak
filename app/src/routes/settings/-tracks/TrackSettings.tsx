// Settings › Learning, Wave 7 (docs/design/wave7.md §4.2, §5.2): the advanced tracks as places — each track's card
// with where the learner stands and the way into its next session, the learner's focus between the core and the
// tracks, and the eight track lenses with their state. Shown once a track is open (J and R with the U13
// checkpoint, Arrangement & Sound's own lessons with the U09 checkpoint); before that the section says when they
// open. Nothing here makes a track look required.
import { TRACK_TITLES, type TrackFocusId, type TrackState } from "@oak/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useContent } from "../../../lib/content.ts";
import { useLenses } from "../../../lib/lenses.ts";
import { apiQuery, useCourseProgress, useSetTrackFocus } from "../../../lib/queries.ts";
import { buttonClass } from "../../../ui/kit/Button.tsx";
import { Kbd } from "../../../ui/kit/basics.tsx";
import { Field, Section, Select, Switch } from "../../../ui/kit/Field.tsx";
import { toast } from "../../../ui/kit/Toast.tsx";
import { TrackCard } from "../../../ui/kit/TrackCard.tsx";
import { shellTracks, trackSessionTarget } from "../../../ui/shell/course-state.ts";
import { trackLensRows } from "../../../ui/shell/track-lenses.ts";

const FOCUS_WORDS: Record<TrackFocusId, string> = {
  core: "The core (default)",
  J: TRACK_TITLES.J,
  R: TRACK_TITLES.R,
  A: TRACK_TITLES.A,
};

function NextLink({ track }: { track: Parameters<typeof trackSessionTarget>[0] & { title: string } }) {
  const to = trackSessionTarget(track);
  const cls = buttonClass("secondary", "sm");
  if (to?.kind === "lesson")
    return (
      <Link to="/learn/$lessonId" params={{ lessonId: to.lessonId }} className={cls}>
        Start {to.lessonId}
      </Link>
    );
  if (to?.kind === "checkpoint")
    return (
      <Link to="/checkpoint/$unitId" params={{ unitId: to.unitId }} className={cls}>
        Start {to.unitId}
      </Link>
    );
  if (to?.kind === "capstone")
    return (
      <Link to="/capstone/$id" params={{ id: to.capstoneId }} className={cls}>
        Open {to.capstoneId}
      </Link>
    );
  return null;
}

export function TrackSettings() {
  const content = useContent();
  const progress = useCourseProgress();
  const syllabus = content.data?.syllabus ?? null;
  const shell = shellTracks(progress.data, syllabus);
  const lenses = useLenses();
  const states = new Map((progress.data?.tracks ?? []).map((t) => [t.trackId, t] as const));
  const choosable = shell.filter(
    (t) => t.state !== "locked" && t.card !== "complete" && (t.trackId !== "A" || t.pastSideLessons),
  );
  const focus = useQuery({ ...apiQuery("tracks.focus"), enabled: choosable.length > 0 });
  const setFocus = useSetTrackFocus();
  const rows = trackLensRows(lenses.track.prefs, lenses.track.available, syllabus);
  if (!progress.data) return null;
  return (
    <>
      <Section
        title="Advanced tracks"
        description="Branches off the core: jazz harmony, advanced rhythm, arrangement and sound. The core stays your path; a track is never required."
      >
        {choosable.length > 0 && (
          <Field
            label="Focus"
            help={
              focus.isError
                ? "Choosing a focus is not available on this server yet."
                : "Which path Today plans first. A due core checkpoint still comes first."
            }
          >
            {({ id, describedBy }) => (
              <Select<TrackFocusId>
                id={id}
                describedBy={describedBy}
                disabled={!focus.isSuccess || setFocus.isPending}
                value={focus.data?.focus ?? "core"}
                options={[
                  { value: "core", label: FOCUS_WORDS.core },
                  ...choosable.map((t) => ({ value: t.trackId, label: FOCUS_WORDS[t.trackId] })),
                ]}
                onChange={(f) =>
                  setFocus.mutate(
                    { body: { focus: f } },
                    {
                      onError: (e) =>
                        toast.error("The focus was not changed", e instanceof Error ? e.message : String(e)),
                    },
                  )
                }
              />
            )}
          </Field>
        )}
        <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" data-testid="settings-tracks">
          {shell.map((t) => {
            const state: TrackState | undefined = states.get(t.trackId);
            return state ? (
              <TrackCard
                key={t.trackId}
                layout="row"
                headingLevel={3}
                title={t.title}
                track={{ ...state, focus: focus.data?.focus === t.trackId }}
                action={<NextLink track={t} />}
                more={
                  <Link to="/oak" search={{ view: "course" }} className={buttonClass("link", "sm")}>
                    On the Oak
                  </Link>
                }
              />
            ) : (
              <p key={t.trackId} className="text-sm text-text-2">
                <span className="font-medium text-text">{t.title}</span> · {t.note}
              </p>
            );
          })}
        </div>
      </Section>
      <Section
        title="Track lenses"
        description="Labels for jazz, rhythm and sound over the roll, the chord band and the spectrum. Each opens with its lesson; inside a lesson step the lesson decides."
      >
        {rows.map((r) => (
          <Field
            key={r.id}
            label={r.label}
            help={
              <>
                {r.what[0]?.toUpperCase()}
                {r.what.slice(1)}.{r.available ? "" : ` ${r.state.replace(/\.$/, "")}.`}
                {r.keys && (
                  <>
                    {" "}
                    <Kbd>{r.keys.replace("Shift+", "⇧")}</Kbd> in the Workbench.
                  </>
                )}
              </>
            }
          >
            {({ id, describedBy }) => (
              <Switch
                id={id}
                describedBy={describedBy}
                checked={r.on}
                disabled={!r.available || !lenses.ready}
                onChange={(on) => lenses.track.set(r.id, on)}
              />
            )}
          </Field>
        ))}
      </Section>
    </>
  );
}
