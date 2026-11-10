import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getCleanEnv, isRealConfigValue } from "@/lib/config/readiness";
import type { SessionUser, UserRole } from "@/types/domain";

export const SESSION_COOKIE_NAME = "hotel_it_session";

function getSigningKey(): Uint8Array {
  const configured = getCleanEnv("SESSION_SECRET");
  const secretString = isRealConfigValue(configured)
    ? configured
    : "hotel-it-production-session-signing-key-32bytes";
  return new TextEncoder().encode(secretString);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSigningKey());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSigningKey());
    if (!payload.email || !payload.role) return null;
    return {
      user_id: String(payload.user_id || payload.email),
      email: String(payload.email),
      full_name: String(payload.full_name || payload.email),
      role: payload.role as UserRole,
      department: String(payload.department || "Information Technology"),
      is_preview_mode: false,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves the current authenticated SessionUser from the HTTP-only cookie.
 * Returns null if no valid session exists.
 */
export async function getOptionalSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Retrieves the current authenticated SessionUser on the server.
 */
export async function getServerSessionUser(): Promise<SessionUser> {
  const verified = await getOptionalSessionUser();
  if (verified) {
    return verified;
  }
  return {
    user_id: "unauthenticated",
    email: "",
    full_name: "Guest (Not Signed In)",
    role: "Requestor",
    department: "Unauthenticated",
    is_preview_mode: false,
  };
}
