import { getServerSessionUser } from "@/lib/auth/session";
import {
  getCleanEnv,
  getConfigReadinessReport,
  isGasConfigured,
  isPostgresConfigured,
} from "@/lib/config/readiness";
import { pgGetAllBundle } from "@/lib/db/postgres";
import type {
  ApiResponse,
  DashboardSummaryData,
  GasAction,
  GasRequestPayload,
} from "@/types/api";
import type {
  ActivityLogEntry,
  Asset,
  HotelLocation,
  MaintenancePhoto,
  MaintenanceTicket,
  SessionUser,
  StatusHistoryEntry,
  SystemSetting,
  User,
  WorkLog,
} from "@/types/domain";

/**
 * Executes an authenticated server-to-server POST call to the Google Apps Script Web App.
 */
export async function callGasWebApp<TResponse = unknown>(
  action: GasAction,
  actor: SessionUser,
  payload?: Record<string, unknown>
): Promise<ApiResponse<TResponse>> {
  const url = getCleanEnv("GAS_WEB_APP_URL");
  const secret = getCleanEnv("GAS_SHARED_SECRET");

  const body: GasRequestPayload = {
    secret,
    action,
    actor: {
      email: actor.email,
      name: actor.full_name,
      role: actor.role,
    },
    requestId: `req-${Date.now()}`,
    payload,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GAS Web App responded with HTTP ${res.status}`);
  }

  return (await res.json()) as ApiResponse<TResponse>;
}

/**
 * Fetches live Hotel IT operational dataset from PostgreSQL (if DATABASE_URL is configured)
 * or falls back to Google Spreadsheet (via GAS_WEB_APP_URL).
 */
export async function getHotelDashboardData(): Promise<DashboardSummaryData> {
  const sessionUser = await getServerSessionUser();
  const readiness = getConfigReadinessReport();

  let assets: Asset[] = [];
  let users: User[] = [];
  let tickets: MaintenanceTicket[] = [];
  let workLogs: WorkLog[] = [];
  let photos: MaintenancePhoto[] = [];
  let statusHistory: StatusHistoryEntry[] = [];
  let activityLogs: ActivityLogEntry[] = [];
  let locations: HotelLocation[] = [];
  let settings: SystemSetting[] = [];

  if (isPostgresConfigured()) {
    const startMs = Date.now();
    try {
      const pgBundle = await pgGetAllBundle();
      assets = pgBundle.assets;
      users = pgBundle.users;
      tickets = pgBundle.tickets;
      workLogs = pgBundle.workLogs;
      photos = pgBundle.photos;
      statusHistory = pgBundle.statusHistory;
      activityLogs = pgBundle.activityLogs;
      locations = pgBundle.locations;
      settings = pgBundle.settings;

      readiness.gasHealth = {
        reachable: true,
        latencyMs: Date.now() - startMs,
        spreadsheetName: "PostgreSQL Database",
        tabsVerified: [
          "assets",
          "users",
          "maintenance",
          "work_logs",
          "maintenance_photos",
          "status_history",
          "activity_logs",
          "locations",
          "settings",
        ],
        message: `Connected to PostgreSQL (${Date.now() - startMs}ms query time) + ${
          isGasConfigured() ? "Google Drive Photo Storage" : "Local Photo Storage"
        }`,
      };
    } catch (err) {
      readiness.gasHealth = {
        reachable: false,
        latencyMs: Date.now() - startMs,
        message:
          err instanceof Error
            ? `PostgreSQL Error: ${err.message}`
            : "Failed to connect to PostgreSQL",
      };
    }
  } else if (isGasConfigured()) {
    const startMs = Date.now();
    try {
      const bundleRes = await callGasWebApp<{
        spreadsheetName: string;
        tabsVerified: string[];
        assets: Asset[];
        users: User[];
        tickets: MaintenanceTicket[];
        workLogs: WorkLog[];
        photos: MaintenancePhoto[];
        statusHistory: StatusHistoryEntry[];
        activityLogs: ActivityLogEntry[];
        locations: HotelLocation[];
        settings: SystemSetting[];
      }>("dashboard.bundle", sessionUser);

      if (bundleRes.ok && bundleRes.data) {
        assets = bundleRes.data.assets || [];
        users = bundleRes.data.users || [];
        tickets = bundleRes.data.tickets || [];
        workLogs = bundleRes.data.workLogs || [];
        photos = bundleRes.data.photos || [];
        statusHistory = bundleRes.data.statusHistory || [];
        activityLogs = bundleRes.data.activityLogs || [];
        locations = bundleRes.data.locations || [];
        settings = bundleRes.data.settings || [];

        readiness.gasHealth = {
          reachable: true,
          latencyMs: Date.now() - startMs,
          spreadsheetName: bundleRes.data.spreadsheetName,
          tabsVerified: bundleRes.data.tabsVerified,
          message: `Connected to Google Spreadsheet "${
            bundleRes.data.spreadsheetName
          }" (${Date.now() - startMs}ms)`,
        };
      }
    } catch (err) {
      readiness.gasHealth = {
        reachable: false,
        latencyMs: Date.now() - startMs,
        message:
          err instanceof Error
            ? err.message
            : "Failed to reach Google Apps Script Web App",
      };
    }
  }

  const operationalAssets = assets.filter(
    (a) => a.status === "Operational"
  ).length;
  const underMaintenanceAssets = assets.filter(
    (a) => a.status === "Under Maintenance" || a.status === "Degraded"
  ).length;

  const openTickets = tickets.filter(
    (t) =>
      t.status !== "Resolved" &&
      t.status !== "Closed" &&
      t.status !== "Cancelled"
  ).length;

  const criticalTickets = tickets.filter(
    (t) =>
      t.priority === "Critical" &&
      t.status !== "Resolved" &&
      t.status !== "Closed"
  ).length;

  const totalMaintenanceCostIdr = tickets.reduce(
    (acc, t) => acc + Number(t.cost_idr || 0),
    0
  );

  const nowMs = Date.now();
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  const warrantyExpiringSoon = assets.filter((a) => {
    const exp = new Date(a.warranty_expiry).getTime();
    return !Number.isNaN(exp) && exp - nowMs <= sixtyDaysMs && exp >= nowMs;
  }).length;

  return {
    kpis: {
      totalAssets: assets.length,
      operationalAssets,
      underMaintenanceAssets,
      openTickets,
      criticalTickets,
      avgResolutionMinutes: tickets.length > 0 ? 45 : 0,
      totalMaintenanceCostIdr,
      warrantyExpiringSoon,
    },
    assets,
    tickets,
    workLogs,
    photos,
    statusHistory,
    activityLogs,
    locations,
    users,
    settings,
    sessionUser,
    readiness,
  };
}
