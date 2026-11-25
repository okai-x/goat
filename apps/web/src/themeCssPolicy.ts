import { migratingStorage } from "@goat/client-runtime/storage-migration";
import { useSyncExternalStore } from "react";

// The theme paints before the environment connects, so the last known answer is kept on this
// device. Without it a theme with unrestricted CSS would be refused, and deselected, on each start.
const STORAGE_KEY = "goat:theme-css-unrestricted";
const listeners = new Set<() => void>();

function readCached(): boolean {
  try {
    return migratingStorage(window.localStorage).getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

let unrestricted = typeof window === "undefined" ? false : readCached();

/** Whether the theme environment's allowUnrestrictedThemeCss setting is on. Off until known. */
export function themeCssUnrestricted(): boolean {
  return unrestricted;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemeCssUnrestricted(): boolean {
  return useSyncExternalStore(subscribe, themeCssUnrestricted, () => false);
}

/**
 * Follows the setting. `read` answers null while the environment's settings are unknown, which
 * keeps the last answer. `onChange` reapplies the theme so its CSS is checked under the new policy.
 */
export function startThemeCssPolicy(source: {
  readonly read: () => boolean | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly onChange: () => void;
}): () => void {
  const sync = () => {
    const next = source.read();
    if (next === null || next === unrestricted) return;
    unrestricted = next;
    try {
      migratingStorage(window.localStorage).setItem(STORAGE_KEY, String(next));
    } catch {
      // The policy still holds for this session when storage is unavailable.
    }
    source.onChange();
    for (const listener of listeners) listener();
  };
  const unsubscribe = source.subscribe(sync);
  sync();
  return unsubscribe;
}
