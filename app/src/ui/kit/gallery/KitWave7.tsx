// Specimens of the Wave 7 kit pieces in their states, for review and for kit/e2e/wave7.pw.ts: the track card, the
// two-lane tap pad, the version switch, the export button, the per-part levels, the Euclid ring and the slider that
// plays. It needs no router and no server: it can sit on /dev/kit (session owner) or be mounted on its own with
// `mountKitWave7` (what the spec does). Track titles come from @oak/api (`TRACK_TITLES`), swing ratios from
// @oak/content-kit (`swingRatio`, `SWING_FEELS`), Euclid grids from @oak/theory through the ring itself. Nothing
// here plays sound: the specimens show the states an owner passes in.
import { TRACK_TITLES, type TrackState } from "@oak/api";
import { SWING_FEELS, swingRatio } from "@oak/content-kit";
import { QueryClientProvider } from "@tanstack/react-query";
import { createContext, type ReactNode, StrictMode, useContext, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createQueryClient } from "../../../lib/query-client.ts";
import { Button } from "../Button.tsx";
import { Card } from "../basics.tsx";
import { EuclidRing } from "../EuclidRing.tsx";
import { ExportButton } from "../ExportButton.tsx";
import type { EuclidValue, ExportState } from "../model-w7.ts";
import { PartLevels } from "../PartLevels.tsx";
import { PlaySlider } from "../PlaySlider.tsx";
import { Toaster } from "../Toast.tsx";
import { TrackCard } from "../TrackCard.tsx";
import { type LaneMark, TwoLaneTapPad } from "../TwoLaneTapPad.tsx";
import { VersionSwitch } from "../VersionSwitch.tsx";

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

// --- track cards -----------------------------------------------------------------------------------

const OPENED = "2026-10-02T09:00:00.000Z";

function gateOf(trackId: "J" | "R" | "A", gateId: string, opens: string, label: string, open: boolean) {
  const ref = /U(\d+) checkpoint/.exec(label)?.[1];
  return {
    gateId,
    trackId,
    opens,
    requires: [
      {
        ref: ref ? `U${ref}.CP` : (label.split(" ")[0] ?? label),
        kind: ref ? ("checkpoint" as const) : ("lesson" as const),
        label,
        met: open,
      },
    ],
    open,
    openedAt: open ? OPENED : null,
    lessonsAuthored: 5,
    lessonsTotal: 5,
  };
}

const JAZZ_IN_PROGRESS: TrackState = {
  trackId: "J",
  title: TRACK_TITLES.J,
  status: "open",
  openedAt: OPENED,
  gates: [
    gateOf("J", "J.main", "J1, J2.L01–L03, J3", "U13 checkpoint passed", true),
    gateOf("J", "J.chord-scales", "J2.L04", "U14 checkpoint passed", true),
  ],
  sessionsDone: 7,
  sessionsTotal: 34,
  next: "J2.L02",
  note: "Next: J2.L02 Minor ii–V–i.",
  nextSession: { kind: "lesson", mapItemId: "J2.L02", title: "Minor ii–V–i", estMinutes: 20 },
  focus: true,
  capstones: [
    { capstoneId: "JC1", status: "locked", lockedReason: "Opens with Jazz checkpoint 1." },
    { capstoneId: "JC2", status: "locked", lockedReason: "Opens after J4.L04." },
    { capstoneId: "JC3", status: "locked", lockedReason: "Opens with Jazz checkpoint 2." },
    { capstoneId: "JC4", status: "locked", lockedReason: "Opens with Jazz checkpoint 2." },
  ],
};

const RHYTHM_OPEN: TrackState = {
  trackId: "R",
  title: TRACK_TITLES.R,
  status: "open",
  openedAt: OPENED,
  gates: [gateOf("R", "R.main", "R1–R3", "U13 checkpoint passed", true)],
  sessionsDone: 0,
  sessionsTotal: 20,
  next: "R1.L01",
  note: "Next: R1.L01 Metric Weight.",
  nextSession: { kind: "lesson", mapItemId: "R1.L01", title: "Metric Weight", estMinutes: 15 },
};

const SOUND_WAITING: TrackState = {
  trackId: "A",
  title: TRACK_TITLES.A,
  status: "open",
  openedAt: OPENED,
  gates: [
    gateOf("A", "A.side", "A1.L01–L04", "U03.L02 completed", true),
    gateOf("A", "A.sound", "A1.L05–L07", "U09 checkpoint passed", false),
  ],
  sessionsDone: 4,
  sessionsTotal: 20,
  next: null,
  note: "A1.L05 opens with the U09 checkpoint.",
  nextSession: null,
};

const JAZZ_COMPLETE: TrackState = {
  ...JAZZ_IN_PROGRESS,
  sessionsDone: 34,
  next: null,
  nextSession: null,
  focus: false,
  note: "Every session done.",
  capstones: JAZZ_IN_PROGRESS.capstones?.map((c) => ({
    ...c,
    status: "released" as const,
    lockedReason: null,
  })),
};

const RHYTHM_LOCKED: TrackState = {
  ...RHYTHM_OPEN,
  status: "locked",
  openedAt: null,
  gates: [gateOf("R", "R.main", "R1–R3", "U13 checkpoint passed", false)],
  next: null,
  nextSession: null,
  note: "Opens with the unit 13 checkpoint.",
};

// --- the stateful specimens ------------------------------------------------------------------------

const SPAN_MS = 2000;

/** A 3-against-2 take over one 2-second bar: the targets, the taps as they land, marked once the bar is over. */
function TapPadSpecimen() {
  const [armed, setArmed] = useState(false);
  const [taps, setTaps] = useState<[number[], number[]]>([[], []]);
  const start = useRef(0);
  const targets: [number[], number[]] = [
    [0, 1 / 3, 2 / 3],
    [0, 1 / 2],
  ];
  const mark = (lane: 0 | 1): LaneMark[] =>
    taps[lane].map((at) => {
      const off = Math.min(...targets[lane].map((t) => Math.abs(t - at)));
      return { at, state: armed ? "hit" : off <= 0.03 ? "hit" : off <= 0.07 ? "near" : "extra" };
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={armed ? "secondary" : "primary"}
          onClick={() => {
            if (!armed) {
              setTaps([[], []]);
              start.current = performance.now();
            }
            setArmed(!armed);
          }}
          data-testid="tap-arm"
        >
          {armed ? "Stop" : "Start"}
        </Button>
        <span className="text-sm text-text-2">One bar: three even taps on F against two on J.</span>
      </div>
      <TwoLaneTapPad
        label="Tap 3 against 2"
        armed={armed}
        lanes={[
          { label: "3", hint: "three a bar", targets: armed ? [] : targets[0], marks: mark(0) },
          { label: "2", hint: "two a bar", targets: armed ? [] : targets[1], marks: mark(1) },
        ]}
        beats={[0, 0.25, 0.5, 0.75].map((at) => ({ at, strong: at === 0 }))}
        idleText="Press Start, then tap."
        onTap={(lane, at) => {
          const f = ((at - start.current) % SPAN_MS) / SPAN_MS;
          setTaps((t) => (lane === 0 ? [[...t[0], f], t[1]] : [t[0], [...t[1], f]]));
        }}
        data-testid="tap-pad"
      />
    </div>
  );
}

/** The same render as an owner would drive it: progress from a timer, Cancel, a saved file. */
function ExportSpecimen() {
  const [state, setState] = useState<ExportState>({ phase: "idle" });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);
  const run = () => {
    let f = 0;
    setState({ phase: "rendering", fraction: 0 });
    timer.current = setInterval(() => {
      f += 0.125;
      if (f >= 1) {
        if (timer.current) clearInterval(timer.current);
        setState({ phase: "done", fileName: "Four-Chord Song.wav", bytes: 2_202_009 });
      } else setState({ phase: "rendering", fraction: f });
    }, 120);
  };
  return (
    <ExportButton
      state={state}
      what="Four-Chord Song, version 3"
      onExport={run}
      onCancel={() => {
        if (timer.current) clearInterval(timer.current);
        setState({ phase: "cancelled" });
      }}
      data-testid="export-live"
    />
  );
}

function VersionSpecimen() {
  const [v, setV] = useState("a");
  const [playing, setPlaying] = useState<string | null>("a");
  return (
    <div className="flex flex-col gap-2">
      <VersionSwitch
        label="Version of “Sweet Georgia Brown”"
        options={[
          { id: "a", letter: "A", label: "Swing", detail: "176 BPM · brushes, upright bass" },
          { id: "b", letter: "B", label: "Funk", detail: "98 BPM · rhodes, slap bass" },
        ]}
        value={v}
        playing={playing}
        onChange={(id) => {
          setV(id);
          if (playing) setPlaying(id);
        }}
        keyHint="V"
        data-testid="version-switch"
      />
      <Button size="sm" variant="ghost" className="self-start" onClick={() => setPlaying(playing ? null : v)}>
        {playing ? "Stop" : "Play"}
      </Button>
    </div>
  );
}

function EuclidSpecimen() {
  const [v, setV] = useState<EuclidValue>({ pulses: 5, steps: 16, rotation: 10 });
  return <EuclidRing value={v} onChange={setV} label="Rim" controls playStep={3} data-testid="euclid-edit" />;
}

const feelName = (amount: number): string => {
  const ratio = swingRatio(amount);
  const named = SWING_FEELS.find((f) => Math.abs(f.ratio - ratio) < 0.05);
  const r = `${ratio.toFixed(ratio < 10 ? 2 : 1).replace(/\.?0+$/, "")}:1`;
  return named ? `${r}: ${named.label.replace(/ \(.*\)$/, "").toLowerCase()}` : `${r} long to short`;
};

function SwingSpecimen() {
  const [amount, setAmount] = useState(0.2);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState<number[]>([]);
  return (
    <div className="flex flex-col gap-1">
      <PlaySlider
        label="Swing amount"
        value={amount}
        min={0}
        max={0.6}
        step={0.05}
        fine={0.01}
        coarse={0.1}
        format={(x) => x.toFixed(2)}
        marks={SWING_FEELS.map((f) => f.amount).filter((a) => a <= 0.6)}
        onChange={setAmount}
        playing={playing}
        onPlayToggle={() => setPlaying((p) => !p)}
        onAudition={(x) => setHeard((h) => [...h, x])}
        describe={feelName}
        data-testid="swing-slider"
      />
      <p className="pl-9 text-[0.75rem] text-text-3" data-testid="swing-heard">
        {heard.length === 0
          ? "Nothing auditioned yet."
          : `Auditioned ${heard.length === 1 ? "once" : `${heard.length} times`}, last at ${heard.at(-1)?.toFixed(2)}.`}
      </p>
    </div>
  );
}

export function KitWave7({ nested = false }: { nested?: boolean }) {
  return (
    <SpecimenLevel.Provider value={nested ? 3 : 2}>
      <div className="mx-auto flex max-w-page flex-col gap-8 p-6" data-testid="kit-wave7">
        {!nested && (
          <header>
            <h1 className="text-h1">UI kit · Wave 7</h1>
            <p className="text-text-2">
              The advanced tracks as places, two-handed taps, two versions of a tune, export, levels, Euclid
              rings and a slider that plays.
            </p>
          </header>
        )}

        <Specimen
          id="w7-track"
          title="Track card"
          sub="Open, in progress, waiting for a named gate, complete. The way in is drawn only when there is something to start."
        >
          <div className="grid gap-3 md:grid-cols-2" data-testid="track-cards">
            <TrackCard
              kicker="Advanced track"
              title={TRACK_TITLES.J}
              track={JAZZ_IN_PROGRESS}
              action={<Button variant="primary">Start J2.L02</Button>}
              more={
                <Button variant="link" size="sm">
                  The track on the Oak
                </Button>
              }
              data-testid="track-in-progress"
            />
            <TrackCard
              kicker="Advanced track"
              title={TRACK_TITLES.R}
              track={RHYTHM_OPEN}
              action={<Button variant="primary">Start R1.L01</Button>}
              data-testid="track-open"
            />
            <TrackCard
              kicker="Advanced track"
              title={TRACK_TITLES.A}
              track={SOUND_WAITING}
              action={<Button variant="primary">This is never drawn</Button>}
              more={
                <Button variant="link" size="sm">
                  The track on the Oak
                </Button>
              }
              data-testid="track-waiting"
            />
            <TrackCard
              kicker="Advanced track"
              title={TRACK_TITLES.J}
              track={JAZZ_COMPLETE}
              more={
                <Button variant="link" size="sm">
                  Replay a lesson
                </Button>
              }
              data-testid="track-complete"
            />
          </div>
          <div className="flex flex-col gap-2" data-testid="track-rows">
            <Caption>As rows (Today's offers beside the core)</Caption>
            <TrackCard
              layout="row"
              title={TRACK_TITLES.J}
              track={JAZZ_IN_PROGRESS}
              action={
                <Button size="sm" variant="secondary">
                  Start
                </Button>
              }
            />
            <TrackCard layout="row" title={TRACK_TITLES.R} track={RHYTHM_LOCKED} />
          </div>
        </Specimen>

        <Specimen
          id="w7-tap"
          title="Two-lane tap pad"
          sub="F taps the first lane and J the second; a press on a lane taps it too. Marks: filled on time, hollow near, a dashed ring missed, a short tick extra."
        >
          <TapPadSpecimen />
          <Caption>Marked after a take</Caption>
          <TwoLaneTapPad
            label="Tap the clave against the pulse"
            armed={false}
            lanes={[
              {
                label: "Clave",
                targets: [0, 3 / 16, 6 / 16, 10 / 16, 12 / 16],
                marks: [
                  { at: 0.005, state: "hit" },
                  { at: 0.2, state: "near" },
                  { at: 6 / 16, state: "hit" },
                  { at: 10 / 16, state: "miss" },
                  { at: 0.755, state: "hit" },
                ],
                note: "4 of 5 placed",
              },
              {
                label: "Pulse",
                targets: [0, 0.25, 0.5, 0.75],
                marks: [
                  { at: 0, state: "hit" },
                  { at: 0.25, state: "hit" },
                  { at: 0.5, state: "hit" },
                  { at: 0.62, state: "extra" },
                  { at: 0.75, state: "hit" },
                ],
                note: "4 of 4, one extra",
              },
            ]}
            beats={[0, 0.25, 0.5, 0.75].map((at) => ({ at, strong: at === 0 || at === 0.5 }))}
            playhead={0.42}
            idleText="The take is over."
            onTap={() => {}}
            data-testid="tap-pad-marked"
          />
        </Specimen>

        <Specimen
          id="w7-version"
          title="Version switch"
          sub="Two versions of one tune; the one that sounds says so. Arrows switch; the page binds its own key."
        >
          <VersionSpecimen />
        </Specimen>

        <Specimen
          id="w7-export"
          title="Export button"
          sub="Renders offline, with progress and Cancel. A failure says why; nothing partial is ever saved."
        >
          <ExportSpecimen />
          <div className="grid gap-4 md:grid-cols-2">
            <ExportButton
              state={{ phase: "rendering", fraction: null }}
              onExport={() => {}}
              onCancel={() => {}}
              data-testid="export-indeterminate"
            />
            <ExportButton
              state={{ phase: "failed", message: "This piece uses a sound that is not loaded here: choir" }}
              onExport={() => {}}
              onCancel={() => {}}
              data-testid="export-failed"
            />
            <ExportButton
              state={{ phase: "idle" }}
              onExport={() => {}}
              onCancel={() => {}}
              disabledReason="Release a version first: Export renders a released version."
              data-testid="export-disabled"
            />
          </div>
        </Specimen>

        <Specimen
          id="w7-levels"
          title="Part levels"
          sub="One meter row per part; the target band shaded; a part more than 24 dB under the loudest one is not heard."
        >
          <PartLevels
            label="Levels of “Neo-Soul Ballad”"
            parts={[
              { id: "drums", label: "Drums", db: -7.5 },
              { id: "bass", label: "Bass", db: -11.2, target: { low: -14, high: -9 } },
              { id: "keys", label: "Rhodes", db: -15.8, target: { low: -18, high: -12 } },
              { id: "pad", label: "Choir pad", db: -34 },
              { id: "vox", label: "Lead", db: Number.NEGATIVE_INFINITY },
            ]}
            data-testid="levels"
          />
          <PartLevels parts={[]} data-testid="levels-empty" />
        </Specimen>

        <Specimen
          id="w7-euclid"
          title="Euclid ring"
          sub="x(k,n,r) round a circle from the top. Editable: Up/Down hits, Left/Right rotate, Shift+Up/Down steps, Home no rotation."
        >
          <div className="flex flex-wrap items-start gap-8">
            <EuclidSpecimen />
            <EuclidRing
              value={{ pulses: 3, steps: 8, rotation: 0 }}
              label="Tresillo"
              data-testid="euclid-tresillo"
            />
            <EuclidRing value={{ pulses: 5, steps: 8, rotation: 0 }} label="Cinquillo" size={128} />
          </div>
        </Specimen>

        <Specimen
          id="w7-slider"
          title="Slider that plays"
          sub="Play, then move it: each settled value is heard. The line says what the value does."
        >
          <SwingSpecimen />
        </Specimen>
      </div>
    </SpecimenLevel.Provider>
  );
}

/** Mounts the gallery on any element (no router needed); returns the unmount. */
export function mountKitWave7(host: HTMLElement): () => void {
  const root = createRoot(host);
  root.render(
    <StrictMode>
      <QueryClientProvider client={createQueryClient()}>
        <KitWave7 />
        <Toaster />
      </QueryClientProvider>
    </StrictMode>,
  );
  return () => root.unmount();
}
