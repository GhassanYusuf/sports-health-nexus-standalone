-- Fix profiles table public exposure security issue
-- Drop the overly permissive policy that allows anyone to view all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create policy for users to view only their own profile data
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy for admins to view all profiles for management purposes
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));