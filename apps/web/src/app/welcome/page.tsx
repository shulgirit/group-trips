import type { Metadata } from "next";
import { WelcomeClient } from "@/components/landing/WelcomeClient";

// The only indexable page (the root layout is noindex); the dev domain stays hidden in robots.ts
export const metadata: Metadata = { robots: { index: true, follow: true }, alternates: { canonical: "/welcome" } };

export default function WelcomePage() {
  return <WelcomeClient />;
}
