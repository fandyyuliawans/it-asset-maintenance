import type { UserRole } from "@/types/domain";

export type Permission =
  | "dashboard:view"
  | "assets:view"
  | "assets:create"
  | "assets:edit"
  | "assets:retire"
  | "qr:generate"
  | "qr:scan"
  | "maintenance:view"
  | "maintenance:create"
  | "maintenance:assign"
  | "maintenance:worklog"
  | "maintenance:resolve"
  | "maintenance:close"
  | "reports:view"
  | "reports:export"
  | "logs:view"
  | "locations:view"
  | "locations:manage"
  | "users:view"
  | "users:manage"
  | "settings:view"
  | "settings:manage";

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  Admin: [
    "dashboard:view",
    "assets:view",
    "assets:create",
    "assets:edit",
    "assets:retire",
    "qr:generate",
    "qr:scan",
    "maintenance:view",
    "maintenance:create",
    "maintenance:assign",
    "maintenance:worklog",
    "maintenance:resolve",
    "maintenance:close",
    "reports:view",
    "reports:export",
    "logs:view",
    "locations:view",
    "locations:manage",
    "users:view",
    "users:manage",
    "settings:view",
    "settings:manage",
  ],
  "IT Manager": [
    "dashboard:view",
    "assets:view",
    "assets:create",
    "assets:edit",
    "assets:retire",
    "qr:generate",
    "qr:scan",
    "maintenance:view",
    "maintenance:create",
    "maintenance:assign",
    "maintenance:worklog",
    "maintenance:resolve",
    "maintenance:close",
    "reports:view",
    "reports:export",
    "logs:view",
    "locations:view",
    "locations:manage",
    "users:view",
    "settings:view",
  ],
  Technician: [
    "dashboard:view",
    "assets:view",
    "assets:edit",
    "qr:generate",
    "qr:scan",
    "maintenance:view",
    "maintenance:create",
    "maintenance:worklog",
    "maintenance:resolve",
    "reports:view",
    "locations:view",
  ],
  Requestor: [
    "dashboard:view",
    "assets:view",
    "qr:scan",
    "maintenance:view",
    "maintenance:create",
    "locations:view",
  ],
};

export interface RoleMetadata {
  role: UserRole;
  labelId: string;
  description: string;
  badgeClass: string;
}

export const ROLE_METADATA: Record<UserRole, RoleMetadata> = {
  Admin: {
    role: "Admin",
    labelId: "System Administrator",
    description:
      "Full control over Assets, Maintenance, Users, Audit Logs, and Apps Script Schema.",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300",
  },
  "IT Manager": {
    role: "IT Manager",
    labelId: "Hotel IT Manager",
    description:
      "Manages IT inventory, assigns technicians, approves ticket closure, and exports reports.",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  Technician: {
    role: "Technician",
    labelId: "IT Support Technician",
    description:
      "Executes preventive & corrective maintenance, logs work, scans QR tags, and updates asset condition.",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
  },
  Requestor: {
    role: "Requestor",
    labelId: "Department Requestor",
    description:
      "Front Office, F&B, Housekeeping, or Back Office staff who report issues and track ticket progress.",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed ? allowed.includes(permission) : false;
}

const ROUTE_PERMISSION_MAP: Array<{ prefix: string; permission: Permission }> = [
  { prefix: "/locations", permission: "locations:view" },
  { prefix: "/users", permission: "users:view" },
  { prefix: "/settings", permission: "settings:view" },
  { prefix: "/logs", permission: "logs:view" },
  { prefix: "/reports", permission: "reports:view" },
  { prefix: "/scanner", permission: "qr:scan" },
  { prefix: "/maintenance", permission: "maintenance:view" },
  { prefix: "/assets", permission: "assets:view" },
];

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/login")) {
    return true;
  }
  for (const rule of ROUTE_PERMISSION_MAP) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return hasPermission(role, rule.permission);
    }
  }
  return true;
}
