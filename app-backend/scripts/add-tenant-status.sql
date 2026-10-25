-- Migration: Add tenant_sts column to tm_tenant table
-- Date: 2025-10-22
-- Description: Add status field for tenant (1=Active, 0=Non-Active)

USE agro_db;

-- Add tenant_sts column
ALTER TABLE tm_tenant 
ADD COLUMN tenant_sts TINYINT DEFAULT 1 COMMENT '1=Active, 0=Non-Active' 
AFTER tenant_logo;

-- Update existing tenants to Active (1) by default
UPDATE tm_tenant SET tenant_sts = 1 WHERE tenant_sts IS NULL;

-- Verify column added
DESCRIBE tm_tenant;

-- Show sample data
SELECT tenant_id, tenant_name, tenant_sts 
FROM tm_tenant 
LIMIT 5;

-- Show stats
SELECT 
  tenant_sts,
  CASE 
    WHEN tenant_sts = 1 THEN 'Active'
    WHEN tenant_sts = 0 THEN 'Non-Active'
    ELSE 'Unknown'
  END as status_label,
  COUNT(*) as count
FROM tm_tenant
GROUP BY tenant_sts;
