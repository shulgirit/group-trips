import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import {
  autocompleteDestination,
  resolveDestination,
} from "@/lib/server/destination";

/** Trip creator: GET ?q= autocompletes, GET ?placeId= resolves. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const params = new URL(request.url).searchParams;
  try {
    const placeId = params.get("placeId");
    if (placeId) {
      const destination = await resolveDestination(placeId);
      if (!destination) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      return NextResponse.json({ destination });
    }
    const q = (params.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ suggestions: [] });
    return NextResponse.json({
      suggestions: await autocompleteDestination(q.slice(0, 80)),
    });
  } catch (error) {
    console.error("[places/destination]", error);
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }
}
