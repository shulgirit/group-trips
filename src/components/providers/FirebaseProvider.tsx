"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ensureFirebaseSignIn } from "@/lib/firebase/client";

type FirebaseState = { ready: boolean; error: boolean };

const FirebaseContext = createContext<FirebaseState>({
  ready: false,
  error: false,
});

export function FirebaseProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [state, setState] = useState<FirebaseState>({
    ready: false,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;
    ensureFirebaseSignIn()
      .then(() => {
        if (!cancelled) setState({ ready: true, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ ready: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FirebaseContext.Provider value={state}>
      {state.error && (
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
