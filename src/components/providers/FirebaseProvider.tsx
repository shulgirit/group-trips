"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  auth,
  db,
  ensureFirebaseSignIn,
  isPersonalUser,
} from "@/lib/firebase/client";
import { useTrip } from "@/components/providers/TripProvider";
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
  /** Bumped after trip membership is (re)established — re-subscribes hooks */
  epoch: number;
}

const FirebaseContext = createContext<FirebaseState>({
  ready: false,
  error: false,
  user: null,
  personal: false,
  profile: null,
  epoch: 0,
});

export function FirebaseProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const provisionedTripsRef = useRef<Set<string>>(new Set());

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
      if (nextUser) {
        // Pick up freshly-set membership claims without waiting an hour
        nextUser.getIdToken(true).catch(() => undefined);
      } else {
        // Signed out of the personal identity — fall back to the shared one
        ensureFirebaseSignIn().catch(() => setError(true));
      }
    });
  }, [ready]);

  const trip = useTrip();
  const tripPath = trip.path;

  useEffect(() => {
    if (!ready || !user) {
      setProfile(null);
      setProfileResolved(false);
      return;
    }
    setProfileResolved(false);
    return onSnapshot(
      doc(db(), `${tripPath}/users/${user.uid}`),
      (snapshot) => {
        setProfile(
          snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : null
        );
        setProfileResolved(true);
      },
      () => {
        // Permission denied — most likely a member of another trip who has
        // no profile doc under THIS trip yet (see the provisioning effect)
        setProfile(null);
        setProfileResolved(true);
      }
    );
  }, [ready, user, tripPath, epoch]);

  // A Google user with a valid session cookie but no profile in the current
  // trip (e.g. a sicily member opening /sardinia) is silently enrolled —
  // the cookie already proves membership, so no join code is needed. The
  // server creates the users doc, which unlocks the Firestore rules.
  useEffect(() => {
    if (!ready || !user || !profileResolved || profile) return;
    if (!isPersonalUser(user)) return;
    if (provisionedTripsRef.current.has(trip.id)) return;
    provisionedTripsRef.current.add(trip.id);
    let cancelled = false;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, tripId: trip.id }),
        });
        if (!cancelled && response.ok) {
          // Fresh claims + re-subscribe every listener under the new rules
          await user.getIdToken(true).catch(() => undefined);
          setEpoch((current) => current + 1);
        }
      } catch {
        // Offline — the next visit retries
        provisionedTripsRef.current.delete(trip.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, profile, profileResolved, trip.id]);

  // Personal = Google account OR a registered name-based identity (kids).
  // The legacy shared trip identity has no profile doc, so it stays shared.
  const personal = isPersonalUser(user) || Boolean(profile);

  return (
    <FirebaseContext.Provider
      value={{ ready, error, user, personal, profile, epoch }}
    >
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
