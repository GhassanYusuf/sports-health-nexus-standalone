# Quick Reference - Test Commands

## 🚀 Common Test Commands

### Database Connection
```bash
# Connect to local Supabase database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Check Supabase status
supabase status

# View Supabase Studio
open http://127.0.0.1:54323
```

---

## 📧 Expiring Enrollments Tests

### Setup & Testing
```bash
# 1. Create test user (first time only)
# Create user manually at: http://localhost:8080/auth?mode=signup
# Email: yousif.testing05@gmail.com

# 2. Create test enrollment data
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f TestCases/expiring-enrollments/create-test-enrollment-for-existing-user.sql

# 3. Test the email function NOW
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f TestCases/expiring-enrollments/test-expiring-enrollments-now.sql

# 4. Verify setup
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f TestCases/expiring-enrollments/verify-expiring-enrollments-setup.sql
```

### Alternative: Using curl
```bash
# Test expiring enrollments function
curl -X POST 'http://127.0.0.1:54321/functions/v1/check-expiring-enrollments' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU' \
  -H 'Content-Type: application/json'
```

### Check Function Logs
```bash
# View edge function logs
docker logs supabase_edge_runtime_zcwfreuywtlrrgevhtmo 2>&1 | grep "check-expiring-enrollments" | tail -20

# View database logs
docker logs supabase_db_zcwfreuywtlrrgevhtmo 2>&1 | tail -50
```

---

## 🏥 Database Health Checks

### Run Health Checks
```bash
# Full database health check
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f TestCases/health-checks/verify-database-health.sql

# Check constraints
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f TestCases/health-checks/check-constraints.sql

# Check user status
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f TestCases/health-checks/check-user-status.sql
```

### Quick Inline Checks
```bash
# Count users
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT COUNT(*) FROM auth.users;"

# Count clubs
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT COUNT(*) FROM clubs;"

# Check active enrollments
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT COUNT(*) FROM package_enrollments WHERE is_active = true;"
```

---

## 👥 Enrollment Checks

### Check User Enrollments
```bash
# View all user enrollments
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f TestCases/enrollment-checks/check_user_enrollments.sql

# Check specific user enrollments
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT * FROM package_enrollments WHERE member_id IN (
    SELECT id FROM club_members WHERE user_id = (
      SELECT id FROM auth.users WHERE email = 'yousif.testing05@gmail.com'
    )
  );"
```

### Check Expiring Enrollments
```bash
# View enrollments expiring in 3 days
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT
    pe.id,
    cm.name,
    cp.name AS package,
    pe.end_date,
    (pe.end_date - CURRENT_DATE) AS days_until_expiry,
    tl.payment_status
  FROM package_enrollments pe
  JOIN club_members cm ON cm.id = pe.member_id
  JOIN club_packages cp ON cp.id = pe.package_id
  LEFT JOIN transaction_ledger tl ON tl.id = pe.package_transaction_id
  WHERE pe.end_date = CURRENT_DATE + INTERVAL '3 days'
    AND pe.is_active = true;"
```

---

## 🔄 Data Management

### Reset Test Data
```bash
# Delete test user and related data
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres <<EOF
-- Delete enrollments
DELETE FROM package_enrollments WHERE member_id IN (
  SELECT id FROM club_members WHERE name LIKE '%Test%'
);

-- Delete transactions
DELETE FROM transaction_ledger WHERE member_email LIKE '%testing%';

-- Delete members
DELETE FROM club_members WHERE name LIKE '%Test%';

-- Delete profiles
DELETE FROM profiles WHERE email LIKE '%testing%';

-- Delete auth users
DELETE FROM auth.users WHERE email LIKE '%testing%';

-- Show summary
SELECT 'Test data cleaned up' AS status;
EOF
```

### Backup & Restore
```bash
# Create backup
pg_dump postgresql://postgres:postgres@127.0.0.1:54322/postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres < backup_YYYYMMDD_HHMMSS.sql
```

---

## 🎯 Edge Functions

### List Functions
```bash
# List all deployed functions
ls -la supabase/functions/
```

### Test Functions Directly
```bash
# Test send-receipt-email
curl -X POST 'http://127.0.0.1:54321/functions/v1/send-receipt-email' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU' \
  -H 'Content-Type: application/json' \
  -d '{"transactionId":"YOUR-TRANSACTION-ID","recipientEmail":"test@example.com"}'
```

---

## 📊 Monitoring

### View Cron Jobs
```sql
-- Connect to database and run:
SELECT * FROM cron.job WHERE jobname LIKE '%expiring%';

-- View cron job history
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-expiring-enrollments-10am')
ORDER BY start_time DESC
LIMIT 10;
```

### Database Metrics
```bash
# Database size
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT pg_size_pretty(pg_database_size('postgres'));"

# Table sizes
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;"
```

---

## 🛠️ Troubleshooting

### Restart Supabase
```bash
supabase stop
supabase start
```

### Reset Database
```bash
# WARNING: This deletes ALL data!
supabase db reset
```

### View All Logs
```bash
# View all container logs
docker ps --format "{{.Names}}" | grep supabase | xargs -I {} sh -c 'echo "=== {} ===" && docker logs {} 2>&1 | tail -20'
```

---

## 📝 Notes

- **Local Database:** `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **Supabase Studio:** `http://127.0.0.1:54323`
- **Frontend Dev:** `http://localhost:8080`
- **Test Email:** `yousif.testing05@gmail.com`

---

**Last Updated:** 2025-11-17
