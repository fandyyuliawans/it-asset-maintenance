import { AssetRegisterClient } from "@/components/assets/asset-register-client";
import { AppShell } from "@/components/layout/app-shell";
import { getHotelDashboardData } from "@/lib/gas/client";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const data = await getHotelDashboardData();

  return (
    <AppShell sessionUser={data.sessionUser} readiness={data.readiness}>
      <AssetRegisterClient
        initialAssets={data.assets}
        locations={data.locations}
        sessionUser={data.sessionUser}
        initialCodeFilter={params.code || ""}
      />
    </AppShell>
  );
}
