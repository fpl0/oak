// Static analysis mode (architecture §2.2 "Analysis path"): evaluate WITHOUT playing through the browser
// grader host, so the roll and the staff show code that has not been run. Debounced on edits (300 ms),
// immediate after an evaluation. A failed analysis keeps the last good model on screen (Strudel keeps
// playing the last good pattern too) and reports the error beside it. The Band is what the editor plays: a plain
// Band through `bandCodeFor` (key and form follow, register fold) with its tracks kept by label, a unit song
// composed in the grader's realm by the adapter's own composer (spec §5.2).

import type { KeySpec, LintContext, MeterId, PickupSpec } from "@oak/content-kit";
import type { GraderErrorInfo, GraderHost } from "@oak/grader";
import type { StaffKind } from "@oak/notation";
import { type BandSetup, bandCodeFor, type SongBand, songBandToWire } from "@oak/strudel";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildModel, type WorkbenchModel } from "./model.ts";

export interface AnalysisOptions {
  bars: number;
  meter: MeterId;
  key: KeySpec | null;
  lint: LintContext;
  band: BandSetup | null;
  staff: StaffKind | false;
  staffLabels: "none" | "degree" | "solfege" | "counts";
  debounceMs: number;
  /** A declared pickup (Wave 4): the harmony's bars and the staff's first bar follow it. */
  pickup?: PickupSpec | null;
  /** The Band parts heard (the step's tracks less the muted ones); the harmony reads only these. */
  bandHeard?: readonly string[] | null;
  /** The tempo a Band's leftover `{{bpm}}` takes when the code sets none (`lessonCtx.defaultBpm`). Default 120. */
  defaultBpm?: number;
  /** Wave 7: chord symbols on the staff in jazz glyphs (`tb.feature.jazz-glyphs`). */
  chordStyle?: "lead-sheet" | "jazz";
}

export interface AnalysisState {
  model: WorkbenchModel | null;
  /** The code the model was built from. */
  code: string | null;
  error: GraderErrorInfo | null;
  /** The code the error belongs to. */
  errorCode: string | null;
  pending: boolean;
}

const INITIAL: AnalysisState = { model: null, code: null, error: null, errorCode: null, pending: false };

/** What makes a song analyse differently: its version and style, tempo, takes, who owns each cell, today's Make. */
function songShape(song: SongBand): string {
  const grid = [...song.grid].map(([cell, owner]) => `${cell}=${owner}`).join(",");
  const live = song.live ? `${song.live.step.lesson}:${[song.live.sections].flat().join("+")}` : "";
  const takes = song.sources.map((s) => `${s.sourceId}:${s.code.length}`).join(",");
  return `${song.def.id}@${song.def.version}|${song.flavour}|${song.bpm}|${takes}|${grid}|${live}|${song.oakCode?.length ?? ""}`;
}

export function useAnalysis(
  grader: GraderHost | null,
  code: string,
  opts: AnalysisOptions,
): AnalysisState & { analyzeNow(code: string): void } {
  const [state, setState] = useState<AnalysisState>(INITIAL);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(
    (src: string) => {
      if (!grader) return;
      const o = optsRef.current;
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      const my = ++seq.current;
      setState((s) => ({ ...s, pending: true }));
      const evalOpts = {
        mode: "lesson" as const,
        bars: o.bars,
        lint: o.lint,
        meter: o.meter,
        // What the editor plays: the roll, the chips and the harmony show it. A plain Band keeps only the parts
        // the step asked for (by label); a unit song is composed around this code as the live Make.
        ...(o.band?.song
          ? { song: songBandToWire(o.band.song) }
          : o.band
            ? {
                band: bandCodeFor(o.band, { key: o.key, defaultBpm: o.defaultBpm ?? 120, learnerCode: src }),
                bandTracks: o.band.tracks,
              }
            : {}),
      };
      grader
        .analyze(src, evalOpts, ctl.signal)
        .then((result) => {
          // An aborted analysis (a newer one, or StrictMode's unmount) says nothing about the code.
          if (my !== seq.current || ctl.signal.aborted) return;
          const out = buildModel(src, result, {
            meter: o.meter,
            key: o.key,
            staff: o.staff,
            staffLabels: o.staffLabels,
            pickup: o.pickup ?? null,
            bandHeard: o.bandHeard ?? null,
            ...(o.chordStyle ? { chordStyle: o.chordStyle } : {}),
          });
          if (out.ok) setState({ model: out.model, code: src, error: null, errorCode: null, pending: false });
          else setState((s) => ({ ...s, error: out.error, errorCode: src, pending: false }));
        })
        .catch((err: unknown) => {
          if (my !== seq.current || ctl.signal.aborted) return;
          const message = err instanceof Error ? err.message : String(err);
          setState((s) => ({ ...s, error: { kind: "internal", message }, errorCode: src, pending: false }));
        });
    },
    [grader],
  );

  // Debounced on edits; the first analysis of a mounted workbench runs at once.
  const first = useRef(true);
  useEffect(() => {
    if (!grader) return;
    if (first.current) {
      first.current = false;
      run(code);
      return;
    }
    const t = setTimeout(() => run(code), optsRef.current.debounceMs);
    return () => clearTimeout(t);
  }, [grader, code, run]);

  // Re-analyse when what shapes the model changes (key, meter, bars, band, staff kind) or what the lint allows
  // (the learner's unlocked set often arrives after the first analysis: without this the "locked" errors of an
  // empty set stay on screen).
  const lintKey = `${opts.lint.profile}|${opts.lint.allowPreview}|${[...opts.lint.unlocked].sort().join(",")}`;
  const shape = `${opts.bars}|${opts.meter}|${opts.key?.tonic}:${opts.key?.mode}|${opts.band?.code ?? ""}:${opts.band?.tracks.join("+") ?? ""}|${opts.band?.song ? songShape(opts.band.song) : ""}|${opts.staff}|${opts.staffLabels}|${opts.pickup ? opts.pickup.units.join("/") : ""}|${opts.bandHeard?.join("+") ?? "*"}|${opts.chordStyle ?? ""}|${lintKey}`;
  const lastShape = useRef(shape);
  useEffect(() => {
    if (lastShape.current === shape) return;
    lastShape.current = shape;
    run(code);
    // eslint-style: `code` is read at the time of the shape change on purpose
  }, [shape, run, code]);

  useEffect(
    () => () => {
      abort.current?.abort();
      // A remount (StrictMode in dev, or a kept-alive view) analyses at once again instead of waiting for
      // the debounce with the aborted run's state on screen.
      first.current = true;
    },
    [],
  );

  return { ...state, analyzeNow: run };
}
