import { useSyncExternalStore } from "react";
import { useMessages } from "gt-react";
import {
  THEME_CSS_INVALID_MESSAGE,
  THEME_CSS_REMOTE_MESSAGE,
  THEME_CSS_RESOURCE_MESSAGE,
} from "./themeCssMessages";

type Rejection = "resource" | "remote" | "invalid";
const MESSAGES = {
  resource: THEME_CSS_RESOURCE_MESSAGE,
  remote: THEME_CSS_REMOTE_MESSAGE,
  invalid: THEME_CSS_INVALID_MESSAGE,
};
let rejected: false | Rejection = false;
const listeners = new Set<() => void>();
export function setThemeCssRejected(value: false | Rejection) {
  rejected = value;
  for (const listener of listeners) listener();
}
export function ThemeCssRejectionNotice() {
  const m = useMessages();
  const visible = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => rejected,
    () => false as const,
  );
  return visible ? (
    <div
      role="alert"
      className="fixed right-4 top-4 z-[100] rounded-md border bg-background p-3 text-sm text-foreground shadow-lg"
    >
      {m(MESSAGES[visible])}
    </div>
  ) : null;
}
