-- Add email column to profiles table for easier access
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing profiles with their email from auth.users
-- This is a one-time sync, future updates will be handled by the edge function