import { BottomNav } from "@/components/layout/BottomNav";
import { QuickAdd } from "@/components/layout/QuickAdd";
import { FirebaseProvider } from "@/components/providers/FirebaseProvider";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <FirebaseProvider>
      <div className="min-h-dvh">
        <main className="mx-auto w-full max-w-lg px-4 pb-36 pt-4 md:max-w-xl">
          {children}
        </main>
        <QuickAdd />
        <BottomNav />
      </div>
    </FirebaseProvider>
  );
}
