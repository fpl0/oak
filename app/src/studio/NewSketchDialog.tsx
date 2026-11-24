// "New sketch from…" (ux §2.3): Blank, today's Make, over a Band (pop or jazz-soul kit, in a key), or a song
// template ("Four-chord pop", …; studio/templates.ts). An unlocked template is one more choice of the same radio
// group; a locked one says which capstone's release unlocks it (contracts §3.2 A).
import type { Sketch, SketchCreate } from "@oak/api";
import type { FlavourId, KeySpec, MeterId } from "@oak/content-kit";
import { useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Lock } from "lucide-react";
import { useId, useState } from "react";
import { bandMeter, bands } from "../../../content/bands/index.ts";
import { useContent } from "../lib/content.ts";
import { lessonTitles, unlockSite } from "../lib/content-model.ts";
import { errorWords } from "../lib/error-words.ts";
import { formatDate } from "../lib/format.ts";
import { useProfile, useSketch, useSketchCreate } from "../lib/queries.ts";
import { currentSessionId } from "../session/store.ts";
import { siteTitle } from "../toolbox/model.ts";
import { Button } from "../ui/kit/Button.tsx";
import { SegmentedControl } from "../ui/kit/Controls.tsx";
import { Dialog } from "../ui/kit/Dialog.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { BandOptions } from "./BandOptions.tsx";
import { writeLength } from "./draft.ts";
import { focusOnOpen } from "./focus.ts";
import {
  BLANK_CODE,
  bandsForMeter,
  DEFAULT_KEY,
  MODES,
  nextSketchTitle,
  OVER_BAND_CODE,
  type SketchBand,
  STUDIO_FLAVOURS,
  studioFlavour,
  TONICS,
} from "./model.ts";
import { useUnlockedSet } from "./queries.ts";
import {
  type StarterSong,
  starterSong,
  templateDetail,
  templateSketchBody,
  templateTitle,
} from "./templates.ts";

/** Blank, the last Make, over a Band, or a template's id (`tb.template.…`). */
type Start = "blank" | "make" | "band" | (string & {});

export function NewSketchDialog({
  open,
  onClose,
  sketches,
}: {
  open: boolean;
  onClose(): void;
  sketches: readonly Sketch[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title="New sketch" className="w-[min(94vw,36rem)]">
      {open ? <NewSketchForm onClose={onClose} sketches={sketches} /> : null}
    </Dialog>
  );
}

function NewSketchForm({ onClose, sketches }: { onClose(): void; sketches: readonly Sketch[] }) {
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

  const [start, setStart] = useState<Start>("blank");
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
  const choose = (value: Start) => {
    setStart(value);
    if (titleTyped) return;
    const s = starterSong(value);
    setTitle(s ? templateTitle(s.name, sketches) : nextSketchTitle(sketches));
  };

  const submit = async () => {
    let body: SketchCreate;
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
      body = {
        ...base,
        code:
          meter === "3/4"
            ? OVER_BAND_CODE.replace("setcpm(90/4)", "setcpm(108/3)").replace("hh*8", "hh*6")
            : OVER_BAND_CODE,
        bpm: meter === "3/4" ? 108 : 90,
        meter,
        key,
        band: b,
        flags: { lockedTools: [], previewTools: [] },
      };
    } else {
      body = {
        ...base,
        code: BLANK_CODE,
        bpm: 90,
        meter: "4/4",
        key: null,
        band: null,
        flags: { lockedTools: [], previewTools: [] },
      };
    }
    try {
      const saved = await create.mutateAsync({ body });
      // The template's whole song loops: 8 or 12 bars, not the Studio's default 4.
      if (song) writeLength(saved.sketch.id, song.bars);
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
        {option("blank", "Blank", "A tempo line and one drum part to build on.")}
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
        {templates.length > 0 ? (
          <>
            <p className="mt-1 text-sm font-medium text-text-2">Templates</p>
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
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={create.isPending}>
          Create sketch
        </Button>
      </div>
    </form>
  );
}
