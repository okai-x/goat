import { ActivityIcon } from "~/components/solar";

/** The right panel's "Trace" entry, shared by its add menu and its empty state. */
export const traceSurfaceAction = (onAdd: (() => void) | undefined) => ({
  label: "Trace",
  icon: ActivityIcon,
  shortcut: "R",
  available: onAdd !== undefined,
  disabledReason: "A trace is available once the thread has been sent.",
  onClick: onAdd ?? (() => undefined),
});
