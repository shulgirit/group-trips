import type { Metadata } from "next";
import { JoinFlow } from "./JoinFlow";

export const metadata: Metadata = {
  title: "Trip invitation",
  // Rich link preview in WhatsApp
  openGraph: {
    title: "You're invited to a trip",
    description: "Schedule, map, expenses and an AI assistant — all in one place",
  },
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinFlow code={code.toLowerCase()} />;
}
