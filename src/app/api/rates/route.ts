import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { fetchExchangeRates } from "@/lib/server/rates";

export async function GET() {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rates = await fetchExchangeRates();
  if (!rates) {
    return NextResponse.json({ error: "rates_unavailable" }, { status: 502 });
  }
  return NextResponse.json(rates);
}
