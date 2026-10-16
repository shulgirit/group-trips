"use client";

import { ref, uploadBytes, type StorageReference, type UploadMetadata } from "firebase/storage";
import { apiFetch, auth, storage } from "@/lib/firebase/client";

function isUnauthorized(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "storage/unauthorized";
}

/**
 * uploadBytes for a path under trips/{tripId}/. Storage rules read trip
 * membership from the token's `t` claim; when it's missing (stale token or
 * lost claim) Storage refuses, so we ask the server to re-grant it, refresh
 * the token and try once more.
 */
export async function uploadToTrip(
  path: string,
  data: Blob | Uint8Array | ArrayBuffer,
  metadata?: UploadMetadata
): Promise<StorageReference> {
  const fileRef = ref(storage(), path);
  try {
    await uploadBytes(fileRef, data, metadata);
    return fileRef;
  } catch (error) {
    const tripId = path.match(/^trips\/([^/]+)\//)?.[1];
    if (!isUnauthorized(error) || !tripId) throw error;
    const response = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}/claim`, { method: "POST" });
    if (!response.ok) throw error;
    await auth().currentUser?.getIdToken(true);
    await uploadBytes(fileRef, data, metadata);
    return fileRef;
  }
}
