-- ============================================================================
-- HOTEL IT ASSET MANAGEMENT & MAINTENANCE SYSTEM — POSTGRESQL SCHEMA
-- Database: PostgreSQL 14+
-- Timezone: Asia/Jakarta (WIB / UTC+7)
-- ============================================================================

-- 1. Table: locations
CREATE TABLE IF NOT EXISTS locations (
  location_id VARCHAR(64) PRIMARY KEY,
  location_code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  building_wing VARCHAR(80) NOT NULL,
  floor VARCHAR(30) NOT NULL,
  area_type VARCHAR(60) NOT NULL,
  pic_department VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table: users
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(160) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'Requestor',
  department VARCHAR(80) NOT NULL DEFAULT 'Information Technology',
  phone_whatsapp VARCHAR(40) DEFAULT '',
  status VARCHAR(24) NOT NULL DEFAULT 'Active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- 3. Table: assets
CREATE TABLE IF NOT EXISTS assets (
  asset_id VARCHAR(64) PRIMARY KEY,
  asset_code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(140) NOT NULL,
  category VARCHAR(60) NOT NULL,
  brand VARCHAR(80) NOT NULL,
  model VARCHAR(100) NOT NULL,
  serial_number VARCHAR(100) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  location_name VARCHAR(120) NOT NULL,
  assigned_department VARCHAR(80) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Operational',
  condition VARCHAR(40) NOT NULL DEFAULT 'Good',
  purchase_date VARCHAR(20) NOT NULL,
  warranty_expiry VARCHAR(20) NOT NULL,
  vendor_name VARCHAR(120) NOT NULL,
  purchase_cost_idr BIGINT NOT NULL DEFAULT 0,
  specs_summary TEXT NOT NULL,
  photo_drive_file_id VARCHAR(120) DEFAULT '',
  photo_url TEXT DEFAULT '',
  qr_payload_url TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_code ON assets (asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets (status);

-- 4. Table: maintenance
CREATE TABLE IF NOT EXISTS maintenance (
  ticket_id VARCHAR(64) PRIMARY KEY,
  ticket_code VARCHAR(32) NOT NULL UNIQUE,
  asset_id VARCHAR(64) NOT NULL,
  asset_code VARCHAR(32) NOT NULL,
  asset_name VARCHAR(140) NOT NULL,
  location_name VARCHAR(120) NOT NULL,
  type VARCHAR(60) NOT NULL,
  priority VARCHAR(24) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Submitted',
  title VARCHAR(160) NOT NULL,
  issue_description TEXT NOT NULL,
  reported_by_user_id VARCHAR(64) NOT NULL,
  reported_by_name VARCHAR(120) NOT NULL,
  reported_by_email VARCHAR(160) NOT NULL,
  assigned_technician_id VARCHAR(64) DEFAULT '',
  assigned_technician_name VARCHAR(120) DEFAULT '',
  root_cause TEXT DEFAULT '',
  resolution_summary TEXT DEFAULT '',
  downtime_minutes INTEGER NOT NULL DEFAULT 0,
  cost_idr BIGINT NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_asset_id ON maintenance (asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance (status);

-- 5. Table: work_logs
CREATE TABLE IF NOT EXISTS work_logs (
  worklog_id VARCHAR(64) PRIMARY KEY,
  ticket_id VARCHAR(64) NOT NULL,
  technician_user_id VARCHAR(64) NOT NULL,
  technician_name VARCHAR(120) NOT NULL,
  action_taken TEXT NOT NULL,
  parts_replaced VARCHAR(300) DEFAULT '',
  time_spent_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_logs_ticket_id ON work_logs (ticket_id);

-- 6. Table: maintenance_photos
CREATE TABLE IF NOT EXISTS maintenance_photos (
  photo_id VARCHAR(64) PRIMARY KEY,
  ticket_id VARCHAR(64) DEFAULT '',
  asset_id VARCHAR(64) NOT NULL,
  stage VARCHAR(24) NOT NULL DEFAULT 'Before',
  drive_file_id VARCHAR(160) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(80) NOT NULL DEFAULT 'image/jpeg',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  caption TEXT DEFAULT '',
  uploaded_by_email VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_ticket_id ON maintenance_photos (ticket_id);

-- 7. Table: status_history
CREATE TABLE IF NOT EXISTS status_history (
  history_id VARCHAR(64) PRIMARY KEY,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  entity_code VARCHAR(32) NOT NULL,
  previous_status VARCHAR(40) NOT NULL,
  new_status VARCHAR(40) NOT NULL,
  changed_by_email VARCHAR(160) NOT NULL,
  changed_by_role VARCHAR(32) NOT NULL,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Table: activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  log_id VARCHAR(64) PRIMARY KEY,
  actor_email VARCHAR(160) NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  summary TEXT NOT NULL,
  metadata_json TEXT DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);

-- 9. Table: settings
CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_by_email VARCHAR(160) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default Seed Data for Locations (if not exists)
INSERT INTO locations (location_id, location_code, name, building_wing, floor, area_type, pic_department, is_active)
VALUES
  ('loc-mdf-001', 'LOC-MDF-01', 'Main Server & MDF Room', 'Main Tower', 'B1', 'Server / MDF / IDF Room', 'Information Technology', TRUE),
  ('loc-fo-002', 'LOC-FO-01', 'Main Lobby Reception Desk', 'Main Tower', 'GF', 'Front Office & Lobby', 'Front Office', TRUE),
  ('loc-fb-003', 'LOC-FB-01', 'Restaurant & Kitchen POS Area', 'Main Tower', 'L1', 'F&B Outlet / Kitchen', 'Food & Beverage', TRUE),
  ('loc-bqt-004', 'LOC-BQT-01', 'Grand Ballroom Control Booth', 'Convention Wing', 'L2', 'Banquet & Meeting Room', 'Banquet & Events', TRUE)
ON CONFLICT (location_id) DO NOTHING;

-- Default Seed Admin User (Ensure your admin email is authorized immediately)
INSERT INTO users (user_id, email, full_name, role, department, status)
VALUES
  ('usr-admin-001', 'surabayadarmoit@quest-hotels.com', 'Fandy Yuliawan', 'Admin', 'Information Technology', 'Active')
ON CONFLICT (email) DO NOTHING;
