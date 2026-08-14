import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { enrichSavedPlace } from "@/lib/server/enrich";

export const maxDuration = 120;

const RequestSchema = z.object({
  placeId: z.string().min(1),
  url: z
    .string()
    .trim()
    .regex(/^https?:\/\//)
    .optional(),
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let placeId: string;
  let url: string | undefined;
  try {
    ({ placeId, url } = RequestSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await enrichSavedPlace(placeId, url);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[import/enrich]", error);
    return NextResponse.json(
      { ok: false, message: "ההעשרה נכשלה, נסו שוב" },
      { status: 502 }
    );
  }
}
