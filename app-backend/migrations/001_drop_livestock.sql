-- Migration: remove Livestock module tables (not part of AgroTwin padi scope).
-- Run AFTER 000_baseline_v6.sql, once the backend build without the livestock module is deployed.

DROP TABLE IF EXISTS `tm_livestock_activity`;
DROP TABLE IF EXISTS `tm_livestock`;
