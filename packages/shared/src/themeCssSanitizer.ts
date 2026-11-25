import { THEME_CSS_MAX_LENGTH } from "@goat/contracts";
import { themeCssLoadsRemoteFiles } from "./themeCss.ts";
import { ThemeCssRemoteFileError } from "./themeCssErrors.ts";
import { restrictThemeCss } from "./themeCssRestricted.ts";

/**
 * Returns the theme CSS to apply. Without `unrestricted` the restricted policy holds, so a caller
 * that forgets the setting cannot widen it. CSS that fits the restricted policy is scoped the same
 * under either policy. Other unrestricted CSS comes back unchanged; the client guards its fetches.
 */
export function sanitizeThemeCss(
  css: string,
  options?: { readonly unrestricted?: boolean },
): string {
  if (options?.unrestricted !== true) return restrictThemeCss(css);
  try {
    return restrictThemeCss(css);
  } catch {
    // Not a restricted theme; judge it by the unrestricted rule below.
  }
  if (css.length > THEME_CSS_MAX_LENGTH) throw new Error("Theme CSS is too large");
  if (themeCssLoadsRemoteFiles(css)) throw new ThemeCssRemoteFileError();
  return css;
}
