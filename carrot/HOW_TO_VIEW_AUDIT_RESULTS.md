# How to View Discovery Audit Results

## Real-Time Monitoring

The comprehensive discovery audit script outputs results in two ways:

### 1. **Console Output** (Real-Time)
The script prints metrics every 15 seconds showing:
- Discovery run status
- Citations found, processed, and saved
- Content saved by source type (Anna's Archive, NewsAPI, Wikipedia, etc.)
- Content quality metrics (text length, relevance scores)
- Agent learning progress (feed queue, memories)
- Processing stats and errors

### 2. **JSON Report File** (Final Results)
When the audit completes, it saves a JSON file:
- **Location:** `carrot/DISCOVERY_AUDIT_[runId]_[date].json`
- **Contains:** Complete final metrics and audit data

## Viewing Results

### Option 1: Check the Log File
The script output is being saved to a log file:
```powershell
# List latest log files
Get-ChildItem carrot/discovery-audit-*.log | Sort-Object LastWriteTime -Descending

# View the latest log
Get-Content carrot/discovery-audit-*.log -Tail 100
```

### Option 2: Check JSON Report Files
```powershell
# List audit reports
Get-ChildItem carrot/DISCOVERY_AUDIT_*.json | Sort-Object LastWriteTime -Descending

# View latest report
Get-Content (Get-ChildItem carrot/DISCOVERY_AUDIT_*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Option 3: Run Script in Foreground
To see real-time output, run:
```powershell
cd carrot
$env:DATABASE_URL="postgresql://..."
$env:REDIS_URL="rediss://..."
$env:NEWS_API_KEY="..."
npx tsx scripts/run-comprehensive-discovery-audit.ts
```

### Option 4: Check Database Directly
You can also query the database directly to see:
- `DiscoveryRun` table for run status
- `DiscoveredContent` table for saved content
- `WikipediaCitation` table for citations
- `AgentMemoryFeedQueue` for agent learning queue
- `AgentMemory` for created memories

## What Gets Tracked

The audit tracks:

1. **Citations**
   - Found, processed, saved counts
   - Save rate percentage

2. **Content Saved (by source type)**
   - Anna's Archive books
   - NewsAPI articles
   - Wikipedia pages
   - Wikipedia citations
   - Other sources

3. **Content Quality**
   - Items with text content
   - Average text length
   - Relevance and quality scores

4. **Agent Learning**
   - Feed queue items
   - Processed items
   - Agent memories created

5. **Processing Stats**
   - Items processed/skipped/failed
   - Errors and warnings

## Next Steps

After the audit completes:
1. Review the final JSON report
2. Check for any errors or warnings
3. Verify all source types are being saved
4. Confirm agent learning is working
5. Address any issues found

