const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validatePayload,
  parseTimezone,
  parseReadDate,
  normalizeReadings,
  serializeForLog
} = require('../utils/payload');

// ---------- validatePayload ----------

test('validatePayload requires a scalar id of at most 32 chars', () => {
  assert.equal(validatePayload({ id: 'TELU-500' }).isValid, true);
  assert.equal(validatePayload({}).isValid, false);
  assert.equal(validatePayload(null).isValid, false);
  assert.equal(validatePayload([]).isValid, false);
  assert.equal(validatePayload('text').isValid, false);
  assert.equal(validatePayload({ id: { a: 1 } }).isValid, false);
  assert.equal(validatePayload({ id: 'x'.repeat(33) }).isValid, false);
  assert.equal(validatePayload({ id: 'x'.repeat(32) }).isValid, true);
});

// ---------- parseReadDate ----------

test('parseReadDate reads a zone-less datetime in the configured offset', () => {
  const { date, usedFallback } = parseReadDate('2026-01-16 04:43:03', { timezone: '+07:00' });
  assert.equal(usedFallback, false);
  assert.equal(date.toISOString(), '2026-01-15T21:43:03.000Z');
});

test('parseReadDate with timezone "local" keeps the server-local reading', () => {
  const { date } = parseReadDate('2026-01-16 04:43:03', { timezone: 'local' });
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getHours(), 4);
  assert.equal(date.getMinutes(), 43);
});

test('parseReadDate honours explicit zones and epochs', () => {
  assert.equal(parseReadDate('2026-01-16T04:43:03Z', { timezone: '+07:00' }).date.toISOString(), '2026-01-16T04:43:03.000Z');
  assert.equal(parseReadDate('2026-01-16T04:43:03+07:00').date.toISOString(), '2026-01-15T21:43:03.000Z');
  assert.equal(parseReadDate(1768513383).date.toISOString(), '2026-01-15T21:43:03.000Z'); // seconds
  assert.equal(parseReadDate(1768513383000).date.toISOString(), '2026-01-15T21:43:03.000Z'); // milliseconds
});

test('parseReadDate falls back to now for missing or impossible values', () => {
  const now = new Date('2026-05-01T00:00:00Z');
  const missing = parseReadDate(undefined, { now });
  assert.equal(missing.date, now);
  assert.equal(missing.usedFallback, false);

  for (const bad of ['not a date', '2026-02-31 10:00:00', '2026-01-16 25:00:00', {}, [], NaN, -5, true]) {
    const r = parseReadDate(bad, { now, timezone: '+07:00' });
    assert.equal(r.usedFallback, true, `expected fallback for ${JSON.stringify(bad)}`);
    assert.equal(r.date, now);
  }
});

test('parseTimezone accepts local, Z and +HH:MM only', () => {
  assert.deepEqual(parseTimezone(undefined), { kind: 'local' });
  assert.deepEqual(parseTimezone('Z'), { kind: 'offset', minutes: 0 });
  assert.deepEqual(parseTimezone('+07:00'), { kind: 'offset', minutes: 420 });
  assert.deepEqual(parseTimezone('-03:30'), { kind: 'offset', minutes: -210 });
  assert.throws(() => parseTimezone('Asia/Jakarta'));
  assert.throws(() => parseTimezone('+7'));
});

// ---------- normalizeReadings ----------

test('normalizeReadings keeps scalar values and drops junk', () => {
  const { readings, skipped } = normalizeReadings({
    id: 'D1',
    datetime: '2026-01-16 04:43:03',
    env_temp: 22.2,
    soil_hum: '29',
    pump_on: true,
    note: 'ok',
    bad_null: null,
    bad_obj: { a: 1 },
    bad_arr: [1, 2],
    bad_nan: Infinity,
    empty: '   ',
    too_long_value: 'x'.repeat(129),
    ['f'.repeat(33)]: 1
  });

  assert.deepEqual(readings, [
    { dsId: 'env_temp', value: '22.2' },
    { dsId: 'soil_hum', value: '29' },
    { dsId: 'pump_on', value: '1' },
    { dsId: 'note', value: 'ok' }
  ]);
  assert.deepEqual(
    skipped.map((s) => s.field).sort(),
    ['bad_arr', 'bad_nan', 'bad_null', 'bad_obj', 'empty', 'f'.repeat(33), 'too_long_value'].sort()
  );
});

test('normalizeReadings stores zero as a value', () => {
  const { readings } = normalizeReadings({ id: 'D1', soil_hum: 0 });
  assert.deepEqual(readings, [{ dsId: 'soil_hum', value: '0' }]);
});

test('normalizeReadings caps the number of fields per message', () => {
  const payload = { id: 'D1' };
  for (let i = 0; i < 250; i++) payload[`f${i}`] = i;
  const { readings, skipped } = normalizeReadings(payload);
  assert.equal(readings.length, 200);
  assert.equal(skipped.length, 50);
});

test('serializeForLog truncates payloads that do not fit varchar(1024)', () => {
  assert.equal(serializeForLog({ id: 'D1' }).truncated, false);
  const big = serializeForLog({ id: 'D1', blob: 'x'.repeat(2000) });
  assert.equal(big.truncated, true);
  assert.equal(big.text.length, 1024);
});

// ---------- processMessage (database replaced by a fake) ----------

/** Load dataProcessor with a recording fake in place of config/database.js */
function loadProcessor({ deviceInfo, failOn } = {}) {
  const dbPath = require.resolve('../config/database');
  const processorPath = require.resolve('../services/dataProcessor');
  delete require.cache[processorPath];

  const calls = { sql: [], begin: 0, commit: 0, rollback: 0 };
  const conn = {
    execute: async (sql, params) => {
      calls.sql.push({ sql, params });
      if (failOn && failOn(sql)) throw Object.assign(new Error('boom'), { code: 'ER_NO_REFERENCED_ROW_2' });
      return [{}];
    }
  };

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      getDbTimezone: () => '+07:00',
      getDeviceInfo: async () => deviceInfo ?? null,
      // Mirrors the real helper: commit on success, rollback on error, no retry for these tests
      withTransaction: async (work) => {
        calls.begin++;
        try {
          const result = await work(conn);
          calls.commit++;
          return result;
        } catch (error) {
          calls.rollback++;
          throw error;
        }
      }
    }
  };

  const processor = require(processorPath);
  return { processor, calls };
}

const message = (obj) => Buffer.from(JSON.stringify(obj));

test('processMessage writes the log and all readings in one transaction', async () => {
  const { processor, calls } = loadProcessor({ deviceInfo: { tenant_id: 'T1', cluster_id: 'C1' } });
  const result = await processor.processMessage('t', message({
    id: 'TELU-500', datetime: '2026-01-16 04:43:03', env_temp: 22.2, soil_hum: 29, bad: null
  }));

  assert.equal(result.success, true);
  assert.equal(result.sensorCount, 2);
  assert.equal(calls.begin, 1);
  assert.equal(calls.commit, 1);
  assert.equal(calls.rollback, 0);

  // one INSERT for the log and ONE multi-row INSERT for the readings (not one per sensor)
  assert.equal(calls.sql.length, 2);
  assert.match(calls.sql[0].sql, /INSERT INTO tm_log_receive/);
  assert.match(calls.sql[1].sql, /INSERT INTO tm_sensor_read/);
  assert.equal((calls.sql[1].sql.match(/\(\?, \?, \?, \?, \?, \?, \?, \?, \?\)/g) || []).length, 2);

  const params = calls.sql[1].params;
  assert.equal(params.length, 18);
  assert.equal(params[1], 'env_temp');
  assert.equal(params[2], 'TELU-500');
  assert.equal(params[4], 'T1');
  assert.equal(params[5], 'C1');
  assert.equal(params[6].toISOString(), '2026-01-15T21:43:03.000Z');
  assert.equal(params[7], '22.2');
});

test('processMessage stores readings of unknown devices with null tenant and cluster', async () => {
  const { processor, calls } = loadProcessor({ deviceInfo: null });
  const result = await processor.processMessage('t', message({ id: 'NEW-1', env_temp: 20 }));
  assert.equal(result.success, true);
  assert.equal(calls.sql[1].params[4], null);
  assert.equal(calls.sql[1].params[5], null);
});

test('processMessage rolls back the log when the readings insert fails', async () => {
  const { processor, calls } = loadProcessor({ failOn: (sql) => /tm_sensor_read/.test(sql) });
  const result = await processor.processMessage('t', message({ id: 'D1', env_temp: 20 }));
  assert.equal(result.success, false);
  assert.equal(calls.commit, 0);
  assert.equal(calls.rollback, 1);
});

test('processMessage does not open a transaction for invalid payloads', async () => {
  const { processor, calls } = loadProcessor();
  assert.equal((await processor.processMessage('t', message({ env_temp: 1 }))).success, false);
  assert.equal((await processor.processMessage('t', Buffer.from('{not json'))).success, false);
  assert.equal(calls.begin, 0);
});

test('processMessage keeps the log but stores no readings when nothing is storable', async () => {
  const { processor, calls } = loadProcessor();
  const result = await processor.processMessage('t', message({ id: 'D1', datetime: '2026-01-16 04:43:03', a: null }));
  assert.equal(result.success, true);
  assert.equal(result.sensorCount, 0);
  assert.equal(calls.sql.length, 1);
  assert.match(calls.sql[0].sql, /tm_log_receive/);
});

// ---------- retry policy (real database.js, no connection needed) ----------

test('isRetryable only accepts transient errors', () => {
  // earlier tests leave a fake in the require cache; load the real module again
  const realPath = require.resolve('../config/database');
  delete require.cache[realPath];
  const real = require(realPath);
  assert.equal(real.isRetryable({ code: 'ER_LOCK_DEADLOCK' }), true);
  assert.equal(real.isRetryable({ code: 'ECONNRESET' }), true);
  assert.equal(real.isRetryable({ code: 'ER_NO_REFERENCED_ROW_2' }), false);
  assert.equal(real.isRetryable({ code: 'ER_DATA_TOO_LONG' }), false);
  assert.equal(real.isRetryable(new SyntaxError('x')), false);
});
