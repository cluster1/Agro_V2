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
  KEY `td_device_sensor_ibfk_4` (`cluster_id`)
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

/*Table structure for table `tm_cluster` */

CREATE TABLE `tm_cluster` (
  `cluster_id` varchar(32) NOT NULL,
  `tenant_id` varchar(32) DEFAULT NULL,
  `site_id` varchar(32) DEFAULT NULL,
  `cluster_name` varchar(64) NOT NULL,
  `cluster_type` varchar(32) DEFAULT NULL,
  `cluster_capacity` int(11) DEFAULT NULL,
  `cluster_current` int(11) DEFAULT NULL,
  `cluster_desc` varchar(255) DEFAULT NULL,
  `cluster_created` datetime DEFAULT NULL,
  `cluster_update` datetime DEFAULT NULL,
  PRIMARY KEY (`cluster_id`),
  KEY `idx_cluster_site` (`site_id`),
  KEY `tm_cluster_ibfk_1` (`tenant_id`),
  CONSTRAINT `tm_cluster_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_cluster_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`)
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
  `user_id` varchar(50) DEFAULT NULL,
  `media_type` varchar(16) DEFAULT NULL,
  `media_path` varchar(255) DEFAULT NULL,
  `media_desc` varchar(255) DEFAULT NULL,
  `media_date` datetime DEFAULT NULL,
  PRIMARY KEY (`media_id`),
  KEY `tm_site_media_ibfk_1` (`tenant_id`),
  KEY `tm_site_media_ibfk_2` (`site_id`),
  KEY `tm_site_media_ibfk_3` (`cluster_id`),
  KEY `tm_site_media_ibfk_4` (`user_id`),
  CONSTRAINT `tm_site_media_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_site_media_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`),
  CONSTRAINT `tm_site_media_ibfk_3` FOREIGN KEY (`cluster_id`) REFERENCES `tm_cluster` (`cluster_id`)
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
  `temperature` float DEFAULT NULL,
  `humidity` float DEFAULT NULL,
  `rainfall` float DEFAULT NULL,
  `wind_speed` float DEFAULT NULL,
  `weather_source` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`weather_id`),
  KEY `tm_weather_ibfk_1` (`tenant_id`),
  KEY `tm_weather_ibfk_2` (`site_id`),
  CONSTRAINT `tm_weather_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tm_tenant` (`tenant_id`),
  CONSTRAINT `tm_weather_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `tm_site` (`site_id`)
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
