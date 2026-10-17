"use client";

import type { Doc } from "@together/backend/dataModel";
import type { UserProfile } from "@together/shared/types";
import { createContext, useContext } from "react";
import { type AuthUser, useAuthUser } from "@/lib/use-auth-user";

/**
 * Who is using the trip: the signed-in person plus their seat in this trip
 * (role, family and roster member). Mounted by TripGate once the
 * membership is loaded, so `ready` is always true inside a trip.
 */
interface Session {
  ready: boolean;
  user: AuthUser | null;
  /** A real account (not a guest device) */
  personal: boolean;
  /** The seat in this trip — family + roster member links */
  profile: UserProfile | null;
  role: Doc<"memberships">["role"] | null;
  /** Same rule as the server: organizers, or any adult when the trip allows it */
  canDeletePlaces: boolean;
}

const SessionContext = createContext<Session>({
  ready: false,
  user: null,
  personal: false,
  profile: null,
  role: null,
  canDeletePlaces: false,
});

export function SessionProvider({
  me,
  membersCanDeletePlaces,
  children,
}: {
  me: Doc<"memberships">;
  membersCanDeletePlaces: boolean;
  children: React.ReactNode;
}) {
  const { user, personal } = useAuthUser();
  const profile: UserProfile = {
    id: me.userId,
    displayName: me.displayName,
    email: user?.email ?? "",
    photoURL: me.image ?? user?.photoURL ?? "",
    familyId: me.familyId,
    memberId: me.memberKey,
    createdAt: me.joinedAt,
  };
  return (
    <SessionContext.Provider
      value={{
        ready: Boolean(user),
        user,
        personal,
        profile,
        role: me.role,
        canDeletePlaces: me.role === "owner" || me.role === "admin" || (me.role !== "kid" && membersCanDeletePlaces),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  return useContext(SessionContext);
}
