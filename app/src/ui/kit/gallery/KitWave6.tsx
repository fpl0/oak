// Specimens of the Wave 6 kit pieces in their states, for review and for kit/e2e/wave6.pw.ts: the key strip, the
// device counter, the loudness read-out, the album player bar and the branch card. It needs no router and no
// server, so it can sit on /dev/kit (session owner) or be mounted on its own with `mountKitWave6` (what the spec
// does). Key names and the words of a change come from @oak/theory (`keyDisplay`, `keyDistance`), track titles from
// @oak/api (`TRACK_TITLES`); the copy of a track's note and of the record line is content/specs/END.md's.
import { TRACK_TITLES } from "@oak/api";
import type { KeySpec } from "@oak/content-kit";
import { keyDisplay, keyDistance } from "@oak/theory";
import { QueryClientProvider } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { createContext, type ReactNode, StrictMode, useContext, useState } from "react";
import { createRoot } from "react-dom/client";
import { createQueryClient } from "../../../lib/query-client.ts";
import { AlbumPlayerBar } from "../AlbumPlayerBar.tsx";
import { BranchCard } from "../BranchCard.tsx";
import { Button, IconButton } from "../Button.tsx";
import { Card } from "../basics.tsx";
import { SegmentedControl } from "../Controls.tsx";
import { DeviceCounter, type DeviceItem } from "../DeviceCounter.tsx";
import { KeyStrip } from "../KeyStrip.tsx";
import { type LimiterActivity, LoudnessReadout } from "../LoudnessReadout.tsx";
import { barsListText, type KeySegment, keyChangeWords, keySegments } from "../model-w6.ts";
import { Toaster } from "../Toast.tsx";

const SpecimenLevel = createContext<2 | 3>(2);

function Specimen({
  id,
  title,
  sub,
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  const H = useContext(SpecimenLevel) === 3 ? "h3" : "h2";
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3" data-kit-section={id}>
      <div>
        <H id={id} className="text-h3">
          {title}
        </H>
        {sub && <p className="text-sm text-text-2">{sub}</p>}
      </div>
      <Card className="flex flex-col gap-5 p-4">{children}</Card>
    </section>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="text-[0.75rem] font-medium tracking-wide text-text-3 uppercase">{children}</p>;
}

const key = (tonic: string, mode: KeySpec["mode"]): KeySpec => ({ tonic, mode }) as KeySpec;

/** Strip segments of a key plan given as [first bar (1-based), last bar, key]: names and changes from @oak/theory. */
function plan(
  spans: readonly (readonly [number, number, KeySpec])[],
  opts: { pickup?: boolean; totalBars?: number } = {},
): KeySegment[] {
  return keySegments(
    spans.map(([fromBar, toBar, k], i) => {
      const before = spans[i - 1]?.[2];
      return {
        fromBar,
        toBar,
        text: keyDisplay(k),
        change: before ? keyChangeWords(keyDistance(before, k)) : null,
      };
    }),
    opts,
  );
}

/** C7's shape: 32 bars in C, the last chorus lifted a whole step for 8 bars (contracts §6.8 item 4). */
const LIFT = plan([
  [1, 32, key("C", "major")],
  [33, 40, key("D", "major")],
]);
/** A bridge in the dominant and back (U17.L03's Make). */
const BRIDGE = plan([
  [1, 16, key("C", "major")],
  [17, 24, key("G", "major")],
  [25, 32, key("C", "major")],
]);
/** A pickup tune that moves to its relative minor; the player is transposed up a whole step. */
const PICKUP = plan(
  [
    [0, 8, key("G", "major")],
    [9, 16, key("E", "minor")],
  ],
  { pickup: true },
).map((s, i) => ({ ...s, sounding: keyDisplay(i === 0 ? key("A", "major") : key("F#", "minor")) }));
/** Body and Soul's bridge (U17.L04): four keys in sixteen bars, short segments. */
const SHORT = plan([
  [1, 16, key("Db", "major")],
  [17, 20, key("D", "major")],
  [21, 24, key("C", "major")],
  [25, 32, key("Db", "major")],
]);
const ONE = plan([[1, 16, key("A", "minor")]]);

/** CF-A's six devices (content/specs/CF.md), with where a song has them. */
const DEVICES: readonly { id: string; name: string; definition: string; taught: string }[] = [
  {
    id: "secondary-dominant",
    name: "Secondary dominant",
    definition: "A dominant chord aimed at a chord that is not home, and going there: E7 to Am in C.",
    taught: "U15.L02",
  },
  {
    id: "borrowed-chord",
    name: "Borrowed chord",
    definition: "A chord from the minor key on the same home note: iv, ♭III, ♭VI or ♭VII.",
    taught: "U16.L01",
  },
  {
    id: "modulation",
    name: "Modulation",
    definition: "The song changes key and stays there for eight bars or more.",
    taught: "U17.L01",
  },
  {
    id: "suspension",
    name: "Suspension",
    definition: "A note of the tune held over a chord change, then stepping down into the new chord.",
    taught: "U07.L05",
  },
  {
    id: "syncopated-bass",
    name: "Syncopated bass",
    definition: "The bass lands between the beats and holds across the next one.",
    taught: "U13.L01",
  },
  {
    id: "modal-colour",
    name: "Modal colour",
    definition: "A stretch that takes its colour from a mode: the ♭VII chord of Mixolydian, a Dorian groove.",
    taught: "U14.L01",
  },
];

function deviceItems(found: Readonly<Record<string, number[]>>, onPlay: (id: string) => void): DeviceItem[] {
  return DEVICES.map((d) => {
    const bars = found[d.id];
    return {
      id: d.id,
      name: d.name,
      found: bars !== undefined,
      ...(bars ? { where: `In this song: ${barsListText(bars)}` } : {}),
      detail: bars ? d.definition : `${d.definition} Taught in ${d.taught}.`,
      ...(bars
        ? {
            action: (
              <IconButton
                label={`Play ${barsListText(bars.slice(0, 1))}: ${d.name}`}
                icon={<Play aria-hidden className="size-4" />}
                onClick={() => onPlay(d.id)}
              />
            ),
          }
        : {}),
    };
  });
}

/** Side A's first tracks in running order (content/specs/END.md), with their lengths in seconds. */
const RECORD: readonly { title: string; durationS: number }[] = [
  { title: "Intro", durationS: 24 },
  { title: "First Loop", durationS: 38 },
  { title: "Four-Chord Song", durationS: 96 },
  { title: "Folk Transcription", durationS: 52 },
];

const READINGS: Readonly<
  Record<
    "empty" | "live" | LimiterActivity,
    {
      peakDb: number | null;
      levelDb?: number;
      reductionDb?: number;
      limiter?: LimiterActivity;
      live?: boolean;
    }
  >
> = {
  empty: { peakDb: null },
  live: { peakDb: -6.8, levelDb: -19.4, reductionDb: 0, live: true },
  resting: { peakDb: -4.2, levelDb: -16.8, reductionDb: 0.2, limiter: "resting" },
  touching: { peakDb: -1.1, levelDb: -13.9, reductionDb: 1.8, limiter: "touching" },
  working: { peakDb: 2.4, levelDb: -9.6, reductionDb: 5.3, limiter: "working" },
};

export function KitWave6({ headingLevel = 1 }: { headingLevel?: 1 | 2 }) {
  const [bar, setBar] = useState<number | null>(33);
  const [picked, setPicked] = useState<string | null>(null);
  const [played, setPlayed] = useState<string | null>(null);
  const [reading, setReading] = useState<keyof typeof READINGS>("resting");
  const [track, setTrack] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const Title = headingLevel === 1 ? "h1" : "h2";
  const now = track === null ? null : (RECORD[track] ?? null);
  const start = (i: number | null) => {
    setTrack(i);
    setElapsed(0);
  };
  const r = READINGS[reading];
  return (
    <SpecimenLevel.Provider value={headingLevel === 1 ? 2 : 3}>
      <div className="mx-auto flex w-full max-w-(--oak-page-wide) flex-col gap-8 px-6 py-6">
        <header>
          <Title className="text-h1">UI kit · Wave 6</Title>
          <p className="mt-1 max-w-(--oak-measure) text-text-2">
            The key strip, the device counter, the loudness read-out, the album player bar and the branch
            card. Every state says itself in words as well as colour; every piece works from the keyboard.
          </p>
        </header>

        <Specimen
          id="w6-keystrip"
          title="KeyStrip"
          sub="The key in force along a piece. A change is a heavy bar line with its distance in words above it."
        >
          <div className="flex flex-col gap-2" data-testid="keystrip-lift">
            <Caption>A lift: the last chorus up a whole step (selectable, with a playhead)</Caption>
            <KeyStrip
              segments={LIFT}
              label="Key along “Chromatic Colour”"
              currentBar={bar === null ? null : bar - 1}
              selectedId={picked}
              onSelect={(s) => setPicked(picked === (s.id ?? null) ? null : (s.id ?? null))}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setBar(bar === null ? 1 : bar + 8 > 40 ? null : bar + 8)}>
                Move the playhead
              </Button>
              <output className="text-sm text-text-2" data-testid="keystrip-state">
                {bar === null ? "Stopped" : `Bar ${bar}`} · {picked ? `picked ${picked}` : "nothing picked"}
              </output>
            </div>
          </div>
          <div className="flex flex-col gap-2" data-testid="keystrip-bridge">
            <Caption>A bridge away and back (read only: the segments take focus to be read)</Caption>
            <KeyStrip segments={BRIDGE} label="Key along a song with a bridge in the dominant" />
          </div>
          <div className="grid gap-5 min-[1100px]:grid-cols-2">
            <div className="flex flex-col gap-2" data-testid="keystrip-pickup">
              <Caption>A pickup, the relative key, a transposed player</Caption>
              <KeyStrip segments={PICKUP} label="Key along the tune" pickup />
            </div>
            <div className="flex flex-col gap-2" data-testid="keystrip-short">
              <Caption>Short keys keep their names in the tooltip and for screen readers</Caption>
              <KeyStrip segments={SHORT} label="Key along “Body and Soul”" currentBar={17} />
            </div>
            <div className="flex flex-col gap-2" data-testid="keystrip-one">
              <Caption>One key</Caption>
              <KeyStrip segments={ONE} label="Key along a minor ballad" />
            </div>
            <div className="flex flex-col gap-2" data-testid="keystrip-empty">
              <Caption>No key yet</Caption>
              <KeyStrip segments={[]} label="Key along the piece" />
            </div>
          </div>
        </Specimen>

        <Specimen
          id="w6-devices"
          title="DeviceCounter"
          sub="Named things a piece may hold: found, with where, or still open. An open row is quiet, never a failure."
        >
          <div className="grid gap-6 min-[1100px]:grid-cols-2">
            <div className="flex flex-col gap-2" data-testid="devices-short">
              <Caption>Short of the rule</Caption>
              <DeviceCounter
                label="Devices in this song"
                need={4}
                items={deviceItems(
                  { "secondary-dominant": [11, 27], "borrowed-chord": [21], modulation: [49] },
                  setPlayed,
                )}
                note="One musical event counts for one device."
              />
              <output className="text-sm text-text-2" data-testid="devices-played">
                {played ? `Played ${played}` : "Nothing played"}
              </output>
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2" data-testid="devices-met">
                <Caption>Met, dense (beside a checklist)</Caption>
                <DeviceCounter
                  label="Devices in this song"
                  need={4}
                  dense
                  items={deviceItems(
                    {
                      "secondary-dominant": [11, 27],
                      "borrowed-chord": [21],
                      modulation: [49],
                      "syncopated-bass": [9, 10, 13, 14, 25, 26],
                    },
                    setPlayed,
                  )}
                />
              </div>
              <div className="flex flex-col gap-2" data-testid="devices-none">
                <Caption>Nothing yet, the rule not live (session 1)</Caption>
                <DeviceCounter
                  label="Devices in this song"
                  need={4}
                  dense
                  countText="0 of 6 · next session"
                  items={deviceItems({}, setPlayed)}
                />
              </div>
              <div className="flex flex-col gap-2" data-testid="devices-count">
                <Caption>A plain count (no minimum)</Caption>
                <DeviceCounter
                  label="Roles in the arrangement"
                  dense
                  items={[
                    { id: "drums", name: "Drums", found: true, where: "kick, snare, hats" },
                    { id: "bass", name: "Bass", found: true, where: "every bar" },
                    { id: "chords", name: "Chords", found: true, where: "bars 1–32" },
                    { id: "melody", name: "Melody", found: false, openText: "No melody track yet" },
                  ]}
                />
              </div>
            </div>
          </div>
        </Specimen>

        <Specimen
          id="w6-loudness"
          title="LoudnessReadout"
          sub="A calm meter with numbers: the loudest moment against the limiter's threshold, and what the limiter did."
        >
          <div className="flex flex-col gap-3" data-testid="loudness-switch">
            <SegmentedControl<keyof typeof READINGS>
              label="Reading"
              value={reading}
              onChange={setReading}
              options={[
                { value: "empty", label: "Nothing yet" },
                { value: "live", label: "Measuring" },
                { value: "resting", label: "Resting" },
                { value: "touching", label: "Touching" },
                { value: "working", label: "Working" },
              ]}
            />
            <div className="max-w-xl">
              <LoudnessReadout
                label="Loudness of the last chorus"
                peakDb={r.peakDb}
                levelDb={r.levelDb ?? null}
                reductionDb={r.reductionDb ?? null}
                limiter={r.limiter ?? null}
                live={r.live ?? false}
                data-testid="loudness-main"
                action={
                  <Button size="sm" onClick={() => setReading(reading === "live" ? "resting" : "live")}>
                    {reading === "live" ? "Stop measuring" : "Measure while it plays"}
                  </Button>
                }
              />
            </div>
          </div>
          <div className="grid gap-6 min-[1100px]:grid-cols-3">
            {(["resting", "touching", "working"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-2" data-testid={`loudness-${k}`}>
                <Caption>{k}</Caption>
                <LoudnessReadout
                  label="Loudness of the take"
                  peakDb={READINGS[k].peakDb}
                  levelDb={READINGS[k].levelDb ?? null}
                  reductionDb={READINGS[k].reductionDb ?? null}
                  limiter={READINGS[k].limiter ?? null}
                />
              </div>
            ))}
          </div>
        </Specimen>

        <Specimen
          id="w6-player"
          title="AlbumPlayerBar"
          sub="One bar plays the record through. Space plays or stops, the arrows change track, Escape stops."
        >
          <div className="flex flex-col gap-2" data-testid="player-main">
            <Caption>Side A (the owner keeps the audio: here a button moves the clock)</Caption>
            <AlbumPlayerBar
              label="Side A"
              total={12}
              index={track === null ? null : track + 1}
              title={now?.title ?? null}
              elapsedS={elapsed}
              durationS={now?.durationS ?? null}
              playing={track !== null}
              onToggle={() => start(track === null ? 0 : null)}
              onPrev={track !== null && track > 0 ? () => start(track - 1) : undefined}
              onNext={track !== null && track < RECORD.length - 1 ? () => start(track + 1) : undefined}
              idleText="12 tracks · 18:40. Plays from the first track to the last."
              actions={
                <Button variant="link" size="sm">
                  Open the album
                </Button>
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={track === null}
                onClick={() => setElapsed((e) => Math.min(now?.durationS ?? 0, e + 10))}
              >
                Ten seconds on
              </Button>
            </div>
          </div>
          <div className="grid gap-5 min-[1100px]:grid-cols-2">
            <div className="flex flex-col gap-2" data-testid="player-playing">
              <Caption>Playing, mid-track</Caption>
              <AlbumPlayerBar
                label="Side A"
                total={12}
                index={3}
                title="Four-Chord Song"
                elapsedS={42}
                durationS={96}
                playing
                onToggle={() => {}}
                onPrev={() => {}}
                onNext={() => {}}
              />
            </div>
            <div className="flex flex-col gap-2" data-testid="player-none">
              <Caption>Nothing to play</Caption>
              <AlbumPlayerBar
                label="Side A"
                total={12}
                index={null}
                title={null}
                elapsedS={0}
                durationS={null}
                playing={false}
                disabledReason="No track has a recording yet. Record a take on a track's page."
              />
            </div>
          </div>
        </Specimen>

        <Specimen
          id="w6-branch"
          title="BranchCard"
          sub="A track of the course and where it stands. Only a track with a lesson to start carries a way in."
        >
          <div className="grid gap-4 min-[900px]:grid-cols-3" data-testid="branch-cards">
            <BranchCard
              kicker="Advanced track"
              title={TRACK_TITLES.J}
              state="open"
              fresh
              note="Open. Its first lessons are still being written."
              // An action on a track with nothing to start is never drawn.
              action={<Button variant="primary">Start J1.L01</Button>}
              more={
                <Button variant="link" size="sm">
                  See it on the Oak
                </Button>
              }
              data-testid="branch-open"
            />
            <BranchCard
              kicker="Advanced track"
              title={TRACK_TITLES.R}
              state="locked"
              note="Opens with the unit 13 checkpoint."
              data-testid="branch-locked"
            />
            <BranchCard
              kicker="Advanced track"
              title={TRACK_TITLES.A}
              state="ready"
              note="Next: A1.L03 Envelopes."
              progress={{ done: 2, total: 20 }}
              action={<Button variant="primary">Start A1.L03</Button>}
              data-testid="branch-ready"
            />
          </div>
          <div className="flex flex-col gap-2" data-testid="branch-rows">
            <Caption>As rows (a list of what is open)</Caption>
            <BranchCard
              layout="row"
              title={TRACK_TITLES.J}
              state="open"
              note="Open. Its first lessons are still being written."
            />
            <BranchCard
              layout="row"
              title={TRACK_TITLES.R}
              state="open"
              note="Open. Its first lessons are still being written."
            />
            <BranchCard
              layout="row"
              title={TRACK_TITLES.A}
              state="ready"
              note="Its side lessons are open. The rest is still being written."
              action={
                <Button size="sm" variant="secondary">
                  Side lessons
                </Button>
              }
            />
          </div>
        </Specimen>
      </div>
    </SpecimenLevel.Provider>
  );
}

/** Mounts the gallery on any element (no router needed); returns the unmount. */
export function mountKitWave6(host: HTMLElement): () => void {
  const root = createRoot(host);
  root.render(
    <StrictMode>
      <QueryClientProvider client={createQueryClient()}>
        <KitWave6 />
        <Toaster />
      </QueryClientProvider>
    </StrictMode>,
  );
  return () => root.unmount();
}
