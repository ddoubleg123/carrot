# Discovery Fixes - TODO List

## Executive Summary

**Single Bottleneck**: The verification step uses HEAD, gets 403, and **returns early**—so extraction/scoring/saving never run. Failed citations are then re-selected (loop). 

**Fix Strategy**: Replace HEAD-only gate with HEAD→GET fallback, mark failed items as `scanned_denied`, wire extraction+logs, add self-audit verification, and backfill.

---

## Critical Fixes (Priority 1 - Blocking Saves)

### 1. Kill the HEAD-only Gate ⚠️ CRITICAL

**Problem**: HEAD requests get 403, function returns early, extraction/scoring/save never run.

**Solution**: Replace hard HEAD→early return with try HEAD → on 403/405/>=400 fallback to GET.

**Implementation**:
```typescript
// In wikipediaProcessor.ts, replace verification section (lines 835-855)

const reqHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

let response: Response | null = null
let html = ''
let ok = false
let status = 0

// Try HEAD first (lightweight)
try {
  response = await fetch(citationUrl, {
    method: 'HEAD',
    headers: reqHeaders,
    redirect: 'follow',
    signal: AbortSignal.timeout(10000)
  })
  status = response.status
  ok = response.ok
} catch (error) {
  // HEAD failed, will try GET
}

// Fallback to GET if HEAD failed or returned 403/405/>=400
if (!ok || status >= 400) {
  try {
    response = await fetch(citationUrl, {
      method: 'GET',
      headers: reqHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(30000) // 30s for GET
    })
    status = response.status
    ok = response.ok
    
    if (ok && response.status >= 200 && response.status < 300) {
      html = await response.text() // Pass along to extractor
    }
  } catch (error) {
    // GET also failed
  }
}

// Only fail if both HEAD and GET failed
if (!ok || !html) {
  const errorMessage = `HTTP ${status} - both HEAD and GET failed`
  console.log(`[WikipediaProcessor] Citation "${nextCitation.citationTitle}" verification failed: ${errorMessage}`)
  await markCitationVerificationFailed(
    nextCitation.id,
    errorMessage
  )
  // Mark as scanned_denied to prevent re-selection
  await markCitationScanned(
    nextCitation.id,
    'denied',
    null,
    undefined,
    '',
    undefined
  )
  await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
  return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
}

// Continue to extraction if we got HTML
// (html is now available, proceed to content extraction)
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikipediaProcessor.ts` (lines 835-855)

**Success Criteria**:
- ≥90% of citations reach extraction (`content_extract` logged)
- No early returns on 403 errors (fallback to GET)

---

### 2. Stop the Re-selection Loop ⚠️ CRITICAL

**Problem**: Failed citations are re-selected because `scanStatus` isn't updated.

**Solution**: When verification fails, set `scanStatus = 'scanned_denied'` and `relevanceDecision = 'denied_verify'`.

**Implementation**:
```typescript
// Update markCitationVerificationFailed in wikipediaCitation.ts
export async function markCitationVerificationFailed(
  citationId: string,
  errorMessage: string
): Promise<void> {
  await prisma.wikipediaCitation.update({
    where: { id: citationId },
    data: {
      verificationStatus: 'failed',
      errorMessage,
      scanStatus: 'scanned_denied', // NEW: Prevent re-selection
      relevanceDecision: 'denied_verify' // NEW: Mark as denied
    }
  })
}

// Update getNextCitationToProcess query in wikipediaCitation.ts
// BEFORE:
WHERE verificationStatus IN ('pending','verified','failed')
  AND scanStatus IN ('not_scanned','scanning')
  AND relevanceDecision IS NULL

// AFTER:
WHERE verificationStatus IN ('pending','verified')
  AND scanStatus = 'not_scanned'
  AND relevanceDecision IS NULL
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikipediaCitation.ts` (lines 250-261, 123-125)

**Success Criteria**:
- No repeating `verify_fail` for the same URL in the same run
- Failed citations don't appear in `getNextCitationToProcess` results

---

### 3. Always Attempt Extraction if We Got HTML ⚠️ CRITICAL

**Problem**: Even when GET succeeds, extraction may not run if HEAD failed.

**Solution**: If GET succeeded (200≤status<300) and `html.length>0`, go straight to extraction chain.

**Implementation**:
```typescript
// In wikipediaProcessor.ts, after verification (line 855+)
// If we have HTML from GET fallback, use it directly

if (html && html.length > 0) {
  // Skip the fetch step, use html we already have
  // Proceed directly to content extraction (line 870+)
} else {
  // Normal flow: fetch content
  response = await fetch(citationUrl, {
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  html = await response.text()
}

// Continue with extraction chain (Readability → ContentExtractor → fallback)
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikipediaProcessor.ts` (lines 857-870)

**Success Criteria**:
- Citations that succeed via GET fallback reach extraction
- No duplicate fetches when HTML already available

---

## High Priority Fixes (Priority 2)

### 4. Add Structured Logs for Each Gate

**Problem**: No visibility into why citations fail at each stage.

**Solution**: Add structured JSON logs for each processing gate.

**Implementation**:
```typescript
// Add these logs throughout wikipediaProcessor.ts:

// After verification fails
console.info(JSON.stringify({
  tag: 'verify_fail',
  url: citationUrl,
  status: status,
  method: 'HEAD' // or 'GET' if fallback used
}))

// After content extraction (already exists, verify it's working)
console.info(JSON.stringify({
  tag: 'content_extract',
  url: citationUrl,
  method: extractionMethod, // 'readability' | 'content-extractor' | 'fallback-strip'
  textBytes: textBytes,
  paragraphCount: paragraphCount
}))

// After validation fails (already exists, verify it's working)
console.warn(JSON.stringify({
  tag: 'content_validate_fail',
  url: citationUrl,
  reason: 'min_len_500' | 'min_len_800_for_ai' | 'not_article',
  textBytes: meaningfulContent.length,
  paragraphCount: paragraphCount,
  method: extractionMethod
}))

// After AI scoring
console.info(JSON.stringify({
  tag: 'ai_score',
  url: citationUrl,
  score: aiPriorityScore,
  threshold: RELEVANCE_THRESHOLD,
  isRelevant: scoringResult.isRelevant,
  reason: scoringResult.reason
}))

// After save (already exists, verify it's working)
console.info(JSON.stringify({
  tag: 'content_saved',
  url: citationUrl,
  textBytes: textBytes,
  score: aiPriorityScore,
  hero: heroTriggered
}))
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikipediaProcessor.ts` (add logs at key points)

**Success Criteria**:
- All gates have structured logs
- Logs are parseable JSON for analysis
- No log spam (use appropriate log levels)

---

### 5. Self-Audit Verification Function ⚠️ NEW REQUIREMENT

**Problem**: Need to verify that all external URLs from each Wikipedia page are accounted for and working.

**Solution**: Create a self-auditing function that:
1. Fetches a Wikipedia page
2. Extracts all external URLs (not Wikipedia internal)
3. Checks database for each URL
4. Verifies status (pending/verified/failed/saved)
5. Reports discrepancies

**Implementation**:
```typescript
// New file: carrot/src/lib/discovery/wikipediaAudit.ts

import { prisma } from '@/lib/prisma'
import { extractAllExternalUrls } from './wikiUtils'

export interface AuditResult {
  wikipediaPage: string
  wikipediaUrl: string
  totalExternalUrls: number
  foundInDatabase: number
  missingFromDatabase: number
  statusBreakdown: {
    pending: number
    verified: number
    failed: number
    saved: number
    denied: number
  }
  missingUrls: string[]
  discrepancies: Array<{
    url: string
    expectedStatus: string
    actualStatus: string
  }>
}

export async function auditWikipediaPageReferences(
  patchId: string,
  wikipediaTitle: string
): Promise<AuditResult> {
  // 1. Fetch Wikipedia page
  const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikipediaTitle)}`
  const response = await fetch(wikipediaUrl, {
    headers: {
      'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Wikipedia page: ${response.status}`)
  }
  
  const html = await response.text()
  
  // 2. Extract all external URLs (not Wikipedia internal)
  const externalUrls = extractAllExternalUrls(html, wikipediaUrl)
  const totalExternalUrls = externalUrls.length
  
  // 3. Get monitoring entry for this page
  const monitoring = await prisma.wikipediaMonitoring.findFirst({
    where: {
      patchId,
      wikipediaTitle
    },
    include: {
      citations: {
        select: {
          citationUrl: true,
          verificationStatus: true,
          scanStatus: true,
          relevanceDecision: true,
          savedContentId: true
        }
      }
    }
  })
  
  if (!monitoring) {
    return {
      wikipediaPage: wikipediaTitle,
      wikipediaUrl,
      totalExternalUrls,
      foundInDatabase: 0,
      missingFromDatabase: totalExternalUrls,
      statusBreakdown: {
        pending: 0,
        verified: 0,
        failed: 0,
        saved: 0,
        denied: 0
      },
      missingUrls: externalUrls.map(u => u.url),
      discrepancies: []
    }
  }
  
  // 4. Check each external URL against database
  const dbUrls = new Map(
    monitoring.citations.map(c => [c.citationUrl, c])
  )
  
  const foundInDatabase = externalUrls.filter(u => dbUrls.has(u.url)).length
  const missingFromDatabase = totalExternalUrls - foundInDatabase
  const missingUrls = externalUrls
    .filter(u => !dbUrls.has(u.url))
    .map(u => u.url)
  
  // 5. Status breakdown
  const statusBreakdown = {
    pending: monitoring.citations.filter(c => c.verificationStatus === 'pending').length,
    verified: monitoring.citations.filter(c => c.verificationStatus === 'verified').length,
    failed: monitoring.citations.filter(c => c.verificationStatus === 'failed').length,
    saved: monitoring.citations.filter(c => c.savedContentId).length,
    denied: monitoring.citations.filter(c => c.relevanceDecision === 'denied').length
  }
  
  // 6. Find discrepancies (URLs that should be in DB but aren't, or have wrong status)
  const discrepancies: Array<{ url: string; expectedStatus: string; actualStatus: string }> = []
  
  for (const extUrl of externalUrls) {
    const dbCitation = dbUrls.get(extUrl.url)
    if (!dbCitation) {
      discrepancies.push({
        url: extUrl.url,
        expectedStatus: 'should_exist',
        actualStatus: 'missing'
      })
    }
  }
  
  return {
    wikipediaPage: wikipediaTitle,
    wikipediaUrl,
    totalExternalUrls,
    foundInDatabase,
    missingFromDatabase,
    statusBreakdown,
    missingUrls,
    discrepancies
  }
}

// API endpoint to trigger audit
// New file: carrot/src/app/api/test/extraction/audit/route.ts
export async function POST(req: Request) {
  const { patchHandle, wikipediaTitle } = await req.json()
  
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })
  
  if (!patch) {
    return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
  }
  
  const auditResult = await auditWikipediaPageReferences(patch.id, wikipediaTitle)
  
  return NextResponse.json(auditResult)
}
```

**Files to Create**:
- `carrot/src/lib/discovery/wikipediaAudit.ts`
- `carrot/src/app/api/test/extraction/audit/route.ts`

**Files to Modify**:
- `carrot/src/app/test/extraction/page.tsx` (add "Audit" button)

**Success Criteria**:
- Audit function correctly identifies missing URLs
- Audit reports status breakdown accurately
- Can be triggered from extraction test page

---

### 6. Backfill Pass Script

**Problem**: Previously failed citations need to be reprocessed with new fixes.

**Solution**: Script to reprocess citations where `scanStatus IN ('not_scanned','scanned_denied')` and `updatedAt > <cutoff>`.

**Implementation**:
```typescript
// New file: carrot/scripts/backfill-failed-citations.ts

import { prisma } from '../src/lib/prisma'
import { reprocessCitation } from '../src/lib/discovery/wikipediaProcessor'
import pLimit from 'p-limit'

async function main() {
  const patchHandle = process.argv[2] || 'israel'
  const cutoffDays = Number(process.argv[3]) || 7 // Default: last 7 days
  const concurrency = Number(process.argv[4]) || 5
  const limit = Number(process.argv[5]) || 500
  
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })
  
  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - cutoffDays)
  
  // Find citations to reprocess
  const citations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: { in: ['not_scanned', 'scanned_denied'] },
      updatedAt: { gte: cutoffDate }
    },
    take: limit,
    orderBy: { updatedAt: 'desc' }
  })
  
  console.log(`Found ${citations.length} citations to reprocess`)
  console.log(`Cutoff date: ${cutoffDate.toISOString()}`)
  console.log(`Concurrency: ${concurrency}`)
  
  const limitConc = pLimit(concurrency)
  let success = 0
  let failed = 0
  const failedUrls: string[] = []
  
  await Promise.all(
    citations.map(citation =>
      limitConc(async () => {
        try {
          const result = await reprocessCitation(citation.id)
          if (result.processed && result.saved) {
            success++
            console.log(`✅ Reprocessed and saved: ${citation.citationUrl}`)
          } else if (result.processed) {
            success++
            console.log(`⚠️ Reprocessed but not saved: ${citation.citationUrl}`)
          } else {
            failed++
            failedUrls.push(citation.citationUrl)
            console.log(`❌ Failed to reprocess: ${citation.citationUrl}`)
          }
        } catch (error) {
          failed++
          failedUrls.push(citation.citationUrl)
          console.error(`❌ Error reprocessing ${citation.citationUrl}:`, error)
        }
      })
    )
  )
  
  console.log(`\n=== Backfill Complete ===`)
  console.log(`Success: ${success}`)
  console.log(`Failed: ${failed}`)
  if (failedUrls.length > 0) {
    console.log(`\nFailed URLs (first 10):`)
    failedUrls.slice(0, 10).forEach(url => console.log(`  - ${url}`))
  }
}

main().catch(console.error)
```

**Files to Create**:
- `carrot/scripts/backfill-failed-citations.ts`

**Success Criteria**:
- Script successfully reprocesses failed citations
- Concurrency limit prevents hammering
- Reports success/failure rates

---

## Medium Priority Fixes (Priority 3)

### 7. Idempotency + Rate Limits

**Problem**: Same URL can be processed in parallel, causing duplicate work and hammering sites.

**Solution**: Add job queue with idempotency keys and per-domain rate limits.

**Implementation**:
```typescript
// Add to wikipediaProcessor.ts

// Idempotency: hash(patchId|canonicalUrl)
import { createHash } from 'crypto'

function getJobKey(patchId: string, url: string): string {
  const canonicalUrl = canonicalizeUrlFast(url) || url
  return createHash('sha256')
    .update(`${patchId}|${canonicalUrl}`)
    .digest('hex')
    .substring(0, 16)
}

// Rate limiter per domain
const domainRateLimits = new Map<string, { count: number; resetAt: number }>()

async function checkRateLimit(domain: string): Promise<boolean> {
  const limit = domainRateLimits.get(domain)
  const now = Date.now()
  
  if (!limit || now > limit.resetAt) {
    domainRateLimits.set(domain, { count: 1, resetAt: now + 1000 }) // 1 second window
    return true
  }
  
  if (limit.count >= 2) { // 2 requests per second
    return false
  }
  
  limit.count++
  return true
}
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikipediaProcessor.ts`

**Success Criteria**:
- No duplicate processing of same URL
- Rate limits prevent 403 errors
- Per-domain tracking works correctly

---

### 8. Success Criteria (SLOs)

**Problem**: No clear metrics to verify fixes are working.

**Solution**: Define and track success criteria.

**Success Criteria**:
- For next run of 50 citations:
  - ≥90% reach **extraction** (`content_extract` logged)
  - ≥60% pass **min-len 500**
  - ≥40% pass **isArticle** (1000/3 paras)
  - ≥20% reach **save** (`content_saved`) with score ≥60
- `debug-saved` shows **Text Length > 800** on new rows
- Heroes appear for saved content
- No repeating `verify_fail` for same URL in same run

**Implementation**:
```typescript
// Add metrics tracking to wikipediaProcessor.ts

interface ProcessingMetrics {
  totalProcessed: number
  reachedExtraction: number
  passedMinLen500: number
  passedIsArticle: number
  reachedSave: number
  savedWithScore60Plus: number
  verifyFailures: Map<string, number>
}

const metrics: ProcessingMetrics = {
  totalProcessed: 0,
  reachedExtraction: 0,
  passedMinLen500: 0,
  passedIsArticle: 0,
  reachedSave: 0,
  savedWithScore60Plus: 0,
  verifyFailures: new Map()
}

// Log metrics at end of processing
console.info(JSON.stringify({
  tag: 'processing_metrics',
  metrics: {
    totalProcessed: metrics.totalProcessed,
    extractionRate: (metrics.reachedExtraction / metrics.totalProcessed * 100).toFixed(1) + '%',
    minLen500Rate: (metrics.passedMinLen500 / metrics.totalProcessed * 100).toFixed(1) + '%',
    isArticleRate: (metrics.passedIsArticle / metrics.totalProcessed * 100).toFixed(1) + '%',
    saveRate: (metrics.reachedSave / metrics.totalProcessed * 100).toFixed(1) + '%',
    savedWithScore60Plus: metrics.savedWithScore60Plus
  }
}))
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikipediaProcessor.ts`

**Success Criteria**:
- Metrics are logged after each batch
- SLOs are met in test runs

---

## Optional Improvements (Priority 4)

### 9. Softening Gates (Temporary)

**Problem**: While stabilizing, gates may be too strict.

**Solution**: Temporarily allow AI scoring down to 600 chars (keep isArticle at 1000/3 paras for save).

**Implementation**:
```typescript
// In wikipediaProcessor.ts, adjust minimums temporarily

// Allow AI scoring at 600 chars (down from 800)
if (meaningfulContent.length < 600) { // Changed from 800
  // ... validation fail
}

// Keep isArticle check at 1000/3 paras for save
// (no change needed)
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikipediaProcessor.ts`

**Note**: This is temporary - revert after stabilization.

---

### 10. Per-Domain "Force GET" Flag

**Problem**: Some sites reject HEAD but allow GET.

**Solution**: Maintain a list of domains that should always use GET.

**Implementation**:
```typescript
// Domains that reject HEAD
const FORCE_GET_DOMAINS = [
  'gov.il',
  'nba.com',
  'espn.com'
  // Add more as discovered
]

function shouldForceGet(url: string): boolean {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '')
    return FORCE_GET_DOMAINS.some(d => domain.includes(d))
  } catch {
    return false
  }
}

// In verification:
if (shouldForceGet(citationUrl)) {
  // Skip HEAD, go straight to GET
} else {
  // Try HEAD first
}
```

**Files to Modify**:
- `carrot/src/lib/discovery/wikipediaProcessor.ts`

---

## Implementation Order

1. **Fix 1**: Kill HEAD-only gate (unblocks everything)
2. **Fix 2**: Stop re-selection loop (prevents infinite loops)
3. **Fix 3**: Always attempt extraction (ensures HTML is used)
4. **Fix 4**: Add structured logs (visibility)
5. **Fix 5**: Self-audit verification (NEW requirement)
6. **Fix 6**: Backfill script (reprocess failed)
7. **Fix 7**: Idempotency + rate limits (prevent hammering)
8. **Fix 8**: Success criteria (verify fixes work)
9. **Fix 9**: Softening gates (temporary, if needed)
10. **Fix 10**: Per-domain force GET (optimization)

---

## Testing Checklist

After implementing fixes:

- [ ] Run discovery on test patch
- [ ] Verify ≥90% reach extraction (check logs)
- [ ] Verify ≥20% reach save (check logs)
- [ ] Run self-audit on Zionism page
- [ ] Verify no duplicate processing
- [ ] Verify rate limits working
- [ ] Check SLOs are met
- [ ] Run backfill script on failed citations
- [ ] Verify saved content appears in UI

---

## Notes

- **Extraction/Validation/AI/Save are NEVER invoked** on failing items - make this explicit in code comments
- All fixes should be backward compatible
- Logs should be structured JSON for easy parsing
- Self-audit should run automatically or be triggerable from UI

