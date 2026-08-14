"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function app() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let firestoreInstance: Firestore | null = null;

export function db(): Firestore {
  if (!firestoreInstance) {
    try {
      firestoreInstance = initializeFirestore(app(), {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      // Already initialized (e.g. HMR) — reuse
      firestoreInstance = getFirestore(app());
    }
  }
  return firestoreInstance;
}

export function auth() {
  return getAuth(app());
}

export function storage() {
  return getStorage(app());
}

/**
 * Ensures the client is signed in to Firebase. The trip session cookie
 * authorizes minting a custom token server-side; Firebase Auth then keeps
 * the session locally so this is a no-op on subsequent visits.
 */
export function ensureFirebaseSignIn(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth(), async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
        return;
      }
      try {
        const response = await fetch("/api/auth/firebase-token", {
          method: "POST",
        });
        if (!response.ok) throw new Error("token_request_failed");
        const { token } = await response.json();
        const credential = await signInWithCustomToken(auth(), token);
        resolve(credential.user);
      } catch (error) {
        reject(error);
      }
    });
  });
}
