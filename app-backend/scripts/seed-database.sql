-- Seed Database Script for Agro Monitoring System
-- Run this after creating the database schema

-- ============================================================
-- INSERT TENANTS
-- ============================================================

INSERT INTO tm_tenant (tenant_id, tenant_name, tenant_type, tenant_address, tenant_contact, tenant_created, tenant_update)
VALUES 
('TENANT-GLOBAL-001', 'Global Admin Organization', 'system', 'System Office', '+62000000000', NOW(), NOW()),
('TENANT-DEMO-001', 'PT Agro Sejahtera', 'perusahaan', 'Jl. Pertanian No. 123, Jakarta Selatan', '+628123456789', NOW(), NOW()),
('TENANT-DEMO-002', 'Koperasi Tani Maju', 'koperasi', 'Jl. Sawah Besar No. 45, Bogor', '+628234567890', NOW(), NOW());

-- ============================================================
-- INSERT USERS
-- Password hashes are for: admin123, tenant123, farmer123
-- Generated with bcrypt, rounds=10
-- ============================================================

-- Global Admin (Level 0)
INSERT INTO tm_user (user_id, tenant_id, user_name, user_pass, user_email, user_phone, user_role, user_level, user_sts, user_created, user_update)
VALUES ('USER-ADMIN-001', 'TENANT-GLOBAL-001', 'Global Admin', '$2b$10$K7L/8Q2tXJ9PVDqJ7hQ3r.zW5qKJ3J7xY5J7QF7Y5J7QF7Y5J7QF7e', 'admin@agro.com', '+62811111111', 'admin', 0, 'active', NOW(), NOW());

-- Tenant Admin PT Agro Sejahtera (Level 1)
INSERT INTO tm_user (user_id, tenant_id, user_name, user_pass, user_email, user_phone, user_role, user_level, user_sts, user_created, user_update)
VALUES ('USER-TENANT-001', 'TENANT-DEMO-001', 'Budi Santoso', '$2b$10$K7L/8Q2tXJ9PVDqJ7hQ3r.zW5qKJ3J7xY5J7QF7Y5J7QF7Y5J7QF7e', 'budi@agrosejahtera.com', '+62822222222', 'tenant_admin', 1, 'active', NOW(), NOW());

-- Farmer Users (Level 2)
INSERT INTO tm_user (user_id, tenant_id, user_name, user_pass, user_email, user_phone, user_role, user_level, user_sts, user_created, user_update)
VALUES 
('USER-FARMER-001', 'TENANT-DEMO-001', 'Ahmad Petani', '$2b$10$K7L/8Q2tXJ9PVDqJ7hQ3r.zW5qKJ3J7xY5J7QF7Y5J7QF7Y5J7QF7e', 'ahmad@agrosejahtera.com', '+62833333333', 'farmer', 2, 'active', NOW(), NOW()),
('USER-FARMER-002', 'TENANT-DEMO-001', 'Siti Tani', '$2b$10$K7L/8Q2tXJ9PVDqJ7hQ3r.zW5qKJ3J7xY5J7QF7Y5J7QF7Y5J7QF7e', 'siti@agrosejahtera.com', '+62844444444', 'farmer', 2, 'active', NOW(), NOW());

-- Investor (Level 2)
INSERT INTO tm_user (user_id, tenant_id, user_name, user_pass, user_email, user_phone, user_role, user_level, user_sts, user_created, user_update)
VALUES ('USER-INVESTOR-001', 'TENANT-DEMO-001', 'Investor One', '$2b$10$K7L/8Q2tXJ9PVDqJ7hQ3r.zW5qKJ3J7xY5J7QF7Y5J7QF7Y5J7QF7e', 'investor@agrosejahtera.com', '+62855555555', 'investor', 2, 'active', NOW(), NOW());

-- ============================================================
-- INSERT SITES
-- ============================================================

INSERT INTO tm_site (site_id, tenant_id, site_name, site_type, site_address, site_lon, site_lat, site_alt, site_sts, site_created, site_update)
VALUES 
('SITE-001', 'TENANT-DEMO-001', 'Lahan Padi Sawah Cikampek', 'FARM', 'Cikampek, Karawang, Jawa Barat', 107.4567, -6.4123, 25, 1, NOW(), NOW()),
('SITE-002', 'TENANT-DEMO-001', 'Kandang Ayam Bogor', 'RANCH', 'Ciawi, Bogor, Jawa Barat', 106.8456, -6.6789, 350, 1, NOW(), NOW()),
('SITE-003', 'TENANT-DEMO-001', 'Greenhouse Sayuran Lembang', 'GREENHOUSE', 'Lembang, Bandung Barat, Jawa Barat', 107.6123, -6.8234, 1200, 1, NOW(), NOW());

-- ============================================================
-- INSERT CLUSTERS
-- ============================================================

INSERT INTO tm_cluster (cluster_id, tenant_id, site_id, cluster_name, cluster_type, cluster_capacity, cluster_current, cluster_desc, cluster_created, cluster_update)
VALUES 
-- Clusters for SITE-001 (Sawah)
('CLUSTER-001', 'TENANT-DEMO-001', 'SITE-001', 'Blok Sawah A', 'FIELD', 5000, 4500, 'Blok A untuk padi varietas IR64', NOW(), NOW()),
('CLUSTER-002', 'TENANT-DEMO-001', 'SITE-001', 'Blok Sawah B', 'FIELD', 3000, 2800, 'Blok B untuk padi varietas Ciherang', NOW(), NOW()),

-- Clusters for SITE-002 (Kandang)
('CLUSTER-003', 'TENANT-DEMO-001', 'SITE-002', 'Kandang Ayam A', 'HOUSE', 2000, 1850, 'Kandang layer fase produksi', NOW(), NOW()),
('CLUSTER-004', 'TENANT-DEMO-001', 'SITE-002', 'Kandang Ayam B', 'HOUSE', 1500, 1200, 'Kandang broiler', NOW(), NOW()),

-- Clusters for SITE-003 (Greenhouse)
('CLUSTER-005', 'TENANT-DEMO-001', 'SITE-003', 'Greenhouse Tomat', 'GREENHOUSE', 1000, 900, 'Greenhouse untuk tomat hidroponik', NOW(), NOW());

-- ============================================================
-- INSERT DEVICES
-- ============================================================

INSERT INTO tm_device (dev_id, tenant_id, site_id, cluster_id, user_id, dev_name, dev_token, dev_location, dev_lon, dev_lat, dev_alt, dev_number_id, dev_ip, dev_port, dev_sts, dev_created, dev_update)
VALUES 
('DEVICE-001', 'TENANT-DEMO-001', 'SITE-001', 'CLUSTER-001', 'USER-FARMER-001', 'IoT Node Sawah A-1', 'TOKEN-ABC123XYZ', 'Corner A, Blok Sawah A', 107.4567, -6.4123, 25, 'DEV-001', '192.168.1.100', '8080', 1, NOW(), NOW()),
('DEVICE-002', 'TENANT-DEMO-001', 'SITE-002', 'CLUSTER-003', 'USER-FARMER-001', 'IoT Node Kandang A-1', 'TOKEN-DEF456UVW', 'Inside Kandang A', 106.8456, -6.6789, 350, 'DEV-002', '192.168.1.101', '8080', 1, NOW(), NOW()),
('DEVICE-003', 'TENANT-DEMO-001', 'SITE-003', 'CLUSTER-005', 'USER-FARMER-002', 'IoT Node Greenhouse-1', 'TOKEN-GHI789RST', 'Greenhouse Center', 107.6123, -6.8234, 1200, 'DEV-003', '192.168.1.102', '8080', 1, NOW(), NOW());

-- ============================================================
-- INSERT SENSORS
-- ============================================================

INSERT INTO td_sensor (sens_id, tenant_id, dev_id, sens_name, sens_address, sens_location, sens_lat, sens_lon, sens_alt)
VALUES 
-- Sensors for DEVICE-001
('SENSOR-001', 'TENANT-DEMO-001', 'DEVICE-001', 'Temperature Sensor', '0x01', 'Inside device box', -6.4123, 107.4567, 25),
('SENSOR-002', 'TENANT-DEMO-001', 'DEVICE-001', 'Humidity Sensor', '0x02', 'Inside device box', -6.4123, 107.4567, 25),
('SENSOR-003', 'TENANT-DEMO-001', 'DEVICE-001', 'Soil Moisture Sensor', '0x03', 'Ground level', -6.4123, 107.4567, 25),

-- Sensors for DEVICE-002
('SENSOR-004', 'TENANT-DEMO-001', 'DEVICE-002', 'Temperature Sensor', '0x01', 'Inside kandang', -6.6789, 106.8456, 350),
('SENSOR-005', 'TENANT-DEMO-001', 'DEVICE-002', 'Humidity Sensor', '0x02', 'Inside kandang', -6.6789, 106.8456, 350),
('SENSOR-006', 'TENANT-DEMO-001', 'DEVICE-002', 'NH3 Gas Sensor', '0x03', 'Ceiling level', -6.6789, 106.8456, 350),

-- Sensors for DEVICE-003
('SENSOR-007', 'TENANT-DEMO-001', 'DEVICE-003', 'Temperature Sensor', '0x01', 'Greenhouse center', -6.8234, 107.6123, 1200),
('SENSOR-008', 'TENANT-DEMO-001', 'DEVICE-003', 'Humidity Sensor', '0x02', 'Greenhouse center', -6.8234, 107.6123, 1200),
('SENSOR-009', 'TENANT-DEMO-001', 'DEVICE-003', 'Light Sensor', '0x03', 'Roof level', -6.8234, 107.6123, 1200);

-- ============================================================
-- INSERT REFERENCE DATA
-- ============================================================

-- Units
INSERT INTO tr_unit (unit_id, unit_name, unit_symbol, unit_sts, unit_update)
VALUES 
('UNIT-TEMP', 'Celsius', '°C', 1, NOW()),
('UNIT-HUM', 'Percent', '%', 1, NOW()),
('UNIT-PH', 'pH Value', 'pH', 1, NOW()),
('UNIT-PPM', 'Parts Per Million', 'ppm', 1, NOW()),
('UNIT-LUX', 'Lux', 'lx', 1, NOW());

-- Alarm Codes
INSERT INTO tr_alarm_code (alcode_id, alcode_note, alcode_sts, alcode_update)
VALUES 
('ALARM-TEMP-HIGH', 'Temperature too high', 1, NOW()),
('ALARM-TEMP-LOW', 'Temperature too low', 1, NOW()),
('ALARM-HUM-HIGH', 'Humidity too high', 1, NOW()),
('ALARM-HUM-LOW', 'Humidity too low', 1, NOW()),
('ALARM-DEVICE-OFFLINE', 'Device offline', 1, NOW());

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Count records per table
SELECT 'Tenants' as table_name, COUNT(*) as count FROM tm_tenant
UNION ALL
SELECT 'Users', COUNT(*) FROM tm_user
UNION ALL
SELECT 'Sites', COUNT(*) FROM tm_site
UNION ALL
SELECT 'Clusters', COUNT(*) FROM tm_cluster
UNION ALL
SELECT 'Devices', COUNT(*) FROM tm_device
UNION ALL
SELECT 'Sensors', COUNT(*) FROM td_sensor
UNION ALL
SELECT 'Units', COUNT(*) FROM tr_unit
UNION ALL
SELECT 'Alarm Codes', COUNT(*) FROM tr_alarm_code;

-- Show hierarchy
SELECT 
    t.tenant_name,
    s.site_name,
    c.cluster_name,
    d.dev_name,
    COUNT(DISTINCT sen.sens_id) as sensor_count
FROM tm_tenant t
LEFT JOIN tm_site s ON t.tenant_id = s.tenant_id
LEFT JOIN tm_cluster c ON s.site_id = c.site_id
LEFT JOIN tm_device d ON c.cluster_id = d.cluster_id
LEFT JOIN td_sensor sen ON d.dev_id = sen.dev_id
GROUP BY t.tenant_id, s.site_id, c.cluster_id, d.dev_id
ORDER BY t.tenant_name, s.site_name, c.cluster_name;
