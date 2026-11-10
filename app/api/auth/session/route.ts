import { NextResponse } from "next/server";
import { verifyGoogleIdToken } from "@/lib/auth/google-verify";
import {
  getServerSessionUser,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from "@/lib/auth/session";
import {
  getConfigReadinessReport,
  isGasConfigured,
  isPostgresConfigured,
} from "@/lib/config/readiness";
import { getPgPool, pgListUsers } from "@/lib/db/postgres";
import { callGasWebApp } from "@/lib/gas/client";
import { authSessionRequestSchema } from "@/lib/validation/schemas";
import type { ApiResponse } from "@/types/api";
import type { SessionUser, User } from "@/types/domain";

export async function GET() {
  const sessionUser = await getServerSessionUser();
  const readiness = getConfigReadinessReport();
  const response: ApiResponse<SessionUser> = {
    ok: true,
    timestamp: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    mode: readiness.mode,
    data: sessionUser,
  };
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const readiness = getConfigReadinessReport();
  try {
    const json = await request.json();
    const parsed = authSessionRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "VALIDATION_ERROR",
            message: "Payload autentikasi tidak valid.",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (parsed.data.intent !== "google_sso") {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "FORBIDDEN",
            message: "Silakan login menggunakan tombol Sign in with Google (SSO).",
          },
        } satisfies ApiResponse,
        { status: 403 }
      );
    }

    // 1. Verify Google ID Token signature & audience via Google JWKS
    const verified = await verifyGoogleIdToken(parsed.data.idToken);
    const emailLower = verified.email.toLowerCase().trim();

    let existingUsers: User[] = [];

    if (isPostgresConfigured()) {
      existingUsers = await pgListUsers();
    } else if (isGasConfigured()) {
      const listRes = await callGasWebApp<User[]>("users.list", {
        user_id: `sso-${verified.sub}`,
        email: emailLower,
        full_name: verified.name,
        role: "Requestor",
        department: "Unverified",
        is_preview_mode: false,
      });
      if (!listRes.ok) {
        return NextResponse.json(
          {
            ok: false,
            timestamp: new Date().toISOString(),
            timezone: "Asia/Jakarta",
            mode: readiness.mode,
            error: {
              code: "GAS_UNREACHABLE",
              message:
                listRes.error?.message ||
                "Gagal memeriksa daftar user di Google Spreadsheet.",
            },
          } satisfies ApiResponse,
          { status: 500 }
        );
      }
      existingUsers = listRes.data || [];
    } else {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "GAS_UNREACHABLE",
            message:
              "Database (DATABASE_URL atau GAS_WEB_APP_URL) belum dikonfigurasi di .env.local.",
          },
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    const matchedUser = existingUsers.find(
      (u) => String(u.email || "").toLowerCase().trim() === emailLower
    );

    // 2. Strictly reject any Google account whose email is NOT registered in Users
    if (!matchedUser) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "FORBIDDEN",
            message: `Akses Ditolak: Email Google "${verified.email}" tidak terdaftar pada tabel Users. Hubungi Administrator IT untuk mendaftarkan email Anda.`,
          },
        } satisfies ApiResponse,
        { status: 403 }
      );
    }

    // 3. Reject if status is Inactive or Suspended
    if (
      matchedUser.status &&
      String(matchedUser.status).toLowerCase() !== "active"
    ) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "FORBIDDEN",
            message: `Akses Ditolak: Akun "${verified.email}" berstatus "${matchedUser.status}". Hubungi Administrator IT.`,
          },
        } satisfies ApiResponse,
        { status: 403 }
      );
    }

    // 4. Update last_login_at
    if (isPostgresConfigured()) {
      try {
        const pool = getPgPool();
        await pool.query(
          "UPDATE users SET last_login_at = NOW(), full_name = COALESCE(NULLIF(full_name, ''), $1) WHERE LOWER(email) = $2",
          [verified.name, emailLower]
        );
      } catch {
        // Ignore non-critical timestamp update error
      }
    } else if (isGasConfigured()) {
      try {
        await callGasWebApp(
          "users.upsertGoogleLogin",
          {
            user_id: matchedUser.user_id,
            email: matchedUser.email,
            full_name: matchedUser.full_name || verified.name,
            role: matchedUser.role,
            department: matchedUser.department,
            is_preview_mode: false,
          },
          { email: matchedUser.email }
        );
      } catch {
        // Ignore
      }
    }

    const nextUser: SessionUser = {
      user_id: matchedUser.user_id || `usr-${verified.sub}`,
      email: matchedUser.email,
      full_name: matchedUser.full_name || verified.name,
      role: matchedUser.role || "Requestor",
      department: matchedUser.department || "Hotel Operations",
      is_preview_mode: false,
    };

    const token = await signSessionToken(nextUser);
    const res = NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      timezone: "Asia/Jakarta",
      mode: readiness.mode,
      data: nextUser,
    } satisfies ApiResponse<SessionUser>);

    const isHttps =
      request.url.startsWith("https://") ||
      request.headers.get("x-forwarded-proto") === "https";

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "UNAUTHORIZED",
          message:
            err instanceof Error
              ? err.message
              : "Google SSO authentication failed.",
        },
      } satisfies ApiResponse,
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const readiness = getConfigReadinessReport();
  const res = NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    mode: readiness.mode,
    data: { signedOut: true },
  } satisfies ApiResponse);

  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
