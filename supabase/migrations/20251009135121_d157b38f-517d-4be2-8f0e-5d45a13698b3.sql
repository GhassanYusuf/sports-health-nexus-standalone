-- Add owner_contact_code column to clubs table
ALTER TABLE public.clubs 
ADD COLUMN owner_contact_code text;