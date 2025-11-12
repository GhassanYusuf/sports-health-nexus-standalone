-- Fix receipt number generation to handle large numbers and filter by prefix
CREATE OR REPLACE FUNCTION generate_receipt_number(p_club_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix TEXT;
  v_last_number BIGINT;
  v_new_number TEXT;
BEGIN
  SELECT receipt_code_prefix INTO v_prefix
  FROM public.clubs
  WHERE id = p_club_id;

  IF v_prefix IS NULL THEN
    v_prefix := 'REC';
  END IF;

  -- Only look at receipt numbers with the same prefix to avoid parsing auto-generated ones
  SELECT COALESCE(
    MAX(
      CASE
        WHEN receipt_number LIKE v_prefix || '-%'
        THEN CAST(SUBSTRING(receipt_number FROM '[0-9]+$') AS BIGINT)
        ELSE 0
      END
    ),
    0
  ) INTO v_last_number
  FROM public.transaction_ledger
  WHERE club_id = p_club_id
    AND receipt_number IS NOT NULL;

  v_new_number := v_prefix || '-' || LPAD((v_last_number + 1)::TEXT, 5, '0');

  RETURN v_new_number;
END;
$$;
