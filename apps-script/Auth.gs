/**
 * ============================================================================
 * File: Auth.gs (Constant-Time Shared Secret Verification)
 * ============================================================================
 */

function verifySharedSecret(incomingSecret) {
  var props = PropertiesService.getScriptProperties();
  var expectedSecret = props.getProperty("GAS_SHARED_SECRET");

  if (!expectedSecret || expectedSecret.trim().length < 4) {
    return {
      valid: false,
      reason: "Script Property GAS_SHARED_SECRET belum diisi di Project Settings Google Apps Script."
    };
  }

  if (!incomingSecret || typeof incomingSecret !== "string") {
    return {
      valid: false,
      reason: "Missing shared secret in request payload."
    };
  }

  var cleanIncoming = incomingSecret.trim();
  var cleanExpected = expectedSecret.trim();

  if (cleanIncoming.length !== cleanExpected.length) {
    return {
      valid: false,
      reason: "GAS_SHARED_SECRET di .env.local tidak cocok dengan Script Property di Apps Script."
    };
  }

  // Constant-time bitwise comparison to mitigate timing attacks
  var diff = 0;
  for (var i = 0; i < cleanExpected.length; i++) {
    diff |= cleanIncoming.charCodeAt(i) ^ cleanExpected.charCodeAt(i);
  }

  if (diff !== 0) {
    return {
      valid: false,
      reason: "GAS_SHARED_SECRET di .env.local tidak cocok dengan Script Property di Apps Script."
    };
  }

  return { valid: true };
}
