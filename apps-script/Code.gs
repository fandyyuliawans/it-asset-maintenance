/**
 * ============================================================================
 * HOTEL IT ASSET MANAGEMENT & MAINTENANCE SYSTEM — GOOGLE APPS SCRIPT BACKEND
 * File: Code.gs (Main Entrypoint, Schema Initializer, LockService & Dispatcher)
 * Timezone: Asia/Jakarta (WIB / UTC+7)
 * ============================================================================
 */

var REQUIRED_TABS = {
  Assets: [
    "asset_id",
    "asset_code",
    "name",
    "category",
    "brand",
    "model",
    "serial_number",
    "location_id",
    "location_name",
    "assigned_department",
    "status",
    "condition",
    "purchase_date",
    "warranty_expiry",
    "vendor_name",
    "purchase_cost_idr",
    "specs_summary",
    "photo_drive_file_id",
    "photo_url",
    "qr_payload_url",
    "notes",
    "created_at",
    "updated_at"
  ],
  Users: [
    "user_id",
    "email",
    "full_name",
    "role",
    "department",
    "phone_whatsapp",
    "status",
    "last_login_at",
    "created_at",
    "updated_at"
  ],
  Maintenance: [
    "ticket_id",
    "ticket_code",
    "asset_id",
    "asset_code",
    "asset_name",
    "location_name",
    "type",
    "priority",
    "status",
    "title",
    "issue_description",
    "reported_by_user_id",
    "reported_by_name",
    "reported_by_email",
    "assigned_technician_id",
    "assigned_technician_name",
    "root_cause",
    "resolution_summary",
    "downtime_minutes",
    "cost_idr",
    "due_at",
    "resolved_at",
    "closed_at",
    "created_at",
    "updated_at"
  ],
  WorkLogs: [
    "worklog_id",
    "ticket_id",
    "technician_user_id",
    "technician_name",
    "action_taken",
    "parts_replaced",
    "time_spent_minutes",
    "created_at"
  ],
  MaintenancePhotos: [
    "photo_id",
    "ticket_id",
    "asset_id",
    "stage",
    "drive_file_id",
    "file_name",
    "mime_type",
    "size_bytes",
    "caption",
    "uploaded_by_email",
    "created_at"
  ],
  StatusHistory: [
    "history_id",
    "entity_type",
    "entity_id",
    "entity_code",
    "previous_status",
    "new_status",
    "changed_by_email",
    "changed_by_role",
    "reason",
    "created_at"
  ],
  ActivityLogs: [
    "log_id",
    "actor_email",
    "actor_name",
    "actor_role",
    "action",
    "entity_type",
    "entity_id",
    "summary",
    "metadata_json",
    "created_at"
  ],
  Locations: [
    "location_id",
    "location_code",
    "name",
    "building_wing",
    "floor",
    "area_type",
    "pic_department",
    "is_active",
    "created_at"
  ],
  Settings: [
    "setting_key",
    "setting_value",
    "description",
    "updated_by_email",
    "updated_at"
  ]
};

/**
 * HTTP GET handler — Health & Schema Verification
 */
function doGet(e) {
  return buildJsonResponse(true, {
    service: "Hotel IT Asset & Maintenance GAS Engine",
    version: "1.0.0",
    timezone: "Asia/Jakarta",
    message: "Use POST with valid shared secret to execute RPC actions."
  });
}

/**
 * HTTP POST handler — Authenticated BFF RPC Dispatcher
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return buildErrorResponse("VALIDATION_ERROR", "Missing JSON request body.");
    }

    var body = JSON.parse(e.postData.contents);
    var authResult = verifySharedSecret(body.secret);
    if (!authResult.valid) {
      return buildErrorResponse("UNAUTHORIZED", authResult.reason);
    }

    var action = body.action;
    var actor = body.actor || {
      email: "system@hotel.local",
      name: "System",
      role: "Admin"
    };
    var payload = body.payload || {};

    // Read-only actions
    if (action === "system.health") {
      return handleSystemHealth();
    }
    if (action === "dashboard.bundle") {
      return handleDashboardBundle();
    }
    if (action === "assets.list") {
      return buildJsonResponse(true, readSheetRowsAsObjects("Assets"));
    }
    if (action === "maintenance.list") {
      return buildJsonResponse(true, readSheetRowsAsObjects("Maintenance"));
    }
    if (action === "worklogs.list") {
      return buildJsonResponse(true, readSheetRowsAsObjects("WorkLogs"));
    }
    if (action === "locations.list") {
      return buildJsonResponse(true, readSheetRowsAsObjects("Locations"));
    }
    if (action === "users.list") {
      return buildJsonResponse(true, readSheetRowsAsObjects("Users"));
    }
    if (action === "logs.list") {
      return buildJsonResponse(true, {
        activityLogs: readSheetRowsAsObjects("ActivityLogs"),
        statusHistory: readSheetRowsAsObjects("StatusHistory")
      });
    }
    if (action === "settings.list") {
      return buildJsonResponse(true, readSheetRowsAsObjects("Settings"));
    }

    // Mutating actions acquire LockService to prevent race conditions on rows
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return buildErrorResponse(
        "LOCK_TIMEOUT",
        "Spreadsheet is busy processing another write operation. Please retry."
      );
    }

    try {
      if (action === "system.initSchema") {
        var initReport = initializeSpreadsheetSchema(actor);
        return buildJsonResponse(true, initReport);
      }
      if (action === "assets.create") {
        var createdAsset = handleCreateAsset(actor, payload);
        return buildJsonResponse(true, createdAsset);
      }
      if (action === "maintenance.create") {
        var createdTicket = handleCreateMaintenance(actor, payload);
        return buildJsonResponse(true, createdTicket);
      }
      if (action === "maintenance.updateStatus") {
        var updated = updateMaintenanceTicketStatus(actor, payload);
        return buildJsonResponse(true, updated);
      }
      if (action === "users.create") {
        var createdUser = handleCreateUser(actor, payload);
        return buildJsonResponse(true, createdUser);
      }
      if (action === "users.update") {
        var updatedUser = handleUpdateUser(actor, payload);
        return buildJsonResponse(true, updatedUser);
      }
      if (action === "users.upsertGoogleLogin") {
        var loggedInUser = handleUpsertGoogleLogin(payload);
        return buildJsonResponse(true, loggedInUser);
      }
      if (action === "locations.create") {
        var createdLoc = handleCreateLocation(actor, payload);
        return buildJsonResponse(true, createdLoc);
      }
      if (action === "locations.update") {
        var updatedLoc = handleUpdateLocation(actor, payload);
        return buildJsonResponse(true, updatedLoc);
      }
      if (action === "locations.delete") {
        var deletedLoc = handleDeleteLocation(actor, payload);
        return buildJsonResponse(true, deletedLoc);
      }
      if (action === "photos.upload") {
        var uploadedPhoto = saveBase64PhotoToDrive(
          actor,
          payload.photo_base64,
          payload.photo_name,
          payload.photo_mime,
          payload.ticket_id,
          payload.ticket_code,
          payload.asset_id,
          payload.stage || "Before"
        );
        return buildJsonResponse(true, uploadedPhoto);
      }

      return buildErrorResponse("VALIDATION_ERROR", "Unsupported action: " + action);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return buildErrorResponse(
      "INTERNAL_ERROR",
      err && err.message ? err.message : String(err)
    );
  }
}

/**
 * Run this function ONCE directly from the Apps Script Editor toolbar ("Run")
 * to create all 9 tabs and freeze their bold header rows.
 */
function initializeSpreadsheetSchema(actor) {
  var ss = getTargetSpreadsheet();
  var createdTabs = [];
  var verifiedTabs = [];

  var tabNames = Object.keys(REQUIRED_TABS);
  for (var i = 0; i < tabNames.length; i++) {
    var tabName = tabNames[i];
    var headers = REQUIRED_TABS[tabName];
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      createdTabs.push(tabName);
    } else {
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      }
      verifiedTabs.push(tabName);
    }
  }

  // Seed default hotel locations if Locations tab is empty
  var locSheet = ss.getSheetByName("Locations");
  if (locSheet && locSheet.getLastRow() <= 1) {
    var nowIso = new Date().toISOString();
    var defaultLocations = [
      {
        location_id: "loc-mdf-001",
        location_code: "LOC-MDF-01",
        name: "Main Server & MDF Room",
        building_wing: "Main Tower",
        floor: "B1",
        area_type: "Server / MDF / IDF Room",
        pic_department: "Information Technology",
        is_active: true,
        created_at: nowIso
      },
      {
        location_id: "loc-fo-002",
        location_code: "LOC-FO-01",
        name: "Main Lobby Reception Desk",
        building_wing: "Main Tower",
        floor: "GF",
        area_type: "Front Office & Lobby",
        pic_department: "Front Office",
        is_active: true,
        created_at: nowIso
      },
      {
        location_id: "loc-fb-003",
        location_code: "LOC-FB-01",
        name: "Nusantara All-Day Dining POS & Kitchen",
        building_wing: "Podium Wing",
        floor: "L1",
        area_type: "F&B Outlet / Kitchen",
        pic_department: "Food & Beverage",
        is_active: true,
        created_at: nowIso
      },
      {
        location_id: "loc-bqt-004",
        location_code: "LOC-BQT-01",
        name: "Garuda Grand Ballroom Control Booth",
        building_wing: "Convention Wing",
        floor: "L2",
        area_type: "Banquet & Meeting Room",
        pic_department: "Banquet & Events",
        is_active: true,
        created_at: nowIso
      }
    ];
    for (var j = 0; j < defaultLocations.length; j++) {
      insertSheetObject("Locations", defaultLocations[j]);
    }
  }

  if (actor) {
    writeActivityLog(
      actor,
      "SCHEMA_INITIALIZED",
      "System",
      ss.getId(),
      "Verified 9 normalized tabs (" + createdTabs.length + " newly created)",
      { createdTabs: createdTabs, verifiedTabs: verifiedTabs }
    );
  }

  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    createdTabs: createdTabs,
    verifiedTabs: verifiedTabs
  };
}

function handleDashboardBundle() {
  var ss = getTargetSpreadsheet();
  var existingTabs = ss.getSheets().map(function (s) {
    return s.getName();
  });
  return buildJsonResponse(true, {
    spreadsheetName: ss.getName(),
    tabsVerified: existingTabs,
    assets: readSheetRowsAsObjects("Assets"),
    users: readSheetRowsAsObjects("Users"),
    tickets: readSheetRowsAsObjects("Maintenance"),
    workLogs: readSheetRowsAsObjects("WorkLogs"),
    photos: readSheetRowsAsObjects("MaintenancePhotos"),
    statusHistory: readSheetRowsAsObjects("StatusHistory"),
    activityLogs: readSheetRowsAsObjects("ActivityLogs"),
    locations: readSheetRowsAsObjects("Locations"),
    settings: readSheetRowsAsObjects("Settings")
  });
}

function handleCreateAsset(actor, payload) {
  var existingAssets = readSheetRowsAsObjects("Assets");
  var nextSeq = existingAssets.length + 1;
  var year = new Date().getFullYear();
  var padded = ("0000" + nextSeq).slice(-4);
  var assetCode = payload.asset_code || "AST-" + year + "-" + padded;
  var nowIso = new Date().toISOString();

  var locations = readSheetRowsAsObjects("Locations");
  var matchedLoc = null;
  for (var i = 0; i < locations.length; i++) {
    if (String(locations[i].location_id) === String(payload.location_id)) {
      matchedLoc = locations[i];
      break;
    }
  }

  var record = {
    asset_id: payload.asset_id || Utilities.getUuid(),
    asset_code: assetCode,
    name: payload.name,
    category: payload.category,
    brand: payload.brand,
    model: payload.model,
    serial_number: payload.serial_number,
    location_id: payload.location_id,
    location_name: matchedLoc ? matchedLoc.name : payload.location_name || payload.location_id,
    assigned_department: payload.assigned_department,
    status: payload.status || "Operational",
    condition: payload.condition || "Good",
    purchase_date: payload.purchase_date,
    warranty_expiry: payload.warranty_expiry,
    vendor_name: payload.vendor_name,
    purchase_cost_idr: Number(payload.purchase_cost_idr || 0),
    specs_summary: payload.specs_summary,
    photo_drive_file_id: payload.photo_drive_file_id || "",
    photo_url: payload.photo_url || "",
    qr_payload_url: payload.qr_payload_url || ("http://localhost:3000/assets?code=" + assetCode),
    notes: payload.notes || "",
    created_at: nowIso,
    updated_at: nowIso
  };

  insertSheetObject("Assets", record);
  writeActivityLog(
    actor,
    "ASSET_CREATED",
    "Asset",
    record.asset_id,
    "Registered asset " + record.asset_code + " (" + record.name + ")",
    record
  );
  return record;
}

function getOrCreateDrivePhotoFolder() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("DRIVE_ASSET_PHOTOS_FOLDER_ID");
  if (folderId && folderId.trim().length > 5) {
    try {
      return DriveApp.getFolderById(folderId.trim());
    } catch (e) {
      // Fallback to named folder if ID is invalid
    }
  }
  var folderName = "IT_ASSET_MAINTENANCE_PHOTOS";
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function saveBase64PhotoToDrive(
  actor,
  base64String,
  originalFileName,
  mimeType,
  ticketId,
  ticketCode,
  assetId,
  stage
) {
  if (!base64String) return null;
  var cleanBase64 = String(base64String).replace(/^data:[^;]+;base64,/, "");
  var decodedBytes = Utilities.base64Decode(cleanBase64);
  var safeMime = mimeType || "image/jpeg";
  var ext = safeMime.indexOf("png") >= 0 ? ".png" : safeMime.indexOf("webp") >= 0 ? ".webp" : ".jpg";
  var timestampStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd-HHmmss");
  var safeFileName = (ticketCode || "MNT") + "_" + stage + "_" + timestampStr + ext;

  var blob = Utilities.newBlob(decodedBytes, safeMime, safeFileName);
  var folder = getOrCreateDrivePhotoFolder();
  var driveFile = folder.createFile(blob);
  var driveUrl = driveFile.getUrl();
  var nowIso = new Date().toISOString();

  var photoRecord = {
    photo_id: Utilities.getUuid(),
    ticket_id: ticketId || "",
    asset_id: assetId || "",
    stage: stage || "Before",
    drive_file_id: driveFile.getId(),
    file_name: originalFileName ? (safeFileName + " (" + originalFileName + ")") : safeFileName,
    mime_type: safeMime,
    size_bytes: decodedBytes.length,
    caption: driveUrl,
    uploaded_by_email: actor && actor.email ? actor.email : "system@hotel.local",
    created_at: nowIso
  };

  insertSheetObject("MaintenancePhotos", photoRecord);
  return photoRecord;
}

function handleCreateMaintenance(actor, payload) {
  var existingTickets = readSheetRowsAsObjects("Maintenance");
  var nextSeq = existingTickets.length + 1;
  var year = new Date().getFullYear();
  var padded = ("0000" + nextSeq).slice(-4);
  var ticketCode = payload.ticket_code || "MNT-" + year + "-" + padded;
  var nowIso = new Date().toISOString();

  var assets = readSheetRowsAsObjects("Assets");
  var matchedAsset = null;
  for (var i = 0; i < assets.length; i++) {
    if (String(assets[i].asset_id) === String(payload.asset_id)) {
      matchedAsset = assets[i];
      break;
    }
  }

  var assignedTechName = payload.assigned_technician_name || "";
  if (payload.assigned_technician_id && !assignedTechName) {
    var users = readSheetRowsAsObjects("Users");
    for (var u = 0; u < users.length; u++) {
      if (String(users[u].user_id) === String(payload.assigned_technician_id)) {
        assignedTechName = users[u].full_name;
        break;
      }
    }
  }

  var ticketId = payload.ticket_id || Utilities.getUuid();
  var photoInfo = null;
  if (payload.photo_base64) {
    photoInfo = saveBase64PhotoToDrive(
      actor,
      payload.photo_base64,
      payload.photo_name,
      payload.photo_mime,
      ticketId,
      ticketCode,
      payload.asset_id,
      "Before"
    );
  }

  var initialStatus = payload.assigned_technician_id ? "Assigned" : "Submitted";
  var descriptionWithPhoto = payload.issue_description;
  if (photoInfo && photoInfo.caption) {
    descriptionWithPhoto =
      payload.issue_description + "\n[Foto Bukti (Before): " + photoInfo.caption + "]";
  }

  var record = {
    ticket_id: ticketId,
    ticket_code: ticketCode,
    asset_id: payload.asset_id,
    asset_code: matchedAsset ? matchedAsset.asset_code : (payload.asset_code || "AST-UNKNOWN"),
    asset_name: matchedAsset ? matchedAsset.name : (payload.asset_name || "Unknown Asset"),
    location_name: matchedAsset ? matchedAsset.location_name : (payload.location_name || "Hotel Premises"),
    type: payload.type,
    priority: payload.priority,
    status: initialStatus,
    title: payload.title,
    issue_description: descriptionWithPhoto,
    reported_by_user_id: actor.user_id || actor.email,
    reported_by_name: actor.name,
    reported_by_email: actor.email,
    assigned_technician_id: payload.assigned_technician_id || "",
    assigned_technician_name: assignedTechName,
    root_cause: "",
    resolution_summary: photoInfo ? ("Foto Before: " + photoInfo.caption) : "",
    downtime_minutes: 0,
    cost_idr: 0,
    due_at: "",
    resolved_at: "",
    closed_at: "",
    created_at: nowIso,
    updated_at: nowIso
  };

  insertSheetObject("Maintenance", record);
  writeStatusHistory(
    actor,
    "Maintenance",
    record.ticket_id,
    record.ticket_code,
    "None",
    initialStatus,
    record.title
  );
  writeActivityLog(
    actor,
    "TICKET_CREATED",
    "Maintenance",
    record.ticket_id,
    "Created ticket " + record.ticket_code + " for " + record.asset_code + (photoInfo ? " (with Drive photo)" : ""),
    { ticket_code: record.ticket_code, photo_drive_url: photoInfo ? photoInfo.caption : "" }
  );
  return record;
}

function handleSystemHealth() {
  var ss = getTargetSpreadsheet();
  var existingTabs = ss.getSheets().map(function (s) {
    return s.getName();
  });
  return buildJsonResponse(true, {
    reachable: true,
    spreadsheetName: ss.getName(),
    tabsVerified: existingTabs,
    timestamp: new Date().toISOString()
  });
}

function getTargetSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty("SPREADSHEET_ID");
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function readSheetRowsAsObjects(tabName) {
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var results = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    results.push(obj);
  }
  return results.reverse();
}

function insertSheetObject(tabName, record) {
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    initializeSpreadsheetSchema(null);
    sheet = ss.getSheetByName(tabName);
  }
  var headers = REQUIRED_TABS[tabName];
  var rowValues = headers.map(function (key) {
    return record[key] !== undefined && record[key] !== null ? record[key] : "";
  });
  sheet.appendRow(rowValues);
  return record;
}

function updateMaintenanceTicketStatus(actor, payload) {
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Maintenance");
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error("Maintenance tab is empty or not initialized.");
  }
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idIndex = headers.indexOf("ticket_id");
  var codeIndex = headers.indexOf("ticket_code");
  var assetIdIndex = headers.indexOf("asset_id");
  var statusIndex = headers.indexOf("status");
  var techIdIndex = headers.indexOf("assigned_technician_id");
  var techNameIndex = headers.indexOf("assigned_technician_name");
  var resolutionIndex = headers.indexOf("resolution_summary");
  var downtimeIndex = headers.indexOf("downtime_minutes");
  var costIndex = headers.indexOf("cost_idr");
  var updatedAtIndex = headers.indexOf("updated_at");

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idIndex]) === String(payload.ticket_id)) {
      var prevStatus = String(values[r][statusIndex]);
      var ticketCode = String(values[r][codeIndex] || "MNT");
      var assetId = String(values[r][assetIdIndex] || "");
      var nowIso = new Date().toISOString();

      var photoInfo = null;
      if (payload.photo_base64) {
        photoInfo = saveBase64PhotoToDrive(
          actor,
          payload.photo_base64,
          payload.photo_name,
          payload.photo_mime,
          payload.ticket_id,
          ticketCode,
          assetId,
          "After"
        );
      }

      sheet.getRange(r + 1, statusIndex + 1).setValue(payload.new_status);

      if (payload.assigned_technician_id && techIdIndex >= 0) {
        sheet.getRange(r + 1, techIdIndex + 1).setValue(payload.assigned_technician_id);
        var users = readSheetRowsAsObjects("Users");
        for (var u = 0; u < users.length; u++) {
          if (String(users[u].user_id) === String(payload.assigned_technician_id)) {
            if (techNameIndex >= 0) {
              sheet.getRange(r + 1, techNameIndex + 1).setValue(users[u].full_name);
            }
            break;
          }
        }
      }

      if (downtimeIndex >= 0 && payload.downtime_minutes !== undefined) {
        sheet.getRange(r + 1, downtimeIndex + 1).setValue(Number(payload.downtime_minutes));
      }
      if (costIndex >= 0 && payload.cost_idr !== undefined) {
        sheet.getRange(r + 1, costIndex + 1).setValue(Number(payload.cost_idr));
      }
      if (resolutionIndex >= 0 && (payload.action_taken || photoInfo)) {
        var resSummary = payload.action_taken || "";
        if (photoInfo && photoInfo.caption) {
          resSummary += " [Foto Hasil (After): " + photoInfo.caption + "]";
        }
        sheet.getRange(r + 1, resolutionIndex + 1).setValue(resSummary);
      }
      if (updatedAtIndex >= 0) {
        sheet.getRange(r + 1, updatedAtIndex + 1).setValue(nowIso);
      }

      var worklogAction = payload.action_taken;
      if (photoInfo && photoInfo.caption) {
        worklogAction += "\n[Foto Hasil (After): " + photoInfo.caption + "]";
      }

      // Append WorkLog row
      insertSheetObject("WorkLogs", {
        worklog_id: Utilities.getUuid(),
        ticket_id: payload.ticket_id,
        technician_user_id: actor.email,
        technician_name: actor.name,
        action_taken: worklogAction,
        parts_replaced: payload.parts_replaced || "",
        time_spent_minutes: Number(payload.time_spent_minutes || 15),
        created_at: nowIso
      });

      writeStatusHistory(
        actor,
        "Maintenance",
        payload.ticket_id,
        ticketCode,
        prevStatus,
        payload.new_status,
        worklogAction
      );

      writeActivityLog(
        actor,
        "TICKET_STATUS_UPDATED",
        "Maintenance",
        payload.ticket_id,
        "Updated ticket status: " + prevStatus + " -> " + payload.new_status + (photoInfo ? " (with Drive photo)" : ""),
        {
          ticket_id: payload.ticket_id,
          new_status: payload.new_status,
          photo_drive_url: photoInfo ? photoInfo.caption : ""
        }
      );

      return {
        ticket_id: payload.ticket_id,
        ticket_code: ticketCode,
        status: payload.new_status,
        previous_status: prevStatus,
        new_status: payload.new_status,
        photo_drive_url: photoInfo ? photoInfo.caption : "",
        updated_at: nowIso
      };
    }
  }
  throw new Error("Ticket not found: " + payload.ticket_id);
}

function handleCreateUser(actor, payload) {
  var existingUsers = readSheetRowsAsObjects("Users");
  for (var i = 0; i < existingUsers.length; i++) {
    if (
      String(existingUsers[i].email).toLowerCase() ===
      String(payload.email).toLowerCase()
    ) {
      throw new Error("User with email " + payload.email + " already exists.");
    }
  }
  var nowIso = new Date().toISOString();
  var record = {
    user_id: payload.user_id || Utilities.getUuid(),
    email: String(payload.email).toLowerCase().trim(),
    full_name: payload.full_name,
    role: payload.role || "Requestor",
    department: payload.department || "Hotel Operations",
    phone_whatsapp: payload.phone_whatsapp || "",
    status: payload.status || "Active",
    last_login_at: "",
    created_at: nowIso,
    updated_at: nowIso
  };
  insertSheetObject("Users", record);
  writeActivityLog(
    actor,
    "USER_CREATED",
    "User",
    record.user_id,
    "Created user " + record.full_name + " (" + record.email + ") as " + record.role,
    record
  );
  return record;
}

function handleUpdateUser(actor, payload) {
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error("Users tab is empty.");
  }
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idIndex = headers.indexOf("user_id");
  var roleIndex = headers.indexOf("role");
  var deptIndex = headers.indexOf("department");
  var statusIndex = headers.indexOf("status");
  var updatedAtIndex = headers.indexOf("updated_at");

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idIndex]) === String(payload.user_id)) {
      var nowIso = new Date().toISOString();
      if (roleIndex >= 0 && payload.role) {
        sheet.getRange(r + 1, roleIndex + 1).setValue(payload.role);
      }
      if (deptIndex >= 0 && payload.department) {
        sheet.getRange(r + 1, deptIndex + 1).setValue(payload.department);
      }
      if (statusIndex >= 0 && payload.status) {
        sheet.getRange(r + 1, statusIndex + 1).setValue(payload.status);
      }
      if (updatedAtIndex >= 0) {
        sheet.getRange(r + 1, updatedAtIndex + 1).setValue(nowIso);
      }
      writeActivityLog(
        actor,
        "USER_UPDATED",
        "User",
        payload.user_id,
        "Updated user " + String(values[r][headers.indexOf("email")]) + " -> Role: " + payload.role + ", Status: " + payload.status,
        payload
      );
      return {
        user_id: payload.user_id,
        email: String(values[r][headers.indexOf("email")]),
        full_name: String(values[r][headers.indexOf("full_name")]),
        role: payload.role,
        status: payload.status,
        updated_at: nowIso
      };
    }
  }
  throw new Error("User not found: " + payload.user_id);
}

function handleUpsertGoogleLogin(payload) {
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error("Akses Ditolak: Tab Users di Google Spreadsheet masih kosong.");
  }
  var nowIso = new Date().toISOString();
  var emailLower = String(payload.email || "").toLowerCase().trim();

  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var emailIdx = headers.indexOf("email");
  var lastLoginIdx = headers.indexOf("last_login_at");

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][emailIdx]).toLowerCase().trim() === emailLower) {
      if (lastLoginIdx >= 0) {
        sheet.getRange(r + 1, lastLoginIdx + 1).setValue(nowIso);
      }
      var existingUser = {};
      for (var c = 0; c < headers.length; c++) {
        existingUser[headers[c]] = values[r][c];
      }
      existingUser.last_login_at = nowIso;
      return existingUser;
    }
  }

  throw new Error(
    "Akses Ditolak: Email " + emailLower + " tidak terdaftar di tab Users Google Spreadsheet."
  );
}

function handleCreateLocation(actor, payload) {
  var nowIso = new Date().toISOString();
  var record = {
    location_id: payload.location_id || ("loc-" + Utilities.getUuid().slice(0, 8)),
    location_code: String(payload.location_code || "").toUpperCase().trim(),
    name: String(payload.name || "").trim(),
    building_wing: String(payload.building_wing || "").trim(),
    floor: String(payload.floor || "").trim(),
    area_type: payload.area_type || "Front Office & Lobby",
    pic_department: String(payload.pic_department || "").trim(),
    is_active: payload.is_active !== false,
    created_at: nowIso
  };
  insertSheetObject("Locations", record);
  writeActivityLog(
    actor,
    "LOCATION_CREATED",
    "Location",
    record.location_id,
    "Added location " + record.location_code + " — " + record.name,
    record
  );
  return record;
}

function handleUpdateLocation(actor, payload) {
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Locations");
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error("Locations tab is empty.");
  }
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idIndex = headers.indexOf("location_id");

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idIndex]) === String(payload.location_id)) {
      var updatedRecord = {
        location_id: payload.location_id,
        location_code: String(payload.location_code || values[r][headers.indexOf("location_code")]).toUpperCase().trim(),
        name: String(payload.name || values[r][headers.indexOf("name")]).trim(),
        building_wing: String(payload.building_wing || values[r][headers.indexOf("building_wing")]).trim(),
        floor: String(payload.floor || values[r][headers.indexOf("floor")]).trim(),
        area_type: payload.area_type || values[r][headers.indexOf("area_type")],
        pic_department: String(payload.pic_department || values[r][headers.indexOf("pic_department")]).trim(),
        is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
        created_at: values[r][headers.indexOf("created_at")] || new Date().toISOString()
      };
      var rowValues = headers.map(function (key) {
        return updatedRecord[key] !== undefined && updatedRecord[key] !== null
          ? updatedRecord[key]
          : "";
      });
      sheet.getRange(r + 1, 1, 1, headers.length).setValues([rowValues]);
      writeActivityLog(
        actor,
        "LOCATION_UPDATED",
        "Location",
        payload.location_id,
        "Updated location " + updatedRecord.location_code + " — " + updatedRecord.name,
        updatedRecord
      );
      return updatedRecord;
    }
  }
  throw new Error("Location not found: " + payload.location_id);
}

function handleDeleteLocation(actor, payload) {
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Locations");
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error("Locations tab is empty.");
  }
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idIndex = headers.indexOf("location_id");
  var codeIndex = headers.indexOf("location_code");
  var nameIndex = headers.indexOf("name");

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idIndex]) === String(payload.location_id)) {
      var deletedCode = String(values[r][codeIndex] || "");
      var deletedName = String(values[r][nameIndex] || "");
      sheet.deleteRow(r + 1);
      writeActivityLog(
        actor,
        "LOCATION_DELETED",
        "Location",
        payload.location_id,
        "Deleted location " + deletedCode + " — " + deletedName,
        { location_id: payload.location_id, location_code: deletedCode, name: deletedName }
      );
      return {
        deletedId: payload.location_id,
        location_code: deletedCode,
        name: deletedName
      };
    }
  }
  throw new Error("Location not found: " + payload.location_id);
}

function buildJsonResponse(ok, data) {
  var envelope = {
    ok: ok,
    timestamp: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    mode: "production",
    data: data
  };
  return ContentService.createTextOutput(JSON.stringify(envelope)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function buildErrorResponse(code, message) {
  var envelope = {
    ok: false,
    timestamp: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    mode: "production",
    error: {
      code: code,
      message: message
    }
  };
  return ContentService.createTextOutput(JSON.stringify(envelope)).setMimeType(
    ContentService.MimeType.JSON
  );
}
