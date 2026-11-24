import { describe, expect, test } from "bun:test";
import {
  type Binding,
  bindingActive,
  chordOf,
  createKeymap,
  expandChord,
  formatKeys,
  isFocusRoute,
  type KeyContext,
  type KeyEventLike,
  type Scope,
} from "./keymap.ts";

const ev = (key: string, mods: Partial<KeyEventLike> = {}, code?: string): KeyEventLike => ({
  key,
  code: code ?? (/^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : undefined),
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

const ctx = (over: Partial<KeyContext> = {}): KeyContext => ({
  chain: ["global"],
  inEditable: false,
  onControl: false,
  focusRoute: false,
  isMac: true,
  macCtrl: true,
  ...over,
});

function bind(keys: string, scope: Scope = "global", extra: Partial<Binding> = {}) {
  const calls: string[] = [];
  const b: Binding = {
    id: `${scope}:${keys}`,
    keys,
    scope,
    description: keys,
    run: () => calls.push(keys),
    ...extra,
  };
  return { b, calls };
}

describe("chords", () => {
  test("letters keep Shift, typed symbols do not", () => {
    expect(chordOf(ev("S", { shiftKey: true }))).toBe("shift+s");
    expect(chordOf(ev("s"))).toBe("s");
    expect(chordOf(ev("?", { shiftKey: true }, "Slash"))).toBe("?");
    expect(chordOf(ev(" ", {}, "Space"))).toBe("space");
  });

  test("Alt on macOS rewrites key; the physical code is used instead", () => {
    // Option+. types "≥" on a US layout.
    expect(chordOf(ev("≥", { altKey: true }, "Period"))).toBe("alt+.");
    expect(chordOf(ev("œ", { altKey: true }, "KeyQ"))).toBe("alt+q");
  });

  test("Mod expands to Cmd on macOS (and Ctrl with the Strudel-compatible option), Ctrl elsewhere", () => {
    expect(expandChord("Mod+K", true, true).sort()).toEqual(["ctrl+k", "meta+k"]);
    expect(expandChord("Mod+K", true, false)).toEqual(["meta+k"]);
    expect(expandChord("Mod+K", false, true)).toEqual(["ctrl+k"]);
    expect(expandChord("Mod+Shift+M", false, false)).toEqual(["ctrl+shift+m"]);
  });

  test("formats for the platform", () => {
    expect(formatKeys("Mod+K", true)).toBe("⌘K");
    expect(formatKeys("Mod+Shift+M", false)).toBe("Ctrl+Shift+M");
    expect(formatKeys("G T", false)).toBe("G then T");
    expect(formatKeys("Shift+ArrowUp", true)).toBe("⇧↑");
    expect(formatKeys("Mod+ArrowDown", false)).toBe("Ctrl+↓");
    expect(formatKeys("ArrowLeft", false)).toBe("←");
    expect(formatKeys("+", false)).toBe("+");
    expect(formatKeys("+", true)).toBe("+");
    expect(formatKeys("Shift++", false)).toBe("Shift++");
    expect(formatKeys("Mod++", true)).toBe("⌘+");
    expect(formatKeys("Mod+Plus", false)).toBe("Ctrl++");
  });
});

describe("scopes", () => {
  test("a key acts only in its scope; the innermost scope wins", () => {
    const km = createKeymap();
    const space = bind("Space");
    const tap = bind("Space", "tap-pad");
    km.register([space.b, tap.b]);
    km.handle(ev(" ", {}, "Space"), ctx());
    expect(space.calls).toEqual(["Space"]);
    km.handle(ev(" ", {}, "Space"), ctx({ chain: ["tap-pad", "global"] }));
    expect(tap.calls).toEqual(["Space"]);
    expect(space.calls).toHaveLength(1);
  });

  test("chromatic typing keys are live only while a chromatic pad has focus", () => {
    const km = createKeymap();
    const w = bind("W", "chromatic-pad");
    km.register([w.b]);
    expect(km.handle(ev("w"), ctx({ chain: ["answer-pad", "global"] }))).toBeNull();
    expect(km.handle(ev("w"), ctx({ chain: ["chromatic-pad", "answer-pad", "global"] }))).not.toBeNull();
    expect(w.calls).toEqual(["W"]);
  });

  test("Shift+S skips singing; plain S is a note key", () => {
    const km = createKeymap();
    const skip = bind("Shift+S", "answer-pad");
    const note = bind("S", "chromatic-pad");
    km.register([skip.b, note.b]);
    const chain: Scope[] = ["chromatic-pad", "answer-pad", "global"];
    km.handle(ev("s"), ctx({ chain }));
    km.handle(ev("S", { shiftKey: true }), ctx({ chain }));
    expect(note.calls).toEqual(["S"]);
    expect(skip.calls).toEqual(["Shift+S"]);
  });

  test("typing in a field only lets through bindings marked allowInInput", () => {
    const km = createKeymap();
    const help = bind("?");
    const palette = bind("Mod+K", "global", { allowInInput: true });
    km.register([help.b, palette.b]);
    expect(km.handle(ev("?", { shiftKey: true }, "Slash"), ctx({ inEditable: true }))).toBeNull();
    km.handle(ev("k", { metaKey: true }), ctx({ inEditable: true }));
    expect(palette.calls).toEqual(["Mod+K"]);
    expect(help.calls).toEqual([]);
  });

  test("Space does not fire on focused buttons when the binding says so", () => {
    const b = bind("Space", "global", { when: (c) => !c.onControl }).b;
    expect(bindingActive(b, ctx({ onControl: true }))).toBe(false);
    expect(bindingActive(b, ctx())).toBe(true);
  });
});

describe("G-then-letter navigation", () => {
  test("G T goes to Today", () => {
    let t = 0;
    const km = createKeymap({ now: () => t });
    const today = bind("G T");
    km.register([today.b]);
    expect(km.handle(ev("g"), ctx())).toBe("pending");
    t = 300;
    km.handle(ev("t"), ctx());
    expect(today.calls).toEqual(["G T"]);
  });

  test("the second key must come within the sequence window", () => {
    let t = 0;
    const km = createKeymap({ now: () => t, sequenceMs: 1000 });
    const today = bind("G T");
    km.register([today.b]);
    km.handle(ev("g"), ctx());
    t = 1500;
    expect(km.handle(ev("t"), ctx())).toBeNull();
    expect(today.calls).toEqual([]);
  });

  test("disabled in focus routes and while the workbench or an answer pad has focus", () => {
    const km = createKeymap();
    const today = bind("G T");
    km.register([today.b]);
    expect(km.handle(ev("g"), ctx({ focusRoute: true }))).toBeNull();
    expect(km.handle(ev("g"), ctx({ chain: ["workbench", "global"] }))).toBeNull();
    expect(km.handle(ev("g"), ctx({ chain: ["answer-pad", "global"] }))).toBeNull();
    expect(km.handle(ev("g"), ctx({ chain: ["editor", "global"] }))).toBeNull();
  });

  test("unregister removes bindings", () => {
    const km = createKeymap();
    const a = bind("?");
    const off = km.register([a.b]);
    off();
    expect(km.handle(ev("?", { shiftKey: true }, "Slash"), ctx())).toBeNull();
  });

  test("panic stop works from anywhere, including text fields, with Ctrl, Cmd or Alt", () => {
    const km = createKeymap();
    const stop = bind("Mod+.|Ctrl+.|Alt+.", "global", { allowInInput: true });
    km.register([stop.b]);
    km.handle(ev(".", { ctrlKey: true }, "Period"), ctx({ inEditable: true, isMac: true, macCtrl: false }));
    km.handle(ev(".", { metaKey: true }, "Period"), ctx({ isMac: true }));
    km.handle(ev("≥", { altKey: true }, "Period"), ctx({ chain: ["tap-pad", "global"] }));
    expect(stop.calls).toHaveLength(3);
  });
});

describe("focus routes", () => {
  test.each([
    ["/learn/U01.L02", true],
    ["/checkpoint/U03", true],
    ["/onboarding/1", true],
    ["/session", true],
    ["/session/coda", true],
    ["/practice/review", true],
    ["/practice/fam.deg.major", true],
    ["/settings/voice/setup", true],
    ["/", false],
    ["/practice", false],
    ["/studio/abc", false],
    ["/settings/voice", false],
    ["/capstone/C1", false],
  ])("%s → %p", (path, focus) => {
    expect(isFocusRoute(path)).toBe(focus);
  });
});
