import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import {
  getConfigReadinessReport,
  isGasConfigured,
  isPostgresConfigured,
} from "@/lib/config/readiness";
import {
  pgCreateMaintenanceTicket,
  pgGetAllBundle,
  pgUpdateMaintenanceStatus,
} from "@/lib/db/postgres";
import { callGasWebApp } from "@/lib/gas/client";
import {
  createPreviewTicket,
  getPreviewStore,
  updatePreviewTicketStatus,
} from "@/lib/gas/mock-store";
import { hasPermission } from "@/lib/permissions/rbac";
import {
  createMaintenanceTicketSchema,
  updateMaintenanceStatusSchema,
} from "@/lib/validation/schemas";
import type { ApiResponse } from "@/types/api";
import type { MaintenanceTicket } from "@/types/domain";

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
      data: bundle.tickets,
    } satisfies ApiResponse<MaintenanceTicket[]>);
  }

  if (isGasConfigured()) {
    const gasRes = await callGasWebApp<MaintenanceTicket[]>(
      "maintenance.list",
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
    data: store.tickets,
  } satisfies ApiResponse<MaintenanceTicket[]>);
}

export async function POST(request: Request) {
  const readiness = getConfigReadinessReport();
  const actor = await getServerSessionUser();

  if (!hasPermission(actor.role, "maintenance:create")) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "FORBIDDEN",
          message: `Role '${actor.role}' is not permitted to create maintenance tickets.`,
        },
      } satisfies ApiResponse,
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createMaintenanceTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "VALIDATION_ERROR",
            message: "Please check the maintenance request fields.",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (isPostgresConfigured()) {
      const created = await pgCreateMaintenanceTicket(actor, parsed.data);
      return NextResponse.json(
        {
          ok: true,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: "production",
          data: created,
        } satisfies ApiResponse<MaintenanceTicket>,
        { status: 201 }
      );
    }

    if (isGasConfigured()) {
      const gasRes = await callGasWebApp<MaintenanceTicket>(
        "maintenance.create",
        actor,
        parsed.data as unknown as Record<string, unknown>
      );
      return NextResponse.json(gasRes, { status: gasRes.ok ? 201 : 500 });
    }

    const created = createPreviewTicket(actor, parsed.data);
    return NextResponse.json(
      {
        ok: true,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        data: created,
      } satisfies ApiResponse<MaintenanceTicket>,
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
            err instanceof Error
              ? err.message
              : "Failed to submit maintenance ticket.",
        },
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const readiness = getConfigReadinessReport();
  const actor = await getServerSessionUser();

  if (!hasPermission(actor.role, "maintenance:worklog")) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: readiness.mode,
        error: {
          code: "FORBIDDEN",
          message: `Role '${actor.role}' cannot update maintenance status or log technician work.`,
        },
      } satisfies ApiResponse,
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateMaintenanceStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid work log / status transition fields.",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (
      parsed.data.new_status === "Closed" &&
      !hasPermission(actor.role, "maintenance:close")
    ) {
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          timezone: "Asia/Jakarta",
          mode: readiness.mode,
          error: {
            code: "FORBIDDEN",
            message: `Only IT Manager or Admin can mark a ticket as Closed (Current role: ${actor.role}).`,
          },
        } satisfies ApiResponse,
        { status: 403 }
      );
    }

    if (isPostgresConfigured()) {
      const updated = await pgUpdateMaintenanceStatus(actor, parsed.data);
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Jakarta",
        mode: "production",
        data: updated,
      } satisfies ApiResponse<MaintenanceTicket>);
    }

    if (isGasConfigured()) {
      const gasRes = await callGasWebApp<MaintenanceTicket>(
        "maintenance.updateStatus",
        actor,
        parsed.data as unknown as Record<string, unknown>
      );
      return NextResponse.json(gasRes, { status: gasRes.ok ? 200 : 500 });
    }

    const updated = updatePreviewTicketStatus(actor, parsed.data);
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      timezone: "Asia/Jakarta",
      mode: readiness.mode,
      data: updated,
    } satisfies ApiResponse<MaintenanceTicket>);
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
            err instanceof Error
              ? err.message
              : "Failed to update maintenance ticket.",
        },
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
