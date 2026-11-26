import type { ThreadTrace, TraceRun, TraceSpan } from "@goat/client-runtime/trace";

export interface TraceRow {
  readonly span: TraceSpan;
  readonly run: TraceRun;
}

/** The trace's spans in display order, without the descendants of collapsed spans. */
export function visibleTraceRows(
  trace: ThreadTrace,
  collapsed: ReadonlySet<string>,
): ReadonlyArray<TraceRow> {
  const rows: TraceRow[] = [];
  for (const run of trace.runs) {
    let hiddenBelow: number | null = null;
    for (const span of run.spans) {
      if (hiddenBelow !== null) {
        if (span.depth > hiddenBelow) continue;
        hiddenBelow = null;
      }
      rows.push({ span, run });
      if (collapsed.has(span.id)) hiddenBelow = span.depth;
    }
  }
  return rows;
}

export interface TraceBar {
  readonly leftPercent: number;
  readonly widthPercent: number;
  /** The span has not ended; its bar runs to the end of what the run has recorded. */
  readonly open: boolean;
}

/** Where a span sits on its run's own time axis, or null when it has no start time. */
export function traceBar(span: TraceSpan, run: TraceRun): TraceBar | null {
  if (span.startMs === null || run.startMs === null || run.endMs === null) return null;
  const total = Math.max(1, run.endMs - run.startMs);
  const start = Math.min(Math.max(span.startMs, run.startMs), run.endMs);
  const end = Math.min(Math.max(span.endMs ?? run.endMs, start), run.endMs);
  return {
    leftPercent: ((start - run.startMs) / total) * 100,
    widthPercent: ((end - start) / total) * 100,
    open: span.endMs === null,
  };
}

export function formatTraceDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  const seconds = milliseconds / 1_000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(Math.floor(seconds % 60)).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function spanDurationLabel(span: TraceSpan): string | null {
  if (span.startMs === null || span.endMs === null) return null;
  return formatTraceDuration(span.endMs - span.startMs);
}
