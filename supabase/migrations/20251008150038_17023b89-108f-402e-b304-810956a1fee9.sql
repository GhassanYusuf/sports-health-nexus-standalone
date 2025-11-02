-- Add missing fields to clubs table
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS slogan TEXT,
ADD COLUMN IF NOT EXISTS slogan_explanation TEXT,
ADD COLUMN IF NOT EXISTS club_email TEXT,
ADD COLUMN IF NOT EXISTS club_phone TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS club_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_iban TEXT,
ADD COLUMN IF NOT EXISTS bank_swift_code TEXT,
ADD COLUMN IF NOT EXISTS member_code_prefix TEXT DEFAULT 'MEM',
ADD COLUMN IF NOT EXISTS invoice_code_prefix TEXT DEFAULT 'INV',
ADD COLUMN IF NOT EXISTS receipt_code_prefix TEXT DEFAULT 'REC',
ADD COLUMN IF NOT EXISTS expense_code_prefix TEXT DEFAULT 'EXP',
ADD COLUMN IF NOT EXISTS specialist_code_prefix TEXT DEFAULT 'SPEC',
ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- Create index on club_slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_clubs_slug ON public.clubs(club_slug);