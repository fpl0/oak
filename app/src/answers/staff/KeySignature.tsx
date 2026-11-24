// Key-signature builder (`staff-input` with `mode: "key-signature"`, U03.L06–L07, U03.CP): place a key's sharps or
// flats on the staff one at a time, in the order they are written. (A circle of fifths that filled the whole
// signature in from one click on the asked key answered the question for the learner: it is gone.) The
// value is the accidentals in the order placed ("F# C#"); the host sends them as `answer.text`. Pointer: a ghost
// sharp or flat follows the lines and spaces, a click adds that letter's accidental. Keys: letters add, `#`/`+`
// and `-` switch sharps and flats, Backspace removes the last, Enter checks. Once checked, the line under the
// staff reads the signature back ("Reads as D major or B minor").
import "./staff.css";
import { renderStaff } from "@oak/notation/render";
import { clsx } from "clsx";
import { Undo2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Skeleton } from "../../ui/kit/index.ts";
import { useSubmitVerb } from "../env.tsx";
import {
  accidentalGlyph,
  letterOfDia,
  parseSignatureValue,
  readSignature,
  signatureDia,
  signatureValue,
} from "../keys/circle.ts";
import type { AnswerWidgetProps } from "../types.ts";
import { AnswerFrame, isMod, KeyHint, markOf, revealedOf, SubmitHint } from "../ui.tsx";
import { type StaffSpec, TOP_LINE_DIA } from "./model.ts";

type Kind = "sharp" | "flat";

interface Band {
  clef: "treble" | "bass";
  topLineY: number;
  lineSpacing: number;
  y0: number;
  y1: number;
  /** Where the first accidental goes (after the clef). */
  x0: number;
  x1: number;
}

/** An empty staff with just the clef(s): the signature is drawn above it. */
function emptyStaffAbc(clef: StaffSpec["clef"]): string {
  if (clef === "grand")
    return "X:1\nL:1/4\n%%score {RH LH}\nV:RH clef=treble\nV:LH clef=bass\nK:C\nV:RH\nx8 |]\nV:LH\nx8 |]\n";
  return `X:1\nL:1/4\nK:C clef=${clef}\nx8 |]\n`;
}

const SHARP_PATH = (s: number) =>
  `M${-0.35 * s} ${-1.1 * s} V${1.4 * s} M${0.35 * s} ${-1.4 * s} V${1.1 * s} M${-0.75 * s} ${-0.25 * s} L${0.75 * s} ${-0.55 * s} M${-0.75 * s} ${0.55 * s} L${0.75 * s} ${0.25 * s}`;
const FLAT_PATH = (s: number) =>
  `M${-0.35 * s} ${-1.9 * s} V${0.55 * s} C${0.3 * s} ${0.1 * s} ${0.75 * s} ${-0.25 * s} ${0.45 * s} ${-0.55 * s} C${0.2 * s} ${-0.8 * s} ${-0.1 * s} ${-0.55 * s} ${-0.35 * s} ${-0.3 * s}`;

function AccidentalGlyph({
  kind,
  x,
  y,
  s,
  className,
}: {
  kind: Kind;
  x: number;
  y: number;
  s: number;
  className?: string;
}) {
  return (
    <path
      d={kind === "sharp" ? SHARP_PATH(s) : FLAT_PATH(s)}
      transform={`translate(${x} ${y})`}
      className={className}
      fill="none"
      strokeWidth={kind === "sharp" ? Math.max(1.2, s * 0.16) : Math.max(1.3, s * 0.18)}
      strokeLinecap="round"
    />
  );
}

export function KeySignatureAnswer(p: AnswerWidgetProps<"staff-input">) {
  const verb = useSubmitVerb();
  const { spec, value, onChange, disabled, feedback } = p;
  const accs = parseSignatureValue(value);
  const [kind, setKind] = useState<Kind>(() => (accs[0]?.endsWith("b") ? "flat" : "sharp"));
  const [bands, setBands] = useState<Band[] | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hover, setHover] = useState<{ band: Band; step: number } | null>(null);
  const [cursorDia, setCursorDia] = useState(TOP_LINE_DIA.treble);
  const [focused, setFocused] = useState(false);
  const [say, setSay] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const checked = feedback.state !== "idle" && feedback.state !== "pending";
  const revealed = revealedOf<string>(feedback);
  const reading = readSignature(accs);

  useEffect(() => {
    if (p.autoFocus) surface.current?.focus({ preventScroll: true });
  }, [p.autoFocus]);

  const remeasure = useRef<() => void>(() => {});
  remeasure.current = () => {
    const w = wrap.current;
    const h = host.current;
    if (!w || !h) return;
    const o = w.getBoundingClientRect();
    const staves = [...h.querySelectorAll("g.abcjs-staff")].map((g, i) => {
      const r = g.getBoundingClientRect();
      const clef: "treble" | "bass" =
        spec.clef === "grand" ? (i === 0 ? "treble" : "bass") : spec.clef === "bass" ? "bass" : "treble";
      const extra = [...h.querySelectorAll(`.abcjs-staff-extra.abcjs-v${i}`)].map(
        (e) => e.getBoundingClientRect().right,
      );
      const spacing = r.height / 4;
      return {
        clef,
        topLineY: r.top - o.top,
        lineSpacing: spacing,
        y0: r.top - o.top - 4 * spacing,
        y1: r.bottom - o.top + 4 * spacing,
        x0: Math.max(r.left, ...extra) - o.left + spacing * 1.2,
        x1: r.right - o.left,
      };
    });
    if (staves.length === 2) {
      const [a, b] = staves as [Band, Band];
      const mid = (a.topLineY + 4 * a.lineSpacing + b.topLineY) / 2;
      a.y1 = mid;
      b.y0 = mid;
    }
    setBands(staves);
    setSize({ w: o.width, h: o.height });
  };

  useEffect(() => {
    const h = host.current;
    if (!h) return;
    let cancelled = false;
    renderStaff(h, emptyStaffAbc(spec.clef), {
      // Drawn large: at abcjs's default scale a line was 8 px from the next, too fine to hit by mouse.
      params: { staffwidth: 250, scale: 1.5, stretchlast: true, paddingtop: 14, paddingbottom: 14 } as never,
    })
      .then(() => {
        if (cancelled) return;
        h.querySelector("svg")?.setAttribute("aria-hidden", "true");
        for (const el of h.querySelectorAll("[tabindex]")) el.removeAttribute("tabindex");
        setStatus("ready");
        remeasure.current();
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [spec.clef]);
  useEffect(() => {
    const w = wrap.current;
    if (!w || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => remeasure.current());
    ro.observe(w);
    return () => ro.disconnect();
  }, []);

  const add = (letter: string) => {
    if (disabled) return;
    const acc = `${letter}${kind === "sharp" ? "#" : "b"}`;
    if (accs.includes(acc)) {
      setSay(`${accidentalGlyph(acc)} is already there.`);
      return;
    }
    if (accs.length >= 7) {
      setSay("A key signature has at most seven.");
      return;
    }
    const next = [...accs, acc];
    onChange(signatureValue(next));
    setSay(`${accidentalGlyph(acc)} added. ${next.map(accidentalGlyph).join(" ")}.`);
  };
  const removeLast = () => {
    if (disabled || accs.length === 0) return;
    const last = accs[accs.length - 1] as string;
    onChange(signatureValue(accs.slice(0, -1)));
    setSay(`${accidentalGlyph(last)} removed.`);
  };

  const onKey = (e: React.KeyboardEvent<HTMLElement>): boolean => {
    if (!(e.target as HTMLElement).closest("[data-staff-surface]")) return false;
    if (isMod(e) || e.altKey) return false;
    if (e.key === "#" || e.key === "+") {
      setKind("sharp");
      setSay("Sharps.");
      return true;
    }
    if (e.key === "-") {
      setKind("flat");
      setSay("Flats.");
      return true;
    }
    if (/^[a-gA-G]$/.test(e.key)) {
      add(e.key.toUpperCase());
      return true;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const dia = cursorDia + (e.key === "ArrowUp" ? 1 : -1);
      setCursorDia(dia);
      setHover(null);
      setSay(`${letterOfDia(dia)} line or space`);
      return true;
    }
    if (e.key === "Insert" || e.key === ".") {
      add(letterOfDia(cursorDia));
      return true;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      removeLast();
      return true;
    }
    return false;
  };

  const local = (e: React.PointerEvent) => {
    const r = wrap.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };
  const bandAt = (y: number) =>
    bands?.find((b) => y >= b.y0 && y <= b.y1) ??
    bands?.reduce((a, b) =>
      Math.abs(y - (b.topLineY + 2 * b.lineSpacing)) < Math.abs(y - (a.topLineY + 2 * a.lineSpacing)) ? b : a,
    );
  const onPointerMove = (e: React.PointerEvent) => {
    if (disabled || !bands) return;
    const pt = local(e);
    const band = bandAt(pt.y);
    if (!band) return setHover(null);
    const step = Math.max(-3, Math.min(11, Math.round(((pt.y - band.topLineY) * 2) / band.lineSpacing)));
    setHover({ band, step });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (disabled || !bands || e.button !== 0) return;
    const pt = local(e);
    const band = bandAt(pt.y);
    if (!band) return;
    const step = Math.max(-3, Math.min(11, Math.round(((pt.y - band.topLineY) * 2) / band.lineSpacing)));
    const dia = TOP_LINE_DIA[band.clef] - step;
    setCursorDia(dia);
    add(letterOfDia(dia));
  };

  const accKind = (a: string): Kind => (a.endsWith("#") ? "sharp" : "flat");
  const marks = accs.map((_, i) => markOf(feedback, i));
  // One glyph's width and a gap apart: at 1.15 spaces the second sharp sat on top of the first.
  const nextX = (b: Band, i: number) => b.x0 + i * b.lineSpacing * 2.3;
  const ghostBand =
    hover?.band ??
    (focused && bands
      ? bands.find(
          (b) =>
            b.clef ===
            (cursorDia < 28 && spec.clef !== "treble" ? "bass" : spec.clef === "bass" ? "bass" : "treble"),
        )
      : null);
  const ghostStep = hover ? hover.step : ghostBand ? TOP_LINE_DIA[ghostBand.clef] - cursorDia : 0;

  return (
    <AnswerFrame
      kind="staff-input"
      // Its letters, arrows and Enter are the staff's own: a host's page keys (Enter = Continue, H = hint)
      // stay out of it, and the typed alternative's disclosure opens with Enter.
      keyscope="staff-input"
      idBase={p.idBase}
      label={p.label}
      feedback={feedback}
      disabled={disabled}
      onSubmit={p.onSubmit}
      onKey={onKey}
      keys={
        <>
          <KeyHint keys={["A–G"]}>add that letter's sharp or flat</KeyHint>
          <KeyHint keys={["#", "-"]}>sharps / flats</KeyHint>
          <KeyHint keys={["⌫"]}>remove the last</KeyHint>
          <SubmitHint />
        </>
      }
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-col gap-2" style={{ width: "min(100%, 26rem)" }}>
          <div className="flex flex-wrap items-center gap-2">
            {/* biome-ignore lint/a11y/useSemanticElements: two toggle buttons */}
            <div role="group" aria-label="Sharps or flats" className="flex gap-1">
              {(["sharp", "flat"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  data-enter="native"
                  aria-pressed={kind === k}
                  disabled={disabled}
                  onClick={() => {
                    setKind(k);
                    surface.current?.focus({ preventScroll: true });
                  }}
                  className={clsx(
                    "inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-sm",
                    kind === k
                      ? "border-text bg-surface-2 text-text"
                      : "border-border bg-surface text-text-2",
                  )}
                >
                  <span aria-hidden className="text-base leading-none">
                    {k === "sharp" ? "♯" : "♭"}
                  </span>
                  {k === "sharp" ? "Sharps" : "Flats"}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              data-enter="native"
              icon={<Undo2 aria-hidden className="size-4" />}
              disabled={disabled || accs.length === 0}
              onClick={removeLast}
            >
              Remove last
            </Button>
          </div>
          <div
            ref={wrap}
            className="relative w-full rounded-card border border-border bg-surface"
            style={{ minHeight: spec.clef === "grand" ? 290 : 160 }}
            data-status={status}
          >
            <div ref={host} className="oak-si-host px-2" />
            {status === "loading" ? (
              <div className="absolute inset-0 p-3">
                <Skeleton className="h-full w-full" label="Drawing the staff" />
              </div>
            ) : null}
            {bands ? (
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-visible"
                width={size.w}
                height={size.h}
              >
                {bands.map((b) =>
                  accs.map((a, i) => {
                    const dia = signatureDia(a, b.clef);
                    const y = b.topLineY + ((TOP_LINE_DIA[b.clef] - dia) * b.lineSpacing) / 2;
                    const m = marks[i];
                    return (
                      <AccidentalGlyph
                        key={`${b.clef}-${a}`}
                        kind={accKind(a)}
                        x={nextX(b, i)}
                        y={y}
                        s={b.lineSpacing}
                        className={m ? (m.ok ? "stroke-accent" : "stroke-issue") : "stroke-text"}
                      />
                    );
                  }),
                )}
                {ghostBand && !disabled && (hover || focused) && accs.length < 7 ? (
                  <AccidentalGlyph
                    kind={kind}
                    x={nextX(ghostBand, accs.length)}
                    y={ghostBand.topLineY + (ghostStep * ghostBand.lineSpacing) / 2}
                    s={ghostBand.lineSpacing}
                    className="stroke-text-2 opacity-60"
                  />
                ) : null}
              </svg>
            ) : null}
            <div
              ref={surface}
              data-staff-surface
              data-testid="keysig-surface"
              role="application"
              aria-roledescription="staff"
              aria-label={`${p.label}. Key signature staff`}
              aria-describedby={helpId}
              aria-disabled={disabled || undefined}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: the staff is a keyboard application (role="application")
              tabIndex={0}
              className="oak-si-surface absolute inset-0 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => setHover(null)}
            />
          </div>
          <p id={helpId} className="sr-only">
            Letters A to G add that letter's {kind}. Hash and minus switch between sharps and flats. Backspace
            removes the last one. Enter {verb === "save" ? "saves" : "checks"}.
          </p>
          <p className="sr-only" aria-live="polite" data-testid="keysig-say">
            {say}
          </p>
          <ol className="flex min-h-7 flex-wrap items-center gap-1.5 text-sm" aria-label="Your key signature">
            {accs.length === 0 ? <li className="text-text-3">Nothing placed yet.</li> : null}
            {accs.map((a, i) => {
              const m = marks[i];
              return (
                <li
                  key={a}
                  className={clsx(
                    "rounded-control border px-1.5 font-semibold tabular-nums",
                    m ? (m.ok ? "border-accent" : "border-issue") : "border-border",
                  )}
                >
                  {accidentalGlyph(a)}
                  {m ? <span className="sr-only">{m.ok ? ", right" : ", not this one"}</span> : null}
                </li>
              );
            })}
          </ol>
          <p className="min-h-6 text-sm text-text-2" data-testid="keysig-reading">
            {revealed !== null ? (
              <>
                <span>Answer: </span>
                <span className="rounded-control border-2 border-dashed border-accent-2 px-1.5 font-semibold text-text">
                  {parseSignatureValue(revealed).map(accidentalGlyph).join(" ") || "no sharps or flats"}
                </span>
              </>
            ) : checked ? (
              reading.text
            ) : null}
          </p>
        </div>
      </div>
    </AnswerFrame>
  );
}
