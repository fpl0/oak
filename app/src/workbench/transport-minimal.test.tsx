import { describe, expect, test } from "bun:test";
import { METERS } from "@oak/theory";
import { renderToStaticMarkup } from "react-dom/server";
import { TransportBar, type TransportBarProps } from "./TransportBar.tsx";

const props = (o: Partial<TransportBarProps> = {}): TransportBarProps =>
  ({
    playing: false,
    onToggle() {},
    clock: { get: () => ({ playing: false, audibleCycle: 0 }), subscribe: () => () => {} },
    meter: METERS["4/4"],
    cps: 0.5,
    loopBars: 4,
    keySpec: { tonic: "C", mode: "major" },
    tracks: ["drums", "band.bass"],
    mutes: { muted: new Set(), solo: null },
    onMute() {},
    onSolo() {},
    practiceTempo: 1,
    onPracticeTempo() {},
    readOnly: true,
    ...o,
  }) as TransportBarProps;

describe("the minimal transport (onboarding's first loop)", () => {
  test("keeps play, the bar counter and the mute chips; leaves out tempo, key, practice, solo and the badge", () => {
    const full = renderToStaticMarkup(<TransportBar {...props()} />);
    const min = renderToStaticMarkup(<TransportBar {...props({ minimal: true })} />);
    for (const html of [full, min]) {
      expect(html).toContain('data-testid="play-toggle"');
      expect(html).toContain('data-testid="bar-counter"');
      expect(html).toContain('data-testid="mute-drums"');
      expect(html).toContain("Bass (Oak)");
    }
    // The full transport has every one of them, so their absence below is the variant's doing.
    for (const hook of ['data-testid="tempo"', "Practice 100%", 'data-testid="solo-drums"', "read-only"]) {
      expect(full).toContain(hook);
      expect(min).not.toContain(hook);
    }
  });
});
