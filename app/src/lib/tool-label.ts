// The learner-facing name of a toolbox entry. The registry's `code` column is transcribed from the contract
// tables (contracts §3.2), so for app features it carries editorial notes ("Band layer (read-only backing; mute
// only)", "Sing panel (PitchLane)") and for some code rows it is a description ("lowercase track labels name:",
// "space-separated sequence"). Today's Next unlock, the Coda and onboarding's Coda show this instead: a feature
// by its plain name, a code row by its code (the catalog signature when the code column is prose).
import type { ToolEntry } from "@oak/content-kit";

export interface ToolLabel {
  text: string;
  /** Code (monospace) or a plain feature name. */
  mono: boolean;
}

const PROSE = /(^|\s)[a-z][a-z-]{2,}\s+[a-z][a-z-]{2,}(\s|$)/i;

/** Text outside quotes and parentheses, to tell a description from code that merely contains words. */
function bare(code: string): string {
  return code.replace(/"[^"]*"|'[^']*'|\([^)]*\)/g, " ");
}

export function toolLabel(
  t: Pick<ToolEntry, "kind" | "code"> & { catalog?: { signature?: string } },
): ToolLabel {
  const l = rawToolLabel(t);
  return { ...l, text: withoutAuthorMark(l.text) };
}

/**
 * The catalog's "†" (contracts §3.2 rule 7: audibility still to be confirmed by the S3 harness) is a note for
 * authors; no learner surface shows it (".partials([…]) †" reads ".partials([…])").
 */
export function withoutAuthorMark(text: string): string {
  return text.replace(/\s*†\s*$/u, "").replace(/\s+†\s+/gu, " ");
}

function rawToolLabel(t: Pick<ToolEntry, "kind" | "code"> & { catalog?: { signature?: string } }): ToolLabel {
  // A recipe template is code ("recipe note(…).s(\"sawtooth\").lpf(600)"): its last "(600)" is the code's own
  // argument, not an editorial note, so it is shown whole, as code, without the registry's "recipe" word.
  if (t.kind === "template" && /^recipe\s/.test(t.code))
    return { text: t.code.replace(/^recipe\s+/, ""), mono: true };
  if (t.kind === "feature" || t.kind === "lens" || t.kind === "template") {
    const plain = t.code.replace(/\s*\([^)]*\)\s*$/, "").trim();
    return { text: plain || t.code, mono: false };
  }
  const sig = t.catalog?.signature?.trim();
  if (sig && PROSE.test(bare(t.code))) return { text: sig, mono: true };
  return { text: t.code, mono: true };
}

/**
 * The name a learner reads for a tool in Today, the Coda and the ceremony (promoted from session/tool-name.ts):
 * `toolLabel`, except that a sound is the code the learner types (`.s("ebass")`), never the registry's
 * sample-bank note ("ebass (gm_electric_bass_pick:0)"), and a scale row (written with a placeholder tonic,
 * "X4:major", or a colon inside the name, "X4:harmonic:minor") is the scale named in words ("the harmonic minor scale").
 */
export function toolName(
  t: Pick<ToolEntry, "kind" | "code"> & { catalog?: { signature?: string } },
): ToolLabel {
  const sig = t.catalog?.signature?.trim();
  if (t.kind === "sound") {
    const alias = /^([\w-]+)\s*\(/.exec(t.code)?.[1];
    return { text: withoutAuthorMark(sig || (alias ? `.s("${alias}")` : t.code)), mono: true };
  }
  if (t.kind === "scale") {
    const name =
      t.code
        .split(",")[0]
        ?.trim()
        .replace(/^X\d?:/, "")
        // A scale written with a colon in code (`harmonic:minor`, `minor:pentatonic`) reads in words.
        .replace(/:/g, " ") ?? "";
    if (name) return { text: `the ${name} scale`, mono: false };
  }
  return toolLabel(t);
}
