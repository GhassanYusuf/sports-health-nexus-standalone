-- Step 2: Add business_owner_id column and RLS policies

-- Add business_owner_id to clubs table
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS business_owner_id UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_clubs_business_owner_id 
ON clubs(business_owner_id);

-- Business owners can SELECT only their clubs
DROP POLICY IF EXISTS "Business owners can view their own clubs" ON clubs;
CREATE POLICY "Business owners can view their own clubs"
ON clubs FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'business_owner'::app_role) 
  AND business_owner_id = auth.uid()
);

-- Business owners can UPDATE only their clubs
DROP POLICY IF EXISTS "Business owners can update their own clubs" ON clubs;
CREATE POLICY "Business owners can update their own clubs"
ON clubs FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'business_owner'::app_role) 
  AND business_owner_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'business_owner'::app_role) 
  AND business_owner_id = auth.uid()
);

-- Business owners can INSERT new clubs (with their own ID)
DROP POLICY IF EXISTS "Business owners can create clubs" ON clubs;
CREATE POLICY "Business owners can create clubs"
ON clubs FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'business_owner'::app_role) 
  AND business_owner_id = auth.uid()
);