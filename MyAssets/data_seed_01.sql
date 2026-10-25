/*
SQLyog Ultimate v8.3 
MySQL - 5.5.5-10.4.32-MariaDB : Database - agro_db_2025
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*Data for the table `tm_tenant` */

insert  into `tm_tenant`(`tenant_id`,`tenant_name`,`tenant_type`,`tenant_address`,`tenant_pic`,`tenant_contact`,`tenant_logo`,`tenant_sts`,`tenant_created`,`tenant_update`) values ('TENANT-DEMO-001','PT Agro Sejahtera','perusahaan','Jl. Pertanian No. 123, Jakarta Selatan','Budi','+628123456789',NULL,'1','2025-10-20 10:04:43','2025-10-22 09:31:47');
insert  into `tm_tenant`(`tenant_id`,`tenant_name`,`tenant_type`,`tenant_address`,`tenant_pic`,`tenant_contact`,`tenant_logo`,`tenant_sts`,`tenant_created`,`tenant_update`) values ('TENANT-DEMO-002','Koperasi Tani Maju','koperasi','Jl. Sawah Besar No. 45, Bogor',NULL,'+628234567890',NULL,'1','2025-10-20 10:04:43','2025-10-20 10:04:43');
insert  into `tm_tenant`(`tenant_id`,`tenant_name`,`tenant_type`,`tenant_address`,`tenant_pic`,`tenant_contact`,`tenant_logo`,`tenant_sts`,`tenant_created`,`tenant_update`) values ('TENANT-GLOBAL-001','Global Admin Organization','system','System Office',NULL,'+62000000000',NULL,'1','2025-10-20 10:04:43','2025-10-20 10:04:43');
insert  into `tm_tenant`(`tenant_id`,`tenant_name`,`tenant_type`,`tenant_address`,`tenant_pic`,`tenant_contact`,`tenant_logo`,`tenant_sts`,`tenant_created`,`tenant_update`) values ('TENANT1','BPP Karang Tengah','pemerintah','Jl. Karang Tengah no. 100','Pa Iman','08098999',NULL,'1','2025-10-22 07:33:43','2025-10-22 10:10:18');
insert  into `tm_tenant`(`tenant_id`,`tenant_name`,`tenant_type`,`tenant_address`,`tenant_pic`,`tenant_contact`,`tenant_logo`,`tenant_sts`,`tenant_created`,`tenant_update`) values ('TENANT22','RASTEK COMPANY','perusahaan','Jl. Reog No. 39','Akim','08098999',NULL,'1','2025-10-27 07:16:31','2025-10-27 07:16:31');

/*Data for the table `tm_user` */

insert  into `tm_user`(`user_id`,`tenant_id`,`user_name`,`user_pass`,`user_email`,`user_phone`,`user_role`,`user_level`,`user_sts`,`user_created`,`user_update`) values ('76f3a967-70aa-4b15-85dd-57c564a5','TENANT22','User Rastek','$2a$10$NpFOYoVDaZYgMKzMFc8vfOU.Hi8kZes1xuotGM/ZDZBVCdY4tt2mm','user@rastek.id',NULL,'tenant_admin',1,'active','2025-11-06 08:01:34','2025-11-06 08:01:34');
insert  into `tm_user`(`user_id`,`tenant_id`,`user_name`,`user_pass`,`user_email`,`user_phone`,`user_role`,`user_level`,`user_sts`,`user_created`,`user_update`) values ('f2703678-e743-4fd4-b437-81a6e4f9','TENANT-GLOBAL-001','test12355','$2a$10$npq1I5lelfdlvaOtWJNuD.UoIqGZtkXCPD9FnJl6tcnWV/6Q3fSc2','test@test.com',NULL,'investor',2,'active','2025-10-24 09:12:07','2025-10-24 09:37:53');
insert  into `tm_user`(`user_id`,`tenant_id`,`user_name`,`user_pass`,`user_email`,`user_phone`,`user_role`,`user_level`,`user_sts`,`user_created`,`user_update`) values ('USER-ADMIN-001','TENANT-GLOBAL-001','Global Admin','$2a$10$cjQw99NTjtgIDw5LYhc8Ru5JNDzQNMCN50detAm24ZUBumx/zOtyu','admin@agro.com','+62811111111','admin',0,'active','2025-10-20 10:04:43','2025-10-20 10:04:43');
insert  into `tm_user`(`user_id`,`tenant_id`,`user_name`,`user_pass`,`user_email`,`user_phone`,`user_role`,`user_level`,`user_sts`,`user_created`,`user_update`) values ('USER-FARMER-001','TENANT-DEMO-001','Ahmad Petani 1','$2a$10$1n7LpG4BMj9Q6Op7wU6ub.gamf8pHESNOtaIKNWPbHA12aM6IJ7wS','ahmad@agrosejahtera.com','+62833333333','farmer',2,'active','2025-10-20 10:04:43','2025-10-24 09:38:02');
insert  into `tm_user`(`user_id`,`tenant_id`,`user_name`,`user_pass`,`user_email`,`user_phone`,`user_role`,`user_level`,`user_sts`,`user_created`,`user_update`) values ('USER-FARMER-002','TENANT-DEMO-001','Siti Tani','$2b$10$K7L/8Q2tXJ9PVDqJ7hQ3r.zW5qKJ3J7xY5J7QF7Y5J7QF7Y5J7QF7e','siti@agrosejahtera.com','+62844444444','farmer',2,'active','2025-10-20 10:04:43','2025-10-20 10:04:43');
insert  into `tm_user`(`user_id`,`tenant_id`,`user_name`,`user_pass`,`user_email`,`user_phone`,`user_role`,`user_level`,`user_sts`,`user_created`,`user_update`) values ('USER-INVESTOR-001','TENANT-DEMO-001','Investor One','$2b$10$K7L/8Q2tXJ9PVDqJ7hQ3r.zW5qKJ3J7xY5J7QF7Y5J7QF7Y5J7QF7e','investor@agrosejahtera.com','+62855555555','investor',2,'active','2025-10-20 10:04:43','2025-10-20 10:04:43');
insert  into `tm_user`(`user_id`,`tenant_id`,`user_name`,`user_pass`,`user_email`,`user_phone`,`user_role`,`user_level`,`user_sts`,`user_created`,`user_update`) values ('USER-TENANT-001','TENANT-DEMO-001','Budi Santoso','$2a$10$IZxKihm1rwvU3yflQgwoLuFu1KrfsY/KPJXOSMUU37EB4dL3oLluC','budi@agrosejahtera.com','+62822222222','tenant_admin',1,'active','2025-10-20 10:04:43','2025-10-20 10:04:43');

/*Data for the table `tr_alarm_code` */

insert  into `tr_alarm_code`(`alcode_id`,`alcode_note`,`alcode_sts`,`alcode_update`) values ('ALARM-DEVICE-OFFLINE','Device offline',1,'2025-10-20 10:04:43');
insert  into `tr_alarm_code`(`alcode_id`,`alcode_note`,`alcode_sts`,`alcode_update`) values ('ALARM-HUM-HIGH','Humidity too high',1,'2025-10-20 10:04:43');
insert  into `tr_alarm_code`(`alcode_id`,`alcode_note`,`alcode_sts`,`alcode_update`) values ('ALARM-HUM-LOW','Humidity too low',1,'2025-10-20 10:04:43');
insert  into `tr_alarm_code`(`alcode_id`,`alcode_note`,`alcode_sts`,`alcode_update`) values ('ALARM-TEMP-HIGH','Temperature too high',1,'2025-10-20 10:04:43');
insert  into `tr_alarm_code`(`alcode_id`,`alcode_note`,`alcode_sts`,`alcode_update`) values ('ALARM-TEMP-LOW','Temperature too low',1,'2025-10-20 10:04:43');
insert  into `tr_alarm_code`(`alcode_id`,`alcode_note`,`alcode_sts`,`alcode_update`) values ('ALM-VOLT-NORMAL','Voltage Normal ',1,NULL);

/*Data for the table `tr_kode_telemetri` */

/*Data for the table `tr_unit` */

insert  into `tr_unit`(`unit_id`,`unit_name`,`unit_symbol`,`unit_sts`,`unit_update`) values ('UNIT-APM','Ampere','A',1,NULL);
insert  into `tr_unit`(`unit_id`,`unit_name`,`unit_symbol`,`unit_sts`,`unit_update`) values ('UNIT-HUM','Percent','%',1,'2025-10-20 10:04:43');
insert  into `tr_unit`(`unit_id`,`unit_name`,`unit_symbol`,`unit_sts`,`unit_update`) values ('UNIT-LUX','Lux','lx',1,'2025-10-20 10:04:43');
insert  into `tr_unit`(`unit_id`,`unit_name`,`unit_symbol`,`unit_sts`,`unit_update`) values ('UNIT-PH','pH Value','pH',1,'2025-10-20 10:04:43');
insert  into `tr_unit`(`unit_id`,`unit_name`,`unit_symbol`,`unit_sts`,`unit_update`) values ('UNIT-PPM','Parts Per Million','ppm',1,'2025-10-20 10:04:43');
insert  into `tr_unit`(`unit_id`,`unit_name`,`unit_symbol`,`unit_sts`,`unit_update`) values ('UNIT-TEMP','Celsius','°C',1,'2025-10-20 10:04:43');
insert  into `tr_unit`(`unit_id`,`unit_name`,`unit_symbol`,`unit_sts`,`unit_update`) values ('UNIT-VOLT','Volt','V',1,NULL);
insert  into `tr_unit`(`unit_id`,`unit_name`,`unit_symbol`,`unit_sts`,`unit_update`) values ('UNIT-WATT','Watt','W',1,NULL);

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
