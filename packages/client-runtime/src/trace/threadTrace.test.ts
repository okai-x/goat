import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import type { ThreadStructure } from "../state/models.ts";
import { createThreadTraceDeriver, exportThreadTrace } from "./threadTrace.ts";

const at = (second: number) => DateTime.makeUnsafe(Date.UTC(2026, 5, 20, 0, 0, second));

const run = (id: string, ordinal: number, start: number, end: number | null) => ({
  id,
  ordinal,
  status: end === null ? "running" : "completed",
  requestedAt: at(start),
  startedAt: at(start),
  completedAt: end === null ? null : at(end),
});

const attempt = (id: string, runId: string, attemptOrdinal = 1) => ({
  id,
  runId,
  attemptOrdinal,
  reason: attemptOrdinal === 1 ? "initial" : "retry",
  status: "completed",
  startedAt: null,
  completedAt: null,
});

const node = (id: string, runId: string, parentNodeId: string | null) => ({
  id,
  runId,
  parentNodeId,
  startedAt: null,
  completedAt: null,
});

const row = (
  id: string,
  runId: string,
  item: Record<string, unknown>,
  start: number,
  end: number | null,
) => ({
  sourceItemId: id,
  item: {
    id,
    runId,
    nodeId: null,
    parentItemId: null,
    providerTurnId: null,
    title: null,
    status: end === null ? "running" : "completed",
    startedAt: at(start),
    completedAt: end === null ? null : at(end),
    ...item,
  },
});

const structure = (parts: Record<string, ReadonlyArray<unknown>>) =>
  ({
    runs: [],
    attempts: [],
    nodes: [],
    subagents: [],
    providerTurns: [],
    runtimeRequests: [],
    visibleTurnItems: [],
    ...parts,
  }) as unknown as ThreadStructure;

const outline = (trace: ReturnType<ReturnType<typeof createThreadTraceDeriver>>) =>
  trace.runs.flatMap((entry) =>
    entry.spans.map((span) => `${"  ".repeat(span.depth)}${span.label}`),
  );

describe("createThreadTraceDeriver", () => {
  it("nests items under the item that owns their parent node and totals the run", () => {
    const trace = createThreadTraceDeriver()(
      structure({
        runs: [run("run-1", 1, 0, 60)],
        attempts: [attempt("attempt-1", "run-1")],
        nodes: [
          node("root", "run-1", null),
          node("agent", "run-1", "root"),
          node("cmd", "run-1", "agent"),
        ],
        providerTurns: [
          {
            id: "turn-1",
            runAttemptId: "attempt-1",
            model: "model-a",
            turnTokenUsage: { usageStatus: "complete", inputTokens: 100, outputTokens: 20 },
          },
        ],
        runtimeRequests: [{ id: "req-1", nodeId: "root", createdAt: at(30), resolvedAt: at(40) }],
        visibleTurnItems: [
          row(
            "i1",
            "run-1",
            {
              type: "subagent",
              nodeId: "agent",
              subagentId: "agent",
              prompt: "Review the diff\nmore",
              childThreadId: "child",
              driver: "codex",
            },
            1,
            20,
          ),
          row(
            "i2",
            "run-1",
            { type: "command_execution", nodeId: "cmd", input: "ls -la", status: "failed" },
            2,
            3,
          ),
          row("i3", "run-1", { type: "approval_request", requestId: "req-1" }, 30, 40),
        ],
      }),
    );

    expect(outline(trace)).toEqual([
      "Run 1",
      "  Review the diff",
      "    ls -la",
      "  Approval request",
    ]);
    expect(trace.runs[0]?.spans[0]).toMatchObject({ detail: "model-a", hasChildren: true });
    expect(trace.runs[0]?.spans[1]?.childThreadId).toBe("child");
    expect(trace.totals).toEqual({
      runCount: 1,
      toolCount: 2,
      failedCount: 1,
      durationMs: 60_000,
      waitedMs: 10_000,
      tokens: { inputTokens: 100, outputTokens: 20, cachedInputTokens: 0, complete: true },
    });
  });

  it("shows attempts only when a run was retried", () => {
    const trace = createThreadTraceDeriver()(
      structure({
        runs: [run("run-1", 1, 0, 9)],
        attempts: [attempt("a1", "run-1", 1), attempt("a2", "run-1", 2)],
        providerTurns: [{ id: "t2", runAttemptId: "a2" }],
        visibleTurnItems: [row("i1", "run-1", { type: "reasoning", providerTurnId: "t2" }, 5, 6)],
      }),
    );

    expect(outline(trace)).toEqual(["Run 1", "  Attempt 1", "  Attempt 2", "    Reasoning"]);
  });

  it("keeps a settled run reference-equal while another run changes", () => {
    const derive = createThreadTraceDeriver();
    const settled = {
      runs: [run("run-1", 1, 0, 5)],
      rows: [row("i1", "run-1", { type: "file_change", fileName: "a.ts" }, 1, 2)],
    };
    const active = run("run-2", 2, 10, null);
    const first = derive(
      structure({
        runs: [...settled.runs, active],
        visibleTurnItems: [...settled.rows, row("i2", "run-2", { type: "reasoning" }, 11, null)],
      }),
    );
    const second = derive(
      structure({
        runs: [...settled.runs, active],
        visibleTurnItems: [...settled.rows, row("i2", "run-2", { type: "reasoning" }, 11, 12)],
      }),
    );

    expect(second.runs[0]).toBe(first.runs[0]);
    expect(second.runs[1]).not.toBe(first.runs[1]);
    expect(second.runs[1]?.spans[1]?.endMs).toBe(DateTime.toEpochMillis(at(12)));
  });

  it("groups paged-in items whose run is not loaded as an earlier run, timed from its items", () => {
    const trace = createThreadTraceDeriver()(
      structure({
        runs: [run("run-9", 9, 100, 110)],
        visibleTurnItems: [row("old", "run-2", { type: "web_search", patterns: ["goat"] }, 3, 8)],
      }),
    );

    expect(outline(trace)).toEqual(["Earlier run", "  goat", "Run 9"]);
    expect(trace.runs[0]).toMatchObject({
      startMs: DateTime.toEpochMillis(at(3)),
      endMs: DateTime.toEpochMillis(at(8)),
    });
  });
});

describe("exportThreadTrace", () => {
  it("exports the span skeleton without item bodies", () => {
    const trace = createThreadTraceDeriver()(
      structure({
        runs: [run("run-1", 1, 0, 5)],
        visibleTurnItems: [
          row("i1", "run-1", { type: "command_execution", input: "secret" }, 1, 2),
        ],
      }),
    );
    const exported = exportThreadTrace(trace, { id: "thread-1", title: "T" }, false);

    expect(exported).toMatchObject({ format: "goat.trace.v1", complete: false });
    expect(exported.spans.map((span) => span.id)).toEqual(["run:run-1", "item:i1"]);
    expect(exported.spans.every((span) => !("row" in span))).toBe(true);
  });
});
