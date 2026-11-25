import { describe, expect, it } from "vite-plus/test";
import { THEME_CSS_RESTRICTED_MAX_LENGTH as THEME_CSS_MAX_LENGTH } from "@goat/contracts";
import { sanitizeThemeCss } from "./themeCssSanitizer.ts";
import { ThemeCssResourceError } from "./themeCssErrors.ts";

describe("theme CSS sanitizer", () => {
  it.each([
    '@import "https://evil.example/x.css";',
    '[data-slot="sidebar"]{background:url(https://evil.example/x)}',
    '[data-slot="sidebar"]{background:image-set("https://evil.example/x" 1x)}',
    '[data-slot="sidebar"]{background:-webkit-image-set("https://evil.example/x" 1x)}',
    '[data-slot="sidebar"]{background:image("https://evil.example/x")}',
    '[data-slot="sidebar"]{background:cross-fade(url(https://evil.example/x),red)}',
    '[data-slot="sidebar"]{background:element(#x)}',
    '[data-slot="sidebar"]{background:src("https://evil.example/x")}',
    '[data-slot="sidebar"]{background:"https://evil.example/x"}',
  ])("explains unsupported image resources", (css) => {
    expect(() => sanitizeThemeCss(css)).toThrow(ThemeCssResourceError);
  });
  it("scopes permitted styling to the theme root", () => {
    expect(sanitizeThemeCss('[data-slot="sidebar"] { color: #123456; }')).toContain(
      '[data-goat-theme-root] [data-slot="sidebar"]',
    );
  });

  it("scopes approved color variables to the theme root", () => {
    expect(sanitizeThemeCss(":root { --app-theme-canvas: #123456; }")).toBe(
      "[data-goat-theme-root]{--app-theme-canvas:#123456}",
    );
  });

  it("safely revalidates CSS already scoped by the server", () => {
    const css = sanitizeThemeCss('[data-slot="sidebar"]{color:red}');
    expect(sanitizeThemeCss(css)).toBe(css);
  });

  it.each([
    '@import "https://evil.example/x.css";',
    "@font-face { font-family: bad; src: url(https://evil.example/x.woff); }",
    "@namespace svg url(https://evil.example);",
    '[data-slot="sidebar"] { background: url(https://evil.example/x); }',
    '[data-slot="sidebar"] { background-image: url(data:image/png;base64,AA==); }',
    '[data-slot="sidebar"] { background: u\\72l(https://evil.example/x); }',
    '[data-slot="sidebar"] { color: expression(alert(1)); }',
    '[data-slot="sidebar"] { behavior: url(#x); }',
    '[data-slot="sidebar"] { -moz-binding: url(#x); }',
    ":root { --app-theme-canvas: var(--untrusted); }",
    '[data-slot="sidebar"] + body { color: red; }',
    ":root { color: red; }",
    "html { color: red; }",
    "body { color: red; }",
    '[data-slot="sidebar"] { animation: pulse 1s infinite; }',
    '[data-slot="sidebar"] { color: red; }'.repeat(THEME_CSS_MAX_LENGTH),
  ])("rejects unsafe or oversized CSS", (css) => {
    expect(() => sanitizeThemeCss(css)).toThrow();
  });
});

describe("unrestricted theme CSS", () => {
  const unrestricted = { unrestricted: true };

  it.each([
    "@keyframes pulse { to { opacity: 0.4; } } [data-thread-item] { animation: pulse 1s infinite; }",
    '[data-chat-header]::after { content: "@import url(https://example.com)"; }',
    '.dark body { background-image: url("data:image/png;base64,AA=="); }',
    ":root:not(.dark) [data-thread-details-card] { filter: url(#blur); display: none; }",
    '@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }',
    '[data-workspace-area="conversation"] { background: var(--theme-background-image) center / cover; }',
  ])("is returned unchanged when the restricted policy would refuse it: %s", (css) => {
    expect(() => sanitizeThemeCss(css)).toThrow();
    expect(sanitizeThemeCss(css, unrestricted)).toBe(css);
  });

  it.each([
    '@import "https://evil.example/x.css";',
    '[data-slot="sidebar"]{background:url(https://evil.example/x)}',
    '[data-slot="sidebar"]{background:url("/api/thing")}',
    '[data-slot="sidebar"]{background:image-set("https://evil.example/x" 1x)}',
    "@font-face { font-family: bad; src: url(https://evil.example/x.woff); }",
  ])("still refuses CSS that loads a remote file: %s", (css) => {
    expect(() => sanitizeThemeCss(css, unrestricted)).toThrow("cannot load remote files");
  });

  it("publishes a theme that fits the restricted policy the same under either policy", () => {
    const css = '[data-slot="sidebar"] { color: #123456; } :root { --app-theme-canvas: #123456; }';
    expect(sanitizeThemeCss(css, unrestricted)).toBe(sanitizeThemeCss(css));
  });

  it("accepts CSS past the restricted length up to the wire limit", () => {
    const filler = (length: number) => `/*${"x".repeat(length - 4)}*/`;
    expect(sanitizeThemeCss(filler(100_000), unrestricted)).toHaveLength(100_000);
    expect(() => sanitizeThemeCss(filler(100_001), unrestricted)).toThrow("too large");
    expect(() => sanitizeThemeCss(filler(20_001))).toThrow();
  });
});
