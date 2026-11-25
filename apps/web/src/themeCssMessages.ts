import { msg } from "gt-react";

export const THEME_CSS_RESOURCE_MESSAGE = msg(
  "Theme CSS cannot load remote files. Remove @import, image-set(), src(), and any url() that is not data: or #id.",
);
export const THEME_CSS_INVALID_MESSAGE = msg(
  "This theme cannot be applied because its CSS is too large.",
);
