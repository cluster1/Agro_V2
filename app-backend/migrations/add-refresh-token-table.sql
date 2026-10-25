-- Migration: refresh token store (rotation + revocation)
-- Description: one row per issued refresh token (jti). Only a SHA-256 hash of the
--              token is stored. Run ONCE before deploying the matching backend build.

CREATE TABLE IF NOT EXISTS `tm_refresh_token` (
  `rt_id`      VARCHAR(36)  NOT NULL,            -- JWT jti
  `user_id`    VARCHAR(36)  NOT NULL,
  `token_hash` CHAR(64)     NOT NULL,            -- sha256 hex of the refresh JWT
  `expires_at` DATETIME     NOT NULL,
  `revoked_at` DATETIME     NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`rt_id`),
  KEY `idx_rt_user` (`user_id`),
  KEY `idx_rt_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
