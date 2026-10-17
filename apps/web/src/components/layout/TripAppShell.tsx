import { BottomNav } from "@/components/layout/BottomNav";
import { GoHomeFab } from "@/components/layout/GoHomeFab";
import { QuickAdd } from "@/components/layout/QuickAdd";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { IdentityPrompt } from "@/components/providers/IdentityPrompt";
import { TripProvider } from "@/components/providers/TripProvider";
import { TourLauncher } from "@/components/tour/TourLauncher";
import type { Doc } from "@together/backend/dataModel";
import type { TripConfig } from "@together/shared/trips";

/** Shared app chrome, mounted once per trip route tree. */
export function TripAppShell({
  config,
  me,
  membersCanDeletePlaces,
  children,
}: {
  config: TripConfig;
  me: Doc<"memberships">;
  membersCanDeletePlaces: boolean;
  children: React.ReactNode;
}) {
  return (
    <TripProvider config={config}>
      <SessionProvider me={me} membersCanDeletePlaces={membersCanDeletePlaces}>
        <TourLauncher />
        <IdentityPrompt />
        <div className="min-h-dvh lg:ps-24">
          <main className="mx-auto w-full max-w-lg px-4 pb-36 pt-4 md:max-w-xl lg:max-w-3xl lg:px-8 lg:pb-16 lg:pt-8">
            {children}
          </main>
          <QuickAdd />
          <GoHomeFab />
          <BottomNav />
        </div>
      </SessionProvider>
    </TripProvider>
  );
}
