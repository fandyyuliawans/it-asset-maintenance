import { AppShell } from "@/components/layout/app-shell";
import { MaintenanceConsoleClient } from "@/components/maintenance/maintenance-console-client";
import { getHotelDashboardData } from "@/lib/gas/client";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const data = await getHotelDashboardData();

  return (
    <AppShell sessionUser={data.sessionUser} readiness={data.readiness}>
      <MaintenanceConsoleClient
        tickets={data.tickets}
        workLogs={data.workLogs}
        photos={data.photos}
        assets={data.assets}
        users={data.users}
        sessionUser={data.sessionUser}
      />
    </AppShell>
  );
}
