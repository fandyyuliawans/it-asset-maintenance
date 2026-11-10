import { AppShell } from "@/components/layout/app-shell";
import { LocationDirectoryClient } from "@/components/locations/location-directory-client";
import { getHotelDashboardData } from "@/lib/gas/client";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const data = await getHotelDashboardData();

  return (
    <AppShell sessionUser={data.sessionUser} readiness={data.readiness}>
      <LocationDirectoryClient
        initialLocations={data.locations}
        assets={data.assets}
        sessionUser={data.sessionUser}
      />
    </AppShell>
  );
}
