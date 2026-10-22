import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { convex } from "./convex";

/**
 * Uploads a local file (an image-picker / document-picker URI) into the
 * trip's Convex storage; returns its storage id.
 */
export async function uploadToTrip(tripId: string, uri: string, mimeType?: string | null): Promise<Id<"_storage">> {
  const url = await convex.mutation(api.documents.generateUploadUrl, { tripId: tripId as Id<"trips"> });
  // Raw bytes, not a Blob: React Native's Blob body reaches Convex storage malformed (HTTP 400)
  const local = await fetch(uri);
  const bytes = new Uint8Array(await local.arrayBuffer());
  if (!bytes.length) throw new Error("upload_empty_file");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": mimeType || local.headers.get("content-type") || "application/octet-stream" },
    body: bytes,
  });
  if (!response.ok) throw new Error(`upload_failed_${response.status}:${(await response.text().catch(() => "")).slice(0, 120)}`);
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
