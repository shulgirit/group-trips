import { createHmac, timingSafeEqual, createHash } from "node:crypto";

export const SESSION_COOKIE = "trip_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

const DEV_SECRET = "dev-only-secret-do-not-use-in-production";
const DEV_PASSWORD = "sicilia";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (isProduction()) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return DEV_SECRET;
}

/**
 * Returns the shared trip password. In development a fallback password is
 * used so the project stays runnable before any env configuration.
 */
export function getTripPassword(): string | null {
  const password = process.env.TRIP_PASSWORD;
  if (password) return password;
  if (isProduction()) return null;
  console.warn(
    `[auth] TRIP_PASSWORD is not set — using dev fallback password "${DEV_PASSWORD}"`
  );
  return DEV_PASSWORD;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

/** Token format: v1.<expiryEpochSeconds>.<hmac> */
export function createSessionToken(): string {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `v1.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [version, expiry, signature] = parts;
  const expected = sign(`${version}.${expiry}`);
  if (!constantTimeEquals(signature, expected)) return false;
  const expiresAt = Number.parseInt(expiry, 10);
  return Number.isFinite(expiresAt) && expiresAt > Date.now() / 1000;
}

/** Compares secrets without leaking length or content through timing. */
export function constantTimeEquals(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
