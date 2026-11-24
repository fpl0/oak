// Settings › Audio (ux §2.3; contracts §8.6): volumes, a live output level meter with a test phrase (measured:
// its average level, its loudest moment and what the limiter did, Wave 6), a left/right output check, the limiter, what the computer reports as the output now (AirPods guidance, and a nudge to
// re-measure timing when it changed), timing (with re-runs through /settings/voice/setup), and the sound pack:
// its version, what is cached for offline use, and "Preload all".
import { createMasterMeter, type MasterMeter } from "@oak/audio";
import { LIMITER } from "@oak/strudel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Music, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { usePageTitle } from "../../lib/nav.ts";
import { getOak, peekOak } from "../../lib/oak.ts";
import { useBootstrap } from "../../lib/queries.ts";
import { useUpdateSetting } from "../../lib/settings.ts";
import { audioStatusLabel, useShell } from "../../lib/shell-store.ts";
import { Button, buttonClass } from "../../ui/kit/Button.tsx";
import { Callout } from "../../ui/kit/Controls.tsx";
import { Field, ReadOnlyRow, Section, Slider } from "../../ui/kit/Field.tsx";
import { QueryView } from "../../ui/kit/QueryState.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { outputChangeAdvice, outputChoiceOf, outputGuidance, phraseReadout } from "../../voice/logic.ts";
import { browserPackDeps, type PackStatus, packLine, readPackStatus } from "../../voice/pack-status.ts";
import { OutputMeter } from "../../voice/panels.tsx";
import { playAt, voiceAudio } from "../../voice/services.ts";
import { useOutputDevice } from "../../voice/use-output-device.ts";

export const Route = createFileRoute("/settings/audio")({ component: AudioSettings });

const ms = (v: number | null) => (v === null ? "not measured" : `${Math.round(v)} ms`);
const OUTPUT_WORDS = {
  wired: "Wired headphones",
  bluetooth: "Bluetooth or AirPods",
  speakers: "Speakers",
} as const;

function OutputCheck({ onPlayed }: { onPlayed(): void }) {
  const [state, setState] = useState<"idle" | "playing" | "played">("idle");
  const play = async () => {
    setState("playing");
    try {
      const { oak, calibration } = await voiceAudio();
      await oak.unlock();
      await calibration.outputCheck();
      setState("played");
      onPlayed();
    } catch (e) {
      setState("idle");
      toast.error("Sound didn't start", e instanceof Error ? e.message : undefined);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <Button
        onClick={() => void play()}
        loading={state === "playing"}
        icon={<Play aria-hidden className="size-4" />}
        data-testid="audio-lr"
      >
        Play the left/right test
      </Button>
      <span className="text-sm text-text-2" aria-live="polite">
        {state === "playing"
          ? "A low tone on the left, then a higher one on the right…"
          : state === "played"
            ? "Low on the left, high on the right? If they swapped, check the L and R of your headphones."
            : "A low tone in the left ear, then a higher one in the right."}
      </span>
    </div>
  );
}

/** Seconds the test phrase is measured for: its four notes, the chord and most of the chord's ring. */
const PHRASE_SEC = 3.2;

/**
 * A short piano phrase through the master bus at practice volume, so the output meter has something to show.
 * While it plays, the phrase is measured sample by sample before and after the limiter (@oak/audio's Master
 * meter, the one the single's Master card uses) and the read-out is handed to `onMeasured`.
 */
function TestPhrase({ onMeasured }: { onMeasured(readout: string | null): void }) {
  const [playing, setPlaying] = useState(false);
  const play = async () => {
    setPlaying(true);
    onMeasured(null);
    let meter: MasterMeter | null = null;
    try {
      const { oak } = await voiceAudio();
      await oak.unlock();
      // The meter is a side branch of the bus; without AudioWorklet the phrase plays unmeasured.
      meter = createMasterMeter(oak.ctx, { pre: oak.master.input, post: oak.master.analyser });
      const ready = await meter.prepare().then(
        () => true,
        () => false,
      );
      const at = oak.ctx.currentTime + 0.1;
      const reading = ready ? meter.measure({ at, seconds: PHRASE_SEC }) : null;
      // C E G C′, then the chord: the range most lessons play in.
      for (const [i, note] of [60, 64, 67, 72].entries())
        playAt(oak, { s: "piano", note, gain: 0.7 }, at + i * 0.35, 0.5);
      for (const note of [48, 60, 64, 67]) playAt(oak, { s: "piano", note, gain: 0.5 }, at + 1.5, 1.6);
      if (reading) onMeasured(phraseReadout(await reading));
      else await new Promise((r) => setTimeout(r, PHRASE_SEC * 1000 + 100));
    } catch (e) {
      toast.error("Sound didn't start", e instanceof Error ? e.message : undefined);
    } finally {
      meter?.dispose();
      setPlaying(false);
    }
  };
  return (
    <Button
      onClick={() => void play()}
      loading={playing}
      icon={<Music aria-hidden className="size-4" />}
      data-testid="audio-phrase"
    >
      Play a test phrase
    </Button>
  );
}

function usePackStatus(key: string) {
  const [status, setStatus] = useState<PackStatus | null>(null);
  // Re-read when sound wakes (the adapter's sound list appears then) or after a preload.
  useEffect(() => {
    let live = true;
    void readPackStatus(browserPackDeps(() => peekOak()?.sounds().length ?? 0)).then(
      (s) => live && setStatus(s),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return status;
}

function AudioSettings() {
  usePageTitle("Settings · Audio");
  const bootstrap = useBootstrap();
  const update = useUpdateSetting();
  const audio = useShell((s) => s.audio);
  const [played, setPlayed] = useState(0);
  const [readout, setReadout] = useState<string | null>(null);
  const pack = usePackStatus(`${audio.kind}:${played}`);
  const device = useOutputDevice();
  const preloadAll = async () => {
    try {
      const oak = peekOak() ?? (await getOak());
      useShell.getState().setAudio({ kind: "loading", done: 0, total: 1 });
      const report = await oak.preload({ sounds: oak.sounds().map((s) => ({ s })) }, (done, total) =>
        useShell.getState().setAudio({ kind: "loading", done, total }),
      );
      useShell.getState().setAudio({ kind: "ready" });
      toast.success(
        "Sounds ready",
        `${report.warmed} sound files warmed in ${Math.round(report.ms / 100) / 10} s.`,
      );
    } catch (e) {
      useShell.getState().setAudio({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      toast.error("Couldn't preload the sounds", e instanceof Error ? e.message : undefined);
    }
  };
  return (
    <QueryView query={bootstrap}>
      {({ settings, profile }) => {
        const out = outputChoiceOf(profile.outputKind);
        const lines = pack ? packLine(pack) : null;
        return (
          <div className="flex flex-col gap-6">
            <Section title="Output">
              <Field label="Master volume">
                {({ id, describedBy }) => (
                  <Slider
                    id={id}
                    describedBy={describedBy}
                    value={Math.round(settings.volume * 100)}
                    min={0}
                    max={100}
                    format={(v) => `${v}%`}
                    onChange={(v) => update.set("volume", v / 100)}
                  />
                )}
              </Field>
              <Field label="Click volume" help="The metronome and count-in.">
                {({ id, describedBy }) => (
                  <Slider
                    id={id}
                    describedBy={describedBy}
                    value={Math.round(settings.clickVolume * 100)}
                    min={0}
                    max={100}
                    format={(v) => `${v}%`}
                    onChange={(v) => update.set("clickVolume", v / 100)}
                  />
                )}
              </Field>
              <ReadOnlyRow
                label="Limiter"
                value={`On: nothing goes above ${LIMITER.threshold} dBFS (protects your ears and speakers)`}
              />
              <ReadOnlyRow
                label="Listening on"
                value={
                  profile.outputKind === "unknown" ? (
                    "not set up yet"
                  ) : (
                    <span data-testid="listening-on">
                      {OUTPUT_WORDS[out]}
                      <span className="block text-sm text-text-3">{outputGuidance(out).title}</span>
                      {device && (
                        <span className="block text-sm text-text-3">
                          Your computer reports {device.label}.
                        </span>
                      )}
                    </span>
                  )
                }
              />
              {(() => {
                const advice = outputChangeAdvice(
                  device?.label ?? null,
                  device?.kind ?? null,
                  profile.outputKind,
                );
                return advice ? (
                  <div className="py-3">
                    <Callout
                      tone="attention"
                      title={advice.title}
                      actions={
                        <Link
                          to="/settings/voice/setup"
                          search={{ part: "headphones" }}
                          className={buttonClass("secondary", "sm")}
                        >
                          Set up these headphones
                        </Link>
                      }
                    >
                      {advice.body}
                    </Callout>
                  </div>
                ) : null;
              })()}
              <div className="flex flex-col gap-3 py-3">
                <OutputMeter />
                <div className="flex flex-wrap items-center gap-3">
                  <TestPhrase onMeasured={setReadout} />
                  <span className="text-sm text-text-2">
                    The meter shows what Oak sends to your headphones, whatever is playing.
                  </span>
                </div>
                {/* Kept in the page so a screen reader hears the result when the phrase ends. */}
                <p
                  className={readout ? "text-sm text-text-2" : "sr-only"}
                  aria-live="polite"
                  data-testid="audio-readout"
                >
                  {readout}
                </p>
              </div>
              <OutputCheck onPlayed={() => setPlayed((n) => n + 1)} />
              <div className="pb-1">
                <Link
                  to="/settings/voice/setup"
                  search={{ part: "headphones" }}
                  className={buttonClass("secondary")}
                >
                  Change headphones
                </Link>
              </div>
            </Section>
            {/* The one Timing card (Settings › Voice links here): every delay Oak allows for, with these headphones. */}
            <Section
              title="Timing"
              description="The delays Oak allows for when it checks your taps and your singing. Measure again when you change headphones."
            >
              <ReadOnlyRow
                label="Tap latency"
                value={
                  profile.tapLatencyMs !== null && profile.tapJitterMs !== null
                    ? `${ms(profile.tapLatencyMs)} (±${Math.round(profile.tapJitterMs)} ms)`
                    : ms(profile.tapLatencyMs)
                }
              />
              <ReadOnlyRow label="Sing latency" value={ms(profile.singLatencyMs)} />
              <ReadOnlyRow label="Output latency" value={ms(profile.outputLatencyMs)} />
              <div className="py-3">
                <Link
                  to="/settings/voice/setup"
                  search={{ part: "latency" }}
                  className={buttonClass("secondary")}
                  data-testid="audio-recalibrate"
                >
                  {profile.tapLatencyMs === null && profile.singLatencyMs === null
                    ? "Measure timing"
                    : "Measure timing again"}
                </Link>
              </div>
            </Section>
            <Section title="Sound pack">
              <ReadOnlyRow label="Sound" value={audioStatusLabel(audio)} />
              <ReadOnlyRow
                label="Installed"
                value={<span data-testid="pack-status">{lines ? lines.status : "Checking…"}</span>}
              />
              <ReadOnlyRow
                label="Offline"
                value={<span data-testid="pack-offline">{lines ? lines.offline : "Checking…"}</span>}
              />
              <div className="py-3">
                <Button
                  onClick={() => void preloadAll()}
                  loading={audio.kind === "loading" || audio.kind === "waking"}
                >
                  Preload all
                </Button>
              </div>
            </Section>
          </div>
        );
      }}
    </QueryView>
  );
}
