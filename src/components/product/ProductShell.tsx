"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { BRAND } from "@/lib/brand";
import { useAuthUser } from "@/lib/use-auth-user";

/** Chrome for the product surfaces outside a trip (my trips, creator, join). */
export function ProductShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { user, personal } = useAuthUser();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    await signOut(auth()).catch(() => undefined);
    window.location.replace("/welcome");
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-cream-200/70 bg-cream-50/85 backdrop-blur">
        <div
          className={`mx-auto flex h-14 w-full items-center justify-between px-4 ${wide ? "max-w-3xl" : "max-w-lg md:max-w-xl"}`}
        >
          <Link
            href={personal ? "/trips" : "/welcome"}
            className="flex items-center gap-2 font-display text-lg font-bold text-ink-900"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sea-600 to-sea-900 text-base"
            >
              {BRAND.emoji}
            </span>
            {BRAND.name}
          </Link>
          {user && (personal || user.isAnonymous) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="החשבון שלי"
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-sea-100 text-sm font-bold text-sea-700"
              >
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  (user.displayName || (user.isAnonymous ? "👋" : "?")).slice(0, 2)
                )}
              </button>
              {menuOpen && (
                <div className="card absolute end-0 top-11 w-56 overflow-hidden p-1">
                  <p className="truncate px-3 py-2 text-sm text-ink-500">
                    {user.displayName || user.email || "אורח (בלי חשבון)"}
                  </p>
                  <Link
                    href="/account"
                    className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-cream-100"
                  >
                    החשבון שלי
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-terra-600 hover:bg-terra-100"
                  >
                    <LogOut className="h-4 w-4" />
                    התנתקות
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <main
        className={`mx-auto w-full px-4 pb-24 pt-6 ${wide ? "max-w-3xl" : "max-w-lg md:max-w-xl"}`}
      >
        {children}
      </main>
    </div>
  );
}
