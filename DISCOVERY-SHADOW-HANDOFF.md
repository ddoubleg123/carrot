## Discovery V2 Shadow – Handoff Notes

### Purpose
Capture the current state of the “wiki-only frontier” remediation work, what has already landed in the repo, the blockers that are preventing telemetry validation, and the exact next actions for the next assistant / teammate to pick up.

---

### 1. Current Objectives
- Keep Discovery V2 **shadow-only** and guarantee non-wiki seed/expansion coverage.
- Enforce new first-wave diversity quotas (hosts, angles, viewpoints) and ensure reseed triggers fire automatically.
- Produce a verified shadow run (`chicago-bulls`) whose telemetry proves:
  - ≥6 distinct hosts in first 20 dequeues.
  - Wikipedia share ≤30% rolling/30s.
  - Non-null TTF-S (≥1 save).
  - `whyRejected` no longer dominated by `canonical_cooldown`.
  - Paywall branches observed (proves non-wiki fetches).

---

### 2. Code Changes Already Implemented

**Planner / Validator (`carrot/src/lib/discovery/planner.ts`)**
- `SYSTEM_PROMPT` now demands ≥10 seeds, ≤1 Wikipedia, ≥6 distinct non-wiki hosts, deep links (path depth ≥2), recency ≤24 months, and non-wiki `queries.{official,news,data,longform}`.
- `validatePlan` enforces:
  - `wikiSeedCount ≤ 1`
  - `distinctNonWikiHosts ≥ 6`
  - No shallow `seedCandidates` (path depth < 2) unless an allowed data exception.
  - All `queries` blocks populated with non-wiki filters.
- On validation failure, automatically switch to a fallback plan.
- Added `buildChicagoBullsFallbackSeeds` (10 non-wiki seeds specified by user).
- `seedFrontierFromPlan` has per-domain caps and enforces contested/establishment limits.

**Query Expander (`carrot/src/lib/discovery/queryExpander.ts`)**
- First 30 dequeues drop any `*.wikipedia.org` suggestions.
- Caps enforced: 5–10 deep-link suggestions, ≥3 non-wiki hosts, path depth ≥2, recency filters.
- “Citation harvest” path: Wikipedia sources now emit 10–20 *off-host*, non-wiki deep links sourced from External Links / References.

**Scheduler Guards (`carrot/src/lib/discovery/scheduler.ts` & `engineV21.ts`)**
- If first 5 dequeues produce <3 distinct hosts → immediate `reseed()` (reason `first5_host_diversity`).
- Wiki guard still down-weights when share >30%/30s, but Wikipedia is skipped entirely when `frontierDistinctHosts < 3`.
- Scheduler now requeues Wikipedia hosts with `wiki_low_diversity` reason in low-diversity conditions.

**First-Wave Policy (`carrot/src/lib/discovery/engineV21.ts`)**
- Tracks first 20 hosts, first 12 angles, first 12 viewpoints.
- Enforces:
  - ≥6 distinct hosts by dequeue 20.
  - ≥4 angles and ≥3 viewpoint buckets by dequeue 12.
  - If unmet by dequeue 10 → `reseed()` with entity-boost queries (`first10_mixture`).
- `emitMetricsSnapshot` exposes telemetry for the admin audit UI (`first20Hosts`, `first12Angles`, etc.).
- Added helpers for citation harvesting (`enqueueWikipediaReferences`, `enqueueHtmlOutgoingReferences`).

**Telemetry & Admin UI**
- `auditAnalytics.ts` and admin audit page now surface the new telemetry fields plus guard counters (wiki guard, host throttles, canonical cooldowns, etc.).
- `DiscoveryCardPayload` allows optional `heroScore`.

**Tests (V2-only)**
- `planner.contract.test.ts`: coverage for wiki-heavy rejection and valid non-wiki plan acceptance.
- `queryExpander.test.ts`: ensures no wiki suggestions in first 30 dequeues and citation harvest behavior.
- `scheduler.guards.test.ts`: verifies reseed trigger when hosts <3 after 5 dequeues and wiki-low-diversity logic.
- `audit.analytics.test.ts`: adjusts expectations for paywall branch payload structure.

**Tooling & Scripts**
- `next.config.js` now skips Next.js ESLint during shadow builds only (`DISCOVERY_V2_SHADOW_MODE=true`).
- `package.json` includes `build:shadow` script (`npm run build:shadow`).
- `scripts/run-shadow.ts` and `scripts/shadow-report.ts` hardened (error text fixes, added `prisma.$disconnect`, TLS-ready Redis URL handling).
- `src/lib/redis/discovery.ts` handles `rediss://` with TLS (`rejectUnauthorized:false`) and logs connection errors.

---

### 3. Outstanding Issues / Blockers
1. **Redis CLI with TLS still missing**  
   - The environment only has `redis-cli` 3.2 (no TLS). User insists we “install it.”  
   - Attempted download of Windows Redis 7.2.4 zip (`tporadowski/redis`). Need to finish extraction and add `redis-cli.exe` to PATH (or run directly) so we can use:  
     ```
     REDISCLI_AUTH=mc6N6wp4hW7rHSdNStw054K7EdI6Kes9 \
       redis-cli --tls -h singapore-keyvalue.render.com -p 6379 \
       -u red-d48gppur433s73a2mjlg
     ```
     (valkey-cli syntax also acceptable). No confirmation yet that CLI works.

2. **Shadow telemetry run still incomplete**  
   - `scripts/run-shadow.ts chicago-bulls` keeps failing because Redis connectivity couldn’t be established (TLS CLI missing, environment complaining “connection error”).  
   - Need a successful run that produces `bulls.audit.json` to extract the 10 telemetry items the user listed.

3. **Background worker state unknown**  
   - Multiple `npx tsx scripts/run-shadow.ts chicago-bulls` jobs might still be running (per system memo). Need to ensure no hung processes before rerunning.

4. **Todo items (from Cursor todo tool)**  
   - `Inspect shadow worker logs to see why no dequeues occur` (in progress).  
   - `Ensure frontier seeding adds ≥6 non-wiki hosts before reseed loop` (pending).  
   - Both depend on getting telemetry / logs from a real shadow run.

---

### 4. Environment / Credentials Notes
- `REDIS_URL` (shadow) = `rediss://red-d48gppur433s73a2mjlg:mc6N6wp4hW7rHSdNStw054K7EdI6Kes9@singapore-keyvalue.render.com:6379`
- CLI command supplied by user:  
  `REDISCLI_AUTH=mc6N6wp4hW7rHSdNStw054K7EdI6Kes9 valkey-cli --user red-d48gppur433s73a2mjlg -h singapore-keyvalue.render.com -p 6379 --tls`
- Worker env vars already staged in shell history:  
  ```
  DISCOVERY_V2=true
  DISCOVERY_V2_SHADOW_MODE=true
  DISCOVERY_V2_WRITE_MODE=false
  DISCOVERY_V2_MAX_ATTEMPTS_PER_RUN=120
  DISCOVERY_V2_MAX_PER_HOST_PER_RUN=20
  DISCOVERY_V2_QPS_PER_HOST=0.5
  NODE_ENV=production
  ```
- Build command for sanity: `npm run build:shadow`

---

### 5. Immediate Next Actions
1. **Finish Redis CLI install**
   - Extract `redis-7.2.4-win-x64.zip` (already downloaded to `%TEMP%\redis7.zip`).
   - Copy `redis-cli.exe` (and optionally `valkey-cli.exe` if present) into a stable path, e.g., `C:\Users\danie\RedisCLI\`.
   - Add that path to the current PowerShell `$env:PATH` (session-level is fine) and test connection with TLS using the provided command.

2. **Verify Redis connectivity**
   - Use the CLI to run `INFO SERVER` or `SCAN` on `discovery:shadow:*` to confirm we can reach the Render Valkey instance without the “connection error.”
   - Document the exact command and output for future reference.

3. **Run shadow workflow per runbook**
   - Export env vars (step 1 of runbook).
   - Start worker: `pnpm start:worker` (or current equivalent).
   - Trigger plan warm-up: `curl -s -X POST https://<host>/api/admin/discovery/backfill-plan -d '{"patch":"chicago-bulls"}'`.
   - Capture audit payload: `curl -s https://<host>/api/patches/chicago-bulls/audit | jq . > bulls.audit.json`.

4. **Extract + deliver telemetry bundle**
   - From `bulls.audit.json`, gather the 10 requested items:
     1. `ttfs`
     2. `frontier.frontierHosts` (first-20 distinct host count)  
     3. `frontier.viewpointBuckets` & `frontier.angleBuckets`  
     4. `rollingControversy`  
     5. `wikipediaShare`  
     6. Top 5 `whyRejected` reasons  
     7. Sample `paywallBranches[]` entries  
     8. `zeroSaveDiagnostics`  
     9. `topTenConversationCandidates[]`  
     10. Throttle/cooldown counters (QPS hits, canonical cooldown hits)

5. **Run sanity checks from runbook (A–D)**
   - `jq '.plan.seedCandidates | ...'` etc., confirm seeds diversity and first-20 host count.
   - Inspect `rollingControversy`, `wikipediaShare`, `wiki guard counters`.

6. **If wiki loops or zero-save persists**
   - Use `curl ... /discovery/operator` reseed payload (provided in runbook) and re-pull audit, then loop back through telemetry extraction.

---

### 6. Notes for Next Assistant / Chat
- User is frustrated about repeated “connection error” messages—priority is to demonstrate concrete CLI/Redis progress before attempting new code.
- Do **not** revert any existing changes; repo may be dirty.
- Maintain ASCII-only edits unless file already contains Unicode.
- Keep future work under `DISCOVERY_V2_SHADOW_MODE`; no production writes.
- When referencing this handoff, direct new assistants to `DISCOVERY-SHADOW-HANDOFF.md`.

---

### 7. Quick Reference Commands
```
# Install / verify redis-cli (after extraction)
Set-Location C:\Users\danie\RedisCLI
.\redis-cli.exe --version

# TLS connect (example)
SETX REDISCLI_AUTH mc6N6wp4hW7rHSdNStw054K7EdI6Kes9
.\redis-cli.exe --tls -h singapore-keyvalue.render.com -p 6379 \
  -u red-d48gppur433s73a2mjlg

# Shadow worker invocation
Set-Location C:\Users\danie\CascadeProjects\windsurf-project\carrot
pnpm start:worker

# Trigger plan + audit fetch
curl -s -X POST https://<host>/api/admin/discovery/backfill-plan \
  -H 'content-type: application/json' \
  -d '{"patch":"chicago-bulls"}'

curl -s https://<host>/api/patches/chicago-bulls/audit | jq . \
  > bulls.audit.json
```

---

Last updated: 2025-11-15 (by Cursor GPT agent per user request).

