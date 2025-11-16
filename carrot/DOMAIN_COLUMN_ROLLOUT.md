# Domain Column Rollout Guide

This document describes the zero-downtime rollout process for adding the `domain` column to the `discovered_content` table.

## Problem

The `discovered_content` table was missing the `domain` column, causing `PrismaClientKnownRequestError` when code attempted to write to it. The schema had the field defined, but the database migration was never applied.

## Solution

1. **Schema Update**: Made `domain` nullable (`String?`) to allow zero-downtime deployment
2. **Migration**: Added migration to create nullable `domain` column with index
3. **Code Updates**: All write paths now use `getDomainFromUrl()` helper with proper error handling
4. **Backfill**: Script to populate `domain` for existing rows
5. **Tests**: Unit tests for domain extraction logic

## Rollout Steps (Zero-Downtime)

### Step 1: Deploy Code (No Migration Yet)

Deploy the code changes that:
- Treat `domain` as optional (nullable)
- Use `getDomainFromUrl()` helper for all writes
- Include error handling for database writes

**Commands:**
```bash
# Build and deploy
npm run build:production
# Deploy to production
```

**Verification:**
- Check logs for any `domain does not exist` errors (should be none after this step)
- Verify new writes are working (domain will be NULL initially, which is OK)

### Step 2: Apply Migration

Apply the Prisma migration to add the `domain` column:

```bash
# In production environment with DATABASE_URL set
cd carrot
npx prisma migrate deploy
```

**Verification:**
```sql
-- Check column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'discovered_content' AND column_name = 'domain';

-- Should return: domain | text | YES
```

**Check index:**
```sql
-- Verify index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'discovered_content' AND indexname LIKE '%domain%';

-- Should show: discovered_content_domain_idx
```

### Step 3: Run Backfill Script

Backfill existing rows with domain values:

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="your-production-database-url"

# Run backfill
npm run backfill:domain
```

**Expected Output:**
```
[Backfill] Starting domain backfill for discovered_content...
[Backfill] Processing batch: 0 to 499 (500 rows)
[Backfill] Updated 485 rows in this batch
...
[Backfill] Backfill complete!
[Backfill] Total rows processed: 1234
[Backfill] Total rows updated: 1200
[Backfill] Rows still with null domain: 34
[Backfill] Total rows in table: 1234
[Backfill] Coverage: 97.25%
```

**Verification:**
```sql
-- Check coverage
SELECT 
  COUNT(*) as total,
  COUNT(domain) as with_domain,
  COUNT(*) - COUNT(domain) as null_domain,
  ROUND(100.0 * COUNT(domain) / COUNT(*), 2) as coverage_pct
FROM discovered_content;

-- Coverage should be > 95% after backfill
```

### Step 4: Monitor Production

Monitor for:
- No new `domain does not exist` errors
- All new writes have `domain` populated
- Discovery loop continues without crashes

**Check logs:**
```bash
# Look for domain-related errors
grep -i "domain" production.log | grep -i error

# Should return minimal or no results
```

### Step 5: (Optional) Make Domain Required

After confirming 100% coverage and stable operation, you can optionally make `domain` required:

1. Update schema: `domain String?` → `domain String`
2. Create follow-up migration:
   ```sql
   ALTER TABLE "discovered_content"
     ALTER COLUMN "domain" SET NOT NULL;
   ```
3. Apply migration: `npx prisma migrate deploy`

**Note**: Only do this if you're confident all rows have domain values and new writes always provide domain.

## Rollback Plan

If issues occur:

1. **Immediate**: Set `DISCOVERY_V2=false` to disable discovery (if using feature flags)
2. **Code Rollback**: Revert to previous code version
3. **Migration Rollback**: If migration was applied, you can drop the column:
   ```sql
   ALTER TABLE "discovered_content" DROP COLUMN IF EXISTS "domain";
   DROP INDEX IF EXISTS "discovered_content_domain_idx";
   ```

## Files Changed

- `carrot/prisma/schema.prisma` - Made domain nullable, added index
- `carrot/prisma/migrations/20250115000000_add_domain_to_discovered_content/migration.sql` - Migration file
- `carrot/src/lib/discovery/canonicalize.ts` - Added `getDomainFromUrl()` helper
- `carrot/src/lib/discovery/engineV21.ts` - Updated write path with helper and error handling
- `carrot/src/lib/discovery/orchestrator.ts` - Updated write path with helper and error handling
- `carrot/src/lib/discovery/oneAtATimeWorker.ts` - Updated write path with helper and error handling
- `carrot/src/app/api/content/route.ts` - Updated write path
- `carrot/src/app/api/ai/discover-content/route.ts` - Updated write path
- `carrot/scripts/backfill-discovered-content-domain.ts` - Backfill script
- `carrot/src/lib/__tests__/canonicalize.domain.test.ts` - Unit tests

## Testing

Run tests before deployment:

```bash
# Unit tests
npm test -- canonicalize.domain.test.ts

# Integration test (if available)
npm test -- integration.test.ts
```

## Acceptance Criteria

- ✅ No more `domain does not exist` errors
- ✅ New writes always populate `domain` (or NULL if URL parsing fails)
- ✅ Old rows backfilled to non-empty `domain` (>95% coverage)
- ✅ Discovery loop continues without crashing on bad URLs
- ✅ All tests pass
- ✅ Lint passes

## Support

If you encounter issues:
1. Check application logs for domain-related errors
2. Verify migration was applied: `SELECT * FROM _prisma_migrations WHERE name LIKE '%domain%'`
3. Check backfill coverage: `SELECT COUNT(*) FROM discovered_content WHERE domain IS NULL`
4. Review error handling logs for specific URLs that fail domain extraction

