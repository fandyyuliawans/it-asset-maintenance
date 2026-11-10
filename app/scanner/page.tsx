import { AppShell } from "@/components/layout/app-shell";
import { QrScannerClient } from "@/components/scanner/qr-scanner-client";
import { getHotelDashboardData } from "@/lib/gas/client";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const data = await getHotelDashboardData();

  return (
    <AppShell sessionUser={data.sessionUser} readiness={data.readiness}>
      <QrScannerClient assets={data.assets} tickets={data.tickets} />
    </AppShell>
  );
}
