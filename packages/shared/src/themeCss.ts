const FETCHES_BY_STRING = /image-set\(|\bsrc\(/i;
// Only CSS whitespace may come first. \s also matches U+00A0, which makes the address relative.
const URL_NOT_LOCAL = /url\((?![ \t\n\f\r]*["']?(?:data:|#))/i;
// Read tokens left to right, as CSS does: a url( or /* inside a string loads nothing, and a quote
// in an unquoted url( or after a backslash is not a string. A quoted url() that is not data: or #id
// keeps `url(` for the check.
const ESCAPE = String.raw`\\(?:(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{1,5}(?![0-9a-fA-F]))(?:\r\n|[\n\r\f])?|\r\n|[^0-9a-fA-F])`;
const STRING = String.raw`"(?:${ESCAPE}|[^"\\\n\r\f])*"|'(?:${ESCAPE}|[^'\\\n\r\f])*'`;
const URL_OR_STRING = String.raw`url\((?![ \t\n\f\r]*["'])([^)]*)|url\([ \t\n\f\r]*(${STRING})|${STRING}|${ESCAPE}`;
const CSS_TOKENS = new RegExp(String.raw`\/\*[\s\S]*?\*\/|${URL_OR_STRING}`, "gi");

/**
 * The code with its strings and comments removed, keeping `url(` where a quoted url() can load a
 * file. A declaration value keeps a comment or quoted url() that holds an escape. In a stylesheet
 * an unquoted url() is judged by its address too.
 */
function withoutStrings(code: string, stylesheet: boolean): string {
  return code.replace(CSS_TOKENS, (token, address?: string, urlString?: string) => {
    const url = stylesheet ? (address ?? urlString) : urlString;
    if (url !== undefined) {
      if (!stylesheet && url.includes("\\")) return token;
      return /^[ \t\n\f\r]*["']?(?:data:|#)/i.test(url) ? "" : "url(";
    }
    if (token.startsWith("/*")) {
      if (stylesheet) return "";
      return token.includes("\\") ? token : " ";
    }
    return /^["']/.test(token) ? "" : token;
  });
}

function fetchesOutsideStrings(code: string): boolean {
  return FETCHES_BY_STRING.test(code) || URL_NOT_LOCAL.test(code);
}

/**
 * Whether one declaration value can load a remote file. Clients drop those declarations.
 * Values with var() can keep escapes that spell `var` or `url`. Refuse escapes that survive
 * removing plain strings, including escapes in URL addresses.
 */
export function themeCssValueFetches(value: string): boolean {
  const code = withoutStrings(value, false);
  return code.includes("\\") || fetchesOutsideStrings(code);
}

/** A text check for early feedback. CSS escapes can dodge it; the client check is the guard. */
export function themeCssLoadsRemoteFiles(css: string): boolean {
  const code = withoutStrings(css, true);
  return /@import/i.test(code) || fetchesOutsideStrings(code);
}
