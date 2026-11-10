/**
 * ============================================================================
 * File: Audit.gs (Append-Only ActivityLogs & StatusHistory Writers)
 * ============================================================================
 */

function writeActivityLog(actor, action, entityType, entityId, summary, metadataObj) {
  var nowIso = new Date().toISOString();
  var logEntry = {
    log_id: Utilities.getUuid(),
    actor_email: actor && actor.email ? actor.email : "system@hotel.local",
    actor_name: actor && actor.name ? actor.name : "System",
    actor_role: actor && actor.role ? actor.role : "Admin",
    action: action,
    entity_type: entityType,
    entity_id: entityId,
    summary: summary,
    metadata_json: metadataObj ? JSON.stringify(metadataObj) : "{}",
    created_at: nowIso
  };
  insertSheetObject("ActivityLogs", logEntry);
  return logEntry;
}

function writeStatusHistory(
  actor,
  entityType,
  entityId,
  entityCode,
  previousStatus,
  newStatus,
  reason
) {
  var nowIso = new Date().toISOString();
  var entry = {
    history_id: Utilities.getUuid(),
    entity_type: entityType,
    entity_id: entityId,
    entity_code: entityCode,
    previous_status: previousStatus,
    new_status: newStatus,
    changed_by_email: actor && actor.email ? actor.email : "system@hotel.local",
    changed_by_role: actor && actor.role ? actor.role : "Admin",
    reason: reason || "",
    created_at: nowIso
  };
  insertSheetObject("StatusHistory", entry);
  return entry;
}
