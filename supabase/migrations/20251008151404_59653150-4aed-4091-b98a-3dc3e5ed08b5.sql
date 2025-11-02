-- Add missing fields to activities table
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS max_capacity INTEGER,
ADD COLUMN IF NOT EXISTS cost_per_session NUMERIC,
ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS requires_prebooking BOOLEAN DEFAULT false;

-- Add missing fields to club_packages table
ALTER TABLE public.club_packages
ADD COLUMN IF NOT EXISTS discount_code TEXT,
ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS max_bookings INTEGER;