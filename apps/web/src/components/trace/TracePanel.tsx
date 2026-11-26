import { isCompleteTurnItemRow } from "@goat/client-runtime/state/threads";
import {
  createThreadTraceDeriver,
  exportThreadTrace,
  type ThreadTrace,
  type TraceSpan,
  type TraceStatus,
  type TraceTokens,
} from "@goat/client-runtime/trace";
import type { ScopedThreadRef, ThreadId } from "@goat/contracts";
import { formatTokens } from "@goat/shared/usageFormat";
import { LegendList } from "@legendapp/list/react";
import { useNavigate } from "@tanstack/react-router";
import { memo, useState } from "react";

import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
} from "~/components/solar";
import { useStableCallback } from "~/hooks/useStableCallback";
import { cn } from "~/lib/utils";
import { downloadPlanAsTextFile } from "~/proposedPlan";
import { useQuietThreadProjection, useThreadHistory, useThreadProjection } from "~/state/entities";
import { buildThreadRouteParams } from "~/threadRoutes";

import ChatMarkdown from "../ChatMarkdown";
import { useThreadHistoryControls } from "../chat/useThreadHistoryControls";
import { V2ItemInspector } from "../chat/V2ItemInspector";
import { Button } from "../ui/button";
import {
  formatTraceDuration,
  spanDurationLabel,
  traceBar,
  type TraceRow,
  visibleTraceRows,
} from "./tracePanel.logic";

const STATUS_DOT: Record<TraceStatus, string> = {
  pending: "bg-muted-foreground/40",
  running: "bg-info",
  waiting: "bg-warning",
  completed: "bg-success",
  failed: "bg-destructive",
  cancelled: "bg-muted-foreground/60",
  interrupted: "bg-warning",
};

const STATUS_BAR: Record<TraceStatus, string> = {
  pending: "bg-muted-foreground/30",
  running: "bg-info/70",
  waiting: "bg-warning/70",
  completed: "bg-primary/55",
  failed: "bg-destructive/70",
  cancelled: "bg-muted-foreground/40",
  interrupted: "bg-warning/60",
};

const tokensLabel = (tokens: TraceTokens) =>
  `${tokens.complete ? "" : "≥ "}${formatTokens(tokens.inputTokens)} in · ${formatTokens(tokens.outputTokens)} out`;

const TraceRowView = memo(function TraceRowView(props: {
  readonly row: TraceRow;
  readonly selected: boolean;
  readonly collapsed: boolean;
  readonly onSelect: (spanId: string) => void;
  readonly onToggle: (spanId: string) => void;
}) {
  const { span, run } = props.row;
  const bar = traceBar(span, run);
  const duration = spanDurationLabel(span);
  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1 rounded-sm pe-2 text-xs",
        props.selected ? "bg-accent" : "hover:bg-accent/50",
        span.kind === "run" && "font-medium",
      )}
      style={{ paddingInlineStart: span.depth * 12 + 4 }}
      data-trace-span={span.kind}
    >
      {span.hasChildren ? (
        <button
          type="button"
          className="flex size-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={props.collapsed ? `Expand ${span.label}` : `Collapse ${span.label}`}
          aria-expanded={!props.collapsed}
          onClick={() => props.onToggle(span.id)}
        >
          {props.collapsed ? (
            <ChevronRightIcon className="size-3" />
          ) : (
            <ChevronDownIcon className="size-3" />
          )}
        </button>
      ) : (
        <span className="size-4 shrink-0" />
      )}
      <button
        type="button"
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-start"
        aria-pressed={props.selected}
        onClick={() => props.onSelect(span.id)}
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[span.status])}
          role="img"
          aria-label={span.status}
        />
        <span className="min-w-0 truncate">{span.label}</span>
        {span.detail ? (
          <span className="hidden shrink-0 text-muted-foreground @sm/trace:inline">
            {span.detail}
          </span>
        ) : null}
        <span className="ms-auto shrink-0 ps-2 text-2xs text-muted-foreground tabular-nums">
          {duration ?? (span.endMs === null && span.startMs !== null ? span.status : "")}
        </span>
        <span
          className="relative hidden h-2 w-2/5 shrink-0 rounded-full bg-muted/40 @md/trace:block"
          aria-hidden
        >
          {bar ? (
            <span
              className={cn(
                "absolute inset-y-0 min-w-0.5 rounded-full",
                STATUS_BAR[span.status],
                bar.open && "rounded-e-none opacity-60",
              )}
              style={{ insetInlineStart: `${bar.leftPercent}%`, width: `${bar.widthPercent}%` }}
            />
          ) : null}
        </span>
      </button>
    </div>
  );
});

/** Reads the live thread, so it re-renders on each streamed chunk; mounted only for a selected message. */
function StreamedSpanBody(props: {
  readonly threadRef: ScopedThreadRef;
  readonly itemId: string;
  readonly cwd: string | undefined;
  readonly onOpenThread: (threadId: ThreadId) => void;
}) {
  const thread = useThreadProjection(props.threadRef);
  const row = thread?.projection.visibleTurnItems.find(
    (entry) => entry.sourceItemId === props.itemId,
  );
  if (row === undefined) return null;
  if (row.item.type !== "assistant_message") {
    return (
      <V2ItemInspector
        projectedItem={row}
        environmentId={props.threadRef.environmentId}
        cwd={props.cwd}
        onOpenThread={props.onOpenThread}
      />
    );
  }
  return (
    <ChatMarkdown
      text={row.item.text}
      cwd={props.cwd}
      threadRef={{ environmentId: props.threadRef.environmentId, threadId: row.sourceThreadId }}
    />
  );
}

function SpanDetail(props: {
  readonly span: TraceSpan;
  readonly threadRef: ScopedThreadRef;
  readonly workspaceRoot: string | undefined;
  readonly onOpenThread: (threadId: ThreadId) => void;
}) {
  const { span } = props;
  const duration = spanDurationLabel(span);
  const facts = [
    span.status,
    duration,
    span.tokens ? tokensLabel(span.tokens) : null,
    span.waitedMs !== null ? `waited ${formatTraceDuration(span.waitedMs)} for a reply` : null,
  ].filter((fact) => fact !== null);
  const childThreadId = span.childThreadId;
  return (
    <section
      className="max-h-1/2 shrink-0 space-y-2 overflow-y-auto border-t border-border/60 p-2"
      aria-label="Span details"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{span.label}</p>
          <p className="text-2xs text-muted-foreground">{facts.join(" · ")}</p>
        </div>
        {childThreadId ? (
          <Button size="xs" variant="ghost" onClick={() => props.onOpenThread(childThreadId)}>
            Open thread
            <ArrowUpRightIcon className="size-3.5" />
          </Button>
        ) : null}
      </header>
      {span.row === null ? null : isCompleteTurnItemRow(span.row) ? (
        <V2ItemInspector
          projectedItem={span.row}
          environmentId={props.threadRef.environmentId}
          cwd={props.workspaceRoot}
          workspaceRoot={props.workspaceRoot}
          onOpenThread={props.onOpenThread}
        />
      ) : (
        <StreamedSpanBody
          threadRef={props.threadRef}
          itemId={span.row.sourceItemId}
          cwd={props.workspaceRoot}
          onOpenThread={props.onOpenThread}
        />
      )}
    </section>
  );
}

const rowKey = (row: TraceRow) => row.span.id;
const EMPTY_TRACE: ThreadTrace = {
  runs: [],
  totals: { runCount: 0, toolCount: 0, failedCount: 0, durationMs: 0, waitedMs: 0, tokens: null },
};

export default function TracePanel(props: {
  readonly threadRef: ScopedThreadRef;
  readonly workspaceRoot: string | undefined;
}) {
  const { threadRef } = props;
  const structure = useQuietThreadProjection(threadRef);
  const history = useThreadHistory(threadRef);
  const historyControls = useThreadHistoryControls(threadRef, history);
  const navigate = useNavigate();
  const [deriveTrace] = useState(createThreadTraceDeriver);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const trace = structure === null ? EMPTY_TRACE : deriveTrace(structure.projection);
  const rows = visibleTraceRows(trace, collapsed);
  const selected =
    selectedId === null
      ? null
      : (trace.runs.flatMap((run) => run.spans).find((span) => span.id === selectedId) ?? null);
  const { totals } = trace;
  const hasMoreHistory = historyControls?.hasMoreHistory === true;

  const toggle = useStableCallback((spanId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(spanId)) next.add(spanId);
      return next;
    }),
  );
  const select = useStableCallback((spanId: string) =>
    setSelectedId((current) => (current === spanId ? null : spanId)),
  );
  const openThread = (threadId: ThreadId) =>
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams({ environmentId: threadRef.environmentId, threadId }),
    });
  const exportTrace = () =>
    downloadPlanAsTextFile(
      `trace-${threadRef.threadId}.json`,
      `${JSON.stringify(
        exportThreadTrace(
          trace,
          { id: threadRef.threadId, title: structure?.projection.thread.title ?? "" },
          !hasMoreHistory,
        ),
        null,
        2,
      )}\n`,
    );

  return (
    <div className="@container/trace flex h-full min-h-0 flex-col" data-trace-panel>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-2 py-1.5 text-2xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {totals.runCount} {totals.runCount === 1 ? "run" : "runs"} ·{" "}
          {formatTraceDuration(totals.durationMs)} · {totals.toolCount} tools
          {totals.failedCount > 0 ? (
            <span className="text-destructive"> · {totals.failedCount} failed</span>
          ) : null}
          {totals.tokens ? ` · ${tokensLabel(totals.tokens)}` : null}
        </span>
        <Button size="xs" variant="ghost" disabled={rows.length === 0} onClick={exportTrace}>
          <DownloadIcon className="size-3.5" />
          Export
        </Button>
      </header>
      {hasMoreHistory ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-2 py-1 text-2xs text-muted-foreground">
          <span>Earlier runs are not loaded, so totals cover only what is shown.</span>
          <Button
            size="xs"
            variant="ghost"
            disabled={historyControls?.loading === true}
            onClick={() => historyControls?.onLoadEarlier()}
          >
            Load earlier
          </Button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">
          This thread has no runs yet. Its trace appears once an agent starts working.
        </p>
      ) : (
        <LegendList<TraceRow>
          data={rows}
          keyExtractor={rowKey}
          extraData={{ selectedId, collapsed }}
          renderItem={({ item }) => (
            <TraceRowView
              row={item}
              selected={item.span.id === selectedId}
              collapsed={collapsed.has(item.span.id)}
              onSelect={select}
              onToggle={toggle}
            />
          )}
          estimatedItemSize={28}
          drawDistance={420}
          className="min-h-0 flex-1 overscroll-contain p-1.5"
        />
      )}
      {selected ? (
        <SpanDetail
          key={selected.id}
          span={selected}
          threadRef={threadRef}
          workspaceRoot={props.workspaceRoot}
          onOpenThread={openThread}
        />
      ) : null}
    </div>
  );
}
