// Scoped keymaps (ux §7.10 as corrected by contracts §11.9). A key acts only in the region that has focus:
// regions mark themselves with `data-keyscope="<scope>"`, and the scope chain of a key press is the list of
// those marks from the focused element outwards, ending in "global". The innermost scope with a matching
// binding wins. This module is pure (no DOM access) so the rules are unit-tested; the React wiring is in
// KeymapProvider.tsx.

export const SCOPES = [
  "global",
  "editor",
  "workbench",
  "answer-pad",
  "chromatic-pad",
  "tap-pad",
  "lesson-prompt",
  "transcription",
  "tutor-composer",
  "staff-input",
  "studio",
] as const;
export type Scope = (typeof SCOPES)[number];

/** Scopes in which the global `G`-then-letter navigation is off (contracts §11.9). */
export const G_PREFIX_BLOCKERS: ReadonlySet<Scope> = new Set<Scope>([
  "editor",
  "workbench",
  "answer-pad",
  "chromatic-pad",
  "tap-pad",
  "staff-input",
]);

export interface KeyEventLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
}

export interface KeyContext {
  /** Innermost first; "global" is always last. */
  chain: readonly Scope[];
  /** Focus is in a text field, textarea, select or contenteditable (CodeMirror included). */
  inEditable: boolean;
  /** Focus is on a button, link or other control that Space would activate. */
  onControl: boolean;
  /** Lesson, drill, checkpoint and onboarding routes. */
  focusRoute: boolean;
  isMac: boolean;
  /** "Strudel-compatible Ctrl on macOS": Ctrl also counts as the Mod key. */
  macCtrl: boolean;
}

export interface Binding {
  id: string;
  /** "Mod+K", "Shift+S", "?", "Space", "Escape", "G T" (a sequence), "Alt+." … Several forms with "|". */
  keys: string;
  scope: Scope;
  description: string;
  /** Group in the shortcut sheet. */
  group?: string;
  /** Fires even while typing in a text field (Mod+K, Mod+J, panic stop). */
  allowInInput?: boolean;
  /** Extra condition; the key passes through when false. */
  when?: (ctx: KeyContext) => boolean;
  run: (ctx: KeyContext) => void;
}

// --- key normalisation ---------------------------------------------------------------------------

const CODE_KEYS: Record<string, string> = {
  Period: ".",
  Comma: ",",
  Slash: "/",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Minus: "-",
  Equal: "=",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Space: "space",
};

const NAMED: Record<string, string> = {
  " ": "space",
  Spacebar: "space",
  Esc: "escape",
  Escape: "escape",
  Enter: "enter",
  Tab: "tab",
  Backspace: "backspace",
  Delete: "delete",
  ArrowLeft: "arrowleft",
  ArrowRight: "arrowright",
  ArrowUp: "arrowup",
  ArrowDown: "arrowdown",
  Home: "home",
  End: "end",
  PageUp: "pageup",
  PageDown: "pagedown",
};

/** The base key of an event: physical for letter, digit and punctuation keys under a modifier (Alt on macOS rewrites `key`). */
export function baseKey(e: KeyEventLike): string {
  if (NAMED[e.key]) return NAMED[e.key] as string;
  const code = e.code ?? "";
  const viaCode = e.altKey || e.ctrlKey || e.metaKey;
  if (viaCode) {
    const letter = /^Key([A-Z])$/.exec(code);
    if (letter) return (letter[1] as string).toLowerCase();
    const digit = /^Digit(\d)$/.exec(code);
    if (digit) return digit[1] as string;
    if (CODE_KEYS[code]) return CODE_KEYS[code] as string;
  }
  if (e.key.length === 1) return e.key.toLowerCase();
  return e.key.toLowerCase();
}

const isLetter = (k: string) => /^[a-z]$/.test(k);
const isDigit = (k: string) => /^[0-9]$/.test(k);

/**
 * Canonical chord string, e.g. `ctrl+shift+m`, `alt+.`, `?`, `shift+s`. Shift is kept only where it changes
 * meaning: with letters, digits, named keys and other modifiers; a typed symbol (`?`, `[`) already carries it.
 */
export function chordOf(e: KeyEventLike): string {
  const k = baseKey(e);
  const viaCode = e.altKey || e.ctrlKey || e.metaKey;
  const symbol = k.length === 1 && !isLetter(k) && !isDigit(k);
  const keepShift = e.shiftKey && (!symbol || viaCode);
  const mods = [e.altKey && "alt", e.ctrlKey && "ctrl", e.metaKey && "meta", keepShift && "shift"].filter(
    Boolean,
  );
  return [...mods, k].join("+");
}

/** Expands one binding form ("Mod+Shift+M") into the canonical chords it accepts on this platform. */
export function expandChord(form: string, isMac: boolean, macCtrl: boolean): string[] {
  const parts = form.split("+").map((p) => p.trim());
  // A literal "+" key would be written "Plus".
  const key = (parts.pop() ?? "").toLowerCase();
  const keyName = key === "plus" ? "+" : key === "esc" ? "escape" : key;
  const mods = new Set(parts.map((p) => p.toLowerCase()));
  const variants: Set<string>[] = [new Set()];
  for (const m of mods) {
    if (m === "mod") {
      const options = isMac ? (macCtrl ? ["meta", "ctrl"] : ["meta"]) : ["ctrl"];
      const next: Set<string>[] = [];
      for (const v of variants)
        for (const o of options) {
          const c = new Set(v);
          c.add(o);
          next.push(c);
        }
      variants.splice(0, variants.length, ...next);
    } else {
      const name =
        m === "cmd" || m === "command" ? "meta" : m === "option" ? "alt" : m === "control" ? "ctrl" : m;
      for (const v of variants) v.add(name);
    }
  }
  const order = ["alt", "ctrl", "meta", "shift"];
  return variants.map((v) => [...order.filter((o) => v.has(o)), keyName].join("+"));
}

export interface ParsedKeys {
  /** One entry per "|" alternative; each is a sequence of chords (length 1 or 2). */
  sequences: string[][][];
}

export function parseKeys(keys: string, isMac: boolean, macCtrl: boolean): string[][][] {
  return keys.split("|").map((alt) =>
    alt
      .trim()
      .split(/\s+/)
      .map((step) => expandChord(step, isMac, macCtrl)),
  );
}

const ARROWS: Readonly<Record<string, string>> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

/** Human form for the shortcut sheet and tooltips: `⌘K` on macOS, `Ctrl+K` elsewhere; arrows as ↑ ↓ ← →. */
export function formatKeys(keys: string, isMac: boolean): string {
  const first = keys.split("|")[0]?.trim() ?? "";
  return first
    .split(/\s+/)
    .map((step) =>
      // A "+" that ends the step is the plus key itself ("+", "Shift++"), not a separator.
      step
        .split(/\+(?!$)/)
        .map((p) => {
          const l = p.toLowerCase();
          if (l === "plus") return "+";
          if (l === "mod") return isMac ? "⌘" : "Ctrl";
          if (l === "shift") return isMac ? "⇧" : "Shift";
          if (l === "alt") return isMac ? "⌥" : "Alt";
          if (l === "ctrl") return isMac ? "⌃" : "Ctrl";
          if (l === "escape") return "Esc";
          if (l === "space") return "Space";
          const arrow = ARROWS[l];
          if (arrow) return arrow;
          return p.length === 1 ? p.toUpperCase() : p;
        })
        .join(isMac ? "" : "+"),
    )
    .join(" then ");
}

// --- the registry --------------------------------------------------------------------------------

export interface KeymapOptions {
  /** How long the first key of a sequence waits for the second. */
  sequenceMs?: number;
  now?: () => number;
}

export interface Keymap {
  register(bindings: readonly Binding[]): () => void;
  /** Resolves a key press: returns the binding to run (already run when `run` is true), or `null`. */
  handle(e: KeyEventLike, ctx: KeyContext, opts?: { run?: boolean }): Binding | "pending" | null;
  list(): Binding[];
}

function isGSequence(b: Binding): boolean {
  return /^g\s+\S/i.test(b.keys.trim());
}

/** Whether a binding may fire in this context, before key matching. */
export function bindingActive(b: Binding, ctx: KeyContext): boolean {
  if (!ctx.chain.includes(b.scope)) return false;
  if (ctx.inEditable && !b.allowInInput) return false;
  if (isGSequence(b) && (ctx.focusRoute || ctx.chain.some((s) => G_PREFIX_BLOCKERS.has(s)))) return false;
  if (b.when && !b.when(ctx)) return false;
  return true;
}

export function createKeymap(options: KeymapOptions = {}): Keymap {
  const sequenceMs = options.sequenceMs ?? 1200;
  const now = options.now ?? (() => Date.now());
  const bindings = new Set<Binding>();
  let pending: { chord: string; at: number } | null = null;

  const ordered = (ctx: KeyContext): Binding[] => {
    // Innermost scope first; within a scope, registration order (later registrations win).
    const all = [...bindings].reverse();
    const rank = (b: Binding) => {
      const i = ctx.chain.indexOf(b.scope);
      return i < 0 ? Number.POSITIVE_INFINITY : i;
    };
    return all.filter((b) => bindingActive(b, ctx)).sort((a, b) => rank(a) - rank(b));
  };

  return {
    register(list) {
      for (const b of list) bindings.add(b);
      return () => {
        for (const b of list) bindings.delete(b);
      };
    },
    list: () => [...bindings],
    handle(e, ctx, opts = {}) {
      const run = opts.run ?? true;
      if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return null;
      const chord = chordOf(e);
      const candidates = ordered(ctx);
      const prev = pending && now() - pending.at <= sequenceMs ? pending.chord : null;
      pending = null;
      if (prev) {
        for (const b of candidates)
          for (const seq of parseKeys(b.keys, ctx.isMac, ctx.macCtrl))
            if (seq.length === 2 && seq[0]?.includes(prev) && seq[1]?.includes(chord)) {
              if (run) b.run(ctx);
              return b;
            }
      }
      for (const b of candidates)
        for (const seq of parseKeys(b.keys, ctx.isMac, ctx.macCtrl))
          if (seq.length === 1 && seq[0]?.includes(chord)) {
            if (e.repeat && !b.allowInInput && b.keys.toLowerCase() !== "escape") return null;
            if (run) b.run(ctx);
            return b;
          }
      for (const b of candidates)
        for (const seq of parseKeys(b.keys, ctx.isMac, ctx.macCtrl))
          if (seq.length === 2 && seq[0]?.includes(chord)) {
            pending = { chord, at: now() };
            return "pending";
          }
      return null;
    },
  };
}

/** Focus routes hide the NavRail and switch off the `G` prefix. */
export const FOCUS_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/learn\//,
  /^\/checkpoint\//,
  /^\/onboarding\//,
  /^\/session\/?$/,
  /^\/session\/coda\/?$/,
  /^\/practice\/review\/?$/,
  /^\/practice\/(?!review)[^/]+\/?$/,
  /^\/settings\/voice\/setup\/?$/,
];

export function isFocusRoute(pathname: string): boolean {
  return FOCUS_ROUTE_PATTERNS.some((r) => r.test(pathname));
}
