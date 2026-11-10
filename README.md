# IT Asset Management & Maintenance System
## Product Requirements Document (PRD) + Antigravity Build Instructions

**Project:** IT Asset Management & Maintenance System  
**Version:** 1.0  
**Status:** Initial product specification  
**Target users:** Hotel IT team, department users, technicians, IT Manager, system administrator  
**Primary language:** English UI with Indonesian-ready labels/content  
**Timezone:** Asia/Jakarta (WIB)

---

## 1. Product Overview

Build a responsive web application to register, identify, monitor, and maintain IT assets. Every physical asset has a unique asset code and QR code label attached to the device. Users can scan the QR code using a phone camera to open the asset profile, view its information, and submit a maintenance request.

The system must provide:
- Centralized IT asset records.
- Asset photos, location, ownership/custodian, condition, and lifecycle details.
- QR code generation and printable labels.
- Maintenance request submission and technician work logs.
- Complete maintenance history per asset.
- User activity/audit logs.
- Google Single Sign-On (SSO).
- Role-based access control.
- Dashboard, search, filters, and reports.

This is an internal business application. Do not expose asset data or maintenance records publicly.

## 2. Goals and Success Criteria

### Goals
1. Replace scattered/manual IT asset records with one searchable register.
2. Make each asset identifiable by scanning its QR code.
3. Standardize maintenance reporting and follow-up.
4. Preserve a traceable history of asset changes and repairs.
5. Give IT management visibility into asset condition and maintenance workload.

### Success criteria
- An authorized user can sign in using Google SSO.
- Admin can create, update, view, archive, and search assets.
- Each active asset has a unique QR code that resolves to its asset detail page.
- A user can submit a maintenance request against an asset.
- A technician can update status, record work performed, and attach completion photos.
- Asset detail displays its maintenance history.
- Important create/update/status-change actions are written to an audit log.
- Dashboard totals are calculated from the underlying records, not hard-coded sample values.

## 3. Technology and Architecture

### Required stack
| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| UI components | shadcn/ui (or accessible equivalent) |
| Icons | Lucide |
| Charts | Recharts |
| Forms and validation | React Hook Form + Zod |
| Data fetching | Typed service layer; TanStack Query optional |
| Authentication | Google Identity Services / Google OAuth |
| Backend | Google Apps Script Web App |
| Database | Google Sheets |
| File storage | Google Drive |
| QR code | `qrcode` or equivalent QR library |
| Hosting | Vercel or Netlify for Next.js |
| Development | VS Code + Google Antigravity |

### High-level architecture

```text
Browser / Mobile
      |
      v
Next.js Frontend
      |
      +---- Google SSO sign-in
      |
      v
Next.js server-side API routes (recommended BFF)
      |
      v
Google Apps Script Web App
      |
      +---- Google Sheets (records)
      |
      +---- Google Drive (asset and maintenance photos)
```

### Important implementation guidance
- Prefer Next.js Route Handlers as a server-side proxy/BFF between the browser and Apps Script. Do not expose private integration secrets in browser JavaScript.
- Do not assume a browser can freely call an Apps Script URL: cross-origin restrictions and deployment access settings may apply.
- Deploy the Apps Script web app with the narrowest practical access. Use a controlled integration credential or another verifiable server-to-server mechanism. Never put a privileged secret in `NEXT_PUBLIC_*` variables.
- Google SSO must be validated server-side. A successful frontend callback alone is not authorization.
- Validate the Google ID token's signature, issuer, audience/client ID, expiry, verified email, and (if required) Workspace hosted domain. Do not trust an email address sent as plain text.
- For production, use a supported Google token verification library in the Next.js server environment. If token verification is delegated to Apps Script, Apps Script must verify the token with Google's token verification endpoint and validate the expected audience and domain.
- Store secrets in hosting environment variables or Apps Script Properties, never in source control.
- Google Sheets is suitable for a small/medium internal application. If concurrent usage, record volume, or security requirements grow substantially, plan a migration to a proper database.
- Use a stable record ID (UUID), not the row number, as the primary identifier. Sheet rows may move.

## 4. User Roles and Permissions

Implement role-based access control (RBAC). The server must enforce permissions; hiding a button in the UI is not sufficient.

| Capability | Admin | IT Manager | Technician | Requestor |
|---|:---:|:---:|:---:|:---:|
| View dashboard | Yes | Yes | Yes | Limited |
| View asset list/details | Yes | Yes | Yes | Yes |
| Create/edit assets | Yes | Yes | Optional | No |
| Archive assets | Yes | Optional | No | No |
| Generate/print QR labels | Yes | Yes | Optional | No |
| Submit maintenance request | Yes | Yes | Yes | Yes |
| Assign maintenance | Yes | Yes | No | No |
| Update assigned work | Yes | Yes | Yes | No |
| Close/reopen maintenance | Yes | Yes | Optional | No |
| View all maintenance history | Yes | Yes | Yes | Limited |
| Manage users and roles | Yes | No | No | No |
| View audit logs | Yes | Yes | Own actions only | Own actions only |
| Export reports | Yes | Yes | Optional | No |

Role definitions:
- **Admin:** Full configuration, user/role management, asset and maintenance administration.
- **IT Manager:** Oversees assets, assigns work, reviews maintenance, and reports.
- **Technician:** Handles assigned work orders and records diagnosis, actions, parts, and completion.
- **Requestor:** Views permitted asset information and submits/monitors own requests.

New users should not automatically receive Admin privileges. Use an allowlist or Admin-managed user registration.

## 5. Functional Requirements

### 5.1 Google SSO and User Profile
- Provide a clear "Sign in with Google" button.
- Restrict sign-in to the configured company/Workspace domain or approved email allowlist.
- On first successful sign-in, create or match a user record.
- Role assignment is controlled by Admin, not by user-submitted profile data.
- Store the user's Google subject identifier where available, email, display name, role, status, and timestamps.
- Support disabled users; disabled users must not access protected routes or APIs.
- Provide logout and session expiration.
- Use secure, HTTP-only, Secure, SameSite cookies for the application session where supported.
- Do not store long-lived Google access tokens in localStorage.

### 5.2 Asset Management (CRUD)
Provide searchable, filterable asset records.

**Suggested asset fields**
| Field | Required | Description |
|---|---|---|
| assetId | Yes | UUID, immutable internal ID |
| assetCode | Yes | Human-readable unique code, e.g. IT-2026-0001 |
| assetName | Yes | Name of device |
| category | Yes | Laptop, Desktop, Printer, Network, CCTV, Server, PABX, UPS, Other |
| brand | No | Manufacturer |
| model | No | Model |
| serialNumber | No | Manufacturer serial number |
| specification | No | CPU, RAM, storage, ports, etc. |
| purchaseDate | No | Purchase date |
| purchaseCost | No | Purchase price |
| warrantyEndDate | No | Warranty expiry |
| location | Yes | Building/area/room |
| department | No | Department or cost center |
| custodianName | No | Person/team responsible |
| condition | Yes | Excellent, Good, Fair, Damaged, Under Repair, Retired |
| status | Yes | Active, Inactive, Under Maintenance, Disposed |
| assetPhotoUrl | No | Main photo in Drive |
| notes | No | Additional information |
| createdAt / createdBy | Yes | Creation audit fields |
| updatedAt / updatedBy | Yes | Update audit fields |

Requirements:
- Create, view, edit, and archive assets.
- Do not permanently delete assets that have maintenance history. Use archive/retired status.
- Validate unique assetCode. Serial number may be optional and should not be assumed globally unique unless configured.
- Support search by asset code, name, serial number, category, location, and custodian.
- Filters: category, condition, status, location, department.
- Asset detail page shows profile, photo, QR code, current status, and maintenance history.
- Allow multiple photos if practical; define one primary photo.
- Display dates in Asia/Jakarta timezone.

### 5.3 QR Code / Barcode
Use QR codes as the default because a phone camera can scan them without a dedicated barcode scanner.

Requirements:
- Generate a unique QR code for each asset.
- QR payload should contain an application URL such as `/assets/{assetCode}` or an opaque asset ID. Do not encode confidential asset information in the QR itself.
- QR code must resolve to the asset detail page after login/authorization.
- Provide printable label layouts: small sticker and A4 sheet.
- Label should include hotel/company name, asset code, short asset name, and QR code.
- Allow reprint without generating a new asset identity.
- If an asset is archived, show a clear archived message rather than silently redirecting.
- Do not use a predictable public endpoint that reveals private asset records.

### 5.4 Maintenance Request Form
A maintenance request can be created from the asset detail page or from a general "New Request" page.

**Request fields**
| Field | Required | Description |
|---|---|---|
| maintenanceId | Yes | UUID |
| ticketNumber | Yes | Human-readable ticket, e.g. MNT-2026-0001 |
| assetId | Yes | Related asset |
| reportedBy | Yes | Authenticated user |
| reportedAt | Yes | Server timestamp |
| issueCategory | Yes | Hardware, Software, Network, Power, Preventive, Other |
| priority | Yes | Low, Normal, High, Critical |
| problemDescription | Yes | Symptoms and details |
| photoBeforeUrls | No | One or more evidence photos |
| locationAtReport | Yes | Location where issue occurs |
| status | Yes | New, Assigned, In Progress, Waiting, Resolved, Closed, Cancelled |
| assignedTo | No | Technician user ID |
| targetDate | No | Expected completion date |

Requirements:
- Automatically populate reporter identity from the authenticated session.
- Automatically associate the request with the selected asset.
- Allow photo upload from camera or gallery on mobile.
- Validate file type and size; allow JPG, PNG, and WebP. Set a configurable maximum (initial suggestion: 5 MB per image).
- Show submission confirmation and ticket number.
- Prevent accidental duplicate submissions (disable submit while saving and use an idempotency key where practical).

### 5.5 Maintenance Workflow
Suggested workflow:

```text
New
  |
  v
Assigned
  |
  v
In Progress <----> Waiting
  |
  v
Resolved
  |
  v
Closed
```

Cancelled may be used by authorized roles with a required reason.

Technician work log fields:
- workLogId
- maintenanceId
- technicianId
- workDate
- diagnosis
- actionTaken
- partsUsed
- laborMinutes
- result / resolution
- photoAfterUrls
- createdAt

Requirements:
- IT Manager/Admin can assign or reassign a technician.
- Technician can update only permitted work orders (assigned work, unless Admin/Manager).
- Every status change records previous status, new status, actor, timestamp, and note.
- Resolved requests require a resolution summary.
- Closing a request may require Manager/Admin permission.
- Requestor can view request status and permitted comments.
- Reopening a closed request requires a reason and is audited.
- Update the related asset condition/status when appropriate, but do not overwrite asset condition automatically without an explicit workflow rule.

### 5.6 Maintenance History
On each asset detail page, show a chronological timeline:
- Ticket number and issue.
- Reported date and reporter.
- Priority and current status.
- Assigned technician.
- Diagnosis and action taken.
- Parts used and labor duration.
- Before/after photos.
- Resolution and closed date.

Provide filters by date, status, category, technician, and priority.

### 5.7 User Activity / Audit Log
Capture important events:
- Login success/failure (avoid storing credentials or tokens).
- Logout.
- Asset created, updated, archived, and status changed.
- QR code generated/reprinted.
- Maintenance created, assigned, updated, resolved, closed, reopened, cancelled.
- User role/status changes.
- Report exports.

Suggested audit fields:
`logId, timestamp, userId, userEmail, action, entityType, entityId, summary, beforeJson, afterJson, ipAddressIfAvailable, userAgentIfAvailable`

Do not store passwords, OAuth tokens, session cookies, or unnecessary sensitive data in logs. Audit logs should be append-only from the application perspective and visible only to authorized roles.

### 5.8 Dashboard
Create a clean, modern dashboard with:
- Total registered assets.
- Active assets.
- Assets under maintenance.
- Damaged assets.
- Open maintenance tickets.
- Critical/high-priority tickets.
- Overdue tickets.
- Recently reported maintenance.
- Recent asset activity.
- Asset condition distribution chart.
- Maintenance tickets by status chart.
- Maintenance trend by month.
- Category/location breakdown.

Dashboard cards and charts must be driven by real API data. Include loading, empty, and error states. Do not fabricate production metrics.

### 5.9 Reports and Export
Reports:
- Asset register.
- Assets by category/location/condition/status.
- Warranty expiry.
- Maintenance history by date range.
- Open and overdue maintenance.
- Maintenance by technician.
- Maintenance cost and parts usage (if cost tracking is enabled).

Export CSV/XLSX/PDF where practical. Exports must respect role permissions and active filters. Record export events in the audit log.

## 6. Suggested Google Sheets Database

Create one spreadsheet with the following tabs. The first row of each tab contains exact column headers.

### `Assets`
`assetId, assetCode, assetName, category, brand, model, serialNumber, specification, purchaseDate, purchaseCost, warrantyEndDate, location, department, custodianName, condition, status, assetPhotoUrl, notes, createdAt, createdBy, updatedAt, updatedBy, archivedAt`

### `Users`
`userId, googleSub, email, displayName, role, isActive, createdAt, updatedAt, lastLoginAt`

### `Maintenance`
`maintenanceId, ticketNumber, assetId, reportedBy, reportedAt, issueCategory, priority, problemDescription, locationAtReport, status, assignedTo, targetDate, resolvedAt, closedAt, resolutionSummary, updatedAt, updatedBy`

### `WorkLogs`
`workLogId, maintenanceId, technicianId, workDate, diagnosis, actionTaken, partsUsed, laborMinutes, result, photoAfterUrls, createdAt`

### `MaintenancePhotos`
`photoId, maintenanceId, photoType, driveFileId, driveUrl, fileName, mimeType, uploadedBy, uploadedAt`

### `StatusHistory`
`historyId, entityType, entityId, oldStatus, newStatus, note, changedBy, changedAt`

### `ActivityLogs`
`logId, timestamp, userId, userEmail, action, entityType, entityId, summary, beforeJson, afterJson, userAgent`

### `Locations`
`locationId, locationName, parentLocationId, description, isActive`

### `Settings`
`settingKey, settingValue, description, updatedAt, updatedBy`

Database rules:
- Use UUIDs for primary IDs.
- Store timestamps as ISO 8601 strings in UTC or a consistently documented format; display in Asia/Jakarta.
- Store Drive file IDs and URLs, not base64 image data, in Sheets.
- Do not use sheet row numbers as IDs.
- Use `LockService` in Apps Script for write operations that may collide.
- Use batch reads/writes (`getValues` / `setValues`) rather than repeated cell-by-cell calls.
- Validate and normalize data in Apps Script as well as in the frontend.
- Add pagination or bounded queries for larger sheets.
- Avoid storing formulas or user-editable data in columns used as security controls.

## 7. Google Drive File Storage

Create a restricted Drive folder structure, for example:

```text
IT_ASSET_MAINTENANCE/
  asset-photos/
  maintenance-before/
  maintenance-after/
  exports/
```

Requirements:
- Keep folders private to authorized service/admin accounts and users who need access.
- Upload files through a controlled backend process.
- Validate MIME type, extension, and file size; do not trust the filename or browser MIME type alone.
- Generate safe filenames using IDs and timestamps.
- Store `driveFileId`, filename, MIME type, uploader, and timestamp in the relevant sheet.
- Avoid making all photos publicly accessible via "Anyone with the link".
- Use authenticated image delivery or appropriately restricted sharing. If using Drive thumbnail URLs, test access from a signed-in user who is not the file owner.
- Define retention and deletion policy for photos and exports.

## 8. API Design

Expose typed Next.js API routes to the frontend. The Next.js server communicates with Apps Script. Suggested routes:

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/me` | Current authenticated user |
| POST | `/api/auth/google` | Validate Google credential and create app session |
| POST | `/api/auth/logout` | End app session |
| GET | `/api/assets` | List/search/filter assets |
| POST | `/api/assets` | Create asset |
| GET | `/api/assets/[assetId]` | Asset detail |
| PATCH | `/api/assets/[assetId]` | Update asset |
| POST | `/api/assets/[assetId]/archive` | Archive asset |
| GET | `/api/assets/[assetId]/maintenance` | Asset maintenance history |
| POST | `/api/maintenance` | Create maintenance request |
| GET | `/api/maintenance` | List/filter tickets |
| GET | `/api/maintenance/[maintenanceId]` | Ticket detail |
| PATCH | `/api/maintenance/[maintenanceId]` | Update permitted ticket fields |
| POST | `/api/maintenance/[maintenanceId]/assign` | Assign technician |
| POST | `/api/maintenance/[maintenanceId]/worklogs` | Add technician work log |
| POST | `/api/maintenance/[maintenanceId]/status` | Change status |
| POST | `/api/uploads` | Upload photo through controlled server flow |
| GET | `/api/dashboard` | Dashboard metrics |
| GET | `/api/reports/assets` | Asset report |
| GET | `/api/reports/maintenance` | Maintenance report |
| GET | `/api/admin/users` | List users (Admin) |
| PATCH | `/api/admin/users/[userId]` | Update role/active status (Admin) |

Apps Script may use a single `doGet(e)` / `doPost(e)` dispatcher with an `action` field, or separate action handlers internally. Keep the public contract documented and versioned.

Example request envelope:

```json
{
  "version": "1",
  "action": "assets.list",
  "requestId": "uuid",
  "payload": {
    "search": "printer",
    "page": 1,
    "pageSize": 20
  }
}
```

Example response envelope:

```json
{
  "success": true,
  "requestId": "uuid",
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 0
  },
  "error": null
}
```

For errors, return a stable error code and safe message. Do not return stack traces, secrets, raw tokens, or spreadsheet contents beyond the caller's permission.

## 9. UI / UX Requirements

Design direction:
- Modern enterprise SaaS dashboard.
- Clean, premium, professional appearance suitable for hotel IT operations.
- Responsive desktop, tablet, and mobile layouts.
- Sidebar navigation on desktop; compact navigation on mobile.
- Use clear typography, consistent spacing, restrained colors, and accessible contrast.
- Use status badges consistently (New, Assigned, In Progress, Waiting, Resolved, Closed).
- Use confirmation dialogs for destructive or irreversible actions.
- Provide skeleton/loading states, empty states, validation messages, and retry states.
- Use toast notifications for successful or failed operations.
- Avoid excessive animation; use subtle transitions and respect reduced-motion preferences.
- Ensure all forms are keyboard accessible and have labels.

Suggested navigation:
1. Dashboard
2. Assets
3. Scan QR
4. Maintenance
5. Reports
6. Activity Logs
7. User Management (Admin only)
8. Settings (Admin only)

Required pages:
- `/login`
- `/dashboard`
- `/assets`
- `/assets/new`
- `/assets/[assetCode]`
- `/assets/[assetCode]/edit`
- `/scan`
- `/maintenance`
- `/maintenance/new`
- `/maintenance/[ticketNumber]`
- `/reports`
- `/activity-logs`
- `/admin/users`
- `/settings`

## 10. Non-Functional Requirements and Security

- Enforce authentication and authorization on every protected server endpoint.
- Verify Google ID tokens server-side and validate the expected OAuth client ID.
- Use an email/domain allowlist where appropriate.
- Use secure session cookies; implement expiry and logout.
- Protect against CSRF for cookie-authenticated state-changing requests.
- Validate all input with Zod or equivalent on the server.
- Escape/sanitize user-provided text when rendered.
- Restrict upload MIME types and sizes; consider malware scanning for production.
- Do not expose Apps Script deployment secrets, Google service credentials, or private Drive links in frontend bundles.
- Use HTTPS in production.
- Apply rate limiting to login, upload, and write endpoints where feasible.
- Add request IDs and structured error logging.
- Back up the spreadsheet and Drive data on a defined schedule.
- Document recovery procedures and Admin ownership.
- Handle Apps Script quotas and execution time limits; batch operations and avoid long-running requests.
- Do not promise high concurrency or transactional guarantees from Google Sheets. Use locks for critical writes and consider a database if concurrency becomes material.

## 11. Environment Variables

Example `.env.local` (placeholder values only):

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID="YOUR_GOOGLE_OAUTH_CLIENT_ID"
GOOGLE_OAUTH_CLIENT_SECRET="SERVER_SIDE_ONLY_IF_REQUIRED"
GAS_WEB_APP_URL="YOUR_APPS_SCRIPT_WEB_APP_URL"
GAS_SHARED_SECRET="SERVER_SIDE_SECRET_NOT_FOR_BROWSER"
APP_BASE_URL="http://localhost:3000"
ALLOWED_EMAIL_DOMAIN="your-company-domain.com"
```

Notes:
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is public by design; it is the OAuth client ID, not a secret.
- All other secrets must remain server-side.
- Never commit `.env.local`.
- Add `.env.example` with placeholders only.
- The shared-secret approach is only a baseline integration pattern; design and test the exact server-to-Apps-Script authentication method before production. Rotate credentials if exposed.

## 12. Suggested Project Structure

```text
it-asset-maintenance/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (app)/
│   │   ├── dashboard/page.tsx
│   │   ├── assets/
│   │   ├── maintenance/
│   │   ├── reports/page.tsx
│   │   ├── activity-logs/page.tsx
│   │   ├── admin/users/page.tsx
│   │   └── layout.tsx
│   └── api/
│       ├── auth/
│       ├── assets/
│       ├── maintenance/
│       ├── uploads/route.ts
│       └── dashboard/route.ts
├── components/
│   ├── layout/
│   ├── dashboard/
│   ├── assets/
│   ├── maintenance/
│   ├── forms/
│   └── ui/
├── lib/
│   ├── auth/
│   ├── api/
│   ├── validation/
│   ├── permissions/
│   ├── utils/
│   └── config/
├── types/
├── hooks/
├── apps-script/
│   ├── Code.gs
│   ├── Auth.gs
│   ├── Assets.gs
│   ├── Maintenance.gs
│   ├── Uploads.gs
│   ├── Dashboard.gs
│   ├── Audit.gs
│   └── README.md
├── public/
├── .env.example
├── README.md
└── package.json
```

The Apps Script folder is source code for a separately deployed Apps Script project. It is not automatically deployed by Next.js.

## 13. Implementation Phases

### Phase 1 — Foundation
- Initialize Next.js, TypeScript, Tailwind, and UI components.
- Create spreadsheet tabs and headers.
- Create Apps Script project and health-check endpoint.
- Configure Google OAuth client and allowed domain.
- Implement server-side authentication/session and role middleware.
- Build responsive application shell.

### Phase 2 — Asset Register
- Implement asset CRUD and validation.
- Implement search, filters, pagination.
- Implement photo upload to Drive.
- Implement asset detail page.
- Generate and print QR labels.

### Phase 3 — Maintenance Workflow
- Implement maintenance request form.
- Implement assignment and technician work logs.
- Implement status history and before/after photos.
- Implement asset maintenance timeline.

### Phase 4 — Dashboard and Reports
- Implement dashboard aggregates and charts.
- Implement asset and maintenance reports.
- Implement CSV export; add XLSX/PDF if required.
- Implement activity log viewer.

### Phase 5 — Hardening and Deployment
- Test role permissions and unauthorized access.
- Test mobile QR scanning and camera permissions.
- Test upload restrictions and Drive permissions.
- Test concurrent writes, Apps Script quotas, and error handling.
- Configure production environment variables and HTTPS.
- Document backup, restore, and administrator procedures.

## 14. Acceptance Test Checklist

### Authentication
- [ ] User can sign in with an approved Google account.
- [ ] Unapproved domain/email is rejected.
- [ ] Disabled user cannot access protected pages or APIs.
- [ ] User role is loaded from trusted server-side data.
- [ ] Logout ends the application session.

### Assets and QR
- [ ] Admin can create an asset with required fields.
- [ ] Duplicate asset code is rejected.
- [ ] Asset can be edited and archived.
- [ ] Asset photo is stored in Drive and its reference saved in Sheets.
- [ ] QR code opens the correct protected asset detail page.
- [ ] QR label is printable and readable from a phone.
- [ ] Archived asset does not appear as active.

### Maintenance
- [ ] User can submit a request for a valid asset.
- [ ] Ticket number is unique.
- [ ] Required fields and photo constraints are validated.
- [ ] Manager/Admin can assign a technician.
- [ ] Technician can add diagnosis, action, parts, and completion photo.
- [ ] Invalid status transitions are rejected.
- [ ] Status history and audit log are recorded.
- [ ] Asset detail displays the correct maintenance history.

### Dashboard and audit
- [ ] Dashboard counts match source records.
- [ ] Filters work correctly.
- [ ] User activity is recorded for important actions.
- [ ] Unauthorized roles cannot access Admin functions or restricted logs.
- [ ] Reports respect the selected filters and user permissions.

### Reliability and security
- [ ] Apps Script errors are handled gracefully.
- [ ] Concurrent writes do not create duplicate IDs/ticket numbers.
- [ ] Secrets are not present in browser bundles or Git.
- [ ] Private Drive files are not publicly exposed.
- [ ] Production app uses HTTPS.
- [ ] Backup and restore process is documented and tested.

## 15. Instructions for Google Antigravity

Use this document as the source of truth. Build the project in small, testable phases. Do not attempt to generate the entire application in one step.

### First prompt
> Read the complete README.md / PRD. Act as a senior full-stack engineer. Before coding, inspect the current repository and summarize the architecture, implementation phases, assumptions, risks, and files you plan to create. Use Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Google Apps Script, Google Sheets, Google Drive, and Google SSO as specified. Do not invent real credentials, spreadsheet IDs, deployment URLs, or company domains. Ask only for configuration values that are essential to the next implementation step.

### Subsequent prompts
1. **Foundation:** Implement the Next.js app shell, design system, route structure, typed models, validation schemas, and `.env.example`. Use mock data only for UI development and label it clearly.
2. **Apps Script:** Build the Apps Script backend modules, spreadsheet initialization function, headers, UUID helpers, response envelope, validation, locking, and health check. Include deployment instructions.
3. **Authentication:** Implement Google SSO with server-side token verification, secure sessions, domain allowlist, and server-enforced RBAC. Do not use a client-side-only role check.
4. **Assets:** Implement asset CRUD, filters, pagination, Drive photo upload, detail page, QR generation, and printable labels.
5. **Maintenance:** Implement request creation, assignment, work logs, status transitions, before/after photos, and history timeline.
6. **Dashboard and reports:** Implement real aggregates, charts, audit log viewer, and exports.
7. **Testing:** Add unit/integration tests for validation, permissions, ticket workflow, and API error handling. Run typecheck, lint, and build; fix all errors.

### Antigravity coding rules
- Work phase by phase and keep the app runnable after each phase.
- Explain any architecture change before implementing it.
- Never hard-code credentials, tokens, spreadsheet IDs, Drive IDs, or production URLs.
- Never trust user IDs, email addresses, or roles supplied by the browser.
- Never bypass server-side authorization.
- Use TypeScript types for API requests and responses.
- Use Zod validation on server inputs.
- Include loading, empty, success, and error states.
- Do not leave important buttons as decorative placeholders.
- Do not mark a feature complete until it has been tested.
- Keep `README.md` updated with setup, deployment, and troubleshooting steps.
- If a required external configuration is missing, create a clearly named placeholder and explain how to obtain it; do not fabricate a working value.

## 16. Open Configuration Items

Before production deployment, the project owner must supply or confirm:
- Google Workspace domain or approved email allowlist.
- Google OAuth Client ID and authorized origins/redirect URIs.
- Google Spreadsheet ID and ownership.
- Apps Script deployment URL and deployment access strategy.
- Google Drive parent folder ID and file access policy.
- Production frontend domain.
- Final role assignments and initial Admin email(s).
- Asset code format (suggestion: `IT-YYYY-0001`).
- Ticket number format (suggestion: `MNT-YYYY-0001`).
- Maximum photo size and retention policy.
- Whether maintenance cost and spare-parts inventory are in scope.

---

## 17. Important Scope Decisions

1. **QR rather than traditional 1D barcode:** QR is recommended for camera-based scanning and can hold a secure application route. If a dedicated barcode scanner is required, Code 128 can be added as a second label format.
2. **Archive rather than hard delete:** Preserve asset and maintenance history for audit purposes.
3. **SSO plus application roles:** Google confirms identity; the application controls permissions.
4. **Sheets as initial database:** Suitable for an initial internal system, with known limits around concurrency, scale, and transactional consistency.
5. **Photos in Drive, metadata in Sheets:** Avoid placing large image/base64 data in spreadsheet cells.
6. **Server-side API proxy:** Keeps integration credentials away from the browser and gives the application one place to enforce authorization.

**End of PRD.**
#   i t - a s s e t - m a i n t e n a n c e  
 