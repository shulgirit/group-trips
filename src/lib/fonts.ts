import { Amiri, Frank_Ruhl_Libre, IBM_Plex_Sans_Arabic, IBM_Plex_Sans_Hebrew, Jost, Open_Sans } from "next/font/google";

/** UI face — Hebrew + Latin in one family. */
export const plex = IBM_Plex_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

/** Brand face — the TOGETHER wordmark, eyebrows and display numerals. */
export const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
  display: "swap",
});

/** Display serif — drawn for Hebrew first; big headlines only. */
export const frank = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: "variable",
  variable: "--font-frank",
  display: "swap",
});

/**
 * Arabic companions. Not preloaded: browsers fetch these files only when
 * Arabic glyphs are on screen (unicode-range), so other languages pay nothing.
 */
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
  preload: false,
});

/** Hebrew UI face (Omer's choice): text and headings when the app is in Hebrew. */
export const openSans = Open_Sans({
  subsets: ["hebrew", "latin"],
  weight: "variable",
  variable: "--font-open-sans",
  display: "swap",
});
