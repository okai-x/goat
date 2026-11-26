import type { ThreadId } from "@goat/contracts";
import * as DateTime from "effect/DateTime";

import type { ThreadStructure, ThreadStructureVisibleTurnItem } from "../state/models.ts";

type Run = ThreadStructure["runs"][number];
type Attempt = ThreadStructure["attempts"][number];
type ProviderTurn = ThreadStructure["providerTurns"][number];
type Row = ThreadStructureVisibleTurnItem;
type Item = Row["item"];

export type TraceStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export interface TraceTokens {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  /** False when a provider turn reported partial usage, so the sum is a lower bound. */
  readonly complete: boolean;
}

export interface TraceSpan {
  readonly id: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly kind: "run" | "attempt" | Item["type"];
  readonly label: string;
  readonly detail: string | null;
  readonly status: TraceStatus;
  readonly startMs: number | null;
  /** Null while the span is still open. */
  readonly endMs: number | null;
  readonly hasChildren: boolean;
  /** The turn item behind the span; null for runs and attempts. */
  readonly row: Row | null;
  readonly childThreadId: ThreadId | null;
  readonly tokens: TraceTokens | null;
  /** Time an approval or question waited for a person. */
  readonly waitedMs: number | null;
}

export interface TraceRun {
  readonly id: string;
  /** The run span first, then its descendants in display order. */
  readonly spans: ReadonlyArray<TraceSpan>;
  readonly startMs: number | null;
  readonly endMs: number | null;
}

export interface TraceTotals {
  readonly runCount: number;
  readonly toolCount: number;
  readonly failedCount: number;
  readonly durationMs: number;
  readonly waitedMs: number;
  readonly tokens: TraceTokens | null;
}

export interface ThreadTrace {
  readonly runs: ReadonlyArray<TraceRun>;
  readonly totals: TraceTotals;
}

const TOOL_TYPES: ReadonlySet<Item["type"]> = new Set([
  "command_execution",
  "file_change",
  "file_search",
  "web_search",
  "dynamic_tool",
  "subagent",
]);

function isToolSpan(span: TraceSpan): boolean {
  return TOOL_TYPES.has(span.kind as Item["type"]);
}

const toMs = (value: DateTime.Utc | null | undefined): number | null =>
  value == null ? null : DateTime.toEpochMillis(value);

function toStatus(status: string): TraceStatus {
  switch (status) {
    case "running":
    case "waiting":
    case "completed":
    case "failed":
    case "interrupted":
      return status;
    case "cancelled":
    case "rolled_back":
    case "superseded":
      return "cancelled";
    default:
      return "pending";
  }
}

const firstLine = (text: string | null | undefined): string | null => {
  const line = text?.trim().split("\n", 1)[0]?.trim();
  return line ? line.slice(0, 200) : null;
};

function itemLabel(item: Item, subagentTitle: string | null): string {
  const specific = (() => {
    switch (item.type) {
      case "command_execution":
        return firstLine(item.input);
      case "file_change":
        return item.fileName;
      case "file_search":
        return firstLine(item.pattern);
      case "web_search":
        return firstLine(item.patterns?.[0]);
      case "dynamic_tool":
        return item.toolName;
      case "subagent":
        return subagentTitle ?? firstLine(item.prompt);
      default:
        return null;
    }
  })();
  return firstLine(item.title) ?? specific ?? item.type.replaceAll("_", " ");
}

function sumTokens(turns: ReadonlyArray<ProviderTurn>): TraceTokens | null {
  let found = false;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let complete = true;
  for (const turn of turns) {
    const usage = turn.turnTokenUsage;
    if (usage === undefined || usage.usageStatus === "unavailable") continue;
    found = true;
    inputTokens += usage.inputTokens ?? 0;
    outputTokens += usage.outputTokens ?? 0;
    cachedInputTokens += usage.cachedInputTokens ?? 0;
    if (usage.usageStatus !== "complete") complete = false;
  }
  return found ? { inputTokens, outputTokens, cachedInputTokens, complete } : null;
}

function addTokens(left: TraceTokens | null, right: TraceTokens | null): TraceTokens | null {
  if (left === null || right === null) return left ?? right;
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
    complete: left.complete && right.complete,
  };
}

interface RunInputs {
  readonly run: Run | null;
  readonly attempts: ReadonlyArray<Attempt>;
  readonly turns: ReadonlyArray<ProviderTurn>;
  readonly rows: ReadonlyArray<Row>;
  /** Read through Lookups; listed here so a change to one rebuilds the run. */
  readonly related: ReadonlyArray<object>;
}

interface Lookups {
  readonly nodeById: ReadonlyMap<string, ThreadStructure["nodes"][number]>;
  readonly subagentById: ReadonlyMap<string, ThreadStructure["subagents"][number]>;
  readonly requestById: ReadonlyMap<string, ThreadStructure["runtimeRequests"][number]>;
}

function buildRun(id: string, input: RunInputs, lookups: Lookups): TraceRun {
  const { run, rows } = input;
  const rootId = `run:${id}`;
  const showAttempts = input.attempts.length > 1;
  const attemptIdByTurnId = new Map(
    input.turns.map((turn) => [String(turn.id), turn.runAttemptId]),
  );
  const spanIdByNodeId = new Map<string, string>();
  for (const row of rows) {
    const nodeId = row.item.nodeId;
    if (nodeId !== null && !spanIdByNodeId.has(nodeId)) spanIdByNodeId.set(nodeId, itemId(row));
  }
  const itemIds = new Set(rows.map(itemId));

  const parentOf = (row: Row): string => {
    let nodeId = lookups.nodeById.get(row.item.nodeId ?? "")?.parentNodeId ?? null;
    // Bounded: a malformed parent cycle must not hang the panel.
    for (let hops = 0; nodeId !== null && hops < 64; hops += 1) {
      const spanId = spanIdByNodeId.get(nodeId);
      if (spanId !== undefined && spanId !== itemId(row)) return spanId;
      nodeId = lookups.nodeById.get(nodeId)?.parentNodeId ?? null;
    }
    const byItem = row.item.parentItemId === null ? null : `item:${row.item.parentItemId}`;
    if (byItem !== null && itemIds.has(byItem) && byItem !== itemId(row)) return byItem;
    const attemptId = attemptIdByTurnId.get(row.item.providerTurnId ?? "");
    return showAttempts && attemptId != null ? `attempt:${attemptId}` : rootId;
  };

  const childrenOf = new Map<string, Array<Omit<TraceSpan, "depth" | "hasChildren">>>();
  const addChild = (span: Omit<TraceSpan, "depth" | "hasChildren">) => {
    const siblings = childrenOf.get(span.parentId ?? "");
    if (siblings) siblings.push(span);
    else childrenOf.set(span.parentId ?? "", [span]);
  };

  if (showAttempts) {
    for (const attempt of input.attempts) {
      addChild({
        id: `attempt:${attempt.id}`,
        parentId: rootId,
        kind: "attempt",
        label: `Attempt ${attempt.attemptOrdinal}`,
        detail: attempt.reason.replaceAll("_", " "),
        status: toStatus(attempt.status),
        startMs: toMs(attempt.startedAt),
        endMs: toMs(attempt.completedAt),
        row: null,
        childThreadId: null,
        tokens: sumTokens(input.turns.filter((turn) => turn.runAttemptId === attempt.id)),
        waitedMs: null,
      });
    }
  }

  let firstMs: number | null = null;
  let lastMs: number | null = null;
  for (const row of rows) {
    const item = row.item;
    const node = lookups.nodeById.get(item.nodeId ?? "");
    const endMs = toMs(item.completedAt) ?? toMs(node?.completedAt);
    const startMs = toMs(item.startedAt) ?? toMs(node?.startedAt) ?? endMs;
    if (startMs !== null && (firstMs === null || startMs < firstMs)) firstMs = startMs;
    const edge = endMs ?? startMs;
    if (edge !== null && (lastMs === null || edge > lastMs)) lastMs = edge;
    const subagent = item.type === "subagent" ? lookups.subagentById.get(item.subagentId) : null;
    const request =
      item.type === "approval_request" || item.type === "user_input_request"
        ? lookups.requestById.get(item.requestId)
        : undefined;
    const resolvedMs = toMs(request?.resolvedAt);
    addChild({
      id: itemId(row),
      parentId: parentOf(row),
      kind: item.type,
      label: itemLabel(item, subagent?.title ?? null),
      detail: item.type === "subagent" ? (subagent?.model ?? item.driver) : null,
      status: toStatus(item.status),
      startMs,
      endMs,
      row,
      childThreadId: item.type === "subagent" ? item.childThreadId : null,
      tokens: null,
      waitedMs:
        request === undefined || resolvedMs === null
          ? null
          : Math.max(0, resolvedMs - DateTime.toEpochMillis(request.createdAt)),
    });
  }

  const startMs =
    run === null ? firstMs : toMs(run.workStartedAt ?? run.startedAt ?? run.requestedAt);
  const endMs = run === null ? lastMs : toMs(run.completedAt);
  const spans: TraceSpan[] = [];
  const emit = (span: Omit<TraceSpan, "depth" | "hasChildren">, depth: number) => {
    const children = childrenOf.get(span.id) ?? [];
    spans.push({ ...span, depth, hasChildren: children.length > 0 });
    for (const child of children) emit(child, depth + 1);
  };
  emit(
    {
      id: rootId,
      parentId: null,
      kind: "run",
      label: run === null ? "Earlier run" : `Run ${run.ordinal}`,
      detail: input.turns.reduce<string | null>((model, turn) => turn.model ?? model, null),
      status: run === null ? "completed" : toStatus(run.status),
      startMs,
      endMs,
      row: null,
      childThreadId: null,
      tokens: sumTokens(input.turns),
      waitedMs: null,
    },
    0,
  );
  return {
    id,
    spans,
    startMs,
    endMs: endMs ?? (lastMs !== null && startMs !== null ? Math.max(lastMs, startMs) : lastMs),
  };
}

const itemId = (row: Row): string => `item:${row.sourceItemId}`;

function groupBy<T>(values: ReadonlyArray<T>, keyOf: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const group = groups.get(key);
    if (group) group.push(value);
    else groups.set(key, [value]);
  }
  return groups;
}

function sameRefs<T>(left: ReadonlyArray<T>, right: ReadonlyArray<T>): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameInputs(left: RunInputs, right: RunInputs): boolean {
  return (
    left.run === right.run &&
    sameRefs(left.attempts, right.attempts) &&
    sameRefs(left.turns, right.turns) &&
    sameRefs(left.rows, right.rows) &&
    sameRefs(left.related, right.related)
  );
}

function totalsOf(runs: ReadonlyArray<TraceRun>): TraceTotals {
  let toolCount = 0;
  let failedCount = 0;
  let durationMs = 0;
  let waitedMs = 0;
  let tokens: TraceTokens | null = null;
  for (const run of runs) {
    if (run.startMs !== null && run.endMs !== null) durationMs += run.endMs - run.startMs;
    tokens = addTokens(tokens, run.spans[0]?.tokens ?? null);
    for (const span of run.spans) {
      if (isToolSpan(span)) toolCount += 1;
      if (span.row !== null && span.status === "failed") failedCount += 1;
      waitedMs += span.waitedMs ?? 0;
    }
  }
  return { runCount: runs.length, toolCount, failedCount, durationMs, waitedMs, tokens };
}

/**
 * Builds a deriver that turns a thread's structure into its trace. It keeps the previous
 * TraceRun for every run whose inputs are unchanged, so rows of settled runs stay
 * reference-equal while the active run updates.
 */
export function createThreadTraceDeriver(): (structure: ThreadStructure) => ThreadTrace {
  let cache = new Map<string, { readonly inputs: RunInputs; readonly run: TraceRun }>();
  let previous: ThreadTrace | null = null;
  return (structure) => {
    const attemptsByRun = groupBy(structure.attempts, (attempt) => attempt.runId);
    const runIdByAttemptId = new Map(
      structure.attempts.map((attempt) => [String(attempt.id), String(attempt.runId)]),
    );
    const turnsByRun = groupBy(
      structure.providerTurns,
      (turn) => runIdByAttemptId.get(turn.runAttemptId ?? "") ?? "",
    );
    const rowsByRun = groupBy(structure.visibleTurnItems, (row) => row.item.runId ?? "");
    const runIdByNodeId = new Map(
      structure.nodes.map((node) => [String(node.id), node.runId ?? ""]),
    );
    const relatedByRun = groupBy<object>(
      [...structure.nodes, ...structure.subagents],
      (entry) => (entry as { readonly runId: string | null }).runId ?? "",
    );
    for (const request of structure.runtimeRequests) {
      const runId = runIdByNodeId.get(request.nodeId) ?? "";
      const related = relatedByRun.get(runId);
      if (related) related.push(request);
      else relatedByRun.set(runId, [request]);
    }
    const runById = new Map(structure.runs.map((run) => [String(run.id), run]));
    const lookups: Lookups = {
      nodeById: new Map(structure.nodes.map((node) => [String(node.id), node])),
      subagentById: new Map(structure.subagents.map((subagent) => [String(subagent.id), subagent])),
      requestById: new Map(
        structure.runtimeRequests.map((request) => [String(request.id), request]),
      ),
    };
    // Paged-in history brings items whose runs the projection no longer holds; they come first.
    const order = [...rowsByRun.keys()].filter((id) => id !== "" && !runById.has(id));
    for (const run of structure.runs) order.push(run.id);

    const nextCache = new Map<string, { readonly inputs: RunInputs; readonly run: TraceRun }>();
    const runs = order.map((id) => {
      const inputs: RunInputs = {
        run: runById.get(id) ?? null,
        attempts: attemptsByRun.get(id) ?? [],
        turns: turnsByRun.get(id) ?? [],
        rows: rowsByRun.get(id) ?? [],
        related: relatedByRun.get(id) ?? [],
      };
      const cached = cache.get(id);
      const entry =
        cached !== undefined && sameInputs(cached.inputs, inputs)
          ? cached
          : { inputs, run: buildRun(id, inputs, lookups) };
      nextCache.set(id, entry);
      return entry.run;
    });
    cache = nextCache;
    if (previous !== null && sameRefs(previous.runs, runs)) return previous;
    previous = { runs, totals: totalsOf(runs) };
    return previous;
  };
}

const THREAD_TRACE_EXPORT_FORMAT = "goat.trace.v1";

/** A portable skeleton of the trace: structure and timing, without message or tool bodies. */
export function exportThreadTrace(
  trace: ThreadTrace,
  thread: { readonly id: string; readonly title: string },
  complete: boolean,
) {
  return {
    format: THREAD_TRACE_EXPORT_FORMAT,
    thread,
    /** False when earlier history was not loaded, so the trace starts mid-thread. */
    complete,
    totals: trace.totals,
    spans: trace.runs.flatMap((run) =>
      run.spans.map(({ row: _row, depth: _depth, hasChildren: _hasChildren, ...span }) => span),
    ),
  };
}
