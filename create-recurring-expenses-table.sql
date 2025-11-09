-- Create recurring_expenses table for auto expense management
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    day_of_month INTEGER NOT NULL DEFAULT 1 CHECK (day_of_month >= 1 AND day_of_month <= 30),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_club_id ON public.recurring_expenses(club_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON public.recurring_expenses(club_id, is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view recurring expenses for their clubs" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Business owners can manage recurring expenses" ON public.recurring_expenses;

-- Policy: Users can view recurring expenses for clubs they have access to
CREATE POLICY "Users can view recurring expenses for their clubs"
ON public.recurring_expenses
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_memberships
        WHERE club_memberships.club_id = recurring_expenses.club_id
        AND club_memberships.profile_id = auth.uid()
        AND club_memberships.status = 'active'
    )
    OR
    EXISTS (
        SELECT 1 FROM public.clubs
        WHERE clubs.id = recurring_expenses.club_id
        AND clubs.owner_id = auth.uid()
    )
);

-- Policy: Business owners and admins can manage recurring expenses
CREATE POLICY "Business owners can manage recurring expenses"
ON public.recurring_expenses
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.clubs
        WHERE clubs.id = recurring_expenses.club_id
        AND clubs.owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_recurring_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_recurring_expenses_updated_at ON public.recurring_expenses;

CREATE TRIGGER trigger_update_recurring_expenses_updated_at
    BEFORE UPDATE ON public.recurring_expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_recurring_expenses_updated_at();

-- Grant permissions
GRANT ALL ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;

COMMENT ON TABLE public.recurring_expenses IS 'Stores recurring monthly expenses that are automatically added to the transaction ledger';
COMMENT ON COLUMN public.recurring_expenses.day_of_month IS 'Day of the month when this expense should be processed (1-30)';
COMMENT ON COLUMN public.recurring_expenses.last_processed_at IS 'Timestamp of when this expense was last automatically processed';
