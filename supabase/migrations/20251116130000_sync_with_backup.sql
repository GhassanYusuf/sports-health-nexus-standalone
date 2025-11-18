-- Sync migration with backup - ONLY ADDS, NO DROPS
-- This migration adds missing items from the backup without removing anything

-- Create recurring_expenses table if it doesn't exist
CREATE TABLE IF NOT EXISTS "public"."recurring_expenses" (
  "id" uuid not null default gen_random_uuid(),
  "club_id" uuid not null,
  "name" character varying(255) not null,
  "amount" numeric(10,2) not null,
  "category" character varying(50) not null default 'other'::character varying,
  "day_of_month" integer not null default 1,
  "description" text,
  "is_active" boolean not null default true,
  "last_processed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

-- Create indexes for recurring_expenses
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active
ON public.recurring_expenses USING btree (club_id, is_active)
WHERE (is_active = true);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_club_id
ON public.recurring_expenses USING btree (club_id);

CREATE UNIQUE INDEX IF NOT EXISTS recurring_expenses_pkey
ON public.recurring_expenses USING btree (id);

-- Create unique index for transaction_ledger (club_id, receipt_number combination)
CREATE UNIQUE INDEX IF NOT EXISTS transaction_ledger_club_receipt_key
ON public.transaction_ledger USING btree (club_id, receipt_number);

-- Create unique index for profiles phone (only non-null, non-empty phones)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
ON public.profiles USING btree (phone)
WHERE ((phone IS NOT NULL) AND (phone <> ''::text));

-- Add primary key constraint to recurring_expenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recurring_expenses_pkey'
  ) THEN
    ALTER TABLE "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY USING INDEX "recurring_expenses_pkey";
  END IF;
END $$;

-- Add check constraints to recurring_expenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recurring_expenses_amount_check'
  ) THEN
    ALTER TABLE "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_amount_check" CHECK ((amount >= (0)::numeric));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recurring_expenses_club_id_fkey'
  ) THEN
    ALTER TABLE "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_club_id_fkey"
    FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recurring_expenses_day_of_month_check'
  ) THEN
    ALTER TABLE "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_day_of_month_check"
    CHECK (((day_of_month >= 1) AND (day_of_month <= 30)));
  END IF;
END $$;

-- Add unique constraint to transaction_ledger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transaction_ledger_club_receipt_key'
  ) THEN
    ALTER TABLE "public"."transaction_ledger"
    ADD CONSTRAINT "transaction_ledger_club_receipt_key"
    UNIQUE USING INDEX "transaction_ledger_club_receipt_key";
  END IF;
END $$;

-- Create function for updating recurring_expenses timestamp
CREATE OR REPLACE FUNCTION public.update_recurring_expenses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Grant permissions on recurring_expenses table
GRANT DELETE ON TABLE "public"."recurring_expenses" TO "anon";
GRANT INSERT ON TABLE "public"."recurring_expenses" TO "anon";
GRANT REFERENCES ON TABLE "public"."recurring_expenses" TO "anon";
GRANT SELECT ON TABLE "public"."recurring_expenses" TO "anon";
GRANT TRIGGER ON TABLE "public"."recurring_expenses" TO "anon";
GRANT TRUNCATE ON TABLE "public"."recurring_expenses" TO "anon";
GRANT UPDATE ON TABLE "public"."recurring_expenses" TO "anon";

GRANT DELETE ON TABLE "public"."recurring_expenses" TO "authenticated";
GRANT INSERT ON TABLE "public"."recurring_expenses" TO "authenticated";
GRANT REFERENCES ON TABLE "public"."recurring_expenses" TO "authenticated";
GRANT SELECT ON TABLE "public"."recurring_expenses" TO "authenticated";
GRANT TRIGGER ON TABLE "public"."recurring_expenses" TO "authenticated";
GRANT TRUNCATE ON TABLE "public"."recurring_expenses" TO "authenticated";
GRANT UPDATE ON TABLE "public"."recurring_expenses" TO "authenticated";

GRANT DELETE ON TABLE "public"."recurring_expenses" TO "service_role";
GRANT INSERT ON TABLE "public"."recurring_expenses" TO "service_role";
GRANT REFERENCES ON TABLE "public"."recurring_expenses" TO "service_role";
GRANT SELECT ON TABLE "public"."recurring_expenses" TO "service_role";
GRANT TRIGGER ON TABLE "public"."recurring_expenses" TO "service_role";
GRANT TRUNCATE ON TABLE "public"."recurring_expenses" TO "service_role";
GRANT UPDATE ON TABLE "public"."recurring_expenses" TO "service_role";

-- Create policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'club_members'
    AND policyname = 'Admins can create club members'
  ) THEN
    CREATE POLICY "Admins can create club members"
    ON "public"."club_members"
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'package_enrollments'
    AND policyname = 'Admins can manage package enrollments'
  ) THEN
    CREATE POLICY "Admins can manage package enrollments"
    ON "public"."package_enrollments"
    AS PERMISSIVE
    FOR ALL
    TO public
    USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'recurring_expenses'
    AND policyname = 'Business owners can manage recurring expenses'
  ) THEN
    CREATE POLICY "Business owners can manage recurring expenses"
    ON "public"."recurring_expenses"
    AS PERMISSIVE
    FOR ALL
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.clubs
      WHERE ((clubs.id = recurring_expenses.club_id) AND (clubs.business_owner_id = auth.uid())))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.clubs
      WHERE ((clubs.id = recurring_expenses.club_id) AND (clubs.business_owner_id = auth.uid())))));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'recurring_expenses'
    AND policyname = 'Users can view recurring expenses for their clubs'
  ) THEN
    CREATE POLICY "Users can view recurring expenses for their clubs"
    ON "public"."recurring_expenses"
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (((EXISTS ( SELECT 1
       FROM public.club_members
      WHERE ((club_members.club_id = recurring_expenses.club_id) AND (club_members.user_id = auth.uid()) AND (club_members.is_active = true)))) OR (EXISTS ( SELECT 1
       FROM public.clubs
      WHERE ((clubs.id = recurring_expenses.club_id) AND (clubs.business_owner_id = auth.uid()))))));
  END IF;
END $$;

-- Create trigger for updating recurring_expenses timestamp
DROP TRIGGER IF EXISTS trigger_update_recurring_expenses_updated_at ON public.recurring_expenses;
CREATE TRIGGER trigger_update_recurring_expenses_updated_at
BEFORE UPDATE ON public.recurring_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_recurring_expenses_updated_at();
