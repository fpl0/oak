// TransportBar (ux §3.4, 44 px): play/stop, the bar.beat counter from the adapter's clock, the tempo the
// code's own setcpm set, meter and key, the practice tempo, and one mute/solo chip per track label (the
// adapter's live mute: the code is never rewritten).
import type { KeySpec, MeterSpec } from "@oak/content-kit";
import type { MuteMap } from "@oak/strudel";
import { useEffect, useRef } from "react";
import { defaultTrackLabel } from "./chip-words.ts";
import type { WorkbenchClock } from "./clock.ts";
import { keyName } from "./key-tools.ts";
import type { RegionStep } from "./loop-math.ts";
import { beatOf } from "./metronome.ts";
import { barBeat, bpmText, chipState, type PracticeTempo } from "./transport-math.ts";

/** The loop region control (`L`, `[`/`]`, `Shift+[`/`Shift+]`). */
export interface TransportLoop {
  on: boolean;
  /** "bars 1–2". */
  label: string;
  onToggle(): void;
  onStep(step: RegionStep): void;
  can: Record<RegionStep, boolean>;
}

/** One switch of the lens bar: a note-label lens (`D`, `S`, `Shift+N`) or a panel (`Shift+K`, `Shift+C`). */
export interface TransportSwitch {
  id: string;
  label: string;
  on: boolean;
  /** The shortcut, in the keymap's syntax ("D", "Shift+N"). */
  keys: string;
  /** What the switch does, for its tooltip. */
  title: string;
}

/** The lens bar (Wave 3): label lenses and the key panels, each only once unlocked. */
export interface TransportLenses {
  labels: TransportSwitch[];
  panels: TransportSwitch[];
  /** Wave 7: the advanced tracks' lenses (tensions, voicings, chord-scales, clave, pulse lanes, …), each once open. */
  track?: TransportSwitch[];
  onToggle(id: string): void;
}

/** The metronome control (`M`) and its visual twin (a beat dot per tempo unit). */
export interface TransportMetronome {
  on: boolean;
  onToggle(): void;
}

export interface TransportBarProps {
  playing: boolean;
  busy?: boolean;
  onToggle(): void;
  clock: WorkbenchClock;
  meter: MeterSpec;
  /** cps of the analysed or playing code; null before the first analysis. */
  cps: number | null;
  /** True when the code never set a tempo (the default 0.5 cps applies). */
  cpsDefault?: boolean;
  loopBars: number;
  keySpec: KeySpec | null;
  tracks: readonly string[];
  /** The words on a track's chip (a unit song: "Kick (Oak)", "Drums (yours, from …)"). Default: `defaultTrackLabel`. */
  trackLabel?(track: string): string;
  /** Wave 5: a badge per track label ("Swing 8ths" on a swung track, contracts §6.10). */
  badges?: ReadonlyMap<string, string>;
  mutes: MuteMap;
  onMute(label: string): void;
  onSolo(label: string): void;
  practiceTempo: PracticeTempo;
  onPracticeTempo(): void;
  readOnly?: boolean;
  /**
   * Play/stop, the bar counter and the mute chips only: no tempo, metre, key, practice speed, solo or read-only
   * badge (onboarding's first loop, Workbench `transport="minimal"`).
   */
  minimal?: boolean;
  /** Loop region (absent: no loop control). */
  loop?: TransportLoop;
  /** Metronome (absent: no metronome control). */
  metronome?: TransportMetronome;
  /** Lens switches and panel toggles (absent: none, e.g. inside a lesson step or before U03.L02). */
  lenses?: TransportLenses;
}

function SwitchGroup({
  label,
  items,
  onToggle,
  testId,
}: {
  label: string;
  items: TransportSwitch[];
  onToggle(id: string): void;
  testId: string;
}) {
  if (items.length === 0) return null;
  return (
    <fieldset className="oak-lens-switch" data-testid={testId}>
      <legend className="oak-lens-switch-label">{label}</legend>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className="oak-toggle oak-toggle--small"
          aria-pressed={it.on}
          aria-keyshortcuts={it.keys || undefined}
          onClick={() => onToggle(it.id)}
          title={it.keys ? `${it.title} (${it.keys})` : it.title}
          data-testid={`lens-${it.id}`}
        >
          {it.label}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * The panel switches that draw on the roll rather than open a panel: the Toolbox files them as lenses, so the
 * lens bar groups them under "Lenses" with the tracks' lenses, and "Panels" keeps what opens beside the music.
 */
const ROLL_LENS_PANELS: ReadonlySet<string> = new Set(["function", "chord-tones", "range"]);

// A chip's words without a host label ("Bass (Oak)", "Drums"): one rule with the song Make's, in chip-words.ts.
export { defaultTrackLabel };

/** The mute half's tooltip: what a click will do, and why the part is silent when another part is soloed. */
export function chipMuteTitle(label: string, state: "on" | "muted" | "solo" | "silenced"): string {
  if (state === "muted") return `${label} is muted: click to hear it again`;
  if (state === "silenced") return `${label} is silent while another part is soloed`;
  return `Mute ${label}`;
}

/** The muted mark: a struck speaker, so a muted part reads differently from one silenced by another's solo. */
function SpeakerOff() {
  return (
    <svg
      className="oak-chip-muted-mark"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      data-testid="chip-muted-mark"
    >
      <path d="M1 4.5h2l3-2.5v8L3 7.5H1z" fill="currentColor" />
      <path d="M8 4l3 4M11 4l-3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function keyText(k: KeySpec | null): string | null {
  return k ? keyName(k) : null;
}

export function TransportBar(p: TransportBarProps) {
  const counter = useRef<HTMLSpanElement>(null);
  const lastText = useRef("");
  useEffect(() => {
    const paint = () => {
      const f = p.clock.get();
      const text = barBeat(f.playing ? f.audibleCycle : 0, p.meter, p.loopBars).text;
      if (text !== lastText.current && counter.current) {
        counter.current.textContent = text;
        lastText.current = text;
      }
    };
    paint();
    return p.clock.subscribe(paint);
  }, [p.clock, p.meter, p.loopBars]);

  // The metronome's visual twin: one dot per tempo unit, the current beat lit while playing.
  const beats = useRef<HTMLSpanElement>(null);
  const metronomeOn = p.metronome?.on ?? false;
  useEffect(() => {
    if (!metronomeOn) return;
    let last = -2;
    const paint = () => {
      const f = p.clock.get();
      const beat = f.playing ? beatOf(f.audibleCycle, p.meter.unitsPerBar) : -1;
      if (beat === last || !beats.current) return;
      last = beat;
      beats.current.querySelectorAll("i").forEach((dot, i) => {
        dot.dataset.on = i === beat ? "1" : "0";
      });
    };
    paint();
    return p.clock.subscribe(paint);
  }, [p.clock, p.meter, metronomeOn]);

  const bpm = p.cps ? bpmText(p.cps * p.practiceTempo, p.meter) : null;
  return (
    <div className="oak-transport" role="toolbar" aria-label="Transport" data-testid="transport">
      <button
        type="button"
        className="oak-play"
        // aria-disabled, not disabled: Chromium moves the focus of a disabled button to <body>, so a keyboard
        // learner pressing Enter on Play would lose their place while the audio starts.
        onClick={p.busy ? undefined : p.onToggle}
        aria-disabled={p.busy || undefined}
        aria-busy={p.busy || undefined}
        aria-pressed={p.playing}
        data-testid="play-toggle"
        aria-label={p.playing ? "Stop" : "Play"}
      >
        {p.playing ? "■" : "▶"}
      </button>
      <span className="oak-counter" ref={counter} data-testid="bar-counter" aria-live="off">
        1.1 / {p.loopBars}
      </span>
      {p.minimal ? null : (
        <>
          <span className="oak-tempo" data-testid="tempo">
            {/* No tempo until the code has run once: show the meter alone rather than a dash. */}
            {bpm ? `${bpm} BPM · ` : ""}
            {p.meter.id}
            {p.cpsDefault ? (
              <span className="oak-muted" title="No setcpm line: Strudel's default tempo">
                {" "}
                (default)
              </span>
            ) : null}
          </span>
          {keyText(p.keySpec) ? (
            <span className="oak-key-name" data-testid="transport-key">
              {keyText(p.keySpec)}
            </span>
          ) : null}
          <button
            type="button"
            className="oak-link-button"
            onClick={p.onPracticeTempo}
            title="Practice tempo (the code is untouched)"
          >
            Practice {Math.round(p.practiceTempo * 100)}%
          </button>
        </>
      )}
      {p.loop ? (
        <span className="oak-loop-step" data-testid="loop-control">
          <button
            type="button"
            className="oak-toggle"
            aria-pressed={p.loop.on}
            onClick={p.loop.onToggle}
            title="Loop a region (L; [ and ] change its length, Shift+[ and Shift+] move it)"
            data-testid="loop-toggle"
          >
            Loop {p.loop.label}
          </button>
          <button
            type="button"
            aria-label="Loop one bar shorter"
            title="Shorter ([)"
            disabled={!p.loop.can.shrink}
            onClick={() => p.loop?.onStep("shrink")}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Loop one bar longer"
            title="Longer (])"
            disabled={!p.loop.can.extend}
            onClick={() => p.loop?.onStep("extend")}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Move the loop one bar earlier"
            title="Earlier (Shift+[)"
            disabled={!p.loop.can.earlier}
            onClick={() => p.loop?.onStep("earlier")}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Move the loop one bar later"
            title="Later (Shift+])"
            disabled={!p.loop.can.later}
            onClick={() => p.loop?.onStep("later")}
          >
            ›
          </button>
        </span>
      ) : null}
      {p.metronome ? (
        <button
          type="button"
          className="oak-toggle"
          aria-pressed={p.metronome.on}
          onClick={p.metronome.onToggle}
          title="Metronome (M): a click on every beat, never written into the code"
          data-testid="metronome-toggle"
        >
          Metronome
          {p.metronome.on ? (
            <span className="oak-beats" ref={beats} aria-hidden data-testid="metronome-beats">
              {Array.from({ length: Math.max(1, Math.round(p.meter.unitsPerBar)) }, (_, i) => (
                <i key={i} data-accent={i === 0 ? "1" : "0"} data-on="0" />
              ))}
            </span>
          ) : null}
        </button>
      ) : null}
      {p.lenses ? (
        <>
          <SwitchGroup
            label="Labels"
            items={p.lenses.labels}
            onToggle={p.lenses.onToggle}
            testId="lens-switch"
          />
          <SwitchGroup
            label="Panels"
            items={p.lenses.panels.filter((it) => !ROLL_LENS_PANELS.has(it.id))}
            onToggle={p.lenses.onToggle}
            testId="panel-switch"
          />
          <SwitchGroup
            label="Lenses"
            items={[
              ...p.lenses.panels.filter((it) => ROLL_LENS_PANELS.has(it.id)),
              ...(p.lenses.track ?? []),
            ]}
            onToggle={p.lenses.onToggle}
            testId="roll-lens-switch"
          />
        </>
      ) : null}
      <span className="oak-chips">
        {p.tracks.map((t) => {
          const st = chipState(t, p.mutes);
          // One name for the part in the words, the tooltips and what a screen reader says: never the raw track id.
          const label = p.trackLabel ? p.trackLabel(t) : defaultTrackLabel(t);
          // The learner's own mute stays visible while another part is soloed (it applies again after the solo).
          const userMuted = p.mutes.muted.has(t);
          return (
            <span
              key={t}
              className={`oak-track-chip ${st}${userMuted && st !== "muted" ? " user-muted" : ""}`}
              data-track={t}
              data-state={st}
            >
              <button
                type="button"
                aria-pressed={userMuted}
                aria-label={`Mute ${label}`}
                onClick={() => p.onMute(t)}
                title={chipMuteTitle(label, userMuted ? "muted" : st)}
                data-testid={`mute-${t}`}
              >
                {userMuted ? <SpeakerOff /> : null}
                {label}
              </button>
              {p.badges?.get(t) ? (
                <span
                  className="oak-swing-badge"
                  data-testid={`swing-${t}`}
                  title="This line swings: its off-beats land late"
                >
                  {p.badges.get(t)}
                </span>
              ) : null}
              {p.minimal ? null : (
                <button
                  type="button"
                  aria-pressed={st === "solo"}
                  aria-label={`Solo ${label}`}
                  onClick={() => p.onSolo(t)}
                  title={
                    st === "solo"
                      ? `Stop soloing ${label}: hear every part again`
                      : `Solo ${label}: hear only this part`
                  }
                  data-testid={`solo-${t}`}
                >
                  S
                </button>
              )}
            </span>
          );
        })}
      </span>
      {p.readOnly && !p.minimal ? <span className="oak-badge">read-only</span> : null}
    </div>
  );
}
