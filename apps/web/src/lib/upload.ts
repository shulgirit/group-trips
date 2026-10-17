"use client";

import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { convex } from "@/lib/convex";

/** Uploads a file into Convex storage for a trip; returns its storage id. */
export async function uploadToTrip(tripId: string, file: Blob): Promise<Id<"_storage">> {
  const url = await convex.mutation(api.documents.generateUploadUrl, { tripId: tripId as Id<"trips"> });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error(`upload_failed_${response.status}`);
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
