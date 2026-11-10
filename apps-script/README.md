# Google Sheets & Google Apps Script Setup Guide

This folder contains the serverless Google Apps Script backend (`Code.gs`, `Auth.gs`, `Audit.gs`) that manages the 9 normalized Google Sheets tabs and Google Drive photo storage for the **Hotel IT Asset Management & Maintenance System**.

---

## 1. Create the Google Spreadsheet
1. Create a new Google Sheet in your Hotel IT Google Workspace Drive (e.g., `Hotel IT Asset & Maintenance Database`).
2. Copy the **Spreadsheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
3. Set the Spreadsheet Timezone (`File -> Settings -> Time zone`) to **(GMT+07:00) Jakarta**.

---

## 2. Create the Apps Script Project
1. Inside the Google Sheet, click **Extensions -> Apps Script**.
2. Create three script files matching this folder:
   - `Code.gs` — Paste the contents of [`apps-script/Code.gs`](./Code.gs)
   - `Auth.gs` — Paste the contents of [`apps-script/Auth.gs`](./Auth.gs)
   - `Audit.gs` — Paste the contents of [`apps-script/Audit.gs`](./Audit.gs)
3. In **Project Settings (Gear Icon)**:
   - Check **Show "appsscript.json" manifest file in editor** and ensure timeZone is `"Asia/Jakarta"`.
   - Under **Script Properties**, add the following properties:
     - `SPREADSHEET_ID`: Your Google Sheet ID
     - `GAS_SHARED_SECRET`: A 32-byte hex secret generated with `openssl rand -hex 32` (must match `GAS_SHARED_SECRET` in `.env.local`)
     - `DRIVE_ASSET_PHOTOS_FOLDER_ID`: *(Optional)* Restricted Google Drive Folder ID for asset & maintenance photos.

---

## 3. Initialize the 9 Normalized Tabs
1. In the Apps Script editor toolbar, select `initializeSpreadsheetSchema` from the function dropdown and click **Run**.
2. Grant the requested permissions when prompted.
3. Verify that your Google Sheet now has all 9 tabs with frozen bold headers:
   - `Assets`
   - `Users`
   - `Maintenance`
   - `WorkLogs`
   - `MaintenancePhotos`
   - `StatusHistory`
   - `ActivityLogs`
   - `Locations`
   - `Settings`

---

## 4. Deploy as Web App
1. Click **Deploy -> New deployment**.
2. Choose type: **Web app**.
3. Set **Execute as**: `Me (Hotel IT Service Account)`.
4. Set **Who has access**: `Anyone` *(Security is enforced at the application layer via constant-time `GAS_SHARED_SECRET` verification in `Auth.gs`; only the Next.js server knows this secret)*.
5. Copy the generated **Web app URL** (`https://script.google.com/macros/s/.../exec`) and paste it into `.env.local` as `GAS_WEB_APP_URL`.
