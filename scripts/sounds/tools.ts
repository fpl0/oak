// The pack build's external tools (lame, flac) as mirror.ts sees them: whether they are installed, and what to
// say when a frozen build cannot reproduce the lock with the ones on this machine. Kept out of audio.ts on
// purpose: audio.ts is part of every derived file's recipe (recipe.ts), and these messages are not.

import { toolVersion } from "./audio.ts";

export type Encoders = Record<"lame" | "flac", string>;

/**
 * The version line of an external encoder, or "" when it is not installed: a frozen build that reuses every
 * derived file needs neither tool, so a missing one fails only when a render runs it.
 */
export function installedVersion(tool: string): string {
  try {
    return toolVersion(tool as "lame" | "flac");
  } catch {
    return "";
  }
}

/** Bun's spawn error for a tool that is not on PATH, made actionable; any other error unchanged. */
export function explainMissingTool(err: unknown): unknown {
  const e = err as { code?: string; path?: string } | undefined;
  if (e?.code !== "ENOENT" || !/Executable not found/.test(String(err))) return err;
  return new Error(
    `${e.path ?? "a tool"} is not installed: rendering the pack's derived files needs lame and flac (README, "Run from source")`,
  );
}

/**
 * Why a derived file rebuilt under a frozen lock may not match it, and what to do; "" when that is not the
 * cause. Only LAME's output depends on the tool's version: it writes the version into every MP3's info tag
 * and its encoder changes between releases, while Oak writes every FLAC and WAV itself (docs/spikes.md, s8).
 */
export function encoderMismatchHint(
  path: string,
  locked: Partial<Encoders> | undefined,
  local: Encoders,
): string {
  if (!/\.mp3$/i.test(path) || !locked?.lame || locked.lame === local.lame) return "";
  const here = local.lame ? `this machine has "${local.lame}"` : "lame is not installed here";
  return [
    `  The lock's MP3s were encoded by "${locked.lame}"; ${here}. LAME writes its version into each file, so`,
    `  only that exact LAME reproduces them. Either install it, or copy sounds/pack/${path.split("/")[0]} from a machine that built`,
    "  the pack (the frozen run then reuses every file), or run with --update to re-lock under your LAME (this",
    "  changes the pack's hashes; do not commit that lock).",
  ].join("\n");
}
