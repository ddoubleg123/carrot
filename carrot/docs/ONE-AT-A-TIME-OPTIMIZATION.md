# 🚀 One-at-a-Time Discovery Optimization

## 🎯 Current vs Target Behavior

### **Current (Batch Mode)**:
```
1. DeepSeek → Returns 10 items at once
2. Process all 10 one-by-one
3. User sees items appear as processed
```

**Issues**:
- DeepSeek takes 3-5s to return 10 items
- Quality varies (some items low relevance)
- Many duplicates in batch

### **Target (True One-at-a-Time)**:
```
LOOP:
  1. DeepSeek → Ask for ONE item (0.5-1s)
  2. Check duplicate → Skip if duplicate (0.1s)
  3. Generate AI image → If relevant (2-3s)
  4. Save & stream to UI (0.1s)
  5. REPEAT
```

**Benefits**:
- First item in 2-4s (vs 5-8s)
- Higher quality (ask for best, not 10 random)
- Fewer duplicates (stop earlier)
- Better user feedback (see progress immediately)

---

## 🔧 **Optimization Plan**

### **Phase 1: Optimize DeepSeek Prompt** (Quick Win)
Instead of asking for 10 items, ask for ONE best item:

```typescript
// BEFORE
content: `Find high-quality content about: "${patch.name}"
Please search for and return relevant content...`

// AFTER
content: `Find the SINGLE BEST, most recent piece of content about: "${patch.name}" 
that was published in the last 7 days. Return ONLY ONE result.
Focus on authoritative sources (NBA.com, ESPN, Bleacher Report).
Return as JSON: {"title": "...", "url": "...", "type": "...", "description": "...", "relevance_score": 0.95}`
```

**Benefit**: Faster response (1s vs 5s), higher quality

### **Phase 2: Implement True Streaming Loop** (Backend)

```typescript
// New endpoint: GET /api/patches/[handle]/discovery/stream-continuous

async function* discoveryContinuous(patchHandle: string) {
  let iteration = 0
  const maxIterations = 10
  
  while (iteration < maxIterations) {
    // STEP 1: Ask DeepSeek for ONE item
    sendSSE('discovery:searching', {})
    const item = await askDeepSeekForOne(patchHandle)
    
    if (!item) {
      sendSSE('discovery:idle', {})
      await sleep(2000) // Wait before retry
      continue
    }
    
    sendSSE('discovery:candidate', { url: item.url, sourceDomain: extractDomain(item.url) })
    
    // STEP 2: Check duplicate
    const isDupe = await checkDuplicate(item.url)
    if (isDupe) {
      console.log('[Discovery] Skipping duplicate')
      continue // Don't count as iteration
    }
    
    // STEP 3: Generate image
    sendSSE('discovery:imagizing:start', { itemId: 'temp-' + iteration })
    const imageUrl = await generateAIImage(item)
    
    if (!imageUrl) {
      console.log('[Discovery] No image, skipping')
      continue
    }
    
    // STEP 4: Save
    sendSSE('discovery:fetching', { url: item.url })
    const saved = await saveItem(item, imageUrl)
    
    // STEP 5: Stream to UI
    sendSSE('discovery:saved', { item: transformToDiscoveredItem(saved) })
    
    iteration++
    
    // Small delay before next iteration
    await sleep(500)
  }
  
  sendSSE('discovery:complete', { count: iteration })
}
```

### **Phase 3: Improve DeepSeek Quality** (Prompt Engineering)

**Add context about what's already been found**:
```typescript
const recentTitles = await prisma.discoveredContent.findMany({
  where: { patchId: patch.id },
  select: { title: true },
  take: 10,
  orderBy: { createdAt: 'desc' }
})

const prompt = `Find ONE new piece of content about: "${patch.name}"

AVOID these topics (already covered):
${recentTitles.map(t => `- ${t.title}`).join('\n')}

Focus on NEW angles, recent news, or different perspectives.
Return the BEST match as JSON.`
```

**Benefit**: Less duplicates, more diversity

---

## ⚡ **Quick Wins (Implement Now)**

### **1. Change DeepSeek to return 1 item per call**

File: `start-discovery/route.ts`

```typescript
// Instead of max_tokens: 4000 (returns 10 items)
max_tokens: 500  // Returns 1 item

// And in prompt:
"Find ONE high-quality piece of content... Return as a SINGLE JSON object (not array)"
```

### **2. Add progress feedback**

Already done with SSE! Just need to ensure events fire:
- `discovery:searching`
- `discovery:candidate`
- `discovery:fetching`
- `discovery:imagizing:start`
- `discovery:saved`

### **3. Loop multiple times**

Wrap in a loop that calls DeepSeek 10 times (one item each):

```typescript
for (let i = 0; i < 10; i++) {
  const item = await fetchOneItemFromDeepSeek()
  // ... process ...
  sendSSE('discovery:saved', { item })
}
```

---

## 🎯 **Recommended Implementation Order**

1. ✅ **Frontend** - Already done! Shows skeleton, status text, etc.
2. ⏭️ **Backend Loop** - Make it truly one-at-a-time
3. ⏭️ **Optimize Prompt** - Ask for ONE best item
4. ⏭️ **Add Context** - Tell DeepSeek what to avoid
5. ⏭️ **Fine-tune Timing** - Adjust delays for best UX

---

**Want me to implement the backend loop to make it truly one-at-a-time?**
