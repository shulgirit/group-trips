"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { LogOut, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { auth } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/use-auth-user";

/** Chrome for the product surfaces outside a trip (my trips, creator, join). */
export function ProductShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const t = useT();
  const { user, personal } = useAuthUser();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    await signOut(auth()).catch(() => undefined);
    window.location.replace("/welcome");
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-chart-200/70 bg-cream-50/90 backdrop-blur">
        <div
          className={`mx-auto flex h-14 w-full items-center justify-between px-4 ${wide ? "max-w-3xl lg:max-w-5xl" : "max-w-lg md:max-w-xl"}`}
        >
          <Link
            href={personal ? "/trips" : "/welcome"}
            aria-label="Together"
            className="flex items-center text-ink-900"
          >
            <Logo size={24} wordClassName="text-[15px]" />
          </Link>
          {user && (personal || user.isAnonymous) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={t("product.shell.account")}
                aria-expanded={menuOpen}
                className="-me-1 flex h-11 w-11 items-center justify-center"
              >
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-chart-200 bg-white text-sm font-medium text-ink-700">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : user.displayName ? (
                  user.displayName.slice(0, 2)
                ) : (
                  <UserRound size={18} strokeWidth={STROKE} aria-hidden />
                )}
                </span>
              </button>
              {menuOpen && (
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-0 cursor-default"
                />
              )}
              {menuOpen && (
                <div className="card absolute end-0 top-12 z-10 w-60 overflow-hidden p-1.5">
                  <p className="truncate px-3 py-2 text-sm text-ink-500">
                    {user.displayName || user.email || t("product.shell.guest")}
                  </p>
                  <Link
                    href="/account"
                    className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-ink-700 hover:bg-cream-100"
                  >
                    {t("product.shell.account")}
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-terra-600 hover:bg-terra-100"
                  >
                    <LogOut size={16} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
                    {t("product.shell.logout")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <main
        className={`mx-auto w-full px-4 pb-24 pt-8 ${wide ? "max-w-3xl lg:max-w-5xl" : "max-w-lg md:max-w-xl"}`}
      >
        {children}
      </main>
    </div>
  );
}
