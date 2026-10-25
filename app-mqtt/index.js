require('dotenv').config();
const { appLogger } = require('./utils/logger');
const { initializePool, closePool } = require('./config/database');
const { initializeMqttClient, disconnectClient, getMessageStats } = require('./services/mqttClient');
const { startMonitoring, getHealthStatus } = require('./services/monitoring');

let stopMonitoring = null;

/**
 * Initialize application
 */
async function initializeApp() {
  try {
    appLogger.info('========================================');
    appLogger.info('Starting MQTT IoT Data Ingest System');
    appLogger.info('========================================');

    // Initialize database connection pool
    appLogger.info('Initializing database connection...');
    await initializePool();
    appLogger.info('✓ Database initialized');

    // Initialize MQTT client
    appLogger.info('Initializing MQTT client...');
    await initializeMqttClient();
    appLogger.info('✓ MQTT client initialized');

    // Start monitoring
    appLogger.info('Starting monitoring service...');
    stopMonitoring = startMonitoring(60000); // Log metrics every 60 seconds
    appLogger.info('✓ Monitoring service started');

    appLogger.info('========================================');
    appLogger.info('Application started successfully');
    appLogger.info('========================================');

    // Log initial health status
    const health = await getHealthStatus();
    appLogger.info(`System Status: ${health.status}`);
    appLogger.info(`MQTT: ${health.mqtt.status}`);
    appLogger.info(`Database: ${health.database.status}`);

  } catch (error) {
    appLogger.error(`Failed to initialize application: ${error.message}`);
    appLogger.error(error.stack);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  appLogger.info(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // Stop monitoring
    if (stopMonitoring) {
      stopMonitoring();
    }

    // Log final statistics
    const stats = getMessageStats();
    appLogger.info('=== Final Statistics ===');
    appLogger.info(`Total Messages Received: ${stats.received}`);
    appLogger.info(`Total Messages Processed: ${stats.processed}`);
    appLogger.info(`Total Messages Failed: ${stats.failed}`);
    appLogger.info(`Success Rate: ${stats.successRate}%`);
    appLogger.info(`Average Throughput: ${stats.throughput} msg/s`);

    // Disconnect MQTT client
    appLogger.info('Disconnecting MQTT client...');
    await disconnectClient();
    appLogger.info('✓ MQTT client disconnected');

    // Close database pool
    appLogger.info('Closing database connection...');
    await closePool();
    appLogger.info('✓ Database connection closed');

    appLogger.info('Shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    appLogger.error(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  appLogger.error('Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  appLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

/**
 * Handle SIGTERM signal
 */
process.on('SIGTERM', () => shutdown('SIGTERM'));

/**
 * Handle SIGINT signal (Ctrl+C)
 */
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the application
initializeApp();
