-- Add payment_screenshot_url column to club_members table
ALTER TABLE club_members 
ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;