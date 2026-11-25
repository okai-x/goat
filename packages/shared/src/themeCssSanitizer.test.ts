import { describe, expect, it } from "vite-plus/test";
import { sanitizeThemeCss, THEME_CSS_MAX_LENGTH } from "./themeCssSanitizer.ts";
import { ThemeCssResourceError } from "./themeCssErrors.ts";

describe("theme CSS check", () => {
  it.each([
    '@import "https://evil.example/x.css";',
    '[data-slot="sidebar"]{background:url(https://evil.example/x)}',
    '[data-slot="sidebar"]{background:url("/api/thing")}',
    '[data-slot="sidebar"]{background:image-set("https://evil.example/x" 1x)}',
    '[data-slot="sidebar"]{background:-webkit-image-set("https://evil.example/x" 1x)}',
    '[data-slot="sidebar"]{background:cross-fade(url(https://evil.example/x),red)}',
    "@font-face { font-family: bad; src: url(https://evil.example/x.woff); }",
    "@namespace svg url(https://evil.example);",
  ])("refuses CSS that loads a remote file: %s", (css) => {
    expect(() => sanitizeThemeCss(css)).toThrow(ThemeCssResourceError);
  });

  it.each([
    "@keyframes pulse { to { opacity: 0.4; } } [data-thread-item] { animation: pulse 1s infinite; }",
    '[data-chat-header]::after { content: "@import url(https://example.com)"; }',
    '.dark body { background-image: url("data:image/png;base64,AA=="); }',
    ":root:not(.dark) [data-thread-details-card] { filter: url(#blur); display: none; }",
    "@media (prefers-reduced-motion: no-preference) { html.dark { --glow: 1; } }",
    '@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }',
    '[data-workspace-area="conversation"] { background: var(--theme-background-image) center / cover; }',
  ])("returns CSS written for T3 Code unchanged: %s", (css) => {
    expect(sanitizeThemeCss(css)).toBe(css);
  });

  it("refuses CSS over the size limit", () => {
    expect(() => sanitizeThemeCss(" ".repeat(THEME_CSS_MAX_LENGTH + 1))).toThrow(
      "Theme CSS is too large",
    );
    expect(sanitizeThemeCss(" ".repeat(THEME_CSS_MAX_LENGTH))).toHaveLength(THEME_CSS_MAX_LENGTH);
  });
});
