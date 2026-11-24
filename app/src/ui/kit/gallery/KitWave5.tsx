// Specimens of the Wave 5 kit pieces in their states, for review and for kit/e2e/wave5.pw.ts: the section ribbon,
// the twelve-box bar grid, the line chart (energy curve), the scope / spectrum frame and the control read-out. It
// needs no router and no server, so it can sit on /dev/kit (session owner) or be mounted on its own with
// `mountKitWave5` (what the spec does). Every musical example comes from @oak/theory and every curve from the
// @oak/strudel probes (the same maths the Workbench's probes use), never from a local table.
import { adsrCurve, adsrValues, filterCurve, logFrequencies, waveHarmonics } from "@oak/strudel/probes";
import { twelveBarChords, twelveBarPlan } from "@oak/theory";
import { QueryClientProvider } from "@tanstack/react-query";
import { createContext, type ReactNode, StrictMode, useContext, useState } from "react";
import { createRoot } from "react-dom/client";
import { createQueryClient } from "../../../lib/query-client.ts";
import { type BarCell, BarGrid } from "../BarGrid.tsx";
import { Button } from "../Button.tsx";
import { Card } from "../basics.tsx";
import { ControlReadout } from "../ControlReadout.tsx";
import { SegmentedControl } from "../Controls.tsx";
import { LineChart } from "../LineChart.tsx";
import type { RibbonSection } from "../model-w5.ts";
import { ScopeFrame } from "../ScopeFrame.tsx";
import { SectionRibbon } from "../SectionRibbon.tsx";
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

/** C3's shape: verse, chorus, verse, chorus, four bars each (U09 lesson sections), with their energy. */
const DEMO_SECTIONS: RibbonSection[] = [
  { tag: "verse", text: "Verse", letter: "A", startBar: 0, bars: 4, energy: 0.38 },
  { tag: "chorus", text: "Chorus", letter: "B", startBar: 4, bars: 4, energy: 0.78 },
  { tag: "verse2", text: "Verse 2", letter: "A", startBar: 8, bars: 4, energy: 0.44 },
  { tag: "chorus2", text: "Chorus 2", letter: "B", startBar: 12, bars: 4, energy: 0.92 },
];
/** A song with an intro, a bridge and an outro: more letters, short blocks. */
const LONG_SECTIONS: RibbonSection[] = [
  { tag: "intro", text: "Intro", letter: "A", startBar: 0, bars: 2, energy: 0.2 },
  { tag: "verse", text: "Verse", letter: "B", startBar: 2, bars: 8, energy: 0.4 },
  { tag: "chorus", text: "Chorus", letter: "C", startBar: 10, bars: 8, energy: 0.8 },
  { tag: "bridge", text: "Bridge", letter: "D", startBar: 18, bars: 4, energy: 0.55 },
  { tag: "chorus2", text: "Chorus 2", letter: "C", startBar: 22, bars: 8, energy: 0.95 },
  { tag: "outro", text: "Outro", letter: "E", startBar: 30, bars: 2, energy: 0.25 },
];
/** A pickup piece: bar 0 is the pickup, the sections count from the first full bar (c4). */
const PICKUP_SECTIONS: RibbonSection[] = [
  { tag: "question", text: "Question", letter: "A", startBar: 0, bars: 5 },
  { tag: "answer", text: "Answer", letter: "B", startBar: 5, bars: 4 },
];

/** Per-bar energy of the verse–chorus demo (16 bars), rising into each chorus. */
const BAR_ENERGY = [0.3, 0.35, 0.4, 0.45, 0.72, 0.78, 0.8, 0.82, 0.4, 0.42, 0.46, 0.5, 0.85, 0.9, 0.95, 0.98];
const BAR_LABELS = BAR_ENERGY.map(
  (_, i) => DEMO_SECTIONS.find((s) => i >= s.startBar && i < s.startBar + s.bars)?.text ?? "",
);

const BLUES_FORM = { variant: "standard", turnaround: true } as const;
const BLUES_CHORDS = twelveBarChords("C", BLUES_FORM).map((c) => `${c.root}${c.quality}`);
const BLUES_RN = twelveBarPlan(BLUES_FORM);

const FREQS = logFrequencies(160);

function sinePath(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: (v: number) => number,
  f: (x: number) => number,
) {
  ctx.beginPath();
  for (let px = 0; px <= w; px += 1) {
    const yy = y(f(px / w));
    if (px === 0) ctx.moveTo(px, yy);
    else ctx.lineTo(px, yy);
  }
  ctx.stroke();
}

/** A sawtooth as its first six harmonics (1/n), over two periods: what `.partials()` and `s("sawtooth")` draw. */
const SAW = waveHarmonics("sawtooth", 6) ?? [];
const sawAt = (phase: number) =>
  SAW.reduce((sum, a, i) => sum + a * Math.sin(2 * Math.PI * (i + 1) * phase), 0) / 1.6;

/**
 * `nested`: mounted inside another page that has its own `h1` (/dev/kit): the gallery's title is an `h2` and its
 * specimens `h3`.
 */
export function KitWave5({ nested = false }: { nested?: boolean } = {}) {
  const [loop, setLoop] = useState<string | null>("chorus");
  const [bar, setBar] = useState<number | null>(5);
  const [picked, setPicked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<(string | null)[]>(() => BLUES_RN.map((rn, i) => (i < 4 ? rn : null)));
  const [cell, setCell] = useState<number | null>(4);
  const [checked, setChecked] = useState(false);
  const [cutoff, setCutoff] = useState(800);
  const [q, setQ] = useState(1);
  const [attack, setAttack] = useState(0.01);
  const [release, setRelease] = useState(0.3);
  const [live, setLive] = useState(false);

  const filter = filterCurve({ kind: "filter", filter: "lpf", cutoff, q, slope: 12 }, FREQS);
  const env = adsrValues({ attack, release });
  const envPts = adsrCurve(env, 0.5);
  const answerCells: BarCell[] = answer.map((rn, i) => ({
    content: rn,
    ...(rn === null ? {} : { text: rn }),
    state:
      i < 4 ? "given" : rn === null ? "empty" : checked ? (rn === BLUES_RN[i] ? "met" : "unmet") : "filled",
  }));

  return (
    <SpecimenLevel.Provider value={nested ? 3 : 2}>
      <div className="mx-auto flex max-w-page flex-col gap-8 p-6" data-testid="kit-wave5">
        <header>
          {nested ? (
            <h2 className="text-h1">UI kit · Wave 5</h2>
          ) : (
            <h1 className="text-h1">UI kit · Wave 5</h1>
          )}
          <p className="mt-1 text-text-2">
            Sections, bar charts, the energy curve, the scope frame and sound controls.
          </p>
        </header>

        <Specimen
          id="w5-ribbon"
          title="SectionRibbon"
          sub="Blocks as wide as their bars, named and lettered; click or Enter loops a section, Esc stops."
        >
          <Caption>Loopable, with energy and the bar playing now</Caption>
          <SectionRibbon
            label="Sections of “Porch Light”"
            sections={DEMO_SECTIONS}
            currentBar={bar}
            loopTag={loop}
            onLoop={(s) => setLoop(s?.tag ?? null)}
            data-testid="ribbon-loop"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setBar((b) => (b === null ? 0 : (b + 1) % 16))}>
              Next bar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBar(null)}>
              Stop
            </Button>
            <span className="text-sm text-text-2" data-testid="ribbon-loop-state">
              {loop ? `Loop: ${loop}` : "No loop"}
            </span>
          </div>
          <Caption>Six sections, 32 bars</Caption>
          <SectionRibbon label="Sections of a longer song" sections={LONG_SECTIONS} onLoop={() => {}} />
          <Caption>Selectable (a form answer), with a pickup</Caption>
          <SectionRibbon
            label="Pick the section that answers"
            sections={PICKUP_SECTIONS}
            pickup
            selectedTag={picked}
            onSelect={(s) => setPicked(s.tag)}
            data-testid="ribbon-select"
          />
          <Caption>The tracks disagree</Caption>
          <SectionRibbon
            label="Sections"
            sections={[]}
            problem="The drums play verse, chorus, verse, chorus; the bass plays verse, verse, chorus. Write one arrange() per labelled track, with the same sections in the same order."
            data-testid="ribbon-problem"
          />
          <Caption>No arrange() yet</Caption>
          <SectionRibbon label="Sections" sections={[]} data-testid="ribbon-empty" />
        </Specimen>

        <Specimen
          id="w5-grid"
          title="BarGrid"
          sub="The twelve-bar chart, four bars a line; arrows move, up and down a line, Enter picks."
        >
          <Caption>A chart: 12-bar blues in C with the turnaround (from @oak/theory)</Caption>
          <BarGrid
            label="Twelve-bar blues in C"
            cells={BLUES_CHORDS.map((c) => ({ content: c, state: "given" }))}
            current={bar !== null && bar < 12 ? bar : null}
            data-testid="grid-chart"
          />
          <Caption>An answer: bars 1–4 given, the rest to fill</Caption>
          <BarGrid
            label="Write the numerals of the twelve bars"
            cells={answerCells}
            selected={cell}
            onSelect={setCell}
            lineLabels={["I", "IV", "V"]}
            data-testid="grid-answer"
          />
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Numeral for the selected bar"
              value={cell === null ? "" : (answer[cell] ?? "")}
              options={["I7", "IV7", "V7"].map((v) => ({ value: v, label: v }))}
              onChange={(v) => {
                if (cell === null || cell < 4) return;
                setChecked(false);
                setAnswer((a) => a.map((x, i) => (i === cell ? v : x)));
              }}
            />
            <Button size="sm" variant="primary" onClick={() => setChecked(true)}>
              Check
            </Button>
          </div>
        </Specimen>

        <Specimen
          id="w5-chart"
          title="LineChart"
          sub="The energy curve: one line, the lowest and highest points in words for screen readers."
        >
          <Caption>Energy by section, the chorus marked</Caption>
          <LineChart
            label="Energy by section"
            values={DEMO_SECTIONS.map((s) => s.energy ?? 0)}
            labels={DEMO_SECTIONS.map((s) => s.text)}
            marked={DEMO_SECTIONS.findIndex((s) => s.tag === loop)}
            table
            data-testid="chart-sections"
          />
          <Caption>Energy by bar (16 bars), under the ribbon</Caption>
          <LineChart
            label="Energy by bar"
            values={BAR_ENERGY}
            labels={BAR_LABELS}
            height={64}
            marked={bar}
            data-testid="chart-bars"
          />
          <Caption>Empty</Caption>
          <LineChart label="Energy" values={[]} empty="Run the code to see its energy curve." />
        </Specimen>

        <Specimen
          id="w5-scope"
          title="ScopeFrame"
          sub="Oak's frame for the scope, the spectrum and the probes: axes, grid, an empty state, a redraw loop."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <ScopeFrame
              label="Scope: a sawtooth, still"
              x={{ scale: "linear", min: 0, max: 2, unit: "", label: "Periods", ticks: [0, 0.5, 1, 1.5, 2] }}
              y={{ scale: "linear", min: -1, max: 1, unit: "", label: "Level", ticks: [-1, 0, 1] }}
              description="Six harmonics at 1, 1/2 … 1/6: the ramp of a sawtooth."
              frameKey="saw"
              draw={(ctx, p) => {
                ctx.strokeStyle = p.colours.line;
                ctx.lineWidth = 2;
                sinePath(ctx, p.width, p.y, (x) => sawAt(x * 2));
              }}
              data-testid="scope-saw"
            />
            <ScopeFrame
              label="Scope: the wave of what plays"
              x={{ scale: "linear", min: 0, max: 10, unit: "ms", label: "Time" }}
              y={{ scale: "linear", min: -1, max: 1, unit: "", label: "Level", ticks: [-1, 0, 1] }}
              live={live}
              empty={live ? null : "Press Play to see the wave"}
              header={
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Live</span>
                  <Button size="sm" onClick={() => setLive((l) => !l)} aria-pressed={live}>
                    {live ? "Stop" : "Play"}
                  </Button>
                </div>
              }
              draw={(ctx, p) => {
                ctx.strokeStyle = p.colours.line;
                ctx.lineWidth = 2;
                const wobble = 0.85 + 0.1 * Math.sin(p.t / 400);
                sinePath(ctx, p.width, p.y, (x) => wobble * Math.sin(2 * Math.PI * 2.2 * x));
              }}
              data-testid="scope-live"
            />
            <ScopeFrame
              label="Spectrum: the harmonics of a sawtooth on A2"
              x={{
                scale: "log",
                min: 50,
                max: 2000,
                unit: "Hz",
                label: "Frequency",
                ticks: [55, 110, 220, 440, 880, 1760],
              }}
              y={{ scale: "linear", min: -36, max: 0, unit: "dB", label: "Level", ticks: [-36, -24, -12, 0] }}
              description="A2 is 110 Hz; its harmonics sit at 220, 330, 440 … each quieter than the last."
              frameKey="harmonics"
              draw={(ctx, p) => {
                ctx.fillStyle = p.colours.line;
                SAW.forEach((a, i) => {
                  const f = 110 * (i + 1);
                  const db = Math.max(-36, 20 * Math.log10(a));
                  const x = p.x(f);
                  ctx.fillRect(x - 3, p.y(db), 6, p.height - p.y(db));
                });
              }}
              data-testid="scope-spectrum"
            />
            <ScopeFrame
              label="Filter probe: the low-pass curve"
              x={{ scale: "log", min: 20, max: 20_000, unit: "Hz", label: "Frequency" }}
              y={{
                scale: "linear",
                min: -48,
                max: 12,
                unit: "dB",
                label: "Gain",
                ticks: [-48, -36, -24, -12, 0, 12],
              }}
              description={`.lpf(${cutoff}) with resonance ${q}: frequencies above the cutoff fall away.`}
              frameKey={`${cutoff}:${q}`}
              draw={(ctx, p) => {
                ctx.strokeStyle = p.colours.line2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(p.x(cutoff), 0);
                ctx.lineTo(p.x(cutoff), p.height);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.strokeStyle = p.colours.line;
                ctx.lineWidth = 2;
                ctx.beginPath();
                FREQS.forEach((f, i) => {
                  const yy = p.y(Math.max(-48, Math.min(12, filter[i] ?? -48)));
                  if (i === 0) ctx.moveTo(p.x(f), yy);
                  else ctx.lineTo(p.x(f), yy);
                });
                ctx.stroke();
              }}
              data-testid="scope-filter"
            />
          </div>
        </Specimen>

        <Specimen
          id="w5-controls"
          title="ControlReadout"
          sub="A labelled value and a slider on the control's own scale; arrows, Alt for fine steps, Shift for coarse."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <ControlReadout
              label="Cutoff"
              code="lpf"
              unit="Hz"
              scale="log"
              min={20}
              max={20_000}
              value={cutoff}
              onChange={setCutoff}
              defaultValue={800}
              help="Lower lets less of the top through: the sound gets darker."
              data-testid="control-cutoff"
            />
            <ControlReadout
              label="Resonance"
              code="lpq"
              scale="linear"
              min={0}
              max={20}
              step={0.5}
              fine={0.1}
              coarse={5}
              value={q}
              onChange={setQ}
              defaultValue={1}
              help="A peak at the cutoff: higher rings."
              data-testid="control-q"
            />
            <ControlReadout
              label="Attack"
              code="attack"
              unit="s"
              scale="linear"
              min={0}
              max={1}
              step={0.01}
              fine={0.001}
              coarse={0.1}
              value={attack}
              onChange={setAttack}
              data-testid="control-attack"
            />
            <ControlReadout
              label="Release"
              code="release"
              unit="s"
              scale="linear"
              min={0}
              max={2}
              step={0.05}
              fine={0.01}
              coarse={0.5}
              value={release}
              onChange={setRelease}
              data-testid="control-release"
            />
            <ControlReadout
              label="Delay feedback"
              code="delayfeedback"
              scale="linear"
              min={0}
              max={0.98}
              step={0.01}
              value={0.5}
              onChange={() => {}}
              disabled
              help="Opens with the side lesson “Space”."
            />
          </div>
          <ScopeFrame
            label="Envelope probe"
            x={{
              scale: "linear",
              min: 0,
              max: 2.6,
              unit: "s",
              label: "Time",
              ticks: [0, 0.5, 1, 1.5, 2, 2.5],
            }}
            y={{ scale: "linear", min: 0, max: 1, unit: "", label: "Level", ticks: [0, 0.5, 1] }}
            height={120}
            description={`Attack ${attack} s, release ${release} s, a note held half a second.`}
            frameKey={`${attack}:${release}`}
            draw={(ctx, p) => {
              ctx.strokeStyle = p.colours.line;
              ctx.lineWidth = 2;
              ctx.beginPath();
              envPts.forEach(([t, l], i) => {
                if (i === 0) ctx.moveTo(p.x(t), p.y(l));
                else ctx.lineTo(p.x(t), p.y(l));
              });
              ctx.stroke();
            }}
            data-testid="scope-envelope"
          />
        </Specimen>
      </div>
    </SpecimenLevel.Provider>
  );
}

/** Mounts the gallery on any element (no router needed); returns the unmount. */
export function mountKitWave5(host: HTMLElement): () => void {
  const root = createRoot(host);
  root.render(
    <StrictMode>
      <QueryClientProvider client={createQueryClient()}>
        <KitWave5 />
        <Toaster />
      </QueryClientProvider>
    </StrictMode>,
  );
  return () => root.unmount();
}
