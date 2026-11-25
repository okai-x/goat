export class ThemeCssResourceError extends Error {
  override readonly name = "ThemeCssResourceError";
  constructor() {
    super(
      "Theme CSS cannot load remote files. Remove @import, image-set(), src(), and any url() that is not data: or #id.",
    );
  }
}

export function isThemeCssResourceError(error: unknown): boolean {
  return error instanceof Error && error.name === "ThemeCssResourceError";
}
