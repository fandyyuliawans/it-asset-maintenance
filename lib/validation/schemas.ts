import { z } from "zod";

export const userRoleSchema = z.enum([
  "Admin",
  "IT Manager",
  "Technician",
  "Requestor",
]);

export const assetCategorySchema = z.enum([
  "Network & Wi-Fi",
  "POS & Front Office",
  "Server & Storage",
  "Guest Room Tech",
  "CCTV & Security",
  "Workstation & Laptop",
  "Printer & Peripheral",
  "AV & Banquet",
]);

export const assetStatusSchema = z.enum([
  "Operational",
  "Under Maintenance",
  "Degraded",
  "Spare / In Stock",
  "Retired",
]);

export const assetConditionSchema = z.enum([
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Critical",
]);

export const maintenancePrioritySchema = z.enum([
  "Critical",
  "High",
  "Medium",
  "Low",
]);

export const maintenanceStatusSchema = z.enum([
  "Submitted",
  "Assigned",
  "In Progress",
  "Waiting Parts",
  "Resolved",
  "Closed",
  "Cancelled",
]);

export const maintenanceTypeSchema = z.enum([
  "Corrective / Breakdown",
  "Preventive",
  "Inspection",
  "Installation / Upgrade",
]);

/**
 * Schema for creating a new Hotel IT Asset
 */
export const createAssetSchema = z.object({
  name: z
    .string()
    .min(3, "Asset name must be at least 3 characters")
    .max(120, "Asset name cannot exceed 120 characters"),
  category: assetCategorySchema,
  brand: z.string().min(1, "Brand is required").max(60),
  model: z.string().min(1, "Model is required").max(80),
  serial_number: z
    .string()
    .min(2, "Serial number is required")
    .max(80)
    .transform((v) => v.trim().toUpperCase()),
  location_id: z.string().min(1, "Location is required"),
  assigned_department: z.string().min(2, "Department is required").max(80),
  status: assetStatusSchema.default("Operational"),
  condition: assetConditionSchema.default("Good"),
  purchase_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Purchase date must be YYYY-MM-DD"),
  warranty_expiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Warranty expiry must be YYYY-MM-DD"),
  vendor_name: z.string().min(2, "Vendor name is required").max(100),
  purchase_cost_idr: z.coerce
    .number()
    .min(0, "Purchase cost must be non-negative"),
  specs_summary: z.string().min(3, "Specs summary is required").max(500),
  notes: z.string().max(1000).optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;

/**
 * Schema for updating an Asset's status or details
 */
export const updateAssetStatusSchema = z.object({
  asset_id: z.string().min(1, "Asset ID is required"),
  status: assetStatusSchema,
  condition: assetConditionSchema,
  reason: z.string().min(3, "Please provide a brief reason for status change"),
});

export type UpdateAssetStatusInput = z.infer<typeof updateAssetStatusSchema>;

/**
 * Schema for submitting a new Maintenance Ticket
 */
export const createMaintenanceTicketSchema = z.object({
  asset_id: z.string().min(1, "Target asset is required"),
  type: maintenanceTypeSchema,
  priority: maintenancePrioritySchema,
  title: z
    .string()
    .min(5, "Issue title must be at least 5 characters")
    .max(140),
  issue_description: z
    .string()
    .min(10, "Please describe the symptoms or error in detail (min 10 chars)")
    .max(2000),
  assigned_technician_id: z.string().optional(),
  photo_base64: z.string().optional(),
  photo_name: z.string().optional(),
  photo_mime: z.string().optional(),
});

export type CreateMaintenanceTicketInput = z.infer<
  typeof createMaintenanceTicketSchema
>;

/**
 * Schema for transitioning a Maintenance Ticket status & logging work
 */
export const updateMaintenanceStatusSchema = z.object({
  ticket_id: z.string().min(1, "Ticket ID is required"),
  new_status: maintenanceStatusSchema,
  assigned_technician_id: z.string().optional(),
  action_taken: z
    .string()
    .min(4, "Action taken / progress note is required")
    .max(1000),
  parts_replaced: z.string().max(300).optional(),
  time_spent_minutes: z.coerce.number().min(0).max(2880).default(15),
  downtime_minutes: z.coerce.number().min(0).max(43200).optional(),
  cost_idr: z.coerce.number().min(0).optional(),
  root_cause: z.string().max(500).optional(),
  resolution_summary: z.string().max(1000).optional(),
  photo_base64: z.string().optional(),
  photo_name: z.string().optional(),
  photo_mime: z.string().optional(),
});

export type UpdateMaintenanceStatusInput = z.infer<
  typeof updateMaintenanceStatusSchema
>;

/**
 * Schema for creating a new User in the Users tab
 */
export const userStatusSchema = z.enum(["Active", "Inactive", "Suspended"]);

export const createUserSchema = z.object({
  email: z
    .string()
    .email("Valid email address is required")
    .transform((v) => v.trim().toLowerCase()),
  full_name: z.string().min(2, "Full name is required").max(100),
  role: userRoleSchema,
  department: z.string().min(2, "Department is required").max(80),
  phone_whatsapp: z.string().max(40).optional(),
  status: userStatusSchema.default("Active"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Schema for updating an existing User's role, department, or status
 */
export const updateUserSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  role: userRoleSchema,
  department: z.string().min(2).max(80).optional(),
  status: userStatusSchema,
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Schemas for Hotel Locations Directory (CRUD)
 */
export const locationAreaTypeSchema = z.enum([
  "Front Office & Lobby",
  "Guest Floor",
  "Back Office",
  "F&B Outlet / Kitchen",
  "Server / MDF / IDF Room",
  "Banquet & Meeting Room",
  "Engineering & Basement",
  "Outdoor / Security Post",
]);

export const createLocationSchema = z.object({
  location_code: z
    .string()
    .min(2, "Location code is required (e.g. LOC-FO-01)")
    .max(32)
    .transform((v) => v.trim().toUpperCase()),
  name: z
    .string()
    .min(2, "Location name is required")
    .max(120)
    .transform((v) => v.trim()),
  building_wing: z
    .string()
    .min(1, "Building / Wing is required")
    .max(80)
    .transform((v) => v.trim()),
  floor: z
    .string()
    .min(1, "Floor is required")
    .max(30)
    .transform((v) => v.trim()),
  area_type: locationAreaTypeSchema,
  pic_department: z
    .string()
    .min(2, "PIC Department is required")
    .max(80)
    .transform((v) => v.trim()),
  is_active: z.boolean().default(true),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = createLocationSchema.extend({
  location_id: z.string().min(1, "Location ID is required"),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const deleteLocationSchema = z.object({
  location_id: z.string().min(1, "Location ID is required"),
});

export type DeleteLocationInput = z.infer<typeof deleteLocationSchema>;

/**
 * Schema for role switching (Preview Mode), Email Sign-In, or Google ID Token sign-in
 */
export const authSessionRequestSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("google_sso"),
    idToken: z.string().min(20, "Valid Google ID token is required"),
  }),
  z.object({
    intent: z.literal("email_login"),
    email: z
      .string()
      .email("Valid email is required")
      .transform((v) => v.trim().toLowerCase()),
  }),
  z.object({
    intent: z.literal("preview_switch_role"),
    role: userRoleSchema,
  }),
]);
