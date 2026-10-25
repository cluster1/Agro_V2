const mqtt = require('mqtt');
const { mqttLogger, appLogger } = require('../utils/logger');
const { processMessage } = require('./dataProcessor');
const config = require('../config/app.config.json');

let client = null;
let messageStats = {
  received: 0,
  processed: 0,
  failed: 0,
  startTime: Date.now()
};

/**
 * Get MQTT connection options
 * @returns {Object} - MQTT connection options
 */
function getMqttOptions() {
  return {
    username: process.env.MQTT_USERNAME || config.mqtt.username,
    password: process.env.MQTT_PASSWORD || config.mqtt.password,
    reconnectPeriod: config.mqtt.reconnectPeriod || 5000,
    connectTimeout: config.mqtt.connectTimeout || 30000,
    clean: true,
    clientId: `mqtt_ingest_${Math.random().toString(16).substr(2, 8)}`
  };
}

/**
 * Initialize MQTT client and connect to broker
 * @returns {Promise<mqtt.MqttClient>}
 */
function initializeMqttClient() {
  return new Promise((resolve, reject) => {
    const mqttHost = process.env.MQTT_HOST || config.mqtt.host;
    const mqttTopic = process.env.MQTT_TOPIC || config.mqtt.topic;
    const options = getMqttOptions();

    mqttLogger.info(`Connecting to MQTT broker: ${mqttHost}`);
    
    client = mqtt.connect(mqttHost, options);

    // Connection successful
    client.on('connect', () => {
      mqttLogger.info('Connected to MQTT broker successfully');
      
      // Subscribe to topic
      client.subscribe(mqttTopic, { qos: 1 }, (err) => {
        if (err) {
          mqttLogger.error(`Failed to subscribe to topic ${mqttTopic}: ${err.message}`);
          reject(err);
        } else {
          mqttLogger.info(`Subscribed to topic: ${mqttTopic}`);
          resolve(client);
        }
      });
    });

    // Handle incoming messages
    client.on('message', async (topic, message) => {
      messageStats.received++;
      mqttLogger.debug(`Message received on topic: ${topic}`);
      
      try {
        const result = await processMessage(topic, message);
        
        if (result.success) {
          messageStats.processed++;
        } else {
          messageStats.failed++;
        }
      } catch (error) {
        messageStats.failed++;
        mqttLogger.error(`Error handling message: ${error.message}`);
      }
    });

    // Handle reconnection
    client.on('reconnect', () => {
      mqttLogger.warn('Reconnecting to MQTT broker...');
    });

    // Handle disconnection
    client.on('disconnect', () => {
      mqttLogger.warn('Disconnected from MQTT broker');
    });

    // Handle offline
    client.on('offline', () => {
      mqttLogger.warn('MQTT client is offline');
    });

    // Handle errors
    client.on('error', (error) => {
      mqttLogger.error(`MQTT error: ${error.message}`);
      
      // Don't reject on error, let reconnection handle it
      if (!client.connected) {
        reject(error);
      }
    });

    // Handle close
    client.on('close', () => {
      mqttLogger.info('MQTT connection closed');
    });

    // Connection timeout
    setTimeout(() => {
      if (!client.connected) {
        reject(new Error('MQTT connection timeout'));
      }
    }, options.connectTimeout);
  });
}

/**
 * Get MQTT client instance
 * @returns {mqtt.MqttClient}
 */
function getClient() {
  if (!client) {
    throw new Error('MQTT client not initialized. Call initializeMqttClient() first.');
  }
  return client;
}

/**
 * Get message statistics
 * @returns {Object} - Message statistics
 */
function getMessageStats() {
  const uptime = Math.floor((Date.now() - messageStats.startTime) / 1000);
  const throughput = uptime > 0 ? (messageStats.received / uptime).toFixed(2) : 0;
  const successRate = messageStats.received > 0 
    ? ((messageStats.processed / messageStats.received) * 100).toFixed(2) 
    : 0;

  return {
    ...messageStats,
    uptime,
    throughput: parseFloat(throughput),
    successRate: parseFloat(successRate)
  };
}

/**
 * Reset message statistics
 */
function resetStats() {
  messageStats = {
    received: 0,
    processed: 0,
    failed: 0,
    startTime: Date.now()
  };
  appLogger.info('Message statistics reset');
}

/**
 * Disconnect MQTT client
 * @returns {Promise<void>}
 */
function disconnectClient() {
  return new Promise((resolve) => {
    if (client && client.connected) {
      client.end(false, {}, () => {
        mqttLogger.info('MQTT client disconnected');
        client = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Check if MQTT client is connected
 * @returns {boolean}
 */
function isConnected() {
  return client && client.connected;
}

module.exports = {
  initializeMqttClient,
  getClient,
  getMessageStats,
  resetStats,
  disconnectClient,
  isConnected
};
