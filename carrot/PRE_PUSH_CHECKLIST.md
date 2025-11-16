# Pre-Push Checklist ✅

## Files Changed
- [x] `carrot/prisma/schema.prisma` - Domain nullable with index
- [x] `carrot/prisma/migrations/20250115000000_add_domain_to_discovered_content/migration.sql` - Migration file
- [x] `carrot/src/lib/discovery/canonicalize.ts` - Added `getDomainFromUrl()` helper
- [x] `carrot/src/lib/discovery/engineV21.ts` - Updated write path
- [x] `carrot/src/lib/discovery/orchestrator.ts` - Updated write path
- [x] `carrot/src/lib/discovery/oneAtATimeWorker.ts` - Updated write path
- [x] `carrot/src/app/api/content/route.ts` - Updated write path
- [x] `carrot/src/app/api/ai/discover-content/route.ts` - Updated write path
- [x] `carrot/scripts/backfill-discovered-content-domain.ts` - Backfill script
- [x] `carrot/src/lib/__tests__/canonicalize.domain.test.ts` - Unit tests
- [x] `carrot/package.json` - Added `backfill:domain` script
- [x] `carrot/DOMAIN_COLUMN_ROLLOUT.md` - Rollout documentation
- [x] `carrot/DOMAIN_FIX_SUMMARY.md` - Quick summary

## Verification ✅

### Schema
- [x] `domain` is nullable (`String?`)
- [x] Index added (`@@index([domain])`)
- [x] Uses `@db.Text` for PostgreSQL

### Code
- [x] All 5 `discoveredContent.create()` calls updated
- [x] All use `getDomainFromUrl()` helper
- [x] All have error handling with try/catch
- [x] All imports are correct
- [x] No linter errors

### Migration
- [x] Migration file exists in correct location
- [x] Uses `ADD COLUMN IF NOT EXISTS` (safe for re-runs)
- [x] Creates index with `IF NOT EXISTS`
- [x] Migration is idempotent

### Tests
- [x] Test file created with 25 test cases
- [x] Tests cover happy path, edge cases, and real-world examples
- [x] Test imports are correct

### Scripts
- [x] Backfill script exists
- [x] npm script added: `backfill:domain`
- [x] Script handles batching and errors gracefully

### Documentation
- [x] Rollout guide created
- [x] Quick summary created
- [x] All steps documented

## Notes

- **Duplicate function**: There's a different `getDomainFromUrl()` in `carrot/src/lib/canonicalize.ts`, but all our imports correctly use the one from `discovery/canonicalize`
- **Update calls**: `prisma.discoveredContent.update()` calls don't need changes - they're updating existing records, not creating new ones
- **Card payload**: Line 1722 in `engineV21.ts` uses `finalDomain` in a card payload (not a DB write) - this is fine

## Ready to Push ✅

All checks pass. The code is:
- ✅ Type-safe
- ✅ Lint-clean
- ✅ Well-tested
- ✅ Documented
- ✅ Zero-downtime compatible

**Next steps after push:**
1. Deploy code
2. Run migration: `npx prisma migrate deploy`
3. Run backfill: `npm run backfill:domain`
4. Monitor logs

