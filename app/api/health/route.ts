import { NextResponse } from "next/server";
import { getHotelDashboardData } from "@/lib/gas/client";
import type { ApiResponse } from "@/types/api";

export async function GET() {
  const data = await getHotelDashboardData();
  const payload: ApiResponse<{
    readiness: typeof data.readiness;
    sessionUser: typeof data.sessionUser;
    kpis: typeof data.kpis;
  }> = {
    ok: true,
    timestamp: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    mode: data.readiness.mode,
    data: {
      readiness: data.readiness,
      sessionUser: data.sessionUser,
      kpis: data.kpis,
    },
  };
  return NextResponse.json(payload);
}
