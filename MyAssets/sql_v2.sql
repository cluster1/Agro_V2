/*
SQLyog Ultimate v8.3 
MySQL - 5.5.5-10.11.15-MariaDB : Database - agro_db
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*Table structure for table `td_device_sensor` */

CREATE TABLE `td_device_sensor` (
  `ds_id` varchar(32) NOT NULL,
  `dev_id` varchar(32) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `unit_id` varchar(32) DEFAULT NULL,
  `sens_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `animal_id` varchar(32) DEFAULT NULL,
  `plant_id` varchar(32) DEFAULT NULL,
  `kt_id` varchar(64) DEFAULT NULL,
  `dc_normal_value` float DEFAULT NULL,
  `ds_min_norm_value` float DEFAULT NULL,
  `ds_max_norm_value` float DEFAULT NULL,
  `ds_min_value` float DEFAULT NULL,
  `ds_max_value` float DEFAULT NULL,
  `ds_min_val_warn` float DEFAULT NULL,
  `ds_max_val_warn` float DEFAULT NULL,
  `ds_name` varchar(128) DEFAULT NULL,
  `ds_address` varchar(32) DEFAULT NULL,
  `ds_seq` int(4) DEFAULT NULL,
  `ds_sts` int(1) DEFAULT NULL,
  `ds_created` datetime DEFAULT NULL,
  `ds_update` datetime DEFAULT NULL,
  PRIMARY KEY (`ds_id`,`dev_id`),
  KEY `idx_td_ds_dev` (`dev_id`),
  KEY `td_device_sensor_ibfk_1` (`tenant_id`),
  KEY `td_device_sensor_ibfk_3` (`sens_id`),
  KEY `td_device_sensor_ibfk_4` (`cluster_id`),
  KEY `td_device_sensor_ibfk_5` (`plant_id`),
  KEY `td_device_sensor_ibfk_6` (`kt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `td_plant_phase_param` */

CREATE TABLE `td_plant_phase_param` (
  `ppp_id` varchar(32) NOT NULL,
  `phase_id` varchar(32) NOT NULL,
  `kt_id` varchar(64) NOT NULL,
  `unit_id` varchar(32) DEFAULT NULL,
  `ppp_norm_value` float DEFAULT NULL,
  `ppp_min_norm_value` float DEFAULT NULL,
  `ppp_max_norm_value` float DEFAULT NULL,
  `ppp_min_val_warn` float DEFAULT NULL,
  `ppp_max_val_warn` float DEFAULT NULL,
  `ppp_note` varchar(255) DEFAULT NULL,
  `ppp_sts` int(1) DEFAULT NULL,
  `ppp_update` datetime DEFAULT NULL,
  PRIMARY KEY (`ppp_id`),
  UNIQUE KEY `uq_ppp_phase_kt` (`phase_id`,`kt_id`),
  KEY `td_plant_phase_param_ibfk_2` (`kt_id`),
  KEY `td_plant_phase_param_ibfk_3` (`unit_id`),
  CONSTRAINT `td_plant_phase_param_ibfk_1` FOREIGN KEY (`phase_id`) REFERENCES `tr_plant_phase` (`phase_id`),
  CONSTRAINT `td_plant_phase_param_ibfk_2` FOREIGN KEY (`kt_id`) REFERENCES `tr_kode_telemetri` (`kt_id`),
  CONSTRAINT `td_plant_phase_param_ibfk_3` FOREIGN KEY (`unit_id`) REFERENCES `tr_unit` (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `td_plant_sim_phase` */

CREATE TABLE `td_plant_sim_phase` (
  `sp_id` varchar(64) NOT NULL,
  `sim_id` varchar(64) NOT NULL,
  `phase_id` varchar(32) NOT NULL,
  `sp_seq` int(4) DEFAULT NULL,
  `sp_start_date` date DEFAULT NULL,
  `sp_end_date` date DEFAULT NULL,
  `sp_start_age` int(4) DEFAULT NULL,
  `sp_gdd_start` float DEFAULT NULL,
  `sp_data_type` varchar(16) DEFAULT NULL,
  `sp_actual_date` date DEFAULT NULL,
  `sp_error_day` int(4) DEFAULT NULL,
  PRIMARY KEY (`sp_id`),
  UNIQUE KEY `uq_sp_sim_phase` (`sim_id`,`phase_id`),
  KEY `td_plant_sim_phase_ibfk_2` (`phase_id`),
  CONSTRAINT `td_plant_sim_phase_ibfk_1` FOREIGN KEY (`sim_id`) REFERENCES `tm_plant_simulation` (`sim_id`),
  CONSTRAINT `td_plant_sim_phase_ibfk_2` FOREIGN KEY (`phase_id`) REFERENCES `tr_plant_phase` (`phase_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `td_sensor` */

CREATE TABLE `td_sensor` (
  `sens_id` varchar(32) NOT NULL,
  `tenant_id` varchar(32) NOT NULL,
  `dev_id` varchar(32) NOT NULL,
  `sens_name` varchar(64) DEFAULT NULL,
  `sens_location` varchar(64) DEFAULT NULL,
  `sens_lat` double DEFAULT NULL,
  `sens_lon` double DEFAULT NULL,
  `sens_alt` double DEFAULT NULL,
  `sens_seq` int(11) DEFAULT NULL,
  PRIMARY KEY (`sens_id`,`tenant_id`,`dev_id`),
  KEY `td_sensor_ibfk_1` (`tenant_id`),
  KEY `td_sensor_ibfk_2` (`dev_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `td_variety_phase` */

CREATE TABLE `td_variety_phase` (
  `vp_id` varchar(32) NOT NULL,
  `var_id` varchar(32) NOT NULL,
  `phase_id` varchar(32) NOT NULL,
  `vp_start_age` int(4) DEFAULT NULL,
  `vp_end_age` int(4) DEFAULT NULL,
  `vp_gdd_start` float DEFAULT NULL,
  `vp_gdd_end` float DEFAULT NULL,
  `vp_source` varchar(16) DEFAULT NULL,
  `vp_note` varchar(255) DEFAULT NULL,
  `vp_sts` int(1) DEFAULT NULL,
  `vp_update` datetime DEFAULT NULL,
  PRIMARY KEY (`vp_id`),
  UNIQUE KEY `uq_vp_var_phase` (`var_id`,`phase_id`),
  KEY `td_variety_phase_ibfk_2` (`phase_id`),
  CONSTRAINT `td_variety_phase_ibfk_1` FOREIGN KEY (`var_id`) REFERENCES `tr_plant_variety` (`var_id`),
  CONSTRAINT `td_variety_phase_ibfk_2` FOREIGN KEY (`phase_id`) REFERENCES `tr_plant_phase` (`phase_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_alarm` */

CREATE TABLE `tm_alarm` (
  `alm_id` varchar(32) NOT NULL,
  `alcode_id` varchar(32) DEFAULT NULL,
  `read_id` varchar(64) DEFAULT NULL,
  `alm_date` datetime DEFAULT NULL,
  PRIMARY KEY (`alm_id`),
  KEY `tm_alarm_ibfk_1` (`alcode_id`),
  CONSTRAINT `tm_alarm_ibfk_1` FOREIGN KEY (`alcode_id`) REFERENCES `tr_alarm_code` (`alcode_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_climate_normal` */

CREATE TABLE `tm_climate_normal` (
  `cn_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) NOT NULL,
  `cn_scenario` varchar(16) NOT NULL,
  `cn_doy` int(4) NOT NULL,
  `cn_tmin` float DEFAULT NULL,
  `cn_tmax` float DEFAULT NULL,
  `cn_rh_mean` float DEFAULT NULL,
  `cn_rain` float DEFAULT NULL,
  `cn_radiation` float DEFAULT NULL,
  `cn_et0` float DEFAULT NULL,
  `cn_year_from` int(4) DEFAULT NULL,
  `cn_year_to` int(4) DEFAULT NULL,
  `cn_source` varchar(64) DEFAULT NULL,
  `cn_update` datetime DEFAULT NULL,
  PRIMARY KEY (`cn_id`),
  UNIQUE KEY `uq_cn_site_scn_doy` (`site_id`,`cn_scenario`,`cn_doy`),
  KEY `tm_climate_normal_ibfk_1` (`tenant_id`),
  CONSTRAINT `tm_climate_normal_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_climate_normal_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_cluster` */

CREATE TABLE `tm_cluster` (
  `cluster_id` varchar(32) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_name` varchar(64) NOT NULL,
  `cluster_type` varchar(32) DEFAULT NULL,
  `ptype_id` varchar(32) DEFAULT NULL,
  `cluster_capacity` int(11) DEFAULT NULL,
  `cluster_current` int(11) DEFAULT NULL,
  `cluster_desc` varchar(255) DEFAULT NULL,
  `cluster_created` datetime DEFAULT NULL,
  `cluster_update` datetime DEFAULT NULL,
  PRIMARY KEY (`cluster_id`),
  KEY `idx_cluster_site` (`site_id`),
  KEY `tm_cluster_ibfk_1` (`tenant_id`),
  KEY `tm_cluster_ibfk_3` (`ptype_id`),
  CONSTRAINT `tm_cluster_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_cluster_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_cluster_ibfk_3` FOREIGN KEY (`ptype_id`) REFERENCES `tr_plant_type` (`ptype_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_device` */

CREATE TABLE `tm_device` (
  `dev_id` varchar(32) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `dev_name` varchar(64) NOT NULL,
  `dev_token` varchar(128) DEFAULT NULL,
  `dev_location` varchar(128) DEFAULT NULL,
  `dev_lon` double DEFAULT NULL,
  `dev_lat` double DEFAULT NULL,
  `dev_alt` double DEFAULT NULL,
  `dev_number_id` varchar(64) DEFAULT NULL,
  `dev_ip` varchar(32) DEFAULT NULL,
  `dev_port` varchar(64) DEFAULT NULL,
  `dev_img` varchar(128) DEFAULT NULL,
  `dev_sts` int(1) DEFAULT NULL,
  `dev_created` datetime DEFAULT NULL,
  `dev_update` datetime DEFAULT NULL,
  PRIMARY KEY (`dev_id`),
  KEY `idx_device_tenant` (`tenant_id`),
  KEY `idx_device_cluster` (`cluster_id`),
  KEY `tm_device_ibfk_2` (`site_id`),
  KEY `tm_device_ibfk_4` (`user_id`),
  CONSTRAINT `tm_device_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_device_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_device_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_livestock` */

CREATE TABLE `tm_livestock` (
  `animal_id` varchar(32) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `animal_tag` varchar(64) DEFAULT NULL,
  `animal_species` varchar(32) DEFAULT NULL,
  `animal_breed` varchar(64) DEFAULT NULL,
  `animal_gender` varchar(8) DEFAULT NULL,
  `animal_birthdate` date DEFAULT NULL,
  `animal_status` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`animal_id`),
  KEY `idx_livestock_cluster` (`cluster_id`),
  KEY `tm_livestock_ibfk_1` (`tenant_id`),
  KEY `tm_livestock_ibfk_2` (`site_id`),
  CONSTRAINT `tm_livestock_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_livestock_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_livestock_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_livestock_activity` */

CREATE TABLE `tm_livestock_activity` (
  `activity_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `animal_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `user_id` varchar(32) DEFAULT NULL,
  `activity_type` varchar(32) DEFAULT NULL,
  `activity_desc` varchar(255) DEFAULT NULL,
  `activity_value` varchar(64) DEFAULT NULL,
  `activity_date` datetime DEFAULT NULL,
  PRIMARY KEY (`activity_id`),
  KEY `idx_activity_date` (`activity_date`),
  KEY `tm_livestock_activity_ibfk_1` (`tenant_id`),
  KEY `tm_livestock_activity_ibfk_2` (`animal_id`),
  KEY `tm_livestock_activity_ibfk_3` (`cluster_id`),
  KEY `tm_livestock_activity_ibfk_4` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_log_receive` */

CREATE TABLE `tm_log_receive` (
  `log_rx_id` varchar(32) NOT NULL,
  `dev_id` varchar(32) DEFAULT NULL,
  `log_rx_date` datetime DEFAULT NULL,
  `log_rx_payload` varchar(1024) DEFAULT NULL,
  PRIMARY KEY (`log_rx_id`),
  KEY `tm_log_receive_ibfk_1` (`dev_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_plant` */

CREATE TABLE `tm_plant` (
  `plant_id` varchar(32) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `ptype_id` varchar(32) DEFAULT NULL,
  `var_id` varchar(32) DEFAULT NULL,
  `phase_id` varchar(32) DEFAULT NULL,
  `plant_tag` varchar(64) DEFAULT NULL,
  `plant_name` varchar(64) DEFAULT NULL,
  `plant_level` varchar(16) DEFAULT NULL,
  `plant_variety` varchar(64) DEFAULT NULL,
  `plant_seed_source` varchar(64) DEFAULT NULL,
  `plant_sow_date` date DEFAULT NULL,
  `plant_date` date DEFAULT NULL,
  `plant_season` varchar(16) DEFAULT NULL,
  `plant_harvest_date` date DEFAULT NULL,
  `plant_count` int(11) DEFAULT NULL,
  `plant_area` double DEFAULT NULL,
  `plant_lon` double DEFAULT NULL,
  `plant_lat` double DEFAULT NULL,
  `plant_alt` double DEFAULT NULL,
  `plant_geom` mediumtext DEFAULT NULL,
  `plant_phase_mode` varchar(8) DEFAULT 'AUTO',
  `plant_phase_date` date DEFAULT NULL,
  `plant_health` varchar(16) DEFAULT NULL,
  `plant_desc` varchar(255) DEFAULT NULL,
  `plant_sts` int(1) DEFAULT NULL,
  `plant_created` datetime DEFAULT NULL,
  `plant_update` datetime DEFAULT NULL,
  PRIMARY KEY (`plant_id`),
  KEY `idx_plant_tenant` (`tenant_id`),
  KEY `idx_plant_cluster` (`cluster_id`),
  KEY `tm_plant_ibfk_2` (`site_id`),
  KEY `tm_plant_ibfk_4` (`ptype_id`),
  KEY `tm_plant_ibfk_5` (`phase_id`),
  KEY `tm_plant_ibfk_6` (`var_id`),
  CONSTRAINT `tm_plant_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_plant_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_plant_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`),
  CONSTRAINT `tm_plant_ibfk_4` FOREIGN KEY (`ptype_id`) REFERENCES `tr_plant_type` (`ptype_id`),
  CONSTRAINT `tm_plant_ibfk_5` FOREIGN KEY (`phase_id`) REFERENCES `tr_plant_phase` (`phase_id`),
  CONSTRAINT `tm_plant_ibfk_6` FOREIGN KEY (`var_id`) REFERENCES `tr_plant_variety` (`var_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_plant_activity` */

CREATE TABLE `tm_plant_activity` (
  `pact_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `plant_id` varchar(32) DEFAULT NULL,
  `sched_id` varchar(64) DEFAULT NULL,
  `actype_id` varchar(32) DEFAULT NULL,
  `phase_id` varchar(32) DEFAULT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `dev_id` varchar(32) DEFAULT NULL,
  `pact_desc` varchar(255) DEFAULT NULL,
  `pact_value` varchar(64) DEFAULT NULL,
  `unit_id` varchar(32) DEFAULT NULL,
  `mat_id` varchar(32) DEFAULT NULL,
  `pact_material` varchar(128) DEFAULT NULL,
  `pact_worker` int(4) DEFAULT NULL,
  `pact_cost` double DEFAULT NULL,
  `pact_lon` double DEFAULT NULL,
  `pact_lat` double DEFAULT NULL,
  `pact_source` varchar(16) DEFAULT NULL,
  `pact_date` datetime DEFAULT NULL,
  `pact_sts` int(1) DEFAULT NULL,
  `pact_created` datetime DEFAULT NULL,
  `pact_update` datetime DEFAULT NULL,
  PRIMARY KEY (`pact_id`),
  KEY `idx_pact_date` (`pact_date`),
  KEY `idx_pact_plant` (`plant_id`),
  KEY `tm_plant_activity_ibfk_1` (`tenant_id`),
  KEY `tm_plant_activity_ibfk_2` (`site_id`),
  KEY `tm_plant_activity_ibfk_3` (`cluster_id`),
  KEY `tm_plant_activity_ibfk_5` (`sched_id`),
  KEY `tm_plant_activity_ibfk_6` (`actype_id`),
  KEY `tm_plant_activity_ibfk_7` (`phase_id`),
  KEY `tm_plant_activity_ibfk_8` (`unit_id`),
  KEY `tm_plant_activity_ibfk_9` (`user_id`),
  KEY `tm_plant_activity_ibfk_10` (`dev_id`),
  KEY `tm_plant_activity_ibfk_11` (`mat_id`),
  CONSTRAINT `tm_plant_activity_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_plant_activity_ibfk_11` FOREIGN KEY (`mat_id`) REFERENCES `tr_material` (`mat_id`),
  CONSTRAINT `tm_plant_activity_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_plant_activity_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`),
  CONSTRAINT `tm_plant_activity_ibfk_4` FOREIGN KEY (`plant_id`) REFERENCES `tm_plant` (`plant_id`),
  CONSTRAINT `tm_plant_activity_ibfk_5` FOREIGN KEY (`sched_id`) REFERENCES `tm_plant_schedule` (`sched_id`),
  CONSTRAINT `tm_plant_activity_ibfk_6` FOREIGN KEY (`actype_id`) REFERENCES `tr_activity_type` (`actype_id`),
  CONSTRAINT `tm_plant_activity_ibfk_7` FOREIGN KEY (`phase_id`) REFERENCES `tr_plant_phase` (`phase_id`),
  CONSTRAINT `tm_plant_activity_ibfk_8` FOREIGN KEY (`unit_id`) REFERENCES `tr_unit` (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_plant_harvest` */

CREATE TABLE `tm_plant_harvest` (
  `hv_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `plant_id` varchar(32) DEFAULT NULL,
  `pact_id` varchar(64) DEFAULT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `hv_date` date DEFAULT NULL,
  `hv_season` varchar(16) DEFAULT NULL,
  `hv_rotation` int(4) DEFAULT NULL,
  `hv_area` double DEFAULT NULL,
  `hv_bunch` int(11) DEFAULT NULL,
  `hv_weight` double DEFAULT NULL,
  `hv_bjr` float DEFAULT NULL,
  `hv_moisture` float DEFAULT NULL,
  `hv_weight_dry` double DEFAULT NULL,
  `hv_yield` float DEFAULT NULL,
  `hv_grade` varchar(16) DEFAULT NULL,
  `hv_loss_pct` float DEFAULT NULL,
  `hv_price` double DEFAULT NULL,
  `hv_source` varchar(16) DEFAULT NULL,
  `hv_desc` varchar(255) DEFAULT NULL,
  `hv_sts` int(1) DEFAULT NULL,
  `hv_created` datetime DEFAULT NULL,
  `hv_update` datetime DEFAULT NULL,
  PRIMARY KEY (`hv_id`),
  KEY `idx_hv_date` (`hv_date`),
  KEY `idx_hv_plant` (`plant_id`),
  KEY `tm_plant_harvest_ibfk_1` (`tenant_id`),
  KEY `tm_plant_harvest_ibfk_2` (`site_id`),
  KEY `tm_plant_harvest_ibfk_3` (`cluster_id`),
  KEY `tm_plant_harvest_ibfk_5` (`pact_id`),
  KEY `tm_plant_harvest_ibfk_6` (`user_id`),
  CONSTRAINT `tm_plant_harvest_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_plant_harvest_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_plant_harvest_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`),
  CONSTRAINT `tm_plant_harvest_ibfk_4` FOREIGN KEY (`plant_id`) REFERENCES `tm_plant` (`plant_id`),
  CONSTRAINT `tm_plant_harvest_ibfk_5` FOREIGN KEY (`pact_id`) REFERENCES `tm_plant_activity` (`pact_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_plant_observation` */

CREATE TABLE `tm_plant_observation` (
  `obs_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `plant_id` varchar(32) DEFAULT NULL,
  `phase_id` varchar(32) DEFAULT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `dev_id` varchar(32) DEFAULT NULL,
  `obs_date` datetime DEFAULT NULL,
  `obs_age` int(4) DEFAULT NULL,
  `obs_phase_pct` float DEFAULT NULL,
  `obs_sample_n` int(4) DEFAULT NULL,
  `obs_height` float DEFAULT NULL,
  `obs_tiller` float DEFAULT NULL,
  `obs_bwd` float DEFAULT NULL,
  `obs_frond` float DEFAULT NULL,
  `obs_bunch` float DEFAULT NULL,
  `obs_flower_male` float DEFAULT NULL,
  `obs_flower_female` float DEFAULT NULL,
  `obs_pod` float DEFAULT NULL,
  `obs_girth` float DEFAULT NULL,
  `obs_pest_name` varchar(64) DEFAULT NULL,
  `obs_pest_pct` float DEFAULT NULL,
  `obs_lon` double DEFAULT NULL,
  `obs_lat` double DEFAULT NULL,
  `obs_source` varchar(16) DEFAULT NULL,
  `obs_confidence` float DEFAULT NULL,
  `obs_desc` varchar(255) DEFAULT NULL,
  `obs_sts` int(1) DEFAULT NULL,
  `obs_created` datetime DEFAULT NULL,
  `obs_update` datetime DEFAULT NULL,
  PRIMARY KEY (`obs_id`),
  KEY `idx_obs_date` (`obs_date`),
  KEY `idx_obs_plant` (`plant_id`,`phase_id`),
  KEY `tm_plant_observation_ibfk_1` (`tenant_id`),
  KEY `tm_plant_observation_ibfk_2` (`site_id`),
  KEY `tm_plant_observation_ibfk_3` (`cluster_id`),
  KEY `tm_plant_observation_ibfk_5` (`phase_id`),
  KEY `tm_plant_observation_ibfk_6` (`user_id`),
  KEY `tm_plant_observation_ibfk_7` (`dev_id`),
  CONSTRAINT `tm_plant_observation_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_plant_observation_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_plant_observation_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`),
  CONSTRAINT `tm_plant_observation_ibfk_4` FOREIGN KEY (`plant_id`) REFERENCES `tm_plant` (`plant_id`),
  CONSTRAINT `tm_plant_observation_ibfk_5` FOREIGN KEY (`phase_id`) REFERENCES `tr_plant_phase` (`phase_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_plant_schedule` */

CREATE TABLE `tm_plant_schedule` (
  `sched_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `plant_id` varchar(32) DEFAULT NULL,
  `actype_id` varchar(32) DEFAULT NULL,
  `phase_id` varchar(32) DEFAULT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `sched_parent_id` varchar(64) DEFAULT NULL,
  `sched_title` varchar(128) DEFAULT NULL,
  `sched_desc` varchar(255) DEFAULT NULL,
  `sched_start_date` datetime DEFAULT NULL,
  `sched_end_date` datetime DEFAULT NULL,
  `sched_repeat` varchar(16) DEFAULT 'NONE',
  `sched_interval` int(4) DEFAULT NULL,
  `sched_repeat_until` date DEFAULT NULL,
  `sched_plan_value` varchar(64) DEFAULT NULL,
  `unit_id` varchar(32) DEFAULT NULL,
  `sched_remind` int(4) DEFAULT NULL,
  `sched_source` varchar(16) DEFAULT 'MANUAL',
  `sched_sts` int(1) DEFAULT NULL,
  `sched_created` datetime DEFAULT NULL,
  `sched_update` datetime DEFAULT NULL,
  PRIMARY KEY (`sched_id`),
  KEY `idx_sched_date` (`sched_start_date`),
  KEY `idx_sched_plant` (`plant_id`),
  KEY `tm_plant_schedule_ibfk_1` (`tenant_id`),
  KEY `tm_plant_schedule_ibfk_2` (`site_id`),
  KEY `tm_plant_schedule_ibfk_3` (`cluster_id`),
  KEY `tm_plant_schedule_ibfk_5` (`actype_id`),
  KEY `tm_plant_schedule_ibfk_6` (`phase_id`),
  KEY `tm_plant_schedule_ibfk_7` (`unit_id`),
  KEY `tm_plant_schedule_ibfk_8` (`user_id`),
  CONSTRAINT `tm_plant_schedule_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_plant_schedule_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_plant_schedule_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`),
  CONSTRAINT `tm_plant_schedule_ibfk_4` FOREIGN KEY (`plant_id`) REFERENCES `tm_plant` (`plant_id`),
  CONSTRAINT `tm_plant_schedule_ibfk_5` FOREIGN KEY (`actype_id`) REFERENCES `tr_activity_type` (`actype_id`),
  CONSTRAINT `tm_plant_schedule_ibfk_6` FOREIGN KEY (`phase_id`) REFERENCES `tr_plant_phase` (`phase_id`),
  CONSTRAINT `tm_plant_schedule_ibfk_7` FOREIGN KEY (`unit_id`) REFERENCES `tr_unit` (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_plant_simulation` */

CREATE TABLE `tm_plant_simulation` (
  `sim_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `plant_id` varchar(32) NOT NULL,
  `var_id` varchar(32) DEFAULT NULL,
  `phase_id` varchar(32) DEFAULT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `sim_date` datetime DEFAULT NULL,
  `sim_model` varchar(16) DEFAULT NULL,
  `sim_model_ver` varchar(16) DEFAULT NULL,
  `sim_scenario` varchar(16) DEFAULT NULL,
  `sim_param` text DEFAULT NULL,
  `sim_cutoff_date` date DEFAULT NULL,
  `sim_forecast_until` date DEFAULT NULL,
  `sim_age_now` int(4) DEFAULT NULL,
  `sim_gdd_now` float DEFAULT NULL,
  `sim_harvest_date` date DEFAULT NULL,
  `sim_yield` float DEFAULT NULL,
  `sim_yield_low` float DEFAULT NULL,
  `sim_yield_high` float DEFAULT NULL,
  `sim_confidence` float DEFAULT NULL,
  `sim_note` varchar(255) DEFAULT NULL,
  `sim_is_latest` int(1) DEFAULT 0,
  `sim_sts` int(1) DEFAULT NULL,
  `sim_created` datetime DEFAULT NULL,
  PRIMARY KEY (`sim_id`),
  KEY `idx_sim_plant_latest` (`plant_id`,`sim_scenario`,`sim_is_latest`),
  KEY `idx_sim_date` (`sim_date`),
  KEY `tm_plant_simulation_ibfk_1` (`tenant_id`),
  KEY `tm_plant_simulation_ibfk_2` (`site_id`),
  KEY `tm_plant_simulation_ibfk_3` (`cluster_id`),
  KEY `tm_plant_simulation_ibfk_5` (`var_id`),
  KEY `tm_plant_simulation_ibfk_6` (`phase_id`),
  CONSTRAINT `tm_plant_simulation_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_plant_simulation_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_plant_simulation_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`),
  CONSTRAINT `tm_plant_simulation_ibfk_4` FOREIGN KEY (`plant_id`) REFERENCES `tm_plant` (`plant_id`),
  CONSTRAINT `tm_plant_simulation_ibfk_5` FOREIGN KEY (`var_id`) REFERENCES `tr_plant_variety` (`var_id`),
  CONSTRAINT `tm_plant_simulation_ibfk_6` FOREIGN KEY (`phase_id`) REFERENCES `tr_plant_phase` (`phase_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_refresh_token` */

CREATE TABLE `tm_refresh_token` (
  `rt_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`rt_id`),
  KEY `idx_rt_user` (`user_id`),
  KEY `idx_rt_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Table structure for table `tm_sensor_read` */

CREATE TABLE `tm_sensor_read` (
  `read_id` varchar(64) NOT NULL,
  `ds_id` varchar(32) DEFAULT NULL,
  `dev_id` varchar(32) DEFAULT NULL,
  `log_rx_id` varchar(32) DEFAULT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `read_date` datetime DEFAULT NULL,
  `read_value` varchar(128) DEFAULT NULL,
  `read_sts` int(1) DEFAULT NULL,
  PRIMARY KEY (`read_id`),
  KEY `idx_sensor_read_date` (`read_date`),
  KEY `idx_sensor_read_ds` (`ds_id`),
  KEY `tm_sensor_read_ibfk_1` (`tenant_id`),
  KEY `tm_sensor_read_ibfk_2` (`cluster_id`),
  CONSTRAINT `tm_sensor_read_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_sensor_read_ibfk_2` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_sensor_read_update` */

CREATE TABLE `tm_sensor_read_update` (
  `read_update_id` varchar(64) NOT NULL,
  `ds_id` varchar(32) DEFAULT NULL,
  `dev_id` varchar(32) DEFAULT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `read_update_date` datetime DEFAULT NULL,
  `read_update_value` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`read_update_id`),
  KEY `tm_sensor_read_update_ibfk_1` (`tenant_id`),
  KEY `tm_sensor_read_update_ibfk_2` (`cluster_id`),
  CONSTRAINT `tm_sensor_read_update_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_sensor_read_update_ibfk_2` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_site` */

CREATE TABLE `tm_site` (
  `site_id` varchar(32) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_name` varchar(64) NOT NULL,
  `site_type` varchar(16) DEFAULT NULL,
  `site_address` varchar(128) DEFAULT NULL,
  `site_lon` double DEFAULT NULL,
  `site_lat` double DEFAULT NULL,
  `site_alt` double DEFAULT NULL,
  `site_sts` int(1) DEFAULT NULL,
  `site_created` datetime DEFAULT NULL,
  `site_update` datetime DEFAULT NULL,
  PRIMARY KEY (`site_id`),
  KEY `idx_site_tenant` (`tenant_id`),
  CONSTRAINT `tm_site_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_site_media` */

CREATE TABLE `tm_site_media` (
  `media_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `plant_id` varchar(32) DEFAULT NULL,
  `pact_id` varchar(64) DEFAULT NULL,
  `obs_id` varchar(64) DEFAULT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `media_type` varchar(16) DEFAULT NULL,
  `media_path` varchar(255) DEFAULT NULL,
  `media_desc` varchar(255) DEFAULT NULL,
  `media_lon` double DEFAULT NULL,
  `media_lat` double DEFAULT NULL,
  `media_date` datetime DEFAULT NULL,
  PRIMARY KEY (`media_id`),
  KEY `tm_site_media_ibfk_1` (`tenant_id`),
  KEY `tm_site_media_ibfk_2` (`site_id`),
  KEY `tm_site_media_ibfk_3` (`cluster_id`),
  KEY `tm_site_media_ibfk_4` (`user_id`),
  KEY `tm_site_media_ibfk_5` (`plant_id`),
  KEY `tm_site_media_ibfk_6` (`pact_id`),
  KEY `tm_site_media_ibfk_7` (`obs_id`),
  CONSTRAINT `tm_site_media_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_site_media_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_site_media_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`),
  CONSTRAINT `tm_site_media_ibfk_5` FOREIGN KEY (`plant_id`) REFERENCES `tm_plant` (`plant_id`),
  CONSTRAINT `tm_site_media_ibfk_6` FOREIGN KEY (`pact_id`) REFERENCES `tm_plant_activity` (`pact_id`),
  CONSTRAINT `tm_site_media_ibfk_7` FOREIGN KEY (`obs_id`) REFERENCES `tm_plant_observation` (`obs_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_soil_profile` */

CREATE TABLE `tm_soil_profile` (
  `soil_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_id` varchar(32) DEFAULT NULL,
  `plant_id` varchar(32) DEFAULT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `soil_sample_code` varchar(64) DEFAULT NULL,
  `soil_sample_date` date DEFAULT NULL,
  `soil_depth_top` int(4) DEFAULT NULL,
  `soil_depth_bottom` int(4) DEFAULT NULL,
  `soil_lab` varchar(128) DEFAULT NULL,
  `soil_type` varchar(64) DEFAULT NULL,
  `soil_texture` varchar(32) DEFAULT NULL,
  `soil_sand` float DEFAULT NULL,
  `soil_silt` float DEFAULT NULL,
  `soil_clay` float DEFAULT NULL,
  `soil_ph_h2o` float DEFAULT NULL,
  `soil_ph_kcl` float DEFAULT NULL,
  `soil_c_org` float DEFAULT NULL,
  `soil_n_total` float DEFAULT NULL,
  `soil_p_avail` float DEFAULT NULL,
  `soil_p_method` varchar(16) DEFAULT NULL,
  `soil_k_exch` float DEFAULT NULL,
  `soil_ca_exch` float DEFAULT NULL,
  `soil_mg_exch` float DEFAULT NULL,
  `soil_cec` float DEFAULT NULL,
  `soil_base_sat` float DEFAULT NULL,
  `soil_ec` float DEFAULT NULL,
  `soil_bulk_density` float DEFAULT NULL,
  `soil_fc` float DEFAULT NULL,
  `soil_wp` float DEFAULT NULL,
  `soil_drainage` varchar(16) DEFAULT NULL,
  `soil_land_class` varchar(8) DEFAULT NULL,
  `soil_lon` double DEFAULT NULL,
  `soil_lat` double DEFAULT NULL,
  `soil_doc` varchar(255) DEFAULT NULL,
  `soil_desc` varchar(255) DEFAULT NULL,
  `soil_sts` int(1) DEFAULT NULL,
  `soil_created` datetime DEFAULT NULL,
  `soil_update` datetime DEFAULT NULL,
  PRIMARY KEY (`soil_id`),
  KEY `idx_soil_date` (`soil_sample_date`),
  KEY `tm_soil_profile_ibfk_1` (`tenant_id`),
  KEY `tm_soil_profile_ibfk_2` (`site_id`),
  KEY `tm_soil_profile_ibfk_3` (`cluster_id`),
  KEY `tm_soil_profile_ibfk_4` (`plant_id`),
  CONSTRAINT `tm_soil_profile_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_soil_profile_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_soil_profile_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`),
  CONSTRAINT `tm_soil_profile_ibfk_4` FOREIGN KEY (`plant_id`) REFERENCES `tm_plant` (`plant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_tenant` */

CREATE TABLE `tm_tenant` (
  `tenant_id` varchar(32) NOT NULL,
  `tenant_name` varchar(128) NOT NULL,
  `tenant_type` varchar(32) DEFAULT NULL,
  `tenant_address` varchar(255) DEFAULT NULL,
  `tenant_pic` varchar(128) DEFAULT NULL,
  `tenant_contact` varchar(64) DEFAULT NULL,
  `tenant_logo` varchar(255) DEFAULT NULL,
  `tenant_sts` varchar(2) DEFAULT NULL,
  `tenant_created` datetime DEFAULT NULL,
  `tenant_update` datetime DEFAULT NULL,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_user` */

CREATE TABLE `tm_user` (
  `user_id` varchar(50) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `user_name` varchar(64) DEFAULT NULL,
  `user_pass` varchar(128) DEFAULT NULL,
  `user_email` varchar(128) DEFAULT NULL,
  `user_phone` varchar(64) DEFAULT NULL,
  `user_role` varchar(32) DEFAULT NULL,
  `user_level` int(11) DEFAULT NULL,
  `user_sts` varchar(32) DEFAULT NULL,
  `user_created` datetime DEFAULT NULL,
  `user_update` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  KEY `idx_user_tenant` (`tenant_id`),
  CONSTRAINT `tm_user_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_weather` */

CREATE TABLE `tm_weather` (
  `weather_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `weather_date` datetime DEFAULT NULL,
  `weather_type` varchar(16) DEFAULT 'OBSERVED',
  `weather_period` varchar(8) DEFAULT NULL,
  `weather_issued` datetime DEFAULT NULL,
  `temperature` float DEFAULT NULL,
  `weather_temp_min` float DEFAULT NULL,
  `weather_temp_max` float DEFAULT NULL,
  `humidity` float DEFAULT NULL,
  `rainfall` float DEFAULT NULL,
  `wind_speed` float DEFAULT NULL,
  `weather_radiation` float DEFAULT NULL,
  `weather_condition` varchar(64) DEFAULT NULL,
  `weather_source` varchar(64) DEFAULT NULL,
  `weather_created` datetime DEFAULT NULL,
  PRIMARY KEY (`weather_id`),
  KEY `tm_weather_ibfk_1` (`tenant_id`),
  KEY `tm_weather_ibfk_2` (`site_id`),
  KEY `idx_weather_site_date` (`site_id`,`weather_date`,`weather_type`),
  CONSTRAINT `tm_weather_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_weather_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tm_weather_daily` */

CREATE TABLE `tm_weather_daily` (
  `wd_id` varchar(64) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) NOT NULL,
  `dev_id` varchar(32) DEFAULT NULL,
  `wd_date` date NOT NULL,
  `wd_type` varchar(16) NOT NULL,
  `wd_tmin` float DEFAULT NULL,
  `wd_tmax` float DEFAULT NULL,
  `wd_tmean` float DEFAULT NULL,
  `wd_rh_mean` float DEFAULT NULL,
  `wd_rain` float DEFAULT NULL,
  `wd_wind_mean` float DEFAULT NULL,
  `wd_radiation` float DEFAULT NULL,
  `wd_lux_mean` float DEFAULT NULL,
  `wd_et0` float DEFAULT NULL,
  `wd_gdd` float DEFAULT NULL,
  `wd_source` varchar(16) DEFAULT NULL,
  `wd_sample` int(11) DEFAULT NULL,
  `wd_complete` float DEFAULT NULL,
  `wd_issued` datetime DEFAULT NULL,
  `wd_created` datetime DEFAULT NULL,
  `wd_update` datetime DEFAULT NULL,
  PRIMARY KEY (`wd_id`),
  UNIQUE KEY `uq_wd_site_date_type` (`site_id`,`wd_date`,`wd_type`),
  KEY `idx_wd_date` (`wd_date`),
  KEY `tm_weather_daily_ibfk_1` (`tenant_id`),
  KEY `tm_weather_daily_ibfk_3` (`dev_id`),
  CONSTRAINT `tm_weather_daily_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_weather_daily_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_weather_daily_ibfk_3` FOREIGN KEY (`dev_id`) REFERENCES `tm_device` (`dev_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tr_activity_type` */

CREATE TABLE `tr_activity_type` (
  `actype_id` varchar(32) NOT NULL,
  `ptype_id` varchar(32) DEFAULT NULL,
  `actype_name` varchar(64) NOT NULL,
  `actype_category` varchar(32) DEFAULT NULL,
  `unit_id` varchar(32) DEFAULT NULL,
  `actype_need_photo` int(1) DEFAULT 0,
  `actype_desc` varchar(255) DEFAULT NULL,
  `actype_sts` int(1) DEFAULT NULL,
  `actype_update` datetime DEFAULT NULL,
  PRIMARY KEY (`actype_id`),
  KEY `tr_activity_type_ibfk_1` (`ptype_id`),
  KEY `tr_activity_type_ibfk_2` (`unit_id`),
  CONSTRAINT `tr_activity_type_ibfk_1` FOREIGN KEY (`ptype_id`) REFERENCES `tr_plant_type` (`ptype_id`),
  CONSTRAINT `tr_activity_type_ibfk_2` FOREIGN KEY (`unit_id`) REFERENCES `tr_unit` (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tr_alarm_code` */

CREATE TABLE `tr_alarm_code` (
  `alcode_id` varchar(32) NOT NULL,
  `alcode_note` varchar(128) DEFAULT NULL,
  `alcode_sts` int(1) DEFAULT NULL,
  `alcode_update` datetime DEFAULT NULL,
  PRIMARY KEY (`alcode_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tr_kode_telemetri` */

CREATE TABLE `tr_kode_telemetri` (
  `kt_id` varchar(64) NOT NULL,
  `kt_name` varchar(64) DEFAULT NULL,
  `kt_norm_value` varchar(32) DEFAULT NULL,
  `kt_min_value` varchar(32) DEFAULT NULL,
  `kt_max_value` varchar(32) DEFAULT NULL,
  `kt_min_value_warn` varchar(32) DEFAULT NULL,
  `kt_max_value_warn` varchar(32) DEFAULT NULL,
  `kt_sts` int(1) DEFAULT NULL,
  PRIMARY KEY (`kt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tr_material` */

CREATE TABLE `tr_material` (
  `mat_id` varchar(32) NOT NULL,
  `mat_name` varchar(64) NOT NULL,
  `mat_category` varchar(32) DEFAULT NULL,
  `mat_brand` varchar(64) DEFAULT NULL,
  `mat_active` varchar(128) DEFAULT NULL,
  `mat_conc` varchar(32) DEFAULT NULL,
  `mat_n` float DEFAULT NULL,
  `mat_p2o5` float DEFAULT NULL,
  `mat_k2o` float DEFAULT NULL,
  `mat_mgo` float DEFAULT NULL,
  `mat_cao` float DEFAULT NULL,
  `mat_s` float DEFAULT NULL,
  `mat_b` float DEFAULT NULL,
  `mat_c_org` float DEFAULT NULL,
  `unit_id` varchar(32) DEFAULT NULL,
  `mat_desc` varchar(255) DEFAULT NULL,
  `mat_sts` int(1) DEFAULT NULL,
  `mat_update` datetime DEFAULT NULL,
  PRIMARY KEY (`mat_id`),
  KEY `idx_mat_category` (`mat_category`),
  KEY `tr_material_ibfk_1` (`unit_id`),
  CONSTRAINT `tr_material_ibfk_1` FOREIGN KEY (`unit_id`) REFERENCES `tr_unit` (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tr_plant_phase` */

CREATE TABLE `tr_plant_phase` (
  `phase_id` varchar(32) NOT NULL,
  `ptype_id` varchar(32) DEFAULT NULL,
  `phase_name` varchar(64) NOT NULL,
  `phase_code` varchar(16) DEFAULT NULL,
  `phase_seq` int(4) DEFAULT NULL,
  `phase_start_age` int(4) DEFAULT NULL,
  `phase_end_age` int(4) DEFAULT NULL,
  `phase_color` varchar(16) DEFAULT NULL,
  `phase_desc` varchar(255) DEFAULT NULL,
  `phase_sts` int(1) DEFAULT NULL,
  `phase_update` datetime DEFAULT NULL,
  PRIMARY KEY (`phase_id`),
  KEY `idx_phase_ptype` (`ptype_id`,`phase_seq`),
  CONSTRAINT `tr_plant_phase_ibfk_1` FOREIGN KEY (`ptype_id`) REFERENCES `tr_plant_type` (`ptype_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tr_plant_type` */

CREATE TABLE `tr_plant_type` (
  `ptype_id` varchar(32) NOT NULL,
  `ptype_name` varchar(64) NOT NULL,
  `ptype_latin` varchar(128) DEFAULT NULL,
  `ptype_category` varchar(32) DEFAULT NULL,
  `ptype_lifespan` int(4) DEFAULT NULL,
  `ptype_age_unit` varchar(8) DEFAULT 'MONTH',
  `ptype_spacing` varchar(32) DEFAULT NULL,
  `ptype_density` int(11) DEFAULT NULL,
  `ptype_icon` varchar(128) DEFAULT NULL,
  `ptype_desc` varchar(255) DEFAULT NULL,
  `ptype_sts` int(1) DEFAULT NULL,
  `ptype_update` datetime DEFAULT NULL,
  PRIMARY KEY (`ptype_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tr_plant_variety` */

CREATE TABLE `tr_plant_variety` (
  `var_id` varchar(32) NOT NULL,
  `ptype_id` varchar(32) NOT NULL,
  `var_name` varchar(64) NOT NULL,
  `var_code` varchar(32) DEFAULT NULL,
  `var_origin` varchar(128) DEFAULT NULL,
  `var_release_year` int(4) DEFAULT NULL,
  `var_maturity` int(4) DEFAULT NULL,
  `var_nursery_age` int(4) DEFAULT NULL,
  `var_tbase` float DEFAULT NULL,
  `var_topt` float DEFAULT NULL,
  `var_tmax` float DEFAULT NULL,
  `var_yield_potential` float DEFAULT NULL,
  `var_yield_avg` float DEFAULT NULL,
  `unit_id` varchar(32) DEFAULT NULL,
  `var_resistance` varchar(255) DEFAULT NULL,
  `var_desc` varchar(255) DEFAULT NULL,
  `var_sts` int(1) DEFAULT NULL,
  `var_update` datetime DEFAULT NULL,
  PRIMARY KEY (`var_id`),
  KEY `tr_plant_variety_ibfk_1` (`ptype_id`),
  KEY `tr_plant_variety_ibfk_2` (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Table structure for table `tr_unit` */

CREATE TABLE `tr_unit` (
  `unit_id` varchar(32) NOT NULL,
  `unit_name` varchar(64) DEFAULT NULL,
  `unit_symbol` varchar(8) DEFAULT NULL,
  `unit_sts` int(1) DEFAULT NULL,
  `unit_update` datetime DEFAULT NULL,
  PRIMARY KEY (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/* Trigger structure for table `tm_sensor_read` */

DELIMITER $$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `trg_sensor_read_update` AFTER INSERT ON `tm_sensor_read` FOR EACH ROW BEGIN
 	DECLARE e_dev_id VARCHAR(32) ;
	DECLARE e_ds_id VARCHAR(32) ;
	DECLARE e_read_value VARCHAR(128) ;
	DECLARE n_ds_min_val_warn, n_ds_max_val_warn, n_ds_min_norm_value , n_ds_max_norm_value DOUBLE ; 
	DECLARE alm_code VARCHAR(64) ; 
	
	/* Update nilai terakhir */
	SELECT dev_id , ds_id INTO e_dev_id,e_ds_id FROM tm_sensor_read_update 
		WHERE ds_id = NEW.ds_id AND dev_id = NEW.dev_id AND tenant_id = NEW.tenant_id AND cluster_id = NEW.cluster_id;
 	IF (e_dev_id <> "" AND e_ds_id <> "" ) THEN
		UPDATE tm_sensor_read_update SET  read_update_id = NEW.read_id, read_update_value = NEW.read_value, read_update_date = new.read_date 
		WHERE  ds_id = e_ds_id AND dev_id = e_dev_id ;
	ELSE
		INSERT INTO tm_sensor_read_update (read_update_id,ds_id,dev_id,tenant_id,cluster_id,read_update_date,read_update_value)
			VALUES (NEW.read_id,NEW.ds_id, NEW.dev_id,NEW.tenant_id, NEW.cluster_id,NEW.read_date,NEW.read_value) ;
	END IF ;
	/* Cek alarm */
	SELECT ds_min_val_warn, ds_max_val_warn, ds_min_norm_value , ds_max_norm_value INTO n_ds_min_val_warn, n_ds_max_val_warn, n_ds_min_norm_value , n_ds_max_norm_value
		FROM td_device_sensor 
		WHERE dev_id = NEW.dev_id AND ds_id = NEW.ds_id  ;
	SET alm_code = "" ; 	
	IF ( NEW.read_value < n_ds_min_val_warn ) THEN 
		SET alm_code = 'ALARM-WARN-LOW' ;
	END IF ;
	IF ( NEW.read_value > n_ds_max_val_warn ) THEN 
		SET alm_code = 'ALARM-WARN-HIGH' ;
	END IF ;	
	IF (NEW.read_value <=  n_ds_min_norm_value) THEN 
		SET alm_code = 'ALARM-LOW' ;
	END IF ;
	IF (NEW.read_value >= n_ds_max_norm_value) THEN 
		SET alm_code = 'ALARM-HIGH' ;
	END IF ;
	
	IF (alm_code <> "" ) THEN 
		INSERT INTO tm_alarm(alm_id,alcode_id,read_id,alm_date) VALUES ( UUID() ,alm_code,NEW.read_id,NOW()) ;
	END IF ;	  
    END */$$


DELIMITER ;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
