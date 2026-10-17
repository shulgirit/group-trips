"use client";

import { api } from "@together/backend/api";
import { useConvexAuth, useQuery } from "convex/react";

/** The signed-in person, in the shape the pages already use. */
export interface AuthUser {
  /** App user id (Convex `users` id) */
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  /** A guest / kid device without an account */
  isAnonymous: boolean;
}

/**
 * Auth state for every surface. `personal` = a real account (Google, Apple
 * or email); guest devices joined through an invite are not.
 */
export function useAuthUser(): { user: AuthUser | null; loading: boolean; personal: boolean } {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.account.me, isAuthenticated ? {} : "skip");
  const loading = isLoading || (isAuthenticated && me === undefined);
  const user: AuthUser | null = me
    ? { uid: me.id, displayName: me.name || null, photoURL: me.image ?? null, email: me.email ?? null, isAnonymous: me.guest }
    : null;
  return { user, loading, personal: Boolean(user && !user.isAnonymous) };
}
