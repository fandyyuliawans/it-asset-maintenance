import { Activity, History } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getHotelDashboardData } from "@/lib/gas/client";
import { formatWibDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const data = await getHotelDashboardData();
  const { activityLogs, statusHistory, sessionUser, readiness } = data;

  return (
    <AppShell sessionUser={sessionUser} readiness={readiness}>
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h1 className="text-lg font-bold text-slate-900">
          Immutable Audit Trail (`ActivityLogs` & `StatusHistory` Tabs)
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Append-only record of all asset registrations, status transitions,
          work logs, and RBAC events in Asia/Jakarta (WIB)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" />
              System Activity Logs ({activityLogs.length})
            </CardTitle>
            <CardDescription>
              Google Sheets `ActivityLogs` tab written by `Audit.gs`
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {activityLogs.map((log) => (
              <div
                key={log.log_id}
                className="rounded-lg border border-slate-200 p-3 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {log.action}
                    </span>
                    <Badge variant="outline">{log.entity_type}</Badge>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {formatWibDateTime(log.created_at, {
                      includeSeconds: true,
                    })}
                  </span>
                </div>
                <p className="text-slate-800 font-medium">{log.summary}</p>
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                  <span>
                    Actor: <strong>{log.actor_name}</strong> ({log.actor_email})
                  </span>
                  <Badge variant="secondary">{log.actor_role}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-600" />
              Entity Status Transition History ({statusHistory.length})
            </CardTitle>
            <CardDescription>
              Google Sheets `StatusHistory` tab tracking Asset & Maintenance
              state changes
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {statusHistory.map((sh) => (
              <div
                key={sh.history_id}
                className="rounded-lg border border-slate-200 p-3 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900">
                      {sh.entity_code}
                    </span>
                    <Badge variant="outline">{sh.entity_type}</Badge>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {formatWibDateTime(sh.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Badge variant="secondary">{sh.previous_status}</Badge>
                  <span className="text-slate-400 font-bold">→</span>
                  <Badge variant="success">{sh.new_status}</Badge>
                </div>
                {sh.reason && (
                  <p className="text-slate-700">Reason: {sh.reason}</p>
                )}
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  Changed by: <strong>{sh.changed_by_email}</strong> (
                  {sh.changed_by_role})
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
