import { expect, it, vi } from "vite-plus/test";

import { applyThemeCss } from "./themeCss";

// These cases cover the allowUnrestrictedThemeCss setting turned on.
vi.mock("./themeCssPolicy", () => ({ themeCssUnrestricted: () => true }));

it("applies theme CSS and drops what would load a remote file past the text check", async () => {
  const probe = document.createElement("div");
  probe.dataset.themeCssProbe = "";
  document.body.append(probe);
  using _probe = { [Symbol.dispose]: () => probe.remove() };
  await using _css = { [Symbol.asyncDispose]: () => applyThemeCss(undefined) };

  // Escaped function names pass the text check; only the parsed values show what they load.
  await applyThemeCss(`
    @namespace svg url(#svg);
    @property --registered { syntax: "<url>"; inherits: false; initial-value: u\\72l(https://example.com/d); }
    @counter-style leak { system: cyclic; symbols: u\\72l(https://example.com/f); }
    @font-face { font-family: leak; src: u\\72l(https://example.com/h); }
    @keyframes leak { to { background-image: u\\72l(https://example.com/g); } }
    :root { --leak: u\\72l(https://example.com/a); }
    [data-theme-css-probe] {
      color: rgb(1, 2, 3);
      background-image: u\\72l(https://example.com/b);
      list-style-image: var(--leak);
      border-image-source: var(--registered);
      mask-image: v\\61r(--none, u\\72l(https://example.com/e));
      @media (min-width: 0px) { cursor: u\\72l(https://example.com/c), auto; }
    }
  `);

  const style = getComputedStyle(probe);
  expect(style.color).toBe("rgb(1, 2, 3)");
  expect(style.backgroundImage).toBe("none");
  expect(style.listStyleImage).toBe("none");
  expect(style.borderImageSource).toBe("none");
  expect(style.maskImage).toBe("none");
  const kept = document.adoptedStyleSheets.flatMap((sheet) =>
    Array.from(sheet.cssRules, (rule) => rule.cssText),
  );
  expect(kept.join("\n")).not.toContain("example.com");
  expect(style.cursor).toBe("auto");

  await applyThemeCss(undefined);
  expect(getComputedStyle(probe).color).not.toBe("rgb(1, 2, 3)");
});

it("keeps the animations, pseudo-elements, and data: images of an unrestricted theme", async () => {
  const probe = document.createElement("div");
  probe.dataset.themeCssProbe = "";
  document.body.append(probe);
  using _probe = { [Symbol.dispose]: () => probe.remove() };
  await using _css = { [Symbol.asyncDispose]: () => applyThemeCss(undefined) };

  await applyThemeCss(`
    @keyframes theme-probe-spin { to { rotate: 1turn; } }
    body [data-theme-css-probe] {
      animation: theme-probe-spin 9s linear infinite;
      background-image: url("data:image/png;base64,AA==");
    }
    [data-theme-css-probe]::after { content: "probe"; }
  `);

  const style = getComputedStyle(probe);
  expect(style.animationName).toBe("theme-probe-spin");
  expect(style.backgroundImage).toContain("data:image/png");
  expect(getComputedStyle(probe, "::after").content).toBe('"probe"');
});

it("refuses unrestricted theme CSS that plainly loads a remote file and applies none of it", async () => {
  const probe = document.createElement("div");
  probe.dataset.themeCssProbe = "";
  document.body.append(probe);
  using _probe = { [Symbol.dispose]: () => probe.remove() };
  await using _css = { [Symbol.asyncDispose]: () => applyThemeCss(undefined) };

  await applyThemeCss("[data-theme-css-probe] { color: rgb(1, 2, 3); }");
  await expect(
    applyThemeCss(
      "[data-theme-css-probe] { color: rgb(4, 5, 6); background: url(https://example.com/a); }",
    ),
  ).rejects.toThrow("Theme CSS cannot load remote files");
  const color = getComputedStyle(probe).color;
  expect(color).not.toBe("rgb(1, 2, 3)");
  expect(color).not.toBe("rgb(4, 5, 6)");
});

// Regression: a shorthand pending var() substitution reports empty longhands, which hid the fetch.
it.each(["background", "mask", "border-image", "list-style"])(
  "drops a %s shorthand that hides an escaped url() behind var()",
  async (shorthand) => {
    const probe = document.createElement("div");
    probe.dataset.themeCssProbe = "";
    document.body.append(probe);
    using _probe = { [Symbol.dispose]: () => probe.remove() };
    await using _css = { [Symbol.asyncDispose]: () => applyThemeCss(undefined) };

    await applyThemeCss(`
      [data-theme-css-probe] { --n: ; ${shorthand}: var(--n) u\\72l(https://example.com/a); }
      [data-theme-css-probe] { color: rgb(1, 2, 3); }
    `);

    const kept = document.adoptedStyleSheets.flatMap((sheet) =>
      Array.from(sheet.cssRules, (rule) => rule.cssText),
    );
    expect(kept.join("\n")).not.toMatch(/example\.com|72l/);
    const style = getComputedStyle(probe);
    expect(style.backgroundImage).toBe("none");
    expect(style.maskImage).toBe("none");
    expect(style.borderImageSource).toBe("none");
    expect(style.listStyleImage).toBe("none");
    expect(style.color).toBe("rgb(1, 2, 3)");
  },
);
