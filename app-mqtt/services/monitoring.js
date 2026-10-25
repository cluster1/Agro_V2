const { appLogger } = require('../utils/logger');
const { getMessageStats, isConnected } = require('./mqttClient');
const { getPool } = require('../config/database');

/**
 * Get system health status
 * @returns {Promise<Object>} - Health status
 */
async function getHealthStatus() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mqtt: {
      connected: false,
      status: 'disconnected'
    },
    database: {
      connected: false,
      status: 'disconnected'
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };

  // Check MQTT connection
  try {
    health.mqtt.connected = isConnected();
    health.mqtt.status = health.mqtt.connected ? 'connected' : 'disconnected';
  } catch (error) {
    health.mqtt.status = 'error';
    health.mqtt.error = error.message;
  }

  // Check database connection
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    health.database.connected = true;
    health.database.status = 'connected';
    connection.release();
  } catch (error) {
    health.database.status = 'error';
    health.database.error = error.message;
  }

  // Overall status
  if (!health.mqtt.connected || !health.database.connected) {
    health.status = 'degraded';
  }

  return health;
}

/**
 * Get monitoring metrics
 * @returns {Object} - Monitoring metrics
 */
function getMetrics() {
  const messageStats = getMessageStats();
  const memUsage = process.memoryUsage();

  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    messages: {
      received: messageStats.received,
      processed: messageStats.processed,
      failed: messageStats.failed,
      throughput: messageStats.throughput,
      successRate: messageStats.successRate
    },
    mqtt: {
      connected: isConnected()
    },
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
    },
    cpu: process.cpuUsage()
  };
}

/**
 * Log monitoring metrics periodically
 * @param {number} interval - Interval in milliseconds (default: 60000 = 1 minute)
 */
function startMonitoring(interval = 60000) {
  appLogger.info(`Starting monitoring service with ${interval}ms interval`);
  
  const monitoringInterval = setInterval(() => {
    const metrics = getMetrics();
    
    appLogger.info('=== System Metrics ===');
    appLogger.info(`Uptime: ${Math.floor(metrics.uptime)}s`);
    appLogger.info(`Messages - Received: ${metrics.messages.received}, Processed: ${metrics.messages.processed}, Failed: ${metrics.messages.failed}`);
    appLogger.info(`Throughput: ${metrics.messages.throughput} msg/s, Success Rate: ${metrics.messages.successRate}%`);
    appLogger.info(`MQTT Connected: ${metrics.mqtt.connected}`);
    appLogger.info(`Memory - RSS: ${metrics.memory.rss}, Heap Used: ${metrics.memory.heapUsed}`);
    
  }, interval);

  // Return function to stop monitoring
  return () => {
    clearInterval(monitoringInterval);
    appLogger.info('Monitoring service stopped');
  };
}

/**
 * Check database latency
 * @returns {Promise<number>} - Latency in milliseconds
 */
async function checkDatabaseLatency() {
  const pool = getPool();
  const startTime = Date.now();
  
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    
    const latency = Date.now() - startTime;
    return latency;
  } catch (error) {
    appLogger.error(`Database latency check failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getHealthStatus,
  getMetrics,
  startMonitoring,
  checkDatabaseLatency
};
