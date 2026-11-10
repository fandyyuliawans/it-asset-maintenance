import { generateEntityCode } from "@/lib/utils";
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
import type {
  CreateAssetInput,
  CreateLocationInput,
  CreateMaintenanceTicketInput,
  CreateUserInput,
  UpdateLocationInput,
  UpdateMaintenanceStatusInput,
  UpdateUserInput,
} from "@/lib/validation/schemas";

interface HotelPreviewStore {
  assets: Asset[];
  users: User[];
  tickets: MaintenanceTicket[];
  workLogs: WorkLog[];
  photos: MaintenancePhoto[];
  statusHistory: StatusHistoryEntry[];
  activityLogs: ActivityLogEntry[];
  locations: HotelLocation[];
  settings: SystemSetting[];
}

const globalForStore = globalThis as unknown as {
  __hotelItPreviewStore?: HotelPreviewStore;
};

export function getPreviewStore(): HotelPreviewStore {
  if (!globalForStore.__hotelItPreviewStore) {
    globalForStore.__hotelItPreviewStore = {
      assets: [],
      users: [],
      tickets: [],
      workLogs: [],
      photos: [],
      statusHistory: [],
      activityLogs: [],
      locations: [],
      settings: [],
    };
  }
  return globalForStore.__hotelItPreviewStore;
}

export function createPreviewAsset(
  actor: SessionUser,
  input: CreateAssetInput
): Asset {
  const store = getPreviewStore();
  const nextSeq = store.assets.length + 1;
  const assetCode = generateEntityCode("AST", nextSeq);
  const nowIso = new Date().toISOString();
  const location = store.locations.find(
    (l) => l.location_id === input.location_id
  );
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  const newAsset: Asset = {
    asset_id: `ast-uuid-${Date.now()}`,
    asset_code: assetCode,
    name: input.name,
    category: input.category,
    brand: input.brand,
    model: input.model,
    serial_number: input.serial_number,
    location_id: input.location_id,
    location_name: location ? location.name : input.location_id,
    assigned_department: input.assigned_department,
    status: input.status,
    condition: input.condition,
    purchase_date: input.purchase_date,
    warranty_expiry: input.warranty_expiry,
    vendor_name: input.vendor_name,
    purchase_cost_idr: input.purchase_cost_idr,
    specs_summary: input.specs_summary,
    qr_payload_url: `${baseUrl}/assets?code=${assetCode}`,
    notes: input.notes,
    created_at: nowIso,
    updated_at: nowIso,
  };

  store.assets.unshift(newAsset);
  return newAsset;
}

export function createPreviewTicket(
  actor: SessionUser,
  input: CreateMaintenanceTicketInput
): MaintenanceTicket {
  const store = getPreviewStore();
  const nextSeq = store.tickets.length + 1;
  const ticketCode = generateEntityCode("MNT", nextSeq);
  const nowIso = new Date().toISOString();

  const targetAsset = store.assets.find((a) => a.asset_id === input.asset_id);
  const assignedTech = input.assigned_technician_id
    ? store.users.find((u) => u.user_id === input.assigned_technician_id)
    : undefined;

  const initialStatus = assignedTech ? "Assigned" : "Submitted";

  const newTicket: MaintenanceTicket = {
    ticket_id: `tkt-uuid-${Date.now()}`,
    ticket_code: ticketCode,
    asset_id: input.asset_id,
    asset_code: targetAsset?.asset_code || "AST-UNKNOWN",
    asset_name: targetAsset?.name || "Unknown Asset",
    location_name: targetAsset?.location_name || "Hotel Premises",
    type: input.type,
    priority: input.priority,
    status: initialStatus,
    title: input.title,
    issue_description: input.issue_description,
    reported_by_user_id: actor.user_id,
    reported_by_name: actor.full_name,
    reported_by_email: actor.email,
    assigned_technician_id: assignedTech?.user_id,
    assigned_technician_name: assignedTech?.full_name,
    downtime_minutes: 0,
    cost_idr: 0,
    created_at: nowIso,
    updated_at: nowIso,
  };

  store.tickets.unshift(newTicket);
  return newTicket;
}

export function updatePreviewTicketStatus(
  actor: SessionUser,
  input: UpdateMaintenanceStatusInput
): MaintenanceTicket {
  const store = getPreviewStore();
  const ticket = store.tickets.find((t) => t.ticket_id === input.ticket_id);
  if (!ticket) {
    throw new Error(`Ticket ${input.ticket_id} not found.`);
  }

  const nowIso = new Date().toISOString();
  ticket.status = input.new_status;
  ticket.updated_at = nowIso;
  return ticket;
}

export function createPreviewUser(
  _actor: SessionUser,
  input: CreateUserInput
): User {
  const store = getPreviewStore();
  const nowIso = new Date().toISOString();
  const newUser: User = {
    user_id: `usr-${Date.now()}`,
    email: input.email.toLowerCase(),
    full_name: input.full_name,
    role: input.role,
    department: input.department,
    phone_whatsapp: input.phone_whatsapp || "",
    status: input.status,
    created_at: nowIso,
    updated_at: nowIso,
  };
  store.users.unshift(newUser);
  return newUser;
}

export function updatePreviewUser(
  _actor: SessionUser,
  input: UpdateUserInput
): User {
  const store = getPreviewStore();
  const user = store.users.find((u) => u.user_id === input.user_id);
  if (!user) {
    throw new Error(`User ${input.user_id} not found.`);
  }
  user.role = input.role;
  user.status = input.status;
  if (input.department) {
    user.department = input.department;
  }
  user.updated_at = new Date().toISOString();
  return user;
}

export function createPreviewLocation(
  _actor: SessionUser,
  input: CreateLocationInput
): HotelLocation {
  const store = getPreviewStore();
  const newLoc: HotelLocation = {
    location_id: `loc-${Date.now()}`,
    location_code: input.location_code,
    name: input.name,
    building_wing: input.building_wing,
    floor: input.floor,
    area_type: input.area_type,
    pic_department: input.pic_department,
    is_active: input.is_active,
    created_at: new Date().toISOString(),
  };
  store.locations.unshift(newLoc);
  return newLoc;
}

export function updatePreviewLocation(
  _actor: SessionUser,
  input: UpdateLocationInput
): HotelLocation {
  const store = getPreviewStore();
  const loc = store.locations.find((l) => l.location_id === input.location_id);
  if (!loc) {
    throw new Error(`Location ${input.location_id} not found.`);
  }
  loc.location_code = input.location_code;
  loc.name = input.name;
  loc.building_wing = input.building_wing;
  loc.floor = input.floor;
  loc.area_type = input.area_type;
  loc.pic_department = input.pic_department;
  loc.is_active = input.is_active;
  return loc;
}

export function deletePreviewLocation(locationId: string): { deletedId: string } {
  const store = getPreviewStore();
  store.locations = store.locations.filter((l) => l.location_id !== locationId);
  return { deletedId: locationId };
}

