import type { Metadata, Viewport } from "next";
import { heebo, frankRuhl } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "סיציליה 2026",
    template: "%s · סיציליה 2026",
  },
  description: "אפליקציית הטיול המשפחתית הפרטית שלנו בסיציליה",
  applicationName: "סיציליה 2026",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "סיציליה 2026",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf8f1",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${frankRuhl.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
