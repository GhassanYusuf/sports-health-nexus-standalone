# Database Test Cases

This directory contains all database testing scripts and utilities for the Sports Health Nexus project.

## 📁 Directory Structure

```
TestCases/
├── README.md                                    # This file
├── expiring-enrollments/                        # Expiring enrollment tests
│   ├── create-test-expiring-enrollment.sql
│   ├── create-test-enrollment-for-existing-user.sql
│   ├── test-expiring-enrollments-now.sql
│   ├── verify-expiring-enrollments-setup.sql
│   └── add-expiring-enrollment-test.sql
├── health-checks/                               # Database health checks
│   ├── verify-database-health.sql
│   ├── check-constraints.sql
│   └── check-user-status.sql
└── enrollment-checks/                           # User enrollment verification
    └── check_user_enrollments.sql
```

## 🧪 Test Categories

### 1. Expiring Enrollments Tests

Test the automated email notification system for package enrollments expiring in 3 days.

#### Files:
- **create-test-expiring-enrollment.sql** - Creates complete test data (user, profile, club member, enrollment, transactions)
- **create-test-enrollment-for-existing-user.sql** - Creates test enrollment for an existing user
- **test-expiring-enrollments-now.sql** - Manually triggers the expiring enrollments check function
- **verify-expiring-enrollments-setup.sql** - Verifies cron job and system setup
- **add-expiring-enrollment-test.sql** - Quick test data insertion

#### Usage:
```bash
# 1. Create test data
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/create-test-enrollment-for-existing-user.sql

# 2. Test the function
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/test-expiring-enrollments-now.sql

# 3. Verify setup
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/verify-expiring-enrollments-setup.sql
```

---

### 2. Database Health Checks

Verify database integrity, constraints, and overall health.

#### Files:
- **verify-database-health.sql** - Comprehensive database health check
- **check-constraints.sql** - Validates all foreign keys and constraints
- **check-user-status.sql** - Checks user authentication and profile status

#### Usage:
```bash
# Run health check
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/verify-database-health.sql

# Check constraints
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/check-constraints.sql
```

---

### 3. Enrollment Checks

Verify user package enrollments and membership status.

#### Files:
- **check_user_enrollments.sql** - Lists all active/inactive enrollments for users

#### Usage:
```bash
# Check user enrollments
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/check_user_enrollments.sql
```

---

## 🚀 Quick Start

### Running All Tests

```bash
# Navigate to project root
cd /Users/yousif/presonal_projects_scriptIT/sports-health-nexus-main

# Run health checks first
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/verify-database-health.sql

# Create test data
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/create-test-enrollment-for-existing-user.sql

# Test expiring enrollments
psql -h localhost -p 54322 -U postgres -d postgres -f TestCases/test-expiring-enrollments-now.sql
```

---

## 📝 Test Data

### Test Users

The test scripts create users with the following emails:
- `yousif.testing05@gmail.com` - Primary test user for expiring enrollments

### Test Scenarios

1. **Expiring Package (PAID)** - Tests receipt email sending
2. **Expiring Package (PENDING)** - Tests invoice email sending
3. **Multiple Enrollments** - Tests bulk email processing

---

## 🔍 Verification

After running tests, verify:

1. **Email Sent:** Check inbox at `yousif.testing05@gmail.com`
2. **Database State:** Run enrollment checks
3. **Function Logs:** Check Supabase function logs
4. **Cron Jobs:** Verify scheduled tasks

---

## 🛠️ Maintenance

### Adding New Tests

1. Create SQL file in appropriate subdirectory
2. Add documentation in this README
3. Follow naming convention: `action-subject-test.sql`

### Test Data Cleanup

```sql
-- Delete test users
DELETE FROM auth.users WHERE email LIKE '%testing%';

-- Delete test enrollments
DELETE FROM package_enrollments WHERE member_id IN (
  SELECT id FROM club_members WHERE name LIKE '%Test%'
);
```

---

## 📚 Related Documentation

- [Expiring Enrollments Setup](../EXPIRING-ENROLLMENTS-SETUP.md)
- [Receipt Email Setup](../RECEIPT_EMAIL_SETUP.md)
- [Database Migrations](../supabase/migrations/)
- [Supabase Functions](../supabase/functions/)

---

## 🐛 Troubleshooting

### Tests Not Running

1. **Check Supabase status:**
   ```bash
   supabase status
   ```

2. **Verify database connection:**
   ```bash
   psql -h localhost -p 54322 -U postgres -d postgres -c "SELECT 1;"
   ```

3. **Check function deployment:**
   ```bash
   supabase functions list
   ```

### Email Not Sending

1. Check SMTP configuration: `supabase/functions/send-receipt-email/.env.local`
2. View function logs: `docker logs supabase_edge_runtime_zcwfreuywtlrrgevhtmo`
3. Test SMTP connection manually

---

**Last Updated:** 2025-11-17
**Maintainer:** Development Team
