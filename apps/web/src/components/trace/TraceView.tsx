import type { ThreadTrace, TraceSpan, TraceStatus, TraceTokens } from "@goat/client-runtime/trace";
import { formatTokens } from "@goat/shared/usageFormat";
import { LegendList } from "@legendapp/list/react";
import { memo, type ComponentType, type ReactNode, useState } from "react";

import {
  ActivityIcon,
  BotIcon,
  BrainIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleDashedIcon,
  CircleDotIcon,
  DownloadIcon,
  FileDiffIcon,
  FileSearchIcon,
  GitCommitIcon,
  GlobeIcon,
  ListTodoIcon,
  MessageCircleQuestionIcon,
  MessageSquareIcon,
  PlayIcon,
  ShieldQuestionIcon,
  TerminalIcon,
  UserRoundIcon,
  WrenchIcon,
  XIcon,
} from "~/components/solar";
import { useStableCallback } from "~/hooks/useStableCallback";
import { cn } from "~/lib/utils";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import {
  formatTraceDuration,
  spanDurationLabel,
  traceBar,
  type TraceRow,
  visibleTraceRows,
} from "./tracePanel.logic";

type Icon = ComponentType<{ readonly className?: string }>;

const KIND_ICON: Partial<Record<TraceSpan["kind"], Icon>> = {
  run: PlayIcon,
  attempt: CircleDashedIcon,
  user_message: UserRoundIcon,
  assistant_message: MessageSquareIcon,
  reasoning: BrainIcon,
  command_execution: TerminalIcon,
  file_change: FileDiffIcon,
  file_search: FileSearchIcon,
  web_search: GlobeIcon,
  dynamic_tool: WrenchIcon,
  subagent: BotIcon,
  approval_request: ShieldQuestionIcon,
  user_input_request: MessageCircleQuestionIcon,
  todo_list: ListTodoIcon,
  proposed_plan: ListTodoIcon,
  checkpoint: GitCommitIcon,
  error: CircleAlertIcon,
};

const MONO_KINDS: ReadonlySet<TraceSpan["kind"]> = new Set([
  "command_execution",
  "file_change",
  "file_search",
  "dynamic_tool",
]);

const STATUS_LABEL: Record<TraceStatus, string> = {
  pending: "Pending",
  running: "Running",
  waiting: "Waiting",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  interrupted: "Interrupted",
};

const STATUS_BADGE: Record<TraceStatus, "success" | "error" | "info" | "warning" | "secondary"> = {
  pending: "secondary",
  running: "info",
  waiting: "warning",
  completed: "success",
  failed: "error",
  cancelled: "secondary",
  interrupted: "warning",
};

/** Settled spans read by what they are; an unsettled or failed span reads by its state. */
function barClass(span: TraceSpan): string {
  switch (span.status) {
    case "failed":
      return "bg-destructive";
    case "running":
      return "bg-info";
    case "waiting":
    case "interrupted":
      return "bg-warning";
    case "pending":
    case "cancelled":
      return "bg-muted-foreground/35";
    case "completed":
      break;
  }
  if (span.kind === "run" || span.kind === "attempt") return "bg-foreground/25";
  if (span.kind === "approval_request" || span.kind === "user_input_request") return "bg-warning";
  if (span.kind === "reasoning") return "bg-info/60";
  if (span.kind === "assistant_message" || span.kind === "user_message") {
    return "bg-muted-foreground/45";
  }
  return "bg-primary/70";
}

function iconClass(span: TraceSpan): string {
  if (span.status === "failed") return "text-destructive";
  if (span.status === "running") return "text-info";
  if (span.status === "waiting") return "text-warning";
  return "text-muted-foreground";
}

const tokensLabel = (tokens: TraceTokens) =>
  `${tokens.complete ? "" : "≥ "}${formatTokens(tokens.inputTokens)} in · ${formatTokens(tokens.outputTokens)} out`;

function Stat(props: { readonly label: string; readonly value: string; readonly tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="truncate text-2xs text-muted-foreground">{props.label}</dt>
      <dd className={cn("truncate text-sm font-medium tabular-nums", props.tone)}>{props.value}</dd>
    </div>
  );
}

const GRID_LINE = "absolute inset-y-0 border-s border-border/70";

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
  const isRun = span.kind === "run";
  const KindIcon = KIND_ICON[span.kind] ?? CircleDotIcon;
  return (
    <div
      className={cn(
        "group/row relative flex h-7 items-center text-xs",
        isRun && "bg-muted/40",
        props.selected ? "bg-accent" : "hover:bg-accent/50",
      )}
      data-trace-span={span.kind}
    >
      {props.selected ? (
        <span className="absolute inset-y-0 start-0 w-0.5 bg-primary" aria-hidden />
      ) : null}
      <span className="flex h-full shrink-0 ps-2" aria-hidden>
        {Array.from({ length: span.depth }, (_, level) => (
          <span key={level} className="h-full w-3.5 border-s border-border/70 ms-[7px] -me-[7px]" />
        ))}
      </span>
      {span.hasChildren ? (
        <button
          type="button"
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
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
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 ps-1 pe-2 text-start outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
        aria-pressed={props.selected}
        onClick={() => props.onSelect(span.id)}
      >
        <KindIcon className={cn("size-3.5 shrink-0", iconClass(span))} />
        <span
          className={cn(
            "min-w-0 truncate",
            isRun && "font-medium",
            MONO_KINDS.has(span.kind) && "font-mono text-2xs",
            span.status === "failed" && "text-destructive",
          )}
        >
          {span.label}
        </span>
        {span.detail ? (
          <span className="hidden max-w-28 shrink-0 truncate rounded-sm bg-muted px-1 text-2xs text-muted-foreground @sm/trace:inline">
            {span.detail}
          </span>
        ) : null}
        <span className="ms-auto w-14 shrink-0 text-end text-2xs text-muted-foreground tabular-nums">
          {duration ?? (span.startMs !== null ? STATUS_LABEL[span.status] : "")}
        </span>
        <span className="relative ms-3 hidden h-full w-2/5 shrink-0 @md/trace:block" aria-hidden>
          <span className={cn(GRID_LINE, "start-0")} />
          <span className={cn(GRID_LINE, "start-1/4")} />
          <span className={cn(GRID_LINE, "start-1/2")} />
          <span className={cn(GRID_LINE, "start-3/4")} />
          {bar ? (
            <span
              className={cn(
                "absolute top-1/2 min-w-[3px] -translate-y-1/2 rounded-sm",
                isRun ? "h-1" : "h-2.5",
                barClass(span),
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

function SpanDetail(props: {
  readonly span: TraceSpan;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const { span } = props;
  const KindIcon = KIND_ICON[span.kind] ?? CircleDotIcon;
  const duration = spanDurationLabel(span);
  const facts = [
    duration || null,
    span.detail,
    span.tokens ? tokensLabel(span.tokens) : null,
    span.waitedMs !== null ? `Waited ${formatTraceDuration(span.waitedMs)} for a reply` : null,
  ].filter((fact) => fact !== null);
  return (
    <section
      className="flex max-h-[45%] shrink-0 flex-col border-t border-border bg-background"
      aria-label="Span details"
    >
      <header className="flex shrink-0 items-center gap-2 px-3 py-2">
        <KindIcon className={cn("size-4 shrink-0", iconClass(span))} />
        <p className="min-w-0 flex-1 truncate text-xs font-medium">{span.label}</p>
        <Badge variant={STATUS_BADGE[span.status]} size="sm">
          {STATUS_LABEL[span.status]}
        </Badge>
        <Button
          size="icon-xs"
          variant="ghost-muted"
          aria-label="Close details"
          onClick={props.onClose}
        >
          <XIcon />
        </Button>
      </header>
      {facts.length > 0 ? (
        <p className="shrink-0 px-3 pb-2 text-2xs text-muted-foreground">{facts.join("  ·  ")}</p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 empty:hidden">{props.children}</div>
    </section>
  );
}

const rowKey = (row: TraceRow) => row.span.id;

export interface TraceViewProps {
  readonly trace: ThreadTrace;
  /** Set while earlier history is not loaded; the trace then starts mid-thread. */
  readonly earlier: { readonly loading: boolean; readonly onLoad: () => void } | null;
  readonly onExport: () => void;
  /** The body of the detail pane for a span, and any action that belongs beside it. */
  readonly renderDetail: (span: TraceSpan) => ReactNode;
}

export function TraceView(props: TraceViewProps) {
  const { trace } = props;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const rows = visibleTraceRows(trace, collapsed);
  const selected =
    selectedId === null
      ? null
      : (trace.runs.flatMap((run) => run.spans).find((span) => span.id === selectedId) ?? null);
  const { totals } = trace;

  if (rows.length === 0) {
    return (
      <Empty data-trace-panel>
        <EmptyMedia variant="icon">
          <ActivityIcon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No trace yet</EmptyTitle>
          <EmptyDescription>
            Runs, tool calls and their timing appear here once an agent starts working.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="@container/trace flex h-full min-h-0 flex-col bg-background" data-trace-panel>
      <header className="flex shrink-0 items-start gap-3 border-b border-border/60 px-3 py-2.5">
        <dl className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(4.5rem,max-content))] gap-x-5 gap-y-1.5">
          <Stat label="Duration" value={formatTraceDuration(totals.durationMs)} />
          <Stat label="Runs" value={String(totals.runCount)} />
          <Stat label="Tool calls" value={String(totals.toolCount)} />
          {totals.failedCount > 0 ? (
            <Stat label="Failed" value={String(totals.failedCount)} tone="text-destructive" />
          ) : null}
          {totals.tokens ? (
            <Stat
              label="Tokens in / out"
              value={`${totals.tokens.complete ? "" : "≥ "}${formatTokens(totals.tokens.inputTokens)} / ${formatTokens(totals.tokens.outputTokens)}`}
            />
          ) : null}
        </dl>
        <Button size="xs" variant="outline" onClick={props.onExport}>
          <DownloadIcon className="size-3.5" />
          Export
        </Button>
      </header>
      {props.earlier ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-1 text-2xs text-muted-foreground">
          <span className="min-w-0 truncate">
            Showing recent runs only. Totals leave out earlier ones.
          </span>
          <Button
            size="xs"
            variant="ghost"
            disabled={props.earlier.loading}
            onClick={props.earlier.onLoad}
          >
            Load earlier
          </Button>
        </div>
      ) : null}
      <div className="flex h-6 shrink-0 items-center border-b border-border/60 ps-3 pe-2 text-2xs text-muted-foreground">
        <span className="min-w-0 flex-1">Span</span>
        <span className="w-14 shrink-0 text-end">Time</span>
        <span className="ms-3 hidden w-2/5 shrink-0 @md/trace:block">Timeline, per run</span>
      </div>
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
        recycleItems={false}
        className="min-h-0 flex-1 overscroll-contain"
      />
      {selected ? (
        <SpanDetail key={selected.id} span={selected} onClose={() => setSelectedId(null)}>
          {props.renderDetail(selected)}
        </SpanDetail>
      ) : null}
    </div>
  );
}
