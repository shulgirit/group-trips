import { TripAppShell } from "@/components/layout/TripAppShell";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <TripAppShell tripKey="sicily">{children}</TripAppShell>;
}
