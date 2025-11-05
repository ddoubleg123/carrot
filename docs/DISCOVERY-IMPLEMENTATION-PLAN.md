# Discovery Pipeline Redesign - Implementation Plan

**Status**: Active Implementation Plan  
**Last Updated**: January 2025  
**Goal**: Universal discovery engine that works for any Carrot Patch (team, topic, person, place) with fast, verifiable, high-signal results.

---

## 📋 Executive Summary

This document outlines the complete redesign of the Discovery pipeline to make it:
- **Universal**: Works for any patch type (team, person, org, place, topic)
- **Fast**: <4s time-to-first card
- **Verifiable**: Only topic-relevant items saved (explicit entity mention required)
- **High-signal**: Zero duplicates, every card has hero image, useful summaries with sources

### Key Improvements Over Current System

| Current System | New System |
|----------------|------------|
| Batch processing (5 items at once) | One item at a time (streaming) |
| 60s wait with no feedback | Real-time SSE progress updates |
| Relevance check: LLM only | Stricter: entity mention + LLM + filters |
| Items saved before image | Image required before save |
| No duplicate prevention | Redis + DB double-gate + SimHash |
| Generic web search only | Multi-provider: Wikipedia, RSS, official sites, web search |
| No dead link checking | HTTP validation (404/soft-404 blocked) |
| No quote limits | Max 3 quotes, ≤75 words total |

---

## 🎯 Objectives (Universal for All Patches)

1. **Only topic-relevant items** get saved (must explicitly reference patch entity in title/meta/first 150 words OR be primary source)
2. **One new item at a time** (search → vet → enrich → save → render) with **<2-4s** time-to-first card
3. **Zero duplicate inserts** across runs (Redis SET + DB unique constraint + SimHash near-dup)
4. **Every card has hero image** (AI first, Wikimedia fallback, skeleton if both fail)
5. **Visible progress** on frontend (live status + skeleton tile + SSE streaming)

---

## 📊 Data Model

### Shared Data Model (Per Patch)

```typescript
type Patch = {
  id: string;
  slug: string;                    // e.g., "chicago-bulls"
  entity: {
    name: string;                  // canonical entity name
    aliases: string[];             // nicknames, abbreviations
    type: "team"|"person"|"org"|"place"|"topic";
    key_entities: string[];        // notable people/venues/eras/domains
  };
  sources_whitelist?: string[];    // preferred domains
}

type DiscoveryItem = {
  patchId: string;
  sourceUrl: string;
  canonicalUrl: string;            // normalized URL after redirects
  finalUrl: string;                // final URL after redirects
  title: string;
  summary: string;
  whyItMatters: string;            // 1-2 sentences from TopicProfile
  facts: Array<{label: string; value: string}>;  // 3-6 fact bullets
  quotes: Array<{text: string; source: string}>; // ≤3 quotes, ≤75 words total
  quoteCharCount: number;          // enforce ≤75 words
  provenance: Array<{url: string; note?: string}>; // all sources
  publishedAt?: Date;
  hero: {
    url: string;
    source: 'ai'|'wikimedia'|'skeleton';
    attribution?: string;
    license?: string;               // for Wikimedia images
    author?: string;                // for Wikimedia images
  };
  contentHash: string;            // SimHash for near-dup detection
  relevanceScore: number;          // 0-1 from vetting (must be ≥0.75)
  noiseRatio: number;              // boilerplate ratio (must be <0.35)
  runId: string;                   // for abortable workers
}
```

### Prisma Schema Updates

**File**: `prisma/schema.prisma`

**Patch Model Changes**:
```prisma
model Patch {
  // ... existing fields
  entity           Json?  // {name, aliases, type, key_entities}
  sources_whitelist Json?  // string[]
}
```

**DiscoveredContent Model Changes**:
```prisma
model DiscoveredContent {
  // ... existing fields
  canonicalUrl      String   @index
  finalUrl          String?  // after redirects
  contentHash       String?  @index
  relevanceScore    Float    @default(0.0)
  whyItMatters      String?
  facts             Json?    // [{label, value}]
  quotes            Json?    // [{text, source}]
  quoteCharCount    Int?     @default(0)
  provenance        Json?    // [{url, note}]
  noiseRatio        Float?   @default(0.0)
  runId             String?
  heroSource        String?  // 'ai'|'wikimedia'|'skeleton'
  heroLicense       String?
  heroAuthor        String?
  
  @@unique([patchId, canonicalUrl])  // Prevent duplicates
}
```

**Migration**: `prisma migrate dev --name add_discovery_fields`

### Redis Schema

**File**: `lib/redis/discovery.ts`

**Keys**:
- `seen:patch:{id}` → SET of canonical URLs (TTL 30d)
- `hashes:patch:{id}` → ZSET of SimHash (timestamp score, keep last 1k)
- `frontier:patch:{id}` → ZSET of discovery queue (priority score)
- `wiki:refs:{patchId}` → Cached Wikipedia references (TTL 24h)
- `run:patch:{id}` → Active run tracking (UUID)

**Memory Caps**:
- Frontier ZSET: max 1k-2k entries per patch
- Hashes ZSET: max 1k entries per patch
- Auto-cleanup: remove oldest entries when limit reached

---

## 🏗️ Backend Architecture

### Phase 1: Topic Seed Builder (Deterministic)

**File**: `lib/discovery/topic-builder.ts`

**Class**: `TopicProfileBuilder`

**Methods**:
- `buildProfile(patch: Patch): TopicProfile`
  - `must_terms`: entity name + aliases (lowercased, deduplicated)
  - `should_terms`: key_entities, eras, venues, rivalries, signature phrases
  - `disallow`: generic league/global terms unless paired with must_terms
- `buildSeedSources(patch: Patch): SeedSource[]`
  - Primary hub: Wikipedia/Wikidata lookup
  - Official site: domain extraction
  - 6-12 high-trust domains for entity type (sports/news/academic/etc.)

**Caching**: Store in Redis `topic:patch:{id}` (TTL 7d)

**Example**:
```typescript
// For "Chicago Bulls" patch
{
  must_terms: ['chicago bulls', 'bulls', 'chicago'],
  should_terms: ['michael jordan', 'scottie pippen', 'united center', '90s'],
  disallow: ['nba', 'basketball'] // unless paired with must_terms
}
```

### Phase 2: Search Frontier (Priority Queue)

**File**: `lib/discovery/frontier.ts`

**Class**: `SearchFrontier`

**Priority Formula**:
```typescript
priority = (
  novelty: 1/(1 + recency_days) +
  specificity: +0.5 if title/meta contains must_terms +
  domain_boost: +0.3 for whitelisted domains +
  penalty: -duplicate_hit_rate
)
```

**Methods**:
- `addItem(provider, query, cursor, priority)`
- `popMax(): FrontierItem | null`
- `reinsert(item, backoff)`
- `advanceCursor(item)`

**Storage**: Redis ZSet `frontier:patch:{id}` with priority as score

**Seeding Order** (Priority):
1. Wikipedia References (highest priority)
2. Official site
3. Whitelisted domains
4. General web search (lowest priority)

**Rate Limits**:
- Per-provider rate limits (requests per minute)
- Per-provider backoff (exponential backoff on errors)
- `duplicate_hit_rate` decay (reset after 100 non-duplicates)
- Persist cursor state per provider/patch (Redis)

### Phase 3: Provider System

**File**: `lib/discovery/providers/base.ts`

**Interface**: `IDiscoveryProvider`
```typescript
interface IDiscoveryProvider {
  fetch(frontierItem: FrontierItem): Promise<Candidate[]>;
  supports(frontierItem: FrontierItem): boolean;
  getRateLimit(): number; // requests per minute
}
```

**Implementations**:

1. **RSS Provider** (`lib/discovery/providers/rss.ts`)
   - RSS/Atom feeds
   - Use `etag/last-modified` to avoid refetch
   - Parse feed items to extract URLs

2. **Web Search Provider** (`lib/discovery/providers/web-search.ts`)
   - DeepSeek API / SerpAPI
   - Templates must include entity must_terms in title region
   - Use `site:` for whitelisted sources
   - Rotate 5-8 queries

3. **Wikipedia Provider** (`lib/discovery/providers/wikipedia.ts`)
   - **Two paths**:
     - **References crawler**: Extract References/External links from entity page
       - One-hop crawl (same-page anchors OK, off-wiki links prioritized)
       - Only enqueue if `anchor_text` contains entity OR section heading mentions entity
       - Cache in Redis `wiki:refs:{patchId}` (TTL 24h)
     - **Category/topic pages**: Fetch category pages, subpages, lists
       - Apply entity mention gate (must mention entity explicitly)
   - Dedupe by canonical URL
   - Iterate deterministically

4. **Official Site Provider** (`lib/discovery/providers/official-site.ts`)
   - Crawl official site (team.org, person.com, etc.)
   - Respect robots.txt
   - Prioritize news/blog sections

**Provider Registry**: `lib/discovery/providers/registry.ts` - auto-registers all providers

### Phase 4: Canonicalization & Fast De-Dupe

**File**: `lib/discovery/canonicalize.ts`

**Function**: `canonicalizeUrl(url: string): string`
- Parse URL, lowercase host, strip `www`
- Remove fragment, strip UTM/fbclid/gclid
- Sort query params
- Follow 1-hop redirect (301/302) - **same domain only unless whitelisted**
- Return normalized URL

**File**: `lib/discovery/dedupe.ts`

**Functions**:
- `isSeen(patchId, canonicalUrl): Promise<boolean>`
  - Check Redis `seen:patch:{id}` SET
  - Check DB unique constraint
  - Return true if found in either
- `markSeen(patchId, canonicalUrl)`
  - Add to Redis SET (TTL 30d)
  - DB insert will fail if duplicate (catch unique violation)
- `isNearDup(patchId, contentHash): Promise<boolean>`
  - Get last 1k hashes from Redis ZSet
  - Compute Hamming distance (SimHash)
  - Return true if distance ≤ 4

### Phase 5: HTTP Validation

**File**: `lib/discovery/http-validate.ts` (NEW)

**Function**: `validateUrl(url): Promise<{valid: boolean, finalUrl?: string, status?: number}>`

**Checks**:
- HEAD request first
- Follow redirects (max 3 hops, same domain only unless whitelisted)
- Require status 200-299
- Require content-type: `text/html` or `application/json`
- Block 404/soft-404 (thin content detection)
- Block 0-length responses
- Block iframe walls
- Store `finalUrl` (after redirects)

**Return**: `{valid: true, finalUrl, status: 200}` or `{valid: false}`

### Phase 6: Relevance Gate (Hard Filter - STRICT)

**File**: `lib/discovery/relevance.ts`

**Class**: `RelevanceVetter`

**Methods**:

1. `mustMentionEntity(meta, patch): boolean`
   - Regex check: entity name/aliases in title/H1/first 150 words
   - Case-insensitive, word boundaries
   - Example: "Chicago Bulls" must appear in title OR first 150 words

2. `isPrimaryEntityPage(meta, patch): boolean`
   - Check schema.org `@type` matches entity type
   - Check if URL slug contains entity identifier
   - Check if page is official profile page
   - Example: Wikipedia page for "Chicago Bulls", official team page

3. `isLeagueListicle(meta, patch): boolean`
   - Regex: `/(ranking|power rankings|top \d+|every .+ team)/i`
   - AND entity NOT in title/slug → drop
   - Example: "Top 10 NBA Teams" with no "Chicago Bulls" in title → reject

4. `getLLMRelevanceScore(meta, patch): Promise<number>`
   - Use DeepSeek API for scoring
   - Inputs: title, h1, first 120-180 words, tags, byline, domain
   - Output: 0-1 score
   - Require **≥0.75** to proceed

5. `passesRelevance(patch, meta): Promise<boolean>`
   ```typescript
   // Must pass ALL:
   const mentionsEntity = mustMentionEntity(meta, patch) || isPrimaryEntityPage(meta, patch);
   const notListicle = !isLeagueListicle(meta, patch);
   const llmScore = await getLLMRelevanceScore(meta, patch);
   
   return mentionsEntity && notListicle && llmScore >= 0.75;
   ```

**Aggregation**: Track counts per provider (no per-item spam logs)

### Phase 7: Content Extraction & Quality Gate

**File**: `lib/discovery/extract.ts`

**Class**: `ContentExtractor`

**Methods**:

1. `fastMeta(url): Promise<Metadata>`
   - HEAD request + HTML skim
   - Extract: title, meta description, h1, first 150 words
   - Timeout: 500ms

2. `fetchAndExtract(url): Promise<Document>`
   - Fetch full HTML
   - Extract: title, lead (first 200 words), body (800-1200 words), publish_date, main_image
   - Use Readability/Cheerio for parsing
   - Timeout: 2s

3. `computeNoiseRatio(doc): number`
   - Detect boilerplate: nav/legal/footer patterns
   - Ratio = boilerplate words / total words
   - Drop if > 0.35

4. `passesQuality(doc): boolean`
   - Require ≥200 meaningful words (exclude nav/legal)
   - Require noiseRatio < 0.35
   - Strip site chrome (headers, footers, sidebars)
   - Normalize lists (ordered/unordered)
   - Return boolean

5. `computeContentHash(doc): string`
   - SimHash of clean text (no HTML, no boilerplate)
   - Return hex string

### Phase 8: Synthesis with Fair-Use Quotes

**File**: `lib/discovery/synthesize.ts`

**Class**: `CardSynthesizer`

**Constraints**:
- Max 3 quotes per card
- Max 75 words total across all quotes
- Store `quoteCharCount` (enforce ≤75 words)
- Always attach source + anchor link
- Add attribution block if license requires
- Validate before saving (reject if exceeds limits)

**Methods**:

1. `synthesize(patch, doc): Promise<CardData>`
   - `whyItMatters`: 1-2 sentences using TopicProfile
   - `facts`: 3-6 fact bullets (numbers/dates/records > adjectives)
   - `quotes`: Up to 2-3 short verbatim quotes (famous/definitive) with attribution
   - `provenance`: Array of source URLs with notes
   - Validate: every claim maps to a URL in provenance

**LLM**: Use DeepSeek for synthesis with structured output

**Example Output**:
```typescript
{
  whyItMatters: "The Chicago Bulls' 1995-96 season marked the team's historic 72-10 record, cementing their legacy as one of the greatest teams in NBA history.",
  facts: [
    {label: "Record", value: "72-10"},
    {label: "Season", value: "1995-96"},
    {label: "Championship", value: "4th NBA title"}
  ],
  quotes: [
    {text: "It's not just about winning, it's about how you win.", source: "Michael Jordan - ESPN"},
    {text: "That team was perfection.", source: "Phil Jackson - The Athletic"}
  ],
  quoteCharCount: 67,
  provenance: [
    {url: "https://espn.com/article", note: "Main source"},
    {url: "https://theathletic.com/article", note: "Coach interview"}
  ]
}
```

### Phase 9: Hero Image Pipeline (Strict Order)

**File**: `lib/discovery/hero-image.ts`

**Class**: `HeroImagePipeline`

**Timeouts**:
- AI: 3.0s timeout
- Wikimedia: 1.5s timeout
- Total max: 4.5s (never block save longer)
- If timeout → skeleton + background retry job

**Methods**:

1. `generateHero(patch, doc): Promise<HeroImage>`
   **Order**:
   1. **AI Image Generator** (our existing generator)
      ```typescript
      await fetch('/api/ai/generate-hero-image', {
        body: JSON.stringify({
          title: doc.title,
          summary: doc.lead,
          entity: patch.entity.name,
          artisticStyle: 'photorealistic'
        }),
        signal: AbortSignal.timeout(3000) // 3s timeout
      })
      ```
   2. **Wikimedia fallback** (if AI fails/timeout)
      ```typescript
      await fetch(`https://en.wikipedia.org/api/rest_v1/page/media/${entityName}`, {
        signal: AbortSignal.timeout(1500) // 1.5s timeout
      })
      ```
   3. **Skeleton image** (if both fail)
      - Return skeleton image URL
      - Schedule background retry job
      - Never publish blank tile

**Image Handling**:
- Consistent aspect ratio (16:9)
- Blur-up placeholder (base64 data URI)
- Prevent layout shift (reserve space)
- Store `heroSource`, `heroLicense`, `heroAuthor`

**Background Retry**:
- Queue job for failed images
- Retry with exponential backoff
- Update card when ready

### Phase 10: Save → Emit → Iterate (One-at-a-Time)

**File**: `lib/discovery/engine.ts`

**Class**: `DiscoveryEngine`

**Main Loop**:
```typescript
async run(patchId: string, state: LiveState) {
  const patch = await getPatch(patchId);
  const profile = await TopicProfileBuilder.buildProfile(patch);
  const frontier = new SearchFrontier(patchId);
  
  // Generate runId
  const runId = crypto.randomUUID();
  await redis.set(`run:patch:${patchId}`, runId);
  
  // Guard against concurrent runs
  const existingRun = await redis.get(`run:patch:${patchId}`);
  if (existingRun && existingRun !== runId) {
    throw new Error('Discovery already running');
  }
  
  // Initialize frontier with seed sources
  for (const seed of profile.seedSources) {
    frontier.addItem(seed);
  }
  
  while (state.isLive) {
    // Check abort
    const currentRunId = await redis.get(`run:patch:${patchId}`);
    if (currentRunId !== runId) {
      break; // Aborted
    }
    
    const candidate = frontier.popMax();
    if (!candidate) {
      await sleep(1000);
      continue;
    }
    
    try {
      const provider = ProviderRegistry.get(candidate.provider);
      const urls = await provider.fetch(candidate);
      
      for (const rawUrl of urls) {
        const canonicalUrl = canonicalizeUrl(rawUrl);
        if (await isSeen(patchId, canonicalUrl)) continue;
        
        // HTTP validation
        const validation = await validateUrl(rawUrl);
        if (!validation.valid) continue;
        
        // Fast meta fetch (500ms)
        const meta = await fastMeta(validation.finalUrl);
        if (!await passesRelevance(patch, meta)) continue;
        
        // Full fetch (2s)
        const doc = await fetchAndExtract(validation.finalUrl);
        if (!passesQuality(doc)) continue;
        
        // Near-dup check
        const hash = computeContentHash(doc);
        if (await isNearDup(patchId, hash)) continue;
        
        // Synthesis (1.5s)
        const { why, facts, quotes, provenance } = await synthesize(patch, doc);
        
        // Hero image (2s target, 4.5s max)
        const hero = await generateHero(patch, doc);
        
        // Save item
        const item = await saveItem({
          patchId,
          canonicalUrl: canonicalUrl,
          finalUrl: validation.finalUrl,
          doc,
          hash,
          hero,
          why,
          facts,
          quotes,
          provenance,
          runId
        });
        
        await markSeen(patchId, canonicalUrl);
        await markHash(patchId, hash);
        
        // Emit SSE
        sseEmitter.emit(patchId, 'discovery:saved', serialize(item));
        
        frontier.reinsert(candidate, advanceCursor);
        await sleep(jitter(300, 800));
        break; // ONE per iteration
      }
      
      if (noNovelFound) {
        frontier.reinsert(candidate, backoff);
      }
    } catch (error) {
      // Log error, backoff, continue
      logger.error('[Discovery] Error processing candidate', {error, patchId});
      frontier.reinsert(candidate, backoff);
    }
  }
  
  // Cleanup
  await redis.del(`run:patch:${patchId}`);
}
```

**Timeout Envelope** (per candidate): ≤6s total
- Meta fetch: 500ms
- HTTP validation: 500ms
- Full fetch: 2s
- Synthesis: 1.5s
- Hero image: 2s (with 4.5s cap, but target 2s)

If timeout → skip candidate, log, continue

### Phase 11: Observability (Compact)

**File**: `lib/discovery/metrics.ts`

**Track**:
- `time_to_first`: Time from start to first saved item
- `novel_rate`: Items saved / candidates processed
- `duplicates_per_min`: Duplicate skips per minute
- `items_per_hour`: Production rate
- `frontier_depth`: Queue size
- `provider_error_rate`: Per-provider error counts

**Aggregate**: Per-minute summaries (no spam)

**File**: `lib/discovery/logger.ts`

**Format**:
```
[Discovery] patch=chicago-bulls duplicates=37(nba.com) low_relevance=12 saved=4 t_first=2.3s
```

No per-item spam; aggregate counts only.

---

## 🌐 API Endpoints

### 1. Start Discovery Endpoint (Refactored)

**File**: `carrot/app/api/patches/[handle]/start-discovery/route.ts`

**Changes**:
- Remove old DeepSeek batch logic
- Initialize `DiscoveryEngine` with patch
- Start background worker loop
- Return immediately with `{success: true, status: 'live', runId: uuid}`
- Engine runs in background, emits SSE

**Code**:
```typescript
export async function POST(req, {params}) {
  const patch = await getPatch(params.handle);
  const engine = new DiscoveryEngine();
  
  // Start in background (non-blocking)
  engine.run(patch.id, {isLive: true}).catch(err => {
    logger.error('[Start Discovery] Error', err);
  });
  
  return NextResponse.json({
    success: true,
    status: 'live',
    runId: engine.runId
  });
}
```

### 2. SSE Endpoint (NEW)

**File**: `carrot/app/api/patches/[handle]/discovery-stream/route.ts`

**Implementation**:
```typescript
export async function GET(req, {params}) {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  const encoder = new TextEncoder();
  
  // Subscribe to discovery events
  const unsubscribe = sseEmitter.subscribe(params.handle, (event, data) => {
    writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  });
  
  req.signal.addEventListener('abort', () => {
    unsubscribe();
    writer.close();
  });
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

**Events Emitted**:
- `discovery:status` → `{stage: 'searching'|'vetting'|'generating_image', message: string}`
- `discovery:saved` → `{item: serializedItem}`

### 3. Metrics Endpoint (NEW)

**File**: `carrot/app/api/patches/[handle]/discovery-metrics/route.ts`

**Returns**:
```typescript
{
  timeToFirst: number,
  novelRate: number,
  duplicatesPerMin: number,
  itemsPerHour: number,
  frontierDepth: number,
  providerErrorRate: Record<string, number>
}
```

### 4. Stop Discovery Endpoint (NEW)

**File**: `carrot/app/api/patches/[handle]/stop-discovery/route.ts`

**Implementation**:
```typescript
export async function POST(req, {params}) {
  const runId = await redis.get(`run:patch:${params.handle}`);
  if (runId) {
    await redis.del(`run:patch:${params.handle}`);
    return NextResponse.json({success: true, stopped: true});
  }
  return NextResponse.json({success: true, stopped: false});
}
```

---

## 🎨 Frontend UX

### 1. Discovery Component (Refactored)

**File**: `carrot/app/components/DiscoveringContent.tsx`

**Changes**:
- Add SSE connection:
  ```typescript
  useEffect(() => {
    const eventSource = new EventSource(`/api/patches/${patchHandle}/discovery-stream`);
    
    eventSource.addEventListener('discovery:status', (e) => {
      const {stage, message} = JSON.parse(e.data);
      setStatus({stage, message});
    });
    
    eventSource.addEventListener('discovery:saved', (e) => {
      const item = JSON.parse(e.data);
      setItems(prev => [item, ...prev]);
      setStatus({stage: 'saved', message: 'Item saved!'});
    });
    
    return () => eventSource.close();
  }, [patchHandle]);
  ```
- Add skeleton tile placeholder (right side of top row)
- Add "Live Discovery" status panel (left side of top row)
- Show progress: "Searching...", "Vetting...", "Generating image...", "Saved!"

### 2. Layout Constants

**File**: `carrot/app/components/DiscoveringContent.tsx`

**Rules**:
- 2-column grid at ≥1024px (lock, no responsive break)
- 1-column at <1024px
- Top row reserved: Live panel (left) + skeleton tile (right)
- Filters never overlap grid (container queries, no sticky)
- Modal: max-width 1200px, comments rail min 320px, resizable to 50/50

### 3. Card Component (Updated)

**File**: `carrot/app/components/DiscoveryCard.tsx`

**Updates**:
- Display `whyItMatters` (prominent, 1-2 sentences)
- Show `facts` as bullets (3-6 items)
- Show `quotes` with toggle (max 3, ≤75 words)
- Show `provenance` chips (all sources)
- Hero image (AI/Wikimedia/skeleton) with blur-up placeholder
- Responsive 2-column layout
- **View Source** button: `href={item.finalUrl || item.sourceUrl}`, `target="_blank" rel="noopener noreferrer"`

### 4. Modal Structure

**File**: `carrot/app/components/DiscoveryModal.tsx`

**Structure**:
- Header strip: thumbnail + View Source + Share (equal width, right-aligned, solid bg)
- Content area: scrollable (always show inner scrollbar)
- Comments rail: resizable with drag handle (min 320px, max 50%)
- Responsive: comments rail collapses on mobile

### 5. Admin/Audit Panel (Internal)

**File**: `carrot/app/components/DiscoveryCardAdmin.tsx` (NEW)

**Internal panel** (dev/admin only):
- Relevance score breakdown
- Rules hit (mustMentionEntity, isPrimaryEntityPage, etc.)
- Providers tried
- Quotes chosen (with character count)
- Hero source (AI/Wikimedia/skeleton)
- Noise ratio
- Content hash

**Toggle**: show/hide for debugging

---

## 🔒 Security & Ops

### 1. CSP Compliance

**File**: `carrot/next.config.js` (update)

**Ensure**:
- `img-src` includes `*.gstatic.com` (for hero images)
- Sanitize all HTML (never render untrusted markup)
- Use DOMPurify or similar for user-generated content

### 2. Wayback Snapshot (Optional)

**File**: `lib/discovery/wayback.ts` (NEW)

**On save**:
- Optional: Submit URL to Wayback Machine API
- Store snapshot URL in `provenance`
- Mitigate link rot

### 3. Memory Management

**File**: `lib/discovery/frontier.ts`

**Redis ZSET limits**:
- Frontier: max 1k-2k entries per patch
- Hashes: max 1k entries per patch
- Auto-cleanup: remove oldest entries when limit reached

---

## ✅ Acceptance Criteria (Universal)

### Performance
- ✅ **First saved card ≤ 4s** after "Start Discovery"
- ✅ **Time-to-first**: <2-4s target
- ✅ **One item at a time**: Streaming, not batch

### Quality
- ✅ **100% of saved cards** mention or profile the patch entity explicitly
- ✅ **0 duplicate inserts** per patch (DB enforced) and near-dup drop rate operational
- ✅ **Every saved card has hero** (AI or Wikimedia fallback, never blank)
- ✅ **Relevance ≥0.75**: Hard filter enforced

### Content
- ✅ Cards include **at least one** authoritative source; dead links = 0
- ✅ Quotes used **sparingly (≤3)**, clearly attributed; all other text paraphrased and meaningful
- ✅ **Quote limits**: Max 3 quotes, ≤75 words total
- ✅ **Content quality**: ≥200 meaningful words, noiseRatio <0.35

### UX
- ✅ UI shows **live progress** + **skeleton next tile**
- ✅ Grid remains **two columns** at ≥1024px
- ✅ Filters never overlay content
- ✅ Modals always scroll
- ✅ **View Source** opens in new tab with correct URL

---

## 🧪 Testing

### Unit Tests

**Files**: `__tests__/discovery/*.test.ts`

**Coverage**:
- Topic profile builder
- Canonicalization
- De-duplication
- Relevance vetting (all rules)
- Content extraction
- Synthesis (quote limits)
- Hero image pipeline (timeouts)

### Integration Tests

**File**: `__tests__/discovery/integration.test.ts`

**Tests**:
1. End-to-end: start discovery → receive SSE → verify card
2. Test with multiple patches (team, person, place)
3. Verify <4s time-to-first
4. Verify no duplicates
5. Verify 100% relevance

### Acceptance Tests

**File**: `__tests__/discovery/acceptance.test.ts`

**Tests**:
1. ✅ First save ≤4s with mocked provider (5 candidates, only 1 relevant)
2. ✅ Saving blocked if `relevanceScore < 0.75` even when AI hero succeeds
3. ✅ Quotes present only when length ≤75 words total and have sources
4. ✅ Wikipedia provider produces ≥5 candidates on well-linked entity; 0 when niche
5. ✅ UI snapshot: Live panel + skeleton fixed top row; filters never overlap; View Source opens target
6. ✅ HTTP validation: 404/soft-404 blocked
7. ✅ League listicle filter: rejected if entity not in title
8. ✅ Quote limits: max 3 quotes, max 75 words
9. ✅ Hero timeout: skeleton shown if AI fails in 3s
10. ✅ Concurrent run guard: second start-discovery fails if already running
11. ✅ Dead link check: 404/soft-404 blocked before save
12. ✅ Content quality: noiseRatio <0.35, ≥200 meaningful words

---

## 📁 File Structure Summary

```
lib/
  discovery/
    engine.ts              # Main orchestrator
    topic-builder.ts       # Topic profile builder
    frontier.ts            # Priority queue
    canonicalize.ts        # URL normalization
    dedupe.ts              # De-duplication
    http-validate.ts       # HTTP validation (NEW)
    relevance.ts           # Relevance vetting (STRICT)
    extract.ts             # Content extraction
    synthesize.ts          # Card synthesis
    hero-image.ts          # Image pipeline
    metrics.ts             # Metrics collection
    logger.ts              # Logging
    wayback.ts             # Wayback snapshot (optional)
    providers/
      base.ts              # Provider interface
      rss.ts               # RSS feeds
      web-search.ts        # Web search
      wikipedia.ts         # Wikipedia (two paths)
      official-site.ts     # Official sites
      registry.ts          # Provider registry
  redis/
    discovery.ts           # Redis utilities

carrot/app/
  api/patches/[handle]/
    start-discovery/route.ts        # Refactored
    discovery-stream/route.ts       # NEW: SSE
    discovery-metrics/route.ts      # NEW: Metrics
    stop-discovery/route.ts         # NEW: Stop
  components/
    DiscoveringContent.tsx          # Refactored
    DiscoveryCard.tsx               # Updated
    DiscoveryModal.tsx              # Updated
    DiscoveryCardAdmin.tsx          # NEW: Admin panel
  patch/[handle]/page.tsx           # Updated layout

prisma/
  schema.prisma                      # Updated with new fields
```

---

## 🚀 Implementation Order

1. **Phase 1**: Data model (Prisma + Redis) - Day 1
2. **Phase 2.1**: Stricter relevance gate (mustMentionEntity, isPrimaryEntityPage, league listicle filter) - Day 1
3. **Phase 2.2**: HTTP validation (dead link checks) - Day 1
4. **Phase 2.3**: Wikipedia provider (two paths) - Day 2
5. **Phase 3**: Processing pipeline (content quality, quote guardrails, hero timeouts) - Day 2
6. **Phase 4**: Orchestrator (abortable workers, frontier hygiene, timeout envelope) - Day 3
7. **Phase 5**: API endpoints (SSE statuses) - Day 3
8. **Phase 6**: Frontend (UI constants, View Source fix, modal structure, admin panel) - Day 4
9. **Phase 7**: Security and ops (CSP, Wayback, memory management) - Day 4
10. **Phase 8**: Testing (all acceptance tests) - Day 5

---

## 📝 Key Implementation Details

### 1. One-at-a-Time
- `break` after saving one item per iteration
- Loop continues while discovery is LIVE
- Exactly one new card per iteration

### 2. Fast Time-to-First
- Parallelize relevance check + fast meta fetch
- Optimize provider queries
- Cache topic profiles
- Target <4s, but allow up to 6s per candidate

### 3. No Duplicates
- Redis SET + DB unique constraint (double-check)
- SimHash near-dup detection
- Canonical URL normalization

### 4. Relevance ≥0.75
- Hard filter: must pass ALL:
  - Entity mention OR primary page
  - NOT league listicle
  - LLM score ≥0.75

### 5. Hero Image Required
- AI → Wikimedia → skeleton (never blank)
- Timeouts enforced (3s AI, 1.5s Wikimedia)
- Background retry for failed images

### 6. SSE Streaming
- Real-time updates to frontend
- Status events during processing
- Saved events when items ready

### 7. Generic
- Works for any patch via TopicProfile
- Entity type agnostic (team/person/org/place/topic)
- Provider-agnostic architecture

---

## 🔄 Migration from Current System

### Step 1: Deploy New Schema
- Run Prisma migration
- Add Redis keys
- Backfill existing data (optional)

### Step 2: Deploy New Endpoints
- Deploy new API routes
- Keep old endpoints for backward compatibility (deprecated)

### Step 3: Deploy Frontend
- Update components
- Add SSE connection
- Test on staging

### Step 4: Switch Over
- Enable new discovery for new patches
- Migrate existing patches (optional)

### Step 5: Cleanup
- Remove old endpoints
- Archive old code

---

## 📊 Success Metrics

### Performance
- Time-to-first: <4s (target <2s)
- Items per hour: >10 (depends on patch popularity)
- Novel rate: >0.3 (30% of candidates saved)

### Quality
- Relevance: 100% of saved items ≥0.75
- Duplicate rate: 0% (DB enforced)
- Hero image rate: 100% (AI or Wikimedia)
- Dead link rate: 0%

### UX
- User satisfaction: >4/5
- Discovery completion rate: >80%
- Average cards discovered per session: >5

---

*Document Created: January 2025*  
*Status: Active Implementation Plan*  
*Next Review: After Phase 1 completion*

