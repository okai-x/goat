import type { ThreadTrace, TraceRun, TraceSpan } from "@goat/client-runtime/trace";
import { describe, expect, it } from "vite-plus/test";

import { formatTraceDuration, traceBar, visibleTraceRows } from "./tracePanel.logic";

const span = (id: string, depth: number, startMs: number | null, endMs: number | null) =>
  ({ id, depth, startMs, endMs }) as TraceSpan;

const run = (spans: ReadonlyArray<TraceSpan>, startMs = 0, endMs = 100): TraceRun => ({
  id: spans[0]?.id ?? "run",
  spans,
  startMs,
  endMs,
});

describe("visibleTraceRows", () => {
  it("hides every descendant of a collapsed span and nothing after it", () => {
    const trace = {
      runs: [
        run([
          span("r1", 0, 0, 100),
          span("a", 1, 0, 50),
          span("a1", 2, 0, 10),
          span("b", 1, 50, 100),
        ]),
        run([span("r2", 0, 0, 100), span("c", 1, 0, 100)]),
      ],
    } as unknown as ThreadTrace;

    const ids = (collapsed: string[]) =>
      visibleTraceRows(trace, new Set(collapsed)).map((row) => row.span.id);

    expect(ids(["a"])).toEqual(["r1", "a", "b", "r2", "c"]);
    expect(ids(["r1"])).toEqual(["r1", "r2", "c"]);
  });
});

describe("traceBar", () => {
  it("places a span on its run's axis and runs an open span to the run's end", () => {
    const owner = run([], 1_000, 2_000);

    expect(traceBar(span("done", 1, 1_250, 1_500), owner)).toEqual({
      leftPercent: 25,
      widthPercent: 25,
      open: false,
    });
    expect(traceBar(span("open", 1, 1_500, null), owner)).toEqual({
      leftPercent: 50,
      widthPercent: 50,
      open: true,
    });
    expect(traceBar(span("untimed", 1, null, null), owner)).toBeNull();
  });
});

describe("formatTraceDuration", () => {
  it("scales its unit with the duration", () => {
    expect([450, 4_200, 42_000, 125_000, 3_780_000].map(formatTraceDuration)).toEqual([
      "450ms",
      "4.2s",
      "42s",
      "2m 05s",
      "1h 03m",
    ]);
  });
});
