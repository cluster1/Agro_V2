-- Migration: Add tenant_pic and tenant_logo columns to tm_tenant table
-- Date: 2025-10-22
-- Description: Add Person In Charge and Logo fields to tenant

USE agro_db;

-- Add tenant_pic column
ALTER TABLE tm_tenant 
ADD COLUMN tenant_pic VARCHAR(128) NULL COMMENT 'Person In Charge (PIC) name' 
AFTER tenant_contact;

-- Add tenant_logo column
ALTER TABLE tm_tenant 
ADD COLUMN tenant_logo VARCHAR(255) NULL COMMENT 'Path to tenant logo file' 
AFTER tenant_pic;

-- Verify columns added
DESCRIBE tm_tenant;

-- Show sample data
SELECT tenant_id, tenant_name, tenant_contact, tenant_pic, tenant_logo 
FROM tm_tenant 
LIMIT 5;
