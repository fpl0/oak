// A prompt's inline code (`InlineMd`): punctuation right after a chip hugs it and never wraps to the next line alone
// (J1.L01's task card read ".scale() ." with a gap).
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineMd } from "./frame.tsx";

describe("InlineMd", () => {
  test("punctuation after a code chip hugs it", () => {
    const html = renderToStaticMarkup(
      <InlineMd text="a vibes line on `.scale()`. Then `rd`, and **more**" />,
    );
    expect(html).toContain(
      '<span class="whitespace-nowrap"><code class="rounded bg-surface-2 py-0.5 font-mono text-[0.9em] ring-1 ring-control-border ring-inset dark:ring-0 pl-1 pr-0.5">.scale()</code>.</span>',
    );
    expect(html).toContain(
      '<code class="rounded bg-surface-2 py-0.5 font-mono text-[0.9em] ring-1 ring-control-border ring-inset dark:ring-0 pl-1 pr-0.5">rd</code>,</span> and <strong>more</strong>',
    );
    expect(html).not.toContain("</code> .");
  });

  test("an opening bracket before a chip hugs it too", () => {
    const html = renderToStaticMarkup(<InlineMd text="the ride cymbal (`rd`) plays" />);
    expect(html).toContain(
      '(<span class="whitespace-nowrap"><code class="rounded bg-surface-2 py-0.5 font-mono text-[0.9em] ring-1 ring-control-border ring-inset dark:ring-0 pl-0.5 pr-0.5">rd</code>)</span> plays',
    );
  });

  test("a chip with no punctuation after it keeps its padding and the text runs on", () => {
    const html = renderToStaticMarkup(<InlineMd text="type `bd` here" />);
    expect(html).toBe(
      '<span>type <code class="rounded bg-surface-2 py-0.5 font-mono text-[0.9em] ring-1 ring-control-border ring-inset dark:ring-0 pl-1 pr-1">bd</code> here</span>',
    );
  });

  test("the chip draws its edge with a hairline in Paper and keeps Bark's fill alone", () => {
    // Paper's bg-lane-in (the task card, callouts) is the chip's own tone: without the ring the chip vanished.
    const html = renderToStaticMarkup(<InlineMd text="`rd`" />);
    expect(html).toContain("ring-1 ring-control-border ring-inset");
    expect(html).toContain("dark:ring-0");
  });
});
