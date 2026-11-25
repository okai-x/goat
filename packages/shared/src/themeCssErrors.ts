export class ThemeCssResourceError extends Error {
  override readonly name = "ThemeCssResourceError";
  constructor() {
    super("Images in theme CSS are not supported. Use the background setting instead.");
  }
}

export function isThemeCssResourceError(error: unknown): boolean {
  return error instanceof Error && error.name === "ThemeCssResourceError";
}

export class ThemeCssRemoteFileError extends Error {
  override readonly name = "ThemeCssRemoteFileError";
  constructor() {
    super(
      "Theme CSS cannot load remote files. Remove @import, image-set(), src(), and any url() that is not data: or #id.",
    );
  }
}

/** Why theme CSS was refused, for choosing the message to show. */
export function themeCssRejectionKind(error: unknown): "resource" | "remote" | "invalid" {
  if (isThemeCssResourceError(error)) return "resource";
  return error instanceof Error && error.name === "ThemeCssRemoteFileError" ? "remote" : "invalid";
}
