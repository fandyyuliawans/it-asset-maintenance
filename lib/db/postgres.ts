import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { Pool } from "pg";
import { getCleanEnv, isGasConfigured, isRealConfigValue } from "@/lib/config/readiness";
import { generateEntityCode } from "@/lib/utils";
import type {
  CreateAssetInput,
  CreateLocationInput,
  CreateMaintenanceTicketInput,
  CreateUserInput,
  UpdateLocationInput,
  UpdateMaintenanceStatusInput,
  UpdateUserInput,
} from "@/lib/validation/schemas";
import type {
  ActivityLogEntry,
  Asset,
  HotelLocation,
  MaintenancePhoto,
  MaintenanceTicket,
  PhotoStage,
  SessionUser,
  StatusHistoryEntry,
  SystemSetting,
  User,
  WorkLog,
} from "@/types/domain";

const globalForPg = globalThis as unknown as {
  __hotelItPgPool?: Pool;
  __hotelItPgPoolUrl?: string;
  __hotelItSchemaInitialized?: boolean;
};

export function isPostgresConfigured(): boolean {
  const dbUrl = getCleanEnv("DATABASE_URL");
  return (
    isRealConfigValue(dbUrl) &&
    (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://"))
  );
}

export function getPgPool(): Pool {
  const dbUrl = getCleanEnv("DATABASE_URL");
  if (!dbUrl) {
    throw new Error("DATABASE_URL belum diatur di .env.local");
  }
  if (!globalForPg.__hotelItPgPool || globalForPg.__hotelItPgPoolUrl !== dbUrl) {
    globalForPg.__hotelItPgPool = new Pool({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
      ssl:
        dbUrl.includes("supabase.co") ||
        dbUrl.includes("neon.tech") ||
        dbUrl.includes("sslmode=require")
          ? { rejectUnauthorized: false }
          : undefined,
    });
    globalForPg.__hotelItPgPoolUrl = dbUrl;
    globalForPg.__hotelItSchemaInitialized = false;
  }
  return globalForPg.__hotelItPgPool;
}

const AUTO_SCHEMA_SQL = `
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

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_by_email VARCHAR(160) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function ensurePostgresSchema(): Promise<void> {
  if (globalForPg.__hotelItSchemaInitialized) return;
  let pool = getPgPool();
  try {
    await pool.query(AUTO_SCHEMA_SQL);
  } catch (err: unknown) {
    const pgErr = err as { code?: string; message?: string };
    // Auto-create database if error 3D000 (database does not exist)
    if (pgErr?.code === "3D000") {
      const dbUrl = getCleanEnv("DATABASE_URL");
      const parsed = new URL(dbUrl);
      const targetDbName = parsed.pathname.replace(/^\//, "") || "it_asset_maintenance";
      parsed.pathname = "/postgres";
      const adminPool = new Pool({ connectionString: parsed.toString() });
      try {
        const safeDbName = targetDbName.replace(/[^a-zA-Z0-9_]/g, "");
        await adminPool.query(`CREATE DATABASE "${safeDbName}"`);
      } finally {
        await adminPool.end().catch(() => {});
      }
      // Recreate pool and run schema
      globalForPg.__hotelItPgPool = undefined;
      pool = getPgPool();
      await pool.query(AUTO_SCHEMA_SQL);
    } else {
      throw err;
    }
  }

  // Seed default locations if empty
  const locCount = await pool.query("SELECT COUNT(*)::int AS cnt FROM locations");
  if ((locCount.rows[0]?.cnt ?? 0) === 0) {
    await pool.query(`
      INSERT INTO locations (location_id, location_code, name, building_wing, floor, area_type, pic_department, is_active)
      VALUES
        ('loc-mdf-001', 'LOC-MDF-01', 'Main Server & MDF Room', 'Main Tower', 'B1', 'Server / MDF / IDF Room', 'Information Technology', TRUE),
        ('loc-fo-002', 'LOC-FO-01', 'Main Lobby Reception Desk', 'Main Tower', 'GF', 'Front Office & Lobby', 'Front Office', TRUE),
        ('loc-fb-003', 'LOC-FB-01', 'Restaurant & Kitchen POS Area', 'Main Tower', 'L1', 'F&B Outlet / Kitchen', 'Food & Beverage', TRUE),
        ('loc-bqt-004', 'LOC-BQT-01', 'Grand Ballroom Control Booth', 'Convention Wing', 'L2', 'Banquet & Meeting Room', 'Banquet & Events', TRUE)
      ON CONFLICT (location_id) DO NOTHING
    `);
  }

  // Ensure initial Admin email is always present if users table is empty
  const userCount = await pool.query("SELECT COUNT(*)::int AS cnt FROM users");
  if ((userCount.rows[0]?.cnt ?? 0) === 0) {
    const rawAdmin = getCleanEnv("INITIAL_ADMIN_EMAILS")
      .split(",")[0]
      ?.trim()
      .toLowerCase();
    const initialAdmin =
      rawAdmin && isRealConfigValue(rawAdmin)
        ? rawAdmin
        : "surabayadarmoit@quest-hotels.com";

    await pool.query(
      `INSERT INTO users (user_id, email, full_name, role, department, status)
       VALUES ($1, $2, $3, 'Admin', 'Information Technology', 'Active')
       ON CONFLICT (email) DO NOTHING`,
      ["usr-admin-001", initialAdmin, "Fandy Yuliawan"]
    );
  }

  globalForPg.__hotelItSchemaInitialized = true;
}

/**
 * Uploads a Base64 photo to Google Drive (if GAS_WEB_APP_URL is configured)
 * OR saves it locally into `public/uploads/maintenance/` if GAS is not used,
 * then records the metadata in the PostgreSQL `maintenance_photos` table.
 */
export async function uploadMaintenancePhotoAndRecord(params: {
  actor: SessionUser;
  base64Data: string;
  originalName?: string;
  mimeType?: string;
  ticketId: string;
  ticketCode: string;
  assetId: string;
  stage: PhotoStage;
}): Promise<MaintenancePhoto> {
  const {
    actor,
    base64Data,
    originalName,
    mimeType = "image/jpeg",
    ticketId,
    ticketCode,
    assetId,
    stage,
  } = params;

  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  const ext = mimeType.includes("png")
    ? ".png"
    : mimeType.includes("webp")
    ? ".webp"
    : ".jpg";
  const safeFileName = `${ticketCode}_${stage}_${Date.now()}${ext}`;

  let driveFileId = `local-${Date.now()}`;
  let fileUrl = "";

  // 1. Try uploading to Google Drive via GAS Web App if configured
  if (isGasConfigured()) {
    try {
      const gasUrl = getCleanEnv("GAS_WEB_APP_URL");
      const gasSecret = getCleanEnv("GAS_SHARED_SECRET");
      const res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: gasSecret,
          action: "photos.upload",
          actor: {
            email: actor.email,
            name: actor.full_name,
            role: actor.role,
          },
          requestId: `photo-${Date.now()}`,
          payload: {
            photo_base64: base64Data,
            photo_name: originalName || safeFileName,
            photo_mime: mimeType,
            ticket_id: ticketId,
            ticket_code: ticketCode,
            asset_id: assetId,
            stage,
          },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data?.caption) {
          driveFileId = json.data.drive_file_id || driveFileId;
          fileUrl = json.data.caption;
        }
      }
    } catch {
      // Fallback to local file storage below
    }
  }

  // 2. Fallback: Save photo file to local public/uploads/maintenance directory
  if (!fileUrl) {
    const uploadDir = path.join(process.cwd(), "public", "uploads", "maintenance");
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, safeFileName);
    await fs.writeFile(filePath, buffer);
    fileUrl = `/uploads/maintenance/${safeFileName}`;
  }

  // 3. Insert photo record into PostgreSQL `maintenance_photos` table
  const pool = getPgPool();
  const photoId = `pht-${crypto.randomUUID()}`;
  const displayFileName = originalName
    ? `${safeFileName} (${originalName})`
    : safeFileName;

  const insertRes = await pool.query(
    `INSERT INTO maintenance_photos
      (photo_id, ticket_id, asset_id, stage, drive_file_id, file_name, mime_type, size_bytes, caption, uploaded_by_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING
       photo_id, ticket_id, asset_id, stage, drive_file_id, file_name, mime_type,
       size_bytes, caption, uploaded_by_email, created_at::text`,
    [
      photoId,
      ticketId,
      assetId,
      stage,
      driveFileId,
      displayFileName,
      mimeType,
      buffer.length,
      fileUrl,
      actor.email,
    ]
  );

  return insertRes.rows[0] as MaintenancePhoto;
}

function normalizeRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (
      (k === "purchase_cost_idr" ||
        k === "cost_idr" ||
        k === "downtime_minutes" ||
        k === "time_spent_minutes" ||
        k === "size_bytes") &&
      typeof v === "string"
    ) {
      out[k] = Number(v) || 0;
    } else if (
      v === null &&
      (k === "last_login_at" ||
        k === "phone_whatsapp" ||
        k === "notes" ||
        k === "resolution_summary" ||
        k === "parts_replaced")
    ) {
      out[k] = "";
    }
  }
  return out as T;
}

function normalizeRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => normalizeRow<T>(r));
}

export async function pgGetAllBundle(): Promise<{
  assets: Asset[];
  users: User[];
  tickets: MaintenanceTicket[];
  workLogs: WorkLog[];
  photos: MaintenancePhoto[];
  statusHistory: StatusHistoryEntry[];
  activityLogs: ActivityLogEntry[];
  locations: HotelLocation[];
  settings: SystemSetting[];
}> {
  await ensurePostgresSchema();
  const pool = getPgPool();

  const [
    assetsRes,
    usersRes,
    ticketsRes,
    workLogsRes,
    photosRes,
    statusHistoryRes,
    activityLogsRes,
    locationsRes,
    settingsRes,
  ] = await Promise.all([
    pool.query(`SELECT * FROM assets ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM users ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM maintenance ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM work_logs ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM maintenance_photos ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM status_history ORDER BY created_at DESC LIMIT 200`),
    pool.query(`SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 200`),
    pool.query(`SELECT * FROM locations ORDER BY location_code ASC`),
    pool.query(`SELECT * FROM settings ORDER BY setting_key ASC`),
  ]);

  return {
    assets: normalizeRows<Asset>(assetsRes.rows),
    users: normalizeRows<User>(usersRes.rows),
    tickets: normalizeRows<MaintenanceTicket>(ticketsRes.rows),
    workLogs: normalizeRows<WorkLog>(workLogsRes.rows),
    photos: normalizeRows<MaintenancePhoto>(photosRes.rows),
    statusHistory: normalizeRows<StatusHistoryEntry>(statusHistoryRes.rows),
    activityLogs: normalizeRows<ActivityLogEntry>(activityLogsRes.rows),
    locations: normalizeRows<HotelLocation>(locationsRes.rows),
    settings: normalizeRows<SystemSetting>(settingsRes.rows),
  };
}

export async function pgWriteActivityLog(
  actor: SessionUser,
  action: string,
  entityType: ActivityLogEntry["entity_type"],
  entityId: string,
  summary: string,
  metadata?: unknown
): Promise<void> {
  const pool = getPgPool();
  await pool.query(
    `INSERT INTO activity_logs (log_id, actor_email, actor_name, actor_role, action, entity_type, entity_id, summary, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      `log-${crypto.randomUUID()}`,
      actor.email,
      actor.full_name,
      actor.role,
      action,
      entityType,
      entityId,
      summary,
      metadata ? JSON.stringify(metadata) : "{}",
    ]
  );
}

export async function pgCreateAsset(
  actor: SessionUser,
  input: CreateAssetInput
): Promise<Asset> {
  await ensurePostgresSchema();
  const pool = getPgPool();

  const countRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM assets");
  const nextSeq = (countRes.rows[0]?.cnt ?? 0) + 1;
  const assetCode = generateEntityCode("AST", nextSeq);
  const assetId = `ast-${crypto.randomUUID()}`;
  const baseUrl = getCleanEnv("APP_BASE_URL") || "http://localhost:3000";
  const qrUrl = `${baseUrl}/assets?code=${assetCode}`;

  const locRes = await pool.query(
    "SELECT name FROM locations WHERE location_id = $1 LIMIT 1",
    [input.location_id]
  );
  const locationName = locRes.rows[0]?.name || input.location_id;

  const insertRes = await pool.query(
    `INSERT INTO assets (
      asset_id, asset_code, name, category, brand, model, serial_number,
      location_id, location_name, assigned_department, status, condition,
      purchase_date, warranty_expiry, vendor_name, purchase_cost_idr,
      specs_summary, qr_payload_url, notes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
    ) RETURNING *`,
    [
      assetId,
      assetCode,
      input.name,
      input.category,
      input.brand,
      input.model,
      input.serial_number,
      input.location_id,
      locationName,
      input.assigned_department,
      input.status || "Operational",
      input.condition || "Good",
      input.purchase_date,
      input.warranty_expiry,
      input.vendor_name,
      input.purchase_cost_idr,
      input.specs_summary,
      qrUrl,
      input.notes || "",
    ]
  );

  const created = normalizeRow<Asset>(insertRes.rows[0]);
  await pgWriteActivityLog(
    actor,
    "ASSET_CREATED",
    "Asset",
    created.asset_id,
    `Registered asset ${created.asset_code} (${created.name})`,
    created
  );
  return created;
}

export async function pgCreateMaintenanceTicket(
  actor: SessionUser,
  input: CreateMaintenanceTicketInput
): Promise<MaintenanceTicket> {
  await ensurePostgresSchema();
  const pool = getPgPool();

  const countRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM maintenance");
  const nextSeq = (countRes.rows[0]?.cnt ?? 0) + 1;
  const ticketCode = generateEntityCode("MNT", nextSeq);
  const ticketId = `tkt-${crypto.randomUUID()}`;

  const assetRes = await pool.query(
    "SELECT asset_code, name, location_name FROM assets WHERE asset_id = $1 LIMIT 1",
    [input.asset_id]
  );
  const asset = assetRes.rows[0];

  let assignedTechName = "";
  if (input.assigned_technician_id) {
    const techRes = await pool.query(
      "SELECT full_name FROM users WHERE user_id = $1 LIMIT 1",
      [input.assigned_technician_id]
    );
    assignedTechName = techRes.rows[0]?.full_name || "";
  }

  let photoInfo: MaintenancePhoto | null = null;
  if (input.photo_base64) {
    photoInfo = await uploadMaintenancePhotoAndRecord({
      actor,
      base64Data: input.photo_base64,
      originalName: input.photo_name,
      mimeType: input.photo_mime,
      ticketId,
      ticketCode,
      assetId: input.asset_id,
      stage: "Before",
    });
  }

  const initialStatus = input.assigned_technician_id ? "Assigned" : "Submitted";
  const descriptionWithPhoto = photoInfo?.caption
    ? `${input.issue_description}\n[Foto Bukti (Before): ${photoInfo.caption}]`
    : input.issue_description;

  const insertRes = await pool.query(
    `INSERT INTO maintenance (
      ticket_id, ticket_code, asset_id, asset_code, asset_name, location_name,
      type, priority, status, title, issue_description,
      reported_by_user_id, reported_by_name, reported_by_email,
      assigned_technician_id, assigned_technician_name
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
    ) RETURNING *`,
    [
      ticketId,
      ticketCode,
      input.asset_id,
      asset?.asset_code || "AST-UNKNOWN",
      asset?.name || "Unknown Asset",
      asset?.location_name || "Hotel Premises",
      input.type,
      input.priority,
      initialStatus,
      input.title,
      descriptionWithPhoto,
      actor.user_id,
      actor.full_name,
      actor.email,
      input.assigned_technician_id || "",
      assignedTechName,
    ]
  );

  await pool.query(
    `INSERT INTO status_history (history_id, entity_type, entity_id, entity_code, previous_status, new_status, changed_by_email, changed_by_role, reason)
     VALUES ($1, 'Maintenance', $2, $3, 'None', $4, $5, $6, $7)`,
    [
      `sh-${crypto.randomUUID()}`,
      ticketId,
      ticketCode,
      initialStatus,
      actor.email,
      actor.role,
      input.title,
    ]
  );

  await pgWriteActivityLog(
    actor,
    "TICKET_CREATED",
    "Maintenance",
    ticketId,
    `Created ticket ${ticketCode} for ${asset?.asset_code || input.asset_id}`,
    { ticket_code: ticketCode, photo_url: photoInfo?.caption }
  );

  return normalizeRow<MaintenanceTicket>(insertRes.rows[0]);
}

export async function pgUpdateMaintenanceStatus(
  actor: SessionUser,
  input: UpdateMaintenanceStatusInput
): Promise<MaintenanceTicket> {
  await ensurePostgresSchema();
  const pool = getPgPool();

  const existingRes = await pool.query(
    "SELECT * FROM maintenance WHERE ticket_id = $1 LIMIT 1",
    [input.ticket_id]
  );
  const ticket = existingRes.rows[0];
  if (!ticket) {
    throw new Error(`Ticket ${input.ticket_id} not found.`);
  }

  let photoInfo: MaintenancePhoto | null = null;
  if (input.photo_base64) {
    photoInfo = await uploadMaintenancePhotoAndRecord({
      actor,
      base64Data: input.photo_base64,
      originalName: input.photo_name,
      mimeType: input.photo_mime,
      ticketId: ticket.ticket_id,
      ticketCode: ticket.ticket_code,
      assetId: ticket.asset_id,
      stage: "After",
    });
  }

  let assignedTechId = ticket.assigned_technician_id;
  let assignedTechName = ticket.assigned_technician_name;
  if (input.assigned_technician_id) {
    assignedTechId = input.assigned_technician_id;
    const techRes = await pool.query(
      "SELECT full_name FROM users WHERE user_id = $1 LIMIT 1",
      [input.assigned_technician_id]
    );
    if (techRes.rows[0]) {
      assignedTechName = techRes.rows[0].full_name;
    }
  }

  const actionWithPhoto = photoInfo?.caption
    ? `${input.action_taken}\n[Foto Hasil (After): ${photoInfo.caption}]`
    : input.action_taken;

  const updRes = await pool.query(
    `UPDATE maintenance
     SET status = $1,
         assigned_technician_id = $2,
         assigned_technician_name = $3,
         downtime_minutes = $4,
         cost_idr = $5,
         resolution_summary = $6,
         updated_at = NOW()
     WHERE ticket_id = $7
     RETURNING *`,
    [
      input.new_status,
      assignedTechId,
      assignedTechName,
      input.downtime_minutes ?? ticket.downtime_minutes,
      input.cost_idr ?? ticket.cost_idr,
      actionWithPhoto,
      input.ticket_id,
    ]
  );

  await pool.query(
    `INSERT INTO work_logs (worklog_id, ticket_id, technician_user_id, technician_name, action_taken, parts_replaced, time_spent_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      `wl-${crypto.randomUUID()}`,
      input.ticket_id,
      actor.user_id,
      actor.full_name,
      actionWithPhoto,
      input.parts_replaced || "",
      input.time_spent_minutes || 15,
    ]
  );

  await pool.query(
    `INSERT INTO status_history (history_id, entity_type, entity_id, entity_code, previous_status, new_status, changed_by_email, changed_by_role, reason)
     VALUES ($1, 'Maintenance', $2, $3, $4, $5, $6, $7, $8)`,
    [
      `sh-${crypto.randomUUID()}`,
      ticket.ticket_id,
      ticket.ticket_code,
      ticket.status,
      input.new_status,
      actor.email,
      actor.role,
      actionWithPhoto,
    ]
  );

  await pgWriteActivityLog(
    actor,
    "TICKET_STATUS_UPDATED",
    "Maintenance",
    ticket.ticket_id,
    `Updated ${ticket.ticket_code}: ${ticket.status} -> ${input.new_status}`,
    { new_status: input.new_status, photo_url: photoInfo?.caption }
  );

  return normalizeRow<MaintenanceTicket>(updRes.rows[0]);
}

export async function pgListUsers(): Promise<User[]> {
  await ensurePostgresSchema();
  const pool = getPgPool();
  const res = await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
  return normalizeRows<User>(res.rows);
}

export async function pgCreateUser(
  actor: SessionUser,
  input: CreateUserInput
): Promise<User> {
  await ensurePostgresSchema();
  const pool = getPgPool();
  const userId = `usr-${crypto.randomUUID()}`;
  const res = await pool.query(
    `INSERT INTO users (user_id, email, full_name, role, department, phone_whatsapp, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      input.email.toLowerCase().trim(),
      input.full_name,
      input.role,
      input.department,
      input.phone_whatsapp || "",
      input.status || "Active",
    ]
  );
  const created = normalizeRow<User>(res.rows[0]);
  await pgWriteActivityLog(
    actor,
    "USER_CREATED",
    "User",
    created.user_id,
    `Created user ${created.full_name} (${created.email}) as ${created.role}`,
    created
  );
  return created;
}

export async function pgUpdateUser(
  actor: SessionUser,
  input: UpdateUserInput
): Promise<User> {
  await ensurePostgresSchema();
  const pool = getPgPool();
  const res = await pool.query(
    `UPDATE users
     SET role = $1,
         department = COALESCE($2, department),
         status = $3,
         updated_at = NOW()
     WHERE user_id = $4
     RETURNING *`,
    [input.role, input.department || null, input.status, input.user_id]
  );
  if (!res.rows[0]) {
    throw new Error(`User ${input.user_id} not found.`);
  }
  const updated = normalizeRow<User>(res.rows[0]);
  await pgWriteActivityLog(
    actor,
    "USER_UPDATED",
    "User",
    updated.user_id,
    `Updated ${updated.email} -> Role: ${updated.role}, Status: ${updated.status}`,
    updated
  );
  return updated;
}

export async function pgCreateLocation(
  actor: SessionUser,
  input: CreateLocationInput
): Promise<HotelLocation> {
  await ensurePostgresSchema();
  const pool = getPgPool();
  const locId = `loc-${crypto.randomUUID().slice(0, 8)}`;
  const res = await pool.query(
    `INSERT INTO locations (location_id, location_code, name, building_wing, floor, area_type, pic_department, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      locId,
      input.location_code.toUpperCase().trim(),
      input.name.trim(),
      input.building_wing.trim(),
      input.floor.trim(),
      input.area_type,
      input.pic_department.trim(),
      input.is_active,
    ]
  );
  const created = normalizeRow<HotelLocation>(res.rows[0]);
  await pgWriteActivityLog(
    actor,
    "LOCATION_CREATED",
    "Location",
    created.location_id,
    `Added location ${created.location_code} — ${created.name}`,
    created
  );
  return created;
}

export async function pgUpdateLocation(
  actor: SessionUser,
  input: UpdateLocationInput
): Promise<HotelLocation> {
  await ensurePostgresSchema();
  const pool = getPgPool();
  const res = await pool.query(
    `UPDATE locations
     SET location_code = $1,
         name = $2,
         building_wing = $3,
         floor = $4,
         area_type = $5,
         pic_department = $6,
         is_active = $7
     WHERE location_id = $8
     RETURNING *`,
    [
      input.location_code.toUpperCase().trim(),
      input.name.trim(),
      input.building_wing.trim(),
      input.floor.trim(),
      input.area_type,
      input.pic_department.trim(),
      input.is_active,
      input.location_id,
    ]
  );
  if (!res.rows[0]) {
    throw new Error(`Location ${input.location_id} not found.`);
  }
  const updated = normalizeRow<HotelLocation>(res.rows[0]);
  await pgWriteActivityLog(
    actor,
    "LOCATION_UPDATED",
    "Location",
    updated.location_id,
    `Updated location ${updated.location_code} — ${updated.name}`,
    updated
  );
  return updated;
}

export async function pgDeleteLocation(
  actor: SessionUser,
  locationId: string
): Promise<{ deletedId: string }> {
  await ensurePostgresSchema();
  const pool = getPgPool();
  const res = await pool.query(
    `DELETE FROM locations WHERE location_id = $1 RETURNING location_code, name`,
    [locationId]
  );
  if (res.rows[0]) {
    await pgWriteActivityLog(
      actor,
      "LOCATION_DELETED",
      "Location",
      locationId,
      `Deleted location ${res.rows[0].location_code} — ${res.rows[0].name}`
    );
  }
  return { deletedId: locationId };
}
