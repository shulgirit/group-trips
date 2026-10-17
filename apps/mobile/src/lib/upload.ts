import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { convex } from "./convex";

/**
 * Uploads a local file (an image-picker / document-picker URI) into the
 * trip's Convex storage; returns its storage id.
 */
export async function uploadToTrip(tripId: string, uri: string, mimeType?: string | null): Promise<Id<"_storage">> {
  const url = await convex.mutation(api.documents.generateUploadUrl, { tripId: tripId as Id<"trips"> });
  const file = await (await fetch(uri)).blob();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": mimeType || file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error(`upload_failed_${response.status}`);
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
