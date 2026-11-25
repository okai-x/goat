import { useGT } from "gt-react";

import { ScopedSwitch } from "./ScopedSwitch";
import { SettingsRow } from "./settingsLayout";
import { useSettingsScope } from "./SettingsScopeContext";
import {
  useScopedSettings,
  useScopedSettingsWriteAllowed,
  useUpdateScopedSettings,
} from "./useScopedSettings";

export function UnrestrictedThemeCssSetting() {
  const gt = useGT();
  const title = gt("Unrestricted theme CSS");
  const { scope } = useSettingsScope();
  const settings = useScopedSettings();
  const update = useUpdateScopedSettings();
  const allowed = useScopedSettingsWriteAllowed();
  const projectScope = scope.kind === "project" || scope.kind === "checkout";
  return (
    <SettingsRow
      title={title}
      serverScoped
      settingKeys={["allowUnrestrictedThemeCss"]}
      description={gt(
        "Let a theme's CSS restyle, animate, move, or hide any part of the app, as themes made for upstream T3 Code do. Such a theme can slow the app or make it hard to use. It still cannot load remote files.",
      )}
      control={
        <ScopedSwitch
          settingKeys={["allowUnrestrictedThemeCss"]}
          aria-label={title}
          checked={settings.allowUnrestrictedThemeCss}
          disabled={!allowed || projectScope}
          onCheckedChange={(checked) => update({ allowUnrestrictedThemeCss: Boolean(checked) })}
        />
      }
    />
  );
}
