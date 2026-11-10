"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  Clock,
  HardDrive,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  QrCode,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  hasPermission,
  ROLE_METADATA,
  type Permission,
} from "@/lib/permissions/rbac";
import { cn } from "@/lib/utils";
import type { ConfigReadinessReport } from "@/types/api";
import type { SessionUser } from "@/types/domain";

interface NavItem {
  href: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Executive Dashboard",
    sublabel: "KPIs, SLA & Readiness",
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    href: "/assets",
    label: "Asset Register",
    sublabel: "Inventory & QR Stickers",
    icon: HardDrive,
    permission: "assets:view",
  },
  {
    href: "/maintenance",
    label: "Maintenance & Work Orders",
    sublabel: "Tickets & WorkLogs",
    icon: Wrench,
    permission: "maintenance:view",
  },
  {
    href: "/scanner",
    label: "QR Code Scanner",
    sublabel: "Mobile Tag Lookup",
    icon: QrCode,
    permission: "qr:scan",
  },
  {
    href: "/reports",
    label: "Analytics & Exports",
    sublabel: "SLA & Cost Reports",
    icon: BarChart3,
    permission: "reports:view",
  },
  {
    href: "/logs",
    label: "Audit & Activity Logs",
    sublabel: "Immutable History",
    icon: Activity,
    permission: "logs:view",
  },
  {
    href: "/locations",
    label: "Hotel Locations",
    sublabel: "Wings, Floors & Rooms",
    icon: MapPin,
    permission: "locations:view",
  },
  {
    href: "/users",
    label: "User Management",
    sublabel: "Staff Roles & Google SSO",
    icon: Users,
    permission: "users:view",
  },
  {
    href: "/settings",
    label: "System & GAS Setup",
    sublabel: "9-Tab Schema & RBAC",
    icon: Settings,
    permission: "settings:view",
  },
];

interface AppShellProps {
  sessionUser: SessionUser;
  readiness: ConfigReadinessReport;
  children: React.ReactNode;
}

export function AppShell({ sessionUser, readiness, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wibTime, setWibTime] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);
      setWibTime(`${formatted} WIB`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  const roleMeta = ROLE_METADATA[sessionUser.role] || ROLE_METADATA.Requestor;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900 text-slate-100 border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight text-white">
              IT Asset & Maintenance
            </div>
            <div className="text-[11px] text-slate-400">
              Hotel Operations System
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Signed In Account
          </div>
          <div className="text-xs font-medium text-slate-100 truncate">
            {sessionUser.full_name}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {sessionUser.email}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                roleMeta.badgeClass
              )}
            >
              <ShieldCheck className="h-3 w-3" />
              {sessionUser.role}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-3 w-3" />
              Logout
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const permitted = hasPermission(sessionUser.role, item.permission);
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={permitted ? item.href : "#"}
                onClick={(e) => {
                  if (!permitted) e.preventDefault();
                }}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-xs transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white font-medium shadow-xs"
                    : permitted
                    ? "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    : "text-slate-600 cursor-not-allowed opacity-60"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="truncate">
                    <div>{item.label}</div>
                    <div
                      className={cn(
                        "text-[10px]",
                        isActive ? "text-indigo-200" : "text-slate-400"
                      )}
                    >
                      {item.sublabel}
                    </div>
                  </div>
                </div>
                {!permitted && (
                  <span className="text-[10px] rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
                    Locked
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Database Status</span>
            {readiness.gasHealth?.spreadsheetName === "PostgreSQL Database" ? (
              <Badge variant="success">PostgreSQL Active</Badge>
            ) : readiness.isProductionReady ? (
              <Badge variant="success">GAS Connected</Badge>
            ) : (
              <Badge variant="warning">Disconnected</Badge>
            )}
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed">
            {readiness.gasHealth?.spreadsheetName === "PostgreSQL Database"
              ? "PostgreSQL 9-Tables + Google Drive + SSO"
              : "Google Sheets + Apps Script + Google SSO"}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-xs bg-slate-900 text-slate-100 h-full flex flex-col z-10">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-indigo-400" />
                <span className="font-semibold text-sm">
                  IT Asset & Maintenance
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const permitted = hasPermission(
                  sessionUser.role,
                  item.permission
                );
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={permitted ? item.href : "#"}
                    onClick={(e) => {
                      if (!permitted) {
                        e.preventDefault();
                        return;
                      }
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2.5 text-xs",
                      pathname === item.href
                        ? "bg-indigo-600 text-white"
                        : permitted
                        ? "text-slate-300 hover:bg-slate-800"
                        : "text-slate-600 cursor-not-allowed"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {!permitted && (
                      <span className="text-[10px] text-slate-500">Locked</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-72 min-w-0">
        {/* Top Operational Bar */}
        <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">
                    Hotel IT Operations Platform
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{wibTime || "Asia/Jakarta (WIB)"}</span>
                </div>
              </div>
            </div>

            {/* Signed-In User Info & Logout */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end text-xs">
                <span className="font-semibold text-slate-900">
                  {sessionUser.full_name}
                </span>
                <span className="text-[11px] text-slate-500">
                  {sessionUser.email}
                </span>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold",
                  roleMeta.badgeClass
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {sessionUser.role}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5 text-rose-600" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
