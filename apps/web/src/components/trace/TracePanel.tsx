import { isCompleteTurnItemRow } from "@goat/client-runtime/state/threads";
import {
  createThreadTraceDeriver,
  exportThreadTrace,
  type ThreadTrace,
  type TraceSpan,
} from "@goat/client-runtime/trace";
import type { ScopedThreadRef, ThreadId } from "@goat/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { ArrowUpRightIcon } from "~/components/solar";
import { downloadPlanAsTextFile } from "~/proposedPlan";
import { useQuietThreadProjection, useThreadHistory, useThreadProjection } from "~/state/entities";
import { buildThreadRouteParams } from "~/threadRoutes";

import ChatMarkdown from "../ChatMarkdown";
import { useThreadHistoryControls } from "../chat/useThreadHistoryControls";
import { V2ItemInspector } from "../chat/V2ItemInspector";
import { Button } from "../ui/button";
import { TraceView } from "./TraceView";

const EMPTY_TRACE: ThreadTrace = {
  runs: [],
  totals: { runCount: 0, toolCount: 0, failedCount: 0, durationMs: 0, waitedMs: 0, tokens: null },
};

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
    <div className="text-xs">
      <ChatMarkdown
        text={row.item.text}
        cwd={props.cwd}
        threadRef={{ environmentId: props.threadRef.environmentId, threadId: row.sourceThreadId }}
      />
    </div>
  );
}

export default function TracePanel(props: {
  readonly threadRef: ScopedThreadRef;
  readonly workspaceRoot: string | undefined;
}) {
  const { threadRef, workspaceRoot } = props;
  const structure = useQuietThreadProjection(threadRef);
  const history = useThreadHistory(threadRef);
  const historyControls = useThreadHistoryControls(threadRef, history);
  const navigate = useNavigate();
  const [deriveTrace] = useState(createThreadTraceDeriver);

  const trace = structure === null ? EMPTY_TRACE : deriveTrace(structure.projection);
  const hasMoreHistory = historyControls?.hasMoreHistory === true;
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
  const renderDetail = (span: TraceSpan) => {
    const childThreadId = span.childThreadId;
    return (
      <div className="space-y-2">
        {childThreadId ? (
          <Button size="xs" variant="outline" onClick={() => openThread(childThreadId)}>
            Open subagent thread
            <ArrowUpRightIcon className="size-3.5" />
          </Button>
        ) : null}
        {span.row === null ? null : isCompleteTurnItemRow(span.row) ? (
          <V2ItemInspector
            projectedItem={span.row}
            environmentId={threadRef.environmentId}
            cwd={workspaceRoot}
            workspaceRoot={workspaceRoot}
            onOpenThread={openThread}
          />
        ) : (
          <StreamedSpanBody
            threadRef={threadRef}
            itemId={span.row.sourceItemId}
            cwd={workspaceRoot}
            onOpenThread={openThread}
          />
        )}
      </div>
    );
  };

  return (
    <TraceView
      trace={trace}
      earlier={
        hasMoreHistory && historyControls
          ? { loading: historyControls.loading, onLoad: () => historyControls.onLoadEarlier() }
          : null
      }
      onExport={exportTrace}
      renderDetail={renderDetail}
    />
  );
}
