# Wikipedia Discovery Process - Step-by-Step Flow

## Overview
This document explains the complete step-by-step process of how Wikipedia monitoring and citation processing works in the discovery system.

---

## Phase 1: Patch Creation & Initialization

### Step 1.1: User Creates a Patch
- User creates a new patch (group page) via the UI
- Provides: **Page Name** (e.g., "Chicago Bulls") and **Key Terms/Tags** (e.g., "michael jordan", "basketball", "nba")

### Step 1.2: Wikipedia Monitoring Initialization (Automatic)
**Location:** `carrot/src/app/api/patches/route.ts` (POST endpoint)

1. **Extract Search Terms**
   - Uses patch `entity.name` as primary search term
   - Uses `entity.aliases` or `tags` as additional search terms
   - Example: "Chicago Bulls" + ["michael jordan", "chicago bulls", "basketball", "nba"]

2. **Search Wikipedia** (Background Task)
   - Calls `initializeWikipediaMonitoring(patchId, pageName, searchTerms)`
   - Searches Wikipedia API for each term (up to 5 results per term)
   - Finds unique Wikipedia pages matching the search terms

3. **Store Pages in Database**
   - Creates records in `wikipedia_monitoring` table
   - Each page stored with:
     - `patchId`: Links to the patch
     - `wikipediaUrl`: Full Wikipedia URL
     - `wikipediaTitle`: Page title
     - `searchTerm`: Which search term found it
     - `status`: Set to `'pending'`
     - `priority`: Initial relevance score (0-100)
   - **Result:** 20 Wikipedia pages stored for "Chicago Bulls"

**Status After Phase 1:**
- ✅ Wikipedia pages stored in database
- ⏳ All pages marked as `status: 'pending'`
- ⏳ No citations extracted yet

---

## Phase 2: Discovery Run Starts

### Step 2.1: User Starts Discovery
- User clicks "Start Discovery" on the patch page
- Creates a new `DiscoveryRun` record
- Discovery engine v2.1 (`engineV21.ts`) starts

### Step 2.2: Discovery Loop Begins
**Location:** `carrot/src/lib/discovery/engineV21.ts` - `discoveryLoop()` method

The discovery loop runs continuously, processing candidates from the frontier. **Every 30 seconds OR every 10 candidates**, it triggers Wikipedia incremental processing.

---

## Phase 3: Wikipedia Incremental Processing (Periodic)

### Step 3.1: Trigger Check
**Location:** `carrot/src/lib/discovery/engineV21.ts` line ~553

```typescript
// Every 30 seconds OR every 10 candidates processed
if (now - lastWikipediaProcessTime > 30000 || candidateCount % 10 === 0) {
  await processWikipediaIncremental(...)
}
```

### Step 3.2: Process Next Wikipedia Page
**Location:** `carrot/src/lib/discovery/wikipediaProcessor.ts` - `processWikipediaIncremental()`

**A. Get Next Pending Page**
1. Query `wikipedia_monitoring` table for:
   - `patchId` = current patch
   - `status` = `'pending'` OR `'error'`
   - Ordered by `priority DESC` (highest priority first)
   - Limit: `maxPagesPerRun` (default: 1 page per run)

2. If no pages found → Skip to citation processing

**B. Mark Page as Scanning**
- Update page status: `'pending'` → `'scanning'`
- Set `lastScannedAt` = now

**C. Fetch Wikipedia Page**
- Fetch full HTML from Wikipedia API
- Extract main content text
- Store content in `wikipedia_monitoring.contentText`

**D. Extract Citations**
- Parse HTML to find all `<cite>` tags and reference links
- Extract up to 50 citations with:
  - `sourceNumber`: Reference number on the page (e.g., [1], [2])
  - `citationUrl`: The actual URL being cited
  - `citationTitle`: Title if available
  - `citationContext`: Surrounding text context

**E. AI Prioritization**
- Calls `prioritizeCitations()` function (uses DeepSeek AI)
- Scores each citation 0-100 based on:
  - Relevance to topic
  - Source authority
  - Information value
  - Recency
- Sorts by score (highest first)
- Takes top 25 citations

**F. Store Citations in Database**
- Creates records in `wikipedia_citations` table
- Each citation stored with:
  - `monitoringId`: Links to the Wikipedia page
  - `sourceNumber`: Original reference number
  - `citationUrl`: The cited URL
  - `citationTitle`: Title if available
  - `citationContext`: Context text
  - `aiPriorityScore`: AI-assigned score (0-100)
  - `verificationStatus`: `'pending'`
  - `scanStatus`: `'not_scanned'`

**G. Mark Page Complete**
- Update page:
  - `status`: `'scanning'` → `'completed'`
  - `contentScanned`: `true`
  - `citationsExtracted`: `true`
  - `citationCount`: Number of citations stored
  - `lastExtractedAt`: now

**Status After Page Processing:**
- ✅ Page content stored
- ✅ Citations extracted and stored
- ✅ Citations prioritized by AI
- ⏳ Citations ready for processing

---

## Phase 4: Citation Processing (Incremental)

### Step 4.1: Get Next Citation to Process
**Location:** `carrot/src/lib/discovery/wikipediaProcessor.ts` - `processWikipediaIncremental()`

1. Query `wikipedia_citations` table for:
   - `verificationStatus` = `'pending'`
   - `scanStatus` = `'not_scanned'`
   - Ordered by `aiPriorityScore DESC` (highest priority first)
   - Limit: `maxCitationsPerRun` (default: 3 citations per run)

2. If no citations found → Processing complete for this cycle

### Step 4.2: Verify Citation URL
**Location:** `carrot/src/lib/discovery/wikipediaProcessor.ts` - `processNextCitation()`

**A. Mark Citation as Verifying**
- Update: `verificationStatus` = `'pending'` → `'verifying'`
- Set `lastVerifiedAt` = now

**B. Check URL Validity**
- Attempt HEAD request to citation URL
- Check if URL is accessible (200, 301, 302 OK)
- If fails → Mark as `verificationStatus: 'failed'`

### Step 4.3: Fetch Citation Content
**A. Mark Citation as Scanning**
- Update: `scanStatus` = `'not_scanned'` → `'scanning'`
- Set `lastScannedAt` = now

**B. Fetch Content**
- Fetch full HTML from citation URL
- Extract text content
- Check for paywalls/blocking

**C. Check Relevance**
- Use AI (DeepSeek) to determine if content is relevant to the patch topic
- Returns: `relevant: true/false` + `reason`

### Step 4.4: Save Relevant Citations

**If Relevant:**

**A. Save to DiscoveredContent**
- Calls `saveAsContent(url, title, content)` callback
- Currently returns `null` (placeholder for future integration)
- Would create `DiscoveredContent` record with:
  - Full article content
  - Metadata (title, URL, domain, etc.)
  - Links back to `WikipediaCitation` via `savedContentId`

**B. Save to AgentMemory**
- Calls `saveAsMemory(url, title, content, patchHandle)` callback
- Finds agents associated with the patch
- Creates `AgentMemory` record with:
  - `content`: Article text (max 5000 chars)
  - `sourceType`: `'wikipedia_citation'`
  - `sourceUrl`: Citation URL
  - `sourceTitle`: Citation title
  - `tags`: [patchHandle, 'wikipedia', 'citation']
  - Links back to `WikipediaCitation` via `savedMemoryId`

**C. Mark Citation as Saved**
- Update citation:
  - `relevanceDecision`: `'saved'`
  - `savedContentId`: ID if saved to DiscoveredContent
  - `savedMemoryId`: ID if saved to AgentMemory
  - `scanStatus`: `'scanning'` → `'scanned'`

**If Not Relevant:**
- Update citation:
  - `relevanceDecision`: `'denied'`
  - `scanStatus`: `'scanning'` → `'scanned'`

**Status After Citation Processing:**
- ✅ Citation verified and scanned
- ✅ Relevance checked
- ✅ Saved to AgentMemory (if relevant)
- ✅ Linked back to WikipediaCitation record

---

## Phase 5: Incremental Resume

### Step 5.1: Discovery Run Continues
- Discovery loop continues processing other candidates
- Every 30 seconds, Wikipedia processing runs again
- Processes next pending page + next 3 pending citations

### Step 5.2: Discovery Run Stops/Resumes
- If discovery stops (user stops, timeout, etc.):
  - All state is preserved in database
  - Pages remain at their current status
  - Citations remain at their current status

### Step 5.3: Next Discovery Run
- When discovery starts again:
  - Queries for pages with `status: 'pending'` or `'error'`
  - Queries for citations with `verificationStatus: 'pending'`
  - **Resumes from where it left off**
  - No duplicate processing

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Patch Creation                                     │
├─────────────────────────────────────────────────────────────┤
│ 1. User creates patch with name + tags                      │
│ 2. initializeWikipediaMonitoring() called (background)      │
│ 3. Search Wikipedia for each term                           │
│ 4. Store 20 pages in wikipedia_monitoring (status: pending) │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: Discovery Starts                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. User clicks "Start Discovery"                            │
│ 2. Discovery engine v2.1 starts                             │
│ 3. Main discovery loop begins                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Periodic Wikipedia Processing (Every 30s)           │
├─────────────────────────────────────────────────────────────┤
│ LOOP:                                                        │
│   ├─ Process 1 Wikipedia page (if pending)                  │
│   │   ├─ Fetch page HTML                                    │
│   │   ├─ Extract content → store in DB                      │
│   │   ├─ Extract citations (up to 50)                        │
│   │   ├─ AI prioritize (top 25)                             │
│   │   └─ Store citations in DB (status: pending)           │
│   │                                                          │
│   └─ Process 3 citations (if pending)                       │
│       ├─ Verify URL accessibility                           │
│       ├─ Fetch citation content                             │
│       ├─ AI check relevance                                  │
│       └─ If relevant: Save to AgentMemory                   │
│                                                              │
│   Wait 30 seconds (or 10 candidates) → Repeat                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: Incremental Progress                                │
├─────────────────────────────────────────────────────────────┤
│ - Pages processed: 1 → 2 → 3 → ... → 20                     │
│ - Citations processed: 3 → 6 → 9 → ... → all                │
│ - Content saved: 0 → 1 → 2 → ... → N                        │
│ - State preserved in database                               │
│ - Can resume after stop/restart                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. **Incremental Processing**
- Processes 1 page + 3 citations per cycle
- Runs every 30 seconds during discovery
- State preserved in database
- Can resume after interruption

### 2. **AI Prioritization**
- Citations scored 0-100 by DeepSeek AI
- Top 25 citations per page processed
- Relevance checked before saving

### 3. **Dual Storage**
- **DiscoveredContent**: Full article storage (future)
- **AgentMemory**: Knowledge for AI agents (active)

### 4. **Resume Capability**
- Database tracks status of every page and citation
- Next run picks up where previous left off
- No duplicate processing

### 5. **Error Handling**
- Failed pages marked as `status: 'error'`
- Failed citations marked as `verificationStatus: 'failed'`
- Can retry failed items on next run

---

## Current Status for Chicago Bulls

After initialization:
- ✅ **20 pages** stored in database
- ⏳ **0 pages** processed (all pending)
- ⏳ **0 citations** extracted
- ⏳ **0 citations** saved

**Next Step:** Run discovery to trigger Phase 3 processing

---

## Monitoring & Debugging

### Audit Tool
```bash
npx tsx scripts/audit-wikipedia-discovery.ts chicago-bulls
```

### API Endpoint
```
GET /api/patches/chicago-bulls/wikipedia-status
```

### Database Queries
```sql
-- Check pages
SELECT status, COUNT(*) FROM wikipedia_monitoring 
WHERE patch_id = '...' GROUP BY status;

-- Check citations
SELECT verification_status, scan_status, COUNT(*) 
FROM wikipedia_citations 
WHERE monitoring_id IN (SELECT id FROM wikipedia_monitoring WHERE patch_id = '...')
GROUP BY verification_status, scan_status;
```

