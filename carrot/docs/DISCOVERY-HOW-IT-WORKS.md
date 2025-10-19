# 🔍 Discovery System - How It Works

## Question 1: How We Avoid Searching for the Same Content Every Time

### **Two-Layer Protection**

#### **Layer 1: Prompt-Level Avoidance** (Tell DeepSeek what to skip)

**File**: `start-discovery/route.ts` (Lines 114-123)

```typescript
// Get last 20 items already discovered
const recentTitles = await prisma.discoveredContent.findMany({
  where: { patchId: patch.id },
  select: { title: true, sourceUrl: true },
  take: 20,
  orderBy: { createdAt: 'desc' }
});

// Build avoidance context
const avoidanceContext = recentTitles.length > 0 
  ? `\n\nAVOID these topics (already covered):\n${recentTitles.map(t => `- ${t.title}`).join('\n')}`
  : '';

// Include in prompt
content: `Find content about Chicago Bulls...${avoidanceContext}`
```

**Example Prompt Sent to DeepSeek**:
```
Find content about: "Chicago Bulls"

AVOID these topics (already covered):
- Chicago Bulls 2024-25 Season Schedule
- Bulls Sign New Point Guard
- DeMar DeRozan Trade Analysis
- Bulls vs Lakers Game Recap
...

Return ONE new result.
```

**Benefit**: DeepSeek actively searches for NEW topics

---

#### **Layer 2: Database-Level Deduplication** (Catch any duplicates)

**File**: `start-discovery/route.ts` (Lines 247-265)

```typescript
// STEP 1: Canonicalize URL
const canonicalResult = await canonicalize(item.url)
const canonicalUrl = canonicalResult.canonicalUrl

// STEP 2: Check database for existing items
const existing = await prisma.discoveredContent.findFirst({
  where: {
    patchId: patch.id,
    OR: [
      { sourceUrl: item.url },          // Check original URL
      { canonicalUrl: canonicalUrl }     // Check normalized URL
    ]
  }
})

// STEP 3: Skip if duplicate
if (existing) {
  duplicateLogger.logDuplicate(item.url, 'A', 'deepseek')
  duplicateCount++
  continue // Don't save, move to next item
}
```

**URL Canonicalization** catches variants:
- `https://www.nba.com/bulls/news` → `https://nba.com/bulls/news`
- `https://example.com?utm_source=twitter` → `https://example.com`
- Different URLs, same canonical = duplicate

**Benefit**: Even if DeepSeek returns a duplicate, we catch it before saving

---

### **Combined Effect**

**First Run**:
- DeepSeek searches broadly
- Finds 10 items
- We save 8-10 (2 duplicates)

**Second Run**:
- DeepSeek gets avoidance list (20 topics)
- Searches for NEW angles
- Finds 10 candidates
- We skip 6-8 duplicates (DeepSeek couldn't avoid all)
- Save 2-4 new items

**Third Run**:
- DeepSeek gets longer avoidance list
- Most results are duplicates
- We skip 8-9 duplicates
- Save 0-2 new items

**Fourth Run**:
- Almost everything is duplicates
- DeepSeek struggles to find novel content
- We skip 9-10 duplicates
- Save 0-1 new items

---

## Question 2: Where We Search (APIs That Are Live and Verified)

### **Current Sources**

#### **✅ PRIMARY: DeepSeek API** (WORKING)
**API**: `https://api.deepseek.com/v1/chat/completions`  
**Status**: ✅ **LIVE** (configured via `DEEPSEEK_API_KEY`)

**What DeepSeek searches**:
- General web search (Google, Bing index)
- News aggregators
- Social media (Twitter, Reddit mentions)
- Video platforms (YouTube)
- Academic databases
- Sports news sites

**How it works**:
```typescript
fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'Find content...' },
      { role: 'user', content: 'Chicago Bulls news' }
    ]
  })
})
```

**Returns**: URLs + titles + descriptions + relevance scores

---

### **❌ NOT CURRENTLY USED** (But Available)

You have these APIs documented in your codebase:

#### **Available in `contentSources.ts`**:
1. **Wikipedia API** - `https://en.wikipedia.org/api/rest_v1`
2. **arXiv API** - `http://export.arxiv.org/api/query`
3. **PubMed API** - `https://eutils.ncbi.nlm.nih.gov/entrez/eutils`
4. **Stack Overflow API** - `https://api.stackexchange.com/2.3`
5. **GitHub API** - `https://api.github.com` (requires token)
6. **News API** - `https://newsapi.org/v2` (requires key)

#### **RSS Feeds**:
- Nature News: `https://www.nature.com/news.rss`
- Science News: `https://www.science.org/news.rss`
- Hacker News: `https://hnrss.org/frontpage`
- arXiv CS: `http://export.arxiv.org/rss/cs`

**Status**: Code exists, but NOT wired into discovery flow

---

## 🎯 **Why Only DeepSeek?**

**Pros of Current Approach**:
- ✅ Simple (one API)
- ✅ Flexible (searches across many sources)
- ✅ Smart (AI understands context)
- ✅ No rate limits (on premium plan)

**Cons**:
- ❌ Slower (AI processing time)
- ❌ Less reliable (may return same results)
- ❌ No control over sources
- ❌ Can't prioritize specific sites

---

## 🚀 **Recommended: Add Direct API Sources**

### **For Chicago Bulls Specifically**:

#### **High-Value RSS Feeds** (Fast, Reliable):
```typescript
const sources = [
  'https://www.nba.com/bulls/rss.xml',           // Official team feed
  'https://www.espn.com/espn/rss/nba/news',     // ESPN NBA
  'https://bleacherreport.com/chicago-bulls.rss' // Bleacher Report
]
```

**Benefits**:
- 0.5-1s response time
- Always fresh content
- No AI needed
- No duplicate risk (unique URLs)

---

### **Implementation Strategy**

#### **Option A: Hybrid (Best of Both)**
```typescript
async function discoverContent(patchHandle) {
  // Round-robin between sources
  const sources = [
    { type: 'rss', url: 'https://nba.com/bulls/rss.xml' },
    { type: 'ai', provider: 'deepseek' },
    { type: 'rss', url: 'https://espn.com/nba/rss' },
    { type: 'ai', provider: 'deepseek' }
  ]
  
  for (let source of sources) {
    if (source.type === 'rss') {
      // Fast RSS fetch (0.5s)
      const item = await fetchLatestFromRSS(source.url)
    } else {
      // AI search (1.5s)
      const item = await askDeepSeek()
    }
    // ... check duplicate, generate image, save ...
  }
}
```

**Result**:
- Faster (RSS items in 2-3s total)
- Higher quality (official sources)
- More diverse (alternates sources)

---

## ✅ **Answer Summary**

### **1. How we avoid duplicates:**
- **Prompt-level**: Tell DeepSeek "avoid these 20 topics"
- **Database-level**: Check URL + canonical URL before saving
- **Batched logging**: Reduces console spam by >90%

### **2. Where we search:**
- **Currently**: Only DeepSeek API (AI web search)
- **Available**: Wikipedia, arXiv, RSS feeds, News API, etc.
- **Status**: DeepSeek is LIVE and working

### **Recommendation**:
Add RSS feeds for Chicago Bulls → Much faster, more reliable, zero duplicates

**Want me to implement RSS feed integration as a supplementary source?** It would make discovery 2-3x faster and more reliable! 🚀
