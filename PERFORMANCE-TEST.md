# Performance Testing Guide

## How to Test the Performance Improvements

### 1. Network Tab - Database Query Reduction

**Steps:**
1. Open Chrome DevTools (F12 or Cmd+Option+I)
2. Go to the **Network** tab
3. Filter by "Fetch/XHR" to see only API calls
4. Clear the network log (🚫 icon)
5. Navigate to http://localhost:8080/
6. **Count the Supabase API calls**

**Expected Results:**

**BEFORE Optimization:**
- Dashboard load: 150+ requests to Supabase
- Each club: 3-4 separate queries
- Total time: 5-10 seconds

**AFTER Optimization:**
- Dashboard load: 1-2 requests to Supabase
- All clubs: Single query
- Total time: 0.5-1 second

**What to look for:**
- Look for requests to `http://127.0.0.1:54321/rest/v1/`
- Count how many times you see:
  - `package_enrollments` (should be 0 now!)
  - `club_packages` (should be 0 now!)
  - `club_instructors` (should be 0 now!)
  - `clubs` (should be 1)

---

### 2. React Query DevTools - Cache Hit Rate

**Install React Query DevTools:**

\`\`\`bash
npm install @tanstack/react-query-devtools
\`\`\`

**Add to App.tsx:**

\`\`\`typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Inside your App component, add:
<ReactQueryDevtools initialIsOpen={false} />
\`\`\`

**What to observe:**
- Open the floating devtools icon (bottom right)
- Navigate between pages
- Watch queries go from "fetching" → "success" → "stale"
- Revisit pages and see cache hits (instant load!)

---

### 3. Bundle Size Analysis

**Check initial bundle size:**

\`\`\`bash
npm run build
\`\`\`

**Expected Results:**

**BEFORE (without lazy loading):**
- Main bundle: ~800KB - 1.2MB

**AFTER (with lazy loading):**
- Main bundle: ~300-400KB
- Route chunks: Multiple small files (50-150KB each)
- **Reduction: 60-70%**

---

### 4. Lighthouse Performance Score

**Steps:**
1. Open Chrome DevTools
2. Go to **Lighthouse** tab
3. Select "Performance" only
4. Click "Analyze page load"

**Expected Scores:**

**BEFORE:**
- Performance: 30-50
- First Contentful Paint: 3-5s
- Time to Interactive: 8-12s

**AFTER:**
- Performance: 70-90
- First Contentful Paint: 1-2s
- Time to Interactive: 2-4s

---

### 5. Database Query Profiling

**View Supabase Query Logs:**

\`\`\`bash
# In another terminal, tail Supabase logs
docker logs -f supabase_db_zcwfreuywtlrrgevhtmo 2>&1 | grep "SELECT"
\`\`\`

**What to observe:**
- Load the dashboard
- Count SELECT queries
- Should see 1 main query instead of 150+

---

### 6. Side-by-Side Comparison

**Create a test:**

1. **Before testing:** Comment out the optimizations
2. **Record metrics:** Network requests, load time
3. **Restore optimizations**
4. **Compare:** See the difference!

**Quick comparison checklist:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Network requests | 150+ | 1-2 | 99% reduction |
| Page load time | 5-10s | 0.5-1s | 10x faster |
| Initial bundle | 1.2MB | 400KB | 66% smaller |
| Database queries | 150+ | 1 | 150x fewer |

---

## Real-World Test Scenario

**Load the dashboard with 50 clubs:**

1. Open Network tab
2. Navigate to dashboard
3. **Count the API calls to Supabase**
4. **Measure the time** from navigation to render

**You should see:**
- ✅ 1 query to fetch all clubs
- ✅ ~50 API calls for driving distances (external API, not our DB)
- ✅ 0 queries for counts (using existing columns)
- ✅ Total load time < 2 seconds

---

## Tips

- **Clear cache between tests** (Cmd+Shift+R or Ctrl+Shift+R)
- **Use incognito mode** for clean testing
- **Disable browser extensions** that might interfere
- **Test with throttling** (Network tab → Slow 3G) to see improvements clearly
