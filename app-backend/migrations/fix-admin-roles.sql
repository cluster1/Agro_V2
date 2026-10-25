-- Migration: Fix admin user_role for existing users
-- Date: 2025-10-21
-- Description: Ensure all users with user_level = 0 have user_role = 'admin'

-- Update existing admin users
UPDATE tm_user 
SET user_role = 'admin' 
WHERE user_level = 0 AND (user_role IS NULL OR user_role != 'admin');

-- Verify the changes
SELECT 
    user_id,
    user_name,
    user_email,
    user_role,
    user_level,
    tenant_id
FROM tm_user 
WHERE user_level = 0;

-- Expected result: All users with user_level = 0 should have user_role = 'admin'
