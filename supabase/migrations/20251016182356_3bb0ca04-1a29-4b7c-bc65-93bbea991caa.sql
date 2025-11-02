-- Step 1: Add business_owner to app_role enum (separate transaction)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'business_owner';