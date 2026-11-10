import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import {
  getConfigReadinessReport,
  isGasConfigured,
  isPostgresConfigured,
} from "@/lib/config/readiness";
import { pgCreateAsset, pgGetAllBundle } from "@/lib/db/postgres";
import { callGasWebApp } from "@/lib/gas/client";
import { createPreviewAsset, getPreviewStore } from "@/lib/gas/mock-store";
import { hasPermission } from "@/lib/permissions/rbac";
import { createAssetSchema } from "@/lib/validation/schemas";
import type { ApiResponse } from "@/types/api";
import type { Asset } from "@/types/domain";

export async function GET() {
  const readiness = getConfigReadinessReport();
  const actor = await getServerSessionUser();

  if (isPostgresConfigured()) {
    const bundle = await pgGetAllBundle();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      timezone: "Asia/Jakarta",
      mode: "production",
      data: bundle.assets,
    } satisfies ApiResponse<Asset[]>);
  }

  if (isGasConfigured()) {
    const gasRes = await callGasWebApp<Asset[]>("assets.list", actor);
    return NextResponse.json(gasRes);
  }

  const store = getPreviewStore();
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    mode: readiness.mode,
    data: store.assets,
  } satisfies ApiResponse<Asset[]>);
}

export async function POST(request: Request) {
  const readiness = getConfigReadinessReport();
  const actor = await getServerSessionUser();

  if (!hasPermission(actor.role, "assets:create")) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "FORBIDDEN",
          message: `Role '${actor.role}' does not have permission 'assets:create'.`,
        },
      } satisfies ApiResponse,
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "VALIDATION_ERROR",
            message: "Please check the asset registration fields.",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (isPostgresConfigured()) {
      const created = await pgCreateAsset(actor, parsed.data);
      return NextResponse.json(
        {
          ok: true,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: "production",
          data: created,
        } satisfies ApiResponse<Asset>,
        { status: 201 }
      );
    }

    if (isGasConfigured()) {
      const gasRes = await callGasWebApp<Asset>(
        "assets.create",
        actor,
        parsed.data as unknown as Record<string, unknown>
      );
      return NextResponse.json(gasRes, { status: gasRes.ok ? 201 : 500 });
    }

    const created = createPreviewAsset(actor, parsed.data);
    return NextResponse.json(
      {
        ok: true,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        data: created,
      } satisfies ApiResponse<Asset>,
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
            err instanceof Error ? err.message : "Failed to create asset.",
        },
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
