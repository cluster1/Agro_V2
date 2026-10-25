const mysql = require('mysql2/promise');
const { dbLogger } = require('../utils/logger');
const config = require('./app.config.json');

let pool = null;

// Errors worth retrying: connection trouble and lock contention. Anything else (constraint
// violations, bad data, syntax) fails the same way every time, so retrying only adds delay.
const TRANSIENT_ERRORS = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
  'ER_CON_COUNT_ERROR',
  'ER_SERVER_SHUTDOWN'
]);

function isRetryable(error) {
  return TRANSIENT_ERRORS.has(error && error.code);
}

function getDbTimezone() {
  return process.env.DB_TIMEZONE || 'local';
}

function getRetrySettings() {
  return {
    attempts: parseInt(process.env.RETRY_ATTEMPTS) || (config.app && config.app.retryAttempts) || 3,
    baseDelay: parseInt(process.env.RETRY_DELAY) || (config.app && config.app.retryDelay) || 1000
  };
}

/**
 * Run `fn`, retrying only transient errors with exponential backoff.
 * @param {() => Promise<any>} fn
 * @param {string} label - for log messages
 * @param {number} [retries] - total attempts
 */
async function withRetry(fn, label, retries) {
  const settings = getRetrySettings();
  const attempts = retries || settings.attempts;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        dbLogger.info(`${label} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      const retryable = isRetryable(error);
      dbLogger.error(
        `${label} failed on attempt ${attempt}/${attempts}: ${error.message}` +
          (retryable ? '' : ' (not retryable)')
      );

      if (!retryable || attempt === attempts) break;

      const delay = Math.min(settings.baseDelay * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Initialize database connection pool
 * @returns {Promise<mysql.Pool>}
 */
async function initializePool() {
  try {
    if (pool) {
      return pool;
    }

    pool = mysql.createPool({
      host: process.env.DB_HOST || config.database.host,
      user: process.env.DB_USER || config.database.user,
      password: process.env.DB_PASSWORD || config.database.password,
      database: process.env.DB_NAME || config.database.database,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || config.database.connectionLimit,
      waitForConnections: config.database.waitForConnections,
      queueLimit: config.database.queueLimit,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      // 'local' (default) keeps the old behaviour; set DB_TIMEZONE=+07:00 to store a fixed zone
      // regardless of the server's own time zone.
      timezone: getDbTimezone()
    });

    // Test connection
    const connection = await pool.getConnection();
    dbLogger.info('Database connection pool initialized successfully');
    connection.release();

    return pool;
  } catch (error) {
    dbLogger.error(`Failed to initialize database pool: ${error.message}`);
    throw error;
  }
}

/**
 * Get database connection pool
 * @returns {mysql.Pool}
 */
function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializePool() first.');
  }
  return pool;
}

/**
 * Execute a single query; transient errors are retried, others fail immediately.
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @param {number} [retries] - Total attempts (default from RETRY_ATTEMPTS / config)
 * @returns {Promise<any>}
 */
async function executeQuery(query, params = [], retries) {
  const currentPool = getPool();
  return withRetry(async () => {
    const [results] = await currentPool.execute(query, params);
    return results;
  }, 'Query', retries);
}

/**
 * Run `work(connection)` in one transaction: commit on success, roll back on any error.
 * The whole unit is retried only for transient errors (e.g. a deadlock caused by the
 * tm_sensor_read_update trigger when two messages for the same device overlap).
 * `work` must therefore be safe to run again from the start.
 *
 * @template T
 * @param {(connection: import('mysql2/promise').PoolConnection) => Promise<T>} work
 * @param {number} [retries]
 * @returns {Promise<T>}
 */
async function withTransaction(work, retries) {
  const currentPool = getPool();
  return withRetry(async () => {
    const connection = await currentPool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        dbLogger.error(`Rollback failed: ${rollbackError.message}`);
      }
      throw error;
    } finally {
      connection.release();
    }
  }, 'Transaction', retries);
}

/**
 * Close database connection pool
 */
async function closePool() {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      dbLogger.info('Database connection pool closed');
    } catch (error) {
      dbLogger.error(`Error closing database pool: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Get device information from tm_device table
 * @param {string} devId - Device ID
 * @returns {Promise<Object|null>}
 */
async function getDeviceInfo(devId) {
  try {
    const query = `
      SELECT tenant_id, cluster_id 
      FROM tm_device 
      WHERE dev_id = ? 
      LIMIT 1
    `;
    
    const results = await executeQuery(query, [devId]);
    
    if (results && results.length > 0) {
      return {
        tenant_id: results[0].tenant_id,
        cluster_id: results[0].cluster_id
      };
    }
    
    return null;
  } catch (error) {
    dbLogger.error(`Error fetching device info for ${devId}: ${error.message}`);
    return null;
  }
}

module.exports = {
  initializePool,
  getPool,
  executeQuery,
  withTransaction,
  isRetryable,
  getDbTimezone,
  closePool,
  getDeviceInfo
};
