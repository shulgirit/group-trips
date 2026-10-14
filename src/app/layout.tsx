import type { Metadata, Viewport } from "next";
import { jost, plex } from "@/lib/fonts";
import "./globals.css";
import { NativeBridge } from "@/components/native/NativeBridge";
import { LocaleProvider } from "@/i18n";
import { dirFor } from "@/i18n/config";
import { requestLocale } from "@/i18n/server";

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
  const locale = await requestLocale();
  return (
    <html lang={locale} dir={dirFor(locale)} className={`${plex.variable} ${jost.variable}`}>
      <body className="antialiased">
        <LocaleProvider locale={locale}>
          <NativeBridge />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
