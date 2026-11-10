import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import {
  getConfigReadinessReport,
  isGasConfigured,
  isPostgresConfigured,
} from "@/lib/config/readiness";
import {
  pgCreateLocation,
  pgDeleteLocation,
  pgGetAllBundle,
  pgUpdateLocation,
} from "@/lib/db/postgres";
import { callGasWebApp } from "@/lib/gas/client";
import {
  createPreviewLocation,
  deletePreviewLocation,
  getPreviewStore,
  updatePreviewLocation,
} from "@/lib/gas/mock-store";
import { hasPermission } from "@/lib/permissions/rbac";
import {
  createLocationSchema,
  deleteLocationSchema,
  updateLocationSchema,
} from "@/lib/validation/schemas";
import type { ApiResponse } from "@/types/api";
import type { HotelLocation } from "@/types/domain";

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
      data: bundle.locations,
    } satisfies ApiResponse<HotelLocation[]>);
  }

  if (isGasConfigured()) {
    const gasRes = await callGasWebApp<HotelLocation[]>(
      "locations.list",
      actor
    );
    return NextResponse.json(gasRes);
  }

  const store = getPreviewStore();
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    mode: readiness.mode,
    data: store.locations,
  } satisfies ApiResponse<HotelLocation[]>);
}

export async function POST(request: Request) {
  const readiness = getConfigReadinessReport();
  const actor = await getServerSessionUser();

  if (!hasPermission(actor.role, "locations:manage")) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "FORBIDDEN",
          message: `Role '${actor.role}' does not have permission 'locations:manage'.`,
        },
      } satisfies ApiResponse,
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid location fields.",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (isPostgresConfigured()) {
      const created = await pgCreateLocation(actor, parsed.data);
      return NextResponse.json(
        {
          ok: true,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: "production",
          data: created,
        } satisfies ApiResponse<HotelLocation>,
        { status: 201 }
      );
    }

    if (isGasConfigured()) {
      const gasRes = await callGasWebApp<HotelLocation>(
        "locations.create",
        actor,
        parsed.data as unknown as Record<string, unknown>
      );
      if (gasRes.ok) {
        return NextResponse.json(gasRes, { status: 201 });
      }
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "INTERNAL_ERROR",
            message:
              gasRes.error?.message ||
              "Pastikan Code.gs di Google Apps Script sudah di-update dan di-deploy versi baru.",
          },
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    const created = createPreviewLocation(actor, parsed.data);
    return NextResponse.json(
      {
        ok: true,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        data: created,
      } satisfies ApiResponse<HotelLocation>,
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
            err instanceof Error ? err.message : "Failed to create location.",
        },
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const readiness = getConfigReadinessReport();
  const actor = await getServerSessionUser();

  if (!hasPermission(actor.role, "locations:manage")) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "FORBIDDEN",
          message: `Role '${actor.role}' does not have permission 'locations:manage'.`,
        },
      } satisfies ApiResponse,
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid location update fields.",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (isPostgresConfigured()) {
      const updated = await pgUpdateLocation(actor, parsed.data);
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: "production",
        data: updated,
      } satisfies ApiResponse<HotelLocation>);
    }

    if (isGasConfigured()) {
      const gasRes = await callGasWebApp<HotelLocation>(
        "locations.update",
        actor,
        parsed.data as unknown as Record<string, unknown>
      );
      if (gasRes.ok) {
        return NextResponse.json(gasRes);
      }
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "INTERNAL_ERROR",
            message:
              gasRes.error?.message ||
              "Pastikan Code.gs di Google Apps Script sudah di-update dan di-deploy versi baru.",
          },
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    const updated = updatePreviewLocation(actor, parsed.data);
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      timezone: "Asia/Jakarta",
      mode: readiness.mode,
      data: updated,
    } satisfies ApiResponse<HotelLocation>);
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
            err instanceof Error ? err.message : "Failed to update location.",
        },
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const readiness = getConfigReadinessReport();
  const actor = await getServerSessionUser();

  if (!hasPermission(actor.role, "locations:manage")) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "FORBIDDEN",
          message: `Role '${actor.role}' does not have permission 'locations:manage'.`,
        },
      } satisfies ApiResponse,
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = deleteLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "VALIDATION_ERROR",
            message: "Location ID is required for deletion.",
          },
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (isPostgresConfigured()) {
      const deleted = await pgDeleteLocation(actor, parsed.data.location_id);
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: "production",
        data: deleted,
      } satisfies ApiResponse<{ deletedId: string }>);
    }

    if (isGasConfigured()) {
      const gasRes = await callGasWebApp<{ deletedId: string }>(
        "locations.delete",
        actor,
        parsed.data as unknown as Record<string, unknown>
      );
      if (gasRes.ok) {
        return NextResponse.json(gasRes);
      }
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "INTERNAL_ERROR",
            message:
              gasRes.error?.message ||
              "Pastikan Code.gs di Google Apps Script sudah di-update dan di-deploy versi baru.",
          },
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    const deleted = deletePreviewLocation(parsed.data.location_id);
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      timezone: "Asia/Jakarta",
      mode: readiness.mode,
      data: deleted,
    } satisfies ApiResponse<{ deletedId: string }>);
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
            err instanceof Error ? err.message : "Failed to delete location.",
        },
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
