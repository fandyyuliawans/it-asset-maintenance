/**
 * Domain Models for Hotel IT Asset Management & Maintenance System
 * Normalized across 9 Google Sheets tabs with UUID Primary Keys
 * Timezone standard: Asia/Jakarta (WIB / UTC+7)
 */

export type UserRole = "Admin" | "IT Manager" | "Technician" | "Requestor";

export type UserStatus = "Active" | "Inactive" | "Suspended";

export type AssetCategory =
  | "Network & Wi-Fi"
  | "POS & Front Office"
  | "Server & Storage"
  | "Guest Room Tech"
  | "CCTV & Security"
  | "Workstation & Laptop"
  | "Printer & Peripheral"
  | "AV & Banquet";

export type AssetStatus =
  | "Operational"
  | "Under Maintenance"
  | "Degraded"
  | "Spare / In Stock"
  | "Retired";

export type AssetCondition = "Excellent" | "Good" | "Fair" | "Poor" | "Critical";

export type MaintenancePriority = "Critical" | "High" | "Medium" | "Low";

export type MaintenanceStatus =
  | "Submitted"
  | "Assigned"
  | "In Progress"
  | "Waiting Parts"
  | "Resolved"
  | "Closed"
  | "Cancelled";

export type MaintenanceType =
  | "Corrective / Breakdown"
  | "Preventive"
  | "Inspection"
  | "Installation / Upgrade";

export type PhotoStage = "Before" | "During" | "After" | "AssetProfile";

export type LocationAreaType =
  | "Front Office & Lobby"
  | "Guest Floor"
  | "Back Office"
  | "F&B Outlet / Kitchen"
  | "Server / MDF / IDF Room"
  | "Banquet & Meeting Room"
  | "Engineering & Basement"
  | "Outdoor / Security Post";

/**
 * Tab 1: Assets
 */
export interface Asset {
  asset_id: string; // UUID primary key
  asset_code: string; // Human-readable e.g. AST-2026-0001
  name: string;
  category: AssetCategory;
  brand: string;
  model: string;
  serial_number: string;
  location_id: string;
  location_name: string;
  assigned_department: string;
  status: AssetStatus;
  condition: AssetCondition;
  purchase_date: string; // YYYY-MM-DD
  warranty_expiry: string; // YYYY-MM-DD
  vendor_name: string;
  purchase_cost_idr: number;
  specs_summary: string;
  photo_drive_file_id?: string;
  photo_url?: string;
  qr_payload_url: string;
  notes?: string;
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
}

/**
 * Tab 2: Users
 */
export interface User {
  user_id: string; // UUID primary key
  email: string;
  full_name: string;
  role: UserRole;
  department: string;
  phone_whatsapp?: string;
  status: UserStatus;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Tab 3: Maintenance
 */
export interface MaintenanceTicket {
  ticket_id: string; // UUID primary key
  ticket_code: string; // e.g. MNT-2026-0042
  asset_id: string;
  asset_code: string;
  asset_name: string;
  location_name: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  title: string;
  issue_description: string;
  reported_by_user_id: string;
  reported_by_name: string;
  reported_by_email: string;
  assigned_technician_id?: string;
  assigned_technician_name?: string;
  root_cause?: string;
  resolution_summary?: string;
  downtime_minutes: number;
  cost_idr: number;
  due_at?: string;
  resolved_at?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Tab 4: WorkLogs
 */
export interface WorkLog {
  worklog_id: string; // UUID primary key
  ticket_id: string;
  technician_user_id: string;
  technician_name: string;
  action_taken: string;
  parts_replaced?: string;
  time_spent_minutes: number;
  created_at: string;
}

/**
 * Tab 5: MaintenancePhotos
 */
export interface MaintenancePhoto {
  photo_id: string; // UUID primary key
  ticket_id?: string;
  asset_id: string;
  stage: PhotoStage;
  drive_file_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  caption?: string; // Holds Google Drive view URL or caption
  drive_url?: string;
  uploaded_by_email: string;
  created_at: string;
}

/**
 * Tab 6: StatusHistory
 */
export interface StatusHistoryEntry {
  history_id: string; // UUID primary key
  entity_type: "Asset" | "Maintenance";
  entity_id: string;
  entity_code: string;
  previous_status: string;
  new_status: string;
  changed_by_email: string;
  changed_by_role: UserRole;
  reason?: string;
  created_at: string;
}

/**
 * Tab 7: ActivityLogs
 */
export interface ActivityLogEntry {
  log_id: string; // UUID primary key
  actor_email: string;
  actor_name: string;
  actor_role: UserRole;
  action: string; // e.g. "ASSET_CREATED", "TICKET_STATUS_UPDATED"
  entity_type: "Asset" | "Maintenance" | "User" | "Location" | "System";
  entity_id: string;
  summary: string;
  metadata_json?: string;
  created_at: string;
}

/**
 * Tab 8: Locations
 */
export interface HotelLocation {
  location_id: string; // UUID primary key
  location_code: string; // e.g. LOC-MDF-01
  name: string;
  building_wing: string;
  floor: string;
  area_type: LocationAreaType;
  pic_department: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Tab 9: Settings
 */
export interface SystemSetting {
  setting_key: string;
  setting_value: string;
  description: string;
  updated_by_email: string;
  updated_at: string;
}

/**
 * Authenticated Session User Context
 */
export interface SessionUser {
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: string;
  is_preview_mode: boolean;
}
