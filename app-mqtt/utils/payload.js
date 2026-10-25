/**
 * Pure helpers for turning an MQTT payload into rows. No I/O so they can be unit tested.
 * Limits mirror the column sizes of tm_log_receive / tm_sensor_read.
 */
const MAX_DEV_ID = 32; // tm_sensor_read.dev_id / ds_id are varchar(32)
const MAX_DS_ID = 32;
const MAX_READ_VALUE = 128; // tm_sensor_read.read_value varchar(128)
const MAX_LOG_PAYLOAD = 1024; // tm_log_receive.log_rx_payload varchar(1024)
const MAX_READINGS = 200; // bounds the size of the multi-row INSERT

const RESERVED_FIELDS = new Set(['id', 'datetime']);
const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const OFFSET = /^[+-]\d{2}:\d{2}$/;

/**
 * @param {*} payload - Parsed JSON payload
 * @returns {{isValid: boolean, errors: string[]}}
 */
function validatePayload(payload) {
  const errors = [];

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    errors.push('Payload must be a valid JSON object');
  } else {
    // BR-001: id is mandatory
    const id = payload.id;
    if (!id) {
      errors.push('Missing required field: id');
    } else if (typeof id !== 'string' && typeof id !== 'number') {
      errors.push('Field id must be a string');
    } else if (String(id).length > MAX_DEV_ID) {
      errors.push(`Field id is longer than ${MAX_DEV_ID} characters`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Accepts 'local' (server time zone, the previous behaviour), 'Z' or '+HH:MM'.
 * @returns {{kind: 'local'} | {kind: 'offset', minutes: number}}
 */
function parseTimezone(tz) {
  if (!tz || tz === 'local') return { kind: 'local' };
  if (tz === 'Z') return { kind: 'offset', minutes: 0 };
  if (OFFSET.test(tz)) {
    const sign = tz[0] === '-' ? -1 : 1;
    return { kind: 'offset', minutes: sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(4, 6))) };
  }
  throw new Error(`Invalid DB_TIMEZONE "${tz}". Use "local", "Z" or "+HH:MM".`);
}

/**
 * Resolve the reading time of a payload.
 * - "YYYY-MM-DD HH:mm:ss" (no zone) is read in `timezone` (the same zone the DB driver writes in),
 *   so the stored wall-clock time does not depend on the server's own zone.
 * - Strings with an explicit zone / ISO "Z" are honoured as-is.
 * - Numbers are epoch seconds or milliseconds.
 * - Missing or unparseable values fall back to `now` and are reported via `usedFallback`.
 *
 * @param {*} raw - payload.datetime
 * @param {{timezone?: string, now?: Date}} [options]
 * @returns {{date: Date, usedFallback: boolean}}
 */
function parseReadDate(raw, options = {}) {
  const now = options.now || new Date();
  const tz = parseTimezone(options.timezone);
  const fallback = { date: now, usedFallback: true };

  if (raw === undefined || raw === null || raw === '') return { date: now, usedFallback: false, missing: true };

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return fallback;
    const date = new Date(raw < 1e11 ? raw * 1000 : raw);
    return Number.isNaN(date.getTime()) ? fallback : { date, usedFallback: false };
  }

  if (typeof raw !== 'string') return fallback;
  const text = raw.trim();

  const m = NAIVE_DATETIME.exec(text);
  if (m) {
    const [y, mo, d, hh, mm] = m.slice(1, 6).map(Number);
    const ss = Number(m[6] || 0);
    const ms = Number((m[7] || '0').padEnd(3, '0'));

    // Reject impossible values (e.g. 2026-02-31, hour 25) instead of letting Date roll them over
    const check = new Date(Date.UTC(y, mo - 1, d, hh, mm, ss, ms));
    const same =
      check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d &&
      check.getUTCHours() === hh && check.getUTCMinutes() === mm && check.getUTCSeconds() === ss;
    if (!same) return fallback;

    const date = tz.kind === 'offset'
      ? new Date(check.getTime() - tz.minutes * 60000)
      : new Date(y, mo - 1, d, hh, mm, ss, ms);
    return { date, usedFallback: false };
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? fallback : { date, usedFallback: false };
}

/**
 * Turn the sensor fields of a payload into storable readings, dropping anything that is not
 * a scalar value so rows like "null" or "[object Object]" never reach tm_sensor_read.
 *
 * @param {Object} payload
 * @returns {{readings: Array<{dsId: string, value: string}>, skipped: Array<{field: string, reason: string}>}}
 */
function normalizeReadings(payload) {
  const readings = [];
  const skipped = [];

  for (const [field, raw] of Object.entries(payload)) {
    if (RESERVED_FIELDS.has(field)) continue;

    if (field.length === 0 || field.length > MAX_DS_ID) {
      skipped.push({ field, reason: `field name must be 1-${MAX_DS_ID} characters` });
      continue;
    }
    if (readings.length >= MAX_READINGS) {
      skipped.push({ field, reason: `more than ${MAX_READINGS} fields in one message` });
      continue;
    }

    let value;
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) {
        skipped.push({ field, reason: 'value is not a finite number' });
        continue;
      }
      value = String(raw);
    } else if (typeof raw === 'boolean') {
      value = raw ? '1' : '0';
    } else if (typeof raw === 'string') {
      value = raw.trim();
      if (value === '') {
        skipped.push({ field, reason: 'empty value' });
        continue;
      }
      if (value.length > MAX_READ_VALUE) {
        skipped.push({ field, reason: `value longer than ${MAX_READ_VALUE} characters` });
        continue;
      }
    } else {
      skipped.push({ field, reason: raw === null ? 'null value' : `unsupported type ${Array.isArray(raw) ? 'array' : typeof raw}` });
      continue;
    }

    readings.push({ dsId: field, value });
  }

  return { readings, skipped };
}

/**
 * tm_log_receive.log_rx_payload is varchar(1024); an oversized payload must not fail the
 * whole message, so keep the head of it (the log is for debugging only).
 * @returns {{text: string, truncated: boolean}}
 */
function serializeForLog(payload) {
  const text = JSON.stringify(payload);
  return text.length > MAX_LOG_PAYLOAD
    ? { text: text.slice(0, MAX_LOG_PAYLOAD), truncated: true }
    : { text, truncated: false };
}

module.exports = {
  MAX_LOG_PAYLOAD,
  validatePayload,
  parseTimezone,
  parseReadDate,
  normalizeReadings,
  serializeForLog,
};
