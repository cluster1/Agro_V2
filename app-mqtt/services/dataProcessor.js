const { v4: uuidv4 } = require('uuid');
const { withTransaction, getDeviceInfo, getDbTimezone } = require('../config/database');
const { dbLogger, appLogger } = require('../utils/logger');
const {
  validatePayload,
  parseReadDate,
  normalizeReadings,
  serializeForLog
} = require('../utils/payload');

/**
 * Save raw payload to tm_log_receive table
 * @param {Object} payload - MQTT payload
 * @param {Object} conn - Connection of the surrounding transaction
 * @returns {Promise<string>} - log_rx_id
 */
async function saveLogReceive(payload, conn) {
  const logRxId = uuidv4().replace(/-/g, '').substring(0, 32);
  const devId = String(payload.id);
  const logRxDate = new Date();
  const { text, truncated } = serializeForLog(payload);

  if (truncated) {
    dbLogger.warn(`Payload of device ${devId} exceeds the log column size and was truncated in tm_log_receive`);
  }

  await conn.execute(
    `INSERT INTO tm_log_receive (log_rx_id, dev_id, log_rx_date, log_rx_payload)
     VALUES (?, ?, ?, ?)`,
    [logRxId, devId, logRxDate, text]
  );
  dbLogger.info(`Saved log_receive: ${logRxId} for device: ${devId}`);
  return logRxId;
}

/**
 * Save sensor readings to tm_sensor_read with one multi-row INSERT
 * @param {Object} payload - MQTT payload
 * @param {string} logRxId - Reference to tm_log_receive
 * @param {Object} conn - Connection of the surrounding transaction
 * @param {{tenant_id: string, cluster_id: string}|null} deviceInfo - Row of tm_device, if registered
 * @returns {Promise<number>} - Number of records inserted
 */
async function saveSensorReadings(payload, logRxId, conn, deviceInfo) {
  const devId = String(payload.id);
  const tenantId = deviceInfo?.tenant_id || null;
  const clusterId = deviceInfo?.cluster_id || null;

  const parsed = parseReadDate(payload.datetime, { timezone: getDbTimezone() });
  if (parsed.usedFallback) {
    dbLogger.warn(`Device ${devId} sent an unreadable datetime (${JSON.stringify(payload.datetime)}); using server receive time`);
  }
  const readDate = parsed.date;

  const { readings, skipped } = normalizeReadings(payload);
  for (const { field, reason } of skipped) {
    dbLogger.warn(`Skipped field "${field}" of device ${devId}: ${reason}`);
  }

  if (readings.length === 0) {
    dbLogger.warn(`No storable sensor fields found in payload for device: ${devId}`);
    return 0;
  }

  const rowSql = '(?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const params = [];
  for (const { dsId, value } of readings) {
    params.push(uuidv4().replace(/-/g, ''), dsId, devId, logRxId, tenantId, clusterId, readDate, value, 1);
  }

  await conn.execute(
    `INSERT INTO tm_sensor_read
     (read_id, ds_id, dev_id, log_rx_id, tenant_id, cluster_id, read_date, read_value, read_sts)
     VALUES ${readings.map(() => rowSql).join(', ')}`,
    params
  );

  dbLogger.info(`Saved ${readings.length} sensor readings for device: ${devId}`);
  return readings.length;
}

/**
 * Process incoming MQTT message
 * @param {string} topic - MQTT topic
 * @param {Buffer} message - MQTT message buffer
 * @returns {Promise<Object>} - Processing result
 */
async function processMessage(topic, message) {
  const startTime = Date.now();

  try {
    // Parse JSON payload
    const payload = JSON.parse(message.toString());
    appLogger.info(`Received message from topic: ${topic}`);
    appLogger.debug(`Payload: ${JSON.stringify(payload)}`);

    // Validate payload
    const validation = validatePayload(payload);
    if (!validation.isValid) {
      appLogger.error(`Payload validation failed: ${validation.errors.join(', ')}`);
      return {
        success: false,
        error: 'Validation failed',
        details: validation.errors
      };
    }

    // Device lookup is read-only, so it stays outside the transaction
    const deviceInfo = await getDeviceInfo(String(payload.id));
    if (!deviceInfo) {
      dbLogger.warn(`Device ${payload.id} not found in tm_device. tenant_id and cluster_id will be null (BR-003)`);
    }

    // Log + readings are written together: either both are stored or neither is.
    const { logRxId, sensorCount } = await withTransaction(async (conn) => {
      const id = await saveLogReceive(payload, conn);
      const count = await saveSensorReadings(payload, id, conn, deviceInfo);
      return { logRxId: id, sensorCount: count };
    });

    const processingTime = Date.now() - startTime;
    appLogger.info(`Message processed successfully in ${processingTime}ms. Log ID: ${logRxId}, Sensors: ${sensorCount}`);

    // BR-004: Check SLA (< 3 seconds)
    if (processingTime > 3000) {
      appLogger.warn(`Processing time exceeded SLA: ${processingTime}ms > 3000ms`);
    }

    return {
      success: true,
      logRxId,
      sensorCount,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;

    if (error instanceof SyntaxError) {
      appLogger.error(`Invalid JSON payload: ${error.message}`);
      return {
        success: false,
        error: 'Invalid JSON',
        details: error.message
      };
    }

    appLogger.error(`Error processing message: ${error.message}`);
    return {
      success: false,
      error: error.message,
      processingTime
    };
  }
}

module.exports = {
  validatePayload,
  saveLogReceive,
  saveSensorReadings,
  processMessage
};
