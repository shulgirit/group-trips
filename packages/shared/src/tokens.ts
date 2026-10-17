/**
 * "Atlas & Journal" design tokens (docs/design/direction.md), for the native
 * app. The web keeps the same values as Tailwind tokens in globals.css.
 */
export const colors = {
  night950: "#070c16",
  night900: "#0b1322",
  night800: "#121d31",
  night700: "#1c2a43",
  /** Chart paper — the Journal ground */
  chart50: "#f1f3ef",
  chart100: "#e7eae4",
  chart200: "#d9ddd5",
  chart300: "#c6ccc2",
  paper: "#ffffff",
  ink900: "#0f1b2d",
  ink700: "#2e3a4b",
  ink500: "#6b6a66",
  ink400: "#8c8a84",
  ink300: "#a9a59c",
  /** Brass — only where things converge (primary CTA, "next", the guide) */
  brass600: "#957243",
  brass500: "#b08a55",
  brass300: "#d8bf95",
  brass100: "#f3ebde",
  /** Route / sea glass — live, map, now */
  route700: "#24544f",
  route500: "#2f6b66",
  route300: "#8fb7b1",
  route100: "#e2eeec",
  /** Clay — destructive and errors only */
  terra600: "#8a4c37",
  terra500: "#9c5a43",
  terra100: "#f3e8e2",
} as const;

export const radius = { card: 16, sheet: 24, field: 12, chip: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Type scale (px) — nothing in-app below 12. */
export const type = {
  displayLg: 40,
  display: 32,
  title: 24,
  headline: 19,
  body: 16,
  small: 14,
  caption: 12,
} as const;

/** Family accent colors, keyed by the color token stored on each family. */
export const familyColors: Record<string, string> = {
  sea: "#2f6b66",
  terra: "#9c5a43",
  lemon: "#b08a55",
  olive: "#6f7d4f",
};
