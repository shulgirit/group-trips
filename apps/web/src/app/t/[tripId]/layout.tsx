import type { Metadata } from "next";
import { TripGate } from "@/components/product/TripGate";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
};

export default async function SelfServeTripLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}>) {
  const { tripId } = await params;
  return <TripGate tripId={tripId}>{children}</TripGate>;
}
