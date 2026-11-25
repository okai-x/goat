import { THEME_CSS_MAX_LENGTH } from "@goat/contracts";
import { themeCssLoadsRemoteFiles } from "./themeCss.ts";
import { ThemeCssRemoteFileError } from "./themeCssErrors.ts";
import { restrictThemeCss } from "./themeCssRestricted.ts";

/**
 * Checks theme CSS and returns the text to apply. Leaving `unrestricted` out keeps the restricted
 * policy, so a caller that forgets the setting cannot widen it. Unrestricted CSS comes back
 * unchanged; that check is early feedback, and the client drops fetching declarations on apply.
 */
export function sanitizeThemeCss(
  css: string,
  options?: { readonly unrestricted?: boolean },
): string {
  if (options?.unrestricted !== true) return restrictThemeCss(css);
  if (css.length > THEME_CSS_MAX_LENGTH) throw new Error("Theme CSS is too large");
  if (themeCssLoadsRemoteFiles(css)) throw new ThemeCssRemoteFileError();
  return css;
}
