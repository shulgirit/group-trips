import { BottomNav } from "@/components/layout/BottomNav";
import { QuickAdd } from "@/components/layout/QuickAdd";
import { FirebaseProvider } from "@/components/providers/FirebaseProvider";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <FirebaseProvider>
      <div className="min-h-dvh bg-cream-50">
        <main className="mx-auto w-full max-w-lg px-4 pb-32 pt-4">
          {children}
        </main>
        <QuickAdd />
        <BottomNav />
      </div>
    </FirebaseProvider>
  );
}
