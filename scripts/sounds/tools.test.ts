// The pack build's external tools: a missing encoder must not crash a build that renders nothing, and a frozen
// rebuild under a different LAME must say what to do instead of only "sha256 mismatch". No network.
import { describe, expect, test } from "bun:test";
import { encoderMismatchHint, explainMissingTool, installedVersion } from "./tools.ts";

const LOCKED = { lame: "LAME 64bits version 4.0 (https://lame.sourceforge.io)", flac: "flac 1.5.0" };

describe("installedVersion", () => {
  test("is empty, not a throw, when the tool is not installed", () => {
    expect(installedVersion("oak-no-such-encoder-1f3a")).toBe("");
  });
});

describe("explainMissingTool", () => {
  test("names the tool when a render needs it", () => {
    let err: unknown;
    try {
      Bun.spawnSync({ cmd: ["oak-no-such-encoder-1f3a", "-"], stdout: "pipe", stderr: "pipe" });
    } catch (e) {
      err = e;
    }
    expect(String(explainMissingTool(err))).toContain("oak-no-such-encoder-1f3a is not installed");
  });

  test("leaves other errors alone", () => {
    const other = new Error("lame failed (1): bad input");
    expect(explainMissingTool(other)).toBe(other);
  });
});

describe("encoderMismatchHint", () => {
  test("an MP3 under another LAME: names the locked version and the ways out", () => {
    const hint = encoderMismatchHint("v4/src/upright/upright_24_0.mp3", LOCKED, {
      lame: "LAME 64bits version 3.100 (http://lame.sf.net)",
      flac: "flac 1.5.0",
    });
    expect(hint).toContain(LOCKED.lame);
    expect(hint).toContain("3.100");
    expect(hint).toContain("sounds/pack/v4");
    expect(hint).toContain("--update");
  });

  test("no LAME at all is named as such", () => {
    expect(encoderMismatchHint("v4/src/rhodes/a.mp3", LOCKED, { lame: "", flac: "" })).toContain(
      "not installed",
    );
  });

  test("silent for the same LAME, for files LAME does not write, and for a lock without encoders", () => {
    expect(encoderMismatchHint("v4/src/rhodes/a.mp3", LOCKED, LOCKED)).toBe("");
    expect(encoderMismatchHint("v4/kits/oak909/bd.flac", LOCKED, { lame: "", flac: "" })).toBe("");
    expect(encoderMismatchHint("v4/src/rhodes/a.mp3", undefined, { lame: "", flac: "" })).toBe("");
  });
});
