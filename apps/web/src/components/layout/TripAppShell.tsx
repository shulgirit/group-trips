import { BottomNav } from "@/components/layout/BottomNav";
import { GoHomeFab } from "@/components/layout/GoHomeFab";
import { QuickAdd } from "@/components/layout/QuickAdd";
import { FirebaseProvider } from "@/components/providers/FirebaseProvider";
import { IdentityPrompt } from "@/components/providers/IdentityPrompt";
import { ReminderPinger } from "@/components/providers/ReminderPinger";
import { TripProvider } from "@/components/providers/TripProvider";
import { TourLauncher } from "@/components/tour/TourLauncher";
import type { TripConfig, TripKey } from "@together/shared/trips";

/** Shared app chrome, mounted once per trip route tree. */
export function TripAppShell({
  tripKey,
  config,
  children,
}: {
  tripKey?: TripKey;
  config?: TripConfig;
  children: React.ReactNode;
}) {
  return (
    <TripProvider tripKey={tripKey} config={config}>
      <FirebaseProvider>
        <ReminderPinger />
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
      </FirebaseProvider>
    </TripProvider>
  );
}
