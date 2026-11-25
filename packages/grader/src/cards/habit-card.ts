import type { CardCheck, StudioCard } from "@oak/content-kit";
import { MODES, parseKeyText, SCHEMAS } from "@oak/theory";

export function habitCard(habitId: string): StudioCard | null {
  if (habitId.length > 74) return null;
  const make = (text: string, instead: string, check?: CardCheck): StudioCard => ({
    id: `habit.${habitId}`,
    kind: "avoid",
    unlock: "U00.L01",
    source: "Avoidance List",
    text,
    instead,
    ...(check ? { check } : {}),
  });
  const keyInstead = "Instead, try another key or mode from your lessons.";
  const dot = habitId.indexOf(".");
  if (dot < 0) return null;
  const kind = habitId.slice(0, dot);
  const value = habitId.slice(dot + 1);
  if (!value) return null;
  switch (kind) {
    case "sound": {
      const split = value.indexOf(".");
      const role = value.slice(0, split);
      const name = value.slice(split + 1);
      if (split < 0 || !name || (role !== "bass" && role !== "chords" && role !== "tune")) return null;
      return make(
        `Not this time: no ${name} on the ${role}.`,
        `Instead, try a sound you have not given the ${role} before.`,
        { kind: "sounds", sounds: [name], role },
      );
    }
    case "kit":
      return make(`Not this time: no ${value} drum kit.`, "Instead, try another kit for the drums.", {
        kind: "sounds",
        sounds: [value],
        role: "drums",
      });
    case "tempo": {
      const match = /^(-?\d+)-(-?\d+)$/.exec(value);
      if (!match) return null;
      const lo = Number(match[1]);
      const hi = Number(match[2]);
      if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo > hi) return null;
      return make(
        `This time, try a tempo outside ${lo} to ${hi} BPM.`,
        "Instead, try Tempo try and pick a tempo by feel.",
        { kind: "tempo" },
      );
    }
    case "mode": {
      if (!MODES.some(({ mode }) => mode === value)) return null;
      const name = value === "major" || value === "minor" ? value : value[0]?.toUpperCase() + value.slice(1);
      return make(`Not this time: no ${name} key.`, keyInstead);
    }
    case "key": {
      const split = value.indexOf("-");
      const tonic = value.slice(0, split);
      const mode = value.slice(split + 1);
      if (split < 0 || !parseKeyText(`${tonic} ${mode}`) || !MODES.some((entry) => entry.mode === mode))
        return null;
      return make(`Not this time: a key other than ${tonic} ${mode}.`, keyInstead);
    }
    case "meter": {
      const match = /^(\d+)-(\d+)$/.exec(value);
      if (!match) return null;
      const n = Number(match[1]);
      const d = Number(match[2]);
      if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || n <= 0 || d <= 0) return null;
      return make(
        `Not this time: a meter other than ${n}/${d}.`,
        "Instead, try another meter from your lessons.",
      );
    }
    case "drums":
      return make(
        "Not this time: a drum line you have not used before.",
        "Instead, try starting from the bass, or from a rest on beat 1.",
      );
    case "first":
      if (value !== "drums" && value !== "bass" && value !== "chords" && value !== "tune") return null;
      return make(
        `Not this time: start with something other than the ${value}.`,
        "Instead, try starting with another part.",
        { kind: "parts" },
      );
    case "schema": {
      const schema = SCHEMAS.find((entry) => entry.id === habitId);
      return schema
        ? make(
            `Not this time: no ${schema.title}.`,
            "Instead, try two chords, or a loop that starts away from home.",
            { kind: "numerals" },
          )
        : null;
    }
    case "form":
      if (value === "loop")
        return make(
          "Not this time: more than one loop.",
          "Instead, try two sections with arrange(), even short ones.",
        );
      if (value === "sections")
        return make(
          "Not this time: one loop, no sections.",
          "Instead, try making one loop carry the whole piece.",
        );
      return null;
    default:
      return null;
  }
}
