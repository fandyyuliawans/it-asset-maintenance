import { AppShell } from "@/components/layout/app-shell";
import { ReportsClient } from "@/components/reports/reports-client";
import { getHotelDashboardData } from "@/lib/gas/client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const data = await getHotelDashboardData();

  return (
    <AppShell sessionUser={data.sessionUser} readiness={data.readiness}>
      <ReportsClient
        assets={data.assets}
        tickets={data.tickets}
        workLogs={data.workLogs}
        photos={data.photos}
        sessionUser={data.sessionUser}
      />
    </AppShell>
  );
}
