import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import {
  getConfigReadinessReport,
  isGasConfigured,
  isPostgresConfigured,
} from "@/lib/config/readiness";
import {
  pgCreateUser,
  pgListUsers,
  pgUpdateUser,
} from "@/lib/db/postgres";
import { callGasWebApp } from "@/lib/gas/client";
import {
  createPreviewUser,
  getPreviewStore,
  updatePreviewUser,
} from "@/lib/gas/mock-store";
import { hasPermission } from "@/lib/permissions/rbac";
import { createUserSchema, updateUserSchema } from "@/lib/validation/schemas";
import type { ApiResponse } from "@/types/api";
import type { User } from "@/types/domain";

export async function GET() {
  const readiness = getConfigReadinessReport();
  const actor = await getServerSessionUser();

  if (isPostgresConfigured()) {
    const users = await pgListUsers();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      timezone: "Asia/Jakarta",
      mode: "production",
      data: users,
    } satisfies ApiResponse<User[]>);
  }

  if (isGasConfigured()) {
    const gasRes = await callGasWebApp<User[]>("users.list", actor);
    return NextResponse.json(gasRes);
  }

  const store = getPreviewStore();
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    mode: readiness.mode,
    data: store.users,
  } satisfies ApiResponse<User[]>);
}

export async function POST(request: Request) {
  const readiness = getConfigReadinessReport();
  const actor = await getServerSessionUser();

  if (!hasPermission(actor.role, "users:manage")) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "FORBIDDEN",
          message: `Only Admin has permission 'users:manage' to add users.`,
        },
      } satisfies ApiResponse,
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid user fields.",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (isPostgresConfigured()) {
      const created = await pgCreateUser(actor, parsed.data);
      return NextResponse.json(
        {
          ok: true,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: "production",
          data: created,
        } satisfies ApiResponse<User>,
        { status: 201 }
      );
    }

    if (isGasConfigured()) {
      const gasRes = await callGasWebApp<User>(
        "users.create",
        actor,
        parsed.data as unknown as Record<string, unknown>
      );
      if (gasRes.ok) {
        return NextResponse.json(gasRes, { status: 201 });
      }
    }

    const created = createPreviewUser(actor, parsed.data);
    return NextResponse.json(
      {
        ok: true,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        data: created,
      } satisfies ApiResponse<User>,
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to create user.",
        },
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const readiness = getConfigReadinessReport();
  const actor = await getServerSessionUser();

  if (!hasPermission(actor.role, "users:manage")) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "FORBIDDEN",
          message: `Only Admin has permission 'users:manage' to modify user roles or status.`,
        },
      } satisfies ApiResponse,
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid user update payload.",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (isPostgresConfigured()) {
      const updated = await pgUpdateUser(actor, parsed.data);
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: "production",
        data: updated,
      } satisfies ApiResponse<User>);
    }

    if (isGasConfigured()) {
      const gasRes = await callGasWebApp<User>(
        "users.update",
        actor,
        parsed.data as unknown as Record<string, unknown>
      );
      if (gasRes.ok) {
        return NextResponse.json(gasRes);
      }
    }

    const updated = updatePreviewUser(actor, parsed.data);
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      timezone: "Asia/Jakarta",
      mode: readiness.mode,
      data: updated,
    } satisfies ApiResponse<User>);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "INTERNAL_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to update user.",
        },
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
