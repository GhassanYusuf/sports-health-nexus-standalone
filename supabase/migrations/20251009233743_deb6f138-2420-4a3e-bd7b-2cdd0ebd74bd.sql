-- Drop the public SELECT policy on bank_accounts table
-- This restricts access to admins only (via the existing "Admins can manage bank accounts" policy)
DROP POLICY IF EXISTS "Anyone can view bank accounts" ON public.bank_accounts;