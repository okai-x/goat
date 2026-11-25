// @effect-diagnostics nodeBuiltinImport:off - the guarded file read needs open
// flags (O_NOFOLLOW, O_NONBLOCK) the FileSystem service does not expose.
import * as NodeFS from "node:fs";

import {
  EnvironmentTheme,
  EnvironmentThemeFile,
  EnvironmentThemeId,
  environmentThemeFileHasColors,
  THEME_CSS_MAX_LENGTH,
  THEME_CSS_RESTRICTED_MAX_LENGTH,
  ThemeCssValidationError,
} from "@goat/contracts";
import { UNPUBLISHABLE_THEME_IDS } from "@goat/shared/themePalettes";
import { sanitizeThemeCss } from "@goat/shared/themeCssSanitizer";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

import * as ServerConfig from "./config.ts";
import { ServerSettingsService } from "./serverSettings.ts";
import { supervise } from "./backgroundSupervision.ts";
import { fileWatchResync } from "./fileWatchResync.ts";
import { readThemeDirectory } from "./themeDirectory.ts";
import {
  MAX_THEME_BACKGROUND_TOTAL_BYTES,
  themeBackgroundRevision,
} from "./assets/themeBackgroundFile.ts";

const decodeEnvironmentThemeFileJsonExit = Schema.decodeUnknownExit(
  Schema.fromJsonString(EnvironmentThemeFile),
);
const isEnvironmentThemeId = Schema.is(EnvironmentThemeId);

const THEME_FILE_SUFFIX = ".json";

export const MAX_THEME_FILES = 32;
/** Shared with publishing so it cannot accept files the watcher skips. */
/**
 * The largest theme file under either policy, for readers that only need the file's bytes.
 * JSON can spend six bytes on one CSS character; the rest is room for the colors.
 */
export const MAX_THEME_FILE_BYTES = 6 * THEME_CSS_MAX_LENGTH + 16 * 1024;

/** Themes a client can decode: one that predates unrestricted theme CSS fails on longer CSS. */
export const themesForClient = (
  themes: ReadonlyArray<EnvironmentTheme>,
  decodesUnrestrictedCss: boolean,
): ReadonlyArray<EnvironmentTheme> =>
  decodesUnrestrictedCss
    ? themes
    : themes.filter((theme) => (theme.css?.length ?? 0) <= THEME_CSS_RESTRICTED_MAX_LENGTH);

/** Size limits for the theme CSS policy in force. Publishing and the watcher must agree on them. */
export const themeFileLimits = (unrestricted: boolean) =>
  unrestricted
    ? { fileBytes: MAX_THEME_FILE_BYTES, totalBytes: 2 * 1024 * 1024 }
    : { fileBytes: 32 * 1024, totalBytes: 192 * 1024 };

interface PublishedThemes {
  readonly seq: number;
  readonly themes: ReadonlyArray<EnvironmentTheme>;
}

export class EnvironmentThemeService extends Context.Service<
  EnvironmentThemeService,
  {
    readonly current: Effect.Effect<ReadonlyArray<EnvironmentTheme>>;
    readonly validateCss: (css: string) => Effect.Effect<string, ThemeCssValidationError>;

    /** Subscribes before reading to retain changes during connection. */
    readonly streamChanges: Stream.Stream<ReadonlyArray<EnvironmentTheme>>;
  }
>()("goat/environmentTheme/EnvironmentThemeService") {}

/** Validates and reads one handle; rejects symlinked files, allows symlinked directories.
 * Uses non-blocking opens against FIFOs; Windows lacks these flags and checks symlinks with lstat. */
export const readThemeFileGuarded = (filePath: string, maxBytes: number): string | null => {
  let fd: number;
  try {
    if (NodeFS.constants.O_NOFOLLOW === undefined && NodeFS.lstatSync(filePath).isSymbolicLink()) {
      return null;
    }
    fd = NodeFS.openSync(
      filePath,
      NodeFS.constants.O_RDONLY |
        (NodeFS.constants.O_NOFOLLOW ?? 0) |
        (NodeFS.constants.O_NONBLOCK ?? 0),
    );
  } catch {
    return null;
  }
  try {
    const info = NodeFS.fstatSync(fd);
    if (!info.isFile() || info.size > maxBytes) return null;
    const contents = Buffer.alloc(info.size);
    let offset = 0;
    while (offset < contents.length) {
      const read = NodeFS.readSync(fd, contents, offset, contents.length - offset, offset);
      if (read <= 0) break;
      offset += read;
    }
    // Unlike Buffer#toString, TextDecoder drops a UTF-8 BOM, which JSON.parse rejects.
    return new TextDecoder().decode(contents.subarray(0, offset));
  } catch {
    return null;
  } finally {
    NodeFS.closeSync(fd);
  }
};

/** `unrestricted` is the allowUnrestrictedThemeCss setting; left out, the restricted policy applies. */
export const readPublishedThemes = Effect.fn(function* (themesDir: string, unrestricted = false) {
  const limits = themeFileLimits(unrestricted);
  const result = yield* Effect.try(() => readThemeDirectory(themesDir)).pipe(Effect.result);
  if (result._tag === "Failure") {
    yield* Effect.logWarning("cannot read bounded environment theme directory", {
      path: themesDir,
    });
    return [];
  }
  const entries = result.success;

  const themes: Array<EnvironmentTheme> = [];
  let examined = 0;
  let totalBytes = 0;
  let backgroundBytes = 0;
  for (const entry of entries.toSorted()) {
    if (!entry.endsWith(THEME_FILE_SUFFIX)) continue;
    const id = entry.slice(0, -THEME_FILE_SUFFIX.length);
    // Reserved ids shadow built-ins or capture clients that never chose them.
    if (!isEnvironmentThemeId(id) || UNPUBLISHABLE_THEME_IDS.has(id)) continue;

    // Cap examined files, not accepted themes, to bound work on malformed directories.
    examined += 1;
    if (examined > MAX_THEME_FILES) {
      yield* Effect.logWarning("ignoring environment theme files past the limit", {
        path: themesDir,
        limit: MAX_THEME_FILES,
      });
      break;
    }

    const filePath = `${themesDir}/${entry}`;
    const raw = readThemeFileGuarded(filePath, limits.fileBytes);
    if (raw === null) {
      yield* Effect.logWarning("ignoring unusable environment theme file", {
        path: filePath,
        limit: limits.fileBytes,
      });
      continue;
    }
    if (raw.trim().length === 0) continue;

    const decoded = decodeEnvironmentThemeFileJsonExit(raw);
    if (decoded._tag === "Failure") {
      yield* Effect.logWarning("ignoring invalid environment theme", {
        path: filePath,
        detail: Cause.pretty(decoded.cause),
      });
      continue;
    }
    const file = decoded.value;
    if (!environmentThemeFileHasColors(file)) {
      yield* Effect.logWarning("ignoring environment theme without colors", { path: filePath });
      continue;
    }

    totalBytes += Buffer.byteLength(raw);
    if (totalBytes > limits.totalBytes) {
      yield* Effect.logWarning("ignoring environment themes past the total size limit", {
        path: themesDir,
        limit: limits.totalBytes,
      });
      break;
    }

    const checked = yield* Effect.try(() => ({
      id,
      ...file,
      ...(file.css === undefined ? {} : { css: sanitizeThemeCss(file.css, { unrestricted }) }),
    })).pipe(Effect.result);
    if (checked._tag === "Failure") {
      yield* Effect.logWarning("ignoring environment theme with invalid CSS", { path: filePath });
      continue;
    }
    const backgroundResult = yield* Effect.uninterruptible(
      Effect.tryPromise(() =>
        themeBackgroundRevision(
          themesDir,
          id,
          raw,
          MAX_THEME_BACKGROUND_TOTAL_BYTES - backgroundBytes,
        ),
      ).pipe(Effect.result),
    );
    if (backgroundResult._tag === "Failure")
      yield* Effect.logWarning("cannot read theme background", { path: filePath });
    const background = backgroundResult._tag === "Success" ? backgroundResult.success : null;
    if (background) backgroundBytes += background.size;
    themes.push({ ...checked.success, ...(background ? { background: background.revision } : {}) });
  }
  return themes;
});

const make = Effect.gen(function* () {
  const { environmentThemesDir } = yield* ServerConfig.ServerConfig;
  const fs = yield* FileSystem.FileSystem;
  const settings = yield* ServerSettingsService;
  // Unreadable settings keep the restricted policy, the same as the setting's default.
  const unrestrictedCss = settings.getSettings.pipe(
    Effect.map((current) => current.allowUnrestrictedThemeCss),
    Effect.catch((error) =>
      Effect.logWarning("cannot read the theme CSS policy; keeping it restricted", {
        operation: error.operation,
      }).pipe(Effect.as(false)),
    ),
  );
  // Sequence numbers let subscribers drop queued events older than their initial snapshot.
  const changes = yield* PubSub.sliding<PublishedThemes>(1);
  const published = yield* Ref.make<PublishedThemes>({ seq: 0, themes: [] });
  // Serialize read/compare/publish so slow older reads cannot publish with newer sequence numbers.
  const refreshSemaphore = yield* Semaphore.make(1);
  const watcherScope = yield* Scope.make("sequential");
  yield* Effect.addFinalizer(() => Scope.close(watcherScope, Exit.void));

  const refresh = refreshSemaphore.withPermits(1)(
    Effect.gen(function* () {
      const themes = yield* readPublishedThemes(environmentThemesDir, yield* unrestrictedCss).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
      );
      // Compare the whole value so new fields cannot silently miss republishes.
      const [changed, next] = yield* Ref.modify(
        published,
        (previous): readonly [readonly [boolean, PublishedThemes], PublishedThemes] => {
          if (Equal.equals(previous.themes, themes)) return [[false, previous], previous];
          const updated: PublishedThemes = { seq: previous.seq + 1, themes };
          return [[true, updated], updated];
        },
      );
      if (changed) yield* PubSub.publish(changes, next).pipe(Effect.asVoid);
      return next;
    }),
  );

  yield* fs
    .makeDirectory(environmentThemesDir, { recursive: true })
    .pipe(Effect.ignoreCause({ log: true }));

  yield* refresh;
  // Turning the setting on or off changes which theme files are published.
  yield* supervise(
    "EnvironmentTheme.policy",
    () =>
      settings.streamChanges.pipe(
        Stream.map((current) => current.allowUnrestrictedThemeCss),
        Stream.changes,
        Stream.runForEach(() => refresh),
      ),
    // A settings double has no changes to wait for; do not spin on its empty stream.
    { restartOnSuccess: false },
  ).pipe(Effect.forkIn(watcherScope), Effect.asVoid);
  yield* supervise("EnvironmentTheme.watch", () =>
    fileWatchResync(environmentThemesDir).pipe(
      Stream.debounce(Duration.millis(100)),
      Stream.runForEach(() => refresh),
    ),
  ).pipe(Effect.forkIn(watcherScope), Effect.asVoid);

  return {
    current: Effect.map(refresh, (state) => state.themes),
    validateCss: Effect.fn("EnvironmentTheme.validateCss")(function* (css: string) {
      const unrestricted = yield* unrestrictedCss;
      return yield* Effect.try({
        try: () => sanitizeThemeCss(css, { unrestricted }),
        catch: () =>
          new ThemeCssValidationError({ message: "Custom CSS is invalid or unsupported." }),
      });
    }),
    get streamChanges() {
      return Stream.unwrap(
        Effect.gen(function* () {
          const subscription = yield* PubSub.subscribe(changes);
          const snapshot = yield* refresh;
          return Stream.concat(
            Stream.make(snapshot.themes),
            Stream.fromSubscription(subscription).pipe(
              Stream.filter((update) => update.seq > snapshot.seq),
              Stream.map((update) => update.themes),
            ),
          );
        }),
      );
    },
  } satisfies EnvironmentThemeService["Service"];
});

export const layer = Layer.effect(EnvironmentThemeService, make);
