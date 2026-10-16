import { NextResponse } from "next/server";
import { requireAnyAccess } from "@/lib/server/auth";
import { fetchExchangeRates } from "@/lib/server/rates";

export async function GET(request: Request) {
  const access = await requireAnyAccess(request);
  if (access !== true) return access;

  const rates = await fetchExchangeRates();
  if (!rates) {
    return NextResponse.json({ error: "rates_unavailable" }, { status: 502 });
  }
  return NextResponse.json(rates);
}
