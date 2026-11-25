import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { useState, type ReactNode } from "react";
import { render } from "../test/render";
import { getDefaultThemeColors, installCustomTheme, removeCustomThemes } from "./themePalette";
import { useCustomThemes } from "./hooks/useCustomThemes";
import { setAppearanceMode, setTheme, useTheme } from "./hooks/useTheme";
import { ThemeLibrary } from "./components/settings/ThemeSettings";
import { ThemeCssRejectionNotice } from "./themeCssRejection";
import "./index.css";

vi.mock("./components/settings/settingsLayout", () => ({
  SettingsRow: ({ title, control }: { title: string; control: ReactNode }) => (
    <div>
      <h3>{title}</h3>
      {control}
    </div>
  ),
}));
vi.mock("./components/settings/ThemeImportDialog", () => ({ ThemeImportDialog: () => null }));

function Appearance() {
  const theme = useTheme();
  const customThemes = useCustomThemes();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ThemeCssRejectionNotice />
      <ThemeLibrary
        appearanceMode={theme.appearanceMode}
        customThemes={customThemes}
        initialAppearance={theme.resolvedTheme}
        isImportOpen={open}
        refreshTheme={theme.refreshTheme}
        setAppearanceMode={theme.setAppearanceMode}
        setTheme={theme.setTheme}
        setThemeHalf={theme.setThemeHalf}
        theme={theme.theme}
        themeHalves={theme.themeHalves}
        onImportOpenChange={setOpen}
      />
    </>
  );
}

it("selects a stored theme whose CSS changes layout and animates", async () => {
  installCustomTheme({
    id: "layout-css",
    label: "Layout CSS",
    appearance: "dark",
    colors: getDefaultThemeColors("dark"),
    css: '@keyframes drift{to{translate:4px}} [data-slot="sidebar"]{position:relative;animation:drift 9s infinite}',
  });
  try {
    setTheme("grove");
    setAppearanceMode("dark");
    await using screen = await render(<Appearance />);
    const trigger = screen.getByRole("button", { name: /^Theme:/ });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Layout CSS/ }));
    await expect.element(trigger).toHaveAccessibleName(/Layout CSS for dark mode$/);
    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  } finally {
    setTheme("system");
    removeCustomThemes(["layout-css"]);
  }
});
