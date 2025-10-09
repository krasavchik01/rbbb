-- Add new values to existing app_role enum
ALTER TYPE app_role ADD VALUE 'admin';
ALTER TYPE app_role ADD VALUE 'manager';
ALTER TYPE app_role ADD VALUE 'employee';
ALTER TYPE app_role ADD VALUE 'it_admin';