import type { Metadata, Viewport } from "next";
import { amiri, frank, jost, openSans, plex, plexArabic } from "@/lib/fonts";
import "./globals.css";
import { NativeBridge } from "@/components/native/NativeBridge";
import { LocaleProvider } from "@/i18n";
import { dirFor } from "@together/i18n/config";
import { requestLocale } from "@/i18n/server";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { getToken } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: {
    default: "Together",
    template: "%s · Together",
  },
  description: "Plan and live your group trip together: schedule, map, expenses and an AI trip assistant.",
  applicationName: "Together",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Together",
  },
  openGraph: {
    title: "Together",
    description: "Your group trip, all in one place",
    images: ["/brand/og.png"],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f5f0",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [locale, token] = await Promise.all([requestLocale(), getToken().catch(() => null)]);
  return (
    <html lang={locale} dir={dirFor(locale)} className={`${plex.variable} ${jost.variable} ${frank.variable} ${plexArabic.variable} ${amiri.variable} ${openSans.variable}`}>
      <body className="antialiased">
        <ConvexClientProvider initialToken={token}>
          <LocaleProvider locale={locale}>
            <NativeBridge />
            {children}
          </LocaleProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
