// "New sketch from…" (ux §2.3; Oak 2.0 W1 S2, starts.ts): the learner's own starting points first (their Blank,
// Oak's Blank at a tempo they choose, today's Make, over a Band, drums and bass first, from your head, fill it all,
// plain start, from scraps, their templates), then Oak's song templates as "Learning kits" ("Four-chord pop", …;
// studio/templates.ts). An unlocked kit is one more choice of the same radio group; a locked one says which
// capstone's release unlocks it (contracts §3.2 A). A template of the learner's that came from a backup is checked
// strictly before its sketch runs (contracts §11.3).
import type { Sketch, SketchCreate, UserTemplate } from "@oak/api";
import type { FlavourId, KeySpec, MeterId } from "@oak/content-kit";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Lock } from "lucide-react";
import { useId, useState } from "react";
import { bandMeter, bands } from "../../../content/bands/index.ts";
import { openCapture } from "../capture/store.ts";
import { useContent } from "../lib/content.ts";
import { lessonTitles, unlockSite } from "../lib/content-model.ts";
import { errorWords } from "../lib/error-words.ts";
import { formatDate } from "../lib/format.ts";
import { lintInBrowser } from "../lib/grader-client.ts";
import { apiQuery, useProfile, useSketch, useSketchCreate } from "../lib/queries.ts";
import { currentSessionId } from "../session/store.ts";
import { siteTitle } from "../toolbox/model.ts";
import { Button } from "../ui/kit/Button.tsx";
import { SegmentedControl } from "../ui/kit/Controls.tsx";
import { Dialog } from "../ui/kit/Dialog.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { BandOptions } from "./BandOptions.tsx";
import { readLength, writeLength } from "./draft.ts";
import { focusOnOpen } from "./focus.ts";
import { MyTemplates } from "./MyTemplates.tsx";
import {
  bandsForMeter,
  DEFAULT_KEY,
  MODES,
  nextSketchTitle,
  OAK_DEFAULTS,
  overBandStart,
  type SketchBand,
  STUDIO_FLAVOURS,
  strictLint,
  strictVerdict,
  studioFlavour,
  TONICS,
} from "./model.ts";
import { useUnlockedSet } from "./queries.ts";
import { START_SLOTS } from "./start-slots.ts";
import {
  blankStartBody,
  drumsAndBassCode,
  FILL_REFUSALS,
  FILL_SECTIONS,
  type FillSections,
  fillItAllCode,
  plainStartCode,
  START_DETAILS,
  START_HEADINGS,
  templateStartBody,
  templateStartDetail,
} from "./starts.ts";
import {
  type StarterSong,
  starterSong,
  templateDetail,
  templateSketchBody,
  templateTitle,
} from "./templates.ts";
import { useTemplates } from "./templates-queries.ts";

/**
 * The learner's Blank, Oak's Blank, the last Make, over a Band, drums and bass first, from your head, fill it all,
 * plain start, from scraps, a start slot (`slot:<id>`, Oak 2.0 W3 `START_SLOTS`), one of the learner's templates
 * (`tpl:<id>`) or a learning kit's id (`tb.template.…`).
 */
type Start =
  | "your-blank"
  | "blank"
  | "make"
  | "band"
  | "drums-bass"
  | "from-head"
  | "fill"
  | "plain"
  | "from-scraps"
  | (string & {});

/** Oak's Blank's tempo field (and drums and bass first, plain start): a tempo the learner can play along to. */
const TEMPO_MIN = 40;
const TEMPO_MAX = 240;

export function NewSketchDialog({
  open,
  onClose,
  sketches,
}: {
  open: boolean;
  onClose(): void;
  sketches: readonly Sketch[];
}) {
  const [managing, setManaging] = useState(false);
  const close = () => {
    setManaging(false);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={managing ? START_HEADINGS.yourTemplates : "New sketch"}
      className="w-[min(94vw,36rem)]"
    >
      {open ? (
        <>
          {managing ? <MyTemplates onBack={() => setManaging(false)} /> : null}
          <div hidden={managing}>
            <NewSketchForm onClose={close} onManage={() => setManaging(true)} sketches={sketches} />
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

function NewSketchForm({
  onClose,
  onManage,
  sketches,
}: {
  onClose(): void;
  onManage(): void;
  sketches: readonly Sketch[];
}) {
  const navigate = useNavigate();
  const create = useSketchCreate();
  const profile = useProfile();
  const content = useContent();
  const { unlocked } = useUnlockedSet();
  const ids = useId();
  const lastMake = [...sketches]
    .filter((s) => s.originKind === "lesson-make")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const make = useSketch(lastMake?.id ?? "");
  const makeVersion = lastMake ? make.data?.versions.at(-1) : undefined;
  const isToday = lastMake
    ? lastMake.updatedAt.slice(0, 10) === new Date().toISOString().slice(0, 10)
    : false;

  const mine = useTemplates();
  const myTemplates: readonly UserTemplate[] = mine.data?.items ?? [];
  const yourBlank = myTemplates.find((t) => t.isBlank) ?? null;
  const others = myTemplates.filter((t) => !t.isBlank);
  // Until the learner picks, the learner's own Blank is the start when they have one, else Oak's.
  const [picked, setPicked] = useState<Start | null>(null);
  const start: Start = picked ?? (yourBlank ? "your-blank" : "blank");
  const [tempo, setTempo] = useState<string>(String(OAK_DEFAULTS.bpm));
  const bpm = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(Number(tempo)) || OAK_DEFAULTS.bpm));
  // Fill it all: a sketch of the learner's (the most recently edited first) and how many sections.
  const fillable = [...sketches]
    .filter((s) => !s.archived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [fillPicked, setFillId] = useState<string>("");
  const fillId = fillPicked || (fillable[0]?.id ?? "");
  const [sections, setSections] = useState<FillSections>(FILL_SECTIONS.preselected);
  const fillSource = useQuery({
    ...apiQuery("sketches.get", { params: { id: fillId } }),
    enabled: start === "fill" && fillId !== "",
  });
  const fillVersion = fillSource.data?.versions.at(-1);
  const fillBars = readLength(fillId) ?? 4;
  const fillResult = fillVersion ? fillItAllCode(fillVersion.code, { sections, bars: fillBars }) : null;
  const fillProblem = fillResult && "error" in fillResult ? FILL_REFUSALS[fillResult.error] : null;
  const [title, setTitle] = useState(() => nextSketchTitle(sketches));
  // Until the learner types a title, choosing a template names the sketch after it.
  const [titleTyped, setTitleTyped] = useState(false);
  const [meter, setMeter] = useState<MeterId>("4/4");
  const fitting = bandsForMeter(bands, meter, bandMeter);
  const [bandId, setBandId] = useState<string>(fitting[0]?.id ?? "");
  const [flavour, setFlavour] = useState<FlavourId>(() => studioFlavour(profile.data?.flavour));
  const [key, setKey] = useState<KeySpec>(DEFAULT_KEY);
  const band = fitting.find((b) => b.id === bandId) ?? fitting[0];
  const titles = lessonTitles(content.data?.syllabus ?? null);
  const templates = (content.data?.toolbox ?? []).filter(
    (t) => t.kind === "template" && t.id.startsWith("tb.template.") && !t.code.startsWith("recipe"),
  );
  const song: StarterSong | null = starterSong(start);
  // Oak 2.0 W3: a start slot brings its own Start, shown in place of this dialog's.
  const slot = START_SLOTS.find((x) => `slot:${x.id}` === start) ?? null;
  const choose = (value: Start) => {
    setPicked(value);
    if (titleTyped) return;
    const s = starterSong(value);
    setTitle(s ? templateTitle(s.name, sketches) : nextSketchTitle(sketches));
  };

  const submit = async () => {
    // A start slot makes its sketch with its own Start.
    if (slot) return;
    // Two starts are not a sketch yet: they open the capture dialog or Studio's scraps.
    if (start === "from-head") {
      onClose();
      openCapture({ to: "sketch" });
      return;
    }
    if (start === "from-scraps") {
      onClose();
      void navigate({ to: "/studio", search: { scraps: true } });
      return;
    }
    let body: SketchCreate;
    let bars: number | null = song ? song.bars : null;
    const base = {
      title: title.trim() || nextSketchTitle(sketches),
      originKind: "free" as const,
      originId: null,
      sessionId: currentSessionId(),
      analysis: null,
      note: null,
      tutorAssisted: false,
      ranOk: false,
    };
    if (song) {
      body = templateSketchBody(song, base.title, base.sessionId);
    } else if (start === "make" && makeVersion && lastMake) {
      body = {
        ...base,
        code: makeVersion.code,
        bpm: makeVersion.bpm,
        meter: makeVersion.meter,
        key: makeVersion.key,
        band: makeVersion.band,
        flags: { lockedTools: [...makeVersion.flags.lockedTools], previewTools: [] },
        note: `From ${lastMake.title}`,
      };
    } else if (start === "band" && band) {
      const b: SketchBand = { bandId: band.id, flavour, mutes: [] };
      const over = overBandStart(meter);
      body = {
        ...base,
        code: over.code,
        bpm: over.bpm,
        meter,
        key,
        band: b,
        flags: { lockedTools: [], previewTools: [] },
      };
    } else if (start === "drums-bass" || start === "plain") {
      const m = OAK_DEFAULTS.meter;
      body = {
        ...base,
        code: start === "plain" ? plainStartCode(bpm, m) : drumsAndBassCode(bpm, m),
        bpm,
        meter: m,
        key: null,
        band: null,
        flags: { lockedTools: [], previewTools: [] },
      };
    } else if (start === "fill") {
      const source = fillable.find((s) => s.id === fillId);
      if (!fillVersion || !source || !fillResult || "error" in fillResult) {
        toast.info("Pick a sketch to fill", fillProblem ?? "Its parts become sections of a new sketch.");
        return;
      }
      body = {
        ...base,
        code: fillResult.code,
        bpm: fillVersion.bpm,
        meter: fillVersion.meter,
        key: fillVersion.key,
        band: fillVersion.band,
        flags: {
          lockedTools: [...fillVersion.flags.lockedTools],
          previewTools: [],
          ...(fillVersion.flags.reviewBeforeRun === true ? { reviewBeforeRun: true as const } : {}),
        },
        note: `Filled from “${source.title}”`,
      };
      bars = sections * fillBars;
    } else {
      const template = start.startsWith("tpl:") ? others.find((t) => `tpl:${t.id}` === start) : null;
      const opts = { title: base.title, sessionId: base.sessionId };
      body = template
        ? templateStartBody(template, opts)
        : blankStartBody(start === "your-blank" ? yourBlank : null, {
            ...opts,
            bpm,
            meter: OAK_DEFAULTS.meter,
          });
      // A template or Blank from a backup: the strict lint decides; if it is not safe, the sketch opens in Review.
      // A lint that cannot run leaves the flag on (the safe side).
      if (body.flags.reviewBeforeRun === true) {
        const verdict = await lintInBrowser(
          body.code,
          strictLint(body.meter ?? OAK_DEFAULTS.meter, null),
        ).then(strictVerdict, () => null);
        if (verdict?.safe) {
          const { reviewBeforeRun: _checked, ...flags } = body.flags;
          body = { ...body, flags };
        }
      }
    }
    try {
      const saved = await create.mutateAsync({ body });
      // A learning kit's whole song loops (8 or 12 bars), and a filled sketch plays all its sections, not the
      // Studio's default 4.
      if (bars !== null) writeLength(saved.sketch.id, bars);
      onClose();
      void navigate({ to: "/studio/$sketchId", params: { sketchId: saved.sketch.id } });
    } catch (e) {
      toast.error("Couldn't create the sketch", errorWords(e));
    }
  };

  const option = (value: Start, label: string, detail: string, disabled = false, compact = false) => (
    <label
      key={value}
      className={clsx(
        "flex cursor-pointer items-start gap-3 rounded-control border",
        compact ? "px-3 py-2" : "p-3",
        start === value ? "border-accent bg-lane-in" : "border-border hover:bg-surface-2",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="radio"
        name={`${ids}-start`}
        value={value}
        checked={start === value}
        disabled={disabled}
        onChange={() => choose(value)}
        className="mt-1 accent-[var(--oak-accent)]"
      />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-text-2">{detail}</span>
      </span>
    </label>
  );

  const tempoField = (
    <label className="ml-8 flex items-center gap-2 text-sm">
      <span className="text-text-2">Tempo</span>
      <input
        type="number"
        inputMode="numeric"
        aria-label="Tempo"
        min={TEMPO_MIN}
        max={TEMPO_MAX}
        step={1}
        value={tempo}
        onChange={(e) => setTempo(e.target.value)}
        onBlur={() => setTempo(String(bpm))}
        className="h-8 w-20 rounded-control border border-border bg-surface px-2 text-text"
      />
      <span className="text-text-3">BPM</span>
    </label>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-text-2">Title</span>
        <input
          ref={focusOnOpen}
          value={title}
          maxLength={120}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleTyped(true);
          }}
          className="h-9 rounded-control border border-border bg-surface px-2 text-base text-text"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-text-2">Start from</legend>
        {yourBlank ? option("your-blank", "Your Blank", templateStartDetail(yourBlank)) : null}
        {option("blank", "Oak's Blank", START_DETAILS.oakBlank)}
        {start === "blank" ? tempoField : null}
        {option(
          "make",
          isToday ? "Today's Make" : "Your last Make",
          lastMake
            ? `A copy of “${lastMake.title}” (${formatDate(lastMake.updatedAt)}); the original stays as it is.`
            : "Finish a lesson's Make and you can carry it on here.",
          !lastMake || !makeVersion,
        )}
        {option(
          "band",
          "Over a Band",
          "A read-only backing in your key and tempo; you write the parts on top.",
        )}
        {start === "band" ? (
          <div className="grid gap-3 rounded-control border border-border p-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-2">Meter</span>
              <select
                value={meter}
                onChange={(e) => {
                  const m = e.target.value as MeterId;
                  setMeter(m);
                  setBandId(bandsForMeter(bands, m, bandMeter)[0]?.id ?? "");
                }}
                className="h-8 rounded-control border border-border bg-surface px-2 text-text"
              >
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-2">Band</span>
              <select
                value={band?.id ?? ""}
                onChange={(e) => setBandId(e.target.value)}
                className="h-8 rounded-control border border-border bg-surface px-2 text-text"
              >
                <BandOptions fitting={fitting} />
              </select>
            </label>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-text-2" id={`${ids}-flavour`}>
                Style
              </span>
              <SegmentedControl<FlavourId>
                label="Style"
                size="sm"
                value={flavour}
                options={STUDIO_FLAVOURS.map((f) => ({ value: f.id, label: f.label }))}
                onChange={setFlavour}
              />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-text-2">Key</span>
              <span className="flex gap-2">
                <select
                  aria-label="Key: tonic"
                  value={key.tonic}
                  onChange={(e) => setKey({ ...key, tonic: e.target.value })}
                  className="h-8 rounded-control border border-border bg-surface px-2 text-text"
                >
                  {TONICS.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("#", "♯").replace(/(?<=[A-G])b/, "♭")}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Key: mode"
                  value={key.mode}
                  onChange={(e) => setKey({ ...key, mode: e.target.value as KeySpec["mode"] })}
                  className="h-8 rounded-control border border-border bg-surface px-2 text-text"
                >
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>
        ) : null}
        {option("drums-bass", "Drums and bass first", START_DETAILS.drumsAndBass)}
        {start === "drums-bass" ? tempoField : null}
        {option("from-head", "From your head", START_DETAILS.fromHead)}
        {option("fill", "Fill it all", START_DETAILS.fillItAll, fillable.length === 0)}
        {start === "fill" ? (
          <div className="grid gap-3 rounded-control border border-border p-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-2">Sketch</span>
              <select
                aria-label="Sketch"
                value={fillId}
                onChange={(e) => setFillId(e.target.value)}
                className="h-8 rounded-control border border-border bg-surface px-2 text-text"
              >
                {fillable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-text-2">Sections, {fillBars} bars each</span>
              <SegmentedControl<string>
                label="Sections"
                size="sm"
                value={String(sections)}
                options={FILL_SECTIONS.choices.map((n) => ({ value: String(n), label: String(n) }))}
                onChange={(v) => setSections(Number(v) as FillSections)}
              />
            </div>
            {fillProblem ? (
              <p className="text-sm text-text-2" role="status">
                {fillProblem}
              </p>
            ) : null}
          </div>
        ) : null}
        {option("plain", "Plain start", START_DETAILS.plainStart)}
        {start === "plain" ? tempoField : null}
        {option("from-scraps", "From scraps", START_DETAILS.fromScraps)}
        {START_SLOTS.map((x) => option(`slot:${x.id}`, x.label, x.detail))}
        {others.length > 0 ? (
          <>
            <p className="mt-1 text-sm font-medium text-text-2">{START_HEADINGS.yourTemplates}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {others.map((t) => option(`tpl:${t.id}`, t.name, templateStartDetail(t), false, true))}
            </div>
          </>
        ) : null}
        {myTemplates.length > 0 ? (
          <Button variant="link" size="sm" className="self-start" onClick={onManage}>
            {START_HEADINGS.manageTemplates}
          </Button>
        ) : null}
        {templates.length > 0 ? (
          <>
            <p className="mt-1 text-sm font-medium text-text-2">{START_HEADINGS.learningKits}</p>
            <p className="-mt-1 text-sm text-text-3">{START_HEADINGS.learningKitsNote}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((t) => {
                const s = starterSong(t.id);
                if (s && unlocked.has(t.id as never))
                  return option(t.id, s.name, templateDetail(s), false, true);
                return (
                  <p
                    key={t.id}
                    className="flex items-start gap-2 rounded-control border border-dashed border-border px-3 py-2 text-sm text-text-2"
                    data-testid="template-locked"
                  >
                    <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-text-3" />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {s?.name ?? t.code.replace(/^Studio template /, "").replaceAll('"', "")}
                      </span>
                      <span className="block text-text-3">
                        Unlocks when you release {siteTitle(unlockSite(t), titles)}
                      </span>
                    </span>
                  </p>
                );
              })}
            </div>
          </>
        ) : null}
      </fieldset>
      <div className="flex flex-wrap items-start justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {slot ? (
          <slot.Component
            sketches={sketches}
            sessionId={currentSessionId()}
            onCreated={(sketchId) => {
              onClose();
              void navigate({ to: "/studio/$sketchId", params: { sketchId } });
            }}
          />
        ) : (
          <Button variant="primary" type="submit" loading={create.isPending}>
            {start === "from-head"
              ? "Hum, tap or record"
              : start === "from-scraps"
                ? "Open scraps"
                : "Create sketch"}
          </Button>
        )}
      </div>
    </form>
  );
}
