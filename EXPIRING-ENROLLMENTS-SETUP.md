# Expiring Enrollments Email Automation Setup

This guide will help you set up automated email notifications for package enrollments expiring in 3 days.

## 🎯 Overview

The system will:
1. **Check daily at 10:00 AM** for enrollments expiring in exactly 3 days
2. **Send INVOICE** if package payment is pending/failed
3. **Send RECEIPT** if package payment is paid
4. Display expiring enrollments in the admin dashboard

## 📋 Prerequisites

- Supabase project (local or cloud)
- SMTP configured for `send-receipt-email` function
- `pg_cron` extension enabled (for production)
- `pg_net` extension enabled (for HTTP calls)

## 🚀 Quick Start

### Step 1: Create Test Data

Run this to create a test user with enrollment expiring in 3 days:

```bash
# Using psql (local Supabase)
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/expiring-enrollments/create-test-enrollment-for-existing-user.sql

# Or using Supabase SQL Editor
# Copy and paste the contents from TestCases/expiring-enrollments/
```

**Test user details:**
- Email: `yousif.testing05@gmail.com`
- Password: `TestPassword123!`
- Enrollment expires in: 3 days
- Package payment: PENDING (will send INVOICE)

### Step 2: Deploy Edge Function

```bash
# Deploy the check-expiring-enrollments function
supabase functions deploy check-expiring-enrollments
```

### Step 3: Test Manually (Before Setting Up Cron)

```bash
# Option 1: Using SQL
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/expiring-enrollments/test-expiring-enrollments-now.sql

# Option 2: Using curl
curl -X POST 'http://127.0.0.1:54321/functions/v1/check-expiring-enrollments' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU' \
  -H 'Content-Type: application/json'

# Option 3: Using curl
curl -X POST 'http://127.0.0.1:54321/functions/v1/check-expiring-enrollments' \
  -H 'Authorization: Bearer YOUR-SERVICE-ROLE-KEY' \
  -H 'Content-Type: application/json'
```

### Step 4: Check Results

1. **Check function logs:**
   ```bash
   supabase functions logs check-expiring-enrollments
   ```

2. **Check email inbox:**
   - Go to `yousif.testing05@gmail.com`
   - Look for invoice email (since payment is pending)

3. **Verify in database:**
   ```sql
   SELECT * FROM transaction_ledger
   WHERE member_email = 'yousif.testing05@gmail.com';
   ```

### Step 5: Set Up Cron Job (Production)

**For Production/Cloud Supabase:**

```bash
# Run the cron setup script
psql -h YOUR-DB-HOST -U postgres -d postgres -f setup-expiring-enrollments-cron.sql

# Note: setup-expiring-enrollments-cron.sql is in the root directory (production use)
```

**For Local Development:**

Since local Supabase may not have `pg_cron` by default, you can:

1. Use an external cron service (like cron-job.org)
2. Use GitHub Actions to run daily
3. Manually run the test script daily

## 🧪 Testing Different Scenarios

### Test RECEIPT (Paid Package)

```sql
-- Change payment status to 'paid'
UPDATE transaction_ledger
SET payment_status = 'paid'
WHERE member_email = 'yousif.testing05@gmail.com'
  AND transaction_type = 'package_fee';

-- Then run the test again
-- Should now send RECEIPT instead of INVOICE
```

### Test INVOICE (Unpaid Package)

```sql
-- Change payment status to 'pending'
UPDATE transaction_ledger
SET payment_status = 'pending'
WHERE member_email = 'yousif.testing05@gmail.com'
  AND transaction_type = 'package_fee';

-- Then run the test again
-- Should send INVOICE
```

### Create More Test Data

Modify `create-test-expiring-enrollment.sql`:
- Change email address
- Change dates
- Add multiple test users

## 📊 Monitoring

### View Cron Job Status

```sql
-- Check if cron job is scheduled
SELECT * FROM cron.job
WHERE jobname = 'check-expiring-enrollments-10am';

-- View cron job execution history
SELECT * FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job
  WHERE jobname = 'check-expiring-enrollments-10am'
)
ORDER BY start_time DESC
LIMIT 10;
```

### View Expiring Enrollments

```sql
-- See all enrollments expiring in 3 days
SELECT
  pe.id,
  cm.name AS member_name,
  cp.name AS package_name,
  pe.end_date,
  (pe.end_date - CURRENT_DATE) AS days_until_expiry,
  tl.payment_status,
  tl.member_email
FROM package_enrollments pe
JOIN club_members cm ON cm.id = pe.member_id
JOIN club_packages cp ON cp.id = pe.package_id
LEFT JOIN transaction_ledger tl ON tl.id = pe.package_transaction_id
WHERE pe.end_date = CURRENT_DATE + INTERVAL '3 days'
  AND pe.is_active = true;
```

## 🔧 Configuration

### Change Email Send Time

Edit `setup-expiring-enrollments-cron.sql`:

```sql
-- Change from 10:00 AM to 9:00 AM
'0 9 * * *'   -- hour = 9

-- Change to 2:00 PM (14:00)
'0 14 * * *'  -- hour = 14

-- Change to 8:30 AM
'30 8 * * *'  -- minute = 30, hour = 8
```

### Change Warning Period

Edit `supabase/functions/check-expiring-enrollments/index.ts`:

```typescript
// Change from 3 days to 7 days
const targetDate = new Date();
targetDate.setDate(targetDate.getDate() + 7);  // Changed from 3 to 7
```

## 🐛 Troubleshooting

### Emails Not Sending

1. **Check SMTP configuration:**
   ```bash
   cat supabase/functions/send-receipt-email/.env.local
   ```

2. **Check function logs:**
   ```bash
   supabase functions logs send-receipt-email --follow
   ```

3. **Test send-receipt-email directly:**
   ```bash
   supabase functions invoke send-receipt-email \
     --body '{"transactionId":"YOUR-TRANSACTION-ID","recipientEmail":"yousif.testing05@gmail.com"}'
   ```

### No Enrollments Found

1. **Verify test data was created:**
   ```sql
   SELECT * FROM package_enrollments
   WHERE end_date = CURRENT_DATE + INTERVAL '3 days';
   ```

2. **Check dates:**
   ```sql
   SELECT CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days';
   ```

### Cron Job Not Running

1. **Check if pg_cron is enabled:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **Check cron job exists:**
   ```sql
   SELECT * FROM cron.job;
   ```

3. **Manually trigger:**
   ```bash
   psql -f test-expiring-enrollments-now.sql
   ```

## 📁 File Structure

```
├── create-test-expiring-enrollment.sql      # Create test data
├── setup-expiring-enrollments-cron.sql      # Setup cron job
├── test-expiring-enrollments-now.sql        # Manual test trigger
├── EXPIRING-ENROLLMENTS-SETUP.md            # This file
└── supabase/
    └── functions/
        └── check-expiring-enrollments/
            └── index.ts                     # Main function
```

## 🔄 Production Deployment Checklist

- [ ] Test data created and email sent successfully
- [ ] SMTP credentials configured
- [ ] Edge function deployed
- [ ] Cron job scheduled
- [ ] Monitoring set up
- [ ] Email templates reviewed
- [ ] Test with real user data
- [ ] Update cloud Supabase URL in cron job
- [ ] Document for team

## 📧 Email Templates

The system uses the existing `send-receipt-email` function which supports:
- Dynamic club branding
- Receipt vs Invoice mode
- Multi-currency
- VAT calculation
- Professional HTML templates

To customize, edit:
`supabase/functions/send-receipt-email/index.ts`

## 🎨 Dashboard Integration

The expiring enrollments will automatically appear in the admin dashboard's "Expiring Subscriptions" panel when:
- Enrollment has `end_date` within 3 days
- Enrollment `is_active = true`
- Related transaction exists

## ✅ Success Indicators

You'll know it's working when:
1. ✅ Test script finds expiring enrollments
2. ✅ Function logs show successful execution
3. ✅ Email arrives at yousif.testing05@gmail.com
4. ✅ Email content matches payment status (RECEIPT/INVOICE)
5. ✅ Cron job runs automatically at 10:00 AM

## 🆘 Support

For issues:
1. Check function logs
2. Verify SMTP settings
3. Test with manual trigger
4. Review database constraints
5. Check email spam folder

---

**Created:** 2025-11-17
**Last Updated:** 2025-11-17
**Version:** 1.0
