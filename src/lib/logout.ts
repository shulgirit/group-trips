"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/** Full logout: clears the app session cookie and the Firebase identity,
 *  then lands on the gate. */
export async function logoutEverywhere(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  await signOut(auth()).catch(() => undefined);
  window.location.replace("/gate");
}
