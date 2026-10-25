-- Migration: Create tm_device_sensor table (Sensor Parameters)
-- Date: 2025-10-22
-- Description: Create table for sensor parameters (detail table for master-detail entry)

USE agro_db;

-- Create tm_device_sensor table
CREATE TABLE IF NOT EXISTS tm_device_sensor (
  dev_sens_id VARCHAR(32) PRIMARY KEY COMMENT 'Unique device sensor parameter ID',
  sens_id VARCHAR(32) NOT NULL COMMENT 'Foreign key to td_sensor',
  dev_sens_name VARCHAR(64) NOT NULL COMMENT 'Parameter name (e.g., temperature, humidity)',
  dev_sens_unit VARCHAR(32) NULL COMMENT 'Unit of measurement (e.g., °C, %, pH)',
  dev_sens_type VARCHAR(16) NULL COMMENT 'Sensor type (analog, digital, etc.)',
  dev_sens_min DOUBLE NULL COMMENT 'Minimum value',
  dev_sens_max DOUBLE NULL COMMENT 'Maximum value',
  dev_sens_desc VARCHAR(128) NULL COMMENT 'Parameter description',
  dev_sens_created DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Created timestamp',
  dev_sens_update DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated timestamp',
  
  -- Foreign key constraint
  CONSTRAINT fk_dev_sens_sensor FOREIGN KEY (sens_id) REFERENCES td_sensor(sens_id) ON DELETE CASCADE,
  
  -- Indexes
  INDEX idx_sens_id (sens_id),
  INDEX idx_dev_sens_name (dev_sens_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Sensor parameters table (master-detail with td_sensor)';

-- Verify table created
DESCRIBE tm_device_sensor;

-- Show sample insert
SELECT 
  'Example INSERT' as Description,
  'INSERT INTO tm_device_sensor (dev_sens_id, sens_id, dev_sens_name, dev_sens_unit, dev_sens_type, dev_sens_min, dev_sens_max) 
   VALUES (UUID(), "SENS001", "temperature", "°C", "analog", 0, 100);' as SQL_Command;

-- Show table info
SELECT 
  TABLE_NAME,
  ENGINE,
  TABLE_ROWS,
  AVG_ROW_LENGTH,
  DATA_LENGTH,
  INDEX_LENGTH,
  CREATE_TIME,
  UPDATE_TIME,
  TABLE_COMMENT
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'agro_db' 
  AND TABLE_NAME = 'tm_device_sensor';
