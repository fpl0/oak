// `onb.prefs` (ux §8): the style of the backing band (Pop or Jazz-soul, each with an audible preview), the
// daily length (15 / 20 / 25 minutes) and the weekly goal (3–7 days, default 5). Saved to the profile.
import type { Profile } from "@oak/api";
import type { PatternPlayer } from "@oak/strudel";
import { clsx } from "clsx";
import { ArrowRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getOak } from "../../lib/oak.ts";
import { useProfileUpdate } from "../../lib/queries.ts";
import { SONG_STYLES } from "../../song/surfaces-model.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Callout, SegmentedControl, type SegmentOption, Stepper } from "../../ui/kit/Controls.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { PartActions, type PartBack } from "../../voice/parts/common.tsx";
import type { PrefFlavour } from "../prefs.ts";
import { PREVIEW_BPM, previewCode, withInstalledBanks } from "../prefs.ts";

// The two styles a first-day learner can hear apart, named and described as Settings and the song style cards do
// (shared decision: one setting, called "Style", with one set of names and blurbs).
const FLAVOURS: readonly { id: PrefFlavour; title: string; blurb: string }[] = (
  ["flavour.pop", "flavour.jazz-soul"] as const
).map((id) => {
  const s = SONG_STYLES.find((x) => x.id === id);
  return { id, title: s?.name ?? id, blurb: s?.blurb ?? "" };
});
const MINUTES: readonly SegmentOption<"15" | "20" | "25">[] = [
  { value: "15", label: "15 min" },
  { value: "20", label: "20 min" },
  { value: "25", label: "25 min" },
];
export function PrefsScreen({
  profile,
  onDone,
  back,
}: {
  profile: Profile;
  onDone(): void;
  back?: PartBack | null;
}) {
  const [flavour, setFlavour] = useState<PrefFlavour>(
    profile.flavour === "flavour.jazz-soul" ? "flavour.jazz-soul" : "flavour.pop",
  );
  const [minutes, setMinutes] = useState<"15" | "20" | "25">(
    String(profile.targetMinutes) as "15" | "20" | "25",
  );
  const [weekly, setWeekly] = useState(profile.weeklyGoal);
  const [playing, setPlaying] = useState<PrefFlavour | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = useRef<PatternPlayer | null>(null);
  const save = useProfileUpdate();

  useEffect(
    () => () => {
      player.current?.dispose();
      player.current = null;
    },
    [],
  );

  const preview = async (f: PrefFlavour) => {
    setError(null);
    if (playing === f) {
      player.current?.stop();
      setPlaying(null);
      return;
    }
    try {
      const oak = await getOak();
      await oak.unlock();
      const authored = previewCode(f);
      if (!authored) return;
      const code = withInstalledBanks(authored, oak.sounds());
      player.current?.stop();
      player.current ??= oak.createPatternPlayer();
      await oak.preload(oak.soundsIn(code)).catch(() => undefined);
      const out = await player.current.load(code, { bars: 4, cps: PREVIEW_BPM / 60 / 4 });
      if (!out.ok) throw new Error("the preview did not load");
      await player.current.play();
      setPlaying(f);
    } catch (e) {
      setPlaying(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const finish = async () => {
    player.current?.stop();
    setPlaying(null);
    try {
      await save.mutateAsync({
        body: { flavour, targetMinutes: Number(minutes) as Profile["targetMinutes"], weeklyGoal: weekly },
      });
      onDone();
    } catch (e) {
      toast.error("Your choices weren't saved", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <section className="flex flex-col gap-6" data-testid="screen-prefs" aria-labelledby="prefs-title">
      <header className="flex flex-col gap-1.5">
        <h1 id="prefs-title" className="text-h1 outline-none" tabIndex={-1}>
          Your sound and your week
        </h1>
        <p className="max-w-[60ch] font-medium text-text" data-testid="step-instruction">
          Pick a style and how much time you have; the defaults are fine.
        </p>
        <p className="max-w-[60ch] text-text-2">
          Most lessons put your part inside a small backing band. Pick the style you'd rather hear; it changes
          the sounds, never what you learn. You can change all of this in Settings.
        </p>
      </header>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Style</legend>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Style">
          {FLAVOURS.map((f) => {
            const on = flavour === f.id;
            return (
              <div
                key={f.id}
                className={clsx(
                  "flex items-start justify-between gap-3 rounded-card border p-4",
                  on ? "border-accent bg-lane-in" : "border-border bg-surface",
                )}
              >
                {/* biome-ignore lint/a11y/useSemanticElements: a card-sized radio with its own preview button beside it. */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setFlavour(f.id)}
                  data-testid={`flavour-${f.title.toLowerCase()}`}
                  className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-control text-left"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      aria-hidden
                      className={clsx(
                        "inline-block size-3.5 rounded-full border-2",
                        on ? "border-accent bg-accent" : "border-text-3",
                      )}
                    />
                    {f.title}
                  </span>
                  <span className="text-sm text-text-2">{f.blurb}</span>
                </button>
                <Button
                  size="sm"
                  onClick={() => void preview(f.id)}
                  icon={
                    playing === f.id ? (
                      <Pause aria-hidden className="size-4" />
                    ) : (
                      <Play aria-hidden className="size-4" />
                    )
                  }
                  aria-label={`${playing === f.id ? "Stop" : "Hear"} the ${f.title} style`}
                  data-testid={`preview-${f.title.toLowerCase()}`}
                >
                  {playing === f.id ? "Stop" : "Hear it"}
                </Button>
              </div>
            );
          })}
        </div>
        {error && (
          <Callout tone="issue" title="The preview didn't play">
            {error}
          </Callout>
        )}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="font-medium" id="minutes-label">
            A day's session
          </span>
          <div>
            <SegmentedControl<"15" | "20" | "25">
              label="A day's session"
              value={minutes}
              options={MINUTES}
              onChange={setMinutes}
            />
          </div>
          <p className="text-sm text-text-3">
            Warm-up, one new idea, a sketch, done. Stopping there is good practice.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="weekly-goal" className="font-medium">
            Days a week
          </label>
          <Stepper
            id="weekly-goal"
            label="Days a week"
            value={weekly}
            min={3}
            max={7}
            onChange={setWeekly}
            format={(v) => `${v} days`}
          />
          <p className="text-sm text-text-3">Your week counts, not every single day. Five is a good start.</p>
        </div>
      </div>

      <PartActions
        context="onboarding"
        back={back}
        resultKey={null}
        onRetry={null}
        onContinue={null}
        testId="prefs-actions"
        action={
          <Button
            variant="primary"
            onClick={() => void finish()}
            loading={save.isPending}
            icon={<ArrowRight aria-hidden className="size-4" />}
            data-testid="prefs-continue"
            // The defaults are fine: Enter goes on, as on every other step (Shift+Tab reaches the choices).
            autoFocus
          >
            Continue
          </Button>
        }
      />
    </section>
  );
}
