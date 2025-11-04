-- Add soft delete column to transaction_ledger table
ALTER TABLE transaction_ledger
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for better query performance on non-deleted records
CREATE INDEX IF NOT EXISTS idx_transaction_ledger_deleted_at
ON transaction_ledger(deleted_at)
WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN transaction_ledger.deleted_at IS 'Timestamp when the transaction was soft deleted. NULL means not deleted.';
