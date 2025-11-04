# Database Backup - November 3, 2025

## Backup Files Created

### 1. `database-full-backup-2025-11-03.sql` (187 KB)
**Complete backup with schema + data**
- Contains ALL tables, functions, triggers, constraints, and data
- Use this to restore the entire database

**Restore command:**
```bash
docker exec -i supabase_db_zcwfreuywtlrrgevhtmo psql -U postgres -d postgres < database-full-backup-2025-11-03.sql
```

### 2. `database-schema-only-2025-11-03.sql` (136 KB)
**Schema structure only (no data)**
- Contains table definitions, functions, RLS policies, indexes, constraints
- Use this to recreate the database structure on a new environment

**Restore command:**
```bash
docker exec -i supabase_db_zcwfreuywtlrrgevhtmo psql -U postgres -d postgres < database-schema-only-2025-11-03.sql
```

### 3. `database-data-inserts-2025-11-03.sql` (86 KB)
**Data only in INSERT format**
- Easy-to-read INSERT statements
- Good for selective data restoration or seeding

**Restore command:**
```bash
docker exec -i supabase_db_zcwfreuywtlrrgevhtmo psql -U postgres -d postgres < database-data-inserts-2025-11-03.sql
```

## What's Included

### Key Data:
- 4 clubs (EMPEROR, LEGEND, PHOENIX, Yousif Clube)
- Users and profiles
- Children records
- Club members (active and inactive)
- Packages and enrollments
- Instructors
- Activities
- Transactions (with FIXED receipt_number constraint)
- Facilities and operating hours

### Recent Fixes Applied:
✅ **Receipt number constraint fixed** - Now per-club instead of global
✅ **Admin role added** to yousiftest@ccn.com
✅ **LinkTree data fixed** from {} to []

## Notes
- These backups were created after fixing the receipt_number unique constraint
- All your hard-won data is preserved
- Keep these files safe!

