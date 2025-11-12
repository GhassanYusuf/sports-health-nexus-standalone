# Database Schema Migration: Activities to Packages

**Date:** November 9, 2025
**Migration File:** `20251109150924_move_fields_from_activities_to_packages.sql`

## Overview

This migration cleans up the database schema by moving enrollment and booking-related fields from the `activities` table to the `club_packages` table, reflecting the actual business model where customers enroll in packages, not individual activities.

## Changes Made

### 1. Database Schema Changes

#### Added to `club_packages`:
- `requires_prebooking` (BOOLEAN, default: false) - Whether the package requires members to prebook sessions

#### Removed from `activities`:
- `monthly_fee` - Pricing belongs at the package level
- `cost_per_session` - Pricing belongs at the package level
- `booking_enabled` - Already exists in packages
- `requires_prebooking` - Moved to packages

### 2. Code Updates

#### Files Modified:

**src/components/admin/AdminActivities.tsx**
- Removed `monthly_fee`, `cost_per_session`, and `booking_enabled` from form state
- Removed pricing input fields from the UI
- Removed pricing display from activity cards
- Updated validation to not require `monthly_fee`
- Cleaned up unused `formatCurrency` and `clubCurrency` references

**src/components/CustomPackageBuilder.tsx**
- Removed `monthly_fee` from Activity interface
- Removed `monthly_fee` from database queries
- Removed `calculateTotalPrice()` function (packages now have manual pricing)
- Removed pricing display from activity selection UI
- Updated summary cards to show activity count instead of calculated price
- Removed unused `formatCurrency`, `DollarSign`, and `Sparkles` imports

**src/integrations/supabase/types.ts**
- Regenerated from local database schema to reflect the changes

### 3. Migration Process

The migration:
1. Added `requires_prebooking` to `club_packages`
2. Migrated any existing `requires_prebooking` data from activities to their linked packages
3. Dropped the redundant columns from `activities`
4. Added table comments for clarity

## Rationale

### Before:
- Activities had pricing fields (`monthly_fee`, `cost_per_session`)
- Activities had booking settings (`booking_enabled`, `requires_prebooking`)
- **Problem:** Customers don't enroll in activities directly; they enroll in packages
- **Issue:** Data duplication and confusion about where pricing/settings belong

### After:
- **Activities** = Class/session metadata (schedule, duration, capacity, facility)
- **Packages** = Products customers buy (pricing, restrictions, booking settings)
- **Clear separation** of concerns

## Business Logic

```
Package (Product)
├── Price: BHD 35.00
├── Duration: 1 month
├── Age restriction: 7-10 years
├── Booking settings: requires_prebooking
└── Contains → Activity (Class)
    ├── Title: "TAEKWONDO - CLASS B"
    ├── Schedule: Sat, Mon, Wed 5:00 PM
    ├── Duration: 60 minutes
    └── Capacity: 20 students
```

## Testing

✅ Migration ran successfully on local database
✅ All 17 packages updated with `requires_prebooking` field
✅ Application builds without TypeScript errors
✅ No references to removed fields in codebase

## Deployment Notes

1. Run the migration on staging/production:
   ```bash
   npx supabase db push
   ```

2. Verify the changes:
   ```sql
   \d club_packages  -- Check for requires_prebooking
   \d activities     -- Verify removed fields
   ```

3. Any admin UI that displays package details will now show booking settings at the package level

## Rollback

If needed, the migration can be reversed by:
1. Adding the fields back to activities
2. Removing `requires_prebooking` from packages
3. Restoring the old code from git

However, this should not be necessary as the changes align with the actual business model.
