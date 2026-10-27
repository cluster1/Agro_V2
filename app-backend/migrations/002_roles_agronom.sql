-- Migration: role set becomes admin / tenant_admin / operator / agronom.
-- Legacy farmer/investor/viewer accounts fall back to operator (level 2).
UPDATE `tm_user`
   SET `user_role` = 'operator', `user_level` = 2
 WHERE `user_role` IN ('farmer', 'investor', 'viewer');
