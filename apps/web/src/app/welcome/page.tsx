import type { Metadata } from "next";
import { headers } from "next/headers";
import { WelcomeClient } from "@/components/landing/WelcomeClient";

// The only indexable page (the root layout is noindex); the dev domain stays hidden in robots.ts
export const metadata: Metadata = { robots: { index: true, follow: true }, alternates: { canonical: "/welcome" } };

/**
 * Web visitors get the story landing page (server-rendered, fast, indexable);
 * the store apps — whose webview appends "TogetherApp" to its user agent
 * (capacitor.config.ts) — or ?app=1 for a browser preview, get the short
 * app onboarding.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, headerStore] = await Promise.all([searchParams, headers()]);
  const app = params.app === "1" || /TogetherApp/.test(headerStore.get("user-agent") ?? "");
  return <WelcomeClient app={app} />;
}
