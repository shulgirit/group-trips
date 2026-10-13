"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, isPersonalUser } from "@/lib/firebase/client";

/**
 * Firebase auth state for product surfaces (welcome, my trips, creator,
 * invites). `personal` = a real Google/Apple account; anonymous kid
 * identities and the legacy shared identity are not.
 */
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onAuthStateChanged(auth(), (next) => {
        setUser(next);
        setLoading(false);
      }),
    []
  );
  return { user, loading, personal: isPersonalUser(user) };
}
