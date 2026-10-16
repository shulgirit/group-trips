/**
 * The AI guide's face. Stored on the trip as `ai.avatar`:
 *  - "bot:<id>" → one of the gallery robots in /public/avatars
 *  - an uploaded image URL (Firebase Storage, trips/<id>/photos/avatar/…)
 * Trips without one keep the persona icon in the orb.
 */
export const BOT_AVATARS = ["tog", "nova", "pilot", "butler", "explorer", "buddy"] as const;
export type BotAvatar = (typeof BOT_AVATARS)[number];

/** Pairs each persona preset with a fitting default robot. */
export const PRESET_AVATAR: Record<string, BotAvatar> = {
  butler: "butler",
  pilot: "pilot",
  buddy: "buddy",
  guide: "explorer",
  custom: "tog",
};

export function avatarSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("bot:")) {
    const id = value.slice(4);
    return (BOT_AVATARS as readonly string[]).includes(id) ? `/avatars/${id}.webp` : null;
  }
  return /^https?:\/\//.test(value) ? value : null;
}

/** Accepts gallery ids and http(s) image URLs only. */
export const AVATAR_PATTERN = /^(bot:[a-z]{2,16}|https:\/\/[^\s]{8,900}|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[^\s]{1,900})$/;
