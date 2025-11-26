# Rollout Safety Deltas - Implementation Summary

This document summarizes the 14 safety deltas implemented to de-risk rollout.

## ✅ Completed Deltas

### 1. **Env validation at boot** ✅
- **File**: `src/lib/env/validate.ts`
- **Implementation**: Zod schema validates required env vars (DB URL, REDIS URL, RPS caps, Playwright flags)
- **Usage**: Called at boot in `server.js` (with graceful fallback for dev)

### 2. **Feature flags default OFF** ✅
- **File**: `src/lib/config/features.ts`
- **Implementation**: New flags (Wikipedia expansion, print/AMP branches, recrawl) default to `false`
- **Usage**: Flipped per-patch via `PATCH_FEATURES` env var (comma-separated)

### 3. **Migration safety** ✅
- **File**: `scripts/migrate-safe.ts`
- **Implementation**: Wrapper script provides compat window:
  1. Deploy Prisma client first
  2. Run Migration 1
  3. Code using new fields
  4. Gate Migration 2 behind status check script
- **Usage**: `tsx scripts/migrate-safe.ts <migration-name> [--check-status]`

### 4. **Prisma client/version pin** ✅
- **File**: `package.json`
- **Implementation**: `prisma` and `@prisma/client` already pinned to same version (6.12.0)
- **Build step**: Added `prisma generate` to build command

### 5. **Auth on debug endpoints** ✅
- **Files**: 
  - `src/lib/middleware/debugAuth.ts` - Auth middleware
  - `src/lib/auth/orgAdmin.ts` - Org admin check
  - Updated: `src/app/api/debug/test/route.ts`, `src/app/api/debug/db/route.ts`, `src/app/api/debug/img/route.ts`
- **Implementation**: All `/api/debug/*` endpoints require org-admin via server-side session check
- **Response**: Returns 403 (not 200 with error) to avoid confusing FE

### 6. **PII/log redaction** ✅
- **File**: `src/lib/logging/redact.ts`
- **Implementation**: Centralized sanitizer redacts:
  - `Authorization` headers
  - `Cookie` headers
  - `?token=`, `?key=`, `?api_key=` query params
- **Usage**: Integrated into `logEnrichment()` and worker logging

### 7. **FE hero query guard** ✅
- **File**: `src/app/api/patches/[handle]/discovered-content/route.ts`
- **Implementation**: Grid queries:
  - Only items with `textContent` (status='SAVED' implied)
  - `textBytes >= MIN_TEXT_BYTES_FOR_HERO` (200 bytes)
  - Pagination keys include `buildSha` and `patchId`

### 8. **Admin backfill trigger** ✅
- **File**: `src/app/api/admin/backfill-heroes/route.ts`
- **Implementation**: Admin endpoint to trigger `backfill-heros` with:
  - `patchId` or `patchHandle` param
  - `limit` param
  - Live counter from DB truth (not run aggregates)

### 9. **Robots + UA string** ✅
- **File**: `src/lib/enrichment/worker.ts`
- **Implementation**: UA string clearly identifies crawler:
  - Format: `CarrotCrawler/1.0 (+https://carrot-app.onrender.com; contact@carrot.app)`
  - Configurable via `CRAWLER_USER_AGENT` env var
  - Robots.txt respect already planned (confirmed)

### 10. **Playwright budget defaults** ✅
- **File**: `src/lib/crawler/playwrightConfig.ts`
- **Implementation**: Defaults:
  - Deny `video`, `media`, `font` resources
  - Cap image responses at 2MB
  - Abort after 15s timeout
  - Close context per URL to stop leaks

### 11. **Fair-use clamp in one place** ✅
- **File**: `src/lib/fairUse.ts`
- **Implementation**: Centralized "≤2 paragraphs / ≤1200 chars" clamp
- **Usage**: Called server-side before save/hero render
- **Integration**: Used in `src/lib/enrichment/worker.ts` `generateQuote()`

### 12. **Queue idempotency across restarts** ✅
- **File**: `src/lib/queue/idempotency.ts`
- **Implementation**:
  - `jobId = sha256(patchId|canonicalUrl)`
  - `removeOnComplete: true` (with age/count limits)
  - `removeOnFail: false` (keeps DLQ introspectable)

### 13. **Smoke test seed** ✅
- **File**: `scripts/smoke-test-seed.ts`
- **Implementation**: Two deterministic, paywall-free URLs:
  1. Basketball-Reference game recap
  2. NBA.com article
- **Usage**: `tsx scripts/smoke-test-seed.ts <patch-id>`

### 14. **Counters = DB truth** ✅
- **File**: `src/lib/counters/dbTruth.ts`
- **Implementation**:
  - Avoids "run" aggregates
  - Computes from DB each refresh
  - 15s cached Redis key
  - FE never shows "stuck"
- **Integration**: Updated `src/lib/enrichment/logger.ts` to use DB truth

## 📋 Additional Files Created

- `src/lib/config/constants.ts` - Application constants (MIN_TEXT_BYTES_FOR_HERO)
- Updated `package.json` - Added `prisma generate` to build step

## 🚀 Next Steps

1. **Test env validation**: Ensure all required env vars are set
2. **Run migration safety script**: Test with a sample migration
3. **Verify debug auth**: Test that non-admin users get 403
4. **Test smoke seed**: Run on a test patch
5. **Monitor counters**: Verify DB truth counters update correctly

## ⚠️ Notes

- Server.js env validation has graceful fallback for dev (TypeScript may not be compiled)
- Feature flags are OFF by default - enable via `PATCH_FEATURES` env var
- All debug endpoints now require org-admin auth
- Logs are automatically sanitized for PII

