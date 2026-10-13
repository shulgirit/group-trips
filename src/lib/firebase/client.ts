"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithCustomToken,
  signInWithPopup,
  signInWithRedirect,
  signInAnonymously,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  linkWithPopup,
  linkWithCredential,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { nativePlugin } from "@/lib/native";

/** @capacitor-firebase/authentication — native Google/Apple sheets. */
interface NativeAuthPlugin {
  signInWithGoogle(options?: { skipNativeAuth?: boolean }): Promise<{
    credential?: { idToken?: string; accessToken?: string };
  }>;
  signInWithApple(options?: { skipNativeAuth?: boolean }): Promise<{
    credential?: { idToken?: string; nonce?: string };
  }>;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Local development / E2E tests against the Firebase emulator suite. */
const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";

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
      if (USE_EMULATORS) connectFirestoreEmulator(firestoreInstance, "127.0.0.1", 8080);
    } catch {
      // Already initialized (e.g. HMR) — reuse
      firestoreInstance = getFirestore(app());
    }
  }
  return firestoreInstance;
}

let emulatorsWired = false;

// E2E hook (emulators only): sign in as a fake Google user without a popup
if (USE_EMULATORS && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__e2eSignIn = async (
    name: string,
    email: string
  ) => {
    const credential = GoogleAuthProvider.credential(
      JSON.stringify({ sub: email, email, name, email_verified: true })
    );
    return (await signInWithCredential(auth(), credential)).user.uid;
  };
  (window as unknown as Record<string, unknown>).__e2eLink = async (
    name: string,
    email: string
  ) => {
    const credential = GoogleAuthProvider.credential(
      JSON.stringify({ sub: email, email, name, email_verified: true })
    );
    const user = (await linkWithCredential(auth().currentUser!, credential)).user;
    await user.getIdToken(true);
    return user.uid;
  };
}

export function auth() {
  const instance = getAuth(app());
  if (USE_EMULATORS && !emulatorsWired) {
    emulatorsWired = true;
    connectAuthEmulator(instance, "http://127.0.0.1:9099", { disableWarnings: true });
    connectStorageEmulator(getStorage(app()), "127.0.0.1", 9199);
  }
  return instance;
}

export function storage() {
  auth();
  return getStorage(app());
}

const PERSONAL_PROVIDERS = new Set(["google.com", "apple.com"]);

/** True when the user has a real personal identity (Google/Apple), not the shared trip identity. */
export function isPersonalUser(user: User | null): boolean {
  return Boolean(
    user?.providerData.some((p) => PERSONAL_PROVIDERS.has(p.providerId))
  );
}

/** Sign in with Apple is enabled per environment once configured in Firebase. */
export const APPLE_SIGN_IN_ENABLED =
  process.env.NEXT_PUBLIC_APPLE_SIGN_IN === "1";

/** iOS app review requires Sign in with Apple whenever Google is offered. */
export function appleSignInAvailable(): boolean {
  return (
    APPLE_SIGN_IN_ENABLED ||
    (typeof window !== "undefined" &&
      nativePlugin("FirebaseAuthentication") !== null &&
      /iphone|ipad|ipod/i.test(navigator.userAgent))
  );
}

async function signInWithProvider(
  provider: GoogleAuthProvider | OAuthProvider
): Promise<User> {
  try {
    const credential = await signInWithPopup(auth(), provider);
    return credential.user;
  } catch (error) {
    // Popups are blocked in some in-app browsers (WhatsApp, Instagram) —
    // fall back to a full-page redirect; the page reloads signed in.
    const code = (error as { code?: string }).code ?? "";
    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      await signInWithRedirect(auth(), provider);
    }
    throw error;
  }
}

export async function signInWithGoogle(): Promise<User> {
  // Inside the store app, popups don't exist — use the native account sheet
  // and hand its credential to the web SDK.
  const native = nativePlugin<NativeAuthPlugin>("FirebaseAuthentication");
  if (native) {
    const result = await native.signInWithGoogle({ skipNativeAuth: true });
    const credential = GoogleAuthProvider.credential(
      result.credential?.idToken ?? null,
      result.credential?.accessToken ?? null
    );
    return (await signInWithCredential(auth(), credential)).user;
  }
  return signInWithProvider(new GoogleAuthProvider());
}

export async function signInWithApple(): Promise<User> {
  const native = nativePlugin<NativeAuthPlugin>("FirebaseAuthentication");
  if (native) {
    const result = await native.signInWithApple({ skipNativeAuth: true });
    const credential = new OAuthProvider("apple.com").credential({
      idToken: result.credential?.idToken ?? "",
      rawNonce: result.credential?.nonce,
    });
    return (await signInWithCredential(auth(), credential)).user;
  }
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return signInWithProvider(provider);
}

/**
 * Guest → real account: attaches Google/Apple to the SAME uid, so every
 * membership, profile and chat carries over.
 */
export async function linkGuestAccount(kind: "google" | "apple"): Promise<User> {
  const current = auth().currentUser;
  if (!current) throw new Error("not_signed_in");
  const native = nativePlugin<NativeAuthPlugin>("FirebaseAuthentication");
  if (native) {
    if (kind === "google") {
      const result = await native.signInWithGoogle({ skipNativeAuth: true });
      const credential = GoogleAuthProvider.credential(
        result.credential?.idToken ?? null,
        result.credential?.accessToken ?? null
      );
      return (await linkWithCredential(current, credential)).user;
    }
    const result = await native.signInWithApple({ skipNativeAuth: true });
    const credential = new OAuthProvider("apple.com").credential({
      idToken: result.credential?.idToken ?? "",
      rawNonce: result.credential?.nonce,
    });
    return (await linkWithCredential(current, credential)).user;
  }
  const provider =
    kind === "google" ? new GoogleAuthProvider() : new OAuthProvider("apple.com");
  return (await linkWithPopup(current, provider)).user;
}

/** Kid devices / guests: an anonymous identity, bound to a trip by an invite. */
export async function signInAsGuest(): Promise<User> {
  const current = auth().currentUser;
  if (current) return current;
  const credential = await signInAnonymously(auth());
  return credential.user;
}

/** Resolves once Firebase restored the persisted session (user or null). */
export function waitForAuth(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth(), (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Authorization header for our API routes. Self-serve trips authenticate
 * every request with the Firebase ID token; legacy trips still rely on
 * the trip_session cookie (sent automatically).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const user = auth().currentUser;
  if (!user) return {};
  try {
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  } catch {
    return {};
  }
}

/** fetch() for our own API with JSON + the caller's ID token attached. */
export async function apiFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(await authHeaders())) {
    headers.set(key, value);
  }
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
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
