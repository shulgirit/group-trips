import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { TripDoc } from "@together/shared/trip-doc";
import type { TripConfig } from "@together/shared/trips";

/**
 * Free-plan guardrails. Everything is free today; these limits keep AI
 * cost bounded per trip and are where a paid plan will plug in later
 * (TripDoc.plan).
 */
export const FREE_LIMITS = {
  aiCallsPerMonth: 400,
  activeTripsPerUser: 5,
  membersPerTrip: 40,
  bookingImportsPerMonth: 60,
} as const;

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function usageRef(trip: TripConfig) {
  return adminDb().doc(`${trip.path}/usage/${monthKey()}`);
}

export async function checkAiQuota(
  trip: TripConfig,
  doc: TripDoc | null,
  field: "aiCalls" | "bookingImports" = "aiCalls"
): Promise<{ ok: boolean; limit: number }> {
  const limit =
    field === "aiCalls"
      ? FREE_LIMITS.aiCallsPerMonth
      : FREE_LIMITS.bookingImportsPerMonth;
  // Legacy trips predate limits
  if (trip.legacy || !doc) return { ok: true, limit };
  const snapshot = await usageRef(trip).get();
  const used = Number(snapshot.data()?.[field] ?? 0);
  return { ok: used < limit, limit };
}

export async function recordAiUsage(
  trip: TripConfig,
  field: "aiCalls" | "bookingImports" = "aiCalls"
): Promise<void> {
  await usageRef(trip).set(
    { [field]: FieldValue.increment(1), updatedAt: Date.now() },
    { merge: true }
  );
}
