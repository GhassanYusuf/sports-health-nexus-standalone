-- Phase 1: Database Schema for VAT Configurability & Financial Ledger

-- 1.1 Create package_price_history table
CREATE TABLE public.package_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.club_packages(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  vat_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_package_price_history_package_id ON public.package_price_history(package_id);
CREATE INDEX idx_package_price_history_valid_dates ON public.package_price_history(package_id, valid_from, valid_until);

ALTER TABLE public.package_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view price history"
  ON public.package_price_history
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage price history"
  ON public.package_price_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'business_owner')
    )
  );

-- Migrate existing packages to have initial price history
INSERT INTO public.package_price_history (package_id, price, vat_percentage, valid_from, created_at)
SELECT 
  cp.id, 
  cp.price, 
  COALESCE(c.vat_percentage, 0),
  cp.created_at,
  cp.created_at
FROM public.club_packages cp
LEFT JOIN public.clubs c ON c.id = cp.club_id;

-- 1.2 Create transaction types and ledger table
CREATE TYPE public.transaction_type AS ENUM (
  'enrollment_fee',
  'package_fee', 
  'expense',
  'refund',
  'product_sale',
  'facility_rental'
);

CREATE TYPE public.expense_category AS ENUM (
  'rent',
  'utilities',
  'equipment',
  'salaries',
  'maintenance',
  'marketing',
  'insurance',
  'other'
);

CREATE TABLE public.transaction_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  
  transaction_type transaction_type NOT NULL,
  category expense_category,
  description TEXT NOT NULL,
  
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  vat_percentage_applied DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  
  payment_method TEXT,
  payment_screenshot_url TEXT,
  receipt_number TEXT UNIQUE,
  
  member_id UUID REFERENCES public.club_members(id) ON DELETE SET NULL,
  package_price_version_id UUID REFERENCES public.package_price_history(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.package_enrollments(id) ON DELETE SET NULL,
  reference_id UUID,
  
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  notes TEXT
);

CREATE INDEX idx_transaction_ledger_club_id ON public.transaction_ledger(club_id);
CREATE INDEX idx_transaction_ledger_date ON public.transaction_ledger(transaction_date);
CREATE INDEX idx_transaction_ledger_type ON public.transaction_ledger(transaction_type);
CREATE INDEX idx_transaction_ledger_member_id ON public.transaction_ledger(member_id);
CREATE INDEX idx_transaction_ledger_receipt ON public.transaction_ledger(receipt_number);

ALTER TABLE public.transaction_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ledger entries"
  ON public.transaction_ledger
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'business_owner')
    )
  );

CREATE POLICY "Club owners can view their club's ledger"
  ON public.transaction_ledger
  FOR SELECT
  USING (
    club_id IN (
      SELECT id FROM public.clubs WHERE business_owner_id = auth.uid()
    )
  );

-- 1.3 Update package_enrollments table
ALTER TABLE public.package_enrollments
ADD COLUMN IF NOT EXISTS package_price_version_id UUID REFERENCES public.package_price_history(id),
ADD COLUMN IF NOT EXISTS enrollment_transaction_id UUID REFERENCES public.transaction_ledger(id),
ADD COLUMN IF NOT EXISTS package_transaction_id UUID REFERENCES public.transaction_ledger(id);

CREATE INDEX IF NOT EXISTS idx_package_enrollments_price_version ON public.package_enrollments(package_price_version_id);

-- 1.4 Create receipt number generator function
CREATE OR REPLACE FUNCTION generate_receipt_number(p_club_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix TEXT;
  v_last_number INT;
  v_new_number TEXT;
BEGIN
  SELECT receipt_code_prefix INTO v_prefix
  FROM public.clubs
  WHERE id = p_club_id;
  
  IF v_prefix IS NULL THEN
    v_prefix := 'REC';
  END IF;
  
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(receipt_number FROM '[0-9]+$') AS INT)),
    0
  ) INTO v_last_number
  FROM public.transaction_ledger
  WHERE club_id = p_club_id
    AND receipt_number IS NOT NULL;
  
  v_new_number := v_prefix || '-' || LPAD((v_last_number + 1)::TEXT, 5, '0');
  
  RETURN v_new_number;
END;
$$;