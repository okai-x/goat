import { THEME_CSS_MAX_LENGTH } from "@goat/contracts";
import { themeCssLoadsRemoteFiles } from "./themeCss.ts";
import { ThemeCssResourceError } from "./themeCssErrors.ts";

export { THEME_CSS_MAX_LENGTH };

/**
 * Accepts any theme CSS that fits and does not load remote files, and returns it unchanged.
 * This is early feedback only: the client drops fetching declarations when it applies the CSS.
 */
export function sanitizeThemeCss(css: string): string {
  if (css.length > THEME_CSS_MAX_LENGTH) throw new Error("Theme CSS is too large");
  if (themeCssLoadsRemoteFiles(css)) throw new ThemeCssResourceError();
  return css;
}
