-- Phase 1: Update transaction_ledger table with payment management fields
ALTER TABLE public.transaction_ledger 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'rejected')),
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS is_refund BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC,
ADD COLUMN IF NOT EXISTS refunded_transaction_id UUID REFERENCES public.transaction_ledger(id),
ADD COLUMN IF NOT EXISTS refund_proof_url TEXT,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS change_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS member_name TEXT,
ADD COLUMN IF NOT EXISTS member_email TEXT,
ADD COLUMN IF NOT EXISTS member_phone TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transaction_ledger_payment_status ON public.transaction_ledger(payment_status);
CREATE INDEX IF NOT EXISTS idx_transaction_ledger_approved_at ON public.transaction_ledger(approved_at);
CREATE INDEX IF NOT EXISTS idx_transaction_ledger_club_status ON public.transaction_ledger(club_id, payment_status);

-- Phase 2: Create transaction_history table for audit trail
CREATE TABLE IF NOT EXISTS public.transaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transaction_ledger(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'approved', 'rejected', 'refunded')),
  previous_values JSONB,
  new_values JSONB,
  notes TEXT
);

-- Enable RLS on transaction_history
ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage transaction history
CREATE POLICY "Admins can manage transaction history"
ON public.transaction_history FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_transaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_transaction_ledger_updated_at
BEFORE UPDATE ON public.transaction_ledger
FOR EACH ROW
EXECUTE FUNCTION public.update_transaction_updated_at();