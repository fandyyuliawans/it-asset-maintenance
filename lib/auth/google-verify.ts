import { createRemoteJWKSet, jwtVerify } from "jose";
import { getCleanEnv, isRealConfigValue } from "@/lib/config/readiness";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  hd?: string;
}

/**
 * Verifies a Google Identity Services ID Token on the server using Google's official JWKS.
 * Authorization and role assignment are strictly controlled by the Google Spreadsheet `Users` tab.
 */
export async function verifyGoogleIdToken(
  idToken: string
): Promise<VerifiedGoogleIdentity> {
  const clientId = getCleanEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  if (!isRealConfigValue(clientId)) {
    throw new Error(
      "NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured with a production Google OAuth Client ID."
    );
  }

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const emailVerified = Boolean(payload.email_verified);

  if (!email || !emailVerified) {
    throw new Error("Google account email is missing or not verified.");
  }

  return {
    sub: String(payload.sub || email),
    email,
    email_verified: emailVerified,
    name: String(payload.name || email.split("@")[0]),
    picture: payload.picture ? String(payload.picture) : undefined,
    hd: payload.hd ? String(payload.hd) : undefined,
  };
}
