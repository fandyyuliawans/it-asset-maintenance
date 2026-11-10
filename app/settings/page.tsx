import Link from "next/link";
import {
  CheckCircle2,
  Database,
  MapPin,
  Pencil,
  ShieldCheck,
  Users,
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
import { ROLE_METADATA, ROLE_PERMISSIONS } from "@/lib/permissions/rbac";
import type { UserRole } from "@/types/domain";

export const dynamic = "force-dynamic";

const NINE_TABS = [
  {
    name: "Assets",
    pk: "asset_id (UUID)",
    purpose: "Master IT equipment inventory, warranty, cost & QR URL",
  },
  {
    name: "Users",
    pk: "user_id (UUID)",
    purpose: "Authorized hotel staff profiles, departments & RBAC role",
  },
  {
    name: "Maintenance",
    pk: "ticket_id (UUID)",
    purpose: "Corrective & preventive maintenance work orders & SLA metrics",
  },
  {
    name: "WorkLogs",
    pk: "worklog_id (UUID)",
    purpose: "Technician step-by-step repair actions, parts & time spent",
  },
  {
    name: "MaintenancePhotos",
    pk: "photo_id (UUID)",
    purpose: "Google Drive file IDs for Before/During/After inspection photos",
  },
  {
    name: "StatusHistory",
    pk: "history_id (UUID)",
    purpose: "Immutable state transition log for Assets & Maintenance tickets",
  },
  {
    name: "ActivityLogs",
    pk: "log_id (UUID)",
    purpose: "Append-only system audit trail with actor email, role & WIB time",
  },
  {
    name: "Locations",
    pk: "location_id (UUID)",
    purpose: "Hotel wings, floors, MDF/IDF rooms, Front Office & F&B outlets",
  },
  {
    name: "Settings",
    pk: "setting_key",
    purpose: "Property-wide SLA thresholds, warranty alert days & metadata",
  },
];

export default async function SettingsPage() {
  const data = await getHotelDashboardData();
  const { locations, users, settings, sessionUser, readiness } = data;

  return (
    <AppShell sessionUser={sessionUser} readiness={readiness}>
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h1 className="text-lg font-bold text-slate-900">
          System Configuration, 9-Tab Schema & RBAC Matrix
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Inspect normalized Google Sheets schema, hotel locations (`Locations`
          tab), user roles (`Users` tab), and `Settings` tab parameters
        </p>
      </div>

      {/* 9-Tab Normalized Google Sheets Schema Reference */}
      <Card>
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-600" />
            Google Sheets 9-Tab Normalized Database Schema (`apps-script/Code.gs`)
          </CardTitle>
          <CardDescription>
            Automated by `initializeSpreadsheetSchema()` with `LockService`
            concurrency protection
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {NINE_TABS.map((tab, idx) => (
              <div
                key={tab.name}
                className="rounded-lg border border-slate-200 p-3 text-xs space-y-1 bg-slate-50/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-700">
                    {idx + 1}. {tab.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  PK: {tab.pk}
                </div>
                <p className="text-slate-700">{tab.purpose}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hotel Locations Tab */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-600" />
                Hotel Locations Directory (`Locations` Tab — {locations.length})
              </CardTitle>
              <CardDescription>
                MDF/IDF server rooms, reception desks, F&B outlets & banquet halls
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/locations">
                <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                Kelola Lokasi
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-2.5">
            {locations.map((loc) => (
              <div
                key={loc.location_id}
                className="rounded-lg border border-slate-200 p-3 text-xs flex items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700">
                      {loc.location_code}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {loc.name}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    {loc.building_wing} • Floor {loc.floor} • {loc.area_type}
                  </div>
                </div>
                <Badge variant="outline">{loc.pic_department}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Users & RBAC Matrix */}
        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              Authorized Hotel Staff (`Users` Tab — {users.length})
            </CardTitle>
            <CardDescription>
              Google Workspace SSO accounts & server-enforced RBAC roles
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2.5">
            {users.map((u) => (
              <div
                key={u.user_id}
                className="rounded-lg border border-slate-200 p-3 text-xs flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {u.full_name}
                  </div>
                  <div className="text-slate-500">
                    {u.email} • {u.department}
                  </div>
                </div>
                <Badge variant="default">{u.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* RBAC Matrix & System Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Server-Enforced RBAC Permission Matrix (`lib/permissions/rbac.ts`)
            </CardTitle>
            <CardDescription>
              Permissions enforced by both `middleware.ts` and BFF API routes
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {(Object.keys(ROLE_PERMISSIONS) as UserRole[]).map((role) => (
              <div
                key={role}
                className="rounded-lg border border-slate-200 p-3 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {role} — {ROLE_METADATA[role].labelId}
                  </span>
                  <Badge variant="secondary">
                    {ROLE_PERMISSIONS[role].length} permissions
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {ROLE_PERMISSIONS[role].map((perm) => (
                    <span
                      key={perm}
                      className="font-mono text-[10px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base">
              System Parameters (`Settings` Tab)
            </CardTitle>
            <CardDescription>
              Operational thresholds stored in the `Settings` sheet tab
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2.5">
            {settings.map((s) => (
              <div
                key={s.setting_key}
                className="rounded-lg border border-slate-200 p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-700">
                    {s.setting_key}
                  </span>
                  <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {s.setting_value}
                  </span>
                </div>
                <p className="text-slate-600">{s.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
