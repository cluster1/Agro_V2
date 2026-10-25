-- Migration: Fix nullable columns for required fields
-- Date: 2025-10-21
-- Description: Change required fields from nullable to NOT NULL

-- Fix tm_tenant table
ALTER TABLE `tm_tenant` MODIFY COLUMN `tenant_name` VARCHAR(128) NOT NULL;

-- Fix tm_site table  
ALTER TABLE `tm_site` MODIFY COLUMN `tenant_id` VARCHAR(32) NOT NULL;
ALTER TABLE `tm_site` MODIFY COLUMN `site_name` VARCHAR(64) NOT NULL;

-- Fix tm_cluster table
ALTER TABLE `tm_cluster` MODIFY COLUMN `site_id` VARCHAR(32) NOT NULL;
ALTER TABLE `tm_cluster` MODIFY COLUMN `cluster_name` VARCHAR(64) NOT NULL;

-- Fix tm_device table
ALTER TABLE `tm_device` MODIFY COLUMN `site_id` VARCHAR(32) NOT NULL;
ALTER TABLE `tm_device` MODIFY COLUMN `dev_name` VARCHAR(64) NOT NULL;

-- Verify changes
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    IS_NULLABLE,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN ('tm_tenant', 'tm_site', 'tm_cluster', 'tm_device')
AND COLUMN_NAME IN ('tenant_name', 'site_name', 'cluster_name', 'dev_name', 'tenant_id', 'site_id')
ORDER BY TABLE_NAME, COLUMN_NAME;
