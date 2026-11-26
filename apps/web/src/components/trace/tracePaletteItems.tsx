import { scopeThreadRef } from "@goat/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@goat/contracts";

import { ActivityIcon } from "~/components/solar";
import { useRightPanelStore } from "~/rightPanelStore";

import { type CommandPaletteActionItem, ITEM_ICON_CLASS } from "../CommandPalette.logic";

/** The command palette's entry for the open thread's trace. */
export function tracePaletteItems(
  thread: { readonly environmentId: EnvironmentId; readonly id: ThreadId } | null,
): CommandPaletteActionItem[] {
  if (thread === null) return [];
  return [
    {
      kind: "action",
      value: "action:show-trace",
      searchTerms: ["trace", "timeline", "waterfall", "spans", "tool calls", "duration"],
      title: "Show trace",
      icon: <ActivityIcon className={ITEM_ICON_CLASS} />,
      run: async () => {
        useRightPanelStore
          .getState()
          .open(scopeThreadRef(thread.environmentId, thread.id), "trace");
      },
    },
  ];
}
