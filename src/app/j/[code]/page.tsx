import type { Metadata } from "next";
import { JoinFlow } from "./JoinFlow";

export const metadata: Metadata = {
  title: "הזמנה לטיול",
  // Rich link preview in WhatsApp
  openGraph: {
    title: "הוזמנתם לטיול 🧳",
    description: "לו״ז, מפה, הוצאות ועוזר AI — הכל במקום אחד",
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
