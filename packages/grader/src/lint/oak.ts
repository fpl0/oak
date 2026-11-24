// The one toolbox-aware lint pass (contracts §3.3): syntax and safety, call identifiers, string arguments
// by callee, mini-notation, labels and tempo, dialect rules (STYLE §12). Pure and synchronous: the CM6
// editor runs it on the main thread, every grader host runs it before evaluating, content CI and the
// tutor's card validator run it on authored and model-written code.
import {
  type LintContext,
  type LintDiagnostic,
  type LintProfile,
  type LintResult,
  type LintSeverity,
  STRICT_PROFILES,
  type ToolEntry,
  type ToolId,
  TRACK_LABELS,
  type UnlockableId,
} from "@oak/content-kit";
import { METERS } from "@oak/theory";
import { REPL_NAMES, VISUAL_METHODS } from "../runtime/realm.ts";
import { core, scopeModules } from "../runtime/strudel.ts";
import {
  type AstNode,
  arrangedTracks,
  type CallSite,
  type Chain,
  callSites,
  chainOf,
  child,
  declaredNames,
  isDynamicMember,
  lineCol,
  numericValue,
  type ProgramInfo,
  parseProgram,
  programInfo,
  type StringArg,
  type StringLit,
  sectionsFromProgram,
  stringArgs,
  stringLit,
  walk,
} from "./ast.ts";
import { checkChord, chordInDict, dictsFor, splitChord } from "./chords.ts";
import { asFeedbackId, dialectSeverity, type LintCode, renderLint } from "./messages.ts";
import { cycleLength, type MiniInfo, miniErrorDetail, readMini } from "./mini.ts";
import {
  baseFindings,
  type SafetyFinding,
  STRICT_GADGETS,
  STRICT_SAFE_GLOBALS,
  strictFindings,
} from "./safety.ts";
import { indexToolbox, type ToolIndex, unlockIds, unlockText } from "./toolbox.ts";

// --- what the code uses --------------------------------------------------------------------------

/** One use of something the toolbox may catalogue. */
interface Use {
  /** Index key (`fn:scale`, `mini:repeat`, `snd:bd`, …) or, with `direct`, the ID itself. */
  key: string;
  direct: boolean;
  /** As written, for messages. */
  name: string;
  start: number;
  end: number;
  /** Report `code.uncatalogued` when the toolbox has no row for it. */
  reportUnknown: boolean;
  /** `code.uncatalogued` explanation. */
  why?: string;
}

interface Finding {
  id: LintCode;
  start: number;
  end: number;
  params: Record<string, string | number>;
  /** Severity in a graded step when it differs from the rule's default. */
  graded?: LintSeverity;
  /** Only reported for authored code (content, tutor-card, band). */
  authoredOnly?: boolean;
}

interface Scan {
  uses: Use[];
  findings: Finding[];
}

const EXTRA_LABELS = ["fx"];
const LABELS = new Set<string>([...TRACK_LABELS, ...EXTRA_LABELS]);
/**
 * Unpitched sample names: `n` on them picks a sample, not a pitch. The second line is sound pack v4's hand
 * percussion, one-shots, beds and breaks (added; nothing on the first line changes).
 */
const DRUMS = new Set(
  [
    "bd sd hh oh cp rim rm lt mt ht cr rd sh cb tb perc misc fx",
    "clave conga bongo foley snap impact swoosh scratch drone vinyl tape brkfunk brkboombap brkjungle brkhouse brkjazz brklofi",
  ]
    .join(" ")
    .split(" "),
);
const SILENT_CONTROLS = new Set("leslie lrate lsize amp squiz triode ring".split(" "));
const TEMPO_CALLS = new Set(["setcpm", "setCpm", "setcps", "setCps"]);
const STATEMENT_CALLS = new Set([
  ...TEMPO_CALLS,
  "samples",
  "all",
  "each",
  "hush",
  "aliasBank",
  "soundAlias",
]);
const NO_MINI_OPS = new Set([
  "scale",
  "bank",
  "dict",
  "mode",
  "samples",
  "compressor",
  "distorttype",
  "anchor",
  ...TEMPO_CALLS,
]);
const NON_PATTERN_OBJECTS = new Set(["Math", "JSON", "Number", "String", "Array", "console", "Date", "Intl"]);
const IGNORED_REFS = new Set(["silence", "undefined", "NaN", "Infinity"]);
const SCALE_WORD =
  /^(?:major|minor|aeolian|ionian|dorian|phrygian|lydian|mixolydian|locrian|harmonic|melodic|pentatonic|blues|altered|bebop|chromatic)\b/;

let strudelNames: Set<string> | null = null;
/** Every name the Strudel realm knows: exports of core, mini and tonal, Pattern methods, repl functions. */
/** `code.unknown-chord` reasons: a spelling Strudel cannot voice, or an alias it voices that Oak spells otherwise. */
const NOT_A_CHORD = "isn't a Strudel chord name";
const ALIAS_CHORD = "plays, but Oak writes this chord another way";

export function knownStrudelNames(): Set<string> {
  if (strudelNames) return strudelNames;
  const names = new Set<string>(REPL_NAMES);
  for (const mod of Object.values(scopeModules)) for (const k of Object.keys(mod)) names.add(k);
  for (const k of Object.getOwnPropertyNames(core.Pattern.prototype)) names.add(k);
  for (const k of VISUAL_METHODS) names.add(k);
  strudelNames = names;
  return names;
}

let strictNames: Set<string> | null = null;
/**
 * The names code the learner did not type may read from outside itself (contracts §11.3, the strict profile):
 * Strudel's scope as the grader realm has it and a few plain builtins, without the gadgets (safety.ts).
 */
export function strictAllowedNames(): ReadonlySet<string> {
  if (strictNames) return strictNames;
  const names = new Set<string>([...knownStrudelNames(), ...STRICT_SAFE_GLOBALS]);
  for (const g of STRICT_GADGETS) names.delete(g);
  strictNames = names;
  return names;
}

const NOTE_RE = /^([a-gA-G])([#bsf]*)(-?\d*)$/;
const isNumber = (t: string) => /^-?\d+(?:\.\d+)?$/.test(t);
const isRest = (t: string) => t === "~" || t === "-" || t === "_";

function unitsPerBar(ctx: LintContext): number {
  return METERS[ctx.meter]?.unitsPerBar ?? 4;
}

function keySuggestion(ctx: LintContext): string {
  const k = ctx.key;
  if (!k) return "C4:major";
  const mode = k.mode === "major" || k.mode === "minor" ? k.mode : k.mode;
  return `${k.tonic}4:${String(mode).replace(/-/g, ":").replace(/ /g, ":")}`;
}

function scanProgram(code: string, ast: AstNode, ctx: LintContext): Scan {
  const uses: Use[] = [];
  const findings: Finding[] = [];
  const info = programInfo(ast);
  const declared = declaredNames(ast);
  const known = knownStrudelNames();
  const use = (key: string, name: string, n: { start: number; end: number }, o: Partial<Use> = {}) =>
    uses.push({ key, direct: false, name, start: n.start, end: n.end, reportUnknown: false, ...o });
  const direct = (id: string, name: string, n: { start: number; end: number }) =>
    uses.push({ key: id, direct: true, name, start: n.start, end: n.end, reportUnknown: false });
  const find = (
    id: LintCode,
    n: { start: number; end: number },
    params: Finding["params"] = {},
    o: Partial<Finding> = {},
  ) => findings.push({ id, start: n.start, end: n.end, params, ...o });

  // Chains: every call is mapped to the outermost chain it is a link of.
  const chainOfCall = new Map<AstNode, Chain>();
  walk(ast, (n, ancestors) => {
    if (n.type !== "CallExpression") return undefined;
    const parent = ancestors[ancestors.length - 1];
    const isLinkOfOuter = parent?.type === "MemberExpression" && parent.object === n;
    if (!isLinkOfOuter) {
      const ch = chainOf(n);
      for (const l of ch.links) chainOfCall.set(l.call, ch);
    }
    return undefined;
  });
  const chainsWithAncestors = (call: AstNode): Chain[] => {
    const out: Chain[] = [];
    walk(ast, (n, ancestors) => {
      if (n !== call) return undefined;
      const own = chainOfCall.get(call);
      if (own) out.push(own);
      for (let i = ancestors.length - 1; i >= 0; i--) {
        const a = ancestors[i] as AstNode;
        const ch = a.type === "CallExpression" ? chainOfCall.get(a) : undefined;
        if (ch && !out.includes(ch)) out.push(ch);
      }
      return false;
    });
    return out;
  };
  const stringArgOf = (link: { args: AstNode[] } | undefined, i = 0): StringLit | null =>
    stringLit(link?.args[i] ?? null);
  const dictOf = (call: AstNode): string => {
    for (const ch of chainsWithAncestors(call)) {
      const d = ch.links.filter((l) => l.name === "dict").pop();
      const s = stringArgOf(d);
      if (s) return s.value.trim();
    }
    return "ireal";
  };
  const constByName = new Map(info.consts.map((c) => [c.name, c]));
  const constChainRoot = (name: string, depth = 0): string | null => {
    const c = constByName.get(name);
    if (!c?.init || depth > 4) return null;
    const ch = chainOf(c.init);
    if (ch.rootIsCall) return ch.links[0]?.name ?? null;
    return ch.base?.type === "Identifier" ? constChainRoot(ch.base.name as string, depth + 1) : null;
  };
  const isPitchedChain = (ch: Chain, upTo: number): boolean => {
    const names = ch.links.slice(0, upTo).map((l) => l.name);
    if (
      names.some((n) => ["note", "n", "chord", "scale", "voicing", "freq", "rootNotes", "arp"].includes(n))
    ) {
      // `n` alone with a drum sound is a sample index, not a pitch.
      return (
        names.includes("note") ||
        names.includes("chord") ||
        names.includes("scale") ||
        names.includes("freq") ||
        names.includes("voicing")
      );
    }
    if (ch.base?.type === "Identifier") {
      const root = constChainRoot(ch.base.name as string);
      return root === "note" || root === "chord";
    }
    return false;
  };

  // --- 1. labels ---------------------------------------------------------------------------------
  const seen = new Map<string, number>();
  for (const l of info.labels) {
    const at = { start: l.labelStart, end: l.labelEnd };
    const label = l.label;
    if (label.includes("$")) {
      find("code.dollar-label", at, { label });
      direct("tb.label", label, at);
    } else if (label.startsWith("_") || label.endsWith("_")) {
      find("code.muted-label", at, { label });
      direct("tb.label.mute", label, at);
    } else {
      direct("tb.label", label, at);
      if (/^[A-Z]/.test(label)) {
        find("code.label-solo-prefix", at, { label, suggest: label[0]?.toLowerCase() + label.slice(1) });
      } else if (!LABELS.has(label) && !(/^[a-z]+[2-4]$/.test(label) && LABELS.has(label.slice(0, -1)))) {
        find("code.label-unknown", at, { label });
      }
      const key = label;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if ((seen.get(key) ?? 0) === 2) find("code.label-duplicate", at, { label });
    }
  }
  if (info.labels.length > 0) {
    for (const e of info.expressions) {
      const ch = chainOf(e);
      const first = ch.links[0];
      if (ch.rootIsCall && first && STATEMENT_CALLS.has(first.name) && ch.links.length === 1) continue;
      find("code.unlabelled-line", e);
    }
  }
  for (const c of info.consts) {
    direct("tb.const", c.name, c.node);
  }

  // --- 2. tempo ----------------------------------------------------------------------------------
  const sites = callSites(ast);
  const units = unitsPerBar(ctx);
  const tempoCalls = sites.filter((s) => s.name === "setcpm" || s.name === "setCpm");
  const hasCode = info.labels.length > 0 || info.expressions.length > 0;
  // Band code shares the session's tempo (contracts §5.10 item 2): it carries no tempo line.
  if (tempoCalls.length === 0 && hasCode && ctx.profile !== "band") {
    find(
      "code.setcpm-missing",
      { start: 0, end: 0 },
      { detail: "There is no tempo line", example: `120/${units}` },
    );
  }
  for (const t of tempoCalls) {
    const arg = t.args[0] ?? null;
    const s = stringLit(arg);
    if (s) {
      find(
        "code.setcpm-form",
        t.call,
        {
          detail: `\`${t.name}("${s.value}")\` in quotes does not set the tempo: write \`${t.name}(${s.value})\``,
        },
        { graded: "error" },
      );
      continue;
    }
    const v = numericValue(arg);
    if (arg && v !== null && !(arg.type === "BinaryExpression" && arg.operator === "/")) {
      const bpm = Math.round(v * units * 1000) / 1000;
      find("code.setcpm-form", t.call, {
        detail: `\`setcpm(${code.slice(arg.start, arg.end)})\` hides the BPM: write it as \`setcpm(${bpm}/${units})\``,
      });
    } else if (arg?.type === "BinaryExpression" && arg.operator === "/") {
      const d = numericValue(child(arg, "right"));
      if (d !== null && d !== units) {
        find(
          "code.setcpm-form",
          t.call,
          { detail: `In ${ctx.meter} the tempo line divides by ${units}: \`setcpm(bpm/${units})\`` },
          { graded: "warn" },
        );
      }
    }
    direct(meterTool(ctx.meter), ctx.meter, t.nameNode);
  }

  // --- 3. calls ----------------------------------------------------------------------------------
  // A method reached by a name built at run time (`p[k]()`) cannot be checked against the toolbox, so a graded
  // step could call a locked tool through it (`voicing()` before its gate, contracts §3.1 rule 6). The strict
  // profile already refuses every computed access; the learner's own code is refused only this one form.
  if (!STRICT_PROFILES.includes(ctx.profile))
    walk(ast, (n) => {
      if (n.type !== "CallExpression") return undefined;
      const callee = child(n, "callee");
      if (callee !== null && isDynamicMember(callee))
        find(
          "lint.strict.computed-member",
          callee,
          { what: "a method named by a value computed at run time; call it by its name" },
          { graded: "error" },
        );
      return undefined;
    });
  for (const site of sites) {
    const { name } = site;
    if (!site.isMethod && declared.has(name)) continue;
    if (site.isMethod && site.objectName && NON_PATTERN_OBJECTS.has(site.objectName)) continue;
    const at = site.nameNode;
    if (name === "setcps" || name === "setCps") {
      find("code.setcpm-missing", site.call, {
        detail: "Oak sets the tempo with setcpm, not setcps",
        example: `120/${units}`,
      });
    } else if (site.isMethod && (name === "cpm" || name === "cps")) {
      find("code.setcpm-missing", site.call, {
        detail: `\`.${name}()\` changes the tempo of one line`,
        example: `120/${units}`,
      });
    }
    if (name === "nudge") {
      find("code.nudge-studio-only", site.call, {});
      continue;
    }
    if (name === "voicings") {
      find("code.mode-above", site.call, { what: "`.voicings()`" });
      continue;
    }
    if (
      VISUAL_METHODS.includes(name.replace(/^_/, "")) &&
      name !== "scope" &&
      name !== "fscope" &&
      name !== "color"
    ) {
      find(
        "code.uncatalogued",
        at,
        { name, why: " (visual methods are not used in Oak code)" },
        { authoredOnly: true },
      );
      continue;
    }
    if (name.startsWith("_") && site.isMethod) {
      find(
        "code.uncatalogued",
        at,
        { name, why: " (inline widgets are not used in Oak code)" },
        { authoredOnly: true },
      );
      continue;
    }
    if (SILENT_CONTROLS.has(name)) {
      find(
        "code.uncatalogued",
        at,
        { name, why: " (it is silent in this Strudel version)" },
        { graded: "info" },
      );
      continue;
    }
    if (name === "piano" && site.isMethod) {
      find("code.uncatalogued", at, { name: ".piano()", why: ' (write .s("piano"))' }, { graded: "info" });
      continue;
    }
    if (name === "samples") {
      find(
        "code.uncatalogued",
        at,
        { name, why: " (sounds come from Oak's sound pack)" },
        { graded: "info" },
      );
      continue;
    }
    if ((name === "s" || name === "sound") && site.isMethod) {
      const ch = chainOfCall.get(site.call);
      const idx = ch ? ch.links.findIndex((l) => l.call === site.call) : -1;
      if (ch && isPitchedChain(ch, idx)) {
        direct("tb.s.pitched", `.${name}()`, at);
        continue;
      }
    }
    if (name === "voicing") {
      const ch = chainOfCall.get(site.call);
      const names = ch?.links.map((l) => l.name) ?? [];
      if (ch?.rootIsCall && names[0] === "n" && names.includes("chord"))
        direct("tb.voicing.n", "n(…).chord(…).voicing()", at);
    }
    if (name === "note" && site.args[0]?.type === "Literal" && typeof site.args[0].value === "number") {
      direct("tb.note.midi", "note(60)", site.args[0]);
    }
    if (name === "swingBy" || name === "swing") {
      const n = numericValue(site.args[name === "swing" ? 0 : 1] ?? null);
      if (n !== null && n !== units && n !== 2 * units) {
        find("code.swing-convention", site.call, { fn: name, got: n, beats: units, double: 2 * units });
      }
    }
    if (name === "dict") {
      // `.dict()` after `.voicing()` sets a control the voicing has already read: the chords sound as before
      // (verified in Strudel 1.2.6: `chord("<Dm7 G7>").voicing().dict("lefthand")` plays the default voicings).
      const ch = chainOfCall.get(site.call);
      const names = ch?.links.map((l) => l.name) ?? [];
      const idx = ch ? ch.links.findIndex((l) => l.call === site.call) : -1;
      const v = names.indexOf("voicing");
      if (v >= 0 && idx > v)
        find("code.dict-after-voicing", site.call, { dict: stringLit(site.args[0] ?? null)?.value ?? "…" });
    }
    if (name === "transpose") {
      const ch = chainOfCall.get(site.call);
      const names = ch?.links.map((l) => l.name) ?? [];
      const idx = ch ? ch.links.findIndex((l) => l.call === site.call) : -1;
      const v = numericValue(site.args[0] ?? null);
      if (idx > names.indexOf("scale") && names.indexOf("scale") >= 0 && !(v !== null && v % 12 === 0)) {
        find("code.transpose-after-scale", site.call, {});
      }
    }
    if (name === "add") {
      const ch = chainOfCall.get(site.call);
      const names = ch?.links.map((l) => l.name) ?? [];
      const arg = site.args[0] ?? null;
      const s = stringLit(arg);
      const literalNumber = arg?.type === "Literal" && typeof arg.value === "number";
      if (names.includes("n") && (s || literalNumber)) {
        const text = s ? `"${s.value}"` : code.slice(arg?.start ?? 0, arg?.end ?? 0);
        find("code.add-on-control", site.call, { arg: text, inner: s ? s.value : text });
      }
    }
    // `dict("…")` and `mode("…")` are catalogued by their argument (tb.dict.*, tb.mode.*).
    if (name === "dict" || name === "mode") continue;
    use(`fn:${name}`, name, at, { reportUnknown: known.has(name) });
  }

  // Identifier references to Strudel values (`sine`, `perlin`, `rand`): signals are used without a call.
  walk(ast, (n, ancestors) => {
    if (n.type !== "Identifier") return undefined;
    const name = n.name as string;
    const parent = ancestors[ancestors.length - 1];
    if (declared.has(name) || IGNORED_REFS.has(name) || !known.has(name)) return undefined;
    if (parent?.type === "MemberExpression" && parent.property === n && !parent.computed) return undefined;
    if (parent?.type === "CallExpression" && parent.callee === n) return undefined;
    if (parent?.type === "Property" && parent.key === n) return undefined;
    if (parent?.type === "LabeledStatement") return undefined;
    use(`fn:${name}`, name, n, { reportUnknown: true });
    return undefined;
  });

  // --- 4. strings by callee and mini-notation ------------------------------------------------------
  const args = stringArgs(ast);
  // A string const used as an argument (`const changes = "<Dm7 G7>"` … `chord(changes)`) is read with
  // the callee it is used with.
  const constStrings = new Map<string, StringArg>();
  for (const c of info.consts) {
    const s = args.find((a) => a.node === c.init);
    if (s) constStrings.set(c.name, s);
  }
  const viaConst: { lit: StringArg; site: CallSite; argIndex: number }[] = [];
  for (const site of sites) {
    site.args.forEach((a, i) => {
      const lit = a.type === "Identifier" ? constStrings.get(a.name as string) : undefined;
      if (lit) viaConst.push({ lit, site, argIndex: i });
    });
  }

  const minis = new Map<StringArg, MiniInfo>();
  const miniOf = (lit: StringArg): MiniInfo => {
    let m = minis.get(lit);
    if (!m) {
      m = readMini(lit.value, lit.contentStart);
      minis.set(lit, m);
    }
    return m;
  };

  for (const lit of args) {
    const callee = lit.callee;
    if (lit.quote === "'") {
      if (callee && known.has(callee) && !declared.has(callee) && callee !== "samples") {
        find("code.single-quoted-pattern", lit.node, { text: lit.value });
      }
      continue;
    }
    if (callee === "samples") continue;
    const special = callee === "chord" && /[+/]/.test(lit.value);
    const mini = miniOf(lit);
    if (mini.error && !special) {
      find("eval.mini-parse", lit.node, {
        line: lineCol(code, lit.node.start).line,
        detail: miniErrorDetail(mini.error, lit.value),
      });
    }
    if (/\S\.\.|\.\.\S/.test(lit.value)) {
      find("code.range-spacing", lit.node, {
        text: lit.value,
        suggest: lit.value.replace(/\s*\.\.\s*/g, " .. "),
      });
    }
    // A fraction in quotes to a time shift (`.early("1/8")`) is one finding, `code.time-fraction-string`: the `/`
    // in it is not a division the learner wrote on purpose, so it is not looked up as a mini-notation operator.
    const quotedFraction =
      !!callee && TIME_SHIFTS.has(callee) && lit.argIndex === 0 && /\d\s*\/\s*\d/.test(lit.value);
    if ((!callee || !NO_MINI_OPS.has(callee)) && !quotedFraction) {
      for (const op of mini.ops) {
        // "G/B" inside chord() is a slash chord (code.slash-chord says so), not a division to look up.
        if (special && op.op === "slow" && /[A-Ga-g][#b]?[^\s<>[\]{},/]*\/[A-Ga-g]/.test(lit.value)) continue;
        use(`mini:${op.op}`, op.op, op, { reportUnknown: true, why: " (mini-notation operator)" });
      }
    }
    if (callee) readArg(lit, callee, lit.argIndex, lit.call);
  }
  for (const { lit, site, argIndex } of viaConst) readArg(lit, site.name, argIndex, site.call);

  function readArg(lit: StringArg, callee: string, argIndex: number, call: AstNode | null): void {
    const mini = miniOf(lit);
    const atoms = mini.atoms.filter((a) => !isRest(a.text));
    switch (callee) {
      case "s":
      case "sound":
        for (const a of atoms) {
          const name = a.text.split(":")[0] as string;
          if (!name || isNumber(name)) continue;
          if (/^gm_/.test(name)) {
            find("code.uncatalogued", a, { name, why: " (use Oak's instrument names)" }, { graded: "info" });
            continue;
          }
          use(`snd:${name}`, name, a, { reportUnknown: true, why: " (not a sound in Oak's pack)" });
        }
        break;
      case "bank":
        for (const a of atoms) use(`bank:${a.text}`, a.text, a, { reportUnknown: true, why: "bank" });
        break;
      case "note":
        for (const a of atoms) noteAtom(a);
        break;
      case "n":
        for (const a of atoms) {
          const m = /^(-?\d+)([#b]+)$/.exec(a.text);
          if (m) {
            direct("tb.n.chromatic", a.text, a);
            const step = Math.abs(Number(m[1]));
            if (step >= 7) find("code.chromatic-step", a, { step: a.text, n: Number(m[1]) });
          } else if (/^-?\d+$/.test(a.text)) {
            const v = Number(a.text);
            if (v < 0 || v >= 7) direct("tb.n.range", a.text, a);
          }
        }
        break;
      case "scale":
        scaleArg(lit);
        break;
      case "chord":
        chordArg(lit, call);
        break;
      case "mode":
        for (const a of atoms) {
          const mode = a.text.split(":")[0] as string;
          if (mode === "above") find("code.mode-above", a, { what: '`mode("above")`' });
          else use(`mode:${mode}`, `mode("${a.text}")`, a, { reportUnknown: false });
        }
        if (/\babove\b/.test(lit.value) && atoms.length === 0)
          find("code.mode-above", lit.node, { what: '`mode("above")`' });
        break;
      case "dict": {
        const d = lit.value.trim();
        if (d === "legacy")
          find("code.uncatalogued", lit.node, {
            name: 'dict("legacy")',
            why: " (it voices some chords wrongly)",
          });
        else if (d !== "ireal") use(`dict:${d}`, `dict("${d}")`, lit.node, { reportUnknown: true });
        break;
      }
      case "transpose":
        if (atoms.some((a) => !isNumber(a.text)))
          direct("tb.transpose.interval", `transpose("${lit.value}")`, lit.node);
        break;
      case "late":
      case "early":
      case "off":
      case "nudge":
        if (argIndex === 0 && /\d\s*\/\s*\d/.test(lit.value)) {
          find("code.time-fraction-string", lit.node, { fn: callee, text: lit.value });
        }
        break;
      case "swingBy":
        if (argIndex === 0) {
          direct("tb.swing.patterned", 'swingBy("…")', lit.node);
          if (lit.value.includes("/")) find("code.swing-fraction-string", lit.node, { text: lit.value });
        }
        break;
      default:
        break;
    }
  }

  function noteAtom(a: { text: string; start: number; end: number }): void {
    if (isNumber(a.text)) {
      direct("tb.note.midi", a.text, a);
      return;
    }
    const m = NOTE_RE.exec(a.text);
    if (!m) return;
    const [, letter, acc = "", oct = ""] = m;
    const fixedAcc = acc.replace(/s/g, "#").replace(/f/g, "b");
    // Strudel reads `s` and `f` as sharp and flat ("fs5" is F♯5): with an octave it plays right, so the note is
    // only about the spelling (STYLE §1), never "has no octave".
    if (/[sf]/.test(acc) && oct) {
      find("code.letter-accidental", a, {
        note: a.text,
        suggest: `${letter?.toLowerCase()}${fixedAcc}${oct}`,
      });
    } else if (!oct) {
      find("code.octave-default", a, { note: a.text, suggest: `${letter?.toLowerCase()}${fixedAcc}4` });
    }
    if (oct) direct("tb.note.names", a.text, a);
    if (acc) direct("tb.note.accidentals", a.text, a);
  }

  function scaleArg(lit: StringArg): void {
    const text = lit.value;
    const spaced = /([A-Ga-g][#b]?-?\d?)\s+([a-z][a-z:]*)/.exec(text);
    if (spaced && SCALE_WORD.test(spaced[2] as string)) {
      const tonic = /\d/.test(spaced[1] as string) ? spaced[1] : `${spaced[1]}4`;
      find("code.scale-spaces", lit.node, {
        suggest: `${tonic}:${(spaced[2] as string).replace(/\s+/g, ":")}`,
      });
      return;
    }
    let count = 0;
    for (const m of text.matchAll(/([A-Ga-g][#b]?)(-?\d*)((?::[a-z]+)+)/g)) {
      count++;
      const start = lit.contentStart + (m.index ?? 0);
      const at = { start, end: start + m[0].length };
      const name = (m[3] as string).slice(1);
      if (!m[2]) find("code.scale-no-octave", at, { scale: m[0], suggest: `${m[1]}4${m[3]}` });
      use(`scale:${name}`, name, at, { reportUnknown: true, why: " (not a scale name in Oak)" });
    }
    if (count > 1 || text.includes("<")) direct("tb.scale.patterned", "patterned .scale()", lit.node);
  }

  function chordArg(lit: StringArg, call: AstNode | null): void {
    const dict = call ? dictOf(call) : "ireal";
    const text = lit.value;
    const slashes = [...text.matchAll(/([A-Ga-g][#b]?[^\s<>[\]{},/]*)\/([A-Ga-g][#b]?)/g)];
    for (const m of slashes) {
      const start = lit.contentStart + (m.index ?? 0);
      find("code.slash-chord", { start, end: start + m[0].length }, { sym: m[0], bass: m[2] as string });
    }
    const plus = [...text.matchAll(/([A-Ga-g][#b]?)\+/g)];
    for (const m of plus) {
      const start = lit.contentStart + (m.index ?? 0);
      find(
        "code.unknown-chord",
        { start, end: start + m[0].length },
        { sym: m[0], why: NOT_A_CHORD, suggest: `${m[1]}aug` },
      );
    }
    if (slashes.length || plus.length) return;
    for (const a of miniOf(lit).atoms) {
      const sym = a.text.split(":")[0] as string;
      if (!sym || isRest(sym) || isNumber(sym)) continue;
      const c = checkChord(sym);
      const parts = splitChord(sym);
      if (c.lowercaseRoot && parts) {
        find("code.lowercase-chord-root", a, { sym, suggest: c.suggest ?? sym });
        continue;
      }
      if (!c.known) {
        find("code.unknown-chord", a, {
          sym,
          why: NOT_A_CHORD,
          suggest: c.suggest ?? (parts ? parts.root.toUpperCase() : "C"),
        });
        continue;
      }
      const verdict = chordInDict(sym, dict);
      if (!c.canonical) {
        find(
          "code.unknown-chord",
          a,
          // An alias Strudel voices ("CM" plays C major) is a spelling note, not "no such chord" (Wave 4 gate).
          { sym, why: verdict === "ok" ? ALIAS_CHORD : NOT_A_CHORD, suggest: c.suggest ?? sym },
          { graded: verdict === "ok" ? "info" : "error" },
        );
      }
      if (c.family) direct(c.family, sym, a);
      // A misspelt name ("Cmaj") has one fix, its spelling; the dictionary verdict follows from that.
      if (!c.canonical) continue;
      if (verdict === "missing" || verdict === "wrong") {
        const ok = dictsFor(sym).filter((d) => d !== dict);
        find("code.chord-not-in-dict", a, {
          sym,
          dict,
          problem: verdict === "wrong" ? "is voiced with the wrong notes" : "is silent",
          fix: ok.length
            ? `Use ${ok.map((d) => `.dict("${d}")`).join(" or ")}, or voice it by hand.`
            : "Voice it by hand.",
        });
      }
    }
  }

  // --- 5. chains -----------------------------------------------------------------------------------
  for (const l of info.labels) {
    if (!l.expr) continue;
    const ch = chainOf(l.expr);
    const names = ch.links.map((x) => x.name);
    if (
      ch.rootIsCall &&
      names[0] === "n" &&
      !names.some((x) => ["scale", "chord", "voicing", "set"].includes(x))
    ) {
      const sounds = ch.links
        .filter((x) => x.name === "s" || x.name === "sound")
        .flatMap((x) => {
          const s = stringArgOf(x);
          return s ? miniOfLit(s) : [];
        });
      const drumsOnly =
        (sounds.length > 0 && sounds.every((t) => DRUMS.has(t.split(":")[0] as string))) ||
        names.includes("bank");
      if (!drumsOnly) find("code.n-without-scale", ch.links[0]?.call ?? l.node, { key: keySuggestion(ctx) });
    }
  }
  function miniOfLit(s: StringLit): string[] {
    const asArg = args.find((a) => a.node === s.node);
    return asArg
      ? miniOf(asArg)
          .atoms.map((a) => a.text)
          .filter((t) => !isRest(t))
      : [];
  }

  // --- 6. form ----------------------------------------------------------------------------------------
  formChecks(info, code, find);
  return { uses, findings };
}

function meterTool(meter: LintContext["meter"]): ToolId {
  switch (meter) {
    case "3/4":
      return "tb.meter.3-4";
    case "2/4":
      return "tb.meter.2-4";
    case "6/8":
    case "9/8":
    case "12/8":
      return "tb.meter.compound";
    case "5/4":
    case "5/8":
    case "7/8":
    case "9/8i":
      return "tb.meter.odd";
    default:
      return "tb.setcpm";
  }
}

function formChecks(
  info: ProgramInfo,
  code: string,
  find: (
    id: LintCode,
    n: { start: number; end: number },
    params?: Finding["params"],
    o?: Partial<Finding>,
  ) => void,
): void {
  const tracks = arrangedTracks(info);
  if (tracks.length === 0) return;
  const result = sectionsFromProgram(info);
  if (result && "inconsistent" in result) {
    const t = tracks.find((x) => x.track === result.inconsistent.track) ?? tracks[0];
    if (t) find("form.inconsistent-arrange", t.arrange, { detail: result.inconsistent.detail });
  }
  const consts = new Map(info.consts.map((c) => [c.name, c]));
  for (const t of tracks) {
    for (const s of t.sections) {
      if (s.pattern?.type === "CallExpression" && chainOf(s.pattern).links[0]?.name === "stack") {
        find(
          "form.inconsistent-arrange",
          s.pattern,
          { detail: "one arrange() holds stacked parts; give each part its own label" },
          {
            authoredOnly: true,
          },
        );
      }
      const c = s.name ? consts.get(s.name) : undefined;
      if (!c?.init) continue;
      const ch = chainOf(c.init);
      const scale = ch.links.find((l) => l.name === "scale");
      const scaleText = stringLit(scale?.args[0] ?? null)?.value ?? "";
      if (scale && scaleText.includes("<")) find("code.arranged-scale-pattern", c.node, { name: c.name });
      // Period: a plain `<…>` source string, optionally slowed by a number.
      const src = ch.rootIsCall ? stringLit(ch.links[0]?.args[0] ?? null) : null;
      if (!src || src.quote === "'" || s.bars === null) continue;
      let period = cycleLength(src.value);
      if (period === null) continue;
      for (const l of ch.links.slice(1)) {
        if (l.name === "slow") {
          const k = numericValue(l.args[0] ?? null);
          period = k !== null && Number.isInteger(k) ? period * k : null;
        } else if (["fast", "arrange", "cat", "seq"].includes(l.name)) period = null;
        if (period === null) break;
      }
      if (period !== null && period > 1 && s.bars % period !== 0) {
        find("form.section-period", s.node, {
          name: s.name ?? code.slice(s.node.start, s.node.end),
          period,
          bars: s.bars,
        });
      }
    }
  }
}

// --- assembling the result ----------------------------------------------------------------------

const indexCache = new WeakMap<readonly ToolEntry[], ToolIndex>();
function indexFor(toolbox: readonly ToolEntry[]): ToolIndex {
  let idx = indexCache.get(toolbox);
  if (!idx) {
    idx = indexToolbox(toolbox);
    indexCache.set(toolbox, idx);
  }
  return idx;
}

function diag(
  code: string,
  id: LintCode,
  severity: LintSeverity,
  range: { start: number; end: number },
  params: Record<string, string | number>,
): LintDiagnostic {
  return {
    id: asFeedbackId(id),
    severity,
    range: { from: range.start, to: range.end },
    line: lineCol(code, range.start).line,
    params,
    message: renderLint(id, params),
  };
}

function safetyDiags(code: string, findings: readonly SafetyFinding[]): LintDiagnostic[] {
  return findings.map((f) => diag(code, f.id, "error", f, f.params));
}

const isAuthored = (p: LintProfile) => p === "content" || p === "tutor-card" || p === "band";

function lockedCode(entry: ToolEntry): LintCode {
  switch (entry.kind) {
    case "sound":
      return "code.locked-sound";
    case "scale":
      return "code.locked-scale";
    case "chord":
      return "code.locked-chord";
    default:
      return (entry.id as string).startsWith("tb.mini.") ? "code.locked-mini" : "code.locked-tool";
  }
}

function lockedSeverity(ctx: LintContext): LintSeverity | null {
  switch (ctx.profile) {
    case "graded":
      return "error";
    case "studio":
      return "info";
    case "content":
      return "error";
    case "tutor-card":
      return "info"; // the card is badged "preview" (§10.7)
    case "band":
      return null;
  }
}

interface Resolved {
  entry: ToolEntry;
  use: Use;
}

function resolveUses(scan: Scan, index: ToolIndex): { resolved: Resolved[]; unknown: Use[] } {
  const resolved: Resolved[] = [];
  const unknown: Use[] = [];
  for (const u of scan.uses) {
    const entry = u.direct ? index.byId.get(u.key) : index.lookup(u.key);
    if (entry) resolved.push({ entry, use: u });
    else if (u.reportUnknown) unknown.push(u);
  }
  return { resolved, unknown };
}

function runLint(code: string, ctx: LintContext, toolbox: readonly ToolEntry[], strict: boolean): LintResult {
  const parsed = parseProgram(code);
  const empty: LintResult = { ok: true, diagnostics: [], used: [], locked: [], lockedTools: [] };
  if (!parsed.ok) {
    const { pos, message } = parsed.error;
    const d = diag(
      code,
      "eval.syntax",
      "error",
      { start: pos, end: pos },
      { line: parsed.error.line, detail: message },
    );
    return { ...empty, ok: false, diagnostics: [d] };
  }
  const ast = parsed.ast;
  const diagnostics: LintDiagnostic[] = safetyDiags(code, baseFindings(ast));
  if (strict) diagnostics.push(...safetyDiags(code, strictFindings(ast, strictAllowedNames())));

  const scan = scanProgram(code, ast, ctx);
  for (const f of scan.findings) {
    if (f.authoredOnly && !isAuthored(ctx.profile)) continue;
    diagnostics.push(diag(code, f.id, dialectSeverity(f.id, ctx.profile, f.graded), f, f.params));
  }

  const index = indexFor(toolbox);
  const used = new Set<UnlockableId>();
  const locked = new Set<UnlockableId>();
  if (index.size > 0) {
    const { resolved, unknown } = resolveUses(scan, index);
    for (const u of unknown) {
      if (u.why === "bank") {
        diagnostics.push(
          diag(code, "code.locked-sound", dialectSeverity("code.unknown-chord", ctx.profile), u, {
            name: u.name,
            reason: "is not a bank name Oak knows (use full names like RolandTR909)",
          }),
        );
      } else {
        diagnostics.push(
          diag(code, "code.uncatalogued", dialectSeverity("code.uncatalogued", ctx.profile), u, {
            name: u.name,
            why: u.why ?? "",
          }),
        );
      }
    }
    const reported = new Set<string>();
    const lockSev = lockedSeverity(ctx);
    for (const { entry, use: u } of resolved) {
      used.add(entry.id);
      if (ctx.unlocked.has(entry.id)) continue;
      locked.add(entry.id);
      const key = `${entry.id}@${u.start}`;
      if (reported.has(key)) continue;
      reported.add(key);
      // `tool` and `lesson` are the templates' slots (code.locked-*, code.preview-tool): `lesson` is the learner's
      // words ("the lesson “Degrees in Code”"); `at` stays the session ID(s), which the Studio's hints look up.
      const params = {
        name: u.name,
        id: entry.id,
        at: unlockIds(entry),
        tool: u.name,
        lesson: unlockText(entry),
        reason: `unlocks in ${unlockText(entry)}`,
      };
      if (ctx.allowPreview) diagnostics.push(diag(code, "code.preview-tool", "info", u, params));
      else if (lockSev) diagnostics.push(diag(code, lockedCode(entry), lockSev, u, params));
    }
  }
  diagnostics.sort((a, b) => a.range.from - b.range.from || a.id.localeCompare(b.id));
  const lockedList = [...locked];
  return {
    ok: !diagnostics.some((d) => d.severity === "error"),
    diagnostics,
    used: [...used],
    locked: lockedList,
    lockedTools: lockedList.filter((id): id is ToolId => id.startsWith("tb.")),
  };
}

/** The toolbox-aware lint (contracts §3.3). */
export function lintOak(code: string, ctx: LintContext, toolbox: readonly ToolEntry[]): LintResult {
  return runLint(code, ctx, toolbox, STRICT_PROFILES.includes(ctx.profile));
}

const SAFETY_CTX: LintContext = {
  profile: "graded",
  unlocked: new Set(),
  allowPreview: false,
  meter: "4/4",
  key: null,
};

/** The base safety profile alone: syntax plus §11.3 base rules. */
export function lintBase(code: string): LintDiagnostic[] {
  const parsed = parseProgram(code);
  if (!parsed.ok) return runLint(code, SAFETY_CTX, [], false).diagnostics;
  return safetyDiags(code, baseFindings(parsed.ast));
}

/** The strict profile: base plus the strict rules (code the learner did not type). */
export function lintStrict(code: string): LintDiagnostic[] {
  const parsed = parseProgram(code);
  if (!parsed.ok) return runLint(code, SAFETY_CTX, [], false).diagnostics;
  return safetyDiags(code, [
    ...baseFindings(parsed.ast),
    ...strictFindings(parsed.ast, strictAllowedNames()),
  ]).sort((a, b) => a.range.from - b.range.from);
}

/** Every catalogued thing the code uses, in source order. `[]` when the code does not parse. */
/** The methods that shift a pattern in time by a number of cycles (`code.time-fraction-string`). */
const TIME_SHIFTS: ReadonlySet<string> = new Set(["late", "early", "off", "nudge"]);

export function toolsUsed(
  code: string,
  toolbox: readonly ToolEntry[],
): { id: string; range: { from: number; to: number } }[] {
  const parsed = parseProgram(code);
  if (!parsed.ok) return [];
  const scan = scanProgram(code, parsed.ast, SAFETY_CTX);
  const { resolved } = resolveUses(scan, indexFor(toolbox));
  return resolved
    .map(({ entry, use: u }) => ({ id: entry.id as string, range: { from: u.start, to: u.end } }))
    .sort((a, b) => a.range.from - b.range.from || a.id.localeCompare(b.id));
}
