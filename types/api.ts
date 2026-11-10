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
  UserRole,
  WorkLog,
} from "./domain";

/**
 * Standardized API Response Envelope between Next.js Frontend, BFF API, and Google Apps Script
 */
export interface ApiErrorDetail {
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "CONFLICT"
    | "LOCK_TIMEOUT"
    | "GAS_UNREACHABLE"
    | "INTERNAL_ERROR";
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  timestamp: string; // ISO-8601
  timezone: "Asia/Jakarta";
  mode: "production" | "preview";
  data?: T;
  error?: ApiErrorDetail;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Supported Google Apps Script Dispatcher Actions
 */
export type GasAction =
  | "system.health"
  | "system.initSchema"
  | "dashboard.bundle"
  | "assets.list"
  | "assets.get"
  | "assets.create"
  | "assets.update"
  | "maintenance.list"
  | "maintenance.get"
  | "maintenance.create"
  | "maintenance.updateStatus"
  | "worklogs.list"
  | "worklogs.create"
  | "locations.list"
  | "locations.create"
  | "locations.update"
  | "locations.delete"
  | "users.list"
  | "users.create"
  | "users.update"
  | "users.upsertGoogleLogin"
  | "photos.upload"
  | "logs.list"
  | "settings.list";

export interface GasRequestPayload<TPayload = Record<string, unknown>> {
  secret: string;
  action: GasAction;
  actor: {
    email: string;
    name: string;
    role: UserRole;
  };
  requestId: string;
  payload?: TPayload;
}

export interface ConfigCheckItem {
  key: string;
  label: string;
  configured: boolean;
  requiredForProduction: boolean;
  detail: string;
}

export interface ConfigReadinessReport {
  isProductionReady: boolean;
  mode: "production" | "preview";
  timezone: "Asia/Jakarta";
  checks: ConfigCheckItem[];
  gasHealth?: {
    reachable: boolean;
    latencyMs?: number;
    spreadsheetName?: string;
    tabsVerified?: string[];
    message: string;
  };
}

export interface DashboardSummaryData {
  kpis: {
    totalAssets: number;
    operationalAssets: number;
    underMaintenanceAssets: number;
    openTickets: number;
    criticalTickets: number;
    avgResolutionMinutes: number;
    totalMaintenanceCostIdr: number;
    warrantyExpiringSoon: number;
  };
  assets: Asset[];
  tickets: MaintenanceTicket[];
  workLogs: WorkLog[];
  photos: MaintenancePhoto[];
  statusHistory: StatusHistoryEntry[];
  activityLogs: ActivityLogEntry[];
  locations: HotelLocation[];
  users: User[];
  settings: SystemSetting[];
  sessionUser: SessionUser;
  readiness: ConfigReadinessReport;
}
