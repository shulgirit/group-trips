import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { authorizeTrip } from "@/lib/server/auth";
import { downloadImportFile, extractBookings } from "@/lib/server/booking-import";
import { checkAiQuota, recordAiUsage } from "@/lib/server/usage";

export const maxDuration = 120;

const RequestSchema = z
  .object({
    tripId: z.string().min(1),
    storagePath: z.string().max(400).optional(),
    fileName: z.string().max(200).optional(),
    text: z.string().max(30_000).optional(),
  })
  .refine((body) => Boolean(body.storagePath || body.text?.trim()), {
    message: "file_or_text_required",
  });

/**
 * Reads a booking confirmation (uploaded PDF/image, or pasted email text)
 * and stores the extracted items as an import awaiting review.
 */
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const body = parsed.data;
  const access = await authorizeTrip(request, body.tripId);
  if (access instanceof NextResponse) return access;
  const { trip, doc, uid } = access;
  if (!uid || access.role === "kid") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Only files this user uploaded into this trip's import area
  if (
    body.storagePath &&
    !body.storagePath.startsWith(`${trip.path}/imports/${uid}/`)
  ) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }

  const quota = await checkAiQuota(trip, doc, "bookingImports");
  if (!quota.ok) {
    return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });
  }

  const importRef = adminDb().collection(`${trip.path}/imports`).doc();
  try {
    const file = body.storagePath
      ? await downloadImportFile(body.storagePath)
      : null;
    if (
      file &&
      !/^(application\/pdf|image\/(jpeg|png|webp|heic|heif|gif))$/.test(file.contentType)
    ) {
      return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
    }
    const items = await extractBookings({
      text: body.text,
      file: file
        ? {
            base64: file.base64,
            contentType: file.contentType,
            fileName: body.fileName ?? "booking",
          }
        : undefined,
      tripHint: `${trip.name}, ${trip.shortName}, ${trip.startDate} עד ${trip.endDate}`,
    });
    recordAiUsage(trip, "bookingImports").catch(() => undefined);
    const record = {
      fileName: body.fileName ?? (body.text ? "טקסט מודבק" : "קובץ"),
      storagePath: body.storagePath ?? null,
      contentType: file?.contentType ?? "text/plain",
      size: file?.size ?? 0,
      status: "review",
      items,
      createdBy: uid,
      createdAt: Date.now(),
    };
    await importRef.set(record);
    return NextResponse.json({ id: importRef.id, ...record });
  } catch (error) {
    console.error("[import/booking]", error);
    return NextResponse.json({ error: "extract_failed" }, { status: 502 });
  }
}
