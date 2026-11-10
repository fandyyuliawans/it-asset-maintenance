import { LoginClient } from "@/components/auth/login-client";
import {
  getCleanEnv,
  isGoogleSsoConfigured,
} from "@/lib/config/readiness";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const googleClientId = getCleanEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  const isGoogleConfigured = isGoogleSsoConfigured();

  return (
    <LoginClient
      googleClientId={googleClientId}
      isGoogleConfigured={isGoogleConfigured}
    />
  );
}
