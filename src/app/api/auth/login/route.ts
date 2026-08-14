import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  constantTimeEquals,
  createSessionToken,
  getTripPassword,
} from "@/lib/auth/session";

export async function POST(request: Request) {
  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const tripPassword = getTripPassword();
  if (!tripPassword) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  if (!constantTimeEquals(password.trim(), tripPassword)) {
    return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
