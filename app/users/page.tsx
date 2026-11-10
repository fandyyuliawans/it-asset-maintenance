import { AppShell } from "@/components/layout/app-shell";
import { UserManagementClient } from "@/components/users/user-management-client";
import { getHotelDashboardData } from "@/lib/gas/client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const data = await getHotelDashboardData();

  return (
    <AppShell sessionUser={data.sessionUser} readiness={data.readiness}>
      <UserManagementClient
        initialUsers={data.users}
        sessionUser={data.sessionUser}
      />
    </AppShell>
  );
}
