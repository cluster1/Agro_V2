const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    if (stack) {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`;
    }
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// Create transport for app.log
const appTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'info'
});

// Create transport for mqtt.log
const mqttTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'mqtt-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'debug'
});

// Create transport for db.log
const dbTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'db-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'debug'
});

// Create transport for error.log
const errorTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error'
});

// Console transport for development
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  )
});

// Main app logger
const appLogger = winston.createLogger({
  format: customFormat,
  transports: [
    appTransport,
    errorTransport,
    consoleTransport
  ]
});

// MQTT logger
const mqttLogger = winston.createLogger({
  format: customFormat,
  transports: [
    mqttTransport,
    errorTransport,
    consoleTransport
  ]
});

// Database logger
const dbLogger = winston.createLogger({
  format: customFormat,
  transports: [
    dbTransport,
    errorTransport,
    consoleTransport
  ]
});

module.exports = {
  appLogger,
  mqttLogger,
  dbLogger
};
