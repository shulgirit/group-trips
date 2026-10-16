import { Frank_Ruhl_Libre, IBM_Plex_Sans_Hebrew, Jost } from "next/font/google";

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
