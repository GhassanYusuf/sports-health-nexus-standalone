# Auto Recurring Expense Setup Guide

## Overview
The Auto Expense feature allows you to configure recurring monthly expenses (like rent, electricity, internet) that automatically get added to your transaction ledger at specified times each month.

## Features
- ✅ Set up recurring monthly expenses
- ✅ Configure amount, category, and processing day
- ✅ Automatically marked as "paid" when processed
- ✅ Manual "Process Now" option for immediate processing
- ✅ View, edit, and delete recurring expenses
- ✅ Tracks last processed date to prevent duplicates

## Setup Instructions

### Step 1: Create Database Table

Run the following SQL in your Supabase SQL Editor:

```bash
# Navigate to: https://supabase.com/dashboard/project/[your-project]/sql/new
# Or for local: http://127.0.0.1:54323/project/default/sql/new
```

Copy and execute the SQL from: `create-recurring-expenses-table.sql`

This will create:
- `recurring_expenses` table
- Indexes for performance
- Row Level Security policies
- Triggers for updated_at timestamp

### Step 2: Deploy Edge Function

Deploy the Edge Function to process recurring expenses:

```bash
# For Cloud Supabase
npx supabase functions deploy process-recurring-expense

# For Local Development
npx supabase functions serve process-recurring-expense
```

### Step 3: Test the Feature

1. Navigate to Admin Panel → Financial Management
2. Click "Auto Expense" button
3. Add a test recurring expense:
   - Name: "Test - Office Rent"
   - Amount: 10 BHD
   - Category: Rent
   - Day of Month: 1st
   - Description: "Monthly office rent"
4. Click "Process Now" to test
5. Check Transaction Ledger - you should see a new expense entry

## Usage

### Adding a Recurring Expense

1. Go to **Admin Panel** → **Financial Management**
2. Click **"Auto Expense"** button
3. Fill in the form:
   - **Name**: e.g., "Office Rent", "Electricity Bill"
   - **Amount**: Monthly amount in your club's currency
   - **Category**: Select appropriate category
   - **Day of Month**: When to process (1st = end of previous month)
   - **Description**: Optional notes
4. Click **"Add Auto Expense"**

### Managing Recurring Expenses

**Edit**: Click the "Edit" button on any recurring expense to modify its details.

**Process Now**: Click "Process Now" to immediately add the expense to the ledger (useful for testing or manual processing).

**Delete**: Click the trash icon to deactivate a recurring expense (won't affect existing transactions).

### How It Works

1. **Manual Processing**: Click "Process Now" to immediately create a transaction
2. **Automatic Processing** (Future): Set up a cron job to automatically process expenses

When processed, the system:
- ✅ Creates a new transaction in `transaction_ledger`
- ✅ Sets payment_status to "paid"
- ✅ Subtracts from cash balance
- ✅ Adds to expenses in financial reports
- ✅ Updates last_processed_at timestamp
- ✅ Generates unique receipt number (EXP-AUTO-XXXXX)

## Categories Available

- **Utilities**: Electricity, water, gas
- **Rent**: Office/facility rent
- **Salaries**: Staff salaries
- **Maintenance**: Repairs and maintenance
- **Insurance**: Insurance premiums
- **Other**: Miscellaneous expenses

## Important Notes

### Cash Flow Impact
When a recurring expense is processed:
- ✅ Adds to **Total Expenses**
- ✅ Subtracts from **Net Income**
- ✅ Subtracts from **Cash** (since marked as paid)

### Transaction Details
Auto-generated transactions include:
- Transaction Type: `expense`
- Payment Status: `paid`
- Payment Method: `auto`
- Description: "Auto: [Expense Name] - [Description]"
- Receipt Number: `EXP-AUTO-[timestamp]-[random]`

### Preventing Duplicates
- The system tracks `last_processed_at` timestamp
- Manual "Process Now" can be clicked multiple times (creates multiple transactions)
- Future: Automatic processing will check this timestamp to prevent duplicates

## Setting Up Automatic Processing (Optional)

To automatically process expenses at the end of each month, you can set up a cron job:

### Option 1: Supabase Cron (Recommended)

Create a database function and schedule it:

```sql
-- Create a function to process all due recurring expenses
CREATE OR REPLACE FUNCTION process_due_recurring_expenses()
RETURNS void AS $$
DECLARE
  expense RECORD;
BEGIN
  FOR expense IN
    SELECT * FROM recurring_expenses
    WHERE is_active = true
    AND (
      last_processed_at IS NULL
      OR last_processed_at < date_trunc('month', CURRENT_DATE)
    )
    AND day_of_month <= EXTRACT(DAY FROM CURRENT_DATE)
  LOOP
    -- Call the Edge Function for each expense
    -- (You'll need to implement this using pg_net or similar)
    RAISE NOTICE 'Processing expense: %', expense.name;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

Then schedule it using pg_cron:
```sql
SELECT cron.schedule(
  'process-recurring-expenses',
  '0 0 * * *', -- Daily at midnight
  'SELECT process_due_recurring_expenses()'
);
```

### Option 2: External Cron Service

Use a service like:
- GitHub Actions (workflows)
- Vercel Cron
- AWS Lambda
- Any cron service that can call your Edge Function

## Troubleshooting

### Error: "recurring_expenses table does not exist"
**Solution**: Run the SQL migration from `create-recurring-expenses-table.sql`

### Error: "Function process-recurring-expense not found"
**Solution**: Deploy the Edge Function:
```bash
npx supabase functions deploy process-recurring-expense
```

### Expense not showing in ledger after "Process Now"
**Checks**:
1. Check browser console for errors
2. Verify Edge Function is deployed
3. Check Supabase Edge Functions logs
4. Ensure club has a currency set

### Cash balance not updating correctly
**Solution**: This was fixed in the recent update. Cash now correctly:
- Increases with paid income
- Decreases with paid expenses
- Decreases with paid refunds

## Example Configuration

### Typical Setup for a Sports Club

1. **Office Rent**
   - Amount: 500 BHD
   - Category: Rent
   - Day: 1st of month

2. **Electricity**
   - Amount: 150 BHD
   - Category: Utilities
   - Day: 5th of month

3. **Internet**
   - Amount: 50 BHD
   - Category: Utilities
   - Day: 10th of month

4. **Cleaning Service**
   - Amount: 200 BHD
   - Category: Maintenance
   - Day: 1st of month

## Support

For issues or questions:
1. Check the browser console for error messages
2. Check Supabase Edge Functions logs
3. Verify database table exists and has correct permissions
4. Ensure you have proper admin/owner permissions

---

**Version**: 1.0
**Last Updated**: November 6, 2025
