import type { GoatBotFaceState } from "./face.ts";

import { goatBotPortraitArt, type GoatBotPortraitArt } from "./portrait.ts";

/** What a bot's avatar draws instead of the face: a chosen emoji, or a member's portrait. */
export type GoatBotPicture = string | GoatBotPortraitArt;

/** A bot's chosen avatar emoji, or null for the default face. */
export function goatBotAvatarEmoji(avatar: GoatBotPicture | null | undefined): string | null {
  if (typeof avatar !== "string") return null;
  const trimmed = avatar.trim();
  return trimmed === "" ? null : trimmed;
}

/** The portrait a picture draws, or null for an emoji or the face. */
export function goatBotAvatarPortrait(
  picture: GoatBotPicture | null | undefined,
): GoatBotPortraitArt | null {
  return typeof picture === "object" && picture !== null ? picture : null;
}

/** A member's emoji, else a portrait drawn from its name, so members never share the main bot's face. */
export function goatBotMemberPicture(bot: {
  readonly avatar?: string | null | undefined;
  readonly name: string;
}): GoatBotPicture {
  return goatBotAvatarEmoji(bot.avatar) ?? goatBotPortraitArt(bot.name);
}

/** How a round avatar shows the bot's state around its picture. */
export interface GoatBotAvatarSignal {
  readonly ring: "active" | "failed" | "finished" | null;
  readonly waitingDot: boolean;
  readonly dimmed: boolean;
}

/**
 * The face shows reading, finished and sleeping with its eyes. An emoji has none, so those get a
 * ring or a dimmed picture; every signal is still, and finished lasts only as long as that state.
 */
export function goatBotAvatarSignal(state: GoatBotFaceState, emoji: boolean): GoatBotAvatarSignal {
  const waitingDot = state === "waiting";
  const ring =
    state === "working" || (emoji && state === "reading")
      ? "active"
      : state === "failed"
        ? "failed"
        : emoji && state === "finished"
          ? "finished"
          : null;
  return { ring, waitingDot, dimmed: emoji && state === "sleeping" };
}
