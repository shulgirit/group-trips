/** What export.ts writes: a read-only, JSON-safe copy of Firebase. */

export type Data = Record<string, unknown>;

export interface DocSnap {
  id: string;
  data: Data;
}

export interface AuthUserSnap {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  disabled: boolean;
  createdAt: number;
  /** google.com / apple.com / password / anonymous …, with the provider's own user id */
  providers: { providerId: string; uid: string; email?: string }[];
}

export interface TripSnap extends DocSnap {
  /** Subcollection name → documents */
  collections: Record<string, DocSnap[]>;
}

export interface Snapshot {
  exportedAt: number;
  projectId: string;
  authUsers: AuthUserSnap[];
  users: DocSnap[];
  invites: DocSnap[];
  trips: TripSnap[];
}
