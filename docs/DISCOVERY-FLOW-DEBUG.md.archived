# Discovery Flow Debug Guide

## 🔍 **Current Issue: "Discovery Live" with No Visual Feedback**

When you click "Start Discovery", the button shows "Discovery Live" but there's no indication of progress. Let me explain what's happening and how to fix it.

---

## 📊 **Discovery Flow: Frontend → Backend**

### **Frontend Flow** (`DiscoveringContent.tsx`)

#### **Step 1: Button Click**
```typescript
// Line 118-134
handleStartDiscovery = async () => {
  setIsLoading(true);  // ✅ Button shows "Starting Discovery..."
  setError(null);
  
  const response = await fetch(`/api/patches/${patchHandle}/start-discovery`, {
    method: 'POST',
    body: JSON.stringify({ action: 'start_deepseek_search' })
  });
}
```

**What Happens:**
1. ✅ Button becomes disabled and shows spinner
2. ✅ "Starting Discovery..." text appears
3. ✅ API call is made to `/api/patches/chicago-bulls/start-discovery`

#### **Step 2: API Response**
```typescript
// Line 136-150
if (!response.ok) {
  const errorData = await response.json();
  setError(errorData.error || 'Discovery failed');
  setIsLoading(false);
  return;
}

const data = await response.json();
console.log('[Discovery] API Response:', data);

// Refresh the items list to show new content
await fetchItems();  // ← This loads the newly discovered content
setIsLoading(false);
```

**What Should Happen:**
1. ✅ Get response with discovered items
2. ✅ Refresh items list
3. ✅ Show new discovered content cards
4. ❌ **ISSUE**: No real-time progress updates during discovery

---

## 🔧 **Backend Flow** (`/api/patches/[handle]/start-discovery`)

### **Step 1: Authentication & Validation**
```typescript
// Lines 13-56
1. Check user session (auth)
2. Verify user owns patch or is member
3. Check DEEPSEEK_API_KEY is configured
```

### **Step 2: Call DeepSeek API**
```typescript
// Lines 74-133
1. Send prompt to DeepSeek: "Find content about {patch.name}"
2. DeepSeek searches and returns JSON with URLs/titles
3. Parse JSON response
```

### **Step 3: Save to Database + Generate AI Images**
```typescript
// Lines 174-259
for (const item of discoveredItems) {
  // 1. Create discoveredContent record
  const discoveredContent = await prisma.discoveredContent.create({...});
  
  // 2. Trigger AI image generation (NEW!)
  const aiImageResponse = await fetch('/api/ai/generate-hero-image', {
    body: JSON.stringify({
      title: discoveredContent.title,
      summary: discoveredContent.content,
      artisticStyle: 'photorealistic'
    })
  });
  
  // 3. Update with AI image if successful
  if (aiImageResponse.ok) {
    await prisma.discoveredContent.update({
      where: { id: discoveredContent.id },
      data: { mediaAssets: { heroImage: {...} } }
    });
  }
  
  // 4. Also trigger hero enrichment (fallback)
  await fetch('/api/internal/enrich/...', {...});
}
```

**⏱️ Duration**: 30-60 seconds for 5 items (DeepSeek + AI images + enrichment)

---

## ⚠️ **Current Issues**

### **Issue 1: No Real-Time Progress**
**Problem**: User clicks button, sees "Discovery Live", but no progress indication for 30-60 seconds.

**Why**: 
- Discovery runs synchronously
- Frontend waits for entire process to complete
- No streaming or progress updates

**Solution Options**:

#### **A. Add Progress Indicators (Quick Fix)**
```typescript
// In DiscoveringContent.tsx
const [discoveryProgress, setDiscoveryProgress] = useState({
  stage: 'idle', // 'searching', 'saving', 'generating-images', 'done'
  itemsFound: 0,
  itemsProcessed: 0,
  currentItem: ''
});

// Update UI to show:
"Searching for content..." (5s)
"Found 5 items, saving to database..." (5s)
"Generating AI images (1/5)..." (40s)
"Discovery complete!"
```

#### **B. Use Server-Sent Events (Better)**
```typescript
// Backend sends progress updates:
event: progress
data: {"stage": "searching", "message": "Querying DeepSeek..."}

event: progress
data: {"stage": "saving", "item": 1, "total": 5, "title": "..."}

event: progress  
data: {"stage": "generating-image", "item": 1, "total": 5}

event: complete
data: {"itemsDiscovered": 5, "imagesGenerated": 5}
```

### **Issue 2: "albert-einstein" Agent Error**
**Error**: `Error getting training record: Error: Agent albert-einstein not found`

**Where**: `/api/agents/training-records` → `AgentSpecificRetriever.getAllTrainingRecords()`

**Root Cause**:
1. Line 822: Gets all agents from database
2. Line 827: Tries to get training record for each
3. Line 768-769: `AgentRegistry.getAgentById('albert-einstein')` fails
4. **Problem**: "albert-einstein" exists in `FEATURED_AGENTS` but NOT in database

**Why It Happens**:
```typescript
// lib/agents.ts - FEATURED_AGENTS array
{
  id: 'albert-einstein',
  name: 'Albert Einstein',
  // ... defined here
}

// Database: NO record for albert-einstein
// Only created when user explicitly trains that agent
```

**Impact**:
- ❌ Error logged on every page load
- ✅ **Gracefully handled** - returns empty record
- ✅ **Does NOT break discovery**

**Fix Options**:

#### **A. Suppress Error for Featured Agents (Quick)**
```typescript
// In getAgentTrainingRecord()
try {
  const agent = await AgentRegistry.getAgentById(agentId);
  if (!agent) {
    // Check if it's a featured agent
    const { FEATURED_AGENTS } = await import('@/lib/agents');
    const featured = FEATURED_AGENTS.find(f => f.id === agentId);
    if (featured) {
      // Return empty record without error
      return {
        agentId,
        agentName: featured.name,
        domainExpertise: featured.domains || [],
        totalMemories: 0,
        // ...
      };
    }
    throw new Error(`Agent ${agentId} not found`);
  }
}
```

#### **B. Seed Database with Featured Agents (Better)**
```typescript
// Add to prisma seed or migration
for (const featured of FEATURED_AGENTS) {
  await prisma.agent.upsert({
    where: { id: featured.id },
    update: {},
    create: {
      id: featured.id,
      name: featured.name,
      // ... other fields
    }
  });
}
```

---

## 🐛 **Debugging: Step-by-Step**

### **1. Check if Discovery is Running**
```bash
# In Render.com logs, search for:
"[Start Discovery] Starting DeepSeek search"
"[Start Discovery] Saved items: X"
"[Start Discovery] ✅ AI image generated successfully"
```

### **2. Check DeepSeek API**
```bash
# Look for:
"[Start Discovery] DeepSeek API error: 401" ← API key missing/invalid
"[Start Discovery] Failed to parse DeepSeek response" ← JSON parsing error
```

### **3. Check AI Image Generation**
```bash
# Look for:
"[Start Discovery] Triggering AI image generation for: ..."
"[Start Discovery] ✅ AI image generated successfully"
"[Start Discovery] AI image generation failed: ..." ← Endpoint unreachable
```

### **4. Check Frontend Console**
```javascript
// Open browser console, look for:
"[Discovery] Button clicked - starting discovery for patch: chicago-bulls"
"[Discovery] Making POST request to start-discovery API..."
"[Discovery] API Response: {success: true, itemsFound: 5}"
```

---

## 📈 **Expected Timeline**

```
0s:    User clicks "Start Discovery"
       → Button: "Starting Discovery..."
       
2s:    Backend: Calling DeepSeek API
       → No visible change (waiting)
       
8s:    Backend: DeepSeek returns 5 items
       → No visible change (still waiting)
       
10s:   Backend: Saving items to database (5 items)
       → No visible change
       
15s:   Backend: Generating AI image 1/5
       → No visible change
       
25s:   Backend: Generating AI image 2/5
       → No visible change
       
35s:   Backend: Generating AI image 3/5
       → No visible change
       
45s:   Backend: Generating AI image 4/5
       → No visible change
       
55s:   Backend: Generating AI image 5/5
       → No visible change
       
60s:   Backend: All done! Returns success
       Frontend: Receives response
       Frontend: Fetches items again
       Frontend: Displays 5 new cards
       Button: Back to "Start Content Discovery"
       
       ✅ USER FINALLY SEES RESULTS
```

**Problem**: 60 seconds of "black box" waiting!

---

## 🎯 **Recommended Fixes (Priority Order)**

### **1. Add Fake Progress (Immediate - 5 minutes)**
```typescript
// In handleStartDiscovery()
setIsLoading(true);

// Show fake progress
setTimeout(() => setProgress("Searching for content..."), 1000);
setTimeout(() => setProgress("Found 5 items, processing..."), 5000);
setTimeout(() => setProgress("Generating AI images..."), 10000);
setTimeout(() => setProgress("Almost done..."), 40000);

const response = await fetch(...);
setProgress("");
setIsLoading(false);
```

### **2. Move AI Generation to Background (Better - 30 minutes)**
```typescript
// In start-discovery route
for (const item of discoveredItems) {
  const discoveredContent = await prisma.discoveredContent.create({...});
  
  // DON'T await AI generation - fire and forget
  fetch('/api/ai/generate-hero-image', {...}).then(async (res) => {
    // Update image when ready
  }).catch(() => {
    // Ignore failures
  });
  
  savedItems.push(discoveredContent);
}

// Return immediately
return NextResponse.json({ success: true, items: savedItems });
```

### **3. Add Server-Sent Events (Best - 2 hours)**
```typescript
// Use streaming responses
const stream = new TransformStream();
const writer = stream.writable.getWriter();

// Send progress updates
writer.write("data: {\"stage\":\"searching\"}\n\n");
// ... do work
writer.write("data: {\"stage\":\"generating\",\"progress\":20}\n\n");

return new Response(stream.readable, {
  headers: { 'Content-Type': 'text/event-stream' }
});
```

### **4. Fix Agent Error (Quick - 10 minutes)**
```typescript
// In getAgentTrainingRecord(), catch and handle featured agents
if (!agent) {
  const { FEATURED_AGENTS } = await import('@/lib/agents');
  const featured = FEATURED_AGENTS.find(f => f.id === agentId);
  if (featured) {
    return createEmptyRecord(featured);
  }
  throw new Error(`Agent ${agentId} not found`);
}
```

---

## 🧪 **Testing**

### **Test 1: Discovery Works**
1. Go to https://carrot-app.onrender.com/patch/chicago-bulls
2. Click "Start Discovery"
3. Wait 60 seconds
4. Should see 5 new content cards

**Expected Logs**:
```
[Start Discovery] Starting DeepSeek search
[Start Discovery] Saved items: 5
[Start Discovery] ✅ AI image generated successfully (5x)
```

### **Test 2: AI Images Generate**
1. After discovery completes
2. Check if images load in cards
3. If not, check: `VAST_AI_URL` environment variable

**Fallback**: Should show Wikimedia images if AI fails

### **Test 3: Progress Feedback**
❌ Currently none
✅ After fix: Should see progress messages

---

## 📞 **Quick Debug Commands**

```bash
# Check Render logs for discovery
# Search for: "[Start Discovery]"

# Check if DeepSeek is working
curl -X POST https://your-app.onrender.com/api/patches/chicago-bulls/start-discovery \
  -H "Content-Type: application/json" \
  -d '{"action":"start_deepseek_search"}'

# Check agent error
# Search logs for: "albert-einstein not found"
# Impact: None (handled gracefully)
```

---

## ✅ **Summary**

### **What's Working**
- ✅ Discovery button triggers API
- ✅ DeepSeek finds content
- ✅ Content saves to database
- ✅ AI images generate (if endpoint configured)
- ✅ Errors handled gracefully

### **What's Not Working**
- ❌ No progress feedback during 60s wait
- ⚠️ Agent error in logs (harmless but annoying)

### **Next Steps**
1. **Immediate**: Add fake progress messages
2. **Short-term**: Move AI generation to background
3. **Long-term**: Add real-time progress with SSE
4. **Bonus**: Fix agent error suppression

---

*Document Created: October 18, 2025*  
*Status: Debugging Guide*

