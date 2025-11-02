# Quick Reference - What Was Changed

## Files Modified (2 files)

### 1. `.env`
- **Changed:** Switched from Cloud to Local Supabase
- **Lines:** 1-12
- **Key Change:**
  - From: `VITE_SUPABASE_URL="https://zcwfreuywtlrrgevhtmo.supabase.co"`
  - To: `VITE_SUPABASE_URL="http://127.0.0.1:54321"`

### 2. `src/components/MemberSignupForm.tsx`
- **Line ~10:** Added `import { Form } from "@/components/ui/form";`
- **Line ~26:** Removed `fitnessGoal: z.string().optional(),` from schema
- **Line ~293:** Added `<Form {...form}>` wrapper
- **Line ~229:** Added `address: data.address || null,` to profile insert
- **Line ~232-235:** Added error logging
- **Line ~278-280:** Added console.error for debugging
- **Line ~558-565:** Removed entire "Fitness Goal" section
- **Line ~589:** Added closing `</Form>` tag

---

## Database Changes (via Docker CLI)

### Fixed NULL Columns
```bash
docker exec supabase_db_zcwfreuywtlrrgevhtmo psql -U postgres -c "UPDATE auth.users SET confirmation_token = '', recovery_token = '', email_change_token_new = '', email_change_token_current = '', phone_change_token = '', email_change = '', phone_change = '', reauthentication_token = '' WHERE email = 'platformtakeone@gmail.com';"
```

### Reset Password
```bash
# Generate hash for 'NewPassword123'
docker exec supabase_db_zcwfreuywtlrrgevhtmo psql -U postgres -c "SELECT crypt('NewPassword123', gen_salt('bf'));"

# Update password
docker exec supabase_db_zcwfreuywtlrrgevhtmo psql -U postgres -c "UPDATE auth.users SET encrypted_password = '\$2a\$06\$WTsx2RNtaT9oOlxMTuHo1eO.AdfwUrZOs9ysasv.UwW5WoteBlqri', updated_at = NOW() WHERE email = 'platformtakeone@gmail.com';"
```

### Restart Auth Service
```bash
docker restart supabase_auth_zcwfreuywtlrrgevhtmo
```

---

## Login Credentials (Local DB)

| Email | Password | Status |
|-------|----------|--------|
| `platformtakeone@gmail.com` | `NewPassword123` | ✅ Reset & Working |
| `yousiftest@ccn.com` | (Your original) | ✅ Working |
| Other imported users | N/A | ❌ Need password reset |

---

## Access URLs

| Service | URL |
|---------|-----|
| **App** | http://localhost:8080 |
| **Local Supabase Dashboard** | http://127.0.0.1:54323/project/default |
| **Local PostgreSQL** | 127.0.0.1:54322 (pgAdmin 4) |
| **Cloud Supabase Dashboard** | https://supabase.com/dashboard/project/zcwfreuywtlrrgevhtmo |

---

## Switch Back to Cloud

1. Edit `.env`:
```bash
# Comment out LOCAL
# VITE_SUPABASE_URL="http://127.0.0.1:54321"
# ...

# Uncomment CLOUD
VITE_SUPABASE_URL="https://zcwfreuywtlrrgevhtmo.supabase.co"
# ...
```

2. Restart dev server:
```bash
npm run dev
```

---

## Full Documentation

See `CHANGES-SUMMARY.md` for complete details.
