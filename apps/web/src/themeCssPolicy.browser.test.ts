import { expect, it } from "vite-plus/test";

import { startThemeCssPolicy, themeCssUnrestricted } from "./themeCssPolicy";

const STORAGE_KEY = "goat:theme-css-unrestricted";

it("keeps the last known policy while the environment's setting is unknown", () => {
  let setting: boolean | null = null;
  let notify = () => {};
  let rechecks = 0;
  const report = (value: boolean | null) => {
    setting = value;
    notify();
  };
  using _stop = {
    [Symbol.dispose]: startThemeCssPolicy({
      read: () => setting,
      subscribe: (listener) => {
        notify = listener;
        return () => {};
      },
      onChange: () => rechecks++,
    }),
  };
  using _storage = { [Symbol.dispose]: () => window.localStorage.removeItem(STORAGE_KEY) };

  expect(themeCssUnrestricted()).toBe(false);

  report(true);
  expect(themeCssUnrestricted()).toBe(true);
  expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
  expect(rechecks).toBe(1);

  // A disconnect reports no setting; the theme must not be rechecked against a guess.
  report(null);
  expect(themeCssUnrestricted()).toBe(true);
  expect(rechecks).toBe(1);

  report(false);
  expect(themeCssUnrestricted()).toBe(false);
  expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
  expect(rechecks).toBe(2);
});
