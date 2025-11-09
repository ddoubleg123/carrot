# Open-Evidence Discovery v2.1 – Rollout & Acceptance Guide

_Last updated: 2025-11-09_

## 1. Overview
Open-Evidence Discovery v2.1 introduces the DeepSeek-driven planner/vetter pipeline, one-by-one frontier processing, controversy/history quotas, real-time SSE UI, audit trail, and structured metrics snapshots. This document covers:

- Feature flags / configuration switches
- Guide backfill & data prep
- Deployment checklist
- Acceptance tests (functional + observability)
- Operational tooling (metrics endpoint, audit console)
- Rollback / kill-switch plan

---

## 2. Feature Flags & Configuration
| Flag | Location | Default | Purpose |
| --- | --- | --- | --- |
| `OPEN_EVIDENCE_V2` | `.env` / Vercel env | `false` | Enables guide generation on patch creation, DeepSeek planner usage |
| `DISCOVERY_V21` | `.env` / Vercel env | `false` | Routes discovery to the v2.1 engine + UI |
| `DISCOVERY_KILLSWITCH` | `.env` / Vercel env | `false` | Hard stop for discovery endpoints (returns 503) |

**Secrets**
- `DEEPSEEK_API_KEY` – already required for planner/vetter and must be present in serverless runtime.
- `REDIS_URL` – used for frontier, dedupe, counters, metrics snapshots.

**Rollout Strategy**
1. Deploy with all flags `false` (passive code).
2. Flip `OPEN_EVIDENCE_V2=true` → verify guide creation/backfill.
3. Enable `DISCOVERY_V21` for test patches (staging project first).
4. Monitor metrics/audit; ramp to production handles once acceptance passes.

---

## 3. Data Backfill & Scripts
### 3.1 New Patch Creation
When `OPEN_EVIDENCE_V2` is true, `POST /api/patches` automatically generates a DeepSeek guide snapshot and persists it on the patch record (`Patch.guide`).

### 3.2 Backfill Existing Patches
Use the CLI script to populate guides for legacy patches:
```bash
cd carrot
OPEN_EVIDENCE_V2=true npx ts-node scripts/backfill-guides.ts          # skip patches that already have guides
OPEN_EVIDENCE_V2=true npx ts-node scripts/backfill-guides.ts --force   # re-generate guides for all patches
```
- Adds jittered delays (250–500 ms) to avoid rate limits.
- Logs success/skip/failure counts to stdout.
- Safe to rerun; only writebacks occur when needed.

### 3.3 Manual Refresh per Patch
`POST /api/patches/[handle]/refresh-guide`
- Requires authentication + owner permissions.
- Respects `OPEN_EVIDENCE_V2` flag.
- Useful after entity metadata changes.

---

## 4. Deployment Checklist
1. **Dependencies**
   - DeepSeek key & Redis URL configured in all environments.
   - Prisma migrations deployed (`20251108000100_open_evidence_v2_pr1`).
2. **Code**
   - `main` contains the accepted changes for planner/vetter/engine/UI.
3. **Database**
   - Run `npx prisma migrate deploy` (if not yet applied in target env).
4. **Redis**
   - Flush old discovery keys if migrating from legacy (optional). Keys are namespaced by `patchId` and will naturally expire.
5. **Frontends**
   - Ensure Next.js build has feature flags available via environment variables.
6. **Docs / Runbooks**
   - Share this rollout doc with ops/on-call.

---

## 5. Acceptance Validation
Perform on staging before enabling in production.

### 5.1 Automated Tests
```bash
cd carrot
npm install
npm run lint
npm test
```
Jest suites cover planner defaults, vetter normalisation, dedupe tiers, and acceptance logic.

### 5.2 Functional Smoke Test
1. Flip `DISCOVERY_V21=true` for staging.
2. Navigate to `/patch/[handle]` (two-column UI) and click “Start Discovery”.
3. Verify:
   - Skeleton tile appears immediately, live panel shows stage progression.
   - First saved card arrives median ≤ 4 s (check SSE logs + metrics endpoint).
   - Cards include hero, `Why it matters`, 3–6 facts, quotes (≤3) with provenance.
   - Controversy ratio maintained (watch for banner when relevant).
4. Restart run to ensure no duplicates are inserted (DB unique constraint + logs).

### 5.3 Audit Console
- Visit `/admin/discovery/audit/[handle]`.
- Confirm:
  - Stream table lists every decision (frontier_pop → canonicalize → duplicate checks → vetter etc.).
  - Filters (status, provider, reason, contested, angle) apply correctly.
  - Export JSON downloads latest entries.
  - Live badge shows stream connectivity; if disconnected, reconnect within 3 s.

### 5.4 Metrics Snapshot
`GET /api/patches/[handle]/discovery/metrics` (optionally `?runId=...`)
- Response contains tracker + acceptance summary.
- Check counters (total, controversy, history) and ensure `timeToFirstMs` present once first card saved.
- Use to verify quotas (controversy ≥ 50% per four, history ≥ 3 in first 12).

### 5.5 Acceptance Checklist (per run)
| Criterion | Validation |
| --- | --- |
| Time-to-first card ≤ 4 s median | Metrics snapshot `metrics.timeToFirstMs`; audit timestamps |
| Coverage – every planner angle within first 20 cards | Acceptance result `failures`, audit `Angles covered` widgets |
| Contested coverage – first contested card ≤ 10 cards when applicable | Acceptance result `details.contestedHitIndex` |
| No duplicates saved | DB constraint + audit `duplicate_check` only logs `fail`, no `save` duplicates |
| View Source operational | Card `viewSource` button enabled; acceptance failure `view_source_failed` absent |

If any criterion fails, inspect structured logs (console JSON) and audit events; rerun after fixes.

---

## 6. Observability & Operations
- **Structured Logs**: every stage emits JSON (`source: discovery_engine_v21`). Central logging can filter by `runId` or event (`saved`, `duplicate_seen`, `processing_error`, `run_complete`).
- **Redis Counters**: `discovery:counters:{patchId}` tracks totals; cleared at run start.
- **Metrics Snapshots**: `discovery:metrics:run:{runId}` TTL 6 h for last snapshot; also mirrored per patch.
- **Audit Stream**: uses in-memory `EventEmitter`; on restart, subscribe via `/audit/stream`.

---

## 7. Rollback / Kill Switch
1. Set `DISCOVERY_KILLSWITCH=true` to stop new runs immediately (API returns 503).
2. Flip `DISCOVERY_V21=false` to route clients back to legacy engine/UI.
3. Optional: leave `OPEN_EVIDENCE_V2` on (guides are backward compatible) or disable if planner issues persist.
4. Cleanup: delete Redis keys `plan:run:*`, `frontier:patch:*`, `counters:patch:*` if needed.

---

## 8. Release Notes Summary
- Discovery pipeline now uses DeepSeek planner/vetter (strict JSON, fairness prompts).
- One-by-one frontier with controversy/history prioritisation.
- SSE UI upgraded (two-column layout, skeleton tile, contested banners).
- Audit trail persisted + streamed for every decision.
- Metrics snapshots + acceptance evaluation attached to each run.
- Guide generation moved to patch creation + backfill script available.

For questions ping #discovery-platform or consult the audit dashboard.
