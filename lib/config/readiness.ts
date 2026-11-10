import type { ConfigCheckItem, ConfigReadinessReport } from "@/types/api";

const PLACEHOLDER_VALUES = new Set([
  "",
  "YOUR_GOOGLE_OAUTH_CLIENT_ID",
  "SERVER_SIDE_ONLY_IF_REQUIRED",
  "YOUR_APPS_SCRIPT_WEB_APP_URL",
  "SERVER_SIDE_SECRET_NOT_FOR_BROWSER",
  "REPLACE_WITH_AT_LEAST_32_CHARS_RANDOM_SESSION_SECRET",
  "your-hotel-domain.com",
  "it.admin@your-hotel-domain.com",
  "YOUR_POSTGRESQL_CONNECTION_STRING",
]);

export function isRealConfigValue(val: string | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return false;
  if (PLACEHOLDER_VALUES.has(trimmed)) return false;
  return true;
}

export function getCleanEnv(key: string): string {
  const raw = process.env[key];
  if (!raw) return "";
  return raw.trim().replace(/^["']|["']$/g, "");
}

export function isPostgresConfigured(): boolean {
  const dbUrl = getCleanEnv("DATABASE_URL");
  return (
    isRealConfigValue(dbUrl) &&
    (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://"))
  );
}

export function isGasConfigured(): boolean {
  const url = getCleanEnv("GAS_WEB_APP_URL");
  const secret = getCleanEnv("GAS_SHARED_SECRET");
  return (
    isRealConfigValue(url) &&
    url.startsWith("https://script.google.com/") &&
    isRealConfigValue(secret) &&
    secret.length >= 4
  );
}

export function isGoogleSsoConfigured(): boolean {
  const clientId = getCleanEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  return (
    isRealConfigValue(clientId) &&
    clientId.endsWith(".apps.googleusercontent.com")
  );
}

export function getConfigReadinessReport(): ConfigReadinessReport {
  const pgConfigured = isPostgresConfigured();
  const gasUrl = getCleanEnv("GAS_WEB_APP_URL");
  const gasSecret = getCleanEnv("GAS_SHARED_SECRET");
  const sessionSecret = getCleanEnv("SESSION_SECRET");

  const gasUrlConfigured =
    isRealConfigValue(gasUrl) &&
    gasUrl.startsWith("https://script.google.com/");

  const gasSecretConfigured =
    isRealConfigValue(gasSecret) && gasSecret.length >= 4;

  const googleClientConfigured = isGoogleSsoConfigured();

  const sessionSecretConfigured =
    isRealConfigValue(sessionSecret) && sessionSecret.length >= 8;

  const checks: ConfigCheckItem[] = [
    {
      key: "DATABASE_URL",
      label: "PostgreSQL Database Connection (Fast Primary DB)",
      configured: pgConfigured,
      requiredForProduction: false,
      detail: pgConfigured
        ? "Connected to PostgreSQL (Fast SQL Engine Active)"
        : "Belum diisi di .env.local (isi DATABASE_URL untuk beralih ke PostgreSQL super cepat)",
    },
    {
      key: "GAS_WEB_APP_URL",
      label: "Google Apps Script (Google Drive Photo Upload / Sheets Fallback)",
      configured: gasUrlConfigured && gasSecretConfigured,
      requiredForProduction: false,
      detail:
        gasUrlConfigured && gasSecretConfigured
          ? "Active for Google Drive Photo Uploads"
          : "Using local disk (/uploads/maintenance) for photos",
    },
    {
      key: "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
      label: "Google Identity Services OAuth Client ID",
      configured: googleClientConfigured,
      requiredForProduction: false,
      detail: googleClientConfigured
        ? "Configured (.apps.googleusercontent.com)"
        : "Not configured",
    },
    {
      key: "SESSION_SECRET",
      label: "HTTP-Only Session Signing Secret (HS256)",
      configured: sessionSecretConfigured,
      requiredForProduction: false,
      detail: sessionSecretConfigured
        ? "Custom session signing secret active"
        : "Using default signing key",
    },
  ];

  const isProductionReady =
    pgConfigured || (gasUrlConfigured && gasSecretConfigured);

  return {
    isProductionReady,
    mode: isProductionReady ? "production" : "preview",
    timezone: "Asia/Jakarta",
    checks,
  };
}
