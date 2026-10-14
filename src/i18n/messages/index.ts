import en from "./en";
import he from "./he";

export type Messages = typeof he;

export const messages: Record<"he" | "en", Messages> = { he, en };
