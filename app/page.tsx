import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getHotelDashboardData } from "@/lib/gas/client";
import { ROLE_METADATA } from "@/lib/permissions/rbac";
import { formatIdr, formatWibDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rbac_denied?: string; role?: string }>;
}) {
  const params = await searchParams;
  const data = await getHotelDashboardData();
  const { kpis, assets, tickets, activityLogs, sessionUser, readiness } = data;
  const roleInfo = ROLE_METADATA[sessionUser.role];

  return (
    <AppShell sessionUser={sessionUser} readiness={readiness}>
      {/* RBAC Denial Alert if redirected by middleware */}
      {params.rbac_denied && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 flex items-start gap-3 text-rose-900">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-sm">
              Server RBAC Access Restricted ({params.rbac_denied})
            </div>
            <p>
              Your active account (<strong>{sessionUser.email}</strong> — Role:{" "}
              <strong>{sessionUser.role}</strong>) does not have permission to
              open <code>{params.rbac_denied}</code>. Please contact a System
              Administrator to update your role in User Management.
            </p>
          </div>
        </div>
      )}

      {/* Top Welcome & Role Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Hotel IT Operations & Maintenance Command Center
            </h1>
            <Badge variant="default">{roleInfo.labelId}</Badge>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            {roleInfo.description}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href="/scanner">
              <QrCode className="h-4 w-4" />
              Scan Asset QR
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/maintenance">
              <Wrench className="h-4 w-4" />
              Work Orders ({kpis.openTickets})
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Total Hotel IT Assets</span>
              <HardDrive className="h-4 w-4 text-indigo-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {kpis.totalAssets}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="text-emerald-700 font-medium">
                {kpis.operationalAssets} Operational
              </span>
              <span>{kpis.underMaintenanceAssets} Attention</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Active Maintenance Queue</span>
              <Wrench className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {kpis.openTickets}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-xs">
              {kpis.criticalTickets > 0 ? (
                <span className="text-rose-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {kpis.criticalTickets} Critical Guest-Facing
                </span>
              ) : (
                <span className="text-emerald-700">Zero Critical Incidents</span>
              )}
              <span className="text-slate-500">SLA Target: 120m</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Avg Resolution Time (MTTR)</span>
              <Clock className="h-4 w-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {kpis.avgResolutionMinutes} mins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="text-emerald-700 font-medium">
                Within Hotel SLA
              </span>
              <span>WIB (UTC+7)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Cumulative Maintenance Cost</span>
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {formatIdr(kpis.totalMaintenanceCostIdr)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{kpis.warrantyExpiringSoon} Warranty Alert (&lt;60d)</span>
              <Link
                href="/reports"
                className="text-indigo-600 hover:underline font-medium"
              >
                Reports →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Two-Column Grid: Active Maintenance Tickets & System Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Active Maintenance Tickets */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-base">
                Priority Maintenance & Work Orders
              </CardTitle>
              <CardDescription>
                Real-time breakdown & preventive maintenance queue across hotel
                zones
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/maintenance">
                Open Console
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {tickets.slice(0, 5).map((ticket) => (
              <div
                key={ticket.ticket_id}
                className="rounded-lg border border-slate-200 p-3.5 hover:border-indigo-200 transition-colors bg-slate-50/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {ticket.ticket_code}
                    </span>
                    <Badge
                      variant={
                        ticket.priority === "Critical"
                          ? "destructive"
                          : ticket.priority === "High"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {ticket.priority}
                    </Badge>
                    <Badge
                      variant={
                        ticket.status === "Resolved" ||
                        ticket.status === "Closed"
                          ? "success"
                          : "default"
                      }
                    >
                      {ticket.status}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {formatWibDateTime(ticket.updated_at)}
                  </span>
                </div>
                <div className="mt-2 font-semibold text-sm text-slate-900">
                  {ticket.title}
                </div>
                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                  {ticket.issue_description}
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div>
                    Asset:{" "}
                    <span className="font-medium text-slate-800">
                      {ticket.asset_code} — {ticket.asset_name}
                    </span>{" "}
                    ({ticket.location_name})
                  </div>
                  <div>
                    Assigned:{" "}
                    <span className="font-medium text-slate-800">
                      {ticket.assigned_technician_name || "Unassigned"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right Column: Configuration Readiness & 9-Tab Schema Status */}
        <Card>
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-600" />
              Environment & GAS Readiness
            </CardTitle>
            <CardDescription>
              Zero-fake-credential verification for Next.js BFF + Apps Script
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="rounded-lg bg-slate-900 text-slate-100 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Runtime Mode:</span>
                <span className="font-semibold text-amber-300 uppercase">
                  {readiness.mode === "production"
                    ? "Production Connected"
                    : "Local Preview Mode"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">9-Tab Schema:</span>
                <span className="text-emerald-400 font-medium">
                  9 / 9 Normalized Tabs Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                {readiness.gasHealth?.message}
              </p>
            </div>

            <div className="space-y-2">
              {readiness.checks.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg border border-slate-200 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-[11px] text-slate-800">
                      {item.key}
                    </span>
                    {item.configured ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-medium text-[11px]">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Preview Default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Two-Column Grid: Critical Hotel IT Assets & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-base">
                Registered Hotel IT Infrastructure
              </CardTitle>
              <CardDescription>
                Core switches, POS terminals, projectors, kitchen printers & NVR
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/assets">
                Asset Register ({assets.length})
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-2.5">
            {assets.slice(0, 5).map((asset) => (
              <div
                key={asset.asset_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-indigo-700">
                      {asset.asset_code}
                    </span>
                    <span className="font-medium text-slate-900 truncate">
                      {asset.name}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-0.5 truncate">
                    {asset.category} • {asset.location_name}
                  </div>
                </div>
                <Badge
                  variant={
                    asset.status === "Operational"
                      ? "success"
                      : asset.status === "Under Maintenance"
                      ? "destructive"
                      : "warning"
                  }
                >
                  {asset.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-600" />
                Recent Audit & Activity Logs
              </CardTitle>
              <CardDescription>
                Append-only operational log recorded in Asia/Jakarta (WIB)
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/logs">Full Audit Log</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-2.5">
            {activityLogs.slice(0, 5).map((log) => (
              <div
                key={log.log_id}
                className="rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-[11px] text-indigo-700">
                    {log.action}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatWibDateTime(log.created_at)}
                  </span>
                </div>
                <p className="text-slate-800">{log.summary}</p>
                <div className="text-[11px] text-slate-500">
                  Actor: <span className="font-medium">{log.actor_name}</span> (
                  {log.actor_role})
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
