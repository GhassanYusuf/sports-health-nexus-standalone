-- Add receipt-related fields to clubs table
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS commercial_registration_number TEXT,
ADD COLUMN IF NOT EXISTS vat_registration_number TEXT,
ADD COLUMN IF NOT EXISTS vat_percentage NUMERIC DEFAULT 0;