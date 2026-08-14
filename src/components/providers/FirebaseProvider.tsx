"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  auth,
  db,
  ensureFirebaseSignIn,
  isPersonalUser,
} from "@/lib/firebase/client";
import { TRIP_PATH } from "@/lib/trip";
import type { UserProfile } from "@/types";

interface FirebaseState {
  ready: boolean;
  error: boolean;
  /** Current Firebase user (shared trip identity or personal Google identity) */
  user: User | null;
  /** True when signed in with a personal Google account */
  personal: boolean;
  /** The user's trip profile (family member link), null until created */
  profile: UserProfile | null;
}

const FirebaseContext = createContext<FirebaseState>({
  ready: false,
  error: false,
  user: null,
  personal: false,
  profile: null,
});

export function FirebaseProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureFirebaseSignIn()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    return onAuthStateChanged(auth(), (nextUser) => {
      setUser(nextUser);
      // If the user signed out of Google, fall back to the shared identity
      if (!nextUser) {
        ensureFirebaseSignIn().catch(() => setError(true));
      }
    });
  }, [ready]);

  const personal = isPersonalUser(user);

  useEffect(() => {
    if (!ready || !user || !personal) {
      setProfile(null);
      return;
    }
    return onSnapshot(
      doc(db(), `${TRIP_PATH}/users/${user.uid}`),
      (snapshot) =>
        setProfile(
          snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : null
        ),
      () => setProfile(null)
    );
  }, [ready, user, personal]);

  return (
    <FirebaseContext.Provider value={{ ready, error, user, personal, profile }}>
      {error && (
        <div className="mx-auto max-w-lg px-4 pt-3">
          <p className="rounded-2xl bg-terra-100 px-4 py-3 text-sm text-terra-600">
            בעיה בהתחברות לנתונים — בדקו את החיבור לרשת ונסו לרענן
          </p>
        </div>
      )}
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  return useContext(FirebaseContext);
}
